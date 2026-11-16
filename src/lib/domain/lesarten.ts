/**
 * Lesarten der Gemeinschaft (Entscheid 0018).
 *
 * **Was eine Lesart ist.** Eine Stelle, an der das Gesetz zwei vertretene
 * Auslegungen zulässt und das Ergebnis im Saal davon abhängt. Die Gemeinschaft
 * wählt, nach welcher Votum rechnet; Votum rechnet zusätzlich nach der anderen
 * und nennt das Ergebnis, wenn es abweicht. Nicht dazu gehört, was das
 * Reglement sagt: Das ist eine Tatsache der Gemeinschaft mit Fundstelle und
 * geht einer Lesart vor (Konzept `.auftraege/2026-10-20-votum-lesarten-konzept.md`,
 * Abschnitt 1).
 *
 * **Ein Katalog, ein Wortlaut.** Einstellungsseite, Karte, Leitung und
 * Protokoll lesen die Frage und die Wahlen von hier.
 *
 * **Wo die Wahl wirkt.** Am Erfordernis des Traktandums, beim Herleiten, wie
 * eine hinterlegte Regel (`wendeReglementAn`). So nennt die Einladung dasselbe
 * Mehr, nach dem der Saal rechnet. Die Wahl kommt vor der Freigabe aus der
 * Gemeinschaft, ab der Freigabe aus der Momentaufnahme (Migration 169).
 *
 * **Welcher Knoten welche Lesart trägt, steht im Regelwerk** (`lesart` am
 * Knoten, Daten nach AD-4): Der Knoten rechnet eine Wahl des Katalogs und
 * nennt, was die andere verlangt. Hier steht nur, was über alle Fassungen
 * gleich bleibt.
 *
 * **Welche Wahl ein Knoten rechnet, sagt sein Mehr, nicht die Vorgabe des
 * Katalogs** (Entscheid 0048, Block A; `wahlDesKnotens`). Die Vorgabe gilt für
 * alle Fassungen zugleich, ein Knoten nur für seine. Stellt eine spätere
 * Fassung die Vorgabe um, rechnen die Knoten der früheren weiter, was sie
 * rechneten, und ein Vergleich mit der Vorgabe hätte alte Traktanden in einen
 * Fehler laufen oder still nach der falschen Wahl rechnen lassen. An der
 * Vorgabe bleibt, was Anzeige und Herkunft ist: «(Vorgabe)» an der Wahl, der
 * Satz zur Standardeinstellung, `vorgabe` am Erfordernis und die Wahl neuer
 * Gemeinschaften.
 */
import { istKalendertag } from './datum';
import type { Schwelle } from './mehrheit';
import type { Ergebnisknoten, Ergebnistyp, Kopfbasis, Quotenbasis, Regelwerk } from './regelwerk';
import type { Rolle } from './rollen';

/**
 * Die Kennungen der Lesarten. Block 1 baut L4, Block 2 L1, Block 3 L2, Block 5
 * L3, Block 7 L5, F4c L6, L7 und L8, E1 L11, L12, L9 und L10, Entscheid 0048
 * (Block C) L13.
 */
export type LesartKennung =
	| 'L1'
	| 'L2'
	| 'L3'
	| 'L4'
	| 'L5'
	| 'L6'
	| 'L7'
	| 'L8'
	| 'L9'
	| 'L10'
	| 'L11'
	| 'L12'
	| 'L13';

/** Die Wahl je Lesart, wie sie an `stweg` und `snapshot` steht. */
export interface Lesartenwahl {
	L1: Ausstandswahl;
	L2: 'einfach' | 'qualifiziert';
	L3: Einsprachewahl;
	L4: 'einfach' | 'qualifiziert';
	L5: Neutraktandenwahl;
	L6: Reglementsschrankenwahl;
	L7: Ausstandsbeschlussfaehigkeit;
	L8: Verwaltungsvollmachtwahl;
	L9: 'alle' | 'anwesende';
	L10: Angehoerigenlesart;
	L11: 'qualifiziert' | 'einfach';
	L12: 'alle' | 'anwesende';
	L13: Kopfzaehlweise;
}

/**
 * Die Wahl zu L1: Bleibt die Wertquote im Ausstand beim Mehr aller Wertquoten
 * im Nenner (Vorgabe), oder fällt sie heraus (Migration 170)?
 */
export type Ausstandswahl = 'bleibt' | 'faellt_heraus';

/**
 * Die Wahl zu L3 (Migration 172): Gilt die Zählung je Einheit auch an der
 * Einsprache, oder hat dort nach Gesetz jeder Eigentümer eine Stimme?
 */
export type Einsprachewahl = 'je_eigentuemer' | 'je_einheit';

/**
 * Die Wahl zu L5 (Migration 174): Braucht ein neues Traktandum an der zweiten
 * Versammlung die Beschlussfähigkeit einer ersten (Vorgabe), oder genügt das
 * Drittel nach Art. 712p Abs. 3 (Entscheid 0012, jetzt die Wahl)?
 */
export type Neutraktandenwahl = 'erste' | 'drittel';

/**
 * Die Wahl zu L6 (Migration 180): Wendet Votum die Klausel des Reglements an,
 * die seine eigene Änderung an die Zustimmung aller bindet (Vorgabe), oder
 * rechnet es nach dem qualifizierten Mehr nach Art. 712g Abs. 3 ZGB?
 */
export type Reglementsschrankenwahl = 'klausel' | 'gesetz';

/**
 * Die Wahl zu L7 (Migration 183): Zählt für die Beschlussfähigkeit weiter mit,
 * wer bei einem Traktandum im Ausstand ist (Vorgabe, wie bisher; Entscheid
 * 0014), oder prüft Votum die Beschlussfähigkeit ohne diese Personen?
 */
export type Ausstandsbeschlussfaehigkeit = 'zaehlt' | 'zaehlt_nicht';

/**
 * Die Wahl zu L8 (Migration 184): Ruhen die Vollmachten der Verwaltung an
 * ihren eigenen Geschäften von selbst (Vorgabe), oder erst, wenn die
 * Sitzungsleitung ihren Ausstand erklärt?
 */
export type Verwaltungsvollmachtwahl = 'ruhen' | 'leitung';

/**
 * Die Wahl zu L10 (Migration 189): Bleiben Angehörige des Beklagten im Ausstand
 * an der Ermächtigung zur Ausschlussklage in der Zahl aller Eigentümer
 * (Vorgabe, Wortlaut von Art. 649b Abs. 2), oder fallen sie heraus
 * (Handschin/Wyttenbach 2011, S. 63)?
 */
export type Angehoerigenlesart = 'bleiben' | 'fallen_heraus';

/**
 * Die Wahl zu L13 (Migration 192, Entscheid 0048, Antworten 4 bis 6): Zählen
 * bei der «Mehrheit aller Miteigentümer» nur die Köpfe der Anwesenden und
 * Vertretenen (Vorgabe, herrschende Lehre) oder die aller Eigentümer (Wortlaut)?
 */
export type Kopfzaehlweise = 'anwesende' | 'alle';

export interface Lesartwahlmoeglichkeit {
	wert: string;
	/** Kurz, für Knopf und Verlauf. */
	bezeichnung: string;
	/** Im Satz, kleingeschrieben mit Artikel, etwa «das qualifizierte Mehr». */
	imSatz: string;
	/** Dasselbe im Dativ, etwa «dem qualifizierten Mehr». */
	imSatzDativ: string;
	/** Worauf sich diese Wahl stützt. */
	fundstelle: string;
	/** Was die Wahl im Saal bewirkt, mit Beispiel (Laienprüfung Block 2, H1). */
	wirkung?: string;
	/**
	 * Das Mehr, das diese Wahl verlangt, bei den Lesarten am Knoten (L2, L4, L6,
	 * L9, L11, L12). Daran erkennt `wahlDesKnotens`, welche Wahl ein Knoten
	 * rechnet, und prüft `pruefeLesartenImRegelwerk`, dass `andere` die andere
	 * Wahl rechnet und an der aktuellen Fassung der Knoten die Vorgabe (Pendenz
	 * aus Block 1, Review DeepSeek: eine Fassung mit vertauschter Vorgabe blieb
	 * grün). Je Lesart verlangen die Wahlen deshalb verschiedene Mehr. Am Katalog
	 * und nicht am Knoten, weil L2 und L4 dieselben Wahlen haben, aber
	 * verschiedene Rechtsgrundlagen; die Rechtsgrundlage bleibt am Knoten.
	 */
	mehr?: Wahlmehr;
}

/** Was eine Wahl am Knoten rechnet, ohne Rechtsgrundlage und Schwellen. */
export interface Wahlmehr {
	typ: Ergebnistyp;
	kopfbasis: Kopfbasis;
	quotenbasis: Quotenbasis;
}

const EINFACHES_MEHR: Wahlmehr = { typ: 'einfaches_mehr', kopfbasis: 'anwesend_vertreten', quotenbasis: 'keine' };
const QUALIFIZIERTES_MEHR: Wahlmehr = {
	typ: 'qualifiziertes_mehr',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten'
};
const EINSTIMMIGKEIT_ALLER: Wahlmehr = { typ: 'einstimmigkeit', kopfbasis: 'alle_eigentuemer', quotenbasis: 'keine' };
/**
 * Die Einstimmigkeit der Anwesenden und Vertretenen (L12, Migration 187): Wer
 * weder da noch vertreten ist, zählt nicht mit. Das Gesetz kennt sie nicht als
 * eigenes Mehr; sie ist die milde Lesart von Art. 647e Abs. 1.
 */
const EINSTIMMIGKEIT_ANWESENDE: Wahlmehr = {
	typ: 'einstimmigkeit',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine'
};
/**
 * Das einfache Mehr aller Eigentümer ausser dem Beklagten (L9, Migration 188):
 * Wer weder da noch vertreten ist, zählt mit und wirkt wie ein Nein. Das Gesetz
 * nennt diese Bezugsgrösse im Wortlaut (ZGB Art. 649b Abs. 2).
 */
const MEHR_ALLE_AUSSER_BETROFFENE: Wahlmehr = {
	typ: 'einfaches_mehr',
	kopfbasis: 'alle_ausser_betroffene',
	quotenbasis: 'keine'
};

export interface Lesart {
	kennung: LesartKennung;
	/** Die Frage in Alltagssprache, wie sie auf der Einstellungsseite steht. */
	frage: string;
	/** Worum es geht, als Nebensatz mit «ob» für das Protokoll: «Ob …, ist umstritten». */
	gegenstand: string;
	/**
	 * Was nach einer Ablehnung zusätzlich gilt, wo das Gesetz einen eigenen Weg
	 * kennt (bei L4 die Bestellungsklage). Steht im Satz an die Leitung.
	 */
	nachAblehnung?: string;
	/**
	 * Was nach einer Annahme zusätzlich zu raten ist, die nach der anderen Lesart
	 * scheiterte (Fachprüfung Block 2, Runde 2, A). Steht im Satz an die Leitung.
	 */
	nachAnnahme?: string;
	/**
	 * Was nach einer Ablehnung statt «an einer nächsten Versammlung wieder
	 * traktandieren» steht, wo das nicht trägt: bei L3 die Frist von 14 Tagen
	 * (Fachprüfung Block 5, F5-2).
	 */
	stattNaechsterVersammlung?: string;
	/**
	 * Der ganze Rat nach einer Ablehnung, statt des allgemeinen Rats zur
	 * Anfechtung (L6, Fach- und Laienprüfung 05.11.2026, F1): Wo der Satz «Das
	 * Gericht hebt sie dann in der Regel nur auf» nicht trägt, weil offen ist,
	 * ob das Urteil die Änderung in Kraft setzt (Rz. 235a ad Art. 712m), stünde
	 * ein Anhang daneben im Widerspruch.
	 */
	ratNachAblehnung?: string;
	/**
	 * Derselbe Rat im Durchgang nach einem Rückkommen auf einen angenommenen
	 * Beschluss (B2b; Fachprüfung B2b-F-5): Dort hebt die Ablehnung den früheren
	 * Beschluss auf, und hebt das Gericht sie auf, gilt er nach dem Wortlaut des
	 * Rückkommens wieder. Die blosse Aufhebung genügt.
	 */
	ratNachAblehnungNachRueckkommen?: string;
	wahlen: Lesartwahlmoeglichkeit[];
	vorgabe: string;
	/** Ein Satz, warum die Vorgabe so gewählt ist. */
	warumVorgabe: string;
	/**
	 * Derselbe Grund, gekürzt (A5, Punkt 1b): wo ein Satz die Vorgabe beim
	 * Namen nennt, hat er keinen Platz für den ganzen Satz, und die Software
	 * ist kein Grund, sie zu nennen. Inhalt wie `warumVorgabe`, nur kürzer.
	 */
	vorgabeGrund: string;
	/**
	 * Wo die Lesart nicht gilt, wo man es erwarten könnte (bei L1 die Köpfe).
	 * Steht auf der Einstellungsseite unter der Begründung.
	 */
	geltung?: string;
	/**
	 * Die mögliche Folge der Wahl, die nicht die Vorgabe ist, wo Entscheid 0044
	 * eine nennt (zweiter Nachtrag, «Bei der milden Wahl»; bei L4 Entscheid
	 * 0048, Block B). Steht auf der Seite «Lesarten» unter dieser Wahl und auf
	 * der Karte vor der Abstimmung, wenn sie eingestellt ist.
	 */
	folgeMilderWahl?: string;
	/**
	 * Der ganze Rat nach einer Annahme, die nach der anderen Lesart scheiterte,
	 * statt des allgemeinen samt `nachAnnahme` (E1, L11; Fachprüfung E1 L11, F-2
	 * und F-7): wo der allgemeine Satz «Folgt das Gericht der anderen Lesart,
	 * hebt es ihn auf» zu fest ist oder ein Rat zum Zeitpunkt fehlt. Bei einer
	 * Lesart mit strenger Vorgabe kommt dieser Fall nur unter der milden Wahl
	 * vor, denn die strenge verlangt in jedem Punkt mehr.
	 */
	ratNachAnnahme?: string;
	/**
	 * Ein Satz für das Protokoll am Ausgang, nach einer Annahme, die nach der
	 * anderen Lesart scheiterte (E1, L12; Laienprüfung E1 L12, L-1): Wer
	 * abwesend war, liest nur das Protokoll, und ab ihm läuft seine Frist.
	 */
	protokollNachAnnahme?: string;
	/**
	 * Ein Satz für das Protokoll am Ausgang, nach einer Ablehnung, die nach der
	 * anderen Lesart angenommen wäre (Fachprüfung E1 L10, F-4): Wer nur das
	 * Protokoll liest, hält «wäre angenommen gewesen» sonst für eine Ermächtigung.
	 */
	protokollNachAblehnung?: string;
	/**
	 * Unter welcher Wahl `folgeMilderWahl` auf der Seite «Lesarten» steht, wo es
	 * nicht die Wahl ist, die nicht die Vorgabe ist (L13: Die milde Wahl ist dort
	 * die Vorgabe; Endfassung Block C, Abschnitt 1, «Folge der Vorgabe»). Fehlt
	 * das Feld, steht sie unter jeder Wahl ausser der Vorgabe.
	 */
	folgeUnter?: string;
	/**
	 * Der ganze Rat nach einer Ablehnung, die nach der anderen Wahl angenommen
	 * wäre, nur an den notwendigen baulichen Massnahmen (L13; Endfassung Block C,
	 * Abschnitt 1): Dort steht der Weg ans Gericht nach ZGB Art. 647 Abs. 2
	 * Ziff. 1 offen. Ersetzt den allgemeinen Rat samt `nachAblehnung`.
	 */
	ratNachAblehnungBeiNotwendigenArbeiten?: string;
	/** Der Zusatz zu `protokollNachAblehnung`, nur an den notwendigen baulichen Massnahmen (L13). */
	protokollNachAblehnungBeiNotwendigenArbeiten?: string;
	/**
	 * Der Grund der Verkündung an die Leitung nach einer Ablehnung, die nach der
	 * anderen Wahl angenommen wäre, hinter «Verkündet wird nach der Einstellung
	 * Ihrer Gemeinschaft die Ablehnung:» (`ZAEHLBASIS_VERKUENDET`) und vor dem Rat
	 * (L10; Laienprüfung E1 L10, L-1; Auftrag «Texte nach 0047», Punkt 3b). Wie
	 * bei L9 über 1a.
	 */
	verkuendetNachAblehnung?: string;
}

/**
 * S15, F4a (L5, C1; Endfassung, Laien N6): der Kern zur Wahl «Ein Drittel
 * genügt» (Entscheid 0039; Fachprüfung F3b, H-3). Rz. 33 ad Art. 712p nimmt
 * Nichtigkeit an, wenn die Versammlung willentlich trotz schwerer Verletzung
 * der Beschlussfähigkeit beschliesst («nur 15% der Wertquoten waren
 * vertreten»); Rz. 50: an der zweiten Versammlung zählen die Wertquoten nicht;
 * Handschin/Wyttenbach S. 78: schon die Verletzung einer Anwesenheitsvorschrift
 * des Reglements. Rz. 33a mit BGE 143 III 537 E. 4.2.4 (Fachprüfung Runde 2,
 * F-9): nicht zwingend nichtig. Ob die gewählte Lesart «bewusst» ist, sagt
 * keine Stelle.
 */
export const L5_DRITTEL_KERN =
	'Ob das genügt, ist nicht geklärt. Genügt es nicht, kann ein solcher Beschluss angefochten werden. Er kann ' +
	'sogar nichtig sein, also ungültig auch ohne Anfechtung und auch nach Ablauf der Frist dafür. Wann das so ' +
	'ist, beurteilt die Lehre verschieden. Der SVIT-Kommentar nimmt Nichtigkeit an, wenn eine Versammlung ' +
	'bewusst trotz einer schweren Verletzung der Beschlussfähigkeit beschliesst (Rz. 33 ad Art. 712p). Sein ' +
	'Beispiel: nur 15 % der Wertquoten vertreten. Das ist ein Beispiel, keine Grenze, und an der zweiten ' +
	'Versammlung zählen die Wertquoten nicht mit (Rz. 50). Handschin/Wyttenbach zählen schon die Verletzung ' +
	'einer Anwesenheitsvorschrift des Reglements zu den nichtigen Beschlüssen (S. 78). Ob das für eine ' +
	'Versammlung gilt, die nach der Wahl «Ein Drittel genügt» beschliesst, hat kein Gericht entschieden.';

/** S15, F4a (L5; Endfassung), Ort 2: der Einschub zur Nichtigkeit in `warumVorgabe`. */
export const L5_NICHTIG_UNTER_UMSTAENDEN = 'unter Umständen sogar nichtig sein (Rz. 33 ad Art. 712p)';

