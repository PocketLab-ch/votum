/**
 * Fassung 2026-11-25: die niedrigen Befunde der Website-Prüfung am Abzug 2026-11-22
 * (`quellen/pruefung/berichte/2026-11-18-website-abzug-2026-11-22-laien.md`, L2-3 bis L2-6;
 * Produktentscheid 18.11.2026: «mache noch die niedrigen Befunde») und mit ihnen die zwei
 * Pendenzen an derselben Hilfe von `f2-1-kompetenzen` (Rücknahme vor der Wahl; Kompetenzen nur
 * im laufenden Vertrag, nach der Prüferin mittel).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-24 abgeleitet. Die Fassungen bis
 * 2026-11-24 bleiben unverändert.
 *
 * **Was sich ändert:**
 *
 *  - Die Hilfe zu `f2-1-kompetenzen` sagt, dass ein Vergabebetrag nicht zählt (L2-6), dass Ja
 *    auch gilt, wenn die Kompetenzen nur im laufenden Vertrag der wiedergewählten Bewirtschaftung
 *    stehen (Rz. 69 ad Art. 712s), dass es bei Nein bleibt, wenn die Erweiterung erst nach der
 *    Wahl traktandiert ist (L2-3), und was gilt, wenn die Kompetenzen vor der Wahl zurückgenommen
 *    werden.
 *  - An `k-bewirtschaftung-waehlen` ein Hinweis, was «qualifiziertes Mehr» heisst (L2-5), als
 *    eigener Hinweis am Schluss, in Anwendung und Website gleich.
 *  - An den drei Karten zur Bezahlung aus dem Fonds: «kann … nicht mehr widerrufen» statt «kommt
 *    … nicht mehr zurück», mit dem Gericht daneben, und ein Beispiel für den Ersatzweg im Antrag
 *    über die Arbeit (L2-4).
 *  - Für den Website-Abzug: der Fallteil an der Wahl mit erweiterten Kompetenzen nennt die
 *    Wiederwahl (L2-3, `VOR_K`).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_24, nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-24';
import { VOR_K as VOR_K_VORHER, NACH_K as NACH_K_VORHER, type Absatz } from './quorum-2026-11-23';
import { WAEHLEN_ERWEITERT_ID } from './quorum-2026-11-21';
import { ENTNAHME_ID, VEREINBART_ID, AUSSERHALB_ID } from './quorum-2026-11-20';

const VOR = REGELWERK_2026_11_24;

export const KOMPETENZEN_FRAGE = 'f2-1-kompetenzen';
export const WAEHLEN_ID = 'k-bewirtschaftung-waehlen';

// ── Die Ersetzungen im Wortlaut, mit der Zahl der Stellen ─────────────────────

/** Hilfe zu `f2-1-kompetenzen`, nach dem Satz zu den gesetzlichen Aufgaben (Laien L2-6). */
export const VERGABE_VORHER =
	'Was das Gesetz jeder Bewirtschaftung gibt, zählt nicht, etwa Beschlüsse ausführen, Beiträge einziehen oder ' +
	'Dringliches veranlassen.';
export const VERGABE =
	// Runde 2, Fach F5-3: «Reparaturen», weil der Hauswart oben als zählende Kompetenz steht; nur Rz. 115.
	// Runde 3, Laien L4-1: im selben Satz, damit er im sichtbaren Anfang bleibt (`teileHilfe` teilt ab 450 Zeichen).
	// Runde 4 (Codeprüfung, Satzlänge): ohne «Beschlüsse ausführen», damit der Satz unter 180 Zeichen bleibt.
	'Was das Gesetz jeder Bewirtschaftung gibt, zählt nicht, etwa Beiträge einziehen oder Dringliches veranlassen; ' +
	'ebenso wenig ein Betrag, bis zu dem sie Reparaturen selbst vergibt. Grössere Arbeiten sind ' +
	'bauliche Massnahmen, und die lassen sich nicht übertragen (SVIT-Kommentar Rz. 115 ad Art. 712m).';

