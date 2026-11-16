/**
 * Anhang A: das Ergebnis nach dem Mehr aus Gesetz und Reglement, wo die Leitung
 * davon abgewichen ist (Lesarten Block 6, Kriterien 3 bis 7; Konzept,
 * Kriterium 13; Migration 173). In beide Richtungen (Produktentscheid
 * 21.10.2026), nur für die Leitung, nie im Protokoll (Entscheid 0023).
 */
import { describe, expect, it } from 'vitest';
import { erfordernisFuerRueckkommen } from '$lib/domain/rueckkommen';
import {
	andereLesartInWorten,
	andereLesartenVon,
	andereZaehlbasisVon,
	erfordernisNachGesetz,
	lesartKartensatz,
	mitKeinemBeschluss,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { gesetzesmassVon, uebersteuere, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { holeRegelwerk } from '$lib/rules';

const RW = holeRegelwerk('2026-10-28');

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

/** Vier Eigentümer, alle da; p1 bis p3 Ja (300 Wertquoten), p4 Nein (700). */
function saal(e: Erfordernis, geheim = false): Auszaehlungslage {
	return {
		momentaufnahme: snapshot([100, 100, 100, 700]),
		erfordernis: e,
		stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'no']),
		anwesende: ['p1', 'p2', 'p3', 'p4'],
		geheim
	};
}

const EINFACH = waehleErfordernis(RW, 'k-organ-waehlen').ergebnis!;
const QUALIFIZIERT = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis!;
/** Strenger gewählt, etwa weil die Einladung es so nannte (Entscheid 0007). */
const STRENGER = uebersteuere(RW, EINFACH, 'qualifiziertes_mehr', 'So stand es in der Einladung').ergebnis;
/** Milder gewählt. */
const MILDER = uebersteuere(RW, QUALIFIZIERT, 'einfaches_mehr', 'Entscheid der Leitung').ergebnis;

describe('uebersteuere legt das Mass des Vorschlags ab', () => {
	it('zur Zeit der Wahl, und eine zweite Abweichung behält das erste', () => {
		expect(EINFACH.typ).toBe('einfaches_mehr');
		expect(STRENGER.gesetzlich).toEqual(gesetzesmassVon(EINFACH));
		const nochmals = uebersteuere(RW, STRENGER, 'einstimmigkeit', 'Noch einmal anders').ergebnis;
		expect(nochmals.gesetzlich).toEqual(gesetzesmassVon(EINFACH));
	});

	it('ein von Hand gewählter Knoten trägt keines', () => {
		expect(EINFACH.quelle).toBe('gewaehlt');
		expect(EINFACH.gesetzlich).toBeUndefined();
		expect(erfordernisNachGesetz(EINFACH)).toBeNull();
	});
});

describe('Strenger gewählt: die Ablehnung, die nach Gesetz eine Annahme wäre', () => {
	it('nennt der Leitung das Ergebnis mit Zahlen und dem Rat zur Ablehnung', () => {
		const a = zaehleAus(saal(STRENGER));
		expect(a.angenommen).toBe(false);
		expect(a.nachGesetzUndReglement).toMatchObject({ kennung: 'A', abweichend: true, angenommen: true });
		const w = andereLesartInWorten(a.nachGesetzUndReglement!, false);
		expect(w.leitung).toContain('ist der Antrag abgelehnt. Nach dem Mehr aus Gesetz und Reglement');
		expect(w.leitung).toContain('wäre er angenommen: 3 Ja von 4 Kopfstimmen, nötig 3');
		expect(w.leitung).toContain('mit dem Mehr aus Gesetz und Reglement in der Einladung');
		expect(w.leitung).toContain('zählen Sie nicht neu aus. Als gültiges Mehr leitet Votum');
	});

	it('nie im Protokoll, auch nicht am Ausgang (Entscheid 0023)', () => {
		const a = zaehleAus(saal(STRENGER));
		expect(andereLesartInWorten(a.nachGesetzUndReglement!, false).protokoll).toBeNull();
		expect((a.protokollhinweise ?? []).some((h) => h.satz.includes('Gesetz und Reglement'))).toBe(false);
	});
});

