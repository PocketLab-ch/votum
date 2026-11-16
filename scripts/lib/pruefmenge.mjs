/**
 * Die Reissleine für Wächter: Eine leere Prüfmenge ist kein grüner Befund.
 *
 * **Der Anlass** (04.09.2026). Gemessen über einem leeren Baum, jeder Wächter so
 * gefahren, wie er seine Wurzel nimmt: **5 von 25** meldeten «in Ordnung» und
 * gaben Rückgabewert 0. Der schlimmste, `check-fokusmarke`, meldete «0 Ziele in
 * 0 Dateien, 0 feste Marken, jede mit Ziel» — eine Erfolgsmeldung, die ihre
 * Glaubwürdigkeit aus Zahlen bezieht, die nichts gemessen haben.
 *
 * **Die erste Messung sagte 16, und sie war falsch.** Sie gab allen Wächtern
 * einen leeren Baum als Argument — auch den elf, die gar keins annehmen und
 * immer `process.cwd()` prüfen. Die haben also nie den leeren Baum gesehen,
 * sondern das echte Repo, und dort zu Recht grün gemeldet. Wer eine Messung
 * baut, muss prüfen, ob sie den Gegenstand trifft; sonst misst er sein eigenes
 * Werkzeug. Vier weitere waren **aus Versehen rot**: Sie stürzten an einer
 * fehlenden Datei mit einem nackten `ENOENT` ab, was zwar rot ist, aber nicht
 * sagt, dass der Wächter nichts mehr zu prüfen hat.
 *
 * Das ist die gefährlichste Art, einen Wächter zu verlieren, denn sie sieht wie
 * Erfolg aus. Ein Wächter, der rot wird, ruft nach Aufmerksamkeit; einer, der
 * seine Prüfmenge verloren hat, bestätigt jeden Commit.
 *
 * **Warum das nicht theoretisch ist.** Die Wurzel kommt bei allen aus
 * `process.argv[2] ?? process.cwd()`, und jede Baumfunktion im Haus fängt einen
 * fehlenden Ordner ab und gibt ein leeres Feld zurück. Ein umbenanntes
 * Verzeichnis, ein verschobener Baustein, ein Aufruf aus dem falschen
 * Arbeitsverzeichnis: Der Wächter sagt «in Ordnung».
 *
 * ## Warum die Zahl der Dateien und nicht die der Treffer
 *
 * Fast alle Wächter hier sind **Verbotswächter**: Sie suchen ein unerwünschtes
 * Muster, und «null Treffer» ist ihr Erfolgsfall. Eine Untergrenze auf der
 * Trefferzahl wäre also sinnlos. Gemessen wird deshalb, **wie viel er zu lesen
 * bekam** — dass eine Datei nichts enthält, ist normal; dass gar keine mehr da
 * ist, heisst, dass er nicht mehr hinsieht.
 *
 * ## Warum je Quelle und nicht als Summe
 *
 * Aus dem Code-Review am neuen `check-waechternamen` (04.09.2026): Dessen erste
 * Fassung setzte eine Gesamtgrenze von 30 Nennungen — und 31 davon standen
 * allein in `README.md`. Die Grenze wäre erfüllt gewesen, auch wenn er `src/`
 * und `docs/` gar nicht mehr liest. Eine Summe misst die Menge, nicht die
 * Herkunft: Fällt eine Quelle weg, füllt eine andere die Schwelle auf. Wer
 * mehrere Quellen liest, ruft deshalb je Quelle.
 *
 * ## Der Ausschalter ist benannt, und leer heisst nicht aus
 *
 * Aus dem Austausch mit einer Nachbarsitzung (04.09.2026), die denselben Umbau
 * an ihrem Repo gemacht und dabei zweimal dieselbe Klasse gefunden hat:
 *
 *   - **Eine Schranke, die an einer fremden Einstellung hängt, ist keine.** Dort
 *     lief sie nur, wenn eine andere Variable ungesetzt war, mit der Begründung
 *     «die Gegentests fahren gegen Beispielbäume». Gemessen liess sich der
 *     Ausfall damit unbemerkt herbeiführen. Hier hat sie deshalb einen eigenen,
 *     benannten Ausschalter.
 *   - **Eine leere Angabe schaltet nicht ab.** `VERSAMMLUNG_REISSLEINE=` ist ein
 *     Fehler, kein «aus» — `??` greift bei der leeren Zeichenkette nicht, und
 *     genau so verschwindet eine Schranke lautlos.
 *
 * Den Ausschalter braucht der Gegentest eines Wächters: Er fährt gegen einen
 * Wegwerfbaum mit einer Handvoll Dateien und träfe sonst die Reissleine statt
 * die Regel, die er prüfen will. Er wird deshalb je Kindprozess gesetzt, nie
 * für die ganze Sitzung — und `scripts/reissleine-an.mjs` sorgt am Anfang von
 * `npm run pruefen` dafür, dass ein vergessenes `export` den Lauf anhält statt
 * ihn still zu entwerten. Ein Hinweis aus dieser Datei taugt dafür nicht: Er
 * käme aus rund siebzig Testprozessen und wäre Dauerrauschen, und man lernt
 * genau das Signal zu überlesen, das etwas bedeuten soll. Dass die Reissleinen selbst greifen, prüft
 * `tests/waechter/reissleine.test.ts` über **alle** Wächter auf einmal.
 */

