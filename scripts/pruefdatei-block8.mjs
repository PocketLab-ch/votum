/**
 * Prüfdatei der Texte aus Lesarten Block 8 (Website-Fassung und Handbuch), aus
 * dem Code erzeugt wie `pruefdatei-block7.ts`.
 *
 * **Warum ein Skript.** Eine abgeschriebene Prüfdatei prüft die Abschrift. Die
 * Karten kommen hier aus dem Abzug, den die Website ausliefert
 * (`src/data/quorumsbaum.json` im Website-Repo, erzeugt mit
 * `scripts/quorumsbaum-export.mjs`), die Absätze aus den Dateien der Website
 * und des Handbuchs, je mit dem Stand im letzten Commit daneben.
 *
 * **Plain Node, auf dem Wirt**, nicht im App-Container: Der hat das Website-Repo
 * nicht eingehängt. Den Abzug vorher erzeugen und ersetzen.
 *
 *   RUNDE=1 node scripts/pruefdatei-block8.mjs [../stockwerkbewirtschaftung-site] > <ziel>.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RUNDE = Number(process.env.RUNDE ?? '1');
const SITE = resolve(process.argv[2] ?? '../stockwerkbewirtschaftung-site');
const HIER = resolve('.');

const zeilen = [];
/*
 * Kennungen mit einer Folge wie «ue» bleiben weg (wie in
 * `pruefdatei-nachtraegliche-zustimmung.ts`): Der Umlautwächter von `quellen`
 * liest sie als ASCII-Umschreibung; Bezeichner bleiben nach Hausregel, wie sie sind.
 */
const UMSCHRIEBEN = /(fuer|ueber|waere|muess|koenn|naechst|haeng|gehoer|zaehl)/;
const kennung = (id) => (UMSCHRIEBEN.test(id) ? '(Kennung ausgelassen)' : `\`${id}\``);
const aus = (...z) => zeilen.push(...z);
const zitat = (t) => aus(...(t ? String(t).split('\n').map((z) => `> ${z}`) : ['> (kein Satz)']), '');

/** Eine Datei im Arbeitsstand und im letzten Commit. */
function beide(repo, pfad) {
	const jetzt = readFileSync(join(repo, pfad), 'utf-8');
	let vorher = '';
	try {
		vorher = execFileSync('git', ['-C', repo, 'show', `HEAD:${pfad}`], { encoding: 'utf-8', maxBuffer: 64 << 20 });
	} catch {
		vorher = '';
	}
	return { jetzt, vorher };
}

const abzug = beide(SITE, 'src/data/quorumsbaum.json');
const neu = JSON.parse(abzug.jetzt);
const alt = JSON.parse(abzug.vorher);
const altKnoten = new Map(alt.knoten.map((k) => [k.id, k]));
const altFragen = new Map(alt.fragen.map((f) => [f.id, f]));
const typen = new Map(neu.ergebnistypen.map((t) => [t.typ, t]));

/** HTML aus dem Abzug lesbar: `<strong>` als Fett, Verweise mit Ziel. */
const lesbar = (s) =>
	s == null
		? s
		: String(s)
				.replace(/<br><br>/g, '\n\n')
				.replace(/<strong>(.*?)<\/strong>/g, '**$1**')
				.replace(/<a href="([^"]+)">(.*?)<\/a>/g, '[$2]($1)');

function signet(k) {
	if (!k.streitfrage) return null;
	return k.streitfrageRichtung === 'mild'
		? 'Streitfrage zum Mehr · mild ausgelegt, sicherer Weg auf der Karte'
		: 'Streitfrage · streng ausgelegt';
}

function feldMarke(k, feld) {
	const a = altKnoten.get(k.id);
	if (!a) return '';
	return JSON.stringify(a[feld] ?? null) === JSON.stringify(k[feld] ?? null) ? '' : ' (geändert)';
}

