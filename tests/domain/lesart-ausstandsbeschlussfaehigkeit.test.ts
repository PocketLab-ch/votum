/**
 * Lesart L7 im Kern (Migration 183, Einteilung F3b, B2): Katalog, die
 * Beteiligung ohne die Personen im Ausstand, die Sätze je Wahl und Lage und
 * die Zeile am Beschluss. Die Sperre selbst prüft
 * `tests/db/lesart-ausstandsbeschlussfaehigkeit.test.ts` am echten Weg.
 *
 * Vier Eigentümer zu 300, 300, 200 und 200 von 1000: An einer ersten
 * Versammlung sind die Hälfte der Eigentümer und die Hälfte der Wertquoten
 * nötig. Sind p1 und p2 da, genügt das knapp; steht p2 im Ausstand, hängt
 * die Beschlussfähigkeit an ihm.
 */
import { describe, expect, it } from 'vitest';
import { LESARTEN_VORGABE, lesartVon, pruefeLesartenwahl, wahlInWorten } from '$lib/domain/lesarten';
import { ausstandsbefund, beteiligungDerAnwesenden, beteiligungOhneAusstand } from '$lib/domain/anwesenheit';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { stelleBeschlussfaehigkeitFest } from '$lib/domain/beschlussfaehigkeit';
import {
	ausstandssaetzeVorDemEroeffnen,
	AUSSTAND_NICHT_BESCHLUSSFAEHIG,
	AUSSTAND_ZAEHLT_LEITUNG,
	AUSSTAND_ZAEHLT_PROTOKOLL
} from '$lib/domain/mehrhinweise';
import { ausstandFehlteAmBeschluss, ausstandFehlteSatz } from '$lib/domain/protokoll';
import {
	quittungVonHand,
	VON_HAND_AUSSTAND_RISIKO,
	VON_HAND_FESTGEHALTEN,
	VON_HAND_FESTGEHALTEN_AUSSTAND
} from '$lib/domain/vonhand';
import type { Vertretung } from '$lib/domain/auszaehlung';
import type { Snapshot, SnapshotParty } from '$lib/domain/types';

