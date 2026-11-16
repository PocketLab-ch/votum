/**
 * Lesarten der Gemeinschaft im Kern (Migration 169, Entscheid 0018).
 *
 * Gemessen an einer Fassung, in der `k-bewirtschaftung-waehlen` die Lesart L4
 * trägt: So hängt der Katalog nicht an einer Fassung. Die echte Fassung mit
 * eigenem Knoten misst `verwaltung-wahl-2026-10-24.test.ts`.
 *
 * **Der nachgebaute Knoten rechnet das einfache Mehr**, wie die Knoten zu L4
 * bis zur Fassung 2026-11-11. Seit der Fassung 2026-11-13 ist das nicht mehr
 * die Vorgabe (Entscheid 0048, Block B): Die Wahl «einfach» ist hier die Wahl
 * des Knotens (`EINFACH_L4`), «qualifiziert» die andere und die Vorgabe. Wo
 * ein Test die Vorgabe an der aktuellen Fassung prüft, rechnet der Knoten sie
 * (`mitL4NachVorgabe`).
 */
import { describe, expect, it } from 'vitest';
import {
	darfLesartenUmstellen,
	erfordernisNachAndererLesart,
	LESARTEN,
	LESARTEN_VORGABE,
	knotenNachLesart,
	lesartVon,
	pruefeLesartenImRegelwerk,
	pruefeLesartenwahl,
	wahlInWorten,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import { erfordernisAusKnoten, uebersteuere, waehleErfordernis, zahlenbeispiel } from '$lib/domain/entscheidbaum';
import {
	ANFECHTUNGSFRIST,
	andereLesartInWorten,
	angehoerigenhinweis,
	lesartKartensatz,
	lesartProtokollsatz,
	zaehleAus,
	ZAEHLBASIS_ANWESENDE_FOLGE,
	ZAEHLBASIS_VERKUENDET
} from '$lib/domain/auszaehlung';
import { wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import type { Regelwerk } from '$lib/domain/regelwerk';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { AKTUELLE_FASSUNG, FASSUNGEN, holeRegelwerk, knotenFuerUmstritten } from '$lib/rules';
import { erfordernisFuerRueckkommen } from '$lib/domain/rueckkommen';

const KNOTEN = 'k-bewirtschaftung-waehlen';

/** Die aktuelle Fassung, mit L4 an der Wahl der Bewirtschaftung. */
function mitL4(): Regelwerk {
	const rw = holeRegelwerk();
	return {
		...rw,
		knoten: rw.knoten.map((k) =>
			k.id === KNOTEN
				? {
						...k,
						lesart: {
							kennung: 'L4' as const,
							andere: {
								wahl: 'qualifiziert',
								typ: 'qualifiziertes_mehr' as const,
								rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
								kopfbasis: 'anwesend_vertreten' as const,
								quotenbasis: 'alle_quoten' as const
							}
						}
					}
				: k
		)
	};
}

/** Die Wahl, die der nachgebaute Knoten rechnet; seit Block B nicht mehr die Vorgabe. */
const EINFACH_L4: Lesartenwahl = { ...LESARTEN_VORGABE, L4: 'einfach' };

/**
 * Derselbe Knoten, wie ihn die aktuelle Fassung nach der Vorgabe trüge: das
 * qualifizierte Mehr, «andere» das einfache (wie
 * `k-bewirtschaftung-waehlen-erweitert` ab der Fassung 2026-11-13).
 */
function mitL4NachVorgabe(): Regelwerk {
	const rw = mitL4();
	return {
		...rw,
		knoten: rw.knoten.map((k) =>
			k.id === KNOTEN
				? {
						...k,
						typ: 'qualifiziertes_mehr' as const,
						rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
						quotenbasis: 'alle_quoten' as const,
						lesart: {
							kennung: 'L4' as const,
							andere: {
								wahl: 'einfach',
								typ: 'einfaches_mehr' as const,
								rechtsgrundlage: k.rechtsgrundlage,
								kopfbasis: 'anwesend_vertreten' as const,
								quotenbasis: 'keine' as const
							}
						}
					}
				: k
		)
	};
}

function hergeleitet() {
	const rw = mitL4();
	return erfordernisAusKnoten(rw, rw.knoten.find((k) => k.id === KNOTEN)!);
}

describe('Katalog', () => {
	it('kennt L4 mit Vorgabe qualifiziertes Mehr (seit Block B, Entscheid 0048)', () => {
		const l4 = LESARTEN.find((l) => l.kennung === 'L4')!;
		expect(l4.vorgabe).toBe('qualifiziert');
		expect(LESARTEN_VORGABE.L4).toBe('qualifiziert');
		expect(l4.wahlen.map((w) => w.wert)).toEqual(['qualifiziert', 'einfach']);
		expect(wahlInWorten('L4', 'qualifiziert')).toBe('Qualifiziertes Mehr (Vorgabe)');
		expect(wahlInWorten('L4', 'einfach')).toBe('Einfaches Mehr');
	});

	it('weist eine unbekannte Wahl ab und lässt Fehlendes weg', () => {
		expect(pruefeLesartenwahl({})).toEqual({});
		expect(
			pruefeLesartenwahl({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' })
		).toEqual({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' });
		expect(pruefeLesartenwahl({ L6: 'gesetz' })).toEqual({ L6: 'gesetz' });
		expect(() => pruefeLesartenwahl({ L1: 'bleibt', L2: 'einfach', L4: 'zwei_drittel' })).toThrow(/Unbekannte Wahl/);
		expect(() => pruefeLesartenwahl({ L1: 'halb' })).toThrow(/Unbekannte Wahl «halb» für die Lesart L1/);
		expect(() => pruefeLesartenwahl({ L6: 'alle' })).toThrow(/Unbekannte Wahl «alle» für die Lesart L6/);
		expect(pruefeLesartenwahl({ L1: 'faellt_heraus' })).toEqual({ L1: 'faellt_heraus' });
	});

	it('prüft die Lesart am Knoten gegen den Katalog', () => {
		expect(pruefeLesartenImRegelwerk(mitL4NachVorgabe(), AKTUELLE_FASSUNG)).toEqual([]);
		const falsch = mitL4NachVorgabe();
		const k = falsch.knoten.find((x) => x.id === KNOTEN)!;
		k.lesart = { ...k.lesart!, andere: { ...k.lesart!.andere, wahl: 'qualifiziert' } };
		expect(pruefeLesartenImRegelwerk(falsch, AKTUELLE_FASSUNG).join()).toMatch(/andere Wahl ist die Vorgabe/);
	});

	it('prüft, dass der Knoten die Vorgabe rechnet und «andere» die andere Wahl (Pendenz Block 1, Review DeepSeek)', () => {
		// Vertauscht: Der Knoten rechnet das einfache Mehr, obwohl die Vorgabe
		// «qualifiziert» ist. Bis zum 30.10.2026 blieb das grün (damals in der
		// Gegenrichtung, solange die Vorgabe «einfach» war).
		const vertauscht = mitL4NachVorgabe();
		const k = vertauscht.knoten.find((x) => x.id === KNOTEN)!;
		Object.assign(k, { typ: 'einfaches_mehr', quotenbasis: 'keine' });
		expect(pruefeLesartenImRegelwerk(vertauscht, AKTUELLE_FASSUNG).join()).toMatch(/rechnet nicht die Vorgabe «qualifiziert»/);
		// Der Knoten mit dem einfachen Mehr ist an der aktuellen Fassung genau dieser Fall.
		expect(pruefeLesartenImRegelwerk(mitL4(), AKTUELLE_FASSUNG).join()).toMatch(/rechnet nicht die Vorgabe «qualifiziert»/);

		const andere = mitL4NachVorgabe();
		const l = andere.knoten.find((x) => x.id === KNOTEN)!;
		l.lesart = { ...l.lesart!, andere: { ...l.lesart!.andere, quotenbasis: 'alle_quoten' } };
		expect(pruefeLesartenImRegelwerk(andere, AKTUELLE_FASSUNG).join()).toMatch(/rechnet nicht die Wahl «einfach»/);
	});

	it('meldet einen Ersatzhinweis, dessen Vorlage am Knoten fehlt oder doppelt steht (Featureprüfung E1, B7)', () => {
		const rw = mitL4();
		const k = rw.knoten.find((x) => x.id === KNOTEN)!;
		k.hinweise = ['Ein Hinweis nach der Vorgabe.'];
		const mit = (alt: string) => {
			k.lesart = { ...k.lesart!, andere: { ...k.lesart!.andere, hinweisErsatz: [{ alt, neu: 'Neu.' }] } };
			return pruefeLesartenImRegelwerk(rw, AKTUELLE_FASSUNG).join();
		};
		expect(mit('Ein Hinweis nach der Vorgabe.')).not.toMatch(/Ersatzhinweis/);
		expect(knotenNachLesart(rw, k, { ...LESARTEN_VORGABE, L4: 'qualifiziert' }).hinweise).toEqual(['Neu.']);
		expect(mit('Ein Hinweis, den es nicht gibt.')).toMatch(/Ersatzhinweis steht 0-mal/);
		// Ohne die Prüfung tauschte `knotenNachLesart` hier still nichts.
		expect(knotenNachLesart(rw, k, { ...LESARTEN_VORGABE, L4: 'qualifiziert' }).hinweise).toEqual(['Ein Hinweis nach der Vorgabe.']);
		k.hinweise = ['Doppelt.', 'Doppelt.'];
		expect(mit('Doppelt.')).toMatch(/Ersatzhinweis steht 2-mal/);
	});

	it('trägt je Wahl von L2, L4 und L6 das Mehr, und die Fassungen rechnen danach', () => {
		for (const kennung of ['L2', 'L4', 'L6'] as const) {
			for (const w of lesartVon(kennung)!.wahlen) expect(w.mehr, `${kennung} ${w.wert}`).toBeDefined();
		}
		for (const f of Object.keys(FASSUNGEN)) expect(pruefeLesartenImRegelwerk(holeRegelwerk(f), AKTUELLE_FASSUNG), f).toEqual([]);
	});

	it('kennt L6 mit Vorgabe Klausel und den Wortlauten aus dem Auftrag', () => {
		const l6 = LESARTEN.find((l) => l.kennung === 'L6')!;
		expect(l6.vorgabe).toBe('klausel');
		expect(LESARTEN_VORGABE.L6).toBe('klausel');
		expect(l6.wahlen.map((w) => w.wert)).toEqual(['klausel', 'gesetz']);
		expect(wahlInWorten('L6', 'klausel')).toBe('Klausel anwenden (Vorgabe)');
		expect(wahlInWorten('L6', 'gesetz')).toBe('Nach dem Gesetz');
		expect(l6.frage).toBe(
			'Verlangt Ihr Reglement für seine eigene Änderung die Zustimmung aller: Gilt diese Klausel, ' +
				'oder genügt das qualifizierte Mehr nach dem Gesetz?'
		);
		expect(l6.wahlen[0].wirkung).toBe(
			'Die Änderung ist nur angenommen, wenn alle Eigentümer zustimmen, auch die abwesenden. ' +
				'Wer weder da noch vertreten ist, zählt wie ein Nein.'
		);
		expect(l6.wahlen[1].wirkung).toContain('Die Klausel im Reglement wendet Votum dann nicht an.');
		expect(l6.geltung).toContain('Karte «Reglement verlangt für seine Änderung selbst Einstimmigkeit»');
		// Entscheid 0042: Eine hinterlegte strengere Regel an «Reglement ändern,
		// gewöhnliche Bestimmung» wirkt unabhängig von L6; der Satz nennt die
		// Karte mit ihrem Titel in der aktuellen Fassung.
		const normal = holeRegelwerk().knoten.find((k) => k.id === 'k-reglement-normal');
		expect(normal?.titel).toBe('Reglement ändern, gewöhnliche Bestimmung');
		expect(l6.geltung).toContain(
			'Steht auf der Reglementsseite für «Reglement ändern, gewöhnliche Bestimmung» eine Regel, die in jeder ' +
				'Hinsicht strenger ist als das Gesetz, rechnet Votum dort unabhängig von dieser Einstellung nach ihr'
		);
		// Runde 2: R2-G-1 und Laien 1 (Weg zur Klausel), R2-E-1 (Nutzungsrechte je Wahl),
		// Laien 2 (Bindung ans Urteil, Rz. 235), R2-G-2 (Rz. 234), Laien 3 (wer zugestimmt hat).
		expect(l6.geltung).toContain('greift die Einstellung nur, wenn Sie im Entscheidbaum die Antwort zur Klausel wählen');
		expect(l6.geltung).toContain('unter «Klausel anwenden» die Antwort zur Klausel');
		expect(l6.geltung).not.toContain('oder die Zustimmung der direkt Betroffenen, gilt das unabhängig');
		expect(l6.ratNachAblehnung).toContain('Hält es die Klausel für ungültig, genügt für diesen Antrag dann das qualifizierte Mehr');
		// Runde 3, R3-L-1: Zeitpunkt und Reichweite der Umstellung.
		expect(l6.ratNachAblehnung).toContain('vor der Freigabe der Versammlung auf «Nach dem Gesetz»');
		expect(l6.ratNachAblehnung).toContain('nur für denselben Gegenstand (BGer 5A_521/2016 E. 3.3.4)');
		expect(l6.nachAnnahme).toContain('fällt sie rückwirkend weg (SVIT-Kommentar Rz. 230, 231 und 234 ad Art. 712m)');
		expect(l6.warumVorgabe).toContain('Wer der Klausel selbst zugestimmt hat, etwa bei ihrer Einführung,');
	});
});

describe('Rechte', () => {
	it('Verwaltung immer, Sitzungsleitung nur mit Erlaubnis', () => {
		expect(darfLesartenUmstellen('admin', 'verwaltung')).toBe(true);
		expect(darfLesartenUmstellen('admin', 'verwaltung_und_leitung')).toBe(true);
		expect(darfLesartenUmstellen('chair', 'verwaltung')).toBe(false);
		expect(darfLesartenUmstellen('chair', 'verwaltung_und_leitung')).toBe(true);
		expect(darfLesartenUmstellen(null, 'verwaltung_und_leitung')).toBe(false);
	});
});

describe('Am Erfordernis', () => {
	it('trägt beim Herleiten die Wahl des Knotens und daneben die andere Wahl', () => {
		const e = hergeleitet();
		expect(e.typ).toBe('einfaches_mehr');
		// «vorgabe» ist Herkunft am Katalog: Seit Block B ist «einfach» nicht mehr die Vorgabe.
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L4', wahl: 'einfach', vorgabe: false });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'qualifiziert',
			typ: 'qualifiziertes_mehr',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		});
	});

	it('bleibt nach der Wahl des Knotens, wie es ist', () => {
		const e = hergeleitet();
		expect(wendeLesartAn(e, EINFACH_L4)).toBe(e);
	});

	it('tauscht nach der anderen Wahl Mehr und Gegenstück', () => {
		const e = hergeleitet();
		const q = wendeLesartAn(e, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' });
		expect(q.typ).toBe('qualifiziertes_mehr');
		expect(q.quotenbasis).toBe('alle_quoten');
		expect(q.rechtsgrundlage).toBe('ZGB Art. 647b Abs. 1');
		expect(q.gemeinschaftslesart).toMatchObject({ wahl: 'qualifiziert', vorgabe: true });
		expect(q.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'einfach',
			typ: 'einfaches_mehr',
			quotenbasis: 'keine',
			rechtsgrundlage: e.rechtsgrundlage
		});
		// Zurück ergibt dasselbe wie vorher.
		expect(wendeLesartAn(q, EINFACH_L4)).toMatchObject({
			typ: e.typ,
			quotenbasis: e.quotenbasis,
			gemeinschaftslesart: e.gemeinschaftslesart
		});
	});

	it('nennt das Erfordernis der anderen Lesart ohne Lesart daran', () => {
		const e = hergeleitet();
		const anders = erfordernisNachAndererLesart(e)!;
		expect(anders.typ).toBe('qualifiziertes_mehr');
		expect(anders.gemeinschaftslesart).toBeUndefined();
		expect(erfordernisNachAndererLesart({ ...e, gemeinschaftslesart: undefined })).toBeNull();
	});

	it('lässt ein Erfordernis ohne Lesart unberührt', () => {
		const rw = holeRegelwerk();
		const e = erfordernisAusKnoten(rw, rw.knoten.find((k) => k.id === 'k-bewirtschaftung-abberufen')!);
		expect(e.gemeinschaftslesart).toBeUndefined();
		expect(wendeLesartAn(e, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' })).toBe(e);
	});
});

describe('Über wendeReglementAn', () => {
	it('wendet die Wahl an, wo keine Regel gilt', () => {
		const a = wendeReglementAn(hergeleitet(), [], null, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' });
		expect(a.erfordernis.typ).toBe('qualifiziertes_mehr');
		expect(a.erfordernis.gemeinschaftslesart?.wahl).toBe('qualifiziert');
	});

	it('lässt die Lesart fallen, wo eine Regel des Reglements gilt', () => {
		const regel: Reglementsregel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: 'organe',
			knotenId: null,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Art. 9',
			enthaltungZaehltMit: true
		};
		const a = wendeReglementAn(hergeleitet(), [regel], null, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' });
		expect(a.erfordernis.quelle).toBe('reglement');
		expect(a.erfordernis.gemeinschaftslesart).toBeUndefined();
	});

	it('trägt die Lesart auch am Knoten, den die Leitung wählt', () => {
		const rw = mitL4();
		const gewaehlt = waehleErfordernis(rw, KNOTEN).ergebnis;
		const a = wendeReglementAn(gewaehlt, [], null, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' });
		expect(a.erfordernis.typ).toBe('qualifiziertes_mehr');
	});

	it('lässt sie fallen, wenn die Leitung das Mehr von Hand übersteuert', () => {
		const rw = mitL4();
		const u = uebersteuere(rw, hergeleitet(), 'einstimmigkeit', 'Die Versammlung will Einstimmigkeit.');
		expect(u.ergebnis.gemeinschaftslesart).toBeUndefined();
	});
});

describe('Befunde der Codeprüfung, Teil 1', () => {
	const EINSTELLUNG = { fundstelle: 'Reglement Art. 5' };

	it('bildet das andere Mehr mit eigener Behandlung der Enthaltungen (Wahl des Knotens)', () => {
		const e = wendeReglementAn(hergeleitet(), [], EINSTELLUNG, EINFACH_L4).erfordernis;
		// Beim einfachen Mehr der Anwesenden wirkt die Einstellung …
		expect(e.enthaltungZaehltMit).toBe(false);
		// … beim qualifizierten der anderen Lesart nicht.
		const anders = erfordernisNachAndererLesart(e)!;
		expect(anders.typ).toBe('qualifiziertes_mehr');
		expect(anders.enthaltungZaehltMit).toBeUndefined();
		expect(anders.rechtsgrundlage).not.toMatch(/Enthaltungen/);
	});

	it('ebenso umgekehrt (andere Wahl gewählt)', () => {
		const e = wendeReglementAn(hergeleitet(), [], EINSTELLUNG, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' }).erfordernis;
		expect(e.typ).toBe('qualifiziertes_mehr');
		expect(e.enthaltungZaehltMit).toBeUndefined();
		const anders = erfordernisNachAndererLesart(e)!;
		expect(anders.typ).toBe('einfaches_mehr');
		expect(anders.enthaltungZaehltMit).toBe(false);
		expect(anders.rechtsgrundlage).toMatch(/Enthaltungen nach dem Reglement/);
	});

	it('das Rückkommen übernimmt das Mehr des Beschlusses, nicht seine Lesart', () => {
		// Nur am angenommenen Ziel übernimmt es dessen Mehr; am abgelehnten gilt
		// das einfache Mehr des Ordnungsantrags, das nie eine Lesart trägt.
		const r = erfordernisFuerRueckkommen(hergeleitet(), true);
		expect(r.typ).toBe('einfaches_mehr');
		expect(r.gemeinschaftslesart).toBeUndefined();
	});

	it('tauscht ein schon eigens gebildetes anderes Mehr samt Enthaltungen', () => {
		const vorgabe = wendeReglementAn(hergeleitet(), [], EINSTELLUNG, EINFACH_L4).erfordernis;
		const direkt = wendeReglementAn(hergeleitet(), [], EINSTELLUNG, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' }).erfordernis;
		const getauscht = wendeLesartAn(vorgabe, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste' });
		expect(getauscht.typ).toBe('qualifiziertes_mehr');
		expect(getauscht.enthaltungZaehltMit).toBeUndefined();
		expect(getauscht.gemeinschaftslesart?.andere).toMatchObject({
			typ: 'einfaches_mehr',
			enthaltungZaehltMit: false
		});
		expect(getauscht.gemeinschaftslesart?.andere.enthaltungZaehltMit).toBe(
			direkt.gemeinschaftslesart?.andere.enthaltungZaehltMit
		);
	});
});

describe('L6 an der eigenen Schranke (Fassung 2026-11-05)', () => {
	const SCHRANKE = 'k-reglement-eigene-schranke';

	function hergeleitet(wahlen: Lesartenwahl = LESARTEN_VORGABE) {
		const rw = holeRegelwerk();
		const k = rw.knoten.find((x) => x.id === SCHRANKE)!;
		return wendeLesartAn(erfordernisAusKnoten(rw, k), wahlen);
	}

	it('rechnet nach der Vorgabe die Zustimmung aller und trägt die andere Wahl daneben', () => {
		const e = hergeleitet();
		expect(e.typ).toBe('einstimmigkeit');
		expect(e.kopfbasis).toBe('alle_eigentuemer');
		expect(e.quotenbasis).toBe('keine');
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'klausel', vorgabe: true });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'gesetz',
			typ: 'qualifiziertes_mehr',
			rechtsgrundlage: 'ZGB Art. 712g Abs. 3',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten'
		});
	});

	it('rechnet nach «gesetz» das qualifizierte Mehr und nennt die Klausel daneben', () => {
		const e = hergeleitet({ ...LESARTEN_VORGABE, L6: 'gesetz' });
		expect(e.typ).toBe('qualifiziertes_mehr');
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(e.quotenbasis).toBe('alle_quoten');
		expect(e.rechtsgrundlage).toBe('ZGB Art. 712g Abs. 3');
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'gesetz', vorgabe: false });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'klausel',
			typ: 'einstimmigkeit',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine'
		});
		// Zurück ergibt dasselbe wie vorher.
		expect(wendeLesartAn(e, LESARTEN_VORGABE)).toMatchObject({
			typ: 'einstimmigkeit',
			kopfbasis: 'alle_eigentuemer',
			gemeinschaftslesart: { kennung: 'L6', wahl: 'klausel', vorgabe: true }
		});
	});

	it('weist eine Wahl ab, die der Katalog nicht führt', () => {
		expect(() => hergeleitet({ ...LESARTEN_VORGABE, L6: 'alle' } as unknown as Lesartenwahl)).toThrow(
			/Lesart L6: Die Wahl «alle» kennt dieses Erfordernis nicht/
		);
	});
});

/*
 * **L11 an der Prozessführung** (Fassung 2026-11-10, E1 Block A): Der Knoten
 * `k-prozessfuehrung` trägt die Lesart; die Vorgabe ist das qualifizierte
 * Mehr, die andere Wahl das einfache. Sechs Eigentümer zu 200, 180, 170, 160,
 * 150 und 140 von 1000; der Eigentümer zu 140 ist abwesend, weder da noch
 * vertreten.
 */
describe('L11 an der Prozessführung (Fassung 2026-11-10)', () => {
	const RW = holeRegelwerk('2026-11-10');
	const EINFACH: Lesartenwahl = { ...LESARTEN_VORGABE, L11: 'einfach' };

	const M: Snapshot = {
		meetingId: 'v-1',
		takenAt: '2026-11-10T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			['p1', 'Erika Beispiel', 200],
			['p2', 'Hans Probe', 180],
			['p3', 'Grosse Wohnung AG', 170],
			['p4', 'Ida Muster', 160],
			['p5', 'Kurt Beispiel', 150],
			['p6', 'Lisa Probe', 140]
		].map(([id, name, quote]) => ({
			partyId: id as string,
			displayName: name as string,
			representativeName: null,
			isCommunity: false,
			units: [
				{
					unitId: `${id}-u`,
					label: `Whg ${id}`,
					kind: 'unit' as const,
					countsAsHead: true,
					quota: quote as number
				}
			]
		}))
	};
	const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5'];

	function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
		return wahlen.map(([p, choice]) => ({
			partyId: p,
			unitId: `${p}-u`,
			choice,
			castAt: '2026-11-10T19:10:00.000Z',
			recordedByChair: false
		}));
	}

	function erfordernis(wahl: Lesartenwahl = LESARTEN_VORGABE) {
		const k = RW.knoten.find((x) => x.id === 'k-prozessfuehrung')!;
		return wendeLesartAn(erfordernisAusKnoten(RW, k), wahl);
	}

	it('führt L11 im Katalog mit dem qualifizierten Mehr als Vorgabe', () => {
		const l11 = lesartVon('L11')!;
		expect(l11.vorgabe).toBe('qualifiziert');
		expect(LESARTEN_VORGABE.L11).toBe('qualifiziert');
		expect(l11.wahlen.map((w) => w.wert)).toEqual(['qualifiziert', 'einfach']);
		expect(wahlInWorten('L11', 'qualifiziert')).toBe('Qualifiziertes Mehr (Vorgabe)');
		expect(wahlInWorten('L11', 'einfach')).toBe('Einfaches Mehr');
		for (const w of l11.wahlen) expect(w.mehr, w.wert).toBeDefined();
		// Die Folge der milden Wahl steht im Katalog, nicht im Code.
		// Fachprüfung E1 L11, F-1: Der Beschluss gilt bis zur Aufhebung; nicht
		// entschieden ist nur die Prozessführung gegen Dritte.
		expect(l11.folgeMilderWahl).toContain('Er gilt, bis ein Gericht ihn aufhebt.');
		expect(l11.folgeMilderWahl).toContain('dann aber auch Monate später, während der Prozess schon läuft');
		expect(l11.folgeMilderWahl).not.toContain('ist nicht geklärt');
		// Fachprüfung Block C, Nachtrag, N-F-3: «sicher» nur im Streit um das Mehr.
		expect(l11.folgeMilderWahl).toContain('Im Streit um das Mehr sicher ist eine Ermächtigung mit dem qualifizierten Mehr.');
		// F-2 und F-7: der eigene Rat nach der Annahme, mit «kann» und dem Zeitpunkt.
		expect(l11.ratNachAnnahme).toContain('kann es ihn aufheben');
		expect(l11.ratNachAnnahme!.startsWith('Er gilt ab heute, bis ein Gericht ihn aufhebt.')).toBe(true);
		// Der Fristsatz ist der des Kerns, wörtlich (Codeprüfung, Durchgang 2, N3).
		expect(l11.ratNachAnnahme).toContain(`anfechten, ${ANFECHTUNGSFRIST}.`);
		// Im Saal kein Rat zum Aktivprozess allein (Durchgang 2, M2): der steht auf der Karte.
		expect(l11.ratNachAnnahme).not.toMatch(/reicht sie|Klage ein/);
		// Nach einer Ablehnung: kein Eilweg ohne Ermächtigung (Fachprüfung Runde 3, F4).
		expect(l11.stattNaechsterVersammlung).toContain('auch im Eilfall nicht ohne Ermächtigung klagen');
	});

	it('rechnet nach der Vorgabe das qualifizierte Mehr und trägt die andere Wahl daneben', () => {
		const e = erfordernis();
		expect(e.typ).toBe('qualifiziertes_mehr');
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(e.quotenbasis).toBe('alle_quoten');
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L11', wahl: 'qualifiziert', vorgabe: true });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'einfach',
			typ: 'einfaches_mehr',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine'
		});
	});

	it('sagt auf der Karte die Folge der milden Wahl nur, wenn sie eingestellt ist', () => {
		const vorgabe = lesartKartensatz(erfordernis())!;
		expect(vorgabe).toContain('Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr»');
		expect(vorgabe).not.toContain(lesartVon('L11')!.folgeMilderWahl!);
		const mild = lesartKartensatz(erfordernis(EINFACH))!;
		expect(mild).toContain(
			'rechnet nach der Lesart «Einfaches Mehr», die für Ihre Gemeinschaft eingestellt ist'
		);
		// Nach dem Rat zur Erfassung, auf den sich «dafür» bezieht, und vor dem
		// Satz zu L1 (Durchsicht der Prüfdatei; Laienprüfung E1 L11, L-6).
		const folge = mild.indexOf(lesartVon('L11')!.folgeMilderWahl!);
		expect(folge).toBeGreaterThan(mild.indexOf('Erfassen Sie dafür'));
		expect(folge).toBeLessThan(mild.indexOf('Das Ergebnis nach der anderen Lesart rechnet über alle Wertquoten'));
	});

	it('gibt im Rat bei «einfach» den eigenen Rat der Lesart statt des allgemeinen', () => {
		// Drei Ja zu 170, 160 und 150: das einfache Mehr der fünf Anwesenden
		// erreicht, das qualifizierte nicht (480 von 1000 Wertquoten).
		const a = zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(EINFACH),
			stimmen: stimmen(['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes'], ['p1', 'no'], ['p2', 'no']),
			anwesende: ANWESENDE,
			geheim: false
		});
		expect(a.angenommen).toBe(true);
		expect(a.andereLesart).toMatchObject({
			kennung: 'L11',
			eigeneWahl: 'Einfaches Mehr',
			wahl: 'Qualifiziertes Mehr',
			feststellbar: true,
			angenommen: false,
			abweichend: true
		});
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect(s.leitung).toContain(lesartVon('L11')!.ratNachAnnahme!);
		expect(s.leitung).not.toContain('Folgt das Gericht der anderen Lesart, hebt es ihn auf.');
		// Nach der Vorgabe kommt der Rat nach einer Annahme nie: Die eigene Wahl ist
		// die strenge, und was sie annimmt, nimmt auch die milde an (Codeprüfung,
		// Durchgang 2, N5: der Kommentar sagte, der allgemeine Satz bleibe).
		const b = zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(),
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'no'], ['p5', 'no']),
			anwesende: ANWESENDE,
			geheim: false
		});
		expect(b.angenommen).toBe(true);
		expect(b.andereLesart).toMatchObject({
			eigeneWahl: 'Qualifiziertes Mehr',
			wahl: 'Einfaches Mehr',
			angenommen: true,
			abweichend: false
		});
		expect(andereLesartInWorten(b.andereLesart!, false).leitung).toBe(
			'Nach der anderen Lesart («Einfaches Mehr») dasselbe Ergebnis.'
		);
	});

	it('zeigt den Streitsatz an einem Traktandum aus einer Fassung vor dem Merkmal', () => {
		const alt = holeRegelwerk('2026-10-17');
		expect(knotenFuerUmstritten(alt.fassung, 'k-prozessfuehrung')?.gegenmeinung).toMatch(
			/^genügt das einfache Mehr/
		);
		// Die aktuelle Fassung trägt keine Gegenmeinung mehr: Die Lesart sagt es.
		expect(RW.knoten.find((x) => x.id === 'k-prozessfuehrung')?.gegenmeinung).toBeUndefined();
	});
});

