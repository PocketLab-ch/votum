/**
 * Gibt es diesen Kalendertag? (Code-Review 02.09.2026)
 *
 * Der Anlass: Fünfzehn Stellen prüften ein Datum allein auf seine Gestalt.
 * `2026-02-31` kam durch und endete als rohe 500 aus PostgreSQL — auf dem
 * Übernahmeweg samt Verlust der hochgeladenen Tabelle.
 */
import { describe, expect, it } from 'vitest';
import { istKalendertag } from '$lib/domain/datum';

describe('istKalendertag', () => {
	it('nimmt gewöhnliche Tage an', () => {
		for (const tag of ['2026-09-02', '2000-01-01', '1999-12-31', '2033-06-15']) {
			expect(istKalendertag(tag), tag).toBe(true);
		}
	});

	/*
	 * **Der Kern des Befundes.** Diese Werte passieren jede reine
	 * Gestaltprüfung und brechen erst in der Datenbank ab.
	 */
	it('weist Tage ab, die es nicht gibt', () => {
		for (const tag of ['2026-02-31', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10']) {
			expect(istKalendertag(tag), tag).toBe(false);
		}
	});

	it('kennt die Schaltjahrregel, ohne sie nachzubauen', () => {
		// Durch vier teilbar: Schaltjahr.
		expect(istKalendertag('2024-02-29')).toBe(true);
		expect(istKalendertag('2026-02-29')).toBe(false);
		// Durch hundert, aber nicht durch vierhundert: kein Schaltjahr.
		expect(istKalendertag('1900-02-29')).toBe(false);
		// Durch vierhundert: doch eines.
		expect(istKalendertag('2000-02-29')).toBe(true);
	});

	it('weist ab, was gar nicht die Gestalt hat', () => {
		for (const wert of ['', '2026-9-2', '02.09.2026', '2026-09-02T10:00', 'heute', '2026-09-0x']) {
			expect(istKalendertag(wert), JSON.stringify(wert)).toBe(false);
		}
	});

	/*
	 * **Der Tag null rollt rückwärts.** `Date.UTC(2026, 8, 0)` ist der 31.
	 * August — die Probe fängt ihn, weil der zurückgelesene Tag nicht mehr
	 * stimmt.
	 */
	it('weist den nullten Tag ab', () => {
		expect(istKalendertag('2026-09-00')).toBe(false);
	});
});
