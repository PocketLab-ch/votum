/**
 * Was ein Kennwort taugen muss (AD-1).
 *
 * **Der Anlass.** Bis zum 13.08.2026 liess sich ein Kennwort nur über
 * `scripts/benutzer-anlegen.mjs` setzen — die Anwendung selbst rief
 * `kennwortAbleiten()` an keiner Stelle auf. Ein Wechsel verlangte damit einen
 * Zugang zur Kommandozeile des Servers, und in der Praxis heisst das: Es wird
 * nicht gewechselt.
 *
 * **Länge vor Zeichenarten.** Keine Vorschrift über Grossbuchstaben, Ziffern und
 * Sonderzeichen. Sie erzeugen `Sommer2026!` — zwölf Zeichen, jede Regel
 * erfüllt, und in jeder Wörterbuchliste. Was wirklich trägt, ist Länge; das ist
 * seit Jahren auch die Empfehlung des NIST (SP 800-63B) und des BSI. Die
 * Untergrenze liegt deshalb bei **zwölf Zeichen** wie im Anlegeskript, und
 * darüber steht der Rat, eine Wortfolge zu nehmen.
 *
 * **Drei Dinge werden trotzdem abgewiesen**, weil sie nichts mit Geschmack zu
 * tun haben, sondern mit dem ersten Versuch eines Angreifers: der eigene
 * Benutzername, der Anzeigename, und ein Kennwort aus lauter demselben Zeichen.
 */
import { FachlicherFehler } from './gemeinschaft';
import { zeichenzahl } from './zeichenzahl';

/** Untergrenze in Zeichen. Dieselbe wie im Anlegeskript. */
export const MINDESTLAENGE = 12;

/** Obergrenze, damit eine Ableitung nicht zum Rechenangriff wird. */
export const HOECHSTLAENGE = 200;

export interface Kennwortumfeld {
	benutzername?: string | null;
	anzeigename?: string | null;
}

/**
 * Prüft ein neues Kennwort und gibt es unverändert zurück.
 *
 * Wirft mit einem Satz, der sagt, **was zu tun ist** — nicht mit einer Regel.
 * «Mindestens 12 Zeichen, mindestens eine Ziffer» ist eine Vorschrift; «Nehmen
 * Sie eine Wortfolge, die Sie sich merken können» ist eine Anleitung.
 */
export function pruefeKennwort(
	kennwort: string,
	umfeld: Kennwortumfeld = {},
	feld = 'kennwort'
): string {
	if (zeichenzahl(kennwort) < MINDESTLAENGE) {
		throw new FachlicherFehler(
			'zu_kurz',
			`Das Kennwort braucht mindestens ${MINDESTLAENGE} Zeichen. Am einfachsten ist eine ` +
				'Wortfolge, die Sie sich merken können — Länge trägt mehr als Sonderzeichen.',
			feld
		);
	}
	if (zeichenzahl(kennwort) > HOECHSTLAENGE) {
		throw new FachlicherFehler(
			'zu_lang',
			`Das Kennwort darf höchstens ${HOECHSTLAENGE} Zeichen haben.`,
			feld
		);
	}

	const klein = kennwort.toLowerCase();
	for (const wert of [umfeld.benutzername, umfeld.anzeigename]) {
		const w = wert?.trim().toLowerCase();
		// zeichenzahl-frei: Teilzeichenkette für den Enthält-Test, keine Eingabeschranke.
		if (w && w.length >= 3 && klein.includes(w)) {
			throw new FachlicherFehler(
				'enthaelt_namen',
				'Das Kennwort enthält Ihren Namen. Genau das versucht ein Angreifer zuerst.',
				feld
			);
		}
	}

	if (new Set(kennwort).size < 4) {
		throw new FachlicherFehler(
			'zu_eintoenig',
			'Das Kennwort besteht aus zu wenigen verschiedenen Zeichen.',
			feld
		);
	}

	return kennwort;
}

/**
 * Prüft, dass die Wiederholung stimmt.
 *
 * Eigene Funktion, weil die Meldung eine andere ist: Hier ist nichts falsch am
 * Kennwort, es wurde nur zweimal verschieden getippt.
 */
export function verlangeGleich(kennwort: string, wiederholung: string): void {
	if (kennwort !== wiederholung) {
		throw new FachlicherFehler(
			'nicht_gleich',
			'Die beiden Eingaben stimmen nicht überein.',
			'wiederholung'
		);
	}
}
