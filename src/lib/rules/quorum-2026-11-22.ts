/**
 * Fassung 2026-11-22: die Befunde der Website-Prüfung am Abzug 2026-11-21
 * (Auftrag `.auftraege/2026-11-18-votum-korrektur-nach-website-pruefung.md`, nach der
 * Meldung `.auftraege/2026-11-18-meldung-votum-befunde-abzug-2026-11-21.md`; Berichte
 * `quellen/pruefung/berichte/2026-11-18-website-abzug-2026-11-21-{laien,fach}.md`).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-21 abgeleitet wie diese von
 * 2026-11-20. Die Fassungen bis 2026-11-21 bleiben unverändert.
 *
 * **Was sich ändert:**
 *
 *  - Der Widerruf (`WIDERRUF_ANFANG`) bindet das einfache Mehr an seinen Fall, bevor
 *    Reglement und Begründungsakt kommen, wie die FAQ der Website im Kasten
 *    «Befugnisse zurücknehmen» (Fach F-4, Laien L-4): Rz. 42 ad Art. 712m trägt nur
 *    «jederzeit», das einfache Mehr tragen Rz. 70 ad Art. 712s und Rz. 91 ad Art. 712g.
 *    Der Satz zum Begründungsakt steht am Schluss, nach den Fällen, und erklärt das Wort
 *    (Laien L-8). In `WIDERRUF_IN_VOTUM` dieselbe Bedingung statt «auf einem Beschluss».
 *  - Der Hinweis zur Rücknahme vor der Wahl ohne «sie sie», mit dem Hinweis davor statt
 *    «oben auf dieser Karte», ohne «in der Regel ein qualifiziertes Mehr» für den
 *    Begründungsakt und mit dem Schritt beim laufenden Vertrag (Laien L-5, L-6, L-10;
 *    Fach F-5). Die Website trägt ihn ohne die Sätze zur Bedienung von Votum
 *    (`RUECKNAHME_WEBSITE`).
 *  - Der Satz zum Antrag über die Arbeit an den drei Karten zur Bezahlung aus dem Fonds
 *    nennt auch die Anfechtung (Fach F-3).
 *  - An der Prozessführung sagt die Begründung, was dringlich ist (Laien Runde 2, VK-L-1),
 *    und der Satz zum Nein nennt die Verwaltung («darf die Verwaltung so in der Regel nicht
 *    handeln»); die Website trägt den Schluss wie die Anwendung. Achtung beim Namen:
 *    `EILWEG_VORHER` ist hier das `EILWEG` der Fassung 2026-11-10, deren `EILWEG_VORHER`
 *    heisst hier `EILWEG_GESETZ`.
 *  - Für den Website-Abzug je ein Zusatz nach dem Kernsatz K an drei Karten, die das
 *    Warten nicht vertragen (`NACH_K`; Fach F-1 bis F-3, Laien L-1 bis L-3). Der Kernsatz
 *    selbst bleibt zeichengleich; er ist auch in der FAQ der Website geprüft.
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_21 } from './quorum-2026-11-21';
import {
	RUECKNAHME_VOR_DER_WAHL as RUECKNAHME_VORHER,
	WAEHLEN_ERWEITERT_ID,
	WIDERRUF as WIDERRUF_VORHER,
	WIDERRUF_SCHLUSS,
	nachDieserFassung as nachDerVorfassung
} from './quorum-2026-11-21';
import { ENTNAHME_ID, VEREINBART_ID, AUSSERHALB_ID } from './quorum-2026-11-20';
import { EILWEG as EILWEG_VORHER, EILWEG_VORHER as EILWEG_GESETZ } from './quorum-2026-11-10';

const VOR = REGELWERK_2026_11_21;

/**
 * Der Widerruf ab dieser Fassung. Reihenfolge der FAQ der Website (Runde 2 ohne Befund ab
 * mittel): zuerst der Fall des einfachen Mehrs, dann das Reglement, dann der Begründungsakt.
 */
