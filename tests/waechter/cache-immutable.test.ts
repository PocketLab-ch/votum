import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Wächter: Ausser der benannten Ausnahme setzt keine Stelle in `src`
 * `immutable` in eine Cache-Anweisung (FP-2, Produktentscheid 12.11.2026).
 *
 * **Der Anlass.** Das Abschlusspaket und der Anhang trugen
 * `private, max-age=31536000, immutable`; beide können Personendaten
 * enthalten. Auf einem geteilten Gerät im Saal blieben sie nach dem Abmelden
 * bis zu einem Jahr im Browser. Der Haken lässt eigene Cache-Anweisungen
 * bewusst stehen (GP-4/B2); die Korrektur gehört deshalb an den Endpunkt.
 *
 * **Warum ein eigener Wächter und nicht nur der Fall im Test daneben.** Jener
 * prüft die Funktion des Hakens, dieser den Bestand: Ein neuer Endpunkt mit
 * `immutable` ist eine Zeile, die kein Durchstich bemerkt.
 *
 * **Was er liest** (aus der Codeprüfung 12.11.2026): jede `.ts` und `.svelte`
 * unter `src`, nicht nur die `+server.ts`, denn Hilfsfunktionen wie
 * `src/lib/server/ereignisstrom.ts` setzen die Angabe selbst. Den Namen in
 * jeder Schreibweise (`Cache-Control` ist für `Headers` dasselbe). Zeilen, die
 * mit einem Kommentarzeichen beginnen, überspringt er; Kommentare mitten in
 * einer Zeile nicht, weil ein Abschneiden an `//` oder `/*` auch Zeichenketten
 * wie `'*\/*'` träfe und Code dahinter verschluckte.
 *
 * **Was er nicht sieht.** Einen Wert, der in einer Konstante steht
 * (`const C = '… immutable'; h.set('cache-control', C)`), und ob die Anweisung
 * am gebauten Stand ankommt; das misst der Prüfschritt mit `curl -I`.
 */

const WURZEL = join(__dirname, '..', '..');

/**
 * Die Ausnahmen, jede mit Grund.
 *
 * Nur der Zeitstempel: Er bezeugt das Siegel, enthält keine Personendaten und
 * ändert sich nie.
 */
const AUSNAHMEN: Record<string, string> = {
	'src/routes/versammlungen/[id=kennung]/zeitstempel.tsr/+server.ts':
		'Zeitstempel ohne Personendaten, Inhalt ändert sich nie'
};

/** Alle `.ts` und `.svelte` unter einem Verzeichnis, relativ zur Wurzel. */
function quellen(verzeichnis: string): string[] {
	const treffer: string[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...quellen(pfad));
		else if (/\.(ts|svelte)$/.test(eintrag)) treffer.push(relative(WURZEL, pfad));
	}
	return treffer;
}

/** Zeilen, die mit `//`, `/*` oder `*` beginnen, sind Kommentar. */
function ohneKommentarzeilen(text: string): string {
	return text
		.split('\n')
		.filter((zeile) => !/^\s*(\/\/|\/\*|\*)/.test(zeile))
		.join('\n');
}

/** Liest `'cache-control': '…'` und `set('cache-control', '…')` in jeder Schreibweise. */
function cacheWerte(text: string): string[] {
	const treffer = ohneKommentarzeilen(text).matchAll(
		/['"`]cache-control['"`]\s*(?::|,)\s*(['"`])([^'"`]*)\1/gi
	);
	return [...treffer].map((t) => t[2]);
}

function mitImmutable(pfad: string): boolean {
	return cacheWerte(readFileSync(join(WURZEL, pfad), 'utf8')).some((wert) =>
		/\bimmutable\b/i.test(wert)
	);
}

describe('Cache-Anweisung ohne `immutable`', () => {
	it('liest genug Dateien, um etwas zu sagen', () => {
		// Ein Wächter, der nichts liest, ist immer grün.
		const gelesen = quellen(join(WURZEL, 'src'));
		expect(gelesen.length).toBeGreaterThan(100);
		expect(gelesen.some((p) => p.endsWith('abschlusspaket.zip/+server.ts'))).toBe(true);
		expect(gelesen.some((p) => p.endsWith('ereignisstrom.ts'))).toBe(true);
	});

	it('setzt ausserhalb der Ausnahmen nirgends `immutable`', () => {
		const befunde = quellen(join(WURZEL, 'src')).filter(
			(pfad) => !(pfad in AUSNAHMEN) && mitImmutable(pfad)
		);
		expect(befunde).toEqual([]);
	});

	it('jede Ausnahme gibt es noch, und sie setzt `immutable`', () => {
		// Sonst wüchse die Liste unbemerkt um Einträge, die nichts mehr decken.
		for (const pfad of Object.keys(AUSNAHMEN)) {
			expect(mitImmutable(pfad), pfad).toBe(true);
		}
	});

	it('erkennt die Schreibweisen und überliest Kommentarzeilen', () => {
		expect(cacheWerte("{ 'cache-control': 'private, max-age=31536000, immutable' }")).toEqual([
			'private, max-age=31536000, immutable'
		]);
		expect(cacheWerte("{ 'Cache-Control': 'public, immutable' }")).toEqual(['public, immutable']);
		expect(cacheWerte("kopf.set('cache-control', 'private, no-store')")).toEqual([
			'private, no-store'
		]);
		expect(cacheWerte('kopf.set(`cache-control`, `private, no-store`)')).toEqual([
			'private, no-store'
		]);
		expect(cacheWerte("// kopf.set('cache-control', 'immutable')\n")).toEqual([]);
		expect(cacheWerte("/* 'cache-control': 'immutable' */\n")).toEqual([]);
		expect(cacheWerte("\t * 'cache-control': 'immutable'\n")).toEqual([]);
	});

	it('verschluckt keinen Code hinter `/*` oder `//` in einer Zeichenkette', () => {
		const text = [
			"const art = { accept: '*/*' };",
			"h.set('cache-control', 'private, immutable'); const u = 'a//b';",
			'/** Ein Block. */'
		].join('\n');
		expect(cacheWerte(text)).toEqual(['private, immutable']);
	});
});
