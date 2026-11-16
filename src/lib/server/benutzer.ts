/**
 * Konten und Kennwörter (Nachtrag zum Anmeldeschutz, 13.08.2026).
 *
 * **Der Anlass.** Kennwörter liessen sich nur über
 * `scripts/benutzer-anlegen.mjs` setzen — `kennwortAbleiten()` wurde in der
 * ganzen Anwendung an keiner Stelle aufgerufen. Ein Wechsel verlangte damit
 * einen Zugang zur Kommandozeile des Servers, und in der Praxis heisst das: Es
 * wird nicht gewechselt. Ein Konto ausser Dienst zu stellen ging ebenso wenig.
 *
 * **Zwei Wege, zwei Rechte.** Das eigene Kennwort ändert jeder selbst, mit dem
 * alten als Nachweis. Fremde Konten führt die Verwaltung: anlegen, Kennwort
 * neu setzen, Rolle ändern, ausser Dienst stellen. Die Trennung ist dieselbe
 * wie überall (`domain/rollen.ts`) — nur dass hier auch die Verwaltung an
 * Grenzen stösst, die sie nicht überschreiten darf.
 *
 * **Drei Grenzen, die niemand überschreitet:**
 *
 *   1. **Das letzte Verwaltungskonto bleibt.** Wer es ausser Dienst stellt,
 *      sperrt die Bewirtschaftung aus ihrer eigenen Anwendung aus — und
 *      hereinkommt sie danach nur noch über die Kommandozeile, also genau über
 *      den Weg, den diese Datei ersetzen soll.
 *   2. **Niemand stellt sich selbst ausser Dienst.** Das ist kein Sonderfall
 *      von 1, sondern ein eigener: Es ist fast immer ein Versehen.
 *   3. **Ein Kennwortwechsel entwertet die übrigen Sitzungen.** Wer sein
 *      Kennwort wechselt, tut das im Zweifel, weil es jemand kennt — und dann
 *      hilft ein neues Kennwort nichts, solange die alte Sitzung weiterläuft.
 *      Die eigene bleibt: Sich beim Wechsel selbst abzumelden wäre eine Strafe
 *      für richtiges Verhalten.
 */
import argon2 from 'argon2';
import postgres from 'postgres';
import { alsBetreiber, ohneBindung, sql } from './db';
import { kennwortAbleiten, type AngemeldeterBenutzer } from './auth';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { pruefeKennwort, verlangeGleich } from '$lib/domain/kennwort';
import {
	darfVerknuepfungLoesen,
	fensterEnde,
	istAdresse,
	normalisiereEmail
} from '$lib/domain/kontoverknuepfung';
import { ROLLEN, type Rolle } from '$lib/domain/rollen';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';

export interface Konto {
	id: string;
	username: string;
	displayName: string;
	role: Rolle;
	/** Ausser Dienst seit — null heisst: in Betrieb. */
	ausserDienstSeit: string | null;
	/** Ob ein Kennwort hinterlegt ist. Nein heisst: nur über Authentik. */
	hatKennwort: boolean;
	/** Ob das Konto mit einer Authentik-Kennung verknüpft ist. */
	ueberAuthentik: boolean;
	/** Die dienstliche Adresse. Anker der Erstverknüpfung, danach nur Angabe. */
	email: string | null;
	/** Bis wann die Erstverknüpfung offensteht. `null` heisst zu. */
	verknuepfungOffenBis: string | null;
	angelegtAm: string;
	/** Zahl der gerade gültigen Sitzungen. */
	sitzungen: number;
}

export async function holeKonten(operatorId: Id): Promise<Konto[]> {
	return alsBetreiber(operatorId, async (tx) => {
	const zeilen = await tx<
		{
			id: string;
			username: string;
			display_name: string;
			role: Rolle;
			disabled_at: Date | null;
			hat_kennwort: boolean;
			ueber_authentik: boolean;
			email: string | null;
			oidc_link_until: Date | null;
			created_at: Date;
			sitzungen: string;
		}[]
	>`
		SELECT u.id, u.username, u.display_name, u.role, u.disabled_at,
		       (u.password_hash IS NOT NULL) AS hat_kennwort,
		       (u.oidc_subject IS NOT NULL) AS ueber_authentik,
		       u.email, u.oidc_link_until,
		       u.created_at,
		       (SELECT count(*) FROM user_session s
		         WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())
		         AS sitzungen
		FROM app_user u
		WHERE u.operator_id = ${operatorId}
		ORDER BY u.disabled_at NULLS FIRST, u.display_name
	`;
	return zeilen.map((z) => ({
		id: z.id,
		username: z.username,
		displayName: z.display_name,
		role: z.role,
		ausserDienstSeit: z.disabled_at?.toISOString() ?? null,
		hatKennwort: z.hat_kennwort,
		ueberAuthentik: z.ueber_authentik,
		email: z.email,
		verknuepfungOffenBis: z.oidc_link_until?.toISOString() ?? null,
		angelegtAm: z.created_at.toISOString(),
		sitzungen: Number(z.sitzungen)
	}));
	});
}

