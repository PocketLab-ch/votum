/**
 * Fassung 2026-11-20: Die Bezahlung einer Arbeit aus dem Erneuerungsfonds als
 * eigener Fall mit eigenem Mehr, und die Lesart L17 dazu (Auftrag
 * `.auftraege/2026-11-15-votum-erneuerungsfonds-entnahme.md`; Produktentscheid
 * 15.11.2026: «ok, machen wir so», eigene Karte vor der Freigabe für eine echte
 * Versammlung; Fragen zum Entwurf am 17.11.2026).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-19 abgeleitet. Die
 * Fassungen bis 2026-11-19 bleiben unverändert; bis dahin führte
 * `f4-1-verwendung` nur zum Mehr der Arbeit, und das Mehr der Bezahlung setzte
 * die Leitung von Hand (Fachprüfung Runde 3, N3-1).
 *
 * **Was sich ändert:**
 *
 *  - `f4-1-verwendung` führt zu einer neuen Frage: über die Arbeit oder über die
 *    Bezahlung. Die Arbeit führt wie bisher nach `f1-0`, die Bezahlung zur Frage
 *    nach dem Zweck des Fonds (Produktentscheid 17.11.2026, «Zuerst fragen»).
 *  - Im gewöhnlichen Zweck (Rz. 137 ad Art. 712l) die Karte
 *    `k-erneuerungsfonds-entnahme`: nach der Vorgabe das qualifizierte Mehr
 *    (Eigenmann, ebenso Piccinin), mit der Lesart L17 nach dem SVIT-Kommentar
 *    das einfache Mehr nach Köpfen (Rz. 139).
 *  - Ausserhalb des gewöhnlichen Zwecks, aber bei der Schaffung des Fonds
 *    ausdrücklich vereinbart, `k-erneuerungsfonds-entnahme-vereinbart`: nach der
 *    Vorgabe die Zustimmung aller (Bloch, nach Rz. 138), mit L17 das Mehr im
 *    Zweck, das einfache nach Köpfen (Rz. 138, 139).
 *  - Ausserhalb ohne Vereinbarung `k-erneuerungsfonds-entnahme-ausserhalb`: die
 *    Zustimmung aller, nach beiden Auffassungen (Rz. 139, «Ansonsten»).
 *  - **Eine Lesart für alles** (Produktentscheid 17.11.2026: «Strenger per
 *    Default und einstellbar», «Eine: nach SVIT-Kommentar»): L17 steuert das
 *    Mehr der beiden ersten Karten und, in der Anwendung, ob eine mildere Regel
 *    der Gemeinschaft dort gilt. Eine strengere Regel gilt immer, auch eine
 *    allgemeine für wichtigere Verwaltungshandlungen (Fachprüfung F-5); eine
 *    mildere nur nach L17 und nur, wenn sie eigens für diesen Fall hinterlegt ist
 *    (Fachprüfung F-1; Art. 712g Abs. 2, Rz. 27 und 78a ad Art. 712g).
 *  - Arbeit und Bezahlung in einem Antrag: Der Beschluss muss beide Mehr
 *    erreichen; empfohlen sind zwei Traktanden (Produktentscheid 17.11.2026,
 *    «Hinweis, zwei Traktanden»). Votum rechnet je Traktandum ein Mehr.
 *  - Die Hilfe an `f4-1-verwendung` und der Hinweis `ENTNAHME` an den vier
 *    Karten zum Fonds sagen dasselbe wie die neue Karte und verweisen auf sie.
 *
 * Wortlaut nach der Laien- und Fachprüfung, Runde 1
 * (`quellen/pruefung/berichte/2026-11-17-votum-erneuerungsfonds-entnahme-*`).
 */
import type { Antwort, Ergebnisknoten, Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_19 } from './quorum-2026-11-19';
import { ENTNAHME as ENTNAHME_VORHER, FRISTBEGINN, VERWENDUNG_HILFE as VERWENDUNG_HILFE_VORHER } from './quorum-2026-11-18';

const VOR = REGELWERK_2026_11_19;

export const FRAGE_GELD_ID = 'f4-1';
export const ANTWORT_VERWENDUNG_ID = 'f4-1-verwendung';
export const FRAGE_BESCHLUSS_ID = 'f4-1-verwendung-beschluss';
export const FRAGE_ZWECK_ID = 'f4-1-verwendung-zweck';
export const ENTNAHME_ID = 'k-erneuerungsfonds-entnahme';
export const VEREINBART_ID = 'k-erneuerungsfonds-entnahme-vereinbart';
export const AUSSERHALB_ID = 'k-erneuerungsfonds-entnahme-ausserhalb';

