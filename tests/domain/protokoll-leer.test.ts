import { describe, expect, it } from 'vitest';
import { LEERES_PROTOKOLL, darfLeerSein, pruefeProtokolltext } from '$lib/domain/protokoll';

/**
 * Der leere Text, den das sichernde Feld bis zum 08.09.2026 schickte und der
 * Server als 400 abwies. Beides wird hier gemessen: dass die Schranke im Kern
 * steht und dass sie die beiden Felder verschieden behandelt.
 */
describe('Der leere Text', () => {
	it('darf in einer Notiz stehen, im Protokolltext nicht', () => {
		expect(darfLeerSein('notiz')).toBe(true);
		expect(darfLeerSein('body')).toBe(false);
	});

	/**
	 * **Die Schranke bleibt im Kern**, auch wenn die Maske sie vorwegnimmt.
	 * Ohne JavaScript sendet dasselbe Formular klassisch, und wer den Endpunkt
	 * von Hand anspricht, kommt ohnehin hier vorbei.
	 */
	it('wird vom Kern abgewiesen, auch aus Leerraum', () => {
		expect(() => pruefeProtokolltext('')).toThrow(LEERES_PROTOKOLL);
		expect(() => pruefeProtokolltext('   \n\t ')).toThrow(LEERES_PROTOKOLL);
	});

	it('lässt einen echten Text durch und beschneidet ihn', () => {
		expect(pruefeProtokolltext('  # Protokoll\n\nText.  ')).toBe('# Protokoll\n\nText.');
	});
});
