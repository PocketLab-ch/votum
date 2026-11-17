/**
 * Die Auszählmappe für den Totalausfall — rein, ohne Ablage und ohne Uhr (AD-1).
 *
 * **Wofür.** Fällt der Server aus, wird auf Papier abgestimmt. Beim einfachen
 * Mehr genügt Handzählen; sobald aber **Wertquoten** entscheiden oder die
 * Abwesenden in die Bezugsgrösse gehören, ist eine Zählung im Kopf keine
 * Zählung mehr, sondern eine Schätzung. Gewünscht am 20.08.2026: «Excel für die
 * Abstimmungen im qualifizierten Mehr. Matrix mit Eigentümer vertikal und
 * Traktanden Quali.Mehr horizontal. Dann mit 1 für Ja, 2 Enthaltung 3 für Nein.
 * So kann man dann schnell im Excel tippen und berechnen.»
 *
 * **Die Mappe rechnet, wie die Anwendung rechnet.** Die Formeln bilden
 * `zaehleAus` nach, Zeile für Zeile: dieselbe Bezugsgrösse, dieselbe Schwelle,
 * dieselbe Rundung. Eine Mappe, die «ungefähr so» rechnet, wäre schlimmer als
 * keine — sie sähe aus wie ein Beleg.
 *
 *   - Kopfstimmen: Ja + Nein + Enthaltung + nicht abgegeben, dazu die
 *     Abwesenden, wenn die Kopfbasis nicht `anwesend_vertreten` ist.
 *   - Wertquoten: bei `alle_quoten` nach der Vorgabe von L1 die **ganze**
 *     Gemeinschaftsquote, auch wenn jemand im Ausstand ist; nach «fällt heraus»
 *     ohne die Quoten mit 9 (`ausstandFaelltHeraus`, Migration 170). Sonst die
 *     Quoten der Anwesenden.
 *   - Schwelle: `mehr als` → `INT(basis·z/n)+1`, `mindestens` → `CEILING(…)`.
 *
 * **Jede Rechnung, die die Karte ankündigt** (A3, 30.10.2026): Zu jedem
 * zweiten Ergebnis des Kerns (L1 bis L4, L6, 1a, Mehr aus Gesetz und Reglement,
 * `vergleicheZu`) und zu L5 trägt die Mappe eine Spalte «zum Vergleich», die
 * dieselben Stimmen nach der anderen Rechnung zählt. Den Stichentscheid nach
 * Wertquoten rechnet sie selbst, und für ein neues Traktandum der zweiten
 * Versammlung die Beschlussfähigkeit einer ersten.
 *
 * **Was sie nicht kann**, steht im Blatt selbst und nicht nur hier: geheime
 * Abstimmungen (der Zettel trägt den Namen), den Entscheid einer Person bei
 * Gleichstand, die Zustimmung unmittelbar Betroffener als eigene Bedingung, und
 * die Zählung je Einheit, wenn eine Partei ihre Einheiten verschieden stimmen
 * lässt. Wer das braucht, hält es fest und trägt es nach, sobald der Server
 * wieder da ist.
 */
import type { Kopfbasis, Quotenbasis } from './regelwerk';
import { nurNachWertquoten, type Schwelle } from './mehrheit';
import type { HeadCountMode, Snapshot, Stichentscheid } from './types';
import {
	ausstandslesartSatz,
	lesartVon,
	wahlInWorten,
	type Ausstandswahl,
	type Einsprachewahl,
	type Neutraktandenwahl
} from './lesarten';
import { personenstufe, quotenstufe } from './gemeinschaft';
import {
	GESETZLICH,
	stelleBeschlussfaehigkeitFest,
	type Beschlussfaehigkeitsregel
} from './beschlussfaehigkeit';
import {
	AUSSCHLUSSKLAGE_KNOTEN,
	ausstandBleibtInDerZahl,
	ausstandBleibtUnterAllen,
	beklagtenwohnungZaehltMit,
	betroffeneStimmenNichtMit,
	zaehlweiseFuer,
	type Erfordernis
} from './entscheidbaum';
import {
	ausstandFaelltAusDemNenner,
	stichentscheidMoeglich,
	vergleicheZu,
	vollmachtenBetroffenerZaehlenNicht
} from './auszaehlung';
import { spaltenname, type Blatt, type Zelle } from './xlsx';

/**
 * Der Satz der Anleitung zur 9, wo eine Hauptspalte die Köpfe unter allen
 * Eigentümern zählt (`ausstandNachZaehlweise`): unter L13 «Alle Eigentümer» und
 * ab der Fassung 2026-11-16 unter einer von Hand gesetzten Kopfbasis «aller
 * Eigentümer» (Entscheid 0050, Antwort 1). Endwortlaut T7a der Textrunde zu den
 * Pendenzen nach Regel 43 (`quellen`
 * `pruefung/zu-pruefen-2026-11-14-votum-pendenzen-textrunde-endfassung.md`; R3-L-1,
 * R3-F-1: «Wer im Ausstand ist» statt «Die Partei», weil der Beklagte und die
 * Betroffenen mit ihrer 9 weiter herausfallen).
 */
export const MAPPE_NEUN_UNTER_ALLEN =
	'Setzen Sie die 9 auch dort, wo die Köpfe unter allen Eigentümern zählen, nach der Einstellung Ihrer ' +
	'Gemeinschaft oder weil die Sitzungsleitung das Mehr so gesetzt hat. Wer im Ausstand ist, bleibt dann ' +
	'in der Zahl aller Eigentümer und wirkt wie ein Nein. Die Mappe weiss, bei welchen Traktanden das ' +
	'gilt, und rechnet es selbst.';

export interface Mappenpartei {
	name: string;
	/** Kopfstimmen dieser Partei nach der Zählweise der Gemeinschaft. */
	kopfstimmen: number;
	/**
	 * Kopfstimmen dieser Partei bei der Zählung je Eigentümer: 1, wenn sie
	 * Einheiten hat, sonst 0. Nur gebraucht, wo ein Posten je Eigentümer zählt
	 * (L3, die Einsprache in einer Gemeinschaft je Einheit).
	 */
	kopfstimmenJeEigentuemer?: number;
	wertquote: number;
}

export interface Mappenposten {
	nummer: string;
	titel: string;
	/** Der Titel des Erfordernisses, etwa «Qualifiziertes Mehr». */
	erfordernis: string;
	kopfbasis: Kopfbasis;
	/** `null`: Die Köpfe zählen nicht, es zählt nur die Wertquotenschwelle (16.11.2026). */
	kopfSchwelle: Schwelle | null;
	quotenbasis: Quotenbasis;
	quotenSchwelle: Schwelle | null;
	/**
	 * Ob Enthaltungen in der Bezugsgrösse bleiben (04.09.2026).
	 *
	 * **Die Mappe ist ein zweiter Rechenweg**: Sie legt Formeln ins Blatt, die
	 * eine Tabellenkalkulation rechnet, nicht dieser Code. Was in `zaehleAus`
	 * die Bezugsgrösse verändert, muss deshalb hier mitwandern, sonst verkündet
	 * die Anwendung das eine und die ausgedruckte Mappe das andere, und beide
	 * Zahlen sehen amtlich aus.
	 *
	 * `undefined` heisst «zählt mit», wie am Erfordernis.
	 */
	enthaltungZaehltMit?: boolean;
	/**
	 * Ob Betroffene hier nicht mitstimmen, obwohl die Kopfbasis das nicht sagt
	 * (29.09.2026): der Beklagte der Ausschlussklage unter einer angewandten
	 * Klausel «der Anwesenden». Die Aufrufer setzen es aus
	 * `betroffeneStimmenNichtMit`; von Hand gezählt würde er sonst mitgezählt.
	 */
	ohneBetroffene?: boolean;
	/**
	 * Die Vollmachten der Betroffenen zählen nicht (Einsprache, Ausschlussklage;
	 * `vollmachtenBetroffenerZaehlenNicht`). Steuert die Legende der 8.
	 */
	vollmachtenBetroffenerZaehlenNicht?: boolean;
	/**
	 * Ob eine Wohnung, die dem Beklagten mit anderen gehört, in der
	 * Bezugsgrösse bleibt (Fassung 2026-10-11, `beklagtenwohnungZaehltMit`).
	 * Die Mappe kennt die Betroffenen nicht; wer die 9 einträgt, nimmt die
	 * Wohnung heraus. Die Anleitung sagt deshalb, dass sie leer bleibt.
	 */
	beklagtenwohnungZaehltMit?: boolean;
	/**
	 * Ob die Wertquoten mit 9 aus dem Nenner aller Wertquoten fallen (L1 nach
	 * der Wahl «fällt heraus», `ausstandFaelltAusDemNenner`, Migration 170).
	 * Fehlt es, bleibt der Nenner die ganze Gemeinschaftsquote, wie bisher.
	 */
	ausstandFaelltHeraus?: boolean;
	/**
	 * Ob Parteien im Ausstand in der Zahl bleiben (1e, Ausschlussklage ab
	 * Fassung 2026-10-25, `ausstandBleibtInDerZahl`). Die Anleitung sagt dann,
	 * dass ihre Zeile leer bleibt statt 9.
	 */
	ausstandBleibtInDerZahl?: boolean;
	/**
	 * Ob die Spalte die Köpfe nach L13 «Alle Eigentümer» unter allen zählt
	 * (`ausstandBleibtNachZaehlweise`; Entscheid 0048, Antwort 9) oder unter
	 * einer von Hand gesetzten Kopfbasis «aller Eigentümer» ab der Fassung
	 * 2026-11-16 (`ausstandBleibtUnterAllen`; Entscheid 0050, Antwort 1): Wer im
	 * Ausstand ist, bleibt in der Kopfzahl. **Eingetragen wird er trotzdem mit 9**
	 * (Codeprüfung Block C, Lauf 2, M-B; Fachprüfung Nachtrag Runde 2, N2-F-4):
	 * Die Spalte lässt die 9 in der Kopfzahl, statt eine eigene Ziffer zu
	 * verlangen. Sonst müsste die Leitung je Traktandum wissen, wo die Zählweise
	 * wirkt, und eine falsche Ziffer kippte das Ergebnis ohne Anzeige.
	 */
	ausstandNachZaehlweise?: boolean;
	/**
	 * Die Spalte gehört zur Ermächtigung zur Ausschlussklage. Nur dort trägt die
	 * 7 eine eigene Bedeutung (1e, die gemeinsame Wohnung des Beklagten); in
	 * allen übrigen Spalten rechnet eine 7 wie die 9 (M-B).
	 */
	ausschlussklage?: boolean;
	/**
	 * Die Zählweise dieses Postens (L3, `zaehlweiseFuer`): an der Einsprache in
	 * einer Gemeinschaft je Einheit `per_owner`, sonst die der Gemeinschaft.
	 * Fehlt sie, zählt der Posten nach der Gemeinschaft.
	 */
	zaehlweise?: HeadCountMode;
	/**
	 * Ob ein Gleichstand der Köpfe hier durch Stichentscheid aufgelöst werden
	 * kann (`stichentscheidMoeglich` im Kern, ohne Einstimmigkeit): nur beim
	 * einfachen Mehr ohne Wertquoten (A1 Frage 1, 30.10.2026). Welche Art gilt,
	 * sagt `Mappenangaben.stichentscheid`.
	 */
	stichentscheidMoeglich?: boolean;
	/**
	 * Ob das Ergebnis die Beschlussfähigkeit einer ersten Versammlung verlangt
	 * (L5): am Traktandum nach der Vorgabe `erste`, an seinem Vergleich nach der
	 * Wahl `drittel`. Fehlt sie, steht im Ergebnis «NICHT VERBINDLICH».
	 */
	nurBeschlussfaehigWieErste?: boolean;
	/** Neu an einer zweiten Versammlung (`neueTraktandenDerZweiten`, L5). */
	neuAnZweiter?: boolean;
	/** Die zweiten Ergebnisse, je eine Spalte «zum Vergleich» (A3). */
	vergleiche?: readonly Mappenvergleich[];
	/**
	 * Zweite Ergebnisse, die sich hier nicht rechnen lassen, weil ihr Mehr keine
	 * Kopfschwelle hat, mit der anderen Wahl in Worten. Sie stehen am Fuss.
	 */
	vergleicheOhneRechnung?: readonly string[];
}

