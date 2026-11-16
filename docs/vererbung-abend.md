---
title: Was der Abend vorgibt und was das Haus behält
description: Die Matrix für den gemeinsamen Abend — was der Saal setzt, was die Gemeinschaft behält
date: 2026-08-25
---

# Was der Abend vorgibt und was das Haus behält

**Der Anlass** (Auftraggeber, 25.08.2026): «Die Gruppenveranstaltung muss genau das
können, was die Einzelveranstaltung kann […] Die Gruppe gibt die Einstellungen
für die angehängten Einheiten vor. […] Mache eine Matrix wo zwingend Hart sein
muss und wo es abweichungen geben darf.»

## Die tragende Regel

Nicht der Abschnitt der Seitenleiste entscheidet, sondern die Frage, **worauf
sich die Sache bezieht**:

> **Hart ist, was den SAAL betrifft. Individuell ist, was die GEMEINSCHAFT
> betrifft.**

Ein Saal hat eine Zeit, einen Ort, eine Abstimmungsweise und einen aufgerufenen
Punkt — davon gibt es je Abend genau eines, und zwei verschiedene wären im
Raum sichtbar Unsinn. Eine Gemeinschaft hat ihr Reglement, ihre Wertquoten,
ihre Eigentümer, ihre Vollmachten und ihr Protokoll — das sind ihre
Rechtsverhältnisse, und der Abend darf sie nicht antasten.

Vier Stufen:

| Stufe | Bedeutung |
|---|---|
| **hart** | Der Abend setzt es, das Haus kann es nicht ändern. Beim Zuordnen wird ein abweichender Wert überschrieben — mit Vermerk im Verlauf beider Seiten. |
| ~~weich~~ | War als dritte Stufe gedacht (Abend schlägt vor, Haus darf abweichen). Beim Durchgehen blieb **kein einziger Fall** übrig — siehe unten. Die Stufe steht hier nur, damit die nächste Sitzung sie nicht neu erfindet. |
| **individuell** | Der Abend rührt es nicht an. Es gibt keine gemeinsame Fassung. |
| **gerechnet** | Keine Eingabe, deshalb auch nichts zu vererben. Der Wert entsteht aus anderen Angaben und wird je Haus neu gerechnet. Seit dem 24.09.2026, mit dem Fristvermerk (Befund R-2b); bis dahin kam die Stufe nicht vor. |

## Die Matrix

### Einstellungen der Versammlung

| Sache | Feld | Stufe | Warum |
|---|---|---|---|
| Datum | `meeting_date` | **hart** | Ein Abend ist ein Abend. Zwei Daten im selben Saal gibt es nicht. |
| Uhrzeit | `start_time` | **hart** | dito |
| Ort | `location` | **hart** | dito |
| **Betriebsart** (Papier / Handy) | `operation_mode` | **hart** | Im Saal wird einheitlich gezählt. Halb Handzeichen, halb Telefon liesse sich nicht führen: Der Einlass, die Wand und die Stimmerfassung folgen ihr, und die Sitzungsleitung müsste zwei Verfahren gleichzeitig führen. **Gebaut am 25.08.2026** (Migration 082): Der Abend führt die Spalte selbst, die Angabenseite fragt «Wie wird abgestimmt?», und beide Wege ins Haus — Zuordnen und Umlegen — nehmen sie mit. |
| Art (ordentlich / ausserordentlich) | `kind` | **hart** | Auftraggeber, 25.08.2026: «Wenn eine ordentliche Versammlung stattfindet, kann nicht zugleich eine ausserordentliche stattfinden.» Er hat recht, und meine erste Einstufung war falsch: Ich hatte an ein Haus gedacht, das daneben eine dringliche Sanierung führt — das wäre aber eine **eigene Versammlung an einem anderen Termin**, nicht dieser Abend. |
| Anlass | `occasion` | **hart** | folgt der Art |
| **Stufe** (erste / zweite Versammlung) | `tier` | **individuell** | ZGB 712p Abs. 2. Ob eine Versammlung die *zweite* ist, hängt allein daran, ob die **erste dieser Gemeinschaft** beschlussunfähig war. Am selben Abend kann Haus A seine erste und Haus B seine zweite halten — und die Stufe ändert das Quorum. Eine harte Vorgabe würde hier rechnen, was rechtlich nicht stimmt. |
| Abstand zur Vorversammlung | `interval_note` | **gerechnet** | Seit dem 24.09.2026 keine Eingabe mehr, die vererbt werden könnte (Befund R-2b, Migration 119). Die Spalte hiess `interval_justification` und hielt eine getippte Begründung; jetzt hält sie den Vermerk, den `fristvermerk()` aus Datum und Vorgängerdatum rechnet. Der Abend verschiebt die Daten der Häuser, also wird der Vermerk je Haus neu gerechnet — vererbt wird nichts. |

