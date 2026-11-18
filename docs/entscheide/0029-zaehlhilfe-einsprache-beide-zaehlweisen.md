# 0029: Zählhilfe an der Einsprache für beide Zählweisen

- **Status:** gilt
- **Datum:** 2026-10-29
- **Rolle:** Produktentscheid, Entscheidrunde A0 (`.auftraege/erledigt/2026-10-29-votum-ablaufplan-pendenzen-und-freigabe.md`)

## Wortlaut

Frage: «Wenn bei der Einsprache von Hand gezählt wird, listet Votum heute nur
für die Zählung ‹je Einheit› auf, wessen Hand mehr als eine Stimme zählt. Für
‹je Eigentümer› (Vollmachten zählen mehr, ein Ehepaar zusammen nur einmal) gibt
es keine solche Liste. Bauen?»

> «Bauen in A5 (Empfohlen)»

## Anlass

Laienprüfung Lesarten Block 5, Runde 2, R2-5 (`quellen`
`pruefung/berichte/2026-10-21-votum-lesarten-block5-laien-runde2.md`):
In einem grösseren Haus würde die Leitung ohne Liste falsch zählen. Heute gibt
`einspracheZaehlhilfe` (`src/lib/domain/auszaehlung.ts`) nur die Parteien
aus, die je Einheit nicht genau eine Stimme haben, mit dem Vorsatz «Bei der
Zählung je Einheit …» (`EINSPRACHE_ZAEHLHILFE_VORSATZ`).

## Was gilt

Die Zählhilfe nennt für beide Zählweisen, wessen Hand mehr oder weniger als
eine Stimme zählt, mit Vertretenen. Gebaut in Schritt A5; der neue Satz geht
durch Laien- und Fachprüfung.

Gebaut mit `0b6bfda2` (A5).
