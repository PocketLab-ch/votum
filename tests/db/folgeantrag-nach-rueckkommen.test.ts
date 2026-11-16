/**
 * Der Folgeantrag nach einem angenommenen Rückkommen (Plan
 * `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Block B1).
 *
 * **Produktentscheid 30.09.2026:** Nach einem angenommenen Rückkommen darf
 * statt des alten Antrags ein Folgeantrag zur Abstimmung kommen, «statt des
 * alten». Das Rückkommen trägt genau einen Durchgang. Angenommen ersetzt er
 * den alten Beschluss, abgelehnt entfällt der alte, ohne Beschluss bleibt der
 * alte.
 *
 * Dazu die zwei Befunde aus dem Ist-Zustand: Ein Folgeantrag liess sich nach
 * dem Grundantrag ohne Rückkommen abstimmen (Ist 3), und nach einer Ersetzung
 * über den Folgeantrag hielte jede Sperre das Grundtraktandum für unbehandelt
 * (Ist 4).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum,
	vertageVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeOffeneFolgeantraege,
	holeTraktanden,
	nimmTraktandumAuf,
	stelleRueckkommensantrag,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	holeDurchgaenge,
	holeErgebnis,
	holeFolgeantragsbeschluesse,
	holeKonsultativMoeglich,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import { holeAuswertung } from '$lib/server/auswertung';
import { erzeugeProtokollentwurf } from '$lib/server/protokoll';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

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

type Wahl = 'yes' | 'no';

/**
 * Eine laufende Versammlung mit vier Parteien und einem angekündigten Antrag,
 * noch nicht abgestimmt.
 *
 * Vier Parteien und Stichentscheid nach Wertquoten, damit auch der Fall «ohne
 * Beschluss» im selben Aufbau läuft: 2 zu 2 aus einer Handzählung lässt den
 * Stichentscheid offen (wie `rueckkommen-stichentscheid.test.ts`).
 */
async function versammlung(name: string, datum: string, zweites = false) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'wertquote',
		tieBreakRuleSource: 'Art. 30 Reglement'
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Muster A', 'Muster B', 'Muster C', 'Muster D'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 225 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
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
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ERFORDERNIS);
	if (zweites) {
		// Ein angekündigtes, unbehandeltes Traktandum als Gegenprobe zur Vertagung.
		const u = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel: 'Noch nicht behandelt',
			art: 'abstimmung',
			antragswortlaut: 'Der Veloraum wird neu gestrichen.',
			antragstellerart: 'bewirtschaftung'
		});
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, u.id, ERFORDERNIS);
	}
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}

	const alle = (wahl: Wahl) => parteien.map((parteiId) => ({ parteiId, wahl }));
	return { versammlung: v.id, grund: t.id, parteien, alle };
}

type Lage = Awaited<ReturnType<typeof versammlung>>;

/** Stimmt über ein Traktandum ab und schliesst den Durchgang. */
async function abstimmen(versammlungId: string, traktandum: string, wahlen: { parteiId: string; wahl: Wahl }[]) {
	await stelleAufTraktandum(handelnder(betreiber), versammlungId, traktandum);
	await oeffneAbstimmung(handelnder(betreiber), versammlungId, traktandum);
	await gibStimmenAb(handelnder(betreiber), versammlungId, wahlen, true, 'Prüflauf: von der Sitzungsleitung erfasst');
	const d = await schliesseAbstimmung(handelnder(betreiber), versammlungId);
	return holeErgebnis(betreiber, versammlungId, d.id);
}

