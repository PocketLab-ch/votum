/**
 * Durchstich: Lesart L13, Zählweise der Köpfe bei der «Mehrheit aller
 * Miteigentümer» (Migration 192, Fassung 2026-11-14, Entscheid 0048,
 * Antworten 4 bis 6, 9 und 10, Absatz «Beim Bau von Block C festgelegt»).
 *
 * **Der Weg.** Zwei Gemeinschaften mit je sechs Eigentümern zu 170, 170, 170,
 * 170, 160 und 160 von 1000. Die erste bleibt auf der Vorgabe «Anwesende und
 * Vertretene», die zweite stellt L13 auf «Alle Eigentümer», setzt die
 * Enthaltungsklausel (Angaben) und hinterlegt für die Benutzungsweise eine
 * Regel «mindestens drei Fünftel der Anwesenden und Vertretenen». Alle sechs
 * sind im Saal; der fünfte (160) tritt an jedem Traktandum in den Ausstand.
 * Abgestimmt wird überall gleich: drei Ja (510 Wertquoten), zwei Nein.
 *
 *   - **Art. 647b Abs. 1** (`k-verwaltung-wichtig`, Punkt 1): Unter
 *     «Anwesende» zählen 5 Köpfe, nötig 3: angenommen. Unter «Alle» bleibt der
 *     Ausstand in der Zahl (Antwort 9): 6 Köpfe, nötig 4: abgelehnt. Die
 *     Wertquoten (510 von 1000, nötig 501) reichen in beiden; den Unterschied
 *     macht allein der Ausstand. Nähme die Rechnung ihn unter «Alle» heraus
 *     (der Plan vor Antwort 9), käme dort 3 von 5 heraus und der Schritt wäre rot.
 *   - **Art. 647d** (`k-baulich-nuetzlich`), **Reglement** (`k-benutzungsweise`
 *     mit Regel) und **Enthaltungsklausel** (`k-baulich-notwendig`, Punkt 3):
 *     unter «Alle» je 3 Ja von 5 Kopfstimmen, angenommen, ohne Kartensatz und
 *     ohne zweites Ergebnis zur Zählweise; an der Klausel die Sätze aus
 *     Abschnitt 6 der Endfassung (Antwort 10).
 *   - **Rückkommen** (Punkt 4): Ein zweites Traktandum nach Art. 647b Abs. 1
 *     wird mit vier Ja angenommen (4 von 6, nötig 4). Am Rückkommen darauf
 *     sind drei im Ausstand, damit die Leitung ihren Satz zur Zählung zeigt;
 *     drei Ja, abgelehnt (3 von 6, nötig 4; unter den Anwesenden wären es 3
 *     von 3, nötig 2). Ohne Kartensatz, Protokollzeile und zweites Ergebnis
 *     zu L13; die zwei erklärenden Sätze zur Zählung stehen (Leitung vor der
 *     Abstimmung, Protokoll).
 *   - **Auszählmappe** (Punkt 5): heruntergeladen nach der Freigabe, mit den
 *     Stimmen des Saals ausgefüllt und von LibreOffice gerechnet, wie in
 *     `scripts/mappe-nachrechnen.mjs` (das Skript selbst rechnet nur eigene
 *     Mappen und nimmt keine Datei an). Einmal mit 9, einmal mit 7 für den
 *     Ausstand: Die Ausschlussklage derselben Versammlung lässt die Mappe die
 *     7 erklären, und am Traktandum unter «Alle» muss die 7 wie die 9 rechnen.
 *
 * Kriterien: Auftrag `.auftraege/2026-11-13-votum-c-zaehlweise-lesart.md`,
 * Akzeptanzkriterien 1 (Art. 647b gegen 647d und Reglement), 5 (Protokoll,
 * Karte, Mappe) und 7 (Wortlaut), dazu die fünf Punkte im Abschnitt «Danach»,
 * Unterabschnitt «Durchstich L13»: (1) Ausstand unter «Alle» wie ein Nein, (2)
 * zweites Ergebnis im Protokoll, (3) keine Wirkung unter 647d, Reglement und
 * Klausel, (4) Rückkommen, (5) Mappe gleich dem Kern. Dort steht auch, warum
 * ein eigenes Drehbuch und kein Schritt in `durchspielen.mjs`
 * (Produktentscheid 14.11.2026).
 *
 * **Wortlaut.** Jeder geprüfte Satz steht wörtlich in
 * `tests/waechter/endfassung-regel43.test.ts`. Das Drehbuch liest die Datei
 * beim Start und bricht ab, wenn eine Satzkonstante dort fehlt. Wo ein Satz
 * Zahlen oder eine Wahl trägt, ist die Konstante der Satz des Wächters, und
 * die Zahlen dieses Falls werden erst danach eingesetzt (`eingesetzt`). Eine
 * Ausnahme, an ihre Vorlage im Code gebunden: der Satz zum zweiten Ergebnis
 * nach L1 (`L1_GLEICH`). Jede Prüfung «fehlt» hat einen Anker auf derselben
 * Seite, der nur dort steht, wo der gesuchte Satz stehen könnte (aufgeklappter
 * Teil der Traktandenseite, Karte des aufgerufenen Traktandums, Abschnitt des
 * Protokolls), und sucht einen Stamm statt des ganzen Satzes, wo am selben
 * Traktandum keine der beiden Wahlen stehen darf. Dass die Karte ein zweites
 * Ergebnis überhaupt zeigt, prüfen Schritte mit «steht», bevor andere sein
 * Fehlen prüfen.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»); für die Mappe `soffice` und `python3`
 * auf dem Wirt:
 *
 *     node e2e/lesarten-l13.mjs
 *
 * Die Namen beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt
 * sie mit. Unter `AUFNAHMEN` legt der Lauf je Messpunkt den gelesenen Text ab.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l13';
const WAECHTER = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'waechter', 'endfassung-regel43.test.ts');

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Dubach', 'Egli', 'Furrer'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['170', '170', '170', '170', '160', '160'];
const [AEBI, BUCHER, CHRISTEN, DUBACH, EGLI, FURRER] = LEUTE;
/** Drei Ja zu 170, zwei Nein, der fünfte im Ausstand. */
const DREI_ZU_ZWEI = [
	[AEBI, 'yes'],
	[BUCHER, 'yes'],
	[CHRISTEN, 'yes'],
	[DUBACH, 'no'],
	[FURRER, 'no']
];

const T_WICHTIG = 'Neuer Hauswartvertrag';
const T_NUETZLICH = 'Velounterstand im Hof';
const T_REGLEMENT = 'Waschküche als Gemeinschaftsraum';
const T_KLAUSEL = 'Ersatz der Heizungspumpe';
const T_RUECKKOMMEN = 'Neuer Liftwartungsvertrag';
const T_KLAGE = 'Ermächtigung zur Ausschlussklage';
const REGEL_FUNDSTELLE = 'Art. 14 Abs. 2 Reglement (erfunden)';
/** Die Fundstelle der Klausel wie im Wächter (Zeile 397), damit der Nachsatz wörtlich passt. */
const KLAUSEL_FUNDSTELLE = 'Art. 12 Abs. 3 Reglement (erfunden)';

/*
 * ── Sätze aus dem Wächter (`tests/waechter/endfassung-regel43.test.ts`) ──
 * Je Konstante die Gruppe und die Zeile im Wächter beim Stand cbb39335.
 */
/** Katalog L13, Frage (Zeile 116). */
const FRAGE = 'Zählen bei Beschlüssen, für die das Gesetz die «Mehrheit aller Miteigentümer» verlangt, nur die Köpfe der Anwesenden und Vertretenen oder die aller Eigentümer?';
/** Katalog L13, Wirkung «alle», Antwort 9 (Zeile 128). */
const WIRKUNG_ALLE = 'Wer fehlt und keine Vollmacht gegeben hat, wirkt wie ein Nein, ebenso wer im Ausstand ist.';
/** Abschnitt 2, Kartensatz «anwesende» (Zeilen 251, 252). */
const KARTE_ANWESENDE_1 = 'Die Köpfe zählt Votum hier unter den Anwesenden und Vertretenen; das ist die Standardeinstellung.';
const KARTE_ANWESENDE_2 = 'Nach der anderen Zählweise («Alle Eigentümer») zählten alle Eigentümer, und wer fehlt, ohne eine Vollmacht zu geben, wirkte wie ein Nein.';
/** Abschnitt 2, Kartensatz «alle» (Zeilen 254, 255). */
const KARTE_ALLE_1 = 'Die Köpfe zählt Votum hier unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist; die Standardeinstellung wäre die Zählung unter den Anwesenden und Vertretenen.';
const KARTE_ALLE_2 = 'Wer fehlt, ohne eine Vollmacht zu geben, wirkt wie ein Nein, ebenso wer im Ausstand ist, also nicht mitstimmen darf, weil es um ein Geschäft oder einen Streit zwischen ihm und der Gemeinschaft geht.';
/**
 * Die Stämme der Sätze aus Abschnitt 2 und 3, beide Wahlen (Zeilen 251/254 und
 * 262/264), für die Prüfungen «fehlt» (Codeprüfung, Befund 4): Ein Stamm trifft
 * auch eine Fassung, die vom ganzen Satz abweicht. Nicht dort, wo am selben
 * Traktandum der Satz der anderen Wahl stehen darf; dort bleibt der ganze Satz.
 */
