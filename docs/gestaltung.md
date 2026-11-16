---
title: Gestaltung der Seiten
description: Das Muster für ruhige, verständliche Seiten — und wie man es auf eine weitere Seite anwendet
date: 2026-08-11
---

# Gestaltung der Seiten

Dieses Kapitel richtet sich an die Entwicklung, nicht an die Bedienung. Es hält
fest, wie eine Seite dieser Anwendung aufgebaut ist — damit die nächste Seite
nicht wieder anders aussieht.

Der Anlass: Am 11.08.2026 wurde die Versammlungsansicht als «unruhig und
unaufgeräumt» gemeldet. Nachgemessen stimmte das, und zwar in Zahlen:

| Gemessen | Vorher | Nachher |
|---|---|---|
| Seite in Bildschirmen (1440 × 900) | 2.40 | 1.52 |
| Inhalt ohne Seitenleiste | 2090 px | 1164 px |
| Höhen der Karten nebeneinander | 215 / 197 / 314 px | 253 / 253 px |
| Karten in einer Reihe | 2 von 3 | alle |
| Knöpfe auf der Seite | 4 | 1 |
| Wörter im Inhalt | 295 | 233 |

## Die sechs Regeln

**1. Eine Seite beantwortet eine Frage.** Wer sie öffnet, will etwas Bestimmtes
— sehen, wie es steht, oder etwas eintragen. Beides zugleich auszubreiten
erzeugt die Unruhe: Auf der Versammlungsseite stand «Betriebsart» als Karte
oben *und* als Auswahl im Formular unten, mit zwei verschiedenen Knöpfen. Steht
die Versammlung im Entwurf, führt jetzt das Formular; ab der Freigabe, wenn
nichts mehr zu erfassen ist, führen die Karten.

**2. Überschrift ist eine Frage, Antwort ist ein Satz.** «Wie wird abgestimmt?»
statt «Betriebsart». «Auf Papier.» statt «Unterschriftenliste auf Papier,
Stimmen erfasst durch die Sitzungsleitung». Wer die Frage liest, weiss, ob ihn
der Kasten angeht; wer die Antwort liest, ist fertig.

**3. Der Fachbegriff bleibt — in Klammern.** «Das erste Treffen
(Erstversammlung)». Der Klartext, damit man versteht, was man wählt; der
Fachbegriff, damit man ihn im Protokoll, im Handbuch und im Gesetz wiederfindet.
Nie das eine ohne das andere.

**4. Der Hintergrund wartet zugeklappt.** Rechtsgrundlagen, Randfälle und
Begründungen stehen hinter **«Was heisst das?»**. Sie verschwinden nicht — die
Fundstelle ist im Streitfall das Wichtigste auf der Seite —, aber sie stehen
niemandem im Weg, der sie gerade nicht braucht.

**5. Karten in einer Reihe sind gleich hoch.** Verschiedene Höhen lesen sich
wie ein Fehler, und die Knöpfe liegen dann auf verschiedenen Linien. Die Karte
füllt ihre Rasterzelle und schiebt ihren Fuss nach unten.

**6. Ein Speicherknopf pro Seite.** Er steht zuunterst, nach allem, was zu ihm
gehört. Felder, die in eigenen Kästen liegen, gehören über das HTML-Attribut
`form` trotzdem zum selben Formular. Ausgenommen sind Handlungen, die sofort
etwas tun und kein Eintrag sind — «Ablösen» einer Datei etwa, oder das Eröffnen
der Versammlung.

**7. Nichts geht still verloren.** Wo ein Formular steht, wacht
`Ungespeichert.svelte` darüber: Sobald etwas geändert und nicht gespeichert ist,
erscheint neben dem Knopf «Noch nicht gespeichert.», und wer die Seite verlässt,
wird gefragt. Gemessen am 11.08.2026: Vorher genügte ein Klick auf «Als
Nächstes», und die Eingabe war weg — ohne Dialog, ohne Meldung, ohne Spur.

**Kein automatisches Speichern.** Es wäre hier falsch: Jede Änderung schreibt
einen Verlaufseintrag, und bei jedem Tastendruck zu speichern hiesse, den
Verlauf mit «Ort: P», «Ort: Pr», «Ort: Prü» zu füllen und ihn als Beleg zu
zerstören. Dazu sind Ort und Datum Pflichtfelder — ein Zwischenstand ohne Ort
ist keine gültige Versammlung. Und «Abbrechen» verlöre seinen Sinn.

**8. Widersprüche zeigen, nicht sperren.** Wo zwei Angaben einander
widersprechen und es dafür einen zulässigen Grund geben kann, bekommt die Karte
eine `warnung`: sichtbar, in Warnfarbe, über der Handlung. Kein Fehler, keine
Sperre — die Entscheidung bleibt bei der Sitzungsleitung. Beispiel: Datum und
Ort einer Versammlung, die nicht zu der gemeinsamen Versammlung passen, der
sie zugeordnet ist.

## Die Bausteine

| Baustein | Wo | Wofür |
|---|---|---|
| `Karte.svelte` | `src/lib/components/` | Frage, Antwort, zugeklappte Erklärung, Fuss mit der Handlung |
| `.kacheln` | `src/app.css` | Das Raster. `auto-fit`, gleich hohe Zellen |
| `--kachel-min` | `src/app.css` | Wie schmal eine Karte werden darf, bevor eine Spalte wegfällt |
| `klartext.ts` | `src/lib/domain/` | Die Sätze selbst — prüfbar, überall gleich |
| `.suchleiste` | `src/app.css` | Suchfeld und Trefferzähler für lange Listen |
| `Ungespeichert.svelte` | `src/lib/components/` | Wacht über offene Eingaben, fragt vor dem Verlassen |
| `Abendregister.svelte` | `src/lib/components/` | Dasselbe Thema, anderer Gegenstand — Reiter mit Stand |
| `register.ts` | `src/lib/domain/` | Rechnet die Reiter: Weg, Herkunft, Häkchen |
| `.seitenstapel` | `src/app.css` | Der Stapel: Abschnitte über die volle Bahn, in fester Reihenfolge |
| `.seitenstapel > .abschnitt` | `src/app.css` | Ein Abschnitt des Stapels. Der Elternteil gehört zum Selektor, `.abschnitt` allein ist anderweitig vergeben |
| `.arbeitsflaeche` | `src/app.css` | Zwei Spalten: Bestand links, Eintragen rechts. **Noch auf einer Seite** (`eigentuemer`), dort begründet: Der Bestand wird beim Eintragen gebraucht |
| `--arbeitsspalte-min` | `src/app.css` | Wie schmal eine Spalte werden darf, bevor die zweite wegfällt |
| `.kachel` | `src/app.css` | Ein Erfassungsblock: Rahmen, Fläche, Überschrift, Schrittzahl |
| `Sortierkopf.svelte` | `src/lib/components/` | Sortierbarer Spaltenkopf mit `aria-sort` |
| `tabellensortierung.ts` | `src/lib/domain/` | Wie sortiert wird: Zahlen, Text, Leeres, drei Zustände |
| `Leistenpunkt.warnung` | `src/lib/components/seitenleiste.ts` | «!» und ein Satz an der Leiste, wo etwas fehlt |
| `Rueckfrage.svelte` | `src/lib/components/` | Schaltfläche, die vor dem Auslösen fragt — im Stil der Seite |
| `Rueckfragefenster.svelte` | `src/lib/components/` | Dieselbe Frage, wenn erst der **Server** sie beantworten konnte — «mit ihr gehen 2 Quotenwerte verloren» |
| `Suchauswahl.svelte` | `src/lib/components/` | Auswahlfeld, in dem man tippen kann — das Suchfeld erscheint ab neun Einträgen |
| `auswahl.ts` | `src/lib/` | Der Eintragstyp eines Auswahlfelds |
| `domain/listensuche.ts` | `src/lib/` | Suchen, Kürzen und die Suchschwelle: `SUCHSCHWELLE`, `brauchtSuchfeld` |
| `.rueckfrage` | `app.css` | Der Rahmen beider Fenster: Breite, Rand, Abdunklung, die zwei Knöpfe |
| `Zeichen.svelte`, `zeichen.ts` | `src/lib/components/` | Die sechs Zeichen an den Handlungen |
| `.handlung` | `src/app.css` | Eine Handlung in einer Liste: Zeichen, Beschriftung, Ton |
| `Meldung.svelte` | `src/lib/components/` | Absage oder Bestätigung aus `form` — mit Knopf zum Wegdrücken; eine Absage holt sich selbst ins Bild |
| `absenden()` | `src/lib/absenden.ts` | Ein schreibendes Formular abschicken, ohne die Seite neu zu laden — mit Fokusgriff, Doppelklicksperre und Ausfallmeldung |
| `data-fokus` | Attribut | Wohin der Fokus nach dem Absenden gehört. Am Absendeknopf, bei einem Erfassungsformular am ersten Feld |
| `data-vorgabe` | Attribut | Was Enter in diesem Formular auslöst. Am **ersten** Absendeknopf; `keiner` verlangt zusätzlich `disabled` |
| `nachziehen()` | `src/lib/nachziehen.ts` | Daten am Ereignisstrom nachladen, ohne einen Seitenwechsel abzureissen |

### Karte

```svelte
<Karte titel="Wie wird abgestimmt?" antwort="Auf Papier." zusatz="Die Leitung trägt die Stimmen ein.">
	{#snippet erklaerung()}
		<p>Wer da ist, unterschreibt auf einer Liste …</p>
	{/snippet}
	{#snippet fuss()}
		<button type="submit" form="angaben">Ändern</button>
	{/snippet}
</Karte>
```

### Rückfrage vor einer Handlung

```svelte
<form method="POST" action="?/verlassen" use:enhance={…}>
	<input type="hidden" name="partei" value={id} />
	<Rueckfrage
		beschriftung="Verlassen"
		zeichen="hinaus"
		ton="warnung"
		frage="{name} als gegangen erfassen?"
		folge="Kopfstimmen und Wertquoten dieser Partei zählen ab sofort nicht mehr mit."
		bestaetigen="Als gegangen erfassen"
	/>
</form>
```

**Nie `confirm()`.** Nicht des Aussehens wegen, sondern weil es auf einem
Formular mit `use:enhance` **nicht abbricht**: SvelteKits Zuhörer prüft
`event.defaultPrevented` nicht, sondern ruft selbst `preventDefault()` und
schickt anschliessend ab. Gemeldet am 20.08.2026 («wenn man abbruch klickte,
wurde sie dennoch Ok gemeldet»), an vier Stellen gleichzeitig wirkungslos.
`Rueckfrage.svelte` fängt den **Klick** ab — ein Klick, dessen Vorgabe
verhindert wird, löst gar kein `submit` aus. Der Wächter
`versammlung/keine-browserabfrage` (in `scripts/eslint/felder.mjs`) hält
die Browserabfrage fern; Ausnahme ist `Ungespeichert.svelte`, wo beim Verlassen
der Seite gefragt wird und der Browser auf niemanden wartet.

**Die Frage nennt Ross und Reiter.** «Sind Sie sicher?» beantwortet niemand
anders als mit Ja. «Erbengemeinschaft Kunz — 0.1, 1.1» lässt sich mit der
Person vor einem vergleichen.

**Der Ton sagt, was geschieht:** `gut` fügt hinzu, `warnung` nimmt weg, `fehler`
greift ein, ohne Angabe tut die Handlung niemandem etwas. `gewicht="haupt"`
für den einen Schritt, um den es auf einer Seite geht.

**Die Drehbücher müssen sie beantworten.** Mit `confirm()` genügte in jedem
Skript eine Zeile (`seite.on('dialog', d => d.accept())`); das eigene Fenster
kennt kein `dialog`-Ereignis. Ein Drehbuch, das nur den Auslöser drückt, wartet
danach auf eine Antwort, die nie kommt — `durchspielen.mjs` brach so bei
«Leitung bestätigt die Anwesenheit» ab, und zwar stumm für alle übrigen
Prüfungen. `e2e/rueckfrage.mjs` hängt einen Beobachter ein, der jedes aufgehende
Fenster bestätigt: **ein Aufruf je Seite oder Kontext**, unmittelbar nach dem
Anlegen und vor der ersten Navigation. Wer den Abbruch selbst prüfen will,
bedient das Fenster von Hand und setzt den Beobachter dort nicht ein — beim
Klickfenster über `dialog[open] button.ab`, beim Serverfenster über
`dialog.serverfrage a.ab` (dort ist der Rückweg ein Verweis, damit er auch ohne
JavaScript trägt).

**Die zweite Art fasst der Beobachter nicht an.** Ein `Rueckfragefenster` steht
schon im ausgelieferten HTML offen — es wartet ja nicht auf einen Klick, sondern
zeigt eine Antwort, die der Server gerade gegeben hat. Der Beobachter hätte
«Trotzdem entfernen» gedrückt, bevor das Drehbuch überhaupt gefragt hat; er
schliesst `.serverfrage` deshalb aus (26.08.2026, aus dem Code-Review).

### Eine Rückfrage, die erst der Server beantworten kann

`Rueckfrage.svelte` fängt den Klick ab und fragt sofort — das geht, solange die
Seite alles weiss, was in der Frage steht. Manche Fragen weiss sie nicht: «Mit
ihr gehen 2 Quotenwerte verloren» steht in der Datenbank, nicht auf der Seite.
Dort geht der erste Klick zum Server, der zählt, und die Antwort kommt als
Formularergebnis zurück.

Bis zum 26.08.2026 stand diese zweite Art als **Kachel am Seitenkopf**. Der Auftraggeber
dazu: «Das sieht gequetscht aus. Wäre da ein Modal nicht besser, ohne dass die
Seite top springt? Das wäre dann bei allen Ansichten identisch zu handhaben.»
Beides traf zu — die Kachel lief über die ganze Bahn, und wer unten in einer
langen Tabelle klickte, musste erst hinaufrollen, um die Frage zu lesen.

`Rueckfragefenster.svelte` zeigt sie jetzt im selben Rahmen wie die andere Art.
Drei Dinge gehören dazu:

* **Ohne JavaScript bleibt die Frage stehen.** Das `dialog` wird mit `open`
  ausgeliefert. Dazu gehört `dialog.rueckfrage:not(:modal) { position: static }`
  in `app.css` — ein offenes, nicht-modales `dialog` ist sonst
  `position: absolute` und legt sich **über** den Inhalt, statt ihn zu
  verschieben (nachgemessen).
* **Der Fokus liegt auf der Bestätigung**, wie beim Klickfenster. Zwei gleich
  aussehende Fenster, in denen die Eingabetaste das Gegenteil tut, wären
  schlimmer als zwei verschiedene.
* **Die Klasse `serverfrage`** hält den e2e-Beobachter davon ab, sie
  wegzuklicken — siehe oben.

### Wer am Strom nachzieht, kennt den Seitenwechsel

Eine Seite hört am Ereignisstrom und lädt nach, sobald sich etwas geändert hat.
Ihre Formulare senden zugleich als **echte Navigation**. Beides zusammen ist ein
Rennen: Die eigene Handlung — jemanden einlassen, eine Vollmacht widerrufen —
löst genau den Wechsel aus, auf den die Seite reagiert, und der Datenabruf, den
der Seitenwechsel abreisst, steht als `TypeError: Failed to fetch` in der
Konsole.

Folgenlos ist das nicht: Der Abruf ist umsonst, und ein Wächter, der die Konsole
prüft, meldet einen Lauf als gescheitert, in dem alle Schritte grün waren. Genau
so war `durchspielen.mjs` vom 20. bis 21.08.2026 rot — zweimal je Lauf, in den
Schritten mit dem Einlass.

**Die Leitungsseite hatte den Schutz, die Anwesenheitsseite nicht.** Sie bekam
den Strom später, und die Sperre war eine Zeile in einer Datei statt eines
Bausteins. `nachziehen()` ist jetzt die eine Fassung; `scripts/check-stroeme.mjs`
hält `invalidateAll()` von allen anderen Stellen fern.

### Der Zwischenstand bleibt verborgen — auch vor der Sitzungsleitung

Wer während einer offenen Abstimmung sieht, wie sie steht, kann den Zeitpunkt
des Schliessens danach wählen. Deshalb rechnet die Anwendung die Verteilung erst
beim Schliessen, und der Ereignisstrom trägt nur Zahlen (AD-11).

**In der Erfassungstabelle war das lange nicht durchgehalten.** Über ihr stand
«Wie abgestimmt wurde, ist bis zum Schliessen nicht sichtbar — auch nicht hier»,
und drei Zeilen weiter unten zeigten die Ankreuzfelder genau das. Seit dem
21.08.2026 gilt:

* Was **vom Gerät der Partei** kam, wird gar nicht erst an die Seite geliefert.
  Die Zeile steht leiser da und trägt die Marke «hat selbst gestimmt».
* Wer berichtigen muss, klickt **Stimme ändern** und trägt neu ein — ohne zu
  sehen, was vorher stand. Für das Ergebnis zählt die letzte Zeile (AD-5).
* Was die Sitzungsleitung **selbst erfasst** hat, sieht sie weiterhin: Es ist
  ihre eigene Eingabe, und ohne sie wüsste sie nicht, was angekommen ist.

**Verborgen wird in den Daten, nicht in der Anzeige.** Ein ausgeblendetes Feld
liesse sich aufklappen; was der Server nie sendet, steht auch nicht im HTML.

### Eine Meldung muss weggehen können

```svelte
<Meldung ton="fehler" marke={form}>{form.fehler.nachricht}</Meldung>
```

Gemeldet am 20.08.2026: «Die rote Meldung soll weggedrückt werden können.» Eine
Absage bleibt sonst stehen, bis die Seite neu geladen wird — und während einer
Versammlung lädt niemand neu. Der rote Balken steht dann auch dann noch da, wenn
die Sache längst erledigt ist, und im Saal liest ihn jemand über die Schulter.

**Die `marke` ist nicht schmückendes Beiwerk.** Nach dem Wegdrücken muss die
nächste Meldung wieder erscheinen, auch wenn sie wörtlich dieselbe ist — weil
jemand zweimal auf denselben Knopf gedrückt hat. Am Text lässt sich das nicht
erkennen; `marke={form}` ist bei jeder Antwort des Servers ein neues Objekt.

**Und die Marke wird `$state.raw` abgelegt, nicht `$state`.** `$state` hüllt ein
zugewiesenes Objekt in einen reaktiven Stellvertreter: Aus `weggedrueckt = marke`
wird ein **anderes** Objekt als `marke`, der Vergleich ist für immer wahr, und
der Knopf wirkt nicht. Genau so gebaut und gemessen — Knopf da, Klick
wirkungslos, Meldung blieb stehen.

Der Wächter `versammlung/meldung-als-baustein` hält den rohen Absatz fern, aber
nur für Meldungen aus `form`: Was aus `data` kommt, steht bei jedem Laden neu da, und ein Knopf, der es
bis zum nächsten Laden wegnimmt, verspräche mehr, als er hält.

### Erfolg geht, Absage bleibt

**Erfolgsmeldungen erscheinen unten rechts** und verschwinden nach sechs
Sekunden — oder wenn man sie wegklickt. Sie sind eine Quittung: gelesen,
abgehakt, weg. Über dem Inhalt schoben sie ihn bei jedem Handgriff nach unten,
und in der Sitzungsleitung ist das jeder zweite Klick.

**Absagen bleiben, wo sie sind.** Eine Absage hält auf, nennt einen Weg und muss
stehen, bis jemand ihn geht. Was von selbst verschwindet, taugt dafür nicht.

Für die Anwendung heisst das: `<Meldung ton="gut">` wandert, `fehler` und
`warnung` bleiben. Ohne JavaScript bleibt auch die Quittung an ihrem Platz — der
Server rendert sie ganz normal, erst im Browser zieht sie um.

**Für Prüfschritte:** Wer auf eine Bestätigung wartet, muss die Quittungsecke
mitlesen (`body` statt `main`, oder `.einblender` dazu). Zwei Schritte des
Durchlaufs sind am 21.08.2026 genau daran gescheitert.

### Ein Eingabefeld sieht überall gleich aus

Die Regel gilt für **alles unter `main`** — nicht nur für Formulare, die eine
bestimmte Klasse tragen. Vorher war es umgekehrt, und jedes neue Formular fiel
heraus, bis jemand daran dachte, `.formular` zu setzen. Daran denkt niemand,
weil nichts daran erinnert; gemeldet am 21.08.2026 als «So sieht es nach einem
Stielbruch aus».

Ausnahmen stehen ausdrücklich in `app.css` und sind gemessen begründet: Felder
in Tabellenzeilen und das Stellenfeld der Traktandenliste bleiben schmal, weil
dort viele nebeneinanderstehen. Wer eine weitere braucht, misst vorher mit
`e2e/telefonbreite.mjs` — der Querlauf am Telefon ist der Grund, aus dem die
Regel schon einmal zurückgenommen wurde.

### Ein Ankreuzfeld steht links neben seinem Titel

Ein Formular stapelt Beschriftung über Feld — bei einem Textfeld richtig, bei
einem Ankreuzfeld nicht: Ein Haken **über** seiner Beschriftung sieht aus, als
gehörte er zum Absatz darüber. Gemeldet am 26.08.2026 («Das liest sich sonst
komisch»), und es traf zwei Seiten, weil beide dieselbe Bauart hatten.

Die Form ist überall dieselbe: Kästchen, daneben ein `<span>` mit Titel und
Hilfetext untereinander. Im Stil `flex-direction: row`, `align-items:
flex-start`, `min-height: var(--ziel-min)` — das Mindestmass ist die Fläche,
die ein Finger trifft.

