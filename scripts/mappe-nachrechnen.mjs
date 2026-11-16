/**
 * Rechnet die **ganze** Auszählmappe mit einer echten Tabellenkalkulation nach
 * und hält jede Zeile gegen `zaehleAus` aus dem Code.
 *
 * **Warum es das gibt** (05.09.2026). Die Mappe ist der zweite Rechenweg für
 * den Ausfall: Sie legt Formeln ins Blatt, die eine Tabellenkalkulation rechnet,
 * nicht unser Code. Dass Aufbau, Bezüge und Schwellen stimmen, prüft
 * `tests/domain/auszaehlmappe.test.ts` — aber **ob eine Tabellenkalkulation
 * daraus dieselben Zahlen macht**, blieb unbelegt, solange auf dem Dev-Host kein
 * LibreOffice Calc lag.
 *
 * Ein zweiter Rechenweg, der anders rechnet als der erste, ist schlimmer als
 * gar keiner: Er sieht aus wie eine Bestätigung.
 *
 * **Geprüft wird die Mappe, nicht bloss die Schwellenformel** (aus dem
 * Code-Review, 05.09.2026). Der erste Anlauf legte nur `schwellenformel` in ein
 * Blatt und verglich gegen `schwelle()`; die `SUMIF`- und `SUMIFS`-Summen und
 * die `IF`-Ketten für «erreicht» und «Ergebnis» hatte Calc dabei nie gerechnet,
 * und `baueAuszaehlmappe` wurde gar nicht aufgerufen. Jetzt entsteht die echte
 * Mappe, die Stimmen werden eingetragen, und verglichen wird gegen `zaehleAus`
 * — also gegen den Code, der im Saal zählt.
 *
 * **Jede Spalte, auch die «zum Vergleich»** (A3, 30.10.2026). Die Posten
 * entstehen wie im Downloadweg über `mappenpostenAus`, aus Erfordernissen des
 * echten Regelwerks: L1 bis L6, L9, L11, L12 (seit 13.11.2026), L13 (Block C), 1a, Mehr aus
 * Gesetz und Reglement, der
 * Stichentscheid nach jeder Art und ein Gleichstand beim qualifizierten Mehr.
 * Eine Spalte «zum Vergleich» wird gegen `zaehleAus` mit ihrem anderen
 * Erfordernis gehalten, und wo der Kern das zweite Ergebnis selbst nennt
 * (`andereLesartenVon`), auch gegen dieses; ausser B3 und L10, für die die
 * Mappe bewusst keine Spalte führt.
 *
 * **Warum es nicht im Prüflauf steht.** Der läuft im Container, und dort ist
 * kein LibreOffice installiert; hier läuft es auf dem Host (Dev-Host), wo umgekehrt
 * die Domänenmodule nicht laden: Im PATH steht Node v20, das TypeScript noch
 * nicht liest.
 * Deshalb entsteht das Blatt in einem Einmalcontainer und gerechnet wird auf
 * dem Host. Das Skript ist ein Werkzeug für die Hand — aufzurufen, wenn jemand
 * an `schwellenformel`, `schwelle()`, `zaehleAus` oder der Mappe arbeitet.
 *
 * **Aufruf** (auf dem Host, im Repo-Verzeichnis oder in einem Worktree):
 *
 *     node scripts/mappe-nachrechnen.mjs
 *
 * Es braucht Docker mit dem Abbild `node:24-alpine`, die `node_modules` des
 * Baums nicht, und `soffice` mit Calc (`libreoffice-calc-nogui`, siehe
 * Betriebsdoku des Dev-Hosts).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wurzel = process.cwd();
const arbeit = mkdtempSync(join(tmpdir(), 'mappe-nachrechnen-'));

function absage(text) {
	console.error(`\n${text}\n`);
	aufraeumen();
	process.exit(1);
}

function aufraeumen() {
	rmSync(arbeit, { recursive: true, force: true });
}

/*
 * **Ein Einmalcontainer aus diesem Baum, nicht `docker compose exec app`**
 * (A3, 30.10.2026). Der Dev-Stapel hat das Hauptverzeichnis eingehängt; aus
 * einem Worktree gerufen, rechnete das Skript still den Code von `main` nach,
 * nicht den eigenen. Der Baum hängt nur lesend; geschrieben wird allein in das
 * Arbeitsverzeichnis dieses Laufs, das auch die Dateinamen von denen anderer
 * Sitzungen trennt.
 */
function imContainer(skript, wobei) {
	try {
		return execFileSync(
			'docker',
			[
				'run', '--rm', '--network', 'none',
				'-v', `${wurzel}:/app:ro`, '-v', `${arbeit}:/aus`, '-w', '/app',
				'node:24-alpine', 'node', '--experimental-transform-types', skript
			],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
		);
	} catch (fehler) {
		absage(`${wobei}\n\n${fehler.stderr || fehler.stdout || fehler.message}`);
	}
}

/*
 * **Die Mappen, die geprüft werden.**
 *
 * Nicht eine Lage, sondern mehrere: Ein einzelner Fall trifft zufällig zu, und
 * gerade an den Grenzen trennen sich zwei Rechenwege. Enthalten sind der glatte
 * Fall, der knappe, der Gleichstand, die Enthaltung, der Ausstand, die
 * Vollmacht, die ruht, weil der Vertreter im Ausstand ist (8), Abwesende und
 * die Versammlung, in der niemand abgestimmt hat. Je Mappe eine Gemeinschaft.
 *
 * Stimmen je Partei: ja, nein, enthaltung, offen (anwesend, nicht abgestimmt),
 * ausstand, ruht (nur über die Partei im Ausstand vertreten), fehlt.
 */
