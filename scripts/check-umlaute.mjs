/**
 * Umlaut-Wächter: ASCII-Umschreibungen in Fliesstext und Kommentaren.
 *
 * **Der Anlass** (Pendenzen 19.10.2026, «Lücken gegen die Grundausstattung»;
 * Vorgabe im `AGENTS.md`, «Sprache»): Deutsch mit echten Umlauten ist eine
 * Hausregel, und `check:texte` und `check:zeichenzahl` prüfen sie nicht. Der
 * Bestand ist voller `fuer`, `ueber` und `Pruef` in Kommentaren; ein voller
 * Wächter wäre heute dauerrot und würde abgeschaltet.
 *
 * **Deshalb eine Sperrklinke wie bei den Personendaten.** Je Muster steht in
 * `scripts/umlaut-sperre.tsv` eine Obergrenze. Sie darf nur sinken, nie
 * steigen. Ein neuer Fund über der Grenze macht den Lauf rot; eine Grenze,
 * die über der Wirklichkeit liegt, ebenso, denn dann bewacht sie nichts.
 *
 * **Was gelesen wird.** Nur Zeichenketten und Kommentare unter `src/`, in
 * `.svelte`-Dateien dazu statische Attributwerte und Zeichenketten in
 * `{…}`-Ausdrücken, und der Fliesstext unter `docs/` (ohne Codezäune,
 * Inline-Code und Linkziele).
 * Bezeichner sind damit schon aussen vor; zusätzlich fallen Dateinamen,
 * Routen und URL-Pfade, CSS-Klassen, camelCase-Namen und Schlüssel weg. Ein
 * Wächter, der Wahres anstreicht, wird umgangen, und dann streicht er auch
 * das Falsche nicht mehr an.
 *
 * **Was er nicht sieht.** Den Fliesstext zwischen den Marken einer
 * `.svelte`-Datei und Zeichenketten in Blockmarken (`{#each …}`); dort steht
 * der Text meist schon mit Umlauten. Binärformate werden übersprungen. Das ist
 * eine Grenze, keine Behauptung von Vollständigkeit.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';
import { dateien, leseDokument, leseQuelle, leseSvelte, leseSvelteMarkup } from './lib/quelllesen.mjs';

const ERSTER = process.argv[2];
const WURZEL = ERSTER && !ERSTER.startsWith('--') ? ERSTER : process.cwd();
const SPERRDATEI = join(WURZEL, 'scripts', 'umlaut-sperre.tsv');

/** Diese Muster gehören in die Sperrdatei; ein fehlendes wäre ein blinder Fleck. */
const PFLICHT = ['fuer', 'ueber', 'waere', 'muess', 'koenn', 'naechst', 'haeng', 'Aenderung', 'Pruef'];

/** Die Endungen einer ASCII-Umschreibung: `muess` trifft auch `muessen`. */
const ENDUNG = '[a-zäöüß]*';

/** Die Sperrdatei; ein Fehler darin ist rot, nicht still übersprungen. */
function ladeSperre() {
	let text;
	try {
		text = readFileSync(SPERRDATEI, 'utf8');
	} catch {
		console.error(
			'\nscripts/umlaut-sperre.tsv fehlt. Ohne Sperrliste wäre der Wächter grün und blind.\n'
		);
		process.exit(1);
	}
	const sperre = new Map();
	for (const zeile of text.split('\n')) {
		const roh = zeile.trim();
		if (!roh || roh.startsWith('#')) continue;
		const teile = roh.split('\t');
		if (teile.length !== 2) {
			console.error(
				`\nscripts/umlaut-sperre.tsv: Zeile mit ${teile.length} Spalten.\n` +
					'Erwartet: Muster<Tab>Obergrenze.\n'
			);
			process.exit(1);
		}
		const [muster, zahl] = teile;
		const obergrenze = Number(zahl);
		if (!/^[A-Za-zäöüÄÖÜß]+$/.test(muster) || !Number.isInteger(obergrenze) || obergrenze < 0) {
			console.error(
				`\nscripts/umlaut-sperre.tsv: «${muster}» oder «${zahl}» ist unlesbar.\n` +
					'Erwartet: ein Buchstabenmuster und eine ganze Zahl ab null.\n'
			);
			process.exit(1);
		}
		if (sperre.has(muster)) {
			console.error(`\nscripts/umlaut-sperre.tsv: «${muster}» steht zweimal drin.\n`);
			process.exit(1);
		}
		sperre.set(muster, obergrenze);
	}
	for (const p of PFLICHT) {
		if (!sperre.has(p)) {
			console.error(
				`\nscripts/umlaut-sperre.tsv: das Pflichtmuster «${p}» fehlt.\n` +
					'Ein gelöschtes Muster wäre ein blinder Fleck, kein Fortschritt.\n'
			);
			process.exit(1);
		}
	}
	if (sperre.size === 0) {
		console.error('\nscripts/umlaut-sperre.tsv ist leer.\n');
		process.exit(1);
	}
	return sperre;
}