export const LESARTEN: readonly Lesart[] = [
	{
		/*
		 * **L1 rechnet an der Zählung, nicht am Mehr** (Migration 170): Kein Knoten
		 * trägt sie; sie betrifft jedes Erfordernis mit dem Mehr aller Wertquoten,
		 * sobald jemand im Ausstand ist (`zaehleAus`). Die strenge Seite ist eine
		 * Grundregel samt unserer Folgerung, keine Stelle zum Ausstand (Fachprüfung
		 * Ä-27, 18.10.2026; Konzept Lesarten, Abschnitt 2).
		 */
		kennung: 'L1',
		// Laien- und Fachprüfung Block 2, 21.10.2026: Wirkung je Wahl (Laien H1),
		// «folgert Votum» und «nicht ausdrücklich» (Fach 2, Laien N1), Begründung
		// ohne «wer greift an» und mit dem Preis (Fach 3, Laien M1, M2), Geltung
		// mit dem Normalfall (Fach 5, Laien N2). Die vertretene Partei gehört nicht
		// dazu (Fach 1, Entscheid 0020).
		frage:
			'Zählt die Wertquote einer Partei im Ausstand weiter mit, wenn das Mehr an allen ' +
			'Wertquoten gemessen wird?',
		gegenstand:
			'ob die Wertquote einer Partei im Ausstand beim Mehr aller Wertquoten mitzählt',
		wahlen: [
			{
				wert: 'bleibt',
				bezeichnung: 'Wertquote zählt mit',
				imSatz: 'die Rechnung mit der Wertquote im Ausstand',
				imSatzDativ: 'der Rechnung mit der Wertquote im Ausstand',
				wirkung:
					'Die Wertquote im Ausstand bleibt in der Zahl aller Wertquoten und wirkt wie ein Nein. ' +
					'Bei vier Parteien zu 250, eine davon im Ausstand, sind 501 von 1000 nötig.',
				fundstelle:
					'Grundregel: Das Mehr nach Wertquoten misst am ganzen Stockwerkeigentum (SVIT-Kommentar ' +
					'Rz. 191 ad Art. 712m). Zum Ausstand sagt die Stelle nichts; dass sie auch dann gilt, ' +
					'folgert Votum.'
			},
			{
				wert: 'faellt_heraus',
				bezeichnung: 'Wertquote fällt heraus',
				imSatz: 'die Rechnung ohne die Wertquote im Ausstand',
				imSatzDativ: 'der Rechnung ohne die Wertquote im Ausstand',
				wirkung:
					'Die Zahl aller Wertquoten wird um sie kleiner, und die nötige Zahl sinkt: im selben ' +
					'Beispiel 376 von 750.',
				fundstelle:
					'Das Stimmrecht dessen, der im Ausstand ist, ruht und wird nicht in die Berechnung des ' +
					// S. 63 am PDF (Fachprüfung L7, F-1, 06.11.2026); siehe L1_STELLE_ZUM_AUSSTAND.
					'Quorums einbezogen (Handschin/Wyttenbach 2011, S. 63, mit Wermelinger, Zürcher ' +
					'Kommentar, Art. 712m N 154). Ob damit der Nenner aller Wertquoten sinkt, sagt die ' +
					'Stelle nicht ausdrücklich.'
			}
		],
		vorgabe: 'bleibt',
		// A5, Punkt 1b: gekürzter Grund aus `warumVorgabe`.
		vorgabeGrund: 'Im Zweifel wird streng gerechnet, weil sich eine falsche Ablehnung leichter korrigieren lässt als eine falsche Annahme.',
		warumVorgabe:
			'Votum rechnet im Zweifel streng: Ein angenommener Beschluss ist angreifbar und, schon ' +
			// Laienprüfung Runde 2, N1: warum das ein Argument ist.
			// Fachprüfung Runde 3, Befund 3: der richtige Grund.
			'ausgeführt, schwer rückgängig zu machen. Eine falsche Ablehnung richtet weniger an: Es wird ' +
			'nichts ausgeführt, und der Antrag kann neu gestellt werden. Der Preis: Die Wertquote im Ausstand wirkt wie ein Nein, und ein Antrag kann ' +
			'scheitern, der nach der anderen Lesart angenommen wäre. Erreicht ein Antrag das Mehr auch ' +
			'mit der Wertquote im Ausstand in der Rechnung, ist er nach beiden Lesarten angenommen.',
		// E1, Block D (W14): Die Zahl der Angehörigen im Ausstand ist seit
		// Migration 189 eine eigene Frage (L10) und nicht mehr festgelegt.
		geltung:
			'Die Einstellung gilt nur für das Mehr aller Wertquoten. Bei den Köpfen zählt Votum, wer im ' +
			'Ausstand ist, nicht mit, auch bei der Einstimmigkeit. ' +
			// Endfassung Block C, Abschnitt 7: die Ausnahme unter L13 «Alle Eigentümer» (Antwort 9).
			'Bei der «Mehrheit aller Miteigentümer» gilt das nicht, wenn Votum die Köpfe dort an allen ' +
			'Eigentümern zählt (Frage zur Zählweise der Köpfe auf dieser Seite): Dann bleibt, wer im Ausstand ' +
			'ist, in der Zahl aller Eigentümer und wirkt wie ein Nein. ' +
			'Anders auch bei der Ermächtigung zur Ausschlussklage: Ob Angehörige des Beklagten im Ausstand ' +
			'dort in der Zahl bleiben, stellt eine eigene Frage auf dieser Seite ein, solange Votum dort keine Bestimmung Ihres Reglements anwendet. Wer nur über eine ' +
			'Person im Ausstand vertreten ist, zählt nach beiden Wahlen wie ein Abwesender.',
		// Fachprüfung Block 2, Befund 6: Der Ausstand bleibt meist bestehen.
		// Der Hinweis auf eine Umstellung der Lesart (Laienprüfung Runde 2, N2) ist
		// wieder gestrichen: Nach einer Ablehnung gelesen, war er ein Rat, die
		// Rechnung statt der Zustimmung zu ändern (Fachprüfung Runde 3, Befund 2).
		nachAblehnung:
			'Steht derselbe Ausstand wieder an, reicht es nach dieser Rechnung nur, wenn mehr Wertquoten ' +
			'zustimmen.',
		// Fristbeginn für Abwesende erst mit dem Protokoll, Anfechtung schon mit dem
		// Schlichtungsgesuch (Rz. 230 ad Art. 712m; Fachprüfung Runde 2, A).
		nachAnnahme:
			'Wer sicher gehen will, stellt das Protokoll rasch und nachweisbar allen zu. Ausgeführt wird ' +
			// Laienprüfung Runde 3, N1: von wem und bei wem.
			'der Beschluss dann erst einige Wochen nach Ablauf der Fristen, wenn bei der Bewirtschaftung ' +
			'keine Vorladung und keine Klage zu einer Anfechtung eingegangen ist.'
	},
	{
		/*
		 * **L2 rechnet am Mehr wie L4** (Migration 171, Fassung 2026-10-26): Der
		 * Knoten `k-zustaendigkeit-gewoehnlich` trägt sie. Keine der beiden Wahlen
		 * ist der Wortlaut «Mehrheit aller Miteigentümer» (Konzept Lesarten,
		 * Abschnitt 2; Entscheid 0018, F6); die Zählung an allen Eigentümern
		 * vertreten Simonius/Sutter und Michaud (genannt in BGE 144 III 510
		 * E. 2.2.4), nicht der SVIT-Kommentar (Rz. 166b ad Art. 712m); die
		 * Zählweise wählt ab Block C eine eigene Lesart (Entscheid 0048).
		 */
		kennung: 'L2',
		frage:
			'Welches Mehr braucht ein Beschluss, der die Zuständigkeit für gewöhnliche ' +
			'Verwaltungshandlungen anders regelt, ohne das Reglement zu ändern?',
		gegenstand:
			'ob ein Beschluss, der die Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regelt, ' +
			'das qualifizierte Mehr braucht',
		wahlen: [
			{
				wert: 'einfach',
				bezeichnung: 'Einfaches Mehr',
				mehr: EINFACHES_MEHR,
				imSatz: 'das einfache Mehr',
				imSatzDativ: 'dem einfachen Mehr',
				// Laienprüfung Block 3, M1: was die Wahl bewirkt, vor den Fundstellen.
				// Endfassung Block C, Abschnitt 7: wie die Köpfe zählen, stellt L13 ein.
				wirkung:
					'Gezählt werden nur die Köpfe, so wie es die Frage zur Zählweise der Köpfe auf dieser Seite ' +
					'einstellt (Vorgabe: Anwesende und Vertretene); die Wertquoten zählen nicht. ' +
					'Wer viele Wertquoten hat, hat eine Stimme wie jede andere Partei.',
				// Fachprüfung Block 3, Befund 1: Handschin/Wyttenbach nennen Art. 647a Abs. 2 ausdrücklich.
				fundstelle:
					'SVIT-Kommentar Rz. 34 ad Art. 712g; Rz. 166 und 166b ad Art. 712m; Handschin/Wyttenbach ' +
					'2011, S. 68'
			},
			{
				wert: 'qualifiziert',
				bezeichnung: 'Qualifiziertes Mehr',
				mehr: QUALIFIZIERTES_MEHR,
				imSatz: 'das qualifizierte Mehr',
				imSatzDativ: 'dem qualifizierten Mehr',
				wirkung:
					'Zusätzlich braucht es mehr als die Hälfte aller Wertquoten. Auch die Wertquoten der ' +
					'Abwesenden zählen dabei mit und wirken wie ein Nein.',
				// Die Köpfe unter den Anwesenden und Vertretenen, wie bei L4 (Fachprüfung
				// Block 1, 20.10.2026, Befund 2).
				// Endfassung Block C, Abschnitt 7: BGE 144 III 510 entscheidet nur zu Art. 647d.
				fundstelle:
					'SVIT-Kommentar Rz. 109 ad Art. 712a: qualifiziertes Mehr nach Köpfen und Wertquoten; wie die ' +
					'Köpfe zählen, stellt die Frage zur Zählweise der Köpfe ein'
			}
		],
		vorgabe: 'einfach',
		// A5, Punkt 1b: gekürzter Grund aus `warumVorgabe`; Fachprüfung A5: mit der
		// Gegenstelle Rz. 109 ad Art. 712a (Rz. 166 ad Art. 712m; Rz. 34 ad Art. 712g).
		vorgabeGrund: 'Der SVIT-Kommentar führt diesen Beschluss überwiegend beim einfachen Mehr auf; an einer Stelle verlangt er das qualifizierte.',
		// Fachprüfung Block 3, Befunde 1 und 3: Rz. 109 nennt ausdrücklich den
		// Beschluss der Versammlung; dass sie vor allem das Reglement meine, ist
		// unsere Auslegung und gehört nicht dem Kommentar in den Mund. Für die
		// Vorgabe tragen die Belege: Rz. 166 führt den Beschluss beim einfachen
		// Mehr, Rz. 168 nicht beim qualifizierten.
		warumVorgabe:
			'Der Wortlaut von Art. 647a Abs. 2 ZGB verlangt die Mehrheit aller Miteigentümer. Diese Zählung ' +
			'wendet der SVIT-Kommentar beim Stockwerkeigentum nicht an (Rz. 166b ad Art. 712m). Er führt den ' +
			'Beschluss bei denen mit einfachem Mehr auf, nicht bei denen mit qualifiziertem (Rz. 166 und 168 ' +
			'ad Art. 712m; ebenso Rz. 34 ad Art. 712g, Handschin/Wyttenbach, S. 68, und in einer allgemeinen ' +
			'Aufzählung das Bundesgericht, BGE 131 III 459 E. 5.2). An einer anderen Stelle verlangt er für denselben Beschluss das qualifizierte Mehr nach ' +
			// Endfassung Block C, Abschnitt 7: «beiden Wahlen zum Mehr» und die Zählweise der Köpfe.
			'Köpfen und Wertquoten (Rz. 109 ad Art. 712a). Ein Beschluss, der das qualifizierte Mehr ' +
			'erreicht, besteht nach beiden Wahlen zum Mehr. Ob Votum die Köpfe dabei an allen Eigentümern ' +
			'zählt, stellt die Frage zur Zählweise der Köpfe auf dieser Seite ein.',
		// Kein `nachAblehnung` wie bei L4 (Codeprüfung Block 3, N3): Dort nennt es
		// die Bestellungsklage nach Art. 712q, einen eigenen Weg des Gesetzes. Für
		// L2 gibt es keinen; es gilt der allgemeine Rat, neu zu traktandieren.
		// Laienprüfung Block 3, M2, M3 und N4; Fachprüfung, Befund 5: ein Beispiel,
		// Beschluss statt Reglement, und welches Mehr im Reglement gilt. Runde 2:
		// was das Beispiel bei einer Bewirtschaftung ändert (Rz. 200 ad Art. 712m),
		// der Vorbehalt der dringlichen Massnahmen (Art. 647 Abs. 2 Ziff. 2; Fach 2,
		// Laien L3-5) und dass der Beschluss spätere Eigentümer bindet (L3-1).
		// Runde 3: nicht «auch dann nicht mehr, wenn sie untätig bleibt»; das trägt
		// kein Volltext, Rz. 110 ad Art. 712a geht in die Gegenrichtung. Was bleibt,
		// ist der Anspruch nach Art. 647 Abs. 2 Ziff. 1 (Rz. 101 ad Art. 712a), und
		// die dringliche Massnahme ist der Bewirtschaftung nachgeordnet (Rz. 99;
		// Fachprüfung Runde 3, Befunde 1 und 2; Laien N3-1).
		geltung:
			'Ein Beispiel: Kleinere Reparaturen an gemeinschaftlichen Teilen gibt künftig nur noch die ' +
			'Bewirtschaftung in Auftrag, nicht mehr jeder Eigentümer selbst. Bleibt sie bei einer notwendigen ' +
			// Runde 4: erst die Versammlung, dann das Gericht (Rz. 103 ad Art. 712a).
			'Reparatur untätig, kann jeder Eigentümer verlangen, dass diese ausgeführt wird, zuerst über die ' +
			'Versammlung und nötigenfalls beim Gericht (ZGB Art. 647 Abs. 2 Ziff. 1). Dringliche Massnahmen, etwa bei einem Wasserschaden, darf ' +
			'weiterhin jeder selbst treffen, wenn die Bewirtschaftung nicht rechtzeitig eingreift (ZGB Art. 647 ' +
			'Abs. 2 Ziff. 2). Die Einstellung gilt für einen solchen Beschluss der Versammlung; er bindet auch ' +
			'spätere Eigentümer (ZGB Art. 649a Abs. 1). Soll die Regel stattdessen ins Reglement, ist das eine ' +
			'Änderung des Reglements; dafür gilt das qualifizierte Mehr nach Köpfen und Wertquoten (ZGB ' +
			// Codeprüfung Block 3, am Rand: Jede Regel der Geschäftsart verdrängt die
			// Lesart (`wendeReglementAn`), auch eine allgemeine zur gewöhnlichen Verwaltung.
			'Art. 712g Abs. 3), unabhängig von dieser Einstellung. Sagt Ihr Reglement, welches Mehr für ' +
			'Beschlüsse über die gewöhnliche Verwaltung gilt, geht es der Lesart vor.'
	},
	{
		/*
		 * **L3 rechnet an der Zählung, nicht am Mehr** (Migration 172, Fassung
		 * 2026-10-28): Der Knoten `k-einsprache` behält Kennung und Mehr; gezählt
		 * wird in einer Gemeinschaft je Einheit nach der Wahl, und das Ergebnis
		 * nach der anderen Zählweise steht daneben. Die Vorgabe ist die
		 * gesetzliche Zählung, eine Stimme je Eigentümer (Rz. 181 ad Art. 712m);
		 * die Stelle zur Einsprache verbietet, das Mehr zu erleichtern (Rz. 186 ad
		 * Art. 712c), und die Zählung je Einheit kann es erleichtern.
		 */
		kennung: 'L3',
		// Laien- und Fachprüfung Block 5, Runde 1 (21.10.2026): «je Einheit» als
		// Folgerung (Fach F5-1), Fundstellen der Vorgabe ergänzt (F5-9), Begründung
		// in Alltagssprache (Laien L5-10), Geltung mit offener Frage und Zeitpunkt
		// der Wahl (L5-8, L5-11), nach der Ablehnung ohne «nächste Versammlung» und
		// ohne «ergibt dasselbe» (F5-2, L5-7), nach der Annahme der Zeitpunkt statt
		// «zusammen mit dem wichtigen Grund» (L5-1, F5-3, L5-6).
		frage:
			'Hat bei der Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht jeder ' +
			'Eigentümer eine Stimme, oder jede Einheit, wie sonst in Ihrer Gemeinschaft?',
		gegenstand:
			'ob bei der Einsprache jeder Eigentümer eine Stimme hat oder die Zählung je Einheit aus ' +
			'dem Reglement gilt',
		wahlen: [
			{
				wert: 'je_eigentuemer',
				bezeichnung: 'Eine Stimme je Eigentümer',
				imSatz: 'die Zählung je Eigentümer',
				imSatzDativ: 'der Zählung je Eigentümer',
				wirkung:
					'Wer mehrere Einheiten hat, hat bei der Einsprache eine Stimme wie alle anderen. ' +
					'Stimmen zwei Eigentümer mit je einer Wohnung dafür und einer mit drei Wohnungen dagegen, ' +
					'ist die Einsprache beschlossen: 2 zu 1.',
				fundstelle:
					'Nach Gesetz hat jeder Eigentümer eine Stimme, gleich wie viele Einheiten er hat ' +
					'(SVIT-Kommentar Rz. 181 ad Art. 712m). Das Mehr für die Einsprache lässt sich nur ' +
					'verschärfen, nicht erleichtern (Rz. 186 ad Art. 712c; Rz. 176 ad Art. 712m; Rz. 83 ad ' +
					'Art. 712g).'
			},
			{
				wert: 'je_einheit',
				bezeichnung: 'Eine Stimme je Einheit',
				imSatz: 'die Zählung je Einheit',
				imSatzDativ: 'der Zählung je Einheit',
				wirkung:
					'Die Zählweise Ihres Reglements gilt auch hier. Im selben Beispiel ist die Einsprache ' +
					'abgelehnt: 2 zu 3.',
				fundstelle:
					'Für die Berechnung des Mehrs verweist der Kommentar zur Einsprache auf die allgemeinen ' +
					'Regeln (SVIT-Kommentar Rz. 185 ad Art. 712c). Dort ist die Zählung je Einheit zulässig ' +
					'(Rz. 186 ad Art. 712m). Dass sie auch für die Einsprache gilt, sagt keine der Stellen; ' +
					'das folgert Votum.'
			}
		],
		vorgabe: 'je_eigentuemer',
		// A5, Punkt 1b: gekürzter Grund aus `warumVorgabe`.
		vorgabeGrund: 'So kommt die Einsprache nicht leichter zustande als nach Gesetz.',
		warumVorgabe:
			'Für die Einsprache gilt eine eigene Regel, und sie geht den allgemeinen vor: Das Mehr darf ' +
			'hier nicht leichter zu erreichen sein als nach Gesetz. Das Gesetz gibt jedem Eigentümer eine ' +
			'Stimme, und die Zählung je Einheit kann das Mehr leichter machen. Deshalb ist die Vorgabe ' +
			// Laienprüfung Runde 2, R2-6: worauf sich «strenger» bezieht.
			'das Gesetz. Die Zählung je Eigentümer ist dabei nicht in jedem Fall die strengere: Je nach ' +
			'Abstimmung macht sie die Einsprache leichter oder schwerer als die Zählung je Einheit. Weil ' +
			'nach der Abstimmung keine Zeit bleibt, etwas zu wiederholen, ' +
			// Entscheid des Auftraggebers 21.10.2026 (Codeprüfung Block 5, H1): nach dem
			// Schliessen, vor dem Verkünden; einen Zwischenstand zeigt Votum nie.
			'zeigt Votum beide Ergebnisse gleich nach dem Schliessen der Abstimmung, bevor Sie das ' +
			'Ergebnis verkünden.',
		geltung:
			'Die Einstellung wirkt nur bei der Einsprache und nur, wenn Ihre Gemeinschaft nach dem ' +
			'Reglement je Einheit zählt. Zählt sie je Eigentümer, ergeben beide Wahlen dasselbe. Wer ' +
			'verkauft, vermietet oder belastet, stimmt nach beiden Wahlen nicht mit. Geklärt ist die ' +
			'Frage nicht: Geben die beiden Zählungen ein anderes Ergebnis, kann der Beschluss nach jeder ' +
			// Fachprüfung Runde 2, R2-4: das ungleiche Risiko.
			'Wahl angegriffen werden. Die Folgen sind ungleich: Hält ein Gericht eine beschlossene ' +
			'Einsprache für falsch gezählt, hebt es sie auf. Hält es eine Ablehnung für falsch gezählt, ' +
			'hebt es nur die Ablehnung auf; eine Einsprache entsteht dadurch nicht, und die 14 Tage für ' +
			// Laienprüfung Runde 3, R3-1: der Unterschied ausgeschrieben, und dass die
			// Wahl nicht nach dem gewünschten Ergebnis fällt.
			'die Zustellung sind dann vorbei. Wählen Sie vor der Einladung, unabhängig davon, wie eine ' +
			'bestimmte Abstimmung ausgehen soll; Votum hält die Wahl mit der Einladung für diese ' +
			'Versammlung fest.',
		stattNaechsterVersammlung:
			// Fachprüfung Runde 2, R2-2: Startpunkt der Frist, «in aller Regel».
			'Eine neue Abstimmung an einer nächsten Versammlung käme bei der Einsprache in aller Regel zu ' +
			'spät: Beschluss und Zustellung müssen innert 14 Tagen seit der ersten Mitteilung des Vertrags liegen, ' +
			'und ein Urteil über die Ablehnung käme erst danach.',
		// Entscheid 0030, Fachprüfung A5: Keine Stelle im Bestand trägt eine zweite
		// Abstimmung (`quellen` Frage 59), Rz. 190 ad Art. 712c die Frist.
		nachAblehnung:
			'Ob diese Versammlung auf die Ablehnung zurückkommen und über die Einsprache nochmals ' +
			'abstimmen darf, ist nicht geklärt: Weder das Gesetz noch der SVIT-Kommentar sagen es. Die ' +
			'Frist wird dadurch nicht länger. Klären Sie das sofort mit einer Anwältin oder einem Anwalt ' +
			'für Stockwerkeigentum. Wird nochmals abgestimmt, gehören beide Abstimmungen ins Protokoll, ' +
			'und der neue Beschluss kann vor Gericht angegriffen werden.',
		nachAnnahme:
			// Fach- und Laienprüfung Runde 2, R2-3: ab der ersten Mitteilung, wie die Karte.
			'Warten Sie mit der Einsprache nicht, bis die Anfechtungsfrist abläuft: Sie muss innert ' +
			'14 Tagen seit der ersten Mitteilung des Vertrags beim Eigentümer sein, der verkauft, ' +
			'vermietet oder belastet, auch wenn die Mitteilung nur an die Verwaltung ging oder von der ' +
			'Gegenpartei kam. Bestimmen Sie jetzt, wer sie überbringt.'
	},
	{
		/*
		 * **L4 wählt das Mehr der Wahl einer Bewirtschaftung, die schon
		 * erweiterte Kompetenzen hat** (Migration 169, Fassung 2026-10-24): Der
		 * Knoten `k-bewirtschaftung-waehlen-erweitert` trägt sie. **Die Vorgabe
		 * ist seit der Fassung 2026-11-13 das qualifizierte Mehr nach dem Gesetz**
		 * (Entscheid 0048, Punkt 1, «Vorgabe nach Gesetz»; Migration 191), bis
		 * dahin war es das einfache nach dem SVIT-Kommentar (Entscheid 0018,
		 * insoweit abgelöst). Gebaut wie L11: die Vorgabe zuerst, das einfache
		 * Mehr als andere Wahl mit `folgeMilderWahl`. Die Knoten der Fassungen
		 * 2026-10-24 bis 2026-11-11 rechnen weiter das einfache Mehr; welche Wahl
		 * ein Knoten rechnet, sagt sein Mehr (`wahlDesKnotens`, Entscheid 0048,
		 * Block A). Auftrag Block B
		 * (`.auftraege/2026-11-13-votum-b-l4-nach-gesetz.md`); die Wortlaute in
		 * der Endfassung nach drei Runden Laien- und Fachprüfung.
		 */
		kennung: 'L4',
		frage:
			'Welches Mehr braucht die Wahl einer Bewirtschaftung, die schon Kompetenzen über die ' +
			'gewöhnliche Verwaltung hinaus hat?',
		gegenstand: 'ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht',
		wahlen: [
			{
				wert: 'qualifiziert',
				bezeichnung: 'Qualifiziertes Mehr',
				mehr: QUALIFIZIERTES_MEHR,
				imSatz: 'das qualifizierte Mehr',
				imSatzDativ: 'dem qualifizierten Mehr',
				wirkung:
					// Endfassung Block C, Abschnitt 7: wie die Köpfe zählen, stellt L13 ein.
					'Mehr als die Hälfte der Eigentümer stimmt zu, gezählt, wie es die Frage zur Zählweise der ' +
					'Köpfe einstellt (Vorgabe: Anwesende und Vertretene), und sie halten zusammen mehr als die ' +
					'Hälfte aller Wertquoten. Die Wertquoten der Abwesenden wirken dabei ' +
					'wie ein Nein. Wird das nicht erreicht, weist Votum die Wahl als abgelehnt aus.',
				// Die Köpfe auch hier unter den Anwesenden und Vertretenen, nicht
				// «aller Miteigentümer» nach dem Wortlaut (Fachprüfung 20.10.2026, Befund 2).
				// BGE 144 III 510 E. 2.2.4 entscheidet das nur zu Art. 647d (Entscheid 0048,
				// Anlass); die Zählung an Art. 647b wählt ab Block C eine eigene Lesart.
				fundstelle: 'Art. 647b Abs. 1 ZGB; wie die Köpfe zählen, stellt die Frage zur Zählweise der Köpfe ein'
			},
			{
				wert: 'einfach',
				bezeichnung: 'Einfaches Mehr',
				mehr: EINFACHES_MEHR,
				imSatz: 'das einfache Mehr',
				imSatzDativ: 'dem einfachen Mehr',
				wirkung:
					'Es genügt, dass mehr als die Hälfte der anwesenden und vertretenen Eigentümer zustimmt. ' +
					'Die Wertquoten zählen nicht.',
				fundstelle: 'SVIT-Kommentar Rz. 46 ad Art. 712q; Rz. 112 ad Art. 712a'
			}
		],
		vorgabe: 'qualifiziert',
		/*
		 * Wortlaute nach der Endfassung der Prüfvorlage (`quellen`
		 * `pruefung/zu-pruefen-2026-11-13-votum-regel43-block-b-endfassung.md`,
		 * Stelle 1; was dort nicht steht, aus den Fassungen 3 und 2), je Feld an
		 * einer Stelle.
		 */
		// A5, Punkt 1b: gekürzter Grund aus `warumVorgabe`.
		vorgabeGrund:
			'Nach dem Wortlaut von Art. 647b Abs. 1 ZGB braucht die Wahl einer Verwaltung mit mehr als ' +
			'gewöhnlichen Befugnissen das qualifizierte Mehr. Der SVIT-Kommentar und ein Teil der Lehre ' +
			'lassen das einfache genügen, weil im Stockwerkeigentum die Regeln zur Verwaltung vorgingen. ' +
			'Ein Entscheid des Bundesgerichts zu dieser Frage ist uns nicht bekannt.',
		// Entscheid 0048, Anlass: Rz. 46 ad Art. 712q stützt das einfache Mehr auf
		// PKG 1991 und Lehre und nennt die Frage selbst umstritten; Rz. 46a sagt
		// «nicht ausdrücklich im Gesetz geregelt».
		warumVorgabe:
			'Art. 647b Abs. 1 ZGB nennt die Bestellung eines Verwalters, dessen Zuständigkeit nicht auf ' +
			'gewöhnliche Verwaltungshandlungen beschränkt ist, ausdrücklich bei den Geschäften mit ' +
			'qualifiziertem Mehr. Der SVIT-Kommentar lässt für die Wahl das einfache Mehr genügen, auch ' +
			'wenn das Reglement die Befugnisse erweitert hat: Im Stockwerkeigentum gingen die Regeln zur ' +
			'Verwaltung vor (Art. 712q ff.; Rz. 112 ad Art. 712a). Er verweist für das einfache Mehr auf ' +
			'ein kantonales Urteil und mehrere Lehrmeinungen und nennt die Frage bei erweiterten ' +
			'Befugnissen selbst umstritten (Rz. 46 ad Art. 712q). Für die Verwalterwahl im Allgemeinen ' +
			'nennt auch das Bundesgericht das einfache Mehr (BGer 5A_48/2022 E. 6.1.2.1); zu erweiterten ' +
			'Befugnissen äussert es sich dort nicht, und ein anderer Entscheid dazu ist uns nicht ' +
			'bekannt. Votum verlangt deshalb nach dem Wortlaut von Art. 647b Abs. 1 das qualifizierte ' +
			'Mehr. Eine Wahl, die es erreicht, erfüllt das Mehr nach beiden Wahlen dieser Einstellung. ' +
			'Verlangt Ihr Reglement mehr, gilt das Reglement.',
		// Neu mit der Vorgabe nach Gesetz, wie bei L9 (Endfassung, Stelle 1).
		geltung:
			'Die Einstellung gilt für die Wahl einer Verwaltung, die nach Reglement oder ' +
			'Verwaltungsvertrag mehr als die gewöhnliche Verwaltung besorgen darf, etwa gemeinschaftliche ' +
			'Teile selbständig vermieten; den Abschluss von Miet- und Pachtverträgen nennt Art. 647b Abs. ' +
			'1 ZGB selbst. Hat die Verwaltung nur die Aufgaben, die das Gesetz jeder Verwaltung gibt ' +
			'(namentlich ZGB Art. 712s und 712t), bleibt es nach dem SVIT-Kommentar beim einfachen Mehr ' +
			'(Rz. 44 ad Art. 712m). Steht in Ihrem Reglement eine Bestimmung zu diesem Mehr und haben Sie ' +
			'sie in Votum eingetragen, rechnet Votum nach ihr.',
		// Neu mit der Vorgabe nach Gesetz (Entscheid 0048, Block B): Unter der Wahl
		// «einfach» steht vor der Abstimmung, dass eine Wahl mit nur dem einfachen
		// Mehr anfechtbar ist, und der Rat zum Vertrag, wie im Hinweis der Karte.
		folgeMilderWahl:
			'Hier gehen der Wortlaut von Art. 647b Abs. 1 ZGB und der SVIT-Kommentar auseinander. Wer das ' +
			'einfache Mehr wählt, folgt dem Kommentar. Wer nicht zugestimmt hat, kann eine Wahl mit nur ' +
			'einfachem Mehr anfechten: beim Gericht, in der Regel zuerst mit einem Gesuch an die ' +
			'Schlichtungsbehörde. Die Frist beträgt einen Monat, für Anwesende und Vertretene ab der ' +
			'Versammlung, für Abwesende in der Regel ab Erhalt des Protokolls. Stellen Sie das Protokoll ' +
			'deshalb rasch und nachweisbar allen zu. Den Verwaltungsvertrag unterzeichnet die ' +
			'Gemeinschaft, wo es nicht eilt, erst, wenn die Frist für alle abgelaufen ist, also ' +
			'frühestens einen Monat, nachdem auch die Abwesenden das Protokoll erhalten haben.',
		// Rz. 235a ad Art. 712m, Rz. 46a, 78 und 85 ad Art. 712q (Fachprüfung, Befund 9).
		// Runde 2: ohne vorherige Anfechtung, mit der empfohlenen Monatsfrist
		// (Rz. 67, 69, 72 ad Art. 712q).
		// Runde 3: «danach … mehr», weil die Klage bei laufendem Mandat
		// ausgeschlossen ist (Rz. 69 f. ad Art. 712q); die Frist ist offen (Rz. 67).
		nachAblehnung:
			'Hat die Gemeinschaft danach keine Bewirtschaftung mehr, kann jeder Eigentümer ohne ' +
			'vorherige Anfechtung das Gericht um die Ernennung ersuchen (ZGB Art. 712q Abs. 1). Eine Frist ' +
			'dafür ist nicht geklärt; der Kommentar rät, sich möglichst an einen Monat seit der ' +
			'Versammlung zu halten. An die vorgeschlagene Bewirtschaftung ist das Gericht nicht gebunden. ' +
			'Läuft das bisherige Mandat noch, setzen Sie die Wahl für eine Versammlung vor seinem Ende ' +
			'neu auf die Traktandenliste.'
	},
	{
		/*
		 * **L5 sperrt, statt anders zu rechnen** (Migration 174, Block 7): Kein
		 * Knoten trägt sie und kein Mehr ändert sich. Nach der Vorgabe öffnet
		 * eine Abstimmung über ein neues Traktandum an der zweiten Versammlung
		 * nur mit der Beschlussfähigkeit einer ersten
		 * (`stelleBeschlussfaehigkeitFestFuer`, `server/abstimmung.ts`). Beide
		 * Seiten sind Folgerungen; keine Stelle spricht vom Quorum für neue
		 * Traktanden (Konzept Lesarten, Abschnitt 2; Entscheide 0012, 0018 F4).
		 */
		kennung: 'L5',
		frage:
			'Darf eine zweite Versammlung über ein Geschäft entscheiden, das an der ersten nicht auf ' +
			'der Liste stand, wenn nur ein Drittel der Eigentümer da oder vertreten ist?',
		gegenstand:
			'ob an einer zweiten Versammlung für ein Geschäft, das an der ersten nicht auf der Liste ' +
			'stand, ein Drittel der Eigentümer genügt',
		wahlen: [
			{
				wert: 'erste',
				bezeichnung: 'Nur wie an einer ersten Versammlung',
				imSatz: 'die Beschlussfähigkeit einer ersten Versammlung',
				imSatzDativ: 'der Beschlussfähigkeit einer ersten Versammlung',
				// Laienprüfung Block 7, L7-2 und L7-9; Fachprüfung F7-7: was «unverbindlich»
				// heisst, und dass ein dringendes Geschäft nicht ein Jahr warten muss.
				wirkung:
					'Über ein neues Geschäft wird nur verbindlich abgestimmt, wenn so viele anwesend oder ' +
					'vertreten sind, wie eine erste Versammlung braucht: nach Gesetz die Hälfte der ' +
					'Eigentümer, mindestens zwei, mit der Hälfte der Wertquoten. Sonst kommt das Geschäft ' +
					'auf die Liste einer späteren Versammlung; ist es dringend, kann die Verwaltung dafür ' +
					// Runde 3, F7-14 und L7-16: nur die Abwehr eines Schadens.
					// Runde 5, F7-15: ohne «nur», mit den unmittelbaren Folgen.
					'eigens eine einberufen. Ohne Beschluss darf sie tun, was sofort nötig ist, um einen ' +
					'Schaden abzuwehren oder seine unmittelbaren Folgen zu beheben, etwa bei einem ' +
					'Wasserleitungsbruch das Wasser abstellen, das Leck flicken und den Keller trocknen ' +
					// Runde 6, L7-23: das Gegenbeispiel wie in der Leitung.
					'lassen (ZGB Art. 712s Abs. 1); die eigentliche Massnahme, etwa den Ersatz der Leitung, ' +
					'beschliesst die Versammlung. ' +
					// Laienprüfung L7-24: nicht am gemeinsamen Abend (`oeffneAmAbend`).
					'Die Versammlung kann vorher unverbindlich ihre Meinung ' +
					'abgeben, ausser am gemeinsamen Abend mehrerer Gemeinschaften; das ist kein Beschluss.',
				// Fachprüfung F7-2: Rz. 2 trägt die zwei Stufen, Rz. 3 nur den Begriff.
				// BGer 5A_865/2011 E. 5.2 trägt die strenge Seite nicht (F7-1).
				fundstelle:
					'Die erleichterte Beschlussfähigkeit gilt für die zweite Versammlung, die einberufen ' +
					'wird, weil die erste nicht beschlussfähig war (ZGB Art. 712p Abs. 2 und 3; ' +
					'SVIT-Kommentar Rz. 2 ad Art. 712p). «Erste» Versammlung ist die, für die eine erste ' +
					'Einberufung erfolgt ist (Rz. 3). Dass die Erleichterung für ein neues Geschäft nicht ' +
					'gilt, sagt keine Stelle; das folgert Votum.'
			},
			{
				wert: 'drittel',
				bezeichnung: 'Ein Drittel genügt',
				imSatz: 'das Drittel der zweiten Versammlung',
				imSatzDativ: 'dem Drittel der zweiten Versammlung',
				// S15, F4a (L5, C1), Ort 1: der Kern nach Entscheid 0039.
				wirkung:
					'Über ein neues Geschäft wird abgestimmt wie über die übrigen: Es genügt ein Drittel ' +
					`der Eigentümer, mindestens zwei. ${L5_DRITTEL_KERN} Votum weist vor der Abstimmung darauf hin.`,
				fundstelle:
					'Der Kommentar lässt neue Traktanden an der zweiten Versammlung zu, wenn sie korrekt ' +
					'mitgeteilt werden, ohne ein anderes Quorum zu nennen (SVIT-Kommentar Rz. 49 ad ' +
					'Art. 712p). Dass dann das Drittel genügt, sagt er nicht; das folgert Votum.'
			}
		],
		vorgabe: 'erste',
		// A5, Punkt 1b: gekürzter Grund aus `warumVorgabe`.
		vorgabeGrund: 'Ein Beschluss mit der tieferen Beschlussfähigkeit der zweiten Versammlung ist angreifbar und oft schon ausgeführt.',
		warumVorgabe:
			'Keine Stelle sagt, welches Quorum für ein neues Geschäft an der zweiten Versammlung gilt. ' +
			'Die Folgen sind ungleich: Ein gesperrtes Geschäft kommt auf die Liste einer späteren ' +
			'Versammlung. Ein ' +
			// S15, F4a (L5), Ort 2: unter Umständen nichtig (Rz. 33 ad Art. 712p).
			`Beschluss mit nur einem Drittel kann angefochten werden, ${L5_NICHTIG_UNTER_UMSTAENDEN}, und ist ` +
			'oft schon ausgeführt, wenn ein Gericht ihn aufhebt. Deshalb ist die strengere Wahl die Vorgabe.',
		geltung:
			'Die Einstellung wirkt nur an einer zweiten Versammlung und nur bei Geschäften, die an der ' +
			// Fachprüfung F7-6: Das Reglement darf Abs. 3 erschweren.
			'ersten nicht auf der Liste standen. Für die übrigen gilt dort die Beschlussfähigkeit der ' +
			// L7 (Migration 183): Ob die Personen im Ausstand mitzählen, sagt jetzt die eigene Einstellung.
			'zweiten Versammlung, nach Gesetz ein Drittel. Ob mitzählt, wer im Ausstand ist, regelt die ' +
			'Einstellung zum Ausstand und zur Beschlussfähigkeit. Die Einladung zur zweiten Versammlung ' +
			'nennt die betroffenen Geschäfte mit einer Fussnote.'
	},
	{
		/*
		 * **L6 wählt zwischen Klausel und Gesetz** (Migration 180, Fassung
		 * 2026-11-05): Der Knoten `k-reglement-eigene-schranke` trägt sie. Die
		 * Vorgabe wendet die Klausel an; eine Änderung, der alle Eigentümer
		 * zustimmen, besteht nach beiden Wahlen (Einteilung F3b, D1; Entscheid
		 * 0018). Wortlaute nach Fach- und Laienprüfung 05.11.2026. Der letzte
		 * Satz der `geltung` nach Entscheid 0042: L6 wirkt nicht an einer
		 * hinterlegten Regel zu `k-reglement-normal`.
		 */
		kennung: 'L6',
		frage:
			'Verlangt Ihr Reglement für seine eigene Änderung die Zustimmung aller: Gilt diese Klausel, ' +
			'oder genügt das qualifizierte Mehr nach dem Gesetz?',
		gegenstand: 'ob eine Klausel gilt, nach der das Reglement nur mit der Zustimmung aller geändert werden kann',
		wahlen: [
			{
				wert: 'klausel',
				bezeichnung: 'Klausel anwenden',
				mehr: EINSTIMMIGKEIT_ALLER,
				imSatz: 'die Zustimmung aller nach Ihrem Reglement',
				imSatzDativ: 'der Zustimmung aller nach Ihrem Reglement',
				wirkung:
					'Die Änderung ist nur angenommen, wenn alle Eigentümer zustimmen, auch die abwesenden. ' +
					'Wer weder da noch vertreten ist, zählt wie ein Nein.',
				fundstelle:
					'Reglement der Gemeinschaft; eine Erschwerung lassen mehrere Autoren zu, aufgezählt in ' +
					'BGer 5C.50/2004 E. 4.2, ebenso Steinauer (zitiert im SVIT-Kommentar Rz. 125 ad Art. 712g)'
			},
			{
				wert: 'gesetz',
				bezeichnung: 'Nach dem Gesetz',
				mehr: QUALIFIZIERTES_MEHR,
				imSatz: 'das qualifizierte Mehr nach dem Gesetz',
				imSatzDativ: 'dem qualifizierten Mehr nach dem Gesetz',
				wirkung:
					'Die Änderung ist angenommen, wenn mehr als die Hälfte der anwesenden und vertretenen ' +
					'Eigentümer zustimmt und diese zusammen mehr als die Hälfte aller Wertquoten halten. Die ' +
					'Klausel im Reglement wendet Votum dann nicht an.',
				fundstelle:
					'ZGB Art. 712g Abs. 3; SVIT-Kommentar Rz. 40, 40a, 125 und 145 ad Art. 712g (Erschwerung ' +
					'unzulässig); Köpfe gezählt unter den Anwesenden und Vertretenen (BGE 144 III 510 E. 2.2.4; ' +
					'Rz. 190 f. ad Art. 712m)'
			}
		],
		vorgabe: 'klausel',
		vorgabeGrund:
			'Ob die Klausel gilt, hat das Bundesgericht offengelassen; eine Änderung, der alle Eigentümer zustimmen, ' +
			'besteht nach beiden Lesarten.',
		warumVorgabe:
			'Der SVIT-Kommentar hält eine solche Klausel für unzulässig; es genüge das qualifizierte Mehr nach ' +
			'Art. 712g Abs. 3 ZGB (Rz. 40 und 125 ad Art. 712g). Andere Autoren lassen eine Erschwerung zu. Das ' +
			'Bundesgericht hat die Frage offengelassen und die Lehre so zusammengefasst: Eine strengere Hürde sei ' +
			'grundsätzlich zulässig, Einstimmigkeit für die Änderung beliebiger Nebenpunkte nicht (BGer 5C.50/2004 ' +
			'E. 4.2). Offenlassen konnte es die Frage, weil der Kläger das Reglement selbst erlassen hatte und ' +
			'sich deshalb nicht auf die Gesetzwidrigkeit der Klausel berufen konnte. Wer der Klausel selbst ' +
			'zugestimmt hat, etwa bei ihrer Einführung, muss damit rechnen, dass ihm das entgegengehalten wird. Eine Änderung, der alle ' +
			'Eigentümer zustimmen, auch die abwesenden, besteht nach beiden Lesarten.',
		// Ersetzt den allgemeinen Rat (F1): Frist einmal, mit Startpunkt.
		ratNachAblehnung:
			'Wer nicht Nein gestimmt hat und die Klausel für ungültig hält, kann die Ablehnung beim Gericht ' +
			'anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer ' +
			'weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. ' +
			'Art. 75). Ob das Gericht dann nur die Ablehnung aufhebt oder die Änderung in Kraft setzt, ist nicht ' +
			'sicher; dass sie gelten soll, muss die Klage ausdrücklich verlangen (SVIT-Kommentar Rz. 234 und ' +
			'235a ad Art. 712m). Hebt das Gericht nur auf, kann die Gemeinschaft neu beschliessen und ist dabei ' +
			'an das Urteil gebunden (Rz. 235 ad Art. 712m). Hält es die Klausel für ungültig, genügt für diesen ' +
			'Antrag dann das qualifizierte Mehr. Dafür stellt die Verwaltung die Lesart vor der Freigabe der ' +
			'Versammlung auf «Nach dem Gesetz». Das wirkt für jede Änderung unter der Klausel; gebunden ist die ' +
			'Gemeinschaft durch das Urteil nur für denselben Gegenstand (BGer 5A_521/2016 E. 3.3.4). ' +
			'Ohne Gericht gilt die Änderung sicher, ' +
			'wenn alle Eigentümer denselben Antrag schriftlich annehmen (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2).',
		ratNachAblehnungNachRueckkommen:
			'Wer nicht Nein gestimmt hat und die Klausel für ungültig hält, kann die Ablehnung beim Gericht ' +
			'anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer ' +
			'weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. ' +
			'Art. 75). Hebt das Gericht die Ablehnung auf, gilt nach dem Wortlaut des Rückkommens wieder der ' +
			'frühere Beschluss, rückwirkend (SVIT-Kommentar Rz. 234 ad Art. 712m). Hält es die Klausel für ' +
			'ungültig, genügt für spätere Änderungen unter der Klausel dann das qualifizierte Mehr. Dafür stellt die Verwaltung die ' +
			'Lesart vor der Freigabe der Versammlung auf «Nach dem Gesetz». Das wirkt für jede Änderung unter ' +
			'der Klausel; gebunden ist die Gemeinschaft durch das Urteil nur für denselben Gegenstand (BGer ' +
			'5A_521/2016 E. 3.3.4). Ohne Gericht gilt die Änderung sicher, wenn alle Eigentümer denselben ' +
			'Antrag schriftlich annehmen (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2).',
		nachAnnahme:
			// Dass das Gericht sie aufheben kann, sagt der allgemeine Rat davor schon.
			'Stellen Sie das Protokoll den Abwesenden rasch und nachweisbar zu und setzen Sie die Änderung erst um, wenn die ' +
			'Fristen abgelaufen sind; wird sie aufgehoben, fällt sie rückwirkend weg (SVIT-Kommentar Rz. 230, 231 ' +
			'und 234 ad Art. 712m). Sicher wird sie, wenn alle ' +
			'Eigentümer denselben Antrag schriftlich annehmen (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2).',
		geltung:
			'Die Einstellung wirkt nur bei einer Reglementsänderung, für die Ihr Reglement selbst die ' +
			'Zustimmung aller verlangt (Karte «Reglement verlangt für seine Änderung selbst Einstimmigkeit»). ' +
			'Verlangt schon das Gesetz für die Änderung die Zustimmung aller, etwa bei Quoren für Verwaltung ' +
			'und bauliche Massnahmen oder bei einem Vorkaufs- oder Einspracherecht, gilt das unabhängig von ' +
			'dieser Einstellung; wählen Sie dann im Entscheidbaum die Antwort zu dieser Bestimmung. Bei der ' +
			'Zuteilung ausschliesslicher Nutzungsrechte verlangt das Gesetz zusätzlich die Zustimmung der ' +
			'direkt Betroffenen. Unter «Nach dem Gesetz» wählen Sie dann die Antwort zu den Nutzungsrechten, ' +
			'unter «Klausel anwenden» die Antwort zur Klausel; ihre Zustimmung aller schliesst die Betroffenen ' +
			'ein (ZGB Art. 712g Abs. 2 und 4; SVIT-Kommentar Rz. 40b und 146 ad Art. 712g). Steht auf der ' +
			'Reglementsseite für «Reglement ändern, gewöhnliche Bestimmung» eine Regel, die in jeder Hinsicht ' +
			'strenger ist als das Gesetz, rechnet Votum dort unabhängig von dieser Einstellung nach ihr und vermerkt, dass das umstritten ist. ' +
			'Verlangt diese Regel die Zustimmung aller, greift die Einstellung nur, wenn Sie im Entscheidbaum ' +
			'die Antwort zur Klausel wählen.'
	},
	{
		/*
		 * **L7 rechnet an der Beschlussfähigkeit, nicht am Mehr** (Migration
		 * 183, Einteilung F3b, B2): Kein Knoten trägt sie; sie wirkt bei jedem
		 * Traktandum, an dem jemand im Ausstand ist. Nach der Vorgabe zählen
		 * die Personen im Ausstand weiter als anwesend, und Votum sagt der
		 * Leitung, wenn der Beschluss an ihnen hängt. Unter «Zählt nicht mit»
		 * sperrt Votum das verbindliche Eröffnen je Traktandum
		 * (`verlangeBeschlussfaehigkeitFuer`, `server/abstimmung.ts`;
		 * Produktentscheid 06.11.2026).
		 */
		kennung: 'L7',
		frage: 'Zählt für die Beschlussfähigkeit mit, wer bei einem Traktandum im Ausstand ist?',
		gegenstand: 'ob für die Beschlussfähigkeit mitzählt, wer bei einem Traktandum im Ausstand ist',
		wahlen: [
			{
				wert: 'zaehlt',
				bezeichnung: 'Zählt mit',
				imSatz: 'die Beschlussfähigkeit mit den Personen im Ausstand',
				imSatzDativ: 'der Beschlussfähigkeit mit den Personen im Ausstand',
				wirkung:
					'Wer bei einem Traktandum im Ausstand ist oder nur über einen Vertreter im Ausstand vertreten ' +
					'ist, zählt für die Beschlussfähigkeit weiter als anwesend. Hängt sie an diesen Personen, sagt ' +
					'Votum es der Leitung vor der Abstimmung.',
				fundstelle:
					'SVIT-Kommentar Rz. 17 ad Art. 712p, mit Meier-Hayoz/Rey, Weber und Friedrich: Ein ' +
					'Interessenkonflikt beeinflusst die Beschlussfähigkeit nicht. Für die Partei, deren Vertreter ' +
					'im Ausstand ist, folgert Votum dasselbe.'
			},
			{
				wert: 'zaehlt_nicht',
				bezeichnung: 'Zählt nicht mit',
				imSatz: 'die Beschlussfähigkeit ohne die Personen im Ausstand',
				imSatzDativ: 'der Beschlussfähigkeit ohne die Personen im Ausstand',
				wirkung:
					// Fachprüfung L7, F-3, und Laienprüfung L-2 (06.11.2026): Wer nur über
					// eine Person im Ausstand vertreten ist, fällt mit heraus; bei einer
					// Verwaltung mit vielen Vollmachten ist das die eigentliche Wirkung.
					'Votum prüft vor jeder Abstimmung, ob die Versammlung auch ohne die Personen im Ausstand ' +
					'beschlussfähig ist, und ohne die Eigentümer, die nur über eine Person im Ausstand vertreten ' +
					'sind. Fehlt die Beschlussfähigkeit, wird über dieses Traktandum nicht verbindlich ' +
					'abgestimmt; die übrigen Traktanden gehen weiter.',
				fundstelle:
					'Handschin/Wyttenbach 2011, S. 63, gestützt auf Wermelinger, Zürcher Kommentar, Art. 712m N 154 ' +
					'(2010). Für die Partei, deren Vertreter im Ausstand ist, folgert Votum dasselbe.'
			}
		],
		vorgabe: 'zaehlt',
		vorgabeGrund: 'So sagt es der SVIT-Kommentar mit der dort genannten Lehre.',
		warumVorgabe:
			'Der SVIT-Kommentar sagt, ein Interessenkonflikt ändere an der Beschlussfähigkeit nichts (Rz. 17 ad ' +
			'Art. 712p), mit drei weiteren Autoren. Handschin/Wyttenbach zählen die Person im Ausstand nicht mit; ' +
			'sie stützen sich auf eine ältere Ausgabe desselben Autors. Sicher ist ein Beschluss, wenn die ' +
			'Versammlung auch ohne die Personen im Ausstand beschlussfähig ist.',
		geltung:
			'Die Einstellung wirkt an ersten und zweiten Versammlungen, bei jedem Traktandum mit jemandem im ' +
			'Ausstand. Am Mehr ändert sie nichts: Wer im Ausstand ist, stimmt in keinem Fall mit.'
	},
	{
		/*
		 * **L8 ruht Vollmachten statt ein Mehr zu ändern** (Migration 184,
		 * Einteilung F3b, B4): Kein Knoten trägt sie; sie wirkt an
		 * Traktanden, die als Geschäft der Verwaltung gekennzeichnet sind,
		 * und nur für Vollmachten, bei denen vermerkt ist, dass die Verwaltung
		 * sie hält (Produktentscheid 06.11.2026: zwei Häkchen). Unter der
		 * Vorgabe gilt die Verwaltung bei diesen Traktanden als im Ausstand,
		 * ohne dass jemand ihn erklärt (`leseAusstandskennungen`,
		 * `server/abstimmung.ts`); unter «Die Sitzungsleitung entscheidet»
		 * ruhen die Vollmachten nur nach einem erklärten Ausstand wie bisher.
		 */
		kennung: 'L8',
		frage:
			'Ruhen die Vollmachten der Verwaltung, wenn über ihre Entschädigung, einen Vertrag mit ihr oder ' +
			'ihre Entlastung abgestimmt wird?',
		gegenstand:
			'ob die Vollmachten der Verwaltung ruhen, wenn über ihre Entschädigung, einen Vertrag mit ihr oder ' +
			'ihre Entlastung abgestimmt wird',
		wahlen: [
			{
				wert: 'ruhen',
				bezeichnung: 'Vollmachten ruhen',
				imSatz: 'das Ruhen der Vollmachten der Verwaltung',
				imSatzDativ: 'dem Ruhen der Vollmachten der Verwaltung',
				wirkung:
					'An einem Traktandum, das als Entschädigung, Vertrag oder Entlastung der Verwaltung ' +
					'gekennzeichnet ist, zählt Votum die Stimmen nicht, die die Verwaltung mit Vollmachten abgibt. ' +
					'Die Vertretenen stimmen dort nur, wenn sie selbst kommen oder eine Person bevollmächtigt haben, ' +
					'die nicht für die Verwaltung arbeitet. Bei Wahl und Wiederwahl ruhen die Vollmachten nicht.',
				fundstelle:
					'Wer selbst nicht stimmen darf, stimmt auch als Vertreter nicht (BGE 134 III 481 E. 3.6 und ' +
					'3.8); für eine Verwaltung, die nicht Eigentümerin ist, sinngemäss. Bei der Entlastung schliesst ' +
					'das Bundesgericht im Aktienrecht alle anwesenden Organe aus, auch als Vertreter mit Weisung ' +
					'(Art. 695 Abs. 1 OR; BGE 128 III 142 E. 3b). Für die Entlastung im Stockwerkeigentum übernimmt ' +
					'der SVIT-Kommentar die Grundsätze des Aktienrechts (Rz. 145 ad Art. 712q).'
			},
			{
				wert: 'leitung',
				bezeichnung: 'Die Sitzungsleitung entscheidet',
				imSatz: 'den Entscheid der Sitzungsleitung über den Ausstand',
				imSatzDativ: 'dem Entscheid der Sitzungsleitung über den Ausstand',
				wirkung:
					'Votum lässt die Vollmachten der Verwaltung nur ruhen, wenn die Sitzungsleitung bei diesem ' +
					'Traktandum ihren Ausstand erklärt. Sonst zählen die Stimmen, die die Verwaltung mit ' +
					'Vollmachten abgibt. Leitet die Verwaltung die Versammlung, entscheidet sie so über ihre eigenen ' +
					'Vollmachten. Den Vorsitz für dieses Traktandum übernimmt dann besser eine Eigentümerin oder ein ' +
					'Eigentümer.',
				fundstelle:
					'Ob die Vollmachten einer Verwaltung ohne Eigentum ruhen, sagt für das Stockwerkeigentum keine ' +
					'Stelle ausdrücklich. BGE 134 III 481 E. 3.8 schliesst eine Verwalterin ohne Eigentum aus, weil ' +
					'ihr Vollmachtgeber selbst ausgeschlossen war. Für die Entlastung schliesst das Bundesgericht im ' +
					'Aktienrecht alle anwesenden Organe aus, auch als Vertreter (BGE 128 III 142 E. 3b).'
			}
		],
		vorgabe: 'ruhen',
		vorgabeGrund: 'Sonst stimmt die Verwaltung mit fremden Stimmen über ihr eigenes Geschäft ab.',
		warumVorgabe:
			'Wer bei einem Geschäft nicht selbst stimmen darf, darf es nach dem Bundesgericht auch nicht als ' +
			'Vertreter (BGE 134 III 481 E. 3.8). Für eine Verwaltung, die nicht Eigentümerin ist, sagt das keine ' +
			'Stelle ausdrücklich; Votum überträgt es auf ihre Entschädigung, Verträge mit ihr und ihre ' +
			'Entlastung. Auch Stimmen, die zu Unrecht nicht zählen, machen einen Beschluss anfechtbar ' +
			'(BGer 5A_972/2020 E. 7.2.4). Wer an der Versammlung ist, muss das vor der Abstimmung beanstanden, ' +
			'sonst kann er das Recht zur Anfechtung verlieren (E. 7.2.3.2). Deshalb sagt Votum, ob die andere ' +
			'Wahl am Ergebnis etwas ändern könnte.',
		geltung:
			'Die Einstellung wirkt nur an Traktanden, die als Entschädigung, Vertrag oder Entlastung der ' +
			'Verwaltung gekennzeichnet sind, und nur für Vollmachten, bei denen vermerkt ist, dass die Verwaltung ' +
			'sie hält. Bei Wahl und Wiederwahl ruhen die Vollmachten nicht (BGE 134 III 481 E. 3.5 und 3.8). Bei ' +
			'der Abberufung ist es nicht geklärt; dort ruhen sie nur, wenn die Sitzungsleitung den Ausstand der ' +
			'Verwaltung erklärt. Einen Rechtsstreit mit der Verwaltung erfasst die Einstellung nicht; dort ' +
			'erklärt die Sitzungsleitung den Ausstand ebenfalls selbst.',
		/*
		 * Der Rat im zweiten Ergebnis (Produktentscheide 06.11.2026): Wer die
		 * Zählung nicht schon vor der Abstimmung beanstandet hat, kann das
		 * Recht zur Anfechtung verlieren. Beide Richtungen derselbe Satz, weil
		 * er an der Rüge hängt, nicht am Ausgang; wie bei L4 an der Lesart und
		 * nicht an der Wahl, denn wirken tut er nur, wenn L8 das zweite
		 * Ergebnis liefert.
		 */
		nachAblehnung:
			'Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
			'beanstandet haben (BGer 5A_709/2010 E. 4).',
		nachAnnahme:
			'Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
			'beanstandet haben (BGer 5A_709/2010 E. 4).'
	},
	{
		/*
		 * **L9 wählt die Zählbasis der Ermächtigung zur Ausschlussklage**
		 * (Migration 188, Fassung 2026-11-10): Der Knoten `k-ausschlussklage`
		 * trägt sie. Die Vorgabe ist das Mehr aller Eigentümer ohne den
		 * Beklagten; eine so erteilte Ermächtigung besteht nach beiden
		 * Lesarten (Entscheid 0044, zweiter Nachtrag, R1 (a)). Wortlaute nach
		 * dem Auftrag E1, Block C.
		 */
		kennung: 'L9',
		frage:
			'An welcher Zahl wird die Mehrheit für die Ermächtigung zur Ausschlussklage gemessen: an allen Eigentümern ohne den Beklagten oder an den Anwesenden und Vertretenen ohne ihn?',
		gegenstand:
			'ob die Ermächtigung zur Ausschlussklage die Mehrheit aller Eigentümer ohne den Beklagten braucht oder die Mehrheit der Anwesenden und Vertretenen genügt',
		wahlen: [
			{
				wert: 'alle',
				bezeichnung: 'Alle Eigentümer ohne den Beklagten',
				mehr: MEHR_ALLE_AUSSER_BETROFFENE,
				imSatz: 'die Mehrheit aller Eigentümer ohne den Beklagten',
				imSatzDativ: 'der Mehrheit aller Eigentümer ohne den Beklagten',
				wirkung:
					// Laienprüfung E1 L9, L-5: der Weg, damit die Vorgabe erreichbar wirkt.
					'Die Mehrheit wird an allen Eigentümern ausser dem Beklagten gemessen, auch an den abwesenden. Wer weder da noch vertreten ist, wirkt wie ein Nein. Bei zehn Eigentümern, einer davon beklagt, sind fünf Ja nötig, gleich wie viele erschienen sind. ' +
					// Laien- und Fachprüfung E1 L9 Runde 2 (R2-L-4, R2-F-2): an wen die Vollmacht geht.
					// Runde 3 (R3-F-4, R3-L-3): neutral an alle, damit die Bewirtschaftung nicht für den Ausschluss wirbt.
					'Sagen Sie deshalb mit der Einladung allen, dass Fernbleiben hier wie ein Nein wirkt und wer ' +
					'nicht kommen kann, eine Vollmacht geben kann. Eine Vollmacht an den Beklagten oder an ' +
					'Angehörige im Ausstand wirkt wie ein Nein.',
				fundstelle:
					'Wortlaut von ZGB Art. 649b Abs. 2; so Strittmatter, nach SVIT-Kommentar Rz. 214 ad Art. 712a'
			},
			{
				wert: 'anwesende',
				bezeichnung: 'Anwesende und Vertretene ohne den Beklagten',
				mehr: EINFACHES_MEHR,
				imSatz: 'die Mehrheit der Anwesenden und Vertretenen ohne den Beklagten',
				imSatzDativ: 'der Mehrheit der Anwesenden und Vertretenen ohne den Beklagten',
				wirkung:
					'Die Mehrheit wird nur an den Eigentümern gemessen, die da oder vertreten sind, ohne den Beklagten. Sind von neun übrigen Eigentümern sechs da oder vertreten, genügen vier Ja.',
				fundstelle:
					'SVIT-Kommentar Rz. 214 ad Art. 712a, mit Kohler; Rz. 166b ad Art. 712m; zum gleich lautenden Art. 647d BGE 144 III 510 E. 2.2.4'
			}
		],
		vorgabe: 'alle',
		vorgabeGrund:
			'Der Wortlaut des Gesetzes nennt alle Eigentümer ohne den Beklagten, und eine so erteilte Ermächtigung besteht nach beiden Lesarten.',
		warumVorgabe:
			'Art. 649b Abs. 2 ZGB verlangt den Mehrheitsbeschluss aller Miteigentümer mit Ausnahme des Beklagten. Der SVIT-Kommentar lässt die Mehrheit der Anwesenden und Vertretenen genügen (Rz. 214 ad Art. 712a), wie das Bundesgericht beim gleich lautenden Art. 647d (BGE 144 III 510 E. 2.2.4); für die Ausschlussklage hat es das nicht entschieden. Ohne Ermächtigung scheitert die Klage in der Sache (BGer 5A_735/2019 E. 3.3.1); ob das Gericht dabei auch die Zahl nachprüft, ist offen. Votum rechnet deshalb nach dem Wortlaut: Eine Ermächtigung mit der Mehrheit aller ohne den Beklagten besteht nach beiden Lesarten.',
		geltung:
			'Die Einstellung gilt für die Ermächtigung zur Ausschlussklage (ZGB Art. 649b). Der Beklagte stimmt nach beiden Wahlen nicht mit. Unter «Anwesende und Vertretene» zählt auch nicht mit, wer im Ausstand ist, etwa Angehörige des Beklagten. Ist eine Bestimmung Ihres Reglements zu diesem Mehr hinterlegt, rechnet Votum nach ihr; was dann gilt, sagt die Karte.',
		folgeMilderWahl:
			// Fachprüfung E1 L9, F-1: E. 3.3.1 sagt nur «materiell-rechtliche
			// Voraussetzung»; der Grundsatz (Rz. 207 ad Art. 712m, Rz. 219a ad
			// Art. 712a) gehört dazu, das Risiko als offene Frage, nicht als Folgerung.
			'Die Ermächtigung ist eine Voraussetzung der Klage (BGer 5A_735/2019 E. 3.3.1). ' +
			'Wird eine Ermächtigung mit der Mehrheit der Anwesenden nicht innert der Frist angefochten, gilt sie in der Regel (SVIT-Kommentar Rz. 207 ad Art. 712m, Rz. 219a ad Art. 712a). ' +
			'Ob das Gericht im Ausschlussprozess trotzdem prüft, ob die Mehrheit aller erreicht war, hat kein Gericht entschieden. Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat. ' +
			'Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller Eigentümer ohne den Beklagten.'
	},
	{
		/*
		 * **L10 wählt die Zahl der Angehörigen im Ausstand an der Ermächtigung
		 * zur Ausschlussklage** (Migration 189, Fassung 2026-11-10): Kein Knoten
		 * trägt sie; sie wirkt an `k-ausschlussklage`, wo die Mehrheit an allen
		 * Eigentümern ohne den Beklagten gemessen wird (`ausstandBleibtInDerZahl`
		 * in `entscheidbaum.ts`). Die Vorgabe lässt die Angehörigen in der Zahl;
		 * eine so erteilte Ermächtigung besteht nach beiden Lesarten (Entscheid
		 * 0044, zweiter Nachtrag, R1 (b)). Wortlaute nach dem Auftrag E1, Block D.
		 */
		kennung: 'L10',
		frage:
			// Fachprüfung E1 L10, F-2: nur Angehörige mit eigener Wohnung (Entscheid 0044, R1 b).
			'Bleiben Angehörige des Beklagten mit eigener Wohnung, die im Ausstand sind, in der Zahl, an der die Mehrheit für die Ermächtigung zur Ausschlussklage gemessen wird?',
		gegenstand:
			'ob Angehörige des Beklagten mit eigener Wohnung im Ausstand in der Zahl aller Eigentümer bleiben, an der die Ermächtigung zur Ausschlussklage gemessen wird',
		wahlen: [
			{
				wert: 'bleiben',
				bezeichnung: 'Bleiben in der Zahl',
				imSatz: 'die Rechnung mit den Angehörigen in der Zahl',
				imSatzDativ: 'der Rechnung mit den Angehörigen in der Zahl',
				wirkung:
					'Die Angehörigen stimmen nicht mit, zählen aber in der Zahl aller Eigentümer und wirken wie ein Nein. ' +
					'Bei elf Eigentümern, einem Beklagten und seiner Ehefrau mit eigener Wohnung sind sechs Ja von zehn nötig.',
				fundstelle:
					'Wortlaut von ZGB Art. 649b Abs. 2, der nur den Beklagten ausnimmt; zum Ausstand ZGB Art. 68 ' +
					'sinngemäss (BGer 5A_198/2014 E. 5.4; BGE 134 III 481 E. 3.8)'
			},
			{
				wert: 'fallen_heraus',
				bezeichnung: 'Fallen aus der Zahl',
				imSatz: 'die Rechnung ohne die Angehörigen',
				imSatzDativ: 'der Rechnung ohne die Angehörigen',
				wirkung:
					'Die Angehörigen stimmen nicht mit und zählen auch in der Zahl aller Eigentümer nicht. ' +
					'Im selben Beispiel sind fünf Ja von neun nötig.',
				fundstelle:
					'Handschin/Wyttenbach 2011, S. 63: Das ruhende Stimmrecht wird nicht in die Berechnung des ' +
					'Quorums einbezogen'
			}
		],
		vorgabe: 'bleiben',
		vorgabeGrund:
			'Der Wortlaut des Gesetzes nimmt nur den Beklagten aus, und eine so erteilte Ermächtigung besteht nach beiden Lesarten.',
		warumVorgabe:
			'Art. 649b Abs. 2 ZGB nimmt aus der Zahl aller Eigentümer nur den Beklagten aus. Dass seine Angehörigen ' +
			// Fachprüfung E1 L10, F-5: der Vorbehalt der Karte und S. 64 als Lehre zum
			// Ehegatten; Runde 2, R2-F-1: entschieden ist es für den Beklagten selbst.
			'nicht mitstimmen, folgt aus Art. 68 ZGB, den das Bundesgericht an der Ermächtigung zur Ausschlussklage ' +
			'sinngemäss auf den Beklagten selbst anwendet (BGer 5A_198/2014 E. 5.3.4 und 5.4); für seine ' +
			'Angehörigen entschieden hat es das nicht. Ob sie dann auch aus ' +
			'der Zahl fallen, sagt dafür keine Stelle. Handschin/Wyttenbach nehmen das ruhende Stimmrecht allgemein ' +
			'aus der Berechnung (S. 63; zum Rechtsstreit gegen den Ehegatten S. 64). Votum ' +
			'rechnet im Zweifel streng: Eine Ermächtigung mit den Angehörigen in der Zahl besteht nach beiden Lesarten.',
		geltung:
			// Fachprüfung E1 L10, F-1 und F-2; Laienprüfung L-7; Runde 2, R2-F-2 und R2-F-4.
			'Die Einstellung gilt nur für die Ermächtigung zur Ausschlussklage, wenn die Mehrheit an allen ' +
			'Eigentümern ohne den Beklagten gemessen wird. Wendet Votum dort eine Bestimmung Ihres Reglements an, ' +
			'wirkt die Einstellung nicht; misst die Bestimmung an allen Eigentümern, bleiben die Angehörigen in der ' +
			'Zahl. Wann Votum sie anwendet, sagt die Karte. Unter «Anwesende und Vertretene» zählt, wer im Ausstand ' +
			'ist, ohnehin nicht mit. Das Ergebnis an allen Eigentümern, das Votum dort zusätzlich nennt, rechnet die ' +
			'Angehörigen in jedem Fall mit. Gemeint sind ' +
			'Angehörige mit eigener Wohnung. Eine Wohnung, die dem Beklagten mit anderen gehört, etwa ihm und seiner ' +
			// Entscheid 0047, 1 (Fachprüfung E1 L10, F-2; Auftrag «Texte nach 0047», Punkt 4): Die gemeinsame
			// Wohnung bleibt nach beiden Wahlen in der Zahl; ein erklärender Satz, kein Umbau.
			'Ehefrau, stimmt in jeder Lesart nicht. Richtet sich der Antrag nur gegen ihn, bleibt sie nach beiden ' +
			'Wahlen in der Zahl und wirkt wie ein Nein, denn Art. 649b Abs. 2 nimmt nur den Beklagten aus. Das gilt ' +
			'auch unter «Fallen aus der Zahl». Ob deren Grund (wer nicht stimmen darf, zählt nicht mit) auch eine ' +
			'solche Wohnung erfasst, ist offen; Votum hält sich hier an den Wortlaut des Gesetzes und rechnet ' +
			'strenger. Wie sie in der Zahl steht, wenn sich der Antrag gegen alle ihre ' +
			'Eigentümer richtet, sagt der Hinweis auf der Karte. Den Ausstand der ' +
			'Angehörigen erklärt die Sitzungsleitung; Votum kennt die Verwandtschaft nicht.',
		folgeMilderWahl:
			'Die Ermächtigung ist eine Voraussetzung der Klage (BGer 5A_735/2019 E. 3.3.1). Wird eine Ermächtigung, ' +
			'die die Mehrheit nur ohne die Angehörigen erreicht, nicht innert der Frist angefochten, gilt sie in der ' +
			'Regel (SVIT-Kommentar Rz. 207 ad Art. 712m, Rz. 219a ad Art. 712a). Ob das Gericht im Ausschlussprozess ' +
			'trotzdem nachprüft, ob die Mehrheit mit ihnen in der Zahl erreicht war, hat kein Gericht entschieden. ' +
			'Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat. Den Streit um die Zahl vermeidet ' +
			'nur eine Ermächtigung, die die Mehrheit auch mit den Angehörigen in der Zahl erreicht.',
		// W9 nach den Prüfrunden 2 und 3 zu L9: der Grundsatz vor der offenen Frage,
		// der sichere Weg auch für den Eilfall und mit Bedingung, Vollmachten neutral
		// an alle, «frühestens» statt «am sichersten», mit der Frist auch des
		// Beklagten. Muster: ZAEHLBASIS_OFFEN, ZAEHLBASIS_WEG, ZAEHLBASIS_FRUEHESTENS.
		ratNachAnnahme:
			'Er gilt ab heute, bis ein Gericht ihn aufhebt. Wer nicht zugestimmt hat, kann ihn beim Gericht ' +
			'anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder ' +
			'da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). ' +
			'Wird er nicht rechtzeitig angefochten, gilt er in der Regel. Ob das Gericht im Ausschlussprozess ' +
			'trotzdem nachprüft, ob die Mehrheit mit den Angehörigen in der Zahl erreicht war, hat kein Gericht ' +
			'entschieden. Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat. Den Streit um die ' +
			'Zahl vermeidet nur eine Ermächtigung, die die Mehrheit auch mit ihnen in der Zahl erreicht. Fehlt sie, ' +
			'holen Sie sie bald an einer weiteren Versammlung, auch einer ausserordentlichen. Sagen Sie mit der ' +
			'Einladung allen, dass Fernbleiben wie ein Nein wirkt und wer nicht kommen kann, eine Vollmacht geben ' +
			// Laienprüfung E1 L10, L-2 und L-3: die Zustellung als erster Schritt, die
			// Frist auch der Angehörigen im Ausstand, die zur Abstimmung hinausgehen.
			'kann. Eine Vollmacht an den Beklagten oder an Angehörige im Ausstand wirkt dabei wie ein Nein. Das ' +
			'Protokoll nennt beide Ergebnisse und die offene Frage, damit die Klagenden das Risiko kennen; stellen ' +
			// Laienprüfung Runde 2, R-1 und R-2: eindeutiger Bezug, der spätere Beginn
			// als Vorsicht (Fachprüfung Runde 2 zu F4: Art. 75, Rz. 230 und 230a).
			'Sie es rasch und nachweisbar allen zu, auch dem Beklagten. Wer trotzdem mit der heutigen Ermächtigung ' +
			'klagt, wartet, bis die Frist für alle abgelaufen ist; vorsichtshalber rechnet er sie für Abwesende, den ' +
			'Beklagten und Angehörige im Ausstand ab Zustellung des Protokolls. Holt jemand ein Einschreiben nicht ' +
			// Fachprüfung E1 L10 Runde 3, R3-F-2: die Zustellfiktion als Vorsicht.
			'ab, rechnet er vorsichtshalber ab dem siebten Tag nach dem Zustellversuch; ob das für diese Frist gilt, ' +
			'hat kein Gericht entschieden. Geklagt wird frühestens einige Wochen ' +
			'nach Ablauf der Frist, wenn die Bewirtschaftung bestätigt, dass keine Vorladung und keine Klage zu einer Anfechtung ' +
			'eingegangen ist.',
		stattNaechsterVersammlung:
			// Fachprüfung E1 L10, F-3: Vollmachten neutral an alle, wie bei L9 (R3-F-4).
			'Sicherer ist, den Antrag an einer weiteren Versammlung erneut zu stellen, auch einer ' +
			'ausserordentlichen; nötig ist dann mehr als die Hälfte aller Eigentümer ausser dem Beklagten. Sagen ' +
			'Sie mit der Einladung allen, dass Fernbleiben wie ein Nein wirkt und wer nicht kommen kann, eine ' +
			'Vollmacht geben kann. Die Angehörigen im Ausstand zählen dabei wie ein Nein, ebenso eine Vollmacht an ' +
			'sie oder an den Beklagten.',
		protokollNachAblehnung:
			'Verkündet ist die Ablehnung; ermächtigt ist damit niemand, und auch eine Anfechtung der Ablehnung ' +
			'allein ermächtigt nicht zur Klage.',
		verkuendetNachAblehnung:
			'Eine Ermächtigung, die die Mehrheit nur ohne die Angehörigen erreicht, kann angefochten werden, und ' +
			'wird sie aufgehoben, scheitert die Ausschlussklage.',
		// Laienprüfung E1 L10, L-1 und L-4: wie nach einer Ablehnung zuerst, was verkündet ist und gilt
		// (Auftrag «Texte nach 0047», Punkt 3b).
		protokollNachAnnahme:
			'Verkündet ist die Ermächtigung; sie gilt, bis ein Gericht sie aufhebt. Wer nicht zugestimmt hat, kann ' +
			'sie beim Gericht anfechten, ' +
			'innert eines Monats, seit er davon weiss; wer anwesend oder vertreten war, ab der Versammlung, wer ' +
			'weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. ' +
			'Art. 75). Wird sie nicht rechtzeitig angefochten, gilt sie in der Regel. Ob das Gericht im ' +
			'Ausschlussprozess trotzdem nachprüft, ob die Mehrheit mit den Angehörigen in der Zahl erreicht war, ' +
			'hat kein Gericht entschieden. Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat.'
	},
	{
		/*
		 * **L11 wählt das Mehr der Ermächtigung zur Prozessführung**
		 * (Migration 186, Fassung 2026-11-10): Der Knoten
		 * `k-prozessfuehrung` trägt sie. Die Vorgabe ist das qualifizierte
		 * Mehr; eine Ermächtigung, die es erreicht, besteht nach beiden
		 * Lesarten (Entscheid 0044, zweiter Nachtrag, R1 (d)). Wortlaute nach
		 * dem Auftrag E1, Block A.
		 */
		kennung: 'L11',
		frage:
			'Welches Mehr braucht der Beschluss, der die Bewirtschaftung ermächtigt, für die Gemeinschaft einen Prozess zu führen?',
		gegenstand:
			'ob die Ermächtigung der Bewirtschaftung zur Prozessführung das qualifizierte Mehr braucht',
		wahlen: [
			{
				wert: 'qualifiziert',
				bezeichnung: 'Qualifiziertes Mehr',
				mehr: QUALIFIZIERTES_MEHR,
				imSatz: 'das qualifizierte Mehr',
				imSatzDativ: 'dem qualifizierten Mehr',
				// Endfassung Block C, Abschnitt 7: wie die Köpfe zählen, stellt L13 ein.
				wirkung:
					'Es braucht die Mehrheit nach Köpfen, gezählt, wie es die Frage zur Zählweise der Köpfe einstellt (Vorgabe: Anwesende und Vertretene), und dazu mehr als die Hälfte aller Wertquoten. Auch die Wertquoten der Abwesenden zählen dabei mit und wirken wie ein Nein.',
				fundstelle:
					'SVIT-Kommentar Rz. 74 und 89a ad Art. 712t und Rz. 113 ad Art. 712a: in der Regel eine wichtigere Verwaltungshandlung (ZGB Art. 647b Abs. 1)'
			},
			{
				wert: 'einfach',
				bezeichnung: 'Einfaches Mehr',
				mehr: EINFACHES_MEHR,
				imSatz: 'das einfache Mehr',
				imSatzDativ: 'dem einfachen Mehr',
				wirkung:
					'Gezählt werden nur die Köpfe der Anwesenden und Vertretenen; die Wertquoten zählen nicht.',
				fundstelle:
					// Fachprüfung E1 L11, F-6: Dass die drei das einfache Mehr genügen
					// lassen, sagt BGer 5A_198/2014 E. 6.1.2; SVIT Rz. 74 sagt nur «a.M.».
					'Meier-Hayoz/Rey, Rz. 44 ad Art. 712t, Friedrich, Reglement, § 44 Rz. 9, und Vouilloz, S. 86, nach BGer 5A_198/2014 E. 6.1.2 (dort die Frage offengelassen) und SVIT-Kommentar Rz. 74 ad Art. 712t'
			}
		],
		vorgabe: 'qualifiziert',
		vorgabeGrund:
			// R5-F-3 (Endfassung Block C, Abschnitt 7): «beiden Wahlen zum Mehr» statt «beiden Lesarten».
			'Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.',
		warumVorgabe:
			'Der SVIT-Kommentar sieht in der Ermächtigung zur Prozessführung in der Regel eine wichtigere Verwaltungshandlung, wegen der Bedeutung und der Folgen eines Prozesses (Rz. 74 und 89a ad Art. 712t). Andere Autoren lassen das einfache Mehr genügen; das Bundesgericht hat die Frage offengelassen (BGer 5A_198/2014 E. 6.1.2). Votum rechnet im Zweifel streng. Eine Ermächtigung, die das qualifizierte Mehr erreicht, besteht nach beiden Wahlen zum Mehr.',
		// Fachprüfung E1 L11, F-5 (Rechtsmittel, Prozess der Gegenseite, Beleg der
		// Betreibung) und F-4 (Form nach Art. 712g Abs. 2; Votum prüft sie nicht,
		// wie an der Ausschlussklage).
		geltung:
			'Die Einstellung gilt für die Ermächtigung der Bewirtschaftung, für die Gemeinschaft einen Prozess zu führen, etwa ein Schlichtungsgesuch oder eine Klage einzureichen oder sich gegen eine Klage zu verteidigen. ' +
			'Für Betreibung und Rechtsöffnung braucht sie keine Ermächtigung (ZGB Art. 712s Abs. 2 mit Rz. 40a; Rz. 67 f. ad Art. 712t), für ein Rechtsmittel dagegen in der Regel schon (Rz. 82 ad Art. 712t). ' +
			// Fachprüfung Runde 2, R2-F-5: Die Beschwerdefrist ist kurz (ZPO Art. 321 Abs. 2).
			'Reicht die Zeit für eine Versammlung nicht, darf sie das Rechtsmittel ergreifen und die Ermächtigung nachholen, solange die Versammlung es nicht abgelehnt hat (ZGB Art. 712t Abs. 2). ' +
			'Nicht für die Ausschlussklage: Dort klagen Eigentümerinnen und Eigentümer selbst. ' +
			'Ist eine Bestimmung Ihres Reglements zu diesem Mehr hinterlegt, rechnet Votum nach ihr und nicht nach der Lesart. ' +
			// Fachprüfung Runde 2, R2-F-2: Wer das qualifizierte Mehr verlangt, braucht keine
			// Einstimmigkeit (Art. 647a Abs. 2; Rz. 34 und 78 ad Art. 712g); eine unangefochtene
			// Senkung gilt in der Regel; seit «Texte nach 0047», Punkt 10, nicht geklärt, wie
			// `reglement.ts` zu den Enthaltungen (`KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN`). Laienprüfung
			// Runde 2, R2-L-6: was der Begründungsakt ist.
			'Verlangt sie das qualifizierte Mehr, gilt sie nach beiden Lesarten. ' +
			'Senkt sie es, ist sie nach der Vorgabe nur rechtmässig, wenn alle Eigentümer ihr zugestimmt haben oder sie im Begründungsakt steht (ZGB Art. 712g Abs. 2; SVIT-Kommentar Rz. 78 und 78a ad Art. 712g). ' +
			'Der Begründungsakt ist die Urkunde, mit der das Stockwerkeigentum errichtet wurde. ' +
			'Ob die Bestimmung trotzdem gilt, wenn sie mit weniger Stimmen eingeführt und nicht innert Frist angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4 (dort zum Wechsel von Köpfen zu Anteilen).',
		// Fachprüfung E1 L11, F-1: Der Beschluss ist nur anfechtbar und gilt bis
		// zur Aufhebung, auch gegenüber Dritten (Rz. 206, 207 und 234 ad
		// Art. 712m); nicht entschieden ist nur der Prozess gegen Dritte selbst.
		folgeMilderWahl:
			'Eine Gegenpartei ausserhalb der Gemeinschaft, etwa ein Handwerker, kann diesen Beschluss nicht anfechten. ' +
			// Runde 3: Die Monatsfrist gilt für die Anfechtung, die Aufhebung kann Monate
			// später kommen (R3-F-1; Rz. 230 und 234 ad Art. 712m); was offen ist, beim
			// Namen (R2-L-1, R3-L-2; Rz. 207 und 226 ad Art. 712m sprechen dagegen).
			'Er gilt, bis ein Gericht ihn aufhebt. ' +
			// Laienprüfung Block C, Nachtrag, N-L-12: «es» stand weit vom Gericht.
			'Das kann das Gericht nur, wenn ein Eigentümer innert der Anfechtungsfrist anficht, dann aber auch Monate später, während der Prozess schon läuft. ' +
			'Ob die Gegenpartei im Prozess einwenden kann, die Bewirtschaftung sei mit dem einfachen Mehr nicht genügend ermächtigt, hat das Bundesgericht nicht entschieden. ' +
			// Fachprüfung Block C, Nachtrag, N-F-3: Das qualifizierte Mehr stützt sich auf
			// Art. 647b Abs. 1; im Streit um die Zählweise der Köpfe sichert es nicht.
			'Im Streit um das Mehr sicher ist eine Ermächtigung mit dem qualifizierten Mehr. Stimmt dabei mehr als die Hälfte aller Eigentümer zu, kommt es auch auf den Streit um die Zählweise der Köpfe nicht an.',
		// Fachprüfung E1 L11, F-2 und F-7; Runde 3, F5, und Laienprüfung Runde 3, F5:
		// Im Saal nur, was die Leitung jetzt braucht, in der Reihenfolge des Gesetzes
		// (gilt, ist anfechtbar, fällt rückwirkend; Rz. 207, 230 und 234 ad
		// Art. 712m). Was die Bewirtschaftung danach tut, steht im Hinweis der Karte
		// (`NACH_EINFACHEM_MEHR` in der Fassung 2026-11-10). Allgemein «Prozess»: Die
		// Lesart gilt auch für die Verteidigung (Codeprüfung, Durchgang 2, M2). Der
		// Fristsatz ist `ANFECHTUNGSFRIST` aus `auszaehlung.ts`, wörtlich (Test).
		ratNachAnnahme:
			'Er gilt ab heute, bis ein Gericht ihn aufhebt. ' +
			'Wer nicht zugestimmt hat, kann ihn beim Gericht anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). ' +
			'Folgt das Gericht der anderen Lesart, kann es ihn aufheben, auch rückwirkend für einen Prozess, der schon läuft (SVIT-Kommentar Rz. 234 ad Art. 712m). ' +
			// Runde 4, F6 (beide Prüfungen): kein «bis dahin», die weitere Versammlung
			// braucht es nicht in jedem Fall.
			// Fachprüfung Block C, Nachtrag, N-F-3; ohne «erst» (Laienprüfung Nachtrag Runde 2, N2-L-10).
			'Im Streit um das Mehr sicher wird die Ermächtigung mit dem qualifizierten Mehr an einer weiteren Versammlung; stimmt dort mehr als die Hälfte aller Eigentümer zu, kommt es auch auf die Zählweise der Köpfe nicht an. ' +
			'Wie die Bewirtschaftung jetzt vorgeht und wann eine weitere Versammlung nötig wird, steht in den Hinweisen der Karte «Bewirtschaftung zur Prozessführung ermächtigen».',
		// Fachprüfung Runde 3, F4 (unsere Auslegung, keine Stelle entscheidet den Fall):
		// Art. 712t Abs. 2 hilft, wenn die Versammlung nicht rechtzeitig entscheiden
		// kann, nicht nach ihrem Nein; die Nachholung bräuchte dasselbe Mehr (Rz. 77
		// bis 79 und 107 ad Art. 712t; ZPO Art. 132 Abs. 1). Laienprüfung L-4, L-5 und
		// R2-L-5: eigens einberufen und Vollmachten.
		stattNaechsterVersammlung:
			'Sie können ihn an einer weiteren Versammlung wieder traktandieren. ' +
			'Bitten Sie die Abwesenden dann um eine Vollmacht, denn ihre Wertquoten zählen wie ein Nein. ' +
			// Runde 4, R4-L-6: einfacher gebaut, und der Schritt im Eilfall.
			'Nach dieser Ablehnung darf die Bewirtschaftung in der Regel auch im Eilfall nicht ohne Ermächtigung klagen, um sie später einzuholen. ' +
			'Dafür bräuchte es dasselbe qualifizierte Mehr, das eben verfehlt wurde (ZGB Art. 712t Abs. 2; Rz. 77 bis 79 ad Art. 712t). ' +
			// Runde 5, R5-F-1 und R5-F-2: Einberufen ist Sache der Bewirtschaftung
			// (Art. 712n Abs. 1), die Frist des Reglements gilt auch im Eilfall
			// (Rz. 25 bis 29 und 68 ad Art. 712n), und reicht sie nicht, bleiben die
			// zwei Wege mit allen (Rz. 28 ad Art. 712n).
			'Eilt es, beruft die Bewirtschaftung deshalb sofort eine ausserordentliche Versammlung ein, mit der Einberufungsfrist Ihres Reglements. ' +
			'Kommt auch diese Versammlung zu spät, bleibt in der Regel nur, dass alle Eigentümer schriftlich zustimmen oder alle an einer Versammlung teilnehmen (ZGB Art. 66 Abs. 2; Rz. 28 ad Art. 712n).'
	},
	{
		/*
		 * **L12 wählt die Zählung der Einstimmigkeit bei der luxuriösen
		 * baulichen Massnahme** (Migration 187, Fassung 2026-11-10): Der Knoten
		 * `k-baulich-luxurioes` trägt sie. Die Vorgabe ist die Zustimmung aller
		 * eingetragenen Eigentümer; ein so gefasster Beschluss besteht nach
		 * beiden Lesarten (Entscheid 0044, zweiter Nachtrag, R5 (a)). Wortlaute
		 * nach dem Auftrag E1, Block B.
		 */
		kennung: 'L12',
		frage:
			'Wessen Zustimmung braucht eine luxuriöse bauliche Massnahme: die aller eingetragenen Eigentümer oder die aller Anwesenden und Vertretenen?',
		gegenstand:
			'ob eine luxuriöse bauliche Massnahme die Zustimmung aller eingetragenen Eigentümer braucht oder die aller Anwesenden und Vertretenen genügt',
		wahlen: [
			{
				wert: 'alle',
				bezeichnung: 'Alle eingetragenen Eigentümer',
				mehr: EINSTIMMIGKEIT_ALLER,
				imSatz: 'die Zustimmung aller eingetragenen Eigentümer',
				imSatzDativ: 'der Zustimmung aller eingetragenen Eigentümer',
				wirkung:
					// Laienprüfung E1 L12, L-7: der Weg, damit die Vorgabe nicht unerreichbar wirkt.
					'Jeder im Grundbuch eingetragene Eigentümer muss zustimmen, selbst oder über seine Vertretung. Wer weder da noch vertreten ist, wirkt wie ein Nein. ' +
					'Holen Sie deshalb vor der Versammlung Vollmachten ein, oder fassen Sie den Beschluss schriftlich mit allen (ZGB Art. 66 Abs. 2).',
				fundstelle:
					'Herrschende Lehre nach SVIT-Kommentar Rz. 197 ad Art. 712m (Rey/Maetzke, Perruchoud, Romang, Michaud, anscheinend Friedrich)'
			},
			{
				wert: 'anwesende',
				bezeichnung: 'Alle Anwesenden und Vertretenen',
				mehr: EINSTIMMIGKEIT_ANWESENDE,
				imSatz: 'die Zustimmung aller Anwesenden und Vertretenen',
				imSatzDativ: 'der Zustimmung aller Anwesenden und Vertretenen',
				wirkung:
					'Es genügt, dass alle zustimmen, die da oder vertreten sind. Wer weder da noch vertreten ist, zählt nicht mit. Eine Enthaltung im Saal verhindert den Beschluss weiterhin.',
				fundstelle: 'SVIT-Kommentar Rz. 197 ad Art. 712m, mit Jürg Schmid und wohl Aebi-Müller; anders Manz'
			}
		],
		vorgabe: 'alle',
		vorgabeGrund:
			'Die herrschende Lehre verlangt die Zustimmung aller eingetragenen Eigentümer, und ein so gefasster Beschluss besteht nach beiden Lesarten.',
		warumVorgabe:
			'Die herrschende Lehre verlangt für die luxuriöse Massnahme die Zustimmung aller im Grundbuch eingetragenen Eigentümer; der SVIT-Kommentar lässt die Zustimmung aller Anwesenden und Vertretenen genügen (Rz. 197 ad Art. 712m). Votum rechnet im Zweifel streng, weil ein Beschluss nach der milderen Lesart anfechtbar ist, wenn die strengere gilt, und bei einem schweren Eingriff vielleicht sogar nichtig. Ein Beschluss, dem alle eingetragenen Eigentümer zustimmen, besteht nach beiden Lesarten.',
		geltung:
			'Die Einstellung gilt für die luxuriöse bauliche Massnahme, der alle zustimmen müssen (ZGB Art. 647e Abs. 1). Nicht für den Ausweg mit Kostenübernahme durch die übrigen nach Abs. 2: Er hat eine eigene Karte und braucht das qualifizierte Mehr.',
		folgeMilderWahl:
			// Fachprüfung E1 L12, F-1: 5A_499/2010 betraf eine Zweckänderung, keine
			// luxuriöse Massnahme; anfechtbar nach Rz. 206 und 209 ad Art. 712m (Schluss
			// vom qualifizierten Mehr). Laienprüfung L-4: der Schritt vor der Abstimmung.
			'Nach der herrschenden Lehre braucht es die Zustimmung aller eingetragenen Eigentümer. ' +
			'Fehlt sie, ist der Beschluss in der Regel anfechtbar, so wie einer, der nur mit dem qualifizierten Mehr gefasst wurde (SVIT-Kommentar Rz. 206 und 209 ad Art. 712m). ' +
			'Ob er bei einem schweren Eingriff, etwa in die Nutzung der Wohnung eines Abwesenden, sogar nichtig sein kann, also auch ohne Anfechtung ungültig, ist nicht geklärt. ' +
			'Das Bundesgericht hat es für eine Zweckänderung erwogen, die nur die Anwesenden beschlossen hatten, und offengelassen (BGer 5A_499/2010 E. 8.3 und 8.6). ' +
			'Sicher ist der Beschluss mit der Zustimmung aller eingetragenen Eigentümer; legen Sie dafür das Blatt mit dem Wortlaut schon vor der Abstimmung bereit (Weg zur Zustimmung aller auf der Karte).',
		ratNachAnnahme:
			// Fachprüfung E1 L12, F-4 und F2: kurz im Saal, wie bei L11; den Fristsatz
			// für die Anwesenden lässt er weg, sie haben alle zugestimmt (Rz. 223 ad
			// Art. 712m). Das Vorgehen danach steht im Hinweis `NACH_ANWESENDEN`.
			'Er gilt ab heute, bis ein Gericht ihn aufhebt. ' +
			'Wer weder da noch vertreten war, kann ihn beim Gericht anfechten, innert eines Monats, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75; SVIT-Kommentar Rz. 223 und 230 ad Art. 712m). ' +
			'Folgt das Gericht der herrschenden Lehre, hebt es ihn auf. ' +
			'Ob er bei einem schweren Eingriff sogar nichtig ist, also ohne Anfechtung ungültig, ist nicht geklärt (zu einer Zweckänderung offengelassen in BGer 5A_499/2010 E. 8.6). ' +
			'Sicher ist er, wenn alle eingetragenen Eigentümer denselben Antrag schriftlich annehmen (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2): Lassen Sie das Blatt mit dem Wortlaut gleich hier unterschreiben. ' +
			// Laienprüfung Runde 2, R2-L-1: die Bremse auch im Saal; Fachprüfung Runde 3,
			// R3-F-1: mit allen Unterschriften ohne Wartezeit (Rz. 128 ad Art. 712m).
			'Vergeben Sie Aufträge erst, wenn alle eingetragenen Eigentümer unterschrieben haben oder die Frist abgelaufen ist; was dabei gilt, steht in den Hinweisen der Karte «Luxuriöse bauliche Massnahme».',
		// Fachprüfung E1 L12, F-5: Fehlt nur die Zustimmung Abwesender, ist der
		// schriftliche Beschluss der schnelle Weg. Steht nur im Rat nach einer
		// Ablehnung, die «anwesende» angenommen hätte.
		nachAblehnung:
			'Fehlt nur die Zustimmung von Abwesenden, ist der schnellste Weg ein schriftlicher Beschluss über denselben Antrag, den alle unterschreiben, die Anwesenden am besten gleich hier (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2; Weg zur Zustimmung aller auf der Karte).',
		// Laienprüfung E1 L12, L-1 (hoch): Wer abwesend war, liest nur das Protokoll,
		// und ab ihm läuft seine Frist; Muster: der Protokollsatz zu 1a unter einer
		// Regel der Anwesenden (A5, Punkt 14).
		protokollNachAnnahme:
			// Runde 2, R2-L-2 und R2-L-4: was nach der Frist gilt, und wo angefochten wird.
			// Runde 3, R3-L-2: Das Gesuch an die Schlichtungsbehörde wahrt die Frist
			// (ZPO Art. 62 Abs. 1; BGE 140 III 561 E. 2.2.2.4; Fachprüfung Runde 3).
			'Wer weder da noch vertreten war, kann den Beschluss beim Gericht anfechten, innert eines Monats, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). ' +
			'Dafür genügt es, innert dieser Frist ein Gesuch an die Schlichtungsbehörde zu stellen (ZPO Art. 62 Abs. 1). ' +
			'Danach ist das in der Regel nicht mehr möglich.'
	},
	{
		/*
		 * **L13 wählt, wie die Köpfe bei der «Mehrheit aller Miteigentümer»
		 * zählen** (Migration 192, Fassung 2026-11-14; Entscheid 0048, Antworten 4
		 * bis 6, 9 und 10). Kein Knoten trägt sie; sie wirkt am gerechneten
		 * Erfordernis, wo die Rechtsgrundlage mit ZGB Art. 647a Abs. 2, 647b
		 * Abs. 1, 647c oder 647e Abs. 2 beginnt (`kopfzaehlweiseWirkt`). Nicht an
		 * Art. 647d: Dort hat das Bundesgericht die Zählung unter den Anwesenden
		 * bestätigt (BGE 144 III 510 E. 2.2.4). Nicht unter einer Regel des
		 * Reglements, auch nicht, wo Votum die Enthaltungsklausel anwendet
		 * (Antwort 10). Unter «Alle Eigentümer» bleibt, wer im Ausstand ist, in
		 * der Zahl und wirkt wie ein Nein (Antwort 9). Wortlaute nach der
		 * Endfassung (`quellen`, `pruefung/zu-pruefen-2026-11-13-votum-regel43-
		 * block-c-endfassung.md`, Abschnitt 1) nach fünf Runden Laien- und
		 * Fachprüfung.
		 */
		kennung: 'L13',
		frage:
			'Zählen bei Beschlüssen, für die das Gesetz die «Mehrheit aller Miteigentümer» verlangt, nur die ' +
			'Köpfe der Anwesenden und Vertretenen oder die aller Eigentümer?',
		gegenstand:
			'ob bei der «Mehrheit aller Miteigentümer» nur die Köpfe der Anwesenden und Vertretenen zählen oder die ' +
			'aller Eigentümer',
		wahlen: [
			{
				wert: 'anwesende',
				bezeichnung: 'Anwesende und Vertretene',
				imSatz: 'die Zählung unter den Anwesenden und Vertretenen',
				imSatzDativ: 'der Zählung unter den Anwesenden und Vertretenen',
				wirkung:
					'Gezählt werden die Köpfe der Eigentümer, die an der Versammlung anwesend oder vertreten sind. Wer ' +
					'fehlt und keine Vollmacht gegeben hat, zählt nicht mit. Bei 20 Eigentümern, von denen 12 da oder ' +
					'vertreten sind, genügen bei den Köpfen 7 Ja.',
				fundstelle:
					'Herrschende Lehre: Für die Versammlung gilt das Vereinsrecht, und es geht dem Wortlaut vor (ZGB ' +
					'Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 124 ad Art. 712a, Rz. 166b, 181 und 190 f. ' +
					'ad Art. 712m; Handschin/Wyttenbach 2011, S. 67 bis 70). Für nützliche bauliche Massnahmen bestätigt ' +
					// Auftrag «Texte nach 0047», Punkt 12b: die zweite Gegenmeinung aus demselben Urteil.
					'vom Bundesgericht (BGE 144 III 510 E. 2.2.4). Ch. Müller und K. Müller zählen nur die Abstimmenden ' +
					'(genannt im selben Urteil); das Bundesgericht ist ihnen nicht gefolgt.'
			},
			{
				wert: 'alle',
				bezeichnung: 'Alle Eigentümer',
				imSatz: 'die Zählung unter allen Eigentümern',
				imSatzDativ: 'der Zählung unter allen Eigentümern',
				wirkung:
					'Gezählt werden die Köpfe aller Eigentümer, auch der abwesenden. Wer fehlt und keine Vollmacht ' +
					'gegeben hat, wirkt wie ein Nein, ebenso wer im Ausstand ist. Im selben Beispiel braucht es bei den ' +
					'Köpfen 11 Ja. Das ist strenger als die herrschende Lehre: Ein Antrag, dem nur die Mehrheit der ' +
					'Anwesenden und Vertretenen zustimmt, gilt dann als abgelehnt, und auch diese Ablehnung kann ' +
					'angefochten werden. Kann höchstens die Hälfte der Eigentümer mitstimmen, weil die übrigen fehlen ' +
					'oder im Ausstand sind, kann die Versammlung solche Beschlüsse nicht fassen, auch nicht an einer ' +
					'zweiten Versammlung. Fehlen zu viele, helfen nur Vollmachten. Bei zwei Eigentümern kommt ein ' +
					'solcher Beschluss unter dieser Zählweise nie zustande, wenn einer im Ausstand ist; unter «Anwesende ' +
					'und Vertretene» entscheidet bei den Köpfen dann der andere. Wer nur sicher gehen will, muss nicht ' +
					'auf «Alle Eigentümer» umstellen: Es genügt, dass mehr als die Hälfte aller Eigentümer zustimmt; ' +
					'dann besteht der Beschluss nach beiden Zählweisen.',
				fundstelle:
					'Wortlaut von ZGB Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e Abs. 2. Bei nützlichen baulichen ' +
					'Massnahmen zählten so Simonius/Sutter und Michaud (genannt in BGE 144 III 510 E. 2.2.4); das ' +
					'Bundesgericht ist ihnen dort nicht gefolgt.'
			}
		],
		vorgabe: 'anwesende',
		vorgabeGrund: 'So zählt die herrschende Lehre, die Auffassung der meisten Fachleute.',
		warumVorgabe:
			'Das Gesetz sagt bei diesen Beschlüssen «Mehrheit aller Miteigentümer». Die herrschende Lehre, die ' +
			'Auffassung der meisten Fachleute, zählt im Stockwerkeigentum trotzdem nur die Anwesenden und ' +
			'Vertretenen. Denn für die Versammlung gilt das Vereinsrecht, und danach entscheidet die Mehrheit der ' +
			'Anwesenden (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 124 ad Art. 712a, Rz. 166b und ' +
			'190 f. ad Art. 712m; Handschin/Wyttenbach, S. 67 bis 70). Das Bundesgericht hat das für nützliche ' +
			'bauliche Massnahmen bestätigt (BGE 144 III 510 E. 2.2.4). Sein Grund: Ist eine Versammlung nicht ' +
			'beschlussfähig, wird eine zweite einberufen, und an ihr genügt ein Drittel der Eigentümer. Müsste die ' +
			'Mehrheit aller zustimmen, könnte eine solche Versammlung oft weder nützliche noch notwendige Arbeiten ' +
			'beschliessen. Über die übrigen Beschlüsse hat das Bundesgericht nicht entschieden. Einzelne Autoren ' +
			// Auftrag «Texte nach 0047», Punkt 12a: beide Gegenmeinungen aus BGE 144 III 510 E. 2.2.4.
			'zählen alle Eigentümer, andere nur die Eigentümer, die abstimmen; beide Ansichten nennt BGE 144 III 510 ' +
			// Runde 2 (F-5): die Enthaltung mit Rz. 181 belegt, nicht mit dem Urteil; Runde 3 (R2-L-6): Bezug.
			'E. 2.2.4, dort zu den nützlichen baulichen Massnahmen. Wer nur die Abstimmenden zählt, lässt ' +
			'Enthaltungen weg (SVIT-Kommentar Rz. 181 ad Art. 712m). Ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt, besteht nach beiden ' +
			'Zählweisen.',
		// Die Liste der Endfassung mit Zeilenumbrüchen; die Seite «Lesarten» setzt
		// sie als Zeilen (`Lesartenwahl.svelte`, `white-space: pre-line`).
		geltung:
			'Die Einstellung gilt für Beschlüsse, bei denen das Gesetz «Mehrheit aller Miteigentümer» sagt:\n' +
			'- wer gewöhnliche Verwaltungsarbeiten in Auftrag geben darf, wenn die Versammlung das anders regelt ' +
			'(ZGB Art. 647a Abs. 2),\n' +
			'- wichtigere Verwaltungshandlungen (Art. 647b Abs. 1),\n' +
			'- notwendige bauliche Massnahmen (Art. 647c),\n' +
			'- luxuriöse Massnahmen gegen den Willen Einzelner (Art. 647e Abs. 2).\n' +
			'Sie gilt nicht:\n' +
			'- bei nützlichen baulichen Massnahmen (Art. 647d): Dort zählt Votum immer die Anwesenden und ' +
			'Vertretenen, weil das Bundesgericht diese Zählung bestätigt hat,\n' +
			'- bei der Ermächtigung zur Ausschlussklage: dafür gibt es eine eigene Frage auf dieser Seite,\n' +
			'- wenn Votum eine Bestimmung Ihres Reglements anwendet. Dazu gehört die Bestimmung, nach der ' +
			'Enthaltungen beim einfachen Mehr nicht mitzählen (Angaben der Gemeinschaft); sie betrifft hier die ' +
			'notwendigen baulichen Massnahmen und die Zuständigkeit für gewöhnliche Verwaltungsarbeiten.\n' +
			'Wertquoten (die Anteile am Grundstück) zählen, wo das Gesetz sie verlangt, immer über alle Wertquoten. ' +
			'Wer im Ausstand ist, stimmt nicht mit. Im Ausstand ist, wer mitentscheiden würde über ein Geschäft oder ' +
			'einen Streit zwischen ihm und der Gemeinschaft. Unter «Alle Eigentümer» zählt er trotzdem in der ' +
			'Gesamtzahl und wirkt wie ein Nein, weil der Wortlaut niemanden ausnimmt; geklärt ist das nicht. Unter ' +
			// Auftrag «Texte nach 0047», Punkt 12e: was Votum rechnet, nicht als gesicherte Rechtslage.
			'«Anwesende und Vertretene» zählt er nicht mit. Votum zählt Enthaltungen in beiden Fällen mit, wie die ' +
			'herrschende Lehre; sie wirken wie ein Nein. Ausgenommen ist, wo Votum die Bestimmung Ihres Reglements ' +
			'anwendet, nach der sie beim einfachen Mehr nicht mitzählen.',
		// Die milde Wahl ist hier die Vorgabe: Die Folge steht auf der Seite
		// «Lesarten» unter «Anwesende und Vertretene», nicht auf der Karte; dort
		// trägt es «Wortlaut und Rechtsprechung» (Endfassung, Abschnitt 1).
		folgeMilderWahl:
			'Ein Beschluss, den nur die Mehrheit der Anwesenden und Vertretenen trägt, gilt, bis ein Gericht ihn ' +
			'aufhebt. Wer nicht zugestimmt hat, kann ihn beim Gericht anfechten, innert eines Monats, seit er davon ' +
			'weiss, und sich auf den Wortlaut berufen. Bei nützlichen baulichen Massnahmen hat das Bundesgericht die ' +
			'Zählung unter den Anwesenden bestätigt; über die übrigen Beschlüsse hat es nicht entschieden. Wer ' +
			'sicher gehen will, holt vor der Versammlung Vollmachten ein, damit mehr als die Hälfte aller ' +
			'Eigentümer zustimmen kann.',
		folgeUnter: 'anwesende',
		nachAnnahme:
			'Die Zählung folgt der herrschenden Lehre; ob Sie mit der Ausführung zuwarten, wägen Sie am Geschäft ' +
			'ab. Wer sicher gehen will, stellt das Protokoll rasch und nachweisbar allen zu. Er wartet dann, bis ' +
			'die Frist für alle abgelaufen ist und bei der Bewirtschaftung keine Mitteilung der Schlichtungsbehörde ' +
			'oder des Gerichts eingegangen ist; das kann einige Wochen länger dauern als die Frist. Eilt die ' +
			'Arbeit, darf der Beschluss ausgeführt werden, denn er gilt. Hebt ein Gericht ihn später auf, kann das ' +
			'Kosten oder einen Rückbau nach sich ziehen.',
		nachAblehnung:
			'Für die nächste Versammlung: Holen Sie vorher Vollmachten ein. Bei der Zählweise «Alle Eigentümer» ' +
			'wirkt jeder, der fehlt und niemanden bevollmächtigt, wie ein Nein.',
		ratNachAblehnungBeiNotwendigenArbeiten:
			'Am einfachsten traktandieren Sie den Antrag an der nächsten Versammlung wieder und holen vorher ' +
			'Vollmachten ein. Daneben steht der Weg ans Gericht offen: Bei notwendigen Arbeiten kann jeder ' +
			'Eigentümer verlangen, dass das Gericht sie anordnet; das Urteil ersetzt dann den Beschluss (ZGB ' +
			'Art. 647 Abs. 2 Ziff. 1; SVIT-Kommentar Rz. 235a ad Art. 712m, Rz. 103 ad Art. 712a). Wer nicht Nein ' +
			'gestimmt hat, kann zudem die Ablehnung anfechten, innert eines Monats, seit er davon weiss: wer hier ' +
			'oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls ' +
			'(ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Die Anfechtung allein hebt die Ablehnung in der Regel nur auf. ' +
			'Nur was sofort nötig ist, um Schaden abzuwenden, etwa bei einem Wasserschaden, darf jeder auf Kosten ' +
			'aller selbst veranlassen, wenn die Bewirtschaftung nicht rechtzeitig eingreift (ZGB Art. 647 Abs. 2 ' +
			'Ziff. 2); für alles Weitere braucht es den Beschluss oder das Gericht.',
		protokollNachAnnahme:
			'Der Beschluss gilt, bis ein Gericht ihn aufhebt. Das Bundesgericht hat für diese Art von Beschluss ' +
			'nicht entschieden, ob alle Eigentümer zählen. Wer nicht zugestimmt hat, kann den Beschluss beim ' +
			'Gericht anfechten, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, innert eines ' +
			'Monats, seit er davon weiss; wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls ' +
			'(ZGB Art. 712m Abs. 2 i.V.m. Art. 75).',
		protokollNachAblehnung:
			'Die Ablehnung gilt, bis die Versammlung neu beschliesst oder ein Gericht sie aufhebt. Wer nicht Nein ' +
			'gestimmt hat, kann sie beim Gericht anfechten, in der Regel zuerst mit einem Gesuch an die ' +
			'Schlichtungsbehörde, innert eines Monats, seit er davon weiss; wer weder da noch vertreten war, in der ' +
			'Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Hebt das Gericht die Ablehnung ' +
			'auf, ist der Antrag damit nicht angenommen. Er kann an einer späteren Versammlung neu traktandiert ' +
			'werden, auch ohne Anfechtung.',
		protokollNachAblehnungBeiNotwendigenArbeiten:
			'Bei notwendigen Arbeiten kann zudem jeder Eigentümer beim Gericht verlangen, dass sie angeordnet ' +
			'werden (ZGB Art. 647 Abs. 2 Ziff. 1).'
	}
];