const erzeuger = `
import { writeFileSync } from 'node:fs';
import { baueAuszaehlmappe, mappenpostenAus } from '/app/src/lib/domain/auszaehlmappe.ts';
import { andereLesartenVon, vergleicheZu, zaehleAus } from '/app/src/lib/domain/auszaehlung.ts';
import { uebersteuere, waehleErfordernis } from '/app/src/lib/domain/entscheidbaum.ts';
import { LESARTEN_VORGABE, wendeLesartAn } from '/app/src/lib/domain/lesarten.ts';
import { erfordernisFuerRueckkommen } from '/app/src/lib/domain/rueckkommen.ts';
import { wendeReglementAn } from '/app/src/lib/domain/reglement.ts';
import { stelleBeschlussfaehigkeitFest } from '/app/src/lib/domain/beschlussfaehigkeit.ts';
import { beteiligungDerAnwesenden } from '/app/src/lib/domain/anwesenheit.ts';
import { stimmkraftliste } from '/app/src/lib/domain/stimmkraft.ts';
import { kopfgewicht } from '/app/src/lib/domain/eigentuemer.ts';
import { holeRegelwerk } from '/app/src/lib/rules/index.ts';
import { alsArbeitsmappe } from '/app/src/lib/domain/xlsx.ts';
import { dosZeitstempel } from '/app/src/lib/domain/archiv.ts';

const RW = holeRegelwerk('2026-11-05');
const waehle = (id) => waehleErfordernis(RW, id).ergebnis;
const mitLesart = (id) => RW.knoten.find((k) => k.lesart?.kennung === id).id;
const HAELFTE = { zaehler: 1, nenner: 2, art: 'mehr_als' };
const ZWEIDRITTEL = { zaehler: 2, nenner: 3, art: 'mindestens' };

/** Eine Gemeinschaft: [Name, Wertquoten der Einheiten, gemeinsames Eigentum]. */
function gemeinschaft(parteien, headCountMode = 'per_owner', tieBreak = 'keiner') {
  return {
    meetingId: 'v-1', takenAt: '2026-09-15T17:00:00.000Z',
    headCountMode, parkingCountsAsHead: true, headCountRuleSource: null, tieBreak,
    totalQuota: parteien.reduce((s, [, q]) => s + q.reduce((a, b) => a + b, 0), 0),
    /*
     * **Die Stimme hängt an der Einheit, nicht an der Partei** — eine Partei
     * ohne Einheiten kann gar nicht abstimmen. Der erste Anlauf hier gab ihnen
     * keine, und zaehleAus meldete überall null, während Calc richtig rechnete.
     * Der Vergleich zeigte damit meinen eigenen Aufruf an, nicht die Mappe.
     */
    parties: parteien.map(([name, quoten, gemeinsam], i) => ({
      partyId: 'p' + (i + 1), displayName: name, representativeName: null, isCommunity: gemeinsam === true,
      units: quoten.map((q, j) => ({ unitId: 'p' + (i + 1) + '-u' + (j + 1), label: name + ' ' + (j + 1),
        kind: 'unit', countsAsHead: true, quota: q }))
    }))
  };
}

/** Vier Parteien mit ungleichen, nicht runden Wertquoten. */
const VIER = [['Aebi', [400]], ['Berger', [300]], ['Caduff', [201]], ['Diener', [99]]];

/** Die Grundfälle von Hand, wie bis A2: beide Schwellenarten, L1 nach beiden Wahlen, 1e. */
const grund = (nummer, titel, e) => ({ nummer, titel, e: { titel, quelle: 'hergeleitet', rechtsgrundlage: '', fassung: 'f1', ...e } });
const GRUNDFAELLE = [
  grund('1', 'Einfaches Mehr', { typ: 'einfaches_mehr', kopfbasis: 'anwesend_vertreten', kopfSchwelle: HAELFTE,
    quotenbasis: 'keine', quotenSchwelle: null, enthaltungZaehltMit: true }),
  grund('2', 'Zwei Drittel', { typ: 'qualifiziertes_mehr', kopfbasis: 'anwesend_vertreten', kopfSchwelle: ZWEIDRITTEL,
    quotenbasis: 'anwesend_vertreten', quotenSchwelle: ZWEIDRITTEL, enthaltungZaehltMit: true }),
  // Lesart L1 (Migration 170): das Mehr aller Wertquoten nach beiden Wahlen.
  grund('3', 'Alle Wertquoten, zählt mit', { typ: 'qualifiziertes_mehr', kopfbasis: 'anwesend_vertreten', kopfSchwelle: HAELFTE,
    quotenbasis: 'alle_quoten', quotenSchwelle: HAELFTE, enthaltungZaehltMit: true, ausstandslesart: 'bleibt' }),
  grund('4', 'Alle Wertquoten, fällt heraus', { typ: 'qualifiziertes_mehr', kopfbasis: 'anwesend_vertreten', kopfSchwelle: HAELFTE,
    quotenbasis: 'alle_quoten', quotenSchwelle: HAELFTE, enthaltungZaehltMit: true, ausstandslesart: 'faellt_heraus' }),
  // 1e (Fassung 2026-10-25): Ausschlussklage gegen Diener mit einer Quote der
  // Anwesenden. Wer hier im Ausstand ist, ist Angehöriger und bekommt 7 (Review
  // DeepSeek Block 2, Befund 1); der Beklagte bekommt 9 und stimmt nicht.
  { ...grund('5', 'Ausschlussklage', { typ: 'qualifiziertes_mehr', kopfbasis: 'alle_ausser_betroffene', kopfSchwelle: HAELFTE,
    quotenbasis: 'anwesend_vertreten', quotenSchwelle: HAELFTE, enthaltungZaehltMit: true,
    knotenId: 'k-ausschlussklage', fassung: '2026-10-25' }), betroffen: 'p4' },
  // Dieselbe Klage mit einer Reglementsregel über alle Wertquoten: Die Quote des
  // Beklagten bleibt im Nenner und kann nicht zustimmen (QUOTE_BEKLAGTER).
  { ...grund('6', 'Ausschlussklage, alle Wertquoten', { typ: 'qualifiziertes_mehr', kopfbasis: 'alle_ausser_betroffene', kopfSchwelle: HAELFTE,
    quotenbasis: 'alle_quoten', quotenSchwelle: HAELFTE, enthaltungZaehltMit: true,
    knotenId: 'k-ausschlussklage', fassung: '2026-10-25' }), betroffen: 'p4' }
];
const LAGEN_VIER = [
  ['zwei ja ein nein eine enthaltung', ['ja', 'ja', 'nein', 'enthaltung']],
  ['alle ja', ['ja', 'ja', 'ja', 'ja']],
  ['alle nein', ['nein', 'nein', 'nein', 'nein']],
  ['Gleichstand zwei zu zwei', ['ja', 'ja', 'nein', 'nein']],
  ['drei ja eine enthaltung', ['ja', 'ja', 'ja', 'enthaltung']],
  ['einer im Ausstand', ['ja', 'ja', 'nein', 'ausstand']],
  ['zwei im Ausstand', ['ja', 'nein', 'ausstand', 'ausstand']],
  // Lesarten Block 2: Diener nur über Caduff vertreten, der im Ausstand ist (8).
  ['einer im Ausstand vertritt einen anderen', ['ja', 'nein', 'ausstand', 'ruht']],
  // Codeprüfung der Review-Behebung, N5: eine 8 neben einer 7. Aebi ist nur über
  // Berger vertreten, der an der Ausschlussklage als Angehöriger 7 bekommt.
  ['Vollmacht über einen Angehörigen im Ausstand', ['ruht', 'ausstand', 'ja', 'nein']],
  ['Caduff fehlt', ['ja', 'nein', 'fehlt', 'ja']],
  ['niemand hat abgestimmt', ['offen', 'offen', 'offen', 'offen']]
];

const KLAGE = waehle('k-ausschlussklage');
const EINFACH = waehle('k-organ-waehlen');
const QUALIFIZIERT = waehle('k-verwaltung-wichtig');
const nachWahl = (e, wahl) => wendeLesartAn(e, { ...LESARTEN_VORGABE, ...wahl });
const L4 = waehle(mitLesart('L4'));
const L2 = waehle(mitLesart('L2'));
const L6 = waehle(mitLesart('L6'));
// Die Lesarten ab der Fassung 2026-11-10 (E1), aus der letzten Fassung.
const NEU = holeRegelwerk('2026-11-11');
const waehleNeu = (id) => waehleErfordernis(NEU, id).ergebnis;
const mitLesartNeu = (id) => NEU.knoten.find((k) => k.lesart?.kennung === id).id;
const KLAGE_NEU = waehleNeu('k-ausschlussklage');
// L13 (Fassung 2026-11-14, Block C): über die Herleitung, weil die Zählweise erst
// \`wendeReglementAn\` setzt (nach der Enthaltungsklausel).
const RW14 = holeRegelwerk('2026-11-14');
const l13 = (id, wahl) =>
  wendeReglementAn(waehleErfordernis(RW14, id).ergebnis, [], null, { ...LESARTEN_VORGABE, ...wahl }).erfordernis;
// Fassung 2026-11-16 (Entscheid 0050, Antwort 1): Ausstand unter einer von Hand gesetzten Basis aller.
const RW16 = holeRegelwerk('2026-11-16');
const l13Neu = (id, wahl) =>
  wendeReglementAn(waehleErfordernis(RW16, id).ergebnis, [], null, { ...LESARTEN_VORGABE, ...wahl }).erfordernis;
const L11 = waehleNeu(mitLesartNeu('L11'));
const L12 = waehleNeu(mitLesartNeu('L12'));

/** Eine strengere Regel für die erste Versammlung, ohne Wertquoten (erfunden). */
const REGEL_ERSTE = { kopf: { zaehler: 3, nenner: 4, art: 'mindestens' }, quoten: null, mindestens: 2, fundstelle: 'Art. 9 Reglement' };
// Codeprüfung A3, N6: auch an den Grundfällen fehlt kein Vergleich still.
const GRUNDVERGLEICHE = [[], [], ['L1'], ['L1'], ['1a'], ['1a']];
const MAPPEN = [
  { name: 'Grundfälle', m: gemeinschaft(VIER), posten: GRUNDFAELLE.map((p, i) => ({ ...p, vergleiche: GRUNDVERGLEICHE[i] })), lagen: LAGEN_VIER },
  {
    name: 'Lesarten am Mehr, 1a und Gesetz',
    m: gemeinschaft(VIER),
    posten: [
      // Seit Block B (Entscheid 0048, Fassung 2026-11-13) ist die Vorgabe bei L4
      // «qualifiziert»; «einfach» wird ausdrücklich gesetzt (EINFACH_L4 in
      // tests/domain/auszaehlmappe-vergleiche.test.ts).
      { nummer: '1', titel: 'L4 nach der Vorgabe (qualifiziert)', e: nachWahl(L4, {}), vergleiche: ['L4', 'L1'] },
      { nummer: '2', titel: 'L4 einfach, ausdrücklich gesetzt', e: nachWahl(L4, { L4: 'einfach' }), vergleiche: ['L4'] },
      { nummer: '3', titel: 'L2 nach der Vorgabe', e: nachWahl(L2, {}), vergleiche: ['L2'] },
      { nummer: '4', titel: 'L2 qualifiziert, fällt heraus', e: nachWahl(L2, { L2: 'qualifiziert', L1: 'faellt_heraus' }), vergleiche: ['L2', 'L1'] },
      { nummer: '5', titel: 'Strenger als das Gesetz',
        e: uebersteuere(RW, EINFACH, 'qualifiziertes_mehr', 'So stand es in der Einladung').ergebnis, vergleiche: ['L1', 'A'] },
      { nummer: '6', titel: 'Milder als das Gesetz',
        e: uebersteuere(RW, QUALIFIZIERT, 'einfaches_mehr', 'Entscheid der Leitung').ergebnis, vergleiche: ['A'] },
      { nummer: '7', titel: 'Ausschlussklage', e: KLAGE, betroffen: 'p4', vergleiche: ['1a'] },
      { nummer: '8', titel: 'Ausschlussklage, Regel der Anwesenden',
        e: { ...KLAGE, kopfbasis: 'anwesend_vertreten', quelle: 'reglement' }, betroffen: 'p4', vergleiche: ['1a'] },
      // L6 am Ende, damit die Nummern darüber bleiben (Fassung 2026-11-05).
      { nummer: '9', titel: 'L6 nach der Vorgabe', e: nachWahl(L6, {}), vergleiche: ['L6'] },
      { nummer: '10', titel: 'L6 nach dem Gesetz', e: nachWahl(L6, { L6: 'gesetz' }), vergleiche: ['L6', 'L1'] }
    ],
    lagen: LAGEN_VIER
  },
  {
    // Featureprüfung E1, B3: die Lesarten L9, L11 und L12 aus der Fassung
    // 2026-11-10, gerechnet nach der letzten Fassung. Die Mappen darüber
    // bleiben auf 2026-11-05, damit ihre Nummern und Zahlen bleiben.
    // An der Prozessführung nimmt der Kern Betroffene nicht von selbst heraus
    // (betroffeneStimmenNichtMit ist dort falsch); wer nicht mitstimmt, ist im
    // Ausstand, und den decken die Lagen mit Ausstand. Ein «betroffen» trüge
    // hier eine 9 für jemanden ein, der nicht im Ausstand ist.
    name: 'Lesarten L9, L11 und L12',
    m: gemeinschaft(VIER),
    posten: [
      { nummer: '1', titel: 'L9 nach der Vorgabe', e: nachWahl(KLAGE_NEU, {}), betroffen: 'p4', vergleiche: ['1a'] },
      { nummer: '2', titel: 'L9 an den Anwesenden', e: nachWahl(KLAGE_NEU, { L9: 'anwesende' }), betroffen: 'p4', vergleiche: ['1a'] },
      { nummer: '3', titel: 'L11 nach der Vorgabe', e: nachWahl(L11, {}), vergleiche: ['L11', 'L1'] },
      { nummer: '4', titel: 'L11 einfach', e: nachWahl(L11, { L11: 'einfach' }), vergleiche: ['L11'] },
      { nummer: '5', titel: 'L12 nach der Vorgabe', e: nachWahl(L12, {}), vergleiche: ['L12'] },
      { nummer: '6', titel: 'L12 an den Anwesenden', e: nachWahl(L12, { L12: 'anwesende' }), vergleiche: ['L12'] }
    ],
    lagen: LAGEN_VIER
  },
  {
    // Block C, L13 (Codeprüfung, H1): beide Zählweisen, je mit L1 nach beiden
    // Wahlen, mit den Lagen mit Ausstand. Der Ausstand steht unter beiden mit 9
    // (Lauf 2, M-B); die Spalten «zum Vergleich» lesen dieselben Einträge. Dazu
    // L4 «einfach» unter «alle»: das zweite Ergebnis nach «qualifiziert» zählt
    // unter allen (M2).
    name: 'Zählweise der Köpfe (L13)',
    m: gemeinschaft(VIER),
    posten: [
      { nummer: '1', titel: 'Wichtig, Vorgabe', e: l13('k-verwaltung-wichtig', {}), vergleiche: ['L13', 'L1'] },
      { nummer: '2', titel: 'Wichtig, alle', e: l13('k-verwaltung-wichtig', { L13: 'alle' }), vergleiche: ['L13', 'L1'] },
      // Die Wahl zu L1 setzt im Betrieb der Auslöser am Traktandum; hier von Hand.
      { nummer: '3', titel: 'Wichtig, Vorgabe, fällt heraus', e: { ...l13('k-verwaltung-wichtig', {}), ausstandslesart: 'faellt_heraus' }, vergleiche: ['L13', 'L1'] },
      { nummer: '4', titel: 'Wichtig, alle, fällt heraus', e: { ...l13('k-verwaltung-wichtig', { L13: 'alle' }), ausstandslesart: 'faellt_heraus' }, vergleiche: ['L13', 'L1'] },
      { nummer: '5', titel: 'Notwendig, Vorgabe', e: l13('k-baulich-notwendig', {}), vergleiche: ['L13'] },
      { nummer: '6', titel: 'Notwendig, alle', e: l13('k-baulich-notwendig', { L13: 'alle' }), vergleiche: ['L13'] },
      { nummer: '7', titel: 'L4 einfach, alle', e: l13('k-bewirtschaftung-waehlen-erweitert', { L13: 'alle', L4: 'einfach' }), vergleiche: ['L4'] }
    ],
    lagen: LAGEN_VIER
  },
  {
    // Codeprüfung Block C, Lauf 2 (Nachbau des Prüfers): L2, L4 und L11 unter
    // «alle» je mit L1 beider Wahlen, Abweichung der Leitung in drei Richtungen,
    // Enthaltungsklausel, Rückkommen, Art. 647e Abs. 2.
    name: 'Zählweise der Köpfe (L13), erweitert',
    m: gemeinschaft(VIER),
    posten: (() => {
      const KL = { fundstelle: 'Art. 12 Abs. 3 Reglement (erfunden)' };
      const l13k = (id, wahl) =>
        wendeReglementAn(waehleErfordernis(RW14, id).ergebnis, [], KL, { ...LESARTEN_VORGABE, ...wahl }).erfordernis;
      const fh = (e) => ({ ...e, ausstandslesart: 'faellt_heraus' });
      const BEGR = 'So stand es in der Einladung';
      return [
        { nummer: '1', titel: 'L2 einfach, alle', e: l13('k-zustaendigkeit-gewoehnlich', { L13: 'alle' }) },
        { nummer: '2', titel: 'L2 einfach, alle, fh', e: fh(l13('k-zustaendigkeit-gewoehnlich', { L13: 'alle' })) },
        { nummer: '3', titel: 'L2 qualifiziert, alle, fh', e: fh(l13('k-zustaendigkeit-gewoehnlich', { L13: 'alle', L2: 'qualifiziert' })) },
        { nummer: '4', titel: 'L11 einfach, alle', e: l13('k-prozessfuehrung', { L13: 'alle', L11: 'einfach' }) },
        { nummer: '5', titel: 'L11 einfach, alle, fh', e: fh(l13('k-prozessfuehrung', { L13: 'alle', L11: 'einfach' })) },
        { nummer: '6', titel: 'L4 qualifiziert, alle, fh', e: fh(l13('k-bewirtschaftung-waehlen-erweitert', { L13: 'alle' })) },
        { nummer: '7', titel: 'L4 einfach, alle, fh', e: fh(l13('k-bewirtschaftung-waehlen-erweitert', { L13: 'alle', L4: 'einfach' })) },
        { nummer: '8', titel: 'Abweichung milder von notwendig alle', e: uebersteuere(RW14, l13('k-baulich-notwendig', { L13: 'alle' }), 'einfaches_mehr', BEGR, { kopfbasis: 'anwesend_vertreten' }).ergebnis },
        { nummer: '9', titel: 'Abweichung milder von wichtig alle', e: uebersteuere(RW14, l13('k-verwaltung-wichtig', { L13: 'alle' }), 'einfaches_mehr', BEGR).ergebnis },
        { nummer: '10', titel: 'Abweichung milder von wichtig alle fh', e: uebersteuere(RW14, fh(l13('k-verwaltung-wichtig', { L13: 'alle' })), 'einfaches_mehr', BEGR).ergebnis },
        { nummer: '11', titel: 'Abweichung strenger von notwendig alle', e: uebersteuere(RW14, l13('k-baulich-notwendig', { L13: 'alle' }), 'qualifiziertes_mehr', BEGR).ergebnis },
        { nummer: '12', titel: 'Abweichung milder von wichtig Vorgabe', e: uebersteuere(RW14, l13('k-verwaltung-wichtig', {}), 'einfaches_mehr', BEGR).ergebnis },
        { nummer: '13', titel: 'Klausel notwendig alle', e: l13k('k-baulich-notwendig', { L13: 'alle' }) },
        { nummer: '14', titel: 'Klausel L2 alle', e: l13k('k-zustaendigkeit-gewoehnlich', { L13: 'alle' }) },
        { nummer: '15', titel: 'Klausel L2 alle fh', e: fh(l13k('k-zustaendigkeit-gewoehnlich', { L13: 'alle' })) },
        { nummer: '16', titel: 'Rückkommen wichtig alle', e: erfordernisFuerRueckkommen(l13('k-verwaltung-wichtig', { L13: 'alle' }), true) },
        { nummer: '17', titel: 'Rückkommen wichtig alle fh', e: erfordernisFuerRueckkommen(fh(l13('k-verwaltung-wichtig', { L13: 'alle' })), true) },
        { nummer: '18', titel: 'Rückkommen wichtig Vorgabe', e: erfordernisFuerRueckkommen(l13('k-verwaltung-wichtig', {}), true) },
        { nummer: '19', titel: 'Luxus-Ausweg alle fh', e: fh(l13('k-baulich-luxurioes-ausweg', { L13: 'alle' })) }
      ];
    })(),
    lagen: LAGEN_VIER
  },
  {
    // Lauf 2, M-B: Wo die Mappe die 7 erklärt (hier wegen der Ausschlussklage),
    // rechnet eine 7 an jedem anderen Traktandum wie die 9. Der Ausstand steht
    // an den Traktanden zu L13 deshalb mit 7, an der Klage wie sonst.
    name: 'Zählweise der Köpfe (L13), Ausstand mit 7',
    m: gemeinschaft(VIER),
    posten: [
      { nummer: '1', titel: 'Ausschlussklage', e: nachWahl(KLAGE_NEU, {}), betroffen: 'p4' },
      { nummer: '2', titel: 'Wichtig, Vorgabe', e: l13('k-verwaltung-wichtig', {}), ausstandMit: 7 },
      { nummer: '3', titel: 'Wichtig, alle', e: l13('k-verwaltung-wichtig', { L13: 'alle' }), ausstandMit: 7 },
      { nummer: '4', titel: 'Wichtig, alle, fällt heraus', e: { ...l13('k-verwaltung-wichtig', { L13: 'alle' }), ausstandslesart: 'faellt_heraus' }, ausstandMit: 7 },
      { nummer: '5', titel: 'Wichtig, Vorgabe, fällt heraus', e: { ...l13('k-verwaltung-wichtig', {}), ausstandslesart: 'faellt_heraus' }, ausstandMit: 7 },
      { nummer: '6', titel: 'Notwendig, alle', e: l13('k-baulich-notwendig', { L13: 'alle' }), ausstandMit: 7 },
      // Der Kopfzweig «7 wie 9» (\`siebenWieNeun\`, «Bezugsgrösse Kopfstimmen»): Kopfbasis
      // aller Eigentümer von Hand gesetzt, ohne L13, ohne Ausschlussklage. Hier
      // gilt die 7 wie die 9 und fällt aus der Zahl (Pendenz Block C, Lauf 2, N1).
      { nummer: '7', titel: 'Alle Eigentümer von Hand, ohne L13',
        e: uebersteuere(RW14, l13('k-verwaltung-wichtig', {}), 'qualifiziertes_mehr', 'So stand es in der Einladung', { kopfbasis: 'alle_eigentuemer' }).ergebnis,
        ausstandMit: 7 },
      // Dasselbe ab der Fassung 2026-11-16 (Entscheid 0050, Antwort 1): Die Partei
      // im Ausstand bleibt in der Zahl, mit 7 wie mit 9 (\`ausstandBleibtBeiGewaehlterBasis\`).
      { nummer: '8', titel: 'Alle Eigentümer von Hand, ab 2026-11-16',
        e: uebersteuere(RW16, l13Neu('k-verwaltung-wichtig', {}), 'qualifiziertes_mehr', 'So stand es in der Einladung', { kopfbasis: 'alle_eigentuemer' }).ergebnis,
        ausstandMit: 7 },
      // Fachprüfung Textrunde 0050, Runde 3, R3-F-1: An der Ausschlussklage mit von Hand
      // gesetzter Basis aller trägt Diener als Beklagter eine 9 und fällt aus der Zahl;
      // Angehörige im Ausstand bleiben mit 7. An der Einsprache fallen Betroffene und
      // Ausstand beide mit 9 heraus, wie unter L13, das dort nicht wirkt
      // (Folge aus Entscheid 0050, Antwort 1: dieselbe Regel wie unter L13).
      { nummer: '9', titel: 'Ausschlussklage, alle Eigentümer von Hand',
        e: uebersteuere(RW16, l13Neu('k-ausschlussklage', {}), 'einfaches_mehr', 'So stand es in der Einladung', { kopfbasis: 'alle_eigentuemer' }).ergebnis,
        betroffen: 'p4' },
      { nummer: '10', titel: 'Einsprache, alle Eigentümer von Hand',
        e: uebersteuere(RW16, l13Neu('k-einsprache', {}), 'einfaches_mehr', 'So stand es in der Einladung', { kopfbasis: 'alle_eigentuemer' }).ergebnis,
        betroffen: 'p4' }
    ],
    lagen: LAGEN_VIER
  },
  {
    // Featureprüfung Regel 43, M3: Diener ist im Ausstand und zugleich als
    // betroffen eingetragen, wie es das Traktandenformular zulässt. Unter L13
    // «Alle Eigentümer» bleibt Diener in der Kopfzahl (Antwort 9), an der
    // Ausschlussklage fällt Diener als Beklagter weiter heraus. Bis zur Behebung
    // zählte der Kern hier eine Kopfstimme weniger als die Mappe.
    name: 'Zählweise der Köpfe (L13), im Ausstand und betroffen',
    m: gemeinschaft(VIER),
    posten: [
      { nummer: '1', titel: 'Wichtig, alle', e: l13('k-verwaltung-wichtig', { L13: 'alle' }), betroffen: 'p4', vergleiche: ['L13', 'L1'] },
      { nummer: '2', titel: 'Notwendig, alle', e: l13('k-baulich-notwendig', { L13: 'alle' }), betroffen: 'p4', vergleiche: ['L13'] },
      { nummer: '3', titel: 'Wichtig, Vorgabe', e: l13('k-verwaltung-wichtig', {}), betroffen: 'p4', vergleiche: ['L13', 'L1'] },
      { nummer: '4', titel: 'Ausschlussklage', e: nachWahl(KLAGE_NEU, {}), betroffen: 'p4' }
    ],
    // Diener steht in jeder Lage im Ausstand; sonst trüge «betroffen» eine 9
    // für jemanden ein, der nicht im Ausstand ist.
    lagen: [
      ['zwei ja ein nein', ['ja', 'ja', 'nein', 'ausstand']],
      ['ein ja zwei nein', ['ja', 'nein', 'nein', 'ausstand']],
      ['drei ja', ['ja', 'ja', 'ja', 'ausstand']],
      ['Caduff ebenfalls im Ausstand', ['ja', 'nein', 'ausstand', 'ausstand']],
      ['niemand hat abgestimmt', ['offen', 'offen', 'offen', 'ausstand']]
    ]
  },
  {
    // A2, Pendenz «Gemeinsame Wohnung des Beklagten»: Diener gehört gemeinsam,
    // der Antrag richtet sich nur gegen eine Person; mit einer Regel über die
    // anwesenden Wertquoten zählte «leer» dort mit, der Kern nicht.
    name: 'Gemeinsame Wohnung des Beklagten',
    m: gemeinschaft([['Aebi', [400]], ['Berger', [300]], ['Caduff', [201]], ['Diener', [99], true]]),
    posten: [
      { nummer: '1', titel: 'Ausschlussklage', e: KLAGE, betroffen: 'p4', vergleiche: ['1a'] },
      { nummer: '2', titel: 'Ausschlussklage, Wertquoten der Anwesenden',
        e: { ...KLAGE, quotenbasis: 'anwesend_vertreten', quotenSchwelle: HAELFTE, quelle: 'reglement' }, betroffen: 'p4', vergleiche: ['1a'] }
    ],
    lagen: LAGEN_VIER
  },
  ...['je_eigentuemer', 'je_einheit'].map((wahl) => ({
    // L3: Aebi hat drei Einheiten; je Einheit 3 zu 2, je Eigentümer 1 zu 2.
    name: 'Einsprache, ' + wahl,
    m: gemeinschaft([['Aebi', [200, 200, 100]], ['Berger', [200]], ['Caduff', [200]], ['Diener', [100]]], 'per_unit'),
    posten: [{ nummer: '1', titel: 'Einsprache', e: { ...waehle('k-einsprache'), einspracheLesart: wahl }, betroffen: 'p4', vergleiche: ['L3'] }],
    lagen: [
      ['je Einheit angenommen', ['ja', 'nein', 'nein', 'nein']],
      ['alle ja', ['ja', 'ja', 'ja', 'ja']],
      ['Aebi nein', ['nein', 'ja', 'ja', 'offen']],
      ['Aebi fehlt', ['fehlt', 'ja', 'nein', 'ja']]
    ]
  })),
  ...['wertquote', 'wertquote_verwalter', 'verwalter', 'vorsitz'].map((art) => ({
    // A1 Frage 1: Stichentscheid nur beim einfachen Mehr ohne Wertquoten. Die
    // Wertquoten von Ja und Nein sind im zweiten Gleichstand gleich (500 zu 500).
    name: 'Stichentscheid ' + art,
    m: gemeinschaft([['Aebi', [300]], ['Berger', [200]], ['Caduff', [250]], ['Diener', [250]]], 'per_owner', art),
    posten: [
      { nummer: '1', titel: 'Einfaches Mehr', e: EINFACH, vergleiche: [] },
      { nummer: '2', titel: 'Qualifiziertes Mehr', e: QUALIFIZIERT, vergleiche: ['L1'] }
    ],
    lagen: [
      ['Gleichstand, Ja mit mehr Wertquoten', ['ja', 'nein', 'ja', 'nein']],
      ['Gleichstand, Wertquoten gleich', ['ja', 'ja', 'nein', 'nein']],
      ['Gleichstand, Nein mit mehr Wertquoten', ['nein', 'ja', 'nein', 'ja']],
      ['Gleichstand mit Enthaltung ist keiner', ['ja', 'nein', 'enthaltung', 'offen']],
      ['kein Gleichstand', ['ja', 'ja', 'ja', 'nein']]
    ]
  })),
  ...[['erste', null], ['drittel', null], ['erste', REGEL_ERSTE]].map(([wahl, regel]) => ({
    // L5: ein neues Traktandum der zweiten Versammlung, nach beiden Wahlen, und
    // mit einer Reglementsregel ohne Wertquoten für die erste (Codeprüfung, N6).
    name: 'Neues Traktandum, ' + wahl + (regel ? ', Regel der ersten' : ''),
    m: gemeinschaft(VIER),
    neuAnZweiterWahl: wahl,
    regelErste: regel,
    posten: [{ nummer: '1', titel: 'Neues Geschäft', e: EINFACH, neu: true, vergleiche: ['L5'] }],
    lagen: [
      ['alle da', ['ja', 'ja', 'nein', 'nein']],
      ['zwei da mit genug Wertquoten', ['ja', 'nein', 'fehlt', 'fehlt']],
      ['einer da', ['ja', 'fehlt', 'fehlt', 'fehlt']],
      ['zwei da mit zu wenig Wertquoten', ['fehlt', 'fehlt', 'ja', 'ja']]
    ]
  }))
];

const EINTRAG = { ja: 1, enthaltung: 2, nein: 3, offen: null, fehlt: null, ruht: 8 };
const KLASSE = (s) => s.startsWith('ANGENOMMEN') ? 'ANGENOMMEN' : s.startsWith('GLEICHSTAND') ? 'GLEICHSTAND' : s;

const soll = [];
let nr = 0;
for (const mappe of MAPPEN) {
  const m = mappe.m;
  const liste = stimmkraftliste(m);
  const posten = mappe.posten.map((t) => {
    const p = mappenpostenAus(t, t.e, m, { neuAnZweiter: t.neu === true, wahl: mappe.neuAnZweiterWahl ?? 'erste' });
    if (!p) throw new Error(mappe.name + ' · ' + t.titel + ': kein Posten');
    // Ein Vergleich, der still fehlt, wäre ein grüner Lauf ohne Prüfung.
    const hat = (p.vergleiche ?? []).map((v) => v.kennung).join(',');
    if (t.vergleiche && hat !== t.vergleiche.join(',')) {
      throw new Error(mappe.name + ' · ' + t.titel + ': Vergleiche «' + hat + '», erwartet «' + t.vergleiche.join(',') + '»');
    }
    return p;
  });
  const regelErste = mappe.regelErste ?? null;

  for (const [lagename, stimmen] of mappe.lagen) {
    const blatt = baueAuszaehlmappe({
      gemeinschaftName: 'Probe', datum: '4. August 2026', uhrzeit: '19:30', ort: 'Saal',
      gesamtquote: m.totalQuota, jeEinheit: m.headCountMode !== 'per_owner',
      ausstandslesart: 'bleibt', stichentscheid: m.tieBreak,
      ersteVersammlung: regelErste, neuAnZweiterWahl: mappe.neuAnZweiterWahl,
      parteien: liste.eintraege.map((e) => ({ name: e.displayName, kopfstimmen: e.kopfstimmen,
        kopfstimmenJeEigentuemer: kopfgewicht({ units: e.einheiten }, 'per_owner', false), wertquote: e.wertquote })),
      posten
    });

    /*
     * Wo die Spalten stehen, liest der Erzeuger aus dem Blatt: die Traktanden aus
     * der Kopfzeile «Traktandum», «anwesend» aus der Zeile «Partei». Ändert
     * jemand den Aufbau, schlägt das hier fehl statt still danebenzugreifen.
     */
    const kopf = blatt.zeilen.find((z) => z[0]?.art === 'text' && z[0].wert === 'Traktandum');
    const parteikopf = blatt.zeilen.find((z) => z[0]?.art === 'text' && z[0].wert === 'Partei');
    const spAnwesend = parteikopf.findIndex((z) => z.art === 'text' && z.wert === 'anwesend (1)');
    const spErste = spAnwesend + 1;
    if (!kopf || spAnwesend < 0 || kopf.length - spErste !== posten.reduce((s, p) => s + 1 + (p.vergleiche?.length ?? 0), 0)) {
      throw new Error(mappe.name + ': Spalten der Mappe nicht gefunden');
    }

    const anwesende = m.parties.filter((_, i) => stimmen[i] !== 'fehlt').map((p) => p.partyId);
    const imAusstand = m.parties.filter((_, i) => stimmen[i] === 'ausstand').map((p) => p.partyId);
    const vertreter = imAusstand[0];
    const vertretungen = m.parties.filter((_, i) => stimmen[i] === 'ruht').map((p) => ({ vertreteneId: p.partyId, bevollmaechtigtId: vertreter }));
    if (vertretungen.length > 0 && !vertreter) throw new Error(lagename + ': «ruht» braucht eine Partei im Ausstand');

    let sp = spErste;
    const spalten = [];
    posten.forEach((p, t) => {
      const def = mappe.posten[t];
      const alle = [p, ...(p.vergleiche ?? []).map((v) => v.rechnung)];
      // Eine 7 nur nach 1e an der Ausschlussklage; «ausstandMit» erzwingt sie zur Probe (Block C, Lauf 2, M-B).
      const sieben = def.ausstandMit !== undefined ? def.ausstandMit === 7 : alle.some((r) => r.ausstandBleibtInDerZahl);
      const wohnung = alle.some((r) => r.beklagtenwohnungZaehltMit);
      // Die Stimmen ins Blatt, nur in die Spalte des Traktandums.
      m.parties.forEach((partei, i) => {
        const zeile = blatt.zeilen.find((z) => z[0]?.art === 'text' && z[0].wert === partei.displayName);
        if (!zeile) throw new Error('Parteizeile nicht gefunden: ' + partei.displayName);
        if (stimmen[i] !== 'fehlt') zeile[spAnwesend] = { art: 'zahl', wert: 1, stil: 'eingabe' };
        const wahl = stimmen[i];
        const wert = def.betroffen === partei.partyId
          ? (partei.isCommunity && wohnung ? 7 : 9)
          : wahl === 'ausstand' ? (sieben ? 7 : 9) : EINTRAG[wahl];
        zeile[sp] = wert === null || wahl === 'fehlt' ? { art: 'leer', stil: 'eingabe' } : { art: 'zahl', wert, stil: 'eingabe' };
      });

      // Dieselbe Lage durch den Code, der im Saal zählt.
      const kernlage = (e) => {
        const votes = [];
        m.parties.forEach((partei, i) => {
          const wahl = stimmen[i];
          if (def.betroffen === partei.partyId || !['ja', 'nein', 'enthaltung'].includes(wahl)) return;
          for (const u of partei.units) {
            votes.push({ partyId: partei.partyId, unitId: u.unitId,
              choice: wahl === 'ja' ? 'yes' : wahl === 'nein' ? 'no' : 'abstain',
              castAt: '2026-09-15T19:10:00.000Z', recordedByChair: false });
          }
        });
        return { momentaufnahme: m, erfordernis: e, stimmen: votes, anwesende, imAusstand, vertretungen,
          ...(def.betroffen ? { betroffeneParteiIds: [def.betroffen] } : {}) };
      };
      const andere = new Map(vergleicheZu(def.e, m).map((v) => [v.worte.kennung, v.erfordernis]));
      const haupt = zaehleAus(kernlage(def.e));
      const spaltenDesPostens = [{ e: def.e, a: haupt, r: p, kennung: null }];
      for (const v of p.vergleiche ?? []) {
        const e = v.kennung === 'L5' ? def.e : andere.get(v.kennung);
        spaltenDesPostens.push({ e, a: v.kennung === 'L5' ? haupt : zaehleAus(kernlage(e)), r: v.rechnung, kennung: v.kennung });
      }

      // Was der Kern selbst als zweites Ergebnis nennt, muss die Spalte ebenso sagen.
      const inSich = [];
      for (const r of andereLesartenVon(haupt)) {
        // B3 führt die Mappe bewusst nicht (Entscheid 0041, vergleicheZu), L10
        // ebenso nicht (Codeprüfung E1 Block D, H1): Die 7 oder 9 der Angehörigen
        // trägt die Leitung selbst ein.
        if (r.kennung === 'B3' || r.kennung === 'L10') continue;
        const s = spaltenDesPostens.find((x) => x.kennung === r.kennung);
        if (!s) { inSich.push('Der Kern nennt ' + r.kennung + ', die Mappe hat keine Spalte dafür'); continue; }
        if (r.feststellbar && r.angenommen !== s.a.angenommen) inSich.push(r.kennung + ': Kern ' + r.angenommen + ', Vergleich ' + s.a.angenommen);
        if (r.nichtFeststellbarWeil === 'stichentscheid' && !s.a.stichentscheidOffen) inSich.push(r.kennung + ': Kern offen, Vergleich nicht');
      }

      const beteiligung = beteiligungDerAnwesenden(liste, anwesende);
      const wieErste = stelleBeschlussfaehigkeitFest('erste', beteiligung, regelErste);
      let hauptKlasse = null;
      for (const s of spaltenDesPostens) {
        const a = s.a;
        const ergebnis = s.r.nurBeschlussfaehigWieErste && !wieErste.beschlussfaehig ? 'NICHT VERBINDLICH'
          : a.stichentscheidOffen ? 'GLEICHSTAND'
          : a.angenommen ? 'ANGENOMMEN' : 'abgelehnt';
        if (s.kennung === null) hauptKlasse = ergebnis;
        const ausstandQuote = s.e.quotenbasis === 'alle_quoten'
          ? (a.quoten.imAusstand ?? 0) + (a.quoten.stimmtNicht ?? 0) + (m.totalQuota - a.quoten.basis)
          : undefined;
        spalten.push({
          spalte: sp, titel: p.nummer + (s.kennung ? ' zum Vergleich ' + s.kennung : ' ' + p.titel),
          werte: {
            jaKopf: a.koepfe.ja, neinKopf: a.koepfe.nein, enthaltungKopf: a.koepfe.enthaltung,
            // Gezählt, nicht entschieden: Den Stichentscheid trägt der Kern in
            // koepfe.erreicht ein, die Mappe nur in «Ergebnis» (geprüft unten).
            basisKopf: a.koepfe.basis, noetigKopf: a.koepfe.schwelle,
            kopfErreicht: a.koepfe.erreicht && !a.durchStichentscheid,
            jaQuote: a.quoten.ja, neinQuote: a.quoten.nein, enthaltungQuote: a.quoten.enthaltung,
            basisQuote: a.quoten.basis, noetigQuote: a.quoten.schwelle, quotenErreicht: a.quoten.erreicht,
            ausstandQuote,
            erreichbarQuote: ausstandQuote === undefined ? undefined : m.totalQuota - ausstandQuote
          },
          ergebnis,
          stichentscheid: a.durchStichentscheid === true && a.angenommen,
          // In der Folge der Formel: Nur ein nicht verbindliches Traktandum ist kein
          // Beschluss (R4-L-2), und das geht vor «offen» (Codeprüfung, N4).
          weicht: s.kennung === null ? null
            : hauptKlasse === 'NICHT VERBINDLICH' && ergebnis !== 'NICHT VERBINDLICH' ? 'kein Beschluss'
            : ergebnis === 'GLEICHSTAND' || hauptKlasse === 'GLEICHSTAND' ? 'offen'
            : ergebnis === hauptKlasse ? 'nein' : 'JA',
          inSich: s.kennung === null ? inSich : []
        });
        sp++;
      }
    });

    const beteiligung = beteiligungDerAnwesenden(liste, anwesende);
    const wieErste = stelleBeschlussfaehigkeitFest('erste', beteiligung, regelErste);
    writeFileSync('/aus/m' + nr + '.xlsx', alsArbeitsmappe([blatt], dosZeitstempel('2026-01-01 00:00:00')));
    soll.push({
      lage: mappe.name + ' · ' + lagename, spalten, spAnwesend,
      erste: posten.some((p) => p.neuAnZweiter) ? {
        eigentuemer: beteiligung.eigentuemerAnwesend, noetigEigentuemer: wieErste.bedingungen[0].noetig,
        quoten: beteiligung.quotenAnwesend, noetigQuoten: wieErste.bedingungen[1]?.noetig ?? null,
        beschlussfaehig: wieErste.beschlussfaehig
      } : null
    });
    nr++;
  }
}

writeFileSync('/aus/soll.json', JSON.stringify(soll));
console.log('Lagen: ' + soll.length);
`;

