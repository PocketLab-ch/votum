import { describe, expect, it } from 'vitest';
import stylelint from 'stylelint';

/**
 * Der Wächter über dem Wächter.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Sind Wächter state of the art im Coding
 * oder ist das mehr ein Flickwerk?» Beim Nachsehen fiel auf: Die Wächter selbst
 * hatten keinen Test. Ein Wächter, der nach einem Umbau stillschweigend nichts
 * mehr trifft, meldet «in Ordnung» — und ist schlimmer als keiner, weil man
 * sich auf ihn verlässt.
 *
 * Geprüft wird deshalb beides: dass er den schlechten Fall **findet** und dass
 * er den guten in Ruhe lässt. Der zweite Teil ist der wichtigere: Ein Wächter,
 * der im guten Zustand rot wird, wird abgeschaltet statt gelesen.
 */
async function pruefe(code: string) {
	const ergebnis = await stylelint.lint({
		code,
		config: {
			plugins: ['./scripts/stylelint/dreieck-am-summary.mjs'],
			rules: { 'versammlung/dreieck-am-summary': true }
		}
	});
	return ergebnis.results[0].warnings;
}

describe('dreieck-am-summary', () => {
	it('findet display: flex am summary', async () => {
		const befunde = await pruefe('summary { display: flex; }');
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text).toMatch(/Dreieck/);
	});

	it('findet es auch hinter einer Klasse und in einer Liste', async () => {
		expect(await pruefe('.dritte summary { display: grid; }')).toHaveLength(1);
		expect(await pruefe('.a summary, .b p { display: block; }')).toHaveLength(1);
		expect(await pruefe('details > summary { display: inline-flex; }')).toHaveLength(1);
	});

	it('findet es auch in einer Medienabfrage', async () => {
		expect(await pruefe('@media (min-width: 40rem) { summary { display: flex; } }')).toHaveLength(1);
	});

	/*
	 * **Der Fall, den der reguläre Ausdruck nicht sah** — nachgemessen am
	 * 24.08.2026, nicht vermutet.
	 *
	 * Die erste Fassung las `([^{}]+)\{([^{}]*)\}` über die Datei. Der Rumpf
	 * darf darin keine Klammer enthalten; steht im Block eine verschachtelte
	 * Regel (`&:hover { … }`), passt das Muster nicht mehr, und der Verstoss
	 * darüber fällt lautlos heraus. Gemessen: alter Wächter 0 Befunde, neue
	 * Regel 1.
	 *
	 * CSS-Verschachtelung ist im Projekt bereits im Einsatz — der Fall ist
	 * keiner von morgen.
	 */
	it('findet es auch, wenn im selben Block eine Regel verschachtelt ist', async () => {
		expect(await pruefe('summary { display: flex; &:hover { color: red; } }')).toHaveLength(1);
	});

	it('lässt das Hausmuster in Ruhe', async () => {
		// min-height plus padding statt Flex — so steht es in `docs/gestaltung.md`.
		expect(
			await pruefe('summary { min-height: var(--ziel-min); padding: 0.5rem 0; cursor: pointer; }')
		).toHaveLength(0);
	});

	it('lässt list-item und die Rücknahmen zu', async () => {
		expect(await pruefe('summary { display: list-item; }')).toHaveLength(0);
		expect(await pruefe('summary { display: revert; }')).toHaveLength(0);
		expect(await pruefe('summary { display: unset; }')).toHaveLength(0);
	});

	it('lässt den Marker und die Kinder in Ruhe', async () => {
		// `summary::marker` gestaltet den Punkt — erwünscht. `summary > span` ist
		// ein Kind und hat mit dem Dreieck nichts zu tun.
		expect(await pruefe('summary::marker { color: red; }')).toHaveLength(0);
		expect(await pruefe('summary > span { display: flex; }')).toHaveLength(0);
		expect(await pruefe('.summary { display: flex; }')).toHaveLength(0);
	});

	/*
	 * **Der Fall, den ein Regex meldet und ein Parser nicht** — ebenfalls
	 * nachgemessen: alter Wächter 1 Befund, neue Regel 0.
	 *
	 * Ein auskommentierter Verstoss ist keiner. Ein Fehlalarm ist teurer als er
	 * aussieht: Wer zweimal einen gemeldet bekommt, der keiner war, liest den
	 * dritten nicht mehr.
	 */
	it('meldet nichts, was in einem Kommentar steht', async () => {
		expect(await pruefe('/* summary { display: flex; } */ summary { padding: 0; }')).toHaveLength(0);
	});
});
