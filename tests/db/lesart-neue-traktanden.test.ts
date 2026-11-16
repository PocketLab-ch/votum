/**
 * Lesart L5 am echten Weg (Migration 174, Konzept Lesarten Block 7): Nach der
 * Vorgabe öffnet eine Abstimmung über ein neues Traktandum an der zweiten
 * Versammlung nur mit der Beschlussfähigkeit einer ersten; nach der milden
 * Wahl genügt das Drittel wie bisher (Entscheid 0012).
 *
 * **Die Lage:** sechs Eigentümer, zwei da. Das Drittel der zweiten
 * Versammlung ist erreicht (zwei von sechs, mindestens zwei), die Hälfte
 * einer ersten nicht (drei von sechs, 500 von 1000 Wertquoten). Ein Geschäft
 * ist beim Vertagen übertragen, eines an der zweiten neu angelegt.
 *
 * Läuft in der Reihenfolge der Datei: Jeder Fall schliesst seinen Durchgang,
 * weil je Versammlung nur einer offen sein darf.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, eroeffneVersammlung, vertageVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	gibStimmenAb,
	haltBeschlussVonHandFest,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { holeLesarten, speichereLesarten } from '$lib/server/lesarten';
import { holeNeutraktandenfussnote } from '$lib/server/neutraktanden';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { neuAnZweiterAnfechtungssatz } from '$lib/domain/protokoll';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { KONSULTATIV_OFFEN_NEU } from '$lib/domain/konsultativ';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { neuAnZweiterProtokoll } from '$lib/domain/mehrhinweise';
import { NEUTRAKTANDUM_ZEICHEN } from '$lib/domain/einladung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Neutraktandenwahl } from '$lib/domain/lesarten';
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

interface Kette {
	gemeinschaft: string;
	zweite: string;
	uebertragen: string;
	neu: string;
	/** Ein zweites neues Traktandum, über das abgestimmt wird, wenn der Notweg das erste entschieden hat. */
	neu2: string;
	parteien: string[];
}

/**
 * Gemeinschaft, erste Versammlung, Vertagung, zweite mit einem übertragenen
 * und einem neuen Geschäft; `wahl` wird vor der Freigabe der zweiten gesetzt.
 */
async function kette(name: string, wahl: Neutraktandenwahl): Promise<Kette> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, quote] of [200, 200, 150, 150, 150, 150].entries()) {
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
	const traktandum = (meetingId: string, titel: string) =>
		erstelleTraktandum(handelnder(), {
			meetingId,
			parentId: null,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel} wird beschlossen.`,
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-05-20',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const offen = await traktandum(v.id, 'Fassadensanierung');
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, offen.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	await bestaetigeAnwesenheit(handelnder(), v.id, parteien[0], 'von_hand');
	const { folge } = await vertageVersammlung(handelnder(), v.id, { grund: 'nicht beschlussfähig' });

	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${folge.id} AND title = 'Fassadensanierung'
		`
	);
	const neu = await traktandum(folge.id, 'Neue Heizung');
	await haltErfordernisAmTraktandumFest(handelnder(), folge.id, neu.id, EINFACHES_MEHR);
	const neu2 = await traktandum(folge.id, 'Neuer Veloraum');
	await haltErfordernisAmTraktandumFest(handelnder(), folge.id, neu2.id, EINFACHES_MEHR);

	await speichereLesarten(handelnder(), 'admin', g.id, { L5: wahl });
	await gibVersammlungFrei(handelnder(), folge.id);
	await eroeffneVersammlung(handelnder(), folge.id);
	for (const p of parteien.slice(0, 2)) await bestaetigeAnwesenheit(handelnder(), folge.id, p, 'von_hand');
	return { gemeinschaft: g.id, zweite: folge.id, uebertragen: z.id, neu: neu.id, neu2: neu2.id, parteien };
}

/** Abstimmen mit den zwei Anwesenden und schliessen. */
async function abstimmenUndSchliessen(k: Kette): Promise<void> {
	await gibStimmenAb(
		handelnder(),
		k.zweite,
		k.parteien.slice(0, 2).map((p) => ({ parteiId: p, wahl: 'yes' as const })),
		false
	);
	await schliesseAbstimmung(handelnder(), k.zweite);
}

async function kennungDerAbsage(f: Promise<unknown>): Promise<string | null> {
	try {
		await f;
		return null;
	} catch (e) {
		return (e as { kennung?: string }).kennung ?? String(e);
	}
}

let streng: Kette;
let mild: Kette;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L5');
	streng = await kette('Erfundenweg 15', 'erste');
	mild = await kette('Erfundenweg 16', 'drittel');
}, 120_000);

afterAll(verbindungenSchliessen);