/** Die Karten mit der Lesart L17. */
export const KARTEN_MIT_L17 = [ENTNAHME_ID, VEREINBART_ID] as const;

/** Die Karte, deren Weg bei fehlender Zustimmung die neuen Karten übernehmen (allgemein gehalten, ohne Urkunde). */
const WEG_VON = 'k-bewirtschaftung-statt-versammlung';

/** Die vier Karten zum Fonds, die seit der Fassung 2026-11-18 den Hinweis `ENTNAHME` tragen. */
export const KARTEN_MIT_ENTNAHME = [
	'k-erneuerungsfonds-errichten',
	'k-erneuerungsfonds',
	'k-erneuerungsfonds-ueber-reglement',
	'k-erneuerungsfonds-grenze-in-der-regel'
] as const;

export const TITEL_ENTNAHME = 'Arbeit aus dem Erneuerungsfonds bezahlen';
export const TITEL_VEREINBART = 'Aus dem Erneuerungsfonds bezahlen, was bei seiner Schaffung vereinbart wurde';
export const TITEL_AUSSERHALB = 'Aus dem Erneuerungsfonds bezahlen, was nicht zu seinem Zweck gehört';

/** Die Antworten der Frage nach dem Beschluss; auf ihre Texte verweisen Hinweise und Hilfe. */
export const ANTWORT_ARBEIT_TEXT = 'Über die Arbeit selbst';
export const ANTWORT_BEZAHLUNG_TEXT = 'Über die Bezahlung aus dem Fonds';
/** Der Text von `f4-1-verwendung` seit der Fassung 2026-07-30; die Probe unten hält ihn fest. */
export const VERWENDUNG_TEXT = 'Mittel des Erneuerungsfonds für ein konkretes Bauvorhaben verwenden';

// ── Die Sätze ────────────────────────────────────────────────────────────────

/**
 * Der gewöhnliche Zweck und seine Ausnahmen (Rz. 137 ad Art. 712l; Fachprüfung
 * F-4: auch Art. 647d Abs. 3), und dass die vereinbarte Erweiterung umstritten
 * ist (Rz. 138, a.M. Bloch; F-3). Ein Wortlaut für Frage, Hinweis und Karten
 * (Laienprüfung L-1).
 */
export const ZWECK =
	'Ohne andere Vereinbarung dient der Fonds notwendigen oder nützlichen Arbeiten an gemeinsamen Teilen, die allen ' +
	'zugutekommen. Nicht dazu gehören luxuriöse Arbeiten und Teile, die nicht allen dienen. Ebenso wenig gehören ' +
	'nützliche Arbeiten dazu, deren Kosten einem Eigentümer, der nicht zustimmt, nicht zumutbar sind (SVIT-Kommentar ' +
	'Rz. 137 ad Art. 712l). Dafür braucht es die Zustimmung aller. Haben die Eigentümer bei der Schaffung des Fonds ' +
	'ausdrücklich vereinbart, dass er auch dafür dient, genügt nach dem SVIT-Kommentar das Mehr im Zweck (Rz. 138, ' +
	'139). Ein anderer Autor hält diese Verwendung auch dann für unzulässig; sicher ist deshalb nur die Zustimmung ' +
	'aller.';

/** Der Streit um das Mehr im Zweck (Rz. 139 ad Art. 712l; Fachprüfung F-7 zur Zuordnung). */
export const ENTNAHME_STREIT =
	'Sagen weder Reglement noch Errichtungsbeschluss, mit welchem Mehr entnommen wird, ist es umstritten. Eigenmann ' +
	'verlangt das qualifizierte Mehr, weil er die Entnahme für eine wichtigere Verwaltungshandlung hält; ebenso ' +
	'Piccinin. Der SVIT-Kommentar lässt im Rahmen des Zwecks das einfache Mehr nach Köpfen genügen (Rz. 139 ad ' +
	'Art. 712l). Ein Beschluss mit qualifiziertem Mehr genügt beiden Auffassungen. Weil fehlende Wertquoten dabei ' +
	'wie ein Nein wirken, lohnt es sich, von Verhinderten vorher eine Vollmacht einzuholen.';

