/**
 * Fassung 2026-11-17: Die Anwendung sagt an den Stellen, die der Website-Abzug
 * seit `5239aea5` eigens berichtigt, dasselbe wie die Website (Auftrag
 * `.auftraege/2026-11-15-votum-textfassung-nach-website-abzug.md`; Pendenzen
 * «Website-Abzug, Sätze der Anwendung nachziehen»). Die Website-Sätze sind in
 * vier Runden Laien- und Fachprüfung geprüft (`quellen`
 * `pruefung/berichte/2026-11-15-votum-website-abzug-befunde-*`).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-16 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht so oft steht wie erwartet oder
 * der neue schon dasteht. Die Fassung 2026-11-16 bleibt unverändert.
 *
 * **Was sich ändert:**
 *
 *  - «Wortlaut und Rechtsprechung» (4b) und die allgemeine Erklärung (T4): der
 *    sichere Weg bei den Köpfen ohne «Im Streit um die Zählweise» (L7), an den
 *    Karten mit qualifiziertem Mehr mit den Wertquoten daneben (L5). An
 *    Art. 647c der Satz zum Bundesgericht mit der Begründung von BGE 144 III
 *    510 E. 2.2.4 zur Zweitversammlung, auch in 4c (F4).
 *    In 4b dazu ein Satz zur Lage zwischen beiden Zählweisen ohne Zeitangabe,
 *    mit Verweis auf den Rat nach der Auszählung (Laienprüfung M1, Fachprüfung
 *    N1).
 *  - `k-bewirtschaftung-waehlen-erweitert`: Der Hinweis bleibt einer, aber in
 *    der Reihenfolge der Website, die Handlung zuerst und die Erweiterung am
 *    Schluss (L10; Laienprüfung M5). Neu darin die Stütze des Kommentars im
 *    Gesetz (Rz. 112 ad Art. 712a; Entscheid 0048, Antwort 11), der Vorsitz bei
 *    der Wahl (Rz. 75 und 76a ad Art. 712n) und «Befugnisse vor der Wahl
 *    streichen lassen» (Rz. 44 ad Art. 712m). Unter der Wahl «einfach» die
 *    Stütze, der Vorsitz und die Wartezeit nach der Frist.
 *  - `k-grenzfall-nutzung`: Die Zählung der Köpfe unter den Anwesenden steht
 *    nicht mehr ohne Vorbehalt da, und weil Votum an einer Grenzfallkarte nicht
 *    auszählt, steht dort auch, was gilt, wenn die Ja zwischen beiden
 *    Zählweisen liegen.
 *
 * Laien- und Fachprüfung: `quellen`
 * `pruefung/berichte/2026-11-15-votum-textfassung-2026-11-17-*`.
 *
 * **Was nicht übernommen ist, mit Grund:**
 *
 *  - L2 in 4b im Wortlaut der Website (Anfechtung, Zustellung, Wartezeit): Die
 *    Anwendung zählt an diesen Karten selbst aus und nennt in genau diesem Fall
 *    Frist, Anfechtung und Wartezeit (L13, `nachAnnahme` in `lesarten.ts`).
 *    Die Wartezeit der Website, «einige Tage nach Ablauf», ist nach der
 *    Fachprüfung zu kurz (M1, Meldung an die Website); die Anwendung sagt, wie
 *    unter L13, einige Wochen, am Grenzfall und unter «einfach» mit Grund.
 *  - Die Aufteilung des Hinweises zur Wahl in fünf (L10): `hinweisErsatz`
 *    tauscht einen Hinweis gegen genau einen (`knotenNachLesart`); das Aufteilen
 *    wäre Code, keine Fassung. Die Reihenfolge der Website übernimmt der eine
 *    Hinweis.
 *
 * **Punkt statt Strichpunkt**: `check:texte` lässt je Satz höchstens 180
 * Zeichen zu, die Website kennt die Schranke nicht. Wo ein Website-Satz länger
 * ist, steht er hier in zwei oder drei Sätzen mit denselben Wörtern, so weit
 * es geht; der Export setzt für die Website den geprüften Wortlaut ein
 * (`scripts/quorumsbaum-export.mjs`), und der Abzug bleibt byte-gleich.
 *
 * **Kein Ergebnis ändert sich**, kein Erfordernis, keine Frage
 * (`tests/domain/fassung-2026-11-17.test.ts`).
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_16 } from './quorum-2026-11-16';
import { nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-15';
import { LEHRE_UND_GERICHT } from './quorum-2026-11-14';
import { HINWEIS as WAHL_HINWEIS_2026_11_13, REST as WAHL_REST_2026_11_13 } from './quorum-2026-11-13';
import { ERWEITERUNG } from './quorum-2026-10-23';

const VOR = REGELWERK_2026_11_16;
const ART_647A = 'ZGB Art. 647a Abs. 2';
const ART_647B = 'ZGB Art. 647b Abs. 1';
const ART_647C = 'ZGB Art. 647c';
const ART_647E = 'ZGB Art. 647e Abs. 2';

// ── 4b: der sichere Weg (L7, L5) ─────────────────────────────────────────────

/** Der sichere Weg in 4b, wie ihn `wortlautAnwesende` der Fassung 2026-11-14 setzt. */
export const SICHER_VORHER =
	'Im Streit um die Zählweise sicher ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt; ' +
	'holen Sie dafür vor der Versammlung Vollmachten ein.';

