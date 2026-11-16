# 0025: Lesart L1, Fundstellen im Protokoll, nicht auf der Karte im Saal

- **Status:** gilt, so gebaut seit Lesarten Block 2
- **Datum:** 2026-10-22
- **Rolle:** Produktentscheid, Frage aus der Featureprüfung Lesarten

## Wortlaut

Frage: «Wertquote im Ausstand (L1): Laut Abnahmeliste soll die Karte im Saal
die Literaturstellen nennen. Gebaut wurde bewusst: Im Saal ein kurzer Satz ohne
Fundstellen, die Fundstellen stehen im Protokoll und in der Auszählmappe. Was
gilt?»

> «Wie gebaut (Empfohlen)»

## Was gilt

- Karte, Leitung, Wand und Telefone nennen zu L1 die Lesart der Versammlung und
  was die andere bewirkt, ohne Fundstellen (`ausstandslesartKartensatz`,
  `ausstandslesartSatz(…, false)` in `domain/lesarten.ts`).
- Protokoll und Auszählmappe nennen die strenge Seite als Grundregel samt
  Folgerung und die milde mit ihrer Fundstelle (`ausstandslesartSatz(…, true)`,
  über `ausstandswirkung` in `domain/auszaehlung.ts`).
- Konzept Lesarten, Kriterium 7, ist entsprechend gefasst; Test
  `tests/domain/lesart-ausstand.test.ts`, «das Protokoll nennt Grundregel und
  Fundstellen, nach beiden Wahlen; die Karte nicht».

## Warum

Im Saal liest die Leitung unter Zeitdruck; Fundstellen helfen ihr dort nicht
(Ä-27, Codeprüfung 18.10.2026). Wer einen Beschluss später prüft, liest das
Protokoll, und dort steht der Beleg.

## Alternativen

- Fundstellen auch auf der Karte: längerer Satz im Saal, neue Laien- und
  Fachprüfung.
