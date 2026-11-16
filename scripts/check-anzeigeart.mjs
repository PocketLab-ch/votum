/**
 * Anzeigeart-Wächter: Eine Hilfsklasse darf keine tragende Anzeigeart zerstören.
 *
 * **Der Anlass, am 20.08.2026.** In der Anwesenheitsliste stand
 * `<td class="klein">` — dieselbe Klasse, die den kleinen Zusatz unter einem
 * Namen auf eine eigene Zeile setzt:
 *
 * ```css
 * .klein { font-size: 0.85rem; color: var(--text-leise); display: block; }
 * ```
 *
 * Damit war die Zelle kein `table-cell` mehr, sondern ein Block. Im Browser
 * nachgemessen: 37 px hoch statt 63, ihre untere Linie 25 px über der Linie der
 * Nachbarzellen. Die Tabelle bekam eine Treppe, gemeldet als «Die Zeile
 * Einheiten sind versetzt». Keine Fehlermeldung, kein Werkzeug, das es
 * bemängelt hätte — `svelte-check` prüft TypeScript, nicht Layout.
 *
 * **Die Regel.** Eine Klasse, die als **blosser Klassenselektor** eine
 * Anzeigeart setzt (`.klein { display: … }`), darf nicht an einem Element
 * stehen, dessen Anzeigeart es tragen muss — Tabellenteile, Auswahleinträge,
 * die Zusammenfassung eines Aufklappers. Wer es dort trotzdem braucht, schreibt
 * die Regel **am Element fest** (`td.einheiten { … }`): Dann ist es eine
 * Entscheidung und kein Nebeneffekt.
 *
 * **Wo eine Klasse gilt.** Aus `app.css` überall, aus dem `<style>`-Block einer
 * Komponente nur in dieser Komponente (Svelte grenzt sie ab). Der Wächter hält
 * sich daran, sonst meldete er, was gar nicht zusammentrifft.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';
import { jedesElement, svelteBaum } from './svelte-baum.mjs';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.cwd();

/**
 * Elemente, deren Anzeigeart zum Bau gehört.
 *
 * Bei ihnen ist `display` kein Aussehen, sondern die Zugehörigkeit zu einer
 * Struktur: Eine Zelle, die kein `table-cell` ist, fällt aus ihrer Zeile; ein
 * `option`, das kein `option` mehr ist, verschwindet aus der Liste.
 */
const TRAGEND = [
	'table',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'td',
	'th',
	'caption',
	'colgroup',
	'col',
	'option',
	'optgroup',
	'summary'
];

function dateienUnter(verzeichnis, endungen) {
	const treffer = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return treffer;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateienUnter(pfad, endungen));
		else if (endungen.some((e) => eintrag.endsWith(e))) treffer.push(pfad);
	}
	return treffer;
}

/**
 * Sammelt Klassen, die als blosser Klassenselektor eine Anzeigeart setzen.
 *
 * Bewusst nur der blosse Selektor: `td.einheiten { display: … }` nennt das
 * Element und ist damit eine Aussage über genau dieses Element — gewollt, nicht
 * versehentlich. Auch ein Nachfahrenselektor (`.karten td`) bleibt aussen vor.
 */
function klassenMitAnzeigeart(baum) {
	const gefunden = new Set();
	if (!baum) return gefunden;
	baum.walkRules((r) => {
		if (!r.nodes?.some((n) => n.type === 'decl' && n.prop === 'display')) return;
		for (const selektor of r.selectors ?? []) {
			const rein = selektor.trim().replace(/:[a-z-]+(\([^)]*\))?/g, '');
			const bloss = /^\.([\w-]+)$/.exec(rein);
			if (bloss) gefunden.add(bloss[1]);
		}
	});
	return gefunden;
}

/**
 * Der Stilbaum einer Datei — `null`, wenn sie keinen Stil trägt.
 *
 * **Warum ein Parser und kein regulärer Ausdruck mehr** (24.08.2026): Der
 * Vorgänger schnitt Regelblöcke mit `([^{}]+)\{([^{}]*)\}` heraus. Steht im
 * Block eine verschachtelte Regel (`&:hover { … }`), passt das Muster nicht
 * mehr — und die Anzeigeart darüber fiel lautlos heraus. Dieselbe Lücke wie
 * beim Ausklapperwächter, dort am selben Tag nachgemessen.
 */
function stilbaum(pfad, inhalt) {
	try {
		if (pfad.endsWith('.svelte')) return postcssHtml().parse(inhalt, { from: pfad });
		return postcss.parse(inhalt, { from: pfad });
	} catch {
		return null;
	}
}