/** Der sichere Weg bei den Köpfen (L7); auf der Website ein Satz mit Strichpunkt. */
const SICHER_KOEPFE =
	'Weil die Zählweise umstritten ist, ist bei den Köpfen nur ein Beschluss ganz sicher, dem mehr als die ' +
	'Hälfte aller Eigentümer zustimmt.';
const VOLLMACHTEN = 'Holen Sie dafür vor der Versammlung Vollmachten ein.';
/** Laienprüfung N2: Die Wertquoten gelten nicht nur für den ganz sicheren Weg. */
const WERTQUOTEN = 'Mehr als die Hälfte aller Wertquoten braucht es in jedem Fall.';

/**
 * Die Lage zwischen beiden Zählweisen, vor der Abstimmung (Laienprüfung M1,
 * Fachprüfung N1): ohne Zeitangabe, damit die Wartezeit nur im Rat nach der
 * Auszählung steht (L13, `nachAnnahme`).
 */
const NACH_AUSZAEHLUNG = 'Er kann aber angefochten werden; was dann zu tun ist, sagt Votum nach der Auszählung.';
export const DAZWISCHEN_EINFACH =
	'Erreicht der Antrag nur die Mehrheit der Anwesenden und Vertretenen, ist er nach der herrschenden Lehre ' +
	`angenommen. ${NACH_AUSZAEHLUNG}`;
export const DAZWISCHEN_QUALIFIZIERT =
	'Erreicht der Antrag die Wertquoten, bei den Köpfen aber nur die Mehrheit der Anwesenden und Vertretenen, ist ' +
	`er nach der herrschenden Lehre angenommen. ${NACH_AUSZAEHLUNG}`;

/** An Art. 647c «Am sichersten», wie auf der Website. */
const SICHER_647C =
	'Am sichersten ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt; holen Sie dafür vor der ' +
	'Versammlung Vollmachten ein.';

/**
 * Der sichere Weg je Artikel und die Lage dazwischen, an der Stelle von
 * `SICHER_VORHER`. An den Karten mit qualifiziertem Mehr die Wertquoten (L5).
 * An Art. 647c «Am sichersten», wie auf der Website: Dort trägt die Begründung
 * des Bundesgerichts die Zählung unter den Anwesenden (F4, unten), und «nur
 * ganz sicher» sagte mehr, als der Streit hergibt.
 */
export const SICHER_JE_ARTIKEL: Record<string, string> = {
	[ART_647A]: `${SICHER_KOEPFE} ${VOLLMACHTEN} ${DAZWISCHEN_EINFACH}`,
	[ART_647B]: `${SICHER_KOEPFE} ${WERTQUOTEN} ${VOLLMACHTEN} ${DAZWISCHEN_QUALIFIZIERT}`,
	[ART_647C]: `${SICHER_647C} ${DAZWISCHEN_EINFACH}`,
	[ART_647E]: `${SICHER_KOEPFE} ${WERTQUOTEN} ${VOLLMACHTEN} ${DAZWISCHEN_QUALIFIZIERT}`
};

// ── 4b und 4c an Art. 647c: das Bundesgericht (F4) ──────────────────────────

/** {Gericht} an Art. 647c der Fassung 2026-11-14: «erwähnt, aber nicht beurteilt». */
export const GERICHT_647C_VORHER = LEHRE_UND_GERICHT[ART_647C].gericht;

