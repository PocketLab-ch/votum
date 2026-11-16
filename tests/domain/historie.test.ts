import { describe, expect, it } from 'vitest';
import {
	beruehrteVersammlungen,
	findeLuecken,
	giltAm,
	planeZuordnung,
	ueberschneidet,
	type Zuordnung
} from '$lib/domain/historie';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

function z(id: string, partyId: string, von: string, bis: string | null = null): Zuordnung {
	return { id, partyId, validFrom: von, validTo: bis };
}

describe('giltAm — links geschlossen, rechts offen', () => {
	const zeitraum = { validFrom: '2026-03-01', validTo: '2026-06-01' };

	it('gilt am ersten Tag', () => {
		expect(giltAm(zeitraum, '2026-03-01')).toBe(true);
	});

	it('gilt nicht am Tag davor', () => {
		expect(giltAm(zeitraum, '2026-02-28')).toBe(false);
	});

	it('gilt am letzten Tag davor', () => {
		expect(giltAm(zeitraum, '2026-05-31')).toBe(true);
	});

	it('gilt am Endtag nicht mehr', () => {
		// Der Tag des Wechsels gehört dem neuen Eigentümer. Sonst gäbe es einen Tag
		// mit zwei Eigentümern — und eine Abstimmung an genau diesem Tag wäre falsch.
		expect(giltAm(zeitraum, '2026-06-01')).toBe(false);
	});

	it('gilt ohne Ende auf Weiteres', () => {
		expect(giltAm({ validFrom: '2020-01-01', validTo: null }, '2099-12-31')).toBe(true);
	});
});

describe('ueberschneidet', () => {
	it('erkennt aneinander stossende Zeiträume als überschneidungsfrei', () => {
		// Genau der Regelfall eines Verkaufs: alt endet am 1. März, neu beginnt am
		// 1. März.
		const alt = { validFrom: '2020-01-01', validTo: '2026-03-01' };
		const neu = { validFrom: '2026-03-01', validTo: null };
		expect(ueberschneidet(alt, neu)).toBe(false);
	});

	it('erkennt eine echte Überschneidung', () => {
		expect(
			ueberschneidet(
				{ validFrom: '2020-01-01', validTo: '2026-04-01' },
				{ validFrom: '2026-03-01', validTo: null }
			)
		).toBe(true);
	});

	it('behandelt zwei offene Zeiträume als überschneidend', () => {
		expect(
			ueberschneidet(
				{ validFrom: '2020-01-01', validTo: null },
				{ validFrom: '2026-03-01', validTo: null }
			)
		).toBe(true);
	});
});

describe('planeZuordnung', () => {
	it('beendet eine laufende Zuordnung am Stichtag', () => {
		const plan = planeZuordnung([z('a', 'alt', '2020-01-01')], 'neu', '2026-03-01');
		expect(plan.zuBeenden).toEqual([{ id: 'a', partyId: 'alt', neuesEnde: '2026-03-01' }]);
		expect(plan.zuEntfernen).toEqual([]);
		expect(plan.luecken).toEqual([]);
	});

	it('lässt eine frühere, bereits beendete Zuordnung unberührt', () => {
		const plan = planeZuordnung(
			[z('a', 'ganz_alt', '2015-01-01', '2020-01-01'), z('b', 'alt', '2020-01-01')],
			'neu',
			'2026-03-01'
		);
		expect(plan.zuBeenden.map((b) => b.id)).toEqual(['b']);
	});

	it('kappt bei einer rückwirkenden Korrektur mitten im Zeitraum', () => {
		// Die Korrektur wird übernommen, und der frühere Eigentümer bleibt für die
		// Zeit davor sichtbar.
		const plan = planeZuordnung([z('a', 'alt', '2020-01-01')], 'neu', '2023-06-01');
		expect(plan.zuBeenden).toEqual([{ id: 'a', partyId: 'alt', neuesEnde: '2023-06-01' }]);
	});

	it('verdrängt eine Zuordnung, die vollständig im neuen Zeitraum liegt', () => {
		// Der Fall, der ohne Vorschau am ehesten überrascht: Eine ganze Zuordnung
		// verschwindet.
		const plan = planeZuordnung(
			[z('a', 'zwischendurch', '2023-01-01', '2024-01-01')],
			'neu',
			'2022-01-01'
		);
		expect(plan.zuEntfernen).toEqual([{ id: 'a', partyId: 'zwischendurch' }]);
		expect(plan.zuBeenden).toEqual([]);
	});

	it('weist einen Zeitraum ab, der rückwärts läuft', () => {
		expect(() => planeZuordnung([], 'neu', '2026-05-01', '2026-01-01')).toThrow(FachlicherFehler);
	});

	it('weist einen ungültigen Stichtag ab', () => {
		expect(() => planeZuordnung([], 'neu', '01.03.2026')).toThrow(/gültiges Datum/);
	});
});

