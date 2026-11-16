/**
 * Eigener Pfad, fremde Kennung im Feld: Absage statt Annahme, Verlauf oder 500.
 *
 * **Der Befund (Kreuzteil von `e2e/fremdbetreiber.mjs`, 27.10.2026, am
 * gebauten Stand).** Ein Weg unter einem Pfad von A, dessen Formularfeld eine
 * Kennung von B trägt. Elf Versuche wichen ab:
 *
 * - `traktanden?/anlegen` und `?/speichern` nahmen eine Gemeinschaft von B als
 *   antragstellende Untergemeinschaft an; der einfache Fremdschlüssel auf
 *   `stweg (id)` hielt nichts (Block A, Migration 176).
 * - `verschiebeGeschaeft` hielt «verschoben» mit einem Geschäft von B im
 *   Verlauf von A fest, ohne etwas zu verschieben (Block B, Klasse K2).
 *   `?/speichern` mit `parentId` trug den Elternteil aus dem Formular ins
 *   Ergebnis, obwohl es ihn nie schreibt. Den Verlaufseintrag, den der
 *   Kreuzteil dort mass, schrieb nicht der Elternteil: Der Versuch lief auf dem
 *   Traktandum, dem der vorige die Gemeinschaft von B gegeben hatte, und der
 *   Eintrag hielt die Antragstellerin von B nach A fest (nachgemessen
 *   28.10.2026, `B_IN_A agenda_item 2→1`).
 * - `eigentuemer?/verknuepfen` und `traktanden?/verschieben` endeten am
 *   Fremdschlüssel mit 500; `ausstandZurueck` meldete Erfolg ohne Wirkung
 *   (Block C).
 *
 * Gegen die Funktionen, wo die Abwehr sitzt; gemessen wird die Wirkung in der
 * Datenbank, nicht nur die Ausnahme. Je Fall die Gegenhälfte mit einer
 * Kennung von A, wo sie etwas sagt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { holeGemeinsameListe, verschiebeGeschaeft } from '$lib/server/geschaeft';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	holeTraktanden,
	verschiebeTraktandum
} from '$lib/server/traktanden';
import { nimmAusstandZurueck } from '$lib/server/ausstand';
import { erstellePerson, verknuepfePartei } from '$lib/server/personen';
import { erstelleEigentuemer } from '$lib/server/eigentuemer';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let betreiberB: string;
let benutzerB: string;
let gemeinschaftA: string;
let hausA: string;
let gemeinschaftB: string;
let versammlungA: string;
let versammlungB: string;
let traktandumA: string;
let abendA: string;
let abendB: string;

const handelnderA = () => ({ operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' });
const handelnderB = () => ({ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' });

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

const ANLASS = { datum: '2026-12-01', uhrzeit: '19:00', ort: 'Prüfsaal' };

/** Ein Abend mit einer Versammlung, deren Pflichttraktanden Geschäfte sind. */
async function abendVon(handelnder: ReturnType<typeof handelnderA>, name: string) {
	const tag = await erstelleVersammlungstag(handelnder, {
		bezeichnung: `${name}, Abend`,
		...ANLASS,
		art: 'ordentlich',
		anlass: null
	});
	const g = await erstelleGemeinschaft(handelnder, { ...GEMEINSCHAFT, name: `${name}, Haus` });
	const m = await erstelleVersammlung(handelnder, {
		stwegId: g.id,
		...ANLASS,
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	await nimmInTagAuf(handelnder, tag.id, m.id, 0);
	return tag.id;
}

async function geschaefte(operatorId: string, tagId: string): Promise<string[]> {
	return (await holeGemeinsameListe(operatorId, tagId)).map((z) => z.geschaeftId);
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf Eigener Pfad A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-pfad-a');
	betreiberB = await pruefbetreiber('Prüflauf Eigener Pfad B');
	benutzerB = await pruefbenutzer(betreiberB, 'pruefer-pfad-b');

	gemeinschaftA = (await erstelleGemeinschaft(handelnderA(), { ...GEMEINSCHAFT, name: 'Eigenweg 7' })).id;
	hausA = (
		await erstelleGemeinschaft(handelnderA(), {
			...GEMEINSCHAFT,
			name: 'Eigenweg 7, Haus Nord',
			parentStwegId: gemeinschaftA
		})
	).id;
	gemeinschaftB = (await erstelleGemeinschaft(handelnderB(), { ...GEMEINSCHAFT, name: 'Fremdweg 8' })).id;

	versammlungA = (
		await erstelleVersammlung(handelnderA(), {
			stwegId: gemeinschaftA,
			...ANLASS,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		})
	).id;
	versammlungB = (
		await erstelleVersammlung(handelnderB(), {
			stwegId: gemeinschaftB,
			...ANLASS,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		})
	).id;
	traktandumA = (
		await erstelleTraktandum(handelnderA(), {
			meetingId: versammlungA,
			titel: 'Veloraum',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		})
	).id;

	abendA = await abendVon(handelnderA(), 'Eigenweg 9');
	abendB = await abendVon(handelnderB(), 'Fremdweg 10');
});

afterAll(verbindungenSchliessen);

/** Zeilen von A, die die Kennung tragen, in Tabelle oder Verlauf. */
async function zeilenVonAMit(tabelle: 'agenda_item' | 'audit_entry', kennung: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM ${admin(tabelle)} x
		 WHERE x.operator_id = ${betreiberA} AND x::text ~ ${kennung}
	`;
	return z.n;
}

describe('Block A: antragstellende Gemeinschaft eines anderen Betreibers', () => {
	const eingabe = (antragstellerId: string) => ({
		meetingId: versammlungA,
		titel: 'Antrag der Untergemeinschaft',
		art: 'kenntnisnahme' as const,
		antragstellerart: 'untergemeinschaft' as const,
		antragstellerId
	});

	it('erstelleTraktandum sagt fachlich ab und legt nichts an', async () => {
		await expect(erstelleTraktandum(handelnderA(), eingabe(gemeinschaftB))).rejects.toMatchObject({
			kennung: 'fremde_untergemeinschaft'
		});
		expect(await zeilenVonAMit('agenda_item', gemeinschaftB)).toBe(0);
	});

	it('bearbeiteTraktandum sagt fachlich ab, ändert nichts und schreibt keinen Verlauf', async () => {
		await expect(
			bearbeiteTraktandum(handelnderA(), versammlungA, traktandumA, eingabe(gemeinschaftB))
		).rejects.toBeInstanceOf(FachlicherFehler);
		expect(await zeilenVonAMit('agenda_item', gemeinschaftB)).toBe(0);
		expect(await zeilenVonAMit('audit_entry', gemeinschaftB)).toBe(0);
	});

	it('die eigene Gemeinschaft der Versammlung ist keine Untergemeinschaft', async () => {
		await expect(erstelleTraktandum(handelnderA(), eingabe(gemeinschaftA))).rejects.toMatchObject({
			kennung: 'fremde_untergemeinschaft'
		});
	});

	it('eine Untergemeinschaft dieser Gemeinschaft geht durch (Gegenhälfte)', async () => {
		const t = await erstelleTraktandum(handelnderA(), eingabe(hausA));
		expect(t.antragstellerId).toBe(hausA);
	});

	it('das Schema weist den Verweis über Betreiber hinweg ab, auch an der Anwendung vorbei', async () => {
		await expect(
			admin`UPDATE agenda_item SET proposer_kind = 'untergemeinschaft', proposer_stweg_id = ${gemeinschaftB}
			       WHERE id = ${traktandumA}`
		).rejects.toMatchObject({ constraint_name: 'agenda_item_proposer_stweg_gleicher_betreiber' });
	});
});

describe('Block B: Verschieben eines Geschäfts von anderswo schreibt keinen Verlauf', () => {
	it('mit dem Geschäft von B als «geschaeft» und als «vor»', async () => {
		const [eigenes] = await geschaefte(betreiberA, abendA);
		const [fremdes] = await geschaefte(betreiberB, abendB);
		expect(eigenes).toBeTruthy();
		expect(fremdes).toBeTruthy();

		await expect(verschiebeGeschaeft(handelnderA(), abendA, fremdes, null)).rejects.toMatchObject({
			feld: 'geschaeft'
		});
		await expect(verschiebeGeschaeft(handelnderA(), abendA, eigenes, fremdes)).rejects.toMatchObject({
			feld: 'vor'
		});
		expect(await zeilenVonAMit('audit_entry', fremdes)).toBe(0);
	});

	it('bearbeiteTraktandum nimmt «parentId» weder von B noch von A in Ergebnis und Verlauf', async () => {
		const [elternteilB] = await holeTraktanden(betreiberB, versammlungB);
		const [elternteilA] = (await holeTraktanden(betreiberA, versammlungA)).filter(
			(n) => n.knoten.id !== traktandumA
		);
		for (const [i, elternteil] of [elternteilB.knoten.id, elternteilA.knoten.id].entries()) {
			const t = await bearbeiteTraktandum(handelnderA(), versammlungA, traktandumA, {
				meetingId: versammlungA,
				titel: `Veloraum, Fassung ${i + 2}`,
				art: 'kenntnisnahme',
				antragstellerart: 'bewirtschaftung',
				parentId: elternteil
			});
			expect(t.parentId).toBeNull();
			const [z] = await admin<{ n: number }[]>`
				SELECT count(*)::int AS n FROM audit_entry
				 WHERE subject_id = ${traktandumA} AND detail::text ~ ${elternteil}
			`;
			expect(z.n).toBe(0);
		}
	});

	it('innerhalb des eigenen Abends verschiebt es weiter (Gegenhälfte)', async () => {
		const liste = await geschaefte(betreiberA, abendA);
		await verschiebeGeschaeft(handelnderA(), abendA, liste[liste.length - 1], liste[0]);
		expect((await geschaefte(betreiberA, abendA))[0]).toBe(liste[liste.length - 1]);
	});
});

describe('Block C: Absage statt 500 oder falscher Erfolgsmeldung', () => {
	it('verknuepfePartei mit einer Person von B sagt fachlich ab', async () => {
		const personB = await erstellePerson(handelnderB(), { name: 'Fremde Person' });
		const parteiA = await erstelleEigentuemer(handelnderA(), {
			stwegId: hausA,
			kind: 'natural',
			displayName: 'Eigene Partei',
			representativeName: null,
			isCommunity: false
		});
		await expect(verknuepfePartei(handelnderA(), parteiA.id, personB.id)).rejects.toMatchObject({
			feld: 'personId'
		});
		const personA = await erstellePerson(handelnderA(), { name: 'Eigene Person' });
		await verknuepfePartei(handelnderA(), parteiA.id, personA.id);
	});

	it('verschiebeTraktandum unter einen Elternteil von anderswo sagt fachlich ab', async () => {
		const [elternteilB] = await holeTraktanden(betreiberB, versammlungB);
		await expect(
			verschiebeTraktandum(handelnderA(), versammlungA, {
				id: traktandumA,
				neuerElternteil: elternteilB.knoten.id,
				stelle: 0
			})
		).rejects.toMatchObject({ kennung: 'fremdes_traktandum' });
	});

	it('nimmAusstandZurueck ohne Ausstand an dieser Versammlung meldet keine Rücknahme', async () => {
		// Ein Ausstand von B ist unter dem Zeilenschutz von A dasselbe wie keiner;
		// den echten misst der Kreuzteil.
		expect(await nimmAusstandZurueck(handelnderA(), versammlungA, randomUUID())).toBe(false);
	});
});
