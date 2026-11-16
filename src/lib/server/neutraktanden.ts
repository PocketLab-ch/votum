/**
 * Neue Traktanden an einer zweiten Versammlung (Ä-17 B) und die Lesart L5
 * (Migration 174, Konzept Lesarten Block 7).
 *
 * **Ein eigenes Modul**, weil zwei Wege dasselbe in der Transaktion brauchen:
 * die Anzeigen über `holeNeueTraktandenDerZweiten` (`server/traktanden.ts`)
 * und das Eröffnen einer Abstimmung (`server/abstimmung.ts`), das danach
 * sperrt. `traktanden.ts` importiert schon aus `abstimmung.ts`; ein Import in
 * die Gegenrichtung ergäbe einen Ring.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { holeLesartenIn } from './lesarten';
import { holeAnwesenheitsregeln } from './reglement';
import { neutraktandenFussnote } from '$lib/domain/einladung';
import { neueTraktandenDerZweiten } from '$lib/domain/mehrhinweise';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import type { Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
import type { Id } from '$lib/domain/types';

/*
 * **Zur Abstimmung an der ersten** heisst unten in beiden Abfragen
 * `q.item_kind = 'abstimmung' AND q.requirement_node IS DISTINCT FROM
 * 'k-kenntnisnahme'` (C2, F4c). Zur Kenntnisnahme stand ein Traktandum in zwei
 * Formen: als Art `kenntnisnahme` ohne Erfordernis, oder als Abstimmung auf
 * dem Knoten `k-kenntnisnahme`, unter dem Votum keinen Beschluss zulässt
 * (`erfordernisluecke`). Angekündigt war dort der Gegenstand, nicht ein
 * Beschluss (Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2 ZGB); die Vorgabe von L5
 * trägt hier ebenso (Einteilung F3b, C2).
 */

