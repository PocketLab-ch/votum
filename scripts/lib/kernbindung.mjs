/**
 * Bindet eine Kernfunktion die fremde Kennung an ihren Rahmen?
 *
 * **Die Frage, und warum sie eine Stufe tiefer gestellt wird als bisher.**
 * `check-kennungen.mjs` fragt an der Route: Ruft die Aktion eine Prüfung mit
 * `params.id` auf? Unter `versammlungen/` und `tage/` trägt die Route aber
 * keine Gemeinschaft, sondern eine Versammlung oder einen Abend, und die
 * Bindung steht nicht in der Route, sondern im Kern:
 *
 * ```
 * Route:  loescheTraktandum(handelnder, params.id, text(daten.get('id')))
 * Kern:   leseEines(tx, meetingId, id)
 *           SELECT * FROM agenda_item
 *            WHERE id = ${id} AND meeting_id = ${meetingId}
 * ```
 *
 * **Was ausdrücklich NICHT als Nachweis gilt.** Jeder dieser Punkte hat die
 * erste Fassung dieser Regel falsch grün gemacht; alle stammen aus dem
 * Code-Review vom 08.09.2026, und der schwerste stand im Bestand:
 *
 *   - **Das Weiterreichen.** Dass eine Funktion den Rahmen entgegennimmt und
 *     irgendwohin gibt, sagt nichts.
 *   - **Die Zuweisung.** `UPDATE meeting SET meeting_day_id = ${tagId}
 *     WHERE id = ${meetingId}` schränkt auf nichts ein: Der Rahmen wird
 *     gesetzt, nicht verglichen. Genau so steht `nimmInTagAuf` im Bestand —
 *     die Operation, mit der eine fremde Versammlung in den eigenen Abend
 *     geriete. Gelesen wird deshalb nur, was **nach** `WHERE` steht.
 *   - **Das ODER.** `WHERE id = ${id} OR meeting_id = ${meetingId}` trifft
 *     wahlweise das fremde Traktandum.
 *   - **Die Ungleichheit.** `<>` ist die Anti-Bindung und war zugelassen.
 *   - **Die Unterabfrage.** `AND 1 = (SELECT 1 FROM meeting WHERE id =
 *     ${meetingId})` prüft nur, dass es die eigene Versammlung gibt.
 *   - **Der fremde Herkunftsort.** `${daten.meetingId}` ist der Rahmen aus dem
 *     Formular, nicht der aus der Adresse — die Fehlerklasse selbst.
 *
 * **Gelesen wird mit dem TypeScript-Parser.** Die Parameterlisten dieses Repos
 * tragen lange Begründungen zwischen den Argumenten; ein Textmuster verliert
 * daran den Faden (dieselbe Überlegung wie in `check-kibindung.mjs`).
 *
 * **Was diese Regel nicht kann**, und was deshalb weiterhin ein Mensch lesen
 * muss:
 *
 *   - **Tote Zweige.** Eine Abfrage in einem `if (false)` zählt als Bindung.
 *   - **Zwei Abfragen statt einer.** `anhaenge.ts · loeseAb` liest den Anhang
 *     und prüft **danach** dessen Bezug gegen den Rahmen. Das ist eine echte
 *     Bindung, die keine Regel über eine einzelne Abfrage sehen kann; solche
 *     Fälle brauchen eine begründete Ausnahme.
 *   - **Die Reihenfolge.** Ob die Abfrage vor dem Schreiben läuft, sagt sie
 *     nicht.
 *
 * Wo die Regel unsicher ist, meldet sie **offen** statt gebunden. Ein Befund
 * zu viel kostet einen Blick; ein Grün zu viel kostet die Zusicherung.
 *
 * Das Modul ist absichtlich frei von Dateizugriffen: Es bekommt Quelltexte
 * gereicht. So lässt es sich an erfundenen Fällen prüfen, in denen die Bindung
 * fehlt — ein Wächter, der nur am gesunden Bestand grün ist, hat nichts
 * gezeigt (Rat von website-94, 07.09.2026).
 *
 * **Der Aufrufer ist `scripts/check-kernbindung.mjs`**, und der hängt in
 * `npm run pruefen`. Wer diese Regel ändert, ändert damit eine Zusicherung,
 * die vor jedem Commit läuft.
 */
import ts from 'typescript';

/** Wie tief einem Helfer gefolgt wird, bevor der Weg als offen gilt. */
const TIEFE = 4;

