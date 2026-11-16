/**
 * Trägerschaft gemäss Grundbuch (Ä-43, Produktentscheid 17.09.2026; Auftrag M4,
 * Migration 163).
 *
 * Die Kette: Anlegen mit Häusern verlangt sie, bevor etwas angelegt ist;
 * eine bestehende Anlage mit Häusern behält den leeren Wert, bis ihre Angaben
 * gespeichert werden, und dann wird er verlangt; die Datenbank nimmt nur die
 * drei Werte.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bearbeiteGemeinschaft,
	erstelleGemeinschaft,
	hatHaeuserAlsMitglieder,
	holeGemeinschaft
} from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import type { GemeinschaftEingabe } from '$lib/domain/gemeinschaft';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const MEG: GemeinschaftEingabe = {
	name: 'Trägerschaftsprobe MEG',
	quotaDenominator: 2,
	headCountMode: 'per_unit',
	headCountRuleSource: 'Art. 7 Ziff. 3',
	parkingCountsAsHead: false,
	parentStwegId: null
};

/** Eine Miteigentümergemeinschaft mit einem Haus als Mitglied, ohne Trägerschaft (Bestand). */
async function anlageMitHaus(name: string) {
	const haus = await erstelleGemeinschaft(handelnder(), {
		...MEG,
		name: `${name} Haus`,
		quotaDenominator: 1000
	});
	const meg = await erstelleGemeinschaft(handelnder(), { ...MEG, name });
	const e = await erstelleEinheit(handelnder(), {
		stwegId: meg.id,
		kind: 'unit',
		label: 'Anteil Haus',
		quotas: { stamm: 1 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(), {
		stwegId: meg.id,
		kind: 'gemeinschaft',
		displayName: `${name} Haus`,
		memberStwegId: haus.id,
		isCommunity: false,
		representativeName: 'Vertretung des Hauses'
	});
	await ordneEigentumZu(handelnder(), e.id, p.id, '2020-02-19');
	return meg.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Trägerschaft');
	benutzer = await pruefbenutzer(betreiber, 'traegerschaftsleitung');
});

afterAll(verbindungenSchliessen);

describe('Trägerschaft gemäss Grundbuch', () => {
	it('verlangt sie beim Anlegen mit Häusern und legt dann nichts an', async () => {
		const name = 'Trägerschaftsprobe ohne Wert';
		await expect(erstelleGemeinschaft(handelnder(), { ...MEG, name }, true)).rejects.toMatchObject({
			kennung: 'traegerschaft_fehlt'
		});
		const [{ n }] = await imKontext(
			betreiber,
			(tx) => tx<{ n: number }[]>`SELECT count(*)::int AS n FROM stweg WHERE name = ${name}`
		);
		expect(n).toBe(0);
		const g = await erstelleGemeinschaft(
			handelnder(),
			{ ...MEG, name: 'Trägerschaftsprobe mit Wert', traegerschaft: 'stammgrundstueck' },
			true
		);
		expect((await holeGemeinschaft(betreiber, g.id))?.traegerschaft).toBe('stammgrundstueck');
	});

	it('verlangt sie beim nächsten Bearbeiten einer bestehenden Anlage mit Häusern', async () => {
		const meg = await anlageMitHaus('Trägerschaftsprobe Bestand');
		expect(await hatHaeuserAlsMitglieder(betreiber, meg)).toBe(true);
		expect((await holeGemeinschaft(betreiber, meg))?.traegerschaft).toBeNull();
		await expect(
			bearbeiteGemeinschaft(handelnder(), meg, { ...MEG, name: 'Trägerschaftsprobe Bestand' })
		).rejects.toMatchObject({ kennung: 'traegerschaft_fehlt' });
		await bearbeiteGemeinschaft(handelnder(), meg, {
			...MEG,
			name: 'Trägerschaftsprobe Bestand',
			traegerschaft: 'stockwerkanteile'
		});
		expect((await holeGemeinschaft(betreiber, meg))?.traegerschaft).toBe('stockwerkanteile');
		// Ohne das Feld bleibt der Wert stehen.
		await bearbeiteGemeinschaft(handelnder(), meg, { ...MEG, name: 'Trägerschaftsprobe Bestand' });
		expect((await holeGemeinschaft(betreiber, meg))?.traegerschaft).toBe('stockwerkanteile');
	});

	it('lässt eine Gemeinschaft ohne Häuser ohne Trägerschaft bearbeiten', async () => {
		const g = await erstelleGemeinschaft(handelnder(), { ...MEG, name: 'Trägerschaftsprobe frei' });
		expect(await hatHaeuserAlsMitglieder(betreiber, g.id)).toBe(false);
		await bearbeiteGemeinschaft(handelnder(), g.id, { ...MEG, name: 'Trägerschaftsprobe frei 2' });
	});

	it('nimmt in der Datenbank nur die drei Werte', async () => {
		const g = await erstelleGemeinschaft(handelnder(), { ...MEG, name: 'Trägerschaftsprobe Schranke' });
		await expect(
			admin`UPDATE stweg SET traegerschaft = 'erfunden' WHERE id = ${g.id}`
		).rejects.toThrow(/stweg_traegerschaft_wert/);
	});
});
