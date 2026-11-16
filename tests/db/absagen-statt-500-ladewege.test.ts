/**
 * Absagen statt 500 auf den **Ladewegen** (Block B2 des Abschlusses, 16.10.2026).
 *
 * **Die Erhebung.** F7 (`absagen-statt-500.test.ts`) hat die 134 Aktionen mit
 * Kennungsfeld behoben. Offen blieben zwei Klassen, die dort nicht erhoben
 * wurden: Wege, die `sql` unmittelbar benutzen und damit an der zentralen
 * Übersetzung in `db.ts` vorbeigehen, und Ladefunktionen, die einen
 * `FachlicherFehler` oder einen rohen Datenbankfehler nicht fangen. Gemessen
 * wurde jede Stelle per HTTP gegen den Dev-Stapel (16.10.2026, Konto
 * `pruefer`), fünf Stellen gaben 500:
 *
 *   1. `GET /quorum?g=x`: `holeGemeinschaft` wirft, der `load` fängt erst
 *      später (`try` erst um den Entscheidbaum).
 *   2. `GET /gemeinschaften/<id>?zur=x`: dieselbe Klasse im Layout-Load; die
 *      Helfer sind ausdrücklich «still bei unbekannter Kennung» gedacht,
 *      eine falsch geformte kam aber nie bis zu dieser Absicht.
 *   3. `GET /gemeinschaften/<id>/eigentuemer?stichtag=x`: der Stichtag geht
 *      ungeprüft in `stimmkraftAnsicht` und endete als rohe Ausnahme.
 *   4. `GET /personen/<id>?stichtag=x`: dieselbe Klasse in
 *      `einheitenDerPerson` und `frueheresEigentumDerPerson`.
 *   5. `GET /e/tag/<merkmal>?haus=<36 Zeichen, keine UUID>`: die
 *      Formprüfung in `saalmerkmalDesHauses` (`[0-9a-f-]{36}`) liess jede
 *      36-stellige Zeichenkette durch, `abendeinstieg_haus(text, uuid)` warf
 *      22P02 aus einem unmittelbaren `sql`-Aufruf.
 *
 * **Aufgerufen werden die Ladefunktionen selbst**, wie im Vorbild die
 * Aktionen: Die Abwehr sitzt in der Schale (Formatprüfung, gemeinsamer Fang),
 * und ein Test gegen die Funktionen darunter sähe von ihr nichts.
 *
 * **Was «keine rohe Ausnahme» heisst.** Ein `error(4xx)` ist der kontrollierte
 * Ausgang (im Betrieb die Absageseite), `fail(...)` gibt es in `load` nicht. Ein
 * gewöhnlicher Rückgabewert ist der Erfolg. Alles andere, ein `PostgresError`,
 * ein `TypeError`, ein `error` ab 500, ist die 500 im Betrieb.
 *
 * **Und die Gegenproben.** Jeder stille Fall (2, 5) bekommt denselben Weg mit
 * gültigen Werten: Ein Test, der nur «wirft nicht» prüft, wäre auch grün, wenn
 * die Funktion gar nichts mehr täte. Und jeder Absage-Fall (1, 3, 4) zeigt mit
 * gültigem Wert, dass der Weg weiterhin ganz durchläuft.
 *
 * **Ohne die Abwehr ist diese Datei rot**: alle fünf Fälle enden roh, die
 * fünf Gegenproben bleiben grün (nachgemessen 16.10.2026 bei der Übernahme,
 * Quellen auf dem Stand davor). Dazu seit der Codeprüfung der Fall
 * `verlauf · ?seite=`, ohne Abwehr rot mit 22P02 an `OFFSET`. Die Protokollzeile verlangt nur
 * Fall 1: Dort erreicht die Kennung wirklich eine Abfrage und `kennungsfehler`
 * schreibt «Ungültige Kennung in einer Abfrage»; die Fälle 3 und 4 fängt die
 * Formatprüfung vor der Abfrage ab, und 2 und 5 sollen ausdrücklich still
 * bleiben.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

/*
 * `$app/environment` gibt es ausserhalb von SvelteKit nicht; dieselbe
 * Begründung wie in `absagen-statt-500.test.ts`.
 */
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstellePerson } from '$lib/server/personen';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { holeOderErzeugeAbendmerkmal, saalmerkmalDesHauses } from '$lib/server/saaleinstieg';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { load as quorumLoad } from '../../src/routes/quorum/+page.server';
import { load as gemeinschaftLoad } from '../../src/routes/gemeinschaften/[id=kennung]/+layout.server';
import { load as eigentuemerLoad } from '../../src/routes/gemeinschaften/[id=kennung]/eigentuemer/+page.server';
import { load as personenLoad } from '../../src/routes/personen/[id=kennung]/+page.server';
import { load as abendLoad } from '../../src/routes/e/tag/[merkmal]/+page.server';
import { load as verlaufLoad } from '../../src/routes/verlauf/+page.server';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
/** Die Gemeinschaft der beiden Gemeinschafts-Ladewege. */
let stweg: string;
/** Eine laufende Versammlung dieser Gemeinschaft, die gültige Herkunft. */
let versammlung: string;
/** Die Person des Personen-Ladewegs. */
let person: string;
/** Der Abend mit Merkmal, der Bestand des `e/tag`-Ladewegs. */
let abendmerkmal: string;
/** Das Saalmerkmal des Hauses, die gültige Gegenprobe zu `?haus=`. */
let hausmerkmal: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüferin' };
}

