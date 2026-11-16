# 0022: Lesart L3, zweimal zählen bei Handzeichen, beide Ergebnisse nach dem Schliessen

- **Status:** gilt, gebaut in Fassung 2026-10-28 (Lesarten Block 5)
- **Datum:** 2026-10-21
- **Rolle:** Produktentscheid, zwei Fragen

## Wortlaut

**(a) Handzählung an der Einsprache.** Frage: «Bei der Einsprache zählt Votum
neu je Eigentümer, und das Ergebnis je Einheit steht daneben. Wird von Hand
gezählt (Handzeichen), fehlt Votum die Zahl je Einheit. Wie soll die Leitung
dazu kommen?»

> «Zweimal zählen, Pflicht (Empfohlen)»

Die gewählte Möglichkeit lautete: «Die Leitung zählt die Hände je Eigentümer und
je Einheit und trägt beide Zahlen ein. Votum verlangt die zweite Zahl nur, wenn
jemand mit mehreren Einheiten anwesend ist, und nennt diese Personen als
Zählhilfe.»

**(b) Zeitpunkt des zweiten Ergebnisses.** Frage: «Votum zeigt bei jeder
Abstimmung das Ergebnis erst, wenn die Leitung sie schliesst, damit niemand den
Moment nach einem Zwischenstand wählen kann. Das Konzept verlangt für die
Einsprache, dass die Leitung das Ergebnis nach der anderen Zählweise schon vor
dem Schliessen sieht. Was gilt?»

> «Nach dem Schliessen, vor dem Verkünden (Empfohlen)»

## Was gilt

- In einer Gemeinschaft je Einheit trägt die Handzählung an der Einsprache ab
  Fassung 2026-10-28 zwei Dreizahlen (`tally_yes/…` nach der Einstellung,
  `tally_other_yes/…` nach der anderen, Migration 172). Die zweite ist Pflicht,
  sobald eine anwesende stimmberechtigte Partei je Einheit nicht genau eine
  Stimme hat, auch 0 bei einem Nebenobjekt ohne Kopfstimme
  (`einspracheZaehlhilfe`). Ausserhalb von L3 gibt es keine zweite Dreizahl.
- Votum zeigt keinen Zwischenstand. Beide Ergebnisse stehen in der Leitung
  gleich nach dem Schliessen, bevor sie das Ergebnis verkündet; die Texte sagen
  das.

## Anlass

(a) Die Handzählung kennt keine Personen; ein Ergebnis je Einheit lässt sich aus
gezählten Händen je Eigentümer nicht ableiten. Die Einsprache muss innert
14 Tagen beim Eigentümer sein (Art. 712c Abs. 2, Rz. 190 ad Art. 712c), ein
übersehenes anderes Ergebnis lässt sich nicht nachholen. (b) Die Codeprüfung zu
Block 5 (H1) fand, dass die Texte «vor dem Schliessen» versprachen, während die
Anwendung ein Ergebnis bewusst erst beim Schliessen rechnet
(`versammlungen/[id]/leitung/+page.svelte`, «sonst liesse sich der Zeitpunkt
nach dem Zwischenstand wählen»). Ändert Konzept Lesarten, Kriterium 9, in
diesem Punkt.

## Alternativen

- (a) «Zweimal zählen, freiwillig»: weniger Aufwand im Saal, das andere Ergebnis
  kann aber fehlen. «Mehrfach-Eigentümer einzeln»: genauer, doch ihre Stimme
  stünde mit Namen im Protokoll, was die Handzählung sonst vermeidet.
- (b) «Vor dem Schliessen, Ausnahme für die Einsprache»: bricht die Regel gegen
  den Zwischenstand; die Leitung könnte den Moment des Schliessens nach dem
  Stand wählen.