const STAMM_KARTE = 'Die Köpfe zählt Votum hier';
const STAMM_PROT = 'Köpfe gezählt unter';
/** Abschnitt 3, Protokollzeilen (Zeilen 262 bis 265). */
const PROT_ANWESENDE_1 = 'Köpfe gezählt unter den Anwesenden und Vertretenen, wie die herrschende Lehre, die Auffassung der meisten Fachleute (Vorgabe von Votum).';
const PROT_ANWESENDE_2 = 'Ob hier alle Eigentümer zählen, ist umstritten.';
const PROT_ALLE_1 = 'Köpfe gezählt unter allen Eigentümern, wie es für diese Versammlung eingestellt war.';
const PROT_ALLE_2 = 'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das wäre auch die Vorgabe von Votum.';
/**
 * Allgemeiner Satz zum zweiten Ergebnis an L13, als Vorlage mit Zahlen des Wächters (Gruppe «Rückrichtung»),
 * mit dem, was die andere Zählweise an Art. 647b Abs. 1 verlangt (Auftrag «Texte nach 0047», Punkt 3a).
 */
const ZWEITES_VORLAGE = 'Nach der anderen Zählweise («Alle Eigentümer»: mehr als die Hälfte aller Eigentümer, auch der abwesenden, und mehr als die Hälfte aller Wertquoten), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 5 Ja von 10 Kopfstimmen, nötig 6';
/** Was die Zählweise «Anwesende und Vertretene» an Art. 647b Abs. 1 verlangt, statt der Vorlage. */
const VERLANGT_ANWESENDE = 'mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten';
/** Rat an die Leitung nach einer Annahme, die unter allen scheiterte (Zeilen 244, 166, 169). */
const GERICHT_FOLGT = 'Folgt das Gericht der anderen Zählweise, hebt es ihn auf.';
const NACH_ANNAHME_1 = 'Die Zählung folgt der herrschenden Lehre; ob Sie mit der Ausführung zuwarten, wägen Sie am Geschäft ab.';
const NACH_ANNAHME_2 = 'Eilt die Arbeit, darf der Beschluss ausgeführt werden, denn er gilt.';
/** Rat an die Leitung nach einer Ablehnung, die unter den Anwesenden angenommen wäre (Zeilen 171, 172). */
const NACH_ABLEHNUNG_1 = 'Für die nächste Versammlung: Holen Sie vorher Vollmachten ein.';
const NACH_ABLEHNUNG_2 = 'Bei der Zählweise «Alle Eigentümer» wirkt jeder, der fehlt und niemanden bevollmächtigt, wie ein Nein.';
/**
 * **Nicht aus dem Wächter:** der Satz der Ergebniskarte zum zweiten Ergebnis
 * nach L1 (Codeprüfung, Befund 2). L1 gehört nicht zur Endfassung Block C;
 * der Satz entsteht aus der Vorlage in `src/lib/domain/auszaehlung.ts`
 * (`leitung: \`Nach der anderen ${wort} («${r.wahl}») dasselbe Ergebnis.\``),
 * und an diese Vorlage bindet ihn Schritt 1 (`L1_GLEICH_VORLAGE`).
 */
const L1_GLEICH = 'Nach der anderen Lesart («Wertquote fällt heraus») dasselbe Ergebnis.';
const L1_GLEICH_VORLAGE = 'leitung: `Nach der anderen ${wort} («${r.wahl}») dasselbe Ergebnis.`';
const AUSZAEHLUNG = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'domain', 'auszaehlung.ts');
/** Der Anfang jedes Satzes zum zweiten Ergebnis an L13, für die Prüfungen «fehlt» (Zeilen 252, 394). */
const ZWEITES_ANFANG = 'Nach der anderen Zählweise';
/** `protokollNachAnnahme` (Zeilen 178, 179). */
const PROT_NACH_ANNAHME_1 = 'Der Beschluss gilt, bis ein Gericht ihn aufhebt.';
const PROT_NACH_ANNAHME_2 = 'Das Bundesgericht hat für diese Art von Beschluss nicht entschieden, ob alle Eigentümer zählen.';
/** `protokollNachAblehnung` (Zeilen 181, 183). */
const PROT_NACH_ABLEHNUNG_1 = 'Die Ablehnung gilt, bis die Versammlung neu beschliesst oder ein Gericht sie aufhebt.';
const PROT_NACH_ABLEHNUNG_2 = 'Hebt das Gericht die Ablehnung auf, ist der Antrag damit nicht angenommen.';
/** Abschnitt 4a, Art. 647d (Zeilen 276, 277). */
const W4A_1 = 'Gezählt werden trotzdem die Köpfe der Anwesenden und Vertretenen: So hat es das Bundesgericht für nützliche bauliche Massnahmen bestätigt, der herrschenden Lehre folgend (BGE 144 III 510 E. 2.2.4; SVIT-Kommentar Rz. 181 und 190 f. ad Art. 712m).';
const W4A_2 = 'Die Einstellung Ihrer Gemeinschaft zur Zählweise gilt hier deshalb nicht.';
/** Abschnitt 4c, nur unter «alle» (Zeilen 396, 280), {Gericht} zu Art. 647b Abs. 1 (Zeile 282). */
const W4C_1 = 'Die Einstellung Ihrer Gemeinschaft, die Köpfe an allen Eigentümern zu zählen, ist keine Bestimmung Ihres Reglements und bindet ein Gericht nicht.';
const W4C_2 = 'Soll diese Zählung unabhängig vom Streit gelten, gehört sie ins Reglement; dafür braucht es die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 186 ad Art. 712m) und eine klare Formulierung (BGE 144 III 510 E. 2.2.4).';
const GERICHT_647B = 'Das Bundesgericht hat diese Zählung nur für nützliche bauliche Massnahmen bestätigt (BGE 144 III 510 E. 2.2.4), für wichtigere Verwaltungshandlungen nicht entschieden.';
/** Abschnitt 6, Karte und Protokoll unter der Enthaltungsklausel (Zeilen 300 bis 304, 397). */
const KLAUSEL_KARTE_1 = 'Ihre Gemeinschaft hat für die Köpfe «Alle Eigentümer» eingestellt.';
const KLAUSEL_KARTE_2 = 'Hier wirkt das nicht: Ihr Reglement zählt Enthaltungen beim einfachen Mehr nicht mit, und Votum wendet das an.';
const KLAUSEL_KARTE_3 = 'Gezählt werden deshalb die Anwesenden und Vertretenen ohne die Enthaltungen.';
const KLAUSEL_PROT_1 = 'Gezählt nach dem Reglement: die Anwesenden und Vertretenen ohne die Enthaltungen.';
const KLAUSEL_PROT_2 = 'Die für die Gemeinschaft eingestellte Zählweise «Alle Eigentümer» wirkt hier nicht.';
const KLAUSEL_NACHSATZ = 'Ihre Gemeinschaft hat eine solche Zählweise eingestellt (Art. 12 Abs. 3 Reglement (erfunden)); Votum zählt hier deshalb ohne Enthaltungen, siehe oben und den Absatz zum Reglement.';
/** Abschnitt 7, R5-F-4: an den Reglementskarten der vier Artikel (Zeilen 320, 322). */
const REGEL_VERGLEICH = 'Erreicht der Beschluss auch das gesetzliche Erfordernis, kommt es auf Ihre Bestimmung nicht an; den Vergleich rechnen Sie aus dem Stimmenspiegel selbst.';
const REGEL_SICHER = 'Im Streit um die Zählweise der Köpfe sicher ist er, wenn mehr als die Hälfte aller Eigentümer zugestimmt hat.';
/** Die zwei erklärenden Sätze am Rückkommen (Zeilen 385 und 356, dort mit «bei 10»). */
const RUECKKOMMEN_STREIT = 'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern, wie am Beschluss selbst; die herrschende Lehre zählt nur die Anwesenden und Vertretenen.';
const AUSSTAND_RUECKKOMMEN_VORLAGE = 'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer», wie beim ursprünglichen Beschluss, in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10.';
/** Dieselbe Zeile am Beschluss (Zeile 355, «bei 10»). */
const AUSSTAND_BESCHLUSS_VORLAGE = 'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer» in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10.';
/**
 * Block D: Schluss der Anleitung der Mappe zur 9, wo eine Hauptspalte unter
 * allen zählt (aus Zeile 416). Nur der Schluss: Mit der Ausschlussklage in
 * derselben Versammlung nennt die Zeile davor auch die unmittelbar
 * Betroffenen, und der Anfang lautet anders.
 */