/** Das Erfordernis des Traktandums, derselbe Bestand wie im Vorbild. */
const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Prüflauf Ladewege');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-ladewege');

	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Prüflauf Ladewege',
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		aiEnabled: false
	});
	stweg = g.id;

	const einheit = await erstelleEinheit(handelnder(), {
		stwegId: stweg,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 900 },
		countsAsHead: true
	});
	const partei = await erstelleEigentuemer(handelnder(), {
		stwegId: stweg,
		kind: 'natural',
		displayName: 'Probe Halterin',
		representativeName: null,
		isCommunity: false
	});
	await ordneEigentumZu(handelnder(), einheit.id, partei.id, '2020-01-01');

	const p = await erstellePerson(handelnder(), { name: 'Probe Person' });
	person = p.id;

	const v = await erstelleVersammlung(handelnder(), {
		stwegId: stweg,
		datum: '2026-03-01',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	versammlung = v.id;
	// Ein Traktandum, damit die Freigabe ohne Blocker durchläuft (wie im Vorbild).
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: versammlung,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(), versammlung, t.id, ERFORDERNIS);
	await gibVersammlungFrei(handelnder(), versammlung);
	await eroeffneVersammlung(handelnder(), versammlung);

	const d = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: 'Prüfabend Ladewege',
		datum: '2026-03-01',
		uhrzeit: '19:00',
		ort: 'Prüfsaal'
	});
	await nimmInTagAuf(handelnder(), d.id, versammlung, 0);
	abendmerkmal = await holeOderErzeugeAbendmerkmal(betreiber, d.id);
	// Das Hausmerkmal über denselben Weg, den die Weiterleitung nimmt.
	hausmerkmal = (await saalmerkmalDesHauses(abendmerkmal, versammlung)) ?? '';
}, 60000);

afterAll(verbindungenSchliessen);

/** Eine echte 36-Zeichen-Kennung, die keine UUID ist, der Befund zu Fall 5. */
const KEINE_KENNUNG = 'a'.repeat(36);

type Lader = (ereignis: never) => unknown;

/** Was aus einem Aufruf herauskam. */
type Ausgang =
	| { art: 'absage'; status: number }
	| { art: 'erfolg'; wert: unknown }
	| { art: 'umleitung'; ziel: string }
	| { art: 'roh'; fehler: unknown };