/** Hilfe zu `f2-1-kompetenzen`, im sichtbaren Anfang (Runde 2, Laien L3-1: der laufende Vertrag). */
export const ERSTER_SATZ_VORHER = 'ohne die Versammlung im Einzelfall zu fragen.';
export const ERSTER_SATZ =
	ERSTER_SATZ_VORHER +
	' Wählen Sie die bisherige Bewirtschaftung wieder, zählt auch ihr laufender Vertrag (SVIT-Kommentar Rz. 69 ad ' +
	'Art. 712s).';

/** Hilfe zu `f2-1-kompetenzen`, nach «Ja heisst» (Pendenz «nur im laufenden Vertrag»; Rücknahme). */
export const JA_HEISST_VORHER =
	'Ja heisst: Es steht im Reglement oder in einem früheren Beschluss, oder die Versammlung beschliesst die ' +
	'Erweiterung vorher in einem eigenen Traktandum.';
export const JA_HEISST =
	JA_HEISST_VORHER +
	' Nimmt die Versammlung sie vorher in einem eigenen Traktandum zurück und gibt auch kein Vertrag sie, gilt für die ' +
	// Runde 2, Laien L3-2: der Schritt vor der Versammlung.
	'Wahl Nein; wird die Rücknahme abgelehnt, bleibt es bei Ja. Holen Sie für diesen Fall vor der Versammlung ' +
	'Vollmachten ein.';

/**
 * Hilfe zu `f2-1-kompetenzen`, nach dem Satz, der das eigene Traktandum zur Erweiterung nennt
 * (Laien L2-3: Reihenfolge). Steht es vor der Wahl, gilt schon nach «Ja heisst» Ja.
 */
export const NEIN_HEISST_VORHER =
	'welches gilt, zeigt unter «Worum geht es genau?» die Antwort «Bewirtschaftung mit Kompetenzen über die ' +
	'gewöhnliche Verwaltung hinaus ausstatten».';
export const NEIN_HEISST =
	NEIN_HEISST_VORHER +
	' Steht dieses Traktandum erst nach der Wahl, bleibt es für die Wahl bei Nein. ' +
	// Runde 2, Fach F5-4: Die Wahl ist schon das Angebot zum Vertrag (Rz. 123 ad Art. 712q).
	'Wählen Sie dann ausdrücklich ohne diese Kompetenzen; stehen sie in der Offerte, nehmen Sie sie im Antrag zur Wahl ' +
	'aus (SVIT-Kommentar Rz. 123 ad Art. 712q).';

/** Die Antwort Ja der Frage (Runde 2, Fach F5-5, Laien L3-1). */
export const ANTWORT_JA_VORHER = 'Ja, nach Reglement, früherem Beschluss oder einem Traktandum davor';
export const ANTWORT_JA = 'Ja, nach Reglement, früherem Beschluss, laufendem Vertrag oder einem Traktandum davor';

/** Fondskarten, `hinweise` zur Arbeit (Laien L2-4): «widerrufen» und das Gericht daneben. */
export const ZURUECK_VORHER =
	'Ist mit der Arbeit begonnen, kommt die Versammlung nach dem SVIT-Kommentar auf die Bezahlung aus dem Fonds nicht ' +
	'mehr zurück, auch wenn die Arbeit stoppt (Rz. 139a ad Art. 712l).';
export const ZURUECK =
	'Ist mit der Arbeit begonnen, kann die Versammlung die Bezahlung aus dem Fonds nach dem SVIT-Kommentar nicht mehr ' +
	'widerrufen, auch wenn die Arbeit stoppt (Rz. 139a ad Art. 712l). Auf eine Anfechtung hin kann ein Gericht sie ' +
	'trotzdem aufheben.';

/** Fondskarten, Satz zum Antrag über die Arbeit (Laien L2-4): ein Beispiel für den Ersatzweg. */
export const ERSATZWEG_VORHER =
	'Sagen Sie in deren Antrag, wie sie bezahlt wird, wenn die Bezahlung aus dem Fonds nicht zustande kommt oder ' +
	'angefochten ist.';
/**
 * Runde 2, Fach F5-2 und Laien L3-5: zwei Fassungen. An der Entnahme mit Mehr zahlt der Fonds bei
 * einer Anfechtung vorläufig; an den Karten mit Zustimmung aller zahlte er sonst gegen den nicht
 * Zustimmenden mit (ZGB Art. 647e Abs. 2). Je mit Verteiler und Rückzahlung.
 */
