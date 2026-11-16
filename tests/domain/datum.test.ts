/**
 * Datumsangaben in lesbarer Form.
 *
 * Die Anwendung schrieb «Versammlung vom 2026-05-19» in die Überschrift und
 * «19. Mai 2026» auf die Einladung. Ein Datum, zwei Schreibweisen — geprüft wird
 * hier vor allem, dass beide Seiten aus derselben Quelle schöpfen und dass eine
 * unlesbare Eingabe nichts umbringt.
 */
import { describe, expect, it } from 'vitest';
import { datumLang, datumMitWochentag, manifestzeitpunkt } from '$lib/domain/datum';
import { datumLang as datumLangImPdf } from '$lib/server/pdf/traktandenliste';

describe('datumLang', () => {
	it('schreibt den Monat aus', () => {
		expect(datumLang('2026-05-19')).toBe('19. Mai 2026');
	});

	it('lässt die führende Null des Tages weg', () => {
		expect(datumLang('2026-01-05')).toBe('5. Januar 2026');
	});

	it('kennt alle zwölf Monate', () => {
		const monate = Array.from({ length: 12 }, (_, i) =>
			datumLang(`2026-${String(i + 1).padStart(2, '0')}-01`)
		);
		expect(monate).toEqual([
			'1. Januar 2026',
			'1. Februar 2026',
			'1. März 2026',
			'1. April 2026',
			'1. Mai 2026',
			'1. Juni 2026',
			'1. Juli 2026',
			'1. August 2026',
			'1. September 2026',
			'1. Oktober 2026',
			'1. November 2026',
			'1. Dezember 2026'
		]);
	});

	it('gibt Unlesbares unverändert zurück', () => {
		// Sichtbar bleiben, damit jemand es berichtigt — nicht die Seite mitnehmen.
		expect(datumLang('kein Datum')).toBe('kein Datum');
		expect(datumLang('2026-13-01')).toBe('2026-13-01');
		expect(datumLang('')).toBe('');
	});
});

describe('Papier und Bildschirm schreiben dasselbe', () => {
	it('nimmt die PDF-Erzeugung dieselbe Form', () => {
		expect(datumLangImPdf('2026-05-19')).toBe(datumLang('2026-05-19'));
	});
});

describe('datumMitWochentag', () => {
	it('nennt den Wochentag', () => {
		// Der 19. Mai 2026 ist ein Dienstag — so steht es auch im Protokoll.
		expect(datumMitWochentag('2026-05-19')).toBe('Di, 19. Mai 2026');
	});

	it('rechnet über den Jahreswechsel richtig', () => {
		expect(datumMitWochentag('2026-01-01')).toBe('Do, 1. Januar 2026');
		expect(datumMitWochentag('2025-12-31')).toBe('Mi, 31. Dezember 2025');
	});

	it('trifft den Schalttag', () => {
		expect(datumMitWochentag('2024-02-29')).toBe('Do, 29. Februar 2024');
	});

	it('verschiebt sich nicht durch die Zeitzone', () => {
		// `new Date('2026-05-19')` liest UTC-Mitternacht; in einer westlichen
		// Zeitzone wäre das der Vortag. Deshalb wird gerechnet statt geparst.
		expect(datumMitWochentag('2026-05-19').startsWith('Di')).toBe(true);
	});
});

describe('manifestzeitpunkt', () => {
	it('schreibt den zonenlosen Zeitpunkt des Manifests ohne Umrechnung', () => {
		// 21:30 bleibt 21:30, auch auf einem Server in UTC: abgeschnitten, nicht geparst.
		expect(manifestzeitpunkt('2026-10-04 21:30:00')).toBe('04.10.2026, 21:30');
		expect(manifestzeitpunkt('2026-12-31 23:59:59')).toBe('31.12.2026, 23:59');
	});

	it('zeigt nur den Tag, wenn keine Uhrzeit dabei ist', () => {
		expect(manifestzeitpunkt('2026-10-04')).toBe('04.10.2026');
	});

	it('lässt Fremdes stehen, statt es zu deuten', () => {
		expect(manifestzeitpunkt(undefined)).toBe('');
		expect(manifestzeitpunkt(null)).toBe('');
		expect(manifestzeitpunkt('unbekannt')).toBe('unbekannt');
		expect(manifestzeitpunkt(42)).toBe('42');
	});

	it('schneidet einen UTC-Wert mit «T» nicht ab, sondern lässt ihn stehen', () => {
		// So steht `geschlossenAm` im selben Manifest; abgeschnitten wäre es
		// 19:30 statt 21:30. Dafür ist `zeitpunktKurz` da.
		expect(manifestzeitpunkt('2026-10-04T19:30:12.345Z')).toBe('2026-10-04T19:30:12.345Z');
	});
});
