import { afterAll, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fahreWaechter } from './waechterlauf';

/**
 * Der Gegentest zu `waechterlauf.ts` — der Stelle, an der **alle** anderen
 * Gegentests hängen.
 *
 * **Warum es ihn braucht.** Diese Hilfe entscheidet, ob ein roter Lauf als
 * Befund oder als Absturz gilt. Fällt diese Unterscheidung aus, sind nicht
 * einzelne Prüfungen blind, sondern alle auf einmal — und zwar in die
 * gefährliche Richtung: Ein abgestürzter Wächter bestätigt dann jeden Commit.
 *
 * Gemessen am 05.09.2026, vor dem Umbau, mit sechs absichtlich abstürzenden
 * Wächtern: **17 von 71 Prüfungen blieben grün.** Die übrigen fielen nur
 * deshalb, weil sie zusätzlich am gemeldeten Text prüfen.
 *
 * **Statt echte Wächter zu mutieren, baut dieser Test winzige Skripte**, die
 * genau eine Sorte Ende vorführen. Das ist der Unterschied zwischen «der Fall
 * kommt hier nicht vor» und «der Fall wird erkannt»: Zwei der drei Lücken
 * unten hatte kein echter Wächter je ausgelöst, und beide waren offen.
 */
const baum = mkdtempSync(join(tmpdir(), 'waechterlauf-'));

afterAll(() => rmSync(baum, { recursive: true, force: true }));

function skriptMit(inhalt: string): string {
	const pfad = join(baum, `w${Math.random().toString(36).slice(2)}.mjs`);
	writeFileSync(pfad, inhalt, 'utf8');
	chmodSync(pfad, 0o755);
	return pfad;
}

describe('erkennt einen Absturz und lässt ihn nicht als Befund durchgehen', () => {
	/*
	 * **Der Fall, der den Umbau ausgelöst hat.** Eine ungefangene Ausnahme endet
	 * in Node mit genau der `1`, die als Befund gilt. Am Rückgabewert sind die
	 * beiden nicht zu trennen.
	 */
	it('eine ungefangene Ausnahme, obwohl sie mit 1 endet wie ein Befund', () => {
		const w = skriptMit('throw new Error("kaputt");');
		expect(() => fahreWaechter(w, baum)).toThrow(/abgestürzt/);
	});

	/*
	 * **Die Spur muss nicht auf `stderr` allein stehen und der Wert nicht rot
	 * sein** (aus dem Code-Review): Ein Wächter, der seine Ausnahme abfängt, sie
	 * meldet und dann normal endet, galt vorher als sauberer grüner Lauf —
	 * `execFileSync` gab im Erfolgsfall nur `stdout` heraus.
	 */
	it('eine Spur auf stderr, obwohl der Rückgabewert 0 ist', () => {
		const w = skriptMit(
			'process.stderr.write("Error\\n    at foo (/x.mjs:1:1)\\n"); process.exit(0);'
		);
		expect(() => fahreWaechter(w, baum)).toThrow(/abgestürzt/);
	});

	/*
	 * **Ein von aussen beendeter Prozess hat gar keine Ausgabe**, an der sich
	 * etwas erkennen liesse — hier trägt allein das Signal. Diesen Fall fingen
	 * zwei Gegentests früher über `status !== 1`; der erste Umbau hatte ihn
	 * versehentlich mit weggenommen.
	 */
	it('ein per Signal beendeter Lauf, der nichts gesagt hat', () => {
		const w = skriptMit('process.kill(process.pid, "SIGKILL");');
		/*
		 * **Auf die Meldung geprüft, nicht nur auf «wirft»** (05.09.2026): Der
		 * erste Anlauf hier war grün, auch als die Signalprüfung ganz fehlte — die
		 * Wertprüfung fing den Fall mit ab, weil `status` bei einem Signal `null`
		 * ist. Damit war die Zeile unbelegt und ihre Meldung («Rückgabewert null»
		 * statt «beendet durch SIGKILL») für niemanden mehr nachvollziehbar.
		 */
		expect(() => fahreWaechter(w, baum)).toThrow(/beendet durch SIGKILL/);
	});

	/*
	 * **`exit(2)` ist der Ausschalter der Reissleine**, kein Regelverstoss
	 * (`scripts/lib/pruefmenge.mjs`). Ein Gegentest, der ihn als Befund
	 * verbucht, prüft die Reissleine statt seine Regel.
	 */
	it('ein Rückgabewert, der weder grün noch ein Befund ist', () => {
		const w = skriptMit('process.stdout.write("falscher Ausschalter\\n"); process.exit(2);');
		expect(() => fahreWaechter(w, baum)).toThrow(/Rückgabewert 2/);
	});

	it('ein Wächter, den es gar nicht gibt', () => {
		expect(() => fahreWaechter(join(baum, 'gibt-es-nicht.mjs'), baum)).toThrow(/abgestürzt/);
	});

	/*
	 * **Eine Ausgabe über dem Puffer-Deckel** (aus dem Code-Review, 05.09.2026).
	 * `spawnSync` bricht bei einem Megabyte ab und schneidet den Text ab; jede
	 * Prüfung daran wäre geraten. Das ist der einzige `error`-Fall, der hier
	 * wirklich vorkommen kann — ein fehlendes Skript startet `node` sehr wohl
	 * und fällt über die Stapelspur, weshalb dieser Zweig ohne diesen Fall
	 * unbelegt war.
	 */
	it('eine Ausgabe, die den Puffer sprengt', () => {
		const w = skriptMit(
			'const zeile = "x".repeat(1000) + "\\n";\n' +
				'for (let i = 0; i < 2000; i++) process.stdout.write(zeile);'
		);
		expect(() => fahreWaechter(w, baum)).toThrow(/nicht auswertbar/);
	});
});

describe('lässt einen echten Lauf in Ruhe', () => {
	it('ein Befund bleibt ein Befund', () => {
		const w = skriptMit('process.stdout.write("Befund: drei Stellen\\n"); process.exit(1);');
		const e = fahreWaechter(w, baum);
		expect(e.rot).toBe(true);
		expect(e.code, 'der gemessene Rückgabewert, nicht der gerechnete').toBe(1);
		expect(e.ausgabe).toContain('drei Stellen');
	});

	it('ein grüner Lauf bleibt grün', () => {
		const w = skriptMit('process.stdout.write("in Ordnung, 50 Dateien\\n");');
		const e = fahreWaechter(w, baum);
		expect(e.rot).toBe(false);
		expect(e.code).toBe(0);
		expect(e.ausgabe).toContain('50 Dateien');
	});

	/*
	 * **Eine Fundstelle sieht einer Stapelspur ähnlich.** Die Wächter melden
	 * `datei:12:5`, und das darf nicht als Absturz gelten — sonst wäre die
	 * Schranke schlimmer als keine, weil sie echte Befunde verschluckte.
	 */
	it('eine gemeldete Fundstelle ist keine Stapelspur', () => {
		const w = skriptMit(
			'process.stdout.write("src/routes/+page.svelte:12:5 fehlt das Ziel\\n"); process.exit(1);'
		);
		expect(fahreWaechter(w, baum).rot).toBe(true);
	});

	it('reicht die Ausgabe beider Ströme durch', () => {
		const w = skriptMit(
			'process.stdout.write("vorn\\n"); process.stderr.write("hinten\\n"); process.exit(1);'
		);
		const e = fahreWaechter(w, baum);
		expect(e.ausgabe).toContain('vorn');
		expect(e.ausgabe, 'stderr gehört dazu').toContain('hinten');
	});
});