// ── Das eigene Kennwort ─────────────────────────────────────────────────────

/**
 * Ändert das eigene Kennwort — mit dem alten als Nachweis.
 *
 * **Das alte Kennwort ist Pflicht**, auch wenn die Sitzung schon beweist, dass
 * jemand angemeldet ist. Ein unbeaufsichtigtes Gerät im Sitzungszimmer ist der
 * Normalfall, und ohne diese Frage genügte eine Minute daran, um das Konto zu
 * übernehmen.
 */
export async function aendereEigenesKennwort(
	benutzer: AngemeldeterBenutzer,
	altesKennwort: string,
	neuesKennwort: string,
	wiederholung: string,
	/** Die eigene Sitzung — sie überlebt, die übrigen nicht. */
	eigenesMerkmalPruefwert: string | null
): Promise<{ entwertet: number }> {
	verlangeGleich(neuesKennwort, wiederholung);
	pruefeKennwort(neuesKennwort, {
		benutzername: benutzer.username,
		anzeigename: benutzer.displayName
	});

	const [zeile] = await alsBetreiber(
		benutzer.operatorId,
		(tx) => tx<{ password_hash: string | null }[]>`
			SELECT password_hash FROM app_user WHERE id = ${benutzer.id}
		`
	);
	if (!zeile?.password_hash) {
		throw new FachlicherFehler(
			'ohne_kennwort',
			'Für dieses Konto ist kein Kennwort hinterlegt — es meldet sich über die zentrale ' +
				'Anmeldung an. Ein Kennwort setzt die Verwaltung.',
			'alt'
		);
	}

	const stimmt = await argon2.verify(zeile.password_hash, altesKennwort).catch(() => false);
	if (!stimmt) {
		throw new FachlicherFehler('altes_falsch', 'Das bisherige Kennwort stimmt nicht.', 'alt');
	}
	if (altesKennwort === neuesKennwort) {
		throw new FachlicherFehler(
			'unveraendert',
			'Das neue Kennwort ist dasselbe wie das bisherige.',
			'neu'
		);
	}

	const ableitung = await kennwortAbleiten(neuesKennwort);

	return ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${benutzer.operatorId}, true)`;
		await tx`UPDATE app_user SET password_hash = ${ableitung} WHERE id = ${benutzer.id}`;

		// Die übrigen Sitzungen enden. Wer wechselt, tut das im Zweifel, weil
		// jemand das alte Kennwort kennt — dann hilft ein neues nichts, solange
		// die alte Sitzung weiterläuft.
		const entwertet = await tx`
			UPDATE user_session SET revoked_at = now()
			WHERE user_id = ${benutzer.id} AND revoked_at IS NULL
			  ${eigenesMerkmalPruefwert ? tx`AND token_hash <> ${eigenesMerkmalPruefwert}` : tx``}
		`;

		await schreibeVerlauf(
			tx,
			{ operatorId: benutzer.operatorId, userId: benutzer.id, label: benutzer.displayName },
			ereignis(
				EREIGNISARTEN.kennwortGeaendert,
				{ art: 'app_user', id: benutzer.id },
				{ konto: benutzer.username, entwertete_sitzungen: entwertet.count }
			)
		);
		return { entwertet: entwertet.count };
	});
}

// ── Fremde Konten: der Verwaltung vorbehalten ───────────────────────────────

/**
 * Ein Satz für beide Fälle, den eigenen Betreiber und einen fremden.
 *
 * **Er verrät, dass es den Namen irgendwo gibt, und das ist hingenommen.**
 * Anlegen kann nur, wer als Verwaltung angemeldet ist, und der Name allein
 * öffnet nichts: Die Anmeldung verlangt das Kennwort und sperrt nach
 * Fehlversuchen. Ohne den Hinweis auf andere Betreiber stünde die Verwaltung
 * vor einer Absage, die ihre eigene Kontenliste nicht erklärt.
 */
function nameVergeben(username: string): FachlicherFehler {
	return new FachlicherFehler(
		'schon_vergeben',
		`Den Benutzernamen «${username}» gibt es bereits. Ein Benutzername gehört genau einem ` +
			'Konto, auch über die anderen Betreiber dieser Installation hinweg; es braucht einen anderen.',
		'username'
	);
}

export async function legeKontoAn(
	handelnder: Handelnder & { operatorId: string },
	angaben: {
		username: string;
		displayName: string;
		/** Freiwillig — ohne sie kommt das Konto nur lokal herein, siehe unten. */
		email?: string;
		rolle: Rolle;
		kennwort: string;
		wiederholung: string;
	}
): Promise<Konto> {
	const username = angaben.username.trim().toLowerCase();
	const displayName = angaben.displayName.trim();
	/*
	 * **Die Adresse ist freiwillig, und das ist kein Versehen.**
	 *
	 * Ohne sie gibt es das Konto trotzdem, es kommt nur nicht über Authentik
	 * herein. Diesen Fall braucht es: das allererste Konto einer Installation,
	 * und das Notfallkonto, das gerade dann tragen soll, wenn der zentrale
	 * Dienst nicht antwortet (AD-9). Ein Pflichtfeld hier zwänge dazu, für
	 * solche Konten eine Adresse zu erfinden — und eine erfundene Adresse ist
	 * ein Anker, der irgendwann jemandem gehört.
	 */
	const email = angaben.email?.trim() ? normalisiereEmail(angaben.email) : null;

	if (zeichenzahl(username) < 3) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Der Benutzername braucht mindestens drei Zeichen.',
			'username'
		);
	}
	if (!/^[a-z0-9._-]+$/.test(username)) {
		throw new FachlicherFehler(
			'name_ungueltig',
			'Der Benutzername darf nur Kleinbuchstaben, Ziffern, Punkt, Bindestrich und Unterstrich ' +
				'enthalten. Er wird getippt, oft am Telefon.',
			'username'
		);
	}
	if (zeichenzahl(displayName) < 2) {
		throw new FachlicherFehler(
			'anzeigename_fehlt',
			'Der Name, der in Protokoll und Verlauf erscheint, fehlt.',
			'displayName'
		);
	}
	if (email && !istAdresse(email)) {
		throw new FachlicherFehler(
			'adresse_ungueltig',
			'Das sieht nicht nach einer E-Mail-Adresse aus. Sie ist der Anker, über den sich das ' +
				'Konto beim ersten Mal mit Authentik verbindet — steht dort etwas anderes, findet ' +
				'die Anmeldung nichts und niemand sieht, warum.',
			'email'
		);
	}
	if (!ROLLEN.includes(angaben.rolle)) {
		throw new FachlicherFehler('rolle_unbekannt', 'Unbekannte Rolle.', 'rolle');
	}
	verlangeGleich(angaben.kennwort, angaben.wiederholung);
	pruefeKennwort(angaben.kennwort, { benutzername: username, anzeigename: displayName });

	const ableitung = await kennwortAbleiten(angaben.kennwort);

	/*
	 * **Der Name gilt über alle Betreiber** (Migration 155). Die Vorabfrage
	 * oben sieht unter dem Zeilenschutz nur den eigenen Betreiber; ein Konto
	 * gleichen Namens bei einem fremden fällt erst am Index auf, und der
	 * bricht die Transaktion ab. Deshalb wird die Verletzung hier draussen
	 * zum selben Satz. Beide Indizes, weil zwei gleichzeitige Anlagen beim
	 * selben Betreiber zuerst an der älteren Eindeutigkeit aus Migration 001
	 * scheitern.
	 */
	const id = await ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		const [schon] = await tx<{ id: string }[]>`
			SELECT id FROM app_user
			WHERE operator_id = ${handelnder.operatorId} AND username = ${username}
		`;
		if (schon) throw nameVergeben(username);
		if (email) await verlangeFreieAdresse(tx, handelnder.operatorId, email, null);
		const fenster = email ? fensterEnde(new Date()) : null;

		/*
		 * **Das Fenster geht mit dem Anlegen auf.** Wer ein Konto anlegt, tut
		 * das, weil jemand hereinkommen soll — es danach in einem zweiten
		 * Schritt freizugeben wäre ein Handgriff, den jeder immer macht und den
		 * darum niemand als Entscheidung erlebt. Ohne Adresse bleibt es zu, denn
		 * dann gibt es nichts, wofür es offenstehen könnte.
		 */
		const [neu] = await tx<{ id: string }[]>`
			INSERT INTO app_user (operator_id, username, password_hash, display_name, role,
			                      email, oidc_link_until)
			VALUES (${handelnder.operatorId}, ${username}, ${ableitung}, ${displayName}, ${angaben.rolle},
			        ${email}, ${fenster})
			RETURNING id
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kontoAngelegt,
				{ art: 'app_user', id: neu.id },
				{ konto: username, name: displayName, rolle: angaben.rolle }
			)
		);
		/*
		 * **Das Fenster bekommt einen eigenen Eintrag, auch hier** (Code-Review
		 * 15.09.2026). Es geht beim Anlegen von selbst auf, und genau deshalb wäre
		 * es sonst die einzige Öffnung ohne Spur. Wer später fragt «wer hätte in
		 * dieses Konto hereinkommen können», braucht die Adresse, für die es
		 * offenstand — am Konto steht nur die heutige.
		 */
		if (email) {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.kontoVerknuepfungGeoeffnet,
					{ art: 'app_user', id: neu.id },
					{ konto: username, adresse: email, offen_bis: fenster?.toISOString() ?? null }
				)
			);
		}
		return neu.id;
	}).catch((fehler: unknown) => {
		if (
			fehler instanceof postgres.PostgresError &&
			fehler.code === '23505' &&
			(fehler.constraint_name === 'app_user_benutzername_eindeutig' ||
				fehler.constraint_name === 'app_user_operator_id_username_key')
		) {
			throw nameVergeben(username);
		}
		throw fehler;
	});

	return (await holeKonten(handelnder.operatorId)).find((k) => k.id === id)!;
}

