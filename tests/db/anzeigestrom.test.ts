/**
 * **Die offene Leinwandverbindung endet mit ihrem Code** (A3,
 * Sicherheitsdurchgang 09.10.2026).
 *
 * `/p/strom` löste den Anzeigecode bis zum 15.10.2026 nur beim Verbinden auf.
 * Erneuerte die Sitzungsleitung ihn, war der alte für jede neue Anfrage
 * wertlos, die stehende Verbindung lieferte aber weiter Live-Stände. Geprüft
 * wird hier die Route selbst: Verbindung öffnen, Code erneuern, drei
 * Herzschläge abwarten, und der Strom muss zu sein.
 *
 * Die Uhr ist nur für `setInterval` vorgespult; die Datenbank antwortet in
 * echter Zeit, deshalb wartet `liesBisEnde` mit einer echten Frist.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erneuereAnzeigecode,
	erstelleVersammlung,
	loeseAnzeigecodeAuf
} from '$lib/server/versammlungen';
import { holeCodeversuche } from '$lib/server/codeversuche';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { ANZEIGE_COOKIE } from '$lib/server/anzeigesitzung';
import { GET } from '../../src/routes/p/strom/+server';
import { pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder() {
	return { operatorId: betreiber, userId: null, label: 'Prüflauf' };
}

async function freigegebeneVersammlung(name: string, datum: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name: `${name} ${Date.now()}`,
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
		displayName: 'Erfundene Eigentümerin',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
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
	return v.id;
}

/**
 * Öffnet den Strom und wartet seinen ersten Beitrag ab, den vollen Stand.
 *
 * Erst danach gibt es den Herzschlag: `start()` richtet ihn ein, wenn der Stand
 * aus der Datenbank da ist. Wer vorher vorspult, spult an einem Takt vorbei,
 * den es noch nicht gibt.
 */
async function oeffne(code: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	const cookies = { get: (name: string) => (name === ANZEIGE_COOKIE ? code : undefined) };
	const antwort = (await GET({ cookies } as never)) as Response;
	expect(antwort.status).toBe(200);
	const leser = antwort.body!.getReader();
	const erster = await leser.read();
	expect(new TextDecoder().decode(erster.value)).toMatch(/^data: /);
	return leser;
}

/** Liest, bis der Strom endet; `false`, wenn er nach der Frist noch offen ist. */
async function liesBisEnde(
	leser: ReadableStreamDefaultReader<Uint8Array>,
	fristMs: number
): Promise<boolean> {
	const frist = new Promise<'offen'>((r) => setTimeout(() => r('offen'), fristMs));
	for (;;) {
		const ergebnis = await Promise.race([leser.read(), frist]);
		if (ergebnis === 'offen') {
			await leser.cancel();
			return false;
		}
		if (ergebnis.done) return true;
	}
}

/** Drei Herzschläge, also eine Nachprüfung. */
async function dreiSchlaege(): Promise<void> {
	await vi.advanceTimersByTimeAsync(15_000);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Anzeigestrom');
});

afterEach(() => {
	vi.useRealTimers();
});

afterAll(verbindungenSchliessen);

describe('/p/strom: Nachprüfung im Herzschlag', () => {
	it('schliesst die offene Verbindung, nachdem der Code erneuert wurde', async () => {
		const versammlung = await freigegebeneVersammlung('Anzeigestrom 1', '2027-04-01');
		const alt = await erneuereAnzeigecode(handelnder(), versammlung);

		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		const leser = await oeffne(alt);

		await erneuereAnzeigecode(handelnder(), versammlung);
		const vorher = (await holeCodeversuche()).vergeblichAnzeige;
		await dreiSchlaege();

		expect(await liesBisEnde(leser, 3_000)).toBe(true);
		// Die Nachprüfung zählt nicht als Versuch (`zaehlen: false` in der Route).
		expect((await holeCodeversuche()).vergeblichAnzeige).toBe(vorher);
	});

	it('hält die Verbindung offen, solange der Code gilt', async () => {
		// Die Gegenprobe: Ohne sie wäre auch ein Strom grün, der nach drei
		// Schlägen grundsätzlich schliesst.
		const versammlung = await freigegebeneVersammlung('Anzeigestrom 2', '2027-04-02');
		const code = await erneuereAnzeigecode(handelnder(), versammlung);

		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
		const leser = await oeffne(code);
		await dreiSchlaege();

		// Dieselbe Frist wie oben: Dort reicht sie der Nachprüfung zum Schliessen,
		// hier muss die Verbindung sie überstehen. Kürzer bewiese nichts.
		expect(await liesBisEnde(leser, 3_000)).toBe(false);
	});

	it('zählt die Nachprüfung nicht als Codeversuch', async () => {
		// Sonst stünde nach dem Erneuern je offener Wand ein «vergeblicher»
		// Versuch in der Übersicht, den niemand gemacht hat.
		const vorher = (await holeCodeversuche()).vergeblichAnzeige;
		expect((await loeseAnzeigecodeAuf('XXXXXXXXXXXX', { zaehlen: false })).gueltig).toBe(false);
		expect((await holeCodeversuche()).vergeblichAnzeige).toBe(vorher);
		expect((await loeseAnzeigecodeAuf('XXXXXXXXXXXX')).gueltig).toBe(false);
		expect((await holeCodeversuche()).vergeblichAnzeige).toBe(vorher + 1);
	});
});
