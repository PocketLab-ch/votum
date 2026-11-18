# Bauweise von Votum

Diese Datei richtet sich an die Entwicklung und begründet, **warum** etwas so
gebaut ist. Bis zum 16.11.2026 stand sie als `README.md` in der Wurzel; dort
steht jetzt der Überblick für Aussenstehende ([README](../README.md)). Verweise
«README, Abschnitt …» in Code und Doku meinen seither diese Datei.

## Handbuch

Wer die Anwendung aufsetzen oder eine Versammlung führen will, findet das unter
[`docs/`](./):

| Kapitel | Inhalt |
|---|---|
| [Handbuch](README.md) | Einstieg, Ablauf im Überblick, Grenzen des Werkzeugs |
| [Installation](installation.md) | Aufsetzen, erstes Konto, Sichern, Aktualisieren, Fehlersuche |
| [Dienste einbinden](dienste.md) | Authentik, Dateiablage, Zeitquelle, Stand der KI-Anbindung |
| [Eine Versammlung führen](versammlung-fuehren.md) | Der ganze Ablauf, Schritt für Schritt, ohne Vorkenntnisse |
| [Der Verbund](verbund.md) | Mehrere Gemeinschaften zusammen, Weisungen |
| [Gestaltung der Seiten](gestaltung.md) | Das Muster für ruhige Seiten und wie man es anwendet |
| Interne Arbeitspapiere | Prüfberichte (`docs/audit/`), Freigabe- und Messprotokoll, Pendenzen, datierte Pläne und Befundberichte unter `docs/`. Nur im internen Repo, nicht im öffentlichen Stand (`.gitattributes`); ein Verweis darauf in Code oder Tests nennt die Herkunft einer Regel und führt im öffentlichen Stand ins Leere |

## Stand

**Welle 1 vollständig: Epics 1 bis 6, Stories 1.1 bis 6.3.** Dazu Epic 7 «Der
Verbund».

**Welle 2 vollständig**: Vertretung und Vollmacht (FR-23 bis FR-25), das
Protokoll (FR-46 bis FR-50), das Abschlusspaket mit Siegel, Zeitstempel,
Prüfwerkzeug und Aufbewahrung (FR-51 bis FR-55, FR-57) — dazu der Zusatzblock
**Vollmacht über den persönlichen Zugang** mit Weisung je Antrag.

**Welle 3 angefangen:** Anträge lassen sich **zurückziehen** (FR-45) —
zurückgezogen ist nicht abgelehnt —, und die Versammlung kann auf eine
behandelte Sache **zurückkommen** (FR-44): eigener Antrag, gesonderte
Abstimmung, der frühere Beschluss gilt bis zum neuen. Der **Folgeantrag**
(FR-43) benennt die Abweichung seines Mehrs vom Mehr des Grundantrags und
schlägt die Reihenfolge vor (geerbt wird das Erfordernis seit dem
Produktentscheid 08.10.2026 nicht mehr: Der Folgeantrag bekommt die Herleitung
wie ein neu angelegtes Traktandum); bei **Nutzniessung** (FR-22) ergibt sich
aus der Geschäftsart, wer stimmt. Die **KI-Grundlage steht** (FR-62, FR-63):
eine Kette
frei einrichtbarer Stufen, Namensschutz vor jeder Übermittlung, ein Nachweis
ohne Anfragen und Antworten — und als erste Funktion die **Traktandenprüfung**
(FR-58), der **Erfordernisvorschlag** (FR-59), die **Antragsprüfung im Saal**
(FR-60) und der **Protokollentwurf** (FR-61) — damit ist die KI-Gruppe FR-58 bis
FR-63 vollständig. Seit dem 13.08.2026 holt die Anwendung Stammdaten auch
direkt aus immotool (FR-7) — über dieselbe Vorschau wie eine Excel- oder CSV-Datei und ohne
jede Abhängigkeit zur Laufzeit. Seit demselben Tag lassen sich Einladungen samt persönlicher Karte auch aus
der Anwendung verschicken — als **Option**: Ohne eingerichteten Mailausgang
erscheint der Knopf gar nicht, und die Dateien entstehen wie bisher. Dazu
kamen der **Ausstand** je Traktandum (ZGB Art. 68 i.V.m. Art. 712m Abs. 2)
und die **Rückführung** einer anderswo geführten Versammlung als Paket. Wer im
Ausstand ist, **stimmt** seither auch nicht für andere (BGE 134 III 481
E. 3.8; seit 25.09.2026 ebenso der Beklagte bei der Ausschlussklage): Die
Vollmacht ruht für die Stimme bei diesem Traktandum (das Veto einer
Betroffenen darf sie seit dem 26.09.2026 ausüben), die
vertretene Partei kann dort keine Stimme abgeben — und beim nächsten übt dieselbe
Vollmacht wieder aus.

Seit dem 09.09.2026 kennt die Anwendung die **Pendenz**: wer erledigt was bis
wann, erfasst am Traktandum, mit Zuständigem, Frist in drei Fällen (Datum,
nächste Versammlung, ohne Termin) und einem Zustand, der auch «hinfällig» kennt
— für die Zusage, die still verfällt. Sie gehört der **Gemeinschaft** und nicht
dem Protokoll dieser einen Versammlung und bleibt deshalb nach dem Versiegeln
änderbar; sie ist ausdrücklich nicht Teil des Siegelpakets, wie die
Protokollnotiz. Der Anlass steht in `docs/echte-protokolle-2026-09-08.md`.
**Noch offen** sind der Ausweis im Protokoll, die Liste über die Jahre an der
Gemeinschaft, der Vorschlag beim Anlegen der nächsten Versammlung und die Maske
am gemeinsamen Abend.

Damit blieb von den offenen Fragen des PRD noch der Zeitstempeldienst auf Prod.
Die **juristische Gegenlesung** des Entscheidbaums galt bis zum 16.11.2026 als
Bedingung vor der ersten echten Versammlung; sie entfällt nach Entscheid 0052.
Die offenen Fragen sind nach Entscheid 0044 eingeordnet, fest gerechnet oder
als Lesart der Gemeinschaft einstellbar; freigegeben wurde am 12.11.2026 ohne
sie.

**Suchbar sind bisher** die Versammlungsübersicht, die Eigentümer- und die
Gemeinschaftsliste (im Gerät, `domain/listensuche.ts`) sowie der Verlauf (in der
Datenbank, weil er seitenweise kommt). **Offen bleiben** Einheiten, Traktanden,
Anwesenheit, Vollmachten und Auswertungen: Dort steht die feste Reihenfolge, die
fachlich richtig ist; bei achtzig Einheiten reicht sie nicht mehr. Zwei Dinge
sind dabei nicht verhandelbar: Die **Reihenfolge der Traktanden** bleibt die
beschlossene und darf nicht umsortierbar sein, und der **Verlauf** bleibt in
seiner Zeitfolge — suchen ja, umstellen nein.

Die Planungsartefakte liegen unter
`../_bmad-output/planning-artifacts/`:

| Artefakt | Inhalt |
|---|---|
| `prds/prd-versammlung-2026-07-30/prd.md` | 68 Anforderungen, in drei Wellen geschnitten |
| `prds/prd-versammlung-2026-07-30/pruefung-entscheidbaum.md` | Kritische Prüfung der Quorumsregeln |
| `architecture/architecture-versammlung-2026-07-30/ARCHITECTURE-SPINE.md` | 18 Invarianten AD-1 bis AD-18 |
| `epics-versammlung-2026-07-30.md` | 6 Epics, 47 Stories |
| `epic-versammlung-verbund-2026-07-31.md` | Epic 7, der Verbund |
| `epic-versammlung-vollmacht-2026-08-04.md` | Welle 2, Block 1: Vertretung und Vollmacht |

## Aufbau

Functional Core / Imperative Shell. Die Rechtslogik liegt als reine Funktionen im
Kern und kennt weder Datenbank noch Uhr noch Zufall — bei einem Werkzeug, dessen
Zweck die Beweisbarkeit einer Zählung ist, muss diese Zählung vorlegbar sein.

```
src/lib/domain/    Kern: Zählung, Quorum, Zustandsübergänge — ohne I/O
src/lib/rules/     Entscheidbaum als versionierte Daten (Fassungen 2026-07-30, 2026-08-05, 2026-08-15)
src/lib/server/    Datenzugriff, Migrationen, Verlauf, Dateiablage
src/lib/server/pdf/  Traktandenliste, Zugangskarten, Auswertung; mitgelieferte Schrift
src/routes/        Schale: Seiten und Server-Aktionen
migrations/        Nummerierte SQL-Dateien, aufwärtsgerichtet
tests/domain/      Wertetabellen, laufen ohne Datenbank
tests/db/          Schutzregeln der Datenbank, unter der Anwendungsrolle
```

Die Abhängigkeitsrichtung wird erzwungen: `npm run check:layers` bricht ab, wenn
der Kern etwas aus einer äusseren Schicht einbindet. Der Wächter läuft vor `build`
und vor `test`.

## Entwicklung

Node 24 wird über Docker bereitgestellt, weil der Dev-Host Node 20 hat.

```bash
cp .env.example .env          # Kennwörter anpassen
docker compose up -d          # PostgreSQL 18 + Anwendung
```

Erreichbar unter `http://127.0.0.1:3100/`. Die Startseite zeigt den Betriebszustand.

### Name, Zeichen und Verzeichnis

Der Name ist das Wort, das im Saal ohnehin fällt — «Wortmeldung, Votum». Das
Zeichen ist die Urne mit dem Zettel im Einwurf; seine zwei Zeilen sind ungleich
lang, weil hier nicht jede Stimme gleich viel zählt. Beides liegt in
`src/lib/marke/`, die gefasste Fassung für den Browserreiter in
`static/favicon.svg`. Wer es einbindet, nimmt `Marke.svelte` — inline, damit
`currentColor` und der Grundton des Modus greifen.

**Das Verzeichnis heisst weiter `versammlung`**, und «Versammlung» bleibt im
ganzen Code der Fachbegriff für die Sitzung selbst. Umbenannt wurde allein, was
den Namen der Anwendung trägt: Kopfzeile, Titel, Startseite, Handbuch.

### Was ein Fehler ist, und was nicht

**Am 04.09.2026 aufgeschrieben**, nach zwei Prüfdurchgängen über denselben
Gegenstand. Der erste meldete zehn «Befunde», von denen **drei bewusste
Entscheide** waren, deren Begründung als Kommentar direkt an der kritisierten
Stelle stand. Der zweite bekam die Definition unten mit in den Auftrag und fand
vier echte Fehler, mit vier hingenommenen Entscheiden daneben.

Der Unterschied war nicht die Sorgfalt, sondern die Definition. Dieses Haus
begründet seine Entscheide ausführlich im Code, und genau das macht es anfällig
für Prüfberichte, die gegen die Begründung anlaufen, ohne sie gelesen zu haben.

> **Ein Fehler ist es, wenn die Anwendung etwas anderes tut, als sie zusagt,
> als eine äussere Quelle verlangt, oder als der Mechanismus vorgibt zu tun.**
> Vier Sorten:
>
> 1. **Falsches Ergebnis** — rechnet, zeigt oder speichert Falsches.
> 2. **Gebrochene Zusage** — die Oberfläche verspricht etwas, das nicht
>    eintritt: ein Knopf, der in eine Absage führt; ein Hinweis, der einen Weg
>    nennt, den es nicht gibt.
> 3. **Abbruch** — es geht nicht weiter, kein Rückweg, oder eine Fehlermeldung,
>    wo kein Fehler ist.
> 4. **Fehlende Wirkung** — der Mechanismus ist da, sichtbar, benannt, und tut
>    nichts. Der Wächter läuft nie, der Handler ist unerreichbar, der Test wurde
>    nie ausgeführt, die Einstellung hat keinen Leser.
> 5. **Überschiessende Wirkung** — der Mechanismus wirkt auf mehr, als der
>    Auftrag nennt. Ein Schreiben, das den ganzen Satz ersetzt statt des einen
>    Werts; ein Filter, der zusätzlich etwas herausnimmt; ein Aufräumlauf, der
>    fremde Zeilen mitnimmt.

> 6. **Geliehene Autorität** — die Anwendung tut, was sie soll, und leiht
>    ihren Rahmen einer fremden Aussage. Der Schaden entsteht nicht am
>    Verhalten, sondern an der Glaubwürdigkeit, die der Rahmen mitgibt.

**Die äussere Quelle gehört benannt, sonst prüft der Durchgang die Anwendung
gegen sich selbst** (aus dem Austausch mit den Nachbarsitzungen, 04.09.2026).
«Was sie selbst zusagt» ist selbstbezüglich: Wo Code, Kommentar, Doku und Test
einig sind und alle dasselbe Falsche sagen, bricht keine Zusage. Genau so war
es bei der Auszählmappe, die ein Zweidrittelmehr als «Einfaches Mehr der
Anwesenden» führte — sie hat nichts versprochen und nichts gebrochen, sie war
falsch **gegen das Reglement**. Hier sind die äusseren Quellen: **ZGB,
Reglement der Gemeinschaft, das Regelwerk der geltenden Fassung.**

**Die fünfte ist die gefährlichste**, weil sie **an der Stelle, an der man
hinsieht, richtig aussieht** (aus dem Austausch mit den Nachbarsitzungen). Der
Aufruf tut, was er zusagt; der genannte Wert steht danach richtig da. Falsch
ist, was er nebenbei mitnimmt. In diesem Repo entwertet das Schliessen einer
Versammlung **jeden** Zugang und widerruft dabei auch Sitzungen, deren Frist
längst abgelaufen war — beides gewollt, aber beim Bau der Nachschau am
04.09.2026 stand genau diese Nebenwirkung zwischen Absicht und Ergebnis.

**Sie heisst nicht «unbeabsichtigte Wirkung», sondern «Wirkung, die im Auftrag
nicht steht»** (Schärfung aus der Nachbarsitzung, 04.09.2026). Der Fall oben
zeigt genau das: Das Entwerten jedes Zugangs ist **gewollt**, und trotzdem hat
es zwei Anläufe gekostet, weil es nirgends benannt war. Eine gewollte
Nebenwirkung ist eine, solange sie nur im Code steht und nicht im Auftrag. Für
die Gegenseite heisst das: **Der Auftrag muss nennen, was er anfasst, nicht nur,
was er bezweckt.**

Die Probe dagegen kostet fast nichts und heisst immer gleich: **Nenne, was der
Auftrag nicht anfassen darf, ändere etwas anderes, und miss es hinterher.**

**Die sechste braucht einen eigenen Test** (aus dem Austausch mit den
Nachbarsitzungen, 04.09.2026), weil die Werkzeuge für kaputtes Verhalten sie
nicht finden: Die Anwendung hält hier ihre Zusage, sie zeigt genau, was sie
zeigen soll. Der Test lautet nicht «was hätte stattdessen passieren müssen»,
sondern: **Würde derselbe Text ohne unseren Rahmen auch schaden?** Bei «Ihre
Zahlung ist fällig, rufen Sie 079…» lautet die Antwort nein; in einer beliebigen
Mail glaubt das niemand, im Warnkasten einer Anwendung unter deren eigener
Adresse schon.

Hier trifft es den Freitext, den ein Teilnehmer selbst setzt: den Namen einer
bevollmächtigten Person. Die Gegenmassnahme ist keine Prüfung des Textes,
sondern **der Rahmen sagt dazu, woher die Aussage kommt**. Eine erklärte
Vollmacht steht unter «Zu prüfen» mit dem Vermerk «elektronisch über den
persönlichen Zugang erklärt», eine bestätigte unter «Wirksam» mit ihrem
Nachweis, und die Erklärung selbst antwortet mit «Die Sitzungsleitung prüft sie
noch, bis dahin überträgt sie keine Stimme». Wer den Namen liest, liest immer
mit, wer ihn behauptet hat.

**Die vierte Sorte ist die, die am längsten unentdeckt bleibt.** Die ersten
drei sind Ereignisse; jemand merkt etwas. Bei der vierten wird nichts falsch
und nichts bricht, es passiert bloss nichts. Der Hauptbefund dieses Repos vom
04.09.2026 war genau das: Eine Reglementsregel war erfassbar, gespeichert und
angezeigt, und wurde nie gerechnet. Wer drei Sorten im Auftrag hat, sucht die
vierte nicht.

**Kein Fehler, sondern getrennt zu melden:**

| | |
|---|---|
| **Lücke** | Eine Funktion fehlt. Nur ein Befund, wenn die Aufgabe ohne sie nicht erledigt werden kann. |
| **Verständlichkeitsmangel** | Der Text ist da, aber unklar oder irreführend. |
| **Entscheid** | Bewusst so gebaut — siehe unten, das Erkennungsmerkmal ist enger, als es klingt. |
| **Wunsch** | Wäre schöner. |

**Der Test hat zwei Türen.** Die erste: **Kann ich sagen, was stattdessen hätte
passieren müssen, und woraus das folgt?** Die zweite, für den häufigeren Fall,
dass der Prüfer die richtige Antwort nicht kennt: **Kann ich zwei Stellen
zeigen, die einander widersprechen?** Ein Widerspruch ist beweisbar, ohne die
Wahrheit zu kennen, und mindestens eine der beiden Stellen ist falsch. Bleibt
beides aus und die Antwort lautet nur «wäre besser», ist es kein Fehler.

**Wo das richtige Ergebnis erst später feststeht, wird die zweite Tür zur
Haupttür.** Ob eine Zahl stimmt, entscheidet sich manchmal erst Monate später;
ob zwei unabhängige Wege dieselbe Zahl liefern, lässt sich sofort messen.
Daraus folgt eine Regel, die über dieses Repo hinausreicht: **Jede Zahl, die
eine Anwendung als Tatsache anzeigt, braucht einen zweiten Weg, auf dem sie
entsteht.** Gibt es den nicht, ist sie im Augenblick der Anzeige unbeweisbar
und darf nicht als Tatsache dastehen. Hier ist dieser zweite Weg die
Auszählmappe für den Ausfall: Sie rechnet dasselbe noch einmal, mit Formeln
statt mit Code.

**Und seit dem 05.09.2026 rechnet eine echte Tabellenkalkulation sie nach.**
Bis dahin war nur ihr Aufbau geprüft: Bezüge und Schwellen gegen `zaehleAus`
und `schwelle()`. Ob Calc aus diesen Formeln dieselben Zahlen macht, blieb
offen, weil auf dem Dev-Host kein LibreOffice Calc lag. Ein zweiter Rechenweg, der
anders rechnet als der erste, ist schlimmer als gar keiner: Er sieht aus wie
eine Bestätigung.

`scripts/mappe-nachrechnen.mjs` baut die Mappe mit `baueAuszaehlmappe`, trägt
Stimmen ein, lässt Calc rechnen und hält jede Zeile gegen `zaehleAus`: Summen,
Schwellen und die Urteilszeilen «erreicht» und «Ergebnis». Seit A3
(30.10.2026) entstehen die Posten wie im Downloadweg über `mappenpostenAus` aus
Erfordernissen des echten Regelwerks, und geprüft wird auch jede Spalte «zum
Vergleich» (L1 bis L6, L9, L11, L12, 1a, Mehr aus Gesetz und Reglement), der
Stichentscheid nach jeder Art und die Beschlussfähigkeit einer ersten
Versammlung: **8519 Werte in 84 Lagen und 661 Spalten, keine Abweichung**
(13.11.2026; die Mappen bis L6 nach Fassung 2026-11-05, L9, L11 und L12 nach
2026-11-11). B3 und L10 führt die Mappe bewusst ohne eigene Spalte. Das Blatt entsteht in
einem Einmalcontainer aus dem eigenen Baum, so misst das Skript auch in einem
Worktree den eigenen Code.

**Zwei Dinge, die es nicht belegt, und das gehört dazu.** Der erste Anlauf
prüfte nur `schwellenformel` gegen `schwelle()`; `SUMIF`, `SUMIFS` und die
`IF`-Ketten hatte Calc dabei nie gerechnet, und der Code-Review hat das
gemessen statt gelesen. Und `ROUND(…,6)` bleibt ungedeckt: Nimmt man es
heraus, bleibt der Nachweis grün, weil die Division ganzzahliger Werte in Calc
aufgeht. Der Schutz steht vorsorglich für andere Programme da, nicht belegt.
Ebenso ungeprüft bleibt **Excel** — dass die Mappe dort öffnet, ist bestätigt,
die Zahlen hat dort niemand nachgerechnet.

Das Skript läuft **auf dem Host, nicht im Prüflauf**: Im Container ist kein
LibreOffice, und auf dem Host laden die Domänenmodule nicht. Es ist damit ein
Werkzeug für die Hand, aufzurufen, wenn jemand an `schwellenformel`,
`schwelle()`, `zaehleAus` oder der Mappe arbeitet.

**Allgemeiner gefasst gehört der zweite Weg überall dorthin, wo die erste Tür
verschlossen ist**, und welche der beiden das ist, hängt vom Gegenstand ab, nicht
von der Sorte des Befunds (Schärfung aus der Nachbarsitzung, 04.09.2026). Hier
ist das Rechnen sofort prüfbar und die Belegkraft erst bei der Anfechtung; in
einer Belegablage ist es umgekehrt, dort sieht man den Bestand sofort und die
Vollständigkeit erst bei der Revision. Auszählmappe und Postenliste sind
dasselbe Werkzeug an zwei verschiedenen Türen.

**Ein Entscheid erkennt man an der verworfenen Alternative, nicht am
Kommentar.** Ein Kommentar, der beschreibt, was der Code tut, ist keine
Begründung; «bewusst so» ist auch keine. Erst wenn dasteht, **was stattdessen
naheliegend gewesen wäre und warum es nicht genommen wurde**, kann jemand
dagegen argumentieren — und erst dann trägt die Regel «nur melden, wer gegen
die Begründung argumentieren kann». Ohne die Alternative macht sie jeden
unverstandenen Kommentar unangreifbar.

**Und ein Entscheid trägt nur, solange seine Begründung nachprüfbar ist** (aus
dem Austausch mit den Nachbarsitzungen, 04.09.2026). Beschreibt der Kommentar
einen Zustand, den es nicht mehr gibt, ist er kein Entscheid mehr, sondern ein
**Schutzschild ohne Inhalt**: Er hält Änderungen ab und lässt sich nicht mehr
widerlegen. Dann ist der Kommentar selbst der Befund.

<!-- waechtername-historisch: Dieser Absatz handelt vom abgelösten Namen selbst. -->
Gemessen am 04.09.2026 in diesem Repo: Sieben Stellen beriefen sich auf
`scripts/check-ausklapper.mjs`, sechs davon im Präsens («bewacht von …»). Den
Wächter gibt es seit dem Umbau auf echte Parser nicht mehr; seine Regel lebt als
Stylelint-Regel `versammlung/dreieck-am-summary` weiter. Beide Schlüsse, die ein
Leser daraus ziehen kann, sind falsch: «das ist bewacht, also nicht anfassen»
ist unwiderlegbar geworden, und «ich finde den Wächter nicht, also ist die Regel
offen» führt zum Nachbau einer Regel, die es gibt. Geschlossen hat das nicht die
Korrektur der sieben Stellen, sondern `check-waechternamen.mjs`.

**Und die Korrektur selbst zeigte, wo die Grenze eines solchen Wächters liegt.**
Der erste Anlauf schrieb die sieben Stellen auf `check-anzeigeart` um, weil dort
`summary` in einer Liste steht. Gemessen hält der das Dreieck nicht; die
Stylelint-Regel tut es. Der Wächter meldete «in Ordnung», denn er prüft, ob es
den Genannten **gibt**, nicht ob er die Regel daneben hält. Eine falsche Adresse
ist dabei **schlechter als ein toter Name**: Wer den toten sucht, findet nichts
und sucht weiter; wer die falsche prüft, findet eine echte Datei und hört auf.
Gefunden hat es der Code-Review, nicht der Wächter.

Die Beweislast liegt beim Entscheid, nicht beim Prüfer, und die Kosten sind
schief: Ein zu Unrecht gemeldeter Entscheid kostet einen Absatz Diskussion, ein
zu Unrecht verschwiegener Fehler geht in Betrieb. **Im Zweifel melden**, in
einem eigenen Abschnitt «Entscheid?» an den Autor gerichtet, statt zu
schweigen.

### Was die Freigabe hält

**Ein zweites Feld, nicht Teil der Definition oben.** Die Definition sagt, was
ein Befund **ist**; dieser Massstab sagt, was die Freigabe **hält**. Stehen
beide im selben Absatz, stuft der Prüfer echte Fehler ab, die den Massstab
nicht treffen.

Die Frage lautet: **Was macht diesen Dienst wertlos, wenn es einmal
passiert?** Hier ist die Antwort: **ein Beschluss, der falsch, anfechtbar oder
unbelegbar wird.** Alles andere ist Komfort, auch wenn es ärgerlich ist.

Der Satz gehört **vor** den Durchgang geschrieben, nicht danach gewählt — sonst
wird er zur Rechtfertigung dessen, was man ohnehin nicht beheben wollte. Und er
ist je Anwendung ein anderer: in einem Buchhaltungswerkzeug der Abschluss, der
nicht mehr belegbar ist; in der Infrastruktur das, was sich nicht
wiederherstellen lässt; in einer Ablage der Beleg, der weg oder nicht
auffindbar ist.

**Wer prüfen lässt, gibt beides mit in den Auftrag.** Ohne die Definition
kostet es einen ganzen Durchgang, Befunde und Entscheide wieder
auseinanderzusortieren; ohne den Massstab bekommt man eine nach Schwere
sortierte Liste, deren Reihenfolge niemand teilt.

einmal zugeschnappt ist, wird nicht ausgebessert, sondern zugesperrt. Alle
laufen in `npm run pruefen` — und der hängt als Pre-Commit-Hook an jedem Commit.
Gefüttert wird nichts: Sie lesen den Quelltext bei jedem Lauf selbst.

**Am 04.09.2026 bekamen sie eine Reissleine** (`scripts/lib/pruefmenge.mjs`).
Ein Wächter mit leerer Prüfmenge ist grün und wertlos, und das ist die
gefährlichste Art, einen zu verlieren: Er sieht wie Erfolg aus. Gemessen waren
**fünf von fünfundzwanzig** so zu verlieren, `check-fokusmarke` mit dem Satz
«0 Ziele in 0 Dateien … in Ordnung». Vier weitere waren nur deshalb rot, weil
sie an einer fehlenden Datei mit `ENOENT` abstürzten, also aus Versehen.

Die erste Messung sagte sechzehn und war falsch: Sie gab jedem Wächter einen
leeren Baum als **Argument**, auch den elf, die keins annehmen und immer
`process.cwd()` prüfen. Die sahen nie den leeren Baum. Eine Messung gehört
daraufhin geprüft, ob sie den Gegenstand trifft.

Gemessen wird die Zahl der **Dateien**, nicht der Treffer: Fast alle sind
Verbotswächter, bei denen «null Treffer» der Erfolgsfall ist. Und je Quelle,
nicht als Summe, denn eine grosse Quelle füllt die Schwelle sonst allein auf
und die Grenze erkennt genau den Ausfall nicht, gegen den sie steht. Die
Grenzen liegen bei rund 70 Prozent des gemessenen Bestands.

Abschalten lässt sich das allein mit `VERSAMMLUNG_REISSLEINE=aus`, und jeder
andere Wert ist ein Fehler statt ein «aus»: Die Gegentests fahren gegen
Wegwerfbäume mit einer Handvoll Dateien und brauchen den Ausschalter, aber eine
Schranke, die sich versehentlich abschalten lässt, ist keine. Sie setzen ihn je
Kindprozess; steht er in der **Sitzung**, hält `check:reissleine` den Prüflauf
gleich im ersten Schritt an, statt ihn still zu entwerten. Für das echte Repo
wird er nie gesetzt, denn die Sichtproben dort sind die einzige Stelle, an der
eine zu hoch geratene Grenze auffiele.

Dass die Reissleinen selbst greifen, prüft `tests/waechter/reissleine.test.ts`
über alle fünfundzwanzig Wächter auf einmal — sonst hätte der Umbau stille
Wächter durch stille Wächter ersetzt. Er prüft zwei Lagen, weil sie sich
unterscheiden: das Verzeichnis ist **da und leer**, und es ist **gar nicht da**.
Und er verlangt beide Male eine Meldung, kein `ENOENT`: Ein Absturz ist zwar
auch rot, sagt aber nicht, dass der Wächter nichts mehr zu prüfen hat.

**Am 24.08.2026 umgebaut.** Vorher waren es acht selbstgeschriebene Skripte mit
regulären Ausdrücken über den Dateitext, und das Projekt hatte weder ESLint noch
Stylelint. Ein Regex über eine `.svelte`-Datei unterscheidet Code nicht von
Kommentar, sieht keine verschachtelte CSS-Regel und schneidet ein Element mitten
durch, sobald im Attribut ein `>` steht. Was eine **Regel je Datei** ist, läuft
seither über einen echten Baum; was **über Dateigrenzen** geht, bleibt ein
Skript — benutzt aber denselben Parser.

