/**
 * Fassung 2026-11-14: Die Gemeinschaft stellt ein, wie die Köpfe bei der
 * «Mehrheit aller Miteigentümer» zählen (Lesart L13, Entscheid 0048, Block C).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-13 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht so oft steht wie erwartet oder
 * der neue schon dasteht. Auftrag
 * `.auftraege/2026-11-13-votum-c-zaehlweise-lesart.md`; die Wortlaute aus der
 * Endfassung der Prüfvorlage (`quellen`,
 * `pruefung/zu-pruefen-2026-11-13-votum-regel43-block-c-endfassung.md`) nach
 * fünf Runden Laien- und Fachprüfung.
 *
 * **Der Anlass.** Art. 647a Abs. 2, 647b Abs. 1, 647c, 647d Abs. 1 und 647e
 * Abs. 2 ZGB sagen «Mehrheit aller Miteigentümer». Votum zählt dort die Köpfe
 * nach der herrschenden Lehre unter den Anwesenden und Vertretenen. Das
 * Bundesgericht hat das nur für Art. 647d bestätigt (BGE 144 III 510 E. 2.2.4,
 * «merita conferma»); Art. 647c steht dort nur als Einschub im Folgeargument,
 * und die Regeste nennt nur nützliche bauliche Massnahmen (Entscheid 0048,
 * Anlass). Produktentscheid 13.11.2026 (Antworten 4 bis 6): eine Einstellung
 * mit der Vorgabe «Anwesende und Vertretene» und der Wahl «Alle Eigentümer»
 * an den vier Bestimmungen ohne Entscheid des Bundesgerichts.
 *
 * **Was sich ändert:**
 *
 *  - Kein Knoten trägt L13, keine Kopfbasis eines Knotens ändert sich: Die
 *    Wahl wirkt am gerechneten Erfordernis (`mitKopfzaehlweise`, `lesarten.ts`)
 *    und, für die Ergebniskarte, am Knoten nach der Wahl
 *    (`knotenNachZaehlweise`), ab dieser Fassung (`KOPFZAEHLWEISE_AB`).
 *  - «Wortlaut und Rechtsprechung» je Artikel (`wortlautErklaerungJeArtikel`):
 *    Art. 647d fest nach 4a, die vier anderen nach 4b; unter «Alle
 *    Eigentümer» nach 4c (`wortlautErklaerungJeArtikelAlle`).
 *  - Die Formel der Karte, wo die Köpfe an allen Eigentümern zählen
 *    (`formelAlleEigentuemer`).
 *  - Sätze an fünf Karten, die die Zählung unter den Anwesenden als die einzige
 *    nannten oder «nach beiden Lesarten» sagten, wo «beiden Wahlen zum Mehr»
 *    gemeint ist (Endfassung, Abschnitt 7; `ERSETZUNGEN`).
 *
 * **Alte Traktanden** rechnen weiter nach ihrer Fassung, die Köpfe unter den
 * Anwesenden und Vertretenen; freigegebene nach der eingefrorenen Wahl ihrer
 * Momentaufnahme (Migration 192 setzt `snapshot.reading_l13` auf die Vorgabe).
 *
 * **Sonst bleibt alles**, jeder andere Knoten, jede Frage und jedes
 * Erfordernis (`tests/domain/fassung-2026-11-14.test.ts`).
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_13 } from './quorum-2026-11-13';

// ── «Wortlaut und Rechtsprechung» je Artikel (Endfassung, Abschnitt 4) ───────

/** Der Satz des Bestands zur Zählweise im Reglement («[Reglement]» der Endfassung). */
export const REGLEMENT_SATZ =
	'Ihr Reglement darf eine andere Zählweise vorsehen, dafür braucht es aber die Zustimmung aller ' +
	'Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; BGE 143 III 537 E. 4.2.3) und eine klare ' +
	'Formulierung.';

