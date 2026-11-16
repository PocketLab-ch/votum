/**
 * Prüfdatei zu L13 (Block C, Endfassung Abschnitt 8; Featureprüfung Regel 43
 * Runde 2, N4): Das Skript läuft als Modul und gibt die Sätze je Karte, Wahl
 * und Fall aus, dazu Rückkommen, Abweichung der Leitung, Auszählmappe, Siegel
 * und Handbuch. Wie bei den Prüfdateien zu L6 und L9 bis L12 schreibt der
 * Test keine Datei; die Prüfdatei entsteht von Hand mit `vite-node`. Den
 * Wortlaut der Sätze prüft `tests/waechter/endfassung-regel43.test.ts`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

const KARTEN = [
	'k-zustaendigkeit-gewoehnlich',
	'k-verwaltung-wichtig',
	'k-benutzungsweise',
	'k-bewirtschaftung-erweitert',
	'k-bewirtschaftung-waehlen-erweitert',
	'k-prozessfuehrung',
	'k-baulich-notwendig',
	'k-baulich-luxurioes-ausweg',
	'k-baulich-nuetzlich'
];

describe('Prüfdatei zu L13', () => {
	let text = '';
	beforeAll(async () => {
		const ausgabe: string[] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
			ausgabe.push(z.map(String).join(' '));
		});
		try {
			await import('../../scripts/pruefdatei-c2-l13.ts');
		} finally {
			spy.mockRestore();
		}
		expect(ausgabe).toHaveLength(1);
		text = ausgabe[0];
	}, 60_000);

	/** Der Abschnitt bis zur nächsten Überschrift zweiter Stufe. */
	function abschnitt(anfang: string): string {
		const i = text.indexOf(anfang);
		expect(i, anfang).toBeGreaterThan(-1);
		const ende = text.indexOf('\n## ', i + anfang.length);
		return text.slice(i, ende < 0 ? undefined : ende);
	}

	it('beginnt mit Kopf und Katalog', () => {
		expect(text).toMatch(/^# Prüfdatei: Votum, Regel 43 Runde 2, Block C/);
		expect(abschnitt('## Katalog L13 (Seite «Lesarten»)')).toContain('- **Wahl «Alle Eigentümer»:**');
	});

	it.each(KARTEN)('%s hat je Zählweise und Fall einen Abschnitt', (id) => {
		const karte = abschnitt(`(\`${id}\`,`);
		for (const wahl of ['Anwesende und Vertretene', 'Alle Eigentümer']) {
			for (const fall of ['ohne Regel', 'mit Regel des Reglements', 'mit Enthaltungsklausel']) {
				expect(karte, `${id}, ${wahl}, ${fall}`).toContain(`L13 «${wahl}», ${fall}`);
			}
		}
		expect(karte).toContain('##### Ergebniskarte');
		expect(karte).toContain('##### Leitungsseite vor der Auszählung');
	});

	it('hat die Abschnitte ausserhalb der Karten', () => {
		for (const titel of [
			'## Rückkommen auf «Notwendige bauliche Massnahme», «Alle Eigentümer»',
			'## Rückkommen auf «Wichtigere Verwaltungshandlung», «Alle Eigentümer»',
			'## Abweichung der Leitung unter «Alle Eigentümer»: notwendige Arbeiten',
			'## Abweichung der Leitung unter «Alle Eigentümer»: wichtigere Verwaltungshandlung',
			'## Vor der Freigabe umgestellt',
			'## Regel, die sich nicht eindeutig einordnen lässt',
			'## Auszählmappe: Anleitung zu 9 und 7',
			'## Siegelzeile (aus dem Code)',
			'## Handbuch: Absatz zu L13'
		]) {
			expect(text, titel).toContain(titel);
		}
		// Unter L13 steht der Ausstand mit 9; eine Anleitung zur 7 gibt es dort nicht.
		const mappe = abschnitt('## Auszählmappe: Anleitung zu 9 und 7');
		expect(mappe).not.toMatch(/^- 7 /m);
		expect(abschnitt('## Rückkommen auf «Notwendige bauliche Massnahme»')).toContain('- **Siegelzeile:** (keine)');
	});
});
