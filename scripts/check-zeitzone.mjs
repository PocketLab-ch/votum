/**
 * Wächter: Ein Zeitpunkt wird nie in der Zone des Geräts formatiert.
 *
 * **Der Anlass** (04.09.2026). Elf Stellen riefen `toLocaleString('de-CH', …)`
 * ohne `timeZone`. `Intl` nimmt dann die Zone des Geräts, und beim Hydrieren
 * wechselt die Zahl: Der Server liefert die Seite in UTC aus, der Browser
 * rechnet sie in die Gerätezeit um. Gemessen am **Siegelzeitpunkt**, der in der
 * Oberfläche «06:43» stand und im Protokoll-PDF «08:43». Zwei Uhrzeiten für
 * denselben Vorgang, und dieser Vorgang ist ein Nachweiselement.
 *
 * **Die Regel.** Wer `toLocaleString`, `toLocaleDateString` oder
 * `toLocaleTimeString` auf einem **Datum** aufruft, gibt `timeZone` mit, oder
 * nimmt eine der Hausfunktionen aus `domain/datum.ts` (`zeitpunktKurz`,
 * `zeitpunktLang`, `datumKurz`, `uhrzeit`, `tagVon`).
 *
 * **Zahlen sind ausgenommen**, und das ist keine Nachlässigkeit:
 * `n.toLocaleString('de-CH')` formatiert Tausendertrennzeichen und hat mit Zeit
 * nichts zu tun. Der Wächter erkennt sie daran, dass der Empfänger kein `Date`
 * ist.
 *
 * **Was er dafür nicht sieht** (gemessen am 04.09.2026): Ein Datum in einer
 * Variablen mit unauffälligem Namen. Auf der Startseite hiess sie `dann`, und
 * der Wächter ging daran vorbei; gefunden hat sie ein Blick in die Datei. Wer
 * die Liste unten erweitert, macht ihn schärfer, aber auch lauter, und ein
 * Wächter, der bei jeder Zahl meldet, wird abgeschaltet statt gelesen. Die
 * Grenze ist bewusst gewählt und keine Zusicherung.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.argv[2] ?? process.cwd();

/** Der Aufruf, um den es geht. */
const AUFRUF = /\.toLocale(String|DateString|TimeString)\s*\(/g;

/**
 * Woran ein **Datum** als Empfänger zu erkennen ist.
 *
 * Bewusst an der Form und nicht am Typ: Ein Wächter ohne Typprüfung kann das
 * nicht wissen, und lieber lässt er eine Zahl durch, als bei jeder Zahl zu
 * lärmen. Die Fälle hier decken, was im Haus vorkommt.
 *
 * `new Date\(.*\)` ist gierig, und das mit Absicht (04.09.2026, aus dem
 * Code-Review): Die sparsame Fassung `[^)]*` brach bei `new Date(Date.UTC(…))`
 * an der inneren Klammer ab und liess den Aufruf durch.
 */
const NACH_DATUM =
	/(new Date\(.*\)|\bd\b|\bdatum\b|\bwert\b|\biso\b|\bzeitpunkt\w*|\w*[aA]m|\w*[dD]atum|\w*[zZ]eit\w*)$/;

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

/** Den ganzen Aufruf ab der öffnenden Klammer, damit mehrzeilige Optionen zählen. */
function aufrufAb(text, klammerAuf) {
	let tiefe = 0;
	for (let i = klammerAuf; i < text.length; i += 1) {
		if (text[i] === '(') tiefe += 1;
		else if (text[i] === ')') {
			tiefe -= 1;
			if (tiefe === 0) return text.slice(klammerAuf, i + 1);
		}
	}
	return text.slice(klammerAuf);
}

const befunde = [];

for (const pfad of mindestens(
	dateien(join(WURZEL, 'src')),
	300,
	'Quelldateien (.ts/.svelte) unter src/'
)) {
	const text = readFileSync(pfad, 'utf8');
	for (const treffer of text.matchAll(AUFRUF)) {
		const aufruf = aufrufAb(text, treffer.index + treffer[0].length - 1);
		if (aufruf.includes('timeZone')) continue;

		// Empfänger: alles vor dem Punkt. Eine Zahl geht durch, ein Datum nicht.
		const davor = text.slice(0, treffer.index).trimEnd();
		if (!NACH_DATUM.test(davor)) continue;

		const zeile = text.slice(0, treffer.index).split('\n').length;
		befunde.push({
			datei: relative(WURZEL, pfad),
			zeile,
			text: (text.split('\n')[zeile - 1] ?? '').trim()
		});
	}
}

if (befunde.length > 0) {
	const eins = befunde.length === 1;
	console.error(
		`\n${befunde.length} Zeitangabe${eins ? '' : 'n'} ohne Zeitzone:\n`
	);
	for (const b of befunde) {
		console.error(`  · ${b.datei}:${b.zeile}`);
		console.error(`      ${b.text.slice(0, 110)}`);
	}
	console.error(
		'\nOhne `timeZone` nimmt `Intl` die Zone des Geräts. Der Server liefert die\n' +
			'Seite in UTC aus, der Browser rechnet um, und dieselbe Angabe steht an zwei\n' +
			'Stellen verschieden da. Nimm eine Hausfunktion aus `domain/datum.ts`\n' +
			'(`zeitpunktKurz`, `zeitpunktLang`, `datumKurz`, `uhrzeit`, `tagVon`) oder\n' +
			"gib `timeZone: 'Europe/Zurich'` mit.\n"
	);
	process.exit(1);
}

console.log('Zeitzonen in Ordnung: keine Zeitangabe hängt an der Zone des Geräts.');
