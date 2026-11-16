import type { Schwelle } from './mehrheit';
import { istKalendertag } from './datum';

/**
 * Gestalt des Quorums-Regelwerks (Story 2.1, FR-19, AD-4).
 *
 * Hier steht, **wie** ein Regelwerk aussieht — nicht, **was** darin steht. Die
 * Fassungen selbst liegen unter `src/lib/rules/`. Diese Trennung ist der ganze
 * Zweck von AD-4: Eine Gesetzesrevision ändert eine Datendatei, nicht diesen
 * Code, und ein Beschluss von 2027 bleibt erklärbar, weil die Fassung, nach der
 * er gefasst wurde, unverändert danebenliegt.
 *
 * Der Kern darf `src/lib/rules/` nicht einbinden (Schichtenwächter). Deshalb
 * wohnen die Typen hier und die Daten dort, nicht umgekehrt.
 */

/**
 * Die fünf Ausgänge.
 *
 * `keine_abstimmung` ist der Nachtrag aus der Prüfung: Jede ordentliche
 * Versammlung hat Traktanden ohne Beschluss — Begrüssung, Jahresbericht,
 * Verschiedenes. Ohne diesen Ausgang müsste die Sitzungsleitung für ein
 * Informationstraktandum ein Mehrheitserfordernis wählen, das es nicht gibt.
 */
export type Ergebnistyp =
	| 'keine_abstimmung'
	| 'einfaches_mehr'
	| 'qualifiziertes_mehr'
	| 'einstimmigkeit'
	| 'grenzfall'
	/**
	 * Was das Reglement der Gemeinschaft vorsieht (Story 2.4).
	 *
	 * Eigener Ausgang, weil ein Zweidrittelmehr keiner der gesetzlichen Typen
	 * ist. Wer es als «qualifiziertes Mehr» führte, hätte ein Erfordernis mit
	 * der Beschriftung des einen und der Schwelle des anderen.
	 */
	| 'reglementsmehr';

/**
 * Worauf sich die Kopfmehrheit bezieht — ein **eigenes Merkmal**, nicht aus dem
 * Ergebnistyp abgeleitet.
 *
 * Das ist der gewichtigste Befund der Prüfung. Wer die Bezugsgrösse aus dem Typ
 * ableitet, rechnet bei ZGB Art. 649b Abs. 2 auf den Erschienenen statt auf
 * allen übrigen Eigentümern und stellt einen Beschluss fest, den es nicht gibt.
 *
 *   - `anwesend_vertreten` — der Regelfall (ZGB Art. 67 Abs. 2 i.V.m. 712m
 *     Abs. 2), und nach BGE 144 III 510 auch dort, wo der Wortlaut «aller
 *     Miteigentümer» sagt.
 *   - `alle_eigentuemer` — jeder im Grundbuch Eingetragene zählt, auch der
 *     Abwesende. Bei der Einstimmigkeit.
 *   - `alle_ausser_betroffene` — alle ausser den unmittelbar Betroffenen, und
 *     zwar unabhängig davon, wer erschienen ist. Nur wo das Gesetz die Basis
 *     selbst nennt (ZGB Art. 649b Abs. 2).
 */
export type Kopfbasis = 'anwesend_vertreten' | 'alle_eigentuemer' | 'alle_ausser_betroffene';

/**
 * Worauf sich die Wertquotenmehrheit bezieht. Getrennt von der Kopfbasis, weil
 * beim qualifizierten Mehr genau das der Kniff ist: Köpfe relativ (die
 * Erschienenen), Quoten absolut (alle).
 */
export type Quotenbasis = 'keine' | 'alle_quoten' | 'anwesend_vertreten';

/** Ob eine Stimme in der Bezugsgrösse bleibt oder aus ihr fällt (AD-15). */
export type Stimmwirkung = 'in_basis' | 'nicht_in_basis';

/**
 * Wie die Zustimmung unmittelbar Betroffener erteilt wird (25.09.2026).
 *
 * **Der Anlass ist eine Fachprüfung** (`quellen/pruefung/berichte/2026-09-25-
 * fachpruefung-betroffene.md`): Die Anwendung führte für beide Fälle, in denen
 * das Gesetz neben dem Mehr die Zustimmung Betroffener verlangt, dieselbe
 * Rechnung. Nach den Quellen sind es zwei Formen:
 *
 *   - `im_saal_oder_vorab`, ZGB Art. 712g Abs. 4 (Nutzungsrechte): Die
 *     Zustimmung wird mündlich im Saal oder vorher schriftlich erteilt
 *     (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 209). Sie gehört zur
 *     Annahme; fehlt sie, ist der Antrag abgelehnt.
 *   - `nachher`, ZGB Art. 712e Abs. 2 (Wertquoten): Die Versammlung genehmigt
 *     mit einfachem Mehr; die Zustimmung der Betroffenen ist ein getrenntes
 *     Erfordernis und kommt in der Regel **nachher**, mit der Unterzeichnung
 *     der öffentlichen Abänderungsurkunde (Rz. 75 und 88 ad Art. 712e). Sie
 *     ist nicht Teil der Annahme.
 *
 * **Das Feld steht am Erfordernis und seit Migration 124 (Block A2) auch in
 * einer eigenen Spalte** (`agenda_item.requirement_affected_consent_form`).
 * Bis dahin trug im Betrieb allein `knotenId` (`requirement_node`) die Form.
 * Fehlt das Feld, ordnet `betroffenenzustimmungVon` es über die Knotenkennung
 * zu; alle Erfordernisse vor dieser Fassung und alle vor Migration 124
 * gespeicherten kennen es nicht.
 */
export type Betroffenenzustimmung = 'im_saal_oder_vorab' | 'nachher';

/**
 * Wie Enthaltung und Nichtabgabe wirken.
 *
 * Bewusst **ohne** die Abwesenheit: Ob ein Fernbleibender in der Bezugsgrösse
 * bleibt, hängt nicht am Ergebnistyp, sondern an der Bezugsgrösse des Knotens.
 * Bei ZGB Art. 649b Abs. 2 gilt das einfache Mehr und zugleich zählen die
 * Abwesenden mit — stünde die Abwesenheit am Typ, widerspräche sie dort dem
 * Knoten, und der Satz, den die Sitzungsleitung vorliest, wäre falsch.
 *
 * Aus demselben Grund darf `wirkung` keine Bezugsgrösse nennen; die Basisphrase
 * entsteht aus dem Knoten. `pruefeRegelwerk` setzt das durch.
 *
 * Beim Grenzfall gibt es nichts zu hinterlegen, weil dort kein Erfordernis
 * feststeht. Ein erfundener Wert wäre schlimmer als keiner: Er sähe aus wie eine
 * Regel.
 */
export type Stimmwirkungen =
	| {
			art: 'festgelegt';
			enthaltung: Stimmwirkung;
			nichtabgabe: Stimmwirkung;
			/** Nur die Wirkung, ohne Angabe der Bezugsgrösse. */
			wirkung: string;
	  }
	| { art: 'aus_gewaehltem_erfordernis'; satz: string }
	| { art: 'keine_abstimmung'; satz: string };

export interface Ergebnistypdefinition {
	typ: Ergebnistyp;
	/** Kurzzeichen aus dem Entwurf: E0 bis E4. Erscheint nie in der Oberfläche. */
	kurz: string;
	bezeichnung: string;
	/** Die Berechnung in Worten, wie sie auf der Ergebniskarte steht. */
	formel: string;
	stimmwirkungen: Stimmwirkungen;
	/**
	 * Die Schwellen als Brüche — Daten, nicht Code (AD-4).
	 *
	 * Stünde «mehr als die Hälfte» als Rechenschritt im Kern, änderte eine
	 * Revision der Schwellen den Code statt einer Datei.
	 */
	schwellen: { kopf: Schwelle | null; quoten: Schwelle | null };
}

/**
 * Geschäftsarten — das **fassungsübergreifend stabile** Vokabular.
 *
 * Reglementsabweichungen hängen daran, nicht an Knotenkennungen: Ein Reglement
 * spricht von «baulichen Massnahmen», nicht von `k-baulich-nuetzlich`. Würde die
 * Abweichung an der Kennung hängen, verlöre sie mit der nächsten Regelfassung
 * ihre Wirkung — still, ohne Fehlermeldung, und niemand merkte es bis zur
 * nächsten Abstimmung.
 *
 * Deshalb: Eine neue Fassung darf Knoten umbauen, aber keine Geschäftsart
 * entfernen.
 */
export type Geschaeftsart =
	| 'kenntnisnahme'
	| 'baulich_notwendig'
	| 'baulich_nuetzlich'
	| 'baulich_luxurioes'
	| 'verwaltung_gewoehnlich'
	| 'verwaltung_wichtig'
	| 'organe'
	| 'jahresgeschaefte'
	| 'hausordnung'
	| 'reglement'
	| 'nutzungsrechte'
	| 'nutzungsaenderung'
	| 'grundordnung'
	| 'sonderfall'
	| 'rueckkommen';