/**
 * Namen, die den Rahmen tragen: das Ding, zu dem die Kennung gehören muss.
 *
 * Gezählt am 08.09.2026 über `src/lib/server`: `meetingId` bindet 43 Felder,
 * `tagId` sieben, `stwegId` vier. Ein `meetingDayId` stand hier ebenfalls und
 * kommt in `src` **kein einziges Mal** vor — es war geraten, nicht gemessen,
 * und ist deshalb weg (Code-Review 08.09.2026).
 *
 * @type {string[]}
 */
export const RAHMENNAMEN = ['meetingId', 'tagId', 'stwegId'];

/**
 * Kennungen des Handelnden, nicht des Gegenstands.
 *
 * `operatorId` bindet der Zeilenschutz, `userId` ist der Mensch am Knopf.
 * Beide sind keine Kennung, die aus einem Formular kommt.
 */
const KEINE_KENNUNG = new Set(['operatorId', 'userId', 'benutzerId']);

/**
 * Was rechts davon steht, wird **eingeschränkt**.
 *
 * `IS NOT DISTINCT FROM` ist die nullsichere Gleichheit und gehört dazu. `<>`
 * und `!=` gehören ausdrücklich **nicht** dazu: Sie sind das Gegenteil einer
 * Bindung, und die erste Fassung liess sie zu.
 */
const VERGLEICH = /([\w.]+)\s*(?:=|IS NOT DISTINCT FROM)\s*$/i;

/**
 * `NOT spalte = ${rahmen}` ist die dritte Schreibweise der Anti-Bindung.
 *
 * `<>` und `!=` waren gesperrt, `NOT … =` bedeutet dasselbe und ging durch
 * (Sicherheitsprüfung 08.09.2026).
 */
const VERNEINT = /\bNOT\s+[\w."]+\s*(?:=|IS NOT DISTINCT FROM)\s*$/i;

/**
 * Der Name eines Parameters, soweit er einfach dasteht.
 *
 * @param {any} p
 * @returns {string | null}
 */
function parametername(p) {
	return p && p.name && ts.isIdentifier(p.name) ? p.name.text : null;
}

/**
 * Sieht der Name nach einer Kennung aus?
 *
 * **Die Mehrzahl gehört dazu, und `kennung` auch** (Code-Review 08.09.2026).
 * Die erste Fassung prüfte nur `^id$` und `Id$` und übersah damit
 * `traktandumIds`, `parteiIds`, `kennungen` — ausgerechnet die Form, die aus
 * `daten.getAll('partei')` kommt und deshalb am ehesten eine fremde Kennung
 * trägt.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function istKennungsname(name) {
	return /(^id$|^kennungen?$|Ids?$)/.test(name) && !KEINE_KENNUNG.has(name);
}

/**
 * Alle Funktionsdeklarationen einer Datei, nach Namen.
 *
 * @param {any} baum
 * @returns {Map<string, any>}
 */
function funktionen(baum) {
	/** @type {Map<string, any>} */
	const raus = new Map();
	/** @param {any} k */
	const besuche = (k) => {
		if ((ts.isFunctionDeclaration(k) || ts.isMethodDeclaration(k)) && k.name && ts.isIdentifier(k.name)) {
			if (!raus.has(k.name.text)) raus.set(k.name.text, k);
		}
		if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.initializer) {
			if (ts.isArrowFunction(k.initializer) || ts.isFunctionExpression(k.initializer)) {
				if (!raus.has(k.name.text)) raus.set(k.name.text, k.initializer);
			}
		}
		ts.forEachChild(k, besuche);
	};
	besuche(baum);
	return raus;
}

/**
 * Welcher Name kommt aus welchem Modul?
 *
 * `import { pruefeReglementsregelGehoert } from './zugehoerigkeit'` →
 * `pruefeReglementsregelGehoert → './zugehoerigkeit'`. Ohne diese Karte endete
 * die Regel an der Dateigrenze, und `reglement.ts` galt als ungebunden, obwohl
 * es die Musterprüfung aus `zugehoerigkeit.ts` aufruft (gemessen 08.09.2026).
 *
 * @param {any} baum
 * @returns {Map<string, {woher: string, echterName: string}>}
 */
function eingefuehrt(baum) {
	/** @type {Map<string, {woher: string, echterName: string}>} */
	const raus = new Map();
	for (const anweisung of baum.statements ?? []) {
		if (!ts.isImportDeclaration(anweisung)) continue;
		if (!ts.isStringLiteral(anweisung.moduleSpecifier)) continue;
		const woher = anweisung.moduleSpecifier.text;
		const binder = anweisung.importClause?.namedBindings;
		if (binder && ts.isNamedImports(binder)) {
			for (const e of binder.elements) {
				// **Der Alias führt auf den echten Namen zurück.** `import { echt as
				// alias }` legte sonst `alias` ab, und im Zielmodul suchte der
				// Wächter dann eine gleichnamige innere Funktion (Code-Review
				// 08.09.2026).
				raus.set(e.name.text, { woher, echterName: (e.propertyName ?? e.name).text });
			}
		}
	}
	return raus;
}