describe('L5 nach der Vorgabe: Beschlussfähigkeit einer ersten Versammlung', () => {
	it('friert die Wahl bei der Freigabe ein', async () => {
		expect((await holeLesarten(betreiber, { meetingId: streng.zweite })).L5).toBe('erste');
		expect((await holeLesarten(betreiber, { meetingId: mild.zweite })).L5).toBe('drittel');
	});

	it('sperrt das Eröffnen über das neue Traktandum mit eigener Absage', async () => {
		const absage = oeffneAbstimmung(handelnder(), streng.zweite, streng.neu);
		await expect(absage).rejects.toThrow(/in der Einladung zur ersten Versammlung nicht zur Abstimmung/);
		expect(await kennungDerAbsage(oeffneAbstimmung(handelnder(), streng.zweite, streng.neu))).toBe(
			'neues_traktandum_gesperrt'
		);
	});

	// Gegenprobe: Die Sperre trifft nur das neue Traktandum.
	it('lässt das übertragene Geschäft mit dem Drittel abstimmen', async () => {
		await oeffneAbstimmung(handelnder(), streng.zweite, streng.uebertragen);
		await abstimmenUndSchliessen(streng);
	});

	it('lässt über das gesperrte Traktandum unverbindlich abstimmen (Entscheid 22.10.2026, Frage 1)', async () => {
		await oeffneAbstimmung(handelnder(), streng.zweite, streng.neu, { konsultativ: true });
		// Die Leinwand nennt den Grund nach L5, nicht «nicht beschlussfähig»
		// (Codeprüfung Block 7, R2-M1), solange abgestimmt wird.
		const stand = await ermittleStand(betreiber, streng.zweite);
		expect(stand?.abstimmung?.konsultativSatz).toBe(KONSULTATIV_OFFEN_NEU);
		await abstimmenUndSchliessen(streng);
		// Der Verlauf beim Eröffnen und beim Verkünden mit eigenem Vermerk (R2-N2, R3-N1).
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ event_type: string; detail: Record<string, unknown> }[]>`
				SELECT event_type, detail FROM audit_entry
				 WHERE subject_type = 'meeting' AND subject_id = ${streng.zweite}
				   AND event_type IN (${EREIGNISARTEN.abstimmungEroeffnet}, ${EREIGNISARTEN.ergebnisFreigegeben})
				   AND detail->>'traktandum' = 'Neue Heizung'
			`
		);
		expect(eintraege.length).toBe(2);
		for (const e of eintraege) {
			expect(e.detail.konsultativNachL5).toBe(true);
			expect(e.detail.konsultativ).toBeUndefined();
		}
	});

	it('ändert die Sperre nicht, wenn die Gemeinschaft nach der Freigabe umstellt', async () => {
		await speichereLesarten(handelnder(), 'admin', streng.gemeinschaft, { L5: 'drittel' });
		try {
			expect(await kennungDerAbsage(oeffneAbstimmung(handelnder(), streng.zweite, streng.neu))).toBe(
				'neues_traktandum_gesperrt'
			);
			// Auch die Fussnote der Einladung bleibt (Featureprüfung Lesarten, 22.10.2026).
			expect(await holeNeutraktandenfussnote(betreiber, streng.zweite)).not.toBeNull();
		} finally {
			await speichereLesarten(handelnder(), 'admin', streng.gemeinschaft, { L5: 'erste' });
		}
	});

	it('nennt die Sperre im Notweg unter «übergangen»', async () => {
		const { uebergangen } = await haltBeschlussVonHandFest(handelnder(), streng.zweite, streng.neu, {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'parteien',
				stimmen: streng.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
			}
		});
		expect(uebergangen.map((u) => u.kennung)).toContain('neues_traktandum_gesperrt');
		expect(uebergangen.map((u) => u.kennung)).not.toContain('nicht_beschlussfaehig');
	});

	it('öffnet, sobald die Beschlussfähigkeit einer ersten erreicht ist', async () => {
		await bestaetigeAnwesenheit(handelnder(), streng.zweite, streng.parteien[2], 'von_hand');
		// Drei von sechs mit 550 von 1000 Wertquoten (200 + 200 + 150): die Hälfte einer ersten.
		await oeffneAbstimmung(handelnder(), streng.zweite, streng.neu2);
		await gibStimmenAb(
			handelnder(),
			streng.zweite,
			streng.parteien.slice(0, 3).map((p) => ({ parteiId: p, wahl: 'yes' as const })),
			false
		);
		await schliesseAbstimmung(handelnder(), streng.zweite);
	});

	it('nennt im Protokoll beim neuen Beschluss die Lesart', async () => {
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, streng.zweite, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		// Abgestimmt mit der Hälfte (Neuer Veloraum), und von Hand trotz Sperre
		// festgehalten (Neue Heizung): Das Protokoll unterscheidet die zwei
		// (Fachprüfung Block 7, F7-5).
		expect(entwurf).toContain(neuAnZweiterProtokoll('erste', false).replace(/\s+/g, ' '));
		expect(entwurf).toContain(neuAnZweiterProtokoll('erste', true).replace(/\s+/g, ' '));
		// Nach dem Beschluss von Hand, angenommen: wer anfechten kann (Laienprüfung L7-12).
		expect(entwurf).toContain(neuAnZweiterAnfechtungssatz(true).replace(/\s+/g, ' '));
		// Produktentscheid 30.09.2026: kein «von Hand» im Protokoll (Review DeepSeek, Befund 3).
		expect(entwurf).not.toContain('von Hand festgehalten');
		// Der frühere konsultative Durchgang nennt seinen Grund (Codeprüfung
		// Block 7, H1): beschlussfähig, nur nicht wie eine erste.
		expect(entwurf).toContain(
			'konsultativ abgestimmt, weil das Traktandum in der Einladung zur ersten Versammlung nicht zur Abstimmung stand'
		);
		expect(entwurf).not.toContain('weil die Versammlung nicht beschlussfähig war;');
	});

	it('liefert für Einladung und Liste das Zeichen am neuen Traktandum und die Fussnote', async () => {
		const f = await holeNeutraktandenfussnote(betreiber, streng.zweite);
		expect(f).not.toBeNull();
		expect([...f!.traktanden].sort()).toEqual([streng.neu, streng.neu2].sort());
		expect(f!.satz.startsWith(NEUTRAKTANDUM_ZEICHEN)).toBe(true);
		expect(f!.satz).toMatch(/die Hälfte der Eigentümer/);
	});
});

