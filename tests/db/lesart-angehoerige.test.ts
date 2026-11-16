/**
 * Lesart L10 in der Datenhaltung (Migration 189): Angehörige des Beklagten im
 * Ausstand an der Ermächtigung zur Ausschlussklage.
 *
 * Gemessen wird: Vorgabe und Schranke, der Verlauf, und dass die Wahl am
 * Traktandum ankommt, ohne dass eine Schreibstelle sie mitschickt. Vor der
 * Freigabe aus der Gemeinschaft, ab der Freigabe aus der Momentaufnahme, und
 * die Freigabe zieht eine Umstellung dazwischen nach. Bis in den Durchgang,
 * weil die Auszählung von dort liest.
 *
 * **Und die eine Stelle, an der L10 nicht wirkt:** Ein Traktandum, das unter
 * einer Fassung vor 2026-11-10 hergeleitet wurde, rechnet fest mit den
 * Angehörigen in der Zahl. Steht die Gemeinschaft auf «fallen_heraus», sagt die
 * Freigabe ab und der Kasten «Erfordernisse nachziehen» zeigt den Weg.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { erhebeFreigabelage, gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden
} from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { oeffneAbstimmung } from '$lib/server/abstimmung';
import { holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { erfordernisseNachziehen, veralteteErfordernisse } from '$lib/server/reglement';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Die Ermächtigung zur Ausschlussklage, von Hand gebaut wie in `lesarten.test.ts`. */
const KLAGE: Erfordernis = {
	fassung: '2026-11-10',
	juristischGegengelesen: false,
	astId: 'a-sonderfall',
	knotenId: 'k-ausschlussklage',
	typ: 'einfaches_mehr',
	titel: 'Ermächtigung zur Ausschlussklage',
	rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
	kopfbasis: 'alle_ausser_betroffene',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L10');
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
		titel: 'Ermächtigung zur Ausschlussklage',
		art: 'abstimmung',
		antragswortlaut: 'Die Gemeinschaft ermächtigt zur Klage.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: [parteien[1]]
		},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	'k-ausschlussklage');
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function spalte(traktandumId: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ l10: string | null }[]>`SELECT requirement_reading_l10 AS l10 FROM agenda_item WHERE id = ${traktandumId}`
	);
	return z.l10;
}

async function amTraktandum(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Vorgabe und Verlauf', () => {
	it('eine neue Gemeinschaft rechnet mit den Angehörigen in der Zahl', async () => {
		const g = await gemeinschaft('L10 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L10).toBe('bleiben');
	});

	it('die Datenbank weist eine unbekannte Wahl ab, an Gemeinschaft und Momentaufnahme', async () => {
		const a = await versammlung('L10 falsch', '2027-12-01');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l10 = 'halb' WHERE id = ${a.gemeinschaft}`)
		).rejects.toThrow(/stweg_lesart_l10/);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, KLAGE);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		// Ändern darf die Anwendung eine Momentaufnahme gar nicht; die Schranke steht
		// trotzdem, für jeden anderen Weg.
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE snapshot SET reading_l10 = 'halb' WHERE meeting_id = ${a.versammlung}`)
		).rejects.toThrow(/permission denied/);
		const schranke = await imKontext(betreiber, (tx) =>
			tx<{ def: string }[]>`
				SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'snapshot_lesart_l10'
			`
		);
		expect(schranke.map((z) => z.def)).toEqual([
			"CHECK ((reading_l10 = ANY (ARRAY['bleiben'::text, 'fallen_heraus'::text])))"
		]);
	});

	it('am Traktandum gilt, was der Auslöser setzt, nicht was jemand hineinschreibt', async () => {
		const a = await versammlung('L10 von Hand', '2027-12-06');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, KLAGE);
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE agenda_item SET requirement_reading_l10 = 'fallen_heraus' WHERE id = ${a.traktandum}`
		);
		expect(await spalte(a.traktandum)).toBe('bleiben');
		// Auch ein Wert ausserhalb der Liste kommt nicht bis zur Schranke.
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE agenda_item SET requirement_reading_l10 = 'halb' WHERE id = ${a.traktandum}`
		);
		expect(await spalte(a.traktandum)).toBe('bleiben');
	});

	it('hält die Umstellung mit Vorzustand und neuem Wert in Worten fest', async () => {
		const g = await gemeinschaft('L10 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L10: 'fallen_heraus' });
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L10',
			vorher: 'Bleiben in der Zahl (Vorgabe)',
			nachher: 'Fallen aus der Zahl',
			rolle: 'admin'
		});
		expect((await holeLesarteneinstellung(betreiber, g.id)).geaendert.L10).toMatchObject({
			rolle: 'admin'
		});
	});
});

