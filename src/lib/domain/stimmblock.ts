/**
 * Was für eine Partei auf der Telefonsicht (`/z`) erfasst ist — und welcher
 * Block den Hinweis auf die Änderbarkeit trägt.
 *
 * **Warum das hier steht und nicht im Markup** (Code-Review 08.09.2026): Beide
 * Fragen wurden in `routes/z/+page.svelte` an drei Stellen einzeln gerechnet,
 * und an zwei davon anders. Eine Partei mit uneinheitlich erfassten Einheiten
 * las sich in der Zeile als «noch nicht gestimmt», obwohl sie oben als erfasst
 * mitzählte; und der Hinweis auf die Änderbarkeit fiel ganz weg, sobald die
 * eigene Partei im Ausstand war. Als Funktion lässt sich beides vorlegen und
 * mit einem Test rot machen (AD-1).
 *
 * **Wie erreichbar die drei Zustände sind, ist verschieden.** Der Ausstand
 * kommt im Betrieb vor. `uneinheitlich` entsteht nur, wenn `gibStimmenAb`
 * einzelne `unitIds` bekommt, und das setzt allein `z/+page.server.ts` aus dem
 * Formularfeld `einheit`, das kein Formular im Repo sendet: über die
 * Oberfläche also nicht, über eine von Hand gebaute Anfrage schon.
 */

/** Eine Partei, soweit für diese Rechnung nötig. */
export interface Stimmblock {
	parteiId: string;
	/** Was je Einheit erfasst ist. Leer heisst: noch nichts. */
	bisher: Record<string, string>;
	/** Der Grund, warum hier nicht gestimmt werden darf — sonst null. */
	gesperrt?: string | null;
}

/**
 * Drei Zustände, nicht zwei.
 *
 * `uneinheitlich` ist der Fall, den ein blosses «gestimmt ja/nein» verschluckt:
 * Für die Einheiten einer Partei ist Verschiedenes erfasst. Die Stimmen sind
 * abgegeben, eine einzelne Auskunft gibt es trotzdem nicht.
 */
export type Stimmstand = 'offen' | 'einheitlich' | 'uneinheitlich';

export function stimmstand(bisher: Record<string, string>): Stimmstand {
	const werte = Object.values(bisher);
	if (werte.length === 0) return 'offen';
	return werte.every((w) => w === werte[0]) ? 'einheitlich' : 'uneinheitlich';
}

/** Die eine erfasste Wahl, sofern es sie gibt. Bei Uneinheitlichkeit null. */
export function einheitlicheWahl(bisher: Record<string, string>): string | null {
	const werte = Object.values(bisher);
	return stimmstand(bisher) === 'einheitlich' ? werte[0] : null;
}

/** Die hier ausübbaren Stimmen: eine gesperrte Partei zählt weder oben noch unten mit. */
export function stimmbare<T extends Stimmblock>(parteien: T[]): T[] {
	return parteien.filter((p) => !p.gesperrt);
}

/**
 * Der erste Block, für den noch nichts erfasst ist und in dem gestimmt werden
 * darf. Dort steht der Hinweis auf die Änderbarkeit, und nur dort.
 *
 * **Die Sperre gehört in die Auswahl.** Die eigene Partei steht immer zuerst
 * (`holeAusuebbare` sortiert `(p.id = eigen) DESC`). Ist sie bei diesem
 * Traktandum im Ausstand, zeigt ihr Block nur den Sperrsatz: Ohne den Filter
 * war sie der «erste offene Block», und der Hinweis stand auf keinem einzigen.
 */
export function ersterOffenerBlock(parteien: Stimmblock[]): string | null {
	return stimmbare(parteien).find((p) => stimmstand(p.bisher) === 'offen')?.parteiId ?? null;
}
