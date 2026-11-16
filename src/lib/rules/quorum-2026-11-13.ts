/**
 * Fassung 2026-11-13: Die Wahl einer Bewirtschaftung, die schon erweiterte
 * Kompetenzen hat, rechnet nach der Vorgabe das qualifizierte Mehr nach dem
 * Gesetz (L4), und der Hinweis zur Ausschlussklage in kleinen Gemeinschaften
 * folgt dem Wortlaut von Art. 649b Abs. 2 ZGB (Entscheid 0048, Block B).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-11 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht genau einmal steht oder der
 * neue schon dasteht. Auftrag `.auftraege/2026-11-13-votum-b-l4-nach-gesetz.md`.
 *
 * **Der Anlass.** Art. 647b Abs. 1 ZGB nennt «die Bestellung eines Verwalters,
 * dessen Zuständigkeit nicht auf gewöhnliche Verwaltungshandlungen beschränkt
 * ist» ausdrücklich bei den wichtigeren Verwaltungshandlungen mit
 * qualifiziertem Mehr. Bis hier rechnete Votum nach der Vorgabe das einfache
 * Mehr, weil der SVIT-Kommentar es genügen lässt (Rz. 46 ad Art. 712q; Rz. 112
 * ad Art. 712a). Er stützt sich dafür auf ein kantonales Urteil und nennt die
 * Frage selbst umstritten; ein Entscheid des Bundesgerichts liegt nicht vor.
 * Der Produktentscheid vom 13.11.2026 (Entscheid 0048, Punkt 1, «Vorgabe nach
 * Gesetz») stellt die Vorgabe auf das qualifizierte Mehr um; das einfache
 * bleibt in der Einstellung wählbar. Entscheid 0018 (milde Vorgabe) ist für L4
 * insoweit abgelöst.
 *
 * **Was sich an der Karte `k-bewirtschaftung-waehlen-erweitert` ändert**
 * (Muster: L11 an `k-prozessfuehrung` in der Fassung 2026-11-10):
 *
 *  - Sie rechnet nach der Vorgabe das qualifizierte Mehr nach Art. 647b
 *    Abs. 1, mit den Köpfen unter den Anwesenden und Vertretenen und allen
 *    Wertquoten. Wie jede Karte an Art. 647b hält sie deshalb die
 *    Wortlautabweichung fest (`pruefeRegelwerk`): Der Wortlaut sagt «aller
 *    Miteigentümer», gezählt wird unter den Anwesenden. Diese Zählung bleibt
 *    bis Block C (Lesart an der Zählung, Entscheid 0048, Punkte 4 bis 6).
 *  - `lesart.andere` ist die Wahl «einfach»: das einfache Mehr der Anwesenden
 *    und Vertretenen nach Art. 712m Abs. 1 Ziff. 2, die bisherige
 *    Rechtsgrundlage der Karte.
 *  - Die Begründung nennt das Gesetz statt der Befugnis der Versammlung.
 *  - Im Hinweis bleibt der erste Satz (`ERWEITERUNG` der Fassung 2026-10-23);
 *    der Rest, der den Lehrstreit mit der Vorgabe «einfach» und die Anfechtung
 *    darstellte (`WAHL_NACH_LESART` der Fassung 2026-10-24, `ANFECHTUNG_WAHL`
 *    der Fassung 2026-10-30), weicht dem Satz nach dem Gesetz (`REST`). Unter
 *    der Wahl «einfach» tauscht `knotenNachLesart` ihn gegen den Rest, der die
 *    Einstellung, den sicheren Weg und die Anfechtung nennt (`REST_EINFACH`).
 *  - `rang` bleibt «lehre»: Die Köpfe zählen unter den Anwesenden, nicht nach
 *    dem Wortlaut, und `pruefeRegelwerk` lässt an einer Wortlautabweichung den
 *    Rang «gesetz» nicht zu.
 *
 * **Alte Traktanden** dieser Karte aus den Fassungen 2026-10-24 bis 2026-11-11
 * rechnen weiter, was ihr Knoten rechnet: das einfache Mehr, und mit der Wahl
 * «qualifiziert» das qualifizierte (`wahlDesKnotens`, Entscheid 0048, Block A).
 * Freigegebene rechnen nach der eingefrorenen Wahl ihrer Momentaufnahme
 * (Migration 191 lässt `snapshot.reading_l4` stehen).
 *
 * **Dieselbe Fassung ersetzt an `k-ausschlussklage` den Hinweis zu kleinen
 * Gemeinschaften** (`KLEINE_GEMEINSCHAFTEN` der Fassung 2026-10-11): Die Klage
 * ohne Beschluss gibt es nach dem Wortlaut nur bei zwei Eigentümern, mit dem
 * Vorbehalt «wenn nichts anderes vereinbart ist»; die Ansicht von Rz. 214 ad
 * Art. 712a, auch bei drei Eigentümern könne jeder direkt klagen, steht als
 * Abweichung (Entscheid 0048, «Was daraus folgt», Punkt 3 der Meldung). Der
 * Hinweis steht ohne Regel unter den Hinweisen und unter einer Regel beim
 * gesetzlichen Erfordernis, wie bisher; andere Stellen tragen den alten Satz
 * nicht (gesucht über die ganze Fassung 2026-11-11, auch `hinweisErsatz` von L9).
 *
 * **Sonst bleibt alles**, jeder andere Knoten, jede Frage und jedes
 * Erfordernis (`tests/domain/fassung-2026-11-13.test.ts`).
 */
