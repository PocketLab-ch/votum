/**
 * Fassung 2026-11-18: Erneuerungsfonds errichten getrennt von den Einlagen, und
 * die Einlage nach dem, was das Reglement zu Höhe und Grenze sagt (Auftrag
 * `.auftraege/2026-11-15-votum-erneuerungsfonds-reglement.md`, Entwurf
 * `…-erneuerungsfonds-entwurf.md`; Produktentscheide 15.11.2026, alle nach
 * Empfehlung).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-17 abgeleitet, nicht
 * abgeschrieben. Die Fassung 2026-11-17 bleibt unverändert.
 *
 * **Was sich ändert:**
 *
 *  - Die Antwort `f4-1-fonds` führt nicht mehr zur Karte, sondern zur Frage
 *    `f4-1-fonds-reglement`: Was sagt das Reglement zur Höhe der Einlage?
 *    Daneben die neue Antwort `f4-1-fonds-errichten` zur neuen Karte
 *    `k-erneuerungsfonds-errichten`.
 *  - `k-erneuerungsfonds` **behält die Kennung** und heisst «Einlage in den
 *    Erneuerungsfonds festsetzen oder ändern». Die Traktandenvorlage und
 *    hinterlegte Regeln hängen an der Kennung; alte Traktanden finden unter
 *    dieser Fassung dieselbe Rechnung und werden nicht als älteres
 *    Erfordernis gemeldet.
 *  - **Errichten:** einfaches Mehr nach überwiegender Meinung (Rz. 123 ad
 *    Art. 712l; Rz. 99 ad Art. 712m), Liver verlangt das qualifizierte Mehr.
 *    Der Streit steht als Hinweis, nicht als `gegenmeinung`: Die Karte rechnet
 *    die mildere Lesart, und `gegenmeinung` setzt die strengere voraus
 *    (`Ergebnisknoten.gegenmeinung`; Produktentscheid «Einfaches Mehr, mit
 *    Hinweis»).
 *  - **Über einer festen Grenze, bei fester Höhe ohne Anpassungsrecht, oder
 *    abweichend von Mindesteinlage oder Stand, ab dem die Einzahlungen ruhen:**
 *    neue Karte `k-erneuerungsfonds-ueber-reglement`, Geschäftsart
 *    `reglement`, damit das hinterlegte Mehr der Reglementsänderung der
 *    Gemeinschaft greift, wie an `k-reglement-normal`. Eine eigene Karte statt
 *    des Asts «Reglement oder Hausordnung ändern», den der Entwurf nannte: Das
 *    Mehr ist dasselbe, aber der Reglementstext muss nicht geändert werden
 *    (Rz. 85 ad Art. 712g), und das Protokoll soll die Einlage nennen, nicht
 *    eine Reglementsänderung.
 *  - **Über einer Grenze «in der Regel»:** neue Karte
 *    `k-erneuerungsfonds-grenze-in-der-regel`, gerechnet mit dem sicheren Weg,
 *    dem Mehr der Reglementsänderung (Produktentscheid «Sicherer Weg, mit
 *    Hinweis»; Hausregel 07.10.2026). Die Frage ist offen, nicht umstritten
 *    (Fachprüfung der Website, Runde 2, S1); deshalb keine `gegenmeinung`.
 *
 * **Wortlaut** nach der Website (`stockwerkbewirtschaftung-site`
 * `src/pages/ratgeber/erneuerungsfonds.astro` an `7363bbe`, Karten «Errichten»
 * und «Einlagen festlegen und ändern», Kasten «Beispiel», Praxis-Tipp),
 * geprüft in `quellen` `pruefung/berichte/2026-11-15-erneuerungsfonds-*`. Wo
 * ein Website-Satz länger ist als die 180 Zeichen von `check:texte`, steht er
 * hier in zwei Sätzen mit denselben Wörtern. Laien- und Fachprüfung der
 * Sätze dieser Fassung: `quellen`
 * `pruefung/berichte/2026-11-15-votum-erneuerungsfonds-*`.
 *
 * **Nach der ersten Prüfrunde dazu:** An allen vier Karten ersetzt der Satz
 * zur Entnahme (zwei Beschlüsse, Mehr der Bezahlung umstritten, Rz. 139 ad
 * Art. 712l) den alten Satz zur Verwendung; die Einlage stützt sich auf Ziff. 4
 * und 5 (Fachprüfung F-1, F-8).
 *
 * **Ein Ergebnis ändert sich** für neue Herleitungen: Wer bisher über
 * `f4-1-fonds` eine Einlage über einer festen Grenze des Reglements herleitete,
 * bekam das einfache Mehr (Fachprüfung der Website, Runde 2, R4: zu locker).
 */
