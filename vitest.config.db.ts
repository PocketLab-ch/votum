import { defineConfig } from 'vitest/config';

/**
 * Datenbanktests. Getrennt von den Kerntests, weil sie eine laufende Datenbank
 * brauchen und deshalb nicht überall laufen können.
 *
 * Sie prüfen ausschliesslich Zusagen, die in der Datenbank liegen und nicht im
 * Code: Schreibschutz, Zeilenschutz, Fremdschlüssel, Prüfbedingungen, Auslöser.
 * Alles, was sich als Funktion prüfen lässt, gehört nach `tests/domain/`.
 *
 * Nacheinander statt nebeneinander: Die Prüfläufe teilen sich Betreiber und
 * Prüfmarke, und ein paralleler Lauf würde beim Aufräumen dem anderen die Daten
 * unter den Füssen wegziehen.
 */
export default defineConfig({
	test: {
		include: ['tests/db/**/*.test.ts'],
		environment: 'node',
		// Frische Datenbank je Lauf, danach verworfen. Prüfdaten liessen sich aus
		// dem Verlauf sonst nicht mehr entfernen, ohne dessen Schutz auszuhebeln.
		globalSetup: ['tests/db/aufbau.ts'],
		// Kein Test wird durch den Wächter über den Verlauf grün (Migration 177).
		setupFiles: ['tests/db/waechter-netz.ts'],
		fileParallelism: false,
		testTimeout: 20000,
		hookTimeout: 20000,
		// **Kein fremdes Haus im Prüflauf.** Die Entwicklungsumgebung hat einen
		// Zeitstempeldienst hinterlegt; ohne diese Zeile riefe jedes Versiegeln
		// im Prüflauf dort an — langsam, und rot, sobald dort jemand wartet. Wer
		// den echten Weg prüfen will, setzt VERSAMMLUNG_ZEITSTEMPEL_ECHTLAUF.
		env: process.env.VERSAMMLUNG_ZEITSTEMPEL_ECHTLAUF
			? {}
			: { VERSAMMLUNG_ZEITSTEMPEL_URL: '' }
	},
	resolve: {
		alias: {
			$lib: new URL('./src/lib', import.meta.url).pathname,
			// SvelteKit stellt diesen Namensraum nur zur Laufzeit bereit. Der Ersatz
			// lenkt DATABASE_URL zwingend auf die Prüfdatenbank um — sonst liefen die
			// Tests gegen die Entwicklungsdatenbank.
			'$env/dynamic/private': new URL('./tests/db/env-ersatz.ts', import.meta.url).pathname
		}
	}
});
