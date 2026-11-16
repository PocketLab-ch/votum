/**
 * Fassung 2026-11-04: Fundstellen statt «offen», und der sichere Weg (F4a).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-03 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht genau einmal steht oder der
 * neue schon dasteht. Auftrag F4a, Einteilung F3b
 * (`.auftraege/2026-11-03-votum-f3b-einteilung.md` im Arbeitsverzeichnis;
 * Fachprüfung `quellen/pruefung/berichte/2026-11-03-votum-f3b-einteilung-fach.md`),
 * Entscheide 0038 (Rangfolge Gesetz, Bundesgericht, Lehre) und 0039 (das
 * Drittel an der zweiten Versammlung bleibt wählbar, mit Hinweis). Prüfdatei
 * der Sätze: `quellen/pruefung/zu-pruefen-2026-11-04-votum-f4a-saetze.md`
 * (S1 bis S17) mit Runde 2 (`…-runde2.md`) und der Endfassung
 * (`…-endfassung.md`, mit Nachtrag Runde 3) nach Laien- und Fachprüfung in
 * drei Runden
 * (`quellen/pruefung/berichte/2026-11-04-votum-f4a-saetze-*`). Jeder Satz
 * steht als eigene Konstante.
 *
 * **Anlass.** Nach Entscheid 0038 entscheidet eine Frage, wo Gesetz,
 * Bundesgericht oder Lehre sie beantworten; «offen» oder «umstritten» stand
 * an mehreren Karten, obwohl eine Quelle entscheidet. Wo die Quellen uneins
 * sind, nennt die Karte den Weg, der unter jeder Lesart trägt.
 *
 * Was sich an den Karten ändert, je mit Kennung der Prüfdatei:
 *
 *  - S1 `k-wertquoten-aendern`: statt «läuft auf Einstimmigkeit hinaus» die
 *    zwei Erfordernisse von Art. 712e Abs. 2 ZGB, dazu Pfandgläubiger und
 *    Nutzniesser (Rz. 75, 78 bis 80 ad Art. 712e).
 *  - S2 `k-ausschlussklage`, neuer Hinweis: den Beschluss vor der Klage fassen
 *    (BGer 5A_735/2019 E. 3.3.1; Rz. 219a ad Art. 712a).
 *  - S3 `k-ausschlussklage`, ohne und unter angewandter Regel, je an drei
 *    Stellen: Das Gesetz lässt eine Vereinbarung zu (Art. 649b Abs. 2 ZGB),
 *    eingeführt nach Art. 712g Abs. 2; der Übergang nach BGE 143 III 537
 *    E. 4.2.4; der sichere Weg mit Zustimmung aller am Ende.
 *  - S4 `k-ausschlussklage`, in `KLAEGER`: wer betroffen ist (Art. 649b Abs. 1),
 *    und dass es bei unbezahlten Beiträgen keine Stelle gibt.
 *  - S5 `k-einsprache`: auch keine Vollmachten (BGE 134 III 481 E. 3.8;
 *    Handschin/Wyttenbach S. 63), Begründung S. 64 → S. 63 (S17).
 *  - S6 `k-bewirtschaftung-statt-versammlung`, `k-uebertragung-statt-versammlung`:
 *    Rz. 44 stellt die Frage, Rz. 45 beantwortet sie als Meinung der Autoren.
 *  - S7 `k-uebertragung-beschluss`, neuer Hinweis: das einfache Mehr genügt für
 *    Aufgaben, die das Gesetz zuweist (Art. 712m Abs. 1 Ziff. 3, Art. 712s;
 *    Rz. 44 ad Art. 712m). Er erklärt das gesetzliche Mehr und wandert deshalb
 *    unter einer angewandten Regel zum Gesetz.
 *  - S8 `k-bewirtschaftung-erweitert`, neuer Hinweis: Art. 647b Abs. 1 trägt die
 *    Rechnung, Rz. 115 ad Art. 712m zieht eine engere Grenze, Rz. 79 ad
 *    Art. 712s nennt die Vermietung als übertragbar.
 *  - S14 `k-reglement-eigene-schranke`, Hinweis «Zum Streit»: die
 *    Zusammenfassung der Lehre in BGer 5C.50/2004 E. 4.2.
 *
 * **Am Erfordernis ändert sich nichts**: Typ, Bezugsgrössen und Verhalten
 * jeder Karte bleiben, es kommt kein Traktandum in den Kasten «älteres
 * Erfordernis».
 *
 * **Nicht in dieser Datei:** S10 bis S13, S15 bis S17 stehen ausserhalb des
 * Regelwerks (Stichentscheid, Formular, Handbuch, Lesart L5, Restpaket,
 * Seitenzahlen); sie hängen an keiner Fassung. S9 (Rückkommen) entfällt: Der
 * erzeugte Wortlaut des Rückkommensantrags trägt den sicheren Weg schon
 * (Codeprüfung, Fachprüfung Runde 3). S8 steht unter einer angewandten Regel
 * im Abschnitt «Zum gesetzlichen Erfordernis».
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_03, KLAEGER as KLAEGER_VORHER } from './quorum-2026-11-03';
import { EINSPRACHE_BETROFFENE_ANWENDUNG as EINSPRACHE_BETROFFENE_VORHER, EINSPRACHE_KNOTEN_ID } from './quorum-2026-10-20';
import {
	BEWIRTSCHAFTUNG_STATT_ID,
	DELEGATION_GESPERRT,
	ERWEITERT_ID,
	UEBERTRAGUNG_BESCHLUSS_ID,
	UEBERTRAGUNG_STATT_ID,
	WARUM_EINSTIMMIG as WARUM_EINSTIMMIG_VORHER
} from './quorum-2026-10-27';

// ── S1: Wertquoten ändern, alle Einheiten betroffen (H7) ────────────────────

const WERTQUOTEN_ALLE_VORHER =
	'Ändern sich die Quoten aller Einheiten, sind alle Eigentümer unmittelbar beteiligt — dann läuft die ' +
	'Bestimmung auf Einstimmigkeit hinaus.';

/**
 * S1, F4a (H7; Endfassung, Fach R2-1, Laien N3): ZGB Art. 712e Abs. 2,
 * Zustimmung aller Beteiligten und Genehmigung; Pfandgläubiger und
 * Nutzniesser nach SVIT-Kommentar Rz. 75 und 78 bis 80 ad Art. 712e.
 */