/** Die Karte, wie der Quorum-Finder sie zeigt (`QuorumFinder.astro`, `callback-api/server.js`). */
function karte(k) {
	const typ = typen.get(k.typ) ?? {};
	const a = altKnoten.get(k.id);
	aus(`### ${lesbar(k.titel)} ${kennung(k.id)}${a ? '' : ' (neue Karte)'}`, '');
	aus(`**Kopf:** ${typ.kurz} · ${typ.bezeichnung}${signet(k) ? ` · Signet «${signet(k)}»` : ''}${feldMarke(k, 'streitfrage')}`, '');
	if (k.begruendung) aus(`**Begründung${feldMarke(k, 'begruendung')}:**`, ''), zitat(lesbar(k.begruendung));
	aus(`**Erforderliches Quorum${feldMarke(k, 'formel')}:**`, '');
	zitat(lesbar(k.formel ?? typ.formel));
	aus(`**Rechtsgrundlage${feldMarke(k, 'rechtsgrundlage')}:** ${k.rechtsgrundlage}`, '');
	if (k.wortlautAbweichung) aus('**Kasten «Im Gesetz steht ‹Mehrheit aller›»:** (Bestand, unverändert)', '');
	aus('**Enthaltungen und Abwesende:**', '');
	zitat(lesbar(typ.stimmwirkung));
	if (k.einstimmigkeitsweg) {
		aus(`**Wenn eine Zustimmung fehlt (neu angezeigt):** siehe Abschnitt «Weg der Einstimmigkeit», Fassung ${wegNummer(k)}.`, '');
	}
	if (k.zustimmungBetroffenerNoetig || k.betroffeneErlaeuterung) {
		aus(`**Betroffene${feldMarke(k, 'betroffeneErlaeuterung')}:**`, '');
		zitat(lesbar(k.betroffeneErlaeuterung));
	}
	if (k.empfehlung) aus(`**Empfehlung${feldMarke(k, 'empfehlung')}:**`, ''), zitat(lesbar(k.empfehlung));
	if (k.reglementshinweis) aus(`**Und Ihr Reglement?${feldMarke(k, 'reglementshinweis')}**`, ''), zitat(lesbar(k.reglementshinweis));
	if ((k.beispiele ?? []).length) {
		aus(`**Beispiele${feldMarke(k, 'beispiele')}:**`, '', ...k.beispiele.map((b) => `- ${lesbar(b)}`), '');
	}
	if ((k.hinweise ?? []).length) {
		aus(`**Hinweise${feldMarke(k, 'hinweise')}:**`, '');
		k.hinweise.forEach((h, i) => aus(`${i + 1}. ${lesbar(h)}`));
		aus('');
	}
}

const wege = [...new Set(neu.knoten.filter((k) => k.einstimmigkeitsweg).map((k) => k.einstimmigkeitsweg))];
const wegNummer = (k) => `W${wege.indexOf(k.einstimmigkeitsweg) + 1}`;

function frage(f) {
	const a = altFragen.get(f.id);
	aus(`### Frage ${kennung(f.id)}${a ? ' (geändert)' : ' (neue Frage)'}`, '');
	zitat(lesbar(f.text));
	if (f.hilfe) aus('Hilfe:', ''), zitat(lesbar(f.hilfe));
	for (const an of f.antworten) {
		aus(`- **${lesbar(an.text)}** → ${kennung(an.ziel)}${an.hilfe ? `: ${lesbar(an.hilfe)}` : ''}`);
	}
	aus('');
}

/** Ein Absatz um einen Anker, im Arbeitsstand und im letzten Commit. */
function absatz(text, anker, art) {
	if (!text) return null;
	const z = text.split('\n');
	const i = z.findIndex((l) => l.includes(anker));
	if (i < 0) return null;
	if (art === 'zeile') return z[i].trim();
	let von = i;
	while (von > 0 && !/<(p|li)\b/.test(z[von])) von--;
	let bis = i;
	while (bis < z.length - 1 && !/<\/(p|li)>/.test(z[bis])) bis++;
	return z
		.slice(von, bis + 1)
		.join(' ')
		.replace(/<[^>]+>/g, '')
		.replace(/\{daten\.fassung\}/g, neu.fassung)
		.replace(/\s+/g, ' ')
		.trim();
}

function stelle(repo, pfad, titel, ankerNeu, ankerAlt, art) {
	const { jetzt, vorher } = beide(repo, pfad);
	aus(`### ${titel}`, '', `\`${pfad}\``, '');
	const v = absatz(vorher, ankerAlt ?? ankerNeu, art);
	const n = absatz(jetzt, ankerNeu, art);
	if (!n) throw new Error(`${pfad}: Anker «${ankerNeu}» nicht gefunden.`);
	aus('**Bisher:**', '');
	zitat(v);
	aus('**Neu:**', '');
	zitat(n);
}

// ---------------------------------------------------------------------------