export const WIDERRUF_ANFANG =
	// Sätze geteilt für die Grenze von 180 Zeichen (`check:texte`); die Aussage bleibt.
	// Fach F-4: Rz. 42 ad Art. 712m nennt kein Mehr, nur «jederzeit».
	'Zurücknehmen kann die Versammlung beides jederzeit (SVIT-Kommentar Rz. 42 ad Art. 712m). ' +
	'Steht die Übertragung weder im Reglement noch im Begründungsakt, genügt dafür das einfache Mehr ' +
	'(Rz. 70 ad Art. 712s, Rz. 91 ad Art. 712g). ' +
	'Die Rücknahme muss als Traktandum angekündigt sein (ZGB Art. 67 Abs. 3 mit Art. 712m Abs. 2). ' +
	'Kam die Übertragung erst nach der Begründung mit einem Mehrheitsbeschluss ins Reglement, braucht es ' +
	'das Mehr, das Ihr Reglement für seine eigene Änderung verlangt. ' +
	'Regelt es dazu nichts, braucht es das qualifizierte Mehr (ZGB Art. 712g Abs. 3). Ob das Reglement für seine ' +
	'eigene Änderung ein anderes Mehr setzen darf, das einfache oder etwa die Zustimmung aller, ist umstritten ' +
	'(Rz. 40, 125 und 145 ad Art. 712g). Steht die Übertragung schon im Begründungsakt oder kam sie mit der Zustimmung aller ' +
	'ins Reglement, ist offen, ob ihre Rücknahme die Zustimmung aller braucht (BGer 5C.110/2001 E. 2b). Sicher ist ' +
	'in beiden Fällen die Zustimmung aller. ' +
	// Laien L-4 und L-8: der Satz am Schluss, nach den Fällen des Begründungsakts, mit dem Wort erklärt.
	'Begründungsakt heisst die Urkunde, mit der das Stockwerkeigentum errichtet wurde. Zu ihm gehört auch ein ' +
	'Reglement, das bei der Begründung als sein Bestandteil erlassen wurde, wenn die Übertragung schon damals darin stand.';

/** Was nur die Anwendung sagt, mit derselben Bedingung wie der erste Fall oben. */
export const WIDERRUF_IN_VOTUM =
	'Wie Votum eine Klausel rechnet, nach der das Reglement für seine Änderung die Zustimmung aller verlangt, ' +
	'stellen Sie mit der Lesart L6 auf der Seite «Lesarten» ein. Eine eigene Karte für die Rücknahme hat Votum nicht. ' +
	'Kam die Übertragung erst später mit einem ' +
	'Mehrheitsbeschluss ins Reglement, wählen Sie unter «Was soll geändert werden?» die Antwort «Reglement, ' +
	'gewöhnliche Bestimmung». Steht die Übertragung schon ' +
	'im Begründungsakt oder kam sie mit der Zustimmung aller ins Reglement, ist die Antwort zur Bestimmung über ' +
	'Zuständigkeit oder Quoren der sichere Weg. Steht die Übertragung weder im Reglement noch im Begründungsakt, ' +
	'setzen Sie unter «Anderes Erfordernis setzen» das einfache Mehr.';

export { WIDERRUF_SCHLUSS };

export const WIDERRUF = `${WIDERRUF_ANFANG} ${WIDERRUF_IN_VOTUM} ${WIDERRUF_SCHLUSS}`;

/** Derselbe Satz für den Website-Abzug, ohne das, was nur die Anwendung sagt. */
export const WIDERRUF_WEBSITE = `${WIDERRUF_ANFANG} ${WIDERRUF_SCHLUSS}`;

/** Wie oft der Widerruf im Regelwerk der Vorfassung steht (wie in der Fassung 2026-11-21). */
export const STELLEN = 6;

/**
 * Der Hinweis zur Rücknahme vor der Wahl, in drei Stücken, damit Anwendung und Website
 * denselben Anfang und Schluss tragen und nur die Bedienung von Votum verschieden ist.
 */
