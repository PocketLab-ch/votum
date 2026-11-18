/**
 * Reglementsabweichungen beim Mehrheitserfordernis (Story 2.4, FR-21).
 *
 * Der häufigste Fehler im Schweizer Stockwerkeigentum überhaupt: Das Gesetz
 * kennt ein Quorum, das Reglement ein anderes, und es gilt das Reglement. Auf
 * der Website bleibt dazu nur der Vorbehalt, weil das Reglement des Lesers
 * unbekannt ist. Hier ist es bekannt — oder sollte es sein. Genau darin liegt
 * laut Prüfung der grösste ungenutzte Gewinn.
 *
 * Der Vorbehalt wechselt damit seine Rolle: Er bleibt Hinweis, wo nichts
 * hinterlegt ist, und wird zur ausgewiesenen Anwendung, wo etwas hinterlegt ist.
 * Beides muss auf der Ergebniskarte unterscheidbar sein.
 */
import { FachlicherFehler } from './gemeinschaft';
import { anteilInWorten } from './beschlussfaehigkeit';
import { UNABHAENGIG_VON_KOEPFEN, schwelle as rechneSchwelle, schwelleInWorten, type Schwelle } from './mehrheit';
import { AUSSCHLUSSKLAGE_KNOTEN, betroffeneStimmenNichtMit, EINSPRACHE_KNOTEN, EINWAND_IM_SAAL, einwandImSaal, einwandStrengerAb, kennzahlenNachZaehlweise, NACH_DER_ANFECHTUNGSFRIST, sperreNachLehre, vereinbartBedingung, type Erfordernis, type Ergebniskarte, type Kennzahlen } from './entscheidbaum';
import { bezugsgroessenHinweis, bezugsgroessensatz, GESCHAEFTSARTEN, quotenwirkungssatz, regelKannGreifen, regelNurFallgenau, UMSTRITTEN_SATZ, type Ergebnistyp, type Geschaeftsart, type Kopfbasis, type Quotenbasis, type Regelwerk, type Reglementsverhalten } from './regelwerk';
import type { Id } from './types';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';
import { istKalendertag } from './datum';
import {
	erfordernisNachAndererLesart,
	fondsentnahmewahl,
	KOPFZAEHLWEISE_ARTIKEL,
	knotenNachLesart,
	kopfzaehlweiseVerdraengt,
	LESARTEN_VORGABE,
	mitKopfzaehlweise,
	wendeLesartAn,
	type Einsprachewahl,
	type Fondsentnahmewahl,
	type Kopfzaehlweise,
	type Lesartenwahl
} from './lesarten';

/**
 * Der Hinweis an der Bezugsgrösse der Kopfstimmen, wenn eine Klausel
 * «Mehrheit der Stockwerkeigentümer» hinterlegt wird (Entscheid 0054, Nachtrag,
 * Punkt 5; `quellen` Frage 93). Gemessen am 16.11.2026: Mit «anwesende und
 * vertretene» rechnet die Regel wie Frage 93, mit «alle Eigentümer» zu streng.
 *
 * **Abgegrenzt an den Abwesenden, nicht am Wort «aller»** (Fachprüfung
 * 16.11.2026, F-2): Das Gesetz sagt selbst «Mehrheit aller Miteigentümer», und
 * die herrschende Lehre zählt trotzdem die Anwesenden (Rz. 181 ad Art. 712m,
 * Lesart L13). Je Wortlaut eine Wahl (Laienprüfung L-14).
 */
export const KOPFBASIS_HINWEIS =
	'Steht im Reglement «Mehrheit der Stockwerkeigentümer» oder, wie im Gesetz, «Mehrheit aller ' +
	'Stockwerkeigentümer», wählen Sie bei den Köpfen «anwesende und vertretene Stimmen». So zählt die herrschende ' +
	'Lehre die Köpfe auch dort, wo das Gesetz «aller» sagt (SVIT-Kommentar Rz. 181 und 190 f. ad Art. 712m; ' +
	'Lesart L13). Das Bundesgericht hat eine fast gleichlautende Klausel nicht als Mehrheit aller Eigentümer ' +
	// Laienprüfung Runde 2, R2-L-2: die Wertquoten für beide Fälle, vor dem seltenen.
	// Fachprüfung Runde 3, R3-F-2: ausser das Reglement misst ausdrücklich an den Anwesenden (Rz. 192a).
	// Codeprüfung N6: das Feld erscheint erst mit dem Häkchen.
	'gelesen (BGE 144 III 510 E. 2.2.4). Bei den Wertquoten (Häkchen «Zusätzlich eine Wertquotenschwelle») ' +
	'wählen Sie in beiden Fällen «alle Wertquoten der ' +
	'Gemeinschaft», ausser Ihr Reglement misst das Wertquotenmehr ausdrücklich an den Anwesenden und ' +
	'Vertretenen (Rz. 191 und 192a ad Art. 712m). «Alle Eigentümer, auch die abwesenden» passt bei den Köpfen nur, wo das Reglement sagt, ' +
	'dass auch die Abwesenden mitzählen, die sich nicht vertreten lassen. Wer sich enthält, zählt nach ' +
	'herrschender Lehre bei den Köpfen mit und wirkt wie ein Nein; lassen Sie dafür «Enthaltungen bleiben in der ' +
	'Bezugsgrösse» angekreuzt.';

/**
 * Der Hinweis an der Wahl «Köpfe zählen nicht» in der Reglementsmaske
 * (Produktentscheid 16.11.2026). Fundstellen nach `quellen`
 * `themen/stockwerkeigentum/gesetz.md`, Art. 712m Abs. 1, Abweichung durch
 * Vereinbarung.
 */
export const OHNE_KOEPFE_HINWEIS =
	// Laien- und Fachprüfung 16.11.2026, Runden 1 und 2 (Berichte `2026-11-16-votum-wertquotenmehr-*`):
	// das Praktische zuerst (R2-L2), die Schwelle nach dem Reglement (R2-F3); das Recht in `OHNE_KOEPFE_RECHT`.
	'Wählen Sie das nur, wenn Ihr Reglement das Mehr allein nach Wertquoten bemisst, etwa «Mehrheit ' +
	'der an der Versammlung vertretenen Anteile (Wertquoten)». Steht dort nur «Anteile», kann auch ' +
	'eine Stimme je Einheit gemeint sein; klären Sie das vor der Versammlung. Stellen Sie unten die ' +
	'Schwelle so ein, wie das Reglement sie nennt: für die vertretenen Wertquoten «mehr als» 1 von 2 ' +
	'und «nur die anwesenden oder vertretenen», bei einer neuen Regel schon so vorbelegt; für alle ' +
	'Wertquoten «alle Wertquoten der Gemeinschaft». Nimmt es die Enthaltungen aus der Bezugsgrösse, ' +
	// Laien- und Fachprüfung Runde 3: Der Haken ist vorgegeben (R3-L1); die Nichtabgabe wirkt wie ein Nein (R3-L3, R3-F2).
	'entfernen Sie den vorgegebenen Haken bei «Enthaltungen bleiben in der Bezugsgrösse». Wer anwesend ' +
	'ist und nichts abgibt, zählt in Votum weiter mit und wirkt wie ein Nein; fragen Sie vor dem Schliessen ' +
	'nach, wer noch nicht abgestimmt hat. Votum wendet die Regel nur an, wo das Gesetz ' +
	'das einfache Mehr verlangt; wo es mehr verlangt, zählt es nach dem Gesetz. Abgestimmt wird mit ' +
	'einzelnen Stimmen; von Hand zählen lässt sich nicht, weil die Wertquoten an der Einheit hängen. ' +
	'Ob die Versammlung beschlussfähig ist, rechnet Votum unverändert nach Personen und Anteilen. Am ' +
	'gemeinsamen Abend gilt die Regel nur für diese Gemeinschaft.';

/**
 * Der zweite Absatz zur Wahl «Köpfe zählen nicht»: woher die Abweichung ihre
 * Geltung hat (Fachprüfung 16.11.2026, F1 bis F3 und R2-F1; Rz. 186 ad
 * Art. 712m, Rz. 123 und 126 ad Art. 712g, BGE 143 III 537 E. 4.2.4 zum
 * Wechsel auf eine Stimme je Einheit, auf Wertquoten übertragen eine Folgerung).
 * Derselbe Gedanke wie im Handbuch zur Ausschlussklage («nicht geklärt …»).
 */
export const OHNE_KOEPFE_RECHT =
	'Nach dem Gesetz zählen beim einfachen Mehr die Köpfe (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 ' +
	'Abs. 2). Ein Reglement darf stattdessen nach Wertquoten zählen, wenn das einstimmig eingeführt ' +
	'wurde (SVIT-Kommentar Rz. 186 ad Art. 712m). Steht die Bestimmung seit der Begründung im ' +
	'Reglement, ist das gegeben. Kam sie später mit weniger Stimmen hinein und hat sie niemand innert ' +
	'eines Monats angefochten, gilt sie wohl trotzdem. Den Wechsel zu einer Stimme je Einheit hat das ' +
	'Bundesgericht in diesem Fall nur als anfechtbar angesehen, nicht als nichtig (BGE 143 III 537 ' +
	'E. 4.2.4). Für die Wertquoten ist das nicht entschieden. Für die Beschlussfähigkeit zählen weiter ' +
	'die Personen (Rz. 16a ad Art. 712p).';

export interface ReglementsregelEingabe {
	/**
	 * Auf welchen Fall des Entscheidbaums die Regel beschränkt ist (22.08.2026).
	 *
	 * **`undefined` heisst «für alle Fälle dieser Geschäftsart»** — so wirkten
	 * Regeln bis dahin ausnahmslos, und so wirken bestehende weiter.
	 *
	 * Der Anlass (Befund B-02): Eine Art umfasst mehrere Fälle. Wer § 15 seines
	 * Reglements für den Erneuerungsfonds hinterlegte, verschärfte damit auch
	 * Jahresrechnung, Budget und Décharge — die tragen dieselbe Art. Sieben der
	 * fünfzehn Arten haben mehr als einen Fall.
	 */
	knotenId?: string | null;
	stwegId: Id;
	geschaeftsart: Geschaeftsart;
	/**
	 * Die Kopfschwelle, etwa zwei Drittel; `null` heisst «Köpfe zählen nicht».
	 *
	 * **Ohne Köpfe nur mit Wertquotenschwelle** (Produktentscheid 16.11.2026:
	 * Wertquotenmehr «bauen»). Manche Reglemente lassen das einfache Mehr nach
	 * den vertretenen Anteilen allein entscheiden (Rz. 186 ad Art. 712m, dritte
	 * Variante). Angewandt wird eine solche Regel nur, wo das Gesetz das einfache
	 * Mehr verlangt (`wendeReglementAn`, Vorbehalt `ohne_koepfe`). Die Kopfbasis
	 * bleibt dann ohne Wirkung und steht auf `anwesend_vertreten`.
	 */
	kopfSchwelle: Schwelle | null;
	kopfbasis: Kopfbasis;
	/** Zusätzliche Wertquotenschwelle, oder null. */
	quotenSchwelle: Schwelle | null;
	quotenbasis: Quotenbasis;
	/** Wo im Reglement das steht. Pflicht — ohne sie ist die Regel nicht überprüfbar. */
	fundstelle: string;
	/**
	 * Ob Enthaltungen in der Bezugsgrösse bleiben.
	 *
	 * Manche Reglemente nehmen sie heraus. Der Unterschied entscheidet über
	 * Annahme oder Ablehnung, deshalb steht er hier und wird nicht angenommen
	 * (AD-15).
	 */
	enthaltungZaehltMit: boolean;
	/**
	 * Das Häkchen «steht in der ursprünglichen Fassung des Begründungsakts oder
	 * hat die Zustimmung aller Eigentümer» (Migration 197; Produktentscheid
	 * 17.11.2026, «Häkchen, sonst Hinweis»; R2-F-6, R5-F-2).
	 *
	 * **Nur an der Bezahlung aus dem Fonds im gewöhnlichen Zweck wirksam**
	 * (`fondsregelHaekchenWirkt`): Dort rechnet Votum unter L17 «streng» eine
	 * Regel mit Häkchen, ob milder oder strenger. Gespeichert wird es nur bei der
	 * Geschäftsart `verwaltung_wichtig`, für alle Fälle oder genau diesen
	 * (`pruefeReglementsregel`); sonst `false`. Fehlt das Feld, heisst das
	 * `false`, wie die Vorgabe der Spalte.
	 */
	gesichert?: boolean;
	hinweis?: string;
}

export interface Reglementsregel extends ReglementsregelEingabe {
	id: Id;
}

const HOECHSTER_NENNER = 100;

/**
 * @param regelwerk Nötig, sobald die Regel auf einen Fall beschränkt ist — nur
 * damit lässt sich prüfen, ob es den Fall gibt und ob er zur Art gehört. Ohne
 * Beschränkung bleibt der Parameter ungenutzt; die Aufrufer geben ihn trotzdem
 * mit, damit die Prüfung nicht davon abhängt, woran gerade jemand denkt.
 */
export function pruefeReglementsregel(
	eingabe: ReglementsregelEingabe,
	regelwerk?: Regelwerk
): ReglementsregelEingabe {
	if (!GESCHAEFTSARTEN.some((g) => g.art === eingabe.geschaeftsart)) {
		throw new FachlicherFehler(
			'geschaeftsart_unbekannt',
			`Unbekannte Geschäftsart: ${eingabe.geschaeftsart}.`,
			'geschaeftsart'
		);
	}

	/*
	 * **Der Knoten muss zur Geschäftsart gehören** (22.08.2026). Sonst entstünde
	 * eine Regel, die nirgends greift: Der Vergleich in `wendeReglementAn` prüft
	 * Art UND Knoten, und eine Regel mit fremdem Knoten fiele stumm durch.
	 * Geprüft wird gegen das Regelwerk — die Datenbank kann nur die Form sichern,
	 * weil das Regelwerk versioniert im Code liegt.
	 */
	if (eingabe.knotenId) {
		const knoten = regelwerk?.knoten.find((k) => k.id === eingabe.knotenId);
		if (!knoten) {
			throw new FachlicherFehler(
				'knoten_unbekannt',
				'Diesen Fall gibt es im geltenden Regelwerk nicht.',
				'knotenId'
			);
		}
		if (knoten.geschaeftsart !== eingabe.geschaeftsart) {
			throw new FachlicherFehler(
				'knoten_fremde_art',
				`«${knoten.titel}» gehört nicht zur gewählten Geschäftsart. Eine Regel, die beides ` +
					'nicht zusammenbringt, würde nirgends angewandt.',
				'knotenId'
			);
		}
	}

	/*
	 * **Eine Regel, die nirgends greifen kann** (25.09.2026). Verlangt ein Fall
	 * die Zustimmung der Betroffenen, wendet `wendeReglementAn` keine Regel an,
	 * die sie aus der Bezugsgrösse nimmt. Verlangen das alle Fälle, an denen die
	 * Regel greifen könnte, stünde sie nur als Vermerk da.
	 *
	 * **Gezählt werden die Fälle, nicht die Beschränkung.** Die erste Fassung
	 * wies nur eine auf einen Fall beschränkte Regel ab (Code-Review
	 * 25.09.2026). `nutzungsrechte` hat aber nur den einen Fall, und dort zeigt
	 * das Formular gar keine Fallwahl: Die erreichbare Regel galt für die ganze
	 * Art und lief an der Schranke vorbei. Gesperrte Fälle zählen nicht mit,
	 * dort greift ohnehin keine Regel, und ihr Grund steht an der Karte.
	 */
	// Ohne Köpfe trägt die Kopfbasis nichts; sie steht fest, damit kein Wert
	// durch die Vergleiche wandert, den niemand gewählt hat.
	if (eingabe.kopfSchwelle === null) eingabe = { ...eingabe, kopfbasis: 'anwesend_vertreten' };

	if (eingabe.kopfbasis === 'alle_ausser_betroffene' && regelwerk) {
		const faelle = regelwerk.knoten.filter(
			(k) =>
				(eingabe.knotenId ? k.id === eingabe.knotenId : k.geschaeftsart === eingabe.geschaeftsart) &&
				k.typ !== 'grenzfall' &&
				k.typ !== 'keine_abstimmung' &&
				regelKannGreifen(k.reglementsverhalten)
		);
		if (faelle.length > 0 && faelle.every((k) => k.zustimmungBetroffenerNoetig)) {
			throw new FachlicherFehler(
				'betroffene_ausgenommen',
				`${faelle.map((k) => `«${k.titel}»`).join(' und ')} ` +
					`${faelle.length > 1 ? 'verlangen' : 'verlangt'} die Zustimmung der ` +
					'Betroffenen. Eine Regel, die sie aus der Bezugsgrösse nimmt, wendet diese Anwendung ' +
					'dort nicht an, weil ihre Zustimmung sonst nicht mehr gezählt würde.',
				'kopfbasis'
			);
		}
	}

	if (eingabe.kopfSchwelle) pruefeSchwelle(eingabe.kopfSchwelle, 'kopfSchwelle');
	if (eingabe.quotenSchwelle) pruefeSchwelle(eingabe.quotenSchwelle, 'quotenSchwelle');
	if (!eingabe.kopfSchwelle && !eingabe.quotenSchwelle) {
		throw new FachlicherFehler(
			'ohne_koepfe_ohne_quoten',
			'Zählen die Köpfe nicht, braucht die Regel eine Schwelle bei den Wertquoten; sonst ' +
				'liesse sich nicht sagen, wann ein Antrag angenommen ist.',
			'quotenSchwelle'
		);
	}

	// Eine Quotenschwelle ohne Quotenbasis wäre eine Anforderung, zu der niemand
	// weiss, worauf sie sich bezieht.
	if (eingabe.quotenSchwelle && eingabe.quotenbasis === 'keine') {
		throw new FachlicherFehler(
			'quotenbasis_fehlt',
			'Zur Wertquotenschwelle gehört die Angabe, worauf sie sich bezieht.',
			'quotenbasis'
		);
	}
	if (!eingabe.quotenSchwelle && eingabe.quotenbasis !== 'keine') {
		throw new FachlicherFehler(
			'quotenschwelle_fehlt',
			'Zur Wertquotenbasis gehört eine Schwelle.',
			'quotenSchwelle'
		);
	}

	const fundstelle = eingabe.fundstelle?.trim() ?? '';
	if (zeichenzahl(fundstelle) < 3) {
		throw new FachlicherFehler(
			'fundstelle_fehlt',
			'Die Fundstelle im Reglement ist anzugeben, damit die Regel überprüfbar bleibt.',
			'fundstelle'
		);
	}

	return {
		...eingabe,
		fundstelle,
		gesichert: haekchenMoeglich(eingabe) && eingabe.gesichert === true,
		hinweis: eingabe.hinweis?.trim() || undefined
	};
}

/**
 * Ob das Häkchen «Begründungsakt oder Zustimmung aller» an einer Regel dieser
 * Art und dieses Falls etwas bewirken kann: an der Bezahlung aus dem Fonds im
 * gewöhnlichen Zweck (`FONDSENTNAHME_KNOTEN`), also bei einer Regel für genau
 * diesen Fall oder für alle wichtigeren Verwaltungshandlungen. Sonst stünde es
 * an einer Regel, ohne dass es etwas tut. Dieselbe Bedingung zeigt das Feld
 * auf der Seite «Reglement».
 */
export function haekchenMoeglich(r: { geschaeftsart: string; knotenId?: string | null }): boolean {
	return r.geschaeftsart === FONDSENTNAHME_ART && (!r.knotenId || r.knotenId === FONDSENTNAHME_KNOTEN);
}

/** Die Karte, an der das Häkchen wirkt (Fassung 2026-11-20, `ENTNAHME_ID`), und ihre Geschäftsart. */
export const FONDSENTNAHME_KNOTEN = 'k-erneuerungsfonds-entnahme';
const FONDSENTNAHME_ART: Geschaeftsart = 'verwaltung_wichtig';

/**
 * Ab welcher Fassung das Häkchen wirkt (Produktentscheid 17.11.2026: in
 * derselben neuen Fassung wie der Widerruf). Ein Traktandum der Fassung
 * 2026-11-20 rechnet weiter wie bisher, auch mit Häkchen (AD-4); nachgezogen
 * kommt es auf die geltende Fassung.
 */
export const FONDSREGEL_HAEKCHEN_AB = '2026-11-21';

/** Ob das Häkchen an diesem Erfordernis wirken kann: an der Karte und ab der Fassung. */
export function fondsregelHaekchenWirkt(e: { knotenId?: string; fassung?: string }): boolean {
	return e.knotenId === FONDSENTNAHME_KNOTEN && haekchenFassung(e.fassung);
}

/** Ob eine Fassung das Häkchen kennt (`FONDSREGEL_HAEKCHEN_AB`). */
function haekchenFassung(fassung: string | undefined): boolean {
	return fassung !== undefined && istKalendertag(fassung) && fassung >= FONDSREGEL_HAEKCHEN_AB;
}

/**
 * Das Häkchen einer Regel für `Erfordernis.regelGesichert` (Migration 198), nur
 * wo es allein den Satz an der Karte ändert (`nurSatz`) und die Regel es tragen
 * kann (`haekchenMoeglich`); sonst `undefined`.
 */
function haekchenNurAmSatz(regel: Reglementsregel, nurSatz: boolean): boolean | undefined {
	return nurSatz && haekchenMoeglich(regel) ? regel.gesichert === true : undefined;
}

/**
 * An der vereinbarten Verwendung wählt das Häkchen den Satz
 * (`FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN` oder `FONDSENTNAHME_VEREINBART_MILDER`,
 * `vorbehaltInWorten`), ab der Fassung 2026-11-21; gerechnet wird dort immer
 * nach der Karte. Dieselbe Bedingung wie dort: Vorbehalt `milder_nach_lesart`
 * an einem Mehr der Zustimmung aller.
 */
function mitHaekchenZumSatz(erfordernis: Erfordernis, regel: Reglementsregel, anVereinbarter: boolean): Erfordernis {
	const g = haekchenNurAmSatz(regel, anVereinbarter && haekchenFassung(erfordernis.fassung));
	return g === undefined ? erfordernis : { ...erfordernis, regelGesichert: g };
}

/**
 * Der Zusatz im Kasten «Ein Traktandum trägt noch ein älteres Erfordernis»,
 * wenn nur das Häkchen wechselt (Migration 198): Ohne ihn stünde dort «von X
 * auf X». `null` heisst: Das gespeicherte Erfordernis trägt keines, etwa weil
 * es unter L17 «svit» oder vor Migration 198 hergeleitet wurde; dann «nicht
 * vermerkt» statt «nicht gesetzt», sonst läse sich die Zeile, als hätte jemand
 * es entfernt (Laienprüfung 18.11.2026, L-3).
 */
export function haekchenZusatz(gesichert: boolean | null): string {
	if (gesichert === null) return 'Häkchen «Begründungsakt oder Zustimmung aller» nicht vermerkt';
	return gesichert
		? 'Häkchen «Begründungsakt oder Zustimmung aller» gesetzt'
		: 'Häkchen «Begründungsakt oder Zustimmung aller» nicht gesetzt';
}

/** Das Häkchen in Worten, für Verlauf und Vergleich. */
function gesichertInWorten(gesichert: boolean | undefined): string {
	return gesichert ? 'im Begründungsakt oder mit Zustimmung aller' : 'nicht vermerkt';
}

function pruefeSchwelle(s: Schwelle, feld: string): void {
	if (!Number.isInteger(s.zaehler) || !Number.isInteger(s.nenner)) {
		throw new FachlicherFehler('schwelle_nicht_ganzzahlig', 'Zähler und Nenner müssen ganze Zahlen sein.', feld);
	}
	/*
	 * **Der Nenner darf 1 sein** (22.08.2026, Befund A-02 des Prüflaufs).
	 *
	 * Bis dahin verlangte diese Prüfung `nenner >= 2` — und wies damit genau den
	 * Bruch ab, den die Anwendung selbst für die Einstimmigkeit verwendet:
	 * `ALLE = { zaehler: 1, nenner: 1 }` in `mehrheit.ts`. Ein Reglement, das für
	 * luxuriöse bauliche Massnahmen die Zustimmung aller verlangt (ZGB Art. 647e,
	 * und fast jedes Reglement schreibt das ab), liess sich nicht hinterlegen.
	 *
	 * Der Prüfer im Durchgang A grenzte es richtig ein — «3/4 aller» ging, «1/1»
	 * nicht — und kam zum Schluss, die Anwendung weise stumm ab. Stumm war es,
	 * weil auch das Eingabefeld `min="2"` trug: Der Browser blockte, bevor der
	 * Server je gefragt wurde.
	 */
	if (s.zaehler < 1 || s.nenner < 1 || s.nenner > HOECHSTER_NENNER) {
		throw new FachlicherFehler(
			'schwelle_unplausibel',
			`Der Bruch ist unplausibel: Zähler ab 1, Nenner von 1 bis ${HOECHSTER_NENNER}.`,
			feld
		);
	}
	if (s.zaehler > s.nenner) {
		throw new FachlicherFehler(
			'schwelle_ueber_ganzem',
			'Ein Bruch über der ganzen Bezugsgrösse wäre nie erreichbar.',
			feld
		);
	}
	/*
	 * **«Mehr als alle» gibt es nicht.** Mit dem ganzen Bruch wird die Art zur
	 * Falle: `schwelle()` rechnet bei «mehr als» `floor(basis) + 1` — eine
	 * Schwelle über der Bezugsgrösse, die auch bei ausnahmslos allen Ja-Stimmen
	 * nie erreicht wird. Ein Erfordernis, an dem jeder Antrag scheitert, ist
	 * kein Erfordernis, sondern ein Fehler mit Bedenkzeit.
	 */
	if (s.zaehler === s.nenner && s.art === 'mehr_als') {
		throw new FachlicherFehler(
			'schwelle_mehr_als_alle',
			'«Mehr als» die ganze Bezugsgrösse ist nie erreichbar. Für die Zustimmung aller ' +
				'wählen Sie «mindestens».',
			feld
		);
	}
}

export function legeReglementsregelAn(
	id: Id,
	eingabe: ReglementsregelEingabe,
	regelwerk?: Regelwerk
): Uebergang<Reglementsregel> {
	const geprueft = pruefeReglementsregel(eingabe, regelwerk);
	return uebergang(
		{ ...geprueft, id },
		ereignis(
			EREIGNISARTEN.reglementsregelHinterlegt,
			{ art: 'stweg', id: geprueft.stwegId },
			{
				geschaeftsart: geprueft.geschaeftsart,
				kopf: bruchtext(geprueft.kopfSchwelle),
				kopfart: geprueft.kopfSchwelle?.art ?? null,
				kopfbasis: geprueft.kopfbasis,
				quoten: geprueft.quotenSchwelle
					? `${geprueft.quotenSchwelle.zaehler}/${geprueft.quotenSchwelle.nenner}`
					: null,
				fundstelle: geprueft.fundstelle,
				// Nur wo das Häkchen etwas bewirken kann (Migration 197).
				...(haekchenMoeglich(geprueft) ? { gesichert: gesichertInWorten(geprueft.gesichert) } : {})
			}
		)
	);
}