/** Nimmt einen Folgeantrag zum Grundantrag auf und setzt sein Erfordernis. */
async function folgeantrag(s: Lage, titel = 'Nur die Wetterseite') {
	const f = await nimmTraktandumAuf(
		handelnder(betreiber),
		{
			meetingId: s.versammlung,
			parentId: s.grund,
			titel,
			art: 'abstimmung',
			antragswortlaut: 'Saniert wird vorerst nur die Wetterseite.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, f.id, ERFORDERNIS);
	return f;
}

/** Grundantrag angenommen, Rückkommen darauf angenommen. */
async function nachAngenommenemRueckkommen(name: string, datum: string, zweites = false) {
	const s = await versammlung(name, datum, zweites);
	const erst = await abstimmen(s.versammlung, s.grund, s.alle('yes'));
	expect(erst.auszaehlung?.angenommen).toBe(true);
	const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
	await abstimmen(s.versammlung, r.id, s.alle('yes'));
	return { ...s, erst: erst.durchgang.id, rueckkommen: r.id };
}

/** Wie der Durchgang in der Tabelle steht. */
async function zeile(id: string) {
	const [z] = await imKontext(
		betreiber,
		(tx) => tx<
			{ supersede_kind: string | null; superseded_by_round_id: string | null; reconsideration_item_id: string | null }[]
		>`SELECT supersede_kind, superseded_by_round_id, reconsideration_item_id FROM voting_round WHERE id = ${id}`
	);
	return z;
}

/** Der massgebende Durchgang der Sache (Migration 133). */
async function massgebend(traktandum: string): Promise<string | null> {
	const [m] = await imKontext(
		betreiber,
		(tx) => tx<{ id: string | null }[]>`SELECT massgebender_durchgang(${traktandum}) AS id`
	);
	return m.id;
}

async function meldung(p: Promise<unknown>): Promise<string> {
	return p.then(
		() => 'durchgelassen',
		(f: unknown) => (f as Error).message
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Folgeantrag nach Rückkommen');
	benutzer = await pruefbenutzer(betreiber, 'folgeantrag-rueckkommen');
});

afterAll(verbindungenSchliessen);

describe('Ohne Rückkommen (Ist 3)', () => {
	it('lässt einen vorher aufgenommenen Folgeantrag nach dem Grundantrag nicht mehr abstimmen', async () => {
		/*
		 * **Die Lücke im Bestand.** Der Folgeantrag wurde vor der ersten
		 * Abstimmung aufgenommen, dann wurde über den Grundantrag abgestimmt. Bis
		 * hierher liess sich der Folgeantrag danach eröffnen, ohne Rückkommen,
		 * und es standen zwei Beschlüsse zur selben Sache.
		 */
		const s = await versammlung('Folgeweg 1', '2027-09-01');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, s.grund, s.alle('yes'));

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f.id);
		const m = await meldung(oeffneAbstimmung(handelnder(betreiber), s.versammlung, f.id));
		expect(m).toMatch(/^Über den Grundantrag «Fassadensanierung» ist bereits abgestimmt\./);
		expect(m).toMatch(/Rückkommen auf den Grundantrag/);
	});

	it('nennt beim Eröffnen den Weg, solange über das Rückkommen noch nicht abgestimmt ist', async () => {
		// Codeprüfung B1, N-1: «nicht angenommen» hiess dort bisher auch «noch
		// nicht abgestimmt», und die Absage erklärte den Weg für verschlossen.
		const s = await versammlung('Folgeweg 17', '2027-09-17');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, s.grund, s.alle('yes'));
		await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f.id);
		expect(await meldung(oeffneAbstimmung(handelnder(betreiber), s.versammlung, f.id))).toMatch(
			/^Über den Folgeantrag wird erst abgestimmt, wenn die Versammlung den Rückkommensantrag zu «Fassadensanierung» angenommen hat\./
		);
	});

	it('lässt den Folgeantrag vor dem Grundantrag abstimmen wie bisher (Gegenprobe)', async () => {
		const s = await versammlung('Folgeweg 2', '2027-09-02');
		const f = await folgeantrag(s);
		const e = await abstimmen(s.versammlung, f.id, s.alle('no'));
		expect(e.auszaehlung?.angenommen).toBe(false);
		expect((await zeile(e.durchgang.id)).reconsideration_item_id).toBeNull();
		// Und danach der Grundantrag, ebenfalls ohne Rückkommen.
		const g = await abstimmen(s.versammlung, s.grund, s.alle('yes'));
		expect(g.auszaehlung?.angenommen).toBe(true);
	});

	it('nimmt nach dem Grundantrag keinen Folgeantrag auf, solange das Rückkommen nicht angenommen ist', async () => {
		const s = await versammlung('Folgeweg 3', '2027-09-03');
		await abstimmen(s.versammlung, s.grund, s.alle('yes'));
		const WEG = /angenommenen Rückkommensantrag auf den Grundantrag, der noch keinen Durchgang getragen hat/;
		expect(await meldung(folgeantrag(s))).toMatch(WEG);

		// Auch nicht mit abgelehntem Rückkommen; die Meldung nennt dann keinen
		// Schritt, der schon getan ist (Codeprüfung B1, N-2).
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
		await abstimmen(s.versammlung, r.id, s.alle('no'));
		expect(await meldung(folgeantrag(s))).toMatch(WEG);
	});
});

