import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beschriftet, setzeSicherheitskopfzeilen } from '$lib/server/sicherheitskopfzeilen';

/**
 * Wächter: Jede Antwort aus dem Haken trägt eine Cache-Anweisung (GP-4/B2,
 * Pentest vor E5 am 11.11.2026, Produktentscheid 12.11.2026).
 *
 * **Der Anlass.** Seiten mit Personendaten kamen ohne `cache-control` aus dem
 * Haken. Im Saal teilen sich Geräte: Nach dem Abmelden konnte «Zurück» die
 * vorige Seite aus dem Zwischenspeicher zeigen. Nur die Ströme und die
 * Datei-Endpunkte setzten einen Wert.
 *
 * **Warum eine echte `Response` durch die Funktion läuft.** Ein Wächter, der
 * den Quelltext nach `cache-control` absucht, bliebe grün, wenn die Zeile in
 * einem nie gerufenen Zweig stünde oder die Bedingung die eigene Angabe
 * überschriebe. Hier wird dieselbe Funktion gerufen, die der Haken für jede
 * Antwort benutzt, und danach der Kopf der Antwort gelesen.
 *
 * **Was er nicht sieht.** Ob die Antworten am gebauten Stand ankommen; das
 * misst die Abnahme mit `curl -I` gegen `/anmelden`, `/gemeinschaften`, eine
 * `__data.json`, einen Anhang und ein PDF.
 */

const WURZEL = process.cwd();

/** Eine gewöhnliche Antwort, wie der Haken sie beschriftet. */
function seite(status = 200, kopf: Record<string, string> = {}): Response {
	return new Response('inhalt', { status, headers: kopf });
}

describe('Cache-Anweisung aus dem Haken', () => {
	it('gibt einer Antwort ohne Angabe `private, no-store`', () => {
		const antwort = beschriftet(seite(), new URL('http://localhost/anmelden'));
		expect(antwort.headers.get('cache-control')).toBe('private, no-store');
	});

	it('gibt auch der Umleitung des Wächters eine Angabe', () => {
		// So baut `anmeldeantwort` den 303 zur Anmeldung: ohne Cache-Kopf.
		const umleitung = new Response(null, { status: 303, headers: { location: '/anmelden' } });
		const antwort = beschriftet(umleitung, new URL('http://localhost/gemeinschaften'));
		expect(antwort.status).toBe(303);
		expect(antwort.headers.get('cache-control')).toBe('private, no-store');
	});

	it.each([
		['Zeitstempel', 'private, max-age=31536000, immutable'],
		['PDF', 'private, no-store'],
		['Strom', 'no-store']
	])('lässt die eigene Angabe stehen: %s', (_name, wert) => {
		const antwort = beschriftet(seite(200, { 'cache-control': wert }), new URL('http://localhost/x'));
		expect(antwort.headers.get('cache-control')).toBe(wert);
	});

	it('setzt die Angabe genau einmal', () => {
		const antwort = beschriftet(seite(), new URL('http://localhost/anmelden'));
		const werte = [...antwort.headers].filter(([name]) => name === 'cache-control');
		expect(werte).toHaveLength(1);
	});

	it('lässt auch eine Antwort mit eigener Angabe genau eine behalten', () => {
		const antwort = beschriftet(
			seite(200, { 'cache-control': 'no-store' }),
			new URL('http://localhost/strom')
		);
		const werte = [...antwort.headers].filter(([name]) => name === 'cache-control');
		expect(werte).toHaveLength(1);
	});

	it('schreibt die übrigen Sicherheitsköpfe weiter', () => {
		const antwort = beschriftet(seite(), new URL('http://localhost/anmelden'));
		expect(antwort.headers.get('x-frame-options')).toBe('DENY');
		expect(antwort.headers.get('x-content-type-options')).toBe('nosniff');
		expect(antwort.headers.get('referrer-policy')).toBe('same-origin');
	});

	it('setzt HSTS nur über TLS', () => {
		const ohne = new Headers();
		setzeSicherheitskopfzeilen(ohne, new URL('http://localhost/'));
		expect(ohne.get('strict-transport-security')).toBeNull();

		const mit = new Headers();
		setzeSicherheitskopfzeilen(mit, new URL('https://localhost/'));
		expect(mit.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
	});
});

describe('Verdrahtung im Haken', () => {
	/**
	 * Die Funktion oben ist nur dann die des Hakens, wenn der Haken sie auch
	 * einbindet. Der Test liest dafür eine Zeile Quelltext; die Wirkung prüfen
	 * die Fälle darüber an der echten Antwort.
	 */
	it('bezieht `beschriftet` aus dem geprüften Modul', () => {
		const haken = readFileSync(join(WURZEL, 'src/hooks.server.ts'), 'utf8');
		expect(haken).toContain("import { beschriftet } from '$lib/server/sicherheitskopfzeilen'");
	});
});