/**
 * Was das Bundesgericht zu den notwendigen Arbeiten sagt: In BGE 144 III 510
 * E. 2.2.4 trägt die Zweitversammlung das Ergebnis zu Art. 647d, und dabei
 * nennt das Gericht die notwendigen Arbeiten (F4). Der zweite Satz der Website
 * hat 236 Zeichen; hier in zwei Sätzen, und mit dem, was eine Zweitversammlung
 * ist (Laienprüfung M2).
 */
export const GERICHT_647C =
	'Das Bundesgericht hat diese Zählung nur für die nützlichen Massnahmen entschieden (BGE 144 III 510 E. 2.2.4, ' +
	'zu Art. 647d). Es begründet das mit der Zweitversammlung, die einberufen wird, wenn die erste nicht ' +
	'beschlussfähig war. Nimmt an ihr nicht die Hälfte aller Eigentümer teil, könnte sie nach dem Wortlaut auch ' +
	'notwendige Arbeiten nicht beschliessen; das könne der Gesetzgeber nicht gewollt haben.';

// ── T4, die allgemeine Erklärung (L7) ───────────────────────────────────────

/** Der Satz zum sicheren Weg in `ZAEHLUNG_ANWESENDE` der Fassung 2026-11-16. */
export const T4_SICHER_VORHER =
	'Im Streit um die Zählweise sicher ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt.';
export const T4_SICHER = SICHER_KOEPFE;

// ── k-bewirtschaftung-waehlen-erweitert (Antwort 11, Vorsitz, Offerte) ──────

/**
 * Die Stütze des Kommentars im Gesetz (Entscheid 0048, Antwort 11, «für App
 * und Website»; Fachprüfung der Website, F5). Auf der Website hinter
 * «(Rz. 46 ad Art. 712q);» im selben Satz, der dann 264 Zeichen hat.
 */
export const STUETZE_RZ112 =
	'Er hält die Bestimmungen über den Verwalter für massgebend, die kein qualifiziertes Mehr nennen (Rz. 112 ad ' +
	'Art. 712a).';

/** Dieselbe Stütze unter der Wahl «einfach»: Davor steht «Votum», deshalb mit Namen. */
export const STUETZE_RZ112_EINFACH = STUETZE_RZ112.replace('Er hält', 'Der SVIT-Kommentar hält');

/**
 * Der Vorsitz bei der Wahl (Fachprüfung der Website, Runde 2, A3; Wortlaut
 * nach Runde 3, S1, und Runde 4, U1). Auf der Website ein Satz von 394
 * Zeichen mit zwei Strichpunkten. Hier dazu, warum (es geht auch um die
 * bisherige Verwaltung) und wann (in der Einladung; Laienprüfung M4).
 */
export const VORSITZ_WAHL =
	'Leitet die bisherige Verwaltung die Versammlung, lassen Sie für diese Wahl, bei der es auch um sie geht, eine ' +
	'Eigentümerin oder einen Eigentümer den Vorsitz übernehmen. Das beschliesst die Versammlung mit einfachem Mehr, ' +
	'sofern Ihr Reglement nichts anderes vorsieht, auch wenn der Vorsitzwechsel nicht in der Einladung stand. ' +
	'Sicherer ist, ihn schon in der Einladung anzukündigen (ZGB Art. 712n Abs. 1; SVIT-Kommentar Rz. 75 und 76a ad ' +
	'Art. 712n).';

/**
 * Befugnisse nur in der Offerte (Laienprüfung der Website, Runde 2, R2). Hier
 * dazu, was «Offerte» heisst und was gilt, wenn die Befugnisse später doch
 * dazukommen sollen (Laienprüfung M3; der erste Satz des Hinweises,
 * `ERWEITERUNG`, sagt dasselbe). Nur unter der Vorgabe: Unter «einfach» genügt
 * das einfache Mehr ohnehin, und unter einer Regel des Reglements tritt der
 * Hinweis zurück (`hinweiseUnterRegel`).
 */
export const BEFUGNISSE_STREICHEN =
	'Stehen die weitergehenden Befugnisse nur in der Offerte, also im Entwurf des Verwaltungsvertrags, und nicht im ' +
	'Reglement, können Sie sie vor der Wahl streichen lassen. Dann genügt für die Wahl das einfache Mehr ' +
	'(SVIT-Kommentar Rz. 44 ad Art. 712m). Sollen sie später dazukommen, braucht das einen eigenen Beschluss mit ' +
	'qualifiziertem Mehr.';

