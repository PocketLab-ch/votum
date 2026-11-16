/**
 * Hausklassenwächter: Was eine Bedeutung trägt, wird nicht je Seite neu erfunden.
 *
 * **Der Anlass, am 02.09.2026** (Auftraggeber, über zwei Listenseiten): «Es sind beides
 * Tabellen, aber das Layout unterscheidet sich.» Beim Nachmessen war es nicht
 * die Tabelle — es war der Erklärabsatz darüber.
 *
 * `.einleitung` stand in 22 Dateien und war **nirgends** zentral definiert.
 * Fünfzehn Seiten erfanden sie selbst, sechs gar nicht, und am Bildschirm sah
 * man es:
 *
 * | Seite | Klasse | Breite | Farbe |
 * |---|---|---|---|
 * | Verlauf, Reglement, Nutzniessung | einleitung | 672 | grau |
 * | Personen | lesebreite | 672 | **schwarz** |
 * | Protokoll | einleitung | 672 | **schwarz** |
 * | Quorum | einleitung | **736** | grau |
 *
 * Die Auswertungsseite benutzte dieselbe Klasse sogar für das Gegenteil: gross
 * und mit `tabular-nums`, für eine Kennzahlenzeile.
 *
 * **Warum nur diese Klassen und nicht alle.** Nachgemessen werden 8 von 18
 * Hausklassen lokal überschrieben, `.formular` auf zehn Seiten — das ist ein
 * legitimes Mittel, eine Seite passt eine Fläche an. Eine Regel «nie
 * überschreiben» trüge der Bestand nicht und würde abgeschaltet.
 *
 * Bewacht wird deshalb die engere Klasse: Textklassen, deren ganzer Zweck ihre
 * **Bedeutung** ist. `.einleitung` heisst «tritt hinter die Überschrift
 * zurück»; wer sie lokal einfärbt oder vergrössert, hebt genau das auf. Für
 * eine andere Aussage nimmt man einen anderen Namen — die Auswertungsseite
 * heisst ihre Zeile jetzt `.bilanz`.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import postcss from 'postcss';
import postcssHtml from 'postcss-html';

const WURZEL = process.argv[2] ?? process.cwd();

/**
 * Die bewachten Klassen und was an ihnen nicht lokal umgeschrieben werden darf.
 *
 * Nicht die ganze Regel ist gesperrt: Ein `margin-top`, das einen Absatz an
 * seine Überschrift heranzieht, ist Feinschliff und ändert die Aussage nicht.
 * Gesperrt sind die Eigenschaften, die den Zweck tragen.
 */
const BEWACHT = {
	einleitung: [
		'color',
		'font',
		'font-size',
		'font-weight',
		'max-width',
		'max-inline-size',
		'width',
		'inline-size'
	],
	lesebreite: ['max-width', 'max-inline-size', 'width', 'inline-size'],
	/*
	 * **`.flach` seit dem 03.09.2026.** Die Klasse stand bis dahin in
	 * `Archivschalter.svelte`, und Svelte kapselt Stile je Datei: An sieben von
	 * acht Verwendungsstellen tat sie nichts, der «Verweis» war ein
	 * gewoehnlicher Knopf mit Rahmen.
	 *
	 * Bewacht sind nur Grund und Rahmen — die beiden Eigenschaften, die den
	 * Unterschied zwischen «Verweis» und «Knopf» ausmachen. `color` und
	 * `text-decoration` darf eine Seite anpassen: `einheiten` nimmt die
	 * Unterstreichung begruendet zurueck, weil ihr Aufklapper kein Verweis ist.
	 */
	flach: ['background', 'background-color', 'background-image', 'border', 'border-style', 'border-width']
};

/** Wo die Klassen ihre eine Definition haben. */
const HEIMAT = 'src/app.css';

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
		else if (eintrag.endsWith('.svelte')) treffer.push(pfad);
	}
	return treffer;
}

/**
 * Die Regeln eines `<style>`-Blocks, gelesen mit dem CSS-Parser.
 *
 * **Nicht mit einer Regex** (02.09.2026, zweite Runde des Code-Reviews). Der
 * erste Anlauf suchte `.<klasse> {` mit einem Muster, das keine Zeilenumbrüche
 * zuliess — und übersah damit genau die Schreibweise, in der sechs
 * Definitionen standen:
 *
 * ```
 * .einleitung,
 * .leer {
 * 	max-width: 46rem;
 * }
 * ```
 *
 * Auch `:global(.einleitung)` kam durch, weil danach ein `)` steht und kein
 * `{`. Beides ist im Bestand die häufigere Form. Ein Wächter über eine Sprache
 * braucht ihren Parser; eine Regex hat immer Verstecke.
 *
 * **Und auch der Schnitt des Blocks gehört dem Parser** (dritte Runde). Der
 * zweite Anlauf las zwar die Regeln mit `postcss`, schnitt aber `<style>…</style>`
 * noch selbst heraus. Nachgemessen in beide Richtungen: Ein `'<style>'` in
 * einer Zeichenkette im `<script>` verschluckte den echten Block (stumm grün),
 * und ein `<style>` in einem HTML-Kommentar wurde als Befund gemeldet.
 * `postcss-html` macht es richtig, und `check-anzeigeart` und
 * `check-stilvariablen` benutzen es längst.
 *
 * @param {string} pfad @param {string} inhalt
 * @returns {{selektor: string, deklarationen: Map<string,string>, zeile: number}[]}
 */
