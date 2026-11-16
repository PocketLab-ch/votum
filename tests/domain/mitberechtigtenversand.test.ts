/**
 * Wer die Einladung bekommt, nach Wermelinger, Rz. 50 f. ad Art. 712n (Aufgabe 5).
 *
 * Reine Regeln, keine Datenbank: Der Empfängerkreis ist die eine Stelle, an der
 * sich entscheidet, ob ein Mitberechtigter angeschrieben wird. Eine
 * unterbliebene Einladung macht den Beschluss anfechtbar; deshalb steht die
 * Entscheidung im Kern und ist ohne laufendes System prüfbar.
 */
import { describe, expect, it } from 'vitest';
import { empfaengerkreis, zustellkreis } from '$lib/domain/mitberechtigte';

const anna = {
	partyId: 'a',
	displayName: 'Anna Muster',
	email: 'anna@example.ch',
	address: null,
	istZustelladresse: false,
	istVertreter: true,
	archiviertAm: null
};
const beat = {
	partyId: 'b',
	displayName: 'Beat Muster',
	email: 'beat@example.ch',
	address: null,
	istZustelladresse: false,
	istVertreter: false,
	archiviertAm: null
};

describe('Wer die Einladung bekommt', () => {
	it('ohne gemeldete Zustelladresse: alle einzeln (Rz. 50 ad Art. 712n)', () => {
		expect(empfaengerkreis([anna, beat], null).map((e) => e.adresse)).toEqual([
			'anna@example.ch',
			'beat@example.ch'
		]);
	});

	it('mit gemeldeter Zustelladresse: nur dorthin', () => {
		const gemeldet = { ...beat, istZustelladresse: true };
		expect(empfaengerkreis([anna, gemeldet], null).map((e) => e.adresse)).toEqual([
			'beat@example.ch'
		]);
	});

	it('fällt auf die Adresse der Hülle zurück, wenn keine Person eine hat', () => {
		const ohne = [
			{ ...anna, email: null },
			{ ...beat, email: null }
		];
		expect(empfaengerkreis(ohne, 'huelle@example.ch').map((e) => e.adresse)).toEqual([
			'huelle@example.ch'
		]);
	});

	it('meldet niemanden, wo es nirgends eine Adresse gibt', () => {
		const ohne = [
			{ ...anna, email: null },
			{ ...beat, email: null }
		];
		expect(empfaengerkreis(ohne, null)).toEqual([]);
	});

	it('nennt den Rückfall beim Sammelnamen der Hülle', () => {
		// Ohne Namen stünde in der Versandliste und im Verlauf eine Zeile ohne
		// Empfänger — die Adresse allein sagt niemandem, wer gemeint war.
		const ohne = [
			{ ...anna, email: null },
			{ ...beat, email: null }
		];
		expect(empfaengerkreis(ohne, 'huelle@example.ch')[0].name).toBe(
			'Anna Muster und Beat Muster'
		);
	});

	it('überspringt eine gemeldete Zustelladresse ohne Adresse nicht stillschweigend', () => {
		/*
		 * Der gefährliche Fall: Jemand meldet Beat als Zustelladresse und trägt
		 * bei ihm keine E-Mail ein. Der Kreis ist damit auf ihn eingeengt — und
		 * er ist nicht erreichbar. Dann darf die Einladung NICHT an Anna gehen
		 * (der Kreis ist eingeengt), sondern an die Adresse der Hülle. Ginge sie
		 * an Anna, hätte die Meldung das Gegenteil dessen bewirkt, was sie sagt.
		 */
		const gemeldet = { ...beat, email: null, istZustelladresse: true };
		expect(empfaengerkreis([anna, gemeldet], 'huelle@example.ch').map((e) => e.adresse)).toEqual([
			'huelle@example.ch'
		]);
	});
});

describe('Wer im Archiv liegt', () => {
	it('bekommt keine Einladung', () => {
		/*
		 * Eine Mitgliedszeile hält keine Einheit und lässt sich deshalb jederzeit
		 * archivieren. Wer seinen Anteil verkauft hat, gehört nicht mehr
		 * eingeladen — und seine Adresse gehört erst recht nicht auf eine
		 * Zugangskarte.
		 */
		const weg = { ...beat, archiviertAm: '2026-08-01T00:00:00.000Z' };
		expect(empfaengerkreis([anna, weg], null).map((e) => e.adresse)).toEqual([
			'anna@example.ch'
		]);
	});

	it('engt den Kreis nicht mehr ein, auch wenn er als Zustelladresse gemeldet war', () => {
		// Die überzählige Einladung ist die ungefährliche Richtung, die
		// ausgelassene nicht (Art. 75 ZGB).
		const weg = { ...beat, istZustelladresse: true, archiviertAm: '2026-08-01T00:00:00.000Z' };
		expect(empfaengerkreis([anna, weg], null).map((e) => e.adresse)).toEqual([
			'anna@example.ch'
		]);
	});

	it('lässt den Rückfall greifen, wenn ausser ihm niemand eine Adresse hat', () => {
		const weg = { ...beat, archiviertAm: '2026-08-01T00:00:00.000Z' };
		expect(empfaengerkreis([{ ...anna, email: null }, weg], 'huelle@example.ch')).toEqual([
			{ partyId: '', name: 'Anna Muster und Beat Muster', adresse: 'huelle@example.ch' }
		]);
	});
});

describe('Der Zustellkreis', () => {
	it('ist ohne Meldung die ganze Runde', () => {
		expect(zustellkreis([anna, beat]).map((m) => m.partyId)).toEqual(['a', 'b']);
	});

	it('ist mit Meldung nur die eine Person — auch ohne Adresse', () => {
		// Anders als `empfaengerkreis` filtert er nicht nach Adresse: Die
		// Versandliste soll auch die nennen, an die mangels Adresse nichts geht.
		const gemeldet = { ...beat, email: null, istZustelladresse: true };
		expect(zustellkreis([anna, gemeldet]).map((m) => m.partyId)).toEqual(['b']);
	});
});