import type { Ergebnisknoten, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_11 } from './quorum-2026-11-11';
import { ERWEITERUNG } from './quorum-2026-10-23';
import { HINWEIS_ERWEITERT, WAEHLEN_ERWEITERT_ID } from './quorum-2026-10-24';
import { ANFECHTUNG_WAHL } from './quorum-2026-10-30';
import { KLEINE_GEMEINSCHAFTEN as KLEINE_GEMEINSCHAFTEN_VORHER } from './quorum-2026-10-11';
import { AUSSCHLUSSKLAGE_ID } from './quorum-2026-11-10';

export { WAEHLEN_ERWEITERT_ID, AUSSCHLUSSKLAGE_ID };

const vorher = REGELWERK_2026_11_11.knoten.find((k) => k.id === WAEHLEN_ERWEITERT_ID);
if (!vorher) throw new Error(`Fassung 2026-11-13: «${WAEHLEN_ERWEITERT_ID}» fehlt in der Vorfassung.`);

const vorherAusschluss = REGELWERK_2026_11_11.knoten.find((k) => k.id === AUSSCHLUSSKLAGE_ID);
if (!vorherAusschluss) throw new Error(`Fassung 2026-11-13: «${AUSSCHLUSSKLAGE_ID}» fehlt in der Vorfassung.`);

// ── L4: die Wahl der Bewirtschaftung mit erweiterten Kompetenzen ─────────────

/** Die Begründung der Vorfassung, für die Proben: «Die Wahl der Bewirtschaftung gehört zu den Befugnissen der Versammlung.» */
export const BEGRUENDUNG_VORHER = vorher.begruendung;

/** Die neue Begründung: das Gesetz, nicht die Befugnis der Versammlung (Auftrag, wörtlich). */
export const BEGRUENDUNG =
	'Das Gesetz nennt die Bestellung einer Verwaltung, deren Befugnisse über die gewöhnliche Verwaltung ' +
	'hinausgehen, ausdrücklich bei den wichtigeren Verwaltungshandlungen (ZGB Art. 647b Abs. 1).';

/**
 * Der Hinweis der Vorfassung: der erste Satz (`ERWEITERUNG`), der Lehrstreit
 * mit der Vorgabe «einfach» und die Anfechtung (Fassungen 2026-10-24 und
 * 2026-10-30). Er muss genau einmal unter den Hinweisen stehen.
 */
export const HINWEIS_VORHER = `${HINWEIS_ERWEITERT} ${ANFECHTUNG_WAHL}`;
if ((vorher.hinweise ?? []).filter((h) => h === HINWEIS_VORHER).length !== 1) {
	throw new Error(`Fassung 2026-11-13: «${WAEHLEN_ERWEITERT_ID}» trägt den Hinweis der Vorfassung nicht genau einmal.`);
}
if (!HINWEIS_VORHER.startsWith(`${ERWEITERUNG} `)) {
	throw new Error(`Fassung 2026-11-13: Der Hinweis von «${WAEHLEN_ERWEITERT_ID}» beginnt nicht mit dem Satz zur Erweiterung.`);
}

/**
 * Der Rest nach dem ersten Satz, nach der Vorgabe: Das Gesetz verlangt nach
 * seinem Wortlaut das qualifizierte Mehr, der Kommentar lässt das einfache
 * genügen, und die Karte verlangt das qualifizierte. Dazu, was nach einer Wahl mit nur
 * dem einfachen Mehr gilt. Wortlaut nach der Endfassung der Prüfvorlage
 * (`quellen` `pruefung/zu-pruefen-2026-11-13-votum-regel43-block-b-endfassung.md`,
 * Stelle 2); eine Konstante, damit eine Nachbesserung an einer Stelle greift.
 */