describe('Milder gewählt: die Annahme, die nach Gesetz eine Ablehnung wäre', () => {
	it('nennt der Leitung, dass der Beschluss anfechtbar ist', () => {
		const a = zaehleAus(saal(MILDER));
		expect(a.angenommen).toBe(true);
		expect(a.nachGesetzUndReglement).toMatchObject({ abweichend: true, angenommen: false });
		const w = andereLesartInWorten(a.nachGesetzUndReglement!, true);
		expect(w.leitung).toContain('ist der Antrag angenommen. Nach dem Mehr aus Gesetz und Reglement');
		expect(w.leitung).toContain('wäre er abgelehnt. Verkündet bleibt das Ergebnis nach dem hier gewählten Mehr');
		expect(w.leitung).not.toContain('Wertquoten, nötig');
		expect(w.leitung).toContain('Führen Sie ihn deshalb erst aus, wenn diese Fristen ohne Anfechtung abgelaufen sind');
	});

	it('aus Summen von Hand nicht bestimmbar, weil die Wertquoten fehlen', () => {
		const { stimmen: _s, ...lage } = saal(MILDER);
		void _s;
		const a = zaehleSummenAus(lage, { ja: 3, nein: 1, enthaltung: 0 });
		expect(a.nachGesetzUndReglement).toMatchObject({ feststellbar: false, nichtFeststellbarWeil: 'summen' });
		expect(andereLesartInWorten(a.nachGesetzUndReglement!, false).leitung).toContain(
			'Fragen Sie gleich im Saal nach, wer Ja gestimmt hat'
		);
		// Geheim: keine Frage nach Namen (Fachprüfung G6-5).
		const g = andereLesartInWorten(a.nachGesetzUndReglement!, true).leitung;
		expect(g).not.toContain('wer Ja gestimmt hat');
		expect(g).toContain('Bei geheimer Abstimmung bleibt das offen.');
	});
});

describe('Kein zweites Ergebnis, wo nichts abweicht', () => {
	it('gleich gezählt: bei derselben Wahl wie der Vorschlag', () => {
		const gleich = uebersteuere(RW, EINFACH, 'einfaches_mehr', 'Bestätigt').ergebnis;
		expect(erfordernisNachGesetz(gleich)).toBeNull();
		expect(zaehleAus(saal(gleich)).nachGesetzUndReglement ?? null).toBeNull();
	});

	it('ein Traktandum von vor Migration 173 ohne abgelegtes Mass', () => {
		const alt: Erfordernis = { ...STRENGER, gesetzlich: undefined };
		expect(zaehleAus(saal(alt)).nachGesetzUndReglement ?? null).toBeNull();
		expect(lesartKartensatz(alt) ?? '').not.toContain('Gesetz und Reglement');
	});

	it('bei gleichem Ergebnis nur der kurze Satz für die Leitung', () => {
		const a = zaehleAus({ ...saal(STRENGER), momentaufnahme: snapshot([250, 250, 250, 250]) });
		expect(a.nachGesetzUndReglement).toMatchObject({ abweichend: false });
		expect(andereLesartInWorten(a.nachGesetzUndReglement!, false).leitung).toBe(
			'Nach dem Mehr aus Gesetz und Reglement wäre das Ergebnis dasselbe.'
		);
	});

	it('ohne Beschluss fällt es weg', () => {
		const a = mitKeinemBeschluss(zaehleAus(saal(STRENGER)), { grund: 'konsultativ', namen: [] });
		expect(andereLesartenVon(a)).toEqual([]);
	});
});

describe('Die Karte der Leitung kündigt es an (Kriterium 4)', () => {
	it('mit dem Mehr aus Gesetz und Reglement in Worten, nach dem Satz zu L1', () => {
		const satz = lesartKartensatz(STRENGER)!;
		expect(satz).toMatch(/ Gezählt wird nach dem hier gewählten Mehr\. Nach Gesetz und Reglement gälte /);
		expect(satz).toContain('nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach.');
		expect(satz).not.toContain('milder');
	});

	it('warnt vor der Abstimmung, wenn milder gewählt ist (Laienprüfung L6-2)', () => {
		expect(lesartKartensatz(MILDER)).toContain('Das gewählte Mehr ist in mindestens einem Punkt milder');
	});
});

