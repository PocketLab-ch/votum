/**
 * Der Rückkommensweg bei offenem Stichentscheid nach Wertquoten.
 *
 * **Ist-Zustand vom 28.09.2026, kein Soll;** siehe docs/freigabe.md, Zeile
 * ‹Rückkommen mit offenem Stichentscheid›. Die Datei hält fest, was heute
 * geschieht, wenn ein Durchgang nach angenommenem Rückkommen über eine
 * Handzählung mit Gleichstand geschlossen wird. Was richtig wäre, ist nicht
 * entschieden; die Probe beschreibt das Gemessene.
 *
 * **Der Verwalterfall ist seit dem 28.09.2026 wieder möglich**, gebaut in
 * diesem Block; er läuft bei einem offenen Gleichstand durch denselben Zweig
 * (`rueckkommen_erfolglos`, der frühere Beschluss bleibt). Die ersten zwei
 * Proben führen den Quotenstichentscheid über einer Handzählung; die dritte
 * unten den Verwalterfall über einzeln erfasste Stimmen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	haltStichentscheidFest,
	holeDurchgaenge,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
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

/**
 * Eine laufende Versammlung mit vier Parteien und einem behandelten Antrag.
 *
 * Vier, weil der Gleichstand der Handzählung Ja gleich Nein **und** Ja gleich
 * der halben Bezugsgrösse verlangt: 2 zu 2 von 4. Und mit dem Gleichstand nach
 * Wertquoten rechnet die Gemeinschaft (`tieBreak: 'wertquote'`).
 */
async function behandelt(name: string, datum: string, tieBreak: 'wertquote' | 'verwalter' = 'wertquote') {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak,
		tieBreakRuleSource: tieBreak === 'wertquote' ? 'Art. 30 Reglement' : 'Art. 7 Ziff. 5 Reglement'
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Dubi'].entries()) {
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
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}

	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

/** Stimmt über ein Traktandum ab und schliesst den Durchgang. */
async function abstimmen(
	versammlung: string,
	traktandum: string,
	wahlen: { parteiId: string; wahl: 'yes' | 'no' }[]
) {
	await stelleAufTraktandum(handelnder(betreiber), versammlung, traktandum);
	await oeffneAbstimmung(handelnder(betreiber), versammlung, traktandum);
	await gibStimmenAb(handelnder(betreiber), versammlung, wahlen, true, 'Prüflauf: von der Sitzungsleitung erfasst');
	const d = await schliesseAbstimmung(handelnder(betreiber), versammlung);
	return holeErgebnis(betreiber, versammlung, d.id);
}

/** Eröffnet den neuen Durchgang und zählt von Hand: 2 zu 2 bei vier Anwesenden. */
async function handzaehlungNachRueckkommen(versammlung: string, traktandum: string) {
	await stelleAufTraktandum(handelnder(betreiber), versammlung, traktandum);
	const d = await oeffneAbstimmung(handelnder(betreiber), versammlung, traktandum);
	await erfasseSummen(handelnder(betreiber), versammlung, { ja: 2, nein: 2, enthaltung: 0 });
	await schliesseAbstimmung(handelnder(betreiber), versammlung);
	return d;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Rückkommen Stichentscheid');
	benutzer = await pruefbenutzer(betreiber, 'rueckkommen-stichentscheid');
});

afterAll(verbindungenSchliessen);