// Endwortlaut T7a der Textrunde zu den Pendenzen nach Regel 43 (Fassung 2026-11-16).
const MAPPE_NEUN = 'Setzen Sie die 9 auch dort, wo die Köpfe unter allen Eigentümern zählen, nach der Einstellung Ihrer Gemeinschaft oder weil die Sitzungsleitung das Mehr so gesetzt hat. Wer im Ausstand ist, bleibt dann in der Zahl aller Eigentümer und wirkt wie ein Nein. Die Mappe weiss, bei welchen Traktanden das gilt, und rechnet es selbst.';

const SAETZE = {
	FRAGE, WIRKUNG_ALLE, STAMM_KARTE, STAMM_PROT, KARTE_ANWESENDE_1, KARTE_ANWESENDE_2, KARTE_ALLE_1, KARTE_ALLE_2,
	PROT_ANWESENDE_1, PROT_ANWESENDE_2, PROT_ALLE_1, PROT_ALLE_2, ZWEITES_VORLAGE,
	ZWEITES_ANFANG, GERICHT_FOLGT, NACH_ANNAHME_1, NACH_ANNAHME_2, NACH_ABLEHNUNG_1, NACH_ABLEHNUNG_2,
	VERLANGT_ANWESENDE, PROT_NACH_ANNAHME_1, PROT_NACH_ANNAHME_2, PROT_NACH_ABLEHNUNG_1, PROT_NACH_ABLEHNUNG_2,
	W4A_1, W4A_2, W4C_1, W4C_2, GERICHT_647B,
	KLAUSEL_KARTE_1, KLAUSEL_KARTE_2, KLAUSEL_KARTE_3, KLAUSEL_PROT_1, KLAUSEL_PROT_2, KLAUSEL_NACHSATZ,
	REGEL_VERGLEICH, REGEL_SICHER, RUECKKOMMEN_STREIT, AUSSTAND_RUECKKOMMEN_VORLAGE,
	AUSSTAND_BESCHLUSS_VORLAGE, MAPPE_NEUN
};

/**
 * Setzt in einen Satz des Wächters die Werte dieses Falls ein. Jede ersetzte
 * Stelle muss genau einmal im Satz stehen, sonst bricht der Lauf ab: Ein
 * Ersatz, der nichts trifft, liesse den Satz des Wächters stehen.
 */
function eingesetzt(satz, ersetzungen) {
	let ergebnis = satz;
	for (const [alt, neu] of ersetzungen) {
		const treffer = ergebnis.split(alt).length - 1;
		if (treffer !== 1) throw new Error(`«${alt}» steht ${treffer}-mal in «${satz}»`);
		ergebnis = ergebnis.replace(alt, neu);
	}
	return ergebnis;
}

/** Das zweite Ergebnis nach der anderen Zählweise, ohne den Schlusspunkt (dahinter folgen die Wertquoten). */
function zweitesErgebnis(wahl, ausgang, ja, basis, noetig) {
	return eingesetzt(ZWEITES_VORLAGE, [
		['«Alle Eigentümer»', `«${wahl}»`],
		...(wahl === 'Alle Eigentümer' ? [] : [['mehr als die Hälfte aller Eigentümer, auch der abwesenden, und mehr als die Hälfte aller Wertquoten', VERLANGT_ANWESENDE]]),
		['abgelehnt gewesen', `${ausgang} gewesen`],
		['5 Ja von 10 Kopfstimmen, nötig 6', `${ja} Ja von ${basis} Kopfstimmen, nötig ${noetig}`]
	]);
}

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

function sauber(text) {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function ablegen(name, text) {
	await writeFile(`${AUFNAHMEN}/${name}.txt`, `${text}\n`).catch(() => {});
}

/** Steht, und an derselben Seite steht der Anker: So wird «fehlt» nicht an einer leeren Seite grün. */
function steht(text, satz, wo) {
	behaupte(text.includes(satz), `${wo}: fehlt «${satz.slice(0, 120)}»: ${text.slice(0, 1600)}`);
}
function fehlt(text, satz, wo, anker) {
	behaupte(text.includes(anker), `${wo}: der Anker «${anker.slice(0, 80)}» fehlt, die Seite taugt nicht für «fehlt»`);
	behaupte(!text.includes(satz), `${wo}: steht, sollte fehlen: «${satz.slice(0, 120)}»`);
}

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»`);
	await auswahl.selectOption(treffer.wert);
}

let browser;
let kontext;
let seite;

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ✓ ${nr} ${titel}${ergebnis ? `: ${ergebnis}` : ''}`);
	} catch (f) {
		fehler.push({ nr, titel, text: f.message });
		console.log(`  ✗ ${nr} ${titel}\n     ${f.message}`);
		try {
			await seite.screenshot({ path: `${AUFNAHMEN}/fehler-${nr}.png`, fullPage: true });
			console.log(`     Bild: ${AUFNAHMEN}/fehler-${nr}.png`);
		} catch {
			/* ohne Bild weiter */
		}
		throw f;
	}
}

async function abschicken(knopf) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
			.catch(() => null),
		knopf.click()
	]);
	await nachAbsendung(seite, antwort, nachladen, 300);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

async function seitentext() {
	const haupt = await seite.locator('main').innerText();
	const quittungen = await seite
		.locator('.einblender')
		.innerText()
		.catch(() => '');
	return sauber(`${haupt} ${quittungen}`);
}

/** Auf der Seite der Lesarten L13 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L13"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

/**
 * Eine Gemeinschaft mit den sechs Wohnungen. Der Name steht als Vorlage hier,
 * nicht als Parameter: `tests/waechter/testdatennamen.test.ts` muss ihn lesen
 * können, damit `scripts/testdaten-entfernen.sql` ihn sicher trifft.
 */
