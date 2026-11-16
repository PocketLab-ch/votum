/**
 * Die Spur der Codeeingaben auf den öffentlichen Wegen (Audit B-05).
 *
 * **Drei Zusagen, und die dritte kam erst aus der Abnahme.**
 *
 *   1. Ein falscher Code hinterlässt eine Spur. Das ist der Punkt.
 *   2. Ein *richtiger* Code hinterlässt keine. Das ist die Bedingung dafür, dass
 *      die Spur etwas wert bleibt: Im Saal wird jeder Code einmal eingegeben,
 *      und eine Zahl, in der die vierzehn gültigen Eingaben mitlaufen, sagt
 *      nichts mehr. Der häufigste harmlose Fall ist «belegt» — ein zweites Gerät
 *      mit derselben Karte. Der Code stimmte.
 *   3. **Die Spur wächst nicht mit den Versuchen.** `/z/<code>` und `/p/<code>`
 *      sind unangemeldete Aufrufe. Die erste Fassung schrieb je Versuch eine
 *      Zeile — gemessen 700 Anfragen je Sekunde von einem einzigen Rechner, rund
 *      6 GB am Tag. Auf einem Notebook im Versammlungsraum ist eine volle Platte
 *      das Ende der Versammlung.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	loeseAnzeigecodeAuf
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { loeseCodeEin } from '$lib/server/zugangssitzung';
import { haltCodeversuchFest, holeCodeversuche } from '$lib/server/codeversuche';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/**
 * Der Stand vor dem Prüfschritt — es wird die **Zunahme** geprüft, nicht der
 * Absolutwert.
 *
 * Die erste Fassung räumte statt dessen die Tabelle leer. Das ging gut, solange
 * `vitest.config.db.ts` `fileParallelism: false` setzt — aber andere Prüfstände
 * lösen über `loeseCodeEin`/`loeseAnzeigecodeAuf` selbst Zählungen aus, und ein
 * Lauf mit `--fileParallelism` hätte die Behauptungen still flatterhaft gemacht
 * (Abnahme 08.08.2026). Eine Zunahme ist gegen Nachbarn unempfindlich.
 */
async function stand(): Promise<{ zugang: number; anzeige: number }> {
	const l = await holeCodeversuche();
	return { zugang: l.vergeblichZugang, anzeige: l.vergeblichAnzeige };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Codeversuche');
	benutzer = await pruefbenutzer(betreiber, 'pruefer');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Was eine Spur hinterlässt', () => {
	it('zählt einen unbrauchbaren Zugangscode', async () => {
		const vorher = await stand();
		await loeseCodeEin('XXXXXXXXXXXXXXXXXXXX');
		expect((await stand()).zugang).toBe(vorher.zugang + 1);
	});

	it('zählt auch eine Eingabe, die schon an der Form scheitert', async () => {
		// Wer die Länge nicht trifft, probiert genauso — nur ungeschickter.
		const vorher = await stand();
		await loeseCodeEin('zu-kurz');
		expect((await stand()).zugang).toBe(vorher.zugang + 1);
	});

	it('hält den Anzeigecode getrennt', async () => {
		const vorher = await stand();
		await loeseAnzeigecodeAuf('XXXXXXXXXXXX');
		const nachher = await stand();
		expect(nachher.anzeige).toBe(vorher.anzeige + 1);
		expect(nachher.zugang).toBe(vorher.zugang);
	});

	it('schreibt den Code nirgends mit — auch nicht als Prüfwert', async () => {
		/*
		 * Eine Liste von Prüfwerten versuchter Codes wäre eine Liste, gegen die
		 * sich vergleichen lässt. Für die Frage «hat es jemand versucht» braucht
		 * es sie nicht. Die Tabelle hat gar keine Spalte dafür — geprüft wird das
		 * hier am Aufbau, nicht am Inhalt, damit auch eine künftige Spalte auffällt.
		 */
		const spalten = await admin<{ column_name: string }[]>`
			SELECT column_name FROM information_schema.columns
			WHERE table_name = 'code_attempt'
		`;
		expect(spalten.map((s) => s.column_name).sort()).toEqual([
			'count',
			'hour',
			'kind',
			'succeeded'
		]);
	});
});

