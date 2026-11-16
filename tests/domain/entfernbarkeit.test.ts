import { describe, expect, it } from 'vitest';
import {
	entfernungshindernis,
	type Anhaengendes
} from '../../src/lib/domain/entfernbarkeit';

/**
 * Die Regel, die darüber entscheidet, ob der Knopf «Gemeinschaft entfernen»
 * offensteht — und die Klasse von Fehlern, die sie mitbringt.
 *
 * **Warum das mehr ist als sechs Beispiele.** Diese Regel wird an zwei Stellen
 * gelesen: von der Seite, die vorher anzeigt, und vom Vollzug, der abweist. Der
 * Wächter am Ende misst deshalb nicht die Fälle, die es gibt, sondern jeden
 * Zähler, den es je geben wird.
 */

/** Nichts hängt dran — die Ausgangslage jeder Prüfung unten. */
const NICHTS: Anhaengendes = {
	versammlungen: 0,
	eingespielt: 0,
	kinder: 0,
	mitgliedschaften: 0,
	traktanden: 0,
	vertretungen: 0
};

describe('entfernungshindernis', () => {
	it('lässt entfernen, solange nichts dranhängt', () => {
		expect(entfernungshindernis('Musterstrasse 12', NICHTS)).toBeNull();
	});

	it('nennt Versammlungen zuerst', () => {
		const h = entfernungshindernis('Musterstrasse 12', { ...NICHTS, versammlungen: 3 });
		expect(h?.kennung).toBe('hat_versammlungen');
		expect(h?.nachricht).toContain('3 Versammlungen');
		expect(h?.nachricht).toContain('Musterstrasse 12');
	});

	it('beugt die Einzahl', () => {
		/*
		 * «hat 1 Versammlungen» ist der Satz, den eine Zählung ohne Beugung
		 * schreibt, und er fällt jedem Leser auf. Die Beugung steckt in derselben
		 * Zeile wie die Zahl; wer eine davon ändert, soll die andere sehen.
		 */
		const eine = entfernungshindernis('Haus A', { ...NICHTS, versammlungen: 1 });
		expect(eine?.nachricht).toContain('eine Versammlung');
		expect(eine?.nachricht).not.toContain('1 Versammlungen');

		const einPaket = entfernungshindernis('Haus A', { ...NICHTS, eingespielt: 1 });
		expect(einPaket?.nachricht).toContain('ein eingespieltes Abschlusspaket');
		const zweiPakete = entfernungshindernis('Haus A', { ...NICHTS, eingespielt: 2 });
		expect(zweiPakete?.nachricht).toContain('2 eingespielte Abschlusspakete');
	});

	it('erkennt eingespielte Abschlusspakete ohne Versammlung', () => {
		/*
		 * Der Fall, der einmal in eine rohe 500 lief: Das Einspielen schreibt nur
		 * `imported_meeting`, keine `meeting`-Zeile. Wer die Schranke «hat
		 * Versammlungen» für ausreichend hält, übersieht ihn.
		 */
		const h = entfernungshindernis('Haus A', { ...NICHTS, eingespielt: 1 });
		expect(h?.kennung).toBe('hat_eingespielte_pakete');
	});

	it('erkennt Untergemeinschaften, Mitgliedschaften und Verweise', () => {
		expect(entfernungshindernis('X', { ...NICHTS, kinder: 2 })?.kennung).toBe(
			'hat_untergemeinschaften'
		);
		expect(entfernungshindernis('X', { ...NICHTS, mitgliedschaften: 1 })?.kennung).toBe(
			'ist_eigentuemerin'
		);
		expect(entfernungshindernis('X', { ...NICHTS, traktanden: 1 })?.kennung).toBe('wird_verwiesen');
		expect(entfernungshindernis('X', { ...NICHTS, vertretungen: 1 })?.kennung).toBe(
			'wird_verwiesen'
		);
	});

	it('hält die Reihenfolge ein, wenn mehreres zugleich dranhängt', () => {
		/*
		 * Erst was der Mensch selbst angelegt hat, dann was andere daran hängen.
		 * Stünde hier «wird andernorts verwiesen», suchte er den Verweis und fände
		 * zuerst seine eigenen drei Versammlungen.
		 */
		const alles: Anhaengendes = {
			versammlungen: 3,
			eingespielt: 1,
			kinder: 2,
			mitgliedschaften: 1,
			traktanden: 4,
			vertretungen: 5
		};
		expect(entfernungshindernis('X', alles)?.kennung).toBe('hat_versammlungen');
	});

	it('zählt eine negative Zahl nicht als Hindernis', () => {
		// Kommt aus der Datenbank nie vor; die Prüfung steht hier, weil `> 0` und
		// `!== 0` sich nur in diesem Fall unterscheiden und beide «richtig» aussehen.
		expect(entfernungshindernis('X', { ...NICHTS, versammlungen: -1 })).toBeNull();
	});
});

describe('Wächter: jeder Zähler führt zu einem benannten Hindernis', () => {
	/*
	 * **Die Klasse, nicht die Instanz.** Die Prüfungen oben nennen ihre Fälle
	 * beim Namen; wer einen siebten Zähler ergänzt, ergänzt sie nicht mit und
	 * bleibt dort grün. Der stille Ausgang wäre der schlimmere: ein Anhang, der
	 * die Gemeinschaft unlöschbar macht, ohne dass die Seite sagen kann warum —
	 * denn `entfernungshindernis` gäbe dafür `null` zurück, der Knopf stünde
	 * offen, und die Absage käme wieder erst im Vollzug.
	 *
	 * Deshalb wird hier über die **Felder** von `Anhaengendes` gelaufen. Ein
	 * neues Feld zwingt der Typ in `NICHTS` nach, und von da an misst dieser
	 * Wächter es mit, ohne dass jemand daran denken muss.
	 */
	const felder = Object.keys(NICHTS) as (keyof Anhaengendes)[];

	it('kennt überhaupt Zähler — sonst misst der Wächter nichts', () => {
		expect(felder.length).toBeGreaterThanOrEqual(6);
	});

	it.each(felder)('%s ergibt ein Hindernis mit Kennung, Satz und Feld', (feld) => {
		const h = entfernungshindernis('Musterstrasse 12', { ...NICHTS, [feld]: 1 });
		expect(h, `«${feld}» führt zu keinem Hindernis — der Knopf stünde offen`).not.toBeNull();
		expect(h!.kennung).toMatch(/^[a-z_]+$/);
		expect(h!.feld.length).toBeGreaterThan(0);
		/*
		 * **Der Name gehört in den Satz.** Auf einer Liste gleichnamiger Häuser
		 * ist «Es hängt eine Versammlung daran» keine Auskunft, sondern eine
		 * Frage: an welchem?
		 */
		expect(h!.nachricht).toContain('Musterstrasse 12');
	});
});
