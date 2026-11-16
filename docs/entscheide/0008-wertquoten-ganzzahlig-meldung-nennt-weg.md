# 0008: Wertquoten bleiben ganzzahlig, die Absage nennt den Weg

- **Status:** gilt
- **Datum:** 2026-10-18
- **Rolle:** Produktentscheid

## Wortlaut

Frage (Ä-10): «Votum nimmt Wertquoten nur als ganze Zahlen an. 123,5 Tausendstel gibt man als 1235 Zehntausendstel ein. Reicht das, wenn die Fehlermeldung genau diesen Weg erklärt?»

> «So lassen, Meldung erklärt (Empfohlen)»

Die gewählte Möglichkeit lautete: «Kleiner Block: Die Absage nennt den Weg über den grösseren Nenner mit Beispiel, auch beim CSV-Import. Danach ist Ä-10 erledigt.»

## Anlass

Speicherung, Vergleich und Anzeige sind ganzzahlig (`migrations/005_einheiten.sql`, `domain/mehrheit.ts`); «123,5» wird abgewiesen, ohne den Ausweg zu nennen (`domain/einheiten.ts`). Ein «Schwellenobjekt mit Klasse» aus der Zweitprüfung gibt es nicht; sein Zweck ist durch die Entscheide «Hinweis statt Sperre» erfüllt. Keine Anwaltsfrage. Sitzungsprotokoll vom 18.10.2026, 16:28 UTC; gewählt wie empfohlen. Zu bauen in Schritt 3b des Ablaufs (`.auftraege/2026-10-18-votum-ablauf-entscheide-nach-block3.md`).

## Alternativen

- «Kommazahlen zulassen»: gross, Risiko an der ganzen Rechenkette.
- «Internes Schwellenobjekt»: mittel, ohne sichtbaren Nutzen.