/**
 * Setzt für ein fremdes Konto ein neues Kennwort.
 *
 * **Alle Sitzungen dieses Kontos enden**, ohne Ausnahme: Anders als beim
 * eigenen Wechsel ist hier gerade der Fall gemeint, dass jemand anders damit
 * angemeldet ist.
 */
export async function setzeKennwort(
	handelnder: Handelnder & { operatorId: string },
	kontoId: Id,
	kennwort: string,
	wiederholung: string
): Promise<{ entwertet: number }> {
	verlangeGleich(kennwort, wiederholung);

	const [konto] = await alsBetreiber(
		handelnder.operatorId,
		(tx) => tx<{ username: string; display_name: string }[]>`
			SELECT username, display_name FROM app_user
			WHERE id = ${kontoId} AND operator_id = ${handelnder.operatorId}
		`
	);
	if (!konto) throw new FachlicherFehler('unbekannt', 'Dieses Konto gibt es nicht.', 'konto');

	pruefeKennwort(kennwort, {
		benutzername: konto.username,
		anzeigename: konto.display_name
	});
	const ableitung = await kennwortAbleiten(kennwort);

	return ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		await tx`UPDATE app_user SET password_hash = ${ableitung} WHERE id = ${kontoId}`;
		const entwertet = await tx`
			UPDATE user_session SET revoked_at = now()
			WHERE user_id = ${kontoId} AND revoked_at IS NULL
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kennwortGesetzt,
				{ art: 'app_user', id: kontoId },
				{ konto: konto.username, entwertete_sitzungen: entwertet.count }
			)
		);
		return { entwertet: entwertet.count };
	});
}

export async function aendereRolle(
	handelnder: Handelnder & { operatorId: string },
	kontoId: Id,
	rolle: Rolle
): Promise<void> {
	if (!ROLLEN.includes(rolle)) {
		throw new FachlicherFehler('rolle_unbekannt', 'Unbekannte Rolle.', 'rolle');
	}
	await ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		const [konto] = await tx<{ username: string; role: Rolle }[]>`
			SELECT username, role FROM app_user
			WHERE id = ${kontoId} AND operator_id = ${handelnder.operatorId}
		`;
		if (!konto) throw new FachlicherFehler('unbekannt', 'Dieses Konto gibt es nicht.', 'konto');
		if (konto.role === rolle) return;

		// Dieselbe Grenze wie beim Ausserdienststellen: Ohne Verwaltung kommt
		// niemand mehr an die Stammdaten — und an diese Seite auch nicht.
		if (konto.role === 'admin') await verlangeWeitereVerwaltung(tx, handelnder.operatorId, kontoId);

		await tx`UPDATE app_user SET role = ${rolle} WHERE id = ${kontoId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kontoRolleGeaendert,
				{ art: 'app_user', id: kontoId },
				{ konto: konto.username, vorher: konto.role, nachher: rolle }
			)
		);
	});
}

