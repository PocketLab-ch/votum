/**
 * Wächter: Jeder Pfadteil ohne Matcher steht mit Begründung in der Liste.
 *
 * **Der Anlass** (Codeprüfung zu B2, Auftrag Abschluss, 16.10.2026).
 * `/gemeinschaften/<id>/eingespielt/<eintrag>` hatte keinen Matcher. Eine
 * Adresse mit `eintrag=x` lief bis in die Abfrage auf eine `uuid`-Spalte, und
 * weil die Ladefunktion die Absage nicht fing, kam die 500-Seite (am
 * Dev-Stapel gemessen, ebenso `…/paket.zip`). Mit `[eintrag=kennung]`
 * antwortet SvelteKit mit 404, bevor eine Abfrage läuft (`src/params/kennung.ts`).
 *
 * **Warum eine Liste statt einer Regel.** Nicht jeder Pfadteil ist eine
 * Kennung: Merkmale und Codes der offenen Wege sind Zeichenketten, die über
 * ihren Prüfwert verglichen werden. Welche sicher sind, entscheidet die
 * Stelle, nicht der Name. Ein neuer Pfadteil ohne Matcher wird hier rot und
 * verlangt eine Entscheidung: Matcher setzen oder begründet eintragen.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WURZEL = join(process.cwd(), 'src', 'routes');

/** Pfadteil ohne Matcher → warum er ohne auskommt. */
const OHNE_MATCHER: Record<string, string> = {
	merkmal: 'Merkmal eines offenen Wegs (Saal, Abend); Form geprüft, Textspalte, Pentest M7 ohne 500',
	code: 'Zugangs- oder Anzeigecode; verglichen über seinen Prüfwert, Textspalte',
	marke: 'Marke des Briefwegs; vor jeder Abfrage gegen MARKENFORM geprüft, sonst 404',
	traktandumId: 'wird in der Liste der eigenen Traktanden gesucht, unbekannt ergibt 404 vor jeder Abfrage',
	pruefsumme: 'Prüfsumme der Ablage, Textspalte und Dateiname aus Hexziffern',
	nummer: 'Nummer eines Durchgangs; Number.isInteger und Suche in der geladenen Liste',
	datei: 'Dateiname, vor der Verwendung gegen ein festes Muster geprüft'
};

function pfadteile(verzeichnis: string): { name: string; matcher: string | null; ort: string }[] {
	const gefunden: { name: string; matcher: string | null; ort: string }[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const voll = join(verzeichnis, eintrag);
		if (!statSync(voll).isDirectory()) continue;
		const teil = /^\[{1,2}(?:\.\.\.)?([^=\]]+)(?:=([^\]]+))?\]{1,2}$/.exec(eintrag);
		if (teil) gefunden.push({ name: teil[1], matcher: teil[2] ?? null, ort: relative(WURZEL, voll) });
		gefunden.push(...pfadteile(voll));
	}
	return gefunden;
}

describe('Pfadteile', () => {
	const alle = pfadteile(WURZEL);

	it('findet die Pfadteile überhaupt (sonst wäre der Wächter blind)', () => {
		expect(alle.length).toBeGreaterThan(10);
		expect(alle.some((t) => t.matcher === 'kennung')).toBe(true);
	});

	it('haben einen Matcher oder eine Begründung', () => {
		const ohne = alle.filter((t) => t.matcher === null && !(t.name in OHNE_MATCHER));
		expect(
			ohne.map((t) => t.ort),
			'Pfadteil ohne Matcher: `[name=kennung]` setzen oder in OHNE_MATCHER begründen'
		).toEqual([]);
	});

	it('führt keine Begründung für einen Pfadteil, den es nicht mehr gibt', () => {
		const namen = new Set(alle.filter((t) => t.matcher === null).map((t) => t.name));
		expect(Object.keys(OHNE_MATCHER).filter((n) => !namen.has(n))).toEqual([]);
	});
});
