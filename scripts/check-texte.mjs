/**
 * Textwächter: Was auf dem Bildschirm steht, muss ein Laie verstehen.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Texte im allgemeinen kurz und
 * verständlich halten, damit es ein Laie problemlos versteht. Bitte prüfe alle
 * Texte. Es muss für einen durchschnittlichen Menschen verständlich sein.»
 *
 * Eine Durchsicht von Hand ist ein Zustand von gestern. Sie hält genau so
 * lange, bis jemand den nächsten langen Satz schreibt — und den schreibt man
 * nicht aus Nachlässigkeit, sondern weil man gerade tief im Gegenstand steckt
 * und das Fachwort das kürzere ist. Deshalb misst dieses Skript.
 *
 * ## Was es misst, und was ausdrücklich nicht
 *
 * **Satzlänge.** Über 180 Zeichen ist kein Satz mehr, sondern eine Aufzählung
 * ohne Liste. Gemessen wird nur sichtbarer Text, nicht Kommentar und nicht
 * Quelltext: Ein Kommentar darf lang sein, er erklärt einem Entwickler das
 * Warum.
 *
 * **Hausjargon.** Wörter, die nur wir benutzen — «Momentaufnahme»,
 * «Stimmberechtigtenstand», «Manifest». Sie stehen unten mit ihrem Ersatz.
 *
 * **Nicht gemessen: Rechtsbegriffe.** «Wertquote», «Traktandum», «Vollmacht»,
 * «Kopfstimme», «Ausstand», «Rückkommen» stehen so im ZGB oder im Reglement.
 * Sie durch Alltagswörter zu ersetzen wäre nicht einfacher, sondern falsch: Wer
 * im Protokoll «Antragsrücknahme» statt «Rückkommen» liest, findet den Artikel
 * nicht mehr. Ein Wächter, der sie anstriche, würde umgangen — und dann striche
 * er auch den Jargon nicht mehr an.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import {
	HOECHSTE_SATZLAENGE,
	MINDESTLAENGE,
	abschnitte,
	feldform,
	konstantenform,
	satzAus,
	satzfunktionen,
	saetze,
	seitenfehlerform
} from './lib/textform.mjs';
import { join, relative } from 'node:path';

/*
 * Die Wurzel wie bei den übrigen Wächtern: das erste Argument, das kein
 * Schalter ist; sonst das Arbeitsverzeichnis. Der Gegentest übergibt einen
 * Wegwerfbaum als Argument, der Aufruf aus `npm run pruefen` keins.
 */
const ERSTER = process.argv[2];
const WURZEL = ERSTER && !ERSTER.startsWith('--') ? ERSTER : process.cwd();
const SRC = join(WURZEL, 'src');

/** Hausjargon und sein Ersatz. Was hier steht, gehört nicht auf den Bildschirm. */
const JARGON = {
	Momentaufnahme: 'der festgehaltene Stand',
	Momentaufnahmen: 'die festgehaltenen Stände',
	Stimmberechtigtenstand: 'wer stimmberechtigt ist',
	Manifest: 'Inhaltsverzeichnis',
	Anzeigecode: 'Code für die Leinwand',
	'Tastatur-Emulation': 'ein Handscanner, der wie eine Tastatur tippt'
};

/*
 * **Jargon im Bestand, den die Satzfunktions-Bauform erst misst** (A6). Die
 * Ausnahme steht in einer Datei neben den langen Sätzen, nicht im Skript, und
 * deckt **nur das genannte Jargonwort in dem Satz mit dem genannten Anfang**:
 * Ein zweites Jargonwort im selben Satz und dasselbe Wort in einem neuen Satz
 * derselben Datei streicht der Wächter weiter an.
 */
const JARGON_AUSNAHMEN_DATEI = join(WURZEL, 'scripts', 'texte-jargon-ausnahmen.tsv');

/** Lädt die Jargon-Ausnahmen; ein Fehler darin ist rot, nicht still übersprungen. */
function ladeJargonAusnahmen() {
	let text;
	try {
		text = readFileSync(JARGON_AUSNAHMEN_DATEI, 'utf8');
	} catch {
		console.error(
			'\nscripts/texte-jargon-ausnahmen.tsv fehlt. Ohne die begründete Ausnahmeliste\n' +
				'wäre der Lauf am bekannten Bestands-Jargon dauerrot und würde abgeschaltet.\n'
		);
		process.exit(1);
	}
	const raus = [];
	for (const zeile of text.split('\n')) {
		const roh = zeile.trimEnd();
		if (!roh.trim() || roh.trim().startsWith('#')) continue;
		const teile = roh.split('\t');
		if (teile.length !== 4 || teile.some((t) => !t.trim())) {
			console.error(
				`\nscripts/texte-jargon-ausnahmen.tsv: Zeile mit ${teile.length} Spalten.\n` +
					'Erwartet: Datei<Tab>Satzanfang<Tab>Jargonwort<Tab>Grund.\n'
			);
			process.exit(1);
		}
		const [datei, anfang, wort, grund] = teile;
		if (anfang.length < 40) {
			console.error(
				`\nscripts/texte-jargon-ausnahmen.tsv: der Satzanfang zu «${datei}» ist nur ${anfang.length} Zeichen lang.\n` +
					'Ein kurzer Anfang deckt zu viel; mindestens 40 Zeichen.\n'
			);
			process.exit(1);
		}
		if (!Object.hasOwn(JARGON, wort)) {
			console.error(
				`\nscripts/texte-jargon-ausnahmen.tsv: «${wort}» steht nicht im Jargon-Verzeichnis.\n` +
					'Ein Eintrag, der kein Jargonwort nennt, deckt nichts und täuscht eine\n' +
					'begründete Ausnahme vor.\n'
			);
			process.exit(1);
		}
		if (raus.some((a) => a.datei === datei && a.wort === wort && a.anfang === anfang)) {
			console.error(`\nscripts/texte-jargon-ausnahmen.tsv: «${datei} ${wort}» steht zweimal drin.\n`);
			process.exit(1);
		}
		raus.push({ datei, anfang, wort, grund, benutzt: false });
	}
	return raus;
}

