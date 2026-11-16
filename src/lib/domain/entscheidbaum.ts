/**
 * Herleitung des Mehrheitserfordernisses (Story 2.2, FR-19, AD-1, AD-4).
 *
 * Der Baum wird **gelaufen**, nicht gespeichert: Aus dem Ast und der Folge der
 * gegebenen Antworten ergibt sich jederzeit derselbe Stand. Das hält die Sache
 * ohne Sitzungszustand aus, macht den Rücksprung zu einer Frage zu einer blossen
 * Kürzung der Antwortliste — und erlaubt es, den beschrittenen Pfad an einem
 * Traktandum zu speichern und Jahre später gegen dieselbe Fassung nachzugehen.
 *
 * Keine Rechtsregel steht hier im Code (AD-4). Diese Datei kennt die Gestalt des
 * Regelwerks, nicht seinen Inhalt.
 */
import { istKalendertag } from './datum';
import { FachlicherFehler } from './gemeinschaft';
import { ALLE, EINFACHE_MEHRHEIT, mehrheitsschwelle, quotenschwelle, type Schwelle } from './mehrheit';
import type { HeadCountMode } from './types';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import {
	knotenVon,
	frageVon,
	regelNurFallgenau,
	type Geschaeftsart,
	typdefinition,
	bezugsgroessenHinweis,
	bezugsgroessensatz,
	quotenwirkungssatz,
	stimmwirkungsteile,
	strenge,
	UMSTRITTEN_SATZ,
	type Ast,
	type Betroffenenzustimmung,
	type Ergebnisknoten,
	type Ergebnistyp,
	type Frage,
	type HinweisUnterRegel,
	type Kopfbasis,
	type Quotenbasis,
	type Regelwerk,
	type Reglementsverhalten
} from './regelwerk';
import { zeichenzahl } from './zeichenzahl';
import { teileHilfe, type GeteilteHilfe } from './hilfetext';
import {
	angehoerigenlesartVon,
	einsprachelesartKartensatz,
	einsprachelesartVon,
	lesartAusKnoten,
	ausstandBleibtNachZaehlweise,
	type Angehoerigenlesart,
	type AngewandteLesart,
	type Ausstandswahl,
	type Einsprachewahl,
	type Kopfzaehlweise,
	type Lesartmehr
} from './lesarten';

/** Ein beantworteter Schritt. Trägt die Texte mit, damit der Pfad auch nach einer Fassungsablösung lesbar bleibt. */
export interface Schritt {
	frageId: string;
	frageText: string;
	antwortId: string;
	antwortText: string;
}

/**
 * Eine Frage, wie sie auf den Bildschirm geht: ohne Auszeichnung und mit der
 * Hilfe in Anfang und Rest geteilt (`teileHilfe`, 26.09.2026). Geteilt wird
 * der Quelltext, erst danach fällt die Auszeichnung weg; so trennt Votum an
 * derselben Stelle wie der Export für die Website (Codeprüfung 26.09.2026:
 * Wer den Anzeigetext teilte, verschob die Schwellen um die entfernten
 * Zeichen und verlor den Schutz vor einer Naht in einer Hervorhebung).
 */
export type AnzeigeFrage = Frage & { hilfeTeile: GeteilteHilfe | null };

export type Stand =
	| { art: 'frage'; frage: AnzeigeFrage }
	| { art: 'ergebnis'; knoten: Ergebnisknoten };

/**
 * Entfernt die Fett-Auszeichnung aus einem Text, bevor er angezeigt wird.
 *
 * **Warum es sie überhaupt gibt** (23.09.2026): Die Regelwerksdaten haben zwei
 * Verbraucher. Der Website-Abzug wandelt `**Fett**` in `<strong>` um, weil die
 * Insel dort HTML rendert (`scripts/quorumsbaum-export.mjs`, Kopf). Votum gibt
 * denselben Text als gewöhnliche Svelte-Interpolation aus und zeigte die
 * Sternchen deshalb wörtlich: drei Stellen in den Hilfetexten der
 * Basisfassung, «Massgebend ist der Nutzen der **Gemeinschaft**» und zweimal
 * **und** in der Erklärung zu Art. 647e Abs. 2.
 *
 * **Warum die Behebung hier steht und nicht in der Fassung:** Die Hilfetexte
 * stehen in der Basisfassung 2026-07-30, und alle späteren erben sie. Wer sie
 * dort entfernt, ändert rückwirkend, was ausgelieferte Fassungen anzeigen, und
 * genau davor schützt AD-4. Die Quelle behält ihre Auszeichnung, die Anzeige
 * zeigt sie nicht mehr.
 *
 * **Und warum entfernen statt rendern:** Rendern hiesse `@html`, also ein Weg,
 * über den künftig jeder Kartentext ungeprüft als HTML durchginge. Für drei
 * fett gesetzte Wörter in einem Hilfetext ist das kein Tausch, den man machen
 * sollte.
 */
