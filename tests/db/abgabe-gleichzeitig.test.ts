/**
 * Zwei Abgaben derselben Versammlung zugleich (Sicherheitsdurchgang
 * 09.10.2026, Befund S8).
 *
 * `abgabe.test.ts` prüft die zweite Abgabe nacheinander; dort ist die erste
 * schon festgeschrieben, und die Prüfung am Anfang von `gibAb` trifft. Hier
 * bestehen beide diese Prüfung, bauen ihr Paket und halten an der Sperre der
 * Versammlungszeile an. Im Saal ist das der Doppelklick, die Wiederholung nach
 * einem Netzunterbruch, der zweite Reiter. Gesteuert wie in
 * `stimmweg-rennen.test.ts`.
 */
import { readdir, rm } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { gibAb, holeOffeneAbgabe } from '$lib/server/abgabe';
import { registriereGeraet } from '$lib/server/geraete';
import { alsGeraetecode, erzeugeGeraeteschluessel } from '$lib/server/saalgeraet';
import { FachlicherFehler } from '$lib/domain/fehler';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { halteSperre, warteAufWartende } from './rennen';

/*
 * **Eine eigene, leere Ablage für diese Datei.** Sonst liefe die Prüfung über
 * die Ablage von Dev, zehntausende Dateien, und müsste die eigenen Pakete
 * darin erst erkennen. So stammt jede Datei darin aus diesem Lauf. Gesetzt vor
 * den Importen, weil `dateien.ts` die Wurzel beim Laden liest.
 */
const ablage = await vi.hoisted(async () => {
	const { mkdtempSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const ordner = mkdtempSync(join(tmpdir(), 'abgabe-rennen-'));
	process.env.VERSAMMLUNG_DATEIEN = ordner;
	return ordner;
});

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

async function freigegebeneVersammlung(name: string, datum: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Prüfpartei A',
		representativeName: null,
		isCommunity: false
	});
	await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(), v.id);
	return v.id;
}

async function eingetragenesGeraet(name: string): Promise<string> {
	const geraet = await registriereGeraet(handelnder(), name, alsGeraetecode(erzeugeGeraeteschluessel()));
	return geraet.id;
}

/** Die Prüfsummen aller Dateien in der Ablage dieser Prüfung. */
async function dateienDerAblage(): Promise<string[]> {
	const eintraege = await readdir(ablage, { recursive: true, withFileTypes: true });
	return eintraege.filter((e) => e.isFile()).map((e) => e.name);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abgabe im Rennen');
	benutzer = await pruefbenutzer(betreiber, 'abgaberennen');
});

afterAll(async () => {
	await verbindungenSchliessen();
	await rm(ablage, { recursive: true, force: true });
});

describe('S8: gleichzeitige zweite Abgabe', () => {
	it('gibt einmal ab, sagt es dem zweiten in einem Satz und lässt kein Paket liegen', async () => {
		const versammlung = await freigegebeneVersammlung('Rennhaus S8', '2027-05-08');
		const eins = await eingetragenesGeraet('Notebook S8 a');
		const zwei = await eingetragenesGeraet('Notebook S8 b');

		const sperre = await halteSperre(async (tx) => {
			await tx`SELECT 1 FROM meeting WHERE id = ${versammlung} FOR UPDATE`;
		});
		const laeufe = [eins, zwei].map((geraetId) =>
			gibAb(handelnder(), versammlung, { zustand: 'freigegeben' }, {
				geraetId,
				herkunft: null,
				jetzt: '2026-11-20 10:00:00'
			})
		);
		await warteAufWartende(2);
		await sperre.loesen();

		const ergebnisse = await Promise.allSettled(laeufe);
		expect(ergebnisse.filter((l) => l.status === 'fulfilled')).toHaveLength(1);
		const verlierer = ergebnisse.find((l) => l.status === 'rejected') as PromiseRejectedResult;
		expect(verlierer.reason).toBeInstanceOf(FachlicherFehler);
		expect((verlierer.reason as FachlicherFehler).kennung).toBe('schon_abgegeben');

		// Genau ein Paket liegt in der Ablage, und es ist das des Leihscheins.
		const offen = await holeOffeneAbgabe(betreiber, versammlung);
		expect(offen).not.toBeNull();
		expect(await dateienDerAblage()).toEqual([offen!.paketPruefsumme]);
	});
});
