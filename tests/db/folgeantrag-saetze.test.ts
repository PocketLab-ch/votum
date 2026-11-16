/**
 * Was Protokoll, Auswertung, Leitung, Wand und das gemeinsame Protokoll nach
 * einem Rückkommen über einen Folgeantrag sagen (Plan
 * `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Block B2b, Soll 6).
 *
 * **Produktentscheid 30.09.2026:** Nach einem angenommenen Rückkommen darf
 * statt des alten Antrags ein Folgeantrag zur Abstimmung kommen. Angenommen
 * ersetzt er den alten Beschluss, abgelehnt entfällt der alte, ohne Beschluss
 * bleibt der alte.
 *
 * Bis zu diesem Block stand beim Grundantrag nach einer Ersetzung «Über diesen
 * Antrag wurde nicht abgestimmt: Die Versammlung hat den Gegenantrag …
 * angenommen. Der ursprüngliche Antrag ist damit gegenstandslos.», beim
 * Rückkommensantrag «Erneut abgestimmt wurde nicht», und auf Auswertung und
 * PDF «Es wurde nicht abgestimmt.». Die Proben halten die falschen Sätze als
 * Gegenprobe mit fest.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmTraktandumAuf,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import { holeAuswertung } from '$lib/server/auswertung';
import { erzeugeProtokollentwurf } from '$lib/server/protokoll';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { load as leitungLoad } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import type { PageData as LeitungData } from '../../src/routes/versammlungen/[id=kennung]/leitung/$types';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

type Wahl = 'yes' | 'no';

/**
 * Eine laufende Versammlung auf einem Abend mit vier Parteien und dem Geschäft
 * «Fassadensanierung». Stichentscheid nach Wertquoten, damit 2 zu 2 aus einer
 * Handzählung ohne Beschluss endet (wie `folgeantrag-nach-rueckkommen.test.ts`).
 */
async function versammlung(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'wertquote',
		tieBreakRuleSource: 'Art. 30 Reglement'
	});
	for (const [i, wer] of ['Muster A', 'Muster B', 'Muster C', 'Muster D'].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 225 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	}
	const tag = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(handelnder(), tag.id, v.id, 0);
	await erstelleGeschaeft(handelnder(), tag.id, {
		titel: 'Fassadensanierung',
		antragswortlaut: 'Die Fassade wird saniert.',
		art: 'abstimmung',
		meetingIds: [v.id]
	});
	const grund = (await holeTraktanden(betreiber, v.id)).find(
		(x) => x.knoten.titel === 'Fassadensanierung'
	)!.knoten.id;
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, grund, ERFORDERNIS);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	const parteien = await imKontext(betreiber, (tx) =>
		tx<{ id: string; party_id: string }[]>`SELECT id, party_id FROM snapshot_party WHERE meeting_id = ${v.id}`
	);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p.id);
	const alle = (wahl: Wahl) => parteien.map((p) => ({ parteiId: p.party_id, wahl }));
	return { tag: tag.id, versammlung: v.id, grund, alle, datum };
}

type Lage = Awaited<ReturnType<typeof versammlung>>;

async function abstimmen(s: Lage, traktandum: string, wahl: Wahl) {
	await stelleAufTraktandum(handelnder(), s.versammlung, traktandum);
	await oeffneAbstimmung(handelnder(), s.versammlung, traktandum);
	await gibStimmenAb(handelnder(), s.versammlung, s.alle(wahl), true, 'Prüflauf: von der Sitzungsleitung erfasst');
	return schliesseAbstimmung(handelnder(), s.versammlung);
}

/** Grundantrag angenommen, Rückkommen angenommen, Folgeantrag aufgenommen. */
async function bisZumFolgeantrag(name: string, datum: string) {
	const s = await versammlung(name, datum);
	await abstimmen(s, s.grund, 'yes');
	const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.grund);
	await abstimmen(s, r.id, 'yes');
	const f = await nimmTraktandumAuf(
		handelnder(),
		{
			meetingId: s.versammlung,
			parentId: s.grund,
			titel: 'Nur die Wetterseite',
			art: 'abstimmung',
			antragswortlaut: 'Saniert wird vorerst nur die Wetterseite.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	await haltErfordernisAmTraktandumFest(handelnder(), s.versammlung, f.id, ERFORDERNIS);
	return { ...s, rueckkommen: r.id, folgeantrag: f.id };
}

/** Was die Leitungsseite des Hauses ausliefert. */
async function leitung(s: Lage) {
	return (await leitungLoad({
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-folgeantrag-saetze',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id: s.versammlung },
		url: new URL('http://pruefung.example/leitung')
	} as never)) as unknown as LeitungData;
}

/** Der Protokolltext, Leerraum zusammengezogen, und der Abschnitt je Traktandum. */
async function protokoll(s: Lage) {
	const text = (
		await erzeugeProtokollentwurf(handelnder(), s.versammlung, `${s.datum} 21:00:00`)
	).body;
	const abschnitt = (titel: string) => {
		const kopf = new RegExp(`^#+ [\\d.]+ ${titel}$`, 'm');
		const von = text.search(kopf);
		if (von < 0) throw new Error(`Kein Abschnitt «${titel}»`);
		const zeilenende = text.indexOf('\n', von);
		const rest = text.slice(zeilenende + 1);
		const bis = rest.search(/^#+ /m);
		return (bis < 0 ? rest : rest.slice(0, bis)).replace(/\s+/g, ' ');
	};
	return { text: text.replace(/\s+/g, ' '), abschnitt };
}

async function zeile(s: Lage, id: string) {
	const a = await holeAuswertung(betreiber, s.versammlung);
	const t = (await holeTraktanden(betreiber, s.versammlung)).find((x) => x.knoten.id === id)!;
	return { z: a!.zeilen.find((x) => x.nummer === t.nummer)!, auswertung: a! };
}

const RUECKKOMMENSTITEL = /^Rückkommen auf/;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Folgeantrag: Sätze');
	benutzer = await pruefbenutzer(betreiber, 'folgeantrag-saetze');
});

