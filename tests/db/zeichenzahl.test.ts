/**
 * Die andere Hälfte der Annahme: Was Postgres unter «Zeichen» versteht.
 *
 * **Warum an der laufenden Datenbank.** Der Umbau vom 26.08.2026 stellt jede
 * Eingabeschranke auf `zeichenzahl()` um, damit die Anwendung dasselbe zählt wie
 * `CHECK (length(btrim(spalte)) >= 2)`. Das ist eine Behauptung über Postgres —
 * und eine Behauptung über eine fremde Rechenweise gehört gemessen, nicht
 * angenommen. Der Kern kann sie nicht prüfen: Er kennt keine Datenbank (AD-1).
 *
 * Geprüft werden beide Enden: dass die Schranke wirklich Zeichen zählt, und
 * dass die Anwendung davor greift — mit einem Satz statt einer rohen 500.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

/** Ein Zeichen ausserhalb der Grundebene: in JavaScript zwei Einheiten. */
const BILDZEICHEN = '😀';

let betreiber: string;
let benutzer: string;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Zeichenzahl');
	benutzer = await pruefbenutzer(betreiber, 'zeichenzahl');
});

afterAll(verbindungenSchliessen);

describe('length() in Postgres', () => {
	it('zählt ein Bildzeichen als ein Zeichen, JavaScript als zwei', async () => {
		const [z] = await admin<{ zeichen: number; oktette: number }[]>`
			SELECT length(btrim(${BILDZEICHEN})) AS zeichen,
			       octet_length(${BILDZEICHEN}) AS oktette
		`;
		expect(z.zeichen).toBe(1);
		expect(BILDZEICHEN.length).toBe(2);
		// Nebenbei festgehalten, damit niemand «Zeichen» mit «Bytes» verwechselt.
		expect(z.oktette).toBe(4);
	});

	it('lässt btrim einen bereits beschnittenen Wert unverändert', async () => {
		/*
		 * JavaScript `.trim()` streift mehr als `btrim()` — Tabulator und
		 * geschütztes Leerzeichen etwa. Weil die Anwendung den beschnittenen Wert
		 * speichert, sieht Postgres nichts mehr zum Streichen: Beide zählen
		 * danach dasselbe.
		 */
		const roh = `\t ${BILDZEICHEN} `;
		const beschnitten = roh.trim();
		const [z] = await admin<{ zeichen: number }[]>`
			SELECT length(btrim(${beschnitten})) AS zeichen
		`;
		expect(z.zeichen).toBe([...beschnitten].length);
	});
});

describe('die Schranke der Gemeinschaft', () => {
	it('weist ein einzelnes Bildzeichen mit einem Satz ab, nicht mit einer 500', async () => {
		await expect(
			erstelleGemeinschaft(
				{ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' },
				{
					name: BILDZEICHEN,
					quotaDenominator: 1000,
					headCountMode: 'per_owner',
					parkingCountsAsHead: false,
					parentStwegId: null
				}
			)
		).rejects.toThrow(FachlicherFehler);
	});

	it('hält denselben Wert auch in der Datenbank auf', async () => {
		/*
		 * Die Gegenprobe zur Zusicherung oben: Ohne den Satz im Kern **müsste**
		 * dieser Wert an der Schranke scheitern. Bliebe die Schranke aus, wäre
		 * die Prüfung im Kern die einzige — und dieser Test grün, ohne dass er
		 * noch etwas beweist.
		 *
		 * **Über die Rolle der Anwendung, nicht über die privilegierte**
		 * (`imKontext`, nicht `admin`): `helfer.ts` sagt es ausdrücklich — die
		 * privilegierte Verbindung ist zum Anlegen von Prüfdaten da, nie zum
		 * Prüfen einer Regel. Sonst bewiese der Fall nur, dass *irgendeine*
		 * Verbindung die Schranke trifft.
		 */
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO stweg (operator_id, name, quota_denominator)
					VALUES (${betreiber}, ${BILDZEICHEN}, 1000)
				`
			)
		).rejects.toThrow(/stweg_name_nicht_leer/);
	});

	it('nimmt zwei Bildzeichen an — die Regel trifft die Länge, nicht die Zeichenart', async () => {
		const g = await erstelleGemeinschaft(
			{ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' },
			{
				name: BILDZEICHEN + BILDZEICHEN,
				quotaDenominator: 1000,
				headCountMode: 'per_owner',
				parkingCountsAsHead: false,
				parentStwegId: null
			}
		);
		expect(g.name).toBe(BILDZEICHEN + BILDZEICHEN);
	});
});