describe('Kein Häkchen «konsultativ» unter einem Rückkommen (H7, Teil D, Befund 5)', () => {
	it('bietet am Folgeantrag nach angenommenem Rückkommen nicht konsultativ an', async () => {
		/*
		 * Am eigenen Traktandum gilt kein Beschluss, aber das Rückkommen auf den
		 * Grundantrag trägt den nächsten Durchgang. Der Server wiese mit
		 * `konsultativ_rueckkommen` ab; die Seite fragt deshalb dasselbe.
		 */
		const s = await nachAngenommenemRueckkommen('Folgeweg konsultativ', '2027-09-14');
		const f = await folgeantrag(s);
		expect(await holeKonsultativMoeglich(betreiber, s.versammlung, f.id)).toBe(false);
		// Gegenprobe: ohne Beschluss und ohne Rückkommen wird es angeboten.
		const frisch = await versammlung('Folgeweg konsultativ frei', '2027-09-15');
		expect(await holeKonsultativMoeglich(betreiber, frisch.versammlung, frisch.grund)).toBe(true);
	});
});

describe('Folgeantrag statt des alten', () => {
	it('angenommen: ersetzt den alten Beschluss, über zwei Traktanden', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 4', '2027-09-04');
		const f = await folgeantrag(s);
		const e = await abstimmen(s.versammlung, f.id, s.alle('yes'));
		expect(e.auszaehlung?.angenommen).toBe(true);

		// Der Durchgang stützt sich auf das Rückkommen auf den Grundantrag …
		expect((await zeile(e.durchgang.id)).reconsideration_item_id).toBe(s.rueckkommen);
		// … und ersetzt den alten Beschluss, mit Verweis auf sich.
		const alt = await zeile(s.erst);
		expect(alt.supersede_kind).toBe('rueckkommen');
		expect(alt.superseded_by_round_id).toBe(e.durchgang.id);
		// Die Sache hat einen massgebenden Durchgang: den des Folgeantrags.
		expect(await massgebend(s.grund)).toBe(e.durchgang.id);
		expect(await massgebend(f.id)).toBe(e.durchgang.id);
	});

	it('abgelehnt: der alte Beschluss entfällt (Nein heisst Nein)', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 5', '2027-09-05');
		const f = await folgeantrag(s);
		const e = await abstimmen(s.versammlung, f.id, s.alle('no'));
		expect(e.auszaehlung?.angenommen).toBe(false);

		const alt = await zeile(s.erst);
		expect(alt.supersede_kind).toBe('rueckkommen');
		expect(alt.superseded_by_round_id).toBe(e.durchgang.id);
		expect(await massgebend(s.grund)).toBe(e.durchgang.id);
	});

	it('ohne Beschluss: der alte bleibt, und die Neuabstimmung stellt fest', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 6', '2027-09-06');
		const f = await folgeantrag(s);
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f.id);
		const d = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, f.id);
		await erfasseSummen(handelnder(betreiber), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		expect((await holeErgebnis(betreiber, s.versammlung, d.id)).auszaehlung?.stichentscheidOffen).toBe(true);

		expect((await zeile(d.id)).supersede_kind).toBe('rueckkommen_erfolglos');
		expect((await zeile(s.erst)).supersede_kind).toBeNull();
		expect(await massgebend(s.grund)).toBe(s.erst);

		// Der Weg über die Neuabstimmung wie beim alten Antrag: Das Rückkommen
		// trägt danach den nächsten Durchgang über den Folgeantrag.
		await setzeNeuabstimmungAn(handelnder(betreiber), s.versammlung, d.id, 'Einzeln erfassen');
		const e = await abstimmen(s.versammlung, f.id, s.alle('yes'));
		expect(e.durchgang.nummer).toBe(2);
		expect((await zeile(e.durchgang.id)).reconsideration_item_id).toBe(s.rueckkommen);
		expect(await massgebend(s.grund)).toBe(e.durchgang.id);
	});

	it('Neuabstimmung auf den verkündeten Folgeantrag: abgewiesen, sein Beschluss ersetzt den alten weiter', async () => {
		// H6: Der Beschluss über den Folgeantrag ist mit dem Schliessen verkündet.
		// Bis dahin überholte ihn die Neuabstimmung, der alte galt wieder
		// (`vote.round.reinstated`); ändern kann ihn jetzt nur die Versammlung.
		const s = await nachAngenommenemRueckkommen('Folgeweg 7', '2027-09-07');
		const f = await folgeantrag(s);
		const e = await abstimmen(s.versammlung, f.id, s.alle('yes'));

		const neu = setzeNeuabstimmungAn(handelnder(betreiber), s.versammlung, e.durchgang.id, 'Falsch gezählt');
		await expect(neu).rejects.toMatchObject({ kennung: 'schon_verkuendet' });
		await expect(neu).rejects.toThrow(/Beantragen Sie das Rückkommen/);
		expect((await zeile(e.durchgang.id)).supersede_kind).toBeNull();
		const alt = await zeile(s.erst);
		expect(alt.supersede_kind).toBe('rueckkommen');
		expect(alt.superseded_by_round_id).toBe(e.durchgang.id);
		expect(await massgebend(s.grund)).toBe(e.durchgang.id);
	});

	it('Neuabstimmung auf den unentschiedenen Folgeantrag: das Rückkommen trägt danach den alten Antrag', async () => {
		// Seit H6 über den offenen Gleichstand: Nur er lässt sich noch überholen.
		// Der Durchgang über den Folgeantrag hat den alten Beschluss nie ersetzt.
		const s = await nachAngenommenemRueckkommen('Folgeweg 18', '2027-09-18');
		const f = await folgeantrag(s);
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f.id);
		const d = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, f.id);
		await erfasseSummen(handelnder(betreiber), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		await setzeNeuabstimmungAn(handelnder(betreiber), s.versammlung, d.id, 'Falsch gezählt');
		expect((await zeile(d.id)).supersede_kind).toBe('korrektur');
		const alt = await zeile(s.erst);
		expect(alt.supersede_kind).toBeNull();
		expect(alt.superseded_by_round_id).toBeNull();
		expect(await massgebend(s.grund)).toBe(s.erst);

		// Die Leitung wählt erneut: diesmal der alte Antrag, getragen vom selben Rückkommen.
		const g = await abstimmen(s.versammlung, s.grund, s.alle('no'));
		expect((await zeile(g.durchgang.id)).reconsideration_item_id).toBe(s.rueckkommen);
		expect((await zeile(s.erst)).superseded_by_round_id).toBe(g.durchgang.id);
	});
});

