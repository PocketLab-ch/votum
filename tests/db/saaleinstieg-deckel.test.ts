/**
 * **Saalmeldungen sind je Versammlung gedeckelt** (D10, Migration 162).
 *
 * `saaleinstieg_melden` schrieb bis zum 15.10.2026 je Aufruf eine Zeile, von
 * einem offenen Pfad aus und ohne Obergrenze. Der Deckel steht bei 500; die
 * Begründung des Werts steht in der Migration.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { holeOderErzeugeSaalmerkmal, meldeUeberSaal } from '$lib/server/saaleinstieg';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

const DECKEL = 500;

let betreiber: string;

function handelnder() {
	return { operatorId: betreiber, userId: null, label: 'Prüflauf' };
}

async function laufendeVersammlung(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name: `${name} ${Date.now()}`,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Erfundene Eigentümerin',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	const merkmal = await holeOderErzeugeSaalmerkmal(betreiber, v.id);
	return { versammlung: v.id, merkmal };
}

async function zeilen(versammlung: string): Promise<number> {
	const [{ n }] = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
		SELECT count(*)::int AS n FROM room_entry_request WHERE meeting_id = ${versammlung}
	`);
	return n;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Saaldeckel');
});

afterAll(verbindungenSchliessen);

describe('saaleinstieg_melden: Deckel je Versammlung', () => {
	it('nimmt bis zum Deckel an und weist danach mit eigenem Satz ab', async () => {
		const { versammlung, merkmal } = await laufendeVersammlung('Saaldeckel 1', '2027-05-01');

		// Bis eine unter den Deckel, in einer Anweisung über die Funktion selbst,
		// wie ein Fremder an der Anwendung vorbei.
		await ohneKontext((tx) => tx`
			SELECT saaleinstieg_melden(${merkmal}, 'Flut ' || g, NULL)
			  FROM generate_series(1, ${DECKEL - 1}) AS g
		`);
		expect(await zeilen(versammlung)).toBe(DECKEL - 1);

		// Die letzte, die noch Platz hat, geht über den gewöhnlichen Weg durch.
		expect((await meldeUeberSaal(merkmal, 'Letzte Person')).gemeldet).toBe(true);
		expect(await zeilen(versammlung)).toBe(DECKEL);

		await expect(meldeUeberSaal(merkmal, 'Eine zu viel')).rejects.toMatchObject({
			kennung: 'saal_voll'
		});
		expect(await zeilen(versammlung)).toBe(DECKEL);
	});

	it('zählt je Versammlung: eine andere nimmt weiter an', async () => {
		const { versammlung, merkmal } = await laufendeVersammlung('Saaldeckel 2', '2027-05-02');
		expect((await meldeUeberSaal(merkmal, 'Erste Person')).gemeldet).toBe(true);
		expect(await zeilen(versammlung)).toBe(1);
	});

	it('weist eine zu lange Bemerkung ab, in der Anwendung wie an ihr vorbei', async () => {
		const { versammlung, merkmal } = await laufendeVersammlung('Saaldeckel 3', '2027-05-03');
		const lang = 'x'.repeat(201);

		await expect(meldeUeberSaal(merkmal, 'Person', lang)).rejects.toMatchObject({
			kennung: 'bemerkung_zu_lang'
		});
		await expect(
			ohneKontext((tx) => tx`SELECT saaleinstieg_melden(${merkmal}, 'Person', ${lang})`)
		).rejects.toMatchObject({ code: '23514' });
		await expect(
			ohneKontext((tx) => tx`SELECT saaleinstieg_melden(${merkmal}, ${lang}, NULL)`)
		).rejects.toMatchObject({ code: '23514' });
		expect(await zeilen(versammlung)).toBe(0);

		// 200 Zeichen gehen durch, gezählt wie `zeichenzahl()`.
		expect((await meldeUeberSaal(merkmal, 'Person', '😀'.repeat(200))).gemeldet).toBe(true);
	});
});
