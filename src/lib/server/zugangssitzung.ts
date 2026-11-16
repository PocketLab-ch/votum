/**
 * Die Gerätesitzung des Eigentümers.
 *
 * **Warum es sie gibt.** Zwei Wege führen zum selben Zugang: der Code auf der
 * Karte (Regelfall) und ein von der Sitzungsleitung im Saal ausgegebener Code
 * (Ausnahme). Der zweite lässt sich nicht in einen Keks legen, der den
 * Kartencode trägt — der Server kennt ihn nicht im Klartext (NFR-5). Beide Wege
 * münden deshalb in ein Sitzungsmerkmal, das der Server erzeugt und nur als
 * Prüfwert speichert.
 *
 * **Eine je Zugang.** Ein zweiter Versuch mit dem Kartencode wird abgewiesen
 * und verdrängt das angemeldete Gerät nicht; beendet wird eine Sitzung nur
 * durch die Person selbst oder durch die Sitzungsleitung. Die Begründung steht
 * in `$lib/domain/geraetesitzung` und in Migration 019 — sie ist eine
 * Abwägung, keine Selbstverständlichkeit.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	AUSGABECODE_GUELTIG_MINUTEN,
	ausgabecodeAus,
	gibtZutritt,
	noetigeBytes,
	normalisiere,
	pruefeIrgendeinenCode,
	zutrittsgrund,
	type Codeart
} from '$lib/domain/zugang';
import {
	BELEGT_MELDUNG,
	endegrund,
	geraetebezeichnung,
	type Sitzungsausgang,
	type Sitzungsende
} from '$lib/domain/geraetesitzung';
import { abgeschlossen, type Versammlungszustand } from '$lib/domain/versammlung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';
import { haltCodeversuchFest } from './codeversuche';
import { meldeTeilnahmeAn } from './anwesenheit';
import { verkuendeStand } from './versammlungsstand';

export const ZUGANGS_COOKIE = 'versammlung_zugang';

/** Nur auf `/z` — der Keks hat auf keiner anderen Seite etwas zu suchen. */
export const ZUGANGS_PFAD = '/z';

/**
 * Der Keks, in dem eine gescannte Karte auf ihre Bestätigung wartet.
 *
 * Kurzlebig und nur für den Bereich der Versammlungen: Er trägt einen echten
 * Zugangscode, und der gehört so kurz wie möglich in die Welt. Gesetzt wird er
 * in `/z/<CODE>`, gelesen und weggeräumt auf der Anwesenheitsseite.
 */
export const KARTENKEKS = 'versammlung_karte';
export const KARTENKEKS_PFAD = '/versammlungen';

/**
 * Der Keks, in dem ein gescannter Kartencode auf das Abschicken wartet.
 *
 * **Warum der Code hier liegt und nicht sofort eingelöst wird** (FP-1,
 * 12.11.2026): Je Zugang ist nur ein Gerät zugelassen. Solange `GET /z/<code>`
 * den Code beim Abruf einlöste, belegte jeder Vorschau-Bot eines Messengers,
 * jedes Mailprogramm und jeder Crawler den Zugang, und der Eigentümer kam mit
 * seiner eigenen Karte nicht mehr hinein. Der Abruf merkt den Code deshalb nur
 * vor; eingelöst wird erst der POST des Formulars auf `/z`.
 *
 * **Kurzlebig und nur auf `/z`.** Der Keks trägt einen echten Zugangscode;
 * `httpOnly` hält ihn von jedem Skript fern, und nach zwei Minuten ist er
 * wertlos. Er ist nicht der Kartenkeks der Sitzungsleitung (`KARTENKEKS`): Der
 * gehört einer angemeldeten Leitung und führt zur Anwesenheitsseite.
 */
export const KARTENSCANKEKS = 'versammlung_kartenscan';
export const KARTENSCANKEKS_PFAD = '/z';
export const KARTENSCANKEKS_SEKUNDEN = 120;

export function setzeKartenscan(cookies: Cookies, code: string, sicher: boolean): void {
	cookies.set(KARTENSCANKEKS, code, {
		path: KARTENSCANKEKS_PFAD,
		httpOnly: true,
		sameSite: 'lax',
		secure: sicher,
		maxAge: KARTENSCANKEKS_SEKUNDEN
	});
}

export function leseKartenscan(cookies: Cookies): string | null {
	return cookies.get(KARTENSCANKEKS) ?? null;
}