import type { Antwort, Ergebnisknoten, Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_17 } from './quorum-2026-11-17';

const VOR = REGELWERK_2026_11_17;

export const FRAGE_GELD_ID = 'f4-1';
export const ANTWORT_FONDS_ID = 'f4-1-fonds';
export const ANTWORT_ERRICHTEN_ID = 'f4-1-fonds-errichten';
export const FRAGE_REGLEMENT_ID = 'f4-1-fonds-reglement';
export const EINLAGE_ID = 'k-erneuerungsfonds';
export const ERRICHTEN_ID = 'k-erneuerungsfonds-errichten';
export const UEBER_REGLEMENT_ID = 'k-erneuerungsfonds-ueber-reglement';
export const IN_DER_REGEL_ID = 'k-erneuerungsfonds-grenze-in-der-regel';

/** Der Titel von `k-erneuerungsfonds` und der Text von `f4-1-fonds` bis zur Fassung 2026-11-17. */
export const TITEL_VORHER = 'Erneuerungsfonds schaffen oder Beiträge festsetzen';

/** Wann die Monatsfrist der Anfechtung beginnt (Kasten «Beispiel» der Website; Rz. 230 ad Art. 712m). */
export const FRISTBEGINN =
	'Die Frist läuft für alle, die an der Versammlung waren oder vertreten wurden, ab der Versammlung. Für die ' +
	'anderen läuft sie in der Regel ab Erhalt des Protokolls.';

/**
 * Das Mehr der Bezahlung, mit dem Vorbehalt des Reglements und des Zwecks
 * (Fachprüfung Runde 2, N-1; Laienprüfung Runde 2, N4; Rz. 137 bis 139 ad
 * Art. 712l). Auch in der Hilfe an `f4-1-verwendung`.
 */
export const ENTNAHME_MEHR =
	'Welches Mehr die Bezahlung braucht, sollte das Reglement oder der Errichtungsbeschluss sagen. Sagt es keiner, ist ' +
	'es umstritten: Der SVIT-Kommentar lässt im Rahmen des Zwecks das einfache Mehr genügen, andere Autoren verlangen ' +
	'das qualifizierte (Rz. 139 ad Art. 712l). Ein Beschluss mit qualifiziertem Mehr genügt beiden Auffassungen, ' +
	'solange das Geld für den Zweck des Fonds verwendet wird. Ausserhalb des Zwecks braucht es die Zustimmung aller ' +
	'(Rz. 137 bis 139 ad Art. 712l).';

/** Die Hilfe an `f4-1-verwendung` bis zur Fassung 2026-11-17, und was an ihre Stelle tritt (Laien N3, Fach F-1). */
export const VERWENDUNG_HILFE_VORHER =
	'Die Verwendung folgt dem Erfordernis des Vorhabens: Eine Heizungssanierung wird nicht dadurch einfacher, dass ' +
	'sie aus dem Fonds bezahlt wird.';
export const VERWENDUNG_HILFE =
	'Für die Arbeit selbst gilt das Mehr des Vorhabens: Eine Heizungssanierung wird nicht dadurch einfacher, dass sie ' +
	'aus dem Fonds bezahlt wird. Diese Antwort führt zum Mehr der Arbeit, nicht zum Mehr der Bezahlung. Die ' +
	'Bezahlung aus dem Fonds ist ein zweiter Beschluss; kündigen Sie beide in der Einladung an. ' +
	ENTNAHME_MEHR;

/** Der Hinweis zur Verwendung, wie ihn `k-erneuerungsfonds` seit der Fassung 2026-07-30 trägt. */
export const VERWENDUNG_VORHER =
	'Die Verwendung der Mittel für ein konkretes Bauvorhaben folgt dem Erfordernis dieses Vorhabens, nicht diesem hier.';

/**
 * Was an seine Stelle tritt, an allen vier Karten (Fachprüfung F-1, Laienprüfung
 * 7): Die Bezahlung aus dem Fonds ist ein eigener Beschluss, und ihr Mehr ist
 * umstritten (Rz. 139 ad Art. 712l). Wortlaut nach der Website, Abschnitt «Mit
 * welchem Mehr Geld entnommen wird», mit dem sicheren Weg aus dem Praxis-Tipp.
 */
