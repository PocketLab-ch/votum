/**
 * Gegentest zum Wächter «Zeitzone».
 *
 * Der dritte Block ist der wichtigere: Ein Wächter, der bei jeder Zahl meldet,
 * wird abgeschaltet statt gelesen. `n.toLocaleString('de-CH')` formatiert
 * Tausendertrennzeichen und hat mit Zeit nichts zu tun.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPT = join(process.cwd(), 'scripts', 'check-zeitzone.mjs');
const verzeichnisse: string[] = [];

/**
 * Fährt den Wächter. Ein **Absturz** wirft, statt als Befund durchzugehen —
 * siehe `waechterlauf.ts`.
 */
function fahre(wurzel: string) {
	return fahreWaechter(SKRIPT, wurzel);
}

function baumMit(inhalt: string): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'zeitzonenwaechter-'));
	verzeichnisse.push(wurzel);
	const ziel = join(wurzel, 'src', 'lib');
	mkdirSync(ziel, { recursive: true });
	writeFileSync(join(ziel, 'probe.ts'), inhalt, 'utf8');
	return wurzel;
}

afterAll(() => {
	for (const v of verzeichnisse) rmSync(v, { recursive: true, force: true });
});

describe('findet Zeitangaben ohne Zone', () => {
	it('meldet einen Zeitpunkt ohne timeZone', () => {
		const { rot, ausgabe } = fahre(
			baumMit("const s = new Date(iso).toLocaleString('de-CH', { dateStyle: 'short' });\n")
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/Zeitzone/);
	});

	it('meldet auch ein blosses Datum', () => {
		const { rot } = fahre(baumMit("const t = new Date(wert).toLocaleDateString('de-CH');\n"));
		expect(rot).toBe(true);
	});

	it('sieht auch einen Empfänger mit innerer Klammer', () => {
		/*
		 * **Aus dem Code-Review** (04.09.2026). Die sparsame Fassung `[^)]*` brach
		 * bei `new Date(Date.UTC(…))` an der inneren Klammer ab und liess den
		 * Aufruf durch. Genau diese Form steht im Bestand.
		 */
		const { rot } = fahre(
			baumMit("const s = new Date(Date.UTC(2026, 7, 25)).toLocaleDateString('de-CH');\n")
		);
		expect(rot).toBe(true);
	});

	it('meldet eine Variable, deren Name auf einen Zeitpunkt zeigt', () => {
		const { rot } = fahre(baumMit("const s = versiegeltAm.toLocaleTimeString('de-CH');\n"));
		expect(rot).toBe(true);
	});
});

describe('lässt richtige Aufrufe in Ruhe', () => {
	it('schweigt, wenn timeZone dabeisteht', () => {
		const { rot } = fahre(
			baumMit("const s = new Date(iso).toLocaleString('de-CH', { timeZone: 'Europe/Zurich' });\n")
		);
		expect(rot).toBe(false);
	});

	it('schweigt auch bei mehrzeiligen Optionen', () => {
		const { rot } = fahre(
			baumMit(
				[
					"const s = new Date(iso).toLocaleString('de-CH', {",
					"\ttimeZone: 'Europe/Zurich',",
					"\tdateStyle: 'medium'",
					'});',
					''
				].join('\n')
			)
		);
		expect(rot).toBe(false);
	});
});

describe('lässt Zahlen in Ruhe', () => {
	it('schweigt bei einer Zahlformatierung', () => {
		/*
		 * `n.toLocaleString('de-CH')` macht aus 10000 «10’000». Ein Wächter, der
		 * das meldet, erzeugt Lärm statt Sicherheit und wird abgeschaltet.
		 */
		const { rot } = fahre(baumMit("function zahl(n: number) { return n.toLocaleString('de-CH'); }\n"));
		expect(rot).toBe(false);
	});

	it('schweigt bei einer Konstanten', () => {
		const { rot } = fahre(baumMit("const s = HOECHSTE_ZEILEN.toLocaleString('de-CH');\n"));
		expect(rot).toBe(false);
	});
});

describe('am echten Baum', () => {
	it('ist im Bestand grün', () => {
		const { rot, ausgabe } = fahre(process.cwd());
		expect(rot, ausgabe).toBe(false);
	});
});