export const ERSATZWEG_ENTNAHME =
	ERSATZWEG_VORHER +
	' Etwa: Bei einer Anfechtung zahlt die Bewirtschaftung fällige Rechnungen nach dem Beschluss über die Bezahlung ' +
	'trotzdem aus dem Fonds. Fällt diese Bezahlung weg, folgt ein Sonderbeitrag nach dem Verteiler der Arbeit; er ' +
	'zahlt auch zurück in den Fonds, was vorläufig daraus bezahlt wurde.';
export const ERSATZWEG_ALLE =
	ERSATZWEG_VORHER +
	// Runde 3, Fach F6-2 und Laien L4-2: wann die Bezahlung feststeht (ZGB Art. 75: wer zugestimmt hat, ficht nicht an).
	' Etwa: Bis die Bezahlung aus dem Fonds feststeht, über einen Sonderbeitrag nach dem Verteiler der Arbeit; danach ' +
	'wird er aus dem Fonds zurückerstattet. ' +
	// Runde 4, Fach F7-1: einzeln nachgeholte Zustimmungen genügen nicht (Rz. 197 ad Art. 712m).
	// Runde 5, Fach F8-1: getrennte, gleichlautende Blätter sind zulässig (Rz. 128 ad Art. 712m); alle unterschreiben.
	'Fest steht sie, wenn alle Eigentümer zugestimmt haben, an der Versammlung also nur, wenn alle da oder vertreten ' +
	'sind; Zustimmungen nur der Abwesenden danach genügen nicht. Beim schriftlichen Beschluss unterschreiben alle ' +
	'denselben Antrag, auch wer an der Versammlung schon zugestimmt hat; fest steht sie dann mit der letzten ' +
	'Unterschrift. Wird sie trotzdem angefochten, steht sie erst fest, wenn das Verfahren ohne Aufhebung endet.';

/**
 * An der Karte mit erweiterten Kompetenzen (Runde 3, Laien L4-3): die Offerte, nicht der laufende
 * Vertrag. In der Anwendung im längeren Wortlaut (`BEFUGNISSE_STREICHEN` der Fassung 2026-11-17), auf der
 * Website der eigene Wortlaut im Export (`OFFERTE_WEBSITE`).
 */
export const OFFERTE_VORHER =
	'Stehen die weitergehenden Befugnisse nur in der Offerte, also im Entwurf des Verwaltungsvertrags, und nicht im ' +
	'Reglement, können Sie sie vor der Wahl streichen lassen. Dann genügt für die Wahl das einfache Mehr ' +
	'(SVIT-Kommentar Rz. 44 ad Art. 712m).';
// Runde 4 (Codeprüfung, Satzlänge): geteilt, der laufende Vertrag als eigener Fall.
export const OFFERTE =
	'Stehen die weitergehenden Befugnisse nur in der Offerte, also im Entwurf des Verwaltungsvertrags, können Sie sie ' +
	'vor der Wahl streichen lassen. Dann genügt für die Wahl das einfache Mehr (SVIT-Kommentar Rz. 44 ad Art. 712m). ' +
	'Das gilt nicht, wenn sie auch im Reglement oder in einem früheren Beschluss stehen. ' +
	'Stehen sie im laufenden Vertrag der Bewirtschaftung, die Sie wiederwählen, genügt das Streichen aus der Offerte ' +
	'ebenso wenig; den Weg zeigt der Hinweis zur Rücknahme vor der Wahl.';
export const OFFERTE_WEBSITE =
	'Stehen die weitergehenden Befugnisse nur in der Offerte, können Sie sie vor der Wahl streichen lassen. Dann genügt ' +
	'für die Wahl das einfache Mehr (SVIT-Kommentar Rz. 44 ad Art. 712m). ' +
	'Das gilt nicht, wenn sie auch im Reglement oder in einem früheren Beschluss stehen. ' +
	'Stehen sie im laufenden Vertrag der Bewirtschaftung, die Sie wiederwählen, genügt das Streichen aus der Offerte ' +
	'ebenso wenig; den Weg zeigt der Hinweis zur Rücknahme vor der Wahl.';