/** Der Satz zu den Enthaltungen in 4a und 4b; unter der Enthaltungsklausel entfällt er (Abschnitt 6). */
export const ENTHALTUNG_SATZ = 'Enthaltungen zählen mit und wirken wie ein Nein.';

/** 4a, Art. 647d Abs. 1, fest: Dort wirkt L13 nicht. */
export const WORTLAUT_647D =
	'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Gezählt werden trotzdem die Köpfe der Anwesenden ' +
	'und Vertretenen: So hat es das Bundesgericht für nützliche bauliche Massnahmen bestätigt, der ' +
	'herrschenden Lehre folgend (BGE 144 III 510 E. 2.2.4; SVIT-Kommentar Rz. 181 und 190 f. ad Art. 712m). ' +
	'Die Einstellung Ihrer Gemeinschaft zur Zählweise gilt hier deshalb nicht. Einzelne Autoren zählen alle ' +
	`Eigentümer; das Bundesgericht ist ihnen nicht gefolgt. ${ENTHALTUNG_SATZ} ${REGLEMENT_SATZ}`;

/** {Lehre} und {Gericht} je Artikel (Endfassung, Tabelle in Abschnitt 4). */
export const LEHRE_UND_GERICHT: Record<string, { lehre: string; gericht: string }> = {
	'ZGB Art. 647a Abs. 2': {
		lehre: 'SVIT-Kommentar Rz. 166b ad Art. 712m; Handschin/Wyttenbach, S. 67 f.',
		gericht: 'Das Bundesgericht hat über die Zählweise hier nicht entschieden; Näheres unter «Zu beachten».'
	},
	'ZGB Art. 647b Abs. 1': {
		lehre: 'SVIT-Kommentar Rz. 168 und 190 f. ad Art. 712m',
		gericht:
			'Das Bundesgericht hat diese Zählung nur für nützliche bauliche Massnahmen bestätigt (BGE 144 III 510 ' +
			'E. 2.2.4), für wichtigere Verwaltungshandlungen nicht entschieden.'
	},
	'ZGB Art. 647c': {
		lehre: 'SVIT-Kommentar Rz. 124 ad Art. 712a, Rz. 166b ad Art. 712m; Handschin/Wyttenbach, S. 67 f.',
		gericht:
			'Das Bundesgericht hat nur über nützliche bauliche Massnahmen entschieden und die notwendigen ' +
			'Arbeiten dabei erwähnt, aber nicht beurteilt (BGE 144 III 510 E. 2.2.4).'
	},
	'ZGB Art. 647e Abs. 2': {
		lehre: 'SVIT-Kommentar Rz. 168 und 190 f. ad Art. 712m',
		gericht:
			'Das Bundesgericht hat nur über nützliche bauliche Massnahmen entschieden (BGE 144 III 510 E. 2.2.4); ' +
			'zu den luxuriösen äussert es sich nicht.'
	}
};

const KOPF = (lehre: string) =>
	'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Die herrschende Lehre, die Auffassung der meisten ' +
	`Fachleute, zählt trotzdem nur die Köpfe der Anwesenden und Vertretenen (${lehre}).`;

/** 4b, unter «Anwesende und Vertretene» (auch die Website). */
export function wortlautAnwesende(artikel: string): string {
	const { lehre, gericht } = LEHRE_UND_GERICHT[artikel];
	return (
		`${KOPF(lehre)} ${gericht} Im Streit um die Zählweise sicher ist ein Beschluss, dem mehr als die ` +
		'Hälfte aller Eigentümer zustimmt; holen Sie dafür vor der Versammlung Vollmachten ein. ' +
		`${ENTHALTUNG_SATZ} ${REGLEMENT_SATZ}`
	);
}

/** 4c, unter «Alle Eigentümer» (nur Votum). */
export function wortlautAlle(artikel: string): string {
	const { lehre, gericht } = LEHRE_UND_GERICHT[artikel];
	return (
		`${KOPF(lehre)} ${gericht} Die Einstellung Ihrer Gemeinschaft, die Köpfe an allen Eigentümern zu ` +
		'zählen, ist keine Bestimmung Ihres Reglements und bindet ein Gericht nicht. Soll diese Zählung ' +
		'unabhängig vom Streit gelten, gehört sie ins Reglement; dafür braucht es die Zustimmung aller ' +
		'Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; BGE 143 III 537 E. 4.2.3) und eine klare ' +
		'Formulierung.'
	);
}

