/**
 * Lesart L1 und die feste Regel 1e in der Zählung (Konzept Lesarten,
 * Kriterien 5, 7 und 14; Entscheid 0018; Produktentscheid 21.10.2026).
 *
 * - **L1:** Unter dem Mehr aller Wertquoten bleibt nach der Vorgabe die Quote
 *   im Ausstand im Nenner, ebenso die einer Partei, deren Vertreter im
 *   Ausstand ist; nach der Wahl «fällt heraus» fallen beide heraus. Das
 *   Ergebnis nach der anderen Wahl steht daneben.
 * - **1e:** An der Ausschlussklage bleiben Angehörige im Ausstand ab Fassung
 *   2026-10-25 in der Zahl aller Eigentümer; ältere Traktanden rechnen weiter
 *   ohne sie. Die vertretene Partei bleibt dort in der Zahl, unabhängig von L1.
 * - **Einstimmigkeit** rechnet unverändert.
 *
 * Das Beispiel aus dem Papier zur juristischen Prüfung, Frage 2: vier Parteien
 * zu je 250, eine im Ausstand, zwei Ja, eine Nein. Mit der Quote: 500 von
 * nötig 501, abgelehnt. Ohne sie: 500 von 750, nötig 376, angenommen.
 */
import { describe, expect, it } from 'vitest';
import {
	andereLesartenVon,
	andereLesartInWorten,
	lesartKartensatz,
	mehrheitsvorschau,
	mitKeinemBeschluss,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { holeRegelwerk } from '$lib/rules';
import { wendeLesartAn } from '$lib/domain/lesarten';

function snapshot(quoten: number[]): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-21T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: quoten.reduce((a, b) => a + b, 0),
		parties: quoten.map((quote, i) => ({
			partyId: `p${i + 1}`,
			displayName: `Partei ${i + 1}`,
			representativeName: null,
			isCommunity: false,
			units: [{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: quote }]
		}))
	};
}

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-10-21T19:10:00.000Z',
		recordedByChair: false
	}));
}

