/**
 * Stromwächter: Ein Ereignisstrom baut seine Kopfzeilen nicht selbst.
 *
 * **Der Anlass, am 20.08.2026.** Drei Routen liefern einen Ereignisstrom, und
 * nur eine trug `x-accel-buffering: no`. Ohne diesen Kopf puffert ein
 * vorgeschalteter Reverse-Proxy den Strom — beim Empfänger kommt nichts an,
 * solange der Puffer nicht voll ist.
 *
 * Es traf den Strom der Eigentümer. Über `http://127.0.0.1:3100` stand die
 * Frage nach **einer** Sekunde auf dem Gerät, über die Adresse mit dem Proxy
 * nach zwanzig Sekunden noch nicht — kein Ereignis, nicht einmal ein
 * Herzschlag. Der Beamer lief live weiter, denn sein Strom trug den Kopf
 * bereits. Sichtbar wurde es erst im Ergebnis: eine Abstimmung, bei der niemand
 * abstimmen konnte, und ein «abgelehnt» aus null Stimmen.
 *
 * **Die Regel.** Wer `text/event-stream` schreibt, baut eine Antwort von Hand —
 * und vergisst dabei früher oder später einen Kopf. Die Antwort kommt deshalb
 * aus `stromantwort()` in `$lib/server/ereignisstrom`, und diese eine Stelle
 * trägt alles, was ein Strom braucht.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WURZEL = process.cwd();

/** Die eine Stelle, an der die Kopfzeilen stehen dürfen. */
const HEIMAT = 'src/lib/server/ereignisstrom.ts';

/**
 * Dateien unterhalb eines Verzeichnisses.
 *
 * **Die Endungen sind ein Argument, keine feste Zeile** — die zweite Regel
 * dieses Wächters gilt auch für `.svelte`. Beim ersten Anlauf am 21.08.2026
 * stand sie hier fest auf `ts|js`: Die Regel filterte danach zwar auf
 * `.svelte`, bekam aber nie eine solche Datei zu sehen und war damit immer
 * grün. Aufgefallen ist es nur, weil die Gegenprobe gemacht wurde.
 */
function dateienUnter(verzeichnis, endungen = /\.(ts|js)$/) {
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
		else if (endungen.test(eintrag)) treffer.push(pfad);
	}
	return treffer;
}

const befunde = [];
let stroeme = 0;
let nachzuege = 0;

for (const pfad of dateienUnter(join(WURZEL, 'src'))) {
	const kurz = relative(WURZEL, pfad);
	if (kurz === HEIMAT) continue;

	const inhalt = readFileSync(pfad, 'utf8');
	// Kommentare ausblenden: Dort steht die Begründung, nicht der Code.
	const ohne = inhalt
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

	// Wer `stromantwort` benutzt, ist ein Ereignisstrom — das ist die Menge, über
	// die dieser Wächter wacht.
	if (/\bstromantwort\s*\(/.test(ohne)) stroeme++;

	if (!/text\/event-stream/.test(ohne)) continue;

	const zeile = ohne.slice(0, ohne.search(/text\/event-stream/)).split('\n').length;
	befunde.push(
		`${kurz}:${zeile}\n` +
			'  Baut die Kopfzeilen eines Ereignisstroms selbst.\n' +
			`  Richtig ist \`stromantwort(strom)\` aus \`$lib/server/ereignisstrom\` — sonst fehlt\n` +
			'  früher oder später `x-accel-buffering: no`, und ein Proxy puffert den Strom weg.'
	);
}

/*
 * ── Zweite Regel: Wer nachzieht, kennt den Seitenwechsel ───────────────────
 *
 * **Der Anlass, am 21.08.2026.** Eine Seite hört am Strom und lädt ihre Daten
 * nach; ihre Formulare senden zugleich als echte Navigation. Die eigene
 * Handlung löst dann genau den Wechsel aus, auf den die Seite reagiert — und
 * der Datenabruf, den der Seitenwechsel abreisst, steht als «Failed to fetch»
 * in der Konsole.
 *
 * Die Leitungsseite hatte den Schutz seit dem 15.08. als eigene Zeile, die
 * Anwesenheitsseite bekam den Strom später und hatte ihn nicht. Zwei Fassungen
 * derselben Regel — die zweite fehlte einfach. Deshalb steht sie jetzt in
 * `$lib/nachziehen`, und `invalidateAll` gehört nirgends sonst hin.
 */
const NACHZIEH_HEIMAT = 'src/lib/nachziehen.ts';

for (const pfad of dateienUnter(join(WURZEL, 'src'), /\.(ts|js|svelte)$/)) {
	const kurz = relative(WURZEL, pfad).replaceAll('\\', '/');
	if (kurz === NACHZIEH_HEIMAT) continue;

	const inhalt = readFileSync(pfad, 'utf8');
	const ohne = inhalt
		.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

	if (/\bnachziehen\s*\(/.test(ohne)) nachzuege++;

	const treffer = ohne.search(/\binvalidateAll\s*\(/);
	if (treffer < 0) continue;

	const zeile = ohne.slice(0, treffer).split('\n').length;
	befunde.push(
		`${kurz}:${zeile}\n` +
			'  Ruft `invalidateAll()` selbst.\n' +
			'  Richtig ist `nachziehen()` aus `$lib/nachziehen` — sonst reisst der nächste\n' +
			'  Formular-Versand den Datenabruf ab, und «Failed to fetch» steht in der Konsole.'
	);
}

if (befunde.length > 0) {
	console.error('\nStromwächter: Befunde\n');
	for (const b of befunde) console.error(`${b}\n`);
	process.exit(1);
}

/*
 * **Die Sichtprobe** (24.08.2026, auf Frage des Auftraggebers «sind Wächter state of the
 * art oder Flickwerk?»). Vier von acht Wächtern sagten nur «in Ordnung» — und
 * das sagen sie auch, wenn ihr Muster nach einem Umbau null Zeilen trifft.
 *
 * **Gezählt wird die bewachte Menge, nicht die Verstösse.** Der erste Anlauf
 * zählte Dateien mit `text/event-stream` im Text — und meldete null. Zu Recht:
 * Seit alle Ströme über `stromantwort` antworten, setzt **keine** Route den
 * Kopf mehr selbst. Null Verstösse ist der beste Zustand, und ein Wächter, der
 * dann rot wird, wird abgeschaltet statt gelesen. Gezählt wird deshalb, wer
 * `stromantwort` benutzt: Findet er dort nichts, bewacht er nichts.
 */
if (stroeme === 0 || nachzuege === 0) {
	console.error(
		'Stromwächter: nichts zu prüfen gefunden.\n' +
			`  Ereignisströme: ${stroeme}, Dateien mit \`nachziehen()\`: ${nachzuege}.\n` +
			'  Das Projekt hat beides; also liest der Wächter nicht mehr, was er lesen soll.'
	);
	process.exit(1);
}

console.log(
	`Stromwächter in Ordnung: ${stroeme} Ereignisströme antworten über \`stromantwort\`, ` +
		`${nachzuege} Nachzüge über \`nachziehen\`.`
);
