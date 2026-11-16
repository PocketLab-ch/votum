/**
 * Einstieg über den QR-Code auf dem Beamer (Story 4.4).
 *
 * Der Code auf der Leinwand ist für alle derselbe und deshalb **kein**
 * Zugangsmerkmal: Er führt zu einem Formular, nicht in die Versammlung. Wer ihn
 * benutzt, gibt seinen Namen an und wartet auf die Sitzungsleitung — dieser Weg
 * erzeugt nie eine Stimmberechtigung ohne ausdrückliche Freigabe.
 */
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { alsBetreiber, sql } from './db';
import { istKennung } from './kennungen';
import { schreibeVerlauf, type Handelnder } from './audit';
import { bestaetigeAnwesenheit } from './anwesenheit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id, Zeitpunkt } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { kalendertag } from '$lib/domain/datum';

/** Merkmal in einer Länge, die als QR-Code auf zehn Meter noch lesbar bleibt. */
function neuesMerkmal(): string {
	return randomBytes(18).toString('base64url');
}

/**
 * Stellt sicher, dass die Versammlung ein Saalmerkmal hat, und gibt es zurück.
 *
 * Je Versammlung ein eigenes: Ein alter Aushang führte sonst in die nächste
 * Versammlung, und wer den Zettel vom letzten Jahr abfotografiert hat, käme
 * dieses Jahr in die Warteliste.
 */
export async function holeOderErzeugeSaalmerkmal(
	operatorId: Id,
	meetingId: Id
): Promise<string> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ room_entry_token: string | null }[]>`
			SELECT room_entry_token FROM meeting WHERE id = ${meetingId}
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		if (z.room_entry_token) return z.room_entry_token;

		const merkmal = neuesMerkmal();
		await tx`UPDATE meeting SET room_entry_token = ${merkmal} WHERE id = ${meetingId}`;
		return merkmal;
	});
}

/**
 * Stellt sicher, dass der Abend ein Merkmal hat, und gibt es zurück.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Es ist wenig komfortabel, wenn man zwei QR
 * hat und einen davon abschiessen will. Darum ein QR, die öffnet dann eine
 * Hilfsseite, bei dem man dann die richtige STWEG auswählen kann.»
 *
 * Wie beim einzelnen Haus entsteht es erst, wenn der Monitor es zeigt: Ein nie
 * gezeigtes Merkmal wäre ein Geheimnis ohne Zweck.
 */
export async function holeOderErzeugeAbendmerkmal(operatorId: Id, tagId: Id): Promise<string> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ room_entry_token: string | null }[]>`
			SELECT room_entry_token FROM meeting_day WHERE id = ${tagId}
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'id');

		/*
		 * **Und jedes Haus bekommt seines** (Auftraggeber, 24.08.2026, mit Bildschirmfoto:
		 * «Wenn ich in der Gruppenveranstaltung ‹Meldeseite zeigen› und eine STWEG
		 * auswähle, erhalte ich diese Meldung» — «Diese Wahl war nicht gültig»).
		 *
		 * **Ein Leser ohne Schreiber.** Die Auswahlseite leitet über
		 * `abendeinstieg_haus` weiter, und die liest `meeting.room_entry_token`.
		 * Gefüllt wurde die Spalte bisher nur, wenn jemand die Anwesenheitsseite
		 * des einzelnen Hauses öffnete — also genau dort, wo an einem gemeinsamen
		 * Abend niemand hingeht. Die Auswahl bot damit Häuser an, die sie nicht
		 * erreichen konnte: ein Knopf, der in eine Absage führt.
		 *
		 * Hier ist die richtige Stelle: Der Abend-QR entsteht in diesem Aufruf,
		 * und ohne ihn gibt es keine Auswahl, die scheitern könnte. Kommt später
		 * ein Haus dazu, holt der nächste Aufruf es nach — die Seite ruft bei
		 * jedem Aufbau hier vorbei.
		 */
		const ohne = await tx<{ id: string }[]>`
			SELECT id FROM meeting WHERE meeting_day_id = ${tagId} AND room_entry_token IS NULL
		`;
		for (const m of ohne) {
			await tx`UPDATE meeting SET room_entry_token = ${neuesMerkmal()} WHERE id = ${m.id}`;
		}

		if (z.room_entry_token) return z.room_entry_token;

		const merkmal = neuesMerkmal();
		await tx`UPDATE meeting_day SET room_entry_token = ${merkmal} WHERE id = ${tagId}`;
		return merkmal;
	});
}