### Vorbereiten

| Schritt | Stufe | Warum |
|---|---|---|
| Einheiten und Wertquoten | **individuell** | Grundbuch. Es gibt keine gemeinsame Fassung. |
| Eigentümer und Zuordnung | **individuell** | dito |
| Reglement und Quoren | **individuell** | Jede Gemeinschaft hat ihr eigenes Reglement — das Beispiel des Auftraggebers, und der häufigste Fall bei gewachsenen Anlagen. |
| Beschlussfähigkeit | **individuell** | folgt aus Reglement und ZGB je Gemeinschaft |
| **Traktandenliste** | **hart + Zusatz** | Die Geschäfte des Abends erzeugen je Haus ein Traktandum; darüber wird gemeinsam gesprochen. Ein Haus muss aber ein **eigenes** aufnehmen können — das ist heute schon so gebaut und darf nicht verloren gehen. «Hart» heisst hier: Die gemeinsamen Punkte lassen sich im Haus nicht entfernen oder umbenennen. |
| Mehrheitserfordernisse | **individuell** | Dasselbe Geschäft kann in Haus A qualifiziertes Mehr brauchen und in Haus B einfaches — weil die Reglemente verschieden sind. Eine harte Vorgabe rechnete in einem der beiden Häuser falsch. |

### Ausgeben

| Schritt | Stufe | Warum |
|---|---|---|
| Freigeben | **individuell** | Die Freigabe ist der Rechtsakt «diese Einladung gilt». Sie geht je Gemeinschaft an deren Eigentümer, mit deren Frist. |
| Einladung erzeugen | **individuell** | je Gemeinschaft, mit deren Traktanden |
| Zugänge erzeugen | **abgeleitet** | Ob es Zugangskarten gibt, folgt der Betriebsart (hart). Welche, folgt dem Eigentümerstand (individuell). |
| Ausfallsicherung | **individuell** | Blätter je Haus |

### An der Versammlung

| Schritt | Stufe | Warum |
|---|---|---|
| Vollmachten | **individuell** | Eine Vollmacht gilt für **eine** Gemeinschaft. Wer in zwei Häusern Eigentümer ist, erteilt zwei — zusammengelegt würde aus zwei Erklärungen eine, und im Anfechtungsfall stünde nicht mehr fest, wofür unterschrieben wurde. |
| Anwesenheit | **individuell, gemeinsam bedient** | Gezählt wird je Gemeinschaft; der Eingang führt eine Liste über alle. Das ist heute schon so. |
| **Versammlung führen** | **hart** | Ein Saal, ein aufgerufener Punkt, eine Pause. Hier liegt der Kern der gemeinsamen Führung. |
| Tafel im Saal | **hart** | Eine Wand |

### Danach

| Schritt | Stufe | Warum |
|---|---|---|
| Auswertung | **individuell** | Ergebnisse je Gemeinschaft |
| **Protokoll** | **hart** | Auftraggeber, 25.08.2026: «Das Protokoll ist auf Stuffe Gruppe.» — Richtig, und so ist es seit dem 24.08. gebaut: **ein** Protokoll für den Abend, mit den Beschlüssen je Gemeinschaft darunter. Eine Versammlung am Abend führt kein eigenes mehr, ihre Seite verweist. Zwei Protokolle über dieselbe Sitzung wären zwei Fassungen desselben Beschlusses, und im Streit gälte die falsche. Meine erste Einstufung «individuell» war falsch. |
| Genehmigung des Protokolls | **individuell** | Im Folgejahr genehmigt jede Gemeinschaft den sie betreffenden Teil. Über fremde Teile beschliesst niemand. |
| **Versiegeln** | **individuell, gemeinsam ausgelöst** | Kein gemeinsames Siegel — ein Abschlusspaket trägt acht Bestandteile, und alle gibt es nur je Gemeinschaft (wer stimmberechtigt war, Anwesenheit, Vollmachten, Nachweise, Traktanden, Durchgänge, Anhänge, Auswertung). Ein gemeinsames Paket müsste sie vermengen; im Anfechtungsfall bekäme ein Haus fremde Stände mitgeliefert. Dazu: Die Häuser schliessen zu verschiedenen Zeiten, und ein vertagtes hat gar keine Beschlüsse. **Was der Abend abnimmt, ist das Klicken** — seit dem 25.08.2026 gibt es «Danach → Versiegeln» mit einem Knopf für alle. |

