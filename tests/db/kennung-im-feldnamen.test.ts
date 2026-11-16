/**
 * Kennung im Feldnamen unter Mandantenpfaden: eine Kennung von B im Namen
 * eines Feldes, unter einem Pfad von A (Ablaufplan S1, 29.10.2026).
 *
 * **Warum eigens.** Sechs Aktionen lesen die Kennung aus dem **Namen** eines
 * Feldes (`label.<einheit>`, `quote:<gemeinschaft>`, `wahl:<partei>`,
 * `wahl_<partei>` …). Der Kreuzteil von `e2e/fremdbetreiber.mjs` setzt seit
 * dem 28.10.2026 (`NACH_NAMEN` in `fremdbetreiber-kreuz.mjs`) die Kennung von
 * B auch in solche Namen und urteilt über die Antwort; hier kommt dazu, was
 * er nicht sieht: der Bestand beider Betreiber und die Gegenhälfte je Feld
 * am Wert in der Datenbank, auch für `quote:`, `vertretung:` und `wahl_`.
 * Die Teilnehmerseite `/z` (`wahl:`, `weisung:`) ist am 27.10.2026 gemessen
 * worden und steht hier nicht.
 *
 * **Gemessen wird die Wirkung, nicht die Antwort.** Je Versuch der Bestand
 * beider Betreiber als Prüfsumme über jede Tabelle mit `operator_id` (der
 * Verlauf eingeschlossen) und jede Zeile von A, die eine Kennung von B
 * trägt. Je Feld die Gegenhälfte: Mit der Kennung von A wirkt dasselbe
 * Feld. Ohne sie wüsste man nicht, ob der Versuch bloss nichts getroffen hat.
 *
 * Einordnung je Feld: **abgewiesen** (400, beide Bestände gleich),
 * **Leerlauf** (das Feld wird nicht gelesen, B gleich, kein Verlauf mit B),
 * **Wirkung** (B geändert oder B im Bestand oder Verlauf von A).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Wie in `absagen-statt-500.test.ts`: Die Routen ziehen `$app/environment`.
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

/*
 * **Kein Text geht hinaus.** `kipruefen` fragte mit einer Kennung von A die
 * KI-Stufen des Betreibers, sonst die der Umgebung. Hier steht an der Stelle
 * des Modells ein Ersatz, der jeden Auftrag mitschreibt und scheitert; so
 * zeigt die Gegenhälfte, dass der Auftrag bis zum Modell kommt, ohne es zu
 * fragen. Alles andere an `$lib/server/ki` bleibt echt.
 */
const modellAuftraege = vi.hoisted(() => [] as string[]);
vi.mock('$lib/server/ki', async (original) => ({
	...(await original<typeof import('$lib/server/ki')>()),
	kiEingerichtet: async () => true,
	frage: async (_betreiber: string, _system: string, auftrag: string) => {
		modellAuftraege.push(auftrag);
		return { ok: false, text: '', stufe: null, dauerMs: 0, fehlschlaege: ['Prüflauf: kein Modell'] };
	}
}));

