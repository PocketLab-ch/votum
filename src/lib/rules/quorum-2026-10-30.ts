/**
 * Fassung 2026-10-30: Fallgenauigkeit an der erweiterten Bewirtschaftung,
 * strengere Beschlussfähigkeit, Anfechtung mit Stelle und Berechtigtem (A4).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-10-29 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht mehr steht. Elf Punkte
 * (Auftrag A4 vom 30.10.2026, `.auftraege/2026-10-30-votum-a4-fassung-opencode.md`
 * im Arbeitsverzeichnis; Prüfung `quellen/pruefung/berichte/2026-10-30-votum-a4-fassung.md`),
 * jeder mit Fundstelle:
 *
 *  1. `k-bewirtschaftung-erweitert`: Verhalten `frei` wird `vereinbart`, und
 *     nur fallgenau. Eine hinterlegte Regel der ganzen Geschäftsart `organe`,
 *     gedacht für Wahlen, ersetzt hier nicht mehr das Mehr nach Köpfen und
 *     Wertquoten. Dazu ein Rechtssatz an diesem Knoten und an
 *     `k-verwaltung-wichtig` (dort fehlte sie im Rechtssatz; der Kasten trägt sie
 *     über `vereinbartBedingung` schon): Eine mildere
 *     Bestimmung als Art. 647b Abs. 1 gilt nur, wenn sie einstimmig oder im
 *     Begründungsakt eingeführt ist (Rz. 78, 78a, 84 ad Art. 712g), und ob
 *     Art. 647b Abs. 1 überhaupt erleichtert werden darf, ist umstritten
 *     (erleichterbar nach Rz. 35 ad Art. 712g mit Meier-Hayoz, Zgraggen,
 *     ZK-Wermelinger N 38; nicht nach Handschin/Wyttenbach S. 73). Eine Regel
 *     für «Wahlen» erfasst die Erweiterung nicht deutlich genug (Rz. 76 ad
 *     Art. 712g; Rz. 194 ad Art. 712m; BGer 5A_865/2011 E. 3.2). **Ändert
 *     Ergebnisse** (A1 Frage 2): Die Fallgenauigkeit trägt
 *     `regelNurFallgenau` in `regelwerk.ts`.
 *  2. Neuer Fall im Baum: strengere Beschlussfähigkeit im Reglement (A1
 *     Frage 3), erreichbar über «Reglement oder Hausordnung ändern» als
 *     eigene Antwort. Ergebnis Einstimmigkeit aller, Rechtsgrundlage
 *     ZGB Art. 712p Abs. 1 und 3; SVIT-Kommentar Rz. 9 ad Art. 712p,
 *     Rz. 90 ad Art. 712g. Unter das Gesetz geht es nicht (Rz. 8, 9, 42 ad
 *     Art. 712p); die zweite Versammlung darf nicht strenger sein als die
 *     erste (Rz. 43 ad Art. 712p; Handschin/Wyttenbach S. 76), angedeutet
 *     sogar milder, unentschieden (BGer 5A_865/2011 E. 5.2); eine Klausel,
 *     die die zweite Versammlung nicht nennt, gilt im Zweifel nur für die
 *     erste (E. 4.2 und 6); die Klausel darf die Versammlung nicht dauerhaft
 *     blockieren (E. 5.2). Ob die Rückkehr zur gesetzlichen Schwelle
 *     einstimmig sein muss, sagt der Bestand nicht.
 *  3. Anfechtung mit Stelle und Berechtigtem (A1 Frage 5): Der Wortlaut der
 *     Website aus `scripts/quorumsbaum-export.mjs` steht jetzt an der Karte,
 *     nicht nur im Abzug. `ANFECHTUNG` nennt Stelle und Frist mit Beginn
 *     (Rz. 230 ad Art. 712m), samt dem Rat, mit dem Vollzug bis nach Ablauf
 *     der Frist zu warten. An der Zuständigkeitsordnung
 *     (`HINWEIS_LESART`, Fassung 2026-10-26), an der Wahl mit erweiterten
 *     Kompetenzen (`WAHL_NACH_LESART`, Fassung 2026-10-24), an der eigenen
 *     Schranke und am Satz `TROTZDEM` (Fassungen 2026-10-15 und -16, die
 *     Frist nach Rz. 230 ad Art. 712m).
 *  4. Die Erklärung zum Wortlaut «aller Miteigentümer» wird je Artikel
 *     geführt: `wortlautErklaerungJeArtikel`. Für Art. 647a Abs. 2 gilt, was
 *     die Karte seit Fassung 2026-10-26 nennt (Rz. 166b ad Art. 712m;
 *     Handschin/Wyttenbach S. 68; BGE 131 III 459 E. 5.2); für Art. 647c ist
 *     nicht geprüft, was trägt, dort bleibt die bisherige Erklärung.
 *  5. Der Hauswart beim Ausschuss (F8-6; Fachprüfung A4, F-11): nicht geklärt
 *     (Rz. 115, 72 ad Art. 712m; Rz. 79 ad Art. 712s); sicher ist die Anstellung
 *     durch die Versammlung.
 *  6. Satz zu den Enthaltungen in den Ergebnistypen «einfaches Mehr» und
 *     «qualifiziertes Mehr» wie auf der Website: «Die Karten zählen wie die herrschende Lehre».
 *  7. Bezugsgrösse «alle» mit Vollmacht: Wer fernbleibt und niemanden
 *     bevollmächtigt hat, zählt mit (`bezugsgroessensatz`,
 *     `regelwerk.ts`), für alle Karten mit Basis «alle» (NZ-7).
 *  8. Anteil mehrerer Berechtigter am Weg der Einstimmigkeit und am Blatt,
 *     das im Saal unterschrieben wird (Rz. 22 ad Art. 712o; eine Folgerung
 *     daraus, dass Art. 712o nur für Beschlüsse an der Versammlung gilt,
 *     steht nicht als gesichert dabei).
 *  9. `SPERRE_NACH_LEHRE` mit dem nächsten Schritt: Wird eine abweichende
 *     Bestimmung im Saal eingewendet, halten Sie den Einwand im Protokoll
 *     fest, wie unter einer hinterlegten Regel.
 * 10. Antwort `f3-1-quoren` eingegrenzt: Die Bestimmung führt zur
 *     Einstimmigkeit (Art. 712g Abs. 2); eine Klausel, wer alltägliche
 *     Aufträge vergibt, gehört zur gewöhnlichen Bestimmung (Art. 647a Abs. 2
 *     als ausdrückliche Ausnahme, Rz. 78 ad Art. 712g), wie es seit Fassung
 *     2026-10-27 der Weg über «Organe» tut.
 * 11. Begründung von `k-organ-waehlen` nennt den Delegierten (N4).
 *
 * **Nicht in diesem Lauf** (Auftrag): A1 Frage 1 Punkte 3 und 5, die
 * Erfassungsmaske zu Punkt 2, Rz. 110 und 111 ad Art. 712h, der
 * Website-Abzug selbst.
 */
