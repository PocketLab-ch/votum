/**
 * Gegentest zum Wächter «Versammlungszustand».
 *
 * Er prüft dreierlei, und der dritte Punkt ist der wichtigste:
 *
 *   - dass der Wächter den **schlechten** Zustand findet,
 *   - dass er den **guten** in Ruhe lässt,
 *   - dass er einen **Abstimmungsdurchgang** nicht anfasst. Ein Durchgang kennt
 *     kein `versiegelt`; meldete der Wächter dort, würde er abgeschaltet statt
 *     gelesen, und dann bewacht er gar nichts mehr.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPT = join(process.cwd(), 'scripts', 'check-versammlungszustand.mjs');
const verzeichnisse: string[] = [];

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

function baumMit(inhalt: string, name = 'probe.ts'): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'zustandswaechter-'));
	verzeichnisse.push(wurzel);
	const ziel = join(wurzel, 'src', 'lib', 'server');
	mkdirSync(ziel, { recursive: true });
	writeFileSync(join(ziel, name), inhalt, 'utf8');
	return wurzel;
}

afterAll(() => {
	for (const v of verzeichnisse) rmSync(v, { recursive: true, force: true });
});

describe('findet den schlechten Zustand', () => {
	it('meldet einen Vergleich, der «versiegelt» übersieht', () => {
		const { rot, ausgabe } = fahre(
			baumMit("if (versammlung.zustand === 'geschlossen') { zeigeAuswertung(); }\n")
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/versiegelt/);
	});

	it('meldet auch die verneinte Form', () => {
		const { rot } = fahre(baumMit("if (versammlung.zustand !== 'geschlossen') return null;\n"));
		expect(rot).toBe(true);
	});
});

describe('lässt den guten Zustand in Ruhe', () => {
	it('schweigt, wenn «versiegelt» in derselben Zeile mitkommt', () => {
		const { rot } = fahre(
			baumMit(
				"const fertig = versammlung.zustand === 'geschlossen' || versammlung.zustand === 'versiegelt';\n"
			)
		);
		expect(rot).toBe(false);
	});

	it('schweigt, wenn die Bedingung umgebrochen ist', () => {
		const { rot } = fahre(
			baumMit(
				[
					'const fertig =',
					"\tversammlung.zustand === 'geschlossen' ||",
					"\tversammlung.zustand === 'versiegelt';",
					''
				].join('\n')
			)
		);
		expect(rot).toBe(false);
	});

	it('lässt sich nicht von einem «versiegelt» aus einer fremden Zeile entschärfen', () => {
		/*
		 * **Aus dem Code-Review** (04.09.2026). Vorher genügte irgendein
		 * `'versiegelt'` in der Nachbarzeile, auch aus einer ganz anderen
		 * Anweisung. Jetzt muss die erste Zeile offen enden, damit die zweite als
		 * Fortsetzung derselben Bedingung gilt.
		 */
		const { rot } = fahre(
			baumMit(
				[
					"if (versammlung.zustand === 'geschlossen') return;",
					"const andere = zeile.state === 'versiegelt';",
					''
				].join('\n')
			)
		);
		expect(rot).toBe(true);
	});

	it('schweigt bei einer begründeten Ausnahme', () => {
		const { rot } = fahre(
			baumMit(
				[
					'// zustand-nur-geschlossen: Hier geht es um den Schritt VOR dem Siegel.',
					"if (versammlung.zustand !== 'geschlossen') return;",
					''
				].join('\n')
			)
		);
		expect(rot).toBe(false);
	});

	it('nimmt die Ausnahme auch aus einem mehrzeiligen Kommentar', () => {
		const { rot } = fahre(
			baumMit(
				[
					'// zustand-nur-geschlossen: Genau der Zwischenzustand ist gemeint,',
					'// die versiegelte fängt der Zweig darüber ab.',
					"if (versammlung.zustand === 'geschlossen') return;",
					''
				].join('\n')
			)
		);
		expect(rot).toBe(false);
	});
});

describe('fasst Abstimmungsdurchgänge nicht an', () => {
	it('schweigt beim Zustand eines Durchgangs', () => {
		/*
		 * Ein Durchgang hat vier Zustände und kein `versiegelt`. Der Vergleich ist
		 * dort richtig, und ein Wächter, der ihn meldet, erzeugt Lärm statt
		 * Sicherheit.
		 */
		const { rot } = fahre(
			baumMit("const e = durchgang.zustand === 'geschlossen' ? await holeErgebnis() : null;\n")
		);
		expect(rot).toBe(false);
	});

	it('schweigt auch bei der üblichen Kurzform', () => {
		const { rot } = fahre(baumMit("if (d.zustand !== 'geschlossen') return null;\n"));
		expect(rot).toBe(false);
	});
});

describe('am echten Baum', () => {
	it('ist im Bestand grün', () => {
		/*
		 * Ein Wächter, der nur gegen ausgedachte Schnipsel läuft, kann an den
		 * wirklichen Dateien vorbeigreifen — etwa an Tabulatoren oder an
		 * Svelte-Vorlagen.
		 */
		const { rot, ausgabe } = fahre(process.cwd());
		expect(rot, ausgabe).toBe(false);
	});
});