/**
 * Die Klassen an einem Element — die wörtlichen **und** die aus `class:name`.
 *
 * `class:eng={schmal}` setzt die Klasse `eng`, sobald `schmal` gilt. Der
 * Vorgänger las nur `class="…"` und sah sie nicht; genau so liesse sich eine
 * Anzeigeart an einer Tabellenzelle unbemerkt einschalten.
 *
 * Was aus einem Ausdruck kommt (`class={x}`), steht nicht fest und wird nicht
 * behauptet.
 */
function klassenAn(element) {
	const raus = [];
	for (const a of element.attributes ?? []) {
		if (a.type === 'ClassDirective') {
			raus.push(a.name);
			continue;
		}
		if (a.type !== 'Attribute' || a.name !== 'class' || a.value === true) continue;
		const teile = Array.isArray(a.value) ? a.value : [a.value];
		for (const teil of teile) {
			if (teil.type !== 'Text') continue;
			raus.push(...teil.data.split(/\s+/).filter(Boolean));
		}
	}
	return raus;
}

/*
 * `app.css` trägt die globalen Klassen dieses Wächters. Fehlt sie, brach der
 * Lauf mit einem nackten ENOENT ab (04.09.2026, aus dem Code-Review): rot aus
 * Versehen, ohne zu sagen, was fehlt.
 */
const appCss = (() => {
	try {
		return readFileSync(join(WURZEL, 'src/app.css'), 'utf8');
	} catch {
		console.error(
			'\nDer Wächter findet «src/app.css» nicht.\nDort stehen die globalen ' +
				'Klassen, gegen die er prüft; ohne sie ist sein Ergebnis wertlos.\n' +
				'Wurde die Datei verschoben, gehört dieser Wächter mit umgebaut.\n'
		);
		process.exit(1);
	}
})();
const global = klassenMitAnzeigeart(stilbaum(join(WURZEL, 'src/app.css'), appCss));

const befunde = [];
const tragend = new Set(TRAGEND);
let geprueft = 0;

for (const pfad of mindestens(
	dateienUnter(join(WURZEL, 'src'), ['.svelte']),
	80,
	'Svelte-Bausteine unter src/'
)) {
	const inhalt = readFileSync(pfad, 'utf8');
	const baum = svelteBaum(pfad, inhalt);
	if (!baum) continue;
	const eigene = klassenMitAnzeigeart(stilbaum(pfad, inhalt));

	jedesElement(baum.fragment, (element) => {
		if (!tragend.has(element.name)) return;
		geprueft++;
		for (const klasse of klassenAn(element)) {
			const woher = global.has(klasse) ? 'app.css' : eigene.has(klasse) ? 'eigener Stilblock' : null;
			if (!woher) continue;
			const zeile = inhalt.slice(0, element.start ?? 0).split('\n').length;
			befunde.push(
				`${relative(WURZEL, pfad)}:${zeile}\n` +
					`  <${element.name} class="${klasse}"> — «.${klasse}» setzt eine Anzeigeart (${woher}).\n` +
					`  Das ${element.name}-Element verliert dadurch seine eigene und fällt aus der Struktur.\n` +
					`  Abhilfe: eine Regel am Element festmachen, etwa «${element.name}.${klasse}-… { … }».`
			);
		}
	});
}

if (befunde.length > 0) {
	console.error('\nAnzeigeart-Wächter: tragende Elemente mit einer Hilfsklasse überschrieben\n');
	for (const b of befunde) console.error(`${b}\n`);
	console.error(`${befunde.length} ${befunde.length === 1 ? 'Stelle' : 'Stellen'}.\n`);
	process.exit(1);
}

/*
 * **Die Sichtprobe** (24.08.2026). Ein Wächter, der nach einem Umbau nichts
 * mehr trifft, meldet «in Ordnung» und prüft nichts. Hier wäre das der Fall,
 * wenn der Svelte-Baum nicht mehr gelesen würde oder die Elementnamen sich
 * änderten — dann bliebe von den Tabellen des Projekts nichts übrig.
 *
 * Verglichen wird mit dem, was ohne Parser abzählbar ist: Das Projekt hat
 * Tabellen, also müssen tragende Elemente gefunden werden.
 */
if (geprueft === 0 || global.size + 0 === 0) {
	console.error(
		'Anzeigeart-Wächter: kein einziges tragendes Element gefunden.\n' +
			`  Geprüfte Elemente: ${geprueft}, Klassen mit Anzeigeart in app.css: ${global.size}.\n` +
			'  Das Projekt hat Tabellen; also liest der Wächter nicht mehr, was er lesen soll.'
	);
	process.exit(1);
}

console.log(
	`Anzeigeart-Wächter in Ordnung: ${geprueft} tragende Elemente geprüft, keine Anzeigeart überschrieben.`
);
