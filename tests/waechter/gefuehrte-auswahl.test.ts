import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import * as svelteParser from 'svelte-eslint-parser';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';
import felder from '../../scripts/eslint/felder.mjs';

/**
 * Der Wächter über `bind:value` am `<select>` — und sein Gegentest.
 *
 * **Der Anlass** (26.08.2026, gemessen mit angehaltenem Skript). `bind:value`
 * an einem Auswahlfeld lässt Svelte beim Aufbau den gebundenen Wert in das Feld
 * zurückschreiben. Wer wählt, bevor das Skript geladen ist — im Saal auf einem
 * fremden Telefon der Normalfall, nicht der Ausreisser —, verliert seine Wahl
 * wortlos: Das Feld steht wieder auf dem Anfangswert, das Formular ist
 * unvollständig, und der Knopf tut beim Drücken nichts.
 *
 * Der Durchstich `e2e/wahl-vor-hydration.mjs` misst, dass der Weg heraus
 * wirklich trägt. Dieser Test prüft das andere Ende: dass niemand den alten Weg
 * unbemerkt zurückbringt.
 *
 * Geprüft wird beides — dass der Wächter den schlechten Fall **findet** und
 * dass er den guten in Ruhe lässt. Dazu die **Sichtprobe an echtem Markup**
 * (unten): Ein Wächter, der nur gegen ausgedachte Schnipsel läuft, kann an der
 * wirklichen Datei vorbeigreifen und bleibt trotzdem grün.
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
				 * **Der TypeScript-Parser muss mit.** Die Sichtprobe unten liest
				 * wirkliche Dateien, und die tragen `<script lang="ts">`; ohne ihn endet
				 * der Lauf in «Parsing error: Unexpected token» — und weil das **eine**
				 * Meldung ist, wäre ein Fall, der genau eine erwartet, aus dem falschen
				 * Grund grün.
				 */
				languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } },
				/*
				 * `comment-directive` muss mit, sonst ist ein
				 * `<!-- eslint-disable-next-line … -->` in einer Svelte-Vorlage ein
				 * gewöhnlicher HTML-Kommentar und die Ausnahme unten wirkte nicht.
				 * `durchsuchbare-auswahl` steht mit im Satz, weil die echten Dateien
				 * eine Ausnahme **für jene** Regel tragen — ohne sie wäre deren
				 * Kommentar hier eine unbekannte Regel.
				 */
				rules: {
					'versammlung/gefuehrte-auswahl': 'error',
					'versammlung/durchsuchbare-auswahl': 'error',
					'svelte/comment-directive': 'error'
				}
			}
		]
	});
	const [ergebnis] = await eslint.lintText(quelltext, { filePath: dateiname });
	const schwer = ergebnis.messages.filter((m) => m.fatal);
	if (schwer.length > 0) throw new Error(`Die Probe liess sich nicht lesen: ${schwer[0].message}`);
	return ergebnis.messages.filter((m) => m.ruleId === 'versammlung/gefuehrte-auswahl');
}

