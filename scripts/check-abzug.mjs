/**
 * Abzugswächter: Der Export des Quorumsbaums muss laufen, und der Aufruf, den
 * sein Dateikopf nennt, muss dasselbe Werkzeug nennen wie der, der hier läuft.
 *
 * Die beiden sind nicht zeichengleich und sollen es nicht sein: Der Kopf
 * richtet sich an einen Menschen und trägt den Docker-Vorspann und eine
 * Umleitung, hier läuft der nackte Aufruf im Container. Geprüft wird, dass
 * die dokumentierte Zeile `vite-node` und dieses Skript nennt.
 *
 * **Der Anlass, am 22.09.2026.** Der Kopf von `quorumsbaum-export.mjs`
 * beschrieb einen Aufrufweg, der nicht funktioniert: `node` löst weder den
 * TypeScript-Import des Skripts noch die endungslosen Importe der
 * Fassungskette auf. Der richtige Weg geht über `vite-node`, das beides löst.
 *
 * Die falsche Anweisung stand wochenlang da, und zwei Sitzungen haben daraus
 * geschlossen, **der Export** sei kaputt. Eine hat einen Umbau der Importform
 * gebaut, die andere hat den Befund unabhängig bestätigt, indem sie denselben
 * falschen Aufruf fuhr.
 *
 * Möglich war das, weil das Skript in **keinem** Lauf hing: In `package.json`
 * kam es null Mal vor. Ein Nachweis, den niemand fährt, wird still falsch, und
 * er stiftet die ganze Zeit Zuversicht, weil man ihn für vorhanden hält.
 *
 * **Warum der Aufruf gelesen und nicht wiederholt wird.** Die erste Fassung
 * dieses Wächters führte die Aufrufzeile als eigene Konstante und behauptete
 * im Kommentar, sie sei «dieselbe wie im Kopf des Exportskripts». Sie verglich
 * aber nichts: Wer den Kopf wieder auf `node` zurückschriebe, liesse diesen
 * Lauf grün. Der Wächter hätte also genau die Fehlerklasse offen gelassen,
 * wegen der er gebaut wurde, und dabei Zuversicht gestiftet. Gefunden im
 * Code-Review am 22.09.2026.
 *
 * Gelesen wird deshalb der **ausgezeichnete** Aufrufblock, nicht der ganze
 * Kopf. Der Kopf bespricht den alten, falschen `node`-Aufruf ausdrücklich, um
 * zu erklären, warum er nicht taugt. Ein Wächter über den ganzen Text würde
 * diese Erklärung mitlesen und wäre entweder immer rot oder, nach der
 * naheliegenden Abschwächung, nie. Dieselbe Falle steht in
 * `tests/domain/regelwerksfassungen.test.ts` beschrieben, dort in der anderen
 * Richtung: Ein Wächter, der seine eigene Begründung mitliest, misst den
 * Kommentar statt den Code.
 *
 * **Was hier nicht geprüft wird.** Ob die ausgegebene Fassung die aktuelle
 * ist. Das deckt `regelwerksfassungen.test.ts` bereits ab, und zwar an beiden
 * Zeilen, die es betrifft: der Importzeile und der Zeile, die den Import
 * benutzt. Ein zweiter Lauf derselben Aussage kostete Zeit bei jedem Commit
 * und gäbe nur den Anschein einer zweiten Prüfung.
 *
 * Geprüft wird: der dokumentierte Aufruf nennt `vite-node` und dieses Skript,
 * der Lauf endet mit 0, die Ausgabe ist gültiges JSON, die tragenden Felder
 * sind da und die beiden Listen sind nicht leer. Was **in** den Knoten steht,
 * prüfen die Regelwerkstests; hier nur eine Regel des Website-Tons, die erst
 * nach der Umformung in `text()` messbar ist («und» statt «oder», unten).
 *
 * **Warum das Skript vorher gesucht wird, statt den Lauf reden zu lassen.**
 * Fehlt es, bricht `vite-node` mit «Cannot find module» und einer Stapelspur
 * ab. Das wäre auch «nicht 0», aber rot aus Versehen: Es sagt nicht, dass der
 * Wächter nichts mehr zu prüfen hat. `tests/waechter/reissleine.test.ts`
 * verlangt genau diese Unterscheidung von jedem Wächter hier, und es hat
 * diesen beim ersten Lauf erwischt.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EXPORTSKRIPT = 'scripts/quorumsbaum-export.mjs';

/**
 * Ein Abzug aus einer Datei statt aus dem Lauf: Der Gegentest legt eine
 * Fixture mit dem Schalter `--abzug <datei>` vor, weil er den Export nicht
 * fahren kann und eine erfundene Karte prüfen will, die es im Bestand nicht
 * gibt. Ohne den Schalter läuft der Export wie bisher.
 */
