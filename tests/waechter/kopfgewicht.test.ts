/**
 * Gegentest zum Wächter «Kopfgewicht» (Lesarten Block 5, Kriterium 11).
 *
 * Ein Wegwerfbaum mit `src/lib/domain/eigentuemer.ts` und je einer Kopie des
 * Ausdrucks in den Schreibweisen, die der Wächter fangen soll, und Legitimes in
 * der Nähe eines `filter`, das er stehen lassen muss (Codeprüfung Block 5,
 * Runde 3, N1 und N2): Ein Wächter, der Legitimes meldet, wird abgeschaltet.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SKRIPT = join(process.cwd(), 'scripts', 'check-kopfgewicht.mjs');
const verzeichnisse: string[] = [];

const KERN = 'export function kopfgewicht(p, z, n) { return 1; }\n';

function baum(dateien: Record<string, string>): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'kopfgewicht-'));
	verzeichnisse.push(wurzel);
	for (const [pfad, inhalt] of Object.entries({ 'src/lib/domain/eigentuemer.ts': KERN, ...dateien })) {
		mkdirSync(dirname(join(wurzel, pfad)), { recursive: true });
		writeFileSync(join(wurzel, pfad), inhalt);
	}
	return wurzel;
}

afterAll(() => {
	for (const v of verzeichnisse) rmSync(v, { recursive: true, force: true });
});

describe('Wächter Kopfgewicht', () => {
	it('ist grün ohne Kopie', () => {
		expect(fahreWaechter(SKRIPT, baum({ 'src/lib/domain/a.ts': 'export const a = 1;\n' })).rot).toBe(false);
	});

	it.each([
		['per_unit mit Klammern', 'src/lib/domain/a.ts', 'const n = p.units.filter((u) => traegtKopfstimme(u, x)).length;'],
		['per_unit ohne Klammern', 'src/lib/server/b.ts', 'const n = e.filter(u => traegtKopfstimme(u, x)).length;'],
		['per_unit mit Bedingung', 'src/lib/domain/c.ts', 'const n = e.filter((u) => u.countsAsHead && traegtKopfstimme(u, x)).length;'],
		['per_unit mit Typangabe', 'src/lib/domain/f.ts', 'const n = e.filter((u: Einheit) => traegtKopfstimme(u, x)).length;'],
		['per_owner unter anderem Namen', 'src/routes/d/+server.ts', 'const k = e.einheiten.length > 0 ? 1 : 0;'],
		['in einer Svelte-Datei', 'src/routes/e/+page.svelte', '<p>{p.units.length > 0 ? 1 : 0}</p>'],
		['in server/eigentuemer.ts', 'src/lib/server/eigentuemer.ts', 'const k = units.length > 0 ? 1 : 0;']
	])('meldet die Kopie: %s', (_name, pfad, zeile) => {
		const lauf = fahreWaechter(SKRIPT, baum({ [pfad]: zeile + '\n' }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain(pfad.split('/').pop()!);
	});

	it.each([
		['die Schleife Einheit für Einheit', 'for (const u of p.units) { if (traegtKopfstimme(u, x)) zaehle(u); }'],
		['einen filter ohne Gewicht davor', '{#each xs.filter((u) => u.sichtbar) as e}\n{#if !traegtKopfstimme(e, n)}x{/if}'],
		['die Liste der Einheiten ohne Kopfstimme', 'const ohne = p.units.filter((u) => !traegtKopfstimme(u, n)).map((u) => u.label);'],
		['filter und traegtKopfstimme auf zwei Zeilen', 'const a = { b: xs.filter((u) => u.ok),\n c: ys.some((u) => traegtKopfstimme(u, n)) }']
	])('lässt %s stehen', (_name, zeile) => {
		expect(fahreWaechter(SKRIPT, baum({ 'src/routes/x/+page.svelte': zeile + '\n' })).rot).toBe(false);
	});

	it('bricht ab, wenn es nichts zu prüfen gibt', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'kopfgewicht-'));
		verzeichnisse.push(wurzel);
		mkdirSync(join(wurzel, 'src', 'lib', 'domain'), { recursive: true });
		writeFileSync(join(wurzel, 'src/lib/domain/eigentuemer.ts'), KERN);
		const lauf = fahreWaechter(SKRIPT, wurzel);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('keine Datei zu prüfen');
	});

	it('bricht ab, wenn kopfgewicht fehlt', () => {
		const wurzel = baum({});
		writeFileSync(join(wurzel, 'src/lib/domain/eigentuemer.ts'), 'export const x = 1;\n');
		expect(fahreWaechter(SKRIPT, wurzel).rot).toBe(true);
	});
});