/** Je Ersetzung: alt, neu, wie oft sie im Regelwerk der Vorfassung steht. */
export const ERSETZUNGEN: readonly (readonly [string, string, number])[] = [
	[VERGABE_VORHER, VERGABE, 1],
	[JA_HEISST_VORHER, JA_HEISST, 1],
	[NEIN_HEISST_VORHER, NEIN_HEISST, 1],
	[ZURUECK_VORHER, ZURUECK, 3],
	[ERSTER_SATZ_VORHER, ERSTER_SATZ, 1],
	[OFFERTE_VORHER, OFFERTE, 3],
	[ANTWORT_JA_VORHER, ANTWORT_JA, 1]
];

/** Der Ersatzweg je Karte; nicht über `nachDieserFassung`, weil derselbe alte Satz an drei Karten verschieden weitergeht. */
export const ERSATZWEG_JE_KARTE: Readonly<Record<string, string>> = {
	[ENTNAHME_ID]: ERSATZWEG_ENTNAHME,
	[VEREINBART_ID]: ERSATZWEG_ALLE,
	[AUSSERHALB_ID]: ERSATZWEG_ALLE
};

/** Neuer Hinweis am Schluss von `k-bewirtschaftung-waehlen` (Laien L2-5). */
export const QUALIFIZIERT_ERKLAERT =
	// Runde 2, Fach F5-1 und Laien L3-3: die Zählweise der Köpfe nach herrschender Lehre, mit dem sicheren Weg.
	'Qualifiziertes Mehr, wie es der erste Hinweis nennt, heisst: die Mehrheit der Köpfe und zugleich mehr als die ' +
	'Hälfte aller Wertquoten (ZGB Art. 647b Abs. 1; Art. 712g Abs. 3). Bei den Köpfen zählen nach herrschender Lehre ' +
	'nur die Anwesenden und Vertretenen (SVIT-Kommentar Rz. 168 und 190 f. ad Art. 712m). Weil das umstritten ist, ist ' +
	'nur ein Beschluss ganz sicher, dem mehr als die Hälfte aller Eigentümer zustimmt.';

/** Ersetzt in jedem Text des Regelwerks und zählt, wie oft (wie in der Fassung 2026-11-22). */
function ersetzeUeberall<T>(wert: T, alt: string, neu: string, zaehler: { n: number }): T {
	if (typeof wert === 'string') {
		const teile = wert.split(alt);
		zaehler.n += teile.length - 1;
		return teile.join(neu) as T;
	}
	if (Array.isArray(wert)) return wert.map((w) => ersetzeUeberall(w, alt, neu, zaehler)) as T;
	if (wert && typeof wert === 'object') {
		return Object.fromEntries(
			Object.entries(wert).map(([k, w]) => [k, ersetzeUeberall(w, alt, neu, zaehler)])
		) as T;
	}
	return wert;
}

// ── Die Proben gegen die Vorfassung ──────────────────────────────────────────

let ersetzt: Regelwerk = VOR;
for (const [alt, neu, erwartet] of ERSETZUNGEN) {
	const z = { n: 0 };
	ersetzt = ersetzeUeberall(ersetzt, alt, neu, z);
	if (z.n !== erwartet) {
		throw new Error(`Fassung 2026-11-25: «${alt.slice(0, 50)}…» steht ${z.n}-mal statt ${erwartet}-mal.`);
	}
}
const ERSETZT = ersetzt as typeof VOR;
if (!ERSETZT.fragen.find((f) => f.id === KOMPETENZEN_FRAGE)?.hilfe?.includes(JA_HEISST)) {
	throw new Error(`Fassung 2026-11-25: Die Hilfe zu «${KOMPETENZEN_FRAGE}» trägt den neuen Satz zu Ja nicht.`);
}
if (!ERSETZT.knoten.some((k) => k.id === WAEHLEN_ID)) throw new Error(`Fassung 2026-11-25: «${WAEHLEN_ID}» fehlt.`);

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-24, wie er in dieser Fassung lautet:
 * die Ersetzungen der Vorfassungen und die dieser Fassung. Für den Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	let t = nachDerVorfassung(text);
	for (const [alt, neu] of ERSETZUNGEN) t = t.split(alt).join(neu);
	return t;
}

/**
 * **Nur für den Website-Abzug:** der Fallteil, an der Wahl mit erweiterten Kompetenzen mit der
 * Wiederwahl (Laien L2-3); sonst wie in der Fassung 2026-11-23. `NACH_K` bleibt.
 */
