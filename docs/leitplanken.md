---
title: Leitplanken
description: Was ins Werkzeug gehört, wo es sperren darf, und woran der Stand gemessen wird
date: 2026-09-24
---

# Leitplanken

**Diese Seite ist der Massstab, an dem jede weitere Arbeit gemessen wird.** Sie
ist entstanden, weil ein Randfall über vier Prüfdurchgänge ausgebaut wurde,
während die Frage offenblieb, ob das Werkzeug fertig wird.

**Produktentscheid 24.09.2026:**

> «Das Tool ist nicht der Stein der Weisheit, sondern ein Hilfsmittel, das der
> Sitzungsleiter anwenden kann. Es hat nicht den Anspruch, jeden seltenen Fall
> bis ins Detail zu lösen. Wichtig ist, dass die grundlegenden Abläufe, also
> Traktanden, Fristen, Abläufe, Quoren etc. stimmen. Der Sitzungsleiter
> entscheidet immer. Das Tool gibt Empfehlungen ab — ausser bei zwingend
> notwendigen Schritten.»

## Zwei Achsen, nicht eine Steigerung

**Wesentlich** trennt, was überhaupt ins Werkzeug gehört, von Beiwerk.

**Das Verhalten** trennt, wie das Werkzeug auftritt. Vier Stufen:

| Stufe | Heisst |
|---|---|
| **sperrt** | Der Weg ist zu. Nur wo Gesetz **oder Reglement** keinen Spielraum lassen **und** die Gültigkeit des Beschlusses daran hängt. Bis zum 24.09.2026 stand hier «nur wo das Gesetz keinen Spielraum lässt»; Zeile 11 sperrt auf Grundlage des Reglements und wäre gegen diesen Massstab falsch eingeordnet gewesen |
| **stellt fest** | Eine Zahl oder ein Ergebnis, keine Meinung. Nicht verhandelbar, aber auch keine Absage |
| **empfiehlt** | Ein Satz mit Fundstelle. Die Sitzungsleitung entscheidet und kann weitergehen |
| **zeigt** | Eine Angabe, damit jemand sie sieht. Keine Wertung |

> **Die beiden Achsen sind nicht dasselbe.** Ein erster Entwurf dieser Liste
> führte «zwingend» und «wesentlich» als zwei Spalten und hatte in
> neunzehn von dreiundzwanzig Zeilen zweimal «ja» stehen: Was gesperrt werden
> darf, muss offensichtlich auch richtig sein. Die zweite Spalte trug damit
> keine Information. Erst «gehört es hinein» gegen «wie tritt es auf» trennt
> wirklich.

## Wo mehrere Varianten zulässig sind: eine Einstellung, nicht eine Lesart

**Produktentscheid 29.09.2026:**

> «Bei Themen die mehrere zulässige Auswahl bestehen, soll die Sitzungsleitung
> in den Einstellung Gemeinschaft voreinstellen können. Damit trägt nicht das
> Tool die Verantwortung. Das soll für alle Themen gelten. Default-Wert aber
> vorgeben, was beste Praxis ist.»

Das heisst für jeden Block:

- **Lässt das Recht mehrere Varianten zu**, oder stuft die Fachprüfung eine
  Frage als offen ein, baut Votum nicht eine Lesart fest ein, sondern bietet die
  Varianten als Einstellung an der Gemeinschaft an. Muster sind Zählweise,
  Vollmachtschranke und Änderungsschranke.
- **Die Vorgabe ist die beste Praxis**, nicht automatisch die strengste, und
  ihre Wahl steht mit Fundstelle da. Änderungen gehen in den Verlauf.
- **Geklärtes bleibt eine feste Regel.** Eine Einstellung für eine Frage, die
  der Bestand eindeutig beantwortet, wäre eine Einladung zum Fehler.

Erster Anwendungsfall: wer an einer Universalversammlung als anwesend gilt
(Migration 126, `domain/ausnahmen.ts`). Die schon fest eingebauten Lesarten
daraufhin durchzusehen, ist ein eigener Auftrag.

## Die Liste