/** Was eine Spalte rechnet: der Posten ohne Beschriftung und ohne eigene Vergleiche. */
export type Mappenrechnung = Omit<
	Mappenposten,
	'nummer' | 'titel' | 'vergleiche' | 'vergleicheOhneRechnung' | 'neuAnZweiter'
>;

/**
 * Ein zweites Ergebnis als Spalte «zum Vergleich» (A3, 30.10.2026). Die Worte
 * kommen aus dem Kern (`Vergleichserfordernis`), die Rechnung aus demselben
 * anderen Erfordernis, nach dem `zaehleAus` das zweite Ergebnis rechnet.
 */
export interface Mappenvergleich {
	/** L1 bis L6, L11, L12, L17, L13, 1a oder A (Mehr aus Gesetz und Reglement); L10 rechnet die Mappe nicht. */
	kennung: string;
	/** Die andere Wahl in Worten, etwa «qualifiziert». */
	wahl: string;
	/** Was sie verlangt, in Worten. */
	verlangt: string;
	rechnung: Mappenrechnung;
}

export interface Ausgelassen {
	nummer: string;
	titel: string;
	grund: string;
}

export interface Mappenangaben {
	gemeinschaftName: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	gesamtquote: number;
	/**
	 * Die Wahl der Versammlung zu L1 (Migration 170), für den Satz am Fuss.
	 * Fehlt sie, gilt die Vorgabe. Die Formeln lesen die Wahl am Posten.
	 */
	ausstandslesart?: Ausstandswahl;
	/** Zählweise der Gemeinschaft — sie bestimmt, was in der Mappe nicht abbildbar ist. */
	jeEinheit: boolean;
	parteien: readonly Mappenpartei[];
	posten: readonly Mappenposten[];
	/** Traktanden, die nicht in die Mappe konnten — mit Grund. Stille Lücken gibt es nicht. */
	ausgelassen?: readonly Ausgelassen[];
	/** Der Stichentscheid aus der Momentaufnahme (`tieBreak`). Fehlt er, gilt `keiner`. */
	stichentscheid?: Stichentscheid;
	/**
	 * Die Regel der Beschlussfähigkeit einer ersten Versammlung, aus dem
	 * Reglement oder dem Gesetz (`GESETZLICH.erste`). Nötig, sobald ein Posten
	 * neu an der zweiten ist (L5).
	 */
	ersteVersammlung?: Beschlussfaehigkeitsregel | null;
	/** Die Wahl zu L5 aus der Momentaufnahme, für den Satz am Fuss. */
	neuAnZweiterWahl?: Neutraktandenwahl;
}

/** Was in eine Traktandumsspalte eingetragen wird. */
export const EINGABEN = {
	ja: 1,
	enthaltung: 2,
	nein: 3,
	/**
	 * Zählt bei diesem Traktandum nicht mit: im Ausstand, oder unmittelbar
	 * betroffen, wo Betroffene nicht mitstimmen (`ohneBetroffene`). Wo sie nur
	 * zustimmen müssen, stimmen sie mit; eine 9 nähme sie aus der Basis und nach
	 * L1 «fällt heraus» aus dem Nenner (Review DeepSeek Block 2, Befund 2).
	 */
	draussen: 9,
	/**
	 * Nur über eine Person im Ausstand vertreten: zählt wie abwesend (Lesarten
	 * Block 2, Laien- und Fachprüfung Runde 3). Fällt aus einer Bezugsgrösse der
	 * Anwesenden, bleibt in einer über alle, auch beim Mehr aller Wertquoten
	 * (Entscheid 0020). Mit 9 sank sonst nach «fällt heraus» der Nenner.
	 */
	vertretenImAusstand: 8,
	/**
	 * Im Ausstand, aber in der Zahl (1e, `ausstandBleibtInDerZahl`): stimmt
	 * nicht, bleibt in einer Kopfzahl über alle und beim Mehr aller Wertquoten,
	 * fällt aus einer Basis der Anwesenden und ist nicht mehr erreichbar, wie im
	 * Code (Review DeepSeek Block 2, Befunde 1 und 5). Leer zählte sie in der
	 * Quote der Anwesenden mit, 9 nähme sie aus der Kopfzahl.
	 */
	imAusstandInDerZahl: 7
} as const;

function text(wert: string, stil?: Zelle['stil']): Zelle {
	return { art: 'text', wert, stil };
}

function zahl(wert: number, stil?: Zelle['stil']): Zelle {
	return { art: 'zahl', wert, stil };
}

function formel(f: string, stil?: Zelle['stil']): Zelle {
	return { art: 'formel', formel: f, stil };
}

const LEER: Zelle = { art: 'leer' };

/**
 * Wann ein Traktandum in die Mappe gehört.
 *
 * **Nicht jedes.** Wo eine einfache Mehrheit der Anwesenden entscheidet und
 * jede Partei genau eine Kopfstimme hat, genügt Handzählen — eine Spalte dafür
 * wäre Arbeit ohne Gewinn und machte die Mappe im Saal unübersichtlich. Fünf
 * Dinge zwingen zur Rechnung:
 *
 *   - eine **Wertquotenschranke**: Quoten lassen sich nicht mit erhobenen
 *     Händen zählen;
 *   - eine **Kopfbasis, die nicht nur die Anwesenden** umfasst: dann zählen
 *     Abwesende mit, und der Saal sieht nicht mehr, wie gross die Bezugsgrösse
 *     ist;
 *   - **ungleiche Kopfstimmen**: hält eine Partei zwei Stimmen und eine andere
 *     eine, sind erhobene Hände nicht mehr die Zahl, auf die es ankommt;
 *   - **Enthaltungen, die aus der Bezugsgrösse fallen** (04.09.2026): Dann ist
 *     die Zahl der erhobenen Hände nicht mehr die Bezugsgrösse, und wer im Saal
 *     nach Köpfen zählt, misst gegen die falsche;
 *   - **jede Schwelle ausser «mehr als die Hälfte»** (04.09.2026): Zwei Drittel
 *     von dreizehn Anwesenden sind neun, und das sieht man einem Saal voller
 *     erhobener Hände nicht an.
 *
 * **Die letzten beiden Gründe kamen aus einem Prüfdurchgang.** Eine Regel, die
 * allein die Enthaltungen herausnimmt oder allein die Schwelle verschiebt,
 * sieht in den drei alten Fragen aus wie ein einfaches Mehr und fiel deshalb
 * aus der Mappe. Die Mappe ist die Unterlage für den Ausfall: Sie hätte dem
 * Saal gesagt, Handzählen genüge, und zwar genau dann, wenn niemand mehr
 * nachsehen kann. Gemessen am 04.09.2026 stand ein Zweidrittelmehr aus dem
 * Reglement als «Einfaches Mehr der Anwesenden» im Blatt.
 */
export function brauchtRechnung(
	posten: Mappenposten,
	kopfstimmenUngleich: boolean,
	stichentscheid: Stichentscheid = 'keiner'
): boolean {
	/*
	 * **Auch wegen eines Vergleichs** (A3): Rechnet ein Traktandum nach L4
	 * «einfach», genügt für sein Ergebnis Handzählen, für das zweite nach
	 * «qualifiziert» nicht. Ein neues Traktandum der zweiten Versammlung braucht
	 * die Beschlussfähigkeit einer ersten, und die zählt niemand mit Händen.
	 * Und wo bei Gleichstand die Wertquoten entscheiden (Codeprüfung A3, M2),
	 * braucht es deren Summen: Das ist der Hauptfall des Stichentscheids.
	 */
	const r = (p: Mappenrechnung) => rechnungNoetig(p, kopfstimmenUngleich, stichentscheid);
	return r(posten) || posten.neuAnZweiter === true || (posten.vergleiche ?? []).some((v) => r(v.rechnung));
}

/**
 * Wie ein Traktandum gezählt werden muss, wenn Handzählen nicht genügt:
 * `null`, wo es genügt; sonst `quote`, ob dabei die Summe der Wertquoten
 * gebraucht wird (Schranke an den Quoten oder Stichentscheid nach Wertquoten,
 * auch in einem Vergleich).
 *
 * **Für den Stimmzettel** (Codeprüfung 14.11.2026): Er teilt seine Zettel in
 * «nötig» und «Handerheben genügt» und führt im Zählblatt die Quotenspalte nur,
 * wo sie gebraucht wird. Beides folgt derselben Regel wie die Mappe, damit die
 * beiden Unterlagen dem Saal nicht Verschiedenes sagen.
 */
export function zaehlweise(
	posten: Mappenposten,
	kopfstimmenUngleich: boolean,
	stichentscheid: Stichentscheid = 'keiner'
): { quote: boolean } | null {
	if (!brauchtRechnung(posten, kopfstimmenUngleich, stichentscheid)) return null;
	const quote = (p: Mappenrechnung) =>
		p.quotenSchwelle !== null || (p.stichentscheidMoeglich === true && quotenstufe(stichentscheid));
	return { quote: quote(posten) || (posten.vergleiche ?? []).some((v) => quote(v.rechnung)) };
}

function rechnungNoetig(posten: Mappenrechnung, kopfstimmenUngleich: boolean, stichentscheid: Stichentscheid): boolean {
	return (
		(posten.stichentscheidMoeglich === true && quotenstufe(stichentscheid)) ||
		posten.quotenSchwelle !== null ||
		posten.kopfbasis !== 'anwesend_vertreten' ||
		posten.enthaltungZaehltMit === false ||
		posten.ohneBetroffene === true ||
		// Ohne Köpfe rechnet schon die Quotenschwelle oben.
		(posten.kopfSchwelle !== null && !istEinfachesMehr(posten.kopfSchwelle)) ||
		kopfstimmenUngleich
	);
}

/**
 * Ob die Schwelle die ist, die ein Saal von Hand feststellen kann.
 *
 * «Mehr als die Hälfte» sieht man an erhobenen Händen: Es sind mehr als die
 * Gegenhände. Jede andere Schwelle verlangt eine Zahl, und der Bruch wird über
 * den Nenner verglichen statt über die Zeichenkette, damit 2/4 nicht als etwas
 * anderes gilt als 1/2.
 */
