/**
 * Das Mehr aus Gesetz und Reglement in der Datenhaltung (Migration 173,
 * Lesarten Block 6, Anhang A): Es geht beim Übersteuern an das Traktandum,
 * übersteht Freigabe und Eröffnen im eingefrorenen Erfordernis des Durchgangs
 * und kommt in der Auszählung an. Ein neues Setzen ohne Abweichung räumt es
 * weg. Die Kernrechnung misst `tests/domain/mehr-nach-gesetz.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erfasseSummen,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { gesetzesmassVon, uebersteuere, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const RW = holeRegelwerk();
const QUALIFIZIERT = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis;
const MILDER = uebersteuere(RW, QUALIFIZIERT, 'einfaches_mehr', 'Prüfung: bewusst milder').ergebnis;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Mehr nach Gesetz');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function versammlung(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (let i = 0; i < 4; i++) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Eigentümer ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal Erfunden',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Erfundene Verwaltungshandlung',
		art: 'abstimmung',
		antragswortlaut: 'Die Versammlung beschliesst die Handlung.',
		antragstellerart: 'bewirtschaftung'
	});
	return { versammlung: v.id, traktandum: t.id, parteien };
}

async function spalte(traktandumId: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ g: unknown }[]>`SELECT requirement_statutory AS g FROM agenda_item WHERE id = ${traktandumId}`
	);
	return z.g;
}

describe('Das Mass am Traktandum', () => {
	it('kommt mit dem Übersteuern und geht mit einem Setzen ohne Abweichung', async () => {
		const a = await versammlung('Mehr nach Gesetz: Spalte', '2027-12-10');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, MILDER);
		expect(await spalte(a.traktandum)).toEqual(gesetzesmassVon(QUALIFIZIERT));

		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		expect(await spalte(a.traktandum)).toBeNull();
	});

	it('die Datenbank weist ein Mass ohne Bezugsgrössen ab', async () => {
		const a = await versammlung('Mehr nach Gesetz: Form', '2027-12-11');
		await expect(
			imKontext(
				betreiber,
				(tx) =>
					tx`UPDATE agenda_item SET requirement_statutory = ${tx.json({ typ: 'einfaches_mehr' } as never)} WHERE id = ${a.traktandum}`
			)
		).rejects.toThrow(/agenda_item_mehr_nach_gesetz_form/);
		// Ein Mass ohne zählbares Mehr ebenso (Codeprüfung Block 6, H1).
		for (const falsch of [
			{ ...gesetzesmassVon(QUALIFIZIERT), typ: 'grenzfall' },
			{ ...gesetzesmassVon(QUALIFIZIERT), typ: 'keine_abstimmung' },
			{ ...gesetzesmassVon(QUALIFIZIERT), kopfSchwelle: null }
		]) {
			await expect(
				imKontext(
					betreiber,
					(tx) =>
						tx`UPDATE agenda_item SET requirement_statutory = ${tx.json(falsch as never)} WHERE id = ${a.traktandum}`
				)
			).rejects.toThrow(/agenda_item_mehr_nach_gesetz_form/);
		}
	});
});

describe('Vom Traktandum bis zur Auszählung', () => {
	it('steht im eingefrorenen Erfordernis und gibt der Leitung ein zweites Ergebnis', async () => {
		const a = await versammlung('Mehr nach Gesetz: Weg', '2027-12-12');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, MILDER);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ e: Erfordernis }[]>`
				SELECT requirement_json AS e FROM voting_round WHERE agenda_item_id = ${a.traktandum}
			`
		);
		expect(z.e.gesetzlich).toEqual(gesetzesmassVon(QUALIFIZIERT));
		// Die Begründung friert mit ein: Daran erkennt die Auszählung die Abweichung (1a).
		expect(z.e.begruendung).toBe('Prüfung: bewusst milder');

		// Von Hand gezählt: Das gezählte einfache Mehr geht, das qualifizierte
		// nach Gesetz braucht die Wertquoten und ist nicht feststellbar.
		await erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 3, nein: 1, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const r = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(r.auszaehlung?.angenommen).toBe(true);
		expect(r.auszaehlung?.nachGesetzUndReglement).toMatchObject({
			kennung: 'A',
			feststellbar: false,
			nichtFeststellbarWeil: 'summen'
		});
		expect((r.auszaehlung?.protokollhinweise ?? []).some((h) => h.satz.includes('Gesetz und Reglement'))).toBe(
			false
		);
	});
});