describe('L5 nach der milden Wahl: das Drittel genügt', () => {
	it('öffnet über das neue Traktandum mit dem Drittel', async () => {
		await oeffneAbstimmung(handelnder(), mild.zweite, mild.neu);
		await abstimmenUndSchliessen(mild);
	});

	it('nennt im Protokoll die milde Wahl', async () => {
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, mild.zweite, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		// Zwei von sechs da: die Beschlussfähigkeit einer ersten fehlte.
		expect(entwurf).toContain(neuAnZweiterProtokoll('drittel', true).replace(/\s+/g, ' '));
		// Gegenprobe (Codeprüfung Block 7, H2): Zwei von sechs da, gezählt und
		// angenommen; nach der milden Wahl weder «nicht wie eine erste» noch «von Hand».
		expect(entwurf).not.toContain('das war sie bei diesem Beschluss nicht');
		expect(entwurf).not.toContain('von Hand festgehalten');
		expect(entwurf).not.toContain(neuAnZweiterAnfechtungssatz(false).replace(/\s+/g, ' '));
	});

	it('trägt keine Fussnote in Einladung und Liste', async () => {
		expect(await holeNeutraktandenfussnote(betreiber, mild.zweite)).toBeNull();
	});

	// Kriterium 3 an Fussnote und Protokoll (Featureprüfung Lesarten, 22.10.2026).
	it('eine Umstellung nach der Freigabe ändert weder Fussnote noch Protokoll', async () => {
		await speichereLesarten(handelnder(), 'admin', mild.gemeinschaft, { L5: 'erste' });
		try {
			expect(await holeNeutraktandenfussnote(betreiber, mild.zweite)).toBeNull();
			const entwurf = (
				await stelleEntwurfZusammen(betreiber, mild.zweite, new Date().toISOString(), 'Prüflauf')
			).replace(/\s+/g, ' ');
			expect(entwurf).toContain(neuAnZweiterProtokoll('drittel', true).replace(/\s+/g, ' '));
			expect(entwurf).not.toContain(neuAnZweiterProtokoll('erste', true).replace(/\s+/g, ' '));
		} finally {
			await speichereLesarten(handelnder(), 'admin', mild.gemeinschaft, { L5: 'drittel' });
		}
	});
});

describe('Der Verlauf hält die L5-Umstellung in Worten fest', () => {
	it('nennt Vorzustand, neuen Wert und die Rolle', async () => {
		const g = await erstelleGemeinschaft(handelnder(), {
			name: 'Lesart L5 Verlauf',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await speichereLesarten(handelnder(), 'admin', g.id, { L5: 'drittel' });
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.lesartGesetzt} AND detail->>'lesart' = 'L5'
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L5',
			vorher: 'Nur wie an einer ersten Versammlung (Vorgabe)',
			nachher: 'Ein Drittel genügt',
			rolle: 'admin'
		});
	});
});

describe('Migration 174', () => {
	it('setzt für neue Momentaufnahmen die Vorgabe als Spaltenvorgabe', async () => {
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ column_default: string }[]>`
				SELECT column_default FROM information_schema.columns
				 WHERE table_name = 'snapshot' AND column_name = 'reading_l5'
			`
		);
		expect(z.column_default).toMatch(/'erste'/);
	});
});
