/**
 * Vertagen am gemeinsamen Abend — mehrere Häuser, **ein** Folgetermin.
 *
 * **Der Fall** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
 * beschlussfähig sind, wird die Sitzung mit der beschlussfähigen Gemeinschaft
 * durchgeführt. Die anderen brauchen einen neuen Termin, frühestens in 10 Tage
 * später.»
 *
 * Geprüft wird der ganze Kreis, nicht nur das Anlegen: Die vertagten Häuser
 * bekommen ihre zweite Versammlung, alle auf denselben Tag, und die hängen an
 * einem **neuen Abend** — sonst stünde die Bewirtschaftung danach mit vier
 * losen Versammlungen da und müsste den Saal von Hand nachbauen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, eroeffneVersammlung } from '$lib/server/versammlungen';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { vertageAmAbend } from '$lib/server/abendsteuerung';
import {
	gibStimmenAb,
	holeEntschiedeneAmAbend,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

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

/** Die Kennung eines Traktandums einer Versammlung, gesucht am Titel. */
async function traktandumVon(meetingId: string, titel: string): Promise<string> {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${meetingId} AND title = ${titel}
		`
	);
	return z.id;
}

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abendvertagung');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-abendvertagung');
});

afterAll(verbindungenSchliessen);

/**
 * Ein Abend mit `anzahl` Häusern, alle eröffnet und mit einem eigenen
 * Sachtraktandum — damit sich zeigt, dass die Geschäfte mitwandern.
 *
 * Mit `gleichstand` hat jedes Haus zwei Parteien, und den Stichentscheid
 * trifft nach Reglement der Verwalter: So endet ein Durchgang mit Ja gegen
 * Nein unentschieden und unverkündet, und nur so lässt er sich seit H6 noch
 * mit einer Neuabstimmung überholen.
 */
async function abendMit(name: string, anzahl: number, gleichstand = false) {
	const tag = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name} — Abend`,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Halle der Proben',
		art: 'ordentlich'
	});

	const haeuser: {
		versammlung: string;
		gemeinschaft: string;
		name: string;
		partei: string;
		zweitePartei: string | null;
	}[] = [];
	for (let i = 0; i < anzahl; i++) {
		const g = await erstelleGemeinschaft(handelnder(), {
			name: `${name} — Haus ${i + 1}`,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null,
			...(gleichstand ? { tieBreak: 'verwalter' as const, tieBreakRuleSource: 'Art. 7 Ziff. 5' } : {})
		});
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: gleichstand ? 500 : 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Eigentümer ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		let zweitePartei: string | null = null;
		if (gleichstand) {
			const e2 = await erstelleEinheit(handelnder(), {
				stwegId: g.id,
				kind: 'unit',
				label: 'Whg 2',
				quotas: { stamm: 500 },
				countsAsHead: true
			});
			const p2 = await erstelleEigentuemer(handelnder(), {
				stwegId: g.id,
				kind: 'natural',
				displayName: `Zweite Eigentümerin ${i + 1}`,
				isCommunity: false,
				representativeName: null
			});
			await ordneEigentumZu(handelnder(), e2.id, p2.id, '2020-01-01');
			zweitePartei = p2.id;
		}

		const m = await erstelleVersammlung(handelnder(), {
			stwegId: g.id,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await erstelleTraktandum(handelnder(), {
			meetingId: m.id,
			parentId: null,
			titel: 'Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await nimmInTagAuf(handelnder(), tag.id, m.id, i);
		await gibVersammlungFrei(handelnder(), m.id);
		await eroeffneVersammlung(handelnder(), m.id);

		haeuser.push({
			versammlung: m.id,
			gemeinschaft: g.id,
			name: `${name} — Haus ${i + 1}`,
			partei: p.id,
			zweitePartei
		});
	}
	return { tag: tag.id, haeuser };
}

describe('Vier vertagen, eines tagt weiter', () => {
	it('vertagt genau die gewählten und lässt die anderen laufen', async () => {
		const a = await abendMit('Sammelweg 1', 5);
		const e = await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.slice(1).map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});

		expect(e.gelungen).toBe(4);
		expect(e.offen).toEqual([]);

		const zustaende = await imKontext(betreiber, (tx) =>
			tx<{ id: string; state: string }[]>`
				SELECT id, state FROM meeting WHERE id = ANY(${a.haeuser.map((h) => h.versammlung)})
			`
		);
		const nach = new Map(zustaende.map((z) => [z.id, z.state]));
		expect(nach.get(a.haeuser[0].versammlung)).toBe('laufend');
		for (const h of a.haeuser.slice(1)) expect(nach.get(h.versammlung)).toBe('geschlossen');
	});

	// Elf Tage, nicht zehn (Befund R-1, 23.09.2026): Die Frist von zehn Tagen
	// beginnt am Tag nach dem Abend (Rz. 41 ad Art. 712p), der erste zulässige
	// Termin liegt deshalb elf Tage danach.
	it('gibt allen vertagten denselben Termin, den ersten zulässigen', async () => {
		const a = await abendMit('Sammelweg 2', 3);
		const e = await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});

		expect(e.datum).toBe('2026-05-30');
		const daten = await imKontext(betreiber, (tx) =>
			tx<{ meeting_date: Date; tier: string }[]>`
				SELECT meeting_date, tier FROM meeting WHERE id = ANY(${e.befunde.map((b) => b.folgeId)})
			`
		);
		expect(daten).toHaveLength(3);
		for (const d of daten) {
			expect(d.meeting_date.toISOString().slice(0, 10)).toBe('2026-05-30');
			expect(d.tier).toBe('zweite');
		}
	});

	it('hängt die zweiten Versammlungen an einen neuen Abend', async () => {
		const a = await abendMit('Sammelweg 3', 3);
		const e = await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});

		expect(e.folgeabendId).not.toBeNull();
		expect(e.folgeabendId).not.toBe(a.tag);

		const [abend] = await imKontext(betreiber, (tx) =>
			tx<{ label: string; day_date: Date; location: string; start_time: string }[]>`
				SELECT label, day_date, location, start_time FROM meeting_day WHERE id = ${e.folgeabendId}
			`
		);
		expect(abend.label).toBe('Sammelweg 3 — Abend — zweite Versammlung');
		expect(abend.location).toBe('Halle der Proben');
		expect(String(abend.start_time).slice(0, 5)).toBe('17:00');

		const dran = await imKontext(betreiber, (tx) =>
			tx<{ anzahl: number }[]>`
				SELECT count(*)::int AS anzahl FROM meeting WHERE meeting_day_id = ${e.folgeabendId}
			`
		);
		expect(dran[0].anzahl).toBe(3);
	});

	it('lässt die vertagten Versammlungen im alten Abend stehen', async () => {
		const a = await abendMit('Sammelweg 4', 2);
		await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});

		// Der alte Abend bleibt vollständig — sein Protokoll braucht ihn.
		const dran = await imKontext(betreiber, (tx) =>
			tx<{ anzahl: number }[]>`
				SELECT count(*)::int AS anzahl FROM meeting WHERE meeting_day_id = ${a.tag}
			`
		);
		expect(dran[0].anzahl).toBe(2);
	});

	it('führt die unerledigten Geschäfte in die gemeinsame Liste des neuen Abends', async () => {
		const a = await abendMit('Sammelweg 5', 3);
		const e = await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});

		// Alle drei Häuser bringen «Fassadensanierung» mit — daraus wird EIN
		// gemeinsames Geschäft, in dem alle drei stehen.
		const geschaefte = await imKontext(betreiber, (tx) =>
			tx<{ title: string; haeuser: number }[]>`
				SELECT b.title, count(a.id)::int AS haeuser
				FROM business b LEFT JOIN agenda_item a ON a.business_id = b.id
				WHERE b.meeting_day_id = ${e.folgeabendId} AND b.title = 'Fassadensanierung'
				GROUP BY b.title
			`
		);
		expect(geschaefte).toEqual([{ title: 'Fassadensanierung', haeuser: 3 }]);
	});
});

