/**
 * Fassung 2026-11-15: Sätze nach Entscheid 0047 und dem Abgleich der
 * Rechtskarten mit Block C (Auftrag `.auftraege/2026-11-13-votum-texte-nach-0047.md`,
 * Punkte 7, 8, 10, 11 und 12; Prüfvorlage `quellen`,
 * `pruefung/zu-pruefen-2026-11-14-votum-texte-nach-0047.md`).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-14 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht so oft steht wie erwartet oder
 * der neue schon dasteht. Die Fassung 2026-11-14 bleibt unverändert; ihre
 * Traktanden behalten ihre Sätze.
 *
 * **Was sich ändert:**
 *
 *  - `k-prozessfuehrung`, Hinweis zum Prozess gegen einen Eigentümer
 *    (`GEGEN_EIGENTUEMER` der Fassung 2026-11-10): Die Angehörigen nehmen
 *    sicherheitshalber auch an der Beratung nicht teil, wie auf der Website
 *    (Entscheid 0047, 4; Prüfvorlage, Punkt 7).
 *  - `k-bewirtschaftung-erweitert` und `k-verwaltung-wichtig`, Rechtssatz: Die
 *    Bedingung «alle Eigentümer oder Begründungsakt» trägt Art. 712g Abs. 2
 *    mit Rz. 78 und 78a, nicht Rz. 84 (Fachprüfung E2, F-12; Punkt 8).
 *  - `k-ausschlussklage`, Hinweis zum Reglement: Ob eine Klausel mit zu wenig
 *    Stimmen trotzdem gilt, ist nicht geklärt (Punkt 10, Featureprüfung M1).
 *  - «Wortlaut und Rechtsprechung» (4a, 4b, 4c) und die allgemeine Erklärung
 *    zum Wortlaut: der Beleg für die Zählweise im Reglement (Rz. 186 ad
 *    Art. 712m und BGE 144 III 510 E. 2.2.4 statt BGE 143 III 537 E. 4.2.3;
 *    Punkt 11), die zweite Gegenmeinung an Art. 647d und die Enthaltungen nach
 *    herrschender Lehre (Punkt 12).
 *
 * **Kein Ergebnis ändert sich**, kein Erfordernis, keine Frage
 * (`tests/domain/fassung-2026-11-15.test.ts`).
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import {
	ENTHALTUNG_SATZ as ENTHALTUNG_SATZ_VORHER,
	REGELWERK_2026_11_14,
	REGLEMENT_SATZ as REGLEMENT_SATZ_VORHER,
	nachDieserFassung as nachDerVorfassung
} from './quorum-2026-11-14';
import { UEBERGANG_OHNE_ZUSTIMMUNG } from './quorum-2026-11-04';

// ── Punkt 11: der Beleg der Zählweise im Reglement ───────────────────────────

/** Der Beleg der Fassung 2026-11-14, in `REGLEMENT_SATZ`, in 4c und in der allgemeinen Erklärung. */
export const BELEG_REGLEMENT_VORHER =
	'(ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; BGE 143 III 537 E. 4.2.3) und eine klare Formulierung.';

/**
 * Der neue Beleg: Die Einstimmigkeit für eine andere Bezugsgrösse trägt
 * Rz. 186 ad Art. 712m, die klare Formulierung BGE 144 III 510 E. 2.2.4
 * (S. 513). BGE 143 III 537 E. 4.2.3 nennt als Fall nur den Wechsel von Köpfen
 * zu Anteilen.
 */
export const BELEG_REGLEMENT =
	'(ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 186 ad Art. 712m) und eine klare ' +
	'Formulierung (BGE 144 III 510 E. 2.2.4).';

/** «[Reglement]» in dieser Fassung. */
export const REGLEMENT_SATZ = ersetzeGenau(REGLEMENT_SATZ_VORHER, BELEG_REGLEMENT_VORHER, BELEG_REGLEMENT);

// ── Punkt 12: Gegenmeinungen und Enthaltungen ────────────────────────────────

/** Die Gegenmeinung an Art. 647d (4a) in der Fassung 2026-11-14. */
export const GEGENMEINUNG_647D_VORHER =
	'Einzelne Autoren zählen alle Eigentümer; das Bundesgericht ist ihnen nicht gefolgt.';

