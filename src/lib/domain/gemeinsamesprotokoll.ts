/**
 * Das Protokoll der gemeinsamen Versammlung (Story 7.5b, rein).
 *
 * **Die Entscheidung, und warum sie am 12.08.2026 gedreht wurde.** Der erste
 * Wurf machte daraus eine blosse Zusammenstellung — additiv, unverbindlich, ohne
 * Unterschrift. Der Auftraggeber hat das noch am selben Tag verworfen: «Das Protokoll muss
 * rechtsgültig sein. Ich kann das PDF dann digital mit Skribble signieren. FES
 * oder QES.» Das ist die Vorgabe des Bewirtschafters, und sie ist tragfähig:
 *
 * 1. **Es ist das Protokoll der Sitzung**, geführt für alle beteiligten
 *    Gemeinschaften zugleich. ZGB 712n Abs. 2 verlangt ein Beschlussprotokoll und
 *    schreibt **keine Form** vor; wer die Beschlüsse je Gemeinschaft erkennbar
 *    ausweist, genügt der Bestimmung. Ein Sammelprotokoll ist bei Mehrhausanlagen
 *    die übliche Praxis.
 * 2. **Es wird unterzeichnet** — von der Sitzungsleitung und der
 *    Protokollführung des Abends, wie bei einer einzelnen Versammlung auch. Ob
 *    handschriftlich oder elektronisch, ist eine Frage des Wegs, nicht der
 *    Gültigkeit.
 * 3. **Genehmigt wird je Gemeinschaft**, und zwar der sie betreffende Teil, an
 *    ihrer nächsten Versammlung. Über fremde Teile beschliesst niemand.
 * 4. **Die Versiegelung bleibt bei den Versammlungen.** Das Abschlusspaket
 *    entsteht je Gemeinschaft; das Protokoll nennt, welche versiegelt sind.
 *
 * **Wovor die Gültigkeit schützen muss.** Ein Protokoll, das unterschrieben
 * werden kann, darf keine Lücken verschweigen. Solange eine Versammlung noch
 * läuft oder ein Punkt ohne Ergebnis ist, trägt das Dokument «Entwurf» im Titel
 * und sagt zuoberst, dass es so nicht zu unterzeichnen ist. Ohne diese Sperre
 * wäre die neue Verbindlichkeit gefährlicher als die alte Unverbindlichkeit: Wer
 * einen Entwurf qualifiziert signiert, hat einen Beschluss belegt, den es so nie
 * gab.
 *
 * **Zur elektronischen Signatur** steht die Einschätzung in `docs/verbund.md`
 * (seit 16.11.2026 nach Fachprüfung: Form gesetzlich offen, Unterschrift
 * umstritten; QES, wo das Reglement die Unterzeichnung verlangt oder fürs
 * Grundbuch, sonst FES vertretbar). Hier nur der Verweis, damit nicht zwei
 * Fassungen auseinanderlaufen.
 *
 * Rein: hinein gehen die Angaben, heraus kommt Text. Kein Zugriff auf Datenbank
 * oder Uhr (AD-1) — der Erzeugungszeitpunkt kommt von aussen herein, wie beim
 * Protokoll der einzelnen Versammlung (`protokoll.ts`).
 */
import { datumLang } from './datum';
import { pendenzSatz, type Pendenzangabe } from './pendenz';
import { ruegeSatz, type Ruegeangabe } from './ruege';
import { neuAnZweiterProtokoll } from './mehrhinweise';
import type { Neutraktandenwahl } from './lesarten';
import type { Beschlussfaehigkeitsregel } from './beschlussfaehigkeit';
import {
	anfechtungsabschnitt,
	type Anfechtungssonderfall,
	ausstandFehlteSatz,
	type AusstandFehlte,
	beschlussfaehigkeitFehlteSatz,
	GEHEIM_VERMERK,
	neuAnZweiterAnfechtungssatz,
	type ErsteFehlte,
	geheimGrundlage,
	nachQuorumSatz,
	einwandSatz,
	regelfassungSatz,
	ersetztNachRueckkommenSatz,
	stichentscheidZeile,
	type BeschlussfaehigkeitFehlte,
	folgeantraegeAngenommenSatz,
	l8Protokollzeilen,
	type Protokollzeile,
	rueckkommenNichtGenutztSatz,
	rueckkommenOhneDurchgangSatz,
	teileEntschiedenSatz,
	zeigtBeschluss
} from './protokoll';
import {
	MISCHFORM_ERKLAERUNG,
	MISCHFORM_MEHRERE_HAEUSER,
	istMischform
} from './stimmabgabe';

/** Eine Gemeinschaft, die an diesem Abend getagt hat. */
export interface Abendteilnahme {
	gemeinschaft: string;
	/** Zustand ihrer Versammlung, in Worten — «geschlossen», «versiegelt», … */
	zustand: string;
	/** Der Feststellungssatz zur Beschlussfähigkeit; null, solange keiner besteht. */
	beschlussfaehigkeit: string | null;
	/** Ob ihr Abschlusspaket besteht — für den Verweis statt eines eigenen Siegels. */
	versiegelt: boolean;
	/** Ob für sie ein Protokoll erfasst ist. Sonst steht hier der Hinweis darauf. */
	protokoll: boolean;
	/**
	 * Wie viele Parteien dieses Hauses auf Papier abgestimmt haben (Migration 108).
	 *
	 * **Je Haus und nicht je Abend**: Die Häuser teilen sich die Betriebsart,
	 * nicht aber den Schalter «Am Einlass nach der Stimmabgabe fragen». Vier
	 * Häuser können in der Mischform tagen und das fünfte nicht.
	 *
	 * **Eine Zahl und keine Namen** (10.09.2026, im Sicherheitsdurchgang
	 * gefunden). Dieses Dokument ist EINES für alle beteiligten Gemeinschaften und
	 * geht an alle ihre Eigentümer. Bis hierher trug es keinen einzigen
	 * Eigentümernamen: Der Kopf nennt Anlass, Ort und Vorsitz, die Teilnahme nennt
	 * Gemeinschaften, der Ablauf nennt Ergebnisse. Eine Namensliste je Haus wäre
	 * der erste Name im Dokument gewesen, und die Eigentümer von Haus B erführen
	 * daraus, wer in Haus A wohnt und wie diese Person abstimmte.
	 *
	 * Dieselbe Grenze zieht `docs/verbund.md` beim Abschlusspaket: «Ein
	 * gemeinsames Paket müsste sie vermengen, und im Anfechtungsfall bekäme ein
	 * Haus die Stände der anderen mitgeliefert.» Die Namen stehen dort, wo sie
	 * hingehören: im Verlauf und im Abschlusspaket der einzelnen Gemeinschaft,
	 * und im Protokoll einer Versammlung, die für sich tagt.
	 *
	 * **Die Zahl steht hier und nicht die Liste, damit sie gar nicht erst
	 * hierherkommt.** Eine Liste, die man nicht drucken darf, ist eine Liste, die
	 * eines Tages jemand druckt.
	 */
	aufPapier: number;
	/**
	 * Die anwesenden und vertretenen Parteien dieses Hauses, die Bezugsgrösse
	 * dazu.
	 *
	 * **Nicht alle der Momentaufnahme** (10.09.2026, im Code-Review gefunden):
	 * Ein Papiervermerk entsteht am Eingang, wer nicht erschien steht nie im
	 * Zähler und stünde immer im Nenner. Fünf Anwesende von vierzehn Parteien,
	 * alle fünf von Hand, wären sonst als Mischform ausgewiesen worden.
	 */
	eingelassen: number;
}