`Ist`: **✓** entspricht dem Soll, **~** teilweise, **✗** fehlt, **?** nicht
nachgemessen. Stand 24.09.2026, Zeile 19 nachgeführt nach dem Rückbau,
Zeile 1 nach der Nachmessung, Zeile 3 nach dem Satz bei der Freigabe, Zeile 5
am 29.09.2026 nach der Ausnahme des Reglements. Am 01.10.2026 nachgeführt:
Zeilen 2, 7 und 10 als Voraussetzung der Rechnung, Zeile 19 als Modellgrenze,
Zeilen 5 und 15 mit dem Produktentscheid als Grundlage, Zeilen 20, 22 und 23 um
das Löschen und die Fassungsart.

| # | Schritt | Grundlage | Wesentlich | Soll | Ist | Bemerkung |
|---|---|---|---|---|---|---|
| 1 | Einheiten und Wertquoten | Art. 712e | ja | sperrt | ✓ | **Am 24.09.2026 nachgemessen: bereits gebaut.** Die Freigabe führt den Quotensaldo als Hindernis, nicht als Hinweis (`domain/freigabe.ts`, Kennung `quotensaldo`). Geht die Stammquote nicht auf, entsteht keine Momentaufnahme. Die frühere Bemerkung «sonst kein Verbraucher» war falsch, sie zählte nur `pruefeSalden` und übersah `pruefeGemeinschaftSalden` in `server/freigabe.ts` |
| 2 | Eigentümer und Zuordnung | Art. 712a, 712o | ja | sperrt (Voraussetzung der Rechnung) | ✓ | Wer nicht zugeordnet ist, hat keine Stimme. Fehlt die Zuordnung ganz, weist die Freigabe ab: eine Einheit ohne Eigentümer (`ohne_eigentuemer`) und eine Gemeinschaft ohne erfasste Parteien (`keine_parteien`); sonst fehlte die Bezugsgrösse jeder Zählung. Siehe «Voraussetzungen der Rechnung» |
| 3 | Einberufung: wer beruft ein | Art. 712n Abs. 1 | ja | empfiehlt | ✓ | Die Freigabe **ist** die Einberufung; das Werkzeug fragt nicht, wer einberuft. Seit 24.09.2026 steht bei beiden Freigaben ein Satz dazu, mit Anlassfall (vor Beginn oder nach Ende des Mandats) und Fundstelle (`EINBERUFUNGSZUSTAENDIGKEIT`, `domain/freigabe.ts`) |
| 4 | Einberufungsfrist | Reglement | ja | empfiehlt | ~ | Geprüft wird der **Regelwert** und seine Fundstelle, nicht der Versandtag |
| 5 | Traktandenliste und Ankündigung | Produktentscheid; Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2 | ja | sperrt | ✓ | Absage mit den zwei Wegen Folgeantrag oder Kenntnisnahme, ausser das Reglement gestattet den Beschluss (seit 29.09.2026, Migration 127) oder die Versammlung tagt als Universalversammlung (seit 29.09.2026, Migration 128: vollzählig nach der Einstellung der Gemeinschaft, Bestätigung der Leitung, «kein Beschluss» bei Weggang ohne Stimme oder Widerspruch). Beide Angaben eingefroren bei der Freigabe. Bis dahin sperrte Votum auch dann, was das Gesetz nicht verlangt. Der Beschluss wäre anfechtbar, nicht nichtig; die Sperre trägt der Produktentscheid. **Am gemeinsamen Abend** mehrerer Häuser trägt die Reglements-Ausnahme nicht, weil dort über die Liste des Abends abgestimmt wird |
| 6 | Erfordernis je Traktandum | Art. 647–649b, 712g | ja | sperrt | ✓ | Ohne Erfordernis keine Abstimmung; beim Setzen eingefroren (AD-4). Seit 25.09.2026 sperrt auch eines, das keine Abstimmung trägt: eine Kenntnisnahme als Erfordernis eines Antrags, keine Kopfschwelle, oder nötige Zustimmung Betroffener und niemand eingetragen (Produktentscheid 25.09.2026, `erfordernisluecke`) |
| 7 | Freigabe, Einladung, Zugänge | Art. 712n | ja | sperrt (Voraussetzung der Rechnung) | ✓ | Die Freigabe ist die Stelle, an der die Voraussetzungen der Rechnung geprüft werden: Quotensaldo, Einheit ohne Eigentümer, kein Traktandum, niemand erfasst. Die Einladung ist im Streitfall der Nachweis der Ankündigung. Siehe «Voraussetzungen der Rechnung» |
| 8 | Zehntagesfrist zur Zweitversammlung | Art. 712p Abs. 2 | ja | stellt fest | ✓ | Elf Tage, korrekt gerechnet. Seit 24.09.2026 kein Begründungsfeld mehr, sondern ein Vermerk in Einladung und Protokoll (R-2b). Erfassen bleibt möglich. **Ebenfalls seit 24.09.2026 hinterlegbar** (Migration 122): Verlangt ein Reglement mehr als zehn Tage, rechnen Terminvorschlag, Fristprüfung und Vermerk damit. Weniger wird abgewiesen, im Kern und in der Datenbank — ein Reglement darf die Frist verlängern, nicht verkürzen (Rz. 40 ad Art. 712p) |
| 9 | Zustand: eröffnen, schliessen, versiegeln | — | ja | sperrt | ✓ | Fünf Stufen: entwurf, freigegeben, laufend, geschlossen, versiegelt |
| 10 | Anwesenheit und Vertretung | Art. 712o, 712n | ja | sperrt (Voraussetzung der Rechnung) | ✓ | Bestimmt die Bezugsgrösse des Kopfmehrs; ohne den Stand lässt sich kein Ergebnis rechnen. Einzelne Regeln der Vertretung sperren (Zeile 11), siehe «Voraussetzungen der Rechnung» |
| 11 | Vollmachtsgrenze des Reglements | Art. 712o, Reglement | ja | sperrt | ✓ | Seit 24.09.2026 sperrt `verlangeVollmachtsgrenze()` schon beim Erfassen, in `erfasseInTx` und damit auf allen **fünf** Wegen, die dorthin führen — auch am Einlasstisch, wo dann der ganze Einlass zurückrollt. `ueberschreitungen()` warnt weiter über Altbestand und nachträglich gesenkte Grenzen. Organvertreter, gesetzliche Vertreter und Mitberechtigte zählen nicht mit (Ä-28, Migration 120) |
| 12 | Beschlussfähigkeit | Art. 712p Abs. 1 und 3 | ja | sperrt Abstimmungen | ✓ | `verlangeBeschlussfaehigkeit()` beim Eröffnen einer Abstimmung, seit 17.09.2026. Siehe den eigenen Abschnitt unten |
| 13 | Reihenfolge der Traktanden | — | nein | zeigt | ✓ | Frei änderbar, auch im Saal; das Protokoll hält den Entscheid fest |
| 14 | Stimmberechtigung im Einzelfall | Art. 712o Abs. 1 und 2, Art. 68 | ja | sperrt | ✓ | Ausstand wird von Hand erklärt, dann rechnet das Werkzeug. Befangenheit kann es nicht erkennen |
| 15 | Antrag, Folgeantrag, Gegenantrag | Produktentscheid; Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3 | ja | sperrt | ✓ | Ein Folgeantrag ohne angekündigten Grundantrag wird abgewiesen. Der Beschluss wäre anfechtbar; die Sperre trägt der Produktentscheid |
| 16 | Abstimmung eröffnen und schliessen | — | ja | sperrt | ✓ | Der Anwesenheitsstand wird beim Schliessen eingefroren (AD-16); bei einer Handzählung gilt der Stand beim Zählen (Migration 156) |
| 17 | Auszählung: Köpfe und Wertquoten | Art. 712m Abs. 2 i.V.m. Art. 67 | ja | stellt fest | ✓ | Getrennte Bezugsgrössen; Enthaltung und Nichtabgabe nie vermischen (AD-15) |
| 18 | Ergebnis: Quorum erreicht oder nicht | Art. 647–649b, 712g | ja | stellt fest | ✓ | Keine Empfehlung, eine Feststellung |
| 19 | Rückkommen auf einen Beschluss | Art. 712m, Reglement | ja | sperrt (Modellgrenze) | ✓ | Dieselbe Mehrheit wie für den Erlass. Die Regeln der Anwendung (ein Durchgang je Rückkommen, kein Rückkommen auf den Folgeantrag) bilden einen seltenen Fall nicht ab und sperren mit Absage und Weg; während der Versammlung führt der Notweg «Beschluss von Hand» daran vorbei. Die Grenzen aus Rz. 202a stehen als Hinweis im Vorbehalt, seit 24.09.2026 |
| 20 | Pendenzen | — | nein | zeigt | ✓ | Reine Hilfe; eine offene Pendenz sperrt das Löschen der Versammlung |
| 21 | Protokoll und Beschlusswortlaut | Art. 712n Abs. 2 | ja | empfiehlt | ✓ | Trägt Datum, Unterschriftenblock, Sitzungsleitung und Protokollführung |
| 22 | Genehmigung und Versiegeln | — | ja | sperrt | ✓ | Das Versiegeln sperrt: Danach ist der Stand unveränderlich. «Genehmigt» ist dagegen eine Fassungsart des Protokolls (Schritt «Die Fassung, die genehmigt wird»), keine Sperre |
| 23 | Anfechtungsfrist von einem Monat | Art. 75 i.V.m. Art. 712m Abs. 2 | ja | empfiehlt | ✓ | Genannt in der Fristmeldung, im Versandpaket, beim Abstimmen und in fünf Regelwerksfassungen; solange sie läuft, weist die Datenbank jede Löschung der Versammlung ab |

