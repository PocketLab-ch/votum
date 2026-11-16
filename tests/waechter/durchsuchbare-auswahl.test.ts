import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import * as svelteParser from 'svelte-eslint-parser';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';
import felder, { SUCHSCHWELLE as SCHWELLE_IM_WAECHTER } from '../../scripts/eslint/felder.mjs';
import { SUCHSCHWELLE } from '$lib/domain/listensuche';

/**
 * Der Wächter über die durchsuchbaren Auswahlfelder — und sein Gegentest.
 *
 * **Der Anlass** (Auftraggeber, 26.08.2026): «Bei Eigentümer fehlt die Möglichkeit nach
 * Einheit zu suchen. Im Dropdown muss dann gescrollt werden. Prüfe bei allen
 * Dropdown ob die Suchfunktion hinterlegt ist.» Die Antwort darauf ist nicht
 * das eine Feld, sondern die Klasse: Kein Auswahlfeld über der Schwelle steht
 * ohne Suche da, auch das nächste nicht, das jemand anlegt.
 *
 * Geprüft wird beides — dass der Wächter den schlechten Fall **findet** und
 * dass er den guten in Ruhe lässt. Der zweite Teil ist der wichtigere: Ein
 * Wächter, der im guten Zustand rot wird, wird abgeschaltet statt gelesen.
 *
 * Dazu die **Sichtprobe an echtem Markup** (unten): Ein Wächter, der nur gegen
 * ausgedachte Schnipsel läuft, kann an der wirklichen Datei vorbeigreifen und
 * bleibt trotzdem grün.
 */
async function pruefe(quelltext: string, dateiname = 'probe.svelte') {
	const eslint = new ESLint({
		overrideConfigFile: true,
		overrideConfig: [
			{
				files: ['**/*.svelte'],
				plugins: { svelte, versammlung: felder },
				processor: 'svelte/svelte',
				/*
				 * **Der TypeScript-Parser muss mit.** Die Sichtprobe unten liest eine
				 * wirkliche Datei, und die trägt `<script lang="ts">`; ohne ihn endet
				 * der Lauf in «Parsing error: Unexpected token» — und weil das **eine**
				 * Meldung ist, wäre ein Fall, der genau eine erwartet, aus dem falschen
				 * Grund grün.
				 */
				languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } },
				/*
				 * `comment-directive` muss mit: Ohne diese Regel ist ein
				 * `<!-- eslint-disable-next-line … -->` in einer Svelte-Vorlage ein
				 * gewöhnlicher HTML-Kommentar, und die begründete Ausnahme in
				 * `Erfordernisauswahl.svelte` wirkte im Test nicht — der Fall unten
				 * wäre dann aus dem falschen Grund rot.
				 */
				rules: {
					'versammlung/durchsuchbare-auswahl': 'error',
					'svelte/comment-directive': 'error'
				}
			}
		]
	});
	const [ergebnis] = await eslint.lintText(quelltext, { filePath: dateiname });
	const schwer = ergebnis.messages.filter((m) => m.fatal);
	if (schwer.length > 0) throw new Error(`Die Probe liess sich nicht lesen: ${schwer[0].message}`);
	return ergebnis.messages.filter((m) => m.ruleId === 'versammlung/durchsuchbare-auswahl');
}

/** Ein `<select>` mit so vielen fest aufgezählten Einträgen. */
function mitFestenEintraegen(anzahl: number) {
	const optionen = Array.from({ length: anzahl }, (_, i) => `<option value="${i}">${i}</option>`);
	return `<select name="x">${optionen.join('')}</select>`;
}

