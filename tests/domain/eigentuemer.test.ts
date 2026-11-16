import { describe, expect, it } from 'vitest';
import {
	aendereEigentuemer,
	legeEigentuemerAn,
	pruefeEigentuemer,
	stimmkraft,
	stimmkraftAller,
	type EigentuemerEingabe,
	type StimmkraftEinheit
} from '$lib/domain/eigentuemer';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

const GRUNDFALL: EigentuemerEingabe = {
	stwegId: 's1',
	kind: 'natural',
	displayName: 'Renate Berger',
	representativeName: null,
	isCommunity: false
};

function mit(aenderung: Partial<EigentuemerEingabe>): EigentuemerEingabe {
	return { ...GRUNDFALL, ...aenderung };
}

function einheit(
	unitId: string,
	stammquote: number,
	extra: Partial<StimmkraftEinheit> = {}
): StimmkraftEinheit {
	return { unitId, kind: 'unit', countsAsHead: true, stammquote, ...extra };
}

describe('pruefeEigentuemer', () => {
	it('nimmt eine natürliche Person an', () => {
		expect(pruefeEigentuemer(GRUNDFALL).displayName).toBe('Renate Berger');
	});

	it('weist einen fehlenden Namen ab', () => {
		expect(() => pruefeEigentuemer(mit({ displayName: ' ' }))).toThrow(FachlicherFehler);
	});

	/*
	 * **Freiwillig seit dem 27.08.2026** (Produktentscheid). Bis dahin stand hier
	 * eine Absage. Ist nur einer der Mitberechtigten anwesend, darf die
	 * Sitzungsleitung annehmen, dass er die Gemeinschaft gültig vertritt, und
	 * zwar ohne Vollmacht (Wermelinger, Rz. 19 ad Art. 712o); am Einlass
	 * entscheidet ohnehin der Zugangscode und nicht der gedruckte Name.
	 */
	it('lässt gemeinschaftliches Eigentum ohne bezeichnete Vertretung zu', () => {
		const e = pruefeEigentuemer(mit({ isCommunity: true }));
		expect(e.representativeName).toBeNull();
	});

	it('nimmt gemeinschaftliches Eigentum mit Vertreter an', () => {
		const e = pruefeEigentuemer(
			mit({
				displayName: 'Erbengemeinschaft Berger',
				isCommunity: true,
				representativeName: 'Renate Berger'
			})
		);
		expect(e.representativeName).toBe('Renate Berger');
	});

	it('verlangt bei einer juristischen Person eine vertretungsberechtigte Person', () => {
		// Eine juristische Person handelt nie selbst. Ohne benannte Person wäre am
		// Eingang nicht prüfbar, ob die erschienene Person auftreten darf.
		expect(() =>
			pruefeEigentuemer(mit({ kind: 'legal', displayName: 'Muster Immobilien AG' }))
		).toThrow(/vertretungsberechtigte/);
	});

	it('nimmt eine juristische Person mit Vertretung an', () => {
		const e = pruefeEigentuemer(
			mit({ kind: 'legal', displayName: 'Muster Immobilien AG', representativeName: 'Peter Kunz' })
		);
		expect(e.kind).toBe('legal');
	});

	it('behandelt eine leere Vertreterangabe wie eine fehlende', () => {
		// Bei der juristischen Person, wo sie weiterhin Pflicht ist: Leerraum ist
		// keine Angabe.
		expect(() =>
			pruefeEigentuemer(
				mit({ kind: 'legal', displayName: 'Muster Immobilien AG', representativeName: '   ' })
			)
		).toThrow(FachlicherFehler);
		// Bei gemeinschaftlichem Eigentum wird daraus `null`, nicht eine Absage.
		expect(
			pruefeEigentuemer(mit({ isCommunity: true, representativeName: '   ' })).representativeName
		).toBeNull();
	});

	it('weist eine unvollständige E-Mail-Adresse ab', () => {
		expect(() => pruefeEigentuemer(mit({ email: 'renate@' }))).toThrow(/E-Mail/);
	});

	it('lässt die E-Mail-Adresse weg, wenn sie leer ist', () => {
		expect(pruefeEigentuemer(mit({ email: '  ' })).email).toBeUndefined();
	});

	it('weist eine unbekannte Personenart ab', () => {
		expect(() => pruefeEigentuemer(mit({ kind: 'verein' as never }))).toThrow(/Unbekannte Personenart/);
	});
});

describe('legeEigentuemerAn', () => {
	it('hält im Verlauf fest, ob es gemeinschaftliches Eigentum ist', () => {
		const u = legeEigentuemerAn('p1', mit({ isCommunity: true, representativeName: 'Renate Berger' }));
		expect(u.ereignisse[0].art).toBe('party.created');
		expect(u.ereignisse[0].angaben).toMatchObject({
			gemeinschaftlich: true,
			vertreter: 'Renate Berger'
		});
	});
});

describe('aendereEigentuemer', () => {
	const bisher = legeEigentuemerAn('p1', GRUNDFALL).ergebnis;

	it('hält den Wechsel des Vertreters mit beiden Werten fest', () => {
		const u = aendereEigentuemer(bisher, mit({ isCommunity: true, representativeName: 'Peter Kunz' }));
		const felder = u.ereignisse[0].angaben?.felder as Record<string, unknown>;
		expect(felder.representativeName).toEqual({ vorher: null, nachher: 'Peter Kunz' });
		expect(felder.isCommunity).toEqual({ vorher: false, nachher: true });
	});

	it('erzeugt kein Ereignis ohne Änderung', () => {
		expect(aendereEigentuemer(bisher, GRUNDFALL).ereignisse).toHaveLength(0);
	});
});

