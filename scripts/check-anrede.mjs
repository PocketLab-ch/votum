/**
 * Anrede-Wächter: Die Oberfläche redet mit «Sie», nicht mit «du».
 *
 * **Der Anlass** (Entscheid 0034, Abgleich T4 mit der Grundausstattung): Den
 * Umlauten wacht `check:umlaute`, der Anrede keiner. Im Haus wird nach innen
 * geduzt; das kann in Votum-Texte rutschen. Gemessen am 29.10.2026: Die
 * Oberfläche redet mit «Sie»; «du» steht in Zeichenketten nur in den Aufträgen
 * an das Sprachmodell, in **vier** Dateien. Alle übrigen Treffer stehen in
 * Kommentaren, in einem Svelte-Kommentar oder sind Französisch.
 *
 * **Was gelesen wird.** Wie bei `check-umlaute` nur Zeichenketten und der
 * sichtbare Svelte-Text, nicht Kommentare: Eine Du-Form im Kommentar ist ein
 * Auftrag an einen Entwickler oder ein Zitat, keiner an den Leser. Dazu liest
 * er im Markup auch die statischen Attributwerte (`placeholder`, `aria-label`,
 * `title`, `alt`) und die Zeichenketten in `{…}`-Ausdrücken, über den Parser
 * wie die Skriptteile. Die Leselogik ist aus `scripts/lib/quelllesen.mjs`
 * geteilt, nicht nachgebaut.
 *
 * **Die Ausnahmeliste.** Die vier Dateien mit den Aufträgen an das Sprachmodell
 * stehen in `scripts/anrede-ausnahmen.tsv`, je Datei mit Begründung. Eine Datei,
 * deren Eintrag keinen Du-Fund mehr deckt, macht den Lauf rot: Sonst würde aus
 * einer begründeten Ausnahme mit der Zeit eine stille Ausschaltung.
 *
 * Läuft in `npm run pruefen` als `check:anrede`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';
import { dateien, leseQuelle, leseSvelte, leseSvelteMarkup } from './lib/quelllesen.mjs';

const ERSTER = process.argv[2];
const WURZEL = ERSTER && !ERSTER.startsWith('--') ? ERSTER : process.cwd();
const AUSNAHMEN_DATEI = join(WURZEL, 'scripts', 'anrede-ausnahmen.tsv');

/** Die Du-Formen mit Wortgrenze, ohne Fall: «du», «dich», «dir», «dein» und Deklinationen. */
const DUFORMMUSTER =
	/\b(du|dich|dir|dein|deine|deinem|deinen|deiner|deines|deins|deinerseits|deinetwegen|deinethalben)\b/gi;

/** Lädt die Ausnahmeliste; ein Fehler darin ist rot, nicht still übersprungen. */
function ladeAusnahmen() {
	let text;
	try {
		text = readFileSync(AUSNAHMEN_DATEI, 'utf8');
	} catch {
		console.error(
			'\nscripts/anrede-ausnahmen.tsv fehlt.\nOhne die begründete Ausnahmeliste wäre der Lauf an den\n' +
				'Aufträgen an das Sprachmodell dauerrot und würde abgeschaltet.\n'
		);
		process.exit(1);
	}
	const raus = [];
	for (const zeile of text.split('\n')) {
		const roh = zeile.trimEnd();
		if (!roh.trim() || roh.trim().startsWith('#')) continue;
		const teile = roh.split('\t');
		if (teile.length !== 2 || teile.some((t) => !t.trim())) {
			console.error(
				`\nscripts/anrede-ausnahmen.tsv: Zeile mit ${teile.length} Spalten.\n` +
					'Erwartet: Datei<Tab>Grund.\n'
			);
			process.exit(1);
		}
		const [datei, grund] = teile;
		if (raus.some((a) => a.datei === datei)) {
			console.error(`\nscripts/anrede-ausnahmen.tsv: «${datei}» steht zweimal drin.\n`);
			process.exit(1);
		}
		raus.push({ datei, grund, benutzt: false });
	}
	if (raus.length === 0) {
		console.error('\nscripts/anrede-ausnahmen.tsv ist leer.\n');
		process.exit(1);
	}
	return raus;
}

/** Der Dateiname ohne den `#script`-Zusatz, unter dem Svelte-Skripte gelesen werden. */
function basisDatei(datei) {
	return datei.replace(/#script$/, '');
}

const quellDateien = dateien(join(WURZEL, 'src'), ['.ts', '.js', '.mjs', '.svelte']);
mindestens(quellDateien, 400, 'Dateien unter src/');

const ausnahmen = ladeAusnahmen();
const befunde = [];

/** Eine Du-Form in einem gelesenen Text; die Ausnahme deckt nur ihre Datei. */
function melde(text, datei, zeile, art) {
	for (const m of text.matchAll(DUFORMMUSTER)) {
		const eintrag = ausnahmen.find((a) => a.datei === basisDatei(datei));
		if (eintrag) {
			eintrag.benutzt = true;
			continue;
		}
		befunde.push({ datei, zeile, art, wort: m[0] });
	}
}

const besuch = (art, text, datei, zeile) => {
	// Zeichenketten (Skript und Markup); Kommentare (kommentar, html-,
	// css-kommentar) übergehen.
	if (art === 'string' || art.startsWith('svelte-')) melde(text, datei, zeile, art);
};

for (const pfad of quellDateien) {
	const datei = relative(WURZEL, pfad);
	const text = readFileSync(pfad, 'utf8');
	if (pfad.endsWith('.svelte')) {
		leseSvelte(text, datei, besuch);
		// Der sichtbare Markup-Text, die Attributwerte und die Zeichenketten in
		// `{…}`-Ausdrücken, je mit echter Zeilennummer.
		leseSvelteMarkup(text, datei, besuch);
	} else {
		leseQuelle(text, datei, 0, besuch);
	}
}

const unbenutzt = ausnahmen.filter((a) => !a.benutzt);
if (unbenutzt.length > 0) {
	console.error(
		`\nAnrede-Wächter: ${unbenutzt.length} Ausnahme${unbenutzt.length === 1 ? '' : 'n'} in ` +
			'scripts/anrede-ausnahmen.tsv deckt keine Du-Form mehr:\n'
	);
	for (const a of unbenutzt) {
		console.error(`  · ${a.datei} (${a.grund})`);
	}
	console.error(
		'\nDie Du-Form wurde geändert oder entfernt. Die Ausnahme gehört gestrichen;\n' +
			'eine Liste, die mehr deckt als nötig, wird zur stillen Ausschaltung.\n'
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.error(`\nAnrede-Wächter: ${befunde.length} Du-Form${befunde.length === 1 ? '' : 'en'}:\n`);
	for (const b of befunde) {
		const stelle = b.zeile === 0 ? b.datei : `${b.datei}:${b.zeile}`;
		console.error(`  · ${stelle} (${b.art}) «${b.wort}»`);
	}
	console.error(
		'\nDie Oberfläche redet mit «Sie». Steht die Stelle in einem Auftrag an das\n' +
			'Sprachmodell, gehört die Datei mit Begründung in die Ausnahmeliste; sonst ist\n' +
			'die Du-Form ein Fehler.\n'
	);
	process.exit(1);
}

console.log(
	`Anrede in Ordnung: keine Du-Form ausserhalb der Ausnahmen ` +
		`(${quellDateien.length} Quellen, ${befunde.length} Befunde).`
);
