/**
 * Die Adresse, unter der die Anwendung von aussen erreichbar ist (Audit B-15).
 *
 * `ORIGIN` ist dieselbe Variable, die adapter-node auswertet — es gibt also
 * genau einen Schalter und nicht zwei. Ausgewertet wird sie hier **zusätzlich in
 * der Anwendung selbst**, weil der Entwicklungsserver sie nicht kennt: Ein
 * Eintrag, der nur im gebauten Stand wirkt, wäre für den Betrieb auf einem
 * Notebook im Versammlungsraum der falsche Trost.
 *
 * Die Entscheidung selbst steht rein in `$lib/domain/herkunft` (AD-1); hier wird
 * nur gelesen.
 */
import { env } from '$env/dynamic/private';
import { oeffentlicheHerkunft } from '$lib/domain/herkunft';

export function herkunft(url: URL): string {
	return oeffentlicheHerkunft(env.ORIGIN, url.origin);
}

/**
 * Die feste Adresse allein — für Wege ohne Anfrage.
 *
 * Der Zeitgeber schreibt Links in Mails und hat kein `url`, aus dem sich eine
 * Herkunft ableiten liesse. Ohne feste Angabe gibt es hier deshalb keinen
 * Rückfall, sondern `null`: Ein geratener Absender in einer Mail wäre schlimmer
 * als ein fehlender Link.
 *
 * **Denselben Schalter lesen, nicht einen zweiten anlegen** (Code-Review
 * 02.09.2026). Die erste Fassung des Erinnerungslaufs las `process.env.ORIGIN`
 * direkt und normalisierte den Schrägstrich selbst nach. Wo `ORIGIN` nur über
 * eine von Vite geladene `.env` ankommt und nicht als echte Umgebungsvariable,
 * hätten QR-Codes die richtige Adresse getragen und die Erinnerung keine.
 */
export function festeHerkunft(): string | null {
	const fest = (env.ORIGIN ?? '').trim();
	return fest === '' ? null : oeffentlicheHerkunft(fest, '');
}
