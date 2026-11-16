/**
 * Das Zeitbudget des Sammellaufs über die Traktandenprüfung.
 *
 * Die Regel entstand am 02.09.2026 aus einem Befund, der dreimal gemeldet
 * wurde und dessen Begründung nicht stimmte: Die Frist sei zu hoch für «die
 * üblichen 60 s» eines Reverse Proxy. Nachgemessen gibt es diese Grenze für
 * diesen Dienst nirgends (Betrieb ohne Proxy, Entwicklung mit 3600 s). Der
 * echte Fehler lag daneben — die Frist hielt nicht, was ihr Name sagt.
 */
import { describe, expect, it } from 'vitest';
import { reichtDieZeit } from '$lib/domain/ki';

const BUDGET = 100_000;
/** Was ein Aufruf in der Kette vom 02.09.2026 im schlechtesten Fall braucht. */
const LANGSAM = 24_000;

describe('Das Zeitbudget des Sammellaufs', () => {
	it('lässt weiterlaufen, solange ein weiterer Aufruf hineinpasst', () => {
		expect(
			reichtDieZeit({
				verstrichenMs: 70_000,
				reserveMs: LANGSAM,
				budgetMs: BUDGET,
				schonGeprueft: 3
			})
		).toBe(true);
	});

	it('bricht ab, sobald der nächste Aufruf über das Budget hinausragen würde', () => {
		/*
		 * Der Kern des Befundes: 80 s verstrichen, 20 s Rest, aber der bisher
		 * längste Aufruf brauchte 24 s. Die alte Fassung (`verstrichen > budget`)
		 * liess hier weiterlaufen und endete bei 104 s.
		 */
		expect(
			reichtDieZeit({
				verstrichenMs: 80_000,
				reserveMs: LANGSAM,
				budgetMs: BUDGET,
				schonGeprueft: 3
			})
		).toBe(false);
	});

	it('lässt genau aufgehen, was genau aufgeht', () => {
		expect(
			reichtDieZeit({
				verstrichenMs: BUDGET - LANGSAM,
				reserveMs: LANGSAM,
				budgetMs: BUDGET,
				schonGeprueft: 1
			})
		).toBe(true);
		expect(
			reichtDieZeit({
				verstrichenMs: BUDGET - LANGSAM + 1,
				reserveMs: LANGSAM,
				budgetMs: BUDGET,
				schonGeprueft: 1
			})
		).toBe(false);
	});

	/*
	 * **Die Reserve ist die gemessene Dauer, nicht die zulässige Höchstgeduld**
	 * (Code-Review 02.09.2026). Die erste Fassung rechnete mit der konfigurierten
	 * Kette. Bei zwei Stufen à 60 s — erlaubt sind bis 120 s je Stufe — wären das
	 * 120 s Reserve gegen 100 s Budget gewesen: Ab dem zweiten Punkt hätte der
	 * Lauf immer abgebrochen, auch bei einem Modell, das in zwei Sekunden
	 * antwortet. Eine Liste mit zwanzig Traktanden wäre nie durchgelaufen, und
	 * jeder Klick hätte Traktandum 1 erneut geprüft und bezahlt.
	 */
	it('läuft bei einem schnellen Modell durch die ganze Liste', () => {
		const dauerMs = 2_000;
		let verstrichen = 0;
		let geprueft = 0;
		while (
			geprueft < 20 &&
			reichtDieZeit({
				verstrichenMs: verstrichen,
				reserveMs: geprueft === 0 ? 0 : dauerMs,
				budgetMs: BUDGET,
				schonGeprueft: geprueft
			})
		) {
			verstrichen += dauerMs;
			geprueft++;
		}
		expect(geprueft).toBe(20);
		expect(verstrichen).toBe(40_000);
	});

	it('schafft bei einem langsamen Modell so viele, wie hineinpassen', () => {
		let verstrichen = 0;
		let geprueft = 0;
		while (
			geprueft < 20 &&
			reichtDieZeit({
				verstrichenMs: verstrichen,
				reserveMs: geprueft === 0 ? 0 : LANGSAM,
				budgetMs: BUDGET,
				schonGeprueft: geprueft
			})
		) {
			verstrichen += LANGSAM;
			geprueft++;
		}
		// Vier Durchgänge à 24 s: der fünfte würde bei 96 s starten und bis 120 s
		// laufen. Der Lauf endet damit unter dem Budget statt darüber.
		expect(geprueft).toBe(4);
		expect(verstrichen).toBeLessThanOrEqual(BUDGET);
	});

	it('lässt den ersten Aufruf immer laufen, auch ohne jede Messung', () => {
		/*
		 * Ohne einen ersten Aufruf gibt es keine Dauer, und ohne Dauer keine
		 * Reserve. Ein Sammellauf, der deshalb gar nicht erst anfängt, meldete
		 * «0 geprüft» — ein Knopf, der nichts tut und nicht sagt, warum.
		 */
		expect(
			reichtDieZeit({ verstrichenMs: 0, reserveMs: 0, budgetMs: BUDGET, schonGeprueft: 0 })
		).toBe(true);
	});
});
