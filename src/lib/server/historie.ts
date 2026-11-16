/**
 * Versammlungshistorie und Suche in früheren Geschäften (Story 3.9, FR-11).
 */
import { alsBetreiber } from './db';
import {
	fundstellen,
	suchbegriffBrauchbar,
	vergleichsform,
	type Fundstelle,
	type Versammlungszeile
} from '$lib/domain/historiesuche';
import type { Versammlungsart, Versammlungszustand } from '$lib/domain/versammlung';
import type { Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
import type { Id } from '$lib/domain/types';
import { kalendertag } from '$lib/domain/datum';

/** Alle Versammlungen einer Gemeinschaft, chronologisch, mit Kennzahlen. */
export async function holeHistorie(
	operatorId: Id,
	stwegId: Id
): Promise<Versammlungszeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				meeting_date: Date;
				kind: Versammlungsart;
				tier: Versammlungsstufe;
				state: Versammlungszustand;
				location: string;
				traktanden: number;
				abstimmungen: number;
			}[]
		>`
			SELECT m.id, m.meeting_date, m.kind, m.tier, m.state, m.location,
			       (SELECT count(*)::int FROM agenda_item a WHERE a.meeting_id = m.id) AS traktanden,
			       (SELECT count(*)::int FROM agenda_item a
			        WHERE a.meeting_id = m.id AND a.item_kind = 'abstimmung') AS abstimmungen
			FROM meeting m
			WHERE m.stweg_id = ${stwegId}
			ORDER BY m.meeting_date DESC, m.start_time DESC
		`;

		return zeilen.map((z) => ({
			id: z.id,
			datum: kalendertag(z.meeting_date),
			art: z.kind,
			stufe: z.tier,
			zustand: z.state,
			ort: z.location,
			anzahlTraktanden: Number(z.traktanden),
			anzahlAbstimmungen: Number(z.abstimmungen),
			// Beschlüsse entstehen erst mit der Auszählung (Epic 5). Bis dahin
			// `null` und nicht 0 — eine Null stünde da wie «es wurde nichts
			// beschlossen».
			anzahlBeschluesse: null
		}));
	});
}

export interface Suchtreffer {
	traktandumId: Id;
	versammlungId: Id;
	versammlungDatum: string;
	versammlungArt: Versammlungsart;
	versammlungZustand: Versammlungszustand;
	gemeinschaftName: string;
	nummer: number;
	titel: string;
	art: 'abstimmung' | 'kenntnisnahme';
	/** Das angewandte Mehrheitserfordernis, wie es damals galt. */
	erfordernisTitel: string | null;
	erfordernisFassung: string | null;
	erfordernisGrundlage: string | null;
	fundstellen: Fundstelle[];
}

/**
 * Sucht in Titel, Kurzfassung, Inhalt und Antragswortlaut früherer Traktanden.
 *
 * Die Vorauswahl geschieht in der Datenbank mit `unaccent`-freiem `ILIKE` —
 * absichtlich einfach: Eine Volltextsuche mit Wortstammbildung fände bei
 * «Fassade» auch «fassen» und bei einem Namen gar nichts Verlässliches. Für ein
 * Werkzeug, in dem eine Gemeinschaft über Jahre ein paar hundert Traktanden
 * ansammelt, ist die einfache Teilzeichenkette das ehrlichere Verfahren.
 *
 * Weil `ILIKE` keine Akzente ignoriert, wird die Menge danach im Kern
 * nachgeprüft: Dort entscheidet `vergleichsform`, und wer «Petrovic» ohne
 * Häkchen tippt, findet «Petrović».
 */
