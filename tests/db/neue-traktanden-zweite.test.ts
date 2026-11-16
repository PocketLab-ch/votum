/**
 * Ä-17 B: Welche Traktanden einer zweiten Versammlung neu sind, am echten Weg.
 *
 * **Der Entscheid** (Produktentscheid 18.10.2026, `docs/entscheide/0012`):
 * Hinweis an jedem neuen Abstimmungstraktandum einer zweiten Versammlung, keine
 * Sperre. Die Regel steht bei `neueTraktandenDerZweiten`; hier wird sie gegen
 * das Vertagen gemessen, das die offenen Geschäfte überträgt
 * (`uebertrageOffeneTraktanden`) und die Pflichttraktanden neu anlegt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, eroeffneVersammlung, vertageVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeNeueTraktandenDerZweiten
} from '$lib/server/traktanden';
import { uebernimmTraktanden } from '$lib/server/vorlagen';
import { erreichtQuorumEinerErsten, quorumEinerErstenErreicht } from '$lib/server/beschlussfaehigkeit';
import { holeUebersicht } from '$lib/server/anwesenheit';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL } from '$lib/domain/mehrhinweise';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
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

/** Die zweite Form einer Kenntnisnahme: eine Abstimmung auf dem Knoten, der nichts beschliesst. */
const KENNTNISNAHME: Erfordernis = {
	...EINFACHES_MEHR,
	astId: 'a-kenntnisnahme',
	knotenId: 'k-kenntnisnahme',
	typ: 'keine_abstimmung',
	titel: 'Kenntnisnahme',
	rechtsgrundlage: 'keine — es wird nicht abgestimmt',
	kopfSchwelle: null
};

const abstimmung = (meetingId: string, titel: string) =>
	erstelleTraktandum(handelnder(), {
		meetingId,
		parentId: null,
		titel,
		art: 'abstimmung',
		antragswortlaut: `${titel} wird beschlossen.`,
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});