## Wo diese Matrix von der ersten Vermutung abweicht

Der Vorschlag des Auftraggebers war: «Vorbereitung individuell inkl. Freigaben, ausser die
Traktandenliste. Die Steuerung und der Rest müssten hart sein.» Das trifft
vier Fünftel. Drei Stellen liegen anders:

1. **«Der Rest» ist geteilt.** Beim **Protokoll** hat der Auftraggeber recht und ich lag
   falsch: Es ist eines für den Abend, seit dem 24.08. so gebaut. Beim
   **Siegel** und bei der **Auswertung** geht es nicht — das sind Pakete und
   Zahlen je Gemeinschaft. Beim Siegel bleibt aber der Auslöser gemeinsam.
2. **Die Traktandenliste ist hart mit Zusatzrecht.** Die gemeinsamen Punkte
   liegen fest, ein eigenes Traktandum bleibt möglich.
3. **Die Stufe** (erste/zweite Versammlung) war nicht erwähnt und muss
   individuell bleiben — sie ist die Angabe, die das Quorum verschiebt.

Und eine Stelle lag bei **mir** falsch: Ich hatte Art und Anlass als «weich»
eingestuft. Der Auftraggeber hat das korrigiert (siehe oben). Damit gibt es die Stufe
«weich» in dieser Matrix **gar nicht mehr** — jede Angabe ist entweder Sache
des Saals oder Sache der Gemeinschaft. Das ist kein Zufall, sondern folgt aus
der tragenden Regel: Dazwischen liegt nichts.

## Was die Einzelsicht dann noch anbietet

Auftraggeber, 25.08.2026: «Bedeutet, wenn die Gruppe mit Hart im Lead ist, sollte man in
der Einzelveranstaltung keine Einstellungen machen können. Also keine Steuerung
der Präsentation etc. richtig?»

**Richtig, und zwar aus demselben Grund wie die Matrix.** Zwei Steuerungen für
einen Saal laufen auseinander — genau das war der Fehler vom 25.08.2026
(Commit `9e17ef6`): Die Häuser standen auf verschiedenen Punkten, und die
gemeinsame Sicht zeigte den falschen.

Für ein Haus, das zu einem Abend gehört, gilt deshalb:

| Was | In der Einzelsicht |
|---|---|
| Traktandum aufrufen / zurücknehmen, Abstimmung öffnen und schliessen, Pause, Wandbild | **weg**, mit Verweis auf die gemeinsame Leitung |
| Stimmen erfassen, stellvertretend stimmen, Voten, Ausstand | **bleibt** — es ist die Sache der Gemeinschaft, und der Abend führt dieselben Masken mit dem Haus im Formular |
| Vollmachten, Anwesenheit, Protokoll, Auswertung, Siegel | **bleibt** |

**Ein Notweg bleibt erreichbar**, aufgeklappt und benannt: Ist der Abend nicht
greifbar — Zuordnung versehentlich gelöst, zwei Geräte, ein Fehler —, muss sich
ein Haus noch führen lassen. Was verschwindet, ist der *erste* Weg, nicht jeder.

**So gebaut seit dem 25.08.2026.** Drei Teile, weil einer allein nicht hält:

1. **Ein Kasten ganz oben** in der Sitzungsleitung des Hauses: «Dieser Saal wird
   gemeinsam geführt», mit dem Weg zur gemeinsamen Leitung. Er steht nicht neben
   den fehlenden Knöpfen, sondern vor ihnen — wer die Steuerung sucht, soll den
   Weg finden, bevor er sie vermisst.
2. **Die Knöpfe verschwinden**: Aufrufen (an fünf Stellen), Abstimmung
   öffnen/schliessen, Pause, Wandbild. Ein Knopf, der in eine Absage führt, ist
   schlimmer als keiner.