/*
 * **Was NICHT im Verzeichnis steht, und warum.**
 *
 * «Prüfsumme» stand hier einen halben Tag lang mit dem Ersatz «Fingerabdruck» —
 * und das war falsch. «Fingerabdruck» ist im Haus längst vergeben: Er bezeichnet
 * den Zertifikatsabdruck der Zeitstempelstelle (`tsa_fingerprints`,
 * `docs/dienste.md`, die Rechtsprüfung vom 22.08.). Auf der Siegelseite standen
 * danach zwei verschiedene Dinge unter demselben Wort, einen Klick auseinander.
 * Dasselbe Wort zweimal zu vergeben ist schlimmer als ein Fachwort.
 *
 * Und `docs/gestaltung.md` («Ein Wort für den Weg, eines für die Sache») verlangt
 * für solche Fälle ohnehin **beides nebeneinander**, nicht Ersatz: Klartext,
 * damit man versteht, was man tut; Fachbegriff, damit man ihn wiederfindet — in
 * `MANIFEST.txt`, im Protokoll und im Handbuch steht «Prüfsumme», und ein
 * Prüfweg, den man nicht wiederfindet, ist keiner.
 *
 * «Instanz», «Persistenz» und «idempotent» standen ebenfalls hier. Sie kommen in
 * keinem sichtbaren Text vor — dafür heisst «Instanz» im Anfechtungsrecht etwas
 * ganz Richtiges («erste Instanz», «Instanzenzug»). Ein Wächter, der das
 * anstriche, würde umgangen.
 */

/** Wie `dateien`, aber für den Quelltext. */
function quellen(verzeichnis) {
	const raus = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return raus;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...quellen(pfad));
		else if (pfad.endsWith('.ts')) raus.push(pfad);
	}
	return raus;
}

/**
 * Dateinamen weg, bevor nach Jargon gesucht wird.
 *
 * **Zweite Berichtigung derselben Art** (25.08.2026). In `.svelte` schützte der
 * `<code>`-Ausschluss die Dateinamen; in einer Meldung steht «manifest.json»
 * aber in gewöhnlichen Anführungszeichen — und der Wächter strich es an. Die
 * Datei heisst so: Wer das Paket entpackt, sucht genau diesen Namen. Ein
 * Wächter, der Richtiges anstreicht, wird umgangen.
 */
function ohneDateinamen(text) {
	return text.replace(/\S+\.(?:json|txt|csv|xlsx|pdf|zip|docx|odt|xml)\b/gi, ' ');
}

function dateien(verzeichnis) {
	const raus = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return raus;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
		else if (pfad.endsWith('.svelte')) raus.push(pfad);
	}
	return raus;
}

/**
 * Der sichtbare Text einer Seite.
 *
 * Skript, Stil und Kommentare fallen weg; geschweifte Ausdrücke werden zu einem
 * Platzhalter, weil ihr Inhalt Quelltext ist und keine Prosa. Übrig bleiben die
 * Textläufe zwischen den Marken.
 */
function sichtbar(quelle) {
	let s = quelle
		.replace(/<script[\s\S]*?<\/script>/g, '')
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		/*
		 * **`<code>` ist kein Fliesstext** (25.08.2026, beim ersten Lauf
		 * bemerkt). Der Wächter beanstandete `MANIFEST.txt` und `manifest.json`
		 * als Jargon — das sind aber Dateinamen im Paket, und die heissen so.
		 * Ein Wächter, der Wahres anstreicht, wird umgangen; dann streicht er
		 * auch das Falsche nicht mehr an.
		 */
		.replace(/<code[\s\S]*?<\/code>/g, ' ');
	const laeufe = [];
	for (const lauf of s.matchAll(/>([^<>]+)</g)) {
		const t = lauf[1].replace(/\{[^{}]*\}/g, '…');
		const sauber = t.replace(/\s+/g, ' ').trim();
		if (sauber && sauber !== '…') laeufe.push(sauber);
	}
	return laeufe;
}