async function legeGemeinschaftAn(zusatz) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `Prüflauf Lesart L13 ${zusatz} ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `Nicht angelegt: ${seite.url()}`);
	for (const [i, wer] of LEUTE.entries()) {
		await gehe(`/gemeinschaften/${id}/einheiten`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
		await ef.locator('input[name="quote.stamm"]').fill(QUOTEN[i]);
		await abschicken(ef.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(wer);
		await abschicken(pf.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
		await abschicken(zf.locator('button[type="submit"]'));
	}
	return id;
}

async function legeVersammlungAn(gemeinschaft, datum) {
	await gehe('/versammlungen/neu');
	await seite.locator('input[name="art"][value="einzeln"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.fill('input[name="datum"]', datum);
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüfsaal');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const id = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `Nicht angelegt: ${seite.url()}`);
	return id;
}

async function legeTraktandumAn(versammlung, titel, knoten, wortlaut) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	await seite.locator('.neu button.haupt').click();
	await seite.waitForTimeout(250);
	const tf = seite.locator('form[action="?/anlegen"]').first();
	await tf.locator('input[name="titel"]').fill(titel);
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]').first().fill(wortlaut);
	await tf.locator('select[name="erfordernis"]').selectOption(knoten);
	await seite.waitForTimeout(300);
	await abschicken(tf.locator('button[type="submit"]').first());
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	behaupte(
		await seite.locator('li[data-traktandum]', { hasText: titel }).count(),
		`Das Traktandum «${titel}» steht nicht in der Liste`
	);
}

/**
 * Betroffene am angelegten Traktandum, im Formular «speichern»; das Formular
 * «anlegen» trägt kein Kästchen dafür (docs/proben.md, «Durchstiche L9 bis L12»).
 */
async function trageBetroffenenEin(versammlung, titel, wer) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	await seite.locator('li[data-traktandum]', { hasText: titel }).first().locator('button.titel').click();
	await seite.waitForTimeout(400);
	// Nach dem Laden ist nur dieses Traktandum aufgeklappt, wie in e2e/lesarten-l10.mjs.
	const form = seite.locator('form[action="?/speichern"]').first();
	const kaestchen = form.locator('label', { hasText: wer }).locator('input[name="betroffene"]').first();
	behaupte(await kaestchen.count(), `Das Kästchen für «${wer}» an «${titel}» fehlt`);
	await kaestchen.check();
	await abschicken(form.locator('button[type="submit"]').first());
}

/** Der Text eines Traktandums in der Liste, aufgeklappt (wie in e2e/lesarten-l12.mjs). */
async function traktandumtext(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const zeile = seite.locator('li[data-traktandum]', { hasText: titel }).first();
	await zeile.locator('button.titel').click();
	await seite.waitForTimeout(400);
	return sauber(await zeile.textContent());
}

/**
 * Der Text der Karte auf der Erfordernisseite des Traktandums: Begründung,
 * Hinweise und «Wortlaut und Rechtsprechung» zeigt die Traktandenseite nicht
 * (docs/proben.md, «Durchstiche L9 bis L12 gegen Dev»).
 */
async function kartentext(versammlung, titel, weg) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const id = await seite.locator('li[data-traktandum]', { hasText: titel }).first().getAttribute('data-traktandum');
	behaupte(id, `Das Traktandum «${titel}» steht nicht in der Liste`);
	await gehe(`/versammlungen/${versammlung}/traktanden/${id}/erfordernis?${weg}`);
	return sauber(await seite.locator('main').innerText());
}

async function erfasseAnwesend(versammlung, wer) {
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const zeile = seite.locator('tr', { hasText: wer }).first();
	behaupte(await zeile.count(), `Die Zeile von «${wer}» fehlt in der Anwesenheitsliste`);
	const knopf = zeile.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
	if (await knopf.count()) await abschicken(knopf.first());
}

/** Die Zeile eines Traktandums im Baum der Leitung, ohne den Rückkommensantrag, der den Titel mitträgt. */
function baumzeile(titel) {
	return seite.locator('.baum li', { hasText: titel }).filter({ hasNotText: 'Rückkommen auf' }).first();
}

/** Ein Traktandum aufrufen, den fünften in den Ausstand setzen und den Text vor der Abstimmung lesen. */
async function rufeAufMitAusstand(versammlung, zeile, imAusstand = [EGLI]) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const knopf = zeile().locator('form[action="?/aufrufen"] button[type="submit"]');
	behaupte(await knopf.count(), `Kein Knopf zum Aufrufen: ${(await seitentext()).slice(0, 600)}`);
	await abschicken(knopf.first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
	await seite.locator('.eingriffe .wort', { hasText: 'Ausstand' }).first().click();
	await seite.waitForTimeout(200);
	const form = seite.locator('form[action="?/ausstand"]');
	for (const wer of imAusstand) {
		await form.locator('input[type="search"]').fill(wer);
		await seite.waitForTimeout(200);
		const kaestchen = form.locator('.wahlliste label', { hasText: wer }).first().locator('input');
		await kaestchen.check();
	}
	await form.locator('input[type="search"]').fill('');
	await seite.waitForTimeout(200);
	for (const wer of imAusstand) {
		behaupte(
			await form.locator('.wahlliste label', { hasText: wer }).first().locator('input').isChecked(),
			`«${wer}» ist für den Ausstand nicht angekreuzt`
		);
	}
	await form.locator('input[name="grund"]').fill('Prüflauf: Vertrag mit einer eigenen Firma.');
	await abschicken(form.locator('button[type="submit"]'));
	await gehe(`/versammlungen/${versammlung}/leitung`);
	return seitentext();
}

/**
 * Stimmen in der Tabelle «von Hand erfassen» eintragen, mit dem Grund, der in
 * der geführten Versammlung Pflicht ist (sechs Parteien; `e2e/lesarten-l6-rueckkommen.mjs`).
 */
async function stimmeAb(stimmen) {
	await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
	await seite.evaluate(() => {
		document.querySelectorAll('details:has(form[action="?/erfassen"])').forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
	const form = seite.locator('form[action="?/erfassen"]').first();
	behaupte(await form.count(), `Keine Stimmerfassung: ${(await seitentext()).slice(0, 400)}`);
	await form.locator('input[name="begruendung"]').first().fill('Prüflauf: im Saal von Hand abgestimmt.');
	for (const [wer, wahl] of stimmen) {
		const radio = form.locator('tr', { hasText: wer }).first().locator(`input[type="radio"][value="${wahl}"]`).first();
		behaupte(await radio.count(), `In der Stimmerfassung fehlt die Zeile von ${wer}`);
		await radio.check();
	}
	await abschicken(form.locator('button[type="submit"]').first());
	const n = stimmen.length;
	const text = await seitentext();
	behaupte(
		new RegExp(`${n} von ${n} haben abgestimmt`).test(text),
		`Die Erfassung kam nicht an: ${text.match(/\d+ von \d+ haben abgestimmt/)?.[0] ?? text.slice(0, 600)}`
	);
	await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
}

/** Satz und ganzer Text der Ergebniskarte eines Traktandums auf der Leitungsseite. */
async function ergebnis(versammlung, titel, rueckkommen = false) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const karten = seite.locator('article.ergebnis', { hasText: rueckkommen ? 'Rückkommen auf' : titel });
	const karte = (rueckkommen ? karten : karten.filter({ hasNotText: 'Rückkommen auf' })).first();
	behaupte(await karte.count(), `Keine Ergebniskarte zu «${titel}»: ${(await seitentext()).slice(0, 900)}`);
	return {
		satz: sauber(await karte.locator('p.satz').first().innerText()),
		kasten: sauber(await karte.innerText())
	};
}

/** Den Abschnitt eines Traktandums aus dem Protokollentwurf, von seiner Überschrift bis zur nächsten. */
function abschnitt(roh, merkmal, ohne) {
	const zeilen = roh.split('\n');
	const istKopf = (z) => /^\s*(>\s*)?#{2,6} /.test(z);
	const anfang = zeilen.findIndex((z) => istKopf(z) && z.includes(merkmal) && !(ohne && z.includes(ohne)));
	behaupte(anfang >= 0, `Kein Abschnitt «${merkmal}» im Protokoll: ${sauber(roh).slice(0, 1500)}`);
	let ende = zeilen.findIndex((z, i) => i > anfang && istKopf(z));
	if (ende < 0) ende = zeilen.length;
	return sauber(zeilen.slice(anfang, ende).join('\n'));
}

async function protokollentwurf(versammlung) {
	await gehe(`/versammlungen/${versammlung}/protokoll`);
	await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
	return seite.locator('textarea[name="body"]').first().inputValue();
}

/*
 * ── Auszählmappe ────────────────────────────────────────────────────────
 * Ausfüllen über `python3 -I` (zipfile ist dort eingebaut), rechnen mit
 * LibreOffice wie in `scripts/mappe-nachrechnen.mjs`. Das Skript liest die
 * Zellen nach ihrer Beschriftung, nicht nach festen Bezügen, damit ein
 * geänderter Aufbau auffällt statt danebenzugreifen.
 */
const MAPPE_FUELLEN = String.raw`
import sys, json, re, zipfile, html
quelle, ziel, spez = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
with zipfile.ZipFile(quelle) as z:
    teile = [(i, z.read(i.filename)) for i in z.infolist()]
name = 'xl/worksheets/sheet1.xml'
blatt = next(d for i, d in teile if i.filename == name).decode('utf-8')
def spaltenzahl(b):
    n = 0
    for ch in b: n = n * 26 + ord(ch) - 64
    return n - 1
def spaltenname(n):
    s = ''
    n += 1
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s
zellen = {}
for m in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', blatt, re.S):
    t = re.search(r'<t[^>]*>(.*?)</t>', m.group(4) or '', re.S)
    zellen[(spaltenzahl(m.group(1)), int(m.group(2)))] = html.unescape(t.group(1)) if t else None
def zeile_mit(text):
    z = [r for (s, r), v in zellen.items() if s == 0 and v == text]
    if len(z) != 1: sys.exit('Zeile «%s» %d-mal in der Mappe' % (text, len(z)))
    return z[0]
r_partei, r_kopf, r_mehr = zeile_mit('Partei'), zeile_mit('Traktandum'), zeile_mit('Nötiges Mehr')
sp_anwesend = [s for (s, r), v in zellen.items() if r == r_partei and v == 'anwesend (1)']
if len(sp_anwesend) != 1: sys.exit('Spalte «anwesend (1)» nicht gefunden')
haupt = [s for (s, r), v in zellen.items() if r == r_kopf and v and v.endswith(' ' + spez['titel']) and 'zum Vergleich' not in v]
if len(haupt) != 1: sys.exit('Spalte des Traktandums «%s» %d-mal' % (spez['titel'], len(haupt)))
nummer = zellen[(haupt[0], r_kopf)].split(' ')[0]
vergleiche = sorted(s for (s, r), v in zellen.items() if r == r_kopf and v == nummer + ' zum Vergleich')
mehr = {str(s): zellen.get((s, r_mehr)) for s in [haupt[0]] + vergleiche}
def setze(s, r, wert):
    global blatt
    bezug = '%s%d' % (spaltenname(s), r)
    neu, n = re.subn(r'<c r="%s"( s="\d+")?/>' % bezug, lambda m: '<c r="%s"%s><v>%s</v></c>' % (bezug, m.group(1) or '', wert), blatt)
    if n != 1: sys.exit('Eingabezelle %s nicht leer oder nicht vorhanden' % bezug)
    blatt = neu
for partei, wert in spez['eintraege'].items():
    r = zeile_mit(partei)
    setze(sp_anwesend[0], r, 1)
    if wert is not None: setze(haupt[0], r, wert)
with zipfile.ZipFile(ziel, 'w', zipfile.ZIP_DEFLATED) as z:
    for i, d in teile:
        z.writestr(i, blatt.encode('utf-8') if i.filename == name else d)
