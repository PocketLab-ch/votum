/**
 * Stilvariablenwächter.
 *
 * **Der Anlass, am 08.08.2026.** An zwanzig Stellen stand
 * `border: 1px solid var(--rand, #d8dee4)`. `--rand` gibt es — als **Abstand**
 * (`1rem`). Der Rückfallwert greift deshalb nie, der Browser setzt `1rem` als
 * Farbe ein, die Deklaration wird ungültig und **der Rahmen verschwindet
 * spurlos**. Im Browser nachgemessen: `0px / none` statt `1px / solid`.
 *
 * Keine Fehlermeldung, kein Werkzeug, das es bemängelt hätte — `svelte-check`
 * prüft TypeScript, nicht CSS. Aufgefallen ist es beiläufig in einem
 * Prüfbericht, nach Monaten.
 *
 * Zwei Regeln schliessen die Klasse:
 *
 *   1. **Keine Variable ohne Definition.** Wer `var(--leise)` schreibt und
 *      `--text-leise` meint, bekommt im hellen Thema den Rückfallwert und im
 *      dunklen denselben — die Umschaltung greift nicht mehr.
 *   2. **Kein Rückfallwert auf einer Variablen, die es gibt.** Er greift nie und
 *      täuscht eine Absicherung vor, die nicht besteht. Genau daran ist `--rand`
 *      so lange unbemerkt geblieben: Wer die Zeile las, sah eine Farbe.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import { festeAttributwerte, jedesElement, svelteBaum } from './svelte-baum.mjs';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.cwd();

/**
 * Variablen, die zur Laufzeit am Element gesetzt werden — im Markup über
 * `style="--x: …"` oder aus JavaScript über `setProperty`. Sie stehen in keinem
 * Stilblock und sind trotzdem definiert.
 */