/**
 * Beide Gegenmeinungen aus BGE 144 III 510 E. 2.2.4 (Ch. Müller, K. Müller: nur
 * die Abstimmenden); das Urteil nennt Enthaltungen nicht (Laienprüfung Runde 1, L-13).
 */
export const GEGENMEINUNG_647D =
	'Einzelne Autoren zählen alle Eigentümer, andere nur die Abstimmenden; das Bundesgericht ist beiden ' +
	'nicht gefolgt, Enthaltungen nennt es dabei nicht.';

/**
 * Der Satz zu den Enthaltungen in 4a und 4b: als herrschende Lehre, nicht als
 * gesicherte Rechtslage (Rz. 181 ad Art. 712m: «nicht unumstritten»), und was
 * Votum rechnet. Unter der Enthaltungsklausel entfällt er
 * (`ENTHALTUNG_IM_WORTLAUT` in `domain/reglement.ts`).
 */
export const ENTHALTUNG_SATZ =
	'Enthaltungen zählen nach herrschender Lehre mit und wirken wie ein Nein; so rechnet Votum.';

/**
 * Derselbe Satz auf der Website, die Votum nicht nennt (`check:abzug`); der
 * Export nimmt 4b über `wortlautAnwesendeWebsite` (unten), nicht über
 * `UMFORMULIERUNGEN`.
 */
export const ENTHALTUNG_SATZ_WEBSITE = 'Enthaltungen zählen nach herrschender Lehre mit und wirken wie ein Nein.';

/**
 * Derselbe Satz in 4a (Art. 647d), mit der Erklärung der herrschenden Lehre: In
 * 4a steht sie, anders als in 4b, nicht schon davor (Laienprüfung Runde 1, L-13).
 */
export const ENTHALTUNG_SATZ_647D =
	'Enthaltungen zählen nach herrschender Lehre, der Auffassung der meisten Fachleute, mit und wirken wie ein ' +
	'Nein; so rechnet Votum.';

// ── Punkt 7: der Prozess gegen einen Eigentümer ──────────────────────────────

/** Der Schluss von `GEGEN_EIGENTUEMER` der Fassung 2026-11-10. */
export const ANGEHOERIGE_BERATUNG_VORHER = 'Seine Angehörigen stimmen nur nicht mit.';

/**
 * Der neue Schluss, wie auf der Website (Entscheid 0047, 4; Fachprüfung E4,
 * R2-F-3): Ob die Angehörigen mitberaten, hat kein Gericht entschieden.
 */
export const ANGEHOERIGE_BERATUNG =
	'Seine Angehörigen stimmen nicht mit. Ob sie an der Beratung teilnehmen dürfen, hat kein Gericht ' +
	'entschieden; sicher ist, sie wie ihn vorher anzuhören und an der Beratung danach nicht teilnehmen zu ' +
	'lassen.';

/**
 * Die Vollmachten an ihn oder seine Angehörigen, im geprüften Wortlaut der
 * Website (Laienprüfung Runde 1, L-7), ohne Rz. 150 ad Art. 712m (Fachprüfung
 * Runde 2, R2-F-2).
 */
export const VOLLMACHT_AN_IHN =
	'Wer ihm oder einem seiner Angehörigen eine Vollmacht gegeben hat, zählt bei dieser Abstimmung wie ein ' +
	'Abwesender (BGE 134 III 481 E. 3.8). Klären Sie das möglichst schon mit der Einladung, damit die Vollmacht ' +
	'einer anderen Person gegeben werden kann.';

// ── Punkt 8: der Beleg der Bedingung «alle Eigentümer oder Begründungsakt» ───

/** Der neue Beleg an beiden Karten, wie in Katalog L11, `geltung`. */
export const BELEG_712G = '(ZGB Art. 712g Abs. 2; SVIT-Kommentar Rz. 78 und 78a ad Art. 712g)';

// ── Punkt 10 an der Ausschlussklage (Featureprüfung, M1) ─────────────────────

/**
 * Der Satz zur Klausel mit zu wenig Stimmen im Hinweis zum Reglement an
 * `k-ausschlussklage` (aus der Fassung 2026-10-08, über `AUSSCHLUSS_REGLEMENTSHINWEIS`
 * der Fassung 2026-11-04 vererbt): «in der Regel» wie an den Stellen von Punkt 10,
 * mit dem Übergang `UEBERGANG_OHNE_ZUSTIMMUNG` dahinter, der mit ersetzt wird.
 */