async function fahre(laden: Lader, adresse: string, params: Record<string, string>): Promise<Ausgang> {
	const ereignis = {
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-ladewege',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		url: new URL(adresse),
		params,
		route: { id: '/pruefung' }
	};

	try {
		return { art: 'erfolg', wert: await laden(ereignis as never) };
	} catch (fehler) {
		if (isRedirect(fehler)) {
			return { art: 'umleitung', ziel: String((fehler as { location: string }).location) };
		}
		// `error(4xx)` ist der kontrollierte Ausgang, `error(5xx)` die 500-Seite.
		if (isHttpError(fehler) && fehler.status < 500) return { art: 'absage', status: fehler.status };
		return { art: 'roh', fehler };
	}
}

/** Die Sicht auf eine rohe Ausnahme, kurz wie im Vorbild. */
function sichtbar(fehler: unknown): string {
	return fehler instanceof Error ? `${fehler.name}: ${fehler.message.split('\n')[0]}` : String(fehler);
}

describe('Ungültige Abfragegrössen auf Ladewegen ergeben eine Absage, keine rohe Ausnahme', () => {
	it('quorum · ?g=x', async () => {
		const spion = vi.spyOn(console, 'error');
		let erreicht = false;
		const ausgang = await fahre(quorumLoad as Lader, 'http://pruefung.example/quorum?g=x', {}).finally(
			() => {
				// Vor dem Zurücksetzen lesen: `mockRestore` leert die Aufrufe.
				erreicht = spion.mock.calls.some((aufruf) =>
					String(aufruf[0]).includes('Ungültige Kennung in einer Abfrage')
				);
				spion.mockRestore();
			}
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme statt Absage: ${sichtbar(ausgang.fehler)}. quorum · ?g=x`);
		}
		if (!erreicht) {
			expect.fail(
				'keine 500, aber die Kennung hat die Abfrage nicht erreicht; der Fall misst nichts.'
			);
		}
		expect(ausgang).toMatchObject({ art: 'absage' });
	});

	it('eigentuemer · ?stichtag=x', async () => {
		const ausgang = await fahre(
			eigentuemerLoad as Lader,
			`http://pruefung.example/gemeinschaften/${stweg}/eigentuemer?stichtag=x`,
			{ id: stweg }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme statt Absage: ${sichtbar(ausgang.fehler)}. eigentuemer · ?stichtag=x`);
		}
		expect(ausgang).toMatchObject({ art: 'absage', status: 400 });
	});

	it('personen · ?stichtag=x', async () => {
		const ausgang = await fahre(
			personenLoad as Lader,
			`http://pruefung.example/personen/${person}?stichtag=x`,
			{ id: person }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme statt Absage: ${sichtbar(ausgang.fehler)}. personen · ?stichtag=x`);
		}
		expect(ausgang).toMatchObject({ art: 'absage', status: 400 });
	});

	/*
	 * **Aus der Codeprüfung zu B2** (16.10.2026): Eine Seitenzahl mit Bruch
	 * oder Exponent lief bis in `OFFSET`, und PostgreSQL wies sie mit 22P02 ab.
	 * Keine Absage, sondern still die erste Seite, wie bei einem fehlenden Wert.
	 */
	it('verlauf · ?seite=0.01 und 1e20 fallen auf die erste Seite', async () => {
		for (const seite of ['0.01', '1e20']) {
			const ausgang = await fahre(
				verlaufLoad as Lader,
				`http://pruefung.example/verlauf?seite=${seite}`,
				{}
			);
			if (ausgang.art === 'roh') {
				expect.fail(`rohe Ausnahme: ${sichtbar(ausgang.fehler)}. verlauf · ?seite=${seite}`);
			}
			expect(ausgang).toMatchObject({ art: 'erfolg', wert: { seite: 0 } });
		}
	});

	it('gemeinschaften · ?zur=x bleibt still', async () => {
		const ausgang = await fahre(
			gemeinschaftLoad as Lader,
			`http://pruefung.example/gemeinschaften/${stweg}?zur=x`,
			{ id: stweg }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme statt Absage: ${sichtbar(ausgang.fehler)}. gemeinschaften · ?zur=x`);
		}
		expect(ausgang).toMatchObject({
			art: 'erfolg',
			wert: { ablauf: null, abendhaeuser: [] }
		});
	});

	it('e/tag · ?haus=<keine Kennung> bleibt still', async () => {
		const ausgang = await fahre(
			abendLoad as Lader,
			`http://pruefung.example/e/tag/${abendmerkmal}?haus=${KEINE_KENNUNG}`,
			{ merkmal: abendmerkmal }
		);
		if (ausgang.art === 'roh') {
			expect.fail(
				`rohe Ausnahme statt Absage: ${sichtbar(ausgang.fehler)}. e/tag · ?haus=<keine Kennung>`
			);
		}
		expect(ausgang).toMatchObject({ art: 'erfolg', wert: { gueltig: true, fehlgeschlagen: true } });
	});
});