| Wo | Wächter | Was er verhindert |
|---|---|---|
| ESLint | `versammlung/anfangswert` | `value={…}`/`checked={…}` an einem Eingabefeld: Bei jedem Neuzeichnen wird überschrieben, was jemand getippt hat (30.07.2026 — niemand konnte sich anmelden) |
| ESLint | `versammlung/keine-browserabfrage` | `confirm()` als Rückfrage: SvelteKit prüft `defaultPrevented` bei `use:enhance` nicht, «Abbrechen» bricht nicht ab |
| ESLint | `versammlung/meldung-als-baustein` | Eine Meldung aus `form` als roher Absatz — sie bleibt bis zum Neuladen stehen, und im Saal lädt niemand neu |
| ESLint | `svelte/no-at-html-tags`, Grundsatz | Fremdes Markup, tote Zuweisungen, `case`-Durchfall |
| Stylelint | `versammlung/dreieck-am-summary` | `display` an einem `<summary>`: Der Ausklapper verliert sein ▶ und sieht aus wie ein Satz |
| Stylelint | Grundsatz | Kurzschreibweise überschreibt eine Einzelangabe, dieselbe Eigenschaft zweimal im Block, unbekannte Eigenschaft |
| dependency-cruiser | Schichten | Der Kern (`domain`) kennt nur sich selbst, das Regelwerk nur den Kern, keine Ringe im Kern (AD-1) |
| Skript | `check-svelte-lesbar` | Eine Svelte-Datei, die der Parser nicht lesen kann. **Steht als erster Schritt der Kette:** Die sechs baumbasierten Wächter überspringen so eine Datei stillschweigend und melden weiter «in Ordnung» (02.09.2026, ein `</div>` zu viel liess den Seitenaufbau-Wächter unverändert zählen) |
| Skript | `check-meldungen` | Eine Meldung, die nach einer **Handlung** erscheint (Bedingung liest `form`), muss `Meldung.svelte` sein und kein blanker `<p class="meldung">`. Sonst fehlt ihr alles, was der Baustein kann: wegdrücken (20.08.2026), als Erfolg in die Quittungsecke wandern (21.08.2026), sich ins Bild rollen (27.08.2026), den Fokus annehmen. Gemessen am 02.09.2026: 26 solche Stellen, neun davon untereinander auf der Reglementseite. **Zwei Arten bleiben frei:** ein Dauerhinweis aus `data`, und eine Meldung mit Blockinhalt (`<form>`, `<ul>`, zweiter `<p>`) — die Komponente rendert einen Absatz, und ein Blockelement darin ist ungültiges HTML. Abgegrenzt wird am Inhalt, nicht an der Schreibweise: ein `<div class="meldung">` mit blossem Text bleibt ein Befund |
| Skript | `check-stilvariablen` | `var(--x)` ohne Definition und Rückfallwerte, die nie greifen — `--rand` gab es als *Abstand*, der Rahmen verschwand spurlos |
| Skript | `check-themenfarben` | Zweierlei am Thema. **Feste Farben:** eine Farbe in einer farbtragenden Regel macht den Themenwechsel nicht mit — im dunklen Thema stand weisse Schrift auf weissem Grund (01.09.2026, 26 Stellen). **Bedienelemente:** jedes Thema (`:root[data-theme=…]`, über alle seine Blöcke hinweg) muss `color-scheme` und `accent-color` setzen, sonst malt der Browser Kästchen, Auswahlknöpfe und Datumsfelder nach dem **Gerät** statt nach der Seite — bei dunklem System und heller Seite wurde das Kästchen ein schwarzer Block (02.09.2026). Geprüft wird der **zuletzt** gesetzte Wert: `normal` und `accent-color: auto` sind der Ausgangszustand und damit ein Befund; ein Thema, das `light` oder `dark` heisst, muss seinen Namen im Wert nennen. Ein Thema mit anderem Namen (Kontrastmodus) bleibt frei |
| Skript | `check-seitenaufbau` | **Zählt statt sperrt:** wie viele Seiten dem Stapelmodell aus `docs/plan-seitenaufbau-2026-08-27.md` folgen (`.seitenstapel` mit `.abschnitt`-Kindern) und wie viele noch die zweispaltige `.arbeitsflaeche` tragen. Eine Seite darf begründet dabeibleiben (`<!-- seitenaufbau-ausnahme: <Grund> -->`), der Wächter zählt sie getrennt. Rot machen die beiden Marken, die nichts tragen: ohne Satz (ein Schalter) und ohne `.arbeitsflaeche` (die Marke entschuldigt das Nebeneinander und gehört nur neben eines). Der Satz darf umbrechen. Scharf über `SEITENAUFBAU_MINDESTENS=<zahl>`: Liegt der Bestand darunter, bricht der Lauf ab — die Schwelle wächst mit der Umstellung mit |
| Skript | `check-anzeigeart` | Eine Hilfsklasse mit `display` an `<td>`, `<option>` … — die Zelle fällt aus ihrer Zeile |
| Skript | `check-stroeme` | Ein Ereignisstrom, der nicht über `stromantwort()` antwortet: ohne `x-accel-buffering: no` puffert der Proxy ihn weg |
| Skript | `check-datumspruefung` | Zwei Klassen um denselben Kalendertag. **Prüfen:** `/^\d{4}-\d{2}-\d{2}$/` prüft nur die Gestalt — `2026-02-31` gibt es nicht, kommt aber durch und endet als rohe 500 aus der Datenbank (16 Stellen, 02.09.2026). **Bauen:** ein Tag aus `getFullYear()` und `getMonth()` ist Ortszeit, während der Treiber `date`-Spalten als Mitternacht UTC liefert — westlich von Greenwich wird daraus der Vortag (6 Stellen, 02.09.2026). Richtig sind `istKalendertag()` und `kalendertag()` aus `$lib/domain/datum` |
| Skript | `check-hausklassen` | Eine Textklasse, die ihre **Bedeutung** trägt (`einleitung`, `lesebreite`), lokal umgeschrieben. `.einleitung` stand in 22 Dateien und war nirgends zentral definiert — fünfzehn Seiten erfanden sie selbst, und ein Erklärabsatz war je nach Seite grau oder schwarz, 672 oder 736 px breit (02.09.2026). Ein `margin` bleibt erlaubt; für eine andere Aussage nimmt man einen anderen Namen. Gelesen mit `postcss`, nicht mit einer Regex — die übersah mehrzeilige Selektorlisten, `:global()`, die `font`-Kurzform und `width` |
| Skript | `check-kibindung` | Eine exportierte Serverfunktion, deren Datei das Modell fragt und die eine Traktandumskennung nimmt, **ohne** die Versammlung dazu. Die Schale einer Route prüft die KI-Zulassung der Gemeinschaft aus der **Adresse**; kommt die Kennung aus dem Formular oder einem zweiten Adressteil, liesse sich ein Traktandum einer Gemeinschaft prüfen, die die KI abgelehnt hat — ein bezahlter Aufruf mit ihren Inhalten. Dreimal einzeln gefunden (01./02.09.2026), gelesen mit dem TypeScript-Parser statt mit einer Regex über die Signatur |
| Skript | `check-personendaten` | Eine Nennung echter Personen, Gemeinschaften oder ihrer Merkmale (als Prüfsumme in `scripts/personendaten-sperre.tsv`, Obergrenze null seit 27.10.2026), in Inhalten und Pfaden, als ganzes Wort und als Teilwort ab fünf Buchstaben; dazu gesperrte vierstellige Ziffernfolgen, E-Mail-Adressen ausserhalb von `example.*` und private IPv4-Adressen. Ein gewöhnliches Wort, das zufällig ein gesperrtes Stück enthält, steht als `<Prüfsumme><Tab>frei` in derselben Datei; ein unbenutzter Freieintrag ist rot. Die neue Stelle nennt der Lauf am Host (Vergleich mit `HEAD`), im Container nur die Dateien. Ein reiner `.md`-Commit überspringt den Prüflauf und damit auch diesen Wächter; wer Doku schreibt, fährt `node scripts/check-personendaten.mjs` selbst (`docs/veroeffentlichung-personendaten.md`) |
| Skript | `check-absagen` | Eine fachliche Absage ohne eigenen Satz — der Klick führt auf eine Seite, die dazu schweigt |
| Skript | `check-regellese` | Eine Reglementsregel ohne ihren Fall gilt für die ganze Geschäftsart |
| Skript | `check-abzug` | Der Export des Quorumsbaums läuft nicht mehr, oder sein Dateikopf nennt einen Aufruf, der nicht funktioniert (22.09.2026, der Kopf nannte `node` statt `vite-node`, und zwei Sitzungen hielten daraufhin den Export für kaputt) |
| Skript | `check-aufraeumen` | Eine neue Tabelle an Gemeinschaft oder Versammlung, die im Aufräumskript fehlt: Das Entfernen von Prüfdaten bricht dann an ihr ab (zweimal passiert — `ai_usage` 08-11, `quorum_finding` 08-25) |
| Skript | `check-texte` | Ein sichtbarer Satz über 180 Zeichen oder ein Hauswort wie «Momentaufnahme», «Manifest», «Anzeigecode»: Was auf dem Bildschirm steht, muss ein Laie verstehen (Auftraggeber, 25.08.2026). Rechtsbegriffe sind ausgenommen — «Wertquote» und «Traktandum» stehen so im ZGB. Gemessen werden sechs Bauformen, seit dem 20.10.2026 auch `export const NAME = '…'`, seit dem 29.10.2026 Rückgaben und `text(…)`-Zellen über den TypeScript-Parser, ein Ternär je Zweig, und die Satzgrenze überspringt «S.», «Rz.», «Art.», «Abs.» und Verwandte; lange Bestandssätze stehen mit Länge und Grund in `scripts/texte-ausnahmen.tsv`, Hauswörter im Bestand mit Satzanfang in `scripts/texte-jargon-ausnahmen.tsv` |
| Skript | `check-archivsicht` | Eine Vorgabe `sicht: Sicht = 'aktiv'` an einem Leseweg: Sie entscheidet still für jeden künftigen Aufrufer (25.08.2026 — löste ein Haus aus seiner MEG, liess eine zweite Erstversammlung zu, sperrte am Einlass eine Stimmberechtigte aus) |
| Skript | `check-umlaute` | **Sperrklinke wie `check-personendaten`:** ASCII-Umschreibungen (`fuer`, `ueber`, `Pruef` und sechs weitere Stämme, auch im Wortinnern) in Kommentaren und Zeichenketten unter `src/` und im Fliesstext unter `docs/`. Je Muster eine Obergrenze in `scripts/umlaut-sperre.tsv`, die nur sinken darf; rot auch, wenn die Zahl der Fundstellen gesunken ist und die Obergrenze nicht mitgesenkt wurde. Bezeichner, Pfade, Routen und CSS-Klassen zählen nicht; im Svelte-Markup liest er Attributwerte und `{…}`-Ausdrücke, nicht den Fliesstext zwischen den Marken (20.10.2026) |
| Skript | `check-anrede` | Eine Du-Form («du», «dich», «dir», «dein…») in einer Zeichenkette, einem Attributwert oder einem `{…}`-Ausdruck einer Oberfläche: Votum spricht Leitung und Eigentümer mit «Sie» an, im Haus wird geduzt, und das kann hineinrutschen (Entscheid 0034). Ausgenommen sind, je Datei mit Grund in `scripts/anrede-ausnahmen.tsv`, die Aufträge an das Sprachmodell; ein unbenutzter Eintrag ist rot. Kommentare und Blockmarken (`{#each …}`) liest er nicht |
| Skript | `check-zeichenzahl` | Eine Längenschranke, die `.length` zählt: JavaScript zählt UTF-16-Einheiten, Postgres zählt Zeichen. Bei einer Untergrenze ist die Anwendung dadurch lockerer als ihre eigene `CHECK`-Schranke — ein Name aus einem einzigen Bildzeichen kam am Satz vorbei und schlug als rohe 500 durch (26.08.2026) |
| Skript | `check-kennungen` | Eine Aktion unter `gemeinschaften/[id=kennung]`, die eine Kennung aus dem Formular nimmt, ohne sie an die Gemeinschaft der Adresse zu binden: Wer zwei Gemeinschaften verwaltet, trifft mit der Kennung aus der einen die Aktion der anderen (26.08.2026 — elf Aktionen auf vier Seiten, darunter Tilgen und Berichtigen) |
| Skript | `check-abendbindung` | Eine Aktion unter `tage/[id=kennung]`, die eine Versammlung aus dem Formular nimmt, ohne sie gegen den Abend der Adresse zu binden. An einem Abend tagen mehrere Häuser, die Versammlung steht deshalb mit Absicht nicht im Pfad — und ist damit ein Wert von aussen. Gefunden bei seinem ersten Lauf (08.09.2026): `freigeben/eine` und `haeuser/loesen` nahmen `params.id` nicht einmal entgegen. Kein Rechtegewinn (der Zeilenschutz hält den Betreiber), sondern eine fehlende Zusicherung — und genau deshalb fällt sie ohne Wächter niemandem auf |
| Skript | `check-kernbindung` | Eine Kernfunktion in `src/lib/server`, die einen Rahmen (`meetingId`, `tagId`, `stwegId`) **und** eine fremde Kennung entgegennimmt, ohne dass eine Bedingung beide zugleich einschränkt. Der Kennungswächter fragt an der Route und deckt nur den Gemeinschaftsbaum; unter `versammlungen/` trägt die Adresse eine Versammlung, und die Bindung steht im Kern (für `tage/` fragt seit dem 08.09.2026 `check-abendbindung` an der Route). Gefunden am 08.09.2026: `erklaereAusstand` schrieb eine Partei aus einer fremden Gemeinschaft in den Ausstand dieser Versammlung (aus dem Formular erreichbar), dazu drei ungebundene Lesewege in `abstimmung.ts` und eine Feststellung in `quorum_finding`, die auf ein fremdes Traktandum zeigen konnte. Die Regel steht ausführbar in `scripts/lib/kernbindung.mjs` und wird an erfundenen Fällen gemessen — zwanzig Formen, bei denen «gebunden» falsch war, vier davon aus dem Bestand |
| Test | `suchschwelle` | Eine Übersichtsliste, die ihre Suchschwelle selbst schreibt statt `brauchtSuchfeld` zu rufen: Am 27.08.2026 standen neun Suchleisten unter zwei Regeln, obwohl die gemeinsame Zahl seit dem 26.08. dafür dasteht (Auftraggeber: «Fehlt bei Gemeinschaft die Schnellsuche?») |
| Skript | `check-vorgabeknopf` | Ein Formular mit mehreren Absendeknöpfen, dessen erster nicht benannt ist: Enter in irgendeinem Feld löst den **ersten** in Baumreihenfolge aus. In der Stimmerfassung war das «Ja erfassen», und ein Tastendruck im Begründungsfeld oder in der Parteisuche erfasste damit eine Ja-Stimme (28.08.2026, in Chromium gemessen). Sechs weitere Formulare haben dieselbe Bauart, heute aber kein Feld, aus dem Enter sie auslösen könnte; sie sind benannt, nicht verriegelt |
| Skript | `check-fokusmarke` | Ein `data-marke` (das Attribut heisst `data-fokus` und hat sonst keinen Leser) oder eine feste Marke in `absenden({ marke })` ohne passendes Ziel in derselben Datei: Nach dem Absenden ohne Seitenwechsel bliebe der Fokus auf `<body>`. Bis zum 28.08.2026 schrieb `Rueckfrage.svelte` `data-marke`, während drei Seiten mit eigener Fabrik es auch lasen und alles übrige `data-fokus` nahm. Eingetreten ist der Fall nicht — alle Rückfragen mit Marke standen in genau den beiden Dateien, die `data-marke` lasen. Der Wächter schliesst die Falle, bevor sie zuschnappt |
| Skript | `check-bindziel` | Ein `bind:` auf einen berechneten Zugriff (`gewaehlt[m.id]`): Fehlt der Schlüssel beim Rendern, wirft Svelte an einer Komponente mit `$bindable(vorgabe)` `props_invalid_value` und bricht den umgebenden Block ab. Am Eingang stand deshalb zwei Tage lang «Über den Beamer gemeldet (1)» über einer leeren Liste: kein Formular, kein Knopf, während der Text daneben genau diese Handlung erklärte (29.08.2026). Kein Schritt wurde davon rot: Es lief nur ein Klick ins Leere |
| Skript | `check-haken` | Ein Kästchen **oder verstecktes Feld**, das mit `jaNein()` gelesen wird, aber nicht `true` schickt: Es steht angekreuzt da und kommt als «nicht gesetzt» an (25.08.2026 — die Wertquotenschwelle einer Weisungsregel fiel lautlos weg). Namen, die auch ausdrücklich verglichen werden (`text(…) === 'ja'`), sind nicht entscheidbar; der Wächter übergeht sie und **nennt sie im grünen Lauf** |
| Skript | `check-versammlungszustand` | Ein Vergleich auf `'geschlossen'` an einem **Versammlungs**zustand, der `versiegelt` nicht mitnimmt. Der Zustand hat fünf Werte; sieben Stellen fragten nur den einen ab, und die versiegelte Versammlung galt ihnen als offen: Die Führung schlug einen Vorbereitungsschritt vor, die Protokollseite nannte gesperrte Zahlen «vorläufig», die Leinwand fiel vor dem ganzen Saal auf die Code-Eingabe zurück (04.09.2026). Er kann Versammlung und Abstimmungsdurchgang nicht sicher trennen und erzwingt deshalb ein Urteil: melden oder mit `zustand-nur-geschlossen:` samt Grund begründen |
| Skript | `check-zeitzone` | `toLocaleString` und Geschwister auf einem **Datum** ohne `timeZone`. `Intl` nimmt dann die Zone des Geräts: Der Server liefert in UTC aus, der Browser rechnet um, und dieselbe Angabe steht an zwei Stellen verschieden da. Gemessen am Siegelzeitpunkt, «06:43» in der Oberfläche gegen «08:43» im PDF, und das ist ein Nachweiselement (04.09.2026). Zahlformatierungen bleiben ausgenommen |
| Skript | `check-suchpfad` | Eine Funktion, deren letzte Fassung in `migrations/*.sql` kein `SET search_path` trägt, mit oder ohne `SECURITY DEFINER` (alle seit Migration 164). Ohne Pin löst sie ihre Tabellen über den Suchpfad des Aufrufers auf, und dort steht `pg_temp` vor `public`: Eine temporäre `meeting` fütterte die Betreiberprüfung zweier Löschfunktionen, und die Löschungen trafen einen fremden Betreiber (D1, D2, gemessen 09.10.2026); eine leere temporäre `meeting_handover` hob die Abgabesperre eines Auslösers auf (C1, gemessen 16.10.2026). Eine spätere Migration darf heilen (`CREATE OR REPLACE`, `ALTER FUNCTION … SET search_path`); eine spätere Fassung ohne Pin fällt auf. Ein Pin zählt nur mit `pg_temp` am Ende, sonst durchsucht PostgreSQL es zuerst. Den Katalog der Prüfdatenbank, die aus denselben Migrationen entsteht, prüft `tests/db/suchpfad.test.ts`; eine auf Dev oder Prod von Hand geänderte Funktion sieht keiner der beiden |
| Skript | `check-erfordernisweg` | Ein Feld des Erfordernisses, das der Rechenweg liest, aber eine der drei stillen Stationen dazwischen nicht trägt: der Leseweg aus den Einzelspalten, das beim Öffnen der Abstimmung eingefrorene JSON, oder eine der zwei Übersetzungen aus einer Reglementsregel. Eine Regel «Enthaltungen fallen aus der Bezugsgrösse» war erfassbar, gespeichert und angezeigt und wurde nie gerechnet; zehn Proben blieben grün, weil Kern, Übersetzung und Speicherweg alle **vor** dem Einfrieren enden (04.09.2026) |
| Skript | `check-kopfgewicht` | Ein Ausdruck ausserhalb von `kopfgewicht` (`src/lib/domain/eigentuemer.ts`), der aus der Zählweise das Gewicht einer Partei ableitet (`….length > 0 ? 1 : 0`, `filter(… traegtKopfstimme …).length`), unter `src/lib` und `src/routes`, `.ts` und `.svelte`. Der Ausdruck stand viermal in Auszählung und Beschluss von Hand; die Lesart L3 (Einsprache je Eigentümer) hätte eine fünfte Kopie verlangt, und eine Kopie in der Excel-Mappe war schon entstanden (Lesarten Block 5, 21.10.2026) |
| Skript | `check-waechternamen` | Ein Kommentar, der einen Wächter beim Namen nennt, den es nicht gibt. Der Verweis ist hier eine **Begründung** («hier nicht anfassen, das ist bewacht»), und die Hausregel «nur melden, wer dagegen argumentieren kann» macht ihn unwiderlegbar, sobald der Genannte unauffindbar ist. Sieben Stellen beriefen sich auf den abgelösten `check-ausklapper`, dessen Regel als Stylelint-Regel `versammlung/dreieck-am-summary` weiterlebt (04.09.2026) <!-- waechtername-historisch: der abgelöste Name ist hier der Gegenstand --> |

**Der Aufruf muss decken, was die Konfiguration deckt** (28.08.2026).
`check:code` rief `eslint src scripts e2e` auf, während `eslint.config.js`
alles ausser `node_modules`, `build`, `.svelte-kit`, `static`, `entpackt`
und `daten` erfasst. Wer in der Konfiguration nachsah, fand Deckung;
wer in `package.json` nachsah, fand die Lücke. Die beiden Stellen widersprachen
sich stumm.

Gemessen, statt geschlossen: in jedes Verzeichnis eine bewusst fehlerhafte
Datei gelegt und gezählt, wie viele der Lauf meldet.

| Aufruf | gesehene Dateien |
|---|---|
| `eslint src scripts` (24.08. bis 27.08.) | 424 |
| `eslint src scripts e2e` (27.08.) | 448 |
| `eslint src scripts e2e tests probe "*.{js,cjs,ts}"` | **636** |

Ungesehen waren `tests/` (177 Dateien), `probe/` (5) und die sechs Dateien im
Wurzelverzeichnis, darunter `vite.config.ts` und `eslint.config.js` selbst.
`migrations/` steht bewusst **nicht** in der Liste: Dort liegen 96 Dateien,
ausnahmslos `.sql`, und ESLint hätte dort nichts zu tun.

**Warum nicht einfach `eslint .`.** Das war der erste Anlauf und deckt dieselben
636 Dateien. Er wurde verworfen, nachdem drei Messungen ihn widerlegt hatten:

- **Er wird stumm, wenn der Umfang schrumpft.** `eslint . --ignore-pattern
  'src/**'` endet mit 0 und lintet 229 statt 636 Dateien, ohne ein Wort. Der
  aufgezählte Aufruf endet mit 2 und sagt, dass ein Pfad nichts mehr trifft.
  Genau die Eigenschaft, die der Absatz unten von jedem Wächter verlangt.
- **Er stirbt an einer bewegten Arbeitskopie.** Verschwindet während des Laufs
  irgendwo im Baum eine Datei, endet er mit `ENOENT` und liefert gar kein
  Ergebnis. Hier arbeiten regelmässig mehrere Sitzungen im selben Repo.
- **Er lintet, was nicht im Repo ist.** ESLint liest keine `.gitignore`. Eine
  unverfolgte Kladde irgendwo im Baum blockiert dann jeden Commit, auch in einem
  ganz anderen Bereich, denn der Hook prüft den Arbeitsstand.

**Was weiterhin an mehreren Stellen steht, und das ist kein Versehen:** Der
Umfang hängt nicht nur an `ignores`, sondern auch an den `files`-Mustern.
Gemessen: Von neun Endungen sammelt der Lauf fünf ein (`.js`, `.cjs`, `.mjs`,
`.ts`, `.svelte`); `.tsx`, `.jsx`, `.mts` und `.cts` fielen stumm durch, obwohl
sie in keiner Ignore-Liste stehen. `cjs`, `cts` und `mts` sind deshalb am
28.08.2026 in die Endungsliste aufgenommen worden: Ohne sie bekam
`.dependency-cruiser.cjs` die Regeln aus `recommended`, aber **null**
Umgebungsvariablen und ein scharfes `no-undef` — eine einzige Zeile mit
`console.log` hätte den Prüflauf mit einem Scheinbefund abgebrochen.

**Dieselbe Frage für die Nachbarn gestellt.** Bei Stylelint gibt es ausserhalb
von `src/` keine `.css` und keine `.svelte`, der Aufruf deckt dort also alles,
was da ist; sein Glob nennt aber nur zwei Endungen, eine `.scss` fiele durch.
Beim Schichtenwächter deckt `src/lib src/routes` vier Module weniger ab als
`src` (644 gegen 648) — nachgesehen und **nicht** geändert: Alle fünf Regeln
sind auf `^src/lib/…` verankert, auf `src/hooks.server.ts` und `src/app.d.ts`
kann keine davon feuern. Der weitere Aufruf sähe mehr und prüfte nicht mehr.

**Jeder meldet, wie viel er gesehen hat** («457 tragende Elemente geprüft»).
Das ist keine Zierde: Ein Wächter, dessen Muster nach einem Umbau null Zeilen
trifft, meldet sonst «in Ordnung» und prüft nichts. Beim Einbau dieser
Sichtproben fiel genau das auf — der Stilvariablen-Wächter las nach der
Umstellung nur noch `app.css` (74 statt 1988 Verwendungen), und der
Stromwächter zählte die Verstösse statt der bewachten Menge.

**Die Wächter haben selbst Tests** (`tests/waechter/`): je Regel ein Fall, den
sie finden **muss**, und einer, den sie in Ruhe lassen muss. Der zweite ist der
wichtigere — ein Wächter, der im guten Zustand rot wird, wird abgeschaltet statt
gelesen.

**Dazu eine dritte Frage, die leicht ausfällt: Heisst rot auch, was ich meine?**
Ein Absturz ist ebenfalls rot und belegt trotzdem nichts. Am Rückgabewert sind
die beiden nicht zu trennen: `1` steht gleichermassen für «richtig abgesagt» und
für «gar nicht erst gelaufen», und ein falsch geschriebener Skriptpfad endet
genauso. Wo ein Test seinen Nachweis daran hängt, gehört eine Probe am **Text**
daneben — die erwartete Meldung, oder wenigstens keine Stapelspur. Gemessen am
04.09.2026: Ein Wächter, der absichtlich an einer fehlenden Datei abstürzte,
liess von 19 Prüfungen dieser Bauart 5 grün durchlaufen. Die übrigen 14 fielen
nur deshalb, weil dieselben Dateien auch die Gegenrichtung prüfen.

Dieselbe Falle steckt in Ersatzwerten: `f.status ?? 1` bildet einen per Signal
beendeten Kindprozess auf genau die `1` ab, die als Nachweis gilt. Verdächtig
ist dabei nicht der Ersatzwert an sich, sondern sein **Zusammenfallen mit dem
Nachweiswert** — ein `?? 200` neben einem erwarteten `404` ist harmlos, weil es
keins von beiden trifft.

**Die Antwort darauf steht seit dem 05.09.2026 an einer Stelle**
(`tests/waechter/waechterlauf.ts`): Sie fährt den Wächter und **wirft**, wenn er
abgestürzt ist, statt einen Wert zu liefern, den eine Prüfung übersehen könnte.
Damit hängt die Unterscheidung nicht mehr daran, ob der einzelne Fall daran
gedacht hat. Gemessen vor dem Umbau, mit sechs absichtlich abstürzenden
Wächtern: **17 von 71 Prüfungen blieben grün**; danach fällt jede.

Zwei Dinge, die dabei erst die Gegenprobe zeigte. **Zwei Fassungen trennten
schon vorher — über `f.status !== 1`, und das trennt nichts**, denn genau die
geworfene Ausnahme, um die es geht, endet in Node mit `1`. Der Kommentar
darüber behauptete die Wirkung, gerettet haben allein die Textproben daneben.
Und das Muster für die Stapelspur traf `at foo (/pfad:1:1)` nicht, weil es die
Ziffern am Zeilenende erwartete; gerettet hatte es bis dahin ein zweiter
Fangarm auf `node:internal`, sodass es aussah, als tue es seine Arbeit. Beides
fiel erst auf, als ein eigener Gegentest **winzige Skripte** baute, die je eine
Sorte Ende vorführen — statt echte Wächter zu mutieren, die diese Enden nie
zeigen. Der Unterschied ist der zwischen «der Fall kommt hier nicht vor» und
«der Fall wird erkannt».

**Eine Abweichung, bewusst und noch offen:** `suchschwelle` liegt als einziger
Wächter in `tests/waechter/` selbst statt als ESLint-Regel oder `check-*.mjs`,
und seine Ausnahmen stehen in einer Tabelle in dieser Datei statt an der Stelle,
für die sie gelten. Er liest den Syntaxbaum wie die übrigen und ist zwölffach
gegengeprüft, gehört aber der Form nach neben `versammlung/durchsuchbare-auswahl`
in `scripts/eslint/felder.mjs` — dort trüge jede Ausnahme ihren Grund am eigenen
Ort. Die Umstellung steht aus (27.08.2026).

**Ausnahmen stehen an der Stelle, für die sie gelten**, mit Begründung:

```svelte
<!-- Hier führt das Programm den Wert — mit Absicht: `bind:group` verlöre das
     Angekreuzte, sobald der Filter das Feld aus dem DOM nimmt. -->
<!-- eslint-disable-next-line versammlung/anfangswert -->
```

Vorher standen sie als Dateinamen in einer Liste im Wächter, weit weg von dem,
wofür sie galten.

### Tests

**Im öffentlichen Spiegel** fehlen zwei interne Sperrlisten, gesperrte echte
Namen (`scripts/personendaten-sperre.tsv`) und Angaben zum Betrieb
(`scripts/betriebsangaben-sperre.json`), und die interne CI unter `.gitea/`;
sie bleiben intern, damit sie nicht öffentlich werden (`.gitattributes`).
`npm run pruefen` bricht dort deshalb mit Absicht beim Personendaten-Wächter
ab, und aus demselben Grund sind `tests/waechter/handbuch-betriebsangaben.test.ts`
und `tests/waechter/ci-skripte.test.ts` rot. Geprüft wird im internen Repo,
per Hook vor jedem Commit am Code und per CI nach jedem Push.

