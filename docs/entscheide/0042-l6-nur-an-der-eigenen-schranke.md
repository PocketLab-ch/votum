# 0042: Die Lesart L6 wirkt nur an der eigenen Schranke

- **Status:** gilt ab Fassung 2026-11-05
- **Datum:** 2026-11-05
- **Rolle:** Produktentscheid nach der Codeprüfung zu F4c, Block 1

## Was gilt

> Inhalt des Entscheids, wie ihn die Übergabe vom 05.11.2026 festhält
> (kein wörtliches Zitat):

- L6 wirkt **nur an der Karte** `k-reglement-eigene-schranke` («Reglement
  verlangt für seine Änderung selbst Einstimmigkeit»).
- Hat die Gemeinschaft an «Reglement ändern, gewöhnliche Bestimmung»
  (`k-reglement-normal`) eine strengere Regel hinterlegt, rechnet Votum dort
  unabhängig von L6 weiter nach dieser Regel und vermerkt, dass das umstritten
  ist (`umstrittenBeiStrengererKlausel` mit `KLAUSEL_GEGENMEINUNG`,
  `src/lib/domain/reglement.ts`; Entscheid 0009).
- Das wird **offen hingeschrieben**: in der `geltung` von L6
  (`src/lib/domain/lesarten.ts`) und auf der Reglementsseite im Kasten
  «Änderung des Reglements», solange die Gemeinschaft auf «Nach dem Gesetz»
  steht.

## Anlass

Die Codeprüfung zu Block 1 fand zwei Wege zur selben Rechtsfrage: die Karte
der eigenen Schranke, die L6 trägt, und eine hinterlegte Klausel an der
gewöhnlichen Reglementsänderung, die L6 nicht sieht. Unter «Nach dem Gesetz»
wäre zudem der Satz der Reglementsseite «Wer sie dort wählt, bekommt
Einstimmigkeit» falsch gewesen.

## Alternativen

L6 auch auf den zweiten Weg ausweiten. Nicht jetzt: Das ändert, wie eine
hinterlegte Regel gelesen wird, und ist ein eigener Block, später.
