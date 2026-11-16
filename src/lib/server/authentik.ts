/**
 * Anmeldung über Authentik (Story 4.1, FR-26, AD-9).
 *
 * OpenID Connect mit Authorization Code und PKCE, von Hand statt über eine
 * Bibliothek: Der Fluss besteht aus zwei Aufrufen und einer Prüfung, und eine
 * Bibliothek brächte hier mehr Abhängigkeit als Nutzen — bei etwas, das im
 * Versammlungsraum auch ausfallen können muss.
 *
 * **Jeder Aufruf hat ein Zeitlimit** (AD-9). Ohne eines hinge die Anmeldeseite
 * im Saal ohne Netz, bis das Betriebssystem aufgibt, und die Rückfallebene käme
 * zu spät.
 */
import { createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { ERREICHBARKEIT_ZEITLIMIT_MS, type Erreichbarkeit } from '$lib/domain/anmeldewege';
import {
	darfErstverknuepfen,
	nachgezogeneAngaben,
	normalisiereEmail
} from '$lib/domain/kontoverknuepfung';
import type { Rolle } from '$lib/domain/rollen';
import type { AngemeldeterBenutzer } from './auth';

/**
 * Kurzlebige Kekse für den einen Anlauf.
 *
 * Sie stehen hier und nicht in der Route: Aus einem `+server.ts` lässt
 * SvelteKit nur die Verben ausführen — jede andere Ausfuhr bricht den Aufruf ab,
 * und zwar erst zur Laufzeit.
 */
export const ZUSTAND_COOKIE = 'versammlung_oidc_zustand';
export const PRUEFER_COOKIE = 'versammlung_oidc_pruefer';
export const ZIEL_COOKIE = 'versammlung_oidc_ziel';

/** Pfad, auf den die Anlaufkekse begrenzt sind. */
export const OIDC_KEKSPFAD = '/anmelden';

export interface AuthentikEinstellungen {
	aussteller: string;
	clientId: string;
	clientSecret: string;
}

export function einstellungen(): AuthentikEinstellungen | null {
	const aussteller = env.AUTHENTIK_ISSUER?.replace(/\/+$/, '');
	const clientId = env.AUTHENTIK_CLIENT_ID;
	const clientSecret = env.AUTHENTIK_CLIENT_SECRET;
	if (!aussteller || !clientId || !clientSecret) return null;
	return { aussteller, clientId, clientSecret };
}

export function istEingerichtet(): boolean {
	return einstellungen() !== null;
}

/**
 * Prüft, ob Authentik antwortet.
 *
 * Fragt das Konfigurationsdokument ab — es ist der einzige Endpunkt, den es
 * ohne Zugangsdaten gibt, und wenn er antwortet, antwortet der Rest auch. Das
 * Ergebnis wird kurz gemerkt: Die Anmeldeseite wird im Saal von vierzehn
 * Telefonen zugleich geöffnet, und vierzehn Prüfungen mit je zwei Sekunden
 * Zeitlimit wären vierzehnmal dieselbe Auskunft.
 */
let gemerkt: { bis: number; wert: Erreichbarkeit } | null = null;

export async function pruefeErreichbarkeit(): Promise<Erreichbarkeit> {
	const e = einstellungen();
	if (!e) return 'nicht_eingerichtet';

	if (gemerkt && Date.now() < gemerkt.bis) return gemerkt.wert;

	let wert: Erreichbarkeit = 'nicht_erreichbar';
	try {
		const antwort = await fetch(`${e.aussteller}/.well-known/openid-configuration`, {
			signal: AbortSignal.timeout(ERREICHBARKEIT_ZEITLIMIT_MS)
		});
		wert = antwort.ok ? 'erreichbar' : 'nicht_erreichbar';
	} catch {
		// Zeitüberschreitung, DNS, kein Netz — für die Anmeldeseite dasselbe.
		wert = 'nicht_erreichbar';
	}

	// Erreichbar wird länger gemerkt als nicht erreichbar: Kommt das Netz
	// zurück, soll der bequeme Weg rasch wieder erscheinen; fällt es aus, soll
	// die Seite nicht minutenlang einen Knopf zeigen, der ins Leere führt.
	gemerkt = { wert, bis: Date.now() + (wert === 'erreichbar' ? 60_000 : 15_000) };
	return wert;
}

interface Konfiguration {
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
	end_session_endpoint?: string;
}

async function konfiguration(e: AuthentikEinstellungen): Promise<Konfiguration> {
	const antwort = await fetch(`${e.aussteller}/.well-known/openid-configuration`, {
		signal: AbortSignal.timeout(ERREICHBARKEIT_ZEITLIMIT_MS * 2)
	});
	if (!antwort.ok) throw new Error(`Authentik antwortet mit ${antwort.status}`);
	return antwort.json() as Promise<Konfiguration>;
}

export interface Anlauf {
	url: string;
	zustand: string;
	pruefer: string;
}

/**
 * Baut den Verweis zur Anmeldung bei Authentik.
 *
 * PKCE auch mit Client-Secret: Der Prüfer bindet die Antwort an genau diesen
 * Anlauf. Ohne ihn liesse sich ein abgefangener Code in einer anderen Sitzung
 * einlösen.
 */
/**
 * Beginnt einen Anmeldeanlauf.
 *
 * **`erneut` erzwingt die Anmeldemaske** (`prompt=login`). Ohne sie nimmt
 * Authentik stillschweigend die Sitzung, die im Browser schon offen ist — das
 * ist der Sinn einer einmaligen Anmeldung und im Regelfall richtig.
 *
 * Im Ausnahmefall ist es eine Sackgasse, und zwar eine, aus der niemand von
 * selbst herausfindet: Wer als Bewirtschaftung angemeldet ist und dann den
 * Eigentümerzugang öffnet, bekommt seine **Bewirtschaftungs-Kennung** zurück.
 * Die steht in keiner Momentaufnahme, also endet der Weg mit «zu Ihrem Konto
 * ist keine offene Versammlung eingetragen» — und ein zweiter Versuch führt
 * wieder dorthin, weil die Sitzung dieselbe bleibt. Gemeldet am 20.08.2026 mit
 * genau dem richtigen Verdacht: «Könnte es daran liegen, dass er den Token von
 * der Authentikanmeldung als Referenz nimmt?»
 */
export async function beginneAnmeldung(
	rueckweg: string,
	u: { erneut?: boolean } = {}
): Promise<Anlauf> {
	const e = einstellungen();
	if (!e) throw new Error('Authentik ist nicht eingerichtet.');

	const k = await konfiguration(e);
	const zustand = randomBytes(24).toString('base64url');
	const pruefer = randomBytes(32).toString('base64url');
	const abgeleitet = createHash('sha256').update(pruefer).digest('base64url');

	const p = new URLSearchParams({
		response_type: 'code',
		client_id: e.clientId,
		redirect_uri: rueckweg,
		scope: 'openid profile email',
		state: zustand,
		code_challenge: abgeleitet,
		code_challenge_method: 'S256'
	});

	// `login` und nicht `select_account`: Ersteres verlangen alle Anbieter
	// gleichermassen, Letzteres kennt nicht jeder — und ein Anlauf, der an einem
	// nicht unterstützten Wert scheitert, hilft niemandem weiter.
	if (u.erneut) p.set('prompt', 'login');

	return { url: `${k.authorization_endpoint}?${p}`, zustand, pruefer };
}

export interface AuthentikPerson {
	subject: string;
	benutzername: string;
	anzeigename: string;
	email: string | null;
}

/** Tauscht den Code gegen die Angaben zur Person. */
export async function holePerson(
	code: string,
	pruefer: string,
	rueckweg: string
): Promise<AuthentikPerson> {
	const e = einstellungen();
	if (!e) throw new Error('Authentik ist nicht eingerichtet.');

	const k = await konfiguration(e);

	const antwort = await fetch(k.token_endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: rueckweg,
			client_id: e.clientId,
			client_secret: e.clientSecret,
			code_verifier: pruefer
		}),
		signal: AbortSignal.timeout(ERREICHBARKEIT_ZEITLIMIT_MS * 3)
	});
	if (!antwort.ok) {
		throw new Error(`Der Tausch des Codes scheiterte (${antwort.status}).`);
	}
	const marken = (await antwort.json()) as { access_token?: string };
	if (!marken.access_token) throw new Error('Authentik lieferte keine Zugriffsmarke.');

	const person = await fetch(k.userinfo_endpoint, {
		headers: { authorization: `Bearer ${marken.access_token}` },
		signal: AbortSignal.timeout(ERREICHBARKEIT_ZEITLIMIT_MS * 3)
	});
	if (!person.ok) throw new Error(`Die Angaben zur Person fehlen (${person.status}).`);

	const p = (await person.json()) as {
		sub?: string;
		preferred_username?: string;
		name?: string;
		email?: string;
	};
	if (!p.sub) throw new Error('Authentik lieferte keine Kennung der Person.');

	return {
		subject: p.sub,
		benutzername: p.preferred_username ?? p.sub,
		anzeigename: p.name ?? p.preferred_username ?? p.sub,
		email: p.email ?? null
	};
}