const ABZUG_DATEI = (() => {
	const i = process.argv.indexOf('--abzug');
	if (i === -1) return null;
	const datei = process.argv[i + 1];
	if (!datei || datei.startsWith('--')) {
		scheitere('`--abzug` braucht einen Dateinamen dahinter.', [
			'Ohne die Fixture würde der Lauf still den Export fahren, statt die Fixture zu prüfen.'
		]);
	}
	return datei;
})();

/**
 * Das Laufwerkzeug, lokal statt über `npx`.
 *
 * Über `npx` wäre der Lauf von der Registry abhängig: `vite-node` war bis zum
 * 22.09.2026 in keiner Abhängigkeitsdatei deklariert, und `npx` hätte es bei
 * jedem Commit aus dem Netz geholt, ungepinnt und ohne Integritätsprüfung.
 * Gefunden in der Sicherheitsprüfung. Seither steht es als
 * Entwicklungsabhängigkeit im Lockfile, und hier wird genau die Fassung aus
 * dem Baum gefahren.
 */
const WERKZEUG = join('node_modules', '.bin', 'vite-node');

/** Die Überschrift, hinter der im Exportskript der Aufruf steht. */
const AUFRUFMARKE = '**Aufruf, im App-Container:**';

/** Felder, ohne die ein Abzug für die Website nichts taugt. */
const PFLICHTFELDER = ['fassung', 'quelle', 'aeste', 'knoten'];

function scheitere(satz, einzelheiten = []) {
	console.error(`\nAbzugswächter: ${satz}`);
	for (const zeile of einzelheiten) console.error(`  ${zeile}`);
	process.exit(1);
}

let abzugText;