3. **Und der Server weist sie ab.** Ohne das wäre es eine Anzeigefrage: Ein
   zweites Gerät mit einer alten Seite, ein Lesezeichen, ein zurückgeschickter
   Verlauf — und die zweite Steuerung wäre wieder da. Die Absage nennt den Abend
   beim Namen und sagt, warum.

**Beide Enden jedes Weges.** Das Wandbild steht an zwei Stellen — am Eingang und
in der Sitzungsleitung —, und es ist dieselbe Wand. Nur die Leitung zu sperren
hiesse, den zweiten Weg offen zu lassen; die Häuser liefen dann über den Eingang
auseinander.

Der Notweg schickt `notweg=ja`; nur damit lässt der Server die Handlung durch.
**Seit dem 30.09.2026 hält er die Wahl im Verlauf fest** (`meeting.day.bypassed`,
mit Aktion und Abend, `abendSperrt` in `server/versammlungstag.ts`). Der
Kommentar an `nurWennNichtAmAbend` versprach das seit dem 25.08.2026, geschrieben
wurde es nie (Erhebung der Sperrstellen, Befund 1).
Er trägt Aufrufen, Abstimmung öffnen und schliessen sowie die Pause — genug, um
ein Haus zu Ende zu führen, wenn der Abend ausfällt.
Seit dem 01.10.2026 steht im Kasten zusätzlich die Maske «Beschluss von Hand
festhalten» (Block 2b, `docs/plan-beschluss-von-hand-2026-09-30.md`); der Server
lässt damit acht Aktionen über den Notweg durch.

## Wie eine harte Angabe ins Haus kommt

Zwei Wege, und beide gehen über dieselbe Rechnung (`planeUmlegung`) — zwei
Rechnungen für dieselbe Frage liefen auseinander, und die eine wäre die stille:

1. **Beim Zuordnen** (`nimmInTagAuf`). Bis zum 25.08.2026 war das Zuordnen rein
   organisatorisch: Die Versammlung hing am Abend und behielt ihren eigenen
   Tag, ihren eigenen Ort und ihre eigene Abstimmungsweise. Ein Hinweis sagte es
   sogar — und niemand las ihn zweimal. Am Abend standen dann sechs Termine für
   einen Saal. Jetzt zieht die zugeordnete Versammlung nach, und der Satz danach
   nennt, was übernommen wurde.

   **Nur diese eine.** Wer Haus F anhängt, stellt nicht A bis E mit um.

2. **Beim Häkchen auf der Angabenseite** («Auf N mittagende Versammlungen
   übernehmen»). Das meint ausdrücklich alle.

**Die Grenze ist in beiden Fällen die Freigabe.** Ab da steht der Tag in
versandten Einladungen; ihn zu überschreiben hiesse, etwas zu ändern, das
jemand schon gelesen hat. Solche Versammlungen bleiben stehen und werden
**genannt** — nicht mitzuziehen ist eine Aussage, kein Schweigen.

## Was das für die Oberfläche heisst

Die Laientauglichkeit hängt nicht an der Matrix, sondern daran, dass man sie
**nicht lesen muss**:

* Eine harte Angabe steht im Haus da, wo sie hingehört, aber **ohne Knopf** —
  mit einer Zeile «kommt von …» und einem Verweis dorthin. Kein ausgegrautes
  Feld, kein Fehler beim Speichern. So gebaut seit dem 25.08.2026
  (`VersammlungFormular`, Eigenschaft `vomAbend`): Tag/Beginn/Ort, Art und
  Abstimmungsweise erscheinen als Satz, das wievielte Treffen bleibt ein
  Formular.
* **Und der Server nimmt sie auch nicht an.** Das Formular schickt die harten
  Felder gar nicht mehr; die Speicheraktion setzt sie aus dem Abend. Ein von
  Hand nachgereichtes Feld kommt so nicht durch — was die Oberfläche nicht
  anbietet, soll der Server nicht annehmen. (Ohne diesen Schritt wäre der Wert
  **leer** angekommen, und `pruefeVersammlung` hätte mit «Das Datum der
  Versammlung fehlt» abgebrochen.)
* Individuelles sieht aus wie bei einer einzelnen Versammlung — dort ändert
  sich nichts.