/**
 * Die fachlichen Merkmale einer Regel, flach und vergleichbar.
 *
 * Nur fuer den Vergleich alt gegen neu gedacht, nicht als Anzeigeform. **Alle**
 * fachlichen Felder gehoeren hinein, auch die unscheinbaren: Fuehrte die Liste
 * bloss Schwelle und Fundstelle, liefe eine geaenderte Enthaltungsregel als
 * «nichts geaendert» durch, und der Verlauf schwiege ueber die Aenderung, die
 * am Ergebnis das meiste bewegt.
 */
/**
 * Ein Bruch für Verlauf und Vergleich. Ohne Schwelle ein Wort statt `null`:
 * Leere Werte lässt der Verlauf weg, und die Änderung auf «Köpfe zählen nicht»
 * stünde dort ohne «Nachher» (Codeprüfung Block A, N3).
 */
function bruchtext(s: Schwelle | null): string {
	return s ? `${s.zaehler}/${s.nenner}` : 'Köpfe zählen nicht';
}

function merkmale(r: ReglementsregelEingabe): Record<string, string | null> {
	return {
		geschaeftsart: r.geschaeftsart,
		fall: r.knotenId ?? null,
		kopf: bruchtext(r.kopfSchwelle),
		kopfart: r.kopfSchwelle?.art ?? null,
		kopfbasis: r.kopfbasis,
		quoten: r.quotenSchwelle
			? `${r.quotenSchwelle.zaehler}/${r.quotenSchwelle.nenner}`
			: null,
		quotenart: r.quotenSchwelle?.art ?? null,
		quotenbasis: r.quotenbasis,
		fundstelle: r.fundstelle,
		enthaltung: r.enthaltungZaehltMit ? 'zaehlt_mit' : 'faellt_aus_basis',
		// Migration 197: in Worten, damit der Verlauf Vorzustand und neuen Wert lesbar zeigt.
		gesichert: gesichertInWorten(r.gesichert),
		hinweis: r.hinweis ?? null
	};
}

/**
 * Eine bestehende Abweichung aendern, ohne sie aufzuheben und neu anzulegen.
 *
 * **Warum ein eigener Uebergang** (03.09.2026, Punkt 3 der sechs zur
 * Reglementsseite, Befund des Auftraggebers vom 11.08.2026 eine Stufe spaeter): Geaendert
 * werden konnte eine Regel schon vorher, weil der Schreibweg auf dem Schluessel
 * aus Art und Fall ein `ON CONFLICT ... DO UPDATE` traegt. Nur fuehrte kein Weg
 * dorthin, und im Verlauf stand danach «hinterlegt» — die Berichtigung eines
 * Vertippers war von der erstmaligen Erfassung nicht zu unterscheiden.
 *
 * **Die Kennung bleibt.** Sie ist es, woran der Verlauf und eine spaetere
 * Nachfrage die Regel wiedererkennen. Aufheben und neu anlegen zerreisst genau
 * diesen Faden: Zwei Ereignisse ueber zwei verschiedene Regeln, wo eine Regel
 * einmal berichtigt wurde.
 *
 * **Ohne Unterschied kein Ereignis.** Wer das Formular oeffnet und unveraendert
 * abschickt, hat nichts geaendert; ein Eintrag «geaendert: nichts» waere
 * Rauschen im Beleg, den der Verlauf darstellen soll. Der Aufrufer erkennt den
 * Fall an der leeren Ereignisliste.
 */
export function aendereReglementsregel(
	bisher: Reglementsregel,
	eingabe: ReglementsregelEingabe,
	regelwerk?: Regelwerk
): Uebergang<Reglementsregel> {
	const geprueft = pruefeReglementsregel(eingabe, regelwerk);
	const neue: Reglementsregel = { ...geprueft, id: bisher.id };

	const vorherAlle = merkmale(bisher);
	const nachherAlle = merkmale(neue);
	const felder = Object.keys(nachherAlle).filter((f) => vorherAlle[f] !== nachherAlle[f]);
	if (felder.length === 0) return uebergang(neue);

	const vorher: Record<string, string | null> = {};
	const nachher: Record<string, string | null> = {};
	for (const f of felder) {
		vorher[f] = vorherAlle[f];
		nachher[f] = nachherAlle[f];
	}

	return uebergang(
		neue,
		ereignis(
			EREIGNISARTEN.reglementsregelGeaendert,
			{ art: 'stweg', id: neue.stwegId },
			{ regelId: neue.id, geschaeftsart: neue.geschaeftsart, felder, vorher, nachher }
		)
	);
}

export function hebeReglementsregelAuf(regel: Reglementsregel): Uebergang<Id> {
	return uebergang(
		regel.id,
		ereignis(
			EREIGNISARTEN.reglementsregelAufgehoben,
			{ art: 'stweg', id: regel.stwegId },
			{ geschaeftsart: regel.geschaeftsart, fundstelle: regel.fundstelle }
		)
	);
}

// ── Anwenden ────────────────────────────────────────────────────────────────

/**
 * Warum eine hinterlegte Regel bloss als Hinweis erscheint.
 *
 * Je Grund ein eigener Satz auf der Karte — «wird nicht angewandt» allein
 * liesse offen, ob das ein Versehen ist. `grenzfall`, `keine_abstimmung` und
 * `einstimmigkeit` sind die alten typbasierten Gründe (Fassungen bis
 * 2026-08-05); `zwingend`, `vereinbarung`, `reglementsschranke` und
 * `verschaerfung` kamen mit dem Reglementsverhalten je Knoten (15.08.2026),
 * `betroffenenzustimmung` mit der Schranke in `wendeReglementAn` (25.09.2026),
 * `milderung` mit `nur_verschaerfen` (ab Fassung 2026-10-20).
 */
export type Regelvorbehalt =
	| 'grenzfall'
	| 'einstimmigkeit'
	| 'keine_abstimmung'
	| 'zwingend'
	| 'vereinbarung'
	/**
	 * An einer Karte mit `vereinbart`: Die Regel verlangt Einstimmigkeit, wo
	 * das Gesetz ein Mehr genügen lässt. Das darf auch eine einstimmig
	 * eingeführte Bestimmung nicht (Fachprüfung 07.10.2026: Rz. 125 ad
	 * Art. 712a, Rz. 37 ad Art. 712g, Rz. 196 ad Art. 712m).
	 */
	| 'einstimmigkeit_ausgeschlossen'
	/**
	 * An einer Karte mit `vereinbart`, wo das Gesetz die Zustimmung aller
	 * verlangt: Die Regel gilt für die ganze Geschäftsart, nicht für diesen
	 * Fall (Laienprüfung 07.10.2026, B7).
	 */
	| 'nur_fallgenau'
	| 'reglementsschranke'
	| 'verschaerfung'
	/**
	 * An einer Karte mit `nur_verschaerfen`: Die Regel ist in mindestens einer
	 * Hinsicht milder als das Gesetz oder lässt sich nicht einordnen. Das
	 * Spiegelbild von `verschaerfung` (Einsprache, Rz. 186 ad Art. 712c).
	 */
	| 'milderung'
	/**
	 * An einer Karte mit L17 unter der strengeren Auffassung (ab Fassung
	 * 2026-11-20): Die Regel ist in mindestens einer Hinsicht milder als das
	 * gerechnete Mehr oder lässt sich nicht einordnen.
	 */
	| 'milder_nach_lesart'
	| 'gemischt'
	| 'betroffenenzustimmung'
	/**
	 * Die Regel zählt die Köpfe nicht, und das Gesetz verlangt hier mehr als das
	 * einfache Mehr (Produktentscheid 16.11.2026: nur beim einfachen Mehr).
	 */
	| 'ohne_koepfe';

/**
 * Ob die Regel strenger ist als das gesetzliche Erfordernis.
 *
 * Dieselbe Rechnung wie `mindestensSoStreng` beim Rückkommen: ganzzahlig über
 * Kreuz, «mehr als» schlägt «mindestens» beim gleichen Bruch, eine
 * hinzukommende Wertquotenbedingung ist eine Verschärfung. `null` heisst
 * **nicht vergleichbar** (andere Bezugsgrösse) — und Unvergleichbares wird bei
 * `nur_mildern` nicht angewandt: Wer behauptet, eine Regel sei milder, muss es
 * zeigen können.
 */
function regelStrengerAlsGesetz(regel: Reglementsregel, gesetz: Erfordernis): boolean | null {
	if (!gesetz.kopfSchwelle) return null;
	// Ohne Köpfe gegen ein Mehr mit Köpfen: bei den Köpfen milder, mit der
	// Wertquotenschwelle strenger, also nicht vergleichbar.
	if (!regel.kopfSchwelle) return null;
	if (regel.kopfbasis !== gesetz.kopfbasis) return null;

	const kopfGroesser =
		regel.kopfSchwelle.zaehler * gesetz.kopfSchwelle.nenner >
		gesetz.kopfSchwelle.zaehler * regel.kopfSchwelle.nenner;
	if (kopfGroesser) return true;
	const kopfGleich =
		regel.kopfSchwelle.zaehler * gesetz.kopfSchwelle.nenner ===
		gesetz.kopfSchwelle.zaehler * regel.kopfSchwelle.nenner;
	if (kopfGleich && regel.kopfSchwelle.art === 'mehr_als' && gesetz.kopfSchwelle.art === 'mindestens') {
		return true;
	}

	// Eine Wertquotenbedingung, wo das Gesetz keine kennt, ist eine Verschärfung.
	if (regel.quotenSchwelle && !gesetz.quotenSchwelle) return true;
	if (regel.quotenSchwelle && gesetz.quotenSchwelle) {
		if (regel.quotenbasis !== gesetz.quotenbasis) return null;
		if (
			regel.quotenSchwelle.zaehler * gesetz.quotenSchwelle.nenner >
			gesetz.quotenSchwelle.zaehler * regel.quotenSchwelle.nenner
		) {
			return true;
		}
	}
	// Das Weglassen einer gesetzlichen Quotenbedingung ist eine Milderung —
	// zulässig, wo gemildert werden darf.
	return false;
}

/** Ein Vergleich in einer Hinsicht: strenger (1), gleich (0), milder (-1), unvergleichbar (null). */
type Richtung = -1 | 0 | 1 | null;

function vergleicheSchwelle(a: Schwelle, b: Schwelle): -1 | 0 | 1 {
	const links = a.zaehler * b.nenner;
	const rechts = b.zaehler * a.nenner;
	if (links !== rechts) return links > rechts ? 1 : -1;
	if (a.art === b.art) return 0;
	return a.art === 'mehr_als' ? 1 : -1;
}

/** Bezugsgrösse und Bruch zusammen: widersprechen sie sich, ist die Hinsicht selbst gemischt. */
function zusammen(basis: Richtung, bruch: Richtung): Richtung {
	if (basis === null || bruch === null) return null;
	if (basis === 0) return bruch;
	if (bruch === 0 || bruch === basis) return basis;
	return null;
}

const KOPFRANG: Partial<Record<Kopfbasis, number>> = { anwesend_vertreten: 0, alle_eigentuemer: 1 };

/**
 * **Wo die Betroffenen unter keiner Kopfbasis mitstimmen, eine eigene
 * Rangfolge** (Produktentscheid 29.09.2026 für die Ausschlussklage; ab Fassung
 * 2026-10-20 auch die Einsprache, Codeprüfung M1). Dort stimmen sie unter
 * keiner Kopfbasis mit (`betroffeneStimmenNichtMit`); «die Anwesenden» sind
 * dann eine Teilmenge von «allen ohne die Betroffenen» und damit milder.
 * Anderswo gilt das nicht: Dort zählen die Betroffenen unter «den Anwesenden»
 * mit, und ob «alle ohne sie» strenger ist, hängt davon ab, wer erscheint.
 * Deshalb bleibt `alle_ausser_betroffene` in `KOPFRANG` unvergleichbar. Der
 * Name bleibt aus der Zeit, als es nur die Ausschlussklage betraf.
 */
const KOPFRANG_AUSSCHLUSSKLAGE: Partial<Record<Kopfbasis, number>> = {
	anwesend_vertreten: 0,
	alle_ausser_betroffene: 1
};

/**
 * Die Kopfbasis einer hinterlegten Regel, wie Votum sie an diesem Erfordernis
 * liest.
 *
 * **«Alle Eigentümer» heisst bei der Ausschlussklage «alle ohne den
 * Beklagten»** (Produktentscheid 29.09.2026, `quellen` `fragen.md` Frage 52).
 * Das Gesetz nimmt ihn selbst aus der Zahl (ZGB Art. 649b Abs. 2), und eine
 * Klausel, die das nicht wiederholt, wird nicht als strengerer Nenner gelesen.
 * Wörtlich genommen wäre sie strenger: Bei zehn Eigentümern brauchte es sechs
 * Ja statt fünf. Danach entscheidet die Schwelle.
 */
export function kopfbasisDerRegel(
	regel: Pick<Reglementsregel, 'kopfbasis'>,
	e: Pick<Erfordernis, 'knotenId'>
): Kopfbasis {
	/*
	 * **Ebenso an der Einsprache** (ab Fassung 2026-10-20, Codeprüfung M1):
	 * Gezählt wird dort ohnehin ohne die Betroffenen (`betroffeneStimmenNichtMit`
	 * über die Kennung), die Lesart ändert also nicht die Zahl, sondern nur,
	 * dass die Regel mit dem Gesetz vergleichbar wird und so heisst, wie gezählt
	 * wird. Unter der Kopfbasis selbst entscheidet hier die Kennung, nicht die
	 * Kopfbasis der Regel.
	 */
	return regel.kopfbasis === 'alle_eigentuemer' &&
		betroffeneStimmenNichtMit({ kopfbasis: 'alle_eigentuemer', knotenId: e.knotenId })
		? 'alle_ausser_betroffene'
		: regel.kopfbasis;
}

/** Der Satz zur Lesart an der Einsprache (ab Fassung 2026-10-20). */
const LESART_ALLE_OHNE_BETROFFENE =
	'Ihre Regel nennt alle Eigentümer. Bei der Einsprache liest dieses Werkzeug das als alle ' +
	'Eigentümer ohne den Eigentümer, der verkauft, vermietet oder belastet, denn er stimmt hier ' +
	'nicht mit.';

/** Der Satz zur Lesart aus `kopfbasisDerRegel`, wo sie die Klausel umdeutet. */
const LESART_ALLE_OHNE_BEKLAGTEN =
	'Ihre Regel nennt alle Eigentümer. Bei der Ausschlussklage liest dieses Werkzeug das als ' +
	'alle Eigentümer ohne den Beklagten, weil das Gesetz ihn selbst aus der Zahl nimmt ' +
	'(ZGB Art. 649b Abs. 2). Wörtlich genommen, mit dem Beklagten in der Zahl, verlangt Ihre ' +
	'Regel manchmal eine Stimme mehr, bei der einfachen Mehrheit und ohne Angehörige im Ausstand ' +
	'immer dann, wenn die Zahl der Eigentümer mit dem Beklagten gerade ist: bei zehn Eigentümern ' +
	'sechs Ja statt fünf. Sicher ' +
	'ist die Ermächtigung, wenn sie auch so reicht.';
const QUOTENRANG: Record<Quotenbasis, number> = { keine: 0, anwesend_vertreten: 1, alle_quoten: 2 };

/**
 * **Wie sich eine Regel zum Gesetz verhält**, Hinsicht für Hinsicht
 * (Produktentscheid 27.09.2026, Verhalten `einordnen`).
 *
 * Verglichen werden Köpfe (Bezugsgrösse und Bruch), Wertquoten (ob überhaupt,
 * Bezugsgrösse, Bruch) und die Enthaltung. «Alle» ist strenger als «die
 * Anwesenden», eine Quotenbedingung strenger als keine, eine mitzählende
 * Enthaltung strenger als eine herausfallende. **Strenger** heisst: in keiner
 * Hinsicht milder; wer die Regel erreicht, erreicht dann auch das Gesetz.
 * **Milder** umgekehrt. Alles andere ist **gemischt**, auch jede Hinsicht, die
 * sich nicht vergleichen lässt (`alle_ausser_betroffene` gegen eine andere
 * Kopfbasis; ausser bei der Ausschlussklage, siehe `KOPFRANG_AUSSCHLUSSKLAGE`
 * und `kopfbasisDerRegel`).
 *
 * Anders als `regelStrengerAlsGesetz`: Das nannte eine Regel schon strenger,
 * sobald die Kopfschwelle höher lag, auch wenn ihr die Quotenbedingung des
 * Gesetzes fehlte. Für `nur_mildern` war das die sichere Seite (strenger wird
 * nicht angewandt); für `einordnen`, das Strengeres anwendet, wäre es die
 * falsche.
 */
export function einordnungGegenGesetz(
	regel: Reglementsregel,
	gesetz: Erfordernis
): 'strenger' | 'milder' | 'gemischt' {
	if (!gesetz.kopfSchwelle) return 'gemischt';

	const v = vergleicheMasse(
		{
			kopfbasis: kopfbasisDerRegel(regel, gesetz),
			kopfSchwelle: regel.kopfSchwelle,
			quotenbasis: regel.quotenbasis,
			quotenSchwelle: regel.quotenSchwelle,
			enthaltungZaehltMit: regel.enthaltungZaehltMit
		},
		{
			kopfbasis: gesetz.kopfbasis,
			kopfSchwelle: gesetz.kopfSchwelle,
			quotenbasis: gesetz.quotenbasis,
			quotenSchwelle: gesetz.quotenSchwelle,
			// `undefined` heisst am Erfordernis «zählen mit» (siehe dort).
			enthaltungZaehltMit: gesetz.enthaltungZaehltMit !== false
		},
		// An `betroffeneStimmenNichtMit`, nicht an der Kennung (Codeprüfung M1):
		// Ausschlussklage und Einsprache; die Regel behält die Kennung, gezählt
		// wird auch unter ihr ohne die Betroffenen.
		// Nur über die Kennung (Codeprüfung Durchgang 2, N2): Die Kopfbasis des
		// Gesetzes soll den Rang nicht mitbestimmen.
		betroffeneStimmenNichtMit({ kopfbasis: 'anwesend_vertreten', knotenId: gesetz.knotenId })
	);
	// Gleich heisst hier «in keiner Hinsicht milder», also strenger im Sinn
	// dieser Funktion: wer die Regel erreicht, erreicht auch das Gesetz.
	return v === 'gleich' ? 'strenger' : v;
}

/** Die Masse eines Mehrs, nach denen gezählt wird: Köpfe, Wertquoten, Enthaltung. */
export interface Mehrmasse {
	kopfbasis: Kopfbasis;
	/** `null`: Die Köpfe zählen nicht (Regel nur nach Wertquoten). */
	kopfSchwelle: Schwelle | null;
	quotenbasis: Quotenbasis;
	quotenSchwelle: Schwelle | null;
	enthaltungZaehltMit: boolean;
}

/**
 * Wie sich das Mehr `a` zum Mehr `b` verhält, Hinsicht für Hinsicht.
 *
 * Die Rechnung aus `einordnungGegenGesetz`, herausgelöst am 06.10.2026, weil
 * ein zweiter Verbraucher sie braucht: der Vergleich mit dem Mehr, das die
 * Einladung nennt (`einladungsmehr.ts`). Zwei Fassungen derselben Rangfolge
 * liefen beim nächsten Nachtrag auseinander.
 *
 * `ausschlussklage` wählt die eigene Rangfolge der Kopfbasis
 * (`KOPFRANG_AUSSCHLUSSKLAGE`).
 */
export function vergleicheMasse(
	a: Mehrmasse,
	b: Mehrmasse,
	ausschlussklage: boolean
): 'gleich' | 'strenger' | 'milder' | 'gemischt' {
	/*
	 * **Ohne Köpfe ist bei den Köpfen das Mildeste** (16.11.2026), das
	 * Spiegelbild der fehlenden Quotenschwelle unten: Wer keine Kopfbedingung
	 * stellt, verlangt bei den Köpfen weniger als jede Schwelle.
	 */
	let kopf: Richtung;
	if (!a.kopfSchwelle || !b.kopfSchwelle) {
		kopf = !a.kopfSchwelle && !b.kopfSchwelle ? 0 : !a.kopfSchwelle ? -1 : 1;
	} else {
		let kopfBasis: Richtung;
		if (a.kopfbasis === b.kopfbasis) kopfBasis = 0;
		else {
			const rang = ausschlussklage ? KOPFRANG_AUSSCHLUSSKLAGE : KOPFRANG;
			const r = rang[a.kopfbasis];
			const g = rang[b.kopfbasis];
			kopfBasis = r === undefined || g === undefined ? null : r > g ? 1 : -1;
		}
		kopf = zusammen(kopfBasis, vergleicheSchwelle(a.kopfSchwelle, b.kopfSchwelle));
	}

	let quoten: Richtung;
	const aq = a.quotenSchwelle ? a.quotenbasis : 'keine';
	const bq = b.quotenSchwelle ? b.quotenbasis : 'keine';
	if (aq === 'keine' && bq === 'keine') quoten = 0;
	else if (aq === 'keine') quoten = -1;
	else if (bq === 'keine') quoten = 1;
	else {
		const basis: Richtung = aq === bq ? 0 : QUOTENRANG[aq] > QUOTENRANG[bq] ? 1 : -1;
		quoten = zusammen(basis, vergleicheSchwelle(a.quotenSchwelle!, b.quotenSchwelle!));
	}

	const enthaltung: Richtung =
		a.enthaltungZaehltMit === b.enthaltungZaehltMit ? 0 : a.enthaltungZaehltMit ? 1 : -1;

	const richtungen = [kopf, quoten, enthaltung];
	if (richtungen.some((x) => x === null)) return 'gemischt';
	if (richtungen.every((x) => x === 0)) return 'gleich';
	if (richtungen.every((x) => x !== null && x >= 0)) return 'strenger';
	if (richtungen.every((x) => x !== null && x <= 0)) return 'milder';
	return 'gemischt';
}

/**
 * Die andere Ansicht zu einer Klausel, die das Mehr für die Änderung des
 * Reglements erschwert (dieselbe Fundstelle wie die Gegenmeinung an
 * `k-reglement-eigene-schranke` in der Fassung 2026-10-18).
 */
export const KLAUSEL_GEGENMEINUNG =
	'gilt die Klausel nicht, und es genügt das qualifizierte Mehr nach Art. 712g Abs. 3 ZGB ' +
	'(Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 40 und 125; offengelassen in BGer ' +
	'5C.50/2004 E. 4.2).';

/**
 * Der Satz «umstritten» zu einer hinterlegten Klausel an «Reglement ändern,
 * gewöhnliche Bestimmung», die in jeder Hinsicht strenger ist als das Gesetz
 * (Ä-12, Befund F-4 der Fachprüfung 14.10.2026; Produktentscheid 18.10.2026,
 * `docs/entscheide/0009`), sonst `null`.
 *
 * **Warum nicht über `umstrittenSatz`.** Dort zählt nur das Erfordernis des
 * Knotens; eine angewandte Regel trägt `quelle: 'reglement'` und ihre eigenen
 * Masse, das gesetzliche Erfordernis nicht mehr. Der Aufrufer gibt es deshalb
 * mit (`gesetz`). Gerechnet wird mit der Klausel (`einordnen`); ob eine
 * Erschwerung gilt, ist umstritten (Rz. 40 und 125 ad Art. 712g; BGer
 * 5C.50/2004 E. 4.2). Bei einer gleich strengen, milderen oder gemischten
 * Klausel nicht: Die gleiche erschwert nichts, die mildere wird aus anderem
 * Grund angewandt, und bei der gemischten gilt das Gesetz.
 */
export function umstrittenBeiStrengererKlausel(
	e: Erfordernis | null | undefined,
	gesetz: Erfordernis | null | undefined
): string | null {
	if (!e || !gesetz || e.quelle !== 'reglement') return null;
	if (!mitMehrDerReglementsaenderung(e.knotenId) || gesetz.knotenId !== e.knotenId) return null;
	if (!e.kopfSchwelle || !gesetz.kopfSchwelle) return null;
	const v = vergleicheMasse(
		{
			kopfbasis: e.kopfbasis,
			kopfSchwelle: e.kopfSchwelle,
			quotenbasis: e.quotenbasis,
			quotenSchwelle: e.quotenSchwelle,
			enthaltungZaehltMit: e.enthaltungZaehltMit !== false
		},
		{
			kopfbasis: gesetz.kopfbasis,
			kopfSchwelle: gesetz.kopfSchwelle,
			quotenbasis: gesetz.quotenbasis,
			quotenSchwelle: gesetz.quotenSchwelle,
			enthaltungZaehltMit: gesetz.enthaltungZaehltMit !== false
		},
		false
	);
	return v === 'strenger' ? `${UMSTRITTEN_SATZ} Nach anderer Ansicht ${KLAUSEL_GEGENMEINUNG}` : null;
}

/** Der Knoten «Reglement ändern, gewöhnliche Bestimmung». */
export const REGLEMENT_NORMAL_KNOTEN = 'k-reglement-normal';

/**
 * Karten, die mit «demselben Mehr wie für eine Reglementsänderung» rechnen,
 * ohne den Text des Reglements zu ändern (ab Fassung 2026-11-18; Rz. 85 ad
 * Art. 712g). An ihnen gilt der Vermerk zu einer strengeren Klausel wie an
 * `k-reglement-normal` (`umstrittenBeiStrengererKlausel`).
 *
 * **Eine Regel nur für `k-reglement-normal` gilt hier nicht**, eine für die
 * ganze Art «Reglement» schon. Ein erster Fix liess die fallgenaue Regel
 * mitgreifen (Codeprüfung 15.11.2026, M4) und widersprach damit der
 * Reglementsseite, die «nur für» sagt (zweiter Durchgang, M-A); die Seite
 * bietet die beiden Karten seither als eigene Fälle an. Die Kennungen stehen
 * wörtlich hier, weil der Kern die Fassungsdaten nicht einbinden kann; die
 * Probe `tests/domain/fondsgrenze.test.ts` hält sie an der Fassung fest.
 */
export const WIE_REGLEMENTSAENDERUNG = [
	'k-erneuerungsfonds-ueber-reglement',
	'k-erneuerungsfonds-grenze-in-der-regel'
] as const;

/** `k-reglement-normal` oder eine Karte, die mit dessen Mehr rechnet. */
export function mitMehrDerReglementsaenderung(knotenId: string): boolean {
	return knotenId === REGLEMENT_NORMAL_KNOTEN || (WIE_REGLEMENTSAENDERUNG as readonly string[]).includes(knotenId);
}