/** Die Vorgaben, wie sie gelten, solange niemand umstellt. */
export const LESARTEN_VORGABE: Lesartenwahl = {
	L1: 'bleibt',
	L2: 'einfach',
	L3: 'je_eigentuemer',
	L4: 'qualifiziert',
	L5: 'erste',
	L6: 'klausel',
	L7: 'zaehlt',
	L8: 'ruhen',
	L9: 'alle',
	L10: 'bleiben',
	L11: 'qualifiziert',
	L12: 'alle',
	L13: 'anwesende'
};

/**
 * Die Wahl zu L1 an einem Erfordernis. Fehlt sie, stammt das Erfordernis von
 * vor Migration 170; gezählt wird dann nach der Vorgabe, wie diese Traktanden
 * immer gezählt haben. Gesetzt wird sie an jedem Traktandum mit Erfordernis,
 * auch am Grenzfall; ob sie wirkt, entscheidet die Zählung.
 */
export function ausstandswahlVon(e: { ausstandslesart?: Ausstandswahl | null }): Ausstandswahl {
	return e.ausstandslesart ?? LESARTEN_VORGABE.L1;
}

/**
 * Die Fundstelle der milden Seite von L1, an einer Stelle für alle Sätze.
 * **S. 63, nicht 62** (Fachprüfung L7, F-1, 06.11.2026; am PDF nachgemessen):
 * Die Seitenzahlen stehen am Fuss der Seite. Die «62» vor dem Satz mit Fn. 103
 * in der Textfassung ist die Fusszahl der vorigen Seite; die Seite mit dem
 * Satz trägt unten die 63 (PDF-Seite 19). F3b G-1 hatte sie als Seitenkopf
 * gelesen, und die Zahl kippte zweimal.
 */
