/**
 * Fassung 2026-11-15 (Auftrag «Texte nach 0047», Punkte 7, 8, 10, 11 und 12): nur
 * Wortlaut an vier Karten und in «Wortlaut und Rechtsprechung». Die Sätze selbst
 * bindet `tests/waechter/endfassung-regel43.test.ts` (Gruppe «Texte nach 0047»);
 * hier die Fassung: Prüfungen, dass sich nichts sonst ändert, und die Kopie des
 * Satzes zu den Enthaltungen im Kern.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { ENTHALTUNG_IM_WORTLAUT_AB_2026_11_15, ENTHALTUNG_IM_WORTLAUT_ALLE } from '$lib/domain/reglement';
import {
	ENTHALTUNG_SATZ,
	ENTHALTUNG_SATZ_647D,
	ENTHALTUNG_SATZ_WEBSITE,
	ERSETZUNGEN,
	nachDieserFassung,
	wortlautAnwesendeWebsite
} from '$lib/rules/quorum-2026-11-15';
import { ENTHALTUNG_SATZ as ENTHALTUNG_SATZ_2026_11_14 } from '$lib/rules/quorum-2026-11-14';

const NEU = holeRegelwerk('2026-11-15');
const VOR = holeRegelwerk('2026-11-14');

describe('Fassung 2026-11-15', () => {
	it('ist seit der Fassung 2026-11-16 nicht mehr die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-18');
		expect(NEU.fassung).toBe('2026-11-15');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
	});

	it('ändert keine Frage, keinen Ast, kein Mehr und nur die Sätze der vier Karten', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.ergebnistypen).toEqual(VOR.ergebnistypen);
		const geaendert = new Set(ERSETZUNGEN.flatMap((e) => e.knoten));
		expect([...geaendert].sort()).toEqual(['k-ausschlussklage', 'k-bewirtschaftung-erweitert', 'k-prozessfuehrung', 'k-verwaltung-wichtig']);
		for (const k of NEU.knoten) {
			const v = VOR.knoten.find((x) => x.id === k.id)!;
			expect([k.typ, k.kopfbasis, k.quotenbasis, k.rechtsgrundlage, k.lesart], k.id).toEqual([
				v.typ,
				v.kopfbasis,
				v.quotenbasis,
				v.rechtsgrundlage,
				v.lesart
			]);
			if (!geaendert.has(k.id)) expect(k, k.id).toBe(v);
			else expect(k, k.id).not.toEqual(v);
		}
		expect(Object.keys(NEU.wortlautErklaerungJeArtikel ?? {})).toEqual(Object.keys(VOR.wortlautErklaerungJeArtikel ?? {}));
		expect(Object.keys(NEU.wortlautErklaerungJeArtikelAlle ?? {})).toEqual(
			Object.keys(VOR.wortlautErklaerungJeArtikelAlle ?? {})
		);
	});

	it('die alte Fassung behält ihre Sätze', () => {
		expect(JSON.stringify(VOR)).toContain('BGE 143 III 537 E. 4.2.3');
		expect(JSON.stringify(VOR)).toContain('Seine Angehörigen stimmen nur nicht mit.');
		expect(JSON.stringify(VOR)).toContain('Rz. 78, 78a und 84 ad Art. 712g');
		expect(JSON.stringify(VOR)).toContain('fällt sie deswegen in der Regel nicht weg (BGE 143 III 537 E. 4.2.4)');
	});

	it('die Kopien des Satzes zu den Enthaltungen im Kern gleichen beiden Fassungen (Punkt 12d)', () => {
		expect(ENTHALTUNG_IM_WORTLAUT_AB_2026_11_15).toBe(` ${ENTHALTUNG_SATZ}`);
		expect(ENTHALTUNG_IM_WORTLAUT_ALLE).toEqual([
			` ${ENTHALTUNG_SATZ_2026_11_14}`,
			` ${ENTHALTUNG_SATZ}`,
			` ${ENTHALTUNG_SATZ_647D}`
		]);
	});

	it('die Website bekommt 4b ohne «so rechnet Votum»', () => {
		for (const artikel of ['ZGB Art. 647a Abs. 2', 'ZGB Art. 647b Abs. 1', 'ZGB Art. 647c', 'ZGB Art. 647e Abs. 2']) {
			const website = wortlautAnwesendeWebsite(artikel);
			expect(website, artikel).toContain(ENTHALTUNG_SATZ_WEBSITE);
			expect(website, artikel).not.toMatch(/\bVotum\b/);
			expect(website.replace(ENTHALTUNG_SATZ_WEBSITE, ENTHALTUNG_SATZ)).toBe(NEU.wortlautErklaerungJeArtikel![artikel]);
		}
	});

	it('nachDieserFassung wendet die Ersetzungen beider Fassungen an', () => {
		const prozess = VOR.knoten.find((k) => k.id === 'k-prozessfuehrung')!;
		const neu = NEU.knoten.find((k) => k.id === 'k-prozessfuehrung')!;
		expect((prozess.hinweise ?? []).map(nachDieserFassung)).toEqual(neu.hinweise);
	});
});
