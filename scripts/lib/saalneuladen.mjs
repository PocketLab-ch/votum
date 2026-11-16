/**
 * Die Regel: In einer Seite dieser Anwendung wird nicht neu geladen.
 *
 * **Der Anlass, am 09.09.2026.** Die Saalsichten hielten sich mit
 * `location.reload()` frisch: die Wand, die gemeinsame Wand, die Anzeigeseite
 * und das Telefon des Eigentümers. Gemessen in einem eigenen Browserkontext:
 * Kippt das Netz **während** des Neuladens, ersetzt Chromium das Dokument durch
 * seine eigene Fehlerseite. Die Seite kommt nicht zurück, denn es gibt
 * niemanden mehr, der sie zurückholen könnte — das Skript, das den Strom hört,
 * ist mit dem Dokument weg. Und sie sagt es nicht einmal: Die Meldung
 * «Verbindung unterbrochen» gehörte zu der Seite, die es dann nicht mehr gibt.
 *
 * Im Saal heisst das eine tote Leinwand, auf dem Telefon eine Partei, die nicht
 * mehr abstimmen kann. Beides mitten in einer Versammlung, beides ohne
 * Fehlermeldung.
 *
 * **Warum eine ausnahmslose Regel und keine Liste von Ausnahmen.** Jede Seite
 * dieser Anwendung wird in einem fremden Haus über ein fremdes WLAN benutzt.
 * Es gibt keine, bei der ein Neuladen im falschen Augenblick folgenlos wäre,
 * und die Stellen, an denen es stand, hatten alle einen guten Grund — nur eben
 * denselben, der auch mit `invalidateAll()` erfüllt ist.
 *
 * Die Wege daneben:
 *   · `$lib/components/neuladen` — nachziehen, was der Strom nicht trägt, mit
 *     Bremse gegen die Endlosschleife.
 *   · `$lib/nachziehen` — nachziehen im Takt, ohne in eine laufende Navigation
 *     hinein.
 *
 * Wer das Neuladen wirklich braucht, ändert diese Regel und schreibt dazu,
 * warum die Fehlerseite dort hinnehmbar ist.
 *
 * **Was die Regel nicht sieht:** ein Neuladen über einen Umweg
 * (`window['location']['reload']()`, `location.href = location.href`). Sie
 * fängt die Bauform, die jemand beim Schreiben wählt, nicht die, die jemand
 * wählt, um an ihr vorbeizukommen.
 */

/**
 * Die Zeilen, in denen wirklich neu geladen wird.
 *
 * **Zeilenweise und nicht zeichenweise.** Ein Zeichenparser müsste in einer
 * `.svelte`-Datei auch Zeichenketten überspringen, und dort steht Fliesstext:
 * Ein Apostroph in «Max's» bringt ihn aus dem Takt, und ab da übersieht er,
 * was er finden soll. Das ist die falsche Seite zum Irren.
 *
 * **Und der Kommentar wird aus der Zeile geschnitten, nicht die Zeile
 * verworfen** (Code-Review 09.09.2026). Die erste Fassung erklärte jede Zeile
 * mit `/*` zum Kommentar; gemessen lieferte
 * `location.reload(); /* Grund *​/` damit **null** Treffer — ein falsches
 * Negativ, und der Kopfkommentar behauptete, das könne nicht vorkommen. Jetzt
 * bleibt vom Kommentar ein Loch, und was daneben steht, wird gelesen.
 *
 * @param {string} quelle
 * @param {string} [datei]
 * @returns {{ datei: string, zeile: number }[]}
 */
export function neuladestellen(quelle, datei = 'probe.svelte') {
	/** @type {{ datei: string, zeile: number }[]} */
	const treffer = [];
	let imBlock = false;

	quelle.split('\n').forEach((zeile, i) => {
		let rest = zeile;
		let sichtbar = '';

		for (;;) {
			if (imBlock) {
				const zu = rest.search(/\*\/|-->/);
				if (zu === -1) {
					rest = '';
					break;
				}
				rest = rest.slice(zu + (rest.slice(zu, zu + 3) === '-->' ? 3 : 2));
				imBlock = false;
				continue;
			}
			const zeilenkommentar = rest.indexOf('//');
			const blockAuf = rest.search(/\/\*|<!--/);
			if (blockAuf === -1 || (zeilenkommentar !== -1 && zeilenkommentar < blockAuf)) {
				sichtbar += zeilenkommentar === -1 ? rest : rest.slice(0, zeilenkommentar);
				rest = '';
				break;
			}
			sichtbar += rest.slice(0, blockAuf);
			rest = rest.slice(blockAuf + (rest.slice(blockAuf, blockAuf + 4) === '<!--' ? 4 : 2));
			imBlock = true;
		}

		if (/\blocation\s*\.\s*reload\s*\(/.test(sichtbar)) {
			treffer.push({ datei, zeile: i + 1 });
		}
	});

	return treffer;
}
