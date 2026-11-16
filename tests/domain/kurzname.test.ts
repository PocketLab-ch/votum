import { describe, expect, it } from 'vitest';
import { kurznamen } from '$lib/domain/kurzname';

describe('kurznamen', () => {
	it('streicht Klammerzusätze', () => {
		expect(
			kurznamen([
				'MEG Nirgendweg 3-13a (Umgebung) (Prüflauf 20260823202200)',
				'Nirgendweg 5/5a (Prüflauf 20260823202200)'
			])
		).toEqual(['MEG Nirgendweg 3-13a', 'Nirgendweg 5/5a']);
	});

	it('lässt sie stehen, wenn nur sie die Häuser unterscheiden', () => {
		/*
		 * Der Fall, für den die Regel da ist: Zwei gleich beschriftete Spalten an
		 * der Wand, und jemand rechnet die Zahlen des Nachbarhauses auf seine
		 * eigene Abstimmung an.
		 */
		const namen = ['Nirgendweg 5/5a', 'Nirgendweg 5/5a (Umgebung)'];
		expect(kurznamen(namen)).toEqual(namen);
	});

	it('kommt mit einem Namen aus lauter Klammern zurecht', () => {
		expect(kurznamen(['(Umgebung)'])).toEqual(['(Umgebung)']);
	});

	it('lässt Namen ohne Zusatz unverändert', () => {
		expect(kurznamen(['Haus A', 'Haus B'])).toEqual(['Haus A', 'Haus B']);
	});
});
