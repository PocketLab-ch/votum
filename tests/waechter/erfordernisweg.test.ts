/**
 * Gegentest zum Wächter «Erfordernisweg».
 *
 * Der Wächter liest sechs Dateien des echten Baums und lässt sich deshalb
 * nicht an einem Schnipsel prüfen wie die anderen. Der Gegentest baut
 * stattdessen einen **vollständigen kleinen Baum** mit denselben sechs Dateien
 * nach: Er muss nur so viel enthalten, wie der Wächter liest.
 *
 * Der wichtigste Fall ist der letzte: Ein Feld, das der Rechenweg gar nicht
 * liest, darf nicht gemeldet werden. Ein Wächter, der bei jedem neuen Feld
 * meldet, wird abgeschaltet statt gelesen.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPT = join(process.cwd(), 'scripts', 'check-erfordernisweg.mjs');
const verzeichnisse: string[] = [];

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

/**
 * Ein Wegwerfbaum mit den sechs Dateien, die der Wächter liest.
 *
 * Die Vorgaben beschreiben, was jeweils fehlen soll — so lässt sich jeder
 * Befund einzeln herstellen, ohne die anderen mitzureissen.
 */
function baum(
	u: { imJson?: boolean; inWende?: boolean; gelesen?: boolean; imLeseweg?: boolean; inHinweisen?: boolean } = {}
): string {
	const { imJson = true, inWende = true, gelesen = true, imLeseweg = true, inHinweisen = false } = u;
	const wurzel = mkdtempSync(join(tmpdir(), 'erfordernisweg-'));
	verzeichnisse.push(wurzel);
	const domain = join(wurzel, 'src', 'lib', 'domain');
	const server = join(wurzel, 'src', 'lib', 'server');
	mkdirSync(domain, { recursive: true });
	mkdirSync(server, { recursive: true });

	writeFileSync(
		join(domain, 'entscheidbaum.ts'),
		[
			'export interface Erfordernis {',
			'\tkopfbasis: Kopfbasis;',
			'\tenthaltungZaehltMit?: boolean;',
			'\tfundstelle?: string;',
			'\tlesartDesBeschlusses?: Lesart;',
			'}',
			''
		].join('\n')
	);

	writeFileSync(
		join(domain, 'auszaehlung.ts'),
		[
			'export function zaehleAus(e: Erfordernis) {',
			'\tconst basis = e.kopfbasis;',
			gelesen ? '\tconst raus = e.enthaltungZaehltMit === false;' : '\t// liest das Merkmal nicht',
			'\treturn basis;',
			'}',
			''
		].join('\n')
	);

	// Seit F4c B2 (05.11.2026): Die Vorschau liest hier über `kopfbasisStreit` mit.
	writeFileSync(
		join(domain, 'mehrhinweise.ts'),
		[
			'export function kopfbasisStreit(e: Erfordernis) {',
			inHinweisen ? '\treturn e.lesartDesBeschlusses;' : '\treturn null;',
			'}',
			''
		].join('\n')
	);

	writeFileSync(
		join(server, 'abstimmung.ts'),
		[
			'const abfrage = `',
			'\tjsonb_build_object(',
			"\t  'kopfbasis', a.requirement_head_base,",
			imJson ? "\t  'enthaltungZaehltMit', a.requirement_abstention_counts," : '\t  -- fehlt',
			"\t  'pfad', '[]'::jsonb",
			'\t) END AS erfordernis`;',
			''
		].join('\n')
	);

	writeFileSync(
		// Seit 07.10.2026 in `erfordernisspalten.ts` statt `traktanden.ts`.
		join(server, 'erfordernisspalten.ts'),
		[
			'export function erfordernisAusZeile(z: ErfordernisSpalten): Erfordernis | null {',
			'\treturn {',
			'\t\tkopfbasis: z.requirement_head_base ?? undefined,',
			imLeseweg ? '\t\tenthaltungZaehltMit: z.requirement_abstention_counts ?? undefined,' : '\t\t// fehlt',
			'\t};',
			'}',
			''
		].join('\n')
	);

	writeFileSync(
		join(domain, 'reglement.ts'),
		[
			'export interface ReglementsregelEingabe {',
			'\tstwegId: Id;',
			'\tkopfbasis: Kopfbasis;',
			'\tenthaltungZaehltMit: boolean;',
			'}',
			'',
			'export function wendeReglementAn(erfordernis: Erfordernis, regeln: R[]) {',
			'\treturn {',
			'\t\tkopfbasis: regel.kopfbasis,',
			inWende ? '\t\tenthaltungZaehltMit: regel.enthaltungZaehltMit,' : '\t\t// fehlt',
			'\t};',
			'}',
			'',
			'export function erfordernisAusRegel(regel: Reglementsregel): Erfordernis {',
			'\treturn {',
			'\t\tkopfbasis: regel.kopfbasis,',
			'\t\tenthaltungZaehltMit: regel.enthaltungZaehltMit,',
			'\t};',
			'}',
			''
		].join('\n')
	);
	return wurzel;
}

afterAll(() => {
	for (const v of verzeichnisse) rmSync(v, { recursive: true, force: true });
});

