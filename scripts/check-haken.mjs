/**
 * Häkchenwächter: Ein Kästchen, das mit `jaNein()` gelesen wird, schickt `true`.
 *
 * **Der Anlass, am 25.08.2026.** Die neue Weisungsregel hatte zwei Kästchen mit
 * `value="ja"` — «Zusätzlich eine Wertquotenschwelle» und «Enthaltungen bleiben
 * in der Bezugsgrösse». Gelesen wurden sie mit `jaNein()`, und das kennt genau
 * `true` und `on`. Ergebnis: Das Kästchen stand angekreuzt auf dem Bildschirm,
 * die Datenbank bekam `false`, und niemand erfuhr es. Wer die Wertquotenschwelle
 * ankreuzte, die Felder ausfüllte und speicherte, hatte danach eine Regel **ohne**
 * Wertquoten — mit der Schwelle sichtbar im Formular daneben.
 *
 * Das ist keine Instanz, sondern eine Klasse: Im Bestand stehen achtzehn
 * Kästchen mit `value="true"` und drei mit einem anderen Wort. Die drei sind
 * richtig — sie werden mit `=== 'ja'` beziehungsweise `!== 'ohne'` gelesen und
 * nicht mit `jaNein()`. Genau diese Paarung prüft der Wächter.
 *
 * **Was er NICHT tut:** Kästchen verbieten, die einen eigenen Wert tragen. Eine
 * Mehrfachauswahl schickt ihre Kennung, und das ist richtig. Beanstandet wird
 * allein der Widerspruch zwischen dem, was das Kästchen schickt, und dem, was
 * die Aktion daraus liest.
 *
 * ## Versteckte Felder zählen mit (10.09.2026)
 *
 * Bis hierher sah der Wächter nur `type="checkbox"`. Die Fehlerklasse hängt aber
 * nicht an der Bauform des Feldes, sondern an der Paarung: Ein verstecktes Feld
 * schickt seinen Wert genauso, und `jaNein()` liest ihn genauso. Im Bestand
 * stehen elf versteckte Felder, deren Name mit `jaNein()` gelesen wird — sieben
 * davon schicken `true`, vier `ja`.
 *
 * **Die vier sind richtig**, und daran hing die eigentliche Arbeit: `bestaetigt`
 * wird an zwei Stellen mit `jaNein()` gelesen und an fünf weiteren mit
 * `text(…) === 'ja'`. Der Name allein sagt also nicht, welche Lesung ein Feld
 * trifft. Wer den Wächter naiv auf versteckte Felder erweitert, bekommt vier
 * Falschmeldungen und schreibt sich dagegen eine Ausnahmeliste — und eine
 * Ausnahmeliste ist eine Näherung, die beim nächsten Namen wieder danebenliegt.
 *
 * **Stattdessen erkennt der Wächter die Mehrdeutigkeit selbst.** Ein Name, der
 * irgendwo auch ausdrücklich verglichen wird (`text(daten.get('x')) === '…'`),
 * ist nicht entscheidbar; er wird übergangen und am Ende **benannt**. Ein
 * Wächter, der seinen blinden Fleck nennt, ist besser als einer, der ihn
 * verschweigt — und wer die Mehrdeutigkeit auflöst, bekommt die Prüfung
 * geschenkt.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = join(process.cwd(), 'src');

/** Was `jaNein()` als «gesetzt» durchgehen lässt — siehe server/formular.ts. */
const ERLAUBT = new Set(['true', 'on']);

function dateien(verzeichnis, endung) {
	const raus = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad, endung));
		else if (pfad.endsWith(endung)) raus.push(pfad);
	}
	return raus;
}

/**
 * Kästchen mit **wörtlichem** Wert: `<input type="checkbox" name="x" value="y">`.
 *
 * Ein Wert aus einem Ausdruck (`value={…}`) wird übergangen — er ist zur
 * Prüfzeit nicht bekannt, und eine Mehrfachauswahl baut ihn so.
 */
