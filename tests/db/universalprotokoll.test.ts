/**
 * Die Einstellung der Universalversammlung im Fristvermerk des Protokolls.
 *
 * **Die Lücke** (Pendenzen 18.10.2026, Featureprüfung Block 3): Die
 * Domänenprobe prüft den Wortlaut, aber niemand prüfte, ob
 * `server/protokoll.ts` die Einstellung überhaupt an `fristvermerkImProtokoll`
 * übergibt. Fehlt die Übergabe, gilt still «persönlich», und das Protokoll
 * einer Gemeinschaft mit «anwesend oder vertreten» sagt etwas Falsches.
 *
 * **Die Lage, die es braucht:** eine zu früh angesetzte zweite Versammlung
 * mit Momentaufnahme und einer Gemeinschaft, die auch Vertretene zählt. Der
 * Fristvermerk endet dann auf `FRISTFOLGE`; nur so ersetzt der Kern seinen
 * Folgesatz.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Universalprotokoll');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});

afterAll(verbindungenSchliessen);

async function gemeinschaft(name: string) {
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
	return g;
}

describe('Der Fristvermerk nennt die Einstellung der Gemeinschaft', () => {
	it('übergibt «anwesend oder vertreten» an den Fristvermerk', async () => {
		const g = await gemeinschaft('Universalprotokoll vertreten');
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			reglementGestattet: false,
			reglementFundstelle: null,
			universalvariante: 'vertreten',
			universalFundstelle: 'Art. 5 Reglement',
			leitungsvollmachtenZaehlen: true
		});

		const erste = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-08-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const zweite = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-08-05',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'zweite',
			betriebsart: 'gefuehrt',
			vorgaengerId: erste.id
		});
		// Die Momentaufnahme entsteht bei der Freigabe; ohne sie gäbe es keine
		// Einstellung zu lesen, und die Vorgabe «persönlich» stünde still da.
		await gibVersammlungFrei(handelnder(betreiber), zweite.id);

		const text = await stelleEntwurfZusammen(
			betreiber,
			zweite.id,
			new Date().toISOString(),
			'Prüflauf'
		);
		const zeile = text
			.split('\n')
			.find((z) => z.startsWith('| Frist nicht eingehalten |'));
		expect(zeile, 'Die zweite Versammlung trägt keinen Fristvermerk.').toBeDefined();
		expect(zeile).toContain('diese Gemeinschaft zählt auch Vertretene');
		/*
		 * **Die Gegenprobe steckt im selben Satz.** Fehlt die Übergabe in
		 * `server/protokoll.ts`, ersetzt der Kern den Folgesatz mit der Vorgabe
		 * «persönlich»; genau dieser Halbsatz darf nicht dastehen.
		 */
		expect(zeile).not.toContain('nur persönlich Anwesende');
	});
});
