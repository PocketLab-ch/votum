/**
 * Wächter: Personendaten-Sperrklinke.
 *
 * **Warum eine Sperrklinke und kein voller Wächter.**
 * `docs/veroeffentlichung-personendaten.md` plant den Wächter über echte
 * Personen und Gemeinschaften als letzten Schritt vor der Veröffentlichung,
 * nach der Bereinigung. Die Hausregel sagt dazu «zuletzt bereinigen, nicht
 * zuerst», weil die Zahlen wachsen, solange gearbeitet wird: Der Bestand ist
 * voller Nennungen, und ein voller Wächter wäre heute dauerrot. Die
 * Sperrklinke hält die Zahl der Nennungen je Sperrwort auf dem heutigen
 * Stand fest: Sie darf nur sinken, nie steigen. Nach der Bereinigung wird sie
 * mit Obergrenze null zum vollen Wächter.
 *
 * **Rot wird er in beide Richtungen.** Bei einer neuen Nennung, und auch
 * wenn die Zahl gesunken ist, solange die Obergrenze nicht mitgesenkt ist:
 * Eine Obergrenze über der Wirklichkeit bewacht nichts, neue Nennungen
 * blieben grün, bis sie den alten Stand erreichen. Wer bereinigt, senkt die
 * Obergrenze im selben Block.
 *
 * **Was er zählt.** Je Sperrwort die Nennungen im Arbeitsbaum, in Inhalten
 * **und** in Pfaden: Eine Datei wie `e2e/<…>.mjs` trägt den Namen nicht nur im
 * Text, sondern im Pfad, und genau dafür sieht man ihm von aussen nichts an.
 * Gelesen wird jeder Buchstabenlauf einer Zeile, camelCase zerlegt, NFC-normiert
 * und kleingeschrieben, dazu ohne End-s («…s»), und je zwei aufeinanderfolgende
 * Wörter als Paar in beiden Reihenfolgen. Ein Treffer zählt als Nennung; die
 * Meldung nennt Datei und Zeile, nie das Wort aus dem Inhalt (ein Pfad, der
 * selbst eines trägt, steht da, wie er heisst).
 *
 * **Wie die neue Stelle gefunden wird.** Die Zählung allein kann eine neue
 * Nennung nicht von den alten unterscheiden, und bei einem Wort mit über
 * tausend Nennungen hilft eine Liste aller Stellen nicht. Steht `git` zur
 * Verfügung (am Host), vergleicht der Wächter mit `HEAD`: Nennungen auf
 * Zeilen, die `git diff HEAD` als neu führt, und in Dateien, die `HEAD` nicht
 * kennt, stehen als «neu» mit Datei und Zeile da. Im Container gibt es kein
 * `git`; dort nennt die Meldung die Dateien mit ihrer Zahl und verweist auf
 * den Lauf am Host. Ein Tausch im selben Arbeitsstand (eine Nennung weg, eine
 * anderswo dazu) bleibt in der Zählung grün; die Sperrklinke hält die Menge,
 * nicht den Ort.
 *
 * **Wo die Sperrwörter stehen.** In `scripts/personendaten-sperre.tsv`, als
 * Prüfsumme (die ersten 24 Hex-Zeichen von SHA-256) mit der Obergrenze
 * daneben. Bewusst ohne Klarnamen und ohne Klasse: Eine Bezeichnung neben
 * dem Wort bestätigte ein erratenes Wort mit einem einzigen Versuch (Befund
 * der Sicherheitsprüfung vom 07.10.2026). Die Klarnamen stehen ausserhalb
 * des Repos, im Erhebungsbericht.
 *
 * **Die Prüfsumme verhindert das Lesen, nicht das Erraten.** Ungesalzenes
 * SHA-256 über kurze Namen lässt sich mit einer Namensliste in Sekunden
 * zurückrechnen. Die Sperrliste gehört deshalb nicht in den öffentlichen
 * Stand; der Schritt dafür steht in `docs/veroeffentlichung-personendaten.md`
 * (wie in immotool, dort als `export-ignore`). Die Obergrenze darf nur sinken, nie
 * steigen; das prüft der Review, nicht diese Datei. Neue Zeile:
 *
 *     node scripts/check-personendaten.mjs --pruefsumme <wort>
 *
 * Wortpaare als «wort1-wort2», kleingeschrieben.
 *
 * **Was er nicht liest.** Binärformate (.ttf, .woff, Bilder, PDFs und
 * Ähnliches) werden übersprungen und gezählt; Bilder und PDFs kann er nicht
 * lesen, das bleibt die «vollständige Erhebung» aus dem Abschluss-Task. Eine
 * Datei, die kein gültiges UTF-8 ist und auch kein bekanntes Binärformat, ist
 * ein Befund: Was er nicht liest, wäre grün und blind. Deshalb dekodiert er
 * streng; `readFileSync(…, 'utf8')` setzt Ersatzzeichen und wirft nie.
 *
 * **Seit der Bereinigung (27.10.2026) der volle Wächter.** Alle Obergrenzen
 * stehen auf null, und vier Prüfungen kamen dazu:
 *
 *   - **Teilwörter.** Jedes Stück ab `MIN_TEILWORT` Buchstaben eines
 *     längeren Buchstabenlaufs wird gegen alle Zeilen gehalten: Ein Ortsname
 *     steckt sonst unbemerkt in «…strasse». Bis A6 (29.10.2026) galt das nur
 *     für Zeilen mit einer Längenspalte, also für 3 von 33, und eine falsche
 *     Länge machte die Zeile still blind; die Spalte ist deshalb weg.
 *     Ein gewöhnliches Wort, das zufällig ein gesperrtes Stück enthält, steht
 *     als `<Prüfsumme des ganzen Worts><Tab>frei` in derselben Datei; damit
 *     gilt für die Freieinträge derselbe Ausschluss aus dem öffentlichen Stand.
 *     Ein Freieintrag, der nichts mehr deckt, ist rot.
 *   - **Ziffernfolgen.** Vierstellige Zahlen (Postleitzahl, Grundbuchblatt)
 *     werden wie Wörter gegen die Sperrliste gehalten, ohne Paare.
 *   - **E-Mail-Adressen** ausserhalb von `example.*`, den Endungen
 *     `.invalid`, `.local`, `.test` und der Testadresse `<name>.e2e@pocketlab.ch`
 *     sind ein Befund.
 *   - **Private IPv4-Adressen** (10/8, 172.16/12, 192.168/16) sind ein Befund,
 *     ausser `192.168.4.1`, der dokumentierten Vorgabe für das Notebook im
 *     Saal. `127.0.0.1`, `0.0.0.0` und die Dokumentationsnetze nach RFC 5737
 *     sind nicht privat und bleiben ohnehin frei.
 *
 *   Ausgenommen von E-Mail und Adresse sind die Pflichtangaben fremder
 *   Lizenzen und Pakete (`KONTAKT_FREI`). Telefonnummern und Strassen prüft er
 *   nicht: Im Bestand sind sie erkennbar erfunden, und ein Muster dafür träfe
 *   Hunderte erfundener Prüfadressen.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 *
 * **Bekannte Lücke: der reine Doku-Commit.** `scripts/git-hooks/pre-commit`
 * überspringt den Prüflauf, wenn nur `.md`-Dateien geändert sind. Eine neue
 * Nennung in `docs/` oder `README.md` geht so ungeprüft durch und fällt erst
 * beim nächsten Commit mit Code auf, als «schon committet» und bei einer
 * anderen Sitzung. Wer Doku schreibt, fährt den Wächter am Host selbst.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

const ARGE = process.argv.slice(2);
const ERHEBEN = ARGE.includes('--erheben');
const PRUEFSUMME = ARGE.indexOf('--pruefsumme');

/*
 * Die Wurzel wie bei allen Wächtern: das erste Argument, das kein Schalter
 * ist (und nicht das Wort hinter `--pruefsumme`), an welcher Stelle es auch
 * steht; sonst das Arbeitsverzeichnis. Die Reissleinen-Probe übergibt einen
 * Wegwerfbaum als Argument, der Aufruf aus `npm run pruefen` keins.
 */