/*
 * Auftraggeber, 25.08.2026: «und wenn 2.1 bereits abgestimmt, kann ich dort nicht
 * nochmals abstimmen, wie es der button suggeriert.» Die Liste am Abend bot
 * «Abstimmen» und «Aufrufen» weiter an; der Server wies beides ab. Der Knopf
 * verschwindet jetzt — und woran er das erkennt, steht hier.
 */
describe('Gemischt: ein Haus war beschlussfähig (C3, F4c)', () => {
	it('legt für dieses Haus eine neue erste an und nennt beide Stufen', async () => {
		const a = await abendMit('Mischweg 1', 2);
		const t = await traktandumVon(a.haeuser[0].versammlung, 'Fassadensanierung');
		await haltErfordernisAmTraktandumFest(handelnder(), a.haeuser[0].versammlung, t, EINFACHES_MEHR);
		await bestaetigeAnwesenheit(handelnder(), a.haeuser[0].versammlung, a.haeuser[0].partei, 'von_hand');
		await oeffneAbstimmung(handelnder(), a.haeuser[0].versammlung, t);
		await schliesseAbstimmung(handelnder(), a.haeuser[0].versammlung);

		const e = await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});
		const stufe = (v: string) => e.befunde.find((b) => b.versammlungId === v)?.folgestufe;
		expect(stufe(a.haeuser[0].versammlung)).toBe('erste');
		expect(stufe(a.haeuser[1].versammlung)).toBe('zweite');

		const [abend] = await imKontext(betreiber, (tx) =>
			tx<{ label: string; note: string }[]>`
				SELECT label, note FROM meeting_day WHERE id = ${e.folgeabendId}
			`
		);
		expect(abend.label).toBe('Mischweg 1 — Abend — Folgeversammlung');
		expect(abend.note).toContain(`Als zweite Versammlung tagt «${a.haeuser[1].name}».`);
		expect(abend.note).toContain(`Als neue erste Versammlung tagt «${a.haeuser[0].name}», weil sie`);
		expect(abend.note).not.toContain('Rz.');
	});
});