afterAll(verbindungenSchliessen);

describe('Angenommen: Der Folgeantrag ersetzt den alten Beschluss', () => {
	it('sagt es beim Grundantrag, beim Rückkommensantrag und beim Folgeantrag', async () => {
		const s = await bisZumFolgeantrag('Satzweg 1', '2027-11-01');
		await abstimmen(s, s.folgeantrag, 'yes');
		const p = await protokoll(s);

		const g = p.abschnitt('Fassadensanierung');
		expect(g).toMatch(
			/Nach dem Rückkommen \(Traktandum [\d.]+\) kam statt dieses Antrags der Folgeantrag [\d.]+ «Nur die Wetterseite» zur Abstimmung\. Er wurde angenommen; sein Beschluss ersetzt den bisherigen aus dem 1\. Durchgang \(«angenommen»\)\. Die Zahlen des 1\. Durchgangs gibt auf Anfrage bekannt, wer das Protokoll aufbewahrt\./
		);
		// Gegenprobe: die zwei falschen Sätze von vorher.
		expect(g).not.toMatch(/nicht abgestimmt|gegenstandslos/);

		const f = p.abschnitt('Nur die Wetterseite');
		expect(f).toMatch(
			/- Nach dem Rückkommen \(Traktandum [\d.]+\) wurde statt über den Antrag zu Traktandum \d+ «Fassadensanierung» abgestimmt\. Dieser Beschluss ersetzt den bisherigen zu Traktandum \d+ aus dem 1\. Durchgang \(«angenommen»\)\./
		);

		const titelR = (await holeTraktanden(betreiber, s.versammlung)).find((x) =>
			RUECKKOMMENSTITEL.test(x.knoten.titel)
		)!.knoten.titel;
		const r = p.abschnitt(titelR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		expect(r).toMatch(
			/- Erneut abgestimmt wurde über den Folgeantrag [\d.]+ «Nur die Wetterseite» statt über den bisherigen Antrag; siehe Traktandum [\d.]+\./
		);
		expect(r).not.toMatch(/Erneut abgestimmt wurde nicht/);

		// Auswertung und PDF lesen dieselbe Zeile; gezählt wird die Sache beim Folgeantrag.
		const { z, auswertung } = await zeile(s, s.grund);
		expect(z.ersetzung?.rolle).toBe('grundantrag');
		expect(z.ersetzung?.ausgang).toBe('angenommen');
		// Der ersetzte Grundantrag zählt nicht als «ohne Abstimmung».
		expect(auswertung.ohneAbstimmung).toBe(
			auswertung.zeilen.filter(
				(x) =>
					x.art === 'kenntnisnahme' || (!x.auszaehlung && x.ersetzung?.rolle !== 'grundantrag')
			).length
		);
	});

	it('nennt die Ersetzung auf der Wand, an der Leitung und im gemeinsamen Protokoll', async () => {
		const s = await bisZumFolgeantrag('Satzweg 2', '2027-11-02');
		await abstimmen(s, s.folgeantrag, 'yes');

		const wand = JSON.stringify(await ermittleStand(betreiber, s.versammlung));
		expect(wand).toMatch(/wurde statt über den Antrag zu Traktandum \d+ «Fassadensanierung» abgestimmt/);

		const abend = await stelleAbendzusammenstellungZusammen(
			betreiber,
			s.tag,
			`${s.datum}T21:00:00.000Z`,
			'Prüferin'
		);
		const abendtext = JSON.stringify(abend);
		// Statt «noch kein Ergebnis» beim Geschäft; bei den unbehandelten Punkten
		// aus der Vorlage steht er weiter, dort stimmt er.
		expect(abendtext).toMatch(/kam statt dieses Antrags der Folgeantrag/);
		expect(abendtext).not.toMatch(/Fassadensanierung[^#]*Zu diesem Punkt liegt noch kein Ergebnis vor/);
	});
});

describe('Abgelehnt: Der alte Beschluss ist aufgehoben', () => {
	it('sagt beim Grundantrag, dass nur der Folgeantrag abgelehnt ist', async () => {
		const s = await bisZumFolgeantrag('Satzweg 3', '2027-11-03');
		await abstimmen(s, s.folgeantrag, 'no');
		const p = await protokoll(s);
		const g = p.abschnitt('Fassadensanierung');
		expect(g).toMatch(
			/Er wurde abgelehnt; damit ist der bisherige Beschluss aus dem 1\. Durchgang \(«angenommen»\) aufgehoben\. Abgelehnt ist nur der Folgeantrag; angenommen ist zu dieser Sache nichts mehr\./
		);
		expect(g).not.toMatch(/nicht abgestimmt|gegenstandslos/);
		const f = p.abschnitt('Nur die Wetterseite');
		expect(f).toMatch(/Mit der Ablehnung ist der bisherige Beschluss zu Traktandum \d+ aus dem 1\. Durchgang/);
	});
});

describe('Ohne Beschluss: Der alte bleibt', () => {
	it('sagt es beim Grundantrag und beim Folgeantrag, statt «nicht abgestimmt»', async () => {
		const s = await bisZumFolgeantrag('Satzweg 4', '2027-11-04');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.folgeantrag);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.folgeantrag);
		await erfasseSummen(handelnder(), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(), s.versammlung);

		const p = await protokoll(s);
		const g = p.abschnitt('Fassadensanierung');
		expect(g).toMatch(
			/- Nach dem Rückkommen \(Traktandum [\d.]+\) kam statt dieses Antrags der Folgeantrag [\d.]+ «Nur die Wetterseite» zur Abstimmung\. Es stand unentschieden, und der Stichentscheid ist dabei nicht festgestellt\. Es bleibt beim Beschluss aus dem 1\. Durchgang, bis eine Neuabstimmung entscheidet\./
		);
		// Gegenprobe: Vorher hiess es hier, erneut abgestimmt sei nicht worden.
		expect(g).not.toMatch(/erneut abgestimmt wurde nicht/);

		const f = p.abschnitt('Nur die Wetterseite');
		expect(f).toMatch(/wurde statt über den Antrag zu Traktandum \d+ «Fassadensanierung» abgestimmt/);
		expect(f).toMatch(/Die Zahlen dieses Durchgangs gibt auf Anfrage bekannt/);
		expect(f).not.toMatch(/Über diesen Antrag wurde nicht abgestimmt/);

		// Die Wand am aufgerufenen Folgeantrag zeigt, was gilt, statt nichts.
		const wand = await ermittleStand(betreiber, s.versammlung);
		expect(JSON.stringify(wand)).toMatch(/Es bleibt beim Beschluss zu Traktandum \d+ aus dem 1\. Durchgang/);

		const { auswertung } = await zeile(s, s.folgeantrag);
		expect(auswertung.keinBeschluss).toBeGreaterThanOrEqual(1);

		/*
		 * Die Neuabstimmung am Grundantrag zielt auf den Durchgang über den
		 * Folgeantrag, nicht auf den geltenden Beschluss (Codeprüfung B2b, H1).
		 * Vorher traf der Knopf den 1. Durchgang, und ein Klick hob ihn auf.
		 */
		const d = await leitung(s);
		const amGrund = d.ergebnisse.find((e) => e.traktandumId === s.grund);
		const [folge] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM voting_round WHERE agenda_item_id = ${s.folgeantrag}`
		);
		expect(amGrund?.offenNachRueckkommen).toBe(folge.id);
		expect(amGrund?.durchgangId).not.toBe(folge.id);
	});
});

describe('Neuabstimmung auf den Folgeantrag', () => {
	it('nennt die Anordnung, nicht ihre Wirkung', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const s = await bisZumFolgeantrag('Satzweg 5', '2027-11-05');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.folgeantrag);
		const d = await oeffneAbstimmung(handelnder(), s.versammlung, s.folgeantrag);
		await erfasseSummen(handelnder(), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(), s.versammlung);
		await setzeNeuabstimmungAn(handelnder(), s.versammlung, d.id, 'Falsch gezählt, bitte einzeln');
		const p = await protokoll(s);
		expect(p.abschnitt('Fassadensanierung')).toMatch(
			/kam statt dieses Antrags der Folgeantrag [\d.]+ «Nur die Wetterseite» zur Abstimmung; die Sitzungsleitung hat dort eine Neuabstimmung angesetzt, siehe Traktandum [\d.]+\./
		);
		expect(p.abschnitt('Fassadensanierung')).not.toMatch(/erneut abgestimmt wurde nicht/);
		expect(p.abschnitt('Nur die Wetterseite')).toMatch(
			/- Nach dem Rückkommen \(Traktandum [\d.]+\) wurde statt über den Antrag zu Traktandum \d+ «Fassadensanierung» abgestimmt\./
		);
	});
});
