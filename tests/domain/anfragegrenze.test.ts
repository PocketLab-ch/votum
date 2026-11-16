/**
 * Die Anfragegrenze des Betriebs fasst das grösste Paket.
 *
 * Gefunden am 15.10.2026 (Auftrag F2): `compose.prod.yml` setzte kein
 * `BODY_SIZE_LIMIT`, adapter-node wies deshalb alles über 512 KB mit 413 ab,
 * während Prüfseite und Einspielen laut Code 200 MB annahmen. Auf Dev war das
 * unsichtbar, weil der Entwicklungsserver keine solche Grenze kennt. Die Grenze
 * steht in der Compose-Datei, die Grössen von Paket und Ablage im Code; diese
 * Prüfung hält sie beieinander.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
// Beide Module lesen beim Laden die Umgebung; gebraucht wird nur ihre Zahl.
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { HOECHSTGROESSE as ABLAGE_HOECHSTGROESSE } from '$lib/server/dateien';
import { PAKET_HOECHSTGROESSE } from '$lib/server/paketpruefung';
import { grenzverstoss, HOECHSTZAHL_JE_ABSENDEN, ZU_VIELE } from '$lib/nachweisgrenze';

/** Wie adapter-node die Angabe liest: Zahl mit K, M oder G, Faktor 1024. */
function alsBytes(angabe: string): number {
	const m = /^(\d+)([KMG]?)$/i.exec(angabe.trim());
	if (!m) throw new Error(`BODY_SIZE_LIMIT nicht lesbar: ${angabe}`);
	const faktor = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[2].toUpperCase() as '' | 'K' | 'M' | 'G'];
	return Number(m[1]) * faktor;
}

function grenzeImBetrieb(): number {
	const compose = readFileSync(new URL('../../compose.prod.yml', import.meta.url), 'utf8');
	const treffer = /^\s+BODY_SIZE_LIMIT:\s*(\S+)\s*$/m.exec(compose);
	expect(treffer, 'compose.prod.yml setzt kein BODY_SIZE_LIMIT; adapter-node fiele auf 512 KB zurück').not.toBeNull();
	return alsBytes(treffer![1]);
}

describe('Anfragegrenze im Betrieb', () => {
	it('fasst das grösste Abschlusspaket samt Zeitstempel', () => {
		// 1 MB Zeitstempel (Prüfseite) und Spielraum für die Hülle des Formulars.
		expect(grenzeImBetrieb()).toBeGreaterThan(PAKET_HOECHSTGROESSE + 1024 * 1024);
	});

	it('fasst die grösste Datei der Ablage', () => {
		expect(grenzeImBetrieb()).toBeGreaterThan(ABLAGE_HOECHSTGROESSE);
	});

	it('fasst die höchste Zahl Nachweise je Absenden, mit Reserve für das Formular', () => {
		// Produktentscheid 16.10.2026: Sonst käme die nackte 413-Seite, bevor die
		// Absage der Aktion greifen kann. Mindestens 1 MB für die übrigen Felder und
		// die Hülle; bei 52M bleiben 2 MB.
		expect(grenzeImBetrieb()).toBeGreaterThan(
			HOECHSTZAHL_JE_ABSENDEN * ABLAGE_HOECHSTGROESSE + 1024 * 1024
		);
	});

	it('liest die Angabe wie adapter-node', () => {
		expect(alsBytes('512K')).toBe(512 * 1024);
		expect(alsBytes('52M')).toBe(52 * 1024 * 1024);
	});
});

describe('Grenze der Nachweise im Browser', () => {
	const datei = (size: number, name = 'scan.pdf') => ({ size, name });

	it('lässt fünf volle Dateien durch', () => {
		expect(grenzverstoss(Array(5).fill(datei(ABLAGE_HOECHSTGROESSE)))).toBe('');
	});

	it('hält die sechste an, mit demselben Satz wie der Server', () => {
		expect(grenzverstoss(Array(6).fill(datei(1000)))).toBe(ZU_VIELE);
	});

	it('zählt leere Felder nicht', () => {
		expect(grenzverstoss([...Array(5).fill(datei(1000)), datei(0)])).toBe('');
	});

	it('hält eine zu grosse Datei an und nennt sie', () => {
		expect(grenzverstoss([datei(ABLAGE_HOECHSTGROESSE + 1, 'riesig.pdf')])).toMatch(/«riesig\.pdf»/);
	});
});