const L1_STELLE_ZUM_AUSSTAND =
	'Handschin/Wyttenbach, S. 63, mit Wermelinger, Zürcher Kommentar, Art. 712m N 154';

/**
 * Der Satz zu L1, wo ein Ausstand den Nenner aller Wertquoten berührt: im Saal
 * ohne Fundstellen, im Protokoll und in der Auszählmappe mit ihnen. Er nennt
 * die Lesart dieser Versammlung; die strenge Seite als Grundregel samt
 * Folgerung, die milde mit ihrer Fundstelle (Konzept, Kriterium 7).
 *
 * **Woher die Einordnung stammt** (früher bei `AUSSTAND_UNGEKLAERT`): Die
 * Fachprüfung zu Ä-27 (`quellen` `pruefung/berichte/2026-10-18-votum-ausstand-
 * basis-ae27.md`) zeigte am Volltext, dass Rz. 191 ad Art. 712m nur die
 * Grundregel nennt und nichts zum Ausstand; beide Werke führen beide Regeln,
 * ungeklärt ist ihr Zusammenspiel, kein Streit zweier Autoren. Anwaltsfrage
 * Nr. 2 ist offen.
 */
export function ausstandslesartSatz(wahl: Ausstandswahl, mitFundstellen: boolean): string {
	const frage = 'Ob die Wertquote einer Partei im Ausstand bei «allen Wertquoten» mitzählt, ist nicht geklärt.';
	// A5, Punkt 1b: der Grund statt der Software (Rz. 191 ad Art. 712m). Laienprüfung
	// A5, H1: nicht «abweichend von der Vorgabe», das klingt nach Regelverstoss.
	const grund = lesartVon('L1')?.vorgabeGrund ?? '';
	const nach =
		wahl === 'bleibt'
			? ` Gerechnet wird nach der Lesart «Wertquote zählt mit». Das ist die Standardeinstellung: ${grund}`
			: ` Gerechnet wird nach der Lesart «Wertquote fällt heraus», die für Ihre Gemeinschaft eingestellt ist. Die Standardeinstellung wäre die andere: ${grund}`;
	if (!mitFundstellen) return frage + nach;
	// Fachprüfung Block 2, Befund 2: nicht «die einzige» Stelle (schon in Ä-27
	// gestrichen), und sie sagt nicht ausdrücklich, dass der Nenner sinkt.
	// Laienprüfung N1: wer folgert, was «ruhend» heisst.
	return (
		frage +
		nach +
		(wahl === 'bleibt'
			? ' Diese Lesart stützt sich auf die Grundregel, nach der das Mehr nach Wertquoten am ganzen ' +
				'Stockwerkeigentum misst (Wermelinger, SVIT-Kommentar, Rz. 191 ad Art. 712m). Dass sie auch beim ' +
				'Ausstand gilt, sagt die Stelle nicht; es ist eine Folgerung. Beiläufig und für einen angenommenen Fall in dieselbe Richtung: BGer 5A_721/2021 E. 3.3. Eine Literaturstelle zum Ausstand ' +
				'nimmt das Stimmrecht dessen, der im Ausstand ist, aus der Berechnung des Mehrs ' +
				`(${L1_STELLE_ZUM_AUSSTAND}).`
			: ' Diese Lesart stützt sich auf eine Literaturstelle zum Ausstand, die das Stimmrecht dessen, der im ' +
				`Ausstand ist, aus der Berechnung des Mehrs nimmt (${L1_STELLE_ZUM_AUSSTAND}). Ob damit der ` +
				'Nenner aller Wertquoten sinkt, sagt sie nicht ausdrücklich. Nach der Grundregel misst das ' +
				'Mehr nach Wertquoten am ganzen Stockwerkeigentum (Wermelinger, SVIT-Kommentar, Rz. 191 ad ' +
				'Art. 712m).')
	);
}

