/**
 * Rügen an der Datenbank (Ä-06, Migration 160).
 *
 * Die Regeln des Kerns prüft `tests/domain/ruege`. Hier steht, was sich nur an
 * der Datenbank zeigt: dass die Herkunft eine Klammer ist, dass die
 * Mandantengrenze hält, dass die Rüge im Verlauf und im Abschlusspaket steht,
 * und **dass das Siegel sie sperrt**, anders als die Pendenz. Gesperrt wird
 * auch der rohe Weg an der Anwendung vorbei: Der Auslöser ist der Schutz, die
 * Prüfung im Serverteil nur seine Übersetzung.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { entferneRuege, erfasseRuege, holeRuegen } from '$lib/server/ruege';
import { holePaket, versiegle } from '$lib/server/siegel';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const EINGABE = {
	wortlaut: 'Die Einladung kam erst sechs Tage vor der Versammlung an.',
	wer: 'Vertreterin von Whg 1',
	uhrzeit: '19:12',
	entscheid: 'Die Abstimmung findet statt; die Rüge ist festgehalten.'
};

/** Eine Versammlung mit einem Traktandum, auf Wunsch eröffnet. */
async function aufbau(name: string, datum: string, eroeffnen = true) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'keiner'
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
		displayName: 'Erika Beispiel',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Ersatz der Heizung',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	if (eroeffnen) await eroeffneVersammlung(handelnder(betreiber), v.id);
	return { versammlung: v.id, traktandum: t.id };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Rüge A');
	betreiberB = await pruefbetreiber('Rüge B');
	benutzer = await pruefbenutzer(betreiber, 'ruegeleitung');
});

afterAll(verbindungenSchliessen);

describe('Erfassen', () => {
	it('hält Wortlaut, Uhrzeit, wer rügt und den Entscheid fest, auch im Verlauf', async () => {
		const a = await aufbau('Prüflauf Rüge 1', '2027-11-01');
		const r = await erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, {
			...EINGABE,
			uhrzeit: '9:05'
		});
		expect(r.uhrzeit).toBe('09:05');
		expect(r.wer).toBe(EINGABE.wer);
		expect(r.entscheid).toBe(EINGABE.entscheid);

		const nach = await holeRuegen(betreiber, a.versammlung);
		expect(nach.get(a.traktandum)?.map((x) => x.id)).toEqual([r.id]);

		// Am Traktandum, nicht an der Rüge: sonst fiele der Eintrag nach dem
		// Entfernen aus dem gefilterten Verlauf.
		const { zeilen: verlauf } = await leseVerlauf(betreiber, { versammlung: a.versammlung });
		const eintrag = verlauf.find((z) => z.art === 'objection.recorded');
		expect(eintrag?.gegenstandArt).toBe('agenda_item');
		expect(eintrag?.angaben).toMatchObject({
			ruege: r.id,
			wortlaut: EINGABE.wortlaut,
			ruegt: EINGABE.wer,
			uhrzeit: '09:05',
			vorgehen: EINGABE.entscheid
		});
	});

	it('weist ein Traktandum aus einer anderen Versammlung ab', async () => {
		const a = await aufbau('Prüflauf Rüge 2', '2027-11-02');
		const b = await aufbau('Prüflauf Rüge 3', '2027-11-03');
		await expect(
			erfasseRuege(handelnder(betreiber), a.versammlung, b.traktandum, EINGABE)
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});

	it('bleibt hinter der Mandantengrenze', async () => {
		const a = await aufbau('Prüflauf Rüge 4', '2027-11-04');
		await erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, EINGABE);
		expect((await holeRuegen(betreiberB, a.versammlung)).size).toBe(0);
	});

	it('nimmt vor der Eröffnung keine Rüge an', async () => {
		const a = await aufbau('Prüflauf Rüge 5', '2027-11-05', false);
		await expect(
			erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, EINGABE)
		).rejects.toMatchObject({ kennung: 'nicht_laufend' });
	});

	it('entfernt eine Rüge und lässt den Wortlaut im Verlauf stehen', async () => {
		const a = await aufbau('Prüflauf Rüge 6', '2027-11-06');
		const r = await erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, EINGABE);
		await entferneRuege(handelnder(betreiber), a.versammlung, r.id);
		expect((await holeRuegen(betreiber, a.versammlung)).size).toBe(0);

		const { zeilen: verlauf } = await leseVerlauf(betreiber, { versammlung: a.versammlung });
		const weg = verlauf.find((z) => z.art === 'objection.removed');
		expect(weg?.angaben).toMatchObject({ ruege: r.id, wortlaut: EINGABE.wortlaut });
	});
});

