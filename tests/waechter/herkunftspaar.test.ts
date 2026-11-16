import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Zwei Massnahmen, die einzeln richtig aussehen und zusammen nicht gehen.
 *
 * **Der Anlass, am 11.09.2026**, gefunden beim ersten Lauf von
 * `scripts/einrichten.sh` gegen einen gebauten Stand:
 *
 * Die Anwendung setzte `Referrer-Policy: no-referrer`. Chromium leitet den
 * `Origin`-Kopf eines Formularversands aus dieser Regel ab und schickt dann
 * `Origin: null` — auch bei einem Formular, das auf **dieselbe** Adresse zeigt.
 * SvelteKits Schutz gegen fremde Formulare vergleicht `Origin` mit der eigenen
 * Herkunft und weist mit 403 ab. Ergebnis: Jedes Formular, das nicht von Svelte
 * abgeschickt wird, ist tot — vor der Hydration und überall ohne JavaScript.
 *
 * Gemessen mit echtem Chromium, drei Regeln, ein Unterschied:
 *
 * | Regel | `Origin` |
 * |---|---|
 * | `no-referrer` | `null` |
 * | `same-origin` | die eigene Herkunft |
 * | `strict-origin-when-cross-origin` | die eigene Herkunft |
 *
 * **Und die Umkehrung ist die unangenehmere Hälfte** (von website-ab aus dem
 * Meldeportal beigesteuert, wo derselbe Befund am 26.08.2026 fiel): Unter
 * `no-referrer` **kann** die Herkunftsprüfung gar nichts leisten. Eine fremde
 * Seite setzt dieselbe Regel und schickt denselben `null`. Der Riegel sperrt
 * dann entweder alle aus oder niemanden.
 *
 * Daraus folgt der naheliegende und falsche Weg: Wer den Ausfall behebt, indem
 * er die Herkunftsprüfung lockert statt die Kopfzeile zu ändern, hat den Schutz
 * abgeschaltet und den Fehler weg. Deshalb hält dieser Wächter das **Paar** und
 * nicht die einzelne Zeile.
 *
 * **Warum es einen Wächter braucht und nicht nur die Korrektur.** Die Prüfung
 * in SvelteKit steht hinter `if (!__SVELTEKIT_DEV__)`
 * (`@sveltejs/kit/src/runtime/server/respond.js`) — sie läuft **nur im
 * Betrieb**. Derselbe Browser mit demselben Formular bekommt auf dem
 * Entwicklungsserver 303 und auf dem gebauten Stand 403. Diese Bauart übersteht
 * einen Monat; hier lag sie vom 08.08. bis zum 11.09.2026.
 *
 * **Was er NICHT kann:** Er liest Quelltext, nicht den fertigen Kopf einer
 * Antwort. Eine Regel, die ein Reverse-Proxy davor setzt, sieht er nicht. Dass
 * die Anwendung selbst sie nicht setzt, ist die Hälfte, die sich hier prüfen
 * lässt.
 */

const WURZEL = process.cwd();

/** Wo eine Herkunftsregel herkommen kann: gesetzte Kopfzeile oder `<meta>`. */
const QUELLEN = [
	join(WURZEL, 'src'),
	join(WURZEL, 'static')
];

function dateien(verzeichnis: string): string[] {
	let eintraege: string[];
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return [];
	}
	const raus: string[] = [];
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
		else if (/\.(ts|svelte|html)$/.test(pfad)) raus.push(pfad);
	}
	return raus;
}

/**
 * Eine Fundstelle für `no-referrer` als **Seitenregel**.
 *
 * Nicht getroffen wird `referrerpolicy="no-referrer"` an einem einzelnen `<img>`
 * oder `<a>`: Das gilt für dieses eine Element und nicht für Formulare, und es
 * ist dort oft genau richtig. Die Klammer davor unterscheidet die beiden.
 */
