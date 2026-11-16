/**
 * Stylelint — der CSS-Wächter.
 *
 * **Warum es ihn gibt** (24.08.2026). Bis dahin hatte das Projekt gar keinen
 * Linter; die Regeln über CSS standen als selbstgeschriebene Skripte mit
 * regulären Ausdrücken da. Ein Regex über eine `.svelte`-Datei kann Code nicht
 * von Kommentar unterscheiden, sieht keine verschachtelten Regeln und keine
 * über zwei Zeilen geschriebene Deklaration. Stylelint bringt einen echten
 * CSS-Baum mit — dieselben Regeln, ohne die blinden Stellen.
 *
 * **Bewusst ohne `stylelint-config-standard`.** Der Satz bringt hundert Regeln
 * über Schreibweise und Reihenfolge mit; sie hätten hier vierhundert Befunde
 * erzeugt, die niemand liest, und den einen Befund verdeckt, auf den es
 * ankommt. Aufgenommen wird, was eine **Falle** schliesst, nicht was einen
 * Geschmack durchsetzt.
 */
export default {
	plugins: ['./scripts/stylelint/dreieck-am-summary.mjs'],
	rules: {
		'versammlung/dreieck-am-summary': true,

		/*
		 * Fallen, die Stylelint von Haus aus kennt — jede eine, die still wirkt:
		 * eine Kurzschreibweise, die eine vorher gesetzte Einzelangabe wieder
		 * löscht; dieselbe Eigenschaft zweimal im selben Block; eine
		 * Eigenschaft, die es nicht gibt und die der Browser wortlos verwirft.
		 *
		 * **`no-duplicate-selectors` steht bewusst nicht dabei.** Sie meldete
		 * beim ersten Lauf vier Stellen — und alle vier waren Absicht: ein
		 * zweiter Block mit anderem Zweck und eigenem Kommentar
		 * (`body { overflow-x }` neben der Grundgestaltung, `.gescannt
		 * { scroll-margin-top }` neben dem Rahmen). Überschrieben wurde nirgends
		 * etwas; die Regel will bloss, dass man Blöcke zusammenlegt. Ein
		 * Wächter, der im guten Zustand rot wird, wird abgeschaltet statt
		 * gelesen. Was wirklich still überschreibt, fangen die beiden Regeln
		 * darunter.
		 */
		'declaration-block-no-shorthand-property-overrides': true,
		'declaration-block-no-duplicate-properties': [
			true,
			{ ignore: ['consecutive-duplicates-with-different-values'] }
		],
		'property-no-unknown': true,
		'no-invalid-position-at-import-rule': true,
		'block-no-empty': true
	},
	overrides: [
		{
			files: ['**/*.svelte'],
			customSyntax: 'postcss-html'
		}
	],
	ignoreFiles: ['node_modules/**', 'build/**', '.svelte-kit/**', 'static/**', 'entpackt/**']
};
