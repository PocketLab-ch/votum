# 0031: Aufteilen der Stimmen an der Einsprache bleibt angeboten

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/erledigt/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage: «Hat jemand zwei Wohnungen und stimmt mit der einen Ja, mit der anderen
Nein, zählt bei der Einsprache ‹je Eigentümer› seine eine Stimme gar nicht, und
Votum zeigt einen Hinweis. Die Oberfläche lässt dieses Aufteilen dort zu (weil
die Gemeinschaft sonst je Einheit zählt). So lassen?»

> «So lassen (Empfohlen)»

## Anlass

Codeprüfung Lesarten Block 5, N8. Verhalten und Begründung stehen an `kopfwahl`
(`src/lib/domain/auszaehlung.ts`).

## Was gilt

Die Oberfläche bietet das Aufteilen nach der Zählweise der Gemeinschaft an,
auch an einer Einsprache nach L3 «je Eigentümer». Widersprechen sich die
Einheiten einer Partei, bleibt ihre Kopfstimme ungebildet, und ein Hinweis sagt
es. Votum wählt keine Richtung.

## Alternativen

- Aufteilen an dieser Einsprache sperren: Eingriff an der Stimmerfassung, ohne
  dass das heutige Verhalten falsch rechnet.
