/**
 * Gegentest zum Wächter «Wächternamen».
 *
 * **Der wichtigste Teil sind nicht die Befunde, sondern die Quellen.** Die
 * erste Fassung dieses Tests legte nur `src/*.ts` an. Ein Wächter, der ausser
 * `src/*.ts` nichts mehr liest, bestand sie vollständig grün und hätte über dem
 * echten Bestand vier Fünftel aller Nennungen verloren, darunter jeden Verweis
 * in einer `.svelte`-Datei (04.09.2026, aus dem Code-Review). Darum stellt
 * dieser Test **je Quellart einen Befund her** und verlangt, dass er gefunden
 * wird.
 *
 * Der zweite Teil sind die Reissleinen: Fällt eine Quelle aus, muss der Wächter
 * abbrechen statt «in Ordnung» zu melden.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPT = join(process.cwd(), 'scripts', 'check-waechternamen.mjs');
const verzeichnisse: string[] = [];

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

/**
 * Die Quellen mit ihren Untergrenzen, wie der Wächter sie verlangt.
 *
 * Absichtlich hier noch einmal aufgeschrieben statt aus dem Wächter importiert:
 * Ein Test, der seine Erwartung aus dem Prüfling bezieht, wandert mit jeder
 * Änderung mit und misst nichts mehr.
 */
const QUELLEN = [
	{ ordner: 'src', datei: 'a.ts', anzahl: 50, endung: '.ts' },
	{ ordner: 'e2e', datei: 'a.mjs', anzahl: 3, endung: '.mjs' },
	{ ordner: 'scripts', datei: 'a.mjs', anzahl: 10, endung: '.mjs' },
	{ ordner: 'docs', datei: 'a.md', anzahl: 3, endung: '.md' }
];

/**
 * Ein vollständiger Wegwerfbaum: alle Quellen erfüllt, ein vorhandener Wächter.
 *
 * `ohne` lässt eine Quelle leer, um ihre Reissleine zu prüfen; `dateien` legt
 * zusätzliche Dateien mit Inhalt an.
 */
function baum(dateien: Record<string, string> = {}, ohne?: string): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'waechternamen-'));
	verzeichnisse.push(wurzel);

	for (const q of QUELLEN) {
		mkdirSync(join(wurzel, q.ordner), { recursive: true });
		if (q.ordner === ohne) continue;
		for (let i = 0; i < q.anzahl; i += 1) {
			writeFileSync(join(wurzel, q.ordner, `f${i}${q.endung}`), '// leer\n');
		}
	}
	// Der vorhandene Wächter, auf den gültige Verweise zeigen.
	writeFileSync(join(wurzel, 'scripts', 'check-echt.mjs'), '// ein vorhandener Wächter\n');
	// Die flache Wurzel braucht zwei Dateien.
	if (ohne !== '.') {
		writeFileSync(join(wurzel, 'README.md'), '# Titel\n');
		writeFileSync(join(wurzel, 'eslint.config.js'), '// leer\n');
	}

	for (const [pfad, inhalt] of Object.entries(dateien)) {
		const voll = join(wurzel, pfad);
		mkdirSync(join(voll, '..'), { recursive: true });
		writeFileSync(voll, inhalt);
	}
	return wurzel;
}

afterAll(() => {
	for (const v of verzeichnisse) rmSync(v, { recursive: true, force: true });
});

describe('Wächter «Wächternamen» — er liest jede Quelle', () => {
	/*
	 * Je Quellart ein toter Verweis. Fällt einer dieser Fälle aus, liest der
	 * Wächter diese Art nicht mehr, und über dem echten Bestand verschwände ein
	 * Teil der Prüfmenge, ohne dass irgendetwas rot würde.
	 */
	const stellen: [string, string][] = [
		['src/fall.ts', '// bewacht von check-weg.mjs\n'],
		['src/Bau.svelte', '<!-- bewacht von check-weg.mjs -->\n<p>x</p>\n'],
		['e2e/fall.mjs', '// bewacht von check-weg.mjs\n'],
		['scripts/fall.mjs', '// bewacht von check-weg.mjs\n'],
		['docs/fall.md', 'Bewacht von `check-weg.mjs`.\n'],
		['README.md', '# Titel\n\nBewacht von `check-weg.mjs`.\n'],
		['eslint.config.js', '// bewacht von check-weg.mjs\n']
	];

	for (const [pfad, inhalt] of stellen) {
		it(`findet den toten Verweis in ${pfad}`, () => {
			const { rot, ausgabe } = fahre(baum({ [pfad]: inhalt }));
			expect(rot).toBe(true);
			expect(ausgabe).toContain('check-weg');
		});
	}
});

