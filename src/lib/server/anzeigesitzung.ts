/**
 * Die Sitzung der Präsentationssicht (Story 5.5, FR-35).
 *
 * **Warum der Keks hier den Code selbst trägt** — anders als beim Eigentümer.
 * Dort gibt es zwei Wege zum selben Zugang, und einer davon (der ausgegebene
 * Code) lässt sich nicht in einen Keks legen, weil der Server den Kartencode
 * nicht im Klartext kennt. Hier gibt es genau einen Weg: Jemand tippt den
 * Anzeigecode auf dem Beamer-Gerät ein. Der Server hat ihn in diesem Augenblick
 * ohnehin in der Hand, und jede Anfrage löst ihn neu auf.
 *
 * Das hat eine erwünschte Folge: Erzeugt die Sitzungsleitung einen neuen
 * Anzeigecode, hört der alte Keks von selbst auf zu wirken — es braucht keine
 * Liste von Sitzungen, die jemand aufräumen müsste.
 */
import type { Cookies } from '@sveltejs/kit';

export const ANZEIGE_COOKIE = 'versammlung_anzeige';

/** Nur auf `/p` — auf keiner anderen Seite hat er etwas zu suchen. */
export const ANZEIGE_PFAD = '/p';

/**
 * Wie lange der Keks gilt.
 *
 * Vierzehn Stunden: Der Beamer wird am Nachmittag aufgebaut und läuft bis zum
 * Ende des Abends. Die eigentliche Grenze ist ohnehin das Schliessen der
 * Versammlung — danach löst der Code nichts mehr auf.
 */
export const ANZEIGEDAUER_SEKUNDEN = 14 * 60 * 60;

export function setzeAnzeigeKeks(cookies: Cookies, code: string, sicher: boolean): void {
	cookies.set(ANZEIGE_COOKIE, code, {
		path: ANZEIGE_PFAD,
		httpOnly: true,
		sameSite: 'lax',
		// Im lokalen Betrieb im Versammlungsraum läuft die Verbindung über das
		// eigene WLAN; ohne Zertifikat wäre `secure` dort hinderlich.
		secure: sicher,
		maxAge: ANZEIGEDAUER_SEKUNDEN
	});
}

export function leseAnzeigeKeks(cookies: Cookies): string | null {
	return cookies.get(ANZEIGE_COOKIE) ?? null;
}

/** `sicher` wie beim Setzen, sonst bliebe der Keks über http stehen (A2). */
export function loescheAnzeigeKeks(cookies: Cookies, sicher: boolean): void {
	cookies.delete(ANZEIGE_COOKIE, { path: ANZEIGE_PFAD, secure: sicher });
}
