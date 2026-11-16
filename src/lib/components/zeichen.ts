/**
 * Die Zeichen an den Handlungen — reine Pfaddaten, ohne Abhängigkeit.
 *
 * **Der Anlass, am 20.08.2026.** In der Anwesenheitsliste stehen in jeder Zeile
 * zwei bis drei Schaltflächen, und sie sahen alle gleich aus: gleicher Rahmen,
 * gleiche Farbe, gleiche Breite. Gemeldet als «Sieht alles ähnlich aus. Oder mit
 * Farben arbeiten.» — wer vierzehn Zeilen abarbeitet, sucht in jeder Zeile
 * dieselbe Beschriftung erneut zusammen, statt sie zu erkennen.
 *
 * **Warum eigene Pfade und keine Zeichensatz-Bibliothek.** Ein Zeichensatz wäre
 * eine Abhängigkeit für sechs Formen, dazu eine Schriftdatei, die aus dem Netz
 * nachgeladen wird — im Saal, wo das WLAN das erste ist, was ausfällt. Diese
 * sechs Pfade sind Text im Bündel und da, wenn nichts anderes mehr da ist.
 *
 * **Das Zeichen ergänzt die Beschriftung, es ersetzt sie nie.** Ein Symbol
 * allein ist eine Vermutung; «Verlassen» ist eine Aussage. Deshalb trägt jedes
 * Zeichen `aria-hidden` — für ein Vorleseprogramm steht die Beschriftung daneben,
 * und ein zweites Mal dasselbe zu hören hilft niemandem.
 */

export type Zeichenart =
	/** Bestätigen, erfassen, freigeben — etwas kommt hinzu. */
	| 'haken'
	/** Ablehnen, verwerfen — etwas fällt weg. */
	| 'kreuz'
	/** Verlassen: aus dem Raum hinaus. */
	| 'hinaus'
	/** Einen Zugangscode ausgeben. */
	| 'schluessel'
	/** Ein angemeldetes Gerät abmelden. */
	| 'geraet'
	/** Eine Meldung einer Partei zuordnen. */
	| 'zuordnen';

/** Ein Zeichen besteht aus Linien; gefüllt wird nichts. */
export const ZEICHEN: Record<Zeichenart, readonly string[]> = {
	haken: ['M3 8.5 6.25 11.75 13 4.5'],
	kreuz: ['M4 4 12 12', 'M12 4 4 12'],
	// Türrahmen links, Pfeil nach rechts hinaus.
	hinaus: ['M9 2.5H3.5v11H9', 'M7.5 8h6', 'M11 5.5 13.5 8 11 10.5'],
	// Bart links unten, Schaft nach rechts oben, zwei Zähne.
	schluessel: ['M6.6 9.4a2.4 2.4 0 1 0-3.4 3.4 2.4 2.4 0 0 0 3.4-3.4Z', 'M6.6 9.4 13 3', 'M11 5l1.5 1.5', 'M9.6 6.4 11 7.8'],
	// Telefon mit Strich: das Gerät ist weg, die Anwesenheit bleibt.
	geraet: ['M5 2.5h6v11H5z', 'M7.2 11.6h1.6', 'M3 13.5 13 2.5'],
	// Pfeil in einen Rahmen hinein: die Meldung kommt zur Partei.
	zuordnen: ['M2.5 8h6.5', 'M6.5 5.5 9 8l-2.5 2.5', 'M11 2.5h2.5v11H11']
};

/** Die Kantenlänge des Zeichenrasters. Alle Pfade sind darauf gezeichnet. */
export const RASTER = 16;