/**
 * Ein Wort ins Serverprotokoll, wenn eine Anmeldung keinen Benutzer findet.
 *
 * **Warum es das braucht.** Nach aussen sieht jeder Fehlschlag gleich aus, und
 * das ist Absicht: Wer eine fremde Adresse probiert, soll nicht erfahren, ob es
 * das Konto gibt und ob sein Fenster offensteht. Damit weiss aber auch die
 * Bewirtschaftung nicht, warum ihr neuer Mitarbeiter nicht hereinkommt, und
 * genau diese Lage hat am 20.08.2026 beim Eigentümerzugang einen halben Tag
 * gekostet.
 *
 * **Was hier NICHT hineingeht:** die Adresse, die Kennung, der Code. Nur der
 * Name des Zweigs.
 */
function halt(zweig: string): void {
	console.warn(`[anmelden/authentik] kein Benutzer: ${zweig}`);
}

/**
 * Hält einen abgewiesenen Erstverknüpfungsversuch am betroffenen Konto fest.
 *
 * **Warum das mehr ist als Buchhaltung** (Sicherheitsprüfung 15.09.2026). Ohne
 * diesen Eintrag kostet ein Fehlversuch nichts und hinterlässt nichts. Damit
 * wird aus «der Angreifer müsste das Fenster treffen» ein «der Angreifer muss
 * warten»: Er setzt seine Adresse in Authentik auf die einer Verwaltung, meldet
 * sich täglich an und nimmt die nächste Öffnung mit. Die Wette geht auf, weil
 * niemand die vergeblichen Versuche sieht.
 *
 * Mit dem Eintrag steht in der Verlaufsansicht des Kontos, dass sich jemand
 * unter dieser Adresse anzumelden versucht hat, und wann.
 *
 * **Die Kennung des Anfragenden steht bewusst NICHT dabei.** Sie sagt der
 * Bewirtschaftung nichts, was sie handhaben könnte, und sie wäre eine Angabe
 * über einen Menschen, der mit diesem Konto womöglich nichts zu tun hat.
 *
 * **Und es darf die Anmeldung nicht mitreissen**, wie schon bei
 * `vermerkeRueckfall` (27.08.2026).
 */