if (ABZUG_DATEI) {
	/*
	 * Gegentest: Der Abzug kommt aus einer Fixture statt aus dem Export. Die
	 * Prüfungen auf Skript, Laufwerkzeug und dokumentierten Aufruf entfallen,
	 * weil sie den Export betreffen, nicht die Fixture.
	 */
	if (!existsSync(ABZUG_DATEI)) {
		scheitere('Die Abzugs-Fixture ist nicht da.', [`Erwartet: ${ABZUG_DATEI}`]);
	}
	abzugText = readFileSync(ABZUG_DATEI, 'utf8');
} else {
	// ── 1. Ist überhaupt etwas zu prüfen da? ─────────────────────────────────────

	const SKRIPTPFAD = join(process.cwd(), EXPORTSKRIPT);
	if (!existsSync(SKRIPTPFAD)) {
		scheitere('Das Exportskript ist nicht da.', [
			`Erwartet: ${SKRIPTPFAD}`,
			'Ohne das Skript gibt es keinen Abzug, und dieser Wächter hat nichts zu prüfen.'
		]);
	}

	const WERKZEUGPFAD = join(process.cwd(), WERKZEUG);
	if (!existsSync(WERKZEUGPFAD)) {
		scheitere('Das Laufwerkzeug ist nicht da.', [
			`Erwartet: ${WERKZEUGPFAD}`,
			'`vite-node` gehört als Entwicklungsabhängigkeit ins Lockfile; fehlt es,',
			'fehlt die Installation, nicht der Export. `npm install` im App-Container.'
		]);
	}

	// ── 2. Der dokumentierte Aufruf, gelesen statt wiederholt ────────────────────

	const quelle = readFileSync(SKRIPTPFAD, 'utf-8');
	const marke = quelle.indexOf(AUFRUFMARKE);
	if (marke < 0) {
		scheitere('Im Kopf des Exportskripts steht kein ausgezeichneter Aufruf.', [
			`Gesucht: ${AUFRUFMARKE}`,
			'Ohne die Auszeichnung weiss dieser Wächter nicht, welche Zeile der Aufruf ist,',
			'und kann nicht prüfen, ob sie noch stimmt.'
		]);
	}

	/*
	 * Ab der Marke bis zum Ende des Kommentarblocks, und darin die erste Zeile,
	 * die das Skript nennt. Der Kommentar weiter unten bespricht den alten,
	 * falschen Aufruf; deshalb wird hier nur der ausgezeichnete Block gelesen.
	 */
	const nachDerMarke = quelle.slice(marke + AUFRUFMARKE.length);
	const blockEnde = nachDerMarke.indexOf('**');
	const aufrufblock = blockEnde < 0 ? nachDerMarke : nachDerMarke.slice(0, blockEnde);
	const aufrufzeile = aufrufblock
		.split('\n')
		.map((z) => z.replace(/^\s*\*\s?/, '').trim())
		.find((z) => z.includes(EXPORTSKRIPT));

	if (!aufrufzeile) {
		/*
		 * Der gelesene Block steht mit in der Meldung. Er endet an der nächsten
		 * Fettauszeichnung, und eine zusätzliche im Aufrufblock schneidet ihn zu
		 * früh ab. Der Ausgang ist dann immer noch rot, nie still grün, aber ohne
		 * den Block läse sich die Meldung wie «der Aufruf fehlt», während er nur
		 * hinter der Schnittkante steht.
		 */
		scheitere('Der ausgezeichnete Aufrufblock nennt das Exportskript nicht.', [
			`Gesucht wurde «${EXPORTSKRIPT}» im Block hinter «${AUFRUFMARKE}».`,
			'Gelesen wurde:',
			...aufrufblock.trimEnd().split('\n').map((z) => `  ${z}`)
		]);
	}

	if (!aufrufzeile.includes('vite-node')) {
		scheitere('Der dokumentierte Aufruf nennt nicht `vite-node`.', [
			`Dokumentiert: ${aufrufzeile}`,
			'Nacktes Node kann die endungslosen Importe der Fassungskette nicht auflösen.',
			'Wer dieser Anweisung folgt, hält danach den Export für kaputt.'
		]);
	}

	// ── 3. Läuft er, und kommt etwas Brauchbares heraus? ─────────────────────────

	const lauf = spawnSync(WERKZEUGPFAD, [EXPORTSKRIPT], {
		cwd: process.cwd(),
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});

	if (lauf.error) {
		/*
		 * `spawnSync` setzt `error` für zwei verschiedene Dinge: Der Lauf kam nicht
		 * zustande, oder er lief und wurde am Puffer abgeschnitten (ENOBUFS). Beide
		 * hier zu nennen ist billiger, als den zweiten später als «ungültiges JSON»
		 * misszuverstehen.
		 */
		scheitere('Der Export kam nicht zustande oder wurde abgeschnitten.', [
			String(lauf.error.message)
		]);
	}

	if (lauf.status !== 0) {
		// Die Meldung des Laufs ist die Auskunft, nicht unsere Vermutung darüber.
		scheitere(`Der Export endete mit Rückgabewert ${lauf.status}.`, [
			...(lauf.stderr ?? '').trimEnd().split('\n')
		]);
	}

	abzugText = lauf.stdout;
}