/**
 * Die exportierte Funktion dieses Namens auf **oberster** Ebene.
 *
 * `funktionen()` sammelt jede gleichnamige Deklaration im ganzen Baum, auch
 * eine innere und eine nicht exportierte. Über die Dateigrenze ist das eine
 * Lücke: Nur was das Modul ausgibt, kann von aussen gerufen worden sein.
 *
 * @param {any} baum
 * @param {string} name
 * @returns {any}
 */
function obersteExportierte(baum, name) {
	for (const anweisung of baum.statements ?? []) {
		if (
			ts.isFunctionDeclaration(anweisung) &&
			anweisung.name?.text === name &&
			anweisung.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
		) {
			return anweisung;
		}
	}
	return null;
}

/**
 * Wird dieser Name im Rumpf neu gebunden **oder überschrieben**?
 *
 * Zwei Wege, und beide sind gemessen:
 *
 *   - **Verschattet.** Eine Schleife `for (const id of andere)` bindet den
 *     Namen neu, und die Abfrage darin meint etwas anderes als das, was
 *     hereingereicht wurde.
 *   - **Überschrieben.** `meetingId = z.meeting_id` aus der gerade gelesenen
 *     Zeile: Danach vergleicht `WHERE id = ${id} AND meeting_id = ${meetingId}`
 *     den Wert mit sich selbst — eine Prüfung, die nicht scheitern kann. Die
 *     erste Fassung dieser Funktion sah nur Deklarationen und liess das durch
 *     (Code-Review 08.09.2026); dieselbe Klasse steht in `anhaenge.ts` als
 *     behobener Fehler.
 *
 * Den Geltungsbereich sauber zu verfolgen wäre ein eigener Umbau; solange das
 * nicht dasteht, gilt der vorsichtige Weg: neu gebunden heisst offen.
 *
 * @param {any} rumpf
 * @param {string} name
 * @returns {boolean}
 */
function verschattet(rumpf, name) {
	let ja = false;
	/** @param {any} k */
	const besuche = (k) => {
		if (ja) return;
		if ((ts.isVariableDeclaration(k) || ts.isParameter(k) || ts.isBindingElement(k)) && k.name) {
			if (ts.isIdentifier(k.name) && k.name.text === name) ja = true;
		}
		if (
			ts.isBinaryExpression(k) &&
			ts.isIdentifier(k.left) &&
			k.left.text === name &&
			k.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
			k.operatorToken.kind <= ts.SyntaxKind.LastAssignment
		) {
			ja = true;
		}
		ts.forEachChild(k, besuche);
	};
	besuche(rumpf);
	return ja;
}

/** Die Öffnungsmarke eines Dollar-Literals: `$$` oder `$tag$`. */
const DOLLARMARKE = /^\$[A-Za-z_]*\$/;

/**
 * Alles durch Leerraum ersetzen, was Text ist statt Struktur.
 *
 * **Vier Bauformen, alle aus den Sicherheitsprüfungen vom 08.09.2026**, und
 * jede hat die Regel falsch grün gemacht:
 *
 *   - `'…'` — ein `WHERE` in einem Textwert verschob den Ausschnitt.
 *   - `-- …` und `/* … *\/` — eine auskommentierte Bindung zählte mit. Das ist
 *     der wahrscheinlichste Rückschritt überhaupt, weil genau so jemand eine
 *     Bindung zum Fehlersuchen stilllegt. Postgres **verschachtelt**
 *     Blockkommentare; die erste Fassung nahm das erste `*\/` und liess damit
 *     denselben Fall wieder durch.
 *   - `$$ … $$` und `$tag$ … $tag$` — Dollar-Quoting ist ebenfalls Text.
 *   - `"…"` — ein Bezeichner in Anführungszeichen. `"where"` startete den
 *     Ausschnitt, und ein Apostroph darin (`"a'b"`) öffnete ein Literal, das
 *     bis zum Textende lief und ein ODER verschluckte.
 *
 * Ersetzt wird durch Leerzeichen gleicher Länge, damit die Stellen erhalten
 * bleiben. Ein Bezeichner in Anführungszeichen verliert dabei seinen Namen und
 * gilt danach nicht mehr als Vergleich — die vorsichtige Richtung.
 *
 * @param {string} sql
 * @returns {string}
 */