function istEinfachesMehr(s: Schwelle): boolean {
	return s.art === 'mehr_als' && s.zaehler * 2 === s.nenner;
}

/** Ob die Gemeinschaft ungleiche Kopfstimmen kennt. */
export function kopfstimmenUngleich(parteien: readonly Mappenpartei[]): boolean {
	return parteien.some((p) => p.kopfstimmen !== 1);
}

/**
 * Die Schwellenformel — dieselbe Rechnung wie `schwelle()` in `mehrheit.ts`.
 *
 * `ROUND(…,6)` sitzt dort, wo die Anwendung ganzzahlig rechnet: In einer
 * Tabellenkalkulation könnte `999·1/3` statt `333` die Zahl
 * `333.00000000000006` ergeben, und `CEILING` machte daraus 334 — eine Stimme
 * mehr, als das Gesetz verlangt.
 *
 * **Mit LibreOffice tritt dieser Fall nicht ein** (05.09.2026 nachgemessen,
 * `scripts/mappe-nachrechnen.mjs`): Nimmt man `ROUND` heraus, rechnet Calc über
 * alle geprüften Lagen dieselben Zahlen. Der Grund ist die Klammerung
 * `basis*zaehler/nenner` = `(basis·zaehler)/nenner`: Beide sind ganzzahlig
 * (Wertquoten sind `integer`, und `schwelle()` wirft bei nicht ganzzahliger
 * Bezugsgrösse), und eine Division, die aufgeht, trifft ihr Ergebnis in
 * IEEE-754 exakt.
 *
 * **Der Schutz bleibt trotzdem stehen.** Er kostet nichts, und die Mappe wird
 * ausserhalb geöffnet — Excel oder ein Online-Rechner müssen nicht so runden
 * wie LibreOffice. Aber er ist damit **vorsorglich und unbelegt**, nicht
 * gemessen; wer ihn anfasst, sieht das nicht am grünen Nachweis.
 *
 * Wer hier etwas ändert, fährt `node scripts/mappe-nachrechnen.mjs` — es lässt
 * eine echte Tabellenkalkulation rechnen und hält das Ergebnis gegen
 * `zaehleAus`.
 */
export function schwellenformel(basiszelle: string, s: Schwelle): string {
	const roh = `ROUND(${basiszelle}*${s.zaehler}/${s.nenner},6)`;
	const wert = s.art === 'mehr_als' ? `INT(${roh})+1` : `CEILING(${roh},1)`;
	// Eine leere Bezugsgrösse nimmt nichts an — wie in `zaehleAus`, wo die
	// Schwelle dann `null` ist und nichts erreicht wird.
	return `IF(${basiszelle}=0,"",${wert})`;
}

/**
 * Die Stimme je Eigentümer einer Partei, wie sie der Aufrufer aus `kopfgewicht`
 * mitgibt. **Nicht geraten** (Codeprüfung Block 5, M5): Der frühere Ersatz aus
 * den Kopfstimmen je Einheit gab einer Partei nur mit einem Nebenobjekt ohne
 * Kopfstimme 0 statt 1. Fehlt die Angabe, wo die Spalte gebraucht wird, ist das
 * ein Fehler des Aufrufers.
 */
function stimmeJeEigentuemer(p: Mappenpartei): number {
	if (p.kopfstimmenJeEigentuemer === undefined) {
		throw new Error(`Auszählmappe: Für «${p.name}» fehlt die Stimme je Eigentümer.`);
	}
	return p.kopfstimmenJeEigentuemer;
}

/**
 * Der Satz zur Einsprache nach L3 in der Anleitung der Mappe (Abnahme Block 5;
 * Laien- und Fachprüfung Runden 1 bis 3).
 *
 * **Die andere Zählweise rechnet die Spalte «zum Vergleich»** (A3,
 * 30.10.2026). Bis dahin rechnete die Leitung das Ergebnis je Einheit von Hand,
 * und nach der Wahl «je Einheit» nannte die Mappe das Ergebnis je Eigentümer
 * gar nicht (Pendenz Block 5, Niedrig 6). Die Hand-Anleitung, die nur beim
 * gesetzlichen Mehr galt (Codeprüfung Block 5, Runde 3, M2), fällt damit weg.
 */
export function einspracheMappensatz(wahl: Einsprachewahl): string {
	const vorne =
		wahl === 'je_eigentuemer'
			? 'Bei der Einsprache hat nach der Einstellung Ihrer Gemeinschaft jeder Eigentümer eine Stimme. ' +
				'Die Formeln rechnen dort mit der Spalte «Stimme je Eigentümer»; die Spalte «zum Vergleich» ' +
				'daneben zählt dieselben Stimmen je Einheit, mit der Spalte «Kopfstimmen».'
			: 'Bei der Einsprache zählt nach der Einstellung Ihrer Gemeinschaft jede Einheit, wie bei den ' +
				'übrigen Traktanden. Die Spalte «zum Vergleich» daneben zählt dieselben Stimmen je ' +
				'Eigentümer, mit der Spalte «Stimme je Eigentümer».';
	// Laienprüfung Runde 4, L4-3: die Frist wie auf der Karte, denn im Ausfall
	// ist die Mappe das einzige Papier.
	// Fachprüfung A3, F-6: Die Monatsfrist aus dem Satz zu den Vergleichen
	// trägt hier nicht (Rz. 190, 193 f. ad Art. 712c).
	// A5, Punkt 13: beim Eigentümer, der verkauft, wie auf der Karte
	// (`nachAnnahme` in `lesarten.ts`), und der Rat, die erste Mitteilung des
	// Vertrags sofort zu klären, weil die Frist ab dann läuft. Wer die
	// Einsprache überbringt, steht nicht da (nicht geprüft).
	return (
		vorne +
		' Ist die Einsprache beschlossen, muss sie innert 14 Tagen seit der ersten Mitteilung des ' +
		'Vertrags beim Eigentümer sein, der verkauft, vermietet oder belastet. Das gilt auch, wenn die ' +
		'Mitteilung nur an die Verwaltung ging oder von der Gegenpartei kam. Klären Sie sofort, wann der ' +
		'Vertrag zum ersten Mal mitgeteilt wurde: Die Frist läuft ab dann. Für die Einsprache gilt nur ' +
		'diese Frist, nicht die Monatsfrist der Anfechtung. Ob ein Fehler bei der Zählung danach noch ' +
		'angefochten werden kann, ist nicht geklärt.'
	);
}

/**
 * Baut das Blatt.
 *
 * Der Aufbau ist bewusst starr: Wer im Ausfall damit arbeitet, soll nicht erst
 * suchen müssen, wo etwas steht.
 */