describe('Genau ein Durchgang', () => {
	it('sperrt einen zweiten Folgeantrag, auch einen vorher aufgenommenen', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 8', '2027-09-08');
		const f1 = await folgeantrag(s, 'Nur die Wetterseite');
		const f2 = await folgeantrag(s, 'Nur die Nordseite');
		await abstimmen(s.versammlung, f1.id, s.alle('yes'));

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f2.id);
		expect(await meldung(oeffneAbstimmung(handelnder(betreiber), s.versammlung, f2.id))).toMatch(
			/hat seinen einen Durchgang schon getragen/
		);
		// Und ein dritter lässt sich gar nicht erst aufnehmen.
		expect(await meldung(folgeantrag(s, 'Nur das Dach'))).toMatch(/bereits abgestimmt/);
	});

	it('sperrt den Folgeantrag, wenn das Rückkommen den alten Antrag getragen hat', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 9', '2027-09-09');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, s.grund, s.alle('no'));

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f.id);
		expect(await meldung(oeffneAbstimmung(handelnder(betreiber), s.versammlung, f.id))).toMatch(
			/hat seinen einen Durchgang schon getragen/
		);
	});

	it('lässt einen vor dem Grundantrag abgestimmten Folgeantrag nicht ein zweites Mal zu', async () => {
		const s = await versammlung('Folgeweg 10', '2027-09-10');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('no'));
		await abstimmen(s.versammlung, s.grund, s.alle('yes'));
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
		await abstimmen(s.versammlung, r.id, s.alle('yes'));

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, f.id);
		expect(await meldung(oeffneAbstimmung(handelnder(betreiber), s.versammlung, f.id))).toMatch(
			/als neuen Folgeantrag auf/
		);
		// Der Weg, den die Absage nennt, geht.
		const neu = await folgeantrag(s, 'Nur die Wetterseite, zweiter Anlauf');
		const e = await abstimmen(s.versammlung, neu.id, s.alle('yes'));
		expect(await massgebend(s.grund)).toBe(e.durchgang.id);
	});
});