/*
 * **Node liest die TypeScript-Module selbst, kein `npx vite-node`** (aus dem
 * Sicherheitsdurchgang, 05.09.2026). `npx vite-node` hätte das Paket beim
 * ersten Lauf in einem frischen Container ungeprüft aus der Registry geholt und
 * als root in einem Verzeichnis ausgeführt, das schreibend am Host hängt.
 * (Seit dem 22.09.2026 steht `vite-node` gepinnt im Lockfile, der Satz
 * «in keiner Abhängigkeitsliste» stand hier bis dahin und gilt nicht mehr.
 * Der Entscheid bleibt: Node liest hier selbst, ein Werkzeug weniger.) Node 24 im
 * Container liest TypeScript selbst. Es braucht `--experimental-transform-types`
 * und nicht das schlankere `--experimental-strip-types`: `fehler.ts` nutzt eine
 * Parameter-Eigenschaft im Konstruktor, und die kann der Nur-Streichen-Modus
 * nicht.
 *
 * Was dabei fehlt, ist die Auflösung endungsloser Importe: Die Domänenmodule
 * schreiben `from './xlsx'`, Node verlangt `./xlsx.ts`. Der Hook unten ergänzt
 * die Endung, wenn und nur wenn die gewöhnliche Auflösung scheitert — fünfzehn
 * Zeilen statt einer neuen Abhängigkeit für ein Werkzeug, das von Hand
 * aufgerufen wird. Das Regelwerk bindet `$lib/…` nur als Typ ein; das fällt
 * beim Übersetzen weg.
 */
