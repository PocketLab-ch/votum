/**
 * KI-Bindungswächter: Wer das Modell fragt, muss wissen, wozu die Kennung gehört.
 *
 * **Dreimal dieselbe Ursache, dreimal einzeln gefunden** (02.09.2026, aus dem
 * Code-Review). Die Schale einer Route prüft, ob die Gemeinschaft der
 * Versammlung **aus der Adresse** die KI zugelassen hat. Die Kennung des
 * Traktandums kommt daneben aus dem Formular oder aus einem zweiten Adressteil
 * — und wurde nicht gegen die erste geprüft:
 *
 * | Weg | gefunden |
 * |---|---|
 * | `pruefeTraktandum` | Sicherheitsdurchgang 01.09.2026 |
 * | `pruefeAntrag` | Code-Review 02.09.2026 (Befund 1b) |
 * | `holeVorschlag` | beim Nachgehen desselben Befundes |
 *
 * Am laufenden System gemessen, zwei Gemeinschaften desselben Betreibers: Unter
 * der eigenen Adresse antwortet die Anwendung mit 400 («Für diese Gemeinschaft
 * ist die KI-Unterstützung nicht zugelassen»), unter der fremden mit 200 und
 * vollem Ergebnis. Die Mandantengrenze hält (RLS), die Zulassung nicht. Es ist
 * ein bezahlter Modellaufruf mit den Inhalten einer Gemeinschaft, die genau das
 * abgelehnt hat.
 *
 * **Die Regel.** Eine exportierte Funktion in `src/lib/server`, deren Datei das
 * Modell fragt und die eine Traktandumskennung entgegennimmt, braucht daneben
 * die Versammlung, zu der es gehören muss.
 *
 * **Warum ein Wächter und nicht drei Korrekturen.** Der vierte Weg entsteht beim
 * nächsten KI-Baustein, und die Stelle sieht dann harmlos aus: Die Schale
 * daneben prüft ja etwas. Genau das war dreimal der Fall.
 *
 * **Gelesen wird mit dem TypeScript-Parser**, nicht mit einer Regex über die
 * Signatur. Die Parameterlisten hier tragen lange Begründungen zwischen den
 * Argumenten; ein Textmuster verliert daran den Faden, und ein Wächter mit
 * Verstecken ist keiner (Erfahrung aus `check-svelte-lesbar`).
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const WURZEL = process.argv[2] ?? process.cwd();

/** Der Aufruf, der Geld kostet und Inhalte hinausgibt. */
const FRAGT = /\bfrage\s*\(/;

/**
 * Kennungen, die für sich nichts über die Zugehörigkeit sagen.
 *
 * `traktandumId` ist die, um die es dreimal ging. `agendaItemId` steht als
 * Schreibweise daneben, damit eine Umbenennung den Wächter nicht abhängt.
 */
const UNGEBUNDEN = ['traktandumId', 'agendaItemId'];

/** Was die Bindung herstellt: die Versammlung, zu der die Kennung gehören muss. */
const BINDEND = ['meetingId', 'versammlungId', 'bindung'];

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
		else if (eintrag.endsWith('.ts')) treffer.push(pfad);
	}
	return treffer;
}

/** Der Name eines Parameters, soweit er einfach dasteht. */
function parametername(p) {
	return ts.isIdentifier(p.name) ? p.name.text : null;
}

const befunde = [];
let geprueft = 0;
let fragende = 0;
let gebunden = 0;

for (const pfad of dateienUnter(join(WURZEL, 'src', 'lib', 'server'))) {
	const kurz = relative(WURZEL, pfad);
	geprueft++;

	const inhalt = readFileSync(pfad, 'utf8');
	// Die Heimat selbst ruft `frage` aus, sie definiert es.
	if (kurz.endsWith('ki.ts')) continue;
	if (!FRAGT.test(inhalt)) continue;
	fragende++;

	const baum = ts.createSourceFile(kurz, inhalt, ts.ScriptTarget.Latest, true);

	const besuche = (knoten) => {
		if (ts.isFunctionDeclaration(knoten) && knoten.name) {
			const exportiert = knoten.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
			if (exportiert) {
				const namen = knoten.parameters.map(parametername).filter(Boolean);
				const nimmtKennung = namen.some((n) => UNGEBUNDEN.includes(n));
				const hatBindung = namen.some((n) => BINDEND.includes(n));
				if (nimmtKennung && !hatBindung) {
					const { line } = baum.getLineAndCharacterOfPosition(knoten.getStart());
					befunde.push(
						`${kurz}:${line + 1}  ${knoten.name.text}(${namen.join(', ')})\n` +
							`  Fragt das Modell und nimmt eine Traktandumskennung, ohne die Versammlung,\n` +
							`  zu der sie gehören muss. Die Schale der Route prüft die KI-Zulassung der\n` +
							`  Gemeinschaft aus der ADRESSE — die Kennung kommt woanders her.\n` +
							`  Ein Pflichtparameter \`meetingId\` und \`AND a.meeting_id = \${meetingId}\`\n` +
							`  in der Abfrage schliessen das.`
					);
				}
				if (nimmtKennung && hatBindung) gebunden++;
			}
		}
		ts.forEachChild(knoten, besuche);
	};
	besuche(baum);
}

if (befunde.length > 0) {
	console.log('\nKI-Bindungswächter: Befunde\n');
	for (const b of befunde) console.log(b + '\n');
	process.exit(1);
}

/*
 * **Die Sichtproben.** Ein Lauf über null Dateien oder über einen Bestand, in
 * dem niemand mehr das Modell fragt, wäre grün und wertlos — dieselbe Klasse,
 * die am 02.09.2026 beim Seitenaufbau-Wächter zugeschlagen hat.
 */
if (geprueft < 20) {
	console.error(`KI-Bindung: nur ${geprueft} Dateien gefunden — der Lauf greift nicht.`);
	process.exit(1);
}
if (fragende === 0) {
	console.error(
		'KI-Bindung: keine einzige Datei ruft `frage`. Entweder gibt es die KI-Wege\n' +
			'nicht mehr, oder dieser Wächter liest den Aufruf nicht mehr.'
	);
	process.exit(1);
}
if (gebunden === 0) {
	console.error(
		'KI-Bindung: keine einzige gebundene Funktion gefunden. Entweder heissen die\n' +
			'Parameter anders, oder dieser Wächter liest die Signaturen nicht mehr —\n' +
			'dann ginge jede ungebundene Stelle still durch.'
	);
	process.exit(1);
}

console.log(
	`KI-Bindung in Ordnung: ${geprueft} Dateien geprüft, ${fragende} fragen das Modell, ` +
		`${gebunden} Wege sind gebunden.`
);