export function baueAuszaehlmappe(a: Mappenangaben): Blatt {
	const zeilen: Zelle[][] = [];
	const ungleich = kopfstimmenUngleich(a.parteien);

	/*
	 * **Je Posten eine Spalte, und je zweites Ergebnis eine daneben** (A3,
	 * 30.10.2026). Die Spalte «zum Vergleich» hat keine eigenen Eingaben: Ihre
	 * Formeln lesen die Stimmen aus der Spalte ihres Traktandums (`ein`) und
	 * rechnen mit dem anderen Erfordernis (`r`). Eine Eingabe gilt deshalb in
	 * jeder Spalte gleich; dass das trägt, auch wo der Vergleich eine andere
	 * Bezugsgrösse hat, zeigt `scripts/mappe-nachrechnen.mjs` (7 und 9 an der
	 * Ausschlussklage nach beiden Zählbasen).
	 */
	const rechnungen: Mappenrechnung[] = a.posten.flatMap((p) => [p, ...(p.vergleiche ?? []).map((v) => v.rechnung)]);

	/*
	 * **Eine eigene Kopfspalte, wo ein Posten je Eigentümer zählt** (L3,
	 * Migration 172): An der Einsprache in einer Gemeinschaft je Einheit hat jede
	 * Partei eine Stimme, nicht ihre Einheiten. Die Mappe hat je Partei nur eine
	 * globale Kopfspalte; für solche Posten trägt sie deshalb eine zweite
	 * Spalte «Stimme je Eigentümer» und rechnet mit ihr. Seit A3 auch, wo nur der
	 * Vergleich je Eigentümer zählt (L3 «je Einheit»).
	 */
	const mitEigentuemerspalte = a.jeEinheit && rechnungen.some((p) => p.zaehlweise === 'per_owner');
	const VORSPALTEN = mitEigentuemerspalte ? 5 : 4;
	const SP_KOPF = 'B';
	const SP_KOPF_JE_EIGENTUEMER = mitEigentuemerspalte ? 'C' : null;
	const SP_QUOTE = mitEigentuemerspalte ? 'D' : 'C';
	const SP_DA = mitEigentuemerspalte ? 'E' : 'D';
	/** Die Kopfspalte dieser Rechnung: je Eigentümer, wo L3 es verlangt. */
	const kopfspalte = (p: Mappenrechnung): string =>
		p.zaehlweise === 'per_owner' && SP_KOPF_JE_EIGENTUEMER ? SP_KOPF_JE_EIGENTUEMER : SP_KOPF;
	/** Die leeren Vorspalten der Kopfzeilen: drei, mit der Eigentümerspalte vier. */
	const VOR = mitEigentuemerspalte ? [LEER, LEER, LEER, LEER] : [LEER, LEER, LEER];

	interface Spalte {
		posten: Mappenposten;
		r: Mappenrechnung;
		vergleich: Mappenvergleich | null;
		/** Die eigene Spalte, in der die Auswertung steht. */
		sp: string;
		/** Die Spalte mit den Stimmen: beim Vergleich die seines Traktandums. */
		ein: string;
	}
	const spalten: Spalte[] = [];
	for (const p of a.posten) {
		const ein = spaltenname(VORSPALTEN + spalten.length);
		spalten.push({ posten: p, r: p, vergleich: null, sp: ein, ein });
		for (const v of p.vergleiche ?? []) {
			spalten.push({ posten: p, r: v.rechnung, vergleich: v, sp: spaltenname(VORSPALTEN + spalten.length), ein });
		}
	}

	const stichentscheid = a.stichentscheid ?? 'keiner';
	const mitNeuen = a.posten.some((p) => p.neuAnZweiter);
	if (rechnungen.some((p) => p.nurBeschlussfaehigWieErste) && a.ersteVersammlung === undefined) {
		throw new Error('Auszählmappe: Für ein neues Traktandum der zweiten Versammlung fehlt die Regel der ersten.');
	}

	zeilen.push([text(`Auszählung von Hand — ${a.gemeinschaftName}`, 'titel')]);
	zeilen.push([text(`Versammlung vom ${a.datum}, ${a.uhrzeit} Uhr · ${a.ort}`, 'leise')]);
	zeilen.push([]);

	/*
	 * **Die Anleitung sagt, WO etwas hingehört, nicht nur was es bedeutet.**
	 *
	 * Gefragt am 20.08.2026: «Wo setze ich die 9 ein? Das ist nicht ganz so
	 * verständlich.» Der erste Anlauf zählte die Werte auf und liess offen, in
	 * welche Spalte sie kommen — und «9 eintragen, wer nicht mitzählt» klingt
	 * nach einer eigenen Spalte, die es nicht gibt. Deshalb jetzt nach Spalten
	 * geordnet, und die seltene Angabe zuletzt und ausdrücklich als selten
	 * gekennzeichnet.
	 */
	zeilen.push([text('So tragen Sie ein — nur in die gelben Felder', 'fett')]);

	/*
	 * **Der Wert steht in der Spalte, in die er gehört.** Die Zeile für
	 * «anwesend» trägt ihre 1 in Spalte D, die Zeilen für ein Traktandum tragen
	 * ihre Werte in der ersten Traktandumsspalte. Wer die Anleitung liest, sieht
	 * damit senkrecht, wohin er tippen muss — das beantwortet die Frage «wo?»
	 * ohne ein weiteres Wort.
	 */
	const anleitung = (spalte: number, wert: string, satz: string): Zelle[] => {
		const zeile: Zelle[] = [];
		zeile[spalte] = text(wert, 'fett');
		zeile[spalte + 1] = text(satz);
		for (let i = 0; i < zeile.length; i++) if (!zeile[i]) zeile[i] = LEER;
		return zeile;
	};
	const SP_ANWESEND = mitEigentuemerspalte ? 4 : 3;
	const SP_ERSTES = VORSPALTEN;

	const anwesendzeile = anleitung(
		SP_ANWESEND,
		'1',
		'wer im Saal ist oder vertreten wird. Leer lassen, wer fehlt.'
	);
	anwesendzeile[0] = text('In die Spalte «anwesend»:');
	zeilen.push(anwesendzeile);

	// Die Zeile «Unmittelbar Betroffene» nur, wo ein Traktandum sie ausnimmt.
	const mitBetroffenenzeile = rechnungen.some((p) => p.ohneBetroffene === true);
	/*
	 * Die 7 nur, wo ein Traktandum sie braucht: für Angehörige im Ausstand (1e)
	 * und, seit A3, für die gemeinsame Wohnung des Beklagten. Leer zählte diese
	 * in einer Quote der Anwesenden mit, der Kern nicht (`stimmtNicht`;
	 * Codeprüfung der Review-Behebung, M1, in A2 bestätigt).
	 */
	const mitAngehoerigen = rechnungen.some((p) => p.ausstandBleibtInDerZahl === true);
	const mitBeklagtenwohnung = rechnungen.some((p) => p.beklagtenwohnungZaehltMit === true);
	const mitSieben = mitAngehoerigen || mitBeklagtenwohnung;
	/*
	 * **Ausserhalb der Ausschlussklage rechnet eine 7 wie die 9** (Codeprüfung
	 * Block C, Lauf 2, M-B): Wo die Mappe die 7 erklärt, kann sie auch an einem
	 * anderen Traktandum stehen; sie darf dort kein anderes Ergebnis geben.
	 * Ohne Traktandum, das die 7 braucht, kennt die Mappe keine 7 (Laienprüfung
	 * Runde 5, N4), und die Formeln bleiben, wie sie waren.
	 *
	 * **`ausschlussklage` deckt nur einen Restfall** (Codeprüfung Block D, N5):
	 * Jede Klagespalte ab Fassung 2026-10-11 nehmen schon `ausstandBleibtInDerZahl`
	 * und `beklagtenwohnungZaehltMit` aus. Das Feld wirkt nur an einer Klage
	 * älterer Fassung neben einer Spalte, die die 7 braucht.
	 */
	const siebenWieNeun = (p: Mappenrechnung) =>
		mitSieben && p.ausschlussklage !== true && p.ausstandBleibtInDerZahl !== true && p.beklagtenwohnungZaehltMit !== true;
	/*
	 * **Die Zeile nennt den Beklagten mit** (A2, 30.10.2026): Seine 9 zählt hier,
	 * und gerechnet ist das richtig (der Kern warnt mit derselben Zahl), nur hiess
	 * die Zeile ihn «im Ausstand».
	 */
	const AUSSTANDSZEILE =
		(mitBetroffenenzeile ? 'Wertquoten im Ausstand oder der Betroffenen' : 'Wertquoten im Ausstand') +
		(mitSieben ? ' (9, 7)' : ' (9)');
	const unterAllen = a.posten.some((p) => p.ausstandNachZaehlweise === true);
	const jazeile = anleitung(SP_ERSTES, String(EINGABEN.ja), 'Ja');
	jazeile[0] = text('In die Spalte eines Traktandums:');
	zeilen.push(jazeile);
	zeilen.push(anleitung(SP_ERSTES, String(EINGABEN.enthaltung), 'Enthaltung'));
	zeilen.push(anleitung(SP_ERSTES, String(EINGABEN.nein), 'Nein'));
	zeilen.push(
		anleitung(SP_ERSTES, 'leer', 'anwesend, aber nicht abgestimmt — zählt in der Bezugsgrösse mit')
	);
	zeilen.push(
		anleitung(
			SP_ERSTES,
			String(EINGABEN.draussen),
			// Laienprüfung Block 2, M7: «weglassen» liess sich doppelt lesen. Wo eine
			// Hauptspalte unter allen zählt, «Stimme zählt nicht» (Laienprüfung Block D,
			// D-L-1): Die Partei bleibt dort in der Zahl.
			(unterAllen ? 'Stimme zählt bei DIESEM Traktandum nicht: im Ausstand' : 'zählt bei DIESEM Traktandum nicht mit: im Ausstand') +
				(mitBetroffenenzeile
					? // Codeprüfung der Review-Behebung, N2: beide Fassungen der Zeile nennen eine 9.
						', oder unmittelbar betroffen, wo die Zeile «Unmittelbar Betroffene» «stimmen nicht mit» sagt'
					: '') +
				'. Brauchen Sie selten; im Zweifel keine 9 setzen und den Zweifel im Protokoll festhalten.' +
				/*
				 * Fachprüfung Nachtrag Runde 3, N3-F-1, gefasst nach der Laienprüfung
				 * Block D, D-L-1: Unter L13 «Alle Eigentümer» lässt die Hauptspalte die 9
				 * in der Kopfzahl (`ausstandNachZaehlweise`); nur wo eine Hauptspalte so
				 * zählt, sonst stimmte der Satz nicht.
				 */
				(unterAllen ? ` ${MAPPE_NEUN_UNTER_ALLEN}` : '')
		)
	);
	zeilen.push(
		anleitung(
			SP_ERSTES,
			String(EINGABEN.vertretenImAusstand),
			// Fach- und Laienprüfung Block 5, Runde 3 (R3-1, R3-4): auch über den
			// Betroffenen vertreten, wo Votum seine Vollmachten nicht zählt
			// (`vollmachtenBetroffenerZaehlenNicht`, nicht unter einer blossen
			// Klausel; Codeprüfung Runde 3, M1), und ohne «ruht». Dass die
			// Vollmacht an der Einsprache nicht zählt, folgt aus BGE 134 III 481
			// E. 3.8 (Regeste), übertragen auf den Ausschluss nach Art. 712c
			// Abs. 2; Fachprüfung F4a, S5.
			'nur über eine Person vertreten, die hier im Ausstand ist' +
				(rechnungen.some((p) => p.vollmachtenBetroffenerZaehlenNicht)
					? ' oder an der Einsprache oder Ausschlussklage als Betroffene nicht mitstimmt'
					: '') +
				': zählt wie eine Abwesende. Die Mappe zählt die Vollmacht bei diesem Traktandum nicht ' +
				'und rechnet den Rest.'
		)
	);
	if (mitAngehoerigen) {
		zeilen.push(
			anleitung(
				SP_ERSTES,
				String(EINGABEN.imAusstandInDerZahl),
				// Laienprüfung Block 2, M8: was statt der 9 hineingehört.
				// Laienprüfung Runde 4, M1: eine Anweisung je Lage.
				// Review DeepSeek Block 2, Befund 1: eigener Eintrag statt leer, weil
				// leer in einer Quote der Anwesenden mitzählte.
				'bei der Ausschlussklage für Angehörige des Beklagten im Ausstand, nicht ' +
					String(EINGABEN.draussen) +
					'. Sie stimmen nicht ab, zählen aber in der Zahl aller Eigentümer mit und wirken wie ein ' +
					'Nein (ZGB Art. 649b Abs. 2). Wer nur über sie vertreten ist, bekommt ' +
					String(EINGABEN.vertretenImAusstand) +
					'.'
			)
		);
	}
	if (mitBeklagtenwohnung) {
		zeilen.push(
			anleitung(
				SP_ERSTES,
				String(EINGABEN.imAusstandInDerZahl),
				// A3: die 7 statt «leer». Laienprüfung A3, L-14 und L-15: kurze Sätze,
				// eine 7 je Wohnung; Fachprüfung F-9: der Beleg zum Nichtabstimmen.
				'bei der Ausschlussklage für eine Wohnung, die dem Beklagten mit anderen gehört, wenn sich ' +
					'der Antrag nur gegen ihn richtet, auch wenn für die übrigen Eigentümer der Wohnung der ' +
					'Ausstand erklärt ist. Eine 7 je Wohnung. Sie stimmt nicht ab, zählt aber in der Zahl aller ' +
					'Eigentümer mit und wirkt damit wie ein Nein (ZGB Art. 649b Abs. 2; SVIT-Kommentar ' +
					'Rz. 23 ad Art. 712o). Richtet sich der Antrag gegen alle ihre Eigentümer, tragen Sie ' +
					String(EINGABEN.draussen) +
					' ein.'
			)
		);
	}
	zeilen.push([]);

	// ── Kopfblock ────────────────────────────────────────────────────────────
	zeilen.push([
		text('Traktandum', 'kopf'),
		...VOR,
		...spalten.map((s) =>
			text(s.vergleich ? `${s.posten.nummer} zum Vergleich` : `${s.posten.nummer} ${s.posten.titel}`, 'kopf')
		)
	]);
	zeilen.push([
		text('Nötiges Mehr', 'leise'),
		...VOR,
		...spalten.map((s) =>
			text(
				s.vergleich ? `zum Vergleich, nach «${s.vergleich.wahl}»: ${s.vergleich.verlangt}` : s.posten.erfordernis,
				'leise'
			)
		)
	]);
	if (mitNeuen) {
		zeilen.push([
			text('Neu an der zweiten Versammlung', 'leise'),
			...VOR,
			...spalten.map((s) => (s.posten.neuAnZweiter && !s.vergleich ? text('ja, siehe unten', 'leise') : LEER))
		]);
	}
	if (mitBetroffenenzeile) {
		zeilen.push([
			text('Unmittelbar Betroffene', 'leise'),
			...VOR,
			...spalten.map((s) =>
				s.vergleich
					? LEER
					: text(
							s.r.ohneBetroffene
								? // Zweite Codeprüfung, M1; seit A3 die 7 statt leer.
									`stimmen nicht mit: ${EINGABEN.draussen}` +
										(s.r.beklagtenwohnungZaehltMit
											? `; gemeinsame Wohnung des Beklagten: ${EINGABEN.imAusstandInDerZahl}, siehe oben`
											: '')
								: // Fachprüfung Runde 5, G1: Der Ausstand nach Art. 68 geht vor.
									`stimmen mit: keine ${EINGABEN.draussen}, ausser im Ausstand`,
							'leise'
						)
			)
		]);
	}
	/*
	 * **Die Werte stehen im Spaltenkopf**, direkt über den Feldern, in die sie
	 * gehören. Eine Anleitung acht Zeilen weiter oben liest im Ernstfall
	 * niemand mehr — die Überschrift steht immer im Blick.
	 */
	zeilen.push([
		text('Partei', 'kopf'),
		text('Kopfstimmen', 'kopf'),
		...(mitEigentuemerspalte ? [text('Stimme je Eigentümer', 'kopf')] : []),
		text('Wertquote', 'kopf'),
		text('anwesend (1)', 'kopf'),
		...spalten.map((s) =>
			text(
				s.vergleich
					? 'nichts eintragen, zählt die Stimmen des Traktandums'
					: `Stimme (${EINGABEN.ja}=Ja ${EINGABEN.enthaltung}=Enth. ${EINGABEN.nein}=Nein)`,
				'kopf'
			)
		)
	]);

	// ── Die Matrix ───────────────────────────────────────────────────────────
	const ersteParteizeile = zeilen.length + 1;
	for (const p of a.parteien) {
		zeilen.push([
			text(p.name),
			zahl(p.kopfstimmen),
			...(mitEigentuemerspalte
				? [zahl(stimmeJeEigentuemer(p))]
				: []),
			zahl(p.wertquote),
			{ art: 'leer', stil: 'eingabe' },
			// Die Spalte «zum Vergleich» ohne gelbes Feld: Dort gehört nichts hin.
			...spalten.map((s): Zelle => (s.vergleich ? LEER : { art: 'leer', stil: 'eingabe' }))
		]);
	}
	const letzteParteizeile = zeilen.length;
	zeilen.push([]);

	const bereich = (spalte: string) => `$${spalte}$${ersteParteizeile}:$${spalte}$${letzteParteizeile}`;
	/** Der Bereich einer Traktandumsspalte — Zeilen fest, Spalte wandert mit. */
	const spaltenbereich = (sp: string) => `${sp}$${ersteParteizeile}:${sp}$${letzteParteizeile}`;

	// ── Beschlussfähigkeit einer ersten Versammlung (L5) ─────────────────────
	/*
	 * **Nur wo ein Traktandum neu an der zweiten Versammlung ist** (A3). Am
	 * Server sperrt das Eröffnen nach der Vorgabe von L5, ohne Server sperrt
	 * nichts. Gerechnet wird aus der Spalte «anwesend»: Eigentümer und
	 * Wertquoten der Anwesenden und Vertretenen. Die nötigen Zahlen stehen fest
	 * und kommen aus `stelleBeschlussfaehigkeitFest`, nicht aus einer eigenen
	 * Rechnung. Jede Partei der Mappe ist Eigentümer: Die Momentaufnahme nimmt
	 * nur Parteien mit Einheit auf (`server/freigabe.ts`).
	 */
	let beschlussfaehigZelle: string | null = null;
	if (mitNeuen) {
		const regel = a.ersteVersammlung ?? GESETZLICH.erste;
		const leer = stelleBeschlussfaehigkeitFest(
			'erste',
			{
				eigentuemerGesamt: a.parteien.length,
				eigentuemerAnwesend: 0,
				kopfstimmenGesamt: a.parteien.reduce((s, p) => s + p.kopfstimmen, 0),
				kopfstimmenAnwesend: 0,
				gesamtquote: a.gesamtquote,
				quotenAnwesend: 0
			},
			a.ersteVersammlung ?? null
		);
		const [kopf, quoten] = leer.bedingungen;
		const zeileHier = () => zeilen.length + 1;
		const wertzeile = (beschriftung: string, wert: Zelle): number => {
			const zeile: Zelle[] = [text(beschriftung)];
			zeile[SP_ANWESEND] = wert;
			for (let i = 0; i < zeile.length; i++) if (!zeile[i]) zeile[i] = LEER;
			const nr = zeileHier();
			zeilen.push(zeile);
			return nr;
		};
		const sp = spaltenname(SP_ANWESEND);
		zeilen.push([text('Beschlussfähigkeit wie an einer ersten Versammlung (neue Traktanden)', 'fett')]);
		if (!kopf) {
			// Ohne Eigentümer oder ohne Kopfstimme gibt es keine Beschlussfähigkeit.
			beschlussfaehigZelle = `${sp}${wertzeile('Beschlussfähig wie eine erste Versammlung', text('nein', 'fett'))}`;
		} else {
			const eigentuemer = wertzeile('Eigentümer anwesend oder vertreten', formel(`COUNTIF(${bereich(SP_DA)},1)`));
			const eigentuemerNoetig = wertzeile(`Mindestens nötig (Eigentümer, von ${kopf.gesamt})`, zahl(kopf.noetig));
			const bedingungen = [`${sp}${eigentuemer}>=${sp}${eigentuemerNoetig}`];
			if (quoten && regel.quoten) {
				const q = wertzeile('Wertquoten anwesend oder vertreten', formel(`SUMIF(${bereich(SP_DA)},1,${bereich(SP_QUOTE)})`));
				const qNoetig = wertzeile(`Mindestens nötig (Wertquoten, von ${quoten.gesamt})`, zahl(quoten.noetig));
				bedingungen.push(`${sp}${q}>=${sp}${qNoetig}`);
			}
			beschlussfaehigZelle = `${sp}${wertzeile(
				'Beschlussfähig wie eine erste Versammlung',
				formel(`IF(AND(${bedingungen.join(',')}),"ja","nein")`, 'fett')
			)}`;
		}
		zeilen.push([]);
	}

	// ── Auswertung ───────────────────────────────────────────────────────────
	const mitVergleichen = spalten.some((s) => s.vergleich);
	const alleZeilen: {
		beschriftung: string;
		stil?: Zelle['stil'];
		/** Nur in einer Mappe mit Spalten «zum Vergleich». */
		nurMitVergleichen?: boolean;
		wert: (s: Spalte, zeilenNr: (name: string) => number) => Zelle;
	}[] = [
		{
			beschriftung: 'Ja (Kopfstimmen)',
			wert: (s) => formel(`SUMIF(${spaltenbereich(s.ein)},${EINGABEN.ja},${bereich(kopfspalte(s.r))})`)
		},
		{
			beschriftung: 'Nein (Kopfstimmen)',
			wert: (s) => formel(`SUMIF(${spaltenbereich(s.ein)},${EINGABEN.nein},${bereich(kopfspalte(s.r))})`)
		},
		{
			beschriftung: 'Enthaltung (Kopfstimmen)',
			wert: (s) =>
				formel(`SUMIF(${spaltenbereich(s.ein)},${EINGABEN.enthaltung},${bereich(kopfspalte(s.r))})`)
		},
		{
			beschriftung: 'Bezugsgrösse Kopfstimmen',
			stil: 'fett',
			wert: ({ r: p, ein }) =>
				formel(
					p.kopfbasis === 'anwesend_vertreten'
						? // Alle Anwesenden, ohne die, die hier nicht mitzählen.
							`SUMIF(${bereich(SP_DA)},1,${bereich(kopfspalte(p))})` +
								`-SUMIFS(${bereich(kopfspalte(p))},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.draussen})` +
								`-SUMIFS(${bereich(kopfspalte(p))},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.vertretenImAusstand})` +
								`-SUMIFS(${bereich(kopfspalte(p))},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.imAusstandInDerZahl})` +
								/*
								 * Nimmt das Reglement die Enthaltungen aus der Bezugsgrösse,
								 * fallen sie auch hier heraus. Dieselbe Unterscheidung wie in
								 * `zaehleAus`: nur bei einer Basis aus abgegebenen Stimmen.
								 */
								(p.enthaltungZaehltMit === false
									? `-SUMIFS(${bereich(kopfspalte(p))},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.enthaltung})`
									: '')
						: // Auch die Abwesenden — ZGB Art. 649b Abs. 2, Einstimmigkeit.
							`SUM(${bereich(kopfspalte(p))})` +
								/*
								 * Unter L13 «Alle Eigentümer» bleibt der Ausstand in der Zahl
								 * (Antwort 9), mit 9 wie mit 7 (Codeprüfung Block C, Lauf 2, M-B).
								 */
								(p.ausstandNachZaehlweise === true
									? ''
									: `-SUMIF(${spaltenbereich(ein)},${EINGABEN.draussen},${bereich(kopfspalte(p))})` +
										(siebenWieNeun(p)
											? `-SUMIF(${spaltenbereich(ein)},${EINGABEN.imAusstandInDerZahl},${bereich(kopfspalte(p))})`
											: ''))
				)
		},
		{
			beschriftung: 'Nötig (Kopfstimmen)',
			stil: 'fett',
			wert: ({ r, sp }, zeilenNr) =>
				r.kopfSchwelle
					? formel(schwellenformel(`${sp}${zeilenNr('Bezugsgrösse Kopfstimmen')}`, r.kopfSchwelle))
					: // Ohne Köpfe eine Auskunft, keine Schranke (16.11.2026).
						text('entfällt', 'leise')
		},
		{
			beschriftung: 'Kopfmehr erreicht',
			stil: 'fett',
			wert: ({ r, sp }, zeilenNr) =>
				!r.kopfSchwelle
					? text('entfällt, gezählt wird nur nach Wertquoten', 'leise')
					: formel(
							`IF(${sp}${zeilenNr('Nötig (Kopfstimmen)')}="","nein",` +
								`IF(${sp}${zeilenNr('Ja (Kopfstimmen)')}>=${sp}${zeilenNr('Nötig (Kopfstimmen)')},"ja","nein"))`
						)
		},
		{
			beschriftung: 'Ja (Wertquoten)',
			wert: ({ ein }) => formel(`SUMIF(${spaltenbereich(ein)},${EINGABEN.ja},${bereich(SP_QUOTE)})`)
		},
		{
			beschriftung: 'Nein (Wertquoten)',
			wert: ({ ein }) => formel(`SUMIF(${spaltenbereich(ein)},${EINGABEN.nein},${bereich(SP_QUOTE)})`)
		},
		{
			beschriftung: 'Enthaltung (Wertquoten)',
			wert: ({ ein }) =>
				formel(`SUMIF(${spaltenbereich(ein)},${EINGABEN.enthaltung},${bereich(SP_QUOTE)})`)
		},
		{
			beschriftung: 'Bezugsgrösse Wertquoten',
			stil: 'fett',
			wert: ({ r: p, ein }) => {
				if (!p.quotenSchwelle) return text('—', 'leise');
				if (p.quotenbasis === 'alle_quoten' && p.ausstandFaelltHeraus) {
					// Nach L1 «fällt heraus»: ohne die Quoten mit 9 (Migration 170), und ohne
					// die mit 7, wo die Mappe die 7 kennt (Codeprüfung Block C, Lauf 2, M-B).
					return formel(
						`${a.gesamtquote}-SUMIF(${spaltenbereich(ein)},${EINGABEN.draussen},${bereich(SP_QUOTE)})` +
							(siebenWieNeun(p)
								? `-SUMIF(${spaltenbereich(ein)},${EINGABEN.imAusstandInDerZahl},${bereich(SP_QUOTE)})`
								: ''),
						'fett'
					);
				}
				return p.quotenbasis === 'alle_quoten'
					? // Die ganze Gemeinschaftsquote. Der Ausstand senkt sie nicht (L1, Vorgabe).
						zahl(a.gesamtquote, 'fett')
					: formel(
							`SUMIF(${bereich(SP_DA)},1,${bereich(SP_QUOTE)})` +
								`-SUMIFS(${bereich(SP_QUOTE)},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.draussen})` +
								`-SUMIFS(${bereich(SP_QUOTE)},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.vertretenImAusstand})` +
								`-SUMIFS(${bereich(SP_QUOTE)},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.imAusstandInDerZahl})` +
								// Wie bei den Kopfstimmen, und aus demselben Grund.
								(p.enthaltungZaehltMit === false
									? `-SUMIFS(${bereich(SP_QUOTE)},${bereich(SP_DA)},1,${spaltenbereich(ein)},${EINGABEN.enthaltung})`
									: ''),
							'fett'
						);
			}
		},
		{
			beschriftung: 'Nötig (Wertquoten)',
			stil: 'fett',
			wert: ({ r, sp }, zeilenNr) =>
				r.quotenSchwelle
					? formel(
							schwellenformel(`${sp}${zeilenNr('Bezugsgrösse Wertquoten')}`, r.quotenSchwelle),
							'fett'
						)
					: text('—', 'leise')
		},
		{
			/*
			 * **Was der Ausstand mit den Wertquoten macht** (Auftraggeber, 20.08.2026: «Im
			 * Excel müsste noch rein, wenn jemand in Ausstand tritt, also den
			 * Spezialfall wenn seine WQ nicht zählt»).
			 *
			 * Gerechnet war der Fall schon — eine 9 nimmt die Partei aus allen
			 * Eimern. Nur schwieg die Mappe über die **Folge**, und die ist die
			 * eigentliche Falle: Bei «mehr als die Hälfte ALLER Wertquoten» bleibt
			 * die Schranke nach der Vorgabe von L1, wo sie ist: Die Quote des
			 * Ausständigen bleibt in der Basis (so rechnet auch `zaehleAus`;
			 * `ausstandslesartSatz`, Migration 170). Steht genug Quote im Ausstand,
			 * ist das Erfordernis nicht mehr erreichbar — und das muss **vor** der
			 * Abstimmung dastehen, nicht nachher als Ergebnis.
			 */
			beschriftung: AUSSTANDSZEILE,
			// Mit der 7: Wer nach 1e in der Zahl bleibt, stimmt trotzdem nicht (Befund 5).
			// Nur wo die Mappe die 7 erklärt (Laienprüfung Runde 5, N4).
			wert: ({ ein }) =>
				formel(
					`SUMIF(${spaltenbereich(ein)},${EINGABEN.draussen},${bereich(SP_QUOTE)})` +
						(mitSieben
							? `+SUMIF(${spaltenbereich(ein)},${EINGABEN.imAusstandInDerZahl},${bereich(SP_QUOTE)})`
							: '')
				)
		},
		{
			beschriftung: 'Noch erreichbar (Wertquoten)',
			wert: ({ r: p, sp }, zeilenNr) =>
				p.quotenSchwelle && p.quotenbasis === 'alle_quoten'
					? // Nach der Vorgabe von L1 bleibt die Schranke bei der ganzen Gemeinschaftsquote; erreichbar
						// ist nur noch, was nicht im Ausstand steht.
						formel(`${a.gesamtquote}-${sp}${zeilenNr(AUSSTANDSZEILE)}`)
					: text('—', 'leise')
		},
		{
			beschriftung: 'Erfordernis überhaupt noch erreichbar?',
			stil: 'fett',
			wert: ({ r: p, sp }, zeilenNr) =>
				p.quotenSchwelle && p.quotenbasis === 'alle_quoten'
					? formel(
							`IF(${sp}${zeilenNr('Nötig (Wertquoten)')}="","ja",` +
								`IF(${sp}${zeilenNr('Noch erreichbar (Wertquoten)')}>=${sp}${zeilenNr('Nötig (Wertquoten)')},` +
								`"ja","${mitBetroffenenzeile ? 'NEIN, nach dieser Rechnung nicht erreichbar: zu viel Wertquote im Ausstand oder bei Betroffenen' : 'NEIN — zu viel Wertquote im Ausstand'}"))`,
							'fett'
						)
					: text('—', 'leise')
		},
		{
			beschriftung: 'Quotenmehr erreicht',
			stil: 'fett',
			wert: ({ r: p, sp }, zeilenNr) =>
				p.quotenSchwelle
					? formel(
							`IF(${sp}${zeilenNr('Nötig (Wertquoten)')}="","nein",` +
								`IF(${sp}${zeilenNr('Ja (Wertquoten)')}>=${sp}${zeilenNr('Nötig (Wertquoten)')},"ja","nein"))`,
							'fett'
						)
					: // Ohne Quotenerfordernis ist die Angabe eine Auskunft, keine Schranke.
						text('entfällt', 'leise')
		},
		{
			beschriftung: 'Ergebnis',
			stil: 'fett',
			wert: ({ r: p, sp }, zeilenNr) => {
				const z = (name: string) => `${sp}${zeilenNr(name)}`;
				const erreicht = !p.kopfSchwelle
					? `${z('Quotenmehr erreicht')}="ja"`
					: p.quotenSchwelle
						? `AND(${z('Kopfmehr erreicht')}="ja",${z('Quotenmehr erreicht')}="ja")`
						: `${z('Kopfmehr erreicht')}="ja"`;
				let ergebnis = `IF(${erreicht},"ANGENOMMEN",${sonstBeiGleichstand(p, z)})`;
				// L5: ohne die Beschlussfähigkeit einer ersten kein Beschluss.
				if (p.nurBeschlussfaehigWieErste && beschlussfaehigZelle) {
					ergebnis = `IF(${beschlussfaehigZelle}="ja",${ergebnis},"NICHT VERBINDLICH")`;
				}
				return formel(ergebnis, 'fett');
			}
		},
		{
			/*
			 * **Ob der Vergleich abweicht** (A3), wie `abweichend` im Kern: Ein
			 * offener Stichentscheid lässt sich nicht vergleichen, und
			 * «ANGENOMMEN (Stichentscheid)» ist angenommen.
			 */
			beschriftung: 'Weicht vom Traktandum ab?',
			stil: 'fett',
			nurMitVergleichen: true,
			wert: (s, zeilenNr) => {
				if (!s.vergleich) return text('—', 'leise');
				const hier = `${s.sp}${zeilenNr('Ergebnis')}`;
				const dort = `${s.ein}${zeilenNr('Ergebnis')}`;
				// Fachprüfung A3, R3-F-2: Ist das Traktandum nach L5 nicht verbindlich,
				// gibt es keinen Beschluss, der sich anfechten liesse. Nur das
				// Traktandum, nicht der Vergleich (Laienprüfung R4-L-2): Nach «Ein
				// Drittel genügt» ist das Traktandum ein Beschluss, auch wenn der
				// Vergleich «NICHT VERBINDLICH» zeigt.
				return formel(
					// Codeprüfung A3, N4: «kein Beschluss» vor «offen».
					`IF(AND(LEFT(${dort},5)="NICHT",LEFT(${hier},5)<>"NICHT"),"kein Beschluss, siehe unten",` +
						`IF(OR(LEFT(${hier},11)="GLEICHSTAND",LEFT(${dort},11)="GLEICHSTAND"),"offen",` +
						`IF(LEFT(${hier},10)=LEFT(${dort},10),"nein","JA, siehe unten")))`,
					'fett'
				);
			}
		}
	];

	const auswertung = alleZeilen.filter((z) => mitVergleichen || !z.nurMitVergleichen);

	/*
	 * **Der Stichentscheid wie im Kern** (A1 Frage 1; `gleichstand` in
	 * `zaehleAus`): nur wo er möglich ist, nur bei einem Gleichstand, in dem alle
	 * der Bezugsgrösse Ja oder Nein gestimmt haben, und erst die Wertquoten, wo
	 * das Reglement sie vorsieht. Sind auch die gleich oder entscheidet eine
	 * Person, kann die Mappe nichts ausrechnen: «GLEICHSTAND» und wer entscheidet.
	 */
	function sonstBeiGleichstand(p: Mappenrechnung, z: (name: string) => string): string {
		if (!p.stichentscheidMoeglich || stichentscheid === 'keiner') return '"abgelehnt"';
		/*
		 * **Ohne Köpfe liegt der Gleichstand bei den Wertquoten** (16.11.2026),
		 * mit derselben Doppelbedingung wie im Kern. Auflösen kann ihn nur eine
		 * Person; der Stichentscheid nach Wertquoten allein lässt es abgelehnt.
		 */
		if (!p.kopfSchwelle) {
			const wer = personenstufe(stichentscheid);
			if (!wer) return '"abgelehnt"';
			const jaQ = z('Ja (Wertquoten)');
			const gleichQ =
				`AND(${jaQ}>0,${jaQ}=${z('Nein (Wertquoten)')},${jaQ}*2=${z('Bezugsgrösse Wertquoten')})`;
			return `IF(${gleichQ},"GLEICHSTAND: ${wer === 'verwalter' ? 'Verwalter' : 'Vorsitz'} entscheidet","abgelehnt")`;
		}
		const gleich =
			`AND(${z('Ja (Kopfstimmen)')}>0,${z('Ja (Kopfstimmen)')}=${z('Nein (Kopfstimmen)')},` +
			`${z('Ja (Kopfstimmen)')}*2=${z('Bezugsgrösse Kopfstimmen')})`;
		const person = personenstufe(stichentscheid);
		const offen = person ? `"GLEICHSTAND: ${person === 'verwalter' ? 'Verwalter' : 'Vorsitz'} entscheidet"` : '"abgelehnt"';
		if (!quotenstufe(stichentscheid)) return `IF(${gleich},${offen},"abgelehnt")`;
		const jaQ = z('Ja (Wertquoten)');
		const neinQ = z('Nein (Wertquoten)');
		return (
			`IF(${gleich},IF(${jaQ}>${neinQ},"ANGENOMMEN (Stichentscheid)",` +
			`IF(${jaQ}=${neinQ},${offen},"abgelehnt")),"abgelehnt")`
		);
	}

	const ersteAuswertungszeile = zeilen.length + 1;
	const zeilenNr = (name: string) =>
		ersteAuswertungszeile + auswertung.findIndex((r) => r.beschriftung === name);

	for (const reihe of auswertung) {
		// `...VOR`, nicht drei feste Leerzellen: Mit der Spalte «Stimme je
		// Eigentümer» sind es vier, und die Formeln sassen sonst eine Spalte zu
		// weit links, unter «anwesend» (Codeprüfung Block 5, letzte Fixes, H1).
		zeilen.push([
			text(reihe.beschriftung, reihe.stil ?? 'normal'),
			...VOR,
			...spalten.map((s) => reihe.wert(s, zeilenNr))
		]);
	}

	// ── Wie das Ergebnis zu lesen ist (A3; Codeprüfung, N5) ──────────────────
	zeilen.push([]);
	zeilen.push([text('So lesen Sie das Ergebnis', 'fett')]);
	zeilen.push([text(stichentscheidMappensatz(stichentscheid))]);
	if (mitVergleichen) zeilen.push([text(VERGLEICH_MAPPENSATZ)]);
	if (mitNeuen) zeilen.push([text(neuAnZweiterMappensatz(a.neuAnZweiterWahl ?? 'erste'))]);

	// ── Was die Mappe nicht kann ─────────────────────────────────────────────
	zeilen.push([]);
	zeilen.push([text('Was diese Mappe nicht abbildet', 'fett')]);
	zeilen.push([
		text(
			'Geheime Abstimmung — die Zeilen tragen Namen. Dafür zählen Sie neutrale Zettel und ' +
				'halten nur das Ergebnis fest.'
		)
	]);
	zeilen.push([
		text(
			'Die Zustimmung unmittelbar Betroffener als eigene Bedingung: von Hand prüfen und im ' +
				'Protokoll festhalten.'
		)
	]);
	/*
	 * **Nach der Lesart L1 dieser Versammlung** (Migration 170), aus der
	 * Momentaufnahme. Aus den Posten abgelesen fehlte sie, wo kein Mehr aller
	 * Wertquoten in der Mappe steht (Codeprüfung Block 2, Teil 2, N1).
	 */
	const faelltHeraus = a.ausstandslesart === 'faellt_heraus';
	zeilen.push([
		text(
			faelltHeraus
				? 'Beim qualifizierten Mehr sinkt die Schranke mit dem Ausstand (9): Gerechnet wird an allen ' +
						'Wertquoten der Gemeinschaft ausser denen mit 9. ' +
						// Laien- und Fachprüfung Runde 3: eigener Eintrag statt Rechnen von Hand.
						'Für eine Partei, die nur über eine Person im Ausstand vertreten ist, tragen Sie 8 ein, ' +
						'nicht 9: Ihre Wertquote bleibt in der Rechnung. ' +
						ausstandslesartSatz('faellt_heraus', true)
				: 'Beim qualifizierten Mehr bleibt die Schranke trotz Ausstand (9) bei mehr als der Hälfte ' +
						'ALLER Wertquoten der Gemeinschaft. Steht zu viel ' +
						'Quote im Ausstand, ist das Erfordernis nach dieser Rechnung nicht mehr erreichbar; die ' +
						'Zeile «Erfordernis überhaupt noch erreichbar?» sagt es vor der Abstimmung. ' +
						ausstandslesartSatz('bleibt', true)
		)
	]);
	if (a.jeEinheit) {
		zeilen.push([
			text(
				'Diese Gemeinschaft zählt je Einheit. Stimmt eine Partei ihre Einheiten verschieden, ' +
					'reicht eine Zeile nicht — teilen Sie die Zeile von Hand auf.'
			)
		]);
	}
	// Abnahme Block 5: Wozu die zweite Kopfspalte dient, und wo das Ergebnis
	// nach der anderen Zählweise steht (Kriterien 4 und 6; seit A3 die Spalte
	// «zum Vergleich»). Zählt ein Traktandum selbst je Eigentümer, ist es die
	// Wahl «je Eigentümer»; sonst zählt nur sein Vergleich so.
	if (mitEigentuemerspalte) {
		const jeEigentuemer = a.posten.some((p) => p.zaehlweise === 'per_owner');
		zeilen.push([text(einspracheMappensatz(jeEigentuemer ? 'je_eigentuemer' : 'je_einheit'))]);
	}
	if (ungleich) {
		zeilen.push([
			text(
				'Die Kopfstimmen sind ungleich verteilt. Erhobene Hände zu zählen wäre hier falsch; ' +
					'deshalb steht auch das einfache Mehr in dieser Mappe.'
			)
		]);
	}

	const ohneRechnung: Ausgelassen[] = a.posten.flatMap((p) =>
		(p.vergleicheOhneRechnung ?? []).map((wahl) => ({
			nummer: p.nummer,
			titel: p.titel,
			grund: `Zum Vergleich nach «${wahl}»: Dieses Mehr nennt keine Kopfschwelle, hier lässt sich nicht rechnen.`
		}))
	);
	const nichtDrin = [...(a.ausgelassen ?? []), ...ohneRechnung];
	if (nichtDrin.length > 0) {
		zeilen.push([]);
		zeilen.push([text('Nicht in dieser Mappe', 'fett')]);
		for (const w of nichtDrin) {
			zeilen.push([text(`${w.nummer} ${w.titel} — ${w.grund}`, 'leise')]);
		}
	}

	return {
		name: 'Auszählung',
		/*
		 * Die erste Traktandumsspalte trägt oben die Erklärtexte der Anleitung.
		 * Sie darf deshalb nicht so schmal sein wie die übrigen — sonst steht die
		 * Anleitung abgeschnitten da, und abgeschnitten heisst hier: unlesbar.
		 */
		// Mit der Spalte «Stimme je Eigentümer» eine Vorspalte mehr (Codeprüfung A3, N3).
		breiten: [30, 12, ...(mitEigentuemerspalte ? [11] : []), 11, 13, ...spalten.map(() => 18)],
		zeilen
	};
}

