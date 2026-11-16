import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import * as svelteParser from 'svelte-eslint-parser';
import svelte from 'eslint-plugin-svelte';
import felder from '../../scripts/eslint/felder.mjs';

/**
 * Die drei Formularfallen — der Wächter über dem Wächter.
 *
 * Geprüft wird beides: dass die Regel den schlechten Fall **findet** und dass
 * sie den guten in Ruhe lässt. Der zweite Teil ist der wichtigere — ein
 * Wächter, der im guten Zustand rot wird, wird abgeschaltet statt gelesen.
 *
 * Dazu je Regel die Fälle, an denen die alte Fassung mit regulären Ausdrücken
 * blind war. Sie sind nicht ausgedacht: Jeder ist am 24.08.2026 gegen das alte
 * Muster gemessen worden.
 */
/**
 * Eine Quelle gegen **eine** Regel prüfen — mit derselben Maschine wie die CLI.
 *
 * **Drei Vorsichtsmassnahmen, alle teuer erkauft** (24.08.2026):
 *
 *   - **`ESLint` statt `Linter`.** `Linter.verify` wendet den Prozessor nicht
 *     an; ohne ihn liefen die Regeln im Test gar nicht, und die
 *     «findet»-Fälle blieben stumm, während die «lässt in Ruhe»-Fälle grün
 *     wurden. Ein Test muss prüfen, was auch wirklich läuft.
 *   - **Der Dateiname muss mit**, sonst greift die Konfiguration nicht und
 *     ESLint fällt auf seinen Standardparser zurück: «Parsing error:
 *     Unexpected token <». Weil das **eine** Meldung ist, wurden die Fälle
 *     grün, die genau eine erwarteten — sieben von sechzehn Tests waren aus
 *     dem falschen Grund grün.
 *   - **Nur die eigenen Befunde zählen, keine Fatalmeldung durchgehen
 *     lassen.** Sonst zählt ein Parsefehler als Treffer.
 */
async function pruefe(quelltext: string, regel: string) {
	const eslint = new ESLint({
		overrideConfigFile: true,
		overrideConfig: [
			{
				files: ['**/*.svelte'],
				plugins: { svelte, versammlung: felder },
				processor: 'svelte/svelte',
				languageOptions: { parser: svelteParser },
				rules: { [`versammlung/${regel}`]: 'error' }
			}
		]
	});
	const [ergebnis] = await eslint.lintText(quelltext, { filePath: 'probe.svelte' });
	const schwer = ergebnis.messages.filter((m) => m.fatal);
	if (schwer.length > 0) throw new Error(`Die Probe liess sich nicht lesen: ${schwer[0].message}`);
	return ergebnis.messages.filter((m) => m.ruleId === `versammlung/${regel}`);
}

describe('anfangswert', () => {
	it('findet value={…} an einem freien Feld', async () => {
		expect(await pruefe('<input type="text" value={x} />', 'anfangswert')).toHaveLength(1);
		expect(await pruefe('<textarea value={x}></textarea>', 'anfangswert')).toHaveLength(1);
		expect(await pruefe('<input value={x} />', 'anfangswert')).toHaveLength(1);
	});

	it('findet defaultValue und defaultChecked', async () => {
		expect(await pruefe('<input type="text" defaultValue={x} />', 'anfangswert')).toHaveLength(1);
		expect(await pruefe('<input type="checkbox" defaultChecked />', 'anfangswert')).toHaveLength(1);
	});

	it('findet checked={…} an Ankreuzfeldern', async () => {
		expect(await pruefe('<input type="radio" checked={x} />', 'anfangswert')).toHaveLength(1);
		expect(await pruefe('<input type="checkbox" checked={x} />', 'anfangswert')).toHaveLength(1);
	});

	/*
	 * **Der Fall, an dem der reguläre Ausdruck zerbrach.** Die alte Fassung
	 * suchte `<(input|textarea)\b[^>]*>`. Ein `>` im Ausdruck beendet `[^>]*`
	 * zu früh — das Feld wurde mitten durchgeschnitten, und was danach kam, sah
	 * der Wächter nicht. Gemessen: altes Muster 0 Befunde, neue Regel 1.
	 */
	it('findet es auch, wenn im Ausdruck ein grösser-als steht', async () => {
		expect(await pruefe('<input type="text" value={a > b ? "x" : "y"} />', 'anfangswert')).toHaveLength(1);
	});

	it('lässt feste Werte in Ruhe — dort ist value kein Anfangswert', async () => {
		expect(await pruefe('<input type="text" value="fest" />', 'anfangswert')).toHaveLength(0);
		expect(await pruefe('<input type="radio" value={e.id} name="a" />', 'anfangswert')).toHaveLength(0);
	});

	it('lässt versteckte und Absendefelder in Ruhe', async () => {
		expect(await pruefe('<input type="hidden" value={x} />', 'anfangswert')).toHaveLength(0);
		expect(await pruefe('<input type="submit" value={x} />', 'anfangswert')).toHaveLength(0);
		expect(await pruefe('<input type="file" value={x} />', 'anfangswert')).toHaveLength(0);
	});

	it('lässt gebundene und ausdrücklich geführte Felder in Ruhe', async () => {
		expect(await pruefe('<input type="text" bind:value={x} />', 'anfangswert')).toHaveLength(0);
		expect(await pruefe('<input type="radio" bind:group={x} checked={y} />', 'anfangswert')).toHaveLength(0);
		expect(await pruefe('<input type="text" value={x} data-gefuehrt />', 'anfangswert')).toHaveLength(0);
	});

	it('behandelt ein Feld mit veränderlicher Art als Ankreuzfeld', async () => {
		// `/versammlungen/neu` wechselt so zwischen einer und mehreren
		// Gemeinschaften; dort trägt `value` die Kennung, nicht den Anfangswert.
		expect(
			await pruefe('<input type={mehrfach ? "checkbox" : "radio"} value={e.id} />', 'anfangswert')
		).toHaveLength(0);
	});
});

