/**
 * Die Nutzniessung durch die Kette (Welle 3, FR-22 letzter Punkt).
 *
 * Der Kern rechnet die Zuordnung mit einer Wertetabelle; hier geht es um das,
 * was er nicht sehen kann: dass die Nutzniessung **eingefroren** wird. Ändert
 * jemand sie später, darf sich nicht ändern, wer an der vergangenen Versammlung
 * stimmberechtigt war (AD-3).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleNutzniessung } from '$lib/server/nutzniessung';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { stimmrechtBeiNutzniessung } from '$lib/domain/nutzniessung';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

async function mitNutzniessung(name: string, datum: string, vereinbarung = false) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Aebi',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

	await erstelleNutzniessung(handelnder(betreiber), {
		unitId: e.id,
		holderName: 'Frau Keller',
		validFrom: '2021-01-01',
		hasAgreement: vereinbarung,
		// Der Vertrag liegt der Bewirtschaftung vor — der Regelfall, denn er ist
		// die Grundlage dieser Erfassung.
		contractOnFile: true,
		agreementSummary: vereinbarung ? 'Frau Keller stimmt in allen Fragen.' : undefined
	});

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);

	return { gemeinschaft: g.id, einheit: e.id, versammlung: v.id };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Nutzniessung');
	benutzer = await pruefbenutzer(betreiber, 'nutzniessungsleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Momentaufnahme', () => {
	it('friert die Nutzniessung mit ein', async () => {
		const s = await mitNutzniessung('Nutzweg 1', '2027-08-01');
		const m = await holeMomentaufnahme(betreiber, s.versammlung);

		const einheit = m!.parties[0].units[0];
		expect(einheit.nutzniessung?.holderName).toBe('Frau Keller');
		expect(einheit.nutzniessung?.hasAgreement).toBe(false);
		// Der Vermerk zum Vertrag ist mit eingefroren.
		expect(einheit.nutzniessung?.contractOnFile).toBe(true);
	});

	it('lässt eine spätere Änderung die vergangene Versammlung nicht berühren', async () => {
		/*
		 * **AD-3.** Wer die Nutzniessung nächstes Jahr beendet oder eine
		 * Vereinbarung nachträgt, ändert damit nicht, wer an dieser Versammlung
		 * stimmberechtigt war. Sonst verschöbe sich eine Auskunft über die
		 * Vergangenheit — und niemand sähe es der Zahl an.
		 */
		const s = await mitNutzniessung('Nutzweg 2', '2027-08-02');

		await imKontext(
			betreiber,
			(tx) => tx`UPDATE usufruct SET has_agreement = true,
			                              agreement_summary = 'Nachträglich vereinbart'
			            WHERE unit_id = ${s.einheit}`
		);

		const m = await holeMomentaufnahme(betreiber, s.versammlung);
		expect(m!.parties[0].units[0].nutzniessung?.hasAgreement).toBe(false);
	});

	it('führt eine Einheit ohne Nutzniessung ohne Angabe', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Nutzweg 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Bucher',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-08-03',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);

		const m = await holeMomentaufnahme(betreiber, v.id);
		expect(m!.parties[0].units[0].nutzniessung ?? null).toBeNull();
	});
});

describe('Die Zuordnung am eingefrorenen Stand', () => {
	it('gibt dem Eigentümer die Stimme bei einer nützlichen Massnahme', async () => {
		const s = await mitNutzniessung('Nutzweg 4', '2027-08-04');
		const m = await holeMomentaufnahme(betreiber, s.versammlung);
		const n = m!.parties[0].units[0].nutzniessung!;

		expect(stimmrechtBeiNutzniessung(n, 'baulich_nuetzlich').wer).toBe('eigentuemer');
		// Und in allen übrigen Fragen die Nutzniesserin.
		expect(stimmrechtBeiNutzniessung(n, 'verwaltung_gewoehnlich').wer).toBe('nutzniesser');
		expect(stimmrechtBeiNutzniessung(n, 'baulich_notwendig').wer).toBe('nutzniesser');
	});

	it('überlässt die Zuordnung der Sitzungsleitung, wenn eine Vereinbarung besteht', async () => {
		const s = await mitNutzniessung('Nutzweg 5', '2027-08-05', true);
		const m = await holeMomentaufnahme(betreiber, s.versammlung);
		const n = m!.parties[0].units[0].nutzniessung!;

		expect(n.hasAgreement).toBe(true);
		const befund = stimmrechtBeiNutzniessung(n, 'baulich_nuetzlich');
		expect(befund.wer).toBe('unbestimmt');
		expect(befund.vonHand).toBe(true);
		// Der Wortlaut der Vereinbarung ist mit eingefroren — sonst müsste im Saal
		// jemand die Akte holen.
		expect(befund.satz).toMatch(/Frau Keller stimmt in allen Fragen/);
	});
});