export const ENTNAHME =
	'Eine Arbeit aus dem Fonds zu bezahlen, braucht zwei Beschlüsse: einen über die Arbeit selbst, mit dem Mehr, das ' +
	'sie braucht, und einen über die Bezahlung aus dem Fonds. Kündigen Sie beide in der Einladung an. ' +
	ENTNAHME_MEHR;

// ── Errichten ───────────────────────────────────────────────────────────────

export const TITEL_ERRICHTEN = 'Erneuerungsfonds errichten';

/**
 * Der Lehrstreit mit beiden Meinungen und den Fundstellen. Rz. 123 ad
 * Art. 712l nennt Bloch, Meier-Hayoz/Rey und Weber für das einfache Mehr und
 * Liver dagegen (Fachprüfung Fachliteratur, 15.11.2026); Rz. 99 ad Art. 712m
 * sagt dasselbe ohne Gegenmeinung.
 */
export const ERRICHTEN_STREIT =
	'Welches Mehr das Errichten braucht, ist umstritten. Nach überwiegender Meinung der Fachliteratur genügt das einfache Mehr (SVIT-Kommentar Rz. 123 ad ' +
	'Art. 712l, Rz. 99 ad Art. 712m). Der Autor Liver verlangt das qualifizierte Mehr, weil er die Errichtung für eine ' +
	'wichtigere Verwaltungshandlung hält (Art. 647b ZGB; nach Rz. 123 ad Art. 712l).';

/** Der sichere Weg, im Wortlaut des Praxis-Tipps der Website. */
export const ERRICHTEN_SICHER =
	'Wer sicher gehen will, fasst den Beschluss so, dass er auch das qualifizierte Mehr erreicht. Dann genügt er ' +
	'beiden Auffassungen. Dafür müssen zusätzlich mehr als die Hälfte aller Wertquoten zustimmen, auch die der ' +
	'Abwesenden zählen mit. Weil fehlende Wertquoten dabei wie ein Nein wirken, lohnt es sich, von Verhinderten ' +
	'vorher eine Vollmacht einzuholen.';

/**
 * Was gilt, wenn nur das einfache Mehr erreicht ist, aus dem Praxis-Tipp der
 * Website, mit dem Protokollsatz der übrigen Karten (Laienprüfung 5,
 * Fachprüfung F-6: Die Auszählung zählt die Wertquoten auch beim einfachen
 * Mehr, als Auskunft).
 */
export const ERRICHTEN_KNAPP =
	'Reicht es nur für das einfache Mehr, trägt der Beschluss nach der überwiegenden Meinung. Wer nicht zugestimmt ' +
	'hat, könnte ihn aber innert eines Monats anfechten, und ein Gericht könnte der strengeren Auffassung folgen. ' +
	`${FRISTBEGINN} Halten Sie im Protokoll fest, wie viele Köpfe und Wertquoten zugestimmt haben.`;

/** Der Mindestinhalt des Errichtungsbeschlusses (Fachprüfung F-5; Rz. 125 und 139 ad Art. 712l). */
export const ERRICHTEN_INHALT =
	'Der Errichtungsbeschluss sollte mindestens regeln, wer wie viel einzahlt und wofür das Geld verwendet werden ' +
	'darf. Dazu gehört, mit welchem Mehr über eine Entnahme entschieden wird (SVIT-Kommentar Rz. 125 und 139 ad ' +
	'Art. 712l).';

/** Errichten und erste Einlage im selben Antrag (Laienprüfung 1). */
export const ERRICHTEN_ERSTE_EINLAGE =
	'Beschliesst die Versammlung zugleich die erste Einlage, prüfen Sie deren Mehr zusätzlich mit der Antwort ' +
	'«Einlage in den Erneuerungsfonds festsetzen oder ändern». Braucht die Einlage ein strengeres Mehr, gilt es für ' +
	'einen gemeinsamen Antrag; stimmen Sie deshalb besser getrennt ab.';

/** Karte «Errichten» der Website: im Reglement mit dessen Mehr, keine Delegation (Rz. 122, 124 ad Art. 712l). */
export const ERRICHTEN_REGLEMENT =
	'Soll der Fonds im Reglement stehen, braucht es das Mehr, das eine Reglementsänderung braucht. Wählen Sie dafür ' +
	'am Anfang «Reglement oder Hausordnung ändern».';
export const ERRICHTEN_KEINE_DELEGATION =
	'Die Bewirtschaftung oder ein Ausschuss können den Fonds nicht selbst errichten.';

