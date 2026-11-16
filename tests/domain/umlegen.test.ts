/**
 * Angaben der gemeinsamen Versammlung auf ihre Teilnehmerinnen umlegen.
 *
 * Der Wächter über den Punkt, an dem es schiefgeht: **Was nicht mitzieht, muss
 * in der Meldung stehen.** Eine Zusammenfassung, die nur die Erfolge zählt,
 * liest sich wie «alles nachgezogen» — und der Verwalter erfährt erst im Saal,
 * dass eine Einladung auf den alten Tag lautet.
 */
import { describe, expect, it } from 'vitest';
import {
	planeUmlegung,
	umlegungsmeldung,
	type Mittagende,
	type Umlegeziel
} from '$lib/domain/umlegen';

const ZIEL: Umlegeziel = {
	datum: '2026-09-04',
	uhrzeit: '19:00',
	ort: 'Halle der Proben',
	art: 'ordentlich',
	anlass: null,
	betriebsart: 'gefuehrt'
};

const HAUS = (ueber: Partial<Mittagende> = {}): Mittagende => ({
	id: 'v1',
	gemeinschaft: 'Nirgendweg 5/5a',
	zustand: 'entwurf',
	datum: '2026-09-04',
	uhrzeit: '19:00',
	ort: 'Halle der Proben',
	art: 'ordentlich',
	anlass: null,
	betriebsart: 'gefuehrt',
	...ueber
});

describe('planeUmlegung', () => {
	it('lässt in Ruhe, was schon übereinstimmt', () => {
		const p = planeUmlegung(ZIEL, [HAUS()]);
		expect(p.aendern).toEqual([]);
		expect(p.unveraendert).toEqual(['Nirgendweg 5/5a']);
		expect(p.gesperrt).toEqual([]);
	});

	it('nennt jede Angabe, die sich ändert', () => {
		const p = planeUmlegung(ZIEL, [
			HAUS({ datum: '2026-08-30', uhrzeit: '18:00', ort: 'Anderswo', art: 'ausserordentlich' })
		]);
		expect(p.aendern[0].was).toEqual(['Tag', 'Beginn', 'Ort', 'Art']);
	});

	it('hält «19:00:00» und «19:00» nicht für einen Unterschied', () => {
		const p = planeUmlegung(ZIEL, [HAUS({ uhrzeit: '19:00:00' })]);
		expect(p.unveraendert).toHaveLength(1);
	});

	it('hält Gross-, Klein- und Leerzeichen im Ort nicht für einen Unterschied', () => {
		const p = planeUmlegung(ZIEL, [HAUS({ ort: '  halle   der PROBEN ' })]);
		expect(p.unveraendert).toHaveLength(1);
	});

	it('merkt einen geänderten Anlass bei gleicher Art', () => {
		const ziel = { ...ZIEL, art: 'ausserordentlich' as const, anlass: 'Dach' };
		const p = planeUmlegung(ziel, [HAUS({ art: 'ausserordentlich', anlass: 'Fassade' })]);
		expect(p.aendern[0].was).toEqual(['Anlass']);
	});

	/*
	 * Die Betriebsart ist hart (Auftraggeber, 25.08.2026; `docs/vererbung-abend.md`):
	 * Im Saal wird einheitlich gezählt. Zwei Verfahren nebeneinander liessen
	 * sich nicht führen — Einlass, Wand und Stimmerfassung folgen ihr.
	 */
	it('merkt eine abweichende Abstimmungsweise', () => {
		const p = planeUmlegung(ZIEL, [HAUS({ betriebsart: 'einfach' })]);
		expect(p.aendern[0].was).toEqual(['Abstimmungsweise']);
	});

	it('nennt Abstimmungsweise neben Tag und Ort, nicht statt ihrer', () => {
		const p = planeUmlegung(ZIEL, [
			HAUS({ datum: '2026-09-10', ort: 'Turnhalle', betriebsart: 'einfach' })
		]);
		expect(p.aendern[0].was).toEqual(['Tag', 'Ort', 'Abstimmungsweise']);
	});

	it('sperrt, was nicht mehr im Entwurf ist — mit Grund', () => {
		const p = planeUmlegung(ZIEL, [HAUS({ zustand: 'freigegeben', datum: '2026-08-30' })]);
		expect(p.aendern).toEqual([]);
		expect(p.gesperrt[0].grund).toContain('Einladung');
	});

	it('begründet je Zustand verschieden — «laufend» hat nichts mit der Einladung zu tun', () => {
		// «laufend — die Angaben stehen in der Einladung» stand einmal da und
		// war schief (gemessen am Bildschirm, 11.08.2026).
		const laufend = planeUmlegung(ZIEL, [HAUS({ zustand: 'laufend', ort: 'Anderswo' })]);
		expect(laufend.gesperrt[0].grund).toBe('läuft gerade');
		const zu = planeUmlegung(ZIEL, [HAUS({ zustand: 'geschlossen', ort: 'Anderswo' })]);
		expect(zu.gesperrt[0].grund).toContain('stattgefunden');
		expect(zu.gesperrt[0].grund).not.toContain('Einladung');
	});

	it('warnt nicht bei einer freigegebenen, die ohnehin passt', () => {
		// Sonst stünde bei jedem Speichern eine Warnung über eine Versammlung,
		// an der gar nichts zu ändern wäre.
		const p = planeUmlegung(ZIEL, [HAUS({ zustand: 'freigegeben' })]);
		expect(p.gesperrt).toEqual([]);
		expect(p.unveraendert).toHaveLength(1);
	});

	it('trennt drei Häuser sauber in die drei Fächer', () => {
		const p = planeUmlegung(ZIEL, [
			HAUS({ id: 'a', gemeinschaft: 'A' }),
			HAUS({ id: 'b', gemeinschaft: 'B', ort: 'Anderswo' }),
			HAUS({ id: 'c', gemeinschaft: 'C', ort: 'Anderswo', zustand: 'laufend' })
		]);
		expect(p.unveraendert).toEqual(['A']);
		expect(p.aendern.map((x) => x.gemeinschaft)).toEqual(['B']);
		expect(p.gesperrt.map((x) => x.gemeinschaft)).toEqual(['C']);
	});
});

