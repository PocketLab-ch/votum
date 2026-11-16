/**
 * Kein Verlaufseintrag über einen fremden Gegenstand (Klasse K2).
 *
 * **Der Befund (`e2e/fremdbetreiber.mjs`, 27.10.2026, am gebauten Stand).**
 * Vier Aktionen schrieben unter Betreiber A einen Verlaufseintrag, dessen
 * Gegenstand B gehört: Ihre Abfragen trafen unter dem Zeilenschutz keine
 * Zeile, der Verlauf schrieb trotzdem, und erst die Seite danach sagte mit
 * 404 ab. Der Verlauf ist nur anfügbar; ein solcher Eintrag bleibt.
 * `setzePruefungZurueck` hatte dasselbe Muster, ohne dass der Durchstich es
 * erreichte.
 *
 * **Gegen die Funktionen, nicht die Aktionen:** Die Abwehr sitzt in der
 * Funktion, und jede der Aktionen darüber fängt die fachliche Absage schon.
 * Gemessen wird die Wirkung in der Datenbank, nicht nur die Ausnahme.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmAusTag } from '$lib/server/versammlungstag';
import { verschiebeGeschaeft } from '$lib/server/geschaeft';
import { setzePruefungZurueck, vermerkePruefung } from '$lib/server/reglement';
import { speichereTraktandenordnung } from '$lib/server/traktandenordnung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let gemeinschaftA: string;
let gemeinschaftB: string;
let versammlungB: string;
let abendB: string;

function handelnderA() {
	return { operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' };
}

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf Verlauf fremd A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-verlauf-a');
	const betreiberB = await pruefbetreiber('Prüflauf Verlauf fremd B');
	const benutzerB = await pruefbenutzer(betreiberB, 'pruefer-verlauf-b');
	const handelnderB = { operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' };

	gemeinschaftA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Eigenweg 5' })).id;
	gemeinschaftB = (await erstelleGemeinschaft(handelnderB, { ...GEMEINSCHAFT, name: 'Fremdweg 6' })).id;
	versammlungB = (
		await erstelleVersammlung(handelnderB, {
			stwegId: gemeinschaftB,
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Fremdsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		})
	).id;
	abendB = (
		await erstelleVersammlungstag(handelnderB, {
			bezeichnung: 'Fremder Abend',
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Fremdsaal',
			bemerkung: null
		})
	).id;
});

afterAll(verbindungenSchliessen);

/** Verlaufseinträge von A, deren Gegenstand die Kennung trägt. */
async function eintraegeVonAUeber(kennung: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM audit_entry
		 WHERE operator_id = ${betreiberA} AND subject_id = ${kennung}
	`;
	return z.n;
}

describe('Ein Schreibweg mit fremdem Gegenstand schreibt keinen Verlauf', () => {
	const faelle: [string, () => Promise<unknown>, () => string][] = [
		['vermerkePruefung', () => vermerkePruefung(handelnderA(), gemeinschaftB, '2026-10-27'), () => gemeinschaftB],
		[
			'setzePruefungZurueck',
			() => setzePruefungZurueck(handelnderA(), gemeinschaftB, 'Prüflauf, fremde Gemeinschaft'),
			() => gemeinschaftB
		],
		['speichereTraktandenordnung', () => speichereTraktandenordnung(handelnderA(), gemeinschaftB, []), () => gemeinschaftB],
		['verschiebeGeschaeft', () => verschiebeGeschaeft(handelnderA(), abendB, randomUUID(), null), () => abendB],
		['nimmAusTag', () => nimmAusTag(handelnderA(), versammlungB), () => versammlungB]
	];

	for (const [name, aufruf, kennung] of faelle) {
		it(`${name}: fachliche Absage, kein Eintrag unter A`, async () => {
			await expect(aufruf()).rejects.toBeInstanceOf(FachlicherFehler);
			expect(await eintraegeVonAUeber(kennung())).toBe(0);
		});
	}

	it('mit der eigenen Gemeinschaft schreibt vermerkePruefung weiter (Gegenhälfte)', async () => {
		await vermerkePruefung(handelnderA(), gemeinschaftA, '2026-10-27');
		expect(await eintraegeVonAUeber(gemeinschaftA)).toBeGreaterThan(0);
	});
});
