/**
 * Vorschläge, welche Eigentümerzeile zu welcher Person gehört.
 *
 * **Vorschlagen, nicht setzen.** Ein automatisch gesetzter Treffer wäre bequem
 * und gefährlich: «Meier» gibt es in einer Überbauung dreimal, und eine falsche
 * Klammer gäbe am Versammlungstag jemandem Zutritt zu einer Versammlung, in der
 * er nichts zu suchen hat. Die Anwendung sagt deshalb, was ihr auffällt, und die
 * Bewirtschaftung bestätigt.
 *
 * **Nur bei Gleichheit, nie bei Ähnlichkeit.** Verglichen wird der Name nach
 * Vereinheitlichung von Leerraum und Gross-/Kleinschreibung — mehr nicht. Kein
 * Abstandsmass, keine Abkürzungen: «M. Probère» und «Markus Probère» bleiben zwei
 * Namen. Wer das aufweicht, verschiebt die Fehlerklasse von «nichts gefunden»
 * (harmlos) zu «das Falsche gefunden» (nicht harmlos).
 *
 * **Und nur bei Eindeutigkeit.** Gibt es zwei gleichnamige Personen, gibt es
 * keinen Vorschlag — dann muss ohnehin ein Mensch entscheiden.
 */

export interface AbgleichPartei {
	parteiId: string;
	name: string;
	/** Schon verknüpft? Dann kein Vorschlag. */
	personId: string | null;
	/** Zeilen ohne einzelne Person hinter sich bekommen nie eine Klammer. */
	verknuepfbar: boolean;
}

export interface AbgleichPerson {
	id: string;
	name: string;
	/** In welchen Gemeinschaften sie schon geführt wird — für den Hinweis. */
	gemeinschaften: string[];
}

export interface Verknuepfungsvorschlag {
	parteiId: string;
	parteiName: string;
	personId: string;
	personName: string;
	/** Warum vorgeschlagen wird — steht so in der Oberfläche. */
	hinweis: string;
}

/** Leerraum vereinheitlichen, Gross-/Kleinschreibung ignorieren. Sonst nichts. */
export function vergleichsname(name: string): string {
	return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-CH');
}

/**
 * Was der Anwendung auffällt: gleichnamige, noch nicht verknüpfte Zeilen.
 */
export function verknuepfungsvorschlaege(
	parteien: AbgleichPartei[],
	personen: AbgleichPerson[]
): Verknuepfungsvorschlag[] {
	// Gleichnamige Personen schliessen einander aus: Bei zweien gibt es keinen
	// Vorschlag, weil die Anwendung nicht wissen kann, welche gemeint ist.
	const jeName = new Map<string, AbgleichPerson[]>();
	for (const p of personen) {
		const schluessel = vergleichsname(p.name);
		jeName.set(schluessel, [...(jeName.get(schluessel) ?? []), p]);
	}

	const vorschlaege: Verknuepfungsvorschlag[] = [];
	for (const partei of parteien) {
		if (partei.personId || !partei.verknuepfbar) continue;
		const treffer = jeName.get(vergleichsname(partei.name));
		if (!treffer || treffer.length !== 1) continue;

		const person = treffer[0];
		vorschlaege.push({
			parteiId: partei.parteiId,
			parteiName: partei.name,
			personId: person.id,
			personName: person.name,
			hinweis:
				person.gemeinschaften.length > 0
					? `Gleicher Name wie eine Person in ${person.gemeinschaften.join(', ')}. ` +
						'Prüfen Sie, ob es dieselbe ist — bei häufigen Namen ist sie es oft nicht.'
					: 'Gleicher Name wie eine bereits erfasste Person. Prüfen Sie, ob es dieselbe ist.'
		});
	}
	return vorschlaege;
}

/**
 * Die Person, die beim Erfassen eines Namens vorausgewählt wird.
 *
 * Null, wenn es keine oder mehrere gleichnamige gibt. Die Oberfläche wählt sie
 * vor und schreibt den Hinweis daneben; abgeschickt wird erst, was jemand
 * gesehen hat.
 */
export function vorauswahl(name: string, personen: AbgleichPerson[]): AbgleichPerson | null {
	const schluessel = vergleichsname(name);
	// zeichenzahl-frei: Vergleichsschlüssel, keine Eingabeschranke.
	if (schluessel.length < 2) return null;
	const treffer = personen.filter((p) => vergleichsname(p.name) === schluessel);
	return treffer.length === 1 ? treffer[0] : null;
}