export const RUECKNAHME_ANFANG =
	// Meldung Punkt 3: «kann sie sie» brach den Content-Check der Website (Wortdopplung).
	'Will Ihre Gemeinschaft die Kompetenzen über die gewöhnliche Verwaltung hinaus nicht weiterführen, kann die ' +
	'Versammlung sie vor der Wahl zurücknehmen. ' +
	// Laien L-5: «oben auf dieser Karte» las sich als das Mehr der Wahl.
	'Das geschieht in einem eigenen Traktandum, das in der Einladung vor der Wahl steht, mit dem Mehr, das der ' +
	'Hinweis davor für die Rücknahme nennt. ' +
	// Laien L-6: «in der Regel ein qualifiziertes Mehr» widersprach dem Hinweis davor beim Begründungsakt.
	'Stehen die Kompetenzen im Reglement oder im Begründungsakt, braucht schon die Rücknahme in der Regel mehr als ' +
	'das einfache Mehr, bis hin zur Zustimmung aller. Der Weg hilft deshalb vor allem, wenn sie nur auf einem ' +
	'früheren Beschluss beruhen. ' +
	'Danach hat die Bewirtschaftung nur die Aufgaben, die das Gesetz jeder Bewirtschaftung gibt. ' +
	'Für ihre Wahl genügt dann das einfache Mehr (ZGB Art. 647b Abs. 1; SVIT-Kommentar Rz. 44 ad Art. 712m). Das ' +
	'gilt nur, wenn auch ihr Verwaltungsvertrag ihr keine solchen Kompetenzen gibt, der laufende so wenig wie ein ' +
	'neuer. Sonst bleibt es beim Mehr dieser Karte (Rz. 69 ad Art. 712s). ' +
	// Laien L-10: der nächste Schritt, wenn der laufende Vertrag sie gibt; Runde 2: wessen Vertrag
	// (Laien VK-L-7), Beschluss und Annahme durch die Bewirtschaftung (Fach F2-6).
	'Wählen Sie die bisherige Bewirtschaftung wieder und stehen die Kompetenzen in ihrem laufenden Vertrag, ' +
	'beschliessen Sie im Traktandum der Rücknahme auch die Änderung des Vertrags. ' +
	// Runde 3 (Laien VK2-L-5): «muss sie annehmen» las sich gegen «Lehnt sie ab»; vor der Versammlung wegen der Vollmachten.
	'Die Änderung gilt nur, wenn die Bewirtschaftung zustimmt; lassen Sie sich das vor der Versammlung schriftlich ' +
	'bestätigen (Rz. 71 ad Art. 712s; Rz. 127 ad Art. 712q). ' +
	'Lehnt sie ab, bleibt es für die Wahl beim Mehr dieser Karte.';

/** Die Sätze zur Bedienung von Votum, wie in der Fassung 2026-11-21. */
export const RUECKNAHME_IN_VOTUM =
	'Gibt auch kein Vertrag ihr solche Kompetenzen, legen Sie das Wahltraktandum ' +
	'auf die Karte «Bewirtschaftung wählen». Beantworten Sie dort die Frage nach den Kompetenzen mit Nein, obwohl ' +
	'die Bewirtschaftung sie bis zur Rücknahme noch hat; der Hinweis jener Karte auf diese gilt dann nicht. Wird ' +
	'die Rücknahme abgelehnt, wechseln Sie für die Wahl zurück auf diese Karte; dann gilt ihr Mehr.';

/** Dasselbe auf der Website, wo niemand ein Traktandum auf eine Karte legt (Fach F-5, Laien L-5). */
export const RUECKNAHME_AUF_DER_WEBSITE =
	'Gibt auch kein Vertrag ihr solche Kompetenzen, gilt für die Wahl das einfache Mehr der Karte «Bewirtschaftung ' +
	'wählen», obwohl sie die Kompetenzen bis zur Rücknahme noch hat. Wird die Rücknahme abgelehnt, gilt für die ' +
	'Wahl das Mehr dieser Karte.';

export const RUECKNAHME_SCHLUSS =
	'Sagen Sie das ' +
	'schon in der Einladung, und holen Sie für diesen Fall vor der Versammlung Vollmachten ein. Nach der Rücknahme ' +
	'entscheidet über solche Geschäfte wieder die Versammlung. Soll die Bewirtschaftung später wieder mehr dürfen, ' +
	'braucht das einen eigenen Beschluss mit dem Mehr, das der Hinweis davor für die Übertragung nennt. Für Befugnisse ' +
	'statt der Versammlung ist das die Einstimmigkeit. Der Vertrag allein genügt nicht. Was ihr aus dem laufenden ' +
	'Vertrag zusteht, etwa ihr Honorar, bleibt vorbehalten (Rz. 72 ad Art. 712s).';

