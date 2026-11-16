/**
 * Der Wächter über den Textwächter: die Mechanik der Ausnahmeliste und die
 * sechste Bauform «Satzfunktion».
 *
 * **Warum es diesen Test gibt.** `scripts/check-texte.mjs` misst die Satzlänge
 * über sechs Bauformen. Die Ausnahmeliste `scripts/texte-ausnahmen.tsv` hält
 * lange Bestandssätze fest; ihre Mechanik (unbenutzt, zu lang, zu kurzer oder
 * doppelter Anfang) war nur von Hand gegengeprüft. Und die sechste Bauform
 * (Rückgabewerte von Satzfunktionen) brauchte einen Gegentest, der zeigt, dass
 * ein zu langer Satz aus einer Funktion rot wird.
 *
 * Der Wächter hat Untergrenzen; deshalb fährt der Test über einen Wegwerfbaum,
 * und `fahreWaechter` setzt `VERSAMMLUNG_REISSLEINE=aus`, damit die
 * Untergrenzen die Regel nicht überdecken.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fahreWaechter } from './waechterlauf';

const SKRIPT = join(process.cwd(), 'scripts', 'check-texte.mjs');
const BAEUME: string[] = [];

afterAll(() => {
	for (const b of BAEUME) rmSync(b, { recursive: true, force: true });
});

/** Ein Wegwerfbaum mit Ausnahmeliste, Jargon-Ausnahmen und den genannten Dateien. */
function baum(dateien: Record<string, string>, ausnahmen: string[], jargon: string[] = []): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'texte-'));
	BAEUME.push(wurzel);
	mkdirSync(join(wurzel, 'src'), { recursive: true });
	mkdirSync(join(wurzel, 'scripts'), { recursive: true });
	writeFileSync(
		join(wurzel, 'scripts', 'texte-ausnahmen.tsv'),
		`# Ausnahmeliste für den Gegentest\n${ausnahmen.join('\n')}\n`,
		'utf8'
	);
	writeFileSync(
		join(wurzel, 'scripts', 'texte-jargon-ausnahmen.tsv'),
		`# Jargon-Ausnahmen für den Gegentest\n${jargon.join('\n')}\n`,
		'utf8'
	);
	for (const [pfad, inhalt] of Object.entries(dateien)) {
		const ziel = join(wurzel, pfad);
		mkdirSync(join(ziel, '..'), { recursive: true });
		writeFileSync(ziel, inhalt, 'utf8');
	}
	return wurzel;
}

/** Ein Satz, der die Satzgrenze von 180 Zeichen sicher überschreitet. */
const LANGER_SATZ =
	'Ein Satz, der die Grenze von einhundertachtzig Zeichen sicher überschreitet, weil er absichtlich ' +
	'so lang geschrieben ist, dass der Wächter ihn anstreichen muss und nicht übersehen kann, und er geht ' +
	'noch ein gutes Stück weiter, damit die Länge zweifelsfrei über der Grenze liegt.';

const ANFANG = LANGER_SATZ.slice(0, 40);

describe('Die Ausnahmeliste', () => {
	it('wird rot bei einer unbenutzten Ausnahme', () => {
		// Kein zu langer Satz im Baum: Jede Ausnahme ist unbenutzt.
		const lauf = fahreWaechter(
			SKRIPT,
			baum({ 'src/a.ts': "export const kurz = 'Ein kurzer Satz.';\n" }, [
				`src/a.ts\t${ANFANG}\t${LANGER_SATZ.length}\tGrund`
			])
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('deckt keinen langen Satz mehr');
	});

	it('wird rot bei einer zu langen Ausnahme (der Satz ist länger als die Zahl)', () => {
		// Der Satz ist länger als die in der Liste festgehaltene Länge: Die
		// Ausnahme deckt ihn nicht mehr.
		const lauf = fahreWaechter(
			SKRIPT,
			baum({ 'src/a.ts': `export const lang = '${LANGER_SATZ}';\n` }, [
				`src/a.ts\t${ANFANG}\t181\tGrund`
			])
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('deckt keinen langen Satz mehr');
	});

	it('wird rot bei einer zu kurzen Ausnahme (Anfang unter 40 Zeichen)', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum({ 'src/a.ts': "export const kurz = 'Ein kurzer Satz.';\n" }, [
				'src/a.ts\tKurzer Anfang\t200\tGrund'
			])
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('mindestens 40 Zeichen');
	});

	it('wird rot bei einer doppelten Ausnahme (zwei Anfänge beginnen gleich)', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum({ 'src/a.ts': "export const kurz = 'Ein kurzer Satz.';\n" }, [
				`src/a.ts\t${ANFANG}\t200\tGrund`,
				`src/a.ts\t${ANFANG} und noch mehr\t210\tGrund`
			])
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('beginnen gleich');
	});
});

