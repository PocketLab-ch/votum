/**
 * Wo der Link aus der Erinnerungsmail hinführt (02.09.2026).
 *
 * **Warum er offen sein muss:** Er kommt aus einem Postfach, nicht aus einer
 * Sitzung. Wer die Anwendung erst aufmachen und sich anmelden müsste, um zu
 * sagen «ist erledigt», nimmt den Weg nicht — dann bleibt es beim Satz, den die
 * Erinnerung schon vorher enthielt.
 *
 * **Was dahinter steht, kann genau eines:** den Versandvermerk setzen. Keine
 * Inhalte, keine Rechte, keine zweite Handlung. Die Marke ist danach verbraucht
 * und in der Anwendung jederzeit zurücknehmbar (Migration 102).
 */
export const VERMERKPFAD = '/b';

/**
 * Die Seiten, die ohne Anmeldung erreichbar sind — und was daraus folgt.
 *
 * **Eine Liste, zwei Leser.** Der Anmeldewächter (`hooks.server.ts`) lässt
 * diese Pfade durch; das Gerüst (`+layout.server.ts`) blendet dort alles aus,
 * was zur Sitzungsleitung gehört. Zwei getrennte Listen liefen auseinander:
 * Käme eine öffentliche Seite dazu, wäre sie zwar erreichbar, trüge aber
 * weiterhin den Knopf «Zur Sitzungsleitung».
 *
 * Gemeldet am 21.08.2026: «Den Zur Sitzungsleitung darf nur der angemeldete
 * Sitzungsleiter sehen. Nicht im /z/». Der Knopf stand dort, weil das Gerüst
 * für alle Seiten dasselbe ist und nur fragte, ob jemand angemeldet ist — und
 * wer im selben Browser als Sitzungsleitung angemeldet ist, sieht ihn auch auf
 * dem Telefon des Eigentümers.
 *
 * **Was jeder Pfad ist:**
 *
 *   `/z`  die Teilnehmersicht auf dem Telefon, Zugang über den Handzettel
 *   `/e`  der Einstieg über den QR-Code auf der Leinwand
 *   `/p`  die Präsentationssicht auf dem Beamer, Zugang über den Anzeigecode
 *   `/b`  der Vermerk «Einladung ist hinaus», aus der Erinnerungsmail heraus
 *   `/anmelden`, `/gesundheit`  ohne Sitzungsbezug
 */
export const OFFENE_PFADE = ['/anmelden', '/gesundheit', '/z', '/e', '/p', VERMERKPFAD];

/** Wahr, wenn der Pfad ohne Anmeldung erreichbar ist. */
export function istOffenerPfad(pfad: string): boolean {
	return OFFENE_PFADE.some((p) => pfad === p || pfad.startsWith(p + '/'));
}