import type { Ergebnisknoten, Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_29, SCHRANKE_NEU, wegFuer } from './quorum-2026-10-29';
import { HINWEIS_LESART } from './quorum-2026-10-26';
import { HINWEIS_ERWEITERT } from './quorum-2026-10-24';
import { HAUSWART_AUSSCHUSS } from './quorum-2026-10-27';

// ── Punkt 3: Anfechtung mit Stelle und Berechtigtem ──────────────────────────

/**
 * Wie man anficht, in einem Zug (Sache der Website,
 * `scripts/quorumsbaum-export.mjs`): Stelle, Frist und Beginn (Rz. 230 ad
 * Art. 712m). Bewusst ohne Befehlsform: Die Karte liest die Leitung, die den
 * Beschluss festhält, angefochten wird er von anderen (Laienprüfung A4, L-9).
 */
export const ANFECHTUNG =
	'Angefochten wird beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde. ' +
	'Die Frist beträgt einen Monat ab Kenntnis; innert dieser Frist muss das Gesuch eingereicht sein. Wer an der Versammlung da oder vertreten war, rechnet ab ' +
	'der Versammlung. Wer weder da noch vertreten war, rechnet in der Regel ab Erhalt des Protokolls.';

/** Bis wann die Frist läuft: Rz. 230, 231 ad Art. 712m (Fachprüfung A4, F-9). */
const PROTOKOLL_RASCH =
	'Als Leitung sorgen Sie dafür, dass das Protokoll rasch und nachweisbar zugestellt wird, etwa eingeschrieben; für Abwesende beginnt die Frist erst dann.';

/** An der Zuständigkeitsordnung, hinter dem Satz zu beiden Lesarten. */
export const ANFECHTUNG_ZUSTAENDIGKEIT =
	`Rechnet Ihre Gemeinschaft nach dem einfachen Mehr und erreicht der Beschluss nur dieses, ist er nach dieser Karte zustande gekommen. Ein ` +
	`Gericht könnte der strengeren Lesart folgen. Wer nicht zugestimmt hat, kann ihn deshalb ` +
	`anfechten. ${ANFECHTUNG} ${PROTOKOLL_RASCH} ` +
	'Wenden Sie den Beschluss, wo es nicht eilt, erst an, wenn diese Frist für alle abgelaufen ist.';

/** An der Wahl mit schon erweiterten Kompetenzen, hinter dem Satz zu beiden Lesarten. */
export const ANFECHTUNG_WAHL =
	`Rechnet Ihre Gemeinschaft nach dem einfachen Mehr und erreicht die Wahl nur dieses, ist sie nach dieser Karte gültig. Ein Gericht könnte der ` +
	`anderen Meinung folgen. Wer nicht zugestimmt hat, kann sie deshalb anfechten. ${ANFECHTUNG} ${PROTOKOLL_RASCH} ` +
	'Unterschreiben Sie den neuen Vertrag, wo es nicht eilt, erst, wenn diese Frist für alle abgelaufen ist.';

/**
 * An der eigenen Schranke, anstelle von `SCHRANKE_NEU`: Wer der Ablehnung
 * nicht zugestimmt hat und die Klausel für ungültig hält, kann anfechten;
 * dazu, was das Gericht richtet (Rz. 233a, 234 und 235a ad Art. 712m).
 */
export const EIGENE_SCHRANKE_STREIT =
	'Erreicht der Beschluss nur das qualifizierte Mehr, halten Sie ihn nach der strengen Lesart als ' +
	'abgelehnt fest. Wer der Ablehnung nicht zugestimmt hat und die Klausel für ungültig hält, kann ' +
	`diese Ablehnung anfechten. Nicht zugestimmt hat, wer für die Änderung gestimmt hat, sich enthalten ` +
	`hat oder weder da noch vertreten war. ${ANFECHTUNG} ` +
	'Ob das Gericht dann nur die Ablehnung aufhebt oder die Änderung selbst in Kraft setzt, ist nicht ' +
	'sicher (ZGB Art. 75 i.V.m. Art. 712m Abs. 2; SVIT-Kommentar Rz. 233a, 234 und 235a ad Art. 712m). ' +
	'Wird der Beschluss trotzdem als angenommen festgehalten, ist er anfechtbar, falls die Klausel gilt.';