const VIER = Object.keys(LEHRE_UND_GERICHT);

// ── Die Formel unter allen Eigentümern ───────────────────────────────────────

/*
 * **Nicht aus der Endfassung**: Die Endfassung nennt keine Formel, und die des
 * Typs sagt «der anwesenden oder vertretenen». Gebaut aus der Formel des Typs
 * und der Wirkung der Wahl «Alle Eigentümer» (Endfassung, Abschnitt 1); gehört
 * in die Nachtragsprüfung (Abschnitt 8).
 */
export const FORMEL_ALLE_EINFACH =
	'Mehrheit der Köpfe aller Eigentümer, auch der abwesenden; wer fehlt und keine Vollmacht gegeben hat, ' +
	'wirkt wie ein Nein.';
export const FORMEL_ALLE_QUALIFIZIERT =
	'Mehrheit der Köpfe aller Eigentümer, auch der abwesenden, und zugleich mehr als die Hälfte aller ' +
	'Wertquoten (bei einem Nenner von 1000 also mindestens 501). Wer fehlt und keine Vollmacht gegeben hat, ' +
	'wirkt bei Köpfen und Wertquoten wie ein Nein.';

// ── Sätze an den Karten (Endfassung, Abschnitt 7) ────────────────────────────

/**
 * Was an welchen Karten ersetzt wird, mit der Zahl der Stellen in der
 * Vorfassung. Ersetzt wird in jedem Satz des Knotens (Hinweise, Hinweise unter
 * einer Regel, Ersatzhinweise einer Lesart, Rechtssatz), damit ein
 * `hinweisErsatz` weiter auf einen Hinweis zeigt, den der Knoten trägt.
 */