async function vermerkeAbweisung(
	operatorId: string,
	kontoId: string,
	username: string,
	grund: string
): Promise<void> {
	try {
		await alsBetreiber(operatorId, async (tx) => {
			await schreibeVerlauf(
				tx,
				{ operatorId, userId: null, label: 'Anmeldung über Authentik' },
				ereignis(
					EREIGNISARTEN.kontoVerknuepfungAbgewiesen,
					{ art: 'app_user', id: kontoId },
					{ konto: username, grund }
				)
			);
		});
	} catch (fehler) {
		console.error(
			'Abweisung nicht vermerkt:',
			fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
		);
	}
}

/**
 * Zieht Name und Adresse aus Authentik nach.
 *
 * **Authentik führt die Angaben zur Person** (ADR-0004). Wer dort heiratet und
 * den Namen ändern lässt, soll nicht in jedem künftigen Protokolleintrag weiter
 * unter dem alten stehen. Bereits geschriebene Einträge bleiben davon unberührt:
 * `audit_entry.actor_label` und `minutes.created_by_label` halten den Namen als
 * Text fest, wie er zur Zeit der Handlung galt.
 *
 * **Und es darf die Anmeldung nicht mitreissen.** Derselbe Fehler wie bei
 * `vermerkeRueckfall` (27.08.2026): Was hier fliegt, würde aus einer gelungenen
 * Anmeldung eine HTTP 500 machen. Der wahrscheinlichste Grund ist nicht einmal
 * exotisch — trägt eine zweite Person dieselbe Adresse, hält der eindeutige
 * Index dagegen. Dann bleibt die alte Angabe stehen, und das ist allemal besser
 * als eine Anmeldung, die im Saal nicht gelingt.
 */
