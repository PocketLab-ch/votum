/**
 * Sagt vor dem Prüflauf, ob gerade schon einer läuft.
 *
 * **Der Anlass, gemessen am 22.09.2026.** Hier arbeiten mehrere Sitzungen am
 * selben Repo und derselben Maschine. An diesem Tag kollidierten sie fünfmal;
 * zweimal wies der Pre-Commit-Hook einen Commit ab, beide Male an einer
 * Zeitüberschreitung in `tests/waechter/kernbindung.test.ts`, bei
 * Lastdurchschnitt 10,1 beziehungsweise 10,6. Rot war nicht der Block,
 * sondern die Uhr.
 *
 * **Warum das hier steht und nicht in einer Absprache.** Bei der letzten der
 * fünf Kollisionen hatten **beide** Sitzungen vorher angesagt. Das half
 * nichts, weil zwischen Ansage und Start keine Antwort lag. Eine Regel, an die
 * man sich erinnern muss, fällt aus, sobald es eilig wird; eine Eigenschaft
 * des Werkzeugs nicht.
 *
 * **Warum vor dem Lauf und nicht in ihm** (Code-Review 23.09.2026). Ein erster
 * Entwurf hängte den Hinweis an `check:reissleine`, also an das erste Glied
 * der Kette. Dort erreicht er niemanden: Der Hook leitet die ganze Ausgabe in
 * eine Datei, verwirft sie im guten Fall und zeigt im schlechten die letzten
 * vierzig Zeilen. Der Hinweis stünde als erster von achtunddreissig Schritten
 * ganz oben und wäre nie darunter. Er löste damit genau den Fall nicht, der
 * ihn ausgelöst hat.
 *
 * **Und auf dem Wirt, nicht im Container.** Im Container sind nur dessen
 * eigene Prozesse sichtbar. Ein Browserdurchlauf läuft auf dem Wirt, ein
 * Prüflauf in `immotool` oder `cmms` ebenso, ein `compose build` im
 * Nachbarrepo auch. Alle drei treiben dieselbe Last und wären von innen
 * unsichtbar.
 *
 * **Er hält nichts auf.** Eine Sperre, die man nicht abschalten kann, hält
 * irgendwann den Berechtigten auf; eine, die man abschalten kann, ist
 * abgeschaltet. Der Hinweis nennt, was er sieht, und überlässt den Rest dem
 * Menschen.
 *
 * **Seit dem 14.10.2026 gibt es daneben eine Sperre**, aber nur für volle
 * versammlung-Läufe über scripts/pruefen.sh: Zwei davon gleichzeitig trieben
 * die Last auf 9,5 bei 8 Kernen und machten Kerntests rot, und beide setzen
 * dieselbe clusterweite Rolle. Sie wartet höchstens 15 Minuten und lässt
 * sich mit VERSAMMLUNG_PRUEFSPERRE auf eine eigene Datei umgehen. Fremde
 * Last (Browserläufe, andere Repos) hält weiterhin nichts auf; die meldet
 * dieser Hinweis.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Prozesse, die nach einem langen Lauf aussehen.
 *
 * `npm run pruefen` trägt npm selbst in die Kommandozeile ein (npm setzt
 * `process.title`, gemessen an PID 1 des Anwendungscontainers), der Eintrag
 * steht also vom ersten Wächter an da und nicht erst in der Testphase.
 * `vitest` und `svelte-check` fangen die Phasen, in denen es richtig weh tut.
 * `durchspielen.mjs` ist der Browserdurchlauf, `npm install` der Eingriff an
 * den geteilten `node_modules`.
 */
const MUSTER = /\bvitest\b|\bsvelte-check\b|npm run pruefen|durchspielen\.mjs|\bnpm (install|ci)\b/;

/**
 * Zeilen, die einen Lauf **fernsteuern**, statt ihn zu sein.
 *
 * `docker compose exec -T app npm run pruefen` trifft `MUSTER`, ist aber nur
 * die Hülle: Der eigentliche Lauf läuft im Container und ist auf dem Wirt
 * eigens sichtbar. Ohne diese Unterscheidung zählt ein Prüflauf doppelt.
 * Dasselbe gilt seit dem 14.10.2026 für `docker run`: scripts/pruefen.sh
 * fährt den Prüflauf im Einmalcontainer (Arbeitsbaum-Vertrag). Das Muster
 * verlangt `exec` oder `run` als Wort nach `docker`, mit beliebigen Optionen
 * dazwischen (`compose -p x exec`, `container exec`), aber vor dem ersten
 * `npx`/`npm`/`node`/`vitest`: Sonst gälte `docker-entrypoint.sh … vitest
 * run` als Hülle.
 */
