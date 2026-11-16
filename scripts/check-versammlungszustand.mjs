/**
 * Wächter: Der Versammlungszustand hat fünf Werte, nicht vier.
 *
 * **Der Anlass** (04.09.2026). `versiegelt` kam als fünfter Zustand dazu, und
 * sechs Stellen fragten weiterhin nur `=== 'geschlossen'`. Sie behandelten die
 * versiegelte Versammlung, als wäre sie noch offen: Die Führung schlug einen
 * Vorbereitungsschritt vor, die Protokollseite nannte gesperrte Zahlen
 * «vorläufig», die Leinwand fiel vor dem ganzen Saal auf die Code-Eingabe
 * zurück, und an einer versiegelten Versammlung liess sich eine Vollmacht
 * ändern. Beim Layout war es ein **Rückfall**: Der Kommentar, der genau das
 * verhindern soll, stand seit dem 04.08.2026 direkt über der Zeile.
 *
 * **Was der Wächter nicht kann, und warum er trotzdem etwas taugt.** Ob eine
 * Zeile den Zustand einer **Versammlung** oder eines **Abstimmungsdurchgangs**
 * vergleicht, ist ohne Typprüfung nicht sicher zu entscheiden; ein Durchgang
 * kennt kein `versiegelt`, und dort ist der Vergleich richtig. Der Wächter
 * meldet deshalb nur Zeilen, deren Bezeichner nach Versammlung aussehen, und
 * lässt sich mit einer begründeten Marke abschalten. Er ersetzt kein Urteil, er
 * erzwingt eines.
 *
 * **Die Regel.** Wer den Zustand einer Versammlung mit `'geschlossen'`
 * vergleicht, nimmt `versiegelt` mit (am einfachsten über `abgeschlossen()` aus
 * `domain/versammlung.ts`) oder schreibt in die Zeile darüber, warum nicht:
 *
 *     // zustand-nur-geschlossen: Hier geht es um den Schritt VOR dem Siegel.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

/*
 * Die Wurzel als Argument, damit der Gegentest den Wächter über einen
 * Wegwerfbaum fahren kann. Ohne das wäre er nur gegen den echten Bestand
 * prüfbar, und ein Wächter ohne Gegentest ist immer grün.
 */
const WURZEL = process.argv[2] ?? process.cwd();
const MARKE = 'zustand-nur-geschlossen:';

/**
 * Bezeichner, die eine **Versammlung** meinen.
 *
 * Bewusst eng: Lieber ein paar echte Stellen nicht sehen, als bei jedem
 * Durchgang falschen Alarm schlagen. `d`, `e`, `g` und `durchgang` fehlen
 * deshalb absichtlich.
 */
const VERSAMMLUNG = [
	'versammlung',
	'rahmenVersammlung',
	'meeting_state',
	'v.zustand',
	'm.state',
	// `z` steht in diesem Haus durchgehend für eine **Zeile** aus einer
	// Versammlungsabfrage, nie für einen Durchgang (04.09.2026, aus dem
	// Code-Review: ohne diese zwei war der Wächter über `uebersicht.ts` blind).
	'z.state',
	'z.zustand',
	'lage.versammlungszustand',
	'versammlungszustand'
];

/** Ein Vergleich auf `'geschlossen'`, der `versiegelt` nicht mitnimmt. */
const VERGLEICH = /(!==|===)\s*'geschlossen'/;

/**
 * Ob eine umgebrochene Bedingung in der Folgezeile `versiegelt` mitnimmt.
 *
 * Die erste Zeile muss dafür offen enden (`||`, `&&`, `?`, `(` oder `,`), sonst
 * sind es zwei unabhängige Anweisungen und das `versiegelt` daneben hat mit
 * diesem Vergleich nichts zu tun.
 */