describe('Kein Mass ohne zählbares Mehr (Codeprüfung Block 6, H1)', () => {
	const GRENZFALL: Erfordernis = { ...EINFACH, typ: 'grenzfall', kopfSchwelle: null };

	it('am aufgelösten Grenzfall legt uebersteuere kein Mass ab', () => {
		const e = uebersteuere(RW, GRENZFALL, 'einfaches_mehr', 'Grenzfall aufgelöst').ergebnis;
		expect(e.gesetzlich).toBeUndefined();
		expect(zaehleAus(saal(e)).nachGesetzUndReglement ?? null).toBeNull();
	});

	it('ein schon gespeichertes Mass eines Grenzfalls wirft beim Zählen nicht', () => {
		const e: Erfordernis = { ...STRENGER, gesetzlich: { ...gesetzesmassVon(EINFACH), typ: 'grenzfall', kopfSchwelle: null } };
		expect(erfordernisNachGesetz(e)).toBeNull();
		expect(() => zaehleAus(saal(e))).not.toThrow();
		expect(lesartKartensatz(e) ?? '').not.toContain('Gesetz und Reglement');
	});
});

describe('Am Rückkommen kein zweites Ergebnis des Beschlusses (Codeprüfung Block 6, M1)', () => {
	it('weder das Mehr aus Gesetz und Reglement noch 1a', () => {
		const r = erfordernisFuerRueckkommen(STRENGER, true);
		expect(r.gesetzlich).toBeUndefined();
		expect(zaehleAus(saal(r)).nachGesetzUndReglement ?? null).toBeNull();
		const klage = waehleErfordernis(RW, 'k-ausschlussklage').ergebnis;
		const aufheben = erfordernisFuerRueckkommen(klage, true);
		expect(aufheben.knotenId).toBe('k-ausschlussklage');
		expect(andereZaehlbasisVon(aufheben)).toBeNull();
		expect(lesartKartensatz(aufheben)).toBeNull();
	});
});

describe('«Alle Eigentümer» zählt an Ausschlussklage und Einsprache wie «alle ausser den Betroffenen» (Review DeepSeek, Befunde 2 und 3)', () => {
	for (const knoten of ['k-ausschlussklage', 'k-einsprache']) {
		it(`an ${knoten}: dieselbe Basis ist keine Abweichung, eine strengere Schwelle nicht milder`, () => {
			// Wie unter einer Regel «alle Eigentümer», die Votum an diesen Knoten als
			// alle ausser den Betroffenen liest (`reglement.ts`).
			const e: Erfordernis = {
				...waehleErfordernis(RW, knoten).ergebnis,
				kopfbasis: 'alle_ausser_betroffene',
				quelle: 'reglement'
			};
			const gleich = uebersteuere(RW, e, e.typ, 'Basis ausgeschrieben', { kopfbasis: 'alle_eigentuemer' }).ergebnis;
			expect(erfordernisNachGesetz(gleich)).toBeNull();
			expect(lesartKartensatz(gleich) ?? '').not.toContain('Gesetz und Reglement');
			const strenger = uebersteuere(RW, e, 'qualifiziertes_mehr', 'Strenger gewählt', { kopfbasis: 'alle_eigentuemer' }).ergebnis;
			const satz = lesartKartensatz(strenger) ?? '';
			expect(satz).toContain('Nach Gesetz und Reglement gälte');
			expect(satz).not.toContain('milder');
		});
	}

	it('an der Ausschlussklage bleibt die Wahl der Anwesenden milder', () => {
		const klage = waehleErfordernis(RW, 'k-ausschlussklage').ergebnis;
		const milder = uebersteuere(RW, klage, 'einfaches_mehr', 'Milder gewählt', { kopfbasis: 'anwesend_vertreten' }).ergebnis;
		expect(lesartKartensatz(milder)).toContain('Das gewählte Mehr ist in mindestens einem Punkt milder');
	});
});

describe('Codeprüfung der Review-Behebungen zu Block 6', () => {
	it('Befund 1: an der Einsprache ist «alle Eigentümer» statt «Anwesende» strenger, nicht milder', () => {
		const einsprache = waehleErfordernis(RW, 'k-einsprache').ergebnis;
		expect(einsprache.kopfbasis).toBe('anwesend_vertreten');
		const e = uebersteuere(RW, einsprache, einsprache.typ, 'Strenger gewählt', { kopfbasis: 'alle_eigentuemer' }).ergebnis;
		const satz = lesartKartensatz(e) ?? '';
		expect(satz).toContain('Nach Gesetz und Reglement gälte');
		expect(satz).not.toContain('milder');
	});
});
