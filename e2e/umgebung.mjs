/**
 * Wer hat den Lauf gekippt: die Anwendung oder die Maschine?
 *
 * **Der Anlass, am 10.09.2026.** Vier Browserläufe sind an derselben Zusicherung
 * gestorben, und ich habe sie als bekannten Wackler abgetan, bevor ich gemessen
 * habe. Drei der vier hatten in derselben Sekunde ein Netzereignis aus einem
 * **fremden** Repo: Das Arbeitsverzeichnis über den Repos hält fünfzehn Projekte, aber einen einzigen
 * Docker-Dienst. Ein `compose up -d` nebenan hängt Container ans Netz, und für
 * einen laufenden Chromium sieht jedes Anhängen wie ein Netzwechsel aus.
 *
 * **Wer Ereignisse erzeugt, ist inzwischen gemessen** (10.09.2026, website-94 mit
 * mitlaufendem `docker events --filter type=network`, nicht nachträglich
 * abgefragt):
 *
 * | Vorgang | Netzereignisse |
 * |---|---|
 * | `exec` | 0 |
 * | `build --no-cache` (eine Schicht wirklich neu gezogen) | **0** |
 * | `up -d` (zwei Dienste) | **8** |
 * | `restart` (ein Dienst) | 2 |
 *
 * Das fällt **gegen** die Vermutung aus, die wir drei den Tag über hatten: Der
 * Bau ist entlastet, `up -d` ist der Verursacher. Dass es niemandem auffiel,
 * liegt daran, dass im Alltag auf jeden Bau ein `up -d` folgt. Unsere früheren
 * Zahlen zum Bau waren keine Messungen, sondern gezählte Container.
 *
 * Der Neustart bleibt der unauffälligste und deshalb gefährlichste: Niemand hält
 * ihn für eine Änderung an der Umgebung.
 *
 * **Und ein dritter Verursacher ist kein Mensch.** Im selben Mitschnitt standen
 * `disconnect` und `destroy` eines Netzes namens
 * `GITEA-ACTIONS-TASK-…-JOB-pruefen-…`: Gitea Actions legt je Auftrag ein eigenes
 * Netz an und räumt es wieder ab. Ein gekippter Lauf muss also nicht an einer
 * Nachbarsitzung liegen, und keine Absprache unter Menschen schützt davor. Vor
 * einem langen Lauf lohnt der Blick, ob gerade ein Arbeitsablauf läuft.
 *
 * **Was diese Datei tut und was ausdrücklich nicht.** Sie sammelt die
 * Netzereignisse des Zeitraums und legt sie neben den Abbruch. Sie sagt **nicht**
 * «die Umgebung war schuld»: Ein gleichzeitiges Ereignis ist ein Verdacht, kein
 * Beweis, und ein Lauf kann aus eigener Kraft rot sein, während nebenan gebaut
 * wird. Die Lehre des Tages war ja gerade, dass aus einer Gleichzeitigkeit zu
 * schnell eine Ursache wird.
 *
 * ## Gefragt wird nach den Minuten vor dem Abbruch, nicht nach dem ganzen Lauf
 *
 * Die erste Fassung fragte über die volle Laufzeit und hätte gelogen.
 * `docker events --since` liest aus einem **Ringspeicher des Dienstes**, nicht
 * aus einem Protokoll: `--since 6h` und `--since 24h` lieferten hier beide
 * **dieselben 247 Ereignisse**, das älteste zwanzig Minuten alt, und während
 * eines laufenden Durchstichs schrumpfte der Rückblick auf **achtzig Sekunden**.
 * Die Zustandsprüfungen der Container füllen den Speicher im Sekundentakt.
 *
 * **Die Grenze ist eine Anzahl, keine Dauer** (nachgemessen von website-7b am
 * 10.09.2026): `--since 120m` lieferte dreimal hintereinander genau **256
 * Zeilen**, alle aus Zustandsprüfungen. Wie weit der Rückblick reicht, hängt
 * also an der Ereignisrate des Hosts und schwankt von Minute zu Minute.
 *
 * **Und deshalb wird ohne `--filter` gefragt.** Der Filter greift NACH der
 * Kappung: In derselben Messung lieferte `--filter type=network` null Zeilen für
 * einen Zeitraum, in dem nachweislich sechzehn Netzereignisse lagen — die
 * Zustandsprüfungen hatten die 256 Plätze längst belegt. Eine gefilterte
 * Gegenprobe gibt also keine Entwarnung, sondern eine Leere, die wie eine
 * aussieht. Genau daran ist meine eigene Gegenmessung am selben Tag gescheitert.
 *
 * Für einen Lauf von fünfundzwanzig Minuten hätte dort «Umgebung: unauffällig»
 * gestanden — eine Entwarnung aus einem leeren Speicher, und damit genau die
 * Sorte Zusicherung, gegen die dieser ganze Tag ging.
 *
 * **Das kurze Fenster ist aber das richtige.** Ein fremdes Netzereignis tötet
 * einen laufenden Chromium in Sekunden, nicht nach zwanzig Minuten; wer nach dem
 * Abbruch fragt, will die Minuten davor sehen. Abgefragt wird deshalb ein festes
 * kurzes Fenster, und **ohne Filter**, damit der älteste Zeitstempel den
 * tatsächlichen Rückblick verrät. Reicht er nicht einmal so weit, sagt der
 * Befund das, statt Ruhe zu melden.
 *
 * Wer mehr will, lässt `docker events --filter type=network` beim Start
 * mitlaufen und liest die Datei am Ende. Das ist der vollständige Weg, hier
 * bewusst nicht gebaut: Ein mitlaufender Prozess muss einen Abbruch überleben,
 * und der Gegenwert wäre gering.
 */