function ohneLiteraleUndKommentare(sql) {
	let raus = '';
	for (let i = 0; i < sql.length; ) {
		const z = sql[i];
		if (z === "'" || z === '"') {
			const schluss = z;
			raus += ' ';
			i += 1;
			while (i < sql.length) {
				if (sql[i] === schluss && sql[i + 1] === schluss) {
					raus += '  ';
					i += 2;
					continue;
				}
				if (sql[i] === schluss) break;
				raus += ' ';
				i += 1;
			}
			if (i < sql.length) {
				raus += ' ';
				i += 1;
			}
		} else if (z === '$' && DOLLARMARKE.test(sql.slice(i))) {
			// Einmal auswerten, nicht zweimal: `exec` nach `test` ist für den
			// Typlauf ausserdem ein möglicher Nullwert.
			const treffer = DOLLARMARKE.exec(sql.slice(i));
			const marke = treffer ? treffer[0] : '$';
			const ende = sql.indexOf(marke, i + marke.length);
			const bis = ende === -1 ? sql.length : ende + marke.length;
			raus += ' '.repeat(bis - i);
			i = bis;
		} else if (z === '-' && sql[i + 1] === '-') {
			while (i < sql.length && sql[i] !== '\n') {
				raus += ' ';
				i += 1;
			}
		} else if (z === '/' && sql[i + 1] === '*') {
			// Verschachtelt zählen, wie Postgres es tut.
			let tiefe = 0;
			const anfang = i;
			while (i < sql.length) {
				if (sql[i] === '/' && sql[i + 1] === '*') {
					tiefe += 1;
					i += 2;
				} else if (sql[i] === '*' && sql[i + 1] === '/') {
					tiefe -= 1;
					i += 2;
					if (tiefe === 0) break;
				} else i += 1;
			}
			raus += ' '.repeat(i - anfang);
		} else {
			raus += z;
			i += 1;
		}
	}
	return raus;
}

/** Klauseln, die nach der Bedingung stehen und selbst nichts einschränken. */
const KLAUSELENDE =
	/\b(?:GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|UNION|EXCEPT|INTERSECT|RETURNING|FOR\s+UPDATE)\b|;/i;

/**
 * Der Teil einer Abfrage, der einschränkt.
 *
 * **Das `WHERE` der äusseren Anweisung**, nicht das erste im Text: Ein
 * `WITH rahmen AS (SELECT … WHERE id = ${meetingId}) DELETE … WHERE id =
 * ${id}` band sonst über den Hilfsblock, während der `DELETE` jede Zeile traf.
 * Diese Bauform steht viermal im Bestand (Sicherheitsprüfung 08.09.2026).
 *
 * **Und nur bis zur nächsten Klauselgrenze.** `ORDER BY meeting_id =
 * ${meetingId}` schränkt nichts ein und kommt im Bestand 128-mal vor; dasselbe
 * gilt für `HAVING` und für den zweiten Zweig eines `UNION`.
 *
 * @param {string} rohSql
 * @returns {string | null}
 */
function wherteil(rohSql) {
	const sql = ohneLiteraleUndKommentare(rohSql);
	let tiefe = 0;
	let start = -1;
	for (let i = 0; i < sql.length; i += 1) {
		const z = sql[i];
		if (z === '(') tiefe += 1;
		else if (z === ')') tiefe -= 1;
		else if (tiefe === 0 && /^where\b/i.test(sql.slice(i)) && !/[\w.]/.test(sql[i - 1] ?? ' ')) {
			start = i + 5;
			break;
		}
	}
	if (start === -1) return null;
	const rest = sql.slice(start);
	// Die Klauselgrenze zählt nur auf oberster Ebene: `LIMIT` in einer
	// Unterabfrage beendet die äussere Bedingung nicht.
	tiefe = 0;
	for (let i = 0; i < rest.length; i += 1) {
		const z = rest[i];
		if (z === '(') tiefe += 1;
		else if (z === ')') tiefe -= 1;
		else if (tiefe === 0) {
			const m = KLAUSELENDE.exec(rest.slice(i));
			if (m && m.index === 0 && !/[\w.]/.test(rest[i - 1] ?? ' ')) return rest.slice(0, i);
		}
	}
	return rest;
}

