# 0035: Kein Bildvergleich; e2e/bilder.mjs bleibt ein Blick

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage (zusammen mit 0034): «(a) Bildvergleich, also gespeicherte
Bildschirmbilder, gegen die jede neue Fassung verglichen wird; heute macht
Votum nur Bilder zum Anschauen. Was davon soll A6 bauen?»

> «Nur Anrede bauen (Empfohlen)»

## Anlass

Abgleich T4 mit der Grundausstattung: `e2e/bilder.mjs` nimmt nur auf («Kein
Test, ein Blick»).

## Was gilt

Kein Bildvergleich. Ein Vergleich wackelt an Schrift und Testdaten und braucht
Pflege bei jeder gewollten Änderung; Stil, Farben und Seitenaufbau bewachen
schon `check:css`, `check:stil`, `check:themenfarben` und
`check:seitenaufbau`.

## Alternativen

- Bildvergleich mit gespeicherten Bildern und festen Testdaten.