const aufloeser = `
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (fehler) {
    if (/^[./]/.test(spec) && !/\\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx);
    throw fehler;
  }
}
`;
const vorschalt = `
import { register } from 'node:module';
register('/aus/aufloeser.mjs', import.meta.url);
await import('/aus/erzeuger.mjs');
`;
writeFileSync(join(arbeit, 'erzeuger.mjs'), erzeuger);
writeFileSync(join(arbeit, 'aufloeser.mjs'), aufloeser);
writeFileSync(join(arbeit, 'start.mjs'), vorschalt);
imContainer(
	'/aus/start.mjs',
	'Die Mappen liessen sich nicht erzeugen. Wirft der Domänencode, oder kann\n' +
		'Node die TypeScript-Module nicht laden?'
);
const sollwerte = JSON.parse(readFileSync(join(arbeit, 'soll.json'), 'utf8'));

/** Wandelt eine Mappe mit Calc um — dabei rechnet Calc die Formeln. */
function rechne(xlsx, ziel) {
	try {
		execFileSync(
			'soffice',
			[
				`-env:UserInstallation=file://${join(arbeit, 'profil')}`,
				'--headless',
				'--convert-to',
				'csv',
				'--outdir',
				ziel,
				xlsx
			],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
		);
	} catch (fehler) {
		absage(
			'LibreOffice konnte die Mappe nicht rechnen. Fehlt Calc?\n' +
				'  ls /usr/lib/libreoffice/share/registry/calc.xcd\n' +
				'  apt-get install --no-install-recommends libreoffice-calc-nogui\n\n' +
				(fehler.stderr || fehler.message)
		);
	}
}