function regelnAusStil(pfad, inhalt) {
	let wurzel;
	try {
		// `syntax.parse`, nicht `postcss.parse` mit `syntax` — dieselbe Falle, die
		// `check-stilvariablen` dokumentiert: Die Angabe wird dort übergangen.
		wurzel = pfad.endsWith('.svelte')
			? postcssHtml().parse(inhalt, { from: pfad })
			: postcss.parse(inhalt, { from: pfad });
	} catch {
		// Unlesbares CSS meldet `check:css` (stylelint); hier still übergehen,
		// statt den Lauf an einer fremden Baustelle abzubrechen.
		return [];
	}

	const raus = [];
	wurzel.walkRules((regel) => {
		const deklarationen = new Map();
		regel.each((knoten) => {
			if (knoten.type === 'decl') deklarationen.set(knoten.prop.toLowerCase(), knoten.value.trim());
		});
		for (const selektor of regel.selectors) {
			raus.push({
				selektor: selektor.replace(/\s+/g, ' ').trim(),
				deklarationen,
				zeile: regel.source?.start?.line ?? 1
			});
		}
	});
	return raus;
}

const befunde = [];
let geprueft = 0;
/*
 * **Ein Zähler je Klasse** (aus dem Code-Review). Ein gemeinsamer wäre über
 * null geblieben, sobald eine der beiden Klassen aus dem Markup verschwindet —
 * die andere hätte für sie mitgedeckt, und ihre Bewachung wäre still
 * wirkungslos geworden.
 */
const nutzer = new Map(Object.keys(BEWACHT).map((k) => [k, 0]));

