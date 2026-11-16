/**
 * Der Wächter über die Klasse K2: Kein Verlaufseintrag unter A nennt eine
 * Kennung einer Zeile von B (Migration 177, Auftrag 2e).
 *
 * **Der Anlass** (`docs/pendenzen-sicherheit.md`, «Wächter über die Klasse
 * K2»). Je Weg und je Lauf kam ein neuer Fall: ein Schreibweg, dessen Abfragen
 * unter dem Zeilenschutz nichts trafen und der trotzdem Verlauf schrieb, mit
 * der Kennung von B als Gegenstand (27.10.2026) oder in den Angaben (`umordnen`,
 * Auftrag 2d). Die Prüfungen im Code bleiben; hier steht, dass die Datenbank
 * einen solchen Eintrag auch ohne sie abweist.
 *
 * Drei Teile: am Schema unter der Anwendungsrolle (abgewiesen und die
 * Gegenhälften, die durchgehen müssen), über `alsBetreiber` (die fachliche
 * Absage, und die Änderung derselben Transaktion verschwindet mit), und die
 * Liste in der Funktion gegen den Katalog.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { alsBetreiber } from '$lib/server/db';
import { schreibeVerlauf } from '$lib/server/audit';
import { fuehreUebernahmeAus } from '$lib/server/uebernahme';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import { admin, imKontext, ohneKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

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

/** Ein Eintrag unter A, so wie `schreibeVerlauf` ihn schreibt, aber ohne die Schale. */
function eintragUnterA(subjectId: string | null, detail: Record<string, unknown>) {
	return imKontext(betreiberA, async (tx) => {
		await tx`
			INSERT INTO audit_entry (operator_id, actor_user_id, actor_label, event_type,
			                         subject_type, subject_id, detail)
			VALUES (${betreiberA}, ${benutzerA}, 'Prüferin A', 'pruefung.k2',
			        'stweg', ${subjectId}, ${tx.json(detail as never)})
		`;
	});
}