/**
 * Löscht den Keks auch dann, wenn er schon fehlt: Ein Löschen ist billig, und
 * die Aktion soll ihn in jedem Fall hinter sich lassen (FP-1).
 */
export function loescheKartenscan(cookies: Cookies, sicher: boolean): void {
	cookies.delete(KARTENSCANKEKS, { path: KARTENSCANKEKS_PFAD, secure: sicher });
}

/**
 * Wie lange eine Gerätesitzung gilt.
 *
 * Zwölf Stunden: lang genug für eine Versammlung samt Anreise und Ausklang,
 * kurz genug, dass ein liegengebliebenes Telefon am nächsten Tag nichts mehr
 * öffnet. Die eigentliche Grenze ist ohnehin das Schliessen der Versammlung.
 */
export const SITZUNGSDAUER_SEKUNDEN = 12 * 60 * 60;

function pruefwert(wert: string): string {
	return createHash('sha256').update(wert).digest('hex');
}

/** Prüfwert eines Codes — normalisiert, damit Schreibweise keine Rolle spielt. */
export function codePruefwert(code: string): string {
	return pruefwert(normalisiere(code));
}

export function setzeKeks(cookies: Cookies, merkmal: string, sicher: boolean): void {
	cookies.set(ZUGANGS_COOKIE, merkmal, {
		path: ZUGANGS_PFAD,
		httpOnly: true,
		sameSite: 'lax',
		// Im lokalen Betrieb im Versammlungsraum läuft die Verbindung über das
		// eigene WLAN; ohne Zertifikat wäre `secure` dort hinderlich.
		secure: sicher,
		maxAge: SITZUNGSDAUER_SEKUNDEN
	});
}

export function leseKeks(cookies: Cookies): string | null {
	return cookies.get(ZUGANGS_COOKIE) ?? null;
}

/**
 * `sicher` wie beim Setzen: Ein Löschen mit `Secure` über http verwirft der
 * Browser ebenso still, und der Keks bliebe stehen (A2, 15.10.2026).
 */
export function loescheKeks(cookies: Cookies, sicher: boolean): void {
	cookies.delete(ZUGANGS_COOKIE, { path: ZUGANGS_PFAD, secure: sicher });
}

// ── Einlösen ────────────────────────────────────────────────────────────────

export interface Einloesung {
	gelungen: boolean;
	merkmal?: string;
	art?: Codeart;
	ausgang: Sitzungsausgang;
	grund?: string;
}

/**
 * Die Meldung bei einem Code, der nicht greift.
 *
 * Ohne technische Angaben und ohne Hinweis darauf, ob er je gültig war — sonst
 * liesse sich durch Probieren herausfinden, welche Codes existieren.
 */
const NICHT_GUELTIG =
	'Dieser Code ist nicht gültig. Prüfen Sie, ob Sie ihn richtig abgetippt haben — ' +
	'sonst wenden Sie sich an die Sitzungsleitung.';

/**
 * Löst einen Code ein und legt die Gerätesitzung an.
 *
 * Läuft ohne Mandantenkontext über eine Funktion mit `SECURITY DEFINER`: Wer
 * einen Code eintippt, ist nicht angemeldet.
 *
 * Es wird **eine** Art geprüft, nicht beide: Ein achtstelliger Code kann kein
 * Kartencode sein, und beide Spalten abzufragen machte aus dem Formular ein
 * Werkzeug, mit dem sich zwei Suchräume auf einmal absuchen liessen.
 */
export async function loeseCodeEin(
	eingabe: string,
	browserkennung = ''
): Promise<Einloesung> {
	let geprueft: { code: string; art: Codeart };
	try {
		geprueft = pruefeIrgendeinenCode(eingabe);
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) {
			// Auch eine Eingabe, die schon an der Form scheitert, ist ein Versuch
			// (Audit B-05).
			await haltCodeversuchFest('zugangscode', false);
			return { gelungen: false, ausgang: 'unbekannt', grund: fehler.message };
		}
		throw fehler;
	}

	const merkmal = randomBytes(32).toString('base64url');
	const ablauf = new Date(Date.now() + SITZUNGSDAUER_SEKUNDEN * 1000);

	const [z] = await sql<{ sitzung: string | null; ausgang: Sitzungsausgang }[]>`
		SELECT * FROM zugang_einloesen(
			${geprueft.art === 'karte' ? codePruefwert(geprueft.code) : null},
			${geprueft.art === 'ausgabe' ? codePruefwert(geprueft.code) : null},
			${pruefwert(merkmal)},
			${geraetebezeichnung(browserkennung)},
			${ablauf}
		)
	`;

	/*
	 * **«Belegt» ist kein vergeblicher Versuch** (Audit B-05). Der Code stimmte;
	 * abgewiesen wurde das zweite Gerät. Wer das mitzählte, hätte die Spur mit
	 * dem häufigsten harmlosen Fall im Saal verstopft.
	 */
	await haltCodeversuchFest('zugangscode', Boolean(z?.sitzung) || z?.ausgang === 'belegt');

	if (z?.ausgang === 'belegt') {
		return { gelungen: false, ausgang: 'belegt', art: geprueft.art, grund: BELEGT_MELDUNG };
	}
	if (!z?.sitzung) return { gelungen: false, ausgang: 'unbekannt', grund: NICHT_GUELTIG };
	return { gelungen: true, ausgang: 'neu', merkmal, art: geprueft.art };
}

