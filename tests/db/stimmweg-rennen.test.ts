/**
 * Abgeben, Schliessen und Eröffnen, wenn zwei Läufe zugleich kommen
 * (Sicherheitsdurchgang 09.10.2026, Befunde S1, S2, S7, S9, S10).
 *
 * **Warum die Rennen hier gesteuert und nicht bloss losgelassen werden.** Zwei
 * Aufrufe mit `Promise.all` treffen sich nur zufällig im Fenster: Die frühere
 * Probe zu S9 lieferte je nach Lauf den rohen Datenbankfehler oder einen
 * falschen fachlichen Satz. Eine Prüfung, die einmal rot und einmal grün ist,
 * belegt nichts. Deshalb hält eine dritte Verbindung eine Zeilensperre, an der
 * der erste Lauf mitten im Weg anhält; erst wenn alle Läufe nachweislich
 * warten (`pg_stat_activity`), wird sie gelöst. Die Reihenfolge ist damit
 * dieselbe in jedem Lauf, im alten Code wie im neuen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	gibStimmenAb,
	oeffneAbstimmung,
	schliesseAbstimmung,
	zaehleStimmzeilen
} from '$lib/server/abstimmung';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { halteSperre, warteAufWartende } from './rennen';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

interface Haus {
	versammlung: string;
	traktandum: string;
	parteien: string[];
	einheiten: string[];
}

/** Eine laufende Versammlung, zwei anwesende Parteien, ein Traktandum mit Erfordernis. */
async function haus(name: string, datum: string): Promise<Haus> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	const einheiten: string[] = [];
	for (const [nummer, quote] of [600, 400].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Prüfpartei ${nummer === 0 ? 'A' : 'B'}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
		einheiten.push(e.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Ersatz der Gegensprechanlage',
		art: 'abstimmung',
		antragswortlaut: 'Die Gegensprechanlage wird ersetzt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
	}
	return { versammlung: v.id, traktandum: t.id, parteien, einheiten };
}

/** Der Durchgang mit Zustand, Schliesszeit und festgeschriebenen Köpfen. */
async function durchgang(id: string) {
	const [z] = await admin<
		{ state: string; closed_at: Date | null; nein: number | null }[]
	>`
		SELECT state, closed_at, (result_json->'auszaehlung'->'koepfe'->>'nein')::int AS nein
		  FROM voting_round WHERE id = ${id}
	`;
	return z;
}