describe('keine-browserabfrage', () => {
	it('findet confirm() — auch über window', async () => {
		expect(await pruefe('<script>confirm("x");</script>', 'keine-browserabfrage')).toHaveLength(1);
		expect(await pruefe('<script>window.confirm("x");</script>', 'keine-browserabfrage')).toHaveLength(1);
	});

	/*
	 * **Der Fall, den ein Regex meldet und ein Parser nicht.** Die alte Fassung
	 * blendete Kommentare durch drei Ersetzungsläufe aus — einer je Kommentarform.
	 * Ein Wort in einer Zeichenkette blieb trotzdem stehen.
	 */
	it('meldet nichts in einem Kommentar oder einer Zeichenkette', async () => {
		expect(await pruefe('<script>// confirm("x")\n</script>', 'keine-browserabfrage')).toHaveLength(0);
		expect(await pruefe('<script>const s = "confirm(";</script>', 'keine-browserabfrage')).toHaveLength(0);
	});
});

describe('meldung-als-baustein', () => {
	it('findet eine Meldung aus form als rohen Absatz', async () => {
		expect(
			await pruefe('<p class="meldung fehler">{form.fehler.nachricht}</p>', 'meldung-als-baustein')
		).toHaveLength(1);
	});

	/*
	 * **Auch abgeleitete Namen.** Am 21.08.2026 standen auf `/z` zwei Meldungen
	 * als roher Absatz, weil die Seite `form.fehler` vorher in eine eigene
	 * Grösse legt (`const fehler = $derived(…)`).
	 */
	it('findet auch den abgeleiteten Namen', async () => {
		expect(await pruefe('<p class="meldung">{fehler}</p>', 'meldung-als-baustein')).toHaveLength(1);
		expect(await pruefe('<p class="meldung gut">{hinweis}</p>', 'meldung-als-baustein')).toHaveLength(1);
	});

	/*
	 * **Der Fall, den der reguläre Ausdruck nicht sah.** Er verlangte, dass
	 * unmittelbar nach `>` die geschweifte Klammer folgt. Steht dazwischen
	 * Markup — `<p class="meldung"><strong>Fehler:</strong> {form.fehler}</p> —,
	 * fiel die Stelle heraus. Gemessen: altes Muster 0 Befunde, neue Regel 1.
	 */
	it('findet sie auch hinter verschachteltem Markup', async () => {
		expect(
			await pruefe(
				'<p class="meldung"><strong>Fehler:</strong> {form.fehler}</p>',
				'meldung-als-baustein'
			)
		).toHaveLength(1);
	});

	it('lässt eine Meldung aus data in Ruhe', async () => {
		// Sie beschreibt einen Zustand der Sache, nicht die Antwort auf eine
		// Handlung — sie steht bei jedem Laden wieder da, und ein Schliessknopf
		// verspräche mehr, als er hält.
		expect(await pruefe('<p class="meldung">{data.hinweis}</p>', 'meldung-als-baustein')).toHaveLength(0);
		expect(
			await pruefe('<p class="meldung">{data.frist.hinweis}</p>', 'meldung-als-baustein')
		).toHaveLength(0);
	});

	it('lässt Absätze ohne die Klasse in Ruhe', async () => {
		expect(await pruefe('<p class="klein">{form.hinweis}</p>', 'meldung-als-baustein')).toHaveLength(0);
	});
});