export const WIEDERWAHL_VORHER = 'Bei einer Wahl heisst ausführen: den Vertrag mit der Gewählten schliessen und sie antreten lassen.';
export const WIEDERWAHL =
	// Runde 2, Fach F5-4: Der neue Vertrag kann mit der Wahl schon angenommen sein; der bisherige gilt nur, solange er läuft.
	WIEDERWAHL_VORHER +
	' Bei einer Wiederwahl heisst es: den neuen Vertrag beginnen lassen. Nennen Sie im Antrag, ab wann er gilt; bis ' +
	'dahin gilt der bisherige, solange er läuft.';

function mitWiederwahl(absaetze: readonly Absatz[]): Absatz[] {
	return absaetze.map((a) => {
		if (a.text.split(WIEDERWAHL_VORHER).length !== 2) return a;
		return { ...a, text: a.text.replace(WIEDERWAHL_VORHER, WIEDERWAHL) };
	});
}
export const VOR_K: Readonly<Record<string, readonly Absatz[]>> = Object.fromEntries(
	Object.entries(VOR_K_VORHER).map(([id, absaetze]) => [id, id === WAEHLEN_ERWEITERT_ID ? mitWiederwahl(absaetze) : absaetze])
);
if (!VOR_K[WAEHLEN_ERWEITERT_ID].some((a) => a.text.includes(WIEDERWAHL))) {
	throw new Error('Fassung 2026-11-25: Der Fallteil an der Wahl nennt die Wiederwahl nicht.');
}
/**
 * **Nur für den Website-Abzug:** nach K am Fonds zuerst, was der Antrag über die Arbeit für den Fall
 * vorsieht (Runde 2, Laien L3-4: das Beispiel legt den Ersatzweg schon fest). Sonst wie 2026-11-23.
 */
export const AUFGEHOBEN_VORHER =
	'Wird die Bezahlung später aufgehoben, muss die Versammlung neu beschliessen, wie die Arbeit bezahlt wird, bei einem ' +
	'einzigen Antrag auch über die Arbeit selbst.';
// Runde 3, Fach F6-1: Beim einzigen Antrag fällt die Klausel mit ihm (Rz. 234 ad Art. 712m).
export const AUFGEHOBEN =
	'Wird die Bezahlung später aufgehoben, gilt, was der Antrag über die Arbeit für diesen Fall vorsieht. Sieht er nichts ' +
	'vor oder standen Arbeit und Bezahlung in einem einzigen Antrag, muss die Versammlung neu beschliessen, wie die Arbeit ' +
	'bezahlt wird. Beim einzigen Antrag fällt mit ihm auch, was er für diesen Fall vorsah, und die Versammlung beschliesst ' +
	'auch über die Arbeit selbst neu.';
export const NACH_K: Readonly<Record<string, Absatz>> = Object.fromEntries(
	Object.entries(NACH_K_VORHER).map(([id, a]) => [
		id,
		id === ENTNAHME_ID ? { ...a, text: a.text.replace(AUFGEHOBEN_VORHER, AUFGEHOBEN) } : a
	])
);
if (!NACH_K[ENTNAHME_ID].text.includes(AUFGEHOBEN)) throw new Error('Fassung 2026-11-25: Der Teil nach K am Fonds nennt den Antrag nicht.');

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_25 = {
	...ERSETZT,
	fassung: '2026-11-25',
	knoten: ERSETZT.knoten.map((k) => {
		if (k.id === WAEHLEN_ID) return { ...k, hinweise: [...(k.hinweise ?? []), QUALIFIZIERT_ERKLAERT] };
		const ersatz = ERSATZWEG_JE_KARTE[k.id];
		return ersatz ? { ...k, hinweise: (k.hinweise ?? []).map((h) => h.replace(ERSATZWEG_VORHER, ersatz)) } : k;
	}),

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-25 erklärt die Hilfe zur Frage nach den Kompetenzen der Bewirtschaftung den ' +
		'laufenden Vertrag, den Vergabebetrag und die Rücknahme vor der Wahl, die Wahlkarte erklärt das qualifizierte ' +
		'Mehr, und die Karten zur Bezahlung aus dem Fonds nennen ein Beispiel für den Ersatzweg.'
} satisfies Regelwerk;