/**
 * Die Meldungstexte des Servers — sie stehen dem Benutzer genauso vor Augen.
 *
 * **Der Wächter las zuerst nur `.svelte`** (25.08.2026, selbst bemerkt). Aber
 * «Diese Partei gehört nicht zum Stimmberechtigtenstand dieser Versammlung»
 * steht in `server/abstimmung.ts` — und wer sie liest, steht mitten in einer
 * Versammlung und braucht sie sofort.
 *
 * **Gesucht wird nach sechs Bauformen**, nicht nach einer. Hier stand bis zum
 * 22.09.2026 «nur nach `FachlicherFehler`» — das galt bis zum 25.08.2026 und
 * stand danach vier Wochen lang unmittelbar über einer Liste mit mehreren
 * Einträgen. Genau die Stelle, an der jemand nachschlägt, was der Wächter
 * liest.
 *
 * **Und die Zahl stand hier dreimal falsch**, zuletzt am 23.09.2026 in
 * demselben Block, der die vierte Bauform einzog und das Problem im
 * Kommentar darunter selbst benannte. Die fünfte, die exportierte
 * Textkonstante, kam am 20.10.2026 dazu, die sechste (Satzfunktion) in A6.
 * Wer eine ergänzt, zählt hier nach.
 *
 * Alles andere in einer `.ts`-Datei ist Quelltext — Spaltennamen, SQL,
 * Kennungen —, und ein Wächter, der das mitliest, meldet Unsinn und wird
 * deshalb übergangen.
 */
