/**
 * Lesart L1 in der Datenhaltung (Migration 170): Wertquote im Ausstand beim
 * Mehr aller Wertquoten.
 *
 * Gemessen wird: Vorgabe und Schranke, der Verlauf, und dass die Wahl am
 * Traktandum ankommt, ohne dass eine Schreibstelle sie mitschickt. Vor der
 * Freigabe aus der Gemeinschaft, ab der Freigabe aus der Momentaufnahme, und
 * die Freigabe zieht eine Umstellung dazwischen nach (Konzept, Kriterien 1 bis
 * 3). Bis in den Durchgang, weil die Auszählung von dort liest.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden
} from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { oeffneAbstimmung } from '$lib/server/abstimmung';
import { holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Ein qualifiziertes Mehr über alle Wertquoten, von Hand gebaut wie in `lesarten.test.ts`. */
const QUALIFIZIERT: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-wichtig',
	typ: 'qualifiziertes_mehr',
	titel: 'Wichtigere Verwaltungshandlung',
	rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L1');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaft(name: string) {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

async function versammlung(name: string, datum: string) {
	const g = await gemeinschaft(name);
	const parteien: string[] = [];
	for (const [nummer, quote] of [600, 400].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe'][nummer],
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Fassade streichen',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gestrichen.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function spalte(traktandumId: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ l1: string | null }[]>`SELECT requirement_reading_l1 AS l1 FROM agenda_item WHERE id = ${traktandumId}`
	);
	return z.l1;
}

async function amTraktandum(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Vorgabe und Verlauf', () => {
	it('eine neue Gemeinschaft rechnet mit der Wertquote im Ausstand', async () => {
		const g = await gemeinschaft('L1 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L1).toBe('bleibt');
	});

	it('die Datenbank weist eine unbekannte Wahl ab, an Gemeinschaft und Momentaufnahme', async () => {
		const a = await versammlung('L1 falsch', '2027-12-01');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l1 = 'halb' WHERE id = ${a.gemeinschaft}`)
		).rejects.toThrow(/stweg_lesart_l1/);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		// Ändern darf die Anwendung eine Momentaufnahme gar nicht; die Schranke steht
		// trotzdem, für jeden anderen Weg.
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE snapshot SET reading_l1 = 'halb' WHERE meeting_id = ${a.versammlung}`)
		).rejects.toThrow(/permission denied/);
		const schranke = await imKontext(betreiber, (tx) =>
			tx<{ def: string }[]>`
				SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'snapshot_lesart_l1'
			`
		);
		expect(schranke.map((z) => z.def)).toEqual([
			"CHECK ((reading_l1 = ANY (ARRAY['bleibt'::text, 'faellt_heraus'::text])))"
		]);
	});

	it('am Traktandum gilt, was der Auslöser setzt, nicht was jemand hineinschreibt', async () => {
		const a = await versammlung('L1 von Hand', '2027-12-06');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE agenda_item SET requirement_reading_l1 = 'faellt_heraus' WHERE id = ${a.traktandum}`
		);
		expect(await spalte(a.traktandum)).toBe('bleibt');
		// Auch ein Wert ausserhalb der Liste kommt nicht bis zur Schranke.
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE agenda_item SET requirement_reading_l1 = 'halb' WHERE id = ${a.traktandum}`
		);
		expect(await spalte(a.traktandum)).toBe('bleibt');
	});

	it('hält die Umstellung mit Vorzustand und neuem Wert in Worten fest', async () => {
		const g = await gemeinschaft('L1 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L1: 'faellt_heraus' });
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L1',
			vorher: 'Wertquote zählt mit (Vorgabe)',
			nachher: 'Wertquote fällt heraus',
			rolle: 'admin'
		});
		expect((await holeLesarteneinstellung(betreiber, g.id)).geaendert.L1).toMatchObject({ rolle: 'admin' });
	});
});

describe('Die Wahl kommt ans Traktandum, ohne dass die Schreibstelle sie schickt', () => {
	it('vor der Freigabe aus der Gemeinschaft, auch wenn das Erfordernis eine andere trägt', async () => {
		const a = await versammlung('L1 vor Freigabe', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'faellt_heraus' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...QUALIFIZIERT,
			ausstandslesart: 'bleibt'
		});
		expect(await spalte(a.traktandum)).toBe('faellt_heraus');
		expect((await amTraktandum(a))?.ausstandslesart).toBe('faellt_heraus');
	});

	it('die Freigabe zieht eine Umstellung nach dem Herleiten nach und friert sie ein', async () => {
		const a = await versammlung('L1 Freigabe', '2027-12-03');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		expect(await spalte(a.traktandum)).toBe('bleibt');

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'faellt_heraus' });
		// L1 ändert das Mehr nicht; die Freigabe sagt deshalb nicht ab wie bei L4.
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect(await spalte(a.traktandum)).toBe('faellt_heraus');
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L1).toBe('faellt_heraus');

		// Nach der Freigabe umgestellt, neu gespeichert: Es gilt die eingefrorene Wahl.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'bleibt' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		expect(await spalte(a.traktandum)).toBe('faellt_heraus');
	});

	it('ein Traktandum ohne Mehr trägt keine Wahl', async () => {
		const a = await versammlung('L1 Kenntnisnahme', '2027-12-04');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		await bearbeiteTraktandum(handelnder(betreiber), a.versammlung, a.traktandum, {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Bericht',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		expect(await spalte(a.traktandum)).toBeNull();
	});

	it('steht im eingefrorenen Erfordernis des Durchgangs', async () => {
		const a = await versammlung('L1 Durchgang', '2027-12-05');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L1: 'faellt_heraus' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERT);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [d] = await imKontext(betreiber, (tx) =>
			tx<{ e: Erfordernis }[]>`
				SELECT requirement_json AS e FROM voting_round WHERE agenda_item_id = ${a.traktandum}
			`
		);
		expect(d.e.ausstandslesart).toBe('faellt_heraus');
	});
});
