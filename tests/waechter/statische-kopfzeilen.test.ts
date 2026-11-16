import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Die drei Sicherheitsköpfe auf statischen Antworten.
 *
 * **Der Anlass** (GP-V-3, Pentest nach dem Go-Public, 12.11.2026):
 * `/handbuch` und `/robots.txt` trugen keinen der Köpfe. adapter-node liefert
 * statische Dateien mit sirv aus, **bevor** SvelteKits `handle`-Haken läuft;
 * `src/hooks.server.ts` sieht sie also nie. Seit dem 12.11.2026 setzt
 * `scripts/server-einstieg.mjs` sie am HTTP-Server, vor dem Adapter.
 *
 * **Warum es diese Probe braucht.** Dieselben drei Werte stehen jetzt an zwei
 * Stellen: in `src/lib/server/sicherheitskopfzeilen.ts` für die gerenderten
 * Antworten und im Einstieg für alle. Zwei Stellen sind eine Gelegenheit zum
 * Auseinanderlaufen; wer
 * `referrer-policy` im Modul ändert und den Einstieg vergisst, bekäme auf
 * statischen Dateien weiter den alten Wert, und kein Durchstich würde es
 * melden. Die Probe hält die Werte zusammen und prüft, dass der Bau den
 * Einstieg überhaupt einsetzt.
 *
 * **Was sie nicht kann.** Sie liest Quelltext, nicht den Kopf einer Antwort.
 * Dass die Köpfe am gebauten Stand ankommen, misst die Abnahme mit `curl -I`
 * auf `/robots.txt` und eine Datei unter `/_app/immutable/`.
 */
const WURZEL = process.cwd();
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8');

const ERWARTET = {
	'x-frame-options': 'DENY',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'same-origin'
};