const WURZEL =
	ARGE.find((a, i) => !a.startsWith('--') && !(PRUEFSUMME !== -1 && i === PRUEFSUMME + 1)) ??
	process.cwd();
const SPERRDATEI = join(WURZEL, 'scripts', 'personendaten-sperre.tsv');

if (PRUEFSUMME !== -1) {
	const wort = ARGE[PRUEFSUMME + 1];
	if (!wort) {
		console.error('--pruefsumme braucht ein Wort dahinter.');
		process.exit(2);
	}
	console.log(summe(wort));
	process.exit(0);
}

/**
 * **Verzeichnisse, die nicht ins Repo gehören** (gitignored oder
 * Laufzeitabfall) und deshalb nicht gelesen werden. Der Prüflauf läuft im
 * Container ohne git; die Ausschlüsse stehen deshalb hier als Liste und nicht
 * in `.gitignore`-Lesen. Ein Dateiname, der mit `.env` beginnt, trägt
 * Geheimnisse und wird ebenfalls übersprungen, ausser `.env.example`, die
 * ins Repo gehört.
 *
 * Wie in `.gitignore`: `AUSGESCHLOSSEN` gilt auf jeder Tiefe, `NUR_AM_STAMM`
 * nur direkt unter der Wurzel (`/build`, `/dist`, `/.svelte-kit`). Ein
 * künftiges `src/lib/build/` wird also gelesen.
 */
