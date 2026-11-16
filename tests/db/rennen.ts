/**
 * Werkzeug für gesteuerte Rennen in den Datenbanktests.
 *
 * Eine dritte Verbindung hält eine Zeilensperre, an der ein Lauf mitten im Weg
 * anhält. Gelöst wird sie erst, wenn nachweislich so viele Läufe warten, wie
 * die Prüfung braucht. So treffen sich zwei Läufe in jedem Durchgang im selben
 * Fenster, statt nur zufällig (`stimmweg-rennen.test.ts`).
 */
import type postgres from 'postgres';
import { admin } from './helfer';

/** Hält, was `sperren` sperrt, bis `loesen()` gerufen wird. */
export async function halteSperre(
	sperren: (tx: postgres.TransactionSql) => Promise<unknown>
): Promise<{ loesen: () => Promise<void> }> {
	let freigeben!: () => void;
	const freigabe = new Promise<void>((r) => (freigeben = r));
	/*
	 * **Spätestens nach zwanzig Sekunden von selbst gelöst.** Scheitert eine
	 * Prüfung zwischen Sperren und Lösen, bliebe die Transaktion sonst offen:
	 * Die wartenden Läufe hingen, und `afterAll` hinge beim Schliessen der
	 * Verbindungen, statt dass die Prüfung klar rot wird.
	 */
	const notloesung = setTimeout(() => freigeben(), 20_000);
	let bereit!: () => void;
	let gescheitert!: (fehler: unknown) => void;
	const gesperrt = new Promise<void>((r, f) => {
		bereit = r;
		gescheitert = f;
	});
	const lauf = admin
		.begin(async (tx) => {
			await sperren(tx);
			bereit();
			await freigabe;
		})
		.catch((fehler: unknown) => {
			gescheitert(fehler);
			throw fehler;
		});
	// Scheitert schon das Sperren, meldet `gesperrt` den Fehler; `lauf` soll
	// ihn nicht ein zweites Mal als unbehandelte Ablehnung werfen.
	lauf.catch(() => undefined);
	await gesperrt;
	return {
		loesen: async () => {
			clearTimeout(notloesung);
			freigeben();
			await lauf;
		}
	};
}

/**
 * Wartet, bis in der Prüfdatenbank `anzahl` Verbindungen auf eine Sperre
 * warten, oder bis `genug()` wahr ist. Nach zehn Sekunden ist es ein Fehler:
 * Dann hält der Lauf nicht dort an, wo die Prüfung es annimmt.
 */
export async function warteAufWartende(anzahl: number, genug: () => boolean = () => false): Promise<void> {
	const bis = Date.now() + 10_000;
	while (Date.now() < bis) {
		if (genug()) return;
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM pg_stat_activity
			 WHERE datname = current_database() AND wait_event_type = 'Lock'
		`;
		if (z.n >= anzahl) return;
		await new Promise((r) => setTimeout(r, 20));
	}
	throw new Error(`Nach zehn Sekunden warten keine ${anzahl} Verbindungen auf eine Sperre.`);
}