function meldungen(quelle) {
	/*
	 * **Sechs Bauformen, nicht eine.** Die Überschrift hat schon zweimal die
	 * falsche Zahl getragen: bis zum 22.09.2026 «vier», als es drei waren, dann
	 * «drei» — seit dem 23.09.2026 waren es vier, seit dem 20.10.2026 ist die
	 * exportierte Textkonstante die fünfte, und in A6 kam die Satzfunktion als
	 * sechste dazu. Wer eine ergänzt, zählt hier
	 * nach und trägt sie in `UNTERGRENZEN` ein; sonst bricht der Lauf beim
	 * ersten Treffer ab (Absicht, siehe dort).
	 *
	 * (25.08.2026, aus der Prüfung:) `FachlicherFehler`
	 * allein liess 33 sichtbare Sätze durchgehen — darunter den Protokollwortlaut,
	 * die Befundsätze der Prüfseite und «Für diese Versammlung besteht kein
	 * Stimmberechtigtenstand» aus drei PDF-Wegen. Alle vier sind syntaktisch
	 * eindeutig; alles Weitere in einer `.ts` ist Quelltext, und ein Wächter, der
	 * den mitliest, meldet Unsinn und wird übergangen.
	 */
	/*
	 * **Der Abschluss der Feldform war das Loch** (22.09.2026, beim Bauen des
	 * Abschnitts «DER ZEITSTEMPEL» gefunden). Hier stand
	 *
	 *     …(?:nachricht|grund|satz|text|beschreibung)\s*:\s*([\s\S]{0,400}?)[,}\n]
	 *
	 * und `[,}\n]` beendete die Fangstelle am **ersten Komma** — das steht in
	 * einer Meldung fast immer mitten im Text. Gefangen wurde dann
	 * `'Jede abgegebene Stimme mit Stimmpartei`, eine Zeichenkette ohne
	 * schliessendes Anführungszeichen. Die Stückzerlegung unten findet darin
	 * **null** Stücke, der gemessene Satz hat 0 Zeichen und fällt an der
	 * Untergrenze 20 durch.
	 *
	 * **Die Stelle wurde damit weder gemessen noch gezählt** (berichtigt im
	 * Code-Review, 22.09.2026 — hier stand «zählte sie als Meldung mit», und
	 * das war falsch: Gezählt wird erst, was `meldungen()` zurückgibt, und
	 * zurück kommen nur Sätze über der Mindestlänge).
	 *
	 * Gemessen: Die Feldform brachte vorher **156** Meldungen, heute **317**,
	 * also 161 mehr. Eine einzige davon trug einen Satz über der Grenze
	 * (`server/siegel.ts`, 182 Zeichen, und dieser Satz landet
	 * in `MANIFEST.txt`). Die Lücke war also breit und kostete wenig — bis
	 * jemand eine lange Meldung schreibt, die ein Komma enthält.
	 *
	 * **Jetzt wird der Wert als das gelesen, was er ist:** eine Kette aus
	 * Zeichenketten, mit `+` verbunden. Sie endet von selbst dort, wo der Wert
	 * endet. Kein Fenster von 400 Zeichen, kein Trennzeichen zu raten.
	 *
	 * **Warum nicht auch Ternäre** (gemessen, nicht entschieden): Eine Fassung,
	 * die ein beliebiges kurzes Verbindungsstück zwischen zwei Zeichenketten
	 * zulässt, fängt fünf Meldungen mehr und **sechs statt einer** über der
	 * Grenze — die fünf neuen beginnen mit einem Kommentarende, dann
	 * «function inhalt(text: string): string { return xml(t…», alle aus
	 * `domain/odt.ts`. Sie springt über Quelltext und
	 * Kommentare hinweg und misst den Quelltext statt der Meldung. Verloren
	 * geht dadurch genau eine Stelle, ein Ternär in `domain/namensvorschlag.ts`,
	 * und die ist selbst ein Unsinnsgebilde: Beide Zweige werden zu
	 * «…in einem Zeichenunterscheidet sich in…» aneinandergehängt.
	 */
	/*
	 * **Dieselbe Falle stand zwei Zeilen daneben** (Code-Review 22.09.2026).
	 * Die Seitenfehlerform lautete `\berror\(\s*\d{3}\s*,([\s\S]{0,400}?)\)`
	 * und hatte genau das Fenster und das geratene Trennzeichen, von denen der
	 * Absatz darüber sagt, sie seien weg. Eine **Klammer im Text** beendet die
	 * Fangstelle: gemessen an
	 * `routes/versammlungen/[id=kennung]/weisungsblatt.pdf/+server.ts`,
	 * «Geben Sie an, für welches Haus das Blatt gilt (?haus=…).» Auch sie wurde
	 * weder gemessen noch gezählt.
	 *
	 * Eine Fehlerklasse bleibt nur dort geschlossen, wo man beim Schliessen
	 * hingesehen hat; sie wandert nicht von selbst zum Nachbarn.
	 *
	 * **Die Absageform behält ihren faulen Abschluss**, und zwar wissentlich:
	 * `new FachlicherFehler(…)` nimmt mehrere Argumente, die Kette aus
	 * Zeichenketten trifft sie deshalb nicht. Gemessen am 22.09.2026 bricht
	 * dort **keine** Fangstelle in einer offenen Zeichenkette ab. Wer eine
	 * Absage schreibt, deren Text `);` enthält, verliert sie still — dann
	 * gehört auch diese Form umgebaut.
	 */
	const stellen = [
		...[...quelle.matchAll(/new FachlicherFehler\(([\s\S]*?)\);/g)].map((t) => ['absage', t]),
		...[...quelle.matchAll(feldform())].map((t) => ['feld', t]),
		...[...quelle.matchAll(seitenfehlerform())].map((t) => ['seitenfehler', t]),
		...[...quelle.matchAll(konstantenform())].map((t) => ['konstante', t])
	];

	/*
	 * **Die vierte Bauform steht getrennt**, weil sie nicht je Fundstelle
	 * misst, sondern je **Abschnitt**: `z.push` schiebt einen Satz über
	 * mehrere Zeilen in eine Liste, und erst zusammengehängt ist er der Satz,
	 * den ein Leser sieht. `abschnitte()` bildet diese Gruppen und endet an
	 * Überschriften, Trennlinien und an jeder anderen Anweisung dazwischen.
	 */
	const raus = abschnitte(quelle).map((satz) => ({ satz, bauform: 'aufbau' }));
	for (const [bauform, treffer] of stellen) {
		// Zerlegung und Platzhalter stehen in `textform.mjs`, weil die Probe
		// dieselbe Form messen muss wie der Wächter. Zwei Kopien derselben
		// Regel laufen auseinander, sobald eine geändert wird.
		const satz = satzAus(treffer[1]);
		if (satz.length > MINDESTLAENGE) raus.push({ satz, bauform });
	}
	// Die Satzfunktions-Bauform liest der Parser, nicht eine Regex (A6, zweite
	// Runde): Sie fängt auch Ternäre, einzelne `return '…'` und `text(…)`.
	for (const satz of satzfunktionen(quelle)) {
		// Eine Auszeichnungsschablone (odt, docx) ist kein Satz: kein Prosa-Fund.
		if (/<[A-Za-z]/.test(satz)) continue;
		if (satz.length > MINDESTLAENGE) raus.push({ satz, bauform: 'satzfunktion' });
	}
	return raus;
}

/**
 * Die begründeten Ausnahmen für lange Sätze im Bestand.
 *
 * **Warum eine Liste und nicht «Regelwerk ist ausgenommen».** Die neuen
 * Bauformen (exportierte Konstante, Abkürzungsschnitt) legen 62 Sätze über
 * 180 Zeichen frei, die vorher niemand gemessen hat: Regelwerkstexte und
 * Bestandsmeldungen. Sie in diesem Auftrag umzuformulieren hiesse,
 * Rechtstexte ohne neue Laien- und Fachprüfung zu ändern. Die Liste hält
 * deshalb je Satz den Anfang und die heutige Länge fest; was hinter dem
 * Anfang steht, prüft sie nicht wörtlich.
 *
 * **Sie deckt nur, was sie nennt.** Der Anfang muss den Satz beginnen, und der
 * Satz darf nicht länger werden als die Zahl in der Liste (Codeprüfung bei der
 * Übernahme, 20.10.2026: ohne die Zahl hätte ein Satz hinter seinen ersten
 * hundert Zeichen beliebig wachsen können). Eine Ausnahme, die keinen Satz
 * mehr trifft, macht den Lauf rot. Sonst würde aus
 * einer begründeten Ausnahme mit der Zeit eine stille Ausschaltung der
 * Satzregel, genau die Klasse, gegen die dieser Wächter steht.
 */
