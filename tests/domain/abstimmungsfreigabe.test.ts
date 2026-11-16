import { describe, expect, it } from 'vitest';
import {
	stelleBeschlussfaehigkeitFest,
	verlangeBeschlussfaehigkeit
} from '../../src/lib/domain/beschlussfaehigkeit';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { fortschritt } from '../../src/lib/domain/abstimmung';

/**
 * Zwanzig Eigentümer mit je einer Einheit, 1000 Quoten — die Erstversammlung
 * braucht 10 und 500. Personen und Kopfstimmen fallen hier zusammen.
 */
function lage(kopf: number, quoten: number, stufe: 'erste' | 'zweite' = 'erste') {
	return stelleBeschlussfaehigkeitFest(stufe, {
		eigentuemerGesamt: 20,
		eigentuemerAnwesend: kopf,
		kopfstimmenGesamt: 20,
		kopfstimmenAnwesend: kopf,
		gesamtquote: 1000,
		quotenAnwesend: quoten
	});
}

function absage(b: ReturnType<typeof lage>): FachlicherFehler {
	try {
		verlangeBeschlussfaehigkeit(b);
	} catch (f) {
		expect(f).toBeInstanceOf(FachlicherFehler);
		return f as FachlicherFehler;
	}
	throw new Error('Keine Absage, obwohl nicht beschlussfähig');
}

describe('Freigabe einer Abstimmung (Ä-18)', () => {
	it('lässt sie bei Beschlussfähigkeit zu', () => {
		expect(() => verlangeBeschlussfaehigkeit(lage(10, 500))).not.toThrow();
	});

	it('sperrt ohne Beschlussfähigkeit, ohne Weg zum Übersteuern', () => {
		// Die frühere Fassung liess mit einer Bestätigung trotzdem zu. Die
		// Funktion nimmt keinen solchen Parameter mehr an.
		expect(verlangeBeschlussfaehigkeit.length).toBe(1);
		expect(absage(lage(9, 500)).kennung).toBe('nicht_beschlussfaehig');
		expect(absage(lage(10, 499)).kennung).toBe('nicht_beschlussfaehig');
	});

	it('nennt, was fehlt, und den Ausweg über die Anwesenheit', () => {
		const m = absage(lage(9, 400)).message;
		expect(m).toMatch(/9, mindestens 10 nötig/);
		expect(m).toMatch(/400, mindestens 500 nötig/);
		expect(m).toMatch(/712p/);
		expect(m).toMatch(/berichtigen Sie die Anwesenheit/);
	});

	it('schickt ohne Stimmberechtigte nicht an die Anwesenheit, und ohne doppelten Punkt', () => {
		const leer = stelleBeschlussfaehigkeitFest('erste', {
			eigentuemerGesamt: 0,
			eigentuemerAnwesend: 0,
			kopfstimmenGesamt: 0,
			kopfstimmenAnwesend: 0,
			gesamtquote: 1000,
			quotenAnwesend: 0
		});
		const m = absage(leer).message;
		expect(m).toMatch(/keine stimmberechtigte Partei/);
		expect(m).not.toMatch(/\.\./);
		expect(m).not.toMatch(/berichtigen Sie die Anwesenheit|zweite Versammlung/);
		expect(m).toMatch(/Eigentümerliste oder der Zählweise/);
	});

	it('verweist nur an der ersten Versammlung auf die zweite', () => {
		expect(absage(lage(9, 400)).message).toMatch(/zweite Versammlung/);
		// Die zweite braucht ein Drittel der Köpfe, mindestens zwei (Art. 712p Abs. 3).
		const zweite = absage(lage(1, 50, 'zweite'));
		expect(zweite.message).not.toMatch(/zweite Versammlung ein/);
		expect(zweite.message).toMatch(/Nachzügler/);
	});
});

describe('Wer noch nicht gestimmt hat', () => {
	/*
	 * **Im Saal ruft man Namen auf, keine Zahlen** (Bedienbarkeitsprüfung
	 * 05.09.2026, vierter der schweren Befunde der Bewirtschaftersicht):
	 * «‹0 von 5 haben abgestimmt›, aber nirgends die Namen.»
	 */
	const namen = new Map([
		['a', 'Anna Amsler'],
		['b', 'Beat Exempel'],
		['c', 'Clara Caduff']
	]);

	it('nennt die offenen Parteien in der Reihenfolge des Stands', () => {
		const f = fortschritt(['a', 'b', 'c'], [{ partyId: 'b' }], namen);
		expect(f.offeneNamen).toEqual(['Anna Amsler', 'Clara Caduff']);
		expect(f.abgegeben).toBe(1);
	});

	it('nennt niemanden, wenn alle gestimmt haben', () => {
		const f = fortschritt(['a', 'b'], [{ partyId: 'a' }, { partyId: 'b' }], namen);
		expect(f.offeneNamen).toEqual([]);
		expect(f.vollstaendig).toBe(true);
	});

	it('nennt eine Partei ohne Namen als Platzhalter, statt sie wegzulassen', () => {
		/*
		 * **Sonst gingen Zahl und Liste auseinander** (Code-Review 06.09.2026):
		 * «2 von 2 offen» über einem einzigen Namen liesse die Sitzungsleitung
		 * schliessen, obwohl noch jemand fehlt. Eine Kennung vorzulesen hilft
		 * niemandem — dass da noch jemand ist, muss man aber sehen.
		 */
		const f = fortschritt(['a', 'unbekannt'], [], namen);
		expect(f.offeneNamen).toEqual(['Anna Amsler', 'ohne Namen']);
		expect(f.stimmberechtigt).toBe(2);
	});
});