/** Statt «Diese Karte verlangt deshalb das qualifizierte Mehr.» nach der Stütze des Kommentars (Laienprüfung N4). */
export const KARTE_FOLGT =
	'Diese Karte folgt dem Wortlaut von Art. 647b Abs. 1 ZGB, der die Wahl einer solchen Bewirtschaftung ' +
	'ausdrücklich nennt, und verlangt das qualifizierte Mehr.';

/** Der Hinweis der Vorfassung: `HINWEIS` der Fassung 2026-11-13 nach den Ersetzungen der Fassung 2026-11-14. */
export const WAHL_HINWEIS_VORHER = nachDerVorfassung(WAHL_HINWEIS_2026_11_13);
const WAHL_REST_VORHER = nachDerVorfassung(WAHL_REST_2026_11_13);
if (WAHL_HINWEIS_VORHER !== `${ERWEITERUNG} ${WAHL_REST_VORHER}`) {
	throw new Error('Fassung 2026-11-17: Der Hinweis zur Wahl ist nicht der erste Satz und `REST`.');
}
const DESHALB_VORHER = 'Diese Karte verlangt deshalb das qualifizierte Mehr.';

/**
 * **Die Stücke des Hinweises**, aus `REST` der Vorfassung geschnitten, nicht
 * abgeschrieben (`stueckAus`), wie der Website-Abzug sie seit `5239aea5`
 * schneidet. Die alten Stücke müssen `REST` lückenlos ergeben. Neu sind der
 * Vorsitz in `vollmachten`, die Stütze in `kommentar`, `streichen` und
 * `karteFolgt`. Der Export setzt daraus die fünf Hinweise der Website.
 */
const VORHER = {
	was: stueckAus(WAHL_REST_VORHER, 'Darf die Bewirtschaftung', 'steht unter «Wortlaut und Rechtsprechung».'),
	nur712s: stueckAus(WAHL_REST_VORHER, 'Hat die Bewirtschaftung nur', '(Rz. 44 ad Art. 712m).'),
	kommentar: stueckAus(WAHL_REST_VORHER, 'Der SVIT-Kommentar lässt', 'dazu ist uns nicht bekannt.'),
	vollmachten: stueckAus(WAHL_REST_VORHER, 'Holen Sie vor der Versammlung', 'neu abstimmen.'),
	ohne: stueckAus(WAHL_REST_VORHER, 'Ist die Gemeinschaft ohne', 'auf die Traktandenliste.'),
	anfechtung: stueckAus(WAHL_REST_VORHER, 'Hält die Versammlungsleitung', 'ab Erhalt des Protokolls.')
};
if (
	[VORHER.was, VORHER.nur712s, VORHER.kommentar, DESHALB_VORHER, VORHER.vollmachten, VORHER.ohne, VORHER.anfechtung].join(
		' '
	) !== WAHL_REST_VORHER
) {
	throw new Error('Fassung 2026-11-17: Die Stücke ergeben den Hinweis zur Wahl der Vorfassung nicht lückenlos.');
}

/**
 * Der Verweis an der Anfechtung auf den Lehrstreit, der in der neuen
 * Reihenfolge weiter unten steht (Laienprüfung Runde 2, R2-M1).
 */
export const ANFECHTUNG_VERWEIS = ' etwa weil sie dem SVIT-Kommentar folgt (dazu unten),';

export const WAHL_STUECKE = {
	was: VORHER.was,
	vollmachten: ersetzeGenau(VORHER.vollmachten, 'wirken wie ein Nein. ', `wirken wie ein Nein. ${VORSITZ_WAHL} `),
	anfechtung: ersetzeGenau(VORHER.anfechtung, 'als angenommen fest, gilt sie', `als angenommen fest,${ANFECHTUNG_VERWEIS} gilt sie`),
	nur712s: VORHER.nur712s,
	streichen: BEFUGNISSE_STREICHEN,
	ohne: VORHER.ohne,
	kommentar: ersetzeGenau(
		VORHER.kommentar,
		'(Rz. 46 ad Art. 712q); ein Entscheid',
		`(Rz. 46 ad Art. 712q). ${STUETZE_RZ112} Ein Entscheid`
	),
	karteFolgt: KARTE_FOLGT
};