async function zieheAngabenNach(
	operatorId: string,
	benutzerId: string,
	person: AuthentikPerson,
	bisher: { displayName: string; email: string | null }
): Promise<{ displayName: string; email: string | null }> {
	const soll = nachgezogeneAngaben(
		{ anzeigename: person.anzeigename, email: person.email },
		bisher
	);
	if (soll.displayName === bisher.displayName && soll.email === bisher.email) return bisher;

	try {
		// **Unter dem gewöhnlichen Zeilenschutz**, nicht über eine Funktion mit
		// erhöhten Rechten: Der Betreiber ist an dieser Stelle bekannt, also gibt
		// es keinen Grund, die Regel zu umgehen.
		await alsBetreiber(operatorId, async (tx) => {
			await tx`
				UPDATE app_user
				SET display_name = ${soll.displayName}, email = ${soll.email}
				WHERE id = ${benutzerId}
			`;
			// **Auch dieser Schreibweg kommt in den Verlauf.** Er war zuerst der
			// einzige ohne Eintrag (Code-Review 15.09.2026) — und ausgerechnet der,
			// den kein Mensch auslöst. Eine Adresse, die sich von aussen ändert,
			// ohne dass es irgendwo steht, ist genau die Spur, die später fehlt.
			await schreibeVerlauf(
				tx,
				{ operatorId, userId: benutzerId, label: soll.displayName },
				ereignis(
					EREIGNISARTEN.kontoAngabenGeaendert,
					{ art: 'app_user', id: benutzerId },
					{
						weg: 'aus_authentik',
						name_vorher: bisher.displayName,
						name_nachher: soll.displayName,
						adresse_gewechselt: bisher.email !== soll.email
					}
				)
			);
		});
		return soll;
	} catch (fehler) {
		/*
		 * **Und die gemeldeten Angaben sind dann die alten** (Code-Review
		 * 15.09.2026). Die erste Fassung gab den neuen Namen auch nach einem
		 * Fehlschlag zurück: Die Sitzung trug ihn, die Datenbank den alten, und
		 * die Verlaufseinträge dieser Anmeldung standen unter einem Namen, den
		 * das Konto nie hatte.
		 */
		/*
		 * **Nur die Meldung, nicht das Fehlerobjekt** (Sicherheitsprüfung
		 * 15.09.2026). Der wahrscheinlichste Grund ist eine Verletzung von
		 * `app_user_email_eindeutig`, und das Objekt von postgres.js trägt dann
		 * in `detail` die Adresse im Klartext — während `halt()` zwei Funktionen
		 * weiter oben Adressen bewusst aus dem Protokoll hält.
		 */
		console.error(
			'Angaben aus Authentik nicht nachgezogen:',
			fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
		);
		return bisher;
	}
}

/**
 * Findet den lokalen Benutzer zu einer Authentik-Person.
 *
 * **Es wird kein Konto angelegt.** Wer sich bei Authentik anmelden kann, ist
 * damit noch nicht berechtigt, eine Versammlung zu führen — die Berechtigung
 * vergibt die Bewirtschaftung, indem sie ein Konto anlegt. Ein automatisch
 * angelegtes Konto machte jeden im Verzeichnis zum Sitzungsleiter.
 *
 * **Zwei Wege, und nur der erste ist dauerhaft.** Gefunden wird über die
 * Kennung (`sub`), weil sie sich nicht ändert. Beim ersten Mal steht sie
 * naturgemäss noch nirgends; dann zählt die E-Mail-Adresse, aber nur solange
 * die Verwaltung dafür ein Fenster geöffnet hat. Die Begründung dieser Schranke
 * steht in `domain/kontoverknuepfung.ts`.
 *
 * **Der Benutzername trägt hier nichts mehr** (Vorgabe des Auftraggebers, 15.09.2026). Er
 * verlangte, dass beide Seiten denselben Namen führen, und genau daran ist es
 * in der Praxis gescheitert.
 */
