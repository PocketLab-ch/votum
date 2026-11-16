/**
 * Die Version der Anwendung ist der Abbild-Tag (Entscheid 0053, 16.11.2026).
 *
 * **Eine Kennung, die es schon gab.** `scripts/abbild-bauen.sh` bildet ihn aus
 * Datum, Uhrzeit und Commit (`20261116-0854-854363d4`) und reicht ihn als
 * `VOTUM_VERSION` ins Abbild. Derselbe Name steht am Betrieb, im
 * Abschlusspaket und als Tag des Stands auf Codeberg, damit man ihn wörtlich
 * suchen kann. `package.json` trägt keine Version, die gelesen wird.
 *
 * Rein: hinein geht der Wert der Umgebung, heraus die Version oder `null`.
 */

/** Der Abbild-Tag: Datum, Uhrzeit, kurzer Commit; `-lokal`, wenn der Baum vom Commit abwich. */
export const ABBILD_TAG = /^\d{8}-\d{4}-(?:[0-9a-f]{7,40}|ohne-git)(?:-lokal)?$/;

/** Was die Fusszeile zeigt, wenn keine Version gesetzt ist: ein Lauf aus dem Arbeitsbaum, kein ausgeliefertes Abbild. */
export const ENTWICKLUNGSSTAND = 'Entwicklungsstand';

/**
 * Was das Abschlusspaket ohne Version sagt. **Nicht «Entwicklungsstand»**
 * (Laienprüfung 16.11.2026): Im versiegelten Paket einer echten Versammlung
 * läse sich das wie «mit unfertiger Software gezählt», und die Zeile bleibt
 * für immer. Sie fehlt auch bei einem Abbild, das ohne das Skript gebaut wurde.
 */
export const OHNE_VERSIONSANGABE = 'ohne Versionsangabe';

/**
 * Die Version aus dem Wert der Umgebung, oder `null`.
 *
 * **Nur ein Abbild-Tag zählt.** Ein leerer oder fremder Wert ergäbe sonst eine
 * Version, die sich keinem Stand zuordnen lässt, und das Abschlusspaket
 * trüge sie als Beleg mit.
 */
export function versionAusUmgebung(wert: string | undefined | null): string | null {
	const v = (wert ?? '').trim();
	return ABBILD_TAG.test(v) ? v : null;
}

/** Die Angabe für Menschen: «Version <tag>» oder «Entwicklungsstand». */
export function versionInWorten(version: string | null): string {
	return version ? `Version ${version}` : ENTWICKLUNGSSTAND;
}

/**
 * Die Angabe `anwendung` eines Manifests in Worten, oder `null`.
 *
 * **Ein eingespieltes Paket kommt von aussen** und ist nur gecastet: Fehlt
 * das Feld (Paket von vor Entscheid 0053) oder hat es eine fremde Form, steht
 * nichts da, statt «undefined» oder eines erfundenen Werts.
 */
export function anwendungInWorten(anwendung: unknown): string | null {
	if (!anwendung || typeof anwendung !== 'object') return null;
	const a = anwendung as { name?: unknown; version?: unknown };
	if (typeof a.name !== 'string' || !a.name.trim()) return null;
	const version = typeof a.version === 'string' && a.version.trim() ? a.version.trim() : null;
	return `${a.name.trim()}, ${version ? `Version ${version}` : OHNE_VERSIONSANGABE}`;
}
