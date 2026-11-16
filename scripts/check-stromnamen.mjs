/**
 * Namenswächter: Über den Ereignisstrom geht kein Name.
 *
 * **Der Anlass, am 06.09.2026.** Die Sitzungsleitung soll sehen, wer noch nicht
 * abgestimmt hat («Im Saal ruft man Namen auf, nicht Zahlen»,
 * Bedienbarkeitsprüfung 05.09.2026). Der erste Anlauf hängte die Namen in
 * `Abstimmungsstand` — also in das Objekt, das an den Beamer und an **jedes**
 * Teilnehmertelefon geht. Wer die Liste der Ausstehenden liest, weiss im
 * Umkehrschluss, wer schon gestimmt hat.
 *
 * Der Modulkopf von `ereignisstrom.ts` verbietet das seit je (AD-11): «Nie ein
 * Name, nie ein Stimmverhalten, nie eine Kennung, aus der sich eine Person
 * ableiten lässt.» Gefunden hat es der Code-Review, nicht der Prüflauf — es gab
 * dafür keinen.
 *
 * **Warum nicht zeilenweise** (Sicherheitsdurchgang 06.09.2026): Der erste
 * Wächter verankerte am Zeilenanfang und übersah damit jedes Feld in einem
 * einzeiligen Objekttyp — also genau den Stil, den die Datei selbst führt
 * (`bedingungen: { bezeichnung: string; … }[]`). Nachgemessen: `ausstehende: {
 * name: string; kennung: string }[]` kam durch. Gesucht wird deshalb über den
 * ganzen Text.
 *
 * **Und mit Untergrenze**: Eine leere oder verschobene Datei meldete «trägt
 * keine Namensfelder» — der Wächter prüfte nur, dass ein Pfad existiert. Wer
 * die Typen künftig auslagert, bekommt jetzt einen Befund statt eines
 * stillen Erfolgs.
 */
import { existsSync, readFileSync } from 'node:fs';

const DATEI = 'src/lib/server/ereignisstrom.ts';

/** Was in der Datei stehen muss, damit der Wächter etwas gemessen hat. */
const ERWARTET = ['interface Stromnachricht', 'interface Abstimmungsstand'];

/** Mindestzahl an Feldern, die eine unversehrte Datei trägt (heute rund 40). */
const MINDESTFELDER = 20;

/*
 * **Melden statt abstürzen** (`tests/waechter/reissleine.test.ts`): Ein
 * Wächter, der aus einem leeren Arbeitsverzeichnis mit ENOENT endet, ist von
 * einem Befund nicht zu unterscheiden — beide enden mit Rückgabewert 1. Genau
 * 1 verlangt der Test dort auch von diesem Ausgang.
 */
if (!existsSync(DATEI)) {
	console.error(`Stromwächter: ${DATEI} gibt es nicht. Läuft der Wächter im Repo-Wurzelverzeichnis?`);
	process.exit(1);
}

const text = readFileSync(DATEI, 'utf8');

const fehlend = ERWARTET.filter((e) => !text.includes(e));
if (fehlend.length > 0) {
	console.error(
		`Stromwächter: In ${DATEI} fehlt ${fehlend.join(' und ')}.\n` +
			'Sind die Stromtypen umgezogen? Dann gehört dieser Wächter mit — sonst schaut ab\n' +
			'jetzt niemand mehr auf Namensfelder (AD-11).'
	);
	process.exit(1);
}

const felder = [...text.matchAll(/(?<![A-Za-z])([a-zA-Z]+)\??\s*:/g)].map((m) => m[1]);
if (felder.length < MINDESTFELDER) {
	console.error(
		`Stromwächter: Nur ${felder.length} Felder in ${DATEI} gefunden, erwartet mindestens ` +
			`${MINDESTFELDER}. Der Wächter hat offenbar nicht gemessen, was er messen soll.`
	);
	process.exit(1);
}

const treffer = [...new Set(felder.filter((f) => /[nN]ame/.test(f)))];
if (treffer.length > 0) {
	console.error(
		`Der Ereignisstrom trägt Namensfelder: ${treffer.map((t) => `«${t}»`).join(', ')}\n` +
			`(${DATEI}, AD-11: «Nie ein Name … der Grund ist der Beamer»)\n\n` +
			'Wer die Angabe in der Oberfläche braucht, nimmt sie aus dem Loader:\n' +
			'Der Strom stösst `invalidateAll()` an, der Loader kommt damit ohnehin neu.'
	);
	process.exit(1);
}

console.log(`Stromnamen: ${felder.length} Felder in ${DATEI}, keines trägt einen Namen.`);