export const REST =
	'Darf die Bewirtschaftung nach Reglement oder Verwaltungsvertrag schon mehr als die ' +
	'gewöhnliche Verwaltung besorgen, etwa gemeinschaftliche Teile selbständig vermieten, ' +
	'verlangt Art. 647b Abs. 1 ZGB nach seinem Wortlaut auch für die Wahl das qualifizierte Mehr: ' +
	'Mehr als die Hälfte der anwesenden und vertretenen Eigentümer stimmt zu, und sie halten ' +
	'zusammen mehr als die Hälfte aller Wertquoten. Hat die Bewirtschaftung nur die Aufgaben, die ' +
	'das Gesetz jeder Bewirtschaftung gibt (namentlich ZGB Art. 712s und 712t), bleibt es nach ' +
	'dem SVIT-Kommentar beim einfachen Mehr (Rz. 44 ad Art. 712m). Der SVIT-Kommentar lässt auch ' +
	'bei erweiterten Befugnissen das einfache Mehr genügen und nennt die Frage selbst umstritten ' +
	'(Rz. 46 ad Art. 712q); ein Entscheid des Bundesgerichts dazu ist uns nicht bekannt. Diese ' +
	'Karte verlangt deshalb das qualifizierte Mehr. Holen Sie vor der Versammlung Vollmachten ' +
	'ein, denn die Wertquoten der Abwesenden wirken wie ein Nein. Erreicht die Wahl nur das ' +
	'einfache Mehr, ist der Antrag nach dieser Karte abgelehnt; Sie können an einer weiteren, ' +
	'ordentlich einberufenen Versammlung mit mehr Vollmachten neu abstimmen. Ist die Gemeinschaft ' +
	'ohne Bewirtschaftung, etwa weil der bisherige Vertrag abgelaufen ist, kann jeder Eigentümer ' +
	'beim Gericht die Ernennung verlangen (ZGB Art. 712q Abs. 1). Eine Frist dafür ist nicht ' +
	'geklärt; vorsichtshalber handeln Sie innert eines Monats seit der Versammlung, an der die ' +
	'Wahl zuletzt gescheitert ist. Solange die bisherige Bewirtschaftung im Amt ist, steht dieser ' +
	'Weg nicht offen; läuft ihr Vertrag noch, setzen Sie die Wahl für eine Versammlung vor seinem ' +
	'Ende neu auf die Traktandenliste. Hält die Versammlungsleitung eine solche Wahl trotzdem als ' +
	'angenommen fest, gilt sie, bis ein Gericht sie aufhebt. Wer nicht zugestimmt hat, kann sie ' +
	'anfechten: beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, ' +
	'innert eines Monats, für Anwesende und Vertretene ab der Versammlung, für Abwesende in der ' +
	'Regel ab Erhalt des Protokolls.';

/**
 * Derselbe Rest unter der Wahl «einfach» (Endfassung der Prüfvorlage, Stelle 2,
 * nur in der Anwendung): die Einstellung der Gemeinschaft, der sichere Weg und
 * die Anfechtung. Unter der Vorgabe stünde er falsch, denn dort ist eine Wahl
 * mit nur dem einfachen Mehr abgelehnt.
 */
