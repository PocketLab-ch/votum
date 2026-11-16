import { describe, expect, it } from 'vitest';
import {
	gibFrei,
	nimmFreigabeZurueck,
	pruefeFreigabe,
	type Freigabelage
} from '../../src/lib/domain/freigabe';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';
import type { Snapshot } from '../../src/lib/domain/types';
import type { Versammlung } from '../../src/lib/domain/versammlung';

function lage(u: Partial<Freigabelage> = {}): Freigabelage {
	return {
		versammlungsdatum: '2026-09-15',
		anzahlTraktanden: 3,
		ohneErfordernis: [],
		grenzfaelle: [],
		quotenabweichungen: [],
		einheitenOhneEigentuemer: [],
		anzahlParteien: 4,
		...u
	};
}

function versammlung(u: Partial<Versammlung> = {}): Versammlung {
	return {
		id: 'v-1',
		operatorId: 'op-1',
		stwegId: 'stweg-1',
		zustand: 'entwurf',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach',
		papierfrage: true,
		vorgaengerId: null,
		...u
	};
}

function momentaufnahme(u: Partial<Snapshot> = {}): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-08-01T10:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			{
				partyId: 'p-1',
				displayName: 'Anna Muster',
				representativeName: null,
				isCommunity: false,
				units: [
					{ unitId: 'u-1', label: 'Whg 1', kind: 'unit', countsAsHead: true, quota: 500 }
				]
			},
			{
				partyId: 'p-2',
				displayName: 'Beat Beispiel',
				representativeName: null,
				isCommunity: false,
				units: [
					{ unitId: 'u-2', label: 'Whg 2', kind: 'unit', countsAsHead: true, quota: 500 }
				]
			}
		],
		...u
	};
}

describe('Hindernisse', () => {
	it('lässt eine vollständige Versammlung durch', () => {
		const b = pruefeFreigabe(lage());
		expect(b.moeglich).toBe(true);
		expect(b.hindernisse).toHaveLength(0);
	});

	it('hält eine Versammlung ohne Traktandum auf', () => {
		const b = pruefeFreigabe(lage({ anzahlTraktanden: 0 }));
		expect(b.moeglich).toBe(false);
		expect(b.hindernisse[0].kennung).toBe('keine_traktanden');
	});

	it('hält einen unausgeglichenen Wertquotensaldo auf und nennt Ebene und Abweichung', () => {
		// Ginge er nicht auf, wäre jede Auszählung nach Wertquoten falsch — und
		// zwar unbemerkt, weil auch von einer falschen Bezugsgrösse aus eine
		// Mehrheit errechnet wird.
		const b = pruefeFreigabe(
			lage({ quotenabweichungen: [{ ebene: 'Musterweg 1', abweichung: 20 }] })
		);
		expect(b.moeglich).toBe(false);
		expect(b.hindernisse[0].text).toMatch(/Musterweg 1/);
		expect(b.hindernisse[0].text).toMatch(/20/);
	});

	it('hält Einheiten ohne Eigentümer auf und nennt sie beim Namen', () => {
		const b = pruefeFreigabe(lage({ einheitenOhneEigentuemer: [{ label: 'Whg 3' }] }));
		expect(b.moeglich).toBe(false);
		expect(b.hindernisse[0].text).toMatch(/Whg 3/);
	});

	it('hält eine Ausschlussklage ohne beklagte Partei auf (Produktentscheid 29.09.2026)', () => {
		const b = pruefeFreigabe(
			lage({ ausschlussklageOhneBeklagten: [{ nummer: '7', titel: 'Ermächtigung zur Ausschlussklage' }] })
		);
		expect(b.moeglich).toBe(false);
		expect(b.hindernisse.map((h) => h.kennung)).toContain('ausschlussklage_ohne_beklagten');
		expect(b.hindernisse[0].text).toMatch(/Traktandum 7/);
		expect(pruefeFreigabe(lage({ ausschlussklageOhneBeklagten: [] })).moeglich).toBe(true);
	});

	it('hält eine Gemeinschaft ohne Eigentümer auf', () => {
		expect(pruefeFreigabe(lage({ anzahlParteien: 0 })).moeglich).toBe(false);
	});

	it('nennt zu jedem Hindernis, wo es zu beheben ist', () => {
		const b = pruefeFreigabe(
			lage({
				anzahlTraktanden: 0,
				quotenabweichungen: [{ ebene: 'X', abweichung: 1 }],
				einheitenOhneEigentuemer: [{ label: 'Y' }]
			})
		);
		expect(b.hindernisse.every((h) => h.weg)).toBe(true);
	});
});

