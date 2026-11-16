/**
 * Wächter: Was der Rechenweg liest, muss den ganzen Weg überstehen.
 *
 * **Der Anlass** (04.09.2026). Eine Reglementsregel «Enthaltungen fallen aus
 * der Bezugsgrösse» war seit dem 15.08.2026 erfassbar, wurde gespeichert und
 * auf der Reglementsseite angezeigt, und **gerechnet wurde sie nie**. Gemessen
 * wurde ein Antrag als abgelehnt verkündet, den die angezeigte Regel annimmt.
 *
 * Das Merkmal hatte fünf Stationen zwischen Regel und Ergebnis. Drei davon
 * bewacht diese Datei, und es sind die drei, an denen ein Feld **still**
 * verschwindet: Der Compiler sieht keine davon, weil alle aus Zeichenketten und
 * Spaltennamen bestehen.
 *
 * ## Erste Frage: Überlebt das Feld das Einfrieren?
 *
 * `oeffneAbstimmung` baut das Erfordernis mit `jsonb_build_object` zusammen und
 * schreibt es an den Durchgang fest. **Dieses JSON ist die einzige Quelle
 * beider Auszählwege.** Fehlt darin ein Feld, das `zaehleAus` liest, sind Kern,
 * Übersetzung und Speicherweg grün, und die Anwendung rechnet trotzdem falsch:
 * Alle drei Ebenen enden **vor** dieser Stelle.
 *
 * Gefunden hat das seinerzeit der Code-Review, nachdem zehn Proben grün waren.
 *
 * ## Zweite Frage: Tragen beide Übersetzungen dieselben Felder?
 *
 * Aus einer Reglementsregel entsteht ein Erfordernis auf zwei Wegen:
 * `wendeReglementAn` (die Regel ersetzt ein hergeleitetes Erfordernis) und
 * `erfordernisAusRegel` (es gibt kein hergeleitetes, heute nur beim
 * Rückkommen). Beide beschreiben dieselbe Übersetzung. Setzt die eine ein Feld
 * und die andere nicht, hängt das Ergebnis davon ab, auf welchem Weg das
 * Traktandum entstanden ist — und das merkt niemand, weil beide Wege für sich
 * plausibel aussehen.
 *
 * ## Dritte Frage: Übersteht das Feld den Leseweg?
 *
 * `erfordernisAusZeile` in `src/lib/server/erfordernisspalten.ts` (bis
 * 07.10.2026 in `traktanden.ts`; verschoben, damit `einladungsmehr.ts` es ohne
 * Ring liest) baut das Erfordernis ein zweites Mal zusammen, aus den Einzelspalten von `agenda_item`. Daran
 * hängt unter anderem die **Auszählmappe für den Ausfall**. Fehlt ein Feld
 * dort, rechnet die Anwendung richtig und das Blatt für den Notfall falsch —
 * und niemand vergleicht die beiden, denn wer die Mappe braucht, hat den
 * Server nicht mehr.
 *
 * ## Was der Wächter nicht kann
 *
 * Er liest Text, keine Typen. Ein Feld, das über eine Hilfsfunktion gelesen
 * wird statt als `e.<feld>`, sieht er nicht. Die Grenze ist bewusst: Ein
 * Wächter, der alles sehen will, meldet auch alles Mögliche und wird
 * abgeschaltet statt gelesen.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = process.argv[2] ?? process.cwd();
/**
 * Liest eine der sechs Dateien, auf denen dieser Wächter steht.
 *
 * Fehlt eine, brach der Lauf bisher mit einem nackten `ENOENT` ab (04.09.2026,
 * gemessen über einem leeren Baum). Rot war er damit zwar, aber aus Versehen
 * und ohne zu sagen, was fehlt. Eine Reissleine, die man lesen kann, ist der
 * Unterschied zwischen «der Wächter greift nicht mehr» und «hier ist ein
 * Absturz».
 */
const lies = (...teile) => {
	try {
		return readFileSync(join(WURZEL, ...teile), 'utf8');
	} catch {
		console.error(
			`\nDer Wächter findet «${join(...teile)}» nicht.\nEr steht auf sechs festen ` +
				'Dateien; fehlt eine davon, kann er nichts mehr prüfen.\nWurde sie verschoben ' +
				'oder umbenannt, gehört dieser Wächter mit umgebaut.\n'
		);
		process.exit(1);
	}
};

/** Die Feldnamen einer `export interface` aus einer Datei. */
function felderVon(text, name) {
	const treffer = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(text);
	if (!treffer) throw new Error(`Schnittstelle ${name} nicht gefunden`);
	return [...treffer[1].matchAll(/^\t([a-zA-Z]+)\??:/gm)].map((m) => m[1]);
}

