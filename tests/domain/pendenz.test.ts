/**
 * Die Regeln der Pendenz (Migration 106).
 *
 * Was sich nur an der Datenbank zeigt, steht in `tests/db/pendenz`. Hier steht
 * das, was jede Schranke der Migration **vorher** abfangen muss — sonst käme
 * sie im Saal als rohe Datenbankmeldung heraus (`docs/gestaltung.md`).
 */
import { describe, expect, it } from 'vitest';
import {
	PENDENZ_HOECHSTENS,
	fristSatz,
	pendenzSatz,
	pruefePendenz,
	pruefeZustand
} from '$lib/domain/pendenz';

describe('pruefePendenz', () => {
	it('putzt den Wortlaut und macht aus einem leeren Namen ein Nichts', () => {
		const p = pruefePendenz({
			text: '  Offerten einholen  ',
			verantwortlich: '   ',
			fristArt: 'keine'
		});
		expect(p.text).toBe('Offerten einholen');
		expect(p.verantwortlich).toBeNull();
		expect(p.fristDatum).toBeNull();
	});

	it('verlangt drei Zeichen, wie die Schranke pendenz_wortlaut', () => {
		expect(() => pruefePendenz({ text: 'ok', fristArt: 'keine' })).toThrow(/drei Zeichen/);
	});

	it('weist einen zu langen Wortlaut ab', () => {
		expect(() =>
			pruefePendenz({ text: 'x'.repeat(PENDENZ_HOECHSTENS + 1), fristArt: 'keine' })
		).toThrow(/Essenz/);
		expect(
			pruefePendenz({ text: 'y'.repeat(PENDENZ_HOECHSTENS), fristArt: 'keine' }).text.length
		).toBe(PENDENZ_HOECHSTENS);
	});

	/*
	 * **Die drei Fälle sind der Kern des Modells.** Ein Datum, das fehlen darf,
	 * trüge «noch nicht gesetzt» und «braucht keinen Termin» in einem Feld.
	 */
	it('verlangt bei «datum» ein Datum und verwirft es bei den beiden anderen', () => {
		expect(() => pruefePendenz({ text: 'Rampe', fristArt: 'datum' })).toThrow(/Bis wann/);
		expect(
			pruefePendenz({ text: 'Rampe', fristArt: 'naechste_versammlung', fristDatum: '2027-12-31' })
				.fristDatum
		).toBeNull();
		expect(
			pruefePendenz({ text: 'Rampe', fristArt: 'keine', fristDatum: '2027-12-31' }).fristDatum
		).toBeNull();
	});

	/*
	 * `istKalendertag` statt einer Gestaltprüfung: Der 31. Februar sieht richtig
	 * aus und käme sonst als `22008 date/time field value out of range` zurück.
	 */
	it('weist einen Tag ab, den es nicht gibt', () => {
		expect(() =>
			pruefePendenz({ text: 'Rampe', fristArt: 'datum', fristDatum: '2027-02-31' })
		).toThrow(/gibt es nicht/);
	});

	it('kennt keine vierte Fristart', () => {
		expect(() => pruefePendenz({ text: 'Rampe', fristArt: 'irgendwann' })).toThrow(/Art von Frist/);
	});
});

describe('pruefeZustand', () => {
	it('lässt die Notiz beim Wiederöffnen fallen', () => {
		expect(pruefeZustand('offen', 'war doch nicht erledigt').notiz).toBeNull();
		expect(pruefeZustand('erledigt', ' am 12.11. ').notiz).toBe('am 12.11.');
		expect(pruefeZustand('hinfaellig', '').notiz).toBeNull();
	});

	it('kennt keinen vierten Zustand', () => {
		expect(() => pruefeZustand('vielleicht')).toThrow(/Zustand/);
	});
});

describe('Sätze', () => {
	it('nennt die Frist so, wie sie im Protokoll steht', () => {
		expect(fristSatz({ fristArt: 'datum', fristDatum: '2027-12-31' })).toBe('bis 31.12.2027');
		expect(fristSatz({ fristArt: 'naechste_versammlung', fristDatum: null })).toBe(
			'bis zur nächsten Versammlung'
		);
		expect(fristSatz({ fristArt: 'keine', fristDatum: null })).toBe('ohne Termin');
	});

	it('setzt den Namen davor, wenn einer da ist', () => {
		expect(
			pendenzSatz({
				text: 'Offerten einholen',
				verantwortlich: 'die Bewirtschaftung',
				fristArt: 'naechste_versammlung',
				fristDatum: null
			})
		).toBe('die Bewirtschaftung: Offerten einholen (bis zur nächsten Versammlung)');
		expect(
			pendenzSatz({
				text: 'Wird abgeklärt',
				verantwortlich: null,
				fristArt: 'keine',
				fristDatum: null
			})
		).toBe('Wird abgeklärt (ohne Termin)');
	});
});