/**
 * Was gilt, wenn nur das einfache Mehr erreicht ist, mit dem nächsten Schritt im
 * Saal (Laienprüfung L-4): nicht angenommen nach der gerechneten Auffassung.
 */
export const ENTNAHME_KNAPP =
	'Reicht es nur für das einfache Mehr, ist der Beschluss nach der strengeren Auffassung nicht zustande gekommen. ' +
	'Nach dem SVIT-Kommentar trägt er. Wer ihn trotzdem als angenommen festhält, riskiert eine Anfechtung innert ' +
	'eines Monats, und ein Gericht könnte der strengeren Auffassung folgen. ' +
	`${FRISTBEGINN} Halten Sie im Protokoll fest, wie viele Köpfe und Wertquoten zugestimmt haben.`;

/**
 * Zwei Beschlüsse, was für einen gemeinsamen Antrag gilt (Produktentscheid
 * 17.11.2026; Laienprüfung L-3, Fachprüfung Frage 4) und die Finanzierungslücke
 * (Fachprüfung F-8; Rz. 139a ad Art. 712l).
 */
export const ZWEI_BESCHLUESSE =
	`Diese Karte gilt für die Bezahlung, nicht für die Arbeit; deren Mehr zeigt die Antwort «${ANTWORT_ARBEIT_TEXT}». ` +
	'Kündigen Sie beide Beschlüsse in der Einladung an und stimmen Sie getrennt ab, zuerst über die Arbeit. Sagen Sie ' +
	'in deren Antrag, wie sie bezahlt wird, wenn die Bezahlung aus dem Fonds nicht zustande kommt. Ist mit der Arbeit ' +
	'begonnen, kommt die Versammlung nach dem SVIT-Kommentar auf die Bezahlung aus dem Fonds nicht mehr zurück, ' +
	'auch wenn die Arbeit stoppt (Rz. 139a ad Art. 712l). Stehen Arbeit und ' +
	'Bezahlung in einem einzigen Antrag, muss er das Mehr der Arbeit und das Mehr der Bezahlung erreichen, sonst ist ' +
	'er abgelehnt.';

/** Der Ausweg ohne Fonds (Fachprüfung F-6; Folgerung, keine Randziffer). */
export const OHNE_FONDS =
	'Kommt die Zustimmung aller nicht zustande, bleibt die Arbeit möglich, wenn sie nicht aus dem Fonds bezahlt wird, ' +
	'sondern mit Beiträgen der Eigentümer. Dann gilt nur das Mehr der Arbeit, mit der Kostenverteilung, die für sie ' +
	// Runde 3 (R3-F-2): nur nützliche Arbeiten, nur der Teil über dem zumutbaren Betrag; (R3-L-3) die zwei
	// Fälle getrennt, mit dem Verteiler im Antrag.
	'gilt. Ist eine nützliche Arbeit einem Eigentümer, der nicht zustimmt, nicht zumutbar, tragen die übrigen seinen ' +
	'Anteil, soweit er den für ihn zumutbaren Betrag übersteigt (ZGB Art. 647d Abs. 3). Bei einer luxuriösen ' +
	'Arbeit tragen die, die nicht zustimmen, nach Art. 647e Abs. 2 keine Kosten. Dient ein Teil einzelnen ' +
	'Eigentümern nicht oder kaum, ist das bei der Verteilung der Kosten zu berücksichtigen (Art. 712h Abs. 3). Nehmen Sie den Verteiler in den Antrag ' +
	'über die Arbeit auf.';

/**
 * Der Weg an der vereinbarten Verwendung, wenn die Gemeinschaft dem SVIT-Kommentar
 * folgt (L17 `svit`): Gerechnet wird das einfache Mehr, sicher ist nur die
 * Zustimmung aller (Rz. 138, a.M. Bloch; Fachprüfung Runde 2, R2-F-2).
 */
export const VEREINBART_SVIT_WEG =
	'Gerechnet wird nach der Einstellung Ihrer Gemeinschaft mit dem einfachen Mehr nach Köpfen (SVIT-Kommentar ' +
	'Rz. 138, 139 ad Art. 712l). Ein anderer Autor hält diese Verwendung auch dann für unzulässig. Sicher ist deshalb ' +
	'nur ein Beschluss, dem alle zustimmen. Fehlt diese Zustimmung, halten Sie im Protokoll fest, wie viele Köpfe ' +
	'zugestimmt haben.';