**Zwei Dinge, die man dabei nachmessen muss**, beide am selben Tag gemessen:

* Der Textblock braucht **`min-width: 0`**, sonst schiebt sein längstes Wort den
  ganzen Block über den Rand, statt in sich umzubrechen. `flex-wrap: wrap` löst
  das scheinbar auch — und schiebt bei knapper Breite den Titel wieder unter das
  Kästchen, also genau dorthin zurück.
* Ein **`<fieldset>` trägt browserseitig `min-width: min-content`** und kann als
  einziges Element nicht schmaler werden als sein breitester Inhalt. Auf 320 px
  waren das 8 px Querlauf — unsichtbar, weil `body` ihn ausblendet, also
  abgeschnitten statt scrollbar.

### Ein Auswahlfeld über acht Einträgen ist durchsuchbar

Gemeldet am 26.08.2026: «Bei Eigentümer fehlt die Möglichkeit nach Einheit zu
suchen. Im Dropdown muss dann gescrollt werden. Prüfe bei allen Dropdown ob die
Suchfunktion hinterlegt ist.» Eine Gemeinschaft mit dreissig Einheiten ist der
Normalfall; wer zuordnet, hat die Nummer auf dem Papier vor sich und sucht sie
in einer Liste, statt sie zu tippen.

**Die Regel: Kommen die Einträge aus dem Bestand, steht dort `Suchauswahl`.**
Kein rohes `<select>` mit `{#each}` mehr — die Zahl der Einträge steht zur
Übersetzungszeit nicht fest, und was heute vier sind, sind nach dem nächsten
Haus vierzig. Der Baustein entscheidet zur Laufzeit: **bis acht ohne Suchfeld,
ab neun mit.**

Die acht ist nicht neu erfunden. Sie stand an zwei Stellen schon so da — die
Gemeinschaftsliste (`bestand.length > 8`) und die übergeordnete Gemeinschaft im
`GemeinschaftFormular` mit dem Satz «Bis acht liest man die Liste, ab neun sucht
man». Sie steht jetzt einmal, in `$lib/domain/listensuche` (umgezogen am
27.08.2026 aus `$lib/auswahl`, weil sie seither auch die Listenseiten regelt und
die Schichtregel `kern-bleibt-rein` dem Kern verbietet, sie sich aus der Schale
zu holen).

### Dieselbe Schwelle für die Suchleiste einer Liste

Gemeldet am 27.08.2026: «Fehlt bei Gemeinschaft die Schnellsuche?» Sie fehlte
nicht. Sie stand unter einer anderen Regel als die Nachbarliste: Gemeinschaften
ab neun Einträgen, Personen und Eigentümer schon ab einem. Drei gleichartige
Übersichtslisten, zwei Regeln, kein Grund dafür.

**Die Regel: `brauchtSuchfeld(durchsuchbar, archiviert)` aus
`$lib/domain/listensuche`, nicht `bestand.length > 8` von Hand.** Sie ist wahr
ab neun Einträgen und ausserdem immer, solange etwas im Archiv liegt: Der
Archivschalter steht in derselben Leiste und wäre sonst der Weg, der mit dem
Suchfeld verschwindet.

**Gezählt wird, was die Suche erreicht, nicht was die Tabelle führt.** Die
Personenseite führt zwei Listen an einem Feld, auf der Eigentümerseite stehen die
Mitberechtigten in der Zelle ihrer Hülle und werden mitdurchsucht. Wer dort
`bestand.length` einsetzt, blendet das Feld aus, während vierzig Zeilen darunter
stehen.

**Nicht jedes Suchfeld ist eine Übersichtsliste.** Gezählt am 27.08.2026 stehen
15 Suchfelder in `src`; vier folgen dieser Regel (die drei Übersichtslisten und
`Suchauswahl`). Die übrigen haben je einen
Grund: Saalsichten (am Eingang steht jemand mit einem Namen), Serversuchen über
einen Bestand, den die Seite gar nicht hält, Auswahlbausteine, und zwei
ausdrückliche Vorgaben. Sie stehen namentlich, mit Grund und mit Anzahl, in
`tests/waechter/suchschwelle.test.ts`; der Wächter liest den Syntaxbaum und
meldet jedes Feld, das weder an der Schwelle hängt noch dort eingetragen ist.

**Ein fest aufgezähltes Auswahlfeld bleibt, wie es ist.** «Erstversammlung /
Zweitversammlung», «mindestens / mehr als», «Ja / Nein / Enthaltung»: Dort ist
ein Suchfeld ein zweites Bedienelement für eine Liste, die man in einem Blick
liest. Gezählt am 26.08.2026: **65 Auswahlfelder**, davon 41 auf den
Baustein umgestellt, 23 feste Aufzählungen unverändert gelassen und eine
begründete Ausnahme.

Der Wächter `versammlung/durchsuchbare-auswahl` (in `scripts/eslint/felder.mjs`)
hält beides fest: kein `{#each}` in einem rohen `<select>`, und höchstens acht
fest aufgezählte `<option>` darin. Eine Ausnahme steht als
`eslint-disable-next-line` **an der Stelle**, für die sie gilt, mit dem Grund
daneben — es gibt genau eine, `Erfordernisauswahl.svelte`: Sie sucht zusätzlich
in den Beispielen des Regelwerks, was der gemeinsame Baustein nicht kann.

Vier Dinge gehören zum Baustein, und drei davon sind nachgemessen:

* **Ohne JavaScript bleibt es ein gewöhnliches Auswahlfeld.** Im Saal wird die
  Anwendung auf fremden Geräten benutzt. Das Suchfeld erscheint erst nach dem
  Aufbau — ein Feld, das dasteht und nichts tut, ist schlimmer als keines.
* **Das Filtern nimmt die getroffene Wahl nicht weg.** Der Gewählte bleibt in
  der Liste, gleich was im Suchfeld steht. Sonst stünde das Feld nach einer
  zweiten Suche auf dem ersten Eintrag, und abgeschickt würde etwas, das niemand
  gewählt hat.
* **Beide Felder tragen ein eigenes `aria-label`.** Ein umschliessendes
  `<label>` beschriftet nur **ein** Feld — hier wäre das die Suche, und das
  Auswahlfeld bliebe namenlos.
* **`<datalist>` wurde geprüft und verworfen.** Es kann Anzeigetext und
  geschickten Wert nicht trennen: Unsere Felder zeigen Namen und schicken
  Kennungen. Eine Bibliothek wurde nicht geholt.

### `bind:value` am `<select>` löscht eine frühe Wahl

Das ist dieselbe Falle wie `value={…}` an einem Textfeld, nur eine Ebene
weiter — und sie ist am 26.08.2026 gemessen, nicht vermutet: Mit angehaltenem
Skript «Whg 1» gewählt, nach der Hydration stand das Feld wieder auf
«— wählen —». Svelte schreibt beim Aufbau den gebundenen Wert in das Feld
zurück; wer im Fenster davor wählt, verliert seine Wahl wortlos, das Formular
ist unvollständig, und der Knopf tut beim Drücken nichts.

Aufgefallen ist es nicht im Saal, sondern an `e2e/telefonbreite.mjs`: Das
Drehbuch füllt unmittelbar nach `domcontentloaded` aus und traf das Fenster
jedes Mal. **Im Saal ist es kein Ausreisser, sondern der Normalfall** — fremdes
Telefon, fremdes Netz, und getippt wird, sobald etwas dasteht.

Deshalb führt im Browser der Browser das Feld. Die Wahl steht im `selected` der
Option — beim Erzeugen gesetzt, danach nicht mehr massgeblich. Das ist kein
Zufall, sondern Svelte: Für `selected` fasst es allein das **Attribut** an
(`set_selected`), und ein angefasstes Auswahlfeld folgt dem Attribut nicht mehr.

**Braucht auch das Programm den Wert** — weil er die Anzeige treibt —, meldet
ihn `use:gefuehrteWahl` aus `$lib/felder` nach oben: beim Aufbau einmal (das ist
die frühe Wahl) und danach bei jeder Änderung. **Es gibt genau diesen einen
Weg**, auch im Baustein: `Suchauswahl.svelte` holte die frühe Wahl bis zum
26.08.2026 mit einer eigenen Zeile in `onMount` nach und geht seither über
dieselbe Aktion. Zwei Wege für dieselbe Sache heissen, dass der Nächste die
Hälfte abschreibt.

```svelte
<select name="kind" use:gefuehrteWahl={(w) => (art = w)}>
  <option value="natural" selected={art === 'natural'}>natürliche Person</option>
  <option value="legal" selected={art === 'legal'}>juristische Person</option>
</select>
```

Setzt umgekehrt die Seite den Wert («Vorschlag übernehmen», ein Wechsel der
Erfordernisart), genügt `selected` nicht: Ein angefasstes Feld folgt ihm nicht
mehr. Dann schreibt ein `$effect` den Wert von Hand hinein — nach `tick()`, weil
die gesetzte Option erst nach dem Anstrich in der Liste steht.
`Suchauswahl.svelte` und `Erfordernisauswahl.svelte` zeigen es.

**Wo `bind:value` bleiben darf: nirgends am `<select>`.** Am 26.08.2026 wurden
die letzten fünf Stellen umgestellt — `Erfordernisauswahl.svelte`, zwei
Auswahlfelder in `TraktandumAufnehmen.svelte`, die Art beim Erfassen eines
Eigentümers und die Art beim Anlegen eines Geschäfts. Alle fünf trieben die
Anzeige; keine musste dafür `bind:value` behalten.

Zwei Wächter halten es fest, und sie prüfen verschiedene Enden:

* **Die Schreibweise**: `versammlung/gefuehrte-auswahl` (in
  `scripts/eslint/felder.mjs`) meldet an einem `<select>` jedes `bind:value`,
  jedes `value={…}` samt Kurzform — **und jedes `onchange` ohne
  `use:gefuehrteWahl`**. Der letzte Teil ist der wichtigere: `selected` an der
  Option und ein `onchange`, das den Wert festhält, sieht richtig aus und
  verliert genauso viel, denn der `change` vor der Hydration erreicht keinen
  Zuhörer. Ausgenommen ist allein der `change`, der bloss `form.requestSubmit()`
  auslöst — dort hält das Programm nichts fest, der Wert geht mit dem Formular
  an den Server (vier Stellen im Bestand). Der Wächter sieht **25 Auswahlfelder
  in 14 Dateien**. Eine Ausnahme steht als `eslint-disable-next-line` **an der
  Stelle**, für die sie gilt, mit dem Grund daneben; heute gibt es keine.
* **Die Wirkung**: `e2e/wahl-vor-hydration.mjs` hält das Skript an, wählt, lässt
  los und sieht nach, ob die Wahl noch steht — im festen Feld und im Baustein.
  Ein Wächter über die Schreibweise kann nicht prüfen, ob der Weg, den wir
  stattdessen gehen, wirklich trägt. Vor der Umstellung war der Durchstich rot
  («eine andere Gemeinschaft» gewählt, «natürliche Person» gemessen), danach
  grün.

**Und das Zurücksetzen gehört dazu** (03.09.2026). `form.reset()` löst kein
`change` aus, also meldete `gefuehrteWahl` nichts — und weil Svelte
`selected={…}` beim Neuzeichnen als **Attribut** setzt, wird die getroffene Wahl
selbst zur Vorgabe des Feldes: Das Zurücksetzen führt dorthin zurück, wo es
schon steht. Gemessen im Drehbuch: «reset unitId ziel=«01a0…» ist=«01a0…»»,
beide gleich der gerade getroffenen Wahl.

Die Aktion merkt sich deshalb beim Aufbau die **echte** Vorgabe
(`defaultSelected`, also das Attribut aus dem ausgelieferten HTML) und meldet
sie beim Zurücksetzen. Nicht `feld.value`: Wer vor der Hydration wählt, hätte
sonst seine frühe Wahl als Ausgangswert gemerkt bekommen — genau der Fall, für
den dieser ganze Abschnitt existiert. `e2e/wahl-vor-hydration.mjs` hält auch das
fest.

Zwei Folgen, die man dabei mitdenken muss:

* Ein Formular mit `absenden({ reset: false })` löst gar kein Zurücksetzen aus —
  dort ändert sich nichts.
* Kommt die Absendung als **Rückfrage** zurück (`fail(409)`), setzt SvelteKit
  nichts zurück, und bestätigt wird im eigenen Formular des Fensters. Das
  Formular dahinter sieht dann nie ein `reset`. Wo das vorkommt, leert der
  Rückfrageweg es selbst (`beiErfolg`, siehe die Eigentümerseite).

### `open={…}` am `<details>` klappt den Kasten wieder zu

Dieselbe Falle noch eine Ebene weiter, gemessen am 26.08.2026 beim Bau der
Eigentümerliste: Wer das `<summary>` anklickt, **bevor das Skript geladen ist**,
sieht den Kasten bei der Hydration wieder zugehen. Ein Durchstich fiel zweimal
darüber, bis er auf `networkidle` wartete — und das ist die falsche Behebung,
denn im Saal wartet niemand auf `networkidle`. Das Fenster ist im Betrieb rund
200 ms lang.

**Warum.** `open` ist ein gewöhnliches Attribut, und Svelte setzt es bei der
Hydration erneut. Es merkt sich zwar den vorgefundenen Wert (`set_attribute`:
`attributes[attribute] = element.getAttribute(attribute)`), vergleicht ihn aber
mit dem Ausdruck — und `''` (der Browser hat aufgeklappt) ist nicht `false` (der
Server sagte «zu»). Also schreibt Svelte `element.open = false`.

**`bind:open` ist dieselbe Falle ohne Bremse.** In `Stimmerfassung.svelte` stand
sie seit dem 25.08.2026 ausdrücklich als *Behebung* der reaktiven Fassung da —
`bind_property` schreibt aber `element.open = get()` in einem `render_effect`,
ohne jede Prüfung. Eine Behebung, die genauso viel verliert.

```svelte
<details class="berichtigen" {...aufgeklappt(form?.fehler?.feld === 'name')}>
  <summary>Angaben berichtigen</summary>
  …
</details>
```

`aufgeklappt()` aus `$lib/felder` teilt die Sache nach Seiten auf, wie
`anfangswert()` es beim Textfeld tut:

* **Auf dem Server** steht `open` im ausgelieferten HTML — der Kasten wirkt ohne
  JavaScript, und das ist die Stelle, an der er üblicherweise aufgeht (eine
  Absage des Servers, ein Zustand aus `data`). Dazu die Marke
  `data-ausgeliefert`, die **die Antwort des Servers mitträgt** (`offen` oder
  `zu`).
* **Im Browser** hängt eine Handlung am Knoten statt eines Attributs, und sie
  greift nur ein, wo sie **mehr weiss als der Server**:

  | Marke | Server sagte | Browser sagt | Was geschieht |
  |---|---|---|---|
  | da | zu | zu | nichts — im DOM steht die Wahrheit, samt Klick des Benutzers |
  | da | offen | offen | nichts — dasselbe in der anderen Richtung |
  | da | zu | **offen** | aufklappen: Der Browser weiss mehr (ein Sprungziel) |
  | da | offen | zu | nichts — zugeklappt wird nur vom Benutzer |
  | keine | — | offen | aufklappen: Der Browser hat den Kasten selbst gebaut |
  | keine | — | zu | nichts |

* **Zugeklappt wird nur vom Benutzer.** Fällt der Ausdruck später auf `false`,
  bleibt der Kasten offen. Deshalb heisst die Sache Anfangs- und nicht
  Dauerzustand.

**Die dritte Zeile ist im Code-Review nachgetragen worden**, und sie hätte sonst
still etwas gekostet: Der Kasten «Code für die Leinwand» klappt auf, wenn man
von der Sitzungsleitung aus auf `#anzeigecode` springt. Ein URL-Fragment
erreicht den Server aber **nie** — beim Rendern dort ist `page.url.hash` immer
leer, seine Antwort ist zwangsläufig «zu». Eine erste Fassung liess jeden
ausgelieferten Kasten in Ruhe; wer den Verweis in einem neuen Tab öffnete, neu
lud oder ein Lesezeichen aufrief, landete damit auf einem geschlossenen Kasten.
Gemessen, entschärft und wieder gemessen — der Durchstich unten deckt beide
Richtungen ab.

Ein Neuzeichnen klappt nichts wieder auf: Svelte vergleicht die Handlung mit der
vorigen (`n !== prev[symbol]` in `set_attributes`), und beide Handlungen sind
feste Grössen.

**Ein festes `open` bleibt, wie es ist.** `<details open>` ohne Ausdruck ist ein
Kasten, der immer offen anfängt — da gibt es keinen Zustand, den Svelte
zurückschreiben könnte.

Gezählt am 26.08.2026: **65 Ausklapper**, davon 11 mit einem Zustand am `open`
(in 8 Dateien) — alle umgestellt, keine begründete Ausnahme. Die übrigen 54
tragen gar kein `open`; das sind die Kästen aus Regel 4 («Was heisst das?»), und
sie sind von der Falle nicht betroffen.

Zwei Wächter halten es fest, und sie prüfen verschiedene Enden:

* **Die Schreibweise**: `versammlung/gefuehrter-ausklapper` (in
  `scripts/eslint/felder.mjs`) meldet an einem `<details>` jedes `open={…}`
  samt Kurzform `{open}`, jedes `bind:open` und jedes `open` in einem Spread an
  Ort und Stelle (`{...{ open: … }}` — der Weg vorbei, den das Code-Review
  gefunden hat). **Nicht** erfasst sind zwei Schreibweisen, die es im Bestand
  null Mal gibt: `<svelte:element this="details">` und ein Spread aus einer
  Grösse statt aus einem Objekt an Ort und Stelle (`const a = { open: x }`).
  Eine Regel für einen Fall, den es nicht gibt, ist nicht geprüft, sondern
  behauptet — hier steht deshalb, was der Wächter **nicht** sieht. Eine
  Ausnahme steht als `eslint-disable-next-line` **an der Stelle**, für die sie
  gilt, mit dem Grund daneben; heute gibt es keine.
* **Die Wirkung**: `e2e/ausklapper-vor-hydration.mjs` hält das Skript an,
  klickt, lässt los und sieht nach, ob der Kasten noch offen steht. Dazu die
  Gegenrichtung — eine Absage des Servers muss ihn weiterhin aufklappen —, die
  Marke selbst (vor der Hydration da, danach verbraucht), ein im Browser neu
  gebauter Kasten und das Sprungziel `#anzeigecode` an einer laufenden
  Versammlung. Vor der Umstellung war der Durchstich rot (geklickt, aufgeklappt,
  nach der Hydration zu), danach grün.

  **Zwei Dinge, an denen die Messung zuerst danebengriff**, beide am selben Tag:
  Ein `goto` mit `domcontentloaded` wartet auf die aufgeschobenen Module — die
  Hydration ist dann längst durch, und der ausgelieferte Zustand war nie zu
  sehen. Und hängt man an die *aktuelle* Adresse bloss ein Fragment an, ist das
  eine Bewegung **im selben Dokument**: Der Server wird gar nicht gefragt.

### Eine Hilfsklasse setzt keine Anzeigeart

`.klein { display: block }` an einem `<td>` macht aus der Zelle einen Block: Sie
war 37 px hoch statt 63, ihre untere Linie lag 25 px über der Linie der
Nachbarzellen, und die Tabelle bekam eine Treppe (20.08.2026, «Die Zeile
Einheiten sind versetzt» — an drei Seiten dieselbe Falle). Wer `display` an
einem tragenden Element braucht, macht die Regel am Element fest:
`td.einheiten { … }`. `scripts/check-anzeigeart.mjs` prüft es für Tabellenteile,
Auswahleinträge und `summary`.

### Was keine Leerstelle hat, braucht eine Umbruchstelle

Eine Adresse, ein Code, ein Dateiname: für den Browser ist das **ein Wort**, und
ein Wort wird nicht umbrochen. Es schiebt stattdessen die ganze Seite zur Seite.
Gemessen am 20.08.2026 im Kasten mit dem Code für die Leinwand: die Adresse der
Präsentationssicht stand **273 px** über den Kasten hinaus, die Seite lief
**257 px** quer — auf dem Notebook unsichtbar, auf dem Telefon der erste
Eindruck.

Solche Zeichenketten bekommen eine eigene Zeile und `overflow-wrap: anywhere`;
Fliesstext genügt `break-word` (dort soll zwischen Wörtern umbrochen werden, und
ein Titel wie «Beschlussfähigkeit» darf nicht mitten im Wort brechen).

`e2e/telefonbreite.mjs` misst die Seiten bei 390 px und nennt **den Verursacher**
— das innerste Element, das breiter ist als der Schirm, nicht das am weitesten
rechts stehende. Dazu gehört, Zustände herzustellen, die nur einmal erscheinen:
Der Kasten mit dem Code für die Leinwand steht bloss unmittelbar nach dem Erzeugen, und
genau deshalb ist er jahrelang durchgerutscht.

### Auf dem Telefon steht alles untereinander

Eine Zeile mit `flex-wrap`, in der sechs verschiedene Dinge liegen, ordnet sich
auf jedem Schirm anders: Bei kurzem Titel steht die Marke rechts, bei langem
rutscht sie nach unten, und der Knopf landet mal neben ihr, mal darunter. Für
den Leser sieht das nach Zufall aus — gemeldet am 20.08.2026: «Der Ablauf auf
dem Mobiltelefon müsste etwas ruhiger und cleaner dargestellt sein.»

Die Traktandenliste hat deshalb feste Plätze statt einer Reihe:

```
Nr │ Titel ……………………………… │ Stand
   │ Einordnung
   │ Handlungen
```

