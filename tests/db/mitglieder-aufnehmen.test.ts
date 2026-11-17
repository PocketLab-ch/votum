/**
 * Mitglieder aufnehmen: Eine Absage lässt nichts stehen (Kriterium 6 des
 * Auftrags `2026-11-16-votum-erste-versammlung-wertquoten-abend-h1.md`, Pendenz
 * «Mitglieder aufnehmen: Absage lässt eine Einheit stehen», 29.10.2026).
 *
 * Bis hier schrieb `nimmGemeinschaftenAlsMitgliederAuf` Einheit, Partei und
 * Zuordnung je in einer eigenen Transaktion. Scheiterte erst die Partei, hier an
 * der fehlenden Vertretung (Schranke `party_vertretung_bei_juristisch`), stand die
 * Einheit «Anteil <Name>» samt Quote und Verlaufseintrag ohne Eigentümer da. Beide
 * Wege werden gefahren: `/gemeinschaften/<id>/eigentuemer?/mitgliederAnlegen` und
 * das Anlegen unter `/gemeinschaften/neu`.
 *
 * Erfundene Gemeinschaften und Namen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { actions as eigentuemerAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/eigentuemer/+page.server';
import { actions as neuAktionen } from '../../src/routes/gemeinschaften/neu/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
const h = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Mitglieder aufnehmen');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-mitglieder');
});
afterAll(verbindungenSchliessen);

async function rufe(aktion: unknown, id: string | null, felder: [string, string][]) {
	const daten = new FormData();
	for (const [feld, wert] of felder) daten.append(feld, wert);
	const ereignis = {
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: { id: benutzer, operatorId: betreiber, username: 'pruefer-mitglieder', displayName: 'Prüferin', role: 'admin' },
			herkunft: null
		},
		params: id ? { id } : {},
		url: new URL('http://pruefung.example/aktion'),
		route: { id: '/pruefung' }
	};
	try {
		const antwort = (await (aktion as (e: never) => Promise<unknown>)(ereignis as never)) as
			| { status?: number; data?: unknown }
			| undefined;
		if (antwort && typeof antwort === 'object' && 'status' in antwort && typeof antwort.status === 'number') {
			return { status: antwort.status, daten: antwort.data };
		}
		return { status: 200, daten: antwort };
	} catch (f) {
		if (isRedirect(f)) return { status: f.status, daten: undefined };
		throw f;
	}
}

/** Was in der Miteigentümergemeinschaft zum Mitglied steht: Einheiten, Quoten, Parteien, Verlauf. */
async function bestand(meg: string, name: string) {
	const [z] = await admin<{ einheiten: number; quoten: number; parteien: number; verlauf: number }[]>`
		SELECT
			(SELECT count(*)::int FROM unit WHERE stweg_id = ${meg} AND label = ${`Anteil ${name}`}) AS einheiten,
			(SELECT count(*)::int FROM unit_quota q JOIN unit u ON u.id = q.unit_id
			  WHERE u.stweg_id = ${meg} AND u.label = ${`Anteil ${name}`}) AS quoten,
			(SELECT count(*)::int FROM party WHERE stweg_id = ${meg} AND display_name = ${name}) AS parteien,
			-- Ohne Join auf «unit»: Ein verwaister Eintrag bliebe sonst unsichtbar, weil
			-- die zurückgerollte Einheit fehlt (Featureprüfung, Prüfer A, Kriterium 6).
			(SELECT count(*)::int FROM audit_entry a
			  WHERE a.operator_id = ${betreiber} AND a.event_type = 'unit.created'
			    AND a.detail->>'stweg' = ${meg} AND a.detail->>'label' = ${`Anteil ${name}`}) AS verlauf
	`;
	return z;
}

const felder = (id: string, vertretung: string): [string, string][] => [
	['mitglied', id],
	[`quote:${id}`, '400'],
	[`vertretung:${id}`, vertretung],
	['ab', '2026-01-01']
];

describe('Mitglieder aufnehmen: alles oder nichts je Mitglied', () => {
	it('eigentuemer?/mitgliederAnlegen ohne Vertretung: keine Einheit, keine Quote, kein Verlauf', async () => {
		const meg = (await erstelleGemeinschaft(h(), { ...GEMEINSCHAFT, name: 'Einstellhalle Erfunden', traegerschaft: 'stammgrundstueck' }, true)).id;
		const haus = (await erstelleGemeinschaft(h(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 21' })).id;
		const e = await rufe(eigentuemerAktionen.mitgliederAnlegen, meg, felder(haus, ''));
		expect(e.status).toBe(400);
		expect(await bestand(meg, 'Ausgedachtweg 21')).toEqual({ einheiten: 0, quoten: 0, parteien: 0, verlauf: 0 });

		// Gegenprobe: mit Vertretung entsteht alles, und der Verlauf steht.
		const g = await rufe(eigentuemerAktionen.mitgliederAnlegen, meg, felder(haus, 'Verwaltung Muster (erfunden)'));
		expect(g.status).toBe(200);
		const nachher = await bestand(meg, 'Ausgedachtweg 21');
		expect(nachher).toMatchObject({ einheiten: 1, quoten: 1, parteien: 1 });
		expect(nachher.verlauf).toBe(1);
	});

	it('gemeinschaften/neu ohne Vertretung: die Gemeinschaft steht, vom Mitglied nichts', async () => {
		const haus = (await erstelleGemeinschaft(h(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 23' })).id;
		const e = await rufe(neuAktionen.default, null, [
			['name', 'Parkhaus Erfunden'],
			['quotaDenominator', '1000'],
			['headCountMode', 'per_owner'],
			['traegerschaft', 'stammgrundstueck'],
			...felder(haus, '')
		]);
		expect(e.status).toBe(200);
		// Die Absage nennt das Mitglied: Die Route hat die Aufnahme also durchlaufen.
		expect(JSON.stringify(e.daten)).toContain('Nicht angelegt: Ausgedachtweg 23');
		const [meg] = await admin<{ id: string }[]>`
			SELECT id FROM stweg WHERE operator_id = ${betreiber} AND name = 'Parkhaus Erfunden'
		`;
		expect(meg).toBeDefined();
		expect(await bestand(meg.id, 'Ausgedachtweg 23')).toEqual({ einheiten: 0, quoten: 0, parteien: 0, verlauf: 0 });
	});

	it('gemeinschaften/neu mit Vertretung: das Mitglied entsteht ganz (Gegenprobe)', async () => {
		const haus = (await erstelleGemeinschaft(h(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 25' })).id;
		const e = await rufe(neuAktionen.default, null, [
			['name', 'Velohalle Erfunden'],
			['quotaDenominator', '1000'],
			['headCountMode', 'per_owner'],
			['traegerschaft', 'stammgrundstueck'],
			...felder(haus, 'Verwaltung Muster (erfunden)')
		]);
		expect([200, 303]).toContain(e.status);
		const [meg] = await admin<{ id: string }[]>`
			SELECT id FROM stweg WHERE operator_id = ${betreiber} AND name = 'Velohalle Erfunden'
		`;
		const nachher = await bestand(meg.id, 'Ausgedachtweg 25');
		expect(nachher).toMatchObject({ einheiten: 1, quoten: 1, parteien: 1 });
		expect(nachher.verlauf).toBe(1);
	});
});