describe('gefuehrte-auswahl', () => {
	it('findet bind:value an einem <select>', async () => {
		const befunde = await pruefe(
			'<select name="art" bind:value={art}><option value="a">A</option></select>'
		);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/Hydration/);
		expect(befunde[0].message).toMatch(/gefuehrteWahl/);
	});

	/*
	 * Der Tag steht im Bestand über mehrere Zeilen — gemeldet wird deshalb am
	 * Tag und nicht am Attribut, sonst liesse sich eine Ausnahme nirgends
	 * anbringen (dieselbe Lehre wie bei `anfangswert`). Hier wird geprüft, dass
	 * der Wächter die mehrzeilige Schreibweise überhaupt sieht.
	 */
	it('findet es auch in einem mehrzeiligen Tag', async () => {
		expect(
			await pruefe(
				'<select\n\tname="art"\n\tbind:value={art}\n\trequired\n><option value="a">A</option></select>'
			)
		).toHaveLength(1);
	});

	it('findet value={…} am <select> — derselbe Weg mit einer Richtung weniger', async () => {
		const befunde = await pruefe(
			'<select name="art" value={art}><option value="a">A</option></select>'
		);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/value=\{…\}/);
	});

	it('findet die Kurzform {value} — der eine Weg, auf dem man sonst vorbeikäme', async () => {
		const befunde = await pruefe('<select name="art" {value}><option value="a">A</option></select>');
		expect(befunde).toHaveLength(1);
	});

	/*
	 * **Die halbe Behebung.** `selected` an der Option und ein `onchange`, das
	 * den Wert festhält, sieht richtig aus und verliert genauso viel: Der
	 * `change` vor der Hydration erreicht keinen Zuhörer. Ohne diesen Fall
	 * schlösse der Wächter nur die auffälligste Instanz, nicht die Klasse.
	 */
	it('findet ein onchange, das den Wert festhält, ohne use:gefuehrteWahl', async () => {
		const befunde = await pruefe(
			'<select name="art" onchange={(e) => (art = e.currentTarget.value)}>' +
				'<option value="a" selected={art === "a"}>A</option></select>'
		);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/gefuehrteWahl/);
	});

	/*
	 * **Und die Schreibweise, mit der man sonst vorbeikäme** (26.08.2026, aus
	 * dem Code-Review): Ein Aufruf statt einer Zuweisung. Genau so stand es bis
	 * an diesem Tag in `Suchauswahl.svelte` — wer dort abschaut und die
	 * Nachholung aus `onMount` weglässt, schreibt sie. Ein Wächter, der nur die
	 * Zuweisung sucht, sieht das nicht.
	 */
	it('findet auch ein onchange, das den Wert einer Funktion übergibt', async () => {
		expect(
			await pruefe(
				'<select name="art" onchange={(e) => uebernehmen(e.currentTarget.value)}>' +
					'<option value="a">A</option></select>'
			)
		).toHaveLength(1);
	});

	it('lässt ein onchange in Ruhe, das nur abschickt', async () => {
		// Im Bestand an vier Stellen: Die Wahl geht mit dem Formular an den
		// Server, das Programm hält nichts fest — dann ist nichts zu holen.
		expect(
			await pruefe(
				'<select name="grund" onchange={(e) => e.currentTarget.form?.requestSubmit()}>' +
					'<option value="a">A</option></select>'
			)
		).toHaveLength(0);
	});

	it('findet ein onchange, das festhält UND abschickt', async () => {
		// Die Ausnahme gilt dem Abschicken allein. Wer daneben zuweist, hält den
		// Wert fest — und verliert die frühe Wahl wie jeder andere auch.
		expect(
			await pruefe(
				'<select name="art" onchange={(e) => { art = e.currentTarget.value; e.currentTarget.form?.requestSubmit(); }}>' +
					'<option value="a">A</option></select>'
			)
		).toHaveLength(1);
	});

	it('lässt ein onchange neben use:gefuehrteWahl in Ruhe', async () => {
		expect(
			await pruefe(
				'<select name="art" use:gefuehrteWahl={(w) => (art = w)} onchange={() => (offen = true)}>' +
					'<option value="a">A</option></select>'
			)
		).toHaveLength(0);
	});

	it('lässt den richtigen Weg in Ruhe', async () => {
		expect(
			await pruefe(
				'<select name="art" bind:this={feld} use:gefuehrteWahl={(w) => (art = w)}>' +
					'<option value="a" selected={art === "a"}>A</option></select>'
			)
		).toHaveLength(0);
	});

	it('lässt bind:this in Ruhe — das bindet den Knoten, nicht den Wert', async () => {
		expect(
			await pruefe('<select name="art" bind:this={feld}><option value="a">A</option></select>')
		).toHaveLength(0);
	});

	it('lässt den Baustein in Ruhe', async () => {
		// `<Suchauswahl bind:wert={…}/>` ist kein `<select>`; der Baustein löst die
		// Falle selbst, und genau dafür gibt es ihn.
		expect(
			await pruefe('<Suchauswahl name="unitId" beschriftung="Einheit" bind:wert={gewaehlt} />')
		).toHaveLength(0);
	});

	it('lässt ein festes Auswahlfeld ohne Bindung in Ruhe', async () => {
		// Der Normalfall im Bestand: Der Wert wird nur abgeschickt, niemand liest
		// ihn im Programm. Dort ist nichts zu tun.
		expect(
			await pruefe(
				'<select name="art" required><option value="a" selected>A</option><option value="b">B</option></select>'
			)
		).toHaveLength(0);
	});

	/*
	 * **Die begründete Ausnahme.** Es gibt heute keine — aber sie muss sich
	 * anbringen lassen, sonst wird der Wächter beim ersten Sonderfall
	 * abgeschaltet statt gelesen. Geprüft wird beides an derselben Quelle: mit
	 * Vermerk still, ohne Vermerk rot.
	 */
	const mitVermerk =
		'<!-- Ausnahme, weil … -->\n' +
		'<!-- eslint-disable-next-line versammlung/gefuehrte-auswahl -->\n' +
		'<select name="art" bind:value={art}><option value="a">A</option></select>';

	it('lässt eine Stelle mit Vermerk stehen', async () => {
		expect(await pruefe(mitVermerk)).toHaveLength(0);
	});

	it('greift an derselben Stelle, sobald der Vermerk fehlt', async () => {
		const ohne = mitVermerk.replace(
			'<!-- eslint-disable-next-line versammlung/gefuehrte-auswahl -->\n',
			''
		);
		expect(await pruefe(ohne)).toHaveLength(1);
	});

	/*
	 * ── Die Sichtprobe an echtem Markup ──────────────────────────────────
	 *
	 * Zwei wirkliche Dateien, beide am 26.08.2026 umgestellt: eine Komponente mit
	 * Einträgen aus dem Bestand und eine mit zwei festen Auswahlfeldern. Sie
	 * müssen still sein — und rot werden, sobald `bind:value` zurückkommt. Fiele
	 * der Wächter nach einem Umbau an diesen Dateien vorbei, wäre der zweite Teil
	 * grün, und das fiele auf.
	 */
	const echt = [
		{
			pfad: 'src/lib/components/Erfordernisauswahl.svelte',
			richtig: '<select {name} bind:this={feld} use:gefuehrteWahl={uebernehmen}>',
			zurueckgebaut: '<select {name} bind:value={wert}>'
		},
		{
			pfad: 'src/lib/components/TraktandumAufnehmen.svelte',
			richtig: 'use:gefuehrteWahl={(w) => (spontanart = w === \'folgeantrag\' ? \'folgeantrag\' : \'neu\')}',
			zurueckgebaut: 'bind:value={spontanart}'
		},
		/*
		 * Der Baustein selbst: Seit dem 26.08.2026 geht auch er über dieselbe
		 * Aktion, statt die frühe Wahl in `onMount` nachzuholen. Ein Weg statt
		 * zwei — sonst schreibt der Nächste die Hälfte ab.
		 */
		{
			pfad: 'src/lib/components/Suchauswahl.svelte',
			richtig: 'use:gefuehrteWahl={uebernehmen}',
			zurueckgebaut: 'bind:value={wert}'
		}
	];

	for (const datei of echt) {
		it(`lässt ${datei.pfad} in Ruhe`, async () => {
			const quelle = readFileSync(datei.pfad, 'utf-8');
			expect(quelle).toContain(datei.richtig);
			expect(await pruefe(quelle, datei.pfad)).toHaveLength(0);
		});

		it(`greift an ${datei.pfad}, sobald bind:value zurückkommt`, async () => {
			const zurueck = readFileSync(datei.pfad, 'utf-8').replace(
				datei.richtig,
				datei.zurueckgebaut
			);
			expect(await pruefe(zurueck, datei.pfad)).toHaveLength(1);
		});
	}
});