/**
 * Der Satz zum Stichentscheid am Fuss der Mappe (A3, nach A1 Frage 1).
 *
 * **Jede Art nur beim einfachen Mehr ohne Wertquoten**, wie
 * `stichentscheidMoeglich` im Kern: Bis A2 stand die Grenze nur beim
 * Stichentscheid nach Wertquoten (Bericht A1, Frage 1). Die Wertquotenstufe
 * rechnet die Zeile «Ergebnis»; die Person nicht, ihr Entscheid wird
 * nachgetragen. Fach- und Laienprüfung A3 (30.10.2026): nach der Einstellung,
 * nicht absolut, mit dem Vorbehalt einer ausdrücklichen Klausel (F-3); was
 * Gleichstand heisst, wie `gleichstand` im Kern (F-4, L-7); was die Leitung
 * verkündet (L-5); der Lehrstreit beim Verwalter (F-5; Rz. 187 ad Art. 712m).
 */
export function stichentscheidMappensatz(s: Stichentscheid): string {
	if (s === 'keiner') {
		return 'Nach der Einstellung Ihrer Gemeinschaft gibt es keinen Stichentscheid: Bei Stimmengleichheit ist der Antrag abgelehnt.';
	}
	const person = personenstufe(s);
	const quoten = quotenstufe(s);
	/*
	 * Runde 2: Die Person entscheidet in der Versammlung, nicht nachträglich
	 * (R2-F-2; Rz. 101 ad Art. 712n, Rz. 187 ad Art. 712m); umstritten ist nur
	 * der Verwalter, nicht ein Eigentümer im Vorsitz (R2-F-3); Gleichstand an
	 * der Bezugsgrösse, wie `gleichstand` im Kern (R2-F-1); bei einer
	 * ausdrücklichen Klausel, was die Mappe rechnet (R2-F-4; Rz. 99 ad Art. 712n).
	 */
	// Runde 3, R3-L-2: Die Empfehlung gilt der Verwaltung, nicht einem
	// Eigentümer im Vorsitz.
	const streitVerwalter = (wer: string) =>
		`ist umstritten, ob ${wer === 'dem Verwalter' ? 'sein' : 'ihr'} Stichentscheid gilt; eine Annahme ` +
		'dadurch lässt sich anfechten (SVIT-Kommentar Rz. 187 ad Art. 712m). ' +
		`${wer === 'dem Verwalter' ? 'Dem Verwalter' : 'Der Verwaltung'} ist deshalb die Ablehnung empfohlen. `;
	return (
		'Nach der Einstellung Ihrer Gemeinschaft gilt ein Stichentscheid nur beim einfachen Mehr nach ' +
		'Köpfen, ohne Wertquoten' +
		// 16.11.2026: Die Person entscheidet auch dort, wo eine Regel die Köpfe nicht zählt.
		(person
			? '. Zählt Ihr Reglement die Köpfe nicht, gilt er auch beim einfachen Mehr nach Wertquoten. Welches'
			: '; welches') +
		' Mehr gilt, steht in der Zeile «Nötiges Mehr». Bei jedem ' +
		'anderen Mehr ist ein Antrag bei Stimmengleichheit abgelehnt. Nennt Ihr Reglement ausdrücklich ' +
		'auch das qualifizierte Mehr, ist nicht geklärt, ob das gilt. Die Mappe rechnet ohne diese ' +
		'Klausel. Wollen Sie sie anwenden, sagen Sie das vor der Abstimmung über dieses Traktandum und ' +
		'halten Sie es im Protokoll fest; ein so gefasster Beschluss könnte angefochten werden. Bei ' +
		'Gleichstand gilt dann die Zeile «Ergebnis» nicht: Prüfen Sie den Stichentscheid von Hand wie bei ' +
		'Traktanden, die diese Mappe nicht rechnet. ' +
		// Runde 3, R3-L-5: an einer Zeile der Mappe ablesbar.
		'Gleichstand heisst: Ja und Nein sind gleich viele und ergeben zusammen die Zahl in der Zeile ' +
		'«Bezugsgrösse Kopfstimmen». Sind sie gleich viele, ergeben aber weniger, fehlt dem Antrag das ' +
		'Mehr. ' +
		(person
			? 'Zählen die Köpfe nicht, gilt dasselbe für die Wertquoten und die Zeile «Bezugsgrösse ' +
				'Wertquoten». '
			: '') +
		(quoten
			? 'Beim einfachen Mehr nach Köpfen rechnet die Zeile «Ergebnis» den Stichentscheid nach ' +
				'Wertquoten: Bei Gleichstand gewinnt die Seite, hinter der mehr Wertquoten stehen. '
			: '') +
		(person
			? `Steht in der Zeile «Ergebnis» «GLEICHSTAND»${quoten ? ', weil auch die Wertquoten gleich sind' : ''}, ` +
				(person === 'verwalter'
					? 'lassen Sie den Verwalter gleich im Saal entscheiden und verkünden das Ergebnis. ' +
						// Runde 3, R3-L-4: dasselbe Wort wie sonst.
						'Ist er nicht im Saal, ist der Antrag abgelehnt. Beim Verwalter ' +
						streitVerwalter('dem Verwalter')
					: 'entscheidet, wer den Vorsitz führt, gleich im Saal; verkünden Sie das Ergebnis. ' +
						'Führt ein Eigentümer den Vorsitz, gilt sein Entscheid. Führt ihn die Verwaltung, ' +
						streitVerwalter('der Verwaltung')) +
				'Tragen Sie das Ergebnis nach, sobald der Server wieder da ist. '
			: '') +
		'Für Traktanden, die diese Mappe nicht rechnet, prüfen Sie einen Gleichstand von Hand' +
		(quoten ? ' und vergleichen die Wertquoten von Ja und Nein.' : '.')
	);
}