/**
 * Hinter dem Satz `TROTZDEM` (Fassungen 2026-10-15 und -16): Wer bei der
 * Einführung nicht zugestimmt hat, kann den Einführungsbeschluss anfechten.
 * Der Rat zum Vollzug nennt beide Fristen: Der neue Beschluss hat seine eigene
 * (Art. 75 ZGB; Rz. 230 ad Art. 712m; Fachprüfung A4, F-10).
 */
export const ANFECHTUNG_EINFUEHRUNG =
	'Haben Sie bei der Einführung nicht zugestimmt, können Sie diesen Beschluss innert dieser Monatsfrist ' +
	'anfechten; ist sie abgelaufen, ist das in der Regel nicht mehr möglich. Angefochten wird beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde. Ein Schreiben ' +
	'an die Verwaltung genügt nicht. Als Leitung vollziehen Sie einen Beschluss, der auf der Bestimmung ' +
	'beruht, wo es nicht eilt, erst nach Ablauf seiner eigenen Anfechtungsfrist. Ist die Einführung noch ' +
	'anfechtbar, warten Sie auch deren Frist ab.';

/** Wo die Frist steht, an die die Anfechtung gesetzt wird. */
const FRIST_ENDE = ' (Rz. 230 ad Art. 712m).';

// ── Punkt 5: Hauswart beim Ausschuss ─────────────────────────────────────────

/**
 * Nach der Fachprüfung A4 (F-11) anders als der Auftrag: Rz. 115 ad Art. 712m
 * schliesst Verwalter und Ausschuss gleich aus und nennt den Hauswart nicht.
 * Rz. 72 und Rz. 79 ad Art. 712s tragen die Gegenseite, deshalb «nicht
 * geklärt». Die Website trägt dieselbe Aussage (`HAUSWART_WEBSITE` im Export).
 */
export const HAUSWART_KARTE =
	'Ob ein Ausschuss den Hauswart selbst anstellen darf, ist nicht geklärt. Wichtigere ' +
	'Verwaltungshandlungen lassen sich nicht abtreten (SVIT-Kommentar Rz. 115 ad Art. 712m). Ohne ' +
	'Verwalter kann ein Ausschuss aber dessen Aufgaben übernehmen (Rz. 72 ad Art. 712m). Sicher ist die ' +
	'Anstellung durch die Versammlung; ist eine Eigentümerin selbst Kandidatin, stimmt sie dabei nicht mit ' +
	'(BGE 134 III 481 E. 3.7). Die Anstellung kann auch im Vertrag mit der Bewirtschaftung stehen (Rz. 79 ad ' +
	'Art. 712s). Das geht über ihr ordentliches Pflichtenheft hinaus; beschliessen Sie es über die Karte ' +
	'«Bewirtschaftung mit erweiterten Kompetenzen». Dem Ausschuss können Sie die Vorbereitung übertragen, ' +
	'etwa Bewerbungen sichten und einen Vorschlag machen.';

// ── Punkt 8: Anteil mehrerer Berechtigter ────────────────────────────────────

/**
 * Wer bei einer Wohnung mit mehreren Berechtigten unterschreibt (Rz. 22 ad
 * Art. 712o), wie auf der Website (`WEG_MEHRERE` im Export). Dass Art. 712o
 * nur für Beschlüsse an der Versammlung gilt (Rz. 2a, 19 ad Art. 712o), ist
 * eine Folgerung und steht deshalb nicht als gesichert dabei.
 */
export const WEG_MEHRERE =
	'Gehört eine Wohnung mehreren, etwa Ehegatten oder einer Erbengemeinschaft, unterschreiben ' +
	'sicherheitshalber alle. Soll nur eine Person unterschreiben, ist das sicher mit einer schriftlichen ' +
	'Vollmacht der übrigen, die diesen Antrag nennt (SVIT-Kommentar Rz. 22 ad Art. 712o).';

/**
 * Der Weg der Einstimmigkeit aus der Vorfassung, mit dem Satz zu mehreren
 * Berechtigten an jeder Stelle, an der ein Blatt unterschrieben wird. Am
 * Zirkularbeschluss steht er hinter dem Satz zur fehlenden Unterschrift.
 */
function mitMehreren(id: string): string {
	const vorher = wegFuer(id);
	const imSaal = 'die übrigen dasselbe Blatt danach.';
	if (vorher.includes(imSaal)) return ersetze(vorher, imSaal, `${imSaal} ${WEG_MEHRERE}`);
	const zirkular = 'kommt er nicht zustande; dann braucht es eine Versammlung (SVIT-Kommentar Rz. 125, 128 ad Art. 712m).';
	if (vorher.includes(zirkular)) return ersetze(vorher, zirkular, `${zirkular} ${WEG_MEHRERE}`);
	throw new Error(`Fassung 2026-10-30: Der Weg der Einstimmigkeit an «${id}» nennt kein Blatt, das unterschrieben wird.`);
}

// ── Hilfen ───────────────────────────────────────────────────────────────────

/**
 * Ersetzt einen Teilstring, der genau einmal vorkommt; sonst bricht die
 * Fassung ab, bevor sie ausgeliefert wird. Dasselbe Muster wie im Export
 * (`ersetzeGenau`): Ein Ersatz, der nichts ersetzt, wäre still falsch.
 */