export const REST_EINFACH =
	'Darf die Bewirtschaftung nach Reglement oder Verwaltungsvertrag schon mehr als die ' +
	'gewöhnliche Verwaltung besorgen, verlangt Art. 647b Abs. 1 ZGB nach seinem Wortlaut auch für ' +
	'die Wahl das qualifizierte Mehr. Hat die Bewirtschaftung nur die Aufgaben, die das Gesetz ' +
	'jeder Bewirtschaftung gibt (namentlich ZGB Art. 712s und 712t), bleibt es nach dem ' +
	'SVIT-Kommentar beim einfachen Mehr (Rz. 44 ad Art. 712m). In den Einstellungen Ihrer ' +
	'Gemeinschaft (Seite «Lesarten») ist gewählt, dass Votum dem SVIT-Kommentar (einem Fachbuch ' +
	'zum Stockwerkeigentum) folgt und das einfache Mehr genügen lässt (Rz. 46 ad Art. 712q). Wer ' +
	'sicher gehen will, holt vor der Versammlung Vollmachten ein und wählt trotzdem mit ' +
	'qualifiziertem Mehr: Mehr als die Hälfte der anwesenden und vertretenen Eigentümer stimmt ' +
	'zu, und sie halten zusammen mehr als die Hälfte aller Wertquoten. Wer nicht zugestimmt hat, ' +
	'kann eine Wahl mit nur einfachem Mehr anfechten: beim Gericht, in der Regel zuerst mit einem ' +
	'Gesuch an die Schlichtungsbehörde. Die Frist beträgt einen Monat, für Anwesende und ' +
	'Vertretene ab der Versammlung, für Abwesende in der Regel ab Erhalt des Protokolls. Stellen ' +
	'Sie das Protokoll deshalb rasch und nachweisbar allen zu. Den Verwaltungsvertrag ' +
	'unterzeichnet die Gemeinschaft, wo es nicht eilt, erst, wenn die Frist für alle abgelaufen ' +
	'ist, also frühestens einen Monat, nachdem auch die Abwesenden das Protokoll erhalten haben.';

/** Der neue Hinweis nach der Vorgabe: der erste Satz der Vorfassung und der Rest nach dem Gesetz. */
export const HINWEIS = `${ERWEITERUNG} ${REST}`;

/** Derselbe Hinweis unter der Wahl «einfach», für `hinweisErsatz`. */
export const HINWEIS_EINFACH = `${ERWEITERUNG} ${REST_EINFACH}`;

/**
 * Unter einer hinterlegten Regel trägt der Eintrag den neuen Hinweis als
 * Schlüssel; `ersatz` (der erste Satz) und `zumGesetz` (der Lehrstreit, mit
 * «Wer sicher gehen will, strebt das qualifizierte Mehr an») bleiben, wie sie
 * waren: Unter einer Regel rechnet das Reglement, und beide Sätze stimmen dort
 * unter jeder Wahl.
 */
const UNTER_REGEL: HinweisUnterRegel[] = (vorher.hinweiseUnterRegel ?? []).map((u) =>
	u.hinweis === HINWEIS_VORHER ? { ...u, hinweis: HINWEIS } : u
);
if (!UNTER_REGEL.some((u) => u.hinweis === HINWEIS)) {
	throw new Error(`Fassung 2026-11-13: «${WAEHLEN_ERWEITERT_ID}» trägt den Hinweis nicht unter einer Regel.`);
}

const WAEHLEN_ERWEITERT: Ergebnisknoten = {
	...vorher,
	typ: 'qualifiziertes_mehr',
	rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	// Wie jede Karte an Art. 647b: Der Wortlaut sagt «aller Miteigentümer»,
	// gezählt wird unter den Anwesenden und Vertretenen (`pruefeRegelwerk`).
	wortlautAbweichung: true,
	begruendung: BEGRUENDUNG,
	hinweise: (vorher.hinweise ?? []).map((h) => (h === HINWEIS_VORHER ? HINWEIS : h)),
	hinweiseUnterRegel: UNTER_REGEL,
	lesart: {
		kennung: 'L4',
		andere: {
			wahl: 'einfach',
			typ: 'einfaches_mehr',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			hinweisErsatz: [{ alt: HINWEIS, neu: HINWEIS_EINFACH }]
		}
	}
};

// ── k-ausschlussklage: zwei und drei Eigentümer nach dem Wortlaut ────────────

/**
 * Der Hinweis zu kleinen Gemeinschaften nach dem Wortlaut von Art. 649b Abs. 2
 * (Endfassung der Prüfvorlage, Stelle 3). Er ersetzt den Satz der Fassung
 * 2026-10-11, nach dem bei drei Eigentümern mangels Zustimmung «die direkte
 * Klage nach dem Kommentar» bleibe; die alten Fassungen behalten ihn. Er nennt
 * die Zählbasis nicht («Mehrheit aller»), denn die nennt ein eigener Hinweis
 * der Karte als umstritten (`W10`, Lesart L9).
 */