const ZUR_LAUFZEIT = /(?:style:|style="|setProperty\(\s*['"`])\s*(--[\w-]+)/g;
const IM_STILBLOCK = /^\s*(--[\w-]+)\s*:/gm;
const BENUTZT = /var\(\s*(--[\w-]+)\s*(,)?/g;

function dateienUnter(verzeichnis) {
	const treffer = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return treffer;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateienUnter(pfad));
		else if (/\.(svelte|css)$/.test(eintrag)) treffer.push(pfad);
	}
	return treffer;
}

const dateien = mindestens(
	dateienUnter(join(WURZEL, 'src')),
	80,
	'Quelldateien unter src/'
);

/**
 * Zwei Töpfe, weil Regel 2 nur für den ersten gilt.
 *
 * Eine Variable aus einem Stilblock steht am ganzen Baum zur Verfügung — ein
 * Rückfallwert daneben ist toter Text. Eine Variable, die **je Element** gesetzt
 * wird (`style="--tiefe: 2"`, `setProperty('--weg', …)`), ist dagegen an anderen
 * Elementen bestimmungsgemäss nicht da; dort ist der Rückfallwert die Absicht
 * und nicht der Fehler.
 */
const imStilblock = new Set();
const amElement = new Set();

/**
 * Den CSS-Baum einer Datei holen — auch aus einer Svelte-Vorlage.
 *
 * **Warum jetzt ein Parser und kein regulärer Ausdruck mehr** (24.08.2026, auf
 * Frage des Auftraggebers «sind Wächter state of the art oder Flickwerk?»). Die erste
 * Fassung las die Datei Zeile für Zeile mit `var\(\s*(--[\w-]+)`. Das meldet
 * auch, was in einem **Kommentar** steht — und in diesem Projekt stehen in den
 * Kommentaren ganze Beispielzeilen, weil dort erklärt wird, was schiefging.
 * Umgekehrt sieht es eine über zwei Zeilen umbrochene Angabe nicht.
 *
 * `postcss` liefert Deklarationen ohne Kommentare, mit Datei und Zeile.
 * `postcss-html` schneidet den `<style>`-Block aus der Svelte-Datei.
 *
 * Gibt `null`, wenn die Datei keinen Stil enthält — das ist kein Fehler.
 */
function stilbaum(pfad, inhalt) {
	try {
		// **`syntax.parse`, nicht `postcss.parse` mit `syntax`.** Beim ersten
		// Anlauf stand hier `postcss.parse(inhalt, { from, syntax })` — die Angabe
		// wird dort schlicht übergangen, und der Wächter las nur noch `app.css`:
		// 74 Verwendungen statt 1988. Gefunden hat es die Sichtprobe.
		if (pfad.endsWith('.svelte')) return postcssHtml().parse(inhalt, { from: pfad });
		return postcss.parse(inhalt, { from: pfad });
	} catch {
		// Eine Datei, die sich nicht als CSS lesen lässt, hat keinen Stilblock.
		return null;
	}
}

/** Jede Deklaration jeder Datei, einmal gesammelt. */
const baeume = new Map();
for (const pfad of dateien) {
	const baum = stilbaum(pfad, readFileSync(pfad, 'utf8'));
	if (baum) baeume.set(pfad, baum);
}

for (const [, baum] of baeume) {
	baum.walkDecls((d) => {
		if (d.prop.startsWith('--')) imStilblock.add(d.prop);
	});
}

/*
 * Was **am Element** gesetzt wird (`style="--tiefe: 2"`, `setProperty('--weg')`),
 * steht nicht im Stilbaum. Dafür bleibt der Textdurchlauf — er sucht nach genau
 * zwei Schreibweisen und nicht nach beliebigem CSS.
 */
for (const pfad of dateien) {
	const inhalt = readFileSync(pfad, 'utf8');
	for (const m of inhalt.matchAll(ZUR_LAUFZEIT)) amElement.add(m[1]);
}

/*
 * **Und `var(--x)` im Markup selbst.**
 *
 * `Marke.svelte` setzt `fill="var(--grund)"` an einem `<rect>` — eine
 * Verwendung wie jede andere, nur ausserhalb des Stilblocks. Der Vorgänger fand
 * sie (er las die Datei als Text), die erste postcss-Fassung nicht mehr: 1987
 * statt 1988. Ein Wächter, der beim Umbau eine Stelle **verliert**, ist der
 * schlechtere — auch wenn er sonst genauer ist.
 *
 * Gelesen wird über den Svelte-Baum, nicht über einen regulären Ausdruck: So
 * zählen nur echte Attributwerte und keine Beispielzeilen aus Kommentaren.
 */
const imMarkup = [];
for (const pfad of dateien.filter((p) => p.endsWith('.svelte'))) {
	const baum = svelteBaum(pfad, readFileSync(pfad, 'utf8'));
	if (!baum) continue;
	jedesElement(baum.fragment, (el) => {
		for (const wert of festeAttributwerte(el)) {
			for (const m of wert.matchAll(BENUTZT)) imMarkup.push({ pfad, name: m[1], komma: m[2] });
		}
	});
}

const definiert = new Set([...imStilblock, ...amElement]);

const befunde = [];
let verwendungen = 0;

for (const { pfad, name, komma } of imMarkup) {
	verwendungen++;
	const ort = relative(WURZEL, pfad);
	if (!definiert.has(name)) {
		befunde.push(
			`${ort}\n    var(${name}) im Markup ist nirgends definiert. ` +
				'Ohne Definition greift immer der Rückfallwert — und das dunkle Thema nicht mehr.'
		);
	} else if (komma && imStilblock.has(name) && !amElement.has(name)) {
		befunde.push(
			`${ort}\n    var(${name}, …) im Markup hat einen Rückfallwert, obwohl die Variable ` +
				'definiert ist. Er greift nie und täuscht eine Absicherung vor.'
		);
	}
}

for (const [pfad, baum] of baeume) {
	baum.walkDecls((d) => {
		for (const m of String(d.value).matchAll(BENUTZT)) {
			const [, name, komma] = m;
			verwendungen++;
			const zeile = d.source?.start?.line ?? 0;
			const ort = `${relative(WURZEL, pfad)}:${zeile}`;
			if (!definiert.has(name)) {
				befunde.push(
					`${ort}\n    var(${name}) ist nirgends definiert. ` +
						'Ohne Definition greift immer der Rückfallwert — und das dunkle Thema nicht mehr.'
				);
			} else if (komma && imStilblock.has(name) && !amElement.has(name)) {
				befunde.push(
					`${ort}\n    var(${name}, …) hat einen Rückfallwert, obwohl die Variable definiert ist. ` +
						'Er greift nie und täuscht eine Absicherung vor — so blieb «--rand» monatelang unbemerkt.'
				);
			}
		}
	});
}

/*
 * **Die Sichtprobe** (24.08.2026). Ein Wächter, dessen Filter nach einem Umbau
 * nichts mehr trifft, meldet «in Ordnung» und prüft nichts.
 *
 * Sie zählt nicht bloss «grösser als null»: Beim ersten Anlauf mit `postcss`
 * las der Wächter **nur** `app.css` und meldete 74 statt 1988 Verwendungen —
 * eine Zahl grösser als null und trotzdem falsch. Verglichen wird deshalb mit
 * dem, was ohne Parser abzählbar ist: Jede Datei mit einem `<style>`-Block muss
 * auch einen Stilbaum ergeben.
 */
const mitStilblock = dateien.filter(
	(p) => p.endsWith('.svelte') && readFileSync(p, 'utf8').includes('<style')
);
const ohneBaum = mitStilblock.filter((p) => !baeume.has(p));
if (ohneBaum.length > 0 || imStilblock.size === 0 || verwendungen === 0) {
	console.error(
		'Stilvariablen: der Wächter liest nicht mehr, was er lesen soll.\n' +
			`  Definitionen: ${imStilblock.size}, Verwendungen: ${verwendungen}.\n` +
			`  Dateien mit <style>: ${mitStilblock.length}, davon ohne Stilbaum: ${ohneBaum.length}.\n` +
			(ohneBaum.length > 0 ? `  Zuerst: ${relative(WURZEL, ohneBaum[0])}\n` : '')
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.error(`Stilvariablen: ${befunde.length} Befund(e).\n`);
	for (const b of befunde) console.error(`  ${b}\n`);
	process.exit(1);
}

console.log(
	`Stilvariablen in Ordnung: ${definiert.size} definiert, ${verwendungen} Verwendungen gedeckt.`
);
