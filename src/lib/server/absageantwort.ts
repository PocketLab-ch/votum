/**
 * Die Antworten der beiden Wächter in `hooks.server.ts` — in zwei Gestalten.
 * Dazu, mit 400, die Absage eines NUL-Zeichens in Suchteil oder Pfad
 * (`domain/steuerzeichen.ts`).
 *
 * ## Warum zwei
 *
 * Ein Formular mit `use:enhance` schickt seine Absendung selbst und erwartet
 * die Antwort als JSON (`x-sveltekit-action: true` im Kopf). Bekommt es
 * stattdessen HTML, scheitert SvelteKit am `JSON.parse`, macht daraus ein
 * `{ type: 'error' }` **ohne Status**, und die Seite kann nicht mehr
 * unterscheiden, ob die Verbindung abgebrochen ist oder ob jemand nicht
 * berechtigt war. Gemessen am 27.08.2026 auf der Einheitenseite: Ein Konto
 * ohne Stammdatenrecht las «Der Server hat nicht wie erwartet geantwortet»
 * statt «Nicht berechtigt».
 *
 * Dasselbe bei der abgelaufenen Anmeldung: Die Umleitung auf `/anmelden` ist
 * für eine Navigation richtig, aber `fetch` folgt ihr von sich aus, bekommt
 * die Anmeldeseite als HTML und scheitert ebenso. Wer das liest, schickt
 * beliebig oft nach und kommt nie zur Anmeldung.
 *
 * ## Was sich dadurch **nicht** ändert
 *
 * Status, Ziel und Text sind in beiden Gestalten dieselben. Der Kopf
 * `x-sveltekit-action` entscheidet nur über die Verpackung; wer ihn von aussen
 * setzt, bekommt dieselbe Absage in JSON statt in HTML.
 */

/**
 * In welcher Gestalt dieser Aufrufer eine Absage lesen kann.
 *
 * Drei, weil es drei Arten von Aufrufern gibt: die gewöhnliche Navigation, die
 * von `use:enhance` abgefangene Absendung, und der eigene JSON-Schreiber
 * (`SicherndesFeld.svelte`, der einzige im Baum).
 */
export type Antwortform = 'seite' | 'formular' | 'json';

export function antwortform(kopf: Headers): Antwortform {
	if (kopf.get('x-sveltekit-action') === 'true') return 'formular';
	if ((kopf.get('content-type') ?? '').includes('application/json')) return 'json';
	return 'seite';
}

function maskiert(text: string): string {
	return text.replace(/[&<>]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[z]!);
}

/**
 * «Nicht berechtigt» — in der Gestalt, die der Aufrufer versteht.
 *
 * Als Formularergebnis ein `{ type: 'error' }`: SvelteKit hängt den Status der
 * Antwort daran, und die Seite kann ihn vom blossen Ausfall unterscheiden.
 * Als JSON ein Rumpf mit `fehler`, weil der Schreiber ihn so liest.
 *
 * Mit 400 dieselbe Gestalt für eine Eingabe, die abgelehnt wird, bevor eine
 * Route sie sieht (NUL-Zeichen in Suchteil oder Pfad, `domain/steuerzeichen.ts`).
 * Eine Datenanfrage (`__data.json`) beantwortet der Hook dort an dieser
 * Funktion vorbei mit dem Satz als JSON-Zeichenkette: Nur so liest der Client
 * eine Meldung, aus HTML machte er «Error: 400».
 */
export function absageantwort(nachricht: string, form: Antwortform, status: 400 | 403 = 403): Response {
	if (form === 'formular') {
		return new Response(JSON.stringify({ type: 'error', error: { message: nachricht } }), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	}
	if (form === 'json') {
		return new Response(JSON.stringify({ fehler: nachricht }), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	}
	const titel = status === 400 ? 'Eingabe abgelehnt' : 'Nicht berechtigt';
	return new Response(
		`<!doctype html><html lang="de"><head><meta charset="utf-8">` +
			`<title>${titel}</title></head><body>` +
			`<h1>${titel}</h1><p>${maskiert(nachricht)}</p></body></html>`,
		{ status, headers: { 'content-type': 'text/html; charset=utf-8' } }
	);
}

/**
 * Was ein JSON-Schreiber liest, wenn die Anmeldung abgelaufen ist.
 *
 * **Und warum er sie überhaupt lesen muss.** `SicherndesFeld.svelte` schickt
 * seinen Text als JSON, prüfte bis zum 27.08.2026 aber nur `antwort.ok`. Die
 * Umleitung auf `/anmelden` beantwortete `fetch` von sich aus mit der
 * Anmeldeseite und HTTP 200 — das Feld meldete «gesichert» und **löschte den
 * Merker auf dem Gerät** (`vergiss()`), obwohl nichts geschrieben worden war.
 * Mit 401 greift dort der Zweig `!antwort.ok`, der den Text behält.
 */
export const ANMELDUNG_ABGELAUFEN =
	'Die Anmeldung ist abgelaufen. Bitte in einem zweiten Fenster neu anmelden; der Text bleibt auf diesem Gerät.';

/**
 * «Bitte anmelden» — in der Gestalt, die der Aufrufer versteht.
 *
 * Als Formularergebnis eine Umleitung im Rumpf (HTTP 200, wie SvelteKit sie
 * selbst schickt): `applyAction` führt sie aus, und der Zielmerker `?weiter=`
 * bringt danach zurück, wo jemand war. Für den JSON-Schreiber wäre eine
 * Umleitung falsch — er navigiert nicht, er schreibt im Hintergrund.
 */
export function anmeldeantwort(ziel: string, form: Antwortform): Response {
	if (form === 'formular') {
		return new Response(JSON.stringify({ type: 'redirect', status: 303, location: ziel }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	}
	if (form === 'json') {
		return new Response(JSON.stringify({ fehler: ANMELDUNG_ABGELAUFEN }), {
			status: 401,
			headers: { 'content-type': 'application/json' }
		});
	}
	return new Response(null, { status: 303, headers: { location: ziel } });
}