/**
 * Stellt ein Konto ausser Dienst oder wieder in Dienst.
 *
 * **Nicht gelöscht** (AD-5): Der Name steht in Verläufen, Protokollen und
 * Siegeln. Ein gelöschtes Konto machte aus «freigegeben durch Anna Meier» eine
 * Zeile ohne Person.
 */
export async function setzeAusserDienst(
	handelnder: Handelnder & { operatorId: string; userId: string | null },
	kontoId: Id,
	ausserDienst: boolean
): Promise<{ entwertet: number }> {
	if (ausserDienst && handelnder.userId === kontoId) {
		throw new FachlicherFehler(
			'nicht_sich_selbst',
			'Sie können Ihr eigenes Konto nicht ausser Dienst stellen. Lassen Sie es von einem ' +
				'anderen Verwaltungskonto tun.',
			'konto'
		);
	}

	return ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		const [konto] = await tx<{ username: string; role: Rolle; disabled_at: Date | null }[]>`
			SELECT username, role, disabled_at FROM app_user
			WHERE id = ${kontoId} AND operator_id = ${handelnder.operatorId}
		`;
		if (!konto) throw new FachlicherFehler('unbekannt', 'Dieses Konto gibt es nicht.', 'konto');

		if (ausserDienst && konto.role === 'admin') {
			await verlangeWeitereVerwaltung(tx, handelnder.operatorId, kontoId);
		}

		await tx`
			UPDATE app_user SET disabled_at = ${ausserDienst ? sql`now()` : null}
			WHERE id = ${kontoId}
		`;

		// Wer ausser Dienst steht, ist nicht mehr angemeldet. Sonst liefe die
		// laufende Sitzung bis zu zwölf Stunden weiter.
		const entwertet = ausserDienst
			? await tx`
					UPDATE user_session SET revoked_at = now()
					WHERE user_id = ${kontoId} AND revoked_at IS NULL
				`
			: { count: 0 };

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				ausserDienst ? EREIGNISARTEN.kontoAusserDienst : EREIGNISARTEN.kontoInDienst,
				{ art: 'app_user', id: kontoId },
				{ konto: konto.username, entwertete_sitzungen: entwertet.count }
			)
		);
		return { entwertet: entwertet.count };
	});
}

