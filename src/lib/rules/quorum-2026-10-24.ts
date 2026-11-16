/**
 * Fassung 2026-10-24: Wahl der Bewirtschaftung mit erweiterten Kompetenzen als
 * Lesart der Gemeinschaft (L4).
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Ergebnis nach der
 * Vorgabe. Sie fragt bei «Neue Bewirtschaftung wählen» nach, ob die
 * Bewirtschaftung schon Kompetenzen über die gewöhnliche Verwaltung hinaus hat:
 *
 *   - **Ja** führt zum neuen Knoten `k-bewirtschaftung-waehlen-erweitert`. Er
 *     rechnet nach der Vorgabe das einfache Mehr, wie bisher, und trägt die
 *     Lesart L4: Die Gemeinschaft kann auf das qualifizierte Mehr umstellen
 *     (Wortlaut von Art. 647b Abs. 1 ZGB). Der Hinweis sagt nicht mehr «so
 *     rechnet dieses Werkzeug», sondern dass die Gemeinschaft wählt.
 *   - **Nein** führt zum bisherigen Knoten `k-bewirtschaftung-waehlen`. Sein
 *     Hinweis verliert den Satz zur Gegenmeinung: Der Streit betrifft nur den
 *     Verwalter, «dessen Zuständigkeit nicht auf die gewöhnliche Verwaltung
 *     beschränkt ist» (Art. 647b Abs. 1).
 *
 * **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft) und der
 * Produktentscheid vom 20.10.2026 auf die Frage, für welche Wahlen die Lesart
 * gilt: «Nur mit erweiterten Kompetenzen». Ohne die Frage hätte eine
 * Umstellung auf das qualifizierte Mehr jede Wahl der Bewirtschaftung
 * getroffen, auch eine gewöhnliche, und dafür gibt es keine Fundstelle.
 *
 * **Alte Traktanden** mit `k-bewirtschaftung-waehlen` aus früheren Fassungen
 * rechnen weiter nach ihrer Fassung, ohne Lesart.
 */
import type { Antwort, Ergebnisknoten, Frage, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_23, ERWEITERUNG, HINWEIS as HINWEIS_VORHER } from './quorum-2026-10-23';

export const WAEHLEN_ID = 'k-bewirtschaftung-waehlen';
export const WAEHLEN_ERWEITERT_ID = 'k-bewirtschaftung-waehlen-erweitert';
export const KOMPETENZFRAGE_ID = 'f2-1-kompetenzen';

/** Der Satz zum Lehrstreit, ohne «so rechnet dieses Werkzeug». */
export const WAHL_NACH_LESART =
	'Ob die Wahl einer Bewirtschaftung mit solchen Kompetenzen ein höheres Mehr braucht, ist ' +
	'umstritten. Nach dem Wortlaut von Art. 647b Abs. 1 ZGB gehört diese Wahl zu den wichtigeren ' +
	'Verwaltungshandlungen mit qualifiziertem Mehr. Der SVIT-Kommentar bleibt beim einfachen Mehr, weil die Regeln zum ' +
	'Verwalter im Stockwerkeigentum vorgehen (Rz. 46 ad Art. 712q; Rz. 112 ad Art. 712a). Nach ' +
	'welcher Lesart Votum rechnet, wird auf der Seite «Lesarten» der Gemeinschaft eingestellt; ' +
	'Vorgabe ist das einfache Mehr. Votum nennt nach der Auszählung auch das Ergebnis nach der ' +
	'anderen Lesart. Ein Beschluss, der das qualifizierte Mehr erreicht, besteht nach beiden.';

/** Am Hinweis der gewöhnlichen Wahl: der Weg zur Karte mit Lesart (Laienprüfung, M7). */
export const VERWEIS_ERWEITERT =
	'Hat die Bewirtschaftung solche Kompetenzen schon, gehört die Wahl zur Karte «Bewirtschaftung ' +
	'wählen, die schon erweiterte Kompetenzen hat».';