export const ERSETZUNGEN: { knoten: string[]; alt: string; neu: string; stellen: number }[] = [
	{
		/*
		 * `REST_EINFACH` der Fassung 2026-11-13, der Ersatzhinweis unter L4
		 * «einfach», zuerst: Dort rechnet die Karte nach Art. 712m und hat kein
		 * «Wortlaut und Rechtsprechung» (Fachprüfung Block C, Nachtrag, N-F-4).
		 */
		knoten: ['k-bewirtschaftung-waehlen-erweitert'],
		alt:
			'wählt trotzdem mit qualifiziertem Mehr: Mehr als die Hälfte der anwesenden und vertretenen ' +
			'Eigentümer stimmt zu, und sie halten zusammen mehr als die Hälfte aller Wertquoten.',
		neu:
			'wählt trotzdem mit qualifiziertem Mehr: Mehr als die Hälfte aller Eigentümer stimmt zu, auch der ' +
			'abwesenden, und sie halten zusammen mehr als die Hälfte aller Wertquoten. Dann kommt es weder auf den ' +
			'Streit um das Mehr noch auf den um die Zählweise der Köpfe an.',
		stellen: 1
	},
	{
		// `REST` der Fassung 2026-11-13, im Hinweis, unter einer Regel und als
		// Schlüssel des Ersatzhinweises von L4. In der Vorfassung vier Stellen: Die
		// vierte steht in `REST_EINFACH`, und die ersetzt die Regel davor.
		knoten: ['k-bewirtschaftung-waehlen-erweitert'],
		alt:
			'Mehr als die Hälfte der anwesenden und vertretenen Eigentümer stimmt zu, und sie halten zusammen ' +
			'mehr als die Hälfte aller Wertquoten.',
		neu:
			'Mehr als die Hälfte der Eigentümer stimmt zu, und sie halten zusammen mehr als die Hälfte aller ' +
			'Wertquoten. Wie die Köpfe gezählt werden, steht unter «Wortlaut und Rechtsprechung».',
		stellen: 4
	},
	{
		// `WORTLAUT_ALLER` der Fassung 2026-10-26 an `k-zustaendigkeit-gewoehnlich`.
		knoten: ['k-zustaendigkeit-gewoehnlich'],
		alt: '(S. 68); Votum bietet sie deshalb nicht an.',
		neu:
			'(S. 68). Ob Votum die Köpfe trotzdem an allen Eigentümern zählt, wird auf der Seite «Lesarten» ' +
			'eingestellt; Vorgabe sind die Anwesenden und Vertretenen.',
		stellen: 3
	},
	{
		// `HINWEIS_LESART` der Fassung 2026-10-26.
		knoten: ['k-zustaendigkeit-gewoehnlich'],
		alt: 'besteht nach beiden Lesarten, die Votum anbietet.',
		// Laienprüfung Block C, Nachtrag, N-L-04: neben der Zählweise der Köpfe nicht als ihre Wahl zu lesen.
		neu: 'besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.',
		stellen: 2
	},
	{
		// `STREIT_647B` der Fassung 2026-10-30 (R5-F-1).
		knoten: ['k-bewirtschaftung-erweitert', 'k-verwaltung-wichtig'],
		alt:
			'gilt er nach dem Kommentar; ganz sicher ist er nur, wenn er auch das Mehr des Gesetzes erreicht. ' +
			'Halten Sie das dann im Protokoll fest',
		neu:
			'gilt er nach dem Kommentar; erreicht er auch das Mehr des Gesetzes, kommt es auf diesen Streit nicht ' +
			'an. Erreicht er nur das mildere, halten Sie das im Protokoll fest',
		stellen: 2
	},
	{
		// `RECHT_ERWEITERT` der Fassung 2026-10-30 (R5-F-2).
		knoten: ['k-bewirtschaftung-erweitert'],
		alt:
			'nach dem Gesetz braucht es, so wie es gezählt wird, die Mehrheit der Anwesenden und Vertretenen und ' +
			'zusätzlich mehr als die Hälfte aller Wertquoten.',
		neu: 'nach dem Gesetz braucht es neben der Mehrheit nach Köpfen mehr als die Hälfte aller Wertquoten.',
		stellen: 1
	},
	{
		// `WAHL_ZUM_GESETZ_ERWEITERT` der Fassung 2026-10-24, unter einer Regel im
		// Abschnitt «Zum gesetzlichen Erfordernis» (Fachprüfung Nachtrag Runde 2,
		// N2-F-5): «sicher» nur im Streit um das Mehr, wie N-F-3 und N-F-4.
		knoten: ['k-bewirtschaftung-waehlen-erweitert'],
		alt: 'Wer sicher gehen will, strebt das qualifizierte Mehr an.',
		neu:
			'Wer sicher gehen will, strebt das qualifizierte Mehr an; stimmt dabei mehr als die Hälfte aller ' +
			'Eigentümer zu, auch der abwesenden, kommt es auch auf den Streit um die Zählweise der Köpfe nicht an.',
		stellen: 1
	},
	{
		// `NACH_EINFACHEM_MEHR` der Fassung 2026-11-10 (Laienprüfung Nachtrag Runde 2,
		// N2-L-10): welcher Hinweis wann gilt, auch auf der Karte zum qualifizierten Mehr.
		knoten: ['k-prozessfuehrung'],
		alt: 'Dieser Hinweis gilt nach einer Annahme mit dem einfachen Mehr, nicht nach einer Ablehnung, auch ',
		neu:
			'Dieser Hinweis gilt, wenn die Ermächtigung mit dem einfachen Mehr angenommen wurde, etwa weil Ihre ' +
			'Gemeinschaft es so eingestellt hat; nicht nach einer Ablehnung, auch ',
		stellen: 2
	},
	{
		// `HINWEIS` der Fassung 2026-11-10 an `k-prozessfuehrung` (R5-F-3).
		knoten: ['k-prozessfuehrung'],
		alt: 'qualifizierten Mehr genügt beiden Lesarten.',
		neu: 'qualifizierten Mehr genügt beiden Wahlen zum Mehr, einfach oder qualifiziert.',
		stellen: 2
	}
];