function ohneAuszeichnung(text: string): string {
	return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Die Frage, wie sie auf den Bildschirm geht. Die Fassungsdaten selbst bleiben
 * unberührt; es wird kopiert, nicht überschrieben.
 */
function zurAnzeige(frage: Frage): AnzeigeFrage {
	const teile = frage.hilfe ? teileHilfe(frage.hilfe) : null;
	return {
		...frage,
		hilfeTeile: teile
			? {
					anfang: ohneAuszeichnung(teile.anfang),
					mehr: teile.mehr === null ? null : ohneAuszeichnung(teile.mehr)
				}
			: null,
		text: ohneAuszeichnung(frage.text),
		hilfe: frage.hilfe ? ohneAuszeichnung(frage.hilfe) : frage.hilfe,
		antworten: frage.antworten.map((a) => ({
			...a,
			text: ohneAuszeichnung(a.text),
			hilfe: a.hilfe ? ohneAuszeichnung(a.hilfe) : a.hilfe
		}))
	};
}

export interface Lauf {
	astId: string;
	schritte: Schritt[];
	stand: Stand;
}

/**
 * Woher das Erfordernis stammt.
 *
 * Steht auf der Ergebniskarte und im Protokoll. Der Unterschied ist keine
 * Feinheit: Ein hergeleitetes Erfordernis ist ein Vorschlag des Werkzeugs, ein
 * gewähltes eine Entscheidung der Sitzungsleitung, ein aus dem Reglement
 * stammendes die Anwendung einer hinterlegten Regel.
 */
export type Erfordernisquelle = 'hergeleitet' | 'gewaehlt' | 'reglement';

/**
 * Das geschlossene Wertobjekt, das später an einem Traktandum hängt (AD-4).
 *
 * Es trägt alles, was gebraucht wird, um das Ergebnis zu erklären: die Fassung,
 * den Weg dorthin und die Bezugsgrössen. Serialisierbar, ohne Verweis auf das
 * Regelwerk — sonst hinge die Erklärbarkeit daran, dass die Fassung noch geladen
 * werden kann.
 */
export interface Erfordernis {
	fassung: string;
	juristischGegengelesen: boolean;
	astId: string;
	knotenId: string;
	typ: Ergebnistyp;
	titel: string;
	rechtsgrundlage: string;
	kopfbasis: Kopfbasis;
	quotenbasis: Quotenbasis;
	/** Die Schwellen als Brüche. Ohne sie liesse sich später nicht nachrechnen. */
	kopfSchwelle: Schwelle | null;
	quotenSchwelle: Schwelle | null;
	/** Anknüpfungspunkt für Reglementsabweichungen — stabil über Regelfassungen. */
	geschaeftsart?: Geschaeftsart;
	/**
	 * Was eine hinterlegte Regel hier darf (ab Fassung 2026-08-15). Wandert mit
	 * dem Erfordernis, damit die Übersteuerung fassungsgerecht bleibt: Ein altes
	 * Traktandum ohne das Merkmal wird nachgerechnet, wie es damals gerechnet
	 * wurde (typbasierte Sperre).
	 */
	reglementsverhalten?: Reglementsverhalten;
	/**
	 * Ob Enthaltungen in der Bezugsgrösse bleiben (04.09.2026).
	 *
	 * **`undefined` heisst «zählen mit»**, und zwar aus zwei Gründen: So hat die
	 * Anwendung immer gerechnet, und so wird ein Traktandum aus der Zeit vor
	 * diesem Feld auch später nachgerechnet. Nur ein ausdrückliches `false`
	 * nimmt sie heraus.
	 *
	 * **Warum es hier steht und nicht nur in der Regel.** Es kam aus einer
	 * hinterlegten Reglementsregel (`enthaltungZaehltMit`), war dort seit dem
	 * 15.08.2026 erfasst, gespeichert und angezeigt, und wurde nie gerechnet:
	 * `zaehleAus` sieht nur das Erfordernis, und das Erfordernis führte das Feld
	 * nicht. Gefunden am 04.09.2026 in einem Prüfdurchgang, gemessen an einem
	 * Antrag, den die Anwendung als abgelehnt verkündete, während die
	 * angezeigte Regel ihn annimmt.
	 *
	 * Dass es **am Erfordernis** hängt und nicht als Parameter durchgereicht
	 * wird, hat denselben Grund wie bei `reglementsverhalten`: Das Erfordernis
	 * ist der Nachweis. Was die Rechnung bestimmt hat, muss darin stehen, sonst
	 * lässt sich ein Beschluss später nicht nachrechnen.
	 */
	enthaltungZaehltMit?: boolean;
	zustimmungBetroffenerNoetig: boolean;
	/**
	 * Wie die Zustimmung der Betroffenen erteilt wird, wo eine nötig ist
	 * (25.09.2026): im Saal oder vorab, oder erst nachher mit der
	 * Abänderungsurkunde. Fehlt das Feld, ordnet `betroffenenzustimmungVon`
	 * es über die Kennung zu; jedes Erfordernis vor dieser Fassung kennt es
	 * nicht.
	 *
	 * **Gespeichert seit Migration 124** (Block A2) in
	 * `agenda_item.requirement_affected_consent_form`. Bis dahin trug allein
	 * `knotenId` (`requirement_node`) die Form; Traktanden von vorher haben
	 * die Spalte leer und werden weiter über die Kennung zugeordnet.
	 */
	betroffenenzustimmung?: Betroffenenzustimmung;
	pfad: Schritt[];
	quelle: Erfordernisquelle;
	/** Bei Abweichung vom Vorschlag: die Begründung der Sitzungsleitung (Story 2.3). */
	begruendung?: string;
	/** Bei Abweichung: was der Baum vorgeschlagen hatte. */
	vorschlagTyp?: Ergebnistyp;
	/** Wahr, wenn die Abweichung angreifbar macht (Story 2.3). */
	risiko?: boolean;
	risikoGrund?: 'abschwaechung' | 'gegen_reglement';
	/** Fundstelle im Reglement, wenn das Erfordernis von dort stammt (Story 2.4). */
	fundstelle?: string;
	/**
	 * Die Lesart der Gemeinschaft, nach der das Mehr gebildet ist, mit dem, was
	 * die andere verlangt (Migration 169, `domain/lesarten.ts`). Fehlt sie,
	 * trägt der Knoten keine Lesart oder eine Regel des Reglements gilt.
	 */
	gemeinschaftslesart?: AngewandteLesart;
	/**
	 * Die Lesart L1 der Gemeinschaft (Migration 170): ob die Wertquote im
	 * Ausstand beim Mehr aller Wertquoten im Nenner bleibt. Anders als
	 * `gemeinschaftslesart` ändert sie nicht das Mehr, sondern die Zählung.
	 * Gesetzt von der Datenbank beim Speichern (Auslöser
	 * `agenda_lesart_l1_setzen`); fehlt sie, zählt `ausstandswahlVon` nach der
	 * Vorgabe.
	 */
	ausstandslesart?: Ausstandswahl;
	/**
	 * Die Lesart L3 der Gemeinschaft (Migration 172): ob die Einsprache in einer
	 * Gemeinschaft je Einheit je Eigentümer (Vorgabe) oder je Einheit zählt.
	 * Wie L1 ändert sie nicht das Mehr, sondern die Zählung; gesetzt von der
	 * Datenbank (Auslöser `agenda_lesart_l3_setzen`), fehlt sie, zählt
	 * `einsprachelesartVon` nach der Vorgabe.
	 */
	einspracheLesart?: Einsprachewahl;
	/**
	 * Die Lesart L10 der Gemeinschaft (Migration 189): ob Angehörige des
	 * Beklagten, die im Ausstand sind, an der Ermächtigung zur Ausschlussklage
	 * in der Zahl aller Eigentümer bleiben (Vorgabe) oder aus ihr fallen. Wie L1
	 * ändert sie nicht das Mehr, sondern die Zählung; gesetzt von der Datenbank
	 * (Auslöser `agenda_lesart_l10_setzen`), fehlt sie, zählt
	 * `angehoerigenlesartVon` nach der Vorgabe.
	 */
	angehoerigenlesart?: Angehoerigenlesart;
	/**
	 * Die Lesart L13 der Gemeinschaft (Migration 192): ob die Köpfe bei der
	 * «Mehrheit aller Miteigentümer» unter den Anwesenden und Vertretenen
	 * (Vorgabe) oder unter allen Eigentümern zählen. Anders als L10 ändert sie
	 * das Mehr: Wo sie wirkt (`kopfzaehlweiseWirkt`), setzt sie beim Herleiten
	 * die Kopfbasis (`mitKopfzaehlweise`), und das zweite Ergebnis rechnet nach
	 * der anderen Wahl. Gesetzt von der Datenbank beim Speichern (Auslöser
	 * `agenda_lesart_l13_setzen`) und von `wendeReglementAn`, wo L13 das
	 * Erfordernis betrifft; fehlt sie, gilt die Vorgabe.
	 */
	kopfzaehlweise?: Kopfzaehlweise;
	/**
	 * Das Mehr aus Gesetz und Reglement, wo die Leitung davon abgewichen ist
	 * (Migration 173, Lesarten Block 6, Anhang A). `uebersteuere` legt es zur
	 * Zeit der Wahl ab, denn das Reglement ist nicht eingefroren: Eine
	 * Neuherleitung beim Auszählen läse ein später geändertes. Fehlt es, ist
	 * nicht abgewichen worden, oder das Traktandum stammt von vorher.
	 */
	gesetzlich?: Gesetzesmass;
	/**
	 * Am Rückkommen die Lesart, nach der der aufgehobene Beschluss gerechnet war
	 * (Migration 181; F4c, B2 aus dem Review DeepSeek vom 05.11.2026). Nur
	 * `erfordernisFuerRueckkommen` setzt sie, und sie trägt kein zweites
	 * Ergebnis, nur den Satz der Leitung (`kopfbasisStreit`): Unter L6 «Klausel
	 * anwenden» sagte das Rückkommen sonst den Streit samt «strenger Lesart»,
	 * während der Beschluss selbst die Klausel als Regel der Gemeinschaft
	 * nannte. Ein von Hand gesetztes Mehr und eine Reglementsregel, die das Mehr
	 * ersetzt, tragen sie nicht.
	 *
	 * **Seit B2b auch das Mehr der anderen Wahl und den Ausgang** (Laien- und
	 * Fachprüfung F4c B2, B2-F-2 bis B2-F-4): Ob das Rückkommen nach der anderen
	 * Wahl anders ausginge, und ob der Beschluss die Ja-Stimmen aller
	 * Eigentümer hatte. Davon hängen der Satz zur Lesart an der Karte, der Rat
	 * nach der Abstimmung und das zweite Ergebnis im Durchgang danach ab. In
	 * derselben Spalte wie die Lesart (Migration 181); ältere Rückkommen tragen
	 * die Felder nicht und bekommen diese Sätze nicht.
	 */
	lesartDesBeschlusses?: Pick<AngewandteLesart, 'kennung' | 'wahl'> & {
		andere?: Lesartmehr;
		mitAllen?: boolean;
	};
}

/**
 * Was ein Mehr ausmacht, ohne Herkunft und Wege: genug, um mit derselben
 * Zählung ein zweites Ergebnis zu bilden (`nachGesetzUndReglement`).
 */
export type Gesetzesmass = Pick<
	Erfordernis,
	| 'typ'
	| 'titel'
	| 'kopfbasis'
	| 'kopfSchwelle'
	| 'quotenbasis'
	| 'quotenSchwelle'
	| 'enthaltungZaehltMit'
	| 'zustimmungBetroffenerNoetig'
> & {
	/**
	 * Das Mass kam aus einer angewandten Bestimmung des Reglements (Fachprüfung
	 * E1 L10 Runde 3, R3-F-1). Dort wirkt L10 nicht, und das Ergebnis nach Gesetz
	 * und Reglement rechnet die Angehörigen im Ausstand mit, wie ohne Abweichung.
	 * Ältere Masse tragen das Feld nicht.
	 */
	ausReglement?: true;
	/**
	 * Die Rechtsgrundlage, nur wo L13 «Alle Eigentümer» am Mass wirkt
	 * (Codeprüfung Block C, M3): `uebersteuere` leert die Rechtsgrundlage der
	 * Wahl, und ohne sie verlöre das Ergebnis nach Gesetz und Reglement den
	 * Ausstand in der Zahl (`ausstandBleibtNachZaehlweise`). Sonst fehlt das Feld.
	 */
	rechtsgrundlage?: string;
};

/** Das Mass eines Erfordernisses, wie es `gesetzlich` trägt. */
export function gesetzesmassVon(e: Erfordernis): Gesetzesmass {
	return {
		typ: e.typ,
		titel: e.titel,
		kopfbasis: e.kopfbasis,
		kopfSchwelle: e.kopfSchwelle,
		quotenbasis: e.quotenbasis,
		quotenSchwelle: e.quotenSchwelle,
		// `undefined` heisst «zählen mit» und überlebt JSON nicht; ausgeschrieben.
		enthaltungZaehltMit: e.enthaltungZaehltMit !== false,
		zustimmungBetroffenerNoetig: e.zustimmungBetroffenerNoetig,
		...(e.quelle === 'reglement' ? { ausReglement: true as const } : {}),
		...(ausstandBleibtNachZaehlweise(e) ? { rechtsgrundlage: e.rechtsgrundlage } : {})
	};
}

/**
 * Der Vorsatz im Titel eines Rückkommens auf einen gefassten Beschluss
 * (`erfordernisFuerRueckkommen`). Daran erkennt die Auszählung das Rückkommen
 * auch im eingefrorenen Erfordernis, das Pfad und Fassung nicht trägt; 1a und
 * Anhang A gehören an den Beschluss, nicht an seine Aufhebung (Codeprüfung
 * Block 6, M1).
 */
export const RUECKKOMMEN_TITEL = 'Wie der Beschluss, der aufgehoben werden soll: ';

/** Ob ein Mass ein Mehr trägt, nach dem sich zählen lässt (Codeprüfung Block 6, H1). */
export function gesetzesmassZaehlbar(g: Pick<Gesetzesmass, 'typ' | 'kopfSchwelle'>): boolean {
	return g.typ !== 'grenzfall' && g.typ !== 'keine_abstimmung' && g.kopfSchwelle !== null;
}

/** Ob überhaupt ein Erfordernis feststeht. Beim Grenzfall steht keines. */
export function erfordernisSteht(e: Erfordernis): boolean {
	return e.typ !== 'grenzfall';
}

/**
 * Die Form der Betroffenenzustimmung: an einer Stelle, damit sie sich prüfen
 * lässt (25.09.2026).
 *
 * **Was das Feld nicht trägt.** Erfordernisse, die vor der Fassung 2026-09-28
 * gesetzt wurden, kennen `betroffenenzustimmung` nicht; verkündete Ergebnisse
 * sind seit dem 25.09.2026 festgeschrieben und werden nicht neu gerechnet.
 * Nachrechnen «wie damals» wäre nach der Fachprüfung vom 25.09.2026 aber
 * falsch: Die alte Rechnung erklärte bei Art. 712e Abs. 2 die fehlende
 * Zustimmung zur Ablehnung, und das ist sie nicht. Die Zuordnung steht deshalb
 * hier und nicht an den Aufrufstellen.
 *
 * **Warum über die Kennung und nicht über die Fassung.** Der Unterschied
 * hängt am Geschäft (Nutzungsrecht oder Wertquote), nicht am Alter: Auch ein
 * Erfordernis aus einer neuen Fassung ohne Feld, etwa ein frei gesetztes,
 * braucht eine Antwort. `k-wertquoten-aendern` ist der einzige Knoten mit
 * Zustimmungspflicht, der nach `nachher` gehört; alles andere mit
 * Zustimmungspflicht läuft im Saal oder vorab. Die beiden Knoten tragen das
 * Feld seit der Fassung 2026-09-28 ohnehin selbst.
 *
 * **Und eine Stelle für die Karte.** `ergebniskarte` kennt nur den Knoten und
 * kein `Erfordernis`; sie liest dieselbe Funktion über Kennung und Feld. Zwei
 * Kopien der Zuordnung liefen auseinander, und die Karte sagte etwas anderes
 * als der Satz auf der Leinwand.
 */
export function betroffenenzustimmungVonKnoten(
	knotenId: string,
	betroffenenzustimmung?: Betroffenenzustimmung
): Betroffenenzustimmung {
	return betroffenenzustimmung ?? (knotenId === 'k-wertquoten-aendern' ? 'nachher' : 'im_saal_oder_vorab');
}

/** Dasselbe am Erfordernis: seine Kennung und sein Feld. */
export function betroffenenzustimmungVon(e: Erfordernis): Betroffenenzustimmung {
	return betroffenenzustimmungVonKnoten(e.knotenId, e.betroffenenzustimmung);
}

/**
 * Der Knoten, an dem das Gesetz selbst jemanden aus der Kopfbasis nimmt: die
 * Ermächtigung zur Ausschlussklage (ZGB Art. 649b Abs. 2, «mit Ausnahme des
 * Beklagten»). Die Kennung ist über alle Fassungen stabil.
 */
export const AUSSCHLUSSKLAGE_KNOTEN = 'k-ausschlussklage';

/**
 * Der Knoten des Einsprachebeschlusses nach ZGB Art. 712c Abs. 2 (ab Fassung
 * 2026-10-20). Beschliessen die «übrigen Stockwerkeigentümer»; wer verkauft,
 * vermietet oder belastet, stimmt nicht mit. Die Kennung ist über alle
 * Fassungen stabil.
 */
export const EINSPRACHE_KNOTEN = 'k-einsprache';

/**
 * Ob die Betroffenen bei diesem Erfordernis nicht mitstimmen und nicht
 * mitzählen, weder selbst noch als Vertretung.
 *
 * Unter `alle_ausser_betroffene` immer. **Bei der Ausschlussklage auch unter
 * jeder anderen Kopfbasis** (Produktentscheid 29.09.2026, `quellen`
 * `fragen.md` Frage 52): Seit der Fassung 2026-10-07 wendet Votum dort eine
 * hinterlegte Klausel an, und die ersetzt die Kopfbasis. Hing der Ausschluss
 * des Beklagten allein an der Kopfbasis, stimmte er unter einer Klausel «der
 * Anwesenden und Vertretenen» über seine eigene Ausschlussklage mit ab.
 *
 * **Bei der Einsprache ebenso** (ab Fassung 2026-10-20): Wer verkauft,
 * vermietet oder belastet, ist von Gesetzes wegen vom Stimmrecht
 * ausgeschlossen (Handschin/Wyttenbach, S. 63; Wermelinger, SVIT-Kommentar
 * 2023, Art. 712c Rz. 185: «die übrigen Stockwerkeigentümer»). Die Kopfbasis
 * des Knotens ist die der Anwesenden; sie allein nähme ihn nicht heraus.
 */
export function betroffeneStimmenNichtMit(e: Pick<Erfordernis, 'kopfbasis' | 'knotenId'>): boolean {
	return (
		e.kopfbasis === 'alle_ausser_betroffene' ||
		e.knotenId === AUSSCHLUSSKLAGE_KNOTEN ||
		e.knotenId === EINSPRACHE_KNOTEN
	);
}

/**
 * Der Hinweis zur Zählweise je Einheit an der Einsprache, oder `null`
 * (Entscheid des Auftraggebers 19.10.2026 nach der Fachprüfung Runde 3, M1).
 *
 * **Ein Hinweis, keine Umrechnung.** Votum zählt weiter nach der Zählweise der
 * Gemeinschaft. Ob eine Zählung je Einheit bei der Einsprache gilt, ist nicht
 * geklärt; sie kann das Mehr erleichtern, und erleichtern lässt es sich hier
 * nie (Rz. 186 ad Art. 712c; nach Gesetz eine Stimme je Eigentümer, Rz. 181
 * ad Art. 712m). Eine Stelle für Karte und Leitung.
 */
export function zaehlweiseBeiEinsprache(
	knotenId: string | undefined,
	zaehlweise: HeadCountMode | null | undefined
): string | null {
	if (knotenId !== EINSPRACHE_KNOTEN || zaehlweise !== 'per_unit') return null;
	return (
		'Ihre Gemeinschaft zählt je Einheit; ob das bei der Einsprache gilt, ist nicht geklärt. Votum ' +
		'zählt je Einheit. Zählen Sie im Saal auch nach Köpfen und halten Sie beide Ergebnisse im ' +
		'Protokoll fest. Gehen sie auseinander, ist der Ausgang in beide Richtungen offen. Eine ' +
		'Einsprache, die nur je Einheit durchkommt, kann vor Gericht scheitern, eine, die nur nach ' +
		'Köpfen durchkommt, kann gelten. Auseinandergehen können sie nur, wenn jemand an mehr als ' +
		'einer Einheit beteiligt ist. Klären Sie dann schon vor der Versammlung mit einer Fachperson, ' +
		'ob Sie eine solche Einsprache überbringen.'
	);
}

/** Die erste Fassung, in der die Einsprache nach der Lesart L3 zählt. */
export const EINSPRACHE_ZAEHLWEISE_AB = '2026-10-28';

/**
 * Ob L3 an diesem Erfordernis wirkt (Migration 172): an der Einsprache ab der
 * Fassung 2026-10-28 und nur in einer Gemeinschaft je Einheit. In einer
 * Gemeinschaft je Eigentümer ergeben beide Wahlen dasselbe, und es gibt kein
 * zweites Ergebnis.
 */
export function l3Wirkt(
	e: Pick<Erfordernis, 'knotenId' | 'fassung'>,
	m: { headCountMode: HeadCountMode }
): boolean {
	return (
		e.knotenId === EINSPRACHE_KNOTEN &&
		e.fassung !== undefined &&
		istKalendertag(e.fassung) &&
		e.fassung >= EINSPRACHE_ZAEHLWEISE_AB &&
		m.headCountMode === 'per_unit'
	);
}

/**
 * Die Zählweise, nach der ein Erfordernis rechnet (Lesarten Block 5).
 *
 * **Eine Funktion statt einer Kopie an vier Stellen.** Sonst gilt die Zählweise
 * der Gemeinschaft; an der Einsprache ab der Fassung 2026-10-28 in einer
 * Gemeinschaft je Einheit gilt die Wahl L3: `je_eigentuemer` zählt je Eigentümer
 * (`per_owner`), `je_einheit` je Einheit (`per_unit`). In einer Gemeinschaft je
 * Eigentümer ändert sich nichts.
 */
export function zaehlweiseFuer(
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'einspracheLesart'>,
	m: { headCountMode: HeadCountMode }
): HeadCountMode {
	if (l3Wirkt(e, m)) {
		return einsprachelesartVon(e) === 'je_eigentuemer' ? 'per_owner' : 'per_unit';
	}
	return m.headCountMode;
}

/**
 * Der Hinweis zur Zählweise an der Einsprache, auf Karte und in der Leitung
 * (Entwurf Block 5). Bis zur Fassung 2026-10-27 bleibt der alte Hinweis
 * `zaehlweiseBeiEinsprache` (Kriterium 14); ab 2026-10-28 ersetzt der Kartensatz
 * L3 ihn, in einer Gemeinschaft je Einheit. `null` ausserhalb der Einsprache
 * und ausserhalb einer Gemeinschaft je Einheit.
 */
export function einspracheZaehlweiseHinweis(
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'einspracheLesart'>,
	zaehlweise: HeadCountMode | null | undefined
): string | null {
	if (e.knotenId !== EINSPRACHE_KNOTEN || zaehlweise !== 'per_unit') return null;
	if (e.fassung !== undefined && istKalendertag(e.fassung) && e.fassung >= EINSPRACHE_ZAEHLWEISE_AB) {
		return einsprachelesartKartensatz(einsprachelesartVon(e));
	}
	return zaehlweiseBeiEinsprache(e.knotenId, zaehlweise);
}

/**
 * Wer herausfällt, als Zusatz zur Bezugsgrösse: an der Ausschlussklage der
 * Beklagte, sonst die Betroffenen (19.10.2026). Bis zur Einsprache gab es
 * ausserhalb der Ausschlussklage keinen Knoten, an dem Betroffene unter einer
 * anderen Kopfbasis herausfielen; der Zusatz hiess deshalb überall «ohne den
 * Beklagten».
 */
export function ohneBetroffeneZusatz(knotenId: string | undefined): string {
	// An der Einsprache, wer verkauft, vermietet oder belastet (Laien- und
	// Fachprüfung Runde 2, 19.10.2026).
	if (knotenId === AUSSCHLUSSKLAGE_KNOTEN) return 'ohne den Beklagten';
	if (knotenId === EINSPRACHE_KNOTEN) return 'ohne den Eigentümer, der verkauft, vermietet oder belastet';
	return 'ohne die Betroffenen';
}

/** Die erste Fassung, in der die gemeinsame Wohnung des Beklagten mitzählt. */
export const BEKLAGTENWOHNUNG_ZAEHLT_AB = '2026-10-11';

/**
 * Ob eine beklagte Partei, der eine Wohnung mit anderen gemeinsam gehört, bei
 * der Ausschlussklage in der Bezugsgrösse bleibt, ohne abzustimmen.
 *
 * **Der Anlass** (Fachprüfung FAQ 30.09.2026, `quellen` `fragen.md` Frage 45,
 * «Präzisiert 30.09.2026»): Art. 649b Abs. 2 nimmt aus der Zahl aller
 * Miteigentümer nur den Beklagten. Wer die Wohnung mit ihm besitzt, bleibt
 * Miteigentümer ausser dem Beklagten (Rz. 5 ad Art. 712o). Die Stimme der
 * Wohnung ruht trotzdem, denn es geht «vorwiegend um die Person eines
 * gemeinschaftlichen Eigentümers» (Rz. 23 ad Art. 712o). Bis zur Fassung
 * 2026-10-10 nahm Votum die ganze Partei aus der Bezugsgrösse: bei zehn
 * Wohnungen fünf Ja von neun statt sechs von zehn.
 *
 * **Produktentscheid 30.09.2026:** Rechnung ändern, auch wenn der
 * Mitberechtigte kein Angehöriger ist; das ist die sichere Richtung.
 *
 * **Warum an der Fassung und nicht an einem eigenen Feld.** Das Erfordernis
 * am Traktandum wird spaltenweise gespeichert (`erfordernisAusZeile`), die
 * Fassung darin schon seit jeher. Ein Traktandum unter einer älteren Fassung
 * rechnet so weiter, wie es gerechnet hat (AD-4); ein neues Feld hätte dafür
 * eine Migration und einen Leseweg mehr gebraucht. Fassungen tragen ein Datum
 * als Kennung; eine andere Kennung (etwa `weisungsregel`) fällt nicht darunter.
 *
 * **Nur wo Abwesende in der Basis zählen** (Codeprüfung 30.09.2026, M1 und
 * M2). Unter einer Mehrheit der Anwesenden und Vertretenen stünde die Wohnung,
 * die nicht abstimmen kann, ohnehin nicht in der Basis; dort bleibt es beim
 * Bisherigen, und Hinweise, Handzählung und Auszählmappe («9») sagen weiter
 * dasselbe wie die Rechnung.
 */
export function beklagtenwohnungZaehltMit(
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'kopfbasis'>
): boolean {
	return (
		e.knotenId === AUSSCHLUSSKLAGE_KNOTEN &&
		e.kopfbasis !== 'anwesend_vertreten' &&
		istKalendertag(e.fassung) &&
		e.fassung >= BEKLAGTENWOHNUNG_ZAEHLT_AB
	);
}

/** Die erste Fassung, in der Angehörige im Ausstand an der Ausschlussklage in der Zahl bleiben. */
export const AUSSTAND_IN_DER_ZAHL_AB = '2026-10-25';

/**
 * Die erste Fassung, in der die Gemeinschaft die Zahl der Angehörigen im
 * Ausstand an der Ausschlussklage selbst einstellt (L10, Migration 189).
 *
 * **Warum erst hier und nicht rückwirkend:** Ältere Traktanden rechnen nach
 * ihrer Fassung (AD-4). Bis 2026-10-24 fielen die Angehörigen aus der Zahl, ab
 * 2026-10-25 blieben sie fest darin; eine Wahl, die es damals nicht gab, darf
 * daran nichts ändern.
 */
export const ANGEHOERIGENLESART_AB = '2026-11-10';

/**
 * Ob ein gespeichertes Traktandum nachzuziehen ist, weil es fest mit den
 * Angehörigen im Ausstand in der Zahl rechnet und die Gemeinschaft auf
 * «fallen_heraus» steht (Codeprüfung E1 Block D, H2 und M3). Das gilt nur für
 * Fassungen ab 1e und vor L10: Davor rechnet das Traktandum schon ohne sie, ab
 * L10 übernimmt die Freigabe die Wahl von selbst. Eine Stelle für die Absage der
 * Freigabe (`l10Veraltet`) und den Kasten «Erfordernisse nachziehen», damit die
 * Absage keinen Weg nennt, den der Kasten nicht zeigt.
 */
export function angehoerigeNachzuziehen(
	e: { knotenId: string | null; fassung: string | null; kopfbasis: string | null; quelle: string | null },
	gemeinschaft: string | undefined
): boolean {
	return (
		gemeinschaft === 'fallen_heraus' &&
		e.knotenId === AUSSCHLUSSKLAGE_KNOTEN &&
		e.kopfbasis === 'alle_ausser_betroffene' &&
		e.quelle !== 'reglement' &&
		e.fassung !== null &&
		istKalendertag(e.fassung) &&
		e.fassung >= AUSSTAND_IN_DER_ZAHL_AB &&
		e.fassung < ANGEHOERIGENLESART_AB
	);
}

/**
 * Ob die Lesart L10 an diesem Erfordernis wirkt (Migration 189).
 *
 * **Nur an der Ausschlussklage, nur wo Abwesende in der Basis zählen, nur ohne
 * hinterlegte Regel.** Unter «Anwesende und Vertretene» zählt, wer im Ausstand
 * ist, ohnehin nicht mit; eine Reglementsregel rechnet nach ihrer eigenen
 * Vorschrift, und die Lesart der Gemeinschaft tritt dahinter zurück. Unter
 * «alle Eigentümer» wirkt sie nicht: Der Beklagte fällt dort an der
 * Ausschlussklage ebenfalls heraus (`betroffeneStimmenNichtMit`), wer im
 * Ausstand ist, bleibt fest in der Zahl (`ausstandBleibtInDerZahl`; gemessen
 * 14.11.2026, siehe `ANGEHOERIGE_BEIM_SETZEN`). Hier stand bis dahin, unter «alle
 * Eigentümer» stehe auch der Beklagte in der Zahl; das traf die Rechnung nicht
 * (Fachprüfung «Texte nach 0047», H-R3-2).
 */
export function angehoerigenlesartWirkt(
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'kopfbasis'> &
		Partial<Pick<Erfordernis, 'quelle'>>
): boolean {
	return (
		e.knotenId === AUSSCHLUSSKLAGE_KNOTEN &&
		e.kopfbasis === 'alle_ausser_betroffene' &&
		e.quelle !== 'reglement' &&
		istKalendertag(e.fassung) &&
		e.fassung >= ANGEHOERIGENLESART_AB
	);
}

/**
 * Der Satz in der Maske «Anderes Erfordernis setzen», wo der Vorschlag die
 * Ermächtigung zur Ausschlussklage an allen Eigentümern ohne den Beklagten
 * misst (Entscheid 0047, 2; Auftrag «Texte nach 0047», Punkt 5, Fassung 3). Er
 * beschreibt die Rechnung, wie sie ist: `uebersteuere` behält Knoten und
 * Kopfbasis, und `angehoerigenlesartWirkt` fragt nicht, wer das Mehr gesetzt
 * hat. Die Wahlen heissen wie in der Auswahlliste (`basisbezeichnung`).
 *
 * **Unter «aller Eigentümer» zählt der Beklagte nicht mit** (gemessen am Kern,
 * 14.11.2026: elf Eigentümer, einer beklagt, einer im Ausstand, Bezugsgrösse
 * 10): An der Ausschlussklage stimmen Betroffene unter jeder Basis nicht und
 * fallen aus der Zahl (`betroffeneStimmenNichtMit`); wer im Ausstand ist, bleibt
 * (`ausstandBleibtInDerZahl`). Die Prüfvorlage sagte «auch der Beklagte»; das
 * trifft die Rechnung nicht und steht deshalb nicht hier.
 *
 * **Nur ab der Fassung 2026-11-10**: Die Maske leitet den Vorschlag immer nach
 * der aktuellen Fassung her, ein Satz für ältere Fassungen wäre nie erreichbar
 * (Fachprüfung Runde 2, R2-F-1).
 */
export const ANGEHOERIGE_BEIM_SETZEN =
	'Behalten Sie hier den Vorschlag, gilt weiter die Einstellung Ihrer Gemeinschaft, ob die Angehörigen des ' +
	'Beklagten im Ausstand in der Zahl bleiben. Wählen Sie eine andere Zählung, gilt die Einstellung nicht. ' +
	`Unter «Mehrheit ${basisbezeichnung('alle_eigentuemer')}» zählen alle ausser dem Beklagten, auch seine ` +
	'Angehörigen im Ausstand; sie wirken wie ein Nein. ' +
	`Unter «Mehrheit ${basisbezeichnung('anwesend_vertreten')}» zählt niemand mit, der im Ausstand ist. Eine ` +
	'Ermächtigung, die nur die Mehrheit der Anwesenden erreicht, kann aber angefochten werden, und wird sie ' +
	'aufgehoben, scheitert die Ausschlussklage.';

/** Der Satz am Vorschlag, oder `null`, wo L10 an ihm nicht wirkt. */
export function angehoerigeBeimSetzen(
	vorschlag: (Pick<Erfordernis, 'knotenId' | 'fassung' | 'kopfbasis'> & Partial<Pick<Erfordernis, 'quelle'>>) | null | undefined
): string | null {
	return vorschlag && angehoerigenlesartWirkt(vorschlag) ? ANGEHOERIGE_BEIM_SETZEN : null;
}

/**
 * Ob Parteien im Ausstand an diesem Erfordernis in der Bezugsgrösse bleiben,
 * ohne abzustimmen (1e, Entscheid 0018, «Fest»).
 *
 * **Der Anlass:** An der Ausschlussklage erklärt die Leitung für Ehegatte und
 * Verwandte des Beklagten in gerader Linie den Ausstand (`angehoerigenhinweis`).
 * Bis zur Fassung 2026-10-24 nahm der Ausstand sie auch aus der Zahl; das war
 * milder als der Wortlaut von Art. 649b Abs. 2, der nur den Beklagten ausnimmt.
 * Eine zu milde Zählung kann die Klage scheitern lassen (BGer 5A_735/2019
 * E. 3.3.1), deshalb fest und nicht als Lesart.
 *
 * **Ab der Fassung 2026-11-10 stellt die Gemeinschaft es ein** (L10, Migration
 * 189): Wo `angehoerigenlesartWirkt` zutrifft, entscheidet
 * `angehoerigenlesart`; fehlt das Feld, gilt die Vorgabe «bleiben». Alle
 * Sätze zu den Angehörigen hängen an dieser Funktion und folgen der Wahl mit.
 *
 * **Wie `beklagtenwohnungZaehltMit`:** an der Fassung, nur wo Abwesende in
 * der Basis zählen. Unter einer Klausel der Anwesenden zählt, wer nicht
 * abstimmen kann, ohnehin nicht. Die vertretene Partei eines Vertreters im
 * Ausstand bleibt hier in jeder Fassung in der Zahl (ruhende Vollmacht,
 * Produktentscheid 21.10.2026: «Fest wie 1e»).
 */
export function ausstandBleibtInDerZahl(
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'kopfbasis'> &
		Partial<Pick<Erfordernis, 'angehoerigenlesart' | 'quelle'>>
): boolean {
	if (angehoerigenlesartWirkt(e)) {
		return e.angehoerigenlesart !== 'fallen_heraus';
	}
	return (
		e.knotenId === AUSSCHLUSSKLAGE_KNOTEN &&
		e.kopfbasis !== 'anwesend_vertreten' &&
		istKalendertag(e.fassung) &&
		e.fassung >= AUSSTAND_IN_DER_ZAHL_AB
	);
}

/**
 * Die erste Fassung, in der unter einer von Hand gesetzten Kopfbasis «aller
 * Eigentümer» bleibt, wer im Ausstand ist (Entscheid 0050, Antwort 1,
 * «Angleichen»).
 *
 * **Warum erst hier und nicht rückwirkend**, wie bei `AUSSTAND_IN_DER_ZAHL_AB`:
 * Ältere Traktanden rechnen nach ihrer Fassung (AD-4). Ein gesetztes Mehr trägt
 * die Fassung, unter der es gesetzt wurde (`setzeErfordernis`, `uebersteuere`
 * am Vorschlag der aktuellen Fassung); ein freigegebenes Traktandum zählte
 * sonst nach dem Ausrollen still anders, als seine Freigabe sagte.
 */
export const AUSSTAND_BEI_GEWAEHLTER_BASIS_AB = '2026-11-16';

/**
 * Der Anfang der Rechtsgrundlage eines Rückkommens auf einen Beschluss, dessen
 * Mehr die Leitung gesetzt hat (`erfordernisFuerRueckkommen` in
 * `rueckkommen.ts`): Die Rechtsgrundlage des Beschlusses ist dort leer.
 */
export const RUECKKOMMEN_AUF_GESETZTES_MEHR = 'Dasselbe Mehr wie für den Beschluss selbst';

/**
 * Ob, wer im Ausstand ist, unter einer von Hand gesetzten Kopfbasis «aller
 * Eigentümer» in der Zahl bleibt und wie ein Nein wirkt (Entscheid 0050,
 * Antwort 1): dieselbe Regel wie unter L13 «Alle Eigentümer»
 * (`ausstandBleibtNachZaehlweise`; Entscheid 0048, Antwort 9). Bis dahin fiel
 * er hier heraus wie vor Block C (DeepSeek-Review Regel 43, B5).
 *
 * **Von Hand gesetzt** heisst: `quelle 'gewaehlt'` mit leerer Rechtsgrundlage
 * (`setzeErfordernis`, `uebersteuere`), dazu das Rückkommen auf einen solchen
 * Beschluss, das dasselbe Mehr übernimmt. Nicht über `quelle` allein: Auch das
 * Rückkommen auf einen Beschluss nach einer Regel des Reglements trägt
 * `gewaehlt`, und jene Regel rechnet nach ihrer eigenen Vorschrift.
 *
 * **Nur einfaches und qualifiziertes Mehr**: Nur dort ist die Kopfbasis wählbar
 * (`waehlbareBasen`); die Einstimmigkeit misst weiter an den Stimmberechtigten.
 * **Nicht an der Ausschlussklage und nicht an der Einsprache**, wo Betroffene
 * nicht mitstimmen (`betroffeneStimmenNichtMit`; ZGB Art. 649b Abs. 2, Art. 712c
 * Abs. 2). Die Regel soll dieselbe sein wie unter L13 (Entscheid 0050,
 * Antwort 1), und L13 wirkt an keiner der beiden Karten: Ihre Rechtsgrundlagen
 * stehen nicht in `KOPFZAEHLWEISE_ARTIKEL`. An der Klage bleibt der Ausstand
 * schon nach 1e in der Zahl (`ausstandBleibtInDerZahl`, in der Mappe mit 7), an
 * der Einsprache fällt er heraus wie unter L13. Zählten die Karten hier mit,
 * liesse die Auszählmappe auch die 9 des Beklagten bzw. der Betroffenen in der
 * Zahl, denn Ausstand und Betroffene tragen dort dieselbe 9 (Fachprüfung
 * Textrunde 0050, Runde 3, R3-F-1; gemessen mit `scripts/mappe-nachrechnen.mjs`,
 * Bezugsgrösse Code 3, Calc 4). Die Einsprache auszunehmen folgt aus Entscheid
 * 0050, Antwort 1 («dieselbe Regel wie unter L13»), im Bau abgeleitet und
 * danach bestätigt (Nachtrag in Entscheid 0050).
 */
export function ausstandBleibtBeiGewaehlterBasis(
	e: Pick<Erfordernis, 'fassung' | 'typ' | 'kopfbasis' | 'quelle' | 'rechtsgrundlage' | 'knotenId'>
): boolean {
	/*
	 * Fassung und Typ zuerst, die Rechtsgrundlage null-sicher (Codeprüfung
	 * Textrunde 0050, G7): Ein Erfordernis aus der Datenbank kann sie als `null`
	 * tragen, obwohl der Typ `string` sagt.
	 */
	const rechtsgrundlage = (e.rechtsgrundlage as string | null | undefined) ?? '';
	return (
		istKalendertag(e.fassung) &&
		e.fassung >= AUSSTAND_BEI_GEWAEHLTER_BASIS_AB &&
		(e.typ === 'einfaches_mehr' || e.typ === 'qualifiziertes_mehr') &&
		e.knotenId !== AUSSCHLUSSKLAGE_KNOTEN &&
		e.knotenId !== EINSPRACHE_KNOTEN &&
		e.kopfbasis === 'alle_eigentuemer' &&
		e.quelle === 'gewaehlt' &&
		(rechtsgrundlage === '' || rechtsgrundlage.startsWith(RUECKKOMMEN_AUF_GESETZTES_MEHR))
	);
}

/**
 * Ob, wer im Ausstand ist, in der Zahl aller Eigentümer bleibt, ohne dass die
 * Ausschlussklage es verlangt: nach L13 «Alle Eigentümer» oder unter einer
 * von Hand gesetzten Kopfbasis «aller Eigentümer». Eine Stelle für Kern und
 * Auszählmappe.
 */
export function ausstandBleibtUnterAllen(e: Erfordernis): boolean {
	return ausstandBleibtNachZaehlweise(e) || ausstandBleibtBeiGewaehlterBasis(e);
}

/**
 * Was Betroffene an diesem Erfordernis bewirken (Block A2, 25.09.2026).
 *
 * `kennt`: Sie zählen überhaupt, weil ihre Zustimmung nötig ist oder sie
 * nicht mitstimmen (`betroffeneStimmenNichtMit`). `form`: wie die
 * Zustimmung erteilt wird, `null` wo keine nötig ist; nur bei
 * `im_saal_oder_vorab` gibt es den Vorab-Vermerk.
 *
 * **Eine Stelle für Seite und Server.** Die Leitungsseiten bieten den Eingriff
 * danach an, `server/betroffene.ts` lässt ihn danach zu; zwei Fassungen
 * liefen auseinander, und die Seite böte an, was der Server abweist.
 */
export function betroffenenlage(
	e:
		| (Pick<
				Erfordernis,
				'zustimmungBetroffenerNoetig' | 'kopfbasis' | 'knotenId' | 'betroffenenzustimmung'
			> &
				Partial<Pick<Erfordernis, 'fassung'>>)
		| null
): {
	kennt: boolean;
	form: Betroffenenzustimmung | null;
	beklagtenumfang: boolean;
	/**
	 * Ob die Betroffenen hier Beklagte sind (Ausschlussklage). Sonst heissen
	 * sie in der Oberfläche Betroffene, etwa bei der Einsprache (19.10.2026).
	 */
	beklagt: boolean;
} {
	if (!e) return { kennt: false, form: null, beklagtenumfang: false, beklagt: false };
	return {
		kennt: e.zustimmungBetroffenerNoetig || betroffeneStimmenNichtMit(e),
		form: e.zustimmungBetroffenerNoetig
			? betroffenenzustimmungVonKnoten(e.knotenId, e.betroffenenzustimmung ?? undefined)
			: null,
		// Ob die Leitung beim Beklagten festhält, ob nur eine Person oder alle
		// Eigentümer der gemeinsamen Wohnung beklagt sind (Migration 132).
		// `server/betroffene.ts` prüft dasselbe über `beklagtenwohnungZaehltMit`.
		beklagtenumfang: e.fassung !== undefined && beklagtenwohnungZaehltMit({ ...e, fassung: e.fassung }),
		beklagt: e.knotenId === AUSSCHLUSSKLAGE_KNOTEN
	};
}

/**
 * Die Absage im Traktandenformular, wo das Mehr keine Betroffenen kennt
 * (Entscheid 0050, Antwort 3: «Formular wie Saal»). Ein Text an die Leitung,
 * nach innen.
 */
export const BETROFFENE_IM_FORMULAR_OHNE_MEHR =
	'Bei diesem Mehrheitserfordernis gibt es keine Betroffenen; auch im Saal liessen sie sich nicht ' +
	'eintragen. Entfernen Sie die Häkchen bei den Betroffenen oder setzen Sie zuerst das passende Erfordernis.';

/**
 * Verlangt im Traktandenformular, dass das Mehr nach dem Speichern Betroffene
 * kennt, wo welche angekreuzt sind (Entscheid 0050, Antwort 3).
 *
 * **Dieselbe Prüfung wie im Saal**, nicht nachgebaut: `betroffenenlage(…).kennt`,
 * an der `trageBetroffeneEin` (`server/betroffene.ts`) absagt. Bis zum
 * 14.11.2026 schrieb das Formular Betroffene an jedes Traktandum (Codeprüfung
 * Block C, M3, N2); der Saal liess sie dort nicht zu.
 *
 * Ohne Häkchen ist nichts zu prüfen: Austragen geht immer, auch wo ältere
 * Traktanden noch Betroffene an einem solchen Mehr tragen.
 */
export function verlangeBetroffeneAmMehr(
	e: Parameters<typeof betroffenenlage>[0],
	parteiIds: readonly string[]
): void {
	if (parteiIds.length === 0 || betroffenenlage(e).kennt) return;
	throw new FachlicherFehler('ohne_betroffene', BETROFFENE_IM_FORMULAR_OHNE_MEHR, 'betroffene');
}

/**
 * Läuft den Baum vom Ast aus mit der gegebenen Antwortfolge.
 *
 * Wirft, wenn eine Antwort nicht zur erreichten Frage gehört. Das ist wichtiger,
 * als es aussieht: Kämen Antworten aus einer Adresszeile still durch, liesse
 * sich ein Ergebnis zusammenstellen, das der Baum nie hergibt.
 */
export function laufe(rw: Regelwerk, astId: string, antwortIds: string[] = []): Lauf {
	const ast = rw.aeste.find((a) => a.id === astId);
	if (!ast) {
		throw new FachlicherFehler('ast_unbekannt', `Der Einstieg «${astId}» ist unbekannt.`, 'ast');
	}

	const schritte: Schritt[] = [];
	let aktuell = ast.einstieg;

	for (const antwortId of antwortIds) {
		const frage = frageVon(rw, aktuell);
		if (!frage) {
			throw new FachlicherFehler(
				'antwort_ueberzaehlig',
				'Der Pfad enthält mehr Antworten, als der Baum Fragen stellt.',
				'pfad'
			);
		}
		const antwort = frage.antworten.find((a) => a.id === antwortId);
		if (!antwort) {
			throw new FachlicherFehler(
				'antwort_passt_nicht',
				`Die Antwort «${antwortId}» gehört nicht zur Frage «${frage.id}».`,
				'pfad'
			);
		}
		// **Auch die Brotkrumen** (Sicherheitsprüfung und Code-Review, 23.09.2026).
		// Der erste Entwurf reinigte nur die aktuelle Frage; die bereits
		// beantworteten wandern über `schritte` in die Anzeige und ins Protokoll
		// (`siegel.ts`) und trugen den Rohtext. Heute ohne Wirkung, weil
		// Auszeichnung nur in Hilfetexten steht, aber ungeschützt war es.
		schritte.push({
			frageId: frage.id,
			frageText: ohneAuszeichnung(frage.text),
			antwortId: antwort.id,
			antwortText: ohneAuszeichnung(antwort.text)
		});
		aktuell = antwort.ziel;
	}

	const frage = frageVon(rw, aktuell);
	if (frage) return { astId, schritte, stand: { art: 'frage', frage: zurAnzeige(frage) } };

	const knoten = knotenVon(rw, aktuell);
	if (!knoten) {
		// Kann nur eintreten, wenn eine Fassung ausgeliefert wurde, die
		// pruefeRegelwerk nicht bestanden hat.
		throw new FachlicherFehler(
			'ziel_fehlt',
			`Der Pfad endet bei «${aktuell}», das es in Fassung ${rw.fassung} nicht gibt.`,
			'pfad'
		);
	}
	return { astId, schritte, stand: { art: 'ergebnis', knoten } };
}

/** Das Wertobjekt zu einem abgeschlossenen Lauf. */
/**
 * Geschäftsarten, bei denen ein Vorhaben mehrere Zwecke tragen kann.
 *
 * Eine Dachsanierung mit Terrassenausbau ist zwei Dinge und wird getrennt
 * beurteilt; eine Wahl der Bewirtschaftung ist eines. Der Hinweis dazu stand
 * bis zum 23.08.2026 auf **jeder** Ergebniskarte (Prüflauf I, B-27).
 */
const ZWECKE_TRENNBAR = new Set([
	'baulich_notwendig',
	'baulich_nuetzlich',
	'baulich_luxurioes',
	'verwaltung_gewoehnlich',
	'verwaltung_wichtig',
	'nutzungsaenderung'
]);

export function erfordernisAus(rw: Regelwerk, lauf: Lauf): Erfordernis {
	if (lauf.stand.art !== 'ergebnis') {
		throw new FachlicherFehler(
			'lauf_offen',
			'Der Baum ist noch nicht zu Ende beantwortet.',
			'pfad'
		);
	}
	return erfordernisAusKnoten(rw, lauf.stand.knoten, lauf.astId, lauf.schritte);
}

/**
 * Das Wertobjekt zu einem Ergebnisknoten, ohne den Baum zu durchlaufen.
 *
 * Für die Pflichttraktanden (Story 3.8): Bei der Jahresrechnung gibt es nichts
 * zu fragen — sie führt immer zum selben Knoten. Ihn über den Baum anzusteuern
 * hiesse, eine Antwortfolge im Code festzuschreiben, die bei der nächsten
 * Regelfassung eine andere wäre.
 *
 * Der Pfad bleibt leer und ist es zu Recht: Es wurde keine Frage beantwortet.
 * Ein erfundener Pfad sähe im Protokoll aus wie eine Herleitung, die nie
 * stattfand.
 */
export function erfordernisAusKnoten(
	rw: Regelwerk,
	knoten: Ergebnisknoten,
	astId = '',
	pfad: Schritt[] = []
): Erfordernis {
	const def = typdefinition(rw, knoten.typ);
	return {
		fassung: rw.fassung,
		juristischGegengelesen: rw.juristischGegengelesen,
		astId,
		knotenId: knoten.id,
		typ: knoten.typ,
		titel: knoten.titel,
		rechtsgrundlage: knoten.rechtsgrundlage,
		kopfbasis: knoten.kopfbasis,
		quotenbasis: knoten.quotenbasis,
		kopfSchwelle: def.schwellen.kopf,
		quotenSchwelle: def.schwellen.quoten,
		geschaeftsart: knoten.geschaeftsart,
		reglementsverhalten: knoten.reglementsverhalten,
		zustimmungBetroffenerNoetig: knoten.zustimmungBetroffenerNoetig,
		betroffenenzustimmung: knoten.betroffenenzustimmung,
		pfad,
		quelle: 'hergeleitet',
		// Nach der Wahl, die der Knoten rechnet (`wahlDesKnotens`); die Wahl der
		// Gemeinschaft setzt `wendeReglementAn`.
		...(knoten.lesart ? { gemeinschaftslesart: lesartAusKnoten(rw, knoten) } : {})
	};
}

/** Kürzung des Pfades um einen Schritt — der Zurück-Knopf. */
export function einenZurueck(antwortIds: string[]): string[] {
	return antwortIds.slice(0, -1);
}

// ── Selbst setzen und übersteuern (Story 2.3) ───────────────────────────────

/** Erfordernisse, die sich unmittelbar wählen lassen. Der Grenzfall gehört nicht dazu — er ist keine Wahl, sondern deren Fehlen. */
export const WAEHLBARE_TYPEN: Ergebnistyp[] = [
	'keine_abstimmung',
	'einfaches_mehr',
	'qualifiziertes_mehr',
	'einstimmigkeit'
];

/**
 * Bezugsgrössen eines frei gewählten Erfordernisses.
 *
 * Nur für die freie Wahl ohne Vorschlag. Beim Übersteuern eines Vorschlags
 * bleibt die Kopfbasis des Knotens erhalten — sie folgt dem Gegenstand des
 * Beschlusses und nicht der Höhe der Mehrheit (der neunte Befund der Prüfung).
 */
function grundbasen(typ: Ergebnistyp): { kopfbasis: Kopfbasis; quotenbasis: Quotenbasis } {
	switch (typ) {
		case 'einstimmigkeit':
			return { kopfbasis: 'alle_eigentuemer', quotenbasis: 'keine' };
		case 'qualifiziertes_mehr':
			return { kopfbasis: 'anwesend_vertreten', quotenbasis: 'alle_quoten' };
		default:
			return { kopfbasis: 'anwesend_vertreten', quotenbasis: 'keine' };
	}
}

/**
 * Die Bezugsgrössen, die sich beim freien Setzen wählen lassen.
 *
 * **Warum das nötig ist** (Auftraggeber, 11.08.2026): «Es gibt halt Mehrheit aller und
 * Mehrheit der anwesenden Köpfe, als Beispiel. Das wird nicht abgebildet.» Der
 * Typ sagt nur, *wie hoch* die Schwelle liegt — «mehr als die Hälfte». Wovon,
 * sagt die Bezugsgrösse, und beides zusammen ergibt erst das Erfordernis. Bei
 * zwölf Eigentümern, von denen sieben erschienen sind, heisst «einfaches Mehr»
 * vier Stimmen oder sieben, je nach Basis.
 *
 * Streng genommen ist es kein Quorum, sondern die Frage, was die Grundgesamtheit
 * ist — aber praktisch entscheidet sie mit darüber, ob ein Beschluss zustande
 * kommt.
 *
 * **Bei Einstimmigkeit gibt es nichts zu wählen:** Einstimmigkeit nur unter den
 * Erschienenen ist keine Einstimmigkeit. Bei einer Kenntnisnahme ebenso wenig —
 * dort wird nicht gezählt.
 */
export function waehlbareBasen(typ: Ergebnistyp): {
	kopf: Kopfbasis[];
	quoten: Quotenbasis[];
} {
	switch (typ) {
		case 'einfaches_mehr':
			return { kopf: ['anwesend_vertreten', 'alle_eigentuemer'], quoten: ['keine'] };
		case 'qualifiziertes_mehr':
			return {
				kopf: ['anwesend_vertreten', 'alle_eigentuemer'],
				quoten: ['alle_quoten', 'anwesend_vertreten']
			};
		default:
			return { kopf: [], quoten: [] };
	}
}

/**
 * Die Mehrheit mitsamt ihrer Bezugsgrösse, in einem Satzteil.
 *
 * **Warum es sie gibt** (Prüflauf I, B-19): Ein gesetztes oder übersteuertes
 * Erfordernis wurde bis zum 23.08.2026 als «Qualifiziertes Mehr» angezeigt —
 * die Höhe ohne das Wovon. Wer ausdrücklich «aller Eigentümer, auch der
 * abwesenden» gewählt hatte, sah davon nichts wieder; gerechnet wurde
 * trotzdem so. Anzeige und Rechnung sagten Verschiedenes, und das fällt erst
 * am Abend auf.
 *
 * Die Vorgabe des Typs bleibt stumm: «Einfaches Mehr der anwesenden oder
 * vertretenen» an jedem Traktandum wäre Lärm, der die eine Abweichung
 * verdeckt, auf die es ankommt.
 */
export function mehrheitMitBasis(
	bezeichnung: string,
	e: { typ: Ergebnistyp; kopfbasis: Kopfbasis; quotenbasis: Quotenbasis; knotenId?: string }
): string {
	const vorgabe = grundbasen(e.typ);
	const teile: string[] = [];
	if (e.kopfbasis !== vorgabe.kopfbasis) teile.push(basisbezeichnung(e.kopfbasis));
	// Übersteuert an der Ausschlussklage: Der Beklagte fällt heraus, auch wenn
	// die gewählte Basis das nicht sagt (seit 29.09.2026); an der Einsprache die
	// Betroffenen (ab Fassung 2026-10-20).
	if (
		e.kopfbasis !== 'alle_ausser_betroffene' &&
		betroffeneStimmenNichtMit({ kopfbasis: e.kopfbasis, knotenId: e.knotenId ?? '' })
	) {
		teile.push(ohneBetroffeneZusatz(e.knotenId));
	}
	if (e.quotenbasis !== vorgabe.quotenbasis && e.quotenbasis !== 'keine')
		teile.push(`Wertquoten ${basisbezeichnung(e.quotenbasis)}`);
	return teile.length > 0 ? `${bezeichnung} ${teile.join(', ')}` : bezeichnung;
}

/** Klartext für eine Bezugsgrösse — dieselben Worte in Auswahl und Ergebniskarte. */
export function basisbezeichnung(basis: Kopfbasis | Quotenbasis): string {
	switch (basis) {
		case 'anwesend_vertreten':
			return 'der anwesenden oder vertretenen';
		case 'alle_eigentuemer':
			return 'aller Eigentümer, auch der abwesenden';
		case 'alle_ausser_betroffene':
			return 'aller ausser der Betroffenen';
		case 'alle_quoten':
			return 'aller Wertquoten, auch der abwesenden';
		case 'keine':
			return 'ohne Wertquoten';
	}
}

/**
 * Die Bezeichnung des Erfordernistyps mit ihrer Bezugsgrösse — immer.
 *
 * **Der Anlass** (Produktentscheid 08.10.2026, `docs/freigabe.md`,
 * «Nebenbefunde aus der Prüfung des Verlaufsblatts», Punkt 4): «Einfaches
 * Mehr» stand am Traktandum ohne Basis, und die Bezeichnung sagt damit nicht,
 * wovon das Mehr zu nehmen ist. Anders als `mehrheitMitBasis` bleibt die
 * Vorgabe hier nicht stumm: An den Stellen, die das Erfordernis nur als Marke
 * zeigen (Leitungsseite, Wand, Einladung), ist die Bezeichnung die ganze
 * Auskunft.
 *
 * **Nur für die Anzeige.** Der gespeicherte Titel (`mehrheitMitBasis`) bleibt
 * unverändert: Er sitzt in festgeschriebenen Erfordernissen und im Verlauf,
 * und ein neuer Wortlaut dort träfe nur neue Traktanden und liesse die
 * bestehenden ungereimt.
 */
export function bezeichnungMitBasis(rw: Regelwerk, e: Erfordernis): string {
	const def = typdefinition(rw, e.typ);
	if (e.typ === 'keine_abstimmung' || e.typ === 'grenzfall' || e.typ === 'einstimmigkeit') {
		return def.bezeichnung;
	}
	const kopf: string[] = [];
	// Wie in `mehrheitMitBasis`: Der Beklagte fällt an der Ausschlussklage
	// heraus, auch wenn die gewählte Basis das nicht sagt; an der Einsprache
	// die Betroffenen.
	kopf.push(basisbezeichnung(e.kopfbasis));
	if (
		e.kopfbasis !== 'alle_ausser_betroffene' &&
		betroffeneStimmenNichtMit({ kopfbasis: e.kopfbasis, knotenId: e.knotenId ?? '' })
	) {
		kopf.push(ohneBetroffeneZusatz(e.knotenId));
	}
	/*
	 * Die Quotenbasis als eigener Gliedsatz statt «Wertquoten aller Wertquoten»
	 * (Laienprüfung 09.10.2026): Die Verdoppelung war die Stelle, an der die
	 * Marke zweimal hinsehen liess.
	 */
	const quoten =
		e.quotenbasis === 'alle_quoten'
			? 'bei den Wertquoten zählen alle, auch die der abwesenden'
			: e.quotenbasis === 'anwesend_vertreten'
				? 'bei den Wertquoten die der anwesenden oder vertretenen'
				: null;
	return `${def.bezeichnung} ${kopf.join(', ')}${quoten ? `; ${quoten}` : ''}`;
}

/** Die gesetzliche Schwelle eines frei gewählten Typs. */
function pruefeWaehlbar(typ: Ergebnistyp): void {
	if (!WAEHLBARE_TYPEN.includes(typ)) {
		throw new FachlicherFehler(
			'typ_nicht_waehlbar',
			'Ein Grenzfall lässt sich nicht setzen — er besagt gerade, dass kein Erfordernis feststeht.',
			'typ'
		);
	}
}

function pruefeBegruendung(begruendung: string): string {
	const text = begruendung?.trim() ?? '';
	if (zeichenzahl(text) < 3) {
		throw new FachlicherFehler(
			'begruendung_fehlt',
			'Wer vom Vorschlag abweicht, hält den Grund fest — mindestens drei Zeichen.',
			'begruendung'
		);
	}
	return text;
}

/**
 * Ein Erfordernis ohne Herleitung setzen.
 *
 * Der kurze Weg für den Fall, dass die Sitzungsleitung die Antwort ohnehin kennt.
 * Der Pfad bleibt leer, und die Quelle sagt, dass gewählt und nicht hergeleitet
 * wurde — auf der Ergebniskarte wie im Protokoll.
 */
export function setzeErfordernis(
	rw: Regelwerk,
	typ: Ergebnistyp,
	begruendung?: string,
	basen?: { kopfbasis?: Kopfbasis; quotenbasis?: Quotenbasis }
): Uebergang<Erfordernis> {
	pruefeWaehlbar(typ);
	const def = typdefinition(rw, typ);
	const text = begruendung?.trim() || undefined;

	/*
	 * Die Bezugsgrösse ist wählbar, wo sie es sein darf. Der Typ sagt, **wie
	 * hoch** die Schwelle liegt; wovon, sagt die Basis. Wer sie nicht angibt,
	 * bekommt die gesetzliche Vorgabe (`grundbasen`) — wer etwas Unzulässiges
	 * angibt, ebenfalls, statt einer stillen Sonderregel.
	 */
	const erlaubt = waehlbareBasen(typ);
	const vorgabe = grundbasen(typ);
	const kopfbasis =
		basen?.kopfbasis && erlaubt.kopf.includes(basen.kopfbasis)
			? basen.kopfbasis
			: vorgabe.kopfbasis;
	const quotenbasis =
		basen?.quotenbasis && erlaubt.quoten.includes(basen.quotenbasis)
			? basen.quotenbasis
			: vorgabe.quotenbasis;

	const erfordernis: Erfordernis = {
		fassung: rw.fassung,
		juristischGegengelesen: rw.juristischGegengelesen,
		astId: '',
		knotenId: '',
		typ,
		// Eine Stelle für beide Wege: Setzen und Übersteuern schreiben denselben
		// Titel, sonst hiesse dasselbe Erfordernis auf zwei Seiten verschieden.
		titel: mehrheitMitBasis(def.bezeichnung, { typ, kopfbasis, quotenbasis }),
		// Leer, wie beim Übersteuern (Produktentscheid 30.09.2026): Die
		// Rechtsgrundlage läuft in Einladung, Stimmzettel, Saalbild und
		// Protokoll, und dort steht keine Herkunft. Wie gesetzt wurde, sagt der
		// Verlauf.
		rechtsgrundlage: '',
		kopfbasis,
		quotenbasis,
		kopfSchwelle: def.schwellen.kopf,
		quotenSchwelle: def.schwellen.quoten,
		zustimmungBetroffenerNoetig: false,
		pfad: [],
		quelle: 'gewaehlt',
		begruendung: text
	};

	return uebergang(
		erfordernis,
		ereignis(EREIGNISARTEN.erfordernisGesetzt, undefined, {
			typ,
			fassung: rw.fassung,
			kopfbasis,
			quotenbasis,
			begruendung: text ?? null
		})
	);
}

/**
 * Vom Vorschlag abweichen.
 *
 * Zwei Dinge bleiben dabei stehen, weil sie nicht an der Höhe der Mehrheit
 * hängen: die Kopfbasis des Knotens und eine allfällige Zustimmungspflicht
 * Betroffener. Wer bei der Ausschlussklage auf Einstimmigkeit hochgeht, ändert
 * nichts daran, dass der Beklagte aus der Basis fällt.
 *
 * Die eine Ausnahme: Einstimmigkeit nur unter den Erschienenen ist keine
 * Einstimmigkeit. Dort wird die Basis auf alle Eigentümer gehoben.
 */
export function uebersteuere(
	rw: Regelwerk,
	vorschlag: Erfordernis,
	typ: Ergebnistyp,
	begruendung: string,
	basen?: { kopfbasis?: Kopfbasis; quotenbasis?: Quotenbasis }
): Uebergang<Erfordernis> {
	pruefeWaehlbar(typ);
	const text = pruefeBegruendung(begruendung);

	/*
	 * **Die Bezugsgrösse ist auch beim Übersteuern wählbar** (Prüflauf I, B-16
	 * und B-19).
	 *
	 * Bis hierher gab es sie nur beim Setzen ohne Baum: Wer den Entscheidbaum
	 * durchlief — der übliche Weg — und am Ende ein anderes Erfordernis wählte,
	 * bekam vier Grobstufen und erbte die Basis des Vorschlags. «Zwei Drittel
	 * der Anwesenden statt aller» liess sich so nicht setzen, und das ist im
	 * Stockwerkeigentum der häufigste Streitpunkt überhaupt.
	 *
	 * Ohne Angabe bleibt es beim Alten: Die Basis des Vorschlags wird
	 * weitergeführt, soweit der neue Typ sie zulässt. Wer übersteuert, ohne die
	 * Basis anzurühren, ändert nur die Höhe — so wie bisher.
	 */
	const erlaubt = waehlbareBasen(typ);
	const vorgabe = grundbasen(typ);
	const def = typdefinition(rw, typ);

	/*
	 * Geerbt wird nach der bisherigen Regel, Wort für Wort: Einstimmigkeit unter
	 * den Erschienenen ist keine, alles andere bleibt, wie es der Vorschlag
	 * sagte. Sie über `waehlbareBasen` nachzubauen wäre falsch — die Liste kennt
	 * `alle_ausser_betroffene` nicht (dort ist nichts zu wählen), und ein
	 * Vorschlag mit dieser Basis verlöre sie lautlos an «aller Eigentümer».
	 */
	const geerbteKopfbasis: Kopfbasis =
		typ === 'einstimmigkeit' && vorschlag.kopfbasis === 'anwesend_vertreten'
			? 'alle_eigentuemer'
			: vorschlag.kopfbasis;
	const kopfbasis: Kopfbasis =
		basen?.kopfbasis && erlaubt.kopf.includes(basen.kopfbasis)
			? basen.kopfbasis
			: geerbteKopfbasis;

	/*
	 * Bei den Quoten wird **nicht** geerbt, sondern die Vorgabe des neuen Typs
	 * genommen: Ein einfaches Mehr kennt keine Quoten, und die des Vorschlags
	 * mitzuschleppen hiesse, gegen eine Schwelle zu rechnen, die es nicht mehr
	 * gibt. Das entspricht dem bisherigen Verhalten.
	 */
	const quotenbasis: Quotenbasis =
		basen?.quotenbasis && erlaubt.quoten.includes(basen.quotenbasis)
			? basen.quotenbasis
			: vorgabe.quotenbasis;

	// Schwächer als vorgeschlagen: Der Beschluss ist binnen Monatsfrist
	// anfechtbar (ZGB Art. 75 i.V.m. Art. 712m Abs. 2), und die überstimmte
	// Minderheit muss die Kosten nicht mittragen.
	const rangVorher = strenge(vorschlag.typ);
	const rangNachher = strenge(typ);
	const abschwaechung = rangVorher !== null && rangNachher !== null && rangNachher < rangVorher;

	// Vom eigenen Reglement abzuweichen ist immer angreifbar, gleich in welche
	// Richtung: Das Reglement bindet die Gemeinschaft, das Werkzeug nicht.
	const gegenReglement = vorschlag.quelle === 'reglement';
	const risiko = abschwaechung || gegenReglement;

	const erfordernis: Erfordernis = {
		...vorschlag,
		// Wer von Hand abweicht, rechnet nach seiner eigenen Wahl, nicht nach einer
		// Lesart der Gemeinschaft (Migration 169); sonst nennte das Protokoll eine
		// Lesart, die nicht gerechnet wurde.
		gemeinschaftslesart: undefined,
		// Ebenso die Lesart des aufgehobenen Beschlusses am Rückkommen (Migration 181).
		lesartDesBeschlusses: undefined,
		typ,
		/*
		 * **Der Titel muss die neue Mehrheit nennen** (Prüflauf I, B-19).
		 *
		 * Bis zum 23.08.2026 blieb der Fallname des Vorschlags stehen: Wer ein
		 * Traktandum von der nützlichen baulichen Massnahme auf Einstimmigkeit
		 * setzte, las auf der Traktandenliste weiter «Nützliche bauliche
		 * Massnahme». Was gilt, stand nirgends — nur, dass abgewichen wurde.
		 *
		 * Wovon abgewichen wurde, steht seit dem 30.09.2026 nur noch im Verlauf
		 * (siehe `rechtsgrundlage` unten).
		 */
		titel: mehrheitMitBasis(def.bezeichnung, {
			typ,
			kopfbasis,
			quotenbasis,
			knotenId: vorschlag.knotenId
		}),
		kopfbasis,
		quotenbasis,
		/*
		 * **Die Schwellen aus dem Regelwerk, nicht aus einer zweiten Liste**
		 * (Nachprüfung 23.08.2026).
		 *
		 * Bis hierher nahm das Übersteuern sie aus einer festen Zuordnung im
		 * Code, das Setzen ohne Baum dagegen aus `typdefinition(rw, typ)`. Heute
		 * liefern beide dasselbe — sobald aber eine Fassung das qualifizierte
		 * Mehr auf zwei Drittel setzt, schriebe der eine Weg «Qualifiziertes
		 * Mehr» mit 1/2 aufs Traktandum und der andere mit 2/3. Derselbe Titel,
		 * zwei Zahlen, und gerechnet wird mit der Zahl.
		 */
		kopfSchwelle: def.schwellen.kopf,
		quotenSchwelle: def.schwellen.quoten,
		quelle: 'gewaehlt',
		fundstelle: undefined,
		/*
		 * **Die Rechtsgrundlage muss mit** (22.08.2026, Befunde B-03 und D-04).
		 *
		 * Bis hierher wurde `fundstelle` gelöscht und `rechtsgrundlage` stehen
		 * gelassen — zwei Felder, die dieselbe Herkunft tragen, und nur eines
		 * wurde bereinigt. Wer im Prüflauf drei Traktanden vom Reglementsmehr auf
		 * einfaches Mehr setzte, bekam eine Einladung, die weiter «Reglement der
		 * Gemeinschaft, § 15 Reglement» druckte, während gerechnet wurde, was
		 * gewählt war. Papier und Rechnung widersprachen sich — und im
		 * Anfechtungsfall liegen dann zwei Urkunden auf dem Tisch.
		 *
		 * **Wovon abgewichen wurde, steht nicht mehr darin** (Produktentscheid
		 * 30.09.2026: «Kein Hinweis nach aussen. Vorschlag, Begründung und
		 * Risiko stehen nur im Verlauf, der ins Siegelpaket geht. Der Warnsatz an
		 * die Leitung beim Setzen bleibt.»). Bis dahin stand hier «Von der
		 * Sitzungsleitung gesetzt (abweichend von: …)», und der Satz lief in
		 * Einladung, Stimmzettel, Saalbild und Protokoll. Dort las er sich wie ein
		 * Verstoss, obwohl die Leitung entscheidet und das Werkzeug nur
		 * vorschlägt. Die Sorge vom 22.08.2026, im Anfechtungsfall müsse
		 * belegbar sein, was ohne die Abweichung gegolten hätte, trägt das
		 * Ereignis `requirement.overridden` unten: Es nennt Vorschlag, Wahl,
		 * Begründung und Risiko und ist nur anfügbar. **Im Siegelpaket liegt es
		 * am Traktandum noch nicht** (Codeprüfung 30.09.2026): `siegel.ts` liest
		 * nur Einträge mit der Versammlung als Gegenstand, und dieses hängt am
		 * Traktandum. Ob das Paket die Einträge der Traktanden aufnimmt, ist
		 * offen.
		 *
		 * Leer statt der Grundlage des Vorschlags: Die wäre falsch, denn sie
		 * begründet gerade die Mehrheit, die nicht gilt.
		 */
		rechtsgrundlage: '',
		begruendung: text,
		vorschlagTyp: vorschlag.typ,
		/*
		 * **Das Mehr des Vorschlags bleibt für die Auszählung** (Lesarten Block 6,
		 * Anhang A): Votum nennt danach der Leitung, was nach Gesetz und Reglement
		 * herausgekommen wäre (Rz. 100 ad Art. 712n). Nur ihr, nicht im Protokoll:
		 * Der Entscheid vom 30.09.2026 oben gilt weiter. War der Vorschlag schon
		 * eine Abweichung, bleibt das Mass von damals, nicht die frühere Wahl.
		 */
		// Ein Grenzfall oder eine Kenntnisnahme trägt kein Mehr, an dem sich ein
		// zweites Ergebnis messen liesse (Codeprüfung Block 6, H1). Der Vorschlag
		// kommt aus dem Baum (Route `…/erfordernis`, `/quorum`), auch an einem
		// Rückkommen; sein Mass ist dann das Gesetz des gewählten Knotens.
		gesetzlich:
			vorschlag.gesetzlich ?? (gesetzesmassZaehlbar(vorschlag) ? gesetzesmassVon(vorschlag) : undefined),
		risiko,
		risikoGrund: gegenReglement ? 'gegen_reglement' : abschwaechung ? 'abschwaechung' : undefined
	};

	return uebergang(
		erfordernis,
		ereignis(EREIGNISARTEN.erfordernisUebersteuert, undefined, {
			fassung: vorschlag.fassung,
			knoten: vorschlag.knotenId,
			vorschlag: vorschlag.typ,
			/*
			 * **Wovon abgewichen wurde, im Wortlaut** (zweite Codeprüfung
			 * 30.09.2026). Bis dahin stand es in der Rechtsgrundlage; seit sie
			 * leer ist, trägt es allein dieses Ereignis. Aus Fassung und Knoten
			 * lässt es sich nicht wiederherstellen, wenn der Vorschlag aus dem
			 * Reglement kam: Der Knoten ist dann der gesetzliche.
			 */
			vorschlagRechtsgrundlage: vorschlag.rechtsgrundlage,
			vorschlagQuelle: vorschlag.quelle,
			vorschlagFundstelle: vorschlag.fundstelle ?? null,
			gewaehlt: typ,
			begruendung: text,
			risiko,
			risikoGrund: gegenReglement ? 'gegen_reglement' : abschwaechung ? 'abschwaechung' : null
		})
	);
}

// ── Den Fall unmittelbar wählen (Story 2.3, erweitert am 02.08.2026) ────────

/**
 * Ein Ergebnisknoten, wie er in einer Auswahlliste steht.
 *
 * Der Titel benennt den Fall («Wertquoten ändern»), die Rechtsgrundlage steht
 * daneben. Beides zusammen ist die ganze Begründung — anders als beim blossen
 * Typ, der nur die Höhe der Mehrheit nennt und offen lässt, warum sie gilt.
 */
export interface Erfordernisauswahl {
	astId: string;
	astTitel: string;
	knotenId: string;
	titel: string;
	rechtsgrundlage: string;
	/** Die Mehrheit in einem Halbsatz, für die Zeile in der Auswahlliste. */
	kurz: string;
	/**
	 * Der Ergebnistyp — gebraucht, um zwei Erfordernisse der Strenge nach zu
	 * vergleichen (FR-43: Hinweis, wenn ein Folgeantrag ein anderes Mehr nach
	 * sich zieht).
	 */
	typ: Ergebnistyp;
	/**
	 * Die Geschäftsart des Knotens — fassungsübergreifend stabil.
	 *
	 * Gebraucht für den Musterwortlaut (B-18): Wer den Fall gewählt hat, hat der
	 * Anwendung gesagt, worum es geht; sie kann dann einen Antragssatz
	 * vorschlagen, statt ihn zum elften Mal frei formulieren zu lassen.
	 */
	geschaeftsart: Geschaeftsart;
	/**
	 * Beispiele aus dem Regelwerk — «Wärmepumpe», «Dachreparatur», «Marmor-
	 * Eingangshalle».
	 *
	 * Sie machen die Suche **thematisch** (Auftraggeber, 11.08.2026: «Eine Suchfunktion
	 * wäre hier noch gut, die auch thematisch sucht»): Wer «Heizung» tippt, kennt
	 * den Fallnamen «Notwendige bauliche Massnahme» nicht — die Beispiele stehen
	 * zwischen dem Wort, das er kennt, und dem Fall, den er braucht.
	 *
	 * **Aus dem Regelwerk, nicht erfunden** (AD-4): Was fachlich zu einem Fall
	 * gehört, entscheidet die Fassung, nicht die Suchfunktion.
	 */
	beispiele: string[];
	/** Der Satz, warum dieses Erfordernis gilt — ebenfalls durchsuchbar. */
	begruendung: string;
}

/**
 * Filtert eine Auswahlliste nach einem Suchwort (rein).
 *
 * Durchsucht wird alles, was den Fall beschreibt: sein Titel, das Thema
 * («Bauliche Massnahmen»), die Rechtsgrundlage, die Höhe der Mehrheit, die
 * Begründung und die Beispiele. Damit findet «Heizung» die notwendige bauliche
 * Massnahme, «647d» den Artikel und «Einstimmigkeit» alle Fälle, die sie
 * verlangen.
 *
 * **Wortweise und ohne Rücksicht auf Gross- und Kleinschreibung.** Mehrere
 * Wörter müssen alle vorkommen, aber nicht nebeneinander: «lift sanierung»
 * findet «Liftsanierung wegen Sicherheitsvorschriften» nicht über die Wortfolge,
 * sondern weil beide Teile im Text stehen. Ein leeres Suchwort gibt alles
 * zurück — eine Auswahlliste, die auf nichts hin leer wird, wäre eine Sackgasse.
 */
export function sucheErfordernisse(
	auswahl: Erfordernisauswahl[],
	suche: string
): Erfordernisauswahl[] {
	const woerter = suche
		.toLocaleLowerCase('de-CH')
		.split(/\s+/)
		.map((w) => w.trim())
		.filter(Boolean);
	if (woerter.length === 0) return auswahl;

	return auswahl.filter((e) => {
		const heuhaufen = [
			e.titel,
			e.astTitel,
			e.rechtsgrundlage,
			e.kurz,
			e.begruendung,
			...e.beispiele
		]
			.join(' ')
			.toLocaleLowerCase('de-CH');
		return woerter.every((w) => heuhaufen.includes(w));
	});
}

/**
 * Zu welchem Ast ein Knoten gehört.
 *
 * Der Knoten selbst weiss es nicht — er trägt seine Rechtsgrundlage, nicht
 * seinen Weg. Ermittelt wird es durch einen Lauf über die erreichbaren Ziele je
 * Ast.
 *
 * **Der Ast mit dem kürzesten Weg bekommt den Knoten, bei Gleichstand der
 * erste** (Fassung 2026-10-27, Codeprüfung Lesarten Block 4, M1). Bis dahin
 * bekam ihn der erste Ast, der ihn überhaupt erreichte. Seit der Ast «Organe»
 * über zwei bis drei Fragen auch zur gewöhnlichen Reglementsänderung und zur
 * Zuständigkeitsordnung führt, wären beide dorthin gewandert, in jeder
 * Auswahlliste und in `requirement_branch`, obwohl ihr eigener Ast sie nach
 * einer Frage erreicht. Für alle älteren Fassungen ergeben beide Regeln
 * dieselbe Zuordnung (`tests/domain/statt-versammlung-2026-10-27.test.ts`).
 */
function astJeKnoten(rw: Regelwerk): Map<string, Ast> {
	const zuordnung = new Map<string, { ast: Ast; tiefe: number }>();
	for (const ast of rw.aeste) {
		const offen: [string, number][] = [[ast.einstieg, 0]];
		const gesehen = new Set<string>();
		while (offen.length > 0) {
			const [ziel, tiefe] = offen.shift() as [string, number];
			if (gesehen.has(ziel)) continue;
			gesehen.add(ziel);

			const frage = rw.fragen.find((f) => f.id === ziel);
			if (frage) {
				offen.push(...frage.antworten.map((a): [string, number] => [a.ziel, tiefe + 1]));
				continue;
			}
			const bisher = zuordnung.get(ziel);
			if ((!bisher || tiefe < bisher.tiefe) && rw.knoten.some((k) => k.id === ziel)) {
				zuordnung.set(ziel, { ast, tiefe });
			}
		}
	}
	return new Map([...zuordnung].map(([id, { ast }]) => [id, ast]));
}

/**
 * Alle Erfordernisse, die sich unmittelbar wählen lassen — nach Ästen geordnet.
 *
 * **Warum es das neben dem Baum gibt.** Der Baum ist für den Fall gebaut, dass
 * jemand nicht weiss, welche Mehrheit gilt: Er fragt sich zum Ergebnis durch,
 * und der Weg steht später im Verlauf. Wer den Fall aber kennt — «das ist eine
 * Änderung der Wertquoten» —, beantwortet drei Fragen, deren Antwort er schon
 * hat. Gewünscht am 02.08.2026: «Beim Zuweisen des Traktandums soll die
 * Möglichkeit bestehen, das Quorum selbst zu bestimmen, ggf. als Dropdown mit
 * allen Variationen.»
 *
 * **Grenzfälle stehen nicht drin.** Ein Grenzfall besagt gerade, dass kein
 * Erfordernis feststeht; ihn zu wählen hiesse, die Unentschiedenheit zu
 * beschliessen. Wer in einem Grenzfall steckt, muss sich entscheiden — dafür ist
 * das Übersteuern da, und das verlangt eine Begründung.
 */
export function waehlbareErfordernisse(rw: Regelwerk): Erfordernisauswahl[] {
	const zuordnung = astJeKnoten(rw);
	const reihenfolge = new Map(rw.aeste.map((a, i) => [a.id, i]));

	return rw.knoten
		.filter((k) => k.typ !== 'grenzfall')
		.map((k) => {
			const ast = zuordnung.get(k.id);
			return {
				astId: ast?.id ?? '',
				astTitel: ast?.titel ?? 'Ohne Ast',
				knotenId: k.id,
				titel: k.titel,
				rechtsgrundlage: k.rechtsgrundlage,
				/*
				 * Mit beiden Mehren, wo eine Lesart der Gemeinschaft entscheidet
				 * (Review DeepSeek, B2): Die Auswahl steht auch am Versammlungstag
				 * mehrerer Gemeinschaften, und jede kann anders eingestellt haben.
				 */
				kurz: k.lesart
					? `${typdefinition(rw, k.typ).bezeichnung} (Voreinstellung) oder ` +
						`${typdefinition(rw, k.lesart.andere.typ).bezeichnung}, je nach Lesart`
					: typdefinition(rw, k.typ).bezeichnung,
				typ: k.typ,
				geschaeftsart: k.geschaeftsart,
				beispiele: k.beispiele ?? [],
				begruendung: k.begruendung
			};
		})
		.sort(
			(a, b) =>
				(reihenfolge.get(a.astId) ?? 99) - (reihenfolge.get(b.astId) ?? 99) ||
				a.titel.localeCompare(b.titel, 'de-CH')
		);
}

/**
 * Ein Erfordernis über seinen Knoten wählen, ohne den Baum zu durchlaufen.
 *
 * **Ohne Begründungspflicht**, anders als beim Setzen eines blossen Typs. Der
 * Unterschied ist nicht Bequemlichkeit: Ein Typ ohne Fall sagt «zwei Drittel»
 * und lässt offen, warum — deshalb braucht er einen Satz dazu. Ein Knoten sagt
 * «Wertquoten ändern, ZGB Art. 712e Abs. 2», und damit ist die Begründung die
 * Auswahl selbst. Der Pfad bleibt leer, und die Quelle sagt «gewählt»: Im
 * Protokoll steht dann, dass die Sitzungsleitung den Fall benannt und nicht
 * hergeleitet hat.
 */
export function waehleErfordernis(rw: Regelwerk, knotenId: string): Uebergang<Erfordernis> {
	const knoten = rw.knoten.find((k) => k.id === knotenId);
	if (!knoten) {
		throw new FachlicherFehler(
			'knoten_unbekannt',
			'Dieses Erfordernis gibt es in der geltenden Fassung des Regelwerks nicht.',
			'erfordernis'
		);
	}
	if (knoten.typ === 'grenzfall') {
		throw new FachlicherFehler(
			'typ_nicht_waehlbar',
			'Ein Grenzfall lässt sich nicht setzen — er besagt gerade, dass kein Erfordernis feststeht.',
			'erfordernis'
		);
	}

	const ast = astJeKnoten(rw).get(knotenId);
	const erfordernis: Erfordernis = {
		...erfordernisAusKnoten(rw, knoten, ast?.id ?? ''),
		quelle: 'gewaehlt'
	};

	return uebergang(
		erfordernis,
		ereignis(EREIGNISARTEN.erfordernisGesetzt, undefined, {
			fassung: rw.fassung,
			knoten: knotenId,
			typ: knoten.typ,
			weg: 'unmittelbar_gewaehlt'
		})
	);
}

/**
 * Der Satz der Traktandenliste zu einer umstrittenen Regel (Ä-01, Ä-02, Ä-04,
 * Entscheid 17.09.2026), oder `null`.
 *
 * **Nur, wenn das Erfordernis das des Knotens ist.** «Gerechnet wird die
 * strenge Lesart» stimmt nur für das gesetzliche Erfordernis, wie der Knoten
 * es rechnet. Kommt es aus dem Reglement oder hat die Sitzungsleitung Typ oder
 * Bezugsgrösse anders gesetzt, wird etwas anderes gerechnet, und der Satz wäre
 * falsch. Der Knoten kommt von aussen, aus der Fassung des Erfordernisses: Der
 * Kern darf das Regelwerk nicht laden.
 */
export function umstrittenSatz(e: Erfordernis | null | undefined, knoten: Ergebnisknoten | undefined): string | null {
	if (!e || !knoten?.gegenmeinung) return null;
	if (e.quelle === 'reglement' || e.knotenId !== knoten.id) return null;
	if (e.typ !== knoten.typ || e.kopfbasis !== knoten.kopfbasis || e.quotenbasis !== knoten.quotenbasis) {
		return null;
	}
	return `${UMSTRITTEN_SATZ} Nach anderer Ansicht ${knoten.gegenmeinung}`;
}

/**
 * Der Satz, der auf der Ergebniskarte und in der Präsentationssicht klarstellt,
 * wer entschieden hat.
 *
 * Die Prüfung nennt das die eine Stelle, an der das Werkzeug strenger sein muss
 * als die Website: Auf dem Beamer sieht ein Vorschlag aus wie das Ergebnis einer
 * Prüfung.
 */
export function urheberschaft(e: Erfordernis): string {
	switch (e.quelle) {
		case 'hergeleitet':
			return (
				'Vorschlag des Werkzeugs aus dem Entscheidbaum. Die Sitzungsleitung entscheidet, ' +
				'ob sie ihm folgt.'
			);
		case 'gewaehlt':
			return e.vorschlagTyp
				? 'Von der Sitzungsleitung gesetzt, abweichend vom Vorschlag des Werkzeugs.'
				: 'Von der Sitzungsleitung gesetzt, ohne Herleitung über den Entscheidbaum.';
		case 'reglement':
			return 'Aus dem hinterlegten Reglement dieser Gemeinschaft, nicht aus dem Gesetz.';
	}
}

/** Der Warnsatz bei einer Abweichung vom hinterlegten Reglement. */
export const REGLEMENTSBRUCHHINWEIS =
	'Das gewählte Erfordernis weicht vom hinterlegten Reglement dieser Gemeinschaft ab. Das ' +
	'Reglement bindet die Gemeinschaft; ein Beschluss, der es übergeht, ist binnen Monatsfrist ' +
	'anfechtbar (ZGB Art. 75 i.V.m. Art. 712m Abs. 2).';

/** Der Warnsatz bei einer Abschwächung. */
export const ANFECHTUNGSHINWEIS =
	'Das gewählte Erfordernis ist schwächer als das vorgeschlagene. Ist es zu schwach, kann ' +
	'jeder Eigentümer den Beschluss binnen Monatsfrist gerichtlich anfechten ' +
	'(ZGB Art. 75 i.V.m. Art. 712m Abs. 2), und die überstimmte Minderheit muss die Kosten ' +
	'nicht mittragen.';

// ── Ergebniskarte ───────────────────────────────────────────────────────────

/**
 * Kennzahlen der Gemeinschaft für das Zahlenbeispiel.
 *
 * Alle Werte stammen aus den erfassten Stammdaten. Erfundene Zahlen haben auf
 * einer Ergebniskarte nichts verloren: Wer im Saal «nötig sind 8 Kopfstimmen»
 * liest, rechnet damit — und nicht mit dem Lehrbuchbeispiel.
 */
export interface Kennzahlen {
	/**
	 * Kopfstimmen insgesamt.
	 *
	 * Nicht dasselbe wie die Zahl der Eigentümer: Bei der Zählung je Einheit
	 * (AD-2) trägt jede Einheit eine Stimme, und eine Gemeinschaft mit 14
	 * Eigentümern kann 20 Stimmen haben. Wer hier die Parteien zählt, rechnet
	 * die halbe Gemeinschaft weg.
	 */
	kopfstimmen: number;
	/** Summe der Stammquoten, üblich 1000. */
	gesamtquote: number;
	/** Zählweise der Gemeinschaft — bestimmt allein, wie die Zahl zu benennen ist. */
	zaehlweise: HeadCountMode;
	/** Anwesend oder vertreten. Vor der Versammlung unbekannt und dann offen zu lassen. */
	anwesend?: number;
	/** Zahl der unmittelbar Betroffenen, wo das Gesetz sie aus der Basis nimmt. */
	betroffene?: number;
	/**
	 * Davon die Beklagten, deren Wohnung mehreren gehört und in der Basis bleibt,
	 * ohne abzustimmen (`beklagtenwohnungZaehltMit`, ab Fassung 2026-10-11, und
	 * nicht «alle Eigentümer beklagt»). Nur die Seite eines Traktandums kennt
	 * sie (Codeprüfung 30.09.2026, M3: das Beispiel rechnete sonst eine Wohnung
	 * zu wenig).
	 */
	beklagtenwohnungen?: number;
	/**
	 * Die Zahl der Eigentümer mit Einheiten, also die Kopfstimmen je Eigentümer.
	 * In einer Gemeinschaft je Einheit nur für die Einsprache nach L3 gebraucht
	 * (`kennzahlenNachZaehlweise`); fehlt sie dort, entfällt das Zahlenbeispiel.
	 */
	eigentuemer?: number;
}

/**
 * Die Kennzahlen nach der Zählweise, nach der dieses Erfordernis rechnet
 * (Lesarten Block 5, Abnahme). An der Einsprache nach L3 «je Eigentümer»
 * rechnete das Zahlenbeispiel sonst mit den Stimmen je Einheit der Gemeinschaft
 * und nannte eine falsche Zahl nötiger Ja-Stimmen. Fehlt die Zahl der
 * Eigentümer, gibt es `null`: lieber kein Beispiel als ein falsches.
 */
export function kennzahlenNachZaehlweise(
	e: Pick<Erfordernis, 'knotenId' | 'fassung' | 'einspracheLesart'>,
	zahlen: Kennzahlen
): Kennzahlen | null {
	const zaehlweise = zaehlweiseFuer(e, { headCountMode: zahlen.zaehlweise });
	if (zaehlweise === zahlen.zaehlweise) return zahlen;
	if (zahlen.eigentuemer === undefined) return null;
	return { ...zahlen, kopfstimmen: zahlen.eigentuemer, zaehlweise };
}

/** «Eigentümern» oder «Stimmen» — je nachdem, was die Zahl zählt. */
function stimmenwort(zaehlweise: HeadCountMode): string {
	return zaehlweise === 'per_owner' ? 'Eigentümern' : 'Stimmen';
}

/**
 * Das Zahlenbeispiel mit den echten Zahlen dieser Gemeinschaft.
 *
 * Gibt `null` zurück, wo es nichts zu rechnen gibt — bei der Kenntnisnahme und
 * beim Grenzfall. Ein Beispiel ohne feststehendes Erfordernis wäre eine
 * Behauptung.
 */
export function zahlenbeispiel(knoten: Ergebnisknoten, zahlen: Kennzahlen): string | null {
	if (knoten.typ === 'keine_abstimmung' || knoten.typ === 'grenzfall') return null;
	if (zahlen.kopfstimmen <= 0) return null;

	/*
	 * **Die Betroffenen der Einsprache zählen nicht** (ab Fassung 2026-10-20),
	 * obwohl die Kopfbasis die der Anwesenden ist (`betroffeneStimmenNichtMit`).
	 * Wie `zahlenbeispielFuerRegel` an der Ausschlussklage: «wenn alle
	 * erschienen sind» heisst dann ohne sie. Mit bekannter Anwesenheit bleibt
	 * es bei der Zahl der Anwesenden, wie dort.
	 */
	const ohneBetroffene =
		knoten.kopfbasis === 'anwesend_vertreten' &&
		zahlen.anwesend === undefined &&
		betroffeneStimmenNichtMit({ kopfbasis: knoten.kopfbasis, knotenId: knoten.id });
	const kopfbasis = ohneBetroffene
		? Math.max(0, zahlen.kopfstimmen - (zahlen.betroffene ?? 1))
		: basisZahl(knoten.kopfbasis, zahlen);
	const noetigeKoepfe =
		knoten.typ === 'einstimmigkeit' ? kopfbasis : mehrheitsschwelle(kopfbasis);

	const teile: string[] = [];
	teile.push(
		ohneBetroffene
			? `Bei ${kopfbasis} ${stimmenwort(zahlen.zaehlweise)} ${ohneBetroffeneZusatz(knoten.id)}, ` +
					'wenn alle übrigen erschienen oder vertreten sind:'
			: basisSatz(knoten.kopfbasis, zahlen, kopfbasis)
	);

	if (knoten.typ === 'einstimmigkeit') {
		teile.push(`nötig sind ${noetigeKoepfe} Ja-Stimmen — also alle.`);
		// Nicht am Zirkularbeschluss: Er ist kein Traktandum der Versammlung,
		// und wer dort fehlt, sagt der Weg der Karte (`einstimmigkeitsweg`).
		// Nicht unter der Kopfbasis der Anwesenden (L12, Fassung 2026-11-10):
		// Dort zählt, wer fehlt, nicht mit, und der Satz wäre falsch.
		if (
			zahlen.anwesend !== undefined &&
			zahlen.anwesend < zahlen.kopfstimmen &&
			knoten.id !== 'k-zirkularbeschluss' &&
			knoten.kopfbasis !== 'anwesend_vertreten'
		) {
			const fehlend = zahlen.kopfstimmen - zahlen.anwesend;
			teile.push(
				(fehlend === 1 ? 'Fehlt 1 Stimme' : `Fehlen ${fehlend} Stimmen`) +
					', fehlt an der Versammlung die Zustimmung aller.'
			);
		}
	} else {
		teile.push(`nötig sind ${noetigeKoepfe} Ja-Stimmen`);
		if (knoten.quotenbasis === 'alle_quoten' && zahlen.gesamtquote > 0) {
			teile.push(`und zugleich mindestens ${quotenschwelle(zahlen.gesamtquote)} von ${zahlen.gesamtquote} Wertquoten.`);
		} else {
			teile[teile.length - 1] += '.';
		}
	}

	return teile.join(' ').replace(/ \./g, '.');
}

function basisZahl(basis: Kopfbasis, zahlen: Kennzahlen): number {
	switch (basis) {
		case 'anwesend_vertreten':
			return zahlen.anwesend ?? zahlen.kopfstimmen;
		case 'alle_eigentuemer':
			return zahlen.kopfstimmen;
		case 'alle_ausser_betroffene':
			return Math.max(
				0,
				zahlen.kopfstimmen - (zahlen.betroffene ?? 1) + (zahlen.beklagtenwohnungen ?? 0)
			);
	}
}

function basisSatz(basis: Kopfbasis, zahlen: Kennzahlen, kopfbasis: number): string {
	const wort = stimmenwort(zahlen.zaehlweise);
	const betroffene = zahlen.betroffene ?? 1;
	switch (basis) {
		case 'anwesend_vertreten':
			return zahlen.anwesend === undefined
				? `Bei ${zahlen.kopfstimmen} ${wort}, wenn alle erschienen oder vertreten sind:`
				: `Bei ${kopfbasis} anwesenden oder vertretenen ${wort}:`;
		case 'alle_eigentuemer':
			return `Bei ${zahlen.kopfstimmen} ${wort} — unabhängig davon, wer erscheint:`;
		case 'alle_ausser_betroffene':
			if (zahlen.beklagtenwohnungen) {
				return (
					`Bei ${zahlen.kopfstimmen} ${wort} beträgt die Basis ${kopfbasis}: Die Wohnung des ` +
					'Beklagten gehört mehreren und zählt mit, ohne abzustimmen, unabhängig davon, wer ' +
					'erscheint:'
				);
			}
			return (
				`Bei ${zahlen.kopfstimmen} ${wort}, von denen ${betroffene} betroffen ` +
				`${betroffene === 1 ? 'ist' : 'sind'}, beträgt die Basis ${kopfbasis} — ` +
				`unabhängig davon, wer erscheint:`
			);
	}
}

/** Alles, was auf der Ergebniskarte steht. Eine Struktur, keine Zeichenkette — die Darstellung gehört in die Schale. */
export interface Ergebniskarte {
	titel: string;
	/**
	 * Die Karte ist nach L13 «Alle Eigentümer» gebildet (`knotenNachZaehlweise`,
	 * Fassung 4c). Daran hängen die Sätze, die sonst die herrschende Lehre als
	 * Zählung der Karte nennen (Fachprüfung Block C, Nachtrag, N-F-2 und N-F-5).
	 */
	nachZaehlweiseAlle?: true;
	/**
	 * Was die Leitung tut, wenn im Saal eine nicht hinterlegte Bestimmung
	 * eingewendet wird (`einwandImSaal`, ab Fassung 2026-11-11). Nur an den
	 * Karten mit vereinbarter Ordnung; ein eigener Abschnitt der Karte.
	 */
	einwandImSaal?: string;
	typ: Ergebnistyp;
	bezeichnung: string;
	formel: string;
	rechtsgrundlage: string;
	begruendung: string;
	/**
	 * Die Wirkung von Enthaltung, Nichtabgabe und Fernbleiben — **in Teilen**.
	 *
	 * Ein Absatz je Teil (Bedienbarkeitsprüfung 05.09.2026, Befund 31): «Der
	 * Block ‹Enthaltung, Nichtabgabe, Fernbleiben› ist zwölf Zeilen lang; der
	 * Prüfer übersprang ihn und hätte damit den Satz übersprungen, der zählt.»
	 *
	 * Der Wortlaut ist unverändert — an einem Text, der eine Rechtsfolge
	 * beschreibt, ist Kürzen die gefährlichste Verbesserung. Was sich ändert,
	 * ist allein, dass die Bezugsgrösse, die Wirkung und der Reglementsvorbehalt
	 * nicht mehr aneinanderkleben.
	 */
	stimmwirkung: string[];
	/**
	 * Die Bezugsgrösse in einem Satz — **ein eigenes Feld, kein Absatz unter
	 * vielen** (06.09.2026).
	 *
	 * Er stand bis dahin als erster Eintrag in `stimmwirkung` und stammte immer
	 * aus dem Knoten. Gilt eine Reglementsregel mit anderer Kopfbasis, sagte die
	 * Karte damit beides zugleich: oben «Hier zählen nicht die Erschienenen,
	 * sondern alle Eigentümer», und im Stimmwirkungsblock «Die Bezugsgrösse sind
	 * die anwesenden und vertretenen Stimmen». Wer dem zweiten glaubt, zählt die
	 * Erschienenen und hält das Ergebnis für richtig.
	 *
	 * Genau dieser Widerspruch wurde am 23.08.2026 schon einmal behoben (Prüflauf
	 * I, B-22) — dort für `bezugsgroesse`, den erklärenden Block. Der Satz hier
	 * war die Nachbarstelle, an die niemand gedacht hat. Als eigenes Feld lässt
	 * er sich in `karteMitReglement` mit einer Zuweisung übernehmen, statt über
	 * seine Position im Feld gesucht zu werden.
	 */
	bezugsgroessensatz: string | null;
	/**
	 * Der Weg, wenn an der Versammlung eine Zustimmung fehlt (ab Fassung
	 * 2026-10-29, nur Einstimmigkeit; `Ergebnisknoten.einstimmigkeitsweg`).
	 * Ein eigenes Feld aus demselben Grund wie `bezugsgroessensatz`: Unter einer
	 * Reglementsregel ohne Einstimmigkeit gilt er nicht (Codeprüfung
	 * 22.10.2026, Befund 3).
	 */
	einstimmigkeitsweg: string | null;
	/**
	 * Die Wertquotenbasis in einem Satz — aus demselben Grund ein eigenes Feld.
	 *
	 * Der Code-Review vom 06.09.2026 fand ihn als Nachbarstelle: Der
	 * Kopfbasis-Satz war da bereits übernommen, dieser stand eine Zeile tiefer
	 * und behauptete weiter ein Quotenmehr über alle Quoten, während die
	 * angewandte Reglementsregel gar keine Quotenschranke kennt.
	 */
	quotenwirkungssatz: string | null;
	/** Steht nur da, wo die Bezugsgrösse vom Regelfall abweicht. */
	bezugsgroesse: string | null;
	zahlenbeispiel: string | null;
	wortlautHinweis: string | null;
	reglementsvorbehalt: string;
	/** Der Rechtssatz des Knotens zur Reglementsbestimmung, wo er einen hat (ab 2026-10-15). */
	reglementsrecht?: string;
	/** Gesperrt nach der strengeren Lesart der Lehre, nicht als zwingendes Recht (`SPERRE_NACH_LEHRE`). */
	sperreNachLehre?: true;
	gemischteGeschaefte: string | null;
	hinweise: string[];
	/**
	 * Was unter einer angewandten Regel aus einzelnen Hinweisen wird, aus dem
	 * Knoten durchgereicht. Die Karte zeigt das Feld nicht; es liest allein
	 * `karteMitReglement`.
	 */
	hinweiseUnterRegel: HinweisUnterRegel[];
	/**
	 * Der Abschnitt «Zum gesetzlichen Erfordernis», nur unter einer
	 * angewandten Regel gesetzt (Produktentscheid 29.09.2026).
	 *
	 * **Warum ein eigener Abschnitt.** Bis dahin ersetzte `karteMitReglement`
	 * Formel und Bezugsgrösse, liess aber Begründung und Hinweise stehen, und
	 * die erklärten weiter das Gesetz. An der Ausschlussklage stand unter einer
	 * Klausel der Anwesenden so «folgt der strengeren Wortlaut-Lesart, genügt
	 * beiden» und «fünf Ja, unabhängig davon, wie viele erschienen sind»
	 * (Laienprüfung 29.09.2026, C1). Gestrichen wird die Erklärung nicht: Wer
	 * wissen will, was ohne die Bestimmung gälte, findet sie hier.
	 */
	zumGesetz: { einleitung: string; begruendung: string; hinweise: string[] } | null;
	beispiele: string[];
	empfehlung: string | null;
	betroffeneErlaeuterung: string | null;
	/**
	 * Wie die Zustimmung der Betroffenen erteilt wird, wo eine nötig ist;
	 * `null`, wo keine Zustimmung verlangt ist (25.09.2026).
	 *
	 * **Die Karte muss dieselbe Form nennen wie der Leinwandsatz.** Der
	 * Schlusssatz unter der Betroffenen-Erläuterung unterscheidet die beiden
	 * Formen: Bei den Nutzungsrechten gehört die Zustimmung zur Annahme, bei
	 * den Wertquoten kommt sie mit der Abänderungsurkunde. Die Zuordnung
	 * stammt aus `betroffenenzustimmungVonKnoten`, derselben Stelle wie die
	 * Rechnung.
	 */
	betroffenenzustimmung: Betroffenenzustimmung | null;
	/** Wahr, solange die Fassung nicht juristisch gegengelesen ist. */
	ohneJuristischeFreigabe: boolean;
	freigabevermerk: string;
}

/**
 * Was eine Gemeinschaft an einer Karte mit `vereinbart` erfährt (ab Fassung
 * 2026-10-15). Exportiert, weil der Satz unter einer angewandten Regel
 * (`karteMitReglement`) dieselbe Bedingung nennt.
 *
 * **Ohne «sonst gilt das Gesetz»** (Fachprüfung nach dem Bau, A3): Ob eine
 * mit weniger beschlossene Bestimmung trotzdem gilt, steht im Rechtssatz der
 * Karte; BGE 144 III 510 trägt nur die Klarheit.
 */
export function vereinbartBedingung(rechtsgrundlage: string): string {
	/*
	 * **«Aller», nicht nur der Anwesenden, und die Norm der Karte**
	 * (Fachprüfung Runde 2, 07.10.2026, B1; Codeprüfung: Art. 648 Abs. 2 trägt
	 * nur Zweckbestimmung und Verkauf). Art. 712g Abs. 2 verlangt den
	 * «einstimmigen Beschluss aller Stockwerkeigentümer» (Rz. 197 ad
	 * Art. 712m). Und «rechtmässig» statt «gilt»: Ob eine mit weniger
	 * beschlossene Bestimmung trotzdem Bestand hat, ist eine zweite Frage, die
	 * der Rechtssatz der Karte beantwortet (Laien- und Fachprüfung Runde 2, B1
	 * und B2).
	 */
	const norm = rechtsgrundlage.includes('Art. 648') ? 'Art. 648 Abs. 2' : 'Art. 712g Abs. 2';
	return (
		'Rechtmässig ist eine andere Ordnung hier nur, wenn alle Eigentümer ihr zugestimmt haben, ' +
		`nicht nur die Anwesenden, oder wenn sie im Begründungsakt steht (${norm}); eine unklar ` +
		'gefasste gilt nicht (BGE 144 III 510 E. 2.2.4). Ob eine mit weniger beschlossene trotzdem ' +
		'gilt, sagt der Rechtssatz der Karte.'
	);
}

/**
 * Was die Leitung tut, wenn eine nicht angewandte Bestimmung im Saal eingewendet wird.
 *
 * **Mit Subjekt, nicht «sie»** (Codeprüfung Runde 3, N3): Steht der Rechtssatz
 * davor, zeigte «sie» auf «Erleichterung», «Meinung» oder «Lehre».
 */
export const EINWAND_IM_SAAL =
	'Wird eine abweichende Bestimmung im Saal eingewendet, halten Sie den Einwand im Protokoll fest.';

/**
 * Was die Wahl bewirkt, eine mit weniger beschlossene Bestimmung zu
 * hinterlegen (Laienprüfung Runde 3, 1). An `vereinbart` und am Ausweg, wo
 * der Rechtssatz dieselbe Frage «nicht geklärt» nennt (Codeprüfung Runde 4, M1).
 */
const FOLGE_DER_WAHL =
	'Ob Sie eine mit weniger beschlossene hinterlegen, entscheiden Sie; die Gemeinschaft steht ' +
	'dafür ein. Hinterlegt, zählt dieses Werkzeug nach ihr, und der Beschluss ist angreifbar, ' +
	'wenn sie nicht gilt (siehe den Rechtssatz); nicht hinterlegt, zählt es nach dem Gesetz.';

/**
 * Dieselbe Wahl ab Fassung 2026-11-11, an `vereinbart` (Auftrag E2): auch für
 * eine Bestimmung, deren Einführung sich nicht feststellen lässt (R9-L-3:
 * `k-baulich-notwendig` sagte nicht, wonach dann gezählt wird), und mit dem
 * sichereren Weg je Richtung (R6-F-2: Der Kasten sagte «entscheiden Sie», die
 * Website «halten Sie sie ein»). Eine strengere, die nicht gilt, lässt einen
 * Antrag scheitern, der sich neu stellen lässt; eine mildere, die nicht gilt,
 * trägt einen Beschluss, der aufgehoben werden kann (Entwurf der Prüfrunde 7,
 * Satz 1). Nicht an `nur_mildern`: Dort wendet Votum keine strengere an.
 */
const FOLGE_DER_WAHL_UNKLAR =
	'Ob Sie eine Bestimmung hinterlegen, der nicht alle Eigentümer zugestimmt haben, oder eine, deren ' +
	'Einführung sich nicht feststellen lässt, entscheiden Sie; ein Beschluss nach ihr kann dann ' +
	'angefochten werden. Nicht hinterlegt, zählt dieses Werkzeug nach dem Gesetz. Sicherer ist, eine ' +
	'strengere zu hinterlegen: Verfehlt ein Antrag sie, wird nichts vollzogen, das sich später als ' +
	'ungültig erweisen könnte; wer meint, sie gelte nicht, kann die Ablehnung anfechten. Eine mildere ' +
	'hinterlegen Sie besser nicht; sonst vollziehen Sie Beschlüsse, die nur sie erreichen, erst nach ' +
	'Ablauf der Anfechtungsfrist.';

/** An der notwendigen Massnahme dazu (Fachprüfung E2, F-6, eine Folgerung aus Art. 647 Abs. 2 Ziff. 1). */
const HINTERLEGEN_NOTWENDIG =
	'Bei einer notwendigen Massnahme hält eine Ablehnung aber den Unterhalt auf; hinterlegen Sie hier ' +
	'eine strengere nur, wenn ihre Einführung feststeht.';

/**
 * Bis wann ein angreifbarer Beschluss nicht vollzogen wird, mit Fristbeginn
 * (Fachprüfung Runde 3, B1): Wer den Monat ab dem Versammlungstag zählt,
 * vollzieht, während die Frist für Abwesende noch läuft (Rz. 230 ad Art. 712m).
 * «Ohne Vertretung» wie Rz. 230 («abwesenden (und nicht vertretenen)») und
 * der Bestand in `auszaehlung.ts`; «erhalten» statt «Zustellung», das
 * Laien als Versand lasen, und der Rat zur nachweisbaren Zustellung aus
 * Rz. 231 (Laien- und Fachprüfung 07.10.2026). Der Satz zur Einführung mit
 * weniger sagte in der Fassung 2026-10-15 nur «für Abwesende»; die
 * Fachprüfung des Website-Abzugs fand, dass Vertretene die Frist damit zu
 * spät rechneten, und die Fassung 2026-10-16 sagt «ohne Vertretung» wie hier.
 */
export const NACH_DER_ANFECHTUNGSFRIST =
	'erst nach Ablauf der Anfechtungsfrist von einem Monat; für Abwesende ohne Vertretung ' +
	'beginnt sie in der Regel erst, wenn sie das Protokoll erhalten haben. Stellen Sie es ' +
	'deshalb rasch und nachweisbar zu (SVIT-Kommentar Rz. 230 f. ad Art. 712m).';

/**
 * Ab welcher Fassung der Kasten «Reglement» sagt, wie die Leitung eine im Saal
 * eingewendete strengere Bestimmung einhält (Auftrag E2; Entscheid 0046, A7;
 * Fachprüfung A4, R6-F-1). Bis dahin: «zählen Sie nach dem Gesetz», auch bei
 * einer klar geltenden, in jeder Hinsicht strengeren Bestimmung, und damit ein
 * anfechtbarer Beschluss (Rz. 100 ad Art. 712n). Ältere Fassungen behalten
 * ihren Wortlaut (AD-4); am Ergebnis ändert die Fassung nichts, denn Votum
 * rechnet weiter nach dem Gesetz, und die Leitung hält «abgelehnt» über den
 * Beschluss von Hand fest.
 */
export const EINWAND_STRENGER_AB = '2026-11-11';

export function einwandStrengerAb(fassung: string | undefined): boolean {
	return fassung !== undefined && istKalendertag(fassung) && fassung >= EINWAND_STRENGER_AB;
}

/**
 * Warum eine Bestimmung, die die Zustimmung aller verlangt, ausser Betracht
 * bleibt, je Karte (Fachprüfung E2, R2-F-2): an der notwendigen Massnahme nach
 * herrschender Lehre (Rz. 125 ad Art. 712a), an der nützlichen umstritten
 * (Rz. 130 ad Art. 712a, LGVE 2011 I Nr. 10), sonst nur ausnahmsweise
 * (Rz. 196 ad Art. 712m).
 */
export type EinstimmigkeitImSaal = 'notwendig' | 'nuetzlich' | 'allgemein';

/**
 * Ob an diesem Erfordernis der Weg der eingewendeten Bestimmung gilt, und mit
 * welcher Ausnahme: an den Karten mit vereinbarter Ordnung, **in jeder
 * Fassung** (Sicherheitsprüfung E2, Beobachtung; Laienprüfung E2, R3-L-6). Nur
 * dort kann eine Bestimmung des Reglements das Mehr verschärfen; an den
 * übrigen Karten zählt das Mehr der Karte. Maske, Hinweis und Kern lesen
 * dieselbe Lage; der Abschnitt auf der Karte steht zusätzlich erst ab Fassung
 * 2026-11-11 (`einwandStrengerAb`), damit ältere Fassungen ihren Wortlaut
 * behalten. Dort sagt die Karte noch «zählen Sie nach dem Gesetz», und die
 * Leitungsseite weist trotzdem auf den Grund: gewollt, denn im Saal sieht die
 * Leitung die Maske, nicht die Karte, und der Grund ist dort der richtige Weg
 * (Codeprüfung E2, N4). `einstimmigkeit`: Eine Bestimmung, die die Zustimmung aller
 * verlangt, bleibt ausser Betracht, wo Votum sie auch hinterlegt nicht
 * anwendet (nicht fallgenau, nicht an der Einstimmigkeit); `null`, wo sie gilt.
 */
export function einwandLageAm(e: {
	reglementsverhalten?: Reglementsverhalten;
	typ: Ergebnistyp;
	knotenId?: string;
	id?: string;
	fassung?: string;
	/** Am gespeicherten Erfordernis: Ein von der Leitung gesetztes Mehr ist kein Gesetz (Featureprüfung E2, Z1). */
	quelle?: Erfordernisquelle;
	rechtsgrundlage?: string;
}): { einstimmigkeit: EinstimmigkeitImSaal | null } | null {
	// Unter einer angewandten Regel rechnet Votum nicht nach dem Gesetz, und der
	// Satz im Protokoll («nach dem Gesetz hätte …») stimmte nicht (Codeprüfung E2, M1).
	if (e.reglementsverhalten !== 'vereinbart' || (e.typ as string) === 'reglementsmehr') return null;
	// Hat die Leitung das Mehr gesetzt oder übersteuert oder gilt eine Regel, wurde
	// nicht nach dem Gesetz gerechnet; der Protokollsatz «nach dem Gesetz hätte …»
	// stimmte nicht. Gesetzt heisst wie `mehrheitGesetzt` (auszaehlung.ts): gewählt
	// ohne Rechtsgrundlage. Den Fall direkt aus der Liste gewählt, mit der
	// Rechtsgrundlage des Gesetzes, lässt das zu (Codeprüfung E2, Fix-Block M1).
	if (e.quelle === 'reglement' || (e.quelle === 'gewaehlt' && !e.rechtsgrundlage)) return null;
	if (e.typ === 'einstimmigkeit' || regelNurFallgenau(e)) return { einstimmigkeit: null };
	const kennung = e.knotenId ?? e.id;
	return {
		einstimmigkeit:
			kennung === NOTWENDIGE_MASSNAHME_KNOTEN
				? 'notwendig'
				: kennung === 'k-baulich-nuetzlich'
					? 'nuetzlich'
					: 'allgemein'
	};
}

/** Der Satz zur Zustimmung aller je Karte (`EinstimmigkeitImSaal`). */
export function einstimmigkeitImSaalSatz(art: EinstimmigkeitImSaal): string {
	const grund =
		art === 'notwendig'
			? 'Nach herrschender Lehre darf ein Reglement notwendige Massnahmen nicht der Zustimmung aller ' +
				'unterstellen (SVIT-Kommentar Rz. 125 ad Art. 712a).'
			: art === 'nuetzlich'
				? 'Ob ein Reglement das hier verlangen darf, ist umstritten (SVIT-Kommentar Rz. 130 ad ' +
					'Art. 712a, Rz. 196 ad Art. 712m).'
				: 'Nach dem SVIT-Kommentar soll ein Reglement die Zustimmung aller nur ausnahmsweise ' +
					'verlangen (Rz. 196 ad Art. 712m).';
	return `Verlangt sie die Zustimmung aller, halten Sie sie nicht ein. ${grund} Es gilt dann, was folgt, wenn eines der drei nicht feststeht.`;
}

/** Die Karte der notwendigen baulichen Massnahme, wo der Saal zusätzlich ans Gericht kann. */
export const NOTWENDIGE_MASSNAHME_KNOTEN = 'k-baulich-notwendig';

/**
 * Was die Leitung festhält, wenn der Antrag die eingehaltene Bestimmung
 * verfehlt. Gemeinsam für den Abschnitt auf der Karte und die Maske, damit
 * beide denselben Weg nennen; der Name des Knopfs und des Grundes wie in der
 * Maske (`VON_HAND_TITEL`, `VON_HAND_GRUND_EINWAND`). Die Marke «Notweg» der
 * Maske gilt dem anderen Grund (Laienprüfung E2, L-9).
 */
export const EINWAND_ABGELEHNT_FESTHALTEN =
	'Erreicht der Antrag das Gesetz, aber nicht diese Bestimmung, ist er abgelehnt. Halten Sie das auf ' +
	'der Leitungsseite beim aufgerufenen Traktandum mit «Beschluss von Hand festhalten» fest. Am ' +
	'gemeinsamen Abend steht die Maske dort im Kasten «Notweg und Beschluss von Hand». Wählen Sie ' +
	'dort den Grund «Eingewendete Bestimmung»; die Warnung zum Notweg betrifft Sie dann nicht. Das ' +
	'Protokoll nennt die Bestimmung.';

/**
 * Die drei Bedingungen, je ein Eintrag, für Abschnitt und Maske. Erstens nach
 * Rz. 194 ad Art. 712m (auch die Zählweise, Fachprüfung E2, F-4); zweitens
 * nach `EINGEFUEHRT`, mit dem Grundbuchvermerk (R2-F-3, Rz. 172 ad Art. 712g);
 * drittens «nirgends weniger und an mindestens einer Stelle mehr», auch bei
 * der Bezugsgrösse (R2-F-1; Rz. 181, 186, 191 ad Art. 712m).
 */
export function einwandBedingungen(gegenstand: 'geschaeft' | 'erweiterung'): string[] {
	return [
		gegenstand === 'erweiterung'
			? 'Sie meint klar auch diese Erweiterung und sagt klar, wie gezählt wird.'
			: 'Sie betrifft klar dieses Geschäft und sagt klar, wie gezählt wird.',
		EINGEFUEHRT,
		'Sie ist in jeder Hinsicht strenger als das gesetzliche Mehr oben. Sie verlangt nirgends weniger, ' +
			'weder bei den Köpfen noch bei den Wertquoten noch bei der Zahl, von der aus gezählt wird. An ' +
			'mindestens einer Stelle verlangt sie mehr. Auch eine höhere Zahl kann weniger verlangen: «Zwei ' +
			'Drittel der Anwesenden» zählt keine Wertquoten, «zwei Drittel der abgegebenen Stimmen» keine ' +
			'Enthaltungen.'
	];
}

/**
 * Was gilt, wenn ein Antrag nach dem Gesetz angenommen ist und eine
 * eingewendete Bestimmung, die nicht feststeht, nicht erreicht. Gemeinsam für
 * Abschnitt und Maske (Laienprüfung E2, R2-L-1: Im Saal sieht die Leitung nur
 * die Maske). Die Vollzugssperre ist eine Vorsichtsregel, keine Rechtsfolge:
 * Der Beschluss wirkt bis zur Aufhebung, die Aufhebung zurück (Rz. 207, 234
 * ad Art. 712m); das Warten bis zum Abschluss des Verfahrens ist Folgerung
 * (Fachprüfung E2, F-5, R2-F-4); die drei Monate nach der Klagebewilligung
 * Rz. 231a (R3-F-2).
 *
 * **Die Wochen nach der Frist** (15.11.2026) sind eine Vorsichtsregel: Die ZPO
 * belegt den Weg der Zustellung, nicht ihre Dauer. Bis dahin «einige Tage», nach der
 * Fachprüfung der Fassung 2026-11-17 (R2-M1) zu kurz. Laien- und Fachprüfung der
 * Korrektur in drei Runden (`quellen` `pruefung/berichte/2026-11-15-votum-wartezeit-kern-*`):
 * «nach Ablauf der Frist» (Laien M1), die Zustellung mit der ZPO belegt und BGE
 * 140 III 561 an den drei Monaten (Fach F-1, N-3), Stillstand und Vorschuss (F-2,
 * Laien R2 M4, Fach N-4), der Fall «Erreicht der Antrag die Bestimmung» vorn
 * (Laien R2 M5). Kommentare stehen hier und nicht in der Kette, damit
 * `check:texte` jeden Satz misst.
 */
export const EINWAND_VOLLZUG =
	'Erreicht ein angenommener Antrag die eingewendete Bestimmung nach ihrem Wortlaut nicht, wird er erst ' +
	'vollzogen, wenn die Anfechtungsfrist für alle abgelaufen ist, ausser es eilt. Es eilt, wenn bis dahin ' +
	'ein Schaden droht. ' +
	'Erreicht der Antrag die Bestimmung, halten Sie im Protokoll fest, dass und mit welchen Zahlen; können ' +
	'Sie das nicht sicher nachrechnen, warten Sie ab wie unten beschrieben. ' +
	'Die Frist beträgt einen Monat; für Abwesende ohne Vertretung beginnt sie in der ' +
	'Regel erst, wenn sie das Protokoll erhalten haben. Stellen Sie es deshalb rasch und nachweisbar zu, ' +
	'etwa eingeschrieben (SVIT-Kommentar Rz. 230 f. ad Art. 712m). Warten Sie nach Ablauf der Frist noch ' +
	'einige Wochen. Ein Schlichtungsgesuch vom letzten Tag der Frist ist rechtzeitig, und die ' +
	'Bewirtschaftung erhält es erst mit der Vorladung (ZPO Art. 62 Abs. 1, 143 Abs. 1, 202 Abs. 3). ' +
	'Fragen Sie die Bewirtschaftung, ob Post der Schlichtungsbehörde gekommen ist. Ist ein Gesuch ' +
	'eingegangen, vollziehen Sie nur, was eilt, bis das Verfahren abgeschlossen ist. Scheitert die ' +
	'Schlichtung, erhält, wer das Gesuch gestellt hat, eine Klagebewilligung. Damit kann er noch drei ' +
	'Monate lang klagen (ZPO Art. 209 Abs. 3; SVIT-Kommentar Rz. 231a ad Art. 712m; BGE 140 III 561 ' +
	'E. 2.2.2.4 und 2.3). Diese Frist steht vom 15. Juli bis 15. August still, ebenso eine Woche vor bis ' +
	'eine Woche nach Ostern und vom 18. Dezember bis 2. Januar (ZPO Art. 145 Abs. 1). Fällt der Sommer ' +
	'hinein, dauert sie also gut einen Monat länger. Das Gericht stellt die Klage zudem oft erst zu, ' +
	'nachdem die klagende Person den Kostenvorschuss bezahlt hat (ZPO Art. 98 Abs. 1, 101). Warten Sie ' +
	'diese Zeit und danach noch einige Wochen ab und ' +
	'fragen Sie die Bewirtschaftung, ob Post vom Gericht gekommen ist. Bis dahin vergibt sie nur, was ' +
	'eilt. Sagen Sie ihr das alles schon nach der Versammlung.';

/**
 * Wann eine Bestimmung als gültig eingeführt feststeht (Fachprüfung E2, F-2).
 * Der Regelfall ist das Reglement, das bei der Errichtung dem Begründungsakt
 * beigelegt wurde (Rz. 100a, 117, 118, 123 ad Art. 712g); sonst die
 * Zustimmung aller damaligen Eigentümer (Art. 712g Abs. 2; Rz. 78, 78a). Dass
 * ein späterer Käufer nicht zugestimmt haben muss, ist eine Folgerung aus
 * Art. 649a Abs. 1. «Nicht belegbar heisst nicht festgestellt»: Laienprüfung
 * E2, L-2.
 */
const EINGEFUEHRT =
	'Sie wurde gültig eingeführt. Das ist der Fall, wenn sie schon im Reglement stand, das bei der ' +
	'Errichtung als Bestandteil des Begründungsakts beigelegt wurde, und seither nicht geändert worden ' +
	'ist. Das sagt der Begründungsakt selbst; der Vermerk «im Grundbuch angemerkt» genügt nicht. Oder alle ' +
	'damaligen Eigentümer haben ihr zugestimmt; wer später gekauft hat, muss nicht zugestimmt haben. ' +
	'Können Sie das jetzt nicht belegen, steht es nicht fest.';

/**
 * Was die Leitung im Saal tut, wenn eine nicht hinterlegte Bestimmung
 * eingewendet wird, ab Fassung 2026-11-11 (Auftrag E2; Entscheid 0046, A7).
 * Ein eigener Abschnitt der Karte, nicht ein Satz im Kasten «Reglement»: Dort
 * stand er als etwa fünfzehnter Satz hinter dem, was vor der Einladung zu tun
 * ist, und wer im Saal suchte, hörte vorher auf (Laienprüfung E2, L-1).
 *
 * **Die Satzlogik** (Entwurf V2 der Prüfrunde 7 zu A4, ohne «stimmen Sie
 * heute nicht darüber ab»: Die Leitung darf ein angekündigtes Geschäft nicht
 * allein absetzen, Rz. 98, 98a ad Art. 712n; R7-F-1). Die Leitung bestimmt
 * das Mehr, die Versammlung beschliesst es nicht (Rz. 99 ad Art. 712n;
 * Fachprüfung E2, F-3), und ein ungültiges Mehr macht den Beschluss
 * anfechtbar (Rz. 100). Eingehalten wird nur, was klar ist (Rz. 194 ad
 * Art. 712m, auch in der Zählweise: F-4), gültig eingeführt (`EINGEFUEHRT`)
 * und in jeder Hinsicht strenger (eine gemischte rechnet Votum nach dem
 * Gesetz, Hauslinie Frage 52). Sonst bleibt es beim Gesetz, mit Einwand im
 * Protokoll und Vollzug erst nach der Frist (Rz. 207, 230 f. ad Art. 712m).
 *
 * **Die Zustimmung aller** hält die Leitung nicht ein, wo Votum sie auch als
 * hinterlegte Regel nicht anwendet (`vereinbart` ohne Fallgenauigkeit, nicht
 * an der Einstimmigkeit; Rz. 196 ad Art. 712m, an der notwendigen Massnahme
 * Rz. 125 ad Art. 712a; Fachprüfung E2, F-1). Wortlaut wie die Absage
 * `einstimmigkeit_ausgeschlossen`.
 *
 * **Kein Schlichtungsgesuch bis zum Vollzug** (F-5): eine Folgerung aus
 * Rz. 207 und 234 ad Art. 712m (Aufhebung ex tunc), nicht Wortlaut.
 */
export function einwandImSaal(lage: {
	/** `erweiterung`: an der erweiterten Bewirtschaftung, wo eine Regel für Organe hinterlegt ist. */
	gegenstand: 'geschaeft' | 'erweiterung';
	/** Warum eine Bestimmung mit der Zustimmung aller hier ausser Betracht bleibt; `null`: sie bleibt nicht. */
	einstimmigkeit: EinstimmigkeitImSaal | null;
}): string {
	const [erstens, zweitens, drittens] = einwandBedingungen(lage.gegenstand);
	return (
		'Während der Versammlung lässt sich nichts mehr hinterlegen. Lesen Sie die Bestimmung im ' +
		'Reglement nach. Ob Sie sie einhalten, entscheiden Sie als Leitung; die Versammlung stimmt ' +
		`darüber nicht ab. Halten Sie sie nur ein, wenn drei Dinge feststehen. Erstens: ${erstens} ` +
		`Zweitens: ${zweitens} Drittens: ${drittens} ` +
		(lage.einstimmigkeit ? `${einstimmigkeitImSaalSatz(lage.einstimmigkeit)} ` : '') +
		'Kommt der Einwand vor der Abstimmung, entscheiden Sie vorher und sagen an, nach welchem Mehr Sie ' +
		`das Ergebnis feststellen. ${EINWAND_ABGELEHNT_FESTHALTEN} ` +
		'Steht eines der drei nicht fest, bleibt es beim Ergebnis nach dem Gesetz. Sagen Sie das an, mit ' +
		'dem Grund, und halten Sie den Einwand beim Traktandum im Feld «Voten, Begründungen, ' +
		`Ordnungsentscheide» fest. ${EINWAND_VOLLZUG}`
	);
}

/**
 * Der Satz zu einer Sperre, die nicht auf zwingendem Recht steht, sondern auf
 * der strengeren Lesart der Lehre (Ä-12, Codeprüfung 3e, 18.10.2026): Beim
 * Knoten zu Inhalten ausserhalb der Nutzungs- und Verwaltungsordnung verlangt
 * der Kommentar die Einstimmigkeit nur «möglicherweise» (Rz. 126 ad
 * Art. 712g). «Zwingendes Recht … unbeachtlich» stünde dort im Widerspruch zur
 * eigenen Karte. Erkannt am Merkmal, nicht an der Kennung: gesperrt, Rang
 * `lehre`, ohne eigenen Rechtssatz.
 */
// Gilt für alle Fassungen: Kein Traktandum friert diesen Satz ein, und die Karten
// lesen die aktuelle Fassung (Codeprüfung A4, AD-4). Ebenso `bezugsgroessensatz`.
export const SPERRE_NACH_LEHRE =
	'Ob ein Reglement hier ein anderes Mehr vorsehen kann, ist nicht geklärt. Eine Reglements- ' +
	'oder Begründungsakt-Bestimmung, die etwas anderes vorsieht, wendet dieses Werkzeug nicht ' +
	'an; gerechnet wird die strengere Lesart. ' +
	EINWAND_IM_SAAL;

export function sperreNachLehre(knoten: Ergebnisknoten): boolean {
	return knoten.reglementsverhalten === 'gesperrt_zwingend' && knoten.rang === 'lehre' && !knoten.reglementsrecht;
}

/**
 * Der Reglementssatz der Karte — nach dem Verhalten des Knotens, nicht ein
 * Standardsatz für alle (Befund B-10 der Prüfung vom 15.08.2026).
 *
 * Der alte Standardsatz («Ihr Reglement … kann ein anderes Erfordernis
 * vorsehen») stand auch an Knoten mit zwingendem Erfordernis — und leitete
 * eine Sitzungsleitung mit unzulässiger Reglementsklausel zur falschen
 * Auszählung an. Ohne Verhaltensmerkmal (alte Fassungen, Grenzfall,
 * Kenntnisnahme) bleibt der Standardsatz.
 *
 * **Ab Fassung 2026-10-15 mit dem Rechtssatz des Knotens** (`reglementsrecht`),
 * wo er einen hat, in jedem Verhalten (Fach- und Laienprüfung nach dem Bau,
 * A1 und B6): Ein Rechtssatz, den kein Zweig anzeigt, steht nirgends.
 */
function reglementssatz(rw: Regelwerk, knoten: Ergebnisknoten): string {
	if (sperreNachLehre(knoten)) return SPERRE_NACH_LEHRE;
	switch (knoten.reglementsverhalten) {
		case 'gesperrt_zwingend':
			// Ab Fassung 2026-10-15 mit dem Rechtssatz des Knotens, wo er einen
			// hat (Fachprüfung 07.10.2026): «zwingendes Recht … unbeachtlich»
			// stimmte für die Erleichterung bei der Wertquotenänderung nicht.
			if (knoten.reglementsrecht) {
				return (
					`${knoten.reglementsrecht} Eine Reglements- oder Begründungsakt-Bestimmung, die ` +
					`etwas anderes vorsieht, wendet dieses Werkzeug nicht an; ausgezählt wird nach dem ` +
					`Gesetz. ${EINWAND_IM_SAAL}`
				);
			}
			return (
				'Dieses Erfordernis ist zwingendes Recht. Eine Reglements- oder ' +
				'Begründungsakt-Bestimmung, die etwas anderes vorsieht, wäre unbeachtlich — ' +
				'ausgezählt wird nach dem Gesetz.'
			);
		case 'gesperrt_vereinbarung':
			// Ab 2026-10-15: luxuriöse Massnahme und Verkauf, gesperrt mit
			// Rechtssatz. Kein «klären Sie», denn die Klärung änderte nichts.
			if (knoten.reglementsrecht) {
				return (
					`${knoten.reglementsrecht} Eine abweichende Reglementsbestimmung wendet dieses ` +
					`Werkzeug hier nicht an; gezählt wird nach dem Gesetz. ${EINWAND_IM_SAAL}`
				);
			}
			/*
			 * **«Eine solche Bestimmung» war zu unbestimmt** (23.09.2026). Der
			 * Satz davor nennt zwei Wege, den einstimmigen Beschluss und den
			 * Begründungsakt; «eine solche Bestimmung» liess offen, wovon die
			 * Rede ist. Der Nachbarzweig `gesperrt_zwingend` sagt es seit jeher
			 * genauer («eine Reglements- oder Begründungsakt-Bestimmung»).
			 *
			 * Aufgefallen ist es, weil dieser Zweig mit der Fassung 2026-09-23
			 * von vier auf elf Karten gewachsen ist (Befund B-02): Ein Text,
			 * der an vier Stellen gerade noch durchging, trägt an elf nicht
			 * mehr. Eine Probe in `entscheidbaum.test.ts` verlangt, dass die
			 * Karte das Reglement benennt.
			 */
			return (
				'Das Gesetz lässt hier eine andere Ordnung zu — aber nur, wenn sie einstimmig ' +
				'oder im Begründungsakt vereinbart wurde. Eine Reglementsbestimmung, die etwas ' +
				'anderes vorsieht, wird nicht automatisch angewandt; ob Ihre so zustande kam, ' +
				'klären Sie vor der Versammlung.'
			);
		case 'vereinbart':
			/*
			 * **Die Bedingung bleibt, nur die Sperre fällt** (Produktentscheid
			 * 07.10.2026). Kein «dürfen Sie nach ihr auszählen» mehr: Einen Weg
			 * dazu gab es nicht, jetzt tut es die Anwendung selbst.
			 *
			 * **Ohne den Grundtext davor** (Laienprüfung nach dem Bau, B1): «das
			 * gesetzliche gilt nur, wenn dort nichts anderes steht» widersprach dem
			 * nächsten Satz. Reihenfolge: Bedingung, was zu tun ist und wann, dann
			 * der Rechtssatz mit den Belegen (B2, B4, B5). Den Stand («keine
			 * Abweichung hinterlegt») stellt `karteMitReglement` voran.
			 */
			return (
				`${vereinbartBedingung(knoten.rechtsgrundlage)} ` +
				'Enthält Ihr Reglement hier eine abweichende Bestimmung, sehen Sie im Begründungsakt ' +
				'oder im Protokoll nach, wie sie eingeführt wurde. Hinterlegen Sie sie vor dem Versand ' +
				'der Einladung auf der Reglementsseite, so, wie sie im Reglement steht, und halten Sie in ' +
				'der Fundstelle auch fest, wie sie eingeführt wurde, etwa «Art. 14, Begründungsakt» oder ' +
				(knoten.typ === 'einstimmigkeit'
					? '«Art. 14, Vereinbarung vom …, von allen unterschrieben». '
					: '«Art. 14, Beschluss vom …, zwei Drittel». ') +
				// Ab 2026-11-11 steht die Wahl nach dem Satz, was das Werkzeug tut: Stand sie
				// davor, bezog sich «wendet sie dann an» auf die mildere (Laienprüfung E2, L-17).
				(einwandStrengerAb(rw.fassung) ? '' : `${FOLGE_DER_WAHL} `) +
				/*
				 * Fallgenau oder nicht, nach `regelNurFallgenau` (Fassung
				 * 2026-10-30, A4): Bis dahin hing der Satz am Ergebnistyp; an
				 * der erweiterten Bewirtschaftung (`vereinbart`, qualifiziertes
				 * Mehr) hätte er die ganze Geschäftsart durchgelassen, gerade
				 * wovor die Anwendung seit derselben Fassung sperrt. Für alle
				 * Karten davor sagt die Funktion dasselbe wie der Typ.
				 */
				(regelNurFallgenau(knoten)
					? 'Dieses Werkzeug wendet sie dann an, wenn Sie sie für genau diesen Fall ' +
						'hinterlegen, nicht für die ganze Geschäftsart; '
					: 'Dieses Werkzeug wendet sie dann an, ausser sie verlangt hier die Zustimmung ' +
						'aller; ') +
				'prüfen kann es die Einführung nicht. ' +
				(einwandStrengerAb(rw.fassung)
					? `${FOLGE_DER_WAHL_UNKLAR} ` +
						(knoten.id === NOTWENDIGE_MASSNAHME_KNOTEN ? `${HINTERLEGEN_NOTWENDIG} ` : '')
					: '') +
				'Ein bestehendes Traktandum ziehen Sie dort nach, ' +
				'solange die Versammlung nicht eröffnet ist; ein von Hand mit Begründung gesetztes ' +
				'setzen Sie neu.' +
				// Ab 2026-11-11 steht der Saal in einem eigenen Abschnitt (`einwandImSaal`).
				(einwandStrengerAb(rw.fassung)
					? ' Was Sie tun, wenn im Saal eine Bestimmung eingewendet wird, die nicht hinterlegt ' +
						'ist, steht im Abschnitt «Wird im Saal eine Bestimmung eingewendet».'
					: ' Wird im Saal eine Bestimmung eingewendet, die nicht hinterlegt ist, ' +
						'zählen Sie nach dem Gesetz und halten den Einwand im Protokoll fest.') +
				(knoten.reglementsrecht ? ` ${knoten.reglementsrecht}` : '')
			);
		case 'gesperrt_reglement':
			return (
				'Eine Reglementsbestimmung, die von diesem Erfordernis abweicht, wird hier nicht ' +
				'angewandt: Gerechnet wird nach dem Erfordernis dieser Karte. Ob die Bestimmung ' +
				'gleichwohl trägt, ist umstritten und eine Rechtsfrage der Gemeinschaftsordnung, ' +
				'keine Frage der Auszählung.'
			);
		case 'nur_mildern':
			/*
			 * **Der Kasten behauptete Geklärtes an einer Streitfrage**
			 * (Fachprüfung F-07/F-08, 23.09.2026). «Verschärfen lässt sich dieses
			 * Erfordernis allerdings nicht» ist eine Aussage über die Rechtslage,
			 * und genau die ist umstritten: Der Hinweis derselben Karte rät seit
			 * der Fassung 2026-09-23, die strengere Klausel sicherheitshalber zu
			 * erreichen. Kasten und Hinweis sagten Gegenteiliges, und der Kasten
			 * steht zuerst.
			 *
			 * **Und die Milderung war nicht umsonst zu haben.** Rz. 84 ad
			 * Art. 712g im Wortlaut: «Durch analoge Anwendung von Art. 712g Abs. 2
			 * ist eine solche Erleichterung einstimmig zu beschliessen, weil sie
			 * den Schutz der Minderheit verringert.» Wer eine mildere Klausel im
			 * Reglement findet, weiss damit noch nicht, dass sie gilt.
			 *
			 * **Und der Satz nennt keine Fundstelle** (Code-Review 23.09.2026,
			 * M-2). Ein erster Entwurf schrieb «(Rz. 84 ad Art. 712g)» hierher.
			 * Dieser Zweig gilt aber für jeden Knoten mit `nur_mildern` in **jeder**
			 * Fassung, und in den Fassungen 2026-08-15 bis 2026-09-21 trägt ihn auch
			 * `k-baulich-luxurioes-ausweg`, dessen Rechtsgrundlage Art. 647e Abs. 2
			 * ist. Der hätte dann eine Randziffer zu einer Norm bekommen, die ihn
			 * nicht betrifft. Die Bedingung für die Milderung steht deshalb im
			 * Hinweis der einzelnen Karte, wo sie zur Rechtsgrundlage passt.
			 *
			 * Bis 2026-10-05 trägt nur `k-reglement-normal` dieses Verhalten, ab
			 * 2026-10-06 trägt es keiner mehr (dort `einordnen`); ausgelieferte
			 * Fassungen sind unveränderlich und tragen es weiter (AD-4).
			 */
			/*
			 * **Der erste Versuch ersetzte die Rechtsbehauptung durch eine falsche
			 * Verhaltensbehauptung** (Gegenprüfung 23.09.2026, S-1). Er lautete
			 * «Eine mildere Regel setzt dieses Werkzeug hier durch, eine strengere
			 * nicht». Die erste Hälfte stimmt nicht: `regelStrengerAlsGesetz` gibt
			 * `null` zurück, sobald Kopf- oder Quotenbasis abweichen, und
			 * `wendeReglementAn` sperrt bei allem, was **nicht** `false` ist. Eine
			 * mildere Regel mit anderer Bezugsgrösse wird also ebenfalls nicht
			 * angewandt; der Kommentar dort sagt es wörtlich.
			 *
			 * **Und die Streitfrage gehört nicht in diesen Satz** (S-1, M-3). Sie
			 * hängt an Art. 712g Abs. 3; `k-baulich-luxurioes-ausweg` steht auf
			 * Art. 647e Abs. 2, wo Rz. 54 die Sache ohne Streit führt. Derselbe
			 * Grund, aus dem hier keine Randziffer steht: Der Zweig gilt für jeden
			 * Knoten mit `nur_mildern` in jeder Fassung.
			 *
			 * Was bleibt, ist eine Aussage über das Werkzeug, die für alle drei
			 * Fälle stimmt. Das Rechtliche steht im Hinweis der einzelnen Karte.
			 */
			/*
			 * **Der Verweis auf den Hinweis steht nur, wenn es einen gibt**
			 * (Gegenprüfung 23.09.2026, S3). `k-reglement-normal` bekam seine
			 * Hinweise erst mit der Fassung 2026-09-22; in den Fassungen
			 * 2026-08-15, -08-16 und -09-21 hat der Knoten gar keine, und der
			 * Verweis zeigte dort auf einen leeren Abschnitt. Dieselbe Rückwirkung
			 * auf eingefrorene Fassungen, die schon die Randziffer aus diesem Satz
			 * vertrieben hat.
			 */
			/*
			 * **Ab 2026-10-15 trägt `nur_mildern` der Ausweg der luxuriösen
			 * Massnahme**, mit Rechtssatz, und dort ohne den Grundtext: «das
			 * gesetzliche gilt nur, wenn dort nichts anderes steht» widerspräche
			 * «nicht erhöhen» (Laien- und Fachprüfung Runde 2, B7 und B6, wie an
			 * `vereinbart`). Der Satz zu Rz. 54 «ohne Streit» weiter oben gilt seit
			 * dieser Fassung nicht mehr: Ob Abs. 2 zwingend ist und ob ein
			 * Reglement senken darf, ist umstritten (Rechtssatz ab 2026-10-16).
			 */
			if (knoten.reglementsrecht) {
				return (
					'Dieses Werkzeug wendet eine hinterlegte Regel hier nur an, wenn sie nachweislich ' +
					'nicht strenger ist als das Gesetz und dieselbe Bezugsgrösse hat. ' +
					`${knoten.reglementsrecht} Enthält Ihr Reglement hier eine mildere Bestimmung, ` +
					'hinterlegen Sie sie vor dem Versand der Einladung und halten Sie in der Fundstelle ' +
					`fest, wie sie eingeführt wurde. ${FOLGE_DER_WAHL}`
				);
			}
			return (
				rw.reglementsvorbehalt +
				' Dieses Werkzeug wendet Ihre Regel hier nur an, wenn sie nachweislich nicht ' +
				'strenger ist als das Gesetz. Eine strengere setzt es nicht durch, und eine mit ' +
				'anderer Bezugsgrösse lässt sich nicht damit vergleichen.' +
				(knoten.hinweise?.length ? ' Was rechtlich gilt, steht im Hinweis zu dieser Karte.' : '')
			);
		case 'nur_verschaerfen':
			/*
			 * **Das Spiegelbild von `nur_mildern`** (ab Fassung 2026-10-20, Einsprache
			 * nach Art. 712c Abs. 2). Was das Werkzeug tut, und der Rechtssatz des
			 * Knotens dazu; ohne Rechtssatz der Standardsatz davor, wie bei
			 * `nur_mildern`.
			 */
			return (
				`${knoten.reglementsrecht ?? rw.reglementsvorbehalt} ` +
				'Dieses Werkzeug wendet eine Regel hier nur an, wenn sie für genau diesen Fall hinterlegt ' +
				'ist und in keiner Hinsicht milder ist als das Gesetz. Hinterlegen Sie nur ein Mehr, das so ' +
				'zustande kam. Kann es eine Bestimmung nicht einordnen, zählt es nach dem ' +
				'Gesetz; ob Ihre Bestimmung trotzdem gilt, klärt das nicht.'
			);
		case 'einordnen':
			/*
			 * **Eine Aussage über das Werkzeug, keine über die Rechtslage**, aus
			 * demselben Grund wie bei `nur_mildern` oben: Ob eine Erschwerung oder
			 * eine Erleichterung rechtlich gilt, ist umstritten und steht im Hinweis
			 * der einzelnen Karte (Produktentscheid 27.09.2026).
			 */
			return (
				rw.reglementsvorbehalt +
				' Dieses Werkzeug wendet Ihre Regel hier an, wenn sie in jeder Hinsicht strenger ' +
				'oder in jeder Hinsicht milder ist als das Gesetz. Ist sie in einem Punkt strenger ' +
				'und in einem anderen milder, rechnet es nach dem Gesetz und nennt Ihre Regel dazu, ' +
				'ohne nach ihr zu rechnen; ' +
				// Endfassung Block C, Abschnitt 7: nicht «nach jeder Lesart», denn die
				// Zählweise der Köpfe ist eine eigene Lesart.
				'erreicht ein Beschluss beide, kommt es auf den Unterschied zwischen Ihrer Regel und dem Gesetz nicht an.' +
				(knoten.hinweise?.length ? ' Was rechtlich gilt, steht im Hinweis zu dieser Karte.' : '')
			);
		default:
			return rw.reglementsvorbehalt;
	}
}

/*
 * Die Erklärung zum Wortlaut «aller Miteigentümer», je Artikel (Fachprüfung
 * Block 3, Befund 2): Die bisherige Erklärung belegt die Zählung nach den
 * Anwesenden mit Art. 647b, 647d, 647e und BGE 144 III 510 zu Art. 647d; an
 * Art. 647a Abs. 2 trägt das nicht. Seit der Fassung 2026-10-30 führt jede
 * Fassung die Erklärung je Artikel (`wortlautErklaerungJeArtikel`); fehlt
 * der Eintrag, bleibt die bisherige (`wortlautErklaerung`), etwa an
 * Art. 647c, für den nicht geprüft ist, was trägt.
 */
function wortlautErklaerungJeArtikel(rw: Regelwerk, knoten: Ergebnisknoten): string {
	const artikel = rw.wortlautArtikel.find((a) => knoten.rechtsgrundlage.startsWith(a));
	/*
	 * **Unter «Alle Eigentümer» die Fassung 4c** (L13, Endfassung Block C,
	 * Abschnitt 4): Zählt der Knoten die Köpfe an allen Eigentümern, hat ihn
	 * `knotenNachZaehlweise` getauscht. An Art. 647d bleibt es bei 4a; dort
	 * tauscht L13 nicht.
	 */
	const alle = rw.wortlautErklaerungJeArtikelAlle;
	if (alle && artikel && knoten.kopfbasis === 'alle_eigentuemer' && alle[artikel]) return alle[artikel];
	const eigen = rw.wortlautErklaerungJeArtikel;
	if (eigen && artikel && eigen[artikel]) return eigen[artikel];
	return rw.wortlautErklaerung;
}

export function ergebniskarte(
	rw: Regelwerk,
	knoten: Ergebnisknoten,
	zahlen?: Kennzahlen,
	/** Die Wahl L3, wo die Karte den Kartensatz L3 zeigen soll (Einsprache ab 2026-10-28). */
	einspracheLesart?: Einsprachewahl
): Ergebniskarte {
	const typ = typdefinition(rw, knoten.typ);
	const zahlenNachZaehlweise = zahlen
		? kennzahlenNachZaehlweise({ knotenId: knoten.id, fassung: rw.fassung, einspracheLesart }, zahlen)
		: null;
	// Nach L13 «Alle Eigentümer» getauscht (`knotenNachZaehlweise`): dieselbe Bedingung wie Fassung 4c.
	const artikel4c = rw.wortlautArtikel.find((a) => knoten.rechtsgrundlage.startsWith(a));
	const alleNachL13 =
		knoten.kopfbasis === 'alle_eigentuemer' && !!artikel4c && !!rw.wortlautErklaerungJeArtikelAlle?.[artikel4c];
	return {
		titel: knoten.titel,
		typ: knoten.typ,
		bezeichnung: typ.bezeichnung,
		// Die knoteneigene Formel geht vor: Bei abweichender Kopfbasis sagte
		// die Typformel die falsche Bezugsgrösse (Befund B-2, Ausschlussklage).
		formel: knoten.formel ?? typ.formel,
		rechtsgrundlage: knoten.rechtsgrundlage,
		begruendung: knoten.begruendung,
		/*
		 * Unter «Alle Eigentümer» zählt die Karte bei den Köpfen gerade nicht wie
		 * die herrschende Lehre; der Satz meint die Enthaltungen (Fachprüfung
		 * Block C, Nachtrag, N-F-5).
		 */
		stimmwirkung: alleNachL13
			? stimmwirkungsteile(rw, knoten).map((t) =>
					t.replace(
						'Die Karten zählen wie die herrschende Lehre;',
						'Bei den Enthaltungen zählen die Karten wie die herrschende Lehre;'
					)
				)
			: stimmwirkungsteile(rw, knoten),
		...(alleNachL13 ? { nachZaehlweiseAlle: true as const } : {}),
		einstimmigkeitsweg: knoten.einstimmigkeitsweg ?? null,
		/*
		 * **Dieselbe Bedingung wie in `stimmwirkungsteile`** (Code-Review
		 * 06.09.2026). Ein erster Anlauf löste den Ergebnistyp hier ein zweites
		 * Mal auf, obwohl er drei Zeilen höher schon als `typ` dasteht.
		 *
		 * Die Bedingung selbst steht damit an zwei Orten, und das bleibt so: Sie
		 * entscheidet dort, ob es Wirkungsteile gibt, und hier, ob es die Sätze
		 * zu den Bezugsgrössen gibt. Beide lesen dieselbe Angabe derselben
		 * Fassung; auseinanderlaufen könnten sie nur, wenn jemand eine von
		 * beiden ändert, ohne die andere anzusehen — davor schützt die Probe
		 * «nennt auf jeder Karte mit Erfordernis die Bezugsgrösse».
		 */
		/*
		 * Mit den Betroffenen, die nicht mitstimmen, wo die Kopfbasis sie nicht
		 * nennt (19.10.2026): an der Einsprache. Die Ausschlussklage trägt in
		 * jeder Fassung `alle_ausser_betroffene`, dort ändert das nichts.
		 */
		bezugsgroessensatz:
			typ.stimmwirkungen.art === 'festgelegt'
				? bezugsgroessensatz(
						knoten.kopfbasis,
						betroffeneStimmenNichtMit({ kopfbasis: knoten.kopfbasis, knotenId: knoten.id }),
						knoten.id === AUSSCHLUSSKLAGE_KNOTEN,
						knoten.id === EINSPRACHE_KNOTEN
					)
				: null,
		quotenwirkungssatz:
			typ.stimmwirkungen.art === 'festgelegt' ? quotenwirkungssatz(knoten.quotenbasis) : null,
		bezugsgroesse: bezugsgroessenHinweis(knoten),
		zahlenbeispiel: zahlenNachZaehlweise ? zahlenbeispiel(knoten, zahlenNachZaehlweise) : null,
		wortlautHinweis: knoten.wortlautAbweichung ? wortlautErklaerungJeArtikel(rw, knoten) : null,
		reglementsvorbehalt: reglementssatz(rw, knoten),
		// Ab 2026-11-11 ein eigener Abschnitt an den Karten mit vereinbarter Ordnung (Auftrag E2).
		...((lage) => (lage ? { einwandImSaal: einwandImSaal({ gegenstand: 'geschaeft', ...lage }) } : {}))(
			einwandStrengerAb(rw.fassung) ? einwandLageAm(knoten) : null
		),
		...(knoten.reglementsrecht ? { reglementsrecht: knoten.reglementsrecht } : {}),
		...(sperreNachLehre(knoten) ? { sperreNachLehre: true as const } : {}),
		/*
		 * **Nur wo ein Geschäft mehrere Zwecke haben KANN** (23.08.2026, Prüflauf
		 * I, B-27). Der Kasten «Mehrere Zwecke im selben Geschäft» — fünf Zeilen
		 * über die Trennung von Dachsanierung und Dachterrasse — stand wortgleich
		 * auf jeder Ergebniskarte, auch bei «Wahl der Bewirtschaftung» und
		 * «Protokollgenehmigung». Ein Hinweis, der überall steht, wird nirgends
		 * gelesen; und beim dritten Mal überblättert man auch den, der zutrifft.
		 *
		 * Zutreffen kann er dort, wo eine Massnahme sich in Teile zerlegen lässt,
		 * die verschieden zu beurteilen sind: bei baulichen Massnahmen und bei
		 * Verwaltungshandlungen. Eine Wahl oder eine Décharge hat einen Zweck.
		 */
		gemischteGeschaefte: ZWECKE_TRENNBAR.has(knoten.geschaeftsart ?? '')
			? rw.gemischteGeschaefte
			: null,
		/*
		 * Mit dem Hinweis zur Zählweise an der Einsprache, wo die Kennzahlen die
		 * Zählweise mitbringen (Entscheid 19.10.2026; ab der Fassung 2026-10-28
		 * der Kartensatz L3). Er gilt auch unter einer angewandten Regel und steht
		 * deshalb nicht in `hinweiseUnterRegel`.
		 */
		hinweise: [
			...(knoten.hinweise ?? []),
			...(zahlen
				? [
						einspracheZaehlweiseHinweis(
							{ knotenId: knoten.id, fassung: rw.fassung, einspracheLesart },
							zahlen.zaehlweise
						)
					].filter((h): h is string => h !== null)
				: [])
		],
		hinweiseUnterRegel: knoten.hinweiseUnterRegel ?? [],
		zumGesetz: null,
		beispiele: knoten.beispiele ?? [],
		empfehlung: knoten.empfehlung ?? null,
		betroffeneErlaeuterung: knoten.zustimmungBetroffenerNoetig
			? (knoten.betroffeneErlaeuterung ?? null)
			: null,
		betroffenenzustimmung: knoten.zustimmungBetroffenerNoetig
			? betroffenenzustimmungVonKnoten(knoten.id, knoten.betroffenenzustimmung)
			: null,
		ohneJuristischeFreigabe: !rw.juristischGegengelesen,
		freigabevermerk: rw.freigabevermerk
	};
}