print(json.dumps({'haupt': haupt[0], 'vergleiche': vergleiche, 'mehr': mehr}))
`;

/** Felder in Anführungszeichen dürfen ein Komma tragen (wie in `scripts/mappe-nachrechnen.mjs`). */
function csvZellen(text) {
	return text
		.trim()
		.split('\n')
		.map((z) => {
			const felder = [];
			let feld = '';
			let inAnfuehrung = false;
			for (const zeichen of z) {
				if (zeichen === '"') inAnfuehrung = !inAnfuehrung;
				else if (zeichen === ',' && !inAnfuehrung) {
					felder.push(feld.trim());
					feld = '';
				} else feld += zeichen;
			}
			felder.push(feld.trim());
			return felder;
		});
}

/** Füllt die Mappe, lässt LibreOffice rechnen und liest die Spalte des Traktandums samt Vergleichen. */
async function rechneMappe(quelle, kennung, titel, eintraege) {
	const ausgefuellt = `${AUFNAHMEN}/mappe-${kennung}.xlsx`;
	const lage = JSON.parse(
		execFileSync('python3', ['-I', '-c', MAPPE_FUELLEN, quelle, ausgefuellt, JSON.stringify({ titel, eintraege })], {
			encoding: 'utf8'
		})
	);
	/*
	 * **Die CSV vorher weg, danach auf Frische prüfen** (Codeprüfung, Befund 1):
	 * `soffice` endet auch dann mit Exit 0, wenn es die Quelle nicht laden kann.
	 * Eine CSV aus einem früheren Lauf läse sich sonst wie ein Ergebnis dieses
	 * Laufs. Das Profil liegt je Lauf in einem eigenen Verzeichnis, wie in
	 * `scripts/mappe-nachrechnen.mjs`, damit sich zwei Läufe nicht in die
	 * Quere kommen.
	 */
	const ziel = `${AUFNAHMEN}/mappe-${kennung}.csv`;
	rmSync(ziel, { force: true });
	const profil = mkdtempSync(join(tmpdir(), 'lesarten-l13-soffice-'));
	try {
		execFileSync(
			'soffice',
			[`-env:UserInstallation=file://${profil}`, '--headless', '--convert-to', 'csv', '--outdir', AUFNAHMEN, ausgefuellt],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
		);
	} finally {
		rmSync(profil, { recursive: true, force: true });
	}
	behaupte(
		existsSync(ziel),
		`LibreOffice hat keine CSV geschrieben (${ziel}); so zeigt sich eine unladbare Mappe oder ein fehlendes Calc`
	);
	const csv = await readFile(ziel, 'utf8');
	behaupte(csv.includes(LAUF), `Die gerechnete Mappe nennt die Gemeinschaft dieses Laufs (${LAUF}) nicht`);
	const tabelle = csvZellen(csv);
	const wert = (beschriftung, spalte) => {
		const z = tabelle.find((r) => r[0] === beschriftung);
		behaupte(z, `Die Zeile «${beschriftung}» steht nicht in der gerechneten Mappe`);
		return (z[spalte] ?? '').trim();
	};
	const spalte = (s) => ({
		mehr: lage.mehr[String(s)],
		jaKopf: wert('Ja (Kopfstimmen)', s),
		basisKopf: wert('Bezugsgrösse Kopfstimmen', s),
		noetigKopf: wert('Nötig (Kopfstimmen)', s),
		jaQuote: wert('Ja (Wertquoten)', s),
		basisQuote: wert('Bezugsgrösse Wertquoten', s),
		noetigQuote: wert('Nötig (Wertquoten)', s),
		ergebnis: wert('Ergebnis', s),
		weicht: lage.vergleiche.includes(s) ? wert('Weicht vom Traktandum ab?', s) : null
	});
	return { haupt: spalte(lage.haupt), vergleiche: lage.vergleiche.map(spalte), text: sauber(csv), tabelle };
}

/* ── Ablauf ─────────────────────────────────────────────────────────────── */

await mkdir(AUFNAHMEN, { recursive: true });
console.log(`\nLesart L13, Zählweise der Köpfe: ${ZIEL}\n`);

let g1;
let g2;
let v1;
let v2;
let mappe;

try {
	await schritt('Jeder geprüfte Satz steht wörtlich im Wächter', async () => {
		// Nach Zusammenfassen von Leerraum, auf beiden Seiten.
		const waechter = readFileSync(WAECHTER, 'utf8').replace(/\s+/g, ' ');
		const fehlen = Object.entries(SAETZE).filter(([, s]) => !waechter.includes(s.replace(/\s+/g, ' ')));
		behaupte(fehlen.length === 0, `Nicht im Wächter: ${fehlen.map(([n]) => n).join(', ')}`);
		// Und die Vorlagen tragen die Stellen, die `eingesetzt` ersetzt.
		zweitesErgebnis('Anwesende und Vertretene', 'angenommen', 3, 5, 3);
		eingesetzt(AUSSTAND_BESCHLUSS_VORLAGE, [['bei 10.', 'bei 6.']]);
		eingesetzt(AUSSTAND_RUECKKOMMEN_VORLAGE, [['hier 1 Partei', 'hier 3 Parteien'], ['bei 10.', 'bei 6.']]);
		// Der eine Satz ausserhalb des Wächters, an seine Vorlage im Code gebunden.
		behaupte(
			readFileSync(AUSZAEHLUNG, 'utf8').includes(L1_GLEICH_VORLAGE),
			`Die Vorlage des Satzes zu L1 steht nicht mehr in auszaehlung.ts: ${L1_GLEICH_VORLAGE}`
		);
		return `${Object.keys(SAETZE).length} Sätze an den Wächter gebunden, einer an auszaehlung.ts`;
	});
} catch {
	console.log(`\n${nr} Schritte, ${fehler.length} Befunde.\n`);
	process.exit(1);
}

browser = await chromium.launch({ args: ['--no-sandbox'] });
kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