const ERRICHTEN: Ergebnisknoten = {
	id: ERRICHTEN_ID,
	titel: TITEL_ERRICHTEN,
	typ: 'einfaches_mehr',
	geschaeftsart: 'jahresgeschaefte',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 5',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung: 'Über die Schaffung eines Erneuerungsfonds beschliesst die Versammlung.',
	hinweise: [
		ERRICHTEN_STREIT,
		ERRICHTEN_SICHER,
		ERRICHTEN_KNAPP,
		ERRICHTEN_ERSTE_EINLAGE,
		ERRICHTEN_INHALT,
		ERRICHTEN_REGLEMENT,
		ERRICHTEN_KEINE_DELEGATION,
		ENTNAHME
	],
	/*
	 * Streit, sicherer Weg und was bei knappem Ausgang gilt, erklären das
	 * gesetzliche Mehr; unter einer angewandten Regel der Gemeinschaft stehen
	 * sie beim Gesetz. Die übrigen gelten unter jeder Regel.
	 */
	hinweiseUnterRegel: [
		{ hinweis: ERRICHTEN_STREIT, zumGesetz: true },
		{ hinweis: ERRICHTEN_SICHER, zumGesetz: true },
		{ hinweis: ERRICHTEN_KNAPP, zumGesetz: true }
	],
	reglementsverhalten: 'frei',
	rang: 'gesetz'
};

// ── Einlage (bisherige Karte, Kennung bleibt) ───────────────────────────────

export const TITEL_EINLAGE = 'Einlage in den Erneuerungsfonds festsetzen oder ändern';

/** Karte «Einlagen festlegen und ändern» der Website, die ersten beiden Sätze. */
export const EINLAGE_VERTEILUNG = 'Verteilt wird nach Wertquote, wenn nichts anderes bestimmt ist.';
export const EINLAGE_FREI =
	'Die Versammlung bestimmt Höhe und Rhythmus der Einzahlungen mit einfachem Mehr, solange das Reglement ' +
	`nichts anderes vorsieht. ${EINLAGE_VERTEILUNG}`;

/** Was diese Karte voraussetzt; das Gegenstück zu den beiden neuen Karten (R4). */
export const EINLAGE_VORAUSSETZUNG =
	'Diese Karte gilt nicht, wenn der Antrag eine Höhe ändert, die das Reglement ohne Anpassungsrecht festlegt. ' +
	'Ebenso nicht, wenn er über einer Grenze liegt, die die Versammlung nicht selbst ändern darf, oder unter einer ' +
	'Mindesteinlage bleibt. Ebenso nicht, wenn er weiter einzahlen lässt, obwohl der Stand erreicht ist, ab dem die ' +
	'Einzahlungen ruhen. Wählen Sie dann bei der Frage zum Reglement die passende Antwort. Darf die Versammlung ' +
	'die Höhe, die Grenze, die Mindesteinlage oder den Stand selbst ändern, gilt diese Karte, soweit dieses Recht ' +
	'reicht.';

// ── Über der Grenze oder Höhe im Reglement ──────────────────────────────────

/** «abweicht» statt «über»: Auch eine tiefere Einlage als die feste Höhe gehört hierher (Laienprüfung 8). */
export const TITEL_UEBER_REGLEMENT = 'Einlage, die vom Reglement abweicht';

/** Rz. 85 ad Art. 712g: Abweichung per Beschluss mit dem Mehr der Änderung, ohne den Text zu ändern (Fach L1). */
export const UEBER_BEGRUENDUNG =
	'Wer mit einem Beschluss vom Reglement abweicht, braucht dasselbe Mehr wie für eine Reglementsänderung. Der ' +
	'Text des Reglements muss dafür nicht geändert werden.';

/** Karte «Einlagen festlegen und ändern» der Website, Satz drei und vier, mit den Fundstellen aus `fragen.md` Nr. 80. */
export const UEBER_HOEHE =
	'Steht die Höhe im Reglement selbst, als Betrag oder Prozentsatz, braucht ihre Änderung in der Regel das Mehr ' +
	'einer Reglementsänderung. Das gilt nicht, wenn das Reglement der Versammlung erlaubt, sie anzupassen.';
export const UEBER_GRENZE =
	'Setzt das Reglement eine feste Obergrenze für die jährliche Einlage, beschliesst die Versammlung bis zu dieser ' +
	'Grenze mit einfachem Mehr. Darüber braucht es dasselbe Mehr wie für eine Reglementsänderung.';
