/**
 * Etwas ins Sichtfeld holen, ohne unter die klebende Kopfleiste zu geraten.
 *
 * ## Warum das an einer Stelle steht
 *
 * Zwei Dinge stellen dieselbe Frage: Eine Absage holt sich selbst ins Bild
 * (`Meldung.svelte`, seit 27.08.2026), und seit dem 06.09.2026 zeigt die
 * Sitzungsleitungssicht die eben aufgenommene Zeile. Beide müssen wissen,
 * wie weit von oben die Leiste die Sicht verdeckt — und beide dürfen nicht
 * rollen, wenn das Ziel ohnehin schon dasteht.
 *
 * Die Rechnung zweimal zu schreiben hiesse, sie beim nächsten Umbau der
 * Kopfleiste einmal nachzuziehen und einmal zu vergessen.
 */

/**
 * Wie weit von oben eine klebende Leiste die Sicht verdeckt.
 *
 * **Geprüft, ob sie wirklich klebt.** Ein erster Anlauf nahm einfach das
 * erste `<header>` des Dokuments. Die Saalsichten (`/p`, die Präsentation)
 * haben keine klebende Leiste, wohl aber eine eigene Kopfzeile, die mitrollt:
 * Deren Unterkante ist nach dem Rollen negativ, und das Ziel wäre um genau
 * diesen Betrag zu weit gerollt worden.
 *
 * **Gemessen statt geschätzt**: Die Höhe steht zwar als `--kopf-hoehe` in
 * `app.css`, die Leiste bricht auf schmalen Geräten aber um und wird dann
 * höher als der Wert. Eine zweite Zahl für dieselbe Leiste wäre die, die beim
 * nächsten Umbruch nicht mitwandert.
 */
export function klebendeKante(): number {
	const leiste = document.querySelector('header');
	if (!leiste) return 0;
	const lage = getComputedStyle(leiste).position;
	if (lage !== 'sticky' && lage !== 'fixed') return 0;
	return Math.max(0, leiste.getBoundingClientRect().bottom);
}

/**
 * Rollt so weit, dass `element` unter der Kopfleiste sichtbar wird.
 *
 * Steht es bereits ganz im Bild, geschieht nichts: Wer gerade liest, soll
 * nicht dafür bestraft werden, dass im Hintergrund etwas eingetroffen ist.
 *
 * **Gerechnet statt `scrollIntoView`**, weil dieses die klebende Leiste nicht
 * mitrechnet und das Ziel darunter schöbe.
 */
export function rolleInsBild(element: Element, abstand = 8): void {
	const r = element.getBoundingClientRect();
	const oben = klebendeKante();
	if (r.top >= oben && r.bottom <= window.innerHeight) return;
	window.scrollBy({ top: r.top - oben - abstand, behavior: 'auto' });
}
