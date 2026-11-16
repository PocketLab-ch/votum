import { spawnSync } from 'node:child_process';

/**
 * Einen Wächter fahren, und einen **Absturz** von einem **Befund** trennen.
 *
 * **Der Anlass** (05.09.2026, gemessen). Ein Gegentest stellt zwei Fragen:
 * Findet der Wächter den Verstoss? Lässt er den guten Zustand in Ruhe? Die
 * dritte fällt leicht aus: **Heisst rot auch, was ich meine?** Ein Absturz ist
 * ebenfalls rot und belegt trotzdem nichts.
 *
 * Am Rückgabewert sind die beiden **nicht** zu trennen. Node beendet eine
 * ungefangene Ausnahme mit genau der `1`, die als Befund gilt — nachgemessen,
 * nicht geschlossen. Eine Prüfung `status !== 1` sieht wie eine Trennung aus und
 * ist keine; sie stand so in zwei Gegentests, mit einem Kommentar, der ihre
 * Wirkung behauptete.
 *
 * Gemessen mit sechs absichtlich abstürzenden Wächtern: **17 von 71 Prüfungen
 * blieben grün** und verbuchten den Absturz als Erfolg. Die übrigen fielen nur
 * deshalb, weil sie zusätzlich am gemeldeten Text prüfen.
 *
 * **Deshalb wirft diese Funktion, statt einen Wert zurückzugeben.** Ein Absturz
 * ist kein Testergebnis, sondern ein Fehler im Aufbau; ihn als `rot` zu
 * behandeln hiesse, ihn zu verwerten. Und weil sie wirft, muss keine einzelne
 * Prüfung daran denken: Sie sind alle auf einmal abgesichert, auch die, die nur
 * `expect(rot).toBe(true)` sagen.
 */

/**
 * Woran ein Absturz zu erkennen ist.
 *
 * Die Stapelspur ist das sicherste Merkmal: `  at datei:12:5` mit führenden
 * Leerzeichen kommt in keiner Wächtermeldung vor. Die Wächter melden ihre
 * Fundstellen zwar auch als `datei:12:5`, aber nie mit dem `at` davor und nie
 * am Zeilenanfang eingerückt.
 *
 * **Die schliessende Klammer gehört dazu** (05.09.2026, an einer eigens
 * gebauten Probe gefunden): Node schreibt den Rahmen als
 * `at foo (/pfad:1:1)`, und ohne das `\)?` traf das Muster nur die Form ohne
 * Funktionsnamen. Aufgefallen ist es erst an einem Wächter, dessen Spur kein
 * `node:internal` enthielt — bis dahin hatte dieser zweite Fangarm jeden Fall
 * gerettet, und das Muster sah aus, als tue es seine Arbeit.
 */
const STAPELSPUR = /ENOENT|Cannot find module|^\s+at .+:\d+:\d+\)?$|node:internal/m;

export interface Waechterlauf {
	/** Ob der Wächter einen Befund gemeldet hat. */
	rot: boolean;
	/** Was er dabei gesagt hat, `stdout` und `stderr` zusammen. */
	ausgabe: string;
	/**
	 * Sein Rückgabewert.
	 *
	 * **Er kann nur 0 oder 1 sein**, weil jeder andere Wert vorher wirft — er
	 * trägt also nicht mehr als `rot` (aus dem Code-Review, 05.09.2026: der
	 * erste Anlauf nannte ihn «gemessen statt gerechnet», und das war eine
	 * Zusicherung ohne Gehalt). Er steht hier, weil einige Gegentests ihre
	 * Erwartung als Zahl schreiben; den Schutz vor einem fremden Rückgabewert
	 * leistet der Wurf in `starte`, nicht dieses Feld.
	 */
	code: number;
}

/**
 * Fährt einen Wächter über einem Baum.
 *
 * @param skript Voller Pfad zum Wächter.
 * @param wurzel Die Wurzel, über der er prüfen soll. Fehlt sie, prüft der
 *   Wächter sein eigenes Arbeitsverzeichnis.
 * @param umgebung Eigene Umgebungswerte, falls der Gegentest welche braucht.
 *
 * **Die Reissleine wird abgeschaltet**, sobald über einem Wegwerfbaum gefahren
 * wird: Der hat eine Handvoll Dateien und träfe sonst die Untergrenze statt die
 * Regel, die geprüft werden soll. Über dem echten Repo bleibt sie an.
 *
 * @throws wenn der Wächter abstürzt, statt zu melden.
 */
export function fahreWaechter(
	skript: string,
	wurzel?: string,
	umgebung: Record<string, string> = {}
): Waechterlauf {
	const wegwerfbaum = wurzel !== undefined && wurzel !== process.cwd();
	return starte(
		skript,
		wurzel === undefined ? [skript] : [skript, wurzel],
		wegwerfbaum,
		undefined,
		umgebung
	);
}