**Ein Notweg bleibt:** Der Umschalter der Abstimmungsweise am **freigegebenen**
Haus. Ohne ihn hätte ein Haus, dessen Technik am Tag davor ausfällt, gar keinen
Ausweg mehr. Läuft es dadurch auseinander, sagt es die Karte «Zusammen mit
anderen?» als Warnung — seit dem 25.08.2026 nennt `abendabweichung` auch die
Abstimmungsweise, nicht nur Tag und Ort.

## Der Fall: eine beschlussfähig, vier nicht

Auftraggeber, 25.08.2026: «Wenn nur eine von fünf einheiten beschlussfähig sind, wird
die Sitzung mit der beschlussfähigen Gemeinschaft durchgeführt. Die anderen
brauchen einen neuen Termin, frühestens in 10 Tage später. Wobei auch die
Gemeinschaft entscheiden kann, die Sitzung zu verschieben.»

**Gebaut am 25.08.2026**, in drei Schritten — und in dieser Reihenfolge, weil
jeder den nächsten trägt.

**1. Vertagen als Handlung je Haus** (`vertageVersammlung`, Knopf auf der
Anwesenheitsseite). Die Versammlung wird geschlossen, ohne dass beschlossen
wurde — sie hat trotzdem stattgefunden. Der **Grund ist Pflicht**, weil «nicht
beschlussfähig» (ZGB 712p Abs. 2) und «die Versammlung hat es beschlossen»
zwei verschiedene Sachverhalte sind und nur der erste zur erleichterten
Zweitversammlung führt.

Vertagt wird **nur, was läuft**. Wird eine Versammlung abgesagt, bevor sie
eröffnet ist, hat es keine ungenügende Beteiligung gegeben; die neue ist dann
weiterhin die **erste**, mit dem vollen Quorum nach Abs. 1. Wer bloss einen
Termin verschieben will, ändert das Datum.

**2. Die Folgeversammlung entsteht daraus** — `stufe: 'zweite'`, `vorgaengerId`
gesetzt, Datum am ersten zulässigen Tag, also elf Tage später (ZGB Art. 712p
Abs. 2 mit Rz. 41: Die Frist von zehn Tagen beginnt am Tag nach der ersten
Versammlung). Das ist der Punkt mit der Rechtsfolge: Ohne
gesetzten Vorgänger sieht die zweite Versammlung aus wie eine erste, und dann
verlangt die Anwendung ein Quorum, das das Gesetz für sie gar nicht mehr
verlangt.

**Und sie bekommt die unerledigten Geschäfte mit.** Das fehlte im ersten
Anlauf und war der teure Teil: Die acht Pflichttraktanden entstehen von selbst,
also sah die Liste vollständig aus — von den angekündigten Sachtraktanden stand
keines darin. Nach Abs. 2 wird die zweite Versammlung aber gerade **für
dieselben Geschäfte** einberufen. Was nicht mitkommt, und warum, steht bei
`uebertrageOffeneTraktanden`; der wichtigste Filter ist das bereits
**Entschiedene** — sonst stünde eine gefasste Sache ein zweites Mal zur
Abstimmung.

**3. Am Abend gesammelt** (`vertageAmAbend`, unten in der Sitzungsleitung des
Abends). Eine Häkchenliste über die laufenden Erstversammlungen — vorgehakt
ist, wer nicht beschlussfähig ist —, ein Grund, ein Termin. Daraus entsteht
**ein neuer gemeinsamer Abend** mit Uhrzeit, Ort und Art des alten; die
gemeinsame Traktandenliste baut sich beim Zuordnen von selbst wieder auf.
Ohne diesen Schritt stünde die Bewirtschaftung danach mit vier losen
Zweitversammlungen da und müsste den Saal von Hand nachbauen.

Der alte Abend bleibt vollständig — sein Protokoll braucht ihn. Die vertagten
Versammlungen bleiben also dort stehen; nur ihre Nachfolgerinnen hängen am
neuen.

## Die Summen-Erfassung

Auftraggeber, 25.08.2026: «ich vermute dass die Sitzung mit Handzählen ist […] So setzt
es voraus, dass ich jeden Eigentümer kenne und die Stimmen richtig setze. Also
beim einfachen Mehr. Wenn müsste man dort die totale Anzahl an Ja, Nein und
Enthaltung eintragen können.» Und die Abgrenzung, die er selbst gezogen hat:
«Summen-Erfassung nur bei einfachem Mehr. Beim qualifiziertem Mehr braucht es
die Zettel aus jeder Zeit. […] Ohne Zuordnung wäre einfach noch **zusätzlich**.
So bleibt man flexibel, je situation.»