**Zwei Zeilen sind nicht wesentlich** (13 und 20). Beim Verhalten stehen
vierzehn sperrend (davon drei als Voraussetzung der Rechnung und eine als
Modellgrenze), drei feststellend, vier empfehlend und zwei anzeigend; offen ist
keine mehr. **Soll heisst nicht gebaut** war der Stand vom 24.09.2026: Zeile 1
stand auf «sperrt» und trug im Ist ein ✗; die Nachmessung am selben Tag fand die
Sperre und setzte das Ist auf ✓ (siehe «Was die Nachmessung an Zeile 1 ergab»).
Stand 24.09.2026: Zeile 8 ist an diesem Tag von «sperrt» auf «stellt fest»
gewechselt, und diese Zählung wurde im selben Durchgang übersehen (Code-Review
vom 24.09.2026, Befund 3). Sie steht zwei Zeilen unter der Tabelle und siebzehn
unter der geänderten Zeile — nahe genug, um sie zu finden, weit genug, um sie
nicht zu sehen. Am 01.10.2026 ist die Zählung nach der Angleichung an den
Entscheid vom 30.09.2026 nachgeführt.

> **Berichtigt am 24.09.2026, und die Berichtigung ist der Grund, warum diese
> Seite eine Ist-Spalte hat.** Die erste Fassung setzte Zeile 12 auf ✗ und
> nannte sie «die eine echte Lücke». Das war falsch: Die Sperre steht seit dem
> 17.09.2026 im Code. Der Fehler lag in der Suche, nicht im Urteil — gegrept
> wurde in `domain/abstimmung.ts`, `domain/eingriffe.ts` und
> `server/freigabe.ts`, **nicht** in `server/abstimmung.ts`, wo sie sitzt. Aus
> der leeren Suche und einem Handbuchsatz über die **Anzeige** wurde dann ein
> Befund über das **Verhalten**.
>
> Beim Nachziehen fiel dasselbe an zwei weiteren Zeilen auf. Die
> Vollmachtsgrenze ist nicht «nicht durchgesetzt», sie wird ausgerechnet und
> gemeldet. Und bei den Zeilen 1 und 11 war die Soll-Spalte selbst geraten:
> «sperrt» stand dort, weil die Zeile wichtig wirkte, nicht weil jemand
> entschieden hätte, dass gesperrt werden soll. Sie standen deshalb auf
> **offen**.
>
> **Beide sind am 24.09.2026 entschieden worden**, und jetzt steht «sperrt»
> dort, weil jemand es entschieden hat. Der Unterschied ist nicht der Wert in
> der Spalte, sondern seine Herkunft — und genau deshalb bleibt dieser Absatz
> stehen statt gelöscht zu werden.

