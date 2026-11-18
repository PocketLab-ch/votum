/**
 * Fassung 2026-11-23: die Befunde der Website-Prüfung am Abzug 2026-11-22 (Meldung
 * `.auftraege/2026-11-18-meldung-votum-befunde-abzug-2026-11-22.md`; Berichte
 * `quellen/pruefung/berichte/2026-11-18-website-abzug-2026-11-22-{laien,fach}.md`).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-22 abgeleitet. Die Fassungen bis
 * 2026-11-22 bleiben unverändert.
 *
 * **Was sich ändert:** In der Anwendung kein Satz. Die Fassung gibt dem Website-Abzug eine
 * eigene Kennung, denn sein Wortlaut ändert sich, und «Abzug 2026-11-22» ist auf der
 * Website mit seiner Prüfsumme geprüft und ausgerollt.
 *
 *  - An den drei Karten, deren Kasten «Wortlaut und Rechtsprechung» sagt, was dort trotz
 *    einem Gesuch nicht warten darf, steht der Fallteil jetzt **vor** dem Kernsatz K, als
 *    eigener Absatz mit fettem Anfang (Laien L2-1, Fach F2-2): `VOR_K`. Was erst bei einem
 *    Gesuch zählt, steht als eigener Absatz direkt nach K (`NACH_K`, Laien L3-3), die Sätze zu
 *    den Enthaltungen danach als letzter Absatz. K selbst bleibt zeichengleich; er ist auch in
 *    der FAQ der Website geprüft.
 *  - An der Prozessführung nennt der Satz zur Dringlichkeit im Kasten die erteilte
 *    Ermächtigung, damit er sich von der Schwelle der Begründung abhebt, die das Handeln
 *    ohne Ermächtigung regelt (Fach F2-1, Rz. 78 ad Art. 712t).
 *  - An der Prozessführung dazu ein Absatz zu ausstehenden Beiträgen, bei denen keine Frist
 *    läuft (Laien L2-2, L3-2): Verjährung (Rz. 66a ad Art. 712i), Pfandrecht nur für drei
 *    abgeschlossene Rechnungsjahre (ZGB Art. 712i Abs. 1; Fach VA-3), Frist zur Klage nach der
 *    vorläufigen Eintragung (Fach VA-2, Laien L3-4), Ermächtigung für den säumigen Eigentümer
 *    statt für alle im Voraus (Fach VA-1, BGer 5A_590/2011 E. 8.3).
 *  - Am Fonds stehen der einzige Antrag und die fälligen Rechnungen vor K (Laien L3-1).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_22, nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-22';
import { WAEHLEN_ERWEITERT_ID } from './quorum-2026-11-21';
import { ENTNAHME_ID } from './quorum-2026-11-20';

const VOR = REGELWERK_2026_11_22;

export const PROZESS_ID = 'k-prozessfuehrung';

/** Ein Absatz des Website-Abzugs; `vorspann` ist der Anfang von `text` und wird fett gesetzt. */
export interface Absatz {
	vorspann: string;
	text: string;
}

/**
 * **Nur für den Website-Abzug:** der Fallteil je Karte, ein oder zwei eigene Absätze zwischen
 * dem Satz «… nicht vor Ablauf dieser Frist aus.» und dem Kernsatz K, je mit fettem Anfang wie
 * «Wenn Sie nicht zugestimmt haben» an den Karten mit Einstimmigkeit. Eingesetzt in
 * `mitWartezeit` (`scripts/quorumsbaum-export.mjs`). Der letzte Satz vor K darf keine andere
 * Frist als die Anfechtungsfrist nennen, denn K beginnt mit «Warten Sie nach Ablauf der Frist»
 * (Laien und Fach Runde 3, Frage 2).
 */
