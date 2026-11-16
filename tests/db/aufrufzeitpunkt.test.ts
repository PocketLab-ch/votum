/**
 * Der Zeitpunkt des Aufrufs — in der Datenbank (Migration 084).
 *
 * **Warum es diese Datei gibt.** Am gemeinsamen Abend führt jedes Haus seinen
 * eigenen Punkt; welchen der Saal bespricht, ist der **zuletzt aufgerufene**.
 * Diese Angabe fehlte, und die Wand riet: Sie nahm den am häufigsten
 * aufgerufenen und fiel bei Gleichstand auf die alphabetische Reihenfolge
 * zurück — für immer dieselbe. Gemeldet am 25.08.2026: «Wenn ich nun das
 * Traktandum 2.2 aufrufe, bleibt die Präsentationsansicht bei 2.1 stehen.»
 *
 * **Drei Stellen schreiben `current_agenda_item_id`** — `stelleAufTraktandum`,
 * `oeffneAbstimmung` und das Schliessen der Versammlung. Jede muss den
 * Zeitpunkt mitschreiben; der CHECK `meeting_aufruf_vollstaendig` erzwingt es.
 * Geprüft wird hier jede der drei, und zwar an dem, was in der Tabelle steht —
 * eine reine Funktion sieht davon nichts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { oeffneAbstimmung } from '$lib/server/abstimmung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
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

async function aufbau(name: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum: '2026-05-20',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	const stand = await imKontext(betreiber, (tx) =>
		tx<{ id: string }[]>`SELECT id FROM snapshot_party WHERE meeting_id = ${v.id}`
	);
	await bestaetigeAnwesenheit(handelnder(betreiber), v.id, stand[0].id);
	return { versammlung: v.id, traktandum: t.id };
}

/** Was in der Tabelle steht — nicht, was eine Funktion zurückgibt. */
async function inDerTabelle(meetingId: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ current_agenda_item_id: string | null; current_agenda_item_at: Date | null }[]>`
			SELECT current_agenda_item_id, current_agenda_item_at FROM meeting WHERE id = ${meetingId}
		`
	);
	return z;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Aufrufzeitpunkt');
});

afterAll(verbindungenSchliessen);

describe('Der Zeitpunkt des Aufrufs', () => {
	it('entsteht beim Aufrufen und verschwindet beim Zurücknehmen', async () => {
		const a = await aufbau('Aufruf A');

		// Vor dem Aufruf: kein Punkt, kein Zeitpunkt.
		const vorher = await inDerTabelle(a.versammlung);
		expect(vorher.current_agenda_item_id).toBeNull();
		expect(vorher.current_agenda_item_at).toBeNull();

		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const nachher = await inDerTabelle(a.versammlung);
		expect(nachher.current_agenda_item_id).toBe(a.traktandum);
		expect(nachher.current_agenda_item_at).toBeInstanceOf(Date);

		// Zurücknehmen löscht beides — ein Zeitpunkt ohne Punkt gehört zu nichts.
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, null);
		const zurueck = await inDerTabelle(a.versammlung);
		expect(zurueck.current_agenda_item_id).toBeNull();
		expect(zurueck.current_agenda_item_at).toBeNull();
	});

	it('rückt vor, wenn derselbe Punkt erneut aufgerufen wird', async () => {
		/*
		 * **Der Fall, den die Menge der laufenden Punkte nicht sieht.** Springt
		 * die Sitzungsleitung von 2.2 auf 2.1 zurück, bleibt in jedem Haus ein
		 * Punkt aufgerufen — die Menge ändert sich nicht. Nur der Zeitpunkt sagt,
		 * worüber der Saal jetzt spricht.
		 */
		const a = await aufbau('Aufruf B');
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const erst = (await inDerTabelle(a.versammlung)).current_agenda_item_at!;
		await new Promise((r) => setTimeout(r, 20));
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const dann = (await inDerTabelle(a.versammlung)).current_agenda_item_at!;
		expect(dann.getTime()).toBeGreaterThan(erst.getTime());
	});

	it('entsteht auch, wenn die Abstimmung den Punkt setzt', async () => {
		/*
		 * `oeffneAbstimmung` schreibt `current_agenda_item_id` selbst — die
		 * zweite der drei Schreibstellen. Ohne den Zeitpunkt dort wiese der CHECK
		 * sie ab; ohne den CHECK wäre die Wand bei einer Abstimmung, die ohne
		 * vorherigen Aufruf geöffnet wird, wieder auf das Raten zurückgeworfen.
		 */
		const a = await aufbau('Aufruf C');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const z = await inDerTabelle(a.versammlung);
		expect(z.current_agenda_item_id).toBe(a.traktandum);
		expect(z.current_agenda_item_at).toBeInstanceOf(Date);
	});

	it('verschwindet mit dem Schliessen der Versammlung', async () => {
		const a = await aufbau('Aufruf D');
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		const z = await inDerTabelle(a.versammlung);
		expect(z.current_agenda_item_id).toBeNull();
		expect(z.current_agenda_item_at).toBeNull();
	});

	it('lässt sich nicht halb setzen — der CHECK hält beides zusammen', async () => {
		/*
		 * **Der Wächter, nicht die Instanz.** Eine vierte Schreibstelle, die den
		 * Zeitpunkt vergisst, soll beim ersten Schreiben auffallen und nicht erst
		 * im Saal. Geprüft wird deshalb die Schranke selbst.
		 */
		const a = await aufbau('Aufruf E');
		await expect(
			imKontext(betreiber, (tx) =>
				tx`UPDATE meeting SET current_agenda_item_id = ${a.traktandum} WHERE id = ${a.versammlung}`
			)
		).rejects.toThrow(/meeting_aufruf_vollstaendig/);

		await expect(
			imKontext(betreiber, (tx) =>
				tx`UPDATE meeting SET current_agenda_item_at = now() WHERE id = ${a.versammlung}`
			)
		).rejects.toThrow(/meeting_aufruf_vollstaendig/);
	});
});
