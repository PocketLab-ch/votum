/**
 * Lange Hilfetexte im Entscheidbaum: ein sichtbarer Anfang und der Rest unter
 * «Mehr dazu» (Produktentscheid 26.09.2026).
 *
 * **Der Anlass.** Die Hilfe zur Frage `f1-4` ging durch drei Runden Laien- und
 * Fachprüfung und wuchs dabei auf rund 1600 Zeichen; die bisher längste im
 * Baum hatte 470. Sie stand als ein Block vor drei Knöpfen. Auf die Frage, ob
 * man kürzen soll: nicht den geprüften Wortlaut, sondern die Darstellung. Der
 * Text bleibt Wort für Wort, wie er geprüft ist; er wird nur an einer
 * Satzgrenze geteilt.
 *
 * **Eine Stelle für Votum und die Website.** Der Export für den Quorenfinder
 * (`scripts/quorumsbaum-export.mjs`) ruft dieselbe Funktion und liefert beide
 * Teile mit. Rechnete die Website selbst, könnten beide an verschiedenen
 * Stellen trennen, und niemand sähe es.
 *
 * **Nur an echten Satzgrenzen.** Rechtstexte sind voller Punkte, die keinen
 * Satz beenden: «Art. 647e», «Abs. 2», «Rz. 135», «z. B.». Ein Anfang, der
 * mitten in einer Fundstelle aufhört, wäre schlimmer als gar keine Teilung.
 * Und nicht innerhalb einer Hervorhebung (`**…**`): Die Website setzt sie in
 * `<strong>` um, und ein halbes Tag bräche die Darstellung.
 */

import { zeichenzahl } from './zeichenzahl';

/** Bis zu dieser Länge bleibt eine Hilfe ganz; sie ist dann kein Block. */
export const HILFE_GANZ_BIS = 500;

/**
 * So lang wird der sichtbare Anfang mindestens, bevor geteilt wird.
 *
 * **450 und nicht weniger:** Bei der Hilfe zu `f1-4` endete der Anfang mit 350
 * nach der zweiten von drei Bedingungen, und die dritte stand im Aufklapper.
 * Eine Aufzählung, die zusammen gelesen werden muss, gehört ganz in den
 * Anfang; die Probe in `tests/domain/hilfetext.test.ts` hält das fest.
 */
export const HILFE_ANFANG_MINDESTENS = 450;

/** Ist der Rest kürzer, lohnt der Aufklapper nicht; dann bleibt alles sichtbar. */
export const HILFE_REST_MINDESTENS = 120;

/**
 * Wörter, nach denen ein Punkt keinen Satz beendet. Klein geschrieben
 * verglichen. «S.» und «E.» stehen für Seite und Erwägung.
 */
const ABKUERZUNGEN = new Set([
	'art',
	'abs',
	'rz',
	'ziff',
	'lit',
	'vgl',
	'bzw',
	'z',
	'b',
	's',
	'e',
	'erw',
	'nr',
	'ca',
	'u',
	'a',
	'm',
	'al',
	'bger',
	'bge',
	// Nachgetragen nach der Codeprüfung vom 26.09.2026: «ff.», «i. V. m.»,
	// «d. h.», «Bst.», «St. Gallen» und ähnliche teilten sonst mitten im Satz.
	'ff',
	'bst',
	'i',
	'v',
	'd',
	'h',
	'st',
	'sog',
	'gem',
	'resp',
	'inkl',
	'dr',
	'prof'
]);

/** Nach einer Zahl mit Punkt vor einem Monat steht ein Datum, kein Satzende. */
const MONATE =
	/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/;

export interface GeteilteHilfe {
	/** Was sichtbar steht. */
	anfang: string;
	/** Was unter «Mehr dazu» steht, oder `null`, wenn die Hilfe ganz bleibt. */
	mehr: string | null;
}

/**
 * Die Stellen, an denen ein Satz endet: Index des ersten Zeichens des
 * nächsten Satzes.
 */
function satzanfaenge(text: string): number[] {
	const anfaenge: number[] = [];
	// Satzzeichen, dann schliessende Zeichen (Hervorhebung, Guillemet, Klammer),
	// dann Leerraum, dann ein Satzanfang (Grossbuchstabe, Guillemet, Hervorhebung).
	const muster = /[.!?](\*\*|»|\))*\s+(?=[«*A-ZÄÖÜ])/g;
	for (const treffer of text.matchAll(muster)) {
		const ende = treffer.index!;
		const wort = /([A-Za-zÄÖÜäöü]+)$/.exec(text.slice(0, ende))?.[1]?.toLowerCase();
		if (wort && ABKUERZUNGEN.has(wort)) continue;
		const naechster = ende + treffer[0].length;
		if (/\d$/.test(text.slice(0, ende)) && MONATE.test(text.slice(naechster))) continue;
		// Nicht innerhalb einer Hervorhebung.
		if ((text.slice(0, naechster).match(/\*\*/g) ?? []).length % 2 !== 0) continue;
		anfaenge.push(naechster);
	}
	return anfaenge;
}

/**
 * Teilt eine Hilfe in Anfang und Rest. Der Text bleibt vollständig:
 * `anfang + ' ' + mehr` ergibt ihn bis auf den Leerraum an der Nahtstelle.
 */
export function teileHilfe(text: string): GeteilteHilfe {
	const ganz = { anfang: text, mehr: null };
	if (zeichenzahl(text) <= HILFE_GANZ_BIS) return ganz;
	const naht = satzanfaenge(text).find(
		(i) => zeichenzahl(text.slice(0, i)) >= HILFE_ANFANG_MINDESTENS
	);
	if (naht === undefined) return ganz;
	const anfang = text.slice(0, naht).trimEnd();
	const mehr = text.slice(naht).trim();
	if (zeichenzahl(mehr) < HILFE_REST_MINDESTENS) return ganz;
	return { anfang, mehr };
}