describe('Siegel', () => {
	it('legt die Rügen ins Abschlusspaket und sperrt sie danach, auch am Serverteil vorbei', async () => {
		const a = await aufbau('Prüflauf Rüge 7', '2027-11-07');
		const r = await erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, EINGABE);
		const zweite = await erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, {
			...EINGABE,
			wer: 'Eigentümerin von Whg 1',
			entscheid: ''
		});
		expect(zweite.entscheid).toBeNull();
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		/*
		 * **Nach dem Schluss nicht mehr** (Codeprüfung H8, M1): Die Leitungsseite
		 * zeigt dann kein Traktandum mehr; was zu ergänzen ist, gehört ins
		 * Protokoll.
		 */
		await expect(
			erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, EINGABE)
		).rejects.toMatchObject({ kennung: 'geschlossen' });
		await expect(
			entferneRuege(handelnder(betreiber), a.versammlung, r.id)
		).rejects.toMatchObject({ kennung: 'geschlossen' });

		// Der Protokollentwurf trägt beide, gleich unter der Überschrift
		// (Fachprüfung H8, R4-a).
		const entwurf = await stelleEntwurfZusammen(
			betreiber,
			a.versammlung,
			new Date().toISOString(),
			'Prüflauf'
		);
		expect(entwurf).toContain(
			'Rügen im Saal:\n- 19:12 Uhr, Vertreterin von Whg 1: Die Einladung kam erst sechs Tage ' +
				'vor der Versammlung an. Vorgehen des Vorsitzes: Die Abstimmung findet statt; die ' +
				'Rüge ist festgehalten.\n- 19:12 Uhr, Eigentümerin von Whg 1: Die Einladung kam erst ' +
				'sechs Tage vor der Versammlung an.'
		);
		expect(entwurf.indexOf('Rügen im Saal:')).toBeGreaterThan(entwurf.indexOf('Ersatz der Heizung'));

		await versiegle(handelnder(betreiber), a.versammlung, '2027-11-07 21:30:00');

		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, a.versammlung)) as Uint8Array);
		const ruegen = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/ruegen.json') as Uint8Array)
		) as { id: string; wortlaut: string; uhrzeit: string; traktandum: string | null }[];
		expect(ruegen.map((x) => x.id)).toEqual([r.id, zweite.id]);
		expect(ruegen[0]).toMatchObject({
			wortlaut: EINGABE.wortlaut,
			uhrzeit: '19:12',
			traktandum: 'Ersatz der Heizung'
		});

		await expect(
			erfasseRuege(handelnder(betreiber), a.versammlung, a.traktandum, EINGABE)
		).rejects.toMatchObject({ kennung: 'versiegelt' });
		await expect(
			entferneRuege(handelnder(betreiber), a.versammlung, r.id)
		).rejects.toMatchObject({ kennung: 'versiegelt' });

		// Der Auslöser hält auch ohne die Prüfung im Serverteil.
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM objection WHERE id = ${r.id}`)
		).rejects.toThrow(/versiegelt/);
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO objection (operator_id, meeting_id, agenda_item_id, wording, raised_by, raised_time)
					VALUES (${betreiber}, ${a.versammlung}, ${a.traktandum}, 'Nachgeschoben', 'Jemand', '22:00')
				`
			)
		).rejects.toThrow(/versiegelt/);
	});

	it('legt eine leere Liste bei, wenn niemand gerügt hat', async () => {
		const a = await aufbau('Prüflauf Rüge 8', '2027-11-08');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		await versiegle(handelnder(betreiber), a.versammlung, '2027-11-08 21:30:00');
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, a.versammlung)) as Uint8Array);
		expect(
			JSON.parse(new TextDecoder().decode(dateien.get('daten/ruegen.json') as Uint8Array))
		).toEqual([]);
	});
});
