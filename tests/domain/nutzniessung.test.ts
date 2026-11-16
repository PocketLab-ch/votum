import { describe, expect, it } from 'vitest';
import {
	auffangregelStimmrecht,
	legeNutzniessungAn,
	nutzniessungsHinweis,
	pruefeNutzniessung,
	type NutzniessungEingabe
} from '$lib/domain/nutzniessung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

const GRUNDFALL: NutzniessungEingabe = {
	unitId: 'u1',
	holderName: 'Hedwig Berger-Stucki',
	validFrom: '2020-05-01',
	hasAgreement: false
};

function mit(aenderung: Partial<NutzniessungEingabe>): NutzniessungEingabe {
	return { ...GRUNDFALL, ...aenderung };
}

describe('auffangregelStimmrecht — ZGB Art. 712o Abs. 2', () => {
	it('gibt dem Nutzniesser die Verwaltung', () => {
		expect(auffangregelStimmrecht('verwaltung')).toBe('nutzniesser');
	});

	it('gibt ihm auch notwendige bauliche Massnahmen', () => {
		// Ausgenommen sind ausdrücklich nur die «bloss nützlichen» und die «der
		// Verschönerung und Bequemlichkeit dienenden». Die notwendige Massnahme —
		// das undichte Dach — fällt nicht darunter.
		expect(auffangregelStimmrecht('notwendige_bauliche_massnahme')).toBe('nutzniesser');
	});

	it('lässt bloss nützliche Massnahmen beim Eigentümer', () => {
		expect(auffangregelStimmrecht('nuetzliche_bauliche_massnahme')).toBe('eigentuemer');
	});

	it('lässt verschönernde Massnahmen beim Eigentümer', () => {
		expect(auffangregelStimmrecht('verschoenernde_bauliche_massnahme')).toBe('eigentuemer');
	});

	it('lässt Zweckänderung und Grundordnung beim Eigentümer', () => {
		// Verfügung und Zweckänderung fallen schon nicht unter Abs. 2
		// (Rz. 46 ad Art. 712o); bis zum 27.09.2026 standen sie hier auf
		// «verwaltung» und damit beim Nutzniesser.
		expect(auffangregelStimmrecht('nutzungsaenderung')).toBe('eigentuemer');
		expect(auffangregelStimmrecht('grundordnung')).toBe('eigentuemer');
	});
});

describe('pruefeNutzniessung', () => {
	it('nimmt Berechtigten und Beginn an, Ende bleibt offen', () => {
		// Eine Nutzniessung endet oft erst mit dem Tod; ein Pflichtfeld dafür
		// zwänge zu einer erfundenen Angabe.
		const n = pruefeNutzniessung(GRUNDFALL);
		expect(n.holderName).toBe('Hedwig Berger-Stucki');
		expect(n.validTo).toBeUndefined();
	});

	it('weist einen fehlenden Berechtigten ab', () => {
		expect(() => pruefeNutzniessung(mit({ holderName: ' ' }))).toThrow(FachlicherFehler);
	});

	it('weist einen fehlenden Beginn ab', () => {
		expect(() => pruefeNutzniessung(mit({ validFrom: '' }))).toThrow(/Beginn/);
	});

	it('weist ein Ende vor dem Beginn ab', () => {
		expect(() => pruefeNutzniessung(mit({ validTo: '2019-01-01' }))).toThrow(/vor dem Beginn/);
	});

	it('nimmt ein Ende nach dem Beginn an', () => {
		expect(pruefeNutzniessung(mit({ validTo: '2030-01-01' })).validTo).toBe('2030-01-01');
	});

	it('verlangt zur Vereinbarung, was sie regelt', () => {
		// Eine Vereinbarung, von der nur bekannt ist, dass es sie gibt, hilft im
		// Moment der Abstimmung nicht.
		expect(() => pruefeNutzniessung(mit({ hasAgreement: true }))).toThrow(/was sie regelt/);
	});

	it('nimmt eine Vereinbarung mit Inhalt an', () => {
		const n = pruefeNutzniessung(
			mit({
				hasAgreement: true,
				agreementSummary: 'Das Stimmrecht verbleibt vollumfänglich bei der Eigentümerin.'
			})
		);
		expect(n.agreementSummary).toMatch(/Eigentümerin/);
	});

	it('verwirft eine Zusammenfassung ohne Vereinbarung', () => {
		// Sonst stünde am Traktandum ein Text, der nichts belegt.
		const n = pruefeNutzniessung(mit({ hasAgreement: false, agreementSummary: 'irgendetwas' }));
		expect(n.agreementSummary).toBeUndefined();
	});
});

describe('legeNutzniessungAn', () => {
	it('hält im Verlauf fest, ob eine Vereinbarung und ein Nachweis bestehen', () => {
		const u = legeNutzniessungAn('n1', mit({ documentChecksum: 'a'.repeat(64) }));
		expect(u.ereignisse[0].art).toBe('usufruct.created');
		expect(u.ereignisse[0].angaben).toMatchObject({
			nutzniesser: 'Hedwig Berger-Stucki',
			vereinbarung: false,
			nachweis: true
		});
	});
});

describe('nutzniessungsHinweis', () => {
	it('nennt ohne Vereinbarung die gesetzliche Auffangregel', () => {
		const text = nutzniessungsHinweis({
			holderName: 'Hedwig Berger-Stucki',
			hasAgreement: false
		});
		expect(text).toMatch(/712o Abs\. 2/);
		expect(text).toMatch(/Verwaltung/);
		expect(text).toMatch(/Verschönerung/);
	});

	it('nennt mit Vereinbarung deren Inhalt und ihren Vorrang', () => {
		const text = nutzniessungsHinweis({
			holderName: 'Hedwig Berger-Stucki',
			hasAgreement: true,
			agreementSummary: 'Das Stimmrecht verbleibt bei der Eigentümerin.'
		});
		expect(text).toMatch(/geht der gesetzlichen Regel vor/);
		// Der publizierte Ratgebertext hält ausdrücklich fest: Die Vereinbarung
		// kann **alle** Beschlussarten regeln, auch qualifiziertes Mehr und
		// Einstimmigkeit.
		expect(text).toMatch(/alle Beschlussarten/);
		expect(text).toMatch(/verbleibt bei der Eigentümerin/);
	});

	it('überlässt die Entscheidung in beiden Fällen der Sitzungsleitung', () => {
		// In Welle 1 findet ausdrücklich keine automatische Ableitung statt.
		for (const fall of [
			{ holderName: 'X', hasAgreement: false },
			{ holderName: 'X', hasAgreement: true, agreementSummary: 'y' }
		]) {
			expect(nutzniessungsHinweis(fall)).toMatch(/bestimmt die Sitzungsleitung/);
		}
	});
});