try {
	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Zwei Gemeinschaften mit je sechs Wohnungen', async () => {
		g1 = await legeGemeinschaftAn('Anwesende');
		g2 = await legeGemeinschaftAn('Alle');
		return `…${g1.slice(-8)} und …${g2.slice(-8)}, je 4 × 170 + 2 × 160 von 1000`;
	});

	await schritt('Seite «Lesarten»: Vorgabe «Anwesende», zweite Gemeinschaft auf «Alle»', async () => {
		await gehe(`/gemeinschaften/${g1}/lesarten`);
		const text = await seitentext();
		steht(text, FRAGE, 'Lesarten');
		behaupte(
			await seite.locator('input[name="L13"][value="anwesende"]').isChecked(),
			'Die Vorgabe «Anwesende und Vertretene» ist nicht angekreuzt'
		);
		steht(text, WIRKUNG_ALLE, 'Lesarten, Wirkung «Alle Eigentümer»');
		await stelleUm(g2, 'alle');
		behaupte(await seite.locator('input[name="L13"][value="alle"]').isChecked(), 'Nach dem Speichern steht «alle» nicht');
		return 'erste auf der Vorgabe, zweite auf «Alle Eigentümer»';
	});

	await schritt('Zweite Gemeinschaft: Enthaltungsklausel und Regel für die Benutzungsweise', async () => {
		await gehe(`/gemeinschaften/${g2}/angaben`);
		await seite.locator('input[name="abstentionExcluded"]').check();
		await seite.waitForTimeout(150);
		await seite.locator('input[name="abstentionExcludedSource"]').fill(KLAUSEL_FUNDSTELLE);
		await abschicken(seite.locator('form[action="?/speichern"] button[type="submit"]').first());
		await gehe(`/gemeinschaften/${g2}`);
		steht(await seitentext(), `Enthaltungen zählen beim einfachen Mehr nicht mit (${KLAUSEL_FUNDSTELLE})`, 'Übersicht');

		await gehe(`/gemeinschaften/${g2}/reglement`);
		const rahmen = seite.locator('form#abweichungsformular');
		await rahmen.locator('select[name="geschaeftsart"]').selectOption('nutzungsaenderung');
		await seite.waitForTimeout(300);
		await rahmen.locator('input[name="knotenId"][value="k-benutzungsweise"]').check();
		await rahmen.locator('select[name="kopfArt"]').selectOption('mindestens');
		await rahmen.locator('input[name="kopfZaehler"]').fill('3');
		await rahmen.locator('input[name="kopfNenner"]').fill('5');
		await rahmen.locator('select[name="kopfbasis"]').selectOption('anwesend_vertreten');
		await rahmen.locator('input[name="fundstelle"]').fill(REGEL_FUNDSTELLE);
		await abschicken(rahmen.locator('button[type="submit"]'));
		await seite.locator('main', { hasText: REGEL_FUNDSTELLE }).first().waitFor({ timeout: 10_000 });
		return `Klausel ${KLAUSEL_FUNDSTELLE}, Regel ${REGEL_FUNDSTELLE}: mindestens 3/5 der Anwesenden`;
	});

	await schritt('Erste Versammlung: Art. 647b Abs. 1 mit Kartensatz «Anwesende», freigeben', async () => {
		v1 = await legeVersammlungAn(g1, '2027-12-20');
		await legeTraktandumAn(v1, T_WICHTIG, 'k-verwaltung-wichtig', 'Die Gemeinschaft schliesst den Hauswartvertrag mit der Prüffirma ab.');
		const liste = await traktandumtext(v1, T_WICHTIG);
		await ablegen('v1-liste', liste);
		steht(liste, KARTE_ANWESENDE_1, 'Traktandenseite, erste');
		steht(liste, KARTE_ANWESENDE_2, 'Traktandenseite, erste');
		fehlt(liste, KARTE_ALLE_1, 'Traktandenseite, erste', KARTE_ANWESENDE_1);
		await gehe(`/versammlungen/${v1}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 600)}`);
		return 'eingefroren «Anwesende und Vertretene»';
	});

	await schritt('Zweite Versammlung: sechs Traktanden, Beklagter eingetragen, freigeben', async () => {
		v2 = await legeVersammlungAn(g2, '2027-12-21');
		await legeTraktandumAn(v2, T_WICHTIG, 'k-verwaltung-wichtig', 'Die Gemeinschaft schliesst den Hauswartvertrag mit der Prüffirma ab.');
		await legeTraktandumAn(v2, T_NUETZLICH, 'k-baulich-nuetzlich', 'Im Hof wird ein gedeckter Velounterstand gebaut.');
		await legeTraktandumAn(v2, T_REGLEMENT, 'k-benutzungsweise', 'Die Waschküche wird neu als Gemeinschaftsraum genutzt.');
		await legeTraktandumAn(v2, T_KLAUSEL, 'k-baulich-notwendig', 'Die defekte Umwälzpumpe der Heizung wird ersetzt.');
		await legeTraktandumAn(v2, T_RUECKKOMMEN, 'k-verwaltung-wichtig', 'Die Gemeinschaft schliesst den Liftwartungsvertrag mit der Prüffirma ab.');
		await legeTraktandumAn(v2, T_KLAGE, 'k-ausschlussklage', 'Die Gemeinschaft wird ermächtigt, gegen den beklagten Eigentümer die Ausschlussklage zu erheben.');
		// Der Beklagte der Klage; an der nützlichen Massnahme ein Betroffener, dessen
		// Zustimmung Art. 647d Abs. 2 verlangt (ohne ihn sperrt die Leitung das Öffnen).
		// Er stimmt Ja und zählt mit (`betroffeneStimmenNichtMit` ist dort falsch).
		await trageBetroffenenEin(v2, T_KLAGE, FURRER);
		await trageBetroffenenEin(v2, T_NUETZLICH, AEBI);

		await gehe(`/versammlungen/${v2}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 800)}`);
		return 'eingefroren «Alle Eigentümer», mit Klausel und Regel';
	});

	await schritt('Traktandenseite unter «Alle»: Kartensatz an 647b, keiner an 647d und Reglement, Abschnitt 6 an der Klausel (Punkt 3)', async () => {
		const wichtig = await traktandumtext(v2, T_WICHTIG);
		await ablegen('v2-liste-wichtig', wichtig);
		steht(wichtig, KARTE_ALLE_1, '647b');
		steht(wichtig, KARTE_ALLE_2, '647b');
		fehlt(wichtig, KARTE_ANWESENDE_1, '647b', KARTE_ALLE_1);

		// Anker ist die Rechtsgrundlage: Sie steht erst im aufgeklappten Teil
		// (`traktanden/+page.svelte`, «Mehrheitserfordernis:»), der Titel auch zugeklappt.
		for (const [titel, grundlage] of [
			[T_NUETZLICH, 'ZGB Art. 647d Abs. 1 bis 3'],
			[T_REGLEMENT, `Reglement der Gemeinschaft, ${REGEL_FUNDSTELLE}`]
		]) {
			const text = await traktandumtext(v2, titel);
			await ablegen(`v2-liste-${titel === T_NUETZLICH ? 'nuetzlich' : 'reglement'}`, text);
			fehlt(text, STAMM_KARTE, titel, grundlage);
		}
		const klausel = await traktandumtext(v2, T_KLAUSEL);
		await ablegen('v2-liste-klausel', klausel);
		steht(klausel, KLAUSEL_KARTE_1, 'Klausel');
		steht(klausel, KLAUSEL_KARTE_2, 'Klausel');
		steht(klausel, KLAUSEL_KARTE_3, 'Klausel');
		fehlt(klausel, STAMM_KARTE, 'Klausel', KLAUSEL_KARTE_1);
		return '647b mit Kartensatz «Alle», 647d und Reglement ohne, Klausel mit Abschnitt 6';
	});

	/*
	 * Den Kartensatz aus Abschnitt 2 zeigt die Erfordernisseite nicht; ob er
	 * fehlt, messen die Traktandenseite und die Leitung (Schritte davor und danach).
	 */
	await schritt('Erfordernisseite: 4c an 647b, 4a an 647d, Reglement und Klausel ohne 4c (Punkt 3)', async () => {
		const wichtig = await kartentext(v2, T_WICHTIG, 'ast=a-verwaltung&p=f7-1-wichtig');
		await ablegen('v2-karte-wichtig', wichtig);
		steht(wichtig, W4C_1, 'Karte 647b');
		steht(wichtig, W4C_2, 'Karte 647b');
		steht(wichtig, GERICHT_647B, 'Karte 647b');

		const nuetzlich = await kartentext(v2, T_NUETZLICH, 'ast=a-bauen&p=f1-0-nein,f1-1-nein,f1-2-ja');
		await ablegen('v2-karte-nuetzlich', nuetzlich);
		steht(nuetzlich, W4A_1, 'Karte 647d');
		steht(nuetzlich, W4A_2, 'Karte 647d');
		fehlt(nuetzlich, W4C_1, 'Karte 647d', W4A_2);

		const reglement = await kartentext(v2, T_REGLEMENT, 'ast=a-nutzung&p=f5-1-weise');
		await ablegen('v2-karte-reglement', reglement);
		steht(reglement, REGEL_FUNDSTELLE, 'Karte Reglement');
		steht(reglement, REGEL_VERGLEICH, 'Karte Reglement');
		steht(reglement, REGEL_SICHER, 'Karte Reglement');
		fehlt(reglement, W4C_1, 'Karte Reglement', REGEL_VERGLEICH);

		const klausel = await kartentext(v2, T_KLAUSEL, 'ast=a-bauen&p=f1-0-nein,f1-1-ja');
		await ablegen('v2-karte-klausel', klausel);
		steht(klausel, KLAUSEL_NACHSATZ, 'Karte Klausel');
		fehlt(klausel, W4C_1, 'Karte Klausel', KLAUSEL_NACHSATZ);
		return '4c und {Gericht} an 647b, 4a an 647d, Reglement R5-F-4, Klausel mit Nachsatz';
	});

	await schritt('Auszählmappe nach der Freigabe herunterladen', async () => {
		const antwort = await kontext.request.get(`${ZIEL}/versammlungen/${v2}/auszaehlung.xlsx`);
		behaupte(antwort.status() === 200, `Mappe nicht geladen: HTTP ${antwort.status()}`);
		const daten = await antwort.body();
		behaupte(daten.subarray(0, 2).toString('latin1') === 'PK', 'Die Antwort ist keine xlsx-Datei');
		mappe = `${AUFNAHMEN}/auszaehlung-${LAUF}.xlsx`;
		await writeFile(mappe, daten);
		return `${daten.length} Bytes, ${mappe}`;
	});

	await schritt('Erste Versammlung: drei Ja, zwei Nein, einer im Ausstand; angenommen 3 von 5 (Punkt 1)', async () => {
		await gehe(`/versammlungen/${v1}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (const wer of LEUTE) await erfasseAnwesend(v1, wer);
		const vorher = await rufeAufMitAusstand(v1, () => baumzeile(T_WICHTIG));
		await ablegen('v1-vor-abstimmung', vorher);
		steht(vorher, KARTE_ANWESENDE_1, 'Leitung, erste');
		await stimmeAb(DREI_ZU_ZWEI);
		const { satz, kasten } = await ergebnis(v1, T_WICHTIG);
		await ablegen('v1-ergebnis', kasten);
		behaupte(satz.startsWith('Angenommen'), `Unter «Anwesende» nicht angenommen: ${satz}`);
		behaupte(
			satz.includes('3 Ja von 5 Kopfstimmen, nötig 3; 510 Ja von 1000 Wertquoten, nötig 501'),
			`Die Zahlen unter «Anwesende» weichen ab: ${satz}`
		);
		// Die Karte nennt das zweite Ergebnis; erst damit trägt «fehlt» an den Karten danach.
		steht(kasten, ZWEITES_ANFANG, 'Leitung, erste, zweites Ergebnis');
		steht(kasten, GERICHT_FOLGT, 'Leitung, erste, Rat nach der Annahme');
		steht(kasten, NACH_ANNAHME_1, 'Leitung, erste, Rat nach der Annahme');
		steht(kasten, NACH_ANNAHME_2, 'Leitung, erste, Rat nach der Annahme');
		return satz.slice(0, 100);
	});

	await schritt('Zweite Versammlung, Art. 647b: dieselbe Lage abgelehnt 3 von 6, der Ausstand bleibt in der Zahl (Punkt 1)', async () => {
		await gehe(`/versammlungen/${v2}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (const wer of LEUTE) await erfasseAnwesend(v2, wer);
		const vorher = await rufeAufMitAusstand(v2, () => baumzeile(T_WICHTIG));
		await ablegen('v2-wichtig-vor-abstimmung', vorher);
		steht(vorher, KARTE_ALLE_1, 'Leitung, 647b');
		steht(vorher, KARTE_ALLE_2, 'Leitung, 647b');
		await stimmeAb(DREI_ZU_ZWEI);
		const { satz, kasten } = await ergebnis(v2, T_WICHTIG);
		await ablegen('v2-wichtig-ergebnis', kasten);
		behaupte(satz.startsWith('Abgelehnt'), `Unter «Alle» nicht abgelehnt: ${satz}`);
		// Am Kopfmehr gescheitert, nennt der Satz nur die Köpfe; die Wertquoten stehen im Kasten.
		behaupte(satz.includes('3 Ja von 6 Kopfstimmen, nötig 4'), `Der Ausstand bleibt nicht in der Zahl, oder die Zahlen weichen ab: ${satz}`);
		behaupte(
			kasten.includes('Bezugsgrösse 6, nötig 4') && kasten.includes('510 ja') && kasten.includes('Bezugsgrösse 1000, nötig 501'),
			`Die Bezugsgrössen im Kasten weichen ab: ${kasten.slice(0, 900)}`
		);
		steht(kasten, ZWEITES_ANFANG, 'Leitung 647b, zweites Ergebnis');
		steht(kasten, L1_GLEICH, 'Leitung 647b, zweites Ergebnis nach L1');
		steht(kasten, NACH_ABLEHNUNG_1, 'Leitung 647b, Rat nach der Ablehnung');
		steht(kasten, NACH_ABLEHNUNG_2, 'Leitung 647b, Rat nach der Ablehnung');
		return `${satz.slice(0, 100)}; Wertquoten 510 von 1000, nötig 501`;
	});

	await schritt('Zweite Versammlung, 647d, Reglement und Klausel: je 3 von 5 angenommen, «Alle» wirkt nicht (Punkt 3)', async () => {
		const gesehen = [];
		for (const titel of [T_NUETZLICH, T_REGLEMENT, T_KLAUSEL]) {
			const vorher = await rufeAufMitAusstand(v2, () => baumzeile(titel));
			await ablegen(`v2-vor-${titel.split(' ')[0]}`, vorher);
			// Anker aus der Karte des aufgerufenen Traktandums, nicht der Titel aus der Liste.
			const NOETIG = 'Nötig: 3 von 5 Kopfstimmen (der Anwesenden oder Vertretenen)';
			fehlt(vorher, STAMM_KARTE, `Leitung, ${titel}`, NOETIG);
			if (titel === T_KLAUSEL) steht(vorher, KLAUSEL_KARTE_1, 'Leitung, Klausel');
			await stimmeAb(DREI_ZU_ZWEI);
			const { satz, kasten } = await ergebnis(v2, titel);
			await ablegen(`v2-ergebnis-${titel.split(' ')[0]}`, kasten);
			behaupte(satz.startsWith('Angenommen'), `${titel}: nicht angenommen, rechnet «Alle» hier mit? ${satz}`);
			behaupte(satz.includes('3 Ja von 5 Kopfstimmen'), `${titel}: nicht unter den Anwesenden gezählt: ${satz}`);
			fehlt(kasten, ZWEITES_ANFANG, `Ergebnis ${titel}`, '3 Ja von 5 Kopfstimmen');
			gesehen.push(`${titel.split(' ')[0]} angenommen`);
		}
		return gesehen.join(', ');
	});

	await schritt('Zweite Versammlung: zweites Traktandum nach 647b mit vier Ja angenommen, 4 von 6', async () => {
		await rufeAufMitAusstand(v2, () => baumzeile(T_RUECKKOMMEN));
		await stimmeAb([
			[AEBI, 'yes'],
			[BUCHER, 'yes'],
			[CHRISTEN, 'yes'],
			[DUBACH, 'yes'],
			[FURRER, 'no']
		]);
		const { satz } = await ergebnis(v2, T_RUECKKOMMEN);
		behaupte(satz.startsWith('Angenommen'), `Nicht angenommen: ${satz}`);
		behaupte(satz.includes('4 Ja von 6 Kopfstimmen, nötig 4'), `Die Zahlen weichen ab: ${satz}`);
		return satz.slice(0, 140);
	});

	await schritt('Rückkommen: rechnet wie der Beschluss unter «Alle», 3 von 6 abgelehnt, ohne Kartensatz und zweites Ergebnis (Punkt 4)', async () => {
		await gehe(`/versammlungen/${v2}/leitung`);
		const oben = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		const zeile = baumzeile(T_RUECKKOMMEN);
		const bereich = (await oben.count()) ? seite.locator('.eingriffe') : zeile;
		await ((await oben.count()) ? oben.first() : zeile.locator('details.rueckkommen summary')).click();
		await seite.waitForTimeout(150);
		const stellen = bereich.locator('form[action="?/rueckkommen"] button[type="submit"]').first();
		behaupte(await stellen.count(), `Kein Formular für das Rückkommen: ${(await seitentext()).slice(0, 600)}`);
		await abschicken(stellen);

		/*
		 * Drei im Ausstand: Dann sind 4 von 6 Köpfen mit den Anwesenden nicht zu
		 * erreichen, und erst dann sagt die Leitung vor der Abstimmung, wie Votum
		 * am Rückkommen zählt (`erreichbarkeitshinweis` mit `kopfbasisStreit`).
		 * Drei Ja: unter «Alle» 3 von 6, nötig 4, abgelehnt; unter den Anwesenden
		 * wären es 3 von 3, nötig 2.
		 */
		const vorher = await rufeAufMitAusstand(
			v2,
			() => seite.locator('.baum li', { hasText: 'Rückkommen auf' }).last(),
			[DUBACH, EGLI, FURRER]
		);
		await ablegen('v2-rueckkommen-vor-abstimmung', vorher);
		const jetzt = sauber(await seite.locator('li.jetzt, .jetzt').first().innerText());
		behaupte(/Rückkommen auf/.test(jetzt), `Aufgerufen ist nicht das Rückkommen: ${jetzt.slice(0, 200)}`);
		steht(vorher, RUECKKOMMEN_STREIT, 'Rückkommen vor der Abstimmung');
		fehlt(vorher, STAMM_KARTE, 'Rückkommen vor der Abstimmung', RUECKKOMMEN_STREIT);

		await stimmeAb([
			[AEBI, 'yes'],
			[BUCHER, 'yes'],
			[CHRISTEN, 'yes']
		]);
		const { satz, kasten } = await ergebnis(v2, T_RUECKKOMMEN, true);
		await ablegen('v2-rueckkommen-ergebnis', kasten);
		behaupte(satz.startsWith('Abgelehnt'), `Das Rückkommen ist nicht abgelehnt; zählt es die Anwesenden? ${satz}`);
		behaupte(satz.includes('3 Ja von 6 Kopfstimmen, nötig 4'), `Die Zahlen des Rückkommens weichen ab: ${satz}`);
		fehlt(kasten, ZWEITES_ANFANG, 'Rückkommen, Ergebnis', '3 Ja von 6 Kopfstimmen, nötig 4');
		return satz.slice(0, 140);
	});

	await schritt('Protokoll der ersten: Zeile «Anwesende» und das Ergebnis nach «Alle» (Punkt 2)', async () => {
		const roh = await protokollentwurf(v1);
		await ablegen('v1-protokoll', roh);
		const t = abschnitt(roh, T_WICHTIG);
		steht(t, PROT_ANWESENDE_1, 'Protokoll, erste');
		steht(t, PROT_ANWESENDE_2, 'Protokoll, erste');
		steht(t, zweitesErgebnis('Alle Eigentümer', 'abgelehnt', 3, 6, 4), 'Protokoll, erste');
		steht(t, PROT_NACH_ANNAHME_1, 'Protokoll, erste');
		steht(t, PROT_NACH_ANNAHME_2, 'Protokoll, erste');
		fehlt(t, PROT_ALLE_1, 'Protokoll, erste', PROT_ANWESENDE_1);
		return 'Zeile, «abgelehnt: 3 Ja von 6 Kopfstimmen, nötig 4», Satz nach der Annahme';
	});

	await schritt('Protokoll der zweiten: 647b mit Zeile «Alle» und Ergebnis nach «Anwesende»; 647d, Reglement, Klausel und Rückkommen ohne (Punkte 2 bis 4)', async () => {
		const roh = await protokollentwurf(v2);
		await ablegen('v2-protokoll', roh);
		const wichtig = abschnitt(roh, T_WICHTIG);
		steht(wichtig, PROT_ALLE_1, 'Protokoll 647b');
		steht(wichtig, PROT_ALLE_2, 'Protokoll 647b');
		steht(wichtig, zweitesErgebnis('Anwesende und Vertretene', 'angenommen', 3, 5, 3), 'Protokoll 647b');
		steht(wichtig, PROT_NACH_ABLEHNUNG_1, 'Protokoll 647b');
		steht(wichtig, PROT_NACH_ABLEHNUNG_2, 'Protokoll 647b');
		steht(wichtig, eingesetzt(AUSSTAND_BESCHLUSS_VORLAGE, [['bei 10.', 'bei 6.']]), 'Protokoll 647b');

		// Die Zeile mit der Bezugsgrösse 5 belegt die Zählung unter den Anwesenden und ist der Anker.
		const VON_FUENF = 'Kopfstimmen: 3 Ja, 2 Nein, 0 Enthaltung, 0 ohne Abgabe (von 5), nötig 3';
		for (const titel of [T_NUETZLICH, T_REGLEMENT, T_KLAUSEL]) {
			const t = abschnitt(roh, titel);
			fehlt(t, STAMM_PROT, `Protokoll ${titel}`, VON_FUENF);
			fehlt(t, ZWEITES_ANFANG, `Protokoll ${titel}`, VON_FUENF);
		}
		const klausel = abschnitt(roh, T_KLAUSEL);
		steht(klausel, KLAUSEL_PROT_1, 'Protokoll Klausel');
		steht(klausel, KLAUSEL_PROT_2, 'Protokoll Klausel');

		const rueck = abschnitt(roh, 'Rückkommen auf');
		await ablegen('v2-protokoll-rueckkommen', rueck);
		const ausstandRueck = eingesetzt(AUSSTAND_RUECKKOMMEN_VORLAGE, [
			['hier 1 Partei', 'hier 3 Parteien'],
			['bei 10.', 'bei 6.']
		]);
		steht(rueck, ausstandRueck, 'Protokoll Rückkommen');
		fehlt(rueck, STAMM_PROT, 'Protokoll Rückkommen', ausstandRueck);
		fehlt(rueck, ZWEITES_ANFANG, 'Protokoll Rückkommen', ausstandRueck);
		return '647b mit Zeile und zweitem Ergebnis, 647d und Reglement ohne, Klausel nach Abschnitt 6, Rückkommen ohne';
	});

	await schritt('Auszählmappe nachgerechnet: gleich der App, die 7 rechnet wie die 9 (Punkt 5)', async () => {
		const eintraege = (ausstand) => ({ [AEBI]: 1, [BUCHER]: 1, [CHRISTEN]: 1, [DUBACH]: 3, [EGLI]: ausstand, [FURRER]: 3 });
		const neun = await rechneMappe(mappe, 'neun', T_WICHTIG, eintraege(9));
		const sieben = await rechneMappe(mappe, 'sieben', T_WICHTIG, eintraege(7));
		await ablegen('mappe-ergebnis', JSON.stringify({ neun: { haupt: neun.haupt, vergleiche: neun.vergleiche }, sieben: { haupt: sieben.haupt, vergleiche: sieben.vergleiche } }, null, 1));
		steht(neun.text, MAPPE_NEUN, 'Mappe, Anleitung');
		// Die 7 erklärt die Mappe nur wegen der Ausschlussklage derselben Versammlung:
		// In der Anleitung über dem Kopf «Traktandum» steht eine Zeile mit der Eingabe 7.
		const kopf = neun.tabelle.findIndex((r) => r[0] === 'Traktandum');
		behaupte(
			neun.tabelle.slice(0, kopf).some((r) => r.slice(1).includes('7')),
			'Die Mappe erklärt die 7 nicht; ohne sie belegt die Probe mit 7 nichts'
		);

		// Wie in der App: abgelehnt, 3 Ja von 6 Kopfstimmen, nötig 4; 510 Ja von 1000 Wertquoten, nötig 501.
		const soll = { jaKopf: '3', basisKopf: '6', noetigKopf: '4', jaQuote: '510', basisQuote: '1000', noetigQuote: '501' };
		for (const [name, r] of [['9', neun], ['7', sieben]]) {
			for (const [feld, wert] of Object.entries(soll)) {
				behaupte(r.haupt[feld] === wert, `Mappe mit ${name}: ${feld} ist ${r.haupt[feld]}, die App ${wert}`);
			}
			behaupte(r.haupt.ergebnis.startsWith('abgelehnt'), `Mappe mit ${name}: Ergebnis «${r.haupt.ergebnis}», die App abgelehnt`);
			// Die Spalte zum Vergleich nach «Anwesende und Vertretene»: 3 von 5, nötig 3, angenommen, wie das zweite Ergebnis der App.
			const anw = r.vergleiche.find((v) => (v.mehr ?? '').includes('«Anwesende und Vertretene»'));
			behaupte(anw, `Mappe mit ${name}: keine Spalte zum Vergleich nach «Anwesende und Vertretene»: ${JSON.stringify(r.vergleiche)}`);
			behaupte(
				anw.jaKopf === '3' && anw.basisKopf === '5' && anw.noetigKopf === '3' && anw.ergebnis.startsWith('ANGENOMMEN'),
				`Mappe mit ${name}, Vergleich: ${JSON.stringify(anw)}`
			);
			behaupte((anw.weicht ?? '').startsWith('JA'), `Mappe mit ${name}: «Weicht ab» ist «${anw.weicht}»`);
			// Nach L1 «Wertquote fällt heraus»: 840 im Nenner, nötig 421, dasselbe Ergebnis wie
			// in der App (`L1_GLEICH` an der Ergebniskarte, Schritt «Zweite Versammlung, Art. 647b»).
			const l1 = r.vergleiche.find((v) => (v.mehr ?? '').includes('«Wertquote fällt heraus»'));
			behaupte(
				l1 && l1.basisQuote === '840' && l1.noetigQuote === '421' && l1.ergebnis.startsWith('abgelehnt') && (l1.weicht ?? '').startsWith('nein'),
				`Mappe mit ${name}, Vergleich nach L1: ${JSON.stringify(l1)}`
			);
		}
		/*
		 * **Was die Probe mit 7 hier trägt** (Codeprüfung, Befund 2): Unter «Alle»
		 * zählt die Hauptspalte alle Köpfe, gleich ob 9 oder 7, und die Spalte zum
		 * Vergleich nach «Anwesende» zieht 9, 8 und 7 ohne Bedingung ab
		 * (`auszaehlmappe.ts`, «Bezugsgrösse Kopfstimmen», Zweig der Anwesenden).
		 * An die Regel «7 wie 9» (`siebenWieNeun`) gebunden ist hier allein der
		 * Nenner der Wertquoten nach L1 «fällt heraus»: Rechnete die 7 dort nicht
		 * wie die 9, stünde 1000 statt 840 und nötig 501 statt 421. Den Kopfzweig
		 * derselben Regel (Köpfe aller ohne L13) prüft nur
		 * `tests/domain/auszaehlmappe.test.ts` als Formel («rechnet eine 7 ausserhalb
		 * der Ausschlussklage wie die 9»); mit Calc gerechnet wird er nirgends, auch
		 * nicht in `scripts/mappe-nachrechnen.mjs`: Deren Mappe «Zählweise der Köpfe
		 * (L13), Ausstand mit 7» trägt unter «Alle» `ausstandNachZaehlweise` und
		 * erreicht den Zweig nicht (Codeprüfung Lauf 2, N1).
		 */
		behaupte(
			JSON.stringify(neun.haupt) === JSON.stringify(sieben.haupt) &&
				JSON.stringify(neun.vergleiche) === JSON.stringify(sieben.vergleiche),
			'Die 7 rechnet anders als die 9'
		);
		return `mit 9 und mit 7: abgelehnt 3/6, nötig 4; 510/1000, nötig 501; zum Vergleich ${neun.vergleiche.length} Spalte(n), «Anwesende» angenommen 3/5`;
	});

	await schritt('Zurückstellen auf die Vorgabe', async () => {
		await stelleUm(g2, 'anwesende');
		await gehe(`/gemeinschaften/${g2}/lesarten`);
		behaupte(await seite.locator('input[name="L13"][value="anwesende"]').isChecked(), 'Die Vorgabe ist nicht wieder angekreuzt');
		return '«Anwesende und Vertretene»';
	});
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log(`\nGemeinschaften ${g1 ?? '?'} und ${g2 ?? '?'}, Versammlungen ${v1 ?? '?'} und ${v2 ?? '?'}`);
console.log(`${nr} Schritte, ${fehler.length} Befunde.\n`);
if (fehler.length) {
	for (const f of fehler) console.log(`  ✗ ${f.nr} ${f.titel}: ${f.text}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
