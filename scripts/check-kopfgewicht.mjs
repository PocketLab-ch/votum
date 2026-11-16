/**
 * Wächter: Das Gewicht einer Partei kommt nur aus `kopfgewicht`.
 *
 * **Der Anlass** (Lesarten Block 5, Kriterium 11). Der Ausdruck, der aus der
 * Zählweise das Gewicht einer Partei ableitet — bei `per_owner` 1 (oder 0 ohne
 * Einheit), bei `per_unit` die Zahl der kopfstimmentragenden Einheiten — stand
 * viermal in `auszaehlung.ts` und `vonhand.ts`. Eine fünfte Stelle (L3, die
 * Zählung an der Einsprache) hätte ihn erneut verlangt, und jede Kopie lief
 * früher oder später auseinander. Jetzt steht er einmal in
 * `eigentuemer.ts` (`kopfgewicht`), und dieser Wächter hält fest, dass er
 * ausserhalb nicht wieder entsteht.
 *
 * Erkennt die Schreibweisen, die die Kopien trugen: die per_unit-Zählung über
 * `filter(...).length` und die per_owner-Ternäre über `<liste>.length > 0 ? 1 : 0`,
 * gleich unter welchem Namen (`units`, `einheiten`). Geprüft werden `src/lib`
 * und `src/routes`, `.ts` und `.svelte`; ausgenommen ist nur
 * `src/lib/domain/eigentuemer.ts` selbst (Codeprüfung Block 5, M5: die erste
 * Fassung sah nur die `.ts`-Dateien unter `src/lib` und nur `units`, und sie übersprang jede Datei
 * auf `eigentuemer.ts`, auch `server/eigentuemer.ts`).
 * Die übrigen Leser von `traegtKopfstimme` (die Einheit-für-Einheit-Schleife in
 * `zaehleAus`) bleiben erlaubt: Sie leiten kein Gewicht ab.
 *
 * **Reissleine:** Fehlt `src/lib/domain/eigentuemer.ts` mit `kopfgewicht` oder
 * findet der Wächter keine Datei zu prüfen, bricht er ab — sonst wäre er über
 * einem leeren Baum still grün.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const WURZEL = process.argv[2] ?? process.cwd();

function dateien(ordner) {
	let eintraege;
	try {
		eintraege = readdirSync(ordner);
	} catch {
		return null;
	}
	return eintraege.flatMap((n) => {
		const pfad = join(ordner, n);
		if (statSync(pfad).isDirectory()) return dateien(pfad) ?? [];
		return /\.(ts|svelte)$/.test(n) ? [pfad] : [];
	});
}

const melden = (text) => {
	console.error(`\n${text}\n`);
	process.exit(1);
};

const KERN = join(WURZEL, 'src', 'lib', 'domain', 'eigentuemer.ts');
const eigentuemer = (() => {
	try {
		return readFileSync(KERN, 'utf8');
	} catch {
		return null;
	}
})();

if (eigentuemer === null) {
	melden(
		'Der Wächter findet `src/lib/domain/eigentuemer.ts` nicht.\n' +
			'Er steht darauf, dass `kopfgewicht` dort liegt; fehlt die Datei, kann er nichts prüfen.'
	);
}

if (!/export function kopfgewicht\(/.test(eigentuemer)) {
	melden(
		'`kopfgewicht` ist in `eigentuemer.ts` nicht auffindbar.\n' +
			'Wurde die Funktion umbenannt oder verschoben, gehört dieser Wächter mit umgebaut.'
	);
}

const befunde = [];
let gepruefteDateien = 0;
const liste = [
	...(dateien(join(WURZEL, 'src', 'lib')) ?? []),
	...(dateien(join(WURZEL, 'src', 'routes')) ?? [])
];
for (const pfad of liste) {
	if (pfad === KERN) continue;
	const text = readFileSync(pfad, 'utf8');
	gepruefteDateien++;
	// Die per_unit-Kopie: die Zahl der kopfstimmentragenden Einheiten bilden.
	// Auch ohne Klammern um den Parameter und mit einer Bedingung davor
	// (Codeprüfung der Fixes, Niedrig 2).
	// Nur innerhalb einer Zeile und nur für eine Bedingung, die zählt: `!traegtKopfstimme`
	// filtert die Einheiten ohne Kopfstimme und leitet kein Gewicht ab. Der
	// Parameter darf eine Typangabe tragen (Codeprüfung Block 5, Runde 3, N1).
	if (/\.filter\(\s*\(?\s*\w+(\s*:\s*[\w.<>[\]]+)?\s*\)?\s*=>[^;\n]*?(?<!!)traegtKopfstimme\([^\n]*\)\s*\)\s*\.length/.test(text)) {
		befunde.push(
			`${pfad}: leitet das Gewicht einer Partei über \`filter(...traegtKopfstimme...).length\` ab. ` +
				'Das gehört in `kopfgewicht` (`eigentuemer.ts`).'
		);
	}
	// Die per_owner-Kopie: «eine Stimme, wenn Einheiten da sind», als Ternäre.
	if (/\.length\s*>\s*0\s*\?\s*1\s*:\s*0/.test(text)) {
		befunde.push(
			`${pfad}: leitet das Gewicht einer Partei über \`….length > 0 ? 1 : 0\` ab. ` +
				'Das gehört in `kopfgewicht` (`eigentuemer.ts`).'
		);
	}
}

if (gepruefteDateien === 0) {
	melden(
		'Der Wächter findet unter `src/lib` und `src/routes` keine Datei zu prüfen.\n' +
			'Über einem leeren Baum kann er nicht grün sein: Wer die Zählung verschoben hat, soll das sehen.'
	);
}

if (befunde.length > 0) {
	console.error(`\nDas Gewicht einer Partei wird ausserhalb von \`kopfgewicht\` abgeleitet:\n`);
	for (const b of befunde) console.error(`  · ${b}\n`);
	console.error(
		'Eine Stelle für das Gewicht (Kriterium 11): Jede Kopie des Ausdrucks lief\n' +
			'früher oder später auseinander, und L3 (die Einsprache je Eigentümer) hätte\n' +
			'eine weitere verlangt. Der Ausdruck steht einmal in `eigentuemer.ts`.\n'
	);
	process.exit(1);
}

console.log(
	'Kopfgewicht in Ordnung: Das Gewicht einer Partei leitet nur `kopfgewicht` aus der Zählweise ab.'
);
