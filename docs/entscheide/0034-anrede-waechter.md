# 0034: Ein Anrede-Wächter hält die Sie-Form

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/erledigt/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage (zusammen mit 0035): «(b) Anrede-Wächter, der Alarm gibt, wenn in einem
Text an Leitung oder Eigentümer ‹du› statt ‹Sie› steht; heute ist alles in
Sie, nur die Aufträge an das Sprachmodell duzen. Was davon soll A6 bauen?»

> «Nur Anrede bauen (Empfohlen)»

## Anlass

Abgleich T4 mit der Grundausstattung (19.10.2026): Den Umlauten wacht
`check:umlaute`, der Anrede keiner. Im Haus wird nach innen geduzt; das kann in
Votum-Texte rutschen. Stichprobe 29.10.2026: Die Oberflächentexte reden mit
«Sie»; «du» steht nur in den Aufträgen an das Sprachmodell. Die Stichprobe
nannte zwei Dateien; gemessen beim Bau am selben Tag sind es vier
(`src/lib/domain/erfordernisvorschlag.ts`, `antragspruefung.ts`,
`protokollentwurf.ts`, `traktandenpruefung.ts`).

## Was gilt

Ein Wächter unter `scripts/` mit Gegentest, im Prüflauf: `npm run
check:anrede` (`scripts/check-anrede.mjs`, `tests/waechter/anrede.test.ts`).
Die Aufträge an das Sprachmodell stehen je Datei mit Grund in
`scripts/anrede-ausnahmen.tsv`.