for (const pfad of dateienUnter(join(WURZEL, 'src'))) {
	const kurz = relative(WURZEL, pfad);
	geprueft++;
	const roh = readFileSync(pfad, 'utf8');

	/*
	 * **Ohne Kommentare zählen** (dritte Runde des Code-Reviews). Sonst hält eine
	 * blosse Erwähnung die Sichtprobe über null — und dieser Block pflanzt selbst
	 * eine (`auswertung/+page.svelte` erklärt dort, warum die Zeile nicht mehr
	 * `einleitung` heisst). Die Probe wäre damit durch ihre eigene Begründung
	 * aushebelbar.
	 */
	const ohneKommentar = roh
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/\/\*[\s\S]*?\*\//g, ' ');
	for (const klasse of Object.keys(BEWACHT)) {
		const treffer = ohneKommentar.match(new RegExp(`class="[^"]*\\b${klasse}\\b`, 'g'));
		if (treffer) nutzer.set(klasse, nutzer.get(klasse) + treffer.length);
	}

	/*
	 * **Die pauschale Elementregel ist die zweite Falle** (03.09.2026, aus der
	 * Sicherheitspruefung). Eine Seite, die ihre Knoepfe pauschal gestaltet
	 * (`button { background: var(--akzent) }`), schlaegt damit jede Hausklasse:
	 * Svelte haengt den Datei-Hash an, also steht dort 0-1-1 gegen 0-1-0. Der
	 * flache Knopf stand danach als gruener Kasten mit grauer Schrift da,
	 * Kontrast rund 1,4:1. Gemessen auf zwei Seiten, und der Waechter sah es
	 * nicht, weil im Selektor `.flach` gar nicht vorkommt.
	 *
	 * Gesucht wird deshalb der schlichte Elementselektor: Wo eine Datei die
	 * Klasse benutzt und daneben `button { … }` ohne Ausnahme steht, ist die
	 * Klasse fuer diese Seite aufgehoben. Die Behebung ist `button:not(.flach)`.
	 */
	const genutzteKlassen = Object.keys(BEWACHT).filter((k) =>
		new RegExp(`class="[^"]*\\b${k}\\b`).test(ohneKommentar)
	);

	for (const { selektor, deklarationen, zeile } of regelnAusStil(pfad, roh)) {
		for (const klasse of genutzteKlassen) {
			const element = klasse === 'flach' ? 'button' : null;
			if (!element || selektor.trim() !== element) continue;
			for (const eigenschaft of BEWACHT[klasse]) {
				const wert = deklarationen.get(eigenschaft);
				if (wert === undefined) continue;
				befunde.push(
					`${kurz}:${zeile}  ${selektor} { ${eigenschaft}: ${wert} }\n` +
						`  Diese Seite benutzt \`.${klasse}\` und gestaltet daneben alle \`${element}\`\n` +
						`  pauschal. Der Elementselektor traegt hier den Datei-Hash und schlaegt damit\n` +
						`  die Hausklasse — sie ist fuer diese Seite aufgehoben, ohne dass es jemand\n` +
						`  sieht. Schreiben Sie \`${element}:not(.${klasse})\`.`
				);
			}
		}
		for (const [klasse, gesperrt] of Object.entries(BEWACHT)) {
			/*
			 * Auch in `:global(.einleitung)` und in zusammengesetzten Selektoren.
			 *
			 * **Aber nicht in `:not(…)`** (03.09.2026): Dort steht die Klasse
			 * gerade, um ausgeschlossen zu werden. `button:not(.flach)` schreibt
			 * die Klasse nicht um, es nimmt sie von einer fremden Regel aus — und
			 * genau das ist der richtige Weg, wenn eine Seite ihre Knoepfe pauschal
			 * gestaltet. Der Waechter las das als Ueberschreibung und meldete
			 * ausgerechnet die Behebung als Befund.
			 */
			const ohneAusnahmen = selektor.replace(/:not\([^)]*\)/g, '');
			if (!new RegExp(`\\.${klasse}\\b`).test(ohneAusnahmen)) continue;
			for (const eigenschaft of gesperrt) {
				const wert = deklarationen.get(eigenschaft);
				if (wert === undefined) continue;
				befunde.push(
					`${kurz}:${zeile}  ${selektor} { ${eigenschaft}: ${wert} }\n` +
						`  Diese Klasse trägt ihre Bedeutung, nicht bloss ein Aussehen — sie steht\n` +
						`  einmal in ${HEIMAT}. Wer sie hier umschreibt, hebt sie für diese eine Seite\n` +
						`  auf, und genau daraus wurden fünfzehn verschiedene Erklärabsätze.\n` +
						`  Braucht die Stelle etwas anderes, braucht sie einen anderen Namen.`
				);
			}
		}
	}
}

if (befunde.length > 0) {
	console.log('\nHausklassenwächter: Befunde\n');
	for (const b of befunde) console.log(b + '\n');
	process.exit(1);
}

/*
 * **Die Sichtproben.** Ein Lauf über null Dateien oder über einen Bestand, in
 * dem niemand die Klassen mehr benutzt, wäre grün und wertlos — dieselbe
 * Klasse, die am 02.09.2026 beim Seitenaufbau-Wächter zugeschlagen hat.
 */
if (geprueft < 50) {
	console.error(`Hausklassen: nur ${geprueft} Dateien gefunden — der Lauf greift nicht.`);
	process.exit(1);
}
/*
 * **Steht die Klasse überhaupt noch in ihrer Heimat?** (dritte Runde des
 * Code-Reviews). Der Wächter verlangt, dass niemand sie lokal umschreibt — und
 * genau das ist wertlos, wenn sie zentral gar nicht mehr definiert ist. Dann
 * fielen alle Verwendungen still auf die Grundgestaltung zurück, der Prüflauf
 * bliebe grün, und die beiden Sichtproben unten hielten weiter.
 */
const heimattext = readFileSync(join(WURZEL, HEIMAT), 'utf8');
for (const klasse of Object.keys(BEWACHT)) {
	if (!new RegExp(`(^|[\\s,}])\\.${klasse}\\s*[,{]`, 'm').test(heimattext)) {
		console.error(
			`Hausklassen: \`.${klasse}\` steht nicht mehr in ${HEIMAT}. Dieser Wächter hält\n` +
				'sie dort fest — ohne die eine Definition fallen alle Verwendungen still auf\n' +
				'die Grundgestaltung zurück.'
		);
		process.exit(1);
	}
}

for (const [klasse, anzahl] of nutzer) {
	if (anzahl > 0) continue;
	console.error(
		`Hausklassen: keine einzige Stelle benutzt \`${klasse}\`. Entweder wurde sie\n` +
			'überall ersetzt — dann gehört diese Liste angepasst — oder dieser Wächter\n' +
			'liest das Markup nicht mehr.'
	);
	process.exit(1);
}

console.log(
	`Hausklassen in Ordnung: ${geprueft} Dateien geprüft, ` +
		[...nutzer].map(([k, n]) => `${n}× ${k}`).join(', ') +
		'.'
);
