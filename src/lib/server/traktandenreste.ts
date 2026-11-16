/**
 * Was beim Löschen eines Traktandums mitgeht, ohne Fremdschlüssel daran zu
 * hängen (Befund N4, Codeprüfung Block 3, 17.10.2026).
 *
 * **Warum diese Stelle nötig ist.** Fast alles, was auf ein Traktandum zeigt,
 * hängt per Fremdschlüssel mit `ON DELETE CASCADE` daran. Zwei Tabellen nicht:
 * `recusal` (Migration 062) trägt `agenda_item_id` ohne Fremdschlüssel, und
 * `attachment` zeigt über `subject_type`/`subject_id` auf mehrere Arten von
 * Gegenständen, wo keiner möglich ist. Beide können im Entwurf schon Zeilen
 * haben: ein Ausstand vorab (Traktandenseite, Migration 167) und Unterlagen zur
 * Einladung. Gemessen am 18.10.2026 an einer frisch migrierten Datenbank;
 * `quorum_finding` und `meeting.current_agenda_item_id` entstehen erst in der
 * laufenden Versammlung, und dort wird nicht gelöscht, sondern zurückgezogen.
 *
 * **Warum ausdrücklich und nicht per Migration.** Ein Fremdschlüssel mit
 * `CASCADE` auf `recusal` löschte Grund und Namen still; der Verlauf soll aber
 * zeigen, was mit dem Traktandum verschwand. Für `attachment` gibt es ohnehin
 * keinen. So bleibt es bei einer Stelle, die alle drei Löschwege der
 * Anwendung rufen (`loescheTraktandum`, `loescheGeschaeft`, `setzeBeteiligte`).
 * Die zwei Wege in der Datenbank räumen selbst ab: `versammlung_loeschen`
 * (seit Migration 168 auch `recusal`) und die Fristlöschung (137).
 *
 * **Nach dem `DELETE` des Traktandums rufen, in derselben Transaktion.**
 * Erklären und Anhängen lesen das Traktandum mit `FOR KEY SHARE`; ein Löschen
 * wartet deshalb auf eine gleichzeitige Erklärung, und erst die Abfrage danach
 * sieht deren Zeile.
 *
 * Die Datei bleibt in der Ablage, wie bei `loeseAb` (AD-17): Sie kann an
 * einem anderen Gegenstand hängen.
 */
import type postgres from 'postgres';
import type { Id } from '$lib/domain/types';

type Tx = postgres.TransactionSql;

/**
 * Löscht Ausstände und Anhänge der genannten Traktanden und gibt je Traktandum
 * die Angaben für sein Ereignis `traktandumEntfernt` zurück. Leere Listen
 * entfallen, damit der Eintrag nicht «keine» behauptet, wo nie etwas war.
 */
export async function raeumeTraktandenAb(
	tx: Tx,
	traktandumIds: readonly Id[]
): Promise<Map<Id, Record<string, unknown>>> {
	const angaben = new Map<Id, Record<string, unknown>>();
	if (traktandumIds.length === 0) return angaben;
	const ids = [...traktandumIds];

	const ausstaende = await tx<
		{ agenda_item_id: string; party_id: string | null; holder_name: string | null; grund: string; name: string | null }[]
	>`
		WITH weg AS (
			DELETE FROM recusal WHERE agenda_item_id = ANY(${ids}::uuid[])
			RETURNING id, agenda_item_id, party_id, holder_name, grund
		)
		SELECT w.agenda_item_id, w.party_id, w.holder_name, w.grund, p.display_name AS name
		FROM weg w LEFT JOIN party p ON p.id = w.party_id
		ORDER BY w.id
	`;
	const anhaenge = await tx<{ subject_id: string; original_name: string; checksum: string }[]>`
		DELETE FROM attachment
		WHERE subject_type = 'agenda_item' AND subject_id = ANY(${ids}::uuid[])
		RETURNING subject_id, original_name, checksum
	`;

	const liste = (id: string, schluessel: 'ausstaende' | 'anhaenge'): unknown[] => {
		const a = angaben.get(id) ?? {};
		angaben.set(id, a);
		const l = (a[schluessel] as unknown[] | undefined) ?? [];
		a[schluessel] = l;
		return l;
	};
	for (const z of ausstaende) {
		// Dieselbe Form wie `ausstandZurueckgenommen` (`server/ausstand.ts`).
		liste(z.agenda_item_id, 'ausstaende').push(
			z.party_id === null
				? { partei: z.holder_name, vertreter: true, grund: z.grund }
				: { partei: z.name ?? z.party_id, parteiId: z.party_id, grund: z.grund }
		);
	}
	for (const z of anhaenge) {
		liste(z.subject_id, 'anhaenge').push({ name: z.original_name, pruefsumme: z.checksum });
	}
	return angaben;
}
