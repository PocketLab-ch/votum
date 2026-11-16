/**
 * Die Weisung — das Bindeglied zwischen Hausbeschluss und MEG-Stimme
 * (Stories 7.3 und 7.4, AD-1).
 *
 * **Warum es sie gibt.** In der Umgebungs-MEG haben die Mitglieder je eine
 * Stimme, ausgeübt durch einen bezeichneten Vertreter (Art. 7 Ziff. 3). Der
 * Vertreter entscheidet nicht, er überbringt. Was er überbringt, ist das
 * Abstimmungsergebnis seines Hauses.
 *
 * **Ein Mechanismus, nicht zwei.** Ob die Häuser getrennt tagen oder alle am
 * selben Abend, ändert nur, *wann* die Hausabstimmung stattfindet — nicht *ob*.
 * Getrennt entsteht die Weisung Wochen vorher, gemeinsam Minuten vorher; der
 * Weg von der Hausabstimmung zur MEG-Stimme ist derselbe.
 *
 * Rein: hinein geht die Lage, heraus kommt der Befund. Kein Zugriff auf
 * Datenbank oder Uhr.
 */
import type { Id } from './types';

/** Wie das Haus seinen Vertreter angewiesen hat. */
export type Haltung = 'ja' | 'nein' | 'enthaltung' | 'frei';

/** Woher die Weisung stammt. Mehr Herkünfte gibt es nicht. */
export type Weisungsherkunft =
	/** Aus einem Beschluss des Hauses, mit Verweis auf den Durchgang. */
	| 'beschluss'
	/** Schriftlich festgehalten, ohne Versammlung — Zirkularweg, Ausschuss. */
	| 'erklaerung'
	/**
	 * Die Anwendung hat die Weisung selbst nach der Auffangregel der
	 * Weisungsregel gesetzt, weil das Haus nicht beschlossen hat
	 * (Produktentscheid 08.10.2026, `server/weisung.ts`, `trageOhneBeschlussEin`).
	 * Eigener Wert, nicht `erklaerung`: Dort hat niemand etwas erklärt, und im
	 * Abschlusspaket soll «nach der Auffangregel der Anwendung» stehen statt
	 * «ohne Beleg» — die Grundlage ist die Regel, nicht eine Bemerkung.
	 */
	| 'auffangregel'
	/** Das Haus überlässt dem Vertreter den Entscheid. */
	| 'frei';

export interface Weisung {
	id: Id;
	traktandumId: Id;
	parteiId: Id;
	haltung: Haltung;
	herkunft: Weisungsherkunft;
	quelleVersammlungId: Id | null;
	quelleDurchgangId: Id | null;
	bemerkung: string | null;
	erfasstAm: string;
	erfasstVon: string | null;
}

/** Eine Mitgliedsgemeinschaft, die zu einem Traktandum eine Weisung geben muss. */
export interface Weisungspflichtige {
	parteiId: Id;
	name: string;
	/** Wer die Stimme abgibt. Null, wenn niemand bezeichnet ist. */
	vertreter: string | null;
}

export interface Weisungslage {
	pflichtige: Weisungspflichtige[];
	weisungen: Weisung[];
	/**
	 * Häuser, für die die Sitzungsleitung ausdrücklich festgehalten hat, dass
	 * keine Weisung vorliegt. Sie zählen dann als nicht vertreten — **nicht** als
	 * Enthaltung. Der Unterschied ist erheblich, weil die Bezugsgrösse davon
	 * abhängt (AD-15).
	 */
	ohneWeisung?: Id[];
}

export interface Weisungsbefund {
	/** Je Pflichtiger die geltende Weisung, oder null. */
	stand: { parteiId: Id; name: string; vertreter: string | null; weisung: Weisung | null }[];
	vorliegend: number;
	erwartet: number;
	/** Namen der Häuser, von denen weder Weisung noch Vermerk vorliegt. */
	fehlend: string[];
	/** Wahr, wenn das Traktandum eröffnet werden darf. */
	vollstaendig: boolean;
}

/**
 * Was zu einem weisungsgebundenen Traktandum vorliegt und was fehlt.
 *
 * Die Vollständigkeit ist die Schranke vor dem Eröffnen: Eine MEG-Abstimmung
 * ohne die Weisungen ihrer Mitglieder wäre eine Abstimmung der Vertreter nach
 * eigenem Gutdünken — und damit angreifbar, weil Art. 7 Ziff. 3 die Stimme den
 * beteiligten Stockwerkeigentümern zuweist und nicht dem Vertreter.
 */
export function pruefeWeisungen(lage: Weisungslage): Weisungsbefund {
	const ohne = new Set(lage.ohneWeisung ?? []);
	// Die geltende Weisung ist die nicht überholte; überholte kommen gar nicht
	// erst herein (der Server filtert), aber die letzte gewinnt, falls doch.
	const je = new Map<Id, Weisung>();
	for (const w of lage.weisungen) je.set(w.parteiId, w);

	const stand = lage.pflichtige.map((p) => ({
		parteiId: p.parteiId,
		name: p.name,
		vertreter: p.vertreter,
		weisung: je.get(p.parteiId) ?? null
	}));

	const fehlend = stand
		.filter((s) => s.weisung === null && !ohne.has(s.parteiId))
		.map((s) => s.name);

	return {
		stand,
		vorliegend: stand.filter((s) => s.weisung !== null).length,
		erwartet: lage.pflichtige.length,
		fehlend,
		vollstaendig: fehlend.length === 0
	};
}

/**
 * Die Haltung, die sich aus einem Hausbeschluss ergibt.
 *
 * Angenommen heisst Ja, abgelehnt heisst Nein. Die Anwendung **leitet ab und
 * rechnet nicht nach**: Das Haus hat über denselben Antrag abgestimmt, und sein
 * Ergebnis steht bereits fest — es hier ein zweites Mal auszuzählen hiesse, eine
 * zweite Wahrheit zu erzeugen, die eines Tages von der ersten abweicht.
 */
export function haltungAusBeschluss(angenommen: boolean): Haltung {
	return angenommen ? 'ja' : 'nein';
}

/**
 * Die Weisung in einem Satz, für Weisungsseite und Weisungsblatt.
 *
 * Nennt die Herkunft mit, weil sie den Beweiswert bestimmt: Ein Verweis auf
 * einen Beschluss ist belegt, ein schriftlicher Vermerk ist nur so stark wie
 * seine Bemerkung, und «frei» heisst, dass niemand angewiesen hat.
 * «Festgehalten» statt «erklärt», weil die Anwendung die Weisung auch selbst
 * nach der Auffangregel des Hauses setzt (`server/weisung.ts`,
 * `trageOhneBeschlussEin`); dort hat niemand etwas erklärt, die Bemerkung
 * nennt die Grundlage.
 */
export function weisungInWorten(w: Weisung | null, name: string): string {
	if (!w) return `${name}: keine Weisung.`;
	if (w.herkunft === 'frei') {
		return `${name}: nach freiem Ermessen des Vertreters — das Haus hat keine Richtung vorgegeben.`;
	}
	const richtung =
		w.haltung === 'ja' ? 'Ja' : w.haltung === 'nein' ? 'Nein' : 'Enthaltung';
	if (w.herkunft === 'beschluss') {
		return `${name}: ${richtung}, gestützt auf den Beschluss des Hauses.`;
	}
	return `${name}: ${richtung}, schriftlich festgehalten${w.bemerkung ? ` — ${w.bemerkung}` : '.'}`;
}
