/**
 * Kleine Sprachhilfen für die Oberfläche.
 *
 * Nur, was an mehr als einer Stelle gebraucht wird und wo eine zweite Fassung
 * daneben auseinanderliefe. Fachliche Formulierungen gehören in die Domäne,
 * nicht hierher.
 */

/**
 * Wörter so verbinden, wie man sie spricht: «Anna und Beat», «Anna, Beat und
 * Cara».
 *
 * Ein blosses `join(' und ')` ergibt ab drei Einträgen «Anna und Beat und
 * Cara» — und drei Vollmachten sind an einer Versammlung nichts Besonderes.
 *
 * **Hierher gezogen am 06.09.2026** aus `routes/z/+page.svelte`, wo sie als
 * örtliche Funktion stand. Die Sitzungsleitung braucht dieselbe Verbindung für
 * die möglichen Eingriffe; eine zweite Fassung daneben wäre genau die Sorte
 * Verdopplung, die sich beim nächsten Sonderfall trennt.
 */
export function aufzaehlung(woerter: string[]): string {
	if (woerter.length <= 1) return woerter[0] ?? '';
	return `${woerter.slice(0, -1).join(', ')} und ${woerter[woerter.length - 1]}`;
}