export async function sucheInGeschaeften(
	operatorId: Id,
	suchbegriff: string,
	stwegId?: Id,
	hoechstens = 100
): Promise<Suchtreffer[]> {
	if (!suchbegriffBrauchbar(suchbegriff)) return [];

	return alsBetreiber(operatorId, async (tx) => {
		const muster = `%${suchbegriff.trim().replace(/[%_\\]/g, '\\$&')}%`;

		const zeilen = await tx<
			{
				id: string;
				meeting_id: string;
				meeting_date: Date;
				kind: Versammlungsart;
				state: Versammlungszustand;
				stweg_name: string;
				position: number;
				title: string;
				item_kind: 'abstimmung' | 'kenntnisnahme';
				summary: string | null;
				body: string | null;
				motion_text: string | null;
				requirement_title: string | null;
				requirement_version: string | null;
				requirement_legal_basis: string | null;
			}[]
		>`
			SELECT a.id, a.meeting_id, m.meeting_date, m.kind, m.state, s.name AS stweg_name,
			       a.position, a.title, a.item_kind, a.summary, a.body, a.motion_text,
			       a.requirement_title, a.requirement_version, a.requirement_legal_basis
			FROM agenda_item a
			JOIN meeting m ON m.id = a.meeting_id
			JOIN stweg s ON s.id = m.stweg_id
			WHERE ${stwegId ? tx`m.stweg_id = ${stwegId} AND` : tx``}
			      (a.title ILIKE ${muster} ESCAPE '\\'
			       OR a.summary ILIKE ${muster} ESCAPE '\\'
			       OR a.body ILIKE ${muster} ESCAPE '\\'
			       OR a.motion_text ILIKE ${muster} ESCAPE '\\')
			ORDER BY m.meeting_date DESC, a.position
			LIMIT ${hoechstens}
		`;

		return zeilen
			.map((z) => ({
				traktandumId: z.id,
				versammlungId: z.meeting_id,
				versammlungDatum: kalendertag(z.meeting_date),
				versammlungArt: z.kind,
				versammlungZustand: z.state,
				gemeinschaftName: z.stweg_name,
				nummer: z.position,
				titel: z.title,
				art: z.item_kind,
				erfordernisTitel: z.requirement_title,
				erfordernisFassung: z.requirement_version,
				erfordernisGrundlage: z.requirement_legal_basis,
				fundstellen: fundstellen(
					{
						titel: z.title,
						kurzfassung: z.summary,
						inhalt: z.body,
						antragswortlaut: z.motion_text
					},
					suchbegriff
				)
			}))
			// Was der Kern nicht wiederfindet, war ein Treffer der Datenbank auf
			// einer Schreibweise, die niemand gemeint hat. Ohne Auszug wäre der
			// Eintrag ohnehin unbrauchbar.
			.filter((t) => t.fundstellen.length > 0);
	});
}

/**
 * Dieselbe Suche, aber über Akzentgrenzen hinweg.
 *
 * `ILIKE` in PostgreSQL vergleicht Zeichen für Zeichen: «Petrovic» findet
 * «Petrović» nicht. Für diese Fälle wird zusätzlich ohne Akzente gesucht — auf
 * einer kleineren Vorauswahl, damit die Abfrage nicht über die ganze Tabelle
 * laufen muss.
 */
export async function sucheNachsichtig(
	operatorId: Id,
	suchbegriff: string,
	stwegId?: Id
): Promise<Suchtreffer[]> {
	const genau = await sucheInGeschaeften(operatorId, suchbegriff, stwegId);
	if (genau.length > 0) return genau;

	// Nichts gefunden: Jetzt lohnt sich der teurere Weg über alle Traktanden
	// dieser Gemeinschaft. Er läuft nur dort, wo die schnelle Suche leer ausging.
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				meeting_id: string;
				meeting_date: Date;
				kind: Versammlungsart;
				state: Versammlungszustand;
				stweg_name: string;
				position: number;
				title: string;
				item_kind: 'abstimmung' | 'kenntnisnahme';
				summary: string | null;
				body: string | null;
				motion_text: string | null;
				requirement_title: string | null;
				requirement_version: string | null;
				requirement_legal_basis: string | null;
			}[]
		>`
			SELECT a.id, a.meeting_id, m.meeting_date, m.kind, m.state, s.name AS stweg_name,
			       a.position, a.title, a.item_kind, a.summary, a.body, a.motion_text,
			       a.requirement_title, a.requirement_version, a.requirement_legal_basis
			FROM agenda_item a
			JOIN meeting m ON m.id = a.meeting_id
			JOIN stweg s ON s.id = m.stweg_id
			${stwegId ? tx`WHERE m.stweg_id = ${stwegId}` : tx``}
			ORDER BY m.meeting_date DESC, a.position
			LIMIT 2000
		`;

		const nadel = vergleichsform(suchbegriff.trim());

		return zeilen
			.filter((z) =>
				[z.title, z.summary, z.body, z.motion_text]
					.filter(Boolean)
					.some((t) => vergleichsform(t as string).includes(nadel))
			)
			.map((z) => ({
				traktandumId: z.id,
				versammlungId: z.meeting_id,
				versammlungDatum: kalendertag(z.meeting_date),
				versammlungArt: z.kind,
				versammlungZustand: z.state,
				gemeinschaftName: z.stweg_name,
				nummer: z.position,
				titel: z.title,
				art: z.item_kind,
				erfordernisTitel: z.requirement_title,
				erfordernisFassung: z.requirement_version,
				erfordernisGrundlage: z.requirement_legal_basis,
				fundstellen: fundstellen(
					{
						titel: z.title,
						kurzfassung: z.summary,
						inhalt: z.body,
						antragswortlaut: z.motion_text
					},
					suchbegriff
				)
			}))
			.filter((t) => t.fundstellen.length > 0);
	});
}