/**
 * Pfade, Dateinamen, URLs, Query-Teile und CSS-Klassen durch Leerzeichen
 * ersetzen. Gleiche Länge, damit die Zeilenzahl und die Fundstelle stimmen.
 */
function maskiere(text, art) {
	let s = text;
	if (art === 'kommentar' || art === 'html-kommentar' || art === 'css-kommentar' || art === 'docs') {
		s = s.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
	}
	if (art === 'docs') {
		s = s.replace(/\bnpm run\s+[\w:-]+/g, (m) => ' '.repeat(m.length));
		s = s.replace(/\b[a-zäöüß_][\wäöüß_]*:/g, (m) => ' '.repeat(m.length));
	}
	s = s.replace(/https?:\/\/\S+/g, (m) => ' '.repeat(m.length));
	s = s.replace(/\S*\/\S*/g, (m) => ' '.repeat(m.length));
	s = s.replace(
		/\b[\w.-]+\.(?:ts|js|mjs|cjs|json|sh|md|css|html|svelte|sql|tsv|txt|yml|yaml|pdf|zip|docx|odt|xlsx|lock)\b/gi,
		(m) => ' '.repeat(m.length)
	);
	s = s.replace(/\.[A-Za-z_-][\w-]*/g, (m) => ' '.repeat(m.length));
	s = s.replace(/\b[\w.-]*[?&=][\w=&?.-]*/g, (m) => ' '.repeat(m.length));
	return s;
}

/** Ein Bezeichner oder Schlüssel, kein Fliesstext. */
function istBezeichner(voll) {
	return (
		/[_$\d]/.test(voll) ||
		/[a-zäöüß][A-ZÄÖÜ]/.test(voll) ||
		/[/-]/.test(voll) ||
		/\w\.\w/.test(voll)
	);
}

/** Eine Klasse oder ein kurzes Etikett aus lauter Kleinbuchstaben. */
function istKlassenliste(text) {
	const t = text.trim();
	return /^[a-zäöüß0-9][a-zäöüß0-9 -]*$/.test(t) && !/[.,!?:;]/.test(t);
}

/**
 * Ein Text auf die Muster prüfen. Gibt die Fundstellen zurück; die Zählung
 * läuft über dieselbe Liste, damit Meldung und Zahl nicht auseinanderlaufen.
 */
function fundeIn(text, datei, zeile, art, sperre, funde) {
	const maskiert = maskiere(text, art);
	for (const muster of sperre.keys()) {
		/*
		 * Kein Buchstabe vor dem Muster verlangt (Codeprüfung bei der Übernahme,
		 * 20.10.2026): «dafuer», «geprueft» und «unabhaengig» sind ASCII-Formen
		 * wie «fuer»; Bezeichner fängt `istBezeichner` am ganzen Wort ab.
		 */
		const re = new RegExp(`(?<![0-9_$])${muster}${ENDUNG}`, 'gi');
		for (const treffer of maskiert.matchAll(re)) {
			const i = treffer.index;
			let a = i;
			while (a > 0 && /[A-Za-z0-9_$./-]/.test(maskiert[a - 1])) a -= 1;
			let b = i + treffer[0].length;
			while (b < maskiert.length && /[A-Za-z0-9_$./-]/.test(maskiert[b])) b += 1;
			const voll = maskiert.slice(a, b).replace(/[.,;:!?]+$/, '');
			if (istBezeichner(voll)) continue;
			if (art === 'string' && (!/\s/.test(text.trim()) || istKlassenliste(text))) continue;
			funde.push({ datei, zeile, art, muster, wort: treffer[0], voll });
		}
	}
}

const quellDateien = dateien(join(WURZEL, 'src'), ['.ts', '.js', '.mjs', '.svelte']);
const dokDateien = dateien(join(WURZEL, 'docs'), ['.md']);

