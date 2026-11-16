/**
 * Welche Adresse auf die gedruckte Karte kommt (Audit B-15).
 */
import { describe, expect, it } from 'vitest';
import { oeffentlicheHerkunft } from '$lib/domain/herkunft';

describe('Öffentliche Herkunft', () => {
	it('nimmt die feste Angabe, wenn es eine gibt', () => {
		// Der Kern des Befunds: Die Anfrage lügt, die feste Angabe gewinnt.
		expect(oeffentlicheHerkunft('https://haus.example.ch', 'https://boese.example.net')).toBe(
			'https://haus.example.ch'
		);
	});

	it('fällt ohne feste Angabe auf die Anfrage zurück', () => {
		// Bisheriges Verhalten, damit die Entwicklung unter wechselnden Adressen
		// weiterläuft.
		for (const leer of ['', '   ', undefined, null]) {
			expect(oeffentlicheHerkunft(leer, 'http://127.0.0.1:3100')).toBe('http://127.0.0.1:3100');
		}
	});

	it('schneidet den Schrägstrich am Ende weg', () => {
		// Sonst entstünde `https://haus.example.ch//e/xyz` — der QR-Code führte
		// trotzdem hin, aber auf der Karte steht dann eine Adresse mit Schönheitsfehler.
		expect(oeffentlicheHerkunft('https://haus.example.ch//', 'x')).toBe('https://haus.example.ch');
	});

	it('räumt Leerraum um die feste Angabe weg', () => {
		expect(oeffentlicheHerkunft('  https://haus.example.ch  ', 'x')).toBe('https://haus.example.ch');
	});
});