describe('Über welche Punkte am Abend entschieden ist', () => {
	it('meldet nichts, solange nicht abgestimmt wurde', async () => {
		const a = await abendMit('Entschiedenweg 1', 2);
		expect(await holeEntschiedeneAmAbend(betreiber, a.tag)).toEqual([]);
	});

	it('meldet genau das Traktandum, dessen Durchgang geschlossen ist', async () => {
		const a = await abendMit('Entschiedenweg 2', 2);
		const t = await traktandumVon(a.haeuser[0].versammlung, 'Fassadensanierung');
		await haltErfordernisAmTraktandumFest(handelnder(), a.haeuser[0].versammlung, t, EINFACHES_MEHR);
		await bestaetigeAnwesenheit(handelnder(), a.haeuser[0].versammlung, a.haeuser[0].partei, 'von_hand');
		await oeffneAbstimmung(handelnder(), a.haeuser[0].versammlung, t);
		await schliesseAbstimmung(handelnder(), a.haeuser[0].versammlung);

		expect(await holeEntschiedeneAmAbend(betreiber, a.tag)).toEqual([t]);
	});

	/*
	 * Ein überholter Durchgang zählt nicht: Nach einer angesetzten Neuabstimmung
	 * ist die Frage wieder offen, und dann muss der Knopf zurückkommen.
	 */
	it('zählt einen überholten Durchgang nicht mit', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const a = await abendMit('Entschiedenweg 3', 1, true);
		const h = a.haeuser[0];
		const t = await traktandumVon(h.versammlung, 'Fassadensanierung');
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, t, EINFACHES_MEHR);
		await bestaetigeAnwesenheit(handelnder(), h.versammlung, h.partei, 'von_hand');
		await bestaetigeAnwesenheit(handelnder(), h.versammlung, h.zweitePartei!, 'von_hand');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, t);
		await gibStimmenAb(
			handelnder(),
			h.versammlung,
			[
				{ parteiId: h.partei, wahl: 'yes' },
				{ parteiId: h.zweitePartei!, wahl: 'no' }
			],
			false
		);
		const geschlossen = await schliesseAbstimmung(handelnder(), h.versammlung);
		expect(geschlossen.verkuendetAm).toBeNull();
		expect(await holeEntschiedeneAmAbend(betreiber, a.tag)).toEqual([t]);

		await setzeNeuabstimmungAn(
			handelnder(),
			a.haeuser[0].versammlung,
			d.id,
			'Die Auszählung war offensichtlich falsch.'
		);
		expect(await holeEntschiedeneAmAbend(betreiber, a.tag)).toEqual([]);
	});

	it('sieht die Punkte eines fremden Abends nicht', async () => {
		const a = await abendMit('Entschiedenweg 4', 1);
		const fremd = await abendMit('Entschiedenweg 4 fremd', 1);
		const t = await traktandumVon(fremd.haeuser[0].versammlung, 'Fassadensanierung');
		await haltErfordernisAmTraktandumFest(handelnder(), fremd.haeuser[0].versammlung, t, EINFACHES_MEHR);
		await bestaetigeAnwesenheit(handelnder(), fremd.haeuser[0].versammlung, fremd.haeuser[0].partei, 'von_hand');
		await oeffneAbstimmung(handelnder(), fremd.haeuser[0].versammlung, t);
		await schliesseAbstimmung(handelnder(), fremd.haeuser[0].versammlung);

		expect(await holeEntschiedeneAmAbend(betreiber, a.tag)).toEqual([]);
		expect(await holeEntschiedeneAmAbend(betreiber, fremd.tag)).toEqual([t]);
	});
});