export const WERTQUOTEN_ALLE =
	'Ändern sich die Quoten aller Einheiten, sind alle Eigentümer unmittelbar beteiligt. Dann muss jeder ' +
	'einzelne Eigentümer schriftlich zustimmen, auch wer nicht an die Versammlung kommt, und die Versammlung ' +
	'muss die Änderung genehmigen (ZGB Art. 712e Abs. 2). Zustimmen müssen auch die Pfandgläubiger, etwa die ' +
	'Bank mit einer Hypothek, und die Nutzniesser der Einheiten, deren Quote sich ändert. Die Pfandgläubiger ' +
	'müssen nach dem Bundesgericht auch dann zustimmen, wenn die Quote steigt (SVIT-Kommentar Rz. 75 und 78 ' +
	'bis 80 ad Art. 712e).';

// ── S2 bis S4: Ermächtigung zur Ausschlussklage ─────────────────────────────

/** Der Hinweis der Vorfassung, hinter dem S2 steht. */
const AUSSCHLUSS_DURCH_GERICHT =
	'Der Ausschluss selbst spricht das Gericht aus; die Versammlung ermächtigt nur zur Klage (BGer 5A_735/2019 E. 3.3.1).';

/** S2, F4a (A5): BGer 5A_735/2019 E. 3.3.1; SVIT-Kommentar Rz. 219a ad Art. 712a; Nachholen offen (5A_447/2014 E. 3). */
export const ERMAECHTIGUNG_VORHER =
	'Fassen Sie diesen Beschluss, bevor jemand klagt. Ohne ihn scheitert die Klage (BGer 5A_735/2019 E. 3.3.1; ' +
	'SVIT-Kommentar Rz. 219a ad Art. 712a). Ob er sich während des Prozesses nachholen lässt, hat für die ' +
	'Ausschlussklage kein Gericht entschieden.';