/**
 * Der Satz zu den Spalten «zum Vergleich» am Fuss der Mappe (A3). Fach- und
 * Laienprüfung A3: wer die Rechnung des Traktandums bestimmt hat (L-2), ein
 * Satz zum Vorlesen (L-3), wer anficht und wo (F-2, L-4, Frage 44), und die
 * Ablehnung, die das Gericht nur aufhebt (F-1; Rz. 234, 235a ad Art. 712m).
 * Die Einsprache nennt ihre eigene Frist (F-6, `einspracheMappensatz`).
 */
export const VERGLEICH_MAPPENSATZ =
	'Eine Spalte «zum Vergleich» zählt die Stimmen des Traktandums links davon nach einer anderen ' +
	'Rechnung; welcher, steht in ihrer Zeile «Nötiges Mehr». Dort tragen Sie nichts ein. Es gilt das ' +
	'Ergebnis des Traktandums: Seine Rechnung stand beim Herunterladen der Mappe fest, eingestellt von ' +
	'Ihrer Gemeinschaft oder vorher festgelegt von der Leitung. Steht in der Zeile «Weicht vom ' +
	// Runde 3, R3-L-1 und R3-F-1: das Ergebnis, wer anficht und ab wann (Art. 75; Frage 44).
	'Traktandum ab?» JA, sagen Sie der Versammlung: «Es gilt dieses Ergebnis: Der Antrag ist ' +
	'angenommen (oder: abgelehnt). Nach der anderen Rechnung wäre er anders ausgegangen. Wer nicht so ' +
	'gestimmt hat, wie es ausgegangen ist, kann den Beschluss deshalb beim Gericht anfechten, innert ' +
	'eines Monats; wer hier oder vertreten ist, ab heute». Halten Sie beide Ergebnisse im Protokoll ' +
	'fest. Für Abwesende beginnt die Frist in der Regel mit dem Protokoll. Eine Ablehnung hebt das ' +
	// Runde 4, R4-F-2: Rz. 235a ad Art. 712m kennt Ausnahmen.
	'Gericht in der Regel nur auf; angenommen ist der Antrag damit in der Regel nicht. ' +
	// Runde 3, R3-F-4, und Runde 4, R4-L-4: «offen» nach einem Stichentscheid einer Person.
	'Steht in dieser Zeile «offen», vergleichen Sie nach dem Stichentscheid die beiden Ergebnisse ' +
	'selbst; weichen sie ab, gehen Sie vor wie bei JA.';