/** Beschriftung und Gruppierung der Geschäftsarten für die Oberfläche. */
export const GESCHAEFTSARTEN: { art: Geschaeftsart; gruppe: string; bezeichnung: string }[] = [
	{ art: 'baulich_notwendig', gruppe: 'Bauliche Massnahmen', bezeichnung: 'Notwendige Massnahmen' },
	{ art: 'baulich_nuetzlich', gruppe: 'Bauliche Massnahmen', bezeichnung: 'Nützliche Massnahmen' },
	{ art: 'baulich_luxurioes', gruppe: 'Bauliche Massnahmen', bezeichnung: 'Luxuriöse Massnahmen' },
	{ art: 'verwaltung_gewoehnlich', gruppe: 'Verwaltung', bezeichnung: 'Gewöhnliche Verwaltungshandlungen' },
	{ art: 'verwaltung_wichtig', gruppe: 'Verwaltung', bezeichnung: 'Wichtigere Verwaltungshandlungen' },
	{ art: 'organe', gruppe: 'Verwaltung', bezeichnung: 'Bewirtschaftung und Organe' },
	{ art: 'jahresgeschaefte', gruppe: 'Verwaltung', bezeichnung: 'Jahresgeschäfte' },
	{ art: 'hausordnung', gruppe: 'Grundlagen', bezeichnung: 'Hausordnung' },
	{ art: 'reglement', gruppe: 'Grundlagen', bezeichnung: 'Reglement' },
	{ art: 'nutzungsrechte', gruppe: 'Grundlagen', bezeichnung: 'Ausschliessliche Nutzungsrechte' },
	{ art: 'nutzungsaenderung', gruppe: 'Grundlagen', bezeichnung: 'Nutzungs- und Zweckänderung' },
	{ art: 'grundordnung', gruppe: 'Grundordnung', bezeichnung: 'Grundstück und Grundordnung' },
	{ art: 'sonderfall', gruppe: 'Sonderfälle', bezeichnung: 'Sonderfälle' },
	{ art: 'kenntnisnahme', gruppe: 'Sonderfälle', bezeichnung: 'Kenntnisnahme ohne Beschluss' },
	/*
	 * **Kein Ergebnis des Entscheidbaums, sondern nur ein Anknüpfungspunkt.**
	 * Der Baum führt nie hierher — das Rückkommen ist kein Vorhaben, über das
	 * man sich fragt, ob es notwendig oder nützlich sei. Die Art steht in dieser
	 * Liste, damit ein Reglement, das das Rückkommen eigens regelt, sich
	 * hinterlegen lässt (PRD-Annahme 5: «sofern das Reglement nichts anderes
	 * sagt» — bis zum 13.08.2026 nicht erfüllbar). Angewandt wird die Regel nur,
	 * wenn sie nicht hinter dem Erfordernis des aufzuhebenden Beschlusses
	 * zurückbleibt; siehe `domain/rueckkommen.ts`.
	 */
	{ art: 'rueckkommen', gruppe: 'Sonderfälle', bezeichnung: 'Rückkommen auf einen Beschluss' }
];

export interface Antwort {
	id: string;
	text: string;
	/** Kennung der nächsten Frage oder des Ergebnisknotens. */
	ziel: string;
	hilfe?: string;
}

export interface Frage {
	id: string;
	text: string;
	hilfe?: string;
	antworten: Antwort[];
}

/**
 * Was eine hinterlegte Reglementsregel an diesem Knoten darf (15.08.2026).
 *
 * **Warum je Knoten und nicht je Ergebnistyp.** Bis zur Fassung 2026-08-15
 * sperrte die Übersteuerung pauschal nach Ergebnistyp: Einstimmigkeit,
 * Grenzfall und Kenntnisnahme blieben stehen, alles andere wurde ersetzt —
 * in beide Richtungen. Die Inhaltsprüfung vom 15.08.2026 (Befunde B-6 bis
 * B-11) hat gezeigt, dass die rechtliche Grenze am **Rechtsgrund** hängt:
 * Das einfache Mehr der Abberufung ist zwingend (SVIT ad 712r Rz. 23), das
 * der Ausschlussklage auch (SVIT ad 712g Rz. 55) — beide waren übersteuerbar.
 * Die Einstimmigkeit der Zweckänderung ist dagegen dispositiv (ZGB Art. 648
 * Abs. 2 in fine) — sie war gesperrt, mit einem Sperrtext, der eine zwingende
 * Rechtslage behauptete.
 *
 * Grenzfall und Kenntnisnahme brauchen kein Merkmal: Ihre Sperre liegt nicht
 * im Rechtsgrund, sondern darin, dass es nichts zu übersteuern gibt.
 */
export type Reglementsverhalten =
	/** Das Gesetz ist dispositiv; eine hinterlegte Regel gilt in beide Richtungen. */
	| 'frei'
	/**
	 * Einseitig zwingend: Angewandt wird nur eine Regel, die nachweislich nicht strenger ist; eine strengere und eine mit anderer Bezugsgrösse nicht
	 * (ZGB Art. 647e Abs. 2 — SVIT ad 712g Rz. 54; Art. 712g Abs. 3 — Rz. 40).
	 */
	| 'nur_mildern'
	/**
	 * Einseitig zwingend in die andere Richtung, das Spiegelbild von
	 * `nur_mildern` (ab Fassung 2026-10-20): Angewandt wird nur eine Regel für
	 * genau diesen Fall, die in keiner Hinsicht milder ist als das Gesetz
	 * (`einordnungGegenGesetz`); eine mildere und eine nicht vergleichbare nicht.
	 *
	 * **Anlass ist der Einsprachebeschluss** (ZGB Art. 712c Abs. 2): «Die
	 * Voraussetzung des Beschlusses mit einfachem Mehr kann nicht erleichtert
	 * werden», verschärfen lässt sie sich per Vereinbarung (Wermelinger,
	 * SVIT-Kommentar 2023, Art. 712c Rz. 185 f.). Nur fallgenau, damit eine
	 * Regel für die ganze Grundordnung nicht still auf die Einsprache wirkt.
	 */
	| 'nur_verschaerfen'
	/**
	 * Die hinterlegte Regel gilt, wenn sie sich eindeutig einordnen lässt: in
	 * jeder Hinsicht mindestens so streng wie das Gesetz oder in jeder Hinsicht
	 * höchstens so streng. Eine gemischte Regel, in einem Punkt strenger und im
	 * anderen milder, wird nicht angewandt; dann rechnet das Werkzeug nach dem Gesetz, und die Karte
	 * nennt die Regel (Produktentscheid 27.09.2026, ab Fassung 2026-10-06).
	 */
	| 'einordnen'
	/** Zwingendes Recht; eine abweichende Reglementsbestimmung wäre unbeachtlich. */
	| 'gesperrt_zwingend'
	/**
	 * Abweichung nur über eine **einstimmig vereinbarte** andere Ordnung möglich
	 * (ZGB Art. 648 Abs. 2). Die Anwendung kann die einstimmige Entstehung einer
	 * Klausel nicht prüfen und wendet sie deshalb nicht automatisch an — sagt
	 * aber, dass es sie geben kann, statt eine zwingende Rechtslage zu behaupten.
	 */
	| 'gesperrt_vereinbarung'
	/**
	 * Dieselbe Rechtslage wie `gesperrt_vereinbarung`: Eine andere Ordnung gilt
	 * nur, wenn sie einstimmig oder im Begründungsakt eingeführt wurde. Die
	 * Anwendung wendet eine hinterlegte Regel aber an, strenger wie milder
	 * (Produktentscheid 07.10.2026, ab Fassung 2026-10-15): Die Gemeinschaft
	 * hinterlegt sie mit Fundstelle und steht dafür ein, wie sie zustande kam,
	 * die Leitung trägt die Verantwortung. Dasselbe Muster wie die Einstellung
	 * zu den Enthaltungen. Die Karte nennt die Bedingung und, im
	 * `reglementsrecht` des Knotens, den Streit.
	 */
	| 'vereinbart'
	/**
	 * Ob eine abweichende Reglementsbestimmung trägt, ist umstritten; gerechnet
	 * wird nach dem Erfordernis der Karte (k-reglement-eigene-schranke, bis zur
	 * Fassung 2026-10-06 auch k-ausschlussklage). Ein eigener Grund mit eigenem
	 * Satz — der Zwingend-Text wäre hier eine falsche Rechtsbehauptung. Bis zum
	 * 28.09.2026 hiess es hier «Die Schranke stammt aus dem Reglement selbst»;
	 * das stimmte für die Ausschlussklage nie, dort stammt sie aus Art. 649b.
	 */
	| 'gesperrt_reglement';