/*
 * **L12 an der luxuriösen baulichen Massnahme** (Fassung 2026-11-10, E1 Block
 * B): Der Knoten `k-baulich-luxurioes` trägt die Lesart; die Vorgabe ist die
 * Zustimmung aller eingetragenen Eigentümer, die andere Wahl die aller
 * Anwesenden und Vertretenen. Sechs Eigentümer zu 200, 180, 170, 160, 150 und
 * 140 von 1000; der Eigentümer zu 140 ist abwesend, weder da noch vertreten.
 */
describe('L12 an der luxuriösen Massnahme (Fassung 2026-11-10)', () => {
	const RW = holeRegelwerk('2026-11-10');
	const ANWESENDE: Lesartenwahl = { ...LESARTEN_VORGABE, L12: 'anwesende' };

	const M: Snapshot = {
		meetingId: 'v-1',
		takenAt: '2026-11-10T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			['p1', 'Erika Beispiel', 200],
			['p2', 'Hans Probe', 180],
			['p3', 'Grosse Wohnung AG', 170],
			['p4', 'Ida Muster', 160],
			['p5', 'Kurt Beispiel', 150],
			['p6', 'Lisa Probe', 140]
		].map(([id, name, quote]) => ({
			partyId: id as string,
			displayName: name as string,
			representativeName: null,
			isCommunity: false,
			units: [
				{
					unitId: `${id}-u`,
					label: `Whg ${id}`,
					kind: 'unit' as const,
					countsAsHead: true,
					quota: quote as number
				}
			]
		}))
	};
	const ANWESENDE_PARTEIEN = ['p1', 'p2', 'p3', 'p4', 'p5'];

	function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
		return wahlen.map(([p, choice]) => ({
			partyId: p,
			unitId: `${p}-u`,
			choice,
			castAt: '2026-11-10T19:10:00.000Z',
			recordedByChair: false
		}));
	}

	function erfordernis(wahl: Lesartenwahl = LESARTEN_VORGABE) {
		const k = RW.knoten.find((x) => x.id === 'k-baulich-luxurioes')!;
		return wendeLesartAn(erfordernisAusKnoten(RW, k), wahl);
	}

	it('führt L12 im Katalog mit der Zustimmung aller als Vorgabe', () => {
		const l12 = lesartVon('L12')!;
		expect(l12.vorgabe).toBe('alle');
		expect(LESARTEN_VORGABE.L12).toBe('alle');
		expect(l12.wahlen.map((w) => w.wert)).toEqual(['alle', 'anwesende']);
		expect(wahlInWorten('L12', 'alle')).toBe('Alle eingetragenen Eigentümer (Vorgabe)');
		expect(wahlInWorten('L12', 'anwesende')).toBe('Alle Anwesenden und Vertretenen');
		for (const w of l12.wahlen) expect(w.mehr, w.wert).toBeDefined();
		// Die milde Wahl trägt die Einstimmigkeit der Anwesenden, die strenge die aller.
		expect(l12.wahlen.find((w) => w.wert === 'anwesende')!.mehr).toEqual({
			typ: 'einstimmigkeit',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine'
		});
		expect(l12.wahlen.find((w) => w.wert === 'alle')!.mehr).toEqual({
			typ: 'einstimmigkeit',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine'
		});
		// Die Folge der milden Wahl steht im Katalog, nicht im Code.
		expect(l12.folgeMilderWahl).toContain('ist der Beschluss in der Regel anfechtbar');
		// Fachprüfung E1 L12, F-1: 5A_499/2010 nur zu einer Zweckänderung.
		expect(l12.folgeMilderWahl).toContain('für eine Zweckänderung erwogen');
		expect(l12.protokollNachAnnahme).toContain('ab Erhalt des Protokolls');
		expect(l12.folgeMilderWahl).toContain('BGer 5A_499/2010 E. 8.3 und 8.6');
		expect(l12.folgeMilderWahl).toContain('Sicher ist der Beschluss mit der Zustimmung aller eingetragenen Eigentümer;');
		// Der eigene Rat nach der Annahme, und keiner nach der Ablehnung.
		expect(l12.ratNachAnnahme).toContain('Folgt das Gericht der herrschenden Lehre, hebt es ihn auf.');
		// Fachprüfung E1 L12, F-4: Die Anwesenden haben alle zugestimmt; der Rat nennt nur die Frist der Abwesenden.
		expect(l12.ratNachAnnahme).toContain('Wer weder da noch vertreten war, kann ihn beim Gericht anfechten, innert eines Monats, in der Regel ab Erhalt des Protokolls');
		expect(l12.ratNachAnnahme).not.toContain('nicht mehr angreifbar');
		expect(l12.nachAnnahme).toBeUndefined();
		// Fachprüfung E1 L12, F-5: Fehlen nur Abwesende, ist der schriftliche Beschluss der schnelle Weg.
		expect(l12.nachAblehnung).toContain('ein schriftlicher Beschluss über denselben Antrag, den alle unterschreiben');
		expect(l12.ratNachAblehnung).toBeUndefined();
	});

	it('rechnet nach der Vorgabe über alle Eigentümer und trägt die andere Wahl daneben', () => {
		const e = erfordernis();
		expect(e.typ).toBe('einstimmigkeit');
		expect(e.kopfbasis).toBe('alle_eigentuemer');
		expect(e.quotenbasis).toBe('keine');
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L12', wahl: 'alle', vorgabe: true });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'anwesende',
			typ: 'einstimmigkeit',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine'
		});
		const mild = erfordernis(ANWESENDE);
		expect(mild.kopfbasis).toBe('anwesend_vertreten');
		expect(mild.gemeinschaftslesart).toMatchObject({ kennung: 'L12', wahl: 'anwesende', vorgabe: false });
	});

	it('sagt auf der Karte die Folge der milden Wahl nur, wenn sie eingestellt ist', () => {
		const vorgabe = lesartKartensatz(erfordernis())!;
		expect(vorgabe).toContain('Dieses Traktandum rechnet nach der Lesart «Alle eingetragenen Eigentümer»');
		expect(vorgabe).not.toContain(lesartVon('L12')!.folgeMilderWahl!);
		const mild = lesartKartensatz(erfordernis(ANWESENDE))!;
		expect(mild).toContain(
			'rechnet nach der Lesart «Alle Anwesenden und Vertretenen», die für Ihre Gemeinschaft eingestellt ist'
		);
		expect(mild).toContain(lesartVon('L12')!.folgeMilderWahl!);
	});

	it('nimmt unter «anwesende» an, wenn alle Anwesenden zustimmen und einer fehlt', () => {
		const a = zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(ANWESENDE),
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']),
			anwesende: ANWESENDE_PARTEIEN,
			geheim: false
		});
		expect(a.angenommen).toBe(true);
		// Nach der Vorgabe fehlt die Zustimmung des abwesenden Eigentümers.
		expect(a.andereLesart).toMatchObject({
			kennung: 'L12',
			eigeneWahl: 'Alle Anwesenden und Vertretenen',
			wahl: 'Alle eingetragenen Eigentümer',
			feststellbar: true,
			angenommen: false,
			abweichend: true
		});
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect(s.leitung).toContain(lesartVon('L12')!.ratNachAnnahme!);
		expect(s.leitung).not.toContain('nicht mehr angreifbar');
		// Laienprüfung L-1: Das Protokoll nennt den Abwesenden ihre Frist, nur in
		// dieser Richtung (Codeprüfung Block B, Durchgang 2, N3).
		expect(s.protokoll).toContain(lesartVon('L12')!.protokollNachAnnahme!);
	});

	it('nennt nach einer Ablehnung unter der Vorgabe den schriftlichen Weg, im Protokoll keine Frist', () => {
		const a = zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(),
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']),
			anwesende: ANWESENDE_PARTEIEN,
			geheim: false
		});
		expect(a.angenommen).toBe(false);
		expect(a.andereLesart).toMatchObject({ kennung: 'L12', angenommen: true, abweichend: true });
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect(s.leitung).toContain(lesartVon('L12')!.nachAblehnung!);
		expect(s.protokoll).not.toContain(lesartVon('L12')!.protokollNachAnnahme!);
	});

	it('lehnt unter «anwesende» ab, wenn ein Anwesender sich enthält oder Nein sagt', () => {
		const enthaltung = zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(ANWESENDE),
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'abstain']),
			anwesende: ANWESENDE_PARTEIEN,
			geheim: false
		});
		expect(enthaltung.angenommen).toBe(false);
		const nein = zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(ANWESENDE),
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'no']),
			anwesende: ANWESENDE_PARTEIEN,
			geheim: false
		});
		expect(nein.angenommen).toBe(false);
	});

	it('lässt unter «anwesende» den Satz «fehlt an der Versammlung die Zustimmung aller» weg', () => {
		const k = RW.knoten.find((x) => x.id === 'k-baulich-luxurioes')!;
		const zahlen = { kopfstimmen: 6, gesamtquote: 1000, zaehlweise: 'per_owner' as const, anwesend: 5 };
		const vorgabe = zahlenbeispiel(k, zahlen)!;
		expect(vorgabe).toContain('Fehlt 1 Stimme, fehlt an der Versammlung die Zustimmung aller.');
		const mild = zahlenbeispiel(knotenNachLesart(RW, k, ANWESENDE), zahlen)!;
		expect(mild).not.toContain('fehlt an der Versammlung die Zustimmung aller');
		// N ist unter der milden Wahl die Zahl der Anwesenden und Vertretenen.
		expect(mild).toContain('nötig sind 5 Ja-Stimmen — also alle.');
	});

	it('rechnet beim Übersteuern auf Einstimmigkeit über alle Eigentümer', () => {
		const u = uebersteuere(
			RW,
			erfordernis(ANWESENDE),
			'einstimmigkeit',
			'Die Versammlung will Einstimmigkeit.'
		);
		expect(u.ergebnis.gemeinschaftslesart).toBeUndefined();
		expect(u.ergebnis.kopfbasis).toBe('alle_eigentuemer');
	});
});