/**
 * Verlangt, dass ausser diesem noch ein Verwaltungskonto in Dienst steht.
 *
 * Ohne diese Prüfung liesse sich die Bewirtschaftung aus ihrer eigenen
 * Anwendung aussperren — hereinkommt sie danach nur noch über die
 * Kommandozeile, also genau über den Weg, den diese Datei ersetzen soll.
 */
async function verlangeWeitereVerwaltung(
	tx: postgres.TransactionSql,
	operatorId: string,
	ausserDiesem: Id
): Promise<void> {
	const [{ anzahl }] = await tx<{ anzahl: string }[]>`
		SELECT count(*) AS anzahl FROM app_user
		WHERE operator_id = ${operatorId} AND role = 'admin'
		  AND disabled_at IS NULL AND id <> ${ausserDiesem}
	`;
	if (Number(anzahl) === 0) {
		throw new FachlicherFehler(
			'letzte_verwaltung',
			'Das ist das letzte Konto mit Verwaltungsrechten. Legen Sie zuerst ein weiteres an — ' +
				'sonst kommt niemand mehr an die Stammdaten.',
			'konto'
		);
	}
}

// ── Adresse, Name und das Fenster zur Erstverknüpfung ───────────────────────
//
// Das Fenster statt eines Einmalgeheimnisses: Produktentscheid 15.09.2026. Bis zum
// 15.11.2026 stand die Herkunft in `docs/dienste.md`, das als öffentliches Handbuch
// erscheint und keine Entscheider nennen soll (Codeprüfung zur Lücke im Handbuch, N4;
// die übrigen Nennungen dort sind Pendenz).

/**
 * Verlangt, dass diese Adresse noch keinem anderen Konto gehört.
 *
 * **Warum von Hand, obwohl ein Index darüber wacht.** Der Index schlägt zu,
 * aber er antwortet nicht mit einem Satz, sondern mit einer rohen 500 — genau
 * das, was `docs/gestaltung.md` verbietet: «Eine Schranke der Datenbank ist
 * keine Fehlermeldung.» Der Index bleibt trotzdem die massgebende Schranke; er
 * fängt, was zwischen dieser Prüfung und dem Schreiben passiert.
 */
async function verlangeFreieAdresse(
	tx: postgres.TransactionSql,
	operatorId: string,
	email: string,
	ausserKontoId: Id | null
): Promise<void> {
	const [belegt] = await tx<{ username: string }[]>`
		SELECT username FROM app_user
		WHERE operator_id = ${operatorId}
		  AND lower(email) = ${email}
		  AND (${ausserKontoId}::uuid IS NULL OR id <> ${ausserKontoId})
	`;
	if (belegt) {
		throw new FachlicherFehler(
			'adresse_vergeben',
			`Diese Adresse gehört bereits dem Konto «${belegt.username}». Zwei Konten mit derselben ` +
				'Adresse wären beim Anmelden nicht auseinanderzuhalten.',
			'email'
		);
	}
}

