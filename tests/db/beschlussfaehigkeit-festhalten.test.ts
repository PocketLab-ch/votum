/**
 * Die Feststellung der Beschlussfähigkeit festhalten (ZGB Art. 712p,
 * Migration 080).
 *
 * **Die Kette, auf die es ankommt:** in der Sitzung festgestellt → als Befund
 * mit Zeitpunkt und Zahlen gespeichert → im Protokoll ausgewiesen, auch wenn
 * nachher jemand geht. Reisst sie an der letzten Stelle, ändert sich das
 * Protokoll rückwirkend mit jedem, der den Saal verlässt — genau der Zustand
 * vor dem 24.08.2026.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	bestaetigeAnwesenheit,
	erfasseVerlassenDerVersammlung,
	holeUebersicht
} from '$lib/server/anwesenheit';
import {
	halteBeschlussfaehigkeitFest,
	holeFeststellungen
} from '$lib/server/beschlussfaehigkeit';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Vier Eigentümer zu je 250 Wertquoten. Freigegeben, aber noch nicht eröffnet. */
async function vorbereitet(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Duss'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 250 },
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
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	return { gemeinschaft: g.id, versammlung: v.id, parteien };
}

/** Der Protokollentwurf als Text — was am Ende im Protokoll steht. */
async function entwurf(versammlung: string): Promise<string> {
	return stelleEntwurfZusammen(betreiber, versammlung, '2027-06-30', 'Prüflauf');
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Feststellung');
	benutzer = await pruefbenutzer(betreiber, 'feststellungsleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Feststellung der Beschlussfähigkeit', () => {
	it('hält Zahlen, Zeitpunkt und die feststellende Person fest', async () => {
		const s = await vorbereitet('Feststellung 1', '2027-06-01');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
		for (const p of s.parteien.slice(0, 3)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, p, 'von_hand');
		}

		const f = await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);

		expect(f.beschlussfaehig).toBe(true);
		expect(f.kopfstimmenAnwesend).toBe(3);
		expect(f.kopfstimmenGesamt).toBe(4);
		expect(f.quotenAnwesend).toBe(750);
		expect(f.gesamtquote).toBe(1000);
		expect(f.durch).toBe('Prüflauf');
		expect(f.grundlage).toBe('gesetz');
		expect(f.fehlt).toBeNull();
		// Als Zahl, nicht als Zeichenkette: `numeric` kommt aus Postgres als Text,
		// und «750» > «1000» wäre als Zeichenkettenvergleich wahr.
		expect(typeof f.quotenAnwesend).toBe('number');
	});

	it('bleibt stehen, wenn danach jemand geht', async () => {
		/*
		 * **Der Prüfstein.** Genau das ging vorher verloren: Das Protokoll rechnete
		 * die Beschlussfähigkeit beim Erzeugen neu, und wer den Saal verliess,
		 * veränderte damit rückwirkend die Feststellung von zu Beginn.
		 */
		const s = await vorbereitet('Feststellung 2', '2027-06-02');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
		for (const p of s.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, p, 'von_hand');
		}
		await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);

		// Zwei gehen — die Versammlung wäre jetzt nicht mehr beschlussfähig.
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[0]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[1]);

		const text = await entwurf(s.versammlung);
		// Die Zahlen der Feststellung, nicht die des Moments: Zwei sind gegangen,
		// im Protokoll stehen trotzdem vier.
		expect(text).toMatch(/4 von 4 Kopfstimmen/);
		expect(text).toMatch(/Festgestellt um \d{2}:\d{2} Uhr durch Prüflauf/);
		expect(text).toMatch(/Die Versammlung ist beschlussfähig \(ZGB 712p\)/);
	});

	it('sagt im Protokoll, wenn nichts festgestellt wurde', async () => {
		// Ohne diesen Satz läse sich die Rechnung aus dem Moment der
		// Protokollerstellung wie eine Feststellung zu Beginn.
		const s = await vorbereitet('Feststellung 3', '2027-06-03');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.parteien[0], 'von_hand');

		const text = await entwurf(s.versammlung);
		expect(text).toMatch(/Stand bei Erstellung des Protokolls/);
		expect(text).not.toMatch(/Festgestellt um/);
	});

	it('lässt sich mehrfach festhalten und zeigt die weiteren im Protokoll', async () => {
		const s = await vorbereitet('Feststellung 4', '2027-06-04');
		await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
		for (const p of s.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, p, 'von_hand');
		}
		await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);

		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[0]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[1]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[2]);
		const zweite = await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);

		expect(zweite.beschlussfaehig).toBe(false);
		expect(zweite.fehlt).toBeTruthy();

		const alle = await holeFeststellungen(betreiber, s.versammlung);
		expect(alle).toHaveLength(2);
		// Älteste zuerst — daran hängt, welche im Protokollkopf steht.
		expect(alle[0].kopfstimmenAnwesend).toBe(4);
		expect(alle[1].kopfstimmenAnwesend).toBe(1);

		const text = await entwurf(s.versammlung);
		// Die erste im Kopf — seit dem 26.08.2026 mit der Zahl zuerst, auf der
		// Art. 712p beruht. Die Kopfstimmen stehen daneben; die Mehrheit rechnet
		// auf ihnen. Hier fallen beide zusammen: «je Eigentümer», vier Parteien
		// mit je einer Wohnung.
		expect(text).toMatch(
			/Anwesend und vertreten sind 4 von 4 Stockwerkeigentümern, dazu 4 von 4 Kopfstimmen/
		);
		// … die zweite im Ablauf, mit ihren eigenen Zahlen.
		expect(text).toMatch(/Erneut festgestellt um \d{2}:\d{2} Uhr durch Prüflauf: 1 von 4 Kopfstimmen/);
		expect(text).toMatch(/nicht beschlussfähig/);
	});

	it('geht erst ab der Eröffnung', async () => {
		// Vorher gibt es keine Versammlung, deren Beschlussfähigkeit festzustellen
		// wäre — nur einen Saal, der sich füllt.
		const s = await vorbereitet('Feststellung 5', '2027-06-05');
		await expect(
			halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung)
		).rejects.toThrow(FachlicherFehler);
		expect(await holeFeststellungen(betreiber, s.versammlung)).toHaveLength(0);
	});

	it('weist eine Reglementsfeststellung ohne Fundstelle ab', async () => {
		/*
		 * **Der Prüfstein für den CHECK selbst.** Ein CHECK, den nie ein Test
		 * verletzt, ist eine Behauptung: `basis = 'reglement' AND length(...) > 0`
		 * liesse eine Zeile mit `reference IS NULL` durch, weil NULL in einem CHECK
		 * als erfüllt gilt. Geprüft wird direkt an der Datenbank — über die
		 * Anwendung ist der Fall nicht herstellbar, und genau deshalb steht die
		 * Schranke dort.
		 */
		const s = await vorbereitet('Feststellung 6', '2027-06-06');
		await expect(
			admin`
				INSERT INTO quorum_finding
					(operator_id, meeting_id, recorded_by, head_present, head_total,
					 quota_present, quota_total, is_quorate, basis, reference)
				VALUES (${betreiber}, ${s.versammlung}, 'Prüflauf', 3, 4, 750, 1000, true, 'reglement', NULL)
			`
		).rejects.toThrow(/quorum_finding_fundstelle/);
	});

	it('weist «nicht beschlussfähig» ohne Fehlgrund ab', async () => {
		const s = await vorbereitet('Feststellung 7', '2027-06-07');
		await expect(
			admin`
				INSERT INTO quorum_finding
					(operator_id, meeting_id, recorded_by, head_present, head_total,
					 quota_present, quota_total, is_quorate, basis, shortfall)
				VALUES (${betreiber}, ${s.versammlung}, 'Prüflauf', 1, 4, 250, 1000, false, 'gesetz', NULL)
			`
		).rejects.toThrow(/quorum_finding_fehlgrund/);
	});
});

