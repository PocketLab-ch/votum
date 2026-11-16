/**
 * Lesart L15 am echten Weg (Migration 194, Entscheid 0054 Punkte 2 und 6):
 * Zählt die Stimmführung einer Mitberechtigten für die eigene gemeinsame
 * Partei zur Höchstzahl der Vollmachten?
 *
 * Die Domänenprobe misst `zaehltZurHoechstzahl`; diese misst die Sperre in
 * `verlangeVollmachtsgrenze`, an beiden Stellen, an denen die Wahl wirkt: an
 * der neuen Vollmacht und an der Abfrage über den Bestand. Dazu, dass die Wahl
 * mit der Freigabe einfriert und Organvertretung in beiden Wahlen ausserhalb
 * bleibt.
 *
 * **Aufbau** wie «Mitberechtigte» in `vollmacht.test.ts`: vier Parteien mit je
 * einer Wohnung, dazu Whg 5 an der gemeinschaftlichen Zeile «Erfunden Anna und
 * Erfunden Beat» mit beiden als Mitberechtigten. Vertritt Erfunden Anna diese
 * Zeile, leitet `erfasseInTx` den Grund `mitberechtigt` her.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erfasseVollmacht, holeParteien, holeVollmachten } from '$lib/server/vollmacht';
import { nimmMitberechtigtenAuf } from '$lib/server/mitberechtigte';
import { holeLesarten, speichereLesarten } from '$lib/server/lesarten';
import type { Stimmfuehrungswahl } from '$lib/domain/lesarten';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
const handelnder = () => ({ operatorId: betreiber, userId: null, label: 'Prüflauf' });

const HUELLE = 'Erfunden Anna und Erfunden Beat';
const STIMMFUEHRUNGSSATZ =
	/Nach der Einstellung Ihrer Gemeinschaft zählt dabei die Stimme mit, die die Person als Mitberechtigte/;

/**
 * Gemeinschaft mit Höchstzahl und gemeinschaftlicher Zeile, Versammlung
 * freigegeben und eröffnet. `wahl` wird vor der Freigabe gesetzt; `null`
 * lässt die Vorgabe stehen.
 */
async function aufbau(name: string, datum: string, hoechstzahl: number, wahl: Stimmfuehrungswahl | null) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const ids = new Map<string, string>();
	for (const [i, wer] of ['Erfunden Anna', 'Erfunden Beat', 'Erfunden Cla', 'Erfunden Dora'].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 200 },
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
		ids.set(wer, p.id);
	}
	const whg5 = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 5',
		quotas: { stamm: 200 },
		countsAsHead: true
	});
	const huelle = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: HUELLE,
		isCommunity: true,
		representativeName: 'Erfunden Anna'
	});
	await ordneEigentumZu(handelnder(), whg5.id, huelle.id, '2020-01-01');
	await nimmMitberechtigtenAuf(handelnder(), huelle.id, ids.get('Erfunden Anna')!);
	await nimmMitberechtigtenAuf(handelnder(), huelle.id, ids.get('Erfunden Beat')!);
	await imKontext(
		betreiber,
		(tx) => tx`
			UPDATE stweg SET proxy_limit = ${hoechstzahl},
			                 proxy_limit_rule_source = 'Reglement Ziff. 8.2'
			WHERE id = ${g.id}
		`
	);
	if (wahl !== null) await speichereLesarten(handelnder(), 'admin', g.id, { L15: wahl });
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	const momentparteien = await holeParteien(betreiber, v.id);
	const nach = (wer: string) => momentparteien.find((p) => p.name === wer)!;

	/** Vertretung durch Erfunden Anna, ohne gewählten Grund. */
	const durchAnna = (vertreten: string, vertretungsgrund: 'organ' | null = null) =>
		erfasseVollmacht(handelnder(), v.id, {
			vertreteneId: nach(vertreten).id,
			bevollmaechtigtId: nach('Erfunden Anna').id,
			vertretungsgrund
		});
	return { stweg: g.id, versammlung: v.id, nach, durchAnna };
}

/** Kennung und Satz der Absage, oder `null`, wenn es keine gab. */
async function absage(f: Promise<unknown>): Promise<{ kennung: string | undefined; satz: string } | null> {
	try {
		await f;
		return null;
	} catch (e) {
		return { kennung: (e as { kennung?: string }).kennung, satz: (e as Error).message };
	}
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L15');
});

afterAll(verbindungenSchliessen);

describe('L15: Vorgabe', () => {
	it('steht ohne Einstellung auf «ausserhalb», in der Gemeinschaft und in der Momentaufnahme', async () => {
		const a = await aufbau('Erfundenweg 151', '2027-12-01', 1, null);
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ reading_l15: string }[]>`SELECT reading_l15 FROM stweg WHERE id = ${a.stweg}`
		);
		expect(z.reading_l15).toBe('ausserhalb');
		expect((await holeLesarten(betreiber, { stwegId: a.stweg })).L15).toBe('ausserhalb');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L15).toBe('ausserhalb');
	});

	it('lässt unter der Vorgabe die Stimmführung neben einer Vollmacht über der Zahl durch', async () => {
		const a = await aufbau('Erfundenweg 152', '2027-12-02', 1, null);
		await a.durchAnna(HUELLE);
		await a.durchAnna('Erfunden Cla');
		const alle = await holeVollmachten(betreiber, a.versammlung);
		expect(alle).toHaveLength(2);
		// Der Grund ist hergeleitet, nicht gewählt: Sonst prüfte der Fall nichts.
		expect(alle.find((v) => v.vertreteneName === HUELLE)?.vertretungsgrund).toBe('mitberechtigt');
	});
});

