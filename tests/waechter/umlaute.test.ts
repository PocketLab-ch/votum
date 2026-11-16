/**
 * Der Wächter über den Umlaut-Wächter.
 *
 * **Warum es ihn gibt.** Eine Sperrklinke ist nur so viel wert wie ihre
 * Zählung: Findet sie die ASCII-Form nicht, ist sie grün und blind; zählt sie
 * Bezeichner, Dateinamen, Routen oder CSS-Klassen mit, wird sie zum
 * Dauerrauschen und abgeschaltet. Beides wird hier gemessen, dazu die
 * Richtung, auf die es ankommt: ein neuer Fund über der Obergrenze ist rot.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fahreWaechter } from './waechterlauf';

const SKRIPT = join(process.cwd(), 'scripts', 'check-umlaute.mjs');
const BAeUME: string[] = [];

const MUSTER = ['fuer', 'ueber', 'waere', 'muess', 'koenn', 'naechst', 'haeng', 'Aenderung', 'Pruef'];

function sperre(werte: Record<string, number> = {}): string {
	const zeilen = [
		'# Sperrliste für den Gegentest',
		...MUSTER.map((m) => `${m}\t${werte[m] ?? 0}`)
	];
	return `${zeilen.join('\n')}\n`;
}

/** Ein Wegwerfbaum mit Sperrdatei und den genannten Dateien. */
function baum(
	dateien: Record<string, string>,
	werte: Record<string, number> = {}
): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'umlaute-'));
	BAeUME.push(wurzel);
	mkdirSync(join(wurzel, 'scripts'), { recursive: true });
	mkdirSync(join(wurzel, 'src'), { recursive: true });
	mkdirSync(join(wurzel, 'docs'), { recursive: true });
	writeFileSync(join(wurzel, 'scripts', 'umlaut-sperre.tsv'), sperre(werte), 'utf8');
	for (const [pfad, inhalt] of Object.entries(dateien)) {
		const ziel = join(wurzel, pfad);
		mkdirSync(join(ziel, '..'), { recursive: true });
		writeFileSync(ziel, inhalt, 'utf8');
	}
	return wurzel;
}

afterAll(() => {
	for (const w of BAeUME) rmSync(w, { recursive: true, force: true });
});

