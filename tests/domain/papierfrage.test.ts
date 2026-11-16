import { describe, expect, it } from 'vitest';
import { fragtNachPapier } from '$lib/domain/versammlung';

/**
 * Die Regel, ob der Einlass nach der Stimmabgabe fragt.
 *
 * Sie steht an einer Stelle, weil fünf Sichten sie brauchen — die schmale
 * Einlass-Seite, die Anwesenheitssicht, die Sitzungsleitung und die beiden
 * Sichten des gemeinsamen Abends. Diese Proben halten fest, was «an einer
 * Stelle» bedeutet: dass beide Bedingungen zusammen gelten müssen und keine
 * für sich genügt.
 */
describe('fragtNachPapier', () => {
	it('fragt in der geführten Betriebsart, wenn der Schalter steht', () => {
		expect(fragtNachPapier({ betriebsart: 'gefuehrt', papierfrage: true })).toBe(true);
	});

	it('fragt nicht, wenn der Schalter aus ist', () => {
		expect(fragtNachPapier({ betriebsart: 'gefuehrt', papierfrage: false })).toBe(false);
	});

	it('fragt in der einfachen Betriebsart nie — dort stimmen ohnehin alle von Hand', () => {
		expect(fragtNachPapier({ betriebsart: 'einfach', papierfrage: true })).toBe(false);
	});

	it('und erst recht nicht, wenn beides dagegen spricht', () => {
		expect(fragtNachPapier({ betriebsart: 'einfach', papierfrage: false })).toBe(false);
	});
});