/**
 * Der Zustand der Versammlung, zu der ein Kartencode gehört, ohne Einlösen.
 *
 * **Warum es das gibt** (FP-1b, 12.11.2026). Die Seite `/z` schickt ihr
 * Formular nach dem Hydrieren selbst ab. Ein Abrufer, der JavaScript ausführt
 * (etwa der Linkprüfer eines Mailprogramms), löste damit weiter den Zugang
 * ein, obwohl `GET /z/<code>` seit FP-1 nichts mehr einlöst. Vor Beginn der
 * Versammlung soll er das nicht mehr: Dort steht der Knopf «Anmelden», und
 * erst ein Tipp löst ein. Ob die Versammlung schon läuft, sagt diese
 * Nachschau. `null` heisst: kein Zugang zu diesem Code.
 *
 * **Sie schreibt nichts.** `zugang_aufloesen` (Migration 016) ist eine reine
 * Abfrage: kein Benutzungsvermerk, keine Gerätesitzung. Nur deshalb darf sie
 * vor dem Einlösen laufen.
 *
 * **Gezählt wird der Versuch**, wie jede Prüfung eines Codes. Geht es danach
 * zum Einlösen, zählt `loeseCodeEin` nochmals; gelesen werden im Betrieb allein
 * die erfolglosen Versuche (`holeCodeversuche`). Eine zweite Zeile für
 * dieselbe Anfrage ist dort unsichtbar, eine ungezählte Prüfung wäre es nicht.
 * Ein Fehlcode erscheint dort dagegen doppelt oder öfter (Anstoss, Tipp, jedes
 * Neuladen binnen 120 Sekunden). Das ist eine Spur, keine Sperre
 * (`codeversuche.ts`); in Kauf genommen.
 *
 * Angenommen wird ein bereits geprüfter Kartencode (`pruefeIrgendeinenCode`).
 */
export async function lageDesKartencodes(code: string): Promise<string | null> {
	const [z] = await sql<{ meeting_state: string; access_state: string }[]>`
		SELECT * FROM zugang_aufloesen(${codePruefwert(code)})
	`;
	// Gelungen ist nur ein gültiger Zugang: `zugang_aufloesen` liefert auch
	// ersetzte und entwertete Codes (Sicherheitsprüfung 12.11.2026).
	await haltCodeversuchFest('zugangscode', z?.access_state === 'gueltig');
	return z?.meeting_state ?? null;
}

/**
 * Meldet einen Eigentümer über seine Authentik-Kennung an.
 *
 * Das Gegenstück zu `loeseCodeEin`, nur ohne Code: Wer hier ankommt, hat sich
 * bei Authentik ausgewiesen. Gesucht wird in der **Momentaufnahme** — die
 * Teilnahme hängt am eingefrorenen Stand, nicht an den heutigen Stammdaten.
 *
 * **Kein Codeversuch wird gezählt.** Die Zählung in `code_attempt` bewacht das
 * Durchprobieren von Codes; hier gibt es nichts durchzuprobieren, weil die
 * Kennung nicht von aussen kommt, sondern aus einer geprüften Anmeldung.
 */
