/**
 * Themenfarbenwächter.
 *
 * **Der Anlass, am 01.09.2026** (Auftraggeber): «Bei der KI-Korrektur ist beim
 * Vorher-Text helle Schrift auf hellem Hintergrund. So kann man den Text nicht
 * lesen.»
 *
 * Nachgemessen war es keine Einzelstelle, sondern eine Klasse. Die Anwendung
 * hat zwei Themen (`:root[data-theme='light'|'dark']` in `app.css`), und
 * `--text` wechselt zwischen fast schwarz und fast weiss. An 26 Stellen stand
 * aber eine feste Farbe: `background: #fff` unter der Modellantwort, die
 * Schweregrade `#b4232a`/`#b8860b`/`#7a8791` an den Befundzeilen, `#8a4b00`
 * — der Wert, den `--warnung` im HELLEN Thema hat. Im dunklen Thema stand
 * damit heller Text auf weissem Grund.
 *
 * **Warum kein bestehender Lauf das fand.** `svelte-check` prüft TypeScript,
 * `stylelint` prüft Schreibweise, und `check-stilvariablen.mjs` prüft, ob
 * benutzte Variablen definiert sind. Eine gültige, gut geschriebene, fest
 * verdrahtete Farbe ist für alle drei in Ordnung — sie ist nur im zweiten Thema
 * falsch, und das sieht keines von ihnen an.
 *
 * ## Die Regel
 *
 * In `src/` steht in keiner farbtragenden Deklaration ein Farbliteral. Farben
 * kommen aus den Token in `app.css`, weil nur die den Themenwechsel mitmachen.
 *
 * **Die Ausnahme trägt ihren Grund.** Manches Weiss gehört nicht zum Thema,
 * sondern zur Sache: Ein QR-Code braucht weissen Grund, damit ihn jede Kamera
 * liest, und hinter dem Kamerabild des Scanners gehört Schwarz. Solche Stellen
 * werden mit `/* themenfest: <Grund>. *​/` in der Zeile darüber gekennzeichnet.
 * Ein Wächter, den man nur abschalten kann, wird abgeschaltet; einer, der einen
 * Satz verlangt, wird bedacht.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WURZEL = process.argv[2] ?? process.cwd();

/**
 * Wo die Token definiert werden, MÜSSEN Literale stehen — aber nur dort.
 *
 * **Nicht die ganze Datei** (Code-Review 01.09.2026, zweite Runde): `app.css`
 * trägt neben den drei Tokenblöcken rund 1200 Zeilen Bausteinstile, und die
 * waren damit ungeprüft. Eine feste Farbe an einem Knopf in `app.css` wirkt auf
 * jeder Seite der Anwendung — es ist die schlechteste Stelle, sie ungeprüft zu
 * lassen.
 *
 * Ausgenommen ist deshalb der Block, nicht die Datei: alles zwischen `:root {`
 * beziehungsweise `:root[data-theme='…'] {` und der zugehörigen schliessenden
 * Klammer.
 */
/**
 * Kommentare durch Leerzeichen ersetzen — Länge und Zeilenumbrüche bleiben.
 *
 * **Warum das sein muss** (zweite Reviewrunde 01.09.2026): Die erste Fassung
 * zählte geschweifte Klammern über den rohen Text. Eine einzelne `{` in einem
 * Kommentar innerhalb eines `:root`-Blocks liess den Block nie schliessen —
 * damit galt der ganze Rest von `app.css` als Tokenblock, und der Lauf war
 * still grün. Genau die Lücke, die diese Ausnahme schliessen sollte.
 *
 * Die Länge bleibt gleich, damit die Stellen weiter auf ihre Zeilen zeigen.
 */
function ohneKommentare(text) {
	let aus = '';
	let i = 0;
	while (i < text.length) {
		if (text[i] === '/' && text[i + 1] === '*') {
			const ende = text.indexOf('*/', i + 2);
			const bis = ende === -1 ? text.length : ende + 2;
			for (let n = i; n < bis; n++) aus += text[n] === '\n' ? '\n' : ' ';
			i = bis;
			continue;
		}
		aus += text[i];
		i++;
	}
	return aus;
}