/**
 * T3, F4a (Zweig `drittel`; S15, Ort 3 sinngemäss, Auszählmappe; Entscheid
 * 0039; Prüfdatei `quellen/pruefung/zu-pruefen-2026-11-04-votum-f4a-saetze-runde3.md`):
 * was die Leitung der Versammlung vor der Abstimmung sagt: ein Nebensatz zu
 * «sagen Sie der Versammlung vorher», dazu ein zweiter Satz, der «nichtig»
 * erklärt.
 */
// Laienprüfung Runde 3, L3-2: «nichtig» erklärt, wie an Ort 3.
export const L5_MAPPE_VORBEHALT =
	'dass ein Beschluss angefochten werden könnte, unter Umständen sogar nichtig wäre. Nichtig heisst: ungültig ' +
	'auch ohne Anfechtung';

/**
 * Der Satz zu neuen Traktanden der zweiten Versammlung am Fuss der Mappe (L5,
 * A3). Nach der Vorgabe `erste` rechnet das Traktandum mit der
 * Beschlussfähigkeit einer ersten, die Spalte «zum Vergleich» ohne sie; nach
 * `drittel` umgekehrt. Die Folgen wie in der Leitung (`neuAnZweiterHinweis`),
 * mit der Ankündigung in der Einladung (L-8; Rz. 49 ad Art. 712p), Eigentümern
 * und Wertquoten (F-8), dem Notfall (F-7; Art. 712s Abs. 1) und dem, was
 * massgebend ist (L-9, L-10).
 */