let abzug;
try {
	abzug = JSON.parse(abzugText);
} catch (fehler) {
	scheitere('Die Ausgabe ist kein gültiges JSON.', [
		String(fehler.message),
		`Erste 200 Zeichen: ${abzugText.slice(0, 200)}`
	]);
}

/*
 * Vor dem `in`: Gibt der Export `null` oder eine Zahl aus, stürzte die Prüfung
 * darunter mit «Cannot use 'in' operator» ab, also rot aus Versehen. Die erste
 * Fassung hatte genau das für `aeste` behoben und für den Abzug selbst
 * übersehen; gefunden im zweiten Code-Review am 22.09.2026.
 */
if (typeof abzug !== 'object' || abzug === null || Array.isArray(abzug)) {
	scheitere('Die Ausgabe ist kein Abzug, sondern etwas anderes.', [
		// `typeof null` ist «object». Das wäre hier die Eigenheit der Sprache
		// als Auskunft ausgegeben, also der Fall aus dem Kopf dieser Datei.
		`Ausgelesen wurde: ${abzug === null ? 'null' : Array.isArray(abzug) ? 'eine Liste' : typeof abzug}`
	]);
}

const fehlend = PFLICHTFELDER.filter((f) => !(f in abzug));
if (fehlend.length > 0) {
	scheitere('Dem Abzug fehlen tragende Felder.', [`Fehlt: ${fehlend.join(', ')}`]);
}

/*
 * Beide Listen gleich streng: Ein leerer Ästebaum richtet denselben Schaden an
 * wie leere Knoten, nämlich eine Karte, die ohne Fehler nichts zeigt. Die
 * erste Fassung prüfte nur `knoten` und las `aeste.length` danach trotzdem;
 * bei `null` wäre sie mit einer Stapelspur abgestürzt statt zu melden.
 */
for (const feld of ['aeste', 'knoten']) {
	if (!Array.isArray(abzug[feld]) || abzug[feld].length === 0) {
		scheitere(`Der Abzug enthält keine ${feld}.`, [
			'Eine leere Liste erschiene auf der Website als leere Karte, ohne Fehler.'
		]);
	}
}

const ohneKennung = abzug.knoten.filter((k) => !k?.id || !k?.typ);
if (ohneKennung.length > 0) {
	scheitere('Knoten ohne Kennung oder Typ im Abzug.', [
		`Betroffen: ${ohneKennung.length} von ${abzug.knoten.length}`
	]);
}

/*
 * Website-Ton: die Gruppe der Anwesenden und Vertretenen mit «und», nicht mit
 * «oder», das sich wie eine Wahl zwischen zwei Mehrheiten liest. Die Ersetzung
 * in `text()` griff am 19.10.2026 nur klein geschrieben; die Begründung der
 * Einsprache («der Anwesenden oder Vertretenen») ging durch, gefunden in der
 * Codeprüfung des Website-Abzugs. Geprüft wird die ganze Ausgabe, damit auch
 * ein Feld zählt, das nicht durch `text()` läuft.
 */
const oderStellen = abzugText.match(/.{0,40}\b[Aa]nwesenden? oder [Vv]ertretenen?\b.{0,20}/g) ?? [];
if (oderStellen.length > 0) {
	scheitere('Der Abzug nennt die Anwesenden «oder» Vertretenen.', oderStellen);
}

/*
 * **Kein Werkzeugsatz auf der Website** (Lesarten Block 8, 22.10.2026; Konzept
 * Lesarten, Kriterium 15). Die Website nennt Votum nirgends, und auf ihr rechnet
 * nichts: An den Karten der Lesarten sagt sie, von welcher Seite die Karte
 * ausgeht, nicht «so rechnet dieses Werkzeug». Anlass: Die Fassung 2026-10-27
 * brachte «deshalb rechnet Votum mit Einstimmigkeit» an zwei Karten in den
 * Abzug, und kein Wächter fing es ab. Ältere Sätze mit «dieses Werkzeug» an
 * Karten ohne Lesart sind geprüfter Bestand und hier nicht erfasst.
 */