/** Was `wendeReglementAn` liefert. */
export interface Regelanwendung {
	erfordernis: Erfordernis;
	regel: Reglementsregel | null;
	vorbehalt: Regelvorbehalt | null;
	/**
	 * Wie die angewandte Regel gelesen wurde, wo das nicht wörtlich geschah
	 * (seit 29.09.2026, `kopfbasisDerRegel`). Eine eigene Schnittstelle statt
	 * eines Typs in der Signatur: `check-erfordernisweg.mjs` nimmt das erste
	 * `}` am Zeilenanfang als Ende der Funktion.
	 */
	lesart?: string;
	/**
	 * Eine Regel für genau diesen Fall, die nicht angewandt wurde, weil an ihrer
	 * Stelle eine allgemeine gilt (L17 «streng», Fassung 2026-11-20): der Satz für
	 * den Vorbehalt der Karte (`fondsentnahmeVerdraengtSatz`).
	 */
	verdraengt?: string;
	/**
	 * An der Bezahlung aus dem Fonds unter L17 «streng», ab der Fassung
	 * 2026-11-21, wenn eine Regel angewandt wird: der Satz zum Häkchen
	 * (`FONDSENTNAHME_MIT_HAEKCHEN`, sonst `FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN`;
	 * Migration 197).
	 */
	fondsregel?: string;
	/**
	 * Was aus der Einstellung der Gemeinschaft zu den Enthaltungen wurde, wo sie
	 * für dieses Erfordernis in Frage kam. Fehlt das Feld, hat die Gemeinschaft
	 * keine, oder das Erfordernis ist kein einfaches Mehr der Anwesenden.
	 */
	enthaltung?: {
		fundstelle: string;
		angewandt: boolean;
		/** Für den Satz auf der Karte: Er hängt am Geschäft (Fachprüfung 07.10.2026, F1). */
		knotenId: string;
		reglementsverhalten?: Reglementsverhalten;
		/** Kein einfaches Mehr der Anwesenden: Die Einstellung trifft es gar nicht. */
		anderesMehr?: true;
		/** Ob es ein qualifiziertes Mehr ist: Nur dort lässt Rz. 192a ad Art. 712m die Klausel zu. */
		qualifiziert?: true;
		/** Fundstelle einer Regel der Geschäftsart, nach der Enthaltungen mitzählen. */
		durchRegel?: string;
	};
}

/**
 * Die Einstellung einer Gemeinschaft: Beim einfachen Mehr zählen Enthaltungen
 * nicht mit (07.10.2026, Produktentscheid «Jetzt bauen»).
 *
 * **Warum neben den Reglementsregeln und nicht als eine davon.** Eine Regel
 * gilt je Geschäftsart und ersetzt das ganze Erfordernis. Die Klausel, um die
 * es hier geht, steht im Reglement einmal für alle Abstimmungen mit einfachem
 * Mehr (Rz. 186 ad Art. 712m: «berücksichtigt man lediglich die gültig
 * abgegebenen Stimmen»), und sie ändert nur die Bezugsgrösse, nicht die
 * Schwelle. Sie als vierzehn Regeln zu erfassen hiesse, auch die Schwelle
 * vierzehnmal abzuschreiben.
 *
 * **Die Fundstelle ist Pflicht.** Die Einführung muss einstimmig sein
 * (Rz. 186 ad Art. 712m, wörtlich; BGE 143 III 537 E. 4.2.3 nennt als Fall nur
 * den Wechsel von Köpfen zu Anteilen, «Texte nach 0047», Punkt 11), ein
 * Reglement aus dem Begründungsakt erfüllt das; klar gefasst sein muss sie
 * auch (BGE 144 III 510 E. 2.2.4). Ob eine mit weniger eingeführte, nicht innert
 * Frist angefochtene Klausel trotzdem gilt, ist nicht geklärt (E. 4.2.4:
 * anfechtbar, nicht nichtig, im Fall; `KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN`).
 * Votum kann beides nicht prüfen. Die Fundstelle wandert in die
 * Rechtsgrundlage des Erfordernisses und damit ins Protokoll.
 */
export interface Enthaltungseinstellung {
	fundstelle: string;
}

/**
 * Die Einstellung aus den Angaben einer Gemeinschaft, für Stellen, die sie
 * ohnehin geladen haben. Ohne Fundstelle keine Einstellung: Die Datenbank
 * lässt das nicht zu (Migration 151), und hier wird es nicht erfunden.
 */
export function enthaltungseinstellungVon(
	g: { abstentionExcluded?: boolean; abstentionExcludedSource?: string } | null | undefined
): Enthaltungseinstellung | null {
	return g?.abstentionExcluded && g.abstentionExcludedSource
		? { fundstelle: g.abstentionExcludedSource }
		: null;
}

/** Ob eine Regel die Zustimmung aller verlangt, nach Köpfen oder Wertquoten. */
function verlangtEinstimmigkeit(regel: Reglementsregel): boolean {
	const alle = (s: Schwelle | null) => s !== null && s.zaehler === s.nenner && s.art === 'mindestens';
	return alle(regel.kopfSchwelle) || alle(regel.quotenSchwelle);
}

/**
 * Legt die Einstellung zu den Enthaltungen über ein Erfordernis, an dem keine
 * Reglementsregel gilt.
 *
 * **Nur das einfache Mehr, gemessen an den Anwesenden** (Fachprüfung
 * 07.10.2026, F5). Das qualifizierte Mehr misst das Reglement des Anlasses
 * anders, und bei einer Basis aller Eigentümer hört niemand auf, Eigentümer
 * zu sein, weil er sich enthält (dieselbe Grenze wie `enthaltungAusBasis` in
 * `auszaehlung.ts`).
 *
 * **Die genauere Regel geht vor.** Gilt für die Geschäftsart eine
 * hinterlegte Regel, rechnet sie mit ihrer eigenen Angabe zur Enthaltung.
 * Wird sie nicht angewandt (ein Vorbehalt), kommt die Einstellung zum Zug,
 * soweit der Knoten es zulässt.
 *
 * **Die gesperrten Knoten, je nach Grund** (Fachprüfung 07.10.2026, F1,
 * `quellen/pruefung/berichte/2026-10-07-votum-enthaltung-einfaches-mehr.md`).
 * Die Klausel erleichtert einen Beschluss, sie erschwert ihn nie. Ob ein
 * Reglement das an diesen Knoten darf, erörtert der Kommentar je verschieden:
 *
 *   - `gesperrt_zwingend` (Abberufung der Bewirtschaftung, Genehmigung der
 *     Wertquotenänderung): nicht angewandt. Bei der Abberufung ist «eine
 *     Verschärfung oder Erleichterung» ausgeschlossen (Rz. 64 ad Art. 712g;
 *     Donau Rz. 740, a.M. K. Müller). Bei den Wertquoten ist umstritten, ob
 *     das einfache Mehr zwingend ist (Rz. 86 f. ad Art. 712e), Votum rechnet
 *     dort vorsichtig.
 *   - `gesperrt_vereinbarung` (notwendige bauliche Massnahme bis 2026-10-14)
 *     und ab 2026-10-15 `vereinbart`: angewandt. Die
 *     Erleichterung ist umstritten, nach dem SVIT-Kommentar aber «rechtlich
 *     nicht ausgeschlossen» (Rz. 36 ad Art. 712g). Ob die Klausel so zustande
 *     kam, wie der Knoten es verlangt, ist dieselbe Frage, die beim Setzen
 *     des Hakens zu klären war. Die Karte nennt den Streit.
 *   - `gesperrt_reglement`: nicht angewandt, wie jede Reglementsbestimmung.
 *
 * Wo sie nicht greift, sagt die Karte, dass die Leitung es im Saal ansagen
 * soll (Rz. 99 ad Art. 712n): Wer sich im Glauben enthält, neutral zu
 * bleiben, wirkt dort wie ein Nein.
 *
 * **Wahlen sind mitgemeint.** Sie laufen in Votum als Ja/Nein über das
 * einfache Mehr (`k-organ-waehlen`, `k-bewirtschaftung-waehlen`), und nach
 * Rz. 184 gilt für sie dieselbe Berechnung, «unter Vorbehalt von
 * anderslautenden reglementarischen Bestimmungen». Wer sie im Reglement
 * anders behandelt, hinterlegt für die Geschäftsart eine eigene Regel.
 *
 * Die Beschlussfähigkeit berührt das nicht: Wer sich enthält, ist anwesend.
 *
 * **Und für das Mehr der anderen Lesart je für sich** (Codeprüfung Lesarten,
 * Teil 1, 20.10.2026). Die Einstellung wirkt nur beim einfachen Mehr der
 * Anwesenden. Übernähme das zweite Ergebnis die Behandlung des gewählten
 * Mehrs, rechnete es ein qualifiziertes Mehr ohne Enthaltungen, also zu mild,
 * oder ein einfaches ohne die Einstellung, zu streng. Deshalb wird das andere
 * Mehr hier mit derselben Einstellung gebildet und sein Ergebnis an
 * `gemeinschaftslesart.andere` gehängt.
 */
function mitEinstellung(
	a: Regelanwendung,
	einstellung: Enthaltungseinstellung | null,
	/**
	 * Die Wahl zu L13 (Block C), wo `wendeReglementAn` sie kennt. **Nach der
	 * Enthaltungsklausel** (Entscheid 0048, Antwort 10, «Reglement geht vor»):
	 * Wendet Votum die Klausel an, wirkt L13 nicht (`kopfzaehlweiseWirkt`);
	 * sonst setzt sie die Kopfbasis. Ohne Angabe (Wahl der Leitung,
	 * `enthaltungNachWahl`) bleibt die Kopfbasis, wie sie gewählt ist.
	 */
	zaehlweise?: Kopfzaehlweise
): Regelanwendung {
	const r = mitEinstellungOhneLesart(a, einstellung);
	const mitZaehlweise = (x: Regelanwendung): Regelanwendung =>
		zaehlweise === undefined ? x : { ...x, erfordernis: mitKopfzaehlweise(x.erfordernis, zaehlweise) };
	const l = r.erfordernis.gemeinschaftslesart;
	const andere = erfordernisNachAndererLesart(a.erfordernis);
	if (!l || !andere) return mitZaehlweise(r);
	const gebildet = mitEinstellungOhneLesart({ ...a, erfordernis: andere }, einstellung).erfordernis;
	return mitZaehlweise({
		...r,
		erfordernis: {
			...r.erfordernis,
			gemeinschaftslesart: {
				...l,
				andere: {
					...l.andere,
					rechtsgrundlage: gebildet.rechtsgrundlage,
					enthaltungZaehltMit: gebildet.enthaltungZaehltMit ?? null
				}
			}
		}
	});
}

/**
 * Die Wahl zu L13 für die Ergebniskarte (`knotenNachLesart`): Wendet Votum die
 * Enthaltungsklausel an, zählen die Anwesenden und Vertretenen ohne die
 * Enthaltungen (Antwort 10), und die Karte zeigt «Wortlaut und Rechtsprechung»
 * nach 4b, nie 4c (Endfassung Block C, Abschnitt 6). Sonst die eingestellte.
 */
export function zaehlweiseFuerKarte(angewandt: Pick<Regelanwendung, 'erfordernis'>, lesarten: Lesartenwahl): Kopfzaehlweise {
	return kopfzaehlweiseVerdraengt(angewandt.erfordernis) ? 'anwesende' : lesarten.L13;
}

function mitEinstellungOhneLesart(
	a: Regelanwendung,
	einstellung: Enthaltungseinstellung | null
): Regelanwendung {
	if (!einstellung) return a;
	const e = a.erfordernis;
	const merkmale = {
		fundstelle: einstellung.fundstelle,
		knotenId: e.knotenId,
		reglementsverhalten: e.reglementsverhalten
	};
	/*
	 * **Eine Regel der Geschäftsart geht vor, auch wenn sie nicht angewandt
	 * wird** (Codeprüfung 07.10.2026, Befund 4). Ihre Angabe zur Enthaltung ist
	 * die genauere Aussage des Reglements für diesen Fall. Sagt sie «zählt mit»,
	 * nimmt die allgemeine Einstellung die Enthaltungen nicht heraus, nur weil
	 * Votum die Regel selbst wegen eines Vorbehalts nicht anwendet.
	 */
	if (a.regel?.enthaltungZaehltMit) {
		// Die Karte sagt es trotzdem (zweiter Durchgang der Codeprüfung,
		// 07.10.2026): Wer die allgemeine Klausel kennt, erwartet sie auch hier.
		return {
			...a,
			enthaltung: { ...merkmale, angewandt: false, durchRegel: a.regel.fundstelle }
		};
	}
	if (a.regel && !a.vorbehalt) return a;
	/*
	 * **Auch wo sie nicht gilt, sagt die Karte es** (Fachprüfung 07.10.2026,
	 * Runde 2). Wer die Klausel kennt, enthält sich beim qualifizierten Mehr im
	 * Glauben, neutral zu bleiben; dort wirkt die Enthaltung wie ein Nein. Nur
	 * wo abgestimmt wird.
	 */
	if (e.typ !== 'einfaches_mehr' || e.kopfbasis !== 'anwesend_vertreten') {
		return e.typ === 'grenzfall' || e.typ === 'keine_abstimmung'
			? a
			: {
					...a,
					enthaltung: {
						...merkmale,
						angewandt: false,
						anderesMehr: true,
						...(e.typ === 'qualifiziertes_mehr' ? { qualifiziert: true as const } : {})
					}
				};
	}
	// Schon draussen, etwa aus einer früheren Anwendung: nichts doppelt anhängen.
	if (e.enthaltungZaehltMit === false) return a;

	const { fundstelle } = einstellung;
	/*
	 * **Auch nicht an der Einsprache** (`nur_verschaerfen`, ab Fassung
	 * 2026-10-20): Die Klausel erleichtert das einfache Mehr, und genau das
	 * schliesst Rz. 186 ad Art. 712c aus.
	 */
	if (
		e.reglementsverhalten === 'gesperrt_zwingend' ||
		e.reglementsverhalten === 'gesperrt_reglement' ||
		e.reglementsverhalten === 'nur_verschaerfen'
	) {
		return { ...a, enthaltung: { ...merkmale, angewandt: false } };
	}
	return {
		...a,
		erfordernis: {
			...e,
			enthaltungZaehltMit: false,
			// Leer ist sie nach einer Wahl der Leitung (`uebersteuere`); dann
			// beginnt der Satz selbst.
			rechtsgrundlage:
				(e.rechtsgrundlage ? `${e.rechtsgrundlage}; Enthaltungen` : 'Enthaltungen') +
				` nach dem Reglement der Gemeinschaft, ${fundstelle}, ausserhalb der Bezugsgrösse`
		},
		enthaltung: { ...merkmale, angewandt: true }
	};
}

/**
 * Die Einstellung nach einer Wahl der Leitung neu anlegen (07.10.2026).
 *
 * `uebersteuere` übernimmt die Felder des Vorschlags, also auch
 * `enthaltungZaehltMit`. Kam das `false` aus der Einstellung und wählt die
 * Leitung ein qualifiziertes Mehr, rechnete dieses sonst ohne Enthaltungen,
 * was die Einstellung gerade ausschliesst. Deshalb hier: das Merkmal aus der
 * Einstellung ablegen und für das gewählte Mehr neu prüfen. Ein `false` aus
 * einer Reglementsregel bleibt, wie es war.
 */
export function enthaltungNachWahl(
	gewaehlt: Erfordernis,
	vorschlag: Regelanwendung | null,
	einstellung: Enthaltungseinstellung | null
): Erfordernis {
	const ohne = vorschlag?.enthaltung?.angewandt
		? { ...gewaehlt, enthaltungZaehltMit: undefined }
		: gewaehlt;
	// Mit der Regel des Vorschlags: Ein ausdrückliches «zählt mit» aus ihr
	// bleibt so stehen wie ein «fällt aus» (Codeprüfung 07.10.2026).
	return mitEinstellung(
		{ erfordernis: ohne, regel: vorschlag?.regel ?? null, vorbehalt: vorschlag?.vorbehalt ?? null },
		einstellung
	).erfordernis;
}

/**
 * Wendet eine hinterlegte Regel auf ein hergeleitetes Erfordernis an.
 *
 * **Wie tief die Reglementserfassung geht** (offene Frage 1 des PRD, beantwortet
 * am 13.08.2026): strukturiert für **jede** der vierzehn Geschäftsarten, nicht
 * nur für die drei häufigsten — mit Kopfschwelle, Kopfbasis, Wertquotenschwelle,
 * Behandlung der Enthaltung und Pflicht-Fundstelle. Freitext gibt es zusätzlich
 * als Vermerk, nie als Ersatz: Aus einem Satz «zwei Drittel nötig» lässt sich
 * nicht zählen.
 *
 * **Die Grenze verläuft am Rechtsgrund, nicht am Ergebnistyp** (Prüfung vom
 * 15.08.2026, Befunde B-6 bis B-11). Massgebend ist das `reglementsverhalten`
 * des Knotens: `frei` wird ersetzt, `nur_mildern` nur durch eine nachweislich
 * mildere Regel, die drei Sperrgründe bleiben stehen und erklären sich je mit
 * dem eigenen Satz. Trägt das Erfordernis kein Verhalten (Fassungen bis
 * 2026-08-05), gilt die alte typbasierte Sperre — ein altes Traktandum wird
 * nachgerechnet, wie es damals gerechnet wurde.
 *
 * Unberührt bleiben in jedem Fall:
 *
 *   - **Der Grenzfall.** Er sagt nicht, dass die Schwelle offen ist, sondern
 *     dass die *Einordnung* offen ist. Eine Regel für nützliche Massnahmen
 *     darauf anzuwenden hiesse, die offene Frage stillschweigend zu beantworten.
 *   - **Die Kenntnisnahme.** Wo nicht abgestimmt wird, gibt es nichts zu ersetzen.
 *   - **Die Zustimmung Betroffener.** Sie steht neben der Mehrheit und nicht in
 *     ihr; ein Reglement, das die Mehrheit ändert, hebt sie nicht auf
 *     (ZGB Art. 712g Abs. 4 — SVIT ad 712g Rz. 211: zwingende Schutzbestimmung).
 *
 * Die frühere Fassung dieses Kommentars nannte als Einstimmigkeits-Beispiel
 * die «Änderung der Wertquoten (ZGB Art. 712e Abs. 2)» — doppelt falsch
 * (Befund B-12 der Prüfung vom 15.08.2026): Die Norm verlangt nicht die
 * Zustimmung sämtlicher, sondern der unmittelbar Beteiligten plus die
 * Genehmigung der Versammlung, und der Knoten ist Typ «einfaches Mehr», von
 * der Einstimmigkeits-Sperre also gar nicht erfasst. Seit der Fassung
 * 2026-08-15 schützt ihn sein `reglementsverhalten` (gesperrt_zwingend —
 * SVIT ad 712g Rz. 59).
 */
export function wendeReglementAn(
	erfordernis: Erfordernis,
	regeln: Reglementsregel[],
	einstellung: Enthaltungseinstellung | null,
	/**
	 * Die Lesarten der Gemeinschaft (Migration 169): vor der Freigabe aus der
	 * Gemeinschaft, danach aus der Momentaufnahme. **Pflicht und ohne
	 * Ersatzwert**, damit keine Herleitungsstelle sie vergisst; wo es keine
	 * Gemeinschaft gibt, steht `LESARTEN_VORGABE` ausdrücklich da.
	 */
	lesarten: Lesartenwahl
): Regelanwendung {
	/*
	 * **Erst die Lesart, dann die Regel.** Die Lesart sagt, was das Gesetz
	 * verlangt; eine Regel weicht davon ab, soweit ihr Verhalten es zulässt, und
	 * wird gegen das so gebildete Mehr verglichen. Ersetzt die Regel das Mehr,
	 * fällt die Lesart weg (ganz unten): Das Reglement ist eine Tatsache der
	 * Gemeinschaft und geht vor (Entscheid 0018).
	 */
	erfordernis = wendeLesartAn(erfordernis, lesarten);

	/*
	 * **Die genauere Regel schlägt die allgemeine** (22.08.2026, Befund B-02).
	 *
	 * Eine Regel gilt entweder für einen bestimmten Fall (`knotenId`) oder für
	 * alle Fälle ihrer Geschäftsart (`knotenId` leer). Bestehen beide, gewinnt
	 * die für den Fall — sonst entschiede die Reihenfolge in der Liste darüber,
	 * welches Erfordernis eine Versammlung anwendet.
	 *
	 * Warum es die Wahl überhaupt gibt: Eine Geschäftsart umfasst mehrere Fälle.
	 * Wer § 15 seines Reglements für den Erneuerungsfonds hinterlegte,
	 * verschärfte damit stillschweigend auch Jahresrechnung, Budget und Décharge.
	 */
	const passende = erfordernis.geschaeftsart
		? regeln.filter(
				(r) =>
					r.geschaeftsart === erfordernis.geschaeftsart &&
					(!r.knotenId || r.knotenId === erfordernis.knotenId)
			)
		: [];
	let regel = passende.find((r) => r.knotenId) ?? passende[0] ?? null;

	if (!regel) return mitEinstellung({ erfordernis, regel: null, vorbehalt: null }, einstellung, lesarten.L13);

	/*
	 * **Nach der strengeren Auffassung gilt eine strengere Regel, auch die
	 * allgemeine** (L17 «streng»; Produktentscheid 17.11.2026, Fachprüfung F-5).
	 * Ist die Regel für genau diesen Fall milder, schlüge sie die allgemeine
	 * sonst, und es gälte keine. Dann gilt eine allgemeine, die nicht milder
	 * ist; die fallgenaue nennt die Karte im Vorbehalt (`verdraengt`).
	 *
	 * **Nicht an der vereinbarten Verwendung** (Codeprüfung, Durchgang 3, M1):
	 * Dort rechnet die Vorgabe schon die Zustimmung aller, strenger geht keine
	 * allgemeine Regel, und der Satz zur gültigen milderen Regel widerspräche dem
	 * Satz der Karte (`FONDSENTNAHME_VEREINBART_MILDER`, Fachprüfung R2-F-3).
	 *
	 * **Eine fallgenaue Regel mit Häkchen bleibt** (Migration 197): Sie besteht
	 * `l17Regelvorbehalt` auch milder, getauscht wird dann nicht. Eine allgemeine
	 * mit Häkchen kommt ebenso als Ersatz in Frage, auch milder.
	 */
	const l17 = fondsentnahmewahl(erfordernis);
	let verdraengt: Reglementsregel | null = null;
	if (
		l17 === 'streng' &&
		erfordernis.typ !== 'einstimmigkeit' &&
		regel.knotenId &&
		l17Regelvorbehalt(l17, regel, erfordernis)
	) {
		const allgemein = passende.find(
			(r) => !r.knotenId && r.kopfSchwelle && l17Regelvorbehalt(l17, r, erfordernis) === null
		);
		if (allgemein) {
			verdraengt = regel;
			regel = allgemein;
		}
	}

	if (erfordernis.typ === 'grenzfall' || erfordernis.typ === 'keine_abstimmung') {
		return { erfordernis, regel, vorbehalt: erfordernis.typ };
	}

	const verhalten = erfordernis.reglementsverhalten;

	if (verhalten === undefined) {
		// Alte Fassung ohne Verhaltensmerkmal: die typbasierte Sperre von damals.
		if (erfordernis.typ === 'einstimmigkeit') {
			return { erfordernis, regel, vorbehalt: 'einstimmigkeit' };
		}
	} else {
		if (verhalten === 'gesperrt_zwingend') {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'zwingend' }, einstellung, lesarten.L13);
		}
		if (verhalten === 'gesperrt_vereinbarung') {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'vereinbarung' }, einstellung, lesarten.L13);
		}
		if (verhalten === 'gesperrt_reglement') {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'reglementsschranke' }, einstellung, lesarten.L13);
		}
		/*
		 * **Wo das Gesetz die Zustimmung aller verlangt, nur eine Regel für genau
		 * diesen Fall** (Laienprüfung 07.10.2026, B7). Benutzungsweise und
		 * Zweckbestimmung teilen die Geschäftsart; eine Regel «Änderung der
		 * Benutzung: zwei Drittel» für die ganze Art senkte sonst auch die
		 * Einstimmigkeit der Zweckbestimmung, was ihr eigener Rechtssatz
		 * ausschliesst.
		 *
		 * **Ebenso an der Einsprache** (`nur_verschaerfen`, ab Fassung
		 * 2026-10-20): Eine Regel für die ganze Grundordnung wirkte sonst still
		 * auf ein Mehr, das sich nicht erleichtern lässt.
		 */
		if (regelNurFallgenau(erfordernis) && !regel.knotenId) {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'nur_fallgenau' }, einstellung, lesarten.L13);
		}
		// Vor den Vergleichen, damit die Karte den eigenen Grund nennt statt
		// «strenger» oder «gemischt» (Codeprüfung Block A, N1); siehe unten.
		if (!regel.kopfSchwelle && erfordernis.typ !== 'einfaches_mehr') {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'ohne_koepfe' }, einstellung, lesarten.L13);
		}
		/*
		 * **An den Karten mit L17 entscheidet die Lesart, welche Regel gilt**
		 * (`l17Regelvorbehalt`). Nach `ohne_koepfe`, damit eine fallgenaue Regel
		 * ohne Köpfe unter der strengeren Auffassung ihren eigenen Grund nennt;
		 * unter dem SVIT-Kommentar rechnet die Karte das einfache Mehr, und
		 * `ohne_koepfe` greift dort nicht. Wurde oben auf eine allgemeine Regel
		 * getauscht, kommt keiner der beiden Vorbehalte mehr in Frage: Getauscht
		 * wird nur auf eine Regel mit Köpfen, die `l17Regelvorbehalt` schon
		 * bestanden hat. Die Prüfung hier trifft dann die getauschte und lässt sie
		 * durch.
		 */
		const l17Vorbehalt = l17Regelvorbehalt(l17, regel, erfordernis);
		if (l17Vorbehalt) {
			return mitEinstellung(
				{
					erfordernis: mitHaekchenZumSatz(erfordernis, regel, l17Vorbehalt === 'milder_nach_lesart' && erfordernis.typ === 'einstimmigkeit'),
					regel,
					vorbehalt: l17Vorbehalt
				},
				einstellung,
				lesarten.L13
			);
		}
		// Nicht an der erweiterten Bewirtschaftung (`regelNurFallgenau`, Fassung
		// 2026-10-30): Rz. 196 ad Art. 712m trifft die systematische Einführung,
		// nicht eine Klausel für genau diesen Fall (Fachprüfung A4, R4-F-1).
		if (
			verhalten === 'vereinbart' &&
			erfordernis.typ !== 'einstimmigkeit' &&
			!regelNurFallgenau(erfordernis) &&
			verlangtEinstimmigkeit(regel)
		) {
			return mitEinstellung(
				{ erfordernis, regel, vorbehalt: 'einstimmigkeit_ausgeschlossen' },
				einstellung,
				lesarten.L13
			);
		}
		if (verhalten === 'nur_mildern' && regelStrengerAlsGesetz(regel, erfordernis) !== false) {
			// Strenger ODER nicht vergleichbar: beides wird nicht angewandt. Eine
			// Regel mit anderer Bezugsgrösse als milder durchzuwinken, hiesse die
			// Milderung zu behaupten statt zu zeigen.
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'verschaerfung' }, einstellung, lesarten.L13);
		}
		/*
		 * **Nur, was in keiner Hinsicht milder ist** (`nur_verschaerfen`, ab
		 * Fassung 2026-10-20). Über `einordnungGegenGesetz`, nicht über
		 * `regelStrengerAlsGesetz`: Das nennt eine Regel schon strenger, sobald
		 * die Kopfschwelle höher liegt, auch wenn sie Enthaltungen aus der
		 * Bezugsgrösse nimmt; für ein Verhalten, das Strengeres anwendet, ist
		 * das die falsche Seite. Eine gleich strenge Regel erleichtert nichts
		 * und wird angewandt.
		 */
		if (verhalten === 'nur_verschaerfen' && einordnungGegenGesetz(regel, erfordernis) !== 'strenger') {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'milderung' }, einstellung, lesarten.L13);
		}
		if (verhalten === 'einordnen' && einordnungGegenGesetz(regel, erfordernis) === 'gemischt') {
			return mitEinstellung({ erfordernis, regel, vorbehalt: 'gemischt' }, einstellung, lesarten.L13);
		}
	}

	/*
	 * **Ohne Köpfe nur beim einfachen Mehr** (Produktentscheid 16.11.2026).
	 * Das einfache Mehr regelt das Gesetz nicht zwingend, ein Reglement darf
	 * es nach den Wertquoten allein bemessen (Rz. 186 ad Art. 712m). Wo das
	 * Gesetz Köpfe und Anteile oder alle verlangt, ist das Weglassen der Köpfe
	 * eine eigene Rechtsfrage, die Votum nicht still entscheidet. Nach den
	 * Sperren der Knoten, damit ein gesperrter Fall seinen eigenen Grund
	 * nennt. Hier noch einmal für Erfordernisse aus Fassungen ohne
	 * Reglementsverhalten; mit Verhalten greift schon die Prüfung oben.
	 */
	if (!regel.kopfSchwelle && erfordernis.typ !== 'einfaches_mehr') {
		return mitEinstellung({ erfordernis, regel, vorbehalt: 'ohne_koepfe' }, einstellung, lesarten.L13);
	}

	/*
	 * **Die Zustimmung der Betroffenen darf nicht aus der Bezugsgrösse fallen**
	 * (25.09.2026, mit einer Probe über den ganzen Weg gemessen).
	 *
	 * Die Regel ersetzt die Bezugsgrösse, die Zustimmungspflicht bringt der
	 * Knoten mit. Unter «alle ausser den Betroffenen» wäre der Betroffene
	 * zugleich aus der Basis ausgeschlossen und zur Zustimmung verpflichtet,
	 * ein Widerspruch, den für Knoten schon `pruefeRegelwerk` ausschliesst und
	 * den eine Regel hier herstellen würde. Die Sperre bleibt deshalb, auch
	 * seit `zaehleOhneWirkung` den Betroffenenbefund über **alle** Parteien
	 * führt und den Widerspruch rechnerisch sehen würde (25.09.2026, Teil C):
	 * Eine Regel, die eine unmögliche Lage herstellt, wird nicht angewandt.
	 *
	 * Geprüft nach dem Verhalten, nicht davor, damit die Fassungen ohne
	 * Reglementsverhalten (bis 2026-08-05) ebenfalls erfasst sind: Dort fiel
	 * auch die Wertquotenänderung bis hierher durch.
	 */
	if (erfordernis.zustimmungBetroffenerNoetig && regel.kopfbasis === 'alle_ausser_betroffene') {
		return mitEinstellung({ erfordernis, regel, vorbehalt: 'betroffenenzustimmung' }, einstellung, lesarten.L13);
	}

	/*
	 * **Angewandt wird die Regel so, wie sie gelesen wurde** (29.09.2026). Die
	 * umgedeutete Kopfbasis geht in das Erfordernis und in die Regel, die an
	 * die Karte weitergeht; Formel, Bezugsgrösse und Zahlenbeispiel sagen dann,
	 * was gezählt wird, und `lesart` sagt, warum das vom Wortlaut abweicht.
	 */
	const kopfbasis = kopfbasisDerRegel(regel, erfordernis);
	const gelesen = kopfbasis === regel.kopfbasis ? regel : { ...regel, kopfbasis };

	return mitEinstellung({
		erfordernis: {
			...erfordernis,
			typ: 'reglementsmehr',
			rechtsgrundlage: `Reglement der Gemeinschaft, ${regel.fundstelle}`,
			kopfbasis,
			quotenbasis: regel.quotenbasis,
			kopfSchwelle: regel.kopfSchwelle,
			quotenSchwelle: regel.quotenSchwelle,
			enthaltungZaehltMit: regel.enthaltungZaehltMit,
			quelle: 'reglement',
			fundstelle: regel.fundstelle,
			vorschlagTyp: erfordernis.typ,
			gemeinschaftslesart: undefined,
			// Die Regel des Reglements ersetzt das Mehr samt der Lesart des Beschlusses (Migration 181).
			lesartDesBeschlusses: undefined,
			/*
			 * Das Häkchen zum Satz `fondsregel` unten (Migration 198), nur an einer
			 * strengeren Regel: Sie gilt mit und ohne Häkchen, und es ändert allein
			 * den Satz (H4 statt H3). Eine mildere gilt nur mit ihm; dort ändert es
			 * das Mehr, und das gespeicherte Mehr hält es schon fest.
			 */
			regelGesichert: haekchenNurAmSatz(
				regel,
				l17 === 'streng' && fondsregelHaekchenWirkt(erfordernis) && einordnungGegenGesetz(regel, erfordernis) === 'strenger'
			)
		},
		regel: gelesen,
		vorbehalt: null,
		...(verdraengt ? { verdraengt: fondsentnahmeVerdraengtSatz(verdraengt, erfordernis.fassung) } : {}),
		/*
		 * **Der Satz zum Häkchen an der angewandten Regel** (Migration 197,
		 * Produktentscheid 17.11.2026, «Häkchen, sonst Hinweis»). Nur unter L17
		 * «streng»: Unter dem SVIT-Kommentar bleibt alles, wie es ist.
		 */
		...(l17 === 'streng' && fondsregelHaekchenWirkt(erfordernis)
			? { fondsregel: regel.gesichert ? FONDSENTNAHME_MIT_HAEKCHEN : FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN }
			: {}),
		...(gelesen === regel
			? {}
			: {
					lesart:
						erfordernis.knotenId === AUSSCHLUSSKLAGE_KNOTEN
							? LESART_ALLE_OHNE_BEKLAGTEN
							: LESART_ALLE_OHNE_BETROFFENE
				})
	}, einstellung, lesarten.L13);
}

