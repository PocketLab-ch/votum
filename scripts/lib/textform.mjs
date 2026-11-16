/**
 * Wie eine Meldung im Quelltext aussieht — geteilt zwischen Wächter und Probe.
 *
 * **Warum das eine eigene Datei ist** (22.09.2026). Die Untergrenzen in
 * `check-texte.mjs` brechen einen Lauf gegen einen Beispielbaum ab, bevor er
 * zum Befund kommt: Ein Baum mit drei Dateien hat nie 550 Absagen. Eine Probe
 * über das ganze Skript könnte deshalb nicht messen, **ob die Bauform greift**
 * — sie sähe immer nur «zu wenig».
 *
 * Die Alternative wäre ein Schalter gewesen, der die Untergrenzen im Prüflauf
 * abschaltet. Ein solcher Schalter ist eine Angriffsfläche: Wer ihn einmal
 * setzt, hat den Wächter still ausgeschaltet. Stattdessen liegt das, was
 * geprüft werden muss, hier — ohne Nebenwirkung, von beiden Seiten lesbar.
 *
 * **Der Ort ist der übliche**, nicht ausgedacht: `scripts/lib/` führt bereits
 * `kernbindung.mjs`, `pruefmenge.mjs`, `papiereingang.mjs`, `saalneuladen.mjs`
 * und `serveraktionen.mjs` nach demselben Muster — Regel auslagern, damit eine
 * Probe sie direkt messen kann (`tests/waechter/kernbindung-waechter.test.ts`).
 * Eine frühere Fassung lag in `scripts/` und begründete dort ausführlich,
 * warum ihr Name nicht mit `check-` beginnt; hier stellt sich die Frage nicht,
 * weil `tests/waechter/reissleine.test.ts` nur das oberste Verzeichnis liest.
 */
import ts from 'typescript';

/**
 * Ab wann ein Satz keiner mehr ist, und ab wann eine Fangstelle Text trägt.
 *
 * **Beide Zahlen stehen hier, weil Wächter und Probe dieselben brauchen**
 * (Code-Review 22.09.2026). Die Probe führte sie zuerst als eigene Konstanten
 * — zwei Kopien derselben Regel, die auseinanderlaufen, sobald eine geändert
 * wird. Genau das Argument, mit dem die Form hierher gewandert ist.
 *
 * **Die einzige Quelle im Haus ist das trotzdem nicht** (Code-Review, zweite
 * Runde): `tests/domain/einladung.test.ts` und `tests/domain/stimmabgabe.test.ts`
 * prüfen je gegen die Zahl 180 als Literal und nennen `check:texte` im
 * Kommentar als Grund. Dasselbe Argument trifft sie, sie gehören zum Bestand
 * und wurden hier nicht angefasst.
 */
export const HOECHSTE_SATZLAENGE = 180;
export const MINDESTLAENGE = 20;

/** Eine Zeichenkette in beiden Schreibweisen, mit maskierten Zeichen. */
export const ZEICHENKETTE = String.raw`(?:'(?:[^'\\]|\\.)*'|\`(?:[^\`\\]|\\.)*\`)`;

