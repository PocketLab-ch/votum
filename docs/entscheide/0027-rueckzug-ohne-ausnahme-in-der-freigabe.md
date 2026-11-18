# 0027: Zurückgezogene Traktanden brauchen keine Ausnahme in der Freigabe

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/erledigt/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage: «Die befürchtete Lage (ein zurückgezogener Antrag blockiert die
Freigabe) kann gar nicht eintreten, weil man nur während der laufenden Sitzung
zurückziehen kann, die Freigabe aber vorher ist. Was soll mit der Pendenz
geschehen?»

> «Streichen, Test (Empfohlen)»

## Anlass

Review DeepSeek zu Lesarten Block 1: `pruefeLesartenDerTraktanden` und der
Kasten «nachziehen» filtern `withdrawn_at` nicht. Gemessen am 29.10.2026:
`ziehAntragZurueck` verlangt den Zustand `laufend`
(`src/lib/server/traktanden.ts`); die Freigabe läuft aus `entwurf`, der Kasten
sieht nur `entwurf` und `freigegeben` (`veralteteErfordernisseIn` in
`src/lib/server/reglement.ts`); zurück führt nur `freigegeben` → `entwurf`
(`nimmVersammlungsfreigabeZurueck`). Die Vorlage für eine Folgeversammlung
übernimmt Zurückgezogenes nicht (`src/lib/server/vorlagen.ts`). Die Einladung
entsteht mit der Freigabe und kann deshalb kein zurückgezogenes Traktandum
drucken.

## Was gilt

- Freigabe und Kasten bleiben ohne Filter auf `withdrawn_at`.
- Ein Test hält fest, dass ein Rückzug ausserhalb von `laufend` abgewiesen wird
  (in `tests/db/rueckzug.test.ts` fehlt der Fall heute); gebaut in A6. Fällt
  die Schranke einmal, wird der Test rot und die Frage kommt zurück.

## Alternativen

- Vorsorglich ausnehmen: Arbeit für einen Fall, den es heute nicht gibt.