/** Einträge irgendeines Betreibers, die die Kennung tragen. */
async function eintraegeMit(kennung: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM audit_entry x WHERE x::text ~* ${kennung}
	`;
	return z.n;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf K2 A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-k2-a');
	betreiberB = await pruefbetreiber('Prüflauf K2 B');
	benutzerB = await pruefbenutzer(betreiberB, 'pruefer-k2-b');
	gemeinschaftA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Erfundenweg 11' })).id;
	gemeinschaftB = (await erstelleGemeinschaft(handelnderB(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 12' })).id;
});

afterAll(verbindungenSchliessen);

describe('am Schema: ein Eintrag unter A mit einer Kennung von B', () => {
	it('als Gegenstand wird abgewiesen', async () => {
		const vorher = await eintraegeMit(gemeinschaftB);
		await expect(eintragUnterA(gemeinschaftB, {})).rejects.toMatchObject({ code: 'VO177' });
		expect(await eintraegeMit(gemeinschaftB)).toBe(vorher);
	});

	it('in den Angaben wird abgewiesen, wie bei `umordnen` (`traktandum`)', async () => {
		const vorher = await eintraegeMit(gemeinschaftB);
		await expect(eintragUnterA(gemeinschaftA, { traktandum: gemeinschaftB })).rejects.toMatchObject({
			code: 'VO177'
		});
		expect(await eintraegeMit(gemeinschaftB)).toBe(vorher);
	});

	it('auch verschachtelt, als Schlüssel, in einem längeren Text und gross geschrieben', async () => {
		const formen: Record<string, unknown>[] = [
			{ liste: [{ weg: [gemeinschaftA, gemeinschaftB] }] },
			{ [gemeinschaftB]: true },
			{ pfad: `/gemeinschaften/${gemeinschaftB}/reglement` },
			{ kennung: gemeinschaftB.toUpperCase() }
		];
		for (const detail of formen) {
			await expect(eintragUnterA(null, detail), JSON.stringify(detail)).rejects.toMatchObject({
				code: 'VO177'
			});
		}
		// Als Gegenstand in einem längeren Text, falls ein Weg so schreibt.
		await expect(eintragUnterA(`stweg:${gemeinschaftB}`, {})).rejects.toMatchObject({ code: 'VO177' });
	});

	it('mit einer Kennung von A geht er durch (Gegenhälfte)', async () => {
		const vorher = await eintraegeMit(gemeinschaftA);
		await eintragUnterA(gemeinschaftA, { traktandum: gemeinschaftA, frei: randomUUID() });
		expect(await eintraegeMit(gemeinschaftA)).toBe(vorher + 1);
	});

	it('mit der Kennung einer gelöschten Zeile geht er durch (`agenda.item.removed`)', async () => {
		const weg = (await erstelleGemeinschaft(handelnderB(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 13' })).id;
		await admin`DELETE FROM stweg WHERE id = ${weg}`;
		await eintragUnterA(weg, { traktandum: weg });
		expect(await eintraegeMit(weg)).toBeGreaterThanOrEqual(1);
	});

	it('ohne Betreiber geht er durch, auch mit einer Kennung von B', async () => {
		const vorher = await eintraegeMit(gemeinschaftB);
		await ohneKontext(async (tx) => {
			await tx`
				INSERT INTO audit_entry (operator_id, actor_label, event_type, subject_type, subject_id, detail)
				VALUES (NULL, 'System', 'pruefung.k2', 'stweg', ${gemeinschaftB},
				        ${tx.json({ traktandum: gemeinschaftB } as never)})
			`;
		});
		expect(await eintraegeMit(gemeinschaftB)).toBe(vorher + 1);
	});
});

describe('über den Weg: die Absage kommt fachlich an, und die Änderung verschwindet mit', () => {
	/*
	 * Ein Schreibweg ohne Trefferprüfung, nachgebaut wie `umordnen` vor
	 * Auftrag 2d: Er ändert eine eigene Zeile und schreibt den Verlauf mit der
	 * Kennung aus dem Formular. Die Prüfung im Code fehlt hier absichtlich; am
	 * echten Weg wurde dasselbe einmal mit ausgebauter Prüfung gefahren
	 * (Bericht zu Auftrag 2e).
	 */
	async function wegOhnePruefung(kennungAusFormular: string) {
		await alsBetreiber(betreiberA, async (tx) => {
			await tx`UPDATE stweg SET name = 'Erfundenweg 11, umbenannt' WHERE id = ${gemeinschaftA}`;
			await schreibeVerlauf(
				tx,
				handelnderA(),
				ereignis(
					EREIGNISARTEN.geschaeftVerschoben,
					{ art: 'stweg', id: gemeinschaftA },
					{ traktandum: kennungAusFormular, vor: null, ebene: 'gemeinschaft' }
				)
			);
		});
	}

	it('mit einer Kennung von B: Absage `fremde_kennung`, kein Verlauf, Name unverändert', async () => {
		const vorher = await eintraegeMit(gemeinschaftB);
		const fehler = await wegOhnePruefung(gemeinschaftB).catch((f: unknown) => f);
		expect(fehler).toBeInstanceOf(FachlicherFehler);
		expect(fehler).toMatchObject({ kennung: 'fremde_kennung' });
		// Der Satz nennt weder Tabelle noch Kennung (er läuft auch unter `/z`).
		expect((fehler as Error).message).not.toMatch(/stweg|audit|[0-9a-f]{8}-/i);
		expect(await eintraegeMit(gemeinschaftB)).toBe(vorher);
		const [g] = await admin<{ name: string }[]>`SELECT name FROM stweg WHERE id = ${gemeinschaftA}`;
		expect(g.name).toBe('Erfundenweg 11');
	});

	it('mit einer Kennung von A geht derselbe Weg durch (Gegenhälfte)', async () => {
		const vorher = await eintraegeMit(gemeinschaftA);
		await wegOhnePruefung(gemeinschaftA);
		expect(await eintraegeMit(gemeinschaftA)).toBeGreaterThan(vorher);
		await admin`UPDATE stweg SET name = 'Erfundenweg 11' WHERE id = ${gemeinschaftA}`;
	});
});

describe('Übernahme aus Datei unter A mit der Gemeinschaft von B', () => {
	/*
	 * Eigene Pendenz (`docs/pendenzen-sicherheit.md`, «Übernahme aus Datei:
	 * Verlauf über eine Gemeinschaft, die es unter A nicht gibt»): Bleibt der
	 * Plan leer, läuft kein INSERT, das am Fremdschlüssel scheitern könnte, und
	 * `uebernahmeBestaetigt` nennt die Gemeinschaft von B. Hier steht nur, dass
	 * kein solcher Eintrag entsteht. Seit Auftrag 2f sagt die Prüfung in
	 * `fuehreUebernahmeAus` vorher ab; dass die Absage aus dem Code kommt und
	 * nicht vom Wächter, belegt `uebernahme-fremde-gemeinschaft.test.ts`
	 * ausserhalb von `MEINEN_IHN`.
	 */
	it('eine Datei ohne übernehmbare Zeile: Absage und kein Verlauf unter A über B', async () => {
		const leer = 'voter_ref;display_name;person_names;ownership_type;legal_representatives\n';
		const vorher = await eintraegeMit(gemeinschaftB);
		const fehler = await fuehreUebernahmeAus(handelnderA(), gemeinschaftB, leer, '2026-09-01').then(
			() => null,
			(f: unknown) => f
		);
		expect(fehler).toBeInstanceOf(FachlicherFehler);
		expect(await eintraegeMit(gemeinschaftB)).toBe(vorher);
	});
});

describe('die Liste in der Funktion deckt den Katalog', () => {
	/*
	 * Die Tabellen stehen fest in `verlauf_ohne_fremde_kennung` (Migration 177,
	 * Kopf: fest statt aus dem Katalog, gemessen). Eine neue Tabelle mit `id`
	 * und `operator_id`, die dort fehlt, liesse ihre Kennungen still durch.
	 */
	it('jede Tabelle mit `id` (uuid) und `operator_id` steht in der Funktion, und nur solche', async () => {
		const katalog = (
			await admin<{ t: string }[]>`
				SELECT i.table_name AS t
				  FROM information_schema.columns i
				  JOIN information_schema.columns o
				    ON o.table_schema = i.table_schema AND o.table_name = i.table_name
				   AND o.column_name = 'operator_id'
				  JOIN information_schema.tables t
				    ON t.table_schema = i.table_schema AND t.table_name = i.table_name
				   AND t.table_type = 'BASE TABLE'
				 WHERE i.table_schema = 'public' AND i.column_name = 'id' AND i.data_type = 'uuid'
				 ORDER BY 1
			`
		).map((z) => z.t);
		const [f] = await admin<{ text: string }[]>`
			SELECT pg_get_functiondef('verlauf_ohne_fremde_kennung'::regproc) AS text
		`;
		const zweige = [...f.text.matchAll(/SELECT\s+'(\w+)'\s+AS tabelle, id FROM (\w+)\s+WHERE id = ANY/g)];
		const inDerFunktion = zweige.map((m) => m[2]).sort();

		// Gegen ein Muster, das nicht mehr trifft: Die Liste war zum Bau 47 lang.
		expect(inDerFunktion.length).toBeGreaterThanOrEqual(47);
		for (const m of zweige) expect(m[1], 'Name im Protokoll gleich der Tabelle').toBe(m[2]);
		expect(
			katalog.filter((t) => !inDerFunktion.includes(t)),
			'fehlen in verlauf_ohne_fremde_kennung; eine neue Fassung in einer Migration nimmt sie auf'
		).toEqual([]);
		expect(inDerFunktion.filter((t) => !katalog.includes(t)), 'stehen in der Funktion, nicht im Katalog').toEqual(
			[]
		);
	});
});