/**
 * Was eine Gemeinschaft zu einem Punkt des Abends beschlossen hat.
 *
 * **Die Zeilen zu L8** (`wahlTrotzHaekchen`, `abberufungTrotzHaekchen`,
 * `abberufungAusstandErklaert`, `verwaltungsangabe`) wie in
 * `Protokollzeile`, aus derselben Stelle (`l8Zeilenlage`) und mit denselben
 * Sätzen (`l8Protokollzeilen`; Codeprüfung P11, H1, 08.11.2026). Am
 * gemeinsamen Abend führt das Haus kein eigenes Protokoll, und die Zusage
 * der Tag-Leitung «das Protokoll nennt Ihre Angabe» brach hier.
 */
export interface Abendergebnis
	extends Pick<
		Protokollzeile,
		'wahlTrotzHaekchen' | 'abberufungTrotzHaekchen' | 'abberufungAusstandErklaert' | 'verwaltungsangabe'
	> {
	/** Die Nummer des Abends — dieselbe, die im Saal aufgerufen wurde. */
	nummer: string;
	gemeinschaft: string;
	/** Der Titel dieses Hauses, falls er vom gemeinsamen abweicht. */
	abweichenderTitel: string | null;
	/** Der fertig formulierte Ergebnissatz aus der Auszählung. */
	satz: string | null;
	/**
	 * Nach einem Rückkommen über einen Folgeantrag der Satz dazu
	 * (`ersetzungInKuerze`, Plan Folgeantrag nach Rückkommen, Soll 6). Er nennt
	 * Titel und Nummern, keine Namen. Fehlt die Angabe, gab es keines.
	 */
	ersetzung?: string | null;
	/**
	 * Über den Antrag wurde nicht abgestimmt, weil Folgeanträge zu ihm
	 * angenommen sind; wie `Protokollzeile.folgeantraegeAngenommen`, aus
	 * derselben Stelle (`holeFolgeantragslagen`, Featureprüfung 2 zu F4c, M1).
	 */
	folgeantraegeAngenommen?: { nummer: string; titel: string }[] | null;
	/**
	 * Der Grundantrag unter dem Häkchen, den Votum gesperrt hat, weil über
	 * Folgeanträge zur Wahl oder Abberufung entschieden ist und keiner
	 * angenommen (Entscheid 0045, Punkt 9); wie `Protokollzeile.teileEntschieden`.
	 */
	teileEntschieden?: { nummer: string; titel: string; art: 'wahl' | 'abberufung' }[] | null;
	/**
	 * Die Folgeanträge dieses Hauses zu diesem Antrag, je mit eigener Zeile
	 * und eigenem Ergebnis, in der Folge ihrer Nummern (Produktentscheid
	 * 08.11.2026, Entscheid 0045, Punkt 11). Nur Folgeanträge, kein Rückkommen;
	 * auch die Folgeanträge eines Folgeantrags stehen hier, nach ihm.
	 */
	folgeantraege?: Abendfolgeantrag[];
	/**
	 * Details, Präzisierungen oder Änderungen zum Beschluss (Auftraggeber, 09.09.2026).
	 *
	 * Steht **unter** dem Ergebnissatz, nicht an seiner Stelle: «Angenommen: …»
	 * kommt aus der Auszählung, «zum Kostendach von CHF 8'000» von der
	 * Sitzungsleitung. Wer die beiden vertauschte, machte aus einer Präzisierung
	 * einen zweiten Beschluss.
	 */
	beschlusstext: string | null;
	/**
	 * Dieses Haus war bei diesem Beschluss nicht beschlussfähig (Block 6,
	 * 02.10.2026).
	 *
	 * **Der Anlass:** Am gemeinsamen Abend ist dieses Dokument das Protokoll,
	 * das Haus führt kein eigenes. Das Hausprotokoll trägt den Satz zur
	 * fehlenden Beschlussfähigkeit seit Block 5; hier fehlte er, und wer
	 * abwesend war, las vom Mangel und von der Frist nirgends
	 * (Produktentscheid 02.10.2026).
	 *
	 * **Dieselbe Angabe, derselbe Wortlaut wie im Hausprotokoll:** Die Schale
	 * rechnet sie mit `beschlussfaehigkeitFehlteAmBeschluss` aus dem
	 * eingefrorenen Anwesenheitsstand des Durchgangs, je Haus mit dessen
	 * eigener Momentaufnahme, Stufe und Regel; der Satz kommt aus
	 * `beschlussfaehigkeitFehlteSatz`, hier mit dem Namen der Gemeinschaft. Die
	 * Tatsache, nicht der Weg.
	 */
	beschlussfaehigkeitFehlte?: BeschlussfaehigkeitFehlte | null;
	/**
	 * L7 (Migration 183): wie `Protokollzeile.ohneAusstandFehlte`, für dieses
	 * Haus; der Satz kommt aus `ausstandFehlteSatz`, hier mit dem Namen der
	 * Gemeinschaft.
	 */
	ohneAusstandFehlte?: AusstandFehlte | null;
	/** Ä-17 B: neu an der zweiten Versammlung dieses Hauses. */
	neuAnZweiterVersammlung?: boolean;
	/** Die Wahl zu L5 dieses Hauses aus seiner Momentaufnahme (Migration 174). */
	neuAnZweiterWahl?: Neutraktandenwahl | null;
	/**
	 * A5, Punkt 8 (Entscheid 0032): die hinterlegte Anwesenheitsregel des
	 * Reglements für die zweite Versammlung dieses Hauses, für
	 * `neuAnZweiterProtokoll`.
	 */
	neuAnZweiterRegel?: Beschlussfaehigkeitsregel | null;
	/** Wo Weg oder Frist der Anfechtung anders laufen (`anfechtungsabschnitt`). */
	anfechtungssonderfall?: Anfechtungssonderfall | null;
	/** Wie `Protokollzeile.neuAnZweiterErsteFehlte`, für dieses Haus. */
	neuAnZweiterErsteFehlte?: ErsteFehlte;
	/**
	 * Der zweite Durchgang nach Eintritt der Beschlussfähigkeit (Migration
	 * 139, Codeprüfung 03.10.2026, zweiter Durchgang).
	 *
	 * **Der Anlass:** Am gemeinsamen Abend ist dieses Dokument das Protokoll,
	 * das Haus führt kein eigenes. Das Hausprotokoll trägt den Satz zu den
	 * beiden Durchgängen seit Migration 139; hier fehlte er, und wer das
	 * Abendprotokoll las, sah das Ergebnis des zweiten Durchgangs nicht.
	 *
	 * **Derselbe Wortlaut wie im Hausprotokoll:** Die Schale rechnet die Lage
	 * mit `nachQuorumLage` aus den Durchgängen dieses Hauses, je Haus mit
	 * dessen Stimmkraft, Stufe und Regel; der Satz kommt aus `nachQuorumSatz`.
	 */
	nachQuorum?: Protokollzeile['nachQuorum'];
	/** Die eingewendete Bestimmung dieses Hauses, wie im Hausprotokoll (`einwandSatz`). */
	einwand?: string | null;
	einwandEinfuehrung?: string | null;
	einwandNotwendig?: boolean;
	/**
	 * Der Text dieses Hauses zu diesem Punkt ist ein Beschluss, den Votum
	 * nicht führt (Block 7, Migration 135).
	 *
	 * **Was er bewirkt:** «Zu diesem Punkt liegt noch kein Ergebnis vor.»
	 * entfällt, und der Punkt zählt in `stelleAbendzusammenstellungZusammen`
	 * nicht als Lücke. Damit verliert das Dokument den Entwurfsvermerk und
	 * bekommt den Unterschriftsblock, wenn sonst nichts fehlt. **Was er nicht
	 * ist:** ein Ergebnis. Der Beschluss steht allein im Text der Leitung.
	 */
	beschlussvermerk?: boolean;
	/**
	 * Was jemand aus diesem Punkt zu tun hat (Migration 106).
	 *
	 * **Ohne Zustand, wie im Hausprotokoll**, und aus demselben Grund: Eine
	 * festgehaltene Fassung hält fest, was vereinbart wurde. Die Begründung
	 * steht ausgeschrieben bei `Protokollzeile.pendenzen` in `protokoll.ts`.
	 *
	 * **Je Haus**, nicht je Geschäft: Die Zusage fällt in der Versammlung eines
	 * Hauses, und beim Verbund kann sie in einem Haus entstehen und im anderen
	 * nicht.
	 */
	pendenzen: Pendenzangabe[];
	/**
	 * Die Rügen im Saal zu diesem Punkt (Ä-06, Migration 160), **je Haus** wie
	 * die Pendenzen: Erfasst wird auf der Leitungsseite des Hauses. Ohne sie
	 * stand eine Rüge am Abend nur im Paket und im Verlauf, nicht im Protokoll,
	 * das an alle geht (Laien-, Fach- und Codeprüfung H8, Runde 2).
	 */
	ruegen: Ruegeangabe[];
	erfordernis: string | null;
	rechtsgrundlage: string | null;
	/**
	 * Die Fassung der Berechnungsregeln (Ä-09), wie im Hausprotokoll. Leer bei
	 * einer Mehrheit, die die Leitung gesetzt hat; das entscheidet die Schale.
	 */
	regelfassung?: string | null;
	/** Die Lesart der Gemeinschaft, wie im Hausprotokoll (Migration 169). */
	lesart?: string | null;
	/** Die Feststellung zum Ergebnis nach der anderen Lesart, wie am Ausgang des Hausprotokolls. */
	nachAndererLesart?: string | null;
	/**
	 * Geheim abgestimmt (Migration 141) und die Grundlage: offener Beschluss
	 * (Migration 165), Reglement (166). Am Abend ist dieses Dokument das
	 * Protokoll; Grundlage und Vermerk
	 * gehören deshalb auch hierher (Ä-38, Codeprüfung 16.10.2026, M1).
	 */
	geheim?: boolean;
	geheimBeschlossen?: boolean;
	geheimNachReglement?: boolean;
	/** Vor der Abstimmung zurückgezogen — kein Fall von «abgelehnt». */
	rueckzug: string | null;
	/**
	 * Der Stichentscheid einer Person, mit dem Gleichstand in Zahlen
	 * (`gleichstandInZahlen`; Probe Wertquotenmehr, 17.11.2026, B1). Dieselbe
	 * Zeile wie im Hausprotokoll (`stichentscheidZeile`), mit den Zahlen, weil
	 * dieses Dokument keinen Stimmenspiegel führt.
	 */
	stichentscheid?: Protokollzeile['stichentscheid'];
	gleichstand?: string | null;
	/**
	 * Die Vermerke zum Ausgang, die keinen Namen tragen (`Protokollhinweis.ohneNamen`):
	 * Stichentscheid nach Wertquoten, Gleichstand ohne hinterlegte Person, nicht
	 * angewandte Klausel. Wie im Hausprotokoll nach dem Stichentscheid.
	 */
	ausgangsvermerke?: string[];
	/**
	 * Durchgänge, die ein Rückkommen ersetzt hat, und die Nummer des
	 * massgebenden, wo sie im Hausprotokoll als «N. Durchgang.» steht (Probe
	 * Wertquotenmehr, 17.11.2026, B2; Produktentscheid 17.11.2026: «Wie im
	 * Hausprotokoll»). Ohne die Zahlen des ersetzten, wie dort.
	 */
	ersetztNachRueckkommen?: Protokollzeile['ersetztNachRueckkommen'];
	durchgangszeile?: number | null;
	/**
	 * Von Hand gezählt, mit dem Vermerk der Sitzungsleitung.
	 *
	 * **Auch das Tagprotokoll muss es sagen** (28.08.2026, aus dem Code-Review
	 * zum Befund «Handabstimmung fehlt im Protokoll»). Es führt keinen
	 * Stimmenspiegel, sondern nur den Ergebnissatz; die erfundene Null der
	 * Einzelfassung gab es hier also nie. Es fehlte aber ebenso der Hinweis,
	 * dass die Zahlen aus gezählten Händen stammen und niemandem zugeordnet sind.
	 */
	handzaehlung?: { vermerk: string | null } | null;
	/**
	 * Was der Ausstand an den Bezugsgrössen geändert hat (`ausstandswirkung` in
	 * `auszaehlung.ts`). Hier wie im Hausprotokoll nötig: Der Ergebnissatz
	 * trägt die Bezugsgrösse («von 3 Kopfstimmen»), und ohne diesen Satz
	 * stünde sie ohne Erklärung da (Befund D-02, 22.08.2026).
	 */
	ausstandswirkung?: string | null;
	/**
	 * Die Vermerke zur Bezugsgrösse in der Fassung ohne Eigentümernamen
	 * (`Protokollhinweis.ohneNamen`, Codeprüfung P11, H1): bisher die Zeile,
	 * dass die Vollmachten der Verwaltung ruhten, mit der Zahl der
	 * Vertretenen (Entscheid 3). Das Hausprotokoll nennt sie mit Namen; hier
	 * steht die Zahl, aus demselben Grund wie bei `aufPapier`.
	 */
	bezugsgroessenvermerke?: string[];
	/**
	 * Die Zeilen zu den unmittelbar Betroffenen, ohne Namen (Block A3a,
	 * 26.09.2026): gebildet von `betroffenenzeilen` in `protokoll.ts`, derselben
	 * Funktion wie im Hausprotokoll. Bis hierher fehlten sie am Abend ganz; eine
	 * fehlende oder im Ausstand erteilte Zustimmung hinterliess keine Spur.
	 */
	betroffenenzeilen?: string[];
	/**
	 * Ob über den Punkt abgestimmt wird.
	 *
	 * **Eine Kenntnisnahme hat kein Ergebnis, und das ist keine Lücke.** Ohne
	 * diese Unterscheidung stünde unter der Begrüssung «noch kein Ergebnis», das
	 * Protokoll bliebe ewig Entwurf und der Unterschriftsblock erschiene nie —
	 * gesehen am 12.08.2026, als 16 von 16 Punkten als offen galten.
	 */
	art: 'abstimmung' | 'kenntnisnahme';
	/**
	 * Nach einem angenommenen Rückkommen ohne neue Abstimmung (16.11.2026,
	 * Codeprüfung Block B, N2): dieselben zwei Sätze wie im Hausprotokoll, am
	 * Rückkommen und am Geschäft. Fehlen sie, gab es den Fall nicht.
	 */
	rueckkommenOhneDurchgang?: Parameters<typeof rueckkommenOhneDurchgangSatz>[0] | null;
	rueckkommenNichtGenutzt?: string | null;
	/**
	 * Das Votum zu diesem Punkt — was in der Versammlung gesagt und entschieden
	 * wurde (FR-46).
	 *
	 * **Es muss hierher, seit es nur noch ein Protokoll gibt.** Der Auftraggeber am
	 * 12.08.2026: «Es gibt dann ein Protokoll für die Versammlung. Nicht pro
	 * Haus.» Die Voten sind das Einzige am Protokoll, was von Hand kommt —
	 * Begründungen, Wortmeldungen, Ordnungsentscheide. Blieben sie beim Haus,
	 * führte das eine Protokoll nur noch Zahlen.
	 *
	 * **Ohne eigenes Label im Dokument** (Auftraggeber, 12.08.2026): «Das muss kein
	 * eigenes Label haben, es gehört ja zum jeweiligen Absatz.» Es steht als
	 * schlichter Absatz unter seinem Punkt, vor dem Ergebnis.
	 */
	notiz: string | null;
}

