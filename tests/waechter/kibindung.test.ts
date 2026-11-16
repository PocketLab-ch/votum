/**
 * Der KI-Bindungswächter — und ob er wirklich rot wird.
 *
 * **Warum ein Test für einen Wächter** (Erfahrung 02.09.2026): Am selben Tag
 * wurde der Seitenaufbau-Wächter falsch-rot, sobald er sein Ziel erreichte, und
 * eine Sichtprobe deckte für eine zweite mit. Ein Wächter, der niemals rot
 * wird, ist eine Zeile im Prüflauf und sonst nichts.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';

const WURZEL = process.cwd();
const SKRIPT = join(WURZEL, 'scripts/check-kibindung.mjs');

let baum: string | null = null;

function baumMit(dateien: Record<string, string>): string {
	baum = mkdtempSync(join(tmpdir(), 'kibindung-'));
	for (const [weg, inhalt] of Object.entries(dateien)) {
		const ziel = join(baum, weg);
		mkdirSync(join(ziel, '..'), { recursive: true });
		writeFileSync(ziel, inhalt);
	}
	return baum;
}

function lauf(verzeichnis: string): { code: number; text: string } {
	// Ein `exit(2)` der Reissleine ginge als gefundener Regelverstoss durch —
	// davor schützt der Wurf in `fahreWaechter`, nicht dieses Feld. `code` steht
	// hier nur, weil die Fälle unten ihre Erwartung als Zahl schreiben.
	const { code, ausgabe } = fahreWaechter(SKRIPT, verzeichnis);
	return { code, text: ausgabe };
}

/** Ein gebundener Weg, damit die dritte Sichtprobe zufrieden ist. */
const GEBUNDEN =
	'import { frage } from "./ki";\n' +
	'export async function pruefeEtwas(h: unknown, traktandumId: string, meetingId: string) {\n' +
	'\treturn frage(h, traktandumId, meetingId);\n' +
	'}\n';

/** Genug Dateien, damit die erste Sichtprobe («greift der Lauf?») zufrieden ist. */
function fueller(anzahl: number): Record<string, string> {
	const raus: Record<string, string> = {};
	for (let i = 0; i < anzahl; i++) {
		raus[`src/lib/server/f${i}.ts`] = 'export const x = 1;\n';
	}
	raus['src/lib/server/gebunden.ts'] = GEBUNDEN;
	return raus;
}

afterEach(() => {
	if (baum) rmSync(baum, { recursive: true, force: true });
	baum = null;
});

describe('Der KI-Bindungswächter', () => {
	it('ist grün, wenn jeder fragende Weg seine Versammlung kennt', () => {
		const e = lauf(baumMit(fueller(30)));
		expect(e.code).toBe(0);
		expect(e.text).toContain('in Ordnung');
	});

	/*
	 * **Der Fall, um den es geht** — dreimal einzeln gefunden: `pruefeTraktandum`
	 * am 01.09.2026, `pruefeAntrag` und `holeVorschlag` am 02.09.2026.
	 */
	it('wird rot bei einer Traktandumskennung ohne Versammlung', () => {
		const e = lauf(
			baumMit({
				...fueller(30),
				'src/lib/server/offen.ts':
					'import { frage } from "./ki";\n' +
					'export async function pruefeAntrag(h: unknown, traktandumId: string) {\n' +
					'\treturn frage(h, traktandumId);\n' +
					'}\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('offen.ts:2');
		expect(e.text).toContain('pruefeAntrag');
		expect(e.text).toContain('meetingId');
	});

	/*
	 * **Eine lange Begründung zwischen den Argumenten darf ihn nicht abhängen.**
	 * Genau so sehen die Signaturen im Bestand aus: Der Bindungsparameter trägt
	 * einen JSDoc-Block, der den Anlass erklärt. Deshalb der Parser und keine
	 * Regex über die Signatur.
	 */
	it('liest die Bindung auch hinter einem Kommentarblock', () => {
		const e = lauf(
			baumMit({
				...fueller(30),
				'src/lib/server/erklaert.ts':
					'import { frage } from "./ki";\n' +
					'export async function pruefeAntrag(\n' +
					'\th: unknown,\n' +
					'\ttraktandumId: string,\n' +
					'\t/**\n' +
					'\t * Die Versammlung, zu der es gehören MUSS.\n' +
					'\t *\n' +
					'\t * Ein Absatz, der von traktandumId und meetingId erzählt.\n' +
					'\t */\n' +
					'\tmeetingId: string\n' +
					') {\n' +
					'\treturn frage(h, traktandumId, meetingId);\n' +
					'}\n'
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Eine Datei, die das Modell gar nicht fragt, geht ihn nichts an.** Sonst
	 * verlangte er die Bindung von jedem Leseweg, der eine Traktandumskennung
	 * nimmt — und würde abgeschaltet.
	 */
	it('lässt eine Traktandumskennung ohne Modellfrage in Ruhe', () => {
		const e = lauf(
			baumMit({
				...fueller(30),
				'src/lib/server/lesen.ts':
					'export async function holeTraktandum(h: unknown, traktandumId: string) {\n' +
					'\treturn { h, traktandumId };\n' +
					'}\n'
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Nur Exportiertes.** Eine Hilfsfunktion in derselben Datei hat keinen
	 * fremden Aufrufer; die Bindung gehört an die Grenze, nicht an jede Zeile
	 * dahinter.
	 */
	it('lässt eine nicht exportierte Funktion in Ruhe', () => {
		const e = lauf(
			baumMit({
				...fueller(30),
				'src/lib/server/intern.ts':
					'import { frage } from "./ki";\n' +
					'async function hilf(h: unknown, traktandumId: string) {\n' +
					'\treturn frage(h, traktandumId);\n' +
					'}\n' +
					'export const nutz = hilf;\n'
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Die drei Sichtproben.** Ohne sie wäre der Wächter grün, wenn er nichts
	 * findet — und nichts finden kann.
	 */
	it('bricht ab, wenn er kaum Dateien sieht', () => {
		const e = lauf(baumMit({ 'src/lib/server/eine.ts': 'export const x = 1;\n' }));
		expect(e.code).toBe(1);
		expect(e.text).toContain('greift nicht');
	});

	it('bricht ab, wenn niemand mehr das Modell fragt', () => {
		const ohne: Record<string, string> = {};
		for (let i = 0; i < 30; i++) ohne[`src/lib/server/f${i}.ts`] = 'export const x = 1;\n';
		const e = lauf(baumMit(ohne));
		expect(e.code).toBe(1);
		expect(e.text).toContain('ruft `frage`');
	});

	it('bricht ab, wenn er keine einzige gebundene Signatur mehr liest', () => {
		const ohne: Record<string, string> = {};
		for (let i = 0; i < 30; i++) ohne[`src/lib/server/f${i}.ts`] = 'export const x = 1;\n';
		// Fragt das Modell, nimmt aber gar keine Traktandumskennung — der Wächter
		// hat dann nichts zu binden und darf das nicht für Ordnung halten.
		ohne['src/lib/server/anders.ts'] =
			'import { frage } from "./ki";\n' +
			'export async function entwirf(h: unknown, meetingId: string) {\n' +
			'\treturn frage(h, meetingId);\n' +
			'}\n';
		const e = lauf(baumMit(ohne));
		expect(e.code).toBe(1);
		expect(e.text).toContain('keine einzige gebundene');
	});
});