/** Mindesteinlage und Stand, ab dem die Einzahlungen ruhen (Fachprüfung F-2; Rz. 125, 130 ad Art. 712l). */
export const UEBER_MINDEST =
	'Dasselbe gilt, wenn der Antrag unter einer Mindesteinlage des Reglements bleibt. Ebenso, wenn er weiter ' +
	'einzahlen lässt, obwohl der Fonds den Stand erreicht hat, ab dem die Einzahlungen nach dem Reglement ruhen.';
export const UEBER_FUNDSTELLEN =
	'Das folgt aus dem SVIT-Kommentar zum Verteilschlüssel (Rz. 85 ad Art. 712g, Rz. 80 ad Art. 712h) und aus ' +
	'Rz. 134 ad Art. 712l. Den Stand, ab dem die Einzahlungen ruhen, nennt er in Rz. 125 und 130 ad Art. 712l.';

/** Kasten «Beispiel» der Website, die Anfechtung mit dem Fristbeginn (Runde 3, R1). */
export const UEBER_ANFECHTUNG =
	'Wird die Einlage trotzdem mit einfachem Mehr beschlossen, kann jede Eigentümerin, die nicht zugestimmt hat, ' +
	`den Beschluss innert eines Monats beim Gericht anfechten. ${FRISTBEGINN}`;

/** Laienprüfung Runde 1, Befund 9, und Fachprüfung Runde 2: Die Dauer hängt am Antrag, nicht an einer Fundstelle. */
export const UEBER_DAUER = 'Nennen Sie im Antrag, für welche Jahre die abweichende Einlage gilt.';

/**
 * Kasten «Beispiel» der Website, der letzte Satz. Dort folgt er auf den
 * sicheren Weg und beginnt mit «dafür»; hier steht er für sich, mit dem Grund
 * aus dem Praxis-Tipp (fehlende Wertquoten wirken wie ein Nein).
 */
export const VOLLMACHT_PROTOKOLL =
	'Weil fehlende Wertquoten wie ein Nein wirken, holen Sie von Verhinderten vorher eine Vollmacht ein. Halten Sie ' +
	'im Protokoll fest, wie viele Köpfe und Wertquoten zugestimmt haben.';

/**
 * Der Hinweis zur Milderung und Erschwerung des Reglementsmehrs, wörtlich wie
 * an `k-reglement-normal` (Fassung 2026-10-14, geprüft): Der Kasten zu
 * `einordnen` verweist auf ihn («steht im Hinweis der einzelnen Karte»), und
 * die beiden Karten rechnen mit einer hinterlegten Regel wie jene
 * (Codeprüfung M1).
 */
const REGLEMENT_NORMAL_VOR = VOR.knoten.find((k) => k.id === 'k-reglement-normal');
export const MILDERUNG = REGLEMENT_NORMAL_VOR?.hinweise?.[0] ?? '';
if (
	!MILDERUNG.startsWith('Ihr Reglement kann dieses Quorum mildern') ||
	!REGLEMENT_NORMAL_VOR?.hinweiseUnterRegel?.some((u) => u.hinweis === MILDERUNG && u.zumGesetz === true)
) {
	throw new Error('Fassung 2026-11-18: Der Hinweis zur Milderung an «k-reglement-normal» ist ein anderer.');
}

/**
 * Was unter einer angewandten Regel zum Gesetz wandert (Codeprüfung M2): Die
 * Sätze zum einfachen Mehr, zur Anfechtung und zu den Wertquoten setzen das
 * gesetzliche Mehr voraus; unter einer milderen Regel stimmten sie nicht.
 */
const UNTER_REGEL_ZUM_GESETZ = [
	{ hinweis: MILDERUNG, zumGesetz: true as const },
	{ hinweis: UEBER_ANFECHTUNG, zumGesetz: true as const },
	{ hinweis: VOLLMACHT_PROTOKOLL, zumGesetz: true as const }
];

/**
 * Wie `k-reglement-normal` (Fassung 2026-10-06): qualifiziertes Mehr nach
 * Art. 712g Abs. 3, Geschäftsart `reglement`, Verhalten `einordnen`; damit
 * rechnet die Karte mit dem hinterlegten Mehr der Reglementsänderung, wo eine
 * Gemeinschaft eines hat. Rang `lehre`: Das Gesetz nennt die Abweichung per
 * Beschluss nicht, die Rechnung ist eine Folgerung aus dem Kommentar.
 */