/**
 * Ein Folgeantrag, den ein Haus am Abend aufgenommen hat (Produktentscheid
 * 08.11.2026). Dieselben Angaben wie die Zeile des Hauses, dazu Titel und
 * Wortlaut: Er steht in keiner gemeinsamen Liste, sein Wortlaut ist der
 * Inhalt des Beschlusses.
 */
export interface Abendfolgeantrag extends Abendergebnis {
	/**
	 * **Die Nummer im Haus**, nicht die des Abends: dieselbe, die der Satz
	 * beim Grundantrag nennt (`folgeantraegeAngenommenSatz`,
	 * `teileEntschiedenSatz`) und das Haus im Saal aufgerufen hat.
	 */
	nummer: string;
	titel: string;
	antragswortlaut: string | null;
	/**
	 * Ein Rückkommensantrag statt eines Folgeantrags (16.11.2026): eigene Zeile
	 * unter dem Antrag, auf den er zurückkommt, mit seinem Titel als Überschrift
	 * («Rückkommen auf …»). Fehlt das Feld, ist es ein Folgeantrag.
	 */
	rueckkommen?: boolean;
	/**
	 * Am abgelehnten Rückkommen die Nummer des Traktandums im Haus, bei dessen
	 * Ergebnis es bleibt (16.11.2026, Laienprüfung Runde 2, R2-L6).
	 */
	bleibtBeim?: string | null;
}

