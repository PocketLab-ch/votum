import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import * as svelteParser from 'svelte-eslint-parser';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';
import felder from '../../scripts/eslint/felder.mjs';

/**
 * Der Wächter über `open={…}` und `bind:open` am `<details>` — und sein
 * Gegentest.
 *
 * **Der Anlass** (26.08.2026, gemessen mit angehaltenem Skript). `open={…}` ist
 * ein gewöhnliches Attribut, und Svelte setzt es bei der Hydration erneut. Es
 * merkt sich zwar den vorgefundenen Wert, vergleicht ihn aber mit dem Ausdruck
 * — und `''` (der Browser hat aufgeklappt) ist nicht `false` (der Server sagte
 * «zu»). Also schreibt Svelte `element.open = false`, und der Kasten klappt vor
 * den Augen des Benutzers wieder zu. `bind:open` ist dieselbe Falle ohne
 * Bremse: `bind_property` schreibt `element.open = get()` ohne jede Prüfung.
 *
 * Der Durchstich `e2e/ausklapper-vor-hydration.mjs` misst, dass der Weg heraus
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
				 */
				rules: {
					'versammlung/gefuehrter-ausklapper': 'error',
					'svelte/comment-directive': 'error'
				}
			}
		]
	});
	const [ergebnis] = await eslint.lintText(quelltext, { filePath: dateiname });
	const schwer = ergebnis.messages.filter((m) => m.fatal);
	if (schwer.length > 0) throw new Error(`Die Probe liess sich nicht lesen: ${schwer[0].message}`);
	return ergebnis.messages.filter((m) => m.ruleId === 'versammlung/gefuehrter-ausklapper');
}