import { isRedirect } from '@sveltejs/kit';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { oeffneAbstimmung } from '$lib/server/abstimmung';
import { haltNutzungFest } from '$lib/server/ki';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { actions as einheitenAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/einheiten/+page.server';
import { actions as eigentuemerAktionen } from '../../src/routes/gemeinschaften/[id=kennung]/eigentuemer/+page.server';
import { actions as neuAktionen } from '../../src/routes/gemeinschaften/neu/+page.server';
import { actions as leitungAktionen } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import { actions as abendAktionen } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import { actions as traktandenAktionen } from '../../src/routes/versammlungen/[id=kennung]/traktanden/+page.server';
import { actions as protokollAktionen } from '../../src/routes/versammlungen/[id=kennung]/protokoll/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let betreiberB: string;
let benutzerB: string;

const handelnderA = () => ({ operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' });
const handelnderB = () => ({ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' });
type Handelnder = ReturnType<typeof handelnderA>;

const GEMEINSCHAFT = {
	quotaDenominator: 900,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

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

/** Mindestens zehn Zeichen; die Erfassung durch die Leitung verlangt sie. */
const GRUND = 'Prüflauf: Telefon im Saal ausgefallen';

/** Eine Gemeinschaft mit zwei Einheiten und je einer Partei. */
async function haus(wer: Handelnder, name: string) {
	const g = await erstelleGemeinschaft(wer, { ...GEMEINSCHAFT, name });
	const einheiten: string[] = [];
	const parteien: string[] = [];
	for (const [i, person] of ['Probe Erst', 'Probe Zweit'].entries()) {
		const e = await erstelleEinheit(wer, {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 450 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(wer, {
			stwegId: g.id,
			kind: 'natural',
			displayName: person,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(wer, e.id, p.id, '2020-01-01');
		einheiten.push(e.id);
		parteien.push(p.id);
	}
	return { gemeinschaft: g.id, einheiten, parteien };
}

/**
 * Eine laufende Versammlung mit offener Abstimmung, alle eingelassen. Mit
 * `abend` sitzt sie an einem gemeinsamen Abend (für `/tage/<A>/leitung`).
 */
async function laufend(wer: Handelnder, name: string, abend = false) {
	const h = await haus(wer, name);
	const v = await erstelleVersammlung(wer, {
		stwegId: h.gemeinschaft,
		datum: '2026-12-01',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	let tag: string | null = null;
	if (abend) {
		const t = await erstelleVersammlungstag(wer, {
			bezeichnung: `${name}, Abend`,
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			anlass: null
		});
		await nimmInTagAuf(wer, t.id, v.id, 0);
		tag = t.id;
	}
	const t = await erstelleTraktandum(wer, {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(wer, v.id, t.id, ERFORDERNIS);
	await gibVersammlungFrei(wer, v.id);
	await eroeffneVersammlung(wer, v.id);
	for (const p of h.parteien) await bestaetigeAnwesenheit(wer, v.id, p, 'von_hand');
	await stelleAufTraktandum(wer, v.id, t.id);
	await oeffneAbstimmung(wer, v.id, t.id);
	return { ...h, versammlung: v.id, traktandum: t.id, tag };
}

/** Eine Aktion wie SvelteKit sie aufruft, als A. */
async function rufe(
	aktion: unknown,
	id: string | null,
	felder: [string, string][]
): Promise<{ status: number; daten?: unknown }> {
	const daten = new FormData();
	for (const [feld, wert] of felder) daten.append(feld, wert);
	const ereignis = {
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzerA,
				operatorId: betreiberA,
				username: 'pruefer-feldname-a',
				displayName: 'Prüferin A',
				role: 'admin'
			},
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
		if (isRedirect(f)) return { status: f.status };
		throw f;
	}
}

/** Der Satz, den die Seite zeigt: Absage oder Hinweis. */
function satzAus(daten: unknown): string {
	const d = (daten ?? {}) as { fehler?: string | { nachricht?: string }; hinweis?: string };
	if (typeof d.fehler === 'string') return d.fehler;
	return d.fehler?.nachricht ?? d.hinweis ?? '';
}

let tabellen: string[] = [];

/** Prüfsumme über alles, was einem Betreiber gehört, je Tabelle. */
async function bestand(betreiber: string): Promise<Record<string, string>> {
	const aus: Record<string, string> = {};
	for (const t of tabellen) {
		const [z] = await admin.unsafe<{ s: string | null }[]>(
			`SELECT md5(string_agg(x::text, '|' ORDER BY x::text)) AS s FROM ${t} x WHERE operator_id = $1`,
			[betreiber]
		);
		aus[t] = z.s ?? '';
	}
	return aus;
}

/** Was sich zwischen zwei Prüfsummen geändert hat, als Tabellennamen. */
function geaendert(vorher: Record<string, string>, nachher: Record<string, string>): string[] {
	return tabellen.filter((t) => vorher[t] !== nachher[t]);
}

/** Zeilen von A, die eine der Kennungen tragen, Verlauf eingeschlossen. */
async function vonAMit(kennungen: string[]): Promise<string[]> {
	const funde: string[] = [];
	for (const t of tabellen) {
		for (const k of kennungen) {
			const [z] = await admin.unsafe<{ n: number }[]>(
				`SELECT count(*)::int AS n FROM ${t} x WHERE operator_id = $1 AND x::text ~ $2`,
				[betreiberA, k]
			);
			if (z.n > 0) funde.push(`${t}: ${k}`);
		}
	}
	return funde;
}

/**
 * Ein Versuch mit Kennungen von B: Antwort, geänderte Tabellen beider
 * Betreiber, Funde der Kennungen von B im Bestand von A.
 */
async function versuche(aktion: unknown, id: string | null, felder: [string, string][], vonB: string[]) {
	const a = await bestand(betreiberA);
	const b = await bestand(betreiberB);
	const antwort = await rufe(aktion, id, felder);
	return {
		status: antwort.status,
		satz: satzAus(antwort.daten),
		daten: antwort.daten,
		aGeaendert: geaendert(a, await bestand(betreiberA)),
		bGeaendert: geaendert(b, await bestand(betreiberB)),
		bBeiA: await vonAMit(vonB)
	};
}

async function stimmenIn(versammlung: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM vote v JOIN voting_round r ON r.id = v.round_id
		 WHERE r.meeting_id = ${versammlung}
	`;
	return z.n;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf Feldname A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-feldname-a');
	betreiberB = await pruefbetreiber('Prüflauf Feldname B');
	benutzerB = await pruefbenutzer(betreiberB, 'pruefer-feldname-b');
	tabellen = (
		await admin<{ t: string }[]>`
			SELECT table_name AS t FROM information_schema.columns
			 WHERE table_schema = 'public' AND column_name = 'operator_id'
			 ORDER BY table_name
		`
	).map((z) => z.t);
}, 60_000);

afterAll(verbindungenSchliessen);

/*
 * `/gemeinschaften/<A>/einheiten?/speichern`: Die Kennungen stehen in
 * `einheitId` (mehrfach), die Werte in `<feld>.<kennung>`. Zwei Wege, eine
 * Kennung von B in den Namen zu bringen: neben einer Kennung von A in
 * `einheitId` (dann wird das Feld nie gelesen), oder mit ihr in `einheitId`.
 */
describe('Einheiten speichern: <feld>.<einheit von B>', () => {
	let a: Awaited<ReturnType<typeof haus>>;
	let b: Awaited<ReturnType<typeof haus>>;

	beforeAll(async () => {
		a = await haus(handelnderA(), 'Erfundenweg 11');
		b = await haus(handelnderB(), 'Ausgedachtweg 12');
	});

	/** Alle Felder einer Einheit, so wie die Maske sie schickt. */
	function zeile(id: string, label: string): [string, string][] {
		return [
			['einheitId', id],
			[`label.${id}`, label],
			[`kind.${id}`, 'unit'],
			[`q.${id}.stamm`, '450'],
			[`kopf.${id}`, 'on'],
			[`zimmer.${id}`, '3'],
			[`flaeche.${id}`, '80'],
			[`lage.${id}`, 'EG']
		];
	}

	/** Feld, gesendeter Wert, und was danach in der Datenbank steht. */
	const FELDER: [string, string, string][] = [
		['label', 'Von A umbenannt', 'Von A umbenannt'],
		['kind', 'parking', 'parking'],
		['q', '1', '1'],
		['kopf', '', 'false'],
		['zimmer', '9', '9.0'],
		['flaeche', '999', '999.00'],
		['lage', 'Dach', 'Dach']
	];

	/*
	 * **Der Wert der Spalte, nicht die Prüfsumme der Zeile** (Codeprüfung
	 * 29.10.2026): `unit_updated_at` setzt `updated_at` bei jedem Speichern, die
	 * Zeile ändert sich also auch dann, wenn ein Feld gar nicht gelesen wird.
	 */
	async function wertVon(feld: string, einheit: string): Promise<string> {
		if (feld === 'q') {
			const [z] = await admin<{ w: string }[]>`
				SELECT value::text AS w FROM unit_quota WHERE unit_id = ${einheit}
			`;
			return z.w;
		}
		const spalte = {
			label: 'label',
			kind: 'kind',
			kopf: 'counts_as_head',
			zimmer: 'rooms',
			flaeche: 'area_m2',
			lage: 'location'
		}[feld];
		const [z] = await admin.unsafe<{ w: string }[]>(`SELECT ${spalte}::text AS w FROM unit WHERE id = $1`, [
			einheit
		]);
		return z.w;
	}
	const name = (feld: string, id: string) => (feld === 'q' ? `q.${id}.stamm` : `${feld}.${id}`);

	it.each(FELDER)('%s.<B> mit einheitId von B: abgewiesen, nichts geändert', async (feld, wert) => {
		const fremd = b.einheiten[0];
		const e = await versuche(
			einheitenAktionen.speichern,
			a.gemeinschaft,
			[...zeile(fremd, 'Whg 1').filter(([n]) => n !== name(feld, fremd)), [name(feld, fremd), wert]],
			[fremd]
		);
		expect(e).toMatchObject({ status: 400, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		expect(e.satz).toBe('Eine der Einheiten gehört nicht zu dieser Gemeinschaft.');
	});

	it.each(FELDER)('%s.<B> neben einheitId von A: Leerlauf, B unverändert', async (feld, wert) => {
		const fremd = b.einheiten[0];
		const e = await versuche(
			einheitenAktionen.speichern,
			a.gemeinschaft,
			[...zeile(a.einheiten[0], 'Whg 1'), [name(feld, fremd), wert]],
			[fremd]
		);
		expect(e).toMatchObject({ status: 200, bGeaendert: [], bBeiA: [] });
	});

	it.each(FELDER)('%s.<A> mit einheitId von A wirkt (Gegenhälfte)', async (feld, wert, erwartet) => {
		const eigen = a.einheiten[1];
		await rufe(einheitenAktionen.speichern, a.gemeinschaft, zeile(eigen, 'Whg 2'));
		expect(await wertVon(feld, eigen)).not.toBe(erwartet);
		// Ein leeres Kästchen schickt der Browser gar nicht.
		const felder = zeile(eigen, 'Whg 2').filter(([n]) => n !== name(feld, eigen));
		if (wert !== '') felder.push([name(feld, eigen), wert]);
		const e = await versuche(einheitenAktionen.speichern, a.gemeinschaft, felder, []);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		expect(await wertVon(feld, eigen)).toBe(erwartet);
	});
});

/*
 * Mitglieder aufnehmen: `mitglied` (mehrfach) trägt die Kennung,
 * `quote:<kennung>` und `vertretung:<kennung>` die Werte. Zwei Wege:
 * `/gemeinschaften/<A>/eigentuemer?/mitgliederAnlegen` und das Anlegen unter
 * `/gemeinschaften/neu` (kein Mandantenpfad mit Kennung, derselbe Leser).
 */
describe('Mitglieder aufnehmen: quote:<gemeinschaft von B>, vertretung:<…>', () => {
	let meg: string;
	let hausA: string;
	let hausB: string;

	beforeAll(async () => {
		meg = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Erfundenweg 13', traegerschaft: 'stammgrundstueck' }, true)).id;
		hausA = (await haus(handelnderA(), 'Erfundenweg 13, Haus Nord')).gemeinschaft;
		hausB = (await haus(handelnderB(), 'Ausgedachtweg 14')).gemeinschaft;
	});

	const felder = (id: string): [string, string][] => [
		['mitglied', id],
		[`quote:${id}`, '300'],
		[`vertretung:${id}`, 'Verwaltung Muster'],
		['ab', '2026-01-01']
	];

	it('eigentuemer?/mitgliederAnlegen mit B in mitglied, quote: und vertretung:: abgewiesen', async () => {
		const e = await versuche(eigentuemerAktionen.mitgliederAnlegen, meg, felder(hausB), [hausB]);
		expect(e).toMatchObject({ status: 400, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		expect(e.satz).toMatch(/Eine gewählte Gemeinschaft gibt es nicht mehr/);
	});

	it('eigentuemer?/mitgliederAnlegen mit quote:<B> und vertretung:<B> neben Mitglied von A: Leerlauf', async () => {
		// Die Felder von B neben vollständigen Feldern von A: Gelesen wird nur,
		// was zu einer Kennung in `mitglied` gehört.
		const e = await versuche(
			eigentuemerAktionen.mitgliederAnlegen,
			meg,
			[...felder(hausA), [`quote:${hausB}`, '777'], [`vertretung:${hausB}`, 'Fremdvertretung']],
			[hausB]
		);
		expect(e).toMatchObject({ status: 200, bGeaendert: [], bBeiA: [] });
		const [z] = await admin<{ wert: number; vertretung: string }[]>`
			SELECT q.value AS wert, p.representative_name AS vertretung
			  FROM party p
			  JOIN unit_ownership o ON o.party_id = p.id
			  JOIN unit_quota q ON q.unit_id = o.unit_id
			 WHERE p.stweg_id = ${meg} AND p.member_stweg_id = ${hausA}
		`;
		expect(z).toEqual({ wert: 300, vertretung: 'Verwaltung Muster' });
	});

	it('eigentuemer?/mitgliederAnlegen mit A wirkt (Gegenhälfte)', async () => {
		const zweites = (await haus(handelnderA(), 'Erfundenweg 13, Haus Süd')).gemeinschaft;
		const e = await versuche(eigentuemerAktionen.mitgliederAnlegen, meg, felder(zweites), []);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM party WHERE stweg_id = ${meg} AND member_stweg_id = ${zweites}
		`;
		expect(z.n).toBe(1);
	});

	it('gemeinschaften/neu mit B in mitglied, quote: und vertretung:: kein Mitglied von B', async () => {
		const e = await versuche(
			neuAktionen.default,
			null,
			[['name', 'Erfundenweg 15'], ['quotaDenominator', '900'], ['headCountMode', 'per_owner'], ['traegerschaft', 'stammgrundstueck'], ...felder(hausB)],
			[hausB]
		);
		// Die Gemeinschaft selbst steht (Teilerfolg, so gewollt), das Mitglied nicht.
		expect(e).toMatchObject({ status: 200, bGeaendert: [], bBeiA: [] });
		expect(e.satz).toMatch(/Eine gewählte Gemeinschaft gibt es nicht mehr/);
		expect(e.aGeaendert).not.toContain('party');
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM party WHERE member_stweg_id = ${hausB}
		`;
		expect(z.n).toBe(0);
	});

	it('gemeinschaften/neu mit A legt das Mitglied an (Gegenhälfte)', async () => {
		const drittes = (await haus(handelnderA(), 'Erfundenweg 16, Haus Ost')).gemeinschaft;
		const e = await versuche(
			neuAktionen.default,
			null,
			[['name', 'Erfundenweg 16'], ['quotaDenominator', '900'], ['headCountMode', 'per_owner'], ['traegerschaft', 'stammgrundstueck'], ...felder(drittes)],
			[]
		);
		expect(e).toMatchObject({ status: 303, bGeaendert: [] });
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM party WHERE member_stweg_id = ${drittes}
		`;
		expect(z.n).toBe(1);
	});
});

/*
 * Stimmen erfassen: `wahl:<partei>` (Leitung von Versammlung und Abend),
 * `wahl_<partei>` (Beschluss von Hand). Die Partei von B steht in einer
 * laufenden Versammlung von B mit offener Abstimmung, damit ein Durchschlag
 * dort etwas zu schreiben fände.
 */
describe('Stimmen: wahl:<partei von B>, wahl_<partei von B>', () => {
	let a: Awaited<ReturnType<typeof laufend>>;
	let abendA: Awaited<ReturnType<typeof laufend>>;
	let b: Awaited<ReturnType<typeof laufend>>;

	beforeAll(async () => {
		a = await laufend(handelnderA(), 'Erfundenweg 21');
		abendA = await laufend(handelnderA(), 'Erfundenweg 22', true);
		b = await laufend(handelnderB(), 'Ausgedachtweg 23');
	}, 60_000);

	it('versammlungen/<A>/leitung?/erfassen, nur wahl:<B>: abgewiesen', async () => {
		const fremd = b.parteien[0];
		const e = await versuche(leitungAktionen.erfassen, a.versammlung, [[`wahl:${fremd}`, 'yes'], ['begruendung', GRUND]], [fremd]);
		expect(e).toMatchObject({ status: 400, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		expect(e.satz).toMatch(/nicht als anwesend erfasst/);
		expect(await stimmenIn(b.versammlung)).toBe(0);
	});

	it('versammlungen/<A>/leitung?/erfassen, wahl:<B> neben wahl:<A>: abgewiesen, auch A nicht', async () => {
		const fremd = b.parteien[0];
		const e = await versuche(
			leitungAktionen.erfassen,
			a.versammlung,
			[[`wahl:${a.parteien[0]}`, 'yes'], [`wahl:${fremd}`, 'yes'], ['begruendung', GRUND]],
			[fremd]
		);
		expect(e).toMatchObject({ status: 400, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		expect(e.satz).toMatch(/nicht als anwesend erfasst/);
		expect(await stimmenIn(a.versammlung)).toBe(0);
	});

	it('versammlungen/<A>/leitung?/erfassen, wahl:<A> wirkt (Gegenhälfte)', async () => {
		const e = await versuche(
			leitungAktionen.erfassen,
			a.versammlung,
			[[`wahl:${a.parteien[0]}`, 'yes'], ['begruendung', GRUND]],
			[]
		);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		expect(await stimmenIn(a.versammlung)).toBe(1);
	});

	it('tage/<A>/leitung?/erfassen, wahl:<B>: abgewiesen', async () => {
		const fremd = b.parteien[0];
		const e = await versuche(
			abendAktionen.erfassen,
			abendA.tag,
			[['versammlung', abendA.versammlung], [`wahl:${fremd}`, 'no'], ['begruendung', GRUND]],
			[fremd]
		);
		expect(e).toMatchObject({ status: 400, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		expect(e.satz).toMatch(/nicht als anwesend erfasst/);
		expect(await stimmenIn(b.versammlung)).toBe(0);
	});

	it('tage/<A>/leitung?/erfassen, wahl:<A> wirkt (Gegenhälfte)', async () => {
		const e = await versuche(
			abendAktionen.erfassen,
			abendA.tag,
			[['versammlung', abendA.versammlung], [`wahl:${abendA.parteien[0]}`, 'no'], ['begruendung', GRUND]],
			[]
		);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		expect(await stimmenIn(abendA.versammlung)).toBe(1);
	});

	it('versammlungen/<A>/leitung?/beschlussVonHand, wahl_<B>: kein Beschluss mit B', async () => {
		const fremd = b.parteien[0];
		const v = await laufend(handelnderA(), 'Erfundenweg 24');
		const e = await versuche(
			leitungAktionen.beschlussVonHand,
			v.versammlung,
			[
				['traktandum', v.traktandum],
				['erfassung', 'parteien'],
				[`wahl_${fremd}`, 'yes'],
				['ergebnis', 'angenommen'],
				['begruendung', GRUND]
			],
			[fremd]
		);
		expect(e).toMatchObject({ status: 400, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		expect(e.satz).toMatch(/nicht im festgehaltenen Stand der Stimmberechtigten/);
	});

	it('versammlungen/<A>/leitung?/beschlussVonHand, wahl_<A> wirkt (Gegenhälfte)', async () => {
		const v = await laufend(handelnderA(), 'Erfundenweg 25');
		const e = await versuche(
			leitungAktionen.beschlussVonHand,
			v.versammlung,
			[
				['traktandum', v.traktandum],
				['erfassung', 'parteien'],
				[`wahl_${v.parteien[0]}`, 'yes'],
				[`wahl_${v.parteien[1]}`, 'yes'],
				['ergebnis', 'angenommen'],
				['begruendung', GRUND]
			],
			[]
		);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		expect(e.aGeaendert).toContain('voting_round');
	});
});

/*
 * Die beiden Reste der Pendenz «Eigener Pfad, fremde Kennung im Feld»: Hier
 * steht die Kennung im **Wert** (`traktandumId`, `nutzungId`), nicht im Namen.
 * `kipruefen` war am 28.10.2026 ohne Gegenhälfte geblieben, `kiuebernehmen`
 * als begründeter Entscheid geführt (Bericht 27.10.2026, 3.5).
 */
describe('KI: kipruefen mit traktandumId, kiuebernehmen mit nutzungId von B', () => {
	let a: Awaited<ReturnType<typeof laufend>>;
	let b: Awaited<ReturnType<typeof laufend>>;

	beforeAll(async () => {
		a = await laufend(handelnderA(), 'Erfundenweg 31');
		b = await laufend(handelnderB(), 'Ausgedachtweg 32');
		await admin`UPDATE stweg SET ai_enabled = true WHERE id IN (${a.gemeinschaft}, ${b.gemeinschaft})`;
	}, 60_000);

	it('traktanden?/kipruefen mit einem Traktandum von B: abgesagt, kein Auftrag ans Modell', async () => {
		const vorher = modellAuftraege.length;
		const e = await versuche(traktandenAktionen.kipruefen, a.versammlung, [['traktandumId', b.traktandum]], [b.traktandum]);
		expect(e).toMatchObject({ status: 200, aGeaendert: [], bGeaendert: [], bBeiA: [] });
		// Die Bindung in `pruefeTraktandum` sagt ab (FR-62: als Ergebnis, nicht als Wurf).
		expect(JSON.stringify(e.daten)).toContain('Das Traktandum gibt es nicht mehr.');
		expect(JSON.stringify(e)).not.toContain('Fassadensanierung');
		expect(modellAuftraege.length).toBe(vorher);
	});

	it('traktanden?/kipruefen mit dem eigenen Traktandum erreicht das Modell (Gegenhälfte)', async () => {
		const vorher = modellAuftraege.length;
		const e = await versuche(traktandenAktionen.kipruefen, a.versammlung, [['traktandumId', a.traktandum]], []);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		expect(modellAuftraege.length).toBe(vorher + 1);
		expect(modellAuftraege.at(-1)).toContain('Fassadensanierung');
		// Der Fehlschlag steht im Nachweis von A.
		expect(e.aGeaendert).toContain('ai_usage');
	});

	/** Eine Nutzung des Protokollentwurfs, wie sie die Seite anlegt. */
	async function nutzung(wer: Handelnder, s: { gemeinschaft: string; versammlung: string; traktandum: string }) {
		return haltNutzungFest(wer, {
			stwegId: s.gemeinschaft,
			meetingId: s.versammlung,
			funktion: 'protokollentwurf',
			gegenstandArt: 'agenda_item',
			gegenstandId: s.traktandum
		});
	}

	async function ausgang(nutzungId: string): Promise<string | null> {
		const [z] = await admin<{ outcome: string | null }[]>`SELECT outcome FROM ai_usage WHERE id = ${nutzungId}`;
		return z.outcome;
	}

	it('protokoll?/kiuebernehmen mit einer Nutzung von B: Notiz von A geschrieben, B unberührt', async () => {
		const fremd = await nutzung(handelnderB(), b);
		const e = await versuche(
			protokollAktionen.kiuebernehmen,
			a.versammlung,
			[['traktandumId', a.traktandum], ['absatz', 'Übernommener Absatz A'], ['nutzungId', fremd]],
			[fremd]
		);
		// So entschieden (Code-Review 02.09.2026): Der Vermerk lässt die
		// Übernahme nicht scheitern. Gemessen wird, dass er B nicht erreicht.
		expect(e).toMatchObject({ status: 200, bGeaendert: [], bBeiA: [] });
		expect(e.satz).toBe('Absatz übernommen. Die Notiz lautet jetzt so.');
		expect(await ausgang(fremd)).toBeNull();
	});

	it('protokoll?/kiuebernehmen mit der eigenen Nutzung vermerkt den Entscheid (Gegenhälfte)', async () => {
		const eigen = await nutzung(handelnderA(), a);
		const e = await versuche(
			protokollAktionen.kiuebernehmen,
			a.versammlung,
			[['traktandumId', a.traktandum], ['absatz', 'Übernommener Absatz A, zweite Fassung'], ['nutzungId', eigen]],
			[]
		);
		expect(e).toMatchObject({ status: 200, bGeaendert: [] });
		expect(await ausgang(eigen)).toBe('angenommen');
	});
});