const FERNBEDIENUNG =
	/(^|[/\s])docker(-compose)?\b(?:(?!\s(?:npx|npm|node|vitest)\s).)*?\s(?:exec|run)\s|\bkubectl\b.*\bexec\b/;

/** Ab hier lohnt der Hinweis auch ohne erkannten Prozess. */
const LASTSCHWELLE = 4;

/**
 * Die eigene Prozesskette, damit sich der Lauf nicht selbst meldet.
 *
 * **Und was sie nicht leistet:** Sie schliesst die Vorfahrenlinie aus, nicht
 * die Geschwister. Vor dem Lauf gibt es keine, deshalb trägt das hier. Wer den
 * Hinweis später aus einem Test heraus aufruft, findet die übrigen Arbeiter
 * desselben Laufs und hält sie für fremd.
 *
 * **Bricht das Lesen ab, ist die Kette verkürzt**, und die darüberliegenden
 * Vorfahren fehlen in der Ausschlussmenge. Dann meldet der Lauf im
 * schlimmsten Fall sich selbst; das ist ein überflüssiger Hinweis, kein
 * verlorener.
 */
function eigeneKette() {
	const kette = new Set();
	let pid = process.pid;
	for (let i = 0; i < 64 && pid > 0; i++) {
		kette.add(pid);
		try {
			const status = readFileSync(`/proc/${pid}/status`, 'utf8');
			const treffer = status.match(/^PPid:\s*(\d+)$/m);
			pid = treffer ? Number(treffer[1]) : 0;
		} catch {
			break;
		}
	}
	return kette;
}

/**
 * Liest alle Prozesse als `{ pid, ppid, zeile }`.
 *
 * Getrennt vom Falten, damit das Falten ohne `/proc` prüfbar ist.
 */
function leseProzesse() {
	let eintraege;
	try {
		eintraege = readdirSync('/proc');
	} catch {
		return []; // Kein procfs, etwa ausserhalb von Linux.
	}
	const prozesse = [];
	for (const name of eintraege) {
		if (!/^\d+$/.test(name)) continue;
		const pid = Number(name);
		/*
		 * **Getrennt lesen, und die Elternkante ist die wichtigere.** Ein
		 * erster Entwurf legte beide Lesevorgänge in denselben `try` und
		 * verwarf den Prozess ganz, wenn der zweite fehlschlug. Das kostet
		 * nicht nur einen möglichen Treffer, sondern den **Karteneintrag**:
		 * Fehlt der Prozess in `eltern`, bricht die Kette dort ab, und ein
		 * Treffer darunter zählt als eigener Lauf.
		 *
		 * Aus demselben Grund landen Prozesse mit leerer Kommandozeile hier
		 * trotzdem in der Liste. Zombies und Kernel-Fäden haben keine, sind
		 * aber gültige Zwischenglieder; gefiltert wird erst bei der
		 * Trefferauswahl in `falteLaeufe`.
		 */
		let ppid = 0;
		try {
			const status = readFileSync(`/proc/${pid}/status`, 'utf8');
			ppid = Number(status.match(/^PPid:\s*(\d+)$/m)?.[1] ?? 0);
		} catch {
			// Verschwindet der Prozess zwischen Auflisten und Lesen, ist das
			// Alltag und kein Fehler. Ohne Elternkante ist er als Zwischenglied
			// wertlos, also bleibt er draussen.
			continue;
		}
		let zeile = '';
		try {
			zeile = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
		} catch {
			// Kommandozeile nicht lesbar: als Treffer fällt er aus, als
			// Zwischenglied der Kette trägt er weiter.
		}
		prozesse.push({ pid, ppid, zeile });
	}
	return prozesse;
}