/** Was das Recht zu einer Regel der Gemeinschaft im Zweck sagt (Fachprüfung F-1; Rz. 139 ad Art. 712l, Rz. 27, 78a ad Art. 712g). */
export const ENTNAHME_REGLEMENTSRECHT =
	'Sagen Ihr Reglement oder der Errichtungsbeschluss, mit welchem Mehr über die Bezahlung aus dem Fonds ' +
	'entschieden wird, gilt dieses, wenn es strenger ist als das qualifizierte Mehr. Ist es milder, genügt das nach ' +
	'dem SVIT-Kommentar. Nach der strengeren Auffassung ist es nur sicher, wenn die Regel im Begründungsakt steht ' +
	'oder alle Eigentümer ihr zugestimmt haben (Rz. 139 ad Art. 712l; Rz. 27, 78a ad Art. 712g).';

/** Was das Recht an der vereinbarten Verwendung zu einer Regel sagt (Rz. 138 ad Art. 712l). */
export const VEREINBART_REGLEMENTSRECHT =
	'Dass die Eigentümer das bei der Schaffung des Fonds ausdrücklich vereinbart haben, muss sich belegen lassen. ' +
	'Das geht etwa mit dem Begründungsakt, dem Reglement oder dem Errichtungsbeschluss. Eine später beschlossene ' +
	'Erweiterung trägt ohne die Zustimmung aller nicht; ob sie mit der Zustimmung aller genügt, ist nicht geklärt ' +
	'(SVIT-Kommentar Rz. 138 ad Art. 712l). Sagen Ihr Reglement oder der Errichtungsbeschluss, mit welchem Mehr ' +
	'über die Bezahlung entschieden wird, genügt das nach dem SVIT-Kommentar. Sicher ist es nicht: Ein anderer ' +
	'Autor lässt diese Verwendung auch dann nicht zu. Sicher ist nur ein Beschluss, dem alle zustimmen (Rz. 138, 139).';

/** Ausserhalb des Zwecks ohne Vereinbarung (Rz. 138, 139 ad Art. 712l). */
export const AUSSERHALB_REGLEMENTSRECHT =
	'Eine Regel der Gemeinschaft senkt die Zustimmung aller hier nicht. Haben die Eigentümer bei der Schaffung des ' +
	`Fonds ausdrücklich vereinbart, dass er auch dafür dient, gilt die Karte «${TITEL_VEREINBART}» (SVIT-Kommentar ` +
	'Rz. 138 ad Art. 712l).';

/**
 * Was an die Stelle von `ENTNAHME` tritt, an den vier Karten zum Fonds: dieselbe
 * Aussage wie die neue Karte, mit dem Weg dorthin (Kriterium 5 des Auftrags;
 * Laienprüfung L-5: «fassen Sie sie so» wie der Praxis-Tipp der Website).
 */
export const ENTNAHME =
	'Eine Arbeit aus dem Fonds zu bezahlen, braucht zwei Beschlüsse: einen über die Arbeit selbst, mit dem Mehr, das ' +
	'sie braucht, und einen über die Bezahlung aus dem Fonds. Kündigen Sie beide in der Einladung an. Sagen weder ' +
	'Reglement noch Errichtungsbeschluss, mit welchem Mehr entnommen wird, fassen Sie die Bezahlung sicherheitshalber ' +
	'so, dass sie das qualifizierte Mehr erreicht. Ausserhalb des Zwecks braucht sie die Zustimmung aller (Rz. 137 bis ' +
	`139 ad Art. 712l). Das Mehr der Bezahlung zeigt die Karte «${TITEL_ENTNAHME}»; wählen Sie dafür bei den ` +
	`Jahresgeschäften «${VERWENDUNG_TEXT}».`;

/** Die Hilfe an `f4-1-verwendung`, die jetzt zur Frage nach dem Beschluss führt. */
export const VERWENDUNG_HILFE =
	'Für die Arbeit selbst gilt das Mehr des Vorhabens: Eine Heizungssanierung wird nicht dadurch einfacher, dass sie ' +
	'aus dem Fonds bezahlt wird. Die Bezahlung aus dem Fonds ist ein zweiter Beschluss mit eigenem Mehr; kündigen ' +
	'Sie beide in der Einladung an. Die nächste Frage führt zu beiden.';

