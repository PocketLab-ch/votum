/**
 * Zwei Manifeste vergleichen: Kam zwischen den zwei Paketbauten etwas herein?
 *
 * **Der Vorgang, zu dem das gehört** (Produktentscheid 21.09.2026). Beim Abgeben
 * wird das Paket zweimal gebaut: einmal vor dem Leihschein und einmal danach.
 * Ab dem Leihschein greift die Sperre aus Migration 117; was der zweite Lauf
 * sieht, ist der gesperrte Stand. Unterscheiden sich die zwei Manifeste, ist im
 * Fenster dazwischen geschrieben worden. Das zweite Paket reist dann mit, und im
 * Verlauf steht, was hereinkam.
 *
 * **Verglichen wird das Manifest, nicht die Paketdatei.** Die verschlüsselte
 * Datei ist nie zweimal gleich: Jeder Lauf zieht einen neuen flüchtigen Punkt
 * (X25519). Ein Vergleich der Dateien meldete deshalb jede Abgabe als
 * abweichend. Verglichen wird die Liste aus Pfad und Prüfsumme je Eintrag; die
 * Prüfsumme deckt den Inhalt, der Pfad sagt, welcher Teil sich geändert hat.
 * Erhoben am 21.09.2026: zweimal gebaut, Manifestmarke identisch.
 *
 * **Im Kern, nicht in der Schale.** Eine reine Funktion lässt sich mit zwei
 * erfundenen Manifesten prüfen; ein Test, der den Ablauf im Betrieb nachstellen
 * müsste, träfe das Zeitfenster nur mit Glück. Der Kern kennt keine Node-APIs
 * (AD-1), deshalb steht hier auch kein Hash und keine Datei, sondern nur der
 * Vergleich zweier Listen.
 *
 * Die Reihenfolge der Einträge spielt keine Rolle: Verglichen wird über den
 * Pfad, nicht über die Position.
 */
export interface Manifesteintrag {
	pfad: string;
	pruefsumme: string;
}

export type Unterschiedsart = 'neu' | 'entfernt' | 'geaendert';

export interface Manifestunterschied {
	pfad: string;
	art: Unterschiedsart;
}

/**
 * Was sich zwischen zwei Manifesten unterscheidet — leer heisst gleich.
 *
 * Drei Fälle je Pfad: «neu» (nur im zweiten), «entfernt» (nur im ersten) und
 * «geaendert» (in beiden, andere Prüfsumme). Die dritte Art ist die
 * interessantere: Sie bedeutet, dass eine bestehende Zeile berichtigt wurde,
 * etwa eine Vollmacht oder eine Weisung.
 */
export function vergleicheManifeste(
	vorher: readonly Manifesteintrag[],
	nachher: readonly Manifesteintrag[]
): Manifestunterschied[] {
	const alt = new Map(vorher.map((e) => [e.pfad, e.pruefsumme]));
	const neu = new Map(nachher.map((e) => [e.pfad, e.pruefsumme]));
	const unterschiede: Manifestunterschied[] = [];

	for (const [pfad, summe] of alt) {
		if (!neu.has(pfad)) unterschiede.push({ pfad, art: 'entfernt' });
		else if (neu.get(pfad) !== summe) unterschiede.push({ pfad, art: 'geaendert' });
	}
	for (const pfad of neu.keys()) {
		if (!alt.has(pfad)) unterschiede.push({ pfad, art: 'neu' });
	}

	return unterschiede;
}