const REGLEMENT_DARF_AENDERN_VORHER =
	'Ob das Reglement dieses Mehr überhaupt ändern darf, ist umstritten: Der Wortlaut («wenn nichts anderes ' +
	'vereinbart ist») lässt eine Vereinbarung zu, der SVIT-Kommentar hält die Bestimmung für zwingend ' +
	'(Art. 712g Rz. 55) und eine Verschärfung für unzulässig (Art. 712a Rz. 206).';
const REGLEMENT_DARF_AENDERN_VORHER_UNTER_REGEL = REGLEMENT_DARF_AENDERN_VORHER.replace(
	'ist umstritten:',
	'ist ebenfalls umstritten:'
);

/**
 * S3, F4a (A6; Endfassung, Fach F-1, Laien N4 und N7), Website und Anwendung:
 * ZGB Art. 649b Abs. 2 («wenn nichts anderes vereinbart ist»), eingeführt nach
 * Art. 712g Abs. 2; dagegen SVIT-Kommentar Rz. 55 ad Art. 712g (dort selbst
 * umstritten) und Rz. 206 ad Art. 712a. Die Website wendet nichts an und lässt
 * den Satz zum Werkzeug weg (`scripts/quorumsbaum-export.mjs`).
 */
export const REGLEMENT_DARF_AENDERN_WEBSITE =
	'Das Gesetz lässt für dieses Mehr eine andere Regel zu. Es verlangt den Mehrheitsbeschluss aller ' +
	'Eigentümer ausser dem Beklagten nur, «wenn nichts anderes vereinbart ist» (ZGB Art. 649b Abs. 2). Eine ' +
	'solche Regel muss schon bei der Gründung des Stockwerkeigentums festgelegt oder später mit Zustimmung ' +
	'aller Eigentümer eingeführt worden sein (ZGB Art. 712g Abs. 2). Ein Reglementsbeschluss mit ' +
	// Ohne «zudem»: Der übernommene Satz zur Zählweise trägt es kurz danach schon.
	'qualifiziertem Mehr genügt dafür nicht. Der SVIT-Kommentar hält die Bestimmung für zwingend, nennt ' +
	'das aber selbst umstritten (Art. 712g Rz. 55). Eine Verschärfung hält er für unzulässig (Art. 712a ' +
	'Rz. 206).';

/** S3, F4a (A6), letzter Satz nur in der Anwendung: was das Werkzeug nicht prüft. */
export const WERKZEUG_PRUEFT_EINFUEHRUNG_NICHT =
	'Wendet dieses Werkzeug eine hinterlegte Bestimmung an, prüft es nicht, wie sie eingeführt wurde.';

/** S3, F4a (A6), Anwendung, ohne und unter angewandter Regel. */
export const REGLEMENT_DARF_AENDERN = `${REGLEMENT_DARF_AENDERN_WEBSITE} ${WERKZEUG_PRUEFT_EINFUEHRUNG_NICHT}`;

/** Der Satz, hinter dem S3 den Übergang anhängt, in beiden Fassungen des Hinweises. */
const BGE_143_SATZENDE = '(BGE 143 III 537 E. 4.2.4).';

/**
 * S3, F4a (A6; Endfassung, Fach R2-3, Laien N1), Übergang direkt nach BGE 143
 * III 537 E. 4.2.4: Ob die Heilung durch Fristablauf auch hier gilt, ist
 * nicht entschieden. Website vor «Steht in Ihrem Reglement …».
 */
export const UEBERGANG_OHNE_ZUSTIMMUNG =
	'Ob das auch für eine Bestimmung zu diesem Mehr gilt, die ohne Zustimmung aller eingeführt wurde, hat kein ' +
	'Gericht entschieden.';

