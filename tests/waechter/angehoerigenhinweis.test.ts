import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Der Satz W11 zu L10 erscheint nur, wo die Zählung ein zweites Ergebnis nennt.
 *
 * **Der Anlass** (Review DeepSeek zu E1, Befund 1; Codeprüfung des Nachtrags,
 * M1). Die Maske zeigte W11, sobald jemand im Ausstand war, der nicht betroffen
 * ist, auch ein Vertreter ohne Partei. Die Zählung nimmt Vertreter aber aus und
 * nennt dann kein zweites Ergebnis. Der Domänentest misst, dass
 * `ausstandMitAngehoerigenergebnis` und die Zählung übereinstimmen; ob die
 * Maske die Menge benutzt, misst dieser Wächter am Quelltext.
 *
 * **Was er nicht misst** (Codeprüfung, zweiter Durchgang, N2 und N3): die
 * Argumente des Aufrufs, die übrige Logik der Bedingung (ein zusätzliches
 * `|| …` bliebe grün) und Bedingungen, die ein `}` vor dem Bezeichner tragen.
 * Er liest das erste `….length > 0` der Bedingung und verlangt, dass diese
 * Menge aus `ausstandMitAngehoerigenergebnis` abgeleitet ist.
 */

const WURZEL = process.cwd();

function dateien(ordner: string): string[] {
	return readdirSync(ordner).flatMap((n) => {
		const pfad = join(ordner, n);
		if (statSync(pfad).isDirectory()) return dateien(pfad);
		return n.endsWith('.svelte') ? [pfad] : [];
	});
}

/** Die Bedingungen von `{#if …}` und `{:else if …}`, die den Satz W11 zeigen. */
function bedingungenMitW11(quelltext: string): string[] {
	return [
		...quelltext.matchAll(/\{(?:#|:else\s+)if\s+([^}]*\bangehoerigenlesartHinweis\b[^}]*)\}/g)
	].map((m) => m[1]);
}

describe('W11 nur mit zweitem Ergebnis', () => {
	const funde = dateien(join(WURZEL, 'src')).flatMap((d) => {
		const text = readFileSync(d, 'utf8');
		return bedingungenMitW11(text).map((bedingung) => ({ datei: relative(WURZEL, d), text, bedingung }));
	});

	it('findet die bekannte Stelle in der Maske', () => {
		expect(funde.map((f) => f.datei)).toContain('src/lib/components/Eingriffe.svelte');
	});

	it('jede Stelle prüft die Menge aus ausstandMitAngehoerigenergebnis', () => {
		for (const f of funde) {
			const name = /\b(\w+)\.length > 0/.exec(f.bedingung)?.[1];
			expect(name, `${f.datei}: Bedingung ohne «….length > 0»`).toBeDefined();
			const ableitung = new RegExp(`const ${name} = \\$derived\\(\\s*ausstandMitAngehoerigenergebnis\\(`);
			expect(f.text, `${f.datei}: «${name}» entsteht nicht aus ausstandMitAngehoerigenergebnis`).toMatch(
				ableitung
			);
		}
	});
});
