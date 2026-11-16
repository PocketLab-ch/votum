import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import felder from './scripts/eslint/felder.mjs';

/**
 * ESLint — der Wächter über Markup und Skript.
 *
 * waechtername-historisch: Dieser Absatz erklärt die Ablösung; der alte Name
 * ist sein Gegenstand.
 *
 * **Warum es ihn gibt** (24.08.2026). Bis dahin hatte das Projekt keinen
 * Linter; die Regeln über Formulare standen als selbstgeschriebenes Skript mit
 * regulären Ausdrücken da (`scripts/check-felder.mjs`). Ein Regex über eine
 * `.svelte`-Datei kennt den Unterschied zwischen Kommentar, Zeichenkette und
 * Ausdruck nicht: `value={a > b}` schnitt das Feld mitten durch, weil `[^>]*`
 * am ersten `>` endet.
 *
 * **Bewusst schmal.** Aufgenommen wird, was eine **Falle** schliesst, nicht was
 * einen Geschmack durchsetzt. Ein Regelsatz mit vierhundert Befunden über
 * Anführungszeichen und Reihenfolge verdeckt den einen Befund, auf den es
 * ankommt — und wird nach der zweiten Woche mit `--no-verify` umgangen.
 */
export default ts.config(
	{
		ignores: [
			'node_modules/**',
			'build/**',
			'.svelte-kit/**',
			'static/**',
			'entpackt/**',
			'daten/**'
		]
	},
	js.configs.recommended,

	/*
	 * **Zwei Regeln aus `recommended`, die hier im guten Zustand rot werden.**
	 * Ein Wächter, der Richtiges meldet, wird abgeschaltet statt gelesen —
	 * deshalb genau hier entschärft und nicht dort, wo er trifft.
	 */
	{
		rules: {
			/*
			 * Meldete fünf Stellen, keine davon ein Fehler: ein vorsichtiger
			 * Anfangswert vor einem `try` («nicht_erreichbar»), ein `y`, das nach
			 * einem Seitenumbruch den Kopf der neuen Seite festhält. Beide sagen
			 * etwas über die Absicht; sie zu streichen machte den Code ärmer.
			 */
			'no-useless-assignment': 'off',
			/*
			 * Die «unregelmässigen Leerzeichen» waren dreimal die
			 * Byte-Reihenfolge-Marke in einem regulären Ausdruck, mit der Excel
			 * seine CSV beginnt — genau das, was dort weggeschnitten werden soll.
			 * In Code und Zeichenketten bleibt die Regel scharf.
			 */
			'no-irregular-whitespace': [
				'error',
				{ skipRegExps: true, skipComments: true, skipTemplates: true }
			]
		}
	},

	/* ── Die Formularfallen, in jeder Svelte-Datei ───────────────────────── */
	{
		files: ['**/*.svelte'],
		// `ts.plugin` mit dabei, damit Ausnahmen wie
		// `@typescript-eslint/no-explicit-any` im Markup aufgelöst werden können —
		// sonst meldet ESLint «Definition for rule … was not found».
		plugins: { svelte, '@typescript-eslint': ts.plugin, versammlung: felder },
		/*
		 * **Der Prozessor macht die Ausnahmen im Markup wirksam.** Ohne ihn ist
		 * ein `<!-- eslint-disable-next-line … -->` ein gewöhnlicher
		 * HTML-Kommentar, und `svelte/comment-directive` sieht ihn nicht.
		 * Nachgemessen an einer Probedatei: mit Kommentar zwei Befunde, ohne
		 * Prozessor genauso viele.
		 */
		processor: 'svelte/svelte',
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: ts.parser },
			globals: { ...globals.browser }
		},
		rules: {
			'versammlung/anfangswert': 'error',
			'versammlung/keine-browserabfrage': 'error',
			'versammlung/meldung-als-baustein': 'error',
			'versammlung/durchsuchbare-auswahl': 'error',
			'versammlung/gefuehrte-auswahl': 'error',
			'versammlung/gefuehrter-ausklapper': 'error',

			/*
			 * Aus `eslint-plugin-svelte` nur, was still schadet: `{@html …}` ohne
			 * Not ist ein Weg für fremdes Markup, und ein `<a>` ohne Ziel ist ein
			 * Knopf, der wie ein Verweis aussieht.
			 */
			'svelte/no-at-html-tags': 'error',
			'svelte/valid-compile': 'error',
			/*
			 * **Ohne diese Regel wirken die Ausnahmen im Markup nicht.** Ein
			 * `<!-- eslint-disable-next-line … -->` ist in einer Svelte-Vorlage ein
			 * HTML-Kommentar; erst `comment-directive` macht daraus eine Anweisung.
			 * Beim ersten Lauf standen fünf solche Kommentare bereits da und
			 * wurden übergangen — sie waren Zierde, keine Ausnahme.
			 */
			'svelte/comment-directive': 'error',

			// Der Bau ist voller absichtlich ungenutzter Bausteine (Snippets,
			// Eigenschaften); die Rohregel meldete sie und nichts sonst.
			'no-unused-vars': 'off',
			'no-undef': 'off'
		}
	},

	/* ── Skript und Server ───────────────────────────────────────────────── */
	{
		/*
		 * **`cjs`, `cts` und `mts` gehören dazu**, auch wenn heute nur eine
		 * einzige `.cjs` im Baum liegt. Gemessen am 28.08.2026 mit
		 * `--print-config`: Ohne sie bekam `.dependency-cruiser.cjs` die Regeln
		 * aus `recommended`, aber **null** Umgebungsvariablen und ein scharfes
		 * `no-undef` — zum Vergleich hat eine `.mjs` dort 1206. Die Datei
		 * überlebte nur, weil sie ein reines Literalobjekt ist; eine einzelne
		 * Zeile mit `console.log` oder `process.env` hätte den Prüflauf mit einem
		 * Scheinbefund abgebrochen. Dazu galten `no-unused-vars` und `no-empty`
		 * ausgerechnet dort scharf, wo sie sonst überall aus sind, und keine
		 * einzige `versammlung/*`-Regel griff.
		 */
		files: ['**/*.{js,cjs,mjs,cts,mts,ts}'],
		plugins: { versammlung: felder },
		languageOptions: {
			parser: ts.parser,
			globals: { ...globals.node, ...globals.browser }
		},
		rules: {
			'versammlung/keine-browserabfrage': 'error',
			/*
			 * Zwei Fallen, die der Übersetzer nicht meldet: eine `await`-lose
			 * Zusage, die lautlos verpufft, und ein `case`, das in das nächste
			 * fällt. Beide sind hier schon vorgekommen.
			 */
			'no-fallthrough': 'error',
			'no-unused-vars': 'off',
			'no-undef': 'off',
			'no-empty': ['error', { allowEmptyCatch: true }]
		}
	}
);