/** Der letzte Satz des Hinweises ohne Regel, hinter dem der sichere Weg steht. */
const BEIDE_MEHRHEITEN = 'Sicher bleibt deshalb nur, beide Mehrheiten zu erreichen.';

/** S3, F4a (A6), sicherer Weg am Ende des Hinweises, beider Fassungen und der Website (ZGB Art. 712g Abs. 2). */
export const EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER =
	'Eine neue Bestimmung zu diesem Mehr führen Sie mit Zustimmung aller Eigentümer ein (ZGB Art. 712g Abs. 2).';

/** Vor diesem Satz in `KLAEGER` steht S4. */
const WER_BETROFFEN_KLAEREN = 'Wer betroffen ist, klären Sie im Zweifel vor der Einladung';

/** S4, F4a (A7): ZGB Art. 649b Abs. 1 («gegenüber allen oder einzelnen Mitberechtigten»). */
export const BETROFFEN_IST =
	'Betroffen ist, wem gegenüber die verletzte Pflicht besteht. Besteht sie gegenüber allen, sind nach dem ' +
	'Gesetz alle betroffen (ZGB Art. 649b Abs. 1).';

/** S4, F4a (A7; Runde 2, Laien S4-1), angehängt: Beiträge sind Pflichten gegenüber der Gemeinschaft. */
export const BETROFFEN_BEITRAEGE = 'Ob bei unbezahlten Beiträgen alle betroffen sind, sagt keine Stelle ausdrücklich.';

/** S4, F4a (A7): der Hinweis der Vorfassung zu den Klagenden mit S4 vor dem Rat zur Anwältin. */
export const KLAEGER = ersetze(
	KLAEGER_VORHER,
	WER_BETROFFEN_KLAEREN,
	`${BETROFFEN_IST} ${BETROFFEN_BEITRAEGE} ${WER_BETROFFEN_KLAEREN}`
);

// ── S5: Einsprache, Vollmachten des Betroffenen (B6) ────────────────────────

const EINSPRACHE_VOLLMACHTEN_VORHER =
	'Wer verkauft, vermietet oder belastet, stimmt nicht mit. Ob er Vollmachten anderer ausüben darf, ist nicht ' +
	'geklärt;';

/**
 * S5, F4a (B6), Anwendung und Website: BGE 134 III 481 E. 3.8 (Regeste), zu
 * Art. 68 ZGB; «sinngemäss», weil die Übertragung auf Art. 712c Abs. 2 Folgerung
 * ist (Runde 3, T1); Handschin/Wyttenbach S. 63.
 */
export const EINSPRACHE_VOLLMACHTEN =
	'Wer verkauft, vermietet oder belastet, stimmt nicht mit, auch nicht mit Vollmachten anderer (sinngemäss ' +
	'BGE 134 III 481 E. 3.8; Handschin/Wyttenbach S. 63).';

/** S5, F4a (B6), Anwendung: der Hinweis der Vorfassung mit S5 an Stelle der offenen Frage. */
export const EINSPRACHE_BETROFFENE_ANWENDUNG = ersetze(
	EINSPRACHE_BETROFFENE_VORHER,
	`${EINSPRACHE_VOLLMACHTEN_VORHER} Votum`,
	`${EINSPRACHE_VOLLMACHTEN} Votum`
);

/** S5, F4a (B6; Runde 2, Laien S5-1), Website: ohne Werkzeugsatz (`UMFORMULIERUNGEN` im Export). */
export const EINSPRACHE_BETROFFENE_WEBSITE =
	`${EINSPRACHE_VOLLMACHTEN} Wer ihm eine Vollmacht gegeben hat, gibt sie für dieses Geschäft besser einer ` +
	'anderen Person; sonst zählt die Stimme hier nicht.';

/** S17, F4a (B6): die Seite zu Art. 712c Abs. 2 in der Begründung der Einsprache, Volltext S. 63. */
const EINSPRACHE_SEITE_VORHER = '(Handschin/Wyttenbach, S. 64)';
export const EINSPRACHE_SEITE = '(Handschin/Wyttenbach, S. 63)';

