import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * **Eine hochgeladene Datei wird erst nach der Grössenprüfung gepuffert** (K1,
 * Sicherheitsdurchgang 09.10.2026).
 *
 * Gemeldet waren `anhaenge.ts` und `vollmacht.ts`; beim Nachsehen am
 * 15.10.2026 lasen vier weitere Ablagewege (`anwesenheit.ts` zweimal,
 * `nutzniessung.ts`, `betreiber.ts`) und der Zeitstempel auf `/pruefen` die
 * Datei ebenso ungeprüft ein. Der Hausweg ist `liesHochgeladene` in
 * `dateien.ts`. Wer `.arrayBuffer()` anderswo ruft, steht unten mit dem Grund,
 * warum seine Grenze vorher greift.
 */

const WURZEL = join(__dirname, '..', '..');

/**
 * Was eine Datei ganz in den Speicher holt. `.text()`, `.bytes()` und
 * `.stream()` nur ohne Argument: `archiv.ts` hat eine eigene Methode `bytes(…)`.
 * Nur `.ts` und `.js`, denn hochgeladen wird auf dem Server.
 */
const PUFFERN = /\.arrayBuffer\s*\(|\.(text|bytes|stream)\s*\(\s*\)/;

const AUSNAHMEN: Record<string, string> = {
	'src/lib/server/dateien.ts': '`liesHochgeladene` selbst, prüft `size` davor',
	'src/lib/server/zeitstempel.ts': 'Antwort des Zeitstempeldienstes, kein Upload',
	'src/routes/gemeinschaften/[id=kennung]/einspielen/+page.server.ts':
		'Abschlusspaket mit eigener Grenze, `alsBytes` prüft `size` davor',
	'src/routes/gemeinschaften/[id=kennung]/uebernahme/+page.server.ts':
		'`leseTabelle` prüft `size` davor',
	'src/routes/pruefen/+page.server.ts': 'Paket und Zeitstempel, beide mit `size` davor geprüft'
};

function dateien(verzeichnis: string): string[] {
	const treffer: string[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateien(pfad));
		else if (/\.(ts|js)$/.test(eintrag)) treffer.push(pfad);
	}
	return treffer;
}

function ohneKommentare(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Hochladen', () => {
	it('puffert ausserhalb der Ausnahmen nur über liesHochgeladene', () => {
		const befunde = dateien(join(WURZEL, 'src'))
			.map((datei) => relative(WURZEL, datei))
			.filter((pfad) => !(pfad in AUSNAHMEN))
			.filter((pfad) => PUFFERN.test(ohneKommentare(readFileSync(join(WURZEL, pfad), 'utf8'))));
		expect(befunde).toEqual([]);
	});

	it('jede Ausnahme gibt es noch, und sie ruft arrayBuffer', () => {
		// Sonst wüchse die Liste unbemerkt um Einträge, die nichts mehr decken.
		for (const pfad of Object.keys(AUSNAHMEN)) {
			expect(readFileSync(join(WURZEL, pfad), 'utf8'), pfad).toMatch(/\.arrayBuffer\s*\(/);
		}
	});
});
