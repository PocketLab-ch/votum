/**
 * Archivsichtwächter: Ein Leseweg, der archivieren kann, hat **keine Vorgabe**.
 *
 * **Der Anlass, am 25.08.2026.** Der Archivblock gab den Lesefunktionen einen
 * Parameter `sicht: Sicht = 'aktiv'`. Die Vorgabe wirkte wie eine Bequemlichkeit
 * und war eine stille Entscheidung für sechzehn Aufrufer, die niemand mehr
 * ansah. Dreimal traf sie das Falsche, und jedes Mal fiel es erst im Review auf:
 *
 *   - **Die Elternauswahl** (`gemeinschaften/[id]/angaben`) verlor die
 *     archivierte Klammer. Damit war im Auswahlfeld nichts angekreuzt, der
 *     Browser nahm die erste Möglichkeit («Nein, sie steht für sich»), und das
 *     nächste Speichern einer beliebigen Angabe löste das Haus aus der MEG.
 *   - **Die Doppelprüfung** beim Anlegen einer Versammlung sah die archivierte
 *     Erstversammlung nicht mehr — eine zweite liess sich anlegen.
 *   - **Der Einlass** verlor die archivierte Person aus «Ohne Karte einlassen».
 *     Ihre Stimme zählte weiter; einlassen liess sie sich nicht mehr.
 *
 * Der Übersetzer ist der eigentliche Wächter: Ohne Vorgabe **muss** jeder
 * Aufrufer `'aktiv'` oder `'alle'` hinschreiben, und beim Hinschreiben denkt man
 * darüber nach. Dieses Skript hält bloss fest, dass die Vorgabe nicht
 * zurückkommt — sie einzusetzen wäre eine Zeile, und alle sechzehn
 * Entscheidungen wären wieder unsichtbar.
 *
 * **Was er NICHT tut:** vorschreiben, welche Sicht richtig ist. Das hängt vom
 * Zweck ab — Auswahllisten filtern, Nachschlagen und Prüfungen nie.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = join(process.cwd(), 'src', 'lib', 'server');

function dateien(verzeichnis) {
	const raus = [];
	/*
	 * Ein fehlendes Verzeichnis gab bisher einen nackten ENOENT, also einen
	 * Abbruch aus Versehen statt einer Meldung (04.09.2026, aus dem
	 * Code-Review). Das leere Feld reicht die Entscheidung an die Reissleine
	 * weiter, die sagen kann, was fehlt.
	 */
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return raus;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
		else if (pfad.endsWith('.ts')) raus.push(pfad);
	}
	return raus;
}

/** Kommentare weg, sonst zählt ein Beispielblock mit (dieselbe Falle wie bei check-aufraeumen). */
function ohneKommentare(text) {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const befunde = [];
let geprueft = 0;

for (const pfad of mindestens(dateien(WURZEL), 60, 'Dateien unter der Wurzel')) {
	const roh = readFileSync(pfad, 'utf8');
	const text = ohneKommentare(roh);

	/*
	 * `sicht: Sicht` in einer Parameterliste — mit oder ohne Vorgabe.
	 *
	 * **Beide Lücken der ersten Fassung sind hier geschlossen** (25.08.2026,
	 * zweite Reviewrunde):
	 *
	 *   - `= "aktiv"` mit **doppelten** Anführungszeichen rutschte durch. Das ist
	 *     nicht theoretisch: Das Repo hat kein Prettier, und `check:code` ist
	 *     ESLint ohne `quotes`-Regel. Deshalb wird jetzt alles bis zum Komma oder
	 *     zur schliessenden Klammer als Vorgabe gewertet — auch eine Konstante.
	 *   - `sicht?: Sicht` wurde gar nicht erst gezählt. Optional ist aber genauso
	 *     gefährlich wie eine Vorgabe: `undefined !== 'aktiv'`, also fiele jede
	 *     Abfrage stumm auf `'alle'` zurück und zeigte Archiviertes überall.
	 */
	for (const treffer of text.matchAll(/\bsicht\s*(\??)\s*:\s*Sicht\s*(=\s*[^,)]+)?/g)) {
		geprueft += 1;
		const optional = treffer[1] === '?';
		const vorgabe = treffer[2]?.replace(/^=\s*/, '').trim();
		if (!optional && !vorgabe) continue;
		const zeile = text.slice(0, treffer.index).split('\n').length;
		const ort = `${pfad.replace(process.cwd() + '/', '')}:${zeile}`;
		befunde.push(
			optional
				? `${ort} — \`sicht?: Sicht\` ist optional. Ohne Angabe ist der Wert ` +
						'`undefined`, und jede Abfrage fällt stumm auf «alle» zurück: ' +
						'Archiviertes stünde überall. Fragezeichen streichen.'
				: `${ort} — \`sicht: Sicht = ${vorgabe}\` entscheidet still für jeden ` +
						'Aufrufer. Vorgabe streichen; jeder Aufrufer nennt seine Sicht selbst.'
		);
	}
}

// Ein Wächter, der nichts findet, weil er am falschen Ort sucht, ist immer grün.
if (geprueft === 0) {
	console.error(
		'Archivsichtwächter: kein einziger `sicht: Sicht`-Parameter gefunden. ' +
			'Entweder heisst der Parameter jetzt anders, oder das Verzeichnis stimmt nicht — ' +
			'so geprüft wäre der Wächter wirkungslos.'
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.error('Archivsichtwächter: Vorgabe gefunden, wo eine Entscheidung hingehört.\n');
	for (const b of befunde) console.error(`  · ${b}`);
	console.error(
		'\nWarum das zählt: Die Vorgabe wirkt auf jeden künftigen Aufrufer, ohne dass ' +
			'ihn jemand ansieht. Am 25.08.2026 löste sie ein Haus aus seiner MEG, ' +
			'liess eine zweite Erstversammlung zu und sperrte am Einlass eine ' +
			'stimmberechtigte Person aus.'
	);
	process.exit(1);
}

console.log(`Archivsicht in Ordnung: ${geprueft} Lesewege, alle ohne Vorgabe.`);