/** Verlaufseinträge einer Art, ob an der Versammlung oder am Durchgang geführt. */
async function verlaufseintraege(gegenstaende: string[], art: string): Promise<number> {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM audit_entry
		 WHERE operator_id = ${betreiber} AND subject_id = ANY(${gegenstaende}) AND event_type = ${art}
	`;
	return z.n;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Stimmweg im Rennen');
	benutzer = await pruefbenutzer(betreiber, 'rennleitung');
});

afterAll(verbindungenSchliessen);

describe('S1: Stimme im Rennen mit dem Schliessen', () => {
	it('wird vom Schliessen abgewartet und steht im verkündeten Ergebnis', async () => {
		const h = await haus('Rennhaus S1', '2027-06-01');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await gibStimmenAb(handelnder(), h.versammlung, [{ parteiId: h.parteien[0], wahl: 'yes' }], false);

		/*
		 * Die Stimme hält an ihrem Fremdschlüssel auf die Einheit an: Die dritte
		 * Verbindung sperrt die Zeile der Momentaufnahme, und das INSERT wartet.
		 * Bis dahin hat der Stimmweg den Durchgang schon gelesen. Genau dort lag
		 * das Fenster: Im alten Code lief das Schliessen jetzt ungehindert durch,
		 * und die Stimme landete danach im geschlossenen Durchgang.
		 */
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`
				SELECT su.id FROM snapshot_unit su
				  JOIN snapshot_party sp ON sp.id = su.snapshot_party_id
				 WHERE sp.meeting_id = ${h.versammlung} AND sp.party_id = ${h.parteien[1]}
				   FOR UPDATE OF su
			`;
			expect(zeilen).toHaveLength(1);
		});
		const stimme = gibStimmenAb(
			handelnder(),
			h.versammlung,
			[{ parteiId: h.parteien[1], wahl: 'no' }],
			false
		);
		await warteAufWartende(1);
		const schliessen = schliesseAbstimmung(handelnder(), h.versammlung);
		// Der alte Code schliesst hier fertig, der neue wartet auf die Stimme.
		let fertig = false;
		void schliessen.finally(() => (fertig = true)).catch(() => undefined);
		await warteAufWartende(2, () => fertig);
		await sperre.loesen();

		/*
		 * Die Stimme hat den Durchgang zuerst gelesen, also wartet das
		 * Schliessen auf sie: angenommen und gezählt. Im alten Code war sie
		 * ebenfalls angenommen, stand aber nicht im Ergebnis. Abgewiesen würde
		 * sie nur, wenn sie erst nach dem Schliessen an die Zeile käme; eine
		 * Absage hier hätte also einen anderen Grund.
		 */
		const [s, z] = await Promise.allSettled([stimme, schliessen]);
		expect(s.status).toBe('fulfilled');
		expect(z.status).toBe('fulfilled');
		const nachher = await durchgang(d.id);
		expect(nachher.state).toBe('geschlossen');
		expect(nachher.nein).toBe(1);
		expect(await zaehleStimmzeilen(betreiber, d.id)).toBe(2);
	});
});

describe('S2: doppeltes Schliessen', () => {
	it('schliesst einmal und weist das zweite mit einem Satz ab', async () => {
		const h = await haus('Rennhaus S2', '2027-06-02');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await gibStimmenAb(handelnder(), h.versammlung, [{ parteiId: h.parteien[0], wahl: 'yes' }], false);

		// Beide Läufe halten am Durchgang an, im alten Code erst am UPDATE, im
		// neuen schon am Lesen.
		const sperre = await halteSperre(async (tx) => {
			await tx`SELECT 1 FROM voting_round WHERE id = ${d.id} FOR UPDATE`;
		});
		const eins = schliesseAbstimmung(handelnder(), h.versammlung);
		const zwei = schliesseAbstimmung(handelnder(), h.versammlung);
		await warteAufWartende(2);
		const vorher = await durchgang(d.id);
		await sperre.loesen();

		const laeufe = await Promise.allSettled([eins, zwei]);
		expect(vorher.state).toBe('offen');
		expect(laeufe.filter((l) => l.status === 'fulfilled')).toHaveLength(1);
		const verlierer = laeufe.find((l) => l.status === 'rejected') as PromiseRejectedResult;
		expect(verlierer.reason).toBeInstanceOf(FachlicherFehler);
		expect((verlierer.reason as FachlicherFehler).kennung).toBe('keine_offene');

		// Der Zeitpunkt des Schliessens ist rechtlich erheblich und steht einmal.
		expect(await verlaufseintraege([h.versammlung, d.id], 'vote.round.closed')).toBe(1);
		expect(await verlaufseintraege([h.versammlung, d.id], 'vote.result.published')).toBe(1);
	});
});

describe('S9: gleichzeitiges doppeltes Eröffnen', () => {
	it('eröffnet einmal und sagt dem zweiten, dass schon eine offen ist', async () => {
		const h = await haus('Rennhaus S9', '2027-06-03');

		// Beide Läufe halten an der Versammlungszeile an: der alte Code am
		// Wechsel des aktuellen Traktandums, der zweite dahinter am eindeutigen
		// Schlüssel; der neue Code schon vor dem Lesen der Lage.
		const sperre = await halteSperre(async (tx) => {
			await tx`SELECT 1 FROM meeting WHERE id = ${h.versammlung} FOR UPDATE`;
		});
		const eins = oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		const zwei = oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await warteAufWartende(2);
		await sperre.loesen();

		const laeufe = await Promise.allSettled([eins, zwei]);
		expect(laeufe.filter((l) => l.status === 'fulfilled')).toHaveLength(1);
		const verlierer = laeufe.find((l) => l.status === 'rejected') as PromiseRejectedResult;
		expect(verlierer.reason).toBeInstanceOf(FachlicherFehler);
		expect((verlierer.reason as FachlicherFehler).kennung).toBe('schon_offen');
	});
});

describe('S7: Einheiten, die der Partei nicht gehören', () => {
	it('weist die ganze Abgabe ab, statt still einen Teil zu speichern', async () => {
		const h = await haus('Rennhaus S7', '2027-06-04');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);

		// Die eigene Einheit und die der anderen Partei: Im alten Code fiel die
		// fremde still aus der Menge, und das Telefon meldete «gestimmt».
		await expect(
			gibStimmenAb(
				handelnder(),
				h.versammlung,
				[{ parteiId: h.parteien[0], unitIds: [h.einheiten[0], h.einheiten[1]], wahl: 'yes' }],
				false
			)
		).rejects.toMatchObject({ kennung: 'fremde_einheit' });
		expect(await zaehleStimmzeilen(betreiber, d.id)).toBe(0);

		// Dieselbe Einheit zweimal genannt ist keine fremde.
		await gibStimmenAb(
			handelnder(),
			h.versammlung,
			[{ parteiId: h.parteien[0], unitIds: [h.einheiten[0], h.einheiten[0]], wahl: 'yes' }],
			false
		);
		expect(await zaehleStimmzeilen(betreiber, d.id)).toBe(1);
	});
});

describe('Die Schranken, auf die sich die Übersetzung des doppelten Schlüssels stützt', () => {
	it('gibt es unter genau diesen Namen', async () => {
		/*
		 * `oeffneAbstimmung` und `gibAb` übersetzen 23505 nur an diesen Namen
		 * (`istDoppelterSchluessel`). Erreichen lässt sich das Netz heute nicht,
		 * die Sperren davor halten jeden Lauf auf. Ein umbenannter Index oder
		 * ein Tippfehler fiele deshalb nie auf, und das Netz griffe still ins
		 * Leere. Hier fällt es auf.
		 */
		const namen = [
			'voting_round_eine_offene',
			'voting_round_agenda_item_id_ordinal_key',
			'meeting_handover_offen_idx'
		];
		const gefunden = await admin<{ relname: string }[]>`
			SELECT relname FROM pg_class WHERE relkind = 'i' AND relname = ANY(${namen})
		`;
		expect(gefunden.map((z) => z.relname).sort()).toEqual([...namen].sort());
	});
});

describe('S10: leerer Stapel ohne offenen Durchgang', () => {
	it('sagt, dass keine Abstimmung offen ist, statt abzustürzen', async () => {
		const h = await haus('Rennhaus S10', '2027-06-05');
		await expect(gibStimmenAb(handelnder(), h.versammlung, [], false)).rejects.toMatchObject({
			kennung: 'keine_abstimmung'
		});
	});
});