const AUSGESCHLOSSEN = new Set(['.git', 'daten', 'node_modules', 'zugang', 'secrets']);
const NUR_AM_STAMM = new Set(['.svelte-kit', 'build', 'dist', 'certs']);

/** Binärformate, die der Wächter nicht lesen kann und deshalb überspringt. */
const BINAER = /\.(ttf|woff2?|otf|eot|png|jpe?g|gif|webp|bmp|ico|svgz|pdf|zip|jar|xlsx?|docx?|odt|ods|odp)$/i;

/** Buchstabenlauf: lateinische Buchstaben samt Umlauten und ß. */
const WORT = /[A-Za-zÀ-ÖØ-öø-ÿß]+/g;

/** Grenze zwischen zwei Wörtern in camelCase: `alleUnverknuepft`. */
const KAMEL = /(?<=[a-zß-öø-ÿ])(?=[A-ZÀ-ÖØ-Þ])/;

/**
 * Die kürzeste Länge, ab der ein Stück eines Worts als Teilwort zählt. Bei 4
 * träfen gesperrte Kurzformen zu viele gewöhnliche Wörter; gemessen am
 * 29.10.2026 bringt 5 am ganzen Baum einen einzigen Fehltreffer (ein Wort,
 * dreimal), der als Freieintrag steht.
 */
const MIN_TEILWORT = 5;

/** Prüfsummen ganzer Wörter, die trotz eines gesperrten Stücks frei sind → benutzt? */
const FREI = new Map();

/** Vierstellige Ziffernfolge, nicht Teil einer längeren. */
const ZIFFERN = /(?<!\d)\d{4}(?!\d)/g;

/**
 * Pflichtangaben fremder Lizenzen und Pakete: Dort stehen Adressen von
 * Autoren, die bleiben müssen.
 */
const KONTAKT_FREI = new Set(['LICENSE', 'src/lib/server/pdf/schriften/LIZENZ.txt', 'package-lock.json']);

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const IPV4 = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\.?\d)/g;
const IP_FREI = new Set(['192.168.4.1']);

/**
 * Die Testadresse der Prüfläufe: `<name>.e2e@pocketlab.ch` (Vorgabe des
 * Auftraggebers vom 14.11.2026, wie `TESTADRESSE` im Wächter von immotool).
 * Nur genau diese Form, am Ende verankert; `.e2e` ist Pflicht, eine andere
 * Adresse auf der Hausdomäne oder eine andere Hausdomäne (`pocketmail.ch`)
 * bleibt ein Fund, denn unter ihnen gibt es echte Adressen. In einer Vorlage
 * (`${name}.e2e@…`) sieht `EMAIL` nur das Bruchstück ab dem Punkt; es zählt mit.
 */
const TESTADRESSE = /^[a-z0-9._%+-]*\.e2e@pocketlab\.ch$/i;