export async function findeBenutzer(
	person: AuthentikPerson
): Promise<AngemeldeterBenutzer | null> {
	/*
	 * **Über Funktionen mit erhöhten Rechten, nicht über die Tabelle**
	 * (Migration 111, Befund vom 15.09.2026). `app_user` steht unter
	 * `FORCE ROW LEVEL SECURITY` nach Betreiber — und beim Anmelden ist der
	 * Betreiber noch unbekannt, er steht ja erst in der gesuchten Zeile. Die
	 * frühere Fassung las die Tabelle unmittelbar: Sie lief fehlerfrei und fand
	 * nie etwas, was von aussen wie «dieses Konto gibt es nicht» aussah.
	 * Dieselbe Falle und derselbe Ausweg wie bei der lokalen Anmeldung
	 * (Migration 003).
	 */
	const [ueberKennung] = await sql<
		{
			id: string;
			operator_id: string;
			username: string;
			display_name: string;
			role: Rolle;
			email: string | null;
			disabled_at: Date | null;
		}[]
	>`SELECT * FROM authentik_konto_zu_kennung(${person.subject})`;
	if (ueberKennung) {
		/*
		 * **Gefunden ist gefunden, auch ausser Dienst** (Code-Review 15.09.2026).
		 * Die erste Fassung filterte den Dienststand schon in der Suche weg. Dann
		 * fiel die Anmeldung auf den Adressweg zurück und hängte dieselbe Kennung
		 * an ein zweites Konto — was der über alle Betreiber eindeutige Index
		 * `app_user_oidc_subject_idx` mit einer Schlüsselverletzung beantwortete.
		 * Beim Benutzer kam «Authentik ist nicht erreichbar» an.
		 */
		if (ueberKennung.disabled_at) {
			halt('Konto ausser Dienst');
			return null;
		}
		const gilt = await zieheAngabenNach(ueberKennung.operator_id, ueberKennung.id, person, {
			displayName: ueberKennung.display_name,
			email: ueberKennung.email
		});
		return {
			id: ueberKennung.id,
			operatorId: ueberKennung.operator_id,
			username: ueberKennung.username,
			// **Was wirklich in der Datenbank steht**, nicht was Authentik geliefert
			// hat: Sonst trügen die Verlaufseinträge dieser Anmeldung einen Namen,
			// den das Konto nie bekommen hat.
			displayName: gilt.displayName,
			role: ueberKennung.role
		};
	}

	if (!person.email) {
		halt('Authentik lieferte keine Adresse');
		return null;
	}
	const adresse = normalisiereEmail(person.email);

	const kandidaten = await sql<
		{
			id: string;
			operator_id: string;
			username: string;
			display_name: string;
			role: Rolle;
			email: string | null;
			disabled_at: Date | null;
			oidc_link_until: Date | null;
			kennung_anderswo: boolean;
		}[]
	>`SELECT * FROM authentik_konto_zu_adresse(${adresse}, ${person.subject})`;
	if (kandidaten.length === 0) {
		halt('kein Konto zu dieser Adresse');
		return null;
	}
	/*
	 * **Mehr als eines heisst: keines** (Code-Review 15.09.2026). Die Adresse ist
	 * nur je Betreiber eindeutig, diese Suche läuft ohne Betreiber. Wer hier
	 * wählte, entschiede über die Reihenfolge in der Tabelle, in welchen Mandanten
	 * ein Mensch gerät — und seine Kennung bliebe danach dort. Dieselbe Antwort
	 * wie beim Eigentümerzugang: fragen lassen, nicht raten (Migration 068).
	 */
	if (kandidaten.length > 1) {
		halt('mehrdeutig');
		return null;
	}
	const kandidat = kandidaten[0];

	/*
	 * **Eine gelöste Kennung kehrt nur zu ihrem eigenen Konto zurück**
	 * (Sicherheitsprüfung 16.09.2026).
	 *
	 * Solange eine Kennung gesetzt ist, trägt sie ihren Besitzer zwingend ins
	 * eigene Konto — der Zweig darüber greift, und dieser hier wird nie erreicht.
	 * Das war eine Schranke, die niemandem als solche bewusst war, bis das Lösen
	 * sie zu einem Knopf machte: Wer sich selbst entkoppelt, könnte sich danach an
	 * das nächstbeste Konto mit offenem Fenster binden, indem er in Authentik
	 * dessen Adresse einträgt.
	 *
	 * Deshalb zählt hier die Geschichte der Kennung. Zurück zum eigenen Konto ist
	 * erlaubt und der gewollte Fall: Wer versehentlich gelöst hat, kommt wieder
	 * herein, sobald die Verwaltung das Fenster öffnet.
	 */
	if (kandidat.kennung_anderswo) {
		halt('Kennung gehörte zuletzt einem anderen Konto');
		await vermerkeAbweisung(
			kandidat.operator_id,
			kandidat.id,
			kandidat.username,
			'kennung_anderswo'
		);
		return null;
	}

	const ausgang = darfErstverknuepfen(
		{
			hatKennung: false,
			email: kandidat.email,
			offenBis: kandidat.oidc_link_until,
			ausserDienst: kandidat.disabled_at !== null
		},
		new Date()
	);
	if (!ausgang.erlaubt) {
		halt(ausgang.hindernis);
		await vermerkeAbweisung(
			kandidat.operator_id,
			kandidat.id,
			kandidat.username,
			ausgang.hindernis
		);
		return null;
	}

	/*
	 * **Die Schranke steht im UPDATE, nicht in der Prüfung darüber.**
	 *
	 * Die reine Funktion entscheidet und benennt den Grund; sie ist aber eine
	 * Aussage über einen Stand, den zwischen Lesen und Schreiben jemand ändern
	 * kann — ein zweiter Anlauf derselben Person, ein Ausserdienststellen im
	 * selben Moment. Träfe das UPDATE die Zeile ohne Bedingung, entschiede das
	 * Rennen. Deshalb steht jede Bedingung hier noch einmal, und ob sie gegriffen
	 * hat, wird gemessen statt angenommen.
	 */
	const verknuepft = await alsBetreiber(kandidat.operator_id, async (tx) => {
		/*
		 * **Derselbe Namenswächter wie auf dem Kennungsweg** (Sicherheitsprüfung
		 * 15.09.2026). Hier stand `person.anzeigename` zuerst roh — und umging
		 * damit genau die Regel, die `nachgezogeneAngaben` eine Funktion weiter
		 * oben durchsetzt. Ein Authentik-Konto ohne Namen hätte den von der
		 * Verwaltung erfassten geleert, und im Verlauf stünde eine Handlung ohne
		 * Person.
		 */
		const angaben = nachgezogeneAngaben(
			{ anzeigename: person.anzeigename, email: person.email },
			{ displayName: kandidat.display_name, email: kandidat.email }
		);
		const geschrieben = await tx<{ display_name: string }[]>`
			UPDATE app_user
			SET oidc_subject = ${person.subject},
			    oidc_link_until = NULL,
			    display_name = ${angaben.displayName}
			WHERE id = ${kandidat.id}
			  AND oidc_subject IS NULL
			  AND disabled_at IS NULL
			  AND oidc_link_until IS NOT NULL
			  AND oidc_link_until > now()
			  -- **Auch die Adresse, über die gefunden wurde** (Sicherheitsprüfung
			  -- 15.09.2026). Sie fehlte, obwohl der Kommentar oben «jede Bedingung»
			  -- versprach — und sie ist die einzige, die die Identität trägt.
			  -- Korrigiert die Verwaltung in diesem Moment einen Tippfehler in der
			  -- Adresse, träfe ein gleichzeitiger Anlauf mit der alten Adresse die
			  -- Zeile trotzdem, und die Korrektur hätte nichts verhindert.
			  AND lower(email) = ${adresse}
			RETURNING display_name
		`;
		if (geschrieben.length === 0) return null;

		// **Eine stille Erstverknüpfung wäre die eine, die man später sucht.**
		// Sie ist der Moment, in dem ein Konto von aussen erreichbar wird; steht
		// er nicht im Verlauf, lässt sich hinterher nicht sagen, wann und durch
		// wen. In derselben Transaktion, damit es beides gibt oder keines.
		await schreibeVerlauf(
			tx,
			{ operatorId: kandidat.operator_id, userId: kandidat.id, label: angaben.displayName },
			ereignis(
				EREIGNISARTEN.kontoVerknuepft,
				{ art: 'app_user', id: kandidat.id },
				{ konto: kandidat.username, weg: 'erstverknuepfung_adresse' }
			)
		);
		return geschrieben[0].display_name;
	});

	if (verknuepft === null) {
		halt('Fenster zwischen Prüfung und Schreiben geschlossen');
		await vermerkeAbweisung(kandidat.operator_id, kandidat.id, kandidat.username, 'wettlauf');
		return null;
	}

	return {
		id: kandidat.id,
		operatorId: kandidat.operator_id,
		username: kandidat.username,
		displayName: verknuepft,
		role: kandidat.role
	};
}

