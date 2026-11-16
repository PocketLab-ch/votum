/**
 * Wer was darf.
 *
 * **Warum das nachgerüstet wurde.** Die Rollen `admin` und `chair` standen seit
 * dem ersten Tag in der Datenbank und wurden **nirgends geprüft** — wer ein
 * Konto hatte, konnte alles: Gemeinschaften löschen, Wertquoten ändern,
 * Eigentümer austauschen. Solange es genau ein Konto gibt, fällt das nicht auf.
 * Beim zweiten fällt es auf, und dann ist es zu spät, weil bereits jemand mit
 * einer Sitzungsleitungs-Rolle in den Stammdaten stand.
 *
 * **Die Grenze läuft zwischen Stammdaten und Versammlung**, nicht zwischen
 * Lesen und Schreiben:
 *
 *   - Die **Verwaltung** (`admin`) führt die Stammdaten: Gemeinschaften,
 *     Einheiten, Wertquoten, Eigentümer, Nutzniessung, Reglementsangaben,
 *     Personen, Betreiber. Das sind die Angaben, aus denen sich die Stimmkraft
 *     errechnet — wer sie ändert, ändert das Ergebnis jeder künftigen
 *     Abstimmung.
 *   - Die **Sitzungsleitung** (`chair`) führt Versammlungen: traktandieren,
 *     freigeben, Zugänge ausgeben, Anwesenheit erfassen, abstimmen lassen,
 *     auswerten. Sie **liest** die Stammdaten — ohne sie liesse sich keine
 *     Versammlung führen — und ändert sie nicht.
 *
 * Deshalb ist Lesen für beide offen und nur das Ändern beschränkt. Eine
 * Sitzungsleitung, die den Stimmberechtigtenstand nicht sehen darf, könnte die
 * Beschlussfähigkeit nicht feststellen.
 *
 * **Warum als Pfadtabelle und nicht je Funktion.** Jede Änderung der Anwendung
 * geht durch eine Route; ein Wächter an dieser einen Stelle lässt sich nicht
 * vergessen. Eine Prüfung je Serverfunktion wäre feiner und würde beim nächsten
 * neuen Aufruf übersehen — dieselbe Überlegung wie beim Anmeldeschutz in
 * `hooks.server.ts`, der ebenfalls alles schützt, was nicht ausdrücklich offen
 * ist.
 *
 * ---
 *
 * **Wer hier je eine Rolle _pro Versammlung_ einführt, liest zuerst
 * `docs/audit/2026-09-07-traktandumsbindung.md`.**
 *
 * Beide Rollen gelten heute über den **ganzen Betreiber**. Daran hing die
 * Einstufung mehrerer Schreibwege, die eine Kennung aus dem Formular
 * entgegennahmen, ohne sie gegen die Versammlung aus der Adresse zu halten
 * (`setzeWeisungsbindung`, `halteWeisungFest`, `haengeAn`, die
 * `business`-Wege). **Alle vier sind seit dem 07.09.2026 gebunden**, jeder über
 * einen gemeinsamen Leser; der Prüfbericht führt sie mit Nachweis.
 *
 * Der Vorbehalt bleibt trotzdem stehen, und zwar für den **nächsten** solchen
 * Weg: Solange jede Sitzungsleitung ohnehin jede Versammlung ihres Betreibers
 * führen darf, sieht eine fehlende Bindung wie ein blosser Konsistenzmangel
 * aus — wer eine fremde Kennung unterschiebt, darf dieselbe Handlung auf der
 * richtigen Seite auch. Mit einer Rolle je Versammlung **wird daraus eine
 * Rechteausweitung**, und zwar an dem Tag, an dem die Rolle eingeführt wird,
 * nicht später. Das steht hier und nicht nur im Prüfbericht: An einem
 * Auditdokument von heute kommt in einem halben Jahr niemand vorbei, an dieser
 * Datei schon.
 */

export type Rolle = 'admin' | 'chair';

export const ROLLEN: Rolle[] = ['admin', 'chair'];