/**
 * Der Satz zu L1 auf der Karte vor der Abstimmung (Konzept, Kriterium 4; Review
 * DeepSeek zu Block 2, Befund 6). Er steht an jedem Traktandum, an dem L1
 * wirken kann (`ausstandslesartWirkt`), auch ohne Ausstand: Wer die Lesart erst
 * nach einer Ausstandserklärung liest, kann sich nicht mehr darauf einstellen.
 * Die Wirkung je Wahl ohne Zahlenbeispiel; das Beispiel steht auf der Seite
 * «Lesarten».
 */
export function ausstandslesartKartensatz(wahl: Ausstandswahl): string {
	const andere: Ausstandswahl = wahl === 'bleibt' ? 'faellt_heraus' : 'bleibt';
	const name = (w: Ausstandswahl) => wahlInWorten('L1', w).replace(/ \(Vorgabe\)$/, '');
	const wirkung = (w: Ausstandswahl) =>
		w === 'bleibt'
			? 'die Wertquote im Ausstand bleibt in der Zahl aller Wertquoten und wirkt wie ein Nein'
			: 'die Zahl aller Wertquoten wird um die Wertquote im Ausstand kleiner, und die nötige Zahl sinkt';
	// A5, Punkt 1b: der Grund der Vorgabe statt der Software. Ohne Schlusspunkt,
	// weil der Satz hinter der Klammer weitergeht.
	const grund = (lesartVon('L1')?.vorgabeGrund ?? '').replace(/\.$/, '');
	return (
		`Tritt jemand in den Ausstand, rechnet dieses Traktandum nach der Lesart «${name(wahl)}»` +
		`${wahl === 'bleibt' ? ` (Standardeinstellung: ${grund})` : `, die für Ihre Gemeinschaft eingestellt ist (die Standardeinstellung wäre die andere: ${grund})`}: ` +
		`${wirkung(wahl)}. Nach der anderen Lesart («${name(andere)}») ` +
		// Laienprüfung Runde 5, N1: die Wirkung der anderen, nicht nur ihr Name.
		`${andere === 'bleibt' ? 'bliebe die Wertquote im Ausstand in der Zahl und wirkte wie ein Nein' : 'würde die Zahl aller Wertquoten um sie kleiner, und die nötige Zahl sänke'}. ` +
		'Nach der Auszählung nennt Votum dann auch das Ergebnis nach der anderen Lesart.'
	);
}