export interface Abendbefund {
	gueltig: boolean;
	bezeichnung?: string;
	datum?: string;
	uhrzeit?: string;
	ort?: string;
	/** Die Häuser des Abends — Namen, nie Merkmale. */
	haeuser?: { meetingId: Id; name: string; zustand: string }[];
	grund?: string;
}

/**
 * Löst das Abendmerkmal auf — ohne Mandantenkontext, wie der einzelne Einstieg.
 *
 * Gibt die **Namen** der Häuser heraus, nie ihre Merkmale: Wer die Auswahlseite
 * ansieht oder abfotografiert, soll damit nicht in fünf Versammlungen können.
 * Die Weiterleitung besorgt `saalmerkmalDesHauses`.
 */
export async function loeseAbendeinstiegAuf(merkmal: string): Promise<Abendbefund> {
	if (!merkmal || !/^[A-Za-z0-9_-]{16,64}$/.test(merkmal)) {
		return { gueltig: false, grund: UNBEKANNT };
	}

	const zeilen = await sql<
		{
			label: string;
			day_date: Date;
			start_time: string;
			location: string;
			meeting_id: string;
			meeting_state: string;
			stweg_name: string;
		}[]
	>`SELECT * FROM abendeinstieg_aufloesen(${merkmal})`;

	const erste = zeilen[0];
	if (!erste) return { gueltig: false, grund: UNBEKANNT };

	const d = erste.day_date;
	return {
		gueltig: true,
		bezeichnung: erste.label,
		datum: d instanceof Date ? d.toISOString().slice(0, 10) : String(d),
		uhrzeit: String(erste.start_time).slice(0, 5),
		ort: erste.location,
		haeuser: zeilen.map((z) => ({
			meetingId: z.meeting_id,
			name: z.stweg_name,
			zustand: z.meeting_state
		}))
	};
}

/**
 * Das Saalmerkmal eines Hauses dieses Abends — für die Weiterleitung.
 *
 * Null heisst: Das Haus gehört nicht zu diesem Abend, oder es hat noch kein
 * Merkmal. Beides führt zur selben Absage; ein Unterschied in der Antwort
 * verriete, welche Kennungen es gibt.
 *
 * **Und eine Zeichenkette, die nur wie eine Kennung aussieht, ist derselbe
 * Fall** (Block B2, 16.10.2026). Hier stand `[0-9a-f-]{36}`: Das liess jede
 * 36-stellige Zeichenkette durch, und `abendeinstieg_haus(text, uuid)` warf
 * daraus `22P02`: unmittelbares `sql`, an `kennungsfehler` vorbei, im Betrieb
 * die 500-Seite. Gemessen an `GET /e/tag/<merkmal>?haus=aaaa…` (36 Zeichen).
 * Geprüft wird jetzt die ganze Form; was nicht passt, bleibt still null.
 */
export async function saalmerkmalDesHauses(
	abendmerkmal: string,
	meetingId: Id
): Promise<string | null> {
	if (!abendmerkmal || !/^[A-Za-z0-9_-]{16,64}$/.test(abendmerkmal)) return null;
	if (!istKennung(meetingId)) return null;

	const [z] = await sql<{ abendeinstieg_haus: string | null }[]>`
		SELECT abendeinstieg_haus(${abendmerkmal}, ${meetingId})
	`;
	return z?.abendeinstieg_haus ?? null;
}

export interface Saalbefund {
	gueltig: boolean;
	operatorId?: Id;
	meetingId?: Id;
	versammlungszustand?: string;
	datum?: string;
	uhrzeit?: string;
	ort?: string;
	gemeinschaftName?: string;
	grund?: string;
}