/**
 * ZGB Art. 712p zählt Stockwerkeigentümer — am durchgehenden Weg.
 *
 * **Warum dieser Fall in die Datenbank gehört und nicht nur in den Kern.** Die
 * reine Funktion lässt sich mit jeder Zahl füttern; ob die Zahl aus der
 * Anwesenheit auch wirklich Personen zählt, sagt nur der ganze Weg — Einheiten
 * erfassen, zuordnen, freigeben, einlassen, feststellen.
 *
 * **Der Fall.** «Je Einheit», wie in 49 von 94 Gemeinschaften auf Dev. Aebi
 * hält zwei Wohnungen, Bucher eine. Kopfstimmen 3, Stockwerkeigentümer 2. Nur
 * Aebi erscheint.
 *
 * Bis zum 26.08.2026 galt die Versammlung damit als beschlussfähig: Aebi brachte
 * zwei Kopfstimmen mit und erfüllte das «mindestens aber zwei» allein. Art. 712p
 * Abs. 1 verlangt aber zwei **Stockwerkeigentümer** — zwei Menschen, die
 * anwesend oder vertreten sind. Der Fehler wirkte in die nachgiebige Richtung.
 */
async function mehrfachbesitz(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_unit',
		headCountRuleSource: 'Reglement Ziff. 14.2',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const partei = async (wer: string) =>
		(
			await erstelleEigentuemer(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'natural',
				displayName: wer,
				isCommunity: false,
				representativeName: null
			})
		).id;

	const wohnung = async (label: string, quote: number) =>
		(
			await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label,
				quotas: { stamm: quote },
				countsAsHead: true
			})
		).id;

	const aebi = await partei('Aebi');
	const bucher = await partei('Bucher');
	await ordneEigentumZu(handelnder(betreiber), await wohnung('Whg 1', 400), aebi, '2020-01-01');
	await ordneEigentumZu(handelnder(betreiber), await wohnung('Whg 2', 300), aebi, '2020-01-01');
	await ordneEigentumZu(handelnder(betreiber), await wohnung('Whg 3', 300), bucher, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	return { versammlung: v.id, aebi, bucher };
}

