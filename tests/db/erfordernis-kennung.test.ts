/**
 * **Der Quorum-Schreibweg bindet die Gemeinschafts-Kennung** (K2,
 * Sicherheitsdurchgang 09.10.2026).
 *
 * Die Aktion `setzen` der Quorum-Seite nimmt die Kennung aus dem Formular
 * (`g`) und gab sie bis zum 15.10.2026 ungeprüft an `haltErfordernisFest`
 * weiter. Der Gegenstand im Verlauf ist freier Text ohne Fremdschlüssel; heraus
 * kam ein nicht entfernbarer Eintrag mit der Kennung eines fremden Betreibers
 * oder einer erfundenen. Belegt war das bis dahin in
 * `probe/quorum-kennung.dblive.ts`, deren Fälle hier mit gekippter Erwartung
 * stehen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import { setzeErfordernis } from '$lib/domain/entscheidbaum';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { haltErfordernisFest } from '$lib/server/erfordernis';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let fremderBetreiber: string;
let benutzer: string;
let eigeneGemeinschaft: string;
let fremdeGemeinschaft: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

function hausEingabe(name: string) {
	return {
		name: `${name} ${Date.now()}`,
		quotaDenominator: 1000,
		headCountMode: 'per_owner' as const,
		parkingCountsAsHead: false,
		parentStwegId: null
	};
}

async function eintraegeZu(kennung: string): Promise<number> {
	const [{ n }] = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
		SELECT count(*)::int AS n FROM audit_entry WHERE subject_id = ${kennung}
	`);
	return n;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Erfordernis-Kennung eigener');
	fremderBetreiber = await pruefbetreiber('Erfordernis-Kennung fremder');
	benutzer = await pruefbenutzer(betreiber, 'leitung');
	eigeneGemeinschaft = (await erstelleGemeinschaft(handelnder(), hausEingabe('Eigenes Haus'))).id;
	fremdeGemeinschaft = (
		await erstelleGemeinschaft(
			{ operatorId: fremderBetreiber, userId: null, label: 'Fremd' },
			hausEingabe('Fremdes Haus')
		)
	).id;
});

afterAll(verbindungenSchliessen);

describe('haltErfordernisFest: Kennung der Gemeinschaft', () => {
	it('weist die Kennung eines fremden Betreibers ab und schreibt nichts', async () => {
		const uebergang = setzeErfordernis(holeRegelwerk(), 'einfaches_mehr');
		await expect(haltErfordernisFest(handelnder(), fremdeGemeinschaft, uebergang)).rejects.toMatchObject({
			kennung: 'unbekannte_gemeinschaft'
		});
		expect(await eintraegeZu(fremdeGemeinschaft)).toBe(0);
	});

	it('weist eine Kennung ab, die es nirgends gibt', async () => {
		const uebergang = setzeErfordernis(holeRegelwerk(), 'einfaches_mehr');
		const erfunden = '00000000-0000-7000-8000-000000000000';
		await expect(haltErfordernisFest(handelnder(), erfunden, uebergang)).rejects.toMatchObject({
			kennung: 'unbekannte_gemeinschaft'
		});
		expect(await eintraegeZu(erfunden)).toBe(0);
	});

	it('weist eine Kennung in falscher Form ab, bevor die Datenbank sie umwandeln müsste', async () => {
		const uebergang = setzeErfordernis(holeRegelwerk(), 'einfaches_mehr');
		await expect(haltErfordernisFest(handelnder(), 'keine-kennung', uebergang)).rejects.toMatchObject({
			kennung: 'unbekannte_gemeinschaft'
		});
	});

	it('schreibt bei der eigenen Gemeinschaft, als Gegenstand die Kennung aus der Zeile', async () => {
		// Grossgeschrieben, wie `KENNUNGSFORM` es zulässt: Der Eintrag muss
		// trotzdem unter der Schreibweise der Zeile stehen, sonst fände ihn
		// `/verlauf?gegenstand=…` nicht.
		const vorher = await eintraegeZu(eigeneGemeinschaft);
		const uebergang = setzeErfordernis(holeRegelwerk(), 'einfaches_mehr');
		const ergebnis = await haltErfordernisFest(
			handelnder(),
			eigeneGemeinschaft.toUpperCase(),
			uebergang
		);
		expect(ergebnis.typ).toBe('einfaches_mehr');
		expect(await eintraegeZu(eigeneGemeinschaft)).toBeGreaterThan(vorher);
		expect(await eintraegeZu(eigeneGemeinschaft.toUpperCase())).toBe(0);
	});
});