**Abschnitte nur im Repo, nicht im Handbuch** (seit 17.11.2026). Was in einem
Kapitel des öffentlichen Handbuchs zwischen `<!-- nur-intern: Grund -->` und
`<!-- /nur-intern -->` steht, je allein auf einer Zeile, lässt
`scripts/handbuch-bauen.mjs` weg; es bleibt in `docs/` und im Quelltext des
Spiegels. Eine Marke ohne Gegenstück oder eine, die nicht erkannt wird, bricht
den Bau ab. Anlass: Der Abschnitt zur Übernahme aus dem Verwaltungswerkzeug des
Hauses (Produktentscheid 16.11.2026); damit er nicht still zurückkommt, sperrt
ihn zudem eine Regel in `scripts/betriebsangaben-sperre.json`. Wächter:
`tests/waechter/handbuch-betriebsangaben.test.ts`.

Drei getrennte Reihen, weil sie Verschiedenes prüfen:

```bash
docker compose exec app npm run test      # Kern: Wertetabellen, ohne Datenbank
docker compose exec app npm run test:db   # Datenbank: Schutzregeln, Auslöser, Rechte
docker compose exec app npm run check     # Typprüfung
scripts/pruefen.sh                         # die drei zusammen, aus dem eigenen Baum
docker compose exec app npm run pruefen   # im Dev-Container: nur Hauptverzeichnis, ohne Sperre, mit voller .env

node e2e/durchspielen.mjs                  # ganze Versammlung im echten Browser
node e2e/sitzungsfuehrung.mjs              # vorwärts, rückwärts, Rückkommen — aus drei Sichten
node e2e/telefonbreite.mjs                # läuft eine Seite auf 390 px quer? nennt den Verursacher
node e2e/themenkontrast.mjs               # dunkles Thema: misst den Kontrast an 3400 Textstellen
node e2e/wahl-vor-hydration.mjs           # Skript anhalten, wählen, loslassen — steht die Wahl noch?
node e2e/ausklapper-vor-hydration.mjs     # dasselbe am <details>: bleibt der Kasten offen, den man vorher aufklappt?
node e2e/rollen.mjs                        # Wächter: wer was ändern darf
node e2e/register.mjs                      # Reiter über die Häuser im Verbund, offene Kacheln oben
node e2e/nirgendwerk.mjs                    # der ganze Verbund gegen ein Protokoll nachgerechnet, Protokoll des Abends als PDF und Word (intern, nicht im öffentlichen Stand)
node e2e/mischform.mjs                     # «digital oder von Hand» — je Haus, mit Rückweg, Nachtrag und Nachtragsliste
node e2e/zuordnung.mjs                     # lösen, rückgängig, umziehen, löschen, umlegen
node e2e/traktandenliste.mjs               # eine Liste für alle, Gliederung bei Abweichung, Muster
node e2e/nichtangekuendigtes.mjs           # neue Sache im Saal: ohne Angabe nur Kenntnisnahme, mit Reglement zur Abstimmung, eingefroren bei der Freigabe
node e2e/gemeinsamer-schritt.mjs           # gemeinsam nur die Kenntnisnahme; abgestimmt wird je Haus, auch mit «beschlussfähig» im Titel
node e2e/abendschritte.mjs                 # laufender Abend: Festhalten und Wandkacheln am Einzelschritt, Sperre unter «Einzeln führen», Sammelaufruf beginnt beim ersten Haus, Rückkommen mit zweitem Durchgang
node e2e/abend-drei-haeuser.mjs            # drei Häuser am Abend: «jetzt» folgt dem jüngsten Aufruf, Sammelaufruf, Folgeantrag als eigener Schritt
node e2e/abendsiegel.mjs                   # der Abend versiegelt, was geht: die Zeile nennt das Hindernis statt «bereit», der Knopf zählt es nicht mit, die Meldung nennt das Haus
node e2e/beschluss-von-hand-am-abend.mjs   # Beschluss von Hand am Abend: ohne Notweg gesperrt, Maske im Kasten, Festhalten mit Summen, Verlauf und Wandkachel ohne Weg, die Standzeile folgt der Anwesenheit, der Satz zur fehlenden Beschlussfähigkeit im Protokoll des Abends, der Verweis bei «Es tagen mit» führt zur Maske
node e2e/eingewendete-bestimmung.mjs       # Grund «Eingewendete Bestimmung» (E2): Abschnitt auf der Karte, Abstimmung nach dem Gesetz angenommen, Hinweis über der Maske, Grund wählen (ohne Notweg-Warnung, Ergebnis fest abgelehnt, Pflichtfelder), Protokoll mit Bestimmung und Einführung ohne den Weg, Verlauf, zwei Absagen ohne neuen Eintrag
node e2e/abendversand.mjs                  # Versandweg am gemeinsamen Abend: je Haus die Fassung des Abendprotokolls als versandt festhalten, im Wortlaut lesen, genehmigen, Löschseite wird löschbar
node e2e/stammdatenwege.mjs                # Einordnung zuerst, Verteiler entfernen, Eigentümer entweder/oder
node e2e/konten.mjs                        # Kennwörter und Konten in der Oberfläche
node e2e/dienste.mjs                       # KI-Kette und Zeitstempeldienst einrichten und prüfen
node e2e/handbuch.mjs                      # eigenes Handbuchfenster, «?» springt an die Stelle
TELEFONE=14 node e2e/last.mjs              # Gleichzeitigkeit: viele Telefone, dazu die Rennen S1 bis S7; vor einer Auslieferung mit ZIEL am GEBAUTEN Stand
node e2e/telefonlatenz.mjs                 # wie schnell ein Traktandumsaufruf aufs Telefon kommt (Story 5.6)
node e2e/netzunterbruch.mjs                # übersteht die Wand einen Netzunterbruch? — braucht den GEBAUTEN Stand, siehe unten
node e2e/herkunft.mjs                      # Herkunftssperre (CSRF): fremde und fehlende Herkunft 403, eigene die fachliche Antwort; nur am GEBAUTEN Stand
node e2e/rollenumgehung.mjs                # Rollentrennung gegen kodierte Pfade, die Ausnahme der Lesarten öffnet nichts weiter, und die Verwaltung kommt weiterhin durch; vor einer Auslieferung mit ZIEL am GEBAUTEN Stand
node e2e/fremdbetreiber.mjs                # Betreiber A auf Daten von B, Kennung in der Adresse (403 oder 404) und in Abfrage oder Formularfeld (einzeln eingeordnete Absage, Feldteil fremdbetreiber-felder.mjs) und unter /z, /p, /b, /e mit Code von A (offener Teil); an B in der Datenbank nichts geändert; am GEBAUTEN Stand
node e2e/einsprache.mjs                    # Einsprache nach Art. 712c Abs. 2: Entscheidbaum, Sperre ohne Betroffene, Zählung ohne sie, Protokoll
node e2e/lesarten.mjs                      # Lesart L4: Vorgabe, Umstellen mit Verlauf, Absage und Nachziehen, Einfrieren, zweites Ergebnis in Leitung und Protokoll
node e2e/lesarten-l1.mjs                   # Lesart L1: Wertquote im Ausstand fällt heraus, eingefroren, Satz vor der Abstimmung, zweites Ergebnis mit Zahlen, Protokoll
node e2e/lesarten-l2.mjs                   # Lesart L2: Zuständigkeitsordnung, qualifiziertes Mehr eingefroren, Satz vor der Abstimmung, zweites Ergebnis nach dem einfachen Mehr, Protokoll
node e2e/lesarten-l3.mjs                   # Lesart L3: Einsprache je Eigentümer, Zahlenbeispiel, einzeln und von Hand (zwei Dreizahlen), zweites Ergebnis, Protokoll
node e2e/lesarten-l5.mjs                   # Lesart L5: neues Traktandum an der zweiten Versammlung, Vorgabe auf der Einstellungsseite, Satz in Vorbereitung und Leitung, Absage mit dem Drittel, Öffnen mit der Hälfte, Protokoll
node e2e/lesarten-l6.mjs                   # Lesart L6: Reglementsschranke nach dem Gesetz, eingefroren, fünf von sechs Ja angenommen, nach der Klausel abgelehnt, Leitung und Protokoll
node e2e/lesarten-l6-rueckkommen.mjs       # Lesart L6 am Rückkommen: Mehr des Beschlusses, Lesart des Beschlusses an der Karte, kein zweites Ergebnis, auch nach dem Umstellen, Protokoll
node e2e/lesarten-l7.mjs                   # Lesart L7: Beschlussfähigkeit hängt am Ausstand; «zählt mit» mit Satz und Protokollzeile, «zählt nicht mit» sperrt, auch konsultativ; Einfrieren in beide Richtungen
node e2e/lesarten-l8.mjs                   # Lesart L8: Häkchen an Traktandum und Vollmacht, Absage an der Wahl, Sperre ab der Freigabe, Einladungssatz je Wahl, ruhen mit Grenzen, leitung mit zweitem Ergebnis, Summen; braucht pdftotext
node e2e/lesarten-l8-folgeantrag.mjs       # L8, Ausweg über Folgeanträge (Entscheid 0045, Punkt 9): Wiederwahl zählt, Entlastung ruht, Sperre am Grundantrag, Protokoll, Abberufung nur als Folgeantrag
node e2e/lesarten-l8-angabe.mjs            # L8, Angabe der Leitung am Folgeantrag (Entscheid 0045, Punkt 11): «andere Verwaltung» und «Kündigung» lassen die Vollmachten zählen, Zurücknehmen, Sperren, Protokollzeile
node e2e/einlass-vorab-vollmacht.mjs       # Einlass einer dritten Person mit vorab erfasster Vollmacht (E3): Name gibt frei, Häkchen «Verwaltung» vorbelegt, Abwählen entfernt, Unberührtes bleibt
node e2e/lesarten-l9.mjs                   # Lesart L9: Zählbasis der Ausschlussklage, Beklagter im Entwurf, unter «anwesende» mit zwei von drei Anwesenden angenommen, zweites Ergebnis an allen über 1a, Protokoll
node e2e/lesarten-l10.mjs                  # Lesart L10: Angehörige im Ausstand an der Ausschlussklage, unter «fallen_heraus» mit zwei von drei übrigen angenommen, Satz vor der Abstimmung, zweites Ergebnis mit ihr in der Zahl, Protokoll
node e2e/lesarten-l11.mjs                  # Lesart L11: Ermächtigung zur Prozessführung, qualifiziertes Mehr eingefroren, Satz vor der Abstimmung, zweites Ergebnis nach dem einfachen Mehr, Protokoll
node e2e/lesarten-l12.mjs                  # Lesart L12: luxuriöse bauliche Massnahme, unter «anwesende» angenommen, obwohl ein Eigentümer fehlt, Rat und zweites Ergebnis nach «alle», Protokoll
node e2e/lesarten-l13.mjs                  # Lesart L13: Zählweise der Köpfe, Art. 647b mit Ausstand unter «anwesende» angenommen, unter «alle» abgelehnt, zweites Ergebnis im Protokoll, keine Wirkung an 647d, Reglement und Klausel, Rückkommen, Auszählmappe mit 9 und 7; Sätze aus dem Wächter, braucht soffice und python3
node e2e/lesarten-l17.mjs                  # Lesart L17: Bezahlung aus dem Erneuerungsfonds, unter «svit» mit dem einfachen Mehr angenommen, nach der strengeren Auffassung abgelehnt, Seite «Lesarten», Karte und Protokoll; ab 2026-11-21 das Häkchen an einer milderen Regel (ohne: Weg auf der Karte, mit: angewandt mit Satz, unter «svit» ohne Satz); an einer strengeren Regel veraltet vor der Freigabe, danach der Satz von damals (Migration 198)
node e2e/lesarten-l15-l16.mjs              # Lesarten L15 und L16 in fünf Fällen: Vertagen nach verlorener Beschlussfähigkeit ergibt unter der Vorgabe eine neue erste, unter «zweite» eine zweite mit Vorgängerin, elftem Tag, Ausklappersatz und Einladungszusatz, noch beschlussfähig eine neue erste; Einlass einer Mitberechtigten über der Höchstzahl angenommen, unter «Zählt mit» abgewiesen; ROTPROBE=L15 oder L16 lässt die Wahl weg; braucht pdftotext
node e2e/lesarten-1a-a.mjs                 # 1a und Anhang A: Ausschlussklage nach den Anwesenden, Mehr aus Gesetz und Reglement nach einer Abweichung, nur in der Leitung
node e2e/statt-versammlung.mjs             # C1 und C2: drei Traktanden über den Baum (Einstimmigkeit, Einstimmigkeit, einfaches Mehr), Gegenproben Nein und Ausgabenrahmen, im Saal 2 von 3 Ja scheitert nur an der Einstimmigkeit
```

**Kein Drehbuch, sondern eine Bühne:** `node e2e/mustergemeinschaft.mjs` baut
den Bestand für den Laientest am Eingang. Eine laufende Versammlung mit
siebzehn Parteien und vierzehn Traktanden, dazu ein gemeinsamer Abend mit zwei
kleinen Häusern, in einem davon die Frage «digital oder von Hand» abgeschaltet;
die Zugangskarten liegen danach als PDF in `/tmp/musterbestand`. Der Bestand
heisst «STWEG Muster…» und wird vom gewöhnlichen Aufräumen **nicht** erfasst.
Das Drehbuch dazu steht in `docs/pruefung/usability-drehbuch-eingang.md`
(internes Arbeitspapier).

> **Die Browserläufe vertragen sich schlecht mit einem gleichzeitigen CI-Lauf**
> (gemessen am 07.09.2026). Gitea Actions legt je Auftrag ein eigenes
> Docker-Netz an und wieder ab; ein headless Chromium, das währenddessen gegen
> `127.0.0.1:3100` läuft, bekommt `net::ERR_NETWORK_CHANGED` und danach
> «Failed to fetch dynamically imported module». Der Durchstich bricht dann an
> wechselnden Schritten ab (gesehen: 18, 86, 89) und sieht aus wie ein Fehler
> der Anwendung. Nach einem Push also entweder den CI-Lauf abwarten oder den
> Abbruch daran erkennen, dass die Schrittnummer von Lauf zu Lauf wandert und
> `ERR_NETWORK_CHANGED` dabeisteht.
>
> `docker events --since 5m --filter type=network` zeigt, ob gerade etwas läuft.
>
> **Seit dem 10.09.2026 fragen die langen Drehbücher selbst** (etwa `durchspielen`,
> `mischform`, `mustergemeinschaft`, `netzunterbruch`). Bricht einer ab, steht unter der
> Meldung eine Zeile aus `e2e/umgebung.mjs`: wie viele Docker-Netzereignisse
> während des Laufs stattfanden, in welchen Netzen, und die letzten fünf mit
> Uhrzeit. **Der Verdacht wird ausgesprochen, die Ursache nicht** — eine
> Gleichzeitigkeit ist kein Beweis, und derselbe Lauf gegen eine ruhige Maschine
> ist es. Die leere Antwort zählt genauso: Sie schliesst die Umgebung aus, statt
> sie offen zu lassen.
>
> Und der Anlass gehört dazu: Es ist nicht nur die CI. Das Arbeitsverzeichnis über den Repos hält
> fünfzehn Repos, aber **einen** Docker-Dienst. Ein `compose up -d` in einem
> fremden Projekt kippt den Lauf genauso, und ein `restart` eines einzigen
> Dienstes auch. Am 10.09.2026 mit mitlaufendem
> `docker events --filter type=network` gemessen, nicht nachträglich abgefragt:
>
> | Vorgang | Netzereignisse |
> |---|---|
> | `exec` | 0 |
> | `build --no-cache` | **0** |
> | `up -d` (zwei Dienste) | **8** |
> | `restart` (ein Dienst) | 2 |
>
> Das fällt gegen die Vermutung aus, die drei Sitzungen den Tag über hatten: Der
> Bau ist entlastet, `up -d` ist der Verursacher. Dass es niemandem auffiel,
> liegt daran, dass im Alltag auf jeden Bau ein `up -d` folgt. Und zwei
> Ereignisse reichen: Ein angelegtes und sofort entferntes Wegwerfnetz hat einen
> laufenden Browserlauf gekippt (53 Schritte grün, fünf `ERR_NETWORK_CHANGED`;
> derselbe Lauf ohne Zutun: keine Meldung).
>
> **Der CI-Absatz oben hatte damit recht und kannte nur die Ursache nicht:**
> Gitea Actions legt je Auftrag ein eigenes Netz an und räumt es ab. Ein
> gekippter Lauf muss also nicht an einem Menschen liegen, und keine Absprache
> unter Sitzungen schützt davor.

#### Was nicht gegen den Entwicklungsserver läuft

Vier Durchstiche gehören vor jeder Auslieferung an den gebauten Stand:
`herkunft.mjs`, `rollenumgehung.mjs`, `fremdbetreiber.mjs` und `last.mjs`.
Welcher was belegt und warum, steht in `docs/agents/entwicklung.md`,
«Durchstiche gegen den gebauten Stand». `herkunft.mjs` läuft gegen den
Entwicklungsserver absichtlich rot, weil SvelteKit die Herkunftssperre dort abschaltet. Aufgesetzt wird der
gebaute Stand wie unten, und jeder der vier bekommt `ZIEL=http://$IP:3101`:
Ohne es laufen `rollenumgehung.mjs` und `last.mjs` still gegen den
Entwicklungsserver.

`e2e/netzunterbruch.mjs` misst, ob eine Saalsicht einen Netzunterbruch übersteht
— und braucht dafür den **gebauten** Stand:

```bash
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker compose ps -q app))
docker compose exec -T app npm run build
docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build"
ZIEL=http://$IP:3101 node e2e/netzunterbruch.mjs
```

**Warum nicht wie die anderen.** Vites HMR-Client lädt die Seite bei
Verbindungsverlust von sich aus neu und landet dabei auf derselben Fehlerseite,
gegen die dieser Durchstich gebaut ist. Am Entwicklungsserver bleibt er deshalb
rot, auch wenn die Anwendung richtig ist — im Bau gibt es diesen Client nicht.

Drei weitere Fallen, alle gemessen und im Kopf des Drehbuchs begründet:
`vite preview` liefert die Ereignisströme nicht aus (die Antwort wird
gepuffert); der Strom lebt **im Prozess**, Sitzungsleitung und Wand müssen
deshalb denselben Server benutzen; und ein `docker compose restart app` nimmt
den gebauten Stand mit, weil er im selben Container läuft.

Dieselben Stufen ohne die Browser-Reihe laufen als Gitea-Actions-CI bei
jedem Push (`.gitea/workflows/ci.yml`, seit 2026-08-17) — die
Datenbanktests dort gegen ein frisches Postgres als Service-Container.

**Warum es den dritten braucht.** Kern- und Datenbanktests prüfen Rechenwege und
Schutzregeln. Was sie nicht sehen: ob ein Formular seine Eingabe überhaupt
abschickt. Genau daran scheiterte die Anmeldung — Svelte setzte bei der
Hydration `value={…}` zurück und leerte das getippte Feld, während dieselbe
Anmeldung per HTTP-Aufruf tadellos funktionierte. **Bei einem uncontrolled Input
gehört deshalb `defaultValue` beziehungsweise `defaultChecked` hin, nicht
`value`/`checked`** — sonst überschreibt die Hydration, was der Benutzer bereits
getippt hat.

Der Durchlauf spielt eine ganze Versammlung durch: leere Gemeinschaft →
Einheiten → Eigentümer → Traktandum → Erfordernis → Freigabe → Zugänge →
Eröffnung → zwei Telefone → Abstimmung → Verkündung → Schluss → Auswertung. Vier
Browser-Kontexte, weil Leitung, Telefone und Beamer im Saal auch getrennte Geräte
sind. Er legt echte Daten an und räumt sie nicht weg; jeder Lauf trägt einen
Zeitstempel im Namen.

**Und genau daraus folgt der Handgriff, der einem Drehbuch seinen Wert
erhält: Fahre es einmal auf einer leeren Datenbank.** Wird es dabei rot, baut
es auf Rückstände früherer Läufe statt auf Voraussetzungen, die es selbst
anlegt: Dann prüft es irgendwann den Bestand und nicht mehr die Anwendung.

Am 28.08.2026 nachgemessen, nachdem rund vierzig Durchläufe an einem Tag 572
Gemeinschaften und 72 MB hinterlassen hatten. Beim Neuaufsetzen kam beides
heraus:

* `durchspielen.mjs` zählte die Gemeinschaftsliste, **bevor** es seine eigene
  Wegwerf-Gemeinschaft anlegte, und ein Drehbuch über den Verbund verglich Rollstände mit
  einer Toleranz, die am Umfang des Bestands hing. Beide waren auf der leeren
  Datenbank sofort rot und hatten also nie geprüft, was sie zu prüfen
  behaupteten.
* Umgekehrt stand ein roter Schritt («Die Startseite zeigt
  EINEN Abend») bereits **als Codefehler in einer Befundliste**, und war nach
  dem Aufräumen grün. Der Fehler lag nie im Code, sondern im Bestand. Das ist
  teurer als ein rotes Drehbuch: Jemand arbeitet ihn ab und sucht im Code nach
  etwas, das dort nicht ist.

  **Aufräumen hat ihn nicht geheilt** (02.09.2026). Derselbe Schritt war wieder
  rot und stand wieder als offener Befund in der Liste — vier Tage und ein paar
  Dutzend Durchläufe später. Der eigentliche Fehler war nicht der Bestand,
  sondern dass der Schritt ihn nicht verträgt: «Jetzt im Saal» kürzt auf acht
  Kacheln, und er zählte nur die sichtbaren. Der Fehlertext nannte genau acht
  Karten; die Zahl stand da und wurde zweimal nicht gelesen.

  Also: **Ein Schritt, den ein gewachsener Bestand rot macht, ist selbst der
  Befund.** Aufräumen setzt ihn zurück, es repariert ihn nicht. Er zählt
  entweder nur, was zu seinem eigenen Lauf gehört, oder er hebt die Kürzung
  vorher auf.

**Beide Datenlagen täuschen, in entgegengesetzte Richtungen.** Ein leerer
Bestand verdeckt Schemafehler: Ein Endpunkt, der über Zeilen läuft, prüft
sein Schema erst an der ersten Zeile und antwortet bei null Zeilen fröhlich
`[]`. Ein gewachsener verdeckt fehlende Voraussetzungen und erzeugt
Phantom-Befunde. Deshalb: Endpunkte nie mit leerer Tabelle abnehmen,
Drehbücher nie nur auf gewachsenem Bestand, und einen Praxisbefund auf
frischem Bestand gegenprüfen, bevor er als Codefehler in eine Liste wandert.

Neu aufsetzen geht so, **auf Ansage und nicht nebenbei** (die Sicherung
gehört an einen Ort, den ein Neustart überlebt; `/tmp` wird auf dem Dev-Host beim
Booten geleert):

```bash
docker compose exec -T postgres pg_dump -U versammlung -d versammlung \
  | gzip > /var/backups/versammlung-dev-$(date +%Y%m%d).sql.gz
docker compose down -v && docker compose up -d
docker compose exec -T app npm run migrate
docker compose restart app          # sonst «cached plan must not change result type»
# Prüfkonto neu anlegen; das Kennwort über die Umgebung, nie als Argument:
docker compose exec -T -e VERSAMMLUNG_PASSWORT app \
  node scripts/benutzer-anlegen.mjs pruefer "Prüfer" admin
```

Playwright liegt bewusst nicht in diesem Projekt — der Browser braucht
Systempakete, die im schlanken Node-Abbild fehlen. Den Pfad nennt
`PLAYWRIGHT_PFAD`; ohne die Variable muss Node das Paket `playwright` selbst
finden, sonst bricht jedes Drehbuch mit einer Ansage ab (`e2e/playwright-pfad.mjs`).
Wo es am Dev-Host liegt, steht in der Betriebsdoku des Dienstes. Ziel und Zugangsdaten über `ZIEL`, `BENUTZER`,
`KENNWORT`; für das Leitungskonto `BENUTZER_LEITUNG` und `KENNWORT_LEITUNG`.
Das Kennwort ist Pflicht: Ohne Variable bricht das Drehbuch ab
(`e2e/zugang.mjs`), eine Vorgabe im Skript gibt es nicht.

### Was unter Gleichzeitigkeit geschieht

```bash
node e2e/last.mjs            # 14 Telefone, so viele wie eine kleine Gemeinschaft hat
TELEFONE=120 node e2e/last.mjs
```

Seit dem 15.10.2026 folgen auf den Ablauf die Rennen S1 bis S7 aus dem
Sicherheitsdurchgang (Stimme gegen Schliessen, zwei Schliessvorgänge, Pause,
fremde Einheit, Handzählung gegen Einzelstimme, eingefrorener Stand, zwei
Stichentscheide). Geprüft wird, dass jede Abweisung ein Satz ist und keine
500-Seite. S6 braucht eine gerade Zahl Geräte und wird sonst übersprungen.

Der Durchlauf oben prüft den Ablauf mit zwei Telefonen. Was er nicht prüft, ist
der Saal: vierzehn Geräte am selben Ereignisstrom, und die Frage muss bei
**allen** stehen, sobald die Sitzungsleitung sie freigibt. Story 5.6 nennt dafür
zwei Sekunden; bis zum 04.08.2026 war das eine Behauptung.

Die Telefone laufen bewusst ohne Browser — vierzehn Chromium-Kontexte messen
vor allem Chromium. Sie tun genau das, was ein Telefon im Saal tut: Code
einlösen, am Ereignisstrom hängen, ein Formular abschicken. Nur die
Sitzungsleitung braucht einen Browser.

Gemessen am 04.08.2026 gegen den Entwicklungsserver (kein WLAN, keine echten
Geräte — der Lauf sagt, ob die Anwendung mit Gleichzeitigkeit zurechtkommt,
mehr nicht):

| | 14 Telefone | 60 | 120 |
|---|---|---|---|
| Abstimmung eröffnen bis zum letzten Gerät | 64 ms | 67 ms | 94 ms |
| Ergebnis bis zum letzten Gerät | 60 ms | 75 ms | 104 ms |
| Stimmabgabe, alle gleichzeitig (Median) | 51 ms | 313 ms | 779 ms |

Der Ereignisstrom skaliert flach — er trägt Zahlen und Kennungen, und ein
Rundruf an 120 offene Verbindungen kostet nichts. Die Stimmabgabe wächst
linear, weil jede eine eigene Schreibrunde in die Datenbank ist. Bei 120
gleichzeitigen Stimmen wartet die letzte rund eine Sekunde; das ist die Grenze,
die als Erstes zu spüren wäre.

**Nachgemessen am 14.08.2026**, nach Ausstand und Vertretungsverbot:

| | 14 Telefone | 120 |
|---|---|---|
| Abstimmung eröffnen bis zum letzten Gerät | 69 ms | 159 ms |
| Ergebnis bis zum letzten Gerät | 67 ms | 221 ms |
| Stimmabgabe, alle gleichzeitig (Median) | 92 ms | 1088 ms |

Der Rundruf blieb flach, die Stimmabgabe wurde bei 120 um rund 300 ms langsamer.
**Woran das liegt, ist nicht gemessen.** Naheliegend ist der Ladepfad der
Telefonseite: Seit dem Ausstand ermittelt sie bei jedem Aufbau, wer bei diesem
Traktandum nicht mitstimmt (`holeStimmsperren` in `routes/z/+page.server.ts`),
und liest dafür den ganzen Anwesenheitsstand samt Vollmachten. Der Lauf schickt
das Formular als gewöhnliche Übermittlung, der gemessene Wert dürfte diesen
Aufbau also enthalten. Wer es genau wissen will, misst den Schreibpfad einzeln;
bis dahin ist das eine Vermutung und keine Feststellung.

Die Zusage aus Story 5.6 (zwei Sekunden auf jedem Gerät) hält in beiden Läufen.

### Gegen ein Protokoll rechnen

Die Läufe oben prüfen, ob die Anwendung in sich stimmig rechnet. Ob sie
**dasselbe** rechnet wie eine Bewirtschaftung von Hand, prüft ein anderer Weg:
Für einen Prüffall werden ein Reglement und ein von Hand gerechnetes Protokoll
nachgestellt; jeder bezifferte Beschluss wird nachgerechnet und mit dem
Protokoll verglichen.
Die Stimmenverteilung lässt sich aus den Wertquoten des Protokolls
rekonstruieren, wenn sie ohne Rest aufgeht. Weicht ein Ergebnis ab, ist
entweder die Anwendung falsch oder das Protokoll; beides muss man wissen.

Diese Drehbücher sind intern und stehen nicht im öffentlichen Stand.

Die Datenbanktests legen für jeden Lauf eine eigene Datenbank an und werfen sie
danach weg. Das ist kein Komfort, sondern Notwendigkeit: Der Verlauf ist nur
anfügbar, Prüfdaten liessen sich daraus nicht mehr entfernen, ohne genau den
Schutz auszuhebeln, den die Tests belegen sollen. Nebenwirkung mit eigenem Wert —
die Migrationskette läuft bei jedem Lauf einmal von Null durch.

Sie laufen unter der Anwendungsrolle, und der erste Test prüft genau das. Ohne
ihn bewiese keiner der übrigen etwas.

### Erstes Konto anlegen

Ohne Konto kommt niemand hinein; eine Selbstregistrierung gibt es bewusst nicht.

