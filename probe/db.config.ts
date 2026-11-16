import { defineConfig } from 'vitest/config';

/**
 * Durchgang mit echter Datenbank **und** echtem Modell — nicht Teil von
 * `npm run pruefen`. Wie `vitest.config.db.ts`, aber ohne den Riegel gegen
 * fremde Häuser: Hier ist das fremde Haus gerade der Gegenstand.
 */
export default defineConfig({
	test: {
		include: ['probe/**/*.dblive.ts'],
		environment: 'node',
		globalSetup: ['tests/db/aufbau.ts'],
		fileParallelism: false,
		testTimeout: 120_000,
		hookTimeout: 60_000
	},
	resolve: {
		alias: {
			$lib: new URL('../src/lib', import.meta.url).pathname,
			'$env/dynamic/private': new URL('../tests/db/env-ersatz.ts', import.meta.url).pathname
		}
	}
});