/**
 * Faltet die Prozessliste zu **Läufen**.
 *
 * **Der Anlass, gemessen von website-78 am 23.09.2026.** Die erste Fassung
 * zählte Prozesse und meldete bei einem einzigen laufenden Prüflauf
 * «4 Prozess(e)»: Bash-Hülle, `docker compose exec`, das Compose-Plugin und
 * ein weiteres Glied derselben Kette. Wer das liest, hält vier Läufe für
 * unterwegs und schätzt die Lage schlimmer ein, als sie ist; bei zwei echten
 * Läufen stünde dort «8», und die Zahl wäre gar nichts mehr wert.
 *
 * Die tragende Grösse ist die Zahl der Läufe, nicht der Prozesse. Ein Treffer,
 * der Vorfahr eines anderen Treffers ist, gehört zu dessen Kette und zählt
 * nicht eigens. Übrig bleibt je Kette der unterste, und der trägt zugleich die
 * aussagekräftigere Zeile: `docker compose exec -T app npm run pruefen` statt
 * der Bash-Hülle mit dem Schnappschusspfad, die vorher zuoberst stand.
 *
 * **Das ist dieselbe Überlegung wie beim Ausschluss der eigenen Kette**, nur
 * auf die fremden angewandt.
 *
 * **Und die Elternkette allein genügt nicht, weil sie an der Containergrenze
 * endet** (Code-Review 23.09.2026, am Wirt nachgemessen). Der Prüflauf läuft im
 * Container, das Skript auf dem Wirt. Ein Prozess im Container hängt dort nicht
 * am `docker compose exec`, das ihn gestartet hat, sondern am
 * `containerd-shim-runc-v2`: gemessen ist `npm run dev` mit PPid auf den Shim,
 * und der hat PPid 1. Wirtkette und Containerkette sind zwei getrennte Wurzeln,
 * und die Faltung über Vorfahren verbindet sie nie. Ein einziger Prüflauf hätte
 * deshalb weiter **zwei** Läufe gemeldet, und das Wort «Läufe» wiegt schwerer
 * als das frühere «Prozesse».
 *
 * Was die beiden verbindet, ist nicht die Abstammung, sondern die **Rolle**:
 * `docker compose exec` ist die Fernbedienung eines Laufs, nicht der Lauf.
 * Sie zählt deshalb nur, wenn sonst nichts übrig bleibt, denn dann ist sie das
 * Einzige, was von diesem Lauf zu sehen ist.
 *
 * Rein, ohne Dateizugriff, damit eine Probe sie mit erfundenen Listen fahren
 * kann. Genau das ist der Punkt: Eine Messung im Kommentar überlebt die
 * Sitzung, aber keinen Umbau.
 *
 * **Von einer zweiten Sitzung gegengeprüft** (website-7c, 23.09.2026), beide
 * Fassungen gegen **denselben** Prozessbaum bei einem einzigen laufenden
 * Prüflauf, Baum und Meldung im selben Augenblick erhoben:
 *
 * | | Meldung | zuerst gezeigt |
 * |---|---|---|
 * | vor diesem Umbau | «3 Prozess(e)» | `docker compose exec …` |
 * | danach | «1 Lauf» | `npm run pruefen` |
 *
 * Dazu die Probe, die trägt, weil sie ein Paar ist: Dieselbe Zeichenkette, die
 * das Muster trifft, erzeugt in der **eigenen** Aufrufkette keine Ausgabe und
 * in einem **fremden**, über `setsid` abgekoppelten Prozess «1 Lauf». Es
 * entscheidet die Abstammung, nicht der Text.
 *
 * @param {{pid: number, ppid: number, zeile: string}[]} prozesse
 * @param {Set<number>} [ausschluss] Die eigene Kette.
 * @returns {string[]} Je Lauf eine Zeile.
 */