```bash
docker run --rm -v "$PWD":/app -w /app --network versammlung_default \
  -e DATABASE_MIGRATION_URL="postgres://versammlung:entwicklung@postgres:5432/versammlung" \
  -e VERSAMMLUNG_PASSWORT="ein-langes-kennwort" \
  -e VERSAMMLUNG_BETREIBER="Ihre Bewirtschaftung" \
  node:24-alpine node scripts/benutzer-anlegen.mjs <benutzername> "<Anzeigename>" admin
```

Das Kennwort geht über eine Umgebungsvariable, damit es nicht in der Prozessliste
und in der Verlaufsdatei der Shell landet.

## Vertretung und Vollmacht

**Zwei Wörter, zwei Wortstämme.** Wer die Stimme ausübt, heisst überall die
**bevollmächtigte Person**; wem die Stimme zusteht, steht als **«Vollmacht
für …»**. Das frühere Paar «Vertreter / Vertretener» unterschied sich um zwei
Buchstaben — in einer Liste im Saal ist das die Verwechslung eingebaut, und
«Vertretener» wäre ohnehin falsch, wo eine Gemeinschaft vertreten wird. Eine
Präposition braucht kein Geschlecht und kein Hauptwort. Im Code heissen die
Felder entsprechend `bevollmaechtigt*` und `vertretene*` statt `vertreter*` und
`vertretene*`.

**Erst prüfen, dann aktivieren** (FR-23 bis FR-25). Eine erfasste Vollmacht
überträgt nichts; erst die ausdrückliche Bestätigung durch die Sitzungsleitung
macht sie wirksam, und die verlangt einen Nachweis — «Original hat vorgelegen»
genügt, denn das ist der Weg am Eingang, und das Foto kommt später.

Zwei Entscheide, die man dem Code sonst nicht ansieht:

- **Die Wirkung ist ein Anwesenheitsereignis, keine zweite Wahrheit.** Trifft
  der Vertreter ein, wird für jede vertretene Partei ein `eingetroffen` mit dem
  Weg `vertretung` geschrieben; geht er, gehen sie mit. Würde die Anwesenheit
  einer vertretenen Partei stattdessen beim Lesen aus der Vollmacht abgeleitet,
  gäbe es zwei Quellen für dieselbe Aussage — und ein später widerrufenes
  Vollmachtsverhältnis verschöbe rückwirkend das Ergebnis einer Abstimmung von
  20:00 Uhr (AD-16).
- **Die Vollmacht gilt für die ganze Partei, nicht je Einheit.** FR-23 nennt
  «für alle oder für einzelne Einheiten»; eine Teilvollmacht hiesse, dass eine
  Partei für zwei ihrer drei Einheiten anwesend wäre und für die dritte nicht.
  Das kann die Anwesenheit als Ereignisfolge nicht ausdrücken, und es zöge sich
  durch Beschlussfähigkeit, Auszählung und Präsentationssicht. Bewusst
  ausgewiesen, nicht vergessen.
- **Die bevollmächtigte Person stimmt vom eigenen Gerät** (FR-38 mit FR-23). Das
  Telefon zeigt die eigene Stimme und jede bestätigte Vollmacht als eigenen
  Block; jede Abgabe geht für sich hinaus. `holeAusuebbare` bestimmt, was ein
  Gerät darf, und die Route prüft es noch einmal — eine abgeschickte Anfrage
  darf nicht davon abhängen, was eine Seite gezeigt hat. **Kein Sammelknopf
  «alle gleich»**: Zwei Vollmachten können verschiedene Weisungen tragen, und
  ein solcher Knopf ist genau dann bequem, wenn er falsch ist. An der Stimme
  steht über `vote.cast_by_party_id`, wer sie ausgeübt hat (FR-56) — leer, wo
  jemand für sich selbst stimmt, denn ein Wert, der in neun von zehn Zeilen
  dasselbe wiederholt, verdeckt die Ausnahme.

**Eine Vollmacht gehört ihrer Versammlung, und das wird gefragt.** Jede
Handlung an einer Vollmacht bekommt zwei Werte aus zwei Quellen: die
Versammlung aus der Adresse (auf der Tagesseite sogar aus dem Formular, geprüft
gegen die Häuser des Abends) und die Kennung der Vollmacht aus dem Formular.
Bis zum 06.09.2026 verglich die beiden niemand. `nurVorDemSchluss` beurteilte
die Versammlung aus der Adresse, gelesen und geschrieben wurde die Vollmacht
aus dem Formular — wer eine offene Versammlung als Adresse nahm und die
Kennung einer Vollmacht aus einer geschlossenen einsetzte, kam an der Schranke
vorbei, die nach dem Schluss jede Änderung verbietet. Die Zeilensicherheit
begrenzt das auf den eigenen Betreiber; über die Grenze zwischen dessen
Gemeinschaften sagt sie nichts.

Die Bedingung sitzt deshalb am **Lesevorgang** (`holeEine`), nicht an den
einzelnen Handlungen: Bestätigen, Vorlage vermerken, Zurückweisen, Widerrufen
und Nachweis anhängen holen die Vollmacht alle darüber, und der Typ erzwingt
seither, was vorher Sorgfalt war. Zwei Wege lesen sie nicht und fragen eigens
nach (`verlangeVollmachtIn`). Wer einen sechsten Weg baut, muss dasselbe tun —
und er muss **absagen**, nicht bloss die Zeile verfehlen: Ein `UPDATE` ohne
Treffer sieht von aussen aus wie ein erfolgreiches, und der Verlaufseintrag
dahinter bezeugte dann einen Nachweis, den es nie gab.

Die Schranke aus dem Reglement (Höchstzahl Vollmachten je Person) **sperrt seit
dem 24.09.2026 beim Erfassen**, in `erfasseInTx` und damit auf allen fünf Wegen,
die dorthin führen. Ohne hinterlegte Zahl wird nichts geprüft: Das Gesetz kennt
keine Schranke, sie kommt allein aus dem Reglement. Hier stand bis dahin, die
Anwendung warne nur und über die Zulassung entscheide die Versammlung — der
Grund für den Wechsel ist, dass die überzählige Vollmacht bei Köpfen und
Wertquoten mitzählt und den Beschluss angreifbar macht.

**Nicht zur Höchstzahl zählen Organvertreter juristischer Personen, gesetzliche
Vertreter und Mitberechtigte** (Ä-28 der Zweitprüfung vom 17.09.2026,
Migration 120). Sie handeln nicht kraft Vollmacht, sondern stehen für die
Eigentümerin selbst. Beim Erfassen wird das als eine von drei festen Tatsachen
gewählt, nicht als Freitext begründet, und der Grund steht danach im Protokoll.
Der Eigentümerweg bietet die Auswahl nicht an: Dort wird eine Vollmacht
erteilt, und eine gesetzliche Vertretung wird nicht erteilt.

**Der Einlass macht beides in einem Vorgang** (`lasseEinMitVertretungen`): Am
Eingang steht eine Person mit drei Blättern, und der Weg über die
Vollmachtsseite hiesse einlassen, Seite wechseln, je Vollmacht dreimal tippen,
zurückwechseln — mit der Schlange im Rücken. Deshalb ein Formular, ein Tipp, und
alles in **einer** Transaktion: Bräche es in der Mitte ab, wäre jemand anwesend,
dessen Vollmachten teils erfasst und teils bestätigt sind. Dass hier ohne
Zwischenschritt bestätigt wird, ist kein Bruch von «erst prüfen, dann
aktivieren» — die prüfende Person ist die, die am Tisch steht.

**Was nicht gehen kann, steht gesperrt in der Auswahl statt zu fehlen.** Eine
Partei, die schon im Saal ist, kann niemanden bevollmächtigen (sie übt selbst
aus, und die Vollmacht endete im selben Augenblick wieder, FR-25); eine Partei,
die selbst vertreten wird, kann keine Vollmacht ausüben (wer nicht da ist, hebt
für niemanden die Hand). Beides prüft `erfasseInTx` noch einmal — eine
abgeschickte Anfrage darf nicht davon abhängen, was eine Seite angezeigt hat.
Sichtbar bleiben die Einträge trotzdem, mit Grund: Ein fehlender Name lässt im
Saal offen, ob man sich vertippt hat.

Deshalb beginnt `lasseEinMitVertretungen` damit, die **eigene** Vertretung der
eintreffenden Person zu beenden — sonst wiese die Prüfung «wer selbst vertreten
wird, kann nicht ausüben» genau die Person ab, die eben zur Tür hereinkam.

**Eine dritte Person ist keine Partei** und kann deshalb nicht «eintreffen»:
kein Eintrag in der Momentaufnahme, keine Karte, kein Code. Ohne eigenen Weg
führte der naheliegende in die Irre — die vertretene Partei von Hand zu erfassen
gilt als «selbst erschienen» und beendet die eben geprüfte Vollmacht.
`lasseDurchDritteEin` macht deshalb die **vertretene Partei** anwesend, mit dem
Namen der Person in der Bemerkung; abgestimmt wird über die Sitzungsleitung oder
über einen Ausgabecode auf ihrem eigenen Telefon.

**Eine beendete Vertretung nimmt die Anwesenheit mit**, die sie erzeugt hat.
Gefunden am 04.08.2026: Vorher blieb die vertretene Partei als anwesend stehen,
obwohl niemand mehr ihre Stimme ausübte, und die Beschlussfähigkeit rechnete sie
weiter mit. Nur wenn die Anwesenheit **aus** der Vertretung stammt — wer selbst
eingetroffen ist, bleibt. Damit sich `anwesenheit.ts` und `vollmacht.ts` dafür
nicht gegenseitig einbinden müssen, liegt der Zugriff auf die Ereignisse in
`anwesenheitsereignisse.ts`.

## Abschlusspaket und Siegel

**Der Nachweiswert entsteht nicht dadurch, dass Daten nicht bearbeitet werden
können, sondern dadurch, dass jede Bearbeitung auffällt.** Über jeden
Bestandteil des Pakets wird eine SHA-256-Prüfsumme gebildet; die Prüfsummen
stehen im Manifest, und die Prüfsumme über das Manifest ist das Siegel. Wer
einen Bestandteil austauscht, ändert dessen Prüfsumme; wer die Prüfsumme
nachzieht, ändert die des Manifests — und die steht ausserhalb.

**Die Reihenfolge beim Versiegeln ist nicht beliebig**: erst lesen, dann
rechnen und packen, dann Paket ablegen und Siegel eintragen — und **erst zum
Schluss** die Versammlung auf `versiegelt` setzen. Andersherum liefe der
Schreibschutz gegen die eigene Erzeugung.

**Der Schreibschutz liegt in der Datenbank** (FR-55 wörtlich: «auf Ebene der
Datenhaltung, nicht nur in der Oberfläche»): ein Auslöser je Tabelle für
`vote`, `attendance_event`, `proxy`, `voting_round`, `snapshot_party` und
`agenda_item`. Wer morgen einen neuen Weg zum Schreiben baut, kommt dort vorbei,
ob er will oder nicht. Am Traktandum bleibt **einzig die Protokollnotiz** offen,
und die Absage nennt die Spalte, an der es liegt.

> **Falle, die dabei zutage kam:** In einem `BEFORE`-Auslöser sind **erzeugte
> Spalten** (`GENERATED ALWAYS AS … STORED`) in `NEW` noch nicht berechnet —
> dort steht NULL, während `OLD` den Wert trägt. Ein Vergleich `NEW` gegen `OLD`
> findet deshalb immer einen Unterschied, auch bei gar keiner Änderung. Die
> Ausnahmeliste kommt jetzt aus dem Katalog (`pg_attribute.attgenerated`), damit
> die nächste erzeugte Spalte nichts kaputtmacht.

**Der Zeitstempel bezeugt das Siegel, nicht das Paket.** RFC 3161, Kern in
`domain/asn1.ts` und `domain/rfc3161.ts` von Hand — ein Zeitstempel ist ein
kleines ASN.1-Dokument, und eine Bibliothek an der Stelle, an der es um die
Beweiskraft geht, wäre eine Abhängigkeit zu viel. Bezeugt wird die Prüfsumme
über das Manifest: Sie steht **vor** dem Packen fest, und nur so kann die
Antwort des Dienstes noch mit ins Paket (FR-53). Bezeugte sie das ZIP, änderte
sie es beim Hineinlegen und zerstörte die eigene Aussage.

> **Zwei Fallen, beide am echten Dienst gefunden:** Das Streuverfahren steht in
> der **Antwort**, nicht in der Anfrage — freetsa signiert mit SHA-512, obwohl
> die Anfrage auf SHA-256 lautet. Und der Zufallswert reist als DER-Zahl:
> Führende Nullen fallen weg, vor ein gesetztes oberstes Bit kommt eines dazu.
> Byteweise verglichen meldet jede zweite Anfrage einen
> Wiedereinspielungsversuch.

**Ohne Netz bricht nichts ab.** «ausstehend» heisst nachholen, «gescheitert»
heisst hinschauen. Der Unterschied ist der Punkt: Im Versammlungsraum ohne Netz
ist das Erste der Regelfall.

**Die Weisung an die bevollmächtigte Person ist eine Empfehlung, keine Stimme.**
Wer über den persönlichen Zugang bevollmächtigt (je Gemeinschaft freizuschalten,
mit Fundstelle), kann zu jedem Antrag eine Weisung setzen; sie erscheint auf dem
Telefon der bevollmächtigten Person und hebt den Knopf hervor, abgeben muss sie
ihn selbst. Eine automatische Stimme wäre eine Briefwahl und damit etwas
rechtlich anderes. Der Antragswortlaut wird beim Erteilen mitgeschrieben — ändert
er sich, fällt die Weisung sichtbar weg.

**Rückkommen und Überholen sind zwei Wege, nicht einer mit zwei Begründungen.**
Überholt wird ein **fehlerhafter** Durchgang — der Wille der Versammlung war nie
richtig erfasst, und die Leitung stellt das richtig. Beim **Rückkommen** war der
Durchgang einwandfrei, und die Versammlung ändert ihren eigenen Beschluss; also
beschliesst sie darüber. Seit FR-44 trägt jeder weitere Durchgang seinen Grund
bei sich (`voting_round.reconsideration_item_id`), und ein Rückkommensbeschluss
trägt genau einen — vorher liess sich eine Abstimmung beliebig oft wiederholen.
Einen Durchgang, den die Leitung als `korrektur` überholt, zählt er nicht mit
(`verbrauchtDenRueckkommensantrag`, Teilindex aus Migration 131): Dann gilt der
frühere Beschluss wieder (`superseded_by_round_id`, zurückgenommen in
`setzeNeuabstimmungAn`), und der nächste Durchgang läuft unter demselben
Rückkommensbeschluss, auch wenn gerade keiner gilt.

**Die Pause ist eine Schicht, kein Wandbild** (Migration 073). Die Wandbilder
weichen einem laufenden Geschäft; die Pause legt sich darüber — auch über eine
offene Abstimmung. Sie schliesst nichts: Der Durchgang bleibt offen, die Stimmen
bleiben stehen, gesperrt ist allein das Weiterstimmen. Der Schalter steht ganz
oben in der Sitzungsleitung, ohne Rückfrage in beide Richtungen.

**Der Abschluss steht dort, wo sonst das nächste Geschäft steht.** Ist das
letzte Traktandum aufgerufen und nichts mehr offen, führt die Kachel «nachher»
zum Schluss. Die Leinwand zeigt danach die Beschlüsse des Abends; der
Anzeigecode gilt dafür noch eine Stunde (Migration 074), damit die Wand nicht im
selben Augenblick auf die Code-Eingabe zurückfällt.

**Erfolgsmeldungen erscheinen unten rechts**, Absagen bleiben über dem Inhalt.
Eine Quittung ist gelesen und weg; eine Absage hält auf und muss stehen, bis
jemand den genannten Weg geht. Wer Prüfschritte schreibt, liest die
Quittungsecke mit (`.einblender`).

**Was im Saal entsteht, ist ein Untertraktandum.** Rückkommens- und Folgeanträge
hängen unter dem angekündigten Punkt, in dessen Kern sie liegen: aus 8 wird 8.1.
Der Grundsatz dahinter ist derselbe, der auch neue Beschlüsse begrenzt — es kann
nur beschlossen werden, was angekündigt war, soweit das Reglement nichts anderes
gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2). Die Nummer sagt das mit, und keine Nummer der Einladung verschiebt sich
dadurch.

**Die Traktandennummer hängt an der Einladung, nicht an der Reihenfolge.** Mit
der Freigabe wird sie festgeschrieben (`agenda_item.released_number`,
Migration 072) — im selben Arbeitsgang wie die Momentaufnahme des
Stimmberechtigtenstands, aus demselben Grund. Danach darf die Versammlung
umordnen, ohne dass die Nummern wandern; das Protokoll vermerkt beim
vorgezogenen Punkt, dass die Reihenfolge geändert wurde. Vor der Freigabe
rechnet die Liste weiter aus der Position. Gerechnet wird an einer Stelle
(`domain/traktandenbaum.ts`), und die Rangfolge ist: von Hand gesetzt → bei der
Freigabe festgeschrieben → gerechnet.

**Betriebsdaten löscht eine eigene Datenbankfunktion** (FR-57), nicht ein
`GRANT DELETE`. Die Anwendungsrolle darf Zugänge und Gerätesitzungen bewusst
nicht löschen — ein gelöschter Zugang liesse sich sonst nicht von einem nie
erzeugten unterscheiden. `betriebsdaten_loeschen` ist der eine eng gefasste Weg
daneben: nach der Versammlung, für genau drei Tabellen, mit eigener Prüfung des
Zustands und des Betreibers, weil sie den Zeilenschutz umgeht.

**Eine ganze Versammlung löscht erst, wer die Anfechtungsfrist abgewartet hat**
(Produktentscheid 17.09.2026, Migrationen 113 und 114). Bis dahin hielt Migration
042 ein versiegeltes Paket zehn Jahre fest, ohne dass es danach einen Löschweg
gab. Jetzt werden Abschlusspaket und unterzeichnetes Protokoll bei der Verwaltung
aufbewahrt, sonst beim Stockwerkeigentümer, der den Vorsitz geführt hat, und
Votum löscht die Versammlung ab dem Tag nach
**letzter Zustellung des Protokolls + 1 Monat + 30 Tage Reserve**. Die Regel
steht zweimal, im Kern (`domain/loeschfrist.ts`, erklärt vorher) und in
`versammlungen_endgueltig_loeschen` (entscheidet). Offene Pendenzen sperren, ein
gemeinsamer Abend geht nur als Ganzes, und drei Bestätigungen werden abgefragt.
Die Funktion hebt nur die fünf Auslöser auf, die das Löschen immer verbieten,
entfernt deren Kinder ausdrücklich und löscht den Rest unter vollem
Fremdschlüsselschutz; ein Verweis, den sie nicht kennt, lässt sie scheitern statt
verwaisen. Die Einträge im Verlauf gehen mit, an der Gemeinschaft bleibt ein
Vermerk ohne Eigentümernamen. Der Plan mit allen Entscheiden steht in
`docs/plan-loeschen-nach-frist-2026-09-17.md`.

**Und erst, wenn das Protokoll genehmigt ist** (Migration 115, nach der
Zweitprüfung der juristischen Gegenlesung, Punkt E-2). Die Berichtigung des
Protokolls lässt sich bis zur nächsten Versammlung verlangen, auch nach Ablauf
der Anfechtungsfrist (Wermelinger, Rz. 136, 138 ad Art. 712n). Löschbar ist
deshalb nur eine **versiegelte** Versammlung mit einer Protokollfassung «von der
Versammlung genehmigt», und eine spätere geschlossene Versammlung derselben
Gemeinschaft muss spätestens am Tag dieser Fassung stattgefunden haben.
`protokoll_genehmigung(uuid)` bestimmt den Stand an einer Stelle; Löschfunktion,
Löschseite und Pakettabelle lesen ihn dort. Eine Mindestfrist in Jahren gibt es
nicht.

**Der Zeitstempel darf fehlen** — bewusste Abweichung vom Fail-closed-Verhalten
in immotool: Der Abschluss einer Versammlung darf nicht an fehlendem Internet
scheitern, und der Betrieb ohne Netz ist ausdrücklich vorgesehen (AD-9). Das
Paket trägt dann «ausstehend»; die Lücke wird sichtbar gemacht statt
verschwiegen.

## Das Protokoll

**Der Entwurf ist eine reine Funktion** (`domain/protokoll.ts`): dieselben Daten
hinein, derselbe Text heraus — ohne Datenbank, ohne Uhr. Ein Protokoll ist der
Text, den ein Gericht liest, wenn ein Beschluss angefochten wird; was darin
steht, muss sich mit einer Wertetabelle belegen lassen. Der Erstellungszeitpunkt
kommt deshalb von aussen herein.

Er **formuliert nichts neu**: Zahlen und Beschlusswortlaute werden übernommen,
und wo etwas fehlt, steht das ausdrücklich da («nachzutragen») statt einer
glatten Formulierung, die darüber hinweggeht. Gespeist wird er aus derselben
Quelle wie die Auswertung — zwei Zahlen zum selben Beschluss wären schlimmer als
gar keine.

**Word und OpenDocument ohne Bibliothek** (`domain/docx.ts`, `domain/odt.ts`):
Beide Formate sind ein ZIP mit ein paar kleinen XML-Dateien, und den
ZIP-Schreiber gibt es hier seit dem Versandpaket. Eine Bibliothek dafür brächte
eine Abhängigkeit für hundert Zeilen und die Frage, was sie beim nächsten
Sicherheitsdurchgang mitbringt. Der Text trägt eine winzige Auszeichnung (`#`
Überschrift, `- ` Aufzählung, `| a | b |` Tabellenzeile), die im Textfeld lesbar
bleibt und sich in alle drei Ausgaben setzen lässt.

**Was die beiden zusammenhält, ist eine gemeinsame Zerlegung**
(`domain/protokollauszeichnung.ts`, 05.09.2026). Die Erkennung stand vorher
zweimal im Haus, in `docx.ts` und in `pdf/protokoll.ts`, letztere mit drei
Kommentaren «dieselbe Regel wie in `domain/docx.ts`». Ein Kommentar, der eine
Gleichheit behauptet, hält sie nicht, und mit dem dritten Erzeuger wäre daraus
die dritte Fassung geworden. Der **Zerleger** dagegen ist bewusst nur für die
beiden Bürodokumente: Das PDF behält jede Leerzeile und rückt drei Millimeter
ab, während Word und OpenDocument überflüssige Leerzeilen wegwerfen, weil dort
die Vorlagen den Abstand tragen. Ihn allen dreien zu geben wäre der
naheliegende, aber falsche Schritt gewesen — er hätte den Satzspiegel des PDF
verändert, ohne dass es im Auftrag stünde.

**Und alle drei tragen denselben Vermerk auf jedem Blatt**
(`protokollfusszeile`, `abendfusszeile`): Gemeinschaft, Versammlung, Stand,
Seitenzahl. Das PDF hatte ihn seit je, die Bürodokumente erst seit dem
05.09.2026 — bis dahin liess sich die dritte Seite eines ausgedruckten
Word-Protokolls keiner Fassung mehr zuordnen. Die Seitenzahl ist dort ein
**Feld** (`PAGE`/`NUMPAGES` bzw. `text:page-count`), keine Zahl: Wie viele
Seiten das Dokument hat, weiss erst die Textverarbeitung nach dem Umbruch.

**Laufend gesichert, mit Netz darunter** (FR-46: «weil ein verlorener Text in
der Sitzung nicht rekonstruierbar ist»). `SicherndesFeld.svelte` sichert nach
kurzem Innehalten, beim Verlassen des Feldes und beim Verlassen der Seite —
Letzteres über `sendBeacon`, weil ein gewöhnlicher Aufruf beim Entladen
abgebrochen wird. Vor jedem Versuch liegt der Text im `localStorage`; bricht das
WLAN weg, wird er beim nächsten Öffnen **zum Zurückholen angeboten** statt
stillschweigend eingesetzt — ein Text, der sich von selbst durch einen älteren
ersetzt, wäre schlimmer als der Verlust, weil ihn niemand bemerkt.

Dasselbe Feld steht an zwei Stellen (Sitzungsleitung und Protokollseite), also
schickt jeder Sicherungsvorgang den zuletzt bekannten Stand mit. Weicht er vom
gespeicherten ab, antwortet der Server mit **409 und dem fremden Text** statt zu
überschreiben. Ohne JavaScript bleibt der Knopf, wie er war.

**Das Protokoll ist als einziges Dokument frei änderbar** und ausdrücklich nicht
Teil des Siegels (PRD §4.11): Es entsteht nach der Sitzung, wird redigiert und
von der nächsten Versammlung genehmigt. Deshalb trägt `minutes` **kein**
Änderungsverbot — `minutes_version` dagegen schon: Eine als versandt
festgehaltene Fassung muss unverändert bleiben, sonst wäre sie nicht mehr die
versandte.

## Zwei Rollen der Benutzer

`admin` führt die Stammdaten, `chair` führt Versammlungen. Die Grenze läuft
zwischen Stammdaten und Versammlung, nicht zwischen Lesen und Schreiben: Aus
den Einheiten, Wertquoten und Eigentümern errechnet sich die Stimmkraft — wer
sie ändert, ändert das Ergebnis jeder künftigen Abstimmung. Ansehen darf sie
auch die Sitzungsleitung, denn ohne Stimmberechtigtenstand liesse sich keine
Beschlussfähigkeit feststellen.

Geprüft wird an **einer** Stelle: dem Wächter in `hooks.server.ts`, gegen die
Pfadtabelle in `src/lib/domain/rollen.ts`. Jede Änderung geht durch eine Route,
also lässt sich der Wächter nicht vergessen; eine neue Unterseite unter
`/gemeinschaften` ist von selbst geschützt. Eine Prüfung je Serverfunktion wäre
feiner und beim nächsten neuen Aufruf übersehen.

**Zwei Ausnahmen unter `/gemeinschaften`:** das Ansetzen einer Versammlung und
die Seite `…/lesarten` (Migration 169). Dort darf die Sitzungsleitung die
Lesarten umstellen, wenn die Gemeinschaft es erlaubt. Ob sie es erlaubt, prüft
der Schreibweg `speichereLesarten` selbst, in derselben Transaktion; der Pfad
öffnet nur die Seite, ohne Unterseiten. Ihre zweite Aktion zieht veraltete
Erfordernisse nach, was die Sitzungsleitung je Traktandum ohnehin darf; ein
Wächter hält fest, dass es bei diesen zwei Aktionen bleibt. Wer umstellen darf und die
Universalversammlung stehen auf der Reglementsseite und bleiben der Verwaltung.

**Bis zum 04.08.2026 prüfte sie niemand.** Die Rollen standen seit dem ersten
Tag in der Datenbank, wurden im Verlauf mitgeführt — und nirgends gelesen. Wer
ein Konto hatte, konnte Wertquoten ändern. Bei genau einem Konto fällt das nicht
auf; beim zweiten fällt es auf, und dann ist es zu spät. Die Lehre steht auch im
Test: `tests/domain/rollen.test.ts` prüft die Tabelle, `e2e/rollen.mjs` die
Verdrahtung — ein Test der Tabelle allein hätte damals grün geleuchtet.

## Zwei Rollen in der Datenbank

Das ist keine Feinheit, sondern trägt zwei Invarianten:

| Rolle | Zweck |
|---|---|
| `versammlung` | Migrationen. Eigentümerin der Tabellen, umgeht den Zeilenschutz. |
| `versammlung_app` | Die Anwendung. Unterliegt dem Zeilenschutz, darf auf dem Verlauf weder ändern noch löschen. |

Liefe die Anwendung als Superuser, wären Zeilenschutz und Schreibschutz zwar
eingerichtet, aber wirkungslos — Superuser umgehen den Zeilenschutz immer, auch
bei `FORCE ROW LEVEL SECURITY`. Ein Test, der als Superuser läuft, würde das nie
zeigen.

Nachgewiesen am 30.07.2026 gegen PostgreSQL 18.4: Einfügen ohne Mandantenkontext
wird abgewiesen, Ändern und Löschen des Verlaufs ebenso, ein fremder
Mandantenkontext sieht keine Datensätze.

### Der Zeilenschutz endet am Betreiber, nicht an der Gemeinschaft

Genau das war am 26.08.2026 der Befund einer Sicherheitsprüfung. `party`,
`unit`, `representation`, `usufruct` und `bylaw_quorum_rule` hängen über
`operator_id` am Zeilenschutz — **nicht** an der Gemeinschaft. Elf Aktionen auf
vier Seiten unter `gemeinschaften/[id=kennung]/` nahmen eine Kennung aus einem
verborgenen Feld entgegen und prüften nicht nach, ob sie zu der Gemeinschaft
gehört, deren Adresse in der Zeile steht. Wer zwei Gemeinschaften verwaltet,
traf mit der Kennung aus der einen die Aktion der anderen — Berichtigen,
Tilgen, Zuordnen, eine Reglementsregel aufheben.

**Kein Rechtegewinn**: Die Rolle `admin` ist betreiberweit, und die
Mandantengrenze hielt. Es fehlte eine **Zusicherung** — dass ein Knopf nur
trifft, was auf der Seite steht, von der er ausgelöst wurde. Ein Loch, das
nichts aufreisst, fällt niemandem auf; deshalb steht dahinter jetzt ein Wächter
und nicht bloss ein Vorsatz.

`$lib/server/zugehoerigkeit.ts` beantwortet die Frage je Art in der Tabelle, in
der die Kennung wirklich lebt. Eine einzige Funktion, die überall die
Parteitabelle befragte, hätte für eine Einheit, eine Vertretung oder eine
Nutzniessung immer «gehört nicht dazu» gemeldet und einen gültigen Weg gesperrt.

