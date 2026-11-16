/**
 * Formulardaten in Eingaben des Kerns übersetzen.
 *
 * Ein Formular liefert ausschliesslich Zeichenketten. Die Umwandlung gehört an
 * genau eine Stelle: Läge sie in jeder Route, käme irgendwo `parseInt` statt
 * `Number` zum Zug, und aus «1000abc» würde stillschweigend 1000.
 */
import type { GemeinschaftEingabe, Traegerschaft } from '$lib/domain/gemeinschaft';
import type { Betriebsart, VersammlungEingabe, Versammlungsart } from '$lib/domain/versammlung';
import type { Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
import type { HeadCountMode, Id, Stichentscheid } from '$lib/domain/types';
import type { Schreibstand } from '$lib/domain/schreibstand';

/**
 * Ganzzahl aus einem Formularfeld.
 *
 * `Number('')` ergibt 0 — bei einem Wertquoten-Nenner wäre das die stillschweigende
 * Umdeutung eines leeren Feldes in «blosse Klammer». Deshalb NaN für Leeres, und
 * der Kern weist es ab.
 */
export function ganzzahl(wert: FormDataEntryValue | null): number {
	const text = String(wert ?? '').trim();
	if (text === '') return Number.NaN;
	return Number(text);
}

export function text(wert: FormDataEntryValue | null): string {
	return String(wert ?? '').trim();
}

/**
 * Eine freiwillige Zahl aus einem Formularfeld: `null` für Leeres.
 *
 * **Anders als `ganzzahl`** (07.09.2026, Befund 26). Dort ist ein leeres Feld
 * ein Fehler, hier ist es eine Antwort: «nicht erfasst». Und anders als bei
 * Quoten sind Nachkommastellen richtig — «3.5 Zimmer», «87.4 m².»
 *
 * Das Komma wird zum Punkt: Auf einer Schweizer Tastatur tippt man «87,4», und
 * `Number('87,4')` ist `NaN`. Eine Absage für eine Schreibweise, die jeder
 * benutzt, ist keine Prüfung, sondern eine Falle.
 */
export function zahlOderNichts(wert: FormDataEntryValue | null): number | null {
	const roh = String(wert ?? '').trim().replace(',', '.');
	if (roh === '') return null;
	const zahl = Number(roh);
	return Number.isFinite(zahl) ? zahl : Number.NaN;
}

/**
 * Der Stand, den das Formular beim Anzeigen vorfand — als `stand-<feld>`.
 *
 * **Warum als eigene Felder und nicht als eine Marke über der ganzen Zeile.**
 * Ein Zeitstempel der Zeile meldete auch dann einen Konflikt, wenn jemand ein
 * **anderes** Feld geändert hat. Die Regel dahinter steht in
 * `$lib/domain/schreibstand`.
 *
 * **Ein fehlendes Feld heisst «nicht geprüft», ein leeres «war leer».** Deshalb
 * hier `has()` und nicht `get() ?? ''`: Sonst wäre das Formular ohne verstecktes
 * Feld nicht mehr vom Formular mit leerem Feld zu unterscheiden.
 */
export function standAus(daten: FormData, felder: readonly string[]): Schreibstand {
	const stand: Schreibstand = {};
	for (const feld of felder) {
		if (daten.has(`stand-${feld}`)) stand[feld] = text(daten.get(`stand-${feld}`));
	}
	return stand;
}

/** Ein nicht gesetztes Kontrollkästchen erscheint gar nicht in den Formulardaten. */
export function jaNein(wert: FormDataEntryValue | null): boolean {
	return wert === 'true' || wert === 'on';
}

/**
 * Die Eingaben, so wie sie nach einer Absage ins Formular zurückgehen.
 *
 * **Nicht `Object.fromEntries(daten)`** (07.10.2026). Das behält von einem
 * Feld mit mehreren Werten nur den letzten: Wer drei KI-Funktionen
 * ausgenommen hatte, fand nach einer Absage eine davon wieder, und das
 * nächste Speichern schaltete die beiden anderen still ein. Die Felder in
 * `mehrfach` kommen deshalb immer als Liste zurück.
 *
 * Haken kommen als «true» in Worten zurück, nicht als Wahrheitswert; das
 * Formular vergleicht deshalb mit `istAn`.
 */
export function formularwerte(daten: FormData, mehrfach: string[] = []): Record<string, unknown> {
	const werte: Record<string, unknown> = Object.fromEntries(daten);
	for (const feld of mehrfach) werte[feld] = daten.getAll(feld).map(String);
	return werte;
}

export function ausFormular(daten: FormData): GemeinschaftEingabe {
	const eltern = text(daten.get('parentStwegId'));
	return {
		name: text(daten.get('name')),
		strasse: text(daten.get('strasse')) || undefined,
		plz: text(daten.get('plz')) || undefined,
		ort: text(daten.get('ort')) || undefined,
		quotaDenominator: ganzzahl(daten.get('quotaDenominator')),
		// Bewusst ohne Rückfallwert: Eine Voreinstellung wäre hier falsch, egal
		// welche — rechtlich gilt eine Stimme je Eigentümer, in den meisten
		// Reglementen steht die Zählung je Einheit. Wer nicht wählt, bekommt einen
		// Fehler statt einer stillschweigend gesetzten Zählweise.
		headCountMode: text(daten.get('headCountMode')) as HeadCountMode,
		parkingCountsAsHead: jaNein(daten.get('parkingCountsAsHead')),
		parentStwegId: eltern || null,
		headCountRuleSource: text(daten.get('headCountRuleSource')) || undefined,
		tieBreak: (text(daten.get('tieBreak')) || 'keiner') as Stichentscheid,
		tieBreakRuleSource: text(daten.get('tieBreakRuleSource')) || undefined,
		abstentionExcluded: jaNein(daten.get('abstentionExcluded')),
		abstentionExcludedSource: text(daten.get('abstentionExcludedSource')) || undefined,
		// Ein leeres Feld heisst «keine Schranke», nicht «null Vollmachten». Die
		// Unterscheidung trägt der Kern; hier wird nur nicht geraten.
		proxyLimit: text(daten.get('proxyLimit')) ? ganzzahl(daten.get('proxyLimit')) : null,
		proxyLimitRuleSource: text(daten.get('proxyLimitRuleSource')) || undefined,
		proxyByAccess: jaNein(daten.get('proxyByAccess')),
		proxyByAccessSource: text(daten.get('proxyByAccessSource')) || undefined,
		aiEnabled: jaNein(daten.get('aiEnabled')),
		// Ein Häkchen je Funktion, das die Funktion **ausnimmt**. Umgekehrt
		// herum — ein Häkchen je erlaubter Funktion — hiesse, dass eine später
		// hinzukommende Funktion bei allen bestehenden Gemeinschaften stumm
		// abgeschaltet wäre.
		aiDisabledFunctions: daten.getAll('aiDisabledFunctions').map(String).filter(Boolean),
		// Ein Auswahlfeld ohne Wahl schickt nichts. `undefined` heisst deshalb
		// «nicht mitgeschickt» und lässt den gespeicherten Wert stehen; ob das
		// Feld Pflicht ist, entscheidet der Kern (Ä-43).
		traegerschaft: daten.has('traegerschaft')
			? ((text(daten.get('traegerschaft')) || null) as Traegerschaft | null)
			: undefined
	};
}

export function versammlungAusFormular(daten: FormData, stwegId: Id): VersammlungEingabe {
	return {
		stwegId,
		datum: text(daten.get('datum')),
		uhrzeit: text(daten.get('uhrzeit')),
		ort: text(daten.get('ort')),
		art: text(daten.get('art')) as Versammlungsart,
		stufe: text(daten.get('stufe')) as Versammlungsstufe,
		betriebsart: text(daten.get('betriebsart')) as Betriebsart,
		anlass: text(daten.get('anlass')) || undefined,
		vorgaengerId: text(daten.get('vorgaengerId')) || null
	};
}
