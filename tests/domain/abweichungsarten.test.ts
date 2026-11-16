/**
 * Wächter: Eine Abweichung der Sitzungsleitung geht nie ins Protokoll
 * (`docs/einordnung-sperrstellen-2026-09-30.md`, Muster «Leitung weicht ab»,
 * Punkt 4; Produktentscheid 30.09.2026).
 *
 * **Die Fehlerklasse.** Das Protokoll liest Vorgänge aus dem Verlauf
 * (`holeVorgaengeFuerProtokoll`). Wer dort eine Art ergänzt oder den Verlauf an
 * einer zweiten Stelle ins Protokoll führt, schreibt eine Abweichung nach
 * aussen, ohne dass ein Test es merkt: Der Eintrag ist richtig, nur am
 * falschen Ort.
 *
 * **Was er liest, und was nicht.** Die Menge `PROTOKOLLVORGANGSARTEN` gegen
 * `ABWEICHUNGSARTEN`, und den Quelltext der Dateien, die ein Protokoll bilden,
 * auf die Namen und Werte der Abweichungsarten. Eine Abweichungsart, die
 * niemand in `ABWEICHUNGSARTEN` einträgt, sieht er nicht; die Menge ist die
 * Stelle, an der das zu pflegen ist.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	ABWEICHUNGSARTEN,
	EREIGNISARTEN,
	PROTOKOLLVORGANGSARTEN,
	beschriftung
} from '../../src/lib/domain/verlauf';

/**
 * Alles, was ein Protokoll bildet oder ihm Zeilen liefert: die Protokolle
 * selbst, die Auswertung, die ihre Zeilen baut und als einzige die Vorgänge
 * holt, und die Auszählung mit `herleitung()` und den Ergebnissätzen.
 */
const PROTOKOLLDATEIEN = [
	'src/lib/server/auswertung.ts',
	'src/lib/domain/auszaehlung.ts',
	'src/lib/domain/protokoll.ts',
	'src/lib/domain/protokollentwurf.ts',
	'src/lib/domain/gemeinsamesprotokoll.ts',
	'src/lib/server/protokoll.ts',
	'src/lib/server/protokollentwurf.ts',
	'src/lib/server/gemeinsamesprotokoll.ts',
	'src/lib/server/pdf/protokoll.ts'
];

const NAMEN = Object.entries(EREIGNISARTEN)
	.filter(([, wert]) => ABWEICHUNGSARTEN.has(wert))
	.map(([name]) => name);

/** Die Namen und Werte der Abweichungsarten, die in einem Quelltext vorkommen. */
function treffer(quelltext: string): string[] {
	return [...NAMEN.map((n) => `EREIGNISARTEN.${n}`), ...ABWEICHUNGSARTEN].filter((s) =>
		quelltext.includes(s)
	);
}

describe('Abweichungen der Leitung', () => {
	it('sind die vier Arten des Musters, jede mit Beschriftung', () => {
		expect([...ABWEICHUNGSARTEN].sort()).toEqual([
			'ai.decision.recorded',
			'meeting.day.bypassed',
			'requirement.overridden',
			'vote.decided.by.chair'
		]);
		for (const art of ABWEICHUNGSARTEN) expect(beschriftung(art)).not.toBe(art);
	});

	it('stehen nicht unter den Arten, die als Vorgang ins Protokoll gehen', () => {
		expect(PROTOKOLLVORGANGSARTEN.length).toBeGreaterThan(0);
		expect(PROTOKOLLVORGANGSARTEN.filter((a) => ABWEICHUNGSARTEN.has(a))).toEqual([]);
	});

	it('die Abfrage fürs Protokoll liest ihre Arten aus dem Kern und nennt keine eigene', () => {
		const quelle = readFileSync('src/lib/server/verlaufsabfrage.ts', 'utf8');
		const anfang = quelle.indexOf('export async function holeVorgaengeFuerProtokoll');
		expect(anfang).toBeGreaterThan(-1);
		const rumpf = quelle.slice(anfang);
		expect(rumpf).toContain('const ARTEN = [...PROTOKOLLVORGANGSARTEN];');
		expect(rumpf).toContain('a.event_type = ANY(${ARTEN})');
		expect(treffer(rumpf)).toEqual([]);
	});

	it.each(PROTOKOLLDATEIEN)('%s nennt keine Abweichungsart', (datei) => {
		// Wirft, wenn die Datei fehlt: Eine verschobene Datei darf den Wächter
		// nicht still grün lassen.
		expect(treffer(readFileSync(datei, 'utf8'))).toEqual([]);
	});

	it('Gegenprobe: Der Wächter erkennt Namen und Wert einer Abweichungsart', () => {
		expect(treffer("ARTEN.push('vote.decided.by.chair')")).toEqual(['vote.decided.by.chair']);
		expect(treffer('if (v.art === EREIGNISARTEN.erfordernisUebersteuert) z.push(satz)')).toEqual([
			'EREIGNISARTEN.erfordernisUebersteuert'
		]);
		expect(treffer("z.push('Der Antrag wurde vor der Abstimmung zurückgezogen')")).toEqual([]);
	});
});