/**
 * Ob an einem Knoten mit diesem Verhalten eine hinterlegte Regel überhaupt
 * angewandt werden kann (07.10.2026).
 *
 * **Eine Stelle für eine Aussage** (Codeprüfung 07.10.2026, H3). Bis hierher
 * zählten drei Filter einzeln auf, welche Verhalten durchlassen; mit dem neuen
 * Verhalten `vereinbart` blieben alle drei stehen, und an der Nutzungsänderung
 * fehlte die Wahl des Falls. Wer ein Verhalten hinzufügt, entscheidet hier.
 */
export function regelKannGreifen(verhalten: Reglementsverhalten | undefined): boolean {
	return (
		verhalten === undefined ||
		verhalten === 'frei' ||
		verhalten === 'nur_mildern' ||
		verhalten === 'nur_verschaerfen' ||
		verhalten === 'einordnen' ||
		verhalten === 'vereinbart'
	);
}

/**
 * Ob an diesem Knoten nur eine Regel greift, die für genau diesen Fall
 * hinterlegt ist, nicht eine für die ganze Geschäftsart (19.10.2026).
 *
 * Eine Stelle für Anwendung und Reglementsseite, aus demselben Grund wie
 * `regelKannGreifen`: An der Zweckbestimmung (`vereinbart` mit
 * Einstimmigkeit) senkte eine Regel für die ganze Art sonst die Zustimmung
 * aller, an der Einsprache (`nur_verschaerfen`) wirkte eine Regel der
 * Grundordnung still auf ein Mehr, das sich nicht erleichtern lässt.
 *
 * **Ab Fassung 2026-10-30 auch an der erweiterten Bewirtschaftung** (A1
 * Frage 2, A4): Eine Regel der ganzen Geschäftsart `organe`, gedacht für
 * Wahlen, ersetzte hier sonst das Mehr nach Köpfen und Wertquoten. Eine
 * Regel für «Wahlen» erfasst die Erweiterung nicht hinreichend deutlich
 * (Rz. 76 ad Art. 712g; Rz. 194 ad Art. 712m; BGer 5A_865/2011 E. 3.2).
 * **Warum an der Kennung und nicht am Verhalten:** `vereinbart` trägt
 * seit Fassung 2026-10-15 auch die wichtigeren Verwaltungshandlungen, und
 * deren Rechtssatz nennt die Bedingung einer milderen Bestimmung; dort
 * wendet die Anwendung eine hinterlegte Regel nach wie vor an, strenger wie
 * milder (Produktentscheid 07.10.2026). Die Kennung steht deshalb wörtlich
 * hier, wie bei `bezugsgroessenHinweis` mit `k-ausschlussklage`: Der Kern
 * kann die Fassungsdaten nicht einbinden. Alte Fassungen tragen an diesem
 * Knoten `frei` und fallen hier nicht hinein.
 */
export function regelNurFallgenau(k: {
	reglementsverhalten?: Reglementsverhalten;
	typ: Ergebnistyp;
	/** Die Kennung des Knotens, wo der Aufrufer sie hat; das Erfordernis trägt `knotenId`. */
	id?: string;
	knotenId?: string;
}): boolean {
	return (
		(k.reglementsverhalten === 'vereinbart' && k.typ === 'einstimmigkeit') ||
		k.reglementsverhalten === 'nur_verschaerfen' ||
		((k.id ?? k.knotenId) === 'k-bewirtschaftung-erweitert' && k.reglementsverhalten === 'vereinbart')
	);
}

/**
 * Ein Hinweis unter einer angewandten Regel, wörtlich aus `hinweise`
 * bezeichnet (Produktentscheid 29.09.2026, `docs/freigabe.md`).
 *
 * **Wörtlich statt über die Stelle.** Eine spätere Fassung, die einen Hinweis
 * ersetzt oder einen davor einfügt, verschöbe eine Stellenangabe still auf
 * den falschen Hinweis. Ein Wortlaut, den es nicht mehr gibt, meldet dagegen
 * `pruefeRegelwerk`.
 */
export interface HinweisUnterRegel {
	hinweis: string;
	/**
	 * Was im Abschnitt «Zum gesetzlichen Erfordernis» steht: `true` der
	 * Hinweis selbst, ein Text an seiner Stelle. Fehlt es, steht dort nichts.
	 */
	zumGesetz?: true | string;
	/**
	 * Was unter «Zu beachten» an seiner Stelle steht. Fehlt es, steht dort
	 * nichts. Beides zugleich trägt ein Hinweis, der zum Gesetz wandert, wenn
	 * an seiner Stelle etwas stehen bleiben muss, das unter jeder Regel gilt:
	 * ein Teil des Hinweises selbst (G7) oder ein Satz aus der Begründung, die
	 * mitwandert (G1; Fachprüfung 29.09.2026). **Im zweiten Fall hängt der
	 * Satz an einem fremden Hinweis:** Wer den Hinweis in einer späteren
	 * Fassung streicht, muss ihn an einen anderen hängen.
	 */
	ersatz?: string;
}