/**
 * Ein Erfordernis, das **nur** aus einer hinterlegten Regel besteht.
 *
 * Gebraucht dort, wo der Entscheidbaum gar nicht hinführt und es deshalb kein
 * gesetzliches Erfordernis gibt, an das die Regel anknüpfen könnte — heute allein
 * beim Rückkommen (`domain/rueckkommen.ts`). Für alles andere gilt weiterhin
 * `wendeReglementAn`: Dort ersetzt die Regel ein hergeleitetes Erfordernis, und
 * das Ersetzte muss sichtbar bleiben.
 */
export function erfordernisAusRegel(regel: Reglementsregel): Erfordernis {
	return {
		fassung: `reglement-${regel.geschaeftsart}`,
		// Wie jede Regel dieser Anwendung: nicht juristisch gegengelesen. Der
		// Vermerk hängt am Erfordernis und wandert mit ihm ins Protokoll.
		juristischGegengelesen: false,
		astId: 'a-reglement',
		knotenId: `k-reglement-${regel.geschaeftsart}`,
		typ: 'reglementsmehr',
		/*
		 * **Der Fall, nicht das Mehr** (Probe Wertquotenmehr, 17.11.2026): Bis
		 * dahin stand hier `regelInWorten`, und im Protokoll las man «hergeleitet
		 * als ‹mehr als die Hälfte der anwesenden oder vertretenen Wertquoten …›»
		 * neben demselben Mehr; die Karte trug den Satz zweimal. Der Titel nennt
		 * wie bei jedem Knoten den Fall, das Mehr steht im Erfordernis.
		 */
		titel: GESCHAEFTSARTEN.find((g) => g.art === regel.geschaeftsart)?.bezeichnung ?? regelInWorten(regel),
		rechtsgrundlage: `Reglement der Gemeinschaft, ${regel.fundstelle}`,
		kopfbasis: regel.kopfbasis,
		quotenbasis: regel.quotenbasis,
		kopfSchwelle: regel.kopfSchwelle,
		quotenSchwelle: regel.quotenSchwelle,
		geschaeftsart: regel.geschaeftsart,
		enthaltungZaehltMit: regel.enthaltungZaehltMit,
		zustimmungBetroffenerNoetig: false,
		pfad: [
			{
				frageId: 'f-reglement',
				frageText: 'Woher kommt das Erfordernis?',
				antwortId: 'a-reglement',
				antwortText: `Aus dem Reglement der Gemeinschaft, ${regel.fundstelle}`
			}
		],
		quelle: 'reglement',
		fundstelle: regel.fundstelle
	};
}

/**
 * Was eine Regel dieser Geschäftsart erreichen würde — der Satz auf der
 * Erfassungsseite (15.08.2026).
 *
 * **Aus der Fassung gerechnet, nicht in der Seite behauptet.** Bis zum
 * 15.08.2026 stand die Reichweite als fester Text für zwei Geschäftsarten in
 * der Seite; mit dem Reglementsverhalten je Knoten stimmte er doppelt nicht
 * mehr (bei `grundordnung` greift eine Regel inzwischen nirgends, bei `organe`
 * nicht mehr überall). Wer die Regel erfasst, soll wissen, was sie bewirkt —
 * und zwar das, was die geltende Fassung wirklich tut.
 *
 * `null` heisst: Die Regel greift überall, kein Satz nötig.
 */
export function regelReichweite(
	rw: Regelwerk,
	art: Geschaeftsart,
	/** Die Lesarten der Gemeinschaft; ohne sie die Vorgabe (L17 «streng»). */
	lesarten: Lesartenwahl = LESARTEN_VORGABE
): string | null {
	const knoten = rw.knoten.filter(
		(k) => k.geschaeftsart === art && k.typ !== 'grenzfall' && k.typ !== 'keine_abstimmung'
	);
	if (knoten.length === 0) return null;
	const nurFallgenau = (k: (typeof knoten)[number]) => regelNurFallgenauNachLesart(k, lesarten);
	// Die Karten mit L17 (ab Fassung 2026-11-20): Was eine Regel dort bewirkt, hängt an der Wahl.
	const fondsentnahme = knoten.filter((k) => k.lesart?.kennung === 'L17');

	const titel = (liste: typeof knoten) => liste.map((k) => `«${k.titel}»`).join(' und ');
	// Die Sperre nach der strengeren Lesart zählt nicht «nach dem Gesetz» (Ä-12,
	// zweite Codeprüfung 3e): eigener Satz, wie auf der Karte.
	const nachLehre = knoten.filter(sperreNachLehre);
	const zwingend = knoten.filter(
		(k) => k.reglementsverhalten === 'gesperrt_zwingend' && !sperreNachLehre(k)
	);
	/*
	 * Die Bezahlung ausserhalb des Zwecks (ab Fassung 2026-11-20) trägt
	 * `gesperrt_vereinbarung`, aber dort ist nichts umstritten: Nach beiden
	 * Auffassungen braucht es die Zustimmung aller. Eigener Satz; die Kennung
	 * steht wörtlich hier wie in `regelNurFallgenau`, weil der Kern die
	 * Fassungsdaten nicht einbinden kann.
	 */
	const ausserhalbDesZwecks = knoten.filter((k) => k.id === FONDSENTNAHME_AUSSERHALB_KNOTEN);
	const vereinbarung = knoten.filter(
		(k) => k.reglementsverhalten === 'gesperrt_vereinbarung' && k.id !== FONDSENTNAHME_AUSSERHALB_KNOTEN
	);
	const vereinbart = knoten.filter((k) => k.reglementsverhalten === 'vereinbart');
	const schranke = knoten.filter((k) => k.reglementsverhalten === 'gesperrt_reglement');
	const mildern = knoten.filter((k) => k.reglementsverhalten === 'nur_mildern');
	const verschaerfen = knoten.filter((k) => k.reglementsverhalten === 'nur_verschaerfen');
	const einordnen = knoten.filter((k) => k.reglementsverhalten === 'einordnen');

	const saetze: string[] = [];
	// «Nirgends» heisst: kein Knoten der Art nimmt eine Regel automatisch an —
	// weder frei noch als Milderung. Das gilt auch, wenn die Gründe gemischt
	// sind (Grundordnung: vier zwingende Knoten plus der Verkauf, der nur einer
	// einstimmig vereinbarten Ordnung folgt).
	const frei = knoten.filter(
		(k) => k.reglementsverhalten === 'frei' || k.reglementsverhalten === undefined
	);
	// Über `regelKannGreifen`, nicht über eine eigene Aufzählung (Codeprüfung
	// Runde 2, N4): Ein neues Verhalten machte den Satz sonst still falsch.
	if (!knoten.some((k) => regelKannGreifen(k.reglementsverhalten))) {
		saetze.push(
			'Eine Regel für diese Geschäftsart wird zurzeit nirgends angewandt; sie steht als ' +
				'Vermerk auf der Ergebniskarte.'
		);
	} else if (!knoten.some((k) => regelKannGreifen(k.reglementsverhalten) && !nurFallgenau(k))) {
		// Nur Fälle, die eine eigens hinterlegte Regel verlangen (Grundordnung mit
		// der Einsprache, ab Fassung 2026-10-20; Codeprüfung N3): Eine Regel für
		// alle Geschäfte der Art greift weiterhin nirgends.
		// Mit dem Namen der Art (Laien- und Fachprüfung Runde 2, 19.10.2026).
		const name = GESCHAEFTSARTEN.find((g) => g.art === art)?.bezeichnung ?? art;
		saetze.push(
			`Eine Regel für alle Geschäfte der Art «${name}» wird zurzeit nirgends angewandt; sie steht ` +
				'als Vermerk auf der Ergebniskarte.'
		);
	}
	if (zwingend.length > 0) {
		/*
		 * **Nicht «zwingend» als Rechtsaussage** (Codeprüfung Runde 3, M1): An
		 * der Wertquotenänderung ist die Erleichterung nach dem Rechtssatz
		 * nicht geklärt, nicht ausgeschlossen. Gesagt wird, was das Werkzeug tut.
		 */
		saetze.push(
			`Bei ${titel(zwingend)} wendet dieses Werkzeug keine Regel an; gezählt wird nach dem ` +
				'Gesetz, und die Karte nennt den Grund.'
		);
	}
	if (nachLehre.length > 0) {
		saetze.push(
			`Bei ${titel(nachLehre)} wendet dieses Werkzeug keine Regel an; gezählt wird nach der ` +
				'strengeren Lesart, und die Karte nennt den Grund.'
		);
	}
	if (vereinbarung.length > 0) {
		saetze.push(
			/*
			 * **Kein «nicht automatisch» mehr** (Codeprüfung Runde 2, M2): Es
			 * unterstellte einen Weg von Hand. Ab 2026-10-15 tragen das Verhalten
			 * luxuriöse Massnahme und Verkauf, und dort ist umstritten, ob eine
			 * andere Ordnung überhaupt gilt (Fachprüfung Runde 2, B7). Ab 2026-11-20
			 * auch die Bezahlung aus dem Fonds ausserhalb des Zwecks; sie hat oben
			 * einen eigenen Satz und fehlt in dieser Liste.
			 */
			`Bei ${titel(vereinbarung)} wird Ihre Regel nicht angewandt, weil umstritten ist, ob ` +
				'eine andere Ordnung dort gilt; gezählt wird nach dem Gesetz. Die Karte nennt, was der ' +
				'Kommentar dazu sagt.'
		);
	}
	if (ausserhalbDesZwecks.length > 0) {
		saetze.push(`Bei ${titel(ausserhalbDesZwecks)} ${REICHWEITE_FONDSENTNAHME_AUSSERHALB}`);
	}
	if (vereinbart.length > 0) {
		saetze.push(
			`Bei ${titel(vereinbart)} ist Ihre Regel nur rechtmässig, wenn alle Eigentümer ihr ` +
				'zugestimmt haben oder sie im Begründungsakt steht. Dieses Werkzeug wendet sie dort an, ' +
				'kann das aber nicht prüfen; halten Sie in der Fundstelle fest, wie sie eingeführt ' +
				'wurde.' +
				/*
				 * **Die Ausnahme nur, wo sie gilt** (Codeprüfung Runde 3, N1): An der
				 * Zweckbestimmung verlangt das Gesetz selbst die Zustimmung aller,
				 * und `wendeReglementAn` prüft dort nicht auf Einstimmigkeit.
				 */
				(vereinbart.some((k) => k.typ !== 'einstimmigkeit' && !regelNurFallgenau(k))
					? ` Verlangt sie bei ${titel(vereinbart.filter((k) => k.typ !== 'einstimmigkeit' && !regelNurFallgenau(k)))} ` +
						'die Zustimmung aller, wendet es sie dort nicht an.'
					: '') +
				// An `regelNurFallgenau`, nicht am Typ: Seit der Fassung 2026-10-30
				// gilt das auch an der erweiterten Bewirtschaftung (Codeprüfung A4, S2).
				(vereinbart.some((k) => regelNurFallgenau(k))
					? ` Bei ${titel(vereinbart.filter((k) => regelNurFallgenau(k)))} wendet es ` +
						'nur eine Regel an, die Sie für genau diesen Fall hinterlegen.'
					: '')
		);
	}
	if (schranke.length > 0) {
		saetze.push(
			`Bei ${titel(schranke)} wird eine abweichende Reglementsbestimmung nicht angewandt: ` +
				'Ob sie trägt, ist umstritten; gerechnet wird nach dem Erfordernis der jeweiligen Karte.'
		);
	}
	if (mildern.length > 0) {
		saetze.push(
			/*
			 * Dritter Träger derselben Aussage (Code-Review 23.09.2026, M-3).
			 *
			 * **Und beim ersten Anlauf derselbe Fehler wie an den anderen Orten**
			 * (Gegenprüfung, S1): «nur angewandt, wenn sie milder ist» schliesst die
			 * gleich strenge Regel aus, die sehr wohl angewandt wird, und verspricht
			 * die mildere mit anderer Bezugsgrösse, die es nicht wird. Auch als
			 * notwendige Bedingung gelesen bleibt der Satz falsch.
			 */
			`Bei ${titel(mildern)} wird Ihre Regel nur angewandt, wenn sie nachweislich nicht ` +
				'strenger ist als das Gesetz; eine strengere und eine mit anderer Bezugsgrösse ' +
				'setzt das Werkzeug dort nicht durch. Rechtmässig ist sie auch dort nur, wenn alle ' +
				'Eigentümer ihr zugestimmt haben oder sie im Begründungsakt steht.'
		);
	}
	if (verschaerfen.length > 0) {
		saetze.push(
			// Spiegelbild des Satzes zu `nur_mildern` (ab Fassung 2026-10-20).
			`Bei ${titel(verschaerfen)} wird nur eine Regel angewandt, die Sie für genau diesen Fall ` +
				'hinterlegen. Sie muss mit dem Einspracherecht oder später von allen Eigentümern schriftlich ' +
				'vereinbart und in keiner Hinsicht milder sein als das Gesetz. Eine mildere und eine nicht ' +
				'vergleichbare wendet das Werkzeug dort nicht an.'
		);
	}
	if (fondsentnahme.length > 0) {
		saetze.push(
			`Bei ${titel(fondsentnahme)} ${lesarten.L17 === 'svit' ? REICHWEITE_FONDSENTNAHME_SVIT : REICHWEITE_FONDSENTNAHME_STRENG}`
		);
	}
	if (einordnen.length > 0) {
		saetze.push(
			`Bei ${titel(einordnen)} wird Ihre Regel angewandt, wenn sie in jeder Hinsicht ` +
				'strenger oder in jeder Hinsicht milder ist als das Gesetz. Lässt sie sich nicht so ' +
				'einordnen, rechnet das Werkzeug dort nach dem Gesetz und nennt Ihre Regel dazu, ohne nach ' +
				'ihr zu rechnen.'
		);
	}
	if (saetze.length === 0) return null;
	return saetze.join(' ');
}

/** Die Karte der Bezahlung aus dem Fonds ausserhalb des Zwecks (Fassung 2026-11-20). */
const FONDSENTNAHME_AUSSERHALB_KNOTEN = 'k-erneuerungsfonds-entnahme-ausserhalb';

/** Der Satz der Reichweite an dieser Karte, hinter «Bei «…»» (Rz. 139 ad Art. 712l). */
export const REICHWEITE_FONDSENTNAHME_AUSSERHALB =
	'wird Ihre Regel nicht angewandt: Ausserhalb des Zwecks braucht die Bezahlung aus dem Fonds nach beiden ' +
	'Auffassungen die Zustimmung aller (SVIT-Kommentar Rz. 139 ad Art. 712l).';

/** Der Satz der Reichweite an den Karten mit L17 nach der strengeren Auffassung, hinter «Bei «…»». */
export const REICHWEITE_FONDSENTNAHME_STRENG =
	'wird Ihre Regel nur angewandt, wenn sie in keiner Hinsicht milder ist als das gerechnete Mehr. Das gilt ' +
	'auch für eine Regel, die alle Geschäfte dieser Geschäftsart erfasst. So ist es für Ihre Gemeinschaft auf der ' +
	'Seite «Lesarten» eingestellt (strengere Auffassung).';

/** Derselbe Satz nach dem SVIT-Kommentar. */
export const REICHWEITE_FONDSENTNAHME_SVIT =
	'wird nur eine Regel angewandt, die Sie für genau diesen Fall hinterlegen, milder wie strenger. So ist es ' +
	'für Ihre Gemeinschaft auf der Seite «Lesarten» eingestellt (Auffassung des SVIT-Kommentars).';

/**
 * Ob an diesem Knoten nur eine Regel für genau diesen Fall greift, mit der Wahl
 * der Gemeinschaft zu L17: An den Karten mit L17 nach dem SVIT-Kommentar ja
 * (`wendeReglementAn`), sonst wie `regelNurFallgenau`. Für Reglementsseite und
 * Reichweite; die Anwendung selbst liest die Wahl am Erfordernis.
 */
export function regelNurFallgenauNachLesart(
	k: Parameters<typeof regelNurFallgenau>[0] & { lesart?: { kennung: string } },
	lesarten: Pick<Lesartenwahl, 'L17'>
): boolean {
	return regelNurFallgenau(k) || (k.lesart?.kennung === 'L17' && l17NurFallgenau(lesarten.L17));
}

/**
 * Ob an den Karten mit L17 nach dieser Wahl nur eine Regel für genau diesen
 * Fall gilt: nach dem SVIT-Kommentar ja. Danach genügt das einfache Mehr nach
 * Köpfen (Rz. 139 ad Art. 712l), und Votum behandelt die Bezahlung nicht als
 * wichtigere Verwaltungshandlung; eine Regel für die ganze Geschäftsart
 * `verwaltung_wichtig` trifft sie dann nicht. Die eine Stelle für Anwendung
 * (`l17Regelvorbehalt`), Reglementsseite und Reichweite
 * (`regelNurFallgenauNachLesart`).
 */
function l17NurFallgenau(wahl: Fondsentnahmewahl | undefined): boolean {
	return wahl === 'svit';
}

/**
 * Warum eine Regel an einer Karte mit L17 nicht gilt, oder `null`, wenn die
 * Lesart sie zulässt (Fassung 2026-11-20, Produktentscheid 17.11.2026):
 *
 *  - nach dem SVIT-Kommentar nur eine Regel für genau diesen Fall, milder wie
 *    strenger (`l17NurFallgenau`), sonst `nur_fallgenau`;
 *  - nach der strengeren Auffassung nur eine, die in keiner Hinsicht milder ist
 *    als das gerechnete Mehr, über denselben Vergleich wie `nur_verschaerfen`,
 *    sonst `milder_nach_lesart`. Eine mildere trägt dort nur, wenn sie im
 *    Begründungsakt steht oder alle zugestimmt haben (Art. 712g Abs. 2; Rz. 27
 *    und 78a ad Art. 712g), und das kann Votum nicht prüfen;
 *  - ab der Fassung 2026-11-21 an der Bezahlung im gewöhnlichen Zweck eine Regel
 *    mit Häkchen, ob milder oder strenger (Migration 197; Produktentscheid
 *    17.11.2026, «Häkchen, sonst Hinweis»). Die Leitung hält damit fest, was
 *    Votum nicht prüfen kann. Nicht an der vereinbarten Verwendung: Dort trägt
 *    auch eine Regel im Begründungsakt nicht sicher (Rz. 138 ad Art. 712l, a.M.
 *    Bloch; `FONDSENTNAHME_VEREINBART_MILDER`).
 */
function l17Regelvorbehalt(
	wahl: Fondsentnahmewahl | undefined,
	regel: Reglementsregel,
	gerechnet: Erfordernis
): Regelvorbehalt | null {
	if (l17NurFallgenau(wahl)) return regel.knotenId ? null : 'nur_fallgenau';
	if (wahl === 'streng' && regel.gesichert && fondsregelHaekchenWirkt(gerechnet)) return null;
	if (wahl === 'streng' && einordnungGegenGesetz(regel, gerechnet) !== 'strenger') return 'milder_nach_lesart';
	return null;
}

