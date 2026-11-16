/**
 * Wohin eine Zwischenseite zurückführt.
 *
 * **Der Anlass, am 21.08.2026:** «Wenn ich in der laufenden Sitzung das Quorum
 * ändern möchte, komme ich auf den Quorumsfinder. Wenn ich die Mehrheit
 * festgelegt habe, lande ich in der Traktandenliste und nicht in der
 * Versammlung.»
 *
 * Dieselbe Seite wird von zwei Orten aus aufgerufen — aus der Vorbereitung und
 * aus dem Saal. Ein fester Rücksprung trifft immer nur einen davon.
 *
 * **Warum das nicht einfach übernommen wird, was in der Adresse steht.** Ein
 * Rückweg aus dem Netz ist Eingabe wie jede andere: Ohne Prüfung wäre die
 * Adresse ein Sprungbrett auf eine fremde Seite («offene Weiterleitung»). Hier
 * gilt deshalb ein enger Rahmen — der Weg muss innerhalb **dieser** Versammlung
 * liegen.
 */

/**
 * Der geprüfte Rückweg, oder das Ersatzziel.
 *
 * Erlaubt ist nur ein Pfad unterhalb von `/versammlungen/<kennung>/`. Alles
 * andere — eine fremde Kennung, ein absoluter Verweis mit Schema, ein
 * protokollloses `//host` — fällt auf das Ersatzziel zurück.
 */
export function pruefeRueckweg(
	gewuenscht: string | null,
	versammlungId: string,
	ersatz: string
): string {
	if (!gewuenscht) return ersatz;

	// Ein Rückweg ist ein Pfad, keine Adresse: Schema und Gastgeber haben darin
	// nichts zu suchen, und `//host` wäre für den Browser dasselbe wie `https://host`.
	if (!gewuenscht.startsWith('/') || gewuenscht.startsWith('//')) return ersatz;
	if (gewuenscht.includes('\\') || gewuenscht.includes(':')) return ersatz;

	const erlaubt = `/versammlungen/${versammlungId}/`;
	return gewuenscht.startsWith(erlaubt) ? gewuenscht : ersatz;
}