export interface Ergebnisknoten {
	id: string;
	titel: string;
	typ: Ergebnistyp;
	/** Woran eine Reglementsabweichung anknüpft — fassungsübergreifend stabil. */
	geschaeftsart: Geschaeftsart;
	/** Ausgeschrieben, etwa «ZGB Art. 647d Abs. 1». Erscheint wörtlich im Protokoll. */
	rechtsgrundlage: string;
	kopfbasis: Kopfbasis;
	quotenbasis: Quotenbasis;
	/**
	 * Ob zusätzlich zur Mehrheit die Zustimmung einzelner Personen nötig ist
	 * (ZGB Art. 712e Abs. 2, Art. 712g Abs. 4). Zwei Erfordernisse übereinander,
	 * nicht eines.
	 */
	zustimmungBetroffenerNoetig: boolean;
	/**
	 * Wie diese Zustimmung erteilt wird: im Saal oder vorab, oder erst nachher
	 * mit der Abänderungsurkunde (25.09.2026). Nur gesetzt, wo
	 * `zustimmungBetroffenerNoetig` wahr ist; Fassungen vor dem 28.09.2026
	 * tragen das Merkmal nicht, dort ordnet `betroffenenzustimmungVon` es über
	 * die Kennung zu.
	 */
	betroffenenzustimmung?: Betroffenenzustimmung;
	/** Warum dieses Erfordernis gilt — ein Satz, der im Protokoll bestehen muss. */
	begruendung: string;
	/**
	 * Knoteneigene Formel, wo die Typformel die Bezugsgrösse falsch sagte.
	 *
	 * Befund B-2: Die Ausschlussklage-Karte begann mit der E1-Formel
	 * («Mehrheit der anwesenden und vertretenen …»), obwohl ihre Kopfbasis
	 * alle Eigentümer ausser dem Beklagten zählt — die falsche Formel stand
	 * vor der richtigen Zählanweisung. `pruefeRegelwerk` erzwingt die eigene
	 * Formel überall dort, wo Basis und Typformel auseinanderlaufen.
	 */
	formel?: string;
	/** Erläuterung, wer als betroffen gilt. Pflicht, wenn Zustimmung nötig ist. */
	betroffeneErlaeuterung?: string;
	/** Was zusätzlich zur Mehrheit zu beachten ist. */
	hinweise?: string[];
	/**
	 * Was aus einzelnen Hinweisen wird, wenn eine hinterlegte Regel angewandt
	 * wird (ab Fassung 2026-10-08). Hinweise, die nur das gesetzliche
	 * Erfordernis erklären, wandern in den Abschnitt «Zum gesetzlichen
	 * Erfordernis»; einer, der die Basis des Gesetzes voraussetzt, aber auch
	 * unter der Regel etwas zu sagen hat, bekommt eine Fassung für die Regel.
	 * Hinweise, die hier nicht stehen, gelten unter jeder Regel unverändert.
	 */
	hinweiseUnterRegel?: HinweisUnterRegel[];
	beispiele?: string[];
	/** Bei Grenzfällen: was die Sitzungsleitung tun soll. Pflicht dort. */
	empfehlung?: string;
	/** Gesetzt, wo der Wortlaut «aller Miteigentümer» sagt und die Rechtsprechung anders rechnet. */
	wortlautAbweichung?: boolean;
	/**
	 * Was eine hinterlegte Reglementsregel hier darf. Ab Fassung 2026-08-15
	 * Pflicht an jedem Knoten ausser Grenzfall und Kenntnisnahme; ältere
	 * Fassungen tragen das Merkmal nicht, dort gilt die alte typbasierte Sperre.
	 */
	reglementsverhalten?: Reglementsverhalten;
	/**
	 * Was das Recht an diesem Knoten zu einer abweichenden Reglementsbestimmung
	 * sagt, wo es vom allgemeinen Satz des Verhaltens abweicht (ab Fassung
	 * 2026-10-15). Steht im Kasten zum Reglement vor dem Satz, was die Anwendung
	 * tut; bei einer hinterlegten Regel auch in ihrem Vorbehalt und unter der
	 * angewandten Regel. Fehlt es, gilt der allgemeine Satz des Verhaltens.
	 *
	 * **Warum am Knoten und nicht im Verhalten** (Fachprüfung 07.10.2026): Die
	 * Lehre unterscheidet je Geschäft. Bei der Abberufung ist auch eine
	 * Erleichterung ausgeschlossen, bei der Wertquotenänderung ist umstritten,
	 * ob auf die Genehmigung verzichtet werden kann; ein Satz je Verhalten sagte
	 * an mindestens einer Karte etwas Falsches.
	 */
	reglementsrecht?: string;
	/**
	 * Was gilt, wenn an der Versammlung eine Zustimmung fehlt, und der sichere
	 * Weg dann; nur an Knoten mit Einstimmigkeit, ab Fassung 2026-10-29. Auf der
	 * Karte ein eigenes Feld nach der Stimmwirkung (`Ergebniskarte`), damit eine
	 * angewandte Reglementsregel ohne Einstimmigkeit es weglassen kann
	 * (`karteMitReglement`).
	 *
	 * **Warum am Knoten und nicht am Typ** (Laien- und Fachprüfung 22.10.2026):
	 * Die Folge einer fehlenden Zustimmung ist je Karte eine andere. An der
	 * luxuriösen Massnahme gilt sie nur nach herrschender Lehre (Rz. 197 ad
	 * Art. 712m), an den Reglementskarten ist schon die Einstimmigkeit
	 * umstritten, der Zirkularbeschluss ist selbst der schriftliche Weg, und wo
	 * eine Urkunde nötig ist, ersetzt der schriftliche Beschluss sie nicht. Ein
	 * Satz am Typ sagte an mindestens einer Karte etwas Falsches; bis 2026-10-28
	 * riet er überall, Zustimmungen nachträglich einzuholen.
	 */
	einstimmigkeitsweg?: string;
	/**
	 * Was das gerechnete Erfordernis trägt (ab Fassung 2026-10-18; Ä-01,
	 * Entscheid 17.09.2026). Pflicht an jedem Knoten mit Erfordernis, sobald
	 * eine Fassung das Merkmal führt.
	 */
	rang?: Rang;
	/**
	 * Die andere Lesart des gesetzlichen Erfordernisses, mit Fundstelle (ab
	 * Fassung 2026-10-18; Ä-01, Ä-02, Ä-04, Entscheid 17.09.2026). Gesetzt nur,
	 * wo die Quellen über das Erfordernis selbst auseinanderliegen und der
	 * Knoten die strengere Lesart rechnet; die Traktandenliste sagt dann
	 * «umstritten, gerechnet wird die strenge Lesart». Der Satz beginnt mit
	 * dem Verb, die Liste setzt «Nach anderer Ansicht» davor.
	 *
	 * **Nicht gesetzt, wo nur gestritten wird, ob ein Reglement abweichen
	 * darf.** Das sagt `reglementsrecht`, und dort wendet die Anwendung eine
	 * hinterlegte Regel teils auch milder an (`einordnen`, `vereinbart`); «die
	 * strenge Lesart» wäre dort falsch. **Eine bewusste Ausnahme**:
	 * `k-reglement-eigene-schranke`, dessen Erfordernis selbst aus der Klausel
	 * hervorgeht (Fachprüfung 14.10.2026, F-4; Dateikopf der Fassung
	 * 2026-10-18). Ab der Fassung 2026-11-05 trägt sie die Lesart L6 statt
	 * der Gegenmeinung.
	 *
	 * **Und nicht, wo der Knoten die mildere Lesart rechnet**
	 * (`k-zustaendigkeit-gewoehnlich`, Produktentscheid 22.09.2026;
	 * `k-bewirtschaftung-waehlen` bei schon erweiterten Kompetenzen,
	 * `docs/entscheide/0015`, Hinweis seit Fassung 2026-10-21; `k-bewirtschaftung-waehlen-erweitert`
	 * rechnet bis Fassung 2026-11-11 die mildere Lesart, ab Fassung 2026-11-13
	 * nach Entscheid 0048 die strengere, das qualifizierte Mehr). Wo der Knoten
	 * die mildere Lesart rechnet, wäre der Satz der Traktandenliste die
	 * entgegengesetzte Aussage. Ein Satz je Regel, keine Rangrechnung
	 * (Abschnitt 0 in `docs/freigabe.md`).
	 */
	gegenmeinung?: string;
	/**
	 * Eine Lesart der Gemeinschaft an diesem Knoten (ab Fassung 2026-10-24,
	 * Entscheid 0018). Der Knoten rechnet eine Wahl des Katalogs, an der
	 * aktuellen Fassung die Vorgabe; `andere` sagt, was die andere Wahl
	 * verlangt. Welche er rechnet, sagt sein Mehr (`wahlDesKnotens`, Entscheid
	 * 0048), nicht die Vorgabe. Katalog und Prüfung in `domain/lesarten.ts`.
	 */
	lesart?: KnotenLesart;
}

/** Die Lesart an einem Knoten: Kennung aus dem Katalog und die andere Wahl. */
export interface KnotenLesart {
	kennung: 'L2' | 'L4' | 'L6' | 'L9' | 'L11' | 'L12';
	andere: {
		wahl: string;
		typ: Ergebnistyp;
		rechtsgrundlage: string;
		kopfbasis: Kopfbasis;
		quotenbasis: Quotenbasis;
		/**
		 * Der Weg zur Zustimmung aller, wie er nach dieser Wahl auf der Karte
		 * steht, wo er sich vom Weg des Knotens unterscheidet (L6, Fachprüfung
		 * Runde 2, R2-G-3): Nach dem Gesetz ist der Beschluss mit dem Mehr
		 * angenommen, nur nicht sicher.
		 */
		einstimmigkeitsweg?: string;
		/**
		 * Die Formel der Karte nach dieser Wahl, wo die Formel des Typs ihr
		 * widerspräche (E1, L12): Die Typformel der Einstimmigkeit nennt «nicht
		 * nur der Anwesenden», die Wahl «anwesende» zählt gerade nur sie. Fehlt
		 * das Feld, gilt wie bisher die Formel des Typs.
		 */
		formel?: string;
		/**
		 * Hinweise der Karte, die nach dieser Wahl anders lauten (E1, L9;
		 * Fachprüfung E1 L9, F-3): Ein Hinweis, der beschreibt, wie Votum nach der
		 * Wahl des Knotens rechnet, stünde sonst unter der anderen Wahl falsch. `alt` muss
		 * genau einmal unter den Hinweisen des Knotens stehen.
		 */
		hinweisErsatz?: { alt: string; neu: string }[];
	};
}

/**
 * Was ein gerechnetes Erfordernis trägt (ab Fassung 2026-10-18).
 *
 * **Fünf Werte statt der sechs Ränge und drei Merkmale aus Ä-01.** Die
 * Zweitprüfung wollte daraus berechnen, wann eine Regel «offen» ist; das Haus
 * rechnet nach dem Strengstprinzip vom 16.08.2026 und braucht die Rechnung
 * nicht (Abschnitt 0 in `docs/freigabe.md`). Was bleibt, ist die Auskunft,
 * worauf die Rechnung steht, und eine Prüfung gegen die Wortlautabweichung.
 *
 *   - `gesetz`: Der Wortlaut des Gesetzes trägt Mehr und Bezugsgrösse, so
 *     wie gerechnet wird.
 *   - `bundesgericht`: Gerechnet wird gegen den Wortlaut, wie das
 *     Bundesgericht für diese Bestimmung entschieden hat.
 *   - `lehre`: Gerechnet wird gegen den Wortlaut oder über ihn hinaus, wie
 *     Kommentar und Lehre es tun, ohne Entscheid des Bundesgerichts dazu.
 *   - `praxis`: Das Gesetz nennt das Geschäft nicht; gerechnet wird nach der
 *     Praxis.
 *   - `reglement`: Das Erfordernis stammt aus dem Reglement der Gemeinschaft.
 */
export type Rang = 'gesetz' | 'bundesgericht' | 'lehre' | 'praxis' | 'reglement';

/**
 * Was die Traktandenliste bei einer Regel mit Gegenmeinung sagt (Entscheid
 * 17.09.2026). Mit Gegenstand und Grund (Laienprüfung 14.10.2026, Befunde 1
 * und 5): «Umstritten» allein las sich als «das Geschäft ist umstritten», und
 * ohne Grund blieb offen, ob die Leitung mildern soll. Dass die strenge Lesart
 * die andere umfasst, ist an allen vier Knoten nachgeprüft (Fachprüfung
 * 14.10.2026, Frage 2).
 */
export const UMSTRITTEN_SATZ =
	'Welches Mehr gilt, ist umstritten. Gerechnet wird die strenge Lesart; wer sie erreicht, ' +
	'genügt auch der anderen.';

export interface Ast {
	id: string;
	titel: string;
	beschreibung: string;
	/** Kennung der ersten Frage oder — bei einem Ast ohne Rückfrage — des Knotens. */
	einstieg: string;
}