describe('Früherer Beschluss angenommen', () => {
	it('lässt den früheren gelten; die Neuabstimmung stellt den Stichentscheid fest', async () => {
		/*
		 * **Ein offener Stichentscheid ersetzt nichts** (Reste vom 30.09.2026,
		 * Punkt 3; Fachprüfung F-10 und Reste F-1). Aufgehoben wird nach dem
		 * Antrag erst «mit dem neuen Beschluss zur Sache». Bis dahin wurde der
		 * offene Durchgang je nach früherem Ergebnis verschieden behandelt, und
		 * nach einem angenommenen war die Neuabstimmung gesperrt.
		 */
		const s = await behandelt('Stichentscheidweg 1', '2027-08-01');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(true);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'yes' }
		]);

		const zweiter = await handzaehlungNachRueckkommen(s.versammlung, s.traktandum);
		const e = await holeErgebnis(betreiber, s.versammlung, zweiter.id);
		expect(e.auszaehlung?.stichentscheidOffen).toBe(true);

		// Der offene Durchgang ersetzt nichts; der frühere bleibt massgebend.
		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, result_published_at FROM voting_round WHERE id = ${zweiter.id}`
		);
		expect(z.supersede_kind).toBe('rueckkommen_erfolglos');
		expect(z.result_published_at).toBeNull();
		const massgebend = async () =>
			(await holeDurchgaenge(betreiber, s.versammlung))
				.filter((d) => d.traktandumId === s.traktandum && !d.ueberholtAm)
				.map((d) => d.id);
		expect(await massgebend()).toEqual([erst.durchgang.id]);

		// Wand und Protokoll sagen, dass nichts festgestellt ist.
		const stand = await ermittleStand(betreiber, s.versammlung);
		expect(stand?.abstimmung?.ergebnis?.nachRueckkommen).toMatch(
			/^Im 2\. Durchgang nach dem Rückkommen ist der Stichentscheid nicht festgestellt\. Es bleibt (beim Beschluss|bei der Ablehnung) aus dem 1\. Durchgang, bis eine Neuabstimmung entscheidet\.$/
		);
		const text = (
			await stelleEntwurfZusammen(betreiber, s.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'es stand unentschieden. Nach dem Reglement entscheiden dann die Wertquoten; die liessen ' +
				'sich nicht ausrechnen, weil die Stimmen nur als Summen gezählt wurden und nicht ' +
				'festgehalten ist, wer wie gestimmt hat. Eine weitere Abstimmung mit einzeln erfassten ' +
				'Stimmen fand nicht statt. Der oben festgehaltene Beschluss bleibt in Kraft.'
		);

		// Die Neuabstimmung, auf die der Hinweis verweist, geht …
		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			s.versammlung,
			zweiter.id,
			'Einzeln erfassen statt Handzählung'
		);
		const [nach] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind FROM voting_round WHERE id = ${zweiter.id}`
		);
		expect(nach.supersede_kind).toBe('korrektur');
		expect(await massgebend()).toEqual([erst.durchgang.id]);

		// … und das Rückkommen trägt den nächsten Durchgang, ohne neuen Antrag.
		const dritter = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		expect(dritter.nummer).toBe(3);
	});
});

describe('Früherer Beschluss abgelehnt (Gegenprobe)', () => {
	it('lässt den früheren gelten; die Neuabstimmung stellt den Stichentscheid fest', async () => {
		/*
		 * **Ein offener Stichentscheid ersetzt nichts** (Reste vom 30.09.2026,
		 * Punkt 3; Fachprüfung F-10 und Reste F-1). Aufgehoben wird nach dem
		 * Antrag erst «mit dem neuen Beschluss zur Sache». Bis dahin wurde der
		 * offene Durchgang je nach früherem Ergebnis verschieden behandelt, und
		 * nach einem angenommenen war die Neuabstimmung gesperrt.
		 */
		const s = await behandelt('Stichentscheidweg 2', '2027-08-02');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'no' },
			{ parteiId: s.parteien[2], wahl: 'no' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(false);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'yes' }
		]);

		const zweiter = await handzaehlungNachRueckkommen(s.versammlung, s.traktandum);
		const e = await holeErgebnis(betreiber, s.versammlung, zweiter.id);
		expect(e.auszaehlung?.stichentscheidOffen).toBe(true);

		// Der offene Durchgang ersetzt nichts; der frühere bleibt massgebend.
		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, result_published_at FROM voting_round WHERE id = ${zweiter.id}`
		);
		expect(z.supersede_kind).toBe('rueckkommen_erfolglos');
		expect(z.result_published_at).toBeNull();
		const massgebend = async () =>
			(await holeDurchgaenge(betreiber, s.versammlung))
				.filter((d) => d.traktandumId === s.traktandum && !d.ueberholtAm)
				.map((d) => d.id);
		expect(await massgebend()).toEqual([erst.durchgang.id]);

		// Wand und Protokoll sagen, dass nichts festgestellt ist.
		const stand = await ermittleStand(betreiber, s.versammlung);
		expect(stand?.abstimmung?.ergebnis?.nachRueckkommen).toMatch(
			/^Im 2\. Durchgang nach dem Rückkommen ist der Stichentscheid nicht festgestellt\. Es bleibt (beim Beschluss|bei der Ablehnung) aus dem 1\. Durchgang, bis eine Neuabstimmung entscheidet\.$/
		);
		const text = (
			await stelleEntwurfZusammen(betreiber, s.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'es stand unentschieden. Nach dem Reglement entscheiden dann die Wertquoten; die liessen ' +
				'sich nicht ausrechnen, weil die Stimmen nur als Summen gezählt wurden und nicht ' +
				'festgehalten ist, wer wie gestimmt hat. Eine weitere Abstimmung mit einzeln erfassten ' +
				'Stimmen fand nicht statt. Der oben festgehaltene Beschluss bleibt in Kraft.'
		);

		// Die Neuabstimmung, auf die der Hinweis verweist, geht …
		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			s.versammlung,
			zweiter.id,
			'Einzeln erfassen statt Handzählung'
		);
		const [nach] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind FROM voting_round WHERE id = ${zweiter.id}`
		);
		expect(nach.supersede_kind).toBe('korrektur');
		expect(await massgebend()).toEqual([erst.durchgang.id]);

		// … und das Rückkommen trägt den nächsten Durchgang, ohne neuen Antrag.
		const dritter = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		expect(dritter.nummer).toBe(3);
	});
});