Was fehlt, lässt eine Lücke, statt alles Übrige zu verschieben. Der Umschlag
zwischen «Stand rechts oben» und «Stand unter dem Titel» hängt an der Breite
**der Liste**, nicht des Fensters — die Liste steht am Notebook in einer Spalte
von höchstens 30rem, eine Fensterabfrage träfe also den falschen Fall. Dafür ist
`container-type: inline-size` da.

### Klartext

Die Sätze stehen im Kern, nicht in der Seite — dieselbe Sache heisst überall
gleich, und die Bauart ist prüfbar. `tests/domain/klartext.test.ts` wacht
darüber: Die Überschrift endet auf ein Fragezeichen, die Antwort ist höchstens
60 Zeichen lang, Paragraphen stehen nicht in der Antwort, die Erklärung ist
länger als 60 Zeichen. Ohne diesen Wächter wandert der Erklärsatz beim nächsten
Nachbessern in die Antwort zurück — genau so ist die alte Seite entstanden.

Ein Eintrag beschreibt auch, was sich aus den Daten ergibt: Hat eine
Gemeinschaft im Reglement eine strengere Anwesenheitsschwelle hinterlegt, sagt
`versammlungsstufe('zweite', regel)` «Ihr Reglement verlangt die Hälfte.» statt
«Hier genügt ein Drittel.» — die gesetzliche Zahl wäre dort schlicht falsch.

### Zwei Achsen derselben Matrix

Wo dieselben Angaben für mehrere Gegenstände zu erfassen sind — vier Themen für
sechs Häuser —, gibt es zwei Wege durch dieselbe Matrix, und die Anwendung
bietet beide an:

| Wo man steht | Was die Reiter tragen | Baustein |
|---|---|---|
| auf einer Themenseite (`/gemeinschaften/…/einheiten`) | die **Häuser** — Thema bleibt | `abendregister()` |
| in der gemeinsamen Versammlung (`/tage/…/stammdaten`) | die **Häuser** — Seite bleibt, Inhalt wechselt | `hausregister()` |

Dieselbe Komponente zeigt beide (`Abendregister.svelte`, die Frage kommt als
Eigenschaft). Welcher Weg näher liegt, hängt daran, wo jemand gerade steht — und
beide führen zum selben Ziel, statt dass einer der einzige richtige wäre.

### Reiter über gleichartige Gegenstände

Wo dieselbe Seite für mehrere Gegenstände auszufüllen ist — dieselben vier
Stammdatenseiten für sechs Häuser einer gemeinsamen Versammlung —, gehört über den Inhalt eine
Reiterleiste statt eines Suchwegs. Gemessen am 11.08.2026: vier Themen mal sechs
Häuser waren **72 Klicks**, mit der Leiste sind es **24**.

Drei Regeln dazu, jede aus einem Fehler entstanden:

1. **Der Reiter trägt die Herkunft des Ziels, nicht die eigene.** Im Verbund hat
   jedes Haus seine eigene Versammlung. Ein Reiter mit der falschen
   `?zur=`-Kennung sieht völlig richtig aus — und die Leiste daneben führt den
   Ablauf der falschen Versammlung.
2. **Die Frage nennt den Gegenstand, nicht das Thema.** «Für welches Haus?»,
   nicht «Einheiten und Wertquoten — für welches Haus?»: Das Thema steht als
   Überschrift unmittelbar darunter. Für die Sprachausgabe trägt die Leiste es
   in ihrer Beschriftung.
3. **Der Stand gehört auf den Reiter.** Ohne Häkchen müsste man jeden Gegenstand
   öffnen, um zu sehen, ob man dort schon war — dann spart die Leiste nichts.
   Der Stand kommt aus derselben Rechnung wie die Ablaufleiste, nicht aus einer
   zweiten.

### Die Gliederung ergibt sich, sie wird nicht gewählt

Wo eine Sache mehrere Gegenstände betrifft, entsteht die Gliederung **aus der
Zahl der Betroffenen** — niemand kreuzt «mit Unterpunkten» an. Ein Traktandum
der gemeinsamen Versammlung, das in drei Häusern läuft, steht als Sammelpunkt
mit drei Ziffern darunter; läuft es in einem, steht es allein. Ein Punkt «4» mit
einem einzigen Unterpunkt «4.1» wäre eine Gliederung, die nichts gliedert.

**Die Gliederung folgt der Entscheidung, nicht dem Text** (Entscheid vom
11.08.2026): Was einzeln beschlossen wird, muss einzeln angekündigt sein. Ein
Punkt, der sich erst bei abweichendem Wortlaut aufspaltete, führte in der
Einladung eine Ankündigung, die es so nicht gibt.

**Länge ist eine Frage der Anzeige, nicht der Ordnung.** Acht Pflichttraktanden
mal sechs Gemeinschaften sind sechsundfünfzig Zeilen — die Ordnung braucht sie,
das Auge nicht. Deshalb stehen die Ziffern **zugeklappt** unter ihrem Punkt und
klappen von selbst auf, sobald dort etwas zu sehen ist: wenn ein Haus einen
eigenen Wortlaut trägt. Wer eine Liste kürzen will, kürzt die Anzeige, nie die
Struktur.

Zwei Regeln, die daran hängen:

* **Die Überschrift trägt keine Entscheidung.** Über den Sammelpunkt wird nicht
  abgestimmt; der Beschluss fällt beim einzelnen Gegenstand. Sonst gäbe es einen
  Beschluss, den niemand gefasst hat.
* **Abweichung ist erlaubt und muss sichtbar sein.** Alle bekommen zuerst
  denselben Inhalt; wer seinen ändert, darf das — die Zeile trägt danach die
  Marke «angepasst». Ohne sie hielte man die Liste für einheitlich, wenn sie es
  nicht mehr ist.

### Gleicher Gegenstand, gleiches Layout

Eine gemeinsame Versammlung ist dasselbe wie eine einzelne, nur mit mehreren
Gemeinschaften. Bis zum 11.08.2026 sah ihre Seite völlig anders aus: keine
Seitenleiste, vier `h2`-Abschnitte untereinander, neun Knöpfe, eine Tabelle mit
sieben Spalten, in der drei davon je nach Zustand durch eine einzige ersetzt
wurden. Gemeldet: «Das sieht nach einem eigenen Ablauf aus und stimmt überhaupt
nicht mit der Ansicht der Einzelversammlung überein.»

Die Regel daraus: **Wer denselben Gegenstand bearbeitet, sieht dasselbe Layout.**
Links der Ablauf mit Fortschritt, rechts eine Seite mit einer Frage, unten der
Weg zum nächsten Schritt. Ein Ablauf für die gemeinsame Versammlung
(`domain/gemeinsamerablauf.ts`) kostet fünfzig Zeilen und erspart der Seite vier
Abschnitte.

Und daraus folgt die nächste: **Was erst später möglich ist, steht gesperrt in
der Leiste, nicht als totes Formular auf der Seite.** Der Einlass stand mitten in
der Vorbereitung und antwortete auf jeden Klick «nicht möglich — die Versammlung
läuft dort nicht».

### Eine Schranke der Datenbank ist keine Fehlermeldung

Wo ein eindeutiger Index oder ein Auslöser etwas verbietet, gehört dieselbe Regel
**vorher** in den Kern — mit Grund und Ausweg. Sonst kommt sie als 500er heraus:
«duplicate key value violates unique constraint meeting_tag_je_gemeinschaft»,
mitten im Saal, gemessen am 11.08.2026 beim Aufnehmen einer zweiten Versammlung
derselben Gemeinschaft.

Und die Regel im Kern muss **dieselbe** sein, nicht eine mildere. Ein Versuch,
sie für ausserordentliche Versammlungen und Zweitversammlungen zu lockern, endete
genau an derselben Schranke: Die Datenbank kennt weder Art noch Stufe, ihr Index
läuft über `(meeting_day_id, stweg_id)`. Wer die Lockerung wirklich will, ändert
zuerst die Migration — nicht die Prüfung davor.

Eine Absage nennt immer den **Ausweg**: «Lösen Sie die bestehende, wenn Sie sie
ersetzen wollen.» Ohne ihn ist sie eine Sackgasse, und der Benutzer legt aus
Verlegenheit eine neue Versammlung an.

**Auch ein berechtigter Wurf braucht einen Fänger.** Am 12.08.2026 im
Durchspiel-Lauf: `zaehleAus` wirft zu Recht bei einer Kenntnisnahme — es gibt
nichts auszuzählen. Nur fing das niemand ab, und die **Sitzungsleitung** bekam
beim Laden ihrer Seite einen 500er, mitten im Saal, nachdem ein zur Kenntnis
genommenes Traktandum geschlossen war. Drei benachbarte Fälle in derselben
Funktion gaben längst «kein Ergebnis, aber ein Grund» zurück; der vierte fehlte.
Wer im Kern einen Fehler wirft, sucht die Aufrufstelle und prüft, ob sie ihn
kennt.

**Ein zweiter Fall, am 12.08.2026 gemessen.** Eine Gemeinschaft mit einer Einheit
auf «übergeordnete Gemeinschaft» gestellt: Der Auslöser `stweg_stammquote_mitfuehren` löscht
bei Nenner 0 die Stammquotenart, der Fremdschlüssel von `unit_quota` hält dagegen
— und was ankam, war «500 Internal Error». Der Weg bestand schon vorher (Nenner
von Hand auf 0), nur war er nicht bequem erreichbar. **Wer einen bestehenden Weg
bequem macht, prüft, was an seinem Ende steht.**

Dazu gehört auch: **Eine Fehlermeldung erscheint an genau einer Stelle.** Auf der
Angabenseite stand der Fehler des Speicherns zusätzlich unter «Gemeinschaft
entfernen» — beide Aktionen füllen `form`, und die Seite unterschied sie nicht.
Ein Feld `quelle` in der `fail()`-Antwort trennt sie; ohne das liest sich ein
abgewiesenes Speichern als gescheitertes Löschen.

**Und die Regel im Kern muss dasselbe zählen wie die Schranke.** `text.length`
zählt in JavaScript UTF-16-Einheiten, `length()` in Postgres zählt Zeichen — ein
Bildzeichen ist dort zwei, hier eins. Bei einer Untergrenze ist der Kern dadurch
**lockerer** als die Schranke, und der Wert läuft an der Meldung vorbei in die
500. Längen auf Zeichenketten deshalb mit `zeichenzahl()` aus
`$lib/domain/zeichenzahl`; der Wächter `check-zeichenzahl` hält es fest.

Im Formular bleibt `minlength`/`maxlength` trotzdem stehen, obwohl HTML ebenfalls
UTF-16-Einheiten zählt: Der Browser **kann** nicht Zeichen zählen. Die Angabe im
Markup ist eine Vorwarnung, die Schranke steht auf dem Server — und der muss den
Fall, den der Browser durchlässt, mit einem Satz beantworten.

### Ein Formular, das Fremdes überschreiben kann, schickt den Stand mit

Wer eine Seite offen liegen lässt, während jemand anders am selben Feld
einträgt, setzt beim Speichern dessen Eintrag zurück — **ohne dass es einer der
beiden merkt**. Das ist kein Fehlerfall: Beide Vorgänge waren für sich richtig.
Sichtbar wird es erst Wochen später, wenn im Protokoll der falsche Name steht.

Deshalb trägt ein solches Formular je Feld ein verstecktes `stand-<feld>` mit dem
Wert, den es beim Anzeigen vorfand. Der Schreibweg vergleicht (`veralteteFelder`
in `$lib/domain/schreibstand`) und lehnt ab, wenn dort inzwischen etwas anderes
steht — **mit dem fremden Wert im Satz**, sonst muss man zum Nachsehen die Seite
verlassen und verliert dabei das Getippte.

Drei Dinge gehören dazu, sonst wird aus dem Schutz eine Sperre:

* **Kein Stand mitgeschickt heisst «nicht prüfen».** Das ist der Ausweg für ein
  Feld, das laufend sichert: «meinen Text durchsetzen» lässt den Stand weg. Für
  ein gewöhnliches Formular gilt es **nicht** — ein `<input type="hidden">`
  schickt der Browser immer mit, auch ohne JavaScript, und dort wird deshalb
  immer geprüft.
* **Steht dort schon der neue Wert, ist es kein Konflikt.** Sonst meldet ein
  doppelter Klick einen Konflikt mit sich selbst.
* **Die Absage trägt den neuen Stand zurück** (`stand` in der `fail()`-Antwort).
  `use:enhance` lädt bei einer Absage nicht neu; ohne das schickte das Formular
  wieder den alten mit, und der zweite Versuch liefe in denselben Konflikt.

Ein Feld, das laufend sichert, kann mehr anbieten — «meinen Text durchsetzen»
oder «den anderen übernehmen» (`SicherndesFeld.svelte`). Ein gewöhnliches
Formular sagt schlicht: nochmals abschicken, wenn Ihre Angabe gelten soll.

### Ein Knopf nennt seinen Gegenstand, nicht seine Tätigkeit

Wo mehrere Formulare untereinander stehen und jeder Knopf nur seines abschickt,
darf keiner bloss «Speichern» heissen. Gefragt am 11.08.2026: «Was bedeutet
Erfordernis setzen?» — vier Knöpfe in einer Zeile, die vier verschiedene Dinge
taten, und nur einer trug den Gegenstand im Namen. Jetzt heissen sie «Text
speichern», «Mehrheit speichern», «Gemeinschaften speichern».

Drei Regeln dazu:

1. **Gleichrangiges bleibt gleich.** Die drei Speicherknöpfe sehen gleich aus.
   Einen davon als Hauptknopf einzufärben behauptete, er speichere alles.
2. **Das Unumkehrbare rückt weg.** «Von der Liste nehmen» steht am rechten Ende
   der Zeile (`margin-left: auto` am **Knopf**, nicht am Formular — `display:
   contents` nimmt dem Formular seine Box, und ein Margin daran wirkt nicht).
   Gemessen: von 630 auf 708 px, rechtsbündig bei 928 px Zeilenbreite.
3. **Die Anleitung steht dort, wo die Frage entsteht** — als `<details>` über
   den Knöpfen, nicht auf einer Hilfeseite.

Und dazu die Falle, die dabei zuschlug: **`display: flex` auf einem `<summary>`
nimmt ihm sein Dreieck.** Der Satz sieht dann aus wie ein Satz, und niemand
klappt ihn auf. Für die Fingergrösse `padding` statt Flex — gemessen 45 px Höhe,
`list-style-type: disclosure-closed` erhalten.

**Seit 22.08.2026 ist das bewacht**, und der Anlass
ist ein Lehrstück: Dieser Absatz stand hier seit Monaten, gelesen wurde er auch
— trotzdem trugen sechs Ausklapper die Falle weiter, darunter einer, der am
selben Tag neu entstand, nachdem dieses Dokument gelesen worden war. Eine Notiz
muss jemand im richtigen Moment erinnern; ein Wächter fragt bei jedem Commit
nach. Er nimmt jede Regel, deren Selektor auf `summary` endet, und lässt beim
`display` nur `list-item` (und `revert`/`unset`) durch — `block` nimmt das
Dreieck genauso wie `flex`. `summary::marker` und `summary > span` sind davon
ausgenommen: Die gestalten den Punkt oder ein Kind, nicht das Element.

Er steht seit dem 24.08.2026 als Stylelint-Regel `versammlung/dreieck-am-summary`
(`scripts/stylelint/dreieck-am-summary.mjs`, läuft in `npm run check:css`) und
nicht mehr als eigenes Skript — ein regulärer Ausdruck über die Datei kannte den
Unterschied zwischen Code und Kommentar nicht. Sein Gegentest steht in
`tests/waechter/dreieck-am-summary.test.ts`.

### Ein Wort für den Weg, eines für die Sache

«Erfordernis setzen» heisst weiterhin so, wo es zum **Entscheidbaum** führt: Die
Zielseite heisst so, das Protokoll auch. Wo derselbe Begriff an einem
**Speicherknopf** steht, heisst er «Mehrheit» — der Fachbegriff steht daneben in
der Anleitung und im Feld darüber («Mehrheitserfordernis»). Beides zusammen ist
Regel 3: Klartext, damit man versteht, was man tut; Fachbegriff, damit man ihn
im Gesetz wiederfindet.

### Zwei Handlungen, zwei Rahmen

Stehen auf einer Seite zwei Formulare, die Verschiedenes tun, genügen zwei `h2`
nicht — sie lesen sich als zwei Teile desselben Vorgangs. Gemeldet am
11.08.2026 zu «Einheit zuordnen» und «Eigentümer hinzufügen»: «fehlt eine
Unterteilung. Als dass man sieht, dass das zwei unterschiedliche Funktionen
sind.» Jeder Abschnitt bekommt einen eigenen Kasten und einen Satz darunter, der
sagt, **was er tut und was der andere tut**: «Steht der Eigentümer noch nicht in
der Liste, erfassen Sie ihn zuerst weiter unten.»

### Entweder oder, nicht beides nebeneinander

Wo zwei Wege zum selben Ziel führen, gehört die Wahl **vor** die Felder — nicht
beides gleichzeitig ins Formular. «Eigentümer hinzufügen» führte ein Namensfeld
*und* eine Auswahlliste bestehender Personen; wer beides ausfüllte, legte eine
Zeile unter dem getippten Namen an und hängte sie an eine andere Person.
Gemeldet: «So ist beides irgendwie vermischt. Entweder oder aber nicht beides.»

Ein Schalter entscheidet, und die Felder wechseln mit ihm: Beim neuen Weg das
Namensfeld, beim bestehenden nur die Liste — kein zweites Namensfeld, keine
zweite Anschrift. Die Regel, **welche** Felder eine Art führt, steht im Kern
(`domain/eigentuemer.ts`, `eigentuemerfelder`), weil dieselbe Verzweigung an drei
Stellen gebraucht wird: in der Seite, in der Aktion und in der Prüfung. Laufen
sie auseinander, zeigt die Seite ein Feld, das der Server verwirft.

**Der Vorschlag bleibt ein Vorschlag.** Wer einen Namen tippt, den es schon gibt,
bekommt «… ist bereits erfasst. Dieselbe Person?» mit einem Knopf, der auf den
anderen Weg umschaltet — nicht eine still vorausgewählte Person. «Meier» gibt es
in einer Überbauung dreimal.

### Was angelegt werden kann, muss weggehen können

Jedes Anlegeformular braucht sein Gegenstück, und zwar dort, wo das Angelegte
steht. Gemeldet am 11.08.2026 zu den Verteilern: «Ich habe vorhin einen
angeklickt und den kann ich nicht wieder entfernen.» Ein Verteiler ist mit drei
Feldern erfasst — ohne Rückweg bleibt jeder Vertipper für immer eine Spalte in
der Tabelle.

Drei Eigenschaften machen den Rückweg brauchbar:

1. **Ohne Verlust ohne Rückfrage.** Trägt niemand einen Wert daran, verschwindet
   er sofort. Eine Rückfrage ohne Verlust ist eine, die man wegklickt — und dann
   klickt man beim nächsten Mal auch die echte weg.
2. **Mit Verlust mit Zahlen** — «2 Einheiten tragen an diesem Verteiler einen
   Wert». Die Zahl kennt nur der Server.
3. **Was nicht weg darf, hat keinen Knopf** und sagt warum: Die Stammquote trägt
   das Stimmrecht. Die Absage nennt den Ausweg — den Nenner bei den Angaben der
   Gemeinschaft.

### Der Seitenstapel: benannte Abschnitte in fester Reihenfolge

Eine Seite ist ein Stapel von Abschnitten über die volle Bahn, in fester
Reihenfolge. Nebeneinander gestellt wird nur **innerhalb** eines Abschnitts, und
dort nur unter Dingen derselben Art.

| Abschnitt | Beantwortet | Enthält typischerweise |
|---|---|---|
| **Lage** | Wo stehe ich? | Summen, Stand, was fehlt, Warnungen |
| **Bestand** | Was ist da? | Tabelle oder Liste, mit ihrer Suche |
| **Handeln** | Was kann ich tun? | Formulare, in der Reihenfolge der Arbeit |
| **Hintergrund** | Warum ist das so? | Zugeklappt, Rechtsgrundlagen, Randfälle |

Nicht jede Seite hat alle vier. **Die Reihenfolge ist fest.** Eine Seite ohne
Bestand lässt ihn weg, sie schiebt ihn nicht nach unten.

### Tabelle oder Liste — das Kriterium

«Tabelle oder Liste» stand hier bis zum 02.09.2026 ohne Kriterium, und der Auftraggeber
fragte, warum die Gemeinschaftsseite anders aussieht als die Personenseite. Beim
Nachmessen stand die Regel längst im Code, nur nirgends geschrieben:

| Seite | Struktur | Baustein |
|---|---|---|
| Gemeinschaften | Elterngemeinschaft → Häuser (`--tiefe` je Zeile) | `<ul>` |
| Versammlungen | Fächer mit Überschrift, darin Abende mit ihren Versammlungen | `<ul>` |
| Personen | flach, sortierbar | `<table>` |
| Verlauf | flach, chronologisch | `<table>` |

**Trägt der Bestand eine Struktur, wird er eine Liste; ist er flach, eine
Tabelle.** Eine Tabelle kann keine Einrückung zeigen, ohne ihre Spalten zu
verlieren, und eine Liste keine Spalten vergleichen. Die Sortierpfeile gehören
deshalb zur Tabelle: Sortieren heisst, eine Spalte gegen die anderen zu
gewichten — bei einer Hierarchie zerstörte das gerade die Aussage.

Was daran wirklich uneinheitlich war, lag woanders: der Erklärabsatz darüber
(siehe die Falle «Ein Erklärabsatz sieht überall gleich aus»).

