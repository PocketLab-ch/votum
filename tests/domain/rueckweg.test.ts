import { describe, expect, it } from 'vitest';
import { pruefeRueckweg } from '$lib/domain/rueckweg';

/**
 * Der Rückweg einer Zwischenseite.
 *
 * Geprüft wird beides: dass der gewollte Weg durchkommt (sonst landet die
 * Sitzungsleitung wieder in der Traktandenliste, gemeldet am 21.08.2026) und
 * dass nichts durchkommt, was aus dieser Versammlung hinausführt.
 */
describe('pruefeRueckweg', () => {
	const V = '019fbee9-ec67-7678-8218-496d16ea0ad8';
	const ERSATZ = `/versammlungen/${V}/traktanden`;

	it('nimmt den Weg innerhalb derselben Versammlung', () => {
		expect(pruefeRueckweg(`/versammlungen/${V}/leitung`, V, ERSATZ)).toBe(
			`/versammlungen/${V}/leitung`
		);
	});

	it('fällt ohne Angabe auf das Ersatzziel zurück', () => {
		expect(pruefeRueckweg(null, V, ERSATZ)).toBe(ERSATZ);
		expect(pruefeRueckweg('', V, ERSATZ)).toBe(ERSATZ);
	});

	it('lässt keine fremde Versammlung zu', () => {
		expect(pruefeRueckweg('/versammlungen/01a0-fremd/leitung', V, ERSATZ)).toBe(ERSATZ);
	});

	it('lässt keine fremde Seite zu', () => {
		// Eine offene Weiterleitung: Der Rückweg käme aus dem Netz und führte
		// woandershin — mit der Adresse dieser Anwendung davor.
		for (const boese of [
			'https://beispiel.test/',
			'//beispiel.test/',
			'/betreiber',
			'javascript:alert(1)',
			'\\\\beispiel.test'
		]) {
			expect(pruefeRueckweg(boese, V, ERSATZ)).toBe(ERSATZ);
		}
	});

	it('lässt Unterseiten derselben Versammlung zu', () => {
		expect(pruefeRueckweg(`/versammlungen/${V}/anwesenheit`, V, ERSATZ)).toBe(
			`/versammlungen/${V}/anwesenheit`
		);
	});
});