export async function loeseAuthentikEin(
	kennung: string,
	browserkennung = ''
): Promise<Einloesung & { versammlung?: string; partei?: string; uebernommen?: boolean }> {
	const merkmal = randomBytes(32).toString('base64url');
	const ablauf = new Date(Date.now() + SITZUNGSDAUER_SEKUNDEN * 1000);

	// Der Kartencode eines so entstandenen Zugangs wird nie ausgegeben — er
	// existiert nur, damit die Zeile ihre Schranke erfüllt. Erzeugt wird er
	// trotzdem aus echtem Zufall: Ein erratbarer Prüfwert wäre ein Zugang.
	const kartencode = randomBytes(noetigeBytes()).toString('base64url');

	const [z] = await sql<
		// `ausgang` ist hier bewusst `string` und nicht `Sitzungsausgang`: Die
		// Funktion kennt mit «mehrdeutig» einen Ausgang mehr, den es beim Code
		// nicht gibt — dort kann eine Eingabe immer nur zu einer Versammlung
		// gehören.
		{ sitzung: string | null; ausgang: string; versammlung: string | null; partei: string | null }[]
	>`
		SELECT * FROM authentik_einloesen(
			${kennung},
			${codePruefwert(kartencode)},
			${pruefwert(merkmal)},
			${geraetebezeichnung(browserkennung)},
			${ablauf}
		)
	`;

	/*
	 * **«belegt» gibt es auf diesem Weg nicht mehr** (Migration 071).
	 *
	 * Wer sich mit dem eigenen Konto anmeldet, übernimmt ein bereits angemeldetes
	 * Gerät, statt vor der eigenen Tür stehen zu bleiben. Der Zweig bleibt
	 * trotzdem stehen: Läuft die Anwendung einmal gegen eine Datenbank mit der
	 * alten Funktion — ein halb ausgerollter Stand —, ist eine verständliche
	 * Meldung besser als ein stiller Fehlschlag.
	 */
	if (z?.ausgang === 'belegt') {
		return { gelungen: false, ausgang: 'belegt', grund: BELEGT_MELDUNG };
	}
	if (z?.ausgang === 'mehrdeutig') {
		return {
			gelungen: false,
			ausgang: 'unbekannt',
			grund:
				'Zu Ihrem Konto stehen gerade mehrere Versammlungen offen. Melden Sie sich über den ' +
				'Verweis aus der Einladung an oder wenden Sie sich an die Sitzungsleitung.'
		};
	}
	if (!z?.sitzung) {
		return {
			gelungen: false,
			ausgang: 'unbekannt',
			grund:
				'Zu Ihrem Konto ist gerade keine offene Versammlung eingetragen. Wenden Sie sich an ' +
				'die Bewirtschaftung — möglicherweise ist Ihr Zugang dort noch nicht verknüpft.'
		};
	}
	return {
		gelungen: true,
		ausgang: 'neu',
		merkmal,
		versammlung: z.versammlung ?? undefined,
		partei: z.partei ?? undefined,
		/*
		 * **Ob dabei ein anderes Gerät gewichen ist.** Die Person soll es
		 * erfahren — «wortlos verdrängt» wäre genau der Vorwurf, den Migration
		 * 068 vermeiden wollte, und er trifft nicht die Übernahme, sondern das
		 * Schweigen darüber.
		 */
		uebernommen: z.ausgang === 'uebernommen'
	};
}

export interface Sitzungsbefund {
	gueltig: boolean;
	/**
	 * Wer nach dem Schluss noch **hineinsehen** dürfte, ohne zu handeln.
	 *
	 * Gesetzt nur bei einer Karte, die für sich in Ordnung ist, und nur bei
	 * abgeschlossener Versammlung. Ob die Nachschau wirklich noch gilt,
	 * entscheidet der Aufrufer am Schlusszeitpunkt: Hier steht die Berechtigung,
	 * nicht die Frist.
	 */
	nachschau?: { operatorId: Id; meetingId: Id; snapshotPartyId: Id; parteiId: Id };
	operatorId?: Id;
	meetingId?: Id;
	snapshotPartyId?: Id;
	parteiId?: Id;
	versammlungszustand?: string;
	grund?: string;
	/**
	 * Auf welchem Weg diese Sitzung entstanden ist.
	 *
	 * Entscheidet, wie die Anwesenheit später heisst: «selbst» beim Code von der
	 * Karte, «authentik» beim eigenen Konto. Ohne diese Auskunft müsste die
	 * Anwendung eine zweite Abfrage ohne Mandantenkontext bauen, nur um zu
	 * erfahren, was in der Sitzung ohnehin steht.
	 */
	herkunft?: 'karte' | 'ausgabe' | 'authentik';
}