## Zeile 12 im Wortlaut, weil sie am häufigsten falsch verstanden wird

Beschlussunfähig heisst **nicht**, dass die Versammlung nicht stattfinden darf.
**Rz. 30 ad Art. 712p:**

> «Die Verletzung von Art. 712p Abs. 1 (bzw. einer allfälligen strengeren
> reglementarischen Beschlussfähigkeitsvoraussetzung) verhindert die
> rechtsgültige Beschlussfassung, hat aber **keine andere Rechtsfolge auf die
> eigentliche Stockwerkeigentümerversammlung**. Die Diskussionsführung ist
> nicht unzulässig, solange keine Beschlüsse gefasst werden.»

**Die Regel fürs Werkzeug:** Abstimmungen gesperrt, Versammlung läuft weiter,
Diskussion wird protokolliert. Die Bestimmung ist relativ zwingend; ein
Reglement darf sie nur erschweren, nicht erleichtern.

**So gebaut seit dem 17.09.2026.** `verlangeBeschlussfaehigkeit()` wirft beim
Eröffnen einer Abstimmung, und der Kommentar dort trägt dieselbe Begründung:
«Der Bestätigungsdialog hätte genau die Willentlichkeit belegt, mit der Rz. 33
eine schwere Verletzung nichtig macht.» Er nennt auch den Ausweg, und zwar den
richtigen: **die Tatsache, nicht die Rechtsfolge.** Ist jemand da, der nicht
erfasst ist, berichtigt die Sitzungsleitung die Anwesenheit; sonst bleiben
Warten und die zweite Versammlung.