/** Wie weit zurück gefragt wird. Länger gibt der Ringspeicher meist nicht her. */
const FENSTER_S = 300;

/**
 * Das obere Ende der Abfrage.
 *
 * **Nicht weglassen**: Ohne `--until` strömt `docker events` weiter und kehrt
 * nie zurück. **Und nicht `0s`**: Damit kam hier nichts zurück, an einer eigens
 * angelegten Probe gemessen. Es bleibt `1s`, und damit ein blinder Fleck von
 * einer Sekunde am oberen Rand. Er trägt: Ein Browser stirbt an einem
 * Netzwechsel nicht in derselben Sekunde, sondern über einen fehlgeschlagenen
 * Abruf, und bis der Durchstich seine Zusicherung aufgibt, vergehen weitere.
 */
const BIS = '1s';
import { execFileSync } from 'node:child_process';

/** Woran ein Abbruch aussieht, als hätte ihm jemand das Netz weggezogen. */
const NETZWORTE =
	/ERR_NETWORK_CHANGED|ERR_CONNECTION|ERR_EMPTY_RESPONSE|net::|dynamically imported|Target closed|Navigation failed/i;

/**
 * Alle Ereignisse, die der Dienst für den Zeitraum noch hergibt.
 *
 * **Ohne Filter**, weil sonst der Horizont nicht zu sehen wäre: Ein leeres
 * Ergebnis mit Filter heisst «keine Netzereignisse ODER gar nichts mehr im
 * Speicher», und die beiden zu verwechseln ist der Fehler, den diese Datei
 * vermeiden soll.
 *
 * @returns {{ ms: number, typ: string, was: string, netz: string }[] | null}
 *   `null`, wenn `docker` nicht erreichbar war. Ein Durchstich darf an seiner
 *   eigenen Diagnose nicht scheitern, deshalb kein Wurf.
 */
export function ereignisse() {
	try {
		const roh = execFileSync(
			'docker',
			[
				'events',
				'--since',
				`${FENSTER_S}s`,
				'--until',
				BIS,
				'--format',
				'{{.Time}}\t{{.Type}}\t{{.Action}}\t{{.Actor.Attributes.name}}'
			],
			{ encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024 }
		);
		return roh
			.split('\n')
			/*
			 * **Nur Zeilen, die mit einem Zeitstempel beginnen** (10.09.2026 an der
			 * Maschine gefunden). Der Befehl einer Zustandsprüfung steht mit im
			 * `Action`-Feld, und mindestens einer davon enthält einen Zeilenumbruch:
			 * Aus einem Ereignis werden zwei Zeilen, und die zweite hat keine Zeit.
			 * `Math.min` über die Liste ergab dann `NaN`, und der Horizont stand als
			 * «Invalid Date» im Bericht — die Lücke, die diese Datei ausweisen soll,
			 * wäre unsichtbar geblieben.
			 */
			.filter((z) => /^\d+\t/.test(z))
			.map((z) => {
				const [stempel, typ, was, netz] = z.split('\t');
				return {
					ms: Number(stempel) * 1000,
					typ: typ ?? '?',
					was: (was ?? '?').split(':')[0],
					netz: netz ?? '?'
				};
			});
	} catch {
		return null;
	}
}

