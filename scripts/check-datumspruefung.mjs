/**
 * Datumswächter: Ein Kalendertag wird nicht auf seine Gestalt geprüft.
 *
 * **Der Anlass, am 02.09.2026.** An fünfzehn Stellen stand
 * `/^\d{4}-\d{2}-\d{2}$/` und liess damit jeden Wert durch, der wie ein Datum
 * aussieht. `2026-02-31` und `2026-13-01` sehen so aus, gibt es aber nicht: Sie
 * gingen unverändert in eine Abfrage, und PostgreSQL antwortete mit
 * `22008 date/time field value out of range` — beim Benutzer als rohe 500.
 *
 * Auf dem Übernahmeweg kostete das die soeben hochgeladene Tabelle. Mehrere der
 * fünfzehn Prüfungen sagten in ihrem Kommentar ausdrücklich, genau das
 * verhindern zu wollen.
 *
 * **Die Regel.** Wer einen Kalendertag prüft, ruft `istKalendertag()` aus
 * `$lib/domain/datum`. Diese eine Stelle prüft Gestalt **und** Existenz, und
 * zwar über den Rückweg: Ein Datum, das es nicht gibt, rollt beim Anlegen
 * weiter (aus dem 31. Februar wird der 3. März), und wer die Bestandteile
 * danach zurückliest, findet sie nicht wieder.
 *
 * **Warum ein Wächter und nicht nur fünfzehn Korrekturen.** Die Regex ist vier
 * Zeichen kürzer als der Aufruf und liegt jedem in den Fingern. Ohne diese
 * Zeile hier steht die sechzehnte Stelle beim nächsten Formularfeld mit einem
 * Datum wieder da — gefixte Instanzen kamen im August wieder, geschlossene
 * Klassen nicht.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WURZEL = process.cwd();

/** Die eine Stelle, an der das Muster stehen darf. */
const HEIMAT = 'src/lib/domain/datum.ts';

/**
 * Das Muster, um das es geht — in allen Schreibweisen, die dasselbe tun.
 *
 * `\d`, `[0-9]` und `\d{2}-\d{2}` mit oder ohne Anker: Wer es umschreibt, um
 * dem Wächter zu entgehen, hat immer noch keine Existenzprüfung.
 */
const MUSTER = /(\\d|\[0-9\])\{4\}-(\\d|\[0-9\])\{2\}-(\\d|\[0-9\])\{2\}/;

/**
 * Das zweite Muster: einen Kalendertag von Hand zusammensetzen.
 *
 * **Der Anlass, am 02.09.2026.** Sechs Stellen bauten den Tag aus
 * `getFullYear()`, `getMonth()` und `getDate()` zusammen — drei als eigene
 * Funktion, drei mitten im Ausdruck. Das sind **Ortszeit**-Getter, und der
 * Treiber liefert eine `date`-Spalte als Mitternacht in UTC. Gemessen an
 * `DATE '2026-01-01'`:
 *
 * | Prozesszone | `kalendertag()` | von Hand |
 * |---|---|---|
 * | UTC | 2026-01-01 | 2026-01-01 |
 * | Europe/Zurich | 2026-01-01 | 2026-01-01 |
 * | America/New_York | 2026-01-01 | **2025-12-31** |
 *
 * **Und zwei Kommentare hielten das Gegenteil fest**, mit genau dem Beispiel,
 * das ihre eigene Fassung produziert: «`toISOString()` verschöbe den 1. Januar
 * auf den 31. Dezember». Eine falsche Begründung ist zäher als eine falsche
 * Zeile — sie hat die sechs Stellen überhaupt erst konserviert, weil jeder
 * Leser dachte, hier sei schon nachgedacht worden.
 *
 * **Alle drei Getter, nicht nur der erste** (aus dem Code-Review). Ein erster
 * Anlauf sah nur `getFullYear()`. Wer die Jahreszahl anderswoher nimmt und nur
 * Monat und Tag von Hand setzt, käme damit durch — und zwar mit demselben
 * Fehler, weil `getMonth()` und `getDate()` genauso Ortszeit sind.
 *
 * **Was er nicht sieht**, und das gehört dazugesagt: `toLocaleDateString` mit
 * einer Zone. Das ist meistens richtig (`tagVon` im Kern tut genau das für
 * Zeitstempel) und lässt sich von der falschen Anwendung auf eine
 * `date`-Spalte nicht am Aufruf unterscheiden — dafür bräuchte es den Typ der
 * Spalte, und den kennt eine Textprüfung nicht.
 */