function ersetze(text: string, alt: string, neu: string): string {
	if (text.split(alt).length !== 2) {
		throw new Error(`Fassung 2026-10-30: «${alt.slice(0, 60)}…» kommt nicht genau einmal vor.`);
	}
	return text.replace(alt, neu);
}

/**
 * Ersetzt einen Eintrag einer Liste, der genau einmal vorkommt; sonst bricht
 * die Fassung ab. Ein Hinweis, der still nicht ersetzt wird, wäre die Falle
 * von `UMFORMULIERUNGEN` im Export: Der Schlüssel veraltete still.
 */
function ersetzeInListe(liste: string[], alt: string, neu: string): string[] {
	const treffer = liste.filter((h) => h === alt);
	if (treffer.length !== 1) {
		throw new Error(`Fassung 2026-10-30: «${alt.slice(0, 60)}…» steht nicht genau einmal in der Liste.`);
	}
	return liste.map((h) => (h === alt ? neu : h));
}

/** Findet eine Frage der Vorfassung und bricht ab, wenn sie fehlt. */
function frage(id: string): Frage {
	const gefunden = REGELWERK_2026_10_29.fragen.find((f) => f.id === id);
	if (!gefunden) throw new Error(`Fassung 2026-10-30: Frage «${id}» fehlt in der Vorfassung.`);
	return gefunden;
}

// ── Punkt 1: Fallgenauigkeit an der erweiterten Bewirtschaftung ──────────────

/**
 * Der Rechtssatz an der erweiterten Bewirtschaftung, neu: Bedingung für jede
 * abweichende Bestimmung, Streit in beide Richtungen, Fallgenauigkeit und die
 * Ansage vor der Abstimmung. `TROTZDEM` kommt unten aus der Vorfassung dazu.
 */
/** Der Streit und was bei einem bloss milderen Mehr zu tun ist; an beiden Karten gleich (F-8, R2-F-1). */
const STREIT_647B =
	'Fachlich umstritten ist, ob sich Art. 647b Abs. 1 überhaupt ändern lässt: Der Kommentar hält Erschwerung und ' +
	'Erleichterung für zulässig (Rz. 35 ad Art. 712g, mit Meier-Hayoz und Zgraggen; ebenso ZK-Wermelinger N 38 nach ' +
	'Handschin/Wyttenbach Fn. 153), Handschin/Wyttenbach verneinen beides (S. 73). Erreicht ein Beschluss nur das ' +
	'mildere Mehr einer solchen Bestimmung, gilt er nach dem Kommentar; ganz sicher ist er nur, wenn er auch das Mehr ' +
	'des Gesetzes erreicht. Halten Sie das dann im Protokoll fest und vollziehen Sie ihn, wo es nicht eilt, erst nach ' +
	'Ablauf der Anfechtungsfrist.';

const RECHT_ERWEITERT =
	'Ihr Reglement kann für erweiterte Kompetenzen der Bewirtschaftung ein anderes Mehr vorsehen. Das gilt nur, ' +
	'wenn alle Eigentümer dieser Bestimmung zugestimmt haben oder sie im Begründungsakt steht, der Urkunde, mit ' +
	'der das Stockwerkeigentum errichtet wurde (SVIT-Kommentar Rz. 78, 78a und 84 ad Art. 712g). Auch eine höhere ' +
	'Zahl kann weniger verlangen als das Gesetz: «Zwei Drittel der Anwesenden» zählt nur Köpfe; nach dem Gesetz braucht es, ' +
	'so wie es gezählt wird, die Mehrheit der Anwesenden und Vertretenen und zusätzlich mehr als die Hälfte aller Wertquoten. Eine Regel für die Organe oder für Wahlen sagt, wie gewählt ' +
	'wird, nicht, welche Befugnisse ein Organ erhält. Sie gilt hier im Zweifel nicht (Rz. 76 ad Art. 712g; Rz. 194 ad ' +
	'Art. 712m; BGer 5A_865/2011 E. 3.2). Hinterlegen Sie sie für genau diesen Fall nur, wenn sie klar auch diese ' +
	'Erweiterung meint; für ihre Einführung gilt die Bedingung oben. Sonst zählt dieses Werkzeug nach dem Gesetz. ' +
	// Die Ansage, dass diesmal nach dem Gesetz gezählt wird, steht in der Absage
	// (`vorbehaltInWorten`, `nur_fallgenau`): Hier stand sie auch unter einer
	// angewandten Regel (Codeprüfung Prüfschritt A4, M1; Prüfrunde 6, R6-L-6, R6-F-6).
	STREIT_647B;

/** Die Bedingung für abweichende Bestimmungen, neu an der wichtigeren Verwaltungshandlung. */
const BEDINGUNG_WICHTIG =
	' Eine abweichende Bestimmung gilt nur, wenn alle Eigentümer ihr zugestimmt haben oder sie im Begründungsakt ' +
	`steht (Rz. 78, 78a und 84 ad Art. 712g). ${STREIT_647B}`;

/** Wo die Bedingung an der wichtigeren Verwaltungshandlung steht. */
const WICHTIG_ANKER = 'hält der Kommentar in der Regel für missbräuchlich (Rz. 196 ad Art. 712m).';

// ── Punkt 2: Strengere Beschlussfähigkeit im Reglement ──────────────────────