/**
 * Die Feldform: `nachricht: '…' + '…'`.
 *
 * **Der Abschluss war das Loch** (22.09.2026, beim Bauen des Abschnitts «DER
 * ZEITSTEMPEL» in `MANIFEST.txt` gefunden). Vorher stand hier
 *
 *     …(?:nachricht|grund|satz|text|beschreibung)\s*:\s*([\s\S]{0,400}?)[,}\n]
 *
 * und `[,}\n]` beendete die Fangstelle am **ersten Komma** — das steht in einer
 * Meldung fast immer mitten im Text. Gefangen wurde dann
 * `'Jede abgegebene Stimme mit Stimmpartei`, eine Zeichenkette ohne
 * schliessendes Anführungszeichen. `satzAus()` findet darin **null** Stücke,
 * der gemessene Satz hat 0 Zeichen und fällt an der Untergrenze 20 durch.
 *
 * **Die Stelle wurde damit weder gemessen noch gezählt** (berichtigt am
 * 22.09.2026 im Code-Review). Eine frühere Fassung dieses Absatzes schrieb,
 * der Wächter habe sie «als Meldung mitgezählt und nicht gemessen». Das war
 * falsch und irreführend: `meldungen()` gibt nur Sätze über 20 Zeichen
 * zurück, und gezählt wird erst, was zurückkommt. Wer der alten Fassung
 * glaubte, suchte nach einem Zähler, der den Verlust zeigt — den gab es nie,
 * und genau das ist der Punkt.
 *
 * Gemessen am 22.09.2026: Die Feldform brachte vorher **156** Meldungen,
 * heute **317**, also 161 mehr.
 *
 * Eine frühere Fassung nannte hier «166 Fangstellen, die mitten im Text
 * abbrachen». Die Zahl liess sich im Code-Review unter keiner der vier
 * naheliegenden Definitionen reproduzieren (178, 177, 176, 205) und ist
 * deshalb gestrichen. Sie stammte aus einem Wegwerfskript, dessen Abgrenzung
 * nicht festgehalten wurde — eine Zahl ohne ihre Definition ist keine
 * Messung, und in diesem Haus wird sie später als eine zitiert.
 *
 * Jetzt wird der Wert als das gelesen, was er ist: eine Kette aus
 * Zeichenketten, mit `+` verbunden. Sie endet von selbst dort, wo der Wert
 * endet — kein Fenster, kein Trennzeichen zu raten.
 *
 * **Warum keine Ternäre** (gemessen, nicht entschieden): Eine Fassung mit
 * beliebigem kurzem Verbindungsstück fängt fünf Meldungen mehr und sechs statt
 * einer über der Satzgrenze; die fünf neuen sind Quelltext aus
 * `src/lib/domain/odt.ts`, über den sie hinwegspringt. Verloren geht dadurch
 * eine Stelle in `src/lib/domain/namensvorschlag.ts`, und die hängt heute
 * beide Zweige eines Ternärs zu einem Unsinnswort aneinander.
 */
export const FELDFORM_QUELLE = String.raw`\b(?:nachricht|grund|satz|text|beschreibung)\s*:\s*(${ZEICHENKETTE}(?:\s*\+\s*${ZEICHENKETTE})*)`;

/**
 * Ein frischer Ausdruck für die Feldform.
 *
 * **Eine Fabrik, keine Konstante** (Code-Review 22.09.2026). Ein exportierter
 * Ausdruck mit `g` trägt Zustand: `lastIndex`. Nach einem `test()` findet ein
 * anschliessendes `matchAll()` gemessen 2 statt 3 Treffer, weil `matchAll`
 * den Stand übernimmt. Heute ruft niemand `test()` auf, es wäre also kein
 * Fehler — aber ein dritter Nutzer könnte die Prüfmenge beider anderen stumm
 * kürzen, und ein stumm gekürzter Wächter ist genau die Klasse, gegen die
 * diese Datei gebaut ist.
 */
export function feldform() {
	return new RegExp(FELDFORM_QUELLE, 'g');
}

const SEITENFEHLERFORM_QUELLE = String.raw`\berror\(\s*\d{3}\s*,\s*(${ZEICHENKETTE}(?:\s*\+\s*${ZEICHENKETTE})*)`;