export const RUECKNAHME_VOR_DER_WAHL = `${RUECKNAHME_ANFANG} ${RUECKNAHME_IN_VOTUM} ${RUECKNAHME_SCHLUSS}`;
export const RUECKNAHME_WEBSITE = `${RUECKNAHME_ANFANG} ${RUECKNAHME_AUF_DER_WEBSITE} ${RUECKNAHME_SCHLUSS}`;

/** Der Satz zum Antrag über die Arbeit an den Karten zur Bezahlung aus dem Fonds (Fach F-3). */
export const BEZAHLUNG_VORHER =
	'Sagen Sie in deren Antrag, wie sie bezahlt wird, wenn die Bezahlung aus dem Fonds nicht zustande kommt.';
export const BEZAHLUNG =
	'Sagen Sie in deren Antrag, wie sie bezahlt wird, wenn die Bezahlung aus dem Fonds nicht zustande kommt oder ' +
	'angefochten ist.';
/** Die Karten, an denen der Satz steht. */
export const BEZAHLUNG_KARTEN = [ENTNAHME_ID, VEREINBART_ID, AUSSERHALB_ID];

/**
 * **Nur für den Website-Abzug:** was an drei Karten trotz einem Gesuch nicht warten darf,
 * als eigener Satz direkt nach dem Kernsatz K (`WARTEZEIT_K` der Fassung 2026-11-21, der
 * zeichengleich bleibt). Die Anwendung trägt K an diesen Karten nicht; sie sagt dort
 * weiter «wenn die Sache nicht dringlich ist». Angehängt in `mitWartezeit`
 * (`scripts/quorumsbaum-export.mjs`).
 */
