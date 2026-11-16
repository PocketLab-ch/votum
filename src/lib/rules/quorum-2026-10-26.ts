/**
 * Fassung 2026-10-26: Zuständigkeitsordnung ausserhalb des Reglements als
 * Lesart der Gemeinschaft (L2).
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Ergebnis nach der
 * Vorgabe. Der Knoten `k-zustaendigkeit-gewoehnlich` rechnet weiter das
 * einfache Mehr der Anwesenden und Vertretenen und trägt die Lesart L2: Die
 * Gemeinschaft kann auf das qualifizierte Mehr nach Köpfen und Wertquoten
 * umstellen (SVIT-Kommentar Rz. 109 ad Art. 712a).
 *
 * **Was sich am Text ändert.** Begründung und Hinweis sagen nicht mehr «dieses
 * Werkzeug setzt das einfache Mehr an» und «nach diesem Werkzeug zustande
 * gekommen». Die Begründung sagt nur noch, dass die Frage nicht abschliessend
 * geklärt ist; der Hinweis nennt den Wortlaut «aller», den keine der beiden
 * Wahlen rechnet (Konzept Lesarten, Kriterium 8), und dass die Gemeinschaft die
 * Lesart einstellt. Der Satz mit beiden Randziffern bleibt.
 *
 * **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), F6: Vorgabe
 * mild. Getragen wird sie von Rz. 166 und 168 ad Art. 712m (Art. 647a Abs. 2
 * beim einfachen Mehr, nicht beim qualifizierten), Rz. 34 ad Art. 712g,
 * Handschin/Wyttenbach S. 68 und BGE 131 III 459 E. 5.2. Dass Rz. 109 ad
 * Art. 712a vor allem das Reglement meine, ist unsere Auslegung, nicht die des
 * Kommentars (Fachprüfung Block 3, Befund 1).
 *
 * **Unter einer hinterlegten Regel** fällt die Lesart weg (`wendeReglementAn`);
 * der Abschnitt «Zum gesetzlichen Erfordernis» nennt dann den Streit ohne die
 * Seite «Lesarten».
 *
 * **Alte Traktanden** mit diesem Knoten rechnen weiter nach ihrer Fassung, ohne
 * Lesart, solange die Gemeinschaft auf der Wahl steht, die ihr Knoten rechnet
 * (meist «einfach»; an 2026-08-16, 09-21 und 09-22 «qualifiziert», Entscheid
 * 0048, Block A). Steht sie auf der anderen, sagt die Freigabe ab, bis sie
 * nachgezogen sind (`veralteteLesartenIn`; Review DeepSeek zu Block 3, V1).
 */
import type { Ergebnisknoten, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_25 } from './quorum-2026-10-25';

export const ZUSTAENDIGKEIT_ID = 'k-zustaendigkeit-gewoehnlich';

const vorher = REGELWERK_2026_10_25.knoten.find((k) => k.id === ZUSTAENDIGKEIT_ID);
if (!vorher) throw new Error(`Fassung 2026-10-26: «${ZUSTAENDIGKEIT_ID}» fehlt in der Vorfassung.`);

/** Der Satz zur Begründung, der wegfällt. Ausgeschrieben, damit der Export ihn für die Website zurücksetzt. */
export const BEGRUENDUNG_VORHER = vorher.begruendung;
const WERKZEUGSATZ = ' Der Gesetzeswortlaut verlangt dafür kein Wertquotenelement; dieses Werkzeug setzt deshalb das einfache Mehr an.';
if (!BEGRUENDUNG_VORHER.endsWith(WERKZEUGSATZ)) {
	throw new Error(`Fassung 2026-10-26: Die Begründung von «${ZUSTAENDIGKEIT_ID}» endet nicht wie erwartet.`);
}

/** Der Hinweis der Vorfassung mit «nach diesem Werkzeug zustande gekommen». */
const vorherHinweise = (vorher.hinweise ?? []).filter((h) => h.startsWith('Erreicht Ihr Beschluss nur das einfache Mehr'));
if (vorherHinweise.length !== 1) {
	throw new Error(`Fassung 2026-10-26: «${ZUSTAENDIGKEIT_ID}» trägt den Hinweis zum Werkzeug nicht genau einmal.`);
}
export const HINWEIS_VORHER = vorherHinweise[0];

/*
 * Ohne «Votum rechnet nach der Lesart der Gemeinschaft» (Laienprüfung Block 3,
 * H1 und H2): Die Begründung wandert unter einer hinterlegten Regel mit in
 * «Zum gesetzlichen Erfordernis», und dort rechnet Votum gerade nicht danach.
 */
// Ohne Verweis «siehe die Hinweise»: Auf dem Bildschirm heisst der Block «Zu
// beachten», unter einer Regel steht er im Kasten (Laienprüfung Runde 2, L3-3).
// «Nicht abschliessend geklärt» statt «umstritten»: Für das einfache Mehr
// sprechen fast alle Stellen (Fachprüfung Runde 2, zu Befund 1).
export const BEGRUENDUNG =
	BEGRUENDUNG_VORHER.slice(0, -WERKZEUGSATZ.length) + ' Welches Mehr dafür gilt, ist nicht abschliessend geklärt.';