describe('gefuehrter-ausklapper', () => {
	it('findet open={…} an einem <details>', async () => {
		const befunde = await pruefe('<details open={offen}><summary>A</summary></details>');
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/Hydration/);
		expect(befunde[0].message).toMatch(/aufgeklappt/);
	});

	it('findet bind:open — dieselbe Falle ohne Bremse', async () => {
		const befunde = await pruefe('<details bind:open={offen}><summary>A</summary></details>');
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/bind:open/);
	});

	it('findet die Kurzform {open} — einer der Wege, auf denen man sonst vorbeikäme', async () => {
		expect(await pruefe('<details {open}><summary>A</summary></details>')).toHaveLength(1);
	});

	/*
	 * **Der zweite Weg vorbei** (26.08.2026, aus dem Code-Review): Ein Objekt an
	 * Ort und Stelle in den Spread. Die erste Fassung der Regel liess ihn durch —
	 * gemessen, nicht vermutet.
	 */
	it('findet ein open in einem Spread an Ort und Stelle', async () => {
		const befunde = await pruefe('<details {...{ open: offen }}><summary>A</summary></details>');
		expect(befunde).toHaveLength(1);
		expect(befunde[0].message).toMatch(/Spread/);
	});

	it('findet es auch, wenn der Schlüssel in Anführungszeichen steht', async () => {
		expect(
			await pruefe('<details {...{ \'open\': offen }}><summary>A</summary></details>')
		).toHaveLength(1);
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
				'<details\n\tclass="angaben"\n\topen={form?.quelle === \'archiv\'}\n><summary>A</summary></details>'
			)
		).toHaveLength(1);
	});

	it('lässt den richtigen Weg in Ruhe', async () => {
		expect(
			await pruefe(
				'<details class="berichtigen" {...aufgeklappt(form?.fehler?.feld === \'name\')}>' +
					'<summary>A</summary></details>'
			)
		).toHaveLength(0);
	});

	/*
	 * **Ein festes `open` ist kein Zustand.** `<details open>` fängt immer offen
	 * an; da gibt es nichts, was Svelte zurückschreiben könnte. Wer das meldete,
	 * meldete Richtiges — und ein Wächter, der Richtiges meldet, wird
	 * abgeschaltet statt gelesen.
	 */
	it('lässt ein festes open in Ruhe', async () => {
		expect(await pruefe('<details open><summary>A</summary></details>')).toHaveLength(0);
	});

	it('lässt einen Ausklapper ohne open in Ruhe — der Normalfall im Bestand', async () => {
		expect(
			await pruefe('<details class="erklaerung"><summary>Was heisst das?</summary><p>…</p></details>')
		).toHaveLength(0);
	});

	it('lässt bind:this in Ruhe — das bindet den Knoten, nicht den Zustand', async () => {
		expect(await pruefe('<details bind:this={kasten}><summary>A</summary></details>')).toHaveLength(
			0
		);
	});

	it('lässt open={…} an einem anderen Element in Ruhe', async () => {
		// Ein `<dialog>` wird mit `open` ausgeliefert, damit die Frage auch ohne
		// JavaScript stehen bleibt (`Rueckfragefenster.svelte`, docs/gestaltung.md).
		// Dort gibt es kein `<summary>`, das jemand vor der Hydration anklicken
		// könnte — die Falle dieser Regel gibt es dort nicht.
		expect(await pruefe('<dialog class="rueckfrage" open={offen}><p>A</p></dialog>')).toHaveLength(
			0
		);
	});

	/*
	 * **Die begründete Ausnahme.** Es gibt heute keine — aber sie muss sich
	 * anbringen lassen, sonst wird der Wächter beim ersten Sonderfall
	 * abgeschaltet statt gelesen. Geprüft wird beides an derselben Quelle: mit
	 * Vermerk still, ohne Vermerk rot.
	 */
	const mitVermerk =
		'<!-- Ausnahme, weil … -->\n' +
		'<!-- eslint-disable-next-line versammlung/gefuehrter-ausklapper -->\n' +
		'<details open={offen}><summary>A</summary></details>';

	it('lässt eine Stelle mit Vermerk stehen', async () => {
		expect(await pruefe(mitVermerk)).toHaveLength(0);
	});

	it('greift an derselben Stelle, sobald der Vermerk fehlt', async () => {
		const ohne = mitVermerk.replace(
			'<!-- eslint-disable-next-line versammlung/gefuehrter-ausklapper -->\n',
			''
		);
		expect(await pruefe(ohne)).toHaveLength(1);
	});

	/*
	 * ── Die Sichtprobe an echtem Markup ──────────────────────────────────
	 *
	 * Drei wirkliche Dateien, alle am 26.08.2026 umgestellt: der einzeilige Tag,
	 * der mehrzeilige und die eine Stelle, die vorher `bind:open` trug. Sie
	 * müssen still sein — und rot werden, sobald der alte Weg zurückkommt. Fiele
	 * der Wächter nach einem Umbau an diesen Dateien vorbei, wäre der zweite Teil
	 * grün, und das fiele auf.
	 */
	const echt = [
		{
			pfad: 'src/routes/versammlungen/[id=kennung]/+page.svelte',
			richtig: '{...aufgeklappt(angesprungen)}',
			zurueckgebaut: 'open={angesprungen}'
		},
		/*
		 * **Umgezogen am 27.08.2026.** Die Ausklapper der Eigentümerzeile standen
		 * bis dahin in der Kopfzelle der Tabelle; seit «ein Einstieg je Zeile»
		 * stehen sie auf der Seite der Zeile. Der Wächter prüft die Stelle
		 * weiterhin an ihrem neuen Ort — eine Sichtprobe, die auf eine Datei
		 * zeigt, in der es nichts mehr zu sehen gibt, wäre still.
		 */
		{
			pfad: 'src/routes/gemeinschaften/[id=kennung]/eigentuemer/[partei=kennung]/+page.svelte',
			richtig:
				"{...aufgeklappt(form?.quelle === 'vertretung' && form.parteiId === zeile.partyId)}",
			zurueckgebaut: "open={form?.quelle === 'vertretung' && form.parteiId === zeile.partyId}"
		},
		/*
		 * Die Stelle, an der `bind:open` stand — als «Anfangswert, nicht
		 * Dauerwert» gedacht und genau deshalb dieselbe Falle. Sie steht hier,
		 * damit der Rückbau in **diese** Richtung ebenfalls auffällt.
		 */
		{
			pfad: 'src/lib/components/Stimmerfassung.svelte',
			richtig: '{...aufgeklappt(erfassungOffen)}',
			zurueckgebaut: 'bind:open={erfassungOffen}'
		}
	];

	for (const datei of echt) {
		it(`lässt ${datei.pfad} in Ruhe`, async () => {
			const quelle = readFileSync(datei.pfad, 'utf-8');
			expect(quelle).toContain(datei.richtig);
			expect(await pruefe(quelle, datei.pfad)).toHaveLength(0);
		});

		it(`greift an ${datei.pfad}, sobald der alte Weg zurückkommt`, async () => {
			const zurueck = readFileSync(datei.pfad, 'utf-8').replace(
				datei.richtig,
				datei.zurueckgebaut
			);
			expect(await pruefe(zurueck, datei.pfad)).toHaveLength(1);
		});
	}
});