aus(
	'# Zu prüfen: Votum, Lesarten Block 8 (Website-Fassung und Handbuch)',
	'',
	`**Stand:** 22.10.2026, Runde ${RUNDE}. Erzeugt mit \`versammlung/scripts/pruefdatei-block8.mjs\``,
	`aus dem Abzug der Fassung ${neu.fassung} (bisher auf der Website: ${alt.fassung}) und den`,
	'Dateien von Website und Handbuch im Arbeitsstand, je mit dem Stand im letzten Commit.',
	'',
	'## Worum es geht',
	'',
	'Votum lässt jede Gemeinschaft an fünf umstrittenen Stellen die Lesart wählen (L1 bis L5).',
	'Dieser Block bringt das auf die Website (Quorum-Finder, Ratgeber, `llms.txt`) und ins',
	'Handbuch von Votum.',
	'',
	'**Zwei Leserkreise, zwei Massstäbe.**',
	'',
	'- **Website:** jemand ohne Votum, der eine Versammlung vorbereitet oder einen Beschluss',
	'  verstehen will. Dort stellt niemand etwas ein, und nichts rechnet. Deshalb sagt die Website',
	'  je Streitfrage, von welcher Seite die Karte ausgeht, nennt die andere mit Fundstelle und',
	'  den Weg, der nach beiden Seiten trägt. Sie sagt **nicht**, die Gemeinschaft könne umstellen,',
	'  und nennt Votum nirgends (Produktentscheid 22.10.2026: «Beide Seiten, sicherer Weg»).',
	'- **Handbuch:** die Verwaltung oder Sitzungsleitung, die Votum bedient. Dort heisst die',
	'  Vorgabe umstellbar.',
	'',
	'**Neu auf der Website ausser den Lesarten**, aus der Prüfung der nachträglichen Zustimmung',
	'vom 22.10.2026 (`quellen` `pruefung/berichte/2026-10-22-nachtraegliche-zustimmung*.md`):',
	'',
	'- Die Karten mit Einstimmigkeit zeigen neu, was gilt, wenn an der Versammlung eine',
	'  Zustimmung fehlt (Abschnitt «Weg der Einstimmigkeit»). Der frühere Satz «Zustimmungen sind',
	'  nachträglich schriftlich einzuholen» ist weg (Prüfbericht 2026-10-22).',
	'- Darunter auf der Website zwei Sätze: zur Unterschrift bei einer Wohnung mit mehreren',
	'  Berechtigten (Rz. 22 ad Art. 712o; uneinheitlich Rz. 125 ad Art. 712m, `fragen.md` Frage 38)',
	'  und zur Anfechtung, wenn ein Beschluss ohne die nötigen Zustimmungen trotzdem als',
	'  angenommen festgehalten wird (Fachprüfung N-4; BGE 143 III 537 E. 4.2.4).',
	'- An der Karte zur eigenen Schranke des Reglements Frist und offene Wirkung des Urteils',
	'  bei der Anfechtung einer Ablehnung (Laienprüfung L11-1, Fachprüfung F10-1; Rz. 234, 235a',
	'  ad Art. 712m). Die Schwesterkarte «Reglement: Inhalte ausserhalb der Nutzungs- und',
	'  Verwaltungsordnung» nennt auf der Website keine Anfechtung; dort ist nichts ergänzt.',
	'',
	'**Was nicht zu prüfen ist:** Karten und Sätze, die schon auf der Website stehen und sich',
	'nicht ändern. Einige ältere Karten ohne Lesart der Gemeinschaft sagen weiter «dieses',
	'Werkzeug» (etwa Ausschlussklage, Prozessführung, luxuriöse Massnahme); sie sind geprüfter',
	'Bestand und nicht Teil dieses Blocks. Wer dort einen Fehler sieht, meldet ihn am Rand.',
	'',
	'Volltexte: `quellen/themen/stockwerkeigentum/README.md`, «Wo die Volltexte liegen».',
	''
);

// Ab Runde 2: wie die Befunde der Vorrunde behandelt sind, aus einer Datei
// ausserhalb des Repos (`RUNDEN_DATEI`), weil sie nur für die Prüfung gilt.
if (RUNDE >= 2 && process.env.RUNDEN_DATEI) {
	const behandelt = readFileSync(process.env.RUNDEN_DATEI, 'utf-8');
	aus('## Was seit der letzten Runde geändert ist', '', behandelt.trim(), '');
}

// --- Teil A: Quorum-Finder --------------------------------------------------