export interface Regelwerk {
	/** Unveränderliche Fassungskennung, Format JJJJ-MM-TT (AD-4). */
	fassung: string;
	/**
	 * Ob eine Juristin die Fassung gegengelesen hat. Bis zum 16.11.2026 wies die
	 * Oberfläche darauf hin, solange es falsch war; seit Entscheid 0052 steuert
	 * es keine Anzeige mehr und bleibt `false`, weil es eine Tatsache beschreibt
	 * (die offenen Rechtsfragen sind nach Entscheid 0044 eingeordnet, fest
	 * gerechnet oder als Lesart einstellbar; gegengelesen hat niemand).
	 */
	juristischGegengelesen: boolean;
	/** Wer wann was freigegeben hat, im Klartext. */
	freigabevermerk: string;
	quellen: string[];
	/** Der Standardsatz, der auf jeder Ergebniskarte steht. */
	reglementsvorbehalt: string;
	/** Hinweis für Vorhaben, die mehrere Zwecke zugleich verfolgen. */
	gemischteGeschaefte: string;
	/** Die sechs Bestimmungen, deren Wortlaut «aller Miteigentümer» lautet. */
	wortlautArtikel: string[];
	wortlautErklaerung: string;
	/**
	 * Die Erklärung zum Wortlaut «aller Miteigentümer», je Artikel
	 * (ab Fassung 2026-10-30, A4). Schlüssel ist der Eintrag aus
	 * `wortlautArtikel`, dessen Artikel der Knoten als Rechtsgrundlage nennt
	 * (`startsWith`, wie in `pruefeRegelwerk`); fehlt der Eintrag, gilt
	 * `wortlautErklaerung`.
	 *
	 * **Warum je Artikel** (Fachprüfung Block 3, Befund 2): Die bisherige
	 * Erklärung belegt «gezählt nach den Anwesenden» mit Art. 647b, 647d,
	 * 647e und BGE 144 III 510 zu Art. 647d. An Art. 647a Abs. 2 trägt das
	 * nicht; dort gilt, was die Karte seit Fassung 2026-10-26 nennt
	 * (Rz. 166b ad Art. 712m; Handschin/Wyttenbach S. 68; BGE 131 III 459
	 * E. 5.2). Für Art. 647c ist nicht geprüft, was trägt; er behält die
	 * bisherige Erklärung.
	 */
	wortlautErklaerungJeArtikel?: Record<string, string>;
	/**
	 * Dieselbe Erklärung, wo die Gemeinschaft die Köpfe an allen Eigentümern
	 * zählt (L13, ab Fassung 2026-11-14; Endfassung Block C, Fassung 4c). Nur
	 * Votum, nicht die Website: Die zeigt die Vorgabe. Fehlt der Eintrag, gilt
	 * `wortlautErklaerungJeArtikel`.
	 */
	wortlautErklaerungJeArtikelAlle?: Record<string, string>;
	/**
	 * Die Formel der Ergebniskarte, wo die Gemeinschaft die Köpfe an allen
	 * Eigentümern zählt (L13, ab Fassung 2026-11-14): Die Formel des Typs nennt
	 * die Anwesenden (`knotenNachZaehlweise` in `lesarten.ts`).
	 */
	formelAlleEigentuemer?: Partial<Record<Ergebnistyp, string>>;
	ergebnistypen: Ergebnistypdefinition[];
	aeste: Ast[];
	fragen: Frage[];
	knoten: Ergebnisknoten[];
}

// ── Prüfung des Regelwerks ──────────────────────────────────────────────────

/**
 * Prüft eine Fassung auf innere Stimmigkeit und gibt die Befunde zurück.
 *
 * Läuft als Test über jede ausgelieferte Fassung. Der Grund ist nüchtern: Eine
 * Datendatei hat keinen Übersetzer, der auf einen Tippfehler in einer Zielkennung
 * hinweist. Ohne diese Prüfung endet ein Pfad im Nichts — und zwar erst dann,
 * wenn jemand ihn im Saal beschreitet.
 */