/**
 * Die Platzhalter, die in dieser Bedingung auf **oberster** Ebene verglichen
 * werden, samt dem Alias der Spalte, gegen die verglichen wird.
 *
 * Die Ebene trennt drei Dinge ab, die nichts einschränken: die Unterabfrage in
 * Klammern, das `CASE … END` (auch ohne Klammern) und den Zweig hinter einem
 * ODER. Der Alias entscheidet danach, ob beide Vergleiche **dieselbe Zeile**
 * betreffen — ohne ihn galt ein Kreuzprodukt als Bindung
 * (Sicherheitsprüfung 08.09.2026).
 *
 * @param {string} rohBedingung Text mit Platzhaltern der Form `⟪n⟫`.
 * @returns {Map<number, string> | null} `null`, wenn die Bedingung wertlos ist.
 */
function verglichenObenauf(rohBedingung) {
	/*
	 * **Die Mengenbedingung ist eine Bedingung** (Code-Review 08.09.2026).
	 * `id = ANY(⟪0⟫)` und `id IN (⟪0⟫)` schränken die Zeile genauso ein wie
	 * `id = ⟪0⟫`; die Klammer machte sie für die Tiefenzählung aber unsichtbar,
	 * und `holeVersandanschriften` galt als ungebunden, obwohl es
	 * `WHERE stweg_id = ${stwegId} AND id = ANY(${parteiIds})` schreibt. Die
	 * Klammern gehören zur Schreibweise, nicht zur Verschachtelung.
	 */
	const bedingung = rohBedingung
		.replace(/=\s*ANY\s*\(\s*(⟪\d+⟫)\s*\)/gi, '= $1')
		.replace(/\bIN\s*\(\s*(⟪\d+⟫)\s*\)/gi, '= $1');
	/** @type {Map<number, string>} */
	const raus = new Map();

	// **Eine negative Klammerbilanz verwirft die Bedingung.** Sie auf null zu
	// klemmen liess die äussere Anweisung nach einem geschlossenen Hilfsblock
	// wieder als oberste Ebene gelten (Sicherheitsprüfung 08.09.2026).
	let tiefe = 0;
	for (let i = 0; i < bedingung.length; i += 1) {
		const z = bedingung[i];
		if (z === '(') tiefe += 1;
		else if (z === ')') {
			tiefe -= 1;
			if (tiefe < 0) return null;
		} else if (tiefe === 0 && /^or\b/i.test(bedingung.slice(i)) && !/[\w.]/.test(bedingung[i - 1] ?? ' ')) {
			// Ein ODER auf oberster Ebene macht jede Einschränkung wahlweise.
			return null;
		}
	}

	tiefe = 0;
	let zuletzt = 0;
	const marke = /⟪(\d+)⟫/g;
	let m;
	while ((m = marke.exec(bedingung))) {
		for (let i = zuletzt; i < m.index; i += 1) {
			const z = bedingung[i];
			if (z === '(') tiefe += 1;
			else if (z === ')') tiefe -= 1;
			else if (/^case\b/i.test(bedingung.slice(i)) && !/[\w.]/.test(bedingung[i - 1] ?? ' ')) tiefe += 1;
			else if (/^end\b/i.test(bedingung.slice(i)) && !/[\w.]/.test(bedingung[i - 1] ?? ' ')) tiefe -= 1;
		}
		zuletzt = m.index + m[0].length;
		if (tiefe !== 0) continue;
		const davor = bedingung.slice(0, m.index);
		const v = VERGLEICH.exec(davor);
		if (v && !VERNEINT.test(davor)) {
			const spalte = v[1];
			raus.set(Number(m[1]), spalte.includes('.') ? spalte.split('.')[0].toLowerCase() : '');
		}
	}
	return raus;
}

/**
 * Verbindet ein Prädikat die beiden Aliasse, gegen die verglichen wurde?
 *
 * **Ohne diese Frage ist ein Kreuzprodukt eine Bindung.** Gemessen am
 * 08.09.2026 in `vorlagen.ts:527`: `FROM agenda_item_affected b, meeting m
 * WHERE b.agenda_item_id = ${quelleId} AND m.id = ${meetingId}` vergleicht
 * beide Werte auf oberster Ebene — aber gegen zwei verschiedene Zeilen. Der
 * zweite Vergleich sagt nur, dass es die eigene Versammlung gibt.
 *
 * Ein `JOIN … ON m.id = a.meeting_id` dagegen verbindet sie wirklich; deshalb
 * wird nicht die Gleichheit der Aliasse verlangt, sondern ein Weg zwischen
 * ihnen über Spalte-gegen-Spalte-Prädikate der ganzen Anweisung.
 *
 * @param {string} sql Die Anweisung, ohne Literale und Kommentare.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function aliasseVerbunden(sql, a, b) {
	if (a === b) return true;
	// Ein Vergleich ohne Alias meint die einzige Quelle; steht daneben ein
	// zweiter Alias, ist die Zuordnung offen — die vorsichtige Richtung.
	if (a === '' || b === '') return false;
	/** @type {Map<string, string>} */
	const vater = new Map();
	/** @param {string} x */
	const finde = (x) => {
		while (vater.get(x) && vater.get(x) !== x) x = /** @type {string} */ (vater.get(x));
		return x;
	};
	/** @param {string} x @param {string} y */
	const eine = (x, y) => {
		if (!vater.has(x)) vater.set(x, x);
		if (!vater.has(y)) vater.set(y, y);
		vater.set(finde(x), finde(y));
	};
	for (const m of sql.matchAll(/([A-Za-z_]\w*)\.\w+\s*=\s*([A-Za-z_]\w*)\.\w+/g)) {
		eine(m[1].toLowerCase(), m[2].toLowerCase());
	}
	if (!vater.has(a) || !vater.has(b)) return false;
	return finde(a) === finde(b);
}

