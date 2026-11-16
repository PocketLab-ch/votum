/**
 * Fassung 2026-11-05 (F4c, Block 1): die eigene Schranke des Reglements als
 * Lesart der Gemeinschaft (L6).
 *
 * Geprüft am Knoten `k-reglement-eigene-schranke`: die neue Begründung, die
 * zwei geänderten Sätze im Hinweis «Zum Streit», die weggefallene
 * Gegenmeinung und die Lesart L6; sonst ist die Fassung gleich wie 2026-11-04
 * (Typ, Bezugsgrössen und Verhalten jedes Knotens).
 */
import { describe, expect, it, vi } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk, knotenDerFassung } from '$lib/rules';
import {
	BEGRUENDUNG,
	BEGRUENDUNG_VORHER,
	EIGENE_SCHRANKE_ID,
	SELBST_HILFE,
	WEG_ANKER,
	WEG_NACH_GESETZ,
	WEG_NACH_GESETZ_SATZ,
	STREIT_ANFECHTBAR,
	STREIT_ANFECHTBAR_VORHER,
	STREIT_VERKUENDUNG,
	STREIT_VERKUENDUNG_VORHER,
	ZUM_STREIT,
	ZUM_STREIT_VORHER
} from '$lib/rules/quorum-2026-11-05';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten, umstrittenSatz } from '$lib/domain/entscheidbaum';
import {
	LESARTEN_VORGABE,
	knotenNachLesart,
	pruefeLesartenImRegelwerk,
	type Lesartenwahl
} from '$lib/domain/lesarten';

const NEU = holeRegelwerk('2026-11-05');
const VOR = holeRegelwerk('2026-11-04');
const GESETZ: Lesartenwahl = { ...LESARTEN_VORGABE, L6: 'gesetz' };

function knoten(rw: Regelwerk, id: string): Ergebnisknoten {
	const gefunden = rw.knoten.find((k) => k.id === id);
	if (!gefunden) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return gefunden;
}