/*
 * **L9 wählt die Zählbasis der Ermächtigung zur Ausschlussklage** (Fassung
 * 2026-11-10, E1 Block C): Der Knoten `k-ausschlussklage` trägt die Lesart; die
 * Vorgabe ist das einfache Mehr aller Eigentümer ohne den Beklagten, die andere
 * Wahl das der Anwesenden und Vertretenen ohne ihn. Zehn Eigentümer zu je 100
 * von 1000; der Eigentümer zu p10 ist der Beklagte und weder da noch vertreten,
 * von den neun übrigen sind sechs da oder vertreten. Das zweite Ergebnis rechnet
 * hier 1a, nicht der allgemeine Lesartenweg.
 */
describe('L9 an der Ausschlussklage (Fassung 2026-11-10)', () => {
	const RW = holeRegelwerk('2026-11-10');
	const ANWESENDE_WAHL: Lesartenwahl = { ...LESARTEN_VORGABE, L9: 'anwesende' };

	const M: Snapshot = {
		meetingId: 'v-1',
		takenAt: '2026-11-10T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			['p1', 'Erika Beispiel'],
			['p2', 'Hans Probe'],
			['p3', 'Grosse Wohnung AG'],
			['p4', 'Ida Muster'],
			['p5', 'Kurt Beispiel'],
			['p6', 'Lisa Probe'],
			['p7', 'Martin Beispiel'],
			['p8', 'Nora Probe'],
			['p9', 'Otto Muster'],
			['p10', 'Pia Beispiel']
		].map(([id, name]) => ({
			partyId: id as string,
			displayName: name as string,
			representativeName: null,
			isCommunity: false,
			units: [
				{
					unitId: `${id}-u`,
					label: `Whg ${id}`,
					kind: 'unit' as const,
					countsAsHead: true,
					quota: 100
				}
			]
		}))
	};
	const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
	const BEKLAGTER = ['p10'];

	function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
		return wahlen.map(([p, choice]) => ({
			partyId: p,
			unitId: `${p}-u`,
			choice,
			castAt: '2026-11-10T19:10:00.000Z',
			recordedByChair: false
		}));
	}

	function erfordernis(wahl: Lesartenwahl = LESARTEN_VORGABE) {
		const k = RW.knoten.find((x) => x.id === 'k-ausschlussklage')!;
		return wendeLesartAn(erfordernisAusKnoten(RW, k), wahl);
	}

	function zaehle(wahl: Lesartenwahl, stimmenAb: Vote[]) {
		return zaehleAus({
			momentaufnahme: M,
			erfordernis: erfordernis(wahl),
			stimmen: stimmenAb,
			anwesende: ANWESENDE,
			betroffeneParteiIds: BEKLAGTER,
			geheim: false
		});
	}

	/** Vier Ja, zwei Nein: an den neun übrigen zu wenig, an den sechs Anwesenden genug. */
	const VIER = stimmen(
		['p1', 'yes'],
		['p2', 'yes'],
		['p3', 'yes'],
		['p4', 'yes'],
		['p5', 'no'],
		['p6', 'no']
	);
	/** Fünf Ja, ein Nein: nach beiden Wahlen angenommen. */
	const FUENF = stimmen(
		['p1', 'yes'],
		['p2', 'yes'],
		['p3', 'yes'],
		['p4', 'yes'],
		['p5', 'yes'],
		['p6', 'no']
	);

	it('rechnet das Ergebnis an den Anwesenden mit der Einstellung zu den Enthaltungen (Codeprüfung Block C, 2)', () => {
		// Drei Ja, ein Nein, zwei Enthaltungen unter sechs Anwesenden; die Gemeinschaft
		// lässt Enthaltungen beim einfachen Mehr der Anwesenden ausserhalb der Zahl.
		// An allen neun übrigen abgelehnt, an den Anwesenden ohne Enthaltungen 3 von 4.
		const e = erfordernis();
		const mitEinstellung = {
			...e,
			gemeinschaftslesart: {
				...e.gemeinschaftslesart!,
				andere: { ...e.gemeinschaftslesart!.andere, enthaltungZaehltMit: false }
			}
		};
		const a = zaehleAus({
			momentaufnahme: M,
			erfordernis: mitEinstellung,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'no'], ['p5', 'abstain'], ['p6', 'abstain']),
			anwesende: ANWESENDE,
			betroffeneParteiIds: BEKLAGTER,
			geheim: false
		});
		expect(a.angenommen).toBe(false);
		expect(a.andereZaehlbasis?.angenommen).toBe(true);
		// Ohne die Einstellung bliebe es dasselbe Ergebnis (3 von 6).
		const ohne = zaehle(LESARTEN_VORGABE, stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'no'], ['p5', 'abstain'], ['p6', 'abstain']));
		expect(ohne.andereZaehlbasis?.angenommen).toBe(false);
	});

	it('führt L9 im Katalog mit der Mehrheit aller ohne den Beklagten als Vorgabe', () => {
		const l9 = lesartVon('L9')!;
		expect(l9.vorgabe).toBe('alle');
		expect(LESARTEN_VORGABE.L9).toBe('alle');
		expect(l9.wahlen.map((w) => w.wert)).toEqual(['alle', 'anwesende']);
		expect(wahlInWorten('L9', 'alle')).toBe('Alle Eigentümer ohne den Beklagten (Vorgabe)');
		expect(wahlInWorten('L9', 'anwesende')).toBe('Anwesende und Vertretene ohne den Beklagten');
		for (const w of l9.wahlen) expect(w.mehr, w.wert).toBeDefined();
		// Beide Wahlen zählen ein einfaches Mehr; nur die Zahl, an der gemessen
		// wird, wechselt.
		expect(l9.wahlen.find((w) => w.wert === 'alle')!.mehr).toEqual({
			typ: 'einfaches_mehr',
			kopfbasis: 'alle_ausser_betroffene',
			quotenbasis: 'keine'
		});
		expect(l9.wahlen.find((w) => w.wert === 'anwesende')!.mehr).toEqual({
			typ: 'einfaches_mehr',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine'
		});
		// Die Folge der milden Wahl steht im Katalog, nicht im Code.
		expect(l9.folgeMilderWahl).toContain(
			'Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat'
		);
		expect(l9.folgeMilderWahl).toContain(
			'Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller Eigentümer ohne den Beklagten.'
		);
		// Kein eigener Rat nach Annahme oder Ablehnung: Es geht um die Zahl, nicht
		// um den Weg. Den Rat trägt 1a.
		expect(l9.ratNachAnnahme).toBeUndefined();
		expect(l9.nachAblehnung).toBeUndefined();
	});

	it('rechnet nach der Vorgabe über alle ohne den Beklagten und trägt die andere Wahl daneben', () => {
		const e = erfordernis();
		expect(e.typ).toBe('einfaches_mehr');
		expect(e.kopfbasis).toBe('alle_ausser_betroffene');
		expect(e.quotenbasis).toBe('keine');
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L9', wahl: 'alle', vorgabe: true });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({
			wahl: 'anwesende',
			typ: 'einfaches_mehr',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine'
		});
		const mild = erfordernis(ANWESENDE_WAHL);
		expect(mild.kopfbasis).toBe('anwesend_vertreten');
		expect(mild.gemeinschaftslesart).toMatchObject({ kennung: 'L9', wahl: 'anwesende', vorgabe: false });
	});

	it('sagt auf der Karte die Folge der milden Wahl nur, wenn sie eingestellt ist', () => {
		const vorgabe = lesartKartensatz(erfordernis())!;
		expect(vorgabe).toContain(
			'Dieses Traktandum rechnet nach der Lesart «Alle Eigentümer ohne den Beklagten»'
		);
		expect(vorgabe).not.toContain(lesartVon('L9')!.folgeMilderWahl!);
		const mild = lesartKartensatz(erfordernis(ANWESENDE_WAHL))!;
		expect(mild).toContain(
			'rechnet nach der Lesart «Anwesende und Vertretene ohne den Beklagten», die für Ihre Gemeinschaft eingestellt ist'
		);
		expect(mild).toContain(lesartVon('L9')!.folgeMilderWahl!);
	});

	it('lehnt unter der Vorgabe ab und nennt die Annahme an den Anwesenden als zweites Ergebnis', () => {
		const a = zaehle(LESARTEN_VORGABE, VIER);
		expect(a.angenommen).toBe(false);
		// Das zweite Ergebnis rechnet 1a, nicht der allgemeine Lesartenweg.
		expect(a.andereLesart).toBeUndefined();
		expect(a.andereZaehlbasis).toMatchObject({
			kennung: '1a',
			eigeneWahl: 'an allen Eigentümern ausser dem Beklagten',
			wahl: 'an den Anwesenden und Vertretenen ausser dem Beklagten',
			feststellbar: true,
			angenommen: true,
			abweichend: true,
			ausLesart: true
		});
		const s = andereLesartInWorten(a.andereZaehlbasis!, false);
		// Unter L9 verkündet nicht Votum, sondern es gilt die Einstellung.
		expect(s.leitung).toContain(ZAEHLBASIS_VERKUENDET);
		expect(s.leitung).not.toContain('Votum verkündet die Ablehnung:');
		expect(s.leitung).toContain(
			'Sicherer ist, den Antrag an einer weiteren Versammlung erneut zu stellen'
		);
		// Fach- und Laienprüfung Runde 3 (R3-F-1, R3-L-1): nach einer Ablehnung der
		// Grundsatz als Möglichkeit, nicht im Indikativ.
		expect(s.leitung).toContain(
			'Würde eine solche Ermächtigung verkündet und nicht rechtzeitig angefochten, gälte sie in der Regel.'
		);
		expect(s.leitung).not.toContain('Wird sie nicht rechtzeitig angefochten');
		expect(s.leitung).toContain('Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat.');
	});

	it('nimmt unter «anwesende» an und nennt die Ablehnung an allen als zweites Ergebnis', () => {
		const a = zaehle(ANWESENDE_WAHL, VIER);
		expect(a.angenommen).toBe(true);
		expect(a.andereLesart).toBeUndefined();
		expect(a.andereZaehlbasis).toMatchObject({
			kennung: '1a',
			eigeneWahl: 'an den Anwesenden und Vertretenen ausser dem Beklagten',
			wahl: 'an allen Eigentümern ausser dem Beklagten',
			feststellbar: true,
			angenommen: false,
			abweichend: true,
			ausLesart: true
		});
		const s = andereLesartInWorten(a.andereZaehlbasis!, false);
		// Die Annahme trägt nur die Anwesenden: die offene Frage mit dem Grundsatz
		// davor und der sichere Weg. Feste Wortlaute, damit die geprüften Sätze
		// nicht still zurückfallen (Codeprüfung Block C, Durchgang 3, Befund 2).
		expect(s.leitung).toContain(ZAEHLBASIS_ANWESENDE_FOLGE);
		expect(s.leitung).toContain('Die Ermächtigung ist damit angreifbar');
		for (const satz of [
			'Wird sie nicht rechtzeitig angefochten, gilt sie in der Regel. Ob das Gericht im Ausschlussprozess trotzdem prüft',
			'Fehlt sie, holen Sie sie bald an einer weiteren Versammlung, auch einer ausserordentlichen.',
			'Sagen Sie mit der Einladung allen, dass Fernbleiben wie ein Nein wirkt',
			'Eine Vollmacht an den Beklagten oder an Angehörige im Ausstand wirkt dabei wie ein Nein.',
			'Wer trotzdem mit der heutigen Ermächtigung klagt, wartet, bis die Frist für alle abgelaufen ist, ' +
				'für Abwesende und den Beklagten gerechnet ab Zustellung des Protokolls.'
		]) {
			expect(s.leitung).toContain(satz);
		}
		expect(s.leitung).not.toContain('am sichersten');
		expect(s.protokoll).toContain(
			'Wird sie nicht rechtzeitig angefochten, gilt sie in der Regel. Ob das Gericht im Ausschlussprozess trotzdem prüft'
		);
		expect(s.protokoll).toContain('Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat.');
	});

	it('behält das Ergebnis an allen unter «anwesende», auch wenn L10 «fallen_heraus» steht (E1, Block D)', () => {
		// L10 wirkt unter einer Zahl der Anwesenden nicht; das zweite Ergebnis an
		// allen bleibt die sichere Rechnung mit den Angehörigen in der Zahl.
		const mitL10 = { ...erfordernis(ANWESENDE_WAHL), angehoerigenlesart: 'fallen_heraus' as const };
		const a = zaehleAus({
			momentaufnahme: M,
			erfordernis: mitL10,
			stimmen: VIER,
			anwesende: ANWESENDE,
			betroffeneParteiIds: BEKLAGTER,
			geheim: false
		});
		expect(a.angenommen).toBe(true);
		expect(a.andereZaehlbasis).toMatchObject({
			kennung: '1a',
			wahl: 'an allen Eigentümern ausser dem Beklagten',
			angenommen: false,
			ausLesart: true
		});
		expect(angehoerigenhinweis(mitL10)).toContain('Nach der Auszählung nennt Ihnen die Anwendung auch das Ergebnis an dieser Zahl.');
	});

	it('nennt im Hinweis zu den Angehörigen unter «anwesende» das Risiko und den Weg (Laienprüfung Runde 2, R2-L-2)', () => {
		const mild = angehoerigenhinweis(erfordernis(ANWESENDE_WAHL))!;
		expect(mild).toContain(
			'Ob das Gericht im Ausschlussprozess trotzdem prüft, ob die Mehrheit aller erreicht war, hat kein Gericht entschieden.'
		);
		// Der Grundsatz steht dort schon im Satz davor (Fachprüfung Runde 2 zu N6).
		expect(mild).not.toContain('Wird sie nicht rechtzeitig angefochten');
		expect(mild).toContain('Fehlt sie, holen Sie sie bald an einer weiteren Versammlung, auch einer ausserordentlichen.');
		expect(mild).toContain('Wer mit einer Ermächtigung nur der Anwesenden trotzdem klagt, wartet, bis die Frist für alle');
		expect(mild).toContain('Ein Schlichtungsgesuch am letzten Tag genügt, die Vorladung kommt erst danach.');
		expect(mild).not.toContain('am sichersten');
		// Ohne die Lesart (gleiche Kopfbasis aus einer Regel) bleibt der Bestand.
		const ohne = angehoerigenhinweis({ ...erfordernis(ANWESENDE_WAHL), gemeinschaftslesart: undefined })!;
		expect(ohne).toContain('klagt am sichersten erst einige Wochen nach Ablauf der Frist');
		expect(ohne).not.toContain('kein Gericht entschieden. Die Klage kann deshalb');
	});

	it('rät auf der Seite «Lesarten» neutral zu Vollmachten (Fachprüfung Runde 3, R3-F-4)', () => {
		const alle = lesartVon('L9')!.wahlen.find((w) => w.wert === 'alle')!;
		expect(alle.wirkung).toContain(
			'Sagen Sie deshalb mit der Einladung allen, dass Fernbleiben hier wie ein Nein wirkt und wer nicht kommen kann, eine Vollmacht geben kann.'
		);
		expect(alle.wirkung).not.toContain('Holen Sie deshalb vor der Versammlung Vollmachten ein.');
	});

	it('gibt bei fünf von sechs Anwesenden in beiden Wahlen dasselbe Ergebnis', () => {
		for (const [titel, wahl] of [
			['Vorgabe', LESARTEN_VORGABE],
			['anwesende', ANWESENDE_WAHL]
		] as const) {
			const a = zaehle(wahl, FUENF);
			expect(a.angenommen, titel).toBe(true);
			expect(a.andereZaehlbasis, titel).toMatchObject({
				abweichend: false,
				angenommen: true,
				feststellbar: true
			});
		}
	});

	it('nennt im Protokoll die Zählbasis und wer sie eingestellt hat', () => {
		const vorgabe = lesartProtokollsatz(erfordernis())!;
		expect(vorgabe).toContain('Gezählt nach der Mehrheit aller Eigentümer ohne den Beklagten.');
		expect(vorgabe).toContain('ist die Standardeinstellung:');
		const mild = lesartProtokollsatz(erfordernis(ANWESENDE_WAHL))!;
		expect(mild).toContain('Gezählt nach der Mehrheit der Anwesenden und Vertretenen ohne den Beklagten.');
		expect(mild).toContain('So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.');
		expect(mild).toContain('Die Standardeinstellung wäre die Mehrheit aller Eigentümer ohne den Beklagten:');
	});

	it('lässt ein Traktandum aus einer Fassung vor L9 ohne Lesart über alle ohne den Beklagten rechnen', () => {
		const alt = holeRegelwerk('2026-11-05');
		const k = alt.knoten.find((x) => x.id === 'k-ausschlussklage')!;
		expect(k.lesart).toBeUndefined();
		const e = erfordernisAusKnoten(alt, k);
		expect(e.kopfbasis).toBe('alle_ausser_betroffene');
		expect(e.gemeinschaftslesart).toBeUndefined();
	});
});
