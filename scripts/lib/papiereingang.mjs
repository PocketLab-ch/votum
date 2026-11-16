/**
 * Die Regel: Wer am Eingang die Anwesenheit schreibt, schreibt auch den
 * Papiervermerk.
 *
 * **Der Anlass, am 09.09.2026.** Die Handlung `einlassen` gibt es zweimal: in
 * `$lib/server/einlassaktionen` für beide Eingänge, und noch einmal auf der
 * Anwesenheitsseite, die sie überschreibt, um den Zugangscode gleich
 * mitauszugeben. Wer die Frage «digital oder von Hand» nur in eine der beiden
 * einbaut, bekommt einen Eingang, der fragt, und einen, der die Antwort
 * verliert. Auffallen würde das erst im Saal, wenn ein Telefon gesperrt ist,
 * das nicht gesperrt sein sollte, oder eines nicht, das es sein müsste.
 *
 * Dieselbe Klasse wie beim Papiervermerk in der Stimmsperre: Ein neuer Fall in
 * einer geteilten Sache trifft alle ihre Verbraucher, und wer danach einzeln
 * flickt, lässt die Klasse offen.
 *
 * **Was die Regel prüft.** In jeder Datei, die eine der Einlasshandlungen
 * schreibt, muss deren Rumpf `papiervermerkAusFormular` nennen. Nicht, wie er
 * sie benutzt: Das steht im Helfer, und ihn zu prüfen wäre der Versuch, das
 * Verhalten aus dem Quelltext zu lesen.
 *
 * **Was sie nicht kann.** Sie sieht nur Handlungen, die als
 * `name: async ({ … }) => { … }` in einem Objektliteral stehen — die Bauform,
 * die SvelteKit für `actions` verlangt und die dieses Verzeichnis überall
 * benutzt. Eine Handlung, die anderswo gebaut und nur zugewiesen wird, fiele
 * durch.
 */

/** Die Handlungen, die am Eingang eine Anwesenheit entstehen lassen. */
export const EINGANGSHANDLUNGEN = [
	'einlassen',
	'bestaetigen',
	'scannen',
	// **Auch der Saal-Zugang** (09.09.2026, im zweiten Code-Review gefunden).
	// `ordneSaalmeldungZu` ruft `bestaetigeAnwesenheit` und lässt damit jemanden
	// ein, der sich über die Wand gemeldet hat. Ohne diesen Namen hier galt eine
	// Papierpartei, die so hereinkam, still als digital — und der Wächter meldete
	// grün, weil er den Namen nicht kannte.
	'saalZuordnen',
	// **Und die einzelne Zeile am gemeinsamen Abend** (10.09.2026, im zweiten
	// Code-Review gefunden). `vonHand` erfasst eine Partei genauso wie die anderen
	// vier; sie stand nur nicht in dieser Liste, und der Wächter meldete grün.
	//
	// **`liste` steht mit Absicht nicht hier.** Das Häkchenformular hakt eine
	// Unterschriftenliste ab, oft ein Dutzend Zeilen auf einmal. Dort ein
	// Zwiegespräch je Partei zu führen ist kein Eingang mehr, sondern ein
	// Formular. Wer das ändert, ändert die Regel hier mit.
	//
	// **Die zweite Hälfte dieser Begründung war falsch** (10.09.2026, im
	// Code-Review gefunden). Hier stand, der Weg gehöre zur einfachen
	// Betriebsart, in der sich die Frage gar nicht stellt. Der Knopf
	// «Häkchenliste (einfache Führung)» steht aber in JEDER laufenden
	// Versammlung; nur seine Beschriftung sagt «einfach». Wer die Liste in einer
	// geführten Versammlung mit gestellter Frage benutzte, erfasste ein Dutzend
	// Parteien still als digital.
	//
	// Der Weg bleibt, wie er ist — die Maske sagt es ausdrücklich, samt der
	// Reihenfolge, die trägt: Der Papiervermerk entsteht vorher über die Zeile,
	// und die Liste überspringt, wer schon erfasst ist.
	//
	// **Und seit Migration 109 steht neben dem Satz eine Schranke.** Wer über die
	// Häkchenliste hereinkommt, bekommt keine Antwortzeile und landet damit in der
	// Nachtragsliste, bis jemand ihn fragt. Der Wächter hier lässt `liste` deshalb
	// weiterhin aus: Nicht zu fragen ist an dieser Stelle richtig, und der Fall
	// wird woanders aufgefangen statt hier erzwungen.
	'vonHand',
	// **Und der Sammeleinlass am gemeinsamen Abend** (10.09.2026, im Code-Review
	// gefunden). `einlass` lässt eine Person in ALLEN ihren Häusern zugleich ein,
	// über `lasseEin` statt `bestaetigeAnwesenheit` — deshalb trug er keinen der
	// bekannten Namen und stand nicht in dieser Liste. Der Code war richtig, die
	// Regel sah bloss nicht hin. Genau die Lücke, gegen die die Liste ist.
	'einlass'
];