describe('Hinweise halten nicht auf', () => {
	it('lässt ein fehlendes Mehrheitserfordernis durch', () => {
		// Es lässt sich noch im Saal nachholen und darf die Einladung nicht
		// aufhalten.
		const b = pruefeFreigabe(
			lage({ ohneErfordernis: [{ nummer: '2', titel: 'Sanierung' }] })
		);
		expect(b.moeglich).toBe(true);
		expect(b.hinweise[0].text).toMatch(/2 Sanierung/);
	});

	it('lässt einen Grenzfall durch, mahnt ihn aber an', () => {
		const b = pruefeFreigabe(lage({ grenzfaelle: [{ nummer: '3', titel: 'Nutzung' }] }));
		expect(b.moeglich).toBe(true);
		expect(b.hinweise[0].text).toMatch(/im Saal ist es dafür zu spät/);
	});
});

describe('Freigeben', () => {
	it('wechselt in den Zustand freigegeben', () => {
		const u = gibFrei(versammlung(), pruefeFreigabe(lage()), momentaufnahme());
		expect(u.ergebnis.zustand).toBe('freigegeben');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.versammlungFreigegeben);
	});

	it('schreibt die Kennzahlen der Momentaufnahme in den Verlauf', () => {
		const u = gibFrei(versammlung(), pruefeFreigabe(lage()), momentaufnahme());
		expect(u.ereignisse[0].angaben).toMatchObject({
			parteien: 2,
			kopfstimmen: 2,
			wertquoten: 1000,
			gesamtquote: 1000
		});
	});

	it('schreibt offene Hinweise mit', () => {
		// Wurde trotz offenem Erfordernis eingeladen, soll das später nicht
		// rekonstruiert werden müssen.
		const befund = pruefeFreigabe(lage({ ohneErfordernis: [{ nummer: '2', titel: 'X' }] }));
		const u = gibFrei(versammlung(), befund, momentaufnahme());
		expect((u.ereignisse[0].angaben?.offeneHinweise as string[])[0]).toMatch(/2 X/);
	});

	it('weist die Freigabe bei einem Hindernis ab', () => {
		expect(() =>
			gibFrei(versammlung(), pruefeFreigabe(lage({ anzahlTraktanden: 0 })), momentaufnahme())
		).toThrow(/kein Traktandum/);
	});

	it('weist eine Momentaufnahme einer anderen Versammlung ab', () => {
		expect(() =>
			gibFrei(versammlung(), pruefeFreigabe(lage()), momentaufnahme({ meetingId: 'v-99' }))
		).toThrow(/andere/);
	});

	it('weist einen leeren Stand ab', () => {
		// Er wäre eine Versammlung ohne Stimmberechtigte, und das fiele erst bei
		// der ersten Auszählung auf.
		expect(() =>
			gibFrei(versammlung(), pruefeFreigabe(lage()), momentaufnahme({ parties: [] }))
		).toThrow(/niemand stimmberechtigt/);
	});

	it('weist eine zweite Freigabe ab', () => {
		expect(() =>
			gibFrei(versammlung({ zustand: 'freigegeben' }), pruefeFreigabe(lage()), momentaufnahme())
		).toThrow(FachlicherFehler);
	});

	it('rechnet die Kopfstimmen nach der Zählweise der Momentaufnahme', () => {
		// Je Einheit statt je Eigentümer: Dieselben Parteien, andere Zahl.
		const u = gibFrei(
			versammlung(),
			pruefeFreigabe(lage()),
			momentaufnahme({
				headCountMode: 'per_unit',
				parties: [
					{
						partyId: 'p-1',
						displayName: 'Anna Muster',
						representativeName: null,
						isCommunity: false,
						units: [
							{ unitId: 'u-1', label: 'Whg 1', kind: 'unit', countsAsHead: true, quota: 500 },
							{ unitId: 'u-2', label: 'Whg 2', kind: 'unit', countsAsHead: true, quota: 500 }
						]
					}
				]
			})
		);
		expect(u.ereignisse[0].angaben).toMatchObject({ parteien: 1, kopfstimmen: 2 });
	});
});

describe('Rücknahme', () => {
	it('geht zurück in den Entwurf', () => {
		const u = nimmFreigabeZurueck(versammlung({ zustand: 'freigegeben' }), 'Traktandum vergessen');
		expect(u.ergebnis.zustand).toBe('entwurf');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.freigabeZurueckgenommen);
		expect(u.ereignisse[0].angaben?.grund).toBe('Traktandum vergessen');
	});

	it('vermerkt ausdrücklich, dass die Momentaufnahme verworfen ist', () => {
		// Nicht bloss überschrieben: Bei erneuter Freigabe entsteht sie neu und
		// kann andere Zahlen tragen.
		const u = nimmFreigabeZurueck(versammlung({ zustand: 'freigegeben' }));
		expect(u.ereignisse[0].angaben?.momentaufnahmeVerworfen).toBe(true);
	});

	it('weist die Rücknahme nach der Eröffnung ab', () => {
		expect(() => nimmFreigabeZurueck(versammlung({ zustand: 'laufend' }))).toThrow(/laufend/);
	});

	it('weist sie im Entwurf ab', () => {
		expect(() => nimmFreigabeZurueck(versammlung())).toThrow(FachlicherFehler);
	});
});