/**
 * Der Satz zur Wertquote im Ausstand, wo L1 nicht wirkt: an der
 * Ausschlussklage, wenn eine hinterlegte Regel dort Wertquoten verlangt. Die
 * Quote bleibt dann im Nenner, wie Beklagter und Angehörige in der Zahl
 * bleiben (1e; Produktentscheid 21.10.2026).
 */
export function ausstandFestSatz(): string {
	return (
		'Ob die Wertquote einer Partei im Ausstand bei «allen Wertquoten» mitzählt, ist nicht geklärt. ' +
		'Bei der Ermächtigung zur Ausschlussklage rechnet Votum unabhängig von der Lesart der ' +
		'Gemeinschaft mit ihr.'
	);
}

/**
 * Die Wahl zu L3 an einem Erfordernis. Fehlt sie, stammt das Erfordernis von
 * vor Migration 172 und damit aus einer Fassung, an der L3 nicht wirkt; die
 * Vorgabe ist dann nur der Ersatzwert. Gesetzt wird sie an jedem Traktandum mit Erfordernis,
 * auch ausserhalb der Einsprache; ob sie wirkt, entscheidet die Zählung
 * (`zaehlweiseFuer` in `entscheidbaum.ts`).
 */
export function einsprachelesartVon(e: { einspracheLesart?: Einsprachewahl | null }): Einsprachewahl {
	return e.einspracheLesart ?? LESARTEN_VORGABE.L3;
}

/**
 * Die Wahl zu L10 an einem Erfordernis. Fehlt sie, stammt das Erfordernis von
 * vor Migration 189 und damit aus einer Fassung, an der L10 nicht wirkt; die
 * Vorgabe ist dann nur der Ersatzwert. Gesetzt wird sie an jedem Traktandum mit
 * Erfordernis, auch ausserhalb der Ausschlussklage; ob sie wirkt, entscheidet
 * die Zählung (`angehoerigenlesartWirkt` in `entscheidbaum.ts`).
 */
export function angehoerigenlesartVon(e: {
	angehoerigenlesart?: Angehoerigenlesart | null;
}): Angehoerigenlesart {
	return e.angehoerigenlesart ?? LESARTEN_VORGABE.L10;
}

/**
 * Die erste Fassung, in der die Gemeinschaft die Zählweise der Köpfe einstellt
 * (L13, Migration 192; Entscheid 0048, Antworten 4 bis 6).
 *
 * **Warum erst hier und nicht rückwirkend**, wie bei `ANGEHOERIGENLESART_AB`:
 * Ältere Traktanden rechnen nach ihrer Fassung (AD-4), die Köpfe unter den
 * Anwesenden und Vertretenen. Eine Wahl, die es damals nicht gab, darf daran
 * nichts ändern; freigegebene Traktanden rechnen nach ihrer Momentaufnahme.
 */