aus('## A. Quorum-Finder: Rahmen der Karte', '');
const finder = beide(SITE, 'src/components/QuorumFinder.astro');
aus(
	'Signet über dem Kartentitel, je nach Richtung der Streitfrage:',
	'',
	'> Streitfrage · streng ausgelegt',
	'',
	'> Streitfrage zum Mehr · mild ausgelegt, sicherer Weg auf der Karte (neu)',
	'',
	'Neuer Abschnitt unter «Enthaltungen und Abwesende», nur an Karten mit Einstimmigkeit:',
	'',
	'> **Wenn eine Zustimmung fehlt**',
	''
);
const fussAlt = (finder.vorher.match(/Stand des Regelwerks: [^<]*?·([^·<]*?)·/) ?? [])[1];
const fussNeu = (finder.jetzt.match(/Stand des Regelwerks: [^<]*?·([^·<]*?)·/) ?? [])[1];
aus('Fusszeile jeder Karte, Teilsatz:', '', '**Bisher:**', '');
zitat(fussAlt?.trim());
aus('**Neu:**', '');
zitat(fussNeu?.trim());

aus('## B. Neue und geänderte Fragen', '');
for (const f of neu.fragen) {
	const a = altFragen.get(f.id);
	if (!a || JSON.stringify(a) !== JSON.stringify(f)) frage(f);
}

aus('## C. Neue und geänderte Karten', '');
aus(
	'Gezeigt wird die ganze Karte im Website-Wortlaut. «(geändert)» heisst: anders als auf der',
	'Website bis heute. Karten, die sich nur im Weg der Einstimmigkeit ändern, stehen im',
	'Abschnitt D mit ihrem Titel.',
	''
);
const nurWeg = [];
for (const k of neu.knoten) {
	const a = altKnoten.get(k.id);
	const geaendert = !a
		? ['neu']
		: Object.keys(k).filter((f) => !['streitfrageRichtung', 'lesart'].includes(f) && JSON.stringify(a[f] ?? null) !== JSON.stringify(k[f] ?? null));
	if (geaendert.length === 0) continue;
	if (geaendert.length === 1 && geaendert[0] === 'einstimmigkeitsweg') {
		nurWeg.push(k);
		continue;
	}
	karte(k);
}

aus('## D. Weg der Einstimmigkeit (neu angezeigt)', '');
aus(
	'Erscheint auf der Karte unter «Wenn eine Zustimmung fehlt». Die letzten beiden Sätze jeder',
	'Fassung (Wohnung mit mehreren Berechtigten, Anfechtung) stehen nur auf der Website.',
	''
);
wege.forEach((w, i) => {
	const karten = neu.knoten.filter((k) => k.einstimmigkeitsweg === w);
	aus(`### W${i + 1}: ${karten.map((k) => `${lesbar(k.titel)} ${kennung(k.id)}`).join('; ')}`, '');
	zitat(lesbar(w));
});
aus(
	`Karten, die sich sonst nicht ändern: ${nurWeg.map((k) => `${lesbar(k.titel)} (${wegNummer(k)})`).join('; ')}.`,
	''
);

// --- Teil E: Website-Seiten --------------------------------------------------