export const NACH_K: Readonly<Record<string, string>> = {
	// Fach F-1, Laien L-1: Fristen des Gerichts, Verwirkung beim Pfandrecht, Verjährung;
	// die Ermächtigung lässt sich nachholen (Rz. 79 ad Art. 712t).
	'k-prozessfuehrung':
		// Runde 2, Laien VK-L-2: nicht die Anfechtungsfrist.
		'Bei einem Prozess ist die Sache dringlich, sobald die Gemeinschaft selbst eine Frist einhalten muss oder ' +
		'eine Forderung zu verjähren droht. ' +
		'Fristen setzt etwa das Gericht für die Klageantwort und für die Klage nach einer vorläufigen Eintragung des ' +
		'Pfandrechts (ZPO Art. 222 Abs. 1; ZGB Art. 961 Abs. 3). Dann führt die Bewirtschaftung den Prozess, auch wenn ein Gesuch gegen die ' +
		'Ermächtigung eingegangen ist. ' +
		// Runde 2, Fach F2-3: «in der Regel» gehört zur Frist, nicht zum Gelingen; die Folge, wenn es misslingt.
		'Hebt ein Gericht die Ermächtigung später auf, gibt das Gericht des Prozesses in der Regel eine Frist, sie ' +
		'nachzuholen (ZPO Art. 132 Abs. 1; SVIT-Kommentar Rz. 79 ad Art. 712t). ' +
		// Runde 3 (Laien VK2-L-1): «Sonst» hing an «nach jeder Zählweise».
		'Berufen Sie die Versammlung dafür sofort ein, und fassen Sie den neuen Beschluss so, dass er nach jeder ' +
		'Zählweise trägt. Kommt innert der Frist keine gültige Ermächtigung zustande, gilt die Eingabe als nicht ' +
		'erfolgt. ' +
		// Runde 4 (Fach F4-2): Rz. 79 meint den Verwalter, der ohne Ermächtigung handelt; der Ersatz ist offen.
		'Die Kosten können dann die Bewirtschaftung treffen (SVIT-Kommentar Rz. 79 ad Art. 712t); ob die ' +
		'Gemeinschaft sie ihr ersetzen muss, ist offen (OR Art. 402 Abs. 1).',
	// Fach F-2, Laien L-2: was ausführen bei einer Wahl heisst, der feste Termin, die Abwicklung
	// einer aufgehobenen Wahl (Rz. 124 f. ad Art. 712q) und welche Bewirtschaftung man nach Post fragt.
	'k-bewirtschaftung-waehlen-erweitert':
		'Bei einer Wahl heisst ausführen: den Vertrag mit der Gewählten schliessen und sie antreten lassen. Setzen ' +
		'Sie die Wahl deshalb so früh an, dass Frist und Wartezeit vor dem Wechsel ablaufen. Kann der Wechsel nicht ' +
		'warten, etwa weil der Vertrag der bisherigen Bewirtschaftung endet, ist die Sache dringlich. Dann tritt die ' +
		'Gewählte an, auch wenn ein Gesuch gegen die Wahl eingegangen ist. ' +
		// Runde 2, Fach F2-4.
		// Runde 3 (Laien VK2-L-4): wer handelt.
		'Vereinbaren Sie mit ihr schriftlich, dass sie Kompetenzen über die gewöhnliche Verwaltung hinaus bis zum ' +
		'Abschluss des Verfahrens nur nutzt, wo es eilt. Wird die Wahl später aufgehoben, werden ' +
		'ihre Leistungen bis dahin nach Vertragsrecht abgegolten (SVIT-Kommentar Rz. 125 ad Art. 712q). ' +
		// Runde 2, Fach F2-5 (ZGB Art. 712t Abs. 3).
		'Nach Post fragen Sie die Bewirtschaftung, die gerade im Amt ist, nach dem Wechsel auch die bisherige. ' +
		'Antwortet eine nicht oder nicht sicher, fragen Sie bei der Schlichtungsbehörde am Ort der Liegenschaft nach.',
	// Fach F-3, Laien L-3: Warten muss die Bezahlung, nicht die Arbeit; fällige Rechnungen.
	'k-erneuerungsfonds-entnahme':
		// Runde 2, Fach F2-1 und Laien VK-L-4: nur bei getrennter Abstimmung, und die Arbeit hat ihre eigene Frist.
		'Wurde über Arbeit und Bezahlung getrennt abgestimmt, muss hier nur die Bezahlung aus dem Fonds warten. Ob ' +
		'und wie lange die Arbeit warten muss, sagt die Karte zu ihrem eigenen Beschluss (Antwort «Über die Arbeit ' +
		'selbst»). Stand beides in einem einzigen Antrag, ist mit der Bezahlung auch die Arbeit angefochten, und das ' +
		'Warten gilt für beide. Fällige Rechnungen bezahlen Sie trotzdem fristgerecht, so, wie es der Antrag über die ' +
		'Arbeit für diesen Fall vorsieht (unter «Gut zu wissen»). ' +
		// Runde 2, Fach F2-2: frühere Anträge ohne diese Klausel; der zweite Satz ist Folgerung aus Rz. 234 ad Art. 712m.
		'Sieht er dafür nichts vor, gehört die Bezahlung fälliger Rechnungen aus dem Fonds zu dem, was eilt. Wird die ' +
		// Runde 3 (Fach F3-2): beim einzigen Antrag auch die Arbeit.
		'Bezahlung später aufgehoben, muss die Versammlung neu beschliessen, wie die Arbeit bezahlt wird, bei einem ' +
		'einzigen Antrag auch über die Arbeit selbst.'
};

/**
 * Was an der Prozessführung dringlich ist, in der Begründung (Runde 2, Laien VK-L-1): Sonst
 * erführe die Leserin es erst nach dem ganzen Kernsatz K, und in Votum gar nicht. Runde 3: mit
 * dem ersten Kriterium aus Rz. 78 ad Art. 712t, die Versammlung kann nicht rechtzeitig
 * entscheiden (Fach F3-1); direkt nach dem Eilweg und vor dem Satz zum Nein, der die Verwaltung
 * jetzt ausdrücklich nennt (Laien VK2-L-3). Die Website trägt den Satz zum Nein ab hier auch
 * (Fach F3-1, Laien VK2-L-2): Eilweg, Dringlichkeit, Nein, in Anwendung und Website gleich.
 */
export const DRINGLICH_PROZESS =
	'Dringlich ist es etwa, wenn eine Frist des Gerichts oder die Verjährung abläuft, bevor die Versammlung ' +
	'entscheiden kann (SVIT-Kommentar Rz. 78 ad Art. 712t).';
