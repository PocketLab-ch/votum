/**
 * Die Kette: Hausbeschluss → Weisung → Stimme in der Miteigentümergemeinschaft.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Ja, und die Weisung müsstest du dann auch
 * bauen, dass dann korrekt abgestimmt wird.»
 *
 * **Warum in der Datenbank geprüft.** Jedes Glied war einzeln vorhanden und
 * keines mit dem nächsten verbunden: Das Haus beschloss, jemand tippte die
 * Weisung ab, und dieselbe Haltung wurde danach ein drittes Mal als Stimme
 * eingetragen. Was hier geprüft wird, ist genau das Dazwischen — über welchen
 * Bezug die Anwendung den richtigen Hausbeschluss findet (das **Geschäft**), und
 * dass am Ende Stimmzeilen stehen, die zu den Weisungen passen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, eroeffneVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { haltErfordernisAmTraktandumFest, holeTraktanden } from '$lib/server/traktanden';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import {
	holeWeisungsstand,
	leiteWeisungenAbSammel,
	setzeWeisungsbindung,
	stimmeNachWeisungenAb,
	trageOhneBeschlussEin
} from '$lib/server/weisung';
import { speichereWeisungsregel } from '$lib/server/reglement';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function wer() {
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

/** Ein Haus mit einer Einheit und einer Partei — mehr braucht die Kette nicht. */
async function haus(name: string) {
	const g = await erstelleGemeinschaft(wer(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(wer(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(wer(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `Eigentümer ${name}`,
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(wer(), e.id, p.id, '2020-01-01');
	return g.id;
}

let megId: string;
let tagId: string;
let megVersammlung: string;
const hausId: Record<string, string> = {};
const hausVersammlung: Record<string, string> = {};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Weisungskette');
	benutzer = await pruefbenutzer(betreiber, 'weisungskette');

	// Zwei Häuser und die MEG, deren Mitglieder sie sind.
	for (const n of ['A', 'B']) hausId[n] = await haus(`Kettenhaus ${n}`);

	const meg = await erstelleGemeinschaft(wer(), {
		name: 'Ketten-MEG Umgebung',
		quotaDenominator: 2,
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	megId = meg.id;
	for (const n of ['A', 'B']) {
		const anteil = await erstelleEinheit(wer(), {
			stwegId: megId,
			kind: 'unit',
			label: `Anteil ${n}`,
			quotas: { stamm: 1 },
			countsAsHead: true
		});
		const partei = await erstelleEigentuemer(wer(), {
			stwegId: megId,
			kind: 'gemeinschaft',
			displayName: `Kettenhaus ${n}`,
			isCommunity: false,
			memberStwegId: hausId[n],
			representativeName: `Vertretung ${n}`
		});
		await ordneEigentumZu(wer(), anteil.id, partei.id, '2020-01-01');
	}

	// Ein gemeinsamer Abend, an dem beide Häuser und die MEG tagen.
	const tag = await erstelleVersammlungstag(wer(), {
		bezeichnung: 'Kettenabend',
		datum: '2026-06-10',
		uhrzeit: '18:00',
		ort: 'Saal',
		art: 'ordentlich',
		betriebsart: 'einfach'
	});
	tagId = tag.id;

	let stelle = 0;
	for (const [name, id] of [...Object.entries(hausId), ['MEG', megId] as const]) {
		const v = await erstelleVersammlung(wer(), {
			stwegId: id,
			datum: '2026-06-10',
			uhrzeit: '18:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await nimmInTagAuf(wer(), tagId, v.id, stelle++);
		if (name === 'MEG') megVersammlung = v.id;
		else hausVersammlung[name] = v.id;
	}

	/*
	 * **Die Geschäfte vor dem Eröffnen** — nachher weist die Anwendung sie zu
	 * Recht ab: Ein Geschäft in eine laufende Versammlung zu legen, ist ein
	 * Spontantraktandum; ob darüber abgestimmt werden darf, entscheiden
	 * Reglement oder Universalversammlung (Migrationen 127 und 128).
	 *
	 * Das Geschäft ist der Bezug, über den die Anwendung den Hausbeschluss dem
	 * Punkt der MEG zuordnet.
	 */
	await erstelleGeschaeft(wer(), tagId, {
		titel: 'Sanierung der Einfahrt',
		antragswortlaut: 'Die Einfahrt wird saniert.',
		art: 'abstimmung',
		meetingIds: [hausVersammlung.A, hausVersammlung.B, megVersammlung]
	});
	// Nur Haus A und die MEG: Haus B entscheidet hier nicht.
	await erstelleGeschaeft(wer(), tagId, {
		titel: 'Sitzbank beim Sandkasten',
		antragswortlaut: 'Eine Sitzbank wird aufgestellt.',
		art: 'abstimmung',
		meetingIds: [hausVersammlung.A, megVersammlung]
	});
	// Nur die MEG: kein Haus entscheidet.
	await erstelleGeschaeft(wer(), tagId, {
		titel: 'Rampe beim Hintereingang',
		antragswortlaut: 'Eine Rampe wird gebaut.',
		art: 'abstimmung',
		meetingIds: [megVersammlung]
	});

	// Alle eröffnen und je eine Partei anwesend setzen.
	for (const v of [hausVersammlung.A, hausVersammlung.B, megVersammlung]) {
		for (const t of await holeTraktanden(betreiber, v)) {
			if (t.knoten.art === 'abstimmung') {
				await haltErfordernisAmTraktandumFest(wer(), v, t.knoten.id, EINFACHES_MEHR);
			}
		}
		await gibVersammlungFrei(wer(), v);
		await eroeffneVersammlung(wer(), v);
		const staende = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM snapshot_party WHERE meeting_id = ${v}`
		);
		for (const s of staende) await bestaetigeAnwesenheit(wer(), v, s.id);
	}
});

afterAll(verbindungenSchliessen);

/** Das Traktandum «Sanierung der Einfahrt» in einer Versammlung. */
async function punkt(versammlung: string) {
	const t = (await holeTraktanden(betreiber, versammlung)).find(
		(x) => x.knoten.titel === 'Sanierung der Einfahrt'
	);
	if (!t) throw new Error(`Kein Punkt «Sanierung der Einfahrt» in ${versammlung}`);
	return t.knoten.id;
}

describe('Die Weisungskette', () => {
	it('findet den Hausbeschluss über das Geschäft und leitet die Weisungen ab', async () => {
		// Haus A stimmt zu, Haus B lehnt ab.
		for (const [name, wahl] of [
			['A', 'yes'],
			['B', 'no']
		] as const) {
			const v = hausVersammlung[name];
			const t = await punkt(v);
			await oeffneAbstimmung(wer(), v, t);
			const [s] = await imKontext(betreiber, (tx) =>
				tx<{ party_id: string }[]>`SELECT party_id FROM snapshot_party WHERE meeting_id = ${v}`
			);
			await gibStimmenAb(wer(), v, [{ parteiId: s.party_id, wahl }], true, 'Erfassung im Prueflauf');
			await schliesseAbstimmung(wer(), v);
		}

		const megPunkt = await punkt(megVersammlung);
		await setzeWeisungsbindung(wer(), megVersammlung, megPunkt, true);

		const befund = await leiteWeisungenAbSammel(wer(), megVersammlung, megPunkt);
		expect(befund.offen).toEqual([]);
		expect(befund.gelungen).toHaveLength(2);

		const stand = await holeWeisungsstand(betreiber, megVersammlung, megPunkt);
		expect(stand?.vorliegend).toBe(2);
		expect(stand?.vollstaendig).toBe(true);
		// **Die Richtung stimmt je Haus** — nicht bloss «es liegen zwei vor».
		const jeHaus = Object.fromEntries(
			(stand?.stand ?? []).map((h) => [h.name, h.weisung?.haltung])
		);
		expect(jeHaus['Kettenhaus A']).toBe('ja');
		expect(jeHaus['Kettenhaus B']).toBe('nein');
		// Und die Herkunft ist der Beschluss, nicht eine Erklärung.
		expect((stand?.stand ?? []).every((h) => h.weisung?.herkunft === 'beschluss')).toBe(true);
	});

	/*
	 * **Der dritte Zustand, der bis zum 08.09.2026 den Satz des zweiten trug.**
	 *
	 * Gefunden im Browserlauf über den Verbund: Die Sammelableitung
	 * meldete «übernommen: nichts» und nannte jedes Haus mit «kein geschlossener
	 * Beschluss zu diesem Geschäft» — auch eines, das eine Minute vorher genau
	 * darüber abgestimmt und geschlossen hatte. Es fehlte kein Beschluss, es
	 * fehlte die Klammer: Der Abend verbindet lose Traktanden über ihren Titel,
	 * und der Punkt im Haus hiess anders.
	 *
	 * «Rampe beim Hintereingang» ist im Aufbau oben genau so angelegt — ein Geschäft, das
	 * nur die MEG führt. Gemessen wird nicht, dass es scheitert, sondern
	 * **wovon die Absage spricht**: von der fehlenden Klammer, nicht vom
	 * fehlenden Beschluss.
	 */
	it('sagt beim Geschäft, das kein Haus mitführt, woran es liegt', async () => {
		const t = (await holeTraktanden(betreiber, megVersammlung)).find(
			(x) => x.knoten.titel === 'Rampe beim Hintereingang'
		);
		if (!t) throw new Error('Kein Punkt «Rampe beim Hintereingang» in der MEG');
		await expect(leiteWeisungenAbSammel(wer(), megVersammlung, t.knoten.id)).rejects.toThrow(
			/Kein Haus führt diesen Punkt als dasselbe Geschäft/
		);
		// Und der alte, irreführende Satz kommt darin nicht mehr vor.
		await expect(leiteWeisungenAbSammel(wer(), megVersammlung, t.knoten.id)).rejects.not.toThrow(
			/kein geschlossener Beschluss zu diesem Geschäft/
		);
	});

	it('gibt die Stimmen der MEG nach den Weisungen ab', async () => {
		const megPunkt = await punkt(megVersammlung);
		await oeffneAbstimmung(wer(), megVersammlung, megPunkt);

		const befund = await stimmeNachWeisungenAb(wer(), megVersammlung, megPunkt);
		expect(befund.offen).toEqual([]);
		expect(befund.zeilen).toBe(2);

		// **Nachgemessen an den Stimmzeilen**, nicht am Rückgabewert: ein Ja und
		// ein Nein, und beide von der Sitzungsleitung erfasst.
		const stimmen = await imKontext(betreiber, (tx) =>
			tx<{ choice: string; recorded_by_chair: boolean }[]>`
				SELECT v.choice, v.recorded_by_chair
				FROM vote v JOIN voting_round r ON r.id = v.round_id
				WHERE r.meeting_id = ${megVersammlung} AND r.state = 'offen'
			`
		);
		expect(stimmen.map((s) => s.choice).sort()).toEqual(['no', 'yes']);
		expect(stimmen.every((s) => s.recorded_by_chair)).toBe(true);
	});

	it('trägt für ein Haus ohne Beschluss ein, was sein Reglement vorsieht', async () => {
		/*
		 * Ein zweites Geschäft, über das nur Haus A entscheidet. Haus B bekommt
		 * eine Weisungsregel mit «ohne Beschluss gilt Nein» — und genau das muss
		 * eingetragen werden, mit der Fundstelle in der Bemerkung.
		 */
		await speichereWeisungsregel(wer(), {
			stwegId: hausId.B,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Art. 7 Ziff. 3',
			enthaltungZaehltMit: true,
			ohneBeschluss: 'nein'
		});

		const zweiterMegPunkt = (await holeTraktanden(betreiber, megVersammlung)).find(
			(x) => x.knoten.titel === 'Sitzbank beim Sandkasten'
		)!.knoten.id;
		await setzeWeisungsbindung(wer(), megVersammlung, zweiterMegPunkt, true);

		// Haus A beschliesst, Haus B nicht.
		const vA = hausVersammlung.A;
		const tA = (await holeTraktanden(betreiber, vA)).find(
			(x) => x.knoten.titel === 'Sitzbank beim Sandkasten'
		)!.knoten.id;
		await haltErfordernisAmTraktandumFest(wer(), vA, tA, EINFACHES_MEHR);
		await oeffneAbstimmung(wer(), vA, tA);
		const [sA] = await imKontext(betreiber, (tx) =>
			tx<{ party_id: string }[]>`SELECT party_id FROM snapshot_party WHERE meeting_id = ${vA}`
		);
		await gibStimmenAb(wer(), vA, [{ parteiId: sA.party_id, wahl: 'yes' }], true, 'Erfassung im Prueflauf');
		await schliesseAbstimmung(wer(), vA);

		const abgeleitet = await leiteWeisungenAbSammel(wer(), megVersammlung, zweiterMegPunkt);
		expect(abgeleitet.gelungen).toEqual(['Kettenhaus A']);
		expect(abgeleitet.offen.map((o) => o.name)).toEqual(['Kettenhaus B']);

		const nachReglement = await trageOhneBeschlussEin(wer(), megVersammlung, zweiterMegPunkt);
		expect(nachReglement.gelungen).toHaveLength(1);
		expect(nachReglement.gelungen[0]).toContain('Kettenhaus B');

		const stand = await holeWeisungsstand(betreiber, megVersammlung, zweiterMegPunkt);
		const b = (stand?.stand ?? []).find((h) => h.name === 'Kettenhaus B');
		expect(b?.weisung?.haltung).toBe('nein');
		// Die Herkunft ist die Auffangregel der Anwendung, kein Beschluss und
		// keine Erklärung: Es gab weder das eine noch das andere
		// (Produktentscheid 08.10.2026, Migration 152).
		expect(b?.weisung?.herkunft).toBe('auffangregel');
		expect(b?.weisung?.bemerkung).toContain('Art. 7 Ziff. 3');
	});

	it('lässt ein Haus ohne Weisungsregel offen, statt Enthaltung zu unterstellen', async () => {
		const p = (await holeTraktanden(betreiber, megVersammlung)).find(
			(x) => x.knoten.titel === 'Rampe beim Hintereingang'
		)!.knoten.id;
		await setzeWeisungsbindung(wer(), megVersammlung, p, true);

		const befund = await trageOhneBeschlussEin(wer(), megVersammlung, p);
		// Haus B hat eine Regel, Haus A nicht — also genau eines von beiden.
		expect(befund.gelungen).toHaveLength(1);
		expect(befund.offen.map((o) => o.name)).toEqual(['Kettenhaus A']);
		expect(befund.offen[0].grund).toContain('keine Weisungsregel');
	});
});