/**
 * Nach welcher Regel ein Erfordernis an einer Karte mit L17 rechnet, als ihre
 * Fundstelle, oder `null` ohne Regel oder an einer anderen Karte (Codeprüfung
 * L17, A). An diesen Karten entscheidet die Wahl, welche Regel gilt: Nach einer
 * Umstellung kann dieselbe Regel wegfallen oder eine andere gelten, auch wenn
 * das Mehr gleich bleibt. Unter einer Regel speichert das Traktandum keine
 * Lesart, deshalb vergleichen Freigabe (`veralteteLesartenIn`) und Kasten
 * «Erfordernisse nachziehen» (`veralteteErfordernisseIn`) dies, beide über
 * diese Funktion. **Nicht dieselbe Bedingung, aber eine enthaltene:** Die
 * Freigabe vergleicht nur diesen Wert; der Kasten vergleicht ihn neben dem
 * ganzen Mehr. Jedes Traktandum, zu dem die Freigabe absagt, zeigt der Kasten
 * also auch; die Absage nennt nie einen Weg, den es nicht gibt. Seit
 * Migration 197 prüft die Freigabe auch Traktanden dieser Karten, die nach dem
 * Gesetz rechnen: Mit dem Häkchen kann dort eine Regel neu gelten.
 *
 * **Seit Migration 198 auch das Häkchen, wo es nur den Satz ändert**
 * (`regelGesichert`; Entscheid des Auftraggebers vom 18.11.2026, «Auch Häkchen
 * einfrieren»): Die Freigabe friert das gespeicherte Erfordernis ein und mit ihm
 * den Satz an der Karte. Wechselt das Häkchen vorher, stimmte der eingefrorene
 * Satz nicht mehr; das Traktandum gilt deshalb als veraltet, auch bei gleichem
 * Mehr. Verglichen wird es nur, wo das gespeicherte Erfordernis einer Fassung
 * mit Häkchen angehört (`haekchenSeit`, die Fassung des gespeicherten): Ein
 * Traktandum der Fassung 2026-11-20 trägt keinen solchen Satz, und das neu
 * hergeleitete der geltenden Fassung erschiene sonst an jeder Regel veraltet.
 * Beide Seiten bekommen deshalb dieselbe Fassung. Ohne sie bleibt es beim Wert
 * bis Migration 197; so vergleicht `wendeReglementAnNachFreigabe`, ob eine
 * Herleitung auf derselben Regel steht.
 */
export function l17Regelstand(
	knotenMitL17: boolean,
	e: { quelle?: string | null; fundstelle?: string | null; regelGesichert?: boolean | null },
	haekchenSeit?: string | null
): string | null {
	const regel = knotenMitL17 && e.quelle === 'reglement' ? (e.fundstelle ?? '') : null;
	const haekchen =
		knotenMitL17 && haekchenFassung(haekchenSeit ?? undefined) && typeof e.regelGesichert === 'boolean'
			? e.regelGesichert
			: null;
	return haekchen === null ? regel : `${regel ?? ''}|Häkchen ${haekchen ? 'gesetzt' : 'nicht gesetzt'}`;
}

/**
 * Beide Seiten des Vergleichs in Freigabe und Kasten «nachziehen»
 * (`l17Regelstand`), mit der Fassung des gespeicherten Erfordernisses.
 *
 * **Das Häkchen zählt nur, wo am neu hergeleiteten ein Satz daran hängt**
 * (`regelGesichert` gesetzt). Nach einer Umstellung von L17 auf «svit» hängt
 * keiner mehr daran; das gespeicherte Häkchen ist dann ohne Wirkung, und das
 * Traktandum wäre sonst veraltet, obwohl dieselbe Regel nach beiden Wahlen gilt
 * (`tests/db/lesart-fondsentnahme.test.ts`). In die andere Richtung zählt es:
 * Trägt das gespeicherte noch keines (hergeleitet unter «svit» oder vor
 * Migration 198), das neue aber eines, ist das Traktandum veraltet, damit die
 * Freigabe den Satz einfriert, den die Karte zeigt.
 */
export function l17Regelstaende(
	knotenMitL17: boolean,
	gespeichert: { quelle?: string | null; fundstelle?: string | null; regelGesichert?: boolean | null },
	neu: { quelle?: string | null; fundstelle?: string | null; regelGesichert?: boolean | null },
	haekchenSeit: string | null | undefined
): { bisher: string | null; jetzt: string | null } {
	const zaehlt = typeof neu.regelGesichert === 'boolean';
	return {
		bisher: l17Regelstand(knotenMitL17, zaehlt ? gespeichert : { ...gespeichert, regelGesichert: null }, haekchenSeit),
		jetzt: l17Regelstand(knotenMitL17, neu, haekchenSeit)
	};
}

/**
 * **Nach der Freigabe der Satz von damals** (Migration 198; Entscheid des
 * Auftraggebers vom 18.11.2026, gewählte Antwort «Auch Häkchen einfrieren»:
 * «Das Häkchen kommt beim Freigeben in die Momentaufnahme, und die Karte zeigt
 * danach den damaligen Satz.»).
 *
 * Eingefroren ist das Häkchen am gespeicherten Erfordernis des Traktandums
 * (`regelGesichert`), nicht in `snapshot`: Dort steht keine Regel, und was eine
 * Regel am Traktandum bewirkt, hält das Traktandum (Migration 198, Begründung
 * dort). Wer nach der Freigabe am Traktandum herleitet, auf der
 * Erfordernisseite oder im Kasten «nachziehen», bekommt deshalb die Regel mit
 * diesem Häkchen, wenn alles zutrifft:
 *
 *  - das gespeicherte Erfordernis trägt ein solches Häkchen, das neu hergeleitete
 *    auch, und sie unterscheiden sich;
 *  - beide stehen auf derselben Karte und derselben Regel (`l17Regelstand` ohne
 *    Häkchen), und die Regel kann das Häkchen tragen (`haekchenMoeglich`).
 *
 * **Was «dieselbe Regel» hier heisst** (Codeprüfung des Einfrierens, N2): Im
 * Zweck rechnet das Traktandum nach der Regel und trägt ihre Fundstelle; der
 * Vergleich über `l17Regelstand` trifft sie. An der vereinbarten Verwendung
 * rechnet es nach dem Gesetz, und `l17Regelstand` ist auf beiden Seiten `null`.
 * Tragen kann das Häkchen dort nur die Regel für alle wichtigeren
 * Verwaltungshandlungen (`haekchenMoeglich`), und davon gibt es je Gemeinschaft
 * eine (eindeutig nach Geschäftsart und Fall, Migration 076, `ON CONFLICT` in
 * `erstelleReglementsregel`). Nicht unterschieden wird eine solche Regel, die nach
 * der Freigabe gelöscht und neu hinterlegt wurde: Sie bekommt das Häkchen von
 * damals (Pendenz «Häkchen eingefroren, Restpunkte»).
 *
 * **Wo es nicht greift** (N4): Ein Traktandum, das nach der Freigabe entsteht
 * (Folgeantrag, Aufnahme im Saal, Geschäft des Abends) oder auf eine andere
 * Karte wechselt, hat kein gespeichertes Häkchen dieser Karte und bekommt das
 * von heute.
 *
 * Das Mehr bleibt dabei dasselbe: `regelGesichert` gibt es nur, wo das Häkchen
 * allein den Satz ändert, an einer strengeren Regel im Zweck (sie gilt mit und
 * ohne) und an der vereinbarten Verwendung (dort gilt keine). Wo das Häkchen das
 * Mehr ändert, eine mildere Regel im Zweck, kommt es weiter aus der Regel: Der
 * Weg, den die Karte dafür nennt (`FONDSENTNAHME_WEG_HAEKCHEN`, bis zur Eröffnung
 * neu herleiten), bleibt offen, und das gespeicherte Mehr ist ohnehin fest.
 *
 * Vor der Freigabe übergibt der Aufrufer kein gespeichertes Erfordernis, und es
 * gilt das Häkchen der Gemeinschaft.
 */
export function wendeReglementAnNachFreigabe(
	erfordernis: Erfordernis,
	regeln: Reglementsregel[],
	einstellung: Enthaltungseinstellung | null,
	lesarten: Lesartenwahl,
	gespeichert: Pick<Erfordernis, 'knotenId' | 'quelle' | 'fundstelle' | 'regelGesichert'> | null
): Regelanwendung {
	const live = wendeReglementAn(erfordernis, regeln, einstellung, lesarten);
	const damals = gespeichert?.regelGesichert;
	const jetzt = live.erfordernis.regelGesichert;
	if (damals === undefined || jetzt === undefined || damals === jetzt || !gespeichert || !live.regel) return live;
	if (gespeichert.knotenId !== live.erfordernis.knotenId) return live;
	if (l17Regelstand(true, gespeichert) !== l17Regelstand(true, live.erfordernis)) return live;
	const id = live.regel.id;
	const ziel = regeln.find((r) => r.id === id);
	if (!ziel || !haekchenMoeglich(ziel)) return live;
	return wendeReglementAn(
		erfordernis,
		regeln.map((r) => (r === ziel ? { ...r, gesichert: damals } : r)),
		einstellung,
		lesarten
	);
}

/**
 * Was gilt und was die Leitung tut, wenn eine mildere Regel an der Bezahlung aus
 * dem Fonds nach der strengeren Auffassung trotzdem gilt (Laien- und
 * Fachprüfung Runde 2 bis 5: R2-F-6, R3-F-1, R4-F-1 bis R4-F-4, R4-L-1,
 * R5-L-1, R5-F-1, R5-F-5). Ein Wortlaut für `FONDSENTNAHME_MILDER` und
 * `FONDSENTNAHME_VERDRAENGT`; zuerst die Bedingung und was sonst gilt, dann die
 * Schritte unter der Bedingung. Bis zur Fassung 2026-11-20; ab 2026-11-21 steht
 * an seiner Stelle `FONDSENTNAHME_WEG_HAEKCHEN` (`fondsentnahmeWeg`).
 */
export const FONDSENTNAHME_WEG_GUELTIG =
	'Steht Ihre Regel in der ursprünglichen Fassung des Begründungsakts oder haben ihr alle Eigentümer ' +
	'zugestimmt, gilt sie auch nach der strengeren Auffassung. Sonst wird nach dem Erfordernis dieser Karte ' +
	'ausgezählt. Gilt Ihre Regel, zählt Votum trotzdem nach dieser Karte. ' +
	// Ab der Fassung 2026-11-21 dieselben Schritte für den Fall nach der Freigabe (`FONDSENTNAHME_WEG_HAEKCHEN`).
	wegSchritte() +
	// Runde 6 (R6-L-1): die Umstellung mit Namen und warum sie hier nicht der Weg ist.
	'Die Lesart L17 auf den SVIT-Kommentar umzustellen, braucht es dafür nicht; es senkte auch das Mehr ohne Regel.';

/**
 * Die Schritte bei einer gültigen milderen Regel, wenn Votum nach der Karte
 * zählt: «Anderes Erfordernis setzen» oder der Notweg, Angaben im Protokoll.
 * Ein Wortlaut für `FONDSENTNAHME_WEG_GUELTIG` (Fassung 2026-11-20) und den Weg
 * nach der Freigabe ab 2026-11-21 (Auftraggeber 17.11.2026: der bisherige Weg
 * bleibt für den Fall nach der Freigabe erhalten). Eine Funktion statt einer
 * Konstanten, weil `FONDSENTNAHME_WEG_GUELTIG` davor steht.
 */
function wegSchritte(): string {
	return (
		'Lässt sich ihr Mehr unter «Anderes ' +
		'Erfordernis setzen» wählen, etwa das einfache Mehr, setzen Sie es dort vor dem Versand der Einladung. Sonst ' +
		'sagen Sie vor der Abstimmung an, dass nach Ihrer Regel ausgezählt wird. Halten Sie das Ergebnis dann mit ' +
		'«Beschluss von Hand festhalten» fest, mit dem Grund «Notweg»; die Warnung zum Notweg betrifft Sie dabei ' +
		'nicht. In beiden Fällen schreiben Sie auf der Seite «Protokoll» beim Traktandum die Bestimmung, die Köpfe ' +
		'und die Wertquoten dazu. Legen Sie den Beleg bereit, dass die Regel in der ursprünglichen Fassung des ' +
		'Begründungsakts steht oder alle Eigentümer ihr zugestimmt haben. '
	);
}

/**
 * H5, der Weg bei einer milderen Regel ohne Häkchen ab der Fassung 2026-11-21,
 * nach Runde 3 des Entwurfs (`quellen/pruefung/zu-pruefen-2026-11-17-votum-widerruf-und-fondsregel-runde3.md`,
 * Stelle E): zuerst Bedingung und was sonst gilt (Laien L-15), dann das Häkchen
 * vor der Freigabe (L-13), das Nachziehen im Kasten und nach dem Versand die
 * berichtigte Einladung (L2-6; Fachprüfung Runde 2, Frage 6: so in der Anwendung
 * gebaut), dann der bisherige Weg (Fach F-6; Auftraggeber 17.11.2026: der Notweg
 * bleibt).
 */
export const FONDSENTNAHME_WEG_HAEKCHEN =
	'Steht Ihre Regel in der ursprünglichen Fassung des Begründungsakts oder haben ihr alle Eigentümer ' +
	'zugestimmt, gilt sie auch nach der strengeren Auffassung. Sonst wird nach dem Erfordernis dieser Karte ' +
	'ausgezählt. Trifft die Bedingung zu, setzen Sie auf der Seite «Reglement» an der Regel das Häkchen dafür, vor ' +
	// Runde 3 (F3-2): der Knopf, wie er auf der Seite steht (`ErfordernisseNachziehen.svelte`).
	'der Freigabe der Einladung. Ein bestehendes Traktandum leiten Sie danach auf derselben Seite mit «Erfordernis ' +
	'neu herleiten» neu her; Votum zählt dann nach Ihrer Regel. Ist die Einladung schon freigegeben, zählt Votum ' +
	'für diese Versammlung nach dieser Karte, bis Sie das Traktandum so neu herleiten. Ist sie auch schon ' +
	'verschickt, kündigen Sie das geänderte Mehr mit einer berichtigten Einladung an alle nach. Nach dem letzten ' +
	'Tag dafür sagt Votum das Neuherleiten nach der Vorgabe ab. Ist sie noch nicht verschickt, können Sie das Mehr ' +
	'Ihrer Regel auch unter «Anderes Erfordernis setzen» wählen, wenn es sich dort wählen lässt, etwa das einfache ' +
	'Mehr. Bleibt es bei dieser Karte, sagen Sie vor der Abstimmung an, dass nach Ihrer Regel ausgezählt wird. ' +
	'Halten Sie das Ergebnis dann mit «Beschluss von Hand festhalten» fest, mit dem Grund «Notweg»; die Warnung ' +
	'zum Notweg betrifft Sie dabei nicht. In jedem dieser Fälle schreiben Sie auf der Seite «Protokoll» beim ' +
	'Traktandum die Bestimmung, die Köpfe und die Wertquoten dazu. Legen Sie den Beleg bereit, dass die Regel in ' +
	'der ursprünglichen Fassung des Begründungsakts steht oder alle Eigentümer ihr zugestimmt haben. Die Lesart ' +
	'L17 auf den SVIT-Kommentar umzustellen, braucht es dafür nicht; es senkte auch das Mehr ohne Regel.';

/** Der Weg bei einer milderen Regel ohne Häkchen, nach der Fassung des Erfordernisses. */
function fondsentnahmeWeg(fassung: string | undefined): string {
	return fondsregelHaekchenWirkt({ knotenId: FONDSENTNAHME_KNOTEN, fassung })
		? FONDSENTNAHME_WEG_HAEKCHEN
		: FONDSENTNAHME_WEG_GUELTIG;
}

/**
 * H3, an der Karte im gewöhnlichen Zweck, wenn eine strengere Regel ohne
 * Häkchen angewandt wird (R5-F-2; ZGB Art. 712g Abs. 2, Rz. 35 und 78a ad
 * Art. 712g). Runde 3, Stelle C1: Bedingung und Häkchen zuerst (Laien L-12),
 * der Zeitpunkt (L-13), was eine Anfechtung bringt (Fach F-8) und ab wann die
 * Frist läuft (F2-6), was ohne Beleg bleibt (L2-8).
 */
export const FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN =
	'Nach der strengeren Auffassung gilt auch eine strengere Regel nur sicher, wenn sie in der ursprünglichen ' +
	'Fassung des Begründungsakts steht oder ihr alle zugestimmt haben. So sagen es ZGB Art. 712g ' +
	'Abs. 2 und der SVIT-Kommentar (Rz. 35 und 78a ad Art. 712g). Trifft das zu, setzen Sie auf der Seite ' +
	'«Reglement» das Häkchen an der Regel, vor der Freigabe der Einladung; ein Antrag, der an Ihrer Regel scheitert, ' +
	'ist dann richtig abgelehnt. Sonst rechnet Votum trotzdem nach Ihrer Regel, denn ein Beschluss, der sie ' +
	'erreicht, erreicht auch das Mehr dieser Karte. Erreicht ein Antrag das Mehr dieser Karte, aber nicht das Ihrer ' +
	'Regel, kann seine Ablehnung angefochten werden. Halten Sie dann im Protokoll fest, dass er das Mehr dieser ' +
	'Karte erreicht hätte. Wer der Ablehnung nicht zugestimmt hat, kann sie innert eines Monats ab Kenntnis ' +
	'anfechten. Ob das Gericht dann nur die Ablehnung aufhebt oder den Antrag als angenommen feststellt, ist nicht ' +
	'sicher (SVIT-Kommentar Rz. 234 und 235a ad Art. 712m). Oft schneller ist es, den Beleg zu suchen und an der ' +
	'nächsten Versammlung neu abzustimmen. Findet sich keiner, ist offen, ob Ihre Regel gilt; halten Sie dann bei ' +
	'jeder solchen Ablehnung im Protokoll fest, dass der Antrag das Mehr dieser Karte erreicht hätte.';

/** H4, an der Karte im gewöhnlichen Zweck, wenn eine Regel mit Häkchen angewandt wird (Runde 3, Stelle C2; L2-7). */
export const FONDSENTNAHME_MIT_HAEKCHEN =
	'Sie haben angegeben, dass Ihre Regel in der ursprünglichen Fassung des Begründungsakts steht oder alle ' +
	'Eigentümer ihr zugestimmt haben. Dann gilt sie auch nach der strengeren Auffassung, ob sie milder oder ' +
	'strenger ist als das Gesetz (ZGB Art. 712g Abs. 2). Legen Sie den Beleg dafür bereit. Stimmt die Angabe ' +
	'nicht, ist ein Beschluss, der nur nach Ihrer Regel zustande kam, anfechtbar. Bei einer strengeren Regel gilt ' +
	'das für die Ablehnung eines Antrags, der das Mehr dieser Karte erreicht; halten Sie das dann im Protokoll fest.';

/**
 * An der vereinbarten Verwendung, wenn die Regel das Häkchen trägt: Es wirkt
 * dort nicht (Fachprüfung F-5; Auftraggeber 17.11.2026; Rz. 138, 139 ad
 * Art. 712l). Ersetzt `FONDSENTNAHME_VEREINBART_MILDER` ab der Fassung
 * 2026-11-21, mit dessen Weg über L17 (Runde 3, Stelle C3; F2-5, L2-9).
 */
export const FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN =
	'Sie haben angegeben, dass Ihre Regel in der ursprünglichen Fassung des Begründungsakts steht oder alle ' +
	'Eigentümer ihr zugestimmt haben. Nach dem SVIT-Kommentar gilt sie dann (Rz. 138 und 139 ad Art. 712l). Nach ' +
	'der strengeren Auffassung ist diese Verwendung trotzdem nur mit der Zustimmung aller sicher; ein anderer Autor ' +
	'hält sie auch dann für unzulässig (Rz. 138 ad Art. 712l). Votum zählt deshalb nach dem Erfordernis dieser ' +
	'Karte. Folgt Ihre Gemeinschaft dem SVIT-Kommentar, stellen Sie die Lesart L17 auf der Seite «Lesarten» um. Das ' +
	'senkt auch jede andere Bezahlung aus dem Fonds ohne eigene Regel auf das einfache Mehr nach Köpfen. Sicher ' +
	'bleibt auch dann nur die Zustimmung aller.';

/** H1, die Beschriftung des Häkchens auf der Seite «Reglement» (unverändert seit Runde 1). */
export const FONDSREGEL_HAEKCHEN_BESCHRIFTUNG =
	'Steht in der ursprünglichen Fassung des Begründungsakts oder hat die Zustimmung aller Eigentümer';

/**
 * H2, die Hilfe darunter (Runde 3, Stelle D): was als Begründungsakt, auch nach
 * einer Revision (Fach F2-2), Zustimmung aller und Beleg zählt (F-7, Laien L-8,
 * L-11), der Zeitpunkt (L-13), nur unter der strengeren Auffassung und im
 * gewöhnlichen Zweck (L-10, F-5), die Folge eines falschen Häkchens (L-9).
 */
export const FONDSREGEL_HAEKCHEN_HILFE =
	'Nur ankreuzen, wenn das zutrifft und Sie es belegen können. Zum Begründungsakt gehört ein Reglement, das bei ' +
	'der Begründung als sein Bestandteil erlassen wurde, mit seinem damaligen Inhalt. Hat eine spätere Revision ' +
	'eine Regel inhaltlich unverändert übernommen, zählt sie weiter; legen Sie dann beide Fassungen bereit. Eine ' +
	'Regel, die eine spätere Versammlung mit Mehrheit neu eingeführt oder inhaltlich geändert hat, zählt nicht. ' +
	'Die Zustimmung aller heisst: alle, die damals Eigentümer waren, auch die abwesenden; wer seither gekauft hat, ' +
	'ist daran gebunden (ZGB Art. 712g Abs. 2, 649a Abs. 1). Als Beleg taugen die Urkunde der Begründung oder ein ' +
	'Protokoll oder Zirkularbeschluss, aus dem die Zustimmung jedes Eigentümers hervorgeht. «Einstimmig» der ' +
	'Anwesenden genügt nicht, wenn nicht alle anwesend oder vertreten waren. Setzen Sie das Häkchen vor der ' +
	'Freigabe der Einladung. Votum wendet die Regel dann bei der Bezahlung aus dem Erneuerungsfonds im ' +
	'gewöhnlichen Zweck an, auch wenn sie milder ist als das Gesetz, sofern sie die Köpfe zählt. So rechnet Votum, wenn die strengere ' +
	'Auffassung (Lesart L17) eingestellt ist. Ist das Häkchen zu Unrecht gesetzt, rechnet Votum ein Mehr, das ' +
	// Fachprüfung des Einfrierens F-2, Runde 2 F2-2 (Laien L2-1), im Wortlaut der Fachprüfung: Nach der
	// Freigabe rechnet ein Traktandum unter einer milderen Regel weiter nach ihr, auch wenn das Häkchen
	// fällt; an einer strengeren bleibt das Mehr, und der Kasten bietet nichts an.
	'nicht gilt, und der Beschluss ist anfechtbar. Entfernen Sie es nach der Freigabe an einer milderen Regel, ' +
	'leiten Sie das Traktandum vor der Eröffnung im Kasten neu her. An einer strengeren Regel halten Sie dann ' +
	'bei einer Ablehnung, die nur an ihr scheitert, im Protokoll fest, dass der Antrag das Mehr der Karte ' +
	'erreicht hätte. An anderen Geschäften ändert das Häkchen nichts.';

/** Der Satz zur fallgenauen Regel, an deren Stelle eine strengere allgemeine gilt (L17 «streng»). */
export const FONDSENTNAHME_VERDRAENGT =
	// Runde 5 (R5-F-1, R5-F-2, R5-L-3) und Codeprüfung, Durchgang 2, N2: auch nicht einzuordnen; die Ausnahme
	// mit dem Weg; «gerechnet», weil auch die allgemeine Regel nur nach Art. 712g Abs. 2 gesichert ist.
	'Sie wird nicht angewandt, weil sie in mindestens einer Hinsicht milder ist als das gerechnete Mehr oder sich ' +
	'nicht eindeutig einordnen lässt. Gerechnet wird deshalb nach der strengeren Regel für alle wichtigeren ' +
	'Verwaltungshandlungen. ' +
	FONDSENTNAHME_WEG_GUELTIG;

/** Der Kopf von `FONDSENTNAHME_VERDRAENGT` ohne den Weg; ab 2026-11-21 folgt der Weg mit Häkchen. */
const FONDSENTNAHME_VERDRAENGT_KOPF = FONDSENTNAHME_VERDRAENGT.slice(0, -FONDSENTNAHME_WEG_GUELTIG.length);

function fondsentnahmeVerdraengtSatz(r: Reglementsregel, fassung: string | undefined): string {
	return (
		`Für genau diesen Fall ist zudem eine Regel hinterlegt (${r.fundstelle}): ${regelInWorten(r)} ` +
		FONDSENTNAHME_VERDRAENGT_KOPF +
		fondsentnahmeWeg(fassung)
	);
}

/**
 * **Worauf eine Regel dieser Geschäftsart angewandt wird** — beim Namen genannt.
 *
 * **Der Anlass, 22.08.2026.** Im Prüflauf hinterlegte jemand § 15 des
 * Reglements: «Die Erhöhung des Erneuerungsfondsbeitrags um mehr als 20 %
 * bedarf der Zustimmung von zwei Dritteln.» Eine Klausel über **einen** Fall.
 * Zugeordnet wird sie aber über die Geschäftsart, und «Jahresgeschäfte» trägt
 * fünf Fälle — Protokollgenehmigung, Jahresrechnung, Budget, Erneuerungsfonds
 * und Décharge. Alle fünf standen danach auf zwei Dritteln.
 *
 * Gemerkt hat das niemand: `regelReichweite` gibt hier `null` zurück, weil die
 * Regel überall greift, und «überall» hiess bis dahin: kein Satz. Das Budget
 * wäre mit 3:2 als abgelehnt aus der Versammlung gegangen.
 *
 * **Diese Funktion behebt die Zuordnung nicht** — dafür bräuchte die Regel eine
 * zweite Achse. Sie nimmt ihr die Stummheit: Wer die Regel erfasst, liest, was
 * er damit alles verschärft, und kann es abwählen, bevor jemand darauf abstimmt.
 */
export function regelGiltFuer(rw: Regelwerk, art: Geschaeftsart): string[] {
	return rw.knoten
		.filter(
			(k) =>
				k.geschaeftsart === art &&
				k.typ !== 'grenzfall' &&
				k.typ !== 'keine_abstimmung' &&
				regelKannGreifen(k.reglementsverhalten)
		)
		.map((k) => k.titel);
}

/**
 * Worauf eine Regel **ohne Köpfe** dieser Geschäftsart angewandt wird
 * (Codeprüfung Block A, N2): nur die Fälle mit einfachem Mehr, an denen eine
 * Regel frei oder als Vereinbarung greift. Wo das Gesetz mehr verlangt, gilt
 * der Vorbehalt `ohne_koepfe`; an `einordnen` und `nur_verschaerfen` ist sie
 * nicht vergleichbar oder milder und greift ebenfalls nicht.
 */