const UEBER_REGLEMENT: Ergebnisknoten = {
	id: UEBER_REGLEMENT_ID,
	titel: TITEL_UEBER_REGLEMENT,
	typ: 'qualifiziertes_mehr',
	geschaeftsart: 'reglement',
	rechtsgrundlage: 'ZGB Art. 712g Abs. 3',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	zustimmungBetroffenerNoetig: false,
	begruendung: UEBER_BEGRUENDUNG,
	hinweise: [
		UEBER_HOEHE,
		UEBER_GRENZE,
		UEBER_MINDEST,
		UEBER_FUNDSTELLEN,
		UEBER_ANFECHTUNG,
		UEBER_DAUER,
		VOLLMACHT_PROTOKOLL,
		MILDERUNG,
		ENTNAHME
	],
	hinweiseUnterRegel: UNTER_REGEL_ZUM_GESETZ,
	reglementsverhalten: 'einordnen',
	rang: 'lehre'
};

// ── Über einer Grenze «in der Regel» ────────────────────────────────────────

export const TITEL_IN_DER_REGEL = 'Einlage über einer Grenze, die nur «in der Regel» gilt';

/** Kasten «Beispiel» und Karte der Website: offen, sicher mit dem Mehr der Reglementsänderung. */
export const IN_DER_REGEL_BEGRUENDUNG =
	'Gilt die Grenze nur «in der Regel», ist offen, ob eine begründete Ausnahme mit einfachem Mehr genügt. Sicher ' +
	'ist der Beschluss mit dem Mehr einer Reglementsänderung; mit diesem Mehr rechnet diese Karte.';

/** Die eher getragene Lesart, als Folgerung (Fachprüfung der Website, Runde 1; `fragen.md` Nr. 80). */
export const IN_DER_REGEL_EHER =
	'Aus den Auslegungsregeln des SVIT-Kommentars folgt eher, dass eine begründete Ausnahme mit einfachem Mehr ' +
	'genügt (Rz. 105 und 172b ad Art. 712g). Entschieden ist das nicht.';

/**
 * Was im Saal gilt, wenn nur das einfache Mehr erreicht ist, und der Grund im
 * Antrag (Fachprüfung F-7, Laienprüfung 11). Die Karte rechnet den sicheren
 * Weg, weil ein Beschluss über einer Grenze des Reglements anfechtbar ist;
 * beim Errichten rechnet sie die überwiegende Meinung, weil dort Lehrmeinungen
 * gegeneinander stehen und keine Bestimmung des Reglements.
 */
export const IN_DER_REGEL_KNAPP =
	'Erreicht der Antrag nur das einfache Mehr, ist er nach dieser Karte abgelehnt. Wird die Ausnahme trotzdem mit ' +
	'einfachem Mehr beschlossen, kann den Beschluss innert eines Monats anfechten, wer nicht zugestimmt hat. Ob ein ' +
	`Gericht die Ausnahme gelten lässt, ist offen. ${FRISTBEGINN}`;
export const IN_DER_REGEL_GRUND =
	'Begründen Sie die Ausnahme im Antrag, etwa mit einer grossen Arbeit, die bald ansteht.';

const IN_DER_REGEL: Ergebnisknoten = {
	...UEBER_REGLEMENT,
	id: IN_DER_REGEL_ID,
	titel: TITEL_IN_DER_REGEL,
	begruendung: IN_DER_REGEL_BEGRUENDUNG,
	// Mit der Dauer wie an der Nachbarkarte (Laienprüfung Runde 3, R3-3).
	hinweise: [
		IN_DER_REGEL_EHER,
		IN_DER_REGEL_KNAPP,
		IN_DER_REGEL_GRUND,
		UEBER_DAUER,
		VOLLMACHT_PROTOKOLL,
		MILDERUNG,
		ENTNAHME
	],
	hinweiseUnterRegel: [
		{ hinweis: IN_DER_REGEL_KNAPP, zumGesetz: true },
		{ hinweis: VOLLMACHT_PROTOKOLL, zumGesetz: true },
		{ hinweis: MILDERUNG, zumGesetz: true }
	]
};

// ── Die Frage zur Einlage ───────────────────────────────────────────────────

export const FRAGE_REGLEMENT_TEXT = 'Was sagt Ihr Reglement zur Höhe der Einlage?';
/**
 * Mit der Zuordnung unklarer Wortlaute (Laienprüfung 2) und der Regel bei zwei
 * passenden Antworten (Fachprüfung F-4): Die strengeren stehen unten.
 */
