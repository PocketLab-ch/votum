import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechterIn } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Häkchenwächter (`scripts/check-haken.mjs`).
 *
 * **Warum er nachträglich entsteht.** Der Wächter läuft seit dem 25.08.2026 und
 * hatte keinen. Er arbeitet mit vier regulären Ausdrücken über Quelltext; greift
 * einer daneben, findet er nichts und meldet grün. Seine eingebaute Sichtprobe
 * («mindestens drei Paarungen») fängt den Totalausfall, nicht den halben — ein
 * Ausdruck, der versteckte Felder verliert und Kästchen behält, bliebe
 * unbemerkt.
 *
 * Am 10.09.2026 kam die Prüfung versteckter Felder dazu. Genau dieser Schritt
 * ist der Anlass: Er hätte sich ohne Gegentest nicht messen lassen.
 *
 * **Der Wächter kennt keine Wurzel als Argument** und sieht immer auf
 * `process.cwd()`. Deshalb `fahreWaechterIn` und nicht `fahreWaechter`; wer ihm
 * einen Baum als Argument gäbe, bekäme einen Lauf über dem echten Repo und
 * damit ein Ergebnis, das mit der Probe nichts zu tun hat.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-haken.mjs');

const verzeichnisse: string[] = [];

/**
 * Ein Wegwerfbaum mit dem gegebenen Formular.
 *
 * **Die drei Musterpaare sind Pflicht, nicht Beiwerk.** Der Wächter bricht ab,
 * wenn er weniger als drei Paarungen findet — ein Baum mit nur dem Prüffall
 * liefe in diese Untergrenze und wäre rot, ohne dass die geprüfte Regel etwas
 * damit zu tun hätte. Sie stehen in jeder Probe, damit «rot» immer die Regel
 * meint.
 */
function baumMit(formular: string, leser = ''): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'haken-'));
	verzeichnisse.push(wurzel);
	mkdirSync(join(wurzel, 'src', 'routes'), { recursive: true });
	mkdirSync(join(wurzel, 'src', 'lib'), { recursive: true });
	writeFileSync(
		join(wurzel, 'src', 'routes', '+page.svelte'),
		`<form method="POST">
	<input type="checkbox" name="mustereins" value="true" />
	<input type="checkbox" name="musterzwei" value="true" />
	<input type="hidden" name="musterdrei" value="true" />
${formular}
</form>`,
		'utf8'
	);
	writeFileSync(
		join(wurzel, 'src', 'lib', 'lesen.ts'),
		`export function lies(daten: FormData) {
	return {
		eins: jaNein(daten.get('mustereins')),
		zwei: jaNein(daten.get('musterzwei')),
		drei: jaNein(daten.get('musterdrei'))${leser}
	};
}`,
		'utf8'
	);
	return wurzel;
}

function fahre(wurzel: string) {
	return fahreWaechterIn(SKRIPT, wurzel);
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('findet den schlechten Fall', () => {
	it('ein Kästchen schickt «ja» statt «true» — der Anlass von 2026-08-25', () => {
		const { rot, ausgabe } = fahre(
			baumMit(
				'\t<input type="checkbox" name="schwelle" value="ja" />',
				`,
		schwelle: jaNein(daten.get('schwelle'))`
			)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('Kästchen name="schwelle" schickt "ja"');
	});

	it('ein verstecktes Feld schickt «ja» statt «true»', () => {
		const { rot, ausgabe } = fahre(
			baumMit(
				'\t<input type="hidden" name="vermerk" value="ja" />',
				`,
		vermerk: jaNein(daten.get('vermerk'))`
			)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('verstecktes Feld name="vermerk" schickt "ja"');
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	it('Kästchen und verstecktes Feld mit «true»', () => {
		const { rot } = fahre(
			baumMit(
				'\t<input type="checkbox" name="gut" value="true" />\n' +
					'\t<input type="hidden" name="auchgut" value="true" />',
				`,
		gut: jaNein(daten.get('gut')),
		auchgut: jaNein(daten.get('auchgut'))`
			)
		);
		expect(rot).toBe(false);
	});

	it('«on» ist die Vorgabe des Browsers und geht durch', () => {
		const { rot } = fahre(
			baumMit(
				'\t<input type="checkbox" name="ohnewert" value="on" />',
				`,
		ohnewert: jaNein(daten.get('ohnewert'))`
			)
		);
		expect(rot).toBe(false);
	});

	it('ein Wert aus einem Ausdruck ist zur Prüfzeit unbekannt', () => {
		const { rot } = fahre(
			baumMit(
				'\t<input type="checkbox" name="mehrfach" value={eintrag.id} />',
				`,
		mehrfach: jaNein(daten.get('mehrfach'))`
			)
		);
		expect(rot).toBe(false);
	});

	it('ein Feld, das niemand mit jaNein liest, darf schicken was es will', () => {
		const { rot } = fahre(baumMit('\t<input type="hidden" name="weg" value="von_hand" />'));
		expect(rot).toBe(false);
	});
});

describe('der blinde Fleck', () => {
	/*
	 * **Die Mehrdeutigkeit ist der Preis für die versteckten Felder.** `bestaetigt`
	 * wird im Bestand zweimal mit `jaNein()` und fünfmal mit `text(…) === 'ja'`
	 * gelesen; ohne diese Regel meldete der Wächter vier richtige Felder als
	 * Fehler. Geprüft wird deshalb beides: dass er schweigt, und dass er sagt,
	 * worüber er schweigt.
	 */
	const zweiLesungen = `,
		doppelt: jaNein(daten.get('doppelt')),
		nochmal: text(daten.get('doppelt')) === 'ja'`;

	it('ein Name mit beiden Lesungen wird nicht beanstandet', () => {
		const { rot } = fahre(
			baumMit('\t<input type="hidden" name="doppelt" value="ja" />', zweiLesungen)
		);
		expect(rot).toBe(false);
	});

	it('und der Wächter nennt ihn im grünen Lauf', () => {
		const { ausgabe } = fahre(
			baumMit('\t<input type="hidden" name="doppelt" value="ja" />', zweiLesungen)
		);
		expect(ausgabe).toContain('Nicht entscheidbar');
		expect(ausgabe).toContain('doppelt');
	});
});

describe('die eigene Sichtprobe', () => {
	it('ohne eine einzige jaNein-Lesung meldet er sich selbst als blind', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'haken-leer-'));
		verzeichnisse.push(wurzel);
		mkdirSync(join(wurzel, 'src'), { recursive: true });
		writeFileSync(
			join(wurzel, 'src', '+page.svelte'),
			'<input type="checkbox" name="x" value="true" />',
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('immer grün');
	});
});
