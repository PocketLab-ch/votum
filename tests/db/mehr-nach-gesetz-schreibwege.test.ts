/**
 * Das Mass aus Gesetz und Reglement an den vier Schreibwegen (Pendenzen
 * Block 6, Befund 6): Vorlage, Kenntnisnahme, gemeinsames Geschäft und
 * Nachziehen. Am Code gelesen, in keinem Test nachgemessen.
 *
 * **Was die vier Wege tun:** Die Vorlage (Übernahme aus einer früheren
 * Versammlung) kopiert `requirement_statutory` mit; die Kenntnisnahme räumt es
 * weg; das gemeinsame Geschäft und das Nachziehen schreiben das neu hergeleitete
 * Erfordernis, das keine Abweichung mehr trägt, und räumen ein altes Mass
 * deshalb ab. Die letzten zwei brauchen einen Bestand mit gesetztem Mass, den
 * es über den gewöhnlichen Weg nicht mehr gibt; er wird mit der privilegierten
 * Verbindung gesetzt, geprüft wird der Schreibweg.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft, setzeErfordernisAmGeschaeft } from '$lib/server/geschaeft';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest
} from '$lib/server/traktanden';
import { uebernimmTraktanden } from '$lib/server/vorlagen';
import { speichereLesarten } from '$lib/server/lesarten';
import { erfordernisseNachziehen, veralteteErfordernisse } from '$lib/server/reglement';
import { gesetzesmassVon, uebersteuere, waehleErfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const RW = holeRegelwerk();
const QUALIFIZIERT = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis;
const MILDER = uebersteuere(RW, QUALIFIZIERT, 'einfaches_mehr', 'Prüfung: bewusst milder').ergebnis;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Mehr nach Gesetz Schreibwege');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(verbindungenSchliessen);

async function spalte(traktandumId: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ g: unknown }[]>`SELECT requirement_statutory AS g FROM agenda_item WHERE id = ${traktandumId}`
	);
	return z.g;
}

async function haus(name: string, datum = '2027-12-22') {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (let i = 0; i < 4; i++) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Erfunden ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Erfundene Verwaltungshandlung',
		art: 'abstimmung',
		antragswortlaut: 'Die Versammlung beschliesst die Handlung.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

/** Setzt das Mass am Traktandum unter Umgehung des Schreibwegs. */
async function setzeMassDirekt(traktandumId: string) {
	await admin.begin(async (tx) => {
		await tx`UPDATE agenda_item SET requirement_statutory = ${tx.json(gesetzesmassVon(QUALIFIZIERT) as never)} WHERE id = ${traktandumId}`;
	});
}

describe('Vorlage: die Übernahme kopiert das Mass', () => {
	it('trägt requirement_statutory in die Zielversammlung', async () => {
		const h = await haus('Schreibweg Vorlage');
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, h.traktandum, MILDER);
		expect(await spalte(h.traktandum)).toEqual(gesetzesmassVon(QUALIFIZIERT));

		const ziel = await erstelleVersammlung(handelnder(), {
			stwegId: h.gemeinschaft,
			datum: '2028-01-10',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await uebernimmTraktanden(handelnder(), ziel.id, [h.traktandum]);
		const [kopie] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT id FROM agenda_item WHERE meeting_id = ${ziel.id} AND title = 'Erfundene Verwaltungshandlung'
			`
		);
		expect(kopie).toBeDefined();
		expect(await spalte(kopie.id)).toEqual(gesetzesmassVon(QUALIFIZIERT));
	});
});

describe('Kenntnisnahme: der Wechsel räumt das Mass weg', () => {
	it('setzt requirement_statutory auf null', async () => {
		const h = await haus('Schreibweg Kenntnisnahme');
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, h.traktandum, MILDER);
		expect(await spalte(h.traktandum)).not.toBeNull();

		await bearbeiteTraktandum(handelnder(), h.versammlung, h.traktandum, {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Jahresbericht',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		expect(await spalte(h.traktandum)).toBeNull();
	});
});

describe('Gemeinsames Geschäft: der neue Fall räumt ein altes Mass weg', () => {
	it('setzt requirement_statutory auf null', async () => {
		const h = await haus('Schreibweg gemeinsames Geschäft');
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Schreibweg Abend',
			datum: '2027-12-23',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich'
		});
		await nimmInTagAuf(handelnder(), tag.id, h.versammlung, 0);
		const g = await erstelleGeschaeft(handelnder(), tag.id, {
			titel: 'Erfundene Verwaltungshandlung',
			antragswortlaut: 'Die Versammlung beschliesst die Handlung.',
			art: 'abstimmung',
			meetingIds: [h.versammlung]
		});
		const [zeile] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM agenda_item WHERE business_id = ${g.id}`
		);
		await setzeMassDirekt(zeile.id);
		expect(await spalte(zeile.id)).not.toBeNull();

		await setzeErfordernisAmGeschaeft(handelnder(), tag.id, g.id, 'k-verwaltung-wichtig');
		expect(await spalte(zeile.id)).toBeNull();
	});
});

describe('Nachziehen: die Neuherleitung räumt ein altes Mass weg', () => {
	it('setzt requirement_statutory auf null', async () => {
		const h = await haus('Schreibweg Nachziehen', '2027-12-24');
		const e = waehleErfordernis(RW, 'k-bewirtschaftung-waehlen-erweitert').ergebnis;
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, h.traktandum, e);
		await setzeMassDirekt(h.traktandum);
		// Die Umstellung macht das Erfordernis veraltet; die Neuherleitung kennt
		// keine Abweichung mehr. Seit Block B (Entscheid 0048) ist «qualifiziert»
		// die Vorgabe; umgestellt wird deshalb auf «einfach».
		await speichereLesarten(handelnder(), 'admin', h.gemeinschaft, { L4: 'einfach' });
		expect((await veralteteErfordernisse(betreiber, h.gemeinschaft)).map((v) => v.traktandumId)).toContain(
			h.traktandum
		);

		const { nachgezogen } = await erfordernisseNachziehen(handelnder(), h.gemeinschaft);
		expect(nachgezogen).toBeGreaterThanOrEqual(1);
		expect(await spalte(h.traktandum)).toBeNull();
	});
});
