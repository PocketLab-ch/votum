/**
 * Fremde Kennung im Formularfeld: Absage statt 500, und nichts angelegt.
 *
 * **Der Befund (Feldteil von `e2e/fremdbetreiber.mjs`, 27.10.2026, am
 * gebauten Stand).** Füllt ein Konto von A ein Formularfeld mit der Kennung
 * einer Gemeinschaft von B, hielten Zeilenschutz und Fremdschlüssel B dicht,
 * aber vier Wege antworteten mit der 500-Seite:
 *
 * - `/versammlungen/neu?/einzeln` und `?/gemeinsam` (`gemeinschaft`) am
 *   Fremdschlüssel `meeting_stweg_id_operator_id_fkey`; `gemeinsam` hatte den
 *   Abend davor schon angelegt, ein leerer Abend unter A je Versuch;
 * - `/gemeinschaften/neu` (`parentStwegId`) am Fremdschlüssel
 *   `stweg_eltern_gleicher_betreiber`;
 * - `/quorum?/setzen` (`g`) an «Gemeinschaft nicht gefunden.» aus
 *   `holeLesarten`, gelesen vor dem `try`.
 *
 * Dazu `/pruefen`: Ein Inhaltsverzeichnis ohne Liste der Bestandteile endete
 * als `TypeError`. Mit der Mandantentrennung hat das nichts zu tun, der Weg
 * nimmt aber die Kennung einer Versammlung aus dem hochgeladenen Paket an, und
 * dieselbe Messung fand es.
 *
 * **Die Aktionen selbst, wo die Abwehr in der Schale sitzt**, sonst die
 * Funktion darunter, wie in `absagen-statt-500.test.ts`. Vor der Behebung waren
 * alle Fälle rot ausser der Gegenhälfte, die dort schon durchging.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

// Wie in `absagen-statt-500.test.ts`: Die Routen ziehen `$app/environment`.
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { pruefePaket } from '$lib/server/paketpruefung';
import { dosZeitstempel, packe } from '$lib/domain/archiv';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { actions as neuAktionen } from '../../src/routes/versammlungen/neu/+page.server';
import { actions as quorumAktionen } from '../../src/routes/quorum/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let gemeinschaftA: string;
let gemeinschaftB: string;

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
	betreiberA = await pruefbetreiber('Prüflauf Fremde Kennung A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-fremd-a');
	const betreiberB = await pruefbetreiber('Prüflauf Fremde Kennung B');
	const benutzerB = await pruefbenutzer(betreiberB, 'pruefer-fremd-b');

	gemeinschaftA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Eigenweg 1' })).id;
	gemeinschaftB = (
		await erstelleGemeinschaft(
			{ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' },
			{ ...GEMEINSCHAFT, name: 'Fremdweg 2' }
		)
	).id;
});

afterAll(verbindungenSchliessen);

/** Eine Aktion wie SvelteKit sie aufruft, als A. */
async function rufe(aktion: (e: never) => unknown, felder: Record<string, string>) {
	const daten = new FormData();
	for (const [feld, wert] of Object.entries(felder)) daten.append(feld, wert);
	const ereignis = {
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzerA,
				operatorId: betreiberA,
				username: 'pruefer-fremd-a',
				displayName: 'Prüferin A',
				role: 'admin'
			},
			herkunft: null
		},
		params: {},
		url: new URL('http://pruefung.example/aktion'),
		route: { id: '/pruefung' }
	};
	return aktion(ereignis as never);
}

async function abendeVonA(): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM meeting_day WHERE operator_id = ${betreiberA}
	`;
	return z.n;
}

async function versammlungenVonA(): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM meeting WHERE operator_id = ${betreiberA}
	`;
	return z.n;
}