/** Ob eine Domäne erkennbar keine echte ist. */
function domaeneFrei(domaene) {
	const teile = domaene.toLowerCase().split('.');
	return teile.includes('example') || ['invalid', 'local', 'test'].includes(teile.at(-1));
}

/** Ob eine IPv4-Adresse in einem privaten Netz liegt (RFC 1918). */
function privat(a, b) {
	return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Die Kontaktbefunde einer Zeile: E-Mail-Adressen und private Adressen. */
function kontaktInZeile(zeile, pfad, nr, befunde) {
	for (const m of zeile.matchAll(EMAIL)) {
		if (!domaeneFrei(m[1]) && !TESTADRESSE.test(m[0])) befunde.push({ pfad, zeile: nr, art: 'E-Mail-Adresse' });
	}
	for (const m of zeile.matchAll(IPV4)) {
		const [a, b, c, d] = m.slice(1, 5).map(Number);
		if ([a, b, c, d].some((x) => x > 255)) continue;
		if (privat(a, b) && !IP_FREI.has(m[0])) befunde.push({ pfad, zeile: nr, art: 'private IPv4-Adresse' });
	}
}

function summe(wort) {
	return createHash('sha256')
		.update(wort.normalize('NFC').toLowerCase())
		.digest('hex')
		.slice(0, 24);
}

/** Lädt die Sperrliste; ein Fehler darin ist rot, nicht still übersprungen. */
function ladeSperre() {
	let text;
	try {
		text = readFileSync(SPERRDATEI, 'utf8');
	} catch {
		console.error(
			'\nscripts/personendaten-sperre.tsv fehlt.\nOhne Sperrliste wäre der Wächter grün und blind. Die Datei steht\n' +
				'nur im Repo, nicht in einer Auslieferung.\n'
		);
		process.exit(1);
	}
	const sperre = new Map();
	for (const zeile of text.split('\n')) {
		const roh = zeile.trim();
		if (!roh || roh.startsWith('#')) continue;
		const teile = roh.split('\t');
		const pruefsumme = teile[0];
		const frei = teile[1] === 'frei';
		const obergrenze = Number(teile[1]);
		if (!/^[0-9a-f]{24}$/.test(pruefsumme) || teile.length !== 2 || (!frei && !Number.isInteger(obergrenze))) {
			console.error(
				`\nscripts/personendaten-sperre.tsv: Zeile mit ${teile.length} Spalten oder\n` +
					`unlesbarer Prüfsumme/Obergrenze. Erwartet: Prüfsumme<Tab>Obergrenze\n` +
					`oder Prüfsumme<Tab>frei. Eine Längenspalte gibt es seit A6 nicht mehr:\n` +
					`Teilwörter gelten für jede Zeile.\n`
			);
			process.exit(1);
		}
		if (sperre.has(pruefsumme) || FREI.has(pruefsumme)) {
			console.error(
				`\nscripts/personendaten-sperre.tsv: die Prüfsumme ${pruefsumme} steht zweimal drin.\n`
			);
			process.exit(1);
		}
		if (frei) FREI.set(pruefsumme, false);
		else sperre.set(pruefsumme, obergrenze);
	}
	if (sperre.size === 0) {
		console.error(
			'\nscripts/personendaten-sperre.tsv ist leer.\nOhne Sperrliste wäre der Wächter grün und blind.\n'
		);
		process.exit(1);
	}
	return sperre;
}

/** Ob ein Pfad ausserhalb der Prüfmenge liegt. */
function ausgeschlossen(rel) {
	const name = rel.split('/').pop();
	if (name.startsWith('.env') && name !== '.env.example') return true;
	if (name.endsWith('.log') || name.endsWith('.key')) return true;
	if (
		name.startsWith('.') &&
		!['.dockerignore', '.dependency-cruiser.cjs', '.env.example', '.gitignore', '.npmrc'].includes(name)
	) {
		/*
		 * Versteckte Dateien, die bekannt ins Repo gehören, stehen in der Liste;
		 * alles andere Versteckte ist Werkzeug- oder Geheimnisabfall und wird
		 * übersprungen.
		 */
		return true;
	}
	return false;
}

function dateien(ordner, treffer = []) {
	let eintraege;
	try {
		eintraege = readdirSync(ordner);
	} catch {
		return treffer;
	}
	for (const eintrag of eintraege) {
		const pfad = join(ordner, eintrag);
		const rel = relative(WURZEL, pfad);
		if (rel === join('static', 'handbuch')) continue;
		let istOrdner;
		try {
			istOrdner = statSync(pfad).isDirectory();
		} catch {
			continue;
		}
		if (istOrdner) {
			if (AUSGESCHLOSSEN.has(eintrag)) continue;
			if (ordner === WURZEL && NUR_AM_STAMM.has(eintrag)) continue;
			dateien(pfad, treffer);
		} else if (!ausgeschlossen(rel)) {
			treffer.push(pfad);
		}
	}
	return treffer;
}

/**
 * Die Wörter einer Zeile, wie immotool sie zerlegt: NFC-normiert, als
 * Buchstabenläufe, camelCase getrennt. Die Paarprüfung läuft daneben, weil sie
 * die Reihenfolge der Wörter braucht.
 */
function woerter(zeile) {
	const normiert = zeile.normalize('NFC');
	const gefunden = [];
	for (const m of normiert.matchAll(WORT)) {
		for (const teil of m[0].split(KAMEL)) gefunden.push(teil);
	}
	return gefunden;
}

/** Die Nennungen der Pfadsegmente, ohne Paare: ein Pfad nennt einzelne Wörter. */
function fundeImPfad(rel, sperre, treffer) {
	for (const segment of rel.split(/[\\/]/)) {
		/*
		 * Ziffernfolgen auch im Pfad (Pendenzen 27.10.2026): Eine Postleitzahl
		 * oder ein Grundbuchblatt kann im Dateinamen stehen, nicht nur im Inhalt.
		 */
		for (const m of segment.matchAll(ZIFFERN)) {
			if (sperre.has(summe(m[0]))) treffer.push({ pfad: rel, zeile: null, pruefsumme: summe(m[0]) });
		}
		for (const w of woerter(segment)) {
			melde(w, sperre, treffer, rel, null);
		}
	}
}

/** Je Wort die Prüfsummen, die es trifft; ein Wort kehrt tausendfach wieder. */
const JE_WORT = new Map();

/**
 * Die Prüfsummen, die ein Wort trifft: als ganzes Wort, ohne End-s und als
 * Teilwort ab `MIN_TEILWORT` Buchstaben, ausser das ganze Wort ist frei. Ein
 * Treffer, den das ganze Wort schon trägt, zählt nicht ein zweites Mal.
 */
function trifft(klein, sperre) {
	if (JE_WORT.has(klein)) return JE_WORT.get(klein);
	const hits = [];
	if (sperre.has(summe(klein))) hits.push(summe(klein));
	if (klein.length > 3 && klein.endsWith('s') && sperre.has(summe(klein.slice(0, -1)))) {
		hits.push(summe(klein.slice(0, -1)));
	}
	const gesehen = new Set(hits);
	const teilwoerter = [];
	for (let laenge = MIN_TEILWORT; laenge < klein.length; laenge += 1) {
		for (let i = 0; i + laenge <= klein.length; i += 1) {
			const s = summe(klein.slice(i, i + laenge));
			if (sperre.has(s) && !gesehen.has(s)) {
				teilwoerter.push(s);
				gesehen.add(s);
			}
		}
	}
	if (teilwoerter.length > 0) {
		const ganz = summe(klein);
		if (FREI.has(ganz)) FREI.set(ganz, true);
		else hits.push(...teilwoerter);
	}
	JE_WORT.set(klein, hits);
	return hits;
}

/** Ein Wort gegen die Sperrliste halten, samt End-s-Regel und Teilwort. */
function melde(wort, sperre, treffer, pfad, zeile) {
	for (const pruefsumme of trifft(wort.toLowerCase(), sperre)) {
		treffer.push({ pfad, zeile, pruefsumme });
	}
}

function fundeInZeile(zeile, sperre, treffer, pfad, nr) {
	for (const m of zeile.matchAll(ZIFFERN)) {
		if (sperre.has(summe(m[0]))) treffer.push({ pfad, zeile: nr, pruefsumme: summe(m[0]) });
	}
	const liste = woerter(zeile);
	for (let i = 0; i < liste.length; i += 1) {
		const w = liste[i];
		melde(w, sperre, treffer, pfad, nr);
		if (i + 1 < liste.length) {
			// Beide Reihenfolgen, für Vor- und Nachname in jeder Schreibweise.
			const paar = `${w}-${liste[i + 1]}`.toLowerCase();
			if (sperre.has(summe(paar))) {
				treffer.push({ pfad, zeile: nr, pruefsumme: summe(paar) });
			}
			const gedreht = `${liste[i + 1]}-${w}`.toLowerCase();
			if (sperre.has(summe(gedreht))) {
				treffer.push({ pfad, zeile: nr, pruefsumme: summe(gedreht) });
			}
		}
	}
}

/*
 * Die Reissleine je Quelle und **vor** der Sperrliste: Über einem leeren Baum
 * fehlt auch die Sperrliste, und ihre Absage hätte die Reissleinen-Probe grün
 * gemacht, ohne dass `mindestens()` je lief. Je Quelle, weil eine Summe
 * aufgefüllt wird, wenn eine Quelle wegfällt (`scripts/lib/pruefmenge.mjs`).
 * Die Grenzen liegen bei rund siebzig Prozent des Bestands vom 14.10.2026.
 */
const gelesene = dateien(WURZEL);
const unter = (ordner) => gelesene.filter((p) => relative(WURZEL, p).startsWith(`${ordner}/`));
mindestens(unter('src'), 360, 'Dateien unter src/');
mindestens(unter('tests'), 200, 'Dateien unter tests/');
mindestens(unter('migrations'), 110, 'Dateien unter migrations/');
mindestens(unter('docs'), 50, 'Dateien unter docs/');

const sperre = ladeSperre();
const treffer = [];
const kontakt = [];
let zeilenZahl = 0;
let binaer = 0;
const STRENG = new TextDecoder('utf-8', { fatal: true });

for (const pfad of gelesene) {
	const rel = relative(WURZEL, pfad);
	fundeImPfad(rel, sperre, treffer);
	if (BINAER.test(rel)) {
		binaer += 1;
		continue;
	}
	let text;
	try {
		text = STRENG.decode(readFileSync(pfad));
	} catch {
		console.error(
			`\n${rel} ist nicht als UTF-8 lesbar und kein bekanntes Binärformat.\n` +
				'Was der Wächter nicht liest, wäre grün und blind. Die Datei als Text\n' +
				'speichern oder als Binärformat einordnen.\n'
		);
		process.exit(1);
	}
	const kontaktPruefen = !KONTAKT_FREI.has(rel.split('\\').join('/'));
	text.split('\n').forEach((zeile, i) => {
		zeilenZahl += 1;
		fundeInZeile(zeile, sperre, treffer, rel, i + 1);
		if (kontaktPruefen) kontaktInZeile(zeile, rel, i + 1, kontakt);
	});
}

/*
 * Ein Freieintrag, der kein Wort mit gesperrtem Stück mehr deckt, ist rot:
 * Sonst wüchse die Liste still, und ein später eingetragenes echtes Wort mit
 * derselben Prüfsumme bliebe frei.
 */
const unbenutzteFrei = [...FREI].filter(([, benutzt]) => !benutzt).map(([s]) => s);
if (unbenutzteFrei.length > 0) {
	console.error(
		`\nscripts/personendaten-sperre.tsv: ${unbenutzteFrei.length} Freieintr${
			unbenutzteFrei.length === 1 ? 'ag deckt' : 'äge decken'
		} kein Wort mit gesperrtem Stück mehr:\n`
	);
	for (const s of unbenutzteFrei) console.error(`  · ${s}`);
	console.error('\nDie Zeile gehört gestrichen.\n');
	process.exit(1);
}

/** Die Nennungen je Prüfsumme, in der Reihenfolge der Sperrliste. */
function zaehlen() {
	const zahl = new Map([...sperre.keys()].map((s) => [s, 0]));
	for (const t of treffer) zahl.set(t.pruefsumme, (zahl.get(t.pruefsumme) ?? 0) + 1);
	return zahl;
}

/**
 * Was gegenüber `HEAD` neu ist: die Dateien, die `HEAD` nicht kennt, und die
 * Zeilen, die `git diff HEAD` hinzufügt. `null`, wenn kein `git` da ist
 * (Container) oder die Wurzel nicht die Wurzel eines Repos ist (Wegwerfbaum,
 * Unterordner): Dann stimmten die Pfade nicht überein, und eine Markierung
 * «neu» wäre geraten.
 *
 * Der Diff wird **je Datei** erfragt, nicht als Ganzes geparst: Aus den
 * Dateiköpfen eines Gesamtdiffs den Pfad zu lesen, scheitert an Leerzeichen
 * (git hängt einen Tab an), an Anführungszeichen (git setzt den Pfad dann in
 * C-Quotes) und an einer neuen Inhaltszeile, die mit «++ » beginnt (sie sieht
 * aus wie ein Dateikopf). Je Datei steht der Pfad fest, gelesen werden nur die
 * `@@`-Köpfe, und eine Inhaltszeile beginnt nie mit `@@`. `--literal-pathspecs`,
 * weil Routenpfade wie `[id=kennung]` sonst als Muster gelten.
 */
function gegenHead() {
	const opt = {
		cwd: WURZEL,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
		maxBuffer: 512 * 1024 * 1024
	};
	try {
		const stamm = execFileSync('git', ['rev-parse', '--show-toplevel'], opt).trim();
		if (relative(stamm, WURZEL) !== '') return null;
		const bekannt = new Set(
			execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', 'HEAD'], opt).split('\0').filter(Boolean)
		);
		const zeilenJeDatei = new Map();
		const neueZeilen = (pfad) => {
			if (!zeilenJeDatei.has(pfad)) {
				const diff = execFileSync(
					'git',
					['--literal-pathspecs', 'diff', 'HEAD', '-U0', '--no-color', '--no-ext-diff', '--', pfad],
					opt
				);
				const zeilen = new Set();
				for (const z of diff.split('\n')) {
					const kopf = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(z);
					if (!kopf) continue;
					const anfang = Number(kopf[1]);
					const anzahl = kopf[2] === undefined ? 1 : Number(kopf[2]);
					for (let i = 0; i < anzahl; i += 1) zeilen.add(anfang + i);
				}
				zeilenJeDatei.set(pfad, zeilen);
			}
			return zeilenJeDatei.get(pfad);
		};
		return (t) => {
			if (!bekannt.has(t.pfad)) return true;
			if (t.zeile === null) return false;
			try {
				return neueZeilen(t.pfad).has(t.zeile);
			} catch {
				// Unbeantwortet ist nicht neu; der Überschuss bleibt dann
				// unerklärt, und die Aufstellung je Datei folgt.
				return false;
			}
		};
	} catch {
		return null;
	}
}

const stelle = (t) => `${t.pfad}${t.zeile === null ? ' (Pfad)' : `:${t.zeile}`}`;

if (ERHEBEN) {
	for (const [pruefsumme, anzahl] of zaehlen()) {
		console.log(`${pruefsumme}\t${anzahl}`);
	}
	console.error(
		`--erheben: ${gelesene.length} Dateien, ${zeilenZahl} Zeilen, ${binaer} Binärdateien übersprungen, ` +
			`${kontakt.length} Kontaktbefunde.`
	);
	process.exit(0);
}

/*
 * Kontaktbefunde haben keine Obergrenze: Jede Adresse ist einer. Die Meldung
 * nennt Datei, Zeile und Art, nicht die Adresse selbst.
 */
if (kontakt.length > 0) {
	console.error(`\nPersonendaten-Wächter: ${kontakt.length} Kontaktangabe${kontakt.length === 1 ? '' : 'n'}:\n`);
	for (const k of kontakt) console.error(`  · ${k.pfad}:${k.zeile} (${k.art})`);
	console.error(
		'\nE-Mail-Adressen auf example.ch, example.com oder einer Endung .invalid,\n' +
			'.local, .test schreiben; interne Adressen durch eine Rolle oder eine Adresse\n' +
			'aus RFC 5737 (192.0.2.x, 198.51.100.x, 203.0.113.x) ersetzen.\n'
	);
}

const zahl = zaehlen();
const ueber = [...sperre]
	.map(([pruefsumme, obergrenze]) => ({ pruefsumme, obergrenze, anzahl: zahl.get(pruefsumme) }))
	.filter((e) => e.anzahl > e.obergrenze);
const gesunken = [...sperre]
	.map(([pruefsumme, obergrenze]) => ({ pruefsumme, obergrenze, anzahl: zahl.get(pruefsumme) }))
	.filter((e) => e.anzahl < e.obergrenze);

if (ueber.length > 0 || gesunken.length > 0) {
	const istNeu = ueber.length > 0 ? gegenHead() : null;
	if (ueber.length > 0) {
		console.error(
			`\nPersonendaten-Sperrklinke: ${ueber.length} Sperrwort${
				ueber.length === 1 ? '' : 'e'
			} über der Obergrenze:\n`
		);
		for (const e of ueber) {
			console.error(`  · Prüfsumme ${e.pruefsumme}: ${e.anzahl} Nennungen, Obergrenze ${e.obergrenze}`);
			const eigene = treffer
				.filter((x) => x.pruefsumme === e.pruefsumme)
				.sort((a, b) => a.pfad.localeCompare(b.pfad) || (a.zeile ?? 0) - (b.zeile ?? 0));
			const neue = istNeu ? eigene.filter(istNeu) : [];
			if (neue.length > 0) {
				console.error('    neu gegenüber HEAD:');
				for (const t of neue) console.error(`      ${stelle(t)}`);
				if (neue.length >= e.anzahl - e.obergrenze) continue;
			}
			/*
			 * Ohne `git`, die Nennung ist schon committet, oder die Liste «neu»
			 * erklärt den Überschuss nicht ganz: Die Zählung kann die neue Stelle
			 * nicht von den alten trennen. Eine Liste aller Stellen wäre bei über
			 * tausend Nennungen keine Antwort; je Datei mit ihrer Zahl lässt sie
			 * sich gegen den Diff halten.
			 */
			console.error(
				!istNeu
					? '    ohne git keine Unterscheidung neu/alt, je Datei:'
					: neue.length > 0
						? '    die Liste «neu» erklärt den Überschuss nicht ganz, je Datei:'
						: '    keine neue Stelle gegenüber HEAD (schon committet?), je Datei:'
			);
			const jeDatei = new Map();
			for (const t of eigene) jeDatei.set(t.pfad, (jeDatei.get(t.pfad) ?? 0) + 1);
			for (const [pfad, n] of jeDatei) console.error(`      ${pfad} (${n})`);
		}
		console.error(
			'\nDie neue Nennung durch eine Rolle oder einen erkennbar erfundenen Namen\n' +
				'ersetzen. Die Obergrenze in scripts/personendaten-sperre.tsv erhöhen darf\n' +
				'niemand.\n' +
				(istNeu
					? ''
					: 'Ohne git (im Container) nennt die neue Stelle mit Datei und Zeile erst\n' +
						'der Lauf am Host: node scripts/check-personendaten.mjs\n')
		);
	}
	if (gesunken.length > 0) {
		console.error(
			`\nPersonendaten-Sperrklinke: ${gesunken.length} Obergrenze${
				gesunken.length === 1 ? '' : 'n'
			} überholt, die Zahl ist gesunken:\n`
		);
		for (const e of gesunken) {
			console.error(`  · Prüfsumme ${e.pruefsumme}: ${e.anzahl} Nennungen, Obergrenze ${e.obergrenze}`);
		}
		console.error(
			'\nWer bereinigt hat, senkt die Obergrenze im selben Block auf den neuen Stand.\n' +
				'Eine Obergrenze, die über der Wirklichkeit liegt, bewacht nichts: Neue\n' +
				'Nennungen blieben grün, bis sie den alten Stand erreichen.\n'
		);
	}
	process.exit(1);
}
if (kontakt.length > 0) process.exit(1);

console.log(
	`Personendaten-Wächter in Ordnung: ${sperre.size} Sperrwörter genau auf der ` +
		`Obergrenze (${gelesene.length} Dateien, ${zeilenZahl} Zeilen gelesen, ` +
		`${binaer} Binärdateien übersprungen).`
);
