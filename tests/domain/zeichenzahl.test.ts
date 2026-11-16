import { describe, expect, it } from 'vitest';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { FachlicherFehler, pruefeGemeinschaft } from '$lib/domain/gemeinschaft';
import { pruefeEigentuemer } from '$lib/domain/eigentuemer';
import { pruefeTraktandum } from '$lib/domain/traktanden';
import { pruefeLeitungsnamen } from '$lib/domain/versammlung';

/**
 * Die Annahme, auf der der ganze Umbau steht — hier festgenagelt.
 *
 * Ein Bildzeichen ist in JavaScript zwei Einheiten und für Postgres ein
 * Zeichen. Ändert sich das je (etwa weil jemand `zeichenzahl` auf
 * Zeichengruppen umstellt), soll es hier auffallen und nicht erst an einer
 * rohen 500 im Betrieb. Die andere Hälfte der Annahme — dass Postgres wirklich
 * eins zählt — steht in `tests/db/zeichenzahl.test.ts`.
 */
const BILDZEICHEN = '😀';

describe('zeichenzahl', () => {
	it('zählt anders als .length, und zwar so wie die Datenbank', () => {
		expect(BILDZEICHEN.length).toBe(2);
		expect(zeichenzahl(BILDZEICHEN)).toBe(1);
	});

	it('stimmt bei gewöhnlichem Text mit .length überein', () => {
		expect(zeichenzahl('Renate Berger')).toBe('Renate Berger'.length);
		expect(zeichenzahl('Grüezi — Öl, Ässe')).toBe('Grüezi — Öl, Ässe'.length);
	});

	it('zählt die leere Zeichenkette als null', () => {
		expect(zeichenzahl('')).toBe(0);
	});
});

/*
 * Der Fall, um den es geht: ein Wert, den `.length` für lang genug hält und die
 * Schranke der Datenbank nicht. Vor dem Umbau kam er an den Sätzen vorbei und
 * schlug als `check_violation` durch — also als 500 ohne Meldung.
 */
describe('eine Angabe aus einem einzigen Bildzeichen', () => {
	it('wird bei der Gemeinschaft abgewiesen', () => {
		expect(() =>
			pruefeGemeinschaft({
				name: BILDZEICHEN,
				quotaDenominator: 1000,
				headCountMode: 'per_owner',
				parkingCountsAsHead: false,
				parentStwegId: null
			})
		).toThrow(FachlicherFehler);
	});

	it('wird beim Eigentümer abgewiesen', () => {
		expect(() =>
			pruefeEigentuemer({
				stwegId: 's1',
				kind: 'natural',
				displayName: BILDZEICHEN,
				representativeName: null,
				isCommunity: false
			})
		).toThrow(FachlicherFehler);
	});

	it('wird beim Vorsitz abgewiesen', () => {
		expect(() =>
			pruefeLeitungsnamen({ sitzungsleitung: BILDZEICHEN, protokollfuehrung: null })
		).toThrow(/mindestens zwei Zeichen/);
	});

	it('wird beim Traktandum abgewiesen, auch zu zweit', () => {
		// Der Titel verlangt drei Zeichen; zwei Bildzeichen sind vier Einheiten.
		expect(() =>
			pruefeTraktandum({
				meetingId: 'v1',
				titel: BILDZEICHEN + BILDZEICHEN,
				art: 'kenntnisnahme',
				antragstellerart: 'bewirtschaftung'
			})
		).toThrow(FachlicherFehler);
	});
});

/*
 * Die Gegenprobe zur Gegenprobe: Die Regel weist nicht Bildzeichen ab, sondern
 * zu kurze Angaben. Ohne diesen Fall wäre «alles ablehnen» ebenfalls grün.
 */
describe('ein Name, der lang genug ist', () => {
	it('geht durch, auch mit Bildzeichen darin', () => {
		const name = `Renate ${BILDZEICHEN} Berger`;
		expect(
			pruefeEigentuemer({
				stwegId: 's1',
				kind: 'natural',
				displayName: name,
				representativeName: null,
				isCommunity: false
			}).displayName
		).toBe(name);
	});

	it('geht durch, wenn es genug Bildzeichen sind', () => {
		expect(
			pruefeLeitungsnamen({
				sitzungsleitung: BILDZEICHEN + BILDZEICHEN,
				protokollfuehrung: null
			}).sitzungsleitung
		).toBe(BILDZEICHEN + BILDZEICHEN);
	});
});
