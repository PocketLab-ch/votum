/**
 * Regelleserwächter: Wer Reglementsregeln liest, liest sie vollständig.
 *
 * **Der Anlass, am 23.08.2026.** Die Fallbeschränkung einer Reglementsregel
 * (`node_id`, Migration 076) kam neu dazu, und ich habe genau eine der beiden
 * Lesestellen angepasst. Die andere — `erfordernisse.ts` — liefert die Regeln an
 * die Traktandenvorlagen und gab sie ohne ihren Fall weiter.
 *
 * Die Folge war genau der Befund, gegen den die Beschränkung gebaut worden war:
 * Eine Klausel «nur Erneuerungsfonds» verschärfte Protokollgenehmigung,
 * Jahresrechnung, Budget und Décharge weiterhin auf zwei Drittel. Zwei
 * Traktanden desselben Falls standen mit verschiedenen Erfordernissen in
 * derselben Liste — eines aus der Vorlage, eines von Hand.
 *
 * Gefunden hat es die Nachprüfung, nicht der Prüflauf: Alle Tests waren grün,
 * weil sie die Domäne prüfen und nicht die Leseschicht.
 *
 * **Die Regel.** Jede Stelle, die `bylaw_quorum_rule` liest und daraus
 * Regelobjekte baut, muss alle Merkmale mitnehmen, an denen die Anwendung
 * entscheidet. `knotenId` ist das jüngste; kommt ein weiteres dazu, gehört es
 * in diese Liste.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.cwd();

/** Merkmale, an denen die Anwendung entscheidet — ohne sie ist eine Regel halb. */
// `gesichert` seit Migration 197: Ohne ihn rechnete eine Lesestelle eine Regel
// mit Häkchen an der Bezahlung aus dem Fonds wie eine ohne.
const PFLICHT = ['knotenId', 'gesichert'];

/** Eine Lesestelle: `SELECT` auf der Regeltabelle. */
const LIEST = /SELECT[\s\S]{0,400}?FROM\s+bylaw_quorum_rule/i;

function dateienUnter(verzeichnis) {
	const treffer = [];
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
		return treffer;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateienUnter(pfad));
		else if (eintrag.endsWith('.ts')) treffer.push(pfad);
	}
	return treffer;
}

const befunde = [];
let geprueft = 0;

for (const pfad of mindestens(
	dateienUnter(join(WURZEL, 'src', 'lib', 'server')),
	60,
	'Serverdateien unter src/lib/server/'
)) {
	const inhalt = readFileSync(pfad, 'utf8');
	if (!LIEST.test(inhalt)) continue;

	/*
	 * **Nur Lesestellen, die Regeln BAUEN.** Wer bloss zählt
	 * (`count(*) FROM bylaw_quorum_rule`) oder löscht, braucht die Merkmale
	 * nicht — er gibt keine Regel weiter, an der etwas entschieden wird.
	 */
	if (!/geschaeftsart:/.test(inhalt)) continue;
	geprueft++;

	const fehlend = PFLICHT.filter((feld) => !new RegExp(`\\b${feld}:`).test(inhalt));
	if (fehlend.length > 0) {
		befunde.push(
			`${relative(WURZEL, pfad)}\n` +
				`    liest bylaw_quorum_rule und baut Regeln, lässt aber ${fehlend.map((f) => `«${f}»`).join(', ')} weg.\n` +
				`    Eine Regel ohne ihren Fall gilt für die ganze Geschäftsart — und damit für\n` +
				`    Geschäfte, die niemand gemeint hat.`
		);
	}
}

/*
 * **Die Sichtprobe.** Es gibt zwei Lesestellen; findet der Wächter keine, trifft
 * sein Muster nicht mehr, und er wäre ab jetzt immer grün.
 */
if (geprueft === 0) {
	console.error(
		'Regelleser: keine einzige Stelle gefunden, die Reglementsregeln liest.\n' +
			'  Es gibt welche — also trifft das Muster nicht mehr. Erst reparieren, dann vertrauen.'
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.error(`Regelleser: ${befunde.length} unvollständige Lesestelle(n).\n`);
	for (const b of befunde) console.error(`  ${b}\n`);
	process.exit(1);
}

console.log(`Regelleser in Ordnung: ${geprueft} Lesestellen, alle mit ${PFLICHT.join(', ')}.`);
