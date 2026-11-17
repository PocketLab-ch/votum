/**
 * Ä-17 an den Seiten und Protokollen, nicht nur im Kern.
 *
 * **Anlass** (Featureprüfung Ä-17): Die Verdrahtungen des Satzes zum einzigen
 * Eigentümer (Ä-17 A, `docs/entscheide/0011`) und des Hinweises zu neuen
 * Traktanden an der zweiten Versammlung (Ä-17 B, `docs/entscheide/0012`) wurden
 * in keinem vitest rot, wenn die Zeile fehlte. Das Drehbuch
 * `e2e/warnungen.mjs` sah die Seiten des Hauses, die des Abends sah niemand,
 * und das Drehbuch läuft nicht im Prüflauf.
 *
 * Gemessen wird deshalb an den Loadern der Seiten (Hausleitung, Abendleitung,
 * Traktandenseite) und an den Funktionen, die die Protokolle zusammenstellen,
 * je mit Gegenprobe: ein Haus mit zwei Eigentümern, ein übertragenes Geschäft,
 * ein erreichtes Quorum einer ersten Versammlung.
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
import { speichereLesarten } from '$lib/server/lesarten';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { vertageAmAbend } from '$lib/server/abendsteuerung';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { halteBeschlussfaehigkeitFest } from '$lib/server/beschlussfaehigkeit';
import {
	feststellungssatz,
	EINZIGE_GEMEINSCHAFT,
	EINZIGE_GEMEINSCHAFT_KURZ,
	EINZIGER_EIGENTUEMER,
	EINZIGER_EIGENTUEMER_KURZ
} from '$lib/domain/beschlussfaehigkeit';
import { NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL, neuAnZweiterHinweis } from '$lib/domain/mehrhinweise';
import type { Neutraktandenwahl } from '$lib/domain/lesarten';

/*
 * **Seit L5 (Migration 174) je Wahl.** Die Gemeinschaften hier stehen auf der
 * Vorgabe `erste`; Vorbereitung und Saal haben je ihren Satz. Der Satz aus
 * 0012 ist die Fassung der milden Wahl (`tests/domain/lesart-neue-traktanden.test.ts`).
 */
const SATZ_VORBEREITUNG = neuAnZweiterHinweis('erste', false);
const SATZ_IM_SAAL = neuAnZweiterHinweis('erste', true);
const SATZ_AM_ABEND = neuAnZweiterHinweis('erste', true, false);
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { load as hausLoad } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import type { PageData as Hausdaten } from '../../src/routes/versammlungen/[id=kennung]/leitung/$types';
import { load as abendLoad } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import type { PageData as Abenddaten } from '../../src/routes/tage/[id=kennung]/leitung/$types';
import { load as traktandenLoad } from '../../src/routes/versammlungen/[id=kennung]/traktanden/+page.server';
import type { PageData as Traktandendaten } from '../../src/routes/versammlungen/[id=kennung]/traktanden/$types';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

/** Was ein Loader als `locals` erwartet, für die Prüferin dieses Laufs. */
function anfrage(id: string) {
	return {
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-ae17-verdrahtung',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id },
		url: new URL('http://pruefung.example/ae17')
	} as never;
}

const hausleitung = async (versammlung: string) => (await hausLoad(anfrage(versammlung))) as unknown as Hausdaten;
const abendleitung = async (tag: string) => (await abendLoad(anfrage(tag))) as unknown as Abenddaten;
const traktandenseite = async (versammlung: string) =>
	(await traktandenLoad(anfrage(versammlung))) as unknown as Traktandendaten;

/** Leerzeichen und Umbrüche vereinheitlicht: Die Protokolle brechen lange Sätze um. */
const flach = (s: string) => s.replace(/\s+/g, ' ');

/** Wie oft `teil` in `ganz` vorkommt. */
const anzahl = (ganz: string, teil: string) => ganz.split(teil).length - 1;

/**
 * Eine Gemeinschaft mit je einer Einheit für jeden Namen in `eigentuemer`.
 * `gemeinsam`: Jede Partei ist eine gemeinschaftliche Zeile (Ehepaar,
 * Erbengemeinschaft), `docs/entscheide/0016`.
 */
async function gemeinschaft(name: string, eigentuemer: string[], gemeinsam = false) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of eigentuemer.entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 1000 / eigentuemer.length },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: gemeinsam,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	return { id: g.id, parteien };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Ä-17 Verdrahtung');
	benutzer = await pruefbenutzer(betreiber, 'ae17-verdrahtung');
});