/**
 * Ändert Anzeigename und Adresse eines Kontos.
 *
 * **Warum es das braucht** (Vorgabe des Auftraggebers, 15.09.2026, aus der Frage «Was ist,
 * wenn jemand heiratet?»). Bis hierher liess sich der Name eines Kontos
 * überhaupt nicht ändern: Im ganzen Servercode gab es nur `UPDATE` auf
 * Kennwort, Rolle und Dienststand. Wer den Namen wechselte, stand in jedem
 * künftigen Verlaufseintrag weiter unter dem alten.
 *
 * **Alte Einträge bleiben, wie sie sind.** `audit_entry.actor_label` und
 * `minutes.created_by_label` halten den Namen als Text fest, wie er zur Zeit
 * der Handlung galt. Das ist bei Protokollen keine Nachlässigkeit, sondern der
 * Zweck: Wer im März gehandelt hat, hiess im März so, wie er damals hiess.
 *
 * **Eine geänderte Adresse schliesst das Fenster** (Sicherheitsprüfung
 * 15.09.2026). Die erste Fassung liess es ausdrücklich stehen, mit der
 * Begründung, eine Korrektur solle keine Freigabe sein. Das war verkehrt herum
 * gedacht: Das Fenster steht nicht für ein Konto offen, sondern **für eine
 * Adresse**. Bleibt es beim Wechsel stehen, gilt es ab sofort für die neue — und
 * genau das ist eine Freigabe, die niemand ausgesprochen hat. Wer sie will,
 * öffnet danach mit einem Knopfdruck, und dann steht es auch im Verlauf.
 *
 * Eine neue Adresse **öffnet** das Fenster weiterhin nicht.
 */
export async function setzeAngaben(
	handelnder: Handelnder & { operatorId: string },
	kontoId: Id,
	displayName: string,
	emailRoh: string
): Promise<void> {
	const name = displayName.trim();
	const email = emailRoh.trim() ? normalisiereEmail(emailRoh) : null;

	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler(
			'anzeigename_fehlt',
			'Der Name, der in Protokoll und Verlauf erscheint, fehlt.',
			'displayName'
		);
	}
	if (email && !istAdresse(email)) {
		throw new FachlicherFehler(
			'adresse_ungueltig',
			'Das sieht nicht nach einer E-Mail-Adresse aus.',
			'email'
		);
	}

	await ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		const [konto] = await tx<
			{
				username: string;
				display_name: string;
				email: string | null;
				oidc_link_until: Date | null;
			}[]
		>`
			SELECT username, display_name, email, oidc_link_until FROM app_user
			WHERE id = ${kontoId} AND operator_id = ${handelnder.operatorId}
		`;
		if (!konto) throw new FachlicherFehler('unbekannt', 'Dieses Konto gibt es nicht.', 'konto');
		if (konto.display_name === name && konto.email === email) return;

		if (email) await verlangeFreieAdresse(tx, handelnder.operatorId, email, kontoId);

		const adresseGewechselt = konto.email !== email;
		// Der gelesene Wert statt eines SQL-Fragments: Beides tut dasselbe, aber
		// ein `sql`-Fragment mitten in einer `tx`-Abfrage mischt zwei Verbindungen
		// und liest sich wie ein Versehen. Der Stand stammt aus derselben
		// Transaktion, ist also so frisch wie das Fragment gewesen wäre.
		const fensterDanach = adresseGewechselt ? null : konto.oidc_link_until;
		await tx`
			UPDATE app_user
			SET display_name = ${name},
			    email = ${email},
			    oidc_link_until = ${fensterDanach}
			WHERE id = ${kontoId}
		`;
		if (adresseGewechselt && konto.oidc_link_until) {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.kontoVerknuepfungGeschlossen,
					{ art: 'app_user', id: kontoId },
					{ konto: konto.username, grund: 'adresse_gewechselt' }
				)
			);
		}
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kontoAngabenGeaendert,
				{ art: 'app_user', id: kontoId },
				{
					konto: konto.username,
					name_vorher: konto.display_name,
					name_nachher: name,
					// Die Adressen selbst stehen bewusst nicht im Verlauf: Dass sie
					// gewechselt hat, ist die nachvollziehbare Tatsache; welche es
					// war, steht am Konto und muss nicht zusätzlich dauerhaft liegen.
					adresse_gewechselt: adresseGewechselt
				}
			)
		);
	});
}

/**
 * Öffnet oder schliesst das Fenster für die Erstverknüpfung.
 *
 * **Offen heisst: Wer sich mit dieser Adresse bei Authentik anmeldet, bekommt
 * dieses Konto.** Das ist die ganze Tragweite, und deshalb ist es eine eigene
 * Handlung mit eigenem Verlaufseintrag statt einer Nebenwirkung des Speicherns.
 *
 * **Zwei Dinge gehen nicht**, und beide aus demselben Grund: Ein Fenster, das
 * nichts bewirken kann, ist eine Zusage, die nicht eingehalten wird.
 *
 *   - Ohne Adresse gibt es keinen Anker, über den jemand hereinkäme.
 *   - Ein bereits verknüpftes Konto findet sich über seine Kennung; dort würde
 *     der Weg über die Adresse gar nicht mehr betreten.
 *
 * Ein Konto ausser Dienst darf sein Fenster dagegen behalten. Das Fenster ist
 * eine Vorbereitung, kein Zutritt, und die Anmeldung weist ausser Dienst
 * stehende Konten ohnehin ab — sichtbar an `darfErstverknuepfen`, das den
 * Dienststand vor allem anderen prüft.
 */