/** Löst das Sitzungsmerkmal aus dem Keks auf. */
export async function loeseSitzungAuf(merkmal: string): Promise<Sitzungsbefund> {
	if (!merkmal) return { gueltig: false };

	const zeilen = await sql<
		{
			operator_id: string;
			meeting_id: string;
			snapshot_party_id: string;
			party_id: string;
			access_state: 'gueltig' | 'ersetzt' | 'entwertet';
			meeting_state: string;
			session_expired: boolean;
			session_reason: Sitzungsende | null;
			session_origin: 'karte' | 'ausgabe' | 'authentik';
		}[]
	>`SELECT * FROM zugangssitzung_aufloesen(${pruefwert(merkmal)})`;

	const z = zeilen[0];
	if (!z) return { gueltig: false };

	if (z.session_expired) {
		// Der Grund steht der Person zu: «abgelaufen» und «die Sitzungsleitung hat
		// freigegeben» verlangen verschiedene nächste Schritte, und im Saal ist
		// keine Zeit, den Unterschied zu erraten.
		return {
			gueltig: false,
			/*
			 * **Nur der Grund «geschlossen» gibt eine Nachschau** (04.09.2026).
			 *
			 * Das Schliessen der Versammlung beendet die Gerätesitzungen
			 * serverseitig; dieser Zweig fängt sie ab, bevor der Zutritt überhaupt
			 * geprüft wird. Ohne diese Zeile käme die Nachschau nie zum Zug, und
			 * genau so war es beim ersten Anlauf: Der Drehbuchschritt blieb rot,
			 * und die Ursache lag drei Ebenen früher als vermutet.
			 *
			 * **Eng gefasst.** Wer sich abgemeldet hat, wessen Zugang abgelöst oder
			 * von der Sitzungsleitung freigegeben wurde, bekommt nichts: Dort ist
			 * das Ende eine Handlung, und die soll wirken. Nur wer schlicht dabei
			 * war, als der Abend endete, sieht noch, was beschlossen wurde.
			 *
			 * **Der Zugangszustand taugt nicht als alleinige Bedingung**
			 * (04.09.2026, gemessen): Das Schliessen entwertet **jeden** Zugang der
			 * Versammlung, das ist Aufräumen. Eine von Hand entwertete Karte
			 * unterscheidet sich davon nicht am Zustand, sondern am Widerrufsgrund
			 * der Sitzung.
			 *
			 * **`ersetzt` ist die Ausnahme davon** (aus dem Code-Review): Wird ein
			 * Zugang während der Versammlung erneuert, geht die alte Karte auf
			 * «ersetzt», ihre Gerätesitzung läuft aber weiter und wird erst vom
			 * Schliessen widerrufen — mit dem Grund «geschlossen». Ohne diese
			 * zweite Bedingung sähe das ausgesperrte alte Telefon danach eine
			 * Stunde lang die Beschlussliste, und das Erneuern wäre so lange
			 * folgenlos.
			 */
			nachschau:
				z.session_reason === 'geschlossen' && z.access_state !== 'ersetzt'
					? {
							operatorId: z.operator_id,
							meetingId: z.meeting_id,
							snapshotPartyId: z.snapshot_party_id,
							parteiId: z.party_id
						}
					: undefined,
			grund: endegrund(z.session_reason ?? 'abgelaufen')
		};
	}

	if (!gibtZutritt({ zustand: z.access_state }, z.meeting_state)) {
		return {
			gueltig: false,
			/*
			 * **Die Nachschau ist kein gültiger Zugang** (04.09.2026, Entscheid
			 * Auftraggeber: «dieselbe Stunde auf dem Mobiltelefon»).
			 *
			 * Nach dem Schluss soll das Telefon noch eine Weile zeigen, was
			 * beschlossen wurde — so, wie der Anzeigecode der Leinwand seit dem
			 * 21.08.2026 eine Stunde weitergilt, damit die Wand nicht vor dem
			 * ganzen Saal auf die Code-Eingabe zurückfällt.
			 *
			 * **`gueltig` bleibt deshalb `false`.** An dieser Zeile hängen acht
			 * Aktionen (Abstimmen, Bevollmächtigen, Weisungen, Widerrufen,
			 * Anmelden …); sie alle prüfen `gueltig` und bleiben damit von selbst
			 * zu. Wer die Nachschau stattdessen als gültigen Zugang gebaut hätte,
			 * öffnete acht Schreibwege, um eine Liste zu zeigen.
			 *
			 * Die Kennungen reisen nur mit, wenn die Karte selbst in Ordnung ist:
			 * Eine entwertete oder ersetzte bekommt auch keine Nachschau. **Wie
			 * lange** die Stunde läuft, entscheidet der Aufrufer am
			 * Schlusszeitpunkt der Versammlung; hier steht nur, wer überhaupt
			 * hineinsehen dürfte.
			 */
			/*
			 * **Im Betrieb unerreichbar, und das steht hier, damit niemand danach
			 * sucht** (04.09.2026, aus der Sicherheitsprüfung). Das Schliessen
			 * entwertet jeden Zugang und widerruft im selben Zug jede Sitzung; wer
			 * hier ankommt, hätte also eine gültige Karte bei abgeschlossener
			 * Versammlung, und die gibt es nicht.
			 *
			 * Der Zweig bleibt als zweite Schranke: Änderte das Schliessen sein
			 * Verhalten, stünde die Regel schon da. Er ist bewusst enger als der
			 * Zweig oben.
			 */
			nachschau:
				z.access_state === 'gueltig' && abgeschlossen(z.meeting_state as Versammlungszustand)
					? {
							operatorId: z.operator_id,
							meetingId: z.meeting_id,
							snapshotPartyId: z.snapshot_party_id,
							parteiId: z.party_id
						}
					: undefined,
			grund: zutrittsgrund({ zustand: z.access_state }, z.meeting_state) ?? NICHT_GUELTIG
		};
	}

	return {
		gueltig: true,
		operatorId: z.operator_id,
		meetingId: z.meeting_id,
		snapshotPartyId: z.snapshot_party_id,
		parteiId: z.party_id,
		versammlungszustand: z.meeting_state,
		herkunft: z.session_origin
	};
}

