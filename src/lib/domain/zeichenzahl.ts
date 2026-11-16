/**
 * Zeichen zählen, wie die Datenbank sie zählt.
 *
 * **Der Anlass** (26.08.2026, aus dem Code-Review am Vorsitzfeld). Eine
 * Eingabeschranke steht im Haus immer zweimal: als Satz im Kern («Der Name
 * braucht mindestens zwei Zeichen») und als `CHECK (length(btrim(spalte)) >= 2)`
 * in der Migration. Beide sagen «zwei Zeichen» — und meinen etwas anderes:
 *
 *   - `text.length` in JavaScript zählt **UTF-16-Einheiten**. Ein Zeichen
 *     ausserhalb der Grundebene, etwa ein Bildzeichen, besteht aus zwei davon.
 *   - `length()` in Postgres zählt **Zeichen**. Dasselbe Bildzeichen ist eins.
 *
 * Nachgemessen: `'😀'.length === 2`, `length(btrim('😀')) = 1`.
 *
 * **Warum das nicht bloss unsauber ist.** Bei einer Untergrenze ist die
 * Anwendung dadurch *lockerer* als die Datenbank: Ein Name aus einem einzigen
 * Bildzeichen kommt am Satz vorbei und läuft in die Schranke — und eine
 * verletzte `CHECK` ist keine Meldung, sondern eine rohe 500. Genau das, was
 * `docs/gestaltung.md` verbietet: «Eine Schranke der Datenbank ist keine
 * Fehlermeldung.» Bei einer Obergrenze ist es umgekehrt harmlos, aber die Zahl
 * im Satz stimmt trotzdem nicht.
 *
 * **Warum Zeichen und nicht Zeichengruppen.** Man könnte auch zählen, was ein
 * Leser als *ein* Zeichen sieht (`Intl.Segmenter`) — eine Familie aus vier
 * Figuren wäre dann eins. Das wäre eine dritte Zählung und wieder eine andere
 * als die der Datenbank. Massgebend ist, was die Schranke misst.
 */

/**
 * Zählt die Zeichen einer Zeichenkette so, wie Postgres `length()` sie zählt.
 *
 * Die Zerlegung über den Spreizoperator läuft über die Zeichen, nicht über die
 * UTF-16-Einheiten — genau der Unterschied, um den es geht.
 */
export function zeichenzahl(text: string): number {
	return [...text].length;
}
