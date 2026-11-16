/**
 * Der Datumswächter — und ob er wirklich rot wird.
 *
 * **Warum ein Test für einen Wächter** (Erfahrung 02.09.2026): Am selben Tag
 * meldete der Seitenaufbau-Wächter eine Datei stillschweigend gar nicht mehr,
 * weil sie unlesbar war, und seine Sichtprobe wurde falsch-rot, sobald er sein
 * Ziel erreichte. Ein Wächter, der niemals rot wird, ist eine Zeile im
 * Prüflauf und sonst nichts.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechterIn } from './waechterlauf';

const WURZEL = process.cwd();
const SKRIPT = join(WURZEL, 'scripts/check-datumspruefung.mjs');

let baum: string | null = null;

function baumMit(dateien: Record<string, string>): string {
	baum = mkdtempSync(join(tmpdir(), 'datumswaechter-'));
	// Die echte Heimat mitnehmen, damit `istKalendertag` dort stehen darf.
	mkdirSync(join(baum, 'src/lib/domain'), { recursive: true });
	cpSync(join(WURZEL, 'src/lib/domain/datum.ts'), join(baum, 'src/lib/domain/datum.ts'));
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
	const { code, ausgabe } = fahreWaechterIn(SKRIPT, verzeichnis);
	return { code, text: ausgabe };
}

/** Genug Dateien, damit die Sichtprobe («greift der Lauf?») zufrieden ist. */
function fueller(anzahl: number): Record<string, string> {
	const raus: Record<string, string> = {};
	for (let i = 0; i < anzahl; i++) {
		raus[`src/lib/fueller${i}.ts`] = 'export const x = 1;\n';
	}
	raus['src/lib/nutzer.ts'] =
		"import { istKalendertag } from '$lib/domain/datum';\nexport const p = (t: string) => istKalendertag(t);\n";
	// Die zweite Klasse braucht ihren eigenen Nutzer: Seit dem 02.09.2026 hat der
	// Wächter zwei Sichtproben, und ohne diese Zeile wäre jeder Baum rot.
	raus['src/lib/former.ts'] =
		"import { kalendertag } from '$lib/domain/datum';\nexport const t = (d: Date) => kalendertag(d);\n";
	return raus;
}

afterEach(() => {
	if (baum) rmSync(baum, { recursive: true, force: true });
	baum = null;
});

