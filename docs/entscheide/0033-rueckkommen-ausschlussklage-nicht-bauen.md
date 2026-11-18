# 0033: Rückkommen über den Baum auf die Ausschlussklage wird nicht gebaut

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/erledigt/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage: «In einem konstruierten Fall (Leitung wählt beim Rückkommen im Baum
ausgerechnet den Knoten der Ausschlussklage) erschiene eine überflüssige zweite
Rechnung samt Protokollzeile. Eine saubere Lösung bräuchte eine neue
Datenbankspalte. Weiter nicht bauen?»

> «Nicht bauen (Empfohlen)»

## Anlass

Review DeepSeek zu Lesarten Block 6, Befund 1. Wählt die Leitung den Knoten im
Baum, verliert das Erfordernis den Vorsatz `RUECKKOMMEN_TITEL`
(`src/lib/domain/entscheidbaum.ts`, gesetzt in `src/lib/domain/rueckkommen.ts`),
und ohne Abweichung erschiene 1a samt Protokollzeile.

## Was gilt

Kein Bau. Kommt der Fall in der Praxis vor, ist das ein neuer Anlass für eine
Marke am Erfordernis (Spalte, Einfrieren).

## Alternativen

- Marke am Erfordernis: Migration und Tests auf Stufe hoch für einen
  konstruierten Fall.