/** Löst das Saalmerkmal auf — ohne Mandantenkontext, wie der Zugangscode. */
export async function loeseSaaleinstiegAuf(merkmal: string): Promise<Saalbefund> {
	if (!merkmal || !/^[A-Za-z0-9_-]{16,64}$/.test(merkmal)) {
		return { gueltig: false, grund: UNBEKANNT };
	}

	const zeilen = await sql<
		{
			operator_id: string;
			meeting_id: string;
			meeting_state: string;
			meeting_date: Date;
			start_time: string;
			location: string;
			stweg_name: string;
		}[]
	>`SELECT * FROM saaleinstieg_aufloesen(${merkmal})`;

	const z = zeilen[0];
	if (!z) return { gueltig: false, grund: UNBEKANNT };

	const d = z.meeting_date;
	return {
		gueltig: z.meeting_state === 'laufend',
		operatorId: z.operator_id,
		meetingId: z.meeting_id,
		versammlungszustand: z.meeting_state,
		datum: kalendertag(d),
		uhrzeit: z.start_time.slice(0, 5),
		ort: z.location,
		gemeinschaftName: z.stweg_name,
		grund:
			z.meeting_state === 'laufend'
				? undefined
				: z.meeting_state === 'geschlossen' || z.meeting_state === 'versiegelt'
					? 'Die Versammlung ist geschlossen.'
					: 'Die Versammlung ist noch nicht eröffnet.'
	};
}

const UNBEKANNT = 'Dieser Zugang ist nicht gültig.';

/**
 * Meldet sich über den Saal-QR.
 *
 * Gibt bewusst nur zurück, ob es geklappt hat. Der Melder erfährt nichts über
 * die Versammlung, die er nicht ohnehin auf der Leinwand sieht.
 */
export async function meldeUeberSaal(
	merkmal: string,
	name: string,
	bemerkung?: string
	/**
	 * Gibt Betreiber und Versammlung mit zurück, damit die Route den Stand
	 * verkünden kann.
	 *
	 * **Warum nicht hier verkünden.** `versammlungsstand.ts` liest seit dem
	 * 20.08.2026 die offenen Saalmeldungen — riefe diese Datei umgekehrt den
	 * Stand auf, entstünde ein Ringschluss zwischen zwei Modulen. Die Route ist
	 * die Stelle, an der beides zusammenkommt, ohne dass eines das andere kennen
	 * muss.
	 */
): Promise<{ gemeldet: boolean; operatorId?: Id; meetingId?: Id }> {
	const gekuerzt = (name ?? '').trim();
	if (zeichenzahl(gekuerzt) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Bitte geben Sie Ihren Namen an, damit die Sitzungsleitung Sie zuordnen kann.',
			'name'
		);
	}
	if (zeichenzahl(gekuerzt) > 200) {
		throw new FachlicherFehler('name_zu_lang', 'Der Name ist zu lang.', 'name');
	}
	// Bis zum 15.10.2026 begrenzte nur das Eingabefeld die Bemerkung; dieselbe
	// Grenze steht jetzt auch in der Datenbank (Migration 162).
	if (zeichenzahl((bemerkung ?? '').trim()) > 200) {
		throw new FachlicherFehler('bemerkung_zu_lang', 'Die Bemerkung ist zu lang.', 'bemerkung');
	}

	let z: { saaleinstieg_melden: string | null } | undefined;
	try {
		[z] = await sql<{ saaleinstieg_melden: string | null }[]>`
			SELECT saaleinstieg_melden(${merkmal}, ${gekuerzt}, ${bemerkung?.trim() || null})
		`;
	} catch (fehler) {
		// Der Deckel je Versammlung (D10, Migration 162). Ein Grund mehr, zum
		// Eingang zu gehen, nicht ein Fehler der Person.
		if (fehler instanceof postgres.PostgresError && fehler.code === 'VO162') {
			throw new FachlicherFehler(
				'saal_voll',
				'Über diesen Weg nimmt die Versammlung keine weiteren Meldungen an. Bitte melden Sie sich am Eingang.'
			);
		}
		throw fehler;
	}
	if (!z?.saaleinstieg_melden) return { gemeldet: false };

	const befund = await loeseSaaleinstiegAuf(merkmal);
	return {
		gemeldet: true,
		operatorId: befund.operatorId,
		meetingId: befund.meetingId
	};
}

export interface Saalmeldung {
	id: Id;
	name: string;
	bemerkung: string | null;
	gemeldetAm: Zeitpunkt;
}

export async function holeOffeneSaalmeldungen(
	operatorId: Id,
	meetingId: Id
): Promise<Saalmeldung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{ id: string; claimed_name: string; note: string | null; created_at: Date }[]
		>`
			SELECT id, claimed_name, note, created_at FROM room_entry_request
			WHERE meeting_id = ${meetingId} AND state = 'offen'
			ORDER BY created_at
		`;
		return zeilen.map((z) => ({
			id: z.id,
			name: z.claimed_name,
			bemerkung: z.note,
			gemeldetAm: z.created_at.toISOString()
		}));
	});
}