export const VOR_K: Readonly<Record<string, readonly Absatz[]>> = {
	[PROZESS_ID]: [
		{
			vorspann: 'Ist die Ermächtigung erteilt',
			text:
				// Fach F2-1: die Bedingung vorn; ohne Ermächtigung gilt die Schwelle der Begründung.
				'Ist die Ermächtigung erteilt, ist die Sache bei einem Prozess dringlich, sobald die Gemeinschaft ' +
				'selbst eine Frist einhalten muss oder eine Forderung zu verjähren droht. ' +
				'Fristen setzt etwa das Gericht für die Klageantwort und für die Klage nach einer vorläufigen ' +
				'Eintragung des Pfandrechts (ZPO Art. 222 Abs. 1; ZGB Art. 961 Abs. 3).'
		},
		{
			// Laien L2-2, Runde 3 als eigener Absatz (Laien L3-2), weil er auch ohne Ermächtigung gilt.
			vorspann: 'Bei ausstehenden Beiträgen',
			text:
				'Bei ausstehenden Beiträgen läuft oft keine solche Frist, ob die Ermächtigung schon erteilt ist ' +
				'oder nicht. ' +
				'Die Beiträge verjähren nach einem Teil der Lehre und Rechtsprechung in fünf Jahren, nach anderen ' +
				'in zehn (SVIT-Kommentar Rz. 66a ad Art. 712i, Rz. 53 ad Art. 712h). ' +
				// Fach Runde 3 zu Hinweis 2 der Runde 2: Warten kann die Pfandsicherung älterer Beiträge kosten.
				'Das Pfandrecht sichert aber nur die Beiträge der letzten drei Jahre (ZGB Art. 712i Abs. 1). ' +
				// Fach VA-3: abgeschlossene Rechnungsjahre (Rz. 23, 62, 65 f.).
				'Gemeint sind nach dem SVIT-Kommentar abgeschlossene Rechnungsjahre, nicht das laufende (Rz. 62 ' +
				'und 66 ad Art. 712i). ' +
				'Lassen Sie es deshalb bald nach Abschluss des Rechnungsjahres vorläufig eintragen. ' +
				// Fach VA-2: dringlich nur mit erteilter Ermächtigung; sonst die Versammlung (Rz. 78 ad Art. 712t,
				// Nachfrist nur bei einem Versehen, Rz. 56 ad Art. 712i). Laien L3-4: die Folge der Frist.
				'Die Bewirtschaftung braucht dafür keine Ermächtigung. ' +
				'Für die Klage danach braucht sie eine, und das Gericht setzt dafür in der Regel eine Frist ' +
				'(SVIT-Kommentar Rz. 52 ad Art. 712i). ' +
				// Runde 2, Fach: die Norm des Wegfalls.
				'Wird in dieser Frist nicht geklagt, fällt die vorläufige Eintragung weg (ZPO Art. 263). ' +
				'Ist die Ermächtigung erteilt, ist die Sache mit dieser Frist dringlich. ' +
				// Runde 2, Fach VB-2 und Laien L4-1: entschieden haben, nicht nur einberufen.
				'Fehlt sie noch, lassen Sie die Versammlung so früh entscheiden, dass vor Ablauf der Frist geklagt ' +
				'werden kann. ' +
				// Fach VA-1: BGer 5A_590/2011 E. 8.3 trägt nur den engeren Fall; Runde 2, VB-1: «künftige»
				// trägt nur Rz. 89a, deshalb erneuern.
				'Ob eine Ermächtigung für alle im Voraus trägt, ist umstritten (Rz. 88 f. ad Art. 712t). ' +
				'Zahlt ein Eigentümer nicht, ermächtigen Sie die Bewirtschaftung deshalb eigens für seine ' +
				'fälligen und künftigen Beiträge (Rz. 89a ad Art. 712t). ' +
				'Das Bundesgericht hat dabei auf die fälligen abgestellt (BGer 5A_590/2011 E. 8.3). ' +
				'Erneuern Sie die Ermächtigung an jeder ordentlichen Versammlung, solange er nicht zahlt. ' +
				// Der Anschluss an K («nach Ablauf der Frist»).
				'Auch gegen diesen Beschluss läuft die Anfechtungsfrist.'
		}
	],
	[WAEHLEN_ERWEITERT_ID]: [
		{
			vorspann: 'Bei einer Wahl heisst ausführen',
			text:
				'Bei einer Wahl heisst ausführen: den Vertrag mit der Gewählten schliessen und sie antreten lassen. ' +
				// Laien L3-5: die Wartezeit steht jetzt erst im nächsten Absatz.
				'Setzen Sie die Wahl deshalb so früh an, dass die Anfechtungsfrist und die Wartezeit danach, die der ' +
				'nächste Absatz beschreibt, vor dem Wechsel ablaufen. Kann der Wechsel nicht warten, etwa weil der ' +
				'Vertrag der bisherigen Bewirtschaftung endet, ist die Sache dringlich.'
		}
	],
	[ENTNAHME_ID]: [
		{
			vorspann: 'Wurde über Arbeit und Bezahlung getrennt abgestimmt',
			text:
				'Wurde über Arbeit und Bezahlung getrennt abgestimmt, muss hier nur die Bezahlung aus dem Fonds ' +
				'warten. Ob und wie lange die Arbeit warten muss, sagt die Karte zu ihrem eigenen Beschluss (Antwort ' +
				'«Über die Arbeit selbst»).'
		},
		{
			// Laien L3-1: der einzige Antrag und die fälligen Rechnungen gehören zum Fallteil; «ist dringlich»,
			// weil «was eilt» erst in K steht. Runde 2, Laien L4-2: mit eigenem fettem Anfang.
			vorspann: 'Stand beides in einem einzigen Antrag',
			text:
				'Stand beides in einem einzigen Antrag, ist mit der Bezahlung auch die Arbeit angefochten, und das ' +
				'Warten gilt für beide.'
		},
		{
			// Runde 3, Laien L5-1 und Fach VC-1: gilt für beide Fälle, deshalb eigener Absatz.
			vorspann: 'Fällige Rechnungen',
			text:
				'Fällige Rechnungen bezahlen Sie in beiden Fällen trotzdem fristgerecht, so, ' +
				'wie es der Antrag über die Arbeit für diesen Fall vorsieht (unter «Gut zu wissen»). ' +
				'Sieht er dafür nichts vor, ist die Bezahlung fälliger Rechnungen aus dem Fonds dringlich.'
		}
	]
};