const SNAPSHOT: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-06T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: ([
		['p1', 'Erika Beispiel', 300],
		['p2', 'Hans Probe', 300],
		['p3', 'Ida Muster', 200],
		['p4', 'Kurt Beispiel', 200]
	] as const).map(([partyId, displayName, quota]) => ({
		partyId,
		displayName,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${partyId}-u`, label: `Whg ${partyId}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};

const LISTE = stimmkraftliste(SNAPSHOT);

/** p2 ist nur über die Vertreterin ohne Partei da (Migration 167, Ä-26). */
const UEBER_FREMDE: Vertretung[] = [
	{ vertreteneId: 'p2', bevollmaechtigtId: 'vertreter:grosse-verwaltung', bevollmaechtigtName: 'Grosse Verwaltung AG' }
];

describe('L7 im Katalog', () => {
	it('führt L7 mit der Vorgabe «zählt mit» und zwei Wahlen', () => {
		const l7 = lesartVon('L7');
		expect(l7?.vorgabe).toBe('zaehlt');
		expect(l7?.wahlen.map((w) => w.wert)).toEqual(['zaehlt', 'zaehlt_nicht']);
		expect(LESARTEN_VORGABE.L7).toBe('zaehlt');
		expect(wahlInWorten('L7', 'zaehlt')).toBe('Zählt mit (Vorgabe)');
		expect(wahlInWorten('L7', 'zaehlt_nicht')).toBe('Zählt nicht mit');
	});

	it('nimmt die zwei Wahlen an und weist anderes ab', () => {
		expect(pruefeLesartenwahl({ L7: 'zaehlt_nicht' })).toEqual({ L7: 'zaehlt_nicht' });
		expect(() => pruefeLesartenwahl({ L7: 'zaehlt' })).not.toThrow();
		expect(() => pruefeLesartenwahl({ L7: 'mitzaehlen' })).toThrow(/Unbekannte Wahl «mitzaehlen» für die Lesart L7/);
	});

	it('nennt die Frage in Alltagssprache und den Gegenstand mit «ob»', () => {
		const l7 = lesartVon('L7')!;
		expect(l7.frage).toBe(
			'Zählt für die Beschlussfähigkeit mit, wer bei einem Traktandum im Ausstand ist?'
		);
		expect(l7.gegenstand).toMatch(/^ob /);
		expect(l7.geltung).toContain('Am Mehr ändert sie nichts: Wer im Ausstand ist, stimmt in keinem Fall mit.');
	});

	it('sagt in der geltung von L5, dass die eigene Einstellung es regelt', () => {
		const geltung = lesartVon('L5')!.geltung ?? '';
		expect(geltung).toContain(
			'Ob mitzählt, wer im Ausstand ist, regelt die Einstellung zum Ausstand und zur Beschlussfähigkeit.'
		);
		expect(geltung).not.toContain('Wer im Ausstand ist, zählt für die Beschlussfähigkeit mit.');
	});
});

describe('L7, die Beteiligung ohne die Personen im Ausstand', () => {
	it('lässt die Beteiligung unverändert, wenn niemand im Ausstand ist', () => {
		const anwesende = ['p1', 'p2'];
		expect(beteiligungOhneAusstand(LISTE, anwesende, [], [])).toEqual(beteiligungDerAnwesenden(LISTE, anwesende));
	});

	it('nimmt die Partei im Ausstand aus den Anwesenden, nicht aus den Gesamtheiten', () => {
		const b = beteiligungOhneAusstand(LISTE, ['p1', 'p2'], ['p2'], []);
		expect(b.eigentuemerAnwesend).toBe(1);
		expect(b.kopfstimmenAnwesend).toBe(1);
		expect(b.quotenAnwesend).toBe(300);
		// Wer als abwesend gilt, bleibt Eigentümer: Die Gesamtheiten sind die
		// Bezugsgrössen des Art. 712p, nicht die Anwesenheitsliste.
		expect(b.eigentuemerGesamt).toBe(4);
		expect(b.kopfstimmenGesamt).toBe(4);
		expect(b.gesamtquote).toBe(1000);
	});

	it('nimmt auch die Partei heraus, die nur über einen Vertreter im Ausstand vertreten ist', () => {
		const b = beteiligungOhneAusstand(LISTE, ['p1', 'p2'], ['vertreter:grosse-verwaltung'], UEBER_FREMDE);
		expect(b.eigentuemerAnwesend).toBe(1);
		expect(b.quotenAnwesend).toBe(300);
	});

	it('lässt die Partei drin, die selbst da ist, obwohl ihr Vertreter im Ausstand steht', () => {
		// Die Vertretungsliste führt nur Vollmachten, auf denen die Anwesenheit
		// beruht (`leseVertretungen`); wer selbst kommt, hat keine dabei.
		const b = beteiligungOhneAusstand(LISTE, ['p1', 'p2'], ['vertreter:grosse-verwaltung'], []);
		expect(b.eigentuemerAnwesend).toBe(2);
		expect(b.quotenAnwesend).toBe(600);
	});

	it('ändert nichts an einer Partei im Ausstand, die gar nicht anwesend ist', () => {
		const b = beteiligungOhneAusstand(LISTE, ['p1'], ['p2'], []);
		expect(b.eigentuemerAnwesend).toBe(1);
		expect(b.quotenAnwesend).toBe(300);
	});
});

describe('L7, die Beschlussfähigkeit darauf', () => {
	it('ist mit den Personen im Ausstand gegeben und ohne sie nicht', () => {
		const mit = stelleBeschlussfaehigkeitFest('erste', beteiligungDerAnwesenden(LISTE, ['p1', 'p2']), null);
		expect(mit.beschlussfaehig).toBe(true);
		const ohne = stelleBeschlussfaehigkeitFest(
			'erste',
			beteiligungOhneAusstand(LISTE, ['p1', 'p2'], ['p2'], []),
			null
		);
		expect(ohne.beschlussfaehig).toBe(false);
	});

	it('bleibt gegeben, wenn genug weitere Eigentümer da sind', () => {
		const ohne = stelleBeschlussfaehigkeitFest(
			'erste',
			beteiligungOhneAusstand(LISTE, ['p1', 'p2', 'p3', 'p4'], ['p4'], []),
			null
		);
		expect(ohne.beschlussfaehig).toBe(true);
	});
});

describe('L7, die Sätze je Wahl und Lage', () => {
	it('sagt der Leitung vor dem Eröffnen, dass der Beschluss angreifbar wäre', () => {
		expect(AUSSTAND_ZAEHLT_LEITUNG).toBe(
			'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Traktandum nicht beschlussfähig. Votum zählt sie nach der Einstellung Ihrer Gemeinschaft mit (SVIT-Kommentar Rz. 17 ad Art. 712p). Nach einer anderen Lehrmeinung zählen sie nicht, und der Beschluss wäre angreifbar. Sicher ist er, wenn so viele weitere Eigentümer da oder vertreten sind, dass die Versammlung auch ohne die Personen im Ausstand beschlussfähig ist.'
		);
	});

	it('trägt die Tatsache am Beschluss ins Protokoll', () => {
		expect(AUSSTAND_ZAEHLT_PROTOKOLL).toBe(
			'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss nicht beschlussfähig gewesen; nach der Einstellung der Gemeinschaft zählten sie mit.'
		);
		expect(ausstandFehlteSatz({ wahl: 'zaehlt', angenommen: true })).toBe(AUSSTAND_ZAEHLT_PROTOKOLL);
		expect(ausstandFehlteSatz({ wahl: 'zaehlt', angenommen: true }, 'STWEG Beispielweg 1')).toBe(
			'Ohne die Personen im Ausstand wäre die Versammlung von STWEG Beispielweg 1 bei diesem Beschluss nicht beschlussfähig gewesen; nach der Einstellung der Gemeinschaft zählten sie mit.'
		);
	});

	it('nennt die Absage unter «Zählt nicht mit» ohne den unverbindlichen Weg (Entscheid 0043)', () => {
		expect(AUSSTAND_NICHT_BESCHLUSSFAEHIG).toBe(
			'Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig. Nach der Einstellung Ihrer Gemeinschaft zählen sie dafür nicht mit; verbindlich abgestimmt wird deshalb nicht. Ist jemand im Saal, der nicht als anwesend erfasst ist, oder steht jemand irrtümlich im Ausstand, berichtigen Sie das. Sonst setzen Sie das Traktandum auf die Liste einer späteren Versammlung; besprechen darf die Versammlung es trotzdem.'
		);
		expect(AUSSTAND_NICHT_BESCHLUSSFAEHIG).not.toMatch(/unverbindlich|konsultativ|verschieben/);
	});

	it('nennt unter «Zählt nicht mit» am Beschluss von Hand den Mangel und die Anfechtung', () => {
		const an = ausstandFehlteSatz({ wahl: 'zaehlt_nicht', angenommen: true });
		expect(an).toMatch(
			/^Ohne die Personen im Ausstand war die Versammlung bei diesem Beschluss nicht beschlussfähig; nach der Einstellung der Gemeinschaft zählten sie dafür nicht mit\. /
		);
		expect(an).toMatch(/nicht mit\. Der Beschluss gilt, bis ein Gericht ihn aufhebt\. Wer ihm nicht zugestimmt/);
		expect(an).toMatch(/ihm nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert eines Monats/);
		const ab = ausstandFehlteSatz({ wahl: 'zaehlt_nicht', angenommen: false });
		expect(ab).toMatch(/Die Ablehnung gilt, bis ein Gericht sie aufhebt\./);
		expect(ab).not.toMatch(/Der Beschluss gilt/);
		expect(ab).toMatch(/Der Antrag kann einer beschlussfähigen Versammlung erneut vorgelegt werden\./);
		expect(ausstandFehlteSatz({ wahl: 'zaehlt_nicht', angenommen: true }, 'STWEG Beispielweg 1')).toMatch(
			/^Ohne die Personen im Ausstand war die Versammlung von STWEG Beispielweg 1 bei diesem Beschluss/
		);
	});
});

describe('L7, die Zeile am Beschluss', () => {
	const ANGENOMMEN = { angenommen: true, keinBeschluss: null };
	const basis = {
		wahl: 'zaehlt' as const,
		stimmkraft: LISTE,
		vertretungen: [] as Vertretung[],
		stufe: 'erste' as const,
		regel: null,
		auszaehlung: ANGENOMMEN
	};

	it('steht genau dann, wenn die Beschlussfähigkeit an den Personen im Ausstand hängt', () => {
		expect(ausstandFehlteAmBeschluss({ ...basis, anwesende: ['p1', 'p2'], ausstand: ['p2'] })).toEqual({
			wahl: 'zaehlt',
			angenommen: true
		});
		expect(
			ausstandFehlteAmBeschluss({ ...basis, anwesende: ['p1', 'p2', 'p3', 'p4'], ausstand: ['p4'] })
		).toBeNull();
	});

	it('trägt die eingefrorene Wahl und den Ausgang', () => {
		expect(
			ausstandFehlteAmBeschluss({
				...basis,
				wahl: 'zaehlt_nicht',
				anwesende: ['p1', 'p2'],
				ausstand: ['p2'],
				auszaehlung: { angenommen: false, keinBeschluss: null }
			})
		).toEqual({ wahl: 'zaehlt_nicht', angenommen: false });
	});

	it('bleibt weg, wo die Beschlussfähigkeit nicht an den Personen im Ausstand hängt', () => {
		// Gegenprüfung Lauf 1: Niemand im Ausstand und nicht beschlussfähig,
		// sonst stünde «ohne die Personen im Ausstand» ohne Ausstand da.
		expect(ausstandFehlteAmBeschluss({ ...basis, anwesende: ['p1'], ausstand: [] })).toBeNull();
		// Schon mit der Person im Ausstand nicht beschlussfähig: Das sagt die
		// Zeile zur fehlenden Beschlussfähigkeit, nicht diese.
		expect(ausstandFehlteAmBeschluss({ ...basis, anwesende: ['p3', 'p4'], ausstand: ['p4'] })).toBeNull();
		const befund = ausstandsbefund('erste', LISTE, ['p3', 'p4'], ['p4'], [], null);
		expect(befund.ohne.beschlussfaehig).toBe(false);
		expect(befund.haengtAmAusstand).toBe(false);
		expect(ausstandsbefund('erste', LISTE, ['p1', 'p2'], ['p2'], [], null).haengtAmAusstand).toBe(true);
	});

	it('bleibt an einer konsultativen Abstimmung weg: Sie ist kein Beschluss', () => {
		expect(
			ausstandFehlteAmBeschluss({
				...basis,
				wahl: 'zaehlt_nicht',
				anwesende: ['p1', 'p2'],
				ausstand: ['p2'],
				auszaehlung: { angenommen: true, keinBeschluss: { grund: 'konsultativ' } as never }
			})
		).toBeNull();
	});

	it('rechnet die Partei mit, die nur über einen Vertreter im Ausstand vertreten war', () => {
		expect(
			ausstandFehlteAmBeschluss({
				...basis,
				anwesende: ['p1', 'p2'],
				vertretungen: UEBER_FREMDE,
				ausstand: ['vertreter:grosse-verwaltung']
			})
		).toEqual({ wahl: 'zaehlt', angenommen: true });
	});

	it('bleibt weg, wo Wahl, Stimmkraft, Anwesenheit oder Auszählung fehlen', () => {
		const lage = { anwesende: ['p1', 'p2'], ausstand: ['p2'] };
		expect(ausstandFehlteAmBeschluss({ ...basis, ...lage, wahl: null })).toBeNull();
		expect(ausstandFehlteAmBeschluss({ ...basis, ...lage, stimmkraft: null })).toBeNull();
		expect(ausstandFehlteAmBeschluss({ ...basis, ...lage, anwesende: null })).toBeNull();
		expect(ausstandFehlteAmBeschluss({ ...basis, ...lage, auszaehlung: null })).toBeNull();
	});
});

describe('L7, der Beschluss von Hand an der Sperre vorbei (Fachprüfung L7, F-2)', () => {
	it('warnt vor dem Festhalten mit der Anfechtung, ohne den Satz zur Nichtigkeit', () => {
		expect(VON_HAND_AUSSTAND_RISIKO).toMatch(/^Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig/);
		expect(VON_HAND_AUSSTAND_RISIKO).toMatch(/kann es jeder Eigentümer anfechten, der damit nicht einverstanden ist/);
		expect(VON_HAND_AUSSTAND_RISIKO).not.toMatch(/ungültig/);
	});

	it('nennt in der Quittung den Mangel, die Anfechtung und den Rat zum Ausführen', () => {
		expect(quittungVonHand([{ kennung: 'ausstand_nicht_beschlussfaehig' }])).toBe(
			`${VON_HAND_FESTGEHALTEN_AUSSTAND} ${VON_HAND_FESTGEHALTEN}`
		);
		expect(VON_HAND_FESTGEHALTEN_AUSSTAND).toMatch(/Ist der Antrag angenommen, führen Sie ihn am sichersten erst aus, wenn alle das Protokoll seit mehr als einem Monat erhalten haben/);
		// Fehlt die Beschlussfähigkeit überhaupt, gilt der bestehende Satz.
		expect(
			quittungVonHand([{ kennung: 'nicht_beschlussfaehig' }, { kennung: 'ausstand_nicht_beschlussfaehig' }])
		).not.toContain(VON_HAND_FESTGEHALTEN_AUSSTAND);
	});
});

describe('L7, die Satzwahl vor dem Eröffnen, die beide Leitungsseiten aufrufen (Featureprüfung 2, M3 T1; der Aufruf selbst ist nicht getestet)', () => {
	// Gerechnet mit derselben Kernfunktion wie `holeBeschlussfaehigkeitOhneAusstand`,
	// damit der Test die Kette vom Befund zum Satz hält, nicht nur den Wortlaut.
	const befund = (anwesende: string[], ausstand: string[], wahl: 'zaehlt' | 'zaehlt_nicht') => ({
		...ausstandsbefund('erste', LISTE, anwesende, ausstand, [], null),
		wahl
	});

	it('nennt unter der Vorgabe den Satz zur Angreifbarkeit, wenn die Beschlussfähigkeit am Ausstand hängt', () => {
		// p1 und p2 da: zwei von vier Eigentümern, 600 von 1000. Ohne p2 im
		// Ausstand: einer von vier, 300 von 1000, nicht beschlussfähig.
		expect(ausstandssaetzeVorDemEroeffnen(befund(['p1', 'p2'], ['p2'], 'zaehlt'))).toEqual([
			AUSSTAND_ZAEHLT_LEITUNG
		]);
	});

	it('nennt unter «Zählt nicht mit» die Absage, in derselben Lage', () => {
		expect(ausstandssaetzeVorDemEroeffnen(befund(['p1', 'p2'], ['p2'], 'zaehlt_nicht'))).toEqual([
			AUSSTAND_NICHT_BESCHLUSSFAEHIG
		]);
	});

	it('nennt keinen Satz, wenn die Beschlussfähigkeit auch ohne die Personen im Ausstand genügt', () => {
		// Alle vier da, p4 im Ausstand: drei von vier, 800 von 1000.
		for (const wahl of ['zaehlt', 'zaehlt_nicht'] as const) {
			expect(ausstandssaetzeVorDemEroeffnen(befund(['p1', 'p2', 'p3', 'p4'], ['p4'], wahl))).toEqual([]);
		}
	});

	it('nennt keinen Satz, wenn die Beschlussfähigkeit auch mit ihnen fehlt', () => {
		// Nur p1 da: einer von vier, 300 von 1000; die gewöhnliche Absage gilt.
		for (const wahl of ['zaehlt', 'zaehlt_nicht'] as const) {
			expect(ausstandssaetzeVorDemEroeffnen(befund(['p1'], ['p1'], wahl))).toEqual([]);
		}
	});

	it('nennt keinen Satz ohne Befund (kein Ausstand, keine Momentaufnahme, kein Traktandum)', () => {
		expect(ausstandssaetzeVorDemEroeffnen(null)).toEqual([]);
		expect(ausstandssaetzeVorDemEroeffnen(undefined)).toEqual([]);
	});
});