/**
 * Der neue Fall (A1 Frage 3): Der Beschluss, der eine strengere
 * Beschlussfähigkeit einführt, braucht die Zustimmung aller. Das ist Lehre
 * (Rz. 9 ad Art. 712p, Rz. 90 ad Art. 712g), Art. 712p Abs. 3 sagt es nicht
 * (Fachprüfung A4, F-4). Die Karte gilt für die Einführung, nicht für die
 * Beschlüsse unter der Klausel (F-6); gesperrt wie `k-reglement-quoren`.
 */
const BESCHLUSSFAEHIGKEIT: Ergebnisknoten = {
	id: 'k-reglement-beschlussfaehigkeit',
	titel: 'Strengere Beschlussfähigkeit ins Reglement aufnehmen',
	typ: 'einstimmigkeit',
	geschaeftsart: 'reglement',
	rechtsgrundlage: 'ZGB Art. 712p Abs. 1 und 3; SVIT-Kommentar Rz. 9 ad Art. 712p, Rz. 90 ad Art. 712g',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Wie viele Eigentümer anwesend oder vertreten sein müssen, damit die Versammlung beschliessen kann, sagt ' +
		'das Gesetz: an der ersten Versammlung die Hälfte aller Eigentümer mit der Hälfte der Wertquoten, an der ' +
		'zweiten, die einberufen wird, wenn an der ersten zu wenige da waren, ein Drittel aller Eigentümer, je ' +
		'mindestens zwei (ZGB Art. 712p). Das Reglement darf es strenger ' +
		'sagen, nach der Lehre aber nur mit der Zustimmung aller Eigentümer, auch der abwesenden, oder im Begründungsakt (SVIT-Kommentar Rz. 9 ad ' +
		'Art. 712p, Rz. 90 ad Art. 712g; Handschin/Wyttenbach S. 76). Diese Karte gilt für den Beschluss, der die ' +
		'Klausel einführt, nicht für die Beschlüsse danach.',
	beispiele: [
		'Die erste Versammlung beschliesst nur, wenn alle Eigentümer da oder vertreten sind; an der zweiten gilt die Schwelle des Gesetzes',
		'Neben der gesetzlichen Kopfzahl müssen an der ersten Versammlung drei Viertel der Wertquoten vertreten sein, an der zweiten die Hälfte'
	],
	hinweise: [
		'Unter die Schwelle des Gesetzes geht es nicht, auch nicht an der zweiten Versammlung, die einberufen ' +
		'wird, weil an der ersten zu wenige da oder vertreten waren (SVIT-Kommentar Rz. 8, 9 und 42 ad Art. 712p).',
		'Die zweite Versammlung darf keine strengere Beschlussfähigkeit verlangen als die erste (Rz. 43 ad ' +
		'Art. 712p; Handschin/Wyttenbach S. 76); das Bundesgericht hat angedeutet, sie müsse sogar milder ' +
		'sein, entschieden ist das nicht (BGer 5A_865/2011 E. 5.2).',
		'Die Klausel darf die Versammlung nicht dauerhaft blockieren; wo die Grenze liegt, sagt das Bundesgericht ' +
		'nicht (BGer 5A_865/2011 E. 5.2). Verlangt sie, dass alle anwesend oder vertreten sind, kann ein Einziger, der ' +
		'weder kommt noch sich vertreten lässt, die erste Versammlung am Beschliessen hindern. Eine Klausel, die die zweite Versammlung nicht nennt, gilt im Zweifel ' +
		'nur für die erste (BGer 5A_865/2011 E. 4.2 und 6); an der zweiten genügt dann das gesetzliche Drittel. Wollen Sie ' +
		'eine solche Klausel, nennen Sie die zweite Versammlung ausdrücklich: tiefer als an der ersten, nie unter dem ' +
		'gesetzlichen Drittel.',
		'Ob die Rückkehr zur gesetzlichen Schwelle die Zustimmung aller braucht, ist offen: Der SVIT-Kommentar ' +
		'nennt nur die Erschwerung (Rz. 9 ad Art. 712p). Sicher ist die Zustimmung aller.',
		'Ob eine Klausel, die mit weniger beschlossen wurde, nach Ablauf der Anfechtungsfrist trotzdem gilt, ist ' +
		'nicht geklärt: Dafür spricht BGE 143 III 537 E. 4.2.4 (dort zur Berechnungsweise). Halten Sie eine solche ' +
		'Klausel ein, solange sie nicht aufgehoben ist. Blockiert sie auch die zweite Versammlung, holen Sie Rat ein, ' +
		'bevor Sie deshalb nicht beschliessen.'
	],
	// Sperre nach der Lehre (`sperreNachLehre`), ohne Rechtssatz: Die Zustimmung
	// aller steht nicht im Gesetz, «ausgezählt nach dem Gesetz» wäre falsch
	// (Codeprüfung A4, M2).
	reglementsverhalten: 'gesperrt_zwingend',
	rang: 'lehre',
	einstimmigkeitsweg: mitMehreren('k-reglement-beschlussfaehigkeit')
};

/** Die neue Antwort an der Frage zum Reglement, hinter der gewöhnlichen Bestimmung. */
const BESCHLUSSFAEHIGKEIT_ANTWORT = {
	id: 'f3-1-beschlussfaehigkeit',
	text: 'Reglement, Bestimmung über strengere Beschlussfähigkeit der Versammlung, etwa dass alle Eigentümer anwesend sein müssen, bevor die Versammlung beschliesst',
	ziel: 'k-reglement-beschlussfaehigkeit',
	hilfe: 'Beschlussfähigkeit heisst, wie viele Eigentümer anwesend oder vertreten sein müssen, damit die Versammlung überhaupt beschliessen kann.'
};

