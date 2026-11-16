/**
 * Abendbindungswächter: Eine Versammlung aus dem Formular gehört zu **diesem**
 * Abend.
 *
 * **Warum der Kennungswächter das nicht abdeckt.** `scripts/check-kennungen.mjs`
 * prüft den Gemeinschaftsbaum: Dort trägt die Adresse eine Gemeinschaft, und
 * die Schranke heisst `pruefe…Gehoert(…, params.id, …)`. Unter `tage/` trägt
 * die Adresse einen **Abend**, an dem mehrere Hausversammlungen gleichzeitig
 * tagen — die Versammlung steht dort mit Absicht nicht im Pfad, sondern im
 * Formular. Damit ist sie ein Wert von aussen, und die Frage ist dieselbe wie
 * dort, nur eine Ebene höher: Gehört sie zu dem Abend, dessen Seite den Knopf
 * gezeigt hat?
 *
 * **Der Anlass war ein Befund, kein Gedanke** (24.08.2026). Die Leitungsseite
 * des Abends nahm die Versammlung an acht Stellen ungeprüft entgegen; die
 * Einlassseite prüfte seit ihrem Bau. Der Zeilenschutz der Datenbank hält
 * fremde Betreiber ab, innerhalb des eigenen liess sich über eine
 * untergeschobene Kennung eine Versammlung ansteuern, die heute gar nicht
 * mittagt. Behoben wurde es damals von Hand — ohne Wächter hätte die nächste
 * neue Handlung dieselbe Lücke wieder.
 *
 * **Und warum `versammlungen/` hier fehlt.** Dort steht die Versammlung in der
 * Adresse, und die Bindung sitzt nicht in der Route, sondern im Kern
 * (`leseEines(tx, meetingId, id)` mit `AND meeting_id = …`). Dafür steht
 * `scripts/check-kernbindung.mjs` eine Stufe tiefer. Zwei Wächter über
 * denselben Baum, die verschiedene Fragen stellen, wären hier einer zu viel.
 *
 * **Was er verlangt.** Je Aktion unter `tage/[id=kennung]/`, die eine
 * Versammlungskennung aus dem Formular liest, eines von beidem:
 *
 *   - ein Aufruf `hausDesAbends(…, params.id, …)`, der den Abend aus der
 *     **Adresse** nimmt;
 *   - oder eine Zeile `abend: <feld> — <Begründung>` im Kommentar der Aktion,
 *     für die Fälle, in denen die Schranke woanders steht. Eine Ausnahme ohne
 *     Begründung zählt nicht.
 *
 * **Was er NICHT kann** — dieselben Grenzen wie der Kennungswächter, und aus
 * demselben Grund: Er liest Text, keinen Datenfluss. Eine Prüfung, die erst
 * **nach** dem Schreiben läuft, zählt für ihn als vorhanden; eine in einem
 * toten Zweig ebenso; ein Umweg über drei Zwischengrössen verliert ihn. Dagegen
 * hilft nur ein Mensch, deshalb steht im Ablauf dieses Repos ein
 * `/code-review` und ein `/security-review` vor jedem Commit.
 *
 * Eine Grenze ist ihm eigen: Er fragt **je Aktion**, ob eine Schranke mit
 * `params.id` darin steht, nicht je Feld. Eine Aktion, die beide Feldnamen
 * liest und nur einen davon bindet, ginge damit durch. Heute liest keine beide
 * (gemessen, 08.09.2026); wer die erste baut, prüft von Hand nach.
 *
 * Sein Gegentest steht in `tests/waechter/abendbindung.test.ts`. Läuft in
 * `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';
import { aktionen, ausnahmen, ohneKommentare, serverdateien } from './lib/serveraktionen.mjs';

/**
 * Der Baum, über den gelesen wird — vorgabemässig das Arbeitsverzeichnis.
 *
 * Ein Pfad als Argument ist **nur** für den Gegentest da: Er legt kleine Seiten
 * in ein Wegwerfverzeichnis und misst, dass der Wächter den schlechten Fall
 * findet und den guten in Ruhe lässt. Ohne diesen Weg liesse sich der Wächter
 * nur an sich selbst prüfen, und ein Wächter, der nie einen roten Fall gesehen
 * hat, ist eine Behauptung.
 */
const WURZEL = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const ROUTEN = join(WURZEL, 'src', 'routes', 'tage');

/**
 * Formularfelder, die eine Versammlungskennung tragen.
 *
 * **Die erste Fassung nannte zwei und behauptete, das sei gezählt worden**
 * (Sicherheitsprüfung 08.09.2026). Gemessen war es nicht: Die Erhebung hatte
 * nach `daten.get('…')` gesucht und damit jedes `getAll` übersehen. Es fehlten
 * `meetings` (die Häkchenliste unter `geschaefte/`) und `zeile` (die
 * Anwesenheitsliste, `<Haus>|<Partei>` in einem Wert). Zwei Seiten wurden
 * dadurch mitgezählt und nicht gelesen — genau das Muster, das dieser Wächter
 * anderswo schliesst.
 *
 * Der Fehler lag nicht im Wächter, sondern in der Erhebung daneben: Sein
 * eigenes Muster unten kennt `get` **und** `getAll`. Wer künftig ein Feld
 * sucht, sucht nach beidem.
 *
 * **Wer ein weiteres einführt, trägt es hier nach** — der Wächter meldet unten,
 * wie viele Felder er bewacht, damit ein Schwund auffällt.
 */