const votumStellen = abzugText.match(/.{0,60}\bVotum\b.{0,20}/g) ?? [];
if (votumStellen.length > 0) {
	scheitere('Der Abzug nennt Votum.', votumStellen);
}
const lesartkarten = abzug.knoten.filter((k) => k.lesart);
if (lesartkarten.length === 0) {
	scheitere('Der Abzug kennzeichnet keine Karte mit einer Lesart (Feld `lesart`).', [
		'Ohne die Kennzeichnung prüfte der Werkzeugsatz-Wächter nichts.'
	]);
}
const werkzeugsaetze = lesartkarten.flatMap((k) =>
	(JSON.stringify(k).match(/.{0,60}\b[Dd]iese[sm] Werkzeug.{0,20}/g) ?? []).map((m) => `${k.id} (${k.lesart}): ${m}`)
);
if (werkzeugsaetze.length > 0) {
	scheitere('An einer Karte mit Lesart steht ein Werkzeugsatz.', werkzeugsaetze);
}

/*
 * **Werkzeug-Umschreibungen an Karten mit Lesart** (A6). Die beiden Regeln
 * darüber fangen nur «Votum» und «dieses Werkzeug»; eine Umschreibung wie «Der
 * Quorum-Finder rechnet …» ginge durch. Die Wortliste ist am heutigen Abzug
 * gemessen: Aufgenommen ist nur, was an Karten mit Lesart null Treffer hat.
 * «rechnet» allein blieb draussen, weil es an zwei Karten «rechnet ab der
 * Versammlung» heisst (Anfechtungsfrist, keine Umschreibung).
 */