Für die **Person** gibt es die Frage nicht: `person` trägt keine `stweg_id` —
eine Person hat in jeder Gemeinschaft eine Zeile und gehört keiner. Wo eine
Aktion an der Person **derselben Zeile** schreibt (die Bemerkung im Formular
«Angaben berichtigen»), bindet `pruefePersonAnZeile` sie an die geprüfte Zeile.
Auch das war ein Befund, eine Schicht tiefer.

`scripts/check-kennungen.mjs` hält die Klasse geschlossen;
`tests/db/kennungspruefung.test.ts` misst je Aktion beide Hälften — die fremde
Kennung wird abgewiesen und lässt den fremden Bestand unverändert, die eigene
geht durch. Ohne die zweite Hälfte wüsste man nicht, ob bloss alles gesperrt
wurde.

**Die anderen Bäume stellen dieselbe Frage gegen eine andere Adresse**, und
jeder hat inzwischen seinen eigenen Wächter:

- Unter `versammlungen/` steht die Versammlung im Pfad, und die Bindung sitzt
  nicht in der Route, sondern im Kern (`leseEines(tx, meetingId, id)` mit
  `AND meeting_id = …`). Dafür steht `scripts/check-kernbindung.mjs` eine Stufe
  tiefer.
- Unter `tage/` trägt die Adresse einen **Abend**, an dem mehrere Häuser
  gleichzeitig tagen; die Versammlung kommt deshalb mit Absicht aus dem
  Formular. `scripts/check-abendbindung.mjs` verlangt je Aktion ein
  `hausDesAbends(…, params.id, …)` oder eine begründete Ausnahme. Gefunden am
  08.09.2026 bei seinem ersten Lauf: `freigeben/eine` und `haeuser/loesen`
  nahmen den Abend gar nicht erst entgegen — die Seite des einen Abends gab
  eine Versammlung des anderen frei und löste sie heraus. Dazu stand dieselbe
  Prüfung als **drei** lokale Abschriften da, die schon auseinandergelaufen
  waren; sie steht jetzt einmal in `src/lib/server/versammlungstag.ts`.
- `personen/` hat die Frage nicht: Eine Person gehört keiner Gemeinschaft (siehe
  oben).

Den Zerleger, den `check-kennungen` und `check-abendbindung` gemeinsam
benutzen, gibt es nur einmal: `scripts/lib/serveraktionen.mjs`. Dieselbe
Textzerlegung zweimal abzuschreiben hiesse, ihre Fehler zweimal zu machen — von
den fünf, die dort im Kommentar stehen, hat jeden einzelnen ein Review
gefunden, keiner ist beim Bauen aufgefallen.

## Anmeldung

Lokales Konto mit Argon2id, Sitzungsmerkmal nur als Prüfwert gespeichert. Nach
fünf Fehlversuchen innerhalb einer Viertelstunde wird gestaffelt gesperrt (30 s
bis höchstens 5 min) — bewusst nicht länger, weil eine Sperre von Stunden im
Versammlungsraum den Sitzungsleiter aussperren und damit die Versammlung
anhalten würde.

Die Anmeldung unterscheidet nie zwischen unbekanntem Benutzer und falschem
Kennwort, und rechnet auch bei unbekanntem Benutzer eine Argon2-Ableitung, damit
die Antwortzeit nichts verrät.

**Zum Zeilenschutz und der Anmeldung:** `app_user` unterliegt der Trennung nach
Betreiber — beim Anmelden ist der Betreiber aber noch unbekannt, er steht ja erst
im gesuchten Datensatz. Gelöst über zwei eng umrissene Funktionen mit
`SECURITY DEFINER` (Migration 003), die genau ein Merkmal entgegennehmen und
genau die Anmeldefelder liefern. Die Alternative wäre gewesen, die Anwendung mit
`BYPASSRLS` zu betreiben — das hätte die Trennung überall aufgehoben.

Authentik kommt in Epic 4 als zusätzlicher Weg dazu, nie als Voraussetzung: Im
Versammlungsraum ohne Internet ist die lokale Anmeldung der Regelfall.

## Betriebsarten

Dasselbe Abbild läuft auf dem Server und auf einem Notebook im Versammlungsraum
mit eigenem WLAN. Der Betriebszustand wird **gefragt, nicht gelesen**: Er ergibt
sich aus der Erreichbarkeit der äusseren Dienste und nicht aus einer
Umgebungsvariablen. Ein Schalter sagte, was jemand gemeint hat, als er ihn
setzte — nicht, was gerade gilt.

Drei Zustände statt zwei, weil «offline» zwei Sachverhalte zusammenwirft:

| Zustand | Bedeutung | Anzeige |
|---|---|---|
| **eigenständig** | Kein äusserer Dienst eingerichtet | keine, alles läuft bestimmungsgemäss |
| **verbunden** | Alle eingerichteten Dienste antworten | keine |
| **getrennt** | Ein eingerichteter Dienst antwortet nicht | Band über jeder Seite |

Nur die Störung wird angezeigt, und sie nennt, was **ohne** den Dienst trotzdem
geht — sonst legte jemand mitten in der Versammlung los, das Netz zu reparieren.
Eine Meldung, die jeden Tag dasteht, wird nicht mehr gelesen; deshalb bekommt der
Alleinbetrieb keine.

`VERSAMMLUNG_OFFLINE` bleibt bestehen, kennzeichnet aber nur noch die **Zeitquelle
im Verlauf**: Eine Uhr ohne Netzabgleich kann falsch gehen, und im Streitfall muss
das erkennbar sein.

## Übersicht und Vorbereitung

Die Startseite zeigt nach dem Anmelden, was läuft, was ansteht und was offen ist.
Ein offener Punkt nennt die Sache und nicht den Zustand: «Versammlung
unvollständig» zwänge zum Suchen, und genau das soll die Übersicht ersparen. Zwei
Stufen, weil der Unterschied im Betrieb zählt — ein **Hindernis** macht etwas
falsch, ohne dass es auffällt (ein nicht aufgehender Wertquotensaldo lässt jede
Auszählung eine Mehrheit ausrechnen, nur die falsche), eine **Aufgabe** ist bloss
noch nicht erledigt.

Die Liste `/versammlungen` führt **einzelne und gemeinsame Versammlungen zusammen** —
zwei getrennte Ansichten hiessen, an zwei Stellen nachzusehen, ob heute etwas
läuft. Geordnet wird nicht nach Zustand, sondern nach dem, was zu tun ist: «Läuft
jetzt», «In Vorbereitung», «Nachzuarbeiten», «Abgeschlossen». Der Unterschied
zählt bei **geschlossen** — das klingt nach erledigt und heisst, dass Protokoll
und Siegel noch fehlen; zwischen den versiegelten Zeilen fiele diese Arbeit nicht
auf. Eine gemeinsame steht als eine Zeile mit ihren Teilnehmerinnen darunter und liegt
im Fach der dringlichsten: Läuft eine von sieben, gehört das Ganze nach
oben. Suche (Gemeinschaft, Ort, Datum in allen drei Schreibweisen) und
Zustandsfilter arbeiten im Gerät, weil der Bestand schon dort liegt; die
Einteilung selbst steht als reine Funktion im Kern und ist geprüft, nicht
durchgeklickt (`domain/versammlungsliste.ts`).

Angelegt wird beides unter `/versammlungen/neu`, und die erste Frage ist die,
die sich wirklich stellt: eine Gemeinschaft oder mehrere zusammen? `/tage`,
`/tage/neu` und `/gemeinschaften/<id>/versammlungen/neu` leiten dorthin.

**Beide Wege sind seit dem 11.08.2026 derselbe.** Vorher führte der einzelne Fall
nach der Auswahl auf eine zweite Seite mit einem **zweiten** Anlegeformular und
zeigte drei Schritte, der gemeinsame blieb auf einer Seite und zeigte zwei —
zwei Formulare für dieselbe Sache, von denen eines zuverlässig hinterherlief.
Jetzt fragt das Anlegen nur: **wer tagt, wann, wo — und was für eine
Versammlung.** Der Unterschied schrumpft auf eine Zeile — Auswahlknopf oder
Ankreuzfeld. Die **Art** (ordentlich oder ausserordentlich, mit Anlass) gehört
dazu, weil sie für den ganzen Anlass gilt: Bei sechs angekreuzten Gemeinschaften
sie hinterher sechsmal umzustellen, war die häufigste unnötige Arbeit. Was
darüber hinaus eine Versammlung ausmacht (Erst- oder Zweitversammlung,
Abstimmungsweise, Vorgängerin), steht danach auf ihrer eigenen Seite.

**Und die Felder sehen überall gleich aus.** Tag, Beginn und Ort lagen in einem
eigenen Kasten innerhalb der Feldreihe — dadurch griff die Rasterregel
`.felder > label` nicht mehr, und ihre Beschriftungen standen inline, während
«Bezeichnung» und «Bemerkung» daneben gestapelt waren: zwei Feldarten auf einer
Seite (gemeldet am 11.08.2026). Die Wahlblöcke stehen seither in `app.css` statt
in einer einzelnen Komponente, damit die nächste Seite sie nicht neu erfindet.

**Die Versammlungsseite ist entweder ein Formular oder eine Übersicht, nie
beides.** Im Entwurf wird erfasst, also führt das Formular — mit den drei
Wahlblöcken nebeneinander statt als 1400 Pixel hoher Turm. Ab der Freigabe ist
nichts mehr zu erfassen, und Karten antworten: je eine Frage, je ein Satz, gleich
hoch. Vorher stand «Betriebsart» als Karte oben **und** als Auswahl im Formular
unten, mit zwei verschiedenen Knöpfen für dieselbe Sache. Die Sätze selbst stehen
im Kern (`domain/klartext.ts`) und sind geprüft — Antwort höchstens 60 Zeichen,
kein Paragraph darin, Fachbegriff in Klammern dahinter («Das erste Treffen
(Erstversammlung)»). Das Muster ist in [`docs/gestaltung.md`](gestaltung.md)
beschrieben und für die übrigen Seiten gedacht.

Gespeichert wird mit **einem** Knopf: Angaben, Zuordnung zu einer gemeinsamen
Versammlung und eine Datei gehören über das HTML-Attribut `form` zum selben
Formular. Die Zuordnung schreibt nur bei echter Änderung — ohne den Vergleich mit
dem mitgeführten `tagVorher` stünde nach jedem Speichern ein «gelöst» im Verlauf,
das niemand ausgelöst hat.

**Und nichts geht still verloren.** Ein Klick auf «Als Nächstes» genügte, um
eine ungespeicherte Eingabe zu verlieren — ohne Dialog, ohne Meldung, ohne Spur;
gemessen am 11.08.2026. `Ungespeichert.svelte` wacht jetzt darüber und fragt vor
dem Verlassen. **Automatisch gespeichert wird bewusst nicht:** Jede Änderung
schreibt einen Verlaufseintrag, und bei jedem Tastendruck zu speichern zerstörte
den Verlauf als Beleg; dazu sind Ort und Datum Pflichtfelder, ein Zwischenstand
ohne Ort ist keine gültige Versammlung, und «Abbrechen» verlöre seinen Sinn.

**Die gemeinsame Versammlung nimmt ihre Gemeinschaften gleich mit.** Bis zum
11.08.2026 entstand sie leer, und jede Versammlung war einzeln anzulegen und
einzeln zuzuordnen — bei sieben Häusern fünfzehn Formulare für einen Vorgang, den
man als einen erlebt. Wer die Gemeinschaften auf `/versammlungen/neu` ankreuzt,
bekommt für jede eine Versammlung mit Tag und Ort. Geprüft wird **vorher**:
Besteht für eine davon an diesem Tag schon eine **Erst**versammlung, wird
abgewiesen und nichts angelegt — es gibt keine Klammer über die einzelnen
Schreibvorgänge, und ein halbes Ergebnis wäre schlimmer als keines.

**Und sie sieht aus wie eine einzelne.** `/tage/<id>` hatte keine Seitenleiste,
vier `h2`-Abschnitte untereinander, neun Knöpfe und eine Tabelle mit sieben
Spalten; «Einlass» stand mitten in der Vorbereitung und antwortete auf jeden
Klick «nicht möglich — die Versammlung läuft dort nicht». Jetzt trägt sie
denselben Rahmen wie eine einzelne Versammlung: links der Ablauf mit Fortschritt
(`domain/gemeinsamerablauf.ts`), rechts je Schritt eine Seite mit einer Frage —
Angaben, Wer tagt mit, Stammdaten je Gemeinschaft (ein **Register je Haus**),
Gemeinsame Geschäfte, Anwesenheit und Beschlussfähigkeit, Tafel. Die **Tafel**
steht sichtbar gesperrt, solange keine Versammlung läuft; die **Anwesenheit**
öffnet mit der ersten Freigabe, denn dort wird eröffnet — für alle Häuser auf
einmal oder einzeln. Sie heisst seit dem 24.08.2026 wie der gleichnamige Schritt
einer einzelnen Versammlung und kann dasselbe; Einzelheiten in
[docs/verbund.md](verbund.md).

**Die Traktandenliste gilt für den ganzen Abend.** Eine Sitzung, eine Liste, ein
Protokoll: Die Nummer, unter der im Saal aufgerufen wird, steht so im Protokoll
der Gemeinschaft. Was jede Gemeinschaft an Pflichttraktanden mitbringt, wird beim
Zuordnen **eingesammelt** — aus sechsmal «Begrüssung» wird der Punkt «1» in allen
sechs Häusern. **Ab zwei Gemeinschaften trägt jedes Haus eine eigene Ziffer**
(«9 Budget 2027» mit «9.1 Nirgendweg 3», «9.2 Nirgendweg 5/5a»): Beschlossen
wird in jedem Haus einzeln, und was einzeln beschlossen wird, muss einzeln
angekündigt sein. Über den Sammelpunkt wird nicht abgestimmt. Damit die Liste
lesbar bleibt, stehen die Ziffern zugeklappt und klappen auf, sobald ein Haus
einen eigenen Wortlaut trägt. Das Mehrheitserfordernis wird beim Erfassen
gewählt, aber **je Gemeinschaft** hergeleitet — eine Reglementsabweichung gilt
für ein Haus. Auf Ebene Gemeinschaft ist die Liste ein **Abbild**: Der Wortlaut
lässt sich dort anpassen, Aufnehmen, Umordnen und Entfernen gehören an den Abend.
Alle bekommen zuerst denselben Inhalt und lassen sich danach einzeln anpassen —
wo das geschehen ist, steht «angepasst». Umgeordnet wird mit dem Griff; die
Nummern ziehen sofort nach, auch in den einzelnen Versammlungen — **bis zur
Freigabe**: Ab da steht die Nummer fest, und nur die Reihenfolge zieht noch mit
(Migration 072). Gerechnet wird im Kern (`domain/gemeinsameliste.ts`).

Dazu der Abschnitt **Ausgeben** mit dem Schritt **Freigeben**: alle mittagenden
Versammlungen nebeneinander, je eine Karte mit «Bereit.» oder dem, was fehlt, und
ein Knopf, der alle bereiten nacheinander freigibt. Er fehlte ganz — der einzelne
Ablauf hat diesen Abschnitt seit je.

**Einmal ändern statt sechsmal.** Tag, Beginn, Ort und Art gehören zum Anlass,
nicht zum einzelnen Haus. Auf der Seite **Angaben** steht ein vorangekreuztes
Häkchen, das sie auf alle mittagenden Versammlungen umlegt; es sagt vorher, wie
viele abweichen, und nachher, was übernommen wurde — und was nicht. Eine
freigegebene Versammlung bleibt stehen und wird beim Namen genannt: Ihr Tag steht
in versandten Einladungen. Gerechnet wird im Kern (`domain/umlegen.ts`),
geschrieben über `bearbeiteVersammlung`, damit Zustandsprüfung, Frist und
Verlaufseintrag greifen.

**Lösen lässt sich rückgängig machen.** «Aus der Versammlung lösen» hebt nur die
Zuordnung auf; neben der Meldung steht **Rückgängig**, samt der alten Stelle im
Ablauf — ohne sie käme die Versammlung ans Ende der Reihe zurück, und die
Reihenfolge des Saals wäre von Hand zu richten. Die gelöste Versammlung steht
sofort wieder in der Auswahlliste und lässt sich zurückholen; dafür ist keine
neue anzulegen.

**Und wer sie nicht mehr braucht, löscht sie** — auf ihrer Seite, ganz unten, und
nur im **Entwurf**. Die Rückfrage kommt vom Server und zählt auf, was
verschwindet; gelöscht wird über eine Datenbankfunktion (Migration 058), denn die
Anwendungsrolle darf `meeting` weiterhin nicht löschen. Ab der Freigabe geht es
nicht mehr, und eine Versammlung, auf die eine Zweitversammlung als Vorgängerin
verweist, bleibt ebenfalls stehen — an dieser Angabe hängt die Zehntagesfrist.
Der Verlaufseintrag bleibt in jedem Fall.

**Und die Schranke der Datenbank fällt nicht mehr als 500er auf den Benutzer.**
`meeting_tag_je_gemeinschaft` (Migration 028) lässt je Gemeinschaft eine
Versammlung je gemeinsamer zu — beim Aufnehmen einer zweiten kam «duplicate key
value violates unique constraint». Jetzt prüft `domain/zuordnung.ts` vorher und
sagt, welche im Weg steht und wie man sie loswird. Nachgefragt wird dort, wo
vorher **still** etwas geschah: Eine Versammlung, die schon zu einer anderen
gemeinsamen gehört, wird beim Aufnehmen aus dieser herausgenommen — die
Auswahlliste sagt es («tagt schon woanders mit»), und eine Rückfrage steht davor.

**Der Verlauf filtert in der Datenbank**, nicht im Gerät — anders als die
übrigen Listen, und zwar notwendig: Er kommt seitenweise (fünfzig Zeilen), ein
Filter im Browser durchsuchte nur die geladene Seite und meldete «nichts
gefunden», während der Treffer auf Seite vier steht. Das wäre schlimmer als gar
keine Suche, weil das Ergebnis wie eine Auskunft aussieht. Vier Angaben:
Volltext über Person, Kennung und Angaben; **Bereich** (der Namensteil vor dem
ersten Punkt — 97 Ereignisarten sind als Auswahlliste kein Filter, sondern eine
zweite Suche), jeweils mit der Zahl der Einträge; Zeitraum von–bis, in
**Schweizer** Zeit gerechnet (ein Vergleich in UTC verlöre die erste Stunde
jedes Tages). Der Stand steht in der Adresse und wird beim Blättern
mitgetragen — vorher nahmen «Neuere» und «Ältere» nur die Ereignisart mit, und
wer den Verlauf einer einzelnen Versammlung durchblätterte, stand nach dem
ersten Klick im Gesamtverlauf, ohne dass es auffiel.

Je Versammlung führt `/versammlungen/<id>/vorbereitung` durch fünfzehn Schritte
von den Einheiten bis zum Protokoll. **Reglement und Beschlussfähigkeit stehen
seit dem 10.08.2026 darin** — sichtbar, aber ohne Sperre: Die Freigabe verlangt
weiterhin nur, was sie immer verlangt hat (ein Traktandum, ein aufgehender
Wertquotensaldo). Es geht darum, dass niemand die Frage übersieht. Abgehakt wird
am **Prüfvermerk** der Gemeinschaft, nicht an der Zahl hinterlegter
Abweichungen: «keine Abweichung» und «noch nie nachgesehen» sind im Bestand
beides null Regeln, und ein Schritt, der erst mit einer Abweichung abhakt,
bliebe bei jeder gesetzestreuen Gemeinschaft für immer offen.

Angelegt wird über eine kurze Kette — Art, Gemeinschaft, Eckdaten —, und danach
führt der Weg unmittelbar in diese Vorbereitung. Das Anlegeformular trägt seit
demselben Tag **nicht mehr die Seitenleiste der Gemeinschaft** (`+page@.svelte`
setzt das Layout zurück): Wer eine Versammlung anlegt, steht in einem Vorgang
und nicht in den Stammdaten — der aktive Punkt sass vorher unten in der dritten
Gruppe einer Leiste, die von etwas anderem handelte.

Gesperrte Schritte bleiben **sichtbar** und
nennen, was sie freischaltet — wer nur sieht, was gerade geht, kann den Ablauf
nicht planen. Gesperrt ist allein, was sachlich nicht geht: Traktanden lassen
sich erfassen, bevor der letzte Eigentümer eingetragen ist. Der Fortschritt zählt
nur die möglichen Schritte, sonst klebte die Anzeige am Anfang jeder Versammlung
bei einem Drittel, obwohl gerade viel geschieht.

## Das Regelwerk

Der Entscheidbaum liegt unter `src/lib/rules/` als Datendatei mit einer
Fassungskennung. Eine Gesetzesrevision erzeugt eine **neue** Datei; die
bestehende bleibt unverändert, damit ein danach gefasster Beschluss erklärbar
bleibt. Der Kern kennt nur die Gestalt des Regelwerks, nicht seinen Inhalt
(AD-4).

`pruefeRegelwerk` prüft jede Fassung auf innere Stimmigkeit — Ziele ins Leere,
doppelte Kennungen, Kreise, unerreichbare Knoten. Eine Datendatei hat keinen
Übersetzer, der auf einen Tippfehler in einer Zielkennung hinweist; ohne diese
Prüfung endet ein Pfad im Nichts, und zwar erst dann, wenn ihn jemand im Saal
beschreitet. Zu jeder Prüfregel steht die Gegenprobe im Test.

Das Merkmal `juristischGegengelesen` bleibt `false`, denn gegengelesen hat
niemand. Seit Entscheid 0052 (16.11.2026, Fassung 2026-11-19) steuert es keine
Anzeige mehr: Jedes Ergebnis nennt sich einen Vorschlag an die Sitzungsleitung,
ohne den früheren Satz «Noch nicht juristisch gegengelesen».

**Eine Fassung nur für Wortlaut** gibt es auch: 2026-11-11 (Kasten «Reglement»)
und 2026-11-15 (Auftrag «Texte nach 0047»: Beratung der Angehörigen an der
Prozessführung, Beleg ohne Rz. 84 ad Art. 712g, Hinweis zum Reglement an der
Ausschlussklage «nicht geklärt» wie im Katalog, «Wortlaut und Rechtsprechung»
mit Rz. 186 ad Art. 712m, der Gegenmeinung «nur die Abstimmenden» und den
Enthaltungen nach herrschender Lehre) und 2026-11-17 (die Sätze, die der
Website-Abzug seit `5239aea5` eigens berichtigt: der sichere Weg bei den
Köpfen, das Bundesgericht an Art. 647c, die Wahl mit erweiterten Befugnissen,
der Grenzfall der Nutzung; Gründe für das, was nur auf der Website steht, in
`quorum-2026-11-17.ts`) und 2026-11-19 (der Widerruf einer Übertragung an den
zwei Wahlkarten der Bewirtschaftung, der Freigabevermerk ohne ausstehende
Gegenlesung; Entscheid 0052). Sie
ändern kein Erfordernis und brauchen keine Migration. **Eine Fassung, die die
Rechnung ändert**, ohne neue Karten: 2026-10-25 (Angehörige im Ausstand an der
Ausschlussklage), 2026-11-16 (Ausstand unter einer von Hand gesetzten
Kopfbasis «aller Eigentümer», Entscheid 0050, Antwort 1) und 2026-11-21 (das
Häkchen «Begründungsakt oder Zustimmung aller» an einer Regel zur Bezahlung aus dem
Fonds, Migration 197, Entscheid 0057, siehe L17). Ihre Karten sind die
der Vorfassung; die Rechnung hängt an der Fassungskennung
(`AUSSTAND_IN_DER_ZAHL_AB`, `AUSSTAND_BEI_GEWAEHLTER_BASIS_AB`,
`FONDSREGEL_HAEKCHEN_AB`). 2026-11-21 ändert dazu Wortlaut: den Widerruf im
Wortlaut der Website mit dem offenen Fall aus dem Begründungsakt und der Antwort im
Baum, die Rücknahme vor der Wahl an der zweiten Wahlkarte, die luxuriöse Arbeit an
der vereinbarten Verwendung und an `k-reglement-quoren` die Wartezeit nach der Frist
im Wortlaut der Website (Teil 1 des Auftrags `2026-11-17-votum-pendenzen-folge`).
Den Wortlaut der Website zur Wartezeit setzt der Abzug selbst nach dem Text ein,
nicht an den Konstanten (`mitWartezeit` in `scripts/quorumsbaum-export.mjs`): an der
Stelle, die auf der Karte zuoberst steht, den Kernsatz, an weiteren die Kurzform, mit
einer Probe der Zahl je Karte. 2026-11-16
ändert dazu Wortlaut: die allgemeine Erklärung zum Wortlaut (`ZAEHLUNG_ANWESENDE`,
T4) und den Freigabevermerk (`FREIGABEVERMERK_ZUSATZ`, T7d; Textrunde zu den
Pendenzen nach Regel 43). Sätze im Kern
(Protokoll, PDFs, Katalog, Masken) gelten dagegen ohne Fassung sofort, auch für
alte Versammlungen; der Satz zum zweiten Ergebnis im Hausprotokoll bleibt mit
der Festschreibung des Durchgangs stehen (`protokollhinweise`), PDFs und
Abenddokument bilden ihn bei jedem Aufruf neu.

### Die Bezugsgrösse ist ein eigenes Merkmal

Der gewichtigste Befund der Prüfung vom 30.07.2026. Wer die Bezugsgrösse aus dem
Ergebnistyp ableitet, rechnet bei ZGB Art. 649b Abs. 2 auf den Erschienenen statt
auf allen übrigen Eigentümern und stellt einen Beschluss fest, den es nicht gibt.
Deshalb trägt jeder Knoten seine Kopf- und seine Quotenbasis selbst, getrennt
voneinander, und der Satz zur Wirkung von Enthaltung und Nichtabgabe entsteht aus
der Bezugsgrösse des Knotens plus der Wirkung des Typs.

### Lesarten der Gemeinschaft

Wo das Gesetz zwei vertretene Auslegungen zulässt und das Ergebnis im Saal davon
abhängt, wählt die Gemeinschaft, nach welcher Votum rechnet (Entscheid 0018).
Eine Lesart ist keine Angabe aus dem Reglement: Legt dort eine Regel das Mehr
fest, geht sie vor, und eine Lesart zum Mehr (L2, L4, L9, L11) fällt weg. An L17 ist es
umgekehrt: Die Lesart entscheidet, welche Regel überhaupt gilt (unten). An L6 greift
keine Regel: Die Karte der eigenen Schranke sperrt sie (`gesperrt_reglement`).
L6 wirkt auch nur dort; eine strengere Regel an «Reglement ändern, gewöhnliche
Bestimmung» rechnet unabhängig von L6 weiter (Entscheid 0042). Zwei Arten:
**L2, L4, L6, L9, L11, L12 und L17 tauschen das Erfordernis**, beim Herleiten (L12 und
L9 nicht das Mehr, sondern die Kopfbasis: an der luxuriösen baulichen Massnahme
zählt Votum nach der Vorgabe über alle eingetragenen Eigentümer, unter «Alle
Anwesenden und Vertretenen» über die Anwesenden und Vertretenen, und nach der
Vorgabe ändert sich kein Ergebnis; Migration 187, Entscheid 0044, R5 a. An der
Ermächtigung zur Ausschlussklage zählt es nach der Vorgabe über alle Eigentümer
ohne den Beklagten, unter «Anwesende und Vertretene ohne den Beklagten» über die
Anwesenden und Vertretenen ohne ihn, und nach der Vorgabe ändert sich kein
Ergebnis; Migration 188, Entscheid 0044, zweiter Nachtrag, R1 a);
**L1 und L3 ändern die
Zählung** (L1, wer im Nenner aller Wertquoten steht; L3, ob an der Einsprache je
Eigentümer oder je Einheit gezählt wird) und gelten auch unter einer Regel des
Reglements. **L10 ändert die Zählung an der Ermächtigung zur Ausschlussklage**
(Migration 189, Entscheid 0044, zweiter Nachtrag, R1 b): ob Angehörige des
Beklagten im Ausstand in der Zahl bleiben, an der die Mehrheit gemessen wird.
Unter einer hinterlegten Regel wirkt sie nicht, weil die Regel ihre eigene
Vorschrift trägt. **L5 sperrt** statt zu rechnen: Sie entscheidet, ob über ein neues
Traktandum an der zweiten Versammlung verbindlich abgestimmt wird. **L7
wirkt an der Beschlussfähigkeit** (Migration 183, Entscheid 0043): Nach der
Vorgabe zählen die Personen im Ausstand mit, und Votum sagt es der Leitung und
im Protokoll, wo die Beschlussfähigkeit an ihnen hängt; unter «Zählt nicht mit»
sperrt das Eröffnen je Traktandum, ohne konsultativen Weg. Gerechnet in
`ausstandsbefund` (`domain/anwesenheit.ts`), am lebenden Stand über
`holeBeschlussfaehigkeitOhneAusstand`, im Protokoll aus dem eingefrorenen
`attendance_json`. **L8 wirkt an den Vollmachten der Verwaltung** (Migration
184, Entscheid 0045), an Traktanden mit dem Häkchen «Geschäft der Verwaltung»
(`agenda_item.concerns_management`, ab der Freigabe gesperrt) und an
Vollmachten mit dem Häkchen «Bevollmächtigt ist die Verwaltung»
(`proxy.holder_is_management`, je normalisiertem Namen, `vollmachtsschluessel`).
Nach der Vorgabe «Vollmachten ruhen» stehen die bestätigten Vollmachten dieses
Namens dort ohne Erklärung im Ausstand (`leseVerwaltungsausstandIn` in
`server/abstimmung.ts`, gelesen wie die Stimmsperre und beim Schliessen
eingefroren); unter «Die Sitzungsleitung entscheidet» zählen sie, und Votum
nennt das Ergebnis nach der Vorgabe dazu, bei Summen als Grenzen
(`mitAndererVerwaltungsvollmacht` in `domain/auszaehlung.ts`). Bei Wahl und
Wiederwahl der Verwaltung wirkt das Häkchen nicht (BGE 134 III 481 E. 3.8;
Absage im Entwurf, nach der Freigabe zählen die Vollmachten). Fällt das
Aufteilen erst nach der Freigabe auf, ist der Folgeantrag der Ausweg
(Entscheid 0045, Punkt 9): die Wahl als eigener Folgeantrag, an dem das
geerbte Häkchen nicht wirkt; Entschädigung, Entlastung oder Vertrag je als
Folgeantrag, an dem es wirkt; die Abberufung nimmt Votum nach der Freigabe nur
noch als Folgeantrag an, ohne Ruhen von selbst (die Leitung entscheidet über
den Ausstand). Ist ein Folgeantrag zur Wahl oder Abberufung entschieden, sperrt
Votum unter dem Häkchen die Abstimmung über den Grundantrag (`teil_entschieden`,
`pruefeDurchgangsfreigabe` in `domain/abstimmung.ts`). An einem anderen
Folgeantrag desselben Grundantrags kann die Leitung dann unter «ruhen» angeben, dass er eine
andere als die bisherige Verwaltung betrifft (nach angenommener Wahl) oder die
Kündigung des Vertrags (nach nicht angenommener Abberufung); dort ruht nichts
von selbst (Entscheid 0045, Punkt 11; Migration 185,
`agenda_item.management_exemption`, `domain/` und `server/verwaltungsangabe.ts`,
gelesen in `leseVerwaltungsausstandIn`, auch am Rückkommen). Im gemeinsamen
Abenddokument hat jeder Folgeantrag zu einem Traktandum der Einladung eine
eigene Zeile unter seiner Gemeinschaft, samt den Zeilen zu L8, und Tafel und Ablaufleiste zählen den gegenstandslosen oder
gesperrten Grundantrag nicht als offen. Die Kennzeichnung
einer bestätigten Vollmacht lässt sich nicht ändern, solange an einem
Traktandum mit Häkchen abgestimmt wird.