export function falteLaeufe(prozesse, ausschluss = new Set()) {
	const treffer = prozesse.filter((p) => !ausschluss.has(p.pid) && MUSTER.test(p.zeile));
	const eltern = new Map(prozesse.map((p) => [p.pid, p.ppid]));

	/**
	 * Ist `kandidat` ein echter Vorfahr von `pid`?
	 *
	 * @param {number} kandidat
	 * @param {number} pid
	 * @returns {boolean}
	 */
	const istVorfahrVon = (kandidat, pid) => {
		// Die Schranke fängt einen Zyklus in einer widersprüchlichen
		// Momentaufnahme von /proc ab; ohne sie liefe die Schleife ewig.
		for (let i = 0, lauf = eltern.get(pid) ?? 0; i < 64 && lauf > 0; i++) {
			if (lauf === kandidat) return true;
			lauf = eltern.get(lauf) ?? 0;
		}
		return false;
	};

	const gefaltet = treffer.filter(
		(p) => !treffer.some((q) => q.pid !== p.pid && istVorfahrVon(p.pid, q.pid))
	);

	/*
	 * Der Lauf, den eine Fernbedienung meint, ist auf dem Wirt als eigener
	 * Prozess sichtbar, nur an einer anderen Wurzel. Bleibt nach dem Filtern
	 * nichts übrig, war der Container von hier aus nicht einsehbar; dann ist
	 * die Hülle die einzige Spur und zählt.
	 */
	const ohneHuelle = gefaltet.filter((p) => !FERNBEDIENUNG.test(p.zeile));
	return (ohneHuelle.length > 0 ? ohneHuelle : gefaltet)
		.map((p) => kuerze(p.zeile))
		// Sortiert, damit die Ausgabe bei gleicher Lage gleich aussieht: Die
		// Reihenfolge von `readdir` hängt an Prozesskennungen und wechselt
		// zwischen zwei Aufrufen ohne erkennbaren Grund. Der Preis ist, dass
		// bei mehr als drei Läufen die alphabetisch ersten gezeigt werden und
		// nicht die auffälligsten; in dieser Lage trägt ohnehin die Zahl.
		.sort();
}

/**
 * Kürzt auf 78 Zeichen, aber an einer Wortgrenze.
 *
 * Die erste Fassung schnitt hart ab und endete mitten im Wort
 * («npm run pruef»), was wie ein anderer Befehl aussieht.
 *
 * **Und wo sie es nicht kann:** Steht im Fenster keine Wortgrenze jenseits der
 * halben Breite, etwa bei einem langen Pfad ohne Leerzeichen, fällt sie auf den
 * harten Schnitt zurück. Das ist eine bewusste Näherung, keine Lücke: Ein
 * Bruchstück eines Pfades ist immer noch lesbarer als eine Zeile, die den
 * Hinweis überflutet.
 *
 * @param {string} zeile
 * @param {number} [breite]
 * @returns {string}
 */
function kuerze(zeile, breite = 78) {
	if (zeile.length <= breite) return zeile;
	const teil = zeile.slice(0, breite);
	const grenze = teil.lastIndexOf(' ');
	return (grenze > breite / 2 ? teil.slice(0, grenze) : teil) + ' …';
}

function fremdeLaeufe() {
	return falteLaeufe(leseProzesse(), eigeneKette());
}

function lastdurchschnitt() {
	try {
		return Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
	} catch {
		return 0;
	}
}

/**
 * Der Aufruf, getrennt vom Modul.
 *
 * Ohne diese Trennung liefe die Meldung bei jedem Import mit, also auch in
 * der Probe, die `falteLaeufe` prüft.
 */
function main() {
	const fremde = fremdeLaeufe();
	const last = lastdurchschnitt();
	if (fremde.length === 0 && last < LASTSCHWELLE) return;

	const zeilen = [''];
	if (fremde.length > 0) {
		const wort = fremde.length === 1 ? 'Lauf' : 'Läufe';
		zeilen.push(`  Es sieht aus, als liefe schon etwas Langes (${fremde.length} ${wort}):`);
		zeilen.push('');
		// Drei genügen, und mehr würden den Hinweis verdecken statt ihn zu
		// geben. Gezeigt werden dann die alphabetisch ersten, nicht die
		// auffälligsten; wer mehr wissen will, schaut mit `ps` nach.
		for (const zeile of fremde.slice(0, 3)) zeilen.push(`      ${zeile}`);
		if (fremde.length > 3) zeilen.push(`      und ${fremde.length - 3} weitere`);
		zeilen.push('');
	}
	zeilen.push(`  Lastdurchschnitt der letzten Minute: ${last.toFixed(2)}`);
	zeilen.push('');
	zeilen.push('  Zwei volle Läufe gleichzeitig messen die Last statt des Blocks. Der');
	zeilen.push('  Commit fällt dann an einer Zeitüberschreitung statt an einem Befund,');
	zeilen.push('  und das Ergebnis sagt nichts über die Änderung.');
	zeilen.push('');
	zeilen.push('  Dieser Hinweis hält nichts auf. Der Prüflauf startet gleich, ausser ein');
	zeilen.push('  anderer versammlung-Prüflauf läuft: Auf den wartet er (scripts/pruefen.sh).');
	zeilen.push('');
	console.error(zeilen.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