/** Ein Punkt des Abends mit den Ergebnissen aller beteiligten Gemeinschaften. */
export interface Abendpunkt {
	nummer: string;
	titel: string;
	/**
	 * Eine eigene Überschrift statt «Nummer Titel» (16.11.2026): für ein Geschäft,
	 * das ein Haus im Saal aufgenommen hat und das in keiner gemeinsamen Liste
	 * steht. Es trägt die Nummer des Hauses, nicht eine des Abends.
	 */
	ueberschrift?: string;
	antragswortlaut: string | null;
	ergebnisse: Abendergebnis[];
}

export interface GemeinsamesProtokoll {
	bezeichnung: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	teilnahme: Abendteilnahme[];
	punkte: Abendpunkt[];
	/** Wer den Entwurf erzeugt hat und wann — der Kern liest keine Uhr. */
	erzeugtAm: string;
	erzeugtDurch: string;
	/**
	 * Was der Unterzeichnung noch entgegensteht — fertig als Satz aus
	 * `protokollluecke`. Null heisst: Das Protokoll ist vollständig.
	 *
	 * Solange hier etwas steht, trägt der Titel «Entwurf» und der Kopf einen
	 * Hinweis. Ein Dokument, das man signieren kann, darf seine Lücken nicht
	 * verschweigen.
	 */
	luecke?: string | null;
	/**
	 * Ob der Unterschriftsblock im Dokument steht. Vorgabe: ja.
	 *
	 * **Warum das eine Wahl ist.** ZGB 712n Abs. 2 verlangt ein Protokoll und
	 * seine Aufbewahrung durch die Verwaltung, sonst durch den Vorsitz — eine
	 * Unterschrift schreibt das Gesetz nicht vor. Verlangt wird sie von den
	 * Reglementen, und die sind verschieden.
	 * Der Auftraggeber am 12.08.2026: «Mache die Unterschrift als Option.»
	 *
	 * **Der Genehmigungssatz bleibt in beiden Fällen.** Er sagt, wer welchen Teil
	 * genehmigt, und das gilt unabhängig davon, ob jemand unterschreibt.
	 */
	unterschriften?: boolean;
	/**
	 * Wer den Vorsitz des Abends führte und wer schrieb (Migration 092).
	 *
	 * **Am Abend besonders nötig** (Auftraggeber, 26.08.2026: «Auch bei einer gemeinsamen
	 * Versammlung muss der Vorsitz benannt werden»): Hier führt eine Person
	 * mehrere Gemeinschaften, und alle unterschreiben dasselbe Dokument. Ohne
	 * Namen über der Zeile trägt es keine einzige Zurechnung. Fehlt die Angabe,
	 * bleibt die Zeile leer wie zuvor.
	 */
	sitzungsleitung?: string | null;
	protokollfuehrung?: string | null;
}

/** «19:30» aus einer Zeitangabe, die auch Sekunden tragen kann. */
function uhrzeit(wert: string): string {
	return wert.slice(0, 5);
}

/**
 * Die Geltungsklausel — wofür dieses Protokoll gilt und wer es genehmigt.
 *
 * Als eigene Ausfuhr, weil sie zwei Stellen brauchen: der Text selbst und die
 * Seite, die ihn erzeugt. Stünde sie zweimal geschrieben, liefe sie auseinander —
 * und ausgerechnet dieser Satz darf das nicht.
 */
export const GELTUNG =
	'Dieses Protokoll wird für alle beteiligten Gemeinschaften gemeinsam geführt. ' +
	'Die Beschlüsse sind je Gemeinschaft gefasst; für jede gilt der sie betreffende ' +
	'Teil, den sie an ihrer nächsten Versammlung genehmigt. Anfechtbar ist der ' +
	'Beschluss der einzelnen Gemeinschaft.';

/**
 * Der Satz, der eine Unterzeichnung verhindern soll, solange etwas fehlt.
 *
 * **Der wichtigste Satz des Dokuments, solange er dasteht.** Seit das Protokoll
 * unterschrieben werden kann, ist eine Lücke nicht mehr bloss unschön: Wer einen
 * Entwurf qualifiziert signiert, hat einen Beschluss belegt, den es so nie gab.
 */
export const ENTWURFSHINWEIS =
	'ENTWURF — noch nicht zu unterzeichnen.';

/**
 * Die Blöcke eines Punkts in der Folge des Dokuments: je Haus seine Zeile,
 * danach seine Folgeanträge in der Folge ihrer Nummern. Eine Stelle für den
 * Ablauf und den Abschnitt «Anfechtung», damit ein Folgeantrag mit Beschluss
 * nicht nur an einer der beiden zählt.
 */
function bloeckeDesPunkts(
	p: Abendpunkt
): { r: Abendergebnis; folgeantrag: Abendfolgeantrag | null }[] {
	return p.ergebnisse.flatMap((r) => [
		{ r, folgeantrag: null },
		...[...(r.folgeantraege ?? [])]
			.sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }))
			.map((f) => ({ r: f as Abendergebnis, folgeantrag: f }))
	]);
}