// ── S6 bis S8: Übertragung an Bewirtschaftung, Ausschuss oder Delegierte ────

/**
 * S6, F4a (H4 a; Endfassung, Fach F-5 und R2-2): Rz. 44 ad Art. 712m stellt die Frage, Rz. 45 beantwortet sie
 * als Meinung der Autoren («u.E.»); ebenso Rz. 87 und 91 ad Art. 712g,
 * Rz. 70 ad Art. 712s.
 */
export const WARUM_EINSTIMMIG =
	'Ob eine Übertragung, die über die gesetzlichen Aufgaben hinausgeht (ZGB Art. 712m Abs. 1 Ziff. 3 und ' +
	'Art. 712s), ein strengeres Mehr braucht, sagt das Gesetz nicht. Der SVIT-Kommentar stellt die Frage selbst ' +
	'(Rz. 44 ad Art. 712m). Er beantwortet sie als Meinung der Autoren: Verringert die Übertragung die ' +
	'Mitwirkungsrechte der Eigentümer, braucht es die Zustimmung aller (Rz. 45 ad Art. 712m). Dasselbe sagen ' +
	'Rz. 87 und 91 ad Art. 712g und Rz. 70 ad Art. 712s. Für diesen Fall nennt er an diesen Stellen kein ' +
	'tieferes Mehr; deshalb rechnet Votum mit Einstimmigkeit.';

/**
 * S7, F4a (H4 c; Endfassung, Fach F-6 und R2-2, Laien N2; zweiter Satz nach
 * Runde 3, T4): ZGB Art. 712m Abs. 1 Ziff. 3 und Art. 712s; SVIT-Kommentar
 * Rz. 44 ad Art. 712m (gesetzliche Zuständigkeiten). Der Verweis zeigt auf die
 * Karte `k-uebertragung-statt-versammlung`.
 */
export const UEBERTRAGUNG_EINFACHES_MEHR =
	'Das einfache Mehr genügt, wenn das Reglement nichts anderes bestimmt und der Ausschuss oder die ' +
	'Delegierten nur Aufgaben übernehmen, die ihnen das Gesetz zuweist. Dazu gehört etwa, die Verwaltung zu ' +
	'beraten, ihre Geschäftsführung zu prüfen oder Beschlüsse der Versammlung auszuführen (ZGB Art. 712m ' +
	'Abs. 1 Ziff. 3 und Art. 712s). Dass dafür das einfache Mehr genügt, sagt der SVIT-Kommentar in Rz. 44 ad Art. 712m. Sollen sie an Stelle der ' +
	'Versammlung entscheiden, gilt die Karte «Ausschuss oder Delegierter entscheidet statt der Versammlung».';

/**
 * S8, F4a (H4 b; Endfassung, Fach F-2, Laien N5; erster Satz nach Runde 3,
 * T4): ZGB Art. 647b Abs. 1 trägt die Rechnung; SVIT-Kommentar Rz. 115 ad
 * Art. 712m als engere Grenze, Rz. 79 ad Art. 712s als Gegenbeispiel aus
 * demselben Werk. «Dieses Mehr» und «Danach rechnet Votum» gelten nur ohne
 * angewandte Regel; unter einer Regel steht der Hinweis deshalb beim Gesetz.
 */
export const DELEGATION_RZ_115 =
	'Die Bestellung einer Verwaltung mit mehr als gewöhnlichen Befugnissen nennt das Gesetz ausdrücklich als ' +
	'Geschäft mit diesem Mehr (ZGB Art. 647b Abs. 1). ' +
	'Danach rechnet Votum. Der SVIT-Kommentar zieht eine engere Grenze. Geschäfte, für die das Gesetz einen ' +
	'bestimmten Mehrheitsbeschluss der Versammlung verlangt, lassen sich danach nicht an die Bewirtschaftung ' +
	'abtreten (Rz. 115 ad Art. 712m). Das gilt auch für die wichtigeren Verwaltungshandlungen. An anderer ' +
	'Stelle nennt er selbst die Vermietung gemeinschaftlicher Teile als übertragbare Aufgabe (Rz. 79 ad ' +
	'Art. 712s). Am sichersten nennt der Beschluss die übertragenen Geschäfte einzeln.';

