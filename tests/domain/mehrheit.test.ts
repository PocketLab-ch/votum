import { describe, expect, it } from 'vitest';
import { mehrheitsschwelle, quotenschwelle } from '$lib/domain/mehrheit';

describe('mehrheitsschwelle', () => {
	// Das Zahlenbeispiel aus dem Ratgeber und dem Quorum-Finder, damit Website
	// und Werkzeug nachweislich dasselbe rechnen.
	it('verlangt bei 15 anwesenden Eigentümern 8 Ja-Stimmen', () => {
		expect(mehrheitsschwelle(15)).toBe(8);
	});

	it.each([
		[1, 1],
		[2, 2],
		[3, 2],
		[4, 3],
		[20, 11],
		[21, 11]
	])('bei %i Stimmen braucht es %i', (basis, erwartet) => {
		expect(mehrheitsschwelle(basis)).toBe(erwartet);
	});

	it('wertet Gleichstand als Ablehnung: die halbe Basis genügt nie', () => {
		for (const basis of [2, 4, 10, 100]) {
			expect(mehrheitsschwelle(basis)).toBeGreaterThan(basis / 2);
		}
	});

	it('gibt bei leerer Basis null zurück, statt eine Mehrheit zu erfinden', () => {
		expect(mehrheitsschwelle(0)).toBe(0);
	});

	it('weist Bruchzahlen ab, weil Stimmen ganzzahlig sind', () => {
		expect(() => mehrheitsschwelle(7.5)).toThrow(TypeError);
	});

	it('weist negative Bezugsgrössen ab', () => {
		expect(() => mehrheitsschwelle(-1)).toThrow(RangeError);
	});
});

describe('quotenschwelle', () => {
	it('verlangt bei 1000 Tausendsteln mindestens 501', () => {
		expect(quotenschwelle(1000)).toBe(501);
	});

	it('rechnet auch mit ungeraden Nennern', () => {
		expect(quotenschwelle(999)).toBe(500);
	});
});