const KAESTCHEN = /<input\b[^>]*type=["']checkbox["'][^>]*>/g;

/**
 * Dasselbe für versteckte Felder: `<input type="hidden" name="x" value="y">`.
 *
 * Sie tragen ihren Wert immer bei, nicht nur wenn jemand sie ankreuzt — die
 * Fehlrichtung ist also die umgekehrte und die unangenehmere. Ein Kästchen mit
 * falschem Wert kommt als «nicht gesetzt» an; ein verstecktes Feld mit falschem
 * Wert auch, und zwar auch dann, wenn niemand etwas angekreuzt hat.
 */
const VERSTECKT = /<input\b[^>]*type=["']hidden["'][^>]*>/g;
const NAME = /\bname=["']([^"'{}]+)["']/;
const WERT = /\bvalue=["']([^"'{}]+)["']/;

/** `jaNein(daten.get('x'))` — der Name steht im inneren Aufruf. */
const LESER = /jaNein\(\s*\w+\.get\(\s*['"]([^'"]+)['"]/g;

/**
 * Die andere Lesung: `text(daten.get('x')) === 'ja'`, auch mit `!==`.
 *
 * Wer so liest, darf jeden Wert schicken — der Vergleich nennt ihn ja. Ein Name,
 * der **beide** Lesungen trifft, ist für diesen Wächter nicht entscheidbar.
 */
const AUSDRUECKLICH = /text\(\s*\w+\.get\(\s*['"]([^'"]+)['"]\s*\)\s*\)\s*[!=]==/g;

const werte = new Map(); // name → Liste der wörtlichen Werte, mit Fundstelle
for (const datei of dateien(WURZEL, '.svelte')) {
	const inhalt = readFileSync(datei, 'utf8');
	for (const [muster, art] of [
		[KAESTCHEN, 'Kästchen'],
		[VERSTECKT, 'verstecktes Feld']
	]) {
		for (const m of inhalt.matchAll(muster)) {
			const name = m[0].match(NAME)?.[1];
			const wert = m[0].match(WERT)?.[1];
			if (!name || !wert) continue;
			const bisher = werte.get(name) ?? [];
			bisher.push({ wert, art, datei: datei.replace(`${process.cwd()}/`, '') });
			werte.set(name, bisher);
		}
	}
}

const gelesen = new Set();
const mehrdeutig = new Set();
for (const datei of dateien(WURZEL, '.ts')) {
	const inhalt = readFileSync(datei, 'utf8');
	for (const m of inhalt.matchAll(LESER)) gelesen.add(m[1]);
	for (const m of inhalt.matchAll(AUSDRUECKLICH)) mehrdeutig.add(m[1]);
}

if (gelesen.size === 0) {
	console.error(
		'Häkchen: kein einziger `jaNein(daten.get(…))` gefunden — der Ausdruck trifft\n' +
			'  offenbar nicht mehr, und der Wächter wäre ab jetzt immer grün.'
	);
	process.exit(1);
}

const befunde = [];
/** Namen, die beide Lesungen treffen — geprüft wird an ihnen nicht. */
const uebergangen = [];
for (const name of gelesen) {
	const felder = werte.get(name) ?? [];
	if (felder.length === 0) continue;
	if (mehrdeutig.has(name)) {
		uebergangen.push(`${name} (${felder.length} Felder)`);
		continue;
	}
	for (const eintrag of felder) {
		if (!ERLAUBT.has(eintrag.wert)) {
			befunde.push(`${eintrag.datei}: ${eintrag.art} name="${name}" schickt "${eintrag.wert}"`);
		}
	}
}

if (befunde.length > 0) {
	console.error(
		'Häkchen: mit `jaNein()` gelesen, aber nicht `true` oder `on` geschickt.\n' +
			'  Das Feld schickt einen Wert, und die Handlung liest ihn als «nicht gesetzt».\n'
	);
	for (const b of befunde) console.error(`  ${b}`);
	process.exit(1);
}

/*
 * **Die Sichtprobe**: Im guten Zustand muss der Wächter etwas zu prüfen HABEN.
 * Ohne sie wäre er grün, sobald ein Umbau die Ausdrücke ins Leere laufen lässt —
 * derselbe Fehler, den er verhindern soll, eine Ebene höher.
 */
const gepaart = [...gelesen].filter(
	(n) => (werte.get(n) ?? []).length > 0 && !mehrdeutig.has(n)
);
if (gepaart.length < 3) {
	console.error(
		`Häkchen: nur ${gepaart.length} Felder liessen sich einer jaNein-Lesung zuordnen.\n` +
			'  Zu wenig, um etwas zu beweisen — stimmen die Ausdrücke noch?'
	);
	process.exit(1);
}

console.log(
	`Häkchen in Ordnung: ${gelesen.size} Namen mit jaNein gelesen, ` +
		`${gepaart.length} davon mit wörtlichem Wert im Formular geprüft.`
);
/*
 * **Der blinde Fleck wird genannt, nicht verschwiegen.** Sonst liest der nächste
 * einen grünen Lauf als «alle Felder geprüft», und übergangen sind sie doch.
 */
if (uebergangen.length > 0) {
	console.log(
		`  Nicht entscheidbar, weil auch ausdrücklich verglichen: ${uebergangen.join(', ')}.`
	);
}
