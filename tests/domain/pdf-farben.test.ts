import { describe, expect, it } from 'vitest';
import { GRAU, SCHWARZ } from '$lib/server/pdf/basis';

/**
 * Wie gut sich eine Farbe auf weissem Papier liest.
 *
 * Nach WCAG 2.1: relative Luminanz mit linearisierten Kanälen, dann
 * `(heller + 0.05) / (dunkler + 0.05)`. Für Papier ist die Schwelle strenger
 * als für den Bildschirm — ein Tintenstrahler mit müder Patrone verliert
 * genau die hellen Grautöne zuerst.
 */
function kontrastAufWeiss(farbe: { red: number; green: number; blue: number }): number {
	const lin = (c: number) => (c > 0.03928 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);
	const l = 0.2126 * lin(farbe.red) + 0.7152 * lin(farbe.green) + 0.0722 * lin(farbe.blue);
	return 1.05 / (l + 0.05);
}

describe('Farben der PDF', () => {
	/**
	 * **Befund des Auftraggebers vom 28.08.2026:** «Graue Schrift auf den PDF vermeiden.
	 * Drucker geben Grau verschieden gut wieder, und für Menschen mit
	 * schwächeren Augen ist es schlecht lesbar.»
	 *
	 * `GRAU` stand auf `rgb(0.42, 0.44, 0.48)` — gerechnet 4,96:1 und damit
	 * knapp über der Bildschirmschwelle von 4,5:1, für Papier zu wenig. Der
	 * Wächter hält 7:1 fest (WCAG AAA für Fliesstext); der heutige Wert liegt
	 * bei 9,68:1 und hat Luft nach unten, falls jemand ihn feinjustiert.
	 */
	it('hält die leise Textfarbe dunkel genug für den Druck', () => {
		expect(kontrastAufWeiss(GRAU)).toBeGreaterThanOrEqual(7);
	});

	/** Die Gegenprobe: Leise bleibt leiser als laut, sonst ist nichts gewonnen. */
	it('lässt die leise Farbe leiser als die laute', () => {
		expect(kontrastAufWeiss(GRAU)).toBeLessThan(kontrastAufWeiss(SCHWARZ));
	});
});
