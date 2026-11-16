/**
 * Eigener Pfad, fremde Kennung im Feld: die Abweichungen aus der Messlücke
 * (Auftrag 2d).
 *
 * **Der Befund (Kreuzteil von `e2e/fremdbetreiber.mjs`, 28.10.2026, am
 * gebauten Stand).** Unter einem Pfad von A, mit einer Kennung von B im Feld:
 *
 * - `umordnen` unter `/tage/<A>/geschaefte` und `/tage/<A>/leitung` meldete
 *   «Reihenfolge geändert», änderte nichts und hielt die Kennung von B im
 *   Verlauf von A fest (`verschiebeInGeschaeft`, Klasse K2; Block A).
 * - `parentStwegId`, `memberStwegId` und `vorgaengerId` endeten am
 *   Fremdschlüssel mit Betreiber mit 500 (23503; Block B).
 *
 * Block C («Erfolg ohne Wirkung») steht bei den Tests der Wege selbst, in
 * `betroffene.test.ts` und `vorlagen.test.ts`. Gemessen wird die Wirkung in
 * der Datenbank, nicht nur die Ausnahme; je Fall die Gegenhälfte mit einer
 * Kennung von A.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { bearbeiteGemeinschaft, erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { bearbeiteVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { verschiebeInGeschaeft } from '$lib/server/geschaeft';
import { erstelleEigentuemer } from '$lib/server/eigentuemer';
import { alsBetreiber } from '$lib/server/db';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let betreiberB: string;
let benutzerB: string;
let gemeinschaftA: string;
let hausA: string;
let gemeinschaftB: string;

const handelnderA = () => ({ operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' });
const handelnderB = () => ({ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' });

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

const ANLASS = { datum: '2026-12-01', uhrzeit: '19:00', ort: 'Prüfsaal' };

const VERSAMMLUNG = { ...ANLASS, art: 'ordentlich' as const, stufe: 'erste' as const, betriebsart: 'einfach' as const };

/**
 * Ein Abend mit zwei Versammlungen. Ihre gleichnamigen Pflichttraktanden
 * werden je ein Geschäft mit zwei Zeilen, und erst dann gibt es innerhalb
 * eines Geschäfts etwas zu verschieben.
 */
async function abendVon(handelnder: ReturnType<typeof handelnderA>, name: string) {
	const tag = await erstelleVersammlungstag(handelnder, {
		bezeichnung: `${name}, Abend`,
		...ANLASS,
		art: 'ordentlich',
		anlass: null
	});
	for (const [i, haus] of ['Nord', 'Süd'].entries()) {
		const g = await erstelleGemeinschaft(handelnder, { ...GEMEINSCHAFT, name: `${name}, Haus ${haus}` });
		const m = await erstelleVersammlung(handelnder, { stwegId: g.id, ...VERSAMMLUNG });
		await nimmInTagAuf(handelnder, tag.id, m.id, i);
	}
	const [g] = await admin<{ geschaeft: string; zeilen: string[] }[]>`
		SELECT b.id AS geschaeft, array_agg(a.id ORDER BY a.id) AS zeilen
		  FROM business b JOIN agenda_item a ON a.business_id = b.id
		 WHERE b.meeting_day_id = ${tag.id}
		 GROUP BY b.id, b.position
		HAVING count(*) = 2
		 ORDER BY b.position
		 LIMIT 1
	`;
	if (!g) throw new Error('Kein Geschäft mit zwei Zeilen am Abend; die Probe trüge nicht.');
	return { tagId: tag.id, geschaeft: g.geschaeft, zeilen: g.zeilen };
}

