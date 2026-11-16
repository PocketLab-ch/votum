/**
 * Zeichenwächter: Eine Längenschranke auf einer Zeichenkette zählt Zeichen.
 *
 * **Der Anlass** (26.08.2026). `text.length` zählt in JavaScript
 * UTF-16-Einheiten, `length()` in Postgres zählt Zeichen. Bei einer Untergrenze
 * ist die Anwendung dadurch lockerer als ihre eigene `CHECK`-Schranke: Ein Name
 * aus einem einzigen Bildzeichen kommt am Satz «mindestens zwei Zeichen» vorbei
 * und läuft in die Schranke — und die antwortet nicht mit einem Satz, sondern
 * mit einer rohen 500. Die Begründung steht in `src/lib/domain/zeichenzahl.ts`.
 *
 * **Warum mit dem Übersetzer und nicht mit einem regulären Ausdruck.** Der
 * Unterschied, auf den es ankommt, ist der zwischen `name.length` (Zeichenkette,
 * gefährlich) und `namen.length` (Liste, harmlos). Den kennt nur die Typprüfung.
 * Ein Textmuster müsste raten und würde entweder hundert Listen melden oder die
 * Hälfte der Zeichenketten übersehen.
 *
 * **Die erste Fassung war zu wörtlich** (26.08.2026, aus dem Code-Review). Sie
 * verlangte links vom Vergleich ein nacktes `x.length` — und übersah damit
 * ausgerechnet die im Haus verbreitetste Schreibweise `(x?.trim().length ?? 0)
 * < 2`. Vier echte Fälle standen dahinter, drei davon unmittelbar vor einer
 * `CHECK`-Schranke, und der Wächter meldete «in Ordnung». Ein grüner Wächter,
 * der die lautesten Restfälle nicht sieht, ist schlimmer als keiner: Er beendet
 * die Suche. Deshalb wird jetzt abgeschält (Klammern, `!`, `as`, `?? 0`), und
 * ein Empfänger vom Typ `string | undefined` zählt als Zeichenkette.
 *
 * **Was gemeldet wird.** `<zeichenkette>.length` in einem Vergleich mit `<`,
 * `>`, `<=`, `>=`, `===`, `!==`. Nicht gemeldet:
 *
 *   - der Vergleich gegen `0` — ob etwas leer ist, sehen beide Zählweisen gleich;
 *   - `.length` **rechts** von etwas, das keine Zahl ist (`i < text.length`) —
 *     das ist eine Schleifengrenze, keine Schranke. Steht rechts eine Zahl
 *     (`2 > name.length`), ist es eine umgedrehte Schranke und wird gemeldet.
 *
 * **Was er nicht sieht:** `.svelte`-Dateien, denn sie stehen nicht im
 * Übersetzerprogramm. Das ist eine echte Lücke und keine Begründung — im Markup
 * steht zwar `minlength`, im `<script>` aber stehen auch Schranken. Wer dort
 * eine anlegt, prüft von Hand mit; die Serverseite ist ohnehin die massgebende.
 * Ebenso ungesehen: ein Empfänger vom Typ `any` oder `unknown` — dort weiss der
 * Übersetzer selbst nicht, ob eine Zeichenkette gemeint ist. Solche Stellen
 * werden gezählt und am Schluss genannt, damit die Lücke nicht still ist.
 *
 * **Die Ausnahme steht im Code, nicht in einer Liste hier.** Ein Vermerk
 * `zeichenzahl-frei: <Grund>` in der Zeile selbst oder der Zeile darüber nimmt
 * eine Stelle heraus. Am Ende läuft die Sichtprobe: Ein Vermerk, der nichts mehr
 * deckt, ist ein Wächter, der still aufgehoben wurde.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import ts from 'typescript';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WURZEL = process.cwd();
const VERMERK = 'zeichenzahl-frei:';

/**
 * Untergrenze der bewachten Menge.
 *
 * Ein Wächter, dessen Muster nach einem Umbau nichts mehr trifft, meldet «in
 * Ordnung» und prüft nichts (README, Abschnitt «Wächter»). Gezählt wird deshalb
 * nicht, wie viele Dateien gelesen wurden — das sagt nichts —, sondern die
 * bewachte Menge: jede Längenschranke auf einer Zeichenkette, ob sie nun noch
 * `.length` zählt oder schon `zeichenzahl()`. **Beide** zusammen, sonst sänke
 * die Zahl mit jeder Umstellung, und die Untergrenze müsste laufend nachgeben.
 */
const MINDESTENS_BEWACHT = 50;

const VERGLEICHE = new Set([
	ts.SyntaxKind.LessThanToken,
	ts.SyntaxKind.GreaterThanToken,
	ts.SyntaxKind.LessThanEqualsToken,
	ts.SyntaxKind.GreaterThanEqualsToken,
	ts.SyntaxKind.EqualsEqualsEqualsToken,
	ts.SyntaxKind.ExclamationEqualsEqualsToken
]);