Anlass (Auftraggeber, 27.08.2026): «Was mich immer wieder stört und unsauber gelöst
wirkt, sind die Lücken in der Darstellung.»

**Die vier Namen sind kein Text auf dem Bildschirm.** Sie sind ein Wortschatz
für den, der die Seite schreibt. Gelesen werden weiter die Überschriften der
Blöcke selbst: «Wertquoten», «Einheit hinzufügen». Das Modell ordnet die Seite,
es beschriftet sie nicht.

Die Bausteine: `.seitenstapel` und `.seitenstapel > .abschnitt` in `app.css`.
Der Elternteil gehört zum Selektor: `.abschnitt` allein ist im Haus vierzehnmal
anders belegt.

#### Drei Dinge, die erst die Messung ergab

**1. Eine Lücke ist kein verschenkter Platz.** Sie ist der Ort, an dem sich der
kürzere Block versteckt. Wer sie schliesst, zahlt seine Höhe. Gemessen an der
Einheitenseite:

| Inhaltsspalte | Zwei Spalten | Ein Stapel |
|---|---|---|
| 1440 px, acht Einheiten | 1699 px | 1718 px |
| 1440 px, leer | 1000 px | 1033 px |
| 390 px, acht Einheiten | 2110 px | 2126 px |

Verloren geht dabei ein Loch von 548 px Breite und 779 px Höhe, die halbe Bahn
unter dem kürzeren Block.

Der Inhalt wird dafür länger: ein Prozent mit acht Einheiten, **3,3 Prozent im
leeren Zustand** (1000 → 1033 px). Der leere Fall ist der ungünstigste der
sechs Messungen, und er gehört genannt, weil der Umbau dort am wenigsten
einbringt und am meisten kostet.

Wer nur die Höhe misst, hält den Umbau für einen Rückschritt; wer nur die Lücke
misst, verschweigt den Preis. Beide Zahlen gehören genannt.

**Gemessen wird die Inhaltsspalte, nicht die Seite.** Bei 1440 px ist die
Seitenleiste höher als der Inhalt und bestimmt die Seitenhöhe allein: Ein
`document.scrollHeight` hätte hier die Navigation gemessen und den Unterschied
verschluckt. Vom Anfang der Spalte bis zum Fuss ihres letzten Kindes.

**2. Gleichartig heisst nicht gleich gross.** «Weitere Verteiler» und «Einheit
hinzufügen» sind beide Erfassungsblöcke und dürften nach der Regel
nebeneinanderstehen. Zugeklappt misst der eine 83 px, der andere 678 px. Das
risse dasselbe Loch wieder auf, nur schmaler. **Der Stapel ist die Vorgabe.**
Nebeneinander steht nur, was `.kacheln` trägt, und dort sind die Karten nach
Regel 5 ohnehin gleich hoch.

**3. Der Hintergrund ist selten ein eigener Abschnitt.** Auf der Einheitenseite
steht «Was heisst das?» dort, wo die Frage aufkommt: neben dem Feld «Art», nicht
am Seitenfuss. Das ist richtig so und war schon Regel 4. Ein eigener Abschnitt
«Hintergrund» lohnt erst, wo die Erklärung die ganze Seite betrifft.

### Die Arbeitsfläche: Bestand links, Eintragen rechts

**Stand 27.08.2026: Auf der Einheitenseite gilt das nicht mehr.** Dort steht
jetzt der Seitenstapel. Die Begründung unten war richtig und ist abgelaufen: Sie
beruhte darauf, dass «Einheit hinzufügen» in halber Bahn genauso hoch ist wie in
ganzer. Seit der Kasten am 26.08.2026 nach Fragen statt nach Platz ordnet, bricht
er in der Breite um: 790 px auf 548 px Bahn, 678 px auf 1120 px. Damit kehrte
sich die Rechnung um.

**Stand 01.09.2026: noch zwei Seiten** (`betreiber/dienste`, `eigentuemer`).
`nutzniessung` und `tage/protokoll` sind auf den Stapel umgestellt, je einzeln
nachgemessen. Was die Messung ergab:

| Seite | Was das Nebeneinander kostete | Nachher |
|---|---|---|
| `nutzniessung` | Bestand meist leer, Formular daneben immer gleich lang — links eine halbe Bildschirmhöhe Nichts | Zwei Kacheln im Stapel, der Bestand bekam erstmals eine Überschrift |
| `tage/protokoll` | Links eine Kachel, rechts vier; «Stand» stand unter dem Knopf zum Unterzeichnen, obwohl es sagt, ob unterschrieben werden darf | Lage, Bestand, Handeln; 4395 → 2526 px, weil der Protokolltext jetzt in seinem Kasten rollt |

**Stand 02.09.2026: die Umstellung ist durch.** `betreiber/dienste` behielt die
Anordnung und bekam den zutreffenden Baustein — dort standen nie Bestand und
Formular nebeneinander, sondern zwei gleichrangige Dienste, und ein Stapel hätte
die Messung vom 17.08.2026 rückgängig gemacht.

**`eigentuemer` bleibt eine Arbeitsfläche, und zwar begründet.** Sie ist der
Fall, für den das Muster existiert: Der Bestand wird hier beim Eintragen
gebraucht, nicht nur davor gelesen. Gemessen an 14 Eigentümern, 1440 × 900, mit
probeweise auf eine Spalte gestellter Fläche:

| | nebeneinander | als Stapel |
|---|---|---|
| «Einheit zuordnen» beginnt | 1377 px | 2596 px |
| Tabelle endet | 2676 px | 1778 px |
| Seitenhöhe | 3355 px | 3778 px |

Nebeneinander liegt das Formular **innerhalb** der Tabellenhöhe. Im Stapel läge
es 818 px darunter — auf einem 900 px hohen Bildschirm sieht dann niemand mehr,
wogegen er prüft, und die Seite wäre dabei länger geworden.

Solche Seiten tragen `<!-- seitenaufbau-ausnahme: <Grund> -->`. Der Wächter
zählt sie getrennt und wird rot bei den beiden Marken, die nichts tragen:

- **ohne Satz** — nach dem Doppelpunkt steht nichts oder fast nichts. Das wäre
  ein Schalter, und ein Wächter, den man abschalten kann, wird abgeschaltet.
- **ohne `.arbeitsflaeche`** — die Marke entschuldigt das Nebeneinander und
  gehört deshalb nur neben eines. Wer die Seite doch umstellt, nimmt den Grund
  mit; sonst behauptet er einen Zustand von gestern, und der nächste Leser
  glaubt ihm.

Der Grund darf umbrechen: Gelesen wird bis zum Kommentarende oder zur nächsten
Leerzeile, nicht bis zum Zeilenende.

Bis zum 02.09.2026 wurde er stattdessen rot, wenn er gar keine Marke mehr fand.
Das war die Umkehrung: Gezählt wird eine Ausnahme nur zusammen mit ihrer Fläche,
und die verschwindet am Ziel der Umstellung. Der Wächter hätte im Erfolgsfall
den Pre-Commit-Hook gesperrt.

**Und ein langer Bestand braucht im Stapel eine Grenze.** Nebeneinander stand
das Handeln neben dem Bestand und war von oben erreichbar; im Stapel steht es
darunter. Auf der Protokollseite lag «Unterschreiben» damit zwei Bildschirme
unter dem Knopf, der hingeführt hatte. `max-height` mit eigenem Rollbereich
(dort `70vh`), und im Druck fällt die Grenze weg.

Eine Seite, auf der man **etwas sieht und etwas einträgt**, stellt beides
nebeneinander (`.arbeitsflaeche` in `app.css`). Gemeldet am 12.08.2026: «Was man
machen kann ist, den Platz optimaler zu nutzen. Die Kacheln WQ / Kopfstimme /
Eigentümertabelle könnten einen Block bilden und daneben Eigentümer erfassen und
Einheiten zuordnen.»

Nachgemessen war nicht die Breite das Problem — jeder Block nutzte die Bahn ganz.
Sie standen nur alle **untereinander**:

| Gemessen (Gemeinschaft mit 14 Eigentümern) | Vorher | Nachher |
|---|---|---|
| Eigentümerseite in Bildschirmen (1440 × 900) | 2.89 | 1.74 |
| Einheitenseite | 1.63 | 1.31 |
| Eigentümerliste (`/personen`) | 1.57 | 1.17 |

Vier Regeln, jede aus einer Messung:

1. **`auto-fit`, nicht zwei feste Spalten.** Unter der Mindestbreite fällt die
   zweite weg und alles stapelt sich wie bisher. Die Schwelle ist ausgemessen:
   Mit 30rem standen die Spalten auf einem **1280er** Bildschirm noch
   untereinander (Bahn 960 px, zwei 480er Spalten mit Lücke brauchen 984). Mit
   28rem passt es ab 1280. `--arbeitsspalte-min`.
2. **`align-items: start`, nicht `stretch`.** Anders als bei `.kacheln` sind das
   keine gleichrangigen Karten, sondern zwei Stapel verschiedener Länge.
3. **Den Abstand setzt die Spalte, nicht der Block.** Jeder Block, der noch sein
   eigenes `margin-top: 2rem` trug, liess die beiden Spalten auf verschiedener
   Höhe beginnen.
4. **Nicht überall.** Auf `/personen` war das Nebeneinander **schlechter**: Die
   Tabelle führt eine Spalte mit Gemeinschaftsnamen und wuchs in halber Bahn von
   685 auf 1196 px — die Seite wurde von 1.57 auf 1.75 Bildschirme *länger*.
   Dort bekommt die Liste die ganze Breite und das Formular wartet zugeklappt.
   **Wer die Fläche aufteilt, misst beide Spalten einzeln nach.**

Und was die Aufteilung erst brauchbar machte: **eine Tabelle, die in halber Bahn
nicht explodiert.** Die Eigentümertabelle stand bei 548 px auf 2362 px Höhe. Zwei
Änderungen brachten sie auf 1108: Der **Name selbst** wurde zum Verweis auf die
Person statt einer eigenen Zeile darunter, und die Spaltenköpfe heissen «Köpfe»
und «Quote» statt «Kopfstimmen» und «Wertquote» — mit `white-space: nowrap` zwang
der lange Kopf die Namensspalte enger, als sie sein musste.

### Erst erfassen, dann zuordnen

Wo ein Ablauf eine Reihenfolge hat, steht sie auch so auf der Seite — und sie ist
nummeriert. Gemeldet am 12.08.2026: «Bei Eigentümer und Zuordnung müsste die
Reihenfolge gedreht werden, da zuerst die Eigentümer erfasst und dann zugeordnet
werden müssen.» Vorher stand das Zuordnen oben und verwies für den fehlenden
Eigentümer nach unten.

Die Ziffer (`.kachel .ziffer`) ist für die Sprachausgabe ausgeblendet: Dort steht
sie schon im Satz darunter, und «1 Eigentümer erfassen» liest sich als Anzahl.

### Ein Erfassungsblock ist eine Kachel

Jeder Block, in dem etwas eingetragen wird, trägt `.kachel`: Rahmen, Grundfläche,
Überschrift. Gemeldet am 12.08.2026: «Einheiten Hinzufügen, Nutzniessung erfassen
und dgl. auch in einer Kachel darstellen.» Auf der Einheitenseite stand «Einheit
hinzufügen» als blosse Überschrift über einem Formular, während links die
Wertquoten in einem Kasten sassen — zwei Blöcke nebeneinander, einer gerahmt,
einer im Nichts.

### Ein Erfassungskasten ordnet nach Fragen, nicht nach Platz

Gemeldet am 26.08.2026 zur Kachel «Einheit hinzufügen»: «sieht etwas unruhig
aus. Es muss ruhiger und strukturiert aussehen … WQ könnte man besser
strukturieren, ggf. untereinander, damit es identisch aussieht. Jetzt wirkt es
wie als hätte man es einfach aufgereiht.»

Nachgemessen stimmte das, und die Ursache war nicht die Auswahl der Felder,
sondern **dass ein einziges `.felder`-Raster sie der Reihe nach auffüllte**. Wie
viele Felder eine Zeile fasst, hängt an der Spurenzahl; wie viele Felder es
gibt, hängt an der Zahl der Quotenarten. Also entschied die Gemeinschaft über
die Anordnung:

| Quotenarten | Wo «Trägt eine Kopfstimme» steht |
|---|---|
| 1 | Zeile 3, links |
| 2 | Zeile 3, rechts (neben «Aufzug») |
| 4 | Zeile 4, rechts (neben «Waschküche») |

Zwei Gemeinschaften nebeneinander sahen deshalb verschieden aus, und neben der
Stammquote stand jedes Mal ein anderes Feld.

**Ein Kasten mit mehr als einer Frage wird in Abschnitte geteilt**, in der
Reihenfolge, in der man sie beantwortet — hier: Was ist es? Mit welchem Anteil?
Zählt es als Kopf? Jeder Abschnitt läuft über die ganze Breite und ist vom
nächsten durch eine Haarlinie getrennt. Damit hängt die Anordnung an der Sache
und nicht mehr an der Zahl der Felder.

**Gleichartige Felder stehen untereinander, jedes in derselben Vorlage.** Die
Wertquoten sind ein eigenes Raster mit drei festen Spuren — Name, Feld, Nenner.
Weil jede Zeile dieselbe Vorlage führt, fluchten Felder und Nenner
untereinander, ohne dass es dafür ein gemeinsames `subgrid` bräuchte. Gemessen
bei 1440 px: jede Zeile 384 × 44 px, das Feld bei x = 1093, der Nenner bei
x = 1217 — bei einer Quotenart wie bei vier.

Die Spur nach `min-content` zu bemessen ist der naheliegende Griff und ist
falsch: Dann ist sie in jeder Zeile so breit wie ihr eigenes Wort, und genau das
Fluchten geht verloren. Reicht der Platz nicht — bei 320 px bleiben der
Namensspur 64 px, «Waschküche» lief unter das Feld —, rückt der Name **über**
seine Zeile statt die Spur zu verengen.

**Der Nenner steht neben dem Feld, nicht darüber.** `.felder > label` ist eine
Flex-Spalte: Ein `<span>` darin bekommt eine eigene Zeile, auch wenn im Quelltext
`{a.name} <span>/{a.denominator}</span>` steht. Gemessen war «/1000» eine eigene
23 px hohe Zeile, das Quotenfeld dadurch 100 px hoch gegen 64 px beim Feld
daneben — in derselben Rasterzeile, mit ungleichen Unterkanten.

**Was aus `.felder` herausgenommen wird, verliert dessen Regeln.** `.kasten`,
`.breit` und `.voll` sind auf **direkte** Kinder des Feldrasters festgeschrieben.
Das Ankreuzfeld in einen blossen `<div>` zu verschieben nahm ihm im ersten Anlauf
`display: flex`, den Abstand zur Beschriftung und die Mindesthöhe: 20 px statt
44, also unter `--ziel-min`. Der Abschnitt trägt deshalb selbst `.felder`.

### Tabellen sortiert und filtert man

Jede Tabelle mit mehr als einer Handvoll Zeilen bekommt beides (Auftraggeber,
12.08.2026). Sortiert wird über `Sortierkopf.svelte` und `domain/tabellensortierung.ts`,
gefiltert über die bestehende `.suchleiste` und `filtereNach`.

Fünf Entscheidungen, die im Kern stehen und deshalb überall gleich gelten:

1. **Zahlen als Zahlen** — als Text stünde 1000 vor 900.
2. **Text mit natürlicher Zahlenfolge und Schweizer Sortierung** («Wohnung 2» vor
   «Wohnung 10», «Ärgerlich» zwischen «Anfang» und «Auto»).
3. **Leeres steht hinten, in beiden Richtungen.** Der erste Versuch rechnete
   `richtung * vergleiche(…)` und drehte damit auch diese Regel um: Beim zweiten
   Klick auf «E-Mail» standen alle Zeilen ohne Adresse zuoberst. Vom Test
   gefunden, nicht vom Auge.
4. **Drei Zustände: auf, ab, aus.** Ohne den dritten gäbe es keinen Weg zurück zur
   ursprünglichen Reihenfolge — und die trägt bei Traktanden und Einheiten eine
   eigene Bedeutung, die keine Spalte abbildet.
5. **`aria-sort` an der Zelle, ein `<button>` darin.** Nur der Knopf ist mit der
   Tastatur erreichbar; das `aria-sort` gehört laut Spezifikation an das `<th>`.

**Die gefährliche Stelle: eine Tabelle mit Formularfeldern.** Die Einheitentabelle
trägt je Zeile Eingabefelder. Deren Namen hängen an der **Kennung**
(`label.<id>`), nicht an der Stelle — sonst schriebe ein Speichern nach dem
Sortieren die Werte in die falschen Einheiten, und es fiele erst auf, wenn eine
Wertquote nicht mehr aufginge. Gefiltert wird dort mit `display: none` statt durch
Entfernen: Eine entfernte Zeile schickt ihre Felder nicht mit.

Und noch eine Falle derselben Art wie bei den Feldern: **Was die Komponente
zeichnet, gestaltet sie auch.** Sobald die `<th>` aus `Sortierkopf.svelte` kamen,
meldete svelte-check die `th`-Regeln der Seiten als «unused selector» — Svelte
kapselt Stile je Datei. Die Kopfgestaltung steht jetzt in der Komponente, die
Spaltenbreite an den `td`.

**Die Kehrseite: Ein `<th>`, das nicht aus der Komponente kommt, hat danach gar
keine Gestaltung mehr** (UI-Durchgang 06.10.2026). Die Entfernen-Spalte der
Einheiten trug «Zeile» in 17 px, fett, weiss und ohne Linie neben Köpfen von
12.8 px in Grossbuchstaben, gemeldet als erstes Bild des Durchgangs; die zweite
Tabelle auf `/personen` sah gleich aus. Eine Seite mit Sortierköpfen gestaltet
ihre übrigen `th` deshalb selbst, mit denselben Werten wie `Sortierkopf.svelte`,
und ein Kopf über einer Spalte mit Knöpfen trägt seine Beschriftung nur für
Vorleseprogramme (`.nurLeser`): Der Knopf sagt in jeder Zeile selbst, was er
tut. Die Befunde des ganzen Durchgangs stehen in
`befunde-ui-durchgang-2026-10-06.md`.

### Was fehlt, steht in der Leiste

Eine Lücke in den Stammdaten steht dort, wo man sie im Vorbeigehen sieht: an der
Seitenleiste, mit «!» und einem Satz. Gemeldet am 12.08.2026: «Bei Eigentümer und
Zuordnung und auch Einheiten und Wertquoten mit einem Icon kennzeichnen, wenn die
Zuordnungen nicht vollständig ist. Ziel, damit der Nutzer es sofort sieht.»

Drei Regeln:

1. **Ein Satz, nicht nur ein Zeichen.** «!» allein sagt, dass etwas ist, nicht
   was — und per Sprachausgabe hört man gar nichts. «2 Einheiten ohne
   Eigentümer» sagt beides.
2. **Die Warnung steht immer da**, anders als der Stand, den nur die laufende und
   die offene Zeile tragen. Sie ist der Grund, warum jemand hinsehen soll.
3. **Gerechnet wird im Kern** (`einheitenluecke`, `zuordnungsluecke`), nicht in
   der Leiste: Denselben Satz brauchen die Gemeinschaftsleiste, der Ablauf einer
   Versammlung und später der Prüfbericht.

Zwei Zusätze vom 12.08.2026, beide aus derselben Rückmeldung:

4. **Nur, wo schon gearbeitet wurde.** Ein Schritt, an dem noch gar nichts steht,
   ist keine Lücke, sondern der Anfang — vier Ausrufezeichen an einem frisch
   angelegten Abend wären ein Alarm über den Normalfall. Warnung setzt
   `gemeinsamerablauf.ts` deshalb nur bei `0 < offen < haeuser`.
5. **Kurz in der Leiste, ausgeschrieben auf der Seite.** Die Warnung steht an
   allen vier Themen zugleich; «2 von 6 Gemeinschaften noch offen» brach jedes
   Mal auf zwei Zeilen um und machte die Leiste um 160 px länger (gemessen bei
   1440 px). In der Leiste steht «2 von 6 offen», im `stand` und im Weiterweg der
   ganze Satz.

### Eine Umwandlung, nicht zwei Abschriften

Was Kern und Oberfläche verbindet, steht an **einer** Stelle. Am 12.08.2026 zeigte
sich, was sonst passiert: Ein Ablaufschritt wurde zweimal in einen Leistenpunkt
umgeschrieben — in `ablaufleiste.ts` für die einzelne Versammlung und von Hand im
Layout des gemeinsamen Abends. Das neue Feld `warnung` kannte nur die erste
Abschrift. Der Kern setzte es richtig, die Tests waren grün, und in der Leiste des
Abends stand nichts.

Ein Feld, das an einer von zwei Stellen fehlt, ist schlimmer als eines, das nirgends
da ist: Man sieht es an der Stelle, wo es klappt, und hält die andere für einen
Sonderfall. Seither macht das `alsPunkt(schritt, weg)`, und was sich unterscheidet
— hier der Weg mit oder ohne Herkunft —, geht als Parameter hinein.

### Offene stehen oben und sind gezeichnet

Wo eine Seite mehrere gleichartige Kacheln zeigt und einige davon etwas verlangen,
werden sie **getrennt und gezählt**. Gemeldet am 12.08.2026 zur Sammelansicht:
«Hier sehe ich keine Veränderung. Fehlende Einträge können da leicht übersehen
werden.» Sechs Kacheln sahen gleich aus; die zwei mit «noch keine Einheit erfasst»
standen an vierter und sechster Stelle.

Vier Regeln, jede gemessen:

