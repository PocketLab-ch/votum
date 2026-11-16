/**
 * Anwesenheitsereignisse lesen und schreiben — die unterste Schicht.
 *
 * **Warum eigenes Modul.** Zwei Bereiche brauchen dieselben zwei Zugriffe:
 * die Anwesenheit selbst und die Vollmacht (eine beendete Vertretung nimmt die
 * Anwesenheit mit, die sie erzeugt hat). Läge das weiterhin in `anwesenheit.ts`,
 * müssten sich die beiden Module gegenseitig einbinden — und ein Ringschluss
 * zwischen zwei Modulen, die beide beim Start Nebenwirkungen haben, ist die Art
 * Fehler, die sich erst im Betrieb zeigt.
 *
 * Hier steht **nur** der Zugriff. Was ein Ereignis bedeutet, entscheidet der
 * Kern (`$lib/domain/anwesenheit`); wann eines entsteht, die aufrufende
 * Schicht.
 */
import type postgres from 'postgres';
import { zeitquelle } from './audit';
import type {
	Anwesenheitsart,
	Anwesenheitsereignis,
	Erfassungsweg
} from '$lib/domain/anwesenheit';
import type { Id } from '$lib/domain/types';

interface EreignisZeile {
	id: string;
	meeting_id: string;
	snapshot_party_id: string;
	party_id: string;
	kind: Anwesenheitsart;
	channel: Erfassungsweg;
	occurred_at: Date;
	recorded_by_label: string | null;
	note: string | null;
}

function ausDb(z: EreignisZeile): Anwesenheitsereignis {
	return {
		id: z.id,
		meetingId: z.meeting_id,
		parteiId: z.party_id,
		art: z.kind,
		weg: z.channel,
		zeitpunkt: z.occurred_at.toISOString(),
		erfasstDurch: z.recorded_by_label,
		bemerkung: z.note
	};
}

/**
 * bindung: parteiId — Die Bindung steht in einer verschachtelten Vorlage, die
 *   die Regel nicht liest: `${parteiId ? tx`AND p.party_id = …` : tx``}`.
 */
export async function leseEreignisse(
	tx: postgres.TransactionSql,
	meetingId: Id,
	parteiId?: Id
): Promise<Anwesenheitsereignis[]> {
	const zeilen = await tx<EreignisZeile[]>`
		SELECT e.id, e.meeting_id, e.snapshot_party_id, p.party_id, e.kind, e.channel,
		       e.occurred_at, e.recorded_by_label, e.note
		FROM attendance_event e
		JOIN snapshot_party p ON p.id = e.snapshot_party_id
		WHERE e.meeting_id = ${meetingId}
		  ${parteiId ? tx`AND p.party_id = ${parteiId}` : tx``}
		ORDER BY e.occurred_at, e.id
	`;
	return zeilen.map(ausDb);
}

/** Dasselbe über die Zeilenkennung der Momentaufnahme statt über die Partei. */
export async function leseEreignisseJeMomentpartei(
	tx: postgres.TransactionSql,
	meetingId: Id,
	snapshotPartyId: Id
): Promise<Anwesenheitsereignis[]> {
	const zeilen = await tx<EreignisZeile[]>`
		SELECT e.id, e.meeting_id, e.snapshot_party_id, p.party_id, e.kind, e.channel,
		       e.occurred_at, e.recorded_by_label, e.note
		FROM attendance_event e
		JOIN snapshot_party p ON p.id = e.snapshot_party_id
		WHERE e.meeting_id = ${meetingId} AND e.snapshot_party_id = ${snapshotPartyId}
		ORDER BY e.occurred_at, e.id
	`;
	return zeilen.map(ausDb);
}

/**
 * bindung: snapshotPartyId — Jede der neun Aufrufstellen bindet den Wert vorher
 * gegen die Versammlung: über `findeZiel(tx, meetingId, …)`, über
 * `leseWirksame(tx, meetingId)`, über `verlangeParteiDerVersammlung` oder über
 * `proxy … WHERE p.id = … AND p.meeting_id = ${meetingId}`. Nachgezählt am
 * 08.09.2026; eine neue Aufrufstelle muss das ebenfalls tun.
 */
export async function schreibeEreignis(
	tx: postgres.TransactionSql,
	operatorId: Id,
	meetingId: Id,
	snapshotPartyId: Id,
	art: Anwesenheitsart,
	weg: Erfassungsweg,
	erfasser: { userId: string | null; label: string | null },
	bemerkung?: string
): Promise<void> {
	await tx`
		INSERT INTO attendance_event (operator_id, meeting_id, snapshot_party_id, kind, channel,
		                              clock_source, recorded_by, recorded_by_label, note)
		VALUES (${operatorId}, ${meetingId}, ${snapshotPartyId}, ${art}, ${weg},
		        ${zeitquelle()}, ${erfasser.userId}, ${erfasser.label}, ${bemerkung ?? null})
	`;
}
