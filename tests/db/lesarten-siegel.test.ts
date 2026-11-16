/**
 * Zwei Nachweise im Siegelpaket (Pendenzen Block 5, M3, und Block 6, Befund 6):
 *
 * - Die Zeile «Zählung an der Einsprache (Lesart L3)» steht im
 *   Entscheidungsweg, aber nur, wo L3 wirkt.
 * - `daten/abstimmungen.json` trägt das Ergebnis nach Gesetz und Reglement,
 *   wenn die Leitung vom Vorschlag abgewichen ist (Entscheid 0023).
 *
 * Beides war am Code gelesen, aber in keinem Paket nachgemessen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { speichereLesarten } from '$lib/server/lesarten';
import { holePaket, versiegle } from '$lib/server/siegel';
import { uebersteuere, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { entpacke } from './zip';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

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

const RW = holeRegelwerk();
const QUALIFIZIERT = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis;
const MILDER = uebersteuere(RW, QUALIFIZIERT, 'einfaches_mehr', 'Prüfung: bewusst milder').ergebnis;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesarten Siegel');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(verbindungenSchliessen);

/** Drei Parteien mit den angegebenen Quoten; p3 ist bei der Einsprache betroffen. */
async function haus(name: string, quoten: [number, number, number], headCountMode: 'per_owner' | 'per_unit') {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: quoten.reduce((a, b) => a + b, 0),
		headCountMode,
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, quote] of quoten.entries()) {
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
		datum: '2027-12-21',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return { gemeinschaft: g.id, versammlung: v.id, parteien };
}

describe('Die Siegelzeile zu L3 (Block 5, M3)', () => {
	it('steht im Entscheidungsweg, wo L3 wirkt, und nicht an der älteren Fassung', async () => {
		const h = await haus('Lesarten Siegel L3', [400, 300, 300], 'per_unit');
		await speichereLesarten(handelnder(), 'admin', h.gemeinschaft, { L3: 'je_einheit' });

		const neu = await erstelleTraktandum(handelnder(), {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Einsprache neu',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung erhebt Einsprache.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [h.parteien[2]]
		},
		// Entscheid 0050, Antwort 3: Betroffene nur mit einem Mehr, das sie kennt.
		'k-einsprache');
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, neu.id, EINSPRACHE);
		const alt = await erstelleTraktandum(handelnder(), {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Einsprache alt',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung erhebt Einsprache.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [h.parteien[2]]
		},
		'k-einsprache');
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, alt.id, {
			...EINSPRACHE,
			fassung: '2026-10-27'
		});

		await gibVersammlungFrei(handelnder(), h.versammlung);
		await eroeffneVersammlung(handelnder(), h.versammlung);
		for (const p of h.parteien) await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		for (const t of [neu, alt]) {
			await oeffneAbstimmung(handelnder(), h.versammlung, t.id);
			await gibStimmenAb(
				handelnder(),
				h.versammlung,
				h.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
				false
			);
			await schliesseAbstimmung(handelnder(), h.versammlung);
		}
		await schliesseVersammlung(handelnder(), h.versammlung);
		await versiegle(handelnder(), h.versammlung, '2027-12-21 21:30:00');

		const dateien = entpacke((await holePaket(betreiber, h.versammlung)) as Uint8Array);
		const weg = new TextDecoder().decode(dateien.get('Entscheidungsweg.txt') as Uint8Array);
		const zeile = 'Zählung an der Einsprache (Lesart L3): Eine Stimme je Einheit';
		expect(weg.split(zeile).length - 1).toBe(1);
		// Je Traktandum ein Abschnitt, Kopfzeile «<Nummer> <Titel>», getrennt
		// durch eine Leerzeile (`entscheidungsweg` in `server/siegel.ts`). Die
		// Zeile steht beim neuen Traktandum, nicht bei der älteren Fassung.
		const abschnitt = (titel: string) =>
			weg.split('\n\n').find((b) => b.split('\n')[0].endsWith(` ${titel}`));
		expect(abschnitt('Einsprache neu')).toContain(zeile);
		expect(abschnitt('Einsprache alt')).toBeDefined();
		expect(abschnitt('Einsprache alt')).not.toContain('Lesart L3');
	});
});

describe('Das Ergebnis nach Gesetz und Reglement im Siegelpaket (Block 6, Befund 6)', () => {
	it('reist in daten/abstimmungen.json mit', async () => {
		const h = await haus('Lesarten Siegel Gesetz', [200, 200, 600], 'per_owner');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: h.versammlung,
			parentId: null,
			titel: 'Erfundene Verwaltungshandlung',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung beschliesst die Handlung.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await haltErfordernisAmTraktandumFest(handelnder(), h.versammlung, t.id, MILDER);
		await gibVersammlungFrei(handelnder(), h.versammlung);
		await eroeffneVersammlung(handelnder(), h.versammlung);
		for (const p of h.parteien) await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		await oeffneAbstimmung(handelnder(), h.versammlung, t.id);
		await gibStimmenAb(
			handelnder(),
			h.versammlung,
			[
				{ parteiId: h.parteien[0], wahl: 'yes' as const },
				{ parteiId: h.parteien[1], wahl: 'yes' as const },
				{ parteiId: h.parteien[2], wahl: 'no' as const }
			],
			false
		);
		await schliesseAbstimmung(handelnder(), h.versammlung);
		await schliesseVersammlung(handelnder(), h.versammlung);
		await versiegle(handelnder(), h.versammlung, '2027-12-21 21:30:00');

		const dateien = entpacke((await holePaket(betreiber, h.versammlung)) as Uint8Array);
		const daten = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/abstimmungen.json') as Uint8Array)
		) as {
			auswertung: {
				zeilen: {
					titel: string;
					auszaehlung: { nachGesetzUndReglement: unknown } | null;
				}[];
			};
		};
		const zeile = daten.auswertung.zeilen.find((z) => z.titel === 'Erfundene Verwaltungshandlung');
		expect(zeile).toBeDefined();
		expect(zeile!.auszaehlung?.nachGesetzUndReglement).toMatchObject({
			kennung: 'A',
			feststellbar: true,
			angenommen: false,
			abweichend: true,
			quoten: { ja: 400, basis: 1000, schwelle: 501, erreicht: false }
		});
		// Und das Mass selbst steht daneben im Erfordernis (Anhang A).
		expect(zeile!.auszaehlung).toBeTruthy();
	});
});