const SCHALTER = 'VERSAMMLUNG_REISSLEINE';

/**
 * Ob die Reissleinen abgeschaltet sind.
 *
 * Nur der ausdrückliche Wert `aus` schaltet ab. Jeder andere Wert ist ein
 * Fehler und bricht ab, statt still weiterzulaufen: Ein Tippfehler im
 * Ausschalter darf nicht wie ein Ausschalter wirken.
 */
function abgeschaltet() {
	const wert = process.env[SCHALTER];
	if (wert === undefined) return false;
	if (wert === 'aus') return true;
	console.error(
		`\n${SCHALTER}=«${wert}» ist kein gültiger Wert. Erlaubt ist allein «aus».\n` +
			'Eine leere oder unverstandene Angabe schaltet die Reissleinen **nicht** ab,\n' +
			'weil eine Schranke, die sich versehentlich abschalten lässt, keine ist.\n'
	);
	process.exit(2);
}

/**
 * Gibt `gefunden` zurück oder bricht ab, wenn es zu wenig ist.
 *
 * Durchreichend gebaut, damit der Aufruf ein Ausdruck bleibt und sich vor eine
 * bestehende Schleife setzen lässt, ohne die Baumfunktion daneben anzufassen:
 *
 *     for (const pfad of mindestens(dateien(join(WURZEL, 'src')), 400, 'Dateien unter src/')) {
 *
 * @param {unknown[]} gefunden Was der Baumlauf geliefert hat.
 * @param {number} zahl Untergrenze. Deutlich unter dem heutigen Bestand, damit
 *   sie beim Aufräumen nicht stört, und deutlich über null, damit sie etwas
 *   bedeutet.
 * @param {string} wofuer Was gesucht wurde, für die Meldung im Klartext.
 */
export function mindestens(gefunden, zahl, wofuer) {
	if (abgeschaltet()) return gefunden;
	if (gefunden.length >= zahl) return gefunden;
	console.error(
		`\nDer Wächter hat nur ${gefunden.length} von mindestens ${zahl} erwarteten ` +
			`Dateien gefunden\n(${wofuer}).\n\n` +
			'Er liest damit nicht mehr, was er lesen soll, und ein Wächter mit leerer\n' +
			'Prüfmenge ist grün und wertlos. Wurde das Verzeichnis verschoben oder\n' +
			'umbenannt, gehört der Wächter mit umgebaut; wurde wirklich so viel entfernt,\n' +
			'gehört die Untergrenze angepasst — mit einem Blick darauf, ob sie dann noch\n' +
			'etwas bedeutet.\n'
	);
	process.exit(1);
}
