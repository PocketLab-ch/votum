# 0037: Kein öffentliches Quellarchiv, solange der Code allein dem Haus gehört

- **Status:** gilt
- **Datum:** 2026-11-03
- **Rolle:** Produktentscheid

## Wortlaut

Frage: «Votum steht unter AGPL, aber der ganze Code gehört dem Haus und keine
fremde Abhängigkeit steht unter (A)GPL. Nach meiner Einschätzung (ohne
Rechtsprüfung) muss Votum den Quellcode deshalb nicht veröffentlichen. Bei
immotool macht das Haus es trotzdem nach jedem Deploy. Wie soll es bei Votum
sein?»

> «Jetzt nicht, festhalten.»

## Anlass

Votum steht seit dem Produktentscheid vom 13.10.2026 unter der AGPLv3
(`LICENSE`, `17259620`). immotool und CMMS veröffentlichen nach jedem
Prod-Deploy ein Quellarchiv (AGPL §13); Votum hatte nichts dergleichen, und
beim Ausrollen von A4 und A5 am 03.11.2026 war offen, ob es das braucht.

## Was gilt

Votum baut kein Quellarchiv und keinen Link darauf. Begründung: Die AGPL
bindet, wer das Werk eines anderen nutzt und verändert; der Inhaber aller
Rechte ist an seine eigene Lizenz nicht gebunden. Gemessen am 03.11.2026:
alle Commits aus dem Haus, keine
fremden Beiträge; im Abbild `20261103-0952-5e0e3301` 50 Pakete, keines unter
GPL oder AGPL. **Das ist eine Einschätzung ohne Rechtsprüfung**
(`quellen/pruefung/`).

Neu zu prüfen, sobald eines davon eintritt (Pendenz in `docs/pendenzen.md`):

- fremder Code mit eigenem Urheberrecht im Repo (Beitrag von aussen,
  übernommene Datei, Abhängigkeit unter GPL oder AGPL);
- Votum wird an Dritte weitergegeben oder von ihnen betrieben;
- jemand verlangt den Quelltext unter Berufung auf die Lizenz.

## Alternativen

- **Wie immotool bauen** (Archivskript mit Wächtern, Auslieferung, Link im
  Rechtshinweis): nicht jetzt, eine eigene Arbeit ohne rechtlichen Anlass.
- **Erst die Fachprüfung:** nicht gewählt; sie wird mit dem ersten der drei
  Anlässe oben fällig.