/** Kommentare zählen nicht: Ein auskommentierter `setHeader` ist kein Kopf. */
function ohneKommentare(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Liest `set('name', 'wert')` und `setHeader('name', 'wert')` gleichermassen. */
function kopfzeilen(text: string): Record<string, string | undefined> {
	const code = ohneKommentare(text);
	const werte: Record<string, string | undefined> = {};
	for (const name of Object.keys(ERWARTET)) {
		const treffer = new RegExp(`['"]${name}['"]\\s*,\\s*['"]([^'"]+)['"]`).exec(code);
		werte[name] = treffer?.[1];
	}
	return werte;
}

describe('Sicherheitsköpfe auf statischen Antworten', () => {
	it('setzt im Server-Einstieg dieselben drei Werte wie im Haken', () => {
		const haken = kopfzeilen(lies('src/lib/server/sicherheitskopfzeilen.ts'));
		const einstieg = kopfzeilen(lies('scripts/server-einstieg.mjs'));

		expect(einstieg).toEqual(ERWARTET);
		expect(einstieg).toEqual(haken);
	});

	it('zählt einen auskommentierten Kopf nicht', () => {
		const werte = kopfzeilen("// res.setHeader('x-frame-options', 'DENY');\n");
		expect(werte['x-frame-options']).toBeUndefined();
	});

	it('hängt den Einstieg an den Bau', () => {
		const paket = JSON.parse(lies('package.json'));
		expect(paket.scripts.build).toContain('node scripts/nachbau-einstieg.mjs');
	});

	it('setzt die Köpfe vor dem Adapter-Handler', () => {
		const einstieg = lies('scripts/server-einstieg.mjs');
		expect(einstieg).toContain("prependListener('request'");
		expect(einstieg).toContain("from './adapter.js'");
	});

	it('sperrt die App-Wege und die Einlöse-Unterpfade, lässt die Code-Seiten mit noindex offen und die Hilfe erreichbar', () => {
		const robots = lies('static/robots.txt');
		for (const weg of ['/anmelden', '/versammlungen']) {
			expect(robots).toMatch(new RegExp(`^Disallow: ${weg}$`, 'm'));
		}
		for (const weg of ['/z', '/p', '/b', '/e']) {
			expect(robots).not.toMatch(new RegExp(`^Disallow: ${weg}$`, 'm'));
		}
		// Auch nicht über den Schrägstrich-Pfad: `Disallow: /b/` sperrte
		// `/b/<marke>`, `Disallow: /e/` die Saalseiten samt `/e/tag/…`.
		expect(robots).not.toMatch(/^Disallow: \/(b|e)\//m);
		for (const weg of ['/z/', '/p/']) {
			expect(robots).toMatch(new RegExp(`^Disallow: ${weg}$`, 'm'));
		}
		expect(robots).not.toMatch(/^Disallow: \/$/m);
		expect(robots).not.toMatch(/^Disallow: \/_app/m);
		expect(robots).not.toMatch(/^Disallow: \/handbuch$/m);
		expect(robots).toMatch(/^Allow: \/handbuch$/m);

		for (const seite of [
			'src/routes/z/+page.svelte',
			'src/routes/p/+page.svelte',
			'src/routes/b/[marke]/+page.svelte',
			'src/routes/e/[merkmal]/+page.svelte',
			'src/routes/e/tag/[merkmal]/+page.svelte'
		]) {
			expect(lies(seite)).toContain('<meta name="robots" content="noindex, nofollow" />');
		}
	});

	it('legt den Aufsatz an und lässt einen zweiten Lauf stehen', () => {
		const baum = wegwerfbaum({
			'build/index.js': 'export const server = 1;\n//# sourceMappingURL=index.js.map\n',
			'build/index.js.map': '{}',
			'scripts/server-einstieg.mjs': "import { server } from './adapter.js';\n"
		});
		try {
			const erster = nachbau(baum);
			expect(erster.status).toBe(0);
			expect(readFileSync(join(baum, 'build', 'index.js'), 'utf8')).toContain(
				"from './adapter.js'"
			);
			expect(readFileSync(join(baum, 'build', 'adapter.js'), 'utf8')).toContain(
				'export const server = 1'
			);
			expect(readFileSync(join(baum, 'build', 'adapter.js'), 'utf8')).toMatch(
				/\/\/# sourceMappingURL=adapter\.js\.map\s*$/
			);
			expect(readFileSync(join(baum, 'build', 'adapter.js.map'), 'utf8')).toBe('{}');

			const zweiter = nachbau(baum);
			expect(zweiter.status).toBe(0);
			expect(readFileSync(join(baum, 'build', 'adapter.js'), 'utf8')).toContain(
				'export const server = 1'
			);
		} finally {
			rmSync(baum, { recursive: true, force: true });
		}
	});

	it('bricht ab, wenn der Adapter zum Aufsatz fehlt', () => {
		const baum = wegwerfbaum({
			'build/index.js': "import { server } from './adapter.js';\n",
			'scripts/server-einstieg.mjs': "import { server } from './adapter.js';\n"
		});
		try {
			const lauf = nachbau(baum);
			expect(lauf.status).toBe(1);
			expect(lauf.stderr).toContain('adapter.js fehlt');
			expect(readFileSync(join(baum, 'build', 'index.js'), 'utf8')).toContain(
				"from './adapter.js'"
			);
		} finally {
			rmSync(baum, { recursive: true, force: true });
		}
	});

	it('verschiebt den Einstieg nicht, wenn die Vorlage fehlt', () => {
		const baum = wegwerfbaum({ 'build/index.js': 'export const server = 1;\n' });
		try {
			const lauf = nachbau(baum);
			expect(lauf.status).toBe(1);
			expect(lauf.stderr).toContain('server-einstieg.mjs fehlt');
			expect(readFileSync(join(baum, 'build', 'index.js'), 'utf8')).toContain(
				'export const server = 1'
			);
		} finally {
			rmSync(baum, { recursive: true, force: true });
		}
	});
});

function wegwerfbaum(dateien: Record<string, string>): string {
	const baum = mkdtempSync(join(tmpdir(), 'nachbau-'));
	for (const [pfad, inhalt] of Object.entries(dateien)) {
		mkdirSync(dirname(join(baum, pfad)), { recursive: true });
		writeFileSync(join(baum, pfad), inhalt);
	}
	return baum;
}

function nachbau(baum: string) {
	return spawnSync('node', [join(WURZEL, 'scripts', 'nachbau-einstieg.mjs')], {
		cwd: baum,
		encoding: 'utf8'
	});
}
