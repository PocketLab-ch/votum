/**
 * Aufräumwächter: Jede Tabelle an einer Gemeinschaft oder Versammlung steht im
 * Aufräumskript.
 *
 * **Der Anlass — zweimal derselbe Fehler.** `scripts/testdaten-entfernen.sql`
 * warnt seit dem 11.08.2026 in einem Kommentar: «Wer eine Tabelle mit
 * `stweg_id` oder `meeting_id` hinzufügt, trägt sie hier nach.» Damals hatte
 * `ai_usage` gefehlt und der ganze Lauf brach am Schluss ab. Am 25.08.2026
 * fehlten `quorum_finding` (Migration 080) und `bylaw_instruction_rule`
 * (Migration 085) — beide mit einem Fremdschlüssel ohne Kaskade, beide hätten
 * das Aufräumen an derselben Stelle scheitern lassen.
 *
 * Ein Kommentar ist keine Schranke. Dieser Wächter ist eine.
 *
 * **Gelesen wird aus den Migrationen**, nicht aus einer laufenden Datenbank:
 * Der Prüflauf soll ohne Datenbank auskommen, und die Migrationen sind die
 * Wahrheit über das Schema.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = process.cwd();
const SKRIPT = 'scripts/testdaten-entfernen.sql';

/**
 * Tabellen, die bewusst NICHT im Aufräumskript stehen — je mit ihrem Grund.
 *
 * Eine Ausnahmeliste ohne Begründung wächst, bis sie den Wächter aufhebt.
 */
const AUSGENOMMEN = {
	agenda_item_affected:
		'hängt mit ON DELETE CASCADE am Traktandum, das vorher gelöscht wird',
	agenda_item_proposer:
		'hängt mit ON DELETE CASCADE am Traktandum, das vorher gelöscht wird',
	meeting_pause:
		'hängt mit ON DELETE CASCADE an der Versammlung, die vorher gelöscht wird (Migration 153)'
};

const migrationen = readdirSync(join(WURZEL, 'migrations'))
	.filter((d) => d.endsWith('.sql'))
	.sort();

/** `CREATE TABLE name (` … bis zur schliessenden Klammer am Zeilenanfang. */
const ANLAGE = /CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
/** `ALTER TABLE name ADD COLUMN stweg_id …` — nachgerüstete Spalten. */
const NACHGERUESTET = /ALTER TABLE ([a-z_]+)[\s\S]{0,400}?ADD COLUMN\s+(stweg_id|meeting_id)\b/g;

const betroffen = new Map(); // Tabelle → Migration, in der sie auftaucht
for (const datei of migrationen) {
	const inhalt = readFileSync(join(WURZEL, 'migrations', datei), 'utf8');
	for (const m of inhalt.matchAll(ANLAGE)) {
		const [, name, koerper] = m;
		if (/^\s*(stweg_id|meeting_id)\s/m.test(koerper) && !betroffen.has(name)) {
			betroffen.set(name, datei);
		}
	}
	for (const m of inhalt.matchAll(NACHGERUESTET)) {
		if (!betroffen.has(m[1])) betroffen.set(m[1], datei);
	}
}

if (betroffen.size < 15) {
	console.error(
		`Aufräumen: nur ${betroffen.size} Tabellen mit stweg_id/meeting_id in den\n` +
			'  Migrationen gefunden — der Ausdruck trifft offenbar nicht mehr, und der\n' +
			'  Wächter wäre ab jetzt immer grün.'
	);
	process.exit(1);
}

/*
 * **Kommentare heraus, bevor gesucht wird** (25.08.2026, beim Bauen gemessen).
 *
 * Der erste Anlauf las `DELETE FROM …` auch aus einer auskommentierten Zeile —
 * die Gegenprobe blieb grün, obwohl der Befehl abgeschaltet war. Genau davor
 * warnt der Wächterabschnitt von `docs/bauweise.md`: Ein regulärer Ausdruck über Dateitext
 * unterscheidet Code nicht von Kommentar. Das Skript ist SQL, also fällt weg,
 * was hinter `--` bis zum Zeilenende steht.
 */
const skript = readFileSync(join(WURZEL, SKRIPT), 'utf8')
	.split('\n')
	.map((zeile) => zeile.replace(/--.*$/, ''))
	.join('\n');
const geloescht = new Set(
	[...skript.matchAll(/DELETE FROM ([a-z_]+)/g)].map((m) => m[1])
);

const fehlend = [];
for (const [name, datei] of betroffen) {
	if (geloescht.has(name) || name in AUSGENOMMEN) continue;
	fehlend.push(`${name} (${datei})`);
}

if (fehlend.length > 0) {
	console.error(
		`Aufräumen: diese Tabellen hängen an einer Gemeinschaft oder Versammlung,\n` +
			`  stehen aber nicht in ${SKRIPT}. Beim Aufräumen bricht es an ihnen ab:\n`
	);
	for (const f of fehlend) console.error(`  ${f}`);
	console.error(
		'\n  Nachtragen — oder, wenn eine Kaskade sie ohnehin mitnimmt, mit Grund in\n' +
			'  die Ausnahmeliste von scripts/check-aufraeumen.mjs.'
	);
	process.exit(1);
}

/*
 * **Die Sichtprobe.** Eine Ausnahme, die nicht mehr gebraucht wird, hebt den
 * Wächter still auf: Sie deckt dann einen Namen, den es gar nicht mehr gibt.
 */
const totteAusnahmen = Object.keys(AUSGENOMMEN).filter((n) => !betroffen.has(n));
if (totteAusnahmen.length > 0) {
	console.error(
		`Aufräumen: Ausnahmen für Tabellen, die es nicht (mehr) gibt: ${totteAusnahmen.join(', ')}.\n` +
			'  Weg damit — eine ungepflegte Ausnahme deckt irgendwann etwas anderes.'
	);
	process.exit(1);
}

console.log(
	`Aufräumen in Ordnung: ${betroffen.size} Tabellen an Gemeinschaft oder Versammlung, ` +
		`${betroffen.size - Object.keys(AUSGENOMMEN).length} davon im Skript, ` +
		`${Object.keys(AUSGENOMMEN).length} mit Grund ausgenommen.`
);