describe('findet das Feld, das auf halbem Weg liegenbleibt', () => {
	it('meldet ein gelesenes Feld, das nicht eingefroren wird', () => {
		/*
		 * **Die Station, die zehn Proben übersprungen hatten** (04.09.2026). Kern,
		 * Übersetzung und Speicherweg enden alle vor dem `jsonb_build_object`, und
		 * dieses JSON ist die einzige Quelle beider Auszählwege.
		 */
		const { rot, ausgabe } = fahre(baum({ imJson: false }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/enthaltungZaehltMit/);
		expect(ausgabe).toMatch(/eingefrorenen/);
	});

	it('meldet ein Feld, das nur eine der beiden Übersetzungen trägt', () => {
		const { rot, ausgabe } = fahre(baum({ inWende: false }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/wendeReglementAn/);
	});

	it('meldet ein gelesenes Feld, das der Leseweg auslässt', () => {
		/*
		 * `erfordernisAusZeile` baut das Erfordernis aus den Einzelspalten neu.
		 * Daran hängt die Auszählmappe für den Ausfall: Die Anwendung rechnete
		 * dann richtig und das Blatt für den Notfall falsch, und niemand
		 * vergleicht die beiden — wer die Mappe braucht, hat den Server nicht mehr.
		 */
		const { rot, ausgabe } = fahre(baum({ imLeseweg: false }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/erfordernisAusZeile/);
	});

	it('meldet auch die Gegenrichtung der zwei Übersetzungen', () => {
		/*
		 * Die erste Fassung prüfte nur eine Richtung. Fehlte das Feld umgekehrt in
		 * `erfordernisAusRegel`, rechnete der Rückkommensweg gegen die angezeigte
		 * Regel, und der Wächter schwieg.
		 */
		const wurzel = baum();
		const datei = join(wurzel, 'src', 'lib', 'domain', 'reglement.ts');
		const inhalt = readFileSync(datei, 'utf8');
		writeFileSync(
			datei,
			inhalt.replace(
				/(erfordernisAusRegel[\s\S]*?)\n\t\tenthaltungZaehltMit: regel\.enthaltungZaehltMit,/,
				'$1'
			)
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/erfordernisAusRegel/);
	});

	it('meldet ein Feld, das nur die Hinweise der Vorschau lesen und das nicht eingefroren wird', () => {
		/*
		 * **Die Lücke von F4c B2** (05.11.2026): `lesartDesBeschlusses` liest nur
		 * `kopfbasisStreit` in `mehrhinweise.ts`, und bis dahin sah der Wächter
		 * nur `auszaehlung.ts`. Ohne den Eintrag im eingefrorenen Block wäre er
		 * grün geblieben.
		 */
		const { rot, ausgabe } = fahre(baum({ inHinweisen: true }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/lesartDesBeschlusses/);
		expect(ausgabe).toMatch(/eingefrorenen/);
	});

	it('meldet beide Lücken zugleich', () => {
		const { rot, ausgabe } = fahre(baum({ imJson: false, inWende: false }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/2 Felder auf halbem Weg/);
	});
});

describe('lässt in Ruhe, was in Ruhe gehört', () => {
	it('schweigt im vollständigen Baum', () => {
		const { rot, ausgabe } = fahre(baum());
		expect(rot, ausgabe).toBe(false);
	});

	it('schweigt bei einem Feld, das der Rechenweg gar nicht liest', () => {
		/*
		 * `fundstelle` steht im Erfordernis und gehört zum Nachweis, nicht zur
		 * Rechnung. Ein Wächter, der bei jedem neuen Feld meldet, erzeugt Lärm
		 * statt Sicherheit — und wird dann abgeschaltet statt gelesen.
		 */
		const { rot, ausgabe } = fahre(baum({ gelesen: false }));
		expect(rot, ausgabe).toBe(false);
		expect(ausgabe).not.toMatch(/fundstelle/);
	});
});

describe('am echten Baum', () => {
	it('ist im Bestand grün', () => {
		const { rot, ausgabe } = fahre(process.cwd());
		expect(rot, ausgabe).toBe(false);
	});

	it('meldet, wenn der Rechenweg gar kein Feld mehr als `e.<feld>` liest', () => {
		/*
		 * **Die Reissleine.** Wird der Parameter in `zaehleAus` umbenannt, findet
		 * die Suche nichts mehr — und ein Wächter mit leerer Prüfmenge ist immer
		 * grün. Er bewachte dann nichts, und niemand merkte es.
		 */
		const wurzel = baum();
		writeFileSync(
			join(wurzel, 'src', 'lib', 'domain', 'auszaehlung.ts'),
			'export function zaehleAus(erf: Erfordernis) {\n\treturn erf.kopfbasis;\n}\n'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/kein einziges Feld/);
	});

	it('meldet, wenn der eingefrorene Block gar nicht mehr auffindbar ist', () => {
		/*
		 * **Ein Wächter, der seinen Gegenstand verliert, muss laut werden**, nicht
		 * still grün. Sonst bewacht er nach einem Umbau nichts mehr, und niemand
		 * merkt es.
		 */
		const wurzel = baum();
		const server = join(wurzel, 'src', 'lib', 'server');
		writeFileSync(join(server, 'abstimmung.ts'), 'export const nichts = 1;\n');
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/nicht auffindbar/);
	});
});
