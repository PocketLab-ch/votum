/**
 * Kennwortregeln.
 *
 * Der Prüfstein ist nicht die Untergrenze, sondern **was nicht verlangt wird**:
 * Regeln über Grossbuchstaben, Ziffern und Sonderzeichen erzeugen
 * `Sommer2026!` — zwölf Zeichen, jede Vorschrift erfüllt, und in jeder
 * Wörterbuchliste.
 */
import { describe, expect, it } from 'vitest';
import { MINDESTLAENGE, pruefeKennwort, verlangeGleich } from '$lib/domain/kennwort';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

describe('Was durchgeht', () => {
	it('nimmt eine Wortfolge ohne Ziffer und ohne Sonderzeichen', () => {
		expect(pruefeKennwort('brauner tisch am fenster')).toBe('brauner tisch am fenster');
	});

	it('nimmt genau die Untergrenze', () => {
		const gerade = 'abcdefghijkl';
		expect(gerade.length).toBe(MINDESTLAENGE);
		expect(pruefeKennwort(gerade)).toBe(gerade);
	});
});

describe('Was abgewiesen wird', () => {
	it('zu kurz — und der Satz sagt, was zu tun ist', () => {
		try {
			pruefeKennwort('kurz');
			throw new Error('hätte werfen müssen');
		} catch (f) {
			expect(f).toBeInstanceOf(FachlicherFehler);
			// Keine Regelaufzählung, sondern eine Anleitung.
			expect((f as FachlicherFehler).message).toMatch(/Wortfolge/);
		}
	});

	it('den eigenen Benutzernamen — genau das versucht ein Angreifer zuerst', () => {
		expect(() => pruefeKennwort('mmeier-sommer-2026', { benutzername: 'mmeier' })).toThrow(
			/enthält Ihren Namen/
		);
	});

	it('den Anzeigenamen, auch mitten im Kennwort und in anderer Schreibung', () => {
		expect(() => pruefeKennwort('xxAnna Meierxxxx', { anzeigename: 'anna meier' })).toThrow(
			/enthält Ihren Namen/
		);
	});

	it('einen sehr kurzen Namen aber nicht — sonst scheiterte jedes zweite Kennwort', () => {
		// «Li» als Anzeigename darf nicht dazu führen, dass «Frühling im Tal»
		// abgewiesen wird, weil dort zufällig «li» vorkommt.
		expect(pruefeKennwort('fruehling im tal', { anzeigename: 'Li' })).toBeTruthy();
	});

	it('zu wenige verschiedene Zeichen', () => {
		expect(() => pruefeKennwort('aaaaaaaaaaaaaa')).toThrow(/verschiedenen Zeichen/);
		expect(() => pruefeKennwort('abababababab')).toThrow(/verschiedenen Zeichen/);
	});

	it('ein masslos langes — eine Ableitung ist Rechenarbeit', () => {
		expect(() => pruefeKennwort('a'.repeat(500) + 'bcd')).toThrow(/höchstens/);
	});
});

describe('Die Wiederholung', () => {
	it('meldet den Vertipper am richtigen Feld', () => {
		try {
			verlangeGleich('brauner tisch am fenster', 'brauner tisch am fesnter');
			throw new Error('hätte werfen müssen');
		} catch (f) {
			expect((f as FachlicherFehler).feld).toBe('wiederholung');
			// Nichts ist falsch am Kennwort — es wurde zweimal verschieden getippt.
			expect((f as FachlicherFehler).message).toMatch(/stimmen nicht überein/);
		}
	});
});
