import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Vorgabeknopf-Wächter (`scripts/check-vorgabeknopf.mjs`).
 *
 * **Warum er sein muss.** Der Wächter liest einen Syntaxbaum. Greift eine
 * Abfrage daneben, findet er nichts und ist damit **immer grün**, und zwar
 * lautlos. Genau das ist im selben Repo mehrfach vorgekommen.
 *
 * Geprüft wird beides: dass er den schlechten Fall in jeder Bauart findet, die
 * im Bestand vorkommt, und dass er den guten in Ruhe lässt. Der zweite ist der
 * wichtigere; ein Wächter, der im gewohnten Zustand rot ist, wird abgeschaltet
 * statt gelesen.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-vorgabeknopf.mjs');

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

function baumMit(inhalt: string): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'vorgabeknopf-'));
	verzeichnisse.push(wurzel);
	mkdirSync(join(wurzel, 'src', 'routes'), { recursive: true });
	writeFileSync(join(wurzel, 'src', 'routes', '+page.svelte'), inhalt, 'utf8');
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('findet den schlechten Fall', () => {
	it('erster von mehreren Knöpfen ohne Angabe', () => {
		const { rot, ausgabe } = fahre(
			baumMit(`<form method="POST" action="?/stellvertretend">
	<input name="begruendung" />
	<button type="submit" name="wahl" value="yes">Ja erfassen</button>
	<button type="submit" name="wahl" value="no">Nein erfassen</button>
</form>`)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('wahl=yes');
	});

	it('ein Knopf OHNE type ist ein Absendeknopf', () => {
		// Die Vorgabe in HTML ist `submit`. Wer sie voraussetzt, sieht ihn nicht.
		const { rot, ausgabe } = fahre(
			baumMit(`<form method="POST" action="?/x">
	<button name="wahl" value="yes">Ja</button>
	<button type="submit" name="wahl" value="no">Nein</button>
</form>`)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('wahl=yes');
	});

	it('«keiner» ohne `disabled` trägt nicht', () => {
		const { rot, ausgabe } = fahre(
			baumMit(`<form method="POST" action="?/x">
	<button type="submit" data-vorgabe="keiner" name="wahl" value="yes">Ja</button>
	<button type="submit" name="wahl" value="no">Nein</button>
</form>`)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('nicht\n  gesperrt');
	});

	it('ein `disabled` aus einem Ausdruck trägt nicht', () => {
		// Zur Laufzeit kann es falsch sein; die Zusicherung wäre dann eine Behauptung.
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/x">
	<button type="submit" disabled={laeuft} data-vorgabe="keiner">Kein Vorgabeknopf</button>
	<button type="submit" name="wahl" value="no">Nein</button>
</form>`)
		);
		expect(rot).toBe(true);
	});

	it('eine Angabe ohne Wert sagt nichts', () => {
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/x">
	<button type="submit" data-vorgabe name="wahl" value="yes">Ja</button>
	<button type="submit" name="wahl" value="no">Nein</button>
</form>`)
		);
		expect(rot).toBe(true);
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	it('der gesperrte Riegel', () => {
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/stellvertretend">
	<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
	<input name="begruendung" />
	<button type="submit" name="wahl" value="yes">Ja erfassen</button>
	<button type="submit" name="wahl" value="no">Nein erfassen</button>
</form>`)
		);
		expect(rot).toBe(false);
	});

	it('der erste Knopf IST die Hauptsache und sagt es', () => {
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/summen">
	<input name="vermerk" />
	<button type="submit" data-vorgabe="Summen erfassen">Summen erfassen</button>
	<button type="submit" name="zuruecknehmen" value="ja">Zurücknehmen</button>
</form>`)
		);
		expect(rot).toBe(false);
	});

	it('ein Formular mit genau einem Absendeknopf', () => {
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/x">
	<input name="a" />
	<button type="submit">Speichern</button>
</form>`)
		);
		expect(rot).toBe(false);
	});

	it('ein Knopf, der über `form=` einem anderen Formular gehört', () => {
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/speichern">
	<input name="a" />
	<button type="submit" form="entfernen" name="weg" value="1">Entfernen</button>
	<button type="submit">Speichern</button>
</form>`)
		);
		expect(rot).toBe(false);
	});
});

/**
 * **Die Sichtprobe am echten Baum.** Ein Wächter, der nur gegen ausgedachte
 * Schnipsel läuft, kann an den wirklichen Dateien vorbeigreifen.
 */
describe('am Bestand', () => {
	/*
	 * **Eigene Zeitgrenze** (19.10.2026, unter Last gemessen): Die Probe fährt
	 * den Wächter als eigenen Node-Prozess über den ganzen Bestand. Ein Lauf ist
	 * das Minimum; schneller ginge es nur, indem man den Wächter nachbaut und
	 * damit genau nicht mehr prüft, was ausgeliefert wird. Zwei gleichzeitige
	 * Läufe der Nicht-DB-Suite brachten 5,5 beziehungsweise 5,4 s und rissen
	 * die Vorgabe von 5 s. Die 20 Sekunden lassen Luft, ohne einen hängenden
	 * Lauf zu verdecken.
	 */
	it('ist grün und hat dabei etwas gesehen', { timeout: 20000 }, () => {
		const { rot, ausgabe } = fahre(process.cwd());
		expect(rot).toBe(false);
		const zahlen = ausgabe.match(/(\d+) Formulare durchgesehen, (\d+) davon/);
		expect(zahlen).not.toBeNull();
		expect(Number(zahlen![1])).toBeGreaterThanOrEqual(240);
		expect(Number(zahlen![2])).toBeGreaterThanOrEqual(6);
	});
});
