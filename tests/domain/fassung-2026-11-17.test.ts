/**
 * Fassung 2026-11-17 (Auftrag «Textfassung nach dem Website-Abzug», 15.11.2026):
 * nur Wortlaut in «Wortlaut und Rechtsprechung», in der allgemeinen Erklärung
 * und an zwei Karten. Hier die Prüfungen, dass kein Ergebnis sich ändert, und
 * die Sätze selbst.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import {
	knotenNachLesart,
	LESARTEN_VORGABE,
	pruefeLesartenImRegelwerk,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import {
	BEFUGNISSE_STREICHEN,
	ERSETZUNGEN,
	GERICHT_647C,
	GERICHT_647C_VORHER,
	GRENZFALL,
	GRENZFALL_VORHER,
	SICHER_JE_ARTIKEL,
	SICHER_VORHER,
	STUETZE_RZ112,
	STUETZE_RZ112_EINFACH,
	VORSITZ_WAHL,
	WAHL_HINWEIS,
	WAHL_HINWEIS_VORHER,
	WAHL_STUECKE,
	WARTEN_DANACH,
	WARTEN_DANACH_WAHL,
	ANFECHTUNG_VERWEIS,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-17';
import { ERWEITERUNG } from '$lib/rules/quorum-2026-10-23';
import {
	HINWEIS as WAHL_HINWEIS_2026_11_13,
	HINWEIS_EINFACH as WAHL_HINWEIS_EINFACH
} from '$lib/rules/quorum-2026-11-13';

const NEU = holeRegelwerk('2026-11-17');
const VOR = holeRegelwerk('2026-11-16');
const WAHL = 'k-bewirtschaftung-waehlen-erweitert';
const GEAENDERT = [WAHL, 'k-grenzfall-nutzung'];
const VIER = ['ZGB Art. 647a Abs. 2', 'ZGB Art. 647b Abs. 1', 'ZGB Art. 647c', 'ZGB Art. 647e Abs. 2'];

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;

/** Was ein Ergebnis ausmacht, ohne die Sätze: das Erfordernis nach der Wahl der Gemeinschaft. */
function mass(rw: Regelwerk, k: Ergebnisknoten, wahlen: Lesartenwahl) {
	const e = wendeLesartAn(erfordernisAusKnoten(rw, k), wahlen);
	return {
		typ: e.typ,
		rechtsgrundlage: e.rechtsgrundlage,
		kopfbasis: e.kopfbasis,
		quotenbasis: e.quotenbasis,
		kopfSchwelle: e.kopfSchwelle,
		quotenSchwelle: e.quotenSchwelle,
		geschaeftsart: e.geschaeftsart,
		reglementsverhalten: e.reglementsverhalten,
		enthaltungZaehltMit: e.enthaltungZaehltMit,
		zustimmungBetroffenerNoetig: e.zustimmungBetroffenerNoetig,
		betroffenenzustimmung: e.betroffenenzustimmung,
		quelle: e.quelle
	};
}