/**
 * `REST` dieser Fassung, in der Reihenfolge der Website (L10; Laienprüfung
 * M5): was gilt und was Sie tun, die Anfechtung, die gesetzlichen Aufgaben mit
 * der Offerte, der Weg ohne Bewirtschaftung, der Lehrstreit. Die Reihenfolge
 * der Felder von `WAHL_STUECKE` ist die des Hinweises.
 */
export const WAHL_REST = Object.values(WAHL_STUECKE).join(' ');

/** Der Hinweis: `REST`, dann die Erweiterung selbst, die auf der Website auch am Schluss steht. */
export const WAHL_HINWEIS = `${WAHL_REST} ${ERWEITERUNG}`;

// ── Die Wartezeit nach der Frist (Fachprüfung M1, N2, N3; Laienprüfung M6) ──

/**
 * Was nach Ablauf der Anfechtungsfrist bis zur Ausführung gilt, mit Grund:
 * Die Frist ist mit dem Gesuch gewahrt (ZPO Art. 62 Abs. 1, 143 Abs. 1),
 * zugestellt wird es mit der Vorladung (Art. 202 Abs. 3), an die Verwaltung
 * (ZGB Art. 712t Abs. 3). Dieselbe Angabe wie unter L13 (`nachAnnahme`), am
 * Grenzfall und unter «einfach» an der Wahl.
 */
const WARTEN_GRUND =
	'Wer am letzten Tag der Frist ein Gesuch einreicht, hat die Frist gewahrt; zugestellt wird es erst später, und ' +
	'das kann einige Wochen dauern.';
export const WARTEN_DANACH =
	'Warten Sie danach, bis bei der Bewirtschaftung keine Mitteilung der Schlichtungsbehörde oder des Gerichts ' +
	`eingegangen ist. ${WARTEN_GRUND}`;
/**
 * Dieselbe Wartezeit an der Wahl einer Bewirtschaftung: Zugestellt wird der
 * bisherigen, solange sie im Amt ist (ZGB Art. 712t Abs. 3; Laienprüfung Runde
 * 2, R2-M2, Fachprüfung Runde 2, R2-N3).
 */
export const WARTEN_DANACH_WAHL =
	'Warten Sie danach, bis keine Mitteilung der Schlichtungsbehörde oder des Gerichts eingegangen ist; zugestellt ' +
	`wird sie der bisherigen Bewirtschaftung, solange diese im Amt ist. ${WARTEN_GRUND}`;

// ── k-grenzfall-nutzung ──────────────────────────────────────────────────────

/** Der dritte Hinweis an `k-grenzfall-nutzung` (Fassung 2026-09-24). */
export const GRENZFALL_VORHER =
	'Beim qualifizierten Mehr zählen nach Köpfen nur die anwesenden und vertretenen Eigentümer, bei den ' +
	'Wertquoten dagegen alle (Art. 712m Rz. 181, 190 f.).';

/**
 * Was die Website seit dem 15.11.2026 sagt (Runde 4, U2; Runde 5, V1), bis auf
 * den Schluss: Die Wartezeit nach Ablauf der Frist ist `WARTEN_DANACH`, nicht
 * «einige Tage nach Ablauf» (Fachprüfung M1).
 */
export const GRENZFALL_WARTEN =
	`Eilt die Sache nicht, führen Sie den Beschluss erst aus, wenn die Frist für alle abgelaufen ist. ${WARTEN_DANACH}`;
export const GRENZFALL =
	'Beim qualifizierten Mehr zählen bei den Wertquoten alle Eigentümer, auch die abwesenden. Bei den Köpfen sagt ' +
	'das Gesetz «Mehrheit aller Miteigentümer». Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt ' +
	'trotzdem nur die anwesenden und vertretenen Eigentümer (Art. 712m Rz. 181, 190 f.). Das Bundesgericht ist ihr ' +
	'für nützliche bauliche Massnahmen gefolgt (BGE 144 III 510 E. 2.2.4), für wichtigere Verwaltungshandlungen ' +
	'hat es nicht entschieden. Ganz sicher ist bei den Köpfen deshalb nur ein Beschluss, dem mehr als die Hälfte ' +
	'aller Eigentümer zustimmt; holen Sie dafür vor der Versammlung Vollmachten ein. Erreicht der Antrag die ' +
	'Wertquoten, bei den Köpfen aber nur die Mehrheit der Anwesenden und Vertretenen, ist er nach der herrschenden ' +
	'Lehre angenommen. Wer nicht zugestimmt hat, kann ihn aber innert eines Monats anfechten. Die Frist läuft für ' +
	'Anwesende und Vertretene ab der Versammlung, für Abwesende, die nicht vertreten waren, in der Regel ab ' +
	'Zustellung des Protokolls. Stellen Sie das Protokoll deshalb rasch und nachweisbar zu, etwa eingeschrieben. ' +
	GRENZFALL_WARTEN;