export const HINWEIS_ERWEITERT = `${ERWEITERUNG} ${WAHL_NACH_LESART}`;

export const KOMPETENZFRAGE: Frage = {
	id: KOMPETENZFRAGE_ID,
	text:
		'Hat die Bewirtschaftung nach Ihrem Reglement oder einem früheren Beschluss der Versammlung ' +
		'Kompetenzen über die gewöhnliche Verwaltung hinaus?',
	// Fachprüfung 20.10.2026, Befunde 3 bis 5; Laienprüfung H2.
	// Runde 2 (Laien B2, B3; Fach E, F): die Fälle je für sich, ohne Widerspruch
	// zwischen neuem Vertrag und Erweiterung im selben Abend.
	hilfe:
		'Es zählt, was die Bewirtschaftung schon darf, nicht welche Firma Sie wählen: etwa ' +
		'gemeinschaftliche Teile vermieten oder grössere Aufträge vergeben, ohne die Versammlung im ' +
		'Einzelfall zu fragen. Was das Gesetz jeder Bewirtschaftung gibt, zählt nicht, etwa ' +
		'Beschlüsse ausführen, Beiträge einziehen oder Dringliches veranlassen. Ja heisst: Es steht im ' +
		'Reglement oder in einem früheren Beschluss, oder die Versammlung beschliesst die Erweiterung ' +
		'vorher in einem eigenen Traktandum. Nein heisst: Die Kompetenzen kämen nur mit dem neuen ' +
		'Verwaltungsvertrag; dann braucht die Erweiterung ein eigenes Traktandum mit qualifiziertem ' +
		'Mehr. Wird sie am Abend abgelehnt und hat die Bewirtschaftung sonst keine solchen ' +
		'Kompetenzen, wechseln Sie für die Wahl zur Karte «Bewirtschaftung wählen».',
	antworten: [
		{
			id: 'f2-1-kompetenzen-ja',
			text: 'Ja, nach Reglement, früherem Beschluss oder einem Traktandum davor',
			ziel: WAEHLEN_ERWEITERT_ID
		},
		{
			id: 'f2-1-kompetenzen-nein',
			text: 'Nein, oder nur im neuen Vertrag ohne eigenen Beschluss',
			ziel: WAEHLEN_ID
		}
	]
};

function zielNeu(a: Antwort): Antwort {
	return a.id === 'f2-1-waehlen' ? { ...a, ziel: KOMPETENZFRAGE_ID } : a;
}

function mitNachfrage(f: Frage): Frage {
	if (f.id !== 'f2-1') return f;
	if (!f.antworten.some((a) => a.id === 'f2-1-waehlen' && a.ziel === WAEHLEN_ID)) {
		throw new Error('Fassung 2026-10-24: «f2-1-waehlen» führt in der Vorfassung nicht zur Wahl.');
	}
	return { ...f, antworten: f.antworten.map(zielNeu) };
}

const vorher = REGELWERK_2026_10_23.knoten.find((k) => k.id === WAEHLEN_ID);
if (!vorher) throw new Error(`Fassung 2026-10-24: «${WAEHLEN_ID}» fehlt in der Vorfassung.`);
if ((vorher.hinweise ?? []).filter((h) => h === HINWEIS_VORHER).length !== 1) {
	throw new Error(`Fassung 2026-10-24: «${WAEHLEN_ID}» trägt den Hinweis der Vorfassung nicht genau einmal.`);
}
if (REGELWERK_2026_10_23.knoten.some((k) => k.id === WAEHLEN_ERWEITERT_ID)) {
	throw new Error(`Fassung 2026-10-24: «${WAEHLEN_ERWEITERT_ID}» gibt es schon.`);
}

/**
 * Ohne erweiterte Kompetenzen: der Satz zur Erweiterung und der Weg zur Karte
 * mit Lesart; beide gelten unter jeder Regel.
 */
export const HINWEIS_GEWOEHNLICH = `${ERWEITERUNG} ${VERWEIS_ERWEITERT}`;