1. **Zwei Gruppen mit Überschrift**, sobald beide belegt sind: «Noch offen 2 von
   6», dann «Erfasst 4 von 6». Die erste offene Kachel rückte damit von Stelle 4
   (y = 415 px) auf Stelle 1 (y = 240 px). Ist nur eine Gruppe belegt, bleibt es
   bei einem Satz — eine Überschrift über allem, was da ist, gliedert nichts.
2. **Drei Träger für dieselbe Aussage** an der Kachel (`Karte`, `offen`): farbige
   Kante, «!» im Titel, Antwort in Warnfarbe. Die Kante fällt im Überfliegen auf,
   das Zeichen hält beim Titel, die Farbe zeigt, *was* fehlt.
3. **Auch das Offene bekommt ein Zeichen.** In der Reiterleiste trug bis dahin nur
   das Erledigte einen Haken — wer die offenen suchte, suchte eine Abwesenheit, und
   die sieht man schlechter als ein Zeichen. Beide Zustände tragen den Text
   versteckt mit («Erledigt: », «Noch offen: »), nicht nur die Farbe.
4. **Umsortiert wird nur, was keine Ordnung hat.** Die Häuser eines Abends stehen
   in der Reihenfolge, in der sie zugeordnet wurden — die sagt nichts, also dürfen
   die offenen nach vorn (`haeuserNach` im Kern, stabil innerhalb der Gruppen). Die
   vier Stammdatenthemen bauen aufeinander auf; dort bleibt die Folge und nur die
   Markierung sagt, wo etwas fehlt.

### Die Einordnung steht zuerst, nicht zuletzt

Was einen Gegenstand **einordnet**, gehört an den Anfang des Formulars — vor die
Einzelheiten, nicht dahinter. Gemeldet am 12.08.2026: «Jetzt erfasse ich zwei neue
Gemeinschaften und möchte eine übergeordnete Gemeinschaft erfassen. Wie mache ich
das? Die Frage müsste weiter oben kommen, als erstes.»

Die Frage gab es längst — als letztes Feld, nach Zählweise, Stichentscheid,
Vollmachten und KI, gemessen 2600 px unter dem Seitenanfang. Wer sie nicht kannte,
fand sie nicht.

Drei Regeln:

1. **Die Einordnung zuerst.** Wovon etwas ein Teil ist, entscheidet mit, was
   danach richtig ist — bei der Gemeinschaft etwa, ob der Nenner ihr eigener ist
   oder ihr Anteil an der übergeordneten.
2. **Der Normalfall ist vorgewählt und steht oben** («Nein, sie steht für sich»).
   Eine erste Frage, die man beantworten *muss*, hält alle auf, die sie nicht
   betrifft.
3. **Kein Feld verschwindet lautlos.** Solange es keine andere Gemeinschaft gibt,
   stand dort gar nichts — und die zwingende Reihenfolge (erst die übergeordnete, dann
   die Häuser) erfuhr man nirgends. Jetzt steht an derselben Stelle der Satz, der
   sie nennt.

### Ein Dokument, das man unterschreiben kann, muss seine Lücken nennen

Sobald ein Erzeugnis der Anwendung ausserhalb rechtlich wirkt — ein Protokoll,
das signiert wird —, ändert sich, was eine fehlende Angabe bedeutet. Vorher war
sie unschön; jetzt belegt jemand einen Beschluss, den es so nie gab.

Gebaut am 12.08.2026 für das Protokoll des Abends (Auftraggeber: «Das Protokoll muss
rechtsgültig sein. Ich kann das PDF dann digital mit Skribble signieren»). Drei
Regeln, die dabei entstanden:

1. **Der Mangel steht dort, wo das Dokument gelesen wird** — im Titel, im Kopf,
   am Schluss **und in der Fusszeile jedes Blatts**. Wer nur Seite 3 in der Hand
   hält, muss ihn sehen. Auch der Dateiname sagt es
   (`Protokoll-Entwurf-Abend-….pdf`).
2. **Der Unterschriftsblock fehlt im Entwurf ganz.** Er wäre die Aufforderung,
   trotzdem zu unterschreiben.
3. **Die Lücke wird im Kern gerechnet**, nicht in der Anzeige — dieselbe Zahl
   entscheidet über Titel, Vermerk, Dateiname und den Hinweis in der Leiste. Zwei
   Rechnungen liefen auseinander, und eine davon spräche jemanden frei.

Die Probe: Kann man dem Dokument ansehen, dass es unfertig ist, wenn man nur ein
Blatt davon in der Hand hält?

### Was der Gegenstand nicht kennt, fragt das Formular nicht

Ein Formular zeigt nur, was die gewählte Art überhaupt haben kann. Gefragt am
12.08.2026: «Braucht es weniger Angaben, wenn es eine übergeordnete Sammelbehälter
ist? Die Angaben dient ja nur als Gruppierung.» Ja — gemessen sieben Felder statt
zweiundzwanzig, 900 px statt 1827.

Drei Regeln, damit daraus kein Datenverlust wird:

1. **Die Liste steht im Kern**, nicht im Formular (`gemeinschaftsfelder`). Was eine
   Art braucht, hängt daran, was sie sein kann — dieselbe Auskunft braucht später
   der Prüfbericht, und zwei Stellen mit derselben Liste laufen auseinander.
2. **Ausgeblendete Werte gehen als verstecktes Feld mit.** Wer umstellt und es sich
   anders überlegt, fände sonst Zählweise und Fundstelle auf der Vorgabe — eine
   stille Datenänderung als Nebenwirkung einer Anzeigefrage.
3. **Ein ausgeblendetes Pflichtfeld darf nicht `required` bleiben.** Es steht nicht
   im DOM, sondern wird durch ein `hidden` mit gültigem Wert ersetzt; sonst
   scheiterte das Absenden an einem Feld, das niemand sieht.

Die Probe: Umstellen, speichern, zurückstellen — steht alles wieder da?

### Auch ein Formular darf zwei Spalten haben

Die Regel «Bestand links, Eintragen rechts» gilt für Arbeitsflächen. Ein langes
Formular hat dieselbe Krankheit in anderer Form: Das Anlegeformular einer
Gemeinschaft war 3007 px hoch und nutzte davon 640 px Breite von 1400.

Aufgeteilt wird nach **Art des Inhalts**, nicht nach Länge:

- **Eine Kette bleibt eine Kette.** Einordnung, Bezeichnung, Anschrift, Nenner
  füllt man von oben nach unten aus. Zwei Spalten**stapel** nebeneinander, nicht
  ein Raster über die Felder — sonst liefe die Tabulatorfolge quer durch die
  Reihen statt der Ausfüllfolge nach.
- **Unabhängige Entscheide stehen nebeneinander.** Zählweise, Stichentscheid,
  Vollmachten, KI sind vier für sich lesbare Blöcke mit je eigenem
  Reglementsbezug. `auto-fit` mit `minmax(min(29rem,100%),1fr)`, `align-items:
  start` — zwei davon wachsen beim Anklicken, und auf gleiche Höhe gezogen sprängen
  die Nachbarn mit.

Gemessen bei 1440 px: 3007 → 1692 px, also von 3.3 auf 1.9 Bildschirme. Zwei
Spalten von 1024 bis 1440 px, drei ab 1920, eine am Telefon, Querlauf überall 0.

### Derselbe Satz auf sechs Kacheln erdrückt den Unterschied

Was bei allen Kacheln gleich lautet, steht **einmal** über ihnen. Auf der
Sammelansicht trug jede der sechs den Satz «Jede Einheit mit ihrer Stammquote
erfassen, bis der Saldo aufgeht» — sechsmal dasselbe, zwei Zeilen hoch, direkt
unter der einen Zeile, auf die es ankam. Gemessen: 788 Zeichen Kacheltext vorher,
388 nachher, bei gleicher Aussage.

Die Probe ist einfach: Steht auf allen Kacheln dieselbe Zeile, gehört sie nicht auf
die Kachel.

### Der Abfrageteil unterscheidet Punkte der Leiste

Zwei Punkte derselben Leiste dürfen auf denselben Pfad zeigen und sich nur im
Abfrageteil trennen — dann muss er mitverglichen werden. Gemeldet am 12.08.2026:
«Obwohl ich auf Reglement und Quoren bin, zeigt die Sitelink Einheiten und
Wertquoten an.» Die vier Stammdatenschritte einer gemeinsamen Versammlung führen
alle auf `/tage/<id>/stammdaten` und unterscheiden sich nur durch `?thema=`; wer
den Abfrageteil wegschnitt, markierte immer den ersten.

Verglichen wird nur, was der **Punkt** mitbringt (`zeigtHierher`): Die Seite darf
weitere Parameter tragen — einen Stichtag, eine Herkunft `?zur=` —, ohne dass die
Marke verschwindet. Andersherum wäre es falsch: «Verlauf dieser Gemeinschaft»
(`/verlauf?gemeinschaft=…`) und ein blosses `/verlauf` sind zwei Ziele.

### Rückgängig gehört neben die Meldung

Wer etwas gelöst, gelöscht oder verschoben hat und es zurücknehmen will, sucht
den Weg dorthin, wo er gerade steht — nicht in einer Auswahlliste weiter unten.
Gemeldet am 11.08.2026: «Ich wollte das rückgängig machen und konnte nicht.»

Der Knopf steht deshalb **in** der Erfolgsmeldung und trägt alles mit, was zum
Zurücknehmen nötig ist — beim Lösen die alte Stelle im Ablauf. Ohne sie käme die
Versammlung ans Ende der Reihe zurück, und wer sich vertippt hat, müsste die
Reihenfolge des ganzen Saals von Hand richten.

### Ein Feld sieht überall gleich aus

Ein Formular hat **eine** Feldart. Auf der Anlegeseite standen «Bezeichnung» und
«Bemerkung» gestapelt — Beschriftung über dem Feld —, während «Tag», «Beginn»
und «Ort» daneben inline lagen, mit der Beschriftung links. Gemeldet am
11.08.2026: «Datum, Zeit und Ort sind anders dargestellt als das Suchfeld.»

Die Ursache war eine **Zwischenebene im Baum**: Die drei Felder lagen in einem
eigenen `<div class="zeile">` innerhalb von `.felder`, und `.felder > label`
greift nur auf direkte Kinder. Ein einziges einwickelndes `div` genügt also, um
die halbe Seite anders aussehen zu lassen.

Daraus zwei Regeln:

1. **Felder sind direkte Kinder von `.felder`.** Die Breite steuern `.breit`
   (zwei Spuren) und `.voll` (die ganze Reihe), nicht ein Kasten drumherum.
2. **Was mehrere Seiten brauchen, steht in `app.css`.** Die Wahlblöcke
   (`.wahlen`, `.wahl`, `.eingerueckt`) lagen nur im `VersammlungFormular` — und
   jede Seite, die dasselbe zeigen wollte, baute es neu. Genau daraus entsteht
   das Auseinanderlaufen, das man später als «komprimiert» oder «unruhig» meldet.
3. **Aber begrenzt auf den Formularzusammenhang, nicht auf jedes `input`.** Der
   erste Versuch setzte Mindesthöhe und Innenabstand global — und riss die
   Sitzungsleitung auseinander, deren Erfassungstabelle Dutzende schmaler Felder
   in einer Zeile trägt: Querlauf am Telefon von 61 auf **221 px**, 39 statt 5
   Felder ausserhalb des Bildes. Die Regel gilt jetzt für `.felder` und
   `.wahlen`. Wer eine solche Regel breit setzt, misst **mit und ohne** sie —
   der Schaden steht auf einer anderen Seite als der Nutzen.

4. **Eine Komponente bringt keine eigene Feldgestaltung mit.** Svelte kapselt
   Stile je Datei: Eine `label`-Regel im `TraktandumFormular` erreicht die Felder
   einer **Kindkomponente** nicht. Gemessen am 11.08.2026, als die Fallauswahl
   eine eigene Komponente wurde — «Fall suchen» und «Mehrheitserfordernis»
   standen mit Gewicht 400 neben einem «Titel» mit 550. Die Regeln stehen deshalb
   in `app.css` und gelten für beide Raster: `.felder` (Spalten) und `.formular`
   (gestapelt).
5. **Und keine Zwischenebene.** `.felder > label` ist ein **Kind**-Selektor. Wer
   seine Felder in ein `<div class="voll">` packt, nimmt ihnen Gewicht und Spur;
   die Klasse gehört an die Beschriftung selbst. Eine Komponente gibt ihre Labels
   deshalb ohne Hülle aus und nimmt die Spur als Eingabe entgegen.

### Was für alle gilt, wird für alle geändert

Steht dieselbe Angabe an mehreren Gegenständen, weil sie zu einem gemeinsamen
Anlass gehört — Tag, Beginn, Ort und die Art einer gemeinsamen Versammlung —,
dann gehört sie **an den Anlass** und wird von dort umgelegt. Gemeldet am
11.08.2026: «Auch sollte man dies global ändern können, damit ich nicht X mal
Angaben korrigieren muss.»

Vier Eigenschaften machen das Umlegen brauchbar:

1. **Vorangekreuzt.** Der Normalfall ist, dass alle mitziehen; die Ausnahme
   nimmt das Häkchen weg.
2. **Es sagt vorher, was es tun wird** («2 weichen zurzeit ab»), gerechnet vom
   selben Kern, der es nachher tut (`domain/umlegen.ts`).
3. **Es sagt nachher, was nicht ging** — und wo man es von Hand ändert. Eine
   Meldung, die nur die Erfolge zählt, liest sich wie «alles nachgezogen».
4. **Geschrieben wird über den bestehenden Weg** (`bearbeiteVersammlung`), nicht
   mit einem eigenen `UPDATE` daneben. Dort hängen Zustandsprüfung, Frist und
   Verlaufseintrag; ein UPDATE umginge alle drei.

### Löschen steht leise unten und fragt mit Zahlen

Was sich nicht zurücknehmen lässt, gehört ans Ende der Seite, hinter eine Linie,
mit einem unauffälligen Knopf — man sucht es nicht, man findet es, wenn man es
braucht.

Die Rückfrage kommt vom **Server**, nicht aus einem `confirm()`: Sie nennt, was
verschwindet (acht Traktanden, eine Datei, die Zuordnung zur gemeinsamen
Versammlung), und diese Zahlen kennt nur der Server. Eine Rückfrage, die bloss
«wirklich?» fragt, wird von niemandem anders als mit ja beantwortet.

Und: **Löschbar ist nur, was noch nichts bewirkt hat.** Ab der Freigabe steht
eine Versammlung in versandten Einladungen, ab dem Eröffnen ist sie ein Nachweis.
Die Absage nennt den Weg: die Freigabe zurücknehmen.

### Eine Angabe, die auf nichts zeigt, gehört weg

Die Vorschau der Übernahme führte eine Spalte «Zeile». Beim Dateiweg ist sie das
Wichtigste der Tabelle: Sie sagt, wo in der eigenen Datei der Fehler steht. Beim
Weg über immotool gibt es keine Datei — die Zahl zeigt dann auf nichts, und wer
sie liest, sucht etwas, das es nicht gibt. Sie steht seit dem 13.08.2026 nur
noch beim Dateiweg.

Dasselbe gilt für Überschriften über gemischten Listen. «Das kommt nicht mit»
stimmte für den weggelassenen Verteiler, nicht aber für den Widerspruch in den
Fremddaten und nicht für den gesetzten Vorgabewert, die in derselben Liste
standen. **Die Überschrift nennt dann den Zeitpunkt, nicht die Art:** «Bevor Sie
übernehmen».

### Was danebensteht, muss auch daneben ausgehen

`align-items: flex-end` setzt Felder auf eine Linie — solange ihre Hilfetexte
gleich lang sind. Ein vierzeiliger Hilfetext neben einem einzeiligen schob am
13.08.2026 die eine Beschriftung nach oben und die andere nach unten; die Zeile
las sich wie ein Fehler. Zwei Felder mit ungleich langen Erklärungen stehen
**untereinander**, nicht nebeneinander.

### Die Beschriftung nennt die Sache, nicht den einen Weg dorthin

Der Punkt in der Leiste hiess «Übernahme aus CSV». Als die Stammdaten auch aus
immotool kommen konnten, verdeckte er den zweiten Weg — wer ihn suchte, klickte
an ihm vorbei. Jetzt heisst er «Stammdaten übernehmen». Eine Beschriftung, die
das Verfahren nennt statt den Gegenstand, veraltet beim ersten zweiten
Verfahren.

### Was möglich ist, steht da — nicht ausgegraut, nicht hinter einem Fachwort

Gemeldet am 13.08.2026: «Immer den Fokus des Nutzers ohne Programmkenntnisse und
Stress durch die Sitzungsleitung im Hinterkopf behalten. Einfach verständlich,
intuitiv und sichtbar (nicht dominant).»

Die Eingriffe während einer Sitzung standen an vier Orten, alle zugeklappt, alle
mit einem Fachwort beschriftet: der Ausstand in der Ablaufkarte, Zurückziehen
und Rückkommen an der Zeile in der Traktandenliste, der Folgeantrag unter
«Traktandum aufnehmen» am Fuss. Jeder für sich war richtig platziert. Zusammen
ergaben sie eine Seite, auf der man wissen musste, wo man suchen soll.

Fünf Regeln, hergeleitet am Beispiel der Sitzungsleitung:

1. **Eine Zeile, nicht ein Menü.** «Jetzt möglich: Ausstand · Gegenantrag ·
   Zurückziehen · Nötige Mehrheit» steht ohne Klick da. Ein Sammelknopf wäre
   ruhiger, verlangt aber, dass man ihn öffnet, um zu erfahren, ob sich das
   Öffnen lohnt.
2. **Laiensprache in der Zeile, Fachbegriff in der Überschrift.** «Gegenantrag»
   steht in der Zeile, «(Folgeantrag)» hinter der Überschrift des geöffneten
   Feldes. Wer das Fachwort kennt, findet es; wer es nicht kennt, wird nicht
   ausgeschlossen (Regel 3 oben).
3. **Nichts steht ausgegraut da.** Ein Eintrag, den man nicht drücken kann, ist
   eine Frage ohne Antwort: Warum nicht? Was fehlt? Steht er gar nicht erst da,
   stellt sich die Frage nicht — und wo gar nichts geht, steht der Grund als
   Satz («Während der Abstimmung sind keine Änderungen möglich — schliessen Sie
   sie zuerst»).
4. **Gerechnet wird im Kern** (`domain/eingriffe.ts`), nicht in der Seite. Ob
   ein Antrag noch zurückgezogen werden darf, ist dieselbe Frage, die der Server
   beim Abschicken stellt. Zwei Fassungen liefen auseinander, und dann böte die
   Seite etwas an, das die Absage danach verweigert.
5. **Der Stand gehört nicht ins Klappfeld.** Wer im Ausstand ist und welche
   Vollmachten dadurch ruhen, steht **immer** da — daneben, nicht darin. Im
   Durchlauf vom 13.08.2026 stand es zuerst im geöffneten Feld, und das klappt
   nach dem Erklären zu: Die Sitzungsleitung hätte das Ergebnis verkündet, ohne
   die Folge je gesehen zu haben. Ein Angebot sagt, was man tun **kann**; ein
   Stand sagt, wie es **ist**. Das sind zwei Dinge.

**Und was oben steht, fehlt unten.** Dieselbe Handlung an zwei Stellen ist keine
zweite Möglichkeit, sondern eine zweite Stelle zum Suchen — die Klappfelder in
der Traktandenliste gibt es deshalb nur noch für die *übrigen* Traktanden.

### Eine Voraussetzung sperrt das Feld — vorher, nicht beim Absenden

Wo eine Eingabe an einer Bedingung hängt, die der Server schon vor dem Ausfüllen
kennt, sagt die Seite es **oben** und sperrt das Feld. Gebaut am 14.08.2026 für
die äusseren Dienste: Ohne hinterlegtes `VERSAMMLUNG_GEHEIMNIS` lassen sich
Zugangsschlüssel nicht ablegen. Ein Formular, das man ausfüllt und dessen
Absenden dann an einer Voraussetzung scheitert, ist der bequemste Weg, Eingaben
zu verlieren — und die Absage käme an der Stelle, an der man am wenigsten damit
rechnet.

Drei Teile gehören zusammen: der **Satz** über dem Formular (was fehlt), das
**gesperrte Feld** (damit man es gar nicht erst füllt) und der **Befehl**, mit
dem sich der Mangel beheben lässt. Ohne den dritten steht dort eine Diagnose
ohne Therapie.

### Was eine andere Stelle trägt, wird nicht nebenher überschrieben

Steht eine Einstellung bereits an einer anderen Stelle — hier: die KI-Kette in
den Umgebungsvariablen —, darf die Seite nicht so tun, als liesse sich einfach
danebenschreiben. Eine einzelne neu angelegte Stufe hätte die geltende Kette
schlagartig ersetzt, und im Saal antwortete plötzlich ein anderes Modell.

Der Weg ist stattdessen **übernehmen, dann ändern**: ein Knopf, der den Bestand
in die Anwendung holt, und erst danach die einzelnen Formulare. Dazu drei Sätze,
die alle drei nötig sind — woher die geltende Einstellung stammt, dass daneben
noch etwas wartet, und dass die alte Stelle stehen bleiben darf. Ohne den
ersten sucht jemand den Grund am falschen Ort.

### Eine Klasse ohne Stil ist eine Rückmeldung, die niemand sieht

Gemeldet am 17.08.2026 zu den äusseren Diensten: «Es geschieht nicht viel, wenn
ich auf Testen beim LLM klicke. Da braucht es eine Bestätigung.» Es geschah
etwas — die Seite antwortete «Mistral (EU/FR) antwortete in 282 ms
(«Bereit»)». Nachgemessen waren es drei Gründe, warum das niemand als Antwort
las:

1. **`.meldung` war auf dieser Seite nirgends definiert** — weder in ihrem
   eigenen Stilblock noch in `app.css`. Dasselbe galt für `.leise`, `.marke` und
   `.gefahr`. Svelte kapselt Stile je Datei; dass dreiunddreissig andere Seiten
   eine `.meldung` führen, hilft der vierunddreissigsten nicht. Die Bestätigung
   stand als gewöhnlicher Absatz da, der leise Knopf sah aus wie der Hauptknopf,
   und «Aus der Kette nehmen» trug keinerlei Warnfarbe.
2. Sie stand **380 px über dem Knopf**, am Seitenkopf, und das Absenden lud die
   Seite neu. Wer unten klickt, sieht oben nichts.
3. Zwischen Klick und Antwort sagte **nichts**, dass etwas läuft.

Drei Regeln:

1. **Die Antwort steht am Ort der Frage.** Der Befund einer Prüfung gehört an
   die Zeile, auf deren Knopf gedrückt wurde, nicht an den Seitenkopf — mit
   `use:enhance`, damit die Seite dabei nicht an den Anfang springt und ein
   offenes Formular daneben offen bleibt. Gemessen: 8 px unter dem Knopf statt
   380 px darüber. Und dann **nur** dort: Derselbe Satz an zwei Stellen liest
   sich wie zwei Ergebnisse.
2. **Ein Anruf zeigt, dass er läuft.** Der Knopf heisst «fragt an …» und ist
   gesperrt, solange die Antwort aussteht. Ohne das wird er ein zweites Mal
   gedrückt — die Geduld einer Stufe reicht bis zwei Minuten, und der
   Prüfzeitstempel wartet bis zu zehn Sekunden auf die Antwort. Seit dem
   13.11.2026 wiederholt er sich nicht mehr: Die Probe fragt genau den Dienst,
   dessen Kasten den Knopf trägt, in einem Anlauf.
3. **Eine Klasse, die es nur im Markup gibt, ist ein stiller Ausfall.** Dieselbe
   Klasse Fehler wie der Rückfallwert auf einer Variablen, die es gibt (siehe
   `check-stilvariablen.mjs`): Wer die Zeile liest, sieht eine Gestaltung, die
   der Browser nie anwendet. Beim Bauen einer Seite im Browser nachsehen, ob die
   geschriebenen Klassen etwas tun.

Im selben Zug wurde die Seite aufgeteilt — zwei unabhängige Dienste, die
untereinander standen, während daneben die halbe Bahn leer blieb. Gemessen bei
1440 × 900:

| Gemessen | Vorher | Nachher |
|---|---|---|
| Seite in Bildschirmen | 1.44 | 1.00 |
| Seitenhöhe | 1299 px | 900 px (ohne Rollen) |
| Zeitstempelteil | 679 px | 231 px |
| Weg vom Prüfknopf zum Befund | 380 px nach oben | 8 px nach unten |
| Sprung der Seite beim Prüfen | an den Anfang | keiner |

**Was gar nicht ging, sah aus wie etwas, das man nur nicht findet.** Im selben
Gespräch kam die Frage nach den Stufen — gemeint war ihre **Reihenfolge**, und
die liess sich überhaupt nicht ändern: Das Änderungsformular fasste jedes Feld
an ausser der Nummer. Wer suchte, suchte etwas, das es nicht gab. Zwei Regeln
daraus:

* **Wo eine Ordnung sichtbar ist, muss sie auch änderbar sein** — eine Liste mit
  Nummern behauptet, dass die Nummern etwas bedeuten. Hier bedeuten sie das
  Wichtigste: Stufe 1 ist das Modell, das im Saal antwortet.
* **Der Umweg kostet mehr als die Handlung.** Der einzige Weg war, beide Stufen
  zu entfernen und neu anzulegen — und dabei geht ein Zugangsschlüssel verloren,
  den die Anwendung nie wieder anzeigt. Ein fehlender Knopf ist nicht nur
  unbequem, wenn der Ersatzweg Daten kostet.

Die Zeile trägt die Pfeile am linken Rand, dort wo die Nummer steht, und darüber
steht ein Satz, was sie tun. **Nichts steht ausgegraut**: Die oberste Stufe hat
keinen Pfeil nach oben, der Platz bleibt aber stehen, sonst sässen die Pfeile
der Zeilen auf verschiedener Höhe. Und: **Die Angabe schrumpft, die Knöpfe
nicht** — sonst entscheidet die Länge eines Modellnamens darüber, ob eine Zeile
einmal oder zweimal umbricht, und zwei Zeilen derselben Liste stehen verschieden
hoch (Regel 5).

Das Zeitstempelformular wartet dabei **zugeklappt** hinter «Dienst ändern»: Es
war mit 430 px der längste Block der Seite und wird am seltensten gebraucht. Es
klappt von selbst wieder auf, wenn seine eigene Absage zurückkommt — dafür trägt
die `fail()`-Antwort ein Feld `quelle` (siehe «Eine Fehlermeldung erscheint an
genau einer Stelle»).

### Eine gemeinsame Klasse gehört nach `app.css`, sonst wirkt sie an einer Stelle

Svelte kapselt Stile je Datei. Eine Klasse, die in einer Komponente definiert
ist, tut anderswo **nichts** — auch dann nicht, wenn dort genau dieselbe Klasse
im Markup steht.

Gemessen am 03.09.2026 an `.flach`, dem Knopf, der wie ein Verweis aussehen
soll: **acht Verwendungen in fünf Dateien, die Regel in genau einer davon**
(`Archivschalter.svelte`). An den übrigen sieben sah «alle 137 anzeigen» mitten
im Satz aus wie ein gewöhnlicher Knopf — weisser Grund, voller Rahmen, keine
Unterstreichung. Auf der Startseite dreimal, auf `/gemeinschaften`,
`/personen`, `einheiten` und auf der Betreiberseite.

Beim Verschieben nach `app.css` kamen zwei Dinge dazu, die beide erst die
Messung zeigte:

* **Der Überfahr-Zustand.** `button:hover` in `app.css` hat 0-1-1 und schlägt
  `.flach` mit 0-1-0: Der flache Knopf bekam beim Überfahren wieder eine
  Fläche. In der Komponente war das nie aufgefallen, weil die lokale Regel
  höher spezifisch war. Eine gemeinsame Klasse braucht ihre Zustände mit.
* **Seitenlokale `button`-Regeln gewinnen.** Auf der Betreiberseite stand
  `button { background: var(--akzent) }`; mit dem Datei-Hash ist das 0-1-1 und
  schlägt die globale Klasse. Der Verweis-Knopf stand grün und rund da. Die
  Seite nimmt ihn jetzt aus: `button:not(.flach)`.

**Beide Listen einer Seite, nicht nur die obere** (03.09.2026). Auf `/personen`
wurde die erste Tabelle seit dem Prüfdurchgang II gekürzt, die zweite («Noch
nicht mit einer Person verknüpft») nicht: gemessen **210 Zeilen und eine Seite
von 9687 px**, jetzt 2751. Wer eine Liste kürzt, sieht auf derselben Seite nach,
ob daneben noch eine steht — und gibt ihr denselben Zähler, sonst sieht niemand,
wie viele es sind.

**Die Regel daraus:** Wer eine Klasse aus einer Komponente heraushebt, zählt
zuerst ihre Verwendungsstellen und misst danach **jede** im Browser. Und wo eine
Seite ihre Knöpfe pauschal gestaltet, gehört die Ausnahme in dieselbe Regel,
nicht in eine zweite daneben.

**Bewacht ist beides** (`scripts/check-hausklassen.mjs`): dass niemand die
Klasse lokal umschreibt, und dass keine Seite, die sie benutzt, daneben alle
`button` pauschal gestaltet. Das Zweite ist die unauffälligere Hälfte — der
Selektor nennt die Klasse gar nicht und hebt sie trotzdem auf. Ein `:not(…)`
im Selektor zählt dabei nicht als Umschreibung: Dort steht die Klasse gerade,
um ausgenommen zu werden.

### Ein Archiv, das mitwächst, gehört gekürzt — und zwar nach dem Filtern

Gemessen am 03.09.2026 an der Betreiberseite: 10841 px hoch, davon **8504 px
(78 %) zwei Archivtabellen** mit zusammen 180 Zeilen. Die Einstellungen, wegen
derer man die Seite überhaupt öffnet, machten 1789 px aus. Und beide Archive
wachsen mit jeder Versammlung weiter: Was heute neun Bildschirme sind, sind in
einem Jahr fünfzehn.

Die Listen laufen seither durch `begrenzt()` aus `$lib/domain/listensuche` wie
die Start-, Personen- und Gemeinschaftsliste: 25 Zeilen, darunter «N weitere —
suchen Sie oben, oder alle 125 anzeigen». Ergebnis **5258 px statt 10841, 52
Prozent kürzer**, ohne dass etwas verschwindet.

**Und zwar diese Funktion, nicht eine eigene.** Der erste Anlauf baute die
Kürzung von Hand nach — mit einer zweiten Schwelle (10 gegen 25), einer zweiten
Beschriftung und einer abweichenden Regel: Er kürzte auch, während jemand
suchte. `begrenzt()` tut das ausdrücklich nicht, und die Begründung steht dort:
Wer sucht, hat schon eingegrenzt; ihm die Treffer zu beschneiden wäre die zweite
Hürde nach der ersten. Zwei Antworten auf dieselbe Frage im selben Haus sind
schlimmer als eine unvollkommene.

Drei Regeln, und die erste ist die, an der es scheitern kann:

1. **Gekürzt wird NACH dem Filtern.** `slice(filter(alles))`, nie
   `filter(slice(alles))`. `begrenzt()` nimmt einem das ab, wenn man ihm die
   bereits gefilterte Liste gibt. Andernfalls durchsucht die Suche nur die zehn
   gezeigten Zeilen und meldet für alles andere «kein Treffer» — das sieht aus
   wie eine Antwort und ist keine. Belegt in `e2e/durchspielen.mjs` mit einem
   Eintrag, der nach dem Kürzen nachweislich **nicht** sichtbar ist: Die Probe
   schlägt zuerst auf, liest die letzte Zeile, kürzt wieder und sucht sie dann.
   Nähme sie die neueste, stünde die oben, und die Probe wäre auch dann grün,
   wenn die Suche nur die gezeigten Zeilen durchsähe.
2. **Der Zähler nennt, was wirklich dasteht.** Er sagte «125 von 125», während
   fünfundzwanzig Zeilen darunter standen: eine Zahl, die dem widerspricht, was man im
   selben Bild sieht. Gefunden hat das die Sichtprobe, nicht der Prüflauf.
3. **Wer einen bestimmten Eintrag ansteuert, braucht einen Weg dorthin.** Der
   bestehende Durchstich suchte die eben geführte Versammlung in der Liste und
   war nach der Kürzung rot, obwohl nichts fehlte: Sortiert wird nach dem
   **Versammlungsdatum**, und eine eben geschlossene Versammlung muss deshalb
   nicht zu den zehn jüngsten gehören. Wer eine Liste kürzt, zieht die
   bestehenden Durchstiche mit.

### Im Stapel addieren sich Margen zum Abstand, sie kollabieren nicht

Eine Seite auf das Stapelmodell umzustellen macht sie zunächst **höher**, nicht
kürzer, und der Grund liegt nicht am Modell (03.09.2026, gemessen an der
Reglementsseite: 5940 → 6574 px).

Im normalen Blockfluss kollabieren senkrechte Margen zweier Nachbarn zu der
grösseren von beiden. In einem Flex-Container tun sie das nicht: Sie addieren
sich zum `gap`. Jede Marge, die vorher den Abstand zwischen zwei Blöcken
gemacht hat, ist danach ein Zuschlag auf einen Abstand, den schon der Abschnitt
liefert. Gemessen standen an vierzehn Stellen 41 bis 76 px statt der
vorgesehenen 24.

Zwei Regeln in `app.css` erledigen das ein für alle Mal, und zwar für die
**direkten Kinder** eines Abschnitts, nicht für deren Inhalt:

```css
.seitenstapel > .abschnitt > * { margin-block: 0; }
.seitenstapel > .abschnitt > h2:not(:first-child) { margin-top: 1rem; }
```

Die zweite braucht es, weil sonst eine Überschrift gleich weit von ihrem
eigenen Inhalt steht wie vom vorigen Block, und die Gruppe zerfällt.

Dazu gehört die Bereinigung in der umgestellten Seite selbst: Ihre alten
Margen (`h2 { margin-top: 2rem }`, `.kasten { margin: 1.25rem 0 }` und
dergleichen) stammen aus dem Blockfluss und sind im Stapel doppelt.

**Und man kann sich nicht darauf verlassen, dass die globale Regel sie
schlägt.** `> *` hat die Spezifität 0,2,0, eine seitenlokale `.kasten` in Svelte
ebenfalls (die Kapselung hängt eine Klasse an) — bei Gleichstand entscheidet die
Reihenfolge der Bündel, und die gehört nicht zu dem, worauf man eine Gestaltung
stützt. Die zweite Regel dagegen kommt auf 0,3,1 und schlägt jede seitenlokale
`h2`-Regel; wer dort ein eigenes `margin-top` setzt, sieht es stumm verschwinden.
Beides ist ein Grund, die alten Margen wirklich zu entfernen, statt sie
überschreiben zu lassen.

**Und die Regel für die Reihenfolge der Arbeit:** erst messen, dann stapeln,
dann wieder messen. Wer nur vorher misst, verbucht den Zuschlag als
Verbesserung, weil die Reihenfolge ja besser geworden ist.

### Ein Formular für zwei Zwecke braucht drei Dinge

Die Reglementsseite legt Abweichungen an **und** ändert sie, im selben Formular
(03.09.2026). Zwei Formulare nebeneinander wären derselbe halbe Bildschirm
zweimal, mit dem Risiko, dass eine Änderung an den Feldern nur eines von beiden
erreicht. Wer das so baut, braucht drei Dinge, und alle drei sind hier zuerst
gefehlt oder falsch gewesen:

1. **Einen Schlüsselwechsel um das Formular.** `anfangswert()` setzt im Browser
   `defaultValue`, und ein `{#key aufgerufenes?.id ?? 'neu'}` erzeugt die Felder
   neu, wenn ein anderer Gegenstand hineingeholt wird.
2. **Einen Satz, der den Modus kennt.** Über der Geschäftsart stand «Eine zweite
   Regel für dasselbe ersetzt die erste» — richtig beim Anlegen, das Gegenteil
   beim Ändern, wo genau das abgewiesen wird. Ein Satz, der behauptet, was der
   Knopf darunter nicht tut, ist schlimmer als kein Satz. Gefunden hat ihn die
   **Sichtprobe**, nicht der Prüflauf.
3. **Einen Ausweg.** «Abbrechen» neben dem Absendeknopf, sonst bleibt das
   Formular auf dem aufgerufenen Gegenstand stehen und ein neuer lässt sich nur
   über ein Neuladen anlegen.

**Und die Falle, die den Wächter dazu zahnlos macht.** Der erste Drehbuchschritt
klickte «Ändern» auf einer frisch geladenen Seite und prüfte, ob die Felder die
Werte tragen. Er blieb **grün, als das `{#key}` ausgebaut wurde** — denn der
sichtbare Wert eines Feldes folgt seinem `defaultValue` von selbst, solange
niemand hineingetippt hat. Erst ein Feld, in dem etwas steht, ist «dirty» und
folgt nicht mehr; und genau das ist der Fall, für den es den Schlüsselwechsel
gibt: Wer eine Eingabe angefangen hat und sich dann entscheidet, doch den
bestehenden Eintrag zu berichtigen, sähe sonst seine halbe Eingabe neben den
Werten des Eintrags stehen und schickte sie ab.

**Die Regel daraus: Eine Probe auf Vorbelegung tippt zuerst.** Sonst misst sie
den einen Fall, in dem die Anwendung auch ohne die Vorkehrung richtig liegt.

### Was sichtbar ist, gehört auch änderbar — und der Umweg kostet den Verlauf

Dieselbe Lehre wie bei der Reihenfolge der KI-Stufen weiter oben, eine Stufe
tiefer: Eine hinterlegte Regel liess sich nur anlegen und aufheben. Der
Ersatzweg für einen Vertipper war «löschen und neu erfassen», und der kostet
mehr als Tipparbeit:

* **Die Kennung.** Sie ist der Faden, an dem der Verlauf einen Gegenstand
  wiedererkennt. Aufheben und Neuanlegen erzeugt zwei Ereignisse über zwei
  verschiedene Regeln, wo eine berichtigt wurde.
* **Die Zwischenzeit.** Zwischen Löschen und Neuanlegen gilt für diesen Fall das
  Gesetz statt des Reglements. Wer dazwischen ein Traktandum anlegt, bekommt das
  falsche Erfordernis festgeschrieben.

Ein eigener Schreibweg braucht deshalb auch eine eigene **Ereignisart**
(`bylaw.rule.changed` neben `bylaw.rule.stored`), die vorher und nachher je Feld
festhält. Zwei Regeln dazu, beide aus Fehlversuchen:

* **Die Merkmalsliste für den Vergleich führt alle fachlichen Felder**, auch die
  unscheinbaren. Führte sie bloss Schwelle und Fundstelle, liefe eine geänderte
  Enthaltungsregel als «nichts geändert» durch — und die entscheidet über
  Annahme oder Ablehnung.
* **Ohne Unterschied kein Ereignis.** Wer das Formular öffnet und unverändert
  abschickt, hat nichts geändert; ein Eintrag «geändert: nichts» wäre Rauschen
  im Beleg. Die Seite sagt es stattdessen: «Nichts geändert, die Regel steht
  unverändert da.» Ohne diesen Satz sähe das Ausbleiben jeder Meldung wie ein
  Fehlschlag aus, und der nächste Griff wäre ein zweiter Klick.

### Hilfe öffnet sich neben der Arbeit, nicht an ihrer Stelle

Gemeldet am 17.08.2026: «Wenn man auf Handbuch klickt, soll ein neues Tab
aufgehen.» Bis dahin ersetzte das Handbuch die Anwendung im selben Fenster — wer
im Saal etwas nachschlug, hatte die Sitzungsleitung nicht mehr vor sich und
musste sich zurückklicken, mitten in einer laufenden Versammlung. Nachschlagen
ist eine Handlung **neben** der Arbeit; sie darf die Arbeit nicht ersetzen.

Drei Entscheidungen dazu:

1. **Ein benannter Zielrahmen, nicht `_blank`.** Beide Verweise tragen
   `target="handbuch"`. Damit gibt es genau **ein** Handbuchfenster, und ein
   weiterer Klick auf «?» springt darin an die neue Stelle. Mit `_blank` läge
   nach fünf Fragen ein Stapel Fenster da, und im Saal sucht niemand das
   richtige heraus.
2. **Kein `rel="noopener"` dazu.** Die Kombination ergibt nach der
   Spezifikation wieder `_blank` — der Name wird dann ignoriert, und man hat den
   Stapel, den man vermeiden wollte. Vertretbar ist das hier, weil das Handbuch
   unser eigenes, statisches HTML aus demselben Abbild ist; bei fremden Zielen
   wäre die Abwägung eine andere.
3. **Das Sprungziel muss sichtbar landen.** Der Anker muss nicht nur existieren,
   er muss auch **nach oben kommen können**. Die Hilfe der Mehrheitenseite zeigte
   auf den letzten Abschnitt von `index.md`; den kann kein Browser an den oberen
   Rand holen, gemessen 686 px unter der Bildkante. Sie zeigt jetzt auf «Schritt
   6 — Die Mehrheitserfordernisse», also dorthin, wo steht, was man auf der Seite
   tut. Der Vorbehalt zur Gegenlesung geht dabei nicht verloren: Er steht als
   Warnung auf der Seite selbst.

Bewacht wird das an zwei Stellen, und beide braucht es: `handbuch-bauen.mjs`
bricht den Bau ab, wenn ein Sprungziel keinen Anker im erzeugten HTML hat oder
auf ein Kapitel zeigt, das es nicht gibt — die Anker werden aus den
Überschriften gerechnet, eine umformulierte Überschrift ändert also
stillschweigend den Anker. Und `e2e/handbuch.mjs` prüft, was der Browser daraus
macht: eigenes Fenster, Anwendung bleibt stehen, nur ein Fenster auch nach
mehreren Fragen, und das Ziel im oberen Bildviertel.

**Der Erzeuger läuft im Prüflauf mit** (`check:handbuch`), und der Pre-Commit-Hook
baut das Handbuch auch dann, wenn ein Commit nur `.md`-Dateien enthält — sonst
liefe der Wächter bei genau der Änderungsart nicht, für die es ihn gibt
(26.08.2026). Was in `docs/` steht, kann den Bau brechen; die Abkürzung «reine
Doku bricht nichts» gilt für dieses Verzeichnis nicht.

**Kein Nachlauf über das Ergebnis.** `README.md` wird zu `index.html`, und diese
Regel steht ausschliesslich in `kapitelDatei()`. Sie stand einmal zusätzlich als
Suchen-und-Ersetzen über das fertige HTML — das war nicht falsch, machte die
eigentliche Stelle aber unprüfbar: Der Wächter sah den Fehler nie, weil die
Nachbesserung ihn vorher wegräumte. Gemessen am 26.08.2026: Namensregel
absichtlich aufgebrochen, Bau blieb grün. Wer eine Regel repariert, statt sie an
einer Stelle richtig zu haben, nimmt seinem Wächter die Arbeit weg.