/** Die neuen Abstimmungstraktanden einer zweiten Versammlung; leer an einer ersten. */
export async function leseNeueTraktandenDerZweitenIn(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<Set<string>> {
	const [m] = await tx<{ tier: Versammlungsstufe; previous_meeting_id: string | null }[]>`
		SELECT tier, previous_meeting_id FROM meeting WHERE id = ${meetingId}
	`;
	if (!m || m.tier !== 'zweite') return new Set<string>();
	const zeilen = await tx<
		{
			id: string;
			item_kind: 'abstimmung' | 'kenntnisnahme';
			requirement_node: string | null;
			from_template: boolean;
			is_spontaneous: boolean;
			spontaneous_kind: string | null;
			parent_id: string | null;
			title: string;
			aus_erster: boolean;
		}[]
	>`
		SELECT a.id, a.item_kind, a.requirement_node, a.from_template, a.is_spontaneous, a.spontaneous_kind,
		       a.parent_id, a.title,
		       EXISTS (
		         SELECT 1 FROM audit_entry e
		          WHERE e.subject_type = 'agenda_item' AND e.subject_id = a.id::text
		            AND e.event_type = ${EREIGNISARTEN.traktandumUebernommen}
		            AND e.detail->>'ausVersammlung' = ${m.previous_meeting_id}::text
		            -- C2 (F4c): übernommen im Sinn von L5 nur, was an der ersten zur
		            -- Abstimmung stand. Eine Kopie aus einer Kenntnisnahme ist neu,
		            -- sobald unter ihr beschlossen werden soll. Ereignisse von vor F4c
		            -- nennen die Quelle nicht und gelten wie bisher als übernommen.
		            AND (
		              NOT (e.detail ? 'ausTraktandum')
		              OR EXISTS (
		                SELECT 1 FROM agenda_item q
		                 WHERE q.id::text = e.detail->>'ausTraktandum'
		                   AND q.meeting_id = ${m.previous_meeting_id}
		                   AND q.item_kind = 'abstimmung' AND q.requirement_node IS DISTINCT FROM 'k-kenntnisnahme'
		              )
		            )
		       ) AS aus_erster
		FROM agenda_item a WHERE a.meeting_id = ${meetingId}
	`;
	const vorlage = m.previous_meeting_id
		? await tx<{ title: string }[]>`
				SELECT title FROM agenda_item q
				WHERE q.meeting_id = ${m.previous_meeting_id} AND q.from_template
				  -- C2 (F4c): Ein Pflichttraktandum, das an der ersten nur zur
				  -- Kenntnisnahme stand, ist an der zweiten als Abstimmung neu.
				  AND q.item_kind = 'abstimmung' AND q.requirement_node IS DISTINCT FROM 'k-kenntnisnahme'
			`
		: [];
	return neueTraktandenDerZweiten(
		m.tier,
		zeilen.map((z) => ({
			id: z.id,
			// Eine Abstimmung auf dem Knoten der Kenntnisnahme beschliesst nichts und
			// ist hier eine Kenntnisnahme. Sonst würde eine unverändert übernommene
			// Kenntnisnahme in dieser Form durch C2 neu (Codeprüfung F4c Block 2, M1).
			art: z.item_kind === 'abstimmung' && z.requirement_node !== 'k-kenntnisnahme' ? 'abstimmung' : 'kenntnisnahme',
			ausVorlage: z.from_template,
			ausErsterUebernommen: z.aus_erster,
			spontan: z.is_spontaneous,
			folgeantragZu: z.spontaneous_kind === 'folgeantrag' ? z.parent_id : null,
			titel: z.title
		})),
		vorlage.map((v) => v.title)
	);
}

/**
 * Nach welcher Stufe die Beschlussfähigkeit für eine Abstimmung über dieses
 * Traktandum zu prüfen ist.
 *
 * An einer zweiten Versammlung ist das die erste Stufe, wenn das Traktandum
 * neu ist und die Gemeinschaft nach der Vorgabe von L5 rechnet. Die Wahl kommt
 * ab der Freigabe aus der Momentaufnahme (`holeLesartenIn`): Eine Umstellung
 * nach der Einladung ändert diese Versammlung nicht (Kriterium 3).
 *
 * bindung: traktandumId — nur über `has` auf der Menge, die
 * `leseNeueTraktandenDerZweitenIn` aus `agenda_item WHERE meeting_id` bildet;
 * ein fremdes Traktandum ist darin nie neu und behält die Stufe.
 */
export async function pruefstufeFuerTraktandumIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	traktandumId: Id,
	stufe: Versammlungsstufe
): Promise<Versammlungsstufe> {
	if (stufe !== 'zweite') return stufe;
	const { L5 } = await holeLesartenIn(tx, { meetingId });
	if (L5 !== 'erste') return stufe;
	return (await leseNeueTraktandenDerZweitenIn(tx, meetingId)).has(traktandumId) ? 'erste' : stufe;
}

/** Was die Traktandenliste für die Fussnote braucht: welche Traktanden, welcher Satz. */
export interface Neutraktandenfussnote {
	traktanden: ReadonlySet<string>;
	satz: string;
}

/**
 * Die Fussnote für Einladung und Traktandenliste (L5, Migration 174): nur an
 * einer zweiten Versammlung, nur nach der Vorgabe `erste` und nur mit
 * mindestens einem neuen Traktandum. Sonst `null`, und das Blatt bleibt, wie
 * es war.
 *
 * Die Gemeinschaft kommt aus der Versammlung, nicht vom Aufrufer: Die Regel
 * der ersten Versammlung muss die der Gemeinschaft dieser Versammlung sein.
 */
export async function holeNeutraktandenfussnote(
	operatorId: Id,
	meetingId: Id
): Promise<Neutraktandenfussnote | null> {
	const lage = await alsBetreiber(operatorId, async (tx) => {
		const [m] = await tx<{ stweg_id: string }[]>`SELECT stweg_id FROM meeting WHERE id = ${meetingId}`;
		if (!m) return null;
		return {
			stwegId: m.stweg_id,
			wahl: (await holeLesartenIn(tx, { meetingId })).L5,
			neue: await leseNeueTraktandenDerZweitenIn(tx, meetingId)
		};
	});
	if (!lage || lage.wahl !== 'erste' || lage.neue.size === 0) return null;
	const regeln = await holeAnwesenheitsregeln(operatorId, lage.stwegId);
	return { traktanden: lage.neue, satz: neutraktandenFussnote(regeln.erste ?? null) };
}
