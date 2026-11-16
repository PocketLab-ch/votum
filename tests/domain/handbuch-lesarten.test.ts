/**
 * Lesarten Block 8 (22.10.2026): Das Handbuch beschreibt die Seite «Lesarten»
 * an einer Stelle, und der Hilfeknopf der Seite führt dorthin (Konzept
 * Lesarten, Kriterium 7 des Blocks).
 *
 * Die Tabelle im Handbuch ist abgeschrieben, nicht erzeugt: Das Handbuch ist
 * Markdown und wird ohne den Katalog gebaut. Damit sie nicht still veraltet,
 * vergleicht diese Probe sie Zeile für Zeile mit `LESARTEN` und
 * `LESARTEN_VORGABE`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LESARTEN, LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { stelleFuer } from '$lib/handbuch';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const handbuch = readFileSync(join(wurzel, 'docs/versammlung-fuehren.md'), 'utf-8');

/** Der Abschnitt «Lesarten der Gemeinschaft» bis zur nächsten Überschrift gleicher Stufe. */
function abschnitt(): string {
	const anfang = handbuch.indexOf('### Lesarten der Gemeinschaft\n');
	expect(anfang, 'Abschnitt «Lesarten der Gemeinschaft» fehlt im Handbuch').toBeGreaterThan(-1);
	const rest = handbuch.slice(anfang + 4);
	const ende = rest.search(/\n### /);
	return ende < 0 ? rest : rest.slice(0, ende);
}

describe('Handbuch: Lesarten der Gemeinschaft', () => {
	it('führt alle Lesarten des Katalogs mit Frage, Vorgabe und Wahl', () => {
		const zeilen = abschnitt()
			.split('\n')
			// Mehrstellig seit L11 (E1, Fassung 2026-11-10).
			.filter((z) => /^\| L\d+ \|/.test(z))
			.map((z) => z.split('|').slice(1, -1).map((t) => t.trim()));
		expect(zeilen.map((z) => z[0])).toEqual(LESARTEN.map((l) => l.kennung));
		for (const l of LESARTEN) {
			const [, frage, vorgabe, waehlbar] = zeilen.find((z) => z[0] === l.kennung)!;
			const vorgegeben = l.wahlen.find((w) => w.wert === LESARTEN_VORGABE[l.kennung])!;
			const andere = l.wahlen.filter((w) => w.wert !== LESARTEN_VORGABE[l.kennung]);
			expect(frage, l.kennung).toBe(l.frage);
			expect(vorgabe, l.kennung).toBe(vorgegeben.bezeichnung);
			expect(waehlbar, l.kennung).toBe(andere.map((w) => w.bezeichnung).join(', '));
		}
	});

	it('nennt die Vorgabe als umstellbar und sagt, wann die Wahl einfriert', () => {
		const text = abschnitt().replace(/\s+/g, ' ');
		expect(text).toContain('Die Gemeinschaft kann jede Vorgabe umstellen.');
		expect(text).toContain('Bei der Freigabe friert die Wahl ein');
		expect(text).toContain('Wer darf die Lesarten umstellen?');
	});

	it('führt den Hilfeknopf der Seite «Lesarten» dorthin', () => {
		expect(stelleFuer('/gemeinschaften/abc123/lesarten')).toEqual([
			'versammlung-fuehren',
			'lesarten-der-gemeinschaft',
			'Lesarten der Gemeinschaft'
		]);
		// Gegenprobe: Die übrigen Seiten der Gemeinschaft behalten ihre Hilfe.
		expect(stelleFuer('/gemeinschaften/abc123/reglement')?.[1]).toBe('abschnitt-1-vorbereiten');
		expect(stelleFuer('/gemeinschaften')?.[1]).toBe('abschnitt-1-vorbereiten');
		expect(stelleFuer('/gemeinschaftenx')).toBeNull();
	});
});
