/**
 * Die Auszählung (Story 5.2, FR-39, AD-1, AD-2, AD-15, AD-16).
 *
 * Eine reine Funktion: hinein gehen Momentaufnahme, Erfordernis, Stimmen und
 * der beim Schliessen festgeschriebene Anwesenheitsstand (bei einer
 * Handzählung der beim Zählen, Migration 156) — heraus kommt ein Ergebnis.
 * Keine Datenbank, keine Uhr, kein Zufall. Das ist kein Selbstzweck:
 * Wird ein Beschluss angefochten, ist genau diese Rechnung vorzulegen, und sie
 * muss sich mit denselben Eingaben beliebig oft wiederholen lassen.
 *
 * **Drei Entscheide, die das Vorgängerprojekt anders getroffen hatte:**
 *
 * 1. **Die Kopfstimme sitzt an der Person, nicht an der Einheit** (AD-2). Im
 *    Alt-Repo trug jede Einheit ihr `head_weight`; wer drei Einheiten besass,
 *    hatte drei Kopfstimmen. Nach ZGB Art. 712o Abs. 1 ist das der Sonderfall.
 *
 * 2. **Eine fehlende Stimme ist keine Enthaltung** (AD-15). Das Alt-Repo setzte
 *    sie still auf «Enthaltung». Weil eine Enthaltung beim einfachen Mehr wie
 *    ein Nein wirkt, entschied diese Voreinstellung über Annahme und Ablehnung.
 *    Hier sind es fünf getrennte Eimer, die nie ineinander überführt werden.
 *
 * 3. **Der Anwesenheitsstand wird nicht hier aufgelöst** (AD-16). Er kommt
 *    fertig herein — festgeschrieben in dem Augenblick, in dem die Abstimmung
 *    geschlossen wurde. Löste ihn die Auszählung selbst auf, änderte sich das
 *    Ergebnis, sobald jemand nach der Abstimmung den Saal verlässt.
 *
 * Die Schwellen kommen als Brüche aus dem Erfordernis, das beim Setzen am
 * Traktandum eingefroren wurde (AD-4). Der Kern rechnet nur; er weiss nicht,
 * dass «mehr als die Hälfte» die gesetzliche Mehrheit ist.
 */
import { istKalendertag } from './datum';
import { kopfgewicht, traegtKopfstimme } from './eigentuemer';
import { FachlicherFehler, personenstufe, quotenstufe } from './gemeinschaft';
import { schwelle as schwellenwert, schwelleInWorten } from './mehrheit';
import {
	AUSSCHLUSSKLAGE_KNOTEN,
	angehoerigenlesartWirkt,
	ausstandBleibtInDerZahl,
	ausstandBleibtUnterAllen,
	beklagtenwohnungZaehltMit,
	betroffeneStimmenNichtMit,
	betroffenenzustimmungVon,
	EINSPRACHE_KNOTEN,
	l3Wirkt,
	ohneBetroffeneZusatz,
	gesetzesmassZaehlbar,
	RUECKKOMMEN_TITEL,
	zaehlweiseFuer,
	type Erfordernis,
	type Gesetzesmass
} from './entscheidbaum';
import type { Betroffenenzustimmung, Kopfbasis, Quotenbasis } from './regelwerk';
import type { HeadCountMode, Id, Snapshot, SnapshotParty, Stichentscheid, Vote, VoteChoice } from './types';
import { erfordernisluecke } from './abstimmung';
import { vergleicheMasse, type Mehrmasse } from './reglement';
import { keinBeschlussSatz, type KeinBeschluss } from './ausnahmen';
import { KONSULTATIV_WERTUNG, KONSULTATIV_WERTUNG_NEU } from './konsultativ';
import {
	kopfbasisStreit,
	VERTRETERGRENZE,
	ZIRKULARBESCHLUSS_KNOTEN
} from './mehrhinweise';
import {
	andereKopfzaehlweise,
	angehoerigenlesartVon,
	ausstandBleibtNachZaehlweise,
	ausstandFestSatz,
	ausstandslesartKartensatz,
	ausstandslesartSatz,
	ausstandswahlVon,
	einsprachelesartVon,
	erfordernisNachAndererLesart,
	kopfzaehlweiseDesMehrs,
	kopfzaehlweiseVerdraengt,
	kopfzaehlweiseWirkt,
	lesartVon,
	NOTWENDIGE_ARBEITEN_ARTIKEL,
	wahlInWorten,
	LESARTEN_VORGABE,
	type Angehoerigenlesart,
	type AngewandteLesart,
	type Ausstandswahl,
	type Einsprachewahl,
	type Kopfzaehlweise,
	type Verwaltungsvollmachtwahl
} from './lesarten';
import { istVertreterkennung } from './vollmacht';

export interface Auszaehlungslage {
	momentaufnahme: Snapshot;
	/** Das am Traktandum eingefrorene Erfordernis samt Fassungskennung (AD-4). */
	erfordernis: Erfordernis;
	stimmen: Vote[];
	/**
	 * Der beim Schliessen festgeschriebene Stand — Kennungen der Parteien (AD-16);
	 * bei einer Handzählung der beim Zählen (Migration 156).
	 */
	anwesende: Id[];
	/** Die namentlich zugewiesenen unmittelbar Betroffenen. */
	betroffeneParteiIds?: Id[];
	/**
	 * Wer bei diesem Traktandum in den **Ausstand** getreten ist (ZGB Art. 68
	 * i.V.m. Art. 712m Abs. 2).
	 *
	 * **Nicht dasselbe wie eine Enthaltung.** Wer im Ausstand ist, gibt keine
	 * gültige Stimme ab: Seine unter Verletzung von Art. 68 ZGB abgegebene
	 * Stimme ist «als ungültig zu betrachten und nicht zu zählen»
	 * (BGE 134 III 481 E. 3.9; nach E. 3.8 gilt das auch, soweit er einen
	 * anderen vertritt). Wer sich enthält, bleibt dagegen im Regelfall in der
	 * Bezugsgrösse und wirkt dort wie ein Nein.
	 *
	 * **«Im Regelfall», weil auch das an einer Einstellung hängt.** Hat eine
	 * Gemeinschaft `enthaltungZaehltMit === false` hinterlegt und steht die
	 * Bezugsgrösse auf den Anwesenden, fällt die Enthaltung aus der Basis und
	 * **hilft** dem Antrag, statt wie ein Nein zu wirken (`enthaltungAusBasis`
	 * weiter unten, und dieselbe Kennzeichnung an `quotenbasisWert`). Bis zum
	 * 23.09.2026 stand der Satz hier unbedingt da.
	 *
	 * **Und darin liegt der Unterschied zur Bezugsgrösse, den dieser Kommentar
	 * bis zum 23.09.2026 falsch beschrieben hat** (Befund R-3). Er sagte, der
	 * Ausständige falle «ganz heraus, Köpfe und Wertquoten», und das gilt für die
	 * Wertquoten nicht durchgehend.
	 *
	 * **Es hängt an der Bezugsgrösse des Erfordernisses, und zwar an beiden.**
	 * Die erste Fassung dieser Berichtigung sagte pauschal, die
	 * Wertquotenschranke bleibe unverändert; das tauschte eine zu grobe Aussage
	 * gegen eine andere (Code-Review vom 23.09.2026, Befund 1). Nachgemessen an
	 * `quotenbasisWert` und `abwesendeZaehlenMit`:
	 *
	 *   * `quotenbasis === 'alle_quoten'`: Die Schranke bemisst sich am gesamten
	 *     Stockwerkeigentum und bleibt unverändert (**Rz. 191 ad Art. 712m**).
	 *     Der Ausstand nimmt die Stimme, nicht die Quote aus der Gemeinschaft.
	 *   * `quotenbasis === 'anwesend_vertreten'`: Die Basis ist die Summe über
	 *     den Stimmenspiegel, und der Ausständige steht nicht darin. Seine Quote
	 *     fällt hier also sehr wohl aus der Bezugsgrösse.
	 *   * Bei den Köpfen zählen nur unter `kopfbasis === 'anwesend_vertreten'`
	 *     bloss die Anwesenden und Vertretenen. Unter `alle_eigentuemer` und
	 *     `alle_ausser_betroffene` zählen die Abwesenden mit, und dass der
	 *     Ausständige trotzdem herausfällt, ist keine Selbstverständlichkeit,
	 *     sondern eine strittige Entscheidung.
	 *
	 * **Und sie wird nur in einem der beiden Fälle ausgesprochen.** Der Hinweis
	 * weiter unten in dieser Datei hängt an `kopfbasis === 'alle_eigentuemer'`
	 * und ist im Wortlaut auf die Einstimmigkeit gemünzt. Unter
	 * `alle_ausser_betroffene` fällt der Ausständige still heraus, ohne dass die
	 * Karte die Frage nennt. Das ist Bestand und nicht aus diesem Block; es steht
	 * hier, weil eine frühere Fassung dieses Kommentars das Gegenteil behauptet
	 * hat (Code-Review vom 23.09.2026, zweiter Durchgang, B8).
	 *
	 * Die Rechnung macht das seit je richtig, der Prosatext daneben nicht.
	 *
	 * **Was der Entscheid nicht sagt.** Ob die Quotenschranke sinkt, wenn jemand
	 * in den Ausstand tritt, beantwortet BGE 134 III 481 nicht: Dort waren die
	 * beiden Ausgeschlossenen die einzigen Teilnehmer, die Konstellation eines
	 * Ausgeschlossenen neben anderen Anwesenden lag gar nicht vor.
	 * Seit Migration 170 ist sie die Lesart L1 der Gemeinschaft (Vorgabe: die
	 * Quote bleibt); `ausstandshinweis()` nennt die Frage ungeklärt und sagt,
	 * nach welcher Lesart diese Versammlung rechnet (`ausstandslesartSatz`).
	 *
	 * **Nicht zu verwechseln mit den unmittelbar Betroffenen** (`alle_ausser_
	 * betroffene`, ZGB Art. 649b Abs. 2): Die stehen im Gesetz und folgen aus
	 * dem Erfordernis. Der Ausstand wird von der Sitzungsleitung erklärt und
	 * begründet, Fall für Fall.
	 */
	imAusstand?: Id[];
	/**
	 * L8 (Migration 184): Die Kennungen des Ausstands, der aus der Einstellung
	 * der Gemeinschaft kommt — die Verwaltung als Vertreterin ohne Partei an
	 * einem Traktandum mit Häkchen, nie erklärt (ein erklärter Ausstand steht
	 * in `imAusstand` und braucht kein Merkmal). Kommt festgeschrieben herein,
	 * aus `attendance_json.ausstandVerwaltung`: Unter «Vollmachten ruhen»
	 * stehen die Kennungen auch in `imAusstand`, unter «Die Sitzungsleitung
	 * entscheidet» nur hier, und das zweite Ergebnis rechnet nach der anderen
	 * Wahl. Wird nie gespeichert und nie verkündet; deshalb an der Lage und
	 * nicht am Erfordernis (wie `vertretungImAusstandInDerZahl`).
	 */
	ausstandAusVerwaltung?: Id[];
	/**
	 * Die beim Schliessen wirksamen Vertretungen — wer für wen ausübt.
	 *
	 * Gebraucht für **eine** Regel: Wer vom Stimmrecht ausgeschlossen ist, kann
	 * auch niemanden vertreten (siehe `ruhendeVertretungenBei`). Sie kommt
	 * festgeschrieben herein, aus demselben Grund wie der Anwesenheitsstand
	 * (AD-16) — eine nachher widerrufene Vollmacht verschöbe sonst rückwirkend
	 * das Ergebnis einer Abstimmung von 20:00 Uhr.
	 *
	 * Nur Vertretungen **durch eine Partei dieser Versammlung**. Eine dritte
	 * Person ist nicht stimmberechtigt und kann darum auch nicht in den Ausstand
	 * treten; für sie gibt es hier nichts zu prüfen.
	 */
	vertretungen?: Vertretung[];
	/**
	 * Nur für das zweite Ergebnis zu B3 (F4c, `mitVertretungImAusstand`): Eine
	 * Partei, deren einziger Vertreter im Ausstand ist, bleibt in der
	 * Bezugsgrösse der Anwesenden und Vertretenen, ohne Stimme. Nach Rz. 181 ad
	 * Art. 712m fliessen ungültige Stimmen in die Berechnung ein, und ungültig
	 * ist die Stimme des Vertreters im Ausstand (BGE 134 III 481 E. 3.9). Wird
	 * nie gespeichert und nie verkündet; deshalb an der Lage und nicht am
	 * Erfordernis.
	 */
	vertretungImAusstandInDerZahl?: boolean;
	/**
	 * Der Entscheid einer Person bei Stimmengleichheit, wo das Reglement ihn
	 * vorsieht (Stichentscheid `verwalter`).
	 *
	 * **Wird wieder ausgewertet** (Produktentscheid 28.09.2026). Vom 27.09.2026
	 * bis dahin rechnete das Werkzeug bei Gleichstand nach dem Gesetz und liess
	 * die Klausel liegen; jetzt gilt sie wieder, und die Person trägt ihren
	 * Entscheid ein. Solange er fehlt, hält die Auszählung an
	 * (`stichentscheidOffen`).
	 */
	stichentscheid?: Stichentscheidbefund;
	/**
	 * Die Abstimmung ist geheim (Migration 141, Produktentscheid 28.09.2026).
	 *
	 * Am Durchgang festgehalten und beim Rechnen nur durchgereicht: Die
	 * Anzeigen unterdrücken die Zahlen, nicht die Zählung. Fehlt der Wert, ist
	 * die Abstimmung offen — so verhalten sich alle Durchgänge vor Migration
	 * 141 und die von Hand festgehaltenen Beschlüsse.
	 */
	geheim?: boolean;
	/**
	 * Die Betroffenen mit einem **Vorab-Vermerk**: Zustimmung vor der
	 * Versammlung, schriftlich (ZGB Art. 712g Abs. 4; SVIT-Kommentar 2023,
	 * Art. 712g Rz. 209), erfasst im Saal durch die Sitzungsleitung.
	 *
	 * Nur bei der Form `im_saal_oder_vorab` wirksam; bei `nachher` gibt es den
	 * Vermerk nicht. Fehlt die Liste, gibt es keine Vorab-Zustimmungen. So
	 * verhält sich jeder Durchgang, der vor dem Schreibweg aus Block A2
	 * (Erfassung im Saal) geschlossen wurde.
	 */
	vorabZustimmungen?: Id[];
	/**
	 * Die Veto-Entscheide der Betroffenen im Ausstand, je Partei der letzte
	 * (Auftrag vom 26.09.2026). Nur bei der Form `im_saal_oder_vorab` und nur
	 * für Parteien im Ausstand wirksam; fehlt die Liste, gibt es keine
	 * Entscheide. So verhält sich jeder Durchgang, der vor dem Schreibweg aus
	 * Migration 125 geschlossen wurde.
	 */
	vetoEntscheide?: VetoEntscheid[];
	/**
	 * Die beklagten Parteien mit gemeinsamem Eigentum, bei denen **alle**
	 * Eigentümer der Wohnung beklagt sind (Angabe am Traktandum, Migration 132).
	 *
	 * **Warum es die Angabe braucht** (Fachprüfung 30.09.2026, F3-1): Bei
	 * Gesamteigentum, etwa einer Erbengemeinschaft oder einer ehelichen
	 * Gütergemeinschaft, richtet sich die Klage gegen alle (SVIT-Kommentar 2023,
	 * Rz. 216 ad Art. 712a). Dann bleibt an der Wohnung niemand, den Art. 649b
	 * Abs. 2 in der Zahl liesse, und die Wohnung fällt heraus wie ein Beklagter
	 * mit Alleineigentum. Ohne Angabe gilt «nur eine Person beklagt»
	 * (Produktentscheid 30.09.2026), die strengere Zahl.
	 *
	 * Wirkt nur, wo `beklagtenwohnungZaehltMit` gilt; sonst fällt die beklagte
	 * Partei ohnehin ganz heraus. Fehlt die Liste, gilt für alle «nur eine
	 * Person». So verhält sich jeder Durchgang, der vor Migration 132
	 * geschlossen wurde.
	 */
	alleEigentuemerBeklagt?: Id[];
	/**
	 * Ob dieses Traktandum der Rückkommensantrag auf einen angenommenen
	 * Beschluss ist (B2b). **Nicht am Titel erkannt** (Fachprüfung F4c B2,
	 * Runde 2, R2-F-3): Regelt das Reglement das Rückkommen eigens, trägt das
	 * Erfordernis dessen Titel, nicht `RUECKKOMMEN_TITEL`.
	 */
	rueckkommenAufAnnahme?: boolean;
	/**
	 * Der Durchgang nach einem angenommenen Rückkommen auf einen angenommenen
	 * Beschluss (B2b, Befunde zur Prüfdatei B2-F-6): «Nein heisst Nein», eine
	 * Ablehnung hebt den Beschluss auf. Unter L6 «Nach dem Gesetz» hängt das
	 * zweite Ergebnis daran, ob Beschluss und Rückkommen die Ja-Stimmen aller
	 * hatten.
	 */
	nachRueckkommen?: {
		/** Die Nummer des Rückkommensantrags, etwa «1.1». */
		traktandum: string;
		/** Der Durchgang, dessen Beschluss dieser ersetzt. */
		geltenderDurchgang: number;
		beschlussMitAllen?: boolean;
		rueckkommenMitAllen?: boolean;
	};
}

/**
 * Der Weg eines Veto-Entscheids, wie Auswertung, PDF und Protokoll ihn nennen.
 *
 * **Die Vertretung wird genannt** (Code-Review 26.09.2026, M2), wie beim
 * Widerruf durch ein Nein im Saal seit A2 (Fachprüfung V2 c). Vorher stand
 * «am eigenen Gerät» auch dann, wenn die Vertretung an ihrem Gerät entschieden
 * hatte, und der Nachweis sagte, die Betroffene habe selbst entschieden.
 */
export function vetoWegInWorten(v: Pick<VetoEntscheid, 'weg' | 'durchVertretung'>): string {
	// Nicht «über die Sitzungsleitung»: Das las sich im PDF, als habe die
	// Leitung für sie zugestimmt (Laienprüfung Runde 9, Stelle 5).
	if (v.weg === 'leitung') return 'mündlich, von der Sitzungsleitung erfasst';
	return v.durchVertretung ? 'durch ihre Vertretung' : 'am eigenen Gerät';
}

/**
 * Ein Veto-Entscheid einer Betroffenen im Ausstand (ZGB Art. 712g Abs. 4).
 *
 * **Der Anlass** (Produktentscheide vom 26.09.2026): «Ob er es der
 * Sitzungsleitung sagt oder per Knopf tippt, die Wirkung ist dieselbe.»
 * Bis dahin zählte im Ausstand allein die schriftliche Vorab-Zustimmung;
 * wer im Saal war, konnte seine Zustimmung nicht äussern, weil der Ausstand
 * die Stimme sperrt.
 *
 * **Keine Stimme.** Das Veto zählt nur als Zustimmung, nie bei der Mehrheit;
 * die Partei bleibt in keiner Bezugsgrösse. Die Rechnung steht im
 * Ausstand-Zweig von `zaehleOhneWirkung`.
 */
export interface VetoEntscheid {
	parteiId: Id;
	entscheid: 'ja' | 'nein';
	/** `telefon`: am eigenen Gerät; `leitung`: mündlich, von der Leitung erfasst. */
	weg: 'telefon' | 'leitung';
	/** Wahr, wenn die Vertretung das Veto ausgeübt hat. */
	durchVertretung: boolean;
}

/** Eine wirksame Vollmacht, auf die Kennungen der Stammdaten gebracht. */
export interface Vertretung {
	vertreteneId: Id;
	/**
	 * Die Partei, die vertritt, oder bei einem Vertreter ohne Partei dessen
	 * Kennung (`vertreterkennung`, Migration 167, Ä-26).
	 */
	bevollmaechtigtId: Id;
	/**
	 * Der Name eines Vertreters ohne Partei. Parteien heissen, wie die
	 * Momentaufnahme sie nennt; einen Vertreter ohne Partei kennt sie nicht.
	 * Fehlt in Ständen von vorher.
	 */
	bevollmaechtigtName?: string;
}

export interface Stichentscheidbefund {
	wahl: 'yes' | 'no';
	/** Wer entschieden hat. Im Protokoll der Nachweis der Befugnis. */
	wer: string;
	begruendung?: string;
	/**
	 * Die Person im Vorsitz ist selbst Stockwerkeigentümer (Migration 150).
	 * Ihr Stichentscheid, den manche Reglemente eine zweite Stimme nennen,
	 * geht nicht in die Zählung ein; sonst stünde bei drei Einheiten «2 zu 1»
	 * im Protokoll.
	 */
	eigentuemer?: boolean;
}

/**
 * Fünf Eimer, die nie ineinander überführt werden (AD-15).
 *
 * Welche davon in die Bezugsgrösse zählen, entscheidet allein die Basis des
 * Erfordernisses — nicht der Ergebnistyp. Bei ZGB Art. 649b Abs. 2 gilt das
 * einfache Mehr, und trotzdem zählen die Abwesenden mit.
 */
export interface Stimmenspiegel {
	ja: number;
	nein: number;
	enthaltung: number;
	/** Anwesend, aber nicht abgegeben. Ein eigener Eimer, nie eine Enthaltung. */
	ohneAbgabe: number;
	/** Nicht erschienen und nicht vertreten. */
	nichtAnwesend: number;
	/**
	 * Stimmt nicht ab: die gemeinsame Wohnung des Beklagten an der
	 * Ausschlussklage, wenn nur eine Person beklagt ist
	 * (`beklagtenwohnungZaehltMit`, seit Fassung 2026-10-11). Ob anwesend oder
	 * nicht, sie steht hier und nicht unter `nichtAnwesend` (Codeprüfung
	 * 30.09.2026, N1: das Protokoll nannte die anwesende Wohnung sonst «nicht
	 * anwesend»). Bei den Köpfen steht sie in der Bezugsgrösse; bei den
	 * Wertquoten nur, wo die Quotenbasis alle Quoten umfasst.
	 *
	 * Bei den Wertquoten unter dem Mehr aller Wertquoten auch die eigene Quote
	 * des Beklagten, in jeder Fassung (seit 30.10.2026, A2): Sie steht im
	 * Nenner und stimmt nicht ab.
	 *
	 * Fehlt der Wert, war er null. So lesen sich Ergebnisse, die vorher
	 * festgeschrieben wurden.
	 */
	stimmtNicht?: number;
	/**
	 * Im Ausstand, ohne abzustimmen. Zwei Fälle: bei den Köpfen und Wertquoten
	 * die Angehörigen des Beklagten an der Ausschlussklage ab Fassung
	 * 2026-10-25 (1e, `ausstandBleibtInDerZahl`), in der Bezugsgrösse, wo
	 * Abwesende darin stehen; bei den Wertquoten unter `alle_quoten` nach der
	 * Vorgabe von L1 die Quote der Parteien im Ausstand, die im Nenner bleibt.
	 * Fehlt der Wert, war er null.
	 */
	imAusstand?: number;
	/** Die angewandte Bezugsgrösse: die Summe der Eimer, die nach der Basis mitzählen. */
	basis: number;
	/** Wie viele Ja es braucht. Null, wenn es keine Schranke gibt oder die Basis leer ist. */
	schwelle: number | null;
	/** Ob diese Schranke genommen ist. Ohne Schranke: erfüllt. */
	erreicht: boolean;
}

export type Nichtzustimmungsgrund =
	| 'nein'
	| 'enthaltung'
	| 'ohne_abgabe'
	| 'nicht_anwesend'
	/** Einheiten derselben Partei haben verschieden gestimmt — siehe `kopfwahl`. */
	| 'uneinheitlich'
	/**
	 * Die Partei war nur über eine bevollmächtigte Person anwesend, und die ist
	 * bei diesem Traktandum vom Stimmrecht ausgeschlossen: im Ausstand oder, seit
	 * dem 25.09.2026, als Beklagte nach ZGB Art. 649b Abs. 2. Wen nur eine
	 * Reglementsklausel ausnimmt, dessen Vollmacht ruht seit dem 27.09.2026 nicht.
	 *
	 * **Getrennt von «nicht anwesend» geführt**, obwohl es sich gleich auswirkt:
	 * Im Protokoll stünde sonst «nicht erschienen» bei jemandem, dessen Vertreter
	 * im Saal sitzt — und wer die Zeile liest, suchte den Fehler bei der
	 * Anwesenheitsliste statt beim Ausstand.
	 */
	| 'vertretung_ruht'
	/**
	 * Die Partei ist im Ausstand, zugleich als unmittelbar betroffen bezeichnet,
	 * und ein Vorab-Vermerk fehlt. Seit dem Produktentscheid vom 26.09.2026 ist
	 * die Doppelbezeichnung kein Widerspruch mehr: Im Ausstand stimmt sie nicht
	 * mit, zustimmen kann sie schriftlich vor der Abstimmung (siehe den Zweig in
	 * `zaehleAus`). Bis zum 13.08.2026 fiel dieser Fall still durch: Die Partei
	 * stand in keinem Eimer, und die Bedingung galt als erfüllt.
	 */
	| 'im_ausstand'
	/**
	 * Die Betroffene ist im Ausstand und hat über ihr Veto **nicht**
	 * zugestimmt (26.09.2026). Getrennt von `im_ausstand`: Dort fehlt ein
	 * Entscheid, hier liegt einer vor, und er lautet Nein.
	 */
	| 'veto_nein'
	/**
	 * Die Zustimmung war **vorab** erteilt und wurde im Saal widerrufen
	 * (25.09.2026).
	 *
	 * «In der Regel wird diese Voraussetzung entweder mündlich an der
	 * Versammlung erfüllt werden müssen, oder im Vorfeld wird eine
	 * schriftliche Zustimmung eingeholt» (SVIT-Kommentar 2023, Art. 712g
	 * Rz. 209). Kommt beides vor, gilt die **jüngste Äusserung**: Ein Nein im
	 * Saal widerruft den Vorab-Vermerk. Enthaltung und Nichtabgabe tun es
	 * nicht; sie sind keine Äusserung. **Nicht bei geheimer Abstimmung**
	 * (Ä-38): Dort widerruft die Stimme nichts; wer zurückzieht, sagt es offen
	 * vor dem Eröffnen, und die Leitung nimmt den Vermerk zurück.
	 */
	| 'widerrufen'
	/**
	 * Bei **geheimer Abstimmung** ist die Zustimmung nicht offen erklärt
	 * worden (Ä-38, 16.10.2026). Die geheime Stimme zählt dafür nicht: Die
	 * Zustimmung ist eine eigene, offen abzugebende Erklärung (Rz. 209 ad
	 * Art. 712g), und läse Votum sie aus dem Stimmzettel, verriete der Name im
	 * Protokoll die Stimme. Vgl. den Zweig in `zaehleOhneWirkung`. Wer nicht
	 * anwesend war, behält `nicht_anwesend` oder `vertretung_ruht`.
	 */
	| 'nicht_offen';

export interface FehlendeZustimmung {
	parteiId: Id;
	name: string;
	grund: Nichtzustimmungsgrund;
}

/** Ein gezählter Veto-Entscheid, mit dem Namen für die Sätze. */
export interface VetoBefund extends VetoEntscheid {
	name: string;
}

/**
 * Was aus der Zustimmung der unmittelbar Betroffenen geworden ist
 * (ZGB Art. 712e Abs. 2, 712g Abs. 4).
 *
 * **Zwei Formen, zwei Befunde** (25.09.2026, Fachprüfung; siehe
 * `regelwerk.ts`, `Betroffenenzustimmung`):
 *
 *   - `im_saal_oder_vorab`: Ja im Saal, selbst oder vertreten, oder ein
 *     Vorab-Vermerk ohne späteres Nein. Fehlt die Zustimmung, ist der Antrag
 *     abgelehnt.
 *   - `nachher`: Die Zustimmung ist nicht Teil der Annahme. Das Ergebnis trägt
 *     alle Betroffenen unter `ausstehend`; ein Ja im Saal erscheint zusätzlich
 *     unter `zugestimmt`, weil es der erste Schritt zur Unterschrift ist.
 */
export interface Betroffenenbefund {
	noetig: boolean;
	/** Wie die Zustimmung erteilt wird. Auch ohne Pflicht gesetzt (Ersatzwert). */
	form: Betroffenenzustimmung;
	zugestimmt: Id[];
	/** Nur bei `im_saal_oder_vorab` gefüllt; bei `nachher` bleibt die Liste leer. */
	fehlend: FehlendeZustimmung[];
	/**
	 * Zugestimmt, und ein Vorab-Vermerk liegt vor: eine Teilmenge von
	 * `zugestimmt`. **Auch wer zusätzlich im Saal Ja gesagt hat** (festgelegt
	 * mit Block A2, 25.09.2026; `docs/freigabe.md`, Punkt b). Der Vermerk ist
	 * ein eigener Beleg, der unabhängig vom Saal gilt; fiele er bei einem Ja
	 * aus der Liste, verlöre die Auswertung ein Schreiben, das es gibt. Nach
	 * einem Widerruf steht die Partei nicht hier, sondern unter `fehlend`.
	 */
	vorab: Id[];
	/** Nur bei `nachher`: wessen Zustimmung in der Abänderungsurkunde aussteht. */
	ausstehend: { parteiId: Id; name: string }[];
	/**
	 * Die gezählten Veto-Entscheide, je Partei einer, in der Reihenfolge der
	 * Parteien der Momentaufnahme. Nur für
	 * Parteien im Ausstand und nur bei `im_saal_oder_vorab`; bei `nachher` gibt
	 * es sie nicht. Der letzte Entscheid je Partei zählt.
	 */
	veto: VetoBefund[];
	erfuellt: boolean;
}

/**
 * Steht statt eines Namens, wo eine als betroffen bezeichnete Partei gar nicht
 * im Stimmberechtigtenstand steht.
 *
 * **Als Konstante, seit das Protokoll die Namen abdruckt** (28.08.2026): Dort
 * wäre «(nicht im Stand)» in der Zeile «Ohne die nach ZGB Art. 712g Abs. 4
 * nötige Zustimmung» kein Name, bei dem sich nachfragen liesse, sondern eine
 * Verlegenheitsangabe. Wer sie ausfiltert, muss sie erkennen können, ohne eine
 * Zeichenkette zu erraten.
 */
export const NICHT_IM_STAND = '(nicht im Stand)';

/**
 * Die Namen der Betroffenen, deren Zustimmung noch aussteht, mit «, » verbunden.
 *
 * **`NICHT_IM_STAND` fällt weg** (Auftrag A1, Anhang S1): Das ist kein Name, bei
 * dem sich nachfragen liesse, sondern die Angabe, dass eine als betroffen
 * bezeichnete Partei gar nicht im Stimmberechtigtenstand steht. Den Fall nennt
 * der Hinweis daneben; in einer Namensliste wäre er eine Verlegenheitsangabe.
 *
 * Bleibt nach dem Filtern keiner übrig, gibt die Funktion eine leere
 * Zeichenkette zurück. Die Aufrufer lassen dann die Klammer weg, statt «()» zu
 * schreiben.
 */
export function ausstehendeNamen(b: Betroffenenbefund): string {
	return b.ausstehend
		.filter((x) => x.name !== NICHT_IM_STAND)
		.map((x) => x.name)
		.join(', ');
}

/** Ein Vorab-Vermerk, wie Auswertung und PDF ihn nennen (Block A2). */
export interface VorabAngabe {
	parteiId: Id;
	name: string;
	/** Die Angabe des Vermerks, etwa «Schreiben vom 12.09.2026». */
	vermerk: string;
	/**
	 * Ob die Partei beim Schliessen vertreten war. Dann kam ein Nein von der
	 * Vertretung, und der Satz zum Widerruf sagt das (Fachprüfung A2, V2 c).
	 */
	durchVertretung?: boolean;
}

/** Warum eine Zustimmung fehlt, in den Worten der Auswertung (Block A2). */
const FEHLGRUND: Record<Exclude<Nichtzustimmungsgrund, 'widerrufen'>, string> = {
	nein: 'im Saal Nein gesagt',
	nicht_offen: 'nicht offen erklärt; bei geheimer Abstimmung zählt die Stimme dafür nicht',
	enthaltung: 'im Saal der Stimme enthalten',
	ohne_abgabe: 'keine Stimme abgegeben',
	nicht_anwesend: 'nicht anwesend und nicht vertreten',
	uneinheitlich: 'für ihre Einheiten verschieden gestimmt, also kein einheitliches Ja',
	vertretung_ruht: 'ihre Vertretung durfte bei diesem Traktandum nicht stimmen',
	/*
	 * Beschreibend, nicht als Rechtsgrund (Fachprüfung A2, Runde 2): Dass
	 * Ausstand und Zustimmungsrecht einander ausschliessen, ist nicht belegt
	 * (`quellen`, Offen-Liste, Eintrag vom 25.09.2026). Der Satz sagt, was die
	 * Auswertung tut, nicht was gilt. «Die Auswertung» statt «Votum», weil der
	 * Satz ins Protokoll geht und dort niemand weiss, dass Votum die Anwendung
	 * ist (Laienprüfung A2, Runde 3).
	 */
	im_ausstand: 'im Ausstand; weder eine schriftliche Zustimmung vermerkt noch ein Entscheid erfasst',
	veto_nein: 'im Ausstand; hat ausdrücklich nicht zugestimmt'
};

/**
 * Der Satz zur Zustimmung der Betroffenen bei `im_saal_oder_vorab`, für
 * Auswertung und PDF (ZGB Art. 712g Abs. 4).
 *
 * **Eine Quelle für beide.** Bis Block A2 stand der Satz in der Seite und im
 * PDF je von Hand, im PDF mit Doppelpunkt, auf der Seite ohne. Seit sich eine
 * Vorab-Zustimmung erfassen lässt, sagt er mehr, und zwei Abschriften liefen
 * auseinander.
 *
 * **Was dazukommt** (Laien- und Fachprüfung 25.09.2026, Block A2): wer vorab
 * schriftlich zugestimmt hat, mit der Angabe der Sitzungsleitung; beim
 * Widerruf der Zusammenhang wie auf der Leinwand (S4), damit ihn versteht, wer
 * nicht im Saal war; bei den übrigen Fehlenden der Grund, damit niemand aus
 * dem Widerrufssatz daneben auf ein Nein schliesst. Die Namen neben dem
 * Stimmverhalten sind hier der Nachweis (NFR-17, Ausnahme für Betroffene).
 *
 * `vermerke`: alle Betroffenen mit Vorab-Vermerk, auch wer widerrufen hat.
 */
export function zustimmungImSaalOderVorabInWorten(
	b: Betroffenenbefund,
	vermerke: VorabAngabe[]
): string {
	const saetze: string[] = [];
	const vermerkVon = new Map(vermerke.map((v) => [v.parteiId, v]));
	const vetoVon = new Map(b.veto.map((v) => [v.parteiId, v]));
	const vetoWort = vetoWegInWorten;
	const widerrufen = b.fehlend.filter((f) => f.grund === 'widerrufen');
	const uebrige = b.fehlend.filter((f) => f.grund !== 'widerrufen');

	/**
	 * **Niemand erfasst** (Produktentscheid 04.10.2026, Laien- und Fachprüfung,
	 * `quellen/pruefung/berichte/2026-10-04-647d-betroffene.md`, E4): Sind keine
	 * Betroffenen erfasst, sagt der Satz das ausdrücklich. Ein vergessener
	 * Eintrag soll nicht wie eine geprüfte Aussage aussehen; «Die Zustimmung
	 * aller unmittelbar Betroffenen liegt vor.» über einer leeren Liste wäre
	 * genau das. Bei Art. 712g Abs. 4, wo eigentlich immer jemand betroffen
	 * ist, macht der Satz den fehlenden Eintrag sichtbar, statt ihn zu decken.
	 */
	if (b.fehlend.length === 0) {
		const niemandErfasst =
			b.zugestimmt.length === 0 && b.vorab.length === 0 && b.veto.length === 0;
		saetze.push(
			niemandErfasst
				? 'Als unmittelbar betroffen ist niemand erfasst.'
				: 'Die Zustimmung aller unmittelbar Betroffenen liegt vor.'
		);
	}
	for (const f of widerrufen) {
		const v = vermerkVon.get(f.parteiId);
		const veto = vetoVon.get(f.parteiId);
		saetze.push(
			`Es fehlt die Zustimmung von ${f.name}: Sie hatte vorab schriftlich zugestimmt` +
				(v ? ` (laut Sitzungsleitung: ${v.vermerk})` : '') +
				(veto
					? `, im Ausstand aber nicht zugestimmt (${vetoWort(veto)}). `
					: `, ${v?.durchVertretung ? 'durch ihre Vertretung im Saal' : 'im Saal'} aber Nein gesagt. `) +
				'Die Auswertung zählt das spätere Nein; die schriftliche Zustimmung zählt damit nicht mehr.'
		);
	}
	/*
	 * Eine Partei ausserhalb des Stands trägt den Platzhalter als Namen und
	 * keinen belastbaren Grund: Ob sie anwesend war, weiss Votum dann nicht
	 * (Code-Review A2b, Befund 6). **Als eigener Satz**, nicht in der Reihe:
	 * Hinter einem Namen las er sich wie dessen Beifügung (Nachprüfung A2b).
	 */
	const imStand = uebrige.filter((f) => f.name !== NICHT_IM_STAND);
	const ausserhalb = uebrige.length - imStand.length;
	let schonGenannt = widerrufen.length > 0;
	if (imStand.length > 0) {
		const namen = imStand.map((f) => {
			const veto = vetoVon.get(f.parteiId);
			const zusatz = veto ? `, ${vetoWort(veto)}` : '';
			return `${f.name} (${FEHLGRUND[f.grund as keyof typeof FEHLGRUND]}${zusatz})`;
		});
		saetze.push(
			`Es fehlt ${schonGenannt ? 'ausserdem ' : ''}die Zustimmung von ${namen.join(', ')}.`
		);
		schonGenannt = true;
	}
	/*
	 * Wortlaut nach Runde 4 (Laien- und Fachprüfung A2): angelehnt an den
	 * Protokollsatz für denselben Fall, und ohne zu entscheiden, ob es auf
	 * diese Partei ankommt. Nach einer Handänderung muss zustimmen, wer das
	 * Recht jetzt innehat (Rz. 207, 208 ad 712g; Rz. 156 ad 712a).
	 */
	if (ausserhalb > 0) {
		const wer =
			ausserhalb === 1
				? schonGenannt
					? 'Ausserdem steht eine als unmittelbar betroffen bezeichnete Partei'
					: 'Eine als unmittelbar betroffen bezeichnete Partei steht'
				: schonGenannt
					? `Ausserdem stehen ${ausserhalb} als unmittelbar betroffen bezeichnete Parteien`
					: `${ausserhalb} als unmittelbar betroffen bezeichnete Parteien stehen`;
		saetze.push(
			`${wer} nicht im festgehaltenen Stand der Stimmberechtigten; ihre Zustimmung liess sich ` +
				'nicht prüfen, und die Auswertung zählt sie als fehlend. Zustimmen muss, wer das ' +
				'betroffene Recht bei der Beschlussfassung innehat.'
		);
	}
	const zugestimmt = b.vorab
		.map((id) => vermerkVon.get(id))
		.filter((v): v is VorabAngabe => v !== undefined);
	if (zugestimmt.length > 0) {
		saetze.push(
			'Vorab schriftlich zugestimmt: ' +
				zugestimmt.map((v) => `${v.name} (laut Sitzungsleitung: ${v.vermerk})`).join(', ') +
				'.'
		);
	}
	/*
	 * **Die Zustimmung über das Veto** (26.09.2026). Sie steht als eigener
	 * Satz und nicht in der Liste der Fehlenden: Wer über ihr Veto zugestimmt
	 * hat, fehlt nicht, und ihre Zustimmung ist der Grund, weshalb der Antrag
	 * angenommen ist. Ohne diesen Satz stünde im Protokoll nur, dass die
	 * Zustimmung vorliegt, nicht woher sie kam.
	 */
	const vetoJa = b.veto.filter((v) => v.entscheid === 'ja');
	if (vetoJa.length > 0) {
		saetze.push(
			'Zustimmung im Ausstand: ' +
				vetoJa.map((v) => `${v.name} (${vetoWort(v)})`).join(', ') +
				'.'
		);
	}
	return saetze.join(' ');
}

export interface Auszaehlung {
	koepfe: Stimmenspiegel;
	quoten: Stimmenspiegel;
	/**
	 * Bei der Ausschlussklage die beklagten Parteien, deren Wohnung mehreren
	 * gehört, mit der Angabe, ob sich der Antrag gegen alle ihre Eigentümer
	 * richtet (Migration 132). Nur wo die Angabe wirkt
	 * (`beklagtenwohnungZaehltMit`). Das Protokoll nennt daraus die geprüften
	 * Sätze (`beklagtenwohnungSatz`); fehlt das Feld, war das Ergebnis vor dem
	 * 30.09.2026 festgeschrieben.
	 */
	beklagtenwohnungen?: { name: string; alleBeklagt: boolean }[];
	betroffene: Betroffenenbefund;
	/**
	 * Wer in der Bezugsgrösse ist und nicht zugestimmt hat, in der Reihenfolge der
	 * Momentaufnahme. Bei der Einstimmigkeit zeigt sie, an wem es scheiterte;
	 * nachholen lässt sich die Zustimmung nicht (Fassung 2026-10-29). Sonst eine
	 * Auskunft.
	 */
	ohneZustimmung: FehlendeZustimmung[];
	angenommen: boolean;
	/**
	 * Wahr, wenn die Kopfmehrheit allein am Gleichstand gescheitert wäre und erst
	 * der reglementarische Stichentscheid nach Wertquoten sie herbeigeführt hat.
	 *
	 * Getrennt geführt, weil das Ergebnis dann auf einer Regel beruht, die nicht
	 * im Gesetz steht: Wer den Beschluss anficht, greift genau hier an, und dann
	 * muss aus dem Protokoll hervorgehen, dass es so und nicht anders zustande kam.
	 */
	durchStichentscheid: boolean;
	/**
	 * Wahr, solange ein Gleichstand nach dem Reglement noch nicht entschieden
	 * ist: beim Verwalter-Stichentscheid, bis die Person ihren Entscheid
	 * eingetragen hat, und beim Quotenstichentscheid über einer Handzählung,
	 * dessen Anteile sich nicht ablesen lassen.
	 *
	 * Solange das gilt, ist `angenommen` **keine Aussage** — es gibt schlicht noch
	 * kein Ergebnis. Wer den Wert ignoriert und `angenommen` liest, verkündet eine
	 * Ablehnung, die niemand beschlossen hat.
	 */
	stichentscheidOffen: boolean;
	/**
	 * Welche Regel den Gleichstand auflöst, wo einer vorliegt. Null, wo keiner
	 * vorlag. Getrennt vom Ergebnis, weil der Satz fürs Protokoll die Regel beim
	 * Namen nennen muss.
	 */
	stichentscheidArt: 'wertquote' | 'verwalter' | 'vorsitz' | null;
	/**
	 * Die Wertquoten von Ja und Nein, wo sie bei einer Kaskade ebenfalls gleich
	 * standen und deshalb eine Person entschied (Laienprüfung 07.10.2026, L9).
	 * Ohne die Angabe läse niemand im Protokoll, warum die Wertquoten nichts
	 * entschieden haben. Fehlt in Ergebnissen von vorher.
	 */
	wertquotenGleich?: { ja: number; nein: number };
	/**
	 * Geheime Abstimmung (Produktentscheid 28.09.2026, Migration 141).
	 *
	 * Wahr heisst: Die Anzeigen nennen nur «erreicht» oder «nicht erreicht»,
	 * keine Zahlen, aus denen sich Einheiten zurückrechnen lassen. Gerechnet
	 * wird unverändert; die Zahlen bleiben in der Datenbank und im versiegelten
	 * Abschlusspaket. Was hier steht, entscheidet allein über die Ausgabe.
	 */
	geheim: boolean;
	/** Was der Sitzungsleitung auffallen soll, ohne das Ergebnis zu verändern. */
	hinweise: string[];
	/**
	 * Die Vermerke fürs Protokoll, mit eigener Fassung und Ordnung (siehe
	 * `Protokollhinweis`). Fehlt das Feld, gab es sie beim Rechnen noch nicht;
	 * alte festgeschriebene Ergebnisse tragen dann keine dieser Zeilen.
	 */
	protokollhinweise?: Protokollhinweis[];
	/**
	 * Was der Ausstand an den Bezugsgrössen dieses Durchgangs geändert hat, in
	 * Zahlen. `null` ohne Ausstand. Gebildet von `ausstandswirkung()`, gelesen
	 * vom Protokoll. Fehlt der Wert, gab es ihn beim Rechnen noch nicht.
	 */
	ausstandswirkung?: string | null;
	/**
	 * Ob die Wertquoten überhaupt erhoben wurden.
	 *
	 * `false` allein bei der Handzählung (`zaehleSummenAus`): Dort steht im
	 * Quotenspiegel überall null — und «0 ja · 0 nein» liest sich wie ein
	 * Ergebnis, obwohl es keines ist. Wer es nicht unterscheidet, verkündet eine
	 * Zahl, die niemand gezählt hat.
	 *
	 * Fehlt der Wert, sind sie erhoben: So bleiben alte Auswertungen richtig,
	 * ohne dass jede Anzeige es wissen muss.
	 */
	quotenErhoben?: boolean;
	/**
	 * **Kein Beschluss** (Migration 128): Der Durchgang stützte sich auf die
	 * Universalversammlung, und sie hat nicht gehalten, weil jemand
	 * widersprochen hat oder ohne Stimme gegangen ist. Seit Migration 158 auch,
	 * wenn der Durchgang bei fehlender Beschlussfähigkeit konsultativ eröffnet
	 * wurde (Grund `konsultativ`).
	 *
	 * Dann ist zugleich `angenommen` falsch, damit jede Stelle, die nur
	 * `angenommen` liest, in die sichere Richtung fällt: Es gilt nichts als
	 * beschlossen. Wer «abgelehnt» anzeigt, liest `ergebnislage`, und die kennt
	 * den vierten Zustand. Fehlt der Wert, gab es keinen solchen Grund; alte
	 * festgeschriebene Ergebnisse brauchen deshalb keinen Ersatzwert.
	 */
	keinBeschluss?: KeinBeschluss | null;
	/**
	 * **Von Hand festgehalten** (Produktentscheid 30.09.2026, Migration 134):
	 * Die Sitzungsleitung hat Ergebnis und Zahlen selbst gesetzt, an den Sperren
	 * beim Eröffnen und an der Auszählung vorbei (`domain/vonhand.ts`).
	 *
	 * Dann wurde gegen keine Schwelle gerechnet: `schwelle` ist in beiden
	 * Spiegeln null, und `basis` ist die Summe der eingetragenen Zahlen, keine
	 * Bezugsgrösse. Wer Erfordernis, «nötig» oder «ohne Abgabe» ausgibt, fragt
	 * dieses Feld vorher ab; nach aussen steht der Beschluss ohne Hinweis auf
	 * den Weg («Weglassen heisst nicht falsch behaupten»).
	 *
	 * `stimmen` nur bei der Wahl je Partei: die Kennung der Partei aus der
	 * Momentaufnahme und ihre Wahl. Sie stehen hier und nicht in `vote`, weil
	 * die Tabelle einen offenen Durchgang verlangt und für Stimmen gedacht ist,
	 * die Votum zählt.
	 *
	 * Fehlt das Feld, wurde gerechnet. Das Format der Festschreibung bleibt 1,
	 * weil die Auszählung nur wächst.
	 */
	vonHand?: {
		erfassung: 'summen' | 'parteien';
		stimmen?: { partei: Id; wahl: VoteChoice }[];
		/**
		 * Mit dem Grund «Eingewendete Bestimmung» (Entscheid 0046, A7): die im
		 * Saal eingewendete Bestimmung, Fundstelle und Wortlaut, wie die Leitung
		 * sie eingetragen hat. Dann ist der Antrag abgelehnt, und das Protokoll
		 * nennt die Bestimmung (`domain/protokoll.ts`). Fehlt das Feld, ist es der
		 * Notweg; ältere Festschreibungen haben es nie.
		 */
		einwand?: { bestimmung: string; einfuehrung: string; knotenId?: string };
	};
	/**
	 * Das Ergebnis nach der anderen Lesart der Gemeinschaft (Migration 169,
	 * Entscheid 0018), wo das Erfordernis eine trägt. Fehlt es, trug das
	 * Erfordernis keine Lesart, oder das Ergebnis wurde vor diesem Feld
	 * festgeschrieben.
	 */
	andereLesart?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach der anderen Zählweise der Köpfe (L13, Migration 192), wo
	 * L13 wirkt (`kopfzaehlweiseWirkt`). Ein eigenes Feld neben `andereLesart`,
	 * weil beide an einem Traktandum zugleich wirken: Das zweite Ergebnis nach
	 * L2, L4 oder L11 behält die Zählweise, dieses behält deren Wahl. Im
	 * Protokoll immer, wie L1 (Entscheid 0048, Block C).
	 */
	andereKopfzaehlweise?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach der anderen Wahl zu L1 (Migration 170), nur wo ein
	 * Ausstand den Nenner aller Wertquoten berührt. Ein eigenes Feld neben
	 * `andereLesart`, weil beide an einem Traktandum zugleich wirken können:
	 * Nach L4 oder L2 «qualifiziert» rechnet das Mehr über alle
	 * Wertquoten.
	 */
	andereAusstandslesart?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach der anderen Zählweise zu L3 (Migration 172), nur an der
	 * Einsprache in einer Gemeinschaft je Einheit ab der Fassung 2026-10-28. Ein
	 * eigenes Feld wie `andereAusstandslesart`, weil L3 und L1 an derselben
	 * Abstimmung wirken können.
	 */
	andereZaehlweise?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach der anderen Zählbasis an der Ermächtigung zur
	 * Ausschlussklage (1a, Lesarten Block 6): gezählt an allen Eigentümern
	 * ausser dem Beklagten, daneben an den Anwesenden und Vertretenen, oder
	 * umgekehrt unter einer Regel der Anwesenden oder unter L9 «anwesende». Bis
	 * zur Fassung 2026-11-10 fest nach dem Wortlaut von Art. 649b Abs. 2
	 * (Konzept, «1a fest»); seither rechnet 1a das Ergebnis nach der anderen
	 * Wahl zu L9, und der allgemeine Weg der Lesarten schweigt dort (E1, Block C).
	 */
	andereZaehlbasis?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach der anderen Wahl zu L10 (Migration 189): gezählt mit den
	 * Angehörigen des Beklagten im Ausstand in der Zahl oder ohne sie. Nur wo L10
	 * wirkt und eine nicht betroffene Partei im Ausstand ist
	 * (`ausstandMitAngehoerigenergebnis`). Leitung immer; im Protokoll nur bei
	 * Abweichung (Entscheid 0018, F3), wie L8.
	 */
	andereAngehoerigenlesart?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis, wenn die Parteien, deren einziger Vertreter im Ausstand ist,
	 * ohne Stimme in der Bezugsgrösse der Anwesenden bleiben (B3, F4c; Rz. 181
	 * ad Art. 712m). Keine Lesart der Gemeinschaft: Votum rechnet wie bisher
	 * ohne sie und nennt dieses Ergebnis daneben, im Protokoll nur bei
	 * Abweichung (wie 1a, Entscheid 0023).
	 */
	vertretungImAusstand?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach der anderen Wahl zu L8 (Migration 184): gezählt mit den
	 * Vollmachten der Verwaltung, die diesmal ruhen, oder umgekehrt ohne die,
	 * die diesmal zählen. Leitung immer; im Protokoll nur bei Abweichung
	 * (Entscheid 0018, F3).
	 */
	andereVerwaltungsvollmacht?: ErgebnisNachAndererLesart | null;
	/**
	 * Das Ergebnis nach dem Mehr aus Gesetz und Reglement, wo die Leitung davon
	 * abgewichen ist (Anhang A, Migration 173). **Nur für die Leitung**: Es hat
	 * keinen Protokollsatz (Entscheid 0023; Produktentscheid 30.09.2026).
	 */
	nachGesetzUndReglement?: ErgebnisNachAndererLesart | null;
}

/** Die Ergebnisse nach einer anderen Lesart, die eine Auszählung trägt, für die Anzeigen. */
export function andereLesartenVon(
	a: Pick<
		Auszaehlung,
		| 'andereLesart'
		| 'andereAusstandslesart'
		| 'andereZaehlweise'
		| 'andereZaehlbasis'
		| 'nachGesetzUndReglement'
	> &
		Partial<
			Pick<
				Auszaehlung,
				| 'vertretungImAusstand'
				| 'andereVerwaltungsvollmacht'
				| 'andereAngehoerigenlesart'
				| 'andereKopfzaehlweise'
			>
		>
): ErgebnisNachAndererLesart[] {
	return [
		a.andereLesart,
		a.andereKopfzaehlweise,
		a.andereAusstandslesart,
		a.andereZaehlweise,
		a.andereZaehlbasis,
		a.andereAngehoerigenlesart,
		a.vertretungImAusstand,
		a.andereVerwaltungsvollmacht,
		a.nachGesetzUndReglement
	].filter(
		(r): r is ErgebnisNachAndererLesart => !!r
	);
}

/** Ein Stimmenspiegel, soweit das zweite Ergebnis ihn braucht. */
export interface Spiegelauszug {
	ja: number;
	basis: number;
	schwelle: number | null;
	erreicht: boolean;
}

/**
 * Das Ergebnis nach der anderen Lesart (Konzept Lesarten, Abschnitt 3,
 * «Rechnung»). Votum rechnet nach der Lesart der Gemeinschaft und zusätzlich
 * nach der anderen; weicht das Ergebnis ab, nennen Leitung und Protokoll es.
 */
export interface ErgebnisNachAndererLesart {
	kennung: string;
	/** Die eigene Wahl dieser Versammlung in Worten (Laienprüfung Runde 5). */
	eigeneWahl: string;
	/** Die andere Wahl in Worten, aus dem Katalog. */
	wahl: string;
	/** Was die andere Lesart verlangt, in Worten (`erfordernisInWorten`). */
	verlangt: string;
	/**
	 * Am Rückkommen unter L6 (B2b): Das Ergebnis steht nicht als zweites
	 * Ergebnis da, sondern als Folge für den Beschluss (`rueckkommensfolgeInWorten`).
	 */
	amRueckkommen?: true;
	/**
	 * Im Durchgang nach dem Rückkommen unter L6 «Nach dem Gesetz», wenn der
	 * Beschluss die Ja-Stimmen aller hatte und das Rückkommen nicht: Nach der
	 * Klausel wäre schon das Rückkommen abgelehnt gewesen (B2b, B2-F-6). Die
	 * Nummer des Rückkommensantrags.
	 */
	schonRueckkommenAbgelehnt?: string;
	/** Der Durchgang, dessen Beschluss nach der Klausel gälte (Codeprüfung B2b, M3). */
	fruehererDurchgang?: number;
	/** Im Durchgang nach einem Rückkommen auf einen angenommenen Beschluss (B2b-F-5). */
	nachRueckkommen?: true;
	/**
	 * Ob sich das Ergebnis danach bestimmen liess. Nicht bei einer Summenzählung
	 * ohne die Wertquoten, die das andere Mehr braucht (`summen`), und nicht,
	 * solange nach der anderen Lesart ein Stichentscheid offen wäre
	 * (`stichentscheid`). Bei L8 unter «Die Sitzungsleitung entscheidet» mit
	 * einer Handzählung (`verwaltung_summen`): In den Summen ist nicht getrennt,
	 * wie die Verwaltung mit ihren Vollmachten gestimmt hat. Bei L8 unter
	 * «Vollmachten ruhen» steht kein Grund: Dort ist das Ergebnis nach der
	 * anderen Wahl nicht unerreichbar, sondern offen, je nachdem, wie die
	 * Verwaltung gestimmt hätte (Entscheid 2, 06.11.2026); der Satz sagt es,
	 * und `ruhendeVollmachten` trägt die Zahl dazu.
	 */
	feststellbar: boolean;
	nichtFeststellbarWeil?: 'summen' | 'stichentscheid' | 'verwaltung_summen';
	/**
	 * Nur L8 unter «Vollmachten ruhen» (Entscheid 2, 06.11.2026): die Zahl der
	 * ruhenden Vollmachten aus L8 (Parteien). Die Stimmen der Verwaltung sind
	 * nicht erfasst; das zweite Ergebnis nennt die Grenzen (alle Ja, alle
	 * Nein), zwischen denen das Ergebnis nach der anderen Wahl läge, und sagt,
	 * ob beide dem eigenen gleichen.
	 */
	ruhendeVollmachten?: number;
	/**
	 * Nur L8: das eigene, gezählte Ergebnis. Der Rat im Satz zum offenen
	 * Ausgang hängt an seiner Richtung, Beschluss oder Ablehnung, und
	 * `andereLesartInWorten` erhält nur dieses Ergebnis, nicht die Auszählung;
	 * deshalb trägt es das Feld. Setzt allein
	 * `mitAndererVerwaltungsvollmacht`: unter der Vorgabe immer, unter
	 * «Die Sitzungsleitung entscheidet» mit Summen, wo der Satz zum offenen
	 * Ausgang steht (Lauf 5, 07.11.2026).
	 */
	eigenesErgebnis?: boolean;
	/**
	 * Nur L8 unter «Die Sitzungsleitung entscheidet» mit Summen (N-4,
	 * 07.11.2026): Die Grenzen stehen trotzdem, weil die Köpfe der Verwaltung
	 * aus den Summen herausfallen, je Grenze einmal so viele wie möglich aus
	 * den Ja und einmal so wenige wie möglich. Beide Grenzen gleich dem
	 * eigenen Ergebnis: «dasselbe Ergebnis»; sonst der Satz zu
	 * `verwaltung_summen` mit dem Zusatz an die Leitung.
	 */
	summenGrenzen?: true;
	angenommen: boolean | null;
	koepfe: Spiegelauszug | null;
	quoten: Spiegelauszug | null;
	/** Ob das Ergebnis vom gerechneten abweicht. Nicht feststellbar heisst: nein. */
	abweichend: boolean;
	/**
	 * Nur B3: Misst eine der beiden Seiten über alle, steht die Partei dort schon
	 * in der Zahl, und die zweite Rechnung ändert nur die andere. Köpfe über alle,
	 * Wertquoten über die Anwesenden: `wertquoten` (Review DeepSeek zu F4c
	 * Block 3, N-3). Köpfe über die Anwesenden, Wertquoten über alle, wie das
	 * Gesetz beim qualifizierten Mehr: `koepfe` (Fachprüfung Runde 4, M-4).
	 */
	nurBei?: 'koepfe' | 'wertquoten';
	/**
	 * Nur 1a unter L9 (E1, Block C): Das zweite Ergebnis ist die andere Zählbasis
	 * der Ermächtigung zur Ausschlussklage, und die Gemeinschaft hat sie
	 * eingestellt. Der Satz an die Leitung sagt dann «nach der Einstellung Ihrer
	 * Gemeinschaft» statt «Votum verkündet». Nach einer Annahme nur an den
	 * Anwesenden nennt er die offene Frage, ob das Gericht die Zahl trotzdem
	 * nachprüft, und den sicheren Weg (Fachprüfung E1 L9, F-1; Runde 2).
	 */
	ausLesart?: true;
	/**
	 * Nur Anhang A (Fachprüfung Block C, Nachtrag Runde 2, N2-F-1): Das Mehr nach
	 * Gesetz und Reglement zählt die Köpfe nur nach der Einstellung der
	 * Gemeinschaft (L13 «Alle Eigentümer») unter allen (`abweichungNachZaehlweise`).
	 * `nur`, wo die Leitung dasselbe Mehr unter den Anwesenden gesetzt hat; `mit`,
	 * wo sie zugleich ein anderes Mehr gesetzt hat.
	 */
	nachZaehlweise?: 'nur' | 'mit';
	/**
	 * Nur L2, L4 und L11 (Fachprüfung Block C, Nachtrag Runde 2, N2-F-2): Das
	 * andere Mehr zählt die Köpfe nach L13 «Alle Eigentümer», das eigene nicht.
	 */
	anderesNachZaehlweiseAlle?: true;
	/**
	 * Nur L13 an den notwendigen baulichen Massnahmen (Art. 647c; Endfassung
	 * Block C, Abschnitt 1): Rat und Protokoll nach einer Ablehnung nennen den
	 * Weg ans Gericht (ZGB Art. 647 Abs. 2 Ziff. 1).
	 */
	notwendigeArbeiten?: true;
}

function auszug(s: Stimmenspiegel): Spiegelauszug {
	return { ja: s.ja, basis: s.basis, schwelle: s.schwelle, erreicht: s.erreicht };
}

/**
 * Hängt das Ergebnis nach der anderen Lesart an, mit dem Satz für das
 * Protokoll am Ausgang, auch bei gleichem oder nicht feststellbarem Ergebnis.
 * Den Satz für die Leitung bilden die Leitungsseiten (`andereLesartInWorten`).
 *
 * **Dieselbe Zählung mit dem anderen Erfordernis**, nicht eine zweite Rechnung
 * daneben: aus demselben Grund wie bei `ausstandswirkung`. Das andere Mehr
 * trägt die eigens gebildete Behandlung der Enthaltungen
 * (`erfordernisNachAndererLesart`).
 */
function mitAndererLesart(
	a: Auszaehlung,
	e: Erfordernis,
	zaehle: (anderes: Erfordernis) => Auszaehlung,
	nachRueckkommen?: Auszaehlungslage['nachRueckkommen']
): Auszaehlung {
	const v = vergleichNachAndererLesart(e) ?? vergleichAmRueckkommen(e);
	if (!v) return a;
	const roh = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	if (!roh) return a;
	/*
	 * **Am Rückkommen nur, wo es eine Folge hat** (B2b; B2-F-2, B2-F-4): Hatte
	 * der Beschluss die Ja-Stimmen aller und geht das Rückkommen nach der
	 * anderen Wahl anders aus. Sonst gilt der Satz an der Karte (B2-F-3).
	 */
	const amRueckkommen = 'amRueckkommen' in v;
	if (amRueckkommen && !(roh.feststellbar && roh.abweichend)) return a;
	/*
	 * **Nicht, wenn alle dem zweiten Durchgang zugestimmt haben** (Laien- und
	 * Fachprüfung B2b, B2b-L-2 und B2b-F-1): Bei einer Annahme mit den Ja-Stimmen
	 * aller, bei einer Ablehnung mit den Nein-Stimmen aller besteht das Ergebnis
	 * nach beiden Lesarten (Art. 75 ZGB), und das zweite Ergebnis bleibt das
	 * gewohnte. Die Zahl aller Köpfe trägt das Mehr der Klausel.
	 */
	const alleEinig = a.angenommen
		? roh.angenommen === true
		: roh.koepfe !== null && a.koepfe.nein === roh.koepfe.basis;
	const nachRk = nachRueckkommen ? { nachRueckkommen: true as const } : {};
	const ergebnis: ErgebnisNachAndererLesart = amRueckkommen
		? { ...roh, amRueckkommen: true }
		: schonRueckkommenAbgelehnt(e, nachRueckkommen) && !alleEinig
			? {
					...roh,
					...nachRk,
					schonRueckkommenAbgelehnt: nachRueckkommen!.traktandum,
					fruehererDurchgang: nachRueckkommen!.geltenderDurchgang
				}
			: { ...roh, ...nachRk };
	return mitProtokollsatz({ ...a, andereLesart: ergebnis }, ergebnis);
}

/** Die Lesart des Beschlusses am Rückkommen unter L6 an der eigenen Schranke, sonst `null` (B2b). */
function l6AmRueckkommen(e: Erfordernis): NonNullable<Erfordernis['lesartDesBeschlusses']> | null {
	const l = e.lesartDesBeschlusses;
	if (e.gemeinschaftslesart || l?.kennung !== 'L6' || e.knotenId !== 'k-reglement-eigene-schranke') return null;
	return l;
}

/**
 * Das andere Mehr am Rückkommen unter L6, nur wenn der Beschluss die
 * Ja-Stimmen aller hatte (B2b; B2-F-4 Fall b): Nur dann besteht er nach beiden
 * Lesarten, und nur dann hat ein anderes Ergebnis des Rückkommens eine Folge,
 * die die Leitung kennen muss.
 */
function vergleichAmRueckkommen(e: Erfordernis): (Vergleichserfordernis & { amRueckkommen: true }) | null {
	const l = l6AmRueckkommen(e);
	if (!l?.andere || l.mitAllen !== true) return null;
	const anderes = erfordernisNachAndererLesart({
		...e,
		gemeinschaftslesart: { kennung: 'L6', wahl: l.wahl, vorgabe: l.wahl === lesartVon('L6')?.vorgabe, andere: l.andere }
	});
	if (!anderes) return null;
	return {
		worte: { kennung: 'L6', eigeneWahl: ohneVorgabe('L6', l.wahl), wahl: ohneVorgabe('L6', l.andere.wahl), verlangt: erfordernisInWorten(anderes) },
		erfordernis: anderes,
		amRueckkommen: true
	};
}

/** Ob im Durchgang nach dem Rückkommen nach der Klausel schon das Rückkommen gescheitert wäre (B2b, B2-F-6). */
function schonRueckkommenAbgelehnt(e: Erfordernis, n: Auszaehlungslage['nachRueckkommen']): boolean {
	return (
		e.gemeinschaftslesart?.kennung === 'L6' &&
		e.gemeinschaftslesart.wahl === 'gesetz' &&
		n?.beschlussMitAllen === true &&
		n.rueckkommenMitAllen === false
	);
}

/**
 * Ein Erfordernis, nach dem Votum ein zweites Ergebnis rechnet, mit den Worten
 * dazu (A3, 30.10.2026). **Eine Stelle für Kern und Auszählmappe:** Die Mappe
 * rechnet im Ausfall dieselben zweiten Ergebnisse vor wie `zaehleAus`
 * (`vergleicheZu`); bildete sie das andere Erfordernis selbst, liefen die zwei
 * Rechenwege an genau der Stelle auseinander, die niemand im Saal nachprüfen
 * kann.
 */
type Vergleichsworte =
	| 'kennung'
	| 'eigeneWahl'
	| 'wahl'
	| 'verlangt'
	| 'ausLesart'
	| 'nachZaehlweise'
	| 'anderesNachZaehlweiseAlle';

export interface Vergleichserfordernis {
	worte: Pick<ErgebnisNachAndererLesart, Vergleichsworte>;
	erfordernis: Erfordernis;
}

function ohneVorgabe(kennung: string, wert: string): string {
	return wahlInWorten(kennung, wert).replace(/ \(Vorgabe\)$/, '');
}

/**
 * Das Erfordernis nach der anderen Lesart am Mehr (L2, L4, L6, L11, L12), oder `null`.
 *
 * **L9 schweigt hier** (E1, Block C): Ihre andere Wahl ist die Zählbasis der
 * Ermächtigung zur Ausschlussklage, und die rechnet seit dem Entscheid 0018
 * `andereZaehlbasisVon` (1a) mit eigener Rechnung und eigenem Satz. Beide Wege
 * nebeneinander gäben dasselbe Ergebnis zweimal.
 */
function vergleichNachAndererLesart(e: Erfordernis): Vergleichserfordernis | null {
	const l = e.gemeinschaftslesart;
	if (l?.kennung === 'L9') return null;
	const anderes = erfordernisNachAndererLesart(e);
	if (!l || !anderes) return null;
	return {
		worte: {
			kennung: l.kennung,
			eigeneWahl: ohneVorgabe(l.kennung, l.wahl),
			wahl: ohneVorgabe(l.kennung, l.andere.wahl),
			verlangt: erfordernisInWorten(anderes),
			...(nurAnderesNachZaehlweiseAlle(e, anderes) ? { anderesNachZaehlweiseAlle: true as const } : {})
		},
		erfordernis: anderes
	};
}

/**
 * Ob nur das andere Mehr nach L13 «Alle Eigentümer» zählt (Fachprüfung
 * Nachtrag, N-F-1): unter L4 oder L11 «einfach» mit «Alle Eigentümer» das
 * qualifizierte Mehr nach Art. 647b Abs. 1. Eine Stelle für den Kartensatz vor
 * der Abstimmung und den Satz danach (Runde 2, N2-F-2).
 */
function nurAnderesNachZaehlweiseAlle(e: Erfordernis, anderes: Erfordernis): boolean {
	return !kopfzaehlweiseWirkt(e) && kopfzaehlweiseWirkt(anderes) && kopfzaehlweiseDesMehrs(anderes) === 'alle';
}

/**
 * Der Satz gleichen Inhalts vor der Abstimmung, an der Abweichung der Leitung
 * mit anderem Mehr (Fachprüfung Nachtrag Runde 3, N3-F-2): «eingestellt ist»
 * wie an der Karte, und «Das Ergebnis danach» statt «Dieses zweite Ergebnis».
 */
const ZWEITES_NACH_ZAEHLWEISE_VORHER =
	// «Das Ergebnis danach» wie im Satz davor (Laienprüfung Block D, D-L-2).
	'Das Ergebnis danach zählt die Köpfe unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ' +
	'ist; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.';

/** Der Satz nach der Auszählung zu `anderesNachZaehlweiseAlle` (Fachprüfung Nachtrag Runde 2, N2-F-2). */
const ZWEITES_NACH_ZAEHLWEISE_NACHHER =
	'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für diese Versammlung eingestellt ' +
	'war; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.';

/**
 * Das Erfordernis nach der anderen Wahl zu L1, oder `null`, wo L1 nicht wirken
 * kann. **Ohne die Bedingung, dass jemand im Ausstand ist:** Die kennt erst die
 * Zählung (`mitAndererAusstandslesart`); die Mappe entsteht vor dem Abend.
 */
function vergleichNachAndererAusstandslesart(e: Erfordernis): Vergleichserfordernis | null {
	if (!ausstandslesartWirkt(e)) return null;
	const eigene = wahlL1(e);
	const andere: Ausstandswahl = eigene === 'bleibt' ? 'faellt_heraus' : 'bleibt';
	return {
		worte: {
			kennung: 'L1',
			eigeneWahl: ohneVorgabe('L1', eigene),
			wahl: ohneVorgabe('L1', andere),
			verlangt: lesartVon('L1')?.wahlen.find((w) => w.wert === andere)?.imSatz ?? andere
		},
		erfordernis: { ...e, ausstandslesart: andere }
	};
}

/**
 * Das Erfordernis nach der anderen Zählweise der Köpfe (L13), oder `null`, wo
 * L13 nicht wirkt. Die eigene Wahl sagt das Mehr (`kopfzaehlweiseDesMehrs`);
 * alles andere bleibt, auch die Wahl von L2, L4 oder L11 (Akzeptanzkriterium
 * 3). Unter «Alle Eigentümer» bleibt dort, wer im Ausstand ist, in der Zahl
 * (`ausstandInDerZahlBei`).
 */
function vergleichNachAndererKopfzaehlweise(e: Erfordernis): Vergleichserfordernis | null {
	if (!kopfzaehlweiseWirkt(e) || !zaehlweiseSaetzeAm(e)) return null;
	const eigene = kopfzaehlweiseDesMehrs(e);
	const andere = andereKopfzaehlweise(eigene);
	const anderes: Erfordernis = {
		...e,
		kopfbasis: andere === 'alle' ? 'alle_eigentuemer' : 'anwesend_vertreten',
		kopfzaehlweise: andere
	};
	return {
		worte: {
			kennung: 'L13',
			eigeneWahl: ohneVorgabe('L13', eigene),
			wahl: ohneVorgabe('L13', andere),
			verlangt: erfordernisInWorten(anderes)
		},
		erfordernis: anderes
	};
}

/**
 * Hängt das Ergebnis nach der anderen Zählweise der Köpfe an (L13), wie
 * `mitAndererAusstandslesart` für L1, aber **immer, wo L13 wirkt**: Das
 * Protokoll nennt es auch ohne Abweichung (Entscheid 0048, Block C; wie L1).
 * Nicht, wo die Enthaltungsklausel L13 verdrängt (Antwort 10).
 */
function mitAndererKopfzaehlweise(
	a: Auszaehlung,
	e: Erfordernis,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	const v = vergleichNachAndererKopfzaehlweise(e);
	if (!v) return a;
	const roh = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	if (!roh) return a;
	const ergebnis: ErgebnisNachAndererLesart = e.rechtsgrundlage.startsWith(NOTWENDIGE_ARBEITEN_ARTIKEL)
		? { ...roh, notwendigeArbeiten: true }
		: roh;
	return mitProtokollsatz({ ...a, andereKopfzaehlweise: ergebnis }, ergebnis);
}

/**
 * Das Erfordernis nach der anderen Wahl zu L10, oder `null`, wo L10 nicht
 * wirken kann. **Ohne die Bedingung, dass jemand im Ausstand ist:** Die kennt
 * erst die Zählung (`mitAndererAngehoerigenlesart`); die Mappe entsteht vor dem
 * Abend.
 */
function vergleichNachAndererAngehoerigenlesart(e: Erfordernis): Vergleichserfordernis | null {
	if (!angehoerigenlesartWirkt(e)) return null;
	const eigene = wahlL10(e);
	const andere: Angehoerigenlesart = eigene === 'bleiben' ? 'fallen_heraus' : 'bleiben';
	return {
		worte: {
			kennung: 'L10',
			eigeneWahl: ohneVorgabe('L10', eigene),
			wahl: ohneVorgabe('L10', andere),
			verlangt: lesartVon('L10')?.wahlen.find((w) => w.wert === andere)?.imSatz ?? andere
		},
		erfordernis: { ...e, angehoerigenlesart: andere }
	};
}

/** Das Erfordernis nach der anderen Zählweise zu L3, oder `null`, wo L3 nicht wirkt. */
function vergleichNachAndererZaehlweise(
	e: Erfordernis,
	m: Pick<Snapshot, 'headCountMode'>
): Vergleichserfordernis | null {
	if (!l3Wirkt(e, m)) return null;
	const eigene = einsprachelesartVon(e);
	const andere: Einsprachewahl = eigene === 'je_eigentuemer' ? 'je_einheit' : 'je_eigentuemer';
	return {
		worte: {
			kennung: 'L3',
			eigeneWahl: ohneVorgabe('L3', eigene),
			wahl: ohneVorgabe('L3', andere),
			verlangt: lesartVon('L3')?.wahlen.find((w) => w.wert === andere)?.imSatz ?? andere
		},
		erfordernis: { ...e, einspracheLesart: andere }
	};
}

/**
 * Ob L1 an diesem Erfordernis wirken kann (Migration 170): beim Mehr aller
 * Wertquoten, nicht an der Ausschlussklage. Dort bleibt, wer im Ausstand ist
 * oder nur über eine Person im Ausstand vertreten war, fest in der Zahl
 * (1e; Produktentscheid 21.10.2026: «Fest wie 1e»), auch unter einer Regel,
 * die Wertquoten verlangt.
 */
function wahlL1(e: Erfordernis): Ausstandswahl {
	// Das Feld ausdrücklich gelesen, nicht über `ausstandswahlVon(e)`: So sieht
	// `check:erfordernisweg` es und prüft, dass es Leseweg und Einfrieren übersteht.
	return ausstandswahlVon({ ausstandslesart: e.ausstandslesart });
}

/**
 * Die Wahl zu L10 an diesem Erfordernis (Migration 189). Das Feld ausdrücklich
 * gelesen, nicht über `angehoerigenlesartVon(e)`: So sieht
 * `check:erfordernisweg` es und prüft, dass es Leseweg und Einfrieren übersteht.
 */
function wahlL10(e: Erfordernis): Angehoerigenlesart {
	return angehoerigenlesartVon({ angehoerigenlesart: e.angehoerigenlesart });
}

/**
 * Welche Wahl zu L1 hinter einem zweiten Ergebnis stand (A5, Punkt 5): Das
 * Ergebnis trägt sie nur in Worten (`ohneVorgabe`).
 */
export function ausstandswahlDesErgebnisses(r: Pick<ErgebnisNachAndererLesart, 'eigeneWahl'>): Ausstandswahl {
	return r.eigeneWahl === ohneVorgabe('L1', 'bleibt') ? 'bleibt' : 'faellt_heraus';
}

export function ausstandslesartWirkt(e: Erfordernis): boolean {
	return e.quotenbasis === 'alle_quoten' && e.quotenSchwelle !== null && e.knotenId !== AUSSCHLUSSKLAGE_KNOTEN;
}

/**
 * Hängt das Ergebnis nach der anderen Wahl zu L1 an (Migration 170), wie
 * `mitAndererLesart` für L4. **Nur wo die andere Wahl etwas ändern kann:**
 * beim Mehr aller Wertquoten und wenn eine Quote im Ausstand steht. Eine
 * ruhende Vollmacht allein ändert nach beiden Wahlen nichts (Entscheid 0020).
 * Sonst gäbe es eine Zeile «dasselbe Ergebnis» an
 * jedem qualifizierten Mehr, auch ohne Ausstand.
 */
function mitAndererAusstandslesart(
	a: Auszaehlung,
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	const v = vergleichNachAndererAusstandslesart(lage.erfordernis);
	if (!v || nennerImAusstand(lage) === 0) return a;
	const ergebnis = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	if (!ergebnis) return a;
	// Die Köpfe ändern sich nach L1 nicht; im Satz stünden sie nur doppelt.
	const ohneKoepfe = { ...ergebnis, koepfe: null };
	return mitProtokollsatz({ ...a, andereAusstandslesart: ohneKoepfe }, ohneKoepfe);
}

/**
 * Hängt das Ergebnis nach der anderen Wahl zu L10 an (Migration 189), wie
 * `mitAndererAusstandslesart` für L1. **Nur wo L10 wirkt und jemand im
 * Ausstand steht, der nach der Vorgabe in der Zahl bliebe:** Ohne Ausstand
 * gäbe es eine Zeile «dasselbe Ergebnis» an jeder Ermächtigung, und ein
 * Ausstand nur des Beklagten selbst ändert nichts, weil ihn Art. 649b Abs. 2
 * ohnehin ausnimmt (`ausstandInDerZahlBei`). Im Protokoll nur bei Abweichung
 * (Entscheid 0018, F3), wie L8.
 */
function mitAndererAngehoerigenlesart(
	a: Auszaehlung,
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	const v = vergleichNachAndererAngehoerigenlesart(lage.erfordernis);
	if (!v) return a;
	// Dieselbe Menge, an der die Maske W11 zeigt; wo L10 wirkt, ist sie die von
	// `ausstandInDerZahlBei` unter «bleiben».
	if (ausstandMitAngehoerigenergebnis(lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []).length === 0) return a;
	const ergebnis = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	if (!ergebnis) return a;
	const mit = { ...a, andereAngehoerigenlesart: ergebnis };
	return zweitesErgebnisImProtokoll(ergebnis) ? mitProtokollsatz(mit, ergebnis) : mit;
}

/**
 * Hängt das Ergebnis nach der anderen Zählweise zu L3 an (Migration 172), wie
 * `mitAndererAusstandslesart` für L1. **Nur wo L3 wirkt:** an der Einsprache ab
 * der Fassung 2026-10-28 in einer Gemeinschaft je Einheit. Dort ergibt die
 * andere Zählweise ein zweites Ergebnis, auch bei geheimer Abstimmung (nur
 * erreicht oder nicht). Der `zaehle`-Rückruf dreht über das Erfordernis die
 * Zählweise (`zaehlweiseFuer`); bei der Handzählung trägt er dafür die zweite
 * Dreizahl ein.
 */
function mitAndererZaehlweise(
	a: Auszaehlung,
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	const v = vergleichNachAndererZaehlweise(lage.erfordernis, lage.momentaufnahme);
	if (!v) return a;
	const ergebnis = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	if (!ergebnis) return a;
	return mitProtokollsatz({ ...a, andereZaehlweise: ergebnis }, ergebnis);
}

/** Die zwei Zählbasen an der Ermächtigung zur Ausschlussklage, in Worten (1a). */
export const ZAEHLBASIS_ALLE = 'an allen Eigentümern ausser dem Beklagten';
export const ZAEHLBASIS_ANWESENDE = 'an den Anwesenden und Vertretenen ausser dem Beklagten';

/**
 * Was die Leitung sagt, wenn die Gemeinschaft die Zählbasis eingestellt hat
 * (E1, Block C): Nicht Votum verkündet, sondern die Einstellung der Gemeinschaft
 * entscheidet, was gilt.
 */
export const ZAEHLBASIS_VERKUENDET =
	'Verkündet wird nach der Einstellung Ihrer Gemeinschaft die Ablehnung:';

/**
 * Die offene Frage unter L9 (Fachprüfung E1 L9, F-1): BGer 5A_735/2019 E. 3.3.1
 * nennt die Ermächtigung eine materiell-rechtliche Voraussetzung; dass das
 * Gericht die Zahl eines unangefochtenen Beschlusses nachprüft, sagt keine
 * Stelle, und Rz. 207 ad Art. 712m und Rz. 219a ad Art. 712a sprechen dagegen.
 * Ein Risiko, keine Folgerung aus dem Urteil. Allein steht es nur, wo der
 * Satz davor den Grundsatz schon nennt (`angehoerigenhinweis`).
 */
export const ZAEHLBASIS_RISIKO =
	'Ob das Gericht im Ausschlussprozess trotzdem prüft, ob die Mehrheit aller erreicht war, hat kein ' +
	'Gericht entschieden. Die Klage kann deshalb auch scheitern, wenn niemand angefochten hat.';

/**
 * Dasselbe mit dem Grundsatz davor (Fachprüfung E1 L9 Runde 2, R2-F-1): Ohne
 * ihn liest, wer Nein gestimmt hat, «kann auch ohne Anfechtung scheitern» und
 * ficht nicht an; nach einem Monat gilt die Ermächtigung dann in der Regel.
 */
export const ZAEHLBASIS_OFFEN =
	`Wird sie nicht rechtzeitig angefochten, gilt sie in der Regel. ${ZAEHLBASIS_RISIKO}`;

/**
 * Dasselbe nach einer verkündeten Ablehnung, als Möglichkeit: Im Indikativ
 * liesse sich der Grundsatz auf den abgelehnten Beschluss beziehen, und wer
 * klagen will, wartete den Monat ab und klagte ohne Ermächtigung (Fach- und
 * Laienprüfung E1 L9 Runde 3, R3-F-1, R3-L-1).
 */
export const ZAEHLBASIS_OFFEN_NACH_ABLEHNUNG =
	'Würde eine solche Ermächtigung verkündet und nicht rechtzeitig angefochten, gälte sie in der Regel. ' +
	ZAEHLBASIS_RISIKO;

/**
 * Der sichere Weg unter L9, auch für den Fall, dass die Klage eilt
 * (Laienprüfung E1 L9 Runde 2, R2-L-1 und R2-L-2), mit dem Rat, an wen die
 * Vollmacht geht (Fachprüfung Runde 2, R2-F-2): Vollmachten an Angehörige im
 * Ausstand ruhen (BGE 134 III 481 E. 3.8, `ruhendeVertretungenBei`), für den
 * Beklagten übertragen, und wirken an der Mehrheit aller wie ein Nein. Der Rat
 * zu den Vollmachten geht neutral an alle, damit die Bewirtschaftung nicht für
 * den Ausschluss wirbt (Runde 3, R3-F-4, R3-L-3); «Fehlt sie» trägt die
 * Bedingung, weil der Satz auch vor der Abstimmung steht (R3-F-3).
 */
export const ZAEHLBASIS_WEG =
	'Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller Eigentümer ohne den ' +
	'Beklagten. Fehlt sie, holen Sie sie bald an einer weiteren Versammlung, auch einer ausserordentlichen. ' +
	'Sagen Sie mit der Einladung allen, dass Fernbleiben wie ein Nein wirkt und wer nicht kommen kann, eine ' +
	'Vollmacht geben kann. Eine Vollmacht an den Beklagten oder an Angehörige im Ausstand wirkt dabei wie ' +
	'ein Nein.';

/**
 * Wer trotzdem mit der schwächeren Ermächtigung klagt: welche Frist, auch die
 * des Beklagten, der zur Abstimmung den Saal verlässt (Fachprüfung Runde 3,
 * R3-F-2). Der Bezug ist eindeutig die heutige Ermächtigung (Laienprüfung
 * Runde 3).
 */
const ZAEHLBASIS_FRUEHESTENS =
	'bis die Frist für alle abgelaufen ist, für Abwesende und den Beklagten gerechnet ab Zustellung des ' +
	'Protokolls. Er klagt frühestens einige Wochen danach, wenn die Bewirtschaftung bestätigt, dass keine ' +
	'Vorladung und keine Klage zu einer Anfechtung eingegangen ist.';

/**
 * Der Zusatz nach einer Annahme, die nur die Anwesenden tragen (E1, Block C):
 * die offene Frage und der Weg, der den Streit um die Zahl vermeidet, vor dem
 * Rat zum Zeitpunkt der Klage (Fachprüfung E1 L9, F-2; Laienprüfung L-1).
 * Unter der Vorgabe kommt dieser Ausgang nicht vor.
 */
export const ZAEHLBASIS_ANWESENDE_FOLGE = `${ZAEHLBASIS_OFFEN} ${ZAEHLBASIS_WEG}`;

/**
 * Der Satz vor der Abstimmung zu L10 (W11): Die Gemeinschaft stellt die Zahl
 * der Angehörigen im Ausstand ein, und Votum nennt danach beide Ergebnisse.
 * **Nur zeigen, wo `ausstandMitAngehoerigenergebnis` nicht leer ist:** Ohne
 * Ausstand einer nicht betroffenen Partei gibt es kein zweites Ergebnis, auch
 * nicht bei einem Ausstand nur des Beklagten oder nur eines Vertreters ohne
 * Partei, und der Satz verspräche eines.
 */
export const ANGEHOERIGENLESART_HINWEIS =
	'Ob die Angehörigen im Ausstand in der Zahl aller Eigentümer bleiben, stellt Ihre Gemeinschaft auf der ' +
	'Seite «Lesarten» ein. Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Wahl.';

/**
 * Der Schluss des Hinweises unter «fallen_heraus» (W13), statt eines Rats, von
 * Hand zu zählen: Votum rechnet die Zahl mit den Angehörigen selbst und nennt
 * sie nach der Auszählung. Dass es ohne sie misst, sagt der Satz zur Messung
 * davor (`ANGEHOERIGE_FALLEN_HERAUS_MESSUNG`); zweimal stand es da (Laien- und
 * Fachprüfung E1 L10, L-6 und F3; Codeprüfung Block D, N2).
 */
export const ANGEHOERIGE_FALLEN_HERAUS =
	'Sind solche Angehörige im Ausstand, nennt die Anwendung nach der Auszählung auch das Ergebnis mit ' +
	'ihnen in der Zahl.';

/** Der Satz zur Messung unter «fallen_heraus», mit «mit eigener Wohnung» (L-6). */
export const ANGEHOERIGE_FALLEN_HERAUS_MESSUNG =
	'Nach der Einstellung Ihrer Gemeinschaft misst die Anwendung die Mehrheit ohne die Angehörigen mit ' +
	'eigener Wohnung.';

/**
 * Die andere Kopfbasis zu 1a, oder `null`, wo es keine zweite Rechnung gibt.
 *
 * **Nur an der Ermächtigung zur Ausschlussklage und ohne Abweichung der
 * Leitung.** Erkannt an der Begründung, wie in `veralteteErfordernisseIn`:
 * `quelle: 'gewaehlt'` trägt auch ein von Hand gewählter Knoten. Ist die
 * Leitung abgewichen, nennt `mitMehrNachGesetz` das Ergebnis nach Gesetz und
 * Reglement; eine zweite Zeile zur Zählbasis gäbe dasselbe zweimal.
 *
 * **Die Gegenrichtung erst ab der Fassung 2026-10-25** (1e): Erst dort bleiben
 * die Angehörigen im Ausstand in der Zahl aller, und nur dann ist das Ergebnis
 * an allen ausser dem Beklagten die Zahl, mit der die Ermächtigung sicher ist.
 * Unter älteren Fassungen bleibt der Rat, von Hand zu zählen
 * (`angehoerigenhinweis`).
 */
export function andereZaehlbasisVon(
	e: Pick<Erfordernis, 'knotenId' | 'kopfbasis' | 'fassung' | 'begruendung'> &
		Partial<Pick<Erfordernis, 'titel' | 'angehoerigenlesart' | 'quelle'>>
): 'anwesend_vertreten' | 'alle_ausser_betroffene' | null {
	if (e.knotenId !== AUSSCHLUSSKLAGE_KNOTEN || e.begruendung) return null;
	// Am Rückkommen auf die Ermächtigung nicht: Es hebt sie auf (Codeprüfung Block 6, M1).
	if (e.titel?.startsWith(RUECKKOMMEN_TITEL)) return null;
	if (e.kopfbasis === 'alle_ausser_betroffene') return 'anwesend_vertreten';
	// Die Zahl aller ist hier die sichere, mit den Angehörigen im Ausstand darin:
	// L10 wirkt unter einer Zahl der Anwesenden nicht (Katalog, Geltung), und ohne
	// `angehoerigenlesart` fiele unter «fallen_heraus» das Ergebnis an allen weg
	// (E1, Block D, Prüfung der abgebenden Sitzung).
	if (
		e.kopfbasis === 'anwesend_vertreten' &&
		ausstandBleibtInDerZahl({ ...e, kopfbasis: 'alle_ausser_betroffene', angehoerigenlesart: undefined })
	) {
		return 'alle_ausser_betroffene';
	}
	return null;
}

/**
 * Hängt das Ergebnis nach der anderen Zählbasis an (1a), wie
 * `mitAndererZaehlweise` für L3, aber mit Protokollsatz nur bei Abweichung oder
 * wo es sich nicht bestimmen liess (Entscheid 0023).
 */
function mitAndererZaehlbasis(
	a: Auszaehlung,
	e: Erfordernis,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	const v = vergleichNachAndererZaehlbasis(e);
	if (!v) return a;
	const ergebnis = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	if (!ergebnis) return a;
	return mitProtokollsatz({ ...a, andereZaehlbasis: ergebnis }, ergebnis);
}

/** Das Erfordernis nach der anderen Zählbasis zu 1a, oder `null`. */
function vergleichNachAndererZaehlbasis(e: Erfordernis): Vergleichserfordernis | null {
	const andere = andereZaehlbasisVon(e);
	if (!andere) return null;
	/*
	 * **Unter L9 mit den Enthaltungen der anderen Wahl** (Codeprüfung E1 Block C,
	 * Befund 2): Das einfache Mehr der Anwesenden kennt die Einstellung der
	 * Gemeinschaft zu den Enthaltungen, das an allen nicht. `mitEinstellung`
	 * bildet sie für die andere Wahl eigens in `gemeinschaftslesart.andere`; ohne
	 * sie nennte Votum ein falsches Ergebnis «nach der anderen Lesart».
	 */
	const l9 = e.gemeinschaftslesart?.kennung === 'L9' ? e.gemeinschaftslesart.andere : undefined;
	const enthaltung =
		l9 && l9.enthaltungZaehltMit !== undefined ? { enthaltungZaehltMit: l9.enthaltungZaehltMit ?? undefined } : {};
	// Die Rechnung an allen zählt die Angehörigen im Ausstand mit, wie der Satz
	// dazu sagt (`andereZaehlbasisVon`); L10 wirkt hier nicht.
	const anderes: Erfordernis = {
		...e,
		...enthaltung,
		kopfbasis: andere,
		...(andere === 'alle_ausser_betroffene' ? { angehoerigenlesart: undefined } : {})
	};
	return {
		worte: {
			kennung: '1a',
			eigeneWahl: andere === 'anwesend_vertreten' ? ZAEHLBASIS_ALLE : ZAEHLBASIS_ANWESENDE,
			wahl: andere === 'anwesend_vertreten' ? ZAEHLBASIS_ANWESENDE : ZAEHLBASIS_ALLE,
			verlangt: erfordernisInWorten(anderes),
			// Unter L9 ist die andere Zählbasis die eingestellte Lesart der
			// Gemeinschaft; der Satz an die Leitung sagt das (E1, Block C).
			...(e.gemeinschaftslesart?.kennung === 'L9' ? { ausLesart: true as const } : {})
		},
		erfordernis: anderes
	};
}

function gleicheSchwelle(a: Erfordernis['kopfSchwelle'], b: Erfordernis['kopfSchwelle']): boolean {
	if (!a || !b) return a === b;
	return a.zaehler === b.zaehler && a.nenner === b.nenner && a.art === b.art;
}

/**
 * Die Kopfbasis, wie sie an diesem Knoten zählt. An Ausschlussklage und
 * Einsprache fallen die Betroffenen unter jeder Basis heraus
 * (`betroffeneStimmenNichtMit`); «alle Eigentümer» zählt dort dieselbe Zahl
 * wie «alle ausser den Betroffenen» (Review DeepSeek zu Block 6, Befunde 2
 * und 3, gemessen: je 6, nötig 4).
 */
function kopfbasisZumVergleich(knotenId: string, kopfbasis: Erfordernis['kopfbasis']): Erfordernis['kopfbasis'] {
	return kopfbasis === 'alle_eigentuemer' && (knotenId === AUSSCHLUSSKLAGE_KNOTEN || knotenId === EINSPRACHE_KNOTEN)
		? 'alle_ausser_betroffene'
		: kopfbasis;
}

/** Ob das Mehr aus Gesetz und Reglement anders zählt als das gezählte. */
function weichtVomGesetzAb(e: Erfordernis, g: Gesetzesmass): boolean {
	return !(
		kopfbasisZumVergleich(e.knotenId, e.kopfbasis) === kopfbasisZumVergleich(e.knotenId, g.kopfbasis) &&
		gleicheSchwelle(e.kopfSchwelle, g.kopfSchwelle) &&
		e.quotenbasis === g.quotenbasis &&
		gleicheSchwelle(e.quotenSchwelle, g.quotenSchwelle) &&
		(e.enthaltungZaehltMit !== false) === (g.enthaltungZaehltMit !== false) &&
		e.zustimmungBetroffenerNoetig === g.zustimmungBetroffenerNoetig
	);
}

/** Das Erfordernis nach Gesetz und Reglement, oder `null`, wo es keines gibt oder es gleich zählt. */
export function erfordernisNachGesetz(e: Erfordernis | null | undefined): Erfordernis | null {
	const g = e?.gesetzlich;
	// Ein Mass ohne zählbares Mehr, etwa aus einem Grenzfall von vor der
	// Behebung, würde beim Zählen werfen (Codeprüfung Block 6, H1).
	if (!e || !g || !gesetzesmassZaehlbar(g) || !weichtVomGesetzAb(e, g)) return null;
	if (e.titel.startsWith(RUECKKOMMEN_TITEL)) return null;
	// Misst die Leitung an den Anwesenden, rechnet Votum nach Gesetz an allen
	// Eigentümern mit den Angehörigen im Ausstand in der Zahl, wie der Hinweis an
	// die Leitung dazu sagt (`votumNenntAlle`; Codeprüfung E1 Block D, M1). Misst
	// sie weiter an allen, folgt das Ergebnis nach Gesetz der Einstellung zu L10,
	// wie es ohne Abweichung gerechnet hätte (Fachprüfung E1 L10 Runde 2, R2-F-3),
	// ausser das Mass kam aus dem Reglement: Dort wirkt L10 nicht (Runde 3, R3-F-1).
	const { ausReglement, ...mass } = g;
	return {
		...e,
		...mass,
		quelle: 'hergeleitet',
		gesetzlich: undefined,
		begruendung: undefined,
		...(mass.kopfbasis === 'alle_ausser_betroffene' && (e.kopfbasis === 'anwesend_vertreten' || ausReglement)
			? { angehoerigenlesart: undefined }
			: {})
	};
}

/**
 * Hängt das Ergebnis nach dem Mehr aus Gesetz und Reglement an (Anhang A,
 * Migration 173), wo die Leitung davon abgewichen ist: strenger, etwa weil die
 * Einladung es so nannte (Entscheid 0007), oder milder. Eine Beschlussfassung
 * mit ungültigem Mehr ist anfechtbar (Rz. 100 ad Art. 712n).
 *
 * **Ohne Protokollsatz** (Entscheid 0023): Die Abweichung der Leitung vom
 * Vorschlag steht nach dem Produktentscheid vom 30.09.2026 nur im Verlauf.
 */
function mitMehrNachGesetz(
	a: Auszaehlung,
	e: Erfordernis,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	const v = vergleichNachGesetz(e);
	if (!v) return a;
	const ergebnis = zweitesErgebnis(a, v.erfordernis, zaehle, v.worte);
	return ergebnis ? { ...a, nachGesetzUndReglement: ergebnis } : a;
}

/** Das Erfordernis nach Gesetz und Reglement (Anhang A), oder `null`. */
function vergleichNachGesetz(e: Erfordernis): Vergleichserfordernis | null {
	const anderes = erfordernisNachGesetz(e);
	if (!anderes) return null;
	const zaehlweise = abweichungNachZaehlweise(e, anderes);
	return {
		worte: {
			kennung: 'A',
			eigeneWahl: erfordernisInWorten(e),
			// In der Auszählmappe der Kopf der Spalte zum Vergleich (N2-F-1).
			wahl: zaehlweise === 'nur' ? 'Alle Eigentümer' : zaehlweise === 'mit' ? MEHR_MIT_ZAEHLWEISE : 'Mehr aus Gesetz und Reglement',
			verlangt: erfordernisInWorten(anderes),
			...(zaehlweise ? { nachZaehlweise: zaehlweise } : {})
		},
		erfordernis: anderes
	};
}

/**
 * **Wo das Mehr aus Gesetz und Reglement die Einstellung der Gemeinschaft ist**
 * (Fachprüfung Block C, Nachtrag Runde 2, N2-F-1; Laienprüfung N2-L-01, N2-L-02):
 * Zählt es die Köpfe nur nach L13 «Alle Eigentümer» unter allen, ist es weder
 * Reglement noch gesichertes Gesetz; die herrschende Lehre zählt die
 * Anwesenden. `nur`, wo die Leitung dasselbe Mehr unter den Anwesenden gesetzt
 * hat: Kartensatz und Rat nennen die Einstellung beim Namen und geben den Rat
 * der Endfassung (`nachAnnahme` an L13). `mit`, wo sie zugleich ein anderes Mehr
 * gesetzt hat: der Bestand mit der Bezeichnung `MEHR_MIT_ZAEHLWEISE`. Die
 * Gegenrichtung (die Leitung setzt «alle») ist nicht betroffen. Erkannt am Mass:
 * Es trägt die Rechtsgrundlage nur, wo L13 «alle» am Vorschlag wirkte
 * (`gesetzesmassVon`).
 */
function abweichungNachZaehlweise(e: Erfordernis, gesetz: Erfordernis): 'nur' | 'mit' | null {
	if (e.kopfbasis !== 'anwesend_vertreten' || !ausstandBleibtNachZaehlweise(gesetz)) return null;
	return weichtVomGesetzAb(e, { ...gesetz, kopfbasis: 'anwesend_vertreten' }) ? 'mit' : 'nur';
}

const MEHR_MIT_ZAEHLWEISE =
	'Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet';

/**
 * Der Bestand mit der Bezeichnung `MEHR_MIT_ZAEHLWEISE` statt «Mehr aus Gesetz
 * und Reglement» (N2-F-1). Ein Relativsatz braucht danach ein Komma, wo der
 * Satz weitergeht.
 */
function mitBezeichnungNachZaehlweise(satz: string): string {
	return satz
		.replace(/Mehr aus Gesetz und Reglement (\((?:[^()]|\([^()]*\))*\)) /g, `${MEHR_MIT_ZAEHLWEISE} $1, `)
		.replace(/Mehr aus Gesetz und Reglement (?=[a-zäöü])/g, `${MEHR_MIT_ZAEHLWEISE}, `)
		.replace(/Mehr aus Gesetz und Reglement/g, MEHR_MIT_ZAEHLWEISE)
		.replace(
			'leitet Votum das aus Gesetz und Reglement her',
			'leitet Votum das aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe her'
		)
		.replace(/Nach Gesetz und Reglement gälte/g, `Nach dem ${MEHR_MIT_ZAEHLWEISE}, gälte`);
}

/**
 * Die Erfordernisse der zweiten Ergebnisse eines Traktandums, in der Folge
 * von `zaehleAus` und `andereLesartenVon`: andere Lesart am Mehr, L1, L3, 1a,
 * Anhang A (A3, 30.10.2026). **Ohne B3** (F4c): Es hängt an der Lage
 * (ruhende Vollmacht aus Ausstand), nicht am Erfordernis, und die Mappe trennt
 * Ausstand und Betroffenheit nicht. Für die Auszählmappe, die sie vor dem Abend
 * vorrechnet. L1 steht hier auch ohne Ausstand; die Zählung nennt es erst,
 * wenn eine Quote im Ausstand steht, und ohne Ausstand ergibt es dasselbe.
 */
export function vergleicheZu(e: Erfordernis, m: Pick<Snapshot, 'headCountMode'>): Vergleichserfordernis[] {
	return [
		vergleichNachAndererLesart(e),
		vergleichNachAndererKopfzaehlweise(e),
		vergleichNachAndererAusstandslesart(e),
		vergleichNachAndererZaehlweise(e, m),
		vergleichNachAndererZaehlbasis(e),
		vergleichNachAndererAngehoerigenlesart(e),
		vergleichNachGesetz(e)
	].filter((v): v is Vergleichserfordernis => v !== null);
}

/** Die zweiten Ergebnisse zu 1a und Anhang A (Lesarten Block 6). */
function mitFestenVergleichen(
	a: Auszaehlung,
	e: Erfordernis,
	zaehle: (anderes: Erfordernis) => Auszaehlung
): Auszaehlung {
	return mitMehrNachGesetz(mitAndererZaehlbasis(a, e, zaehle), e, zaehle);
}

/** Ab dieser Fassung trägt eine Auszählung das zweite Ergebnis zu B3 (F4c). */
export const VERTRETUNG_IM_AUSSTAND_AB_FASSUNG = '2026-11-05';

/** Die zwei Zählungen zu B3 in Worten. */
export const OHNE_VERTRETENE_IM_AUSSTAND = 'ohne die Parteien, deren einziger Vertreter im Ausstand ist';
export const MIT_VERTRETENEN_IM_AUSSTAND = 'mit diesen Parteien in der Zahl, ohne Stimme';

/**
 * Ob B3 an dieser Abstimmung ein zweites Ergebnis trägt: ab der Fassung
 * 2026-11-05, an einem Mehr der Anwesenden und Vertretenen (Köpfe oder
 * Wertquoten), und nur, wenn mindestens eine Vollmacht wegen eines Ausstands
 * ruht. **Nicht, wo 1a rechnet** (`andereZaehlbasisVon`): an der
 * Ausschlussklage ohne Abweichung der Leitung, wo 1a schon an allen
 * Eigentümern rechnet und die Vertretenen dort in der Zahl stehen. Ist die
 * Leitung dort abgewichen und misst an den Anwesenden, rechnet B3. Unter älteren Fassungen nicht, damit sich das
 * Protokoll früherer Versammlungen nicht ändert.
 */
export function vertretungImAusstandWirkt(lage: Omit<Auszaehlungslage, 'stimmen'>): boolean {
	const e = lage.erfordernis;
	// Nur Fassungen mit Datum: Kennungen wie «von-hand» oder «weisungsregel»
	// lägen im Zeichenkettenvergleich darüber (Codeprüfung F4c Block 3, M2).
	if (!e.fassung || !istKalendertag(e.fassung) || e.fassung < VERTRETUNG_IM_AUSSTAND_AB_FASSUNG) return false;
	if (e.typ === 'keine_abstimmung' || andereZaehlbasisVon(e) !== null) return false;
	const anwesende =
		e.kopfbasis === 'anwesend_vertreten' || (e.quotenbasis === 'anwesend_vertreten' && e.quotenSchwelle != null);
	if (!anwesende) return false;
	const ruhend = ruhendeVertretungenBei(
		lage.vertretungen ?? [],
		vomStimmrechtAusgeschlossen(e, lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []),
		new Set(lage.anwesende)
	);
	return [...ruhend.values()].some((r) => r.grund === 'ausstand');
}

/**
 * Hängt das Ergebnis zu B3 an (F4c): dieselbe Abstimmung, gezählt mit den
 * Parteien, deren einziger Vertreter im Ausstand ist, in der Bezugsgrösse und
 * ohne Stimme. Die Bezugsgrösse wird nur grösser, also kann das Ergebnis nur
 * von «angenommen» zu «abgelehnt» kippen. Protokoll nur bei Abweichung (wie
 * 1a, Entscheid 0023).
 */
/** Was B3 nicht ergeben kann (N-2); eine Bedingung für Rechnung und Sätze. */
export function keinAusgangVonB3(r: ErgebnisNachAndererLesart): boolean {
	return !r.feststellbar || (r.abweichend && r.angenommen !== false);
}

function mitVertretungImAusstand(
	a: Auszaehlung,
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	zaehleMitIhnen: () => Auszaehlung
): Auszaehlung {
	if (!vertretungImAusstandWirkt(lage)) return a;
	const ergebnis = zweitesErgebnis(a, lage.erfordernis, () => zaehleMitIhnen(), {
		kennung: 'B3',
		eigeneWahl: OHNE_VERTRETENE_IM_AUSSTAND,
		wahl: MIT_VERTRETENEN_IM_AUSSTAND,
		verlangt: erfordernisInWorten(lage.erfordernis)
	});
	/*
	 * **Nur zwei Ausgänge sind möglich** (Review DeepSeek zu F4c Block 3, N-2):
	 * Ja und Nein bleiben, die Bezugsgrösse wächst. Ein neuer Gleichstand
	 * verlangt Ja gleich Nein und Ja mal zwei gleich der Basis, also eine Basis
	 * ohne Enthaltung und ohne Abgabe; die hinzugefügte Partei gibt keine ab. Eine
	 * zu hohe Summe hätte schon die erste Rechnung abgewiesen. Und angenommen,
	 * wo die erste abgelehnt hat, geht mit der grösseren Basis nicht. Was davon
	 * doch einträte, wäre ein Fehler der Rechnung, kein Ergebnis: Dann bleibt B3
	 * weg, statt einen Satz für einen Fall zu sagen, den es nicht gibt.
	 */
	if (!ergebnis || keinAusgangVonB3(ergebnis)) return a;
	const e = lage.erfordernis;
	const mitQuoten = e.quotenbasis !== 'keine' && e.quotenSchwelle != null;
	const nurBei =
		e.kopfbasis !== 'anwesend_vertreten'
			? ('wertquoten' as const)
			: mitQuoten && e.quotenbasis !== 'anwesend_vertreten'
				? ('koepfe' as const)
				: undefined;
	const r = nurBei ? { ...ergebnis, nurBei } : ergebnis;
	return mitProtokollsatz({ ...a, vertretungImAusstand: r }, r);
}

/**
 * Hängt das Ergebnis nach der anderen Wahl zu L8 an (Migration 184): unter «Die
 * Sitzungsleitung entscheidet» dieselbe Abstimmung, gezählt mit dem Ausstand aus
 * L8, der diesmal nicht wirkt; unter «Vollmachten ruhen» die beiden Grenzen,
 * zwischen denen das Ergebnis nach der anderen Wahl läge (Entscheid 2,
 * 06.11.2026). **Keine zweite Rechnung im Kern**: zweimal dieselbe Funktion mit
 * anderer Eingabe (`grenze`), wie `ausstandswirkung` sie zweimal aufruft.
 *
 * **Nur wo die Verwaltung beim Schliessen wirksame Vollmachten hält** (M2,
 * 06.11.2026): `ausL8` wird gegen `lage.vertretungen` gefiltert und nicht aus
 * der Tabelle der Vollmachten gelesen. Ist die vertretene Partei selbst da,
 * ist die Vollmacht nur erfasst; ist die Verwaltung abwesend, hält sie niemanden.
 * In beiden Fällen ruht nichts, beide Wahlen rechnen dasselbe, und ein Satz
 * darüber wäre eine Behauptung über einen Fall, den es nicht gibt.
 *
 * **Leitung immer, Protokoll nur unter «Die Sitzungsleitung entscheidet»**
 * (Entscheid 0018, F3; Entscheid 3, 06.11.2026): Auch Stimmen, die zu Unrecht
 * nicht zählen, machen einen Beschluss anfechtbar (BGer 5A_972/2020 E. 7.2.4)
 * — deshalb nennt die Leitung das andere Ergebnis immer. Das Protokoll trägt
 * unter der Vorgabe kein zweites Ergebnis, weder «dasselbe» noch «nicht
 * bestimmbar», sondern nur die Tatsache mit der Zahl der Vertretenen; die
 * Zeile entsteht in der Zählung selbst, bei den übrigen ruhenden Vertretungen.
 */
function mitAndererVerwaltungsvollmacht(
	a: Auszaehlung,
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	zaehleMit: (imAusstand: Id[]) => Auszaehlung,
	grenze: (imAusstand: Id[], ruhend: SnapshotParty[], richtung: VoteChoice) => Auszaehlung,
	/**
	 * Die Grenzen unter «Die Sitzungsleitung entscheidet» mit Summen (N-4,
	 * 07.11.2026): dieselbe Handzählung, gerechnet ohne die Köpfe, die nach
	 * der anderen Wahl aus den Summen herausfielen. Nur die Handzählung ruft
	 * mit; die Einzelzählung erhebt die Wertquoten immer und kommt in den
	 * Zweig nie.
	 */
	grenzeSummen?: (imAusstand: Id[], weg: { ja: number; nein: number; enthaltung: number }) => Auszaehlung
): Auszaehlung {
	// M2: Was ruht, sagen die wirksamen Vertretungen, nicht die Vollmachten.
	const wirksam = new Set((lage.vertretungen ?? []).map((v) => v.bevollmaechtigtId));
	const ausL8 = (lage.ausstandAusVerwaltung ?? []).filter((k) => wirksam.has(k));
	if (ausL8.length === 0) return a;
	const eigene = lage.momentaufnahme.lesarten?.L8 ?? LESARTEN_VORGABE.L8;
	const andere: Verwaltungsvollmachtwahl = eigene === 'ruhen' ? 'leitung' : 'ruhen';
	const worte = {
		kennung: 'L8',
		eigeneWahl: ohneVorgabe('L8', eigene),
		wahl: ohneVorgabe('L8', andere),
		verlangt: lesartVon('L8')?.wahlen.find((w) => w.wert === andere)?.imSatz ?? andere
	};
	// Wie `zweitesErgebnis`: Solange der eigene Stichentscheid offen ist, steht
	// kein Ergebnis fest, neben das sich ein zweites stellen liesse; nach dem
	// Eintrag wird neu gerechnet.
	if (a.stichentscheidOffen) return a;
	/*
	 * **Unter «Vollmachten ruhen» die Grenzen** (Entscheid 2, 06.11.2026): Die
	 * Stimmsperre nimmt die Stimmen der Verwaltung nicht an, und wie sie
	 * gestimmt hätte, weiss niemand. Votum rechnet dieselbe Abstimmung zweimal
	 * mit der Rechnung, die es auch sonst nimmt, ohne den Ausstand aus L8 und
	 * mit den ruhenden Vertretungen einmal alle Ja, einmal alle Nein. Gleichen
	 * beide Grenzen dem eigenen Ergebnis, heisst es «dasselbe Ergebnis», sonst
	 * «nicht bestimmbar»; ergibt eine Grenze Stimmengleichheit mit offenem
	 * Stichentscheid, lässt sich auch das nicht bestimmen.
	 */
	if (eigene === 'ruhen') {
		const ausL8Menge = new Set(ausL8);
		// Nur wer über die Verwaltung anwesend ist und nicht selbst stimmt,
		// dessen Stimme könnte nach der anderen Wahl dazukommen; eine Vertretung,
		// die aus einem anderen Grund ruht, ruht nach beiden Wahlen.
		const ruhend = [...ruhendeVertretungenBei(
			lage.vertretungen ?? [],
			vomStimmrechtAusgeschlossen(lage.erfordernis, lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []),
			new Set(lage.anwesende)
		).values()]
			.filter((r) => r.grund === 'ausstand' && ausL8Menge.has(r.bevollmaechtigtId))
			.map((r) => lage.momentaufnahme.parties.find((p) => p.partyId === r.vertreteneId))
			.filter((p): p is SnapshotParty => !!p);
		/*
		 * **Ist `n = 0`, gibt es kein zweites Ergebnis** (G-1, 07.11.2026):
		 * Jede vertretene Partei ist aus einem anderen Grund ausgeschlossen,
		 * etwa als Betroffene, und zählt nach beiden Wahlen nicht. Ein Satz
		 * über «0 ruhende Vollmachten» behauptete einen Fall, den es nicht
		 * gibt, und die Grenzen rechneten zweimal dasselbe wie die eigene
		 * Zählung.
		 */
		if (ruhend.length === 0) return a;
		const imAusstand = (lage.imAusstand ?? []).filter((k) => !ausL8Menge.has(k));
		const grenzen = [grenze(imAusstand, ruhend, 'yes'), grenze(imAusstand, ruhend, 'no')];
		// Dieselbe Bedingung wie in `zweitesErgebnis`: Offen nur, wenn ausser
		// dem Stichentscheid nichts fehlt.
		const offen = grenzen.some(
			(g) => g.stichentscheidOffen && g.quoten.erreicht && g.betroffene.erfuellt
		);
		const dasselbe = !offen && grenzen.every((g) => g.angenommen === a.angenommen);
		const ergebnis: ErgebnisNachAndererLesart = {
			...worte,
			ruhendeVollmachten: ruhend.length,
				eigenesErgebnis: a.angenommen,
			feststellbar: dasselbe,
			angenommen: dasselbe ? a.angenommen : null,
			koepfe: null,
			quoten: null,
			abweichend: false
		};
		return { ...a, andereVerwaltungsvollmacht: ergebnis };
	}
	/*
	 * **Unter «Die Sitzungsleitung entscheidet» mit Summen die Grenzen**
	 * (N-4, 07.11.2026): Die Köpfe der Verwaltung stecken in der Dreizahl,
	 * ohne dass sie jemand zuordnen könnte, aber wohin sie fielen, liegt in
	 * Grenzen: einmal so viele wie möglich aus den Ja, einmal so wenige wie
	 * möglich. Beide Grenzen gleich dem eigenen Ergebnis: «dasselbe
	 * Ergebnis»; sonst der Satz zu `verwaltung_summen` wie seit H1, an die
	 * Leitung mit dem Zusatz. Die Wertquoten bleiben unerhoben
	 * (`summenhindernis` lässt ein Erfordernis mit Quotenschranke gar nicht
	 * erst zur Handzählung); der Satz sagt nichts über sie.
	 */
	if (a.quotenErhoben === false) {
		/*
		 * **Ohne Rückruf die Aussage von H1** (06.11.2026): Die Einzelzählung
		 * erhebt die Wertquoten immer und kommt hier nie; ein künftiger
		 * Zählweg ohne Rückruf bekäme die bekannte Aussage statt einer halben
		 * Rechnung, und der Durchgang schlösse weiterhin.
		 */
		if (!grenzeSummen) {
			const offen: ErgebnisNachAndererLesart = {
				...worte,
				feststellbar: false,
				nichtFeststellbarWeil: 'verwaltung_summen',
				eigenesErgebnis: a.angenommen,
				angenommen: null,
				koepfe: null,
				quoten: null,
				abweichend: false
			};
			return mitProtokollsatz({ ...a, andereVerwaltungsvollmacht: offen }, offen);
		}
		const ausL8Menge = new Set(ausL8);
		const anwesend = new Set(lage.anwesende);
		const ausgeschlossen = vomStimmrechtAusgeschlossen(
			lage.erfordernis,
			lage.imAusstand ?? [],
			lage.betroffeneParteiIds ?? []
		);
		// Die vertretenen Parteien der Verwaltung: Sie sind über ihre Vollmacht
		// anwesend, und ihre Köpfe stecken in den Summen. Wer selbst
		// ausgeschlossen ist, zählt nach beiden Wahlen nicht und liegt in
		// keiner der beiden.
		const vertreten = (lage.vertretungen ?? [])
			.filter(
				(v) =>
					ausL8Menge.has(v.bevollmaechtigtId) &&
					anwesend.has(v.vertreteneId) &&
					!ausgeschlossen.has(v.vertreteneId)
			)
			.map((v) => lage.momentaufnahme.parties.find((p) => p.partyId === v.vertreteneId))
			.filter((p): p is SnapshotParty => !!p);
		if (vertreten.length === 0) return a;
		const zaehlweise = zaehlweiseFuer(lage.erfordernis, lage.momentaufnahme);
		const gewicht = vertreten.reduce(
			(s, p) => s + kopfgewicht(p, zaehlweise, lage.momentaufnahme.parkingCountsAsHead),
			0
		);
		/*
		 * **Je Grenze ein anderer Teil der Dreizahl fällt weg** (N-4): Nach
		 * der anderen Wahl ruhen die Vollmachten der Verwaltung, ihre
		 * vertretenen Parteien sind nicht mehr da, und die gezählten Hände
		 * gehören niemandem mehr. Unten so viele wie möglich aus den Ja, der
		 * Rest aus den Enthaltungen und erst dann aus den Nein — bei
		 * nicht mitzählenden Enthaltungen bleibt die Bezugsgrösse so gross,
		 * die Schwelle so hoch, der Ausgang für den Antrag so ungünstig wie
		 * möglich. Oben so wenige wie möglich aus den Ja, der Rest aus den
		 * Nein und erst dann aus den Enthaltungen, mit derselben Folge in der
		 * Gegenrichtung. Bei mitzählenden Enthaltungen, dem Normalfall, ändert
		 * die Aufteilung an der Bezugsgrösse nichts.
		 */
		const imAusstand = [...(lage.imAusstand ?? []), ...ausL8];
		const weg = (vonJa: number, zuerstEnthaltung: boolean) => {
			const rest = Math.min(gewicht - vonJa, a.koepfe.nein + a.koepfe.enthaltung);
			const vonEnthaltung = zuerstEnthaltung
				? Math.min(rest, a.koepfe.enthaltung)
				: Math.max(0, rest - a.koepfe.nein);
			const vonNein = rest - vonEnthaltung;
			return { ja: vonJa, nein: vonNein, enthaltung: vonEnthaltung };
		};
		const grenzen = [
			grenzeSummen(imAusstand, weg(Math.min(gewicht, a.koepfe.ja), true)),
			grenzeSummen(imAusstand, weg(Math.max(0, gewicht - (a.koepfe.nein + a.koepfe.enthaltung)), false))
		];
		// Dieselbe Bedingung wie unter der Vorgabe: Offen nur, wenn ausser dem
		// Stichentscheid nichts fehlt.
		const offen = grenzen.some(
			(g) => g.stichentscheidOffen && g.quoten.erreicht && g.betroffene.erfuellt
		);
		const dasselbe = !offen && grenzen.every((g) => g.angenommen === a.angenommen);
		if (dasselbe) {
			const ergebnis: ErgebnisNachAndererLesart = {
				...worte,
				summenGrenzen: true,
				feststellbar: true,
				angenommen: a.angenommen,
				koepfe: null,
				quoten: null,
				abweichend: false
			};
			return { ...a, andereVerwaltungsvollmacht: ergebnis };
		}
		const nichtBestimmbar: ErgebnisNachAndererLesart = {
			...worte,
			feststellbar: false,
			nichtFeststellbarWeil: 'verwaltung_summen',
			eigenesErgebnis: a.angenommen,
			angenommen: null,
			koepfe: null,
			quoten: null,
			abweichend: false
		};
		return mitProtokollsatz({ ...a, andereVerwaltungsvollmacht: nichtBestimmbar }, nichtBestimmbar);
	}
	/*
	 * **Ist `n = 0`, gibt es auch hier kein zweites Ergebnis** (G-4, 07.11.2026):
	 * Die Regel von der Vorgabe gilt unter «Die Sitzungsleitung entscheidet»
	 * ebenso: Ist jede vertretene Partei aus einem anderen Grund ausgeschlossen,
	 * etwa als Betroffene, zählt sie nach beiden Wahlen nicht, und die zweite
	 * Rechnung rechnete zweimal dasselbe wie die eigene. Ein Satz darüber
	 * behauptete einen Fall, den es nicht gibt.
	 */
	{
		const ausL8Menge = new Set(ausL8);
		const anwesend = new Set(lage.anwesende);
		const ausgeschlossen = vomStimmrechtAusgeschlossen(
			lage.erfordernis,
			lage.imAusstand ?? [],
			lage.betroffeneParteiIds ?? []
		);
		const ruhenWuerde = (lage.vertretungen ?? []).some(
			(v) =>
				ausL8Menge.has(v.bevollmaechtigtId) &&
				anwesend.has(v.vertreteneId) &&
				!ausgeschlossen.has(v.vertreteneId)
		);
		if (!ruhenWuerde) return a;
	}
	const ergebnis = zweitesErgebnis(a, lage.erfordernis, () => zaehleMit([...(lage.imAusstand ?? []), ...ausL8]), worte);
	if (!ergebnis) return a;
	const mit = { ...a, andereVerwaltungsvollmacht: ergebnis };
	return zweitesErgebnisImProtokoll(ergebnis) ? mitProtokollsatz(mit, ergebnis) : mit;
}

/**
 * Ob das Protokoll ein zweites Ergebnis nennt. Zu L8 und L10 nur bei Abweichung
 * oder wo es sich nicht bestimmen lässt (Entscheid 0018, F3; unter «Vollmachten
 * ruhen» hat der Satz ohnehin keine Protokollfassung, Entscheid 3); zu den
 * übrigen Lesarten immer (`mitProtokollsatz`; 1a zu L9, B3 und A haben ohne
 * Abweichung keinen Protokollsatz). **Eine Bedingung für alle Ausgaben des
 * Satzes:** Hausprotokoll, gemeinsames Abenddokument (Codeprüfung P11, H1,
 * 08.11.2026), seit «Texte nach 0047», Punkt 2, auch Auswertung-PDF,
 * Stimmnachweis und Auswertungsseite. Vorher schrieben diese unter «Die
 * Sitzungsleitung entscheidet» und zu L10 «wäre das Ergebnis dasselbe gewesen»,
 * wo das Hausprotokoll schweigt.
 */
export function zweitesErgebnisImProtokoll(r: ErgebnisNachAndererLesart): boolean {
	return (r.kennung !== 'L8' && r.kennung !== 'L10') || r.abweichend || !r.feststellbar;
}

/**
 * Das zweite Ergebnis aus derselben Zählung mit dem anderen Erfordernis, für
 * L2, L4, L6 und L1 gleich. `null`, solange der eigene Stichentscheid offen ist: Dann
 * steht kein Ergebnis fest, mit dem sich vergleichen liesse; nach dem Eintrag
 * wird neu gerechnet (Codeprüfung Teil 3, M3).
 *
 * **Dieselbe Zählung mit dem anderen Erfordernis**, nicht eine zweite Rechnung
 * daneben: aus demselben Grund wie bei `ausstandswirkung`.
 */
function zweitesErgebnis(
	a: Auszaehlung,
	anderes: Erfordernis,
	zaehle: (anderes: Erfordernis) => Auszaehlung,
	worte: Pick<ErgebnisNachAndererLesart, Vergleichsworte>
): ErgebnisNachAndererLesart | null {
	if (a.stichentscheidOffen) return null;
	let b: Auszaehlung | null = null;
	try {
		b = zaehle(anderes);
	} catch (f) {
		// Etwa eine Summenzählung, aus der sich die Wertquoten des anderen Mehrs
		// nicht bestimmen lassen (`summenhindernis`). **Falle für die nächste
		// Lesart:** `summenhindernis` weist auch Einstimmigkeit und die Zustimmung
		// Betroffener ab; der Satz «weil die Wertquoten fehlen» und der Rat im
		// Kartensatz stimmen nur, solange die andere Lesart an den Wertquoten
		// scheitert, wie bei L4 und L2 (zweite Codeprüfung Teil 3). L1 kommt hier nie
		// an: Eine Summenzählung kennt kein Mehr aller Wertquoten. L6 ebenso nicht:
		// Beide Wahlen weist schon die eigene Summenzählung ab, die Klausel als
		// Einstimmigkeit, das Gesetz am Mehr aller Wertquoten.
		//
		// **Nur `summe_unzulaessig` gilt als «nicht feststellbar»** (L3, Migration
		// 172): Die zweite Dreizahl an der Einsprache kann zu hoch sein, und das
		// muss eine Absage sein, keine still «nicht feststellbare» andere Zählung.
		if (!(f instanceof FachlicherFehler) || f.kennung !== 'summe_unzulaessig') throw f;
	}
	/*
	 * **Offen nur, wenn ausser dem Stichentscheid nichts fehlt** (Fachprüfung
	 * Runde 5): Der Stichentscheid löst den Gleichstand der Köpfe, nicht
	 * fehlende Wertquoten (Rz. 191 f. ad Art. 712m). Bei L4 und L2 tritt der Fall
	 * ein, wenn die Gemeinschaft «qualifiziert» gewählt hat: Dort gibt es seit dem
	 * 30.10.2026 keinen Stichentscheid (`stichentscheidMoeglich`), nach dem
	 * einfachen Mehr der anderen Lesart schon, und dieses verlangt ausser dem
	 * Kopfmehr nichts (Wächter im Test, gemessen an L4). Bei L1 nicht, weil die
	 * Köpfe sich nicht ändern.
	 */
	const offen = b !== null && b.stichentscheidOffen && b.quoten.erreicht && b.betroffene.erfuellt;
	return {
		...worte,
		feststellbar: b !== null && !offen,
		...(b === null
			? { nichtFeststellbarWeil: 'summen' as const }
			: offen
				? { nichtFeststellbarWeil: 'stichentscheid' as const }
				: {}),
		angenommen: b && !offen ? b.angenommen : null,
		koepfe: b ? auszug(b.koepfe) : null,
		quoten: b && anderes.quotenbasis !== 'keine' && anderes.quotenSchwelle ? auszug(b.quoten) : null,
		abweichend: b !== null && !offen && b.angenommen !== a.angenommen
	};
}

/**
 * **Nicht in `hinweise`** (Codeprüfung Teil 3, M1): Die gehen auch in das
 * Auswertungs-PDF für alle Eigentümer. Der Satz für die Leitung mit ihrem Rat
 * entsteht dort, wo die Leitung ihn liest (`andereLesartInWorten`); hier
 * bleibt der Satz fürs Protokoll. Er nennt Frist und Berechtigte, wo das
 * Protokoll die Frist für Abwesende in Gang setzt (1a nach A5 Punkt 14, B3).
 */
function mitProtokollsatz(a: Auszaehlung, r: ErgebnisNachAndererLesart): Auszaehlung {
	const protokoll = andereLesartInWorten(r, a.geheim).protokoll;
	return protokoll
		? { ...a, protokollhinweise: [...(a.protokollhinweise ?? []), { ort: 'ausgang', satz: protokoll }] }
		: a;
}

/**
 * Am Rückkommen unter L6 der Satz zur Lesart des Beschlusses (B2b; Laien- und
 * Fachprüfung F4c B2, B2-F-3, B2-L-3 bis B2-L-5). Das Rückkommen übernimmt das
 * Mehr und damit die Wahl; ohne den Satz trat das umstrittene Mehr als geklärt
 * auf, und unter «Nach dem Gesetz» widersprachen sich Titel und Mehr.
 *
 * **Was die andere Wahl hier hiesse, nur mit dem Grund** (B2-F-3): unter der
 * Klausel, warum es nach beiden Lesarten besteht; unter dem Gesetz, wenn der
 * Beschluss die Zustimmung aller nicht hatte, dass er nach der Klausel schon
 * abgelehnt war; hatte er sie, die Warnung aus B2-F-4. Weiss das Rückkommen
 * nicht, wie der Beschluss ausging, bleibt es beim ersten Satz.
 */
function rueckkommenKartensatz(e: Erfordernis | null | undefined): string | null {
	const l = e ? l6AmRueckkommen(e) : null;
	if (!l) return null;
	const gesetz = l.wahl === 'gesetz';
	const saetze = [
		`Zum Mehr: Das Rückkommen braucht dasselbe Mehr wie der Beschluss und rechnet wie dieser nach der ` +
			`Lesart «${ohneVorgabe('L6', l.wahl)}», ` +
			(gesetz ? 'dem qualifizierten Mehr.' : 'der Zustimmung aller Eigentümer, auch der abwesenden.'),
		gesetz
			? 'Die Klausel im Titel steht in Ihrem Reglement; ob sie gilt, ist umstritten (Seite «Lesarten»).'
			: 'Ob die Klausel gilt, ist umstritten (Seite «Lesarten»).'
	];
	if (!gesetz && l.mitAllen === true) {
		saetze.push(
			'Wird das Rückkommen angenommen, haben ihm alle Eigentümer zugestimmt; wird es abgelehnt, gilt ' +
				'der Beschluss, dem alle zugestimmt haben. Beides besteht nach beiden Lesarten.'
		);
	}
	if (gesetz && l.mitAllen === false) {
		saetze.push(
			'Ein Ergebnis nach «Klausel anwenden» nennt Votum hier nicht: Nach ihr wäre schon der Beschluss ' +
				'abgelehnt gewesen.'
		);
	}
	if (gesetz && l.mitAllen === true) {
		saetze.push(
			'Dem Beschluss haben alle Eigentümer zugestimmt, er besteht nach beiden Lesarten. Seine Aufhebung ' +
				'mit diesem Mehr besteht nur nach «Nach dem Gesetz»: Gilt die Klausel, braucht auch sie die ' +
				'Zustimmung aller, und ohne sie kann sie angefochten werden. Sicher ist die Aufhebung nur mit der ' +
				'Zustimmung aller Eigentümer, im Saal, vertreten oder in einem schriftlichen Beschluss aller. Eine ' +
				'nachträgliche Zustimmung ergänzt die Abstimmung im Saal nicht.'
		);
	}
	return saetze.join(' ');
}

/**
 * Die Sätze auf der Karte vor der Abstimmung zu den Lesarten und, seit Block 6,
 * zu den festen Vergleichen (1a, Anhang A), oder `null`, wo es keines davon
 * gibt (Konzept Lesarten, Abschnitt 3, «Karte vor der Abstimmung»;
 * Kriterium 4). Zu einer Lesart nennt er die angewandte und was die andere
 * verlangt; 1a und Anhang A sind keine Lesarten (Review DeepSeek, Befund 4).
 * Unter L9 nennt der Satz zur Lesart am Mehr das zweite Ergebnis, und der
 * feste Vergleich zu 1a schweigt (E1, Block C).
 *
 * Hier und nicht in `mehrhinweise.ts`, weil er das Mehr in Worten braucht
 * (`erfordernisInWorten`); `mehrhinweise.ts` wird von hier eingebunden.
 */
export function lesartKartensatz(
	e: Erfordernis | null | undefined,
	/**
	 * Die Wahl zu L1, wo sie nicht vom Erfordernis kommen darf: vor der Freigabe
	 * die der Gemeinschaft, denn das Traktandum kann eine veraltete tragen
	 * (Entwurf Block 2, «Umstellen vor der Freigabe»). Sonst die eingefrorene.
	 */
	ausstandswahl?: Ausstandswahl,
	/**
	 * Die Wahl zu L13 ebenso (Codeprüfung Block C, N2 und N-A): Sie zählt, wo L13 am
	 * eigenen Mehr nicht wirkt, also unter der Enthaltungsklausel und am anderen
	 * Mehr von L2, L4 und L11; wo L13 wirkt, sagt die Kopfbasis die Wahl.
	 */
	kopfzaehlweise?: Kopfzaehlweise
): string | null {
	const saetze = [
		rueckkommenKartensatz(e),
		lesartenDerGemeinschaftKartensatz(e, ausstandswahl, kopfzaehlweise),
		festerVergleichKartensatz(e)
	].filter(
		(t): t is string => t !== null
	);
	return saetze.length > 0 ? saetze.join(' ') : null;
}

/**
 * Der Vermerk im Protokoll beim Gleichstand an einem Mehr, an dem die hinterlegte
 * Klausel nicht greift (A5, Punkt 12b; A1 Frage 1, Punkt 3). Die Leitung hat das
 * Mehr vor der Abstimmung bestimmt (Rz. 99 ad Art. 712n).
 */
const STICHENTSCHEID_NICHT_ANGEWANDT =
	'Bei Stimmengleichheit wurde die hinterlegte Klausel zum Stichentscheid hier nicht angewandt: Dieses ' +
	'Traktandum verlangt ein anderes Mehr als das einfache ohne Wertquoten. Der Antrag ist damit abgelehnt.';

/**
 * Ob der Vermerk steht. Nicht bei geheimer Abstimmung: Auch ein Patt ist eine
 * Angabe über die Verteilung (`ergebnisInWorten`). Nicht, wo das Mehr auch bei
 * Gleichstand erreicht ist (ein Reglementsmehr unter der Hälfte). Ohne Beschluss
 * nimmt ihn `mitKeinemBeschluss` wieder heraus.
 */
function stichentscheidNichtAngewandt(
	lage: Pick<Auszaehlungslage, 'momentaufnahme' | 'erfordernis' | 'geheim'>,
	koepfe: { ja: number; nein: number; erreicht: boolean }
): boolean {
	return (
		lage.geheim !== true &&
		lage.momentaufnahme.tieBreak !== 'keiner' &&
		lage.erfordernis.kopfSchwelle !== null &&
		!stichentscheidMoeglich(lage.erfordernis) &&
		koepfe.ja > 0 &&
		koepfe.ja === koepfe.nein &&
		!koepfe.erreicht
	);
}

/**
 * Der Satz an die Leitung vor der Abstimmung, wenn ein Stichentscheid
 * hinterlegt ist und das Traktandum ein anderes Mehr verlangt (A5, Punkt 12b;
 * A1 Frage 1, Punkt 3): Die Klausel gilt hier nicht, und das sagt die Leitung
 * vor der Abstimmung, weil sie das Mehr bestimmt, nachdem sie es gesagt hat
 * (Rz. 99 ad Art. 712n). `null`, wo die Klausel greifen kann oder keiner
 * hinterlegt ist.
 */
export function stichentscheidGrenzeKartensatz(
	e: Erfordernis | null | undefined,
	tieBreak: Stichentscheid
): string | null {
	if (!e || !e.kopfSchwelle || tieBreak === 'keiner' || stichentscheidMoeglich(e)) return null;
	return (
		'Ihre Gemeinschaft hat bei Stimmengleichheit einen Stichentscheid hinterlegt. Nach ihrer Einstellung gilt die Klausel bei ' +
		'diesem Traktandum nicht: Es verlangt ein anderes Mehr als das einfache ohne Wertquoten, und das ' +
		'Mehr steht vor der Abstimmung fest. Sagen Sie das der Versammlung, bevor Sie abstimmen lassen; ' +
		'bei Stimmengleichheit ist der Antrag dann abgelehnt.'
	);
}

/**
 * Der Satz zu 1a und Anhang A auf der Karte der Leitung (Lesarten Block 6,
 * Kriterium 4): welches zweite Ergebnis Votum nach der Auszählung nennt. Die
 * Gegenlesart zu 1a mit Fundstelle steht schon im Satz zur Zählbasis
 * (`kopfbasisStreit`); hier nur die Ankündigung. Die Karte sieht nur die
 * Leitung, deshalb darf Anhang A hier stehen (Entscheid 0023).
 */
function festerVergleichKartensatz(e: Erfordernis | null | undefined): string | null {
	if (!e) return null;
	// Unter L9 sagt der Satz der Lesart selbst, dass Votum das Ergebnis an der
	// anderen Zahl nennt (`lesartKartensatzAmMehr`); ein zweiter Satz dazu wäre
	// derselbe Hinweis zweimal (E1, Block C).
	if (e.gemeinschaftslesart?.kennung === 'L9') return null;
	const basis = andereZaehlbasisVon(e);
	if (basis) {
		return (
			'Nach der Auszählung nennt Votum auch das Ergebnis, gezählt ' +
			`${basis === 'anwesend_vertreten' ? ZAEHLBASIS_ANWESENDE : ZAEHLBASIS_ALLE}.`
		);
	}
	const gesetz = erfordernisNachGesetz(e);
	if (!gesetz) return null;
	// Laienprüfung L6-2: vor der Abstimmung sagen, dass ein milderes Mehr angreifbar macht.
	// An Ausschlussklage und Einsprache zählt «alle Eigentümer» wie «alle ausser
	// den Betroffenen» (`kopfbasisZumVergleich`), und verglichen wird mit der
	// Rangliste, die diese Basis kennt, wie in `einordnungGegenGesetz`
	// (Codeprüfung der Review-Behebungen, Befund 1).
	const a = masseVon(e);
	const b = masseVon(gesetz);
	const ohneBetroffene = betroffeneStimmenNichtMit({ kopfbasis: 'anwesend_vertreten', knotenId: e.knotenId });
	// Ohne Kopfschwelle lässt sich nicht vergleichen; wie bei der Einladung gilt das als milder.
	const richtung = a && b ? vergleicheMasse(a, b, ohneBetroffene) : 'gemischt';
	const milder =
		richtung === 'milder' ||
		richtung === 'gemischt' ||
		(!e.zustimmungBetroffenerNoetig && gesetz.zustimmungBetroffenerNoetig);
	const zaehlweise = abweichungNachZaehlweise(e, gesetz);
	// Fachprüfung Block C, Nachtrag Runde 2, N2-F-1: die Einstellung beim Namen.
	if (zaehlweise === 'nur') {
		return (
			'Gezählt wird nach dem hier gewählten Mehr. Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der ' +
			`Köpfe («Alle Eigentümer») gälte ${erfordernisInWorten(gesetz).replace(/ — unabhängig davon, wer erscheint$/, ', gleich wer erscheint')}; ` +
			'nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach. So zählt auch der Wortlaut des ' +
			// Zwei Sätze statt des einen der Fachprüfung (Textwächter, 180 Zeichen); der Inhalt ist derselbe.
			'Gesetzes. Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und ' +
			'Vertretenen; das Bundesgericht hat für diese Art von Beschluss nicht entschieden. Ein angenommener ' +
			'Beschluss, dem nicht mehr als die Hälfte aller Eigentümer zugestimmt hat, kann angefochten werden.'
		);
	}
	const satz =
		`Gezählt wird nach dem hier gewählten Mehr. Nach Gesetz und Reglement gälte ${erfordernisInWorten(gesetz)}; ` +
		'nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach.' +
		// Fachprüfung Nachtrag Runde 3, N3-F-2: woher die Zahl aller Eigentümer kommt.
		(zaehlweise === 'mit' ? ` ${ZWEITES_NACH_ZAEHLWEISE_VORHER}` : '') +
		(milder
			? ' Das gewählte Mehr ist in mindestens einem Punkt milder: Ein angenommener Beschluss, der das ' +
				'Mehr aus Gesetz und Reglement verfehlt, kann angefochten werden.'
			: '');
	return zaehlweise === 'mit' ? mitBezeichnungNachZaehlweise(satz) : satz;
}

function masseVon(e: Erfordernis): Mehrmasse | null {
	if (!e.kopfSchwelle) return null;
	return {
		kopfbasis: kopfbasisZumVergleich(e.knotenId, e.kopfbasis),
		kopfSchwelle: e.kopfSchwelle,
		quotenbasis: e.quotenbasis,
		quotenSchwelle: e.quotenSchwelle,
		enthaltungZaehltMit: e.enthaltungZaehltMit !== false
	};
}

/** Der Schluss des Kartensatzes zu L13, wie der zu L4 und L1 (`lesartenDerGemeinschaftKartensatz`). */
const L13_SCHLUSS = ' Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Zählweise.';

/**
 * Der Satz zu L13 auf der Karte vor der Abstimmung (Endfassung Block C,
 * Abschnitt 2): der einzige Satz auf der Karte, der sagt, wie Votum die Köpfe
 * zählt. Nach der Wahl, die das Erfordernis rechnet (`kopfzaehlweiseDesMehrs`).
 * Wo die Enthaltungsklausel L13 verdrängt, unter «Alle Eigentümer» der Satz
 * aus Abschnitt 6 und unter der Vorgabe keiner (`verdraengt`).
 */
export function kopfzaehlweiseKartensatz(
	e: Erfordernis,
	/** Vor der Freigabe die Wahl der Gemeinschaft, wie bei L1 (Codeprüfung Block C, N2). */
	kopfzaehlweise?: Kopfzaehlweise
): { satz: string; verdraengt: boolean } | null {
	if (!zaehlweiseSaetzeAm(e)) return null;
	if (kopfzaehlweiseVerdraengt(e)) {
		return (kopfzaehlweise ?? e.kopfzaehlweise) === 'alle'
			? {
					satz:
						'Ihre Gemeinschaft hat für die Köpfe «Alle Eigentümer» eingestellt. ' +
						// Fachprüfung Nachtrag, N-F-11: Neben dem zweiten Ergebnis nach L2,
						// das unter allen Eigentümern zählt.
						(andererMehrZaehltNachL13(e) ? 'Hier wirkt das am einfachen Mehr nicht: ' : 'Hier wirkt das nicht: ') +
						'Ihr Reglement zählt Enthaltungen beim einfachen Mehr nicht mit, und Votum wendet das an. Gezählt ' +
						'werden deshalb die Anwesenden und Vertretenen ohne die Enthaltungen.',
					verdraengt: true
				}
			: null;
	}
	if (!kopfzaehlweiseWirkt(e)) return null;
	return {
		satz:
			kopfzaehlweiseDesMehrs(e) === 'anwesende'
				? 'Die Köpfe zählt Votum hier unter den Anwesenden und Vertretenen; das ist die ' +
					'Standardeinstellung. Nach der anderen Zählweise («Alle Eigentümer») zählten alle Eigentümer, ' +
					'und wer fehlt, ohne eine Vollmacht zu geben, wirkte wie ein Nein.' +
					L13_SCHLUSS
				: 'Die Köpfe zählt Votum hier unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ' +
					'ist; die Standardeinstellung wäre die Zählung unter den Anwesenden und Vertretenen. Wer fehlt, ' +
					'ohne eine Vollmacht zu geben, wirkt wie ein Nein, ebenso wer im Ausstand ist, also nicht ' +
					'mitstimmen darf, weil es um ein Geschäft oder einen Streit zwischen ihm und der Gemeinschaft ' +
					'geht.' +
					L13_SCHLUSS,
		verdraengt: false
	};
}

/**
 * **Am Rückkommen kein Kartensatz, keine Protokollzeile, keine Siegelzeile und
 * kein zweites Ergebnis zu L13** (Codeprüfung Block C, M1; Entscheid der
 * Sitzung): Das Rückkommen braucht dasselbe Mehr wie der Beschluss und rechnet
 * es mit Kopfbasis und Ausstand in der Zahl. Lesart und zweites Ergebnis stehen
 * am Beschluss selbst (`rueckkommen.ts`), wie bei 1a und Anhang A
 * (`RUECKKOMMEN_TITEL`). Zwei Sätze bleiben, weil sie die Rechnung des
 * Rückkommens erklären: der eigene Satz zur Zählung in `kopfbasisStreit`
 * (Lauf 2, M-A) und die Zeile zur Wirkung des Ausstands mit «wie beim
 * ursprünglichen Beschluss» (N2-L-04).
 */
function zaehlweiseSaetzeAm(e: Erfordernis): boolean {
	return !e.titel.startsWith(RUECKKOMMEN_TITEL);
}

/** Ob das andere Mehr nach L2, L4 oder L11 nach der Zählweise der Köpfe zählt, das eigene aber nicht. */
function andererMehrZaehltNachL13(e: Erfordernis): boolean {
	const anderes = erfordernisNachAndererLesart(e);
	return anderes !== null && kopfzaehlweiseWirkt(anderes);
}

/**
 * Die Sätze zu den Lesarten der Gemeinschaft auf der Karte: L1, die Lesart am
 * Mehr (L2, L4, L6, L9, L11, L12) und die Zählweise der Köpfe (L13).
 *
 * **L13 steht hinter dem Satz zum Mehr** (Endfassung Block C, Abschnitt 2):
 * Mit L2, L4 oder L11 am selben Traktandum steht der Schluss «Nach der
 * Auszählung …» einmal und nennt die anderen Wahlen beim Namen, wie bisher L4
 * mit L1. **Was sich auf den Schluss bezieht, steht danach** (Laienprüfung
 * Nachtrag, N-L-06): der Rat zur Erfassung («dafür»), der Satz zur Wertquote im
 * Ausstand am anderen Mehr, an die Wertquote gebunden, damit «ändert nichts»
 * nicht vor dem Satz zur Zählweise steht, wo der Ausstand das Ergebnis ändern
 * kann, und die Folge der milden Wahl.
 */
function lesartenDerGemeinschaftKartensatz(
	gespeichert: Erfordernis | null | undefined,
	ausstandswahl?: Ausstandswahl,
	kopfzaehlweise?: Kopfzaehlweise
): string | null {
	if (!gespeichert) return null;
	/*
	 * **Vor der Freigabe die Wahl der Gemeinschaft auch am anderen Mehr**
	 * (Codeprüfung Block C, Lauf 2, N-A, wie N2): Unter L4 oder L11 «einfach»
	 * wirkt L13 am gerechneten Mehr nicht, und die gespeicherte Wahl kann nach
	 * einer Umstellung veraltet sein; die Freigabe zieht sie nach. Wo L13 am
	 * eigenen Mehr wirkt, sagt die Kopfbasis die Wahl, und Kasten und Absage
	 * zeigen die Abweichung.
	 */
	const e =
		kopfzaehlweise !== undefined && gespeichert.kopfzaehlweise !== undefined && !kopfzaehlweiseWirkt(gespeichert)
			? { ...gespeichert, kopfzaehlweise }
			: gespeichert;
	const ohneL13 = lesartenOhneZaehlweiseKartensatz(e, ausstandswahl);
	const l13 = kopfzaehlweiseKartensatz(e, kopfzaehlweise);
	if (!l13) return ohneL13;
	if (!ohneL13 || l13.verdraengt) return ohneL13 ? `${ohneL13} ${l13.satz}` : l13.satz;
	const wahl1 = ausstandswahl ?? wahlL1(e);
	const l1 = ausstandslesartWirkt(e) ? ausstandslesartKartensatz(wahl1) : null;
	const mehr = lesartKartensatzAmMehrTeile(e);
	// Endet der Satz zu L1 anders (etwa nach einer Textänderung), bleiben die
	// Sätze ganz stehen, statt die Seite im Saal abzubrechen; der Test wird rot.
	if ((l1 && !l1.endsWith(L1_SCHLUSS)) || !l13.satz.endsWith(L13_SCHLUSS) || (!mehr && !l1)) {
		return `${ohneL13} ${l13.satz}`;
	}
	const ohneSchluss = (satz: string, schluss: string) => satz.slice(0, -schluss.length);
	const name = (kennung: string, wert: string) => wahlInWorten(kennung, wert).replace(/ \(Vorgabe\)$/, '');
	const andere = [
		mehr ? `nach «${name(e.gemeinschaftslesart!.kennung, e.gemeinschaftslesart!.andere.wahl)}»` : null,
		`nach «${name('L13', andereKopfzaehlweise(kopfzaehlweiseDesMehrs(e)))}»`
	].filter((t): t is string => t !== null);
	const schluss =
		'Nach der Auszählung nennt Votum zusätzlich das Ergebnis ' +
		(l1
			? `${andere.join(', ')} und, wenn jemand im Ausstand ist, nach «${name('L1', wahl1 === 'bleibt' ? 'faellt_heraus' : 'bleibt')}».`
			: `${andere.join(' und ')}.`);
	const koepfe = ohneSchluss(l13.satz, L13_SCHLUSS);
	const anderes = erfordernisNachAndererLesart(e);
	const danach = [
		mehr?.erfassen,
		mehr && !l1 && anderes && ausstandslesartWirkt(anderes) ? l1AmAnderenMehrSatz(wahl1, true) : null,
		mehr?.folge
	].filter((t): t is string => !!t);
	if (!l1) return [mehr!.kopf, koepfe, schluss, ...danach].join(' ');
	// Mit L1 je Frage ein Vorspann, wie bisher L4 mit L1 (Laienprüfung des gemeinsamen Satzes, M1).
	return [
		...(mehr ? [`Zum Mehr: ${mehr.kopf}`] : []),
		`Zur Zählweise der Köpfe: ${koepfe}`,
		`Zur Wertquote im Ausstand: ${ohneSchluss(l1, L1_SCHLUSS)}`,
		schluss,
		...danach
	].join(' ');
}

/** Der Schluss des Kartensatzes zu L1 (`ausstandslesartKartensatz`). */
const L1_SCHLUSS = ' Nach der Auszählung nennt Votum dann auch das Ergebnis nach der anderen Lesart.';

/**
 * Der Satz zur Wertquote im Ausstand am anderen Mehr (A5, Punkt 6): Rechnet das
 * Traktandum ohne Wertquoten und das andere Mehr über alle, wirkt dort die
 * Wahl zu L1. **An die Wertquote gebunden** (`gebunden`), wo der Satz neben
 * dem zu L13 steht (Laienprüfung Nachtrag, N-L-06): Unter «Alle Eigentümer»
 * ändert der Ausstand bei den Köpfen das Ergebnis.
 */
function l1AmAnderenMehrSatz(wahl1: Ausstandswahl, gebunden: boolean): string {
	return (
		'Das Ergebnis nach der anderen Lesart rechnet über alle Wertquoten. Tritt jemand in den Ausstand, ' +
		(wahl1 === 'bleibt'
			? 'bleibt in diesem Ergebnis seine Wertquote nach der Einstellung Ihrer Gemeinschaft in der Zahl und wirkt wie ein Nein.'
			: 'wird in diesem Ergebnis die Zahl aller Wertquoten nach der Einstellung Ihrer Gemeinschaft um seine Wertquote kleiner.') +
		(gebunden
			? ' Am Ergebnis, das Sie verkünden, ändert die Wertquote im Ausstand nichts.'
			: ' Am Ergebnis, das Sie verkünden, ändert das nichts.')
	);
}

/** Die Sätze zu L1 und zur Lesart am Mehr, wie bis Block C. */
function lesartenOhneZaehlweiseKartensatz(
	e: Erfordernis,
	ausstandswahl?: Ausstandswahl
): string | null {
	// L1 an jedem Traktandum, an dem sie wirken kann (Review DeepSeek Block 2, Befund 6).
	const l1 = ausstandslesartWirkt(e)
		? ausstandslesartKartensatz(ausstandswahl ?? wahlL1(e))
		: null;
	const l4 = lesartKartensatzAmMehr(e);
	if (!l4 || !l1) {
		const nur = l4 ?? l1;
		if (!nur) return null;
		/*
		 * A5, Punkt 6 (zweite Codeprüfung Block 2): Rechnet das Traktandum nach
		 * L4 oder L2 «einfach», rechnet das zweite Ergebnis nach «qualifiziert»
		 * über alle Wertquoten, und dort wirkt die eingestellte Wahl zu L1 mit.
		 * Die Karte sagte das bisher nicht. Nur wo es zutrifft: nicht, wenn das
		 * Traktandum selbst schon über alle Wertquoten rechnet (dann steht L1 als
		 * eigener Satz da), und nicht ohne Lesart am Mehr. Mit der Wahl, die
		 * wirklich eingestellt ist: «fällt heraus» zählt eben nicht mit.
		 */
		const anderes = erfordernisNachAndererLesart(e);
		if (l4 && anderes && ausstandslesartWirkt(anderes)) {
			return `${l4} ${l1AmAnderenMehrSatz(ausstandswahl ?? wahlL1(e), false)}`;
		}
		return nur;
	}
	/*
	 * **Beide an einem Traktandum** (L4 oder L2 «qualifiziert» rechnet über
	 * alle Wertquoten): ein Schlusssatz, der sagt, welche andere Lesart wann ein
	 * zweites Ergebnis gibt (Codeprüfung der Review-Behebung, N1). Zwei gleiche
	 * Schlusssätze liessen offen, welche gemeint ist.
	 */
	// Endet ein Satz anders (etwa nach einer Textänderung), bleiben beide ganz
	// stehen, statt die Seite im Saal mit einem Fehler abzubrechen (zweite
	// Codeprüfung, N1); der Test über den gemeinsamen Satz wird dann rot.
	const l4Schluss = ' Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Lesart.';
	const l1Schluss = ' Nach der Auszählung nennt Votum dann auch das Ergebnis nach der anderen Lesart.';
	if (!l4.endsWith(l4Schluss) || !l1.endsWith(l1Schluss)) return `${l4} ${l1}`;
	const ohneSchluss = (satz: string, schluss: string) => satz.slice(0, -schluss.length);
	// Laienprüfung des gemeinsamen Satzes, M1 und M2: je Frage ein Vorspann,
	// und die anderen Lesarten beim Namen statt zweimal «die andere».
	const name = (kennung: string, wert: string) => wahlInWorten(kennung, wert).replace(/ \(Vorgabe\)$/, '');
	const wahl1 = ausstandswahl ?? wahlL1(e);
	// Die Lesart am Mehr beim Namen ihrer Kennung, nicht fest L4 (Block 3: L2
	// «qualifiziert» rechnet ebenfalls über alle Wertquoten).
	const l = e.gemeinschaftslesart!;
	const andereL4 = name(l.kennung, l.andere.wahl);
	const andereL1 = name('L1', wahl1 === 'bleibt' ? 'faellt_heraus' : 'bleibt');
	return (
		`Zum Mehr: ${ohneSchluss(l4, l4Schluss)} ` +
		`Zur Wertquote im Ausstand: ${ohneSchluss(l1, l1Schluss)} ` +
		`Nach der Auszählung nennt Votum zusätzlich das Ergebnis nach «${andereL4}» und, wenn jemand im ` +
		`Ausstand ist, nach «${andereL1}».`
	);
}

/**
 * Die heutige Vorgabe einer Lesart im Satz, etwa «das qualifizierte Mehr», für
 * die Herkunftssätze alter Traktanden (Laienblick Block B: «damals» ohne «heute»
 * liess offen, ob der Beschluss falsch gezählt sei).
 */
function heutigeVorgabeImSatz(kennung: string): string | undefined {
	const lesart = lesartVon(kennung);
	return lesart?.wahlen.find((w) => w.wert === lesart.vorgabe)?.imSatz;
}

/**
 * **Spricht der heutige Katalog für dieses Erfordernis?** (Entscheid 0048,
 * Block B, Nachtrag der Sitzung.) Am Erfordernis ist eingefroren, ob seine
 * Wahl bei der Herleitung die Vorgabe war (`vorgabe`). Grund und
 * Standardeinstellung liest der Satz dagegen aus dem heutigen Katalog. Das
 * passt nur, solange die damalige Vorgabe die heutige ist: Seit der Fassung
 * 2026-11-13 ist bei L4 «qualifiziert» die Vorgabe, und ein Traktandum, das
 * vorher mit «einfach» als Vorgabe hergeleitet wurde, hiesse sonst «Das
 * einfache Mehr ist die Standardeinstellung: Nach dem Wortlaut … braucht die
 * Wahl … das qualifizierte Mehr». Weicht die Herkunft ab, nennen die Sätze nur
 * noch, was damals galt, ohne den heutigen Grund (`herkunftWieHeute`
 * falsch); der Satz nennt die heutige Standardeinstellung dazu.
 */
function herkunftWieHeute(l: AngewandteLesart): boolean {
	const heute = lesartVon(l.kennung)?.vorgabe;
	return heute !== undefined && l.vorgabe === (l.wahl === heute);
}

/**
 * Die eingestellte und die andere Lesart in Worten für den Entscheidungsweg
 * des Siegelpakets. «(Vorgabe)» kommt aus der eingefrorenen Herkunft, nicht aus
 * dem heutigen Katalog: nur wenn `vorgabe` wahr ist und `herkunftWieHeute`
 * gilt. Weicht die Herkunft ab, steht bei der gerechneten Wahl «(damals
 * Vorgabe)», wenn sie es war, und bei der anderen nichts (Codeprüfung Block B,
 * 13.11.2026).
 */
export function lesartenZeileMitHerkunft(l: AngewandteLesart): string {
	const ohne = (wert: string) => wahlInWorten(l.kennung, wert).replace(/ \(Vorgabe\)$/, '');
	if (!herkunftWieHeute(l)) {
		return `${ohne(l.wahl)}${l.vorgabe ? ' (damals Vorgabe)' : ''}; die andere: ${ohne(l.andere.wahl)}`;
	}
	return `${ohne(l.wahl)}${l.vorgabe ? ' (Vorgabe)' : ''}; die andere: ${ohne(l.andere.wahl)}${l.vorgabe ? '' : ' (Vorgabe)'}`;
}

/**
 * **Die Folge der milden Wahl nur, wenn das Traktandum sie rechnet** (Nachtrag
 * Block B): Massgebend ist, ob die gerechnete Wahl heute nicht die Vorgabe ist
 * und der Katalog für sie eine Folge nennt, nicht das eingefrorene Merkmal.
 * Ein Traktandum aus der Fassung 2026-11-11 mit L4 «qualifiziert» trug
 * `vorgabe: false` und bekam sonst die Folge des einfachen Mehrs, obwohl es
 * qualifiziert rechnet.
 */
function folgeDerMildenWahl(l: AngewandteLesart): string | undefined {
	const lesart = lesartVon(l.kennung);
	if (!lesart?.folgeMilderWahl || l.wahl === lesart.vorgabe) return undefined;
	return lesart.folgeMilderWahl;
}

/** Der Satz zu einer Lesart am Mehr (L2, L4, L6, L9, L11, L12), oder `null` ohne Knotenlesart. */
function lesartKartensatzAmMehr(e: Erfordernis): string | null {
	const t = lesartKartensatzAmMehrTeile(e);
	if (!t) return null;
	return [t.kopf, t.schluss, t.zweitesNachZaehlweise, t.erfassen, t.folge].filter((x): x is string => !!x).join(' ');
}

/**
 * Die Teile des Satzes zur Lesart am Mehr, damit der Satz zu L13 dazwischen
 * stehen kann (`lesartenDerGemeinschaftKartensatz`): Kopf bis «verlangt …»,
 * der Schluss, der Rat zur Erfassung und die Folge der milden Wahl.
 */
function lesartKartensatzAmMehrTeile(e: Erfordernis): {
	kopf: string;
	schluss: string;
	zweitesNachZaehlweise?: string;
	erfassen?: string;
	folge?: string;
} | null {
	const l = e.gemeinschaftslesart;
	const anderes = erfordernisNachAndererLesart(e);
	if (!l || !anderes) return null;
	const gewaehlt = wahlInWorten(l.kennung, l.wahl).replace(/ \(Vorgabe\)$/, '');
	const andere = wahlInWorten(l.kennung, l.andere.wahl).replace(/ \(Vorgabe\)$/, '');
	/*
	 * **«Eingestellt», nicht «gewählt» oder «die Gemeinschaft rechnet»**
	 * (Laien- und Fachprüfung 20.10.2026, H3 und Befund 10): Umgestellt hat die
	 * Verwaltung im Werkzeug, beschlossen hat niemand.
	 */
	const kopf =
		// Codeprüfung Teil 4, M1: nicht «ist eingestellt». Ab der Freigabe gilt die
		// eingefrorene Wahl, auch wenn die Seite «Lesarten» inzwischen anderes zeigt.
		// A5, Punkt 1b: der Grund der Vorgabe statt der Software. Ohne Schlusspunkt,
		// weil der Satz hinter der Klammer weitergeht.
		`Dieses Traktandum rechnet nach der Lesart «${gewaehlt}»` +
		`${!herkunftWieHeute(l)
			? // Nachtrag Block B: nur die Herkunft, ohne den Grund des heutigen Katalogs.
				l.vorgabe
				? `. Sie war bei der Freigabe dieses Traktandums die Standardeinstellung (heute ist es ${heutigeVorgabeImSatz(l.kennung) ?? 'die andere'})`
				: ', die für Ihre Gemeinschaft eingestellt ist'
			: l.vorgabe
				? ` (Standardeinstellung: ${(lesartVon(l.kennung)?.vorgabeGrund ?? '').replace(/\.$/, '')})`
				: `, die für Ihre Gemeinschaft eingestellt ist (die Standardeinstellung wäre die andere: ${(lesartVon(l.kennung)?.vorgabeGrund ?? '').replace(/\.$/, '')})`}: ` +
		`${erfordernisInWorten(e)}. Die andere Lesart («${andere}») verlangt ${erfordernisInWorten(anderes)}.`;
	return {
		kopf,
		schluss: 'Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Lesart.',
		/*
		 * **Zählt nur das andere Mehr nach L13** (Fachprüfung Nachtrag, N-F-1): unter
		 * L4 oder L11 «einfach» mit «Alle Eigentümer» das qualifizierte Mehr nach
		 * Art. 647b Abs. 1. Der Satz erklärt der Leitung die Zahl aller Eigentümer.
		 */
		...(nurAnderesNachZaehlweiseAlle(e, anderes)
			? {
					zweitesNachZaehlweise:
						'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für Ihre Gemeinschaft ' +
						'eingestellt ist.'
				}
			: {}),
		// Braucht nur die andere die Wertquoten, fehlen sie einer Summenzählung
		// (Codeprüfung Teil 3, M4; Laienprüfung M2): der Rat gehört vor die Abstimmung.
		...(anderes.quotenbasis !== 'keine' && e.quotenbasis === 'keine'
			? { erfassen: 'Erfassen Sie dafür die Stimme jedes Eigentümers; aus Summen von Hand fehlen die Wertquoten.' }
			: {}),
		/*
		 * **Die Folge der milden Wahl** (E1, L11; Entscheid 0044, zweiter
		 * Nachtrag), am Ende des Satzes zur Lesart am Mehr: nach dem Rat zur
		 * Erfassung, auf den sich sein «dafür» bezieht, und vor dem Satz zu L1,
		 * hinter dem die Leitung nicht mehr weiterliest (Laienprüfung E1 L11,
		 * L-6). Die übrigen Lesarten tragen das Feld nicht.
		 */
		...(folgeDerMildenWahl(l) ? { folge: folgeDerMildenWahl(l) } : {})
	};
}

/**
 * Der Satz zur Herkunft unter der Wahl, die nicht die Vorgabe ist, ohne
 * Schlusspunkt (Auftrag «Texte nach 0047», Punkt 1; Fachprüfung E1, L12 F-3
 * und L9 R2-F-3): Nicht Votum entscheidet, was gilt, deshalb nicht mehr
 * «… galt für diese Versammlung». Was gerechnet wurde, nennt der erste Satz
 * der Zeile («Gezählt nach …»).
 */
export const GERECHNET_NACH_EINSTELLUNG =
	'So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet';

/**
 * Die Zeile zur Lesart im Protokoll, je betroffenen Beschluss (Entscheid 0018,
 * F3; Kriterium 6), oder `null` ohne Lesart. Eine Feststellung ohne
 * Fundstellen, wie die übrigen Zeilen des Protokolls. Das Ergebnis nach der
 * anderen Lesart steht, wenn es abweicht, als Hinweis am Ausgang
 * (`mitAndererLesart`).
 */
export function lesartProtokollsatz(e: Erfordernis | null | undefined): string | null {
	const amRueckkommen = e ? l6AmRueckkommen(e) : null;
	if (amRueckkommen) {
		// Die Zeile am Rückkommen (B2b; B2-F-3, B2-L-6): wie beim Beschluss gezählt
		// und umstritten. Wer eingestellt hat, steht am Beschluss.
		const lesart = lesartVon('L6');
		const dativ = lesart?.wahlen.find((w) => w.wert === amRueckkommen.wahl)?.imSatzDativ;
		if (!lesart || !dativ) return null;
		return (
			`Gezählt wie beim Beschluss nach ${dativ}, weil das Rückkommen dasselbe Mehr braucht. ` +
			`${grossAnfang(lesart.gegenstand)}, ist umstritten.`
		);
	}
	const l = e?.gemeinschaftslesart;
	if (!l) return null;
	const lesart = lesartVon(l.kennung);
	const gewaehlt = wahlInWorten(l.kennung, l.wahl).replace(/ \(Vorgabe\)$/, '');
	const andere = lesart?.wahlen.find((w) => w.wert === l.andere.wahl)?.imSatz ?? l.andere.wahl;
	/*
	 * Wer eingestellt hat und worum es geht (Fachprüfung 20.10.2026, Befund 10;
	 * Laienprüfung H3, M5): Bei L4 stellt die Verwaltung die Lesart für ihre
	 * eigene Wahl ein, und das sollen Eigentümer im Protokoll erkennen.
	 */
	const eigene = lesart?.wahlen.find((w) => w.wert === l.wahl);
	const imSatz = eigene?.imSatz ?? gewaehlt;
	const dativ = eigene?.imSatzDativ ?? gewaehlt;
	const vorgabeImSatz = heutigeVorgabeImSatz(l.kennung);
	// Runde 2 (Laien B8, Fach G): erst was gezählt wurde, dann warum die Zeile
	// steht, dann wer eingestellt hat; ohne «Lesart» als Fachwort im ersten Satz.
	// Codeprüfung Teil 4, M1 und M2: was für diese Versammlung galt, nicht was
	// heute eingestellt ist, und keine Behauptung über frühere Umstellungen.
	// A5, Punkt 1b: der Grund der Vorgabe statt der Software. Ohne Schlusspunkt,
	// der Satz hinter der Klammer und dem Doppelpunkt geht weiter.
	const grund = (lesartVon(l.kennung)?.vorgabeGrund ?? '').replace(/\.$/, '');
	/*
	 * Nachtrag Block B: Weicht die eingefrorene Herkunft vom heutigen Katalog ab,
	 * nur die Herkunft, ohne den heutigen Grund
	 * (`herkunftWieHeute`).
	 */
	const herkunft = !herkunftWieHeute(l)
		? l.vorgabe
			? `Als dieses Traktandum zur Abstimmung bereitgestellt wurde, war ${imSatz} die Standardeinstellung von Votum; seither hat Votum sie auf ${vorgabeImSatz ?? 'die andere'} umgestellt. Das Gesetz hat sich nicht geändert`
			: GERECHNET_NACH_EINSTELLUNG
		: l.vorgabe
			? `${grossAnfang(imSatz)} ist die Standardeinstellung: ${grund}`
			: `${GERECHNET_NACH_EINSTELLUNG}. ` +
				`Die Standardeinstellung wäre ${vorgabeImSatz ?? 'die andere'}: ${grund}`;
	return (
		`Gezählt nach ${dativ}. ` +
		(lesart ? `${grossAnfang(lesart.gegenstand)}, ist umstritten. ` : `Nach der anderen Lesart gälte ${andere}. `) +
		`${herkunft}.`
	);
}

/**
 * Die Zeile zu L13 im Entscheidungsweg des Siegelpakets, oder `null`: wie L1
 * nur, wo L13 wirkt, nach dem Mehr, das gerechnet wurde
 * (`kopfzaehlweiseDesMehrs`), und nicht am Rückkommen (Codeprüfung Block C,
 * M1). Wo die Enthaltungsklausel sie verdrängt, nennt es das Protokoll
 * (`kopfzaehlweiseProtokollsatz`). Hier statt in `server/siegel.ts`, damit der
 * Prüflauf sie fasst (Codeprüfung Block C, Lauf 2, M-C).
 */
export function kopfzaehlweiseSiegelzeile(e: Erfordernis): string | null {
	if (!kopfzaehlweiseWirkt(e) || !zaehlweiseSaetzeAm(e)) return null;
	return `Zählweise der Köpfe (Lesart L13): ${wahlInWorten('L13', kopfzaehlweiseDesMehrs(e))}`;
}

/**
 * Die Zeile zu L13 im Protokoll, je betroffenen Beschluss (Endfassung Block C,
 * Abschnitt 3), oder `null`, wo L13 nicht wirkt. Dahinter steht immer der Satz
 * zum zweiten Ergebnis (`mitAndererKopfzaehlweise`). Wo die Enthaltungsklausel
 * L13 verdrängt, unter «Alle Eigentümer» die Zeile aus Abschnitt 6.
 */
export function kopfzaehlweiseProtokollsatz(e: Erfordernis | null | undefined): string | null {
	if (!e || !zaehlweiseSaetzeAm(e)) return null;
	if (kopfzaehlweiseVerdraengt(e)) {
		if (e.kopfzaehlweise !== 'alle') return null;
		// Fachprüfung Nachtrag, N-F-11: neben dem zweiten Ergebnis nach L2 unter allen Eigentümern.
		return andererMehrZaehltNachL13(e)
			? 'Gezählt nach dem Reglement: die Anwesenden und Vertretenen ohne die Enthaltungen. Die für die ' +
					'Gemeinschaft eingestellte Zählweise «Alle Eigentümer» wirkt am einfachen Mehr hier nicht; das ' +
					'Ergebnis nach dem qualifizierten Mehr zählt nach ihr.'
			: 'Gezählt nach dem Reglement: die Anwesenden und Vertretenen ohne die Enthaltungen. Die für die ' +
					'Gemeinschaft eingestellte Zählweise «Alle Eigentümer» wirkt hier nicht.';
	}
	if (!kopfzaehlweiseWirkt(e)) return null;
	return kopfzaehlweiseDesMehrs(e) === 'anwesende'
		? 'Köpfe gezählt unter den Anwesenden und Vertretenen, wie die herrschende Lehre, die Auffassung der ' +
				'meisten Fachleute (Vorgabe von Votum). Ob hier alle Eigentümer zählen, ist umstritten.'
		: 'Köpfe gezählt unter allen Eigentümern, wie es für diese Versammlung eingestellt war. Die herrschende ' +
				'Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das wäre ' +
				'auch die Vorgabe von Votum.';
}

/**
 * Die Zeile zu L3 im Protokoll (Migration 172, Kriterium 7), je Einsprache, wo
 * L3 wirkt: Sie nennt die angewandte Zählweise. Das Ergebnis nach der anderen
 * Zählweise steht, wenn es abweicht, als Hinweis am Ausgang
 * (`mitAndererZaehlweise`). Gebaut wie `lesartProtokollsatz`, aber mit der Wahl
 * aus `einspracheLesart` und der Bedingung `l3Wirkt` (die Zählweise der
 * Gemeinschaft steckt nicht im Erfordernis).
 */
export function einsprachelesartProtokollsatz(
	e: Erfordernis | null | undefined,
	m: Pick<Snapshot, 'headCountMode'> | null | undefined
): string | null {
	if (!e || !m || !l3Wirkt(e, m)) return null;
	// Laienprüfung Block 5, L5-9: der Grund statt «Voreinstellung von Votum»;
	// Fachprüfung F5-5: «nicht geklärt», denn kein Autor im Bestand erörtert die
	// Frage, «umstritten» wäre nicht belegt.
	return einsprachelesartVon(e) === 'je_eigentuemer'
		? 'Gezählt nach dem Gesetz: eine Stimme je Eigentümer, auch wer mehrere Einheiten hat. Ob bei ' +
				'der Einsprache stattdessen die Zählung je Einheit aus dem Reglement gilt, ist nicht geklärt.'
		: // Laienprüfung Runde 2, R2-1: kein Entscheid «der Gemeinschaft» behaupten.
			'Gezählt je Einheit nach dem Reglement, wie es für diese Versammlung eingestellt war. Ob bei ' +
				'der Einsprache stattdessen nach Gesetz jeder Eigentümer eine Stimme hat, ist nicht geklärt.';
}

function grossAnfang(t: string): string {
	return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Die Folge eines Rückkommens unter L6, wenn der Beschluss die Ja-Stimmen
 * aller hatte und das Rückkommen nach der anderen Wahl anders ausginge (B2b).
 *
 * **Unter «Klausel anwenden» abgelehnt, das qualifizierte Mehr erreicht**
 * (Fachprüfung F4c B2, B2-F-2; R2-F-2): Der Beschluss gilt nach beiden
 * Lesarten; die Aufhebung ist ein eigenes Traktandum mit Ankündigung. Kein
 * Hinweis auf die Anfechtung (B2-F-1, R2-F-4; `quellen` Frage 88). Nur für
 * die Leitung: Die Zeile im Protokoll sagt, wie gezählt wurde.
 *
 * **Unter «Nach dem Gesetz» angenommen ohne die Zustimmung aller** (B2-F-4):
 * Gilt die Klausel, ist die Aufhebung anfechtbar, und die blosse Aufhebung
 * durch das Gericht genügt (Rz. 234 ad Art. 712m). Die Frist läuft für
 * Abwesende ab dem Protokoll (Rz. 230), deshalb dieselbe Aussage dort.
 */
function rueckkommensfolgeInWorten(r: ErgebnisNachAndererLesart): { leitung: string; protokoll: string | null } {
	if (r.angenommen) {
		return {
			leitung:
				'Das Rückkommen hat das qualifizierte Mehr erreicht, nicht aber die Zustimmung aller. Der ' +
				'frühere Beschluss gilt; ihm haben alle Eigentümer zugestimmt, und er besteht nach beiden ' +
				'Lesarten. Wer ihn aufheben will, bringt die Aufhebung als eigenes Traktandum an eine spätere ' +
				'Versammlung, und die Einladung muss sie nennen. Unter «Klausel anwenden» braucht sie dort ' +
				'wieder die Zustimmung aller Eigentümer.',
			protokoll: null
		};
	}
	return {
		leitung:
			'Das Rückkommen ist angenommen, ohne die Zustimmung aller Eigentümer. Nach «Klausel anwenden» ' +
			'wäre es abgelehnt, und der Beschluss, dem alle zugestimmt haben, gälte weiter. Ändert oder ' +
			'hebt der Durchgang nach dem Rückkommen ihn ohne die Zustimmung aller auf, kann man den neuen Beschluss beim ' +
			'Gericht anfechten (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Klagen kann, wer ihm nicht zugestimmt ' +
			'hat, nach einer Ablehnung also auch, wer Ja gestimmt hat. Die Frist ist ein Monat, seit man davon weiss (Wermelinger, Rz. 230 ad Art. 712m). Wer ' +
			'hier oder vertreten ist, weiss es ab heute, wer weder da noch vertreten war, in der Regel ab ' +
			'Erhalt des Protokolls. Folgt das Gericht der Klausel, gilt nach dem Wortlaut des Rückkommens ' +
			'wieder der frühere Beschluss, rückwirkend (Rz. 234 ad Art. 712m). Stellen Sie das Protokoll ' +
			'rasch und nachweisbar zu und setzen Sie den neuen Beschluss erst um, wenn die Fristen ' +
			'abgelaufen sind (Rz. 231 ad Art. 712m).',
		protokoll:
			'Dem Beschluss hatten alle Eigentümer zugestimmt, dem Rückkommen nicht alle. Gilt die Klausel, ' +
			'kann man den Beschluss im Durchgang nach dem Rückkommen beim Gericht anfechten, wenn er den ' +
			'früheren ändert oder aufhebt (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Klagen kann, wer diesem ' +
			'Beschluss nicht zugestimmt hat, nach einer Ablehnung also auch, wer Ja gestimmt hat. Haben ihm alle ' +
			'Eigentümer zugestimmt, besteht er nach beiden Lesarten. Die Frist ist ein Monat, seit man ' +
			'davon weiss; wer weder da noch vertreten war, weiss es in der Regel ab Erhalt dieses ' +
			'Protokolls (Wermelinger, Rz. 230 ad Art. 712m).'
	};
}

/**
 * Was Leitung und Protokoll zum Ergebnis nach der anderen Lesart sagen.
 *
 * **Bei geheimer Abstimmung ohne Zahlen**, wie das Ergebnis selbst
 * (`geheimeWertung`): nur erreicht oder nicht erreicht.
 */
export function andereLesartInWorten(
	r: ErgebnisNachAndererLesart,
	geheim: boolean
): { leitung: string; protokoll: string | null } {
	if (r.kennung === '1a') return zaehlbasisInWorten(r, geheim);
	if (r.kennung === 'B3') return vertretungImAusstandInWorten(r, geheim);
	if (r.kennung === 'A') return { leitung: mehrNachGesetzInWorten(r, geheim), protokoll: null };
	if (r.amRueckkommen) return rueckkommensfolgeInWorten(r);
	if (r.schonRueckkommenAbgelehnt) {
		/*
		 * **Nicht «dasselbe Ergebnis»** (B2b; Befund zur Prüfdatei B2-F-6): Für die
		 * Sache stimmte es, für die Wirkung nicht. Nach der Klausel wäre schon das
		 * Rückkommen gescheitert, und der Beschluss aus dem ersten Durchgang gälte.
		 * Ebenso ersetzt der Satz bei einer Annahme den Rat zur Anfechtung: Was
		 * daraus folgt, steht am Rückkommen (B2-F-4).
		 */
		const satz =
			`Nach der anderen Lesart («${r.wahl}») wäre schon das Rückkommen abgelehnt gewesen, und es ` +
			`gälte der Beschluss aus dem ${r.fruehererDurchgang ?? 1}. Durchgang`;
		return {
			leitung: `${satz}. Was daraus folgt, steht beim Rückkommen (Traktandum ${r.schonRueckkommenAbgelehnt}).`,
			protokoll: `${satz} (siehe Traktandum ${r.schonRueckkommenAbgelehnt}).`
		};
	}
	/*
	 * **L8 unter «Vollmachten ruhen» nennt die Grenzen** (Entscheid 2,
	 * 06.11.2026): Die Stimmen der Verwaltung sind nicht erfasst, und statt
	 * eines Ergebnisses zu behaupten, das niemand kennt, sagt Votum, ob die
	 * andere Wahl am Ergebnis etwas ändern könnte. Gleichen beide Grenzen dem
	 * eigenen Ergebnis, steht «dasselbe Ergebnis»; sonst der Satz zum offenen
	 * Ausgang mit dem Rat zur Anfechtung, je Richtung ein eigener (N-1,
	 * 07.11.2026) und mit dem Schluss zur Frist der Vertretenen (N-5).
	 * **Keine Zeile im Protokoll** (Entscheid 3): Dort steht nur die Tatsache,
	 * dass die Vollmachten geruht haben, und die entsteht in der Zählung
	 * selbst.
	 */
	if (r.ruhendeVollmachten !== undefined) {
		const n = r.ruhendeVollmachten;
		const wer =
			n === 1 ? 'die ruhende Vollmacht der Verwaltung' : `die ${n} ruhenden Vollmachten der Verwaltung`;
		const verb = n === 1 ? 'hätte' : 'hätten';
		if (r.feststellbar) {
			return {
				leitung:
					`Nach der anderen Lesart («${r.wahl}») ${verb} ${wer} gezählt. Das Ergebnis wäre dasselbe, ` +
					'gleich wie die Verwaltung damit gestimmt hätte.',
				protokoll: null
			};
		}
		const frist = ANFECHTUNGSFRIST;
		// Wer nur über die ruhende Vollmacht vertreten war, kann selbst nicht
		// zugestimmt haben; bei mehreren weiss niemand, über welche seine war.
		const ueber = n === 1 ? 'die ruhende Vollmacht' : 'eine der ruhenden Vollmachten';
		const kopf =
			`Nach der anderen Lesart («${r.wahl}») ${verb} ${wer} gezählt. Je nachdem, wie die Verwaltung ` +
			'damit gestimmt hätte, hätte das Ergebnis anders ausfallen können; erfasst ist das nicht, weil ' +
			'Votum diese Stimmen nicht annimmt.';
		// Ohne die Richtung (ein Ergebnis von vor dem Feld, Codeprüfung Lauf 5,
		// B4) kein Rat statt des falschen.
		const rat = r.eigenesErgebnis === undefined
			? ''
			: r.eigenesErgebnis
			? ' Der Beschluss gilt wie gezählt. Wer ihm nicht zugestimmt hat, auch eine Partei, die nur über ' +
				`${ueber} vertreten war, und meint, diese Stimmen hätten zählen müssen, kann ihn beim Gericht ` +
				`anfechten, ${frist}.`
			: ' Die Ablehnung gilt wie gezählt. Wer nicht Nein gestimmt hat, auch eine Partei, die nur über ' +
				`${ueber} vertreten war, und meint, diese Stimmen hätten zählen müssen, kann die Ablehnung beim ` +
				`Gericht anfechten, ${frist}. Das Gericht hebt sie dann in der Regel nur auf; angenommen ist der ` +
				'Antrag damit nicht.';
		const schluss =
			' Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
			'beanstandet haben. Für die Vertretenen, deren Vollmacht ruhte, läuft die Frist womöglich schon ab ' +
			'heute; stellen Sie ihnen das Protokoll rasch zu.';
		return { leitung: kopf + rat + schluss, protokoll: null };
	}
	/*
	 * **L8 unter «Die Sitzungsleitung entscheidet» mit Summen** (N-4,
	 * 07.11.2026): Die Grenzen stehen aus der Dreizahl, weil die Köpfe der
	 * Verwaltung herausfallen; beide gleich dem eigenen Ergebnis heisst
	 * «dasselbe Ergebnis», ohne Zahlen im Protokoll wie unter der Vorgabe.
	 */
	if (r.summenGrenzen !== undefined && r.feststellbar) {
		return {
			leitung:
				`Nach der anderen Lesart («${r.wahl}») dasselbe Ergebnis, gleich wie die Verwaltung mit ` +
				'ihren Vollmachten gestimmt hat.',
			protokoll: null
		};
	}
	/*
	 * **An L13 «Zählweise» statt «Lesart»** (Endfassung Block C, Abschnitt 1,
	 * «Allgemeine Sätze zum zweiten Ergebnis»); an den übrigen Lesarten bleibt
	 * «Lesart».
	 */
	const wort = r.kennung === 'L13' ? 'Zählweise' : 'Lesart';
	/*
	 * **Auch ohne Abweichung eine Zeile im Protokoll** (Laien- und Fachprüfung
	 * 20.10.2026, M4 und Befund 11): Schweigen läse sich als «gleiches
	 * Ergebnis», auch wo es sich nicht prüfen liess (Rz. 129 ad Art. 712n).
	 */
	if (!r.feststellbar) {
		const grund =
			r.nichtFeststellbarWeil === 'stichentscheid'
				? 'bestünde Stimmengleichheit; das Ergebnis danach hinge am Stichentscheid'
				: r.nichtFeststellbarWeil === 'verwaltung_summen'
					? // L8 unter «Die Sitzungsleitung entscheidet» mit Summen (H1, 06.11.2026); die
						// Grenzen (N-4, 07.11.2026) greifen nicht, und an die Leitung kommt der Zusatz.
						'lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht ' +
						'getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat'
					: 'lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, nicht wer wie ' +
						'gestimmt hat, und deshalb fehlen die Wertquoten';
		/*
		 * Der Zusatz nur zu `verwaltung_summen` (N-4, 07.11.2026): Das eigene
		 * Ergebnis steht ja; die anderen Gründe sagen nichts über sein Gelingen.
		 * Seit Lauf 5 (07.11.2026) hängt an ihm der Rat zur Anfechtung, je
		 * Richtung des eigenen Ergebnisses wie unter der Vorgabe (N-1): Auch
		 * Stimmen, die zu Unrecht zählen, machen einen Beschluss anfechtbar
		 * (BGer 5A_972/2020 E. 7.2.4), und die Leitung muss vor der Abstimmung
		 * nach der Beanstandung fragen. Das Protokoll bleibt ohne Zusatz.
		 */
		const frist = ANFECHTUNGSFRIST;
		const rat = (r.nichtFeststellbarWeil === 'verwaltung_summen'
			? ' Der Beschluss gilt wie gezählt.' +
				// Dreiwertig (Codeprüfung Lauf 5, B4): Ein Ergebnis, das vor Lauf 5
				// festgeschrieben wurde, trägt das Feld nicht; ohne die Richtung
				// stünde sonst der Rat zur Ablehnung an einem Beschluss.
				(r.eigenesErgebnis === true
					? ' Wer ihm nicht zugestimmt hat und meint, diese Stimmen hätten ruhen müssen, kann ihn beim ' +
						`Gericht anfechten, ${frist}.` +
						' Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
						'beanstandet haben.'
					: r.eigenesErgebnis === false
						? ' Wer nicht Nein gestimmt hat und meint, diese Stimmen hätten ruhen müssen, kann die Ablehnung ' +
							`beim Gericht anfechten, ${frist}. Das Gericht hebt sie dann in der Regel nur auf; angenommen ist ` +
							'der Antrag damit nicht.' +
							' Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
							'beanstandet haben.'
						: '')
			: '');
		return {
			leitung: `Nach der anderen ${wort} («${r.wahl}»: ${r.verlangt}) ${grund}.${rat}`,
			protokoll: `Nach der anderen ${wort} («${r.wahl}») ${grund}.`
		};
	}
	if (!r.abweichend) {
		return {
			// Mit der Lesart beim Namen (Codeprüfung Block 2, Teil 2, H1): Stehen L4
			// und L1 an einem Traktandum, stünde derselbe Satz sonst zweimal da.
			leitung: `Nach der anderen ${wort} («${r.wahl}») dasselbe Ergebnis.`,
			protokoll: `Nach der anderen ${wort} («${r.wahl}») wäre das Ergebnis dasselbe gewesen.`
		};
	}
	const eigener = r.angenommen ? 'abgelehnt' : 'angenommen';
	const ausgang = r.angenommen ? 'angenommen' : 'abgelehnt';
	const mitZahlen = zahlenZumErgebnis(r, geheim);
	// Fachprüfung Block C, Nachtrag Runde 2, N2-F-2: woher die Zahl aller Eigentümer kommt.
	const zweitesNachZaehlweise = r.anderesNachZaehlweiseAlle ? ` ${ZWEITES_NACH_ZAEHLWEISE_NACHHER}` : '';
	/*
	 * **Je Richtung ein eigener Rat**, mit Frist und Wirkung (Codeprüfung
	 * Teil 3, N5; Fachprüfung 20.10.2026, Befunde 8 und 9; Laienprüfung H1).
	 * Angefochten wird binnen Monatsfrist (ZGB Art. 75; Rz. 230 ad Art. 712m);
	 * ohne Anfechtung gilt der Beschluss (Rz. 76 ad Art. 712q). Eine Ablehnung
	 * hebt das Gericht in der Regel nur auf (Rz. 234 f. ad Art. 712m); wo das
	 * Gesetz einen eigenen Weg kennt, nennt ihn der Katalog (Rz. 235a).
	 */
	const nachAblehnung = lesartVon(r.kennung)?.nachAblehnung;
	const nachAnnahme = lesartVon(r.kennung)?.nachAnnahme;
	const stattNaechsterVersammlung = lesartVon(r.kennung)?.stattNaechsterVersammlung;
	// Bei L6 ersetzt der Rat der Lesart den allgemeinen (Fach- und Laienprüfung 05.11.2026, F1).
	// An L13 bei den notwendigen Arbeiten der ganze Rat mit dem Weg ans Gericht (Block C).
	const ratNachAblehnung =
		(r.nachRueckkommen ? lesartVon(r.kennung)?.ratNachAblehnungNachRueckkommen : undefined) ??
		(r.notwendigeArbeiten ? lesartVon(r.kennung)?.ratNachAblehnungBeiNotwendigenArbeiten : undefined) ??
		lesartVon(r.kennung)?.ratNachAblehnung;
	const frist = ANFECHTUNGSFRIST;
	// Der ganze Rat der Lesart, wo der allgemeine nicht trägt (E1, L11; Fachprüfung F-2, F-7).
	const ratNachAnnahme = lesartVon(r.kennung)?.ratNachAnnahme;
	/*
	 * **Was verkündet wird, vor dem Rat** (L10; Laienprüfung E1 L10, L-1; Auftrag
	 * «Texte nach 0047», Punkt 3b): nur nach einer Ablehnung, die nach der
	 * anderen Wahl angenommen wäre, wie bei L9 über 1a (`ZAEHLBASIS_VERKUENDET`).
	 */
	const verkuendetGrund = r.angenommen ? lesartVon(r.kennung)?.verkuendetNachAblehnung : undefined;
	const verkuendet = verkuendetGrund ? `${ZAEHLBASIS_VERKUENDET} ${verkuendetGrund} ` : '';
	const rat = r.angenommen
		? ratNachAblehnung ??
			`Wer nicht Nein gestimmt hat, kann auch die Ablehnung beim Gericht anfechten, ${frist}. ` +
			'Das Gericht hebt sie dann in der Regel nur auf; angenommen ist der Antrag damit nicht. ' +
			(stattNaechsterVersammlung ?? 'Sie können ihn an einer nächsten Versammlung wieder traktandieren.') +
			(nachAblehnung ? ` ${nachAblehnung}` : '')
		: ratNachAnnahme ??
			`Wer nicht zugestimmt hat, kann den Beschluss beim Gericht anfechten, ${frist}. Folgt das ` +
			// Er wirkt sofort (Rz. 234; Fachprüfung Runde 3, Befund 4; Laien N1).
			`Gericht der anderen ${wort}, hebt es ihn auf. Er gilt ab heute; ohne Anfechtung ist er nach ` +
			'Ablauf dieser Fristen nicht mehr angreifbar.' +
			// Laienprüfung Block 2, M3; Fachprüfung Runde 2, A: je Lesart, bei L4
			// nicht, weil die Gemeinschaft sonst ohne Verwaltung dastünde.
			(nachAnnahme ? ` ${nachAnnahme}` : '');
	return {
		leitung:
			// Das eigene Mehr beim Namen (Laienprüfung Runde 5).
			// A5, Punkt 1a: nicht «die Lesart dieser Versammlung»: Eingestellt hat
			// die Verwaltung im Werkzeug, beschlossen hat niemand (Laien- und
			// Fachprüfung 20.10.2026, H3 und Befund 10).
			`Nach der ${wort}, die für Ihre Gemeinschaft eingestellt ist («${r.eigeneWahl}»), ist der Antrag ${eigener}. Nach der anderen ${wort} ` +
			`(«${r.wahl}»: ${r.verlangt}) wäre er ${ausgang}${mitZahlen}.${zweitesNachZaehlweise} ${verkuendet}${rat}`,
		protokoll:
			`Nach der anderen ${wort} («${r.wahl}»: ${verlangtImProtokoll(r)}), ${AUSLEGUNG_EBENFALLS_VERTRETEN}, wäre der Antrag ${ausgang} gewesen${mitZahlen}.${zweitesNachZaehlweise}` +
			// Nur nach einer Annahme, die nach der anderen Lesart scheiterte (E1, L12).
			(!r.angenommen && lesartVon(r.kennung)?.protokollNachAnnahme ? ` ${lesartVon(r.kennung)!.protokollNachAnnahme}` : '') +
			// Nur nach einer Ablehnung, die nach der anderen Lesart angenommen wäre
			// (Fachprüfung E1 L10, F-4).
			(r.angenommen && lesartVon(r.kennung)?.protokollNachAblehnung ? ` ${lesartVon(r.kennung)!.protokollNachAblehnung}` : '') +
			// An L13 bei den notwendigen Arbeiten der Weg ans Gericht (Block C).
			(r.angenommen && r.notwendigeArbeiten && lesartVon(r.kennung)?.protokollNachAblehnungBeiNotwendigenArbeiten
				? ` ${lesartVon(r.kennung)!.protokollNachAblehnungBeiNotwendigenArbeiten}`
				: '')
	};
}

/**
 * Was «nach der anderen Lesart» im Protokoll heisst, als Einschub hinter der
 * Wahl und dem, was sie verlangt (Laienprüfung E1 L10, L-2 und L-4; Fachprüfung
 * F-1; Auftrag «Texte nach 0047», Punkt 3a): Wer nur das Protokoll liest, kennt
 * die Seite «Lesarten» nicht. «In Frage kommt» behauptet keine Vertreter und
 * trägt deshalb für alle Lesarten, auch an L13; welches Ergebnis gilt, sagen die
 * Sätze danach.
 */
export const AUSLEGUNG_EBENFALLS_VERTRETEN = 'einer Auslegung, die ebenfalls in Frage kommt';

/**
 * Was die andere Wahl verlangt, wie es im Protokollsatz bei Abweichung hinter
 * dem Doppelpunkt steht (Laienprüfung «Texte nach 0047», Runde 3, R3-L-1 und
 * R3-L-2). Nur für diesen Satz; Leitung und Karte behalten `verlangt`:
 *
 *  - **Keine Klammer in der Klammer:** «unabhängig davon, wer erscheint» aus
 *    `erfordernisInWorten` wird «, auch der abwesenden»;
 *  - **L12 und L6 «Klausel anwenden» mit dem Katalog** (`imSatz` der anderen
 *    Wahl), statt der Formel der Einstimmigkeit («alle Stimmen der Anwesenden oder
 *    Vertretenen», «alle Stimmen aller Eigentümer, auch der abwesenden»;
 *    Codeprüfung Lauf 2, N1). L6 «Nach dem Gesetz» behält die Formel des Mehrs, die
 *    die Laienprüfung Runde 3 gutgeheissen hat: Sie erklärt, was «nach dem Gesetz»
 *    heisst (Featureprüfung, M2).
 */
function verlangtImProtokoll(r: ErgebnisNachAndererLesart): string {
	const wahl = lesartVon(r.kennung)?.wahlen.find((w) => w.bezeichnung === r.wahl);
	if (wahl && (r.kennung === 'L12' || (r.kennung === 'L6' && wahl.wert === 'klausel'))) return wahl.imSatz;
	return r.verlangt
		.replace(' (unabhängig davon, wer erscheint)', ', auch der abwesenden,')
		.replace(/ — unabhängig davon, wer erscheint$/, ', auch der abwesenden');
}

// Fristbeginn nach Art. 75 und Rz. 230 ad Art. 712m (Fachprüfung Runde 2, A, B);
// Vertretene ab der Versammlung (Rz. 230, 230a; Fachprüfung Runde 3, Befund 1).
export const ANFECHTUNGSFRIST =
	'innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da ' +
	'noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75)';

/** Die Zahlen zum zweiten Ergebnis mit Doppelpunkt, bei geheimer Abstimmung keine. */
function zahlenZumErgebnis(r: ErgebnisNachAndererLesart, geheim: boolean): string {
	// Geheim: der Ausgang allein, ohne Zahlen (wie `geheimeWertung`).
	if (geheim) return '';
	const zahlen = [
		r.koepfe ? `${r.koepfe.ja} Ja von ${r.koepfe.basis} Kopfstimmen, nötig ${r.koepfe.schwelle ?? 0}` : null,
		r.quoten ? `${r.quoten.ja} Ja von ${r.quoten.basis} Wertquoten, nötig ${r.quoten.schwelle ?? 0}` : null
	]
		.filter((t): t is string => t !== null)
		.join('; ');
	return zahlen ? `: ${zahlen}` : '';
}

/**
 * Was Leitung und Protokoll zur anderen Zählbasis an der Ermächtigung zur
 * Ausschlussklage sagen (1a, Lesarten Block 6).
 *
 * **Keine Lesart, und so heisst es auch nicht**: Votum zählt fest nach dem
 * Wortlaut von Art. 649b Abs. 2. Die Gegenseite lässt die Mehrheit der
 * Anwesenden und Vertretenen genügen (Wermelinger, Rz. 214 ad Art. 712a, Rz.
 * 166b ad Art. 712m); geklärt ist die Frage nicht (Fachprüfung Block 6, F6-1:
 * nicht «wie es Art. 649b verlangt»). Der Weg, auf dem eine zu milde
 * Ermächtigung die Klage scheitern lässt, ist ihre Anfechtung (Rz. 215a und
 * 219a ad Art. 712a; F6-3). Dass eine angefochtene Ermächtigung die Klage
 * scheitern lässt, ist unsere Folgerung; BGer 5A_735/2019 E. 3.3.1 nennt den
 * Wortlaut nur nebenbei (F6-8).
 *
 * **Im Protokoll nur, wenn es abweicht oder sich nicht bestimmen liess**
 * (Entscheid 0023), dann mit dem, was verkündet wurde (Laienprüfung L6-6).
 */
function zaehlbasisInWorten(
	r: ErgebnisNachAndererLesart,
	geheim: boolean
): { leitung: string; protokoll: string | null } {
	const anwesende = r.wahl === ZAEHLBASIS_ANWESENDE;
	if (!r.feststellbar) {
		// Die Köpfe lassen sich aus Summen immer bilden; offen bleibt nur der Stichentscheid.
		const satz = `Gezählt ${r.wahl}, bestünde Stimmengleichheit; das Ergebnis danach hinge am Stichentscheid.`;
		return { leitung: satz, protokoll: satz };
	}
	if (!r.abweichend) {
		return {
			leitung: anwesende
				? `Gezählt ${r.wahl}, wäre das Ergebnis dasselbe.`
				: `Gezählt ${r.wahl}, wäre das Ergebnis dasselbe.` +
					// Fachprüfung F6-4, Laienprüfung L6-5: gesichert nur gegen den Streit um die Zahl.
					(r.angenommen
						? ' Damit ist die Ermächtigung gegen den Einwand gesichert, an der falschen Zahl gemessen ' +
							'worden zu sein. Aus anderen Gründen kann sie trotzdem angefochten werden. Wer zur Klage ' +
							'ermächtigt ist, klagt deshalb am sichersten erst einige Wochen nach Ablauf der ' +
							'Anfechtungsfrist, für Abwesende ohne Vertretung in der Regel ab Erhalt des Protokolls, ' +
							'wenn die Bewirtschaftung bestätigt, dass keine Anfechtung eingegangen ist.'
						: ''),
			protokoll: null
		};
	}
	const zahlen = zahlenZumErgebnis(r, geheim);
	if (anwesende) {
		// Votum zählt streng, also kann es nur von «abgelehnt» zu «angenommen» kippen.
		return {
			leitung:
				`Gezählt ${r.eigeneWahl}, ist der Antrag abgelehnt. Gezählt nur ${r.wahl}, wie es ein Teil ` +
				`der Fachliteratur genügen lässt, wäre er angenommen${zahlen}. ` +
				// Unter L9 verkündet nicht Votum, sondern es gilt die Einstellung der
				// Gemeinschaft (E1, Block C).
				`${r.ausLesart ? ZAEHLBASIS_VERKUENDET : 'Votum verkündet die Ablehnung:'} ` +
				'Eine Ermächtigung, die nur die Mehrheit der Anwesenden erreicht, kann angefochten werden, und ' +
				'wird sie aufgehoben, scheitert die Ausschlussklage. ' +
				// Unter L9 der zweite Grund (Laienprüfung E1 L9, L-4).
				(r.ausLesart ? `${ZAEHLBASIS_OFFEN_NACH_ABLEHNUNG} ` : '') +
				'Wer nicht Nein gestimmt hat, kann auch ' +
				`die Ablehnung beim Gericht anfechten, ${ANFECHTUNGSFRIST}. Das Gericht hebt sie dann in der ` +
				'Regel nur auf; ermächtigt ist damit niemand. Sicherer ist, den Antrag an einer weiteren ' +
				'Versammlung erneut zu stellen, auch einer ausserordentlichen, und dafür zu sorgen, dass mehr ' +
				'als die Hälfte aller Eigentümer ausser dem Beklagten zustimmt, auch über Vollmachten.',
			protokoll:
				`Verkündet ist die Ablehnung, gezählt ${r.eigeneWahl}. Gezählt nur ${r.wahl}, wäre der Antrag ` +
				`angenommen gewesen${zahlen}. Eine Anfechtung der Ablehnung allein ermächtigt niemanden zur Klage.`
		};
	}
	// Unter einer Regel der Anwesenden ist ein angenommener Beschluss angreifbar.
	if (r.angenommen === false) {
		return {
			leitung:
				`Gezählt ${r.eigeneWahl}, ist der Antrag angenommen. Gezählt ${r.wahl}, wie es der Wortlaut ` +
				`von ZGB Art. 649b Abs. 2 nahelegt, wäre er abgelehnt${zahlen}. Welche Zahl gilt, ist ` +
				'umstritten. Die Ermächtigung ist damit angreifbar: Wer nicht zugestimmt hat, kann sie beim ' +
				`Gericht anfechten, ${ANFECHTUNGSFRIST}; wird sie aufgehoben, scheitert die Ausschlussklage. ` +
				// Unter L9 die offene Frage und der sichere Weg vor dem Rat zum Zeitpunkt
				// (Fachprüfung E1 L9, F-2; Laienprüfung L-1; Codeprüfung Block C, 3).
				// Warten ist dann nicht mehr der sicherste Weg, sondern der mit Risiko
				// (Laienprüfung Runde 2, R2-L-1); das Protokoll nennt die Frage mit Grund
				// (R2-L-3).
				(r.ausLesart
					? `${ZAEHLBASIS_ANWESENDE_FOLGE} Das Protokoll nennt beide Ergebnisse und die offene Frage, ` +
						'damit die Klagenden das Risiko kennen; stellen Sie es rasch und nachweisbar allen zu, auch ' +
						`dem Beklagten. Wer trotzdem mit der heutigen Ermächtigung klagt, wartet, ${ZAEHLBASIS_FRUEHESTENS}`
					: 'Das Protokoll nennt beide Ergebnisse; stellen Sie es rasch und nachweisbar allen zu, auch dem ' +
						'Beklagten. Wer zur Klage ermächtigt ist, klagt am sichersten erst einige Wochen nach Ablauf ' +
						'der Frist, wenn die Bewirtschaftung bestätigt, dass keine Vorladung und keine Klage zu einer ' +
						'Anfechtung eingegangen ist.'),
			protokoll:
				`Verkündet ist die Annahme, gezählt ${r.eigeneWahl}. Gezählt ${r.wahl}, wäre der Antrag ` +
				`abgelehnt gewesen${zahlen}. Welche Zahl gilt, ist umstritten; die Ermächtigung kann deshalb ` +
				// A5, Punkt 14 (A1 Frage 5): Berechtigte, Stelle und Frist, weil das
				// Protokoll für Abwesende die Frist in Gang setzt (Rz. 230 ad
				// Art. 712m), ergänzt wie der Satz zu Punkt 2.
				'angefochten werden: Wer nicht zugestimmt hat, kann sie beim Gericht anfechten, innert eines ' +
				'Monats, seit er davon weiss; wer anwesend oder vertreten war, ab der Versammlung, wer weder ' +
				'da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. ' +
				'Art. 75).' +
				// Unter L9 lesen die Klagenden das Risiko im Protokoll (Laienprüfung E1 L9, L-2).
				(r.ausLesart ? ` ${ZAEHLBASIS_OFFEN}` : '')
		};
	}
	// Die Anwesenden sind ein Teil aller: Abgelehnt dort, angenommen hier, kommt nicht vor.
	return {
		leitung: `Gezählt ${r.wahl}, wäre der Antrag angenommen${zahlen}.`,
		protokoll: `Gezählt ${r.wahl}, wäre der Antrag angenommen gewesen${zahlen}.`
	};
}

/**
 * Was Leitung und Protokoll zu B3 sagen (F4c). **Keine Lesart der
 * Gemeinschaft**: Votum rechnet ohne die Parteien, deren einziger Vertreter im
 * Ausstand ist. Das Bundesgericht hat nur entschieden, dass dessen Stimme
 * ungültig ist (BGE 134 III 481 E. 3.8, 3.9), nicht, ob die Partei in der Zahl
 * bleibt. Nach Rz. 181 ad Art. 712m fliessen ungültige Stimmen in die
 * Berechnung ein; die Stelle nennt sich selbst «nicht unumstritten».
 *
 * **Im Protokoll nur bei Abweichung**, wie 1a (Entscheid 0023). Andere
 * Ausgänge als «dasselbe» und «abgelehnt» kommen nicht an
 * (`mitVertretungImAusstand`).
 */
function vertretungImAusstandInWorten(
	r: ErgebnisNachAndererLesart,
	geheim: boolean
): { leitung: string; protokoll: string | null } {
	// «Wie ungültige Stimmen»: Rz. 181 sagt das für ungültige Stimmen, nicht für
	// diese Parteien; die Brücke ist unsere Folgerung (Fachprüfung F4c Block 3, M-1).
	// `lang` endet auf einem Relativsatz; das schliessende Komma steht hier.
	const lang = 'die Parteien, deren einziger Vertreter im Ausstand ist,';
	// Misst eine Seite über alle, steht die Partei dort schon in der Zahl; die
	// Sätze nennen die Seite, die sich ändert, und warum nur sie (N-3, M-4;
	// Laienprüfung Runde 4). Für die Wertquoten der Anwesenden trägt Rz. 181 nur
	// über Rz. 190 und 192a; unsere Folgerung (Fachprüfung Runde 4, G-4).
	const seite = r.nurBei === 'koepfe' ? 'Köpfen' : 'Wertquoten';
	const andere = r.nurBei === 'koepfe' ? 'Wertquoten' : 'Köpfen';
	const bei = r.nurBei ? ` auch bei den ${seite}` : '';
	const schonMit = r.nurBei
		? // «auch die Abwesenden», nicht «alle»: Wer im Ausstand ist, fällt auch aus
			// der Basis über alle (Entscheid 0020), ebenso unter L1 «fällt heraus»
			// (Laien- und Fachprüfung Runde 5, M-5; Rz. 186, 191 ad Art. 712m).
			` Bei den ${andere} zählen diese Parteien schon mit, weil beim Mehr nach ${andere} auch die ` +
			'Abwesenden mitzählen.'
		: '';
	const ohneBei = r.nurBei ? `die ${r.nurBei === 'koepfe' ? 'Köpfe' : 'Wertquoten'} ohne` : 'ohne';
	const mitIhnen = (wer: string) =>
		`Zählen ${wer}${bei} ohne Stimme mit, wie ungültige Stimmen (SVIT-Kommentar Rz. 181 ad Art. 712m), ` +
		'wirken sie wie ein Nein';
	const gilt = 'Der Beschluss gilt, bis ein Gericht ihn aufhebt (Rz. 207 ad Art. 712m).';
	// Mit dem Startpunkt für Anwesende und Vertretene (Fachprüfung F4c Block 3,
	// Runden 2 und 3, M-2 und M-3; Rz. 230, 230a ad Art. 712m). Auch die Partei
	// eines Vertreters im Ausstand war vertreten (Folgerung der Fachprüfung).
	// Frist und Berechtigte auch im Protokoll, wie bei 1a (A5, Punkt 14); den
	// Beginn ab Erhalt des Protokolls für Abwesende nennt nur 1a, hier trägt
	// «seit er davon weiss» (Fachprüfung Runde 2).
	const anfechten =
		'Wer nicht zugestimmt hat, kann ihn innert eines Monats, seit er davon weiss, beim Gericht ' +
		'anfechten (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Wer an der Versammlung war oder sich vertreten ' +
		'liess, rechnet ab dem Versammlungstag (Rz. 230 f. ad Art. 712m)';
	const bger =
		'Welche Zählung gilt, hat das Bundesgericht nicht entschieden; es hat nur die Stimme des Vertreters ' +
		'für ungültig erklärt (BGE 134 III 481 E. 3.8 und 3.9).';
	// Nicht feststellbar und «wäre angenommen» kommen nicht an (N-2).
	if (keinAusgangVonB3(r)) return { leitung: '', protokoll: null };
	if (!r.abweichend) {
		// Bei einer Seite erst, wen Votum wo zählt; sonst wird der Satz zu lang.
		const leitung = r.nurBei
			? `Votum zählt ${ohneBei} ${lang.slice(0, -1)}.${schonMit} ${mitIhnen('diese Parteien')}.`
			: `${mitIhnen(lang)}.`;
		return { leitung: `${leitung} Das Ergebnis wäre dasselbe.`, protokoll: null };
	}
	// Die Zahlen in einem eigenen Satz, sonst wird er mit beiden Spiegeln zu lang.
	const zahlen = zahlenZumErgebnis(r, geheim);
	const soGezaehlt = zahlen ? ` So gezählt${zahlen}.` : '';
	return {
		leitung:
			`Votum zählt ${ohneBei} ${lang} und verkündet die Annahme.${schonMit} ` +
			// Die Handlung vorn (Laienprüfung Runde 2); Einwände ins Protokoll (Fach G-3).
			'Im Saal ist dazu nichts zu entscheiden; Einwände nimmt das Protokoll auf, und es nennt beide ' +
			'Ergebnisse. ' +
			`${mitIhnen('diese Parteien')}, und der Antrag wäre abgelehnt.${soGezaehlt} ` +
			'Das Bundesgericht hat nur entschieden, dass die Stimme des Vertreters ungültig ist, nicht, ob ' +
			'die Partei in der Zahl bleibt (BGE 134 III 481 E. 3.8 und 3.9). ' +
			`${gilt} ${anfechten}. Wie ein Gericht entscheiden würde, ist offen.`,
		// Bei einer Seite «Verkündet ist die Annahme.» für sich: «die Annahme, die
		// Wertquoten gezählt …» las sich als Relativsatz (Laienprüfung Runde 4).
		protokoll:
			(r.nurBei
				? `Verkündet ist die Annahme. Die ${r.nurBei === 'koepfe' ? 'Köpfe' : 'Wertquoten'} sind dabei ` +
					'ohne die Parteien gezählt, deren einziger Vertreter im Ausstand ist.' +
					`${schonMit} ${mitIhnen('diese Parteien')}. Der Antrag wäre dann `
				: `Verkündet ist die Annahme, gezählt ohne ${lang.slice(0, -1)}. ` +
					`${mitIhnen('diese Parteien')}, und der Antrag wäre `) +
			`abgelehnt gewesen.${soGezaehlt} ${bger} ${gilt} ${anfechten}.`
	};
}

const VERKUENDET_BLEIBT =
	'Verkündet bleibt das Ergebnis nach dem hier gewählten Mehr; zählen Sie nicht neu aus.';
const GUELTIGES_MEHR =
	'Als gültiges Mehr leitet Votum das aus Gesetz und Reglement her; weicht Ihre Wahl davon ab, ' +
	'entscheidet im Streit das Gericht, welches gilt.';

/**
 * Was die Leitung zum Mehr aus Gesetz und Reglement hört (Anhang A, Migration
 * 173), wo sie davon abgewichen ist. **Nur die Leitung**, ohne Satz fürs
 * Protokoll (Entscheid 0023).
 *
 * Gültig ist das Mehr aus Gesetz und Reglement, ein strengeres ebenso wenig
 * wie ein milderes (Rz. 41, 99 und 100 ad Art. 712n; Fachprüfung Block 6, F3).
 * Eine Aufhebung wirkt zurück (Rz. 234 ad Art. 712m), deshalb der Rat, einen
 * mild angenommenen Beschluss nicht vor Ablauf der Frist auszuführen (F6-2);
 * «in der Regel», weil ein verfehltes zwingendes Mehr auch nichtig machen kann
 * (BGE 143 III 537 E. 4.2).
 */
function mehrNachGesetzInWorten(r: ErgebnisNachAndererLesart, geheim: boolean): string {
	// Fachprüfung Block C, Nachtrag Runde 2, N2-F-1 (`abweichungNachZaehlweise`).
	if (r.nachZaehlweise === 'nur' && r.feststellbar && r.abweichend && !r.angenommen) {
		return (
			`Nach dem hier gewählten Mehr (${r.eigeneWahl}) ist der Antrag angenommen. Nach der Einstellung Ihrer ` +
			`Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») wäre er abgelehnt${zahlenZumErgebnis(r, geheim)}. ` +
			`${VERKUENDET_BLEIBT} Der Beschluss gilt, bis ein Gericht ihn aufhebt. Wer nicht zugestimmt hat, kann ihn ` +
			`beim Gericht anfechten, ${ANFECHTUNGSFRIST}; hebt das Gericht ihn auf, gilt er als nicht gefasst, auch ` +
			`rückwirkend. ${lesartVon('L13')?.nachAnnahme ?? ''}`
		).trim();
	}
	if (r.nachZaehlweise === 'nur' && r.feststellbar && !r.abweichend) {
		return 'Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») wäre das Ergebnis dasselbe.';
	}
	// Fachprüfung Nachtrag Runde 3, N3-F-2: im Zweig `mit` nach den Zahlen der Satz aus N2-F-2.
	const satz = mehrNachGesetzImBestand(r, geheim, r.nachZaehlweise === 'mit' ? `${ZWEITES_NACH_ZAEHLWEISE_NACHHER} ` : '');
	return r.nachZaehlweise ? mitBezeichnungNachZaehlweise(satz) : satz;
}

function mehrNachGesetzImBestand(r: ErgebnisNachAndererLesart, geheim: boolean, nachDenZahlen = ''): string {
	/*
	 * **Verkündet bleibt, was nach dem gewählten Mehr gezählt ist**, denn das Mehr
	 * wird vor der Abstimmung bestimmt (Rz. 99 ad Art. 712n; Laienprüfung R2-1,
	 * R2-2). Welches Mehr gültig ist, entscheidet im Streit das Gericht; Votum
	 * nennt nur, was es herleitet (Fachprüfung G6-1, G6-2: nicht zweimal «gilt»).
	 */
	if (!r.feststellbar) {
		return r.nichtFeststellbarWeil === 'stichentscheid'
			? `Nach dem Mehr aus Gesetz und Reglement (${r.verlangt}) bestünde Stimmengleichheit; das ` +
					'Ergebnis danach hinge am Stichentscheid.'
			: // Laienprüfung L6-4 und R2-3, Fachprüfung F6-6 und G6-5: der Weg im Saal
				// (Rz. 100 f. ad Art. 712n), bei geheimer Abstimmung ohne Frage nach Namen.
				`Nach dem Mehr aus Gesetz und Reglement (${r.verlangt}) lässt sich das Ergebnis aus den ` +
					'gezählten Händen nicht bestimmen, weil dafür bekannt sein muss, wer zugestimmt hat. ' +
					(geheim
						? 'Bei geheimer Abstimmung bleibt das offen. '
						: 'Fragen Sie gleich im Saal nach, wer Ja gestimmt hat, halten Sie es fest und messen ' +
							'Sie daran das Mehr aus Gesetz und Reglement. ') +
					'Ist der Antrag angenommen und dieses Mehr verfehlt oder nicht feststellbar, ist der ' +
					// Laienprüfung R3-1: beide Fristbeginne, wie in den übrigen Sätzen.
					'Beschluss anfechtbar: Führen Sie ihn erst aus, wenn die Anfechtungsfrist ohne Anfechtung ' +
					'abgelaufen ist, ein Monat ab heute, für Abwesende ohne Vertretung in der Regel ab Erhalt ' +
					'des Protokolls, oder stellen Sie den Antrag an einer weiteren Versammlung ' +
					'erneut, mit dem Mehr aus Gesetz und Reglement in der Einladung.';
	}
	if (!r.abweichend) return 'Nach dem Mehr aus Gesetz und Reglement wäre das Ergebnis dasselbe.';
	const zahlen = zahlenZumErgebnis(r, geheim);
	if (r.angenommen) {
		// Laienprüfung L6-1: kein Vorwurf an eine Leitung, die sich an die Einladung hält.
		return (
			`Nach dem hier gewählten Mehr (${r.eigeneWahl}) ist der Antrag abgelehnt. Nach dem Mehr aus ` +
			`Gesetz und Reglement (${r.verlangt}) wäre er angenommen${zahlen}. ` +
			`${nachDenZahlen}${VERKUENDET_BLEIBT} ` +
			`${GUELTIGES_MEHR} Wer nicht Nein gestimmt hat, kann die Ablehnung deshalb beim ` +
			`Gericht anfechten, ${ANFECHTUNGSFRIST}. Das Gericht hebt sie dann in der Regel nur auf; ` +
			'angenommen ist der Antrag damit nicht. Stellen Sie ihn an einer weiteren Versammlung erneut, ' +
			'mit dem Mehr aus Gesetz und Reglement in der Einladung.'
		);
	}
	return (
		`Nach dem hier gewählten Mehr (${r.eigeneWahl}) ist der Antrag angenommen. Nach dem Mehr aus ` +
		`Gesetz und Reglement (${r.verlangt}) wäre er abgelehnt${zahlen}. ` +
		`${nachDenZahlen}${VERKUENDET_BLEIBT} ` +
		`${GUELTIGES_MEHR} Wer nicht zugestimmt hat, kann den Beschluss beim Gericht anfechten, ` +
		`${ANFECHTUNGSFRIST}; hebt das Gericht ihn auf, gilt er als nicht gefasst, auch rückwirkend. ` +
		'Führen Sie ihn deshalb erst aus, wenn diese Fristen ohne Anfechtung abgelaufen sind, oder ' +
		'stellen Sie den Antrag an einer weiteren Versammlung erneut, mit dem Mehr aus Gesetz und ' +
		'Reglement in der Einladung. Ohne Anfechtung bleibt der Beschluss in der Regel bestehen.'
	);
}

/**
 * Ob Protokoll und Auswertung zur Zustimmung der Betroffenen etwas sagen.
 *
 * **Nicht bei einer konsultativen Abstimmung** (Schritt F2; `freigabe.md`,
 * «Offen aus H7, Teil D», (h), aus der Featureprüfung): Dort fehlt das
 * Erfordernis bewusst, und «Ohne die nach ZGB Art. 712g Abs. 4 nötige
 * Zustimmung» behauptete eine Zustimmung, die für nichts nötig war. Gelesen
 * wird an der Ausgabe, nicht beim Festschreiben, damit auch schon
 * festgeschriebene Ergebnisse so erscheinen; `mitKeinemBeschluss` lässt
 * `betroffene` deshalb stehen.
 */
export function zustimmungBetroffenerGefragt(a: Pick<Auszaehlung, 'betroffene' | 'keinBeschluss'> | null | undefined): boolean {
	return !!a?.betroffene.noetig && a.keinBeschluss?.grund !== 'konsultativ';
}

/**
 * Setzt «kein Beschluss» auf eine Auszählung.
 *
 * Die Zahlen bleiben, wie sie gezählt sind: Die Stimmen sind festgehalten und
 * bewirken nichts (Fachprüfung Runde 2 zu 5c). Ein offener Gleichstand ist
 * damit erledigt, es gibt nichts mehr zu entscheiden; sonst bliebe das
 * Ergebnis unverkündet stehen und «kein Beschluss» erschiene nie.
 */
export function mitKeinemBeschluss(a: Auszaehlung, k: KeinBeschluss): Auszaehlung {
	// Ohne Beschluss gibt es nichts, wovon die andere Lesart abweichen könnte
	// (Codeprüfung Teil 3, M2): zweites Ergebnis und sein Protokollsatz fallen weg.
	// Ebenso der Vermerk, der Antrag sei abgelehnt (Codeprüfung A5, H2).
	const ohne = new Set(
		andereLesartenVon(a)
			.map((r) => andereLesartInWorten(r, a.geheim).protokoll)
			.filter((t): t is string => t !== null)
	);
	ohne.add(STICHENTSCHEID_NICHT_ANGEWANDT);
	return {
		...a,
		angenommen: false,
		durchStichentscheid: false,
		stichentscheidOffen: false,
		keinBeschluss: k,
		andereLesart: null,
		// L13 (Block C) und L10: Bis Block C blieb das zweite Ergebnis zu L10 hier
		// stehen, obwohl sein Protokollsatz oben schon wegfiel (Landkarte Block C).
		andereKopfzaehlweise: null,
		andereAngehoerigenlesart: null,
		andereAusstandslesart: null,
		andereZaehlweise: null,
		andereZaehlbasis: null,
		vertretungImAusstand: null,
		andereVerwaltungsvollmacht: null,
		nachGesetzUndReglement: null,
		protokollhinweise: a.protokollhinweise?.filter((h) => !ohne.has(h.satz))
	};
}

// ── Stimmen auflösen ────────────────────────────────────────────────────────

/**
 * Die je Einheit zuletzt abgegebene Stimme.
 *
 * AD-5: Eine Berichtigung erzeugt eine neue Zeile, die alte bleibt stehen. Für
 * das Ergebnis zählt die letzte. Bei gleichem Zeitpunkt gewinnt die spätere
 * Zeile — die Reihenfolge der Liste ist die der Vergabe.
 */
export function letzteStimmen(stimmen: Vote[]): Map<Id, Vote> {
	const je = new Map<Id, Vote>();
	for (const s of stimmen) {
		const bisher = je.get(s.unitId);
		if (!bisher || s.castAt >= bisher.castAt) je.set(s.unitId, s);
	}
	return je;
}

/**
 * Die eine Kopfstimme einer Partei bei der Zählung je Eigentümer.
 *
 * `undefined` heisst: keine bildbare Kopfstimme. Das tritt in zwei Fällen ein —
 * niemand hat gestimmt, oder die Einheiten haben einander widersprochen. Der
 * zweite ist der heiklere: Die Person hat **eine** Kopfstimme, und aus «ja» und
 * «nein» eine Richtung zu wählen entschiede über die Abstimmung. Die Oberfläche
 * bietet das Aufteilen in einer Gemeinschaft je Eigentümer deshalb gar nicht an.
 * An der Einsprache nach L3 «je Eigentümer» in einer Gemeinschaft je Einheit
 * bietet sie es an, weil sie nach der Zählweise der Gemeinschaft entscheidet
 * (Codeprüfung Block 5, N8); dann, wie bei jedem anderen Widerspruch, bleibt die
 * Kopfstimme ungebildet und ein Hinweis weist darauf hin. Die Wertquoten folgen weiter der Einheit und teilen sich sauber auf.
 *
 * Teilweise abgegeben, aber widerspruchsfrei, gilt als abgegeben: Die
 * ungestimmten Einheiten widersprechen nicht, und der geäusserte Wille ist
 * eindeutig.
 */
function kopfwahl(partei: SnapshotParty, je: Map<Id, Vote>): VoteChoice | undefined | 'uneinheitlich' {
	const wahlen = new Set<VoteChoice>();
	for (const u of partei.units) {
		const s = je.get(u.unitId);
		if (s) wahlen.add(s.choice);
	}
	if (wahlen.size === 0) return undefined;
	if (wahlen.size > 1) return 'uneinheitlich';
	return [...wahlen][0];
}

// ── Bezugsgrössen ───────────────────────────────────────────────────────────

/**
 * Ob eine Partei in dieser Zählung überhaupt vorkommt: nicht im Ausstand, und
 * nicht betroffen, wo Betroffene nicht mitstimmen (`betroffeneStimmenNichtMit`;
 * ZGB Art. 649b Abs. 2, «mit Ausnahme des Beklagten»).
 *
 * **Eine Stelle für beide Zählungen** (seit 25.09.2026). Die Handzählung
 * übersprang nur den Ausstand, die Einzelzählung auch die Betroffenen. Bei der
 * Ermächtigung zur Ausschlussklage, die als einfaches Mehr von Hand gezählt
 * werden darf, stand der Beklagte damit in Basis und Schwelle: bei zehn
 * Eigentümern 6 statt 5 nötige Ja (Code-Review 24.09.2026 zu
 * `ausstandswirkung`, Bestandsbefund). Zwei Fassungen derselben Regel waren
 * auseinandergelaufen, ohne dass es jemand entschieden hätte.
 */
function kommtInDerZaehlungVor(
	parteiId: Id,
	e: Erfordernis,
	ausstandsmenge: Set<Id>,
	betroffeneMenge: Set<Id>,
	stumm: ReadonlySet<Id> = new Set(),
	/** Im Ausstand, aber in der Zahl (1e, `ausstandBleibtInDerZahl`). */
	ausstandInDerZahl: ReadonlySet<Id> = new Set()
): boolean {
	// Vor dem Ausstand: Die Karte rät, für Angehörige den Ausstand zu erklären,
	// auch wenn ihnen nur die Wohnung des Beklagten mitgehört. Nähme der
	// Ausstand sie aus der Zahl, rechnete Votum wieder wie vor 2026-10-11.
	if (stumm.has(parteiId)) return true;
	if (ausstandInDerZahl.has(parteiId)) return true;
	if (ausstandsmenge.has(parteiId)) return false;
	return !(betroffeneStimmenNichtMit(e) && betroffeneMenge.has(parteiId));
}

/**
 * Die beklagten Parteien, deren Wohnung mehreren gehört und die deshalb in der
 * Bezugsgrösse bleiben, ohne abzustimmen (`beklagtenwohnungZaehltMit`, seit
 * Fassung 2026-10-11). Sie zählen wie eine abwesende Partei: unter «alle
 * Eigentümer ohne den Beklagten» in der Basis, unter einer Klausel der
 * Anwesenden nicht, wie jeder, dessen Stimme nicht ausgeübt werden kann.
 */
function stummeBeklagtenwohnungen(
	m: Snapshot,
	e: Erfordernis,
	betroffeneMenge: ReadonlySet<Id>,
	alleBeklagt: ReadonlySet<Id>
): Set<Id> {
	if (!beklagtenwohnungZaehltMit(e)) return new Set();
	return new Set(
		m.parties
			.filter(
				(p) => p.isCommunity && betroffeneMenge.has(p.partyId) && !alleBeklagt.has(p.partyId)
			)
			.map((p) => p.partyId)
	);
}

/**
 * Die gemeinsamen Wohnungen, bei denen alle Eigentümer beklagt sind und die
 * deshalb ganz herausfallen, nur wo die Angabe etwas bewirkt: ab Fassung
 * 2026-10-11 und unter einer Bezugsgrösse über alle.
 */
function ganzBeklagteWohnungen(
	m: Snapshot,
	e: Erfordernis,
	betroffeneMenge: ReadonlySet<Id>,
	alleBeklagt: ReadonlySet<Id>
): SnapshotParty[] {
	if (!beklagtenwohnungZaehltMit(e)) return [];
	return m.parties.filter(
		(p) => p.isCommunity && betroffeneMenge.has(p.partyId) && alleBeklagt.has(p.partyId)
	);
}

/**
 * Die gemeinsamen Wohnungen der Beklagten mit ihrer Angabe, in der Reihenfolge
 * der Momentaufnahme. Leer, wo die Angabe nicht wirkt.
 */
function beklagtenwohnungenIn(
	m: Snapshot,
	e: Erfordernis,
	betroffeneMenge: ReadonlySet<Id>,
	alleBeklagt: ReadonlySet<Id>
): { name: string; alleBeklagt: boolean }[] {
	if (!beklagtenwohnungZaehltMit(e)) return [];
	return m.parties
		.filter((p) => p.isCommunity && betroffeneMenge.has(p.partyId))
		.map((p) => ({ name: p.displayName, alleBeklagt: alleBeklagt.has(p.partyId) }));
}

/**
 * Der geprüfte Satz zur gemeinsamen Wohnung des Beklagten, für Ergebnis und
 * Protokoll (Laien- und Fachprüfung 30.09.2026, Stelle 4).
 */
export function beklagtenwohnungSatz(w: { name: string; alleBeklagt: boolean }): string {
	return w.alleBeklagt
		? beklagtenwohnungProtokollInWorten(w.name, true)
		: beklagtenwohnungProtokollInWorten(w.name, false);
}

/**
 * Die Protokollfassung der Wohnung des Beklagten (H5, Fachprüfung 08.10.2026):
 * ohne «laut Angabe der Sitzungsleitung» und ohne Fundstellen. Die Urkunde
 * stellt fest. Die Anzeige behält ihre Fassung
 * (`beklagtenwohnungInWorten`, `ganzBeklagtInWorten`).
 */
function beklagtenwohnungProtokollInWorten(name: string, alleBeklagt: boolean): string {
	return alleBeklagt
		? `Die Wohnung von «${name}» gehört mehreren; der Antrag richtet sich gegen alle ihre ` +
			'Eigentümer. Die Wohnung stimmt hier nicht ab und zählt nicht in der Zahl aller Eigentümer.'
		: `Die Wohnung von «${name}» gehört mehreren; der Antrag richtet sich nur gegen den ` +
			'Beklagten, nicht gegen die übrigen Eigentümer der Wohnung. Die Wohnung stimmt hier nicht ' +
			'ab; in der Zahl aller Eigentümer bleibt sie.';
}

/**
 * Der Eimer `stimmtNicht` in Worten, für Ergebnis, Auswertung und Protokoll
 * (Codeprüfung 30.09.2026, N1). Eine Stelle, damit die drei nicht
 * auseinanderlaufen.
 */
export function stimmtNichtInWorten(anzahl: number): string {
	return anzahl === 1
		? '1 Wohnung des Beklagten, stimmt nicht ab'
		: `${anzahl} Kopfstimmen der Wohnung des Beklagten, stimmen nicht ab`;
}

/**
 * Der Eimer `imAusstand` in Worten (1e, ab Fassung 2026-10-25), für Ergebnis,
 * Auswertung und Protokoll, wie `stimmtNichtInWorten`.
 */
export function imAusstandInWorten(anzahl: number, art: 'koepfe' | 'quoten' = 'koepfe'): string {
	// Bei den Wertquoten ohne «in der Zahl»: Ob sie in der Bezugsgrösse stehen,
	// hängt an der Quotenbasis (Codeprüfung Block 2, Teil 2, M4).
	if (art === 'quoten') return `${anzahl} im Ausstand`;
	return anzahl === 1 ? '1 im Ausstand, zählt in der Zahl mit' : `${anzahl} im Ausstand, zählen in der Zahl mit`;
}

/**
 * Der Satz zur Wohnung, deren Eigentümer laut Angabe alle beklagt sind, für
 * beide Zählungen (Laien- und Fachprüfung 30.09.2026, Stelle 4).
 */
function ganzBeklagtInWorten(name: string): string {
	return (
		`Die Wohnung von «${name}» gehört mehreren, und laut Angabe der Sitzungsleitung richtet ` +
		'sich der Antrag gegen alle ihre Eigentümer. Die Wohnung stimmt hier nicht ab und zählt nicht ' +
		'in der Zahl aller Eigentümer, weil Art. 649b Abs. 2 ZGB die Beklagten ausnimmt.'
	);
}

/**
 * Der Satz zur gemeinsamen Wohnung des Beklagten, für Einzel- und Handzählung.
 * Nennt die Wohnung, nicht die Partei: Deren Name nennt bei gemeinsamem
 * Eigentum oft auch die Mitbeteiligte (Laienprüfung Runde 1, L4-1).
 */
function beklagtenwohnungInWorten(name: string): string {
	return (
		`Die Wohnung von «${name}» gehört mehreren, und laut Angabe der Sitzungsleitung richtet ` +
		'sich der Antrag nur gegen den Beklagten, nicht gegen die übrigen Eigentümer der Wohnung. ' +
		'Die Wohnung stimmt hier nicht ab, weil es um die Person eines ihrer Eigentümer geht ' +
		'(SVIT-Kommentar Rz. 23 ad Art. 712o). In der Zahl aller ' +
		'Eigentümer bleibt sie, weil Art. 649b Abs. 2 ZGB nur den Beklagten ausnimmt.'
	);
}

/**
 * Warum jemand bei einem Traktandum nicht mitstimmt.
 *
 * `ausgenommen` ist **kein** Ausschluss vom Stimmrecht, sondern eine Regel über
 * die Bezugsgrösse (seit 27.09.2026, siehe `vomStimmrechtAusgeschlossen`). Wer
 * so ausgenommen ist, stimmt nicht selbst, vertritt aber andere.
 */
export type Ausschlussgrund = 'ausstand' | 'betroffen' | 'ausgenommen';

// Seit 29.09.2026 in `entscheidbaum.ts`, weil `betroffeneStimmenNichtMit` dort
// steht; hier weitergereicht für die bisherigen Leser.
export { AUSSCHLUSSKLAGE_KNOTEN };

/**
 * Der Hinweis an die Sitzungsleitung, wer bei der Ausschlussklage ausser dem
 * Beklagten nicht mitstimmt, oder `null` an jedem anderen Knoten.
 *
 * **Der Anlass** (Produktentscheid 27.09.2026, `quellen/themen/
 * stockwerkeigentum/fragen.md`, «Offen»): Ehegatte und Verwandte in gerader
 * Linie des Beklagten, die selbst Eigentümer sind, stimmen bei der
 * Ermächtigung nicht mit, auch nicht als Vertreter. Der Wortlaut von Art. 68
 * erfasst sie; für Art. 649b gilt Art. 68 analog (BGer 5A_198/2014 E. 5.4),
 * und nach BGE 134 III 481 E. 3.8 und 3.9 zählen auch ihre Stimmen als
 * Vertreter nicht.
 *
 * **Warum ein Hinweis und keine Rechnung.** Votum kennt keine Verwandtschaft.
 * Das Werkzeug dafür gibt es schon: Der Ausstand nimmt die Stimme, nimmt aus
 * der Bezugsgrösse und lässt die Vollmachten ruhen, in Einzel- und
 * Handzählung aus derselben Stelle (`vomStimmrechtAusgeschlossen`). Es fehlte
 * nur, dass die Leitung vor der Abstimmung daran denkt, und ein Grund, der im
 * Verlauf und im Protokoll steht. Eine eigene Angabe «verwandt mit» hätte
 * dieselbe Wirkung ein zweites Mal gebaut.
 */
export function angehoerigenhinweis(
	e:
		| (Pick<Erfordernis, 'knotenId' | 'kopfbasis'> &
				Partial<
					Pick<
						Erfordernis,
						'fassung' | 'begruendung' | 'gesetzlich' | 'gemeinschaftslesart' | 'angehoerigenlesart' | 'quelle'
					>
				>)
		| null
): string | null {
	if (e?.knotenId !== AUSSCHLUSSKLAGE_KNOTEN) return null;
	/*
	 * **Die gemeinsame Wohnung des Beklagten** (Kartenbefund 3, Codeprüfung
	 * 30.09.2026, M4; Laien- und Fachprüfung 30.09.2026, acht Runden). Ab
	 * Fassung 2026-10-11 zählt Votum sie unter einer Zahl über alle selbst mit,
	 * ausser der Antrag richtet sich gegen alle ihre Eigentümer (Migration 132);
	 * «misst ohne diese Angehörigen» stimmte dann für Mitbeteiligte an dieser
	 * Wohnung nicht mehr. Unter einer älteren Fassung zählt die Leitung sie
	 * hinzu, unter einer Klausel der Anwesenden ebenso für die sichere Zahl.
	 */
	const zaehltSelbst =
		e.fassung !== undefined && beklagtenwohnungZaehltMit({ ...e, fassung: e.fassung });
	/*
	 * **Ab Fassung 2026-10-25 bleiben die Angehörigen in der Zahl** (1e,
	 * `ausstandBleibtInDerZahl`). Der Rat, sie nach der Abstimmung von Hand
	 * hinzuzuzählen, entfällt dann unter einer Zahl über alle: Votum zählt sie
	 * selbst. Unter einer Klausel der Anwesenden bleibt er.
	 */
	const angehoerigeInDerZahl =
		e.fassung !== undefined && ausstandBleibtInDerZahl({ ...e, fassung: e.fassung });
	/*
	 * **Unter «fallen_heraus» misst Votum ohne sie und rechnet die andere Zahl
	 * selbst** (E1, Block D; W13). Der Rat, von Hand zu zählen, entfällt dann:
	 * Er hiesse, die Zahl nachzurechnen, die Votum nach der Auszählung ohnehin
	 * nennt.
	 */
	const angehoerigeFallenHeraus =
		e.fassung !== undefined &&
		angehoerigenlesartWirkt({ ...e, fassung: e.fassung }) &&
		angehoerigenlesartVon({ angehoerigenlesart: e.angehoerigenlesart }) === 'fallen_heraus';
	/*
	 * **Unter einer Klausel der Anwesenden ist «sicher» eine andere Zahl**
	 * (Codeprüfung 29.09.2026, N-1; Laien- und Fachprüfung 29.09.2026, F9 und
	 * G6). Votum misst dann an den Anwesenden und Vertretenen, ob die Basis
	 * aus einer hinterlegten Regel stammt oder von der Leitung gewählt ist
	 * (`uebersteuere`); der Satz nennt deshalb keine Bestimmung. Sicher ist die
	 * Ermächtigung aber erst mit der Mehrheit aller Eigentümer ohne den
	 * Beklagten, und aus dieser Zahl nimmt Art. 649b Abs. 2 nur ihn. Eine
	 * Prüfung an den Anwesenden, auch mit den Angehörigen, trüge «sicher»
	 * nicht. Die Mehrheit über alle deckt beide Zahlen, weil die Anwesenden
	 * ein Teil davon sind. «Sicher» nur für einen angenommenen Beschluss: Hat
	 * die Leitung ein strengeres Mehr der Anwesenden gewählt, kann Votum ablehnen,
	 * was die Mehrheit über alle erreicht (Codeprüfung Runde 2, N-d). Unter
	 * «alle Eigentümer» bleibt es beim Satz des Gesetzes: Eine Regel liest Votum
	 * an diesem Knoten als alle ohne den Beklagten. Eine Übersteuerung auf «alle
	 * Eigentümer» zählt dieselbe Zahl, denn der Beklagte fällt unter jeder Basis
	 * heraus (`betroffeneStimmenNichtMit`; Review DeepSeek zu Block 6, Befund 3). Der
	 * Schluss nennt den Fristbeginn und wer wann klagt, weil der Hinweis im
	 * Saal für sich steht und der Protokolleintrag hier entsteht (Laien- und
	 * Fachprüfung Runde 2, H10 und K6).
	 */
	/*
	 * **Die Zahl über alle nennt Votum selbst** (Lesarten Block 6, 1a in beide
	 * Richtungen; Produktentscheid 21.10.2026): ab der Fassung 2026-10-25 unter
	 * einer Regel der Anwesenden (`andereZaehlbasisVon`), bei einer Wahl der
	 * Leitung über das Mehr aus Gesetz und Reglement, wenn dieses an allen
	 * ausser dem Beklagten zählt. Der Rat, von Hand zu zählen, entfällt dann;
	 * Frist, Zustellung und Klagezeitpunkt bleiben.
	 */
	const votumNenntAlle =
		e.kopfbasis === 'anwesend_vertreten' &&
		e.fassung !== undefined &&
		(e.begruendung
			? e.gesetzlich?.kopfbasis === 'alle_ausser_betroffene' &&
				// Wie in `andereZaehlbasisVon`: erst ab 1e (Codeprüfung Block 6, N2).
				ausstandBleibtInDerZahl({
					...e,
					fassung: e.fassung,
					kopfbasis: 'alle_ausser_betroffene',
					angehoerigenlesart: undefined
				})
			: andereZaehlbasisVon({ ...e, fassung: e.fassung }) !== null);
	const schluss = angehoerigeFallenHeraus
		? ANGEHOERIGE_FALLEN_HERAUS
		: angehoerigeInDerZahl
		? ''
		: votumNenntAlle
			? 'Hier misst sie an den Anwesenden und Vertretenen. Sicher ist die Ermächtigung aber erst mit ' +
				'der Mehrheit aller Eigentümer ohne den Beklagten, und aus dieser Zahl nimmt Art. 649b Abs. 2 ' +
				'nur ihn. Nach der Auszählung nennt Ihnen die Anwendung auch das Ergebnis an dieser Zahl. ' +
				// Laienprüfung L6-9: die Folge ausschreiben.
				'Dort bleiben die Angehörigen im Ausstand in der Zahl und wirken wie ein Nein; es braucht also ' +
				'mehr Ja-Stimmen, auch über Vollmachten. Ist die Mehrheit dort nicht erreicht, ist ' +
				// Fachprüfung H6-1: die Einschränkung gehört zum Ende des Risikos.
				'ein angenommener Beschluss angreifbar, in der Regel bis die Anfechtungsfrist von einem Monat ungenutzt ' +
				'abgelaufen ist, für Abwesende ohne Vertretung in der Regel ab Zustellung des Protokolls. ' +
				// Unter L9 dieselbe offene Frage wie nach der Auszählung (Codeprüfung E1
				// Block C, Befund 4), ohne den Grundsatz, der eben dasteht, und mit dem
				// sicheren Weg; Warten ist dann nicht mehr «am sichersten»
				// (Laienprüfung Runde 2, R2-L-2).
				(e.gemeinschaftslesart?.kennung === 'L9'
					? `${ZAEHLBASIS_RISIKO} ${ZAEHLBASIS_WEG} Stellen Sie das Protokoll rasch und nachweisbar ` +
						'allen zu, auch dem Beklagten. Wer mit einer Ermächtigung nur der Anwesenden trotzdem ' +
						`klagt, wartet, ${ZAEHLBASIS_FRUEHESTENS} Ein Schlichtungsgesuch am letzten Tag genügt, ` +
						'die Vorladung kommt erst danach.'
					: 'Stellen Sie das Protokoll rasch und nachweisbar allen zu, auch dem Beklagten. Wer zur Klage ' +
						'ermächtigt ist, klagt am sichersten erst einige Wochen nach Ablauf der Frist, wenn ' +
						'die Bewirtschaftung bestätigt, dass keine Vorladung und keine Klage zu einer Anfechtung ' +
						'eingegangen ist: Ein Schlichtungsgesuch am letzten Tag genügt, die Vorladung kommt erst danach.')
		: e.kopfbasis === 'anwesend_vertreten'
			? 'Hier misst sie an den Anwesenden und Vertretenen. Sicher ist die ' +
				'Ermächtigung aber erst mit der Mehrheit aller Eigentümer ohne den Beklagten, und aus ' +
				'dieser Zahl nimmt Art. 649b Abs. 2 nur ihn: Zählen Sie nach der Abstimmung alle ' +
				'Eigentümer ausser dem Beklagten, die Angehörigen mit eigener Wohnung eingeschlossen, ' +
				'auch wer nicht erschienen ist; gehört die Wohnung des Beklagten mehreren und richtet sich ' +
				'der Antrag nur gegen ihn, zählt sie dabei als eine Wohnung mit. Hat die Anwendung den ' +
				'Beschluss angenommen und sind die ' +
				'Ja-Stimmen mehr als die Hälfte dieser Zahl, ist die Ermächtigung sicher. Sonst ist ein ' +
				'angenommener Beschluss angreifbar, bis die Anfechtungsfrist von einem ' +
				'Monat ungenutzt abgelaufen ist, für Abwesende ohne Vertretung in der Regel ab ' +
				'Zustellung des Protokolls. Halten Sie im Protokoll fest, wie viele Ja-Stimmen es waren, ' +
				'wie viele Eigentümer ohne den Beklagten es sind und ob die Ermächtigung damit sicher oder ' +
				'angreifbar ist, und stellen Sie es rasch und nachweisbar allen zu, auch dem Beklagten. ' +
				'Die ermächtigten Eigentümer klagen am sichersten erst einige Wochen nach Ablauf der ' +
				'Frist, wenn die Bewirtschaftung bestätigt, dass keine Vorladung und keine Klage zu einer ' +
				'Anfechtung eingegangen ist: Ein Schlichtungsgesuch am letzten Tag genügt, die Vorladung ' +
				'kommt erst danach.'
			: zaehltSelbst
				? 'Art. 649b Abs. 2 nimmt nur die Beklagten aus der Zahl: Zählen Sie die Angehörigen mit ' +
					'eigener Wohnung nach der Abstimmung zur Zahl der Eigentümer hinzu, nicht zu den ' +
					'Ja-Stimmen. Reichen die Ja-Stimmen auch gegen diese grössere Zahl, ist die ' +
					// A5, Punkt 14 (A1 Frage 5): Berechtigte, Stelle und Frist am Satz, der
					// sagt, was ins Protokoll gehört; das Protokoll setzt für
					// Abwesende die Frist in Gang (Rz. 230 ad Art. 712m).
					'Ermächtigung in diesem Punkt sicher; sonst ist sie angreifbar, und das gehört ins Protokoll: Wer nicht ' +
					`zugestimmt hat, kann sie beim Gericht anfechten, ${ANFECHTUNGSFRIST}.`
				: 'Art. 649b Abs. 2 nimmt aber nur den Beklagten aus der Zahl: Zählen Sie die Angehörigen ' +
					'mit eigener Wohnung nach der Abstimmung zur Zahl der Eigentümer hinzu, nicht zu den ' +
					'Ja-Stimmen, und ebenso die Wohnung des Beklagten, wenn sie mehreren gehört und sich der ' +
					'Antrag nur gegen ihn richtet. Reichen die Ja-Stimmen auch gegen diese grössere Zahl, ist ' +
					// A5, Punkt 14 (A1 Frage 5): derselbe Zusatz wie im Zweig darüber.
					'die Ermächtigung in diesem Punkt sicher; sonst ist sie angreifbar, und das gehört ins Protokoll: Wer nicht ' +
					`zugestimmt hat, kann sie beim Gericht anfechten, ${ANFECHTUNGSFRIST}.`;
	/*
	 * Was die Anwendung misst. Unter der Zahl über alle ab 2026-10-11 samt der
	 * Angabe beim Beklagten und dem, was bei mehreren Beklagten folgt
	 * (Fachprüfung Runde 2, B9; Runde 3, Befund 4).
	 */
	// Laienprüfung Block 2, M6: kurze Sätze, Bezüge ausgeschrieben.
	const beklagtenwohnung =
		'Gehört die Wohnung des Beklagten mehreren, zählt die Anwendung sie mit, wenn sich der Antrag ' +
		'nur gegen ihn richtet. Richtet er sich gegen alle ihre Eigentümer, halten Sie das unter ' +
		'«Betroffene» beim Beklagten fest. Fragen Sie dann nach den Angehörigen jedes Beklagten und ' +
		'erklären Sie auch für sie den Ausstand. Hat einer der Beklagten daneben eine eigene Wohnung, ' +
		'tragen Sie ihn auch für diese als beklagt ein.';
	const messsatz = angehoerigeInDerZahl
		? 'Die Anwendung lässt diese Angehörigen in der Zahl aller Eigentümer, denn Art. 649b Abs. 2 ' +
			'nimmt nur den Beklagten aus. Sie wirken dort wie ein Nein, ebenso wer ihnen eine Vollmacht ' +
			`gegeben hat. ${beklagtenwohnung}`
		: zaehltSelbst
			? `${angehoerigeFallenHeraus ? ANGEHOERIGE_FALLEN_HERAUS_MESSUNG : 'Die Anwendung misst die Mehrheit ohne die Angehörigen mit eigener Wohnung.'} Eine Wohnung, ` +
				'die dem Beklagten mit anderen gehört, zählt sie selbst mit, ausser Sie haben unter ' +
				'«Betroffene» beim Beklagten festgehalten, dass sich der Antrag gegen alle ihre Eigentümer ' +
				'richtet. Dann fragen Sie nach den Angehörigen jedes Beklagten und erklären auch für sie ' +
				'den Ausstand; hat einer der Beklagten daneben eine eigene Wohnung, tragen Sie ihn dafür ' +
				'ebenfalls als beklagt ein. '
			: 'Die Anwendung misst die Mehrheit ohne diese Angehörigen. ';
	/*
	 * **Fragen und protokollieren**, weil ein Ausschlussgrund umgehend geltend
	 * zu machen ist (Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 145), und
	 * der Satz zur Bezugsgrösse: bis zur Fassung 2026-10-24, weil Votum milder
	 * zählte als der Wortlaut von Art. 649b Abs. 2 (Fachprüfung 27.09.2026,
	 * A2-1, A1-1); ab 2026-10-25, weil die Angehörigen in der Zahl bleiben (1e).
	 */
	return (
		'Ehegatte und Verwandte des Beklagten in gerader Linie (etwa Eltern, Kinder, Grosseltern, ' +
		'Enkel), die selbst Eigentümer sind, stimmen hier ebenfalls nicht mit, weder für eine ' +
		'eigene Wohnung noch als Vertretung, auch wenn ihnen nur die Wohnung des Beklagten ' +
		'mitgehört (ZGB Art. 68 sinngemäss; BGE 134 III 481 E. 3.8). Geschwister, Schwiegereltern ' +
		'und Lebenspartner ohne Ehe stimmen normal mit. Die Anwendung kennt keine Verwandtschaft: ' +
		'Fragen Sie vor der Abstimmung danach, halten Sie die Antwort im Protokoll fest und ' +
		'erklären Sie für diese Angehörigen hier den Ausstand. Auch die Vollmachten, die sie ' +
		'halten, ruhen dann. ' +
		messsatz +
		schluss
	);
}

/**
 * Der Satz vor der Abstimmung zu L10 (W11), oder `null`, wo L10 nicht wirkt.
 *
 * **Nur zeigen, wo `ausstandMitAngehoerigenergebnis` nicht leer ist.** Sonst
 * nennt die Auszählung kein zweites Ergebnis (`mitAndererAngehoerigenlesart`),
 * und der Satz verspräche eines. Unter «fallen_heraus» kommt die Folge der
 * milden Wahl dazu (W8): Wer die Ermächtigung nur ohne die Angehörigen
 * erreicht, trägt das Risiko, dass
 * das Gericht im Ausschlussprozess nachprüft.
 */
export function angehoerigenlesartHinweis(
	e:
		| (Pick<Erfordernis, 'knotenId' | 'kopfbasis'> &
				Partial<Pick<Erfordernis, 'fassung' | 'quelle' | 'angehoerigenlesart'>>)
		| null
): string | null {
	if (!e || e.fassung === undefined || !angehoerigenlesartWirkt({ ...e, fassung: e.fassung })) return null;
	const saetze = [ANGEHOERIGENLESART_HINWEIS];
	if (angehoerigenlesartVon({ angehoerigenlesart: e.angehoerigenlesart }) === 'fallen_heraus') {
		const folge = lesartVon('L10')?.folgeMilderWahl;
		if (folge) saetze.push(folge);
	}
	return saetze.join(' ');
}

/**
 * Ob die Vollmachten eines Betroffenen an diesem Erfordernis nicht zählen: an der
 * Ausschlussklage und der Einsprache, wo das Gesetz ihn vom Stimmrecht
 * ausschliesst. Unter einer blossen Klausel «ausser Betroffene» zählen sie
 * weiter (`ausgenommen`, 27.09.2026). Eine Stelle für Zählung und Auszählmappe
 * (Codeprüfung Block 5, Runde 3, M1).
 */
export function vollmachtenBetroffenerZaehlenNicht(e: Pick<Erfordernis, 'kopfbasis' | 'knotenId'>): boolean {
	return (
		betroffeneStimmenNichtMit(e) &&
		(e.knotenId === AUSSCHLUSSKLAGE_KNOTEN || e.knotenId === EINSPRACHE_KNOTEN)
	);
}

/**
 * Wer bei diesem Traktandum nicht mitstimmt, und warum.
 *
 * Drei Gründe. Alle drei nehmen die eigene Stimme, nur die ersten zwei auch
 * die Vollmachten (`ruhendeVertretungenBei`):
 *
 *   * **Der Ausstand** (ZGB Art. 68 i.V.m. Art. 712m Abs. 2), von der
 *     Sitzungsleitung erklärt.
 *   * **Der Beklagte** bei der Ermächtigung zur Ausschlussklage (`betroffen`,
 *     ZGB Art. 649b Abs. 2). Das ist nicht bloss eine Regel über die
 *     Bezugsgrösse: BGE 134 III 481 E. 3.4 nennt die Bestimmung selbst eine
 *     «Vorschrift betreffend Stimmrechtsausschluss», und nach BGer 5A_198/2014
 *     E. 5.4 gilt Art. 68 bei der Ermächtigung analog. Bis zum 25.09.2026 fiel
 *     der Beklagte zwar aus der Zählung, seine Vollmachten blieben aber
 *     wirksam: Er stimmte für andere über die Klage gegen sich selbst ab
 *     (Fachprüfung 25.09.2026, `quellen/pruefung/berichte/`).
 *   * **Die Betroffenen, die eine Reglementsklausel aus der Kopfbasis nimmt**
 *     (`ausgenommen`). Ein Reglement kann `alle_ausser_betroffene` für andere
 *     Geschäfte setzen (`wendeReglementAn`). Ob das ein Stimmrechtsausschluss
 *     ist oder nur eine Regel über die Bezugsgrösse, entscheidet das Recht
 *     nicht; es hängt an der Auslegung der Klausel, und ein Reglement weicht
 *     nur ab, wenn es das hinreichend klar sagt (BGE 144 III 510 E. 2.2.4).
 *     Von `6b820d5` bis zum 27.09.2026 ruhten auch hier die Vollmachten, als
 *     Folgerung, nicht als Beleg. **Produktentscheid 27.09.2026:** «B auch
 *     nicht aufnehmen», auf Rückfrage: das Ruhen hier aufheben
 *     (`quellen/themen/stockwerkeigentum/fragen.md`, «Offen»). Gestrichene
 *     gültige Stimmen machen einen Beschluss ebenso anfechtbar wie gezählte
 *     ungültige; das Ruhen war also nicht die sichere Richtung.
 *
 * **Woran der Beklagte zu erkennen ist: am Knoten, nicht an der Quelle.** Die
 * Kopfbasis allein sagt es nicht, beide Fälle tragen `alle_ausser_betroffene`.
 * Der Knoten `k-ausschlussklage` ist von Fassung 2026-08-15 bis 2026-10-06
 * für Reglementsregeln gesperrt; seit 2026-10-07 ordnet er sie ein, und
 * `betroffeneStimmenNichtMit` hält den Beklagten dann auch unter ihrer
 * Kopfbasis heraus. In den Fassungen vor 2026-08-15 kann eine Regel ihn
 * ersetzen, behält aber die Knotenkennung (`wendeReglementAn` übernimmt sie),
 * und der Beklagte bleibt von Gesetzes wegen ausgeschlossen. Beim Übersteuern
 * erbt das Erfordernis Knoten und Kopfbasis des Vorschlags (`uebersteuere`);
 * `alle_ausser_betroffene` lässt sich sonst nicht wählen. Eine Regel ohne
 * Baum (`erfordernisAusRegel`, Rückkommen) trägt einen eigenen Knoten und
 * fällt damit unter `ausgenommen`.
 *
 * **Eine Stelle für alle, die es wissen müssen**: Auszählung, Handzählung und
 * die Stimmsperre am Server. Dieselbe Regel stand vorher an diesen drei Stellen
 * und kannte an allen nur den Ausstand.
 *
 * Wer zugleich im Ausstand und betroffen ist, führt den Ausstand: Den hat die
 * Sitzungsleitung ausdrücklich erklärt.
 */
export function vomStimmrechtAusgeschlossen(
	e: Pick<Erfordernis, 'kopfbasis' | 'knotenId'>,
	imAusstand: readonly Id[],
	betroffene: readonly Id[]
): Map<Id, Ausschlussgrund> {
	const heraus = new Map<Id, Ausschlussgrund>();
	if (betroffeneStimmenNichtMit(e)) {
		// Die Einsprache wie die Ausschlussklage (ab Fassung 2026-10-20): Wer
		// verkauft, vermietet oder belastet, ist von Gesetzes wegen vom
		// Stimmrecht ausgeschlossen (Handschin/Wyttenbach, S. 63), nicht bloss
		// durch eine Klausel aus der Kopfbasis genommen.
		const grund = vollmachtenBetroffenerZaehlenNicht(e) ? 'betroffen' : 'ausgenommen';
		for (const id of betroffene) heraus.set(id, grund);
	}
	for (const id of imAusstand) heraus.set(id, 'ausstand');
	return heraus;
}

/** Eine Vollmacht, die bei diesem Traktandum ruht. */
export interface RuhendeVertretung extends Vertretung {
	grund: Ausschlussgrund;
}

/**
 * **Wer vom Stimmrecht ausgeschlossen ist, kann auch niemanden vertreten.**
 *
 * BGE 134 III 481 E. 3.8 (auch Regeste): «Dies gilt auch für einen vom
 * Stimmrecht ausgeschlossenen Stockwerkeigentümer, der in Vertretung eines
 * anderen Stockwerkeigentümers abstimmen soll.» Nach E. 3.9 sind solche
 * Stimmen «als ungültig zu betrachten und nicht zu zählen». Sonst gäbe der
 * Ausschluss die Stimme nur weiter, statt sie zu entziehen.
 *
 * Der Entscheid erging zu Art. 68; für den Beklagten nach Art. 649b Abs. 2 ist
 * er übertragen, eine Gegenmeinung gibt es in den Volltexten nicht
 * (`quellen/themen/stockwerkeigentum/fragen.md`, Frage 45). **Für Betroffene,
 * die nur ein Reglement ausnimmt, gilt er nicht** (seit 27.09.2026): Ihre
 * Vollmachten bleiben wirksam, Grund und Produktentscheid stehen bei
 * `vomStimmrechtAusgeschlossen`.
 *
 * **An der Einsprache** (ab Fassung 2026-10-20) übt der Eigentümer, der
 * verkauft, vermietet oder belastet, auch keine Vollmachten aus: BGE 134 III
 * 481 E. 3.8 (Regeste), übertragen auf den Ausschluss nach Art. 712c Abs. 2;
 * Fachprüfung F4a, S5. Votum zählt sie dort nicht (Grund `betroffen`). Die
 * Sätze dazu sagen, was Votum zählt (`ruhendInWorten`).
 *
 * **Die Vertretung ruht, sie endet nicht.** Der Ausschluss gilt je
 * Traktandum; beim nächsten übt dieselbe Person die Vollmacht wieder aus. Die
 * vertretene Partei ist nicht selbst ausgeschlossen, sie ist bei **diesem**
 * Geschäft schlicht weder anwesend noch wirksam vertreten.
 *
 * Nur wer anwesend ist, kann über eine ruhende Vollmacht anwesend gewesen
 * sein; alle anderen fehlen ohnehin.
 */
export function ruhendeVertretungenBei(
	vertretungen: readonly Vertretung[],
	ausgeschlossen: ReadonlyMap<Id, Ausschlussgrund>,
	anwesend: ReadonlySet<Id>
): Map<Id, RuhendeVertretung> {
	const ruhend = new Map<Id, RuhendeVertretung>();
	for (const v of vertretungen) {
		const grund = ausgeschlossen.get(v.bevollmaechtigtId);
		if (!grund || grund === 'ausgenommen') continue;
		if (!anwesend.has(v.vertreteneId)) continue;
		if (ausgeschlossen.has(v.vertreteneId)) continue;
		ruhend.set(v.vertreteneId, { ...v, grund });
	}
	return ruhend;
}

/** Der Satz zu einer ruhenden Vollmacht, für Auszählung und Handzählung. */
function ruhendInWorten(
	vertreten: string,
	bevollmaechtigt: string,
	grund: Ausschlussgrund,
	knotenId: string,
	/**
	 * Die Vertretung ruht aus L8 (Migration 184): Der Vertreter steht nicht
	 * wegen eines erklärten Ausstands aus, sondern wegen der Einstellung der
	 * Gemeinschaft. Dann sagt der Satz das statt des allgemeinen mit BGE 134
	 * III 481 E. 3.8 (Lauf 4, 07.11.2026): Das Bundesgericht hat die Regel für
	 * eine Verwaltung ohne Eigentum nicht entschieden, Votum überträgt sie
	 * hier selbst.
	 */
	ausVerwaltung = false
): string {
	if (ausVerwaltung) {
		return (
			`«${vertreten}» war nur über ${bevollmaechtigt} vertreten; nach der Einstellung Ihrer Gemeinschaft ` +
			'ruhen die Vollmachten der Verwaltung bei diesem Traktandum. Diese Partei kann hier keine Stimme ' +
			// Laienprüfung Runde 4, R4-6 (07.11.2026): An einem zweiten
			// Traktandum mit Häkchen ruht sie wieder; Codeprüfung P9: an einem
			// Folgeantrag zur Wahl mit Häkchen gilt sie.
			'abgeben; bei den übrigen Traktanden gilt sie wieder, ausser wo die Vollmachten der Verwaltung ' +
			'ebenfalls ruhen.'
		);
	}
	// `betroffen` heisst hier seit 27.09.2026: beklagt bei der Ausschlussklage,
	// ab Fassung 2026-10-20 auch betroffen bei der Einsprache. Wen ein
	// Reglement ausnimmt, dessen Vollmacht ruht nicht.
	/*
	 * **An der Einsprache ein Satz über das Werkzeug** (Laien- und Fachprüfung
	 * Runde 1, 19.10.2026). Dass der Betroffene dort keine Vollmachten ausübt,
	 * folgt aus BGE 134 III 481 E. 3.8 (Regeste), übertragen auf den Ausschluss
	 * nach Art. 712c Abs. 2; Fachprüfung F4a, S5. Die Karte nennt die
	 * Fundstelle, dieser Satz nicht.
	 */
	if (grund === 'betroffen' && knotenId === EINSPRACHE_KNOTEN) {
		return (
			`«${vertreten}» war nur über ${bevollmaechtigt} vertreten, der bei der Einsprache gegen das ` +
			'eigene Geschäft nicht mitstimmt; Votum zählt seine Vollmachten hier nicht. Diese Partei ' +
			'konnte hier keine Stimme abgeben; bei den übrigen Traktanden gilt die Vollmacht wieder.'
		);
	}
	const warum =
		grund === 'ausstand'
			? 'wer im Ausstand ist'
			: 'wer als unmittelbar betroffen vom Stimmrecht ausgeschlossen ist, hier als Beklagter der ' +
				'Ausschlussklage';
	return (
		`«${vertreten}» war nur über ${bevollmaechtigt} vertreten; ${warum}, kann niemanden ` +
		'vertreten (BGE 134 III 481 E. 3.8). Diese Partei konnte hier keine ' +
		'Stimme abgeben; bei den übrigen übt dieselbe Vollmacht wieder aus.'
	);
}

/**
 * Ein Vermerk, den das Protokoll zusätzlich zu den Hinweisen der Auswertung
 * trägt (Fachprüfung 08.10.2026,
 * `quellen/pruefung/berichte/2026-10-08-votum-protokoll-hinweise-fach.md`).
 *
 * **Eigene Fassung, eigene Ordnung.** Die Hinweise der Auszählung sprechen die
 * Sitzungsleitung an, nennen Fundstellen und sind auf die Auswertungsansicht
 * zugeschnitten; ins Protokoll gehören Feststellungen, keine Anweisungen und
 * keine Fundstellen. Die Reihenfolge des Berichts: erst der Ausgang, dann die
 * Zahlen, dann die Vermerke zur Bezugsgrösse, dann die Vermerke zum Ausgang.
 * Der Ausgang und die Zahlen stehen im Protokoll schon; dieses Feld trägt die
 * beiden Vermerksgruppen, und `ort` sagt, zu welcher ein Satz gehört.
 */
export interface Protokollhinweis {
	/**
	 * `bezugsgroesse`: erklärt die Zahlen (wer nicht stimmte, wie gerechnet
	 * wurde). `ausgang`: begründet oder relativiert das Ergebnis.
	 */
	ort: 'bezugsgroesse' | 'ausgang';
	satz: string;
	/**
	 * Dieselbe Zeile ohne Eigentümernamen, für das gemeinsame Abenddokument
	 * (Codeprüfung P11, H1, 08.11.2026). Es geht an die Eigentümer aller
	 * beteiligten Gemeinschaften und trägt keine Namen (10.09.2026); eine
	 * Zeile, die das Hausprotokoll mit Namen führt, steht dort nur, wo sie
	 * diese Fassung hat. Gesetzt bisher allein an den ruhenden Vollmachten der
	 * Verwaltung (Entscheid 3); fehlt sie, fehlt die Zeile im Abenddokument.
	 */
	ohneNamen?: string;
}

/**
 * Die Protokollfassung zu einer ruhenden Vertretung (H4), ohne Fundstelle.
 *
 * Die Anzeige-Fassung (`ruhendInWorten`) sagt, warum der Vertreter nicht
 * vertreten durfte; die Urkunde hält nur die Feststellung fest.
 */
function ruhendProtokollInWorten(vertreten: string, bevollmaechtigt: string, einsprache = false): string {
	// An der Einsprache eine Feststellung über die Zählung, nicht «durfte»
	// (Laien- und Fachprüfung Runde 1, 19.10.2026).
	if (einsprache) {
		return (
			`«${vertreten}» war nur über ${bevollmaechtigt} vertreten; ${bevollmaechtigt} stimmte bei ` +
			'der Einsprache gegen das eigene Geschäft nicht mit, und Votum zählte die Vollmacht nicht. ' +
			'Die Partei konnte hier keine Stimme abgeben. Bei den übrigen Traktanden gilt die Vollmacht ' +
			'wieder.'
		);
	}
	return (
		`«${vertreten}» war nur über ${bevollmaechtigt} vertreten; ${bevollmaechtigt} durfte bei ` +
		'diesem Traktandum niemanden vertreten. Die Partei konnte hier keine Stimme abgeben. ' +
		'Bei den übrigen Traktanden übt dieselbe Vollmacht wieder aus.'
	);
}

/**
 * Die Protokollfassung zu den Vollmachten der Verwaltung, die aus L8 ruhen
 * (Entscheid 3, 06.11.2026): nur die Tatsache mit der Zahl der Vertretenen,
 * kein zweites Ergebnis und kein Rechtsrat. Sie ersetzt die je Partei
 * formulierte Zeile aus `ruhendProtokollInWorten`, damit dieselbe Partei nicht
 * zweimal da steht. `namen` in der Form von `ausstandProtokollInWorten`, mit
 * demselben Parameter `klammern`; die Aufrufer übergeben `false`, weil die
 * Urkunde Namen ohne Anführungszeichen führt (G-4, 07.11.2026). Mit
 * `namentlich: false` die Fassung mit der Zahl allein, für das gemeinsame
 * Abenddokument (`Protokollhinweis.ohneNamen`, Codeprüfung P11, H1).
 */
function verwaltungsruhenProtokollInWorten(namen: string[], klammern = true, namentlich = true): string {
	const liste = namentlich ? ` (${namen.map((n) => (klammern ? `«${n}»` : n)).join(', ')})` : '';
	return (
		'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
		(namen.length === 1
			? `Für eine vertretene Partei${liste} zählte deshalb keine Stimme.`
			: `Für ${namen.length} vertretene Parteien${liste} zählte deshalb keine Stimme.`)
	);
}

/** Die Zeile zu den ruhenden Vollmachten der Verwaltung, mit der Fassung ohne Namen. */
function verwaltungsruhenProtokollhinweis(namen: string[]): Protokollhinweis {
	return {
		ort: 'bezugsgroesse',
		satz: verwaltungsruhenProtokollInWorten(namen, false),
		ohneNamen: verwaltungsruhenProtokollInWorten(namen, false, false)
	};
}

/**
 * Die Protokollfassung des Beklagten unter einer anderen Bezugsgrösse (H6).
 * «Als beklagte Partei», weil die Daten das Geschlecht nicht hergeben; die
 * Anzeige-Fassung spricht vom «Beklagten».
 */
function beklagterAndereBasisProtokollInWorten(name: string, knotenId: string): string {
	// An der Einsprache derselbe Inhalt wie der Satz im Saal (ab Fassung
	// 2026-10-20; Laienprüfung des Nachtrags zur Featureprüfung, 19.10.2026).
	if (knotenId === EINSPRACHE_KNOTEN) {
		return (
			`«${name}» zählte nicht mit: Wer verkauft, vermietet oder belastet, stimmt hier nicht mit ` +
			'(Art. 712c Abs. 2 ZGB).'
		);
	}
	return (
		`«${name}» ist als beklagte Partei bezeichnet und zählte bei diesem Traktandum nicht mit ` +
		'(Art. 649b Abs. 2 ZGB).'
	);
}

/**
 * Einstimmig ist auch ein Reglementsmehr aller Stimmen, das `typ` nicht nennt.
 */
function verlangtEinstimmigkeit(e: Pick<Erfordernis, 'typ' | 'kopfSchwelle'>): boolean {
	return e.typ === 'einstimmigkeit' || (e.kopfSchwelle !== null && e.kopfSchwelle.zaehler === e.kopfSchwelle.nenner);
}

/**
 * Der Satz unter einer Regel «Mehrheit aller Eigentümer» (A5, Punkt 12c): Die
 * Quellen zur Gegenlesart sprechen von der Einstimmigkeit, und dass der
 * Beschluss danach nicht zustande käme, folgt bei einer Mehrheit nicht.
 */
const AUSGETRETENE_MEHRHEIT =
	'Gerechnet wurde ohne die Ausgetretenen: Das Mehr aller Eigentümer bemisst sich hier an den ' +
	'stimmberechtigten Eigentümern. Mit den Ausgetretenen in der Zahl könnte die nötige Zahl grösser ' +
	'sein, und der Antrag das Mehr verfehlen. Die Frage ist nicht entschieden.';

/**
 * Die Protokollfassung zur Lesart bei Einstimmigkeit mit Ausstand (H7), ohne
 * die Quellenangaben der Anzeige und mit «Die Frage ist nicht entschieden.»
 * zwingend am Schluss (Fachprüfung 08.10.2026).
 *
 * A5, Punkt 12c: Der Satz hing bisher an der Kopfbasis «alle Eigentümer»,
 * nicht an der Einstimmigkeit, und sprach deshalb auch unter einer Regel
 * «Mehrheit aller Eigentümer» von Einstimmigkeit. Neu nennt er das Mehr beim
 * Namen: bei der Einstimmigkeit die Einstimmigkeit, sonst die Mehrheit aller
 * Eigentümer.
 */
function lesartProtokollInWorten(): string {
	return (
		'Gerechnet wurde ohne die Ausgetretenen: Die Einstimmigkeit bemisst sich hier an den ' +
		'stimmberechtigten Eigentümern. Die Gegenlesart stellt auf sämtliche im Grundbuch ' +
		'aufgeführten Eigentümer ab; danach wäre der Beschluss nicht zustande gekommen. Die Frage ' +
		'ist nicht entschieden.'
	);
}

/** Die Protokollfassung einer erfassten Stimme, die nicht zählt (H8). */
function stimmeNichtGezaehltProtokollInWorten(name: string, durch?: string): string {
	return durch
		? `Für «${name}» liegt eine Stimme vor, die ${durch} abgegeben hat. Sie ist bei diesem ` +
			'Traktandum nicht gezählt.'
		: `Für «${name}» wurde eine Stimme erfasst. Sie zählt nicht, weil die Wohnung hier nicht ` +
			'abstimmt.';
}

/** Die Protokollfassung der uneinheitlichen Stimmabgabe (H9). */
function uneinheitlichProtokollInWorten(name: string): string {
	return (
		`«${name}» hat je Einheit verschieden gestimmt. Bei der Zählung je Eigentümer lässt sich ` +
		'daraus keine Kopfstimme bilden; die Wertquoten sind aufgeteilt gezählt.'
	);
}

/** Die Protokollfassung des Stichentscheids nach Wertquoten (H2). */
function quotenstichentscheidProtokollInWorten(
	kopfJa: number,
	kopfNein: number,
	quotenJa: number,
	quotenNein: number,
	/**
	 * `true`: angenommen; `false`: auch dort nicht; `null`: die Wertquoten
	 * führen, entschieden hat danach aber noch etwas anderes, etwa die
	 * Zustimmung der Betroffenen. Dann ohne Schlusssatz (A1 Frage 1,
	 * Fachprüfung: «angenommen» stand auch bei einer Ablehnung).
	 */
	angenommen: boolean | null,
	geheim: boolean
): string {
	const schluss =
		angenommen === null
			? ''
			: angenommen
				? ' Der Antrag ist damit angenommen.'
				: ' Auch dort führt der Antrag nicht.';
	/*
	 * **Geheim ohne Zahlen** (Ä-38, Codeprüfung 16.10.2026): Der Satz ging
	 * bis dahin mit Kopf- und Quotenzahlen ins Protokoll, auch bei geheimer
	 * Abstimmung, gegen den Produktentscheid vom 28.09.2026 («nur erreicht /
	 * nicht erreicht»). Der Entscheidweg bleibt, die Zahlen nicht.
	 */
	if (geheim) {
		return (
			'Gleichstand bei den Kopfstimmen. Nach dem Reglement dieser Gemeinschaft entscheidet ' +
			'die Anteilsberechtigung.' +
			schluss
		);
	}
	return (
		`Gleichstand bei den Kopfstimmen (${kopfJa} zu ${kopfNein}). Nach dem Reglement dieser ` +
		`Gemeinschaft entscheidet die Anteilsberechtigung: ${quotenJa} Wertquoten dafür, ` +
		`${quotenNein} dagegen.` +
		schluss
	);
}

/** Die Protokollfassung der Differenz der erfassten Wertquoten (H11). */
function quotendifferenzProtokollInWorten(erfasst: number, gesamt: number): string {
	return (
		`Die erfassten Wertquoten ergeben ${erfasst}, die Gesamtquote der Gemeinschaft ist ` +
		`${gesamt}. Gerechnet wird auf der Gesamtquote: Die Differenz von ` +
		`${Math.abs(gesamt - erfasst)} kann keine Zustimmung geben.`
	);
}

/** Ob ein Fernbleibender in der Kopfbasis bleibt. */
function abwesendeZaehlenMit(kopfbasis: Kopfbasis): boolean {
	return kopfbasis !== 'anwesend_vertreten';
}

function leererSpiegel(): Stimmenspiegel {
	return {
		ja: 0,
		nein: 0,
		enthaltung: 0,
		ohneAbgabe: 0,
		nichtAnwesend: 0,
		basis: 0,
		schwelle: null,
		erreicht: false
	};
}

/**
 * Die Parteien im Ausstand, ohne Vertreter, die nicht Eigentümer sind (Ä-26,
 * Codeprüfung 17.10.2026, M1 bis M3). Ein solcher Vertreter hat keine eigene
 * Stimme und steht in keiner Bezugsgrösse; was sein Ausstand bewirkt, sind die
 * ruhenden Vollmachten (`ruhendeVertretungenBei` über die volle Liste). Sätze
 * über «Parteien im Ausstand» und die Basis zählen deshalb nur Parteien.
 */
function parteienImAusstand(imAusstand: readonly Id[] | undefined): Set<Id> {
	return new Set((imAusstand ?? []).filter((id) => !istVertreterkennung(id)));
}

/**
 * Die Parteien im Ausstand, für die die Zählung zu L10 ein Ergebnis nach der
 * anderen Wahl nennt: ohne Vertreter (`parteienImAusstand`) und ohne die
 * Betroffenen (`ausstandInDerZahlBei`). Nur wenn sie nicht leer ist, darf die
 * Maske vor der Abstimmung W11 zeigen; sonst verspräche der Satz ein Ergebnis,
 * das nicht kommt (Review DeepSeek zu E1, Befund 1: ein Vertreter ohne Partei
 * im Ausstand).
 */
export function ausstandMitAngehoerigenergebnis(
	imAusstand: readonly Id[],
	betroffene: readonly Id[]
): Id[] {
	const ohne = new Set(betroffene);
	return [...parteienImAusstand(imAusstand)].filter((id) => !ohne.has(id));
}

/** Die Wertquoten der Parteien im Ausstand. */
function ausstandsquoteVon(m: Snapshot, ausstandsmenge: Set<Id>): number {
	return m.parties
		.filter((p) => ausstandsmenge.has(p.partyId))
		.reduce((summe, p) => summe + p.units.reduce((q, u) => q + u.quota, 0), 0);
}

/**
 * Die Parteien im Ausstand, die an diesem Erfordernis trotzdem in der Zahl
 * bleiben: an der Ausschlussklage ab Fassung 2026-10-25 (1e), unter L13
 * «Alle Eigentümer» und ab der Fassung 2026-11-16 unter einer von Hand
 * gesetzten Kopfbasis «aller Eigentümer», ausser an Ausschlussklage und
 * Einsprache (`ausstandBleibtUnterAllen`, Entscheid 0050, Antwort 1; unten),
 * sonst keine.
 *
 * **An der Ausschlussklage ohne die Betroffenen** (Codeprüfung Teil 2, H2):
 * Die Leitung kann auch für den Beklagten selbst den Ausstand erklären
 * (`erklaereAusstand` sperrt das nicht). Ihn nimmt Art. 649b Abs. 2 aus der
 * Zahl, ebenso die Wohnung, gegen deren sämtliche Eigentümer sich der Antrag
 * richtet; beide sind als betroffen eingetragen. Die gemeinsame Wohnung des Beklagten (`stumm`) ebenfalls, und
 * so legen Einzel- und Handzählung sie in denselben Eimer.
 */
function ausstandInDerZahlBei(e: Erfordernis, ausstandsmenge: Set<Id>, betroffeneMenge: ReadonlySet<Id>): Set<Id> {
	/*
	 * **Unter L13 «Alle Eigentümer» ebenso** (Entscheid 0048, Antwort 9, «In der
	 * Zahl lassen»): Der Wortlaut «Mehrheit aller Miteigentümer» nimmt niemanden
	 * aus; wer im Ausstand ist, stimmt nicht mit und wirkt wie ein Nein. Geklärt
	 * ist das nicht, und so sagen es Katalog und Kartensatz.
	 */
	/*
	 * **Unter einer von Hand gesetzten Kopfbasis «aller Eigentümer» ebenso**,
	 * ab der Fassung 2026-11-16 (Entscheid 0050, Antwort 1, «Angleichen»;
	 * `ausstandBleibtBeiGewaehlterBasis`). Eine Regel für beide Wege, die strengere.
	 */
	if (!ausstandBleibtInDerZahl(e) && !ausstandBleibtUnterAllen(e)) return new Set();
	/*
	 * **Die Betroffenen fallen nur heraus, wo sie nicht mitstimmen**
	 * (`betroffeneStimmenNichtMit`). Bis hierher kommt davon nur die
	 * Ausschlussklage. Unter L13 «Alle Eigentümer» nimmt Antwort 9 niemanden
	 * aus; eine Partei im Ausstand, die zugleich als betroffen eingetragen ist,
	 * fiel hier bis zum 14.11.2026 trotzdem aus der Kopfzahl, und Kern und
	 * Auszählmappe gingen auseinander (Featureprüfung Regel 43, M3: zehn
	 * Eigentümer, Bezugsgrösse 9 statt 10). Das gilt für die Hauptzählung unter
	 * «Alle Eigentümer» und ebenso für das zweite Ergebnis nach L13 «Alle» an
	 * einem Traktandum unter der Vorgabe, das immer im Protokoll steht.
	 */
	if (!betroffeneStimmenNichtMit(e)) return new Set(ausstandsmenge);
	return new Set([...ausstandsmenge].filter((id) => !betroffeneMenge.has(id)));
}

/**
 * Die Wertquoten, die nach der Wahl «fällt heraus» zu L1 aus dem Nenner aller
 * Wertquoten fallen (Migration 170): die der Parteien im Ausstand.
 *
 * **Nicht die einer Partei, deren Vertreter im Ausstand ist** (Fachprüfung
 * Block 2, Befund 1; Produktentscheid 21.10.2026, Entscheid 0020). Ihr eigenes
 * Stimmrecht ruht nicht, nur die Vollmacht (BGE 134 III 481 E. 3.8: «unabhängig
 * davon, ob die durch ihn vertretene Y. AG selber vom Stimmrecht ausgeschlossen
 * gewesen wäre»). Sie steht wie eine abwesende Partei im Nenner, nach beiden
 * Wahlen; die Stelle der milden Wahl (Handschin/Wyttenbach, S. 63) spricht nur
 * vom Stimmrecht des Ausgeschlossenen.
 */
function ausstandsnenner(lage: Omit<Auszaehlungslage, 'stimmen'>): number {
	return ausstandsquoteVon(lage.momentaufnahme, parteienImAusstand(lage.imAusstand));
}

/**
 * Die Wertquoten der Parteien, die nur über eine Person im Ausstand vertreten
 * sind. Sie bleiben nach beiden Wahlen im Nenner, ohne Stimme; der Satz zum
 * Ausstand nennt sie, damit die Leitung erklären kann, warum gegen eine grössere
 * Zahl gemessen wird, als im Saal abstimmt (Laienprüfung Block 2, Runde 2, M1).
 */
function ruhendeAusstandsquote(lage: Omit<Auszaehlungslage, 'stimmen'>): number {
	const ruhend = ruhendeVertretungenBei(
		lage.vertretungen ?? [],
		vomStimmrechtAusgeschlossen(lage.erfordernis, lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []),
		new Set(lage.anwesende)
	);
	return ausstandsquoteVon(
		lage.momentaufnahme,
		new Set([...ruhend.values()].filter((v) => v.grund === 'ausstand').map((v) => v.vertreteneId))
	);
}

/**
 * Ob nach L1 die Quoten im Ausstand aus dem Nenner fallen, für die
 * Auszählmappe, die ihre eigenen Formeln schreibt (Migration 170).
 */
export function ausstandFaelltAusDemNenner(e: Erfordernis): boolean {
	return ausstandslesartWirkt(e) && wahlL1(e) === 'faellt_heraus';
}

/** Was nach L1 hier aus dem Nenner aller Wertquoten fällt: nach der Vorgabe nichts. */
function ausstandsabzug(lage: Omit<Auszaehlungslage, 'stimmen'>): number {
	const e = lage.erfordernis;
	if (!ausstandslesartWirkt(e) || wahlL1(e) !== 'faellt_heraus') return 0;
	return ausstandsnenner(lage);
}

/** Was nach der Wahl «fällt heraus» aus dem Nenner fiele, ob gewählt oder nicht. */
function nennerImAusstand(lage: Omit<Auszaehlungslage, 'stimmen'>): number {
	return ausstandsnenner(lage);
}

/**
 * Ob `ausstandshinweis` die Quotenschranke für nicht mehr erfüllbar erklärt.
 * Dieselbe Bedingung wie dort, für `erreichbarkeitshinweis`.
 */
function ausstandMachtUnerreichbar(e: Erfordernis, m: Snapshot, ausstandsmenge: Set<Id>): boolean {
	if (e.quotenbasis !== 'alle_quoten' || !e.quotenSchwelle || ausstandsmenge.size === 0) return false;
	// Nach «fällt heraus» sinkt die Schranke mit dem Nenner; unerreichbar macht
	// der Ausstand sie dann nicht (L1, Migration 170).
	if (ausstandslesartWirkt(e) && wahlL1(e) === 'faellt_heraus') return false;
	const ausstandsquote = ausstandsquoteVon(m, ausstandsmenge);
	return ausstandsquote > 0 && m.totalQuota - ausstandsquote < schwellenwert(m.totalQuota, e.quotenSchwelle);
}

/**
 * Warum die Wertquotenschranke bei einem Ausstand stehen bleibt.
 *
 * **Nach der Vorgabe von L1 senkt der Ausstand die absolute
 * Wertquotenschranke nicht.** «Mehr als die Hälfte **aller** Wertquoten» meint
 * 501 von 1000, und daran ändert der Ausstand nichts. Ob die Quote im Ausstand
 * im Nenner bleibt, ist nicht geklärt; die Stelle zum Ausstand nimmt sie heraus
 * (`ausstandslesartSatz`, Ä-27). Nach der Wahl «fällt heraus» (Migration 170)
 * sinkt die Schranke mit dem Nenner, und der Satz nennt die neue Zahl. An der
 * Ausschlussklage wirkt L1 nicht (`ausstandFestSatz`). Der Hinweis sagt das,
 * statt still zu rechnen.
 *
 * Praktisch heisst das: Steht genug Quote im Ausstand, ist das Erfordernis
 * nicht mehr erreichbar. Das muss **vor** der Abstimmung dastehen und nicht
 * nachher als Ergebnis.
 *
 * **Eigene Funktion seit dem 06.09.2026** (Bedienbarkeitsprüfung 05.09.2026,
 * Befund 15): «Nach einem Ausstand sinkt die Kopfbasis, die Quotenbasis nicht —
 * ohne ein Wort, warum.» Das Wort gab es, es stand nur im Ergebnis und nicht in
 * der Vorschau, die im Saal vor der Abstimmung an der Wand steht. Jetzt holen
 * es sich beide von hier; ein zweiter Wortlaut daneben wäre die zweite
 * Wahrheit, die beim nächsten Rechtsstand auseinanderläuft.
 *
 * Gibt `null` zurück, wo es nichts zu erklären gibt: kein Ausstand, keine
 * absolute Quotenschranke, oder ein Ausstand ohne Wertquote und ohne ruhende
 * Vollmacht. Ruht eine, steht allein der Satz zu den Vertretenen da.
 */
export function ausstandshinweis(
	e: Erfordernis,
	m: Snapshot,
	ausstandsmenge: Set<Id>,
	/**
	 * Die Protokollfassung (H3, Fachprüfung 08.10.2026): mit den Fundstellen zur
	 * offenen Frage (`ausstandslesartSatz`); im Saal, an der Wand und auf den
	 * Telefonen die Kurzfassung ohne sie (Ä-27).
	 */
	protokoll = false,
	/** Die Wertquoten der Parteien mit ruhender Vollmacht (`ruhendeAusstandsquote`). */
	ruhendQuote = 0
): string | null {
	if (e.quotenbasis !== 'alle_quoten' || !e.quotenSchwelle) return null;
	const vertretene =
		ruhendQuote > 0
			? ` Die ${ruhendQuote} Wertquoten von Parteien, die nur über eine Person im Ausstand vertreten ` +
				'sind, bleiben in der Zahl ohne Stimme und wirken wie ein Nein.'
			: '';
	const ausstandsquote = ausstandsquoteVon(m, ausstandsmenge);
	// Wo L1 nicht wirkt, nennt der Satz keine Lesart der Versammlung
	// (Codeprüfung Block 2, Teil 2, N3).
	const satz = (wahl: Ausstandswahl) =>
		ausstandslesartWirkt(e) ? ausstandslesartSatz(wahl, protokoll) : ausstandFestSatz();

	/*
	 * **Nach der Wahl «fällt heraus»** (L1, Migration 170) sinkt die Schranke
	 * mit dem Nenner. Der Satz nennt die Zahl, damit sich die neue Schranke
	 * nachrechnen lässt. An der Ausschlussklage wirkt L1 nicht
	 * (`ausstandslesartWirkt`); dort gilt der Satz nach der Vorgabe.
	 */
	// Ohne Quote im Ausstand bleibt allein der Satz zu den Vertretenen, etwa wenn
	// nur ein Vertreter ohne eigene Partei im Ausstand ist (Codeprüfung Teil 3, M1).
	if (ausstandsquote === 0) return vertretene ? vertretene.trim() : null;
	if (ausstandslesartWirkt(e) && wahlL1(e) === 'faellt_heraus') {
		const nenner = m.totalQuota - ausstandsquote;
		return (
			`Ohne die ${ausstandsquote} Wertquoten im Ausstand bemisst sich die Schranke an ${nenner} der ` +
			`${m.totalQuota} Wertquoten: nötig sind ${schwellenwert(nenner, e.quotenSchwelle)}.${vertretene} ` +
			satz('faellt_heraus')
		);
	}

	if (ausstandsmenge.size === 0 || ausstandsquote === 0) return null;
	/*
	 * Erreichbar heisst hier: was der Ausstand nicht sperrt. Eine ruhende
	 * Vollmacht zieht er nicht ab, so wenig wie eine Abwesende; wie viel im Saal
	 * stimmen kann, sagt die Vorschau (`erreichbarkeitshinweis`). Review DeepSeek
	 * Block 2, Befund 4: kein Fehler, Nachmessung 21.10.2026 im Bericht
	 * `.auftraege/2026-10-21-votum-lesarten-block2-review-deepseek-bericht.md`.
	 */
	const erreichbar = m.totalQuota - ausstandsquote;
	const noetig = schwellenwert(m.totalQuota, e.quotenSchwelle);
	return (
		// Laienprüfung Block 2, H1: was «zählt mit» im Saal heisst.
		`Im Ausstand stehen ${ausstandsquote} Wertquoten; sie wirken wie ein Nein. Die Schranke bleibt bei ` +
		`${noetig} von ${m.totalQuota}${protokoll ? ': Sie' : ' — sie'} bemisst sich an allen Wertquoten der ` +
		`Gemeinschaft.${vertretene} ${satz('bleibt')}` +
		(erreichbar < noetig
			? ` Erreichbar sind noch ${erreichbar}; nach dieser Rechnung ist das Erfordernis nicht ` +
				'mehr zu erfüllen.'
			: '')
	);
}

/**
 * Ob die Mehrheit mit denen, die im Saal stimmen können, überhaupt erreichbar
 * ist (Ä-11, Block 3 der Freigabeliste, 17.10.2026).
 *
 * **Der Anlass.** Die Vorschau nannte «nötig 501 von 1000 Wertquoten (aller
 * Wertquoten)», verglich das aber nicht mit dem, was im Saal ist. An einer
 * zweiten Versammlung genügt ein Drittel der Eigentümer für die
 * Beschlussfähigkeit (Rz. 42 ad Art. 712p), und eine Mehrheit aller Wertquoten
 * (Rz. 191 ad Art. 712m) kann dann unerreichbar sein. Dasselbe kann an einer
 * ersten Versammlung geschehen, mit genau der Hälfte der Quoten. Zu den Köpfen
 * aller sagt `kopfbasisStreit`, dass Votum dort streng rechnet.
 * Produktentscheid 17.10.2026: an jeder Versammlung, mit Zahlen.
 *
 * **Aus der Rechnung von `mehrheitsvorschau`, keine zweite.** Bei leerer
 * Stimmenliste steht jeder, der im Saal stimmen kann, unter `ohneAbgabe`;
 * Ausstand und ruhende Vollmachten fallen dort schon heraus. Mehr Ja als das
 * gibt es nicht.
 *
 * **Keine zweite Zahl neben dem Ausstandssatz.** Sagt `ausstandshinweis`
 * schon, die Quotenschranke sei nicht mehr zu erfüllen, nennt er «erreichbar
 * sind noch …» ohne die Abwesenden; eine zweite, kleinere Zahl daneben läse
 * sich als Widerspruch. Dann bleibt hier nur der Satz zu den Köpfen.
 *
 * Nur für die Leitung: Er steht neben dem Ausstandssatz, nicht an der Wand.
 */
export function erreichbarkeitshinweis(
	e: Erfordernis,
	leer: Pick<Auszaehlung, 'koepfe' | 'quoten'>,
	ausstandSagtEsSchon: boolean,
	/** Ob bei diesem Traktandum jemand im Ausstand ist (Laienprüfung 17.10.2026). */
	ausstandDa = false,
	/** Die Wertquoten der Parteien im Ausstand, für die offene Frage zum Nenner. */
	ausstandsquote = 0,
	/** Ob die Quote im Ausstand nach L1 schon aus dem Nenner gefallen ist (Migration 170). */
	ohneAusstandImNenner = false,
	/** Rückkommensantrag oder Durchgang danach (B2b), aus der Lage. */
	rueckkommen: Pick<Auszaehlungslage, 'rueckkommenAufAnnahme' | 'nachRueckkommen'> = {}
): string | null {
	// Beim Zirkulationsbeschluss sagt dessen eigener Satz, was gilt (Codeprüfung
	// 17.10.2026, M2).
	if (e.knotenId === ZIRKULARBESCHLUSS_KNOTEN) return null;
	const teile: string[] = [];
	const k = leer.koepfe;
	const kopfFehlt = k.schwelle !== null && k.ohneAbgabe < k.schwelle;
	if (kopfFehlt) {
		teile.push(
			`nötig sind ${k.schwelle} von ${k.basis} ${k.basis === 1 ? 'Kopfstimme' : 'Kopfstimmen'}, im Saal stimmen können ` +
				`höchstens ${k.ohneAbgabe}`
		);
	}
	const q = leer.quoten;
	const quotenFehlen = q.schwelle !== null && q.ohneAbgabe < q.schwelle && !ausstandSagtEsSchon;
	if (quotenFehlen) {
		teile.push(
			`nötig sind ${q.schwelle} von ${q.basis} Wertquoten, im Saal stimmberechtigt sind ` +
				`${q.ohneAbgabe}`
		);
	}
	if (teile.length === 0) return null;
	/*
	 * **Am Rückkommen an der Lage, nicht am Titel** (Fachprüfung F4c B2, Runde 2,
	 * R2-F-3): Eine Reglementsregel zum Rückkommen trägt ihren eigenen Titel. Der
	 * Titel bleibt als Rückfall für Aufrufer, die die Lage nicht kennen.
	 */
	const amRueckkommen = rueckkommen.rueckkommenAufAnnahme === true || e.titel.startsWith(RUECKKOMMEN_TITEL);
	const nachRueckkommen = amRueckkommen ? undefined : rueckkommen.nachRueckkommen;
	const saetze = [`Mit den Anwesenden und Vertretenen ist diese Mehrheit nicht zu erreichen: ${teile.join('; ')}.`];
	if (ausstandDa) {
		saetze.push('Wer im Ausstand ist, und wer nur über eine Person im Ausstand vertreten ist, zählt dabei nicht.');
	}
	/*
	 * **Der offene Nenner nur, wo er etwas ändert** (Fachprüfung Runde 2,
	 * Befund 3.4; Laienprüfung Runde 3, Stelle 3a). Ob die Quote im Ausstand im
	 * Nenner bleibt, ist nicht geklärt. Reichen die Stimmberechtigten auch ohne sie
	 * nicht, ist die Frage für dieses Traktandum ohne Folge und bleibt weg.
	 */
	const nennerOffen =
		quotenFehlen &&
		e.quotenbasis === 'alle_quoten' &&
		e.quotenSchwelle !== null &&
		ausstandsquote > 0 &&
		q.ohneAbgabe >= schwellenwert(q.basis - ausstandsquote, e.quotenSchwelle) &&
		// Scheitert der Antrag schon an den Köpfen, ändert der Nenner nichts (N-A).
		!kopfFehlt;
	if (quotenFehlen && e.quotenbasis === 'alle_quoten') {
		saetze.push(
			(ohneAusstandImNenner
				? 'Gezählt wird an allen Wertquoten der Gemeinschaft ausser denen im Ausstand, nicht nur an ' +
					'den erschienenen'
				: 'Gezählt wird an allen Wertquoten der Gemeinschaft, nicht nur an den erschienenen') +
				(nennerOffen
					? // Dass die Frage offen ist, sagt `ausstandshinweis` daneben (Ä-27);
						// hier nur die Folge, sonst stünden zwei Wortlaute nebeneinander.
						'. Ohne die Wertquoten im Ausstand wäre das Erfordernis erreichbar.'
					: '.')
		);
	}
	// Ob die Köpfe aller umstritten sind, sagt `kopfbasisStreit` je Karte
	// (Fachprüfung 17.10.2026, Stelle 3; eingeschränkt am 22.10.2026).
	const streit = kopfFehlt ? kopfbasisStreit(e) : null;
	if (streit) saetze.push(streit.satz);
	// An der Kennung, nicht an der Kopfbasis (Codeprüfung 17.10.2026, M-B): Eine
	// Reglementsklausel ersetzt die Kopfbasis, der Fall bleibt.
	const ausschlussklage = e.knotenId === AUSSCHLUSSKLAGE_KNOTEN;
	/*
	 * **Die strenge Lesart sichert eine Annahme, keine Ablehnung** (Fachprüfung
	 * Runde 2, Befund 3.3; Rz. 215a ad Art. 712a), und die Anfechtung hebt nur
	 * auf (Runde 3, Befund 3.2; Rz. 234 f. ad Art. 712m). Der Satz steht unter
	 * der Bedingung, unter der die andere Lesart überhaupt etwas ändert
	 * (Laienprüfung Runde 3, Stelle 3b). Die Verschiebung ist ein Ordnungsantrag
	 * (Rz. 98a ad Art. 712n). Der Zirkulationsbeschluss bleibt offen, sofern das
	 * Reglement ihn nicht ausschliesst (Rz. 127 ad Art. 712m), aber nicht bei der
	 * Ausschlussklage (Runde 3, Befund 3.3): Der Beklagte unterschreibt die
	 * eigene Ermächtigung kaum. Ausgeschlossen ist der Weg damit nicht, nur
	 * unsicher: Nach Rz. 125 ad Art. 712m genügt es, wenn alle ausser dem nach
	 * Art. 68 Ausgeschlossenen unterzeichnen, gestützt auf kantonale Praxis;
	 * BGer 5A_773/2019 hält einen solchen Beschluss nur für nicht nichtig
	 * (Fachprüfung zum Handbuch, 18.10.2026). Der Satz nennt ihn deshalb nicht.
	 */
	/*
	 * Fassung nach Runde 4 (17.10.2026), Wortlaute aus den Prüfungen
	 * übernommen: beim offenen Nenner die Bedingung mit der Zahl (Laien und
	 * Fach, Stelle 3a), bei der Ausschlussklage «ausser den Betroffenen» in der
	 * Bedingung (Fach, Stelle 3c). Der Zirkularweg steht vor der Verschiebung
	 * (Laien, Stelle 3b): Bei der Einstimmigkeit ist er der eigentliche Ausweg.
	 */
	const anfechtung =
		'kann diese Ablehnung angefochten werden. Das Gericht hebt sie dann nur auf, ' +
		'angenommen ist der Antrag damit nicht (ZGB Art. 712m Abs. 2 i.V.m. Art. 75; ' +
		'Wermelinger, Rz. 234 f. ad Art. 712m).';
	/*
	 * An den Reglementskarten ist die andere Lesart das qualifizierte Mehr nach
	 * Art. 712g Abs. 3. Ob das Urteil dort nur die Ablehnung aufhebt oder den
	 * nicht gefassten Beschluss an ihre Stelle setzt, ist nicht sicher, und so
	 * sagt es der Satz (Rz. 234 und 235a ad Art. 712m; Fachprüfung 22.10.2026,
	 * F10-1; Fach B2 Runde 2: der Kommentar sagte bis F4c «kann ersetzen»).
	 */
	const anfechtungReglement =
		'kann diese Ablehnung angefochten werden. Ob das Gericht sie dann nur aufhebt oder den ' +
		'Beschluss an ihre Stelle setzt, ist bei einer Reglementsänderung nicht sicher (ZGB ' +
		'Art. 712m Abs. 2 i.V.m. Art. 75; Wermelinger, Rz. 234 und 235a ad Art. 712m).';
	/*
	 * **Am Rückkommen die Folge statt der Anfechtung** (B2b; Laien Runde 2,
	 * R2-L-1): Die Ablehnung lässt einen Beschluss stehen, der nach der strengen
	 * Zählung angenommen war und damit nach beiden besteht. Ihre Aufhebung durch
	 * das Gericht ersetzte kein Rückkommen (Rz. 234 f. ad Art. 712m; `quellen`
	 * Frage 88, dort für L6).
	 */
	const folgeAmRueckkommen = 'Damit ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt.';
	if (streit?.streitig && amRueckkommen) {
		saetze.push(
			(ausschlussklage
				? 'Stimmt die Mehrheit der Anwesenden und Vertretenen ausser den Betroffenen zu, ' +
					'verkündet Votum nach seiner strengen Lesart trotzdem eine Ablehnung.'
				: streit.mildereBedingung === 'qualifiziert'
					? 'Erreicht der Rückkommensantrag das qualifizierte Mehr, verkündet Votum nach seiner ' +
						'strengen Lesart trotzdem eine Ablehnung.'
					: 'Stimmen alle Anwesenden und Vertretenen zu, verkündet Votum nach seiner strengen ' +
						'Lesart trotzdem eine Ablehnung.') +
				` ${folgeAmRueckkommen}`
		);
	} else if (nennerOffen && e.quotenSchwelle && amRueckkommen) {
		const ohne = q.basis - ausstandsquote;
		saetze.push(
			'Lassen Sie abstimmen, ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt. Das ' +
				'gilt auch, wenn die Ja-Stimmen das Mehr ohne die Wertquoten im Ausstand erreichen (hier ' +
				`${schwellenwert(ohne, e.quotenSchwelle)} von ${ohne}).`
		);
	} else if (streit?.streitig) {
		saetze.push(
			(ausschlussklage
				? 'Stimmt die Mehrheit der Anwesenden und Vertretenen ausser den Betroffenen zu, ' +
					'verkündet Votum nach seiner strengen Lesart trotzdem eine Ablehnung'
				: streit.mildereBedingung === 'qualifiziert'
					? 'Erreicht der Beschluss das qualifizierte Mehr, verkündet Votum nach seiner ' +
						'strengen Lesart trotzdem eine Ablehnung'
					: 'Stimmen alle Anwesenden und Vertretenen zu, verkündet Votum nach seiner strengen ' +
						'Lesart trotzdem eine Ablehnung') +
				`; trifft die andere Lesart zu, ${streit.mildereBedingung === 'qualifiziert' ? anfechtungReglement : anfechtung}`
		);
	} else if (nennerOffen && e.quotenSchwelle) {
		const ohne = q.basis - ausstandsquote;
		saetze.push(
			'Lassen Sie abstimmen, verkündet Votum eine Ablehnung. Erreichen die Ja-Stimmen das ' +
				`Mehr ohne die Wertquoten im Ausstand (hier ${schwellenwert(ohne, e.quotenSchwelle)} ` +
				`von ${ohne}) und trifft die andere Lesart zu, ${anfechtung}`
		);
	} else {
		/*
		 * **Am Rückkommen die Folge, die die Leitung verkündet** (Laienprüfung
		 * F4c B2, 05.11.2026, B2-L-1): «der Antrag» las sich dort als der
		 * Beschluss, und die Leitung hätte verkündet, er sei gefallen. Wortlaut
		 * wie nach dem abgelehnten Rückkommensantrag (`rueckkommensauskunft`).
		 */
		saetze.push(
			amRueckkommen
				? 'Lassen Sie abstimmen, ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt.'
				: nachRueckkommen
					? // «Nein heisst Nein» nach dem Rückkommen (B2b, Befund zur Prüfdatei B2-F-6):
						// Wer geht, macht die Mehrheit unerreichbar, und die Ablehnung hebt den Beschluss auf.
						'Lassen Sie abstimmen, ist der Antrag abgelehnt, und nach dem Rückkommen ersetzt auch ' +
						`diese Ablehnung den Beschluss aus dem ${nachRueckkommen.geltenderDurchgang}. Durchgang: ` +
						'Er ist dann aufgehoben.'
					: 'Lassen Sie abstimmen, ist der Antrag abgelehnt.'
		);
	}
	if (amRueckkommen) {
		/*
		 * **Am Rückkommen Gegenstand und Weg der Aufhebung** (Fachprüfung F4c B2,
		 * Runde 2, R2-F-1 und R2-F-2; `quellen` Frage 88): Der schriftliche
		 * Beschluss hebt auf, ein schriftliches Rückkommen gibt es nicht
		 * (Rz. 124, 127 und 128 ad Art. 712m). An einer späteren Versammlung ist die
		 * Aufhebung ein eigenes, angekündigtes Traktandum (Art. 67 Abs. 3 ZGB;
		 * Rz. 38 und 40 ad Art. 712n); Rz. 98a trägt nur die Verschiebung im Abend.
		 */
		saetze.push('Nachträgliche schriftliche Zustimmungen der Abwesenden ergänzen die Abstimmung im Saal nicht.');
		if (!ausschlussklage) {
			saetze.push(
				'Möglich bleibt ein schriftlicher Beschluss (Zirkulationsbeschluss), den alle Eigentümer ' +
					'unterschreiben, auch die anwesenden (ZGB Art. 66 Abs. 2; Wermelinger, Rz. 127 ad Art. 712m). ' +
					'Er steht dem Beschluss der Versammlung gleich (Rz. 124 ad Art. 712m); auf das Blatt gehört ' +
					'deshalb der Wortlaut der Aufhebung, nicht der Rückkommensantrag. Bis zur letzten Unterschrift gilt der frühere Beschluss (Rz. 128 ad Art. 712m). ' +
					'Wie das Blatt vorzubereiten ist und ob Ihr Reglement den Weg ausschliessen kann, sagt die ' +
					'Karte des Traktandums; was dort für die Annahme steht, gilt hier für die Aufhebung.'
			);
		}
		const klausel = e.lesartDesBeschlusses?.kennung === 'L6' && e.lesartDesBeschlusses.wahl !== 'gesetz';
		saetze.push(
			'Die Versammlung kann den Rückkommensantrag auf Antrag ans Ende des Abends verschieben ' +
				'(Wermelinger, Rz. 98a ad Art. 712n). An einer späteren Versammlung ist die Aufhebung ein ' +
				'eigenes Traktandum, das die Einladung nennen muss (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m ' +
				'Abs. 2; Wermelinger, Rz. 38 und 40 ad Art. 712n).' +
				(klausel ? ' Unter «Klausel anwenden» braucht sie dort wieder die Zustimmung aller Eigentümer.' : '') +
				' Das Mehr dafür nennt dann seine Karte, und bis dahin gilt der frühere Beschluss. Erscheinen ' +
				'weitere Eigentümer oder werden weitere Vollmachten vorgelegt, ändert sich die Rechnung.'
		);
		return saetze.join(' ');
	}
	/*
	 * **Im Durchgang nach dem Rückkommen keine spätere Versammlung** (Laien- und
	 * Fachprüfung B2b, B2b-L-4 und B2b-F-4): Das Rückkommen geht nicht mit;
	 * kommt es heute zu keiner Abstimmung, bleibt der frühere Beschluss
	 * (Wortlaut des Rückkommens), und dort ist eine Änderung ein eigenes
	 * Traktandum (Art. 67 Abs. 3 ZGB; Rz. 38 und 40 ad Art. 712n).
	 */
	const lesartHier = e.gemeinschaftslesart ?? e.lesartDesBeschlusses;
	const klauselHier =
		lesartHier?.kennung === 'L6' && lesartHier.wahl !== 'gesetz' && e.knotenId === 'k-reglement-eigene-schranke';
	const verschiebung = nachRueckkommen
		? 'Die Versammlung kann diesen Durchgang auf Antrag ans Ende des Abends verschieben (Wermelinger, ' +
			`Rz. 98a ad Art. 712n). Kommt es heute zu keiner Abstimmung mehr, bleibt der Beschluss aus dem ` +
			`${nachRueckkommen.geltenderDurchgang}. Durchgang; an eine spätere Versammlung geht das Rückkommen ` +
			'nicht mit. Dort ist eine Änderung oder Aufhebung ein eigenes Traktandum, das die Einladung nennen ' +
			'muss (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2; Wermelinger, Rz. 38 und 40 ad Art. 712n).' +
			(klauselHier ? ' Unter «Klausel anwenden» braucht sie dort wieder die Zustimmung aller Eigentümer.' : '') +
			' Das Mehr dafür nennt dann ihre Karte. '
		: 'Die Versammlung kann das Traktandum stattdessen auf Antrag verschieben, ans Ende des ' +
			'Abends oder auf eine spätere Versammlung (Wermelinger, Rz. 98a ad Art. 712n). ';
	saetze.push(
		'Nachträgliche schriftliche Zustimmungen der Abwesenden ergänzen die Abstimmung im Saal ' +
			'nicht' +
			(ausschlussklage
				? '.'
				: '; möglich bleibt ein schriftlicher Beschluss (Zirkulationsbeschluss), den alle ' +
					'Eigentümer unterschreiben, auch die anwesenden (ZGB Art. 66 Abs. 2; Wermelinger, ' +
					'Rz. 127 ad Art. 712m). Ob Ihr Reglement ihn ausschliessen kann und wie er ' +
					'vorzubereiten ist, sagt die Karte des Traktandums.')
	);
	saetze.push(
		verschiebung +
			'Erscheinen weitere Eigentümer oder werden weitere Vollmachten vorgelegt, ändert sich ' +
			'die Rechnung.'
	);
	return saetze.join(' ');
}

/**
 * Der eine Satz über den Ausstand, für alle vier Stellen, die ihn führen.
 *
 * **Der Anlass** (Zweitprüfung 17.09.2026, Ä-25): «zählt weder bei den Köpfen
 * noch bei den Wertquoten mit» stand an **fünf** Stellen und war überall zu
 * unbedingt. Zwei waren flüchtige Meldungen, zwei bleibende Texte (Auswertung
 * und Protokoll), die fünfte steht in `zaehleSummenAus` für die Handzählung
 * und hatte dort zusätzlich einen Beugungsfehler. Die bleibenden sind die, die
 * im Streitfall gelesen werden.
 *
 * Die Zählung «vier» stand hier zwei Fassungen lang und war beide Male zu
 * niedrig: erst zwei, dann vier. Gezählt wurde jeweils, was das Suchmuster
 * hergab.
 *
 * **Warum der Satz jetzt weniger sagt.** Nachgemessen an `quotenbasisWert` und
 * `abwesendeZaehlenMit`: Unter `alle_quoten` gibt die Quotenbasis schlicht
 * `m.totalQuota` zurück und kennt den Ausstand gar nicht; unter
 * `anwesend_vertreten` summiert sie über den Spiegel, in dem er fehlt. Und bei
 * den Köpfen ändert sich **nichts**, wenn eine abwesende Partei in den Ausstand
 * gesetzt wird und die Basis ohnehin nur Anwesende zählt. Ein erster Entwurf
 * dieses Blocks ersetzte darum bloss eine unbedingte Aussage über die Quoten
 * durch eine unbedingte über die Köpfe (Code-Review 24.09.2026, Befund 4).
 *
 * Unbedingt wahr ist nur die Rechtsfolge selbst: keine Stimme zu diesem
 * Traktandum. Was das für die beiden Bezugsgrössen heisst, sagt dort, wo das
 * Erfordernis bekannt ist, `ausstandshinweis` — mit Zahlen und mit dem Punkt,
 * auf den es ankommt: ob die Schranke überhaupt noch erreichbar ist. Für das
 * Protokoll nennt seit dem 24.09.2026 `ausstandswirkung` beide Bezugsgrössen
 * mit und ohne Ausstand.
 *
 * **Und warum als Funktion.** Vier gleichlautende Zeichenketten waren viermal
 * gleich falsch. Ein zweiter Wortlaut daneben wäre die zweite Wahrheit, die
 * beim nächsten Rechtsstand auseinanderläuft — dieselbe Begründung wie bei
 * `ausstandshinweis` oben.
 *
 * Ohne Namen (leere Liste) steht «Eine Partei»: Das Protokoll kennt den Namen
 * nicht immer, und ein führendes Leerzeichen wäre dort sichtbar.
 *
 * **`klammern` gibt es wegen der Urkunde** (Code-Review 24.09.2026, Befund 6).
 * Im Saal stehen Parteinamen in Anführungszeichen, im erzeugten Protokoll
 * nicht: Dort schreibt der Absatz darunter «Der Ausstand von Immo Muster wurde
 * zurückgenommen» blank, und derselbe Name in zwei Schreibweisen direkt
 * untereinander sieht in einer Urkunde nach einem Fehler aus.
 */
export function ausstandsmeldung(namen: string[], klammern = true): string {
	const mehrzahl = namen.length > 1;
	const wer =
		namen.length === 0
			? 'Eine Partei'
			: namen.map((n) => (klammern ? `«${n}»` : n)).join(', ');
	return (
		`${wer} ${mehrzahl ? 'sind' : 'ist'} bei diesem Traktandum in den Ausstand ` +
		`getreten und ${mehrzahl ? 'geben' : 'gibt'} dazu keine Stimme ab ` +
		'(ZGB Art. 68 i.V.m. Art. 712m Abs. 2). Wie sich das auf die Bezugsgrössen ' +
		'auswirkt, hängt vom Erfordernis des Traktandums ab.'
	);
}

/**
 * Die Rückmeldung nach dem Ausstand eines Vertreters ohne Eigentum (Ä-26,
 * Migration 167). Er hat keine eigene Stimme; was der Ausstand bewirkt, sind
 * die ruhenden Vollmachten (BGE 134 III 481 E. 3.8 sinngemäss; Grundlage und
 * Grenzen bei `ausstandMitVollmachten`). Die Erinnerung an den Vorsitz nach
 * der Fachprüfung vom 17.10.2026 (Stelle 3, Rz. 35 ad Art. 712m).
 */
export function vertreterausstandsmeldung(namen: string[]): string {
	const wer = namen.map((n) => `«${n}»`).join(', ');
	return (
		`${wer} ${namen.length > 1 ? 'sind' : 'ist'} bei diesem Traktandum als Vertreter in den ` +
		'Ausstand getreten; die Vollmachten, die dabei ruhen, nennt die Seite beim Traktandum. ' +
		'Hält ein Vertreter im Ausstand den Vorsitz, sollte der Vorsitz für dieses Traktandum an jemand ' +
		'anderen gehen (Wermelinger, Rz. 35 ad Art. 712m). ' +
		// Die Grenze zuletzt, wie in `ausstandMitVollmachten` (Codeprüfung der
		// Featureprüfung Block 3, 18.10.2026, M1): erst die Handlung, dann das Recht.
		VERTRETERGRENZE
	);
}

/**
 * Die Protokollfassung der Ausstandsmeldung (H3, Fachprüfung 08.10.2026): in
 * der Vergangenheit, mit der Norm, ohne den Überleitungssatz der Anzeige
 * («hängt vom Erfordernis ab»). Die Urkunde stellt fest, sie erklärt nicht.
 *
 * `klammern` wie bei `ausstandsmeldung`: In der Urkunde stehen die Namen ohne
 * Anführungszeichen.
 */
export function ausstandProtokollInWorten(namen: string[], klammern = true): string {
	const mehrzahl = namen.length > 1;
	const wer = namen.length === 0 ? 'Eine Partei' : namen.map((n) => (klammern ? `«${n}»` : n)).join(', ');
	return (
		`${wer} ${mehrzahl ? 'sind' : 'ist'} bei diesem Traktandum in den Ausstand getreten und ` +
		`${mehrzahl ? 'haben' : 'hat'} dazu keine Stimme abgegeben ` +
		'(Art. 68 i.V.m. Art. 712m Abs. 2 ZGB).'
	);
}

/**
 * Die Bestätigung nach dem Eintragen von Betroffenen im Saal (Block A2).
 *
 * Für beide Leitungsseiten aus einer Quelle, wie `ausstandsmeldung`. Kein
 * Satz über die Rechtsfolge: Was die Eintragung bewirkt, hängt am Erfordernis
 * und steht dort.
 */
export function betroffenenmeldung(namen: string[]): string {
	const wer = namen.length === 0 ? 'Eine Partei' : namen.map((n) => `«${n}»`).join(', ');
	return `${wer} ${namen.length > 1 ? 'sind' : 'ist'} bei diesem Traktandum als betroffen eingetragen.`;
}

/**
 * Der Hinweis **vor** der Abstimmung, wenn eine Betroffene zugleich im
 * Ausstand ist (Produktentscheid 26.09.2026, Lesart B).
 *
 * **Warum eigens vor der Abstimmung** (Laienprüfung 26.09.2026, Runde 2): Der
 * Hinweis aus `zaehleAus` erscheint erst unter dem Ergebnis; die Vorschau gibt
 * die Hinweise der Auszählung nicht weiter. Ob der Ausstand hier überhaupt
 * gegeben ist, muss die Leitung aber vorher klären (SVIT-Kommentar 2023,
 * Rz. 144 ad Art. 712m). Nur für die Leitungsseite, nicht für Protokoll und
 * Auswertung.
 */
export function ausstandUndBetroffenHinweis(namen: string[]): string | null {
	if (namen.length === 0) return null;
	const wer = namen.map((n) => `«${n}»`).join(', ');
	const eine = namen.length === 1;
	return (
		`${wer} ${eine ? 'ist' : 'sind'} im Ausstand und als unmittelbar betroffen bezeichnet. ` +
		'Einen Ausstand gibt es hier nur, wenn mit der Änderung ein Geschäft mit der Gemeinschaft ' +
		'verbunden ist, etwa eine vereinbarte Entschädigung. Ebenso, wenn über die Sache schon ein ' +
		'Gerichtsverfahren läuft oder das Reglement ihn vorsieht. Trifft nichts davon zu, nehmen Sie den ' +
		`Ausstand zurück, bevor abgestimmt wird; dann ${eine ? 'stimmt sie' : 'stimmen sie'} mit und ` +
		`${eine ? 'kann' : 'können'} im Saal zustimmen. Den Ausstand nehmen Sie in der Liste darüber ` +
		'mit «Zurücknehmen» zurück. Bleibt der Ausstand, stimmt sie bei der Mehrheit nicht mit; die Auswertung zählt ' +
		'nur, ob sie zustimmt. Eine schriftliche Zustimmung, auch eine in der Versammlung ' +
		'unterschriebene, vermerken Sie vor der Abstimmung unter «Betroffene». Während der ' +
		'Abstimmung entscheidet sie oder ihre Vertretung am eigenen Gerät, sofern als anwesend ' +
		'erfasst, oder eine von beiden sagt es Ihnen, auch telefonisch; erfassen Sie den Entscheid ' +
		'dann unter «Veto».'
	);
}

/** Legt ein Gewicht in den Eimer, der zur Wahl gehört. */
function lege(spiegel: Stimmenspiegel, wahl: VoteChoice | 'ohne_abgabe', gewicht: number): void {
	if (gewicht === 0) return;
	switch (wahl) {
		case 'yes':
			spiegel.ja += gewicht;
			break;
		case 'no':
			spiegel.nein += gewicht;
			break;
		case 'abstain':
			spiegel.enthaltung += gewicht;
			break;
		case 'ohne_abgabe':
			spiegel.ohneAbgabe += gewicht;
			break;
	}
}

/**
 * Der Hinweis, wenn eine hinterlegte Verwalter-Klausel den Gleichstand nicht
 * mehr auflöst (Produktentscheid 27.09.2026).
 *
 * **Ein Wortlaut für beide Zählwege** — die Einzelzählung und die Handzählung.
 * Der Hinweis empfiehlt die Ablehnung ausdrücklich: Ohne ihn stünde im
 * Saal ein verfehltes Mehr ohne Begründung, und die Leitung müsste die
 * hinterlegte Klausel selbst gegen die Anwendung verteidigen.
 */
/**
 * **Ein Stichentscheid löst nur das Patt der einfachen Mehrheit** (Codeprüfung
 * 27.09.2026, H-1). Verlangt das Geschäft mehr als die Hälfte der Köpfe, etwa
 * zwei Drittel oder drei Viertel, ist 3 zu 3 kein Patt vor der Schwelle, sondern
 * ein verfehltes Mehr; die Wertquoten hoben es trotzdem auf «angenommen». Die
 * Einstimmigkeit fällt hier ebenfalls heraus, sie hat keine Kopfschwelle von
 * einer Hälfte.
 */
function schwelleIstHaelfte(e: Erfordernis): boolean {
	return !!e.kopfSchwelle && e.kopfSchwelle.zaehler * 2 === e.kopfSchwelle.nenner;
}

/**
 * **Und nur ohne Wertquotenbedingung** (A1 Frage 1, 30.10.2026; `quellen`
 * Frage 73). Das qualifizierte Mehr nach Köpfen und Wertquoten hat ebenfalls
 * eine Kopfschwelle von einer Hälfte, und bis dahin löste der Kern den
 * Gleichstand auch dort auf; beim Stichentscheid nach Wertquoten entfiel die
 * Kopfbedingung damit ganz. Der Stichentscheid ist eine Abweichung von der
 * gesetzlichen Berechnung (Rz. 185 bis 189 ad Art. 712m); eine Klausel «bei
 * Stimmengleichheit» übernimmt am qualifizierten Mehr die gesetzliche
 * (Rz. 190), solange sie nicht ausdrücklich etwas anderes sagt (Rz. 194).
 * Gilt für jede Art, Wertquoten, Verwalter und Vorsitz, und für beide
 * Zählwege.
 */
export function stichentscheidMoeglich(e: Erfordernis): boolean {
	return schwelleIstHaelfte(e) && !e.quotenSchwelle;
}

/**
 * Der Hinweis zum Stichentscheid einer Person — offen oder entschieden.
 *
 * **Der offene Fall empfiehlt die Ablehnung** (Produktentscheid 28.09.2026:
 * «Empfohlen wird ablehnen, weil das dem Gesetz entspricht und man nicht
 * Partei ergreifen würde.»). Die Klausel gilt trotzdem: Die Person trägt ihren
 * Entscheid ein; erst dann steht ein Ergebnis fest. Eine Annahme lässt sich
 * anfechten (Rz. 187 ad Art. 712m).
 */
/*
 * Der Widerspruch im Saal bei einer Person ohne eigenes Stimmrecht
 * (Laienprüfung 07.10.2026, L7). Die Leitung liest im Saal nur Hinweis und
 * Formular; steht der Schritt allein im Handbuch, fällt er aus.
 *
 * **Woher die Rügepflicht kommt** (S10, F4a, E5; berichtigt 04.11.2026). BGE
 * 136 III 174 betrifft laut Regeste einen Verfahrensfehler bei unvollständiger
 * Traktandenliste: Art. 2 ZGB zwingt, den Mangel vor der Beschlussfassung über
 * die betroffene Frage zu beanstanden (E. 5.1), nicht die Universalversammlung.
 * Rz. 230b ad Art. 712m verlangt für bestimmte Verfahrensmängel, sie «umgehend
 * vor Ort» zu rügen. Ob das am Stichentscheid gilt, ist nicht entschieden; der
 * Satz sagt deshalb «kann». Festgehalten wird in der Rubrik «Rüge festhalten»
 * am Traktandum (`Ruegen.svelte`), weil sie die Uhrzeit festhält, und auf die
 * kommt es an: vor der Beschlussfassung. Am gemeinsamen Abend mehrerer
 * Gemeinschaften gibt es die Rubrik dort nicht; Rügen hält man auf der
 * Leitungsseite des Hauses fest (Runde 3, T5).
 */
/** S10, F4a (E5), erster Satz: fragen. */
export const WIDERSPRUCH_FRAGEN = 'Fragen Sie vor dem Eintrag den Saal, ob jemand widerspricht.';
/** S10, F4a (E5; Runde 3, T5), zweiter Satz: wo und wie festhalten, auch am gemeinsamen Abend. */
export const WIDERSPRUCH_FESTHALTEN =
	// Laienprüfung Runde 3, L3-4: wie man am Abend dorthin kommt.
	'Halten Sie jeden Widerspruch mit Name und Uhrzeit als Rüge fest, am Traktandum unter «Rüge festhalten». ' +
	'Am gemeinsamen Abend tun Sie das auf der Leitungsseite des Hauses, erreichbar unter «Es tagen mit».';
/** S10, F4a (E5), die Folge (BGE 136 III 174, Regeste und E. 5.1; Rz. 230b ad Art. 712m). */
export const WIDERSPRUCH_FOLGE_SCHWEIGEN = 'Wer schweigt, kann das Recht zur Anfechtung verlieren.';
const WIDERSPRUCH = `${WIDERSPRUCH_FRAGEN} ${WIDERSPRUCH_FESTHALTEN} ${WIDERSPRUCH_FOLGE_SCHWEIGEN}`;

/*
 * **Seit dem 07.10.2026 auch für den Vorsitz und nach den Wertquoten**
 * (Auftrag «votum-stichentscheid-kaskade»). `person` sagt, wen das Reglement
 * benennt; `quoten` ist gesetzt, wenn vorher die Anteilsberechtigung geprüft
 * wurde und ebenfalls gleich stand. Der Satz nennt dann beide Gleichstände,
 * sonst läse die Leitung nicht, warum die Wertquoten nichts entschieden haben.
 */
function verwalterKlauselHinweis(
	ja: number,
	nein: number,
	entscheid?: Stichentscheidbefund,
	person: 'verwalter' | 'vorsitz' = 'verwalter',
	quoten?: { ja: number; nein: number }
): string {
	const gleich = quoten
		? `Gleichstand bei den Kopfstimmen (${ja} zu ${nein}) und bei den Wertquoten ` +
			`(${quoten.ja} zu ${quoten.nein}). Nach dem Reglement dieser Gemeinschaft `
		: `Gleichstand bei den Kopfstimmen (${ja} zu ${nein}). Nach dem Reglement dieser Gemeinschaft `;
	const wer = person === 'verwalter' ? 'der Verwalter' : 'die Person im Vorsitz';
	if (!entscheid && person === 'verwalter') {
		return (
			gleich +
			`entscheidet ${quoten ? 'dann ' : ''}${wer}. Der Entscheid steht noch aus; bis er eingetragen ist, gibt es ` +
			'kein Ergebnis zu verkünden. Votum empfiehlt die Ablehnung: Nach dem Gesetz ist der Beschluss ' +
			'bei Stimmengleichheit nicht gefasst. Ob die Klausel trägt, ist umstritten (SVIT-Kommentar ' +
			'2023, Art. 712m Rz. 187); eine Annahme lässt sich innert Monatsfrist beim Gericht ' +
			'anfechten (ZGB Art. 75). ' +
			WIDERSPRUCH
		);
	}
	if (!entscheid) {
		/*
		 * **Beim Vorsitz hängt die Empfehlung an der Person** (Produktentscheid
		 * 07.10.2026, Fachprüfung F2). Der Stichentscheid des Vorsitzenden ist
		 * nach Rz. 187 ad Art. 712m zulässig. Die Gründe gegen den Verwalter
		 * (kein Stimmrecht, trägt die Folgen nicht, neutrale Rolle) treffen auf
		 * eine Person ohne Eigentum sinngemäss zu, auf eine Eigentümerin nicht;
		 * ihr empfiehlt Votum keine Richtung. Wer im Vorsitz sitzt, weiss Votum
		 * erst mit dem Eintrag, also nennt der Satz beide Fälle.
		 *
		 * **Und den Ausstand** (Fachprüfung F4c): Wer von der Abstimmung
		 * ausgeschlossen ist (ZGB Art. 68, BGE 134 III 481), kann auch nicht
		 * den Ausschlag geben. Der Weg ist ein anderer Vorsitz für dieses
		 * Traktandum; getragen ist der Vorsitzwechsel (Rz. 76a ad Art. 712n),
		 * der Ausschluss vom Stichentscheid ist eine Folgerung, nicht die
		 * Ablehnung.
		 */
		return (
			gleich +
			`entscheidet ${quoten ? 'dann ' : ''}${wer}. Der Entscheid steht noch aus; bis er ` +
			'eingetragen ist, gibt es kein Ergebnis zu verkünden. Ist die Person im Vorsitz selbst ' +
			'Stockwerkeigentümer, entscheidet sie nach dem Reglement; Votum gibt ihr keine Richtung ' +
			'vor und hält fest, was sie entscheidet. Ist sie es nicht, empfiehlt Votum ' +
			'die Ablehnung, weil sie die Folgen des Beschlusses nicht trägt und nach dem Gesetz der ' +
			'Beschluss bei Stimmengleichheit nicht gefasst ist (SVIT-Kommentar 2023, Art. 712m Rz. 187); ' +
			'dann gilt auch: ' +
			WIDERSPRUCH +
			' Ist die Person im Vorsitz bei diesem Geschäft vom Stimmrecht ausgeschlossen, etwa weil ' +
			'es um einen Auftrag an sie selbst geht, kann sie den Stichentscheid nicht geben. Das ist ' +
			'eine Folgerung; getragen ist der Vorsitzwechsel (Rz. 76a ad Art. 712n). Dann bestimmt ' +
			'die Versammlung für dieses Traktandum einen anderen Vorsitz.'
		);
	}
	const als =
		person === 'verwalter'
			? 'als Verwalter'
			: entscheid.eigentuemer
				? 'im Vorsitz, selbst Stockwerkeigentümer,'
				: 'im Vorsitz';
	/*
	 * Der Stichentscheid ändert die Zählung oben nicht; der Satz sagt das, damit
	 * niemand im Protokoll eine Stimme zu viel sucht. **Ohne «zweite Stimme nach
	 * dem Reglement»** (Laienprüfung 07.10.2026, L5 und L8): Ob das Reglement
	 * eine zweite Stimme kennt, weiss Votum nicht; der Haken fragt nur, ob die
	 * Person selbst Eigentümer ist.
	 */
	const zaehlung = entscheid.eigentuemer
		? ' Die Zählung bleibt unverändert; der Stichentscheid ist darin nicht enthalten.'
		: '';
	return (
		gleich +
		`hat ${entscheid.wer} ${als} ${entscheid.wahl === 'yes' ? 'für Annahme' : 'gegen den Antrag'} ` +
		`entschieden${entscheid.begruendung ? `: ${entscheid.begruendung}` : '.'}${zaehlung}`
	);
}

// ── Der Kern ────────────────────────────────────────────────────────────────

/**
 * Zählt aus und hält fest, was ein Ausstand an den Bezugsgrössen geändert hat.
 *
 * Die Zählung selbst steht in `zaehleOhneWirkung`; getrennt, weil
 * `ausstandswirkung` sie zweimal zum Vergleich braucht und sich sonst selbst
 * aufriefe.
 */
export function zaehleAus(lage: Auszaehlungslage): Auszaehlung {
	const a = zaehleOhneWirkung(lage);
	a.ausstandswirkung = ausstandswirkung(lage, a.koepfe.basis, a.quoten.basis);
	const zaehle = (anderes: Erfordernis) => zaehleOhneWirkung({ ...lage, erfordernis: anderes });
	/*
	 * Die Grenze unter «Vollmachten ruhen» (Entscheid 2, 06.11.2026): dieselbe
	 * Lage ohne den Ausstand aus L8, die Stimmen der ruhenden Vertretungen
	 * dazu, je Einheit eine. Der Zeitpunkt der zusätzlichen Stimmen ist der
	 * späteste der erfassten: `letzteStimmen` lässt bei Gleichstand die
	 * spätere Zeile gewinnen, und die zusätzliche steht am Ende, selbst wenn
	 * für die Partei schon eine (ungültige) erfasst wäre.
	 */
	const spaeteste = lage.stimmen.reduce((bisher, s) => (s.castAt > bisher ? s.castAt : bisher), '');
	return mitAndererVerwaltungsvollmacht(
		mitVertretungImAusstand(
			mitFestenVergleichen(
				mitAndererZaehlweise(
					mitAndererAngehoerigenlesart(
						mitAndererAusstandslesart(
							mitAndererKopfzaehlweise(
								mitAndererLesart(a, lage.erfordernis, zaehle, lage.nachRueckkommen),
								lage.erfordernis,
								zaehle
							),
							lage,
							zaehle
						),
						lage,
						zaehle
					),
					lage,
					zaehle
				),
				lage.erfordernis,
				zaehle
			),
			lage,
			() => zaehleOhneWirkung({ ...lage, vertretungImAusstandInDerZahl: true })
		),
		lage,
		(imAusstand) => zaehleOhneWirkung({ ...lage, imAusstand }),
		(imAusstand, ruhend, richtung) =>
			zaehleOhneWirkung({
				...lage,
				imAusstand,
				stimmen: [
					...lage.stimmen,
					...ruhend.flatMap((p) =>
						p.units.map((u) => ({
							partyId: p.partyId,
							unitId: u.unitId,
							choice: richtung,
							castAt: spaeteste,
							recordedByChair: false
						}))
					)
				]
			})
	);
}

/**
 * Was der Ausstand an den Bezugsgrössen geändert hat, als ein Satz mit Zahlen.
 *
 * **Der Anlass** (Befund D-02 vom 22.08.2026, wörtlich: «die Bezugsgrösse
 * springt von 5 auf 4, ohne ein Wort der Erklärung»). Seit Ä-25 sagt
 * `ausstandsmeldung`, die Wirkung hänge vom Erfordernis ab. Das ist richtig und
 * unbestimmt, und das Protokoll, das im Anfechtungsfall gelesen wird, rechnete
 * sie nicht aus (Produktentscheid 24.09.2026, «abarbeiten»; `docs/freigabe.md`,
 * «Die drei entschiedenen Punkte», Punkt 2).
 *
 * **Warum als Vergleich zweier Zählungen und nicht als eigene Rechnung.** Wie
 * der Ausstand wirkt, hängt an der Kopfbasis (nur Anwesende oder alle), an der
 * Quotenbasis, an der Zählweise je Eigentümer oder je Einheit und an Vollmachten,
 * die ruhen, weil der Bevollmächtigte im Ausstand ist. Das alles steht schon in
 * `zaehleOhneWirkung`. Eine zweite Rechnung daneben wäre die zweite Wahrheit,
 * die beim nächsten Umbau auseinanderläuft. Also: dieselbe Lage einmal mit und
 * einmal ohne Ausstand, beide ohne Stimmen, damit allein der Ausstand den
 * Unterschied macht und keine Enthaltung, die aus der Basis fällt.
 *
 * **Die Quoten unter `alle_quoten`** ändern sich nach der Vorgabe von L1 nicht;
 * dort sagt `ausstandshinweis`, warum die Schranke bleibt und ob sie noch
 * erreichbar ist, und nach «fällt heraus», an welcher Zahl sie sich bemisst.
 * Derselbe Satz, nicht ein zweiter Wortlaut.
 *
 * Gerechnet wird mit dem übrigen Ergebnis: bis zum Verkünden bei jedem Lesen,
 * danach steht der Satz mit ihm festgeschrieben (seit 25.09.2026,
 * `domain/festschreibung.ts`). Bei Abstimmungen, die vorher verkündet wurden,
 * wird er weiter beim Lesen gerechnet; dort steht er deshalb auch, wenn sie
 * vor seiner Einführung geschlossen wurden.
 * Der Ausstand, den `ergebnisIn` dafür übergibt, ist seit dem 25.09.2026 der
 * beim Schliessen festgeschriebene (`Durchgangsstand.ausstand`). Vorher war
 * es der jetzige, und ein Ausstand nach dem Schliessen änderte Ergebnis und
 * diesen Satz rückwirkend (Code-Review 24.09.2026 zu dieser Funktion,
 * Befund 3). Für Durchgänge von vorher gilt das weiterhin.
 *
 * **Die Zahl der Parteien steht im Satz**, weil das Tagprotokoll den Ausstand
 * sonst nirgends nennt: «Wegen des Ausstands» hätte dort keinen Bezug.
 */
function ausstandswirkung(
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	kopfbasis: number,
	quotenbasis: number | null
): string | null {
	const ausstandsmenge = parteienImAusstand(lage.imAusstand);
	if (ausstandsmenge.size === 0) return null;
	const e = lage.erfordernis;

	const mit = zaehleOhneWirkung({ ...lage, stimmen: [] });
	// Ohne die Parteien im Ausstand, aber mit den Vertretern: Deren ruhende
	// Vollmachten gehören nicht zur Wirkung, die der Satz den Parteien zuschreibt
	// (Codeprüfung Ä-26, zweiter Durchgang, Befund 2).
	const ohne = zaehleOhneWirkung({
		...lage,
		stimmen: [],
		imAusstand: (lage.imAusstand ?? []).filter((id) => istVertreterkennung(id))
	});

	const wer = `${ausstandsmenge.size} ${ausstandsmenge.size === 1 ? 'Partei' : 'Parteien'}`;
	const saetze: string[] = [];
	const kopfweg = ohne.koepfe.basis - mit.koepfe.basis;
	const zaehlweiseImAusstand = kopfweg <= 0 && ausstandBleibtNachZaehlweise(e);
	const amRueckkommen = lage.rueckkommenAufAnnahme === true || e.titel.startsWith(RUECKKOMMEN_TITEL);
	saetze.push(
		kopfweg > 0
			? `Wegen des Ausstands von ${wer} umfasst die Bezugsgrösse ${kopfbasis} statt ` +
					`${kopfbasis + kopfweg} ${kopfbasis + kopfweg === 1 ? 'Kopfstimme' : 'Kopfstimmen'}.`
			: // Fachprüfung Block C, Nachtrag, N-F-6: unter «Alle Eigentümer» mit dem Grund
				// und der offenen Frage, wie im Katalog (Antwort 9); mit der Zahl der Parteien
				// (Codeprüfung Lauf 2, N-F), am Rückkommen mit dem Bezug auf den Beschluss
				// (Laienprüfung Nachtrag Runde 2, N2-L-04).
				zaehlweiseImAusstand
				? `Wer im Ausstand ist, hier ${wer}, bleibt bei der Zählweise «Alle Eigentümer»` +
					`${amRueckkommen ? ', wie beim ursprünglichen Beschluss,' : ''} in der Zahl aller Eigentümer ` +
					`und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei ${kopfbasis}. ` +
					'Geklärt ist das nicht.'
				: `Der Ausstand von ${wer} ändert die Bezugsgrösse der Kopfstimmen hier nicht.`
	);

	/*
	 * **Auch ohne Quotenschwelle**, solange die Quoten nicht absolut gezählt
	 * werden (Code-Review 24.09.2026 zu `ausstandswirkung`, Befund 1). Unter `keine` steht im
	 * Protokoll trotzdem «Wertquoten: … (von N)», und N sinkt mit dem Ausstand
	 * genauso; die meisten Erfordernisse des Regelwerks haben diese Basis.
	 */
	/*
	 * **Unter «Alle Eigentümer» ohne Wertquoten im Mehr kein Satz dazu**
	 * (Laienprüfung Nachtrag Runde 2, N2-L-04): Neben «bleibt in der Zahl» las
	 * sich die kleinere Zahl der Wertquoten als Widerspruch, und das Mehr zählt
	 * sie nicht.
	 */
	/*
	 * Ebenso unter einer von Hand gesetzten Kopfbasis «aller Eigentümer» ab der
	 * Fassung 2026-11-16 (Codeprüfung Textrunde 0050, G5): Neben «ändert die
	 * Bezugsgrösse der Kopfstimmen hier nicht» läse sich die kleinere Zahl der
	 * Wertquoten genauso als Widerspruch. Der erste Satz bleibt der knappe
	 * (Entscheid 0050, «Variante A»).
	 */
	const unterAllenImAusstand = kopfweg <= 0 && ausstandBleibtUnterAllen(e);
	if (unterAllenImAusstand && !e.quotenSchwelle) return saetze.join(' ');
	if (quotenbasis !== null && e.quotenbasis !== 'alle_quoten') {
		const quotenweg = ohne.quoten.basis - mit.quoten.basis;
		saetze.push(
			quotenweg > 0
				? `Bei den Wertquoten sind es ${quotenbasis} statt ${quotenbasis + quotenweg}.`
				: 'Bei den Wertquoten ändert er sie nicht.'
		);
	} else if (quotenbasis !== null) {
		/*
		 * **Die Schranke in der Protokollfassung** (H3, Fachprüfung 08.10.2026).
		 * `ausstandswirkung` ist der Satz, den nur das Protokoll liest. Seit Ä-27
		 * (18.10.2026) sagen Anzeige und Urkunde dasselbe: Der Satz zur offenen
		 * Frage steht in beiden, «gehört vor die Abstimmung» in keiner.
		 */
		const schranke = ausstandshinweis(e, lage.momentaufnahme, ausstandsmenge, true, ruhendeAusstandsquote(lage));
		if (schranke) saetze.push(schranke);
	}
	return saetze.join(' ');
}

/*
 * **Eine Stelle für beide Zählungen: die Betroffenen, die nicht an den Stimmen
 * hängen** (Block A3c, 26.09.2026). Seit die Handzählung bei den Wertquoten
 * zugelassen ist, brauchen `zaehleOhneWirkung` und `zaehleSummenAus` dieselbe
 * Liste der ausstehenden Zustimmungen. Bei `nachher` hängt sie an keiner
 * Stimme: Jede eingetragene Betroffene steht darin, auch wer im Saal Ja gesagt
 * hat oder im Ausstand ist (Rz. 75, 88 ad 712e). Nachgebaut in der Handzählung
 * wäre sie der fünfte Weg, der von seinem Zwilling abweicht.
 */

/** Wer als betroffen bezeichnet ist, aber nicht im Stimmberechtigtenstand steht. */
function betroffeneAusserhalbDesStands(m: Snapshot, betroffene: readonly Id[]): Id[] {
	return betroffene.filter((id) => !m.parties.some((p) => p.partyId === id));
}

/** Der Hinweis zu einer Betroffenen ausserhalb des Stands, in beiden Zählungen derselbe. */
function nichtImStandInWorten(id: Id): string {
	return (
		`Als betroffen ist eine Partei bezeichnet, die nicht im Stimmberechtigtenstand steht ` +
		`(${id}). Ihre Zustimmung lässt sich nicht prüfen.`
	);
}

/**
 * Die ausstehenden Zustimmungen bei der Form `nachher`: erst die Betroffenen in
 * der Reihenfolge der Momentaufnahme, dann die ausserhalb des Stands als
 * `NICHT_IM_STAND`. Nur aufrufen, wenn die Zustimmung nötig ist.
 */
function ausstehendeZustimmungen(
	m: Snapshot,
	betroffene: readonly Id[]
): { parteiId: Id; name: string }[] {
	const menge = new Set(betroffene);
	return [
		...m.parties
			.filter((p) => menge.has(p.partyId))
			.map((p) => ({ parteiId: p.partyId, name: p.displayName })),
		...betroffeneAusserhalbDesStands(m, betroffene).map((id) => ({
			parteiId: id,
			name: NICHT_IM_STAND
		}))
	];
}

/**
 * Verlangt das Erfordernis die Zustimmung, muss jemand als betroffen
 * bezeichnet sein, in beiden Zählungen. Bei der Handzählung fiel die Lücke
 * sonst still durch: angenommen, und niemandes Unterschrift stünde aus.
 */
function verlangeBezeichneteBetroffene(e: Erfordernis, betroffene: readonly Id[]): void {
	if (e.zustimmungBetroffenerNoetig && betroffene.length === 0) {
		throw new FachlicherFehler(
			'ohne_betroffene',
			'Dieses Erfordernis verlangt die Zustimmung der unmittelbar Betroffenen, es ist aber ' +
				'niemand als betroffen bezeichnet. Die Zuordnung gehört vor die Abstimmung.',
			'betroffene'
		);
	}
}

function zaehleOhneWirkung(lage: Auszaehlungslage): Auszaehlung {
	const { momentaufnahme: m, erfordernis: e } = lage;

	// Die Zählweise dieses Erfordernisses: sonst die der Gemeinschaft, an der
	// Einsprache ab 2026-10-28 die Wahl L3 (`zaehlweiseFuer`).
	const zaehlweise = zaehlweiseFuer(e, m);

	if (e.typ === 'keine_abstimmung') {
		throw new FachlicherFehler(
			'keine_abstimmung',
			'Dieses Traktandum wird zur Kenntnis genommen; es gibt nichts auszuzählen.',
			'erfordernis'
		);
	}
	if (e.typ === 'grenzfall') {
		throw new FachlicherFehler(
			'grenzfall',
			'Beim Grenzfall steht kein Erfordernis fest. Die Sitzungsleitung setzt eines, bevor ' +
				'abgestimmt wird — ein erfundener Wert wäre schlimmer als keiner.',
			'erfordernis'
		);
	}
	if (!e.kopfSchwelle) {
		throw new FachlicherFehler(
			'ohne_schwelle',
			`Das Erfordernis «${e.titel}» nennt keine Kopfschwelle. Ohne sie lässt sich nicht sagen, ` +
				'wann ein Antrag angenommen ist.',
			'erfordernis'
		);
	}

	const betroffene = lage.betroffeneParteiIds ?? [];
	verlangeBezeichneteBetroffene(e, betroffene);

	const anwesend = new Set(lage.anwesende);
	const betroffeneMenge = new Set(betroffene);
	const je = letzteStimmen(lage.stimmen);
	const hinweise: string[] = [];
	const protokollhinweise: Protokollhinweis[] = [];

	/*
	 * Wer bei «alle ausser Betroffene» herausfällt, fällt aus **allen** Eimern.
	 * Sonst summierten sie sich nicht zur Basis, und die Ergebniskarte zeigte
	 * Zahlen, die niemand nachrechnen kann.
	 *
	 * **Der Ausstand wirkt genauso, aber aus einem anderen Grund** (ZGB Art. 68
	 * i.V.m. Art. 712m Abs. 2): Wer in den Ausstand tritt, ist vom Stimmrecht
	 * ausgeschlossen. Er stimmt nicht und fällt aus der Kopfbasis, ausser nach 1e
	 * an der Ausschlussklage (`ausstandInDerZahlBei`). Ihn dort
	 * stehen zu lassen, hiesse, seine Nichtabgabe wie ein Nein zu werten; damit
	 * wäre der Ausstand eine Stimme gegen den Antrag statt keine. Unter
	 * `alle_eigentuemer` und `alle_ausser_betroffene` ist das eine strittige
	 * Entscheidung (bei `imAusstand` oben). Ausgenommen ist die gemeinsame
	 * Wohnung eines Beklagten (`stumm`): Sie bleibt auch im Ausstand in der
	 * Basis (`kommtInDerZaehlungVor`).
	 *
	 * **Bei den Wertquoten hängt es an der Quotenbasis.** Unter
	 * `anwesend_vertreten` fällt seine Quote mit ihm aus den Eimern und damit
	 * aus der Basis. Unter `alle_quoten` steht sie im Eimer `imAusstand`, und
	 * nach der Vorgabe von L1 bleibt die Basis die Gesamtquote
	 * (`quotenbasisWert`); nach «fällt heraus» sinkt sie um die Quote im
	 * Ausstand (`ausstandsabzug`, `ausstandshinweis`). Bis zum 16.10.2026 stand hier «er zählt nicht
	 * mit» ohne diese Unterscheidung (Erhebung zur Freigabe, Ä-25).
	 *
	 * **Für die Beschlussfähigkeit zählt er weiter als anwesend.** Sie liest die
	 * Anwesenheit, nicht den Ausstand (`server/beschlussfaehigkeit.ts`;
	 * Wermelinger Rz. 17 ad Art. 712p). Probe in `tests/db/ausstand.test.ts`.
	 */
	const ausstandsmenge = parteienImAusstand(lage.imAusstand);
	const alleBeklagt = new Set(lage.alleEigentuemerBeklagt ?? []);
	const stumm = stummeBeklagtenwohnungen(m, e, betroffeneMenge, alleBeklagt);
	const beklagtenwohnungen = beklagtenwohnungenIn(m, e, betroffeneMenge, alleBeklagt);
	const ausstandInDerZahl = ausstandInDerZahlBei(e, ausstandsmenge, betroffeneMenge);
	const ausstandAusNenner = ausstandsabzug(lage) > 0;
	const imBlick = m.parties.filter((p) =>
		kommtInDerZaehlungVor(p.partyId, e, ausstandsmenge, betroffeneMenge, stumm, ausstandInDerZahl)
	);
	for (const p of imBlick) {
		if (stumm.has(p.partyId)) hinweise.push(beklagtenwohnungInWorten(p.displayName));
	}
	for (const p of ganzBeklagteWohnungen(m, e, betroffeneMenge, alleBeklagt)) {
		hinweise.push(ganzBeklagtInWorten(p.displayName));
	}

	for (const p of m.parties) {
		if (!ausstandsmenge.has(p.partyId)) continue;
		hinweise.push(ausstandsmeldung([p.displayName]));
	}

	/*
	 * **Der Beklagte unter einer anderen Bezugsgrösse** (29.09.2026, Codeprüfung
	 * M-1). Unter `alle_ausser_betroffene` sagt die Bezugsgrösse selbst, wer
	 * herausfällt. Unter einer Klausel «der Anwesenden» oder einer von Hand
	 * gewählten Basis fehlte er im Ergebnis und im Protokoll, ohne dass ein
	 * Wort dazu stand.
	 */
	if (betroffeneStimmenNichtMit(e) && e.kopfbasis !== 'alle_ausser_betroffene') {
		for (const p of m.parties) {
			// Die gemeinsame Wohnung des Beklagten zählt mit; ihr Satz steht oben.
			if (!betroffeneMenge.has(p.partyId) || ausstandsmenge.has(p.partyId) || stumm.has(p.partyId))
				continue;
			hinweise.push(
				// An der Einsprache (ab Fassung 2026-10-20) ohne Beklagten und mit
				// ihrer Norm: Wer verkauft, vermietet oder belastet, stimmt nicht mit.
				e.knotenId === EINSPRACHE_KNOTEN
					? `«${p.displayName}» ist als betroffen eingetragen und zählt hier nicht mit: Wer ` +
							'verkauft, vermietet oder belastet, stimmt über die Einsprache nicht mit ' +
							'(ZGB Art. 712c Abs. 2).'
					: `«${p.displayName}» ist als Beklagter bezeichnet und zählt hier nicht mit, auch wenn ` +
							'die Bezugsgrösse ihn nicht eigens ausnimmt (ZGB Art. 649b Abs. 2).'
			);
			protokollhinweise.push({
				ort: 'bezugsgroesse',
				satz: beklagterAndereBasisProtokollInWorten(p.displayName, e.knotenId)
			});
		}
	}

	// Wer ausgeschlossen ist, kann niemanden vertreten: Regel und Beleg stehen
	// bei `ruhendeVertretungenBei`. Seit dem 25.09.2026 gilt das auch für den
	// Beklagten bei der Ausschlussklage, nicht nur für den Ausstand; seit dem
	// 27.09.2026 nicht mehr für Betroffene, die nur ein Reglement ausnimmt.
	const vertretungsnamen = new Map(m.parties.map((p) => [p.partyId, p.displayName]));
	const name = (id: Id) => vertretungsnamen.get(id) ?? id;
	const ruhendeVertretungen = ruhendeVertretungenBei(
		lage.vertretungen ?? [],
		vomStimmrechtAusgeschlossen(e, lage.imAusstand ?? [], betroffene),
		anwesend
	);
	// L8 (Migration 184): Für Vertretungen, die aus der Einstellung der
	// Gemeinschaft ruhen, ersetzt eine Zeile für alle die je Partei
	// formulierte (Entscheid 3, 06.11.2026); das Protokoll trägt kein zweites
	// Ergebnis dazu. Nur wo sie wirksam geruht haben: Unter «Die
	// Sitzungsleitung entscheidet» steht die Kennung nicht im Ausstand, die
	// Vertretung ruht nicht, und die Zeile entsteht gar nicht.
	const ruhenAusVerwaltung: string[] = [];
	for (const r of ruhendeVertretungen.values()) {
		const ueber = r.bevollmaechtigtName ?? name(r.bevollmaechtigtId);
		// L8 (Lauf 4, 07.11.2026): Der Satz zur Anzeige nennt die Einstellung
		// der Gemeinschaft, wo das Ruhen aus ihr folgt, und nicht den Satz zum
		// erklärten Ausstand mit BGE 134 III 481 E. 3.8.
		const ausVerwaltung = (lage.ausstandAusVerwaltung ?? []).includes(r.bevollmaechtigtId);
		hinweise.push(ruhendInWorten(name(r.vertreteneId), ueber, r.grund, e.knotenId, ausVerwaltung));
		if (ausVerwaltung) {
			ruhenAusVerwaltung.push(name(r.vertreteneId));
			continue;
		}
		protokollhinweise.push({
			ort: 'bezugsgroesse',
			satz: ruhendProtokollInWorten(
				name(r.vertreteneId),
				ueber,
				r.grund === 'betroffen' && e.knotenId === EINSPRACHE_KNOTEN
			)
		});
	}
	if (ruhenAusVerwaltung.length > 0) {
		protokollhinweise.push(verwaltungsruhenProtokollhinweis(ruhenAusVerwaltung));
	}

	/*
	 * **Bei der Einstimmigkeit sagen die Quellen nicht dasselbe**, und die
	 * Ergebniskarte trägt den Wortlaut der einen. Deshalb steht hier, was
	 * gerechnet wurde:
	 *
	 *   - Beobachter, «Stockwerkeigentum», S. 147: nötig ist die Zustimmung
	 *     «sämtlicher **stimmberechtigter** Eigentümer der Gemeinschaft». Wer im
	 *     Ausstand ist, ist für dieses Geschäft nicht stimmberechtigt — er fällt
	 *     also aus der Bezugsgrösse. So rechnet diese Anwendung.
	 *   - WISS-Skript «Stockwerkeigentum» (2021), Ziff. 12.8.3: nötig ist die
	 *     Zustimmung «sämtlicher **im Grundbuch aufgeführter** Eigentümer». Danach
	 *     bliebe er darin, und der Beschluss käme nie zustande.
	 *
	 * Für die hier gewählte Lesart spricht, dass das Gesetz dieselbe Ausnahme
	 * selbst kennt: Die Ermächtigung zur Ausschlussklage verlangt einen
	 * «Mehrheitsbeschluss aller Miteigentümer mit Ausnahme des Beklagten»
	 * (ZGB Art. 649b Abs. 2; BGer 5A_735/2019 E. 3.3.1). Bis zum 25.09.2026 stand
	 * hier «einstimmig … mit Ausnahme der auszuschliessenden Person», was weder
	 * im Gesetz noch im Entscheid steht (Fachprüfung 25.09.2026, B6).
	 * Entschieden ist die Frage damit nicht; sie steht bei jedem betroffenen
	 * Beschluss auf der Karte (bis zum 16.11.2026 «auf der Liste der
	 * juristischen Gegenlesung», die nach Entscheid 0052 entfällt).
	 *
	 * **Nur, wo jemand im Ausstand aus der Zahl fällt** (Pendenz aus Block 6,
	 * 30.10.2026). Stellt die Leitung die Ausschlussklage auf «alle Eigentümer»,
	 * bleiben die Angehörigen nach 1e in der Zahl, und der Beklagte zählt dort
	 * ohnehin nicht mit; der Satz erschien trotzdem bei jedem Ausstand.
	 */
	const ohneStimmeImAusstand = betroffeneStimmenNichtMit(e);
	const ausgetreten = [...ausstandsmenge].some(
		(id) => !ausstandInDerZahl.has(id) && !(ohneStimmeImAusstand && betroffeneMenge.has(id))
	);
	// A5, Punkt 12c: nur bei Einstimmigkeit von Einstimmigkeit sprechen. Beide
	// Sätze, der zur Einstimmigkeit und der zu einem anderen Mehr aller
	// Eigentümer, stehen unten, wenn das Ergebnis feststeht.

	const koepfe = leererSpiegel();
	const quoten = leererSpiegel();
	const ohneZustimmung: FehlendeZustimmung[] = [];
	const betroffenenbefund: Betroffenenbefund = {
		noetig: e.zustimmungBetroffenerNoetig,
		form: betroffenenzustimmungVon(e),
		zugestimmt: [],
		fehlend: [],
		vorab: [],
		ausstehend: [],
		veto: [],
		erfuellt: true
	};
	const vorabMenge = new Set(lage.vorabZustimmungen ?? []);
	/*
	 * Der letzte Veto-Entscheid je Partei. Die Liste kommt je Partei höchstens
	 * einmal, aber wer zwei Entscheide liefert (etwa eine Berichtigung), soll
	 * nicht davon abhängen, in welcher Reihenfolge sie ankommt: Es gilt der
	 * letzte Eintrag, wie bei der Stimme die jüngste Äusserung.
	 */
	const vetoMenge = new Map<Id, VetoEntscheid>();
	for (const v of lage.vetoEntscheide ?? []) vetoMenge.set(v.parteiId, v);

	for (const p of imBlick) {
		/*
		 * **Im Ausstand, aber in der Zahl** (1e, ab Fassung 2026-10-25): Die
		 * Partei stimmt nicht, eine erfasste Stimme zählt nicht, und sie steht in
		 * ihrem eigenen Eimer. Die Zustimmungsliste lässt sie aus wie die
		 * gemeinsame Wohnung des Beklagten; ihr Ausstand steht schon oben.
		 */
		if (ausstandInDerZahl.has(p.partyId)) {
			const gewicht = kopfgewicht(p, zaehlweise, m.parkingCountsAsHead);
			koepfe.imAusstand = (koepfe.imAusstand ?? 0) + gewicht;
			/*
			 * **Nicht, wo die Quote nach L1 «fällt heraus» den Nenner verlassen hat**
			 * (Codeprüfung Block C, H1, gemessen mit dem Nachrechner): Unter L13
			 * «Alle Eigentümer» trifft der Ausstand in der Zahl erstmals auf das Mehr
			 * aller Wertquoten mit L1. Sonst ergäben die Eimer mehr als die Basis.
			 * An der Ausschlussklage wirkt L1 nicht; dort ändert sich nichts.
			 */
			if (!(e.quotenbasis === 'alle_quoten' && ausstandAusNenner)) {
				quoten.imAusstand = (quoten.imAusstand ?? 0) + p.units.reduce((q, u) => q + u.quota, 0);
			}
			continue;
		}
		const ruht = ruhendeVertretungen.get(p.partyId);
		const still = stumm.has(p.partyId);
		// B3 (F4c): In der zweiten Rechnung ist die Partei eines Vertreters im
		// Ausstand da, ohne Stimme; sie zählt wie jemand, der nicht abgibt.
		const ruhtWirksam = ruht && !(lage.vertretungImAusstandInDerZahl && ruht.grund === 'ausstand');
		const da = anwesend.has(p.partyId) && !ruhtWirksam && !still;
		// Eine Stimme, die der Vertreter im Ausstand für sie erfasst hat, ist auch
		// hier ungültig (BGE 134 III 481 E. 3.9): ohne Abgabe, nicht Ja oder Nein
		// (Fachprüfung F4c Block 3, N-1).
		const ohneStimme = ruht !== undefined && !ruhtWirksam;
		const wahl = ohneStimme ? undefined : kopfwahl(p, je);

		if (still && wahl !== undefined) {
			hinweise.push(
				`Für «${p.displayName}» wurde eine Stimme erfasst. Sie zählt nicht, weil die Wohnung hier ` +
					'nicht abstimmt.'
			);
			protokollhinweise.push({
				ort: 'ausgang',
				satz: stimmeNichtGezaehltProtokollInWorten(p.displayName)
			});
		}

		// Eine Stimme, die niemand mehr ausüben durfte, fällt unten stillschweigend
		// in den Eimer der Abwesenden. Stillschweigend ist hier das Falsche: Auf dem
		// Bildschirm stand ein Ja, und in der Rechnung taucht es nicht auf.
		if (ruht && wahl !== undefined) {
			hinweise.push(
				`Für «${p.displayName}» liegt eine Stimme vor, die ${ruht.bevollmaechtigtName ?? name(ruht.bevollmaechtigtId)} ` +
					'abgegeben hat. Sie ist bei diesem Traktandum nicht gezählt.'
			);
			protokollhinweise.push({
				ort: 'ausgang',
				satz: stimmeNichtGezaehltProtokollInWorten(
					p.displayName,
					ruht.bevollmaechtigtName ?? name(ruht.bevollmaechtigtId)
				)
			});
		}

		// ── Köpfe ──────────────────────────────────────────────────────────
		const gewicht = kopfgewicht(p, zaehlweise, m.parkingCountsAsHead);

		if (still) {
			koepfe.stimmtNicht = (koepfe.stimmtNicht ?? 0) + gewicht;
		} else if (!da) {
			koepfe.nichtAnwesend += gewicht;
		} else if (zaehlweise === 'per_owner') {
			if (wahl === undefined || wahl === 'uneinheitlich') {
				lege(koepfe, 'ohne_abgabe', gewicht);
				if (wahl === 'uneinheitlich') {
					hinweise.push(
						`«${p.displayName}» hat je Einheit verschieden gestimmt. Bei der Zählung je ` +
							'Eigentümer lässt sich daraus keine Kopfstimme bilden; die Wertquoten sind ' +
							'aufgeteilt gezählt.'
					);
					// Nicht bei geheimer Abstimmung: Der Satz sagt, wie die Partei
					// gestimmt hat (Ä-38, Sicherheitsprüfung 16.10.2026).
					if (lage.geheim !== true) {
						protokollhinweise.push({
							ort: 'bezugsgroesse',
							satz: uneinheitlichProtokollInWorten(p.displayName)
						});
					}
				}
			} else {
				lege(koepfe, wahl, gewicht);
			}
		} else {
			// Je Einheit: Jede kopfstimmentragende Einheit landet in ihrem eigenen
			// Eimer, denn sie kann verschieden gestimmt haben.
			for (const u of p.units) {
				if (!traegtKopfstimme(u, m.parkingCountsAsHead)) continue;
				const s = ohneStimme ? undefined : je.get(u.unitId);
				lege(koepfe, s ? s.choice : 'ohne_abgabe', 1);
			}
		}

		// ── Wertquoten ─────────────────────────────────────────────────────
		//
		// Immer je Einheit, in beiden Zählweisen: Die Quote hängt an der Einheit,
		// nicht an der Person.
		for (const u of p.units) {
			if (still) {
				quoten.stimmtNicht = (quoten.stimmtNicht ?? 0) + u.quota;
				continue;
			}
			if (!da) {
				quoten.nichtAnwesend += u.quota;
				continue;
			}
			const s = ohneStimme ? undefined : je.get(u.unitId);
			lege(quoten, s ? s.choice : 'ohne_abgabe', u.quota);
		}

		// ── Wer nicht zugestimmt hat ───────────────────────────────────────
		const grund: Nichtzustimmungsgrund | null = !da
			? ruht
				? 'vertretung_ruht'
				: 'nicht_anwesend'
			: wahl === undefined
				? 'ohne_abgabe'
				: wahl === 'uneinheitlich'
					? 'uneinheitlich'
					: wahl === 'yes'
						? null
						: wahl === 'no'
							? 'nein'
							: 'enthaltung';

		// Die Wohnung des Beklagten zählt nur in der Basis; zustimmen kann sie nicht.
		if (grund && !still) ohneZustimmung.push({ parteiId: p.partyId, name: p.displayName, grund });
	}

	/*
	 * **Der Betroffenenbefund läuft über ALLE Parteien, nicht über `imBlick`**
	 * (25.09.2026). `imBlick` lässt weg, wer im Ausstand ist und, unter
	 * `alle_ausser_betroffene`, die Betroffenen selbst. Ein Erfordernis, das
	 * beides zugleich trägt (eine gespeicherte Kombination, die
	 * `pruefeRegelwerk` für Knoten ausschliesst, die eine Reglementsregel aber
	 * herstellen konnte, Teil C `4a4fc89`), verlor den Betroffenen damit
	 * vollständig: Er stimmte Nein, und der Befund lautete «erfüllt».
	 *
	 * Die **Zählung** bleibt bei `imBlick`; nur der Zustimmungsbefund sieht
	 * mehr. Und er sieht je Form anders (Fachprüfung 25.09.2026):
	 *
	 *   - `im_saal_oder_vorab`: Ja im Saal, selbst oder vertreten, oder ein
	 *     Vorab-Vermerk ohne späteres Nein. Enthaltung, Nichtabgabe und
	 *     Abwesenheit sind keine Zustimmung.
	 *   - `nachher`: Die Zustimmung ist nicht Teil der Annahme; alle
	 *     Betroffenen stehen als ausstehend, ein Ja im Saal zusätzlich als
	 *     zugestimmt. Nein, Enthaltung und Abwesenheit ändern die Annahme
	 *     nicht; deshalb bleibt `fehlend` hier leer.
	 */
	if (e.zustimmungBetroffenerNoetig) {
		/**
		 * Ob eine der letzten Stimmen dieser Partei ein **gezähltes** Nein war.
		 * Nur wer da ist, widerruft: Die Stimme einer ruhenden Vertretung oder
		 * einer nicht als anwesend festgeschriebenen Partei fällt in der Zählung
		 * weg und darf auch den Vorab-Vermerk nicht widerrufen.
		 */
		const hatNein = (p: (typeof m.parties)[number], da: boolean) =>
			da && p.units.some((u) => je.get(u.unitId)?.choice === 'no');

		for (const p of m.parties) {
			if (!betroffeneMenge.has(p.partyId)) continue;

			/*
			 * **Im Ausstand und betroffen: kein Widerspruch mehr** (Produktentscheid
			 * 26.09.2026, Lesart B). Bis dahin galt beides zusammen als Widerspruch,
			 * die Zustimmung als fehlend, auch mit Vorab-Vermerk, und die Leitung
			 * sollte eine Bezeichnung zurücknehmen. Die Fachprüfung zu Block A2
			 * hielt das für nicht belegt und im Entschädigungsfall für zu streng:
			 * Die Zustimmung ist «ein materielles Vetorecht (formell ein
			 * Zustimmungserfordernis)» (SVIT-Kommentar 2023, Art. 712g Rz. 207;
			 * ebenso Rz. 164b ad Art. 712m), also keine Stimme. **Wann es einen
			 * Ausstand überhaupt gibt**, steht nicht hier: Nach Rz. 144 ad Art. 712m
			 * nicht bei einer blossen Reglementsänderung, wohl aber, wenn ein Vertrag
			 * mit der Gemeinschaft dazukommt, etwa eine vereinbarte Entschädigung
			 * (Folgerung, keine ausdrückliche Stelle). Der Hinweis unten sagt das der
			 * Leitung, statt die Doppelbezeichnung als normal zu bestätigen
			 * (Fachprüfung 26.09.2026).
			 *
			 * **Was zählt:** die Zustimmung, die keine Stimmabgabe ist — eine
			 * schriftliche vor der Versammlung (Rz. 209), die die Sitzungsleitung
			 * vermerkt, oder ein **Veto-Entscheid** während der Abstimmung, am
			 * Telefon oder mündlich (Produktentscheide 26.09.2026,
			 * `lage.vetoEntscheide`). **Was nicht:** eine Stimme. Der Ausstand
			 * sperrt sie, und ob eine Zustimmung im Saal trotz Ausstand geht, ist
			 * nicht belegt (`quellen`, Offen-Liste); der Veto-Entscheid ersetzt
			 * sie und bleibt selbst eine Nicht-Stimme. Ein Nein im Saal gibt es
			 * für sie deshalb auch nicht, ein Vorab-Vermerk bleibt ohne
			 * Veto-Entscheid stehen. Bei `nachher` steht sie wie alle Betroffenen
			 * unter `ausstehend`; einen Veto-Entscheid gibt es dort nicht.
			 *
			 * **Der Zweig selbst bleibt der teuerste stille Fehler dieser Datei,
			 * wenn er fehlt:** Wer im Ausstand ist, steht in keinem Eimer. Ohne ihn
			 * wäre sie weder zustimmend noch fehlend, und bei `im_saal_oder_vorab`
			 * sähe der Beschluss angenommen aus, ohne Vermerk und ohne Stimme (so bis
			 * zum 13.08.2026).
			 */
			if (ausstandsmenge.has(p.partyId)) {
				const veto = vetoMenge.get(p.partyId);
				if (betroffenenbefund.form === 'nachher') {
					// `ausstehend` bildet `ausstehendeZustimmungen` nach der Schleife.
					hinweise.push(
						`«${p.displayName}» ist im Ausstand und als unmittelbar betroffen bezeichnet. Im ` +
							'Ausstand stimmt sie nicht mit; ihre Unterschrift auf der Abänderungsurkunde ' +
							'braucht es trotzdem (ZGB Art. 712e Abs. 2).'
					);
				} else {
					if (veto) {
						betroffenenbefund.veto.push({
							parteiId: p.partyId,
							name: p.displayName,
							entscheid: veto.entscheid,
							weg: veto.weg,
							durchVertretung: veto.durchVertretung
						});
					}
					if (veto?.entscheid === 'ja') {
						betroffenenbefund.zugestimmt.push(p.partyId);
						// Ein Vermerk bleibt ein eigener Beleg, auch wenn das Veto
						// zugestimmt hat.
						if (vorabMenge.has(p.partyId)) betroffenenbefund.vorab.push(p.partyId);
					} else if (veto?.entscheid === 'nein') {
						/*
						 * Die jüngste Äusserung gilt: Ein Veto-Nein widerruft den
						 * Vorab-Vermerk wie ein Nein im Saal. Ohne Vermerk ist es der
						 * eigene Grund `veto_nein` — dort fehlt kein Entscheid, er
						 * lautet Nein.
						 */
						betroffenenbefund.fehlend.push({
							parteiId: p.partyId,
							name: p.displayName,
							grund: vorabMenge.has(p.partyId) ? 'widerrufen' : 'veto_nein'
						});
					} else if (vorabMenge.has(p.partyId)) {
						betroffenenbefund.zugestimmt.push(p.partyId);
						betroffenenbefund.vorab.push(p.partyId);
					} else {
						betroffenenbefund.fehlend.push({
							parteiId: p.partyId,
							name: p.displayName,
							grund: 'im_ausstand'
						});
					}
					hinweise.push(
						`«${p.displayName}» ist im Ausstand und als unmittelbar betroffen bezeichnet. Im ` +
							'Ausstand stimmt sie bei der Mehrheit nicht mit. Ihre Zustimmung ist aber keine Stimme, ' +
							'sondern eine eigene Voraussetzung (ZGB Art. 712g Abs. 4). Die Auswertung zählt sie, ' +
							'wenn vor der Abstimmung schriftlich zugestimmt wurde und die Sitzungsleitung das ' +
							'vermerkt. Sie zählt auch einen Entscheid während der Abstimmung, am eigenen ' +
							'Gerät oder mündlich, von der Sitzungsleitung erfasst. Einen Ausstand gibt es hier nur, wenn mit der Änderung ein Geschäft mit ' +
							'der Gemeinschaft verbunden ist, etwa eine vereinbarte Entschädigung. Ebenso, wenn ' +
							'über die Sache schon ein Gerichtsverfahren läuft oder das Reglement ihn vorsieht. ' +
							'Bei einer blossen Änderung des Reglements gibt es ihn in der Regel nicht.'
					);
				}
				continue;
			}

			const ruht = ruhendeVertretungen.get(p.partyId);
			const da = anwesend.has(p.partyId) && !ruht;
			const wahl = kopfwahl(p, je);
			const grund: Nichtzustimmungsgrund | null = !da
				? ruht
					? 'vertretung_ruht'
					: 'nicht_anwesend'
				: wahl === undefined
					? 'ohne_abgabe'
					: wahl === 'uneinheitlich'
						? 'uneinheitlich'
						: wahl === 'yes'
							? null
							: wahl === 'no'
								? 'nein'
								: 'enthaltung';

			if (betroffenenbefund.form === 'nachher') {
				if (grund === null) betroffenenbefund.zugestimmt.push(p.partyId);
				else if (grund === 'nein') {
					/*
					 * **Der Satz aus der Quellenprüfung** (Anhang S3): erst die
					 * Ablehnung im Saal, dann die fehlende Unterschrift. Die
					 * Fassung davor begann mit «Die Genehmigung hängt nicht
					 * davon ab»; die Laienprüfung nannte das abschreckend und
					 * doppeldeutig.
					 */
					hinweise.push(
						`«${p.displayName}» ist unmittelbar betroffen und hat im Saal Nein gesagt. Ohne ` +
							'die Unterschrift dieser Partei auf der Abänderungsurkunde ändern sich die ' +
							'Wertquoten nicht, auch wenn die Versammlung die Änderung genehmigt hat ' +
							'(ZGB Art. 712e Abs. 2).'
					);
				}
				// Bei `nachher` steht jede Zustimmung aus, auch die im Saal
				// erteilte: Sie wird erst mit der Urkunde verbindlich. Die Liste
				// bildet `ausstehendeZustimmungen` nach der Schleife, dieselbe
				// Funktion wie bei der Handzählung.
			} else {
				/*
				 * **Das ist der ganze Punkt der Bestimmung:** Wer betroffen
				 * ist, muss ausdrücklich zustimmen, im Saal (selbst oder
				 * vertreten) oder vorab schriftlich (ZGB Art. 712g Abs. 4).
				 * Enthaltung, Nichtabgabe und Abwesenheit sind keine
				 * Zustimmung. Die jüngste Äusserung gilt: Ein Nein im Saal
				 * widerruft den Vorab-Vermerk; Enthaltung und Nichtabgabe tun
				 * es nicht, sie sind keine Äusserung.
				 */
				const vorab = vorabMenge.has(p.partyId);
				/*
				 * **Geheim: nur die offene Erklärung zählt** (Ä-38, Fachprüfung
				 * 16.10.2026 mit Rz. 209 ad Art. 712g und Pflichtpunkt 7 vom
				 * 28.09.2026; Produktentscheid 16.10.2026: im Protokoll steht bei
				 * geheimer Abstimmung kein Stimmverhalten). Die Betroffenen
				 * stimmen offen zu, vorab schriftlich oder im Saal vor dem
				 * Eröffnen, und die Sitzungsleitung vermerkt es. Die geheime
				 * Stimme gibt keine Zustimmung und widerruft keine: Sonst verriete
				 * der Name im Protokoll, wie die Partei gestimmt hat.
				 */
				if (lage.geheim === true) {
					if (vorab) {
						betroffenenbefund.zugestimmt.push(p.partyId);
						betroffenenbefund.vorab.push(p.partyId);
					} else {
						/*
						 * Wer nicht da war, behält den Grund: Anwesenheit ist kein
						 * Geheimnis, und «nicht offen erklärt» legte nahe, die Partei
						 * habe abgestimmt (Codeprüfung 16.10.2026, N1).
						 */
						betroffenenbefund.fehlend.push({
							parteiId: p.partyId,
							name: p.displayName,
							grund: da ? 'nicht_offen' : (grund ?? 'nicht_anwesend')
						});
					}
					continue;
				}
				if (grund === null) {
					betroffenenbefund.zugestimmt.push(p.partyId);
				} else if (vorab && !hatNein(p, da)) {
					betroffenenbefund.zugestimmt.push(p.partyId);
				} else if (vorab) {
					betroffenenbefund.fehlend.push({
						parteiId: p.partyId,
						name: p.displayName,
						grund: 'widerrufen'
					});
				} else {
					betroffenenbefund.fehlend.push({
						parteiId: p.partyId,
						name: p.displayName,
						grund
					});
				}
				if (vorab && betroffenenbefund.zugestimmt.includes(p.partyId)) {
					betroffenenbefund.vorab.push(p.partyId);
				}
			}
		}
	}

	// Ein Betroffener, der nicht in der Momentaufnahme steht, darf nicht still
	// durchgehen: Er wäre sonst weder zustimmend noch fehlend.
	for (const id of betroffeneAusserhalbDesStands(m, betroffene)) {
		hinweise.push(nichtImStandInWorten(id));
		// Bei `nachher` steht auch diese Zustimmung aus; sie lässt sich nur
		// nicht prüfen, und `fehlend` bleibt dort leer. Die Zeile dafür bildet
		// `ausstehendeZustimmungen`.
		if (betroffenenbefund.form !== 'nachher') {
			betroffenenbefund.fehlend.push({
				parteiId: id,
				name: NICHT_IM_STAND,
				grund: 'nicht_anwesend'
			});
		}
	}
	if (e.zustimmungBetroffenerNoetig && betroffenenbefund.form === 'nachher') {
		betroffenenbefund.ausstehend = ausstehendeZustimmungen(m, betroffene);
	}
	betroffenenbefund.erfuellt =
		!e.zustimmungBetroffenerNoetig ||
		// Bei `nachher` entscheidet die Mehrheit allein; die Zustimmung kommt
		// mit der Urkunde und ist keine Bedingung der Annahme.
		betroffenenbefund.form === 'nachher' ||
		betroffenenbefund.fehlend.length === 0;

	// ── Bezugsgrössen und Schwellen ────────────────────────────────────────
	//
	// Die abgegebenen Quoten werden vor der Kopfschwelle festgehalten: Der
	// Stichentscheid vergleicht sie, und die Bezugsgrösse der Quoten kann je nach
	// Erfordernis eine ganz andere sein (die Gesamtquote etwa).
	const quotenJa = quoten.ja;
	const quotenNein = quoten.nein;

	/*
	 * **Die Enthaltung fällt nur aus einer Basis, die aus abgegebenen Stimmen
	 * entsteht** (04.09.2026).
	 *
	 * Manche Reglemente nehmen Enthaltungen aus der Bezugsgrösse heraus, damit
	 * sie nicht gegen den Antrag wirken. Das trifft die Basis der Anwesenden und
	 * Vertretenen. Es trifft **nicht** eine Basis, die alle Eigentümer umfasst:
	 * Dort ist die Bezugsgrösse eine Eigenschaft der Gemeinschaft und nicht des
	 * Abstimmungsverhaltens, und wer sich enthält, hört nicht auf, Eigentümer zu
	 * sein. Das ist zugleich die strengere Lesart, wie sonst im Haus.
	 *
	 * `undefined` heisst «zählt mit»: So wurde immer gerechnet, und so wird ein
	 * Traktandum von damals auch heute nachgerechnet.
	 */
	const enthaltungAusBasis =
		e.enthaltungZaehltMit === false && !abwesendeZaehlenMit(e.kopfbasis);

	koepfe.basis =
		koepfe.ja +
		koepfe.nein +
		(enthaltungAusBasis ? 0 : koepfe.enthaltung) +
		koepfe.ohneAbgabe +
		(abwesendeZaehlenMit(e.kopfbasis)
			? koepfe.nichtAnwesend + (koepfe.stimmtNicht ?? 0) + (koepfe.imAusstand ?? 0)
			: 0);

	// Eine leere Basis nimmt nichts an. `schwelle(0, …)` gäbe null zurück, und
	// «ja >= 0» wäre bei niemandem im Saal erfüllt — ein Beschluss ohne
	// Beschliessende.
	koepfe.schwelle = koepfe.basis > 0 ? schwellenwert(koepfe.basis, e.kopfSchwelle) : null;
	koepfe.erreicht = koepfe.schwelle !== null && koepfe.ja >= koepfe.schwelle;

	// ── Stichentscheid bei Stimmengleichheit ───────────────────────────────
	//
	// Nur wo das Reglement es vorsieht, und nur beim **echten** Gleichstand:
	// gleich viele Ja wie Nein **und** so viele Ja wie die halbe Bezugsgrösse.
	// Die zweite Bedingung ist seit dem 27.09.2026 gebaut: Zählten Enthaltungen
	// oder Nichtabgaben in der Bezugsgrösse mit, hob die frühere Fassung ein
	// verfehltes Mehr auf «angenommen» (3 Ja, 3 Nein, 2 Enthaltungen, Basis 8).
	// Der Stichentscheid löst ein Patt auf, er schafft keine Mehrheit
	// (Rz. 181 f. ad Art. 712m). Die zweite Bedingung allein genügt nicht:
	// 4 Ja, 2 Nein, 2 Enthaltungen sind kein Patt, sondern eine Mehrheit.
	//
	// Die Einstimmigkeit bleibt aussen vor: Dort geht es nicht um eine Mehrheit,
	// die sich gleich verteilen könnte, sondern um die Zustimmung aller. Ein
	// Stichentscheid ersetzte dort eine fehlende Zustimmung, und das kann keine
	// Reglementsbestimmung wollen.
	const gleichstand =
		m.tieBreak !== 'keiner' &&
		!koepfe.erreicht &&
		e.typ !== 'einstimmigkeit' &&
		stichentscheidMoeglich(e) &&
		koepfe.ja > 0 &&
		koepfe.ja === koepfe.nein &&
		koepfe.ja * 2 === koepfe.basis;

	let durchStichentscheid = false;
	/**
	 * Wahr, solange ein Gleichstand nach dem Reglement von einer **Person** zu
	 * entscheiden ist und dieser Entscheid noch nicht vorliegt.
	 *
	 * Der Unterschied zum Quotenstichentscheid ist grundsätzlich: Die
	 * Anteilsberechtigung steht in der Momentaufnahme, der Wille des Verwalters
	 * nicht. Ihn zu erraten wäre die schlimmste denkbare Antwort — die Anwendung
	 * verkündete ein Ergebnis, das niemand gefällt hat. Also hält sie an.
	 *
	 * **Für den Verwalter gilt das wieder** (Produktentscheid 28.09.2026): Die
	 * Klausel wird angewandt, der Entscheid eingetragen, und bis dahin ist
	 * nichts entschieden.
	 */
	let stichentscheidOffen = false;

	/*
	 * **Die Stufen der Regel** (Auftrag 07.10.2026). Erst die Wertquoten, wo das
	 * Reglement sie vorsieht; sind sie auf beiden Seiten gleich und benennt das
	 * Reglement danach eine Person, entscheidet diese. Ohne zweite Stufe bleibt
	 * es bei gleichen Quoten bei der Ablehnung wie bisher.
	 */
	const person = personenstufe(m.tieBreak);
	const quotenGleich = quotenstufe(m.tieBreak) && quotenJa === quotenNein;
	let stichentscheidArt: 'wertquote' | 'verwalter' | 'vorsitz' | null = null;
	/** Wo die Sätze zum Stichentscheid für den Antrag stehen, falls danach doch abgelehnt wird. */
	let quotenstichentscheidJa: {
		hinweis: number;
		protokoll: number;
		kopfJa: number;
		kopfNein: number;
		quotenJa: number;
		quotenNein: number;
	} | null = null;

	if (gleichstand && quotenstufe(m.tieBreak) && !(quotenGleich && person)) {
		stichentscheidArt = 'wertquote';
		// Auf den Quoten der abgegebenen Stimmen, nicht auf der Bezugsgrösse des
		// Erfordernisses: Verglichen wird, welche Seite mehr Anteile hinter sich
		// hat — Enthaltungen und Abwesende stehen auf keiner der beiden Seiten.
		if (quotenJa > quotenNein) {
			koepfe.erreicht = true;
			durchStichentscheid = true;
			quotenstichentscheidJa = {
				hinweis: hinweise.length,
				protokoll: protokollhinweise.length,
				kopfJa: koepfe.ja,
				kopfNein: koepfe.nein,
				quotenJa,
				quotenNein
			};
			hinweise.push(
				`Gleichstand bei den Kopfstimmen (${koepfe.ja} zu ${koepfe.nein}). Nach dem Reglement ` +
					`dieser Gemeinschaft entscheidet die Anteilsberechtigung: ${quotenJa} Wertquoten dafür, ` +
					`${quotenNein} dagegen — der Antrag ist damit angenommen.`
			);
			protokollhinweise.push({
				ort: 'ausgang',
				satz: quotenstichentscheidProtokollInWorten(
					koepfe.ja,
					koepfe.nein,
					quotenJa,
					quotenNein,
					true,
					lage.geheim === true
				)
			});
		} else {
			hinweise.push(
				`Gleichstand bei den Kopfstimmen (${koepfe.ja} zu ${koepfe.nein}). Nach dem Reglement ` +
					`entscheidet die Anteilsberechtigung, und auch dort führt der Antrag nicht: ` +
					`${quotenJa} Wertquoten dafür, ${quotenNein} dagegen.`
			);
			protokollhinweise.push({
				ort: 'ausgang',
				satz: quotenstichentscheidProtokollInWorten(
					koepfe.ja,
					koepfe.nein,
					quotenJa,
					quotenNein,
					false,
					lage.geheim === true
				)
			});
		}
	} else if (gleichstand && person) {
		/*
		 * **Die Klausel gilt wieder** (Produktentscheid 28.09.2026: «Wendet es
		 * an. Empfohlen wird ablehnen, weil das dem Gesetz entspricht und man
		 * nicht Partei ergreifen würde.»). Fehlt der Entscheid, hält die
		 * Auszählung an; liegt er vor, entscheidet er Annahme oder Ablehnung.
		 * Eine Ablehnung durch Stichentscheid ist ein gefällter Entscheid, nicht
		 * ein verfehltes Mehr: `durchStichentscheid` trägt sie in den Satz.
		 */
		stichentscheidArt = person;
		const entscheid = lage.stichentscheid;
		if (!entscheid) {
			stichentscheidOffen = true;
		} else {
			durchStichentscheid = true;
			if (entscheid.wahl === 'yes') koepfe.erreicht = true;
		}
		hinweise.push(
			verwalterKlauselHinweis(
				koepfe.ja,
				koepfe.nein,
				entscheid,
				person,
				quotenGleich ? { ja: quotenJa, nein: quotenNein } : undefined
			)
		);
	}

	// A5, Punkt 12b; wer die Klausel erwartet, liest sonst nur «nicht erreicht».
	if (stichentscheidNichtAngewandt(lage, koepfe)) {
		protokollhinweise.push({ ort: 'ausgang', satz: STICHENTSCHEID_NICHT_ANGEWANDT });
	}

	/*
	 * **Die Quote im Ausstand in ihrem Eimer, wo sie im Nenner steht**
	 * (Codeprüfung Block 2, Teil 2, M1). Unter `alle_quoten` nach der Vorgabe von
	 * L1 bleibt sie in der Basis, lag aber in keinem Eimer; das Protokoll prüft,
	 * ob die Eimer die Basis ergeben, und nannte die Abwesenden dann «ausserhalb
	 * der Bezugsgrösse». Wer nach 1e schon in der Zählung steht, ist dort.
	 */
	if (e.quotenbasis === 'alle_quoten' && !ausstandAusNenner) {
		// Ohne den Beklagten: Seine Quote liegt an der Ausschlussklage in
		// `stimmtNicht` (unten), auch ohne Ausstand, und ein überflüssiger
		// Ausstand soll die Anzeige nicht ändern.
		// Nur Betroffene, die nicht mitstimmen: Wer mitstimmt und im Ausstand ist,
		// gehört in den Eimer (Review DeepSeek Block 2, Befund 3).
		const ohneStimme = betroffeneStimmenNichtMit(e);
		const draussen = new Set(
			[...ausstandsmenge].filter(
				(id) => !ausstandInDerZahl.has(id) && !(ohneStimme && betroffeneMenge.has(id))
			)
		);
		const q = ausstandsquoteVon(m, draussen);
		if (q > 0) quoten.imAusstand = (quoten.imAusstand ?? 0) + q;
	}

	/*
	 * **Die Quote des Beklagten in ihrem Eimer** (Pendenz aus Block 2, Review
	 * DeepSeek Befund 3, zweiter Teil; nachgerechnet 30.10.2026). Unter dem Mehr
	 * aller Wertquoten bleibt sie im Nenner (`QUOTE_BEKLAGTER`), lag aber in
	 * keinem Eimer: Bei 100 von 1000 ergaben die Eimer 900, und die
	 * Protokollzeile nannte die 100 nirgends. Sie liegt nun bei der Wohnung, die
	 * nicht abstimmt, wo schon die gemeinsame Wohnung liegt; Schwelle und
	 * Ergebnis ändern sich nicht.
	 */
	if (e.quotenbasis === 'alle_quoten' && e.knotenId === AUSSCHLUSSKLAGE_KNOTEN && !ausstandAusNenner) {
		for (const p of m.parties) {
			if (!betroffeneMenge.has(p.partyId) || stumm.has(p.partyId)) continue;
			const q = p.units.reduce((summe, u) => summe + u.quota, 0);
			if (q > 0) quoten.stimmtNicht = (quoten.stimmtNicht ?? 0) + q;
		}
	}

	quoten.basis = quotenbasisWert(
		e.quotenbasis,
		quoten,
		m,
		e.enthaltungZaehltMit === false,
		ausstandsabzug(lage)
	);

	const ausstandssatz = ausstandshinweis(e, m, ausstandsmenge, false, ruhendeAusstandsquote(lage));
	if (ausstandssatz) hinweise.push(ausstandssatz);

	if (e.quotenbasis === 'keine' || !e.quotenSchwelle) {
		// Ohne Quotenerfordernis bleibt die Angabe eine Auskunft, keine Schranke.
		quoten.schwelle = null;
		quoten.erreicht = true;
	} else {
		quoten.schwelle = quoten.basis > 0 ? schwellenwert(quoten.basis, e.quotenSchwelle) : null;
		quoten.erreicht = quoten.schwelle !== null && quoten.ja >= quoten.schwelle;
	}

	if (e.quotenbasis === 'alle_quoten') {
		/*
		 * **Über alle Parteien der Momentaufnahme, nicht über die Eimer**
		 * (Lesarten Block 2, 21.10.2026). Die Quote einer Partei im Ausstand lag
		 * in keinem Eimer; summiert über die Eimer meldete der Satz bei jedem
		 * Ausstand eine «Differenz» in Höhe ihrer Quote, die «keine Zustimmung
		 * geben» könne, obwohl alle Quoten erfasst waren. Nach «fällt heraus»
		 * liegt sie weiter in keinem Eimer. Gemeint ist
		 * eine Momentaufnahme, deren Einheiten die Gesamtquote nicht ergeben.
		 */
		const erfasst = m.parties.reduce((summe, p) => summe + p.units.reduce((q, u) => q + u.quota, 0), 0);
		if (erfasst !== m.totalQuota) {
			hinweise.push(
				`Die erfassten Wertquoten ergeben ${erfasst}, die Gesamtquote der Gemeinschaft ist ` +
					`${m.totalQuota}. Gerechnet wird auf der Gesamtquote — die Differenz von ` +
					`${Math.abs(m.totalQuota - erfasst)} kann keine Zustimmung geben.`
			);
			protokollhinweise.push({
				ort: 'bezugsgroesse',
				satz: quotendifferenzProtokollInWorten(erfasst, m.totalQuota)
			});
		}
	}

	/*
	 * **«Damit angenommen» nur, wenn er es ist** (A1 Frage 1, Fachprüfung, am
	 * Code bestätigt). Der Stichentscheid gibt das Kopfmehr; ob der Antrag
	 * angenommen ist, entscheidet danach noch die Zustimmung der Betroffenen.
	 * Fehlt sie, bleibt der Satz ohne Schluss, und der Satz zur Zustimmung
	 * sagt, woran es lag.
	 */
	const angenommen = koepfe.erreicht && quoten.erreicht && betroffenenbefund.erfuellt;
	// A5, Punkt 12c (Fachprüfung A5): Eine grössere Zahl macht aus einer Ablehnung
	// keine Annahme, also nur am angenommenen Antrag.
	if (angenommen && ausgetreten && e.kopfbasis === 'alle_eigentuemer' && !verlangtEinstimmigkeit(e)) {
		hinweise.push(AUSGETRETENE_MEHRHEIT);
		protokollhinweise.push({ ort: 'bezugsgroesse', satz: AUSGETRETENE_MEHRHEIT });
	}
	// E3 (11.11.2026), Fachprüfung A5: Bei der Einstimmigkeit ebenso nur am
	// angenommenen Antrag. «Danach wäre der Beschluss nicht zustande gekommen»
	// ist an einer Ablehnung kein Anfechtungsgrund, sondern falsch: Es gibt
	// keinen Beschluss, der nicht zustande käme.
	if (angenommen && ausgetreten && e.kopfbasis === 'alle_eigentuemer' && verlangtEinstimmigkeit(e)) {
		hinweise.push(
			'Gerechnet wurde ohne die Ausgetretenen: Die Einstimmigkeit bemisst sich hier an den ' +
				'stimmberechtigten Eigentümern (Beobachter, «Stockwerkeigentum», S. 147). Das ' +
				'WISS-Skript stellt auf sämtliche im Grundbuch aufgeführten Eigentümer ab — danach ' +
				'wäre der Beschluss nicht zustande gekommen. Die Frage ist nicht entschieden.'
		);
		protokollhinweise.push({ ort: 'bezugsgroesse', satz: lesartProtokollInWorten() });
	}
	if (quotenstichentscheidJa && !angenommen) {
		const q = quotenstichentscheidJa;
		hinweise[q.hinweis] = hinweise[q.hinweis].replace(' — der Antrag ist damit angenommen.', '.');
		protokollhinweise[q.protokoll] = {
			ort: 'ausgang',
			satz: quotenstichentscheidProtokollInWorten(
				q.kopfJa,
				q.kopfNein,
				q.quotenJa,
				q.quotenNein,
				null,
				lage.geheim === true
			)
		};
	}

	return {
		koepfe,
		quoten,
		...(beklagtenwohnungen.length > 0 ? { beklagtenwohnungen } : {}),
		betroffene: betroffenenbefund,
		ohneZustimmung,
		// Ein offener Stichentscheid ist keine Ablehnung: Solange er aussteht, ist
		// nichts entschieden, und `stichentscheidOffen` sagt das ausdrücklich.
		angenommen,
		durchStichentscheid,
		stichentscheidOffen,
		stichentscheidArt: durchStichentscheid || stichentscheidOffen ? stichentscheidArt : null,
		...(gleichstand && person && quotenGleich
			? { wertquotenGleich: { ja: quotenJa, nein: quotenNein } }
			: {}),
		protokollhinweise,
		geheim: lage.geheim === true,
		hinweise
	};
}

/**
 * Wie ein Traktandum ausgegangen ist — **dreiwertig**.
 *
 * **Der Anlass** (05.09.2026, im Browserdurchlauf gefunden). An zwei Stellen
 * stand die Frage als Ja/Nein: `angenommen ? 'angenommen' : 'abgelehnt'`. Ein
 * offener Stichentscheid hat aber `angenommen === false`, weil das Mehr nicht
 * erreicht ist — und fiel damit in den Zweig «abgelehnt». Auf der Leitungsseite
 * trug das Traktandum die Marke «abgelehnt», während zehn Zentimeter daneben
 * stand: «solange sein Entscheid nicht vorliegt, steht kein Ergebnis fest.»
 *
 * Zwei Werte für drei Zustände: Das ist die Fehlerklasse, und sie schliesst
 * sich nur, indem der dritte Zustand einen **Namen** bekommt. Wer eine
 * Ja/Nein-Frage stellt, bekommt hier ein `offen` zurück und muss sich
 * entscheiden, was er damit tut — statt es stillschweigend als Nein zu zählen.
 *
 * `null` heisst «gar nicht abgestimmt» und ergibt ebenfalls `offen`: Auch dort
 * gibt es kein Ergebnis, nur einen anderen Grund.
 */
export type Ergebnislage = 'angenommen' | 'abgelehnt' | 'offen' | 'kein_beschluss';

/*
 * **Der vierte Zustand** (Migration 128). «Kein Beschluss» ist weder offen
 * (entschieden ist, dass nichts gilt) noch abgelehnt (eine Ablehnung wäre
 * selbst ein Beschluss). Wer hier nur drei Fälle unterscheidet, bekommt von
 * der Typprüfung den vierten gezeigt.
 */
export function ergebnislage(a: Auszaehlung | null | undefined): Ergebnislage {
	if (!a) return 'offen';
	if (a.keinBeschluss) return 'kein_beschluss';
	if (a.stichentscheidOffen) return 'offen';
	return a.angenommen ? 'angenommen' : 'abgelehnt';
}

/**
 * Angenommen, abgelehnt oder **kein Beschluss** als `true`, `false`, `null`.
 *
 * Für Anzeigen mit zwei Wörtern und einem dritten Fall «ohne Beschluss».
 * Offen und «kein Beschluss» fallen beide auf `null`: Beschlossen ist in beiden
 * nichts, und «abgelehnt» wäre in beiden falsch (Migration 128). Wer nur
 * `=== 'offen'` auf `null` abbildete, schrieb «kein Beschluss» als Ablehnung.
 */
export function beschlossen(lage: Ergebnislage): boolean | null {
	return lage === 'angenommen' ? true : lage === 'abgelehnt' ? false : null;
}

/**
 * Ob am massgebenden Durchgang ein Beschluss gilt, angenommen oder abgelehnt.
 *
 * **Eine Herleitung für Leitungsseite, Rückmeldung und Protokoll**
 * (Codeprüfung Block 4a, dritter Durchgang, N-1). Nach einem Widerspruch am
 * Geschäft sagen alle drei, ob der frühere Beschluss in Kraft bleibt; rechnete
 * jede anders, liefen sie beim offenen Stichentscheid auseinander.
 */
export function beschlussGilt(auszaehlung: Auszaehlung | null | undefined): boolean {
	return auszaehlung ? beschlossen(ergebnislage(auszaehlung)) !== null : false;
}

/** Die Summe aller Eimer eines Spiegels, auch derer, die nicht in der Basis stehen. */
function alleEimer(s: Stimmenspiegel): number {
	return s.ja + s.nein + s.enthaltung + s.ohneAbgabe + s.nichtAnwesend + (s.stimmtNicht ?? 0) + (s.imAusstand ?? 0);
}

/**
 * Ob ein Durchgang die Ja-Stimmen aller Eigentümer hatte (B2b, B2-F-4), für
 * `erfordernisFuerRueckkommen` und `Auszaehlungslage.nachRueckkommen`.
 * `undefined`, wo es sich aus der Auszählung nicht sagen lässt: von Hand
 * festgehalten, ohne Beschluss, offener Stichentscheid, Summenzählung.
 *
 * **Alle Eimer, nicht die Basis:** Unter einer Basis der Anwesenden steht der
 * Abwesende nicht in `basis`, wohl aber in `nichtAnwesend`. Die Eimer
 * zusammen sind alle Kopfstimmen, die `zaehleAus` sieht (`imBlick`).
 *
 * **Zwei Lücken der Eimer, eigens geschlossen** (gemessen in
 * `tests/waechter/mit-allen-ja.test.ts`): Wer im Ausstand ist und nicht nach 1e
 * in der Zahl bleibt, steht in keinem Eimer; hat er nicht zugestimmt, sähen
 * die Eimer sonst alle Ja. Erkannt an `ausstandswirkung`, das nur mit Ausstand
 * gesetzt ist. Und unter der Zählung je Einheit fehlt bei den Köpfen, wem nur
 * Einheiten ohne Kopfstimme gehören; seine Wertquote steht im Quotenspiegel,
 * deshalb müssen auch dort alle Eimer Ja sein.
 *
 * **Nicht erkannt:** Betroffene, die ein Erfordernis aus allen Eimern nimmt
 * (`betroffeneStimmenNichtMit`, an Ausschlussklage und Einsprache). Dort
 * heisst `true` «alle, die abstimmen durften». Unter L6, wo die Angabe wirkt,
 * kommt das nicht vor (`k-reglement-eigene-schranke`).
 */
export function mitAllenJa(a: Auszaehlung): boolean | undefined {
	if (a.vonHand || a.keinBeschluss || a.stichentscheidOffen || a.quotenErhoben === false) return undefined;
	if (a.ausstandswirkung) return false;
	const koepfeAlle = a.koepfe.ja > 0 && a.koepfe.ja === alleEimer(a.koepfe);
	return koepfeAlle && a.quoten.ja === alleEimer(a.quoten);
}

/**
 * Warum der Antrag angenommen oder abgelehnt ist — in einem Satz mit Zahlen.
 *
 * Der Satz wird auf der Leinwand vorgelesen und steht später im Protokoll.
 * Deshalb nennt er die konkreten Zahlen und nicht «die Mehrheit wurde erreicht»:
 * Wer im Saal widerspricht, widerspricht einer Zahl, und die muss dastehen.
 *
 * Bei einer Ablehnung nennt er, **woran** es lag. Das ist der Unterschied
 * zwischen einem Ergebnis und einer Mitteilung: «abgelehnt» sagt nichts darüber,
 * ob eine Wortmeldung, eine Vollmacht oder eine Zustimmung gefehlt hat.
 */
/**
 * Das Ergebnis einer geheimen Abstimmung, ohne jede Zahl.
 *
 * **Produktentscheid 28.09.2026:** «Ich würde es sogar nur anzeigen erreicht
 * nicht erreicht bei Köpfe und Wertquote.» Wertquotensummen lassen sich in
 * kleinen Gemeinschaften auf Einheiten zurückrechnen (Fachprüfung 28.09.2026);
 * deshalb nennen Leinwand, Telefon, Auswertung und Protokoll nur, ob die
 * nötigen Mehrheiten erreicht sind. Die Zahlen selbst bleiben in der Datenbank
 * und im versiegelten Abschlusspaket.
 *
 * Die Zustimmung der Betroffenen steht als «liegt vor» oder «fehlt» im
 * selben Satz. **Hier stand bis zum 16.10.2026, sie werde «offen und getrennt
 * erfasst»** (Fachprüfung F-7); das traf erst danach zu: Bis dahin las
 * `zaehleAus` sie auch bei geheimer Abstimmung aus der Stimme. Seither zählt
 * dort nur der Vorab-Vermerk (Ä-38, Grund `nicht_offen`), und die Namen im
 * Protokoll verraten keine Stimme. Bei einem Ausstand zählte schon vorher nur
 * die getrennte Erklärung (Veto).
 */
export function geheimeWertung(a: Auszaehlung, e: Erfordernis): string {
	const teile = [`Kopfstimmen: ${a.koepfe.erreicht ? 'erreicht' : 'nicht erreicht'}`];
	if (e.quotenbasis !== 'keine' && e.quotenSchwelle !== null) {
		teile.push(`Wertquoten: ${a.quoten.erreicht ? 'erreicht' : 'nicht erreicht'}`);
	}
	if (a.betroffene.noetig) {
		teile.push(`Zustimmung der Betroffenen: ${a.betroffene.erfuellt ? 'liegt vor' : 'fehlt'}`);
	}
	return `Geheim abgestimmt. ${teile.join('. ')}.`;
}

/**
 * Der Hinweis beim Häkchen «geheim» auf beiden Leitungsseiten (Ä-38, Punkt 1
 * der Fachprüfung vom 28.09.2026: Hinweis bei Einstimmigkeit und kleinen
 * Gemeinschaften). Votum empfiehlt, die Leitung entscheidet (Produktentscheid
 * 16.10.2026); ein fester Satz, keine Sperre.
 */
export const GEHEIM_HINWEIS_LEITUNG =
	'Die Einzelstimmen stehen nicht im Protokoll, sondern auf dem Stimmnachweisblatt. Lesen ' +
	'können es Verwaltung und Sitzungsleitung. Einer Partei wird auf Verlangen nur ihre eigene ' +
	'Stimme herausgegeben. Müssen Betroffene zustimmen, zählt nur ihre schriftliche Zustimmung ' +
	'vor dem Eröffnen, auch auf einem Zettel im Saal: Erfassen Sie sie als Vorab-Vermerk, und ' +
	'nehmen Sie ihn vorher zurück, wenn jemand zurückzieht. Braucht es für «erreicht» praktisch alle Stimmen ' +
	'(Einstimmigkeit oder sehr wenige Stimmende), verrät schon das Ergebnis, wie Einzelne ' +
	'gestimmt haben; dann besser offen abstimmen. Geht es um die Verwaltung selbst oder führt ' +
	'eine Eigentümerin die Versammlung in Votum, sehen Beteiligte die Einzelstimmen. Ausweg, nur ' +
	'bei Beschlüssen nach Köpfen wie der Abberufung der Verwaltung: auf Papier ohne Namen ' +
	'abstimmen; dann gibt es keinen Nachweis je Person, und ein Gleichstand lässt sich nicht ' +
	'nach Wertquoten entscheiden.';

/**
 * Das erste der beiden Häkchen zur Grundlage (Ä-38, Punkt 8, Migration 165):
 * der offene Beschluss der Versammlung. Das zweite ist das Reglement
 * (Migration 166); eines von beiden muss gesetzt sein (Produktentscheid
 * 16.10.2026). Der Vorbehalt des Reglements nach Rz. 161 ad Art. 712m und
 * Rz. 98a ad Art. 712n (Fachprüfung Runde 3).
 */
export const GEHEIM_BESCHLUSS_HAKEN =
	'Die Versammlung hat offen beschlossen, geheim abzustimmen (einfaches Mehr, sofern das ' +
	'Reglement nichts anderes bestimmt).';

/**
 * Die zweite Grundlage (Migration 166; Fachprüfung 16.10.2026, Rz. 160 f. ad
 * Art. 712m). Mindestens eines der beiden Häkchen muss gesetzt sein.
 */
export const GEHEIM_REGLEMENT_HAKEN = 'Das Reglement sieht die geheime Abstimmung hier vor.';

/**
 * Der Satz, der auf der Leinwand steht und ins Protokoll wandert.
 *
 * **«Angenommen nach Notwendige bauliche Massnahme» war kein deutscher Satz**
 * (Prüflauf 22.08.2026, zehnmal im erzeugten Protokoll). Der Fehler war nicht
 * bloss Grammatik: Nach «nach» erwartet man die **Regel**, die angewandt wurde —
 * dort stand aber der **Fallname**, also die Antwort auf eine andere Frage.
 *
 * Jetzt trägt der Satz beides an seinem Platz: die Regel im Hauptsatz
 * («angenommen mit mehr als der Hälfte der Anwesenden»), den Fall und seine
 * Rechtsgrundlage in Klammern dahinter. Wer den Beschluss anficht, findet in
 * einem Satz, welche Schwelle galt und woher sie kam.
 *
 * **Ohne Namen für den gemeinsamen Abend** (Block A3a, 26.09.2026). Das
 * Abenddokument geht an alle beteiligten Gemeinschaften und trägt keine
 * Eigentümernamen (10.09.2026). Der Satz hier nannte bei «abgelehnt» die
 * Fehlenden und bei den Wertquoten die Ausstehenden beim Namen; mit
 * `namentlich: false` stehen dort Anzahlen. Die Zahlen der Abstimmung bleiben:
 * Das Abenddokument hat keinen Stimmenspiegel, der namensfreie
 * `ergebniswertung` liesse es ohne jede Zahl (Codeprüfung A3a, H1).
 */
export function ergebnisInWorten(
	a: Auszaehlung,
	e: Erfordernis,
	art: { namentlich: boolean } = { namentlich: true }
): string {
	const personen = (n: number) =>
		n === 1 ? 'eine betroffene Person' : `${n} betroffene Personen`;
	// Kein Beschluss vor allem anderen: Auch eine Ja-Mehrheit ist dann keiner.
	if (a.keinBeschluss) return keinBeschlussSatz(a.keinBeschluss);
	// Von Hand festgehalten: ohne Erfordernis und ohne Wertung gegen eine
	// Schwelle, weil keine angewandt wurde (`vonHandInWorten`).
	if (a.vonHand) return vonHandInWorten(a);
	// Ein offener Stichentscheid ist kein Ergebnis. Hier «abgelehnt» zu schreiben
	// wäre die schlimmste Antwort: Der Satz wird auf der Leinwand vorgelesen, und
	// dann stünde im Saal eine Ablehnung, die niemand beschlossen hat.
	//
	// **Zwei Wege in den offenen Zustand** (seit dem 28.09.2026): der
	// Verwalter-Stichentscheid, dessen Entscheid noch aussteht, und der
	// Quotenstichentscheid über einer Handzählung, dessen Anteile sich nicht
	// ablesen lassen.
	if (a.stichentscheidOffen) {
		// Bei geheimer Abstimmung ohne die Kopfzahlen: Auch ein Patt ist eine
		// Angabe über die Verteilung, und sie gehört nicht in den Saal.
		const gleichstand = a.geheim
			? 'Stimmengleichheit.'
			: `Stimmengleichheit bei ${a.koepfe.ja} zu ${a.koepfe.nein} Kopfstimmen.`;
		if (a.stichentscheidArt === 'verwalter' || a.stichentscheidArt === 'vorsitz') {
			return (
				`${gleichstand} Nach dem Reglement ` +
				`entscheidet ${a.stichentscheidArt === 'verwalter' ? 'der Verwalter' : 'die Person im Vorsitz'}; ` +
				'der Entscheid steht noch aus. Bis er eingetragen ist, steht kein Ergebnis fest.'
			);
		}
		return (
			`${gleichstand} Nach dem Reglement ` +
			'entscheidet die Anteilsberechtigung; sie lässt sich aus einer Handzählung nicht ablesen. ' +
			'Mit einer Neuabstimmung und einzeln erfassten Stimmen steht das Ergebnis.'
		);
	}

	// Die geheime Abstimmung: nur erreicht/nicht erreicht, keine Zahlen
	// (Produktentscheid 28.09.2026).
	if (a.geheim) return geheimeWertung(a, e);

	const koepfe =
		`${a.koepfe.ja} Ja von ${a.koepfe.basis} ${a.koepfe.basis === 1 ? 'Kopfstimme' : 'Kopfstimmen'}` +
		(a.koepfe.schwelle !== null ? `, nötig ${a.koepfe.schwelle}` : '');
	const quoten =
		a.quoten.schwelle !== null
			? `${a.quoten.ja} Ja von ${a.quoten.basis} Wertquoten, nötig ${a.quoten.schwelle}`
			: null;

	if (a.angenommen) {
		const teile = [koepfe];
		if (quoten) teile.push(quoten);
		// Der Stichentscheid gehört in den Satz und nicht in eine Fussnote: Wer den
		// Beschluss anficht, greift genau hier an.
		const schluss = a.durchStichentscheid ? ` — ${stichentscheidsatz(a)}` : '';
		/*
		 * **Die Genehmigung ohne die Zustimmung** (ZGB Art. 712e Abs. 2,
		 * 25.09.2026). Die Versammlung genehmigt mit einfachem Mehr; die
		 * Zustimmung der unmittelbar Betroffenen kommt in der Regel nachher, mit
		 * der öffentlichen Abänderungsurkunde (SVIT-Kommentar 2023, Art. 712e
		 * Rz. 75 und 88). Wer das verschweigt, verkündet einen vollendeten
		 * Beschluss, der es noch nicht ist.
		 */
		if (a.betroffene.noetig && a.betroffene.form === 'nachher') {
			// Der Satz aus der Quellenprüfung (Anhang S1): Wer nur «Angenommen»
			// hört, hält die Änderung für vollzogen. Die Namen sind die, deren
			// Unterschrift noch aussteht; `NICHT_IM_STAND` gehört nicht dazu,
			// den Fall nennt der Hinweis daneben. Bleibt keiner übrig, entfällt
			// die Klammer samt Leerzeichen davor.
			const namen = art.namentlich ? ausstehendeNamen(a.betroffene) : '';
			return (
				// Gebaut wie die Annahme (Codeprüfung B2b, G1).
				`Angenommen (Genehmigung): ${teile.join('; ')}${schluss}. Nötig war ${erfordernisInWorten(e)}` +
				`${klammer(herleitung(e.titel, e.rechtsgrundlage, mehrheitGesetzt(e)))}. ` +
				'Die Wertquoten können sich erst ändern, wenn die Betroffenen die Abänderungsurkunde ' +
				`unterzeichnet haben${namen ? ` (${namen})` : ''}; ein Ja im Saal ersetzt diese Unterschrift nicht.`
			);
		}
		// Gebaut wie die Ablehnung (B2b, Codeprüfung zur Prüfdatei B2-F-6): «mit mehr
		// als die Hälfte» und «nötig 501. (hergeleitet …)» lasen sich falsch.
		return `Angenommen: ${teile.join('; ')}${schluss}. Nötig war ${erfordernisInWorten(e)}${klammer(herleitung(e.titel, e.rechtsgrundlage, mehrheitGesetzt(e)))}.`;
	}

	const fehlt: string[] = [];
	if (!a.koepfe.erreicht) {
		// Bei der Einstimmigkeit fehlt nicht die *Mehrheit* — es haben schlicht
		// nicht alle zugestimmt. Der Satz wird auf der Leinwand vorgelesen und
		// steht später im Protokoll; «die Mehrheit fehlt» bei einem einstimmig zu
		// fassenden Beschluss klänge dort nach dem falschen Erfordernis.
		fehlt.push(
			a.koepfe.basis === 0
				? 'es ist niemand stimmberechtigt erfasst'
				: e.typ === 'einstimmigkeit'
					? `es haben nicht alle zugestimmt — ${koepfe}`
					: `die Mehrheit der Köpfe fehlt — ${koepfe}`
		);
	}
	if (!a.quoten.erreicht && quoten) fehlt.push(`die Mehrheit der Wertquoten fehlt — ${quoten}`);
	if (!a.betroffene.erfuellt) {
		/*
		 * **Der Widerruf wird beim Namen genannt** (25.09.2026). «Die Zustimmung
		 * fehlt» und ein Name dahinter sind für diesen Fall zu wenig: X hatte
		 * zugestimmt, nur vorher und schriftlich, und hat sie im Saal
		 * zurückgenommen. Wer die Ergebniskarte liest, muss den Unterschied
		 * sehen (SVIT-Kommentar 2023, Art. 712g Rz. 209).
		 */
		const widerrufen = a.betroffene.fehlend.filter((f) => f.grund === 'widerrufen');
		const uebrige = a.betroffene.fehlend.filter((f) => f.grund !== 'widerrufen');
		if (widerrufen.length > 0) {
			/*
			 * **Die jüngste Äusserung gilt** (Anhang S4; SVIT-Kommentar 2023,
			 * Art. 712g Rz. 209). «Hat … widerrufen» sagte nicht, was nun gilt.
			 * Seit der Fachprüfung A2 (Runde 2) beschreibend: Ob ein Nein im Saal
			 * die Vorab-Zustimmung widerruft, ist in `quellen` offen; der Satz sagt,
			 * wie Votum zählt, nicht dass sie rechtlich nicht mehr vorliegt.
			 * Die übrigen Fehlenden folgen darunter als eigener Grund.
			 */
			/*
			 * **Im Ausstand gibt es kein Nein im Saal** (Code-Review 26.09.2026,
			 * M1): Dort kam der Widerruf über das Veto. Der Satz sagt das, statt
			 * einer Partei im Ausstand ein Nein im Saal zuzuschreiben.
			 */
			const perVeto = new Set(
				a.betroffene.veto.filter((v) => v.entscheid === 'nein').map((v) => v.parteiId)
			);
			const imSaal = widerrufen.filter((f) => !perVeto.has(f.parteiId));
			const imAusstand = widerrufen.filter((f) => perVeto.has(f.parteiId));
			if (imSaal.length > 0) {
				const namen = art.namentlich
					? imSaal.map((f) => f.name).join(', ')
					: personen(imSaal.length);
				fehlt.push(
					imSaal.length === 1
						? `${namen} hat im Saal Nein gesagt; die Auswertung zählt die vorab erteilte schriftliche Zustimmung damit nicht mehr`
						: `${namen} haben im Saal Nein gesagt; die Auswertung zählt die vorab erteilten schriftlichen Zustimmungen damit nicht mehr`
				);
			}
			if (imAusstand.length > 0) {
				const namen = art.namentlich
					? imAusstand.map((f) => f.name).join(', ')
					: personen(imAusstand.length);
				fehlt.push(
					imAusstand.length === 1
						? `${namen} hat im Ausstand nicht zugestimmt; die Auswertung zählt die vorab erteilte schriftliche Zustimmung damit nicht mehr`
						: `${namen} haben im Ausstand nicht zugestimmt; die Auswertung zählt die vorab erteilten schriftlichen Zustimmungen damit nicht mehr`
				);
			}
		}
		if (uebrige.length > 0) {
			if (art.namentlich) {
				fehlt.push(
					`die Zustimmung ${uebrige.length === 1 ? 'einer betroffenen Person' : 'betroffener Personen'} fehlt — ` +
						uebrige.map((f) => f.name).join(', ')
				);
			} else {
				/*
				 * **Ohne Namen braucht es «weiteren» und die Zahl** (Codeprüfung
				 * A3a, dritter Durchgang): Mit Namen hielten die Namen die Personen
				 * auseinander; ohne sie las man nach einem Widerruf eine Person, wo
				 * es zwei waren. Wortlaut wie `ergebniswertung` (Anhang S5).
				 */
				const weitere = widerrufen.length > 0 ? 'weiteren ' : '';
				fehlt.push(
					uebrige.length === 1
						? `die Zustimmung einer ${weitere}betroffenen Person fehlt`
						: `die Zustimmung von ${uebrige.length} ${weitere}betroffenen Personen fehlt`
				);
			}
		}
	}

	if (a.durchStichentscheid) {
		// Auch die Ablehnung kann auf dem Entscheid einer Person beruhen. Das im
		// Satz zu verschweigen hiesse, im Protokoll eine Zählung zu behaupten, wo
		// eine Person entschieden hat.
		return `Abgelehnt: ${stichentscheidsatz(a)}. Nötig war ${erfordernisInWorten(e)}${klammer(herleitung(e.titel, e.rechtsgrundlage, mehrheitGesetzt(e)))}.`;
	}
	return `Abgelehnt: ${fehlt.join('; ')}. Nötig war ${erfordernisInWorten(e)}${klammer(herleitung(e.titel, e.rechtsgrundlage, mehrheitGesetzt(e)))}.`;
}

/**
 * Die eingetragenen Zahlen eines von Hand festgehaltenen Beschlusses, oder
 * `null`, wo keine eingetragen sind («Zahlen, soweit eingetragen», Plan
 * `docs/plan-beschluss-von-hand-2026-09-30.md`).
 *
 * **Ohne «ohne Abgabe» und ohne «von N»**: Beides setzte eine Bezugsgrösse
 * voraus, und gerechnet wurde gegen keine. Eine Stelle für Ergebnissatz und
 * Protokoll, damit die beiden nicht auseinanderlaufen.
 */
export function vonHandZahlen(
	sp: Pick<Stimmenspiegel, 'ja' | 'nein' | 'enthaltung'>,
	/**
	 * Wie eine Zahl geschrieben wird. Das Protokoll gibt seine eigene
	 * Schreibweise mit («1’000»), damit ein Beschluss von Hand nicht anders
	 * aussieht als der gezählte am Nachbartraktandum; der Leinwandsatz schreibt
	 * Zahlen roh wie in `ergebnisInWorten`.
	 */
	zahl: (n: number) => string = String
): string | null {
	if (sp.ja + sp.nein + sp.enthaltung === 0) return null;
	return `${zahl(sp.ja)} Ja, ${zahl(sp.nein)} Nein, ${zahl(sp.enthaltung)} Enthaltung`;
}

/**
 * Der Satz für Leinwand und Telefon bei einem von Hand festgehaltenen
 * Beschluss: das Ergebnis und die Zahlen, soweit eingetragen. Kein
 * Erfordernis, keine Schwelle, kein Grund der Ablehnung.
 */
function vonHandInWorten(a: Auszaehlung): string {
	const koepfe = vonHandZahlen(a.koepfe);
	const quoten = a.quotenErhoben === false ? null : vonHandZahlen(a.quoten);
	const teile = [
		...(koepfe ? [`Kopfstimmen: ${koepfe}`] : []),
		...(quoten ? [`Wertquoten: ${quoten}`] : [])
	];
	const wort = a.angenommen ? 'Angenommen' : 'Abgelehnt';
	return teile.length > 0 ? `${wort}. ${teile.join('; ')}.` : `${wort}.`;
}

/** Die Wertung ohne Beschluss unter der Universalversammlung (Schritt F2). */
export const UNIVERSAL_NICHT_ERFUELLT =
	// An das eine Geschäft gebunden (Laien- und Fachprüfung F2, S5): Im Präsens
	// liess sich «sind» auf den ganzen Abend beziehen.
	'Kein Beschluss: Bei dieser Abstimmung waren die Voraussetzungen der Universalversammlung nicht ' +
	'erfüllt.';

/**
 * Dieselbe Wertung fürs Protokoll, aber **ohne die Zahlen**.
 *
 * **Warum getrennt von `ergebnisInWorten`** (28.08.2026, aus dem
 * Praxisdurchlauf des Auftraggebers: «Beim qualifizierten Mehr steht das Ergebnis zweimal für die
 * Köpfe und einmal für die Wertquoten»). Auf der Leinwand steht der Satz für
 * sich, dort müssen die Zahlen hinein. Im Protokoll folgt darunter der
 * vollständige Spiegel beider Seiten — der Satz brachte die Kopfzahlen also ein
 * zweites Mal, die Quoten aber nur einmal, weil er allein die gescheiterte
 * Seite nennt. Zwei Auskünfte über dieselbe Abstimmung, verschieden
 * ausführlich.
 *
 * Hier steht deshalb nur, WAS entschieden wurde und woran es lag. Die Zahlen
 * stehen einmal, im Spiegel darunter, jede mit ihrer Schwelle.
 *
 * **Der Stichentscheid steht hier ohne Namen**, anders als im Leinwandsatz: Das
 * Protokoll führt ihn in einer eigenen Zeile mit Person und Begründung (der
 * Verwalter-Stichentscheid, seit dem 28.09.2026 wieder angewandt). Was
 * fehlt, ist die Wertung selbst, und die gehört in diesen Satz.
 */
export function ergebniswertung(a: Auszaehlung, e: Erfordernis): string {
	// Die konsultative Abstimmung hat mit der Universalversammlung nichts zu tun
	// (Migration 158); ihr Satz steht für sich, einen Vermerk darüber gibt es nicht.
	if (a.keinBeschluss?.grund === 'konsultativ') {
		return a.keinBeschluss.neuAnZweiter ? KONSULTATIV_WERTUNG_NEU : KONSULTATIV_WERTUNG;
	}
	// Den Grund mit Namen trägt der Vermerk darüber (`protokollvermerkUniversal`).
	// «nicht erfüllt», nicht «entfallen» (Schritt F2; Codeprüfung 30.09.2026,
	// N-c): Nach einem nachträglichen Kreuz bei den Vertretern haben sie nie
	// bestanden, und «entfallen» sagte, es habe sie einmal gegeben.
	if (a.keinBeschluss) {
		return UNIVERSAL_NICHT_ERFUELLT;
	}
	// Von Hand festgehalten: nur das Ergebnis. Ohne diesen Zweig stünde bei einer
	// Ablehnung «der Grund ist nicht festgehalten» im Protokoll, und das wäre ein
	// Hinweis auf den Weg, den es nach aussen nicht geben soll.
	if (a.vonHand) return a.angenommen ? 'Angenommen.' : 'Abgelehnt.';
	if (a.stichentscheidOffen) {
		/*
		 * **Ohne den Weg zu nennen.** Wie der Gleichstand aufzulösen ist, hängt
		 * vom Reglement ab und, bei den Wertquoten, davon, ob überhaupt einzelne
		 * Stimmen erfasst wurden — nach einer Handzählung gibt es dort keinen
		 * Entscheidträger, sondern nur den Weg über die Einzelerfassung. Diesen
		 * Hinweis gibt die Auszählung der Sitzungsleitung; das Protokoll hält
		 * fest, dass kein Ergebnis vorliegt.
		 */
		return 'Stimmengleichheit; ein Ergebnis steht noch nicht fest.';
	}
	// Die geheime Abstimmung: nur erreicht/nicht erreicht, keine Zahlen
	// (Produktentscheid 28.09.2026). Der Stimmenspiegel entfällt dazu.
	if (a.geheim) return geheimeWertung(a, e);
	/*
	 * **Die Regel, nicht bloss das Wort «Stichentscheid»** (28.08.2026, aus dem
	 * Code-Review). Die erste Fassung schrieb «Angenommen durch Stichentscheid.»
	 * und verliess sich darauf, dass die Zeile «Bei Stimmengleichheit entschied
	 * …» darunter die Einzelheiten trägt. Beim Quotenstichentscheid ist niemand
	 * einzutragen, und die Zeile mit Person und Begründung entfällt; dann stünde
	 * im Protokoll ein Stichentscheid ohne die Regel, an der eine Anfechtung
	 * ansetzt. (Die Zeile mit Person und Begründung gibt es beim
	 * Verwalter-Stichentscheid, der seit dem 28.09.2026 wieder angewandt wird.)
	 */
	/*
	 * **Der Stichentscheid tritt hinzu, er ersetzt den Grund nicht** (28.08.2026,
	 * zweiter Code-Review). Die erste Fassung kehrte hier zurück — und beim
	 * qualifizierten Mehr, wo die Anteilsberechtigung den Kopfgleichstand
	 * zugunsten des Antrags auflöst, die Quotenmehrheit aber fehlt, stand dann
	 * «Abgelehnt; bei Stimmengleichheit entschied die Anteilsberechtigung».
	 * Genau umgekehrt: Sie entschied dafür, gescheitert ist er an den Quoten.
	 * Seit dem 30.10.2026 gibt es dort keinen Stichentscheid mehr
	 * (`stichentscheidMoeglich`); der Fall bleibt bei einer fehlenden
	 * Zustimmung Betroffener.
	 */
	const gleichstand = a.durchStichentscheid
		? ` Bei Stimmengleichheit${
				a.wertquotenGleich
					? ` und gleichen Wertquoten (${a.wertquotenGleich.ja} zu ${a.wertquotenGleich.nein})`
					: ''
			} entschied ${
				a.stichentscheidArt === 'wertquote'
					? 'nach dem Reglement die Anteilsberechtigung'
					: a.stichentscheidArt === 'vorsitz'
						? 'nach dem Reglement die Person im Vorsitz'
						: 'nach dem Reglement der Verwalter'
			}.`
		: '';
	if (a.angenommen) {
		/*
		 * **Dieselbe Auskunft wie im Leinwandsatz, ohne Namen und Zahlen.** Bei
		 * `nachher` ist die Genehmigung nicht das Ganze (ZGB Art. 712e Abs. 2):
		 * Die Wertquoten ändern sich erst mit den Unterschriften (Anhang S2).
		 * Der Zusatz steht nur, wo eine Zustimmung überhaupt nötig ist: Bei
		 * einem frei gesetzten Erfordernis mit der Kennung `k-wertquoten-aendern`
		 * und `noetig: false` gäbe es nichts, was ausstünde.
		 */
		const nachher = a.betroffene.noetig && a.betroffene.form === 'nachher';
		return (
			`Angenommen${nachher ? ' (Genehmigung)' : ''}.${gleichstand}` +
			(nachher
				? ' Die Wertquoten können sich erst mit der Unterschrift der Betroffenen auf der ' +
					'Abänderungsurkunde ändern.'
				: '')
		);
	}

	const fehlt: string[] = [];
	if (!a.koepfe.erreicht) {
		fehlt.push(
			a.koepfe.basis === 0
				? 'es ist niemand stimmberechtigt erfasst'
				: e.typ === 'einstimmigkeit'
					? 'es haben nicht alle zugestimmt'
					: 'die Mehrheit der Kopfstimmen fehlt'
		);
	}
	/*
	 * **Auch die leere Quotenbasis ist ein Grund** (28.08.2026, aufgefallen beim
	 * Bau des Wächters zum zweiten Code-Review). Steht eine Quotenschranke, ist
	 * aber keine Quote erfasst, setzt `zaehleAus` `schwelle = null` **und**
	 * `erreicht = false`: Der Antrag ist abgelehnt, und eine Prüfung auf
	 * `schwelle !== null` liefe daran vorbei. Übrig bliebe «Abgelehnt; der Grund
	 * ist nicht festgehalten» — richtig, aber unbrauchbar für den, der wissen
	 * will, woran es lag.
	 */
	if (!a.quoten.erreicht) {
		fehlt.push(
			a.quoten.schwelle !== null
				? 'die Mehrheit der Wertquoten fehlt'
				: 'es sind keine Wertquoten erfasst, die Quotenschranke lässt sich nicht prüfen'
		);
	}
	/*
	 * **Die Namen stehen im Spiegel, nicht hier** (28.08.2026, aus dem
	 * Code-Review). Der Leinwandsatz nennt sie mit, weil er allein steht; im
	 * Protokoll führt sie eine eigene Zeile. Das ist nicht nur einheitlicher:
	 * Parteinamen tragen regelmässig Hausnummern, und eine Wertungszeile, die
	 * Ziffern tragen darf, lässt sich nicht mehr darauf prüfen, dass sie die
	 * Zahlen des Spiegels nicht wiederholt.
	 */
	if (!a.betroffene.erfuellt) {
		/*
		 * **Der Widerruf verschweigt die übrigen Fehlenden nicht** (Anhang S5):
		 * Er ist ein eigener Grund, und daneben steht, dass weitere fehlen.
		 * Ohne Widerruf bleibt der Bestandswortlaut.
		 */
		const widerrufen = a.betroffene.fehlend.filter((f) => f.grund === 'widerrufen');
		const uebrige = a.betroffene.fehlend.filter((f) => f.grund !== 'widerrufen');
		if (widerrufen.length > 0) {
			// Im Ausstand kam der Widerruf über das Veto, nicht über ein Nein
			// im Saal (Code-Review 26.09.2026, M1).
			const perVeto = new Set(
				a.betroffene.veto.filter((v) => v.entscheid === 'nein').map((v) => v.parteiId)
			);
			const imSaal = widerrufen.filter((f) => !perVeto.has(f.parteiId)).length;
			const imAusstand = widerrufen.length - imSaal;
			if (imSaal > 0) {
				fehlt.push(
					imSaal === 1
						? 'eine betroffene Person hat im Saal Nein gesagt, die Auswertung zählt ihre vorab erteilte Zustimmung damit nicht mehr'
						: `${imSaal} betroffene Personen haben im Saal Nein gesagt, die Auswertung zählt ihre vorab erteilten Zustimmungen damit nicht mehr`
				);
			}
			if (imAusstand > 0) {
				fehlt.push(
					imAusstand === 1
						? 'eine betroffene Person hat im Ausstand nicht zugestimmt, die Auswertung zählt ihre vorab erteilte Zustimmung damit nicht mehr'
						: `${imAusstand} betroffene Personen haben im Ausstand nicht zugestimmt, die Auswertung zählt ihre vorab erteilten Zustimmungen damit nicht mehr`
				);
			}
			if (uebrige.length > 0) {
				fehlt.push(
					uebrige.length === 1
						? 'die Zustimmung einer weiteren betroffenen Person fehlt'
						: 'die Zustimmung weiterer betroffener Personen fehlt'
				);
			}
		} else {
			fehlt.push(
				`die Zustimmung ${a.betroffene.fehlend.length === 1 ? 'einer betroffenen Person' : 'betroffener Personen'} fehlt`
			);
		}
	}
	/*
	 * **Der Rückfall ist kein Schmuck.** Wäre keiner der Gründe gesetzt und
	 * `angenommen` trotzdem falsch, stünde im Protokoll «Abgelehnt: .» — ein
	 * Satzzeichen als Begründung. Dass ich den Fall nicht konstruieren kann,
	 * heisst nicht, dass es ihn nicht gibt.
	 */
	if (fehlt.length === 0) return `Abgelehnt; der Grund ist nicht festgehalten.${gleichstand}`;
	return `Abgelehnt: ${fehlt.join('; ')}.${gleichstand}`;
}

/**
 * Woher der Ausschlag kam, wenn ein Gleichstand aufgelöst wurde.
 *
 * Der Satz nennt die Regel, nicht bloss das Ergebnis: Wer den Beschluss
 * anficht, greift genau hier an — an der Regel und, beim Verwalter, an seiner
 * Befugnis. Den Namen liefert der Hinweis daneben.
 */
function stichentscheidsatz(a: Auszaehlung): string {
	const wer =
		a.stichentscheidArt === 'verwalter'
			? 'der Verwalter'
			: a.stichentscheidArt === 'vorsitz'
				? 'die Person im Vorsitz'
				: 'die Anteilsberechtigung';
	return `bei Stimmengleichheit hat nach dem Reglement ${wer} entschieden`;
}

/**
 * Die Bezugsgrösse der Wertquoten.
 *
 * `alle_quoten` nimmt die **Gesamtquote der Gemeinschaft** und nicht die Summe
 * der erfassten Quoten: «mehr als die Hälfte aller Wertquoten» meint 501 von
 * 1000, auch wenn erst 998 Tausendstel erfasst sind. Genau darin liegt der
 * Kniff des qualifizierten Mehrs — Köpfe relativ, Quoten absolut.
 */
function quotenbasisWert(
	basis: Quotenbasis,
	spiegel: Stimmenspiegel,
	m: Snapshot,
	/**
	 * Ob eine Reglementsregel die Enthaltungen aus der Bezugsgrösse nimmt.
	 *
	 * Wirkt nur auf die Basis der Anwesenden: `alle_quoten` ist die
	 * Gemeinschaftsquote, und die ändert sich durch das Abstimmungsverhalten
	 * nicht. Dieselbe Unterscheidung wie bei den Kopfstimmen weiter oben.
	 */
	enthaltungAusBasis = false,
	/**
	 * Was nach der Wahl «fällt heraus» zu L1 aus dem Nenner aller Wertquoten
	 * fällt (`ausstandsabzug`, Migration 170); nach der Vorgabe null.
	 */
	ausstandAbzug = 0
): number {
	switch (basis) {
		case 'alle_quoten':
			return m.totalQuota - ausstandAbzug;
		case 'anwesend_vertreten':
		case 'keine':
			return (
				spiegel.ja +
				spiegel.nein +
				(enthaltungAusBasis ? 0 : spiegel.enthaltung) +
				spiegel.ohneAbgabe
			);
	}
}

// ── Die Vorschau ────────────────────────────────────────────────────────────

/** Was vor einer Abstimmung über die nötige Mehrheit zu sagen ist. */
export interface Mehrheitsvorschau {
	/** Nötige Ja-Kopfstimmen und die Bezugsgrösse, gegen die gemessen wird. */
	kopf: { noetig: number; von: number } | null;
	/** Dasselbe für die Wertquoten — `null`, wo das Erfordernis keine verlangt. */
	quoten: { noetig: number; von: number } | null;
	/** Ein Satz für die Anzeige, mit der Bezugsgrösse im Klartext. */
	satz: string;
	/**
	 * Ob sich diese Zahl im Lauf des Abends noch ändert.
	 *
	 * **Wahr, sobald eine der Bezugsgrössen an der Anwesenheit hängt.** Wer
	 * später kommt, verschiebt sie. Das entscheidet darüber, ob die Zahl auf
	 * etwas Gedrucktes darf: Auf dem Stimmzettel, der am Vortag aus dem Drucker
	 * kommt, wäre «nötig 3» eine Zusicherung, die der Abend widerlegt. Dort steht
	 * dann die Regel in Worten statt einer Zahl.
	 */
	anwesenheitsabhaengig: boolean;
	/** Dieselbe Auskunft ohne Zahlen — tragfähig auch auf Papier. */
	regelInWorten: string;
	/**
	 * Warum die Wertquotenschranke stehen bleibt, während die Kopfbasis sinkt.
	 *
	 * Gemeldet am 05.09.2026 (Befund 15): «Nach einem Ausstand sinkt die
	 * Kopfbasis, die Quotenbasis nicht — ohne ein Wort, warum.» Das Wort gab es,
	 * es stand nur im Ergebnis. Im Saal wird aber **vorher** gefragt, warum die
	 * eine Zahl fällt und die andere nicht, und wer darauf keine Antwort hat,
	 * hält die Anwendung für kaputt.
	 *
	 * `null`, wo nichts zu erklären ist. Der Wortlaut kommt aus `ausstandshinweis`
	 * und ist derselbe, den das Ergebnis später führt.
	 */
	ausstandshinweis: string | null;
	/**
	 * Die Mehrheit ist mit denen im Saal nicht zu erreichen, mit Zahlen
	 * (`erreichbarkeitshinweis`, Ä-11). Fehlt, wo sie erreichbar ist. Nur für
	 * die Leitung, wie `sperrgrund`: Er steht nicht an der Wand.
	 */
	erreichbarkeitshinweis?: string;
	/**
	 * Wahr, wenn sich die Mehrheit nicht berechnen liess. Getrennt von «keine
	 * Zahl nötig» (Kenntnisnahme, Grenzfall), damit eine Anzeige beides
	 * unterscheiden kann (seit 25.09.2026).
	 */
	nichtBerechenbar?: true;
	/**
	 * Warum sich hier keine Abstimmung eröffnen lässt, mit dem Weg; im
	 * Normalfall derselbe Satz, mit dem der Server abweist (`erfordernisluecke`).
	 * Nur das Netz für fachliche Würfe von `zaehleAus`, die `erfordernisluecke`
	 * nicht kennt, setzt ihn ohne Serversperre; heute ist es nicht erreichbar. **Nur für die
	 * Sitzungsleitung:** Er richtet sich an sie und trägt Fachwörter wie
	 * «Kopfschwelle»; `satz` bleibt saaltauglich, denn er geht an Wand und
	 * Telefone (Code-Review 25.09.2026 zur Vorschau, Befund 2). Steht er, bieten
	 * die Leitungsseiten den Knopf zum Eröffnen nicht an.
	 */
	sperrgrund?: string;
}

/**
 * Worauf sich eine Kopfschwelle bezieht — im Klartext, nicht als Schlüssel.
 *
 * **Die Bezugsgrösse gehört neben die Zahl.** «Nötig 4» heisst etwas ganz
 * anderes, je nachdem ob vier von fünf Eigentümern gemeint sind oder vier von
 * vier Anwesenden. Wer nur die Zahl liest, hält eine Auskunft für eine, die sie
 * nicht ist — und genau daran ist im Prüflauf vom 22.08.2026 niemandem
 * aufgefallen, dass Traktandum 6 auf ALLE Eigentümer rechnete.
 */
function kopfbasisInWorten(e: Pick<Erfordernis, 'kopfbasis' | 'knotenId' | 'fassung'>): string {
	switch (e.kopfbasis) {
		case 'anwesend_vertreten':
			// Unter einer angewandten Klausel an der Ausschlussklage zählt der
			// Beklagte nicht mit (seit 29.09.2026); die Bezugsgrösse sagt es, sonst
			// fehlt im Protokoll eine Person, ohne dass ein Wort dazu steht.
			// «oder», nicht «und» (Produktentscheid 08.10.2026): Eine Partei, die
			// vertreten ist, ist nicht anwesend; das «und» läse sich, als müsste
			// sie beides sein. Der Verlauf schreibt seit je «oder».
			// An der Einsprache «ohne die Betroffenen» (ab Fassung 2026-10-20).
			return betroffeneStimmenNichtMit(e)
				? `der Anwesenden oder Vertretenen ${ohneBetroffeneZusatz(e.knotenId)}`
				: 'der Anwesenden oder Vertretenen';
		case 'alle_eigentuemer':
			return betroffeneStimmenNichtMit(e)
				? `aller Eigentümer ${ohneBetroffeneZusatz(e.knotenId)} — unabhängig davon, wer erscheint`
				: 'aller Eigentümer — unabhängig davon, wer erscheint';
		case 'alle_ausser_betroffene':
			// Ab Fassung 2026-10-11 kann eine Betroffene in der Basis bleiben: die
			// gemeinsame Wohnung des Beklagten (Codeprüfung 30.09.2026, M3). Dann
			// stimmt nur noch der Wortlaut von Art. 649b Abs. 2.
			// An der Einsprache, wer verkauft, vermietet oder belastet (Codeprüfung N3).
			return beklagtenwohnungZaehltMit(e)
				? 'aller Eigentümer ohne den Beklagten, unabhängig davon, wer erscheint'
				: e.knotenId === EINSPRACHE_KNOTEN
					? `aller Eigentümer ${ohneBetroffeneZusatz(EINSPRACHE_KNOTEN)}`
					: 'aller Eigentümer ausser den unmittelbar Betroffenen';
	}
}

function quotenbasisInWorten(basis: Quotenbasis): string {
	switch (basis) {
		case 'alle_quoten':
			return 'aller Wertquoten';
		case 'anwesend_vertreten':
			// «oder» wie bei den Köpfen (Produktentscheid 08.10.2026).
			return 'der anwesenden oder vertretenen Wertquoten';
		case 'keine':
			return '';
	}
}

/**
 * Woher die Schwelle stammt — die Klammer hinter der Mehrheit.
 *
 * **Der Anlass** (Auftraggeber, 03.09.2026, mit Bild von Traktandum 3): Dort stand
 * «mehr als die Hälfte der Anwesenden und Vertretenen (Décharge und
 * Protokollgenehmigung, ZGB Art. 712m Abs. 1 (Praxis))» — unter der
 * **Protokollgenehmigung**. Das Wort «Décharge» gehört dort nicht hin, und wer
 * das liest, hält es für einen Fehler.
 *
 * Es ist keiner: `k-decharge` im Entscheidbaum deckt beide Geschäfte ab, weil
 * sie dieselbe Schwelle haben. Der Knotentitel ist die **Fallgruppe**, nicht die
 * Bezeichnung dieses Geschäfts — nur sagte das niemand, und in einer blossen
 * Klammer neben der Fundstelle liest es sich wie eine Aussage über das
 * Traktandum.
 *
 * **Nicht im Regelwerk zu beheben:** Eine Fassung bleibt unverändert stehen
 * (AD-4), und der Fallname ist am Traktandum gespeichert, seit sein Erfordernis
 * hergeleitet wurde. Ein neuer Knotentitel träfe nur neue Traktanden und liesse
 * die bestehenden ungereimt.
 *
 * **Eine Funktion für alle vier Stellen** (aus dem Code-Review): Dieselbe
 * Verkettung stand im Protokoll, im Ergebnissatz der Leinwand (dreimal) und in
 * der Traktandenliste der Einladung. Ein Fix an einer Stelle hätte die anderen
 * drei stehen lassen — dieselbe Klasse, die sich durch diese Woche zieht.
 */
export function herleitung(
	fall: string | null | undefined,
	rechtsgrundlage: string | null | undefined,
	/**
	 * **«hergeleitet als» nicht bei einer gesetzten Mehrheit** (Codeprüfung
	 * 30.09.2026). Hat die Sitzungsleitung die Mehrheit selbst gesetzt oder
	 * übersteuert, trägt der Titel die Mehrheit und keinen Fall; der Satz
	 * behauptete sonst in Einladung und Protokoll, das Werkzeug habe bestimmt,
	 * was die Leitung entschieden hat. Wie gesetzt wurde, steht im Verlauf, nicht
	 * hier (Produktentscheid 30.09.2026). Siehe `mehrheitGesetzt`.
	 */
	mehrheitGesetzt = false
): string {
	const teile: string[] = [];
	if (fall && !mehrheitGesetzt) teile.push(`hergeleitet als «${fall}»`);
	// Ohne den Schlusspunkt nach einer Klammer: Die Herleitung steht selbst in
	// einer, und die Rechtsgrundlage des Rückkommens endet auf «(…).» («).).»,
	// B2b). Nur dort: Eine erfasste Fundstelle wie «Art. 12 ff.» behält ihren
	// Punkt (Codeprüfung B2b, G2).
	if (rechtsgrundlage) teile.push(rechtsgrundlage.replace(/\)\.$/, ')'));
	return teile.join(', ');
}

/**
 * Ob die Sitzungsleitung die Mehrheit selbst gesetzt hat: frei ohne Knoten
 * (`setzeErfordernis`) oder gegen den Vorschlag (`uebersteuere`). Beide setzen
 * seit dem 30.09.2026 eine leere Rechtsgrundlage.
 *
 * **Nicht jede Quelle «gewaehlt».** Auch wer einen Fall direkt aus der Liste
 * wählt (`waehleErfordernis`), setzt «gewaehlt»; dort trägt der Titel aber den
 * Fall und die Rechtsgrundlage die des Knotens, und beides gehört weiter neben
 * die Regel (zweite Codeprüfung 30.09.2026).
 *
 * **Nur aus Feldern, die den ganzen Weg überstehen** (`check:erfordernisweg`):
 * `vorschlagTyp` steht weder in der Traktandenzeile noch im Erfordernis, das
 * beim Eröffnen eingefroren wird; `quelle` und `rechtsgrundlage` in beiden.
 * `begruendung` friert seit Migration 173 mit ein, fehlt aber in Durchgängen,
 * die vorher eröffnet wurden.
 */
export function mehrheitGesetzt(e: Pick<Erfordernis, 'quelle' | 'rechtsgrundlage'>): boolean {
	return e.quelle === 'gewaehlt' && !e.rechtsgrundlage;
}

/** « (…)» um eine Angabe, oder nichts, wenn sie leer ist: keine leere Klammer. */
export function klammer(angabe: string): string {
	return angabe ? ` (${angabe})` : '';
}

/**
 * Das Erfordernis in Worten, ohne jede Zahl — «mehr als die Hälfte der
 * Anwesenden und Vertretenen».
 *
 * **Für alles, was gedruckt wird.** Ein Stimmzettel entsteht am Vortag; eine
 * Zahl darauf wäre eine Zusicherung, die der Abend widerlegt, sobald jemand
 * mehr oder weniger erscheint. Die Wortfassung altert nicht — und sie sagt
 * mehr als der blosse Fallname, der bis zum 22.08.2026 dort stand
 * («Gewöhnliche Verwaltungshandlung» beantwortet nicht, wie viele Ja es
 * braucht).
 *
 * Braucht keine Momentaufnahme und keinen Anwesenheitsstand: Sie hängt allein
 * am eingefrorenen Erfordernis des Traktandums.
 */
export function erfordernisInWorten(e: Erfordernis): string {
	if (e.typ === 'keine_abstimmung') return 'keine Abstimmung';
	if (e.typ === 'grenzfall') return 'von der Sitzungsleitung zu setzen';

	const teile: string[] = [];
	if (e.kopfSchwelle) {
		teile.push(`${schwelleInWorten(e.kopfSchwelle)} ${kopfbasisInWorten(e)}`);
	}
	if (e.quotenSchwelle && e.quotenbasis !== 'keine') {
		teile.push(`${schwelleInWorten(e.quotenSchwelle)} ${quotenbasisInWorten(e.quotenbasis)}`);
	}
	// Endet die Kopfbasis mit dem Nebensatz der Einsprache («…, der verkauft,
	// vermietet oder belastet»), schliesst ein Komma ihn vor dem «und».
	const nebensatz = teile[0]?.endsWith(ohneBetroffeneZusatz(EINSPRACHE_KNOTEN)) ?? false;
	/*
	 * **Folgt den Köpfen aller Eigentümer das Mehr der Wertquoten**, steht der
	 * Einschub in Klammern (Laien- und Fachprüfung Block C, Nachtrag, N-L-02 und
	 * N-F-8): Mit dem Strich las sich «unabhängig davon, wer erscheint und mehr
	 * als die Hälfte aller Wertquoten» als eine Bedingung. Ohne Wertquoten
	 * bleibt der Satz, wie er war.
	 */
	if (teile.length > 1 && teile[0].endsWith(' — unabhängig davon, wer erscheint')) {
		teile[0] = `${teile[0].slice(0, -' — unabhängig davon, wer erscheint'.length)} (unabhängig davon, wer erscheint)`;
	}
	return teile.join(nebensatz ? ', und ' : ' und ');
}

/**
 * Was es braucht, damit dieser Antrag durchkommt — **vor** der Abstimmung.
 *
 * **Der Anlass, 22.08.2026.** Bis dahin stand vor einer Abstimmung überall der
 * Fallname des Erfordernisses («Notwendige bauliche Massnahme») und nirgends
 * die Zahl. Die erschien erst im Ergebnis. Im Prüflauf ging Traktandum 6 mit
 * vier von fünf nötigen Ja-Stimmen nur deshalb auf, weil jemand eine Vollmacht
 * führte — gemerkt hat das niemand, bis es vorbei war.
 *
 * **Dieselbe Rechnung wie hinterher, nicht eine zweite.** Die Vorschau ruft
 * `zaehleAus` mit einer leeren Stimmenliste auf und nimmt daraus nur die Basen
 * und Schwellen. Ein Nachbau wäre die naheliegendere Lösung gewesen und die
 * gefährlichere: Zwei Rechnungen für dieselbe Zahl laufen auseinander, sobald
 * eine von beiden eine Regel lernt — und dann sagt der Saal vorher etwas
 * anderes als das Protokoll nachher.
 *
 * Ausstand und unmittelbar Betroffene wirken deshalb ohne weiteres Zutun: Sie
 * verschieben die Bezugsgrösse in `zaehleAus`, und die Vorschau erbt das.
 */
export function mehrheitsvorschau(lage: Omit<Auszaehlungslage, 'stimmen'>): Mehrheitsvorschau {
	const e = lage.erfordernis;

	/*
	 * **Zwei Fälle, in denen `zaehleAus` zu Recht abbricht** — und die Vorschau
	 * deshalb vorher antworten muss. Beide stehen in jeder Versammlung: Die
	 * Begrüssung ist eine Kenntnisnahme, und ein Grenzfall wartet darauf, dass
	 * die Sitzungsleitung entscheidet.
	 *
	 * Der Test dazu hat den Fehler gefunden, bevor er in einen Saal kam: Ohne
	 * diese Weiche wirft die Vorschau am ersten Traktandum des Abends.
	 */
	if (e.typ === 'keine_abstimmung') {
		return {
			kopf: null,
			quoten: null,
			satz: 'Keine Abstimmung — dieses Geschäft wird zur Kenntnis genommen.',
			anwesenheitsabhaengig: false,
			regelInWorten: 'keine Abstimmung',
			ausstandshinweis: null,
			// Nur wirksam, wo die Leitung überhaupt einen Knopf zum Eröffnen zeigt:
			// bei einem Antrag, der eine Kenntnisnahme als Erfordernis trägt.
			sperrgrund: erfordernisluecke(e, 0)?.satz
		};
	}
	if (e.typ === 'grenzfall') {
		return {
			kopf: null,
			quoten: null,
			satz: 'Noch kein Erfordernis: Beim Grenzfall setzt die Sitzungsleitung es, bevor abgestimmt wird.',
			anwesenheitsabhaengig: false,
			regelInWorten: 'von der Sitzungsleitung zu setzen',
			ausstandshinweis: null
		};
	}

	/*
	 * **Der Grund statt einer Stille** (seit 25.09.2026). `zaehleAus` wirft
	 * fachlich bei fehlender Kopfschwelle und wenn die Zustimmung Betroffener
	 * nötig, aber niemand als betroffen eingetragen ist; die Freigabe der
	 * Versammlung prüft beides nicht. Bis dahin fing jede Seite das selbst ab
	 * oder gar nicht:
	 * `/z` still, die Tagesleitung still, die Leitung eines Hauses, `/p` und
	 * `versammlungsstand.ts` gar nicht, dort wurde die ganze Seite zur
	 * Fehlerseite. Ein stiller Fang sah aus wie «keine Vorschau nötig», obwohl
	 * die Zahl fehlte (Hinweis einer parallelen Sitzung, 25.09.2026).
	 *
	 * Jetzt an einer Stelle: Die Vorschau sagt, dass die Mehrheit noch nicht
	 * feststeht (`satz`, für Wand und Telefone), und der Sitzungsleitung, warum
	 * und was zu tun ist (`sperrgrund`). Den Satz liefert `erfordernisluecke`,
	 * dieselbe Quelle, mit der das Eröffnen seit dem 25.09.2026 abgewiesen
	 * wird. Nur der fachliche Fehler wird gefangen; alles andere bleibt laut.
	 */
	const nichtBerechenbar = (sperrgrund: string): Mehrheitsvorschau => ({
		kopf: null,
		quoten: null,
		satz: 'Die nötige Mehrheit steht noch nicht fest; die Sitzungsleitung klärt das.',
		anwesenheitsabhaengig: false,
		regelInWorten: erfordernisInWorten(e),
		ausstandshinweis: null,
		nichtBerechenbar: true,
		sperrgrund
	});
	const luecke = erfordernisluecke(e, (lage.betroffeneParteiIds ?? []).length);
	if (luecke) return nichtBerechenbar(luecke.satz);

	// Das Netz darunter: Wirft `zaehleAus` fachlich aus einem Grund, den
	// `erfordernisluecke` nicht kennt, gilt dasselbe. Alles andere bleibt laut.
	let a: Auszaehlung;
	try {
		a = zaehleAus({ ...lage, stimmen: [] });
	} catch (fehler) {
		if (!(fehler instanceof FachlicherFehler)) throw fehler;
		return nichtBerechenbar(`Die nötige Mehrheit lässt sich nicht berechnen. ${fehler.message}`);
	}

	const kopf =
		a.koepfe.schwelle !== null ? { noetig: a.koepfe.schwelle, von: a.koepfe.basis } : null;
	const quoten =
		a.quoten.schwelle !== null ? { noetig: a.quoten.schwelle, von: a.quoten.basis } : null;

	// Eine Bezugsgrösse von null: niemand stimmberechtigt im Saal. Die Vorschau
	// sagt das, statt «0 von 0» zu behaupten.
	const anwesenheitsabhaengig =
		e.kopfbasis === 'anwesend_vertreten' ||
		(e.quotenSchwelle !== null && e.quotenbasis === 'anwesend_vertreten');

	/*
	 * Dieselbe Auskunft ohne Zahlen — aus derselben Funktion, die auch das
	 * Gedruckte speist. «4 von 5» sagt nicht, dass es zwei Drittel sind, und wer
	 * den Beschluss später prüft, sucht den Bruch.
	 */
	const regelInWorten = erfordernisInWorten(e);
	// Derselbe Satz wie im Ergebnis, aus derselben Funktion.
	const ausstandsmenge = new Set(lage.imAusstand ?? []);
	const ausstand = ausstandshinweis(e, lage.momentaufnahme, ausstandsmenge, false, ruhendeAusstandsquote(lage));
	// Ä-11: ob die Mehrheit mit denen im Saal überhaupt erreichbar ist. Nach
	// «fällt heraus» zu L1 ist die Quote im Ausstand schon aus dem Nenner; die
	// offene Frage zum Nenner stellt sich dann nicht mehr.
	const ausstandAusNenner = ausstandsabzug(lage) > 0;
	const erreichbarkeit = erreichbarkeitshinweis(
		e,
		a,
		ausstandMachtUnerreichbar(e, lage.momentaufnahme, ausstandsmenge),
		ausstandsmenge.size > 0,
		ausstandAusNenner ? 0 : ausstandsquoteVon(lage.momentaufnahme, ausstandsmenge),
		ausstandAusNenner,
		lage
	);

	if (!kopf && !quoten) {
		return {
			kopf,
			quoten,
			satz: 'Keine Bezugsgrösse — es ist niemand erfasst, der abstimmen könnte.',
			anwesenheitsabhaengig,
			regelInWorten,
			ausstandshinweis: ausstand,
			...(erreichbarkeit ? { erreichbarkeitshinweis: erreichbarkeit } : {})
		};
	}

	const teile: string[] = [];
	if (kopf) {
		teile.push(
			`${kopf.noetig} von ${kopf.von} ${kopf.von === 1 ? 'Kopfstimme' : 'Kopfstimmen'} ` +
				`(${kopfbasisInWorten(e)})`
		);
	}
	if (quoten) {
		// Nach L1 «fällt heraus» ist der Nenner gesenkt; die Klammer sagt es
		// (Codeprüfung Block 2, Teil 2, N4).
		// Laienprüfung Block 2, M9: «aller» passt nicht neben den gesenkten Nenner.
		const basisInWorten = ausstandAusNenner
			? `alle ausser den ${ausstandsabzug(lage)} im Ausstand`
			: quotenbasisInWorten(e.quotenbasis);
		teile.push(`${quoten.noetig} von ${quoten.von} Wertquoten (${basisInWorten})`);
	}

	// «und» statt «;» — beide Schwellen müssen erfüllt sein, und das doppelte
	// qualifizierte Mehr ist genau der Fall, den man im Saal falsch versteht.
	return {
		kopf,
		quoten,
		satz: `Nötig: ${teile.join(' und ')}.`,
		anwesenheitsabhaengig,
		regelInWorten,
		ausstandshinweis: ausstand,
		...(erreichbarkeit ? { erreichbarkeitshinweis: erreichbarkeit } : {})
	};
}

// ── Die Summen-Erfassung ────────────────────────────────────────────────────

/** Was von Hand gezählt wurde — drei Zahlen, niemandem zugeordnet. */
export interface Handzaehlung {
	ja: number;
	nein: number;
	enthaltung: number;
	/**
	 * Die zweite Zählung an der Einsprache (Migration 172), die andere als
	 * `ja/nein/enthaltung`: je Eigentümer oder je Einheit, was die Einstellung
	 * nicht vorgibt. Nur dort, wo L3 wirkt; zusammen gesetzt oder ganz leer.
	 */
	andereJa?: number;
	andereNein?: number;
	andereEnthaltung?: number;
	/** Wie gezählt wurde. Steht im Protokoll und erklärt die fehlenden Namen. */
	vermerk?: string | null;
}

/** Die andere Dreizahl einer Handzählung, oder `null`, wenn keine (vollständig) erfasst ist. */
export function andereDreizahlVon(summe: Handzaehlung): Handzaehlung | null {
	if (
		summe.andereJa === undefined ||
		summe.andereNein === undefined ||
		summe.andereEnthaltung === undefined
	) {
		return null;
	}
	return {
		ja: summe.andereJa,
		nein: summe.andereNein,
		enthaltung: summe.andereEnthaltung,
		vermerk: summe.vermerk
	};
}

/**
 * Die Zählhilfe an der Einsprache (Migration 172, Kriterium 5): die anwesenden
 * stimmberechtigten Parteien, die je Einheit nicht genau eine Stimme haben —
 * auch 0 bei einem Nebenobjekt ohne Kopfstimme. Nur dann kann die zweite
 * Zählung von der ersten abweichen, und die zweite Dreizahl ist Pflicht. Leer
 * ausserhalb der Einsprache oder wenn jede anwesende Partei genau eine Stimme
 * je Einheit hat. Dieselben Bedingungen wie die Zählung in
 * `zaehleSummenOhneLesart`.
 */
export function einspracheZaehlhilfe(lage: Omit<Auszaehlungslage, 'stimmen'>): string[] {
	const e = lage.erfordernis;
	if (!l3Wirkt(e, lage.momentaufnahme)) return [];
	const m = lage.momentaufnahme;
	const anwesend = new Set(lage.anwesende);
	const ausstandsmenge = parteienImAusstand(lage.imAusstand);
	const betroffeneMenge = new Set(lage.betroffeneParteiIds ?? []);
	const alleBeklagt = new Set(lage.alleEigentuemerBeklagt ?? []);
	const stumm = stummeBeklagtenwohnungen(m, e, betroffeneMenge, alleBeklagt);
	const ausstandInDerZahl = ausstandInDerZahlBei(e, ausstandsmenge, betroffeneMenge);
	const ruhend = ruhendeVertretungenBei(
		lage.vertretungen ?? [],
		vomStimmrechtAusgeschlossen(e, lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []),
		anwesend
	);
	const namen: string[] = [];
	for (const p of m.parties) {
		if (!kommtInDerZaehlungVor(p.partyId, e, ausstandsmenge, betroffeneMenge, stumm, ausstandInDerZahl))
			continue;
		if (stumm.has(p.partyId) || !anwesend.has(p.partyId) || ruhend.has(p.partyId)) continue;
		const n = kopfgewicht(p, 'per_unit', m.parkingCountsAsHead);
		// Mit der Zahl, die im Saal gebraucht wird (Laienprüfung Block 5, L5-4).
		if (n !== 1) namen.push(`${p.displayName} mit ${n} ${n === 1 ? 'Stimme' : 'Stimmen'}`);
	}
	return namen;
}


/**
 * Wessen Hand in welcher Zählung nicht einfach einmal zählt (A5, Punkt 9;
 * Entscheid 0029). Die Leitung zählt dieselben Hände zweimal, also je Zählung
 * eine Liste, gleich welche nach der Einstellung gilt, und mit den Vertretenen:
 * Wer vertreten ist, hat keine eigene Hand, seine Stimmen zählen bei der Hand
 * mit der Vollmacht. Neben `einspracheZaehlhilfe`, weil die Pflicht zur zweiten
 * Zählung nur an den Einheiten hängt: Eine Vollmacht zählt in beiden Zählungen.
 */
export function einspracheHaende(
	lage: Omit<Auszaehlungslage, 'stimmen'>
): Record<Einsprachewahl, string[]> {
	const e = lage.erfordernis;
	const m = lage.momentaufnahme;
	if (!l3Wirkt(e, m)) return { je_eigentuemer: [], je_einheit: [] };
	const anwesend = new Set(lage.anwesende);
	const ausstandsmenge = parteienImAusstand(lage.imAusstand);
	const betroffeneMenge = new Set(lage.betroffeneParteiIds ?? []);
	const alleBeklagt = new Set(lage.alleEigentuemerBeklagt ?? []);
	const stumm = stummeBeklagtenwohnungen(m, e, betroffeneMenge, alleBeklagt);
	const ausstandInDerZahl = ausstandInDerZahlBei(e, ausstandsmenge, betroffeneMenge);
	const ausgeschlossen = vomStimmrechtAusgeschlossen(e, lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []);
	const vertretungen = lage.vertretungen ?? [];
	const ruhend = ruhendeVertretungenBei(vertretungen, ausgeschlossen, anwesend);
	const zaehlt = (id: Id) =>
		!stumm.has(id) && kommtInDerZaehlungVor(id, e, ausstandsmenge, betroffeneMenge, stumm, ausstandInDerZahl);
	const gueltig = vertretungen.filter(
		(v) =>
			anwesend.has(v.bevollmaechtigtId) &&
			anwesend.has(v.vertreteneId) &&
			!ruhend.has(v.vertreteneId) &&
			!(ausgeschlossen.has(v.vertreteneId) && ausgeschlossen.get(v.vertreteneId) !== 'ausgenommen')
	);
	const ohneEigeneHand = new Set(gueltig.map((v) => v.vertreteneId));
	const liste = (modus: HeadCountMode): string[] => {
		const gewicht = (id: Id): number => {
			const p = m.parties.find((x) => x.partyId === id);
			return p && zaehlt(id) ? kopfgewicht(p, modus, m.parkingCountsAsHead) : 0;
		};
		const namen: string[] = [];
		for (const p of m.parties) {
			if (!anwesend.has(p.partyId) || stumm.has(p.partyId) || ruhend.has(p.partyId)) continue;
			if (ohneEigeneHand.has(p.partyId)) continue;
			const stimmen = gueltig
				.filter((v) => v.bevollmaechtigtId === p.partyId)
				.reduce((summe, v) => summe + gewicht(v.vertreteneId), gewicht(p.partyId));
			// Wer selbst nicht zählt und niemanden vertritt, gehört nicht in die Liste.
			if (!zaehlt(p.partyId) && stimmen === 0) continue;
			if (stimmen !== 1) namen.push(`${p.displayName} mit ${stimmen} Stimmen${stimmen === 0 ? ' (ohne Kopfstimme)' : ''}`);
		}
		return namen;
	};
	return { je_eigentuemer: liste('per_owner'), je_einheit: liste('per_unit') };
}

/**
 * Ob sich ein Erfordernis mit einer Handzählung überhaupt auszählen lässt.
 *
 * **Die Grenze hat der Auftraggeber selbst gezogen** (25.08.2026): «Summen-Erfassung nur bei
 * einfachem Mehr. Beim qualifiziertem Mehr braucht es die Zettel aus jeder
 * Zeit.» Der Grund ist nicht Vorsicht, sondern Arithmetik — die Gründe stehen
 * je Fall im Rückgabewert.
 *
 * Gibt `null` zurück, wenn es geht, sonst den Satz, der auf der Seite steht.
 */
export function summenhindernis(e: Erfordernis): string | null {
	if (e.typ === 'keine_abstimmung') {
		return 'Dieses Traktandum wird zur Kenntnis genommen; es gibt nichts auszuzählen.';
	}
	if (e.typ === 'grenzfall' || !e.kopfSchwelle) {
		return (
			'Für dieses Traktandum steht kein Mehrheitserfordernis fest. Ohne Schwelle liesse sich ' +
			'nicht sagen, ob der Antrag angenommen ist.'
		);
	}
	/*
	 * **Wertquoten hängen an der Einheit, nicht an der Hand.** Wer Hände zählt,
	 * weiss nicht, WELCHE Einheiten zugestimmt haben — die Quote lässt sich
	 * daraus nicht bilden. Das ist kein Genauigkeitsverlust, sondern eine Lücke:
	 * Es gibt keine Zahl, die man einsetzen könnte.
	 */
	if (e.quotenbasis !== 'keine' && e.quotenSchwelle) {
		return (
			`«${e.titel}» verlangt neben den Köpfen eine Mehrheit der Wertquoten. Die hängt an der ` +
			'Einheit: Aus gezählten Händen lässt sich nicht ablesen, welche Einheiten zugestimmt ' +
			'haben. Hier braucht es die einzelnen Stimmen.'
		);
	}
	/*
	 * **Die Einstimmigkeit braucht die Namen.** Ihr Ergebnis ist nicht «wie
	 * viele», sondern «wer nicht». Eine Summe sagte «14 von 15», und niemand
	 * wüsste, wer fehlt. Bis 22.10.2026 hiess es hier, die Liste werde «nachher
	 * abgeholt»; nachträgliche Zustimmungen holen den Beschluss aber nicht nach
	 * (Fassung 2026-10-29, Codeprüfung 22.10.2026, Befund 1).
	 */
	if (e.typ === 'einstimmigkeit') {
		return (
			'Bei der Einstimmigkeit zählt nicht, wie viele zugestimmt haben, sondern wer nicht. ' +
			'Dafür braucht es die einzelnen Stimmen.'
		);
	}
	/*
	 * **Die Zustimmung der Betroffenen ist namentlich.** ZGB Art. 712g Abs. 4
	 * verlangt das Ja bestimmter Personen; eine Summe kann es nicht belegen.
	 *
	 * **Bei den Wertquoten nicht** (Block A3c, 26.09.2026). Die Versammlung
	 * genehmigt dort mit einfachem Mehr (Rz. 85 ad 712e), die Zustimmung kommt
	 * nachher mit der Unterschrift auf der Abänderungsurkunde (Rz. 75, 88), und
	 * eine Summe muss sie nicht belegen. Bis A3c sperrte die Anwendung trotzdem,
	 * weil die Handzählung die Betroffenen nicht kannte und das Protokoll dann
	 * nicht nannte, wessen Unterschrift aussteht. Seither führt
	 * `zaehleSummenAus` sie aus den eingetragenen Betroffenen (Produktentscheid
	 * 26.09.2026: «es sollte eigentlich möglich sein, mit Kommentar»; der
	 * Kommentar ist `summenvermerkNoetig`).
	 */
	if (e.zustimmungBetroffenerNoetig && betroffenenzustimmungVon(e) !== 'nachher') {
		return (
			'Dieses Erfordernis verlangt die Zustimmung jeder einzelnen betroffenen Person ' +
			'(ZGB Art. 712g Abs. 4). Eine Summe kann sie nicht belegen; erfassen Sie die Stimmen ' +
			'einzeln.'
		);
	}
	return null;
}

/**
 * Ob die Handzählung einen Vermerk der Sitzungsleitung braucht, und wenn ja,
 * der Satz, der beim Feld steht. `null` heisst: freiwillig.
 *
 * **Pflicht bei den Wertquoten** (Block A3c, Produktentscheid 26.09.2026: «mit
 * Kommentar»). Die einzelne Erfassung hält fest, wer von den Betroffenen im
 * Saal wie gestimmt hat, und nennt ein Nein im Hinweis; die Handzählung hält
 * das nicht fest. Der Vermerk ist dann die einzige Angabe im Protokoll, wie das
 * Ergebnis zustande kam.
 *
 * **Er fragt bewusst nicht nach den Betroffenen.** Der Vermerk steht auch im
 * Protokoll des gemeinsamen Abends, und das trägt keine Eigentümernamen
 * (10.09.2026). Wer die Leitung nach dem Verhalten der Betroffenen fragt,
 * bekommt Namen hinein. Wessen Unterschrift aussteht, steht ohnehin im
 * Protokoll, aus den eingetragenen Betroffenen.
 *
 * Geprüft wird beim Schreiben (`erfasseSummen`), nicht in `zaehleSummenAus`:
 * Die Rechnung liest auch festgehaltene Durchgänge, und die weist sie nicht ab.
 */
export function summenvermerkNoetig(e: Erfordernis): string | null {
	if (!e.zustimmungBetroffenerNoetig || betroffenenzustimmungVon(e) !== 'nachher') return null;
	return (
		'Bei einer Änderung der Wertquoten ist der Vermerk Pflicht: Die Handzählung hält nicht ' +
		'fest, wer wie gestimmt hat. Halten Sie fest, wie gezählt wurde. Als ausstehende ' +
		'Unterschrift auf der Abänderungsurkunde nennt das Protokoll, wer unter «Betroffene» ' +
		'eingetragen ist. Fehlt dort jemand, ergänzen Sie ihn im Protokoll; seine Unterschrift ' +
		'braucht es trotzdem.'
	);
}

/** Wie lang ein Pflichtvermerk mindestens ist, wie beim Vorab-Vermerk (Migration 124). */
export const SUMMENVERMERK_MINDESTLAENGE = 3;

/**
 * Zählt eine **von Hand gezählte** Abstimmung aus — Summen statt Zuordnung.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «ich vermute dass die Sitzung mit
 * Handzählen ist und darum kein Kommentar beim Stimmen durch den Sitzungsleiter
 * braucht. […] So setzt es voraus, dass ich jeden Eigentümer kenne und die
 * Stimmen richtig setze. Also beim einfachen Mehr. Wenn müsste man dort die
 * totale Anzahl an Ja, Nein und Enthaltung eintragen können.»
 *
 * Und ausdrücklich **zusätzlich**, nicht statt: «Ich finde es eigentlich gut,
 * dass ich einzelne Stimme mit den Bulletpoints erfassen kann. Ohne Zuordnung
 * wäre einfach noch zusätzlich. So bleibt man flexibel, je situation.»
 *
 * **Eine eigene Funktion, nicht ein Zweig in `zaehleAus`.** Dort hängen
 * Wertquoten, Betroffenenzustimmung, ruhende Vertretungen und die Liste der
 * fehlenden Zustimmungen an derselben Schleife über die Parteien. Ein Zweig
 * darin hätte jeden dieser Wege anfassen müssen — und `zaehleAus` ist der
 * rechtliche Kern dieser Anwendung. Was hier gerechnet wird, ist bewusst
 * weniger, und das steht in jedem Rückgabewert.
 *
 * **Was diese Rechnung NICHT weiss und auch nicht behauptet:**
 *
 * * **Wer wie gestimmt hat.** `ohneZustimmung` bleibt leer, und ein Hinweis
 *   sagt es. Ohne ihn läse man die leere Liste als «alle haben zugestimmt».
 * * **Die Wertquoten.** Der Quotenspiegel bleibt bei null — nicht «null
 *   Wertquoten dafür», sondern «nicht erhoben». Deshalb ist er nur dort
 *   zulässig, wo keine Quotenschranke gilt (`summenhindernis`).
 * * **Ob die im Ausstand Stehenden mitgezählt wurden.** Die Anwendung nimmt sie
 *   aus der Bezugsgrösse; ob die gezählten Hände sie enthielten, kann nur die
 *   Sitzungsleitung wissen. Ein Hinweis sagt das, statt es zu verschweigen.
 * * **Ob die Betroffenen mitgezählt wurden**, wo die Kopfbasis sie ausnimmt
 *   (`alle_ausser_betroffene`, seit 25.09.2026). Dieselbe Lage wie beim
 *   Ausstand: Der Beklagte sitzt im Saal und kann die Hand heben, und die
 *   Vorabprüfung fängt das nur, wenn alle Anwesenden gezählt wurden.
 */
export function zaehleSummenAus(
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	summe: Handzaehlung
): Auszaehlung {
	// Das zweite Ergebnis aus denselben Summen (Migration 169). Lässt sich das
	// andere Mehr daraus nicht bestimmen, sagt der Satz das.
	// Mit der Lage zum Rückkommen wie `zaehleAus` (B2b). Unter L6 lehnt schon die
	// Summenzählung ab; die Angabe hält die beiden Wege nur gleich gebaut.
	const mitLesart = mitAndererKopfzaehlweise(
		mitAndererLesart(
			zaehleSummenOhneLesart(lage, summe),
			lage.erfordernis,
			(anderes) => zaehleSummenOhneLesart({ ...lage, erfordernis: anderes }, summe),
			lage.nachRueckkommen
		),
		lage.erfordernis,
		// L13 aus denselben Summen (Block C): Ja und Nein bleiben, die Bezugsgrösse
		// nimmt die Abwesenden und die Personen im Ausstand auf oder nicht.
		(anderes) => zaehleSummenOhneLesart({ ...lage, erfordernis: anderes }, summe)
	);
	// Das zweite Ergebnis nach der anderen Zählweise (L3): aus der zweiten
	// Dreizahl, wo sie erfasst ist; wo sie fehlt, aus der ersten (Migration 172).
	// Dann wiegt jede anwesende Partei in beiden Zählweisen gleich, die Stimmen
	// sind also dieselben; die Bezugsgrösse rechnet trotzdem nach der anderen
	// Zählweise, denn unter einer Regel, die Abwesende mitzählt, können diese
	// je Einheit anders wiegen (Review DeepSeek zu Block 5, Befund 4).
	const mitZaehlweise = mitAndererZaehlweise(mitLesart, lage, (anderes) => {
		const andere = andereDreizahlVon(summe);
		if (!andere) return zaehleSummenOhneLesart({ ...lage, erfordernis: anderes }, summe);
		/*
		 * **Eine Absage zur zweiten Zählung nennt die zweite** (Abnahme Block 5).
		 * Die Prüfungen in `zaehleSummenOhneLesart` sprechen von «Ja» und dem
		 * Feld der ersten Zählung; ohne diesen Zusatz sucht die Leitung den Fehler
		 * in der Zahl, die stimmt.
		 */
		try {
			return zaehleSummenOhneLesart({ ...lage, erfordernis: anderes }, andere);
		} catch (f) {
			throw alsZweiteZaehlung(f, lage.erfordernis);
		}
	});
	// L10 aus denselben Summen (Codeprüfung E1 Block D, M2): Ja und Nein bleiben,
	// nur die Bezugsgrösse nimmt die Angehörigen im Ausstand auf oder nicht. Ohne
	// das verspräche der Satz vor der Abstimmung (W11) ein Ergebnis, das bei der
	// Handzählung nicht käme.
	const mitAngehoerigen = mitAndererAngehoerigenlesart(mitZaehlweise, lage, (anderes) =>
		zaehleSummenOhneLesart({ ...lage, erfordernis: anderes }, summe)
	);
	// 1a und Anhang A aus denselben Summen (Lesarten Block 6): Die Köpfe der
	// anderen Zählbasis lassen sich daraus bilden, ein Mehr mit Wertquoten nicht.
	const mitFesten = mitFestenVergleichen(mitAngehoerigen, lage.erfordernis, (anderes) =>
		zaehleSummenOhneLesart({ ...lage, erfordernis: anderes }, summe)
	);
	// B3 aus denselben Summen (F4c): Die ruhend Vertretenen kommen ohne Stimme
	// in die Bezugsgrösse. L8 (Migration 184) daneben: derselbe Ausstand aus
	// der Einstellung der Gemeinschaft, der diesmal nicht wirkt. Die Grenze
	// unter «Vollmachten ruhen» (Entscheid 2, 06.11.2026) addiert die Köpfe der
	// ruhenden Vertretungen zu Ja bzw. Nein; die Wertquoten bleiben, wie sie
	// bei einer Handzählung immer bleiben, unerhoben (`summenhindernis`).
	return mitAndererVerwaltungsvollmacht(
		mitVertretungImAusstand(mitFesten, lage, () =>
			zaehleSummenOhneLesart({ ...lage, vertretungImAusstandInDerZahl: true }, summe)
		),
		lage,
		(imAusstand) => zaehleSummenOhneLesart({ ...lage, imAusstand }, summe),
		(imAusstand, ruhend, richtung) => {
			const gewicht = ruhend.reduce(
				(s, p) => s + kopfgewicht(p, zaehlweiseFuer(lage.erfordernis, lage.momentaufnahme), lage.momentaufnahme.parkingCountsAsHead),
				0
			);
			return zaehleSummenOhneLesart(
				{ ...lage, imAusstand },
				richtung === 'yes' ? { ...summe, ja: summe.ja + gewicht } : { ...summe, nein: summe.nein + gewicht }
			);
		},
		// N-4 (07.11.2026): Die Grenzen unter «Die Sitzungsleitung entscheidet»
		// mit Summen rechnet dieselbe Handzählung, nachdem die Köpfe der
		// Verwaltung aus der Dreizahl herausgefallen sind; `weg` sagt, aus
		// welchen Zahlen sie fielen. Der Ausstand aus L8 steht diesmal in der
		// Liste, nach der gerechnet wird, weil er nach der anderen Wahl wirkt.
		(imAusstand, weg) =>
			zaehleSummenOhneLesart(
				{ ...lage, imAusstand },
				{
					...summe,
					ja: summe.ja - weg.ja,
					nein: summe.nein - weg.nein,
					enthaltung: summe.enthaltung - weg.enthaltung
				}
			)
	);
}

/**
 * Ein Fehler der zweiten Zählung, mit ihrem Namen und ihrem Feld (Abnahme
 * Block 5; Codeprüfung der Fixes, Niedrig 3: nicht immer «Ja»).
 */
function alsZweiteZaehlung(f: unknown, e: Erfordernis): unknown {
	if (!(f instanceof FachlicherFehler)) return f;
	const art = einsprachelesartVon(e) === 'je_eigentuemer' ? 'je Einheit' : 'je Eigentümer';
	const feld = f.feld === 'nein' ? 'andereNein' : f.feld === 'enthaltung' ? 'andereEnthaltung' : 'andereJa';
	return new FachlicherFehler(f.kennung, `In der Zählung ${art}: ${f.message}`, feld);
}

/**
 * Prüft die zweite Dreizahl der Handzählung für sich, als Zählung nach der
 * anderen Wahl L3: ganze Zahlen, ihre eigene Obergrenze.
 *
 * **Warum eigens** (Codeprüfung Block 5, N2): Bei offenem Stichentscheid
 * rechnet `zaehleSummenAus` das zweite Ergebnis nicht, und eine zu hohe oder
 * gebrochene Zahl stünde in der Datenbank, bis sie nach dem Stichentscheid beim
 * Lesen wirft. `erfasseSummen` ruft das deshalb vor dem Schreiben. Ohne zweite
 * Dreizahl oder wo L3 nicht wirkt, gibt es nichts zu prüfen.
 */
export function pruefeAndereDreizahl(lage: Omit<Auszaehlungslage, 'stimmen'>, summe: Handzaehlung): void {
	const andere = andereDreizahlVon(summe);
	const e = lage.erfordernis;
	if (!andere || !l3Wirkt(e, lage.momentaufnahme)) return;
	const anders = einsprachelesartVon(e) === 'je_eigentuemer' ? 'je_einheit' : 'je_eigentuemer';
	try {
		zaehleSummenOhneLesart({ ...lage, erfordernis: { ...e, einspracheLesart: anders } }, andere);
	} catch (f) {
		throw alsZweiteZaehlung(f, e);
	}
}

/**
 * Die Kopfstimmen einer Partei an einem Erfordernis, nach der Zählweise, nach
 * der es rechnet (`zaehlweiseFuer`). Für Anzeigen an der laufenden Abstimmung:
 * Erfassungsliste der Leitung, Bestätigung auf `/z` (Codeprüfung Block 5, N1
 * und M-b). Ohne Erfordernis die Zählweise der Gemeinschaft.
 */
export function kopfstimmenAn(
	partei: { units: Snapshot['parties'][number]['units'] },
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'einspracheLesart'> | null | undefined,
	m: Pick<Snapshot, 'headCountMode' | 'parkingCountsAsHead'>
): number {
	const zaehlweise = e ? zaehlweiseFuer(e, m) : m.headCountMode;
	return kopfgewicht(partei, zaehlweise, m.parkingCountsAsHead);
}

function zaehleSummenOhneLesart(
	lage: Omit<Auszaehlungslage, 'stimmen'>,
	summe: Handzaehlung
): Auszaehlung {
	const { momentaufnahme: m, erfordernis: e } = lage;

	// Die Zählweise dieses Erfordernisses, wie in `zaehleAus` (`zaehlweiseFuer`):
	// Jede Dreizahl hat ihre eigene Obergrenze an den anwesenden Köpfen.
	const zaehlweise = zaehlweiseFuer(e, m);

	const hindernis = summenhindernis(e);
	if (hindernis) throw new FachlicherFehler('summe_unzulaessig', hindernis, 'erfordernis');
	// Nach `summenhindernis` steht die Kopfschwelle; TypeScript weiss das nicht.
	const kopfSchwelle = e.kopfSchwelle!;

	for (const [name, wert] of [
		['Ja', summe.ja],
		['Nein', summe.nein],
		['Enthaltung', summe.enthaltung]
	] as const) {
		if (!Number.isInteger(wert) || wert < 0) {
			throw new FachlicherFehler(
				'summe_ungueltig',
				`«${name}» braucht eine ganze Zahl ab null.`,
				name.toLowerCase()
			);
		}
	}

	const betroffene = lage.betroffeneParteiIds ?? [];
	verlangeBezeichneteBetroffene(e, betroffene);

	const anwesend = new Set(lage.anwesende);
	const ausstandsmenge = parteienImAusstand(lage.imAusstand);
	const betroffeneMenge = new Set(betroffene);
	const hinweise: string[] = [];
	const protokollhinweise: Protokollhinweis[] = [];

	// Wer ausgeschlossen ist, kann niemanden vertreten: dieselbe Funktion wie in
	// `zaehleAus`, damit die beiden Zählungen nicht wieder auseinanderlaufen.
	// Die vertretene Partei gilt dann als abwesend.
	const vertretungsnamen = new Map(m.parties.map((p) => [p.partyId, p.displayName]));
	const name = (id: Id) => vertretungsnamen.get(id) ?? id;
	const ruhend = ruhendeVertretungenBei(
		lage.vertretungen ?? [],
		vomStimmrechtAusgeschlossen(e, lage.imAusstand ?? [], lage.betroffeneParteiIds ?? []),
		anwesend
	);
	// Dieselbe Ersetzung wie in `zaehleOhneWirkung` (Entscheid 3, 06.11.2026):
	// eine Zeile für alle, die aus L8 ruhen, statt einer je Partei.
	const ruhenAusVerwaltung: string[] = [];
	for (const r of ruhend.values()) {
		const ueber = r.bevollmaechtigtName ?? name(r.bevollmaechtigtId);
		// Dieselbe Unterscheidung wie in `zaehleOhneWirkung` (Lauf 4, 07.11.2026).
		const ausVerwaltung = (lage.ausstandAusVerwaltung ?? []).includes(r.bevollmaechtigtId);
		hinweise.push(ruhendInWorten(name(r.vertreteneId), ueber, r.grund, e.knotenId, ausVerwaltung));
		if (ausVerwaltung) {
			ruhenAusVerwaltung.push(name(r.vertreteneId));
			continue;
		}
		protokollhinweise.push({
			ort: 'bezugsgroesse',
			satz: ruhendProtokollInWorten(
				name(r.vertreteneId),
				ueber,
				r.grund === 'betroffen' && e.knotenId === EINSPRACHE_KNOTEN
			)
		});
	}
	if (ruhenAusVerwaltung.length > 0) {
		protokollhinweise.push(verwaltungsruhenProtokollhinweis(ruhenAusVerwaltung));
	}
	const ruht = new Set(ruhend.keys());

	const alleBeklagt = new Set(lage.alleEigentuemerBeklagt ?? []);
	const stumm = stummeBeklagtenwohnungen(m, e, betroffeneMenge, alleBeklagt);
	const beklagtenwohnungen = beklagtenwohnungenIn(m, e, betroffeneMenge, alleBeklagt);
	for (const p of ganzBeklagteWohnungen(m, e, betroffeneMenge, alleBeklagt)) {
		hinweise.push(ganzBeklagtInWorten(p.displayName));
	}
	let anwesendeKoepfe = 0;
	let abwesendeKoepfe = 0;
	let stummeKoepfe = 0;
	// B3 (F4c): ruhend Vertretene, die in der zweiten Rechnung ohne Stimme
	// mitzählen. Nicht in `anwesendeKoepfe`, denn abstimmen konnten sie nicht.
	let ohneStimmeKoepfe = 0;
	// Im Ausstand, aber in der Zahl (1e): stimmt nicht und steht in der Basis.
	let ausstandKoepfe = 0;
	const ausstandInDerZahl = ausstandInDerZahlBei(e, ausstandsmenge, betroffeneMenge);
	for (const p of m.parties) {
		if (!kommtInDerZaehlungVor(p.partyId, e, ausstandsmenge, betroffeneMenge, stumm, ausstandInDerZahl))
			continue;
		if (stumm.has(p.partyId)) hinweise.push(beklagtenwohnungInWorten(p.displayName));
		const gewicht = kopfgewicht(p, zaehlweise, m.parkingCountsAsHead);
		if (stumm.has(p.partyId)) stummeKoepfe += gewicht;
		else if (ausstandInDerZahl.has(p.partyId)) ausstandKoepfe += gewicht;
		else if (anwesend.has(p.partyId) && !ruht.has(p.partyId)) anwesendeKoepfe += gewicht;
		else if (
			lage.vertretungImAusstandInDerZahl &&
			anwesend.has(p.partyId) &&
			ruhend.get(p.partyId)?.grund === 'ausstand'
		)
			ohneStimmeKoepfe += gewicht;
		else abwesendeKoepfe += gewicht;
	}

	const abgegeben = summe.ja + summe.nein + summe.enthaltung;
	if (abgegeben > anwesendeKoepfe) {
		// Mit der Zählweise im Satz (Migration 172, «im Saal stehen n Stimmen je
		// Einheit zur Verfügung»), damit die Leitung weiss, wonach zu zählen ist.
		const zaehlweiseImSatz = zaehlweise === 'per_owner' ? 'je Eigentümer' : 'je Einheit';
		throw new FachlicherFehler(
			'summe_zu_hoch',
			`Gezählt sind ${abgegeben} Stimmen, im Saal stehen ${anwesendeKoepfe} Stimmen ` +
				`${zaehlweiseImSatz} zur Verfügung. Mehr Stimmen als Stimmberechtigte kann es nicht ` +
				'geben — prüfen Sie die Zählung oder die Anwesenheit.',
			'ja'
		);
	}

	const koepfe: Stimmenspiegel = {
		ja: summe.ja,
		nein: summe.nein,
		enthaltung: summe.enthaltung,
		ohneAbgabe: anwesendeKoepfe - abgegeben + ohneStimmeKoepfe,
		nichtAnwesend: abwesendeKoepfe,
		...(stummeKoepfe > 0 ? { stimmtNicht: stummeKoepfe } : {}),
		...(ausstandKoepfe > 0 ? { imAusstand: ausstandKoepfe } : {}),
		basis: 0,
		schwelle: null,
		erreicht: false
	};
	/*
	 * **Dieselbe Regel wie bei der einzelnen Erfassung** (04.09.2026, aus dem
	 * Code-Review). Nimmt das Reglement die Enthaltungen aus der Bezugsgrösse,
	 * gilt das auch für die Handzählung. Sonst ergäbe derselbe Antrag einzeln
	 * erfasst «angenommen» und von Hand gezählt «abgelehnt», und der Weg zur
	 * Handzählung ist ausgerechnet die Auszählmappe für den Ausfall.
	 */
	koepfe.basis =
		koepfe.ja +
		koepfe.nein +
		(e.enthaltungZaehltMit === false && !abwesendeZaehlenMit(e.kopfbasis)
			? 0
			: koepfe.enthaltung) +
		koepfe.ohneAbgabe +
		(abwesendeZaehlenMit(e.kopfbasis) ? koepfe.nichtAnwesend + stummeKoepfe + ausstandKoepfe : 0);
	koepfe.schwelle = koepfe.basis > 0 ? schwellenwert(koepfe.basis, kopfSchwelle) : null;
	koepfe.erreicht = koepfe.schwelle !== null && koepfe.ja >= koepfe.schwelle;

	/*
	 * **Der Quotenspiegel bleibt leer — und das heisst «nicht erhoben».**
	 *
	 * `erreicht: true` ist hier kein Urteil über Wertquoten, sondern die Aussage
	 * «keine Quotenschranke im Weg» — dasselbe, was `zaehleAus` bei
	 * `quotenbasis === 'keine'` setzt. Dass es keine gibt, hat `summenhindernis`
	 * vorher sichergestellt.
	 */
	const quoten = leererSpiegel();
	quoten.erreicht = true;

	// Der Punkt nach dem Vermerk fehlte bis A3c; seit der Vermerk bei den
	// Wertquoten Pflicht ist, lief der Satz dort jedes Mal in den nächsten.
	hinweise.push(
		'Von Hand gezählt, ohne Zuordnung zu Personen' +
			(summe.vermerk ? `: ${summe.vermerk.trim().replace(/[.!?]$/, '')}.` : '.') +
			' Es ist deshalb nicht festgehalten, wer wie gestimmt hat, und die Stimmen nach ' +
			'Wertquoten sind nicht erhoben. Das Erfordernis verlangt hier keine Mehrheit der ' +
			'Wertquoten.'
	);
	if (ausstandsmenge.size > 0) {
		hinweise.push(
			`${ausstandsmenge.size} ${ausstandsmenge.size === 1 ? 'Partei steht' : 'Parteien stehen'} ` +
				`im Ausstand und ${ausstandsmenge.size === 1 ? 'gibt' : 'geben'} hier keine Stimme ` +
				'ab. Ob die gezählten Hände sie enthielten, kann die Anwendung nicht prüfen — das ' +
				'weiss nur, wer gezählt hat.'
		);
	}
	const betroffenImSaal =
		betroffeneStimmenNichtMit(e)
			? m.parties.filter(
					(p) =>
						betroffeneMenge.has(p.partyId) &&
						!ausstandsmenge.has(p.partyId) &&
						!stumm.has(p.partyId) &&
						anwesend.has(p.partyId)
				).length
			: 0;
	if (e.zustimmungBetroffenerNoetig) {
		for (const id of betroffeneAusserhalbDesStands(m, betroffene)) {
			hinweise.push(nichtImStandInWorten(id));
		}
	}
	if (betroffenImSaal > 0) {
		hinweise.push(
			`${betroffenImSaal} ${betroffenImSaal === 1 ? 'anwesende Partei ist' : 'anwesende Parteien sind'} ` +
				`unmittelbar betroffen und ${betroffenImSaal === 1 ? 'zählt' : 'zählen'} hier nicht mit. ` +
				'Ob die gezählten Hände sie enthielten, kann die Anwendung nicht prüfen. Das weiss ' +
				'nur, wer gezählt hat.'
		);
	}

	/*
	 * **Der Stichentscheid nach Wertquoten kann hier nicht greifen.** Er
	 * vergleicht die Quoten der abgegebenen Stimmen, und die gibt es nicht. Ihn
	 * zu überspringen hiesse, den Gleichstand als Ablehnung zu verkünden, obwohl
	 * das Reglement etwas anderes vorsieht — deshalb bleibt das Ergebnis offen.
	 *
	 * **Und der Gleichstand ist derselbe wie in der Einzelzählung** (27.09.2026):
	 * Ja gleich Nein **und** Ja gleich der halben Bezugsgrösse. Sonst hob der
	 * Quotenstichentscheid hier ein verfehltes Mehr auf.
	 */
	const gleichstand =
		m.tieBreak !== 'keiner' &&
		!koepfe.erreicht &&
		stichentscheidMoeglich(e) &&
		koepfe.ja > 0 &&
		koepfe.ja === koepfe.nein &&
		koepfe.ja * 2 === koepfe.basis;

	let durchStichentscheid = false;
	let stichentscheidOffen = false;

	/*
	 * Bei einer Kaskade gilt dasselbe wie beim Quotenstichentscheid allein: Ob
	 * die Wertquoten den Gleichstand auflösen oder an die Person weitergeben,
	 * lässt sich aus der Handzählung nicht ablesen. Die Person darf deshalb
	 * nicht entscheiden, bevor die Quoten erhoben sind.
	 */
	const person = personenstufe(m.tieBreak);
	let stichentscheidArt: 'wertquote' | 'verwalter' | 'vorsitz' | null = null;

	if (gleichstand && quotenstufe(m.tieBreak)) {
		stichentscheidArt = 'wertquote';
		stichentscheidOffen = true;
		hinweise.push(
			`Gleichstand bei den Kopfstimmen (${koepfe.ja} zu ${koepfe.nein}). Nach dem Reglement ` +
				'entscheidet die Anteilsberechtigung; sie lässt sich aus einer Handzählung nicht ' +
				'ablesen. Mit einer Neuabstimmung und einzeln erfassten Stimmen steht das Ergebnis.'
		);
	} else if (gleichstand && person) {
		/*
		 * **Auch bei der Handzählung gilt die Klausel wieder** (Produktentscheid
		 * 28.09.2026): Der Gleichstand steht aus den Summen fest, und die Person
		 * trägt ihren Entscheid ein. Fehlt er, bleibt das Ergebnis offen; eine
		 * Ablehnung durch Stichentscheid trägt `durchStichentscheid`.
		 */
		stichentscheidArt = person;
		const entscheid = lage.stichentscheid;
		if (!entscheid) {
			stichentscheidOffen = true;
		} else {
			durchStichentscheid = true;
			if (entscheid.wahl === 'yes') koepfe.erreicht = true;
		}
		hinweise.push(verwalterKlauselHinweis(koepfe.ja, koepfe.nein, entscheid, person));
	}

	// A5, Punkt 12b: wie in der Einzelzählung, für beide Zählwege.
	if (stichentscheidNichtAngewandt(lage, koepfe)) {
		protokollhinweise.push({ ort: 'ausgang', satz: STICHENTSCHEID_NICHT_ANGEWANDT });
	}

	return {
		koepfe,
		quoten,
		...(beklagtenwohnungen.length > 0 ? { beklagtenwohnungen } : {}),
		quotenErhoben: false,
		// Nur die Köpfe: Die Wertquoten sind bei der Handzählung nicht erhoben.
		ausstandswirkung: ausstandswirkung(lage, koepfe.basis, null),
		/*
		 * **Die Betroffenen trotzdem führen** (Block A3c). `summenhindernis`
		 * lässt die Handzählung bei nötiger Zustimmung nur bei `nachher` zu, und
		 * dort hängt die ausstehende Zustimmung an keiner Stimme. Wer im Saal Ja
		 * sagte, weiss die Handzählung nicht; `zugestimmt` bleibt deshalb leer,
		 * und `erfuellt` ist bei `nachher` immer wahr. Ein Veto-Entscheid hat
		 * hier keinen Ort: Es gibt ihn nur bei `im_saal_oder_vorab`.
		 */
		betroffene: {
			noetig: e.zustimmungBetroffenerNoetig,
			form: betroffenenzustimmungVon(e),
			zugestimmt: [],
			fehlend: [],
			vorab: [],
			ausstehend: e.zustimmungBetroffenerNoetig ? ausstehendeZustimmungen(m, betroffene) : [],
			veto: [],
			erfuellt: true
		},
		// Leer, weil unbekannt — der Hinweis oben sagt es. Ohne ihn läse man die
		// leere Liste als «niemand hat gefehlt».
		ohneZustimmung: [],
		angenommen: koepfe.erreicht && !stichentscheidOffen,
		durchStichentscheid,
		stichentscheidOffen,
		stichentscheidArt: durchStichentscheid || stichentscheidOffen ? stichentscheidArt : null,
		geheim: lage.geheim === true,
		hinweise,
		protokollhinweise
	};
}