/**
 * Hält fest, dass die lokale Anmeldung als Rückfallebene benutzt wurde (AD-9).
 *
 * **`alsBetreiber` und nicht `sql.begin`** (27.08.2026). `audit_entry` steht
 * unter Zeilenschutz: Die Regel verlangt, dass `operator_id` der Einstellung
 * `versammlung.operator_id` entspricht. Wer nur `sql.begin` nimmt, setzt sie
 * nicht, und die Zeile wird abgewiesen.
 *
 * **Was das kostete.** Der Vermerk ist der letzte Schritt einer erfolgreichen
 * lokalen Anmeldung. Schlägt er fehl, schlägt die ganze Anmeldung mit HTTP 500
 * fehl — und zwar genau dann, wenn Authentik als nicht erreichbar gilt. Das ist
 * der Fall, für den AD-9 die lokale Anmeldung überhaupt vorsieht: Der Notweg
 * riss auf, sobald man ihn brauchte. Aufgefallen ist es am 27.08.2026, als der
 * Entwicklungsserver unter Last stand und die Erreichbarkeitsprüfung in ihr
 * Zeitlimit lief.
 */
export async function vermerkeRueckfall(handelnder: Handelnder): Promise<void> {
	if (!handelnder.operatorId) {
		// Heute unerreichbar: `app_user.operator_id` ist NOT NULL. Steht es doch
		// einmal an, ist das eine Auffälligkeit und keine Nebensache — der
		// Vermerk soll nicht lautlos wegfallen.
		console.error('Rückfall-Vermerk ohne Betreiber verworfen:', handelnder.label);
		return;
	}
	/*
	 * **Und er darf die Anmeldung nicht mitreissen.**
	 *
	 * Der Aufrufer wartet auf diese Zusage, nachdem er die Sitzung schon gesetzt
	 * hat (`anmelden/+page.server.ts`). Was hier fliegt, wird zu HTTP 500 auf
	 * einer bereits gelungenen Anmeldung. Das ist derselbe Fehler wie der oben
	 * behobene, nur eine Ursache weiter: nicht mehr der Zeilenschutz, sondern
	 * ein Zeitlimit oder ein erschöpfter Verbindungsvorrat — und beides ist unter
	 * Last zu erwarten, also genau dann, wenn dieser Weg gebraucht wird.
	 *
	 * **Der Abwägung wegen ausgeschrieben:** Ein verlorener Vermerk ist ein
	 * Schaden, AD-9 verlangt ihn. Eine Anmeldung, die im Saal nicht gelingt, ist
	 * der grössere. Deshalb laut ins Protokoll und weiter, statt still zu
	 * scheitern oder die Anmeldung zu verhindern.
	 */
	try {
		await alsBetreiber(handelnder.operatorId, async (tx) => {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.anmeldungRueckfall,
					{ art: 'app_user', id: handelnder.userId ?? undefined },
					{
						grund: 'Die zentrale Anmeldung war nicht erreichbar.'
					}
				)
			);
		});
	} catch (fehler) {
		console.error('Rückfall-Vermerk nicht geschrieben:', fehler);
	}
}

/** Die Adresse zum Abmelden bei Authentik, sofern sie bekannt ist. */
export async function abmeldeUrl(): Promise<string | null> {
	const e = einstellungen();
	if (!e) return null;
	try {
		const k = await konfiguration(e);
		return k.end_session_endpoint ?? null;
	} catch {
		// Nicht erreichbar: Die lokale Sitzung wird trotzdem beendet. Eine
		// Abmeldung, die an einem unerreichbaren Dienst scheitert, liesse den
		// Benutzer angemeldet zurück — das Gegenteil des Gewollten.
		return null;
	}
}
