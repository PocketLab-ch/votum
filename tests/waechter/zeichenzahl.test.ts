import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sucheSchranken } from '../../scripts/check-zeichenzahl.mjs';

/**
 * Der Wächter über dem Zeichenwächter.
 *
 * **Warum es ihn gibt.** Die erste Fassung von `check-zeichenzahl.mjs` meldete
 * «in Ordnung», während vier echte Verstösse dastanden — sie verlangte links vom
 * Vergleich ein nacktes `x.length` und sah `(x?.trim().length ?? 0) < 2` nicht.
 * Aufgefallen ist das im Code-Review, nicht im Prüflauf: Der Wächter hatte
 * keinen Wächter.
 *
 * Geprüft wird deshalb beides — dass er den schlechten Fall **findet** und dass
 * er den guten in Ruhe lässt. Der zweite ist der wichtigere: Ein Wächter, der im
 * guten Zustand rot wird, wird abgeschaltet statt gelesen.
 *
 * **Gegen echte Dateien**, nicht gegen eine nachgebaute Wertetabelle: Was hier
 * zählt, ist die Antwort des Übersetzers auf die Frage «ist das eine
 * Zeichenkette oder eine Liste», und die gibt nur er selbst.
 */
let ordner: string;

function pruefe(quelle: string) {
	const datei = join(ordner, 'probe.ts');
	writeFileSync(datei, quelle, 'utf8');
	return sucheSchranken([datei], { wurzel: ordner, nurUnter: ordner });
}

beforeAll(() => {
	ordner = mkdtempSync(join(tmpdir(), 'zeichenzahl-'));
});

afterAll(() => {
	rmSync(ordner, { recursive: true, force: true });
});

describe('findet die Schranke', () => {
	/*
	 * **Eigene Zeitgrenze** (19.10.2026, unter Last gemessen): Der erste Fall
	 * der Datei trägt den Kaltstart des Übersetzers (das erste Programm lädt
	 * die Bibliotheken); ohne Last rund 480 ms gegen 150 bis 300 ms bei den
	 * übrigen Fällen. Unter zwei gleichzeitigen Läufen der Nicht-DB-Suite
	 * brauchte er bis 2,7 s und lag damit über der 2500-ms-Schwelle. Wer die
	 * Reihenfolge ändert, verschiebt den Kaltstart auf einen anderen Fall. Die
	 * 20 Sekunden lassen Luft, ohne einen hängenden Lauf zu verdecken.
	 */
	it('beim nackten Vergleich', { timeout: 20000 }, () => {
		const { befunde } = pruefe('export function f(name: string) { return name.length < 2; }');
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text).toContain('name.length < 2');
	});

	it('hinter Klammern und «?? 0» — der Fall, an dem die erste Fassung vorbeilief', () => {
		const { befunde } = pruefe(
			'export function f(n?: string) { return (n?.trim().length ?? 0) < 2; }'
		);
		expect(befunde).toHaveLength(1);
	});

	it('bei «===» und «!==»', () => {
		const { befunde } = pruefe(
			'export function f(c: string) { return c.length === 6 || c.length !== 8; }'
		);
		expect(befunde).toHaveLength(2);
	});

	it('bei umgedrehter Schranke, wo links die Zahl steht', () => {
		const { befunde } = pruefe('export function f(n: string) { return 2 > n.length; }');
		expect(befunde).toHaveLength(1);
	});

	it('auch bei «string | null» und in eckigen Klammern', () => {
		const { befunde } = pruefe(
			"export function f(a: string | null, b: string) { return (a?.length ?? 0) < 3 || b['length'] < 3; }"
		);
		expect(befunde).toHaveLength(2);
	});
});

describe('lässt in Ruhe', () => {
	it('was schon über zeichenzahl() zählt', () => {
		const quelle =
			'declare function zeichenzahl(t: string): number;\n' +
			'export function f(name: string) { return zeichenzahl(name) < 2; }';
		const { befunde, bewacht } = pruefe(quelle);
		expect(befunde).toHaveLength(0);
		// Und zählt trotzdem zur bewachten Menge — sonst sänke sie mit jeder
		// Umstellung, und die Untergrenze müsste laufend nachgeben.
		expect(bewacht).toBe(1);
	});

	it('eine Liste', () => {
		const { befunde } = pruefe('export function f(namen: string[]) { return namen.length < 2; }');
		expect(befunde).toHaveLength(0);
	});

	it('den Vergleich gegen null — leer ist leer, da sind sich beide einig', () => {
		const { befunde } = pruefe(
			'export function f(n: string) { return n.length > 0 && n.length === 0; }'
		);
		expect(befunde).toHaveLength(0);
	});

	it('eine Schleifengrenze', () => {
		const quelle =
			'export function f(t: string) { let z = 0; for (let i = 0; i < t.length; i++) z++; return z; }';
		expect(pruefe(quelle).befunde).toHaveLength(0);
	});

	it('eine Stelle mit Vermerk — in der Zeile und in der darüber', () => {
		const inZeile =
			'export function f(n: string) { return n.length < 2; } // zeichenzahl-frei: Probe';
		expect(pruefe(inZeile).befunde).toHaveLength(0);
		const darueber =
			'// zeichenzahl-frei: Probe\nexport function f(n: string) { return n.length < 2; }';
		expect(pruefe(darueber).befunde).toHaveLength(0);
	});
});

describe('die Sichtprobe', () => {
	it('meldet einen Vermerk, der nichts mehr deckt', () => {
		const { tote, befunde } = pruefe(
			'// zeichenzahl-frei: deckt nichts\nexport function f(namen: string[]) { return namen.length < 2; }'
		);
		expect(befunde).toHaveLength(0);
		expect(tote).toHaveLength(1);
	});

	it('lässt einen Vermerk in Ruhe, der wirklich deckt', () => {
		const { tote } = pruefe(
			'// zeichenzahl-frei: deckt die Zeile darunter\nexport function f(n: string) { return n.length < 2; }'
		);
		expect(tote).toHaveLength(0);
	});
});
