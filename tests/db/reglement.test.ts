/**
 * Story 2.4 — Schranken der Reglementsabweichungen in der Datenbank.
 *
 * Die fachlichen Prüfungen stehen im Kern und sind dort mit Wertetabellen
 * belegt. Hier geht es um das, was der Kern nicht garantieren kann: Zeilenschutz
 * je Betreiber, die Eindeutigkeit je Geschäftsart und die Prüfbedingungen, die
 * auch dann greifen, wenn jemand am Kern vorbei schreibt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import {
	erstelleAnwesenheitsregel,
	holeAnwesenheitsregeln,
	loescheAnwesenheitsregel,
	erstelleReglementsregel,
	holePruefstand,
	holeReglementsregeln,
	loescheReglementsregel,
	setzePruefungZurueck,
	vermerkePruefung
} from '$lib/server/reglement';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { ReglementsregelEingabe } from '$lib/domain/reglement';

let betreiberA: string;
let betreiberB: string;
let stwegA: string;
let stwegB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

function regel(stwegId: string, aenderung: Partial<ReglementsregelEingabe> = {}): ReglementsregelEingabe {
	return {
		stwegId,
		geschaeftsart: 'baulich_nuetzlich',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Reglement Ziff. 12.3',
		enthaltungZaehltMit: true,
		...aenderung
	};
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Reglement A');
	betreiberB = await pruefbetreiber('Reglement B');
	const a = await erstelleGemeinschaft(handelnder(betreiberA), {
		name: 'Reglementweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const b = await erstelleGemeinschaft(handelnder(betreiberB), {
		name: 'Fremdweg 2',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stwegA = a.id;
	stwegB = b.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Hinterlegen', () => {
	it('speichert die Regel und hält sie im Verlauf fest', async () => {
		const r = await erstelleReglementsregel(handelnder(betreiberA), regel(stwegA));
		expect(r.id).toMatch(/^[0-9a-f-]{36}$/);

		const [eintrag] = await imKontext(
			betreiberA,
			(tx) =>
				tx`SELECT event_type, detail FROM audit_entry
				   WHERE event_type = 'bylaw.rule.stored' AND subject_id = ${stwegA}`
		);
		expect(eintrag.detail).toMatchObject({ kopf: '2/3', fundstelle: 'Reglement Ziff. 12.3' });
	});

	it('ersetzt eine zweite Regel derselben Geschäftsart, statt sie danebenzustellen', async () => {
		// Zwei widersprüchliche Regeln wären schlimmer als keine: Es gäbe keinen
		// Grund, warum die eine gälte.
		await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, {
				kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
				fundstelle: 'Reglement Ziff. 12.4'
			})
		);
		const regeln = await holeReglementsregeln(betreiberA, stwegA);
		const baulich = regeln.filter((r) => r.geschaeftsart === 'baulich_nuetzlich');
		expect(baulich).toHaveLength(1);
		expect(baulich[0].kopfSchwelle).toEqual({ zaehler: 3, nenner: 4, art: 'mindestens' });
		expect(baulich[0].fundstelle).toBe('Reglement Ziff. 12.4');
	});

	it('lässt mehrere Geschäftsarten nebeneinander bestehen', async () => {
		await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { geschaeftsart: 'reglement', fundstelle: 'Reglement Ziff. 20' })
		);
		const regeln = await holeReglementsregeln(betreiberA, stwegA);
		expect(regeln.map((r) => r.geschaeftsart).sort()).toEqual(['baulich_nuetzlich', 'reglement']);
	});
});

describe('Schranken der Datenbank', () => {
	it('weist einen Bruch über dem Ganzen ab, auch am Kern vorbei', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'organe',
					        4, 3, 'mindestens', 'anwesend_vertreten', 'Ziff. 1')
				`
			)
		).rejects.toThrow(/bylaw_rule_kopf_bruch/);
	});

	/*
	 * **Der ganze Bruch muss durch** (22.08.2026, Befund A-02). Die Sperre sass an
	 * DREI Stellen: in der Domänenprüfung, im `min`-Merkmal des Eingabefelds und
	 * hier im CHECK. Wer nur die ersten beiden lockert, bekommt statt einer
	 * Absage einen 500er — genau so geschehen, bevor Migration 075 entstand.
	 */
	it('nimmt die Einstimmigkeit als ganzen Bruch an', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'baulich_luxurioes',
					        1, 1, 'mindestens', 'alle_eigentuemer', '§ 12 Abs. 3')
				`
			)
		).resolves.not.toThrow();
	});

	it('weist einen Nenner von null weiterhin ab', async () => {
		// Die Lockerung geht bis 1, nicht bis 0: Ein Bruch durch null ist keine
		// Schwelle, sondern ein Rechenfehler.
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'organe',
					        1, 0, 'mindestens', 'anwesend_vertreten', 'Ziff. 2')
				`
			)
		).rejects.toThrow(/bylaw_rule_kopf_bruch/);
	});

	it('weist eine Quotenschwelle ohne Basis ab', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base,
						 quota_numerator, quota_denominator, quota_mode, quota_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'organe',
					        2, 3, 'mindestens', 'anwesend_vertreten',
					        2, 3, 'mindestens', 'keine', 'Ziff. 1')
				`
			)
		).rejects.toThrow(/bylaw_rule_quoten_vollstaendig/);
	});

	it('weist eine leere Fundstelle ab', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'organe',
					        2, 3, 'mindestens', 'anwesend_vertreten', '  ')
				`
			)
		).rejects.toThrow(/bylaw_rule_fundstelle/);
	});

	it('lässt keine Regel für eine fremde Gemeinschaft zu', async () => {
		// Der zusammengesetzte Fremdschlüssel (stweg_id, operator_id) verhindert,
		// dass eine Regel des einen Betreibers an der Gemeinschaft des anderen
		// hängt — auch wenn beide Kennungen für sich gültig sind.
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegB}, 'organe',
					        2, 3, 'mindestens', 'anwesend_vertreten', 'Ziff. 1')
				`
			)
		).rejects.toThrow(/bylaw_quorum_rule_stweg_id_operator_id_fkey|violates foreign key/i);
	});

	it('weist einen Prüfer ohne Prüfdatum ab', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					UPDATE stweg SET bylaw_reviewed_by = 'jemand', bylaw_reviewed_on = NULL
					WHERE id = ${stwegA}
				`
			)
		).rejects.toThrow(/stweg_pruefvermerk_vollstaendig/);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem fremden Betreiber keine Regeln', async () => {
		const regeln = await holeReglementsregeln(betreiberB, stwegA);
		expect(regeln).toEqual([]);
	});

	it('weist das Einfügen ohne Mandantenkontext ab', async () => {
		await expect(
			ohneKontext(
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule
						(id, operator_id, stweg_id, business_kind,
						 head_numerator, head_denominator, head_mode, head_base, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'organe',
					        2, 3, 'mindestens', 'anwesend_vertreten', 'Ziff. 1')
				`
			)
		).rejects.toThrow(/row-level security|Zeilensicherheitsrichtlinie/i);
	});
});

describe('Prüfstand', () => {
	it('steht anfangs auf «noch nie nachgesehen»', async () => {
		const stand = await holePruefstand(betreiberB, stwegB);
		expect(stand.geprueftAm).toBeNull();
		expect(stand.anzahlRegeln).toBe(0);
	});

	it('vermerkt die Durchsicht mit Datum und Person', async () => {
		await vermerkePruefung(handelnder(betreiberA), stwegA, '2026-07-30');
		const stand = await holePruefstand(betreiberA, stwegA);
		expect(stand.geprueftAm).toBe('2026-07-30');
		expect(stand.geprueftDurch).toBe('Prüflauf');
		expect(stand.anzahlRegeln).toBeGreaterThan(0);
	});

	it('nimmt die Bestätigung zurück und hält den Grund fest', async () => {
		await setzePruefungZurueck(handelnder(betreiberA), stwegA, 'Reglement per 2027 geändert.');
		const stand = await holePruefstand(betreiberA, stwegA);
		expect(stand.geprueftAm).toBeNull();
		expect(stand.geprueftDurch).toBeNull();

		const [eintrag] = await imKontext(
			betreiberA,
			(tx) =>
				tx`SELECT detail FROM audit_entry
				   WHERE event_type = 'bylaw.review.reset' AND subject_id = ${stwegA}`
		);
		expect(eintrag.detail).toMatchObject({ grund: 'Reglement per 2027 geändert.' });
	});
});

describe('Aufheben', () => {
	it('entfernt die Regel und hält die Aufhebung im Verlauf fest', async () => {
		const regeln = await holeReglementsregeln(betreiberA, stwegA);
		const zuLoeschen = regeln.find((r) => r.geschaeftsart === 'reglement');
		expect(zuLoeschen).toBeDefined();

		await loescheReglementsregel(handelnder(betreiberA), zuLoeschen!.id);
		const danach = await holeReglementsregeln(betreiberA, stwegA);
		expect(danach.map((r) => r.geschaeftsart)).not.toContain('reglement');

		const [eintrag] = await imKontext(
			betreiberA,
			(tx) =>
				tx`SELECT detail FROM audit_entry
				   WHERE event_type = 'bylaw.rule.removed' AND subject_id = ${stwegA}`
		);
		expect(eintrag.detail).toMatchObject({ geschaeftsart: 'reglement' });
	});

	it('löscht nichts, wenn ein fremder Betreiber es versucht', async () => {
		const [verbleibend] = await holeReglementsregeln(betreiberA, stwegA);
		await loescheReglementsregel(handelnder(betreiberB), verbleibend.id);
		const danach = await holeReglementsregeln(betreiberA, stwegA);
		expect(danach.map((r) => r.id)).toContain(verbleibend.id);
	});
});

describe('Beschlussfähigkeit im Reglement (Story 2.6)', () => {
	it('nimmt eine Erschwerung an und gibt sie je Versammlungsstufe zurück', async () => {
		await erstelleAnwesenheitsregel(handelnder(betreiberA), stwegA, 'erste', {
			kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quoten: { zaehler: 2, nenner: 3, art: 'mindestens' },
			mindestens: 3,
			fundstelle: 'Reglement Ziff. 8.1'
		});
		const regeln = await holeAnwesenheitsregeln(betreiberA, stwegA);
		expect(regeln.erste?.kopf).toEqual({ zaehler: 2, nenner: 3, art: 'mindestens' });
		// Kein Rückfall auf die Regel der anderen Art: Erste und zweite
		// Versammlung haben verschiedene Schwellen, und eine übernommene Regel
		// wäre an der falschen Stelle streng.
		expect(regeln.zweite).toBeUndefined();
	});

	it('weist eine Erleichterung schon im Kern ab, bevor etwas geschrieben wird', async () => {
		await expect(
			erstelleAnwesenheitsregel(handelnder(betreiberA), stwegA, 'zweite', {
				kopf: { zaehler: 1, nenner: 4, art: 'mindestens' },
				quoten: null,
				mindestens: 2,
				fundstelle: 'Ziff. 8.2'
			})
		).rejects.toThrow(/erschweren, nicht erleichtern/);
		const regeln = await holeAnwesenheitsregeln(betreiberA, stwegA);
		expect(regeln.zweite).toBeUndefined();
	});

	it('hält die gesetzliche Untergrenze auch am Kern vorbei', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO bylaw_attendance_rule
						(id, operator_id, stweg_id, meeting_kind,
						 head_numerator, head_denominator, min_heads, source_reference)
					VALUES (gen_random_uuid(), ${betreiberA}, ${stwegA}, 'zweite', 1, 2, 1, 'Ziff. 8.2')
				`
			)
		).rejects.toThrow(/bylaw_attendance_untergrenze/);
	});

	it('zeigt einem fremden Betreiber keine Anwesenheitsregeln', async () => {
		expect(await holeAnwesenheitsregeln(betreiberB, stwegA)).toEqual({});
	});

	it('hebt eine Regel auf und hält es im Verlauf fest', async () => {
		await loescheAnwesenheitsregel(handelnder(betreiberA), stwegA, 'erste');
		expect((await holeAnwesenheitsregeln(betreiberA, stwegA)).erste).toBeUndefined();

		const eintraege = await imKontext(
			betreiberA,
			(tx) =>
				tx`SELECT detail FROM audit_entry
				   WHERE event_type = 'bylaw.rule.removed' AND subject_id = ${stwegA}`
		);
		expect(
			eintraege.some((e) => (e.detail as Record<string, unknown>).gegenstand === 'beschlussfaehigkeit')
		).toBe(true);
	});

	/*
	 * **Kein Eintrag ohne Tat** (Sicherheitsdurchgang 06.09.2026).
	 *
	 * Der Verlaufseintrag stand vor dem `DELETE` und ohne Bedingung: Traf es
	 * keine Zeile, blieb ein Eintrag stehen, der eine Aufhebung bezeugt, die es
	 * nie gab. Über die Oberfläche fällt das nicht auf — den Knopf gibt es nur
	 * an einer vorhandenen Regel —, aber ein zweites Absenden genügt.
	 *
	 * Dieselbe Klasse wie bei den Vollmachten in 69f107c: Ein Schreibvorgang,
	 * der nichts trifft, sieht von aussen aus wie ein erfolgreicher.
	 */
	it('schreibt nichts in den Verlauf, wenn es nichts aufzuheben gab', async () => {
		const vorher = await imKontext(
			betreiberA,
			(tx) =>
				tx`SELECT count(*)::int AS n FROM audit_entry
				   WHERE event_type = 'bylaw.rule.removed' AND subject_id = ${stwegA}`
		);

		// Zweites Aufheben derselben Stufe: Die Regel ist schon weg.
		await loescheAnwesenheitsregel(handelnder(betreiberA), stwegA, 'erste');

		const nachher = await imKontext(
			betreiberA,
			(tx) =>
				tx`SELECT count(*)::int AS n FROM audit_entry
				   WHERE event_type = 'bylaw.rule.removed' AND subject_id = ${stwegA}`
		);
		expect(nachher[0].n).toBe(vorher[0].n);
	});
});