- **Katalog** in `src/lib/domain/lesarten.ts`: Frage, Wahlen mit Fundstelle,
  Vorgabe und warum. Welcher Knoten welche Lesart trägt, steht im Regelwerk
  (`lesart` am Knoten); der Knoten rechnet eine Wahl des Katalogs, welche,
  sagt sein Mehr (`wahlDesKnotens`), an der aktuellen Fassung die Vorgabe.
- **L2, L4, L6, L9, L11, L12 und L17: Wirkung am Erfordernis, beim Herleiten**, wie eine hinterlegte Regel:
  `wendeReglementAn` nimmt die Lesarten als Pflichtargument. So nennt die
  Einladung dasselbe Mehr, nach dem der Saal rechnet. Das Erfordernis trägt die
  angewandte Wahl und das Mehr der anderen (`gemeinschaftslesart`), damit sich
  das zweite Ergebnis ohne Regelwerk nachrechnen lässt; die Enthaltungen werden
  für beide Mehr je für sich behandelt.
- **Das Rückkommen übernimmt das Mehr, nicht die Lesart** (`erfordernisFuerRueckkommen`):
  kein zweites Ergebnis, mit einer Ausnahme unter L6: Hatte der Beschluss die
  Ja-Stimmen aller, besteht er nach beiden Lesarten, und Votum rechnet das
  Rückkommen auch nach dem anderen Mehr (`vergleichAmRueckkommen`, B2b, Fall b).
  Für den Satz der Leitung trägt es Kennung und Wahl des
  Beschlusses als `lesartDesBeschlusses` (Migration 181,
  `agenda_item.requirement_reading_reconsidered`); die Karte sagt daran die
  Lesart des Beschlusses (`rueckkommenKartensatz`), und `kopfbasisStreit` sagt
  unter der Klausel denselben Satz wie am Beschluss. Ein von Hand gesetztes Mehr und eine
  Reglementsregel, die das Mehr ersetzt, löschen es; eine Regel zum Rückkommen,
  die hinter dem Beschluss zurückbleibt, lässt es stehen.
- **Eingefroren bei der Freigabe** in `snapshot`; danach rechnet auch ein im
  Saal gesetztes Erfordernis nach der eingefrorenen Wahl, und der Durchgang
  friert sie mit dem Erfordernis ein. Die Freigabe sagt ab, solange ein
  Traktandum nach einer anderen Wahl rechnet; nachgezogen wird im Kasten der
  älteren Erfordernisse.
- **L1: Wirkung an der Zählung** (Migration 170). Das Erfordernis trägt die
  Wahl als `ausstandslesart`; gesetzt nicht von der Schreibstelle, sondern vom
  Auslöser `agenda_aa_lesart_l1_setzen` aus Momentaufnahme oder Gemeinschaft,
  und die Freigabe schreibt sie an allen Traktanden neu. Eine Absage wie bei L4
  gibt es nicht, weil L1 das Mehr der Einladung nicht ändert. Nach «fällt
  heraus» sinkt unter `alle_quoten` der Nenner um die Quoten im Ausstand
  (`ausstandsabzug`); eine Partei mit ruhender Vollmacht bleibt wie eine
  abwesende darin (Entscheid 0020). An der Ausschlussklage wirkt L1 nicht
  (Entscheid 0019).
- **L13: Wirkung an der Kopfbasis, ab Fassung 2026-11-14** (Migration 192,
  Entscheid 0048, Block C). Kein Knoten trägt sie; sie wirkt am gerechneten
  Erfordernis, wo die Rechtsgrundlage mit ZGB Art. 647a Abs. 2, 647b Abs. 1,
  647c oder 647e Abs. 2 beginnt, nicht an Art. 647d, nicht unter einer Regel des
  Reglements und nicht, wo Votum die Enthaltungsklausel anwendet
  (`kopfzaehlweiseWirkt`). Unter «Alle Eigentümer» setzt `wendeReglementAn` die
  Kopfbasis `alle_eigentuemer` (`mitKopfzaehlweise`, nach der Klausel), und
  wer im Ausstand ist, bleibt in der Zahl (`ausstandBleibtNachZaehlweise`).
  Welche Wahl ein Traktandum rechnet, sagt seine Kopfbasis; die Wahl steht
  daneben als `kopfzaehlweise` (`agenda_item.requirement_reading_l13`, vom
  Auslöser gesetzt). Das zweite Ergebnis nach L2, L4 oder L11 behält die
  Zählweise (`erfordernisNachAndererLesart`), das nach der Zählweise
  (`andereKopfzaehlweise`) die Wahl am Mehr; im Protokoll steht es immer, wie
  L1. Weil L13 das Mehr ändert, sagt die Freigabe ab wie bei L4, und der Kasten
  zeigt dasselbe Traktandum (`zaehlweiseVeraltet`). Die Ergebniskarte tauscht
  Kopfbasis, Formel und «Wortlaut und Rechtsprechung» (`knotenNachZaehlweise`,
  Fassung 4c).
- **L15: Wirkung an der Höchstzahl der Vollmachten** (Migration 194, Entscheid
  0054). Kein Knoten, kein Mehr, keine Fassung. Unter «mitzaehlen» zählt die
  Vertretung mit dem Grund `mitberechtigt` an allen drei Stellen der Regel
  (`zaehltZurHoechstzahl` mit `ueberschreitungen`, die frühe Rückkehr und die
  Abfrage über den Bestand in `verlangeVollmachtsgrenze`), Organ und gesetzlich
  nie; die Wahl kommt ab der Freigabe aus der Momentaufnahme. Eine Mitberechtigte,
  die nur mit der Karte der gemeinsamen Einheit kommt, ist die Partei selbst und
  hält keine Vollmacht dafür: Ihre erste Stimme bleibt frei.
- **L16: Wirkung an der Stufe der Folgeversammlung** (Migration 194, Entscheid
  0054 Punkte 3 und 7). Nur in `vertageVersammlung`: zeitweise beschlussfähig
  (`warZeitweiseBeschlussfaehigIn`), jetzt nicht mehr (`jetztBeschlussfaehig`,
  dieselbe Rechnung wie Leitung und Feststellung) und «zweite» gewählt ergibt
  eine zweite mit `meeting.tier_by_reading` (`zweiteNachLesart`). Einladung,
  Protokoll (Kopf und `l16Beschlusssatz` je angenommenem Beschluss), Siegel
  und Verlauf lesen das Merkmal, statt es neu herzuleiten; `aendereVersammlung`
  behält es nur an derselben zweiten auf dieselbe Vorgängerin.
- **L17: Wirkung an der Bezahlung aus dem Erneuerungsfonds, ab Fassung 2026-11-20**
  (Migration 196, Entscheid 0056). Am Knoten wie L6: `streng` rechnet im Zweck
  das qualifizierte Mehr und an der vereinbarten Verwendung die Zustimmung aller,
  `svit` an beiden das einfache Mehr nach Köpfen (`weitereMehr` an der Wahl, weil
  `streng` an zwei Karten verschiedenes Mehr verlangt). Dazu entscheidet die Wahl
  in `wendeReglementAn`, welche Regel gilt: unter `streng` jede, die nicht milder
  ist, auch eine für alle wichtigeren Verwaltungshandlungen; unter `svit` nur eine
  für genau diesen Fall, in beide Richtungen. Ist unter `streng` die fallgenaue
  Regel milder, rechnet Votum nach einer nicht milderen allgemeinen und nennt die
  fallgenaue (`Regelanwendung.verdraengt`). Die Freigabe sagt an diesen Karten auch
  unter einer Regel ab, wenn die Regel, nach der gerechnet wird, nicht mehr dieselbe
  ist (`l17Regelstand`): nach einer Umstellung von L17 ebenso wie nach einer
  geänderten, gelöschten oder neu dazugesetzten Regel, mit eigenem Satz
  (`FONDSENTNAHME_VERALTET`) und dem Weg auf die Reglementseite. Ihre Bedingung ist
  im Kasten «nachziehen» enthalten, nicht dieselbe: Der Kasten prüft alle
  Traktanden und das ganze Mehr. Unter einer Regel der Zustimmung aller zeigt
  `karteMitReglement` den Weg des Knotens, nicht den der anderen Lesart
  (`einstimmigkeitswegDesKnotens`; gilt auch für L6).
- **Das Häkchen «Begründungsakt oder Zustimmung aller», ab Fassung 2026-11-21**
  (Migration 197, `bylaw_quorum_rule.founding_or_unanimous`, Domäne `gesichert`;
  Entscheid 0057). Nur an `k-erneuerungsfonds-entnahme` und nur unter L17
  `streng`: Eine Regel mit Häkchen besteht `l17Regelvorbehalt`, ob milder oder
  strenger; eine fallgenaue mit Häkchen wird nicht gegen eine allgemeine
  getauscht, eine allgemeine mit Häkchen kommt auch milder als Ersatz in Frage.
  An einer angewandten Regel setzt `wendeReglementAn` den Satz `fondsregel`
  (H4 mit, H3 ohne Häkchen), den `karteMitReglement` vor `verdraengt` stellt;
  an einer milderen ohne Häkchen nennt die Karte den Weg `FONDSENTNAHME_WEG_HAEKCHEN`
  (Häkchen vor der Freigabe, Nachziehen, danach der bisherige Notweg). An der
  vereinbarten Verwendung wirkt es nicht (Rz. 138 ad Art. 712l, a.M. Bloch;
  Fachprüfung F-5), dort steht mit Häkchen `FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN`.
  Der Schalter ist die Fassung (`fondsregelHaekchenWirkt`, `FONDSREGEL_HAEKCHEN_AB`):
  Ein Traktandum der Fassung 2026-11-20 rechnet wie bisher, Sätze und Rechnung
  (AD-4); nachgezogen kommt es auf die geltende Fassung. Gespeichert wird das
  Häkchen nur, wo es wirken kann (`haekchenMoeglich`, dieselbe Bedingung zeigt das
  Feld auf der Reglementseite), der Verlauf nennt Vorzustand und neuen Wert in
  Worten. **Freigabe und Kasten:** Ändert das Häkchen das Mehr, ist das
  Traktandum veraltet; die Freigabe prüft dafür an den L17-Karten alle Traktanden,
  auch die nach dem Gesetz und die über die Karte gewählten (`veralteteLesartenIn`),
  der Kasten vergleicht ohnehin das ganze Mehr. Damit sagt sie dort auch ab, wenn
  ohne Häkchen eine Regel neu gilt, etwa eine strengere nach einem Traktandum nach
  dem Gesetz (Codeprüfung des Zweigs, N1, übernommen). Nach der Freigabe lässt
  der Kasten das Nachziehen bis zur Eröffnung zu, wie für jede Regel (Migration 144).
- **Das Häkchen ist eingefroren, wo es nur den Satz ändert, ab Migration 198**
  (`agenda_item.requirement_rule_secured`, Domäne `Erfordernis.regelGesichert`;
  Entscheid des Auftraggebers vom 18.11.2026, «Auch Häkchen einfrieren», Entscheid
  0057). `wendeReglementAn` schreibt es ans Erfordernis an einer angewandten
  strengeren Regel im Zweck (H3 oder H4) und an der vereinbarten Verwendung
  (eigener Satz), je unter `streng`, ab 2026-11-21 und nur an einer Regel, die es
  tragen kann; dort ändert es das Mehr nicht. An einer milderen Regel ändert es das
  Mehr und steht deshalb nicht am Erfordernis: Das gespeicherte Mehr hält es fest.
  **Am Erfordernis, nicht in `snapshot`:** Die Momentaufnahme trägt, was für die
  ganze Versammlung gilt; was eine Regel am Traktandum rechnet, steht am Traktandum
  (wie `requirement_abstention_counts`), und `released_requirement` nimmt es als
  Abschrift mit. In `snapshot` hätte es zudem den Weg der Karte nach der Freigabe
  abgeschnitten (`FONDSENTNAHME_WEG_HAEKCHEN`). **Vor der Freigabe** vergleicht
  `l17Regelstand` es mit, sofern das gespeicherte Erfordernis der Fassung
  2026-11-21 oder später angehört (`haekchenSeit`), und nur, wo am neu hergeleiteten
  ein Satz daran hängt (`l17Regelstaende`; nach einer Umstellung auf «svit» bleibt ein
  Traktandum unter derselben Regel gültig, Befund im Prüflauf beim Bau, 18.11.2026):
  Wechselt nur das Häkchen, ist
  das Traktandum veraltet, die Freigabe sagt mit eigenem Satz ab
  (`FONDSENTNAHME_HAEKCHEN_VERALTET`, Grund `haekchen`, als Zustand gesagt, weil es
  ihn auch ohne geändertes Häkchen gibt, etwa nach L17 von «svit» zurück auf «streng»),
  und der Kasten nennt es in Worten (`haekchenZusatz`, «nicht vermerkt», wo das
  gespeicherte keines trägt). **Nach der Freigabe** leiten
  Erfordernisseite (`regelanwendungAmTraktandum`, für Karte, «Übernehmen», KI und
  den Vorschlag beim Setzen), Kasten und Nachziehen mit
  `wendeReglementAnNachFreigabe` her, ebenso das Geschäft des Abends
  (`setzeErfordernisAmGeschaeft`, Codeprüfung M1; die Bedingung liegt in
  `gespeichertNachFreigabe`, `erfordernisse.ts`): Trägt das gespeicherte Erfordernis ein
  solches Häkchen, an derselben Karte und Regel, rechnet die Herleitung mit ihm
  statt mit dem der Regel. Die Karte zeigt so den Satz von damals, der Kasten
  bietet nicht an, ihn zu ändern, und ein geändertes Mehr lässt sich weiter
  nachziehen. Nach einer Rücknahme der Freigabe gilt wieder das Häkchen der
  Gemeinschaft. **Grenze:** Ein Traktandum, das erst nach der Freigabe entsteht oder
  die Karte wechselt (Folgeantrag, Aufnahme im Saal, neues Geschäft des Abends),
  trägt kein Häkchen von damals und bekommt das von heute (Pendenz «Häkchen
  eingefroren, Restpunkte»). **Der zweite Finder `/quorum` bleibt live:** Er kennt keine
  Versammlung, wie bei den Lesarten. Proben: `tests/domain/haekchen-eingefroren.test.ts`,
  `tests/db/fondsregel-haekchen.test.ts`; Drehbuch `e2e/lesarten-l17.mjs`.
- **Von Hand gesetzte Kopfbasis «aller Eigentümer», ab Fassung 2026-11-16**
  (Entscheid 0050, Antwort 1, «Angleichen»): Unter einem Mehr, das die Leitung
  in «Anderes Erfordernis setzen» oder ohne Herleitung gesetzt hat (`quelle
  'gewaehlt'`, leere Rechtsgrundlage, auch das Rückkommen darauf), bleibt, wer
  im Ausstand ist, in der Zahl wie unter L13 «Alle Eigentümer»
  (`ausstandBleibtBeiGewaehlterBasis`, zusammen mit L13 `ausstandBleibtUnterAllen`).
  Nur einfaches und qualifiziertes Mehr. **Nicht an der Ausschlussklage und
  nicht an der Einsprache**, wo L13 auch nicht wirkt: An der Klage gilt 1e, an
  der Einsprache fällt der Ausstand heraus; in der Auszählmappe tragen dort
  Betroffene und Ausstand dieselbe 9 (Fachprüfung Textrunde 0050, R3-F-1).
- **1e, fest ab Fassung 2026-10-25:** An der Ausschlussklage bleiben Parteien
  im Ausstand unter einer Zahl über alle in der Bezugsgrösse, ohne abzustimmen
  (`ausstandBleibtInDerZahl`, Eimer `imAusstand`); der Beklagte nie.
- **L10, an der Zählung ab Fassung 2026-11-10** (Migration 189, Entscheid 0044,
  zweiter Nachtrag, R1 b): Ob die Angehörigen im Ausstand an der Ermächtigung
  zur Ausschlussklage in der Zahl bleiben, stellt die Gemeinschaft ein; die
  Vorgabe lässt sie darin, wie 1e. **Kein Knoten trägt L10**, weil sie nicht das
  Mehr tauscht, sondern die Zahl: `angehoerigenlesartWirkt` grenzt sie ein (nur
  `k-ausschlussklage`, nur `alle_ausser_betroffene`, nicht unter einer Regel,
  erst ab der Fassung), und `ausstandBleibtInDerZahl` liest die Wahl dort.
  Gesetzt wie L1 vom Auslöser `agenda_aa_lesart_l10_setzen`; die Freigabe sagt
  ab, wo ein Traktandum aus den Fassungen ab 2026-10-25 und vor 2026-11-10 fest
  mit den Angehörigen in der Zahl rechnet und die Gemeinschaft auf
  «fallen_heraus» steht (`l10Veraltet`); der Kasten «Erfordernisse nachziehen»
  zeigt nach derselben Bedingung (`angehoerigeNachzuziehen`) genau diese
  Traktanden, ab 2026-11-10 übernimmt die Freigabe die Wahl von selbst. Drei
  Sätze folgen der Wahl: der Hinweis 9 der Karte (W12), der Satz vor der
  Abstimmung (`angehoerigenlesartHinweis`, W11, nur mit erklärtem Ausstand
  ausser den Betroffenen) und der Hinweis an die Leitung (ein Satz zur Messung
  und W13, statt des Rats, von Hand zu zählen). Zweites Ergebnis in
  `Auszaehlung.andereAngehoerigenlesart`, auch bei der Handzählung, im
  Protokoll nur bei Abweichung. **Die Rechnung an allen bleibt mit den
  Angehörigen:** Unter L9 «anwesende» (1a) und nach Gesetz, wenn die Leitung
  auf die Anwesenden abgewichen ist (Anhang A), setzt Votum `angehoerigenlesart`
  dort aus, wie der Hinweis an die Leitung sagt. Misst die Leitung weiter an
  allen, folgt Anhang A der Einstellung, wie ohne Abweichung; kam das Mass aus
  einer Bestimmung des Reglements (`Gesetzesmass.ausReglement`), wirkt L10 dort
  nicht, auch wie ohne Abweichung. Die Auszählmappe rechnet L10
  nicht (dieselben Einträge, zwei Zahlen); die 7 nennt sie, wo eine ihrer
  Spalten die Angehörigen in der Zahl hat, unter «fallen_heraus» also nur mit
  einer Spalte 1a oder A.
- **Zweites Ergebnis:** `zaehleAus` und `zaehleSummenAus` zählen dieselben
  Stimmen ein zweites Mal nach dem Erfordernis der anderen Lesart
  (`Auszaehlung.andereLesart` für L2, L4, L6, L11, L12 und L17, `andereAusstandslesart` für L1, nur wo ein
  Ausstand den Nenner berührt, `andereAngehoerigenlesart` für L10, nur wo eine
  Angehörige nach der Vorgabe in der Zahl bliebe; Anzeigen lesen alle über
  `andereLesartenVon`).
  **L9 rechnet das zweite Ergebnis nicht hier, sondern über 1a**
  (`andereZaehlbasis`): Die andere Zählbasis ist die eingestellte Lesart der
  Gemeinschaft, und `vergleichNachAndererLesart` schweigt deshalb für L9.
  Weicht es ab, nennt die Leitung es mit Zahlen (geheim: nur erreicht oder
  nicht) und das Protokoll am Ausgang; sonst sagt die Leitung «Nach der anderen
  Lesart («…») dasselbe Ergebnis». Die Karte vor der
  Abstimmung nennt die angewandte Lesart und was die andere verlangt
  (`lesartKartensatz`), das Protokoll je Beschluss die Lesart
  (`lesartProtokollsatz`). Nennt eine Lesart eine Folge der milden Wahl
  (`folgeMilderWahl`, L9, L10, L11 und L12), steht sie auf der Seite «Lesarten» unter dieser Wahl
  und, sobald sie eingestellt ist, am Ende des Satzes zur Lesart am Mehr vor der
  Abstimmung. Wo der allgemeine Rat nach einer Annahme nicht trägt, die nach der
  anderen Lesart scheiterte, gibt die Lesart ihren eigenen (`ratNachAnnahme`, L10,
  L11 und L12: der Rat sagt, dass ein Gericht den Beschluss aufheben kann, und
  verweist auf den Hinweis der Karte zum Vorgehen danach). Dazu kann eine Lesart
  einen Satz an den Rat nach einer Ablehnung hängen (`nachAblehnung`, L12: der
  schriftliche Beschluss aller, wenn nur Abwesende fehlen), einen an das
  Protokoll nach einer solchen Ablehnung (`protokollNachAblehnung`, L10: die
  Ablehnung ermächtigt niemanden) und einen an die
  Feststellung im Protokoll nach einer solchen Annahme (`protokollNachAnnahme`,
  L10 und L12: die Anfechtungsfrist der Abwesenden und der Rat zur Ermächtigung). Unter der Einstimmigkeit nur der
  Anwesenden trägt die Karte eine eigene Formel (`KnotenLesart.andere.formel`)
  und einen eigenen Satz zur Stimmwirkung (`stimmwirkungsteile`).
- **1a und Anhang A, fest mit zweitem Ergebnis** (Lesarten Block 6, Migration
  173, Entscheid 0023; keine Lesart, keine Fassung): An der Ermächtigung zur
  Ausschlussklage zählt Votum zusätzlich mit der anderen Zählbasis
  (`andereZaehlbasis`, `andereZaehlbasisVon`): unter der Zahl aller ausser dem
  Beklagten an den Anwesenden und Vertretenen, unter einer Regel der
  Anwesenden ab Fassung 2026-10-25 an allen. Weicht die Leitung vom Vorschlag
  ab, legt `uebersteuere` dessen Mass als `gesetzlich` ab
  (`agenda_item.requirement_statutory`), weil das Reglement nicht eingefroren
  ist; die Auszählung rechnet damit `nachGesetzUndReglement`, wenn es anders
  zählt. Eine Abweichung erkennt die Auszählung an der Begründung, nicht an
  `quelle: 'gewaehlt'` (die trägt auch ein von Hand gewählter Knoten).
  Protokoll und Auswertung nennen 1a nur bei abweichendem oder nicht
  bestimmbarem Ergebnis, Anhang A nie (Produktentscheid 30.09.2026).
  **Seit L9 (Migration 188) ist die andere Zählbasis die eingestellte Lesart
  der Gemeinschaft.** Das Ergebnis trägt dann `ausLesart`, und der Satz an die
  Leitung sagt, dass die Einstellung verkündet und nicht Votum: «Verkündet wird
  nach der Einstellung Ihrer Gemeinschaft die Ablehnung». Nach einer Annahme,
  die nur die Anwesenden tragen, nennt er die offene Frage, ob das Gericht im
  Ausschlussprozess die Mehrheit aller nachprüft, mit dem Grundsatz davor, und
  den Weg, der den Streit um die Zahl vermeidet, samt Rat zu den Vollmachten
  (`ZAEHLBASIS_OFFEN`, `ZAEHLBASIS_WEG`, zusammen `ZAEHLBASIS_ANWESENDE_FOLGE`),
  vor dem Rat zum Zeitpunkt der Klage, der dann «frühestens» statt «am
  sichersten» sagt; das Protokoll nennt die offene Frage auch. Nach einer
  Ablehnung unter der Vorgabe steht der Grundsatz als Möglichkeit
  (`ZAEHLBASIS_OFFEN_NACH_ABLEHNUNG`), damit er sich nicht auf den abgelehnten
  Beschluss beziehen lässt. Der Hinweis an
  die Leitung zu den Angehörigen nennt unter L9 `ZAEHLBASIS_RISIKO` (ohne den
  Grundsatz, der dort schon steht) und denselben Weg. Das Vergleichserfordernis
  übernimmt unter L9 die Einstellung zu den Enthaltungen der anderen Wahl. Vier
  Hinweise der Karte lauten unter «anwesende» anders, darunter der zu den
  Zahlen (`KnotenLesart.andere.hinweisErsatz`).
- **B3, fest mit zweitem Ergebnis ab Fassung 2026-11-05** (F4c, Entscheid
  0041; keine Lesart; die Fassung entsteht mit L6): Am Mehr der Anwesenden und Vertretenen fällt eine
  Partei, deren einziger Vertreter im Ausstand ist, wie bisher aus der Zahl.
  Zusätzlich zählt Votum sie ohne Stimme mit (`vertretungImAusstand`,
  `vertretungImAusstandWirkt`; Rz. 181 ad Art. 712m): über das Merkmal
  `vertretungImAusstandInDerZahl` an der **Lage**, nicht am Erfordernis, weil es
  nie gespeichert wird. Nur wo eine Vollmacht wegen eines Ausstands ruht, nur
  unter Fassungen mit Datum, nicht wo 1a rechnet. Es gibt nur zwei Ausgänge,
  «dasselbe» und «abgelehnt»: Ja und Nein bleiben, die Bezugsgrösse wächst;
  alles andere lässt `mitVertretungImAusstand` weg (Wächter im Test). Misst
  eine Seite über alle, steht die Partei dort schon in der Zahl; die Sätze
  nennen die andere Seite und warum nur sie (`nurBei`, `koepfe` beim
  gesetzlichen qualifizierten Mehr, `wertquoten` umgekehrt). Protokoll wie 1a
  nur bei Abweichung, mit Frist und Berechtigten; die
  Auszählmappe führt B3 nicht, weil sie ruhende Vollmachten aus Ausstand und
  Betroffenheit nicht trennt.
- **Erste Lesart L4** ab Fassung 2026-10-24: Der Baum fragt bei der Wahl der
  Bewirtschaftung nach ihren Kompetenzen; nur die Wahl mit erweiterten
  Kompetenzen trägt die Lesart.
  Ab Fassung 2026-11-13 (Entscheid 0048, Block B; Migration 191) rechnet
  sie nach der Vorgabe das qualifizierte Mehr nach dem Wortlaut von Art. 647b
  Abs. 1, die Wahl «einfach» das einfache Mehr nach dem SVIT-Kommentar.
  Gemeinschaften, die L4 nie umgestellt hatten, zieht die Migration mit einem
  Verlaufseintrag nach; Knoten früherer Fassungen rechnen weiter das einfache
  Mehr (`wahlDesKnotens`, Block A).
- **L2** ab Fassung 2026-10-26 (Migration 171): Die Zuständigkeitsordnung
  ausserhalb des Reglements (`k-zustaendigkeit-gewoehnlich`, Art. 647a Abs. 2)
  rechnet nach der Vorgabe das einfache Mehr der Anwesenden und Vertretenen;
  die Wahl «qualifiziert» rechnet das qualifizierte Mehr nach Rz. 109 ad
  Art. 712a. Den Wortlaut «Mehrheit aller Miteigentümer» rechnet keine Wahl.
  Der Website-Abzug sagt seit Block 8, von welcher Seite die Karte ausgeht, mit
  der anderen und dem sicheren Weg, ohne die Umstellung.
- **C1 und C2, fest ab Fassung 2026-10-27** (keine Lesart, Entscheide 0018 und
  0021): Hat die Bewirtschaftung, ein Ausschuss oder ein Delegierter danach bei
  einem Geschäft das letzte Wort, das das Gesetz der Versammlung vorbehält
  (Art. 712m Abs. 1 Ziff. 2 bis 6), rechnen die neuen Knoten
  `k-bewirtschaftung-statt-versammlung` und `k-uebertragung-statt-versammlung`
  die Einstimmigkeit; eine Regel des Reglements wenden sie nicht an
  (`sperreNachLehre`). Andere Aufgaben eines Ausschusses rechnen mit einfachem
  Mehr (`k-uebertragung-beschluss`), im Reglement mit qualifiziertem
  (`k-reglement-normal`); Ausgaben der alltäglichen Verwaltung nach L2
  (`k-zustaendigkeit-gewoehnlich`). Bestehende Knoten ändern ihre Rechnung
  nicht, damit Traktanden älterer Fassungen nicht als «älteres Erfordernis»
  erscheinen.