/*
 * Die Mandantengrenze am neuen Endpunkt: `vertageAmAbend` filtert die gewählten
 * Versammlungen gegen die Häuser DIESES Abends, und `holeAbendhaeuser` läuft
 * unter `alsBetreiber`. Ein fremder Betreiber sieht den Abend gar nicht.
 */
describe('Ein fremder Betreiber kommt nicht heran', () => {
	it('findet den Abend nicht und vertagt nichts', async () => {
		const a = await abendMit('Sammelweg 9', 2);
		const fremd = await pruefbetreiber('Abendvertagung fremd');

		await expect(
			vertageAmAbend({ operatorId: fremd, userId: null, label: 'Fremder' }, a.tag, {
				versammlungen: a.haeuser.map((h) => h.versammlung),
				grund: 'nicht beschlussfähig'
			})
		).rejects.toThrow(/nicht gefunden/);

		const zustaende = await imKontext(betreiber, (tx) =>
			tx<{ state: string }[]>`
				SELECT state FROM meeting WHERE id = ANY(${a.haeuser.map((h) => h.versammlung)})
			`
		);
		for (const z of zustaende) expect(z.state).toBe('laufend');
	});
});

describe('Was nicht geht, hält den Rest nicht auf', () => {
	it('weist eine leere Auswahl ab, statt alles zu vertagen', async () => {
		const a = await abendMit('Sammelweg 6', 2);
		await expect(
			vertageAmAbend(handelnder(), a.tag, { versammlungen: [], grund: 'nicht beschlussfähig' })
		).rejects.toThrow(/Wählen Sie zuerst aus/);
	});

	it('löst bei einer fremden Kennung nichts aus', async () => {
		const a = await abendMit('Sammelweg 7', 2);
		const fremd = await abendMit('Sammelweg 7 fremd', 1);
		await expect(
			vertageAmAbend(handelnder(), a.tag, {
				versammlungen: [fremd.haeuser[0].versammlung],
				grund: 'nicht beschlussfähig'
			})
		).rejects.toThrow(/Wählen Sie zuerst aus/);

		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ state: string }[]>`
				SELECT state FROM meeting WHERE id = ${fremd.haeuser[0].versammlung}
			`
		);
		expect(z.state).toBe('laufend');
	});

	it('sammelt den Grund eines Hauses, das nicht mitkann, und vertagt die übrigen', async () => {
		const a = await abendMit('Sammelweg 8', 3);
		// Das erste Haus ist schon vertagt — ein zweites Mal geht nicht.
		await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: [a.haeuser[0].versammlung],
			grund: 'nicht beschlussfähig'
		});

		const e = await vertageAmAbend(handelnder(), a.tag, {
			versammlungen: a.haeuser.map((h) => h.versammlung),
			grund: 'nicht beschlussfähig'
		});

		expect(e.gelungen).toBe(2);
		expect(e.offen).toHaveLength(1);
		expect(e.offen[0].gemeinschaft).toBe('Sammelweg 8 — Haus 1');
		expect(e.offen[0].grund).toMatch(/geschlossen/i);
	});
});