export const KLEINE_GEMEINSCHAFTEN =
	'Bei zwei Eigentümern braucht es keinen Beschluss: Jeder kann direkt klagen (ZGB Art. 649b ' +
	'Abs. 2). Sonst müssen die Eigentümer ohne den Beklagten mit Mehrheit beschliessen, dass ' +
	'geklagt wird, wenn nichts anderes vereinbart ist, etwa im Reglement (ZGB Art. 649b Abs. 2). ' +
	'Das gilt auch bei drei Eigentümern; das Bundesgericht sagt es ebenso, wenn auch nur in ' +
	'Fällen mit mehr Eigentümern (BGer 5A_447/2014 E. 3; BGer 5A_735/2019 E. 3.3.1). Der ' +
	'SVIT-Kommentar lässt bei drei Eigentümern jeden direkt klagen (Art. 712a Rz. 214, mit ' +
	'Verweis auf Piccinin); Votum folgt dem Gesetz. Bei drei Eigentümern ist der Beschluss ' +
	'sicher, wenn beide anderen zustimmen. Muss einer der beiden in den Ausstand treten, etwa als ' +
	'Ehegatte des Beklagten, ist offen, ob die Zustimmung des anderen allein genügt. In einem ' +
	'verwandten Fall (zwei Eigentümer, Klage der Gemeinschaft gegen den einen) liess das ' +
	'Bundesgericht den verbleibenden Eigentümer allein entscheiden (BGer 5A_721/2021 E. 3.3); zur ' +
	'Ausschlussklage ist uns dazu kein Entscheid bekannt. Lassen Sie deshalb abstimmen, auch wenn ' +
	'nur eine Person stimmen darf, halten Sie im Protokoll fest, wer zugestimmt hat und wer im ' +
	'Ausstand war, und klären Sie das Vorgehen vor der Klage mit einer Anwältin oder einem ' +
	'Anwalt.';

if ((vorherAusschluss.hinweise ?? []).filter((h) => h === KLEINE_GEMEINSCHAFTEN_VORHER).length !== 1) {
	throw new Error(`Fassung 2026-11-13: «${AUSSCHLUSSKLAGE_ID}» trägt den Hinweis zu kleinen Gemeinschaften nicht genau einmal.`);
}

const AUSSCHLUSS: Ergebnisknoten = {
	...vorherAusschluss,
	hinweise: (vorherAusschluss.hinweise ?? []).map((h) => (h === KLEINE_GEMEINSCHAFTEN_VORHER ? KLEINE_GEMEINSCHAFTEN : h)),
	// Unter einer Regel steht er beim gesetzlichen Erfordernis, wie bisher.
	hinweiseUnterRegel: (vorherAusschluss.hinweiseUnterRegel ?? []).map((u) =>
		u.hinweis === KLEINE_GEMEINSCHAFTEN_VORHER ? { ...u, hinweis: KLEINE_GEMEINSCHAFTEN } : u
	)
};
if (!AUSSCHLUSS.hinweiseUnterRegel?.some((u) => u.hinweis === KLEINE_GEMEINSCHAFTEN)) {
	throw new Error(`Fassung 2026-11-13: «${AUSSCHLUSSKLAGE_ID}» trägt den Hinweis zu kleinen Gemeinschaften nicht unter einer Regel.`);
}

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_11_11.knoten.map((k) =>
	k.id === WAEHLEN_ERWEITERT_ID ? WAEHLEN_ERWEITERT : k.id === AUSSCHLUSSKLAGE_ID ? AUSSCHLUSS : k
);

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

const VORFASSUNG = JSON.stringify(REGELWERK_2026_11_11);
for (const neu of [BEGRUENDUNG, REST, REST_EINFACH, KLEINE_GEMEINSCHAFTEN]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-13: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_13 = {
	...REGELWERK_2026_11_11,
	fassung: '2026-11-13',

	knoten: KNOTEN,

	freigabevermerk:
		REGELWERK_2026_11_11.freigabevermerk +
		' In der Fassung 2026-11-13 gilt für die Wahl einer Bewirtschaftung, die schon erweiterte ' +
		'Kompetenzen hat, als Standardeinstellung das qualifizierte Mehr nach dem Wortlaut von Art. 647b ' +
		'Abs. 1 ZGB; das einfache Mehr bleibt auf der Seite «Lesarten» einstellbar.'
} satisfies Regelwerk;

/*
 * Der alte Satz steht nirgends mehr in dieser Fassung, auch nicht in einem
 * `hinweisErsatz` von L9 oder einem `ersatz` unter einer Regel: Er bliebe
 * sonst ab hier stehen (Auftrag, Kriterium 4).
 */
if (JSON.stringify(REGELWERK_2026_11_13).includes('Dann bleibt die direkte Klage nach dem Kommentar')) {
	throw new Error('Fassung 2026-11-13: Der Satz «Dann bleibt die direkte Klage nach dem Kommentar» steht noch da.');
}
