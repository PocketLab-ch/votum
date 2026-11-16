import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Wächter: Das Feld `auto` sendet nur der automatische Anstoss (FP-1b,
 * 12.11.2026, Kriterium 6).
 *
 * **Der Anlass.** Die Aktion `karte` löst einen Kartencode vor Beginn der
 * Versammlung nur ohne `auto` ein. Stünde das Feld auch im Formular mit dem
 * Knopf «Anmelden», käme kein Tipp mehr durch: Vor Beginn liesse sich keine
 * Karte anmelden, ohne JavaScript ebenso. Die DB-Tests bauen den Körper selbst
 * und sähen das nicht (Featureprüfung 12.11.2026).
 *
 * **Was er liest.** Die Formulare auf `?/karte` in `src/routes/z/+page.svelte`:
 * Genau eines trägt `name="auto"`, und es hat keinen Knopf; das andere hat den
 * Knopf und kein `auto`. Ob der Anstoss im Browser wirklich abgeschickt wird,
 * misst der Prüfschritt am gebauten Stand.
 */

const SEITE = readFileSync(join(__dirname, '..', '..', 'src/routes/z/+page.svelte'), 'utf8');

/** Die Formulare mit `action="?/karte"`, je mit ihrem Inhalt. */
function kartenformulare(text: string): string[] {
	return [...text.matchAll(/<form\b[^>]*action="\?\/karte"[^>]*>([\s\S]*?)<\/form>/g)].map(
		(t) => t[1]
	);
}

describe('Formulare des Kartenscans', () => {
	const formulare = kartenformulare(SEITE);

	it('gibt es genau zweimal', () => {
		expect(formulare).toHaveLength(2);
	});

	it('trägt `auto` nur im Formular ohne Knopf', () => {
		const mitAuto = formulare.filter((f) => /name="auto"/.test(f));
		expect(mitAuto).toHaveLength(1);
		expect(mitAuto[0]).not.toMatch(/<button\b/);
	});

	it('hat den Knopf «Anmelden» im Formular ohne `auto`', () => {
		const mitKnopf = formulare.filter((f) => /<button\b/.test(f));
		expect(mitKnopf).toHaveLength(1);
		expect(mitKnopf[0]).not.toMatch(/name="auto"/);
		expect(mitKnopf[0]).toMatch(/Anmelden/);
	});
});