/*
 * Die Reissleine je Quelle und **vor** der Sperrdatei: Über einem leeren Baum
 * fehlt auch sie, und ihre Absage hätte die Reissleinen-Probe grün gemacht,
 * ohne dass `mindestens()` je lief.
 */
mindestens(quellDateien, 400, 'Dateien unter src/');
mindestens(dokDateien, 70, 'Dateien unter docs/');

const sperre = ladeSperre();
const funde = [];
const besuch = (art, text, datei, zeile) => fundeIn(text, datei, zeile, art, sperre, funde);
/*
 * Attributwerte und `{…}`-Ausdrücke im Markup zählen wie Zeichenketten: Sie
 * stehen dem Leser genauso vor Augen, und dieselbe Lücke, die der Anrede-
 * Wächter in der zweiten Runde schloss, liess sie hier ungeprüft. Der
 * Fliesstext zwischen den Marken bleibt aussen vor (siehe Kopf dieser Datei).
 */
const markupBesuch = (art, text, datei, zeile) => {
	if (art === 'svelte-attr' || art === 'svelte-ausdruck') {
		fundeIn(text, datei, zeile, 'string', sperre, funde);
	}
};
for (const pfad of quellDateien) {
	const datei = relative(WURZEL, pfad);
	const text = readFileSync(pfad, 'utf8');
	if (pfad.endsWith('.svelte')) {
		leseSvelte(text, datei, besuch);
		leseSvelteMarkup(text, datei, markupBesuch);
	} else {
		leseQuelle(text, datei, 0, besuch);
	}
}
for (const pfad of dokDateien) {
	leseDokument(readFileSync(pfad, 'utf8'), relative(WURZEL, pfad), besuch);
}

const zahlen = new Map([...sperre.keys()].map((m) => [m, 0]));
for (const f of funde) zahlen.set(f.muster, (zahlen.get(f.muster) ?? 0) + 1);

if (process.argv.includes('--erheben')) {
	for (const [muster, anzahl] of zahlen) console.log(`${muster}\t${anzahl}`);
	console.error(`${funde.length} Fundstellen in ${quellDateien.length} Quellen und ${dokDateien.length} Dokumenten.`);
	process.exit(0);
}

const ueber = [...sperre]
	.map(([muster, obergrenze]) => ({ muster, obergrenze, anzahl: zahlen.get(muster) }))
	.filter((e) => e.anzahl > e.obergrenze);
const gesunken = [...sperre]
	.map(([muster, obergrenze]) => ({ muster, obergrenze, anzahl: zahlen.get(muster) }))
	.filter((e) => e.anzahl < e.obergrenze);

if (ueber.length > 0) {
	console.error(`\nUmlaut-Sperrklinke: ${ueber.length} Muster über der Obergrenze:\n`);
	for (const e of ueber) {
		console.error(`  · «${e.muster}»: ${e.anzahl} Nennungen, Obergrenze ${e.obergrenze}`);
		for (const f of funde.filter((x) => x.muster === e.muster)) {
			console.error(`      ${f.datei}:${f.zeile} (${f.art}) «${f.wort}»`);
		}
	}
	console.error(
		'\nDie Stelle mit echten Umlauten schreiben. Die Obergrenze in\n' +
			'scripts/umlaut-sperre.tsv zu erhöhen, verbietet die Hausregel; erzwingen\n' +
			'kann das dieser Lauf nicht, das prüft der Review.\n'
	);
}
if (gesunken.length > 0) {
	console.error(`\nUmlaut-Sperrklinke: ${gesunken.length} Obergrenze(n) überholt, die Zahl ist gesunken:\n`);
	for (const e of gesunken) {
		console.error(`  · «${e.muster}»: ${e.anzahl} Nennungen, Obergrenze ${e.obergrenze}`);
	}
	console.error(
		'\nWer bereinigt hat, senkt die Obergrenze im selben Block auf den neuen Stand.\n' +
			'Eine Obergrenze über der Wirklichkeit bewacht nichts: Neue Nennungen blieben\n' +
			'grün, bis sie den alten Stand erreichen.\n'
	);
}
if (ueber.length > 0 || gesunken.length > 0) process.exit(1);

console.log(
	`Umlaute in Ordnung: ${sperre.size} Muster genau auf der Obergrenze ` +
		`(${quellDateien.length} Quellen, ${dokDateien.length} Dokumente, ${funde.length} Fundstellen).`
);