describe('Der Datumswächter', () => {
	it('ist grün, wenn alle Stellen `istKalendertag` benutzen', () => {
		const e = lauf(baumMit(fueller(60)));
		expect(e.code).toBe(0);
		expect(e.text).toContain('in Ordnung');
	});

	it('wird rot bei der nackten Regex — und nennt Datei und Zeile', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/schlecht.ts':
					"export const p = (t: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(t);\n"
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('schlecht.ts:1');
		expect(e.text).toContain('istKalendertag');
	});

	/*
	 * **Auch in Svelte-Dateien.** Die sechzehnte Stelle stand am 02.09.2026 in
	 * `VersammlungFormular.svelte` und fiel dem `grep` über `*.ts` nicht auf —
	 * gefunden hat sie erst dieser Wächter.
	 */
	it('sieht auch Svelte-Dateien', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/Formular.svelte':
					"<script lang=\"ts\">\n\tconst ok = /^\\d{4}-\\d{2}-\\d{2}$/.test('x');\n</script>\n"
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('Formular.svelte:2');
	});

	it('lässt sich nicht durch eine andere Schreibweise umgehen', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/getarnt.ts': "export const p = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;\n"
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('getarnt.ts');
	});

	it('übersieht die Regex im Kommentar', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/erklaert.ts':
					"// Frueher stand hier /^\\d{4}-\\d{2}-\\d{2}$/ — siehe Befund vom 02.09.2026.\nexport const x = 1;\n"
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Die zweite Klasse: den Tag von Hand zusammensetzen** (02.09.2026).
	 *
	 * Sechs Stellen bauten ihn aus `getFullYear()`, `getMonth()` und
	 * `getDate()`. Das sind Ortszeit-Getter, und der Treiber gibt eine
	 * `date`-Spalte als Mitternacht UTC zurück — westlich von Greenwich wird
	 * daraus der Vortag. Gemessen an `DATE '2026-01-01'` in
	 * America/New_York: `2025-12-31`.
	 */
	it('wird rot, wenn ein Tag aus Ortszeit-Gettern entsteht', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/handarbeit.ts':
					'export const tag = (d: Date) =>\n' +
					"\t`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;\n"
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('handarbeit.ts:2');
		expect(e.text).toContain('Ortszeit-Gettern');
		expect(e.text).toContain('kalendertag()');
	});

	/*
	 * **Auch mitten im Ausdruck.** Drei der sechs Stellen waren keine eigene
	 * Funktion, sondern standen inline in einem Objektliteral — ein Wächter, der
	 * nur nach `function kalendertag` sucht, hätte sie nicht gesehen.
	 */
	it('sieht die Handarbeit auch mitten in einem Ausdruck', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/inline.ts':
					'export const z = {\n' +
					"\tdatum: `${new Date().getFullYear()}-01-01`\n" +
					'};\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('inline.ts:2');
	});

	/*
	 * **Auch im HTML-Kommentar** (02.09.2026, zweite Runde des Code-Reviews).
	 * Der Lauf geht über `.svelte`-Dateien, und dort ist `<!-- -->` die übliche
	 * Form. Eine Begründung, die das falsche Muster zitiert — wie sie dieser
	 * Block selbst schreibt —, hätte den Wächter rot gemacht.
	 */
	it('übersieht die Handarbeit im HTML-Kommentar', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/Erklaert.svelte':
					'<!--\n\tFrueher stand hier d.getFullYear() — siehe Befund vom 02.09.2026.\n-->\n<p>x</p>\n'
			})
		);
		expect(e.code).toBe(0);
	});

	it('übersieht die Handarbeit im Kommentar', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/erklaert2.ts':
					'// Frueher stand hier d.getFullYear() — siehe Befund vom 02.09.2026.\nexport const x = 1;\n'
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Die zwei Sichtproben.** Ohne sie wäre der Wächter grün, wenn er nichts
	 * findet — und nichts finden kann.
	 */
	it('bricht ab, wenn er kaum Dateien sieht', () => {
		const e = lauf(baumMit({ 'src/lib/eine.ts': 'export const x = 1;\n' }));
		expect(e.code).toBe(1);
		expect(e.text).toContain('greift nicht');
	});

	it('bricht ab, wenn niemand mehr `istKalendertag` ruft', () => {
		const nurFormer: Record<string, string> = {};
		for (let i = 0; i < 60; i++) nurFormer[`src/lib/f${i}.ts`] = 'export const x = 1;\n';
		nurFormer['src/lib/former.ts'] =
			"import { kalendertag } from '$lib/domain/datum';\nexport const t = (d: Date) => kalendertag(d);\n";
		const e = lauf(baumMit(nurFormer));
		expect(e.code).toBe(1);
		expect(e.text).toContain('ruft `istKalendertag`');
	});

	/*
	 * **Zwei Zähler, nicht einer** (02.09.2026, aus dem Code-Review). Ein
	 * gemeinsames «ruft irgendetwas aus dem Kern» wäre grün geblieben, sobald
	 * eine der beiden Klassen ganz verschwindet — die eine hätte für die andere
	 * mitgedeckt. Diese Probe und die darüber halten je eine Aussage.
	 */
	it('bricht ab, wenn niemand mehr `kalendertag` ruft', () => {
		const nurPruefer: Record<string, string> = {};
		for (let i = 0; i < 60; i++) nurPruefer[`src/lib/f${i}.ts`] = 'export const x = 1;\n';
		nurPruefer['src/lib/nutzer.ts'] =
			"import { istKalendertag } from '$lib/domain/datum';\nexport const p = (t: string) => istKalendertag(t);\n";
		const e = lauf(baumMit(nurPruefer));
		expect(e.code).toBe(1);
		expect(e.text).toContain('ruft `kalendertag`');
	});

	/*
	 * **Alle drei Getter.** Wer die Jahreszahl anderswoher nimmt und nur Monat
	 * und Tag von Hand setzt, macht denselben Fehler — `getMonth()` und
	 * `getDate()` sind genauso Ortszeit.
	 */
	it('sieht die Handarbeit auch ohne getFullYear', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/lib/halb.ts':
					'export const md = (d: Date, jahr: number) =>\n' +
					"\t`${jahr}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;\n"
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('halb.ts:2');
	});
});