describe('Die Wahl kommt ans Traktandum, ohne dass die Schreibstelle sie schickt', () => {
	it('vor der Freigabe aus der Gemeinschaft, auch wenn das Erfordernis eine andere trägt', async () => {
		const a = await versammlung('L10 vor Freigabe', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L10: 'fallen_heraus' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...KLAGE,
			angehoerigenlesart: 'bleiben'
		});
		expect(await spalte(a.traktandum)).toBe('fallen_heraus');
		expect((await amTraktandum(a))?.angehoerigenlesart).toBe('fallen_heraus');
	});

	it('die Freigabe zieht eine Umstellung nach dem Herleiten nach und friert sie ein', async () => {
		const a = await versammlung('L10 Freigabe', '2027-12-03');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, KLAGE);
		expect(await spalte(a.traktandum)).toBe('bleiben');

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L10: 'fallen_heraus' });
		// L10 ändert das Mehr nicht; die Freigabe sagt deshalb nicht ab wie bei L4.
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect(await spalte(a.traktandum)).toBe('fallen_heraus');
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L10).toBe('fallen_heraus');

		// Nach der Freigabe umgestellt, neu gespeichert: Es gilt die eingefrorene Wahl.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L10: 'bleiben' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, KLAGE);
		expect(await spalte(a.traktandum)).toBe('fallen_heraus');
	});

	it('ein Traktandum ohne Mehr trägt keine Wahl', async () => {
		const a = await versammlung('L10 Kenntnisnahme', '2027-12-04');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, KLAGE);
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
		const a = await versammlung('L10 Durchgang', '2027-12-05');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L10: 'fallen_heraus' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, KLAGE);
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
		expect(d.e.angehoerigenlesart).toBe('fallen_heraus');
	});
});

describe('Wo L10 am Erfordernis nicht wirkt, sagt die Freigabe ab', () => {
	it('ein Traktandum von vor 2026-11-10 rechnet fest mit ihnen, und der Kasten zeigt es', async () => {
		const a = await versammlung('L10 alt', '2027-12-07');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L10: 'fallen_heraus' });
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...KLAGE,
			fassung: '2026-11-05'
		});
		// Die Absage nennt das Traktandum und den Weg; die Kennung steht am Befund.
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/Ziehen Sie das Mehr auf der Seite «Lesarten» der Gemeinschaft nach/
		);
		const { befund } = await erhebeFreigabelage(betreiber, a.versammlung);
		expect(befund.hindernisse.map((h) => h.kennung)).toContain('lesart_veraltet');
		// Der Weg hinaus: derselbe Kasten, den die Seite anbietet.
		const offen = await veralteteErfordernisse(betreiber, a.gemeinschaft);
		expect(offen.map((z) => z.traktandumId)).toContain(a.traktandum);
		// Die Zeile nennt beide Wahlen (Codeprüfung Block D, Durchgang 2, N-b) ...
		const zeile = offen.find((z) => z.traktandumId === a.traktandum)!;
		expect(zeile.bisher).toMatch(/ · Lesart L10: Bleiben in der Zahl \(Vorgabe\)$/);
		expect(zeile.neu).toMatch(/ · Lesart L10: Fallen aus der Zahl$/);
		// ... und nach dem Nachziehen gelingt die Freigabe, mit der eingestellten Wahl.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect(await spalte(a.traktandum)).toBe('fallen_heraus');
	});

	it('unter der Vorgabe sagt sie nicht ab, und der Kasten bleibt leer', async () => {
		const a = await versammlung('L10 alt Vorgabe', '2027-12-08');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...KLAGE,
			fassung: '2026-11-05'
		});
		// Die Gegenprobe zum Test darüber: Ohne die Umstellung ist dasselbe
		// Traktandum nicht veraltet, und der Kasten nennt es nicht.
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect(await spalte(a.traktandum)).toBe('bleiben');
	});
});
