# 0016: Gemeinsames Eigentum bei der Beschlussfähigkeit: nach Gesetz, ohne Einstellung, mit Hinweis im Einpersonenfall

- **Status:** gilt, gebaut (Hinweis 20.10.2026)
- **Datum:** 2026-10-20
- **Rolle:** Produktentscheid

## Wortlaut

Erste Antwort des Produktverantwortlichen auf die Frage, wie eine Wohnung im
gemeinsamen Eigentum (Ehepaar, Erbengemeinschaft) bei Art. 712p zählt: «Es
gibt ja noch die Regelung aus dem Reglement, wie gezählt wird. Entweder nach
Reglement oder nach Gesetz.» Auf die Nachfrage, was ohne Regel im Reglement
gilt: «Dann geht es nach Gesetz. Prüfen, was das ist.»

Nach der Fachprüfung (unten) die Frage, ob trotzdem eine Einstellung aus dem
Reglement gebaut wird. Wahl:

> «Keine Einstellung, nur Hinweis (Empfohlen)»

## Begründung

Fachprüfung am Volltext, 20.10.2026 (Agent der auftraggebenden Sitzung):

- Ein gemeinsamer Anteil zählt einmal: Rz. 15 und 16 ad Art. 712p (S. 763),
  Rz. 16a (Mehrfachzählung würde die Beschlussfähigkeit erleichtern), Rz. 14
  ad Art. 712n (S. 703, analog Art. 712o), Rz. 181 ad Art. 712m; ebenso zählt
  BGer 5A_198/2014 E. 6.1.2.
- Eine anwesende Person vertritt den Anteil auch ohne ausdrückliche Vollmacht:
  Rz. 19 bis 24 ad Art. 712o (S. 748 bis 750; «nuancierter» Meier-Hayoz/Rey,
  im Bestand nicht greifbar).
- Rz. 22 ad Art. 712m betrifft Mitgliedschaft und Teilnahme, Rz. 33 ad
  Art. 712p eine Gemeinschaft aus zwei Eigentümern, nicht gemeinsames
  Eigentum. Die frühere Pendenz hatte die beiden zu einem Widerspruch
  verbunden, den keine Stelle zieht.
- Eine Zählung je Person ist nicht durchgehend strenger: Ein anwesendes Paar
  brächte zwei Köpfe und könnte die Schwelle allein erreichen. Ein Reglement
  darf die Beschlussfähigkeit nur erschweren (Rz. 9 ad Art. 712p).

Heikel bleibt der Fall, in dem alle Anteile derselben Gemeinschaft gehören
und nur eine Person da ist: Dass ein Paar als «Einpersonengemeinschaft» gilt
(Rz. 12), sagt keine Stelle wörtlich, und Rz. 4 nennt die Versammlung eine
Zusammenkunft mehrerer Personen.

## Umsetzung

Votum rechnet wie bisher (`beteiligungDerAnwesenden`). Gebaut am 20.10.2026:
Gehören alle Anteile einer Partei aus mehreren Personen (`isCommunity` der
Momentaufnahme), zeigen Leitung und Protokoll statt des Satzes zum einzigen
Eigentümer `EINZIGE_GEMEINSCHAFT(_KURZ)` (`domain/beschlussfaehigkeit.ts`,
`satzZumEinzigen`), dazu das Handbuch; Laien- und Fachprüfung in vier Runden
(`quellen` `pruefung/berichte/2026-10-20-votum-drei-saetze.md`). Das Merkmal
wird nicht gespeichert; es kommt aus der eingefrorenen Momentaufnahme.