const AUSNAHMEN_DATEI = join(WURZEL, 'scripts', 'texte-ausnahmen.tsv');

function ladeAusnahmen() {
	let text;
	try {
		text = readFileSync(AUSNAHMEN_DATEI, 'utf8');
	} catch {
		console.error(
			'\nscripts/texte-ausnahmen.tsv fehlt. Ohne die begründete Ausnahmeliste\n' +
				'wäre der Lauf an den bekannten Bestandssätzen dauerrot und würde abgeschaltet.\n'
		);
		process.exit(1);
	}
	const raus = [];
	for (const zeile of text.split('\n')) {
		const roh = zeile.trimEnd();
		if (!roh.trim() || roh.trim().startsWith('#')) continue;
		const teile = roh.split('\t');
		if (teile.length !== 4 || teile.some((t) => !t.trim())) {
			console.error(
				`\nscripts/texte-ausnahmen.tsv: Zeile mit ${teile.length} Spalten.\n` +
					'Erwartet: Datei<Tab>Satzanfang<Tab>Zeichen<Tab>Grund.\n'
			);
			process.exit(1);
		}
		const [datei, anfang, zahl, grund] = teile;
		const zeichen = Number(zahl);
		if (!Number.isInteger(zeichen) || zeichen <= HOECHSTE_SATZLAENGE) {
			console.error(
				`\nscripts/texte-ausnahmen.tsv: die Länge «${zahl}» zu «${datei}» ist unlesbar.\n` +
					`Erwartet: die heutige Satzlänge, eine ganze Zahl über ${HOECHSTE_SATZLAENGE}.\n`
			);
			process.exit(1);
		}
		if (anfang.length < 40) {
			console.error(
				`\nscripts/texte-ausnahmen.tsv: der Satzanfang zu «${datei}» ist nur ${anfang.length} Zeichen lang.\n` +
					'Ein kurzer Anfang deckt zu viel; mindestens 40 Zeichen.\n'
			);
			process.exit(1);
		}
		for (const a of raus.filter((x) => x.datei === datei)) {
			if (a.anfang.startsWith(anfang) || anfang.startsWith(a.anfang)) {
				console.error(
					`\nscripts/texte-ausnahmen.tsv: zwei Ausnahmen zu «${datei}» beginnen gleich.\n` +
						'Eine davon deckt die andere mit; die längere ist überflüssig.\n'
				);
				process.exit(1);
			}
		}
		raus.push({ datei, anfang, zeichen, grund, benutzt: false });
	}
	if (raus.length === 0) {
		console.error('\nscripts/texte-ausnahmen.tsv ist leer.\n');
		process.exit(1);
	}
	return raus;
}

const lang = [];
/** Rohe Jargonfunde je Satz, erst nach dem Laden der Ausnahmen zugeordnet. */
const jargonRoh = [];

/** Die Jargonfunde eines Texts, je Satz, damit eine Ausnahme nur ihren Satz deckt. */
function jargonIn(text, kurz, art) {
	for (const [wort, ersatz] of Object.entries(JARGON)) {
		const muster = new RegExp(`\\b${wort}`, 'i');
		if (!muster.test(ohneDateinamen(text))) continue;
		const treffer = saetze(text).filter((satz) => muster.test(ohneDateinamen(satz)));
		for (const satz of treffer.length > 0 ? treffer : [text]) {
			jargonRoh.push({ kurz, wort, ersatz, art, satz });
		}
	}
}
let ausSeiten = 0;
/*
 * **Je Bauform gezählt, nicht in Summe** (22.09.2026, aus einem Befund von
 * website-5e an ihrem eigenen Zählwächter). Hier stand ein `ausMeldungen`
 * über alle Bauformen. Fiele eine davon aus — und genau das kann
 * passieren, wenn jemand an einem der Ausdrücke arbeitet —, bliebe die
 * Summe weit über der Schranke, und nichts würde rot.
 *
 * **Das ist keine Vermutung, sondern hier gerade passiert.** Die Feldform
 * lieferte vor ihrer Reparatur 156 statt 317 Meldungen. Die alte Schranke
 * stand bei 300 über der Summe — getragen wurde sie allein von den beiden
 * anderen Formen (576 + 119), und der Ausfall der halben Feldform blieb
 * unsichtbar.
 *
 * Die Schranke war schon einmal von einer Zahl auf zwei geteilt worden, weil
 * der Wächter sonst grün durchging, während der Seitenpfad tot war. Das
 * trennte die **Quellen**, nicht die Bauformen; dieselbe Lücke eine Ebene
 * tiefer.
 */