const UMSCHREIBUNG = ['Quorum-Finder', 'Quorenfinder', 'die Anwendung', 'das Programm', 'die Software', 'rechnet mit'];
const umschreibungsStellen = lesartkarten.flatMap((k) => {
	const json = JSON.stringify(k);
	const treffer = UMSCHREIBUNG.filter((wort) =>
		new RegExp(`\\b${wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(json)
	);
	return treffer.map((wort) => `${k.id} (${k.lesart}): «${wort}»`);
});
if (umschreibungsStellen.length > 0) {
	scheitere('An einer Karte mit Lesart steht eine Umschreibung des Werkzeugs.', umschreibungsStellen);
}

/*
 * **Jede Streitfrage trägt eine Richtung** (Lesarten Block 8). Das Signet der
 * Website sagt «streng» oder «mild» ausgelegt; fehlt die Richtung, fiele es auf
 * eine Vorgabe zurück, und die wäre an der Hälfte der Karten falsch.
 */
const ohneRichtung = abzug.knoten.filter(
	(k) =>
		(k.streitfrage && !['streng', 'mild'].includes(k.streitfrageRichtung)) ||
		(!k.streitfrage && k.streitfrageRichtung != null)
);
if (ohneRichtung.length > 0) {
	scheitere('Streitfrage und Richtung passen nicht zusammen.', ohneRichtung.map((k) => k.id));
}

/*
 * **Kein Verweis ins Leere** (Meldung der Website-Sitzung vom 15.11.2026,
 * `.auftraege/2026-11-15-meldung-votum-website-abzug-verweise.md`). Anlass: Der
 * Kasten «Wortlaut und Rechtsprechung» an Art. 647a Abs. 2 sagte «Näheres unter
 * «Zu beachten»». So heisst der Kasten in Votum; der Quorum-Finder nennt ihn
 * «Gut zu wissen», und der gemeinte Hinweis stand gar nicht im Abzug.
 *
 * Jede Stelle `unter «X»` (auch «Unter» am Satzanfang) muss auf einen Titel
 * zeigen, den der Finder hat: einen Abschnitt der Karte oder des Finders (fest,
 * unten), einen Ast oder eine Frage des Abzugs; `Kasten «X»` nur auf einen
 * Abschnitt. Steht der Verweis an einer Karte und nennt er einen Abschnitt, den
 * die Karte nur unter einer Bedingung zeigt, muss die Karte ihn auch zeigen
 * (Codeprüfung N2, `ABSCHNITT_AN_DER_KARTE`); an Fragen und im übrigen Abzug
 * bleibt es bei der Prüfung auf den Titel. Jede Stelle `Karte «X»` muss eine
 * Karte des Abzugs nennen; «dieser Karte «X»» zitiert dagegen einen Teil des
 * eigenen Titels («im Titel dieser Karte «die übrigen»») und muss darin stehen.
 *
 * **Grenze:** Ein Titel mit eigenen « » darin wird am ersten » abgeschnitten und
 * dann als unbekannt gemeldet, also rot, nicht still grün. Heute hat keiner.
 */
/**
 * Die Titel des Quorum-Finders, aus
 * `stockwerkbewirtschaftung-site/src/components/QuorumFinder.astro` (Stand
 * `3d1b090`): `abschnitt(…)`, die Kästen «Wortlaut und Rechtsprechung» und «Und
 * Ihr Reglement?», die Überschrift des Quorums und «Mehr dazu» unter einer langen
 * Hilfe. Benennt die Website einen um, gehört er hier nachgezogen.
 */
const FINDER_TITEL = [
	'Gut zu wissen',
	'Wortlaut und Rechtsprechung',
	'Wenn eine Zustimmung fehlt',
	'Unsere Empfehlung',
	'Beispiele',
	'Zahlenbeispiel',
	'Enthaltungen und Abwesende',
	'Zusätzlich nötig',
	'Rechtsgrundlage',
	'Erforderliches Quorum',
	'Was gilt',
	'Und Ihr Reglement?',
	'Mehr dazu'
];

/**
 * Alle Abschnitte, die der Finder an einer Karte nur unter einer Bedingung zeigt,
 * je mit dieser Bedingung; Herkunft `QuorumFinder.astro`, `zeichneErgebnis`
 * (Z. 225 bis 290, Stand `3d1b090`), für «Wortlaut und Rechtsprechung»
 * `callback-api/server.js` Z. 1408 f. (Abweichung vom Wortlaut, dann die eigene
 * Erklärung oder die allgemeine des Abzugs). Immer gezeigt werden «Rechtsgrundlage»
 * und «Enthaltungen und Abwesende»; «Mehr dazu» steht nur unter der Hilfe einer
 * Frage, nie an einer Karte. Ändert die Website eine Bedingung, gehört sie hier
 * nachgezogen.
 */
const OHNE_QUORUM = ['grenzfall', 'keine_abstimmung'];
const ABSCHNITT_AN_DER_KARTE = {
	'Wortlaut und Rechtsprechung': (k, a) => k.wortlautAbweichung === true && Boolean(k.wortlautErklaerung ?? a.wortlautErklaerung),
	'Gut zu wissen': (k) => Array.isArray(k.hinweise) && k.hinweise.length > 0,
	'Wenn eine Zustimmung fehlt': (k) => Boolean(k.einstimmigkeitsweg),
	'Und Ihr Reglement?': (k) => Boolean(k.reglementshinweis),
	'Unsere Empfehlung': (k) => Boolean(k.empfehlung),
	Beispiele: (k) => Array.isArray(k.beispiele) && k.beispiele.length > 0,
	Zahlenbeispiel: (k) => k.typ === 'qualifiziertes_mehr',
	'Zusätzlich nötig': (k) => k.zustimmungBetroffenerNoetig === true,
	'Erforderliches Quorum': (k) => !OHNE_QUORUM.includes(k.typ),
	'Was gilt': (k) => OHNE_QUORUM.includes(k.typ),
	'Mehr dazu': () => false
};

/** Alle Zeichenketten des Abzugs mit ihrem Ort: Karte, Frage oder Feld. */
function zeichenketten(wert, ort, raus = []) {
	if (typeof wert === 'string') raus.push({ ort, text: wert });
	else if (Array.isArray(wert)) wert.forEach((w) => zeichenketten(w, ort, raus));
	else if (wert && typeof wert === 'object') {
		for (const [feld, w] of Object.entries(wert)) zeichenketten(w, `${ort}, ${feld}`, raus);
	}
	return raus;
}

/** Der Satz um eine Fundstelle, damit die Meldung ohne Nachschlagen lesbar ist. */
function satzUm(text, stelle, laenge) {
	const anfang = text.lastIndexOf('. ', stelle) + 1;
	const ende = text.indexOf('. ', stelle + laenge);
	return text.slice(anfang, ende < 0 ? text.length : ende + 1).trim();
}

const verweisziele = new Set([
	...FINDER_TITEL,
	...(abzug.aeste ?? []).map((a) => a?.titel).filter(Boolean),
	...(abzug.fragen ?? []).map((f) => f?.text).filter(Boolean)
]);
const kartentitel = new Set(abzug.knoten.map((k) => k.titel).filter(Boolean));
const orte = [
	...abzug.knoten.map((k) => ({ ort: `Karte ${k.id}`, titel: k.titel ?? '', karte: k, wert: k })),
	...(abzug.fragen ?? []).map((f) => ({ ort: `Frage ${f?.id}`, titel: null, karte: null, wert: f })),
	...Object.entries(abzug)
		.filter(([feld]) => !['knoten', 'fragen'].includes(feld))
		.map(([feld, wert]) => ({ ort: `Abzug, ${feld}`, titel: null, karte: null, wert }))
];
const insLeere = [];
for (const { ort, titel, karte, wert } of orte) {
	for (const { ort: stelle, text } of zeichenketten(wert, ort)) {
		for (const m of text.matchAll(/\b([Uu]nter|Kasten) «([^»]+)»/g)) {
			const ziel = m[2];
			const satz = satzUm(text, m.index, m[0].length);
			const bekannt = m[1] === 'Kasten' ? FINDER_TITEL.includes(ziel) : verweisziele.has(ziel);
			if (!bekannt) {
				insLeere.push(`${stelle}: «${ziel}» ist kein ${m[1] === 'Kasten' ? 'Abschnitt' : 'Titel'} des Finders. Satz: ${satz}`);
			} else if (karte && ABSCHNITT_AN_DER_KARTE[ziel] && !ABSCHNITT_AN_DER_KARTE[ziel](karte, abzug)) {
				insLeere.push(`${stelle}: Die Karte zeigt den Abschnitt «${ziel}» nicht. Satz: ${satz}`);
			}
		}
		for (const m of text.matchAll(/(\bdieser )?\bKarte «([^»]+)»/g)) {
			const eigene = Boolean(m[1]);
			const traegt = eigene ? titel !== null && titel.includes(m[2]) : kartentitel.has(m[2]);
			if (!traegt) {
				insLeere.push(
					`${stelle}: «${m[2]}» ist ${eigene ? 'kein Teil des eigenen Kartentitels' : 'keine Karte des Abzugs'}. ` +
						`Satz: ${satzUm(text, m.index, m[0].length)}`
				);
			}
		}
	}
}
if (insLeere.length > 0) {
	scheitere('Der Abzug verweist auf einen Titel, den der Quorum-Finder dort nicht zeigt.', insLeere);
}

console.log(
	`Abzug in Ordnung: Fassung ${abzug.fassung}, ${abzug.knoten.length} Knoten, ${abzug.aeste.length} Äste.`
);