// ── S14: Eigene Schranke des Reglements, der Meinungsstand ──────────────────

const EIGENE_SCHRANKE_ID = 'k-reglement-eigene-schranke';

const EIGENE_SCHRANKE_LEHRE_VORHER =
	'Steinauer lässt sie zu; BGer 5C.50/2004 E. 4.2 (in BGE 130 III 450 nicht publiziert) lässt die Frage offen.';

/**
 * S14, F4a (Pendenz aus F3; Endfassung, Laien S14-1): BGer 5C.50/2004 E. 4.2 fasst die Lehre zusammen
 * («Der Grundtenor lässt sich dahingehend zusammenfassen …»), entscheidet aber
 * nicht; deshalb der Konjunktiv. Ersetzt nur den Satz zum Meinungsstand; was
 * die Vorfassung danach sagt (`EIGENE_SCHRANKE_STREIT`, Fassung 2026-10-30),
 * bleibt.
 */
export const EIGENE_SCHRANKE_LEHRE =
	'Steinauer lässt sie zu. BGer 5C.50/2004 E. 4.2 (in BGE 130 III 450 nicht publiziert) lässt die Frage ' +
	'offen. Es fasst die Lehre so zusammen: Eine strengere Hürde könne gerade für kleinere Gemeinschaften ' +
	'sinnvoll und grundsätzlich zulässig sein. Einstimmigkeit für die Änderung beliebiger Nebenpunkte vertrage ' +
	'sich dagegen nicht mit dem Gesetz. Ob Ihre Klausel deshalb bei einem Nebenpunkt nicht gilt, hat kein ' +
	'Gericht entschieden.';

// ── Hilfen ───────────────────────────────────────────────────────────────────

/** Ersetzt einen Teilstring, der genau einmal vorkommt; sonst bricht die Fassung ab. */
function ersetze(text: string, alt: string, neu: string): string {
	if (text.split(alt).length !== 2) {
		throw new Error(`Fassung 2026-11-04: «${alt.slice(0, 60)}…» kommt nicht genau einmal vor.`);
	}
	return text.replace(alt, neu);
}