describe('umlegungsmeldung', () => {
	it('zählt, was übernommen wurde', () => {
		const p = planeUmlegung(ZIEL, [
			HAUS({ id: 'a', gemeinschaft: 'A', ort: 'Anderswo' }),
			HAUS({ id: 'b', gemeinschaft: 'B', datum: '2026-08-30' })
		]);
		const m = umlegungsmeldung(p);
		expect(m).toContain('2 Versammlungen');
		expect(m).toContain('Ort');
		expect(m).toContain('Tag');
	});

	it('nennt, was nicht mitzog — und wo man es ändert', () => {
		const p = planeUmlegung(ZIEL, [
			HAUS({ id: 'a', gemeinschaft: 'A', ort: 'Anderswo' }),
			HAUS({ id: 'b', gemeinschaft: 'B', ort: 'Anderswo', zustand: 'freigegeben' })
		]);
		const m = umlegungsmeldung(p);
		expect(m).toContain('Nicht übernommen bei B');
		expect(m).toContain('Seite der Versammlung');
	});

	it('sagt es auch, wenn es nichts zu tun gab', () => {
		expect(umlegungsmeldung(planeUmlegung(ZIEL, [HAUS()]))).toContain('stimmten schon überein');
	});

	it('behauptet keinen Erfolg, wenn nur Gesperrte da waren', () => {
		const p = planeUmlegung(ZIEL, [HAUS({ zustand: 'laufend', ort: 'Anderswo' })]);
		const m = umlegungsmeldung(p);
		expect(m).not.toContain('übernommen.');
		expect(m).toContain('Nicht übernommen');
	});
});
