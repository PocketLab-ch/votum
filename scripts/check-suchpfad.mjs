/**
 * Suchpfadwächter: Jede Funktion trägt `SET search_path`, nicht nur die mit
 * SECURITY DEFINER (seit Migration 164, Auftrag Abschluss C1, 16.10.2026).
 *
 * **Der Anlass** (Sicherheitsdurchgang 09.10.2026, Befunde D1 und D2). Zwei
 * Löschfunktionen liefen mit den Rechten ihres Eigentümers, aber ohne
 * gepinnten Suchpfad (Migrationen 042 und 058). Ohne Pin löst eine solche
 * Funktion ihre Tabellennamen über den Suchpfad der **aufrufenden** Sitzung
 * auf, und dort steht `pg_temp` vor `public`. Eine temporäre Tabelle `meeting`
 * mit einer passenden Zeile fütterte die Betreiberprüfung, und die Löschungen
 * danach trafen die echten Tabellen eines fremden Betreibers. Gemessen, nicht
 * vermutet; die Regel stand seit Migration 016 im Haus, 21 von 23 Funktionen
 * hielten sie, und die zwei übrigen fielen niemandem auf.
 *
 * **Und ohne SECURITY DEFINER** (C1, 16.10.2026). Die Auslöserfunktionen laufen
 * unter der Anwendungsrolle, und die darf temporäre Tabellen anlegen. Eine
 * leere temporäre `meeting_handover` liess `versammlung_abgegeben` «nicht
 * abgegeben» antworten, und die Abgabesperre war weg; gemessen in
 * `tests/db/suchpfad.test.ts`. Kein Rechtegewinn über den Betreiber hinaus,
 * aber die Sperren schützen den Nachweis gerade gegen die eigene Anwendung.
 *
 * **Was er verlangt.** Über alle `migrations/*.sql` in ihrer Reihenfolge: Jede
 * Funktion, die am Ende besteht, trägt in ihrer letzten Fassung
 * `SET search_path`. Eine spätere Migration darf eine frühere Fassung heilen,
 * mit `CREATE OR REPLACE` oder mit `ALTER FUNCTION … SET search_path`; die
 * eingespielten Dateien bleiben ja unverändert. Umgekehrt fällt auf, wenn eine
 * spätere Fassung den Pin wieder verliert.
 *
 * **Ein Pin zählt nur mit `pg_temp` am Ende** (Code-Review 13.10.2026). Fehlt
 * `pg_temp` im Pfad, durchsucht PostgreSQL es für Tabellen **zuerst**;
 * `SET search_path = public` wehrte D1 also nicht ab, und `FROM CURRENT`
 * übernähme den Pfad des Aufrufers. Im Haus heisst der Pin überall
 * `public, pg_temp`.
 *
 * **Was er NICHT kann.** Er liest Text, nicht die Datenbank, und er kennt
 * Funktionen nur beim Namen: Bei Überladungen (heute keine) stünde eine
 * ungepinnte `f(uuid)` hinter einer gepinnten `f(text)` grün da. Ein Körper in
 * einfachen Anführungszeichen, der selbst ein Semikolon enthält, schneidet die
 * Anweisung zu früh ab. Beides fängt `tests/db/suchpfad.test.ts` am Katalog
 * (`pg_proc.proconfig`) der Prüfdatenbank, die aus denselben Migrationen gebaut
 * wird. Eine auf Dev oder Prod von Hand geänderte Funktion sieht keiner der
 * beiden.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.argv[2] ?? process.cwd();
const ORDNER = join(WURZEL, 'migrations');

function migrationen() {
	// Ein fehlender Ordner gibt ein leeres Feld; die Reissleine sagt dann, dass
	// hier nichts mehr zu prüfen ist, statt mit einem nackten ENOENT abzustürzen.
	try {
		return readdirSync(ORDNER)
			.filter((n) => n.endsWith('.sql'))
			.sort();
	} catch {
		return [];
	}
}

/**
 * Zeilenkommentare durch gleich lange Leerzeichen ersetzen, damit «-- SECURITY
 * DEFINER» oder ein «CREATE FUNCTION» in einer Begründung nicht zählt. Gleich
 * lang, damit jede Stelle im bereinigten Text dieselbe ist wie im Original und
 * die Zeilennummer der Meldung stimmt.
 */
