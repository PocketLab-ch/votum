import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Wächter: Die NUL-Sperre bleibt verdrahtet (Codeprüfung, zweiter Durchgang,
 * 27.10.2026).
 *
 * `tests/domain/steuerzeichen.test.ts` prüft `sperreNulImRumpf` und
 * `ausserAbsage` je für sich. Fällt aber der Aufruf im Hook bei einem Umbau
 * heraus, oder kehrt eine Lesestelle zu `.catch(() => new FormData())` zurück,
 * bliebe dort alles grün. Im zweiten Fall entstünden in `karten.pdf` und
 * `versandpaket.zip` aus einer abgesagten Auswahl still Zugänge für alle, der
 * Anlass von `ausserAbsage` (`src/lib/server/nulsperre.ts`).
 *
 * Gelesen wird Quelltext ohne Kommentare, wie in `rollenanker.test.ts`: Ein
 * Kommentar, der den Aufruf nennt, ist kein Aufruf.
 */

const WURZEL = process.cwd();

function ohneKommentare(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

function quelldateien(verzeichnis: string): string[] {
	return readdirSync(verzeichnis).flatMap((name) => {
		const pfad = join(verzeichnis, name);
		if (statSync(pfad).isDirectory()) return quelldateien(pfad);
		return /\.(ts|js)$/.test(name) ? [pfad] : [];
	});
}

describe('Wächter: NUL-Sperre am Eingang', () => {
	const HOOKS = ohneKommentare(readFileSync(join(WURZEL, 'src/hooks.server.ts'), 'utf8'));

	it('ruft die Sperre für den Rumpf im Hook auf', () => {
		expect(HOOKS).toContain('sperreNulImRumpf(event.request)');
	});

	it('prüft Suchteil und Pfadwerte im Hook', () => {
		expect(HOOKS).toContain('enthaeltNul([...event.url.searchParams])');
		expect(HOOKS).toContain('enthaeltNul(Object.values(event.params))');
	});

	it('deckt an keiner Lesestelle die Absage durch einen Ersatz', () => {
		const dateien = quelldateien(join(WURZEL, 'src/routes'));
		// Sichtprobe: Sonst wäre der Wächter auch grün, wenn er nichts liest.
		expect(dateien.length).toBeGreaterThan(100);

		const roh = /request\s*\.\s*(formData|json)\s*\(\s*\)\s*\.\s*catch\s*\(\s*(?!ausserAbsage\b)/;
		const treffer = dateien.filter((d) => roh.test(ohneKommentare(readFileSync(d, 'utf8'))));
		expect(treffer.map((d) => d.slice(WURZEL.length + 1))).toEqual([]);

		const mitAusnahme = dateien.filter((d) => readFileSync(d, 'utf8').includes('.catch(ausserAbsage('));
		expect(mitAusnahme).toHaveLength(3);
	});
});