/**
 * Der Wortlaut, den keine der beiden Wahlen rechnet (Kriterium 8). Mit dem
 * Beleg für diese Karte (Fachprüfung Block 3, Befund 2): Der allgemeine
 * Hinweis zum Wortlaut belegt mit Art. 647b, 647d und 647e und einem Entscheid
 * zu Art. 647d; zu Art. 647a Abs. 2 tragen Rz. 166b und BGE 131 III 459
 * E. 5.2. Warum Votum den Wortlaut nicht anbietet (Laienprüfung Block 3, M7).
 *
 * **Runde 2:** Der Satz «Zu Art. 647a Abs. 2 liegt kein Entscheid des
 * Bundesgerichts vor» war falsch; E. 5.2 nennt den Artikel ausdrücklich beim
 * einfachen Mehr nach Köpfen, als allgemeine Aufzählung (Fachprüfung Runde 2,
 * Befund 1; am Volltext nachgelesen). Der Verweis auf den «Hinweis zum
 * Wortlaut» fiel mit weg; unter einer Regel gibt es ihn nicht (Laien L3-2).
 */
export const WORTLAUT_ALLER =
	'Nach dem Wortlaut von Art. 647a Abs. 2 ZGB braucht es die Mehrheit aller Miteigentümer, auch der ' +
	'abwesenden. Diese Zählung wendet der SVIT-Kommentar beim Stockwerkeigentum nicht an (Rz. 166b ad ' +
	'Art. 712m), ebenso Handschin/Wyttenbach (S. 68); Votum bietet sie deshalb nicht an. Das ' +
	'Bundesgericht nennt Art. 647a Abs. 2 bei den Beschlüssen mit einfachem Mehr nach Köpfen (BGE 131 ' +
	'III 459 E. 5.2), in einer allgemeinen Aufzählung. Der Fall selbst betraf eine andere Frage.';

/** Der Hinweis mit der Lesart, ohne «so rechnet dieses Werkzeug». */
export const HINWEIS_LESART =
	`${WORTLAUT_ALLER} Nach welchem der beiden Mehre Votum rechnet, wird auf der Seite «Lesarten» der ` +
	'Gemeinschaft eingestellt; Vorgabe ist das einfache Mehr. Votum nennt nach der Auszählung auch das ' +
	'Ergebnis nach der anderen Lesart. Ein Beschluss, der das qualifizierte Mehr erreicht, besteht nach ' +
	// Laienprüfung Runde 2, L3-4: welche beiden, neben dem Wortlaut.
	'beiden Lesarten, die Votum anbietet.';

/**
 * Unter einer Regel, im Abschnitt «Zum gesetzlichen Erfordernis»: der Streit
 * ohne die Seite «Lesarten», denn dort rechnet das Reglement. Ohne Rat zum
 * qualifizierten Mehr: Unter einer gültigen Regel las er sich, als brauche es
 * zusätzlich die Wertquoten (Laienprüfung Block 3, H2; Fachprüfung, Befund 4).
 */
export const ZUM_GESETZ_LESART = WORTLAUT_ALLER;

const UNTER_REGEL: HinweisUnterRegel = { hinweis: HINWEIS_LESART, zumGesetz: ZUM_GESETZ_LESART };

/** Dasselbe Mehr nach der Vorgabe, dazu die Lesart L2. */
export const ZUSTAENDIGKEIT: Ergebnisknoten = {
	...vorher,
	begruendung: BEGRUENDUNG,
	hinweise: (vorher.hinweise ?? []).map((h) => (h === HINWEIS_VORHER ? HINWEIS_LESART : h)),
	hinweiseUnterRegel: (vorher.hinweiseUnterRegel ?? []).map((u) => (u.hinweis === HINWEIS_VORHER ? UNTER_REGEL : u)),
	lesart: {
		kennung: 'L2',
		andere: {
			wahl: 'qualifiziert',
			typ: 'qualifiziertes_mehr',
			rechtsgrundlage: 'ZGB Art. 647a Abs. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten'
		}
	}
};

export const REGELWERK_2026_10_26 = {
	...REGELWERK_2026_10_25,
	fassung: '2026-10-26',

	knoten: REGELWERK_2026_10_25.knoten.map((k) => (k.id === ZUSTAENDIGKEIT_ID ? ZUSTAENDIGKEIT : k)),

	freigabevermerk:
		REGELWERK_2026_10_25.freigabevermerk +
		' In der Fassung 2026-10-26 rechnet Votum bei einer Zuständigkeitsordnung ausserhalb des ' +
		'Reglements nach der Lesart der Gemeinschaft.'
} satisfies Regelwerk;