/**
 * Steht in dieser Vorlage eine Bedingung, die BEIDE Werte einschränkt?
 *
 * @param {any} vorlage
 * @param {string} rahmen
 * @param {string} kennung
 * @returns {boolean}
 */
function abfrageBindet(vorlage, rahmen, kennung) {
	const stuecke = [vorlage.head.text, ...vorlage.templateSpans.map((/** @type {any} */ s) => s.literal.text)];
	let sql = stuecke[0];
	/** @type {(string | null)[]} */
	const werte = [];
	vorlage.templateSpans.forEach((/** @type {any} */ span, /** @type {number} */ i) => {
		// **Nur ein blosser Bezeichner zählt.** `${daten.meetingId}` ist der
		// Rahmen aus dem Formular und nicht der aus der Adresse.
		werte.push(ts.isIdentifier(span.expression) ? span.expression.text : null);
		sql += `⟪${i}⟫` + stuecke[i + 1];
	});
	const bedingung = wherteil(sql);
	if (bedingung === null) return false;
	const verglichen = verglichenObenauf(bedingung);
	if (verglichen === null) return false;
	const pR = werte.indexOf(rahmen);
	const pK = werte.indexOf(kennung);
	if (pR < 0 || pK < 0 || !verglichen.has(pR) || !verglichen.has(pK)) return false;
	// Beide Vergleiche müssen dieselbe Zeile treffen, nicht nur dieselbe Abfrage.
	return aliasseVerbunden(
		ohneLiteraleUndKommentare(sql),
		/** @type {string} */ (verglichen.get(pR)),
		/** @type {string} */ (verglichen.get(pK))
	);
}

/**
 * Die zweite Bauform: `tx.unsafe('… WHERE id = $1 AND x = $2', [a, b])`.
 *
 * `zugehoerigkeit.ts` bindet so, weil der Tabellenname variabel ist und
 * deshalb keine Vorlage in Frage kommt. Ohne diese Bauform meldete die Regel
 * ausgerechnet die fünf `pruefe…Gehoert` als ungebunden — die Funktionen, deren
 * Aufgabe diese Bindung IST. Ein Wächter, der die Musterlösung anmahnt, wird
 * abgeschaltet.
 *
 * @param {any} aufruf
 * @param {string} rahmen
 * @param {string} kennung
 * @returns {boolean}
 */
function unsafeBindet(aufruf, rahmen, kennung) {
	if (!ts.isPropertyAccessExpression(aufruf.expression)) return false;
	if (aufruf.expression.name.text !== 'unsafe') return false;
	const [text, werte] = aufruf.arguments;
	if (!text || !werte || !ts.isArrayLiteralExpression(werte)) return false;

	let sql = '';
	if (ts.isNoSubstitutionTemplateLiteral(text) || ts.isStringLiteral(text)) sql = text.text;
	else if (ts.isTemplateExpression(text)) {
		sql = text.head.text + text.templateSpans.map((/** @type {any} */ sp) => sp.literal.text).join(' ? ');
	} else return false;

	const bedingung = wherteil(sql);
	if (bedingung === null) return false;
	// Die `$n` in dieselbe Markenform bringen, dann gilt dieselbe Prüfung.
	const alsMarken = bedingung.replace(/\$(\d+)/g, (_, n) => `⟪${Number(n) - 1}⟫`);
	const verglichen = verglichenObenauf(alsMarken);
	if (verglichen === null) return false;

	// **Ein Spread verschiebt die Nummern.** `[...vorne, id, meetingId]` bindet
	// `$1` an etwas, das erst zur Laufzeit feststeht (Sicherheitsprüfung
	// 08.09.2026); dann sagt die Stellung nichts.
	if (werte.elements.some((/** @type {any} */ e) => ts.isSpreadElement(e))) return false;

	const namen = werte.elements.map((/** @type {any} */ e) => (ts.isIdentifier(e) ? e.text : null));
	const pR = namen.indexOf(rahmen);
	const pK = namen.indexOf(kennung);
	if (pR < 0 || pK < 0 || !verglichen.has(pR) || !verglichen.has(pK)) return false;
	return aliasseVerbunden(
		ohneLiteraleUndKommentare(sql),
		/** @type {string} */ (verglichen.get(pR)),
		/** @type {string} */ (verglichen.get(pK))
	);
}