export const FRAGE_BESCHLUSS_TEXT = 'Über welchen der beiden Beschlüsse stimmen Sie ab?';
export const FRAGE_BESCHLUSS_HILFE =
	'Wer eine Arbeit aus dem Fonds bezahlen will, braucht zwei Beschlüsse, jeden mit seinem eigenen Mehr. Prüfen Sie ' +
	'das Mehr für beide. Stehen sie in einem einzigen Antrag, muss er beide Mehr erreichen, sonst ist er abgelehnt.';

export const FRAGE_ZWECK_TEXT = 'Gehört die Arbeit zum Zweck des Fonds?';
/** Mit Beispielen für die Grenze und der Folge der letzten Antwort (Laienprüfung L-2). */
export const FRAGE_ZWECK_HILFE =
	`${ZWECK} Zum Zweck gehört etwa die Sanierung von Dach, Fassade oder Heizung, auch der Ersatz eines Lifts, den ` +
	// Runde 3 (R3-F-3, R3-L-1): nur was allein den Plätzen dient (Rz. 99 bis 102 ad Art. 712h, eng).
	'alle nutzen können. Ladestationen nur für einen Teil der Plätze gehören in der Regel nicht dazu. Ebenso wenig ' +
	'ein neuer Lift, der einzelnen Wohnungen nicht dient, oder ein neues Tor einer Einstellhalle, deren Plätze ' +
	'nicht allen gehören. Decke und Abdichtung der Halle dienen dagegen meist allen. Klären Sie die Frage vor der Einladung. Lässt sie sich nicht klar beantworten, wählen Sie die ' +
	'letzte Antwort. Kommt die Zustimmung aller nicht zustande, bleibt die Arbeit möglich, wenn sie nicht aus dem ' +
	'Fonds bezahlt wird.';

// ── Fragen und Karten ───────────────────────────────────────────────────────

const FRAGE_BESCHLUSS: Frage = {
	id: FRAGE_BESCHLUSS_ID,
	text: FRAGE_BESCHLUSS_TEXT,
	hilfe: FRAGE_BESCHLUSS_HILFE,
	antworten: [
		{ id: 'f4-1-verwendung-arbeit', text: ANTWORT_ARBEIT_TEXT, ziel: 'f1-0' },
		{ id: 'f4-1-verwendung-bezahlung', text: ANTWORT_BEZAHLUNG_TEXT, ziel: FRAGE_ZWECK_ID }
	]
};

const FRAGE_ZWECK: Frage = {
	id: FRAGE_ZWECK_ID,
	text: FRAGE_ZWECK_TEXT,
	hilfe: FRAGE_ZWECK_HILFE,
	antworten: [
		{
			id: 'f4-1-zweck-ja',
			text: 'Ja, eine notwendige oder nützliche Arbeit an gemeinsamen Teilen, die allen dient',
			ziel: ENTNAHME_ID
		},
		{
			// Fachprüfung F-2: «bei der Schaffung» für «von Anfang an» (Rz. 138); Frage 2: die spätere Erweiterung.
			id: 'f4-1-zweck-vereinbart',
			text: 'Nein, aber die Eigentümer haben bei der Schaffung des Fonds ausdrücklich vereinbart, dass er auch dafür dient',
			ziel: VEREINBART_ID,
			hilfe:
				'Die Vereinbarung muss sich belegen lassen, etwa im Begründungsakt, im Reglement oder im ' +
				'Errichtungsbeschluss. Eine später beschlossene Erweiterung zählt hier nur, wenn alle Eigentümer ihr ' +
				'zugestimmt haben, und auch dann ist nicht geklärt, ob sie genügt; sonst wählen Sie die letzte Antwort.'
		},
		{
			id: 'f4-1-zweck-nein',
			text: 'Nein, und eine solche Vereinbarung gibt es nicht oder lässt sich nicht belegen',
			ziel: AUSSERHALB_ID
		}
	]
};

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

