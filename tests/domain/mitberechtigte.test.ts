import { describe, expect, it } from 'vitest';
import { pruefeMitberechtigte, sammelname } from '$lib/domain/mitberechtigte';
import { FachlicherFehler } from '$lib/domain/fehler';

describe('Der Sammelname', () => {
	it('verbindet zwei Namen mit «und»', () => {
		expect(sammelname(['Anna Muster', 'Beat Muster'])).toBe('Anna Muster und Beat Muster');
	});

	it('reiht drei und mehr mit Kommas und einem «und» am Schluss', () => {
		expect(sammelname(['Anna Muster', 'Beat Muster', 'Cora Muster'])).toBe(
			'Anna Muster, Beat Muster und Cora Muster'
		);
	});

	it('lässt einen einzelnen Namen stehen', () => {
		expect(sammelname(['Anna Muster'])).toBe('Anna Muster');
	});
});

describe('Die Prüfung', () => {
	it('verlangt mindestens zwei Mitberechtigte', () => {
		// Eine Hülle mit einer Person ist keine Gemeinschaft, sondern eine
		// gewöhnliche Eigentümerzeile mit einem irreführenden Haken.
		expect(() => pruefeMitberechtigte(['Anna Muster'], 'Anna Muster')).toThrow(FachlicherFehler);
	});

	/*
	 * **Freiwillig seit dem 27.08.2026** (Produktentscheid). Ist nur einer der
	 * Mitberechtigten anwesend, darf die Sitzungsleitung annehmen, dass er die
	 * Gemeinschaft gültig vertritt, ohne Vollmacht (Wermelinger, Rz. 19 ad
	 * Art. 712o). Ein Pflichtfeld zwänge die Bewirtschaftung, etwas zu erfinden.
	 */
	it('lässt die Vertretung offen', () => {
		expect(() => pruefeMitberechtigte(['Anna Muster', 'Beat Muster'], null)).not.toThrow();
		expect(() => pruefeMitberechtigte(['Anna Muster', 'Beat Muster'], '  ')).not.toThrow();
	});

	it('verlangt, dass der Vertreter einer der Mitberechtigten ist', () => {
		expect(() => pruefeMitberechtigte(['Anna Muster', 'Beat Muster'], 'Cora Muster')).toThrow(
			/gehört nicht/
		);
	});

	/*
	 * **Produktentscheid 26.08.2026.** Zweimal derselbe Name ergäbe den
	 * Sammelnamen «Anna Muster und Anna Muster», und `representative_name`
	 * benennt dann nicht mehr eindeutig, wer stimmt. Zwei Menschen dürfen gleich
	 * heissen — die Anwendung braucht nur einen unterscheidbaren Eintrag, und
	 * die Absage muss das auch sagen.
	 */
	it('weist zwei gleiche Namen ab', () => {
		expect(() => pruefeMitberechtigte(['Anna Muster', 'Anna Muster'], 'Anna Muster')).toThrow(
			FachlicherFehler
		);
	});

	it('nennt im Satz den Ausweg', () => {
		try {
			pruefeMitberechtigte(['Anna Muster', 'Anna Muster'], 'Anna Muster');
			throw new Error('Hätte absagen müssen');
		} catch (fehler) {
			expect((fehler as FachlicherFehler).kennung).toBe('name_doppelt');
			expect((fehler as Error).message).toMatch(/Muster-Berger/);
			expect((fehler as Error).message).toMatch(/1965/);
		}
	});

	it('sieht auch die Schreibweise mit zwei Leerzeichen als denselben Namen', () => {
		// Auf dem Bildschirm stünde zweimal dasselbe — das ist keine
		// Unterscheidung, sondern ein Tippfehler.
		expect(() => pruefeMitberechtigte(['Anna  Muster', 'Anna Muster'], 'Anna Muster')).toThrow(
			FachlicherFehler
		);
	});

	it('lässt zwei ähnliche, aber verschiedene Namen durch', () => {
		expect(() =>
			pruefeMitberechtigte(['Anna Muster', 'Anna Muster-Berger'], 'Anna Muster')
		).not.toThrow();
	});

	it('lässt den gültigen Fall durch', () => {
		expect(() =>
			pruefeMitberechtigte(['Anna Muster', 'Beat Muster'], 'Anna Muster')
		).not.toThrow();
	});
});
