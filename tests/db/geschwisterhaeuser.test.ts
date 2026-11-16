/**
 * Wer an einem gemeinsamen Abend in zwei Häusern stimmberechtigt ist
 * (23.08.2026, Prüflauf II, B-06).
 *
 * **Der Befund:** Katharina Zbinden hält A 1.1 und B 1.1. Sie bekommt zwei
 * Zugangskarten, je eine je Haus, jede mit eigenem Code — richtig, sie ist in
 * jeder Gemeinschaft eine eigene Partei mit eigener Stimmkraft. Nur sagte keine
 * der beiden, dass es eine zweite gibt; auf beiden stand «gilt nur für diese
 * Versammlung», was eher nahelegt, eine sei ein Versehen.
 *
 * Verknüpft wird über die **Person**, nicht über den Namen: Zwei Menschen
 * dürfen gleich heissen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstellePerson, verknuepfePartei } from '$lib/server/personen';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { geschwisterhaeuser } from '$lib/server/kartensatz';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let hausA: string;
let hausB: string;
let versammlungA: string;
let versammlungB: string;
let zbindenA: string;
let alleinA: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function haus(name: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	return g.id;
}

async function versammlung(stwegId: string): Promise<string> {
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId,
		datum: '2027-05-06',
		uhrzeit: '19:30',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return v.id;
}

/** Eine Partei mit Einheit, wahlweise an eine Person geklammert. */
async function partei(stwegId: string, name: string, label: string, personId?: string) {
	const p = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId,
		displayName: name,
		kind: 'natural',
		isCommunity: false,
		representativeName: null
	});
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId,
		label,
		kind: 'unit',
		countsAsHead: true,
		quotas: { stamm: 500 }
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2027-01-01');
	if (personId) await verknuepfePartei(handelnder(betreiber), p.id, personId);
	return p.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Geschwisterhäuser');
	hausA = await haus('STWEG Zwillingsweg A');
	hausB = await haus('STWEG Zwillingsweg B');
	versammlungA = await versammlung(hausA);
	versammlungB = await versammlung(hausB);

	const zbinden = await erstellePerson(handelnder(betreiber), {
		name: 'Katharina Zbinden',
		art: 'natural'
	});
	zbindenA = await partei(hausA, 'Katharina Zbinden', 'A 1.1', zbinden.id);
	await partei(hausB, 'Katharina Zbinden', 'B 1.1', zbinden.id);

	/*
	 * Die Gegenprobe: derselbe NAME, aber eine andere Person. Zwei Menschen
	 * dürfen gleich heissen, und wer nach Namen zusammenführte, schriebe hier
	 * jemandem, er habe anderswo eine Karte, die er nie bekommen hat.
	 */
	const andere = await erstellePerson(handelnder(betreiber), {
		name: 'Peter Lauber',
		art: 'natural'
	});
	alleinA = await partei(hausA, 'Peter Lauber', 'A 1.2', andere.id);
	await partei(hausB, 'Peter Lauber', 'B 1.2');
});

afterAll(verbindungenSchliessen);

describe('ohne gemeinsamen Abend', () => {
	it('meldet nichts, solange die Versammlungen für sich stehen', async () => {
		expect(await geschwisterhaeuser(betreiber, versammlungA)).toEqual(new Map());
	});
});

describe('am gemeinsamen Abend', () => {
	beforeAll(async () => {
		// Beide Versammlungen unter einen Abend hängen — der kürzeste Weg dahin.
		await imKontext(betreiber, async (tx) => {
			const [tag] = await tx<{ id: string }[]>`
				INSERT INTO meeting_day (operator_id, label, day_date, start_time, location)
				VALUES (${betreiber}, 'Zwillingsabend', '2027-05-06', '19:30', 'Prüfsaal')
				RETURNING id
			`;
			await tx`
				UPDATE meeting SET meeting_day_id = ${tag.id}
				 WHERE id = ANY(${[versammlungA, versammlungB]}::uuid[])
			`;
		});
	});

	it('findet die Person, die in beiden Häusern hält', async () => {
		const aus = await geschwisterhaeuser(betreiber, versammlungA);
		expect(aus.get(zbindenA)).toEqual(['STWEG Zwillingsweg B']);
	});

	it('verwechselt zwei gleichnamige Menschen nicht', async () => {
		// Peter Lauber steht in beiden Häusern — aber als zwei verschiedene
		// Personen. Genau hier wäre ein Namensvergleich falsch.
		const aus = await geschwisterhaeuser(betreiber, versammlungA);
		expect(aus.has(alleinA), 'derselbe Name, andere Person — keine Verbindung').toBe(false);
	});

	it('sieht dasselbe von der anderen Seite', async () => {
		const aus = await geschwisterhaeuser(betreiber, versammlungB);
		expect([...aus.values()].flat()).toEqual(['STWEG Zwillingsweg A']);
	});
});
