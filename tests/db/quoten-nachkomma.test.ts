/**
 * Stammquote mit Nachkommastellen: Absage mit Weg, kein Datensatz (Ä-10).
 *
 * **Der Entscheid** (Produktentscheid 18.10.2026, `docs/entscheide/0008`):
 * Wertquoten bleiben ganzzahlig, gerundet wird nichts, und die Absage nennt den
 * Weg über einen grösseren Nenner. Die Domänenproben zeigen den Satz; hier
 * steht, dass er an den Aktionen ankommt und dass nach der Absage nichts
 * gespeichert ist, auch kein gerundeter Wert.
 *
 * **Aufgerufen werden die Aktionen selbst**, wie in `absagen-statt-500.test.ts`:
 * Das Komma liest erst die Schale als Nachkommastelle (`quotenAus` über
 * `quoteAusEingabe`); ein Test gegen den Kern sähe davon nichts, und «123,5»
 * käme dort als NaN an, mit der Absage ohne Weg.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { holeEinheiten } from '$lib/server/einheiten';
import { fuehreUebernahmeAus, vorschau } from '$lib/server/uebernahme';
import { actions as einheitenAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/einheiten/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

type Aktion = (ereignis: unknown) => Promise<unknown>;
const aktionen = einheitenAktionen as unknown as Record<string, Aktion>;

let betreiber: string;
let benutzer: string;
let stweg: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüferin' };
}

async function fahre(aktion: string, felder: Record<string, string>): Promise<unknown> {
	const daten = new FormData();
	for (const [feld, wert] of Object.entries(felder)) daten.append(feld, wert);
	return aktionen[aktion]({
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-nachkomma',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id: stweg },
		url: new URL('http://pruefung.example/gemeinschaften/x/einheiten'),
		route: { id: '/pruefung' }
	});
}

/** Der Text einer `fail(400, …)`-Antwort, sonst ein Fehlschlag des Tests. */
function absage(antwort: unknown): string {
	const a = antwort as { status?: number; data?: { fehler?: { nachricht?: string } } };
	expect(a.status).toBe(400);
	return a.data?.fehler?.nachricht ?? '';
}

async function anzahlQuotenzeilen(): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM unit_quota q JOIN unit u ON u.id = q.unit_id
		 WHERE u.stweg_id = ${stweg}
	`;
	return z.n;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Prüflauf Nachkommastellen');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-nachkomma');
	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Erfundenweg 12',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Formular «Einheit anlegen»', () => {
	for (const wert of ['123,5', '123.5']) {
		it(`weist «${wert}» mit dem Weg ab und speichert nichts`, async () => {
			const text = absage(await fahre('anlegen', { label: 'Whg 1', 'quote.stamm': wert }));
			expect(text).toMatch(/ganze Zahl/);
			expect(text).toMatch(/1235 von 10 000/);
			expect(await holeEinheiten(betreiber, stweg)).toEqual([]);
			expect(await anzahlQuotenzeilen()).toBe(0);
		});
	}
});

describe('Ein Komma als Tausendertrenner', () => {
	it('weist «1,000» ab, statt es still als 1 zu speichern', async () => {
		const text = absage(await fahre('anlegen', { label: 'Whg 1', 'quote.stamm': '1,000' }));
		expect(text).toMatch(/ganze Zahl/);
		expect(text).not.toMatch(/Vergrössern/);
		expect(await holeEinheiten(betreiber, stweg)).toEqual([]);
	});
});

describe('Liste einfügen', () => {
	it('weist jede Zeile mit Nachkommastelle mit dem Weg ab und legt keine an', async () => {
		const a = (await fahre('sammelAnlegen', {
			zeilen: 'Whg 1; 123,5\nWhg 2; 876\nWhg 3; 0.5'
		})) as { status: number; data: { zeilenfehler: { zeile: number; grund: string }[] } };
		expect(a.status).toBe(400);
		expect(a.data.zeilenfehler.map((f) => f.zeile)).toEqual([1, 3]);
		for (const f of a.data.zeilenfehler) expect(f.grund).toMatch(/1235 von 10 000/);
		// Alles oder nichts: Auch die richtige Zeile 2 entsteht nicht.
		expect(await holeEinheiten(betreiber, stweg)).toEqual([]);
	});
});

describe('Übernahme aus einer Datei', () => {
	const CSV = [
		'holding_ref;holding_type;label;owner_voter_ref;quota_units',
		'H1;unit;1.1 Wohnung;E1;123,5',
		'H2;unit;1.2 Wohnung;E1;123.5'
	].join('\n');

	it('nennt je Zeile den Weg und übernimmt keine', async () => {
		const v = await vorschau(betreiber, stweg, CSV, '2026-10-18');
		expect(v.art).toBe('einheiten');
		const gruende = v.befunde.map((b) => b.grund);
		expect(gruende).toHaveLength(2);
		for (const g of gruende) expect(g).toMatch(/1235 von 10 000/);

		const ergebnis = await fuehreUebernahmeAus(handelnder(), stweg, CSV, '2026-10-18');
		expect(ergebnis.angelegt).toBe(0);
		expect(await holeEinheiten(betreiber, stweg)).toEqual([]);
		expect(await anzahlQuotenzeilen()).toBe(0);
	});
});
