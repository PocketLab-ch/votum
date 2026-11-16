/**
 * «Zuletzt bearbeitet» — der Weg zurück in die eigene Arbeit.
 *
 * **Warum in der Datenbank geprüft.** Die Abfrage bildet Untergegenstände auf
 * ihr Gefäss ab: Eine geänderte Partei wird zur Eigentümerliste ihrer
 * Gemeinschaft, ein Traktandum zur Traktandenliste seiner Versammlung. Das ist
 * eine Kette aus sechs `LEFT JOIN`; ein falscher davon liefert einen Weg, der
 * ins Leere führt — und auf einer Startseite sieht ein toter Weg aus wie eine
 * Zusage.
 *
 * Geprüft werden deshalb **beide Enden**: dass die Zeile entsteht, und wohin
 * sie zeigt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { erstelleVersammlungstag } from '$lib/server/versammlungstag';
import { holeZuletztBearbeitet } from '$lib/server/zuletzt';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let fremderBetreiber: string;

/** Zwei Konten desselben Betreibers — die Frage lautet «wo war ICH». */
let ICH: string;
let ANDERE: string;
/** Dasselbe Konto beim anderen Betreiber — für die Mandantengrenze. */
let ICH_DRUEBEN: string;

function als(operatorId: string, userId: string) {
	return { operatorId, userId, label: userId === ICH ? 'Ich' : 'Jemand anders' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Zuletzt');
	fremderBetreiber = await pruefbetreiber('Zuletzt fremd');
	ICH = await pruefbenutzer(betreiber, 'zuletzt-ich');
	ANDERE = await pruefbenutzer(betreiber, 'zuletzt-andere');
	ICH_DRUEBEN = await pruefbenutzer(fremderBetreiber, 'zuletzt-drueben');
});

afterAll(verbindungenSchliessen);

describe('Zuletzt bearbeitet', () => {
	it('bildet Untergegenstände auf ihr Gefäss ab und nennt einen gangbaren Weg', async () => {
		const g = await erstelleGemeinschaft(als(betreiber, ICH), {
			name: 'Zuletzt Probehalde',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await erstelleEinheit(als(betreiber, ICH), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		await erstelleEigentuemer(als(betreiber, ICH), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		const v = await erstelleVersammlung(als(betreiber, ICH), {
			stwegId: g.id,
			datum: '2026-05-20',
			uhrzeit: '19:00',
			ort: 'Gemeindesaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await erstelleTraktandum(als(betreiber, ICH), {
			meetingId: v.id,
			parentId: null,
			titel: 'Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});

		const zeilen = await holeZuletztBearbeitet(betreiber, ICH, 10);

		// Die Versammlung steht mit dem Weg zu IHREN Traktanden da — nicht mit
		// einer Seite je Traktandum, die es gar nicht gibt.
		const versammlung = zeilen.find((z) => z.art === 'versammlung');
		expect(versammlung).toBeDefined();
		expect(versammlung!.pfad).toBe(`/versammlungen/${v.id}/traktanden`);
		expect(versammlung!.name).toBe('Zuletzt Probehalde');

		// Die Gemeinschaft steht EINMAL da — mit dem jüngsten Handgriff, nicht
		// dreimal für Gemeinschaft, Einheit und Eigentümer.
		const gemeinschaften = zeilen.filter((z) => z.art === 'gemeinschaft');
		expect(gemeinschaften).toHaveLength(1);
		expect(gemeinschaften[0].pfad).toBe(`/gemeinschaften/${g.id}/eigentuemer`);
		expect(gemeinschaften[0].woran).toBe('Eigentümer angelegt');
	});

	it('führt den gemeinsamen Abend mit seinem eigenen Weg', async () => {
		const tag = await erstelleVersammlungstag(als(betreiber, ICH), {
			bezeichnung: 'Zuletzt Abend',
			datum: '2026-06-02',
			uhrzeit: '18:00',
			ort: 'Saal',
			art: 'ordentlich',
			betriebsart: 'einfach'
		});
		const zeilen = await holeZuletztBearbeitet(betreiber, ICH, 10);
		const abend = zeilen.find((z) => z.art === 'abend');
		expect(abend).toBeDefined();
		expect(abend!.pfad).toBe(`/tage/${tag.id}`);
		expect(abend!.name).toBe('Zuletzt Abend');
	});

	it('zeigt die Arbeit anderer Konten nicht', async () => {
		await erstelleGemeinschaft(als(betreiber, ANDERE), {
			name: 'Fremde Arbeit',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const meine = await holeZuletztBearbeitet(betreiber, ICH, 20);
		expect(meine.map((z) => z.name)).not.toContain('Fremde Arbeit');

		// Gegenprobe: Für das andere Konto steht sie da. Sonst hiesse «nicht
		// enthalten» womöglich nur «die Abfrage findet gar nichts».
		const fremde = await holeZuletztBearbeitet(betreiber, ANDERE, 20);
		expect(fremde.map((z) => z.name)).toContain('Fremde Arbeit');
	});

	it('endet an der Mandantengrenze', async () => {
		await erstelleGemeinschaft(als(fremderBetreiber, ICH_DRUEBEN), {
			name: 'Anderer Betreiber',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		// Anderer Betreiber: Der Eintrag darf nicht herüberreichen.
		const meine = await holeZuletztBearbeitet(betreiber, ICH, 50);
		expect(meine.map((z) => z.name)).not.toContain('Anderer Betreiber');

		const drueben = await holeZuletztBearbeitet(fremderBetreiber, ICH_DRUEBEN, 50);
		expect(drueben.map((z) => z.name)).toContain('Anderer Betreiber');
	});

	it('hält die Grenze ein und gibt die jüngsten zuerst', async () => {
		const zeilen = await holeZuletztBearbeitet(betreiber, ICH, 2);
		expect(zeilen).toHaveLength(2);
		expect(zeilen[0].wann.getTime()).toBeGreaterThanOrEqual(zeilen[1].wann.getTime());
	});
});