export const FRAGE_REGLEMENT_HILFE =
	'Lesen Sie die Bestimmung zum Erneuerungsfonds in Ihrem Reglement. Steht dort etwa «darf nicht übersteigen», ' +
	'ist die Grenze fest. Steht dort «in der Regel höchstens», gilt sie nur in der Regel. Lässt sich der Wortlaut ' +
	'keiner der beiden zuordnen, etwa bei «soll» oder «grundsätzlich», wählen Sie die Grenze «in der Regel»; beide ' +
	'führen zum selben Mehr. Darf die Versammlung Höhe oder Grenze selbst anpassen, gilt die zweite Antwort, soweit ' +
	'dieses Recht reicht. Passen sonst zwei Antworten, wählen Sie die untere.';

const FRAGE_REGLEMENT: Frage = {
	id: FRAGE_REGLEMENT_ID,
	text: FRAGE_REGLEMENT_TEXT,
	hilfe: FRAGE_REGLEMENT_HILFE,
	antworten: [
		{
			id: 'f4-1-fonds-frei',
			text: 'Nichts, oder die Versammlung setzt die Höhe frei fest',
			ziel: EINLAGE_ID
		},
		{
			// «Höhe oder Grenze» (Fachprüfung F-3), «ohne besonderes Mehr» (F-4); vor den
			// übrigen, weil das Anpassungsrecht vorgeht (Laien N1, Fach N-2, Runde 2).
			id: 'f4-1-fonds-anpassbar',
			text: 'Es erlaubt der Versammlung, Höhe oder Grenze ohne besonderes Mehr anzupassen, und der Antrag bleibt in diesem Rahmen',
			ziel: EINLAGE_ID,
			hilfe:
				// Fachprüfung Runde 3, N3-2 (Mindesteinlage); Laienprüfung Runde 3, R3-2 (Grenze «in der Regel»).
				'Das gilt auch für eine Mindesteinlage oder eine Grenze «darf nicht übersteigen», wenn die Versammlung ' +
				'sie selbst ändern darf. Nennt das Reglement für die Anpassung ein eigenes Mehr, gilt dieses, nicht das ' +
				'einfache Mehr. Erlaubt es die Anpassung nur bis zu einer Grenze und liegt der Antrag darüber, wählen ' +
				'Sie die Antwort zu dieser Grenze. Das ist die Antwort zur festen Obergrenze oder zur Grenze, die nur ' +
				'«in der Regel» gilt.'
		},
		{
			// Unter der Obergrenze, über der Mindesteinlage, oder die feste Höhe bestätigt (Laienprüfung 4).
			id: 'f4-1-fonds-im-rahmen',
			text: 'Es setzt Höhe oder Grenzen, und der Antrag hält sie ein',
			ziel: EINLAGE_ID
		},
		{
			// Fachprüfung F-2; enger nach Runde 2 (N-3): «darüber» gehört nicht hierher.
			id: 'f4-1-fonds-mindest',
			text: 'Der Antrag bleibt unter einer Mindesteinlage oder lässt weiter einzahlen, obwohl der Stand erreicht ist, ab dem die Einzahlungen ruhen',
			ziel: UEBER_REGLEMENT_ID
		},
		{
			id: 'f4-1-fonds-ueber-fest',
			text: 'Der Antrag liegt über einer festen Obergrenze für die jährliche Einlage',
			ziel: UEBER_REGLEMENT_ID,
			hilfe: 'Etwa wenn das Reglement sagt, die Einlage «darf 0.25 Prozent des Versicherungswerts nicht übersteigen», und beantragt sind 0.4 Prozent.'
		},
		{
			id: 'f4-1-fonds-hoehe',
			text: 'Es legt die Höhe selbst fest, ohne Anpassung durch die Versammlung, und der Antrag ändert sie',
			ziel: UEBER_REGLEMENT_ID
		},
		{
			id: 'f4-1-fonds-in-der-regel',
			text: 'Der Antrag liegt über einer Obergrenze, die nur «in der Regel» gilt',
			ziel: IN_DER_REGEL_ID
		}
	]
};

const ANTWORT_ERRICHTEN: Antwort = {
	id: ANTWORT_ERRICHTEN_ID,
	text: TITEL_ERRICHTEN,
	ziel: ERRICHTEN_ID
};

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