describe('Was die Spur nicht wachsen lässt', () => {
	it('hält hundert Versuche in einer einzigen Zeile', async () => {
		/*
		 * **Der Befund aus der Abnahme in einem Prüfstand.** Vorher wären das
		 * hundert Zeilen gewesen, von aussen und ohne Anmeldung auslösbar, in
		 * einer Tabelle ohne Aufräumen. Jetzt ist es ein Zähler: je Art, Stunde
		 * und Ausgang eine Zeile — höchstens vier je Stunde.
		 */
		const [{ anzahl: vorher }] = await admin<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM code_attempt
		`;
		const standVorher = await stand();

		for (let i = 0; i < 100; i++) await loeseCodeEin('XXXXXXXXXXXXXXXXXXXX');

		const [{ anzahl: nachher }] = await admin<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM code_attempt
		`;
		expect(nachher).toBe(vorher);
		// Gezählt wurde trotzdem alles.
		expect((await stand()).zugang).toBe(standVorher.zugang + 100);
	});

	it('lässt den Zähler nicht zurückdrehen', async () => {
		// Die Anwendung braucht `UPDATE`, weil sie hochzählt. Damit könnte ein
		// Fehler im Anwendungscode einen Stand auch zurücksetzen — und die Spur
		// mitnehmen.
		await loeseCodeEin('XXXXXXXXXXXXXXXXXXXX');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE code_attempt SET count = 0`)
		).rejects.toThrow(/nur aufwärts/i);
	});

	it('verliert unter Gleichzeitigkeit keinen Versuch', async () => {
		/*
		 * Nachtrag aus dem Sicherheitsdurchgang vom 09.10.2026 (Befund V3):
		 * Die Zählung war nur sequenziell gemessen. Im Saal kommen vierzehn
		 * Geräte gleichzeitig, und der Zählerweg ist ein `ON CONFLICT DO
		 * UPDATE` (Migration 056) — ein Fehler dort, der unter Gleichzeitigkeit
		 * Versuche verliert, bliebe unbemerkt, und zwar ausgerechnet in der
		 * Spur, deren Wert darin liegt, dass sie vollständig ist. Das Zählen
		 * des eigenen Fehlers (`haltCodeversuchFest` schluckt ihn bewusst)
		 * macht den Verlust hier sichtbar statt still.
		 */
		const vorher = await stand();
		const gleichzeitig = 50;
		await Promise.all(
			Array.from({ length: gleichzeitig }, () => haltCodeversuchFest('zugangscode', false))
		);
		expect((await stand()).zugang).toBe(vorher.zugang + gleichzeitig);
	});

	it('lässt die Anwendung den Zähler nicht löschen', async () => {
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM code_attempt`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

describe('Was keine Spur hinterlässt', () => {
	let lauf = 0;

	async function mitZugang(): Promise<string> {
		lauf += 1;
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: `Codeweg ${lauf}`,
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
			datum: '2026-09-09',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		await eroeffneVersammlung(handelnder(betreiber), v.id);
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), v.id);
		return zugang.code;
	}

	it('zählt eine gültige Eingabe als gelungen, nicht als vergeblich', async () => {
		const code = await mitZugang();
		const vorher = await stand();
		const ein = await loeseCodeEin(code, 'Prüflauf');
		expect(ein.gelungen).toBe(true);
		expect((await stand()).zugang).toBe(vorher.zugang);
	});

	it('zählt «belegt» nicht als vergeblichen Versuch', async () => {
		/*
		 * **Der Fall, an dem eine schlichte Zählung gescheitert wäre.** Ein zweites
		 * Gerät mit derselben Karte ist der häufigste harmlose Fall im Saal — der
		 * Code stimmte, abgewiesen wurde das Gerät.
		 */
		const code = await mitZugang();
		await loeseCodeEin(code, 'Erstes Gerät');
		const vorher = await stand();
		const zweites = await loeseCodeEin(code, 'Zweites Gerät');
		expect(zweites.ausgang).toBe('belegt');
		expect((await stand()).zugang).toBe(vorher.zugang);
	});
});