// ── Sätze an den Karten ──────────────────────────────────────────────────────

const WAEHLEN_ERWEITERT = 'k-bewirtschaftung-waehlen-erweitert';

/**
 * Was an welchen Karten ersetzt wird, mit der Zahl der Stellen in der
 * Vorfassung (Muster der Fassung 2026-11-15). Der Hinweis zur Wahl steht
 * dreimal: unter den Hinweisen, als Schlüssel unter einer Regel und als
 * Schlüssel des Ersatzhinweises unter «einfach»; `REST_EINFACH` einmal, als
 * Ersatz.
 */
export const ERSETZUNGEN: { knoten: string[]; alt: string; neu: string; stellen: number }[] = [
	{
		knoten: [WAEHLEN_ERWEITERT],
		alt: WAHL_HINWEIS_VORHER,
		neu: WAHL_HINWEIS,
		stellen: 3
	},
	{
		// `REST_EINFACH` der Fassung 2026-11-13: die Stütze hinter der Einstellung.
		knoten: [WAEHLEN_ERWEITERT],
		alt: 'genügen lässt (Rz. 46 ad Art. 712q). Wer sicher gehen will',
		neu: `genügen lässt (Rz. 46 ad Art. 712q). ${STUETZE_RZ112_EINFACH} Wer sicher gehen will`,
		stellen: 1
	},
	{
		// `REST_EINFACH` (seit der Fassung 2026-11-14): der Vorsitz nach dem sicheren Weg.
		knoten: [WAEHLEN_ERWEITERT],
		alt: 'noch auf den um die Zählweise der Köpfe an. Wer nicht zugestimmt hat',
		neu: `noch auf den um die Zählweise der Köpfe an. ${VORSITZ_WAHL} Wer nicht zugestimmt hat`,
		stellen: 1
	},
	{
		// `REST_EINFACH`: die Wartezeit nach der Frist wie am Grenzfall (Fachprüfung N2).
		knoten: [WAEHLEN_ERWEITERT],
		alt: 'nachdem auch die Abwesenden das Protokoll erhalten haben.',
		neu: `nachdem auch die Abwesenden das Protokoll erhalten haben. ${WARTEN_DANACH_WAHL}`,
		stellen: 1
	},
	{
		knoten: ['k-grenzfall-nutzung'],
		alt: GRENZFALL_VORHER,
		neu: GRENZFALL,
		stellen: 1
	}
];

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-16, wie er in dieser
 * Fassung lautet: die `ERSETZUNGEN` aller drei Fassungen angewandt (die
 * Fassung 2026-11-16 ersetzt an keiner Karte). Für den Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	return ERSETZUNGEN.reduce((t, e) => t.split(e.alt).join(e.neu), nachDerVorfassung(text));
}

/** Ersetzt genau einmal und bricht ab, wenn der alte Teil nicht genau einmal dasteht. */
function ersetzeGenau(text: string, alt: string, neu: string): string {
	const treffer = text.split(alt).length - 1;
	if (treffer !== 1) {
		throw new Error(`Fassung 2026-11-17: «${alt.slice(0, 50)}…» steht ${treffer}-mal statt einmal.`);
	}
	return text.replace(alt, neu);
}