export function regelOhneKoepfeGiltFuer(
	rw: Regelwerk,
	art: Geschaeftsart,
	knotenId?: string | null,
	/**
	 * Die Lesarten der Gemeinschaft; ohne sie die Vorgabe. Gefragt ist das Mehr,
	 * das der Knoten nach ihrer Wahl rechnet: Unter L17 «svit» rechnen die Karten
	 * zur Bezahlung aus dem Fonds das einfache Mehr, und eine fallgenaue Regel
	 * ohne Köpfe gilt dort.
	 */
	lesarten: Lesartenwahl = LESARTEN_VORGABE
): string[] {
	/*
	 * **Das Rückkommen hat keinen Knoten** (Laienprüfung Runde 2, R2-L4). Eine
	 * Regel dafür gilt nach `erfordernisFuerRueckkommen`: beim abgelehnten
	 * Antrag ohne Vorbehalt, beim angenommenen Beschluss, wenn sie nicht milder
	 * ist als dessen Mehr.
	 */
	if (art === 'rueckkommen') {
		return [
			'Rückkommen auf einen abgelehnten Antrag',
			'Rückkommen auf einen angenommenen Beschluss, wenn sie nicht milder ist als dessen Mehr'
		];
	}
	return rw.knoten
		.filter(
			(k) =>
				k.geschaeftsart === art &&
				(!knotenId || k.id === knotenId) &&
				knotenNachLesart(rw, k, lesarten).typ === 'einfaches_mehr' &&
				(k.reglementsverhalten === undefined ||
					k.reglementsverhalten === 'frei' ||
					k.reglementsverhalten === 'vereinbart') &&
				(knotenId || !regelNurFallgenauNachLesart(k, lesarten))
		)
		.map((k) => k.titel);
}

/** Die Regel in einem Satz, wie sie auf der Ergebniskarte steht. */
export function regelInWorten(regel: Reglementsregel): string {
	if (!regel.kopfSchwelle) {
		// `pruefeReglementsregel` lässt eine Regel ohne Köpfe nur mit Quotenschwelle zu.
		const q = regel.quotenSchwelle!;
		const basis =
			regel.quotenbasis === 'alle_quoten' ? 'aller Wertquoten' : 'der anwesenden oder vertretenen Wertquoten';
		return `${schwelleInWorten(q)} ${basis}, ${UNABHAENGIG_VON_KOEPFEN}.`;
	}
	const kopf = `${schwelleInWorten(regel.kopfSchwelle)} ${basisWort(regel.kopfbasis)}`;
	const quoten = regel.quotenSchwelle
		? ` und zugleich ${schwelleInWorten(regel.quotenSchwelle)} ${basisWort(regel.quotenbasis)} Wertquoten`
		: '';
	return `${kopf}${quoten}.`;
}

/**
 * Die Bezugsgrösse als vollständige Wendung — **mit ihrem Artikel**.
 *
 * Vorher lieferte sie teils mit Artikel («aller Eigentümer»), teils ohne
 * («anwesenden und vertretenen Stimmen»), und der Aufrufer setzte immer «der»
 * davor. Heraus kam «alle Stimmen **der aller** Eigentümer» — in beiden Zeilen
 * der Reglementstabelle, monatelang (gefunden in der Nachprüfung 23.08.2026).
 *
 * Wer den Artikel dem Aufrufer überlässt, muss ihn für jeden Fall gleich
 * brauchen können. Das geht im Deutschen nicht: «der Anwesenden» und «aller
 * Eigentümer» stehen in verschiedenen Fällen.
 */
function basisWort(basis: Kopfbasis | Quotenbasis): string {
	switch (basis) {
		case 'anwesend_vertreten':
			// «oder» (Produktentscheid 08.10.2026), wie in `weisungsregel.ts`.
			return 'der anwesenden oder vertretenen Stimmen';
		case 'alle_eigentuemer':
			return 'aller Eigentümer';
		case 'alle_ausser_betroffene':
			return 'aller Eigentümer ausser den unmittelbar Betroffenen';
		case 'alle_quoten':
			return 'der gesamten';
		case 'keine':
			return '—';
	}
}

/**
 * Ergänzt die Ergebniskarte um die angewandte oder bloss vorhandene Regel.
 *
 * Der Reglementsvorbehalt wird dabei ersetzt, nicht ergänzt: «Prüfen Sie zuerst
 * Ihr Reglement» neben einer angewandten Reglementsregel wäre widersprüchlich.
 */
/**
 * Der Vorbehalt an einer Karte mit L17 unter der strengeren Auffassung, hinter
 * dem Satz zur hinterlegten Regel (`milder_nach_lesart`; Produktentscheid
 * 17.11.2026; ZGB Art. 712g Abs. 2 mit Rz. 27 und 78a ad Art. 712g).
 */
export const FONDSENTNAHME_MILDER =
	'Sie wird hier nicht angewandt, weil sie in mindestens einer Hinsicht milder ist als das gerechnete Mehr oder ' +
	'sich nicht eindeutig einordnen lässt. Nach der strengeren Auffassung gilt eine mildere Regel nur, wenn sie ' +
	'im Begründungsakt steht oder alle Eigentümer zugestimmt haben (ZGB Art. 712g Abs. 2; Rz. 27, 78a ad ' +
	'Art. 712g). Milder ist etwa eine Regel, die nur die Anwesenden zählt oder die Wertquoten weglässt. ' +
	// Fachprüfung Runde 2, R2-F-6, und Laienprüfung R2-L-3: der Weg bei einer gültigen milderen Regel;
	// ein Vermerk an der Regel ist Pendenz (Produktentscheid 17.11.2026).
	// Runde 3 (R3-F-1, R3-L-2): ein Ergebnis, über den bestehenden Notweg; «alle Eigentümer»
	// nach Rz. 78, 79 ad Art. 712g.
	// Runde 4: R4-F-1 bis R4-F-4, R4-L-1.
	FONDSENTNAHME_WEG_GUELTIG +
	' ' +
	EINWAND_IM_SAAL;

/** Der Kopf von `FONDSENTNAHME_MILDER` ohne Weg und Einwand; ab 2026-11-21 folgt der Weg mit Häkchen. */
const FONDSENTNAHME_MILDER_KOPF = FONDSENTNAHME_MILDER.slice(
	0,
	-(FONDSENTNAHME_WEG_GUELTIG.length + 1 + EINWAND_IM_SAAL.length)
);

// Die beiden Köpfe schneiden den Weg ab; trägt einer ihn nicht mehr am Ende, stimmte der Schnitt nicht.
if (
	!FONDSENTNAHME_MILDER.endsWith(`${FONDSENTNAHME_WEG_GUELTIG} ${EINWAND_IM_SAAL}`) ||
	!FONDSENTNAHME_VERDRAENGT.endsWith(FONDSENTNAHME_WEG_GUELTIG)
) {
	throw new Error('FONDSENTNAHME_MILDER oder FONDSENTNAHME_VERDRAENGT endet nicht mit dem Weg.');
}

/** `FONDSENTNAHME_MILDER` nach der Fassung des Erfordernisses. */
function fondsentnahmeMilder(fassung: string | undefined): string {
	return `${FONDSENTNAHME_MILDER_KOPF}${fondsentnahmeWeg(fassung)} ${EINWAND_IM_SAAL}`;
}

/**
 * Der Vorbehalt an der vereinbarten Verwendung unter der strengeren Auffassung
 * (`milder_nach_lesart`; Fachprüfung R2-F-3; Rz. 138 ad Art. 712l).
 */
export const FONDSENTNAHME_VEREINBART_MILDER =
	'Sie wird hier nicht angewandt, weil sie milder ist als die Zustimmung aller. Nach der strengeren Auffassung ' +
	// Der Strichpunkt des vorgegebenen Wortlauts ist ein Punkt: Der Satz hielte sonst die
	// Grenze von 180 Zeichen nicht (`check:texte`).
	'ist diese Verwendung nur mit der Zustimmung aller sicher, auch wenn Ihre Regel im Begründungsakt steht. Ein ' +
	// Runde 5 (R5-F-3): Bloch lässt die Verwendung gar nicht zu; (R5-F-4, R5-L-2) die Reichweite der Umstellung.
	// Runde 6 (R6-L-2): der Bezug von «auch dann»; (R6-F-1) nur ohne eigene Regel (Rz. 139 ad Art. 712l).
	'anderer Autor hält sie auch mit einer Regel im Begründungsakt für unzulässig (SVIT-Kommentar Rz. 138 ad ' +
	'Art. 712l). Folgt Ihre Gemeinschaft dem SVIT-Kommentar, stellen Sie die Lesart L17 auf der Seite «Lesarten» ' +
	'um. Das senkt auch jede andere Bezahlung aus dem Fonds ohne eigene Regel auf das einfache Mehr nach Köpfen. ' +
	'Sicher bleibt auch dann nur die Zustimmung aller. Sonst wird nach dem Erfordernis dieser Karte ausgezählt. ' +
	EINWAND_IM_SAAL;

/**
 * Der Vorbehalt an einer Karte mit L17 nach dem SVIT-Kommentar, wenn die Regel
 * für alle wichtigeren Verwaltungshandlungen gilt (`nur_fallgenau`; Rz. 139 ad
 * Art. 712l). Nicht der Satz der Zweckbestimmung, nicht der der erweiterten
 * Bewirtschaftung.
 */
export const FONDSENTNAHME_NUR_FALLGENAU =
	'Sie wird hier nicht angewandt, weil sie nicht eigens für die Bezahlung aus dem Erneuerungsfonds hinterlegt ' +
	'ist. Für Ihre Gemeinschaft ist die Auffassung des SVIT-Kommentars eingestellt. Danach genügt das einfache ' +
	// Fachprüfung Runde 2, R2-F-5: Rz. 139 sagt das Mehr, nicht die Einordnung.
	'Mehr nach Köpfen (Rz. 139 ad Art. 712l). Votum behandelt die Bezahlung deshalb nicht als wichtigere ' +
	'Verwaltungshandlung und wendet eine Regel für diese hier nicht an. ' +
	// Laienprüfung R2-L-4: was «eigens» heisst.
	'Eigens ist eine Bestimmung, die die Bezahlung aus dem Fonds nennt, etwa «Entnahmen aus dem Erneuerungsfonds ' +
	'mit zwei Dritteln». Eine allgemeine Regel für grosse Ausgaben ist es in der Regel nicht; sie betrifft den ' +
	// Runde 5 (R5-F-6): Auslegung, nicht gesichert.
	'Beschluss über die Arbeit. Sagen Reglement oder ' +
	'Errichtungsbeschluss es eigens, hinterlegen Sie diese Bestimmung für genau diesen Fall, vor dem Versand der ' +
	// Laienprüfung R2-L-5: die Handlung in den Worten der Anwendung.
	'Einladung. Für ein bestehendes Traktandum leiten Sie danach auf der Reglementseite das Erfordernis neu her ' +
	'und kündigen das geänderte Mehr nach. Ausgezählt wird nach dem Erfordernis dieser Karte.';

/** Warum die hinterlegte Regel danebensteht statt zu gelten — je Grund ein Satz. */
function vorbehaltInWorten(
	vorbehalt: Regelvorbehalt,
	regel: Reglementsregel,
	/** Der Rechtssatz des Knotens (ab Fassung 2026-10-15), wo er einen hat. */
	recht?: string,
	/** Gesperrt nach der strengeren Lesart, nicht als zwingendes Recht (Ä-12). */
	nachLehre?: boolean,
	/** Das Verhalten des Knotens, wo ein Vorbehalt je Verhalten anders lautet (ab 2026-10-20). */
	verhalten?: Reglementsverhalten,
	/** Der Typ des Erfordernisses, wo `nur_fallgenau` je Typ anders lautet (ab 2026-10-30). */
	typ?: Ergebnistyp,
	/** Die Fassung des Erfordernisses, wo der Satz zum Einwand ab 2026-11-11 anders lautet. */
	fassung?: string,
	/** Ob die Karte die Lesart L17 trägt (Bezahlung aus dem Erneuerungsfonds, ab 2026-11-20). */
	fondsentnahme?: boolean
): string {
	const kopf =
		`Für diese Geschäftsart ist eine Reglementsregel hinterlegt (${regel.fundstelle}): ` +
		`${regelInWorten(regel)} `;

	switch (vorbehalt) {
		case 'einstimmigkeit':
			// Der alte typbasierte Satz — erscheint nur noch bei Erfordernissen aus
			// Fassungen bis 2026-08-05, die kein Reglementsverhalten tragen.
			return (
				kopf +
				'Sie wird hier nicht angewandt: Wo das Gesetz die Zustimmung sämtlicher ' +
				'Stockwerkeigentümer verlangt, lässt sie sich nicht durch ein Mehr ersetzen. Halten ' +
				'Sie die Regel trotzdem für einschlägig, ist das eine Rechtsfrage und kein ' +
				'Zählfehler — sie gehört vor der Versammlung geklärt, nicht im Saal.'
			);

		case 'zwingend':
			if (nachLehre && !recht) {
				return (
					`${kopf}Sie wird hier nicht angewandt. Ob ein Reglement hier ein anderes Mehr ` +
					'vorsehen kann, ist nicht geklärt; gerechnet wird die strengere Lesart. ' +
					EINWAND_IM_SAAL
				);
			}
			if (recht) {
				return (
					`${kopf}Sie wird hier nicht angewandt. ${recht} Ausgezählt wird nach dem Gesetz. ` +
					EINWAND_IM_SAAL
				);
			}
			return (
				kopf +
				'Sie wird hier nicht angewandt: Dieses Erfordernis ist zwingendes Recht; eine ' +
				'abweichende Reglementsbestimmung wäre unbeachtlich. Halten Sie die Regel trotzdem ' +
				'für einschlägig, ist das eine Rechtsfrage und kein Zählfehler — sie gehört vor der ' +
				'Versammlung geklärt, nicht im Saal.'
			);

		case 'vereinbarung':
			/*
			 * **Kein «dürfen Sie nach ihr auszählen» mehr** (Laien- und
			 * Fachprüfung 07.10.2026). Einen Weg dazu gab es nicht: Von Hand wählbar
			 * sind nur einfaches und qualifiziertes Mehr und Einstimmigkeit.
			 *
			 * **Zwei Fälle, am Rechtssatz unterschieden** (Fach- und Codeprüfung
			 * nach dem Bau, 07.10.2026). Ab 2026-10-15 tragen diesen Vorbehalt die
			 * luxuriöse Massnahme und der Verkauf, die gesperrt bleiben; sie haben
			 * einen Rechtssatz, und an ihnen hilft kein Nachziehen. Ohne Rechtssatz
			 * ist es ein Traktandum aus einer älteren Fassung, und dort nennt der
			 * Satz den Weg, den es jetzt gibt.
			 */
			if (recht) {
				return (
					`${kopf}Sie wird hier nicht angewandt. ${recht} Ausgezählt wird nach dem Gesetz. ` +
					EINWAND_IM_SAAL
				);
			}
			return (
				kopf +
				'Sie wird hier nicht automatisch angewandt: Das Gesetz lässt eine andere Ordnung nur ' +
				'zu, wenn sie einstimmig oder im Begründungsakt vereinbart wurde — und ob Ihre ' +
				'Reglementsbestimmung so zustande kam, kann diese Anwendung nicht prüfen. Seit der ' +
				'Fassung 2026-10-15 wendet sie eine solche Regel an; ein Traktandum aus einer älteren ' +
				'Fassung ziehen Sie dafür auf der Reglementsseite nach.'
			);

		case 'einstimmigkeit_ausgeschlossen':
			/*
			 * **Ohne den Rechtssatz der Karte** (Fachprüfung nach dem Bau, A4 und
			 * A5): Er schliesst an mehreren Karten mit «gilt sie wohl trotzdem», und
			 * das bezöge sich hier auf die eben verworfene Einstimmigkeitsklausel.
			 * Und nicht kategorisch: Der SVIT-Kommentar hält die Einstimmigkeit
			 * hier für unzulässig (Rz. 125 ad Art. 712a, Rz. 37 ad Art. 712g, in der
			 * Regel Rz. 196 ad Art. 712m), anders etwa LGVE 2011 I Nr. 10.
			 */
			return (
				kopf +
				'Sie wird hier nicht angewandt: Nach dem SVIT-Kommentar darf ein Reglement bei ' +
				'diesem Geschäft die Zustimmung aller nicht oder nur ausnahmsweise verlangen. ' +
				'Ausgezählt wird nach dem Gesetz. Wird Ihre Bestimmung im Saal eingewendet, halten ' +
				'Sie den Einwand im Protokoll fest. Stimmen nicht alle zu, ist der Beschluss ' +
				`angreifbar; ist die Sache nicht dringlich, vollziehen Sie ihn ${NACH_DER_ANFECHTUNGSFRIST}`
			);

		case 'nur_fallgenau':
			// An der Einsprache (ab Fassung 2026-10-20) ist es nicht die
			// Zustimmung aller, sondern ein Mehr, das sich nur verschärfen lässt.
			// An den Karten mit L17 unter dem SVIT-Kommentar (ab Fassung 2026-11-20):
			// Der Satz zur Zweckbestimmung und der zur erweiterten Bewirtschaftung
			// wären dort falsch. Vor den Zweigen nach Verhalten, weil die Karte `frei`
			// trägt und `vereinbart` an ihr nie stand.
			if (fondsentnahme) return kopf + FONDSENTNAHME_NUR_FALLGENAU;
			if (verhalten === 'nur_verschaerfen') {
				return (
					kopf +
					'Sie wird hier nicht angewandt, weil sie nicht eigens für die Einsprache hinterlegt ist. ' +
					'Ein strengeres Mehr, das alle vereinbart haben, hinterlegen Sie auf der Reglementsseite ' +
					'für genau diesen Fall, vor dem Versand der Einladung. Ausgezählt wird nach dem Gesetz.'
				);
			}
			// An der erweiterten Bewirtschaftung (ab Fassung 2026-10-30) verlangt das
			// Gesetz nicht die Zustimmung aller; der Satz zur Zweckbestimmung wäre
			// dort falsch (Codeprüfung A4, S1).
			// Ohne `typ` nicht hierher (Codeprüfung Prüfschritt A4, Durchgang 2, N4):
			// Sonst bekäme ein Aufrufer ohne Typ an der Zweckbestimmung diesen Satz.
			if (verhalten === 'vereinbart' && typ !== undefined && typ !== 'einstimmigkeit') {
				return (
					kopf +
					'Sie wird hier nicht angewandt, weil sie nicht eigens für diesen Fall hinterlegt ist: Eine ' +
					'Regel für die Organe oder für Wahlen erfasst diese Erweiterung im Zweifel nicht. Wie sie ' +
					// Ab 2026-11-11 mit dem Zweck: Im Saal hängt das Einhalten an der
					// Einführung (Laienprüfung E2, L-18).
					(einwandStrengerAb(fassung)
						? 'eingeführt wurde, brauchen Sie für das Zählen nach dem Gesetz nicht nachzuforschen. Meint sie diese '
						: 'eingeführt wurde, brauchen Sie dafür nicht nachzuforschen. Meint sie diese ') +
					'Erweiterung klar mit, hinterlegen Sie sie vor dem Versand der Einladung für genau diesen Fall; ' +
					'ein bestehendes Traktandum ziehen Sie danach nach. ' +
					// Prüfrunde 7 (R7-F-8, R7-L-7): die Begründung, die die Anwendung kennt,
					// und die Ansage auch dann, wenn niemand mehr weiss, wie gezählt wurde.
					'Sagen Sie an, dass diesmal nach dem Gesetz gezählt wird, weil die Regel diese Erweiterung ' +
					'nicht klar nennt, auch wenn Sie nicht wissen, wie bisher gezählt wurde. Tun Sie das schon in der ' +
					'Einladung, spätestens vor der Abstimmung, und halten Sie es im Protokoll fest. ' +
					// Was heute gilt, vor dem Rechtssatz (Prüfrunde 9, R9-L-1). Prüfrunde 6
					// (R6-F-5): wer widerspricht, kündigt meist eine Klage an.
					'Ausgezählt wird nach dem Gesetz. ' +
					/*
					 * Ab 2026-11-11 steht der Saal im eigenen Abschnitt der Karte, mit
					 * derselben Satzlogik wie an den übrigen Karten (`einwandImSaal`,
					 * Gegenstand «erweiterung»; Auftrag E2, R7-F-8, Fachprüfung E2,
					 * F-11). Der Vollzug nach der Frist und das Nachrechnen stehen dort.
					 */
					(einwandStrengerAb(fassung)
						? 'Wird im Saal eingewendet, diese Regel oder eine andere Bestimmung betreffe auch diese ' +
							'Erweiterung, lesen Sie den Abschnitt «Wird im Saal eine Bestimmung eingewendet». ' +
							(recht ? `Der folgende Rechtssatz betrifft nur eine Regel, die Sie für genau diesen Fall hinterlegen. ${recht}` : '')
						: `${EINWAND_IM_SAAL} ` +
					'Den Beschluss vollziehen Sie dann, wo es ' +
					// Prüfrunde 7 (R7-L-5): sicher ist, was nach Gesetz und nach der
					// eingewendeten Bestimmung besteht (wie die Website, `SICHER`).
					'nicht eilt, erst nach Ablauf der Anfechtungsfrist, ausser er erreicht auch die eingewendete ' +
					// Prüfrunde 8 (R8-F-5): nach dem Wortlaut, nicht nach dem Gedächtnis;
					// Prüfrunde 9 (R9-L-2): im Zweifel warten.
					'Bestimmung nach ihrem Wortlaut im Reglement. Halten Sie dann im Protokoll fest, dass und mit ' +
					'welchen Zahlen er sie erreicht. Können Sie das nicht sicher nachrechnen, warten Sie die Frist ab.' +
					// Prüfrunde 8 (R8-L-4): Der Rechtssatz rät auch, die Frist der Einführung
					// abzuwarten; das betrifft nur eine hinterlegte Regel.
					(recht ? ` Der folgende Rechtssatz betrifft nur eine Regel, die Sie für genau diesen Fall hinterlegen. ${recht}` : ''))
				);
			}
			return (
				kopf +
				'Sie wird hier nicht angewandt: Sie gilt für die ganze Geschäftsart, und bei der ' +
				'Zweckbestimmung verlangt das Gesetz die Zustimmung aller. Eine Abweichung davon ' +
				'wendet dieses Werkzeug nur an, wenn Ihr Reglement die Zweckbestimmung selbst regelt ' +
				'und Sie diese Bestimmung auf der Reglementsseite für genau diesen Fall hinterlegen, ' +
				'vor dem Versand der Einladung; ein bestehendes Traktandum ziehen Sie danach nach. ' +
				(recht ? `${recht} ` : '') +
				'Ausgezählt wird nach dem Gesetz.'
			);

		case 'reglementsschranke':
			return (
				kopf +
				'Sie wird hier nicht angewandt: Gerechnet wird nach dem Erfordernis dieser Karte. Ob ' +
				'eine abweichende Reglementsbestimmung hier gleichwohl trägt, ist umstritten und eine ' +
				'Rechtsfrage der Gemeinschaftsordnung, keine Frage der Auszählung.'
			);

		case 'verschaerfung':
			/*
			 * **Dieser Satz ersetzt den Reglementskasten, er ergänzt ihn nicht**
			 * (`karteMitReglement` weiter unten). Er ist damit der wichtigste
			 * Träger der Aussage und wurde beim Richten von F-07 zuerst übersehen:
			 * Der Kasten an der Karte war korrigiert, dieser hier sagte weiter «darf
			 * nicht verschärft werden» und erschien genau dann, wenn eine
			 * Gemeinschaft eine strengere Klausel hinterlegt hat. Also in dem Fall,
			 * zu dem der Hinweis derselben Karte rät, die strengere Klausel
			 * sicherheitshalber zu erreichen.
			 *
			 * Was das Werkzeug tut, ist unbestritten und steht hier. Ob eine
			 * Verschärfung überhaupt gilt, ist es nicht, und das behauptet der Satz
			 * nicht mehr.
			 */
			return (
				kopf +
				'Sie wird hier nicht angewandt: An dieser Stelle setzt das Werkzeug nur eine ' +
				'Regel durch, die nachweislich nicht strenger ist als das Gesetz. Ihre ist ' +
				'strenger oder lässt sich mangels gleicher Bezugsgrösse nicht damit vergleichen. ' +
				// Mit Rechtssatz (ab 2026-10-15, Ausweg der luxuriösen Massnahme)
				// beantwortet die Karte die Frage selbst (Laienprüfung, B6c).
				(recht
					? `${recht} Ausgezählt wird nach dem Gesetz. ${EINWAND_IM_SAAL}`
					: 'Ob sie rechtlich trotzdem gilt, klären Sie vor der Versammlung.')
			);

		case 'milderung':
			/*
			 * **Das Spiegelbild von `verschaerfung`** (ab Fassung 2026-10-20). Der
			 * Rechtssatz des Knotens sagt, warum; ohne ihn ein Satz ohne
			 * Randziffer, weil dieser Zweig für jeden Knoten mit
			 * `nur_verschaerfen` gilt (dieselbe Lehre wie bei `nur_mildern`).
			 */
			return (
				kopf +
				'Sie wird hier nicht angewandt: Ihre Regel ist in mindestens einer Hinsicht milder als das ' +
				'Gesetz oder lässt sich nicht eindeutig einordnen. ' +
				(recht ? `${recht} ` : 'Das gesetzliche Mehr lässt sich hier nur verschärfen. ') +
				`Ausgezählt wird nach dem Gesetz. ${EINWAND_IM_SAAL}`
			);

		case 'milder_nach_lesart':
			/*
			 * **An der vereinbarten Verwendung ein eigener Satz** (Fachprüfung
			 * R2-F-3): Dort trägt auch eine Regel aus dem Begründungsakt nicht
			 * sicher, weil ein anderer Autor die Verwendung selbst nicht zulässt
			 * (Rz. 138 ad Art. 712l). Erkannt am Typ: Diesen Vorbehalt gibt es nur
			 * unter der strengeren Auffassung, und dort rechnet von den Karten mit
			 * L17 allein die vereinbarte Verwendung die Zustimmung aller; der Kern
			 * kennt die Kennungen der Fassung nicht.
			 */
			if (typ !== 'einstimmigkeit') return kopf + fondsentnahmeMilder(fassung);
			/*
			 * **Mit Häkchen ab der Fassung 2026-11-21 ein eigener Satz** (Fachprüfung
			 * F-5): Das Häkchen wirkt an der vereinbarten Verwendung nicht, und der
			 * Satz sagt warum, statt die Herkunft der Regel zu bezweifeln.
			 */
			return (
				kopf +
				(regel.gesichert && haekchenFassung(fassung)
					? `${FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN} ${EINWAND_IM_SAAL}`
					: FONDSENTNAHME_VEREINBART_MILDER)
			);

		case 'gemischt':
			return (
				kopf +
				'Sie wird hier nicht angewandt: Sie lässt sich nicht eindeutig als strenger oder als ' +
				'milder einordnen als das Gesetz, zum Beispiel weil sie bei den Köpfen mehr verlangt, ' +
				'bei den Wertquoten aber weniger, oder weil sie einen höheren Anteil verlangt, ihn aber ' +
				// Endfassung Block C, Abschnitt 7: nicht «nach jeder Lesart».
				'nur an den Anwesenden misst. Das Werkzeug rechnet deshalb nach dem Gesetz. Erreicht ein ' +
				'Beschluss auch Ihre Regel, kommt es auf die Regel nicht an. Hinterlegen Sie die Regel so, ' +
				'wie sie im Reglement steht, auch wenn sie dort unvollständig ist.'
			);

		case 'betroffenenzustimmung':
			return (
				kopf +
				'Sie wird hier nicht angewandt: Dieser Fall verlangt die Zustimmung der Betroffenen, ' +
				'und die Regel nimmt sie aus der Bezugsgrösse. Ihre Zustimmung würde dann nicht mehr ' +
				'gezählt. Das Werkzeug zählt deshalb nach dem gesetzlichen Erfordernis. Ob Ihre Regel ' +
				'für diesen Fall gedacht ist, klären Sie vor der Versammlung.'
			);

		case 'ohne_koepfe':
			return (
				kopf +
				'Sie wird hier nicht angewandt: Eine Regel, bei der die Köpfe nicht zählen, wendet das ' +
				'Werkzeug nur dort an, wo das Gesetz das einfache Mehr verlangt. Hier verlangt es mehr, ' +
				'und Votum zählt nach dem Gesetz; nach Ihrer Regel kann es hier nicht zählen. Halten Sie ' +
				// Fachprüfung 16.11.2026, F4 und R2-F2 (Rz. 99 ad Art. 712n); Laienprüfung L4 und R2-L3.
				'Ihre Regel auch hier für massgebend, klären Sie das vor der Versammlung und sagen Sie vor ' +
				`der Abstimmung an, dass nach dem Gesetz gezählt wird. ${EINWAND_IM_SAAL}`
			);

		case 'keine_abstimmung':
			return kopf + 'Sie wird hier nicht angewandt, weil über diesen Punkt nicht abgestimmt wird.';

		case 'grenzfall':
			return (
				kopf +
				'Sie wird hier nicht angewandt, weil offen ist, ob das Vorhaben überhaupt darunter ' +
				'fällt — genau das ist die Frage des Grenzfalls.'
			);
	}
}