const VOR_GELD = VOR.fragen.find((f) => f.id === FRAGE_GELD_ID);
const VOR_FONDS = VOR_GELD?.antworten.find((a) => a.id === ANTWORT_FONDS_ID);
if (!VOR_FONDS || VOR_FONDS.ziel !== EINLAGE_ID || VOR_FONDS.text !== TITEL_VORHER || VOR_FONDS.hilfe) {
	throw new Error('Fassung 2026-11-18: «f4-1-fonds» führt in der Vorfassung nicht ohne Hilfe zu «k-erneuerungsfonds».');
}
const VOR_EINLAGE = VOR.knoten.find((k) => k.id === EINLAGE_ID);
if (
	!VOR_EINLAGE ||
	VOR_EINLAGE.titel !== TITEL_VORHER ||
	VOR_EINLAGE.typ !== 'einfaches_mehr' ||
	JSON.stringify(VOR_EINLAGE.hinweise) !== JSON.stringify([VERWENDUNG_VORHER]) ||
	VOR_EINLAGE.rechtsgrundlage !== 'ZGB Art. 712m Abs. 1 Ziff. 5'
) {
	throw new Error('Fassung 2026-11-18: «k-erneuerungsfonds» ist in der Vorfassung nicht die erwartete Karte.');
}
for (const id of [ERRICHTEN_ID, UEBER_REGLEMENT_ID, IN_DER_REGEL_ID, FRAGE_REGLEMENT_ID, ANTWORT_ERRICHTEN_ID]) {
	const gibtEs =
		[...VOR.knoten, ...VOR.fragen].some((x) => x.id === id) ||
		VOR.fragen.some((f) => f.antworten.some((a) => a.id === id));
	if (gibtEs) throw new Error(`Fassung 2026-11-18: «${id}» gibt es schon.`);
}
if (VOR.knoten.find((k) => k.id === 'k-reglement-normal')?.reglementsverhalten !== 'einordnen') {
	throw new Error('Fassung 2026-11-18: «k-reglement-normal» ordnet in der Vorfassung nicht ein; die neuen Karten folgen ihr.');
}

const EINLAGE: Ergebnisknoten = {
	...VOR_EINLAGE,
	titel: TITEL_EINLAGE,
	// Die jährliche Einlage stützt sich auf Ziff. 4, die Schaffung auf Ziff. 5 (Fachprüfung F-8; Rz. 128 ad Art. 712l).
	rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 4 und 5',
	hinweise: [EINLAGE_FREI, EINLAGE_VORAUSSETZUNG, ENTNAHME],
	/* Unter einer Regel der Gemeinschaft wandert das einfache Mehr zum Gesetz; die Verteilung bleibt. */
	hinweiseUnterRegel: [{ hinweis: EINLAGE_FREI, zumGesetz: true, ersatz: EINLAGE_VERTEILUNG }]
};

function mitFondsfrage(f: Frage): Frage {
	if (f.id !== FRAGE_GELD_ID) return f;
	return {
		...f,
		antworten: f.antworten.flatMap((a) => {
			if (a.id === ANTWORT_FONDS_ID) return [ANTWORT_ERRICHTEN, { ...a, text: TITEL_EINLAGE, ziel: FRAGE_REGLEMENT_ID }];
			if (a.id === 'f4-1-verwendung') {
				if (a.hilfe !== VERWENDUNG_HILFE_VORHER) {
					throw new Error('Fassung 2026-11-18: Die Hilfe an «f4-1-verwendung» ist in der Vorfassung eine andere.');
				}
				return [{ ...a, hilfe: VERWENDUNG_HILFE }];
			}
			return [a];
		})
	};
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_18 = {
	...VOR,
	fassung: '2026-11-18',

	fragen: [...VOR.fragen.map(mitFondsfrage), FRAGE_REGLEMENT],

	knoten: VOR.knoten.flatMap((k) => (k.id === EINLAGE_ID ? [ERRICHTEN, EINLAGE, UEBER_REGLEMENT, IN_DER_REGEL] : [k])),

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-18 trennt Votum das Errichten des Erneuerungsfonds von den Einlagen. Bei einer ' +
		'Einlage fragt es, was das Reglement zur Höhe sagt. Weicht der Antrag von einer festen Grenze ab oder von einer ' +
		'festen Höhe, die die Versammlung nicht anpassen darf, verlangt es das Mehr einer Reglementsänderung. Ebenso, ' +
		'wenn er unter einer Mindesteinlage bleibt oder weiter einzahlen lässt, obwohl der Stand erreicht ist. ' +
		'Über einer Grenze «in der Regel» verlangt es dieses Mehr als sicheren Weg.'
} satisfies Regelwerk;
