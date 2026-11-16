import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Die Seite der Lesarten hat genau zwei Aktionen.
 *
 * **Der Anlass** (Codeprüfung Lesarten, Teil 2, 20.10.2026). Der Rollenwächter
 * nimmt `/gemeinschaften/<id>/lesarten` von der Sperre für die Sitzungsleitung
 * aus (`rollen.ts`), ohne Unterseiten. Eine dritte Aktion auf derselben Seite
 * stünde aber still mit offen, denn der Wächter kennt nur Pfade. Die zwei, die
 * dort stehen dürfen: `lesarten` (prüft Rolle und Erlaubnis selbst) und
 * `nachziehen` (setzt Erfordernisse, was die Sitzungsleitung je Traktandum
 * ohnehin darf). Wer eine dritte hinzufügt, wird hier rot und entscheidet
 * bewusst, ob die Sitzungsleitung sie darf.
 *
 * Gelesen wird der Quelltext, nicht das Modul: Es bindet die Datenbank ein.
 */

const WURZEL = process.cwd();

/** Die Schlüssel des Objekts `actions` auf oberster Ebene, ohne Kommentare. */
function aktionenIn(datei: string): string[] {
	const roh = readFileSync(join(WURZEL, datei), 'utf8');
	const ohne = roh.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, '');
	const anfang = ohne.indexOf('export const actions');
	if (anfang < 0) return [];
	const rumpf = ohne.slice(anfang);
	return [...rumpf.matchAll(/^\t([A-Za-z_$][\w$]*)\s*:\s*async\b/gm)].map((m) => m[1]);
}

/**
 * Jede andere Schreibweise einer Aktion auf oberster Ebene des Objekts:
 * Methode, `async`-Methode, Verweis, Kurzform, Spread. Sieht der Leser oben sie
 * nicht, soll der Wächter trotzdem rot werden statt still grün (zweite
 * Codeprüfung Teil 2).
 */
function andereSchreibweisen(datei: string): string[] {
	const roh = readFileSync(join(WURZEL, datei), 'utf8');
	const ohne = roh.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, '');
	const anfang = ohne.indexOf('export const actions');
	if (anfang < 0) return [];
	const rumpf = ohne.slice(anfang, ohne.indexOf('\n};', anfang));
	return rumpf
		.split('\n')
		.slice(1)
		.filter((z) => /^\t\S/.test(z) && !/^\t[A-Za-z_$][\w$]*\s*:\s*async\b/.test(z))
		.filter((z) => !/^\t[}\]),]/.test(z));
}

describe('Wächter: die Seite der Lesarten öffnet der Sitzungsleitung nichts weiter', () => {
	it('liest an einer Bestandsdatei die richtigen Aktionen (Gegenprobe des Lesers)', () => {
		// Sonst wäre die Probe darunter grün, weil der Leser nichts findet.
		const bestand = aktionenIn('src/routes/gemeinschaften/[id=kennung]/beschlussfaehigkeit/+page.server.ts');
		expect(bestand).toEqual(['hinterlegen', 'aufheben']);
		const reglement = aktionenIn('src/routes/gemeinschaften/[id=kennung]/reglement/+page.server.ts');
		expect(reglement).toContain('universalversammlung');
		expect(reglement).toContain('lesartenrecht');
		expect(reglement.length).toBeGreaterThan(15);
	});

	it('hat genau die Aktionen lesarten und nachziehen', () => {
		const datei = 'src/routes/gemeinschaften/[id=kennung]/lesarten/+page.server.ts';
		expect(aktionenIn(datei)).toEqual(['lesarten', 'nachziehen']);
		expect(andereSchreibweisen(datei)).toEqual([]);
	});

	it('sähe eine Aktion in anderer Schreibweise (Gegenprobe am Bestand)', () => {
		// Die Seite der Beschlussfähigkeit schreibt beide als `name: async`; dort
		// darf der zweite Leser nichts finden, sonst schlüge er überall an.
		expect(
			andereSchreibweisen('src/routes/gemeinschaften/[id=kennung]/beschlussfaehigkeit/+page.server.ts')
		).toEqual([]);
	});

	it('hat keinen eigenen Endpunkt neben der Seite', () => {
		expect(() =>
			readFileSync(join(WURZEL, 'src/routes/gemeinschaften/[id=kennung]/lesarten/+server.ts'))
		).toThrow();
	});
});