export const KOPFZAEHLWEISE_AB = '2026-11-14';

/**
 * Die Rechtsgrundlagen, an denen L13 wirkt (Entscheid 0048, Antwort 5, «Alle
 * ohne Bundesgerichtsentscheid»): der Wortlaut «Mehrheit aller Miteigentümer»
 * ohne Entscheid des Bundesgerichts zur Zählweise. **Nicht Art. 647d Abs. 1**:
 * Dort hat das Bundesgericht die Zählung unter den Anwesenden bestätigt (BGE
 * 144 III 510 E. 2.2.4). Art. 647 Abs. 1bis, den die Antwort nennt, gilt im
 * Stockwerkeigentum nicht und trägt keinen Knoten (Entscheid 0048, Anlass).
 * Verglichen wird der Anfang der Rechtsgrundlage, wie bei `wortlautArtikel`.
 */
export const KOPFZAEHLWEISE_ARTIKEL: readonly string[] = [
	'ZGB Art. 647a Abs. 2',
	'ZGB Art. 647b Abs. 1',
	'ZGB Art. 647c',
	'ZGB Art. 647e Abs. 2'
];

/** Die notwendigen baulichen Massnahmen: Dort tragen Rat und Protokoll zu L13 den Weg ans Gericht. */
export const NOTWENDIGE_ARBEITEN_ARTIKEL = 'ZGB Art. 647c';

/** Was L13 an einem Erfordernis liest. */
export interface Zaehlweisemerkmale {
	fassung?: string;
	typ: Ergebnistyp;
	rechtsgrundlage: string;
	kopfbasis: Kopfbasis;
	quelle?: string;
	enthaltungZaehltMit?: boolean;
	kopfzaehlweise?: Kopfzaehlweise;
}

/**
 * Ob L13 dieses Erfordernis betrifft: ab der Fassung 2026-11-14, an einem Mehr,
 * nach dem abgestimmt wird, ohne Regel des Reglements, mit einer Rechtsgrundlage
 * aus `KOPFZAEHLWEISE_ARTIKEL`. **Am gerechneten Erfordernis, nicht am
 * Knoten**: Nach der anderen Wahl von L2, L4 oder L11 kann die Rechtsgrundlage
 * eine andere sein (L4 «einfach» nach Art. 712m, L11 «einfach» nach
 * Art. 647a Abs. 1); dort wirkt L13 nicht.
 *
 * Ob sie auch wirkt, sagt `kopfzaehlweiseWirkt`: nicht, wo Votum die
 * Enthaltungsklausel des Reglements anwendet.
 */
export function kopfzaehlweiseBetrifft(e: Zaehlweisemerkmale): boolean {
	return (
		e.fassung !== undefined &&
		istKalendertag(e.fassung) &&
		e.fassung >= KOPFZAEHLWEISE_AB &&
		e.typ !== 'grenzfall' &&
		e.typ !== 'keine_abstimmung' &&
		e.typ !== 'reglementsmehr' &&
		e.quelle !== 'reglement' &&
		(e.kopfbasis === 'anwesend_vertreten' || e.kopfbasis === 'alle_eigentuemer') &&
		KOPFZAEHLWEISE_ARTIKEL.some((a) => e.rechtsgrundlage.startsWith(a))
	);
}

/**
 * Ob L13 an diesem Erfordernis wirkt. **Nicht, wo Votum die Enthaltungsklausel
 * anwendet** (Entscheid 0048, Antwort 10, «Reglement geht vor»): Die Klausel
 * greift nur beim einfachen Mehr der Anwesenden (`mitEinstellung` in
 * `reglement.ts`); dort zählen die Anwesenden und Vertretenen ohne die
 * Enthaltungen, gleich was die Gemeinschaft zur Zählweise eingestellt hat.
 * Die Klausel wird vor L13 angewandt, und die Texte sagen dieselbe Reihenfolge.
 */
export function kopfzaehlweiseWirkt(e: Zaehlweisemerkmale): boolean {
	return kopfzaehlweiseBetrifft(e) && e.enthaltungZaehltMit !== false;
}

/** Wo L13 das Erfordernis betrifft, die Enthaltungsklausel sie aber verdrängt (Antwort 10). */
export function kopfzaehlweiseVerdraengt(e: Zaehlweisemerkmale): boolean {
	return kopfzaehlweiseBetrifft(e) && e.enthaltungZaehltMit === false;
}

/**
 * Welche Wahl zu L13 ein Erfordernis rechnet, an dem sie wirkt: Das sagt sein
 * Mehr, wie bei den Lesarten am Knoten (`wahlDesKnotens`, Entscheid 0048,
 * Block A), nicht die gespeicherte Wahl. Weichen beide ab, sagt die Freigabe ab
 * (`zaehlweiseVeraltet`).
 */
export function kopfzaehlweiseDesMehrs(e: Pick<Zaehlweisemerkmale, 'kopfbasis'>): Kopfzaehlweise {
	return e.kopfbasis === 'alle_eigentuemer' ? 'alle' : 'anwesende';
}

/** Die andere Wahl zu L13. */
export function andereKopfzaehlweise(w: Kopfzaehlweise): Kopfzaehlweise {
	return w === 'alle' ? 'anwesende' : 'alle';
}

/**
 * Bildet das Erfordernis nach der Wahl zu L13 (Bauart A der Landkarte): Wo L13
 * wirkt, setzt die Wahl die Kopfbasis, und `requirement_head_base` speichert
 * sie; die Zählung bleibt, wie sie ist. Die Wahl steht daneben am Erfordernis,
 * als Nachweis und für die Sätze, wo die Enthaltungsklausel sie verdrängt.
 * Ohne Wirkung bleibt das Erfordernis, wie es ist.
 */
export function mitKopfzaehlweise<E extends Zaehlweisemerkmale>(e: E, wahl: Kopfzaehlweise | undefined): E {
	const w = wahl ?? LESARTEN_VORGABE.L13;
	/*
	 * **Die Wahl steht ab der Fassung an jedem Erfordernis mit Mehr**, auch wo
	 * L13 das gerechnete Mehr nicht betrifft (Codeprüfung Block C, M2;
	 * Fachprüfung Nachtrag, N-F-1): Unter L4 oder L11 «einfach» stützt sich das
	 * gerechnete Mehr auf Art. 712m bzw. Art. 647a Abs. 1, das andere aber auf
	 * Art. 647b Abs. 1. Ohne die Wahl am Erfordernis zählte das zweite Ergebnis
	 * nach «qualifiziert» unter «Alle Eigentümer» still die Anwesenden.
	 */
	if (!kopfzaehlweiseBetrifft(e)) return mitMehrAbDerFassung(e) ? { ...e, kopfzaehlweise: w } : e;
	if (!kopfzaehlweiseWirkt(e)) return { ...e, kopfzaehlweise: w };
	return { ...e, kopfzaehlweise: w, kopfbasis: w === 'alle' ? 'alle_eigentuemer' : 'anwesend_vertreten' };
}

/** Ein gespeichertes Erfordernis, soweit L13 es liest, aus den Spalten von `agenda_item`. */
export interface GespeicherteZaehlweise {
	fassung: string | null;
	typ: string | null;
	rechtsgrundlage: string | null;
	kopfbasis: string | null;
	quelle: string | null;
	enthaltungZaehltMit: boolean | null;
	/**
	 * Das andere Mehr der gespeicherten Lesart am Mehr (L2, L4, L11), aus
	 * `requirement_reading->'andere'`. Fehlt es, hat das Traktandum keine.
	 */
	andere?: { typ: string | null; rechtsgrundlage: string | null; kopfbasis: string | null } | null;
}

/**
 * Ob ein gespeichertes Traktandum nach einer anderen Zählweise der Köpfe
 * rechnet, als die Gemeinschaft eingestellt hat (Akzeptanzkriterium 4), wie
 * `angehoerigeNachzuziehen` zu L10. Die Freigabe sagt danach ab
 * (`veralteteLesartenIn`); der Kasten «Erfordernisse nachziehen» vergleicht das
 * neu hergeleitete Mehr und nimmt dieselbe Bedingung zusätzlich in seinen
 * Vergleich (`veralteteErfordernisseIn`), damit er jedes Traktandum zeigt, zu
 * dem die Freigabe absagt. Welche Wahl das Traktandum rechnet, sagt sein Mehr
 * (`kopfzaehlweiseDesMehrs`).
 *
 * **Auch ein Traktandum einer früheren Fassung**, wenn die Gemeinschaft «Alle
 * Eigentümer» eingestellt hat und L13 an ihm wirkte, wäre es nach der Fassung
 * 2026-11-14 hergeleitet (Codeprüfung Block C, N1; Entscheid der Sitzung wie
 * L10): Es rechnet nach seiner Fassung unter den Anwesenden, die
 * Momentaufnahme fröre aber «Alle Eigentümer» ein. Nachgezogen trägt es die
 * aktuelle Fassung und ist nicht mehr veraltet. **Dort zählt auch das andere
 * Mehr** (Codeprüfung Block C, Lauf 2, N-B): Unter L4 oder L11 «einfach» wirkt
 * L13 am gerechneten Mehr nicht, am qualifizierten nach Art. 647b Abs. 1 schon;
 * das zweite Ergebnis zählte sonst die Anwesenden, wo die Momentaufnahme «alle»
 * nennt.
 */
export function zaehlweiseVeraltet(z: GespeicherteZaehlweise, gemeinschaft: Kopfzaehlweise | undefined): boolean {
	const m = zaehlweisemerkmaleAus(z);
	if (gemeinschaft === undefined || m === null || m.fassung === undefined || !istKalendertag(m.fassung)) return false;
	if (m.fassung < KOPFZAEHLWEISE_AB) {
		if (gemeinschaft !== 'alle') return false;
		// Die Enthaltungsklausel wirkt nur am einfachen Mehr der Anwesenden; das andere
		// Mehr erbt sie nicht (Codeprüfung Block C, Lauf 3, N3-1).
		const andere = z.andere ? zaehlweisemerkmaleAus({ ...z, ...z.andere, enthaltungZaehltMit: null }) : null;
		return [m, andere].some((x) => x !== null && kopfzaehlweiseWirkt({ ...x, fassung: KOPFZAEHLWEISE_AB }));
	}
	return kopfzaehlweiseWirkt(m) && kopfzaehlweiseDesMehrs(m) !== gemeinschaft;
}

/** Die Merkmale aus den Spalten, oder `null`, wo eines fehlt. */
export function zaehlweisemerkmaleAus(z: GespeicherteZaehlweise): Zaehlweisemerkmale | null {
	if (!z.fassung || !z.typ || z.rechtsgrundlage === null || !z.kopfbasis) return null;
	return {
		fassung: z.fassung,
		// Die Zeichenketten aus der Datenbank; eine fremde trifft keine Bedingung.
		typ: z.typ as Ergebnistyp,
		rechtsgrundlage: z.rechtsgrundlage,
		kopfbasis: z.kopfbasis as Kopfbasis,
		quelle: z.quelle ?? undefined,
		enthaltungZaehltMit: z.enthaltungZaehltMit ?? undefined
	};
}

/** Ab der Fassung von L13 und mit einem Mehr, nach dem abgestimmt wird. */
function mitMehrAbDerFassung(e: Zaehlweisemerkmale): boolean {
	return (
		e.fassung !== undefined &&
		istKalendertag(e.fassung) &&
		e.fassung >= KOPFZAEHLWEISE_AB &&
		e.typ !== 'grenzfall' &&
		e.typ !== 'keine_abstimmung'
	);
}

/** Ob, wer im Ausstand ist, nach L13 in der Zahl aller Eigentümer bleibt (Antwort 9). */
export function ausstandBleibtNachZaehlweise(e: Zaehlweisemerkmale): boolean {
	return kopfzaehlweiseWirkt(e) && kopfzaehlweiseDesMehrs(e) === 'alle';
}

/**
 * Der Kartensatz zu L3 auf der Karte vor der Abstimmung (Entwurf Block 5,
 * «Kartensatz L3»; Konzept, Kriterium 4). Er ersetzt ab der Fassung 2026-10-28
 * den bisherigen Hinweis `zaehlweiseBeiEinsprache`, in einer Gemeinschaft je
 * Einheit. Die beiden Wahlen unterscheiden sich nach dem Mechanismus der
 * übrigen Lesarten; die Texte sind vor der Laien- und Fachprüfung und werden
 * danach nur in Claude Code geändert.
 */
export function einsprachelesartKartensatz(wahl: Einsprachewahl): string {
	// Wie die übrigen Kartensätze (`ausstandslesartKartensatz`): die
	// Standardeinstellung mit ihrem Grund. Ein Datum der Wahl
	// kennt diese reine Funktion nicht; es steht auf der Seite «Lesarten».
	// Laienprüfung Runde 2, R2-10: bei der Abweichung, dass die Frage offen ist.
	// A5, Punkt 1b: der Grund der Vorgabe statt der Software. Ohne Schlusspunkt,
	// weil der Satz hinter der Klammer weitergeht.
	const grund = (lesartVon('L3')?.vorgabeGrund ?? '').replace(/\.$/, '');
	const vorher =
		wahl === 'je_eigentuemer'
			? ` (Standardeinstellung: ${grund})`
			: ` (die Standardeinstellung wäre die andere: ${grund}); ob eine Zählung je Einheit bei der Einsprache gilt, ist nicht geklärt`;
	if (wahl === 'je_eigentuemer') {
		return (
			'Bei der Einsprache hat nach der Einstellung Ihrer Gemeinschaft jeder Eigentümer eine ' +
			`Stimme, auch wer mehrere Einheiten hat${vorher}. Nach der anderen Zählweise hätte jede ` +
			'Einheit eine Stimme, wie sonst in Ihrer Gemeinschaft. Votum zählt beides und zeigt Ihnen ' +
			'beide Ergebnisse nach dem Schliessen, bevor Sie das Ergebnis verkünden. ' +
			HANDZEICHEN_SATZ
		);
	}
	return (
		'Bei der Einsprache hat nach der Einstellung Ihrer Gemeinschaft jede Einheit eine Stimme, ' +
		`wie sonst in Ihrer Gemeinschaft${vorher}. Nach Gesetz hätte jeder Eigentümer eine Stimme, ` +
		'auch wer mehrere Einheiten hat. Votum zählt beides und zeigt Ihnen beide Ergebnisse nach ' +
		'dem Schliessen, bevor Sie das Ergebnis verkünden. ' +
		HANDZEICHEN_SATZ
	);
}

/**
 * Die Texte der Handzählung an der Einsprache (Entwurf Block 5, «Handzählung an
 * der Einsprache»), nur wo L3 gilt. Vor der Laien- und Fachprüfung; geändert
 * werden sie danach nur in Claude Code. Die Zählhilfe mit den Namen baut der
 * Aufrufer aus `einspracheZaehlhilfe` (sie braucht die Momentaufnahme).
 */
// Laienprüfung Block 5, L5-13: dass bei Handzeichen zweimal gezählt wird,
// schon auf der Karte, nicht erst beim Zählen.
const HANDZEICHEN_SATZ =
	'Stimmen Sie mit Handzeichen ab, zählen Sie dieselben Hände zweimal, je Eigentümer und je Einheit. ' +
	// Laienprüfung Runde 2, R2-2: was die Leitung danach verkündet.
	'Verkünden Sie das Ergebnis nach Ihrer Einstellung und nennen Sie das andere dazu; beide stehen im ' +
	'Protokoll.';

export function einspracheHandzaehlungTexte(wahl: Einsprachewahl): {
	ueberschrift: string;
	erklaerung: string;
	feldEigentuemer: string;
	feldEinheit: string;
	zusatz: string;
	/** Die Absage, wenn die zweite Zählung fehlt, obwohl sie Pflicht ist. */
	absage: string;
} {
	const eingestellt = wahl === 'je_eigentuemer' ? 'jeder Eigentümer' : 'jede Einheit';
	const andere = wahl === 'je_eigentuemer' ? 'je Einheit' : 'je Eigentümer';
	// Laien- und Fachprüfung Block 5: nicht «jede Hand eine Stimme», denn
	// Vollmachten und gemeinsames Eigentum zählen anders (Fach F5-4, Rz. 181 ad
	// Art. 712m; Laien L5-2); einmal abstimmen, zweimal zählen (L5-3); was eine
	// Stimme je Einheit ist (L5-5).
	return {
		ueberschrift: 'Bei der Einsprache zweimal zählen',
		erklaerung:
			'Ihre Gemeinschaft zählt je Einheit. Bei der Einsprache hat nach Ihrer Einstellung ' +
			`${eingestellt} eine Stimme. Votum zeigt nach dem Schliessen auch das Ergebnis nach der ` +
			'anderen Zählweise. Lassen Sie deshalb nur einmal abstimmen und zählen ' +
			// Fachprüfung Runde 2, R2-1 (Vollmachten des Betroffenen, Rz. 185 ad
			// Art. 712c); Laien R2-4 mit Rz. 28 ad Art. 712o (uneinig).
			'Sie dieselben Hände zweimal. Wer eine Vollmacht hat, zählt in beiden Zählungen auch für ' +
			'die Vertretenen, ausser wer verkauft, vermietet oder belastet: Seine Vollmachten zählen hier ' +
			// Laienprüfung Runde 3, R3-3: was «wie eine Enthaltung» im Saal heisst.
			'nicht. Sind sich gemeinsame Eigentümer einer Einheit nicht einig, zählt ihre Stimme wie eine ' +
			'Enthaltung und wirkt damit wie ein Nein; bitten Sie sie, sich vorher zu einigen. ' +
			// A5, Punkt 9 (Entscheid 0029): Eine Partei hat eine Hand, nicht eine je Person.
			'Mehrere Personen derselben Partei, etwa ein Ehepaar mit einer Wohnung, zählen zusammen einmal.',
		feldEigentuemer:
			'Je Eigentümer: jeder Eigentümer eine Stimme, Eigentümer einer gemeinsamen Einheit zusammen eine',
		feldEinheit:
			'Je Einheit: jede Einheit mit Stimme nach dem Reglement eine Stimme, Einstellplätze oft keine',
		zusatz: 'gilt nach Ihrer Einstellung',
		absage:
			`Tragen Sie auch die Zählung ${andere} ein. Anwesend sind Eigentümer, die je Einheit ` +
			'nicht genau eine Stimme haben; die beiden Zählungen können deshalb auseinandergehen.'
	};
}

/** Der Vorsatz der Absage, vor der Liste der Namen (`einspracheZaehlhilfe`). */
export const EINSPRACHE_ZAEHLHILFE_VORSATZ =
	// Laienprüfung Block 5, L5-4: mit der Zahl, und ohne «mehr oder weniger als
	// eine Stimme je Einheit», das wörtlich jeder Partei zutrifft.
	'Bei der Zählung je Einheit zählen diese Anwesenden nicht einfach einmal: ';

/** Der Vorsatz je Zählung, vor der Liste der Hände (A5, Punkt 9; `einspracheHaende`). */
export function einspracheHaendeVorsatz(zaehlung: Einsprachewahl): string {
	return zaehlung === 'je_einheit'
		? EINSPRACHE_ZAEHLHILFE_VORSATZ
		: 'Bei der Zählung je Eigentümer zählen diese Anwesenden nicht einfach einmal: ';
}

/** Wer die Lesarten umstellen darf (Migration 169, `stweg.reading_changer`). */
export type Lesartenrecht = 'verwaltung' | 'verwaltung_und_leitung';

export const LESARTENRECHT_VORGABE: Lesartenrecht = 'verwaltung';

export const LESARTENRECHT_IN_WORTEN: Readonly<Record<Lesartenrecht, string>> = {
	verwaltung: 'Nur die Verwaltung',
	verwaltung_und_leitung: 'Verwaltung und Sitzungsleitung'
};

export function lesartVon(kennung: string): Lesart | undefined {
	return LESARTEN.find((l) => l.kennung === kennung);
}

/** Die Wahl in Worten, «(Vorgabe)» angehängt, wo sie es ist. */
export function wahlInWorten(kennung: string, wert: string): string {
	const lesart = lesartVon(kennung);
	const wahl = lesart?.wahlen.find((w) => w.wert === wert);
	if (!lesart || !wahl) return wert;
	return wert === lesart.vorgabe ? `${wahl.bezeichnung} (Vorgabe)` : wahl.bezeichnung;
}

/**
 * Darf diese Rolle die Lesarten umstellen?
 *
 * Die Verwaltung immer; die Sitzungsleitung nur, wenn die Gemeinschaft es
 * erlaubt. **Nur die Lesarten:** Wer umstellen darf und die
 * Universalversammlung ändert allein die Verwaltung, über die
 * Reglementsseite und den Pfadwächter (`rollen.ts`).
 */
export function darfLesartenUmstellen(rolle: Rolle | null | undefined, recht: Lesartenrecht): boolean {
	if (rolle === 'admin') return true;
	return rolle === 'chair' && recht === 'verwaltung_und_leitung';
}

/**
 * Prüft eine Eingabe gegen den Katalog. Was fehlt, bleibt `undefined` und
 * damit, wie es war; ein unbekannter Wert wirft.
 */
export function pruefeLesartenwahl(eingabe: Record<string, unknown>): Partial<Lesartenwahl> {
	const aus: Partial<Lesartenwahl> = {};
	for (const lesart of LESARTEN) {
		const wert = eingabe[lesart.kennung];
		if (wert === undefined || wert === null || wert === '') continue;
		if (typeof wert !== 'string' || !lesart.wahlen.some((w) => w.wert === wert)) {
			throw new Error(`Unbekannte Wahl «${String(wert)}» für die Lesart ${lesart.kennung}.`);
		}
		(aus as Record<string, string>)[lesart.kennung] = wert;
	}
	return aus;
}

export function pruefeLesartenrecht(wert: unknown): Lesartenrecht {
	if (wert === 'verwaltung' || wert === 'verwaltung_und_leitung') return wert;
	throw new Error(`Unbekannte Angabe «${String(wert)}» dazu, wer die Lesarten umstellt.`);
}

// ── Am Erfordernis ─────────────────────────────────────────────────────────

/** Was eine Wahl an der Rechnung bestimmt. */
export interface Lesartmehr {
	wahl: string;
	typ: Ergebnistyp;
	rechtsgrundlage: string;
	kopfbasis: Kopfbasis;
	quotenbasis: Quotenbasis;
	kopfSchwelle: Schwelle | null;
	quotenSchwelle: Schwelle | null;
	/**
	 * Wie die Enthaltungen in diesem Mehr zählen, wenn es eigens gebildet wurde
	 * (`mitEinstellung` in `reglement.ts`): `null` heisst «zählen mit». Fehlt
	 * das Feld, ist es nie eigens gebildet worden, und das zweite Ergebnis
	 * übernimmt die Angabe des Erfordernisses.
	 */
	enthaltungZaehltMit?: boolean | null;
}

/**
 * Die Lesart, nach der ein Erfordernis gebildet ist, als Teil des Nachweises
 * (AD-4): Kennung, die angewandte Wahl, ob sie die Vorgabe ist, und was die
 * andere verlangt. Mit `andere` lässt sich das zweite Ergebnis ohne Regelwerk
 * nachrechnen.
 */
export interface AngewandteLesart {
	kennung: LesartKennung;
	wahl: string;
	vorgabe: boolean;
	andere: Lesartmehr;
}