/**
 * Die Bereiche, in denen die Token DEFINIERT werden — dort müssen Literale
 * stehen.
 *
 * **Nicht die ganze Datei** (Code-Review 01.09.2026): `app.css` trägt neben den
 * Tokenblöcken rund 1200 Zeilen Bausteinstile. Eine feste Farbe an einem Knopf
 * dort wirkt auf jeder Seite der Anwendung — es ist die schlechteste Stelle,
 * sie ungeprüft zu lassen.
 */
function tokenbereiche(sauber) {
	const bereiche = [];
	/*
	 * **Auch in einer Medienabfrage** (02.09.2026, aufgedeckt beim Prüfen der
	 * neuen Themenregel). Hier stand `(^|\})\s*:root…`, und ein Tokenblock
	 * innerhalb von `@media` steht nach einem `{`. Er galt damit nicht als
	 * Tokenbereich, und jede Farbe darin wurde als «feste Farbe» gemeldet —
	 * obwohl genau dort Literale stehen MÜSSEN, weil dort die Token entstehen.
	 */
	const muster = /:root(\[[^\]]*\])?\s*\{/g;
	let treffer;
	while ((treffer = muster.exec(sauber)) !== null) {
		const auf = sauber.indexOf('{', treffer.index);
		let tiefe = 0;
		let n = auf;
		for (; n < sauber.length; n++) {
			if (sauber[n] === '{') tiefe++;
			else if (sauber[n] === '}') {
				tiefe--;
				if (tiefe === 0) break;
			}
		}
		bereiche.push([auf, n]);
		muster.lastIndex = n;
	}
	return bereiche;
}

/**
 * Ein Farbliteral: `#abc`, `#aabbcc`, `rgb(…)`, `hsl(…)` und die benannten
 * Farben, die in diesem Baum vorkommen können.
 *
 * **`transparent` und `currentColor` sind keine Literale**: Sie tragen keine
 * eigene Farbe und folgen dem Thema von selbst.
 */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(|\b(white|black|red|green|blue|yellow|orange|grey|gray)\b/;

const MARKE = /\/\*\s*themenfest:\s*\S/;

function dateienUnter(verzeichnis) {
	const treffer = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return treffer;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateienUnter(pfad));
		else if (/\.(svelte|css)$/.test(eintrag)) treffer.push(pfad);
	}
	return treffer;
}

const dateien = dateienUnter(join(WURZEL, 'src'));
const befunde = [];

/*
 * **Ein Thema schaltet auch die Bedienelemente des Browsers** (02.09.2026,
 * Der Auftraggeber: «Bei der Hell-Mode sind die Checkbox und Auswahl-Bullets extrem dunkel.
 * Es wirkt, als wäre dort die Einstellung Hell/Dunkel nicht gut hinterlegt.»).
 *
 * Kästchen, Auswahlknöpfe, Datumsfelder und Rollbalken malt der Browser selbst,
 * und `app.css` nimmt die ersten beiden ausdrücklich von der Hausgestaltung
 * aus. Ohne `color-scheme` richtet er sich nach dem **Gerät** statt nach der
 * Seite: Bei dunklem System und heller Seite war das Kästchen ein schwarzer
 * Block (nachgemessen). `accent-color` gehört daneben, sonst ist der gewählte
 * Knopf browserblau in einer grünen Anwendung.
 *
 * Beides steht im Themenblock und nicht in `:root`, denn beides wechselt mit
 * dem Thema. Der Wächter prüft es hier, weil ein drittes Thema — ein
 * Kontrastmodus etwa — die zwei Zeilen sonst still vergisst und niemandem
 * auffällt, ausser dem, der ein dunkles Gerät hat.
 */
const MUSS_JE_THEMA = ['color-scheme', 'accent-color'];