// ── Punkt 4: Erklärung zum Wortlaut je Artikel ───────────────────────────────

/**
 * Die Erklärung für Art. 647a Abs. 2: kurz, mit denselben Belegen wie der
 * Hinweis der Karte seit Fassung 2026-10-26; dort steht das Ganze
 * (`WORTLAUT_ALLER`), wörtlich doppelt verdrängte es die Anfechtung (Laienprüfung
 * A4, L-20). Für die übrigen Artikel bleibt die bisherige Erklärung
 * (`wortlautErklaerung`), für Art. 647c ungeprüft.
 */
const WORTLAUT_647A =
	'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Gezählt wird trotzdem nach den anwesenden und ' +
	'vertretenen Stimmen (Rz. 166b ad Art. 712m; Handschin/Wyttenbach S. 68; zum Bundesgericht BGE 131 III 459 ' +
	'E. 5.2); Näheres unter «Zu beachten». Ihr Reglement darf eine andere Zählweise vorsehen, dafür braucht es ' +
	'aber die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; BGE 143 III 537 E. 4.2.3) ' +
	'und eine klare Formulierung.';

const NUETZLICH_HALBSATZ = '; bei der nützlichen Massnahme wendet der Kommentar dann das Gesetz an (Rz. 130 ad Art. 712a)';

/** Der Satz `TROTZDEM` samt Frist, aus der Vorfassung geholt statt abgeschrieben. */
function trotzdemAusVorfassung(): string {
	const recht = REGELWERK_2026_10_29.knoten.find((k) => k.id === 'k-verwaltung-wichtig')?.reglementsrecht ?? '';
	const beginn = recht.indexOf('Ob eine mit weniger beschlossene Bestimmung');
	const ende = recht.indexOf(FRIST_ENDE);
	if (beginn < 0 || ende < beginn) throw new Error('Fassung 2026-10-30: Der Satz TROTZDEM ist nicht mehr der erwartete.');
	// Der Halbsatz zur nützlichen Massnahme gehört an die Karte der Vorfassung, nicht
	// an die erweiterte Bewirtschaftung (Codeprüfung Prüfschritt A4).
	return ersetze(recht.slice(beginn, ende + FRIST_ENDE.length), NUETZLICH_HALBSATZ, '');
}

const QUOREN_RUECKKEHR_ALT =
	'Das gilt in beide Richtungen: Ein Zweidrittelquorum für den Unterhalt einzuführen, verlangt Einstimmigkeit — es Jahre später wieder abzuschaffen, ebenfalls.';
const QUOREN_RUECKKEHR_NEU =
	'Ein Zweidrittelquorum für den Unterhalt einzuführen, verlangt Einstimmigkeit. Ob auch die Abschaffung Jahre ' +
	'später die Zustimmung aller braucht, ist offen. Für eine Änderung, die vom Gesetz abweicht, verlangt sie der ' +
	'Kommentar (Rz. 146 ad Art. 712g), sonst genügt das qualifizierte Mehr (Rz. 144); zur Rückkehr äussert er sich ' +
	'nicht. BGer 5C.110/2001 E. 2b verlangt für eine spätere Änderung der Verwaltungsordnung allgemein Einstimmigkeit. ' +
	'Sicher ist die Zustimmung aller. Wird nur das qualifizierte Mehr erreicht, kann anfechten, wer nicht zugestimmt ' +
	'hat: beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, innert eines Monats ab Kenntnis. ' +
	'Führen Sie den Beschluss, wenn die Sache nicht dringlich ist, erst nach Ablauf dieser Frist aus; für Abwesende ' +
	'ohne Vertretung beginnt sie in der Regel erst, wenn sie das Protokoll erhalten haben. Stellen Sie es ihnen ' +
	'deshalb rasch und nachweisbar zu, etwa eingeschrieben.';