/** Der Rumpf einer Funktion, von ihrer Signatur bis zur schliessenden Klammer. */
function rumpfVon(text, name) {
	const start = text.indexOf(`export function ${name}(`);
	if (start < 0) throw new Error(`Funktion ${name} nicht gefunden`);
	const ende = text.indexOf('\n}', start);
	// Ohne diese Prüfung gäbe `slice(start, -1)` den Rest der Datei zurück, und
	// die zweite Frage wäre dauerhaft grün (04.09.2026, aus dem Code-Review).
	if (ende < 0) throw new Error(`Funktion ${name} hat kein erkennbares Ende`);
	return text.slice(start, ende);
}

const entscheidbaum = lies('src', 'lib', 'domain', 'entscheidbaum.ts');
const auszaehlung = lies('src', 'lib', 'domain', 'auszaehlung.ts');
const mehrhinweise = lies('src', 'lib', 'domain', 'mehrhinweise.ts');
const abstimmung = lies('src', 'lib', 'server', 'abstimmung.ts');
const reglement = lies('src', 'lib', 'domain', 'reglement.ts');
const erfordernisspalten = lies('src', 'lib', 'server', 'erfordernisspalten.ts');

const befunde = [];

// ── Erste Frage: das eingefrorene Erfordernis ───────────────────────────────

const erfordernisfelder = felderVon(entscheidbaum, 'Erfordernis');

/*
 * Gelesen heisst hier: kommt in `auszaehlung.ts` oder `mehrhinweise.ts` als
 * `e.<feld>` vor. Das ist der Name, den beide Auszählwege und die
 * Mehrheitsvorschau für das Erfordernis verwenden. `mehrhinweise.ts` gehört
 * dazu, weil die Vorschau dort `kopfbasisStreit` aufruft: Bis F4c, B2
 * (05.11.2026) sah dieser Wächter ein Feld nicht, das nur dort gelesen wird
 * (`lesartDesBeschlusses`, Migration 181).
 */
const gelesen = erfordernisfelder.filter((f) =>
	[auszaehlung, mehrhinweise].some((text) => new RegExp(`\\be\\.${f}\\b`).test(text))
);

/*
 * **Reissleine** (04.09.2026, aus dem Code-Review). Wird der Aufrufname in
 * `zaehleAus` umbenannt, findet die Suche nach `e.<feld>` nichts mehr — und ein
 * Wächter mit leerer Prüfmenge ist immer grün. Er bewachte dann nichts und
 * niemand merkte es.
 */
if (gelesen.length === 0) {
	console.error(
		'\nDer Rechenweg liest kein einziges Feld des Erfordernisses als `e.<feld>`.\n' +
			'Das ist unmöglich, also stimmt die Annahme dieses Wächters nicht mehr:\n' +
			'Vermutlich heisst der Parameter in `auszaehlung.ts` nicht mehr `e`.\n' +
			'Dann gehört dieser Wächter mit umgebaut, sonst bewacht er nichts.\n'
	);
	process.exit(1);
}

const jsonAnfang = abstimmung.indexOf('jsonb_build_object(\n');
const jsonEnde = abstimmung.indexOf(') END AS erfordernis', jsonAnfang);
if (jsonAnfang < 0 || jsonEnde < 0) {
	console.error(
		'\nDas eingefrorene Erfordernis ist nicht auffindbar: In `abstimmung.ts` fehlt der\n' +
			'`jsonb_build_object`-Block mit `) END AS erfordernis`. Wurde er umgebaut, gehört\n' +
			'dieser Wächter mit umgebaut — sonst bewacht er nichts.\n'
	);
	process.exit(1);
}
const eingefroren = new Set(
	[...abstimmung.slice(jsonAnfang, jsonEnde).matchAll(/'([a-zA-Z]+)',/g)].map((m) => m[1])
);

for (const feld of gelesen) {
	if (!eingefroren.has(feld)) {
		befunde.push(
			`\`${feld}\` wird im Rechenweg gelesen (\`zaehleAus\` oder Vorschau), steht aber nicht im eingefrorenen\n` +
				'      Erfordernis (`oeffneAbstimmung` in `src/lib/server/abstimmung.ts`).\n' +
				'      Die Auszählung sieht dort `undefined` und rechnet ohne das Merkmal.'
		);
	}
}

// ── Dritte Frage: der Leseweg aus den Einzelspalten ────────────────────────

