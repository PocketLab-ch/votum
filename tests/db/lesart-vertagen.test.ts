/**
 * Lesart L16 am echten Weg (Migration 194, Entscheid 0054 Punkt 3): Was legt
 * das Vertagen einer ersten Versammlung an, die an diesem Abend schon
 * beschlussfähig war?
 *
 * Nach der Vorgabe eine neue erste (C3, wie `vertagung.test.ts`). Nach der
 * Wahl «zweite» eine zweite nach Art. 712p Abs. 3, aber nur, wenn die
 * Beschlussfähigkeit beim Vertagen weggefallen ist (`zweiteNachLesart`,
 * Fachprüfung F-1). War sie nie beschlussfähig, ist die Folge in beiden Wahlen
 * die gewöhnliche zweite, ohne das Merkmal `tier_by_reading`.
 *
 * **Die Lage:** drei Eigentümer (400, 300, 300), alle anwesend. Ein
 * geschlossener verbindlicher Durchgang belegt die zeitweise
 * Beschlussfähigkeit. Gehen danach zwei, ist noch einer von dreien mit 400 von
 * 1000 Wertquoten da: Die Beschlussfähigkeit einer ersten fehlt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, eroeffneVersammlung, vertageVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { holeLesarten, speichereLesarten } from '$lib/server/lesarten';
import { fruehesterZweitTermin } from '$lib/domain/versammlung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Vertagungswahl } from '$lib/domain/lesarten';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
const handelnder = () => ({ operatorId: betreiber, userId: null, label: 'Prüflauf' });

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

const ERSTE_AM = '2026-05-20';

/**
 * Laufende erste Versammlung mit allen drei anwesend. `wahl` wird vor der
 * Freigabe gesetzt (`null`: Vorgabe). `abstimmen` schliesst einen
 * verbindlichen Durchgang, `gehen` lässt danach zwei Eigentümer gehen.
 */
async function aufbau(
	name: string,
	wahl: Vertagungswahl | null,
	{
		abstimmen,
		gehen,
		nachFreigabe
	}: { abstimmen: boolean; gehen: boolean; nachFreigabe?: Vertagungswahl }
) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, quote] of [400, 300, 300].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: quote },
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
		datum: ERSTE_AM,
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Jahresrechnung 2025',
		art: 'abstimmung',
		antragswortlaut: 'Die Jahresrechnung 2025 wird genehmigt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, EINFACHES_MEHR);
	if (wahl !== null) await speichereLesarten(handelnder(), 'admin', g.id, { L16: wahl });
	await gibVersammlungFrei(handelnder(), v.id);
	// Umstellung nach der Freigabe: Sie darf diese Versammlung nicht mehr treffen.
	if (nachFreigabe) await speichereLesarten(handelnder(), 'admin', g.id, { L16: nachFreigabe });
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
	if (abstimmen) {
		await oeffneAbstimmung(handelnder(), v.id, t.id);
		await schliesseAbstimmung(handelnder(), v.id);
	}
	if (gehen) {
		for (const p of parteien.slice(1)) await erfasseVerlassenDerVersammlung(handelnder(), v.id, p);
	}
	return { stweg: g.id, versammlung: v.id };
}

/** Die Zeile der Folgeversammlung, wie sie in der Datenbank steht. */
async function folgezeile(id: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ tier: string; previous_meeting_id: string | null; tier_by_reading: boolean; meeting_date: string }[]>`
			SELECT tier, previous_meeting_id, tier_by_reading, meeting_date::text AS meeting_date
			FROM meeting WHERE id = ${id}
		`
	);
	return z;
}