export const KLAUSEL_AUSSCHLUSS_VORHER =
	'(Art. 712m Rz. 186); kam sie ohne Einstimmigkeit ins Reglement und wurde nicht rechtzeitig angefochten, ' +
	`fällt sie deswegen in der Regel nicht weg (BGE 143 III 537 E. 4.2.4). ${UEBERGANG_OHNE_ZUSTIMMUNG}`;

/**
 * Derselbe Gedanke wie Punkt 10c: nicht geklärt, BGE 143 III 537 E. 4.2.4
 * spricht dafür. Wortlaut der Fachprüfung zu Nachtrag 2: Der Inhalt des Urteils
 * steht im Satz, der Übergang «Ob das auch …» fällt weg.
 */
export const KLAUSEL_AUSSCHLUSS =
	'(Art. 712m Rz. 186). Ob sie trotzdem gilt, wenn sie ohne Einstimmigkeit ins Reglement kam und nicht ' +
	'rechtzeitig angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4: Dort hielt das ' +
	'Bundesgericht einen Wechsel von Köpfen zu Anteilen, der ohne Einstimmigkeit beschlossen worden war, nur für ' +
	'anfechtbar. Für eine Bestimmung zu diesem Mehr hat kein Gericht entschieden.';

// ── Sätze an den Karten ──────────────────────────────────────────────────────

/**
 * Was an welchen Karten ersetzt wird, mit der Zahl der Stellen in der
 * Vorfassung (Muster der Fassung 2026-11-14).
 */
export const ERSETZUNGEN: { knoten: string[]; alt: string; neu: string; stellen: number }[] = [
	{
		knoten: ['k-prozessfuehrung'],
		alt: ANGEHOERIGE_BERATUNG_VORHER,
		neu: `${ANGEHOERIGE_BERATUNG} ${VOLLMACHT_AN_IHN}`,
		stellen: 1
	},
	{
		// Hinweis zum Reglement an der Ausschlussklage: im Hinweis, unter einer Regel und im Ersatz.
		knoten: ['k-ausschlussklage'],
		alt: KLAUSEL_AUSSCHLUSS_VORHER,
		neu: KLAUSEL_AUSSCHLUSS,
		stellen: 3
	},
	{
		// `RECHT_ERWEITERT` der Fassung 2026-10-30.
		knoten: ['k-bewirtschaftung-erweitert'],
		alt: 'errichtet wurde (SVIT-Kommentar Rz. 78, 78a und 84 ad Art. 712g).',
		neu: `errichtet wurde ${BELEG_712G}.`,
		stellen: 1
	},
	{
		// `BEDINGUNG_WICHTIG` der Fassung 2026-10-30.
		knoten: ['k-verwaltung-wichtig'],
		alt: 'im Begründungsakt steht (Rz. 78, 78a und 84 ad Art. 712g).',
		neu: `im Begründungsakt steht ${BELEG_712G}.`,
		stellen: 1
	}
];

/**
 * Ein Wortlaut der Fassung 2026-11-13 oder 2026-11-14, wie er in dieser
 * Fassung lautet: die `ERSETZUNGEN` beider Fassungen angewandt. Für den
 * Website-Abzug, dessen Umformulierungen am Wortlaut der Fassung hängen.
 */
export function nachDieserFassung(text: string): string {
	return ERSETZUNGEN.reduce((t, e) => t.split(e.alt).join(e.neu), nachDerVorfassung(text));
}

