/**
 * Beginn und Ende der Pause gespeichert (Produktentscheid 08.10.2026,
 * Migration 153).
 *
 * **Zwei Dinge werden hier geprüft.** Erstens das Paar: `meeting_pause` hält
 * je Pause Beginn und Ende zusammen, auch über mehrere Pausen hinweg.
 * Zweitens der Verlauf: Das Fortsetzen trägt den Beginn der Pause als Angabe,
 * damit das Paar auch im Abschlusspaket lesbar bleibt (der Zeitpunkt der
 * Zeile selbst ist das Ende).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	setzePause
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { versiegle } from '$lib/server/siegel';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

async function laufende(name: string, datum: string) {
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
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	return v.id;
}

async function pausen(meetingId: string) {
	return imKontext(betreiber, (tx) =>
		tx<{ beginn_at: Date; ende_at: Date | null; text: string | null }[]>`
			SELECT beginn_at, ende_at, text FROM meeting_pause
			 WHERE meeting_id = ${meetingId}
			 ORDER BY beginn_at
		`
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Pause');
	benutzer = await pruefbenutzer(betreiber, 'pauseleitung');
});

afterAll(verbindungenSchliessen);

describe('meeting_pause', () => {
	it('hält je Pause Beginn und Ende fest, über zwei Pausen hinweg', async () => {
		const v = await laufende('Pausehaus 1', '2026-12-02');
		await setzePause(handelnder(betreiber), v, { an: true, text: 'Weiter um 20:00' });
		await setzePause(handelnder(betreiber), v, { an: false });
		await setzePause(handelnder(betreiber), v, { an: true, text: 'Zweite Pause' });
		await setzePause(handelnder(betreiber), v, { an: false });

		const zeilen = await pausen(v);
		expect(zeilen).toHaveLength(2);
		expect(zeilen[0]!.beginn_at).toBeInstanceOf(Date);
		expect(zeilen[0]!.ende_at).toBeInstanceOf(Date);
		expect(zeilen[0]!.ende_at!.getTime()).toBeGreaterThanOrEqual(zeilen[0]!.beginn_at.getTime());
		expect(zeilen[0]!.text).toBe('Weiter um 20:00');
		expect(zeilen[1]!.text).toBe('Zweite Pause');
		// Die zweite Pause schliesst nicht die erste.
		expect(zeilen[1]!.beginn_at.getTime()).toBeGreaterThan(zeilen[0]!.beginn_at.getTime());
	});

	it('trägt beim Fortsetzen den Beginn der Pause in den Verlauf', async () => {
		const v = await laufende('Pausehaus 2', '2026-12-03');
		await setzePause(handelnder(betreiber), v, { an: true, text: null });
		await setzePause(handelnder(betreiber), v, { an: false });

		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: unknown }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_id = ${v} AND event_type = 'meeting.resumed'
			`
		);
		expect(eintraege).toHaveLength(1);
		const angaben = eintraege[0]!.detail as { beginn?: string };
		expect(typeof angaben.beginn).toBe('string');
	});

	it('schliesst eine noch offene Pause, wenn ohne Fortsetzen erneut unterbrochen wird', async () => {
		/*
		 * `setzePause` weist ein zweites Unterbrechen nicht ab; ohne das
		 * Schliessen bliebe die erste Zeile für immer offen, und kein
		 * Fortsetzen könnte sie je schliessen (Codeprüfung 09.10.2026).
		 */
		const v = await laufende('Pausehaus 3', '2026-12-04');
		await setzePause(handelnder(betreiber), v, { an: true, text: null });
		await setzePause(handelnder(betreiber), v, { an: true, text: 'Zweite Unterbrechung' });
		await setzePause(handelnder(betreiber), v, { an: false });
		const zeilen = await pausen(v);
		expect(zeilen).toHaveLength(2);
		// Beide Zeilen sind geschlossen: die erste vom zweiten Unterbrechen,
		// die zweite vom Fortsetzen.
		expect(zeilen[0]!.ende_at).toBeInstanceOf(Date);
		expect(zeilen[1]!.ende_at).toBeInstanceOf(Date);
		expect(zeilen[1]!.text).toBe('Zweite Unterbrechung');
	});

	it('steht unter dem Zeilenschutz: nach dem Versiegeln wird nicht mehr geschrieben', async () => {
		const v = await laufende('Pausehaus 4', '2026-12-05');
		await setzePause(handelnder(betreiber), v, { an: true, text: null });
		await setzePause(handelnder(betreiber), v, { an: false });
		await schliesseVersammlung(handelnder(betreiber), v);
		await versiegle(handelnder(betreiber), v, '2026-12-05 21:30:00');
		// Der Schreibschutz sitzt in der Datenbank (wie `meeting_chair_holder`,
		// Migration 128): Ein direkter Schreibweg unter der Anwendungsrolle
		// läuft gegen den Auslöser, nicht erst gegen eine Anwendungsabsage.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO meeting_pause (meeting_id, operator_id, beginn_at, text, created_by)
					VALUES (${v}, ${betreiber}, now(), null, 'Prüflauf')
				`
			)
		).rejects.toThrow(/versiegelt/);
	});
});