/** Die Felder eines Erfordernisses, die eine Lesart liest und setzt. */
export interface ErfordernisMitLesart {
	typ: Ergebnistyp;
	rechtsgrundlage: string;
	kopfbasis: Kopfbasis;
	quotenbasis: Quotenbasis;
	kopfSchwelle: Schwelle | null;
	quotenSchwelle: Schwelle | null;
	quelle: string;
	enthaltungZaehltMit?: boolean;
	gemeinschaftslesart?: AngewandteLesart;
	/** Die Fassung, für L13 (`kopfzaehlweiseBetrifft`). */
	fassung?: string;
	/** Die Wahl zu L13 (Migration 192), wo L13 das Erfordernis betrifft. */
	kopfzaehlweise?: Kopfzaehlweise;
}

/**
 * Der Knoten so, wie er nach der eingestellten Lesart rechnet, für die
 * Ergebniskarte der Herleitung (Review DeepSeek, B1). Ohne Lesart oder nach
 * der Wahl, die der Knoten rechnet (`wahlDesKnotens`), der Knoten selbst; ob
 * diese Wahl die Vorgabe ist, spielt keine Rolle (Entscheid 0048, Block A).
 * Sonst tauschen Mehr, Bezugsgrössen und Rechtsgrundlage, wie `wendeLesartAn`
 * es am Erfordernis tut, und eine unbekannte Wahl wirft wie dort. Die
 * knoteneigene Formel fällt weg, weil sie das Mehr des Knotens beschreibt;
 * trägt die andere Wahl eine eigene
 * (`andere.formel`, E1 L12), steht diese. Den Hinweis zum Wortlaut bestimmt die neue
 * Rechtsgrundlage (Codeprüfung, Befund 1: `pruefeRegelwerk` verlangt ihn für
 * Art. 647b). Der getauschte Baum muss `pruefeRegelwerk` bestehen (Test).
 */
export function knotenNachLesart(rw: Regelwerk, k: Ergebnisknoten, wahlen: Lesartenwahl): Ergebnisknoten {
	return knotenNachZaehlweise(rw, knotenNachMehrlesart(rw, k, wahlen), wahlen.L13);
}

/**
 * Der Knoten nach der Wahl zu L13, für die Ergebniskarte (Block C): Wo L13 nach
 * `kopfzaehlweiseBetrifft` wirken kann und die Gemeinschaft «Alle Eigentümer»
 * eingestellt hat, zählt der Knoten die Köpfe aller Eigentümer. Bezugsgrösse,
 * Zahlenbeispiel und Hinweis zum Wortlaut (Fassung 4c, `ergebniskarte`) folgen
 * der Kopfbasis; die Formel des Typs nennt die Anwesenden und weicht der
 * Formel der Fassung für alle Eigentümer (`formelAlleEigentuemer`), wie
 * `pruefeRegelwerk` es an jedem Knoten mit anderer Kopfbasis verlangt.
 *
 * **Ohne die Enthaltungsklausel**: Die kennt der Knoten nicht. Wendet Votum sie
 * an, ruft die Seite diese Funktion mit «Anwesende und Vertretene» auf
 * (`zaehlweiseFuerKarte` in `reglement.ts`); die Karte sagt dann die Sätze aus
 * Abschnitt 6 der Endfassung.
 */
export function knotenNachZaehlweise(
	rw: Regelwerk,
	k: Ergebnisknoten,
	wahl: Kopfzaehlweise | undefined
): Ergebnisknoten {
	if (wahl !== 'alle') return k;
	if (!kopfzaehlweiseBetrifft({ ...k, fassung: rw.fassung, quelle: undefined })) return k;
	if (k.kopfbasis !== 'anwesend_vertreten') return k;
	const formel = rw.formelAlleEigentuemer?.[k.typ];
	if (!formel) throw new Error(`Fassung ${rw.fassung}: Für «${k.typ}» fehlt die Formel unter allen Eigentümern.`);
	return { ...k, kopfbasis: 'alle_eigentuemer', formel };
}

function knotenNachMehrlesart(rw: Regelwerk, k: Ergebnisknoten, wahlen: Lesartenwahl): Ergebnisknoten {
	const l = k.lesart;
	if (!l) return k;
	const gewaehlt = wahlen[l.kennung];
	if (gewaehlt === wahlDesKnotens(k)) return k;
	if (gewaehlt !== l.andere.wahl) {
		throw new Error(`Lesart ${l.kennung}: Die Wahl «${gewaehlt}» kennt der Knoten «${k.id}» nicht.`);
	}
	const { formel: _formel, wortlautAbweichung: _wortlaut, ...ohne } = k;
	void _formel;
	void _wortlaut;
	const wortlaut = rw.wortlautArtikel.some((a) => l.andere.rechtsgrundlage.startsWith(a));
	return {
		...ohne,
		typ: l.andere.typ,
		rechtsgrundlage: l.andere.rechtsgrundlage,
		kopfbasis: l.andere.kopfbasis,
		quotenbasis: l.andere.quotenbasis,
		/*
		 * Der Rang sagt, was das gerechnete Erfordernis trägt (Lesart L6,
		 * Fassung 2026-11-05): Wählt die Gemeinschaft an einer Reglementskarte
		 * das Gesetz, trägt es das Gesetz. `pruefeRegelwerk` hält Rang und
		 * Rechtsgrundlage auch im getauschten Baum gleich.
		 */
		...(k.rang === 'reglement' && !l.andere.rechtsgrundlage.startsWith('Reglement') ? { rang: 'gesetz' as const } : {}),
		// Der eigene Weg der anderen Wahl, wo sie einen trägt (L6, R2-G-3).
		...(l.andere.einstimmigkeitsweg ? { einstimmigkeitsweg: l.andere.einstimmigkeitsweg } : {}),
		// Die eigene Formel der anderen Wahl, wo die des Typs ihr widerspräche (E1, L12).
		...(l.andere.formel ? { formel: l.andere.formel } : {}),
		// Hinweise, die nach der anderen Wahl anders lauten (E1, L9; Fachprüfung F-3).
		// Die Schlüssel unter `hinweiseUnterRegel` ziehen mit, sonst zeigten sie auf
		// Hinweise, die der getauschte Knoten nicht trägt (`pruefeRegelwerk`).
		...(l.andere.hinweisErsatz
			? {
					hinweise: (k.hinweise ?? []).map(
						(h) => l.andere.hinweisErsatz!.find((x) => x.alt === h)?.neu ?? h
					),
					...(k.hinweiseUnterRegel
						? {
								hinweiseUnterRegel: k.hinweiseUnterRegel.map((u) => {
									const neu = l.andere.hinweisErsatz!.find((x) => x.alt === u.hinweis)?.neu;
									return neu ? { ...u, hinweis: neu } : u;
								})
							}
						: {})
				}
			: {}),
		...(wortlaut ? { wortlautAbweichung: true } : {})
	};
}

/**
 * Die Wahl des Katalogs, deren Mehr dieses Mehr ist (verglichen werden Typ und
 * die beiden Bezugsgrössen, wie in `pruefeLesartenImRegelwerk`), oder
 * `undefined`, wenn keine oder mehr als eine passt.
 */
export function wahlNachMehr(kennung: string, mehr: Wahlmehr): string | undefined {
	const passend = (lesartVon(kennung)?.wahlen ?? []).filter((w) => w.mehr && gleichesMehr(mehr, w.mehr));
	return passend.length === 1 ? passend[0].wert : undefined;
}

/**
 * Welche Wahl rechnet dieser Knoten? Die Wahl des Katalogs, deren Mehr dem
 * Mehr des Knotens gleicht (Entscheid 0048, Block A).
 *
 * **Am Knoten, nicht an der Vorgabe des Katalogs.** Bis Block A verglich
 * `knotenNachLesart` die Wahl der Gemeinschaft mit der Vorgabe. Das trug nur,
 * solange jeder Knoten jeder Fassung die Vorgabe rechnet. Stellt eine Fassung
 * die Vorgabe um (bei L4 auf «qualifiziert»), rechnet der Knoten einer
 * früheren Fassung weiter das einfache Mehr, und `andere` heisst dort
 * «qualifiziert»: Die Wahl «einfach» liefe in den Fehler «kennt der Knoten
 * nicht», die Wahl «qualifiziert» gälte als Vorgabe, und der Knoten rechnete
 * still einfach.
 *
 * **Wirft, statt zu raten**, wenn keine oder mehr als eine Wahl passt: Ein
 * Knoten, dessen Mehr der Katalog keiner Wahl zuschreibt, ist ein Fehler der
 * Fassung, und `pruefeLesartenImRegelwerk` meldet ihn an jeder Fassung.
 */
export function wahlDesKnotens(k: Ergebnisknoten): string {
	const l = k.lesart;
	if (!l) throw new Error(`Der Knoten «${k.id}» trägt keine Lesart.`);
	const wahl = wahlNachMehr(l.kennung, k);
	if (wahl === undefined) {
		throw new Error(
			`Lesart ${l.kennung}: Der Knoten «${k.id}» rechnet nicht genau eine Wahl des Katalogs.`
		);
	}
	return wahl;
}

/** Das gespeicherte Mehr eines Traktandums, wie es aus der Datenbank kommt. */
export interface GespeichertesMehr {
	/** `requirement_type` */
	typ: string | null;
	/** `requirement_head_base` */
	kopfbasis: string | null;
	/** `requirement_quota_base` */
	quotenbasis: string | null;
}

/**
 * Welche Wahl rechnet ein Traktandum, das keine Wahl gespeichert hat? Gefragt
 * von der Freigabe und vom Kasten «Erfordernisse nachziehen»
 * (`server/freigabe.ts`, `server/reglement.ts`), die beide dieselbe Antwort
 * geben müssen, sonst nennte die Absage der Freigabe einen Weg, den es nicht
 * gibt.
 *
 * Ein solches Traktandum stammt aus einer Fassung, deren Knoten die Lesart
 * noch nicht trug (L2 hängt an einem Knoten, den es vorher gab). Es rechnet,
 * was der Knoten **seiner** Fassung rechnet (`knotenDerFassung` in `rules/`);
 * gibt es ihn nicht, was das gespeicherte Mehr sagt. Nicht die Vorgabe des
 * Katalogs: Die gilt für die aktuelle Fassung und kann wechseln (Entscheid
 * 0048, Block A). Der Knoten vor dem gespeicherten Mehr, weil das
 * gespeicherte Mehr eines Traktandums unter einer früheren Regel des
 * Reglements sonst womöglich zufällig einer Wahl gliche. An sechs frühen
 * Fassungen rechnet der Knoten ohne Lesart die andere Wahl als die Vorgabe
 * (`k-zustaendigkeit-gewoehnlich` 2026-08-16, 09-21, 09-22;
 * `k-prozessfuehrung` 2026-07-30, 08-05, 08-15); dort antwortet die Funktion
 * anders als der Code bis Block A, der solche Traktanden fälschlich als
 * Vorgabe nahm (Test `lesart-am-knoten`; auf Dev und Prod am 13.11.2026 kein
 * solches Traktandum).
 *
 * `undefined`, wenn sich keine Wahl bestimmen lässt. Beide Aufrufer behandeln
 * das wie eine andere Wahl als die der Gemeinschaft: Das Traktandum erscheint
 * im Kasten, und die Freigabe sagt ab, bis es nachgezogen ist.
 */
export function wahlOhneGespeicherte(
	kennung: string,
	knotenDerFassung: Ergebnisknoten | undefined,
	gespeichert: GespeichertesMehr
): string | undefined {
	if (knotenDerFassung) return wahlNachMehr(kennung, knotenDerFassung);
	if (!gespeichert.typ || !gespeichert.kopfbasis || !gespeichert.quotenbasis) return undefined;
	// Die Zeichenketten aus der Datenbank; eine fremde trifft keine Wahl.
	return wahlNachMehr(kennung, gespeichert as Wahlmehr);
}

/**
 * Die Lesart eines Knotens, wie sie beim Herleiten ans Erfordernis geht: nach
 * der Wahl, die der Knoten rechnet (`wahlDesKnotens`), mit der anderen Wahl
 * daneben. Die Schwellen der anderen kommen aus der Typdefinition derselben
 * Fassung. `vorgabe` sagt, ob diese Wahl die Vorgabe des Katalogs ist; das
 * ist Herkunft für Karte und Protokoll, nicht Rechnung.
 */
export function lesartAusKnoten(rw: Regelwerk, k: Ergebnisknoten): AngewandteLesart | undefined {
	const l = k.lesart;
	if (!l) return undefined;
	const lesart = lesartVon(l.kennung);
	if (!lesart) throw new Error(`Der Knoten nennt die unbekannte Lesart «${l.kennung}».`);
	const def = rw.ergebnistypen.find((t) => t.typ === l.andere.typ);
	if (!def) throw new Error(`Lesart ${l.kennung}: Typ «${l.andere.typ}» fehlt in der Fassung.`);
	const wahl = wahlDesKnotens(k);
	return {
		kennung: lesart.kennung,
		wahl,
		vorgabe: wahl === lesart.vorgabe,
		andere: {
			wahl: l.andere.wahl,
			typ: l.andere.typ,
			rechtsgrundlage: l.andere.rechtsgrundlage,
			kopfbasis: l.andere.kopfbasis,
			quotenbasis: l.andere.quotenbasis,
			kopfSchwelle: def.schwellen.kopf,
			quotenSchwelle: def.schwellen.quoten
		}
	};
}

function mehrVon(e: ErfordernisMitLesart, wahl: string): Lesartmehr {
	return {
		wahl,
		typ: e.typ,
		rechtsgrundlage: e.rechtsgrundlage,
		kopfbasis: e.kopfbasis,
		quotenbasis: e.quotenbasis,
		kopfSchwelle: e.kopfSchwelle,
		quotenSchwelle: e.quotenSchwelle
	};
}

/**
 * Bildet das Erfordernis nach der Wahl der Gemeinschaft.
 *
 * Trägt das Erfordernis keine Lesart, bleibt es, wie es ist. Steht die Wahl
 * auf der anderen Seite, tauschen Erfordernis und `andere` die Rolle; so steht
 * im Nachweis immer, was gerechnet wurde und was die andere Lesart verlangt
 * hätte.
 *
 * **Nur am hergeleiteten oder am Knoten gewählten Erfordernis.** Ersetzt eine
 * Regel des Reglements das Mehr (`quelle === 'reglement'`), fällt die Lesart
 * weg: Das Reglement ist eine Tatsache der Gemeinschaft und geht vor
 * (Konzept, Abschnitt 1). Dafür sorgt `wendeReglementAn`.
 */
export function wendeLesartAn<E extends ErfordernisMitLesart>(e: E, wahlen: Lesartenwahl): E {
	const l = e.gemeinschaftslesart;
	if (!l) return e;
	const gewaehlt = wahlen[l.kennung];
	if (gewaehlt === l.wahl) return e;
	if (gewaehlt !== l.andere.wahl) {
		throw new Error(`Lesart ${l.kennung}: Die Wahl «${gewaehlt}» kennt dieses Erfordernis nicht.`);
	}
	const vorgabe = lesartVon(l.kennung)?.vorgabe;
	// Wurde das andere Mehr schon eigens gebildet, tauschen auch die Enthaltungen.
	const enthaltung =
		l.andere.enthaltungZaehltMit === undefined
			? {}
			: { enthaltungZaehltMit: l.andere.enthaltungZaehltMit ?? undefined };
	const getauscht: E = {
		...e,
		...enthaltung,
		typ: l.andere.typ,
		rechtsgrundlage: l.andere.rechtsgrundlage,
		kopfbasis: l.andere.kopfbasis,
		quotenbasis: l.andere.quotenbasis,
		kopfSchwelle: l.andere.kopfSchwelle,
		quotenSchwelle: l.andere.quotenSchwelle,
		gemeinschaftslesart: {
			kennung: l.kennung,
			wahl: gewaehlt,
			vorgabe: gewaehlt === vorgabe,
			andere: {
				...mehrVon(e, l.wahl),
				...(l.andere.enthaltungZaehltMit === undefined
					? {}
					: { enthaltungZaehltMit: e.enthaltungZaehltMit ?? null })
			}
		}
	};
	/*
	 * **L13 bleibt, wo sie schon angewandt ist** (Block C): Die andere Wahl setzt
	 * die Kopfbasis aus `l.andere`, und die Zählweise der Köpfe fiele still weg.
	 * Beim Herleiten kommt L13 erst nach dieser Funktion (`wendeReglementAn`);
	 * hier nur, wo das Erfordernis sie schon trägt.
	 */
	return e.kopfzaehlweise ? mitKopfzaehlweise(getauscht, gerechneteKopfzaehlweise(e)) : getauscht;
}

/**
 * Die Wahl zu L13, die ein Erfordernis weitergibt: wo L13 wirkt, die seines
 * Mehrs; sonst die eingestellte (etwa unter der Enthaltungsklausel, wo das
 * andere Mehr nach L2 sie wieder trägt).
 */
function gerechneteKopfzaehlweise(e: ErfordernisMitLesart): Kopfzaehlweise | undefined {
	return kopfzaehlweiseWirkt(e) ? kopfzaehlweiseDesMehrs(e) : e.kopfzaehlweise;
}

/**
 * Das Erfordernis nach der anderen Lesart, für das zweite Ergebnis, oder
 * `null` ohne Lesart. Alles ausser dem Mehr bleibt. **Die Enthaltungen nur,
 * wenn das andere Mehr nicht eigens gebildet wurde:** Die Einstellung der
 * Gemeinschaft wirkt allein beim einfachen Mehr der Anwesenden und wird für
 * das andere Mehr in `mitEinstellung` eigens angewandt.
 */
export function erfordernisNachAndererLesart<E extends ErfordernisMitLesart>(e: E): E | null {
	const l = e.gemeinschaftslesart;
	if (!l) return null;
	const enthaltung =
		l.andere.enthaltungZaehltMit === undefined
			? { enthaltungZaehltMit: e.enthaltungZaehltMit }
			: { enthaltungZaehltMit: l.andere.enthaltungZaehltMit ?? undefined };
	const anderes: E = {
		...e,
		...enthaltung,
		typ: l.andere.typ,
		rechtsgrundlage: l.andere.rechtsgrundlage,
		kopfbasis: l.andere.kopfbasis,
		quotenbasis: l.andere.quotenbasis,
		kopfSchwelle: l.andere.kopfSchwelle,
		quotenSchwelle: l.andere.quotenSchwelle,
		gemeinschaftslesart: undefined
	};
	/*
	 * **Das zweite Ergebnis nach L2, L4 oder L11 behält die Zählweise der Köpfe**
	 * (Block C, Akzeptanzkriterium 3; Landkarte, «heikelste Stelle»): `l.andere`
	 * nennt die Kopfbasis des Knotens, die der Anwesenden. Ohne diese Zeile
	 * rechnete das zweite Ergebnis unter «Alle Eigentümer» still unter den
	 * Anwesenden. L13 wirkt am anderen Mehr nur, wo seine Rechtsgrundlage sie
	 * trägt und die Enthaltungsklausel es nicht verdrängt.
	 */
	return e.kopfzaehlweise ? mitKopfzaehlweise(anderes, gerechneteKopfzaehlweise(e)) : anderes;
}

/**
 * Prüft die Lesarten eines Regelwerks gegen den Katalog: bekannte Kennung, der
 * Knoten rechnet genau eine Wahl des Katalogs (`wahlDesKnotens`), die andere
 * Wahl ist eine andere als diese und steht im Katalog, `andere` rechnet das
 * Mehr, das der Katalog ihr zuschreibt, und jedes `alt` eines `hinweisErsatz`
 * steht genau einmal unter den Hinweisen. Gerufen aus den Proben der
 * Fassungen; `pruefeRegelwerk` kann den Katalog nicht einbinden, ohne einen
 * Ring zu schliessen.
 *
 * **Die Vorgabe nur an der aktuellen Fassung** (Entscheid 0048, Block A). Dass
 * der Knoten die Vorgabe rechnet und `andere` nicht die Vorgabe ist, hält die
 * Pendenz aus Block 1 fest (Review DeepSeek: eine Fassung mit vertauschter
 * Vorgabe blieb grün). An einer früheren Fassung gilt das nicht mehr, sobald
 * eine spätere die Vorgabe umstellt: Ihre Knoten rechnen dann richtig die
 * frühere Vorgabe. Deshalb nennt der Aufrufer die aktuelle Fassung
 * (`AKTUELLE_FASSUNG`); der Kern kann `rules/` nicht einbinden.
 */
export function pruefeLesartenImRegelwerk(rw: Regelwerk, aktuelleFassung: string): string[] {
	const befunde: string[] = [];
	const aktuell = rw.fassung === aktuelleFassung;
	for (const k of rw.knoten) {
		if (!k.lesart) continue;
		const lesart = lesartVon(k.lesart.kennung);
		if (!lesart) {
			befunde.push(`${k.id}: unbekannte Lesart «${k.lesart.kennung}»`);
			continue;
		}
		if (aktuell && k.lesart.andere.wahl === lesart.vorgabe) {
			befunde.push(`${k.id}: Die andere Wahl ist die Vorgabe; der Knoten muss nach der Vorgabe rechnen.`);
		}
		if (!lesart.wahlen.some((w) => w.wert === k.lesart!.andere.wahl)) {
			befunde.push(`${k.id}: Die Wahl «${k.lesart.andere.wahl}» steht nicht im Katalog.`);
		}
		/*
		 * Ein Ersatz, dessen `alt` nicht unter den Hinweisen steht, tauscht
		 * `knotenNachLesart` still nicht; der Hinweis des Knotens stünde dann
		 * unter der anderen Wahl (Featureprüfung E1, B7).
		 */
		for (const e of k.lesart.andere.hinweisErsatz ?? []) {
			const anzahl = (k.hinweise ?? []).filter((h) => h === e.alt).length;
			if (anzahl !== 1) {
				befunde.push(
					`${k.id}: Ein Ersatzhinweis steht ${anzahl}-mal statt genau einmal unter den Hinweisen: «${e.alt.slice(0, 60)}…»`
				);
			}
		}
		if (!rw.ergebnistypen.some((t) => t.typ === k.lesart!.andere.typ)) {
			befunde.push(`${k.id}: Typ «${k.lesart.andere.typ}» fehlt in der Fassung.`);
		}
		const vorgabe = lesart.wahlen.find((w) => w.wert === lesart.vorgabe)?.mehr;
		const andere = lesart.wahlen.find((w) => w.wert === k.lesart!.andere.wahl)?.mehr;
		if (!vorgabe || !andere) {
			befunde.push(`${k.id}: Der Katalog nennt zu ${lesart.kennung} kein Mehr je Wahl.`);
			continue;
		}
		const gerechnet = wahlNachMehr(lesart.kennung, k);
		if (gerechnet === undefined) {
			befunde.push(`${k.id}: Der Knoten rechnet keine Wahl des Katalogs zu ${lesart.kennung}.`);
		} else if (gerechnet === k.lesart.andere.wahl) {
			befunde.push(`${k.id}: «andere» nennt die Wahl «${gerechnet}», die der Knoten selbst rechnet.`);
		}
		if (aktuell && !gleichesMehr(k, vorgabe)) {
			befunde.push(`${k.id}: Der Knoten rechnet nicht die Vorgabe «${lesart.vorgabe}».`);
		}
		if (!gleichesMehr(k.lesart.andere, andere)) {
			befunde.push(`${k.id}: «andere» rechnet nicht die Wahl «${k.lesart.andere.wahl}».`);
		}
	}
	return befunde;
}

function gleichesMehr(a: Wahlmehr, b: Wahlmehr): boolean {
	return a.typ === b.typ && a.kopfbasis === b.kopfbasis && a.quotenbasis === b.quotenbasis;
}