/**
 * **Nur für den Website-Abzug:** was nach K bleibt, als eigener Absatz direkt nach K, mit fettem
 * Anfang (Laien L3-3: wer liest, dass seine Sache dringlich ist, liest K nicht zu Ende).
 */
export const NACH_K: Readonly<Record<string, Absatz>> = {
	[PROZESS_ID]: {
		vorspann: 'Ist die Sache dringlich',
		text:
			'Ist die Sache dringlich, führt die Bewirtschaftung den Prozess, auch wenn ein Gesuch gegen die ' +
			'Ermächtigung eingegangen ist. ' +
			'Hebt ein Gericht die Ermächtigung später auf, gibt das Gericht des Prozesses in der Regel eine Frist, ' +
			'sie nachzuholen (ZPO Art. 132 Abs. 1; SVIT-Kommentar Rz. 79 ad Art. 712t). ' +
			'Berufen Sie die Versammlung dafür sofort ein, und fassen Sie den neuen Beschluss so, dass er nach ' +
			'jeder Zählweise trägt. Kommt innert der Frist keine gültige Ermächtigung zustande, gilt die Eingabe ' +
			'als nicht erfolgt. ' +
			'Die Kosten können dann die Bewirtschaftung treffen (SVIT-Kommentar Rz. 79 ad Art. 712t); ob die ' +
			'Gemeinschaft sie ihr ersetzen muss, ist offen (OR Art. 402 Abs. 1).'
	},
	[WAEHLEN_ERWEITERT_ID]: {
		vorspann: 'Ist der Wechsel dringlich',
		text:
			'Ist der Wechsel dringlich, tritt die Gewählte an, auch wenn ein Gesuch gegen die Wahl eingegangen ist. ' +
			'Vereinbaren Sie mit ihr schriftlich, dass sie Kompetenzen über die gewöhnliche Verwaltung hinaus bis ' +
			'zum Abschluss des Verfahrens nur nutzt, wo es eilt. Wird die Wahl später aufgehoben, werden ' +
			'ihre Leistungen bis dahin nach Vertragsrecht abgegolten (SVIT-Kommentar Rz. 125 ad Art. 712q). ' +
			'Nach Post fragen Sie die Bewirtschaftung, die gerade im Amt ist, nach dem Wechsel auch die bisherige. ' +
			'Antwortet eine nicht oder nicht sicher, fragen Sie bei der Schlichtungsbehörde am Ort der ' +
			'Liegenschaft nach.'
	},
	[ENTNAHME_ID]: {
		vorspann: 'Wird die Bezahlung später aufgehoben',
		text:
			'Wird die Bezahlung später aufgehoben, muss die Versammlung neu beschliessen, wie die Arbeit bezahlt ' +
			'wird, bei einem einzigen Antrag auch über die Arbeit selbst.'
	}
};

const alleAbsaetze = (id: string): Absatz[] => [...(VOR_K[id] ?? []), ...(NACH_K[id] ? [NACH_K[id]] : [])];

for (const id of Object.keys(VOR_K)) {
	if (!VOR.knoten.some((k) => k.id === id)) throw new Error(`Fassung 2026-11-23: Die Karte «${id}» fehlt.`);
	if (!NACH_K[id]) throw new Error(`Fassung 2026-11-23: An «${id}» fehlt der Teil nach K.`);
	for (const { vorspann, text } of alleAbsaetze(id)) {
		if (!text.startsWith(vorspann)) throw new Error(`Fassung 2026-11-23: Ein Absatz an «${id}» beginnt nicht mit seinem Vorspann.`);
	}
}
if (Object.keys(NACH_K).sort().join() !== Object.keys(VOR_K).sort().join()) {
	throw new Error('Fassung 2026-11-23: VOR_K und NACH_K nennen nicht dieselben Karten.');
}

/** In der Anwendung ändert sich kein Wortlaut; die Ersetzungen sind die der Vorfassung. */
export const nachDieserFassung = nachDerVorfassung;

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_23 = {
	...VOR,
	fassung: '2026-11-23',

	freigabevermerk:
		VOR.freigabevermerk +
		' Die Fassung 2026-11-23 ändert an den Karten der Anwendung nichts; sie ordnet für die Website die ' +
		'Hinweise zur Wartezeit an drei Karten neu.'
} satisfies Regelwerk;
