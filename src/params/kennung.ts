/**
 * Prüft, ob ein Adressteil überhaupt eine Kennung sein kann.
 *
 * **Warum das nötig ist.** Ohne diese Prüfung landet jeder Tippfehler in der
 * Adresse als Zeichenkette in einer Abfrage, und PostgreSQL antwortet mit
 * «invalid input syntax for type uuid». Die Anwendung meldet dann einen
 * Serverfehler samt Datenbankmeldung im Protokoll — für eine Adresse, die es
 * einfach nicht gibt. Richtig ist: nicht gefunden.
 *
 * Gefunden beim Ende-zu-Ende-Durchlauf, der `/versammlungen/neu` aufrief. Diese
 * Adresse gibt es nicht (angelegt wird unter der Gemeinschaft), und statt eines
 * sauberen 404 kam ein 500 mit Datenbankfehler.
 *
 * Greift der Prüfer nicht, wird die Route gar nicht erst betreten — SvelteKit
 * antwortet mit 404, ohne dass eine Abfrage läuft.
 */
const KENNUNG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function match(wert: string): boolean {
	return KENNUNG.test(wert);
}