/**
 * Ob eine Klausel gilt, die mit zu wenig Stimmen eingeführt und nicht
 * angefochten wurde (Auftrag «Texte nach 0047», Punkt 10; Abgleich der
 * Rechtskarten 14.11.2026, (d)): nicht geklärt, wie Votum es an der Karte
 * `k-reglement-beschlussfaehigkeit` sagt (Fassung 2026-10-30). BGE 143 III 537
 * E. 4.2.4 hielt den Beschluss im Fall für anfechtbar, nicht nichtig; die Lehre
 * ist geteilt (E. 4.2.1). Rz. 207 ad Art. 712m trägt es nicht und fällt weg.
 * An der Karte mit angewandter Einstellung (10a).
 */
export const KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN =
	'Ob sie trotzdem gilt, wenn sie mit weniger Stimmen eingeführt und nicht innert Frist angefochten wurde, ' +
	'ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4. Dort hatte eine Gemeinschaft ohne Einstimmigkeit ' +
	'von Köpfen auf Anteile umgestellt. Das Bundesgericht hielt das nur für anfechtbar, nicht für nichtig, also ' +
	'für wirksam, wenn niemand es rechtzeitig anficht. Die Lehre ist geteilt.';

/**
 * Dasselbe kürzer: an der Karte, wo das Reglement gesperrt ist und nur die
 * Einstellung zu den Enthaltungen gilt (10b), und in den Angaben der
 * Gemeinschaft (10d, `GemeinschaftFormular.svelte`), mit der Richtung wie 10a
 * (Fachprüfung Runde 1, F-2).
 */
export const KLAUSEL_MIT_WENIGER_OFFEN =
	'Ob sie trotzdem gilt, wenn sie mit weniger beschlossen und nicht innert Frist angefochten wurde, ist ' +
	'nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4 (dort zum Wechsel von Köpfen zu Anteilen).';

/**
 * Der sichere Weg zur Klausel (Laienprüfung Runde 1, L-9; Runde 2, R2-L-7): an
 * der Karte hinter 10b, für die Verwaltung, die den Haken setzt (10d), und im
 * Handbuch (10e). An 10a trägt ihn schon der Satz «Erreicht das Ja auch mehr als
 * die Hälfte, …».
 */
export const KLAUSEL_SICHER =
	'Sicher ist ein Beschluss, der das Mehr auch erreicht, wenn die Enthaltungen wie ein Nein zählen.';

/**
 * Der Satz in «Wortlaut und Rechtsprechung» (4a, 4b; `ENTHALTUNG_SATZ` in
 * `rules/quorum-2026-11-14.ts`), der unter der Enthaltungsklausel entfällt. Eine
 * Kopie, weil der Kern das Regelwerk nicht einbindet; ein Test hält beide gleich
 * (`tests/domain/fassung-2026-11-14.test.ts`).
 */
export const ENTHALTUNG_IM_WORTLAUT = ' Enthaltungen zählen mit und wirken wie ein Nein.';

/**
 * Derselbe Satz ab der Fassung 2026-11-15 (`ENTHALTUNG_SATZ` in
 * `rules/quorum-2026-11-15.ts`; Auftrag «Texte nach 0047», Punkt 12d). Unter
 * der Enthaltungsklausel fallen beide Wortlaute weg, denn Karten beider
 * Fassungen stehen nebeneinander; ein Test hält die Kopie gleich.
 */
export const ENTHALTUNG_IM_WORTLAUT_AB_2026_11_15 =
	' Enthaltungen zählen nach herrschender Lehre mit und wirken wie ein Nein; so rechnet Votum.';

/** Dasselbe in 4a an Art. 647d (`ENTHALTUNG_SATZ_647D`); dort greift die Klausel heute nicht, der Ersatz schadet nicht. */
export const ENTHALTUNG_IM_WORTLAUT_647D_AB_2026_11_15 =
	' Enthaltungen zählen nach herrschender Lehre, der Auffassung der meisten Fachleute, mit und wirken wie ein ' +
	'Nein; so rechnet Votum.';

/** Alle Wortlaute des Satzes, die unter der Enthaltungsklausel wegfallen. */
export const ENTHALTUNG_IM_WORTLAUT_ALLE: readonly string[] = [
	ENTHALTUNG_IM_WORTLAUT,
	ENTHALTUNG_IM_WORTLAUT_AB_2026_11_15,
	ENTHALTUNG_IM_WORTLAUT_647D_AB_2026_11_15
];

/**
 * Die Wirkung von Enthaltung und Nichtabgabe unter einem Mehr: der erste Satz,
 * den die Mehrheitstypen des Regelwerks führen (`quorum-2026-07-30.ts`), ohne
 * ihren Satz zum Streit um Enthaltungen (Rz. 181 ad Art. 712m), der das Gesetz
 * betrifft, nicht die Regel. Eine Kopie, weil der Kern das Regelwerk nicht
 * einbindet (`check:schichten`); sie gilt für jede Fassung.
 */
const WIRKUNG_UNTER_MEHR =
	'Eine Enthaltung bleibt in der Bezugsgrösse und wirkt deshalb faktisch wie ein Nein; ebenso ' +
	'eine Stimme, die abgegeben werden könnte, aber nicht abgegeben wird.';

/** Verlangt die Schwelle die Zustimmung aller (wie `alle` in `mehrhinweise.ts`)? */
function zustimmungAller(s: { zaehler: number; nenner: number; art: string } | null | undefined): boolean {
	return !!s && s.zaehler === s.nenner && s.art === 'mindestens';
}

/**
 * Die Karte sagt, was die Einstellung zu den Enthaltungen hier bewirkt
 * (07.10.2026).
 *
 * **Als eigener Absatz unter der Stimmwirkung**, wie der Satz zur
 * Reglementsregel in `karteMitReglement`: Der Absatz davor sagt, dass eine
 * Enthaltung wie ein Nein wirkt, und ohne den Nachsatz stünde das unter einem
 * Ergebnis, das anders gerechnet ist.
 *
 * **Die Sätze sagen, wie Votum rechnet, nicht wie das Gesetz rechnet.** Schon
 * ob Enthaltungen nach dem Gesetz mitzählen, ist umstritten (Rz. 181 ad
 * Art. 712m); deshalb «Votum zählt Enthaltungen hier mit», nicht «Enthaltungen
 * zählen hier mit» (Fachprüfung 07.10.2026). Der Grund für die gesperrten
 * Knoten steht je Geschäft, weil der Kommentar ihn je Geschäft verschieden
 * erörtert (siehe `mitEinstellung`).
 */
export function karteMitEnthaltung(
	karte: Ergebniskarte,
	enthaltung: Regelanwendung['enthaltung']
): Ergebniskarte {
	if (!enthaltung) return karte;
	const { fundstelle } = enthaltung;
	const ansagen =
		'Votum zählt Enthaltungen hier mit. Sagen Sie das vor der Abstimmung an, damit sich ' +
		'niemand im Glauben enthält, neutral zu bleiben (Rz. 99 ad Art. 712n).';
	if (enthaltung.angewandt) {
		const saetze = [
			`Abweichend davon zählt Votum Enthaltungen hier nicht mit: Das Reglement dieser ` +
				`Gemeinschaft nimmt sie beim einfachen Mehr aus der Bezugsgrösse (${fundstelle}). Eine ` +
				`Enthaltung wirkt dann weder für noch gegen den Antrag. Für die Beschlussfähigkeit ` +
				`zählt weiter, wer sich enthält.`,
			// Laien- und Fachprüfung 07.10.2026, Runde 2: Der Unterschied zwischen
			// «Enthaltung» und «gar nicht abgestimmt» entscheidet hier, und im Saal
			// weiss ihn niemand, wenn die Leitung ihn nicht sagt.
			// Laienprüfung Block C, Nachtrag, N-L-12: «beides» stand ohne Bezug in eigener Zeile.
			'Wer anwesend ist und nicht abstimmt, zählt in Votum vorsichtshalber weiter mit und ' +
				'wirkt wie ein Nein. Sagen ' +
				'Sie vor der Abstimmung an, wie Enthaltung und fehlende Stimme zählen, und fragen Sie vor dem ' +
				'Schliessen nach, wer noch nicht abgestimmt hat.'
		];
		if (enthaltung.knotenId === 'k-baulich-notwendig') {
			saetze.push(
				'Auch eine gültig eingeführte Einstellung erleichtert hier das Mehr, denn ' +
					'Enthaltungen zählen dann nicht mit. Ob ein Reglement das Mehr bei ' +
					'notwendigen baulichen Massnahmen erleichtern darf, ist umstritten; der SVIT-Kommentar ' +
					'hält es für rechtlich nicht ausgeschlossen (Rz. 36 ad Art. 712g). Erreicht das Ja ' +
					// Endfassung Block C, Abschnitt 7: nicht «nach jeder Lesart».
					'auch mehr als die Hälfte, wenn Sie die Enthaltungen mitzählen, kommt es auf diese ' +
					'Bestimmung nicht an. Sonst ist der Beschluss angreifbarer als andere; ist die Sache nicht ' +
					`dringlich, vergeben Sie den Auftrag ${NACH_DER_ANFECHTUNGSFRIST}`
			);
		}
		/*
		 * **Der Reglementsvorbehalt sagt sonst das Gegenteil** (Codeprüfung
		 * 07.10.2026, Befund 2). Ohne hinterlegte Regel endet er mit «keine
		 * Abweichung hinterlegt», bei der notwendigen Massnahme mit «wird nicht
		 * automatisch angewandt». Beides stimmt für die Regeln je Geschäftsart,
		 * nicht für diese Einstellung.
		 */
		const ausnahme =
			enthaltung.reglementsverhalten === 'vereinbart'
				? /*
					 * **Dieselbe Antwort wie im Zweig darunter**: Ob eine mit weniger
					 * eingeführte Klausel trotzdem gilt, ist nicht geklärt
					 * (`KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN`; Auftrag «Texte nach 0047»,
					 * Punkt 10). Bis dahin stand, sie gelte in der Regel (Laien- und
					 * Fachprüfung 07.10.2026); BGE 143 III 537 E. 4.2.4 betraf eine
					 * Klausel derselben Art (Köpfe statt Anteile) und entschied nur den Fall.
					 *
					 * **Erreicht wird dieser Zweig nur an der notwendigen baulichen
					 * Massnahme** (Codeprüfung 07.10.2026): Die Einstellung greift nur
					 * beim einfachen Mehr der Anwesenden (`mitEinstellung`). Dort ist
					 * die Erleichterung selbst umstritten, deshalb «rechtmässig nur»
					 * als notwendige Bedingung, nicht «sicher gilt sie», und der
					 * Hinweis auf die zweite Frage. «Nicht innert Frist angefochten»
					 * statt «nie»: Solange die Frist läuft, bleibt sie anfechtbar
					 * (Rz. 207, 230). Die Folge der Wahl bleibt genannt (Laienprüfung
					 * Runde 3, 1), mit Wirkung und Grenze des Nachziehens.
					 */
					` Ihre Einstellung zu den Enthaltungen (${fundstelle}) wendet Votum hier an. ` +
					`Rechtmässig eingeführt ist sie nur, wenn alle Eigentümer ihr zugestimmt haben ` +
					`oder sie im Begründungsakt steht, der Urkunde, mit der das Stockwerkeigentum ` +
					`errichtet wurde; das war beim Setzen des Hakens in den Angaben der Gemeinschaft zu ` +
					`klären. ${KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN} Ob ein ` +
					`Reglement das Mehr hier überhaupt erleichtern darf, ist eine zweite, umstrittene ` +
					`Frage. Nehmen Sie den Haken weg, zählt Votum Enthaltungen mit, und sie wirken wie ` +
					`ein Nein; bei einem bestehenden Traktandum erst, wenn Sie es auf der ` +
					`Reglementsseite nachziehen, und das geht nur, solange die Versammlung nicht ` +
					`eröffnet ist.`
				: enthaltung.reglementsverhalten === 'gesperrt_vereinbarung'
				? ` Ausgenommen ist Ihre Einstellung zu den Enthaltungen (${fundstelle}): Votum ` +
					`wendet sie hier an. Ob sie einstimmig oder im Begründungsakt eingeführt wurde, war ` +
					`beim Setzen des Hakens in den Angaben der Gemeinschaft zu klären. ${KLAUSEL_MIT_WENIGER_OFFEN} ` +
					`${KLAUSEL_SICHER}`
				: ` Ihre Einstellung zu den Enthaltungen in den Angaben der Gemeinschaft ` +
					`(${fundstelle}) gilt hier trotzdem.`;
		return {
			...karte,
			stimmwirkung: [...karte.stimmwirkung, ...saetze],
			reglementsvorbehalt: karte.reglementsvorbehalt
				? // Im Stand-Satz vorne gleich die Ausnahme (Laienprüfung Runde 2,
					// B8): Wer nach «gezählt wird nach dem Gesetz» aufhört, kündigte
					// sonst auch die Enthaltungen nach dem Gesetz an.
					karte.reglementsvorbehalt.replace(
						'keine Abweichung hinterlegt; gezählt wird nach dem Gesetz.',
						'keine Abweichung hinterlegt; gezählt wird nach dem Gesetz, ausser bei den ' +
							'Enthaltungen (siehe unten).'
					) + ausnahme
				: karte.reglementsvorbehalt,
			/*
			 * **Auch der Block zum Wortlaut** (Fachprüfung 07.10.2026, Runde 3,
			 * B1). Bei der notwendigen Massnahme sagt er «Gezählt wird nach den
			 * Eigentümern, die anwesend oder vertreten sind, nicht nach jenen, die
			 * abstimmen … Dieses Werkzeug folgt Kommentar und Rechtsprechung.» Ohne
			 * Nachsatz kündigte die Leitung danach an, Enthaltungen zählten mit.
			 */
			/*
			 * **Ohne den Satz zu den Enthaltungen** (Endfassung Block C, Abschnitt
			 * 6): Ab der Fassung 2026-11-14 sagt «Wortlaut und Rechtsprechung» an
			 * Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e Abs. 2, Enthaltungen
			 * zählten mit; der Nachsatz sagt hier das Gegenteil.
			 */
			wortlautHinweis: karte.wortlautHinweis
				? `${ENTHALTUNG_IM_WORTLAUT_ALLE.reduce((t, satz) => t.replace(satz, ''), karte.wortlautHinweis)} Ihre Gemeinschaft hat eine solche Zählweise ` +
					`eingestellt (${fundstelle}); Votum zählt hier deshalb ohne Enthaltungen, siehe oben ` +
					`und den Absatz zum Reglement.`
				: karte.wortlautHinweis
		};
	}
	const grund = enthaltung.durchRegel
		? `Ihre Regel für diese Geschäftsart auf der Reglementsseite (${enthaltung.durchRegel}) ` +
			`sagt, dass Enthaltungen mitzählen. Diese Angabe geht der allgemeinen Bestimmung vor, ` +
			`auch wo Votum die Regel sonst nicht anwendet.`
		: enthaltung.anderesMehr
		? 'Votum wendet das nur beim einfachen Mehr der Anwesenden an, nicht bei diesem ' +
			'Erfordernis.' +
			// Fachprüfung Runde 4: Bei der Einstimmigkeit gibt es nichts zu klären,
			// eine Enthaltung ist dort keine Zustimmung.
			(enthaltung.qualifiziert
				? ' Gilt Ihre Klausel auch für die Köpfe beim qualifizierten Mehr (Rz. 192a ad ' +
					'Art. 712m), rechnet Votum strenger als Ihr Reglement. Erreicht der Antrag das Mehr ' +
					// Endfassung Block C, Abschnitt 7: nicht «nach jeder Lesart».
					'auch mit den Enthaltungen, kommt es auf Ihre Klausel nicht an; sonst klären Sie vor der ' +
					'Versammlung, wie gezählt wird.'
				: '')
		: enthaltung.knotenId === 'k-bewirtschaftung-abberufen'
			? 'Bei der Abberufung der Bewirtschaftung wendet Votum das nicht an: Nach herrschender ' +
				'Lehre darf ein Reglement dieses Mehr weder erschweren noch erleichtern (Rz. 64 ad ' +
				'Art. 712g).'
			: enthaltung.knotenId === 'k-wertquoten-aendern'
				? 'Bei der Genehmigung einer Wertquotenänderung wendet Votum das nicht an: Ob ein ' +
					'Reglement dieses Mehr ändern darf, ist umstritten (Rz. 86 f. ad Art. 712e), und ' +
					'Votum rechnet hier vorsichtig.'
				: enthaltung.reglementsverhalten === 'nur_verschaerfen'
					? 'Hier wendet Votum das nicht an: Enthaltungen zählen bei der Einsprache nach ' +
						'herrschender Lehre mit und wirken damit wie ein Nein; sagen Sie das vor der ' +
						'Abstimmung an.'
					: 'Bei diesem Geschäft wendet Votum das nicht an, so wenig wie eine andere ' +
					'abweichende Bestimmung des Reglements.';
	return {
		...karte,
		stimmwirkung: [
			...karte.stimmwirkung,
			`Das Reglement dieser Gemeinschaft nimmt Enthaltungen beim einfachen Mehr aus der ` +
				`Bezugsgrösse (${fundstelle}). ${grund}`,
			ansagen
		]
	};
}