## Der Fahrplan, der daraus folgt

| Rang | Zeile | Was zu tun ist |
|---|---|---|
| ✓ | 8 | **Erledigt am 24.09.2026.** Das Begründungsfeld ist weg, an seiner Stelle steht `fristvermerk()`: ein gerechneter Satz in Einladung, Protokoll und Erfassungsvorschau, der die Rechtsfolge nennt und sich nicht wegklicken lässt. Aufgehalten wird niemand. Produktentscheid 23.09.2026, R-2b |
| ✓ | 11 | **Erledigt am 24.09.2026.** Die Vollmachtsgrenze sperrt beim Erfassen. Produktentscheid im Wortlaut: «Das Reglement geht dann vor. Ich würde noch früher ansetzen und beim Erfassen der Vollmachten blockieren. Wenn nämlich ein Beschluss zustande kommt, weil das Reglement nicht eingehalten wird, könnte der Beschluss seine Gültigkeit verlieren (nichtig oder ungültig) und das Protokoll wird anfechtbar.» |
| ✓ | 1 | **Am 24.09.2026 nachgemessen, nichts zu bauen.** Die Sperre, die der Produktentscheid verlangt («sonst stimmen die Berechnungen der Abstimmungen nicht mehr»), steht seit Story 3.5 an der Freigabe. Was fehlte, war nicht der Bau, sondern die Messung: Die Zeile behauptete eine Lücke, die es nicht gab. Einzelheiten unter «Was die Nachmessung an Zeile 1 ergab» |
| ✓ | 3 | **Erledigt am 24.09.2026.** Wer einberuft, prüft das Werkzeug weiterhin nicht; seit diesem Tag nennt es die Frage bei beiden Freigaben, mit Anlassfall und Fundstelle. Bis dahin stand die Zeile hier zusammen mit Zeile 4 als «beides anfechtbar, nicht nichtig». Das war für Zeile 3 falsch: Unter den Mängeln, die an der Freigabe entstehen, ist die unzuständige Einberufung der eine, für den BGer 5A_48/2022 E. 6.1.2.2 und Rz. 212 ad Art. 712m die Nichtigkeit nennen |
| — | 4 | Bewusst offen: Ob der Versandtag die Frist hält, prüft das Werkzeug nicht. Das macht den Beschluss anfechtbar, nicht nichtig |

**Damit ist der Fahrplan leer**, und das ist das eigentliche Ergebnis der
Nachmessung: Von vier Punkten war einer zu bauen, zwei sind Entscheidungen, und
einer war nie ein Problem. **Alle vier sind am 24.09.2026 erledigt**: Zeile 8
gebaut, Zeile 11 entschieden und gebaut, Zeile 1 entschieden und danach als
bereits gebaut nachgemessen. Offen ist nur noch die bewusst offene Zeile 4.
Zeile 3 stand hier bis zum 24.09.2026 mit; sie bleibt bei «das Werkzeug fragt
nicht», erfüllt aber seit diesem Tag ihr Soll «empfiehlt» mit einem Satz bei
der Freigabe.

### Was die Nachmessung an Zeile 1 ergab

Die Zeile stand auf «✗, sonst kein Verbraucher». Gemessen wurde am Code, und
zwar in dieser Reihenfolge:

