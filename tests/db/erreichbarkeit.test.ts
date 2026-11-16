/**
 * Der Erreichbarkeitssatz (Ä-11) am gemeinsamen Abend.
 *
 * **Der Satz gehört nur in die Leitung und nur bei Beschlussfähigkeit**
 * (Pendenzen 18.10.2026, Featureprüfung Block 3). In der Leitung des Hauses
 * steht die Bedingung nur im Svelte (`data.beschlussfaehigkeit?.beschlussfaehig`);
 * am gemeinsamen Abend rechnet der Loader sie in `erreichbarkeitZeigen`.
 * Diese Probe misst den Abend: derselbe unerreichbare Satz, einmal ohne und
 * einmal mit Beschlussfähigkeit.
 *
 * **Die Lage:** drei Eigentümer, Einstimmigkeit nach Köpfen aller. Zwei
 * Anwesende sind beschlussfähig, aber für die Einstimmigkeit fehlt der
 * dritte; der Satz muss also in beiden Lagen vorhanden sein und darf nur in
 * der zweiten gezeigt werden.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { load as abendLoad } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import type { PageData as Abenddaten } from '../../src/routes/tage/[id=kennung]/leitung/$types';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Einstimmigkeit nach Köpfen aller Eigentümer: mit zwei von drei unerreichbar. */
const EINSTIMMIGKEIT: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-zweckaenderung',
	typ: 'einstimmigkeit',
	titel: 'Einstimmigkeit',
	rechtsgrundlage: 'ZGB Art. 648 Abs. 2',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

function anfrage(id: string) {
	return {
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-erreichbarkeit',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id },
		url: new URL('http://pruefung.example/erreichbarkeit')
	} as never;
}

const abendleitung = async (tag: string) =>
	(await abendLoad(anfrage(tag))) as unknown as Abenddaten;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Erreichbarkeit');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});

afterAll(verbindungenSchliessen);

async function abend(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: i === 0 ? 400 : 300 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}

	const tag = await erstelleVersammlungstag(handelnder(betreiber), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
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
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Zweckänderung',
		art: 'abstimmung',
		antragswortlaut: 'Der Zweck der Gemeinschaft wird geändert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINSTIMMIGKEIT);
	await nimmInTagAuf(handelnder(betreiber), tag.id, v.id, 0);
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);
	return { tag: tag.id, versammlung: v.id, parteien };
}

describe('erreichbarkeitZeigen am gemeinsamen Abend', () => {
	it('zeigt den Satz nicht, solange das Haus nicht beschlussfähig ist', async () => {
		const s = await abend('Erreichbarkeit ohne Quorum', '2027-12-01');
		const d = await abendleitung(s.tag);
		const haus = d.stand.find((x) => x.meetingId === s.versammlung);
		expect(haus?.beschlussfaehig?.erfuellt).toBe(false);
		// Der Satz ist gerechnet, aber nicht zur Anzeige freigegeben.
		expect(d.vorschau?.erreichbarkeitshinweis).toBeTruthy();
		expect(d.erreichbarkeitZeigen).toBe(false);
	});

	it('zeigt ihn, sobald das Haus beschlussfähig ist und die Mehrheit unerreichbar bleibt', async () => {
		const s = await abend('Erreichbarkeit mit Quorum', '2027-12-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.parteien[0], 'von_hand');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.parteien[1], 'von_hand');
		const d = await abendleitung(s.tag);
		const haus = d.stand.find((x) => x.meetingId === s.versammlung);
		expect(haus?.beschlussfaehig?.erfuellt).toBe(true);
		expect(d.vorschau?.erreichbarkeitshinweis).toBeTruthy();
		expect(d.erreichbarkeitZeigen).toBe(true);
	});
});