describe('Das Grundtraktandum nach der Ersetzung (Ist 4)', () => {
	it('bleibt entschieden und gesperrt', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 11', '2027-09-11');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('yes'));

		// Kein Durchgang wie zum ersten Mal.
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.grund);
		expect(await meldung(oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.grund))).toMatch(
			/bereits zurückgekommen|neuen Rückkommensantrag/
		);
		// Kein anderes Erfordernis, kein Rückzug.
		expect(
			await meldung(haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, s.grund, ERFORDERNIS))
		).toMatch(/bereits abgestimmt/);
		expect(
			await meldung(ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.grund, 'Prüflauf: Rückzug'))
		).toMatch(/^Über diesen Antrag wurde bereits abgestimmt\./);
		// Der ersetzende Folgeantrag zählt nicht mehr als offen.
		expect(await holeOffeneFolgeantraege(betreiber, s.versammlung, s.grund)).toEqual([]);
	});

	it('trägt ein neues Rückkommen mit dem Wortlaut für einen geltenden Beschluss', async () => {
		/*
		 * Ohne Migration 133 fand `stelleRueckkommensantrag` am Grundtraktandum
		 * keinen geltenden Durchgang: «nicht behandelt», oder der Wortlaut für
		 * einen abgelehnten Antrag, obwohl der Folgeantrag angenommen ist.
		 */
		const s = await nachAngenommenemRueckkommen('Folgeweg 12', '2027-09-12');
		const f = await folgeantrag(s);
		const e = await abstimmen(s.versammlung, f.id, s.alle('yes'));

		const r2 = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
		const [w] = await imKontext(
			betreiber,
			(tx) => tx<{ motion_text: string }[]>`SELECT motion_text FROM agenda_item WHERE id = ${r2.id}`
		);
		const [w1] = await imKontext(
			betreiber,
			(tx) => tx<{ motion_text: string }[]>`SELECT motion_text FROM agenda_item WHERE id = ${s.rueckkommen}`
		);
		// Der Wortlaut für einen angenommenen Beschluss wie beim ersten Rückkommen,
		// dazu der Satz, dass jetzt der Beschluss zum Folgeantrag gilt (Plan
		// Folgeantrag nach Rückkommen, Soll 7).
		const zusatz = /Bisher gilt dazu der Beschluss zum Folgeantrag \d+\.2 «Nur die Wetterseite»\. /;
		expect(w.motion_text).toMatch(zusatz);
		expect(w.motion_text.replace(zusatz, '')).toBe(w1.motion_text);

		await abstimmen(s.versammlung, r2.id, s.alle('yes'));
		const g = await abstimmen(s.versammlung, s.grund, s.alle('no'));
		// Ersetzt wird der massgebende Durchgang der Sache, der des Folgeantrags.
		expect((await zeile(e.durchgang.id)).superseded_by_round_id).toBe(g.durchgang.id);
		expect(await massgebend(s.grund)).toBe(g.durchgang.id);

		/*
		 * Der Randfall G1, F1, G2 (Produktentscheid 08.10.2026): Der erste
		 * Durchgang am Grundantrag wurde durch den Folgeantrag ersetzt, nicht
		 * durch die spätere Abstimmung am Grundantrag. Die Auswertung trägt die
		 * Nummer des Folgeantrags, damit der Protokollsatz ihn nennt.
		 */
		const auswertung = await holeAuswertung(betreiber, s.versammlung);
		const zeileGrund = auswertung?.zeilen.find((z) => z.titel === 'Fassadensanierung');
		const nummerDesFolgeantrags = (await holeTraktanden(betreiber, s.versammlung)).find(
			(t) => t.knoten.id === f.id
		)?.nummer;
		expect(zeileGrund?.ersetztNachRueckkommen).toEqual([
			{ nummer: 1, ergebnis: 'angenommen', folgeantrag: nummerDesFolgeantrags }
		]);
		expect(zeileGrund?.ersetzung).toBeNull();
	});

	it('nimmt kein Rückkommen auf den Folgeantrag an, sondern verweist auf den Grundantrag', async () => {
		const s = await nachAngenommenemRueckkommen('Folgeweg 13', '2027-09-13');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('yes'));
		expect(await meldung(stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, f.id))).toMatch(
			/Zurückkommen lässt sich in dieser Anwendung dann nur auf den Grundantrag/
		);
	});

	it('lässt ein Rückkommen auf einen Folgeantrag zu, solange der Grundantrag offen ist (Gegenprobe)', async () => {
		const s = await versammlung('Folgeweg 14', '2027-09-14');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('no'));
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, f.id);
		await abstimmen(s.versammlung, r.id, s.alle('yes'));
		const e = await abstimmen(s.versammlung, f.id, s.alle('yes'));
		expect((await zeile(e.durchgang.id)).reconsideration_item_id).toBe(r.id);
	});
});

