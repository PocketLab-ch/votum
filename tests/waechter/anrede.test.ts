/**
 * Der Wächter über den Anrede-Wächter: Du-Formen in Zeichenketten und
 * Svelte-Text, nicht in Kommentaren, und die Mechanik der Ausnahmeliste.
 *
 * **Warum es ihn gibt** (Entscheid 0034). Die Oberfläche redet mit «Sie»; «du»
 * gehört nur in die Aufträge an das Sprachmodell. Der Wächter liest wie
 * `check-umlaute` nur Zeichenketten und Svelte-Text, nicht Kommentare. Die vier
 * Auftragsdateien stehen auf der Ausnahmeliste; ein unbenutzter Eintrag ist rot.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fahreWaechter } from './waechterlauf';

const SKRIPT = join(process.cwd(), 'scripts', 'check-anrede.mjs');
const BAEUME: string[] = [];

afterAll(() => {
	for (const b of BAEUME) rmSync(b, { recursive: true, force: true });
});

/** Ein Wegwerfbaum mit Ausnahmeliste und den genannten Dateien. */
function baum(dateien: Record<string, string>, ausnahmen: string[]): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'anrede-'));
	BAEUME.push(wurzel);
	mkdirSync(join(wurzel, 'src'), { recursive: true });
	mkdirSync(join(wurzel, 'scripts'), { recursive: true });
	writeFileSync(
		join(wurzel, 'scripts', 'anrede-ausnahmen.tsv'),
		`# Ausnahmeliste für den Gegentest\n${ausnahmen.join('\n')}\n`,
		'utf8'
	);
	for (const [pfad, inhalt] of Object.entries(dateien)) {
		const ziel = join(wurzel, pfad);
		mkdirSync(join(ziel, '..'), { recursive: true });
		writeFileSync(ziel, inhalt, 'utf8');
	}
	return wurzel;
}

/** Ein Auftrag, der die Ausnahme trägt und sie damit «benutzt» macht. */
const AUFTRAG = "export const auftrag = 'Bist du sicher, dass du das meinst?';\n";
const AUFTRAGS_DATEI = 'src/auftrag.ts';
const AUSNAHME = [`${AUFTRAGS_DATEI}\tAuftrag an das Sprachmodell`];

describe('Der Anrede-Wächter', () => {
	it('wird rot bei einer Du-Form in einer Zeichenkette ausserhalb der Ausnahmen', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/prosa.ts': "export const satz = 'Was möchtest du damit sagen?';\n"
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('src/prosa.ts');
	});

	it('wird rot bei einer Du-Form im Svelte-Text ausserhalb der Ausnahmen', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/Seite.svelte': '<p>Was möchtest du damit sagen?</p>\n'
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('src/Seite.svelte');
	});

	it('lässt dieselbe Form im Kommentar in Ruhe', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/prosa.ts': '// Was möchtest du damit sagen?\nexport const x = 1;\n'
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(false);
	});

	it('wird rot bei einem unbenutzten Ausnahmeeintrag', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum({ 'src/prosa.ts': 'export const x = 1;\n' }, ['src/prosa.ts\tAuftrag an das Sprachmodell'])
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('deckt keine Du-Form mehr');
	});
});

describe('Das Svelte-Markup', () => {
	// Auch Attributwerte und Zeichenketten in `{…}`-Ausdrücken stehen auf dem
	// Bildschirm; ein Wächter, der nur zwischen den Marken liest, liesse sie
	// grün durch. Jeder Fall trägt eine Zeilennummer.

	it('wird rot bei einer Du-Form in einem Attributwert', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/Seite.svelte': '<input placeholder="Gib deine Nummer ein" />\n'
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toMatch(/src\/Seite\.svelte:\d+/);
		expect(lauf.ausgabe).toContain('svelte-attr');
	});

	it('wird rot bei einer Du-Form in einem Ternär im Markup', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/Seite.svelte': '<p>{x ? \'Willst du speichern?\' : \'nein\'}</p>\n'
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toMatch(/src\/Seite\.svelte:\d+/);
		expect(lauf.ausgabe).toContain('svelte-ausdruck');
	});

	it('wird rot bei einer Du-Form in einem {\'…\'} im Markup', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/Seite.svelte': "<p>{'Was möchtest du?'}</p>\n"
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toMatch(/src\/Seite\.svelte:\d+/);
		expect(lauf.ausgabe).toContain('svelte-ausdruck');
	});

	it('lässt dieselbe Form in einem HTML-Kommentar in Ruhe', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/Seite.svelte': '<!-- Was möchtest du damit sagen? -->\n<p>Hinweis</p>\n'
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(false);
	});

	it('liest einen sichtbaren Markup-Text mit echter Zeilennummer', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum(
				{
					[AUFTRAGS_DATEI]: AUFTRAG,
					'src/Seite.svelte': '<p>Was möchtest du damit sagen?</p>\n'
				},
				AUSNAHME
			)
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toMatch(/src\/Seite\.svelte:\d+/);
	});
});