// ── Ausgeben (Sitzungsleitung) ──────────────────────────────────────────────

export interface Ausgabe {
	code: string;
	gueltigBis: string;
	name: string;
}

/**
 * Gibt einen kurzen Code für eine Partei aus.
 *
 * Der Regelfall bleibt die Karte. Dies ist der Ausnahmefall: Karte vergessen,
 * Kamera zu alt, Papier zerknittert. Die Sitzungsleitung liest den Code vor
 * oder schreibt ihn auf einen Zettel.
 *
 * **Die Karte bleibt gültig.** Wer sie fünf Minuten später doch in der Tasche
 * findet, soll sie benutzen können; ein Ausgabecode, der die Karte entwertet,
 * schüfe mitten in der Versammlung ein zweites Problem.
 *
 * Besteht noch kein Zugang — etwa weil die Karten nie erzeugt wurden —, entsteht
 * einer. Ohne ihn gäbe es nichts, woran der Ausgabecode hinge.
 */
export async function gibCodeAus(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennung: Id
): Promise<Ausgabe> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		if (!['freigegeben', 'laufend'].includes(m.state)) {
			throw new FachlicherFehler(
				'zustand_unpassend',
				m.state === 'entwurf'
					? 'Zugänge entstehen erst mit der Freigabe.'
					: 'Die Versammlung ist geschlossen. Ein Code gäbe niemandem mehr Zutritt.',
				'zustand'
			);
		}

		const [partei] = await tx<{ id: string; display_name: string }[]>`
			SELECT id, display_name FROM snapshot_party
			WHERE meeting_id = ${meetingId} AND (id = ${kennung} OR party_id = ${kennung})
			LIMIT 1
		`;
		if (!partei) {
			throw new FachlicherFehler(
				'unbekannte_partei',
				'Diese Partei ist an dieser Versammlung nicht stimmberechtigt.',
				'partei'
			);
		}

		let [zugang] = await tx<{ id: string }[]>`
			SELECT id FROM meeting_access
			WHERE snapshot_party_id = ${partei.id} AND state = 'gueltig'
		`;

		if (!zugang) {
			// Kein Zugang vorhanden: einer entsteht. Sein Kartencode wird nie
			// ausgegeben — die Karte kann später jederzeit erzeugt werden, und
			// dabei entsteht ohnehin ein neuer.
			const kartencode = randomBytes(noetigeBytes());
			[zugang] = await tx<{ id: string }[]>`
				INSERT INTO meeting_access (operator_id, meeting_id, snapshot_party_id, code_hash)
				VALUES (${handelnder.operatorId}, ${meetingId}, ${partei.id},
				        ${pruefwert(Buffer.from(kartencode).toString('base64url'))})
				RETURNING id
			`;
		}

		const code = ausgabecodeAus(new Uint8Array(randomBytes(AUSGABECODELAENGE_BYTES)));
		const gueltigBis = new Date(Date.now() + AUSGABECODE_GUELTIG_MINUTEN * 60 * 1000);

		await tx`
			UPDATE meeting_access SET
				handout_hash = ${codePruefwert(code)},
				handout_expires_at = ${gueltigBis},
				handout_issued_by = ${handelnder.userId}
			WHERE id = ${zugang.id}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.zugangscodeAusgegeben,
				{ art: 'meeting', id: meetingId },
				{
					// Der Name, nie der Code: Der Verlauf ist kein zweiter Speicher für
					// Geheimnisse.
					partei: partei.display_name,
					gueltigMinuten: AUSGABECODE_GUELTIG_MINUTEN
				}
			)
		);

		return { code, gueltigBis: gueltigBis.toISOString(), name: partei.display_name };
	});
}

/** Genug Bytes, dass der Code trotz verworfener Werte in einem Zug entsteht. */
const AUSGABECODELAENGE_BYTES = 32;

/**
 * Meldet das eigene Gerät ab.
 *
 * Erst mit der Ein-Gerät-Regel hat das Gewicht: Vorher räumte das Abmelden nur
 * den Keks weg, jetzt gibt es den Zugang für das nächste Gerät frei. Läuft ohne
 * Mandantenkontext — wer ein Gerät benutzt, ist nicht angemeldet.
 */
export async function beendeEigeneSitzung(merkmal: string): Promise<boolean> {
	if (!merkmal) return false;
	const [z] = await sql<{ zugangssitzung_beenden: boolean }[]>`
		SELECT zugangssitzung_beenden(${pruefwert(merkmal)})
	`;
	return z?.zugangssitzung_beenden ?? false;
}

/**
 * Gibt den Zugang einer Partei wieder frei — der Weg der Sitzungsleitung.
 *
 * Zwei Anlässe, derselbe Griff: Das Telefon des Eigentümers ist leer oder der
 * Browser weg, und er kommt an seine eigene Sitzung nicht mehr heran; oder ein
 * vorgelesener Code ist beim Falschen gelandet. Die Karte bleibt in beiden
 * Fällen gültig — sie ist ein anderer Weg zum selben Zugang.
 */
export async function widerrufeSitzungen(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennung: Id
): Promise<number> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [partei] = await tx<{ id: string; display_name: string }[]>`
			SELECT id, display_name FROM snapshot_party
			WHERE meeting_id = ${meetingId} AND (id = ${kennung} OR party_id = ${kennung})
			LIMIT 1
		`;
		if (!partei) {
			throw new FachlicherFehler('unbekannte_partei', 'Partei nicht gefunden.', 'partei');
		}

		const widerrufen = await tx<{ id: string }[]>`
			UPDATE access_session s
			SET revoked_at = now(), revoked_reason = 'freigegeben'
			FROM meeting_access a
			WHERE a.id = s.meeting_access_id
			  AND a.snapshot_party_id = ${partei.id}
			  AND s.revoked_at IS NULL
			RETURNING s.id
		`;

		// Auch einen noch offenen Ausgabecode zurücknehmen: Er wäre sonst der
		// nächste Weg für denselben Falschen.
		await tx`
			UPDATE meeting_access SET handout_hash = NULL, handout_expires_at = NULL
			WHERE snapshot_party_id = ${partei.id}
		`;

		if (widerrufen.length > 0) {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.zugangssitzungWiderrufen,
					{ art: 'meeting', id: meetingId },
					{ partei: partei.display_name, anzahl: widerrufen.length }
				)
			);
		}

		return widerrufen.length;
	});
}

export interface Angemeldetes {
	/** Grobe Bezeichnung, nie die Browserkennung. */
	bezeichnung: string;
	/** Über die Karte oder über einen ausgegebenen Code hereingekommen. */
	herkunft: 'karte' | 'ausgabe';
	seit: string;
}

/**
 * Welches Gerät je Partei angemeldet ist — höchstens eines.
 *
 * Die Bezeichnung steht in der Anwesenheitssicht der Sitzungsleitung, damit
 * sich «ich komme nicht herein» im Saal klären lässt: Ein angemeldetes iPhone
 * passt zu «mein Akku war leer», ein leeres Feld nicht.
 */
export async function holeGeraete(
	operatorId: Id,
	meetingId: Id
): Promise<Map<Id, Angemeldetes>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				party_id: string;
				device_label: string | null;
				origin: 'karte' | 'ausgabe';
				created_at: Date;
			}[]
		>`
			SELECT p.party_id, s.device_label, s.origin, s.created_at
			FROM access_session s
			JOIN meeting_access a ON a.id = s.meeting_access_id
			JOIN snapshot_party p ON p.id = a.snapshot_party_id
			WHERE a.meeting_id = ${meetingId}
			  AND s.revoked_at IS NULL AND s.expires_at > now()
		`;
		return new Map(
			zeilen.map((z) => [
				z.party_id,
				{
					bezeichnung: z.device_label || 'Unbekanntes Gerät',
					herkunft: z.origin,
					seit: z.created_at.toISOString()
				}
			])
		);
	});
}

/**
 * Nach dem Einlösen gleich in die Warteschlange.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Wenn der QR genutzt wird, lande ich auf
 * der Anmeldeseite. Sollte der dann nicht in die Warteschlange kommen?»
 *
 * Er sollte. Wer seinen Code einlöst, während die Versammlung läuft, sagt damit
 * «ich bin da» — den Knopf «Jetzt anmelden» danach noch zu verlangen, ist ein
 * Tipp im Gedränge für eine Aussage, die schon gemacht wurde. Die Person sieht
 * stattdessen sofort «Angemeldet — die Sitzungsleitung bestätigt gleich», und
 * die Sitzungsleitung sieht sie im Einlasskasten.
 *
 * **Die Sicherung bleibt unangetastet.** Eine Anmeldung ist keine Anwesenheit:
 * Erst die Freigabe durch die Sitzungsleitung zählt (AD-6). Wer einen fremden
 * Zettel in der Hand hält, steht damit in einer Liste — und nicht im
 * Stimmberechtigtenstand.
 *
 * **Nur bei laufender Versammlung.** Vorher wäre die Anmeldung ohne Gegenstand;
 * `meldeTeilnahmeAn` wiese sie ab, und eine Absage nach einem gelungenen Scan
 * ist eine Meldung über etwas, das gar nicht misslungen ist. Deshalb wird der
 * Zustand vorher gefragt und der Fall stillschweigend übergangen.
 *
 * Der Rückgabewert sagt, ob jemand jetzt wartet — die Route braucht ihn nicht,
 * die Tests schon.
 */
export async function meldeNachEinloesungAn(merkmal: string): Promise<boolean> {
	const befund = await loeseSitzungAuf(merkmal);
	if (!befund.gueltig || !befund.operatorId || !befund.meetingId || !befund.parteiId) return false;
	if (befund.versammlungszustand !== 'laufend') return false;

	const e = await meldeTeilnahmeAn(
		befund.operatorId,
		befund.meetingId,
		befund.parteiId,
		// Der Weg kommt aus der Sitzung, nicht aus dem Formular: Was das Gerät
		// mitschickt, könnte jeder setzen.
		befund.herkunft === 'authentik' ? 'authentik' : 'selbst'
	);
	/*
	 * **Und der Strom erfährt davon** (11.09.2026, vom Auftraggeber im Eingangstest
	 * gefunden und danach nachgemessen).
	 *
	 * Es gibt drei Türen in die Warteschlange: den Knopf «Jetzt anmelden», das
	 * Abtippen des Kartencodes und das Abscannen des QR. Nur die erste verkündete
	 * den Stand; sie tat es in ihrer Route. Die beiden Kartenwege laufen über
	 * diesen Helfer und schwiegen — wer seine Karte einlöste, stand serverseitig
	 * in der Schlange, und am Eingang blieb der Kasten «Am Eingang» leer, bis
	 * jemand von Hand neu lud.
	 *
	 * Gemessen an zwei Sitzungen nebeneinander: Beim Einlassen zog die Liste
	 * innert fünf Sekunden nach, beim Einlösen zwanzig Sekunden lang nicht.
	 *
	 * **Die Verkündung steht hier und nicht in den zwei Routen.** Sie in jeden
	 * Aufrufer zu schreiben ist genau die Bauweise, aus der dieser Fehler kam:
	 * Der dritte Aufrufer vergisst sie wieder. Der Strom trägt dabei nur Zahlen
	 * (AD-11): dass die Zahl der Wartenden gestiegen ist, nicht wer gekommen ist.
	 */
	await verkuendeStand(befund.operatorId, befund.meetingId);
	return e.zustand === 'wartet';
}