/**
 * Ein frischer Ausdruck für die Seitenfehlerform: `error(400, '…' + '…')`.
 *
 * **Dieselbe Falle stand hier zwei Zeilen neben der Feldform** (22.09.2026).
 * Sie lautete `\berror\(\s*\d{3}\s*,([\s\S]{0,400}?)\)` und hatte genau das
 * Fenster und das geratene Trennzeichen, die bei der Feldform gerade entfernt
 * worden waren. Eine **Klammer im Text** beendet die Fangstelle: gemessen an
 * `routes/versammlungen/[id=kennung]/weisungsblatt.pdf/+server.ts`, «Geben Sie
 * an, für welches Haus das Blatt gilt (?haus=…).» Auch diese Stelle wurde
 * weder gemessen noch gezählt; der Zähler stieg danach von 118 auf 119.
 *
 * **Sie steht hier und nicht im Wächter, weil die Probe sie sonst nicht
 * erreicht** (Code-Review, zweite Runde). Die Feldform war ausgelagert und
 * geprüft, die Seitenfehlerform blieb als roher Ausdruck zurück — und der
 * Block, der sie repariert, schreibt selbst: Eine Fehlerklasse bleibt nur
 * dort geschlossen, wo man beim Schliessen hingesehen hat.
 *
 * **Was die Form enger macht, und was das kostet** (gemessen 22.09.2026): 23
 * `error(NNN, …)`-Aufrufe führen kein Literal als erstes Argument — 17-mal
 * eine Konstante, 5-mal `fehler.message`, einer steht in einem Kommentar.
 * Drei davon tragen einen Rückfalltext (`befund.grund ?? 'Der Code gilt
 * nicht'`), und alle drei liegen unter der Mindestlänge, wurden also auch
 * vorher nicht gemessen. **Gemessener Verlust: null Sätze.** Wer einen dieser
 * Rückfalltexte auf über 20 Zeichen verlängert, verliert ihn allerdings
 * still — dann gehört die Form um den `??`-Fall erweitert.
 */
export function seitenfehlerform() {
	return new RegExp(SEITENFEHLERFORM_QUELLE, 'g');
}

const KONSTANTENFORM_QUELLE = String.raw`\bexport\s+const\s+[A-Za-z0-9_]+\s*(?::\s*[^=\n]+)?=\s*(${ZEICHENKETTE}(?:\s*\+\s*${ZEICHENKETTE})*)`;

/**
 * Ein frischer Ausdruck für eine exportierte Textkonstante.
 *
 * **Die fünfte Bauform** (Pendenzen 18.10.2026, Codeprüfung Block 3):
 * `VERTRETERGRENZE` stand als `export const … = '…' + '…'` da und lief an der
 * Schranke von 180 Zeichen je Satz vorbei; `check:texte` las nur Meldungen,
 * Seiten, `error(4xx)` und `z.push`. Im Haus sind exportierte Konstanten die
 * zweite grosse Quelle sichtbarer Texte (Regelwerke, Hinweise, Formulare).
 *
 * **Nur `export const NAME = '…'`**, nicht jede Zeichenkette in einer
 * Konstante: Ein Objekt, eine Liste oder ein Aufruf trägt keinen einzelnen
 * Satz, und ein Muster, das dazwischengreift, misst Quelltext statt Prosa.
 */
export function konstantenform() {
	return new RegExp(KONSTANTENFORM_QUELLE, 'g');
}

/**
 * Die Satzfunktions-Bauform, über den TypeScript-Parser statt über eine Regex:
 * Eine Regex verliert einen Ternär in der Kette (`ausstandMitVollmachten` in
 * `mehrhinweise.ts`), ein einzelnes `return '…';` und sichtbaren Text, der als
 * Argument an eine Zellfunktion geht (`text(…)` in `auszaehlmappe.ts`).
 *
 * Gelesen werden `return`-Ausdrücke aus Zeichenketten, Vorlagen, Verkettungen
 * und Ternären sowie Aufrufe von `text(…)`, deren erstes Argument sichtbarer
 * Text ist. **Ein Ternär ergibt je Zweig eine eigene Lesart**, und eine
 * Verkettung alle Kombinationen ihrer Teile (höchstens `LESARTEN_HOECHSTENS`):
 * Gemessen wird, was ein Leser sieht, nicht beide Zweige aneinandergehängt;
 * dort schnitte ein Punkt im ersten Zweig den zweiten ab. Kennungen, Aufrufe
 * und Variablen tragen keinen Text und bleiben leer; eine
 * Auszeichnungsschablone (`<tag …>`) nimmt `check-texte` an seiner `<`-Marke
 * aus, das ist keine Prosa.
 *
 * Nicht gelesen werden Pfeilfunktionen mit Ausdrucksrumpf (`=> '…'`); offen
 * in `docs/pendenzen.md`.
 *
 * @param {string} quelle Der Quelltext einer Datei, mit Kommentaren.
 * @returns {string[]} Die sichtbaren Sätze, Leerraum zusammengezogen.
 */
