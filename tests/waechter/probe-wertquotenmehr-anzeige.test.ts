/**
 * Was Wand und Leitung aus den Befunden der Probe Wertquotenmehr zeigen
 * (Featureprüfung zu `5b1b82a0`, Kriterium 9, für B4 und B5).
 *
 * **Warum ein Wächter über den Quelltext.** Strom und Loader sind geprüft
 * (`tests/db/regel-ohne-koepfe.test.ts`, `tests/db/probe-wertquotenmehr-abend.test.ts`),
 * die Svelte-Seiten lassen sich dort nicht laden. Die Gegenproben vom
 * 17.11.2026 haben es gezeigt: Stand in `Hausabstimmung.svelte` wieder «Das
 * Ergebnis wird verkündet.» statt des Wartesatzes, blieben Prüflauf und
 * `svelte-check` grün. Die Probe hier ist schwächer als ein Lauf durch die
 * Seite, wird aber rot, wenn eine Anzeigestelle fehlt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8');

const VERSPRECHEN = /Das Ergebnis wird (von der Sitzungsleitung )?verkündet/;

describe('Offener Gleichstand an der Wand (B4)', () => {
	for (const pfad of ['src/lib/components/Hausabstimmung.svelte', 'src/lib/components/Saalbild.svelte']) {
		it(`${pfad} zeigt den Wartesatz und verspricht kein Ergebnis`, () => {
			const quelle = lies(pfad);
			expect(quelle).toMatch(/\{abstimmung\.wartesatz \?\? '[^']+'\}/);
			expect(quelle).not.toMatch(VERSPRECHEN);
		});
	}
});

describe('Rückzug an der Wand (B4)', () => {
	it('die Abendwand zeigt den Rückzug aus dem Load', () => {
		const seite = lies('src/routes/tage/[id=kennung]/praesentation/+page.svelte');
		expect(seite).toContain('{#if data.alleZurueckgezogen}');
		expect(seite).toContain('data.zurueckgezogen.join(');
		expect(seite).toContain('data.rueckzugsmarke');
		// Das Snippet gezeichnet, nicht nur definiert: beim Einzelpunkt und beim Punkt des Schrittes.
		expect(seite.split('{@render rueckzug()}').length - 1).toBe(2);
	});

	it('das Saalbild zeigt ihn, und Hauswand und Codewand geben ihn mit', () => {
		expect(lies('src/lib/components/Saalbild.svelte')).toContain('{#if aufgerufen.zurueckgezogen}');
		expect(lies('src/routes/versammlungen/[id=kennung]/praesentation/+page.server.ts')).toMatch(
			/zurueckgezogen: aktuelles\.knoten\.rueckzug != null/
		);
		expect(lies('src/routes/p/+page.svelte')).toMatch(/zurueckgezogen: Boolean\(stand\?\.zurueckgezogenAm\)/);
	});
});

describe('Gleichstand an der Leitung des Abends (B5)', () => {
	it('die Seite nennt die Zahlen aus dem Load', () => {
		expect(lies('src/routes/tage/[id=kennung]/leitung/+page.svelte')).toMatch(
			/Stimmengleichheit\{#if e\.gleichstand\}\{' '\}\(\{e\.gleichstand\}\)\{\/if\}/
		);
	});
});
