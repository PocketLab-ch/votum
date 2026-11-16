/**
 * Kurznamen für die Wand.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Die Sicht Beschlussfähigkeit braucht es
 * nicht in dieser Grösse auf dem Monitor. […] Minimalistisch halten. Mit Zahlen
 * und Kurzform der STWEG.»
 *
 * Ein Gemeinschaftsname trägt oft Zusätze in Klammern — «(Umgebung)»,
 * «(Prüflauf 20260823202200)», «(neu)». Im Saal erklären sie nichts: Wer dort
 * sitzt, weiss, in welchem Haus er wohnt. An der Wand kosten sie die Hälfte der
 * Zeile.
 *
 * **Die Zusätze fallen nur weg, solange die Namen unterscheidbar bleiben.** Bei
 * «Nirgendweg 5/5a» und «Nirgendweg 5/5a (Umgebung)» steckt der ganze
 * Unterschied in der Klammer — sie dort zu streichen, machte aus zwei
 * Gemeinschaften zwei gleich beschriftete Spalten, und im Saal rechnete jemand
 * die Zahlen des Nachbarhauses auf seine eigene Abstimmung an. Dann bleiben
 * alle Namen ungekürzt: lieber lang und richtig als kurz und verwechselbar.
 */

/** Alles ab dem ersten Klammerzusatz weg, Leerraum getrimmt. */
function ohneZusaetze(name: string): string {
	const gekuerzt = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
	// Ein Name, der NUR aus Klammern besteht, verschwände sonst ganz.
	return gekuerzt || name.trim();
}

/**
 * Die Kurznamen zu einer Liste von Gemeinschaftsnamen — in derselben
 * Reihenfolge.
 *
 * Gekürzt wird alles oder nichts: Eine Wand, auf der ein Haus seinen Zusatz
 * behält und das andere nicht, sieht aus, als wäre der Zusatz eine Auszeichnung.
 */
export function kurznamen(namen: string[]): string[] {
	const gekuerzt = namen.map(ohneZusaetze);
	const bleibenVerschieden = new Set(gekuerzt).size === new Set(namen).size;
	return bleibenVerschieden ? gekuerzt : namen.map((n) => n.trim());
}
