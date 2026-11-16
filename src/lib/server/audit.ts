/**
 * Verlauf schreiben.
 *
 * Die Ereignisse selbst bestimmt der Kern und gibt sie als Teil seines
 * Rückgabewerts zurück (AD-1); diese Schicht schreibt sie unverändert und fügt
 * keine eigenen hinzu. Der Schreibvorgang läuft in derselben Transaktion wie die
 * Änderung, die er belegt — nicht davor, nicht danach. Bricht die Änderung ab,
 * verschwindet auch der Eintrag; gelingt sie, ist er zwingend vorhanden.
 */
import type postgres from 'postgres';
import type { Ereignis, Uebergang } from '$lib/domain/verlauf';

export interface Handelnder {
	operatorId: string | null;
	userId: string | null;
	label: string;
}

/**
 * Woher der Zeitstempel stammt.
 *
 * Im lokalen Betrieb ohne Netz kann die Uhr des Notebooks falsch gehen. Ist das
 * nicht festgehalten, sieht ein um Stunden verschobener Verlauf später aus wie
 * eine Manipulation (AD-12).
 */
export function zeitquelle(): string {
	return process.env.VERSAMMLUNG_OFFLINE === 'true' ? 'local-unsynced' : 'system';
}

export async function schreibeVerlauf(
	tx: postgres.TransactionSql,
	handelnder: Handelnder,
	ereignisse: Ereignis | Ereignis[]
): Promise<void> {
	const liste = Array.isArray(ereignisse) ? ereignisse : [ereignisse];
	if (liste.length === 0) return;

	const quelle = zeitquelle();

	for (const e of liste) {
		await tx`
			INSERT INTO audit_entry
				(operator_id, actor_user_id, actor_label, event_type, subject_type, subject_id, detail, clock_source)
			VALUES (
				${handelnder.operatorId},
				${handelnder.userId},
				${handelnder.label},
				${e.art},
				${e.gegenstandArt ?? null},
				${e.gegenstandId ?? null},
				${tx.json((e.angaben ?? {}) as never)},
				${quelle}
			)
		`;
	}
}

/**
 * Schreibt die Ereignisse eines Kern-Übergangs und gibt dessen Ergebnis zurück.
 *
 * Der übliche Weg für alles, was der Kern entscheidet: Wer das Ergebnis haben
 * will, kommt an dieser Funktion nicht vorbei — und damit auch nicht am Verlauf.
 */
export async function schreibeUebergang<T>(
	tx: postgres.TransactionSql,
	handelnder: Handelnder,
	u: Uebergang<T>
): Promise<T> {
	await schreibeVerlauf(tx, handelnder, u.ereignisse);
	return u.ergebnis;
}