/** Die ganze Vorfassung als Text, für die Probe, dass ein neuer Satz nicht schon dasteht. */
const VORFASSUNG = JSON.stringify(REGELWERK_2026_11_03);
for (const neu of [
	WERTQUOTEN_ALLE,
	ERMAECHTIGUNG_VORHER,
	REGLEMENT_DARF_AENDERN_WEBSITE,
	WERKZEUG_PRUEFT_EINFUEHRUNG_NICHT,
	UEBERGANG_OHNE_ZUSTIMMUNG,
	EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER,
	BETROFFEN_IST,
	BETROFFEN_BEITRAEGE,
	EINSPRACHE_VOLLMACHTEN,
	EINSPRACHE_SEITE,
	WARUM_EINSTIMMIG,
	UEBERTRAGUNG_EINFACHES_MEHR,
	DELEGATION_RZ_115,
	EIGENE_SCHRANKE_LEHRE
]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-04: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

/** Ersetzt einen ganzen Hinweis, der genau einmal an der Karte steht. */
function ersetzeHinweis(k: Ergebnisknoten, alt: string, neu: string): string[] {
	const hinweise = k.hinweise ?? [];
	if (hinweise.filter((h) => h === alt).length !== 1) {
		throw new Error(`Fassung 2026-11-04: «${k.id}» trägt den Hinweis «${alt.slice(0, 60)}…» nicht genau einmal.`);
	}
	return hinweise.map((h) => (h === alt ? neu : h));
}

/** Fügt einen Hinweis hinter einem bestehenden ein, der genau einmal an der Karte steht. */
function fuegeEinNach(hinweise: string[], id: string, nach: string, neu: string): string[] {
	const index = hinweise.indexOf(nach);
	if (index < 0 || hinweise.lastIndexOf(nach) !== index) {
		throw new Error(`Fassung 2026-11-04: «${id}» trägt den Hinweis «${nach.slice(0, 60)}…» nicht genau einmal.`);
	}
	return [...hinweise.slice(0, index + 1), neu, ...hinweise.slice(index + 1)];
}

// ── Die Knoten ───────────────────────────────────────────────────────────────

/** S3: der Hinweis zur hinterlegten Bestimmung, ohne Regel (Schlüssel auch für den Website-Abzug). */
let reglementshinweisNeu: string | undefined;

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_11_03.knoten.map((vorher) => {
	if (vorher.id === 'k-wertquoten-aendern') {
		return { ...vorher, hinweise: ersetzeHinweis(vorher, WERTQUOTEN_ALLE_VORHER, WERTQUOTEN_ALLE) };
	}
	if (vorher.id === 'k-ausschlussklage') {
		// S3: der Hinweis ohne Regel und sein Ersatz unter der Regel, an derselben Stelle.
		const unterRegel = vorher.hinweiseUnterRegel ?? [];
		const mitStreit = unterRegel.filter((u) => u.hinweis.includes(REGLEMENT_DARF_AENDERN_VORHER));
		if (mitStreit.length !== 1 || typeof mitStreit[0].ersatz !== 'string') {
			throw new Error('Fassung 2026-11-04: Der Hinweis zur hinterlegten Bestimmung steht nicht genau einmal unter der Regel.');
		}
		const altHinweis = mitStreit[0].hinweis;
		// Je Fassung drei Stellen: der Satz zum Ändern, der Übergang nach BGE 143
		// III 537 E. 4.2.4 und am Ende der sichere Weg. Ohne Regel endet der
		// Hinweis mit «Sicher bleibt deshalb nur …», unter der Regel mit BGE 143.
		if (!altHinweis.endsWith(BEIDE_MEHRHEITEN) || !mitStreit[0].ersatz.endsWith(BGE_143_SATZENDE)) {
			throw new Error('Fassung 2026-11-04: Der Hinweis zur hinterlegten Bestimmung endet nicht wie erwartet.');
		}
		const neuHinweis = `${ersetze(
			ersetze(altHinweis, REGLEMENT_DARF_AENDERN_VORHER, REGLEMENT_DARF_AENDERN),
			BGE_143_SATZENDE,
			`${BGE_143_SATZENDE} ${UEBERGANG_OHNE_ZUSTIMMUNG}`
		)} ${EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER}`;
		const neuErsatz = `${ersetze(
			ersetze(mitStreit[0].ersatz, REGLEMENT_DARF_AENDERN_VORHER_UNTER_REGEL, REGLEMENT_DARF_AENDERN),
			BGE_143_SATZENDE,
			`${BGE_143_SATZENDE} ${UEBERGANG_OHNE_ZUSTIMMUNG}`
		)} ${EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER}`;
		reglementshinweisNeu = neuHinweis;
		// S4: in `KLAEGER`, vor dem Rat zur Anwältin.
		const hinweise = fuegeEinNach(
			ersetzeHinweis(
				{ ...vorher, hinweise: ersetzeHinweis(vorher, altHinweis, neuHinweis) },
				KLAEGER_VORHER,
				KLAEGER
			),
			vorher.id,
			AUSSCHLUSS_DURCH_GERICHT,
			// S2: direkt nach dem Ausschluss durch das Gericht.
			ERMAECHTIGUNG_VORHER
		);
		return {
			...vorher,
			hinweise,
			hinweiseUnterRegel: unterRegel.map((u) =>
				u === mitStreit[0] ? { ...u, hinweis: neuHinweis, ersatz: neuErsatz } : u
			)
		};
	}
	if (vorher.id === EINSPRACHE_KNOTEN_ID) {
		return {
			...vorher,
			begruendung: ersetze(vorher.begruendung, EINSPRACHE_SEITE_VORHER, EINSPRACHE_SEITE),
			hinweise: ersetzeHinweis(vorher, EINSPRACHE_BETROFFENE_VORHER, EINSPRACHE_BETROFFENE_ANWENDUNG)
		};
	}
	if (vorher.id === BEWIRTSCHAFTUNG_STATT_ID || vorher.id === UEBERTRAGUNG_STATT_ID) {
		return { ...vorher, hinweise: ersetzeHinweis(vorher, WARUM_EINSTIMMIG_VORHER, WARUM_EINSTIMMIG) };
	}
	if (vorher.id === UEBERTRAGUNG_BESCHLUSS_ID) {
		if ((vorher.hinweiseUnterRegel ?? []).length > 0) {
			throw new Error(`Fassung 2026-11-04: «${vorher.id}» trägt schon Hinweise unter der Regel.`);
		}
		// S7 an erster Stelle: Er sagt, wann das Mehr dieser Karte genügt. Unter
		// einer angewandten Regel erklärt er nur das gesetzliche Mehr und steht
		// deshalb im Abschnitt «Zum gesetzlichen Erfordernis».
		return {
			...vorher,
			hinweise: [UEBERTRAGUNG_EINFACHES_MEHR, ...(vorher.hinweise ?? [])],
			hinweiseUnterRegel: [{ hinweis: UEBERTRAGUNG_EINFACHES_MEHR, zumGesetz: true }]
		};
	}
	if (vorher.id === ERWEITERT_ID) {
		// S8 erklärt das gesetzliche Mehr; unter einer angewandten Regel steht er
		// deshalb im Abschnitt «Zum gesetzlichen Erfordernis» (Runde 3, T4).
		// Einträge der Vorfassung bleiben (dort heute keine).
		const unterRegel = vorher.hinweiseUnterRegel ?? [];
		if (unterRegel.some((u) => u.hinweis === DELEGATION_RZ_115)) {
			throw new Error(`Fassung 2026-11-04: «${vorher.id}» ordnet S8 schon unter der Regel ein.`);
		}
		return {
			...vorher,
			hinweise: fuegeEinNach(vorher.hinweise ?? [], vorher.id, DELEGATION_GESPERRT, DELEGATION_RZ_115),
			hinweiseUnterRegel: [...unterRegel, { hinweis: DELEGATION_RZ_115, zumGesetz: true }]
		};
	}
	if (vorher.id === EIGENE_SCHRANKE_ID) {
		const streit = (vorher.hinweise ?? []).filter((h) => h.includes(EIGENE_SCHRANKE_LEHRE_VORHER));
		if (streit.length !== 1) {
			throw new Error(`Fassung 2026-11-04: «${vorher.id}» trägt den Hinweis zum Streit nicht genau einmal.`);
		}
		return {
			...vorher,
			hinweise: ersetzeHinweis(vorher, streit[0], ersetze(streit[0], EIGENE_SCHRANKE_LEHRE_VORHER, EIGENE_SCHRANKE_LEHRE))
		};
	}
	return vorher;
});

if (reglementshinweisNeu === undefined) {
	throw new Error('Fassung 2026-11-04: Die Karte zur Ausschlussklage fehlt.');
}

/** S3, F4a (A6): der ganze Hinweis zur hinterlegten Bestimmung ohne Regel, Schlüssel des Website-Abzugs. */
export const AUSSCHLUSS_REGLEMENTSHINWEIS: string = reglementshinweisNeu;

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_04 = {
	...REGELWERK_2026_11_03,
	fassung: '2026-11-04',

	knoten: KNOTEN,

	freigabevermerk:
		REGELWERK_2026_11_03.freigabevermerk +
		' In der Fassung 2026-11-04 nennen die Karten Fundstellen statt «offen», wo Gesetz, Bundesgericht oder ' +
		'Lehre die Frage entscheiden, und den sicheren Weg, wo die Quellen uneins sind. Am Erfordernis ändert ' +
		'sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