describe('findet die ASCII-Form', () => {
	it('in einem Kommentar', () => {
		const w = baum({ 'src/probe.ts': '/** Das gilt fuer alle. */\n' });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('fuer');
		expect(e.ausgabe).toContain('src/probe.ts');
	});

	/*
	 * **Hinter einem Platzhalter und einer Regex** (Übernahme 20.10.2026): Ein
	 * roher Scanner ohne Parser verlor nach dem ersten `${…}` den Takt und sah
	 * gemessen 6438 Kommentare in 252 Dateien unter src/ nicht.
	 */
	it.each([
		['nach einem Platzhalter in einer Vorlage', 'const a = 1;\nexport const t = `x ${a} y`;\n'],
		['nach einer Regex', "export const r = 'abcd'.match(/.{2}/g);\n"],
		['am Ende der Datei', 'export const n = 1;\n']
	])('in einem Kommentar %s', (_fall, vorne) => {
		const w = baum({ 'src/probe.ts': `${vorne}/** Das gilt fuer alle. */\n` });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('src/probe.ts');
	});

	/*
	 * **Auch an Stellen ohne Knoten** (zweiter Durchgang der Codeprüfung,
	 * 20.10.2026): Ein Kommentar vor einem schliessenden `}`, in einem leeren
	 * Block oder vor einem `|` eines Union-Typs hängt an keinem Knoten, nur an
	 * einem Token; gemessen fehlten so 122 Kommentare im Bestand.
	 */
	it.each([
		['in einem leeren Block', 'export function f(a: boolean) {\n\tif (a) {\n\t\t// Das gilt fuer alle.\n\t}\n}\n'],
		['nach der letzten Eigenschaft', 'export const o = {\n\ta: 1\n\t// Das gilt fuer alle.\n};\n'],
		['in einem Union-Typ', "export type T =\n\t// Das gilt fuer alle.\n\t| 'a'\n\t| 'b';\n"]
	])('in einem Kommentar %s', (_fall, quelle) => {
		const w = baum({ 'src/probe.ts': quelle });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('src/probe.ts');
	});

	/*
	 * **Auch im Wortinnern** (Codeprüfung bei der Übernahme, 20.10.2026): Mit
	 * einer Wortgrenze vor dem Muster blieben «dafuer», «geprueft» und
	 * «unabhaengig» grün, gemessen 26 Stellen im Bestand.
	 */
	it.each(['dafuer', 'geprueft', 'unabhaengig', 'Reglementsaenderung'])(
		'im Wortinnern: %s',
		(wort) => {
			const w = baum({ 'src/probe.ts': `// Das ist ${wort} so.\n` });
			const e = fahreWaechter(SKRIPT, w);
			expect(e.rot).toBe(true);
			expect(e.ausgabe).toContain('src/probe.ts');
		}
	);

	it('in einem Svelte-Skript mit lang="ts"', () => {
		const w = baum({
			'src/probe.svelte':
				'<script lang="ts">\n\tlet a: Array<string> = [];\n\tconst t = `x ${a.length} y`;\n\t// Das gilt fuer alle.\n</script>\n'
		});
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('src/probe.svelte');
	});

	it('in einer Zeichenkette', () => {
		const w = baum({ 'src/probe.ts': "export const satz = 'Das gilt fuer alle.';\n" });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('fuer');
	});

	it('im Fliesstext einer Markdown-Datei', () => {
		const w = baum({ 'docs/probe.md': 'Das gilt fuer alle.\n' });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('docs/probe.md');
	});

	it('bleibt bei genau der Obergrenze grün', () => {
		const w = baum({ 'src/probe.ts': '/** Das gilt fuer alle. */\n' }, { fuer: 1 });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(false);
	});

	it('wird rot, wenn die Zahl unter die Obergrenze sinkt', () => {
		const w = baum({}, { fuer: 1 });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('gesunken');
	});
});

describe('liest das Svelte-Markup', () => {
	// Attributwerte und `{…}`-Ausdrücke liest der Umlaut-Wächter über
	// `leseSvelteMarkup` mit; den Fliesstext zwischen den Marken nicht (Kopf
	// von `scripts/check-umlaute.mjs`).

	it('findet die ASCII-Form in einem Attributwert', () => {
		const w = baum({ 'src/probe.svelte': '<input placeholder="Fuer alle" />\n' });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('fuer');
		expect(e.ausgabe).toContain('src/probe.svelte');
	});

	it('findet die ASCII-Form in einem {…}-Ausdruck', () => {
		const w = baum({ 'src/probe.svelte': "<p>{x ? 'Fuer alle' : 'nein'}</p>\n" });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('fuer');
		expect(e.ausgabe).toContain('src/probe.svelte');
	});
});

describe('lässt Bezeichner, Pfade und Klassen in Ruhe', () => {
	it('zählt weder camelCase noch Pfade, Dateinamen, Routen, URLs oder CSS-Klassen', () => {
		const quelle = [
			'/**',
			' * Siehe /pruefen und quellen/pruefung/bericht.md; die Klasse .fuer bleibt aussen.',
			' * Der Bezeichner naechsteSortierung und die Route /ueberholt sind keine Prosa.',
			' */',
			"export const pfad = '/pruefen';",
			"export const klasse = 'meldung fuer';",
			"export const url = 'https://example.ch/ueber';",
			"export const bezeichner = 'fuerPartei';"
		].join('\n');
		const w = baum({ 'src/probe.ts': `${quelle}\n` });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(false);
	});

	it('lässt Inline-Code in einer Markdown-Datei aussen vor', () => {
		const w = baum({ 'docs/probe.md': 'Das ist `fuer` Code, kein Fliesstext.\n' });
		const e = fahreWaechter(SKRIPT, w);
		expect(e.rot).toBe(false);
	});
});