- **L3, an der Zählung ab Fassung 2026-10-28** (Migration 172, Entscheid 0022):
  An `k-einsprache` in einer Gemeinschaft je Einheit zählt die Einsprache nach
  der Wahl, Vorgabe je Eigentümer (Rz. 181 ad Art. 712m; Rz. 186 ad Art. 712c).
  Welche Zählweise ein Erfordernis hat, sagt nur `zaehlweiseFuer`, das Gewicht
  einer Partei nur `kopfgewicht` (Wächter `check:kopfgewicht`); Anzeigen an der
  laufenden Abstimmung nehmen `kopfstimmenAn`. Gesetzt wie L1 vom Auslöser
  `agenda_aa_lesart_l3_setzen`, gebunden an die Fassung wie 1e: Ältere
  Einsprachen zählen weiter nach der Gemeinschaft. Zweites Ergebnis in
  `Auszaehlung.andereZaehlweise`; bei der Handzählung aus einer zweiten Dreizahl
  (`tally_other_*`), Pflicht, sobald eine anwesende Partei je Einheit nicht genau
  eine Stimme hat, und für sich geprüft (`pruefeAndereDreizahl`). Die Leitung
  sieht beide Ergebnisse nach dem Schliessen, vor dem Verkünden; einen
  Zwischenstand gibt es nicht. Das Zahlenbeispiel der Karte rechnet nach der
  angewandten Zählweise (`kennzahlenNachZaehlweise`).
- **L5, Sperre beim Eröffnen** (Lesarten Block 7, Migration 174, Entscheide
  0018 F4 und 0024; keine Fassung): Neu ist ein Traktandum der zweiten
  Versammlung nach `neueTraktandenDerZweiten` (Ä-17 B), gelesen in der
  Transaktion über `server/neutraktanden.ts`. Nach der Vorgabe `erste` prüft
  `oeffneAbstimmung` dort die Beschlussfähigkeit einer ersten Versammlung
  (`pruefstufeFuerTraktandumIn`, Absage `neues_traktandum_gesperrt`); der
  Notweg fährt dieselbe Prüfung trocken, konsultativ rechnet mit derselben
  Stufe und ist deshalb zulässig. Die milde Wahl `drittel` ist die Lösung aus
  0012 mit Hinweis. Die Wahl kommt ab der Freigabe aus der Momentaufnahme;
  Momentaufnahmen von vor Migration 174 tragen `drittel`, weil sie nach 0012
  eingeladen haben. Leitung und Traktandenseite nennen die Wahl
  (`neuAnZweiterHinweis`), nach der Vorgabe auch, was die andere verlangt
  (`neuAnZweiterAndereLesart`, Featureprüfung 22.10.2026, Kriterium 4), das
  Protokoll je Beschluss (`neuAnZweiterProtokoll`).
  Einladung und Liste tragen nach der Vorgabe am neuen Titel «¹» und einmal
  die Fussnote mit der Bedingung einer ersten Versammlung
  (`holeNeutraktandenfussnote`), der Beamer nicht.
- **Vergleiche mit dem Mehr eines Knotens** (Folgeantrag, Auswahl im Saal,
  KI-Vorschlag) laufen über `erfordernisAmHaus`, mit Regel und Lesart, nicht
  über den Typ des Knotens.
- **Wer umstellt:** Vorgabe nur die Verwaltung, an der Gemeinschaft umstellbar
  auf «Verwaltung und Sitzungsleitung» (siehe «Zwei Rollen der Benutzer»). Jede
  Umstellung steht im Verlauf mit Rolle, Vorzustand und neuem Wert in Worten.

### Reglementsabweichungen

Das Gesetz kennt ein Erfordernis, das Reglement kann ein anderes vorsehen — und
dann gilt das Reglement, soweit das Gesetz die Abweichung zulässt und sie so
eingeführt wurde, wie es verlangt (dazu unten, und je Karte im Kasten zum
Reglement). Der Vorbehalt wechselt damit seine Rolle: Hinweis, wo
nichts hinterlegt ist; ausgewiesene Anwendung, wo etwas hinterlegt ist.

Angeknüpft wird an der **Geschäftsart**, nicht an der Knotenkennung: Ein Reglement
spricht von «baulichen Massnahmen». Hinge die Regel an der Kennung, verlöre sie
mit der nächsten Regelfassung ihre Wirkung — still, ohne Fehlermeldung.

Schwellen sind Brüche mit Lesart, weil ein Zweidrittelmehr keiner der
gesetzlichen Typen ist. «Mindestens zwei Drittel» und «mehr als zwei Drittel»
sind nicht dasselbe: Bei 6 Stimmen sind es 4 oder 5.

**Wo das Gesetz eine einstimmige Vereinbarung verlangt** (Art. 712g Abs. 2,
Art. 648 Abs. 2), wendet die Anwendung eine hinterlegte Regel seit der Fassung
2026-10-15 an (Reglementsverhalten `vereinbart`; Produktentscheid 07.10.2026
nach einer Fachprüfung vor dem Bau, Bericht in `quellen/pruefung/berichte/`).
Bis dahin hielt sie die Regel auf (`gesperrt_vereinbarung`), weil sie die
Einstimmigkeit nicht prüfen kann, und versprach im Text einen Weg, nach ihr
auszuzählen, den es nicht gab. Jetzt gilt dasselbe Muster wie bei den
Enthaltungen: Die Gemeinschaft hinterlegt die Regel mit Fundstelle und steht
dafür ein, wie sie zustande kam. Betroffen sind die notwendige und die
nützliche bauliche Massnahme, die Benutzungsweise, die Zweckbestimmung und die
wichtigeren Verwaltungshandlungen. Eine Regel, die dort Einstimmigkeit
verlangt, bleibt aussen vor, ausser an der Zweckbestimmung, wo das Gesetz sie
selbst verlangt (Vorbehalt `einstimmigkeit_ausgeschlossen`; nach dem
SVIT-Kommentar Rz. 125 ad Art. 712a, Rz. 37 ad Art. 712g, in der Regel
Rz. 196 ad Art. 712m). An der Zweckbestimmung, wo das Gesetz die Zustimmung
aller verlangt, gilt nur eine Regel für genau diesen Fall (Vorbehalt
`nur_fallgenau`): Sie teilt die Geschäftsart mit der Benutzungsweise, und die
Fallwahl auf der Reglementsseite zählt sie unter «alle Geschäfte dieser Art»
nicht mit. **Seit der Fassung 2026-10-30 ebenso an den erweiterten Kompetenzen
der Bewirtschaftung** (`k-bewirtschaftung-erweitert`, Verhalten `vereinbart`,
die Kennung steht in `regelNurFallgenau`, weil `k-verwaltung-wichtig` dasselbe
Verhalten ohne Fallgenauigkeit trägt): Eine Regel der ganzen Geschäftsart
`organe` greift dort nicht mehr (A1 Frage 2, Ergebnisänderung); eine
fallgenaue wird angewandt, auch wenn sie die Zustimmung aller verlangt, weil
Rz. 196 ad Art. 712m nur die systematische Einführung trifft (Fachprüfung A4,
R4-F-1). **Seit der Fassung 2026-11-20 an der Bezahlung aus dem
Erneuerungsfonds nach der Lesart L17** (`k-erneuerungsfonds-entnahme` und
`-vereinbart`, Verhalten `frei`): nach der Vorgabe jede Regel, die nicht milder
ist, auch eine für alle wichtigeren Verwaltungshandlungen (Eigenmann hält die
Entnahme für eine, Fachprüfung F-5); nach dem SVIT-Kommentar nur eine für genau
diesen Fall, strenger wie milder (Fachprüfung F-1; Produktentscheid
17.11.2026). **Seit der Fassung 2026-11-21** gilt nach der Vorgabe im Zweck auch
eine mildere Regel, wenn sie das Häkchen «Begründungsakt oder Zustimmung aller»
trägt (Migration 197, oben unter L17). Welche Verhalten eine Regel überhaupt durchlassen, sagt
`regelKannGreifen` an einer Stelle; Fallwahl, Absage beim Erfassen, `regelGiltFuer`
und der Satz «nirgends angewandt» der Reichweite lesen sie. Ob eine mit
weniger als allen Stimmen eingeführte Bestimmung trotzdem gilt, beantworten
die Karten einheitlich mit «nicht geklärt» und nennen beide Seiten. Der Ausweg der
luxuriösen Massnahme trägt `nur_mildern` (Rz. 54 ad Art. 712g). Luxuriöse
Massnahme und Verkauf bleiben gesperrt. Was das Recht je Karte sagt, steht im
Feld `reglementsrecht` des Knotens und erscheint im Kasten zum Reglement, im
Vorbehalt und unter der angewandten Regel; ebenso an Abberufung und
Wertquotenänderung, die `gesperrt_zwingend` bleiben. Unter einer angewandten
Regel nennt die Karte die Bedingung, verlangt die Ansage im Saal und sagt, dass
ein Beschluss, der auch das Gesetz erreicht, nach jeder Lesart trägt. Der
Quorenfinder der Website liest dasselbe Regelwerk
(`scripts/quorumsbaum-export.mjs`), zeigt aber nicht den Rechtssatz, sondern
einen eigenen Kurztext je Karte (`REGLEMENT_WEBSITE`, seit 08.10.2026, nach
Laien- und Fachprüfung für Website-Leser). Jeder Kurztext trägt die Prüfsumme
des Rechtssatzes, gegen den er geschrieben ist; ändert eine neue Fassung den
Rechtssatz, bricht der Export ab, bis der Kurztext geprüft und die Prüfsumme
nachgezogen ist. Das Signet «streng ausgelegt» steht nur, wo das gezeigte
Quorum selbst auf der strengen Lesart beruht; ein Streit darüber, ob ein
Reglement abweichen darf, steht im Kasten, nicht im Signet (Ausweg, Verkauf,
Wertquotenänderung, Zirkularbeschluss und Reglementsänderung tragen keines;
es bleibt an Ausschlussklage, Prozessführung, luxuriöser Massnahme,
Selbstverschärfung des Reglements und seit der Fassung 2026-11-13 an der Wahl
einer Bewirtschaftung mit erweiterten Kompetenzen). Wo die Karte bei einer umstellbaren
Lesart von der milderen Seite ausgeht (L2, bis zur Fassung 2026-11-11 auch L4;
`STREITFRAGEN_MILD`), heisst
das Signet «Streitfrage zum Mehr · mild ausgelegt, sicherer Weg auf der Karte»
(Lesarten Block 8). Seit der Fassung 2026-10-16 sagen
sieben Rechtssätze genauer, was ihre Belege tragen (Ausweg: ob ein Reglement
senken darf, ist umstritten; Verkauf: Rz. 18 ad Art. 712g im Wortlaut;
Fristbeginn «ohne Vertretung»).

### Die Einberufungsfrist

Das ZGB nennt für die Einladung **keine** Frist. Sie steht im Reglement, und
dort steht je Haus etwas anderes: zehn Tage, zwanzig, dreissig. Deshalb ist sie
je Gemeinschaft hinterlegbar (mit Fundstelle, wie die Zählweise und die
Vollmachtschranke) und hat keine Voreinstellung — eine Vorgabezahl wäre eine
Behauptung über fremdes Recht, und sie stünde still im Weg, sobald sich jemand
darauf verlässt.

Aus ihr folgt der **letzte Tag, an dem die Einladung bei allen sein soll**
(im Code `versandfrist`): Versammlungstag minus Frist. Bis zum Empfang zu
rechnen ist die vorsichtige Regel der Anwendung; ein Reglement kann ab Versand
rechnen, dann gilt nach ihm dessen Regel (Produktentscheid 06.10.2026, «Als
Regel der Anwendung»; Rz. 23, 24 ad Art. 712n). Er steht
am Vorbereitungsschritt «Einladung erzeugen», und einen Werktag davor geht eine
Erinnerung an die Bewirtschaftung, wenn bis dahin keine Einladung erzeugt und kein
Versand vermerkt wurde. Nach einer Rücknahme der Freigabe zählt nur, was danach
erzeugt wurde, und die Erinnerung kommt erneut (Migration 147). Nach jeder Milderung des Mehrs kommt sie einmal erneut,
ausser die berichtigte Einladung ist schon rechtzeitig vermerkt oder das Mehr
zurückgestellt (Migrationen 145 und 146;
`docs/dienste.md`, «Die Erinnerung an den Einladungsversand»).
Ohne hinterlegte Frist rechnet die Anwendung nichts und erinnert nicht; der
Schritt sagt dann, dass die Angabe fehlt.

## Zwei Entscheide, die sich beim Bauen als tragend erwiesen

**Die Zählweise der Kopfstimme hat keine Voreinstellung.** Rechtlich ist eine
Stimme je Eigentümer die Auffangregel (ZGB Art. 712m Abs. 2 i.V.m. Art. 67
Abs. 1); in den meisten Reglementen steht die Zählung je Einheit. Eine
Voreinstellung wäre in beide Richtungen falsch — wer die eine unbesehen
übernimmt, zählt vielleicht ohne Grundlage im Reglement, wer die andere
übernimmt, gegen das eigene. Beides fällt erst auf, wenn ein Beschluss
angefochten wird. Deshalb verlangt das Formular eine bewusste Wahl und fragt bei
der Zählung je Einheit nach der Fundstelle.

**Mehrere Wertquoten je Einheit.** Neben der Stammquote aus dem Grundbuch führen
Reglemente eigene Verteiler für Aufzug, Heizung oder Waschküche, jeder mit
eigenem Nenner. Für das Stimmrecht zählt allein die Stammquote (ZGB Art. 712e);
die übrigen sind Kostenschlüssel. Kein Eintrag heisst «nicht beteiligt», der
Wert 0 heisst «beteiligt mit Anteil null» — die Erdgeschosswohnung zahlt gar
nicht an den Aufzug.

**Der Vorschlag darf nie wie eine Feststellung aussehen.** Auf der Website liest
jemand eine Orientierungshilfe. Im Saal steht der Vorschlag auf dem Beamer, und
wer ihn dort liest, hält ihn für das Ergebnis einer Prüfung. Jede Ergebniskarte
sagt deshalb, wer entschieden hat — das Werkzeug schlägt vor, die Sitzungsleitung
entscheidet.

## Die Momentaufnahme

Mit der Freigabe wird der Stimmberechtigtenstand zum **Versammlungsdatum**
eingefroren, nicht zum Tag der Freigabe: Wer im August für den September
freigibt, will den Stand vom September (AD-3).

Die Momentaufnahme trägt Namen und Werte selbst und hat bewusst **keine**
Fremdschlüssel auf `party`, `unit` oder `unit_ownership`. Ein Fremdschlüssel
bände sie an eine Zeile, die sich ändern kann — dann stünde später der Name von
heute darin statt der von damals, und die Zusage wäre gebrochen, ohne dass
irgendwo etwas kaputtginge.

Die Rücknahme der Freigabe **verwirft** sie vollständig, statt sie
fortzuschreiben. Eine teilweise Fortschreibung wäre ein Zwitter, bei dem niemand
sagen könnte, welcher Stand gilt. Bei erneuter Freigabe entsteht sie neu und kann
andere Zahlen tragen — auch das steht im Verlauf.

Mit eingefroren wird die **Zählweise der Kopfstimme samt ihrer Grundlage**. Dass
gezählt wird, ist die eine Hälfte; wie gezählt wird, die andere: Dieselben Stimmen
ergeben je nach Zählweise Annahme oder Ablehnung. Deshalb steht im Kopf jeder
Auswertung ein Satz wie

> Gezählt wird eine Kopfstimme je Einheit, gestützt auf Art. 28 Abs. 1 Reglement.
> Das weicht von der gesetzlichen Auffangregel ab und gilt nur, soweit das
> Reglement es vorsieht. Nebenobjekte tragen dabei keine Kopfstimme.

Die Fundstelle wandert dazu in die Momentaufnahme (Migration 022). Bliebe sie in
den Stammdaten, stünde nach einer Berichtigung in der Auswertung einer längst
gehaltenen Versammlung der heutige Beleg. Fehlt sie, sagt der Satz das
ausdrücklich, statt sie wegzulassen: Eine benannte Lücke lässt sich vor der
nächsten Versammlung schliessen, eine verschwiegene fällt erst im Streitfall auf.

**Was eine Regel des Reglements am Traktandum bewirkt, friert das Traktandum ein,
nicht die Momentaufnahme.** In `snapshot` stehen Einstellungen der ganzen
Gemeinschaft: Zählweise, Lesarten, Stichentscheid, Universalversammlung. Die Regeln
selbst stehen nicht darin; was eine angewandte Regel rechnet, schreibt die
Herleitung ans Erfordernis des Traktandums (Schwellen, Bezugsgrössen,
`requirement_abstention_counts`, Fundstelle), und die Freigabe hält es fest, samt
Abschrift für die Einladung (`released_requirement`, Migration 144). Ebenso seit
Migration 198 das Häkchen «Begründungsakt oder Zustimmung aller», wo es nur den Satz
an der Karte ändert (unter L17). Der Wortlaut einer hinterlegten Bestimmung bleibt
live (Pendenz «Die hinterlegte Bestimmung ist nicht eingefroren»).

## Zwei Zählweisen der Kopfstimme

Einzustellen an der Gemeinschaft, **ohne Voreinstellung** — wer hier nicht wählt,
hat nicht ins Reglement gesehen, und das fiele sonst erst bei einer Anfechtung auf.

| Wahl | Wirkung | Grundlage |
|---|---|---|
| **je Eigentümer** | Drei Wohnungen, eine Stimme | gesetzliche Auffangregel (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 1) |
| **je Einheit** | Drei Wohnungen, drei Stimmen | nur soweit das Reglement es vorsieht — Fundstelle ist Pflichtfeld |

Bei «je Einheit» kommt die Frage dazu, ob **Nebenobjekte** (Einstellplätze,
Kellerabteile) eine eigene Kopfstimme tragen. Ohne Haken zählen sie bei der
Wertquote mit, bei den Köpfen nicht.

Unabhängig davon und nicht abschaltbar: Steht eine Einheit **mehreren Personen
gemeinschaftlich** zu, ist es eine Stimme, und das System verlangt die Bezeichnung
der Person, die sie ausübt (ZGB Art. 712o Abs. 1). Ohne diese Angabe stünde die
Sitzungsleitung im Moment der Abstimmung vor der Frage, wen sie zählen darf.

## Stimmengleichheit

Das Gesetz kennt keinen Stichentscheid: Wer die Mehrheit nicht hat, hat sie nicht
— sieben Ja gegen sieben Nein heisst abgelehnt. Manche Reglemente bestimmen
anderes, etwa «Bei Stimmengleichheit ist die Anteilsberechtigung (Wertquoten)
massgebend». Das lässt sich an der Gemeinschaft einstellen, mit Fundstelle.

Drei Grenzen, die die Regel eng halten:

- Sie greift **nur beim echten Gleichstand** — gleich viele Ja wie Nein. Das ist
  der Wortlaut, und weiter darf er nicht gefasst werden: Sonst hebelte sie jede
  verfehlte Mehrheit aus, sobald die Quoten günstig stehen.
- Sie greift **nie bei der Einstimmigkeit.** Dort geht es nicht um eine Mehrheit,
  die sich gleich verteilen könnte, sondern um die Zustimmung aller; ein
  Stichentscheid ersetzte eine fehlende Zustimmung.
- Sie greift **nicht bei null zu null.** Ein Beschluss ohne eine einzige
  Ja-Stimme wäre keiner.

Kommt ein Beschluss so zustande, sagt der Ergebnissatz es ausdrücklich — «bei
Stimmengleichheit hat nach dem Reglement die Anteilsberechtigung entschieden» —
und die Auswertung nennt die Fundstelle. Wer den Beschluss anficht, greift genau
hier an.

**Eine Person statt der Wertquoten, oder nach ihnen.** Manche Reglemente geben
den Gleichstand dem Verwalter oder dem Vorsitz, andere erst den Wertquoten und,
wenn auch die gleich stehen, einer Person (Migration 149, 07.10.2026). Den Willen
einer Person kann die Anwendung nicht rechnen: Sie hält an, bis der Entscheid
mit Namen eingetragen ist, und erst dann ist verkündet. Bei einer Handzählung
bleibt eine solche Kaskade bei den Wertquoten stehen, weil sich aus Summen nicht
ablesen lässt, ob die Quoten auflösen oder weitergeben.

Vorsitz und Verwalter sind dabei nicht dasselbe. Der Kommentar nennt den
Stichentscheid des Vorsitzenden als zulässige Reglementslösung; als
«inakzeptable Variante» gilt der Verwalter, der nicht selbst Eigentümer ist
(Rz. 187 ad Art. 712m). Einem Verwalter und einem Vorsitz ohne eigenes
Stockwerkeigentum empfiehlt die Anwendung deshalb die Ablehnung, einer
Eigentümerin im Vorsitz keine Richtung. Ihr Stichentscheid, den manche
Reglemente eine zweite Stimme nennen, geht nicht in die Zählung ein
(Migration 150): Bei drei Einheiten stünde sonst «2 zu 1» im Protokoll, und das
läse jeder als Zählfehler.

**Enthaltungen beim einfachen Mehr** (Migration 151, 07.10.2026). Viele
Reglemente fassen einmal für alle Abstimmungen mit einfachem Mehr, dass nur die
gültig abgegebenen Stimmen zählen (Rz. 186 ad Art. 712m). Das ist eine
Einstellung an der Gemeinschaft mit Pflicht zur Fundstelle, weil die Einführung
einstimmig sein muss, eine mit weniger eingeführte Klausel in der Regel nur
anfechtbar und nicht nichtig ist (BGE 143 III 537 E. 4.2.4) und Votum beides
nicht prüfen kann. Sie wirkt beim
**Herleiten** des Erfordernisses (`wendeReglementAn`), nicht beim Zählen: Das
Erfordernis ist der Nachweis der Rechnung, und an ihm hängen Auszählmappe,
Leitungsseite, Mehr der Einladung, Rückkommen und Export. Die Grenzen:

- nur das einfache Mehr mit der Basis der Anwesenden; Wahlen eingeschlossen
  (Rz. 184), qualifiziertes Mehr und Einstimmigkeit nicht;
- eine Reglementsregel der Geschäftsart geht vor, sie trägt ihre eigene Angabe
  zur Enthaltung; auch wenn Votum sie wegen eines Vorbehalts nicht anwendet,
  hält ein «zählt mit» aus ihr die Einstellung auf;
- wo die Einstellung besteht, aber nicht greift (qualifiziertes Mehr, die
  Sperren), sagt die Karte es und verlangt die Ansage im Saal;
- an den gesperrten Knoten je nach Grund (Fachprüfung 07.10.2026, F1): nicht
  bei der Abberufung (Rz. 64 ad Art. 712g: weder Verschärfung noch
  Erleichterung) und bei der Wertquotenänderung (umstritten, Rz. 86 f. ad
  Art. 712e, vorsichtig gerechnet), wohl aber bei der notwendigen baulichen Massnahme (umstritten,
  nach Rz. 36 ad Art. 712g «rechtlich nicht ausgeschlossen»); die Karte sagt
  es je Geschäft und verlangt, wo sie nicht gilt, die Ansage im Saal;
- wer anwesend ist und nicht abgibt, bleibt in der Bezugsgrösse (die
  vorsichtigere Lesart; eine Klausel «gültig abgegebene Stimmen» nähme ihn
  wohl ebenfalls heraus, der Kommentar erörtert das nicht);
- die Beschlussfähigkeit berührt sie nicht, wer sich enthält, ist anwesend.

Die Fundstelle wandert in die Rechtsgrundlage und damit ins Protokoll.
Gespeicherte Erfordernisse bleiben, wie sie sind, bis sie auf der Reglementsseite
nachgezogen werden; auch die Freigabe leitet nichts neu her. Von der Leitung mit
Begründung gesetzte Erfordernisse zieht der Kasten nicht nach
(`requirement_reason IS NULL`), sie werden von Hand neu gesetzt. Ungültige Stimmen,
die Rz. 186 mit den Enthaltungen nennt, kennt Votum nicht (`VoteChoice` hat drei
Werte). Ob Enthaltungen nach dem Gesetz mitzählen, ist selbst umstritten
(Rz. 181); die Sätze zur Einstellung sagen deshalb nur, wie Votum rechnet.
Der Absatz zum Reglement an der Wertquotenkarte, der «zwingendes Recht» auch
für die Erleichterung behauptete, und die Fundstelle der Abberufungssperre
(«712r Rz. 23» sagt nur «nicht erschwert») sind mit der Fassung 2026-10-15
nachgezogen: Beide Karten tragen seither einen eigenen Rechtssatz.

## Hindernis oder Hinweis

Vor der Freigabe wird geprüft, und die Trennlinie ist die eigentliche Arbeit
dieser Prüfung. Ein unausgeglichener Wertquotensaldo **hält auf**: Sonst wäre
jede Auszählung nach Wertquoten falsch, und zwar unbemerkt, weil auch von einer
falschen Bezugsgrösse aus eine Mehrheit errechnet wird. Ein fehlendes
Mehrheitserfordernis **hält nicht auf**: Es lässt sich nachholen und darf die
Einladung nicht blockieren.

Würde alles blockieren, gäbe es bald einen Weg daran vorbei. Würde nichts
blockieren, entstünde eine Momentaufnahme, auf der sich nicht rechnen lässt. Die
offenen Hinweise gehen mit der Freigabe in den Verlauf — es soll später nicht
rekonstruiert werden müssen, dass trotz offener Frage eingeladen wurde.

## Zugänge: nur der Prüfwert

Gespeichert wird nie der Zugangscode, sondern nur sein Prüfwert (NFR-5). Daraus
folgt der ganze Ablauf: Erzeugen und Karte-Ausgeben sind **ein** Vorgang, weil
der Code danach nirgends mehr steht. Eine Karte lässt sich nicht erneut
herunterladen, nur ersetzen — und der alte Zugang wird dabei ungültig.

Deshalb macht ein zweiter Klick auf «erzeugen» auch nicht alle bisherigen Karten
ungültig; er erzeugt nur für die, die noch keine haben. Das Gegenteil fiele erst
auf, wenn im Saal die Hälfte nicht hereinkommt.

Das Alphabet des Codes lässt I, l, O, 0, 1, U und V weg: Wer ihn abtippt, tut es
im Saal, unter Zeitdruck und oft ohne Brille.

## PDF mit eigener Schrift

Die Standardschriften eines PDF können nur WinAnsi. Ein Eigentümer namens
«Petrović» oder «Nowak-Łukasik» brächte die Erzeugung zum Absturz — genau dann,
wenn die Einladung entstehen soll. DejaVu Sans liegt deshalb unter
`src/lib/server/pdf/schriften/` im Projekt: Sie ist eine Bauzutat wie das
Stylesheet und darf nicht davon abhängen, welche Pakete auf dem Wirt installiert
sind (AD-18).

Der Zeilenumbruch steht im Kern und bekommt die Textbreite über eine übergebene
Messfunktion. Damit kennt der Kern keine Schrift und keine PDF-Bibliothek, und
der Umbruch ist mit einer Wertetabelle prüfbar, ohne je ein PDF zu erzeugen.

## Anwesenheit ist eine Folge, kein Kennzeichen

Ein überschreibbares «anwesend ja/nein» beantwortet die Frage nicht, auf die es
ankommt: Wer war **im Moment des Schliessens jener Abstimmung** im Saal? Wer um
20:15 geht, war um 20:00 anwesend, und das Ergebnis von 20:00 darf sich um 20:15
nicht ändern. Deshalb Ereignisse mit Zeitpunkt, nur angefügt (AD-5, AD-16), und
jede Auswertung nimmt einen Stichzeitpunkt entgegen.

**Anmelden ist keine Anwesenheit.** Der Eigentümer öffnet seinen Link und landet
in der Warteliste; erst die Sitzungsleitung bestätigt. Anders könnte sich jeder
mit einem Zugangscode selbst stimmberechtigt machen. Umgekehrt fällt ein bereits
Bestätigter nicht zurück in die Warteliste, wenn er seinen Link erneut öffnet.

## Wer nicht angemeldet ist

Zwei Wege führen an der Anmeldung vorbei, und beide brauchen dieselbe Lösung wie
schon die Anmeldung selbst: eine Funktion mit `SECURITY DEFINER`, weil ohne
Mandantenkontext jede Abfrage am Zeilenschutz leer ausgeht.

- `/z` — die Sicht des Eigentümers. Ein Code wird **einmal** eingelöst und gegen
  eine Gerätesitzung getauscht; im Keks liegt danach ein Sitzungsmerkmal, nicht
  der Code. Die Adresse heisst nur noch `/z` — der Code steht weder in der
  Adresszeile noch im Verlauf des Browsers noch auf dem Bildschirm, wenn das
  Telefon herumgereicht wird.

  Der Schutz liegt am Code: 97 Bit Zufall, nur als Prüfwert gespeichert, mit dem
  Schliessen wertlos. Ein unbekannter und ein entwerteter Code bekommen dieselbe
  Antwort; von aussen soll sich nicht feststellen lassen, ob ein Code je gültig
  war. Keine Sperre nach zu vielen Versuchen — bei 97 Bit ist Raten aussichtslos,
  und eine Sperre liesse sich zum Aussperren einzelner Eigentümer missbrauchen.

