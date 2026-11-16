# 0024: Lesart L5, unverbindliche Abstimmung trotz Sperre und Fussnote in der Einladung

- **Status:** gilt, gebaut in Lesarten Block 7 (Migration 174)
- **Datum:** 2026-10-22
- **Rolle:** Produktentscheid, zwei Fragen

## Wortlaut

**(a) Unverbindlich abstimmen.** Frage: «Ein neues Geschäft an der zweiten
Versammlung ist gesperrt, weil zu wenige Eigentümer da sind. Darf die
Versammlung trotzdem unverbindlich ihre Meinung dazu abgeben, so wie heute,
wenn sie gar nicht beschlussfähig ist?»

> «Ja (Empfohlen)»

**(b) Einladung.** Erste Frage: «Soll die Einladung zur zweiten Versammlung das
bei diesen Geschäften kurz sagen?» Antwort: «Was sagt das Recht und oder die
Kommentare dazu?» Nachgesehen und berichtet: Art. 712p Abs. 2 und 3 regeln den
Inhalt der Einladung nicht; Pflicht ist nur, das Geschäft anzukündigen
(Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3 ZGB; Rz. 49 ad Art. 712p: «Neue
Traktanden müssen aber formell korrekt mitgeteilt werden»). Der Satz wäre ein
Dienst, keine Pflicht. Zweite Frage, mit diesem Befund: «Soll die Einladung ihn
tragen?»

> «Ja, als Tatsache (Empfohlen)»

Dazu, während des Baus: «Damit die Einladung ggf. nicht überladen wird, könnte
man dies mit einer Fussnote 1 oder * verweisen.»

## Was gilt

- Gesperrt nach L5 zählt als fehlende Beschlussfähigkeit für dieses
  Traktandum: Die konsultative Abstimmung ist zulässig (Migration 158), die
  verbindliche nicht (`pruefstufeFuerTraktandumIn`, `server/neutraktanden.ts`).
- Nach der Vorgabe `erste` tragen Einladung und Traktandenliste am Titel jedes
  neuen Traktandums das Zeichen «¹» und unter der Liste einmal die Fussnote
  (`neutraktandenFussnote`, `domain/einladung.ts`). Sie nennt die Bedingung
  der ersten Versammlung, mit der Regel des Reglements, falls hinterlegt, und
  sagt nichts zur offenen Rechtsfrage. Nicht auf dem Beamer; bei der milden
  Wahl nirgends.

## Alternativen

- (a) Keine unverbindliche Abstimmung über ein gesperrtes Geschäft.
- (b) Kein Satz in der Einladung; nur der Rat an die Verwaltung auf der
  Traktandenseite. Ein Satz im Anschreiben statt einer Fussnote.
