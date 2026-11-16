/**
 * Vertretungsgrundwächter: Wer `erfasseInTx` erreicht, reicht den Grund durch.
 *
 * **Der Anlass war ein Befund an der eigenen Arbeit** (24.09.2026,
 * Sicherheitsprüfung zu Ä-28). Die Vollmacht hat seit Migration 120 ein Feld
 * `vertretungsgrund` mit drei festen Werten; wer einen davon trägt, zählt nicht
 * zur Höchstzahl des Reglements (Organvertreter juristischer Personen,
 * gesetzliche Vertreter, Mitberechtigte). Die beiden Einlassfunktionen in
 * `server/anwesenheit.ts` nahmen den Wert entgegen und reichten ihn weiter —
 * **aber keine Route gab ihn ihnen.** Der Parameter war tot, der Kommentar
 * daneben behauptete das Gegenteil, und am Einlasstisch lief eine gesetzliche
 * Vertretung in die Sperre.
 *
 * **Warum die Proben das nicht gefunden haben.** Sie rufen die Serverfunktion
 * unmittelbar auf und reichen den Wert dabei selbst mit. Damit messen sie die
 * Funktion, nicht den Weg, auf dem sie im Betrieb erreicht wird. Genau diese
 * Lücke schliesst ein Wächter besser als eine weitere Probe: Er liest den
 * Aufrufweg, und der ist Text.
 *
 * **Was er verlangt.** Jede Datei unter `src/routes/`, die eine der bewachten
 * Funktionen aufruft, nennt im selben Aufruf `vertretungsgrund`. Ausgenommen
 * ist, wer eine Zeile `kein-vertretungsgrund: <Begründung>` im Kommentar über
 * dem Aufruf trägt — eine Ausnahme ohne Begründung zählt nicht.
 *
 * **Was er NICHT kann.** Er liest Text, keinen Datenfluss. Wer den Wert nennt
 * und `null` hineinschreibt, kommt durch. Dagegen hilft der Code-Review, nicht
 * ein zweiter Wächter.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * **Zwei Wurzeln, und die zweite war der Befund** (24.09.2026, Code-Review).
 * Die erste Fassung las nur `src/routes/` und blieb grün, während
 * `src/lib/server/einlassaktionen.ts` — die geteilte Aktion, die auch das
 * Saalgerät bedient — den Grund nicht durchreichte. Ein Wächter, der den
 * halben Baum liest, bewacht die halbe Wahrheit.
 */
const WURZELN = ['src/routes', 'src/lib/server'];
const BEWACHT = ['lasseEinMitVertretungen', 'lasseDurchDritteEin', 'erfasseVollmachten'];

function dateien(pfad) {
	const aus = [];
	// Fehlt die Wurzel, ist das kein Absturz, sondern ein Befund: Die Zählung
	// unten bleibt bei null und meldet es mit einem Satz. Ein Stapelabzug sähe
	// aus wie ein kaputtes Werkzeug und nicht wie eine Warnung.
	if (!existsSync(pfad)) return aus;
	for (const eintrag of readdirSync(pfad)) {
		const voll = join(pfad, eintrag);
		if (statSync(voll).isDirectory()) aus.push(...dateien(voll));
		else if (voll.endsWith('.ts')) aus.push(voll);
	}
	return aus;
}

const befunde = [];
let aufrufeGeprueft = 0;
let ausgenommen = 0;

for (const datei of WURZELN.flatMap(dateien)) {
	const inhalt = readFileSync(datei, 'utf8');
	const zeilen = inhalt.split('\n');

	for (const name of BEWACHT) {
		// Nur der Aufruf zählt, nicht die Importzeile: Ein Import ohne Aufruf
		// war der Grund, aus dem ein früherer Wächter grün blieb, nachdem der
		// Aufruf verschwunden war.
		for (let i = 0; i < zeilen.length; i++) {
			if (!zeilen[i].includes(`${name}(`)) continue;
			if (/^\s*(import|\*|\/\/)/.test(zeilen[i])) continue;
			// Die Definition ist kein Aufruf. Ohne das meldete der Wächter
			// `anwesenheit.ts` selbst, also die Stelle, die den Wert entgegennimmt.
			if (/export\s+async\s+function/.test(zeilen[i])) continue;
			aufrufeGeprueft++;

			// Der Aufruf endet beim ersten `});` auf gleicher oder geringerer Tiefe.
			const block = zeilen.slice(i, i + 40).join('\n');
			const ende = block.indexOf('});');
			const rumpf = ende === -1 ? block : block.slice(0, ende);

			const vorlauf = zeilen.slice(Math.max(0, i - 12), i).join('\n');
			const ausnahme = /kein-vertretungsgrund:\s*\S+/.exec(vorlauf);

			if (rumpf.includes('vertretungsgrund')) continue;
			if (ausnahme) {
				ausgenommen++;
				continue;
			}
			befunde.push(`${datei}:${i + 1} — ${name}() ohne vertretungsgrund`);
		}
	}
}

/*
 * **Ein Wächter, der nichts findet, ist nicht grün, sondern blind.** Genau das
 * hat `tests/waechter/reissleine.test.ts` an der ersten Fassung gemessen: Aus
 * einem leeren Arbeitsverzeichnis meldete sie «0 Aufrufe geprüft» und gab 0
 * zurück. Wer die Datei verschiebt oder die Funktionen umbenennt, bekäme
 * dieselbe Meldung — und hielte sie für eine Entwarnung.
 */
if (aufrufeGeprueft === 0) {
	console.error(
		'Vertretungsgrund: kein einziger Aufruf gefunden. Entweder stimmen die Wurzeln ' +
			`(${WURZELN.join(', ')}) nicht mehr, oder die bewachten Namen (${BEWACHT.join(', ')}) ` +
			'heissen anders. Ein Wächter ohne Fundstelle bewacht nichts.'
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.error('Vertretungsgrund: Aufrufe, die den Grund nicht durchreichen.\n');
	for (const b of befunde) console.error(`  · ${b}`);
	console.error(
		'\nWarum das zählt: Das Feld ist an der Eingabe freiwillig. Wer es hier weglässt,\n' +
			'bekommt still «gewöhnliche Vollmacht», und eine gesetzliche Vertretung läuft in\n' +
			'die Sperre der Höchstzahl — bei grüner Typprüfung und grünen Proben, weil die\n' +
			'den Aufrufweg nicht messen (Ä-28, 24.09.2026).'
	);
	process.exit(1);
}

console.log(
	`Vertretungsgrund in Ordnung: ${aufrufeGeprueft} Aufrufe geprüft, ` +
		`${ausgenommen} über eine begründete Ausnahme.`
);