### Die Wächter antworten in zwei Gestalten

Beide Wächter in `src/hooks.server.ts` — «nicht angemeldet» und «nicht
berechtigt» — antworten seit dem 27.08.2026 je nach Aufrufer verschieden, aber
mit demselben Status, demselben Ziel und demselben Text. Die Regeln stehen in
`src/lib/server/absageantwort.ts`, geprüft in
`tests/domain/absageantwort.test.ts`.

| Aufrufer | «nicht angemeldet» | «nicht berechtigt» |
|---|---|---|
| Navigation | 303 auf `/anmelden?weiter=…` | 403 mit deutscher Seite |
| Formular mit `use:enhance` | 200 mit `{type:'redirect', location}` | 403 mit `{type:'error'}` |
| eigener JSON-Schreiber | **401** mit `{fehler}` | 403 mit `{fehler}` |

**Warum drei.** Eine abgefangene Absendung erwartet JSON. Bekommt sie HTML,
scheitert SvelteKit am `JSON.parse` und macht daraus einen Fehler **ohne**
Status — die Seite kann dann «nicht berechtigt» nicht mehr von «keine
Verbindung» unterscheiden. Gemessen am 27.08.2026 auf der Einheitenseite: Ein
Konto ohne Stammdatenrecht las «Der Server hat nicht wie erwartet geantwortet».

Der dritte Fall ist der schwerste und war schon vorher da.
`SicherndesFeld.svelte` schickt seinen Text als JSON und prüfte nur
`antwort.ok`. `fetch` folgt der Umleitung auf `/anmelden` von sich aus und
bekommt HTTP 200 — das Feld meldete «gesichert» und **löschte den Merker auf
dem Gerät**, obwohl nichts geschrieben worden war. Mit 401 greift dort der
Zweig, der den Text behält. Eine Umleitung wäre für diesen Aufrufer ohnehin
falsch: Er navigiert nicht, er schreibt im Hintergrund.

**Die Schranke lockert das nicht.** `x-sveltekit-action` entscheidet nur über
die Verpackung; wer den Kopf von aussen setzt, bekommt dieselbe Absage in JSON
statt in HTML. Genau das prüfen die Tests.

## Drei Formen für den Versand

Alle drei erzeugen die Zugänge in **einem** Zug — jeder Code existiert nur im
Augenblick seiner Entstehung (NFR-5), und einzelne Aufrufe machten die vorigen
ungültig.

- **Versandpaket als ZIP** — eine ZIP-Datei mit lauter Einzeldokumenten: die
  Traktandenliste einmal, dazu je ein persönliches QR-Blatt, dazu eine
  `Versandliste.csv`. Für den Weg über eine Dokumentenablage, aus der jeder
  Eigentümer den Verweis auf **seine** Datei bekommt. Die Traktandenliste liegt
  einmal darin und nicht vierzehnmal: Sie ist für alle dieselbe, ein Verweis
  genügt für alle — sonst zöge eine berichtigte Liste vierzehn neue
  Zugangscodes nach sich, für nichts.
- **Alle Karten in einer Datei** — ein PDF, eine Seite je Person, zum Ausdrucken
  und Kuvertieren.
- **Versandsatz je Eigentümer** — Traktandenliste und persönliche Karte
  hintereinander, als ein PDF.

Das Archiv entsteht im Kern (`src/lib/domain/archiv.ts`): reine Byte-Arithmetik
ohne Verdichtung, weil PDF-Dateien bereits verdichtet sind und ein zweiter
Durchgang nur eine Abhängigkeit ins Haus brächte. Die Dateinamen schreiben
Umlaute aus («Müller» → `Mueller`) und werden eindeutig gemacht, bevor sie ins
Archiv gehen: Zwei gleichnamige Einträge wären je nach Entpacker eine Datei, und
dann fehlte einem Eigentümer seine Karte, ohne dass es auffiele.

Die Versandliste führt neben den stimmberechtigten Parteien auch die
**Mitberechtigten** gemeinschaftlicher Zeilen — je unter ihrer Hülle. Die Spalte
`Rolle` sagt, wer wer ist und warum bei jemandem keine Datei steht («keine
E-Mail-Adresse erfasst», «Zustellung an die gemeldete Adresse», «im Archiv,
nicht angeschrieben»). Nach
Wermelinger, Rz. 50 ad Art. 712n, ist jeder Mitberechtigte einzeln einzuladen; ihre Sendung enthält die
Traktandenliste und **keine** Zugangskarte — die geht an die Zeile, die die
Stimme hält. Trägt diese Zeile selbst keine Adresse, geht sie an die vertretende
Person.

Die Versandliste trägt **keinen** Zugangscode: Sie geht durch mehr Hände als die
Karten selbst — in eine Ablage, in eine Tabellenkalkulation, in einen
Serienbrief. Ihre E-Mail-Adressen kommen als einziges aus den **lebenden**
Stammdaten und nicht aus der Momentaufnahme: Die Stimmkraft ist die vom Tag der
Freigabe (AD-3), die Adresse ist die von heute.

## Regelfall und Ausnahme beim Zugang

**Regelfall:** Der QR auf der persönlichen Karte. Scannen, fertig.

**Ausnahme:** Er funktioniert nicht — Karte vergessen, Kamera zu alt, Papier
zerknittert. Dafür gibt die Sitzungsleitung in der Anwesenheitssicht einen
**kurzen Code** aus: acht Zeichen in zwei Gruppen, vorlesbar, fünfzehn Minuten
gültig, **einmal** einlösbar. Die Person tippt ihn unter `/z` ein.

Drei Eigenschaften, die zusammengehören:

- **Kurz, weil er vorgelesen wird.** Zwanzig Zeichen vor einem Saal voller Leute
  sind unbrauchbar. Acht Zeichen aus 29 ergeben rund 39 Bit — bei fünfzehn
  Minuten und einmaliger Verwendung ist Raten aussichtslos.
- **Er entwertet die Karte nicht.** Wer sie fünf Minuten später doch in der
  Tasche findet, soll sie benutzen können. Der Ausgabecode ist ein zweiter Weg
  zum selben Zugang, kein Ersatz.
- **Er wird beim Einlösen verbraucht.** Vorgelesen im Saal hört ihn jeder; ein
  zweites Gerät soll ihn nicht auch noch einlösen können.

### Ein Gerät je Zugang

Zu einem Zugang ist höchstens **ein** Gerät angemeldet. Ein zweiter Versuch mit
dem Kartencode wird abgewiesen und verdrängt das erste Gerät **nicht**. Beendet
wird eine Sitzung nur durch die Person selbst («Auf diesem Gerät abmelden») oder
durch die Sitzungsleitung («Zugang freigeben»).

**Warum nicht «das letzte Gerät gewinnt».** Der Code steht im Klartext auf der
Karte; wer sie abfotografiert, hat ihn. Gegen einen entwendeten Code schützt
keine Sitzungsregel — wohl aber gegen das *stille* Übernehmen. Verdrängte das
zweite Gerät das erste, flöge der Eigentümer wortlos aus seiner Sitzung und
merkte es erst, wenn seine Stimme nicht mehr zählt. Wird der zweite Versuch
abgewiesen, scheitert er sichtbar.

Die beiden Fehlerfälle wiegen ungleich schwer, und danach ist entschieden:
«Erstes Gerät gewinnt» kostet schlimmstenfalls eine Handbewegung der
Sitzungsleitung. «Letztes Gerät gewinnt» kostet schlimmstenfalls eine Stimme,
und niemand bemerkt es.

**Die eine Ausnahme** ist der ausgegebene Code: Ihn hat ein Mensch einer Person
gegeben, die vor ihm stand — dieselbe Vertrauensstufe wie das Erfassen der
Anwesenheit von Hand. Er löst ein angemeldetes Gerät ab, und das abgelöste
erfährt beim nächsten Aufruf, warum.

Jedes Ende trägt seinen Grund: `abgelaufen`, `abgemeldet`, `freigegeben`,
`ersetzt`, `geschlossen`. Ohne ihn liesse sich später nicht unterscheiden, ob
jemand von selbst ging, ausgesperrt wurde oder nur die Zeit ablief — und genau
das ist im Streitfall die Frage. Die Anwesenheitssicht zeigt dazu eine grobe
Gerätebezeichnung («iPhone · Safari, seit 19:12»), nie die Browserkennung
selbst: Ein angemeldetes iPhone passt zu «mein Akku war leer», ein leeres Feld
nicht.
- `/e/<merkmal>` — der QR auf der Leinwand. Für alle derselbe und deshalb **kein**
  Zugangsmerkmal: Er führt zu einem Formular, nicht in die Versammlung. Er bietet
  zuerst die Code-Eingabe an — wer seine Karte dabeihat, ist damit am Ziel — und
  erst danach die Meldung ohne Karte. Dort tippt die Person ihren Namen; eine
  Auswahlliste zeigte jedem, der die Adresse hat, sämtliche Eigentümer der
  Gemeinschaft.

## Wie eine Abstimmung abläuft

**Der Durchgang ist die Einheit, nicht das Traktandum.** Zu einem Traktandum
kann mehrmals abgestimmt werden — nach einem Verfahrensfehler, nach einer
Wortmeldung, nach einer Klärung. Jeder Durchgang bleibt stehen, der frühere wird
mit Begründung als überholt vermerkt und nie gelöscht (AD-5). Hinge das Ergebnis
am Traktandum, müsste eine Neuabstimmung das alte überschreiben, und die Frage
«was stand vorher?» wäre nicht mehr zu beantworten — ausgerechnet die Frage, mit
der eine Anfechtung beginnt.

Beim Schliessen friert der Durchgang seine Eingaben ein: das
Mehrheitserfordernis, wie es bei der Freigabe galt (AD-4), und den Stand dieses
Augenblicks, also Anwesenheit, Vollmachten und Ausstand (AD-16).

**Bei der Handzählung ist dieser Augenblick das Zählen, nicht das Schliessen**
(Migration 156, Befund S5 vom 09.10.2026). Einzelstimmen werden über die Dauer
des Durchgangs gesammelt, gezählte Hände in einem Augenblick. `erfasseSummen`
hält deshalb Anwesenheit, Vollmachten, Ausstand und Betroffene mit den Zahlen
fest (`voting_round.tally_stand_json`), prüft die Zahlen dagegen, und das
Schliessen übernimmt genau diesen Stand. Bis dahin prüfte die Erfassung gegen
den Stand beim Zählen und das Schliessen gegen den beim Schliessen; ging
dazwischen jemand, warf das Schliessen «mehr Stimmen als Stimmberechtigte», und
mit ihm der Schluss der Versammlung. Verworfen wurde, die Handzählung bei jeder
Änderung der Anwesenheit zurückzunehmen: Das hätte jeden Schreibweg der
Anwesenheit an die Handzählung gebunden, die Leitung im Saal neu zählen lassen,
obwohl schon abgestimmt war, und der Schluss der Versammlung hätte den
Durchgang danach ohne Stimmen geschlossen. Die Universalversammlung prüft
Weggänge weiter für sich (`universalAmSchluss`).

**Beim Verkünden schreibt er das Ergebnis fest** (seit 25.09.2026, Migration
123). Produktentscheid 25.09.2026: «nach jeder Abstimmung [soll] das bereits
abgestimmte nicht mehr verändert werden können (Momentaufnahme).» Bis dahin
wurde das Ergebnis aus den eingefrorenen Eingaben gerechnet, sooft es gebraucht
wurde, mit dem Code des jeweiligen Tages. Die Begründung war, ein zusätzlich
gespeichertes Ergebnis wäre eine zweite Wahrheit. Die Kehrseite zeigte sich an
`6b820d5`: Eine geänderte Zählregel änderte rückwirkend verkündete Ergebnisse
und Protokolle.

Eine zweite Wahrheit entsteht trotzdem nicht, weil nach dem Verkünden nicht
mehr gerechnet wird. Die Auszählung steht einmal, in `voting_round.result_json`,
und `ergebnisIn` gibt sie zurück; Protokoll, Auswertung, Rückkommen und Wand
lesen alle darüber. Gerechnet wird nur noch, solange nicht verkündet ist (ein
offener Stichentscheid braucht die Rechnung für die Prüfung des Gleichstands),
und für Durchgänge von vor dem 25.09.2026, die nicht nachträglich
festgeschrieben werden. Die Datenbank weist jede Änderung an einer
Festschreibung ab. Wie ein Ergebnis von heute mit dem Code von morgen lesbar
bleibt, steht in `domain/festschreibung.ts`.

Festgeschrieben sind Annahme, Zahlen, Befunde und Hinweise. Der Satz, der
daraus zur Anzeige gebildet wird (`ergebnisInWorten`), darf seinen Wortlaut
ändern.

### Fünf Eimer, nie vier

Die Auszählung führt getrennt: **ja**, **nein**, **Enthaltung**, **anwesend ohne
Abgabe**, **nicht anwesend**. Das Vorgängerprojekt setzte fehlende Stimmen still
auf «Enthaltung»; weil eine Enthaltung beim einfachen Mehr wie ein Nein wirkt,
entschied diese Voreinstellung über Annahme und Ablehnung. Welche Eimer in die
Bezugsgrösse zählen, bestimmt allein die Basis des Erfordernisses — bei
ZGB Art. 649b Abs. 2 gilt das einfache Mehr, und trotzdem zählen die Abwesenden
mit.

Die Kopfstimme sitzt an der **Person**, nicht an der Einheit (AD-2). Haben die
Einheiten einer Partei bei dieser Zählweise verschieden gestimmt, bleibt die
eine Kopfstimme ungebildet und ein Hinweis nennt die Partei: Aus «ja» und «nein»
eine Richtung zu wählen entschiede über die Abstimmung.

### Wer was sieht

| | offen | geschlossen | geschlossen, Gleichstand offen |
|---|---|---|---|
| Sitzungsleitung | Fortschritt | Ergebnis | Gleichstand und der Weg dazu |
| Leinwand | Fortschritt | Ergebnis | dass der Entscheid aussteht (`wartesatz` im Strom) |
| Telefon | Frage und Schaltflächen | Ergebnis | Frage geschlossen |

Seit dem Produktentscheid vom 21.08.2026 verkündet das Schliessen selbst
(`versammlungsstand.ts`, «Geschlossen heisst sichtbar»); ohne Ergebnis bleibt
ein geschlossener Durchgang nur beim offenen Gleichstand oder wenn keine Auszählung
vorliegt (Kenntnisnahme, Abbruch, ohne Auszählung beendet).

Der Fortschritt sind zwei Zahlen und sonst nichts. Der Typ `Fortschritt` trägt
kein Feld für Ja, Nein oder Enthaltung — was der Typ nicht kennt, kann keine
Sicht versehentlich anzeigen, und wer den Zwischenstand kennt, wählt den
Zeitpunkt des Schliessens danach (FR-37).

### Die einfache Betriebsart

Dort erfasst die Sitzungsleitung je Partei, **nie eine Summe**: Eine eingetippte
Summe liesse sich weder gegen die Stimmkraft prüfen noch nach Wertquoten
auswerten, weil dafür bekannt sein muss, wer wie gestimmt hat. Vorbelegt ist
**Nichtabgabe**, nicht Enthaltung. Die Telefone zeigen die Frage, aber keine
Schaltflächen — zwei Wege für dieselbe Stimme wären zwei Stimmen.

### Spontantraktanden

Über ein nicht angekündigtes Geschäft lässt Votum einen Beschluss nur zu, wenn
das Reglement es ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m
Abs. 2) oder die Versammlung als Universalversammlung tagt. Die
Angabe zum Reglement hinterlegt die Gemeinschaft einmal mit Fundstelle (Migration 126); sie
wird bei der Freigabe in die Momentaufnahme eingefroren und beim Aufnehmen am
Traktandum vermerkt (`agenda_item.unannounced_basis`, Migration 127). Die
Schranke aus Migration 046 lässt ein neues Geschäft als Abstimmung nur mit
diesem Vermerk zu. Ohne ihn führt, wer während der Sitzung etwas aufnimmt, es
als Folgeantrag zu einem angekündigten Antrag, in dessen Kern es liegt, oder als
Kenntnisnahme; der Beschluss gehört dann auf die nächste Traktandenliste
(`nimmTraktandumAuf`). Bis zum 29.09.2026 stand hier, darüber werde «auch nicht
mit Zustimmung der Versammlung» beschlossen, und davor, eine vorher genehmigte
Erweiterung der Traktandenliste genüge; beides war falsch.

**Die Universalversammlung** (Migration 128). Wer als da gilt, stellt die
Gemeinschaft ein (Migration 126, Vorgabe «persönlich»), eingefroren bei der
Freigabe wie die Angabe zum Reglement. `server/universal.ts` liest je Partei der
Momentaufnahme, ob und wie sie da ist: selbst, als Organ (zählt als selbst da;
Mitberechtigte seit dem 30.09.2026 nicht mehr), mit gewöhnlicher oder gesetzlicher Vollmacht (zählt nur
unter «vertreten») und ob die Vollmacht die Sitzungsleitung hält
(`meeting_chair_holder`, von der Leitung angekreuzt, seit Migration 129 mit
Zeit: beendet statt gelöscht). Die Regel steht im Kern
(`universalparteien`, `pruefeUniversalversammlung`, `universalgruende`). Beim
Aufnehmen vermerkt `nimmTraktandumAuf` `universal`, wenn das Reglement nicht
schon trägt und im Moment alle da sind; ein Auslöser prüft den Vermerk gegen
die Variante der Momentaufnahme. Beim Eröffnen verlangt `pruefeDurchgangsfreigabe`
dieselbe Vollzähligkeit, die Bestätigung der Leitung und dass zum Geschäft nie
widersprochen wurde, und nennt alle fehlenden Gründe zugleich. Der Durchgang
trägt Variante und Bestätigung (`voting_round.universal_*`). **Der Widerspruch
sitzt am Geschäft, nicht am Durchgang** (Migration 129, `universal_objection`,
einer je Geschäft): Er kommt vor dem Eröffnen oder während der Abstimmung, und
eine Stelle für beide verhindert, dass das Eröffnen die eine prüft und die
Leitungsseite die andere. `round_id` ist leer vor dem Eröffnen. Gelesen wird er
überall über `leseWidersprueche`; Eröffnen und Widerspruch vor dem Eröffnen
sperren dieselbe Zeile des Geschäfts, sonst gingen beide gleichzeitig durch, und
fragen mit `rueckkommenZuEroeffnen` dasselbe: Nach einem beschlossenen Rückkommen
hat der Widerspruch vor dem Eröffnen wieder seinen Ort.
Beim Schliessen stellt `universalAmSchluss` fest,
ob jemand ohne Stimme gegangen ist (bei der Handzählung: überhaupt gegangen)
oder widersprochen hat; dann schreibt die Festschreibung **«kein Beschluss»**
(`Auszaehlung.keinBeschluss`, `angenommen = false`) und `ergebnislage` liefert
`kein_beschluss`. Das ist der vierte Ergebniszustand neben angenommen,
abgelehnt und offen: Eine Ablehnung wäre selbst ein Beschluss. Wer eine Bilanz
aus zwei Wörtern zieht, nimmt `beschlossen()`, das offen und «kein Beschluss»
auf `null` legt. Den Stand fürs Protokoll hält `universal_json` fest.
Als «abgestimmt» zählt nur eine Stimme, die abgegeben wurde, während die Partei
nach der Einstellung als da galt (`leseGueltigAbgestimmt`). Vollmachten gelten
dabei, wie sie bei der Stimmabgabe wirksam waren. Vertreter der Leitung, wenn
sie bei der Stimmabgabe **oder** beim Schliessen angekreuzt sind: Die Liste
hält eine Tatsache fest, und ein nachträgliches Ankreuzen ist meist eine
berichtigte Lücke; nach dem Zeitpunkt allein wäre es ein Umgehungsweg
(Fachprüfung Block 4a, Frage 3). Nach einem Weggang zählt der Durchgang beim Eröffnen nicht als
«schon abgestimmt»: Es darf neu eröffnet werden, und der Durchgang ohne
Beschluss wird dabei überholt (`neueroeffnung`, mit Grund und Verlaufseintrag;
Migration 130), so dass es nie zwei geltende Durchgänge zum selben Geschäft
gibt. Die eigene Art unterscheidet ihn von einer von der Leitung angesetzten
Neuabstimmung, die `korrektur` heisst. Nach einem
Widerspruch weder das noch eine Neuabstimmung (`fruehererWiderspruch`).

**Verschieben bleibt während der Sitzung möglich, Ändern nicht.** Titel und
Antragswortlaut stehen in versandten Einladungen; die Reihenfolge steht dort als
Vorschlag. Sie zu ändern ist ein Ordnungsentscheid und gehört in den Verlauf,
nicht in eine Sperre — wer ihn verbietet, zwingt die Sitzungsleitung dazu, ihn
ohne Spur zu treffen. Das **Mehrheitserfordernis** lässt sich bis zur Abstimmung
setzen: Es ist die rechtliche Einschätzung der Sitzungsleitung und wird oft
erst im Saal getroffen. Die Einladung nennt es aber, und seit dem 06.10.2026
ist dieses Mehr die Untergrenze: im Saal nur strenger, vor Beginn milder nur
mit neuem Versand (Migration 144, `domain/einladungsmehr.ts`). Gesperrt wird es
ganz, wenn dazu abgestimmt wurde und der Durchgang gilt.

## Was über den Ereignisstrom fliesst

Ausschliesslich Zustände und Summen (AD-11): Versammlungszustand, Zahl der
Anwesenden, Kopfstimmen, Wertquoten, Kennung des aufgerufenen Traktandums. Nie
ein Name, nie ein Stimmverhalten. Der Typ `Stromnachricht` ist ausdrücklich
getippt und nicht offen — sonst rutschte irgendwann ein Name durch, ohne dass es
der Stelle anzusehen wäre.

Server-Sent-Events statt WebSocket: Der Fluss geht in eine Richtung, es braucht
keine Bibliothek, und der Browser verbindet nach einem Abbruch von selbst neu.
Genau das braucht ein Notebook im Saal-WLAN.

## Ohne Beschlussfähigkeit keine verbindliche Abstimmung

Hier stand bis zum 17.09.2026 «Gewarnt, nicht gesperrt»: Bei fehlender
Beschlussfähigkeit verlange das Aufrufen eine Bestätigung mit Vermerk. **Gebaut
war das nie.** `pruefeAbstimmungsfreigabe` und `schreibeUebergehung` hatten keinen
Aufrufer, und `oeffneAbstimmung` fragte gar nicht nach der Beschlussfähigkeit. Eine
nicht beschlussfähige Versammlung konnte also ohne Spur beschliessen. Gefunden hat
das der Abgleich mit der Zweitprüfung der juristischen Gegenlesung (Ä-18).

Jetzt sperrt `oeffneAbstimmung` (Produktentscheid 17.09.2026). Gerechnet wird mit
derselben Übersicht und derselben Kernfunktion wie auf der Leitungsseite, geprüft
mit `verlangeBeschlussfaehigkeit`. Einen Übersteuerungsweg an der Abstimmung gibt
es nicht: Er belegte die Willentlichkeit, mit der Wermelinger (Rz. 33 ad
Art. 712p) eine schwere Verletzung nichtig werden lässt. Der Ausweg ist die
Tatsache, eine berichtigte Anwesenheit, und jede Erfassung steht mit Uhrzeit im
Verlauf. **Daneben steht seit dem 01.10.2026 der Beschluss von Hand** (Plan
`docs/plan-beschluss-von-hand-2026-09-30.md`; `docs/freigabe.md`, Zeile «Gebaut:
Beschluss von Hand»): Er hält fest, was der Saal ohne Votum beschlossen hat,
schreibt die übergangenen Sperren mit Kennung und Satz in den Verlauf und zeigt
bei fehlender Beschlussfähigkeit die Rechtsfolge vor dem Knopf. Die Abstimmung
selbst lässt er nicht zu; die Sperre gilt unverändert.

**Seit E2 (11.11.2026) trägt er einen Grund** (Entscheid 0046, A7). Vorgewählt
ist der Notweg wie bisher. Der zweite Grund, «Eingewendete Bestimmung», ist kein
Notweg: Im Saal wird eine nicht hinterlegte Bestimmung eingewendet, die klar
gilt, gültig eingeführt und in jeder Hinsicht strenger ist als das Gesetz, und
der Antrag erreicht das Gesetz, sie aber nicht. Dann hält die Leitung
«abgelehnt» fest; Pflicht sind die Bestimmung (Fundstelle und Wortlaut) und wie
sie eingeführt wurde. Beides steht in der Festschreibung
(`Auszaehlung.vonHand.einwand`), im Verlauf, im Siegelpaket und im Protokoll
(`einwandSatz`, mit dem Ergebnis nach dem Gesetz und dem Rückweg, ohne den Weg).
Angeboten wird der Grund nur an den Karten mit vereinbarter Ordnung ohne
angewandte Regel, in jeder Fassung (`einwandLageAm`; das Verhalten liest
`einwandLageDesErfordernisses` aus dem Knoten, weil das Traktandum es nicht
speichert); anderswo weist der Kern ihn ab (`einwand_hier_nicht`). Ab Fassung
2026-11-11 trägt die Karte dazu den Abschnitt «Wird im Saal eine Bestimmung
eingewendet» (`einwandImSaal`), und die Leitungsseite zeigt über der Maske einen
Hinweis, am Abend über dem Notweg-Kasten. Der Grund verlangt, dass am
Traktandum keine Abstimmung offen ist und das geltende Ergebnis «angenommen» ist
(`einwand_offen`, `einwand_ohne_annahme`): Das Protokoll sagt, der Antrag hätte
das gesetzliche Mehr erreicht. Unter einem von der Leitung gesetzten Mehr gilt
er nicht (Quelle des Erfordernisses). Deshalb öffnet er die Maske am gemeinsamen
Abend ohne Notweg, ohne den Vermerk «am Abend vorbei» (`meeting.day.bypassed`),
und stellt den aufgerufenen Punkt nicht zurück, damit Wand und Steuerung des
Abends bleiben, wo sie sind.

**Konsultativ abstimmen geht** (Migration 158, `domain/konsultativ.ts`; Ä-18,
Auftrag H7 Teil B). Fehlt die Beschlussfähigkeit, kann die Leitung einen
Durchgang als konsultativ freigeben: Abgestimmt und gezählt wird wie sonst, beim
Schliessen steht «kein Beschluss» mit dem Grund `konsultativ` in der Auszählung,
also nirgends ein Beschluss, und ein Rückkommen darauf gibt es nicht. Die Sperre
der verbindlichen Abstimmung bleibt, wie sie ist; umgekehrt weist das Eröffnen
«konsultativ» ab, sobald die Versammlung beschlussfähig ist, und ebenso, wo zum
Geschäft schon ein Beschluss gilt (auch einer von Hand), unter der
Universalversammlung und unter einem Rückkommen. An der Sperre von L7 gibt es
keinen konsultativen Durchgang (Entscheid 0043): Die Versammlung ist dort
beschlussfähig, nur nicht ohne die Personen im Ausstand, und das Eröffnen weist
«konsultativ» mit der Absage zu L7 ab. Getragen ist das von
Rz. 30 ad Art. 712p: Die Diskussion bleibt zulässig, «solange keine Beschlüsse
gefasst werden». Wird die Versammlung danach beschlussfähig, überholt der
verbindliche Durchgang den konsultativen ohne Rückkommen, und das Protokoll nennt
den konsultativen mit seinen Zahlen.

**Danach ist das Geschäft offen** (Produktentscheid 14.10.2026, Auftrag H7
Teil D; `entscheidetDasGeschaeft` in `domain/konsultativ.ts`). Ein geschlossener
konsultativer Durchgang zählt dort nicht als «abgestimmt», wo daran hängt, was
noch geht: Erfordernis (`erfordernisAenderbar`), Ausstand, Betroffene, Gegen-
und Folgeantrag (`offeneFolgeantraegeIn`), Rückzug samt Rücknahme
(`ziehAntragZurueck`, `nimmRueckzugZurueck`, Migration 159 für die Schranke der
Datenbank) und die Übernahme in die Folgeversammlung beim Vertagen
(`uebertrageOffeneTraktanden`). Leitungsseite (auch der Hinweis beim
Schliessen), Erfordernisseite, Abendseite und Abendtafel fragen dasselbe; die
SQL-Fassungen tragen `NOT consultative`. Bewusst unverändert: die Übersicht,
die geschlossene Durchgänge nur für «Zahlen vorläufig» zählt, und das Verschieben
(«behandelt» in `traktanden.ts`), wo es um die Reihenfolge geht. Noch nicht
angeglichen: Weisungen (`weisung.ts`, Seite «Weisungen») zählen einen
konsultativen Durchgang als abgestimmt; neue Weisungen lassen sich danach nicht
mehr erfassen (offen in `docs/freigabe.md`). Der konsultative
Durchgang behält sein Erfordernis seit dem Eröffnen eingefroren, der nächste
nimmt das dann geltende. Nach einem Rückzug nennt das Protokoll den Rückzug mit
den konsultativen Zahlen. Ein offener konsultativer Durchgang sperrt wie jeder
offene. Nicht berührt ist ein Weggang unter der Universalversammlung: Dort zählt
das Geschäft weiter als abgestimmt, ob es offen sein soll, ist nicht
entschieden.

Bei der Anmeldung trägt die frühere Überlegung weiter, eine Sperre im Saal wäre
dort ein Ausfall: Die lokale Anmeldung bleibt offen, auch wenn Authentik
erreichbar ist. Fiele der Dienst mitten in der Versammlung aus,
käme sonst niemand mehr herein (AD-9).