const QUALIFIZIERT: Erfordernis = {
	fassung: '2026-10-25',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-wichtig',
	typ: 'qualifiziertes_mehr',
	titel: 'Wichtigere Verwaltungshandlung',
	rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

const VIER = snapshot([250, 250, 250, 250]);

/** p4 im Ausstand; p1 und p2 Ja, p3 Nein. */
function papierfall(e: Erfordernis, geheim = false): Auszaehlungslage {
	return {
		momentaufnahme: VIER,
		erfordernis: e,
		stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']),
		anwesende: ['p1', 'p2', 'p3', 'p4'],
		imAusstand: ['p4'],
		geheim
	};
}

describe('L1 am Beispiel aus dem Papier (Kriterium 7)', () => {
	it('nach der Vorgabe bleibt die Quote im Nenner: 500 von nötig 501, abgelehnt', () => {
		const a = zaehleAus(papierfall(QUALIFIZIERT));
		expect(a.quoten).toMatchObject({ ja: 500, basis: 1000, schwelle: 501, erreicht: false });
		expect(a.angenommen).toBe(false);
	});

	it('ein Traktandum von vor Migration 170 ohne Angabe rechnet ebenso', () => {
		const a = zaehleAus(papierfall({ ...QUALIFIZIERT, ausstandslesart: undefined }));
		expect(a.quoten.basis).toBe(1000);
	});

	it('nach der Wahl «fällt heraus» sinkt der Nenner: 500 von 750, nötig 376, angenommen', () => {
		const a = zaehleAus(papierfall({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' }));
		expect(a.quoten).toMatchObject({ ja: 500, basis: 750, schwelle: 376, erreicht: true });
		expect(a.angenommen).toBe(true);
	});

	it('die Köpfe bleiben, wie sie waren', () => {
		const streng = zaehleAus(papierfall(QUALIFIZIERT));
		const mild = zaehleAus(papierfall({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' }));
		expect(mild.koepfe).toEqual(streng.koepfe);
	});
});

describe('Das Ergebnis nach der anderen Wahl (Kriterium 5)', () => {
	it('nennt nach der Vorgabe das abweichende Ergebnis ohne die Quote, mit Zahlen', () => {
		const a = zaehleAus(papierfall(QUALIFIZIERT));
		expect(a.andereAusstandslesart).toMatchObject({
			kennung: 'L1',
			eigeneWahl: 'Wertquote zählt mit',
			wahl: 'Wertquote fällt heraus',
			feststellbar: true,
			angenommen: true,
			abweichend: true,
			quoten: { ja: 500, basis: 750, schwelle: 376, erreicht: true }
		});
		// L4 trägt dieses Erfordernis nicht; sein Feld bleibt leer.
		expect(a.andereLesart ?? null).toBeNull();
		expect(andereLesartenVon(a)).toHaveLength(1);
		const satz = andereLesartInWorten(a.andereAusstandslesart!, false).leitung;
		// A5, Punkt 1a: eingestellt hat die Verwaltung, beschlossen niemand.
		expect(satz).toContain(
			'Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist («Wertquote zählt mit»), ist der Antrag abgelehnt.'
		);
		expect(satz).toContain('500 Ja von 750 Wertquoten, nötig 376');
	});

	it('nennt umgekehrt das strengere Ergebnis, wenn die Gemeinschaft umgestellt hat', () => {
		const a = zaehleAus(papierfall({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' }));
		expect(a.andereAusstandslesart).toMatchObject({
			eigeneWahl: 'Wertquote fällt heraus',
			wahl: 'Wertquote zählt mit',
			angenommen: false,
			abweichend: true,
			quoten: { basis: 1000, schwelle: 501 }
		});
	});

	it('schreibt ins Protokoll den Satz am Ausgang, geheim ohne Zahlen', () => {
		const offen = zaehleAus(papierfall(QUALIFIZIERT));
		expect(offen.protokollhinweise).toContainEqual({
			ort: 'ausgang',
			satz: 'Nach der anderen Lesart («Wertquote fällt heraus»: die Rechnung ohne die Wertquote im Ausstand), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen: 500 Ja von 750 Wertquoten, nötig 376.'
		});
		const geheim = zaehleAus(papierfall(QUALIFIZIERT, true));
		expect(geheim.protokollhinweise).toContainEqual({
			ort: 'ausgang',
			satz: 'Nach der anderen Lesart («Wertquote fällt heraus»: die Rechnung ohne die Wertquote im Ausstand), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen.'
		});
	});

	it('ohne Ausstand gibt es kein zweites Ergebnis: Die Wahl kann dann nichts ändern', () => {
		const a = zaehleAus({ ...papierfall(QUALIFIZIERT), imAusstand: [] });
		expect(a.andereAusstandslesart ?? null).toBeNull();
	});

	it('ohne Mehr aller Wertquoten ebenso', () => {
		const a = zaehleAus(
			papierfall({ ...QUALIFIZIERT, typ: 'einfaches_mehr', quotenbasis: 'keine', quotenSchwelle: null })
		);
		expect(a.andereAusstandslesart ?? null).toBeNull();
	});

	it('fällt mit «kein Beschluss» weg, samt Protokollsatz', () => {
		const a = mitKeinemBeschluss(zaehleAus(papierfall(QUALIFIZIERT)), {
			grund: 'weggang',
			namen: ['Partei 3']
		});
		expect(a.andereAusstandslesart ?? null).toBeNull();
		expect((a.protokollhinweise ?? []).some((h) => h.satz.includes('«Wertquote fällt heraus»'))).toBe(false);
	});
});

describe('Die vertretene Partei eines Vertreters im Ausstand (Entscheid 0020)', () => {
	/** p3 im Ausstand vertritt p4; p1 und p2 Ja. */
	function vertreten(e: Erfordernis): Auszaehlungslage {
		return {
			momentaufnahme: VIER,
			erfordernis: e,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p4', 'no']),
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			imAusstand: ['p3'],
			vertretungen: [{ vertreteneId: 'p4', bevollmaechtigtId: 'p3' }]
		};
	}

	it('bleibt nach der Vorgabe im Nenner aller Wertquoten', () => {
		const a = zaehleAus(vertreten(QUALIFIZIERT));
		expect(a.quoten).toMatchObject({ ja: 500, basis: 1000, schwelle: 501 });
		expect(a.angenommen).toBe(false);
	});

	it('bleibt auch nach «fällt heraus» wie eine Abwesende im Nenner; nur die Partei im Ausstand fällt', () => {
		const a = zaehleAus(vertreten({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' }));
		expect(a.quoten).toMatchObject({ ja: 500, basis: 750, schwelle: 376, nichtAnwesend: 250 });
		expect(a.angenommen).toBe(true);
	});

	it('die Vorschau vor der Abstimmung rechnet dieselbe Schwelle', () => {
		const { stimmen: _s, ...ohne } = vertreten({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' });
		void _s;
		expect(mehrheitsvorschau(ohne).quoten).toEqual({ noetig: 376, von: 750 });
		const { stimmen: _t, ...streng } = vertreten(QUALIFIZIERT);
		void _t;
		expect(mehrheitsvorschau(streng).quoten).toEqual({ noetig: 501, von: 1000 });
	});
});

describe('Einstimmigkeit rechnet unverändert (Kriterium 7)', () => {
	it('gleich nach beiden Wahlen, ohne zweites Ergebnis', () => {
		const einstimmig: Erfordernis = {
			...QUALIFIZIERT,
			knotenId: 'k-zweckbestimmung',
			typ: 'einstimmigkeit',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'keine',
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
			quotenSchwelle: null
		};
		const lage = {
			momentaufnahme: VIER,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p4', 'yes']),
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			imAusstand: ['p3']
		};
		const streng = zaehleAus({ ...lage, erfordernis: einstimmig });
		const mild = zaehleAus({ ...lage, erfordernis: { ...einstimmig, ausstandslesart: 'faellt_heraus' } });
		expect(mild.koepfe).toEqual(streng.koepfe);
		expect(mild.angenommen).toBe(streng.angenommen);
		expect(mild.andereAusstandslesart ?? null).toBeNull();
	});
});

describe('1e: Angehörige im Ausstand an der Ausschlussklage (Kriterien 7 und 14)', () => {
	const NEU = holeRegelwerk('2026-10-25');
	const ALT = holeRegelwerk('2026-10-24');
	const pfad = (rw: typeof NEU) => waehleErfordernis(rw, 'k-ausschlussklage').ergebnis!;
	/** Fünf Eigentümer: p5 beklagt, p4 seine Ehefrau im Ausstand; p1, p2 Ja, p3 Nein. */
	function klage(e: Erfordernis): Auszaehlungslage {
		return {
			momentaufnahme: snapshot([200, 200, 200, 200, 200]),
			erfordernis: e,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']),
			anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
			imAusstand: ['p4'],
			betroffeneParteiIds: ['p5']
		};
	}

	it('ab Fassung 2026-10-25 bleibt die Angehörige in der Zahl: 2 Ja von 4, nötig 3', () => {
		const e = pfad(NEU);
		expect(e.knotenId).toBe('k-ausschlussklage');
		const a = zaehleAus(klage(e));
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 4, schwelle: 3, imAusstand: 1 });
		expect(a.angenommen).toBe(false);
	});

	it('unter der Fassung 2026-10-24 rechnet ein Traktandum weiter ohne sie: 2 Ja von 3', () => {
		const a = zaehleAus(klage(pfad(ALT)));
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 3, schwelle: 2 });
		expect(a.koepfe.imAusstand ?? 0).toBe(0);
		expect(a.angenommen).toBe(true);
	});

	it('die Wahl L1 ändert daran nichts, auch nicht für die vertretene Partei', () => {
		const e = pfad(NEU);
		const mitVollmacht = (x: Erfordernis): Auszaehlungslage => ({
			...klage(x),
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes']),
			vertretungen: [{ vertreteneId: 'p3', bevollmaechtigtId: 'p4' }]
		});
		const streng = zaehleAus(mitVollmacht(e));
		const mild = zaehleAus(mitVollmacht({ ...e, ausstandslesart: 'faellt_heraus' }));
		expect(streng.koepfe).toMatchObject({ basis: 4, schwelle: 3 });
		expect(mild.koepfe).toEqual(streng.koepfe);
		expect(mild.andereAusstandslesart ?? null).toBeNull();
	});

	it('die Handzählung rechnet dieselbe Zahl', () => {
		const { stimmen: _s, ...lage } = klage(pfad(NEU));
		void _s;
		const a = zaehleSummenAus(lage, { ja: 2, nein: 1, enthaltung: 0 });
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 4, schwelle: 3, imAusstand: 1 });
		expect(a.angenommen).toBe(false);
	});

	/*
	 * Entscheid 0019 in der Zählung, nicht nur im Kartensatz (Featureprüfung
	 * Lesarten, 22.10.2026): Verlangt eine hinterlegte Regel an der
	 * Ausschlussklage Wertquoten, bleibt die Quote im Ausstand auch nach «fällt
	 * heraus» im Nenner, und es gibt kein zweites Ergebnis zu L1.
	 */
	it('eine Regel mit allen Wertquoten: L1 ändert den Nenner nicht', () => {
		const e: Erfordernis = {
			...pfad(NEU),
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quelle: 'reglement'
		};
		const streng = zaehleAus(klage(e));
		const mild = zaehleAus(klage({ ...e, ausstandslesart: 'faellt_heraus' }));
		// Fünf zu je 200: die 200 von p4 im Ausstand bleiben im Nenner.
		expect(streng.quoten).toMatchObject({ basis: 1000, imAusstand: 200 });
		expect(mild.quoten).toEqual(streng.quoten);
		expect(mild.andereAusstandslesart ?? null).toBeNull();
	});

	it('unter einer Klausel der Anwesenden fällt die Angehörige weiter heraus', () => {
		const a = zaehleAus(klage({ ...pfad(NEU), kopfbasis: 'anwesend_vertreten', quelle: 'reglement' }));
		expect(a.koepfe).toMatchObject({ basis: 3 });
		expect(a.koepfe.imAusstand ?? 0).toBe(0);
	});
});

describe('1e nimmt den Beklagten nicht in die Zahl (Codeprüfung Teil 2, H2)', () => {
	it('auch wenn für ihn der Ausstand erklärt ist, in Einzel- und Handzählung', () => {
		const e = waehleErfordernis(holeRegelwerk('2026-10-25'), 'k-ausschlussklage').ergebnis!;
		const lage: Auszaehlungslage = {
			momentaufnahme: snapshot([200, 200, 200, 200, 200]),
			erfordernis: e,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']),
			anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
			imAusstand: ['p4', 'p5'],
			betroffeneParteiIds: ['p5']
		};
		expect(zaehleAus(lage).koepfe).toMatchObject({ basis: 4, imAusstand: 1 });
		const { stimmen: _s, ...ohne } = lage;
		void _s;
		expect(zaehleSummenAus(ohne, { ja: 2, nein: 1, enthaltung: 0 }).koepfe).toMatchObject({
			basis: 4,
			imAusstand: 1
		});
	});
});

describe('L4 und L1 an einem Traktandum (Codeprüfung Teil 2, H1)', () => {
	it('zwei zweite Ergebnisse, je mit der Lesart beim Namen, auch bei gleichem Ergebnis', () => {
		const rw = holeRegelwerk('2026-10-25');
		const e = wendeLesartAn(
			waehleErfordernis(rw, 'k-bewirtschaftung-waehlen-erweitert').ergebnis!,
			{ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' }
		);
		expect(e.quotenbasis).toBe('alle_quoten');
		const a = zaehleAus({
			momentaufnahme: VIER,
			erfordernis: e,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes']),
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			imAusstand: ['p4']
		});
		const saetze = andereLesartenVon(a).map((r) => andereLesartInWorten(r, false).leitung);
		expect(saetze).toEqual([
			'Nach der anderen Lesart («Einfaches Mehr») dasselbe Ergebnis.',
			'Nach der anderen Lesart («Wertquote fällt heraus») dasselbe Ergebnis.'
		]);
		expect(new Set(andereLesartenVon(a).map((r) => r.kennung)).size).toBe(2);
	});
});

describe('Die Eimer ergeben die Bezugsgrösse (Codeprüfung Teil 2, M1)', () => {
	const summe = (q: ReturnType<typeof zaehleAus>['quoten']) =>
		q.ja + q.nein + q.enthaltung + q.ohneAbgabe + q.nichtAnwesend + (q.stimmtNicht ?? 0) + (q.imAusstand ?? 0);

	it('mit Ausstand und ruhender Vollmacht, nach beiden Wahlen', () => {
		for (const wahl of ['bleibt', 'faellt_heraus'] as const) {
			const a = zaehleAus({
				momentaufnahme: VIER,
				erfordernis: { ...QUALIFIZIERT, ausstandslesart: wahl },
				stimmen: stimmen(['p1', 'yes'], ['p2', 'yes']),
				anwesende: ['p1', 'p2', 'p3', 'p4'],
				imAusstand: ['p3'],
				vertretungen: [{ vertreteneId: 'p4', bevollmaechtigtId: 'p3' }]
			});
			expect(summe(a.quoten), wahl).toBe(a.quoten.basis);
		}
	});

	it('auch mit einer Betroffenen im Ausstand, die hier mitstimmt (Review DeepSeek, Befund 3)', () => {
		// Betroffene, deren Zustimmung nötig ist, stimmen mit; im Ausstand gehört
		// ihre Quote in den Eimer, sonst fehlt sie in der Zeile des Protokolls.
		const a = zaehleAus({
			momentaufnahme: VIER,
			erfordernis: { ...QUALIFIZIERT, knotenId: 'k-nutzungsrecht-zuteilung', zustimmungBetroffenerNoetig: true },
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes']),
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			imAusstand: ['p3'],
			betroffeneParteiIds: ['p3']
		});
		expect(a.quoten.imAusstand).toBe(250);
		expect(summe(a.quoten)).toBe(a.quoten.basis);
	});
});

describe('Nur ein Vertreter ohne eigene Partei im Ausstand (Codeprüfung Teil 3, M1)', () => {
	it('der Satz nennt die Vertretenen, nach beiden Wahlen', () => {
		for (const wahl of ['bleibt', 'faellt_heraus'] as const) {
			const { stimmen: _s, ...lage } = {
				momentaufnahme: VIER,
				erfordernis: { ...QUALIFIZIERT, ausstandslesart: wahl },
				stimmen: [],
				anwesende: ['p1', 'p2', 'p3', 'p4'],
				imAusstand: ['vertreter:v1'],
				vertretungen: [{ vertreteneId: 'p4', bevollmaechtigtId: 'vertreter:v1' }]
			};
			void _s;
			expect(mehrheitsvorschau(lage).ausstandshinweis, wahl).toBe(
				'Die 250 Wertquoten von Parteien, die nur über eine Person im Ausstand vertreten sind, ' +
					'bleiben in der Zahl ohne Stimme und wirken wie ein Nein.'
			);
		}
	});
});

describe('L1 auf der Karte vor der Abstimmung (Konzept, Kriterium 4; Review DeepSeek, Befund 6)', () => {
	it('nennt die Wahl des Traktandums und die andere, auch ohne Ausstand', () => {
		const satz = lesartKartensatz({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' });
		// A5, Punkt 1b: der Grund der Vorgabe statt der Software.
		expect(satz).toContain('nach der Lesart «Wertquote fällt heraus», die für Ihre Gemeinschaft eingestellt ist');
		expect(satz).toContain('Nach der anderen Lesart («Wertquote zählt mit») bliebe die Wertquote im Ausstand in der Zahl und wirkte wie ein Nein.');
	});

	it('ohne Angabe nach der Vorgabe, und eine übergebene Wahl geht vor', () => {
		// A5, Punkt 1b: der Grund der Vorgabe statt der Software.
		expect(lesartKartensatz(QUALIFIZIERT)).toContain('«Wertquote zählt mit» (Standardeinstellung:');
		expect(lesartKartensatz({ ...QUALIFIZIERT, ausstandslesart: 'bleibt' }, 'faellt_heraus')).toContain(
			'«Wertquote fällt heraus»'
		);
	});

	/*
	 * Kriterium 7, präzisiert am 22.10.2026 (Konzept Lesarten, Abschnitt 7): die
	 * strenge Seite als Grundregel samt Folgerung, die milde mit Fundstelle, im
	 * Protokoll; im Saal die Kurzfassung ohne Fundstellen.
	 */
	it('das Protokoll nennt Grundregel und Fundstellen, nach beiden Wahlen; die Karte nicht', () => {
		const bleibt = zaehleAus(papierfall(QUALIFIZIERT)).ausstandswirkung ?? '';
		expect(bleibt).toContain('Diese Lesart stützt sich auf die Grundregel');
		expect(bleibt).toContain('es ist eine Folgerung');
		expect(bleibt).toContain('Rz. 191 ad Art. 712m');
		expect(bleibt).toContain('Handschin/Wyttenbach, S. 63');
		const faellt = zaehleAus(papierfall({ ...QUALIFIZIERT, ausstandslesart: 'faellt_heraus' })).ausstandswirkung ?? '';
		expect(faellt).toContain('Diese Lesart stützt sich auf eine Literaturstelle zum Ausstand');
		expect(faellt).toContain('Handschin/Wyttenbach, S. 63');
		expect(faellt).toContain('Rz. 191 ad Art. 712m');
		expect(lesartKartensatz(QUALIFIZIERT)).not.toMatch(/Rz\.|Handschin/);
	});

	it('schweigt, wo L1 nicht wirkt: ohne Mehr aller Wertquoten und an der Ausschlussklage', () => {
		expect(lesartKartensatz({ ...QUALIFIZIERT, quotenbasis: 'anwesend_vertreten' })).toBeNull();
		// An der Ausschlussklage steht seit Block 6 nur der Satz zu 1a, keiner zu L1
		// (die Basis `anwesend_vertreten` gibt die Gegenrichtung zu 1a).
		expect(lesartKartensatz({ ...QUALIFIZIERT, knotenId: 'k-ausschlussklage' })).toBe(
			'Nach der Auszählung nennt Votum auch das Ergebnis, gezählt an allen Eigentümern ausser dem Beklagten.'
		);
	});
});