export function pruefeRegelwerk(rw: Regelwerk): string[] {
	const befunde: string[] = [];

	if (!istKalendertag(rw.fassung)) {
		befunde.push(`Fassungskennung «${rw.fassung}» hat nicht das Format JJJJ-MM-TT (AD-4).`);
	}

	const knotenNachId = new Map(rw.knoten.map((k) => [k.id, k]));
	const fragenNachId = new Map(rw.fragen.map((f) => [f.id, f]));

	// Doppelte Kennungen: Der Pfad eines alten Beschlusses würde später auf einen
	// anderen Knoten zeigen als damals.
	const gesehen = new Set<string>();
	for (const id of [...rw.knoten.map((k) => k.id), ...rw.fragen.map((f) => f.id)]) {
		if (gesehen.has(id)) befunde.push(`Kennung «${id}» ist doppelt vergeben.`);
		gesehen.add(id);
	}

	const zielVorhanden = (ziel: string) => knotenNachId.has(ziel) || fragenNachId.has(ziel);

	for (const ast of rw.aeste) {
		if (!zielVorhanden(ast.einstieg)) {
			befunde.push(`Ast «${ast.id}» beginnt bei «${ast.einstieg}», das es nicht gibt.`);
		}
	}

	for (const frage of rw.fragen) {
		if (frage.antworten.length < 2) {
			befunde.push(`Frage «${frage.id}» hat weniger als zwei Antworten.`);
		}
		for (const antwort of frage.antworten) {
			if (!zielVorhanden(antwort.ziel)) {
				befunde.push(
					`Antwort «${antwort.id}» der Frage «${frage.id}» zeigt auf «${antwort.ziel}», das es nicht gibt.`
				);
			}
		}
	}

	// Die Wirkung gehört zum Typ, die Bezugsgrösse zum Knoten. Nennt der Typ eine
	// Basis, steht sie irgendwann im Widerspruch zu einem Knoten — und ausgerechnet
	// im Satz, den die Sitzungsleitung im Saal vorliest.
	for (const typ of rw.ergebnistypen) {
		if (typ.stimmwirkungen.art !== 'festgelegt') continue;
		const verraeterisch = ['anwesend', 'Anwesenheit', 'alle Eigentümer', 'fernbleib', 'Fernbleib', 'erschienen'];
		for (const wort of verraeterisch) {
			if (typ.stimmwirkungen.wirkung.includes(wort)) {
				befunde.push(
					`Der Ergebnistyp «${typ.typ}» nennt in seiner Wirkung «${wort}» und damit eine Bezugsgrösse. Die gehört an den Knoten.`
				);
			}
		}
	}

	const typen = new Set(rw.ergebnistypen.map((t) => t.typ));
	for (const knoten of rw.knoten) {
		if (!typen.has(knoten.typ)) {
			befunde.push(`Knoten «${knoten.id}» hat den unbekannten Ergebnistyp «${knoten.typ}».`);
		}

		// Der Befund aus der Prüfung: Wo der Wortlaut anders lautet als die
		// angewandte Rechtsprechung, muss der Knoten das festhalten. Die Angabe
		// im Knoten und die Artikelliste dürfen nicht auseinanderlaufen — sonst
		// steht die Erklärung mal da und mal nicht.
		//
		// Ausgenommen ist der Grenzfall: Er wendet keine Bestimmung an, sondern
		// nennt die, zwischen denen zu entscheiden ist. Eine Bezugsgrösse, auf
		// die sich die Erklärung beziehen könnte, setzt er gar nicht.
		if (knoten.typ !== 'grenzfall') {
			const betroffen = rw.wortlautArtikel.some((a) => knoten.rechtsgrundlage.startsWith(a));
			if (betroffen && knoten.wortlautAbweichung !== true) {
				befunde.push(
					`Knoten «${knoten.id}» beruft sich auf ${knoten.rechtsgrundlage}, dessen Wortlaut «aller Miteigentümer» lautet, hält die Abweichung aber nicht fest.`
				);
			}
			if (!betroffen && knoten.wortlautAbweichung === true) {
				befunde.push(
					`Knoten «${knoten.id}» hält eine Wortlautabweichung fest, obwohl ${knoten.rechtsgrundlage} nicht in der Liste steht.`
				);
			}
		}

		if (knoten.zustimmungBetroffenerNoetig && !knoten.betroffeneErlaeuterung) {
			befunde.push(
				`Knoten «${knoten.id}» verlangt die Zustimmung Betroffener, sagt aber nicht, wer als betroffen gilt.`
			);
		}

		// Eine Form ohne Erfordernis ist keine Angabe, sondern ein Rest: Sie
		// stünde an einem Knoten, an dem gar niemand zustimmen muss, und
		// `betroffenenzustimmungVon` läse sie als gültig.
		if (knoten.betroffenenzustimmung && !knoten.zustimmungBetroffenerNoetig) {
			befunde.push(
				`Knoten «${knoten.id}» nennt eine Form der Betroffenenzustimmung, verlangt aber keine Zustimmung.`
			);
		}

		// Zwei Dinge, die sich ausschliessen: Wer aus der Bezugsgrösse fällt,
		// kann nicht zugleich zustimmen müssen.
		if (knoten.kopfbasis === 'alle_ausser_betroffene' && knoten.zustimmungBetroffenerNoetig) {
			befunde.push(
				`Knoten «${knoten.id}» schliesst die Betroffenen aus der Basis aus und verlangt zugleich ihre Zustimmung.`
			);
		}

		if (knoten.typ === 'grenzfall' && !knoten.empfehlung) {
			befunde.push(`Grenzfall «${knoten.id}» sagt nicht, was die Sitzungsleitung tun soll.`);
		}

		if (knoten.typ === 'keine_abstimmung' && knoten.quotenbasis !== 'keine') {
			befunde.push(`Knoten «${knoten.id}» stimmt nicht ab, nennt aber eine Quotenbasis.`);
		}

		if (!GESCHAEFTSARTEN.some((g) => g.art === knoten.geschaeftsart)) {
			befunde.push(`Knoten «${knoten.id}» nennt die unbekannte Geschäftsart «${knoten.geschaeftsart}».`);
		}

		// Eine Quotenbasis ohne Schwelle ist eine Anforderung ohne Zahl.
		const def = rw.ergebnistypen.find((t) => t.typ === knoten.typ);
		if (def && knoten.quotenbasis !== 'keine' && !def.schwellen.quoten) {
			befunde.push(
				`Knoten «${knoten.id}» nennt eine Quotenbasis, sein Ergebnistyp «${knoten.typ}» aber keine Quotenschwelle.`
			);
		}
		if (def && knoten.quotenbasis === 'keine' && def.schwellen.quoten) {
			befunde.push(
				`Der Ergebnistyp «${knoten.typ}» kennt eine Quotenschwelle, Knoten «${knoten.id}» nennt aber keine Quotenbasis.`
			);
		}

		// Die Typformeln von E1 und E2 sprechen von den Anwesenden und
		// Vertretenen. Ein Knoten mit anderer Kopfbasis braucht die eigene
		// Formel, sonst widersprechen sich Karte und Zählweise (Befund B-2).
		if (
			(knoten.typ === 'einfaches_mehr' || knoten.typ === 'qualifiziertes_mehr') &&
			knoten.kopfbasis !== 'anwesend_vertreten' &&
			!knoten.formel
		) {
			befunde.push(
				`Knoten «${knoten.id}» zählt nach «${knoten.kopfbasis}», zeigte aber die Typformel der Anwesenden — er braucht eine eigene Formel.`
			);
		}

		// Ein Eintrag, dessen Hinweis es nicht gibt, bewirkte nichts: Der
		// Hinweis zum Gesetz stünde unter der Regel weiter bei den übrigen.
		const unterRegel = knoten.hinweiseUnterRegel ?? [];
		for (const u of unterRegel) {
			if (!(knoten.hinweise ?? []).includes(u.hinweis)) {
				befunde.push(
					`Knoten «${knoten.id}» nennt unter «hinweiseUnterRegel» einen Hinweis, den er nicht trägt: «${u.hinweis.slice(0, 60)}…».`
				);
			}
			if (u.zumGesetz === undefined && u.ersatz === undefined) {
				befunde.push(
					`Knoten «${knoten.id}» nennt unter «hinweiseUnterRegel» einen Hinweis, ohne zu sagen, was aus ihm wird.`
				);
			}
			if (u.ersatz?.trim() === '' || (typeof u.zumGesetz === 'string' && u.zumGesetz.trim() === '')) {
				befunde.push(`Knoten «${knoten.id}» ersetzt unter einer Regel einen Hinweis durch nichts.`);
			}
		}
		if (new Set(unterRegel.map((u) => u.hinweis)).size !== unterRegel.length) {
			befunde.push(`Knoten «${knoten.id}» nennt unter «hinweiseUnterRegel» einen Hinweis zweimal.`);
		}
		if (
			unterRegel.length > 0 &&
			(knoten.typ === 'grenzfall' ||
				knoten.typ === 'keine_abstimmung' ||
				knoten.reglementsverhalten?.startsWith('gesperrt'))
		) {
			befunde.push(
				`Knoten «${knoten.id}» sagt, was unter einer Regel aus seinen Hinweisen wird, wendet aber keine an.`
			);
		}
	}

	/*
	 * **Reglementsverhalten: ganz oder gar nicht.** Eine Fassung, die das
	 * Merkmal an einem Knoten setzt, muss es an jedem entscheidungsfähigen
	 * Knoten setzen — sonst fiele ein vergessener Knoten still auf das alte,
	 * typbasierte Verhalten zurück, und genau dieses Verhalten war der Befund
	 * (B-6 bis B-11 der Prüfung vom 15.08.2026). Grenzfall und Kenntnisnahme
	 * tragen keines: Dort gibt es kein Erfordernis, das eine Regel ersetzen
	 * könnte, und ein gesetztes Merkmal wäre eine Behauptung ohne Gegenstand.
	 */
	if (rw.knoten.some((k) => k.reglementsverhalten !== undefined)) {
		for (const knoten of rw.knoten) {
			const ohneErfordernis = knoten.typ === 'grenzfall' || knoten.typ === 'keine_abstimmung';
			if (ohneErfordernis && knoten.reglementsverhalten !== undefined) {
				befunde.push(
					`Knoten «${knoten.id}» (${knoten.typ}) trägt ein Reglementsverhalten, hat aber kein Erfordernis, das eine Regel ersetzen könnte.`
				);
			}
			if (!ohneErfordernis && knoten.reglementsverhalten === undefined) {
				befunde.push(
					`Knoten «${knoten.id}» trägt kein Reglementsverhalten, obwohl diese Fassung das Merkmal führt — er fiele still auf die alte typbasierte Sperre zurück.`
				);
			}
		}
	}

	/*
	 * **Rang: ganz oder gar nicht**, aus demselben Grund wie beim
	 * Reglementsverhalten. Dazu zwei Prüfungen, die den Rang an Merkmalen
	 * festmachen, die schon dastehen: Wer vom Wortlaut abweicht, rechnet nicht
	 * nach dem Gesetz; und das Erfordernis aus dem Reglement erkennt man an der
	 * Rechtsgrundlage.
	 */
	if (rw.knoten.some((k) => k.rang !== undefined)) {
		for (const knoten of rw.knoten) {
			const ohneErfordernis = knoten.typ === 'grenzfall' || knoten.typ === 'keine_abstimmung';
			if (ohneErfordernis && knoten.rang !== undefined) {
				befunde.push(`Knoten «${knoten.id}» (${knoten.typ}) trägt einen Rang, hat aber kein Erfordernis.`);
			}
			if (!ohneErfordernis && knoten.rang === undefined) {
				befunde.push(`Knoten «${knoten.id}» trägt keinen Rang, obwohl diese Fassung das Merkmal führt.`);
			}
			if (knoten.wortlautAbweichung === true && knoten.rang === 'gesetz') {
				befunde.push(
					`Knoten «${knoten.id}» weicht vom Wortlaut ab und nennt trotzdem das Gesetz als Rang.`
				);
			}
			if ((knoten.rang === 'reglement') !== knoten.rechtsgrundlage.startsWith('Reglement')) {
				befunde.push(
					`Knoten «${knoten.id}»: Rang «${knoten.rang}» und Rechtsgrundlage «${knoten.rechtsgrundlage.slice(0, 40)}…» passen nicht zusammen.`
				);
			}
		}
	}

	/*
	 * **Gegenmeinung nur mit Streit auf der Karte.** Die Traktandenliste sagt
	 * «umstritten» in einem Satz; die Karte muss den Streit dann auch
	 * ausführen, sonst steht der Hinweis ohne Erklärung da. Und ein Knoten ohne
	 * Erfordernis kann keine strengere Lesart rechnen.
	 */
	for (const knoten of rw.knoten) {
		if (knoten.gegenmeinung === undefined) continue;
		if (knoten.typ === 'grenzfall' || knoten.typ === 'keine_abstimmung') {
			befunde.push(`Knoten «${knoten.id}» nennt eine Gegenmeinung, rechnet aber kein Erfordernis.`);
		}
		if (knoten.gegenmeinung.trim() === '') {
			befunde.push(`Knoten «${knoten.id}» nennt eine leere Gegenmeinung.`);
		}
		const karte = [knoten.begruendung, ...(knoten.hinweise ?? [])].join(' ');
		if (!karte.includes('umstritten')) {
			befunde.push(
				`Knoten «${knoten.id}» nennt eine Gegenmeinung, die Karte führt den Streit aber nicht aus.`
			);
		}
	}

	// Erreichbarkeit. Ein Knoten, zu dem kein Weg führt, ist ein Versprechen ohne
	// Einlösung — er steht in der Datei und kommt nie vor.
	const erreichbar = erreichbareKennungen(rw);
	for (const knoten of rw.knoten) {
		if (!erreichbar.has(knoten.id)) befunde.push(`Knoten «${knoten.id}» ist von keinem Ast aus erreichbar.`);
	}
	for (const frage of rw.fragen) {
		if (!erreichbar.has(frage.id)) befunde.push(`Frage «${frage.id}» ist von keinem Ast aus erreichbar.`);
	}

	for (const zyklus of findeZyklen(rw)) {
		befunde.push(`Die Fragen ${zyklus.join(' → ')} bilden einen Kreis; der Baum hätte kein Ende.`);
	}

	return befunde;
}