/*
 * `erfordernisAusZeile` setzt jedes Feld ausdrücklich; ein fehlendes fällt
 * deshalb nicht auf, sondern kommt still als `undefined` zurück. An diesem Weg
 * hängt die Auszählmappe für den Ausfall.
 */
const leseweg = (() => {
	const start = erfordernisspalten.indexOf('function erfordernisAusZeile(');
	if (start < 0) return null;
	const ende = erfordernisspalten.indexOf('\n}', start);
	return ende < 0 ? null : erfordernisspalten.slice(start, ende);
})();

if (leseweg === null) {
	console.error(
		'\n`erfordernisAusZeile` ist in `src/lib/server/erfordernisspalten.ts` nicht auffindbar.\n' +
			'Wurde der Leseweg umgebaut, gehört dieser Wächter mit umgebaut.\n'
	);
	process.exit(1);
}

for (const feld of gelesen) {
	if (!new RegExp(`(^|\\W)${feld}:`, 'm').test(leseweg)) {
		befunde.push(
			`\`${feld}\` wird im Rechenweg gelesen (\`zaehleAus\` oder Vorschau), steht aber nicht in\n` +
				'      `erfordernisAusZeile` (`src/lib/server/erfordernisspalten.ts`).\n' +
				'      An diesem Leseweg hängt die Auszählmappe für den Ausfall: Die Anwendung\n' +
				'      rechnete dann richtig und das Blatt für den Notfall falsch.'
		);
	}
}

// ── Zweite Frage: die zwei Übersetzungen aus einer Regel ────────────────────

const wende = rumpfVon(reglement, 'wendeReglementAn');
const ausRegel = rumpfVon(reglement, 'erfordernisAusRegel');

/*
 * Verglichen wird, welche **Regelfelder** jede der beiden Übersetzungen liest
 * (`regel.<feld>`). `erfordernisAusRegel` baut ein vollständiges Erfordernis
 * und ist damit die reichere Seite; was sie aus der Regel nimmt, muss auch der
 * andere Weg nehmen.
 *
 * `stwegId`, `geschaeftsart` und `knotenId` sind Zuordnung, keine Rechenwerte,
 * und stehen deshalb in der Ausnahme: `wendeReglementAn` bekommt sie über das
 * hergeleitete Erfordernis, das es ergänzt statt neu zu bauen.
 */
const ZUORDNUNG = ['stwegId', 'geschaeftsart', 'knotenId', 'id'];
const regelfelder = felderVon(reglement, 'ReglementsregelEingabe');

for (const feld of regelfelder) {
	if (ZUORDNUNG.includes(feld)) continue;
	const inAusRegel = new RegExp(`\\bregel\\.${feld}\\b`).test(ausRegel);
	const inWende = new RegExp(`\\bregel\\.${feld}\\b`).test(wende);
	/*
	 * **Beide Richtungen** (04.09.2026, aus dem Code-Review). Die erste Fassung
	 * meldete nur, wenn `wendeReglementAn` etwas ausliess. Fehlte es umgekehrt in
	 * `erfordernisAusRegel`, rechnete der Rückkommensweg gegen die angezeigte
	 * Regel, und der Wächter schwieg.
	 */
	if (inAusRegel !== inWende) {
		const hat = inAusRegel ? 'erfordernisAusRegel' : 'wendeReglementAn';
		const fehlt = inAusRegel ? 'wendeReglementAn' : 'erfordernisAusRegel';
		befunde.push(
			`\`${feld}\` steht in \`${hat}\`, aber nicht in \`${fehlt}\`.\n` +
				'      Beide übersetzen dieselbe Regel in ein Erfordernis; das Ergebnis hinge\n' +
				'      sonst davon ab, auf welchem Weg das Traktandum entstanden ist.'
		);
	}
}

if (befunde.length > 0) {
	const eins = befunde.length === 1;
	console.error(`\n${befunde.length} Feld${eins ? '' : 'er'} auf halbem Weg:\n`);
	for (const b of befunde) console.error(`  · ${b}\n`);
	console.error(
		'Was der Rechenweg liest, muss den ganzen Weg überstehen: von der Regel über\n' +
			'das Erfordernis bis in das JSON, das beim Öffnen der Abstimmung eingefroren\n' +
			'wird. Der Compiler sieht keine dieser Stationen, weil beide aus\n' +
			'Zeichenketten bestehen.\n'
	);
	process.exit(1);
}

console.log(
	`Erfordernisweg in Ordnung: ${gelesen.length} gelesene Felder überstehen Leseweg und ` +
		'Einfrieren, beide Übersetzungen tragen dieselben Regelfelder.'
);