/**
 * Prüft eine Funktion und folgt den Helfern, an die sie beide Werte reicht.
 *
 * **Auch über die Dateigrenze**, sofern der Aufrufer einen Lader mitgibt:
 * `reglement.ts` ruft `pruefeReglementsregelGehoert` aus `zugehoerigkeit.ts`,
 * und ohne diesen Schritt verlangte der Wächter dort eine Ausnahmezeile, also
 * eine Behauptung statt einer Messung. Ohne Lader endet der Weg an der Datei
 * und das Feld gilt als offen — die vorsichtige Richtung.
 *
 * @param {{ baum: any, fns: Map<string, any>, importe: Map<string, {woher: string, echterName: string}>, lade: any, dateiname: string }} welt
 * @param {any} fn
 * @param {string} rahmen
 * @param {string} kennung
 * @param {number} tiefe
 * @param {Set<string>} gesehen
 * @param {string[]} weg
 * @returns {{ zeile: number, datei: string, weg: string[] } | null}
 */
function pruefeFunktion(welt, fn, rahmen, kennung, tiefe, gesehen, weg) {
	const { baum, fns } = welt;
	if (!fn?.body) return null;
	/*
	 * **Auch im Helfer, nicht nur am Einstieg** (Code-Review 08.09.2026). Ein
	 * Helfer, der `meetingId = z.meeting_id` aus der gelesenen Zeile setzt und
	 * danach `WHERE id = ${kennung} AND meeting_id = ${meetingId}` schreibt,
	 * vergleicht den Wert mit sich selbst — eine Prüfung, die nicht scheitern
	 * kann. Genau diese Klasse steht in `anhaenge.ts` als behobener Fehler.
	 */
	if (verschattet(fn.body, rahmen) || verschattet(fn.body, kennung)) return null;
	/** @type {{ zeile: number, datei: string, weg: string[] } | null} */
	let treffer = null;

	/** @param {any} k */
	const besuche = (k) => {
		if (treffer) return;

		// 1. Die Abfrage selbst: beide Werte in derselben Bedingung.
		if (ts.isTaggedTemplateExpression(k) && ts.isTemplateExpression(k.template)) {
			if (abfrageBindet(k.template, rahmen, kennung)) {
				const { line } = baum.getLineAndCharacterOfPosition(k.getStart());
				// **Die Datei gehört zur Zeilennummer.** Über die Dateigrenze
				// stammt sie aus dem fremden Baum, und eine Zahl ohne Datei zeigt
				// beim Nachschlagen irgendwohin (Code-Review 08.09.2026).
				treffer = { zeile: line + 1, datei: welt.dateiname, weg: [...weg] };
				return;
			}
		}

		// 2. Dieselbe Aussage als parametrisierte Abfrage.
		if (ts.isCallExpression(k) && unsafeBindet(k, rahmen, kennung)) {
			const { line } = baum.getLineAndCharacterOfPosition(k.getStart());
			treffer = { zeile: line + 1, datei: welt.dateiname, weg: [...weg] };
			return;
		}

		// 3. Ein Helfer, der BEIDE Werte bekommt: ihm folgen.
		if (ts.isCallExpression(k) && tiefe > 0 && ts.isIdentifier(k.expression)) {
			const argNamen = k.arguments.map((/** @type {any} */ a) => (ts.isIdentifier(a) ? a.text : null));
			const iR = argNamen.indexOf(rahmen);
			const iK = argNamen.indexOf(kennung);
			const name = k.expression.text;
			if (iR >= 0 && iK >= 0 && !gesehen.has(name)) {
				/*
				 * **Der Helfer darf woanders wohnen.** `reglement.ts` ruft
				 * `pruefeReglementsregelGehoert` aus `zugehoerigkeit.ts` — die
				 * Musterbindung dieses Repos. Ohne den Schritt über die
				 * Dateigrenze verlangte der Wächter dort eine Ausnahmezeile,
				 * also eine Behauptung statt einer Messung.
				 */
				if (!fns.has(name) && welt.lade && welt.importe.has(name)) {
					const einfuhr = welt.importe.get(name);
					const andere = einfuhr ? welt.lade(einfuhr.woher, welt.dateiname) : null;
					if (andere) {
						const zielFns = funktionen(andere.baum);
						// **Nur was das Zielmodul wirklich ausgibt.** Eine gleichnamige
						// innere Funktion machte sonst eine ungebundene Löschung grün.
						const ziel2 = einfuhr ? obersteExportierte(andere.baum, einfuhr.echterName) : null;
						if (ziel2 && ziel2.parameters.length > Math.max(iR, iK)) {
							const pR2 = parametername(ziel2.parameters[iR]);
							const pK2 = parametername(ziel2.parameters[iK]);
							if (pR2 && pK2) {
								gesehen.add(name);
								const tiefer = pruefeFunktion(
									{ baum: andere.baum, fns: zielFns, importe: eingefuehrt(andere.baum), lade: welt.lade, dateiname: andere.dateiname },
									ziel2,
									pR2,
									pK2,
									tiefe - 1,
									gesehen,
									[...weg, name]
								);
								if (tiefer) {
									treffer = tiefer;
									return;
								}
							}
						}
					}
				}
				const ziel = fns.get(name);
				// **Die Stellen müssen es auch geben.** Trifft der Name eine
				// gleichnamige Funktion mit weniger Parametern, zeigte der Zugriff
				// ins Leere und die Regel stürzte ab (Code-Review 08.09.2026).
				if (ziel && ziel.parameters.length > Math.max(iR, iK)) {
					const pR = parametername(ziel.parameters[iR]);
					const pK = parametername(ziel.parameters[iK]);
					if (pR && pK) {
						gesehen.add(name);
						const tiefer = pruefeFunktion(welt, ziel, pR, pK, tiefe - 1, gesehen, [...weg, name]);
						if (tiefer) {
							treffer = tiefer;
							return;
						}
					}
				}
			}
		}
		ts.forEachChild(k, besuche);
	};
	besuche(fn.body);
	return treffer;
}