/*
 * **Eine Quelle für Namen und Schranken** (Code-Review, zweite Runde
 * 22.09.2026). Hier standen zwei handgeführte Objektliterale, 89 Zeilen
 * auseinander, plus die Etiketten in `meldungen()` als dritte Stelle — und
 * der Kommentar daneben behauptete, es gebe eine Funktion `zaehlerFuer()`,
 * die das ableitet. Die gab es nicht.
 *
 * **Die offene Richtung war die gefährliche:** Eine Bauform, die gezählt
 * wird, aber in den Schranken fehlt, läuft ungeschützt mit. Bricht sie weg,
 * meldet der Lauf «… seitenfehler 119, hinweis 0» und endet **grün** — mit
 * der Null gut sichtbar in der Erfolgszeile. Das ist wörtlich die Klasse,
 * gegen die diese Schranke gebaut ist, eine Ebene tiefer.
 *
 * Jetzt bestimmt `UNTERGRENZEN`, welche Bauformen es gibt; der Zähler wird
 * daraus abgeleitet. Wer eine weitere Form ergänzt und die Schranke vergisst,
 * bekommt beim ersten Treffer einen Abbruch statt eines stillen Zählers.
 *
 * **Die Zahlen sind gemessen, nicht geschätzt** (Abstand bewusst klein).
 * Gemessen wurden 3988 Textläufe aus Seiten sowie 576 Absagen, 317 Felder und
 * 119 Seitenfehler und 72 Aufbauabschnitte. Die fünfte Bauform kam am
 * 20.10.2026 dazu: 129 exportierte Textkonstanten gemessen, Schranke 100.
 * Die sechste (Satzfunktionen) kam am 29.10.2026 dazu (A6): 536 Lesarten aus
 * Rückgaben und Textzellen gemessen, Schranke 350.
 * Eine geschätzte Schranke ist in beide Richtungen wertlos:
 * zu tief merkt sie den Ausfall nicht, zu hoch ist die Probe rot, bevor sie
 * je etwas gefunden hat.
 */
const UNTERGRENZEN = {
	absage: 550,
	feld: 300,
	seitenfehler: 110,
	aufbau: 60,
	konstante: 100,
	satzfunktion: 350
};

/*
 * **Für die Aufbauform braucht es auch eine Obergrenze** (Code-Review
 * 23.09.2026). Bei den vier anderen Bauformen ist eine Fundstelle eine
 * Messeinheit: Fällt etwas aus, **sinkt** die Zahl, und die Untergrenze
 * greift. Bei `aufbau` ist es umgekehrt. Der Wert dieser Form liegt im
 * **Gruppieren** — erst zusammengehängt ist der Satz der Satz, den ein Leser
 * sieht. Fällt die Gruppierung aus und wird wieder je Zeile gemessen, steigt
 * die Zahl von 72 auf 102, und die Satzregel greift grundsätzlich nie mehr:
 * Zeilen auf Druckbreite sind nie über 180 Zeichen.
 *
 * Der Lauf meldete dann «102 Abschnitte, keine zu lang» und wäre grün,
 * während der 194-Zeichen-Satz unbemerkt zurückkäme. Genau die Blindheit, die
 * diese Bauform behebt, ist von einer Untergrenze allein nicht gedeckt.
 *
 * Gemessen: 72 gruppiert, 102 je Zeile. Die Grenze liegt dazwischen und näher
 * am Ist, damit auch eine halb ausgefallene Gruppierung auffällt.
 */
/*
 * **Neu gemessen am 14.10.2026** (H8, Teil B): 91 gruppiert, je Zeile 127
 * bis 134, je nachdem, ob Kommentare und Zeilen ohne Kleinbuchstaben
 * mitzählen (zwei Zählungen, eine davon in der Codeprüfung).
 * Gewachsen ist der Bestand, nicht die Zeilenzählung: neun Abschnitte bringt
 * `MANIFEST.txt` der Protokollfassung mit Nachtragssiegel
 * (`domain/nachtragssiegel.ts`), die übrigen kamen seit dem 23.09.2026 mit
 * Protokoll und Abendprotokoll. Die Grenze steht wieder zwischen beiden
 * Zahlen und näher am Ist. Gemessen mit derselben `abschnitte()` und, je
 * Zeile, mit jedem `z.push`-Treffer über der Mindestlänge. Bei HEAD vor dem
 * Block: 82 gruppiert, 112 je Zeile.
 */
const OBERGRENZEN = { aufbau: 100 };

/** Der Zähler, abgeleitet aus den Schranken — nicht daneben geführt. */
const ausMeldungen = Object.fromEntries(Object.keys(UNTERGRENZEN).map((form) => [form, 0]));

/**
 * Ein Etikett, das keine Bauform ist, wächst nicht still mit.
 *
 * `Object.hasOwn` statt `in` (Code-Review, zweite Runde): `'toString' in obj`
 * ist über die Prototypkette `true`. Ein Etikett mit diesem Namen wäre
 * durchgerutscht und hätte still in eine neue Eigenschaft gezählt.
 */
function zaehle(bauform) {
	if (!Object.hasOwn(ausMeldungen, bauform)) {
		console.error(
			`Textwächter: unbekannte Bauform «${bauform}». Wer eine ergänzt, trägt sie in ` +
				'UNTERGRENZEN ein — dort stehen die Namen, der Zähler wird daraus abgeleitet.'
		);
		process.exit(1);
	}
	ausMeldungen[bauform] += 1;
}