describe('Fassung 2026-11-17', () => {
	it('ist seit der Fassung 2026-11-18 nicht mehr die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-18');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('In der Fassung 2026-11-17');
	});

	it('ändert keine Frage, keinen Ast, keinen Typ und nur die Sätze der zwei Karten', () => {
		expect(NEU.fragen).toBe(VOR.fragen);
		expect(NEU.aeste).toBe(VOR.aeste);
		expect(NEU.ergebnistypen).toBe(VOR.ergebnistypen);
		expect([...new Set(ERSETZUNGEN.flatMap((e) => e.knoten))].sort()).toEqual([...GEAENDERT].sort());
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const k of NEU.knoten) {
			const v = knoten(VOR, k.id);
			if (GEAENDERT.includes(k.id)) expect(k, k.id).not.toEqual(v);
			else expect(k, k.id).toBe(v);
		}
	});

	it('kein Ergebnis ändert sich, an keiner Karte, unter der Vorgabe, unter «einfach» und unter «Alle Eigentümer»', () => {
		const wahlen: Lesartenwahl[] = [
			LESARTEN_VORGABE,
			{ ...LESARTEN_VORGABE, L4: 'einfach' },
			{ ...LESARTEN_VORGABE, L13: 'alle' },
			{ ...LESARTEN_VORGABE, L4: 'einfach', L13: 'alle' }
		];
		for (const k of NEU.knoten) {
			for (const w of wahlen) {
				expect(mass(NEU, k, w), `${k.id} ${JSON.stringify(w)}`).toEqual(mass(VOR, knoten(VOR, k.id), w));
			}
		}
	});

	it('4b: der sichere Weg ohne «Im Streit um die Zählweise», die Wertquoten am qualifizierten Mehr, das Bundesgericht an Art. 647c', () => {
		for (const artikel of VIER) {
			const neu = NEU.wortlautErklaerungJeArtikel![artikel];
			expect(neu, artikel).toContain(SICHER_JE_ARTIKEL[artikel]);
			expect(neu, artikel).not.toContain(SICHER_VORHER);
			expect(neu.replace(SICHER_JE_ARTIKEL[artikel], SICHER_VORHER), artikel).toBe(
				artikel === 'ZGB Art. 647c'
					? VOR.wortlautErklaerungJeArtikel![artikel].replace(GERICHT_647C_VORHER, GERICHT_647C)
					: VOR.wortlautErklaerungJeArtikel![artikel]
			);
		}
		expect(SICHER_JE_ARTIKEL['ZGB Art. 647b Abs. 1']).toContain('Mehr als die Hälfte aller Wertquoten braucht es in jedem Fall.');
		expect(SICHER_JE_ARTIKEL['ZGB Art. 647e Abs. 2']).toContain('Mehr als die Hälfte aller Wertquoten braucht es in jedem Fall.');
		expect(SICHER_JE_ARTIKEL['ZGB Art. 647a Abs. 2']).not.toContain('Wertquoten');
		expect(NEU.wortlautErklaerungJeArtikel!['ZGB Art. 647c']).not.toContain('erwähnt, aber nicht beurteilt');
		// Die Lage zwischen beiden Zählweisen ohne Zeitangabe, mit Verweis auf den Rat nach der Auszählung.
		for (const artikel of VIER) {
			expect(SICHER_JE_ARTIKEL[artikel], artikel).toContain('nach der herrschenden Lehre angenommen');
			expect(SICHER_JE_ARTIKEL[artikel], artikel).toContain('sagt Votum nach der Auszählung');
			expect(SICHER_JE_ARTIKEL[artikel], artikel).not.toMatch(/Tage|Wochen/);
		}
		// Art. 647d (4a) bleibt.
		expect(NEU.wortlautErklaerungJeArtikel!['ZGB Art. 647d Abs. 1']).toBe(VOR.wortlautErklaerungJeArtikel!['ZGB Art. 647d Abs. 1']);
	});

	it('4c: nur an Art. 647c das Bundesgericht wie in 4b', () => {
		for (const artikel of VIER) {
			const vor = VOR.wortlautErklaerungJeArtikelAlle![artikel];
			expect(NEU.wortlautErklaerungJeArtikelAlle![artikel], artikel).toBe(
				artikel === 'ZGB Art. 647c' ? vor.replace(GERICHT_647C_VORHER, GERICHT_647C) : vor
			);
		}
	});

	it('«einige Tage nach Ablauf» steht nirgends in der Fassung (Fachprüfung M1)', () => {
		expect(JSON.stringify(NEU)).not.toMatch(/einige Tage nach/);
	});

	it('«Im Streit um die Zählweise» steht nirgends mehr in der Fassung (L7)', () => {
		expect(JSON.stringify(VOR)).toContain('Im Streit um die Zählweise');
		expect(JSON.stringify(NEU)).not.toContain('Im Streit um die Zählweise');
	});

	it('die Wahl mit erweiterten Befugnissen: Stütze, Offerte und Vorsitz nach der Vorgabe, Stütze und Vorsitz unter «einfach»', () => {
		const k = knoten(NEU, WAHL);
		const hinweis = nachDieserFassung(WAHL_HINWEIS_2026_11_13);
		expect(hinweis).toBe(WAHL_HINWEIS);
		expect(k.hinweise).toEqual([hinweis]);
		for (const satz of [STUETZE_RZ112, BEFUGNISSE_STREICHEN, VORSITZ_WAHL]) expect(hinweis).toContain(satz);
		// Die Reihenfolge der Website (L10): was gilt und was Sie tun zuerst, die Erweiterung am Schluss.
		expect(hinweis.startsWith(WAHL_STUECKE.was)).toBe(true);
		expect(hinweis.endsWith(ERWEITERUNG)).toBe(true);
		expect(hinweis).toContain(`wirken wie ein Nein. ${VORSITZ_WAHL} Erreicht die Wahl`);
		expect(hinweis).toContain(`(Rz. 44 ad Art. 712m). ${BEFUGNISSE_STREICHEN} Ist die Gemeinschaft ohne`);
		expect(hinweis.indexOf(WAHL_STUECKE.vollmachten)).toBeLessThan(hinweis.indexOf(WAHL_STUECKE.kommentar));
		expect(hinweis).not.toContain('verlangt deshalb das qualifizierte Mehr');
		// Kein Satz der Vorfassung geht verloren: Ohne die neuen Sätze und in der alten Reihenfolge
		// ergeben die Stücke genau den alten Hinweis.
		const W = WAHL_STUECKE;
		expect(
			[
				ERWEITERUNG,
				W.was,
				W.nur712s,
				W.kommentar.replace(`(Rz. 46 ad Art. 712q). ${STUETZE_RZ112} Ein`, '(Rz. 46 ad Art. 712q); ein'),
				'Diese Karte verlangt deshalb das qualifizierte Mehr.',
				W.vollmachten.replace(` ${VORSITZ_WAHL}`, ''),
				W.ohne,
				W.anfechtung.replace(ANFECHTUNG_VERWEIS, '')
			].join(' ')
		).toBe(WAHL_HINWEIS_VORHER);
		// Unter einer Regel tritt derselbe Hinweis zurück: Der Schlüssel zieht mit.
		expect((k.hinweiseUnterRegel ?? []).map((u) => u.hinweis)).toContain(hinweis);

		const einfach = knotenNachLesart(NEU, k, { ...LESARTEN_VORGABE, L4: 'einfach' });
		const ersatz = nachDieserFassung(WAHL_HINWEIS_EINFACH);
		expect(einfach.hinweise).toContain(ersatz);
		expect(einfach.hinweise).not.toContain(hinweis);
		expect(ersatz).toContain(STUETZE_RZ112_EINFACH);
		expect(ersatz).toContain(VORSITZ_WAHL);
		expect(ersatz.endsWith(WARTEN_DANACH_WAHL)).toBe(true);
		expect(ersatz).toContain('der bisherigen Bewirtschaftung');
		// Unter «einfach» genügt das einfache Mehr ohnehin.
		expect(ersatz).not.toContain(BEFUGNISSE_STREICHEN);
	});

	it('der Grenzfall der Nutzung: die Köpfe mit Vorbehalt, die Lage dazwischen, die Wartezeit wie unter L13', () => {
		const hinweise = knoten(NEU, 'k-grenzfall-nutzung').hinweise ?? [];
		expect(hinweise).toContain(GRENZFALL);
		expect(hinweise).not.toContain(GRENZFALL_VORHER);
		expect(hinweise.length).toBe((knoten(VOR, 'k-grenzfall-nutzung').hinweise ?? []).length);
		expect(GRENZFALL).toContain('«Mehrheit aller Miteigentümer»');
		expect(GRENZFALL.endsWith(WARTEN_DANACH)).toBe(true);
		expect(GRENZFALL).not.toContain('einige Tage');
	});

	it('die alte Fassung behält ihre Sätze', () => {
		expect(JSON.stringify(VOR)).toContain('erwähnt, aber nicht beurteilt');
		expect(JSON.stringify(VOR)).toContain(GRENZFALL_VORHER);
		expect(JSON.stringify(VOR)).not.toContain('Rz. 75 und 76a ad Art. 712n');
	});
});