export async function setzeVerknuepfungsfenster(
	handelnder: Handelnder & { operatorId: string },
	kontoId: Id,
	offen: boolean
): Promise<{ offenBis: string | null }> {
	return ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		const [konto] = await tx<
			{ username: string; email: string | null; hat_kennung: boolean }[]
		>`
			SELECT username, email, (oidc_subject IS NOT NULL) AS hat_kennung FROM app_user
			WHERE id = ${kontoId} AND operator_id = ${handelnder.operatorId}
		`;
		if (!konto) throw new FachlicherFehler('unbekannt', 'Dieses Konto gibt es nicht.', 'konto');

		if (offen && !konto.email) {
			throw new FachlicherFehler(
				'ohne_adresse',
				'Für dieses Konto ist keine E-Mail-Adresse hinterlegt. Ohne sie gibt es nichts, ' +
					'woran die erste Anmeldung das Konto erkennen könnte.',
				'email'
			);
		}
		if (offen && konto.hat_kennung) {
			throw new FachlicherFehler(
				'schon_verknuepft',
				'Dieses Konto ist bereits mit Authentik verknüpft und findet seinen Weg über die ' +
					'Kennung. Ein Fenster würde daran nichts ändern.',
				'konto'
			);
		}

		const bis = offen ? fensterEnde(new Date()) : null;
		await tx`UPDATE app_user SET oidc_link_until = ${bis} WHERE id = ${kontoId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				offen ? EREIGNISARTEN.kontoVerknuepfungGeoeffnet : EREIGNISARTEN.kontoVerknuepfungGeschlossen,
				{ art: 'app_user', id: kontoId },
				{ konto: konto.username, adresse: konto.email, offen_bis: bis?.toISOString() ?? null }
			)
		);
		return { offenBis: bis?.toISOString() ?? null };
	});
}

// ── Die Verknüpfung wieder lösen ────────────────────────────────────────────

/**
 * Das eigene Konto, so schmal wie die Seite «Mein Konto» es braucht.
 *
 * **Warum nicht `holeKonten`.** Die Kontenliste ist der Verwaltung vorbehalten
 * und nennt jedes Konto des Betreibers samt Rolle und angemeldeten Geräten.
 * «Mein Konto» steht dagegen jeder Rolle offen. Wer dort die ganze Liste lädt
 * und eine Zeile davon anzeigt, hat die Auskunft trotzdem über die Leitung
 * geschickt — das ist dieselbe Klasse wie der Befund vom 13.08.2026, als die
 * Sitzungsleitung die Kontenliste lesen konnte.
 */
export async function holeEigenesKonto(
	operatorId: Id,
	benutzerId: Id
): Promise<{ hatKennwort: boolean; ueberAuthentik: boolean; email: string | null } | null> {
	const [z] = await alsBetreiber(
		operatorId,
		(tx) => tx<{ hat_kennwort: boolean; ueber_authentik: boolean; email: string | null }[]>`
			SELECT (password_hash IS NOT NULL) AS hat_kennwort,
			       (oidc_subject IS NOT NULL) AS ueber_authentik,
			       email
			FROM app_user WHERE id = ${benutzerId} AND operator_id = ${operatorId}
		`
	);
	if (!z) return null;
	return { hatKennwort: z.hat_kennwort, ueberAuthentik: z.ueber_authentik, email: z.email };
}

/**
 * Löst die Verknüpfung eines Kontos mit Authentik (Auftraggeber, 16.09.2026).
 *
 * **Zwei Aufrufer, ein Weg.** Die Verwaltung löst fremde Konten über die
 * Kontenliste, jeder sein eigenes über «Mein Konto». Die Regel ist dieselbe;
 * unterschiedlich ist nur, welche Sitzung überlebt.
 *
 * **Die Sitzungen enden**, und zwar aus demselben Grund wie beim Setzen eines
 * fremden Kennworts: Wer eine Verknüpfung löst, tut das im Zweifel, weil das
 * Authentik-Konto nicht mehr der richtigen Person gehört. Eine laufende Sitzung,
 * die über genau diese Identität zustande kam, liefe sonst bis zu zwölf Stunden
 * weiter.
 *
 * **Die eigene überlebt, wenn jemand sich selbst löst.** Dieselbe Abwägung wie
 * bei `aendereEigenesKennwort`: Sich beim Aufräumen selbst hinauszuwerfen wäre
 * eine Strafe für richtiges Verhalten.
 *
 * **Das Anmeldefenster geht dabei NICHT auf.** Sonst wäre das Lösen unbemerkt
 * zugleich eine Freigabe für die nächste Person, die diese Adresse trägt. Wer
 * neu verknüpfen will, öffnet es danach bewusst.
 */
export async function loeseVerknuepfung(
	handelnder: Handelnder & { operatorId: string },
	kontoId: Id,
	/** Die eigene Sitzung, die überleben soll — `null`, wenn ein fremdes Konto gelöst wird. */
	eigenesMerkmalPruefwert: string | null = null
): Promise<{ entwertet: number }> {
	return ohneBindung(async (tx) => {
		await tx`SELECT set_config('versammlung.operator_id', ${handelnder.operatorId}, true)`;
		const [konto] = await tx<
			{ username: string; hat_kennung: boolean; hat_kennwort: boolean; ausser_dienst: boolean }[]
		>`
			SELECT username,
			       (oidc_subject IS NOT NULL) AS hat_kennung,
			       (password_hash IS NOT NULL) AS hat_kennwort,
			       (disabled_at IS NOT NULL) AS ausser_dienst
			FROM app_user WHERE id = ${kontoId} AND operator_id = ${handelnder.operatorId}
		`;
		if (!konto) throw new FachlicherFehler('unbekannt', 'Dieses Konto gibt es nicht.', 'konto');

		const ausgang = darfVerknuepfungLoesen({
			hatKennung: konto.hat_kennung,
			hatKennwort: konto.hat_kennwort,
			ausserDienst: konto.ausser_dienst
		});
		if (!ausgang.erlaubt) {
			if (ausgang.hindernis === 'nicht_verknuepft') {
				throw new FachlicherFehler(
					'nicht_verknuepft',
					'Dieses Konto ist nicht mit Authentik verknüpft.',
					'konto'
				);
			}
			throw new FachlicherFehler(
				'ohne_kennwort',
				'Für dieses Konto ist kein Kennwort hinterlegt — es kommt ausschliesslich über ' +
					'Authentik herein. Ohne die Verknüpfung käme niemand mehr hinein. Setzen Sie zuerst ' +
					'ein Kennwort. Soll niemand mehr hereinkommen, stellen Sie das Konto ausser Dienst; ' +
					'die Verknüpfung lässt sich danach ebenfalls lösen.',
				'konto'
			);
		}

		/*
		 * **Die Bedingung steht auch hier**, nicht nur in der Prüfung darüber:
		 * Zwischen Lesen und Schreiben kann ein zweiter Aufruf die Kennung bereits
		 * gelöst haben, und dann wäre der Verlaufseintrag eine Handlung, die nichts
		 * bewirkt hat.
		 */
		/*
		 * **Die Spur, und wann sie NICHT gesetzt wird.**
		 *
		 * Wird an einem Konto **im Dienst** gelöst, wandert die Kennung in
		 * `oidc_subject_zuletzt` und ist damit für andere Konten gesperrt
		 * (Sicherheitsprüfung 16.09.2026): Sonst könnte sich jemand selbst
		 * entkoppeln und danach über den Adressweg an ein fremdes Konto binden.
		 *
		 * An einem Konto **ausser Dienst** unterbleibt sie, und das ist kein
		 * Widerspruch, sondern die Auflösung eines Zielkonflikts. Beide Befunde
		 * vom 16.09.2026 verlangen Gegenläufiges: Das Code-Review will die Kennung
		 * freigeben, damit ein Mensch nach dem Weggang wieder ein Konto bekommen
		 * kann (der Index darüber ist global eindeutig); die Sicherheitsprüfung
		 * will sie festhalten, damit niemand sie auf ein fremdes Konto umhängt.
		 *
		 * Der Unterschied liegt darin, **wer** löst. Ausser Dienst stellen kann nur
		 * die Verwaltung, und niemand sich selbst (`setzeAusserDienst`). Ein Lösen
		 * an einem stillgelegten Konto ist deshalb immer eine bewusste Handlung an
		 * einem toten Konto — kein Selbstbefreiungsakt. Dort darf die Kennung
		 * weiterziehen.
		 */
		const geloest = await tx`
			UPDATE app_user
			SET oidc_subject_zuletzt = ${konto.ausser_dienst ? null : tx`oidc_subject`},
			    oidc_subject = NULL
			WHERE id = ${kontoId} AND oidc_subject IS NOT NULL
		`;
		if (geloest.count === 0) {
			throw new FachlicherFehler(
				'nicht_verknuepft',
				'Dieses Konto ist nicht mit Authentik verknüpft.',
				'konto'
			);
		}

		const entwertet = await tx`
			UPDATE user_session SET revoked_at = now()
			WHERE user_id = ${kontoId} AND revoked_at IS NULL
			  ${eigenesMerkmalPruefwert ? tx`AND token_hash <> ${eigenesMerkmalPruefwert}` : tx``}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.kontoVerknuepfungGeloest,
				{ art: 'app_user', id: kontoId },
				{
					konto: konto.username,
					durch: handelnder.userId === kontoId ? 'selbst' : 'verwaltung',
					entwertete_sitzungen: entwertet.count
				}
			)
		);
		return { entwertet: entwertet.count };
	});
}
