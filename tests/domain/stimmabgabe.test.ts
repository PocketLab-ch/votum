import { describe, expect, it } from 'vitest';
import {
	MISCHFORM_ERKLAERUNG,
	istMischform,
	nichtGefragte,
	stimmabgabeabschnitt
} from '$lib/domain/stimmabgabe';

/**
 * Was das Protokoll über die Mischform sagt.
 *
 * **Die Grenzen sind hier die Sache**, nicht der Wortlaut: Der Abschnitt darf
 * nur dastehen, wenn wirklich zwei Wege nebeneinander gelaufen sind. Ein
 * Abschnitt zu viel behauptet eine Mischform, die es nicht gab; einer zu wenig
 * lässt offen, warum die Sitzungsleitung Stimmen übertragen hat.
 */
describe('istMischform', () => {
	it('ist wahr, wenn ein Teil auf Papier stimmte', () => {
		expect(istMischform(3, 14)).toBe(true);
		expect(istMischform(1, 2)).toBe(true);
	});

	it('ist falsch ohne eine einzige Papierpartei', () => {
		expect(istMischform(0, 14)).toBe(false);
	});

	it('rechnet gegen die Eingelassenen, nicht gegen alle Parteien', () => {
		/*
		 * **Der Befund vom 10.09.2026.** Ein Papiervermerk entsteht nur am Eingang;
		 * wer nicht erschien, kann nie im Zähler stehen. Gegen alle vierzehn
		 * Parteien gerechnet wäre eine Versammlung mit fünf Anwesenden, die alle
		 * von Hand abstimmten, eine «Mischform» gewesen.
		 */
		expect(istMischform(5, 5)).toBe(false);
	});

	it('ist falsch, wenn ALLE auf Papier stimmten', () => {
		/*
		 * **Vorgabe des Auftraggebers, 09.09.2026**: «Wenn alle von Hand abstimmen, braucht es
		 * nach mir keinen Protokolleintrag. Nur bei der Mischform.» Dann ist es
		 * eine Handabstimmung und keine Mischform.
		 */
		expect(istMischform(14, 14)).toBe(false);
	});

	it('ist falsch, wenn die Versammlung gar keine Parteien führt', () => {
		// `0 > 0` ist falsch, und das ist die richtige Antwort: Ohne Parteien gibt
		// es nichts zu erklären. Die Probe steht hier, damit eine spätere Fassung
		// mit `>=` auffällt.
		expect(istMischform(0, 0)).toBe(false);
	});

	it('ist falsch, wenn mehr Vermerke als Parteien gezählt werden', () => {
		/*
		 * Kommen kann das nur aus einer verrutschten Rechnung, nicht aus den Daten
		 * (`paper_ballot` hat einen eindeutigen Schlüssel je Momentaufnahme-Partei).
		 * Die Funktion soll dann schweigen statt eine Mischform zu behaupten.
		 */
		expect(istMischform(15, 14)).toBe(false);
	});
});

describe('stimmabgabeabschnitt', () => {
	it('nennt die Parteien mit Namen und Zahl', () => {
		const z = stimmabgabeabschnitt(['Aebi', 'Bucher', 'Christen'], 14);
		const text = z.join('\n');
		expect(text).toContain('## Stimmabgabe');
		expect(text).toContain('Auf Papier abgestimmt haben (3):');
		expect(text).toContain('- Aebi');
		expect(text).toContain('- Bucher');
		expect(text).toContain('- Christen');
	});

	it('sagt, warum bei den Traktanden kein Grund steht', () => {
		/*
		 * **Der Kern des Abschnitts.** Eine stellvertretend erfasste Stimme ohne
		 * Grund taucht im Protokoll nirgends auf; ohne diesen Satz stünde also
		 * nirgends, dass ein Teil der Stimmen übertragen wurde.
		 */
		const text = stimmabgabeabschnitt(['Aebi'], 14).join('\n');
		expect(text).toContain('Sitzungsleitung übertragen');
		expect(text).toContain('Vermerk am Eingang');
	});

	it('liefert nichts, wo es keine Mischform gibt', () => {
		expect(stimmabgabeabschnitt([], 14)).toEqual([]);
		expect(stimmabgabeabschnitt(['Aebi', 'Bucher'], 2)).toEqual([]);
	});

	it('hält die Sätze unter der Grenze des Textwächters', () => {
		/*
		 * 180 Zeichen, dieselbe Schwelle wie `scripts/check-texte.mjs`. Der Wächter
		 * liest die Zeichenketten im Quelltext; dieser Test hält die Regel dort
		 * fest, wo der Wortlaut steht, damit eine Erweiterung nicht erst im
		 * Prüflauf auffällt.
		 */
		for (const satz of MISCHFORM_ERKLAERUNG) {
			expect(satz.length, satz).toBeLessThanOrEqual(180);
		}
	});
});

describe('Die Nachtragsliste', () => {
	const stand = (parteiId: string, zustand: string) => ({
		parteiId,
		name: parteiId.toUpperCase(),
		zustand
	});

	it('nennt anwesende Parteien ohne Antwort', () => {
		const offen = nichtGefragte([stand('a', 'anwesend'), stand('b', 'anwesend')], ['a'], []);
		expect(offen.map((o) => o.parteiId)).toEqual(['b']);
	});

	/*
	 * **Wer nicht da ist, wird nicht gefragt.** Die Frage hat nur eine Folge für
	 * jemanden, der mitstimmt; eine Liste voller Abwesender wäre eine Aufgabe,
	 * die niemand erledigen kann.
	 */
	it('lässt Wartende, Erfasste und Gegangene aus', () => {
		const offen = nichtGefragte(
			[stand('a', 'wartet'), stand('b', 'erfasst'), stand('c', 'gegangen')],
			[],
			[]
		);
		expect(offen).toEqual([]);
	});

	/*
	 * **Ein Vermerk ist selbst die Antwort.** Für Versammlungen, die vor
	 * Migration 109 liefen, gibt es Vermerke ohne Antwortzeile. Ohne diesen
	 * Zusatz stünde die Partei in der Nachtragsliste und trüge daneben, an
	 * derselben Zeile, ihren Vermerk «stimmt von Hand».
	 */
	it('lässt aus, wer einen Papiervermerk hat, auch ohne Antwortzeile', () => {
		const offen = nichtGefragte([stand('a', 'anwesend')], [], ['a']);
		expect(offen).toEqual([]);
	});

	it('ist leer, wenn alle geantwortet haben', () => {
		const offen = nichtGefragte([stand('a', 'anwesend'), stand('b', 'anwesend')], ['a', 'b'], []);
		expect(offen).toEqual([]);
	});
});

describe('Vertretene Parteien', () => {
	/*
	 * **Wer über eine Vollmacht anwesend ist, hat kein Gerät im Saal** — seine
	 * Stimme gibt der Bevollmächtigte ab. Die Eingangsfrage trifft ihn nicht, und
	 * er kommt auch nie durch den Einlasshelfer: Vertretene werden nachgezogen.
	 * Ohne diesen Ausschluss hätte jede Versammlung mit Vollmachten eine
	 * Nachtragsliste, die sich nie leert.
	 */
	it('stehen nicht in der Nachtragsliste', () => {
		const offen = nichtGefragte(
			[
				{ parteiId: 'a', name: 'A', zustand: 'anwesend', weg: 'vertretung' },
				{ parteiId: 'b', name: 'B', zustand: 'anwesend', weg: 'gescannt' }
			],
			[],
			[]
		);
		expect(offen.map((o) => o.parteiId)).toEqual(['b']);
	});
});