### Ein Formular, das schreibt, lädt die Seite nicht neu

Das Clean-Code-Audit vom 17.08.2026 an der Diensteseite fand zehn Formulare, von
denen drei `use:enhance` trugen und sieben nicht. Die sieben luden die Seite neu,
und das kostet mehr als Zeit — nachgemessen mit einer Adresse ohne Schema:

| Formular | Meldung | Formular danach | Eingabe danach |
|---|---|---|---|
| «Stufe hinzufügen» | steht oben | **zu** | **weg** |
| «Ändern» | steht oben | **zu** | **weg** |

Wer sich in einem von fünf Feldern vertippt, tippt alle fünf neu und rät, welches
gemeint war. Seither geht **jedes** schreibende Formular dieser Seite durch
dieselbe Funktion `handlung()`. Vier Regeln stecken darin, und drei davon sind
erst durch das Review dazugekommen:

1. **`update()` ohne `reset: false`.** SvelteKit leert das Formular nur bei
   Erfolg (`runtime/app/forms.js`, nachgelesen) — eine Absage behält das
   Getippte also von selbst. Bei Erfolg **muss** geleert werden: Sonst bliebe der
   eben eingetippte Zugangsschlüssel im Feld stehen, und diese Anwendung zeigt
   einen Schlüssel nie, auch nicht als Punktereihe mit dem echten Wert dahinter.
2. **Der Fokus kommt zurück.** Gemessen stand er nach jedem Absenden auf `BODY`:
   Wer die Kette mit der Tastatur um zwei Plätze schiebt, tabbt sich dazwischen
   einmal durch die ganze Seite zurück, und die Sprachausgabe sagt nichts. Drei
   Griffe nacheinander — die Handlung selbst, sonst eine andere Handlung
   desselben Gegenstands (der Pfeil nach oben verschwindet, wenn die Stufe oben
   angekommen ist), sonst die Meldung mit `tabindex="-1"`.
3. **Aber nur, wenn der Fokus herrenlos ist.** Ein Anruf darf bis zur
   eingestellten Geduld dauern. Wer inzwischen ein anderes Feld öffnet und
   tippt, bekäme ihn sonst mitten im Satz weggerissen, samt Sprung.
4. **Kein Zustand über den Server.** Ein erster Anlauf gab in der Absage mit
   zurück, welches Formular abgewiesen wurde, damit die Seite es wieder
   aufklappt. Das ist unerreichbar: Aufgeklappt wird mit `onclick`, also nur mit
   JavaScript — und wo JavaScript läuft, hält `use:enhance` den Zustand ohnehin.
   Eine Angabe, die niemand liest, sieht beim nächsten Lesen aus wie ein Faden,
   an dem etwas hängt.

**Und der Preis, den ein Prüflauf dafür zahlt:** Ohne Navigation gibt es kein
`networkidle` mehr. Der Lauf las danach den alten Stand und meldete «steht noch
da», wo alles stimmte. Gewartet wird jetzt auf den Zustand, der herauskommen
soll — und beim Aufräumen auf die Zahl der Stufen **aus der Anwendung**, denn
beim Entfernen der letzten kommt die Umgebungskette zurück und die Zeilenzahl
steigt dabei.

Festgehalten ist das alles in `e2e/dienste.mjs`: Absage lässt Formular und
Eingabe stehen, «Abbrechen» schliesst trotzdem, der Fokus landet nie auf `BODY`,
und der Schlüssel steht nach dem Speichern in keinem Feld mehr.

#### Die Regel hat seit dem 27.08.2026 einen Baustein: `absenden()`

Gezählt am 27.08.2026 standen **acht `SubmitFunction` in fünf Dateien**, dazu
zwei eingebaute in `tage/geschaefte`, zwei Attributnamen für dasselbe
(`data-marke`, `data-fokus`) und drei Antworten auf die Frage, ob nach Erfolg
geleert wird. Sie unterschieden sich vor allem darin, was sie **nicht** konnten.

**Der gemeinsame Baustein steht in `$lib/absenden.ts`.** Abgelöst sind seit dem
28.08.2026 die Einheitenseite, `Einlass.svelte`, `tage/einlass`,
`versammlungen/einlass`, `versammlungen/anwesenheit`, die **Traktandenseite**
mit `TraktandumFormular` und `Anhaenge.svelte`, dazu vier Bausteine der
Sitzungsleitung: `Wandbild`, `Pausenschalter`, `Ergebnisnachgang`,
`Eingriffe`, `Stimmerfassung` und `TraktandumAufnehmen`, dazu die
**beiden Sitzungsleitungssichten** `versammlungen/[id]/leitung` (18 Formulare)
und `tage/[id]/leitung` (16). Damit ist die
Namensfrage entschieden: **Die Fokusmarke heisst überall `data-fokus`**,
`Rueckfrage.svelte` gibt sie so aus, und `scripts/check-fokusmarke.mjs` weist
ein `data-marke` ab — es hätte heute keinen Leser mehr.

**«Abgelöst» zählt Fabriken, nicht Seiten.** `Einlass.svelte` steht auf fünf
Seiten, also auch auf `tage/leitung` und `versammlungen/leitung`; und auf jeder
der genannten Seiten tragen weiterhin Formulare **ohne** `enhance`, auf
`versammlungen/anwesenheit` acht von zwölf. «Ohne Karte einlassen» und das
eingetippte «Nachschlagen» laden dort nach wie vor die ganze Seite neu und
springen an den Anfang. Wer «abgelöst» als «die Seite springt nicht mehr»
liest, liest zu viel.

**Was die Traktandenseite dabei gelehrt hat** (28.08.2026, Befund des Auftraggebers «Jedes
mal beim Speichern springt die Seite Top»): Wer eine Seite umstellt, muss
**jeden Zustand nachziehen, den vorher das Neuladen zurücksetzte.** Drei Fälle
traten hier auf, und alle drei fielen erst im Review auf:

1. **Aufklappzustände bleiben stehen.** Beim Anlegen ist das falsch — der
   Kasten trägt seine Felder als `$state`, und `reset()` erreicht die nicht.
   Nur das Zuklappen zerstört die Komponente und gibt ihr frische Werte.
   Beim Ändern ist Stehenbleiben richtig: Zuklappen liesse die Seite unter dem
   Finger zusammenfallen, und das ist wieder ein Sprung.
2. **Eine Absage erreicht fremde Formulare.** Der offen stehende
   Anlegen-Kasten zeigte über `fehler={form?.fehler}` auch die Absage eines
   anderen Formulars derselben Seite. Deshalb benennt `fachlich()` dort neu,
   **welche Aktion** abgesagt hat.
3. **Die Quittung muss mitkommen.** Sie stand als `<p class="meldung gut">` am
   Seitenkopf, wohin niemand mehr springt. Als `<Meldung ton="gut">` blendet
   sie unten rechts ein und erreicht auch, wer weit unten in der Liste steht.

Dazu eine vierte Falle, die keinen Zustand betrifft: Ein **Datei-Upload**
verliert mit `enhance` den Ladebalken des Browsers. `Anhaenge.svelte` führt
deshalb als einzige Stelle einen eigenen Laufzustand (`laedt`) und beschriftet
den Knopf um.

**Zwei Stellen bleiben mit Absicht, wie sie sind** (28.08.2026):

* **`Votum.svelte`** hat seinen einzigen Absendeknopf in `<noscript>`. Mit
  JavaScript sichert `SicherndesFeld` selbst, das Formular wird nie
  abgeschickt; ohne JavaScript läuft `enhance` nicht. Ein `use:enhance` wäre
  dort in beiden Welten wirkungslos.
* **`Wandbild.svelte` bekommt keine Fokusmarke.** Der Wechsel der Art schickt
  über `requestSubmit()` ohne Absender ab; das einzige sinnvolle Ziel wäre das
  **gewählte** Feld, und dessen Wert steht erst zur Laufzeit fest.
  `scripts/check-fokusmarke.mjs` kann ein so gesetztes Ziel zu Recht nicht
  erkennen — den Wächter dafür aufzuweichen wäre der schlechtere Tausch.

**Was die Bausteine der Sitzungsleitung gelehrt haben**, und was die drei
Fälle der Traktandenseite ergänzt: **Ein Kindbaustein kann Zustand halten, den
weder `reset()` noch der eigene `beiErfolg` erreicht.** `Eingriffe` reicht die
Parteiauswahl an `Wahlliste` weiter, und die führt sie in eigenem `$state`.
Ohne Griff blieb die eben in den Ausstand gesetzte Partei angekreuzt, fiel aus
der Auswahlliste heraus und ging als verborgenes Feld weiter mit — die
**zweite** Ausstandserklärung scheiterte dann dauerhaft mit «bereits ein
Ausstand erklärt».

Zwei Lehren daraus:

1. **`bind:` statt Hoffen.** Wer einen Kindbaustein mit eigenem Zustand
   absendet, hebt ihn in den Elternteil und räumt ihn selbst auf.
2. **`danach` statt `beiErfolg`, wenn der Server stückweise arbeitet.**
   `?/ausstand` erklärt Partei für Partei; scheitert die dritte von fünf, sind
   die ersten zwei erfasst und die Antwort ist trotzdem eine Absage. Ein Griff
   nur im Erfolgsfall liesse die beiden angekreuzt stehen.

**Und eine dritte Lehre, aus der Stimmerfassung** (28.08.2026): **Ein Griff,
der aufräumt, muss auf den Übergang prüfen, nicht auf den Zustand.** Das
Summenformular läuft mit `reset: false` und leert seine drei Zahlen selbst,
wenn eine Handzählung zurückgenommen wurde. Die erste Fassung fragte
`if (!handzaehlung)` — und das ist auch wahr, solange gar keine Handzählung
steht, also genau dann, wenn die Sitzungsleitung ihre eben ausgezählten Zahlen
abschickt. Eine Absage hätte sie gelöscht, entgegen Regel 1 («eine Absage
behält das Getippte»); im Saal ist der Zettel manchmal die einzige Kopie.
Gefunden hat das der `/security-review`, an einer Behebung aus dem
`/code-review` eine Stunde davor — Review-Fixes brauchen selbst ein Review.

**Die vierte Lehre, aus der Sitzungsleitungssicht** (28.08.2026): **Was am
aufgerufenen Geschäft hängt, gehört in ein `{#key}`.** Auf einer Seite, die
nicht mehr neu lädt, überleben Kindbausteine den Wechsel des Traktandums, und
mit ihnen alles, was sie mit `untrack()` beim Aufbau eingefroren haben. Drei
Fälle standen hier nebeneinander, alle drei erst im Review gefunden:

* `SicherndesFeld` (im `Votum`) friert seinen `localStorage`-Merker ein und
  schriebe das Votum zum **neuen** Traktandum unter den Schlüssel des alten,
  mit einem 409 beim Sichern.
* `Eingriffe` behält den aufgeklappten Ausstandskasten samt Parteiauswahl,
  während das verborgene Feld darin schon aufs neue Geschäft zeigt.
* `vorgewaehlterGrundantrag` bliebe den ganzen Abend auf dem Traktandum
  stehen, das beim Laden aufgerufen war — ein Folgeantrag erbte dann das
  Mehrheitserfordernis des falschen Grundantrags.

**Und ein Griff, der nichts tat.** An derselben Stelle stand zuerst eine
Funktion, die zwei lokale Variablen zurücksetzte, wenn das Geschäft wechselte.
Beide wurden in dieser Datei zwar deklariert, aber nie gelesen; die
wirklichen lagen in den Kindbausteinen. Der Griff sah richtig aus, war
dokumentiert und blieb wirkungslos. **Wer Zustand «aufräumt», prüft zuerst,
wer ihn liest.**

**Dazu zwei Regeln für Fokusmarken**, beide aus dem Sicherheitsdurchgang:

1. **Gegenläufige Handlungen brauchen verschiedene Marken.** Zwei Knöpfe, die
   einander ersetzen, dürfen dieselbe tragen (Pausenschalter: «Pause» und
   «Fortfahren»), solange ein Nachdrücken folgenlos ist. Bei «Abstimmung
   freigeben» und «Abstimmung schliessen» ist es das nicht: Der Fokus landete
   auf der Umkehrhandlung, und ein Tastendruck eröffnete einen neuen Durchgang
   oder schloss die eben eröffnete Abstimmung mit null Stimmen — samt
   Auszählung und Verkündung.
2. **Der Griff braucht nicht einen zweiten Anlauf, sondern eine Kette.**
   `update()` stösst ein `invalidateAll()` an; nach `tick()` steht die
   gesuchte Marke nicht immer schon im Baum. Gemessen über vierzehn
   Durchläufe war die Fokusprobe im Drehbuch in vieren rot, ohne
   Codeänderung.

   **Korrigiert am 22.09.2026, nachdem der zweite Anlauf nicht reichte.** Er
   griff im nächsten Rahmen, und das war unter Last zu früh: Die Zielmarke
   erschien erst Sekunden später. Schlimmer noch, der erste Griff traf den
   Absendeknopf selbst, der mit der Antwort aus dem Baum fiel; der Fokus ging
   mit ihm auf `<body>`, und danach fasste niemand mehr nach.

   `absenden()` fasst deshalb **per Intervall** nach, solange der Fokus
   nirgends oder auf dem eigenen Knopf steht, und gibt nach rund zehn
   Sekunden auf. **Vier Schranken** halten die Kette im Zaum:

   - **Nur nach einem Erfolg.** Steht der Fokus nach einer Absage noch auf
     dem Knopf, ist er am richtigen Ort und es geschieht nichts. Ist er
     trotzdem herrenlos, greift der einmalige Griff mit einem Nachschlag,
     nicht die Kette.
   - **Nur mit Marke.** Ohne sie kehrt der Griff sofort zurück, und die
     Kette tickte ins Leere; die Mehrzahl der Rückfragen gibt keine Marke an.
   - **Nur als jüngste Kette.** Ein Zähler auf Modulebene beendet jede
     ältere, sobald eine neue beginnt. Sonst überlebt eine Kette ihre
     Absendung und zieht den Fokus später auf ihren alten Knopf zurück.
   - **Nur auf ihrer Seite**, verglichen am Pfad, und höchstens hundert
     Takte lang.

   Dazu bricht sie ab, sobald ein **fremder** Fokus gesetzt ist. «Fremd»
   heisst: nicht `<body>` und nicht der eigene Knopf; der Treffer auf den
   eigenen Knopf lässt sie absichtlich weitertakten, bis er aus dem Baum
   fällt.

   **`setInterval`, nicht `requestAnimationFrame`:** Für Seiten im
   Hintergrund gilt rAF als pausiert, und die Leitungssicht ist nicht immer
   die vordere Seite.

**Die fünfte Lehre, aus der Abendsicht** (28.08.2026): **Auch ein
`{#each}`-Schlüssel ist ein Zustandsschlüssel.** Die Ergebnisliste des Abends
lief über `(e.meetingId)`; `Ergebnisnachgang` führt darin zwei ungeführte
Felder — wer den Stichentscheid gefällt hat und mit welcher Begründung. Bei
einem neuen Durchgang desselben Hauses bleibt die Kennung gleich, Svelte
behielt die Komponente, und das verborgene `durchgang`-Feld zeigte schon auf
den neuen Beschluss: Eine getippte Begründung landete am falschen. Der
Schlüssel trägt jetzt beides.

**Und die Fokusmarke kann selbst zum Sprung werden.** Der Vertagen-Knopf des
Abends sitzt unten in einem `<details>`. Mit Marke war er nach dem Absenden
ein genauer Treffer, und `fokussiere()` holt einen genauen Treffer ins Bild —
die Seite rollte also zu einer nicht rücknehmbaren Handlung hin. Er trägt
jetzt keine.

Offen bleiben `betreiber/dienste` (führt `laufend` als `boolean` statt als
Rückruf; von zehn Aufrufstellen geben zwei `laufend` an, die anderen acht sind
ein blosses `absenden()`) und `tage/geschaefte` (zwei eingebaute Rückrufe, die
wörtlich `absenden({ reset: false })` sind — beide Formulare aber verborgen und
ohne Absender abgeschickt, was vor dem Umzug im Browser zu messen ist).
Bis dahin gilt: **Wer eine Seite umstellt, stellt ihre Marken mit um.**

**Was der Baustein gegenüber den Bestandsfassungen kann** — jedes davon ein
gemessener oder an der Quelle nachgelesener Befund:

| | |
|---|---|
| `reset` je Formular | Eine Tabelle, deren Felder den Bestand zeigen, darf nicht geleert werden. `reset()` setzte sie auf den Stand des letzten Seitenaufbaus zurück, und eine verborgene Kennung mit rohem `value={…}` würde dabei leer |
| Doppelklicksperre | Ohne Navigation verschluckt der Browser den zweiten Klick nicht mehr. Zwei Antworten auf dieselbe Handlung kommen in unbestimmter Reihenfolge zurück |
| Ausfall statt Fehlerseite | `{ type: 'error' }` an `update()` weiterzureichen ersetzt die **ganze Seite** durch `+error.svelte`. Ein gewöhnliches `<form>` kann das nicht: Eine gescheiterte Navigation lässt die stehende Seite in Ruhe |
| Marke am Absendeknopf | Ein Formular mit mehreren `formaction`-Knöpfen hat nicht **eine** Handlung. Die Marke steht deshalb am gedrückten Knopf, nicht am Formular |
| Gesperrt wird die Zeile | Ziel, gedrückter Knopf und **Nutzinhalt** — dieselbe Angabe, die auch der Server als Handlung liest. Über das Ziel allein wäre jede Nachbarzeile blockiert. Nicht über die Fokusmarke: Die ist zur Fokusrückgabe da, `Rueckfrage` führt sie als freiwillige Eigenschaft, und der Kartenscanner schickt ganz ohne Absender ab |

**Der dritte Fokusgriff fehlt im neuen Baustein**, und zwar mit Absicht. Er
lautet `querySelector('.meldung')?.focus()` und läuft still leer: Ein `<p>` ohne
`tabindex` nimmt keinen Fokus an. Zwei der drei Bestandsfassungen sind mit dem
Umzug vom 28.08.2026 verschwunden; in `betreiber/dienste` steht er noch, samt
einem Kommentar, der ein `tabindex="-1"` behauptet, das es nirgends gibt.

Statt ihn zum Laufen zu bringen, holt `Meldung.svelte` eine Absage selbst ins
Bild. Dort ist ohne Selektor bekannt, **welche** Meldung neu ist; ein Selektor
wüsste es nicht, denn `querySelector('.meldung')` liefert die in
Dokumentreihenfolge erste. Und der Baustein rollt **nur nach einer Absendung**
(`geradeAbgesendet()`): Ein erster Anlauf rollte bei jedem Aufbau, was auf `/z`
dem Eigentümer im Saal alle 20 bis 60 Sekunden die Abstimmung unter dem Daumen
weggerissen hätte. Die Seite lädt sich dort selbst neu, trägt eine stehende
Warnung aus der Adresse, und SvelteKit stellt den Rollstand wieder her.

**Eine Erfolgsmeldung muss durch `Meldung` gehen.** Sonst nimmt der Umbau ihr
die letzte Gelegenheit, gesehen zu werden: Ein roher `<p class="meldung gut">`
steht am Seitenkopf und wandert nicht in die Ecke unten rechts, und ohne Sprung
nach oben sieht ihn niemand mehr, der unten arbeitet. Auf der Einheitenseite
waren vier von fünf Erfolgswegen so gebaut. Im übrigen Baum stehen noch **21**
davon in zwölf Dateien, darunter die Traktandenseite, die als nächste umgestellt
werden soll. Ein Wächter dafür fehlt; solange er fehlt, gehört die Prüfung in
jeden Umzug.

**Und ein Formular hat genau einen Vorgabeknopf.** Das ist sein erster
Absendeknopf in Baumreihenfolge, und Enter in irgendeinem Feld löst ihn aus.
Ein `<button>` ohne `type` zählt mit: In HTML ist die Vorgabe `submit`.

Es gibt zwei Lagen und für jede ein eigenes Mittel.

**Der Knopf gehört gar nicht zu diesem Formular.** So war es auf der
Einheitenseite: Der Entfernen-Knopf der ersten Tabellenzeile trug `formaction`
und `formnovalidate` und war damit der Vorgabeknopf; Enter in einem
Bezeichnungsfeld löste das Entfernen aus. Dann gehört er über `form="…"` einem
eigenen, leeren Formular, nicht über `formaction` in das grosse.

**Alle Knöpfe gehören dazu, aber keiner ist ein vertretbarer Vorgabeknopf.** So
ist es in der Stimmerfassung: «Ja erfassen», «Nein erfassen» und «Enthaltung»
sind gleichrangig, und Enter traf «Ja» (28.08.2026 in Chromium gemessen,
`wahl = yes`). Dann steht ein **gesperrter** Knopf davor:

```svelte
<button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>
```

Gemessen: Ein gesperrter Vorgabeknopf hält die implizite Absendung vollständig
auf, ohne JavaScript und ohne Serverumlauf. Ein bloss verborgener täte es nicht,
er schickte nur einen leeren Wert.

**Und der erste Knopf wird immer benannt.** `data-vorgabe="<was Enter tut>"`
sagt, welche Handlung die Eingabetaste auslöst, `data-vorgabe="keiner"` steht
für den Riegel. Der Wächter `scripts/check-vorgabeknopf.mjs` verlangt die
Angabe an jedem Formular mit mehr als einem eigenen Absendeknopf und besteht bei
«keiner» auf dem `disabled`. Er kann damit nicht beurteilen, **ob** die
Entscheidung richtig ist, nur dass sie getroffen wurde: Die Reihenfolge der
Knöpfe im Baum fällt beim Lesen nicht auf, wer einen dazustellt, verschiebt den
Vorgabeknopf, und ohne die Angabe sagt es ihm nichts.

