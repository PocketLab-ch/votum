/**
 * Die Übernahme aus Datei prüft die Gemeinschaft selbst (Auftrag 2f).
 *
 * **Der Anlass** (`docs/pendenzen-sicherheit.md`, «Übernahme aus Datei:
 * Verlauf über eine Gemeinschaft, die es unter A nicht gibt»). Bei leerem Plan
 * lief kein INSERT, und `uebernahmeBestaetigt` nannte die Gemeinschaft von B;
 * abgewiesen hat das zuletzt nur der Wächter aus Migration 177.
 *
 * **Bewusst nicht in `waechter-k2.test.ts`:** Diese Datei steht nicht in
 * `MEINEN_IHN` (`waechter-netz.ts`), also wird jeder Test hier rot, wenn die
 * Absage vom Wächter statt aus dem Code kommt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { fuehreUebernahmeAus } from '$lib/server/uebernahme';
import { FachlicherFehler, fremdeGemeinschaft } from '$lib/domain/fehler';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let betreiberB: string;
let benutzerB: string;
let gemeinschaftA: string;
let gemeinschaftB: string;

const handelnderA = () => ({ operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' });
const handelnderB = () => ({ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' });

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

const KOPF = 'voter_ref;display_name;person_names;ownership_type;legal_representatives';
const LEER = `${KOPF}\n`;
const GEFUELLT = [
	KOPF,
	'E1;Erfunden Berta;;alleineigentum;',
	'E2;Erbengemeinschaft Beispiel;Carl Beispiel|Dora Beispiel;gesamteigentum;Carl Beispiel'
].join('\n');

/**
 * Zeilen beider Betreiber in jeder Tabelle, in die `fuehreUebernahmeAus`
 * schreibt (direkt oder über `schreibeGemeinschaftlicheZeile`), samt Verlauf.
 */
async function bestand(): Promise<Record<string, number>> {
	const [z] = await admin<Record<string, number>[]>`
		SELECT
		  (SELECT count(*)::int FROM party WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS party,
		  (SELECT count(*)::int FROM unit WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS unit,
		  (SELECT count(*)::int FROM unit_ownership
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS unit_ownership,
		  (SELECT count(*)::int FROM party_member
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS party_member,
		  (SELECT count(*)::int FROM unit_quota
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS unit_quota,
		  (SELECT count(*)::int FROM usufruct
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS usufruct,
		  (SELECT count(*)::int FROM audit_entry
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS audit_entry
	`;
	return z;
}

/** Einträge irgendeines Betreibers, die die Kennung tragen. */
async function eintraegeMit(kennung: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM audit_entry x WHERE x::text ~* ${kennung}
	`;
	return z.n;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf Übernahme fremd A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-uebernahme-a');
	betreiberB = await pruefbetreiber('Prüflauf Übernahme fremd B');
	benutzerB = await pruefbenutzer(betreiberB, 'pruefer-uebernahme-b');
	gemeinschaftA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Erfundenweg 21' })).id;
	gemeinschaftB = (await erstelleGemeinschaft(handelnderB(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 22' })).id;
});

afterAll(verbindungenSchliessen);

describe('Übernahme aus Datei unter A mit der Gemeinschaft von B', () => {
	for (const [fall, inhalt] of [
		['eine leere Datei', LEER],
		['eine Datei mit übernehmbaren Zeilen', GEFUELLT]
	] as const) {
		it(`${fall}: Absage aus dem Code, kein Verlauf, kein neuer Bestand`, async () => {
			const vorher = await bestand();
			const ueberB = await eintraegeMit(gemeinschaftB);
			const fehler = await fuehreUebernahmeAus(handelnderA(), gemeinschaftB, inhalt, '2026-09-01').then(
				() => null,
				(f: unknown) => f
			);
			expect(fehler).toBeInstanceOf(FachlicherFehler);
			expect(fehler).toMatchObject({
				kennung: fremdeGemeinschaft('stwegId').kennung,
				message: fremdeGemeinschaft('stwegId').message,
				feld: 'stwegId'
			});
			expect(await eintraegeMit(gemeinschaftB)).toBe(ueberB);
			expect(await bestand()).toEqual(vorher);
		});
	}
});

describe('Gegenhälfte: dieselbe Datei unter A mit der eigenen Gemeinschaft', () => {
	it('geht durch und hält die Übernahme im Verlauf fest', async () => {
		const ueberA = await eintraegeMit(gemeinschaftA);
		const ergebnis = await fuehreUebernahmeAus(handelnderA(), gemeinschaftA, GEFUELLT, '2026-09-01');
		expect(ergebnis).toMatchObject({ angelegt: 2, geaendert: 0, uebersprungen: 0 });
		const [{ n }] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM party WHERE stweg_id = ${gemeinschaftA} AND import_ref IS NOT NULL
		`;
		expect(n).toBe(2);
		expect(await eintraegeMit(gemeinschaftA)).toBeGreaterThan(ueberA);
	});
});