const VOR_GELD = VOR.fragen.find((f) => f.id === FRAGE_GELD_ID);
const VOR_VERWENDUNG = VOR_GELD?.antworten.find((a) => a.id === ANTWORT_VERWENDUNG_ID);
if (
	!VOR_VERWENDUNG ||
	VOR_VERWENDUNG.ziel !== 'f1-0' ||
	VOR_VERWENDUNG.text !== VERWENDUNG_TEXT ||
	VOR_VERWENDUNG.hilfe !== VERWENDUNG_HILFE_VORHER
) {
	throw new Error('Fassung 2026-11-20: «f4-1-verwendung» führt in der Vorfassung nicht mit der Hilfe von 2026-11-18 nach «f1-0».');
}
for (const id of KARTEN_MIT_ENTNAHME) {
	const k = VOR.knoten.find((x) => x.id === id);
	if (!k || (k.hinweise ?? []).filter((h) => h === ENTNAHME_VORHER).length !== 1) {
		throw new Error(`Fassung 2026-11-20: «${id}» trägt in der Vorfassung den Hinweis zur Entnahme nicht genau einmal.`);
	}
	if ((k.hinweiseUnterRegel ?? []).some((h) => h.hinweis === ENTNAHME_VORHER || h.ersatz === ENTNAHME_VORHER)) {
		throw new Error(`Fassung 2026-11-20: «${id}» führt den Hinweis zur Entnahme auch unter einer Regel.`);
	}
}
for (const id of [FRAGE_BESCHLUSS_ID, FRAGE_ZWECK_ID, ENTNAHME_ID, VEREINBART_ID, AUSSERHALB_ID]) {
	if ([...VOR.knoten, ...VOR.fragen].some((x) => x.id === id)) throw new Error(`Fassung 2026-11-20: «${id}» gibt es schon.`);
}
const WEG = VOR.knoten.find((k) => k.id === WEG_VON)?.einstimmigkeitsweg;
if (!WEG || !WEG.startsWith('Fehlt an der Versammlung eine Zustimmung')) {
	throw new Error(`Fassung 2026-11-20: «${WEG_VON}» trägt in der Vorfassung nicht den allgemeinen Weg bei fehlender Zustimmung.`);
}
/** Der Weg bei fehlender Zustimmung, mit dem Ausweg ohne Fonds davor (Fachprüfung F-6). */
const WEG_MIT_AUSWEG = `${OHNE_FONDS} ${WEG}`;

/** Das Mehr nach dem SVIT-Kommentar, die andere Wahl der Lesart L17 (Rz. 139 ad Art. 712l). */
const L17_SVIT = {
	wahl: 'svit',
	typ: 'einfaches_mehr',
	rechtsgrundlage: 'ZGB Art. 712l mit SVIT-Kommentar Rz. 139',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine'
} as const;

const ENTNAHME_KARTE: Ergebnisknoten = {
	id: ENTNAHME_ID,
	titel: TITEL_ENTNAHME,
	typ: 'qualifiziertes_mehr',
	geschaeftsart: 'verwaltung_wichtig',
	rechtsgrundlage: 'ZGB Art. 647b Abs. 1 und Art. 712l mit Lehre',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	zustimmungBetroffenerNoetig: false,
	/* Wie `k-verwaltung-wichtig`: Art. 647b Abs. 1 sagt «aller Miteigentümer», gerechnet wird nach Rz. 190 f. ad Art. 712m. */
	wortlautAbweichung: true,
	begruendung:
		'Über die Bezahlung einer Arbeit aus dem Fonds beschliesst die Versammlung, getrennt vom Beschluss über die ' +
		'Arbeit selbst. Welches Mehr es braucht, sagt das Gesetz nicht (SVIT-Kommentar Rz. 139 ad Art. 712l).',
	beispiele: ['Die Dachsanierung aus dem Fonds bezahlen', 'Den Ersatz der Heizung zur Hälfte aus dem Fonds bezahlen'],
	hinweise: [ENTNAHME_STREIT, ENTNAHME_KNAPP, ZWEI_BESCHLUESSE, ZWECK],
	/* Streit und knapper Ausgang erklären das gerechnete Mehr; unter einer angewandten Regel stehen sie beim Gesetz. */
	hinweiseUnterRegel: [
		{ hinweis: ENTNAHME_STREIT, zumGesetz: true },
		{ hinweis: ENTNAHME_KNAPP, zumGesetz: true }
	],
	reglementsverhalten: 'frei',
	reglementsrecht: ENTNAHME_REGLEMENTSRECHT,
	rang: 'lehre',
	lesart: { kennung: 'L17', andere: L17_SVIT }
};

