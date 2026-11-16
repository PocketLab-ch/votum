import { describe, expect, it } from 'vitest';
import {
	eroeffne,
	istLaufend,
	schliesse,
	setzeAktuellesTraktandum,
	type Versammlung
} from '../../src/lib/domain/versammlung';
import { nimmFreigabeZurueck } from '../../src/lib/domain/freigabe';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';

function v(u: Partial<Versammlung> = {}): Versammlung {
	return {
		id: 'v-1',
		operatorId: 'op-1',
		stwegId: 'stweg-1',
		zustand: 'freigegeben',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt',
		papierfrage: true,
		vorgaengerId: null,
		...u
	};
}

describe('Eröffnen', () => {
	it('wechselt von freigegeben auf laufend', () => {
		const u = eroeffne(v());
		expect(u.ergebnis.zustand).toBe('laufend');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.versammlungEroeffnet);
	});

	it('eröffnet auch eine Versammlung, die nicht beschlussfähig sein wird', () => {
		// Sie muss eröffnet werden können — sonst liesse sich die
		// Beschlussunfähigkeit gar nicht feststellen und protokollieren.
		expect(() => eroeffne(v())).not.toThrow();
	});

	it('weist die Eröffnung im Entwurf ab', () => {
		expect(() => eroeffne(v({ zustand: 'entwurf' }))).toThrow(/Entwurf/);
	});

	it('weist eine zweite Eröffnung ab', () => {
		expect(() => eroeffne(v({ zustand: 'laufend' }))).toThrow(FachlicherFehler);
	});

	it('versperrt danach die Rücknahme der Freigabe', () => {
		// Auf der Momentaufnahme wurde bereits gerechnet; ein neuer Stand machte
		// jede bisherige Feststellung unbelegbar (AD-3).
		const laufend = eroeffne(v()).ergebnis;
		expect(() => nimmFreigabeZurueck(laufend)).toThrow(/laufend/);
	});
});

describe('Schliessen', () => {
	it('wechselt von laufend auf geschlossen', () => {
		const u = schliesse(v({ zustand: 'laufend' }));
		expect(u.ergebnis.zustand).toBe('geschlossen');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.versammlungGeschlossen);
	});

	it('räumt das aktuelle Traktandum weg', () => {
		const u = schliesse(v({ zustand: 'laufend', aktuellesTraktandumId: 't-1' }));
		expect(u.ergebnis.aktuellesTraktandumId).toBeNull();
	});

	it('weist das Schliessen bei offener Abstimmung ab', () => {
		// Nach dem Schliessen der Versammlung liesse sie sich nicht mehr zu Ende
		// bringen.
		expect(() => schliesse(v({ zustand: 'laufend' }), 2)).toThrow(/2 Abstimmungen sind/);
		expect(() => schliesse(v({ zustand: 'laufend' }), 1)).toThrow(/1 Abstimmung ist/);
	});

	it('weist das Schliessen vor der Eröffnung ab', () => {
		expect(() => schliesse(v())).toThrow(/freigegeben/);
	});
});

describe('Das aktuelle Traktandum', () => {
	it('lässt sich setzen und schreibt den Wechsel mit', () => {
		const u = setzeAktuellesTraktandum(v({ zustand: 'laufend' }), 't-3');
		expect(u.ergebnis.aktuellesTraktandumId).toBe('t-3');
		expect(u.ereignisse[0].angaben).toMatchObject({ vorher: null, nachher: 't-3' });
	});

	it('erzeugt kein Ereignis, wenn es dasselbe bleibt', () => {
		const laufend = v({ zustand: 'laufend', aktuellesTraktandumId: 't-3' });
		expect(setzeAktuellesTraktandum(laufend, 't-3').ereignisse).toHaveLength(0);
	});

	it('lässt sich zurücknehmen', () => {
		const laufend = v({ zustand: 'laufend', aktuellesTraktandumId: 't-3' });
		expect(setzeAktuellesTraktandum(laufend, null).ergebnis.aktuellesTraktandumId).toBeNull();
	});

	it('geht nur bei laufender Versammlung', () => {
		expect(() => setzeAktuellesTraktandum(v(), 't-1')).toThrow(FachlicherFehler);
	});
});

describe('Zustandsfragen', () => {
	it('erkennt die laufende Versammlung', () => {
		expect(istLaufend({ zustand: 'laufend' })).toBe(true);
		for (const z of ['entwurf', 'freigegeben', 'geschlossen', 'versiegelt'] as const) {
			expect(istLaufend({ zustand: z })).toBe(false);
		}
	});
});