/** Verlaufseinträge von A, die die Kennung tragen. */
async function verlaufVonAMit(kennung: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM audit_entry x
		 WHERE x.operator_id = ${betreiberA} AND x::text ~ ${kennung}
	`;
	return z.n;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf 2d A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-2d-a');
	betreiberB = await pruefbetreiber('Prüflauf 2d B');
	benutzerB = await pruefbenutzer(betreiberB, 'pruefer-2d-b');

	gemeinschaftA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Erfundenweg 3' })).id;
	hausA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Erfundenweg 3, Haus Ost' })).id;
	gemeinschaftB = (await erstelleGemeinschaft(handelnderB(), { ...GEMEINSCHAFT, name: 'Ausgedachtweg 4' })).id;
});

afterAll(verbindungenSchliessen);

describe('Block A: Verschieben innerhalb eines Geschäfts mit einer Zeile von anderswo', () => {
	it('sagt mit der Zeile von B als «traktandum» und als «vor» ab und schreibt keinen Verlauf', async () => {
		const a = await abendVon(handelnderA(), 'Erfundenweg 5');
		const b = await abendVon(handelnderB(), 'Ausgedachtweg 6');
		const [fremd, fremdVor] = b.zeilen;

		await expect(verschiebeInGeschaeft(handelnderA(), a.tagId, a.geschaeft, fremd, null)).rejects.toMatchObject({
			feld: 'traktandum'
		});
		await expect(
			verschiebeInGeschaeft(handelnderA(), a.tagId, a.geschaeft, a.zeilen[0], fremdVor)
		).rejects.toMatchObject({ feld: 'vor' });
		expect(await verlaufVonAMit(fremd)).toBe(0);
		expect(await verlaufVonAMit(fremdVor)).toBe(0);
	});

	it('mit den Zeilen von A verschiebt es und hält das fest (Gegenhälfte)', async () => {
		const a = await abendVon(handelnderA(), 'Erfundenweg 7');
		// In der Reihenfolge, in der die Funktion rechnet; die Kennungen allein
		// ordnen zufällig (Codeprüfung 28.10.2026).
		const reihe = async () =>
			(
				await admin<{ id: string }[]>`
					SELECT a.id FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
					 WHERE a.business_id = ${a.geschaeft}
					 ORDER BY a.business_position NULLS LAST, m.day_position NULLS LAST, a.id
				`
			).map((z) => z.id);
		const verschoben = async () => {
			const [z] = await admin<{ n: number }[]>`
				SELECT count(*)::int AS n FROM audit_entry
				 WHERE subject_id = ${a.tagId} AND event_type = 'business.moved'
			`;
			return z.n;
		};
		const [erste, zweite] = await reihe();
		const vorher = await verschoben();

		await verschiebeInGeschaeft(handelnderA(), a.tagId, a.geschaeft, zweite, erste);
		expect(await reihe()).toEqual([zweite, erste]);
		expect(await verschoben()).toBe(vorher + 1);
	});
});

describe('Block B: ein Verweis auf eine Zeile von anderswo ist eine Absage, keine 500', () => {
	it('parentStwegId: sagt ab und ändert nichts', async () => {
		await expect(
			bearbeiteGemeinschaft(handelnderA(), hausA, {
				...GEMEINSCHAFT,
				name: 'Erfundenweg 3, Haus Ost',
				parentStwegId: gemeinschaftB
			})
		).rejects.toMatchObject({ kennung: 'unbekannter_verweis' });
		const [z] = await admin<{ parent_stweg_id: string | null }[]>`
			SELECT parent_stweg_id FROM stweg WHERE id = ${hausA}
		`;
		expect(z.parent_stweg_id).toBeNull();
	});

	it('parentStwegId: mit einer Gemeinschaft von A geht es durch (Gegenhälfte)', async () => {
		const g = await bearbeiteGemeinschaft(handelnderA(), hausA, {
			...GEMEINSCHAFT,
			name: 'Erfundenweg 3, Haus Ost',
			parentStwegId: gemeinschaftA
		});
		expect(g.parentStwegId).toBe(gemeinschaftA);
	});

	it('memberStwegId: sagt ab und legt nichts an', async () => {
		const eingabe = (memberStwegId: string) => ({
			stwegId: gemeinschaftA,
			kind: 'gemeinschaft' as const,
			displayName: `Anteil von ${memberStwegId.slice(0, 8)}`,
			representativeName: 'Verwaltung Muster',
			isCommunity: false,
			memberStwegId
		});
		await expect(erstelleEigentuemer(handelnderA(), eingabe(gemeinschaftB))).rejects.toMatchObject({
			kennung: 'unbekannter_verweis'
		});
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM party WHERE member_stweg_id = ${gemeinschaftB}
		`;
		expect(z.n).toBe(0);

		const neu = await erstelleEigentuemer(handelnderA(), eingabe(hausA));
		expect(neu.memberStwegId).toBe(hausA);
	});

	it('vorgaengerId: sagt ab und ändert nichts, mit einer Versammlung von A geht es durch', async () => {
		const erste = await erstelleVersammlung(handelnderA(), { stwegId: gemeinschaftA, ...VERSAMMLUNG });
		const fremde = await erstelleVersammlung(handelnderB(), { stwegId: gemeinschaftB, ...VERSAMMLUNG });
		const zweite = await erstelleVersammlung(handelnderA(), {
			stwegId: gemeinschaftA,
			...VERSAMMLUNG,
			datum: '2026-12-20'
		});
		const eingabe = (vorgaengerId: string) => ({
			stwegId: gemeinschaftA,
			...VERSAMMLUNG,
			datum: '2026-12-20',
			stufe: 'zweite' as const,
			vorgaengerId,
			vorgaengerDatum: ANLASS.datum
		});

		await expect(bearbeiteVersammlung(handelnderA(), zweite.id, eingabe(fremde.id))).rejects.toMatchObject({
			kennung: 'unbekannter_verweis'
		});
		const [z] = await admin<{ previous_meeting_id: string | null }[]>`
			SELECT previous_meeting_id FROM meeting WHERE id = ${zweite.id}
		`;
		expect(z.previous_meeting_id).toBeNull();

		const v = await bearbeiteVersammlung(handelnderA(), zweite.id, eingabe(erste.id));
		expect(v.vorgaengerId).toBe(erste.id);
	});

	it('als Klasse: jeder Schlüssel mit Betreiber, unmittelbar am Schema', async () => {
		/*
		 * Am Schema vorbei an der Anwendung, damit der Test nicht an den drei
		 * gemessenen Feldern hängt: Ein neuer Schlüssel mit Betreiber fällt
		 * unter dieselbe Übersetzung, ohne dass jemand eine Liste nachführt.
		 */
		const versuch = alsBetreiber(betreiberA, (tx) => tx`
			INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator)
			VALUES (${gemeinschaftB}, ${betreiberA}, 'probe', 'Probe', 1000)
		`);
		await expect(versuch).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(versuch).rejects.toMatchObject({ kennung: 'unbekannter_verweis' });
	});

	it('ein Schlüssel ohne Betreiber bleibt bei der rohen Ausnahme (Gegenhälfte)', async () => {
		/*
		 * `party_member_huelle_fk` und `party_member_huelle_stweg_fk` sind
		 * zusammengesetzt, tragen aber keinen Betreiber; ihre Verletzung ist kein
		 * «gehört nicht zu Ihnen» und wird nicht übersetzt.
		 */
		const fehler = await alsBetreiber(betreiberA, (tx) => tx`
			INSERT INTO party_member (operator_id, stweg_id, huelle_party_id, mitglied_party_id)
			VALUES (${betreiberA}, ${gemeinschaftA}, gen_random_uuid(), gen_random_uuid())
		`).catch((f: unknown) => f);
		expect(fehler).toBeInstanceOf(postgres.PostgresError);
		expect(fehler).toMatchObject({ code: '23503' });
		expect((fehler as Error).message).toMatch(/^insert or update on table "party_member"/);
	});

	it('ein einspaltiger Schlüssel auf den Betreiber bleibt bei der rohen Ausnahme (Gegenhälfte)', async () => {
		/*
		 * Ein Betreiber, den es nicht gibt, ist ein Programmfehler und keine
		 * Auswahl: `person_operator_id_fkey` ist der einzige Schlüssel an
		 * `person` und trägt nur `operator_id`. Ohne `cardinality(c.conkey) > 1`
		 * in `fehlenderVerweis` würde er übersetzt (Gegenprobe der
		 * Featureprüfung, 28.10.2026).
		 */
		const niemand = randomUUID();
		const fehler = await alsBetreiber(niemand, (tx) => tx`
			INSERT INTO person (operator_id, display_name) VALUES (${niemand}, 'Niemand')
		`).catch((f: unknown) => f);
		expect(fehler).toBeInstanceOf(postgres.PostgresError);
		expect(fehler).toMatchObject({ code: '23503', constraint_name: 'person_operator_id_fkey' });
	});

	it('der Satz nennt weder Schlüssel noch Tabelle (er geht auch an /z)', async () => {
		const fehler = await bearbeiteGemeinschaft(handelnderA(), hausA, {
			...GEMEINSCHAFT,
			name: 'Erfundenweg 3, Haus Ost',
			parentStwegId: gemeinschaftB
		}).catch((f: unknown) => f);
		expect(fehler).toBeInstanceOf(FachlicherFehler);
		expect((fehler as Error).message).not.toMatch(/stweg|operator|betreiber|constraint|Schlüssel/i);
	});

	it('ein 23503 beim Löschen einer Zeile, auf die noch verwiesen wird, bleibt, wie er ist', async () => {
		// Die Versammlung verweist auf die Gemeinschaft, mit `NO ACTION`
		// (`meeting_stweg_id_operator_id_fkey`); ein `RESTRICT` gäbe 23001.
		const g = await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Erfundenweg 11' });
		await erstelleVersammlung(handelnderA(), { stwegId: g.id, ...VERSAMMLUNG });
		const fehler = await alsBetreiber(betreiberA, (tx) => tx`DELETE FROM stweg WHERE id = ${g.id}`).catch(
			(f: unknown) => f
		);
		expect(fehler).toBeInstanceOf(postgres.PostgresError);
		expect(fehler).toMatchObject({ code: '23503' });
		expect((fehler as Error).message).toMatch(/^update or delete on table/);
	});
});