const GEWOEHNLICH: Ergebnisknoten = {
	...vorher,
	hinweise: (vorher.hinweise ?? []).map((h) => (h === HINWEIS_VORHER ? HINWEIS_GEWOEHNLICH : h)),
	hinweiseUnterRegel: (vorher.hinweiseUnterRegel ?? []).filter((u) => u.hinweis !== HINWEIS_VORHER)
};

/**
 * Unter einer Regel, im Abschnitt «Zum gesetzlichen Erfordernis». Wie
 * `WAHL_ZUM_GESETZ` der Fassung 2026-10-21, aber mit «nach dem Wortlaut»
 * (Laienprüfung Runde 3, B4) und ohne den Satz, der die Kompetenzen erst
 * voraussetzt: An dieser Karte stehen sie fest.
 */
export const WAHL_ZUM_GESETZ_ERWEITERT =
	'Ob die Wahl einer Bewirtschaftung mit solchen Kompetenzen nach Gesetz ein höheres Mehr braucht, ' +
	'ist umstritten. Nach dem Wortlaut von Art. 647b Abs. 1 ZGB gehört sie zu den wichtigeren ' +
	'Verwaltungshandlungen mit qualifiziertem Mehr. Der SVIT-Kommentar bleibt beim einfachen Mehr, ' +
	'weil die Regeln zum Verwalter im Stockwerkeigentum vorgehen (Rz. 46 ad Art. 712q; Rz. 112 ad ' +
	'Art. 712a). Wer sicher gehen will, strebt das qualifizierte Mehr an.';

const UNTER_REGEL: HinweisUnterRegel = {
	hinweis: HINWEIS_ERWEITERT,
	ersatz: ERWEITERUNG,
	zumGesetz: WAHL_ZUM_GESETZ_ERWEITERT
};

/** Mit erweiterten Kompetenzen: dasselbe Mehr nach der Vorgabe, dazu die Lesart L4. */
export const WAEHLEN_ERWEITERT: Ergebnisknoten = {
	...vorher,
	id: WAEHLEN_ERWEITERT_ID,
	// Nicht «Bewirtschaftung mit erweiterten Kompetenzen»: So heisst schon die
	// Karte zur Erweiterung selbst (Codeprüfung Teil 3, N1).
	titel: 'Bewirtschaftung wählen, die schon erweiterte Kompetenzen hat',
	// Rechnet nach der Vorgabe gegen den Wortlaut von Art. 647b Abs. 1, wie der
	// Kommentar es tut (Fachprüfung 20.10.2026, Befund 12).
	rang: 'lehre',
	hinweise: (vorher.hinweise ?? []).map((h) => (h === HINWEIS_VORHER ? HINWEIS_ERWEITERT : h)),
	hinweiseUnterRegel: [
		...(vorher.hinweiseUnterRegel ?? []).filter((u) => u.hinweis !== HINWEIS_VORHER),
		UNTER_REGEL
	],
	lesart: {
		kennung: 'L4',
		andere: {
			wahl: 'qualifiziert',
			typ: 'qualifiziertes_mehr',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten'
		}
	}
};

export const REGELWERK_2026_10_24 = {
	...REGELWERK_2026_10_23,
	fassung: '2026-10-24',

	fragen: [...REGELWERK_2026_10_23.fragen.map(mitNachfrage), KOMPETENZFRAGE],

	knoten: REGELWERK_2026_10_23.knoten.flatMap((k) =>
		k.id === WAEHLEN_ID ? [GEWOEHNLICH, WAEHLEN_ERWEITERT] : [k]
	),

	freigabevermerk:
		REGELWERK_2026_10_23.freigabevermerk +
		' In der Fassung 2026-10-24 fragt der Baum bei der Wahl der Bewirtschaftung nach ihren ' +
		'Kompetenzen; hat sie erweiterte, rechnet Votum nach der Lesart der Gemeinschaft.'
} satisfies Regelwerk;