export const NACH_EINEM_NEIN = 'Nach einem Nein der Versammlung darf die Verwaltung so in der Regel nicht handeln.';
export { EILWEG_VORHER, EILWEG_GESETZ };
export const EILWEG = `${EILWEG_GESETZ} ${DRINGLICH_PROZESS} ${NACH_EINEM_NEIN}`;

/** Ersetzt in jedem Text des Regelwerks und zählt, wie oft (wie in der Fassung 2026-11-21). */
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

const widerruf = { n: 0 };
const ruecknahme = { n: 0 };
const bezahlung = { n: 0 };
const eilweg = { n: 0 };
const ERSETZT = ersetzeUeberall(
	ersetzeUeberall(
		ersetzeUeberall(ersetzeUeberall(VOR, WIDERRUF_VORHER, WIDERRUF, widerruf), RUECKNAHME_VORHER, RUECKNAHME_VOR_DER_WAHL, ruecknahme),
		BEZAHLUNG_VORHER,
		BEZAHLUNG,
		bezahlung
	),
	EILWEG_VORHER,
	EILWEG,
	eilweg
);
if (eilweg.n !== 1 || ERSETZT.knoten.find((k) => k.id === 'k-prozessfuehrung')?.begruendung?.endsWith(EILWEG) !== true) {
	throw new Error(`Fassung 2026-11-22: Der Eilweg steht ${eilweg.n}-mal statt einmal am Ende der Begründung von «k-prozessfuehrung».`);
}
if (widerruf.n !== STELLEN) {
	throw new Error(`Fassung 2026-11-22: Der Widerruf steht ${widerruf.n}-mal statt ${STELLEN}-mal.`);
}
if (ruecknahme.n !== 1 || ERSETZT.knoten.find((k) => k.id === WAEHLEN_ERWEITERT_ID)?.hinweise?.at(-1) !== RUECKNAHME_VOR_DER_WAHL) {
	throw new Error(`Fassung 2026-11-22: Der Hinweis zur Rücknahme steht ${ruecknahme.n}-mal statt einmal am Schluss von «${WAEHLEN_ERWEITERT_ID}».`);
}
const mitBezahlung = ERSETZT.knoten.filter((k) => (k.hinweise ?? []).some((h) => h.includes(BEZAHLUNG))).map((k) => k.id);
if (bezahlung.n !== BEZAHLUNG_KARTEN.length || mitBezahlung.join() !== BEZAHLUNG_KARTEN.join()) {
	throw new Error(`Fassung 2026-11-22: Der Satz zum Antrag über die Arbeit steht ${bezahlung.n}-mal, an ${mitBezahlung.join(', ')}.`);
}
for (const id of Object.keys(NACH_K)) {
	if (!ERSETZT.knoten.some((k) => k.id === id)) throw new Error(`Fassung 2026-11-22: Die Karte «${id}» fehlt.`);
}

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-21, wie er in dieser Fassung lautet:
 * die Ersetzungen der Vorfassungen und die dieser Fassung. Für den Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	return nachDerVorfassung(text)
		.split(WIDERRUF_VORHER)
		.join(WIDERRUF)
		.split(RUECKNAHME_VORHER)
		.join(RUECKNAHME_VOR_DER_WAHL)
		.split(BEZAHLUNG_VORHER)
		.join(BEZAHLUNG)
		.split(EILWEG_VORHER)
		.join(EILWEG);
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_22 = {
	...ERSETZT,
	fassung: '2026-11-22',

	freigabevermerk:
		VOR.freigabevermerk +
		' In der Fassung 2026-11-22 sagt der Hinweis zur Wahl der Bewirtschaftung zuerst, wann für die Rücknahme ' +
		'einer Übertragung das einfache Mehr genügt, und der Hinweis zur Rücknahme vor der Wahl, dass eine ' +
		'Übertragung im Reglement oder im Begründungsakt mehr verlangt. Bei der Bezahlung aus dem Erneuerungsfonds ' +
		'nennt der Hinweis zum Antrag über die Arbeit auch den Fall, dass die Bezahlung angefochten ist, und an der ' +
		'Ermächtigung zur Prozessführung sagt die Begründung, was dringlich ist.'
} satisfies Regelwerk;