describe('durchsuchbare-auswahl', () => {
	it('findet ein Auswahlfeld, dessen Einträge aus dem Bestand kommen', async () => {
		const befunde = await pruefe(
			'<select name="unitId">{#each einheiten as e}<option value={e.id}>{e.label}</option>{/each}</select>'
		);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/Suchauswahl/);
	});

	/*
	 * Die Fälle, an denen ein Muster über den Dateitext vorbeigriffe: Die
	 * Einträge stehen eine oder zwei Ebenen tiefer, in einer Gruppe oder hinter
	 * einer Bedingung. Beides kommt im Bestand vor — `/personen/<id>` gruppiert
	 * nach Gemeinschaft, `/quorum` blendet die Bezugsgrösse bedingt ein.
	 */
	it('findet sie auch in einer Gruppe und hinter einer Bedingung', async () => {
		expect(
			await pruefe(
				'<select name="a"><optgroup label="g">{#each e as x}<option value={x}>{x}</option>{/each}</optgroup></select>'
			)
		).toHaveLength(1);
		expect(
			await pruefe(
				'<select name="a">{#if da}{#each e as x}<option value={x}>{x}</option>{/each}{/if}</select>'
			)
		).toHaveLength(1);
		expect(
			await pruefe(
				'<select name="a">{#if leer}<option value="">—</option>{:else}{#each e as x}<option value={x}>{x}</option>{/each}{/if}</select>'
			)
		).toHaveLength(1);
	});

	/*
	 * **Die Schreibweise, mit der man den Wächter sonst umgeht** (26.08.2026, aus
	 * dem Code-Review). Der Schnipsel steht anderswo; ob seine Einträge aus dem
	 * Bestand kommen, sieht die Regel an dieser Stelle nicht. Sie lässt ihn
	 * deshalb nicht durch.
	 */
	it('findet ein Auswahlfeld, dessen Einträge aus einem Schnipsel kommen', async () => {
		const befunde = await pruefe(
			'{#snippet eintraege()}<option value="a">A</option>{/snippet}<select name="a">{@render eintraege()}</select>'
		);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/Schnipsel/);
	});

	it('findet ein Auswahlfeld mit zu vielen fest aufgezählten Einträgen', async () => {
		const befunde = await pruefe(mitFestenEintraegen(SUCHSCHWELLE + 1));
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(new RegExp(String(SUCHSCHWELLE)));
	});

	it('lässt eine kurze feste Aufzählung in Ruhe', async () => {
		// Der Normalfall im Bestand: zwei bis drei Werte, die das Gesetz oder das
		// Programm vorgibt — «ordentlich / ausserordentlich».
		expect(
			await pruefe(
				'<select name="art"><option value="erste">Erstversammlung</option><option value="zweite">Zweitversammlung</option></select>'
			)
		).toHaveLength(0);
		expect(await pruefe(mitFestenEintraegen(SUCHSCHWELLE))).toHaveLength(0);
	});

	it('lässt den Baustein in Ruhe', async () => {
		expect(
			await pruefe('<Suchauswahl name="unitId" beschriftung="Einheit" eintraege={liste} />')
		).toHaveLength(0);
	});

	it('lässt Suchauswahl.svelte selbst in Ruhe — sie ist genau dieser Bau', async () => {
		const quelle = '<select name="x">{#each e as x}<option value={x}>{x}</option>{/each}</select>';
		expect(await pruefe(quelle, 'Suchauswahl.svelte')).toHaveLength(0);
		expect(await pruefe(quelle, 'anderes.svelte')).toHaveLength(1);
	});

	it('hält dieselbe Schwelle wie der Baustein', () => {
		// Zwei Zahlen an zwei Orten laufen auseinander, sobald eine davon jemand
		// ändert. Der Wächter kann `$lib/domain/listensuche` nicht einbinden, er läuft als
		// `.mjs` neben ESLint —, also vergleicht der Test.
		expect(SCHWELLE_IM_WAECHTER).toBe(SUCHSCHWELLE);
	});

	/*
	 * ── Die Sichtprobe an echtem Markup ──────────────────────────────────
	 *
	 * `Erfordernisauswahl.svelte` ist die **eine** begründete Ausnahme: Sie sucht
	 * zusätzlich in den Beispielen des Regelwerks, was der gemeinsame Baustein
	 * nicht kann. Sie trägt dafür ein `eslint-disable-next-line`.
	 *
	 * Beides wird hier an der wirklichen Datei geprüft — mit Kommentar still, ohne
	 * Kommentar rot. Fiele der Wächter nach einem Umbau an dieser Datei vorbei,
	 * wäre der zweite Teil grün, und das fiele auf.
	 */
	const ausnahme = 'src/lib/components/Erfordernisauswahl.svelte';

	it('lässt die begründete Ausnahme stehen', async () => {
		const quelle = readFileSync(ausnahme, 'utf-8');
		expect(quelle).toContain('eslint-disable-next-line versammlung/durchsuchbare-auswahl');
		expect(await pruefe(quelle, 'Erfordernisauswahl.svelte')).toHaveLength(0);
	});

	it('greift an derselben Datei, sobald die Ausnahme fehlt', async () => {
		const ohne = readFileSync(ausnahme, 'utf-8').replace(
			'<!-- eslint-disable-next-line versammlung/durchsuchbare-auswahl -->\n',
			''
		);
		expect(await pruefe(ohne, 'Erfordernisauswahl.svelte')).toHaveLength(1);
	});
});
