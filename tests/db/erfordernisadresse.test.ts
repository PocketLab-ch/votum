/**
 * **Der zweite Adressteil gehört gegen den ersten geprüft** (03.09.2026, aus
 * dem Code-Review zum KI-Übernahmeweg).
 *
 * Die Erfordernisseite trägt zwei Kennungen: die Versammlung und das
 * Traktandum. Die Reglementsregeln stammen aus der **Versammlung** der Adresse.
 * Gehörte das Traktandum zu einer anderen, bekäme es die Regeln der falschen
 * Gemeinschaft — innerhalb desselben Betreibers, den `alsBetreiber` also nicht
 * abfängt.
 *
 * `kivorschlag` prüft das seit dem 02.09.2026. Die drei **setzenden** Aktionen
 * taten es nicht: `kifolgen`, `uebernehmen` und `setzen`.
 *
 * **Warum ein Verhaltenstest und kein Formwächter:** Von den fünf Routen mit
 * zwei Adressteilen prüfen drei sauber, jede auf ihre Art — einmal über
 * `find()` auf einer schon gefilterten Liste, zweimal über einen Vergleich der
 * geladenen Zeile. Ein Wächter, der «beide Kennungen in einem Aufruf» verlangt,
 * hätte alle drei falsch angeschlagen. Geprüft wird deshalb, was zählt: dass
 * ein fremdes Traktandum abgewiesen wird.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum, holeTraktanden } from '$lib/server/traktanden';
import { actions } from '../../src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.server';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüferin' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Erfordernisadresse');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

/** Zwei Gemeinschaften desselben Betreibers, jede mit Versammlung und Traktandum. */
async function zweiHaeuser() {
	async function haus(name: string) {
		const g = await erstelleGemeinschaft(handelnder(), {
			name: `${name} ${Date.now()}`,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(), {
			stwegId: g.id,
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			uhrzeit: '19:00',
			art: 'ordentlich',
			datum: '2027-03-01',
			ort: 'Saal'
		});
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: v.id,
			titel: 'Fassade',
			art: 'abstimmung',
			antragswortlaut: 'Die Versammlung beschliesst die Sanierung.',
			antragstellerart: 'bewirtschaftung'
		});
		return { g, v, t };
	}
	return { eines: await haus('Adresse A'), anderes: await haus('Adresse B') };
}

async function rufe(
	name: 'kifolgen' | 'uebernehmen' | 'setzen',
	versammlungId: string,
	traktandumId: string,
	felder: Record<string, string>
): Promise<number> {
	const daten = new FormData();
	for (const [k, w] of Object.entries(felder)) daten.set(k, w);
	try {
		const ergebnis = (await actions[name]({
			request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
			locals: {
				benutzer: {
					id: benutzer,
					operatorId: betreiber,
					username: 'pruefer-adresse',
					displayName: 'Prüferin',
					role: 'admin'
				},
				herkunft: null
			},
			params: { id: versammlungId, traktandumId },
			url: new URL('http://pruefung.example/aktion')
		} as never)) as { status?: number };
		return ergebnis?.status ?? 200;
	} catch (fehler) {
		// `error()` und `redirect()` werfen beide ein Objekt mit `status`.
		if (fehler && typeof fehler === 'object' && 'status' in fehler) {
			return (fehler as { status: number }).status;
		}
		throw fehler;
	}
}

const BAUEN = { ast: 'a-bauen', p: 'f1-0-nein,f1-1-nein,f1-2-ja' };

describe('Das Traktandum muss zur Versammlung der Adresse gehören', () => {
	it('weist ein fremdes Traktandum in allen drei setzenden Aktionen ab', async () => {
		const { eines, anderes } = await zweiHaeuser();

		for (const name of ['kifolgen', 'uebernehmen', 'setzen'] as const) {
			const felder =
				name === 'setzen'
					? { typ: 'einfaches_mehr', begruendung: 'Prüflauf', ...BAUEN }
					: { nutzungId: '01a00000-0000-7000-8000-000000000000', ...BAUEN };
			const status = await rufe(name, eines.v.id, anderes.t.id, felder);
			expect(status, `«${name}» nahm ein fremdes Traktandum an`).toBe(404);
		}

		// Und nichts davon ist am fremden Traktandum hängengeblieben.
		const drueben = (await holeTraktanden(betreiber, anderes.v.id)).find(
			(x) => x.knoten.id === anderes.t.id
		);
		expect(drueben?.knoten.erfordernis, 'am fremden Traktandum steht nichts').toBeFalsy();
	});

	it('lässt das eigene Traktandum durch', async () => {
		const { eines } = await zweiHaeuser();
		const status = await rufe('uebernehmen', eines.v.id, eines.t.id, BAUEN);
		expect(status, 'der eigene Weg bleibt offen').toBe(303);

		const gesetzt = (await holeTraktanden(betreiber, eines.v.id)).find(
			(x) => x.knoten.id === eines.t.id
		);
		expect(gesetzt?.knoten.erfordernis?.knotenId).toBe('k-baulich-nuetzlich');
	});
});