/** Die Themenblöcke: `:root[data-theme='…']`, nicht das nackte `:root`. */
function themenbloecke(sauber) {
	const raus = [];
	/*
	 * **Kein `}` davor verlangen** (02.09.2026, zweite Reviewrunde). Der erste
	 * Anlauf schrieb `(^|\})\s*:root\[…`, und ein Themenblock in einer
	 * Medienabfrage steht nach einem `{` — genau der erlaubte Zweitblock, den
	 * der Kommentar oben nennt, wurde damit nicht gefunden und sein Thema als
	 * unvollständig gemeldet.
	 */
	const muster = /:root\[data-theme=[^\]]*\]\s*\{/g;
	let treffer;
	while ((treffer = muster.exec(sauber)) !== null) {
		const auf = sauber.indexOf('{', treffer.index);
		let tiefe = 0;
		let n = auf;
		for (; n < sauber.length; n++) {
			if (sauber[n] === '{') tiefe++;
			else if (sauber[n] === '}') {
				tiefe--;
				if (tiefe === 0) break;
			}
		}
		// Der Treffer beginnt beim `}` des Vorblocks (so findet das Muster den
		// Anfang) — für die Meldung zählt nur der Wählername dahinter.
		const name = treffer[0].replace(/\s*\{$/, '');
		const thema = /data-theme=['"]?([\w-]+)/.exec(name)?.[1] ?? '';
		const zeile = sauber.slice(0, auf).split('\n').length;
		raus.push({ name, thema, zeile, text: sauber.slice(auf, n) });
		muster.lastIndex = n;
	}
	return raus;
}

let ausnahmen = 0;
let geprueft = 0;
let tokenzeilen = 0;

for (const pfad of dateien) {
	const kurz = relative(WURZEL, pfad);
	geprueft++;
	const roh = readFileSync(pfad, 'utf8');
	const sauber = ohneKommentare(roh);
	const bereiche = tokenbereiche(sauber);
	const zeilenAnfang = [0];
	for (let i = 0; i < roh.length; i++) if (roh[i] === '\n') zeilenAnfang.push(i + 1);
	const zeileVon = (stelle) => {
		let a = 0;
		let b = zeilenAnfang.length - 1;
		while (a < b) {
			const m = Math.ceil((a + b) / 2);
			if (zeilenAnfang[m] <= stelle) a = m;
			else b = m - 1;
		}
		return a;
	};
	const rohzeilen = roh.split('\n');
	const marken = new Set();
	for (let i = 0; i < rohzeilen.length; i++) if (MARKE.test(rohzeilen[i])) marken.add(i);

	/*
	 * **Über den Text, nicht über Zeilen** (zweite Reviewrunde): Steht der Wert
	 * auf der Folgezeile oder die ganze Regel auf einer, sah die zeilenweise
	 * Fassung das Literal nie — beides mit einer Probe belegt.
	 */
	const deklaration = /(^|[;{}])\s*(--[\w-]+|background[a-z-]*|color|border[a-z-]*|outline[a-z-]*|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration[a-z-]*|column-rule[a-z-]*)\s*:([^;{}]*)/g;
	let treffer;
	while ((treffer = deklaration.exec(sauber)) !== null) {
		const stelle = treffer.index + treffer[0].indexOf(treffer[2]);
		if (bereiche.some(([a, b]) => stelle > a && stelle < b)) {
			tokenzeilen++;
			continue;
		}
		if (!LITERAL.test(treffer[3])) continue;
		const zeile = zeileVon(stelle);
		// Die Marke darf auf der Zeile stehen, davor, oder irgendwo im Wert.
		const bisZeile = zeileVon(treffer.index + treffer[0].length);
		let markiert = false;
		for (let z = Math.max(0, zeile - 1); z <= bisZeile; z++) if (marken.has(z)) markiert = true;
		if (markiert) {
			ausnahmen++;
			continue;
		}
		befunde.push(
			`${kurz}:${zeile + 1}  ${treffer[2]}: ${treffer[3].replace(/\s+/g, ' ').trim().slice(0, 60)}`
		);
	}
}

if (befunde.length > 0) {
	console.error(
		`Themenfarben: ${befunde.length} feste Farbe(n) in farbtragenden Deklarationen.\n` +
			'Farben kommen aus den Token in src/app.css — nur die machen den Themenwechsel mit.\n' +
			'Gehört die Farbe zur Sache und nicht zum Thema (QR-Code, Kamerabild), setzen Sie\n' +
			'in die Zeile darüber: /* themenfest: <Grund>. */\n'
	);
	for (const b of befunde) console.error(`  ${b}`);
	process.exit(1);
}

/*
 * **Die Sichtprobe** (Erfahrung aus mehreren Wächtern in diesem Repo): Ein
 * Filter, der versehentlich null Zeilen trifft, ist dauerhaft grün und sieht
 * genauso aus wie ein sauberer Baum. Geprüft wird deshalb, dass der Lauf
 * überhaupt über Dateien gegangen ist UND die bekannten, bewusst
 * gekennzeichneten Stellen gefunden hat.
 */
if (geprueft < 50) {
	console.error(`Themenfarben: nur ${geprueft} Dateien geprüft — der Lauf greift nicht.`);
	process.exit(1);
}

/*
 * Die Themenblöcke selbst: Schaltet jeder auch die Bedienelemente mit?
 *
 * **Eine fehlende `app.css` ist ein Befund, kein Absturz** (02.09.2026, beim
 * eigenen Nachmessen). Der erste Anlauf las die Datei ohne Auffangnetz, und der
 * Wächtertest fuhr gegen Prüfbäume, die keine haben — heraus kam ein `ENOENT`
 * statt eines Satzes. Ein Wächter, der abstürzt, sagt niemandem, was fehlt.
 */
let appcss = '';
try {
	appcss = readFileSync(join(WURZEL, 'src/app.css'), 'utf8');
} catch {
	console.error(
		'Themenfarben: `src/app.css` ist nicht lesbar. Dort stehen die Themenblöcke —\n' +
			'ohne sie lässt sich nicht prüfen, ob ein Thema die Bedienelemente mitschaltet.'
	);
	process.exit(1);
}
const themen = themenbloecke(ohneKommentare(appcss));
if (themen.length < 2) {
	console.error(
		`Themenfarben: nur ${themen.length} Themenblock/-blöcke in app.css gefunden. Entweder gibt\n` +
			'es die Themen nicht mehr, oder dieser Wächter liest sie nicht mehr — dann ginge eine\n' +
			'fehlende `color-scheme`-Zeile still durch.'
	);
	process.exit(1);
}
/*
 * **Je Themennamen, nicht je Block** (aus dem Code-Review). Ein zweiter Block
 * desselben Themas ist erlaubt — eine Medienabfrage etwa, die ein paar Werte
 * überschreibt. Verlangt wird, dass das Thema die Zeilen IRGENDWO hat, nicht in
 * jedem seiner Blöcke.
 */
const jeThema = new Map();
for (const t of themen) {
	const eintrag = jeThema.get(t.thema) ?? { name: t.name, zeile: t.zeile, text: '' };
	eintrag.text += `\n${t.text}`;
	jeThema.set(t.thema, eintrag);
}

const luecken = [];

/**
 * Der zuletzt gesetzte Wert einer Eigenschaft — CSS gilt der letzte.
 *
 * **Der erste Anlauf nahm den ersten** (zweite Reviewrunde). Ein zweiter Block
 * desselben Themas mit einem falschen `color-scheme` lief damit grün durch:
 * Fix «je Thema zusammenfassen» und Fix «Wert prüfen» hoben sich gegenseitig
 * auf.
 */
function letzterWert(text, eigenschaft) {
	const muster = new RegExp(`(^|[;{])\\s*${eigenschaft}\\s*:([^;{}]*)`, 'g');
	let treffer;
	let wert = null;
	while ((treffer = muster.exec(text)) !== null) wert = treffer[2].trim();
	return wert;
}

/**
 * Was als `color-scheme` gelten darf.
 *
 * **Nicht der Themenname** (zweite Reviewrunde). Der erste Anlauf verglich den
 * Wert mit dem Wählernamen und machte damit jedes Thema unerfüllbar, das nicht
 * zufällig `light` oder `dark` heisst — ein `data-theme='kontrast'` wäre rot
 * geworden, obwohl `color-scheme: kontrast` gar kein gültiges CSS ist. Der
 * Wächter hätte den Kontrastmodus gesperrt, den sein eigener Anlass nennt.
 *
 * Geprüft wird deshalb, dass ein **gültiger** Wert dasteht und nicht `normal` —
 * denn `normal` ist genau der Ausgangszustand, um den es ging. `only` und
 * `!important` gehören dazu, beides ist korrektes CSS.
 */
const SCHEMA_GUELTIG = /^(only\s+)?(light|dark)(\s+(light|dark))?(\s*!important)?$/;

for (const [thema, t] of jeThema) {
	const schema = letzterWert(t.text, 'color-scheme');
	if (schema === null) {
		luecken.push(`${t.name} (Zeile ${t.zeile}) — color-scheme fehlt`);
	} else if (!SCHEMA_GUELTIG.test(schema)) {
		luecken.push(
			`${t.name} (Zeile ${t.zeile}) — color-scheme ist «${schema}»; erwartet light, dark ` +
				'oder «light dark», auch mit `only`'
		);
	} else if (
		(thema === 'light' || thema === 'dark') &&
		!new RegExp(`\\b${thema}\\b`).test(schema)
	) {
		// Nur wo der Name eine Aussage macht: Ein Thema, das `light` heisst und
		// `color-scheme: dark` setzt, ist der gemeldete Befund mit umgekehrtem
		// Vorzeichen — helle Seite, dunkle Bedienelemente.
		luecken.push(
			`${t.name} (Zeile ${t.zeile}) — color-scheme ist «${schema}», nennt aber nicht «${thema}»`
		);
	}

	const akzent = letzterWert(t.text, 'accent-color');
	if (akzent === null) {
		luecken.push(`${t.name} (Zeile ${t.zeile}) — accent-color fehlt`);
	} else if (akzent === '' || /^auto\b/.test(akzent)) {
		// `auto` ist der Ausgangszustand: das browserblaue Bullet, um das es ging.
		luecken.push(
			`${t.name} (Zeile ${t.zeile}) — accent-color ist «${akzent || '(leer)'}»; das ist der ` +
				'Ausgangszustand, also das browserblaue Bullet'
		);
	}
}

if (luecken.length > 0) {
	console.error(
		'\nThemenfarben: Ein Thema schaltet die Bedienelemente des Browsers nicht mit\n'
	);
	for (const l of luecken) console.error(`  ${l}`);
	console.error(
		'\n  Kästchen, Auswahlknöpfe, Datumsfelder und Rollbalken malt der Browser selbst.\n' +
			'  Ohne `color-scheme` richtet er sich nach dem Gerät statt nach der Seite — bei\n' +
			'  dunklem System und heller Seite wird das Kästchen ein schwarzer Block. Ohne\n' +
			'  `accent-color` ist der gewählte Knopf browserblau statt im Hausgrün.'
	);
	process.exit(1);
}
if (ausnahmen === 0) {
	console.error(
		'Themenfarben: keine einzige «themenfest»-Marke gefunden. Entweder wurde die letzte ' +
			'entfernt — dann gehört diese Sichtprobe angepasst — oder der Wächter liest die ' +
			'Dateien nicht mehr.'
	);
	process.exit(1);
}

console.log(
	`Themenfarben in Ordnung — ${geprueft} Dateien, ${ausnahmen} begründete Ausnahmen, ` +
		`${jeThema.size} Themen schalten die Bedienelemente mit.`
);
