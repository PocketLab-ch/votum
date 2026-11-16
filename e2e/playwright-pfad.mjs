/**
 * Woher die Drehbücher Playwright nehmen.
 *
 * Das Repo bringt Playwright nicht mit; am Wirt liegt es in einer anderen
 * Arbeitskopie. Welche das ist, ist eine Belegung des Hosts und steht deshalb
 * nicht hier, sondern in der Betriebsdoku des Dienstes. `PLAYWRIGHT_PFAD` nennt
 * das Paketverzeichnis; ohne die Variable gilt das Paket `playwright`, wie
 * Node es von `e2e/` aus findet.
 *
 * Findet Node es nicht, bricht der Lauf hier mit einer Absage ab, die die
 * Variable nennt, statt später mit «Cannot find module».
 */
import { createRequire } from 'node:module';

export function playwrightPfad() {
	const pfad = process.env.PLAYWRIGHT_PFAD ?? 'playwright';
	try {
		createRequire(import.meta.url).resolve(pfad);
	} catch {
		console.error(
			`Playwright ist unter «${pfad}» nicht zu finden. PLAYWRIGHT_PFAD auf das ` +
				'Paketverzeichnis von Playwright setzen, etwa PLAYWRIGHT_PFAD=<pfad>/node_modules/playwright; ' +
					'wo es am Dev-Host liegt, steht in der Betriebsdoku des Dienstes.'
		);
		process.exit(2);
	}
	return pfad;
}
