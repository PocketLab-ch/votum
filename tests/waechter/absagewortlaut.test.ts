import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FREMDES_TRAKTANDUM, fremdesTraktandum } from '$lib/domain/fehler';

/**
 * Wächter: Ein Sachverhalt, ein Satz.
 *
 * **Der Anlass** (08.09.2026). Dieselbe Absage stand an **dreizehn** Stellen im
 * Serverteil, mit zwei Wortlauten und zwei Kennungen: neunmal «Dieses
 * Traktandum gehört nicht zu dieser Versammlung», viermal «Traktandum nicht
 * gefunden»; achtmal `fremdes_traktandum`, einmal `unbekannt`. `weisung.ts`
 * trug beide Fassungen in derselben Datei. Ein Kommentar dort hielt den
 * Unterschied seit dem 07.09.2026 fest, ohne ihn zu schliessen.
 *
 * **Warum das mehr ist als Kosmetik.** Wer denselben Vorgang zweimal
 * verschieden gemeldet bekommt, sucht zwei Ursachen. «Nicht gefunden» schickt
 * ihn zur Frage, ob etwas kaputt ist; «gehört nicht dazu» sagt ihm, dass er auf
 * der falschen Versammlung steht. Nur eines davon stimmt, und es war
 * Zufallssache, welches er zu sehen bekam.
 *
 * **Warum ein Wächter und nicht bloss ein Helfer.** Der Helfer allein hält
 * niemanden davon ab, den Satz erneut hinzuschreiben — genau so ist die
 * Streuung entstanden. Diese Probe misst, dass er ausserhalb von `fehler.ts`
 * nirgends mehr als Zeichenkette vorkommt.
 */
const WURZEL = process.cwd();
const QUELLE = 'src/lib/domain/fehler.ts';

/** Alle Quelldateien unter `src/`, ohne die eine Stelle, an der der Satz steht. */
function quelldateien(verzeichnis: string): string[] {
	const raus: string[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...quelldateien(pfad));
		else if (/\.(ts|svelte)$/.test(eintrag)) raus.push(pfad);
	}
	return raus;
}

describe('Die Absage bei fremder Traktandumskennung', () => {
	it('steht als Zeichenkette nur an einer Stelle', () => {
		const dateien = quelldateien(join(WURZEL, 'src'));
		// Reissleine: Findet die Probe den Baum nicht mehr, ist sie grün und wertlos.
		expect(dateien.length).toBeGreaterThan(200);

		const fundstellen = dateien
			.filter((p) => relative(WURZEL, p) !== QUELLE)
			.filter((p) => readFileSync(p, 'utf8').includes(FREMDES_TRAKTANDUM))
			.map((p) => relative(WURZEL, p));

		expect(fundstellen).toEqual([]);
	});

	/*
	 * **Und der abgelöste Wortlaut kommt nicht zurück** (Code-Review
	 * 08.09.2026). Die erste Fassung verbot nur die Abschrift des **neuen**
	 * Satzes und liess die Abweichung durch — sie war grün, während im `load`
	 * derselben Route, die der Block gerade angefasst hatte, noch «Traktandum
	 * nicht gefunden» stand. Ein Wächter, der nur eine Richtung kennt,
	 * zertifiziert die andere.
	 */
	it('und der abgelöste Wortlaut steht nirgends mehr', () => {
		const dateien = quelldateien(join(WURZEL, 'src'));
		expect(dateien.length).toBeGreaterThan(200);

		const alt = dateien
			.filter((p) => /'Traktandum nicht gefunden/.test(readFileSync(p, 'utf8')))
			.map((p) => relative(WURZEL, p));

		expect(alt).toEqual([]);
	});

	/*
	 * **Der Gegentest zur Probe selbst.** Eine Suche, die den Satz gar nicht
	 * mehr findet, wäre ebenfalls grün — etwa nach einer Umformulierung, die den
	 * Helfer und die Konstante auseinanderlaufen lässt.
	 */
	it('und an dieser einen steht sie wirklich', () => {
		const inhalt = readFileSync(join(WURZEL, QUELLE), 'utf8');
		expect(inhalt).toContain(FREMDES_TRAKTANDUM);
	});

	it('trägt überall dieselbe Kennung und das Feld des Aufrufers', () => {
		const f = fremdesTraktandum('traktandumId');
		expect(f.kennung).toBe('fremdes_traktandum');
		expect(f.feld).toBe('traktandumId');
		expect(f.message).toBe(FREMDES_TRAKTANDUM);
	});
});