/**
 * Fährt einen Wächter, der **sein eigenes Arbeitsverzeichnis** prüft.
 *
 * Elf der Wächter nehmen keine Wurzel entgegen und sehen immer auf
 * `process.cwd()`. Sie über einen Wegwerfbaum zu fahren geht nur so — ihnen
 * einen Baum als Argument zu geben, misst am Gegenstand vorbei und ergibt einen
 * grünen Lauf über dem echten Repo.
 */
export function fahreWaechterIn(skript: string, verzeichnis: string): Waechterlauf {
	return starte(skript, [skript], verzeichnis !== process.cwd(), verzeichnis);
}

/**
 * Fährt einen Wächter mit **eigenen Argumenten**, ohne Wurzel.
 *
 * Die elf Wächter ohne Wurzel nimmt `fahreWaechterIn` über ihr
 * Arbeitsverzeichnis; ein Wächter wie `check-abzug`, der eine Fixture als
 * Schalter (`--abzug <datei>`) entgegennimmt, passt in keine der beiden. Er
 * fährt hierüber, damit die Absturz-Prüfung aus einer Hand kommt statt als
 * zweite Abschrift der Stapelspur-Regel.
 */
export function fahreWaechterMit(
	skript: string,
	argumente: string[],
	umgebung: Record<string, string> = {}
): Waechterlauf {
	return starte(skript, [skript, ...argumente], false, undefined, umgebung);
}

function starte(
	skript: string,
	befehl: string[],
	wegwerfbaum: boolean,
	verzeichnis?: string,
	eigenes: Record<string, string> = {}
): Waechterlauf {
	/*
	 * **Eigene Werte kommen zuletzt**, damit ein Test die Reissleine bewusst
	 * wieder anschalten kann. Ein Gegentest, der genau das prüfen will, käme
	 * sonst nicht daran vorbei.
	 */
	const umgebung = wegwerfbaum
		? { ...process.env, VERSAMMLUNG_REISSLEINE: 'aus', ...eigenes }
		: { ...process.env, ...eigenes };

	/*
	 * **`spawnSync`, nicht `execFileSync`** (05.09.2026, aus dem Code-Review).
	 * `execFileSync` wirft nur im roten Fall und liefert im grünen allein
	 * `stdout`. Damit blieben zwei Löcher: Ein Wächter, der seine Ausnahme
	 * abfängt, die Spur nach `stderr` schreibt und mit 0 endet, galt als
	 * sauberer grüner Lauf, und ein per Signal beendeter Prozess (OOM-Killer)
	 * hat gar keine Ausgabe, an der sich etwas erkennen liesse. `spawnSync`
	 * gibt immer alle drei Angaben heraus: Rückgabewert, Signal und beide
	 * Ströme.
	 */
	const lauf = spawnSync('node', befehl, {
		env: umgebung,
		cwd: verzeichnis,
		encoding: 'utf8'
	});
	const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`;

	const absturz = (grund: string) =>
		new Error(
			`Der Wächter ${skript} ist abgestürzt, statt einen Befund zu melden (${grund}).\n` +
				'Ein Absturz ist rot und belegt trotzdem nichts — er darf nicht als\n' +
				`Befund durchgehen.\n\n${ausgabe}`,
			{ cause: lauf.error }
		);

	/*
	 * **`error` heisst nicht «nicht startbar»** (aus dem Code-Review): Ein
	 * fehlendes Skript startet `node` sehr wohl, dort greift die Stapelspur. Der
	 * praktisch erreichbare Fall ist ENOBUFS, wenn die Ausgabe den Deckel von
	 * einem Megabyte sprengt. Dann ist der Text abgeschnitten und jede Prüfung
	 * daran wäre geraten.
	 */
	if (lauf.error) throw absturz(`der Lauf war nicht auswertbar: ${lauf.error.message}`);
	// Von aussen beendet. Hier gibt es keine Ausgabe, an der man etwas sähe.
	if (lauf.signal) throw absturz(`beendet durch ${lauf.signal}`);
	/*
	 * **Der Rückgabewert allein trennt nichts**: Eine ungefangene Ausnahme endet
	 * in Node mit genau der `1`, die als Befund gilt. Deshalb die Stapelspur im
	 * Text — und umgekehrt auch der Wert, denn ein Absturz ohne Ausgabe hat
	 * keinen Text. Erst beide zusammen decken die Fälle ab.
	 */
	if (STAPELSPUR.test(ausgabe)) throw absturz('Stapelspur in der Ausgabe');
	if (lauf.status !== 0 && lauf.status !== 1) {
		throw absturz(`Rückgabewert ${lauf.status}`);
	}

	return { rot: lauf.status === 1, ausgabe, code: lauf.status };
}