/**
 * Die Zusammenstellung als Text.
 *
 * Dieselbe Auszeichnung wie beim Protokoll der einzelnen Versammlung
 * (`protokollentwurf`): `#`, `##`, `###`, `- `, Leerzeile. Wer beide nebeneinander
 * legt, soll dieselbe Bauart sehen — und dieselbe Ausgabe in Word und PDF
 * verwenden können.
 */
export function gemeinsamerProtokollentwurf(e: GemeinsamesProtokoll): string {
	const z: string[] = [];

	const entwurf = Boolean(e.luecke);

	// ── Kopf ────────────────────────────────────────────────────────────────
	z.push(
		entwurf
			? '# Protokoll der gemeinsamen Versammlung (Entwurf)'
			: '# Protokoll der gemeinsamen Versammlung'
	);
	z.push('');
	/*
	 * **Derselbe Kopf wie im Haus** (Auftraggeber, 03.09.2026, mit einer Word-Vorlage:
	 * «Struktur im Sinne von hier»): eine zweispaltige Tabelle, Bezeichnung
	 * links, Wert rechts, Datum und Beginn in einer Zeile.
	 *
	 * Beim ersten Anlauf blieb dieses Protokoll auf der alten Aufzählung stehen —
	 * gefunden im Code-Review. Zwei Protokolle desselben Hauses mit verschiedenem
	 * Kopf sind genau das, was der Kommentar über diesem Kern seit jeher
	 * ausschliessen will.
	 */
	z.push(`| Anlass | ${e.bezeichnung} |`);
	z.push(`| Datum, Beginn | ${datumLang(e.datum)}, ${uhrzeit(e.uhrzeit)} Uhr |`);
	z.push(`| Ort | ${e.ort} |`);
	if (e.sitzungsleitung) z.push(`| Vorsitz | ${e.sitzungsleitung} |`);
	if (e.protokollfuehrung) z.push(`| Protokollführung | ${e.protokollfuehrung} |`);
	z.push('');
	/*
	 * Der Entwurfshinweis steht **vor** der Geltungsklausel: Wer das Dokument in
	 * der Hand hat, um es zu unterschreiben, soll zuerst lesen, dass er das noch
	 * nicht darf.
	 */
	if (entwurf) {
		z.push(`${ENTWURFSHINWEIS} ${e.luecke}.`);
		z.push('');
	}
	z.push(GELTUNG);
	z.push('');

	// ── Wer getagt hat ──────────────────────────────────────────────────────
	z.push('## Wer an diesem Abend getagt hat');
	z.push('');
	if (e.teilnahme.length === 0) {
		z.push('Keine Gemeinschaft zugeordnet.');
	} else {
		for (const t of e.teilnahme) {
			const teile = [`${t.gemeinschaft} — ${t.zustand}`];
			if (t.beschlussfaehigkeit) teile.push(t.beschlussfaehigkeit);
			z.push(`- ${teile.join('. ')}`);
		}
	}
	z.push('');

	/*
	 * ── Stimmabgabe auf Papier ─────────────────────────────────────────────
	 *
	 * **Warum das hier steht und nicht im Protokoll des Hauses** (10.09.2026).
	 * Am gemeinsamen Abend führt das Haus kein eigenes Protokoll mehr; diese
	 * Zusammenstellung ist das Dokument. Stünde der Abschnitt nur dort, sagte am
	 * Verbundabend niemand, dass ein Teil der Stimmen von der Sitzungsleitung
	 * übertragen wurde.
	 *
	 * **Die Erklärung einmal, die Häuser darunter.** Sie ist für alle dieselbe;
	 * je Haus wiederholt wäre sie bei fünf Gemeinschaften fünfmal derselbe
	 * Absatz.
	 *
	 * Der Wortlaut steht in `domain/stimmabgabe` und wird vom Protokoll der
	 * einzelnen Versammlung ebenso gelesen. Zweimal getippt hiesse dieselbe
	 * Abmachung in zwei Dokumenten Verschiedenes.
	 */
	const gemischt = e.teilnahme.filter((t) => istMischform(t.aufPapier, t.eingelassen));
	if (gemischt.length > 0) {
		z.push('### Stimmabgabe auf Papier');
		z.push('');
		/*
		 * **Der Eröffnungssatz ist ein anderer als im Hausprotokoll** (10.09.2026,
		 * im Code-Review gefunden). «Diese Versammlung lief in der Mischform» stünde
		 * hier über der Liste aller Häuser und behauptete sie für den ganzen Abend,
		 * auch wenn nur eines von fünf gemischt tagte.
		 */
		z.push(MISCHFORM_MEHRERE_HAEUSER);
		z.push('');
		for (const satz of MISCHFORM_ERKLAERUNG) {
			z.push(satz);
			z.push('');
		}
		for (const t of gemischt) {
			z.push(
				`- ${t.gemeinschaft}: ${t.aufPapier} von ${t.eingelassen} anwesenden Parteien stimmten auf Papier ab.`
			);
		}
		z.push('');
	}

	/*
	 * **Der Stand der Versammlungen.** Die Versiegelung bleibt bei ihnen — das
	 * Abschlusspaket entsteht je Gemeinschaft. Hier steht, welche schon
	 * unveränderbar festgehalten sind: Ein Protokoll, das über eine noch offene
	 * Versammlung berichtet, muss das sagen.
	 */
	const ohneSiegel = e.teilnahme.filter((t) => !t.versiegelt);
	z.push('### Stand der Versammlungen');
	z.push('');
	if (e.teilnahme.length === 0) {
		z.push('- An diesem Abend tagt keine Gemeinschaft.');
	} else {
		z.push(
			ohneSiegel.length === 0
				? `- Alle ${e.teilnahme.length} Versammlungen sind versiegelt; ihre Beschlüsse sind unveränderbar festgehalten.`
				: `- Noch nicht versiegelt: ${ohneSiegel.map((t) => t.gemeinschaft).join(', ')}. Dort können sich Angaben noch ändern.`
		);
	}
	z.push('');

	// ── Die Punkte des Abends ───────────────────────────────────────────────
	z.push('## Der Ablauf des Abends');
	z.push('');
	if (e.punkte.length === 0) {
		z.push('Für diesen Abend ist kein Geschäft erfasst.');
		z.push('');
	}

	for (const p of e.punkte) {
		z.push(`## ${p.ueberschrift ?? `${p.nummer} ${p.titel}`}`);
		z.push('');
		if (p.antragswortlaut) {
			z.push(p.antragswortlaut);
			z.push('');
		}

		if (p.ergebnisse.length === 0) {
			// Kommt vor: ein Geschäft, dem noch keine Gemeinschaft zugeordnet ist.
			// Es zählt als Lücke (`protokollluecke`) und hält damit die Unterschrift auf.
			z.push('Noch keiner Gemeinschaft zugeordnet — hier wurde nichts beschlossen.');
			z.push('');
			continue;
		}

		/*
		 * **Bei genau einer Gemeinschaft keine zweite Überschrift.** Sie trüge
		 * dieselbe Nummer wie der Punkt darüber («9 Türdämpfer Waschküche» /
		 * «9 Nirgendweg 5/5a»), und im Protokoll läse sich das wie zwei Traktanden.
		 * Der Name gehört dann in die Ergebniszeile, wo er kurz ist und stimmt.
		 */
		const einzeln = p.ergebnisse.length === 1;

		for (const { r, folgeantrag } of bloeckeDesPunkts(p)) {
			if (folgeantrag) {
				/*
				 * **Folgeanträge mit eigener Zeile, wie im Hausprotokoll**
				 * (Produktentscheid 08.11.2026, Entscheid 0045, Punkt 11). Der
				 * Satz beim Grundantrag verweist auf sie («hat den Folgeantrag
				 * 3.1 «Wiederwahl» angenommen»); bis dahin hatten sie hier keine
				 * Zeile, und eine abgelehnte Wahl stand im Dokument, das am Abend
				 * das Protokoll ist, nur als «entschieden».
				 *
				 * **«Folgeantrag» und die Nummer des Hauses in der Überschrift.**
				 * Unter einem Punkt mit mehreren Häusern heissen schon die
				 * Hauszeilen «9.1», «9.2»; der Folgeantrag mit der Hausnummer
				 * «9.1» liesse sich ohne das Wort mit der Zeile des ersten Hauses
				 * verwechseln. Eine Ebene unter der Hauszeile, bei einem einzigen
				 * Haus unter dem Punkt.
				 */
				z.push(
					folgeantrag.rueckkommen
						? // Der Titel sagt es schon: «Rückkommen auf 9.1 …» (16.11.2026).
							`${einzeln ? '###' : '####'} ${folgeantrag.nummer} ${folgeantrag.titel}`
						: `${einzeln ? '###' : '####'} Folgeantrag ${folgeantrag.nummer} «${folgeantrag.titel}»`
				);
				z.push('');
				if (folgeantrag.antragswortlaut) {
					z.push(`Antrag: ${folgeantrag.antragswortlaut}`);
					z.push('');
				}
			} else if (!einzeln) {
				z.push(`### ${r.nummer} ${r.gemeinschaft}`);
				z.push('');
			}
			/*
			 * Der abweichende Titel steht **nur**, wenn er abweicht. Sonst stünde er
			 * unter jedem Unterpunkt noch einmal — und die Zusammenstellung wiederholte
			 * siebenmal, was eine Zeile höher steht.
			 */
			if (r.abweichenderTitel) {
				z.push(`Wortlaut in dieser Gemeinschaft: ${r.abweichenderTitel}`);
				z.push('');
			}
			const wer = einzeln ? `${r.gemeinschaft}: ` : '';
			/*
			 * Das Votum steht **vor** dem Ergebnis und ohne Überschrift: Es erklärt,
			 * warum so entschieden wurde, und wer das Ergebnis schon gelesen hat,
			 * liest die Begründung nicht mehr.
			 */
			/*
			 * Die Rüge zuerst, wie im Hausprotokoll: Sie kam vor der Abstimmung.
			 *
			 * **Ohne den Namen, wer rügt.** Das Abenddokument geht an die
			 * Eigentümer aller beteiligten Gemeinschaften; aus demselben Grund
			 * steht hier keine Namensliste der Anwesenden (Sicherheitsdurchgang
			 * 10.09.2026, `server/gemeinsamesprotokoll.ts`; Fachprüfung H8,
			 * Runde 2, offene Grenze a). Der Name steht im Abschlusspaket und im
			 * Verlauf des Hauses.
			 */
			// Der Hausname genau einmal je Block, auch mit der Rüge davor (die
			// Regel `wer2` unten; Probe «wiederholt den Hausnamen nicht»).
			let werNoch = wer;
			if (r.ruegen.length > 0) {
				z.push(`${werNoch}${r.ruegen.length === 1 ? 'Rüge im Saal:' : 'Rügen im Saal:'}`);
				for (const rg of r.ruegen) z.push(`- ${ruegeSatz(rg, { ohneName: true })}`);
				z.push('');
				werNoch = '';
			}
			if (r.notiz) {
				z.push(`${werNoch}${r.notiz}`);
				z.push('');
			}
			const wer2 = r.notiz ? '' : werNoch;
			if (r.rueckzug) {
				z.push(`${wer2}Vor der Abstimmung zurückgezogen: ${r.rueckzug}`);
			} else if (!r.satz && r.ersetzung) {
				// Der ersetzte Grundantrag: abgestimmt, nur trägt der Beschluss jetzt
				// der Folgeantrag. «Noch kein Ergebnis» wäre falsch (Soll 6).
				z.push(`${wer2}${r.ersetzung}`);
				// Auch hier, wie im Hausprotokoll (zweiter Durchgang der Codeprüfung B, Befund 1):
				// Rückkommen nach einer Ersetzung ohne neue Abstimmung.
				if (r.rueckkommenOhneDurchgang) z.push(rueckkommenOhneDurchgangSatz(r.rueckkommenOhneDurchgang));
			} else if (r.satz) {
				z.push(`${wer2}${r.satz}`);
				if (r.ersetzung) {
					z.push('');
					z.push(`- ${r.ersetzung}`);
				}
				/*
				 * **Unter dem Ergebnis, im selben Absatz.** Er gehört zum Beschluss
				 * und nicht daneben; ein eigener Absatz läse sich wie eine zweite
				 * Feststellung.
				 */
				if (r.beschlusstext) z.push(r.beschlusstext);
				// Wie im Hausprotokoll (Codeprüfung Block B, N2).
				if (r.rueckkommenOhneDurchgang) z.push(rueckkommenOhneDurchgangSatz(r.rueckkommenOhneDurchgang));
				if (r.rueckkommenNichtGenutzt) z.push(rueckkommenNichtGenutztSatz(r.rueckkommenNichtGenutzt));
				// Am abgelehnten Rückkommen, was daraus folgt (Laienprüfung Runde 2, R2-L6).
				if (folgeantrag?.rueckkommen && folgeantrag.bleibtBeim !== undefined) {
					z.push(
						folgeantrag.bleibtBeim
							? `Damit bleibt es beim bisherigen Ergebnis zu Traktandum ${folgeantrag.bleibtBeim}.`
							: 'Damit bleibt es beim bisherigen Ergebnis.'
					);
				}
				// Ä-17 B, an derselben Stelle wie im Hausprotokoll, mit dem Haus.
				if (r.neuAnZweiterVersammlung) {
					const fehlte = r.neuAnZweiterErsteFehlte ?? null;
					// Wie im Hausprotokoll (Codeprüfung Block 7, R3-N3). A5, Punkt 8:
					// die Regel des Reglements dazu, wo das Haus eine hat.
					const zeile = r.beschlussfaehigkeitFehlte
						? neuAnZweiterProtokoll(null)
						: neuAnZweiterProtokoll(
								r.neuAnZweiterWahl,
								fehlte === null ? null : fehlte !== false,
								r.neuAnZweiterRegel ?? null
							);
					z.push(`${r.gemeinschaft}: ${zeile}`);
					if (r.neuAnZweiterWahl === 'erste' && fehlte && fehlte.angenommen && !r.beschlussfaehigkeitFehlte) {
						z.push(neuAnZweiterAnfechtungssatz(fehlte.vonHand, r.gemeinschaft));
					}
				}
				// An derselben Stelle wie im Hausprotokoll: nach Ergebnis und
				// Beschlusstext, vor den Vermerken.
				if (r.beschlussfaehigkeitFehlte) {
					// Mit dem Namen der Gemeinschaft: Das Dokument lesen auch die
					// Eigentümer der anderen Häuser (Begründung am Satz selbst).
					z.push(beschlussfaehigkeitFehlteSatz(r.beschlussfaehigkeitFehlte, r.gemeinschaft));
				}
				// L7, wie im Hausprotokoll direkt danach; nicht doppelt, wo die
				// Beschlussfähigkeit selbst fehlte.
				if (r.ohneAusstandFehlte && !r.beschlussfaehigkeitFehlte) {
					z.push(ausstandFehlteSatz(r.ohneAusstandFehlte, r.gemeinschaft));
				}
				// L8 wie im Hausprotokoll direkt danach: Wahl und Abberufung trotz
				// Häkchen, die Angabe der Leitung (Codeprüfung P11, H1).
				for (const s of l8Protokollzeilen(r)) z.push(s);
				// An derselben Stelle wie im Hausprotokoll: nach der fehlenden
				// Beschlussfähigkeit, vor den Vermerken.
				if (r.nachQuorum) z.push(nachQuorumSatz(r.nachQuorum));
				// Wie im Hausprotokoll direkt danach, mit dem Haus (Entscheid 0046, A7).
				if (r.einwand) {
					z.push(
						einwandSatz({
							bestimmung: r.einwand,
							einfuehrung: r.einwandEinfuehrung,
							gemeinschaft: r.gemeinschaft,
							notwendig: r.einwandNotwendig === true
						})
					);
				}
				// Wie im Hausprotokoll: Grundlage und Vermerk der geheimen Abstimmung.
				if (r.geheim) {
					for (const s of geheimGrundlage(r)) z.push(s);
					z.push(GEHEIM_VERMERK);
				}
				if (r.handzaehlung) {
					z.push('');
					z.push(
						'- Von Hand gezählt, ohne Zuordnung zu Personen' +
							(r.handzaehlung.vermerk ? `: ${r.handzaehlung.vermerk}` : '.')
					);
				}
				if (r.ausstandswirkung) {
					z.push('');
					z.push(`- ${r.ausstandswirkung}`);
				}
				/*
				 * Wie im Hausprotokoll unter den Zahlen, nach dem Ausstand und vor
				 * den Betroffenen: die ruhenden Vollmachten der Verwaltung, ohne
				 * Namen (Codeprüfung P11, H1). Im selben Absatz wie der Ausstand,
				 * sonst mit der Leerzeile davor.
				 */
				if (r.bezugsgroessenvermerke && r.bezugsgroessenvermerke.length > 0) {
					if (!r.ausstandswirkung) z.push('');
					for (const b of r.bezugsgroessenvermerke) z.push(`- ${b}`);
				}
				if (r.betroffenenzeilen && r.betroffenenzeilen.length > 0) {
					// Dieselbe Leerzeile davor wie bei Handzählung und Ausstand.
					z.push('');
					for (const b of r.betroffenenzeilen) z.push(`- ${b}`);
				}
				/*
				 * **Frühere Durchgänge und Stichentscheid** (Probe Wertquotenmehr,
				 * 17.11.2026, B1 und B2): nach den Zeilen zu den Betroffenen, erst
				 * was mit früheren Durchgängen geschah, dann wer den Gleichstand
				 * entschied, dann die Vermerke zum Ausgang, untereinander wie im
				 * Hausprotokoll. Anders als dort stehen die Sätze zum Rückkommen
				 * ohne neue Abstimmung und zur Ersetzung schon direkt unter dem
				 * Ergebnis (Bestand).
				 */
				const ausgang = [
					...(r.durchgangszeile ? [`- ${r.durchgangszeile}. Durchgang.`] : []),
					...(r.ersetztNachRueckkommen ?? []).map(ersetztNachRueckkommenSatz),
					...(r.stichentscheid ? [stichentscheidZeile(r.stichentscheid, r.gleichstand ?? null)] : []),
					...(r.ausgangsvermerke ?? []).map((s) => `- ${s}`)
				];
				if (ausgang.length > 0) {
					z.push('');
					z.push(...ausgang);
				}
				if (r.erfordernis) {
					const grundlage = r.rechtsgrundlage ? ` (${r.rechtsgrundlage})` : '';
					const fassung = r.regelfassung ? regelfassungSatz(r.regelfassung) : null;
					z.push('');
					z.push(`- Angewandtes Erfordernis: ${r.erfordernis}${grundlage}` + (fassung ? `. ${fassung}` : ''));
					if (r.lesart) z.push(`- ${r.lesart}`);
					if (r.nachAndererLesart) z.push(`- ${r.nachAndererLesart}`);
				}
			} else if (r.folgeantraegeAngenommen || (r.teileEntschieden && r.teileEntschieden.length > 0)) {
				/*
				 * **Derselbe Satz wie im Hausprotokoll** (Featureprüfung 2 zu F4c,
				 * M1): Über den Antrag wurde nicht abgestimmt, weil Folgeanträge
				 * entschieden haben. Bis dahin stand hier «noch kein Ergebnis».
				 *
				 * **Der Satz bleibt, und die Folgeanträge, auf die er verweist,
				 * stehen darunter mit eigener Zeile** (Produktentscheid 08.11.2026,
				 * Entscheid 0045, Punkt 11; `bloeckeDesPunkts`). Sie stehen in
				 * keiner gemeinsamen Liste (`gemeinsameliste.ts`), weil sie je Haus
				 * im Saal entstehen. Ohne ihre Zeile nannte das Dokument, das am
				 * Abend das Protokoll ist, eine abgelehnte Wahl nur als
				 * «entschieden», das Ergebnis stand allein im Hausprotokoll, und
				 * der Abschnitt «Anfechtung» fehlte, wo der Folgeantrag den
				 * einzigen Beschluss trug.
				 */
				z.push(
					`${wer2}${
						r.folgeantraegeAngenommen
							? folgeantraegeAngenommenSatz(r.folgeantraegeAngenommen)
							: teileEntschiedenSatz(r.teileEntschieden!)
					}`
				);
			} else if (r.art === 'kenntnisnahme') {
				// Kein Ergebnis, weil es keines gibt — nicht, weil eines fehlt.
				z.push(`${wer2}Zur Kenntnis genommen; es wurde nicht abgestimmt.`);
			} else if (r.beschlussvermerk) {
				/*
				 * **Ersatzlos** (Block 7): Der Text der Sitzungsleitung steht
				 * schon oben, und «Zu diesem Punkt liegt noch kein Ergebnis
				 * vor.» behauptete daneben eine Lücke, die es nicht gibt.
				 * `offeneErgebnisse` zählt den Punkt ebenfalls nicht mehr, das
				 * Dokument verliert damit seinen Entwurfsvermerk und bekommt
				 * den Unterschriftsblock, wenn sonst nichts fehlt.
				 *
				 * Der Zweig schreibt nichts; die Leerzeile nach dem Text der
				 * Leitung fällt deshalb weg, sonst stünden mit der am Schluss des
				 * Punkts zwei hintereinander (doppelter Abstand im PDF).
				 */
				// Ä-17 B auch hier, wie im Hausprotokoll (Codeprüfung 3d, N-a).
				if (r.neuAnZweiterVersammlung) {
					// Nur die Tatsache (Review DeepSeek zu Block 7, Befund 1).
					z.push(`${r.gemeinschaft}: ${neuAnZweiterProtokoll(null)}`);
				}
				if (z[z.length - 1] === '') z.pop();
			} else {
				// Kein glattes «offen»: Wer das liest, muss unterscheiden können
				// zwischen «nicht abgestimmt» und «abgelehnt».
				// `wer2` statt einer eigenen Bedingung: Steht eine Rüge davor, ist
				// das Haus schon genannt (Codeprüfung H8, dritter Durchgang, M1).
				z.push(`${wer2}Zu diesem Punkt liegt noch kein Ergebnis vor.`);
			}
			/*
			 * **Ausserhalb der Ergebniszweige**, wie im Hausprotokoll: Eine Zusage
			 * braucht keine Abstimmung, und der häufigste Fall der echten
			 * Protokolle ist genau der — ein Punkt «(Informativ)», daraus eine
			 * Pendenz.
			 *
			 * **Ohne Hausnamen** (Code-Review 09.09.2026). Der erste Anlauf setzte
			 * `wer` davor und schrieb ihn damit zum zweiten Mal in denselben
			 * Block: «Nirgendweg 3: Ein Votum aus dem Saal.» … «Nirgendweg 3:
			 * Pendenz:». Die Regel darüber heisst `wer2` und nennt das Haus genau
			 * einmal — und wenn dieser Block erreicht ist, hat ihn bereits einer
			 * der Zweige gesagt oder die Überschrift trägt ihn. Jeder Zweig
			 * schreibt eine Zeile, ausser dem des Beschlussvermerks (Block 7):
			 * Dort steht der Text der Leitung, und der nennt das Haus.
			 *
			 * Die Leerzeile davor wie bei Handzählung und Erfordernis: Aus ihr
			 * macht `pdf/protokoll.ts` den Absatzabstand.
			 */
			if (r.pendenzen.length > 0) {
				z.push('');
				z.push(r.pendenzen.length === 1 ? 'Pendenz:' : 'Pendenzen:');
				// `pendenz` und nicht `p`: Die äussere Schleife führt den Punkt des
				// Abends unter `p`, und ihn hier zu verdecken ist eine Falle für die
				// nächste Änderung.
				for (const pendenz of r.pendenzen) z.push(`- ${pendenzSatz(pendenz)}`);
			}
			z.push('');
		}
	}

	// A5, Punkt 2: wie im Hausprotokoll, einmal, wo ein Beschluss vorliegt.
	// Auch der Beschluss eines Folgeantrags, wenn er der einzige des Abends
	// ist (Produktentscheid 08.11.2026).
	const mitBeschluss = e.punkte.flatMap((p) =>
		bloeckeDesPunkts(p)
			.map(({ r }) => r)
			.filter((r) => !r.rueckzug && (r.beschlussvermerk || zeigtBeschluss(r.satz)))
	);
	if (mitBeschluss.length > 0) {
		z.push('## Anfechtung');
		z.push('');
		z.push(anfechtungsabschnitt(mitBeschluss.map((r) => r.anfechtungssonderfall)));
		z.push('');
	}

	// ── Schluss ─────────────────────────────────────────────────────────────
	z.push('## Schluss');
	z.push('');
	if (entwurf) {
		// Kein Unterschriftsblock unter einem Entwurf: Er wäre die Einladung, ihn
		// trotzdem zu unterschreiben.
		z.push(`${ENTWURFSHINWEIS} ${e.luecke}.`);
		z.push('');
		z.push(
			'Die Unterschriften stehen erst im vollständigen Protokoll — wenn jede ' +
				'Versammlung geschlossen ist und zu jedem Punkt ein Ergebnis vorliegt.'
		);
	} else {
		/*
		 * Dieselben zwei Zeilen wie im Protokoll einer einzelnen Versammlung
		 * (`protokoll.ts`). Ohne Linien: Unterzeichnet wird elektronisch, und eine
		 * Linie wäre die Aufforderung, es doch von Hand zu tun.
		 *
		 * **Seit Migration 092 mit Namen.** Die einzelne Versammlung trägt
		 * seit Migration 091 «Die Sitzungsleitung — <Name>:», der Abend seit
		 * Migration 092 dasselbe aus `meeting_day.chair_label`. Beim Verbund führt
		 * eine Person mehrere Häuser, und alle unterschreiben dasselbe Dokument —
		 * gerade hier trägt der Name über der Zeile am meisten.
		 */
		/*
		 * **Wählbar seit dem 12.08.2026** (Auftraggeber: «Mache die Unterschrift als
		 * Option»), weil das Gesetz keine verlangt und die Reglemente verschieden
		 * sind.
		 */
		if (e.unterschriften !== false) {
			z.push(
				e.sitzungsleitung
					? `Die Sitzungsleitung des Abends — ${e.sitzungsleitung}:`
					: 'Die Sitzungsleitung des Abends:'
			);
			z.push('');
			z.push(
				e.protokollfuehrung
					? `Die Protokollführung — ${e.protokollfuehrung}:`
					: 'Die Protokollführung:'
			);
			z.push('');
		}
		// Der Genehmigungssatz steht in beiden Fällen: Er sagt, wer welchen Teil
		// genehmigt, und das gilt auch ohne Unterschrift.
		z.push(
			'Jede beteiligte Gemeinschaft genehmigt den sie betreffenden Teil an ihrer ' +
				'nächsten Versammlung.'
		);
	}
	z.push('');
	z.push(
		`Erzeugt am ${e.erzeugtAm} durch ${e.erzeugtDurch}. Zahlen und Beschlusswortlaute ` +
			'stammen aus der Anwendung und wurden nicht neu formuliert.'
	);
	z.push('');

	return z.join('\n');
}

