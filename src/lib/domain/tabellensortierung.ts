/**
 * Sortieren einer Tabelle — eine Regel für alle Ansichten (AD-1).
 *
 * **Warum das ein eigener Baustein ist.** Gemeldet am 12.08.2026: «Tabellen
 * jeweils mit Sortier und Filtermöglichkeit.» Gefiltert wird längst überall
 * gleich ([listensuche]); sortiert wurde bisher gar nicht, und jede Tabelle, die
 * damit anfinge, brächte ihre eigene Vorstellung mit: Die eine reihte «1.10» vor
 * «1.9», die nächste stellte Grossbuchstaben vor Kleinbuchstaben, die dritte
 * schöbe leere Zellen nach oben.
 *
 * Drei Entscheidungen, jede mit Grund:
 *
 * 1. **Zahlen als Zahlen.** Wertquoten, Kopfstimmen, Nenner — als Text
 *    verglichen stünde 1000 vor 900. Ein Feld, das durchweg Zahlen führt, wird
 *    numerisch verglichen.
 * 2. **Text nach Schweizer Regeln, mit natürlicher Zahlenfolge.** «Wohnung 2»
 *    vor «Wohnung 10», «Ärgerlich» nach «Anfang» und nicht ans Ende der Liste.
 *    Das kann `Intl.Collator` mit `numeric: true`.
 * 3. **Leeres steht immer hinten**, in beiden Richtungen. Wer nach «E-Mail»
 *    sortiert, sucht die Zeilen **mit** einer Adresse; die ohne oben zu
 *    stapeln beantwortet die Frage nicht — auch nicht rückwärts.
 */

export type Richtung = 'auf' | 'ab';

export interface Sortierung {
	/** Kennung der Spalte, nicht ihr Titel: Titel wechseln, Kennungen nicht. */
	spalte: string;
	richtung: Richtung;
}

const SAMMLER = new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' });

/** Leer heisst: kein Wert. Null, undefined und der leere Text sind dasselbe. */
function istLeer(wert: unknown): boolean {
	return wert === null || wert === undefined || (typeof wert === 'string' && wert.trim() === '');
}

/**
 * Vergleicht zwei Werte — Zahlen und Zeitpunkte numerisch, alles andere als Text.
 *
 * Exportiert, weil die Tests ihn einzeln festnageln: Eine Sortierung, die nur
 * im Ganzen geprüft wird, verrät nicht, an welcher der drei Regeln sie scheitert.
 */
export function vergleiche(a: unknown, b: unknown): number {
	if (istLeer(a) && istLeer(b)) return 0;
	if (istLeer(a)) return 1;
	if (istLeer(b)) return -1;

	if (typeof a === 'number' && typeof b === 'number') return a - b;
	if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
	/*
	 * **Zeitpunkte als Zeitpunkte** (25.08.2026). Ohne diesen Zweig fielen sie in
	 * den Textvergleich — und `String(new Date(…))` beginnt mit dem
	 * **Wochentag**: «Fri Dec 04 2026» sortiert vor «Mon Jan 05 2026». Vier
	 * versiegelte Pakete kamen «aufsteigend» als 04.12., 05.01., 14.03., 25.08.
	 * heraus, also Fri, Mon, Sat, Tue.
	 *
	 * Der Treiber liefert `timestamptz`, `timestamp` und `date` als `Date`
	 * (postgres.js, OID 1082/1114/1184), und `devalue` baut auf der Gegenseite
	 * wieder eines — der Fall trifft beide Seiten.
	 */
	if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

	return SAMMLER.compare(String(a), String(b));
}

/**
 * Sortiert eine Liste nach dem Wert, den `wertVon` je Zeile und Spalte liefert.
 *
 * **Die Vorlage bleibt unberührt** — `toSorted` statt `sort`: Die ursprüngliche
 * Reihenfolge ist anderswo begründet (Nummer des Traktandums, Rang der
 * Gemeinschaft), und wer sie im Vorbeigehen umstellt, ändert sie auch dort, wo
 * niemand sortiert hat.
 *
 * **Ohne Sortierung kommt die Liste unverändert zurück.** Das ist der
 * Normalfall: Eine Tabelle steht in der Reihenfolge, die ihre Abfrage bestimmt,
 * bis jemand auf einen Spaltenkopf klickt.
 */
export function sortiere<T>(
	zeilen: readonly T[],
	sortierung: Sortierung | null,
	wertVon: (zeile: T, spalte: string) => unknown
): T[] {
	if (!sortierung) return [...zeilen];
	const richtung = sortierung.richtung === 'ab' ? -1 : 1;

	return [...zeilen].sort((a, b) => {
		const links = wertVon(a, sortierung.spalte);
		const rechts = wertVon(b, sortierung.spalte);

		/*
		 * **Leeres bleibt hinten, auch beim Umdrehen.** Der erste Versuch rechnete
		 * bloss `richtung * vergleiche(…)` — und drehte damit auch diese Regel um:
		 * Beim zweiten Klick auf «E-Mail» standen alle Zeilen ohne Adresse zuoberst,
		 * und die Spalte war in einer Richtung nutzlos. Vom Test gefunden, nicht
		 * vom Auge.
		 */
		if (istLeer(links) && istLeer(rechts)) return 0;
		if (istLeer(links)) return 1;
		if (istLeer(rechts)) return -1;

		return richtung * vergleiche(links, rechts);
	});
}

/**
 * Was ein Klick auf einen Spaltenkopf bewirkt.
 *
 * **Erster Klick sortiert aufsteigend, zweiter dreht um, dritter hebt auf.** Der
 * dritte Zustand ist wichtig: Ohne ihn gäbe es keinen Weg zurück zur
 * ursprünglichen Reihenfolge — und die trägt bei Traktanden und Einheiten eine
 * eigene Bedeutung, die keine Spalte abbildet.
 */
export function naechsteSortierung(jetzt: Sortierung | null, spalte: string): Sortierung | null {
	if (!jetzt || jetzt.spalte !== spalte) return { spalte, richtung: 'auf' };
	if (jetzt.richtung === 'auf') return { spalte, richtung: 'ab' };
	return null;
}

/**
 * Wie der Spaltenkopf für die Sprachausgabe angesagt wird.
 *
 * `aria-sort` gehört an das `<th>` und kennt genau diese drei Werte. Ohne sie
 * ist eine sortierte Tabelle für eine Vorlesehilfe nicht von einer unsortierten
 * zu unterscheiden — der kleine Pfeil daneben ist nur ein Zeichen.
 */
export function ariaSortierung(
	jetzt: Sortierung | null,
	spalte: string
): 'ascending' | 'descending' | 'none' {
	if (!jetzt || jetzt.spalte !== spalte) return 'none';
	return jetzt.richtung === 'auf' ? 'ascending' : 'descending';
}

/** Das Zeichen am Spaltenkopf — ▲, ▼ oder das blasse Doppelzeichen. */
export function sortierzeichen(jetzt: Sortierung | null, spalte: string): string {
	if (!jetzt || jetzt.spalte !== spalte) return '⇅';
	return jetzt.richtung === 'auf' ? '▲' : '▼';
}
