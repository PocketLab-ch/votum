/**
 * Die Regeln der Rüge im Kern (Ä-06). Jede Schranke der Migration 160 steht
 * hier vorher, damit im Saal ein Satz erscheint und keine Datenbankmeldung.
 */
import { describe, expect, it } from 'vitest';
import { pruefeRuege, ruegeSatz, RUEGE_HOECHSTENS } from '$lib/domain/ruege';

const GUT = { wortlaut: 'Einladung zu spät', wer: 'Erika Beispiel', uhrzeit: '19:45' };

describe('pruefeRuege', () => {
	it('putzt die Eingabe und lässt den Entscheid leer, wenn keiner da ist', () => {
		expect(pruefeRuege({ ...GUT, wortlaut: '  Einladung zu spät ', entscheid: '   ' })).toEqual({
			wortlaut: 'Einladung zu spät',
			wer: 'Erika Beispiel',
			uhrzeit: '19:45',
			entscheid: null
		});
	});

	it('ergänzt eine einstellige Stunde', () => {
		expect(pruefeRuege({ ...GUT, uhrzeit: '9:05' }).uhrzeit).toBe('09:05');
	});

	it.each(['24:00', '19:60', '1945', 'abends', ''])('weist die Uhrzeit «%s» ab', (uhrzeit) => {
		expect(() => pruefeRuege({ ...GUT, uhrzeit })).toThrow(
			expect.objectContaining({ feld: 'uhrzeit' })
		);
	});

	it('verlangt Wortlaut und wer rügt', () => {
		expect(() => pruefeRuege({ ...GUT, wortlaut: 'ab' })).toThrow(
			expect.objectContaining({ feld: 'wortlaut' })
		);
		expect(() => pruefeRuege({ ...GUT, wer: ' ' })).toThrow(
			expect.objectContaining({ feld: 'wer' })
		);
	});

	it('hält die Höchstlänge der Datenbank, in Zeichen und nicht in UTF-16-Einheiten', () => {
		// Ein Bildzeichen ist ein Zeichen; `length` zählte es doppelt.
		expect(pruefeRuege({ ...GUT, wortlaut: '🙂'.repeat(RUEGE_HOECHSTENS) }).wortlaut).toHaveLength(
			RUEGE_HOECHSTENS * 2
		);
		expect(() => pruefeRuege({ ...GUT, wortlaut: 'x'.repeat(RUEGE_HOECHSTENS + 1) })).toThrow(
			expect.objectContaining({ feld: 'wortlaut' })
		);
		expect(() => pruefeRuege({ ...GUT, entscheid: 'x'.repeat(RUEGE_HOECHSTENS + 1) })).toThrow(
			expect.objectContaining({ feld: 'entscheid' })
		);
	});
});

describe('ruegeSatz', () => {
	it('setzt Uhrzeit, wer rügt, Wortlaut und Vorgehen zu einem Satz mit Satzzeichen', () => {
		expect(
			ruegeSatz({
				uhrzeit: '19:12',
				wer: 'Erika Beispiel',
				wortlaut: 'Einladung zu spät',
				entscheid: 'Abstimmung findet statt'
			})
		).toBe(
			'19:12 Uhr, Erika Beispiel: Einladung zu spät. Vorgehen des Vorsitzes: Abstimmung findet statt.'
		);
		expect(
			ruegeSatz({ uhrzeit: '19:12', wer: 'Erika Beispiel', wortlaut: 'Einladung zu spät!', entscheid: null })
		).toBe('19:12 Uhr, Erika Beispiel: Einladung zu spät!');
	});

	it('bleibt eine Zeile, auch wenn der Wortlaut mehrere hat', () => {
		const satz = ruegeSatz({
			uhrzeit: '19:12',
			wer: 'Erika Beispiel',
			wortlaut: 'Erstens zu spät\n- zweitens ohne Antrag',
			entscheid: 'Abstimmung\n\nfindet statt'
		});
		expect(satz).not.toContain('\n');
		expect(satz).toContain('Erstens zu spät - zweitens ohne Antrag.');
	});

	it('lässt den Namen weg, wo das Dokument an mehrere Gemeinschaften geht', () => {
		expect(
			ruegeSatz({ uhrzeit: '19:12', wer: 'Erika Beispiel', wortlaut: 'Zu spät', entscheid: null }, { ohneName: true })
		).toBe('19:12 Uhr: Zu spät.');
	});
});
