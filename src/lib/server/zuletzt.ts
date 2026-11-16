/**
 * Woran diese Person zuletzt gearbeitet hat — der Weg zurück in die Arbeit.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Dann einen Bereich zuletzt Bearbeitet (wo
 * man direkt rein und weiterbearbeiten kann).»
 *
 * **Warum aus dem Verlauf und nicht aus einer eigenen Spalte.** Jede Änderung
 * schreibt ohnehin einen Eintrag in `audit_entry` — mit Handelndem, Gegenstand
 * und Zeitpunkt. Eine zweite Buchführung daneben wäre ein zweiter Schreiber für
 * dieselbe Tatsache und liefe irgendwann auseinander. Gelesen wird hier nur.
 *
 * **Nur die eigene Arbeit.** Gefiltert wird auf `actor_user_id`; die Frage
 * lautet «wo war ICH», nicht «was ist im Haus passiert». Wer eine fremde
 * Bearbeitung sucht, findet sie im Verlauf.
 *
 * **Der Weg führt dorthin, wo weitergearbeitet wird**, nicht auf den
 * Gegenstand selbst: Wer einen Eigentümer geändert hat, will zurück auf die
 * Eigentümerliste seiner Gemeinschaft — nicht auf eine Seite je Partei, die es
 * gar nicht gibt. Deshalb wird jeder Untergegenstand auf sein Gefäss abgebildet.
 */
import { alsBetreiber } from './db';
import { beschriftung } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

export interface Zuletztzeile {
	/** Wonach die Zeile aussieht: Versammlung, gemeinsamer Abend, Gemeinschaft. */
	art: 'versammlung' | 'abend' | 'gemeinschaft';
	name: string;
	/** Was zuletzt getan wurde, im Klartext — «Traktandum aufgerufen». */
	woran: string;
	pfad: string;
	wann: Date;
}

interface Rohzeile {
	art: string;
	kennung: string;
	name: string;
	unterweg: string | null;
	event_type: string;
	occurred_at: Date;
}

/**
 * Die zuletzt bearbeiteten Gegenstände dieser Person, jüngste zuerst.
 *
 * **Ein Gegenstand steht einmal da.** Wer an einer Versammlung zwanzig Dinge
 * getan hat, bekommt eine Zeile mit dem jüngsten davon — sonst füllte ein
 * einziger Abend die ganze Liste, und alles andere fiele heraus.
 */
export async function holeZuletztBearbeitet(
	operatorId: Id,
	benutzerId: Id,
	grenze = 5
): Promise<Zuletztzeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Ein Zug statt sieben.** Die Zuordnung Untergegenstand → Gefäss steht
		 * als `LEFT JOIN` in derselben Abfrage; `DISTINCT ON` liefert je Gefäss
		 * die jüngste Zeile. Sieben Einzelabfragen wären lesbarer und träfen die
		 * Datenbank siebenmal, bei jedem Aufruf der Startseite.
		 *
		 * **Die Vorauswahl ist nötig.** `audit_entry` trägt Zehntausende Zeilen;
		 * ohne den inneren Ausschnitt sortierte PostgreSQL alle. Genommen werden
		 * die letzten 400 eigenen Einträge — genug, damit bei fünf Zeilen
		 * Ausgabe auch dann etwas Älteres durchkommt, wenn ein langer
		 * Versammlungsabend die Spitze füllt.
		 */
		const zeilen = await tx<Rohzeile[]>`
			WITH meine AS (
				SELECT a.subject_type, a.subject_id, a.event_type, a.occurred_at
				FROM audit_entry a
				WHERE a.operator_id = ${operatorId}
				  AND a.actor_user_id = ${benutzerId}
				  AND a.subject_type IN
					('meeting', 'agenda_item', 'meeting_day', 'stweg', 'party', 'unit')
				ORDER BY a.occurred_at DESC
				LIMIT 400
			),
			gefaess AS (
				SELECT
					m.event_type,
					m.occurred_at,
					CASE
						WHEN m.subject_type = 'meeting_day' THEN 'abend'
						WHEN m.subject_type IN ('meeting', 'agenda_item') THEN 'versammlung'
						ELSE 'gemeinschaft'
					END AS art,
					COALESCE(
						md.id::text,
						v.id::text,
						va.id::text,
						s.id::text,
						sp.id::text,
						su.id::text
					) AS kennung,
					COALESCE(
						md.label,
						sv.name,
						sva.name,
						s.name,
						sp.name,
						su.name
					) AS name,
					CASE
						WHEN m.subject_type = 'agenda_item' THEN 'traktanden'
						WHEN m.subject_type = 'party' THEN 'eigentuemer'
						WHEN m.subject_type = 'unit' THEN 'einheiten'
					END AS unterweg
				FROM meine m
				LEFT JOIN meeting_day md ON m.subject_type = 'meeting_day' AND md.id = m.subject_id::uuid
				LEFT JOIN meeting v      ON m.subject_type = 'meeting'      AND v.id  = m.subject_id::uuid
				LEFT JOIN stweg sv       ON sv.id = v.stweg_id
				LEFT JOIN agenda_item ai ON m.subject_type = 'agenda_item'  AND ai.id = m.subject_id::uuid
				LEFT JOIN meeting va     ON va.id = ai.meeting_id
				LEFT JOIN stweg sva      ON sva.id = va.stweg_id
				LEFT JOIN stweg s        ON m.subject_type = 'stweg'        AND s.id  = m.subject_id::uuid
				LEFT JOIN party p        ON m.subject_type = 'party'        AND p.id  = m.subject_id::uuid
				LEFT JOIN stweg sp       ON sp.id = p.stweg_id
				LEFT JOIN unit u         ON m.subject_type = 'unit'         AND u.id  = m.subject_id::uuid
				LEFT JOIN stweg su       ON su.id = u.stweg_id
			)
			SELECT DISTINCT ON (art, kennung)
				art, kennung, name, unterweg, event_type, occurred_at
			FROM gefaess
			-- Was gelöscht wurde, hat kein Gefäss mehr: Der Verlauf bleibt stehen
			-- (AD-5), der Weg dorthin führte ins Leere.
			WHERE kennung IS NOT NULL AND name IS NOT NULL
			ORDER BY art, kennung, occurred_at DESC
		`;

		const wege: Record<string, string> = {
			abend: '/tage/',
			versammlung: '/versammlungen/',
			gemeinschaft: '/gemeinschaften/'
		};

		return zeilen
			.map((z) => ({
				art: z.art as Zuletztzeile['art'],
				name: z.name,
				woran: beschriftung(z.event_type),
				pfad: `${wege[z.art]}${z.kennung}${z.unterweg ? `/${z.unterweg}` : ''}`,
				wann: z.occurred_at
			}))
			.sort((a, b) => b.wann.getTime() - a.wann.getTime())
			.slice(0, grenze);
	});
}
