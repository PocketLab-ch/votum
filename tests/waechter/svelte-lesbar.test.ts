import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Lesbarkeitswächter (`scripts/check-svelte-lesbar.mjs`).
 *
 * **Was er bewacht, ist ein blinder Fleck und kein Fehler.** Sechs Wächter
 * arbeiten auf dem Svelte-Baum, und alle sechs überspringen eine Datei, die der
 * Parser nicht lesen kann — je einzeln richtig, zusammengenommen ein Loch: Die
 * Datei entzieht sich jeder Prüfung, und alle melden «in Ordnung».
 *
 * Genau das ist am 02.09.2026 passiert: Ein `</div>` zu viel, und der
 * Seitenaufbau-Wächter zählte unverändert weiter, als wäre nichts.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-svelte-lesbar.mjs');

function fahre(wurzel: string) {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

/** Ein Baum mit genug Dateien, damit die Sichtprobe nicht anschlägt. */
function baum(optionen: { kaputt?: boolean; dateien?: number } = {}) {
	const { kaputt = false, dateien = 60 } = optionen;
	const wurzel = mkdtempSync(join(tmpdir(), 'lesbar-'));
	verzeichnisse.push(wurzel);
	for (let i = 0; i < dateien; i++) {
		const ordner = join(wurzel, 'src', 'routes', `s${i}`);
		mkdirSync(ordner, { recursive: true });
		const inhalt =
			i === 0 && kaputt
				? '<div class="a">\n\t<section>Text</section>\n\t</section>\n</div>\n'
				: '<div class="a">\n\t<p>Text</p>\n</div>\n';
		writeFileSync(join(ordner, '+page.svelte'), inhalt);
	}
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('Der Lesbarkeitswächter', () => {
	it('bleibt grün, solange jede Datei lesbar ist', () => {
		const { rot, ausgabe } = fahre(baum());
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/alle 60 Dateien lesbar/);
	});

	/*
	 * **Der Fall, um den es geht.** Eine Datei, die der Parser nicht lesen kann,
	 * darf nicht stillschweigend aus der Zählung fallen — sie muss den Lauf
	 * anhalten und beim Namen genannt werden.
	 */
	it('wird rot und nennt die Datei, die der Parser nicht lesen kann', () => {
		const { rot, ausgabe } = fahre(baum({ kaputt: true }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/1 von 60 Dateien kann der Parser nicht lesen/);
		expect(ausgabe).toContain('s0/+page.svelte');
	});

	/*
	 * **Die Sichtprobe.** Ein Lauf, der kaum Dateien sieht, meldete sonst
	 * dauerhaft «alle 0 lesbar» und sähe aus wie Ordnung — dieselbe Falle, gegen
	 * die er selbst gebaut ist.
	 */
	it('wird rot, wenn er kaum Dateien sieht', () => {
		const { rot, ausgabe } = fahre(baum({ dateien: 3 }));
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/der Lauf greift nicht/);
	});
});