**Ein `fail()` kommt über `use:enhance` als HTTP 200 zurück.** `action_json`
setzt den Status in den Rumpf, nicht in die Antwort (`runtime/server/page/actions.js`,
nachgelesen). Jede Prüfung `antwort.status() >= 400` in einem Drehbuch prüft
damit nichts mehr, sobald die Seite umgestellt ist; `e2e/absendung.mjs` hat
dafür `ergebnisart()`.

Nachgemessen im Browser am 27.08.2026 (`e2e/stammdatenwege.mjs`, Fenster
1280×480): Rollstand vor dem Speichern 333 px, danach 333 px, Quittung unten
rechts; eine Absage steht danach unter der klebenden Kopfleiste und im Bild.
Alle drei Zusicherungen im schlechten Zustand einmal rot gefahren.

### Die Startseite ordnet nach Dringlichkeit, nicht nach Gattung

Sie beantwortet fünf Fragen, in dieser Reihenfolge — und die Reihenfolge ist
die Gestaltung:

| Abschnitt | Die Frage dahinter |
|---|---|
| **Jetzt im Saal** | Muss ich sofort irgendwohin? |
| **Zuletzt bearbeitet** | Wo war ich? |
| **Das fehlt noch** | Was hakt? |
| **In Vorbereitung** | Was kommt? |
| **Abgeschlossen** | Was war? |

**Laufend und «Termin verstrichen» stehen zusammen.** Beide sagen dasselbe: geh
sofort hin. Zwei Abschnitte dafür zwangen den Blick, zweimal zu entscheiden, ob
er gemeint ist.

**Der Schnellstart ist eine flache Zeile, kein Kartenblock**, und er trägt
**Verben**: «Versammlung anlegen», nicht «Versammlungen». Das ist der
Unterschied zur Kopfleiste — die führt zu den Listen, hier beginnt etwas Neues.
Umrandet statt gefüllt: Anlegen ist nicht das, was die Seite von einem will.

**«Zuletzt bearbeitet» ist eine Liste, keine Karten.** Was dort steht, ist
bekannt — man erkennt wieder, statt zu suchen. Der **Abstand** steht da, nicht
das Datum: «vor 10 Minuten» beantwortet die Frage, die man beim Zurückkommen
hat. Der Weg führt auf die Seite, an der weitergearbeitet wird — eine geänderte
Partei führt auf die Eigentümerliste ihrer Gemeinschaft, nicht auf eine Seite je
Partei, die es gar nicht gibt.

**Jeder lange Block wird gekürzt und nennt, was er verbirgt.** Am Prüfbestand
gemessen (25.08.2026): 66 laufende Versammlungen, 100 offene Punkte, die Seite
dreizehn Bildschirmhöhen lang; nach der Kürzung fünfeinhalb. Auch das Dringende
wird gekürzt — bei sechsundsechzig Karten sieht man gar nichts mehr. Darunter
steht immer «n weitere — alle anzeigen»: Nichts geht still verloren.

## Eine weitere Seite umstellen

1. **Messen, nicht schätzen.** Ein Playwright-Skript, das Seitenhöhe, Höhe
   jeder Karte, Reihen im Raster und Querlauf auf 390 px Breite ausgibt. Der
   Eindruck «wirkt unruhig» wird damit zu einer Zahl, die sich nachher
   vergleichen lässt.

   **Zwei Zahlen, nicht eine:** Seitenhöhe **und** leere Fläche. Sie bewegen
   sich gegeneinander, und wer nur eine misst, bekommt immer das Ergebnis, das
   er sucht. Die leere Fläche ist die Breite des kürzeren Blocks mal dem Stück,
   das er unter dem längeren freilässt.

1a. **Die Abschnitte festlegen**, bevor irgendetwas verschoben wird: Was ist
   Lage, was Bestand, was Handeln? Die Reihenfolge steht damit fest, und der
   Rest ist Umhängen. Steht auf der Seite eine `.arbeitsflaeche`, wird sie
   dabei aufgelöst, nicht umgebaut.
2. **Doppelungen suchen.** Was steht zweimal auf der Seite — einmal als Text und
   einmal als Feld? Eines von beidem muss weg.
3. **Sätze in den Kern.** Jeden Fachbegriff, der als Frage-Antwort-Paar taugt,
   nach `klartext.ts`, mit Test.
4. **Karten bauen**, Erklärungen zuklappen, Handlungen in den Fuss.
5. **Auf einen Knopf zusammenführen**, Felder ausserhalb per `form=`.
6. **Nachmessen** und die Zahl in den Commit schreiben.

## Fallen

Sie stehen ohne Nummer da: Die Zahl in der Überschrift war schon «Drei», als es
sechs waren, und wird beim nächsten Eintrag wieder falsch.

**Markup, das in einen Baustein wandert, verliert stumm seine Seitenstile.**
Svelte kapselt Stile je Datei: Ein Element bekommt den Hash der Datei, in der
sein Markup steht, und eine Regel greift nur bei gleichem Hash. Wer eine
Kopie in `src/lib/components/` zieht, nimmt also die Klassen mit, aber keine
einzige Regel dahinter.

Gemessen am 04.09.2026 beim Entdoppeln der Personenzeile: `.leise` gibt es
nirgends als Hausklasse, sondern **achtzehnmal** seitengebunden abgeschrieben.
Der ausgelagerte Knopf «Adresse der Gemeinschaft für alle übernehmen» stand
danach gefüllt und dunkel neben «Weitere Person», das seine Regel behalten
hatte: zwei gleichrangige Knöpfe nebeneinander, verschieden gezeichnet.
Dasselbe gilt für die Feldmasse (`padding: 0.4rem 0.6rem`), die in den Seiten
und nicht in `app.css` stehen.

**Der Ausweg ist nicht, die Regel nach `app.css` zu schieben.** Das war der
erste Anlauf, und er war schlimmer als das Problem: `.person` und `.nummer`
wanderten hinaus, weil eine von Hand gezeichnete Zeile auf der Nachbarseite sie
ebenfalls brauchte. `.nummer` gibt es aber an **sieben weiteren Stellen** mit
eigener Bedeutung, jede mit ihrer eigenen lokalen Regel; ein globales
`display: flex` erbte überall dort, wo die lokale Regel es nicht überschrieb,
und riss in `Traktandenwand.svelte` und im Protokoll Nummer und Titel
auseinander. Ein Klassenname, der wie ein Allgemeinplatz klingt, ist mit hoher
Wahrscheinlichkeit schon vergeben.

Drei Wege, in dieser Reihenfolge:

1. **Die Regeln in den Baustein mitnehmen.** Dann ist die Kapselung ein Vorteil
   und kein Verlust.
2. **Auch den letzten Verwender durch den Baustein schicken**, statt ihm eine
   Abschrift zu lassen. Auf `eigentuemer/[partei]` ging die bestehende erste
   Person deshalb ebenfalls durch `Personenzeile.svelte`, mit einem Zweig ohne
   Felder.
3. **Eine echte Hausklasse anlegen** — aber nur nach einer Suche über alle
   Verwender des Namens, und als eigener Block, nicht nebenbei.

Was das nicht findet: `npm run pruefen`. Stylelint sieht keine Spezifitäten
über Dateigrenzen, und `svelte-check` meldet nur die ungenutzte Regel, nicht
das ungestaltete Element. Gefunden hat es der Code-Review und danach der Blick
ins Bild.

**Ein Thema schaltet auch die Bedienelemente des Browsers.** Kästchen,
Auswahlknöpfe, Datumsfelder und Rollbalken malt der Browser selbst, und
`app.css` nimmt die ersten beiden ausdrücklich von der Hausgestaltung aus
(`main input:not([type='radio']):not([type='checkbox'])`). Ohne `color-scheme`
im Themenblock richtet er sich nach dem **Gerät** statt nach der Seite.
Gemeldet am 02.09.2026 vom Auftraggeber; nachgemessen bei heller Seite:

| Systemeinstellung | Kästchen |
|---|---|
| hell | leeres Kästchen mit Rand |
| dunkel | **schwarzer Block** |

Dazu gehört `accent-color: var(--akzent)`: Ohne sie zeichnet der Browser den
gewählten Auswahlknopf in seinem eigenen Blau, mitten in einer Anwendung, deren
Knöpfe und Verweise grün sind. Den Wert ausgeschrieben hinzuschreiben wäre ein
zweiter Schreiber — wer den Akzent ändert, liesse die Bedienelemente auf der
alten Farbe stehen.

Beides steht je Thema, nicht in `:root`: beides wechselt mit dem Thema.
`check-themenfarben` verlangt es von jedem Thema **über alle seine Blöcke
hinweg** — eine Medienabfrage, die ein paar Werte überschreibt, muss die zwei
Zeilen nicht wiederholen. Geprüft wird der zuletzt gesetzte Wert, denn so gilt
CSS. `normal` und `accent-color: auto` sind der Ausgangszustand und damit ein
Befund; ein Thema, das `light` oder `dark` heisst, muss seinen Namen im Wert
nennen. Ein Thema mit anderem Namen — ein Kontrastmodus etwa — bleibt frei,
denn `color-scheme: kontrast` gäbe es gar nicht.

**Und im Fenster davor** gilt das `meta` in `app.html`. Es steht auf `light`,
weil ohne JavaScript und vor dem Stylesheet `data-theme="light"` im Markup gilt;
`light dark` liess den Browser dort dem Gerät folgen und das Kästchen dunkel
zeichnen, während die Seite hell wurde. Das Skript in `app.html` und der
Umschalter setzen `documentElement.style.colorScheme` mit, damit auch dieses
Fenster stimmt.

**Ein Erklärabsatz sieht überall gleich aus.** Gemeldet am 02.09.2026 vom Auftraggeber
(«das Layout unterscheidet sich»), gefunden beim Nachmessen: `.einleitung` stand
in 22 Dateien und war **nirgends** zentral definiert. Fünfzehn Seiten erfanden
sie selbst, sechs gar nicht — und am Bildschirm sah man es:

| Seite | Klasse | Breite | Farbe |
|---|---|---|---|
| Verlauf, Reglement, Nutzniessung | einleitung | 672 | grau |
| Personen | lesebreite | 672 | **schwarz** |
| Protokoll | einleitung | 672 | **schwarz** |
| Quorum | einleitung | **736** | grau |

Wer die Klasse selbst definierte, machte den Absatz grau; wer nicht, bekam die
Grundfarbe des Fliesstexts. Sie steht jetzt einmal in `app.css`, und
`check-hausklassen` hält sie dort: Wer sie lokal einfärbt oder verbreitert, hebt
ihre Aussage für eine Seite auf. Ein `margin` bleibt erlaubt — das ist
Feinschliff, keine Umdeutung. **Für eine andere Aussage nimmt man einen anderen
Namen**: Die Auswertungsseite nannte ihre Kennzahlenzeile `einleitung` und
gestaltete sie gross statt leise; sie heisst jetzt `bilanz`.

Nicht bewacht wird das Überschreiben von Hausklassen überhaupt — nachgemessen
werden 8 von 18 lokal angepasst, `.formular` auf zehn Seiten. Das ist ein
legitimes Mittel, und eine Regel dagegen trüge der Bestand nicht.

**Die Breite gehört zur Klasse, nicht zur Elementregel** (aus dem Code-Review).
Ein erster Anlauf setzte nur die Farbe und verliess sich auf
`main > p:not(.breit)` — das deckt aber nur Absätze. Auf der Zugangsseite trägt
eine `<ul>` dieselbe Klasse, und nach dem Entfernen der lokalen Regel lief sie
über 1120 px, während der Absatz darüber bei 672 umbrach.

**Und der Wächter braucht einen CSS-Parser.** Der erste suchte mit einer Regex
nach `.<klasse> {` und übersah damit sechs Definitionen, die als mehrzeilige
Selektorliste geschrieben waren — die im Bestand häufigere Form —, dazu
`:global(.einleitung)`, die `font`-Kurzform und `width`. Er liest jetzt mit
`postcss`. Eine Regex über eine Sprache hat immer Verstecke.

Dieselbe Lehre ein zweites Mal, eine Runde später: Auch **den `<style>`-Block
selbst** schnitt er noch mit einer Regex heraus. Ein `'<style>'` in einer
Zeichenkette im `<script>` verschluckte den echten Block, ein `<style>` in einem
HTML-Kommentar wurde als Befund gemeldet. `postcss-html` macht beides richtig,
und zwei andere Wächter benutzen es längst.

Und die Sichtprobe zählt seither die **Heimat** mit: Verschwindet `.einleitung`
aus `app.css`, ist die ganze Bewachung gegenstandslos — der Lauf bliebe grün,
während alle Verwendungen still auf die Grundgestaltung zurückfielen.

**Eine Filterleiste aus verschieden hohen Feldern ist keine Leiste.** Gemeldet
am 02.09.2026 vom Auftraggeber: «Bei Verlauf gibt es für jeden Bereich eine eigene
Suchfunktion? … und die Suchfunktion für Personen, Kennung oder Angaben ist
nicht auf derselben Höhe wie die anderen Felder.»

Der Verlaufsfilter war ein `flex` mit `flex-wrap` und `align-items: end`. Die
Felder sind aber verschieden hoch: Eine `Suchauswahl` bringt Tippfeld, Platz für
die Trefferzahl und Liste mit (144 px), ein Datumsfeld nur sich selbst (71).
Gemessen bei 1440 px standen die sieben Felder auf **fünf** Oberkanten (289,
364, 443, 516, 543), mit Breiten von 87 bis 739 px — und die Paarungen zerrissen:
Über einem Tippfeld stand «Bereich», die zugehörige Liste rutschte in die Zeile
der Suche. Daher der Eindruck mehrerer Suchfunktionen.

Die Regel daraus: **Eine Reihe trägt nur Gleichartiges.** Die Suche steht allein,
die drei Eingrenzungen in gleich breiten Rasterspalten, Zeitraum und Knopf
darunter.

Drei Feinheiten, alle aus dem Code-Review und alle nachgemessen:

- **Unten ausrichten, nicht oben.** Eine `Suchauswahl` zeigt Tippfeld und
  Trefferzahl erst ab **neun** Einträgen (`brauchtSuchfeld` prüft
  `durchsuchbar > SUCHSCHWELLE`, und die ist 8), und die Listen sind unabhängig
  lang. Bei drei Gemeinschaften, aber fünfzehn Bereichen sässe die eine Liste
  60 px höher als ihre Nachbarn. An der Unterkante fluchten die
  Listen, mit denen gearbeitet wird.
- **Der Umbruch hängt am Platz, nicht am Fenster.**
  `repeat(auto-fit, minmax(min(16rem, 100%), 1fr))` statt Medienabfragen: Bei
  970 px Fenster ergaben drei Spalten 301 px, bei 560 px zwei Spalten 259 — die
  Stufen lagen also falsch, weil sie die Fensterbreite massen statt der
  Spaltenbreite. Und 16rem, nicht 20: Ein `<select>` schneidet einen zu langen
  Eintrag bei jeder Breite ab, dafür ist das Tippfeld da. Mit 20rem fiel die
  Leiste schon bei 1024 px auf zwei Spalten.
- **Zeilen weiter auseinander als Spalten** (`row-gap` 1.8rem gegen `column-gap`
  0.6rem), sonst zerfällt eine dreiteilige Spalte optisch wieder in
  Einzelfelder.

Gemessen, Höhe der ganzen Leiste:

| Breite | vorher | nachher |
|---|---|---|
| 1440 px | 297 | 309 |
| 1024 px | 531 | **309** |
| 768 px | 531 | **482** |
| 375 px | 690 | 735 |

Auf dem Telefon kostet die Gruppierung 45 px — der Preis für die Zeilenabstände,
die sie überhaupt sichtbar machen.

**Das Datumsformat gehört dem Browser, nicht uns.** Beim Nachmessen zeigten die
Felder «von» und «bis» `mm/dd/yyyy`; auch mit `locale: 'de-CH'` blieb es dabei,
weil Playwright nur die `Accept-Language` setzt und nicht Chromiums
Oberflächensprache. Am 02.09.2026 vom Auftraggeber im eigenen Browser geprüft: dort
steht das Schweizer Format. `<input type="date">` lässt sich nicht formatieren,
und es gibt hier nichts zu beheben — der Weg wäre ein selbstgebautes Feld, und
das kostet Barrierefreiheit.

**Wenige Pixel entscheiden über eine ganze Reihe.** Mit `--kachel-min: 24rem`
brauchten drei Karten 1176 px; das Raster neben der Seitenleiste ist auf einem
1440er Bildschirm 1120 px breit. Also standen zwei nebeneinander und die dritte
allein darunter. Der zweite Versuch mit 23rem war immer noch acht Pixel zu
breit, weil der Innenabstand der Bahn in der Rechnung fehlte. Wer den Wert
ändert, misst `.kacheln` im Browser nach, statt zu rechnen.

**Die Seitenleiste bestimmt die Seitenhöhe, nicht der Inhalt.** Die Bahn ist ein
Raster mit gleich hohen Spalten; die Ablaufleiste einer Versammlung ist rund
1300 px hoch. Sobald der Inhalt darunter liegt, bringt weiteres Kürzen für die
Seitenhöhe nichts mehr — gemessen wird deshalb der **Inhalt**, nicht die Seite.

**Der Anfangswert eines Feldes hat zwei Fallen, und sie schliessen einander
aus.** Beide sind hier aufgetreten, beide haben Daten still verfälscht:

* `value={…}` / `checked={…}` ist in Svelte 5 **reaktiv**. Bei jedem
  Neuzeichnen — und bei der Hydration — wird der DOM-Wert auf den Ausdruck
  zurückgesetzt, und was der Benutzer getippt hat, ist weg. Am 30.07.2026
  konnte sich deshalb niemand anmelden: Der Server bekam `username=` leer.
* `defaultValue={…}` / `defaultChecked={…}` erscheint **nicht im ausgelieferten
  HTML**. Nachgemessen am 11.08.2026:

  ```html
  <input type="radio" name="betriebsart" value="einfach"/>       <!-- kein checked -->
  <input type="radio" name="art" value="ordentlich" checked=""/> <!-- bind:group -->
  ```

  Ohne JavaScript ist gar nichts gewählt, und im Fenster vor der Hydration
  (gemessen: 47 ms) setzt Svelte den Serverwert nach und **überschreibt einen
  Klick**, der inzwischen erfolgt ist. Gespeichert wurde der alte Wert, ohne
  Meldung und ohne Spur; der Prüflauf brach fünf Schritte später an einer
  Stelle ab, die damit nichts zu tun hatte.

**Richtig ist beides zusammen** — `anfangswert()` und `angekreuzt()` aus
`$lib/felder`: auf dem Server als Attribut im HTML, im Browser unkontrolliert.

```svelte
<input name="ort" {...anfangswert(werte.ort)} required />
<input type="radio" name="art" value="ordentlich" {...angekreuzt(art === 'ordentlich')} />
```

<!-- waechtername-historisch: Der Absatz nennt den heutigen Wächter und den
     abgelösten Namen ausdrücklich als dessen Vorgänger. -->
Der Wächter `versammlung/anfangswert` hält beide falschen Wege fern und läuft in
`npm run pruefen` mit (`scripts/eslint/felder.mjs`; das frühere
`scripts/check-felder.mjs` ist am 24.08.2026 in ESLint aufgegangen).
Wo der Browser den Wert wirklich führt — eine Auswahl,
die einem `$state` folgen **muss** —, sagt das ein `data-gefuehrt` am Feld;
die Markierung steht im Code, nicht in einer Liste im Wächter.

Das Hydrationsfenster selbst bleibt: Es trifft jedes serverseitig gerenderte
Svelte-Formular. Ein Mensch erreicht es praktisch nicht, ein Prüfskript schon —
die meisten Drehbücher warten deshalb nach jeder Navigation kurz (etwa
`e2e/traktandenliste.mjs`).

**Ein Rasterfeld ist nie schmaler als sein Inhalt.** `min-width: auto` ist die
Voreinstellung; ein einziger langer Titel schiebt damit die ganze Seite über den
Rand. Auf der Sitzungsleitung waren es am Telefon 61 px, vier Felder ausserhalb
des Bildes — sichtbar war nichts, die Seite liess sich nur quer schieben.
Zwei Ursachen, beide gemessen: `min-width: 0` fehlte an den Spalten, und ein
`white-space: nowrap` an einem Verweis hielt «Ausschuss, Revisionsstelle oder
Verwaltung» in einer Zeile von 396 px.

**Ein seitwärts rollendes Band zieht Unsichtbares mit ins Freie.** Die
Reiterleiste am Telefon rollt waagrecht; darin lag ein für die Sprachausgabe
verstecktes «Erledigt: » mit `position: absolute`. Ohne positionierten Vorfahren
bezieht sich das auf das ganze Dokument — das Wort stand bei x ≈ 900 und zog die
Seite auf 960 px Breite. Zu sehen war nichts, die Seite liess sich nur plötzlich
quer schieben. Wer `overflow-x: auto` setzt, prüft
`documentElement.scrollWidth === clientWidth` und gibt jedem `absolute` einen
`relative`-Vorfahren.

Und noch eine aus derselben Leiste: **`max-width` auf dem Kind eines Flex-Elements
schmälert nur das Kind.** Der Verweis wurde schmal, das Listenglied blieb breit,
zwischen zwei Reitern klafften 136 px. Die Deckelung gehört auf das Glied — mit
`flex: 0 0 auto`, sonst pressen sich alle Reiter in die sichtbare Breite und
heissen «Schmi…».