describe('Die Satzfunktions-Bauform', () => {
	it('streicht einen zu langen Satz aus einer Satzfunktion an', () => {
		// Die exportierte Konstante deckt die eine Ausnahme (damit sie nicht
		// «unbenutzt» rot wird); der zu lange Satz der Satzfunktion steht
		// ausserhalb und wird angestrichen.
		const konstant = LANGER_SATZ;
		const rueckgabe =
			'Diese Funktion gibt einen Satz zurück, der die Grenze von einhundertachtzig Zeichen ' +
			'deutlich überschreitet, weil er erst in der Funktion selbst zusammengesetzt wird und der ' +
			'Wächter ihn nun zum ersten Mal misst und anstreicht.';
		const quelle = [
			`export const KONSTANT = '${konstant}';`,
			'',
			'export function hinweis(x: boolean): string {',
			`	return ('${rueckgabe.slice(0, 120)}' + '${rueckgabe.slice(120)}');`,
			'}'
		].join('\n');
		const ausnahmen = [`src/a.ts\t${konstant.slice(0, 40)}\t${konstant.length}\tGrund`];
		const lauf = fahreWaechter(SKRIPT, baum({ 'src/a.ts': `${quelle}\n` }, ausnahmen));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('src/a.ts');
		// Der Befund ist der zu lange Satz, nicht eine unbenutzte Ausnahme.
		expect(lauf.ausgabe).not.toContain('deckt keinen langen Satz mehr');
	});
});

describe('Die Jargon-Ausnahme', () => {
	// Die Jargon-Ausnahme deckt nur das genannte Jargonwort in dem Satz mit dem
	// genannten Anfang. Ein unbenutzter Eintrag ist rot, immer, auch im
	// Wegwerfbaum; ein zweites Jargonwort im Satz und dasselbe Wort in einem
	// anderen Satz bleiben angestrichen.
	const ANFANG = 'Der Stimmberechtigtenstand und die Momentauf';

	it('wird rot bei einer unbenutzten Jargon-Ausnahme', () => {
		const konstant = LANGER_SATZ;
		const ausnahmen = [`src/a.ts\t${konstant.slice(0, 40)}\t${konstant.length}\tGrund`];
		const jargon = [`src/a.ts\t${ANFANG}\tStimmberechtigtenstand\tGrund`];
		const lauf = fahreWaechter(
			SKRIPT,
			baum({ 'src/a.ts': `export const KONSTANT = '${konstant}';\n` }, ausnahmen, jargon)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('deckt kein Jargonwort mehr');
	});

	it('streicht ein zweites Jargonwort im selben Satz an', () => {
		const konstant = LANGER_SATZ;
		const rueckgabe = 'Der Stimmberechtigtenstand und die Momentaufnahme fehlen.';
		const quelle = [
			`export const KONSTANT = '${konstant}';`,
			'',
			'export function f(): string {',
			`	return '${rueckgabe}';`,
			'}'
		].join('\n');
		const ausnahmen = [`src/a.ts\t${konstant.slice(0, 40)}\t${konstant.length}\tGrund`];
		const jargon = [`src/a.ts\t${ANFANG}\tStimmberechtigtenstand\tGrund`];
		const lauf = fahreWaechter(SKRIPT, baum({ 'src/a.ts': `${quelle}\n` }, ausnahmen, jargon));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('Momentaufnahme');
		expect(lauf.ausgabe).not.toContain('«Stimmberechtigtenstand»');
	});

	it('streicht dasselbe Wort in einem anderen Satz derselben Datei an', () => {
		const quelle = [
			'export function f(x: boolean): string {',
			"	if (x) return 'Der Stimmberechtigtenstand und die Momentaufnahme fehlen.';",
			"	return 'Ohne Stimmberechtigtenstand geht es nicht weiter.';",
			'}'
		].join('\n');
		const jargon = [`src/a.ts\t${ANFANG}\tStimmberechtigtenstand\tGrund`];
		const konstant = LANGER_SATZ;
		const ausnahmen = [`src/a.ts\t${konstant.slice(0, 40)}\t${konstant.length}\tGrund`];
		const datei = `export const KONSTANT = '${konstant}';\n\n${quelle}\n`;
		const lauf = fahreWaechter(SKRIPT, baum({ 'src/a.ts': datei }, ausnahmen, jargon));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('«Stimmberechtigtenstand»');
	});
});