describe('Die Gegenproben: dieselben Wege mit gültigen Werten', () => {
	it('quorum mit gültiger Gemeinschaft lädt durch', async () => {
		const ausgang = await fahre(
			quorumLoad as Lader,
			`http://pruefung.example/quorum?g=${stweg}`,
			{}
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme: ${sichtbar(ausgang.fehler)}. quorum mit gültigem g`);
		}
		expect(ausgang).toMatchObject({ art: 'erfolg', wert: { gemeinschaftId: stweg } });
	});

	it('eigentuemer mit gültigem Stichtag lädt durch', async () => {
		const ausgang = await fahre(
			eigentuemerLoad as Lader,
			`http://pruefung.example/gemeinschaften/${stweg}/eigentuemer?stichtag=2026-03-01`,
			{ id: stweg }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme: ${sichtbar(ausgang.fehler)}. eigentuemer mit gültigem Stichtag`);
		}
		expect(ausgang).toMatchObject({ art: 'erfolg' });
	});

	it('personen mit gültigem Stichtag lädt durch', async () => {
		const ausgang = await fahre(
			personenLoad as Lader,
			`http://pruefung.example/personen/${person}?stichtag=2026-03-01`,
			{ id: person }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme: ${sichtbar(ausgang.fehler)}. personen mit gültigem Stichtag`);
		}
		expect(ausgang).toMatchObject({ art: 'erfolg' });
	});

	it('gemeinschaften mit gültiger Herkunft trägt den Ablauf', async () => {
		const ausgang = await fahre(
			gemeinschaftLoad as Lader,
			`http://pruefung.example/gemeinschaften/${stweg}?zur=${versammlung}`,
			{ id: stweg }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme: ${sichtbar(ausgang.fehler)}. gemeinschaften mit gültigem zur`);
		}
		const wert = (ausgang as { wert: { ablauf: { versammlungId: string } | null } }).wert;
		expect(wert.ablauf?.versammlungId).toBe(versammlung);
	});

	it('verlauf mit ganzer Seitenzahl bleibt auf dieser Seite', async () => {
		const ausgang = await fahre(verlaufLoad as Lader, 'http://pruefung.example/verlauf?seite=2', {});
		expect(ausgang).toMatchObject({ art: 'erfolg', wert: { seite: 2 } });
	});

	it('e/tag mit gültigem Haus leitet auf dessen Einstieg weiter', async () => {
		const ausgang = await fahre(
			abendLoad as Lader,
			`http://pruefung.example/e/tag/${abendmerkmal}?haus=${versammlung}`,
			{ merkmal: abendmerkmal }
		);
		if (ausgang.art === 'roh') {
			expect.fail(`rohe Ausnahme: ${sichtbar(ausgang.fehler)}. e/tag mit gültigem haus`);
		}
		expect(ausgang).toMatchObject({ art: 'umleitung', ziel: `/e/${hausmerkmal}` });
	});
});