describe('Nach der Ersetzung, Wege über den Block hinaus (Codeprüfung B1)', () => {
	it('nimmt das ersetzte Grundtraktandum bei einer Vertagung nicht in die Folgeversammlung mit', async () => {
		/*
		 * `uebertrageOffeneTraktanden` übernimmt, was keinen geltenden Durchgang
		 * hat. Ohne Migration 133 stünde die über den Folgeantrag entschiedene
		 * Sache ein zweites Mal auf der Liste (M-1).
		 */
		const s = await nachAngenommenemRueckkommen('Folgeweg 15', '2027-09-15', true);
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('yes'));

		const { folge } = await vertageVersammlung(handelnder(betreiber), s.versammlung, {
			grund: 'Die Versammlung hat es so beschlossen'
		});
		const titel = (await holeTraktanden(betreiber, folge.id)).map((t) => t.knoten.titel);
		// Gegenprobe: Das unbehandelte kommt mit, der Weg trägt also.
		expect(titel).toContain('Noch nicht behandelt');
		expect(titel).not.toContain('Fassadensanierung');
		expect(titel).not.toContain('Nur die Wetterseite');
	});

	it('verlangt für das Rückkommen das Mehr des Folgeantrags, dessen Beschluss gilt', async () => {
		/*
		 * Der aufzuhebende Beschluss ist der zum Folgeantrag. Trägt er ein
		 * strengeres Mehr als der Grundantrag, gilt dieses auch für das
		 * Rückkommen; sonst liesse er sich mit dem einfachen Mehr des
		 * Grundantrags aufheben (M-2).
		 */
		const s = await nachAngenommenemRueckkommen('Folgeweg 16', '2027-09-16');
		const f = await folgeantrag(s);
		const qualifiziert: Erfordernis = {
			...ERFORDERNIS,
			typ: 'qualifiziertes_mehr',
			titel: 'Qualifiziertes Mehr',
			rechtsgrundlage: 'ZGB Art. 647d',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), s.versammlung, f.id, qualifiziert);
		await abstimmen(s.versammlung, f.id, s.alle('yes'));

		const r2 = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
		expect(r2.erfordernis?.typ).toBe('qualifiziertes_mehr');
		expect(r2.erfordernis?.quotenSchwelle).toEqual(qualifiziert.quotenSchwelle);
	});
});

