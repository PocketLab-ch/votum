import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Die Zeile «Eingestellte Lesart» im Entscheidungsweg des Siegelpakets kommt
 * aus `lesartenZeileMitHerkunft`, nicht aus `wahlInWorten`.
 *
 * **Der Anlass** (Codeprüfung Block B, 13.11.2026). `wahlInWorten` hängt
 * «(Vorgabe)» nach dem heutigen Katalog an. Bei L4 ist seit Fassung
 * 2026-11-13 «qualifiziert» die Vorgabe; ein älteres Traktandum mit
 * «einfach» hätte im Siegelpaket «(Vorgabe)» getragen, obwohl es damals die
 * Vorgabe war. Der Domänentest misst die Funktion, nicht ihren Aufruf; das
 * misst dieser Wächter am Quelltext.
 */
const quelltext = readFileSync(join(process.cwd(), 'src/lib/server/siegel.ts'), 'utf8');
const zeilen = quelltext.split('\n');

describe('Siegelpaket: Zeile «Eingestellte Lesart»', () => {
	const treffer = zeilen
		.map((z, i) => ({ z, i }))
		.filter(({ z }) => z.includes('Eingestellte Lesart:') && !/^\s*(\/\/|\*)/.test(z));

	it('kommt genau einmal im Quelltext vor', () => {
		expect(treffer).toHaveLength(1);
	});

	it('wird mit lesartenZeileMitHerkunft gebaut, nicht mit wahlInWorten', () => {
		const { z, i } = treffer[0];
		const umgebung = [z, zeilen[i + 1] ?? ''].join('\n');
		expect(umgebung).toMatch(/lesartenZeileMitHerkunft\(/);
		expect(umgebung).not.toMatch(/wahlInWorten\(/);
	});
});

/**
 * Die Zeile zu L13 kommt aus `kopfzaehlweiseSiegelzeile`, die der Kerntest
 * misst, auch ihr Fehlen am Rückkommen (Codeprüfung Block C, Lauf 2, M-C).
 */
describe('Siegelpaket: Zeile zur Zählweise der Köpfe', () => {
	it('wird mit kopfzaehlweiseSiegelzeile gebaut, nicht im Quelltext zusammengesetzt', () => {
		expect(quelltext).toMatch(/kopfzaehlweiseSiegelzeile\(e\)/);
		expect(quelltext).not.toMatch(/Zählweise der Köpfe \(Lesart L13\)/);
	});
});