export function neuAnZweiterMappensatz(wahl: Neutraktandenwahl): string {
	const kopf =
		'Ein Traktandum mit «Neu an der zweiten Versammlung» stand in der Einladung zur ersten nicht zur Abstimmung. ' +
		'Abstimmen darf die Versammlung darüber nur, wenn es in der Einladung zu dieser Versammlung ' +
		'stand. Die Zeile «Beschlussfähig wie eine erste Versammlung» rechnet aus der Spalte «anwesend», ' +
		'ob so viele Eigentümer und Wertquoten anwesend oder vertreten sind wie an einer ersten. Jeder ' +
		'Eigentümer zählt dort einmal. ';
	return wahl === 'erste'
		? kopf +
				'Ihre Gemeinschaft lässt über das Traktandum nur dann verbindlich abstimmen. Sonst steht im ' +
				'Ergebnis «NICHT VERBINDLICH»: Die Versammlung kann ihre Meinung abgeben, das ist aber kein ' +
				'Beschluss. Setzen Sie das Geschäft dann auf die Liste einer späteren Versammlung. Droht ein ' +
				'Schaden, darf die Verwaltung die dringlichen Massnahmen dagegen ohne Beschluss treffen, nicht ' +
				// Runde 4, R4-F-1 und R4-L-5: «kann oder will nicht» (Rz. 27 ad Art. 712s).
				'das ganze Geschäft (ZGB Art. 712s Abs. 1). Kann oder will sie nicht rechtzeitig eingreifen, ' +
				'darf es jeder Eigentümer (ZGB Art. 647 Abs. 2 Ziff. 2). Massgebend ist die Zeile «Ergebnis». ' +
				// Runde 4, R4-L-1: welcher Satz gilt.
				'Steht dort «NICHT VERBINDLICH», sagt die Zeile «Weicht vom Traktandum ab?» «kein Beschluss»; ' +
				'den Satz zum Vorlesen bei den Spalten «zum Vergleich» lesen Sie dann nicht vor. Die Spalte ' +
				'«zum Vergleich» zeigt ' +
				'nur, wie es mit der Beschlussfähigkeit der zweiten Versammlung ausginge, nach Gesetz einem ' +
				'Drittel der Eigentümer.'
		: kopf +
				'Ihre Gemeinschaft lässt darüber auch mit der Beschlussfähigkeit der zweiten Versammlung ' +
				'abstimmen, nach Gesetz einem Drittel der Eigentümer. Ob das genügt, ist nicht geklärt. Sagt ' +
				'die Zeile «ja», ist die Frage ohne Folge. Sagt sie «nein», können Sie abstimmen lassen; sagen ' +
				`Sie der Versammlung vorher, ${L5_MAPPE_VORBEHALT}. Die Spalte «zum ` +
				'Vergleich» zeigt dann «NICHT VERBINDLICH».';
}

/**
 * Was eine Spalte aus einem Erfordernis rechnet, mit denselben Merkmalen wie
 * die Zählung im Saal. **Eine Stelle für Downloadweg und Ausfallseite**
 * (`brauchtAuszaehlmappe`): Vorher bildeten beide den Posten selbst, und die
 * Ausfallseite kannte nicht alle Merkmale (04.09.2026). `null`, wo das Mehr
 * keine Kopfschwelle hat und sich nicht rechnen lässt.
 */
export function mappenrechnungAus(
	e: Erfordernis,
	m: Pick<Snapshot, 'headCountMode'>
): Mappenrechnung | null {
	if (!e.kopfSchwelle && !nurNachWertquoten(e)) return null;
	return {
		erfordernis: e.titel,
		kopfbasis: e.kopfbasis,
		kopfSchwelle: e.kopfSchwelle,
		quotenbasis: e.quotenbasis,
		quotenSchwelle: e.quotenSchwelle,
		enthaltungZaehltMit: e.enthaltungZaehltMit,
		ohneBetroffene: betroffeneStimmenNichtMit(e),
		vollmachtenBetroffenerZaehlenNicht: vollmachtenBetroffenerZaehlenNicht(e),
		beklagtenwohnungZaehltMit: beklagtenwohnungZaehltMit(e),
		ausstandFaelltHeraus: ausstandFaelltAusDemNenner(e),
		ausstandBleibtInDerZahl: ausstandBleibtInDerZahl(e),
		ausstandNachZaehlweise: ausstandBleibtUnterAllen(e),
		ausschlussklage: e.knotenId === AUSSCHLUSSKLAGE_KNOTEN,
		// Die Zählweise dieses Postens (L3, die Einsprache je Eigentümer).
		zaehlweise: zaehlweiseFuer(e, m),
		stichentscheidMoeglich: e.typ !== 'einstimmigkeit' && stichentscheidMoeglich(e)
	};
}

/**
 * Der Posten eines Traktandums mit seinen Vergleichen (A3). Die zweiten
 * Ergebnisse kommen aus `vergleicheZu`, also aus denselben Erfordernissen, nach
 * denen `zaehleAus` sie rechnet; L5 kommt dazu, weil es im Kern keine zweite
 * Rechnung ist, sondern eine Sperre beim Eröffnen.
 */
export function mappenpostenAus(
	t: { nummer: string; titel: string },
	e: Erfordernis,
	m: Pick<Snapshot, 'headCountMode'>,
	l5: { neuAnZweiter: boolean; wahl: Neutraktandenwahl }
): Mappenposten | null {
	const r = mappenrechnungAus(e, m);
	if (!r) return null;
	const vergleiche: Mappenvergleich[] = [];
	const ohneRechnung: string[] = [];
	for (const v of vergleicheZu(e, m)) {
		/*
		 * **L10 rechnet die Mappe nicht** (Codeprüfung E1 Block D, H1): Beide
		 * Wahlen unterscheiden sich nur darin, ob die Leitung die Angehörigen im
		 * Ausstand mit 7 oder mit 9 einträgt; aus denselben Einträgen lassen sich
		 * nicht beide Ergebnisse bilden. Die Spalte zeigte dasselbe wie die
		 * Hauptrechnung, und ihre Anleitung «die 7» stünde unter «fallen_heraus»
		 * gegen die eingestellte Wahl. Das Ergebnis nach der anderen Wahl nennt
		 * Votum nach der Auszählung im Saal.
		 */
		if (v.worte.kennung === 'L10') continue;
		const rechnung = mappenrechnungAus(v.erfordernis, m);
		if (rechnung) vergleiche.push({ kennung: v.worte.kennung, wahl: v.worte.wahl, verlangt: v.worte.verlangt, rechnung });
		else ohneRechnung.push(v.worte.wahl);
	}
	if (l5.neuAnZweiter) {
		const andere: Neutraktandenwahl = l5.wahl === 'erste' ? 'drittel' : 'erste';
		vergleiche.push({
			kennung: 'L5',
			wahl: wahlInWorten('L5', andere).replace(/ \(Vorgabe\)$/, ''),
			verlangt: lesartVon('L5')?.wahlen.find((w) => w.wert === andere)?.imSatz ?? andere,
			rechnung: { ...r, nurBeschlussfaehigWieErste: andere === 'erste' }
		});
	}
	return {
		...r,
		nummer: t.nummer,
		titel: t.titel,
		...(l5.neuAnZweiter ? { neuAnZweiter: true, nurBeschlussfaehigWieErste: l5.wahl === 'erste' } : {}),
		...(vergleiche.length > 0 ? { vergleiche } : {}),
		...(ohneRechnung.length > 0 ? { vergleicheOhneRechnung: ohneRechnung } : {})
	};
}
