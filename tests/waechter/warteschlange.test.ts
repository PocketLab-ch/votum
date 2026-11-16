import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Wer jemanden in die Warteschlange stellt, verkündet den Stand.
 *
 * **Der Anlass, am 11.09.2026.** Der Auftraggeber hat am Eingang getestet und gemeldet: Die
 * Anwesenheitsseite ziehe nach einer Kartenanmeldung nicht nach. Nachgemessen an
 * zwei Sitzungen nebeneinander: Wird jemand **eingelassen**, aktualisiert sich
 * die Liste innert fünf Sekunden. Löst jemand seine **Karte** ein, passiert
 * zwanzig Sekunden lang nichts, obwohl er serverseitig längst wartet.
 *
 * Es gibt drei Türen in die Warteschlange: den Knopf «Jetzt anmelden», das
 * Abtippen des Kartencodes und das Abscannen des QR. Nur die erste verkündete
 * den Stand, und sie tat es in ihrer Route. Die beiden Kartenwege laufen über
 * `meldeNachEinloesungAn` und schwiegen.
 *
 * **Warum ein Wächter und nicht nur die Korrektur.** Die Fehlerklasse ist
 * «jemand ruft `meldeTeilnahmeAn` und vergisst die Verkündung», und sie ist
 * lautlos: Es fehlt nichts auf dem Bildschirm, es kommt nur nichts nach. Wer die
 * vierte Tür baut, soll nicht auf denselben Weg treten.
 *
 * **Was er NICHT kann:** Er sieht, dass beide Namen in derselben Datei stehen,
 * nicht dass sie am selben Pfad liegen. Eine Verkündung in einem Zweig, den der
 * Anmeldeweg nicht nimmt, ginge durch. Das ist die Näherung, die er ist; die
 * Wirkung selbst misst `e2e/durchspielen.mjs`.
 */

const WURZEL = join(process.cwd(), 'src');

/** Wer eine Anmeldung schreibt. */
const MELDER = /\bmeldeTeilnahmeAn\s*\(/;
/** Wer den Stand in den Ereignisstrom gibt. */
const VERKUENDER = /\bverkuendeStand\s*\(/;

function dateien(verzeichnis: string): string[] {
	const raus: string[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
		else if (pfad.endsWith('.ts')) raus.push(pfad);
	}
	return raus;
}

/**
 * Die Dateien, die eine Anmeldung schreiben — ohne die Stelle, an der
 * `meldeTeilnahmeAn` selbst **definiert** wird.
 *
 * Der Kern schreibt die Zeile; verkünden muss, wer ihn ruft. Stünde die
 * Verkündung im Kern, liefe sie auch beim Freigeben durch die Sitzungsleitung
 * mit, und die verkündet bereits selbst.
 */
function melder(): { pfad: string; inhalt: string }[] {
	return dateien(WURZEL)
		.map((pfad) => ({ pfad, inhalt: readFileSync(pfad, 'utf8') }))
		.filter((d) => MELDER.test(d.inhalt))
		.filter((d) => !/export async function meldeTeilnahmeAn/.test(d.inhalt));
}

describe('Jeder Weg in die Warteschlange verkündet den Stand', () => {
	it('findet überhaupt Aufrufer — sonst misst der Wächter nichts', () => {
		/*
		 * **Die Sichtprobe.** Wird `meldeTeilnahmeAn` einmal umbenannt, träfe der
		 * Ausdruck nirgends mehr, und die Prüfung darunter wäre für immer grün:
		 * derselbe lautlose Fehler, den sie verhindern soll, eine Ebene höher.
		 */
		expect(melder().length).toBeGreaterThanOrEqual(2);
	});

	it('lässt keinen Aufrufer ohne Verkündung stehen', () => {
		const stumm = melder()
			.filter((d) => !VERKUENDER.test(d.inhalt))
			.map((d) => d.pfad.replace(`${process.cwd()}/`, ''));
		expect(stumm).toEqual([]);
	});

	it('erkennt einen stummen Aufrufer', () => {
		// Der Gegentest: Ein Wächter, der nur am gesunden Bestand läuft, ist grün,
		// weil der Bestand gesund ist, und nicht, weil er misst.
		const stumm = 'await meldeTeilnahmeAn(op, versammlung, partei, "selbst");';
		const laut = `${stumm}\nawait verkuendeStand(op, versammlung);`;
		expect(MELDER.test(stumm) && !VERKUENDER.test(stumm)).toBe(true);
		expect(MELDER.test(laut) && VERKUENDER.test(laut)).toBe(true);
	});
});