| Frage | Befund |
|---|---|
| Gibt es einen sperrenden Verbraucher? | Ja. `erhebeFreigabelage` holt `pruefeGemeinschaftSalden` und legt jede Abweichung als Hindernis ab; `gibFrei` wirft bei `!befund.moeglich` |
| Führt daran ein Weg vorbei? | Nein. `state = 'freigegeben'` wird an genau einer Stelle geschrieben (`server/freigabe.ts`), erreichbar über `gibVersammlungFrei` und dessen zwei Aufrufer |
| Deckt die Prüfung die richtige Menge? | Ja. Gezählt wird nur die Stammquote der eigenen Ebene, und genau die ist die Bezugsgrösse der Momentaufnahme. Kostenschlüssel verändern kein Quorum, Untergemeinschaften tragen über ihren Nenner bei |
| Können die zwei Nenner auseinanderlaufen? | Nein. `stweg.quota_denominator` und die Stammquote in `quota_kind` hängen am Trigger `stweg_stammquote_mitfuehren`, der beide gleichzieht |
| Hält eine Probe die Sperre fest? | Ja, auf beiden Ebenen: im Kern und an der Datenbank, dort auch auf dem Weg («weist die Freigabe bei einem Hindernis ab», prüft zusätzlich, dass keine Momentaufnahme entsteht) |

**Der Bestand am 24.09.2026** (Dev): acht Ebenen mit Stammquote, davon eine
unstimmig. Es ist ein Testartefakt mit null Versammlungen, dessen Nenner den
Nenner seiner Untergemeinschaft doppelt zählt. Auf Betrieb gibt es keine
Gemeinschaft. Eine Sperre hätte hier also nichts getroffen, und die Sperre, die
es gibt, trifft auch nichts.

**Die Richtung, die dabei sichtbar wurde**, gilt über Zeile 8 hinaus und ist der
Grund, warum die Zeile jetzt auf «stellt fest» steht und nicht auf «sperrt»: Ein
Pflichtfeld, das nach einer Begründung fragt, sieht aus wie ein vorgesehener
Weg. Wo es keinen gibt, ist die Feststellung gegenüber den Eigentümern das
stärkere Mittel als eine Absage gegenüber der Sitzungsleitung — sie hält
niemanden auf und nimmt doch niemandem die Kenntnis.

**Was ausdrücklich nicht auf dem Fahrplan steht:** die ungültige Stimme, der
Stimmrechtsentzug des Revisionsentwurfs, und jede weitere Verfeinerung an
Zeile 19. Sie stehen auf keiner der beiden Achsen weit genug oben.

## Was der Notweg ändert (Entscheide vom 30.09.2026)

Die Sperren dieser Liste bleiben, wie sie sind. Während die Versammlung läuft,
führt je Traktandum ein Notweg an allen vorbei: **«Beschluss von Hand
festhalten»** (Produktentscheid 30.09.2026; Plan und Handbuch). Vor der
Versammlung (Freigabe) und nach dem Schluss gibt es ihn nicht. Nach dem Schluss
geht ein Beschluss über das Votenfeld des Traktandums ins Protokoll, ohne
Ergebnis in Votum (Produktentscheid 02.10.2026; Handbuch, «Wenn die Versammlung
schon geschlossen ist»). Was der Notweg übergeht,
steht mit Kennung und Satz im Verlauf, unveränderlich und im Siegelpaket; Wand
und Protokoll zeigen das Ergebnis ohne Hinweis auf den Weg, und das Protokoll
nennt bei fehlender Beschlussfähigkeit die Tatsache am Beschluss
(Produktentscheid 01.10.2026), seit dem 02.10.2026 auch das gemeinsame
Protokoll des Abends, je Gemeinschaft. Der Notweg ersetzt die Prüfungen nicht: Er
fährt dieselben Prüfungen trocken und zeigt ihre Absagen, bevor die Leitung
entscheidet.

**Ein Grund, keine Pflichtfrage am Notweg** (Entscheid 0046, A7; seit
11.11.2026). Die Maske fragt nach dem Grund, mit dem Notweg vorgewählt: Wer ihn
nimmt, beantwortet nichts Neues. Pflicht sind Felder nur beim zweiten Grund,
«Eingewendete Bestimmung»: die Bestimmung und wie sie eingeführt wurde, weil das
Protokoll beides nennt und die Ablehnung ohne sie nicht nachvollziehbar wäre.
Die Regel oben (eine Pflichtfrage ist eine halbe Sperre) bleibt damit für den
Notweg unberührt.