describe('712p bei der Zählweise «je Einheit»', () => {
	it('ist mit einem einzigen Anwesenden nicht beschlussfähig, auch mit zwei Kopfstimmen', async () => {
		const s = await mehrfachbesitz('Mehrfachbesitz 1', '2027-07-01');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.aebi, 'von_hand');

		const f = await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);

		// Die Zahlen, die den Fall ausmachen: zwei Stimmen in einer Hand.
		expect(f.kopfstimmenAnwesend).toBe(2);
		expect(f.kopfstimmenGesamt).toBe(3);
		expect(f.eigentuemerAnwesend).toBe(1);
		expect(f.eigentuemerGesamt).toBe(2);

		expect(f.beschlussfaehig).toBe(false);
		expect(f.fehlt).toContain('Stockwerkeigentümer');
		// Die Wertquote allein hätte gereicht — 700 von 1000. Es fehlt der Mensch.
		expect(f.quotenAnwesend).toBe(700);
	});

	it('ist beschlussfähig, sobald der zweite Eigentümer da ist', async () => {
		const s = await mehrfachbesitz('Mehrfachbesitz 2', '2027-07-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.aebi, 'von_hand');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.bucher, 'von_hand');

		const f = await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);
		expect(f.beschlussfaehig).toBe(true);
		expect(f.eigentuemerAnwesend).toBe(2);
		expect(f.eigentuemerGesamt).toBe(2);
	});

	/**
	 * **Die Leinwand zeigt die tragende Zahl schon — als «Parteien».**
	 *
	 * Aus dem Code-Review kam der Verdacht, der Beamer weise die Grundlage von
	 * 712p nicht aus. Er tut es: `freigabe.ts` nimmt Parteien ohne Einheit gar
	 * nicht in die Momentaufnahme auf, also fallen `anzahl…` und `eigentuemer…`
	 * dort zusammen.
	 *
	 * Das ist eine Eigenschaft von zwei Dateien, die einander nicht kennen —
	 * deshalb steht sie hier als Test und nicht als Kommentar. Fällt der Filter
	 * in `freigabe.ts` weg, zeigte die Leinwand plötzlich eine andere Zahl als
	 * die, nach der sie urteilt.
	 */
	it('zeigt auf der Leinwand dieselbe Zahl, nach der geurteilt wird', async () => {
		const s = await mehrfachbesitz('Mehrfachbesitz 4', '2027-07-04');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.aebi, 'von_hand');

		const u = await holeUebersicht(betreiber, s.versammlung);
		expect(u).not.toBeNull();
		expect(u!.eigentuemerGesamt).toBe(u!.anzahlGesamt);
		expect(u!.eigentuemerAnwesend).toBe(u!.anzahlAnwesend);
		// Und sie ist nicht dieselbe wie die Kopfstimmen — sonst prüfte der Test nichts.
		expect(u!.kopfstimmenGesamt).not.toBe(u!.eigentuemerGesamt);
	});

	it('schreibt die Personen in die Datenbank, nicht nur in die Anzeige', async () => {
		const s = await mehrfachbesitz('Mehrfachbesitz 3', '2027-07-03');
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.aebi, 'von_hand');
		await halteBeschlussfaehigkeitFest(handelnder(betreiber), s.versammlung);

		// Ueber den Leseweg, nicht ueber den Rueckgabewert des Schreibens: Nur so
		// ist belegt, dass die Spalten wirklich gefuellt sind.
		const [gelesen] = await holeFeststellungen(betreiber, s.versammlung);
		expect(gelesen.eigentuemerAnwesend).toBe(1);
		expect(gelesen.eigentuemerGesamt).toBe(2);
		expect(typeof gelesen.eigentuemerGesamt).toBe('number');
	});
});
