import { describe, expect, it } from 'vitest';
import { A4, A4_QUER, mm, teileAufSeiten, umbrich, type Block } from '../../src/lib/domain/textsatz';

/** Eine Messfunktion, bei der jedes Zeichen genau eine Einheit breit ist. */
const einheitlich = (t: string) => t.length;

describe('Umbruch', () => {
	it('bricht auf die Breite um', () => {
		expect(umbrich('eins zwei drei vier', 10, einheitlich)).toEqual([
			'eins zwei',
			'drei vier'
		]);
	});

	it('lässt einen kurzen Text in einer Zeile', () => {
		expect(umbrich('kurz', 20, einheitlich)).toEqual(['kurz']);
	});

	it('behält gesetzte Zeilenumbrüche', () => {
		// In einem Antragswortlaut sind sie gesetzt und keine Zufälligkeit.
		expect(umbrich('erste Zeile\nzweite Zeile', 40, einheitlich)).toEqual([
			'erste Zeile',
			'zweite Zeile'
		]);
	});

	it('behält eine Leerzeile als Absatztrenner', () => {
		expect(umbrich('a\n\nb', 20, einheitlich)).toEqual(['a', '', 'b']);
	});

	it('fasst mehrfache Leerzeichen zusammen', () => {
		expect(umbrich('a     b', 20, einheitlich)).toEqual(['a b']);
	});

	it('trennt ein überlanges Wort hart, statt es über den Rand laufen zu lassen', () => {
		// «Erneuerungsfondsbeitragsberechnung» passt in keine Spalte. Es stehen zu
		// lassen hiesse, dass ein Teil davon unsichtbar wird.
		const zeilen = umbrich('Erneuerungsfondsbeitragsberechnung', 10, einheitlich);
		expect(zeilen.every((z) => z.length <= 10)).toBe(true);
		expect(zeilen.join('')).toBe('Erneuerungsfondsbeitragsberechnung');
	});

	it('setzt nach einem hart getrennten Wort normal fort', () => {
		const zeilen = umbrich('AAAAAAAAAAAA kurz', 5, einheitlich);
		expect(zeilen.join(' ').replace(/\s+/g, ' ')).toContain('kurz');
		expect(zeilen.every((z) => z.length <= 5)).toBe(true);
	});

	it('kommt mit leerem Text zurecht', () => {
		expect(umbrich('', 10, einheitlich)).toEqual(['']);
	});

	it('überschreitet die Breite nie', () => {
		const text = 'Die Versammlung beschliesst die Sanierung der Fassade nach Offerte Meier AG.';
		for (const breite of [8, 12, 20, 40]) {
			expect(umbrich(text, breite, einheitlich).every((z) => z.length <= breite)).toBe(true);
		}
	});
});

describe('Seitenaufteilung', () => {
	function b(hoehe: number, haeltZusammen = false): Block {
		return { hoehe, haeltZusammen };
	}

	it('füllt eine Seite, bis sie voll ist', () => {
		const { seiten } = teileAufSeiten([b(30), b(30), b(30), b(30)], 100);
		expect(seiten.map((s) => s.length)).toEqual([3, 1]);
	});

	it('nimmt einen gebundenen Block mit dem nächsten mit', () => {
		// Eine Traktandennummer allein am Seitenende, deren Inhalt auf der nächsten
		// Seite steht, ist auf dem Beamer unlesbar.
		const { seiten } = teileAufSeiten([b(30), b(30), b(30, true), b(30)], 100);
		expect(seiten.map((s) => s.length)).toEqual([2, 2]);
	});

	it('bricht nicht vor dem ersten Block', () => {
		// Ein Block, der höher ist als die Seite, beginnt trotzdem auf ihr — sonst
		// bliebe die erste Seite leer und der Block passte auf der zweiten genauso
		// wenig.
		const { seiten } = teileAufSeiten([b(200), b(10)], 100);
		expect(seiten[0][0].hoehe).toBe(200);
	});

	it('gibt auch bei leerer Eingabe eine Seite zurück', () => {
		// Ein PDF ohne Seite lässt sich von keinem Betrachter öffnen.
		expect(teileAufSeiten([], 100).seiten).toEqual([[]]);
	});

	it('bindet den letzten Block nicht ins Leere', () => {
		const { seiten } = teileAufSeiten([b(90), b(20, true)], 100);
		expect(seiten.map((s) => s.length)).toEqual([1, 1]);
	});
});

describe('Masse', () => {
	it('rechnet Millimeter in Punkte', () => {
		expect(Math.round(mm(25.4))).toBe(72);
		expect(Math.round(mm(210))).toBe(595);
	});

	it('kennt A4 hoch und quer', () => {
		expect(Math.round(A4.breite)).toBe(595);
		expect(Math.round(A4.hoehe)).toBe(842);
		expect(Math.round(A4_QUER.breite)).toBe(842);
		expect(Math.round(A4_QUER.hoehe)).toBe(595);
	});
});