### Voraussetzungen der Rechnung

Diese Sperren tragen nicht die Nichtigkeit, sondern die Rechnung: Ohne sie gäbe
es kein bestimmbares Ergebnis. Es gibt keinen Hebel am Ergebnis, nur an der
Tatsache; während der Versammlung führt der Notweg an ihnen vorbei.

- Wertquotensaldo, Einheit ohne Eigentümer, kein Eigentümer erfasst (Freigabe:
  `quotensaldo`, `ohne_eigentuemer`, `keine_parteien`)
- eine Vollmacht je Partei; keine Vollmacht für Anwesende; wer vertreten wird,
  vertritt nicht; eine bestehende Vertretung sperrt eine neue
- eine offene Abstimmung zugleich (Migration 020)
- Erfordernis mit Kopfschwelle, keine Kenntnisnahme als Erfordernis eines
  Antrags
- keine Handzählung, wo Wertquoten oder Einstimmigkeit zu zählen sind
- Betriebsart nach der Eröffnung fest
- das Ergebnis der Auszählung

### Abweichungen der Leitung

Das Muster steht in der Einordnung, «Das Muster ‹Leitung weicht ab›». Gebaut
sind die vier Arten in `ABWEICHUNGSARTEN` (`domain/verlauf.ts`): Erfordernis
übersteuern, Einzelleitung am gemeinsamen Abend, KI-Entscheid und seit dem
01.10.2026 der Beschluss von Hand. Keine von ihnen geht ins Protokoll; der
Wächter `tests/domain/abweichungsarten.test.ts` hält das fest. Die gemeinsame
Form der Angaben (`abweichung = { empfohlen, gewaehlt, … }`) fehlt noch; gebaut
ist sie als `abweichung: { uebergangen }` am Beschluss von Hand (Einordnung,
Muster, Punkt 1; offen).

### Gemeinsamer Abend

Die Einzelleitung eines Hauses bleibt als Notweg erreichbar, wenn der Abend
nicht greifbar ist; jede ihrer Handlungen wird mit `meeting.day.bypassed` im
Verlauf als «gewählt» festgehalten. Seit dem 01.10.2026 steht der Beschluss von
Hand auch dort, im Notweg-Kasten der Hausseite; unter «Jetzt möglich» steht er
am Abend nicht, damit es ihn je Lage genau einmal gibt. Bei offener Abstimmung
steht der Notweg-Kasten am Ende des Geschäftskastens, nur mit «Abstimmung
schliessen» und der Maske (Lauf B, 03.10.2026).

### Rückzug, Vertagen, Neuabstimmung

Sie sind keine Abweichung, sondern Teil des Ablaufs, und stehen zu Recht im
Protokoll (Muster, Punkt 7). Das Rückkommen dagegen beschliesst die
Versammlung; die Regeln der Anwendung (ein Durchgang je Rückkommen, kein
Rückkommen auf den Folgeantrag) stehen in Zeile 19.

### Archivieren und Löschen

Das Löschen einer Versammlung sperren: das fehlende Siegel, das nicht als
genehmigt festgehaltene Protokoll, eine offene Pendenz der Versammlung und die
laufende Anfechtungsfrist; das steht im Handbuch, Abschnitt «Aufbewahren und
löschen». Archivieren ist ein Zustand, kein Löschen.

## Wie diese Seite benutzt wird

**Vor jedem Block eine Zeile suchen.** Steht die Arbeit in keiner Zeile, ist sie
kein Block, sondern höchstens ein Satz.

**Das Verhalten ist eine Entscheidung, keine Folge der Wichtigkeit.** Eine Zeile
kann wesentlich sein und trotzdem nur empfehlen. Eine Pflichtfrage ist eine
halbe Sperre: Sie hält auf und erzwingt eine Erklärung, die ins Protokoll geht.
Das ist zu viel für eine Empfehlung.

**Ein Prüfbefund über eine Zeile, die nicht wesentlich ist, wird nicht
verbessert, sondern gestrichen.** Die Prüfungen finden echte Fehler auch in
Dingen, die gar nicht gebaut werden sollten.

## Verwandt

- [Eine Versammlung führen](versammlung-fuehren.md) — dieselben Schritte als Anleitung
- Repo `quellen`, `themen/stockwerkeigentum/` — die Fundstellen hinter jeder Zeile