/** Das Stück von `von` bis und mit `bis`; beide Marken müssen genau einmal stehen. */
function stueckAus(text: string, von: string, bis: string): string {
	for (const marke of [von, bis]) {
		if (text.split(marke).length !== 2) throw new Error(`Fassung 2026-11-17: «${marke}» steht nicht genau einmal.`);
	}
	const anfang = text.indexOf(von);
	const ende = text.indexOf(bis) + bis.length;
	if (ende <= anfang) throw new Error(`Fassung 2026-11-17: «${bis}» steht vor «${von}».`);
	return text.slice(anfang, ende);
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

const KNOTEN: Ergebnisknoten[] = VOR.knoten.map((k) => {
	let neu = k;
	for (const e of ERSETZUNGEN) {
		if (e.knoten.includes(k.id)) neu = ersetzeTief(neu, e.alt, e.neu);
	}
	return neu;
});

// ── «Wortlaut und Rechtsprechung» ───────────────────────────────────────────

/** 4b je Artikel: der sichere Weg, an Art. 647c dazu das Bundesgericht; 4a (Art. 647d) bleibt. */
const JE_ARTIKEL: Record<string, string> = Object.fromEntries(
	Object.entries(VOR.wortlautErklaerungJeArtikel ?? {}).map(([artikel, text]) => {
		if (!SICHER_JE_ARTIKEL[artikel]) return [artikel, text];
		let neu = ersetzeGenau(text, SICHER_VORHER, SICHER_JE_ARTIKEL[artikel]);
		if (artikel === ART_647C) neu = ersetzeGenau(neu, GERICHT_647C_VORHER, GERICHT_647C);
		return [artikel, neu];
	})
);

/** 4c je Artikel: an Art. 647c das Bundesgericht wie in 4b. */
const JE_ARTIKEL_ALLE: Record<string, string> = Object.fromEntries(
	Object.entries(VOR.wortlautErklaerungJeArtikelAlle ?? {}).map(([artikel, text]) => [
		artikel,
		artikel === ART_647C ? ersetzeGenau(text, GERICHT_647C_VORHER, GERICHT_647C) : text
	])
);

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

if (Object.keys(JE_ARTIKEL).length !== 5 || Object.keys(JE_ARTIKEL_ALLE).length !== 4) {
	throw new Error('Fassung 2026-11-17: «Wortlaut und Rechtsprechung» trägt nicht die Artikel der Vorfassung.');
}
for (const artikel of Object.keys(SICHER_JE_ARTIKEL)) {
	if (!VOR.wortlautErklaerungJeArtikel?.[artikel]) {
		throw new Error(`Fassung 2026-11-17: 4b fehlt in der Vorfassung an ${artikel}.`);
	}
}
for (const e of ERSETZUNGEN) {
	const stellen = VOR.knoten
		.filter((k) => e.knoten.includes(k.id))
		.reduce((n, k) => n + JSON.stringify(k).split(JSON.stringify(e.alt).slice(1, -1)).length - 1, 0);
	if (stellen !== e.stellen) {
		throw new Error(
			`Fassung 2026-11-17: «${e.alt.slice(0, 50)}…» steht ${stellen}-mal statt ${e.stellen}-mal in der Vorfassung.`
		);
	}
	const sonst = VOR.knoten
		.filter((k) => !e.knoten.includes(k.id))
		.some((k) => JSON.stringify(k).includes(JSON.stringify(e.alt).slice(1, -1)));
	if (sonst) throw new Error(`Fassung 2026-11-17: «${e.alt.slice(0, 50)}…» steht auch an einer anderen Karte.`);
}
const VORFASSUNG = JSON.stringify(VOR);
for (const neu of [
	SICHER_KOEPFE,
	SICHER_JE_ARTIKEL[ART_647C],
	GERICHT_647C,
	DAZWISCHEN_EINFACH,
	DAZWISCHEN_QUALIFIZIERT,
	WERTQUOTEN,
	STUETZE_RZ112,
	STUETZE_RZ112_EINFACH,
	VORSITZ_WAHL,
	BEFUGNISSE_STREICHEN,
	KARTE_FOLGT,
	WARTEN_DANACH,
	WARTEN_DANACH_WAHL,
	GRENZFALL
]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-17: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_17 = {
	...VOR,
	fassung: '2026-11-17',

	knoten: KNOTEN,

	wortlautErklaerung: ersetzeGenau(VOR.wortlautErklaerung, T4_SICHER_VORHER, T4_SICHER),
	wortlautErklaerungJeArtikel: JE_ARTIKEL,
	wortlautErklaerungJeArtikelAlle: JE_ARTIKEL_ALLE,

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-17 sind Sätze nach den Prüfungen berichtigt; am Ergebnis ändert sich nichts. ' +
		'Berichtigt sind der sichere Weg bei der Zählweise der Köpfe und der Satz zum Bundesgericht bei den ' +
		'notwendigen baulichen Massnahmen. Ergänzt sind der Hinweis zur Wahl einer Bewirtschaftung mit ' +
		'erweiterten Befugnissen und der zum Grenzfall zwischen Benutzungsweise und Zweckbestimmung.'
} satisfies Regelwerk;