/** Ersetzt genau einmal und bricht ab, wenn der alte Teil nicht genau einmal dasteht. */
function ersetzeGenau(text: string, alt: string, neu: string): string {
	const treffer = text.split(alt).length - 1;
	if (treffer !== 1) {
		throw new Error(`Fassung 2026-11-15: «${alt.slice(0, 50)}…» steht ${treffer}-mal statt einmal.`);
	}
	return text.replace(alt, neu);
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

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_11_14.knoten.map((k) => {
	let neu = k;
	for (const e of ERSETZUNGEN) {
		if (e.knoten.includes(k.id)) neu = ersetzeTief(neu, e.alt, e.neu);
	}
	return neu;
});

// ── «Wortlaut und Rechtsprechung» ───────────────────────────────────────────

const VOR = REGELWERK_2026_11_14;
const ART_647D = 'ZGB Art. 647d Abs. 1';

/** 4b je Artikel (und 4a an Art. 647d): Enthaltungen und Beleg, an Art. 647d dazu die Gegenmeinung. */
const JE_ARTIKEL: Record<string, string> = Object.fromEntries(
	Object.entries(VOR.wortlautErklaerungJeArtikel ?? {}).map(([artikel, text]) => {
		const enthaltung = artikel === ART_647D ? ENTHALTUNG_SATZ_647D : ENTHALTUNG_SATZ;
		let neu = ersetzeGenau(text, `${ENTHALTUNG_SATZ_VORHER} ${REGLEMENT_SATZ_VORHER}`, `${enthaltung} ${REGLEMENT_SATZ}`);
		if (artikel === ART_647D) neu = ersetzeGenau(neu, GEGENMEINUNG_647D_VORHER, GEGENMEINUNG_647D);
		return [artikel, neu];
	})
);

/** 4c je Artikel: nur der Beleg. */
const JE_ARTIKEL_ALLE: Record<string, string> = Object.fromEntries(
	Object.entries(VOR.wortlautErklaerungJeArtikelAlle ?? {}).map(([artikel, text]) => [
		artikel,
		ersetzeGenau(text, BELEG_REGLEMENT_VORHER, BELEG_REGLEMENT)
	])
);

/** 4b an einem Artikel, wie ihn die Website zeigt: ohne «so rechnet Votum». */
export function wortlautAnwesendeWebsite(artikel: string): string {
	return ersetzeGenau(JE_ARTIKEL[artikel], ENTHALTUNG_SATZ, ENTHALTUNG_SATZ_WEBSITE);
}

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

if (Object.keys(JE_ARTIKEL).length !== 5 || !JE_ARTIKEL[ART_647D]) {
	throw new Error('Fassung 2026-11-15: «Wortlaut und Rechtsprechung» trägt nicht die fünf Artikel der Vorfassung.');
}
if (Object.keys(JE_ARTIKEL_ALLE).length !== 4) {
	throw new Error('Fassung 2026-11-15: 4c trägt nicht die vier Artikel der Vorfassung.');
}
for (const e of ERSETZUNGEN) {
	const stellen = VOR.knoten
		.filter((k) => e.knoten.includes(k.id))
		.reduce((n, k) => n + JSON.stringify(k).split(JSON.stringify(e.alt).slice(1, -1)).length - 1, 0);
	if (stellen !== e.stellen) {
		throw new Error(
			`Fassung 2026-11-15: «${e.alt.slice(0, 50)}…» steht ${stellen}-mal statt ${e.stellen}-mal in der Vorfassung.`
		);
	}
	const sonst = VOR.knoten
		.filter((k) => !e.knoten.includes(k.id))
		.some((k) => JSON.stringify(k).includes(JSON.stringify(e.alt).slice(1, -1)));
	if (sonst) throw new Error(`Fassung 2026-11-15: «${e.alt.slice(0, 50)}…» steht auch an einer anderen Karte.`);
}
const VORFASSUNG = JSON.stringify(VOR);
for (const neu of [KLAUSEL_AUSSCHLUSS, BELEG_REGLEMENT, GEGENMEINUNG_647D, ENTHALTUNG_SATZ, ENTHALTUNG_SATZ_647D, ANGEHOERIGE_BERATUNG, VOLLMACHT_AN_IHN, BELEG_712G]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-15: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_15 = {
	...VOR,
	fassung: '2026-11-15',

	knoten: KNOTEN,

	wortlautErklaerung: ersetzeGenau(VOR.wortlautErklaerung, BELEG_REGLEMENT_VORHER, BELEG_REGLEMENT),
	wortlautErklaerungJeArtikel: JE_ARTIKEL,
	wortlautErklaerungJeArtikelAlle: JE_ARTIKEL_ALLE,

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-15 sind Sätze nach den Prüfungen berichtigt; am Ergebnis ändert sich ' +
		'nichts. Berichtigt sind die Belege zur Zählweise im Reglement und zur Bedingung «alle Eigentümer ' +
		'oder Begründungsakt» sowie die Sätze zu den Enthaltungen und den Gegenmeinungen. Ebenso berichtigt ' +
		'sind die Beratung der Angehörigen im Prozess gegen einen Eigentümer und der Hinweis zum Reglement ' +
		'an der Ausschlussklage.'
} satisfies Regelwerk;