const SEITENREGEL =
	/(referrer-policy['"\s:=,()]+|name=["']referrer["'][^>]*content=["'])\s*no-referrer/i;
/** Dieselbe Regel an einem einzelnen Element — erlaubt. */
const ELEMENTREGEL = /referrerpolicy=["']no-referrer["']/i;

function seitenregeln(): { pfad: string; zeile: string }[] {
	const treffer: { pfad: string; zeile: string }[] = [];
	for (const wurzel of QUELLEN) {
		for (const pfad of dateien(wurzel)) {
			for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
				if (ELEMENTREGEL.test(zeile)) continue;
				if (SEITENREGEL.test(zeile)) {
					treffer.push({ pfad: pfad.replace(`${WURZEL}/`, ''), zeile: zeile.trim().slice(0, 120) });
				}
			}
		}
	}
	return treffer;
}

/** Ist SvelteKits Herkunftsprüfung eingeschaltet? Ohne Angabe ist sie es. */
function herkunftspruefungAn(): boolean {
	const konfig = readFileSync(join(WURZEL, 'vite.config.ts'), 'utf8');
	return !/checkOrigin\s*:\s*false/.test(konfig);
}

describe('Herkunftsregel und Herkunftsprüfung passen zusammen', () => {
	it('setzt nirgends «no-referrer» als Seitenregel, solange die Prüfung scharf ist', () => {
		if (!herkunftspruefungAn()) return; // Dann wäre es eine andere Abwägung.
		expect(seitenregeln()).toEqual([]);
	});

	it('findet eine Kopfzeile mit no-referrer', () => {
		// Der Gegentest: Ein Wächter, der nur am gesunden Bestand läuft, ist grün,
		// weil der Bestand gesund ist, und nicht, weil er misst.
		expect(SEITENREGEL.test("kopf.set('referrer-policy', 'no-referrer');")).toBe(true);
		expect(SEITENREGEL.test('<meta name="referrer" content="no-referrer" />')).toBe(true);
	});

	it('lässt die Regel am einzelnen Element in Ruhe', () => {
		const zeile = '<img src="…" referrerpolicy="no-referrer" />';
		expect(ELEMENTREGEL.test(zeile)).toBe(true);
	});

	it('liest überhaupt etwas — sonst misst der Wächter nichts', () => {
		/*
		 * **Die Sichtprobe.** Wird `src/` umgebaut oder die Endungsliste zu eng,
		 * fände der Wächter nirgends mehr etwas und wäre für immer grün: derselbe
		 * lautlose Fehler, den er verhindern soll, eine Ebene höher.
		 */
		const gelesen = QUELLEN.flatMap((w) => dateien(w));
		expect(gelesen.length).toBeGreaterThan(100);
		// Und die Stellen, um die es geht, müssen dabei sein: der Haken und das
		// Modul, das die Kopfzeilen setzt (seit GP-4, 12.11.2026).
		expect(gelesen.some((p) => p.endsWith('hooks.server.ts'))).toBe(true);
		expect(gelesen.some((p) => p.endsWith('sicherheitskopfzeilen.ts'))).toBe(true);
	});

	it('hält fest, dass die Anwendung eine Herkunftsregel überhaupt setzt', () => {
		/*
		 * Der Grund für die Kopfzeile bleibt bestehen: Der Zugangscode steht im
		 * Pfad von `/z/<code>` und darf bei einem Sprung nach draussen nicht in
		 * der Herkunftsangabe stehen. Wer sie ersatzlos entfernt, behebt diesen
		 * Wächter und öffnet das Leck.
		 */
		const kopfzeilen = readFileSync(
			join(WURZEL, 'src/lib/server/sicherheitskopfzeilen.ts'),
			'utf8'
		);
		expect(kopfzeilen).toMatch(
			/referrer-policy['"\s,]+['"](same-origin|strict-origin-when-cross-origin)['"]/
		);
	});
});
