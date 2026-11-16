/**
 * Der Hausklassenwächter — und ob er wirklich rot wird.
 *
 * **Warum ein Test für einen Wächter** (Erfahrung 02.09.2026): Am selben Tag
 * wurde der Seitenaufbau-Wächter falsch-rot, sobald er sein Ziel erreichte, und
 * eine Sichtprobe deckte für eine zweite mit. Ein Wächter, der niemals rot
 * wird, ist eine Zeile im Prüflauf und sonst nichts.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';

const WURZEL = process.cwd();
const SKRIPT = join(WURZEL, 'scripts/check-hausklassen.mjs');

let baum: string | null = null;

function baumMit(dateien: Record<string, string>): string {
	baum = mkdtempSync(join(tmpdir(), 'hausklassen-'));
	for (const [weg, inhalt] of Object.entries(dateien)) {
		const ziel = join(baum, weg);
		mkdirSync(join(ziel, '..'), { recursive: true });
		writeFileSync(ziel, inhalt);
	}
	return baum;
}

function lauf(verzeichnis: string): { code: number; text: string } {
	// Ein `exit(2)` der Reissleine ginge als gefundener Regelverstoss durch —
	// davor schützt der Wurf in `fahreWaechter`, nicht dieses Feld. `code` steht
	// hier nur, weil die Fälle unten ihre Erwartung als Zahl schreiben.
	const { code, ausgabe } = fahreWaechter(SKRIPT, verzeichnis);
	return { code, text: ausgabe };
}

/**
 * Die Heimat der Klassen. Der Wächter prüft seit dem 02.09.2026, ob sie dort
 * noch stehen — ohne diese Datei bräche jeder Prüfbaum an einer Frage, um die
 * es in seiner Probe gar nicht geht.
 */
const APPCSS =
	'.einleitung {\n\tmax-width: var(--lesebreite);\n\tcolor: var(--text-leise);\n}\n' +
	'.lesebreite {\n\tmax-width: var(--lesebreite);\n}\n' +
	'.flach {\n\tbackground: none;\n\tborder: none;\n}\n';

/** Genug Dateien für die erste Sichtprobe, mit einer Verwendung für die zweite. */
function fueller(anzahl: number): Record<string, string> {
	const raus: Record<string, string> = {};
	for (let i = 0; i < anzahl; i++) {
		raus[`src/routes/f${i}/+page.svelte`] = '<p>Etwas.</p>\n';
	}
	raus['src/routes/nutzer/+page.svelte'] =
		'<p class="einleitung">Ein Erklärsatz.</p>\n<p class="lesebreite">Fliesstext.</p>\n' +
		'<button class="flach">mehr</button>\n';
	raus['src/app.css'] = APPCSS;
	return raus;
}

afterEach(() => {
	if (baum) rmSync(baum, { recursive: true, force: true });
	baum = null;
});

