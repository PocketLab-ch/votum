/**
 * Die L5-Zeile im Protokoll beim Beschlussvermerk (Pendenzen Block 7): Dort
 * steht nur die Tatsache, nicht die Einstellung der Gemeinschaft. Den Zweig mit
 * `neuAnZweiterWahl: null` prüft `tests/domain/protokoll.test.ts`; hier läuft
 * der echte Weg vom Server bis in den Text.
 *
 * **Widerspruch und Weggang sind auf diesem Weg nicht erreichbar.** Beide
 * setzen eine unangekündigte Universalversammlung voraus (`unannounced_basis`
 * nur an einem spontanen neuen Traktandum), und ein solches ist für L5 nicht
 * neu (`neueTraktandenDerZweiten` nimmt Spontanes aus). Die Zeile kann dort
 * also nicht stehen; der Zweig ist trotzdem abgesichert, falls ein künftiger
 * Weg die beiden Lagen verbindet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	vertageVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { setzeBeschlussvermerk, setzeProtokollnotiz, stelleEntwurfZusammen } from '$lib/server/protokoll';
import { speichereLesarten } from '$lib/server/lesarten';
import { holePaket, versiegle } from '$lib/server/siegel';
import { NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL } from '$lib/domain/mehrhinweise';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { entpacke } from './zip';
import { pruefbetreiber, verbindungenSchliessen } from './helfer';

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
	zweite: string;
	neu: string;
	parteien: string[];
}

/**
 * Erste Versammlung mit einem offenen Geschäft, Vertagung, zweite mit einem
 * neuen Traktandum; L5 steht auf der milden Wahl `drittel`.
 */
async function kette(name: string, datum: string): Promise<Kette> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, quote] of [200, 200, 200, 200, 100, 100].entries()) {
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
		datum,
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
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
	// Damit der Widerspruch und der Weggang als Universalversammlung zählen.
	await speichereAusnahmen(handelnder(), g.id, { universalvariante: 'persoenlich' });
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	await bestaetigeAnwesenheit(handelnder(), v.id, parteien[0], 'von_hand');
	const { folge } = await vertageVersammlung(handelnder(), v.id, { grund: 'nicht beschlussfähig' });
	const neu = await erstelleTraktandum(handelnder(), {
		meetingId: folge.id,
		parentId: null,
		titel: 'Neue Heizung',
		art: 'abstimmung',
		antragswortlaut: 'Eine neue Heizung wird eingebaut.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), folge.id, neu.id, EINFACHES_MEHR);
	await speichereLesarten(handelnder(), 'admin', g.id, { L5: 'drittel' });
	await gibVersammlungFrei(handelnder(), folge.id);
	await eroeffneVersammlung(handelnder(), folge.id);
	return { zweite: folge.id, neu: neu.id, parteien };
}

async function protokoll(meetingId: string) {
	return (await stelleEntwurfZusammen(betreiber, meetingId, new Date().toISOString(), 'Prüflauf')).replace(
		/\s+/g,
		' '
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L5 Protokoll');
}, 120_000);

afterAll(verbindungenSchliessen);

describe('Nur die Tatsache beim Beschlussvermerk', () => {
	it('Beschlussvermerk: der Beschluss im Votentext nennt keine Wahl', async () => {
		const k = await kette('Erfundenweg 21', '2026-06-01');
		await schliesseVersammlung(handelnder(), k.zweite);
		await setzeProtokollnotiz(handelnder(), k.zweite, k.neu, 'Die Versammlung hat die Heizung beschlossen.');
		await setzeBeschlussvermerk(handelnder(), k.zweite, k.neu, true);

		const text = await protokoll(k.zweite);
		expect(text).toContain(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
		expect(text).not.toContain('Nach der Einstellung der Gemeinschaft');
		expect(text).not.toContain('Abgestimmt wurde mit der Beschlussfähigkeit der zweiten');
	});

});

/**
 * Die Zeile zu L5 im Entscheidungsweg des Siegelpakets (Pendenz aus Block 7,
 * Codeprüfung N3): Der Nachweis nannte L1 und L3, nicht L5. Sie steht beim
 * neuen Traktandum, nicht beim übertragenen.
 */
describe('Die Siegelzeile zu L5', () => {
	it('steht im Entscheidungsweg beim neuen Traktandum, mit der Wahl der Gemeinschaft', async () => {
		const k = await kette('Erfundenweg 23', '2026-06-03');
		await schliesseVersammlung(handelnder(), k.zweite);
		await versiegle(handelnder(), k.zweite, '2026-06-20 21:30:00');
		const dateien = entpacke((await holePaket(betreiber, k.zweite)) as Uint8Array);
		const weg = new TextDecoder().decode(dateien.get('Entscheidungsweg.txt') as Uint8Array);
		const abschnitt = (titel: string) =>
			weg.split('\n\n').find((b) => b.split('\n')[0].endsWith(` ${titel}`));
		const zeile = `${NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL} Lesart L5: Ein Drittel genügt.`;
		expect(abschnitt('Neue Heizung')).toContain(zeile);
		expect(abschnitt('Fassadensanierung')).toBeDefined();
		expect(abschnitt('Fassadensanierung')).not.toContain('Lesart L5');
	});
});