/*
 * **Felder in Anführungszeichen dürfen ein Komma tragen** (A2, 30.10.2026):
 * Die Zeile «Wertquoten im Ausstand (9, 7)» zerfiel beim blossen Trennen am
 * Komma, und die Probe fand ihre eigene Zeile nicht mehr.
 */
function zellen(text) {
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

/** Die Zeile mit dieser Beschriftung, oder mit diesem Anfang, wo die Beschriftung je Mappe wechselt. */
function zeileMit(tabelle, beschriftung, lage, anfang = false) {
	const treffer = tabelle.find((z) => (anfang ? z[0].startsWith(beschriftung) : z[0] === beschriftung));
	if (!treffer) {
		absage(
			`In der Lage «${lage}» steht die Zeile «${beschriftung}» nicht in der\n` +
				'gerechneten Mappe. Wurde der Aufbau geändert? Dieses Skript sucht über die\n' +
				'Beschriftung in Spalte A, damit eine Änderung auffällt statt danebenzugreifen.'
		);
	}
	return treffer;
}

/** Die Zeilen der Mappe und das Feld aus `zaehleAus`, das ihnen entspricht. */
const ZEILEN = [
	['Ja (Kopfstimmen)', 'jaKopf'],
	['Nein (Kopfstimmen)', 'neinKopf'],
	['Enthaltung (Kopfstimmen)', 'enthaltungKopf'],
	['Bezugsgrösse Kopfstimmen', 'basisKopf'],
	['Nötig (Kopfstimmen)', 'noetigKopf'],
	['Ja (Wertquoten)', 'jaQuote'],
	['Nein (Wertquoten)', 'neinQuote'],
	['Enthaltung (Wertquoten)', 'enthaltungQuote'],
	['Bezugsgrösse Wertquoten', 'basisQuote'],
	['Nötig (Wertquoten)', 'noetigQuote'],
	/*
	 * **Was der Ausstand von allen Wertquoten wegnimmt** (Codeprüfung der
	 * Review-Behebung, N5). Nur beim Mehr aller Wertquoten; dort ergibt sich
	 * die Zahl aus den Eimern des Codes: Ausstand, die Quote des Beklagten, die
	 * gemeinsame Wohnung des Beklagten (`stimmtNicht`) und was nach L1 «fällt
	 * heraus» den Nenner verlassen hat. Die Beschriftung nennt seit A3 den
	 * Beklagten mit, wo Betroffene nicht mitstimmen; gesucht wird am Anfang.
	 */
	['Wertquoten im Ausstand', 'ausstandQuote', true],
	['Noch erreichbar (Wertquoten)', 'erreichbarQuote']
];

/** Die Ja-/Nein-Zeilen. Sie prüfen die `IF`-Ketten, nicht nur die Summen. */
const URTEILE = [
	['Kopfmehr erreicht', 'kopfErreicht'],
	['Quotenmehr erreicht', 'quotenErreicht']
];

const abweichungen = [];
let geprueft = 0;
let spaltenGeprueft = 0;

for (const [nr, erwartet] of sollwerte.entries()) {
	const xlsx = join(arbeit, `m${nr}.xlsx`);
	rechne(xlsx, arbeit);
	let csv;
	try {
		csv = readFileSync(join(arbeit, `m${nr}.csv`), 'utf8');
	} catch {
		absage(
			'LibreOffice hat keine CSV-Datei geschrieben — so zeigt sich ein fehlendes\n' +
				'Calc («source file could not be loaded»).\n' +
				'  apt-get install --no-install-recommends libreoffice-calc-nogui'
		);
	}
	const tabelle = zellen(csv);
	const ab = (wo, code, calc) => abweichungen.push(`  ${erwartet.lage} · ${wo}: Code ${code}, Calc ${calc || '(leer)'}`);

	for (const s of erwartet.spalten) {
		spaltenGeprueft++;
		for (const [beschriftung, feld, anfang] of ZEILEN) {
			const roh = (zeileMit(tabelle, beschriftung, erwartet.lage, anfang)[s.spalte] ?? '').trim();
			// «—» und «entfällt» heissen: in dieser Lage rechnet die Mappe nichts.
			if (roh === '—' || roh === 'entfällt') continue;
			// Ohne Gegenstück im Code, etwa der Ausstand ausserhalb des Mehrs aller Wertquoten.
			if (s.werte[feld] === undefined) continue;
			geprueft++;
			const gerechnet = roh === '' ? null : Number(roh);
			if (gerechnet !== s.werte[feld]) ab(`${s.titel} · ${beschriftung}`, s.werte[feld], roh);
		}
		for (const [beschriftung, feld] of URTEILE) {
			const roh = (zeileMit(tabelle, beschriftung, erwartet.lage)[s.spalte] ?? '').trim();
			if (roh === '—' || roh === 'entfällt') continue;
			geprueft++;
			if ((roh === 'ja') !== Boolean(s.werte[feld])) ab(`${s.titel} · ${beschriftung}`, s.werte[feld], `«${roh}»`);
		}
		// Das Ergebnis nach Klasse, und «(Stichentscheid)» genau dort, wo der Kern ihn angewandt hat.
		const roh = (zeileMit(tabelle, 'Ergebnis', erwartet.lage)[s.spalte] ?? '').trim();
		geprueft++;
		if (!roh.startsWith(s.ergebnis)) ab(`${s.titel} · Ergebnis`, s.ergebnis, `«${roh}»`);
		if (roh.includes('(Stichentscheid)') !== s.stichentscheid) {
			ab(`${s.titel} · Stichentscheid`, s.stichentscheid ? 'durch Stichentscheid' : 'ohne', `«${roh}»`);
		}
		if (s.weicht !== null) {
			const w = (zeileMit(tabelle, 'Weicht vom Traktandum ab?', erwartet.lage)[s.spalte] ?? '').trim();
			geprueft++;
			if (!w.startsWith(s.weicht)) ab(`${s.titel} · Weicht ab`, s.weicht, `«${w}»`);
		}
		for (const satz of s.inSich) abweichungen.push(`  ${erwartet.lage} · ${s.titel} · Kern in sich: ${satz}`);
	}

	// L5: die Beschlussfähigkeit einer ersten Versammlung, in der Spalte «anwesend».
	if (erwartet.erste) {
		const e = erwartet.erste;
		for (const [beschriftung, wert, anfang] of [
			['Eigentümer anwesend oder vertreten', e.eigentuemer],
			['Mindestens nötig (Eigentümer', e.noetigEigentuemer, true],
			// Ohne Wertquotenbedingung (Regel der ersten) gibt es beide Zeilen nicht.
			...(e.noetigQuoten === null ? [] : [
				['Wertquoten anwesend oder vertreten', e.quoten],
				['Mindestens nötig (Wertquoten,', e.noetigQuoten, true]
			]),
			['Beschlussfähig wie eine erste Versammlung', e.beschlussfaehig ? 'ja' : 'nein']
		]) {
			const roh = (zeileMit(tabelle, beschriftung, erwartet.lage, anfang)[erwartet.spAnwesend] ?? '').trim();
			geprueft++;
			const gerechnet = typeof wert === 'number' ? Number(roh) : roh;
			if (gerechnet !== wert) ab(beschriftung, wert, roh);
		}
	}
}

aufraeumen();

/*
 * **Eine Untergrenze auf der Zahl der Vergleiche** (aus dem Code-Review): Ein
 * Lauf, der nichts verglichen hat, meldet sonst «in Ordnung». Der Wert liegt
 * deutlich unter dem heutigen Bestand und deutlich über null.
 */
const MINDESTENS = 2000;
if (geprueft < MINDESTENS) {
	console.error(
		`\nNur ${geprueft} Werte verglichen, erwartet mindestens ${MINDESTENS}.\n` +
			'Die Mappe hat also viel weniger gerechnet als sonst — ein Lauf ohne\n' +
			'Vergleiche wäre grün und wertlos.\n'
	);
	process.exit(1);
}

if (abweichungen.length > 0) {
	console.error(
		`\nDie Auszählmappe rechnet anders als der Code: ${abweichungen.length} von ${geprueft} Werten.\n\n` +
			abweichungen.slice(0, 30).join('\n') +
			(abweichungen.length > 30 ? `\n  … und ${abweichungen.length - 30} weitere` : '') +
			'\n\nEin zweiter Rechenweg, der anders rechnet als der erste, ist schlimmer als\n' +
			'gar keiner: Er sieht aus wie eine Bestätigung.\n'
	);
	process.exit(1);
}

console.log(
	`Auszählmappe in Ordnung: ${geprueft} Werte von LibreOffice gerechnet, alle gleich wie im Code ` +
		`(${sollwerte.length} Lagen, ${spaltenGeprueft} Spalten, davon ` +
		`${sollwerte.reduce((s, l) => s + l.spalten.filter((x) => x.weicht !== null).length, 0)} zum Vergleich).`
);
