import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Jede Ergebniskarte unter `src/` entsteht aus dem Knoten nach der
 * eingestellten Lesart.
 *
 * **Der Anlass** (Review DeepSeek zu Lesarten Block 1, 20.10.2026, B1). Die
 * Karte der Herleitung entstand aus `lauf.stand.knoten`, dem Knoten der
 * Fassung. Bei umgestellter Lesart zeigte sie das einfache Mehr, gespeichert
 * wurde das qualifizierte. Der Domänentest misst `knotenNachLesart`, nicht ob
 * eine Seite es aufruft; das misst dieser Wächter am Quelltext.
 */

const WURZEL = process.cwd();

function dateien(ordner: string): string[] {
	return readdirSync(ordner).flatMap((n) => {
		const pfad = join(ordner, n);
		if (statSync(pfad).isDirectory()) return dateien(pfad);
		return /\.(ts|svelte)$/.test(n) ? [pfad] : [];
	});
}

/** Die Aufrufe von `ergebniskarte(` ohne Kommentare, je mit dem zweiten Argument. */
function aufrufeIn(quelltext: string): { zweites: string }[] {
	const ohne = quelltext.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*$/gm, '');
	return [...ohne.matchAll(/(?<!function )\bergebniskarte\(\s*[^,]+,\s*([^\n]+)/g)].map((m) => ({
		zweites: m[1].trim()
	}));
}

describe('Ergebniskarte nach der Lesart', () => {
	const funde = dateien(join(WURZEL, 'src')).flatMap((d) =>
		aufrufeIn(readFileSync(d, 'utf8')).map((a) => ({ datei: relative(WURZEL, d), ...a }))
	);

	it('ruft jede Seite mit knotenNachLesart auf', () => {
		// Gegenprobe der Suche: Die zwei bekannten Seiten werden gefunden.
		expect(funde.map((f) => f.datei).sort()).toEqual(
			expect.arrayContaining([
				'src/routes/quorum/+page.server.ts',
				'src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.server.ts'
			])
		);
		for (const f of funde) {
			expect(f.zweites, f.datei).toMatch(/^knotenNachLesart\(/);
			// Fest auf die Vorgabe gerechnet wäre derselbe Fehler (Codeprüfung, Befund 6).
			expect(f.zweites, f.datei).not.toMatch(/LESARTEN_VORGABE/);
		}
	});

	it('wird rot an einem Aufruf mit dem Knoten selbst (Gegenprobe)', () => {
		const alt = 'const k = ergebniskarte(regelwerk, lauf.stand.knoten, kennzahlen ?? undefined);';
		// Umbenannte Importe oder `ergebniskarte` als Verweis sieht die Suche nicht.
		expect(aufrufeIn(alt)).toEqual([{ zweites: 'lauf.stand.knoten, kennzahlen ?? undefined);' }]);
		expect(aufrufeIn(alt)[0].zweites).not.toMatch(/^knotenNachLesart\(/);
	});
});