function fortgesetzt(erste, zweite) {
	const a = (erste ?? '').trimEnd();
	const b = zweite ?? '';
	if (!b.includes("'versiegelt'")) return false;
	return /(\|\||&&|\?|\(|,)$/.test(a);
}

/**
 * Sucht die Ausnahmemarke im zusammenhängenden Kommentarblock über der Zeile.
 *
 * Gültig sind alle Kommentararten, die hier vorkommen: `//`, `/* … *\/` und
 * die HTML-Kommentare der Svelte-Vorlagen. Leerzeilen brechen den Block ab,
 * damit eine Marke nicht aus einem ganz anderen Zusammenhang gilt.
 */
function markeDarueber(zeilen, i) {
	for (let j = i - 1; j >= 0 && i - j <= 8; j -= 1) {
		const z = (zeilen[j] ?? '').trim();
		if (z === '') return false;
		if (z.includes(MARKE)) return true;
		const istKommentar =
			z.startsWith('//') ||
			z.startsWith('*') ||
			z.startsWith('/*') ||
			z.startsWith('<!--') ||
			z.endsWith('-->') ||
			z.endsWith('*/');
		if (!istKommentar) return false;
	}
	return false;
}

function dateien(ordner, treffer = []) {
	/*
	 * Ein fehlendes Verzeichnis gab bisher einen nackten ENOENT: rot aus
	 * Versehen, ohne zu sagen, dass hier nichts mehr zu prüfen ist
	 * (04.09.2026, aus dem dritten Code-Review). Das leere Feld reicht die
	 * Entscheidung an die Reissleine weiter, die es sagen kann.
	 */
	let eintraege;
	try {
		eintraege = readdirSync(ordner);
	} catch {
		return treffer;
	}
	for (const name of eintraege) {
		if (name === 'node_modules' || name.startsWith('.')) continue;
		const pfad = join(ordner, name);
		if (statSync(pfad).isDirectory()) dateien(pfad, treffer);
		else if (/\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name)) treffer.push(pfad);
	}
	return treffer;
}

const befunde = [];

for (const pfad of mindestens(
	dateien(join(WURZEL, 'src')),
	300,
	'Quelldateien unter src/'
)) {
	const zeilen = readFileSync(pfad, 'utf8').split('\n');
	zeilen.forEach((zeile, i) => {
		if (!VERGLEICH.test(zeile)) return;
		// Nimmt die Zeile `versiegelt` schon mit? Dann ist nichts zu melden.
		if (zeile.includes("'versiegelt'")) return;
		/*
		 * Auch die Nachbarzeile zählt, aber nur wenn die Bedingung dort wirklich
		 * weitergeht (04.09.2026, aus dem Code-Review). Vorher entschärfte jedes
		 * `'versiegelt'` in der Nachbarschaft den Vergleich, auch aus einer ganz
		 * anderen Anweisung zwei Zeilen weiter.
		 */
		if (fortgesetzt(zeile, zeilen[i + 1]) || fortgesetzt(zeilen[i - 1], zeile)) return;
		// Begründete Ausnahme im Kommentarblock darüber. Rückwärts, solange die
		// Zeile ein Kommentar ist: Eine Begründung, die drei Zeilen braucht, ist
		// keine schlechtere als eine, die in eine passt.
		if (markeDarueber(zeilen, i)) return;
		// Sieht der verglichene Bezeichner nach einer Versammlung aus?
		const vor = zeile.slice(0, zeile.search(VERGLEICH)).toLowerCase();
		if (!VERSAMMLUNG.some((w) => vor.includes(w.toLowerCase()))) return;

		befunde.push({ datei: relative(WURZEL, pfad), zeile: i + 1, text: zeile.trim() });
	});
}

if (befunde.length > 0) {
	const eins = befunde.length === 1;
	console.error(
		`\n${befunde.length} Vergleich${eins ? '' : 'e'} auf «geschlossen», ` +
			`${eins ? 'der' : 'die'} «versiegelt» nicht ${eins ? 'mitnimmt' : 'mitnehmen'}:\n`
	);
	for (const b of befunde) {
		console.error(`  · ${b.datei}:${b.zeile}`);
		console.error(`      ${b.text.slice(0, 110)}`);
	}
	console.error(
		'\nDer Zustand hat fünf Werte, und «versiegelt» ist der fünfte. Nimm ihn mit,\n' +
			'am einfachsten über `abgeschlossen()` aus `domain/versammlung.ts`.\n' +
			`Wo der Unterschied gewollt ist, schreib den Grund darüber: «${MARKE} …».\n`
	);
	process.exit(1);
}

console.log(`Versammlungszustand in Ordnung: kein Vergleich übersieht «versiegelt».`);