export function satzfunktionen(quelle) {
	const sf = ts.createSourceFile('quelle.ts', quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	/** @type {string[]} */
	const raus = [];
	/** @type {(knoten: import('typescript').Node) => string[]} */
	const lesarten = (knoten) => {
		if (ts.isStringLiteral(knoten) || ts.isNoSubstitutionTemplateLiteral(knoten)) return [knoten.text];
		if (ts.isTemplateExpression(knoten)) {
			let s = knoten.head.text;
			for (const span of knoten.templateSpans) s += '…' + span.literal.text;
			return [s];
		}
		if (ts.isBinaryExpression(knoten)) {
			/** @type {string[]} */
			const kombiniert = [];
			for (const l of lesarten(knoten.left)) {
				for (const r of lesarten(knoten.right)) kombiniert.push(l + r);
			}
			return kombiniert.slice(0, LESARTEN_HOECHSTENS);
		}
		if (ts.isConditionalExpression(knoten)) {
			return [...lesarten(knoten.whenTrue), ...lesarten(knoten.whenFalse)].slice(0, LESARTEN_HOECHSTENS);
		}
		if (ts.isParenthesizedExpression(knoten)) return lesarten(knoten.expression);
		return [''];
	};
	/** @type {(knoten: import('typescript').Node) => void} */
	const besuch = (knoten) => {
		/** @type {import('typescript').Expression | undefined} */
		let wert;
		if (ts.isReturnStatement(knoten)) wert = knoten.expression;
		else if (
			ts.isCallExpression(knoten) &&
			ts.isIdentifier(knoten.expression) &&
			knoten.expression.text === 'text' &&
			knoten.arguments.length >= 1
		) {
			wert = knoten.arguments[0];
		}
		if (wert) for (const satz of new Set(lesarten(wert))) if (satz) raus.push(satz);
		ts.forEachChild(knoten, besuch);
	};
	besuch(sf);
	return raus.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Obergrenze der Lesarten je Ausdruck, damit eine lange Kette nicht aufbläht. */
const LESARTEN_HOECHSTENS = 32;

const AUFBAUFORM_QUELLE = String.raw`\bz\.push\(\s*(${ZEICHENKETTE}(?:\s*\+\s*${ZEICHENKETTE})*)\s*\)`;

/**
 * Ein frischer Ausdruck für die Aufbauform: `z.push('…')`.
 *
 * **Die vierte Bauform** (23.09.2026). Text, der zeilenweise in eine Liste
 * geschoben wird, fiel durch die drei anderen — und dazu gehört
 * `MANIFEST.txt`, das Dokument mit der ausdrücklichen Laienanforderung
 * (FR-52), das im Streitfall vorgelegt wird.
 *
 * **Nur der Empfänger `z`, und das ist gemessen** (Bericht vom 22.09.2026).
 * Jeder Empfänger zu lesen erfasst zwölf Textläufe mehr und kostet **24**
 * falsche Beanstandungen: `s.push`, `schritte.push`, `hinweise.push` bauen
 * Kastentexte, Statusketten und Etiketten auf, die nie zusammen vor Augen
 * stehen. Ein Wächter, der Wahres anstreicht, wird umgangen.
 *
 * **Der Ausdruck greift über Zeilengrenzen**, und das war nötig: Der erste
 * Entwurf verlangte den ganzen Aufruf auf einer Zeile und fand in
 * `domain/siegel.ts` den längsten Satz nicht — zwei der Aufrufe stehen dort
 * über drei Zeilen umbrochen. Dieselbe Blindheit wie bei der Feldform, nur
 * eine Woche jünger; gefunden hat sie die eigene Abnahme, die den bekannten
 * Fall verlangte.
 */
function aufbauform() {
	return new RegExp(AUFBAUFORM_QUELLE, 'g');
}

/**
 * Die Abschnitte, die `z.push` aufbaut — als Text, wie ein Leser ihn sieht.
 *
 * **Zusammengehängt, nicht je Zeile** (Bericht vom 22.09.2026, Lesart b). Die
 * Zeilen sind auf Druckbreite umbrochen; je Zeile gemessen greift die
 * Satzregel grundsätzlich nie. Verbunden wird mit einem **Leerzeichen**, nicht
 * mit nichts: Der Zeilenwechsel ist für den Leser ein Zwischenraum, sonst
 * entstünde «belegtesnicht».
 *
 * **Ein Abschnitt endet dort, wo der Aufbau ihn endet.** Nicht nur am leeren
 * Push, sondern auch
 *
 *   - an einer Überschrift und einer Trennlinie (`'-'.repeat(…)`) — sonst
 *     hängt die Überschrift am ersten Satz und überzeichnet ihn um ihre Länge,
 *   - an jeder anderen Anweisung dazwischen. Damit enden Abschnitte an `if`,
 *     `else` und `for` **mit geschweiften Klammern**: Zweige und Schleifen
 *     stehen im Quelltext hintereinander, werden aber nie zusammen
 *     ausgegeben. Ein einzeiliges `if (…) z.push(…);` trennt nur davor, nicht
 *     danach — siehe Grenze 2 unten.
 *
 * Die Nachbarschaft wird deshalb an den **Fundstellen** gemessen, nicht an
 * Zeilen: Zwischen zwei Aufrufen darf nur Leerraum und ein Semikolon stehen.
 *
 * **Vier gemessene Grenzen** (Code-Review 23.09.2026, alle ohne heutigen
 * Verlust, alle benannt statt verschwiegen):
 *
 *   1. **42 von 283 `z.push`-Stellen** sieht der Ausdruck nicht: Ternäre,
 *      Konstanten, Variablen, Spreads und Verkettungen mit einem Ausdruck
 *      darin. Alle 42 wurden von Hand gegen Satzgrenze und Jargonverzeichnis
 *      geprüft — kein Treffer. Sie wirken ausserdem als **Trenner**, kleben
 *      also nichts falsch zusammen.
 *   2. Ein einzeiliges `if (…) z.push(…);` beendet den Abschnitt davor, aber
 *      nicht danach: Die bedingte Zeile klebt an den folgenden unbedingten.
 *      Betroffen sind heute sechs Stellen, alles kurze Etiketten- und
 *      Tabellenzeilen.
 *   3. Eine Fortsetzungszeile aus **einem** Wort fällt weg, weil `satzAus()`
 *      Stücke ohne Zwischenraum verwirft. Der Abschnitt wird dann zu kurz
 *      gemessen (im Bestand 146 statt 156 Zeichen). Die Grenze wird dadurch
 *      später erreicht, nie früher.
 *   4. «Keine Kleinbuchstaben» erkennt eine Überschrift. Eine reine
 *      Ziffernzeile gälte ebenso als eine. Alle 241 Treffer durchgesehen: Die
 *      Regel trifft heute nur echte Überschriften und Platzhalterzeilen. Die
 *      Richtung ist konservativ — sie trennt, sie klebt nicht.
 *
 * @param {string} roh Der Quelltext einer Datei, mit Kommentaren.
 * @returns {string[]} Die Abschnitte als Text, wie ein Leser sie sieht.
 */
export function abschnitte(roh) {
	// Kommentare zuerst weg: Ein Beispiel im Kopfkommentar ist kein Text, der
	// jemandem vor Augen steht (`check-aufraeumen.mjs` begründet dasselbe am
	// 25.08.2026 mit einem auskommentierten DELETE).
	const quelle = roh.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
	/** @type {string[]} */
	const raus = [];
	/** @type {string[]} */
	let block = [];
	let endeVorher = -1;
	const schliesse = () => {
		const satz = block.join(' ').replace(/\s+/g, ' ').trim();
		if (satz.length > MINDESTLAENGE) raus.push(satz);
		block = [];
	};
	for (const treffer of quelle.matchAll(aufbauform())) {
		const dazwischen = endeVorher < 0 ? 'x' : quelle.slice(endeVorher, treffer.index);
		if (!/^[\s;]*$/.test(dazwischen)) schliesse();
		endeVorher = treffer.index + treffer[0].length;

		const text = satzAus(treffer[1]);
		// Leerzeile, Trennlinie und Überschrift trennen, statt mitzuzählen.
		if (text === '' || !/[a-zäöü]/.test(text)) {
			schliesse();
			continue;
		}
		block.push(text);
	}
	schliesse();
	return raus;
}

const ABKUERZUNG = /(?:^|[\s(«„])(?:S|Rz|Art|Abs|Ziff|Fn|Nr|E|f|ff)\.$/;

/**
 * Die Satzgrenzen eines Textes, mit den Abkürzungen des Rechts.
 *
 * **Der Schnitt an jedem «. » war zu grob** (Pendenzen 18.10.2026,
 * Codeprüfung 3c). «S. 62», «Rz. 191» und «Art. 712m» trennten einen Satz in
 * Stücke; jedes Stück blieb unter 180 Zeichen, und der lange Satz, den ein
 * Leser sieht, wurde nie gemessen. Zwei solche Sätze blieben so unbemerkt und
 * wurden von Hand gekürzt.
 *
 * **Die Liste ist absichtlich kurz.** Sie enthält die Abkürzungen, die im
 * Haus in Rechtstexten stehen und auf die Pendenzen ausdrücklich zeigt, dazu
 * «E.» für die Erwägung eines Urteils: Ohne sie riss jede Fundstelle wie
 * «BGE 140 III 561 E. 5.2» den Satz mitten im Zitat. Eine allgemeine Liste
 * deutscher Abkürzungen wäre länger, ungenauer und würde bei der nächsten
 * Fassung gepflegt werden müssen; ein Wächter, der zu viel zusammenhält,
 * meldet einen Satz, den niemand so geschrieben hat.
 *
 * **`f.` und `ff.` halten den Satz zusammen**, auch dort, wo nach der
 * Fundstelle ein neuer Satz beginnt. Das ist die vorsichtigere Richtung: Der
 * Text wird dann länger gemessen und eher angestrichen, nie kürzer.
 *
 * @param {string} text Ein sichtbarer Text, der schon aus Stücken
 *   zusammengesetzt ist.
 * @returns {string[]} Die Sätze, in der Reihenfolge des Textes.
 */
export function saetze(text) {
	const roh = text.split(/(?<=[.!?])\s+/);
	/** @type {string[]} */
	const raus = [];
	for (const teil of roh) {
		const vorher = raus[raus.length - 1];
		if (vorher !== undefined && ABKUERZUNG.test(vorher)) {
			raus[raus.length - 1] = `${vorher} ${teil}`;
		} else {
			raus.push(teil);
		}
	}
	return raus;
}

/**
 * Der sichtbare Satz aus einer Fangstelle.
 *
 * **Nur Stücke mit einem Leerzeichen.** Eine Meldung wird oft aus mehreren
 * Zeichenketten zusammengesetzt; dazwischen steht aber auch mal ein
 * Zustandsname aus einer Verzweigung («laufend»). Ungeprüft aneinandergehängt
 * entstand daraus «laufendDie Versammlung läuft» — eine Beanstandung, die auf
 * nichts zeigt.
 *
 * **Auch Vorlagenzeichenketten** (25.08.2026, aus der Prüfung). Nur `'…'` zu
 * lesen liess 66 von 457 Meldungen ganz aus, und bei gemischten Meldungen
 * wurde der Backtick-Teil stumm weggelassen: Die gemessene Länge war kürzer
 * als die echte. `${…}` wird zu einem Platzhalter, denn was dort steht, ist
 * Quelltext.
 *
 * @param {string} fangstelle Der Wert hinter dem Feldnamen, wie `FELDFORM` ihn fängt.
 * @returns {string} Der sichtbare Satz, leer wenn nichts Lesbares darin steht.
 */
export function satzAus(fangstelle) {
	const stuecke = [...fangstelle.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)]
		.map((m) => (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, '…'))
		.filter((t) => t.includes(' '));
	return stuecke.join('').replace(/\\'/g, "'").replace(/\s+/g, ' ').trim();
}