/**
 * Ordnet eine Saalmeldung einer Partei zu und bestätigt sie damit.
 *
 * Zwei Vorgänge in einem: Die Zuordnung ist die Feststellung, wer da steht, und
 * die Bestätigung ist die Anwesenheit. Getrennt liesse sich eine Meldung
 * zuordnen, ohne dass jemand als anwesend gilt — ein Zustand, den niemand
 * braucht und den beim nächsten Blick auf die Liste keiner versteht.
 *
 * bindung: snapshotPartyId — Der Wert GEHT an `bestaetigeAnwesenheit`, das ihn
 * über `findeZiel(tx, meetingId, …)` gegen die Momentaufnahme auflöst und
 * abweist, wenn er nicht dazugehört; das UPDATE unten schreibt den daraus
 * zurückgegebenen `e.snapshotPartyId`.
 */
export async function ordneSaalmeldungZu(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	meldungId: Id,
	snapshotPartyId: Id
): Promise<{ name: string; parteiId: Id }> {
	const meldung = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ id: string; claimed_name: string; state: string }[]>`
			SELECT id, claimed_name, state FROM room_entry_request
			WHERE id = ${meldungId} AND meeting_id = ${meetingId}
		`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Meldung nicht gefunden.', 'meldungId');
		if (m.state !== 'offen') {
			throw new FachlicherFehler('erledigt', 'Diese Meldung ist bereits erledigt.', 'meldungId');
		}
		return m;
	});

	// Erst die Anwesenheit — sie prüft den Zustand der Versammlung und die
	// Zugehörigkeit der Partei. Scheitert sie, bleibt die Meldung offen.
	const e = await bestaetigeAnwesenheit(
		handelnder,
		meetingId,
		snapshotPartyId,
		'von_hand',
		`Über den Saal-Zugang gemeldet als «${meldung.claimed_name}»`
	);

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE room_entry_request
			-- **Das aufgeloeste Ziel, nicht die Eingabe.** Die Oberflaeche schickt hier
			-- die Kennung der PARTEI; die Spalte zeigt aber auf die Momentaufnahme.
			-- bestaetigeAnwesenheit nimmt beides entgegen und sagt, was es war.
			-- (Keine Schraegstriche hier: Der Text steht in einem Template-String,
			--  und ein Gegenstrich darin beendet ihn.)
			SET state = 'zugeordnet', assigned_snapshot_party_id = ${e.snapshotPartyId},
			    resolved_at = now(), resolved_by = ${handelnder.userId}
			WHERE id = ${meldungId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.saalmeldungZugeordnet,
				{ art: 'meeting', id: meetingId },
				{ gemeldetAls: meldung.claimed_name, partei: e.name }
			)
		);
	});

	/*
	 * **Auch die aufgelöste Parteikennung** (09.09.2026). Der Aufrufer setzt
	 * daran den Papiervermerk; die Oberfläche schickt hier die Kennung der
	 * Momentaufnahme ODER die der Partei, und `vermerkePapierabgabe` sucht nur
	 * nach der aus den Stammdaten. `bestaetigeAnwesenheit` hat sie ohnehin
	 * aufgelöst, sie hier fallen zu lassen zwänge den Aufrufer zum Raten.
	 */
	return { name: e.name, parteiId: e.parteiId };
}

export async function lehneSaalmeldungAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	meldungId: Id,
	grund?: string
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ claimed_name: string; state: string }[]>`
			SELECT claimed_name, state FROM room_entry_request
			WHERE id = ${meldungId} AND meeting_id = ${meetingId}
		`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Meldung nicht gefunden.', 'meldungId');
		if (m.state !== 'offen') {
			throw new FachlicherFehler('erledigt', 'Diese Meldung ist bereits erledigt.', 'meldungId');
		}

		await tx`
			UPDATE room_entry_request
			SET state = 'abgelehnt', resolved_at = now(), resolved_by = ${handelnder.userId}
			WHERE id = ${meldungId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.saalmeldungAbgelehnt,
				{ art: 'meeting', id: meetingId },
				{ gemeldetAls: m.claimed_name, grund: grund?.trim() || null }
			)
		);
	});
}
