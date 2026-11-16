import { defineConfig } from 'vitest/config';
export default defineConfig({
	test: { include: ['probe/**/*.live.ts'], environment: 'node', testTimeout: 180_000 },
	resolve: { alias: { $lib: new URL('../src/lib', import.meta.url).pathname } }
});