let erste: string;
let zweite: string;
let uebertragen: string;
let neu: string;
let vorlage: string[];
let parteienAlle: string[];
/** C2 (F4c): an der ersten zur Kenntnisnahme, beim Vertagen übertragen. */
let ausKenntnis: string;
/** C2: ein Pflichttraktandum, das an der ersten zur Kenntnisnahme stand. */
let vorlageKenntnis: { id: string; title: string };
let kenntnisInAbstimmungsform: string;
let quelleKenntnis: string;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Neue Traktanden zweite');
	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Erfundenweg 7',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, quote] of [600, 400].entries()) {
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
		datum: '2026-05-20',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	erste = v.id;
	parteienAlle = parteien;
	const offen = await abstimmung(erste, 'Fassadensanierung');
	await haltErfordernisAmTraktandumFest(handelnder(), erste, offen.id, EINFACHES_MEHR);
	await erstelleTraktandum(handelnder(), {
		meetingId: erste,
		parentId: null,
		titel: 'Bericht zum Heizungsersatz',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	const info = await abstimmung(erste, 'Information zur Gartenpflege');
	await haltErfordernisAmTraktandumFest(handelnder(), erste, info.id, KENNTNISNAHME);
	await gibVersammlungFrei(handelnder(), erste);
	await eroeffneVersammlung(handelnder(), erste);
	await bestaetigeAnwesenheit(handelnder(), erste, parteien[0], 'von_hand');
	const { folge } = await vertageVersammlung(handelnder(), erste, { grund: 'nicht beschlussfähig' });
	zweite = folge.id;

	const zeilen = await imKontext(betreiber, (tx) =>
		tx<{ id: string; title: string; from_template: boolean; item_kind: string }[]>`
			SELECT id, title, from_template, item_kind FROM agenda_item WHERE meeting_id = ${zweite}
			ORDER BY position, id
		`
	);
	uebertragen = zeilen.find((z) => z.title === 'Fassadensanierung')!.id;
	ausKenntnis = zeilen.find((z) => z.title === 'Bericht zum Heizungsersatz')!.id;
	kenntnisInAbstimmungsform = zeilen.find((z) => z.title === 'Information zur Gartenpflege')!.id;
	quelleKenntnis = (
		await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT id FROM agenda_item WHERE meeting_id = ${erste} AND title = 'Bericht zum Heizungsersatz'
			`
		)
	)[0].id;
	vorlageKenntnis = zeilen.find((z) => z.from_template && z.item_kind === 'kenntnisnahme')!;
	vorlage = zeilen.filter((z) => z.from_template && z.item_kind === 'abstimmung').map((z) => z.id);
	neu = (await abstimmung(zweite, 'Neue Heizung')).id;
	await haltErfordernisAmTraktandumFest(handelnder(), zweite, neu, EINFACHES_MEHR);
});

afterAll(verbindungenSchliessen);

describe('Ä-17 B: neue Traktanden an der zweiten Versammlung', () => {
	it('kennzeichnet ein an der zweiten angelegtes Abstimmungstraktandum als neu', async () => {
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(neu)).toBe(true);
	});

	it('kennzeichnet das beim Vertagen übertragene Geschäft nicht', async () => {
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(uebertragen)).toBe(false);
	});

	it('kennzeichnet die Pflichttraktanden nicht, die auch die erste hatte', async () => {
		expect(vorlage.length).toBeGreaterThan(0);
		const neue = await holeNeueTraktandenDerZweiten(betreiber, zweite);
		for (const id of vorlage) expect(neue.has(id)).toBe(false);
		expect([...neue]).toEqual([neu]);
	});

	/*
	 * **Bearbeiten macht nicht neu** (Codeprüfung 3d, H1): `bearbeiteTraktandum`
	 * und `haltErfordernisAmTraktandumFest` leeren `copied_from_meeting_id`; die
	 * Herkunft steht im Verlauf.
	 */
	it('kennzeichnet das übertragene Geschäft auch nach dem Bearbeiten nicht', async () => {
		await bearbeiteTraktandum(handelnder(), zweite, uebertragen, {
			meetingId: zweite,
			parentId: null,
			titel: 'Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird nach Offerte B saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(), zweite, uebertragen, EINFACHES_MEHR);
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ copied_from_meeting_id: string | null }[]>`
				SELECT copied_from_meeting_id FROM agenda_item WHERE id = ${uebertragen}
			`
		);
		// Die Voraussetzung der Probe: Das Feld ist wirklich geleert.
		expect(z.copied_from_meeting_id).toBeNull();
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(uebertragen)).toBe(false);
	});

	it('kennt an einer ersten Versammlung nichts Neues', async () => {
		expect((await holeNeueTraktandenDerZweiten(betreiber, erste)).size).toBe(0);
	});
});

/*
 * **C2 (F4c): Was an der ersten nur zur Kenntnisnahme stand, ist als
 * Abstimmung neu.** Angekündigt war der Gegenstand, nicht ein Beschluss
 * (Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2 ZGB; Einteilung F3b, C2). Läuft nach
 * den Fällen oben, die die Menge vor dem Umstellen messen.
 */
describe('C2: aus einer Kenntnisnahme übernommen', () => {
	const zurAbstimmung = (id: string, titel: string) =>
		bearbeiteTraktandum(handelnder(), zweite, id, {
			meetingId: zweite,
			parentId: null,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel}: Der Antrag wird angenommen.`,
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});

	it('nennt das Quelltraktandum im Verlauf der Übernahme', async () => {
		const [e] = await imKontext(betreiber, (tx) =>
			tx<{ detail: { ausTraktandum?: string; ausVersammlung?: string } }[]>`
				SELECT detail FROM audit_entry
				WHERE subject_type = 'agenda_item' AND subject_id = ${ausKenntnis}::text
				  AND event_type = 'agenda.item.copied'
			`
		);
		expect(e.detail.ausVersammlung).toBe(erste);
		expect(e.detail.ausTraktandum).toBe(quelleKenntnis);
	});

	it('kennzeichnet die übernommene Kenntnisnahme nicht, solange sie eine bleibt', async () => {
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(ausKenntnis)).toBe(false);
	});

	it('kennzeichnet eine unverändert übernommene Kenntnisnahme in Abstimmungsform nicht (Codeprüfung, M1)', async () => {
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(kenntnisInAbstimmungsform)).toBe(false);
	});

	it('kennzeichnet die Kenntnisnahme in Abstimmungsform als neu, sobald sie ein Erfordernis bekommt', async () => {
		// Prüft die Quellseite (`q.requirement_node` an der ersten): Ohne sie
		// gälte die Kopie als übernommen (Codeprüfung, zweiter Durchgang, 1).
		await haltErfordernisAmTraktandumFest(handelnder(), zweite, kenntnisInAbstimmungsform, EINFACHES_MEHR);
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(kenntnisInAbstimmungsform)).toBe(true);
	});

	it('kennzeichnet sie als neu, sobald unter ihr abgestimmt werden soll', async () => {
		await zurAbstimmung(ausKenntnis, 'Bericht zum Heizungsersatz');
		await haltErfordernisAmTraktandumFest(handelnder(), zweite, ausKenntnis, EINFACHES_MEHR);
		const neue = await holeNeueTraktandenDerZweiten(betreiber, zweite);
		expect(neue.has(ausKenntnis)).toBe(true);
		// Die Gegenprobe: das übernommene Abstimmungsgeschäft bleibt übernommen.
		expect(neue.has(uebertragen)).toBe(false);
	});

	it('kennzeichnet auch eine von Hand übernommene Kenntnisnahme als neu, sobald unter ihr abgestimmt werden soll', async () => {
		// Der zweite Weg zur Kopie (`uebernimmTraktanden`, Seite «Übernehmen»):
		// Ohne `ausTraktandum` im Verlauf gälte die Kopie still als übernommen
		// wie vor F4c (Featureprüfung F4c, 06.11.2026, T1).
		expect(await uebernimmTraktanden(handelnder(), zweite, [quelleKenntnis])).toBe(1);
		const [kopie] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT a.id FROM agenda_item a
				WHERE a.meeting_id = ${zweite} AND a.title = 'Bericht zum Heizungsersatz' AND a.id <> ${ausKenntnis}
			`
		);
		expect(kopie).toBeTruthy();
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(kopie.id)).toBe(false);
		await zurAbstimmung(kopie.id, 'Bericht zum Heizungsersatz');
		await haltErfordernisAmTraktandumFest(handelnder(), zweite, kopie.id, EINFACHES_MEHR);
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(kopie.id)).toBe(true);
	});

	it('kennzeichnet ein Pflichttraktandum als neu, das an der ersten nur zur Kenntnisnahme stand', async () => {
		expect(vorlageKenntnis).toBeTruthy();
		await zurAbstimmung(vorlageKenntnis.id, vorlageKenntnis.title);
		expect((await holeNeueTraktandenDerZweiten(betreiber, zweite)).has(vorlageKenntnis.id)).toBe(true);
		// Die Pflichttraktanden, die an der ersten zur Abstimmung standen, bleiben übernommen.
		const neue = await holeNeueTraktandenDerZweiten(betreiber, zweite);
		for (const id of vorlage) expect(neue.has(id)).toBe(false);
	});
});

/*
 * **Die Leitung zeigt den Hinweis nur ohne das Quorum einer ersten**
 * (Fachprüfung 18.10.2026): Gegenprobe zur Bedingung `erreichtQuorumEinerErsten`.
 */
describe('Ä-17 B: Quorum einer ersten Versammlung', () => {
	it('ist ohne Anwesende nicht erreicht und mit beiden Eigentümern erreicht', async () => {
		await gibVersammlungFrei(handelnder(), zweite);
		await eroeffneVersammlung(handelnder(), zweite);
		// Die Leitung eines Hauses rechnet mit der schon geladenen Übersicht über
		// `quorumEinerErstenErreicht`. Geprüft ist die Funktion, nicht der Load:
		// Rechnete die Leitung wieder inline, bliebe diese Probe grün.
		const ueberLeitung = async () =>
			quorumEinerErstenErreicht(await holeUebersicht(betreiber, zweite), null);
		expect(await erreichtQuorumEinerErsten(betreiber, zweite)).toBe(false);
		expect(await ueberLeitung()).toBe(false);
		for (const p of parteienAlle) await bestaetigeAnwesenheit(handelnder(), zweite, p, 'von_hand');
		expect(await erreichtQuorumEinerErsten(betreiber, zweite)).toBe(true);
		expect(await ueberLeitung()).toBe(true);
	});
});

/*
 * **Der Satz im Hausprotokoll am echten Weg** (Featureprüfung 3b bis 3e): Die
 * Domäne war geprüft, die Verdrahtung in `server/protokoll.ts` nicht. Läuft
 * nur in der Reihenfolge der Datei: Der Quorumtest eröffnet die zweite und
 * setzt beide anwesend, «auch nach dem Bearbeiten» gibt dem übertragenen
 * Geschäft sein Erfordernis. Allein mit `-t` gefahren, wird sie rot.
 */
describe('Ä-17 B: Hausprotokoll', () => {
	it('nennt beim Beschluss über das neue Traktandum die Tatsache, beim übertragenen nicht', async () => {
		for (const id of [neu, uebertragen]) {
			await oeffneAbstimmung(handelnder(), zweite, id);
			await gibStimmenAb(
				handelnder(),
				zweite,
				parteienAlle.map((p) => ({ parteiId: p, wahl: 'yes' as const })),
				false
			);
			await schliesseAbstimmung(handelnder(), zweite);
		}
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, zweite, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		const abschnitt = (titel: string) =>
			new RegExp(`#### \\d+ ${titel} (.*?)(?= ####| ## |$)`).exec(entwurf)?.[1] ?? '';
		const satz = NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL.replace(/\s+/g, ' ');
		expect(abschnitt('Neue Heizung')).toMatch(/Angenommen/);
		expect(abschnitt('Neue Heizung')).toContain(satz);
		expect(abschnitt('Fassadensanierung')).toMatch(/Angenommen/);
		expect(abschnitt('Fassadensanierung')).not.toContain(satz);
	});
});
