/**
 * Der gemeinsame Fang für `FachlicherFehler` in Ladefunktionen.
 *
 * **Die Klasse** (Block B2 des Abschlusses, 16.10.2026). Aktionen übersetzen
 * `FachlicherFehler` seit je in `fail(400, …)`, jede für sich. `load` hat
 * diesen Kanal nicht: Eine geworfene Absage ohne `error(…)` wird zur
 * 500-Seite. `GET /quorum?g=x` war die gemessene Stelle: `holeGemeinschaft`
 * übersetzt die ungültige Kennung korrekt in einen FachlicherFehler, und der
 * `load` fing ihn nicht, weil sein `try` erst um den Entscheidbaum lag.
 *
 * **Warum ein Wrapper und kein Fang je Funktion.** Derselbe Grund wie bei
 * `kennungsfehler`: Die Ladefunktionen sind zahlreich, eine geworfene Absage
 * kann aus jeder Tiefe kommen, und wer den Fang an einer Stelle vergisst,
 * liefert wieder die 500-Seite. Mit `mitAbsage` bekommt der ganze Ladeweg
 * einen kontrollierten Ausgang: `error(400, …)` ist die Absageseite des
 * Hauses, dieselbe Klasse Antwort wie `fail(400, …)` in einer Aktion.
 *
 * **Was er nicht anfasst.** `redirect` und `error` aus der Ladefunktion selbst
 * sind SvelteKit-Ausgänge und werden unverändert durchgereicht; nur ein
 * `FachlicherFehler` wird übersetzt, jede andere Ausnahme bleibt roh (sie ist
 * ein Programmfehler und gehört ins Protokoll).
 *
 * **Warum generisch und ohne SvelteKit-Typ in der Signatur** (gemessen,
 * 16.10.2026). Ein Wrapper, der ein festes `PageServerLoad` zurückgibt, kappt
 * den konkreten Rückgabetyp des Loads; SvelteKit sieht dann nur noch die
 * generische Ausgabe, und die `.svelte`-Dateien der Route verlieren ihre
 * Daten-Typen. 80 `implicitly any`-Fehler in sieben Dateien waren das
 * Ergebnis. Mit dem Typparameter bleibt der Typ des übergebenen Loads (inkl.
 * der Annotation `: PageServerLoad` **aus `./$types`** an der Route) erhalten.
 */
import { error } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

export function mitAbsage<L>(laden: L): L {
	return (async (ereignis: never) => {
		try {
			return await (laden as (e: never) => unknown)(ereignis);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) error(400, fehler.message);
			throw fehler;
		}
	}) as L;
}