/**
 * Was noch fehlt, damit die Zusammenstellung vollständig wäre — ein Satz.
 *
 * Dieselbe Bauart wie `einheitenluecke` und `zuordnungsluecke`: Der Kern
 * rechnet, die Leiste zeigt. Ohne das stünde in der Ablaufleiste eines Tages
 * etwas anderes als auf der Seite dahinter.
 */
export function protokollluecke(e: {
	versammlungen: number;
	offeneErgebnisse: number;
	nichtGeschlossen: number;
	/**
	 * Punkte des Abends, denen keine Gemeinschaft zugeordnet ist.
	 *
	 * Sie fielen zuerst durch: Wo keine Gemeinschaft steht, gibt es auch kein
	 * fehlendes Ergebnis zu zählen — und das Protokoll galt als vollständig,
	 * obwohl acht Punkte leer blieben. Gesehen am 12.08.2026 im PDF des
	 * Prüflaufs, wo die Mustertraktanden ohne Zuordnung standen.
	 */
	ohneZuordnung?: number;
}): string | null {
	if (e.versammlungen === 0) return null;
	if (e.nichtGeschlossen > 0) {
		return `${e.nichtGeschlossen} von ${e.versammlungen} noch nicht geschlossen`;
	}
	const ohne = e.ohneZuordnung ?? 0;
	if (ohne > 0) {
		return `${ohne} ${ohne === 1 ? 'Punkt' : 'Punkte'} ohne Gemeinschaft`;
	}
	if (e.offeneErgebnisse > 0) {
		return `${e.offeneErgebnisse} ${e.offeneErgebnisse === 1 ? 'Punkt' : 'Punkte'} ohne Ergebnis`;
	}
	return null;
}
