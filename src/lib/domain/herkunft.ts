/**
 * Welche Adresse in einen Verweis gehört, der das Haus verlässt (Audit B-15, rein).
 *
 * **Der Unterschied zur Herkunft der Anfrage ist der Fall, in dem jemand lügt.**
 * Ohne feste Angabe leitet SvelteKit die Herkunft aus den Kopfzeilen ab. Ein
 * untergeschobenes `Host` ergibt dann eine fremde Adresse — und diese Adresse
 * landet nicht in einem Protokoll, sondern
 *
 *   * im QR-Code auf der Leinwand, den vierzehn Leute scannen,
 *   * auf den **gedruckten Zugangskarten** im Versandpaket,
 *   * im Rückweg der Anmeldung über Authentik.
 *
 * Eine gedruckte Karte lässt sich nicht zurückrufen. Deshalb ist die feste
 * Angabe hier nicht nur eine Härtung, sondern die einzige Fassung, die für
 * Papier taugt.
 */

/**
 * Die feste Angabe, wenn es eine gibt — sonst die Herkunft der Anfrage.
 *
 * Absichtlich **keine** Prüfung der festen Angabe auf Wohlgeformtheit: Wer sie
 * setzt, betreibt die Anlage, und ein stiller Rückfall auf die Anfrage wäre
 * genau die Überraschung, die diese Funktion verhindern soll. Ein Tippfehler
 * fällt beim ersten Aufruf auf, ein stiller Rückfall vielleicht nie.
 */
export function oeffentlicheHerkunft(gesetzt: string | undefined | null, ausAnfrage: string): string {
	const fest = (gesetzt ?? '').trim();
	// Ein Schrägstrich am Ende ergäbe sonst `https://haus.ch//e/xyz`.
	return fest === '' ? ausAnfrage : fest.replace(/\/+$/, '');
}