/*
 * **`src/routes` gehört dazu** (25.08.2026, aus der Prüfung). Der Wächter las
 * nur `src/lib` — und genau in `src/routes/.../+page.server.ts` stand ein Satz,
 * den das Ersetzen zerrissen hatte: «Vorher steht noch nicht fest, wer nicht
 * fest.» Er konnte ihn per Bauart nicht finden.
 */
for (const pfad of quellen(SRC)) {
	const kurz = relative(WURZEL, pfad);
	for (const { satz: meldung, bauform } of meldungen(readFileSync(pfad, 'utf8'))) {
		zaehle(bauform);
		/*
		 * **Je Satz, nicht je Meldung.** Eine gute Absage besteht aus drei kurzen
		 * Sätzen: was geschah, warum, und was jetzt zu tun ist («Eine Schranke der
		 * Datenbank ist keine Fehlermeldung», docs/gestaltung.md). Die als Ganzes
		 * zu messen hiesse, den Weg heraus wegzukürzen — und der ist das
		 * Wertvollste daran.
		 */
		for (const satz of saetze(meldung)) {
			if (satz.length > HOECHSTE_SATZLAENGE) {
				lang.push({ kurz, satz, bauform });
			}
		}
		jargonIn(meldung, kurz, 'Meldung: ');
	}
}

for (const pfad of dateien(SRC)) {
	const kurz = relative(WURZEL, pfad);
	for (const lauf of sichtbar(readFileSync(pfad, 'utf8'))) {
		ausSeiten += 1;
		for (const satz of saetze(lauf)) {
			if (satz.length > HOECHSTE_SATZLAENGE) {
				lang.push({ kurz, satz, bauform: 'seite' });
			}
		}
		jargonIn(lauf, kurz, '');
	}
}

/*
 * **Eine Untergrenze je Pfad und je Bauform** (25.08.2026, erweitert am
 * 22.09.2026). Eine gemeinsame Zahl liess sich erfüllen, während die eine
 * Hälfte tot war: Mit ausgeschaltetem Seitenpfad meldete der Wächter «110
 * Textläufe» und ging grün durch. Genau die Klasse «Wächter ohne Sichtprobe
 * ist immer grün».
 *
 * Wer eine Bauform absichtlich enger fasst und die Zahl dadurch unter die
 * Schranke drückt, misst neu und schreibt die neue Zahl zu `UNTERGRENZEN` —
 * mit dem Grund. Eine Schranke, die man senkt, ohne zu wissen warum, ist
 * keine.
 *
 * **Die Untergrenzen sind die Reissleine.** Der Gegentest fährt über einen
 * Wegwerfbaum und setzt `VERSAMMLUNG_REISSLEINE=aus`; dann greifen sie nicht.
 * Die Diagnose nennt **alle Zahlen je Bauform** und «neu messen und mit Grund
 * eintragen». Die Meldung von `mindestens` spricht von Dateien und passt hier
 * nicht, weil hier Meldungen je Bauform gezählt werden, keine Dateien.
 */
if (process.env.VERSAMMLUNG_REISSLEINE !== 'aus') {
	const zuWenig = Object.entries(UNTERGRENZEN).filter(
		// Nicht `<`: Bei `undefined` wäre das `false` und die Schranke stumm.
		([form, grenze]) => !(ausMeldungen[form] >= grenze)
	);
	const seitenWenig = ausSeiten < 2000;
	if (seitenWenig || zuWenig.length > 0) {
		const stand = Object.keys(UNTERGRENZEN)
			.map((form) => `${form}: ${ausMeldungen[form]}/${UNTERGRENZEN[form]}`)
			.join(', ');
		/*
		 * **Nur das Gerissene wird angestrichen** (Code-Review, zweite Runde).
		 * Vorher stand «zu wenig» hinter allen Zahlen, auch hinter denen, die
		 * stimmen — wer die Zeile las, suchte zuerst bei den Meldungen, obwohl
		 * womöglich nur der Seitenpfad gerissen war.
		 */
		const gerissen = [
			...(seitenWenig ? [`Textläufe aus Seiten (${ausSeiten}/2000)`] : []),
			...zuWenig.map(([form, grenze]) => `${form} (${ausMeldungen[form]}/${grenze})`)
		];
		console.error(
			`Textwächter: zu wenig bei ${gerissen.join(' und ')}. Ein Pfad oder eine Bauform wird ` +
				'nicht mehr gelesen; so geprüft wäre der Wächter wirkungslos.\n' +
				`Stand: ${ausSeiten} Textläufe aus Seiten, Meldungen ${stand}.\n` +
				'Wurde stattdessen absichtlich Code entfernt, ist die Schranke überholt: neu messen ' +
				'und die neue Zahl mit dem Grund in dieses Skript eintragen. Eine Schranke, die man ' +
				'senkt, ohne zu wissen warum, ist keine.'
		);
		process.exit(1);
	}
}

