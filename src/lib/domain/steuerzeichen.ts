/**
 * Das NUL-Zeichen in einer Eingabe, das PostgreSQL in Text nicht speichern kann.
 *
 * **Der Befund** (Codeprüfung zu B2, 16.10.2026; gemessen am Dev-Stapel am
 * 27.10.2026). Ein `%00` in einem Formularfeld oder Suchparameter kommt
 * dekodiert als U+0000 an, und PostgreSQL lehnt es in `text` mit 22021 ab
 * («invalid byte sequence for encoding UTF8: 0x00»). `uebersetzeSchranke` in
 * `server/db.ts` macht daraus einen Satz, aber nur in einer Transaktion des
 * Betreibers; was daran vorbeiläuft, gab 500: `POST /anmelden` mit
 * `username=a%00b` **ohne Anmeldung**, `/verlauf?suche=%00` angemeldet.
 *
 * **Deshalb am Eingang und nicht an der Datenbank.** Der Wächter in
 * `hooks.server.ts` sagt ab, bevor eine Route den Wert sieht, in Suchteil,
 * Pfad und Rumpf. Der Satz ist derselbe wie in `uebersetzeSchranke`, damit
 * dasselbe Zeichen nicht zwei Erklärungen bekommt.
 *
 * Ein echter Text braucht das Zeichen nie; es entsteht nur beim Einfügen aus
 * einer Binärquelle oder absichtlich.
 */

const NUL = '\u0000';

/** Trägt der Wert irgendwo ein NUL-Zeichen, auch in Schlüsseln und verschachtelt? */
export function enthaeltNul(wert: unknown): boolean {
	if (typeof wert === 'string') return wert.includes(NUL);
	if (Array.isArray(wert)) return wert.some(enthaeltNul);
	if (wert !== null && typeof wert === 'object') {
		return Object.entries(wert).some(([schluessel, inhalt]) => schluessel.includes(NUL) || enthaeltNul(inhalt));
	}
	return false;
}

export const EINGABE_MIT_NUL =
	'Eine Ihrer Eingaben enthält ein Zeichen, das sich nicht speichern lässt — meist ein ' +
	'unsichtbares Steuerzeichen aus einem kopierten Text. Tippen Sie sie neu.';