afterAll(verbindungenSchliessen);

/*
 * **Ä-17 A: der einzige Eigentümer.** Je Test ein eigener Abend mit zwei
 * Häusern: «<name>, Einstellhalle» gehört einer Person, «<name>, Haus» zweien.
 * Beide eröffnet, noch niemand anwesend, festgehalten ist nichts; so hängt
 * kein Test an einem anderen oder an der Reihenfolge.
 */
async function abendEinzigerEigentuemer(name: string, datum: string, einzelnGemeinsam = false) {
	const t = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const haeuser = [
		[`${name}, Einstellhalle`, ['Erfunden 1']],
		[`${name}, Haus`, ['Erfunden 2', 'Erfunden 3']]
	] as const;
	const ergebnis: { versammlung: string; parteien: string[] }[] = [];
	for (const [i, [haus, eigentuemer]] of haeuser.entries()) {
		const g = await gemeinschaft(haus, [...eigentuemer], i === 0 && einzelnGemeinsam);
		const v = await erstelleVersammlung(handelnder(), {
			stwegId: g.id,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await nimmInTagAuf(handelnder(), t.id, v.id, i);
		await gibVersammlungFrei(handelnder(), v.id);
		await eroeffneVersammlung(handelnder(), v.id);
		ergebnis.push({ versammlung: v.id, parteien: g.parteien });
	}
	const [einzeln, zweit] = ergebnis;
	/** Alle Eigentümer beider Häuser anwesend. */
	const alleAnwesend = async () => {
		for (const h of ergebnis) {
			for (const p of h.parteien) await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		}
	};
	return { tag: t.id, einzeln, zweit, alleAnwesend };
}

describe('Ä-17 A: der Satz zum einzigen Eigentümer', () => {
	it('Hausleitung: der kurze Satz beim einzigen Eigentümer, erst wenn beschlussfähig; bei zwei Eigentümern nichts', async () => {
		const { einzeln, zweit, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 9', '2027-11-02');
		// Vor der Anwesenheit: nicht beschlussfähig, also kein Satz.
		const vorher = await hausleitung(einzeln.versammlung);
		expect(vorher.beschlussfaehigkeit?.beschlussfaehig).toBe(false);
		expect(vorher.einzigerEigentuemer).toBeNull();

		await alleAnwesend();
		const e = await hausleitung(einzeln.versammlung);
		expect(e.beschlussfaehigkeit?.beschlussfaehig).toBe(true);
		expect(e.einzigerEigentuemer).toBe(EINZIGER_EIGENTUEMER_KURZ);

		// Gegenprobe: zwei Eigentümer, ebenso beschlussfähig, kein Satz.
		const z = await hausleitung(zweit.versammlung);
		expect(z.beschlussfaehigkeit?.beschlussfaehig).toBe(true);
		expect(z.einzigerEigentuemer).toBeNull();
	});

	it('Abendleitung: derselbe Satz je Haus, erst wenn beschlussfähig, nur beim Haus mit einem Eigentümer', async () => {
		const { tag, einzeln, zweit, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 10', '2027-11-07');
		// Vor der Anwesenheit: nicht beschlussfähig, also kein Satz.
		const vorher = await abendleitung(tag);
		expect(vorher.stand).toHaveLength(2);
		const ev = vorher.stand.find((s) => s.meetingId === einzeln.versammlung);
		expect(ev?.beschlussfaehig?.erfuellt).toBe(false);
		expect(ev?.einzigerEigentuemer).toBeNull();

		await alleAnwesend();
		const d = await abendleitung(tag);
		expect(d.stand).toHaveLength(2);
		const e = d.stand.find((s) => s.meetingId === einzeln.versammlung);
		const z = d.stand.find((s) => s.meetingId === zweit.versammlung);
		expect(e?.beschlussfaehig?.erfuellt).toBe(true);
		expect(e?.einzigerEigentuemer).toBe(EINZIGER_EIGENTUEMER_KURZ);
		// Gegenprobe: das Haus mit zwei Eigentümern, ebenso beschlussfähig.
		expect(z?.beschlussfaehig?.erfuellt).toBe(true);
		expect(z?.einzigerEigentuemer).toBeNull();
	});

	it('Hausprotokoll ohne festgehaltene Feststellung: der Satz mit Fundstelle beim einzigen Eigentümer, nicht bei zweien', async () => {
		const { einzeln, zweit, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 11', '2027-11-08');
		await alleAnwesend();
		// Die Voraussetzung: Es läuft der Zweig ohne Feststellung, nicht `feststellungssatz`.
		const [f] = await imKontext(betreiber, (tx) =>
			tx<{ n: number }[]>`
				SELECT count(*)::int AS n FROM quorum_finding
				WHERE meeting_id IN (${einzeln.versammlung}, ${zweit.versammlung})
			`
		);
		expect(f.n).toBe(0);

		const e = flach(await stelleEntwurfZusammen(betreiber, einzeln.versammlung, new Date().toISOString(), 'Prüflauf'));
		const z = flach(await stelleEntwurfZusammen(betreiber, zweit.versammlung, new Date().toISOString(), 'Prüflauf'));
		const satz = flach(EINZIGER_EIGENTUEMER);
		expect(e).toContain(`Die Versammlung ist beschlussfähig. ${satz}`);
		// Gegenprobe: beschlussfähig auch dort, aber ohne den Satz.
		expect(z).toContain('Die Versammlung ist beschlussfähig (ZGB 712p).');
		expect(z).not.toContain('Alle Stockwerkanteile gehören einer Person.');
	});

	it('Abendprotokoll: der Satz beim Haus mit einem Eigentümer, nicht beim Haus mit zweien', async () => {
		const { tag, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 12', '2027-11-09');
		await alleAnwesend();
		const p = await stelleAbendzusammenstellungZusammen(betreiber, tag, '9. November 2027, 21:00', 'Prüferin');
		expect(p).not.toBeNull();
		const text = flach(p!.text);
		const satz = flach(EINZIGER_EIGENTUEMER);
		expect(text).toContain(`Beschlussfähig: 1 von 1 Eigentümern anwesend. ${satz}`);
		// Gegenprobe: Das Haus mit zweien steht da, beschlussfähig, und der Satz
		// kommt im ganzen Dokument nur einmal vor.
		expect(text).toContain('Beschlussfähig: 2 von 2 Eigentümern anwesend');
		expect(text).not.toContain(`Beschlussfähig: 2 von 2 Eigentümern anwesend. ${satz}`);
		expect(anzahl(text, satz)).toBe(1);
	});
});

/*
 * **Ä-17 B: neue Traktanden an der zweiten Versammlung.** Ein Abend mit einem
 * Haus «Erfundenweg 9…» (fünf Eigentümer zu je 200/1000), niemand kommt, der
 * Abend vertagt.
 * Die zweite Versammlung hängt am Folgeabend und bringt «Fassadensanierung»
 * mit (übertragen); dazu kommt dort das Geschäft «Neue Heizung» (neu).
 * Jeder `describe` baut sich seine eigene Lage.
 *
 * **Fünf, nicht zwei** (Codeprüfung M1): Erst mit fünf Eigentümern gibt es
 * die Lage, um die es geht. Zwei anwesend erfüllen Art. 712p Abs. 3 (ein
 * Drittel, mindestens zwei), nicht aber Abs. 1 (die Hälfte mit der Hälfte der
 * Wertquoten): Die zweite ist beschlussfähig, das Quorum einer ersten fehlt.
 * Mit zwei Eigentümern fiele «Quorum einer ersten fehlt» mit «nicht
 * beschlussfähig» zusammen, und eine Leitung, die auf das Falsche schaut,
 * bliebe grün.
 */
async function zweiteAmAbend(name: string, datum: string, wahl: Neutraktandenwahl = 'erste') {
	const t = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const g = await gemeinschaft(name, ['Erfunden 4', 'Erfunden 5', 'Erfunden 6', 'Erfunden 7', 'Erfunden 8']);
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const offen = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, offen.id, EINFACHES_MEHR);
	await nimmInTagAuf(handelnder(), t.id, v.id, 0);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	const e = await vertageAmAbend(handelnder(), t.id, { versammlungen: [v.id], grund: 'nicht beschlussfähig' });
	expect(e.folgeabendId).not.toBeNull();
	expect(e.befunde).toHaveLength(1);
	const folgeabend = e.folgeabendId!;
	const zweite = e.befunde[0].folgeId!;

	await erstelleGeschaeft(handelnder(), folgeabend, {
		titel: 'Neue Heizung',
		antragswortlaut: 'Eine neue Heizung wird eingebaut.',
		art: 'abstimmung',
		meetingIds: [zweite]
	});
	const zeilen = await imKontext(betreiber, (tx) =>
		tx<{ id: string; title: string }[]>`SELECT id, title FROM agenda_item WHERE meeting_id = ${zweite}`
	);
	const uebertragen = zeilen.find((z) => z.title === 'Fassadensanierung')!.id;
	const neu = zeilen.find((z) => z.title === 'Neue Heizung')!.id;
	expect(uebertragen).toBeTruthy();
	expect(neu).toBeTruthy();
	await haltErfordernisAmTraktandumFest(handelnder(), zweite, neu, EINFACHES_MEHR);
	if (wahl !== 'erste') await speichereLesarten(handelnder(), 'admin', g.id, { L5: wahl });
	return { folgeabend, zweite, uebertragen, neu, parteien: g.parteien };
}

type Zweite = Awaited<ReturnType<typeof zweiteAmAbend>>;

async function eroeffnen(s: Zweite) {
	await gibVersammlungFrei(handelnder(), s.zweite);
	await eroeffneVersammlung(handelnder(), s.zweite);
}

/** Zwei der fünf: beschlussfähig als zweite, ohne das Quorum einer ersten. */
async function zweiDa(s: Zweite) {
	for (const p of s.parteien.slice(0, 2)) await bestaetigeAnwesenheit(handelnder(), s.zweite, p, 'von_hand');
}

/** Die übrigen drei dazu: alle fünf, das Quorum einer ersten erreicht. */
async function restDa(s: Zweite) {
	for (const p of s.parteien.slice(2)) await bestaetigeAnwesenheit(handelnder(), s.zweite, p, 'von_hand');
}

async function alleDa(s: Zweite) {
	await zweiDa(s);
	await restDa(s);
}

describe('Ä-17 B: Traktandenseite der Vorbereitung', () => {
	let s: Zweite;
	beforeAll(async () => {
		s = await zweiteAmAbend('Erfundenweg 9a', '2027-11-03');
	});

	it('zeigt den Hinweis am neuen Traktandum, nicht am übertragenen', async () => {
		const d = await traktandenseite(s.zweite);
		const neu = d.traktanden.find((t) => t.knoten.id === s.neu);
		const alt = d.traktanden.find((t) => t.knoten.id === s.uebertragen);
		expect(neu).toBeDefined();
		expect(alt).toBeDefined();
		expect(neu!.neuAnZweiter).toBe(SATZ_VORBEREITUNG);
		// Gegenprobe: das beim Vertagen übertragene Geschäft.
		expect(alt!.neuAnZweiter).toBeNull();
		// Und sonst keines: Die Pflichttraktanden hatte auch die erste.
		expect(d.traktanden.filter((t) => t.neuAnZweiter !== null).map((t) => t.knoten.id)).toEqual([s.neu]);
	});
});

describe('Ä-17 B: Hausleitung', () => {
	let s: Zweite;
	beforeAll(async () => {
		s = await zweiteAmAbend('Erfundenweg 9b', '2027-11-04');
		await eroeffnen(s);
	});

	async function leitungAm(traktandum: string) {
		await stelleAufTraktandum(handelnder(), s.zweite, traktandum);
		return hausleitung(s.zweite);
	}

	it('nennt das neue Traktandum, solange das Quorum einer ersten fehlt, und nicht mehr, wenn es erreicht ist; das übertragene nie', async () => {
		await zweiDa(s);
		const d = await leitungAm(s.neu);
		// Die Lage: zwei von fünf, als zweite beschlussfähig, das Quorum einer ersten fehlt.
		expect(d.beschlussfaehigkeit?.beschlussfaehig).toBe(true);
		expect(d.mehrhinweise).toContain(SATZ_IM_SAAL);
		// L5 (Codeprüfung Block 7, H1): gesperrt, also das Häkchen «konsultativ».
		expect(d.konsultativMoeglich).toBe(true);
		// Gegenprobe am übertragenen Geschäft, in derselben Lage.
		const alt = await leitungAm(s.uebertragen);
		expect(alt.mehrhinweise).not.toContain(SATZ_IM_SAAL);
		expect(alt.konsultativMoeglich).toBe(false);

		// Gegenprobe zur Bedingung: alle fünf da, das Quorum einer ersten erreicht.
		await restDa(s);
		const nachher = await leitungAm(s.neu);
		expect(nachher.beschlussfaehigkeit?.beschlussfaehig).toBe(true);
		expect(nachher.mehrhinweise).not.toContain(SATZ_IM_SAAL);
	});
});

describe('Ä-17 B: Abendleitung', () => {
	let s: Zweite;
	beforeAll(async () => {
		s = await zweiteAmAbend('Erfundenweg 9c', '2027-11-05');
		await eroeffnen(s);
	});

	async function abendAm(traktandum: string) {
		await stelleAufTraktandum(handelnder(), s.zweite, traktandum);
		const d = await abendleitung(s.folgeabend);
		// Die Voraussetzung: Am Folgeabend tagt genau dieses eine Haus.
		expect(d.stand.map((x) => x.meetingId)).toEqual([s.zweite]);
		return d;
	}

	it('nennt das neue Traktandum am Folgeabend, solange das Quorum einer ersten fehlt; das übertragene nie', async () => {
		await zweiDa(s);
		const d = await abendAm(s.neu);
		// Die Lage: zwei von fünf, als zweite beschlussfähig, das Quorum einer ersten fehlt.
		expect(d.stand[0].beschlussfaehig?.erfuellt).toBe(true);
		// Am Abend ohne konsultative Abstimmung: Der Satz sagt sie nicht zu (H1).
		expect(d.mehrhinweise).toContain(SATZ_AM_ABEND);
		expect(SATZ_AM_ABEND).not.toMatch(/unverbindlich/);
		expect((await abendAm(s.uebertragen)).mehrhinweise).not.toContain(SATZ_AM_ABEND);

		// Gegenprobe zur Bedingung: alle fünf da, das Quorum einer ersten erreicht.
		await restDa(s);
		const nachher = await abendAm(s.neu);
		expect(nachher.stand[0].beschlussfaehig?.erfuellt).toBe(true);
		expect(nachher.mehrhinweise).not.toContain(SATZ_AM_ABEND);
	});
});

/*
 * **L5 milde Wahl: der Hinweis nur mit dem Drittel** (Review DeepSeek zu
 * Block 7, Befund 4). Zwei von fünf Eigentümern erreichen das Drittel der
 * zweiten Versammlung, nicht die Hälfte der ersten. Fehlt schon das Drittel,
 * bleibt es bei der gewöhnlichen Absage, und der milde Hinweis fehlt.
 */
describe('L5 milde Wahl: der Hinweis in Haus- und Abendleitung', () => {
	const SATZ_HAUS = neuAnZweiterHinweis('drittel', true);
	const SATZ_ABEND = neuAnZweiterHinweis('drittel', true, false);
	let s: Zweite;
	beforeAll(async () => {
		s = await zweiteAmAbend('Erfundenweg 9e', '2027-11-13', 'drittel');
		await eroeffnen(s);
		await stelleAufTraktandum(handelnder(), s.zweite, s.neu);
	});

	it('Hausleitung und Abendleitung zeigen ihn erst, wenn das Drittel erreicht ist', async () => {
		const hausVorher = await hausleitung(s.zweite);
		const abendVorher = await abendleitung(s.folgeabend);
		expect(hausVorher.beschlussfaehigkeit?.beschlussfaehig).toBe(false);
		expect(hausVorher.mehrhinweise).not.toContain(SATZ_HAUS);
		expect(abendVorher.mehrhinweise).not.toContain(SATZ_ABEND);

		await zweiDa(s);
		const haus = await hausleitung(s.zweite);
		const abend = await abendleitung(s.folgeabend);
		expect(haus.beschlussfaehigkeit?.beschlussfaehig).toBe(true);
		expect(haus.mehrhinweise).toContain(SATZ_HAUS);
		expect(abend.stand[0].beschlussfaehig?.erfuellt).toBe(true);
		expect(abend.mehrhinweise).toContain(SATZ_ABEND);
	});
});

describe('Ä-17 B: Abendprotokoll', () => {
	let s: Zweite;
	beforeAll(async () => {
		s = await zweiteAmAbend('Erfundenweg 9d', '2027-11-06');
		await eroeffnen(s);
		await alleDa(s);
		for (const id of [s.neu, s.uebertragen]) {
			await stelleAufTraktandum(handelnder(), s.zweite, id);
			await oeffneAbstimmung(handelnder(), s.zweite, id);
			await gibStimmenAb(
				handelnder(),
				s.zweite,
				s.parteien.map((p) => ({ parteiId: p, wahl: 'yes' as const })),
				false
			);
			await schliesseAbstimmung(handelnder(), s.zweite);
		}
	});

	it('nennt beim Beschluss über das neue Traktandum die Tatsache, beim übertragenen nicht', async () => {
		const p = await stelleAbendzusammenstellungZusammen(betreiber, s.folgeabend, '6. November 2027, 21:00', 'Prüferin');
		expect(p).not.toBeNull();
		const text = flach(p!.text);
		const satz = flach(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
		// Der Abschnitt je Geschäft: von «## <Nummer> <Titel>» bis zur nächsten Überschrift.
		const abschnitt = (titel: string) => new RegExp(`## \\d+ ${titel} (.*?)(?= ## |$)`).exec(text)?.[1] ?? '';
		const neu = abschnitt('Neue Heizung');
		const alt = abschnitt('Fassadensanierung');
		expect(neu).toMatch(/angenommen/i);
		expect(neu).toContain(satz);
		// Gegenprobe: das übertragene Geschäft, ebenso angenommen, ohne den Satz.
		expect(alt).toMatch(/angenommen/i);
		expect(alt).not.toContain(satz);
		expect(anzahl(text, satz)).toBe(1);
	});
});

/*
 * **Entscheid 0016: alle Anteile gehören einer gemeinschaftlichen Zeile.**
 * Derselbe Abend, die Einstellhalle gehört einem Ehepaar. Gezählt wird wie bei
 * einer Person (Rz. 15 ad Art. 712p); nur der Satz ist ein anderer, und zwar
 * über den echten Weg: Momentaufnahme, Übersicht, Leitung und Protokoll.
 */
describe('Entscheid 0016: der Satz, wenn die einzige Partei mehrere Personen sind', () => {
	it('Hausleitung und Abendleitung nennen den Satz zur Gemeinschaft, nicht den zur Person', async () => {
		const { tag, einzeln, zweit, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 13', '2027-11-10', true);
		await alleAnwesend();
		const e = await hausleitung(einzeln.versammlung);
		expect(e.beschlussfaehigkeit?.beschlussfaehig).toBe(true);
		expect(e.einzigerEigentuemer).toBe(EINZIGE_GEMEINSCHAFT_KURZ);
		const d = await abendleitung(tag);
		expect(d.stand.find((s) => s.meetingId === einzeln.versammlung)?.einzigerEigentuemer).toBe(
			EINZIGE_GEMEINSCHAFT_KURZ
		);
		// Gegenprobe: das Haus mit zwei Eigentümern trägt keinen der beiden Sätze.
		expect((await hausleitung(zweit.versammlung)).einzigerEigentuemer).toBeNull();
	});

	it('Hausprotokoll und Abendprotokoll nennen den Satz mit Fundstellen', async () => {
		const { tag, einzeln, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 14', '2027-11-11', true);
		await alleAnwesend();
		const e = flach(await stelleEntwurfZusammen(betreiber, einzeln.versammlung, new Date().toISOString(), 'Prüflauf'));
		expect(e).toContain(`Die Versammlung ist beschlussfähig. ${flach(EINZIGE_GEMEINSCHAFT)}`);
		expect(e).not.toContain('Alle Stockwerkanteile gehören einer Person.');
		const p = await stelleAbendzusammenstellungZusammen(betreiber, tag, '11. November 2027, 21:00', 'Prüferin');
		const text = flach(p!.text);
		expect(text).toContain(`Beschlussfähig: 1 von 1 Eigentümern anwesend. ${flach(EINZIGE_GEMEINSCHAFT)}`);
	});

	it('über eine festgehaltene Feststellung: Rückgabe, Hausleitung und Protokoll nennen die Gemeinschaft', async () => {
		const { einzeln, alleAnwesend } = await abendEinzigerEigentuemer('Erfundenweg 15', '2027-11-12', true);
		await alleAnwesend();
		const f = await halteBeschlussfaehigkeitFest(handelnder(), einzeln.versammlung);
		// Die Rückgabe trägt das Merkmal aus der Momentaufnahme, die Zeile nicht.
		expect(f.einzigeParteiGemeinsam).toBe(true);
		expect(feststellungssatz(f)).toBe(`Die Versammlung ist beschlussfähig. ${EINZIGE_GEMEINSCHAFT}`);
		const h = await hausleitung(einzeln.versammlung);
		expect(h.feststellungen.at(-1)?.satz).toBe(`Die Versammlung ist beschlussfähig. ${EINZIGE_GEMEINSCHAFT}`);
		const e = flach(await stelleEntwurfZusammen(betreiber, einzeln.versammlung, new Date().toISOString(), 'Prüflauf'));
		expect(e).toContain(flach(EINZIGE_GEMEINSCHAFT));
		expect(e).not.toContain(flach(EINZIGER_EIGENTUEMER));
	});
});