aus('## E. Ratgeber, Quorum-Seite und llms.txt', '');
aus('Je der ganze Absatz, bisher und neu. `llms.txt` liest kein Mensch, sondern ein Sprachmodell.', '');
const FAQ = 'src/content/landingSections/faq.md';
const QUORUM = 'src/pages/ratgeber/quorum.astro';
const LLMS = 'public/llms.txt';
stelle(SITE, QUORUM, 'Quorum-Seite, Fussnote zum Finder', 'Meist geht die Karte', 'die strengere Auslegung gewählt', 'block');
stelle(SITE, QUORUM, 'Quorum-Seite, Beschlussfähigkeit (L5)', 'Traktandenliste stand, ist das nicht geklärt', 'genügt ein Drittel aller Eigentümer nach Köpfen', 'block');
stelle(SITE, FAQ, 'Ratgeber, Verweis auf den Quorum-Finder', 'meist streng ausgelegt', 'im Zweifel streng ausgelegt', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Reglement mit Zustimmung aller (L2)', 'An einer Stelle verlangt derselbe Kommentar', 'Das lässt sich mit einfachem Mehr regeln', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Ausgabenlimite der Bewirtschaftung (L2)', 'genügt zur Anpassung nach dem SVIT-Kommentar', 'genügt zur Anpassung das einfache Mehr', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Wahl der Bewirtschaftung (L4)', 'ist umstritten, ob für ihre Wahl', 'Es lohnt sich also, Vollmachten zu organisieren', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Beschlussfähigkeit der zweiten Versammlung (L5)', 'Ob das Drittel auch für ein Geschäft genügt', 'Damit bleibt die Gemeinschaft handlungsfähig', 'zeile');
stelle(SITE, LLMS, 'llms.txt, Einstimmigkeit (L2)', 'an einer Stelle verlangt er dafür das qualifizierte Mehr', 'lässt sich mit einfachem Mehr regeln', 'zeile');
stelle(SITE, LLMS, 'llms.txt, Beschlussfähigkeit (L5)', 'ob das Drittel auch für ein Geschäft genügt', 'eine zweite Versammlung ist bereits mit einem Drittel nach Köpfen', 'zeile');
stelle(SITE, LLMS, 'llms.txt, Verweis auf den Quorum-Finder', 'meist streng ausgelegt', 'im Zweifel streng ausgelegt', 'zeile');
stelle(SITE, LLMS, 'llms.txt, Mehrheiten (L4, sicherer Weg)', 'sicher ist die Wahl mit qualifiziertem Mehr', 'wenn das Reglement seine Befugnisse erweitert (in der Lehre umstritten)', 'zeile');
stelle(SITE, LLMS, 'llms.txt, Ausschuss (C2, Fachprüfung F8-2)', 'Gar nicht abgeben kann sie Beschlüsse', 'Nicht abgeben kann sie, was das Gesetz', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Was macht eine Bewirtschaftung (Fachprüfung F8-3)', 'brauchen einen eigenen Beschluss der Versammlung', 'im Vertrag erweitern oder einschränken', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Ausschuss (C2, Fachprüfung F8-2)', 'Gar nicht abgeben kann sie Beschlüsse', 'kann sie nicht an den Ausschuss abgeben', 'zeile');
stelle(SITE, FAQ, 'Ratgeber, Pflichtenheft (C1, Fachprüfung F8-1)', 'Bauliche Massnahmen und das Reglement lassen sich gar nicht übertragen', 'lässt sich gar nicht übertragen', 'zeile');
stelle(SITE, 'src/pages/ratgeber.astro', 'Ratgeber-Übersicht, Kachel Quorum-Finder (Fachprüfung F8-7)', 'meist streng ausgelegt', 'im Zweifel streng ausgelegt', 'block');
stelle(SITE, 'src/pages/index.astro', 'Startseite, Zeile unter dem Quorum-Finder (Fachprüfung F8-7)', 'Streitfragen ausgewiesen, mit dem sicheren Weg', 'Streitfragen ausgewiesen, im Zweifel streng', 'block');

// --- Teil F: Handbuch ----------------------------------------------------------

aus('## F. Handbuch von Votum', '');
aus(
	'Leser: Verwaltung und Sitzungsleitung, die Votum bedienen. Der Abschnitt ist neu; die',
	'Tabelle vergleicht ein Test mit dem Katalog der Anwendung.',
	''
);
const HB = 'docs/versammlung-fuehren.md';
const hb = beide(HIER, HB);
const anf = hb.jetzt.indexOf('### Lesarten der Gemeinschaft\n');
const rest = hb.jetzt.slice(anf);
const ende = rest.indexOf('\n### ', 5);
aus('### Neuer Abschnitt «Lesarten der Gemeinschaft»', '', '````markdown', rest.slice(0, ende).trim(), '````', '');
const hbStelle = (titel, ankerNeu, ankerAlt) => {
	const absatzMd = (text, anker) => {
		const teile = text.split(/\n\s*\n/);
		const t = teile.find((p) => p.includes(anker));
		return t ? t.replace(/\s+/g, ' ').trim() : null;
	};
	aus(`### ${titel}`, '', '**Bisher:**', '');
	zitat(absatzMd(hb.vorher, ankerAlt));
	aus('**Neu:**', '');
	const n = absatzMd(hb.jetzt, ankerNeu);
	if (!n) throw new Error(`${HB}: Anker «${ankerNeu}» nicht gefunden.`);
	zitat(n);
};
hbStelle('Zählweise der Kopfstimme (Verweis auf L3)', 'Dort zählt Votum nach der Vorgabe der', 'Schlagen Sie also nach.');
hbStelle('Tabelle der Reglementsregeln, Zeile «Zwingendes Recht» (C1, C2)', 'sie braucht die Zustimmung aller Eigentümer (Rz. 45', 'das letzte Wort gibt.');
hbStelle('Tabelle der Reglementsregeln, Zeile «Einordnen» (Ausschlussklage)', 'von Hand zählen müssen Sie sie nicht mehr', 'sicher ist die Ermächtigung erst');

process.stdout.write(zeilen.join('\n') + '\n');
