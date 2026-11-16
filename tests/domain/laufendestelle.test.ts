import { describe, expect, it } from 'vitest';
import { aufrufreihenfolge, laufendeStelle } from '$lib/domain/gemeinsameliste';

/**
 * Welcher Schritt am gemeinsamen Abend gerade läuft.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Wenn ich bei 2.2 auf Aufrufen klicke,
 * komme ich nicht weiter.» Der Klick wirkte — in der Datenbank stand das
 * richtige Traktandum —, nur zeigte die Steuerung weiter den vorigen Schritt.
 */
function schritt(nummer: string, traktanden: string[]) {
	return {
		nummer,
		titel: `Punkt ${nummer}`,
		punktart: 'abstimmung' as const,
		geschaeftId: `g-${nummer}`,
		traktandumId: traktanden.length === 1 ? traktanden[0] : null,
		gemeinschaft: null,
		traktanden: traktanden.map((id) => ({
			traktandumId: id,
			meetingId: `m-${id}`,
			gemeinschaft: `Haus ${id}`
		}))
	} as never;
}

/** Kurzschreibweise: Traktandum mit Aufrufzeitpunkt. */
function auf(traktandumId: string | null, seit: string | null = null) {
	return { traktandumId, seit };
}

describe('laufendeStelle', () => {
	it('findet den Schritt, auf dem alle Häuser stehen', () => {
		const schritte = [schritt('1', ['a1', 'b1']), schritt('2', ['a2', 'b2'])];
		expect(laufendeStelle(schritte, [auf('a2'), auf('b2')])).toBe(1);
	});

	it('nimmt bei einzeln geführten Punkten den ZULETZT aufgerufenen', () => {
		// Der gemeldete Fall: 2.1 gehört der MEG, 2.2 dem anderen Haus. Beide
		// stehen auf «ihrem» Punkt — je Traktandum gezählt wäre das 1 zu 1, und
		// welches gewinnt, entschiede sonst die Reihenfolge der Häuserliste.
		const schritte = [schritt('2.1', ['meg']), schritt('2.2', ['sw6'])];
		expect(
			laufendeStelle(schritte, [
				auf('meg', '2026-05-19T17:10:00Z'),
				auf('sw6', '2026-05-19T17:14:00Z')
			])
		).toBe(1);
		// Und in der anderen Reihenfolge dasselbe — das war vorher der Zufall.
		expect(
			laufendeStelle(schritte, [
				auf('sw6', '2026-05-19T17:14:00Z'),
				auf('meg', '2026-05-19T17:10:00Z')
			])
		).toBe(1);
	});

	it('folgt dem Rücksprung auf den früheren Punkt', () => {
		/*
		 * **Der Fall, den «der spätere gewinnt» nicht sehen konnte** (25.08.2026,
		 * am Verbund-Durchlauf gemessen). Ein Haus steht noch auf einem hohen
		 * Punkt aus einem früheren Handgriff; die Sitzungsleitung ruft weiter
		 * vorne einen Punkt auf. Vorher zeigte die Steuerung weiter den hohen —
		 * und «Abstimmung eröffnen» hätte den falschen Punkt geöffnet.
		 */
		const schritte = [schritt('9', ['sw6-9']), schritt('20', ['meg-20'])];
		expect(
			laufendeStelle(schritte, [
				auf('sw6-9', '2026-05-19T17:20:00Z'),
				auf('meg-20', '2026-05-19T17:05:00Z')
			])
		).toBe(0);
	});

	it('bleibt beim vorigen, solange das zweite Haus nicht nachgezogen ist', () => {
		const schritte = [schritt('2.1', ['meg']), schritt('2.2', ['sw6'])];
		expect(laufendeStelle(schritte, [auf('meg', '2026-05-19T17:10:00Z'), auf(null)])).toBe(0);
	});

	it('nimmt den jüngsten Aufruf, auch gegen zwei Häuser auf einem früheren Schritt', () => {
		/*
		 * **Die Gegenaussage zur früheren Zählung** (Auftraggeber 25.09.2026 auf
		 * den Befund: «prüf die Ursache. Wäre sauberer.»). Bis hierher entschied
		 * die Zahl der Häuser je Schritt. Die Zählung kam mit `0f57bbb`
		 * (24.08.2026) in die Leitung des Abends und war nie ein
		 * Produktentscheid; die Wand verwarf ihre eigene am Tag danach
		 * (`3af7ffd`). Jetzt gilt der jüngste Aufruf: Der
		 * Saal spricht über den Punkt, den die Sitzungsleitung zuletzt
		 * aufgerufen hat, nicht über den, auf dem die meisten Häuser stehen.
		 */
		const schritte = [schritt('1', ['a1', 'b1', 'c1']), schritt('2', ['a2', 'b2', 'c2'])];
		expect(
			laufendeStelle(schritte, [
				auf('a1', '2026-05-19T17:00:00Z'),
				auf('b1', '2026-05-19T17:00:00Z'),
				auf('c2', '2026-05-19T17:30:00Z')
			])
		).toBe(1);
	});

	it('folgt dem Aufruf in den ersten Einzelschritt bei drei Häusern', () => {
		/*
		 * **Fall 1a der Messung vom 25.09.2026.** Die Begrüssung ist ein
		 * gemeinsamer Schritt aller drei Häuser, danach ruft Haus A allein 2.1
		 * auf. Je Haus steht genau ein Aufruf in der Liste, wie es der Aufrufer
		 * erzeugt: B und C auf der Begrüssung, A auf 2.1. Die frühere Zählung
		 * blieb 2 gegen 1 auf der Begrüssung stehen, während die Wand schon 2.1
		 * zeigte; der jüngste Aufruf zeigt 2.1.
		 */
		const schritte = [schritt('1', ['a1', 'b1', 'c1']), schritt('2.1', ['a2'])];
		expect(
			laufendeStelle(schritte, [
				auf('b1', '2026-09-25T19:00:00.000Z'),
				auf('c1', '2026-09-25T19:00:00.000Z'),
				auf('a2', '2026-09-25T19:05:00.000Z')
			])
		).toBe(1);
	});

	it('stellt ein Haus ohne Zeitangabe hinten an', () => {
		// Der CHECK in der Datenbank verlangt den Zeitpunkt; käme ein Haus doch
		// ohne, darf es ein frisch aufgerufenes nicht verdrängen.
		const schritte = [schritt('1', ['a1']), schritt('2', ['b2'])];
		expect(laufendeStelle(schritte, [auf('a1', null), auf('b2', '2026-05-19T17:10:00Z')])).toBe(1);
	});

	/*
	 * **Nach dem Sammelaufruf ist das erste Haus «jetzt»** (Produktentscheid
	 * 25.09.2026: Bedienung wie bei jeder anderen Abstimmung). Gerechnet wie im
	 * Betrieb: in der Reihenfolge von `aufrufreihenfolge` aufgerufen, jeder
	 * Aufruf später als der vorige. Mit der alten Reihenfolge (vorne nach
	 * hinten) stünde hier das letzte Haus. Ob `rufeAmAbendAuf` die Funktion
	 * auch benutzt, sieht diese Probe nicht; das misst `e2e/abendschritte.mjs`.
	 */
	it('zeigt nach dem Sammelaufruf das erste Haus des Punktes', () => {
		const schritte = [
			schritt('10.1', ['a']),
			schritt('10.2', ['b']),
			schritt('10.3', ['c']),
			schritt('11', ['a11'])
		];
		const aufgerufen = aufrufreihenfolge(['a', 'b', 'c'], false).map((t, i) =>
			auf(t, `2026-09-25T19:00:00.${String(100 * (i + 1)).padStart(3, '0')}Z`)
		);
		expect(laufendeStelle(schritte, aufgerufen)).toBe(0);
	});

	it('lässt die Reihenfolge beim Aufruf eines einzelnen Traktandums', () => {
		expect(aufrufreihenfolge(['a'], true)).toEqual(['a']);
		expect(aufrufreihenfolge(['a', 'b', 'c'], true)).toEqual(['a', 'b', 'c']);
		// Zweimal angewandt: die Reihenfolge des Punktes, für die Absagen.
		expect(aufrufreihenfolge(aufrufreihenfolge(['a', 'b', 'c'], false), false)).toEqual([
			'a',
			'b',
			'c'
		]);
	});

	it('geht nach «Aufrufen» bei «nachher» zum nächsten Haus', () => {
		const schritte = [schritt('10.1', ['a']), schritt('10.2', ['b']), schritt('10.3', ['c'])];
		expect(
			laufendeStelle(schritte, [
				auf('a', '2026-09-25T19:00:00.300Z'),
				auf('b', '2026-09-25T19:05:00Z'),
				auf('c', '2026-09-25T19:00:00.100Z')
			])
		).toBe(1);
	});

	it('nimmt bei genau gleicher Zeit den früheren Schritt, unabhängig von der Häuserfolge', () => {
		const schritte = [schritt('10.1', ['a']), schritt('10.2', ['b'])];
		const gleich = '2026-09-25T19:00:00.000Z';
		expect(laufendeStelle(schritte, [auf('b', gleich), auf('a', gleich)])).toBe(0);
		expect(laufendeStelle(schritte, [auf('a', gleich), auf('b', gleich)])).toBe(0);
	});

	it('meldet -1, wenn nirgends etwas aufgerufen ist', () => {
		const schritte = [schritt('1', ['a1'])];
		expect(laufendeStelle(schritte, [auf(null), auf(null)])).toBe(-1);
	});

	it('uebergeht ein Traktandum, das zu keinem Schritt gehoert', () => {
		// Etwa ein spontan aufgenommener Punkt, der in der Liste noch fehlt.
		const schritte = [schritt('1', ['a1'])];
		expect(laufendeStelle(schritte, [auf('fremd', '2026-05-19T17:10:00Z')])).toBe(-1);
	});
});