/**
 * Schält ab, was um den eigentlichen Ausdruck herumsteht.
 *
 * `(x?.length ?? 0)` ist eine Klammer um eine `??`-Verknüpfung um einen Zugriff.
 * Ohne dieses Abschälen sieht der Wächter nur die Klammer — und genau daran ist
 * die erste Fassung vorbeigelaufen.
 */
/** @param {any} knoten */
function kern(knoten) {
	if (ts.isParenthesizedExpression(knoten)) return kern(knoten.expression);
	if (ts.isNonNullExpression(knoten)) return kern(knoten.expression);
	if (ts.isAsExpression(knoten)) return kern(knoten.expression);
	if (
		ts.isBinaryExpression(knoten) &&
		knoten.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
	) {
		return kern(knoten.left);
	}
	return knoten;
}

/** Ein Zugriff auf `.length` — als Punkt oder in eckigen Klammern. */
/** @param {any} knoten */
function laengenzugriff(knoten) {
	if (ts.isPropertyAccessExpression(knoten) && knoten.name.text === 'length') return knoten;
	if (
		ts.isElementAccessExpression(knoten) &&
		ts.isStringLiteral(knoten.argumentExpression) &&
		knoten.argumentExpression.text === 'length'
	) {
		return knoten;
	}
	return null;
}

/**
 * Ist der Empfänger eine Zeichenkette?
 *
 * `some` und nicht `every`: `string | undefined` ist genau der Fall, um den es
 * geht — dort steht die Schranke meist als `(x?.length ?? 0)`.
 */
/** @param {any} typ */
function istText(typ) {
	if (typ.isUnion()) return typ.types.some(istText);
	return (typ.flags & ts.TypeFlags.StringLike) !== 0;
}