**Gebaut am 25.08.2026** (Migration 083), als dritter Weg neben den beiden
bestehenden: einzeln je Partei, alle auf einmal, oder nur die Summen.

**Die Summe steht am Durchgang, nicht in `vote`.** Eine Zeile in `vote` behauptet,
WER wie gestimmt hat — sie hängt an Einheit und Partei. Aus einer Handzählung
Zeilen zu erzeugen hiesse, Namen zu erfinden: Das Protokoll behauptete dann,
ein bestimmter Eigentümer habe Ja gesagt, und niemand wüsste, dass die Zuordnung
ausgedacht ist.

**Vier Fälle, in denen es nicht geht** (`summenhindernis`), jeder mit seinem
Grund im Klartext auf der Seite:

| Fall | Warum nicht |
|---|---|
| **Qualifiziertes Mehr** | Wertquoten hängen an der Einheit. Wer Hände zählt, weiss nicht, WELCHE Einheiten zugestimmt haben — es gibt keine Zahl, die man einsetzen könnte. |
| **Einstimmigkeit** | Ihr Ergebnis ist nicht «wie viele», sondern «wer nicht». Nachträgliche Zustimmungen holen den Beschluss nicht nach (Fassung 2026-10-29). |
| **Zustimmung Betroffener** (ZGB 712g Abs. 4) | Sie ist namentlich; eine Summe kann sie nicht belegen. |
| **Kenntnisnahme / Grenzfall** | Es gibt nichts auszuzählen bzw. keine Schwelle. |

**Bei den Wertquoten geht es seit dem 26.09.2026** (Block A3c,
Produktentscheid: «es sollte eigentlich möglich sein, mit Kommentar»). Dort
genehmigt die Versammlung mit einfachem Mehr, und die Zustimmung der
Betroffenen kommt nachher mit der Unterschrift auf der Abänderungsurkunde
(ZGB Art. 712e Abs. 2). Die Handzählung führt die eingetragenen Betroffenen
als ausstehend, aus derselben Funktion wie die einzelne Erfassung
(`ausstehendeZustimmungen`), und verlangt einen Vermerk der Sitzungsleitung
(`summenvermerkNoetig`, mindestens drei Zeichen).

**Was die Rechnung nicht weiss, sagt sie.** Der Quotenspiegel steht auf
«nicht erhoben» und nicht auf null — «0 ja · 0 nein» liest sich wie ein
Ergebnis, und es stünde so im Auswertungsblatt. Die Liste der fehlenden
Zustimmungen bleibt leer, mit Hinweis; sonst läse man sie als «alle haben
zugestimmt». Und beim Ausstand sagt sie ausdrücklich, dass sie nicht prüfen
kann, ob die gezählten Hände ihn enthielten.

**Der Stichentscheid nach Wertquoten bleibt offen**, wo einer nötig wäre: Er
vergleicht die Quoten der abgegebenen Stimmen, und die gibt es hier nicht. Ihn
zu übergehen hiesse, einen Gleichstand als Ablehnung zu verkünden, obwohl das
Reglement etwas anderes vorsieht.

**Einzeln oder als Summe, nicht beides.** Die beiden Wege sperren einander
gegenseitig — zwei Auszählungen desselben Durchgangs könnten zwei Ergebnisse
ausweisen. Zurücknehmen geht: ohne das wäre die Wahl unumkehrbar, und ein
Vertipper kostete einen ganzen Durchgang.

## Nicht gebaut, mit Absicht

Ein **Umschalten der Betriebsart während der laufenden Sitzung** (Auftraggeber,
25.08.2026: «Dann lassen wir das mit dem Umschalter. Ich kann ja dann bei jeder
Abstimmung das so festhalten, wenn es ein Problem gibt»). Der Weg dafür steht
schon: Fällt die Technik aus, erfasst die Sitzungsleitung den Durchgang von
Hand und schreibt den Grund dazu. Das steht dann an jeder einzelnen Stimme —
genauer als ein Zustandswechsel, der nur einen Zeitpunkt kennt.