function ohneKommentare(text) {
	return text.replace(/--[^\n]*/g, (k) => ' '.repeat(k.length));
}

/** Der Name ohne Schema und Anführungszeichen, klein geschrieben. */
function name(roh) {
	return roh.replace(/"/g, '').replace(/^public\./i, '').toLowerCase();
}

// Prozeduren mit, weil sie SECURITY DEFINER genauso tragen können.
const KOPF = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+([\w."]+)\s*\(/gi;
const AENDERN = /ALTER\s+(?:FUNCTION|PROCEDURE)\s+([\w."]+)[^;]*;/gi;
const ENTFERNEN = /DROP\s+(?:FUNCTION|PROCEDURE)\s+(?:IF\s+EXISTS\s+)?([^;]+);/gi;

/**
 * Ob die Eigenschaften einen Pin tragen, der `pg_temp` ans Ende setzt.
 * `undefined`, wenn sie den Suchpfad gar nicht nennen.
 */
function pin(eigenschaften) {
	if (/\bRESET\s+(search_path|ALL)\b/i.test(eigenschaften)) return false;
	if (!/\bSET\s+search_path\b/i.test(eigenschaften)) return undefined;
	const wert = /\bSET\s+search_path\s*(?:=|\bTO\b)\s*((?:['"]?[\w$]+['"]?\s*,\s*)*['"]?[\w$]+['"]?)/i.exec(
		eigenschaften
	);
	if (!wert) return false;
	/*
	 * In Glieder zerlegt, ein zitiertes Glied als Ganzes. `'public, pg_temp'`
	 * in **einem** Paar Anführungszeichen ist für PostgreSQL ein einziger
	 * Schemaname, kein Pfad mit pg_temp am Ende.
	 */
	const glieder = (wert[1].match(/'[^']*'|"[^"]*"|[^,\s]+/g) ?? []).map((g) =>
		g.replace(/^['"]|['"]$/g, '').toLowerCase()
	);
	if (glieder.some((g) => g.includes(','))) return false;
	return glieder.length > 1 && glieder.at(-1) === 'pg_temp';
}

/** Die Namen einer DROP-Anweisung, auch mehrere: `DROP FUNCTION a(uuid), b(text)`. */
function namenAus(liste) {
	let ohneKlammern = liste;
	while (/\([^()]*\)/.test(ohneKlammern)) ohneKlammern = ohneKlammern.replace(/\([^()]*\)/g, '');
	return ohneKlammern
		.replace(/\b(CASCADE|RESTRICT)\b/gi, '')
		.split(',')
		.map((n) => n.trim())
		.filter(Boolean)
		.map(name);
}

/** Der letzte Stand je Funktion: ob sie DEFINER ist, ob gepinnt, und woher. */
const stand = new Map();
const definerGesehen = [];

const dateien = mindestens(migrationen(), 100, 'Migrationen unter migrations/');

for (const datei of dateien) {
	const text = ohneKommentare(readFileSync(join(ORDNER, datei), 'utf8'));

	/*
	 * Die Anweisungen in Textreihenfolge, damit ein DROP vor einem CREATE in
	 * derselben Datei (Migration 111) richtig wirkt. Gesammelt mit Stelle,
	 * dann sortiert.
	 */
	const schritte = [];

	for (const t of text.matchAll(KOPF)) {
		const ab = t.index + t[0].length;
		/*
		 * Der Körper: ein Dollar-Zitat, aber nur, wenn es **vor** dem ersten
		 * Semikolon beginnt. Sonst gehört es zur nächsten Anweisung (Code-Review
		 * 13.10.2026): Ein Körper in einfachen Anführungszeichen oder ein
		 * `RETURN …` hätte den Pin der folgenden Funktion geerbt.
		 */
		const as = /\bAS\s+(\$\w*\$)/gi;
		as.lastIndex = ab;
		const koerper = as.exec(text);
		const erstesEnde = text.indexOf(';', ab);
		let eigenschaften;
		if (koerper && (erstesEnde === -1 || koerper.index < erstesEnde)) {
			const marke = koerper[1];
			const innenBis = text.indexOf(marke, koerper.index + koerper[0].length);
			const schluss = innenBis === -1 ? -1 : text.indexOf(';', innenBis + marke.length);
			// Eigenschaften stehen vor dem Körper oder nach ihm, beides zählt.
			eigenschaften =
				text.slice(ab, koerper.index) +
				' ' +
				(innenBis === -1 ? '' : text.slice(innenBis + marke.length, schluss === -1 ? undefined : schluss));
		} else {
			eigenschaften = text.slice(ab, erstesEnde === -1 ? undefined : erstesEnde);
		}
		schritte.push({
			stelle: t.index,
			art: 'anlegen',
			name: name(t[1]),
			definer: /\bSECURITY\s+DEFINER\b/i.test(eigenschaften),
			gepinnt: pin(eigenschaften) === true
		});
	}

	for (const t of text.matchAll(AENDERN)) {
		schritte.push({
			stelle: t.index,
			art: 'aendern',
			name: name(t[1]),
			definer: /\bSECURITY\s+DEFINER\b/i.test(t[0]) ? true : /\bSECURITY\s+INVOKER\b/i.test(t[0]) ? false : undefined,
			gepinnt: pin(t[0])
		});
	}

	for (const t of text.matchAll(ENTFERNEN)) {
		for (const n of namenAus(t[1])) schritte.push({ stelle: t.index, art: 'entfernen', name: n });
	}

	schritte.sort((a, b) => a.stelle - b.stelle);

	for (const s of schritte) {
		const zeile = text.slice(0, s.stelle).split('\n').length;
		if (s.art === 'entfernen') {
			stand.delete(s.name);
		} else if (s.art === 'anlegen') {
			stand.set(s.name, { definer: s.definer, gepinnt: s.gepinnt, ort: `${datei}:${zeile}` });
			if (s.definer) definerGesehen.push(`${datei}:${zeile}`);
		} else {
			const bisher = stand.get(s.name);
			if (!bisher) continue;
			stand.set(s.name, {
				definer: s.definer ?? bisher.definer,
				gepinnt: s.gepinnt ?? bisher.gepinnt,
				ort: s.gepinnt === undefined ? bisher.ort : `${datei}:${zeile}`
			});
		}
	}
}

/*
 * **Ein Wächter, der keine Funktion mit SECURITY DEFINER findet, ist blind**,
 * nicht grün: Das Haus hat davon über zwanzig. Findet er keine, stimmt das
 * Muster oben nicht mehr, und jede neue Funktion käme ungeprüft durch.
 */
mindestens(definerGesehen, 15, 'Funktionen mit SECURITY DEFINER in den Migrationen');

// Dasselbe für alle Funktionen: Das Haus hat rund siebzig.
mindestens([...stand.keys()], 50, 'Funktionen in den Migrationen');

const befunde = [...stand]
	.filter(([, s]) => !s.gepinnt)
	.map(([n, s]) => `${s.ort}: ${n}()${s.definer ? ' (SECURITY DEFINER)' : ''}`);

if (befunde.length > 0) {
	console.error('Suchpfad: Funktionen ohne SET search_path, der auf pg_temp endet.\n');
	for (const b of befunde) console.error(`  · ${b}`);
	console.error(
		'\nWarum das zählt: Ohne Pin löst die Funktion ihre Tabellen über den Suchpfad\n' +
			'des Aufrufers auf, und dort steht pg_temp vor public. Eine temporäre Tabelle\n' +
			'gleichen Namens füttert dann jede Prüfung in der Funktion: mit SECURITY DEFINER\n' +
			'am Zeilenschutz vorbei (D1, D2, 09.10.2026), in einem Auslöser an der Sperre\n' +
			'vorbei (C1, 16.10.2026).\n' +
			'Abhilfe: SET search_path = public, pg_temp, in einer neuen Migration mit\n' +
			'CREATE OR REPLACE oder ALTER FUNCTION; die eingespielte Datei bleibt.'
	);
	process.exit(1);
}

const definer = [...stand.values()].filter((s) => s.definer).length;
console.log(
	`Suchpfad in Ordnung: ${stand.size} Funktionen, davon ${definer} mit SECURITY DEFINER, jede gepinnt.`
);