/**
 * Ein Wortlaut der Vorfassung, wie er in dieser Fassung lautet: alle
 * `ERSETZUNGEN` angewandt. Für den Website-Abzug, dessen Umformulierungen am
 * Wortlaut der Fassung hängen (`scripts/quorumsbaum-export.mjs`).
 */
export function nachDieserFassung(text: string): string {
	return ERSETZUNGEN.reduce((t, e) => t.split(e.alt).join(e.neu), text);
}

/** Ersetzt in jeder Zeichenkette eines Werts, ohne ihn zu verändern. */
function ersetzeTief<T>(wert: T, alt: string, neu: string): T {
	if (typeof wert === 'string') return wert.split(alt).join(neu) as T;
	if (Array.isArray(wert)) return wert.map((w) => ersetzeTief(w, alt, neu)) as T;
	if (wert && typeof wert === 'object') {
		return Object.fromEntries(
			Object.entries(wert as Record<string, unknown>).map(([k, v]) => [k, ersetzeTief(v, alt, neu)])
		) as T;
	}
	return wert;
}

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_11_13.knoten.map((k) => {
	let neu = k;
	for (const e of ERSETZUNGEN) {
		if (e.knoten.includes(k.id)) neu = ersetzeTief(neu, e.alt, e.neu);
	}
	return neu;
});

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

for (const e of ERSETZUNGEN) {
	const stellen = REGELWERK_2026_11_13.knoten
		.filter((k) => e.knoten.includes(k.id))
		.reduce((n, k) => n + JSON.stringify(k).split(JSON.stringify(e.alt).slice(1, -1)).length - 1, 0);
	if (stellen !== e.stellen) {
		throw new Error(
			`Fassung 2026-11-14: «${e.alt.slice(0, 50)}…» steht ${stellen}-mal statt ${e.stellen}-mal in der Vorfassung.`
		);
	}
	const sonst = REGELWERK_2026_11_13.knoten
		.filter((k) => !e.knoten.includes(k.id))
		.some((k) => JSON.stringify(k).includes(JSON.stringify(e.alt).slice(1, -1)));
	if (sonst) throw new Error(`Fassung 2026-11-14: «${e.alt.slice(0, 50)}…» steht auch an einer anderen Karte.`);
}
const VORFASSUNG = JSON.stringify(REGELWERK_2026_11_13);
for (const neu of [WORTLAUT_647D, ...VIER.map(wortlautAnwesende), ...VIER.map(wortlautAlle)]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-14: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_14 = {
	...REGELWERK_2026_11_13,
	fassung: '2026-11-14',

	knoten: KNOTEN,

	wortlautErklaerungJeArtikel: {
		...Object.fromEntries(VIER.map((a) => [a, wortlautAnwesende(a)])),
		'ZGB Art. 647d Abs. 1': WORTLAUT_647D
	},
	wortlautErklaerungJeArtikelAlle: Object.fromEntries(VIER.map((a) => [a, wortlautAlle(a)])),
	formelAlleEigentuemer: {
		einfaches_mehr: FORMEL_ALLE_EINFACH,
		qualifiziertes_mehr: FORMEL_ALLE_QUALIFIZIERT
	},

	freigabevermerk:
		REGELWERK_2026_11_13.freigabevermerk +
		' In der Fassung 2026-11-14 stellt die Gemeinschaft auf der Seite «Lesarten» ein, ob bei der ' +
		'«Mehrheit aller Miteigentümer» nach Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e Abs. 2 ZGB die ' +
		'Köpfe der Anwesenden und Vertretenen zählen (Standardeinstellung) oder die aller Eigentümer; bei ' +
		'Art. 647d zählen fest die Anwesenden und Vertretenen.'
} satisfies Regelwerk;