/**
 * Die Antwort für eine benannte Funktion eines Moduls.
 *
 * Jede Kennung wird gegen **jeden** Rahmen der Signatur geprüft, nicht nur
 * gegen den ersten: `erhebeAufnahmelage(operatorId, tagId, meetingId)` trägt
 * zwei, und welcher der Rahmen ist, hing sonst an der Reihenfolge der
 * Parameter (Code-Review 08.09.2026).
 *
 * @param {string} quelltext
 * @param {string} dateiname
 * @param {string} fnName
 * @returns {{ gefunden: boolean, rahmen?: string | null, felder: any[] }}
 */
export function bindungen(quelltext, dateiname, fnName, lade = null) {
	const baum = ts.createSourceFile(dateiname, quelltext, ts.ScriptTarget.Latest, true);
	const fns = funktionen(baum);
	const welt = { baum, fns, importe: eingefuehrt(baum), lade, dateiname };
	const fn = fns.get(fnName);
	if (!fn) return { gefunden: false, felder: [] };

	/** @type {string[]} */
	const namen = fn.parameters.map(parametername).filter(Boolean);
	const rahmenNamen = namen.filter((n) => RAHMENNAMEN.includes(n));
	// Ein Rahmenname ist selbst eine Kennung, sobald ein zweiter Rahmen daneben
	// steht — `erhebeAufnahmelage(tagId, meetingId)` fragt genau das.
	const kennungen = namen.filter((n) => istKennungsname(n) && !(rahmenNamen.length < 2 && rahmenNamen.includes(n)));

	return {
		gefunden: true,
		rahmen: rahmenNamen[0] ?? null,
		felder: kennungen.map((kennung) => {
			const moegliche = rahmenNamen.filter((r) => r !== kennung);
			if (moegliche.length === 0) return { kennung, gebunden: false, grund: 'kein Rahmenparameter' };
			if (verschattet(fn.body, kennung)) {
				return { kennung, gebunden: false, grund: `\`${kennung}\` wird im Rumpf neu gebunden` };
			}
			for (const rahmen of moegliche) {
				if (verschattet(fn.body, rahmen)) continue;
				const t = pruefeFunktion(welt, fn, rahmen, kennung, TIEFE, new Set([fnName]), []);
				if (t) return { kennung, gebunden: true, rahmen, zeile: t.zeile, datei: t.datei, weg: t.weg };
			}
			return { kennung, gebunden: false, grund: 'keine Bedingung schränkt mit beiden Werten ein' };
		})
	};
}