export function karteMitReglement(
	karte: Ergebniskarte,
	regel: Reglementsregel | null,
	vorbehalt: Regelvorbehalt | null,
	freitext: string | null,
	zahlenbeispielReglement: string | null,
	/** `lesart` aus `wendeReglementAn`, wo die Regel nicht wörtlich gelesen wurde. */
	lesart?: string,
	/**
	 * Das Erfordernis, an dem die Regel gilt. An der Ausschlussklage wirkt es
	 * auf den Bezugsgrössensatz (seit 29.09.2026), sein Reglementsverhalten ab
	 * 2026-10-15 auf den Satz unter der Regel und ohne Regel.
	 */
	e?: Pick<Erfordernis, 'kopfbasis' | 'knotenId'> &
		Partial<Pick<Erfordernis, 'reglementsverhalten' | 'typ' | 'fassung' | 'gemeinschaftslesart'>>,
	/** `verdraengt` aus `wendeReglementAn`: die fallgenaue Regel, an deren Stelle eine allgemeine gilt (L17). */
	verdraengt?: string,
	/** `fondsregel` aus `wendeReglementAn`: der Satz zum Häkchen an der angewandten Regel (Migration 197). */
	fondsregel?: string
): Ergebniskarte {
	/*
	 * **Der Vermerk steht nicht mehr hier** (23.08.2026, Prüflauf I, B-23). Er
	 * hing als letzter Eintrag in einer Aufzählung von fünf Hinweisen — der
	 * Prüfer trug ihn ein und sah ihn nie wieder. Seit heute steht er als eigener
	 * Kasten über der Herleitung, wo er bei JEDER Herleitung sichtbar ist, nicht
	 * nur am Ergebnis. Der Parameter bleibt, damit ältere Aufrufer nicht brechen.
	 */
	const mitFreitext = karte;
	void freitext;

	/*
	 * **Gesagt, dass nichts hinterlegt ist** (23.08.2026, Prüflauf I, B-24). Bei
	 * einer luxuriösen Massnahme stand ein allgemeiner Satz («Das Gesetz lässt
	 * hier eine andere Ordnung zu … ob Ihre so zustande kam, klären Sie vor der
	 * Versammlung»), und der Prüfer fragte sich, ob seine eigene
	 * Reglementsbestimmung überhaupt geprüft worden war. Wo eine Regel greift,
	 * steht ihre Fundstelle; wo keine hinterlegt ist, stand nichts — und das
	 * Schweigen liest sich wie ein Prüfergebnis.
	 */
	if (!regel) {
		/*
		 * **An den Karten mit `vereinbart` der Stand zuerst** (Laienprüfung nach
		 * dem Bau, B2): Dort folgen Bedingung, Handlung und Rechtssatz mit
		 * Randziffern, und wer im Saal beim ersten «Rz.» aufhört, wusste nicht,
		 * ob seine Regel berücksichtigt ist.
		 */
		if (
			e?.reglementsverhalten === 'vereinbart' ||
			(e?.reglementsverhalten === 'nur_mildern' && karte.reglementsrecht) ||
			// An der Einsprache ebenso (Featureprüfung, N5): Der Kasten endet dort
			// mit Rechtssatz und Bedingung, der Stand gehört davor.
			e?.reglementsverhalten === 'nur_verschaerfen'
		) {
			return {
				...mitFreitext,
				reglementsvorbehalt:
					'Für diesen Fall ist in dieser Gemeinschaft keine Abweichung hinterlegt; gezählt ' +
					'wird nach dem Gesetz. Geprüft wurde dabei nicht Ihr Reglement, sondern die Liste ' +
					`der hinterlegten Regeln. ${mitFreitext.reglementsvorbehalt}`
			};
		}
		return {
			...mitFreitext,
			reglementsvorbehalt:
				`${mitFreitext.reglementsvorbehalt} Für diesen Fall ist in dieser Gemeinschaft ` +
				'keine Abweichung hinterlegt — geprüft wurde also nicht Ihr Reglement, sondern nur ' +
				'die Liste der hinterlegten Regeln.'
		};
	}

	/*
	 * **In den Block «Reglementsvorbehalt», nicht in die Hinweise.** Dort sucht,
	 * wer wissen will, was sein Reglement hier bewirkt. In der Aufzählung weiter
	 * unten stünde der Satz zwischen fünf anderen und würde überlesen — bei der
	 * Einstimmigkeit wäre das der teuerste Ort für eine übersehene Zeile.
	 */
	if (vorbehalt) {
		// An der erweiterten Bewirtschaftung mit einer Regel für Organe der Abschnitt
		// zum Saal mit deren Gegenstand (ab 2026-11-11; Fachprüfung E2, F-11). Die
		// Bedingung dieselbe wie in `vorbehaltInWorten`, Zweig `nur_fallgenau`.
		const erweiterung =
			vorbehalt === 'nur_fallgenau' &&
			e?.reglementsverhalten === 'vereinbart' &&
			e.typ !== undefined &&
			e.typ !== 'einstimmigkeit' &&
			einwandStrengerAb(e.fassung);
		return {
			...mitFreitext,
			...(erweiterung
				? { einwandImSaal: einwandImSaal({ gegenstand: 'erweiterung', einstimmigkeit: null }) }
				: {}),
			reglementsvorbehalt: vorbehaltInWorten(
				vorbehalt,
				regel,
				karte.reglementsrecht,
				karte.sperreNachLehre === true,
				e?.reglementsverhalten,
				e?.typ,
				e?.fassung,
				// An der Kennung, nicht an der Wahl: Die Aufrufer geben das Erfordernis vor
				// der Lesart der Gemeinschaft (`hergeleitet`), und dort steht die Wahl des Knotens.
				e?.gemeinschaftslesart?.kennung === 'L17'
			)
		};
	}

	/*
	 * **Die Karte erklärt die Regel, nicht mehr das Gesetz** (Produktentscheid
	 * 29.09.2026, `docs/freigabe.md`). Begründung und Hinweise zum Gesetz
	 * wandern in den Abschnitt «Zum gesetzlichen Erfordernis»; welche Hinweise
	 * das sind, sagt der Knoten (`hinweiseUnterRegel`, ab Fassung 2026-10-08).
	 * Die Begründung wandert in jeder Fassung, denn sie leitet fast überall das
	 * gesetzliche Mehr her («verlangt deshalb das qualifizierte Mehr»), und
	 * dass sie wandert, ist Darstellung, kein Knotendatum.
	 */
	const unterRegel = new Map(karte.hinweiseUnterRegel.map((u) => [u.hinweis, u]));
	const hinweiseZumGesetz = karte.hinweise.flatMap((h) => {
		const ziel = unterRegel.get(h)?.zumGesetz;
		return ziel === undefined ? [] : [ziel === true ? h : ziel];
	});
	const hinweiseUnterDerRegel = karte.hinweise.flatMap((h) => {
		const u = unterRegel.get(h);
		if (u === undefined) return [h];
		return u.ersatz === undefined ? [] : [u.ersatz];
	});

	/*
	 * **Unter einer Regel ohne Einstimmigkeit nicht «Zustimmung jedes
	 * Einzelnen»** (Laien- und Fachprüfung nachträgliche Zustimmung, Runde 9,
	 * L9-1, F9-3): Die Karte einer Einstimmigkeit trug unter einer Regel «zwei
	 * Drittel» weiter den Satz ihres Typs, und bei sechs Ja und einer Enthaltung
	 * hielt die Leitung den angenommenen Beschluss für gescheitert. Ersetzt wird
	 * nur dieser eine Satz, nicht über eine Position in einer Liste, die andere
	 * Typen anders füllen: Eine Einstimmigkeit hat genau ihn.
	 */
	const wirkungUnterRegel =
		karte.typ === 'einstimmigkeit' && !zustimmungAller(regel.kopfSchwelle)
			? [WIRKUNG_UNTER_MEHR]
			: karte.stimmwirkung;

	/*
	 * **Unter einer angewandten Regel kein Abschnitt zum Einwand** (Codeprüfung
	 * E2, M1): Er spricht vom gesetzlichen Mehr und vom Ergebnis nach dem Gesetz,
	 * gerechnet wird hier aber nach der Regel; für den Saal hat diese Karte ihren
	 * eigenen Satz («Wird im Saal bestritten, …»). Ebenso bietet die Maske den
	 * Grund dann nicht an (`einwandLageAm`, Typ `reglementsmehr`).
	 */
	const { einwandImSaal: _ohneAbschnitt, ...ohneEinwand } = mitFreitext;
	return {
		...ohneEinwand,
		// Der Weg der Einstimmigkeit gilt nur, wenn auch die Regel die Zustimmung
		// aller Eigentümer verlangt (Codeprüfung 22.10.2026, Befund 3); unter
		// «Zustimmung aller Anwesenden» genügen die im Saal (Durchgang 2, M1).
		/*
		 * **Unter einer Regel, die die Zustimmung aller verlangt, der Weg des
		 * Knotens, nicht der der anderen Lesart** (Codeprüfung L17, N1): Trägt die
		 * Karte nach der Lesart einen eigenen Weg (`andere.einstimmigkeitsweg`, L6,
		 * L17 «svit»), beschreibt er das Mehr dieser Lesart, etwa «mit dem
		 * einfachen Mehr». Die Regel rechnet aber die Zustimmung aller, und dafür
		 * gilt der Weg des Knotens (`einstimmigkeitswegDesKnotens`, gesetzt von
		 * `knotenNachLesart`).
		 */
		einstimmigkeitsweg:
			zustimmungAller(regel.kopfSchwelle) && regel.kopfbasis !== 'anwesend_vertreten'
				? karte.einstimmigkeitswegDesKnotens !== undefined
					? karte.einstimmigkeitswegDesKnotens
					: karte.einstimmigkeitsweg
				: null,
		bezeichnung: 'Reglementsmehr',
		typ: 'reglementsmehr',
		formel: regelInWorten(regel),
		rechtsgrundlage: `Reglement der Gemeinschaft, ${regel.fundstelle}`,
		/*
		 * «Dieses Mehr», nicht «dieses Erfordernis»: Eine Zustimmung Betroffener
		 * und der Ausschluss des Beklagten bleiben Gesetz (Fachprüfung
		 * 29.09.2026, zu Stelle 1).
		 */
		begruendung:
			`Dieses Mehr stammt aus der Bestimmung Ihres Reglements, die für diese Gemeinschaft ` +
			`hinterlegt ist (${regel.fundstelle}), nicht aus dem Gesetz. Welches Mehr das Gesetz ` +
			'ohne sie verlangt und warum, steht unten unter «Zum gesetzlichen Erfordernis».',
		/*
		 * **Der Einleitungssatz nimmt dem Abschnitt die Gegenwart** (Laien- und
		 * Fachprüfung 29.09.2026, F2 und G2). Die gewanderten Sätze sagen im
		 * Präsens, was das Werkzeug tut («rechnet über alle … genügt beiden
		 * Lesarten»); unter der Regel tut es das nicht, und ohne Rahmen las die
		 * Leitung sie als Zusage über das angezeigte Ergebnis.
		 */
		zumGesetz: {
			einleitung:
				'So rechnete dieses Werkzeug ohne Ihre Bestimmung. Was hier darüber steht, wie es ' +
				'rechnet und welchen Lesarten ein Beschluss genügt, gilt nicht für das Ergebnis oben; ' +
				'das ist nach Ihrer Bestimmung gezählt.',
			begruendung: karte.begruendung,
			hinweise: hinweiseZumGesetz
		},
		zahlenbeispiel: zahlenbeispielReglement,
		// Der Wortlaut-Hinweis (BGE 144 III 510 zur Zählweise «aller
		// Miteigentümer») erklärt das GESETZLICHE Erfordernis. Gilt die
		// hinterlegte Regel, stammt das Erfordernis nicht mehr aus dem Gesetz,
		// und der Hinweis behauptete eine Herleitung, die nicht stattfand
		// (Befund B-29 der Prüfung vom 15.08.2026).
		wortlautHinweis: null,
		reglementsvorbehalt:
			`Angewandt wird die hinterlegte Regel dieser Gemeinschaft (${regel.fundstelle}), ` +
			/*
			 * **Unter «Alle Eigentümer» nicht «das gesetzliche Erfordernis»**
			 * (Fachprüfung Block C, Nachtrag, N-F-2): Die Formel ist dann die
			 * Einstellung der Gemeinschaft; die herrschende Lehre zählt die
			 * Anwesenden, und «Wortlaut und Rechtsprechung» fehlt unter der Regel.
			 */
			(karte.nachZaehlweiseAlle
				? 'nicht das Gesetz. Ohne sie hätte Votum nach der Einstellung Ihrer Gemeinschaft zur Zählweise ' +
					`der Köpfe («Alle Eigentümer») verlangt: ${karte.formel} Die herrschende Lehre, die Auffassung ` +
					'der meisten Fachleute, zählt auch dort nur die Köpfe der Anwesenden und Vertretenen. Vergleichen ' +
					'Sie Ihre Regel mit dem Gesetz, rechnen Sie nach beiden Zählweisen.'
				: `nicht das Gesetz. Das gesetzliche Erfordernis wäre gewesen: ${karte.formel}`) +
			(lesart ? ` ${lesart}` : '') +
			// Vor `verdraengt`: Der Satz gilt der angewandten Regel, «zudem» folgt danach.
			(fondsregel ? ` ${fondsregel}` : '') +
			(verdraengt ? ` ${verdraengt}` : '') +
			/*
			 * **Unter der angewandten Regel steht die Bedingung** (ab Fassung
			 * 2026-10-15). An einer Karte mit `vereinbart` gilt die Regel nur, wenn
			 * sie einstimmig oder im Begründungsakt eingeführt wurde; das prüft die
			 * Anwendung nicht, und wer die Karte liest, soll es wissen.
			 */
			(e?.reglementsverhalten === 'vereinbart' ||
			(e?.reglementsverhalten === 'nur_mildern' && karte.reglementsrecht)
				? (e?.reglementsverhalten === 'vereinbart'
						? ` ${vereinbartBedingung(karte.rechtsgrundlage)}`
						: '') +
					(karte.reglementsrecht ? ` ${karte.reglementsrecht}` : '') +
					' Wie Ihre Regel zustande kam, kann dieses Werkzeug nicht prüfen. ' +
					/*
					 * **Was die Leitung im Saal und danach tut** (Laien- und
					 * Fachprüfung nach dem Bau, Runden 1 und 2: B3, A6, B6, B9). Ein
					 * Rechtssatz, der «umstritten» sagt, ohne Handlung, lässt sie mit
					 * «angenommen» allein; und den Vergleich mit dem Gesetz rechnet
					 * Votum nicht aus.
					 */
					'Sagen Sie vor der Abstimmung an, nach welcher Bestimmung gezählt wird. Erreicht ' +
					// Endfassung Block C, Abschnitt 7: nicht «nach jeder Lesart»; an den
					// Karten der Zählweise der Köpfe dazu der sichere Weg (R5-F-4).
					'der Beschluss auch das gesetzliche Erfordernis, kommt es auf Ihre Bestimmung nicht an; den ' +
					'Vergleich rechnen Sie aus dem Stimmenspiegel selbst. Sonst ist er angreifbarer. ' +
					// Hinter dem «Sonst», damit es sich auf das gesetzliche Erfordernis bezieht
					// (Codeprüfung Block C, N4); und vor der Wartezeit, damit das «er» beim Beschluss
					// bleibt und der Ausweg vor der Anweisung zu warten steht (Laien- und Fachprüfung
					// 17.11.2026, L-5, F-4).
					(KOPFZAEHLWEISE_ARTIKEL.some((a) => karte.rechtsgrundlage.startsWith(a))
						? 'Im Streit um die Zählweise der Köpfe sicher ist er, wenn mehr als die Hälfte aller ' +
							'Eigentümer zugestimmt hat. '
						: '') +
					// Die Sätze für das Protokoll vor der Wartezeit, an deren Ende man aufhört zu
					// lesen; die Wartezeit nur für einen angreifbaren Beschluss (Laien- und
					// Fachprüfung 17.11.2026, Runde 2: L2-4, L2-1, F2-3).
					'Scheitert ein Antrag nur an ' +
					'einer strengeren Bestimmung, halten Sie im Protokoll fest, ob er das gesetzliche ' +
					'Erfordernis erreicht hätte. Wird im Saal bestritten, dass Ihre Bestimmung so ' +
					'eingeführt wurde, halten Sie den Einwand im Protokoll fest. ' +
					// «nicht sicher» statt «angreifbar» (Runde 3, F3-1, L3-1): «sicher» zur Zählweise allein heisst
					// an Art. 647b Abs. 1 und 647e Abs. 2 nicht, dass die Wertquoten erreicht sind.
					`Erreicht ein angenommener Beschluss das gesetzliche Erfordernis nicht sicher und ist die Sache nicht dringlich, vollziehen Sie ihn ${NACH_DER_ANFECHTUNGSFRIST}`
				: '') +
			/*
			 * An der Einsprache (ab 2026-10-20) der Rechtssatz, warum nur eine
			 * strengere Regel gilt, und was die Leitung tut, wie bei `vereinbart`
			 * (Codeprüfung Durchgang 2, M3). Mit der Frist: Eine Einsprache, die
			 * an einer ungültigen Bestimmung scheitert, lässt sich nach den
			 * 14 Tagen nicht nachholen (Verwirkungsfrist, Rz. 190 ad Art. 712c).
			 */
			(e?.reglementsverhalten === 'nur_verschaerfen'
				? (karte.reglementsrecht ? ` ${karte.reglementsrecht}` : '') +
					' Wie Ihre Regel zustande kam, kann dieses Werkzeug nicht prüfen. Sagen Sie vor der ' +
					'Abstimmung an, nach welcher Bestimmung gezählt wird. Scheitert die Einsprache nur an ' +
					'Ihrer strengeren Bestimmung, halten Sie im Protokoll fest, ob sie das gesetzliche ' +
					'Erfordernis erreicht hätte. Nach Ablauf der 14 Tage lässt sie sich nicht nachholen. ' +
					'Klären Sie deshalb vor der Versammlung, ob Ihre Bestimmung gilt, also ob sie im ' +
					'Begründungsakt steht oder von allen Eigentümern unterschrieben ist.'
				: ''),
		hinweise: regel.hinweis ? [...hinweiseUnterDerRegel, regel.hinweis] : hinweiseUnterDerRegel,
		/*
		 * **Die Bezugsgrösse folgt der Regel** (23.08.2026, Prüflauf I, B-22).
		 *
		 * Die Karte sagte oben richtig «unabhängig davon, wer erscheint: nötig
		 * sind 4 Ja-Stimmen» — und drei Zeilen darunter stand der gesetzliche
		 * Standardblock «Die Bezugsgrösse sind die anwesenden und vertretenen
		 * Stimmen. Wer nicht erschienen ist, zählt nicht mit.» Zwei Sätze über
		 * dieselbe Zahl, die sich widersprechen; wer den zweiten glaubt, zählt
		 * die Erschienenen und hält das Ergebnis für richtig.
		 *
		 * Formel und Rechtsgrundlage wurden oben schon übernommen. Diese beiden
		 * fehlten — sie erklären die Formel, und eine Erklärung, die zur Formel
		 * nicht passt, ist schlimmer als keine.
		 */
		// An der Ausschlussklage wie der Bezugsgrössensatz darunter: der Beklagte
		// statt «der Betroffenen» (Codeprüfung 30.09.2026, M1).
		bezugsgroesse: bezugsgroessenHinweis(
			{ kopfbasis: regel.kopfbasis, id: e?.knotenId },
			{ mitBeispiel: false }
		),
		/*
		 * **Und derselbe Wechsel im Stimmwirkungsblock** (Code-Review 06.09.2026).
		 *
		 * Die Zeile darüber gibt es seit dem 23.08.2026 und behob genau diesen
		 * Widerspruch — aber nur für den erklärenden Block. Der kurze Satz im
		 * Stimmwirkungsblock stammte weiter aus dem gesetzlichen Knoten, und die
		 * Karte behauptete damit beides: «Hier zählen nicht die Erschienenen,
		 * sondern alle Eigentümer» und einen Block weiter «Die Bezugsgrösse sind
		 * die anwesenden und vertretenen Stimmen».
		 *
		 * Dass er ein eigenes Feld hat, ist der Punkt: Als erster Eintrag in
		 * `stimmwirkung` liesse er sich nur über seine Position ersetzen.
		 */
		bezugsgroessensatz: bezugsgroessensatz(
			regel.kopfbasis,
			e !== undefined && betroffeneStimmenNichtMit({ kopfbasis: regel.kopfbasis, knotenId: e.knotenId }),
			e?.knotenId === AUSSCHLUSSKLAGE_KNOTEN,
			e?.knotenId === EINSPRACHE_KNOTEN
		),
		/*
		 * **Und der Quotensatz gleich mit.** Der erste Anlauf übernahm nur die
		 * Kopfbasis und liess diesen stehen — dieselbe Nachbarstelle, dieselbe
		 * Klasse, eine Zeile tiefer. Hat die Regel kein Quotenerfordernis, sagt
		 * die Karte sonst weiter «Bei den Wertquoten ist die Bezugsgrösse die
		 * Gesamtheit aller Quoten», während gar keine Quotenschranke gilt.
		 */
		quotenwirkungssatz: quotenwirkungssatz(regel.quotenbasis),
		/*
		 * **Der Vorbehalt ist ein eigener Absatz, kein Anhängsel.** Bis zum
		 * 06.09.2026 wurde er an den gesetzlichen Satz gehängt — also genau der
		 * Satz, der im Abweichungsfall allein zählt, ans Ende eines Blocks, den
		 * der Prüfer schon vorher übersprungen hatte (Befund 31).
		 */
		stimmwirkung: regel.enthaltungZaehltMit
			? wirkungUnterRegel
			: [
					...wirkungUnterRegel,
					'Abweichend davon nimmt das Reglement dieser Gemeinschaft Enthaltungen aus der ' +
						'Bezugsgrösse heraus; sie wirken dort nicht gegen den Antrag.'
				]
	};
}

/**
 * Das Zahlenbeispiel unter einer Regel, nach der Zählweise, nach der das
 * Erfordernis rechnet (Lesarten Block 5, Abnahme): an der Einsprache nach L3
 * «je Eigentümer» mit den Eigentümern statt den Stimmen je Einheit
 * (`kennzahlenNachZaehlweise`). `wahl` ist die Wahl L3 der Gemeinschaft; das
 * hergeleitete Erfordernis trägt sie noch nicht, die setzt erst die Datenbank.
 */
export function zahlenbeispielNachZaehlweise(
	regel: Reglementsregel,
	zahlen: Kennzahlen,
	e: Pick<Erfordernis, 'knotenId' | 'fassung'>,
	wahl: Einsprachewahl | undefined
): string | null {
	const nachZaehlweise = kennzahlenNachZaehlweise({ ...e, einspracheLesart: wahl }, zahlen);
	return nachZaehlweise ? zahlenbeispielFuerRegel(regel, nachZaehlweise, e) : null;
}

/**
 * Das Zahlenbeispiel zu einer hinterlegten Regel, mit den echten Zahlen.
 *
 * Eigene Rechnung statt der gesetzlichen: Zwei Drittel von 15 sind 10, die
 * Hälfte wären 8. Stünde hier die gesetzliche Zahl unter einer
 * Reglementsüberschrift, wäre das der teuerste Anzeigefehler des Werkzeugs.
 */
export function zahlenbeispielFuerRegel(
	regel: Reglementsregel,
	zahlen: Kennzahlen,
	/**
	 * Das Erfordernis, an dem die Regel gilt. Nur an der Ausschlussklage und
	 * (ab Fassung 2026-10-20) an der Einsprache wirkt es: Dort stimmt der
	 * Beklagte oder der Betroffene auch unter «den Anwesenden» nicht mit
	 * (`betroffeneStimmenNichtMit`), und «wenn alle erschienen sind» sind es
	 * einer weniger (seit 29.09.2026).
	 */
	e?: Pick<Erfordernis, 'knotenId'>
): string | null {
	if (zahlen.kopfstimmen <= 0) return null;

	/*
	 * **Ohne Köpfe ein Beispiel nur nach Wertquoten** (16.11.2026), mit
	 * derselben Vorsicht wie unten: Die vertretenen Wertquoten kennt das
	 * Werkzeug vor der Versammlung nicht, also dort der Anteil in Worten.
	 */
	if (!regel.kopfSchwelle) {
		const q = regel.quotenSchwelle;
		if (!q) return null;
		if (regel.quotenbasis === 'anwesend_vertreten') {
			return (
				`Nötig ist ${schwelleInWorten(q)} der anwesenden oder vertretenen Wertquoten, ` +
				'gleich wie viele Eigentümer zustimmen.'
			);
		}
		if (zahlen.gesamtquote <= 0) return null;
		return (
			`Nötig sind mindestens ${rechneSchwelle(zahlen.gesamtquote, q)} von ${zahlen.gesamtquote} ` +
			'Wertquoten, gleich wie viele Eigentümer zustimmen.'
		);
	}
	const kopfSchwelle = regel.kopfSchwelle;

	const ohneBeklagten = e?.knotenId === AUSSCHLUSSKLAGE_KNOTEN;
	/*
	 * **An der Einsprache ebenso ohne die Betroffenen** (ab Fassung 2026-10-20).
	 * Eine Klausel «aller Eigentümer» kommt hier nicht an: `kopfbasisDerRegel`
	 * liest sie an Ausschlussklage und Einsprache als `alle_ausser_betroffene`,
	 * und die Aufrufer geben die so gelesene Regel weiter.
	 */
	const einsprache = e?.knotenId === EINSPRACHE_KNOTEN;
	const ohneBetroffene = ohneBeklagten || einsprache;
	const ohneSie = Math.max(0, zahlen.kopfstimmen - (zahlen.betroffene ?? 1));
	const kopfbasis =
		regel.kopfbasis === 'anwesend_vertreten'
			? (zahlen.anwesend ?? (ohneBetroffene ? ohneSie : zahlen.kopfstimmen))
			: regel.kopfbasis === 'alle_eigentuemer'
				? zahlen.kopfstimmen
				: Math.max(
						0,
						zahlen.kopfstimmen -
							(zahlen.betroffene ?? 1) +
							// Nur an der Ausschlussklage (Codeprüfung 30.09.2026, N-a).
							(ohneBeklagten ? (zahlen.beklagtenwohnungen ?? 0) : 0)
					);

	const noetig = rechneSchwelle(kopfbasis, kopfSchwelle);
	const wort = zahlen.zaehlweise === 'per_owner' ? 'Eigentümern' : 'Stimmen';

	// Dieselbe Sprache wie beim gesetzlichen Beispiel. Zwei Karten mit
	// verschiedenen Formulierungen für dieselbe Rechnung lesen sich wie zwei
	// verschiedene Rechnungen.
	const einleitung =
		regel.kopfbasis === 'anwesend_vertreten'
			? zahlen.anwesend === undefined
				? ohneBeklagten
					? `Bei ${kopfbasis} ${wort} ohne den Beklagten, wenn alle erschienen oder vertreten sind:`
					: einsprache
					? // Derselbe Wortlaut wie `zahlenbeispiel` (Codeprüfung N2, 19.10.2026).
						`Bei ${kopfbasis} ${wort} ohne den Eigentümer, der verkauft, vermietet oder belastet, ` +
						'wenn alle übrigen erschienen oder vertreten sind:'
					: `Bei ${kopfbasis} ${wort}, wenn alle erschienen oder vertreten sind:`
				: `Bei ${kopfbasis} anwesenden oder vertretenen ${wort}:`
			: regel.kopfbasis === 'alle_eigentuemer'
				? `Bei ${kopfbasis} ${wort} — unabhängig davon, wer erscheint:`
				: ohneBeklagten && zahlen.beklagtenwohnungen
					? `Bei ${kopfbasis} ${wort}, die Wohnung des Beklagten mitgezählt:`
					: einsprache
						? `Bei ${kopfbasis} ${wort} ohne den Eigentümer, der verkauft, vermietet oder belastet:`
						: `Bei ${kopfbasis} ${wort} ohne die unmittelbar Betroffenen:`;

	let satz = `${einleitung} nötig sind ${noetig} Ja-Stimmen`;

	if (regel.quotenSchwelle && zahlen.gesamtquote > 0) {
		/*
		 * **Keine Zahl aus der falschen Basis** (Nachprüfung 23.08.2026).
		 *
		 * Hier stand `regel.quotenbasis === 'anwesend_vertreten' ? gesamtquote :
		 * gesamtquote` — zwei gleiche Zweige. Wo die Regel auf die anwesenden
		 * Wertquoten abstellt, rechnete das Beispiel also gegen alle und nannte
		 * eine Zahl, die im Saal nicht gilt: Bei 1000 Quoten und der Hälfte
		 * stünde «mindestens 501 von 1000», während tatsächlich die Hälfte der
		 * erschienenen Quoten genügt.
		 *
		 * Die anwesende Quote kennt die Anwendung vor der Versammlung nicht —
		 * `Kennzahlen` führt sie nicht. Deshalb hier keine Zahl, sondern der
		 * Anteil in Worten. Eine ausgedachte Zahl wäre schlimmer als keine, denn
		 * eine Zahl liest sich wie gerechnet.
		 */
		if (regel.quotenbasis === 'anwesend_vertreten') {
			satz +=
				` und zugleich ${anteilInWorten(regel.quotenSchwelle)} der anwesenden oder ` +
				'vertretenen Wertquoten';
		} else {
			satz += ` und zugleich mindestens ${rechneSchwelle(zahlen.gesamtquote, regel.quotenSchwelle)} von ${zahlen.gesamtquote} Wertquoten`;
		}
	}
	return satz + '.';
}

// ── Prüfstand des Reglements ────────────────────────────────────────────────

/**
 * Ob und wann das Reglement einer Gemeinschaft auf abweichende Quoren
 * durchgesehen wurde.
 *
 * Der Unterschied zwischen «keine Abweichung hinterlegt» und «noch nie
 * nachgesehen» ist der ganze Punkt: Beides sieht in einer Liste gleich aus und
 * bedeutet das Gegenteil.
 */
export interface Reglementspruefstand {
	geprueftAm: string | null;
	geprueftDurch: string | null;
	anzahlRegeln: number;
	/** Was sich nicht als Regel fassen liess. Erscheint bei jeder Herleitung. */
	freitext: string | null;
}

export function pruefungOffen(stand: Reglementspruefstand): boolean {
	return stand.geprueftAm === null;
}

export function pruefungshinweis(stand: Reglementspruefstand): string {
	if (pruefungOffen(stand)) {
		return (
			'Das Reglement dieser Gemeinschaft wurde noch nie auf abweichende Quoren durchgesehen. ' +
			'Solange das offen ist, gilt hier das Gesetz — möglicherweise zu Unrecht.'
		);
	}
	if (stand.anzahlRegeln === 0) {
		return (
			`Durchgesehen am ${stand.geprueftAm}${stand.geprueftDurch ? ` von ${stand.geprueftDurch}` : ''}: ` +
			`keine abweichenden Quoren im Reglement.`
		);
	}
	return (
		`Durchgesehen am ${stand.geprueftAm}${stand.geprueftDurch ? ` von ${stand.geprueftDurch}` : ''}: ` +
		`${stand.anzahlRegeln} ${stand.anzahlRegeln === 1 ? 'Abweichung' : 'Abweichungen'} hinterlegt.`
	);
}

/**
 * Die Prüfung als erledigt vermerken.
 *
 * Auch die Bestätigung «keine Abweichung» ist ein Ergebnis und gehört
 * festgehalten — sonst steht die Gemeinschaft ewig auf «noch nie nachgesehen».
 */
export function bestaetigeReglementspruefung(
	stwegId: Id,
	tag: string,
	person: string,
	anzahlRegeln: number
): Uebergang<{ geprueftAm: string; geprueftDurch: string }> {
	if (!istKalendertag(tag)) {
		throw new FachlicherFehler('datum_ungueltig', 'Das Prüfdatum ist kein gültiges Datum.', 'geprueftAm');
	}
	return uebergang(
		{ geprueftAm: tag, geprueftDurch: person },
		ereignis(EREIGNISARTEN.reglementGeprueft, { art: 'stweg', id: stwegId }, {
			am: tag,
			durch: person,
			regeln: anzahlRegeln
		})
	);
}

/** Die Bestätigung zurücknehmen, weil sich das Reglement geändert hat. */
export function setzeReglementspruefungZurueck(stwegId: Id, grund: string): Uebergang<null> {
	const text = grund?.trim() ?? '';
	if (zeichenzahl(text) < 3) {
		throw new FachlicherFehler(
			'grund_fehlt',
			'Warum die Prüfung zurückgesetzt wird, gehört festgehalten.',
			'grund'
		);
	}
	return uebergang(
		null,
		ereignis(EREIGNISARTEN.reglementspruefungZurueckgesetzt, { art: 'stweg', id: stwegId }, { grund: text })
	);
}

/**
 * Ob das Reglement für seine eigene Änderung Einstimmigkeit verlangt
 * (Migration 101).
 *
 * **Den Fall kennt das Regelwerk seit je** — `k-reglement-eigene-schranke`,
 * Verhalten `gesperrt_reglement`: Wo diese Schranke gilt, darf keine
 * hinterlegte Abweichung sie mildern. Neu ist nur, dass die Gemeinschaft es
 * **einmal** hinterlegt, statt die Frage bei jedem Traktandum zu beantworten.
 * Wer sie nicht kannte, beantwortete sie falsch — und merkte es erst, wenn ein
 * Beschluss angefochten wurde.
 *
 * **Ohne Schranke keine Fundstelle**: Wer sie wieder herausnimmt, soll keinen
 * Verweis zurücklassen, der nichts mehr belegt. Dieselbe Regel wie bei der
 * Zählweise, der Vollmachtschranke und der Einberufungsfrist.
 */
export interface Aenderungsschranke {
	/** Ob die Schranke gilt. */
	einstimmig: boolean;
	/** Wo sie im Reglement steht. Pflicht, sobald sie gilt. */
	fundstelle: string | null;
}

export function pruefeAenderungsschranke(
	einstimmig: boolean,
	fundstelle: string | null | undefined
): Aenderungsschranke {
	if (!einstimmig) return { einstimmig: false, fundstelle: null };

	const beleg = fundstelle?.trim() ?? '';
	if (zeichenzahl(beleg) < 3) {
		throw new FachlicherFehler(
			'aenderungsschranke_ohne_fundstelle',
			'Zur Schranke gehört die Fundstelle im Reglement — der Artikel, der für die Änderung ' +
				'des Reglements Einstimmigkeit verlangt.',
			'aenderungsschrankeFundstelle'
		);
	}
	return { einstimmig: true, fundstelle: beleg };
}