/**
 * **Der Verwalterfall ist seit dem 28.09.2026 wieder möglich** und läuft durch
 * denselben Zweig wie der Quotenstichentscheid: Der offene Durchgang ersetzt
 * nichts, der frühere Beschluss bleibt massgebend, und das Rückkommen gilt als
 * erfolglos. Die beiden Proben darüber führen den Quotenstichentscheid über
 * einer Handzählung; diese hier den Verwalter über einzeln erfasste Stimmen.
 */
describe('Verwalter-Stichentscheid nach dem Rückkommen', () => {
	it('überholt den offenen Durchgang und lässt den früheren Beschluss gelten', async () => {
		const s = await behandelt('Stichentscheidweg 3', '2027-08-03', 'verwalter');
		const erst = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(erst.auszaehlung?.angenommen).toBe(true);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), s.versammlung, s.traktandum);
		await abstimmen(s.versammlung, r.id, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'yes' }
		]);

		// Zweiter Durchgang, einzeln erfasst: 2 zu 2. Der Entscheid des
		// Verwalters steht noch aus, als die Versammlung schliesst.
		const zweiter = await abstimmen(s.versammlung, s.traktandum, [
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'no' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		]);
		expect(zweiter.auszaehlung?.stichentscheidOffen).toBe(true);
		expect(zweiter.auszaehlung?.stichentscheidArt).toBe('verwalter');

		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind, result_published_at FROM voting_round WHERE id = ${zweiter.durchgang.id}`
		);
		expect(z.supersede_kind).toBe('rueckkommen_erfolglos');
		expect(z.result_published_at).toBeNull();
		const massgebend = (await holeDurchgaenge(betreiber, s.versammlung))
			.filter((d) => d.traktandumId === s.traktandum && !d.ueberholtAm)
			.map((d) => d.id);
		expect(massgebend).toEqual([erst.durchgang.id]);

		// Der überholte Durchgang nimmt keinen Entscheid mehr entgegen: Ein
		// nachträglicher Eintrag setzte das Ergebnis an einem Durchgang fest,
		// der in keinem Protokoll steht (dieselbe Schranke wie in
		// `setzeBeschlussvermerk`).
		await expect(
			haltStichentscheidFest(handelnder(betreiber), s.versammlung, zweiter.durchgang.id, {
				wahl: 'yes',
				wer: 'Verwalterin Beispiel'
			})
		).rejects.toThrow(/überholt/);
		expect(massgebend).toEqual([erst.durchgang.id]);
	});
});