const VEREINBART_KARTE: Ergebnisknoten = {
	id: VEREINBART_ID,
	titel: TITEL_VEREINBART,
	typ: 'einstimmigkeit',
	geschaeftsart: 'verwaltung_wichtig',
	rechtsgrundlage: 'ZGB Art. 712l mit Lehre',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Die Eigentümer haben bei der Schaffung des Fonds vereinbart, dass er auch für Arbeiten ausserhalb des ' +
		'gewöhnlichen Zwecks dient. Ob dann das Mehr im Zweck genügt, ist umstritten (SVIT-Kommentar Rz. 138 ad ' +
		'Art. 712l, a.M. Bloch).',
	beispiele: ['Eine Garage mit mehreren Boxen, die nachträglich gebaut wird, wenn das so vereinbart ist'],
	hinweise: [ZWECK, ZWEI_BESCHLUESSE],
	reglementsverhalten: 'frei',
	reglementsrecht: VEREINBART_REGLEMENTSRECHT,
	rang: 'lehre',
	einstimmigkeitsweg: WEG_MIT_AUSWEG,
	lesart: {
		kennung: 'L17',
		andere: {
			...L17_SVIT,
			rechtsgrundlage: 'ZGB Art. 712l mit SVIT-Kommentar Rz. 138 und 139',
			/* Codeprüfung, Befund 1: sonst stünde unter `svit` der Weg zur Zustimmung aller da (wie L6, eigener Weg). */
			einstimmigkeitsweg: VEREINBART_SVIT_WEG
		}
	}
};

const AUSSERHALB_KARTE: Ergebnisknoten = {
	id: AUSSERHALB_ID,
	titel: TITEL_AUSSERHALB,
	typ: 'einstimmigkeit',
	geschaeftsart: 'verwaltung_wichtig',
	rechtsgrundlage: 'ZGB Art. 712l mit Lehre',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Der Fonds dient ohne andere Vereinbarung nur notwendigen oder nützlichen Arbeiten an gemeinsamen Teilen, die ' +
		'allen zugutekommen. Für eine andere Verwendung braucht es die Zustimmung aller (SVIT-Kommentar Rz. 137 bis 139 ' +
		'ad Art. 712l).',
	beispiele: ['Ladestationen nur für einen Teil der Plätze in der Einstellhalle', 'Eine luxuriöse Gestaltung der Eingangshalle'],
	hinweise: [ZWEI_BESCHLUESSE],
	reglementsverhalten: 'gesperrt_vereinbarung',
	reglementsrecht: AUSSERHALB_REGLEMENTSRECHT,
	rang: 'lehre',
	einstimmigkeitsweg: WEG_MIT_AUSWEG
};

function mitBeschlussfrage(f: Frage): Frage {
	if (f.id !== FRAGE_GELD_ID) return f;
	return {
		...f,
		antworten: f.antworten.map(
			(a): Antwort => (a.id === ANTWORT_VERWENDUNG_ID ? { ...a, ziel: FRAGE_BESCHLUSS_ID, hilfe: VERWENDUNG_HILFE } : a)
		)
	};
}

function mitNeuemHinweis(k: Ergebnisknoten): Ergebnisknoten {
	if (!(KARTEN_MIT_ENTNAHME as readonly string[]).includes(k.id)) return k;
	return { ...k, hinweise: (k.hinweise ?? []).map((h) => (h === ENTNAHME_VORHER ? ENTNAHME : h)) };
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_20 = {
	...VOR,
	fassung: '2026-11-20',

	fragen: [...VOR.fragen.map(mitBeschlussfrage), FRAGE_BESCHLUSS, FRAGE_ZWECK],

	knoten: [...VOR.knoten.map(mitNeuemHinweis), ENTNAHME_KARTE, VEREINBART_KARTE, AUSSERHALB_KARTE],

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-20 rechnet Votum die Bezahlung einer Arbeit aus dem Erneuerungsfonds als eigenen ' +
		'Beschluss. Sagen weder Reglement noch Errichtungsbeschluss etwas, verlangt es nach der Vorgabe das ' +
		'qualifizierte Mehr, ausserhalb des Zwecks die Zustimmung aller; nach dem SVIT-Kommentar (Lesart L17) im Zweck ' +
		'das einfache Mehr nach Köpfen.'
} satisfies Regelwerk;