/** @param {any} typ */
function istUnbekannt(typ) {
	return (typ.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;
}

/** @param {any} knoten */
function istNullZahl(knoten) {
	return ts.isNumericLiteral(knoten) && knoten.text === '0';
}

/** Ein Aufruf von `zeichenzahl(...)` — die schon umgestellte Hälfte der Menge. */
/** @param {any} knoten */
function istZeichenzahl(knoten) {
	return (
		ts.isCallExpression(knoten) &&
		ts.isIdentifier(knoten.expression) &&
		knoten.expression.text === 'zeichenzahl'
	);
}

/**
 * Sucht die Schranken in den gegebenen Dateien.
 *
 * Als Funktion und nicht bloss als Skript, damit der Wächter selbst einen
 * Wächter haben kann (`tests/waechter/zeichenzahl.test.ts`): je Regel ein Fall,
 * den er finden **muss**, und einer, den er in Ruhe lassen muss. Der zweite ist
 * der wichtigere — ein Wächter, der im guten Zustand rot wird, wird
 * abgeschaltet statt gelesen.
 *
 * @param {string[]} dateien Wurzeldateien für das Übersetzerprogramm.
 * @param {{ wurzel: string, nurUnter?: string, optionen?: import('typescript').CompilerOptions }} lage
 */
export function sucheSchranken(dateien, lage) {
	const { wurzel, nurUnter = path.join(lage.wurzel, 'src') + path.sep, optionen = {} } = lage;
	const programm = ts.createProgram(dateien, { ...optionen, noEmit: true });
	const pruefer = programm.getTypeChecker();

	/** Zeilen mit einem Vermerk, je Datei — und ob der Vermerk etwas gedeckt hat. */
	/** @type {Map<string, boolean>} */
	const vermerke = new Map();
	/** @type {{ ort: string, text: string }[]} */
	const befunde = [];
	/** @type {string[]} */
	const unbekannte = [];
	let bewacht = 0;
	let gelesen = 0;

	/** Deckt ein Vermerk diese Zeile? Er darf in ihr stehen oder in der darüber. */
	/**
	 * @param {string} datei
	 * @param {number} zeile
	 */
	const gedeckt = (datei, zeile) => {
		for (const kandidat of [`${datei}:${zeile}`, `${datei}:${zeile - 1}`]) {
			// Beim ersten Treffer aufhören: Sonst stempelte ein Vermerk, der eine
			// andere Zeile deckt, sich selbst als benutzt und entkäme der Sichtprobe.
			if (vermerke.has(kandidat)) {
				vermerke.set(kandidat, true);
				return true;
			}
		}
		return false;
	};

	for (const quelle of programm.getSourceFiles()) {
		if (quelle.isDeclarationFile) continue;
		if (!quelle.fileName.startsWith(nurUnter)) continue;
		gelesen++;

		for (const [i, zeile] of quelle.getFullText().split('\n').entries()) {
			if (zeile.includes(VERMERK)) vermerke.set(`${quelle.fileName}:${i + 1}`, false);
		}

		/** @param {any} knoten */
		const besuche = (knoten) => {
			if (ts.isBinaryExpression(knoten) && VERGLEICHE.has(knoten.operatorToken.kind)) {
				const links = kern(knoten.left);
				const rechts = kern(knoten.right);
				if (istZeichenzahl(links) || istZeichenzahl(rechts)) bewacht++;
				// Links ist eine Schranke; rechts nur dann, wenn dort eine Zahl steht —
				// sonst ist es `i < text.length`, also eine Schleifengrenze.
				const linkeSeite = laengenzugriff(links);
				const seite = linkeSeite ?? (ts.isNumericLiteral(links) ? laengenzugriff(rechts) : null);
				const gegen = seite === linkeSeite ? rechts : links;
				if (seite && !istNullZahl(gegen)) {
					const typ = pruefer.getTypeAtLocation(seite.expression);
					const { line } = quelle.getLineAndCharacterOfPosition(knoten.getStart());
					const ort = `${quelle.fileName.replace(wurzel + path.sep, '')}:${line + 1}`;
					const text = knoten.getText().replace(/\s+/g, ' ').slice(0, 70);
					if (istText(typ)) {
						bewacht++;
						if (!gedeckt(quelle.fileName, line + 1)) befunde.push({ ort, text });
					} else if (istUnbekannt(typ)) {
						unbekannte.push(ort);
					}
				}
			}
			ts.forEachChild(knoten, besuche);
		};
		besuche(quelle);
	}

	return {
		befunde,
		unbekannte,
		bewacht,
		dateien: gelesen,
		vermerke: vermerke.size,
		tote: [...vermerke].filter(([, benutzt]) => !benutzt).map(([ort]) => ort)
	};
}

/* ── Der Lauf über dieses Projekt ────────────────────────────────────────── */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const konfigDatei = ts.findConfigFile(WURZEL, ts.sys.fileExists, 'tsconfig.json');
	if (!konfigDatei) {
		console.error('Zeichenzahl: keine tsconfig.json gefunden.');
		process.exit(1);
	}
	const gelesen = ts.readConfigFile(konfigDatei, ts.sys.readFile);
	const konfig = ts.parseJsonConfigFileContent(gelesen.config, ts.sys, path.dirname(konfigDatei));
	const ergebnis = sucheSchranken(konfig.fileNames, {
		wurzel: WURZEL,
		optionen: konfig.options
	});

	if (ergebnis.befunde.length > 0) {
		console.error(
			'Zeichenzahl: Diese Schranken zählen UTF-16-Einheiten, die Datenbank zählt Zeichen.\n' +
				'  Bei einer Untergrenze ist die Anwendung damit lockerer als ihre eigene\n' +
				'  CHECK-Schranke — und die antwortet mit einer rohen 500 statt mit einem Satz.\n'
		);
		for (const b of ergebnis.befunde) console.error(`  ${b.ort}  ${b.text}`);
		console.error(
			`\n  Weg heraus: zeichenzahl(...) aus $lib/domain/zeichenzahl.\n` +
				`  Zählt die Stelle bewusst Einheiten (Zerschneiden, Zufallscode, KI-Antwort),\n` +
				`  dann ein «${VERMERK} <Grund>» in die Zeile oder die Zeile darüber.`
		);
		process.exitCode = 1;
	}

	/*
	 * **Die Sichtprobe.** Ein Vermerk, dessen Stelle inzwischen umgeschrieben oder
	 * verschoben wurde, deckt nichts mehr — und die nächste Stelle, die an seine
	 * Zeile rutscht, deckt er still mit. Das ist ein aufgehobener Wächter, der wie
	 * ein gültiger aussieht. Sie läuft **auch dann**, wenn oben schon Befunde
	 * stehen: Sonst bliebe ein toter Vermerk verdeckt, solange irgendetwas offen ist.
	 */
	if (ergebnis.tote.length > 0) {
		console.error('\nZeichenzahl: Diese Vermerke decken nichts (mehr):\n');
		for (const t of ergebnis.tote) console.error(`  ${t.replace(WURZEL + path.sep, '')}`);
		console.error('\n  Weg damit — ein ungepflegter Vermerk deckt irgendwann etwas anderes.');
		process.exitCode = 1;
	}

	if (ergebnis.bewacht < MINDESTENS_BEWACHT) {
		console.error(
			`\nZeichenzahl: nur ${ergebnis.bewacht} Längenschranken auf Zeichenketten gesehen ` +
				`(erwartet mindestens ${MINDESTENS_BEWACHT}).\n` +
				'  Entweder ist die Typauflösung kaputt oder der Wächter sieht die Dateien nicht mehr.\n' +
				'  So geprüft wäre er wirkungslos.'
		);
		process.exitCode = 1;
	}

	if (!process.exitCode) {
		console.log(
			`Zeichenzahl in Ordnung: ${ergebnis.bewacht} Längenschranken auf Zeichenketten in ` +
				`${ergebnis.dateien} Dateien, ${ergebnis.vermerke} davon mit Grund ausgenommen` +
				(ergebnis.unbekannte.length > 0
					? `; ${ergebnis.unbekannte.length} auf «any»/«unknown» nicht beurteilbar`
					: '') +
				'.'
		);
	}
}