/** Wie die Rolle im Klartext heisst — für Anzeigen und Meldungen. */
export function rolleInWorten(rolle: Rolle): string {
	return rolle === 'admin' ? 'Verwaltung' : 'Sitzungsleitung';
}

/**
 * Bereiche, in denen nur die Verwaltung ändern darf.
 *
 * Bewusst als Anfang des Pfades und nicht als vollständige Liste einzelner
 * Seiten: Eine neue Unterseite unter `/gemeinschaften` ist damit von selbst
 * geschützt. Die sichere Richtung ist dieselbe wie beim Anmeldewächter.
 */
const VERWALTUNGSBEREICHE = ['/gemeinschaften', '/betreiber', '/personen'];

/**
 * Was trotzdem der Sitzungsleitung offensteht.
 *
 * Eine Versammlung wird unter ihrer Gemeinschaft angelegt
 * (`/gemeinschaften/<id>/versammlungen/neu`) — der Pfad liegt im
 * Verwaltungsbereich, die Handlung gehört aber zur Sitzungsleitung. Ohne diese
 * Ausnahme könnte eine Sitzungsleitung keine Versammlung ansetzen, und die
 * Rollentrennung nähme ihr genau das, wofür es sie gibt.
 */
const AUSNAHMEN = [
	/^\/gemeinschaften\/[^/]+\/versammlungen(\/|$)/,
	/*
	 * **Die Lesarten der Gemeinschaft** (Migration 169, Entscheid 0018). Die
	 * Gemeinschaft kann erlauben, dass auch die Sitzungsleitung sie umstellt.
	 * Der Pfad öffnet nur die eigene Seite mit zwei Aktionen: `lesarten`
	 * (`speichereLesarten` prüft Rolle und Erlaubnis selbst, in derselben
	 * Transaktion) und `nachziehen` (das Erfordernis eines Traktandums setzt die
	 * Sitzungsleitung ohnehin selbst). Ein Wächter hält die Liste fest
	 * (`tests/waechter/lesartenseite.test.ts`). Wer umstellen darf und die Universalversammlung
	 * stehen auf der Reglementsseite und bleiben damit der Verwaltung.
	 * Nur genau dieser Pfad, ohne Unterseiten: Eine spätere Unterseite soll
	 * nicht still mit offenstehen.
	 */
	/^\/gemeinschaften\/[^/]+\/lesarten$/
];

/**
 * Verlangt dieser Aufruf die Rolle der Verwaltung?
 *
 * Nur schreibende Aufrufe: Lesen ist für beide Rollen offen (siehe oben).
 * Massgebend ist das Verfahren, nicht die Absicht der Seite — ein Formular
 * kommt als POST, ein Blick auf dieselbe Seite als GET.
 */
export function verlangtVerwaltung(pfad: string, methode: string): boolean {
	if (methode.toUpperCase() === 'GET' || methode.toUpperCase() === 'HEAD') return false;
	if (AUSNAHMEN.some((muster) => muster.test(pfad))) return false;
	return VERWALTUNGSBEREICHE.some((b) => pfad === b || pfad.startsWith(b + '/'));
}

/**
 * Darf diese Rolle Stammdaten ändern?
 *
 * Getrennt von `verlangtVerwaltung`, weil die Oberfläche dieselbe Frage ohne
 * einen Pfad stellt: Ein Knopf, der zu einer Absage führt, gehört nicht
 * hingestellt.
 */
export function darfStammdatenAendern(rolle: Rolle | null | undefined): boolean {
	return rolle === 'admin';
}

/**
 * Die Absage im Klartext.
 *
 * Sie nennt den Grund und den Weg: «nicht erlaubt» allein lässt jemanden im
 * Saal ratlos zurück, wo niemand Zeit hat, Rollen nachzuschlagen.
 */
export const VERWALTUNG_VORBEHALTEN =
	'Diese Änderung ist der Verwaltung vorbehalten. Ihr Konto führt Versammlungen; ' +
	'Stammdaten wie Einheiten, Wertquoten und Eigentümer ändert die Bewirtschaftung.';