// ── Die Knoten ───────────────────────────────────────────────────────────────

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_10_29.knoten.map((vorher) => {
	// Punkt 1: Verhalten und Rechtssatz an der erweiterten Bewirtschaftung.
	if (vorher.id === 'k-bewirtschaftung-erweitert') {
		if (vorher.reglementsverhalten !== 'frei') {
			throw new Error('Fassung 2026-10-30: Die erweiterte Bewirtschaftung ist nicht mehr frei.');
		}
		if (vorher.reglementsrecht !== undefined) {
			throw new Error('Fassung 2026-10-30: Die erweiterte Bewirtschaftung trägt schon einen Rechtssatz.');
		}
		return { ...vorher, reglementsverhalten: 'vereinbart', reglementsrecht: `${RECHT_ERWEITERT} ${trotzdemAusVorfassung()} ${ANFECHTUNG_EINFUEHRUNG}` };
	}
	// Punkt 1: Bedingung an der wichtigeren Verwaltungshandlung,
	// Punkt 3: Anfechtung am Satz `TROTZDEM`.
	if (vorher.id === 'k-verwaltung-wichtig') {
		return {
			...vorher,
			reglementsrecht: `${ersetze(vorher.reglementsrecht ?? '', WICHTIG_ANKER, `${WICHTIG_ANKER}${BEDINGUNG_WICHTIG}`)} ${ANFECHTUNG_EINFUEHRUNG}`
		};
	}
	// Punkt 3: Anfechtung an der Zuständigkeitsordnung, hinter den Lesarten.
	if (vorher.id === 'k-zustaendigkeit-gewoehnlich') {
		const hinweis = `${HINWEIS_LESART} ${ANFECHTUNG_ZUSTAENDIGKEIT}`;
		return {
			...vorher,
			hinweise: ersetzeInListe(vorher.hinweise ?? [], HINWEIS_LESART, hinweis),
			// Der Eintrag unter der Regel zeigt auf den Hinweis; er wandert mit.
			hinweiseUnterRegel: (vorher.hinweiseUnterRegel ?? []).map((u) =>
				u.hinweis === HINWEIS_LESART ? { ...u, hinweis } : u
			)
		};
	}
	// Punkt 3: Anfechtung an der Wahl mit erweiterten Kompetenzen.
	if (vorher.id === 'k-bewirtschaftung-waehlen-erweitert') {
		const hinweis = `${HINWEIS_ERWEITERT} ${ANFECHTUNG_WAHL}`;
		return {
			...vorher,
			hinweise: ersetzeInListe(vorher.hinweise ?? [], HINWEIS_ERWEITERT, hinweis),
			hinweiseUnterRegel: (vorher.hinweiseUnterRegel ?? []).map((u) =>
				u.hinweis === HINWEIS_ERWEITERT ? { ...u, hinweis } : u
			)
		};
	}
	// Punkt 3: Anfechtung an der eigenen Schranke; Punkt 8 an ihrem Weg.
	if (vorher.id === 'k-reglement-eigene-schranke') {
		const mitStreit = (vorher.hinweise ?? []).filter((h) => h.includes(SCHRANKE_NEU));
		if (mitStreit.length !== 1) {
			throw new Error('Fassung 2026-10-30: Der Satz zur eigenen Schranke steht nicht genau einmal in den Hinweisen.');
		}
		return {
			...vorher,
			hinweise: (vorher.hinweise ?? []).map((h) => (h.includes(SCHRANKE_NEU) ? ersetze(h, SCHRANKE_NEU, EIGENE_SCHRANKE_STREIT) : h)),
			einstimmigkeitsweg: mitMehreren(vorher.id)
		};
	}
	// Punkt 3: Anfechtung am Satz `TROTZDEM`, an den Karten, die ihn tragen.
	if (['k-baulich-notwendig', 'k-baulich-nuetzlich', 'k-benutzungsweise', 'k-baulich-luxurioes-ausweg'].includes(vorher.id)) {
		if (!vorher.reglementsrecht?.includes(FRIST_ENDE)) throw new Error(`Fassung 2026-10-30: «${vorher.id}» trägt die Frist nicht.`);
		// Ans Ende, nicht an die Frist: Der Satz zur Erleichterung gehört zu ihr (L-12).
		return { ...vorher, reglementsrecht: `${vorher.reglementsrecht} ${ANFECHTUNG_EINFUEHRUNG}` };
	}
	// Punkt 5: Hauswart beim Ausschuss, am Knoten.
	if (vorher.id === 'k-uebertragung-beschluss') {
		return { ...vorher, hinweise: ersetzeInListe(vorher.hinweise ?? [], HAUSWART_AUSSCHUSS, HAUSWART_KARTE) };
	}
	// Punkt 11: Begründung der Wahl der Organe mit dem Delegierten.
	if (vorher.id === 'k-organ-waehlen') {
		return {
			...vorher,
			begruendung:
				'Die Wahl eines Ausschusses, eines Delegierten oder einer Revisionsstelle gehört zu den ' +
				'Befugnissen der Versammlung und folgt derselben Regel wie die Wahl der Bewirtschaftung.'
		};
	}
	// Fachprüfung A4, F-13; Hauslinie Frage 12: Die Rückkehr ist offen, nicht einstimmig.
	if (vorher.id === 'k-reglement-quoren') {
		return { ...vorher, hinweise: ersetzeInListe(vorher.hinweise ?? [], QUOREN_RUECKKEHR_ALT, QUOREN_RUECKKEHR_NEU), einstimmigkeitsweg: mitMehreren(vorher.id) };
	}
	// Punkt 8: Der Weg der Einstimmigkeit mit dem Anteil mehrerer Berechtigter.
	if (vorher.typ === 'einstimmigkeit') {
		return { ...vorher, einstimmigkeitsweg: mitMehreren(vorher.id) };
	}
	return vorher;
});

// ── Die Fragen ────────────────────────────────────────────────────────────────

/**
 * Punkt 10: Die Antwort zu Zuständigkeit und Quoren im Reglement sagt, dass
 * sie zur Einstimmigkeit führt, und grenzt die Klausel zur alltäglichen
 * Verwaltung aus, wie es seit Fassung 2026-10-27 der Weg über «Organe» tut
 * (`ALLTAG_UND_REGLEMENT`, Art. 647a Abs. 2 als ausdrückliche Ausnahme,
 * Rz. 78 ad Art. 712g).
 */
const QUOREN_HILFE_NEU =
	'Wählen Sie diese Antwort, wenn die Bestimmung festlegt, welches Mehr gilt, oder wer über wichtigere ' +
	'Geschäfte entscheidet. Eine solche Bestimmung verlangt in der Regel die Zustimmung aller (ZGB Art. 712g ' +
	'Abs. 2). Das gilt nicht für eine Klausel, die nur sagt, wer alltägliche Aufträge vergibt: Für sie macht ' +
	'Art. 647a Abs. 2 eine ausdrückliche Ausnahme von der Einstimmigkeit (SVIT-Kommentar Rz. 78 ad Art. 712g). ' +
	'Soll sie im Reglement stehen, wählen Sie dafür die gewöhnliche Bestimmung. Soll die Bewirtschaftung mehr ' +
	'Kompetenzen erhalten, gilt die Karte «Bewirtschaftung mit erweiterten Kompetenzen». Für die blosse ' +
	'Zuständigkeit zu gewöhnlichen Verwaltungshandlungen ohne Reglementsänderung kennt das Gesetz einen eigenen, ' +
	'einfacheren Weg — Sie finden ihn unter «Sonderfälle».';

