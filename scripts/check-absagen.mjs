/**
 * Absagenwächter: Jede fachliche Absage der Zugangswege hat einen Satz.
 *
 * **Der Anlass, am 22.08.2026.** Die Downloadwege für Zugangskarten warfen bei
 * einer fachlichen Absage einen nackten «400» — der Verwalter flog mitten in
 * der Vorbereitung aus der Anwendung (Befund B-04 des Usability-Prüflaufs).
 * Sie leiten seither auf die Zugangsseite zurück und geben die Kennung mit.
 *
 * **Und dabei ging es beinahe schief.** Beim ersten Bauen kannte die
 * Übersetzung zwei der vier Kennungen. Im Browser klickte ich an einer
 * geschlossenen Versammlung — Kennung `geschlossen`, kein Satz, die Seite zeigte
 * **gar nichts**. Ein Klick, nach dem nichts geschieht, ist schlimmer als der
 * Fehler, den er ersetzen sollte.
 *
 * Ein Rückfall fängt das heute ab. Er ist aber die Notbremse, nicht das Ziel:
 * Dieser Wächter sorgt dafür, dass jede Kennung, die auf diesem Weg
 * herauskommen kann, auch einen ausformulierten Satz hat.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = process.cwd();

/** Die Kernmodule, aus denen die Zugangswege ihre Absagen beziehen. */
// `db.ts` seit F7 (16.10.2026): Dort entstehen `ungueltige_kennung`,
// `versammlung_abgegeben` und seit 28.10.2026 `unbekannter_verweis` und
// `fremde_kennung` (Migration 177) aus Fehlern der Datenbank, und alle kommen
// über `?absage=` auf die Zugangsseite.
const QUELLEN = ['src/lib/server/kartensatz.ts', 'src/lib/server/zugaenge.ts', 'src/lib/server/db.ts'];
const SEITE = 'src/routes/versammlungen/[id=kennung]/zugaenge/+page.server.ts';