describe('findeLuecken', () => {
	it('meldet keine Lücke bei nahtlosem Anschluss', () => {
		const bestehend = [z('a', 'alt', '2020-01-01')];
		const luecken = findeLuecken(bestehend, { validFrom: '2026-03-01', validTo: null });
		expect(luecken).toEqual([]);
	});

	it('meldet eine Lücke, wenn die neue Zuordnung später beginnt', () => {
		// Eine Einheit ohne Eigentümer gibt es im Grundbuch nicht. Entstünde die
		// Lücke, fehlte die Einheit in jeder Abstimmung dieses Zeitraums, und die
		// Wertquotensumme ginge dort nicht auf.
		const bestehend = [z('a', 'alt', '2020-01-01', '2026-01-01')];
		const luecken = findeLuecken(bestehend, { validFrom: '2026-03-01', validTo: null });
		expect(luecken).toEqual([{ validFrom: '2026-01-01', validTo: '2026-03-01' }]);
	});

	it('meldet eine Lücke, die durch das Entfernen einer Zuordnung entsteht', () => {
		const bestehend = [
			z('a', 'alt', '2020-01-01', '2023-01-01'),
			z('b', 'mitte', '2023-01-01', '2024-01-01'),
			z('c', 'neu', '2024-01-01')
		];
		const luecken = findeLuecken(bestehend, { validFrom: '2099-01-01', validTo: null }, [
			{ id: 'b' }
		]);
		expect(luecken).toContainEqual({ validFrom: '2023-01-01', validTo: '2024-01-01' });
	});

	it('meldet nichts, wenn ab einem Punkt alles offen weiterläuft', () => {
		const bestehend = [z('a', 'alt', '2020-01-01')];
		expect(findeLuecken(bestehend, { validFrom: '2020-01-01', validTo: null })).toEqual([]);
	});
});

describe('beruehrteVersammlungen', () => {
	const versammlungen = [
		{ meetingId: 'v1', bezeichnung: 'Ordentliche 2025', datum: '2025-04-15' },
		{ meetingId: 'v2', bezeichnung: 'Ordentliche 2026', datum: '2026-04-20' },
		{ meetingId: 'v3', bezeichnung: 'Ausserordentliche', datum: '2026-06-10' }
	];

	it('nennt die Versammlungen ab dem Stichtag', () => {
		// Ihre Momentaufnahmen bleiben unverändert (AD-3, AD-16); gerade deshalb
		// muss sichtbar sein, dass Stammdaten und eingefrorener Stand nun
		// auseinandergehen.
		const beruehrt = beruehrteVersammlungen(versammlungen, '2026-03-01');
		expect(beruehrt.map((v) => v.meetingId)).toEqual(['v2', 'v3']);
	});

	it('lässt frühere Versammlungen unberührt', () => {
		const beruehrt = beruehrteVersammlungen(versammlungen, '2026-07-01');
		expect(beruehrt).toEqual([]);
	});

	it('zählt eine Versammlung am Stichtag selbst mit', () => {
		expect(beruehrteVersammlungen(versammlungen, '2026-04-20').map((v) => v.meetingId)).toEqual([
			'v2',
			'v3'
		]);
	});
});
