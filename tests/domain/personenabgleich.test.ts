/**
 * Vorschläge zur Personenverknüpfung.
 *
 * Der Prüfstein ist nicht, dass viel gefunden wird, sondern dass **nichts
 * Falsches** gefunden wird: Eine falsche Klammer gibt am Versammlungstag
 * jemandem Zutritt zu einer Versammlung, in der er nichts zu suchen hat.
 */
import { describe, expect, it } from 'vitest';
import {
	vergleichsname,
	verknuepfungsvorschlaege,
	vorauswahl,
	type AbgleichPartei,
	type AbgleichPerson
} from '$lib/domain/personenabgleich';

const PERSONEN: AbgleichPerson[] = [
	{ id: 'p1', name: 'Markus Probère', gemeinschaften: ['Nirgendweg 5/5a'] },
	{ id: 'p2', name: 'Ursula Beispiel', gemeinschaften: [] }
];

function partei(u: Partial<AbgleichPartei> = {}): AbgleichPartei {
	return { parteiId: 'a1', name: 'Markus Probère', personId: null, verknuepfbar: true, ...u };
}

describe('Vergleichsname', () => {
	it('vereinheitlicht Leerraum und Gross-/Kleinschreibung', () => {
		expect(vergleichsname('  Markus   Probère ')).toBe(vergleichsname('markus probère'));
	});

	it('lässt Abkürzungen verschieden', () => {
		// «M. Probère» und «Markus Probère» sind zwei Namen. Wer das aufweicht,
		// verschiebt die Fehlerklasse von «nichts gefunden» zu «das Falsche
		// gefunden».
		expect(vergleichsname('M. Probère')).not.toBe(vergleichsname('Markus Probère'));
	});
});

describe('Vorschläge', () => {
	it('schlägt eine gleichnamige Person vor und begründet es', () => {
		const [v] = verknuepfungsvorschlaege([partei()], PERSONEN);
		expect(v.personId).toBe('p1');
		expect(v.hinweis).toContain('Nirgendweg 5/5a');
		expect(v.hinweis).toContain('Prüfen Sie');
	});

	it('schlägt nichts vor, wenn schon verknüpft', () => {
		expect(verknuepfungsvorschlaege([partei({ personId: 'p1' })], PERSONEN)).toEqual([]);
	});

	it('schlägt nichts vor bei einer Gemeinschaft oder gemeinschaftlichem Eigentum', () => {
		// Dahinter steht nicht eine Person; eine Klammer gäbe einem die Stimme
		// aller anderen.
		expect(verknuepfungsvorschlaege([partei({ verknuepfbar: false })], PERSONEN)).toEqual([]);
	});

	it('schlägt bei zwei gleichnamigen Personen nichts vor', () => {
		// «Meier» gibt es in einer Überbauung dreimal. Dann muss ein Mensch
		// entscheiden, und die Anwendung sagt lieber nichts als das Falsche.
		const doppelt: AbgleichPerson[] = [
			{ id: 'p3', name: 'Hans Meier', gemeinschaften: ['Haus 4'] },
			{ id: 'p4', name: 'Hans Meier', gemeinschaften: ['Haus 8'] }
		];
		expect(verknuepfungsvorschlaege([partei({ name: 'Hans Meier' })], doppelt)).toEqual([]);
	});

	it('schlägt bei blosser Ähnlichkeit nichts vor', () => {
		expect(verknuepfungsvorschlaege([partei({ name: 'M. Probère' })], PERSONEN)).toEqual([]);
		expect(verknuepfungsvorschlaege([partei({ name: 'Markus Probere' })], PERSONEN)).toEqual([]);
	});

	it('findet trotz anderer Schreibung von Leerraum', () => {
		const [v] = verknuepfungsvorschlaege([partei({ name: 'markus  PROBÈRE' })], PERSONEN);
		expect(v?.personId).toBe('p1');
	});
});

describe('Vorauswahl beim Erfassen', () => {
	it('wählt die eine gleichnamige Person vor', () => {
		expect(vorauswahl('Markus Probère', PERSONEN)?.id).toBe('p1');
	});

	it('wählt bei Mehrdeutigkeit nichts vor', () => {
		const doppelt = [
			{ id: 'p3', name: 'Hans Meier', gemeinschaften: [] },
			{ id: 'p4', name: 'Hans Meier', gemeinschaften: [] }
		];
		expect(vorauswahl('Hans Meier', doppelt)).toBeNull();
	});

	it('wählt bei zu kurzer Eingabe nichts vor', () => {
		// Sonst springt die Auswahl beim Tippen des ersten Buchstabens.
		expect(vorauswahl('M', PERSONEN)).toBeNull();
	});
});