describe('L15 «ausserhalb»: Die Stimmführung zählt nicht zur Höchstzahl', () => {
	it('zählt die Stimmführung im Bestand nicht mit', async () => {
		const a = await aufbau('Erfundenweg 153', '2027-12-03', 1, 'ausserhalb');
		await a.durchAnna(HUELLE);
		await a.durchAnna('Erfunden Cla');
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(2);
	});

	it('zählt die neue Stimmführung nicht mit', async () => {
		const a = await aufbau('Erfundenweg 154', '2027-12-04', 1, 'ausserhalb');
		await a.durchAnna('Erfunden Cla');
		await a.durchAnna(HUELLE);
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(2);
	});
});

describe('L15 «mitzaehlen»: Die Stimmführung zählt zur Höchstzahl', () => {
	it('weist die Vollmacht über der Zahl ab, wenn die Stimmführung im Bestand steht, und nennt sie', async () => {
		const a = await aufbau('Erfundenweg 155', '2027-12-05', 1, 'mitzaehlen');
		await a.durchAnna(HUELLE);
		const f = await absage(a.durchAnna('Erfunden Cla'));
		expect(f?.kennung).toBe('vollmachtsgrenze');
		expect(f?.satz).toMatch(/wäre die 2\. für Erfunden Anna.*Reglement Ziff\. 8\.2/s);
		expect(f?.satz).toMatch(STIMMFUEHRUNGSSATZ);
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(1);
	});

	it('weist die neue Stimmführung über der Zahl ab und nennt sie', async () => {
		const a = await aufbau('Erfundenweg 156', '2027-12-06', 1, 'mitzaehlen');
		await a.durchAnna('Erfunden Cla');
		const f = await absage(a.durchAnna(HUELLE));
		expect(f?.kennung).toBe('vollmachtsgrenze');
		expect(f?.satz).toMatch(/wäre die 2\. für Erfunden Anna/);
		expect(f?.satz).toMatch(STIMMFUEHRUNGSSATZ);
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(1);
	});

	it('zählt bei Höchstzahl 2 die Stimmführung als eine von zweien', async () => {
		const a = await aufbau('Erfundenweg 157', '2027-12-07', 2, 'mitzaehlen');
		await a.durchAnna(HUELLE);
		await a.durchAnna('Erfunden Cla');
		const f = await absage(a.durchAnna('Erfunden Dora'));
		expect(f?.kennung).toBe('vollmachtsgrenze');
		expect(f?.satz).toMatch(/wäre die 3\. für Erfunden Anna/);
		expect(f?.satz).toMatch(STIMMFUEHRUNGSSATZ);
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(2);
	});

	it('nennt die Stimmführung nicht, wo nur gewöhnliche Vollmachten gezählt sind', async () => {
		const a = await aufbau('Erfundenweg 158', '2027-12-08', 1, 'mitzaehlen');
		await a.durchAnna('Erfunden Cla');
		const f = await absage(a.durchAnna('Erfunden Dora'));
		expect(f?.kennung).toBe('vollmachtsgrenze');
		expect(f?.satz).not.toMatch(STIMMFUEHRUNGSSATZ);
	});

	it('zählt eine neue Organvertretung weiterhin nicht mit', async () => {
		const a = await aufbau('Erfundenweg 159', '2027-12-09', 1, 'mitzaehlen');
		await a.durchAnna('Erfunden Cla');
		await a.durchAnna('Erfunden Dora', 'organ');
		const alle = await holeVollmachten(betreiber, a.versammlung);
		expect(alle).toHaveLength(2);
		expect(alle.find((v) => v.vertreteneName === 'Erfunden Dora')?.vertretungsgrund).toBe('organ');
	});

	it('zählt eine Organvertretung im Bestand weiterhin nicht mit', async () => {
		const a = await aufbau('Erfundenweg 160', '2027-12-10', 1, 'mitzaehlen');
		await a.durchAnna('Erfunden Dora', 'organ');
		await a.durchAnna('Erfunden Cla');
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(2);
	});
});

describe('L15 friert mit der Freigabe ein', () => {
	it('bleibt nach «ausserhalb» bei der Freigabe offen, auch wenn die Gemeinschaft danach umstellt', async () => {
		const a = await aufbau('Erfundenweg 161', '2027-12-11', 1, 'ausserhalb');
		await speichereLesarten(handelnder(), 'admin', a.stweg, { L15: 'mitzaehlen' });
		expect((await holeLesarten(betreiber, { stwegId: a.stweg })).L15).toBe('mitzaehlen');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L15).toBe('ausserhalb');
		await a.durchAnna(HUELLE);
		await a.durchAnna('Erfunden Cla');
		expect(await holeVollmachten(betreiber, a.versammlung)).toHaveLength(2);
	});

	it('sperrt nach «mitzaehlen» bei der Freigabe weiter, auch wenn die Gemeinschaft danach umstellt', async () => {
		const a = await aufbau('Erfundenweg 162', '2027-12-12', 1, 'mitzaehlen');
		await speichereLesarten(handelnder(), 'admin', a.stweg, { L15: 'ausserhalb' });
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L15).toBe('mitzaehlen');
		await a.durchAnna(HUELLE);
		const f = await absage(a.durchAnna('Erfunden Cla'));
		expect(f?.kennung).toBe('vollmachtsgrenze');
		expect(f?.satz).toMatch(STIMMFUEHRUNGSSATZ);
	});
});