const VERSAMMLUNGSFELDER = new Set(['versammlung', 'meeting', 'meetings', 'zeile']);

/**
 * Die Argumente jedes `hausDesAbends(…)` in einem Text.
 *
 * **Mit Klammerzählung statt einem regulären Ausdruck** (Code-Review
 * 08.09.2026). `hausDesAbends\(([\s\S]*?)\)` endet an der **ersten**
 * schliessenden Klammer; ein Aufruf wie
 * `hausDesAbends(handelnder(locals).operatorId, params.id, v)` wäre damit nach
 * `handelnder(locals` abgeschnitten gewesen und hätte `params.id` nicht mehr
 * enthalten — falsches Rot an einer Stelle, die sauber gebunden ist.
 */
function schranken(text) {
	const raus = [];
	const NAME = /hausDesAbends\s*\(/g;
	for (const treffer of text.matchAll(NAME)) {
		let tiefe = 1;
		let i = treffer.index + treffer[0].length;
		while (i < text.length && tiefe > 0) {
			if (text[i] === '(') tiefe += 1;
			else if (text[i] === ')') tiefe -= 1;
			i += 1;
		}
		raus.push(text.slice(treffer.index + treffer[0].length, i - 1));
	}
	return raus;
}

const befunde = [];
let dateienGeprueft = 0;
let aktionenGeprueft = 0;
let felderBewacht = 0;
/**
 * Wie viele Felder nur über eine begründete Ausnahme durchgehen.
 *
 * Getrennt gezählt, damit eine neue Ausnahme eine Zahl senkt statt keine: Wer
 * `abend: X — irgendein Satz` schreibt, legt die Prüfung für dieses Feld still.
 * Sichtbar ist das sonst allein im Review.
 */
let felderAusgenommen = 0;

for (const pfad of mindestens(serverdateien(ROUTEN), 5, 'Serverdateien unter src/routes/tage/')) {
	if (!pfad.includes('[id=kennung]')) continue;
	const roh = readFileSync(pfad, 'utf8');
	if (!/export const (actions|GET|POST|PUT|PATCH|DELETE)\b/.test(roh)) continue;
	dateienGeprueft += 1;
	const ort = relative(WURZEL, pfad);

	for (const aktion of aktionen(roh)) {
		aktionenGeprueft += 1;
		const erlaubt = ausnahmen(aktion.roh, 'abend');
		const koerper = ohneKommentare(aktion.roh);

		const felder = [
			...new Set(
				[...koerper.matchAll(/daten\.get(?:All)?\(\s*['"`]([^'"`]+)['"`]\s*\)/g)]
					.map((t) => t[1])
					.filter((f) => VERSAMMLUNGSFELDER.has(f))
			)
		];
		if (felder.length === 0) continue;

		/*
		 * **Die Schranke muss `params.id` nennen.** Ein Aufruf mit einer
		 * Kennung aus demselben Formular prüfte Formularwert gegen Formularwert
		 * — er sähe wie eine Prüfung aus und wäre keine.
		 */
		const mitAdresse = schranken(koerper).some((argumente) => /params\.id/.test(argumente));

		for (const feld of felder) {
			if (mitAdresse) {
				felderBewacht += 1;
			} else if (erlaubt.has(feld)) {
				felderAusgenommen += 1;
			} else {
				befunde.push(
					`${ort} · ${aktion.name} — das Feld \`${feld}\` trägt eine Versammlung aus dem ` +
						'Formular und wird nicht gegen den Abend der Adresse geprüft. Entweder ' +
						`\`hausDesAbends(…, params.id, …)\` aufrufen oder \`abend: ${feld} — <Grund>\` ` +
						'in den Kommentar schreiben.'
				);
			}
		}
	}
}

if (befunde.length > 0) {
	console.error('Abendbindung: Versammlungen aus dem Formular ohne Bindung an den Abend.\n');
	for (const b of befunde) console.error(`  · ${b}`);
	console.error(
		'\nWarum das zählt: An einem Abend tagen mehrere Häuser. Prüft die Aktion die ' +
			'Kennung\nnicht nach, wirkt ein Knopf auf eine Versammlung, die heute gar nicht ' +
			'mittagt —\nund niemand merkt es, weil beide demselben Betreiber gehören.'
	);
	process.exit(1);
}

console.log(
	`Abendbindung in Ordnung: ${aktionenGeprueft} Aktionen auf ${dateienGeprueft} Seiten, ` +
		`${felderBewacht} Versammlungsfelder über die Schranke gebunden, ${felderAusgenommen} ` +
		'über eine begründete Ausnahme.'
);