const uhr = (ms) => new Date(ms).toLocaleTimeString('de-CH');

/**
 * Der Satz, der nach einem Abbruch neben die Meldung gehört.
 *
 * @param {string} [meldung] Die Abbruchmeldung, falls es eine gibt.
 * @returns {string} Mehrzeilig, immer mit einem Urteil am Anfang.
 */
export function umgebungsbefund(meldung = '') {
	const alle = ereignisse();
	if (alle === null) {
		return 'Umgebung: nicht geprüft — `docker events` antwortet hier nicht.';
	}
	if (alle.length === 0) {
		return 'Umgebung: nicht geprüft — der Docker-Dienst meldet für den Zeitraum gar nichts.';
	}

	const horizont = Math.min(...alle.map((e) => e.ms));
	const netz = alle.filter((e) => e.typ === 'network');
	const zeilen = [];

	/*
	 * **Die Lücke zuerst.** Steht sie unten, liest sie niemand, und der Befund
	 * wirkt vollständiger als er ist.
	 */
	const rueckblick = Math.round((Date.now() - horizont) / 1000);
	/*
	 * **Gemessen wird gegen das, was gefragt wurde** (Code-Review 10.09.2026). Die
	 * erste Fassung warnte erst unter sechzig Sekunden, und an der laufenden
	 * Maschine standen achtzig da: keine Warnung, obwohl von den gefragten fünf
	 * Minuten vier Fünftel fehlten. Eine feste Zahl neben einer beweglichen ist
	 * keine Schwelle, sondern ein Zufall.
	 */
	if (rueckblick < FENSTER_S - 10) {
		zeilen.push(
			`Umgebung: der Rückblick reicht ${rueckblick} statt der gefragten ${FENSTER_S} Sekunden ` +
				`(ab ${uhr(horizont)}). Der Ringspeicher des Docker-Dienstes ist voll; davor ist ` +
				'NICHTS geprüft.'
		);
	}

	if (netz.length === 0) {
		zeilen.push(
			zeilen.length === 0
				? `Umgebung: unauffällig — kein Netzereignis in den letzten ${rueckblick} Sekunden ` +
						`(ab ${uhr(horizont)}), ${alle.length} andere Ereignisse gesehen.`
				: `  Im geprüften Teil: kein Netzereignis, ${alle.length} andere Ereignisse gesehen.`
		);
		return zeilen.join('\n');
	}

	const netze = [...new Set(netz.map((e) => e.netz))];
	zeilen.push(
		`${zeilen.length === 0 ? 'Umgebung: ' : '  '}${netz.length} Docker-Netzereignisse, ` +
			`in ${netze.length} Netzen (${netze.slice(0, 6).join(', ')}).`
	);
	for (const e of netz.slice(-5)) zeilen.push(`    ${uhr(e.ms)}  ${e.was}  ${e.netz}`);

	/*
	 * **Der Verdacht wird ausgesprochen, die Ursache nicht.** Passt die Sekunde,
	 * ist die Umgebung der erste Ort zum Nachsehen — mehr sagt eine
	 * Gleichzeitigkeit nicht. Wer hier «war die Umgebung» schriebe, verschöbe das
	 * Problem nur von einer ungeprüften Erklärung zur nächsten.
	 */
	zeilen.push(
		NETZWORTE.test(meldung)
			? '  Der Abbruch nennt das Netz, und nebenan war etwas los: dort zuerst nachsehen. ' +
					'Ein gleichzeitiges Ereignis ist ein Verdacht, kein Beweis — der Beweis ist ' +
					'derselbe Lauf gegen eine ruhige Maschine.'
			: '  Der Abbruch nennt das Netz nicht; die Ereignisse stehen hier nur als Umfeld.'
	);
	return zeilen.join('\n');
}