describe('Gemeinschaft eines fremden Betreibers im Formular', () => {
	it('erstelleVersammlung sagt fachlich ab, statt am Fremdschlüssel zu scheitern', async () => {
		const versuch = erstelleVersammlung(handelnderA(), {
			stwegId: gemeinschaftB,
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await expect(versuch).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(versuch).rejects.toMatchObject({ kennung: 'unbekannt' });
	});

	it('/versammlungen/neu?/einzeln antwortet mit 400 und legt nichts an', async () => {
		const vorher = await versammlungenVonA();
		const antwort = await rufe(neuAktionen.einzeln as never, {
			gemeinschaft: gemeinschaftB,
			datum: '2026-12-02',
			uhrzeit: '19:00',
			ort: 'Prüfsaal'
		});
		expect(antwort).toMatchObject({ status: 400 });
		expect(await versammlungenVonA()).toBe(vorher);
	});

	it('/versammlungen/neu?/gemeinsam sagt vor dem Abend ab: kein leerer Abend unter A', async () => {
		const vorher = await abendeVonA();
		const antwort = await rufe(neuAktionen.gemeinsam as never, {
			gemeinschaft: gemeinschaftB,
			bezeichnung: 'Prüfabend',
			datum: '2026-12-03',
			uhrzeit: '19:00',
			ort: 'Prüfsaal'
		});
		expect(antwort).toMatchObject({
			status: 400,
			data: { fehler: { nachricht: 'Gemeinschaft nicht gefunden.' } }
		});
		expect(await abendeVonA()).toBe(vorher);
	});

	it('/versammlungen/neu?/gemeinsam mit der eigenen geht weiter durch (Gegenhälfte)', async () => {
		let umleitung: unknown = null;
		try {
			await rufe(neuAktionen.gemeinsam as never, {
				gemeinschaft: gemeinschaftA,
				bezeichnung: 'Prüfabend eigen',
				datum: '2026-12-04',
				uhrzeit: '19:00',
				ort: 'Prüfsaal'
			});
		} catch (f) {
			umleitung = f;
		}
		expect(isRedirect(umleitung)).toBe(true);
	});

	it('erstelleGemeinschaft mit fremder übergeordneter sagt fachlich ab', async () => {
		const versuch = erstelleGemeinschaft(handelnderA(), {
			...GEMEINSCHAFT,
			name: 'Kindweg 3',
			parentStwegId: gemeinschaftB
		});
		await expect(versuch).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(versuch).rejects.toMatchObject({ kennung: 'unbekannt', feld: 'parentStwegId' });
	});

	it('/quorum?/setzen mit fremder Gemeinschaft antwortet mit 400, nicht mit einer rohen Ausnahme', async () => {
		const antwort = await rufe(quorumAktionen.setzen as never, {
			g: gemeinschaftB,
			typ: 'einfaches_mehr',
			begruendung: 'Prüflauf, Erfordernis von Hand'
		});
		expect(antwort).toMatchObject({ status: 400 });
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry WHERE subject_id = ${gemeinschaftB}
			   AND operator_id = ${betreiberA}
		`;
		expect(z.n).toBe(0);
	});
});

describe('Ein Paket, dessen Inhaltsverzeichnis keine Bestandteile nennt', () => {
	it('gilt als unlesbar, statt als TypeError zu enden', async () => {
		const manifest = new TextEncoder().encode(
			JSON.stringify({ versammlung: { kennung: '00000000-0000-4000-8000-000000000000' } })
		);
		const paket = packe([{ name: 'manifest.json', inhalt: manifest }], dosZeitstempel('2026-12-01 21:30:00'));
		const befund = await pruefePaket(betreiberA, paket, null, null);
		expect(befund.manifest).toBeNull();
		expect(befund.satz).toMatch(/nicht lesbar/);
	});

	it('ebenso, wenn ein Eintrag weder Pfad noch Prüfsumme trägt', async () => {
		const manifest = new TextEncoder().encode(JSON.stringify({ eintraege: [null, 1] }));
		const paket = packe([{ name: 'manifest.json', inhalt: manifest }], dosZeitstempel('2026-12-01 21:30:00'));
		const befund = await pruefePaket(betreiberA, paket, null, null);
		expect(befund.satz).toMatch(/nicht lesbar/);
	});
});