/** Alle von einem Ast aus erreichbaren Fragen und Knoten. */
function erreichbareKennungen(rw: Regelwerk): Set<string> {
	const fragenNachId = new Map(rw.fragen.map((f) => [f.id, f]));
	const gesehen = new Set<string>();
	const offen = rw.aeste.map((a) => a.einstieg);

	while (offen.length > 0) {
		const id = offen.pop() as string;
		if (gesehen.has(id)) continue;
		gesehen.add(id);
		const frage = fragenNachId.get(id);
		if (frage) offen.push(...frage.antworten.map((a) => a.ziel));
	}
	return gesehen;
}

/** Findet Kreise zwischen Fragen. Ein Knoten hat keine ausgehenden Kanten und kann keinen bilden. */
function findeZyklen(rw: Regelwerk): string[][] {
	const fragenNachId = new Map(rw.fragen.map((f) => [f.id, f]));
	const zyklen: string[][] = [];
	const fertig = new Set<string>();

	function gehe(id: string, pfad: string[]): void {
		if (pfad.includes(id)) {
			zyklen.push([...pfad.slice(pfad.indexOf(id)), id]);
			return;
		}
		if (fertig.has(id)) return;
		const frage = fragenNachId.get(id);
		if (!frage) return;
		for (const antwort of frage.antworten) gehe(antwort.ziel, [...pfad, id]);
		fertig.add(id);
	}

	for (const frage of rw.fragen) gehe(frage.id, []);
	return zyklen;
}

// ── Lesehilfen ──────────────────────────────────────────────────────────────

export function knotenVon(rw: Regelwerk, id: string): Ergebnisknoten | undefined {
	return rw.knoten.find((k) => k.id === id);
}

export function frageVon(rw: Regelwerk, id: string): Frage | undefined {
	return rw.fragen.find((f) => f.id === id);
}

export function typdefinition(rw: Regelwerk, typ: Ergebnistyp): Ergebnistypdefinition {
	const gefunden = rw.ergebnistypen.find((t) => t.typ === typ);
	if (!gefunden) throw new Error(`Ergebnistyp «${typ}» ist in Fassung ${rw.fassung} nicht definiert.`);
	return gefunden;
}

/**
 * Rangfolge der Strenge. Gebraucht, um eine Abweichung als Abschwächung zu
 * erkennen (Story 2.3) und um bei gemischten Geschäften das strengere
 * Erfordernis zu bestimmen.
 *
 * Der Grenzfall steht bewusst ausserhalb: Er ist nicht strenger oder milder,
 * sondern unbestimmt. `null` zwingt die aufrufende Stelle, das zu behandeln.
 */
export function strenge(typ: Ergebnistyp): number | null {
	switch (typ) {
		case 'keine_abstimmung':
			return 0;
		case 'einfaches_mehr':
			return 1;
		case 'qualifiziertes_mehr':
			return 2;
		case 'einstimmigkeit':
			return 3;
		case 'grenzfall':
		case 'reglementsmehr':
			// Beide ohne Rang, aus verschiedenen Gründen: Der Grenzfall ist
			// ungeklärt, das Reglementsmehr steht ausserhalb der gesetzlichen
			// Leiter — zwei Drittel der Anwesenden sind nicht ohne Weiteres mehr
			// oder weniger als die Hälfte aller Wertquoten.
			return null;
	}
}

/** Das strengere zweier Erfordernisse. Ist eines unbestimmt, bleibt es unbestimmt. */
export function strengeres(a: Ergebnistyp, b: Ergebnistyp): Ergebnistyp | null {
	const ra = strenge(a);
	const rb = strenge(b);
	if (ra === null || rb === null) return null;
	return ra >= rb ? a : b;
}

/**
 * Ob eine nicht erschienene Stimme in der Bezugsgrösse bleibt.
 *
 * Ergibt sich allein aus der Bezugsgrösse des Knotens, nie aus dem Ergebnistyp
 * (AD-15). Bei der Ausschlussklage gilt das einfache Mehr, und trotzdem zählen
 * die Abwesenden mit.
 */
export function abwesenheitswirkung(kopfbasis: Kopfbasis): Stimmwirkung {
	return kopfbasis === 'anwesend_vertreten' ? 'nicht_in_basis' : 'in_basis';
}

/**
 * Die Bezugsgrösse in einem Satz, samt Wirkung des Fernbleibens.
 *
 * **Nimmt die Kopfbasis, nicht den Knoten** (06.09.2026). Seit die
 * Reglementskarte denselben Satz braucht, gibt es einen zweiten Aufrufer, der
 * keinen Knoten hat — er hat eine Regel. Genau dieselbe Begründung steht bei
 * `bezugsgroessenHinweis`, und dort auch der Grund, warum kein Knoten erfunden
 * wird: Eine Attrappe sähe aus wie eine Herleitung, die nicht stattfand.
 */
export function bezugsgroessensatz(
	kopfbasis: Kopfbasis,
	/**
	 * Ob der Beklagte der Ausschlussklage herausfällt, obwohl die Kopfbasis
	 * das nicht sagt (seit 29.09.2026, `betroffeneStimmenNichtMit`). Für die
	 * Einsprache trägt seit 19.10.2026 `anDerEinsprache` den eigenen Satz.
	 */
	ohneBeklagten = false,
	/**
	 * Ob der Satz auf der Karte zur Ermächtigung zur Ausschlussklage steht. Dort
	 * nennt er den Beklagten statt «der unmittelbar Betroffenen»: Seit 2026-10-11
	 * bleibt die gemeinsame Wohnung des Beklagten in der Zahl, und «nur die
	 * Betroffenen fallen heraus» stünde daneben (Codeprüfung 30.09.2026; Laien-
	 * und Fachprüfung 30.09.2026, A4). Eine Reglementsregel mit dieser
	 * Bezugsgrösse für ein anderes Geschäft behält den allgemeinen Satz.
	 */
	anDerAusschlussklage = false,
	/**
	 * Ob der Satz an der Einsprache steht (ab Fassung 2026-10-20). Dort nennt er,
	 * wer verkauft, vermietet oder belastet, statt «der Betroffenen»
	 * (Codeprüfung Durchgang 3, N3).
	 */
	anDerEinsprache = false
): string {
	switch (kopfbasis) {
		case 'anwesend_vertreten':
			/*
			 * **Ohne Beklagten nur an der Ausschlussklage** (19.10.2026). Seit
			 * der Fassung 2026-10-20 stimmen die Betroffenen auch bei der
			 * Einsprache nach Art. 712c Abs. 2 nicht mit; dort gibt es keinen
			 * Beklagten, und Art. 649b Abs. 2 wäre die falsche Norm.
			 */
			if (ohneBeklagten && anDerEinsprache) {
				return (
					'Die Bezugsgrösse sind die anwesenden oder vertretenen Stimmen ohne den Eigentümer, ' +
					'der verkauft, vermietet oder belastet. Er stimmt nicht mit, und Votum zählt auch ' +
					'seine Vollmachten nicht. Wer nicht erschienen ist und niemanden bevollmächtigt hat, ' +
					'zählt nicht mit.'
				);
			}
			if (ohneBeklagten && !anDerAusschlussklage) {
				return (
					'Die Bezugsgrösse sind die anwesenden oder vertretenen Stimmen ohne die Betroffenen; ' +
					'sie stimmen nicht mit, und Votum zählt auch ihre Vollmachten nicht. Wer nicht ' +
					'erschienen ist und niemanden bevollmächtigt hat, zählt nicht mit.'
				);
			}
			if (ohneBeklagten) {
				return (
					'Die Bezugsgrösse sind die anwesenden und vertretenen Stimmen ohne den Beklagten, ' +
					'der nicht mitstimmt (ZGB Art. 649b Abs. 2). Wer nicht erschienen ist und niemanden ' +
					'bevollmächtigt hat, zählt nicht mit.'
				);
			}
			return (
				'Die Bezugsgrösse sind die anwesenden und vertretenen Stimmen. Wer nicht erschienen ist ' +
				'und niemanden bevollmächtigt hat, zählt nicht mit.'
			);
		case 'alle_eigentuemer':
			// An Ausschlussklage und Einsprache kommt eine Klausel «aller Eigentümer»
			// nicht hierher: `kopfbasisDerRegel` liest sie als `alle_ausser_betroffene`
			// (Codeprüfung Durchgang 2, M2). Mit Vollmacht (NZ-7, Laienprüfung der
			// nachträglichen Zustimmung): Wer fernbleibt und niemanden bevollmächtigt
			// hat, zählt mit und wirkt gegen den Antrag; wer bevollmächtigt hat,
			// wirkt über den Vertreter. Dasselbe gilt für alle Karten mit Basis
			// «alle», auch für die ohne die Betroffenen.
			return (
				'Die Bezugsgrösse sind alle Eigentümer, auch die nicht erschienenen. Wer fernbleibt und niemanden ' +
				'bevollmächtigt hat, zählt mit und wirkt damit gegen den Antrag.'
			);
		case 'alle_ausser_betroffene':
			if (anDerAusschlussklage) {
				return (
					'Die Bezugsgrösse sind alle Eigentümer ohne den Beklagten, unabhängig von der ' +
					'Anwesenheit. Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit. Zu Angehörigen ' +
					'im Ausstand siehe den Hinweis dazu.'
				);
			}
			if (anDerEinsprache) {
				return (
					'Die Bezugsgrösse sind alle Eigentümer ohne den Eigentümer, der verkauft, vermietet ' +
					'oder belastet, unabhängig von der Anwesenheit. Auch wer fernbleibt und niemanden ' +
					'bevollmächtigt hat, zählt mit und wirkt wie ein Nein.'
				);
			}
			return (
				'Die Bezugsgrösse sind alle Eigentümer ausser den unmittelbar Betroffenen, unabhängig ' +
				'von der Anwesenheit. Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit; nur die ' +
				'Betroffenen fallen heraus.'
			);
	}
}