describe('Nach dem Folgeantrag: zweites Rückkommen und eigener Beschluss (M3)', () => {
	it('nennt am Grundantrag das unbenutzte zweite Rückkommen nach der Ersetzung (Teil B)', async () => {
		/*
		 * B2b, zweiter Randfall (Produktentscheid 15.10.2026: eigener Satz). Vor
		 * M3 lieferte die Auswertung hier `null`, weil der Grundantrag keinen
		 * geltenden Durchgang mehr hat; unter 9.3 stand «siehe Traktandum 9», und
		 * Traktandum 9 sagte nichts dazu (gemessen am 15.10.2026).
		 */
		const s = await nachAngenommenemRueckkommen('Folgeweg 17', '2027-09-17');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('yes'));
		const r2 = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
		await abstimmen(s.versammlung, r2.id, s.alle('yes'));

		const nummern = new Map((await holeTraktanden(betreiber, s.versammlung)).map((t) => [t.knoten.id, t.nummer]));
		const auswertung = await holeAuswertung(betreiber, s.versammlung);
		const zeileGrund = auswertung?.zeilen.find((z) => z.titel === 'Fassadensanierung');
		expect(zeileGrund?.rueckkommenOhneDurchgang).toEqual({
			antrag: nummern.get(r2.id),
			geltenderDurchgang: 1,
			geltendAbgelehnt: false,
			folgeantrag: nummern.get(f.id)
		});

		const text = (
			await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-09-17 21:00:00')
		).body.replace(/\s+/g, ' ');
		const von = text.indexOf(`#### ${nummern.get(s.grund)} Fassadensanierung`);
		const bis = text.indexOf(`##### ${nummern.get(s.rueckkommen)} `);
		// Beide Anker müssen treffen, sonst prüfte der Ausschnitt fast den ganzen Text.
		expect(von).toBeGreaterThan(-1);
		expect(bis).toBeGreaterThan(von);
		const grund = text.slice(von, bis);
		expect(grund).toContain(
			`Die Versammlung hat beschlossen, auf dieses Traktandum zurückzukommen (Traktandum ${nummern.get(r2.id)}); ` +
				`erneut abgestimmt wurde nicht. Es bleibt beim Beschluss zum Folgeantrag ${nummern.get(f.id)}, wie oben festgehalten.`
		);
		// Der Verweis vom Rückkommensantrag zielt auf genau diese Stelle.
		expect(text).toContain(`Erneut abgestimmt wurde nicht; siehe Traktandum ${nummern.get(s.grund)}.`);
	});

	it('findet den vorher angenommenen Folgeantrag mit eigenem Beschluss, und der genannte Weg trägt (Teil A)', async () => {
		/*
		 * Fachprüfung 08.10.2026, Frage 2: Folgeantrag im gewöhnlichen Ablauf
		 * zuerst angenommen, danach der Grundantrag, dann Rückkommen auf den
		 * Grundantrag. Der Hinweis nennt den Folgeantrag und den Weg über einen
		 * weiteren Gegenantrag; der muss sich dann auch aufnehmen lassen.
		 */
		const s = await versammlung('Folgeweg 18', '2027-09-18');
		const f = await folgeantrag(s);
		await abstimmen(s.versammlung, f.id, s.alle('yes'));
		await abstimmen(s.versammlung, s.grund, s.alle('yes'));

		const lade = async () =>
			holeFolgeantragsbeschluesse(
				betreiber,
				s.versammlung,
				await holeTraktanden(betreiber, s.versammlung),
				await holeDurchgaenge(betreiber, s.versammlung)
			);
		const nummerF = (await holeTraktanden(betreiber, s.versammlung)).find((t) => t.knoten.id === f.id)?.nummer;
		expect((await lade()).get(s.grund)).toEqual([{ nummer: nummerF, titel: 'Nur die Wetterseite' }]);

		// Der Weg aus dem Hinweis: Rückkommen, dann ein weiterer Gegenantrag statt des alten.
		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.grund);
		await abstimmen(s.versammlung, r.id, s.alle('yes'));
		const f2 = await folgeantrag(s, 'Aufhebung und Neufassung');
		const e = await abstimmen(s.versammlung, f2.id, s.alle('yes'));
		expect((await zeile(e.durchgang.id)).reconsideration_item_id).toBe(r.id);

		// Der neue Gegenantrag trat an die Stelle des alten: Dann nennt der Hinweis keinen mehr
		// (Produktentscheid 15.10.2026, Codeprüfung M3); den Wortlaut liest die Anwendung nicht.
		expect((await lade()).get(s.grund)).toBeUndefined();
	});
});
