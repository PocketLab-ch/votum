import { describe, expect, it } from 'vitest';
import {
	ANMELDUNG_ABGELAUFEN,
	absageantwort,
	anmeldeantwort,
	antwortform
} from '../../src/lib/server/absageantwort';

/**
 * **Warum das geprüft wird.** Beide Wächter antworteten bis zum 27.08.2026 nur
 * in der Gestalt, die eine Navigation versteht. Zwei Aufrufer verstehen sie
 * nicht, und beide verloren dadurch Daten oder den Weg:
 *
 *   * Ein Formular mit `use:enhance` scheitert an HTML am `JSON.parse` und
 *     kann «nicht berechtigt» nicht mehr von «keine Verbindung» unterscheiden.
 *   * `SicherndesFeld.svelte` folgt der Umleitung, bekommt HTTP 200 und hält
 *     das für einen gelungenen Schreibvorgang — es löschte den Merker auf dem
 *     Gerät, obwohl nichts gespeichert war.
 *
 * Die Proben prüfen deshalb **alle drei** Gestalten und ausdrücklich, dass
 * Status, Ziel und Text dieselben bleiben: Die Verpackung darf die Schranke
 * nicht lockern.
 */
describe('antwortform', () => {
	it('erkennt die Absendung von use:enhance', () => {
		expect(antwortform(new Headers({ 'x-sveltekit-action': 'true' }))).toBe('formular');
	});

	it('erkennt einen eigenen JSON-Schreiber', () => {
		expect(antwortform(new Headers({ 'content-type': 'application/json' }))).toBe('json');
		expect(antwortform(new Headers({ 'content-type': 'application/json; charset=utf-8' }))).toBe(
			'json'
		);
	});

	it('lässt alles übrige die gewöhnliche Seite sein', () => {
		expect(antwortform(new Headers())).toBe('seite');
		expect(antwortform(new Headers({ 'x-sveltekit-action': 'false' }))).toBe('seite');
		expect(
			antwortform(new Headers({ 'content-type': 'application/x-www-form-urlencoded' }))
		).toBe('seite');
	});

	it('nimmt das Formularergebnis vor der JSON-Gestalt', () => {
		// `use:enhance` schickt `x-www-form-urlencoded`, aber der eigene Kopf
		// entscheidet. Umgekehrt darf ein gesetzter JSON-Inhaltstyp die
		// Formulargestalt nicht verdrängen.
		const kopf = new Headers({
			'x-sveltekit-action': 'true',
			'content-type': 'application/json'
		});
		expect(antwortform(kopf)).toBe('formular');
	});
});

describe('absageantwort', () => {
	it('bleibt für die Navigation eine deutsche Seite mit 403', async () => {
		const a = absageantwort('Nur die Verwaltung darf das.', 'seite');
		expect(a.status).toBe(403);
		expect(a.headers.get('content-type')).toContain('text/html');
		expect(await a.text()).toContain('Nicht berechtigt');
	});

	it('maskiert den Text in der Seite', async () => {
		expect(await absageantwort('<script>x</script>', 'seite').text()).not.toContain('<script>');
	});

	it('wird für eine abgefangene Absendung zum Fehler mit demselben Status', async () => {
		const a = absageantwort('Nur die Verwaltung darf das.', 'formular');
		expect(a.status).toBe(403);
		expect(a.headers.get('content-type')).toContain('application/json');
		expect(JSON.parse(await a.text())).toEqual({
			type: 'error',
			error: { message: 'Nur die Verwaltung darf das.' }
		});
	});

	it('nennt dem JSON-Schreiber den Grund, mit demselben Status', async () => {
		const a = absageantwort('Nur die Verwaltung darf das.', 'json');
		expect(a.status).toBe(403);
		expect(JSON.parse(await a.text())).toEqual({ fehler: 'Nur die Verwaltung darf das.' });
	});
});

describe('anmeldeantwort', () => {
	it('bleibt für die Navigation eine Umleitung mit Zielmerker', () => {
		const a = anmeldeantwort('/anmelden?weiter=%2Fgemeinschaften', 'seite');
		expect(a.status).toBe(303);
		expect(a.headers.get('location')).toBe('/anmelden?weiter=%2Fgemeinschaften');
	});

	it('wird für eine abgefangene Absendung zur Umleitung im Rumpf, mit demselben Ziel', async () => {
		const a = anmeldeantwort('/anmelden?weiter=%2Fgemeinschaften', 'formular');
		// HTTP 200, weil `fetch` einer 303 von sich aus folgen würde und die
		// Anmeldeseite als HTML zurückbrächte. SvelteKit macht es genauso.
		expect(a.status).toBe(200);
		expect(JSON.parse(await a.text())).toEqual({
			type: 'redirect',
			status: 303,
			location: '/anmelden?weiter=%2Fgemeinschaften'
		});
	});

	it('ist für den JSON-Schreiber ein 401 — nur so behält er den Text', async () => {
		const a = anmeldeantwort('/anmelden?weiter=%2Fx', 'json');
		// **Der Statuscode ist hier die ganze Behebung.** `SicherndesFeld` prüft
		// `antwort.ok`; bei 200 hielte es den Text für gespeichert und löschte
		// den Merker auf dem Gerät.
		expect(a.status).toBe(401);
		expect(a.ok).toBe(false);
		expect(JSON.parse(await a.text())).toEqual({ fehler: ANMELDUNG_ABGELAUFEN });
	});
});