const zuViel = Object.entries(OBERGRENZEN).filter(
	([form, grenze]) => !(ausMeldungen[form] <= grenze)
);
if (zuViel.length > 0) {
	console.error(
		`Textwächter: ${zuViel.map(([f, g]) => `${f}: ${ausMeldungen[f]}/${g}`).join(', ')} — ` +
			'zu viele. Bei der Aufbauform heisst das, dass die Gruppierung nicht mehr greift: ' +
			'Gemessen werden dann einzelne Zeilen statt der Sätze, die ein Leser sieht, und die ' +
			'Satzregel läuft ins Leere.\n' +
			'Wurde die Gruppierung absichtlich geändert, ist die Grenze überholt: neu messen und ' +
			'die neue Zahl mit dem Grund in dieses Skript schreiben.'
	);
	process.exit(1);
}

const ausnahmen = ladeAusnahmen();
/*
 * Die Jargon-Ausnahmen werden **nach** den Untergrenzen geladen, wie die
 * Ausnahmen für lange Sätze: Über einem leeren Baum soll zuerst die
 * Untergrenze greifen, nicht die fehlende Ausnahmedatei. Die Funde sind roh
 * gesammelt und werden hier zugeordnet; eine Ausnahme deckt nur ihr Wort.
 */
const jargonAusnahmen = ladeJargonAusnahmen();
const jargon = [];
for (const f of jargonRoh) {
	const eintrag = jargonAusnahmen.find(
		(a) => a.datei === f.kurz && a.wort === f.wort && f.satz.startsWith(a.anfang)
	);
	if (eintrag) eintrag.benutzt = true;
	else jargon.push(`${f.kurz} — ${f.art}«${f.wort}» → «${f.ersatz}»`);
}

const langOffen = [];
for (const e of lang) {
	const a = ausnahmen.find(
		(x) => x.datei === e.kurz && e.satz.startsWith(x.anfang) && e.satz.length <= x.zeichen
	);
	if (a) {
		a.benutzt = true;
		continue;
	}
	const zeichen = e.bauform === 'seite' ? `${e.satz.length} Zeichen` : `Satz mit ${e.satz.length} Zeichen`;
	langOffen.push(`${e.kurz} — ${zeichen}: «${e.satz.slice(0, 90)}…»`);
}

const unbenutzt = ausnahmen.filter((a) => !a.benutzt);
if (unbenutzt.length > 0) {
	console.error(
		`\nTextwächter: ${unbenutzt.length} Ausnahme${unbenutzt.length === 1 ? '' : 'n'} in ` +
			'scripts/texte-ausnahmen.tsv deckt keinen langen Satz mehr:\n'
	);
	for (const a of unbenutzt) {
		console.error(`  · ${a.datei} — «${a.anfang.slice(0, 70)}…» (${a.grund})`);
	}
	console.error(
		'\nDer Satz wurde geändert, entfernt oder ist länger geworden als die Zahl in der\n' +
			'Liste. Die Ausnahme gehört gelöscht oder auf den\n' +
			'neuen Wortlaut gezogen; eine Liste, die mehr deckt als nötig, wird zur stillen\n' +
			'Ausschaltung der Satzregel.\n'
	);
	process.exit(1);
}

/*
 * Die Jargon-Ausnahmen werden **immer** geprüft, auch im Wegwerfbaum eines
 * Gegentests: Eine Ausnahme, die kein Jargonwort mehr deckt, wäre eine stille
 * Ausschaltung der Jargonregel, ob der Baum echt ist oder nicht.
 */
const unbenutzterJargon = jargonAusnahmen.filter((a) => !a.benutzt);
if (unbenutzterJargon.length > 0) {
	console.error(
		`\nTextwächter: ${unbenutzterJargon.length} Jargon-Ausnahme${
			unbenutzterJargon.length === 1 ? '' : 'n'
		} in scripts/texte-jargon-ausnahmen.tsv deckt kein Jargonwort mehr:\n`
	);
	for (const b of unbenutzterJargon) {
		console.error(`  · ${b.datei} — «${b.wort}» (${b.grund})`);
	}
	console.error(
		'\nDas Jargonwort wurde geändert oder entfernt. Die Ausnahme gehört gestrichen;\n' +
			'eine Liste, die mehr deckt als nötig, wird zur stillen Ausschaltung der\n' +
			'Jargonregel.\n'
	);
	process.exit(1);
}

const befunde = [...new Set([...langOffen, ...jargon])];
if (befunde.length > 0) {
	console.error(`Textwächter: ${befunde.length} Stellen, die ein Laie nicht lesen sollte.\n`);
	for (const b of befunde) console.error(`  · ${b}`);
	console.error(
		`\nSätze über ${HOECHSTE_SATZLAENGE} Zeichen sind keine Sätze mehr, sondern Aufzählungen ` +
			'ohne Liste. Und Hausjargon versteht nur, wer ihn selbst erfunden hat.\n' +
			'Rechtsbegriffe sind ausgenommen und bleiben — sie stehen so im ZGB.'
	);
	process.exit(1);
}

console.log(
	`Texte in Ordnung: ${ausSeiten} Textläufe und ` +
		`${Object.values(ausMeldungen).reduce((a, b) => a + b, 0)} Meldungen ` +
		`(${Object.entries(ausMeldungen).map(([f, n]) => `${f} ${n}`).join(', ')}), ` +
		'keine zu lang, kein Jargon.'
);
