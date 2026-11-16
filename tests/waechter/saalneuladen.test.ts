import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { neuladestellen } from '../../scripts/lib/saalneuladen.mjs';

/**
 * Der Gegentest zur Regel «in einer Seite wird nicht neu geladen»
 * (`scripts/lib/saalneuladen.mjs`).
 *
 * **Warum die Regel ausnahmslos ist.** Gemessen am 09.09.2026: Kippt das Netz
 * während eines `location.reload()`, ersetzt Chromium das Dokument durch seine
 * eigene Fehlerseite und kommt nicht zurück — im Saal eine tote Leinwand, auf
 * dem Telefon eine Partei, die nicht mehr abstimmen kann. Beides ohne
 * Fehlermeldung, denn auch die gehörte zur Seite.
 *
 * **Warum ein Gegentest und nicht nur ein Lauf über den Bestand.** Ein
 * Wächter, der nur am gesunden Baum läuft, ist grün, weil der Baum gesund ist,
 * nicht weil er misst. Unten steht deshalb je ein Fall, den er finden muss,
 * und je einer, den er in Ruhe lassen muss.
 */
describe('findet das Neuladen', () => {
	it('meldet den nackten Aufruf', () => {
		expect(neuladestellen('<script>\n\tlocation.reload();\n</script>')).toHaveLength(1);
	});

	it('meldet ihn auch mit Leerzeichen dazwischen', () => {
		expect(neuladestellen('<script>\n\tlocation . reload ();\n</script>')).toHaveLength(1);
	});

	it('nennt die Zeile', () => {
		const t = neuladestellen('a\nb\nlocation.reload();\n');
		expect(t[0].zeile).toBe(3);
	});
});

describe('lässt in Ruhe, was keiner ist', () => {
	it('eine Erwähnung im Zeilenkommentar', () => {
		expect(neuladestellen('\t// früher stand hier location.reload();')).toHaveLength(0);
	});

	it('eine Erwähnung im Blockkommentar über mehrere Zeilen', () => {
		expect(
			neuladestellen('/*\n * Hier stand einmal\n * location.reload();\n */\nconst a = 1;')
		).toHaveLength(0);
	});

	it('eine Erwähnung im Markup-Kommentar', () => {
		expect(
			neuladestellen('<!--\n\tKein location.reload() mehr, siehe neuladen.ts\n-->\n<div />')
		).toHaveLength(0);
	});

	it('und findet danach wieder, was nach dem Block kommt', () => {
		// Sonst hielte ein Kommentar den Wächter für den Rest der Datei still —
		// die schlimmere Richtung, in der er stumm bleibt statt zu viel zu melden.
		const t = neuladestellen('/*\n * location.reload()\n */\nlocation.reload();');
		expect(t).toHaveLength(1);
		expect(t[0].zeile).toBe(4);
	});

	it('auch im Markup-Kommentar über mehrere Zeilen, und danach wieder', () => {
		const t = neuladestellen('<!--\n\tlocation.reload()\n-->\nlocation.reload();');
		expect(t).toHaveLength(1);
		expect(t[0].zeile).toBe(4);
	});
});

describe('lässt sich von einem Kommentar auf derselben Zeile nicht stillstellen', () => {
	/*
	 * **Der Befund aus dem Code-Review vom 09.09.2026.** Die erste Fassung
	 * erklärte jede Zeile mit `/*` zum Kommentar. `location.reload(); /* Grund *​/`
	 * lieferte damit null Treffer — genau die Richtung, in der ein Wächter
	 * gefährlich ist: Er schweigt, und der Kopfkommentar behauptete, das könne
	 * nicht vorkommen.
	 */
	it('meldet den Aufruf VOR dem Kommentar', () => {
		expect(neuladestellen('location.reload(); /* weil sonst nichts hilft */')).toHaveLength(1);
	});

	it('meldet den Aufruf NACH dem Kommentar', () => {
		expect(neuladestellen('/* weil sonst nichts hilft */ location.reload();')).toHaveLength(1);
	});
});

describe('Sichtprobe am wirklichen Bestand', () => {
	function svelteDateien(verzeichnis: string): string[] {
		const raus: string[] = [];
		for (const eintrag of readdirSync(verzeichnis)) {
			const pfad = join(verzeichnis, eintrag);
			if (statSync(pfad).isDirectory()) raus.push(...svelteDateien(pfad));
			else if (pfad.endsWith('.svelte') || pfad.endsWith('.ts')) raus.push(pfad);
		}
		return raus;
	}

	/*
	 * **Über `src` und nicht nur über `src/routes`** (Code-Review 09.09.2026).
	 * Die Bausteine unter `src/lib` gehören genauso dazu: Ein Neuladen in einer
	 * geteilten Komponente trifft jede Seite, die sie zeigt, und `neuladen.ts`
	 * selbst blieb ausgerechnet ungeprüft. Auch `.ts` wird gelesen, denn ein
	 * Baustein muss keine Svelte-Datei sein.
	 */
	const dateien = svelteDateien('src');

	it('findet überhaupt Dateien — sonst misst die Probe nichts', () => {
		expect(dateien.length).toBeGreaterThan(50);
	});

	it('nichts unter `src` lädt neu', () => {
		const treffer = dateien.flatMap((d) => neuladestellen(readFileSync(d, 'utf8'), d));
		expect(treffer.map((t) => `${t.datei}:${t.zeile}`)).toEqual([]);
	});
});
