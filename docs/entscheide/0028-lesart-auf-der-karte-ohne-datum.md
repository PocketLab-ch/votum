# 0028: Die Karte nennt die Lesart ohne Datum der Wahl

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/erledigt/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage: «Auf der Seite ‹Lesarten› steht, wer wann umgestellt hat. Die Karte zur
Abstimmung sagt nur, welche Lesart gilt und ob das die Voreinstellung ist, ohne
Datum. Soll das Datum auch auf die Karte?»

> «Ohne Datum lassen (Empfohlen)»

## Anlass

Das Konzept Lesarten nannte «gewählt am …» auf der Karte. Gebaut ist es ohne:
Die Seite «Lesarten» zeigt «Zuletzt geändert von … am …»
(`src/lib/components/Lesartenwahl.svelte`), die Kartensätze in
`src/lib/domain/lesarten.ts` kennen kein Datum.

## Was gilt

Massgebend ist die mit der Einladung eingefrorene Wahl; Protokoll und Karte
nennen sie. Das Datum der Umstellung steht auf der Seite «Lesarten» und im
Verlauf, nicht am Erfordernis.

## Alternativen

- Datum an die Karte: müsste mit jedem Erfordernis gespeichert werden und
  brauchte neuen Wortlaut mit Laien- und Fachprüfung, ohne Nutzen im Saal.