const HANDARBEIT = /\.get(FullYear|Month|Date)\s*\(\s*\)/;

function dateienUnter(verzeichnis, endungen = /\.(ts|svelte)$/) {
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
let geprueft = 0;
/*
 * **Zwei Zähler, nicht einer** (02.09.2026, aus dem Code-Review). Ein
 * gemeinsamer «ruft irgendetwas aus dem Kern» wäre grün geblieben, sobald eine
 * der beiden Klassen ganz verschwindet: Die acht `kalendertag`-Nutzer hätten
 * für die sechzehn verschwundenen `istKalendertag`-Aufrufe mitgedeckt. Die
 * Sichtprobe soll aber beide Aussagen halten.
 */
let pruefer = 0;
let former = 0;

for (const pfad of dateienUnter(join(WURZEL, 'src'))) {
	const kurz = relative(WURZEL, pfad);
	if (kurz === HEIMAT) continue;
	geprueft++;

	const inhalt = readFileSync(pfad, 'utf8');
	// Kommentare ausblenden: Dort steht die Begründung, nicht der Code.
	/*
	 * **Auch `<!-- -->`** (02.09.2026, zweite Runde des Code-Reviews). Der Lauf
	 * geht über `.svelte`-Dateien, und dort ist der HTML-Kommentar die übliche
	 * Form — eine Begründung, die das falsche Muster zitiert, hätte den Wächter
	 * rot gemacht. Genau dafür sind diese drei Zeilen da.
	 */
	const ohne = inhalt
		.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

	if (/\bistKalendertag\s*\(/.test(ohne)) pruefer++;
	if (/(?<!ist)\bkalendertag\s*\(/i.test(ohne)) former++;

	const zeilen = ohne.split('\n');
	for (const [i, zeile] of zeilen.entries()) {
		if (MUSTER.test(zeile)) {
			befunde.push(
				`${kurz}:${i + 1}\n` +
					`  Prüft ein Datum auf seine Gestalt. Ein Tag, den es nicht gibt (2026-02-31),\n` +
					`  kommt damit durch und endet als rohe 500 aus der Datenbank.\n` +
					`  Richtig ist \`istKalendertag()\` aus $lib/domain/datum.`
			);
		}
		if (HANDARBEIT.test(zeile)) {
			befunde.push(
				`${kurz}:${i + 1}\n` +
					`  Setzt einen Kalendertag aus Ortszeit-Gettern zusammen. Der Treiber gibt\n` +
					`  eine \`date\`-Spalte als Mitternacht UTC zurück; westlich von Greenwich\n` +
					`  wird daraus der Vortag (gemessen: 2026-01-01 → 2025-12-31).\n` +
					`  Richtig ist \`kalendertag()\` aus $lib/domain/datum.`
			);
		}
	}
}

if (befunde.length > 0) {
	console.log('\nDatumswächter: Befunde\n');
	for (const b of befunde) console.log(b + '\n');
	process.exit(1);
}

/*
 * **Sichtprobe: Sieht dieser Wächter überhaupt etwas?** Ein Lauf über null
 * Dateien oder über einen Bestand, in dem niemand mehr `istKalendertag`
 * benutzt, wäre grün und wertlos — genau die Klasse, die am 02.09.2026 beim
 * Seitenaufbau-Wächter zugeschlagen hat.
 */
if (geprueft < 50) {
	console.error(`Datumswächter: nur ${geprueft} Dateien gefunden — der Lauf greift nicht.`);
	process.exit(1);
}
if (pruefer === 0) {
	console.error(
		'Datumswächter: keine einzige Stelle ruft `istKalendertag`. Entweder wurde die\n' +
			'Prüfung überall entfernt, oder dieser Wächter liest den Aufruf nicht mehr.'
	);
	process.exit(1);
}
if (former === 0) {
	console.error(
		'Datumswächter: keine einzige Stelle ruft `kalendertag`. Entweder wird der Tag\n' +
			'wieder von Hand gebaut, oder dieser Wächter liest den Aufruf nicht mehr.'
	);
	process.exit(1);
}

console.log(
	`Datumswächter in Ordnung: ${geprueft} Dateien geprüft, ` +
		`${pruefer} rufen \`istKalendertag\`, ${former} rufen \`kalendertag\`.`
);