/**
 * Der Satz zur Wertquotenbasis — oder `null`, wo es keine absolute gibt.
 *
 * Aus demselben Grund ausgelagert wie `bezugsgroessensatz`: Gilt eine
 * Reglementsregel, ist auch die Quotenbasis die der **Regel**. Der Code-Review
 * vom 06.09.2026 fand ihn als Nachbarstelle des ersten Befundes — der
 * Kopfbasis-Satz war da schon übernommen, dieser stand noch eine Zeile tiefer
 * und behauptete ein Quotenmehr über alle Quoten, wo die angewandte Regel gar
 * keine Quotenschranke kennt.
 */
export function quotenwirkungssatz(quotenbasis: Quotenbasis): string | null {
	if (quotenbasis !== 'alle_quoten') return null;
	return (
		// Mit Vollmacht wie `bezugsgroessensatz` (NZ-7; Codeprüfung Prüfschritt A4, N4).
		'Bei den Wertquoten ist die Bezugsgrösse die Gesamtheit aller Quoten — dort wirkt auch ' +
		'das Fernbleiben ohne Vollmacht gegen den Antrag. Die Quote des Abwesenden bleibt in der Basis ' +
		'und zählt nicht zu den Ja-Stimmen.'
	);
}

/** Die Stimmwirkung der Einstimmigkeit nur der Anwesenden (E1, L12; Fachprüfung F-6). */
export const EINSTIMMIGKEIT_DER_ANWESENDEN_WIRKUNG =
	'Nötig ist die ausdrückliche Zustimmung jedes Anwesenden und Vertretenen; Enthaltung und Nichtabgabe im Saal verhindern sie gleichermassen.';

/**
 * Die Wirkung von Enthaltung, Nichtabgabe und Fernbleiben — für **diesen**
 * Knoten, nicht für seinen Ergebnistyp.
 *
 * **Ohne die Sätze zu den Bezugsgrössen.** Die stehen seit dem 06.09.2026 als
 * eigene Felder auf der Karte (`bezugsgroessensatz`, `quotenwirkungssatz`), und
 * zwar aus einem Grund, der sich hier nicht lösen liess: Gilt eine
 * Reglementsregel, sind die Bezugsgrössen die der **Regel**, nicht die des
 * Knotens. Solange die Sätze als Einträge in dieser Liste steckten, hätte
 * `karteMitReglement` sie über ihre Position ersetzen müssen — eine Annahme,
 * die beim nächsten zusätzlichen Absatz still das Falsche trifft.
 *
 * Was bleibt, ist die Wirkung des Ergebnistyps. Sie nennt bewusst keine
 * Bezugsgrösse (`pruefeRegelwerk` setzt das durch), und genau deshalb darf sie
 * hier stehen bleiben, während die Bezugsgrössen wechseln.
 */
export function stimmwirkungsteile(rw: Regelwerk, knoten: Ergebnisknoten): string[] {
	// Einstimmigkeit nur der Anwesenden (Lesart L12, «anwesende»; Fachprüfung E1
	// L12, F-6): Der Satz des Typs spräche von «jedes Einzelnen», die Formel
	// davon, dass Abwesende nicht mitzählen.
	if (knoten.typ === 'einstimmigkeit' && knoten.kopfbasis === 'anwesend_vertreten') {
		return [EINSTIMMIGKEIT_DER_ANWESENDEN_WIRKUNG];
	}
	const def = typdefinition(rw, knoten.typ);
	if (def.stimmwirkungen.art !== 'festgelegt') return [def.stimmwirkungen.satz];
	return [def.stimmwirkungen.wirkung];
}


/**
 * Erklärt eine vom Regelfall abweichende Bezugsgrösse in einem Satz.
 *
 * Steht auf der Ergebniskarte, weil «alle Eigentümer» im Saal etwas anderes
 * bedeutet als «alle Anwesenden» — und wer den Unterschied nicht ausspricht,
 * zählt die Erschienenen und hält das Ergebnis für richtig.
 */
export function bezugsgroessenHinweis(
	/*
	 * Nur die Kopfbasis, nicht der ganze Knoten (23.08.2026, B-22): Seit die
	 * Reglementskarte denselben Satz braucht, gibt es einen zweiten Aufrufer, der
	 * keinen Knoten hat — er hat eine Regel. Ein Knoten, den man dafür erfindet,
	 * wäre eine Attrappe.
	 */
	knoten: Pick<Ergebnisknoten, 'kopfbasis'> & Partial<Pick<Ergebnisknoten, 'id'>>,
	/*
	 * **Ohne festes Beispiel unter einer angewandten Regel** (Pendenz vom
	 * 19.10.2026). Die Beispiele «fünf Ja-Stimmen» rechnen mit dem einfachen
	 * Mehr des Gesetzes; verlangt die Regel mehr, nennt die Karte darüber eine
	 * höhere Zahl, und zwei Zahlen für denselben Fall widersprechen sich. Die
	 * Zahl unter einer Regel nennt `zahlenbeispielFuerRegel`.
	 */
	{ mitBeispiel = true }: { mitBeispiel?: boolean } = {}
): string | null {
	const ohneBeispiel = (wer: string): string =>
		`Hier zählen alle Eigentümer ${wer}, unabhängig davon, wer erschienen ist. Wer nicht ` +
		'da ist und niemanden bevollmächtigt hat, wirkt wie ein Nein.';
	switch (knoten.kopfbasis) {
		case 'anwesend_vertreten':
			return null;
		case 'alle_eigentuemer':
			return (
				'Hier zählen nicht die Erschienenen, sondern alle Eigentümer. Wer nicht da ist und ' +
				'niemanden bevollmächtigt hat, wirkt wie ein Nein.'
			);
		case 'alle_ausser_betroffene':
			// An der Ausschlussklage der Beklagte statt «der Betroffenen», wie bei
			// `bezugsgroessensatz` (A4); das Beispiel zählt Eigentümer, nicht Wohnungen.
			if (knoten.id === 'k-ausschlussklage') {
				if (!mitBeispiel) return ohneBeispiel('ohne den Beklagten');
				return (
					'Hier zählen alle Eigentümer ohne den Beklagten, unabhängig davon, wer erschienen ' +
					'ist. Bei zehn Eigentümern mit je einer Wohnung, einer davon der Beklagte, braucht es ' +
					'fünf Ja-Stimmen, auch wenn nur sechs im Saal sitzen.'
				);
			}
			/*
			 * **An der Einsprache ohne festes Beispiel** (Codeprüfung Durchgang 2,
			 * M2). Diese Basis entsteht dort nur aus einer hinterlegten Regel, und
			 * deren Schwelle kann höher liegen als «fünf von neun»; die Zahl nennt
			 * das Zahlenbeispiel der Regel. Die Kennung steht wörtlich, weil der
			 * Kern `entscheidbaum.ts` hier nicht einbinden kann.
			 */
			if (knoten.id === 'k-einsprache') {
				return ohneBeispiel('ohne den Eigentümer, der verkauft, vermietet oder belastet');
			}
			if (!mitBeispiel) return ohneBeispiel('ausser den unmittelbar Betroffenen');
			return (
				'Hier zählen alle Eigentümer ausser den unmittelbar Betroffenen, unabhängig davon, ' +
				'wer erschienen ist. Bei zehn Eigentümern, von denen einer betroffen ist, braucht es ' +
				'fünf Ja-Stimmen — auch wenn nur sechs im Saal sitzen.'
			);
	}
}
