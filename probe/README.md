# Durchgang gegen die echten Modelle

**Nicht Teil von `npm run pruefen`.** Was hier läuft, braucht Netz, Schlüssel
und fremde Häuser — drei Dinge, die in einem Prüflauf nichts verloren haben, der
vor jedem Commit durchlaufen muss. Ein Prüflauf, der an einem fremden Ausfall
scheitert, wird nach dem zweiten Mal übersprungen.

```bash
docker compose exec -T app npm run probe:ki
```

Geprüft wird der ganze Weg mit dem **echten** Kernmodul, nicht mit einem
Nachbau: erfasste Namen → maskieren → Modell → Namen zurücksetzen.

| Datei | Frage |
|---|---|
| `namensschutz.live.ts` | Erwischt die Maskierung jede Schreibweise? Ohne Netz. |
| `modelle.live.ts` | Hält jede eingerichtete Stufe die Platzhalter durch? |
| `sitzungsleitung.dblive.ts` | Taugt die Traktandenprüfung in den Fällen aus dem Saal? Mit Datenbank. |
| `waechter-k2-kosten.dblive.ts` | Was kostet der Wächter über K2 (Migration 177) auf dem Massenweg, der Übernahme mit Eigentumswechsel? Mit Datenbank, ohne Modell; Ergebnis in `docs/proben.md`. |

```bash
docker compose exec -T app sh -c 'VERSAMMLUNG_PRUEFDB=versammlung_probe_$$ npx vitest run --config probe/db.config.ts'
```

## Befundnachweise

Ebenfalls nicht Teil des Prüflaufs, aber aus dem anderen Grund: Diese Durchgänge
**belegen offene Befunde** aus dem Sicherheitsdurchgang vom 09.10.2026
(`docs/befunde-sicherheitsdurchgang-2026-10-09.md`). Sie behaupten bewusst das
Fehlerhafte, damit der Befund messbar ist, und sie werden **rot, sobald der
Befund behoben ist** — dann gehören ihre Fälle als ordentliche Prüfunge nach
`tests/db/` beziehungsweise `tests/domain/` gezogen und die Dateien hier
weggeräumt.

Zurzeit liegt hier keiner. Der letzte, `anmeldewege-weiter.live.ts` (A1), wurde
mit der Behebung rot und läuft als Fall in `tests/domain/anmeldewege.test.ts`
weiter (Auftrag M2).

`modelle.live.ts` läuft gegen **jede** eingerichtete Stufe. Wer ein Modell neu
in die Kette nimmt, lässt das hier einmal laufen — es kostet ein paar Sekunden
und beantwortet die einzige Frage, die vorher niemand beantworten kann: ob
dieses Modell die Platzhalter unversehrt durchreicht.

Drei Dinge sind dabei aufgefallen und stehen so im Prüfstand:

- **Ein Modell erfindet gelegentlich einen Platzhalter.** Er bleibt sichtbar
  stehen, statt zu einem Namen zu werden — dafür sorgt `enthuelle()`.
- **Ohne Erklärung bemängelt ein Modell die Maskierung selbst** («[Name 1] ist
  kein gültiger Platzhalter»). Deshalb steht im Auftrag, was die drei Formen
  bedeuten und dass sie Absicht sind.
- **Die Anrede bleibt stehen.** «Frau [Person 7b]» verrät das Geschlecht,
  nicht die Person. Sie zu entfernen würde den Satz beschädigen.