/** `throw new FachlicherFehler(` — die Kennung steht im ersten Argument. */
const WURF = /new FachlicherFehler\(\s*'([a-z_]+)'/g;

/**
 * Liest eine der festen Quellen.
 *
 * Die Reissleine darunter ist gut, kam aber zu spät: Fehlt eine Quelldatei,
 * stürzte der Lauf hier mit einem nackten ENOENT ab, bevor sie zählen konnte
 * (04.09.2026, aus dem Code-Review). Rot war er dann aus Versehen, und die
 * Meldung sagte nicht, was fehlt.
 */
function quelle(datei) {
	try {
		return readFileSync(join(WURZEL, datei), 'utf8');
	} catch {
		console.error(
			`\nAbsagen: die Quelldatei «${datei}» ist nicht auffindbar.\n` +
				'  Aus ihr holt der Wächter die Kennungen; ohne sie prüft er nichts.\n' +
				'  Wurde sie verschoben oder umbenannt, gehört er mit umgebaut.\n'
		);
		process.exit(1);
	}
}

const kennungen = new Set();
for (const datei of QUELLEN) {
	for (const m of quelle(datei).matchAll(WURF)) kennungen.add(m[1]);
}

if (kennungen.size === 0) {
	console.error(
		'Absagen: keine einzige Kennung in den Zugangsmodulen gefunden.\n' +
			'  Es gibt welche — also trifft das Muster nicht mehr, und der Wächter wäre\n' +
			'  ab jetzt immer grün. Erst reparieren, dann vertrauen.'
	);
	process.exit(1);
}

const seite = quelle(SEITE);
const fehlend = [...kennungen].filter((k) => !new RegExp(`\\b${k}:`).test(seite));

if (fehlend.length > 0) {
	console.error(`Absagen: ${fehlend.length} Kennung(en) ohne ausformulierten Satz.\n`);
	for (const k of fehlend) console.error(`  «${k}»`);
	process.exit(1);
}

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Zweiter Teil: Downloadwege mit fachlicher Absage
 *
 * **Der Anlass** (Prüflauf II, C-02). Die Auszählmappe entsteht nur, wo es
 * etwas zu rechnen gibt; sonst sagt der Downloadweg mit HTTP 400 ab. Der Knopf
 * stand trotzdem auf der Ausfallseite — wer klickte, landete auf einer
 * JSON-Fehlerseite, und die Ablaufleiste blieb auf «2 von 3 Unterlagen geholt»
 * stehen. Dieselbe Klasse wie A-21, A-22 und B-03: ein Angebot, das der Server
 * abweist.
 *
 * **Was dieser Teil prüft.** Jeder Downloadweg, der eine FACHLICHE Absage
 * kennt — eine, die nicht an fehlender Anmeldung oder einem Tippfehler in der
 * Adresse liegt —, muss in dieser Liste stehen, mit einer Notiz, wie die
 * Oberfläche damit umgeht. Die Liste zu pflegen ist Handarbeit; sie zu
 * vergessen fällt beim nächsten Lauf auf.
 *
 * Der Wächter kann nicht prüfen, ob die Notiz stimmt. Er kann erzwingen, dass
 * jemand sie schreibt — und das ist der Unterschied zwischen «niemand hat
 * daran gedacht» und «jemand hat entschieden».
 */
const WEGE = 'src/routes/versammlungen/[id=kennung]';

/** Absagen, die nichts über den Zustand der Versammlung sagen. */
const TECHNISCH = /Nicht angemeldet|nicht gefunden|nicht auffindbar/;

/**
 * Je Downloadweg: wie die Oberfläche mit seiner fachlichen Absage umgeht.
 * Ein Weg ohne Eintrag lässt den Lauf scheitern.
 */
const BEHANDELT = {
	'auszaehlung.xlsx':
		'Die Ausfallseite zeigt den Knopf nur, wenn `brauchtAuszaehlmappe` wahr ist, ' +
		'und sonst den Grund. Die Ablaufleiste zählt dann zwei statt drei Unterlagen.',
	'stimmzettel.pdf':
		'Absage nur, wenn die Versammlung kein Abstimmungstraktandum hat. Die ' +
		'Ausfallsicherung steht erst ab der Freigabe offen, und bis dahin ist die ' +
		'Traktandenliste bestätigt — ohne Abstimmung gibt es dort nichts zu holen.',
	'abschlusspaket.zip':
		'Der Weg steht nur auf der Siegelseite einer versiegelten Versammlung; vorher ' +
		'zeigt sie den Versiegeln-Knopf statt des Downloads.',
	'zeitstempel.tsr':
		'Der Knopf erscheint erst, wenn ein Zeitstempel vorliegt — sonst steht dort ' +
		'«Zeitstempel ausstehend» mit dem Weg zum Nachholen.',
	'protokoll.pdf': 'Der Weg steht nur an einem bestehenden Protokoll.',
	'protokoll.docx': 'Der Weg steht nur an einem bestehenden Protokoll.',
	'protokoll.odt': 'Der Weg steht nur an einem bestehenden Protokoll.',
	'unterschriftenliste.pdf':
		'Braucht den eingefrorenen Stimmberechtigtenstand. Die Ausfallseite zeigt den ' +
		'Knopf erst ab der Freigabe und sagt vorher, worauf man wartet.',
	'weisungsblatt.pdf':
		'Verlangt `?haus=`; die Oberfläche setzt es immer, und die Absage trifft nur ' +
		'einen von Hand zusammengesetzten Aufruf.',
	'vollmachtsformular.pdf':
		'Sagt ab, wenn keine Partei mit Einheiten erfasst ist — dann gäbe es kein Blatt ' +
		'zu füllen. Der Verweis steht auf der Zugangsseite nur bei `uebersicht.length > 0`, ' +
		'also genau dann, wenn es Parteien gibt; ohne sie ist die Liste darüber leer.',
	'verlauf.pdf':
		'Der Verweis steht nur auf der Siegelseite einer versiegelten Versammlung, und auch ' +
		'dort nur, wenn das Paket den Verlauf wirklich trägt (`hatVerlaufspdf`; Pakete von vor ' +
		'Block 3 tragen ihn nicht). Die Absagen treffen einen von Hand zusammengesetzten ' +
		'Aufruf; bleibt ein beschädigtes Paket, sagt die 409-Meldung, das Dokument nicht ' +
		'weiterzugeben.'
};

const { readdirSync, existsSync } = await import('node:fs');
const ohneNotiz = [];
const leer = [];
for (const eintrag of readdirSync(join(WURZEL, WEGE), { withFileTypes: true })) {
	if (!eintrag.isDirectory() || !/\.(pdf|xlsx|zip|tsr|docx|odt)$/.test(eintrag.name)) continue;
	const datei = join(WURZEL, WEGE, eintrag.name, '+server.ts');
	if (!existsSync(datei)) continue;
	const inhalt = readFileSync(datei, 'utf8');
	const fachlich = [...inhalt.matchAll(/error\(\s*(\d{3})\s*,\s*'([^']+)'/g)]
		.map((m) => m[2])
		.filter((satz) => !TECHNISCH.test(satz));
	if (fachlich.length === 0) continue;
	if (!(eintrag.name in BEHANDELT)) ohneNotiz.push({ weg: eintrag.name, saetze: fachlich });
	else if (!BEHANDELT[eintrag.name].trim()) leer.push(eintrag.name);
}

if (ohneNotiz.length > 0) {
	console.error(
		`Absagen: ${ohneNotiz.length} Downloadweg(e) mit fachlicher Absage, aber ohne Notiz\n` +
			'  in `scripts/check-absagen.mjs`. Halten Sie fest, wie die Oberfläche damit\n' +
			'  umgeht — oder sorgen Sie dafür, dass sie den Weg dort gar nicht anbietet.\n'
	);
	for (const o of ohneNotiz) {
		console.error(`  ${o.weg}`);
		for (const satz of o.saetze) console.error(`      «${satz.slice(0, 90)}»`);
	}
	process.exit(1);
}
if (leer.length > 0) {
	console.error(`Absagen: leere Notiz bei ${leer.join(', ')}.`);
	process.exit(1);
}

const geprueft = Object.keys(BEHANDELT).length;
if (geprueft < 5) {
	console.error(
		'Absagen: weniger als fünf Downloadwege in der Liste — das Muster trifft\n' +
			'  offenbar nicht mehr, und der zweite Teil wäre ab jetzt immer grün.'
	);
	process.exit(1);
}

console.log(
	`Absagen in Ordnung: ${kennungen.size} Kennungen mit eigenem Satz, ` +
		`${geprueft} Downloadwege mit Notiz.`
);