/** Der Helfer, der den Vermerk aus dem Formular setzt. */
export const HELFER = 'papiervermerkAusFormular';

/**
 * Überspringt die Parameterliste ab der öffnenden runden Klammer.
 *
 * **Sie muss übersprungen werden, nicht mitgezählt.** Eine Handlung beginnt mit
 * `async ({ request, locals, params }) => {`, und die erste geschweifte Klammer
 * darin gehört der Destrukturierung. Wer den Rumpf dort beginnen lässt, liest
 * die Parameterliste als ganze Funktion: Sie enthält den Helfer nie, und der
 * Wächter meldete jede Handlung als lückenhaft, auch die vollständigen.
 * Gemessen beim ersten Lauf am 09.09.2026.
 *
 * @param {string} quelle
 * @param {number} klammerAuf
 * @returns {number}
 */
function nachParameterliste(quelle, klammerAuf) {
	let tiefe = 0;
	for (let i = klammerAuf; i < quelle.length; i += 1) {
		if (quelle[i] === '(') tiefe += 1;
		if (quelle[i] === ')') {
			tiefe -= 1;
			if (tiefe === 0) return i + 1;
		}
	}
	return -1;
}

/**
 * Schneidet den Rumpf ab der öffnenden Klammer heraus, über Klammerzählung.
 *
 * Zeichenketten und Kommentare werden übersprungen: Eine geschweifte Klammer in
 * einem Text oder in einem Kommentar würde die Zählung sonst verschieben, und
 * der Rumpf endete an der falschen Stelle.
 *
 * @param {string} quelle
 * @param {number} start
 * @returns {string}
 */
function rumpfAb(quelle, start) {
	let tiefe = 0;
	let i = start;
	while (i < quelle.length) {
		const c = quelle[i];
		const naechste = quelle[i + 1];
		if (c === '/' && naechste === '/') {
			i = quelle.indexOf('\n', i);
			if (i === -1) return quelle.slice(start);
			continue;
		}
		if (c === '/' && naechste === '*') {
			const ende = quelle.indexOf('*/', i + 2);
			i = ende === -1 ? quelle.length : ende + 2;
			continue;
		}
		if (c === "'" || c === '"' || c === '`') {
			i += 1;
			while (i < quelle.length && quelle[i] !== c) {
				if (quelle[i] === '\\') i += 1;
				i += 1;
			}
			i += 1;
			continue;
		}
		if (c === '{') tiefe += 1;
		if (c === '}') {
			tiefe -= 1;
			if (tiefe === 0) return quelle.slice(start, i + 1);
		}
		i += 1;
	}
	return quelle.slice(start);
}

/**
 * Streicht Kommentare und Zeichenketten aus einem Rumpf.
 *
 * **Sonst zählt eine Erwähnung als Aufruf** (09.09.2026, im zweiten
 * Code-Review gefunden). Wer den Aufruf entfernt und den Kommentar mit dem
 * Namen stehen lässt — genau die wahrscheinliche Bewegung, denn der Kommentar
 * erklärt ja, warum der Aufruf dort steht —, bliebe grün. Die erste Fassung
 * hielt das sogar als gewollt fest; das war eine Näherung, die den
 * wahrscheinlichen Rückschritt nicht deckt.
 *
 * @param {string} rumpf
 * @returns {string}
 */
function ohneBeiwerk(rumpf) {
	let raus = '';
	let i = 0;
	while (i < rumpf.length) {
		const c = rumpf[i];
		const naechste = rumpf[i + 1];
		if (c === '/' && naechste === '/') {
			const ende = rumpf.indexOf('\n', i);
			i = ende === -1 ? rumpf.length : ende;
			continue;
		}
		if (c === '/' && naechste === '*') {
			const ende = rumpf.indexOf('*/', i + 2);
			i = ende === -1 ? rumpf.length : ende + 2;
			continue;
		}
		if (c === "'" || c === '"' || c === '`') {
			i += 1;
			while (i < rumpf.length && rumpf[i] !== c) {
				if (rumpf[i] === '\\') i += 1;
				i += 1;
			}
			i += 1;
			continue;
		}
		raus += c;
		i += 1;
	}
	return raus;
}