/** Punkt 2: Die neue Antwort zur Beschlussfähigkeit, hinter den Quoren. */
function frageReglement(): Frage {
	const vorher = frage('f3-1');
	const quoren = vorher.antworten.find((a) => a.id === 'f3-1-quoren');
	if (!quoren) throw new Error('Fassung 2026-10-30: Die Antwort zu den Quoren fehlt.');
	const alt = quoren.hilfe;
	if (alt === undefined || !alt.startsWith('Für die blosse Zuständigkeit')) {
		throw new Error('Fassung 2026-10-30: Die Hilfe zu den Quoren ist nicht mehr die erwartete.');
	}
	const quorenNeu = { ...quoren, hilfe: QUOREN_HILFE_NEU };
	const index = vorher.antworten.indexOf(quoren);
	return {
		...vorher,
		antworten: [...vorher.antworten.slice(0, index + 1), BESCHLUSSFAEHIGKEIT_ANTWORT, ...vorher.antworten.slice(index + 1)].map((a) =>
			a === quoren ? quorenNeu : a
		)
	};
}

/**
 * Punkt 5: Der Hauswart beim Ausschuss, an der Antwort «Andere Aufgaben
 * übernehmen»; der Satz der Vorfassung steht am Ende der Hilfe.
 */
function frageUebertragung(): Frage {
	const vorher = frage('f2-1-uebertragung');
	const anderes = vorher.antworten.find((a) => a.id === 'f2-1-uebertragung-anderes');
	if (!anderes) throw new Error('Fassung 2026-10-30: Die Antwort zu den anderen Aufgaben fehlt.');
	if (!anderes.hilfe?.endsWith(HAUSWART_AUSSCHUSS)) {
		throw new Error('Fassung 2026-10-30: Der Satz zum Hauswart steht nicht mehr am Ende der Hilfe.');
	}
	return {
		...vorher,
		antworten: vorher.antworten.map((a) =>
			a.id === 'f2-1-uebertragung-anderes'
				? { ...a, hilfe: a.hilfe?.slice(0, -HAUSWART_AUSSCHUSS.length) + HAUSWART_KARTE }
				: a
		)
	};
}

const FRAGEN: Frage[] = REGELWERK_2026_10_29.fragen.map((f) => {
	if (f.id === 'f3-1') return frageReglement();
	if (f.id === 'f2-1-uebertragung') return frageUebertragung();
	return f;
});

// ── Die Fassung ─────────────────────────────────────────────────────────────

const WIRKUNG_EINFACH_ALT =
	'Dieses Werkzeug folgt der herrschenden, strengeren Zählung — ein Beschluss, der so besteht, besteht ' +
	'auch nach der milderen.';
const WIRKUNG_EINFACH_NEU =
	'Die Karten zählen wie die herrschende Lehre; ein Beschluss, der so besteht, besteht auch nach der ' +
	'Mindermeinung.';

export const REGELWERK_2026_10_30 = {
	...REGELWERK_2026_10_29,
	fassung: '2026-10-30',

	// Punkt 6: Satz zu den Enthaltungen wie auf der Website, an beiden Typen, die ihn tragen.
	ergebnistypen: REGELWERK_2026_10_29.ergebnistypen.map((t) =>
		(t.typ === 'einfaches_mehr' || t.typ === 'qualifiziertes_mehr') && t.stimmwirkungen.art === 'festgelegt'
			? { ...t, stimmwirkungen: { ...t.stimmwirkungen, wirkung: ersetze(t.stimmwirkungen.wirkung, WIRKUNG_EINFACH_ALT, WIRKUNG_EINFACH_NEU) } }
			: t
	),

	// Punkt 1 bis 3 und 5, 8, 11 an den Knoten; Punkt 2 dazu.
	knoten: [...KNOTEN, BESCHLUSSFAEHIGKEIT],

	// Punkt 2 und 10 an den Fragen.
	fragen: FRAGEN,

	// Punkt 4: Die Erklärung zum Wortlaut je Artikel; die bisherige bleibt
	// für die Artikel, die sie richtig belegt (und für Art. 647c, ungeprüft).
	wortlautErklaerungJeArtikel: {
		'ZGB Art. 647a Abs. 2': WORTLAUT_647A
	},

	freigabevermerk:
		REGELWERK_2026_10_29.freigabevermerk +
		' In der Fassung 2026-10-30 gilt eine hinterlegte Regel an der erweiterten Bewirtschaftung nur noch, ' +
		'wenn sie genau diesen Fall trifft, und die Karte sagt es; die Karte zur strengeren Beschlussfähigkeit ' +
		'im Reglement rechnet Einstimmigkeit aller; die Anfechtung steht mit Stelle, Berechtigtem und Frist an ' +
		'den Karten, die sie brauchen; die Erklärung zum Wortlaut «aller» führt je Artikel; der Hauswart beim ' +
		'Ausschuss, die Enthaltungen, die Bezugsgrösse «alle» mit Vollmacht, die mehreren Berechtigten am ' +
		'Blatt, die Sperre nach der Lehre, die Antwort zu den Quoren und die Begründung der Organe sind ' +
		'nachgezogen.'
} satisfies Regelwerk;