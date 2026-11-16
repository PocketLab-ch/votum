# 0001: Vor jeder Auslieferung vier Durchstiche gegen den gebauten Stand

- **Status:** gilt
- **Datum:** 2026-10-18
- **Rolle:** Auftraggeber

## Wortlaut

Frage: «Die Regel ‹vor jeder Auslieferung vier Durchstiche gegen den gebauten
Stand› hat die bauende Sitzung in M5 gesetzt, nicht du. Soll sie so gelten?»

> «Ja, sie gilt (Empfohlen)»

## Anlass

Der Auftrag M5 (`.auftraege/erledigt/2026-10-13-votum-m5-gebauter-stand.md`)
überliess die Wahl der bauenden Sitzung: «Entscheiden, welche davon in einen
Lauf vor jeder Auslieferung gehören, und das in `AGENTS.md` unter den
Durchstichen festhalten.» Sie legte am 15.10.2026 `herkunft.mjs`,
`rollenumgehung.mjs`, `fremdbetreiber.mjs` und `last.mjs` fest, `last.mjs`
zusätzlich nach Laständerungen (`…/2026-10-13-votum-m5-gebauter-stand-bericht.md`,
«Entscheide und Ablage»). Der
Entwicklungsserver zeigt diese Fragen nicht: SvelteKit schaltet dort den Schutz
gegen fremde Formulare ab, und `adapter-node` ist dort nicht der Server. Beim
Umbau der `AGENTS.md` am 18.10.2026 hat der Auftraggeber die Regel bestätigt,
gewählt wie empfohlen.

## Alternativen

V5 in `docs/pendenzen-sicherheit.md` verlangte `rollenumgehung.mjs`
«automatisch». Die Liste vor der Auslieferung ersetzt das, statt es zu
erfüllen: Die Läufe stehen nicht im Prüflauf und nicht in der CI, weil sie den
gebauten Stand brauchen.