describe('stimmkraft bei der Zählweise «je Eigentümer»', () => {
	it('gibt einem Eigentümer mit drei Einheiten eine Kopfstimme und die Summe der Quoten', () => {
		// ZGB Art. 712o Abs. 1. Das Vorgängerprojekt hängte die Kopfstimme an die
		// Einheit und gab ihm still drei.
		const k = stimmkraft(
			'p1',
			[einheit('u1', 85), einheit('u2', 90), einheit('u3', 75)],
			'per_owner',
			false
		);
		expect(k.kopfstimmen).toBe(1);
		expect(k.wertquote).toBe(250);
	});

	it('gibt einem Eigentümer mit einer Einheit ebenfalls eine Kopfstimme', () => {
		expect(stimmkraft('p1', [einheit('u1', 85)], 'per_owner', false).kopfstimmen).toBe(1);
	});

	it('zählt Nebenobjekte bei der Wertquote mit, ohne die Kopfstimme zu verändern', () => {
		const k = stimmkraft(
			'p1',
			[einheit('u1', 85), einheit('p1', 15, { kind: 'parking', countsAsHead: false })],
			'per_owner',
			false
		);
		expect(k.kopfstimmen).toBe(1);
		expect(k.wertquote).toBe(100);
	});

	it('gibt einer Partei ohne Einheit keine Kopfstimme', () => {
		// Sie ist nicht Mitglied der Gemeinschaft. Kommt beim Erfassen vor, solange
		// die Zuordnung noch fehlt.
		const k = stimmkraft('p1', [], 'per_owner', false);
		expect(k.kopfstimmen).toBe(0);
		expect(k.wertquote).toBe(0);
	});
});

describe('stimmkraft bei der Zählweise «je Einheit»', () => {
	it('gibt einem Eigentümer mit drei Einheiten drei Kopfstimmen und dieselbe Quotensumme', () => {
		const k = stimmkraft(
			'p1',
			[einheit('u1', 85), einheit('u2', 90), einheit('u3', 75)],
			'per_unit',
			false
		);
		expect(k.kopfstimmen).toBe(3);
		expect(k.wertquote).toBe(250);
	});

	it('lässt ein Nebenobjekt aus, wenn die Gemeinschaft es nicht mitzählt', () => {
		const k = stimmkraft(
			'p1',
			[einheit('u1', 85), einheit('p1', 15, { kind: 'parking' })],
			'per_unit',
			false
		);
		expect(k.kopfstimmen).toBe(1);
		expect(k.wertquote).toBe(100);
	});

	it('zählt ein Nebenobjekt mit, wenn die Gemeinschaft es vorsieht', () => {
		const k = stimmkraft(
			'p1',
			[einheit('u1', 85), einheit('p1', 15, { kind: 'parking' })],
			'per_unit',
			true
		);
		expect(k.kopfstimmen).toBe(2);
	});

	it('lässt eine Einheit ohne Kopfstimmenkennzeichen aus', () => {
		const k = stimmkraft(
			'p1',
			[einheit('u1', 85), einheit('u2', 90, { countsAsHead: false })],
			'per_unit',
			false
		);
		expect(k.kopfstimmen).toBe(1);
		expect(k.wertquote).toBe(175);
	});

	it('lässt die Reglementsregel nicht Einheit für Einheit aushebeln', () => {
		// Die Einstellung der Gemeinschaft ist die Obergrenze. Sagt sie
		// «Nebenobjekte zählen nicht», hilft ein gesetztes Häkchen bei der einzelnen
		// Einheit nichts.
		const k = stimmkraft(
			'p1',
			[einheit('p1', 15, { kind: 'parking', countsAsHead: true })],
			'per_unit',
			false
		);
		expect(k.kopfstimmen).toBe(0);
	});
});

describe('stimmkraftAller', () => {
	const parteien = [
		{ partyId: 'p1', einheiten: [einheit('u1', 400), einheit('u2', 100)] },
		{ partyId: 'p2', einheiten: [einheit('u3', 300)] },
		{ partyId: 'p3', einheiten: [einheit('u4', 200)] }
	];

	it('summiert Kopfstimmen und Wertquoten aus derselben Menge', () => {
		const u = stimmkraftAller(parteien, 'per_owner', false);
		expect(u.summeKopfstimmen).toBe(3);
		expect(u.summeWertquote).toBe(1000);
		expect(u.je.find((k) => k.partyId === 'p1')!.wertquote).toBe(500);
	});

	it('ändert die Kopfsumme mit der Zählweise, nicht die Quotensumme', () => {
		const jeEinheit = stimmkraftAller(parteien, 'per_unit', false);
		expect(jeEinheit.summeKopfstimmen).toBe(4);
		expect(jeEinheit.summeWertquote).toBe(1000);
	});

	it('kommt mit einer leeren Gemeinschaft zurecht', () => {
		const u = stimmkraftAller([], 'per_owner', false);
		expect(u.summeKopfstimmen).toBe(0);
		expect(u.summeWertquote).toBe(0);
	});

	it('rechnet eine Partei ohne Einheit nicht in die Kopfsumme', () => {
		const u = stimmkraftAller([...parteien, { partyId: 'p4', einheiten: [] }], 'per_owner', false);
		expect(u.summeKopfstimmen).toBe(3);
	});
});
