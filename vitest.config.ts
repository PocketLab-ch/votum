import { defineConfig } from 'vitest/config';

/**
 * Kerntests laufen ohne Datenbank, ohne Browser, ohne SvelteKit-Laufzeit.
 * Genau das ist der Punkt von AD-1: Die Zählregel muss als Funktion vorlegbar
 * sein, nicht als Zusammenspiel von Abfragen.
 */
export default defineConfig({
	test: {
		/*
		 * **Und die Wächter selbst** (24.08.2026). Sie hatten keinen Test — ein
		 * Wächter, der nach einem Umbau nichts mehr trifft, meldet «in Ordnung»
		 * und ist schlimmer als keiner. Sie laufen hier mit, weil sie dieselbe
		 * Voraussetzung haben wie die Kerntests: keine Datenbank, kein Browser.
		 */
		include: ['tests/domain/**/*.test.ts', 'tests/waechter/**/*.test.ts'],
		environment: 'node'
	},
	resolve: {
		alias: { $lib: new URL('./src/lib', import.meta.url).pathname }
	}
});