describe('Fassung 2026-11-05', () => {
	it('ist seit E1 nicht mehr die aktuelle Fassung und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-18');
		expect(NEU.fassung).toBe('2026-11-05');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('nach der Lesart der Gemeinschaft');
	});

	it('ändert am Erfordernis nichts: Typ, Bezugsgrössen und Verhalten jedes Knotens wie in 2026-11-04', () => {
		// Die Fragen gleich bis auf die Hilfe an «f3-1-selbst» (Fachprüfung 05.11.2026, E-1).
		const ohneSelbstHilfe = (rw: Regelwerk) =>
			rw.fragen.map((f) => ({
				...f,
				antworten: f.antworten.map((a) => (a.id === 'f3-1-selbst' ? { ...a, hilfe: undefined } : a))
			}));
		expect(ohneSelbstHilfe(NEU)).toEqual(ohneSelbstHilfe(VOR));
		const selbst = (rw: Regelwerk) => rw.fragen.flatMap((f) => f.antworten).find((a) => a.id === 'f3-1-selbst');
		expect(selbst(VOR)?.hilfe).toBeUndefined();
		expect(selbst(NEU)?.hilfe).toBe(SELBST_HILFE);
		// Runde 2, R2-E-1: Die Betroffenen kommen «zudem» (Art. 712g Abs. 4), nicht statt der Klausel.
		expect(SELBST_HILFE).not.toContain('geht der Klausel vor');
		expect(SELBST_HILFE).toContain('Unter «Klausel anwenden» bleiben Sie hier');
		// Runde 3, R3-K-1: Die gewöhnliche Bestimmung bleibt an dieser Antwort.
		expect(SELBST_HILFE).toContain('eine gewöhnliche Bestimmung, etwa ein Kostenschlüssel, bleibt hier');
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const n of NEU.knoten) {
			const v = knoten(VOR, n.id);
			expect(n.typ, n.id).toBe(v.typ);
			expect(n.kopfbasis, n.id).toBe(v.kopfbasis);
			expect(n.quotenbasis, n.id).toBe(v.quotenbasis);
			expect(n.zustimmungBetroffenerNoetig, n.id).toBe(v.zustimmungBetroffenerNoetig);
			expect(n.reglementsverhalten, n.id).toBe(v.reglementsverhalten);
			expect(n.rang, n.id).toBe(v.rang);
			expect(n.einstimmigkeitsweg, n.id).toBe(v.einstimmigkeitsweg);
			// Nur am Knoten mit L6 kommt die Lesart ans Erfordernis dazu.
			const { gemeinschaftslesart: _l, ...neu } = { ...erfordernisAusKnoten(NEU, n), fassung: '' };
			void _l;
			const { gemeinschaftslesart: _vl, ...vor } = { ...erfordernisAusKnoten(VOR, v), fassung: '' };
			void _vl;
			expect(neu, n.id).toEqual(vor);
		}
	});

	it('ändert nur die eigene Schranke, und an ihr Begründung, Hinweise, Gegenmeinung und Lesart', () => {
		const geaendert = NEU.knoten.filter((n) => JSON.stringify(n) !== JSON.stringify(knoten(VOR, n.id))).map((n) => n.id);
		expect(geaendert).toEqual([EIGENE_SCHRANKE_ID]);
		const { hinweise: _h, begruendung: _b, gegenmeinung: _g, lesart: _l, ...rest } = knoten(NEU, EIGENE_SCHRANKE_ID);
		void _h;
		void _b;
		void _g;
		void _l;
		const {
			hinweise: _vh,
			begruendung: _vb,
			gegenmeinung: _vg,
			lesart: _vl,
			...vorRest
		} = knoten(VOR, EIGENE_SCHRANKE_ID);
		void _vh;
		void _vb;
		void _vg;
		void _vl;
		expect(rest).toEqual(vorRest);
	});

	it('trägt die neue Begründung; die alte mit ihrem Werkzeugsatz steht nur noch in der Vorfassung', () => {
		const k = knoten(NEU, EIGENE_SCHRANKE_ID);
		expect(k.begruendung).toBe(BEGRUENDUNG);
		expect(BEGRUENDUNG).toContain('stellt Ihre Gemeinschaft ein; das Ergebnis nach der anderen Regel nennt Votum dazu');
		expect(BEGRUENDUNG).toContain('Sicher ist ein Beschluss, dem alle Eigentümer zustimmen.');
		expect(BEGRUENDUNG).not.toContain('dieses Werkzeug');
		expect(BEGRUENDUNG_VORHER).toBe(knoten(VOR, EIGENE_SCHRANKE_ID).begruendung);
		expect(BEGRUENDUNG_VORHER).toContain('— deshalb setzt dieses Werkzeug die Einstimmigkeit an.');
	});

	it('trägt die Gegenmeinung nicht mehr; umstrittenSatz schweigt am Knoten, die Vorfassung sagt sie noch', () => {
		const k = knoten(NEU, EIGENE_SCHRANKE_ID);
		expect(k.gegenmeinung).toBeUndefined();
		const e = erfordernisAusKnoten(NEU, k);
		expect(umstrittenSatz(e, knotenDerFassung(e.fassung, e.knotenId))).toBeNull();
		const v = knoten(VOR, EIGENE_SCHRANKE_ID);
		expect(v.gegenmeinung).toMatch(/^gilt die Klausel nicht/);
		const ev = erfordernisAusKnoten(VOR, v);
		expect(umstrittenSatz(ev, knotenDerFassung(ev.fassung, ev.knotenId))).toMatch(
			/Gerechnet wird die strenge Lesart; wer sie erreicht, genügt auch der anderen\. Nach anderer Ansicht gilt die Klausel nicht/
		);
	});

	it('ändert im Hinweis «Zum Streit» die zwei Sätze; der Rest bleibt, wie er war', () => {
		const k = knoten(NEU, EIGENE_SCHRANKE_ID);
		const streit = (k.hinweise ?? []).find((h) => h.startsWith('Zum Streit:'));
		expect(streit).toBe(ZUM_STREIT);
		expect((knoten(VOR, EIGENE_SCHRANKE_ID).hinweise ?? []).find((h) => h.startsWith('Zum Streit:'))).toBe(ZUM_STREIT_VORHER);
		expect(ZUM_STREIT).toContain(STREIT_VERKUENDUNG);
		expect(ZUM_STREIT).toContain(STREIT_ANFECHTBAR);
		expect(ZUM_STREIT).not.toContain(STREIT_VERKUENDUNG_VORHER);
		expect(ZUM_STREIT).not.toContain(STREIT_ANFECHTBAR_VORHER);
		// Zwischen den zwei Sätzen derselbe Wortlaut wie in der Vorfassung.
		const mitte = (t: string) => t.slice(t.indexOf('Wer der Ablehnung nicht zugestimmt hat'), t.indexOf('Ob das Gericht dann'));
		expect(mitte(ZUM_STREIT)).toBe(mitte(ZUM_STREIT_VORHER));
	});

	it('trägt die Lesart L6; nach «gesetz» rechnet der getauschte Baum das qualifizierte Mehr', () => {
		const k = knoten(NEU, EIGENE_SCHRANKE_ID);
		expect(k.lesart).toEqual({
			kennung: 'L6',
			andere: {
				wahl: 'gesetz',
				typ: 'qualifiziertes_mehr',
				rechtsgrundlage: 'ZGB Art. 712g Abs. 3',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'alle_quoten',
				einstimmigkeitsweg: WEG_NACH_GESETZ
			}
		});
		const getauscht = knotenNachLesart(NEU, k, GESETZ);
		// R2-G-3: Nur nach «gesetz» der Satz zur Verkündung ohne Vorbehalt, hinter dem Anker; sonst derselbe Weg.
		expect(k.einstimmigkeitsweg).toBe(knoten(VOR, EIGENE_SCHRANKE_ID).einstimmigkeitsweg);
		expect(k.einstimmigkeitsweg).not.toContain(WEG_NACH_GESETZ_SATZ);
		expect(getauscht.einstimmigkeitsweg).toBe(
			k.einstimmigkeitsweg!.replace(WEG_ANKER, `${WEG_ANKER} ${WEG_NACH_GESETZ_SATZ}`)
		);
		expect(knotenNachLesart(NEU, k, { ...GESETZ, L6: 'klausel' }).einstimmigkeitsweg).toBe(k.einstimmigkeitsweg);
		expect(getauscht.typ).toBe('qualifiziertes_mehr');
		expect(getauscht.rechtsgrundlage).toBe('ZGB Art. 712g Abs. 3');
		expect(getauscht.kopfbasis).toBe('anwesend_vertreten');
		expect(getauscht.quotenbasis).toBe('alle_quoten');
		// Der Rang wechselt mit: Nach «gesetz» trägt das Gesetz das Erfordernis, nicht das Reglement.
		expect(k.rang).toBe('reglement');
		expect(getauscht.rang).toBe('gesetz');
		expect(pruefeRegelwerk({ ...NEU, knoten: NEU.knoten.map((x) => knotenNachLesart(NEU, x, GESETZ)) })).toEqual([]);
	});

	it('bricht ab, wenn der alte Wortlaut in der Vorfassung fehlt: die Ableitung verlangt ihn', async () => {
		vi.resetModules();
		vi.doMock('$lib/rules/quorum-2026-11-04', async () => {
			const modul = (await vi.importActual('$lib/rules/quorum-2026-11-04')) as typeof import('$lib/rules/quorum-2026-11-04');
			return {
				...modul,
				REGELWERK_2026_11_04: {
					...modul.REGELWERK_2026_11_04,
					knoten: modul.REGELWERK_2026_11_04.knoten.map((k) =>
						k.id === EIGENE_SCHRANKE_ID ? { ...k, begruendung: `${k.begruendung} Ein Zusatz.` } : k
					)
				}
			};
		});
		try {
			await expect(import('$lib/rules/quorum-2026-11-05')).rejects.toThrow(/Fassung 2026-11-05/);
		} finally {
			vi.doUnmock('$lib/rules/quorum-2026-11-04');
			vi.resetModules();
		}
	});
});
