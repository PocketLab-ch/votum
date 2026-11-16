/**
 * Die Handzählung gehört in den Verlauf ihrer Versammlung.
 *
 * `erfasseSummen` schreibt `vote.tally.recorded` mit dem Gegenstand
 * `voting_round` — der Kennung des Durchgangs, nicht der der Versammlung. Der
 * Filter «Verlauf dieser Versammlung» muss ihn über die Versammlung des
 * Durchgangs auflösen; ohne eigenen Zweig fällt er still heraus, und wer im
 * Verlauf nachsieht, wer wann eine Handzählung erfasst hat, findet nichts.
 *
 * Der Eintrag entsteht hier über denselben Schreibweg wie im Betrieb
 * (`schreibeVerlauf`, dieselbe Ereignisart), damit der Test die Filter und
 * nicht eine Nachbildung prüft.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { schreibeVerlauf } from '$lib/server/audit';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { admin, imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

const handelnder = { operatorId: '', userId: null, label: 'Prüflauf' };

const stweg = crypto.randomUUID();
const abend = crypto.randomUUID();
const sitzung = crypto.randomUUID();
const traktandum = crypto.randomUUID();
const runde = crypto.randomUUID();
const fremdeSitzung = crypto.randomUUID();

beforeAll(async () => {
	betreiber = await pruefbetreiber('Handzählung im Verlauf');
	handelnder.operatorId = betreiber;

	await admin`
		INSERT INTO stweg (id, operator_id, name)
		VALUES (${stweg}, ${betreiber}, 'Prüf-STWEG Handzählung')
	`;
	await admin`
		INSERT INTO meeting_day (id, operator_id, label, day_date, start_time, location, kind)
		VALUES (${abend}, ${betreiber}, 'Prüfabend Handzählung', '2026-09-21', '18:00', 'Prüfsaal', 'ordentlich')
	`;
	await admin`
		INSERT INTO meeting (id, operator_id, stweg_id, meeting_day_id, meeting_date, start_time,
		                     location, kind, operation_mode)
		VALUES (${sitzung}, ${betreiber}, ${stweg}, ${abend}, '2026-09-21', '18:00',
		        'Prüfsaal', 'ordentlich', 'gefuehrt')
	`;
	await admin`
		INSERT INTO meeting (id, operator_id, stweg_id, meeting_date, start_time,
		                     location, kind, operation_mode)
		VALUES (${fremdeSitzung}, ${betreiber}, ${stweg}, '2026-09-22', '18:00',
		        'Prüfsaal', 'ordentlich', 'gefuehrt')
	`;
	await admin`
		INSERT INTO agenda_item (id, operator_id, meeting_id, position, title,
		                         item_kind, proposer_kind, motion_text)
		VALUES (${traktandum}, ${betreiber}, ${sitzung}, 1, 'Prüftraktandum',
		        'abstimmung', 'bewirtschaftung', 'Die Versammlung beschliesst.')
	`;
	await admin`
		INSERT INTO voting_round (id, operator_id, meeting_id, agenda_item_id, ordinal)
		VALUES (${runde}, ${betreiber}, ${sitzung}, ${traktandum}, 1)
	`;

	await imKontext(betreiber, (tx) =>
		schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.handzaehlungErfasst,
				{ art: 'voting_round', id: runde },
				{ versammlung: sitzung, traktandum, ja: 3, nein: 1, enthaltung: 0, vermerk: null }
			)
		)
	);
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Die Handzählung im Verlauf', () => {
	it('erscheint mit dem Filter «diese Versammlung»', async () => {
		const { zeilen } = await leseVerlauf(betreiber, { versammlung: sitzung });
		expect(zeilen.map((z) => z.art)).toEqual(['vote.tally.recorded']);
	});

	it('erscheint mit dem Filter «diese Gemeinschaft»', async () => {
		const { zeilen } = await leseVerlauf(betreiber, { gemeinschaft: stweg });
		expect(zeilen.map((z) => z.art)).toEqual(['vote.tally.recorded']);
	});

	it('erscheint mit dem Filter «dieser Abend»', async () => {
		const { zeilen } = await leseVerlauf(betreiber, { abend });
		expect(zeilen.map((z) => z.art)).toEqual(['vote.tally.recorded']);
	});

	it('erscheint nicht bei einer fremden Versammlung derselben Gemeinschaft', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { versammlung: fremdeSitzung });
		expect(gesamt).toBe(0);
	});
});