/**
 * Alle Einlasshandlungen dieser Quelle, mit der Angabe, ob sie den Helfer
 * nennen.
 *
 * @param {string} quelle
 * @param {string} [datei]
 * @returns {{ datei: string, name: string, zeile: number, nenntHelfer: boolean }[]}
 */
export function eingaenge(quelle, datei = 'probe.ts') {
	const gefunden = [];
	for (const name of EINGANGSHANDLUNGEN) {
		const muster = new RegExp(`(^|[^\\w.])${name}\\s*:\\s*async\\s*\\(`, 'g');
		let treffer;
		while ((treffer = muster.exec(quelle)) !== null) {
			// `lastIndex` steht hinter der öffnenden runden Klammer; einen Schritt
			// zurück, damit die Zählung sie mitbekommt.
			const nachParam = nachParameterliste(quelle, muster.lastIndex - 1);
			if (nachParam === -1) continue;
			const klammer = quelle.indexOf('{', nachParam);
			if (klammer === -1) continue;
			const rumpf = rumpfAb(quelle, klammer);
			gefunden.push({
				datei,
				name,
				zeile: quelle.slice(0, treffer.index).split('\n').length,
				nenntHelfer: ohneBeiwerk(rumpf).includes(HELFER)
			});
		}
	}
	return gefunden;
}

/**
 * Nur die, denen der Vermerk fehlt.
 *
 * @param {string} quelle
 * @param {string} [datei]
 */
export function eingaengeOhneVermerk(quelle, datei = 'probe.ts') {
	return eingaenge(quelle, datei).filter((e) => !e.nenntHelfer);
}

/** Die Handlung, die den Vermerk wieder wegnimmt. */
export const RUECKNAHME = 'papierZuruecknehmen';

/** Das geteilte Bündel, das sie mitbringt, wenn eine Seite es ausbreitet. */
const BUENDEL = '...einlassaktionen';

/**
 * Die zweite Regel: Wer den Vermerk setzen kann, kann ihn auch zurücknehmen.
 *
 * **Der Anlass, am 10.09.2026.** Der gemeinsame Abend rief den Vermerkhelfer aus
 * drei Handlungen, hatte aber weder eine Sicht, die den Vermerk zeigte, noch
 * eine Handlung, die ihn wegnahm. Die erste Regel oben war grün: Der Vermerk
 * wurde ja gesetzt. Solange keine Maske die Frage stellte, blieb es folgenlos —
 * am Tag, an dem sie sie stellt, wäre ein Fehlgriff am Eingang unwiderruflich
 * gewesen, und die Partei hätte den Abend über nicht mitstimmen können.
 *
 * Das ist die Klasse «der Ersatz verliert die Gegenrichtung»: Wer eine Handlung
 * an eine zweite Stelle kopiert, kopiert die, die sie rückgängig macht, nicht
 * mit — sie steht ja woanders in der Datei.
 *
 * **Was sie prüft.** Nennt eine Einlasshandlung der Datei den Vermerkhelfer,
 * muss dieselbe Datei die Rücknahme erreichbar machen: entweder eine eigene
 * Handlung dieses Namens, oder das geteilte Bündel ausgebreitet, das sie
 * mitbringt.
 *
 * **Was sie nicht kann.** Sie liest Namen, nicht Wirkung. Eine Rücknahme, die
 * dasteht und nichts tut, fiele durch — dafür stehen die Durchstiche.
 *
 * @param {string} quelle
 * @param {string} [datei]
 * @returns {{ datei: string, setzt: string[] }[]}
 */
export function setztOhneRuecknahme(quelle, datei = 'probe.ts') {
	const setzt = eingaenge(quelle, datei)
		.filter((e) => e.nenntHelfer)
		.map((e) => e.name);
	if (setzt.length === 0) return [];
	// Über die entkleidete Quelle: Ein Kommentar, der die Rücknahme erwähnt, ist
	// keine Rücknahme. Dieselbe Lehre wie oben bei `ohneBeiwerk`.
	const nackt = ohneBeiwerk(quelle);
	if (nackt.includes(RUECKNAHME) || nackt.includes(BUENDEL)) return [];
	return [{ datei, setzt }];
}
