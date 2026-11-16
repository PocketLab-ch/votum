/**
 * Die Spur der Codeeingaben auf den öffentlichen Wegen (Audit B-05).
 *
 * **Keine Sperre, nur eine Spur.** Der Zugangscode trägt 97 Bit Zufall, der
 * Anzeigecode 58 — Durchprobieren ist chancenlos, und eine Sperre träfe im Saal
 * die Falschen: Wer seinen Code bei schlechtem Licht dreimal abtippt, käme nicht
 * mehr hinein, mitten in der Versammlung.
 *
 * **Gezählt, nicht aufgeschrieben.** `/z/<code>` und `/p/<code>` sind
 * unangemeldete Aufrufe. Eine Zeile je Versuch machte aus zwei reinen Lesewegen
 * Schreibwege, die jeder von aussen betätigen kann — gemessen 700 Anfragen je
 * Sekunde, rund 6 GB am Tag, in einer Tabelle, die niemand aufräumt. Der Zähler
 * je Art, Stunde und Ausgang beantwortet dieselbe Frage in höchstens vier Zeilen
 * je Stunde.
 *
 * **Ohne Mandantenkontext**, und das muss so sein: Ein Code, der nicht greift,
 * gehört zu keinem Betreiber.
 */
import { sql } from './db';

export type Codeart = 'zugangscode' | 'anzeigecode';

/**
 * Zählt einen Versuch mit.
 *
 * **Schluckt seine eigenen Fehler.** Diese Zeile darf nie der Grund sein, warum
 * jemand im Saal nicht hineinkommt — die Spur ist weniger wert als der Zugang.
 */
export async function haltCodeversuchFest(art: Codeart, gelungen: boolean): Promise<void> {
	try {
		await sql`
			INSERT INTO code_attempt (kind, hour, succeeded, count)
			VALUES (${art}, date_trunc('hour', now()), ${gelungen}, 1)
			ON CONFLICT (kind, hour, succeeded)
			DO UPDATE SET count = code_attempt.count + 1
		`;
	} catch {
		// Bewusst still.
	}
}

export interface Codeversuchslage {
	vergeblichZugang: number;
	vergeblichAnzeige: number;
	seitStunden: number;
}

/** Wie viele Codeeingaben zuletzt ins Leere gingen. */
export async function holeCodeversuche(stunden = 24): Promise<Codeversuchslage> {
	const zeilen = await sql<{ kind: string; anzahl: number }[]>`
		SELECT kind, sum(count)::int AS anzahl
		FROM code_attempt
		WHERE succeeded = false
		  AND hour > date_trunc('hour', now()) - make_interval(hours => ${stunden})
		GROUP BY kind
	`;
	const zahl = (art: string) => zeilen.find((z) => z.kind === art)?.anzahl ?? 0;
	return {
		vergeblichZugang: zahl('zugangscode'),
		vergeblichAnzeige: zahl('anzeigecode'),
		seitStunden: stunden
	};
}