/** Der Vermerk `versammlungVertagt` an der vertagten Versammlung. */
async function vertagungsvermerk(id: string) {
	const [e] = await imKontext(betreiber, (tx) =>
		tx<{ detail: { folgestufe: string; nachLesart?: boolean } }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_type = 'meeting' AND subject_id = ${id}
			  AND event_type = 'meeting.adjourned'
		`
	);
	return e.detail;
}

const vertage = (id: string) => vertageVersammlung(handelnder(), id, { grund: 'nicht mehr beschlussfähig' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L16');
});

afterAll(verbindungenSchliessen);

describe('L16 nach der Vorgabe «neue_erste»', () => {
	it('legt nach zeitweiser Beschlussfähigkeit, die weggefallen ist, eine neue erste an', async () => {
		const a = await aufbau('Erfundenweg 1601', null, { abstimmen: true, gehen: true });
		expect((await holeLesarten(betreiber, { stwegId: a.stweg })).L16).toBe('neue_erste');
		const { folge, folgestufe, nachLesart } = await vertage(a.versammlung);
		expect(folgestufe).toBe('erste');
		expect(nachLesart).toBe(false);
		const z = await folgezeile(folge.id);
		expect(z.tier).toBe('erste');
		expect(z.previous_meeting_id).toBeNull();
		expect(z.tier_by_reading).toBe(false);
		expect((await vertagungsvermerk(a.versammlung)).nachLesart).toBeUndefined();
	});
});

describe('L16 nach der Wahl «zweite»', () => {
	it('legt nach zeitweiser Beschlussfähigkeit, die weggefallen ist, eine zweite nach Lesart an', async () => {
		const a = await aufbau('Erfundenweg 1602', 'zweite', { abstimmen: true, gehen: true });
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L16).toBe('zweite');
		const { folge, folgestufe, nachLesart } = await vertage(a.versammlung);
		expect(folgestufe).toBe('zweite');
		expect(nachLesart).toBe(true);
		expect(folge.stufe).toBe('zweite');
		expect(folge.vorgaengerId).toBe(a.versammlung);
		const z = await folgezeile(folge.id);
		expect(z.tier).toBe('zweite');
		expect(z.previous_meeting_id).toBe(a.versammlung);
		expect(z.tier_by_reading).toBe(true);
		expect(folge.stufeNachLesart).toBe(true);
		// Frühestens am elften Tag (Art. 712p Abs. 2), wie jede zweite.
		expect(z.meeting_date >= fruehesterZweitTermin(ERSTE_AM)).toBe(true);
		expect(fruehesterZweitTermin(ERSTE_AM)).toBe('2026-05-31');
		const vermerk = await vertagungsvermerk(a.versammlung);
		expect(vermerk.folgestufe).toBe('zweite');
		expect(vermerk.nachLesart).toBe(true);
	});

	it('legt eine neue erste an, wenn die Versammlung beim Vertagen noch beschlussfähig ist', async () => {
		const a = await aufbau('Erfundenweg 1603', 'zweite', { abstimmen: true, gehen: false });
		const { folge, folgestufe, nachLesart } = await vertage(a.versammlung);
		expect(folgestufe).toBe('erste');
		expect(nachLesart).toBe(false);
		const z = await folgezeile(folge.id);
		expect(z.tier).toBe('erste');
		expect(z.previous_meeting_id).toBeNull();
		expect(z.tier_by_reading).toBe(false);
		expect((await vertagungsvermerk(a.versammlung)).nachLesart).toBeUndefined();
	});

	it('legt nach nie erreichter Beschlussfähigkeit die gewöhnliche zweite an, ohne Merkmal', async () => {
		const a = await aufbau('Erfundenweg 1604', 'zweite', { abstimmen: false, gehen: true });
		const { folge, folgestufe, nachLesart } = await vertage(a.versammlung);
		expect(folgestufe).toBe('zweite');
		expect(nachLesart).toBe(false);
		expect(folge.stufeNachLesart).toBeUndefined();
		const z = await folgezeile(folge.id);
		expect(z.tier).toBe('zweite');
		expect(z.previous_meeting_id).toBe(a.versammlung);
		expect(z.tier_by_reading).toBe(false);
		expect((await vertagungsvermerk(a.versammlung)).nachLesart).toBeUndefined();
	});
});

describe('L16 in der Datenbank: meeting_stufe_nach_lesart', () => {
	it('weist das Merkmal an einer ersten Versammlung ab', async () => {
		const a = await aufbau('Erfundenweg 1605', null, { abstimmen: true, gehen: true });
		const { folge } = await vertage(a.versammlung);
		expect(folge.stufe).toBe('erste');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE meeting SET tier_by_reading = true WHERE id = ${folge.id}`)
		).rejects.toThrow(/meeting_stufe_nach_lesart/);
	});
});

describe('L16 friert mit der Freigabe ein (Featureprüfung)', () => {
	it('bleibt bei der neuen ersten, wenn erst nach der Freigabe auf «zweite» umgestellt wird', async () => {
		const a = await aufbau('Erfundenweg 1606', null, { abstimmen: true, gehen: true, nachFreigabe: 'zweite' });
		expect((await holeLesarten(betreiber, { stwegId: a.stweg })).L16).toBe('zweite');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L16).toBe('neue_erste');
		const { folgestufe, nachLesart } = await vertage(a.versammlung);
		expect(folgestufe).toBe('erste');
		expect(nachLesart).toBe(false);
	});

	it('bleibt bei der zweiten, wenn nach der Freigabe auf «neue_erste» zurückgestellt wird', async () => {
		const a = await aufbau('Erfundenweg 1607', 'zweite', { abstimmen: true, gehen: true, nachFreigabe: 'neue_erste' });
		expect((await holeLesarten(betreiber, { stwegId: a.stweg })).L16).toBe('neue_erste');
		const { folge, folgestufe, nachLesart } = await vertage(a.versammlung);
		expect(folgestufe).toBe('zweite');
		expect(nachLesart).toBe(true);
		expect((await folgezeile(folge.id)).tier_by_reading).toBe(true);
	});
});