describe('Der Hausklassenwächter', () => {
	it('ist grün, wenn niemand die Klassen umschreibt', () => {
		const e = lauf(baumMit(fueller(60)));
		expect(e.code).toBe(0);
		expect(e.text).toContain('in Ordnung');
	});

	/*
	 * **Der Fall, um den es geht.** Fünfzehn Seiten definierten `.einleitung`
	 * selbst — mit fünf verschiedenen Breiten und zwei Farben.
	 */
	it('wird rot, wenn eine Seite die Farbe umschreibt', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/eigen/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\tcolor: var(--text);\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('eigen/+page.svelte:3');
		expect(e.text).toContain('color: var(--text)');
	});

	it('wird rot, wenn eine Seite die Breite umschreibt', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/breit/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\tmax-width: 46rem;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('max-width: 46rem');
	});

	/*
	 * **Feinschliff bleibt erlaubt.** Ein `margin`, das den Absatz an seine
	 * Überschrift heranzieht, ändert die Aussage der Klasse nicht — genau so
	 * steht es in `Eingriffe.svelte`.
	 */
	it('lässt einen Abstand in Ruhe', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/abstand/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\tmargin: 0;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Auch als Nachfahre.** `.eingriffe .einleitung { color: … }` hebt die
	 * Bedeutung genauso auf — und die Meldung muss den ganzen Selektor nennen,
	 * sonst sucht man die Zeile vergeblich.
	 */
	it('sieht die Umschreibung auch in einem zusammengesetzten Selektor', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/tief/+page.svelte':
					'<div class="kasten"><p class="einleitung">Text.</p></div>\n' +
					'<style>\n\t.kasten .einleitung {\n\t\tcolor: red;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('.kasten .einleitung');
	});

	/*
	 * **Die drei Verstecke des ersten Anlaufs** (02.09.2026, zweite Runde des
	 * Code-Reviews). Er suchte mit einer Regex nach `.<klasse> {` und übersah
	 * damit die im Bestand häufigere Schreibweise — sechs Definitionen
	 * überlebten den Umbau unbemerkt. Seither liest der Wächter mit `postcss`.
	 */
	/*
	 * **`:not(.flach)` ist keine Umschreibung, sondern eine Ausnahme**
	 * (03.09.2026). Eine Seite, die ihre Knöpfe pauschal gestaltet
	 * (`button { background: … }`), muss die Hausklasse davon ausnehmen können —
	 * sonst gewinnt die seitenlokale Regel über den Datei-Hash, und der flache
	 * Knopf steht wieder als Kasten da. Der Wächter las das zuerst als
	 * Umschreibung und meldete ausgerechnet die Behebung als Befund.
	 */
	it('lässt eine Ausnahme in :not() in Ruhe', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/ausnahme/+page.svelte':
					'<button class="flach">mehr</button>\n' +
					'<style>\n\tbutton:not(.flach) {\n\t\tbackground: red;\n\t\tborder: 1px solid;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(0);
	});

	it('sieht die Umschreibung einer Hausklasse trotz einer Ausnahme daneben', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/beides/+page.svelte':
					'<button class="flach">mehr</button>\n' +
					'<style>\n\tbutton:not(.leise).flach {\n\t\tbackground: red;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('.flach');
	});

	/*
	 * **Die pauschale Elementregel** (03.09.2026). Sie nennt die Klasse nicht und
	 * hebt sie trotzdem auf: `button { background: … }` traegt in Svelte den
	 * Datei-Hash (0-1-1) und schlaegt das globale `.flach` (0-1-0). Gemessen
	 * stand der flache Knopf danach als gruener Kasten mit grauer Schrift da.
	 */
	it('wird rot, wenn eine Seite mit .flach alle Knöpfe pauschal gestaltet', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/pauschal/+page.svelte':
					'<button class="flach">mehr</button>\n' +
					'<style>\n\tbutton {\n\t\tbackground: var(--akzent);\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('button:not(.flach)');
	});

	it('lässt die pauschale Regel in Ruhe, wo die Seite .flach gar nicht benutzt', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/ohneflach/+page.svelte':
					'<button>los</button>\n' +
					'<style>\n\tbutton {\n\t\tbackground: var(--akzent);\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(0);
	});

	it('sieht eine mehrzeilige Selektorliste', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/mehrzeilig/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung,\n\t.leer {\n\t\tmax-width: 46rem;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('max-width: 46rem');
	});

	it('sieht eine Umschreibung in :global()', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/global/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t:global(.einleitung) {\n\t\tcolor: red;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain(':global(.einleitung)');
	});

	it('sieht die font-Kurzform und width', () => {
		const kurz = lauf(
			baumMit({
				...fueller(60),
				'src/routes/kurz/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\tfont: 700 2rem/1.2 sans-serif;\n\t}\n</style>\n'
			})
		);
		expect(kurz.code).toBe(1);
		expect(kurz.text).toContain('font: 700 2rem/1.2 sans-serif');

		const breit = lauf(
			baumMit({
				...fueller(60),
				'src/routes/weit/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\twidth: 90rem;\n\t}\n</style>\n'
			})
		);
		expect(breit.code).toBe(1);
		expect(breit.text).toContain('width: 90rem');
	});

	it('übersieht eine Umschreibung im Kommentar', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/erklaert/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t/* Frueher stand hier .einleitung { color: red; } */\n</style>\n'
			})
		);
		expect(e.code).toBe(0);
	});

	it('sieht max-inline-size wie max-width', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/logisch/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\tmax-inline-size: 90rem;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('max-inline-size: 90rem');
	});

	/*
	 * **Der `<style>`-Block gehört dem Parser** (02.09.2026, dritte Runde des
	 * Code-Reviews). Ein zweiter Anlauf las die Regeln zwar mit `postcss`,
	 * schnitt den Block aber selbst mit einer Regex heraus. Beide Richtungen
	 * gingen daneben: Eine Zeichenkette `'<style>'` im `<script>` verschluckte
	 * den echten Block, und ein `<style>` in einem HTML-Kommentar wurde als
	 * Befund gemeldet.
	 */
	it('lässt sich von einem <style> in einer Zeichenkette nicht abhängen', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/tarnung/+page.svelte':
					'<script>\n\tconst x = \'<style>\';\n</script>\n' +
					'<p class="einleitung">Text.</p>\n' +
					'<style>\n\t.einleitung {\n\t\tcolor: red;\n\t}\n</style>\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('color: red');
	});

	it('übersieht einen <style>-Block in einem HTML-Kommentar', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/routes/auskommentiert/+page.svelte':
					'<p class="einleitung">Text.</p>\n' +
					'<!--\n<style>\n\t.einleitung { color: red; }\n</style>\n-->\n'
			})
		);
		expect(e.code).toBe(0);
	});

	/*
	 * **Die drei Sichtproben.** Ohne sie wäre der Wächter grün, wenn er nichts
	 * findet — und nichts finden kann.
	 */
	it('bricht ab, wenn die Klasse aus ihrer Heimat verschwindet', () => {
		const e = lauf(
			baumMit({
				...fueller(60),
				'src/app.css': '.lesebreite {\n\tmax-width: var(--lesebreite);\n}\n'
			})
		);
		expect(e.code).toBe(1);
		expect(e.text).toContain('steht nicht mehr in src/app.css');
	});

	it('bricht ab, wenn er kaum Dateien sieht', () => {
		const e = lauf(baumMit({ 'src/app.css': APPCSS, 'src/routes/eine/+page.svelte': '<p>x</p>\n' }));
		expect(e.code).toBe(1);
		expect(e.text).toContain('greift nicht');
	});

	/*
	 * **Je Klasse eine Sichtprobe** (aus dem Code-Review). Ein gemeinsamer
	 * Zähler wäre über null geblieben, sobald EINE der beiden Klassen aus dem
	 * Markup verschwindet — die andere hätte für sie mitgedeckt, und ihre
	 * Bewachung wäre still wirkungslos geworden.
	 */
	it('bricht ab, wenn niemand die Klassen mehr benutzt', () => {
		const ohne: Record<string, string> = { 'src/app.css': APPCSS };
		for (let i = 0; i < 60; i++) ohne[`src/routes/f${i}/+page.svelte`] = '<p>x</p>\n';
		const e = lauf(baumMit(ohne));
		expect(e.code).toBe(1);
		expect(e.text).toContain('benutzt `einleitung`');
	});

	it('bricht ab, wenn nur EINE der beiden Klassen verschwindet', () => {
		const nurEine: Record<string, string> = { 'src/app.css': APPCSS };
		for (let i = 0; i < 60; i++) nurEine[`src/routes/f${i}/+page.svelte`] = '<p>x</p>\n';
		nurEine['src/routes/nutzer/+page.svelte'] = '<p class="einleitung">Nur diese.</p>\n';
		const e = lauf(baumMit(nurEine));
		expect(e.code).toBe(1);
		expect(e.text).toContain('benutzt `lesebreite`');
	});
});
