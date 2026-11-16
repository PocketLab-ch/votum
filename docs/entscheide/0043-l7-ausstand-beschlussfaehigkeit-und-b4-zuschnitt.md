# 0043: L7 sperrt je Traktandum; B4 kommt mit zwei Häkchen, ohne Änderung am Entscheidbaum

- **Status:** gilt (L7 ab Migration 183; B4 gebaut mit Block 5 als L8, Migration 184)
- **Datum:** 2026-11-06
- **Rolle:** Produktentscheid nach der Featureprüfung F4c (Rückfrage zu H1, beide nach Empfehlung) und nach der Prüfung von Lauf 1

## Wortlaut

> Inhalt der Entscheide, wie ihn die Übergabe vom 06.11.2026 und die
> Rückfrage nach Lauf 1 festhalten (kein wörtliches Zitat):

- **B2 und B4 kommen in F4c**, vor der Übernahme nach `main`.
- **B2 als Lesart L7 unter «zählt nicht» mit Sperre je Traktandum:** Fehlt die
  Beschlussfähigkeit ohne die Personen im Ausstand, öffnet nur dieses
  Traktandum nicht verbindlich; die übrigen gehen weiter. Vorgabe «zählt mit»
  wie bisher (Entscheid 0014).
- **Keine konsultative Abstimmung an der L7-Sperre**, im Haus wie am
  gemeinsamen Abend (Rückfrage nach der Codeprüfung, nach Empfehlung). Die
  Absage nennt nur: Anwesenheit berichtigen, sonst auf die Liste einer
  späteren Versammlung. Damit entfällt ein eigener Satz für den Abend.
- **Beschluss von Hand unter «zählt nicht»:** Das Protokoll sagt, dass die
  Versammlung nach der Einstellung der Gemeinschaft nicht beschlussfähig war,
  mit Frist und Berechtigten der Anfechtung, wie bei fehlender
  Beschlussfähigkeit.
- **B4 mit zwei Häkchen**, an der Vollmacht («Bevollmächtigt ist die
  Verwaltung») und am Traktandum («Entschädigung, Vertrag oder Entlastung der
  Verwaltung»), ohne Änderung am Entscheidbaum.

## Anlass

Die Featureprüfung F4c (H1) fand, dass die Einstellungen B2 und B4 aus der
Einteilung F3b fehlten. Für B4 kennt Votum weder die Verwaltung als
Vertreterin noch eine Antwort für Entschädigung oder Vertrag, und `k-decharge`
trägt auch die Protokollgenehmigung; ein Knoten dafür hätte den Entscheidbaum
geändert. Nach Lauf 1 blieben zwei Lagen ohne Wortlaut: die Absage am Abend und
der Beschluss von Hand an der Sperre vorbei. Die Codeprüfung fand dann, dass
die Leitungsseite den konsultativen Weg an der Sperre gar nicht anbot und die
Sätze zur konsultativen Abstimmung «nicht beschlussfähig» gesagt hätten,
obwohl die Versammlung beschlussfähig war.

## Wie «hängt an den Personen im Ausstand» gerechnet wird

Satz an die Leitung und Zeile im Protokoll stehen nur, wo die
Beschlussfähigkeit **mit** den Personen im Ausstand gegeben ist und **ohne**
sie nicht (`ausstandsbefund`, `src/lib/domain/anwesenheit.ts`). Die erste
Fassung aus Lauf 1 setzte sie schon, wenn sie ohne diese Personen fehlte; dann
stand der Satz auch dort, wo niemand im Ausstand war (Gegenprüfung Lauf 1).

## Alternativen

- **Konsultativ an der L7-Sperre richtig bauen** (eigener Grund am Durchgang
  wie `neu_an_zweiter` bei L5, eigene Sätze, Häkchen): zurückgestellt, als
  Pendenz nachrüstbar; der Nutzen ist klein, der Text- und Prüfaufwand gross.

- **B2 als Sperre der ganzen Versammlung:** verworfen; der Ausstand gilt je
  Traktandum, und die übrigen Geschäfte sind davon nicht berührt.
- **B4 über einen Knoten im Entscheidbaum:** verworfen, siehe Anlass.
