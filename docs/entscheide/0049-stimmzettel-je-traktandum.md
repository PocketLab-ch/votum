# 0049: Papierstimmzettel je Traktandum, in zwei Teilen nach dem Mehr

- **Status:** gilt
- **Datum:** 2026-11-14
- **Rolle:** Produktentscheid, im Gespräch über ein ausgedrucktes Stimmzettel-PDF

## Wortlaut

Frage: «Müssten das Blatt bspw. nicht in Viertel unterteilt werden, mit
Trennlinie zum Schneiden, und jeder Viertel trägt Name, Stimmverhalten,
Traktandum, Versammlungsdatum, STWEG und dann Unterschrift?»

Auf den Vorschlag (ein Zettel je Traktandum, Bündel je Person, Ersatzzettel,
Quotenspalte im Zählblatt nur, wo sie zählt, Ergebnisspalte): «sonst stimmt es
für mich so.»

Zur Zählweise: «Handheben kann man auch. So hat man aber die Möglichkeit beides
zu entscheiden. Sortieren, was mit einfachem Mehr abgestimmt werden kann und
was qual. Mehr braucht oder Einstimmigkeit.»

## Anlass

Der Papierstimmzettel (Ausfallsicherung) trug je Partei ein Blatt mit mehreren
Traktanden und einer Unterschrift je Blatt; nur qualifizierte Traktanden
bekamen seit dem 28.08.2026 ein eigenes Blatt. Damit liess sich über spätere
Traktanden vor ihrer Beratung ankreuzen, ein Blatt erst nach seinem letzten
Traktandum einsammeln, und ein abgetrenntes Folgeblatt nannte weder
Gemeinschaft noch Datum.

## Was gilt

- Je Traktandum mit Abstimmung ein Zettel im Viertel A4, gestrichelte
  Schnittlinien. Jeder Zettel trägt Gemeinschaft, Datum, Traktandum mit Titel
  und Antrag, nötiges Mehr, Partei mit Einheit und Stimmgewicht, Ja/Nein/
  Enthaltung und Unterschrift.
- Zwei Teile: vorne die Traktanden, an denen Handerheben nicht genügt
  (qualifiziertes Mehr, Einstimmigkeit, noch offenes Mehr, und jedes einfache
  Mehr, für das Votum eine Auszählmappe verlangt, etwa bei Stichentscheid nach
  Wertquoten oder ungleichen Kopfstimmen; dieselbe Regel `brauchtRechnung`),
  hinten die übrigen. Die Sitzungsleitung entscheidet, ob sie dort Hände zählt
  oder Teil 2 druckt.
- Je Teil nach Person, jede Person auf eigenen Seiten; freie Plätze in ihrem
  Bündel werden Ersatzzettel mit ihrem Namen für einen geänderten oder neuen
  Antrag. Gehen die Plätze genau auf, gibt es keinen.
- Passt der Antrag nicht auf ein Viertel, die halbe Seite; reicht auch die
  nicht, gekürzt mit Hinweis auf die Traktandenliste.
- Das Zählblatt steht vorne, nennt die Seiten jedes Teils, führt die
  Quotenspalte nur bei Traktanden, an denen die Summe der Wertquoten gebraucht
  wird (Schranke oder Stichentscheid), und eine Spalte für das Ergebnis.

## Alternativen

- Ein Blatt je Partei wie bisher: verworfen aus den Gründen unter «Anlass».
- Zettel nur für Traktanden mit Quotenmehr: verworfen, die Sitzungsleitung soll
  auch beim einfachen Mehr schriftlich abstimmen lassen können.
- Teile nach Mehr innerhalb des Bündels einer Person statt im ganzen Dokument:
  verworfen, weil Teil 2 sich dann nicht getrennt drucken liesse.

## Umsetzung

`src/lib/server/pdf/stimmzettel.ts`, Route
`src/routes/versammlungen/[id=kennung]/stimmzettel.pdf/+server.ts`, Test
`tests/db/stimmzettel.test.ts`, Regel `zaehlweisen` in
`src/lib/server/ausfallsicherung.ts`, Handbuch `docs/versammlung-fuehren.md`,
Abschnitt «Wenn der Server ausfällt: der Weg auf Papier».
