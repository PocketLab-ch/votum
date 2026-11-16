/**
 * Die Traktandenseite vor der Freigabe: Sie liest die Lesarten der
 * Gemeinschaft, nicht die Vorgabe am noch nicht nachgezogenen Erfordernis.
 *
 * **Zwei Lücken aus den Pendenzen:** Block 2, N5 (L1 an `lesartKartensatz`)
 * und Block 5, M2 (L3 an `mehrhinweise`). Beide Loader-Übergaben waren nur am
 * Code gelesen; ohne sie zeigte die Seite die Vorgabe, und kein Test wurde rot.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest, setzeGewaehltesErfordernis } from '$lib/server/traktanden';
import { speichereLesarten } from '$lib/server/lesarten';
import { ausstandslesartKartensatz, einsprachelesartKartensatz } from '$lib/domain/lesarten';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { load as traktandenLoad } from '../../src/routes/versammlungen/[id=kennung]/traktanden/+page.server';
import type { PageData as Traktandendaten } from '../../src/routes/versammlungen/[id=kennung]/traktanden/$types';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const QUALIFIZIERTES_MEHR: Erfordernis = {
	fassung: '2026-10-29',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-wichtig',
	typ: 'qualifiziertes_mehr',
	titel: 'Wichtigere Verwaltungshandlung',
	rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

const EINSPRACHE: Erfordernis = {
	fassung: '2026-10-28',
	juristischGegengelesen: false,
	astId: 'a-sonderfaelle',
	knotenId: 'k-einsprache',
	typ: 'einfaches_mehr',
	titel: 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht',
	rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesarten Traktandenseite');
	benutzer = await pruefbenutzer(betreiber, 'lesarten-traktandenseite');
});
afterAll(verbindungenSchliessen);

function anfrage(id: string) {
	return {
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-lesarten-traktandenseite',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id },
		url: new URL('http://pruefung.example/lesarten')
	} as never;
}

async function traktandenseite(id: string) {
	return (await traktandenLoad(anfrage(id))) as unknown as Traktandendaten;
}

/** Eine Gemeinschaft mit drei Parteien zu je einer Einheit. */
async function haus(name: string, headCountMode: 'per_owner' | 'per_unit') {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode,
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
		datum: '2027-12-20',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return { gemeinschaft: g.id, versammlung: v.id, parteien };
}

describe('L1 vor der Freigabe (Block 2, N5)', () => {
	it('gibt die Wahl der Gemeinschaft an lesartKartensatz', async () => {
		const h = await haus('Lesarten L1 Traktandenseite', 'per_owner');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Dachsanierung',
			art: 'abstimmung',
			antragswortlaut: 'Das Dach wird saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(
			handelnder(),
			h.versammlung,
			t.id,
			QUALIFIZIERTES_MEHR
		);
		// Erst danach umstellen: Der Auslöser hat am Traktandum noch «bleibt»
		// eingefroren; der Loader muss die neue Wahl der Gemeinschaft lesen.
		await speichereLesarten(handelnder(), 'admin', h.gemeinschaft, { L1: 'faellt_heraus' });

		const d = await traktandenseite(h.versammlung);
		const zeile = d.traktanden.find((x) => x.knoten.id === t.id);
		expect(zeile).toBeDefined();
		expect(zeile!.mehrhinweise.join(' ')).toContain(ausstandslesartKartensatz('faellt_heraus'));
	});
});

describe('L3 vor der Freigabe (Block 5, M2)', () => {
	it('gibt die Wahl der Gemeinschaft an mehrhinweise', async () => {
		const h = await haus('Lesarten L3 Traktandenseite', 'per_unit');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Einsprache gegen die Vermietung',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung erhebt Einsprache.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [h.parteien[2]]
		},
		// Entscheid 0050, Antwort 3: Betroffene nur mit einem Mehr, das sie kennt.
		'k-einsprache');
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, t.id, EINSPRACHE);
		// Wie bei L1: Die Umstellung nach dem Erfordernis bleibt am Traktandum
		// stehen, bis die Freigabe sie nachführt; der Loader liest die Gemeinschaft.
		await speichereLesarten(handelnder(), 'admin', h.gemeinschaft, { L3: 'je_einheit' });

		const d = await traktandenseite(h.versammlung);
		const zeile = d.traktanden.find((x) => x.knoten.id === t.id);
		expect(zeile).toBeDefined();
		expect(zeile!.mehrhinweise.join(' ')).toContain(einsprachelesartKartensatz('je_einheit'));
	});
});

/*
 * **L13 vor der Freigabe** (Featureprüfung Regel 43 Runde 2, Befund M1; Code-
 * prüfung Block C, N2 und N-A): Unter L4 «einfach» wirkt L13 am gerechneten
 * Mehr nicht, am anderen schon. Stellt die Gemeinschaft nach dem Erfordernis
 * auf «Alle Eigentümer» um, nennt die Seite das zweite Ergebnis nach der neuen
 * Wahl; ohne den dritten Parameter an `lesartKartensatz` nennte sie die alte.
 */
describe('L13 vor der Freigabe (Block C, N2 und N-A)', () => {
	it('gibt die Wahl der Gemeinschaft an lesartKartensatz', async () => {
		const h = await haus('Lesarten L13 Traktandenseite', 'per_owner');
		await speichereLesarten(handelnder(), 'admin', h.gemeinschaft, { L4: 'einfach' });
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Neue Bewirtschaftung',
			art: 'abstimmung',
			antragswortlaut: 'Die Bewirtschaftung Beispiel Verwaltungen wird gewählt.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await setzeGewaehltesErfordernis(
			handelnder(),
			{ meetingId: h.versammlung, stwegId: h.gemeinschaft },
			t.id,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		const ZWEITES = 'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern';
		const vorher = (await traktandenseite(h.versammlung)).traktanden.find((x) => x.knoten.id === t.id);
		expect(vorher!.mehrhinweise.join(' ')).not.toContain(ZWEITES);

		await speichereLesarten(handelnder(), 'admin', h.gemeinschaft, { L13: 'alle' });
		const d = await traktandenseite(h.versammlung);
		const zeile = d.traktanden.find((x) => x.knoten.id === t.id);
		expect(zeile).toBeDefined();
		expect(zeile!.mehrhinweise.join(' ')).toContain(ZWEITES);
	});
});