describe('Wächter «Wächternamen» — Reissleinen', () => {
	for (const q of QUELLEN) {
		it(`bricht ab, wenn «${q.ordner}» keine Dateien mehr liefert`, () => {
			const { rot, ausgabe } = fahre(baum({}, q.ordner));
			expect(rot).toBe(true);
			expect(ausgabe).toContain(q.ordner);
			expect(ausgabe).toContain('mindestens');
		});
	}

	it('bricht ab, wenn README.md fehlt, auch bei genug anderen Dateien', () => {
		/*
		 * Die Zahl allein sagt hier nichts: Konfigurationsdateien füllen die
		 * Schwelle, aber `README.md` trägt allein knapp ein Drittel aller
		 * Nennungen. Ihr Wegfall wäre unbemerkt geblieben.
		 */
		const wurzel = baum();
		rmSync(join(wurzel, 'README.md'));
		writeFileSync(join(wurzel, 'vite.config.ts'), '// leer\n');
		writeFileSync(join(wurzel, 'svelte.config.js'), '// leer\n');
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('README.md');
	});

	it('bricht ab, wenn die Wurzel unter die Dateizahl fällt', () => {
		// README.md bleibt liegen, damit hier wirklich die Zahlenschwelle misst
		// und nicht die Pflichtdatei aus dem Test darüber.
		const wurzel = baum();
		rmSync(join(wurzel, 'eslint.config.js'));
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('mindestens');
	});
});

describe('Wächter «Wächternamen» — was er in Ruhe lässt', () => {
	it('lässt einen vorhandenen Wächter durch', () => {
		expect(fahre(baum({ 'src/fall.ts': '// bewacht von `check-echt.mjs`\n' })).rot).toBe(false);
	});

	it('meldet die Kurzform eines längeren Namens', () => {
		// Keine Duldung: Genau so sieht der Umbenennungsfall aus, gegen den der
		// Wächter steht (`check-felder` → `check-felder-streng`).
		const { rot } = fahre(baum({ 'src/fall.ts': '// siehe check-ec für den Rest\n' }));
		expect(rot).toBe(true);
	});
});

describe('Wächter «Wächternamen» — die Ausnahmemarke', () => {
	it('achtet die Marke mit Grund in derselben Zeile', () => {
		const { rot } = fahre(
			baum({ 'src/fall.ts': '// waechtername-historisch: der alte Name ist hier Gegenstand. check-weg\n' })
		);
		expect(rot).toBe(false);
	});

	it('achtet die Marke im Kommentarblock darüber', () => {
		const { rot } = fahre(
			baum({
				'src/fall.ts':
					'/*\n * waechtername-historisch: der alte Name ist hier Gegenstand.\n *\n * Früher check-weg.\n */\n'
			})
		);
		expect(rot).toBe(false);
	});

	it('verwirft eine Marke ohne Begründung', () => {
		// Sonst wäre die Marke selbst ein Schutzschild ohne Inhalt.
		const { rot } = fahre(baum({ 'src/fall.ts': '// waechtername-historisch:\n// check-weg\n' }));
		expect(rot).toBe(true);
	});

	it('lässt eine Marke nicht über echten Code hinweg gelten', () => {
		const { rot } = fahre(
			baum({
				'src/fall.ts':
					'// waechtername-historisch: gilt nur für die Zeile darunter.\nconst x = 1;\n// check-weg\n'
			})
		);
		expect(rot).toBe(true);
	});

	it('lässt in Prosa den Absatz gelten, nicht nur Kommentarzeilen', () => {
		// In Markdown ist der Fliesstext zwischen Marke und Nennung genau die
		// Erklärung, um die es geht.
		const { rot } = fahre(
			baum({
				'docs/fall.md':
					'<!-- waechtername-historisch: der Absatz erklärt die Ablösung. -->\nDer frühere\nWächter `check-weg` ist aufgegangen in `check-echt`.\n'
			})
		);
		expect(rot).toBe(false);
	});

	it('lässt den toten Namen nicht als eigene Begründung durchgehen', () => {
		/*
		 * Sonst entschuldigte sich ein hinreichend langer Name selbst, und die
		 * Marke wäre wieder das leere Schutzschild, gegen das dieser Wächter steht
		 * (04.09.2026, aus dem zweiten Code-Review).
		 */
		const { rot } = fahre(
			baum({ 'src/fall.ts': '// waechtername-historisch: check-weg-mit-sehr-langem-namen\n' })
		);
		expect(rot).toBe(true);
	});

	it('nimmt eine Begründung mit Datum und Satzzeichen an', () => {
		// Die Zeichenklasse enthielt einen Bereich statt einzelner Zeichen und
		// warf Ziffern weg; eine Begründung aus Datum und Punkt fiel unter die
		// Mindestlänge.
		const { rot } = fahre(
			baum({ 'src/fall.ts': '// waechtername-historisch: abgelöst 24.08.2026. check-weg\n' })
		);
		expect(rot).toBe(false);
	});

	it('lässt eine Marke nicht über eine Leerzeile hinweg gelten', () => {
		const { rot } = fahre(
			baum({ 'src/fall.ts': '// waechtername-historisch: gilt woanders und hat Text.\n\n// check-weg\n' })
		);
		expect(rot).toBe(true);
	});
});
