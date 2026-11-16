/**
 * Die Filter des Verlaufs.
 *
 * Der wichtigste Test ist der auf das Blättern: Ein Verweis, der einen Filter
 * unterwegs verliert, führt in eine Liste, die genauso aussieht wie die
 * erwartete — und niemand merkt, dass er den falschen Bestand vor sich hat.
 */
import { describe, expect, it } from 'vitest';
import {
	bereichVon,
	bereichsname,
	istGefiltert,
	verlaufsAdresse
} from '$lib/domain/verlaufsfilter';

describe('Bereiche', () => {
	it('nimmt den Namensteil vor dem ersten Punkt', () => {
		expect(bereichVon('vote.round.opened')).toBe('vote');
		expect(bereichVon('meeting.created')).toBe('meeting');
	});

	it('kommt mit einer Art ohne Punkt zurecht', () => {
		expect(bereichVon('sonderfall')).toBe('sonderfall');
	});

	it('übersetzt bekannte Bereiche', () => {
		expect(bereichsname('bylaw')).toBe('Reglement');
		expect(bereichsname('vote')).toBe('Abstimmung');
	});

	it('lässt einen unbekannten Bereich stehen, statt ihn zu «Sonstiges» zu machen', () => {
		// Eine neue Ereignisart soll im Filter auftauchen, auch wenn hier noch
		// niemand einen deutschen Namen nachgetragen hat.
		expect(bereichsname('neuerbereich')).toBe('neuerbereich');
	});
});

describe('Adresse eines Filterstands', () => {
	it('ist ohne Filter die blosse Seite', () => {
		expect(verlaufsAdresse({})).toBe('/verlauf');
		expect(verlaufsAdresse({ suche: '   ' })).toBe('/verlauf');
	});

	it('lässt die erste Seite weg', () => {
		expect(verlaufsAdresse({ art: 'vote.round.opened' }, 0)).toBe('/verlauf?art=vote.round.opened');
	});

	it('trägt beim Blättern ALLE Angaben weiter', () => {
		// Der Fehler, den es hier zu verhindern gilt: Vorher nahmen «Neuere» und
		// «Ältere» nur `art` mit. Wer den Verlauf einer Versammlung durchblätterte,
		// stand nach dem ersten Klick im Gesamtverlauf.
		const adresse = verlaufsAdresse(
			{ suche: 'berger', bereich: 'vote', gegenstand: 'abc-123', von: '2026-05-01', bis: '2026-05-31' },
			2
		);
		const parameter = new URLSearchParams(adresse.split('?')[1]);
		expect(parameter.get('suche')).toBe('berger');
		expect(parameter.get('bereich')).toBe('vote');
		expect(parameter.get('gegenstand')).toBe('abc-123');
		expect(parameter.get('von')).toBe('2026-05-01');
		expect(parameter.get('bis')).toBe('2026-05-31');
		expect(parameter.get('seite')).toBe('2');
	});

	it('schreibt Sonderzeichen so, dass sie zurückkommen, wie sie eingegeben wurden', () => {
		const adresse = verlaufsAdresse({ suche: 'Müller & Co. 100%' });
		const zurueck = new URLSearchParams(adresse.split('?')[1]).get('suche');
		expect(zurueck).toBe('Müller & Co. 100%');
	});
});

describe('Ob überhaupt gefiltert ist', () => {
	it('erkennt jeden einzelnen Filter', () => {
		expect(istGefiltert({})).toBe(false);
		expect(istGefiltert({ suche: ' ' })).toBe(false);
		expect(istGefiltert({ suche: 'x' })).toBe(true);
		expect(istGefiltert({ bereich: 'vote' })).toBe(true);
		expect(istGefiltert({ art: 'vote.round.opened' })).toBe(true);
		expect(istGefiltert({ gegenstand: 'abc' })).toBe(true);
		expect(istGefiltert({ von: '2026-01-01' })).toBe(true);
		expect(istGefiltert({ bis: '2026-01-01' })).toBe(true);
	});
});
