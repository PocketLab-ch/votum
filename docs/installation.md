---
title: Installation
description: Aufsetzen, erstes Konto, Sichern, Aktualisieren und Fehlersuche
date: 2026-07-31
---

# Installation

Die Anwendung besteht aus genau zwei Laufzeitteilen: einem Node-Prozess und
einer PostgreSQL-Datenbank. Es gibt keinen Zwischenspeicher, keine
Nachrichtenschlange und keinen zweiten Dienst, der mitlaufen müsste. Dasselbe
Abbild läuft auf dem Server und auf dem Notebook im Versammlungsraum;
unterschiedlich sind nur die Umgebungsvariablen.

## Voraussetzungen

| Teil | Fassung | Warum genau diese |
|---|---|---|
| Docker mit Compose | aktuell | Node 24 wird über das Abbild bereitgestellt, unabhängig vom Wirt |
| PostgreSQL | 18.x | Der Zeilenschutz ist gegen 18.4 nachgewiesen |
| Arbeitsspeicher | ab 1 GB | Eine Versammlung mit vierzehn Einheiten belegt wenig |

Alles Weitere liegt im Abbild, auch die Schrift für die PDF-Erzeugung. Es gibt
keine Systempakete, die Sie auf dem Wirt nachinstallieren müssten.

## Der kürzeste Weg: das Einrichtungsskript

```bash
scripts/einrichten.sh
```

Es fragt, wofür der Stapel gedacht ist (Notebook im Versammlungsraum, Server
hinter einem Proxy, Probelauf), schreibt die Env-Datei, würfelt die Kennwörter
der Datenbank, baut das Abbild, startet den Stapel und legt das erste Konto an.
Am Schluss stehen Adresse, Benutzername und Kennwort auf dem Bildschirm — und
in einer Datei `zugang/<datum>.txt` mit Rechten 0600, weil ein Terminalfenster
sich schliessen lässt, bevor jemand sie notiert hat.

Wahlweise fragt es zwei Dinge mehr. Auf dem Server fragt es, ob ein Proxy die
Adresse der Besucher weitergibt (`VERSAMMLUNG_ADRESSKOPFZEILE`, siehe «Ein
Reverse-Proxy davor»). Und es fragt, ob Votum selbst Mails verschicken soll; das
Mailkennwort tippen Sie im Menü verdeckt ein.

Soll ein KI-Werkzeug die Installation für Sie führen, geben Sie ihm die Datei
`INSTALLATION-KI.md` im Wurzelverzeichnis des Quellcodes.

Ohne Rückfragen, aus einer Datei:

```bash
scripts/einrichten.sh --vorlage ~/votum.conf   # kommentierte Vorlage schreiben
scripts/einrichten.sh --trocken --datei ~/votum.conf   # sagt, was es täte
scripts/einrichten.sh --datei ~/votum.conf
```

In der Antwortdatei steht kein Kennwort, auch nicht das für den Mailausgang.
Dort steht `SMTP_KENNWORT_DATEI`, der Pfad einer Datei, deren erste Zeile das
Kennwort ist. Fehlt diese Zeile und verlangt der Mailserver eine Anmeldung,
tragen Sie `VERSAMMLUNG_SMTP_KENNWORT` nachher von Hand in die Env-Datei ein.
Legen Sie die Antwortdatei ausserhalb des Quellcodes ab: Im Klon trägt das
Abbild sonst «-lokal» im Tag.

**Die Env-Datei muss `.env` oder `.env.<name>` heissen.** In ihr stehen beide
Datenbankkennwörter und `VERSAMMLUNG_GEHEIMNIS`; nur dieses Muster deckt
`.gitignore` und `.dockerignore` ab. Ein sprechender Name wie `versammlung.env`
landete im Baukontext und bei einem `git add -A` in der Historie. Das Skript
weist ihn ab.

**Eine vorhandene Env-Datei wird nie überschrieben.** Darin stehen die
Kennwörter einer laufenden Datenbank; ein neues `APP_DB_PASSWORD` sperrte die
Anwendung aus ihrer eigenen Datenbank aus, und das fiele erst beim Start auf.

Was danach folgt, steht weiter unten und gehört zum Wirt, nicht zur Anwendung:
TLS, Reverse-Proxy, Sicherung.

## Aufsetzen für den Probelauf

Der kürzeste Weg zu einer laufenden Anwendung. Für den Dauerbetrieb lesen Sie
danach den Abschnitt [Aufsetzen für den Betrieb](#aufsetzen-fur-den-betrieb).

```bash
git clone <repository> versammlung
cd versammlung
cp .env.example .env
docker compose up -d
```

Die Anwendung ist unter `http://127.0.0.1:3100/` erreichbar. Die
Migrationen laufen beim Start des Anwendungscontainers automatisch durch.

Ohne Konto kommen Sie nicht weiter; legen Sie eines an, bevor Sie die Seite
öffnen (siehe [Erstes Konto anlegen](#erstes-konto-anlegen)).

## Aufsetzen für den Betrieb

### In drei Schritten

```bash
cp .env.example .env      # ausfüllen, siehe unten
scripts/abbild-bauen.sh   # baut das Abbild und setzt VERSAMMLUNG_TAG
docker compose -f compose.prod.yml up -d
```

Läuft auf demselben Rechner auch der **Entwicklungsstapel**, gehören zwei Dinge
dazu: ein eigener Projektname, sonst übernimmt der Aufruf dessen Container, und
eine eigene Env-Datei, sonst bekommt der Entwicklungsstapel das ORIGIN des
Betriebs untergeschoben und weist dort jedes Formular ab.

```bash
cp .env .env.betrieb      # ORIGIN und Port des Betriebs eintragen
docker compose -p versammlung-prod --env-file .env.betrieb -f compose.prod.yml up -d
```

`scripts/abbild-bauen.sh` setzt den Tag in **beiden** Dateien, sobald es
`.env.betrieb` gibt (seit 03.09.2026). Davor schrieb es nur `.env` und meldete
«gesetzt» — der Betrieb lief danach weiter auf der vorigen Fassung, ohne dass
es jemandem auffiel. Einen Betrieb auf einem anderen Host erreicht es
nicht, dort kommt der Tag über die Registry («Abbild aus einer Registry»).

### Abbild bauen

`scripts/abbild-bauen.sh` baut mit einem Tag aus Datum, Uhrzeit und Commit und
trägt ihn in jede vorhandene Env-Datei ein (`.env`, und `.env.betrieb`, wo es
sie gibt). Von Hand ginge es auch, aber zwei Dinge gehen dabei
regelmässig schief, und beide fallen erst im Saal auf: der Tag `latest`, unter
dem sich die laufende Fassung später nicht mehr bestimmen lässt, und der Aufruf
aus dem falschen Verzeichnis, der den dortigen Inhalt baut.

Der Bau bricht ab, wenn der Kern etwas aus einer äusseren Schicht einbindet.
Das ist keine Stilfrage: Die Rechtslogik muss ohne Datenbank prüfbar bleiben.

**Der Tag ist die Version.** Das Skript gibt ihn als `VOTUM_VERSION` ins
Abbild und bricht ab, wenn er dort nicht ankommt. Die Anwendung zeigt ihn unten
auf der Anmeldeseite und auf jeder Seite der Verwaltung als
«Version 20261116-0854-854363d4», und jedes Abschlusspaket nennt ihn in
`MANIFEST.txt` unter «Anwendung». So lässt sich belegen, mit welchem Stand eine
Versammlung gezählt wurde; der Stand auf GitHub trägt denselben Namen als Tag.

Ohne das Skript gebaut, auch von Hand mit `docker build`, fehlt die Version:
Die Fusszeile zeigt dann «Entwicklungsstand», und das Abschlusspaket sagt
«ohne Versionsangabe». Ein Tag mit «-lokal» stammt aus einem veränderten
Arbeitsverzeichnis und hat keinen Stand auf GitHub; damit lässt sich nicht
belegen, welcher Code gezählt hat.

Zurück auf eine frühere Fassung: `VERSAMMLUNG_TAG` auf den alten Tag zeigen
lassen — in der Datei, mit der der Stapel läuft — und `up -d` wiederholen. Die Abbilder bleiben bestehen.
Migrationen laufen dabei **nicht** rückwärts — sie sind nur anfügend (AD-14),
und eine ältere Anwendung mit einer neueren Datenbank ist der Regelfall, nicht
der Notfall.

**Abbild aus einer Registry.** Läuft der Betrieb auf einem anderen Host als dem,
der baut, kommt das Abbild aus einer Registry: lokal bauen, mit dem Namen der
Registry neu taggen und pushen, auf dem Betriebshost `VERSAMMLUNG_ABBILD` auf
den Namen ohne Tag und `VERSAMMLUNG_TAG` auf den gepushten Tag setzen.
`abbild-bauen.sh` setzt dort nichts.

### Was `compose.prod.yml` anders macht

| | Entwicklung | Betrieb |
|---|---|---|
| Abbild | `node:24-alpine` mit eingehängtem Arbeitsverzeichnis | gebautes Abbild mit festem Tag |
| Migrationen | am Startbefehl der Anwendung | eigener, einmaliger Container davor |
| Datenbankport | auf dem Wirt veröffentlicht | nicht veröffentlicht |
| Anwendungsport | 3100, für alle | `VERSAMMLUNG_BIND`, voreingestellt nur der Wirt |
| Container | schreibbar, Docker-Vorgaben | `app` und `migrate` mit schreibgeschütztem Dateisystem, `/tmp` als tmpfs, ohne Capabilities, `no-new-privileges`; schreibbar bleibt nur die Ablage unter `/daten` |

Der einmalige Migrationscontainer ist **kein** dritter Laufzeitteil im Sinn von
AD-13: Er endet, bevor die Anwendung startet. Der eigene Schritt ist nötig, weil
zwei gleichzeitig startende Anwendungscontainer sonst dieselbe Migration
nebeneinander ausführten.

### Für das Notebook im Versammlungsraum

Derselbe Aufbau, drei Werte anders:

```ini
VERSAMMLUNG_BIND=0.0.0.0          # ohne Proxy davor, erreichbar im eigenen WLAN
ORIGIN=http://192.168.4.1:3000    # die Adresse, unter der die Telefone es sehen
VERSAMMLUNG_OFFLINE=true
```

`ORIGIN` muss stimmen: SvelteKit weist Formulare ab, deren Herkunft nicht dazu
passt. Ein falscher Wert zeigt sich nicht beim Aufrufen der Seite, sondern erst
beim ersten Abschicken — also im Saal.

### Umgebungsvariablen

Vollständige Liste mit Erläuterungen in `.env.example`. Die drei, ohne die
nichts geht:

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Verbindung der Anwendung, unter der **eingeschränkten** Rolle |
| `DATABASE_MIGRATION_URL` | Verbindung der Migrationen, unter der privilegierten Rolle |
| `APP_DB_PASSWORD` | Kennwort der Anwendungsrolle; der Migrationslauf setzt es |
| `VERSAMMLUNG_DATEIEN` | Verzeichnis der Dateiablage |

Wahlweise, und vom Einrichtungsskript abgefragt:

| Variable | Zweck |
|---|---|
| `VERSAMMLUNG_ADRESSKOPFZEILE` | Nur hinter genau einem Proxy: die Kopfzeile mit der Adresse der Besucher, in der Regel `x-forwarded-for` |
| `VERSAMMLUNG_SMTP_HOST`, `_PORT`, `_BENUTZER`, `_KENNWORT`, `_ABSENDER`, `_ABSENDERNAME` | Mailausgang; ohne Mailserver oder ohne Absender erscheint kein Versandknopf ([Dienste einbinden](dienste.md), «Der Mailausgang») |

Die übrigen betreffen angebundene Dienste und stehen in
[Dienste einbinden](dienste.md).

### Zwei Datenbankrollen, nicht eine

Das ist keine Feinheit. Die Anwendung läuft unter einer Rolle, die dem
Zeilenschutz unterliegt und auf dem Verlauf weder ändern noch löschen darf.

| Rolle | Zweck |
|---|---|
| `versammlung` | Migrationen. Eigentümerin der Tabellen, umgeht den Zeilenschutz. |
| `versammlung_app` | Die Anwendung. Unterliegt dem Zeilenschutz. |

Liefe die Anwendung als Superuser, wären Zeilenschutz und Schreibschutz zwar
eingerichtet, aber wirkungslos: Ein Superuser umgeht den Zeilenschutz immer,
auch bei `FORCE ROW LEVEL SECURITY`. Setzen Sie `DATABASE_URL` deshalb nie auf
die privilegierte Rolle, auch nicht vorübergehend zur Fehlersuche.

Die Rolle `versammlung_app` legt Migration 002 an, aber **ohne Kennwort** — ein
Kennwort gehört nicht in eine Datei des Repositorys. Gesetzt wird es am Ende des
Migrationslaufs aus `APP_DB_PASSWORD`. Fehlt die Variable, setzt der Lauf
nichts: Ein Wartungsaufruf von Hand darf ein bestehendes Kennwort nicht
überschreiben und damit die laufende Anwendung aussperren.

Geben Sie die Variable also beim **ersten** Migrationslauf mit, sonst kommt die
Anwendung mit `password authentication failed` nicht an ihre eigene Datenbank —
und zwar nach erfolgreicher Migration, was die Ursache verdeckt.

### Migrationen

Im Entwicklungsaufbau laufen sie beim Start mit. Das Betriebsabbild startet mit
`node build` und migriert **nicht** von selbst; in `compose.prod.yml` erledigt
das der Dienst `migrate` vor der Anwendung. Von Hand, etwa zur Fehlersuche oder
ohne Compose:

```bash
docker run --rm --network <ihr-netz> \
  -e DATABASE_MIGRATION_URL="postgres://versammlung:<kennwort>@postgres:5432/versammlung" \
  -e APP_DB_PASSWORD="<kennwort-der-anwendungsrolle>" \
  versammlung:<tag> \
  node --experimental-strip-types src/lib/server/migrate.ts
```

Eine bereits ausgeführte Migration wird nie wiederholt und nie verändert. Wer
etwas ändern will, schreibt eine neue Datei mit der nächsten Nummer. Ändern Sie
eine ausgeführte Datei nachträglich, bricht der Lauf mit einem Prüfsummenfehler
ab, und das ist die richtige Antwort.

**Die Prüfsumme geht über die ganze Datei, auch über die Kommentare.** Ein
zusätzliches Leerzeichen bricht sie so sicher wie ein geändertes `CREATE TABLE`.

**Und der Bruch zeigt sich erst beim nächsten Start.** Das ist die eigentliche
Falle: Ein laufender Container liest die Migrationen nie wieder. Am 08.09.2026
lag eine so entstandene Abweichung **einen Tag lang** unbemerkt auf dem
Entwicklungsstapel — eingespielt um 17:00, Datei danach im Kopfkommentar
nachgebessert, committet um 19:36. Dazwischen war alles grün: Prüflauf,
Durchstiche, die Anwendung selbst. Erst ein Rollout startete den Container neu,
und er kam nicht mehr hoch. Wer den Fehler dann sucht, sucht ihn am Container
und findet dort nichts.

> **Deshalb: nach jeder Arbeit an einer Migration einmal
> `docker compose restart app`**, bevor der Block als fertig gilt. Das ist der
> einzige Weg, den Blindgänger am selben Tag zu finden.

**Wenn es doch passiert ist**, entscheidet eine Frage über den Weg: Hat die
Änderung etwas **Ausführbares** berührt?

- **Ja** — und die Migration ist noch nicht committet: Wirkung von Hand
  zurücknehmen (`DROP CONSTRAINT`, `DROP COLUMN` …), die Zeile aus
  `schema_migration` löschen, Container neu starten und im Protokoll prüfen,
  dass «Migration ausgeführt: …» wirklich dasteht.
- **Ja** — und sie ist committet: eine neue Migration, nichts anderes. Auf
  einer anderen Datenbank ist die alte Fassung längst gelaufen.
- **Nein** (nur Kommentar oder Leerraum): Dann ist der **Journaleintrag**
  überholt, nicht das Schema, und die Prüfsumme wird nachgezogen. Aber erst,
  nachdem Sie das Schema gegen eine Datenbank verglichen haben, die die heutige
  Fassung eingespielt hat — Spalten, Typen, NULL-Fähigkeit, Schranken und
  Spaltenkommentare einzeln:

  ```sql
  UPDATE schema_migration SET checksum = '<sha256 der Datei>'
   WHERE name = '<datei>.sql' AND checksum = '<die alte, gemessene>';
  ```

  Die zweite Bedingung gehört dazu: Sie trifft genau den gemessenen Eintrag und
  geht sonst ins Leere. **Ohne den Schemavergleich ist dasselbe `UPDATE` das
  Gegenteil einer Reparatur** — es erklärt eine Abweichung für gültig, statt sie
  zu beheben.

### Ein Reverse-Proxy davor

Die Anwendung spricht HTTP auf Port 3000 im Container. Setzen Sie einen Proxy
mit TLS davor. Vier Punkte:

- **Server-Sent-Events dürfen nicht gepuffert werden.** Beamer und Telefone
  bekommen ihren Stand über einen offenen Datenstrom. Puffert der Proxy, sieht
  der Saal das Ergebnis erst mit dem nächsten Klick. Betroffen sind drei Routen:
  `/versammlungen/<id>/strom` (Sitzungsleitung), `/p/strom` (Beamer) und
  `/z/strom` (Telefon). In nginx genügt `proxy_buffering off;`.
- **Das Zeitlimit muss lang genug sein.** Ein Datenstrom, der nach 60 Sekunden
  abgeschnitten wird, verbindet zwar neu, aber sichtbar. Auch eine gewöhnliche
  Anfrage kann dauern: «Traktanden prüfen lassen» antwortet erst, wenn alle
  Punkte geprüft sind. Der Lauf zielt auf rund 100 Sekunden, kann aber
  darüber hinausgehen, wenn ein einzelner Aufruf an die KI hängt. Lassen Sie
  für diese Route mehrere Minuten zu (in nginx `proxy_read_timeout`).
- **Begrenzen Sie gleichzeitige Anfragen am Proxy.** Jede grosse Anfrage hält
  im Container Speicher; `compose.prod.yml` setzt einen Speicherdeckel, damit es
  im schlimmsten Fall nur diesen Container trifft. Eine Grenze der Verbindungen
  je Herkunft (in nginx `limit_conn`) fängt eine Flut vorher ab.
- **Die Adresse der Besucher muss ankommen.** Tragen Sie
  `VERSAMMLUNG_ADRESSKOPFZEILE=x-forwarded-for` ein, wenn genau ein Proxy davor
  steht und die Zeile setzt. Ohne Eintrag sieht die Anwendung nur den Proxy, und
  die Sperre gegen das Durchprobieren von Kennwörtern trifft alle zugleich.
  Begründung unter «Wenn die Anmeldung sperrt».

## Erstes Konto anlegen

Eine Selbstregistrierung gibt es bewusst nicht. Wer eine Versammlung führen
darf, entscheidet die Bewirtschaftung.

Im Entwicklungsaufbau:

```bash
printf '%s' 'ein-langes-kennwort' | docker compose exec -T app \
  node scripts/benutzer-anlegen.mjs <benutzername> "<Anzeigename>" admin
```

Im Betrieb übernimmt das `scripts/einrichten.sh`. Von Hand geht es so:

```bash
printf '%s' 'ein-langes-kennwort' | docker compose -p versammlung-prod \
  --env-file .env.betrieb -f compose.prod.yml run --rm -T \
  -e VERSAMMLUNG_BETREIBER='Ihre Bewirtschaftung' \
  migrate node scripts/benutzer-anlegen.mjs <benutzername> "<Anzeigename>" admin
```

Drei Dinge daran sind nicht beliebig:

- **Im Dienst `migrate`, nicht in `app`.** Das Anlegen des ersten Betreibers
  geht dem Zeilenschutz voraus und braucht die privilegierte Verbindung; `app`
  hat nur die eingeschränkte, und das soll so bleiben. `migrate` trägt
  `DATABASE_MIGRATION_URL` schon in seiner Umgebung — sie muss also nirgends auf
  die Kommandozeile.
- **`run --rm`, nicht `exec`.** Der Migrationscontainer hat sich nach seinem
  Lauf beendet. Der überschriebene Befehl macht daraus keinen zweiten
  Migrationslauf.
- **Das Kennwort über ein Rohr.** `-e VERSAMMLUNG_PASSWORT="…"` stellte den Wert
  in die Argumentliste des docker-Prozesses, und die steht in der Prozessliste
  des Wirts. Das Skript liest seit dem 11.09.2026 auch von der Standardeingabe.
  Über `VERSAMMLUNG_PASSWORT` geht es weiterhin, wo die Variable im aufrufenden
  Prozess schon gesetzt ist. Mindestens zwölf Zeichen.

`scripts/benutzer-anlegen.mjs` liegt seit dem 11.09.2026 im Betriebsabbild. Der
frühere Weg über ein zweites `node:24-alpine` mit eingehängtem
Arbeitsverzeichnis setzte ein ausgepacktes `node_modules` auf dem Wirt voraus —
auf einem frisch aufgesetzten Rechner gibt es das nicht, und `argon2` bringt
eine native Erweiterung mit.

**Nur das erste Konto braucht diesen Weg.** Alle weiteren legt die Verwaltung
in der Anwendung an, unter «Betreiber → Konten führen».

**Das Skript setzt keine E-Mail-Adresse**, und damit meldet sich dieses Konto
ausschliesslich über Benutzername und Kennwort an. Das ist für ein erstes Konto
richtig: Es soll gerade dann tragen, wenn sonst nichts steht. Wer es später auch
über Authentik nutzen will, trägt die Adresse in der Kontenliste nach und öffnet
dort die erste Anmeldung; wie das wirkt, steht in
[dienste.md](dienste.md#das-fenster-fur-die-erste-anmeldung).

## Das Geheimnis für abgelegte Zugangsschlüssel

Seit dem 14.08.2026 lassen sich KI-Kette und Zeitstempeldienst in der Anwendung
einrichten. Deren Zugangsschlüssel liegen dann verschlüsselt in der Datenbank —
dafür braucht es einen Schlüssel in der Umgebung:

```bash
openssl rand -hex 32     # → VERSAMMLUNG_GEHEIMNIS
```

Ohne ihn läuft alles Übrige; nur **Zugangsschlüssel lassen sich nicht in der
Anwendung ablegen**. Die Oberfläche sagt das vor dem Ausfüllen und sperrt das
Feld, statt das Absenden scheitern zu lassen.

**Getrennt von der Datenbank sichern.** Liegen Auszug und Geheimnis am selben
Ort, ist die Verschlüsselung eine Verzierung. Geht das Geheimnis verloren, sind
die abgelegten Schlüssel nicht mehr lesbar — die betroffene Stufe scheitert beim
Anruf und sagt es; man trägt den Schlüssel neu ein.

### Zwei Rollen, und was sie unterscheiden

Zwei Rollen stehen zur Wahl. Die Grenze läuft zwischen Stammdaten und
Versammlung, nicht zwischen Lesen und Schreiben:

| Rolle | Darf | Darf nicht |
|---|---|---|
| `admin` (Verwaltung) | alles | — |
| `chair` (Sitzungsleitung) | Versammlungen ansetzen und führen, traktandieren, freigeben, Zugänge ausgeben, Anwesenheit erfassen, abstimmen lassen, auswerten; Stammdaten **ansehen** | Gemeinschaften, Einheiten, Wertquoten, Eigentümer, Nutzniessung, Reglementsangaben, Personen und Betreiberangaben **ändern** |

Der Grund für die Grenze: Aus den Stammdaten errechnet sich die Stimmkraft. Wer
sie ändert, ändert das Ergebnis jeder künftigen Abstimmung. Das Ansehen bleibt
offen, weil sich ohne festgehaltenen Stand keine Beschlussfähigkeit
feststellen liesse.

Geprüft wird an einer Stelle, dem Wächter in `hooks.server.ts`, gegen die
Pfadtabelle in `src/lib/domain/rollen.ts`. Eine neue Unterseite unter
`/gemeinschaften` ist damit von selbst geschützt. Ein abgewiesener Aufruf
antwortet mit 403 und nennt den Grund.

> **Bis zum 04.08.2026 schränkten die Rollen nichts ein.** Sie standen in der
> Datenbank und wurden nirgends geprüft; wer ein Konto hatte, konnte alles.
> Konten, die vor diesem Datum vergeben wurden, sind entsprechend zu prüfen.

### Kennwort ändern, Kennwort vergessen

Das **eigene** Kennwort ändert jeder selbst: über den eigenen Namen in der
Kopfzeile, «Mein Konto». Das bisherige ist dabei anzugeben. Der Wechsel beendet
die übrigen angemeldeten Sitzungen, die eigene nicht.

Ein **vergessenes** Kennwort setzt die Verwaltung unter «Betreiber → Konten
führen» neu; dabei enden alle Sitzungen dieses Kontos. Beide Vorgänge stehen im
Verlauf.

Nur wenn kein Verwaltungskonto mehr erreichbar ist, führt der Weg über das
Skript zurück. Bei gleichem Benutzernamen wird der bestehende Datensatz
überschrieben, und eine allfällige Sperre fällt weg. Der Name muss dafür in
genau derselben Schreibweise stehen; in anderer Gross- und Kleinschreibung
bricht das Skript ab, weil ein Name nur einem Konto gehören darf (Migration
155):

```bash
docker compose exec -e VERSAMMLUNG_PASSWORT='neues-langes-kennwort' app \
  node scripts/benutzer-anlegen.mjs <benutzername> "<Anzeigename>" admin
```

### Wenn die Anmeldung sperrt

Es gibt **zwei Sperren**, gegen zwei verschiedene Angriffe:

| Sperre | zählt | Schwelle | Staffelung |
|---|---|---|---|
| nach Benutzername | Fehlversuche auf dieses Konto | 5 in 15 Minuten | 30 s bis 5 Min. |
| nach Herkunft | **verschiedene Benutzernamen** von dieser Adresse | 8 in 15 Minuten | 1 bis 15 Min. |

Die zweite zählt bewusst Namen und nicht Versuche: Im Versammlungsraum sitzen
Sitzungsleitung, Beamergerät und Notebook hinter einer Adresse. Wer sein eigenes
Kennwort zehnmal falsch tippt, bleibt dort unberührt.

Beide Staffelungen sind absichtlich kurz: Eine Sperre von Stunden würde im
Versammlungsraum die Sitzungsleitung aussperren und damit die Versammlung
anhalten. Sie laufen von selbst ab und lassen sich nicht aufheben, ohne die
Einträge aus `login_attempt` zu löschen — dafür gibt es im Betrieb keinen guten
Grund.

**Hinter einem Reverse Proxy greift die Herkunftssperre nur mit
`VERSAMMLUNG_ADRESSKOPFZEILE`** (in der Regel `x-forwarded-for`). Ohne diesen
Eintrag wäre die gesehene Adresse die des Proxys, und die Sperre träfe alle
zugleich; die Zeile ungeprüft auszuwerten wäre wertlos, weil jeder sie selbst
setzen darf. Deshalb: eintragen, wenn ein Proxy sie tatsächlich setzt, und
leer lassen, wenn die Anwendung direkt erreicht wird.

**Angenommen ist genau ein Proxy davor**, der die Adresse seines Gegenübers
hinten an die Zeile anhängt (nginx und Nginx Proxy Manager tun das mit
`$proxy_add_x_forwarded_for`). Gezählt wird deshalb der **hinterste** Eintrag:
Was vorne steht, hat der Aufrufer selbst geschickt und kann es mit jedem
Versuch wechseln. Stehen zwei Proxys hintereinander, ist der hinterste Eintrag
die Adresse des vorderen Proxys, und die Sperre träfe wieder alle zugleich;
dafür ist die Anwendung heute nicht eingerichtet.

### Prüflauf vor jedem Commit

Einmal je Arbeitskopie:

```bash
./scripts/hooks-einrichten.sh
```

Danach läuft vor jedem Commit `npm run pruefen` im Container — Schichtenwächter,
Typen, Kern- und Datenbanktests. Bei einem Fehler kommt der Commit nicht
zustande, und die letzten vierzig Zeilen der Ausgabe stehen da.

Reine Doku-Änderungen (`*.md`) überspringen den Lauf: Eine Minute Wartezeit für
einen Tippfehler im Handbuch wäre der sicherste Weg, den Hook abzuschalten.
Nicht enthalten ist der Browserdurchlauf — er braucht einen laufenden Server und
gehört vor eine Auslieferung, nicht vor jeden Commit.

Für den Notfall: `git commit --no-verify` oder `OHNE_PRUEFLAUF=1 git commit`.

## Sichern

**Datenbank und Dateiablage gehören zusammen und werden zusammen gesichert.**
Der Dateiname in der Ablage ist die Prüfsumme des Inhalts, und die Datenbank
verweist darauf. Sichern Sie nur eines von beidem, zeigt der Verweis später ins
Leere, und ein Beschluss verliert seine Beilage.

```bash
docker compose exec -T postgres pg_dumpall -U versammlung --roles-only --no-role-passwords > rollen.sql
docker compose exec -T postgres pg_dump -U versammlung -Fc versammlung > versammlung.dump
docker run --rm -v <projekt>_dateien:/daten:ro -v "$PWD":/sicherung alpine \
  tar czf /sicherung/dateien.tgz -C /daten .
```

`<projekt>` ist der Compose-Projektname, für einen Betriebsstapel etwa
`versammlung-prod` (mit `-p versammlung-prod` auch bei `compose exec`);
`versammlung_dateien` ist die Ablage des Entwicklungsstapels. Die Rollen gehören
dazu, seit das Rückspielen in einen leeren Cluster durchgespielt ist (15.10.2026):
`pg_dump` nimmt `versammlung_app` nicht mit.

Zurückspielen in umgekehrter Reihenfolge: erst die Dateien, dann die Datenbank,
dann die Anwendung starten.

### Automatisch, verschlüsselt: `scripts/sicherung.sh`

Für eine tägliche Sicherung legen Sie auf dem Betriebshost einen Zeitplan an,
etwa `/etc/cron.d/versammlung-sicherung`; das Repo bringt keinen mit. Das Skript nimmt Rollen, Datenbank und
Ablage zusammen, verschlüsselt jedes Teil an **einen** öffentlichen Schlüssel,
schreibt ein `SHA256SUMS` und einen lesbaren `stand.txt` (Abbild, Migration,
nichts Persönliches) und räumt Läufe nach 30 vollen Tagen weg, aber erst nach
einer gelungenen Sicherung. Scheitert ein Lauf, geht eine Gotify-Meldung
hinaus, und die Kennung der Meldung steht im Protokoll.

```bash
SICHERUNG_EMPFAENGER=<fingerabdruck> scripts/sicherung.sh
```

Zeitplan, Schlüssel und Ziel halten Sie in Ihrer eigenen Betriebsdoku fest. Der private Schlüssel gehört **nicht**
auf den Wirt der Sicherungen; ohne ihn lässt sich nichts zurückspielen.

**Was nicht in der Sicherung liegt, und doch dazugehört: die Env-Datei**
(`.env.betrieb`). Sie trägt `VERSAMMLUNG_GEHEIMNIS`, und mit ihm sind
die in der Oberfläche hinterlegten Zugangsschlüssel (KI, Zeitstempel) in der
Datenbank verschlüsselt. Wer mit einem anderen Geheimnis zurückspielt, startet
grün und hat unlesbare Schlüssel; auffallen würde das erst beim ersten Aufruf
im Saal. Das Geheimnis gehört deshalb getrennt gesichert (`docs/dienste.md`,
«Das Geheimnis für Zugangsschlüssel»), die Kennwörter der Datenbank dagegen
nicht: Sie werden beim Rückspielen neu gesetzt.

**Zurückspielen**, am 15.10.2026 auf einen Wegwerfstapel durchgespielt:

1. `sha256sum -c SHA256SUMS` im Sicherungsordner.
2. Die drei Teile mit dem privaten Schlüssel entschlüsseln, am besten in einem
   eigenen, danach gelöschten `GNUPGHOME`.
3. Datenbank allein hochfahren (`up -d postgres`), die Ablage ins leere Volume
   auspacken (`tar -xpf`, die Eigentümer bleiben so erhalten).
4. `rollen.sql` mit `psql -d postgres` einspielen. «role "versammlung" already
   exists» ist erwartet; wichtig ist die Rolle `versammlung_app`, ohne die das
   Rückspielen an jeder Berechtigung abbricht.
5. `pg_restore -d versammlung --exit-on-error` mit dem Auszug.
6. Den ganzen Stapel starten, mit einem Abbild mindestens auf dem Stand aus
   `stand.txt` und mit **demselben** `VERSAMMLUNG_GEHEIMNIS`. Der
   Migrationsschritt setzt das Kennwort der Anwendungsrolle aus der eigenen
   Env-Datei; die Kennwörter kamen bewusst nicht mit.

Als Nachweis taugt nicht die Zahl der Zeilen allein, sondern die Wirkung: Das
Abschlusspaket einer versiegelten Versammlung muss aus der zurückgespielten
Ablage mit genau der Prüfsumme des Siegels herauskommen.

Der Verlauf ist nur anfügbar. Eine Sicherung, die ihn auslässt, ist keine.

**Die Zahlen ersetzter Durchgänge sind so lange aufzubewahren wie das
Protokoll.** Nach einem Rückkommen nennt das Protokoll beim ersetzten Durchgang
nur das Ergebnis und verweist für die Zahlen auf die Stelle, die das Protokoll
aufbewahrt; diese Zusage trägt nur, wenn die Zahlen gleich lange aufbewahrt
werden.

### Zweite Kopie und Rückspieldrill

Ausser Haus ist eine Sicherung erst, wenn das zweite Ziel nicht im selben Haus
steht oder sie von dort weiterwandert. Steht das zweite Ziel im selben Haus, muss
es die Sicherung selbst weitertragen, etwa mit einem eigenen Lauf zu einem Speicher
ausser Haus.

**Kopie:** Mit `SICHERUNG_KOPIE=<rsync-ziel>` (endet auf `:` oder `/`) kopiert
`sicherung.sh` die Ordner nach jedem gelungenen Lauf an ein zweites Ziel und
vergleicht danach den neuen Ordner dort über seinen Inhalt. Gedacht ist ein
Konto, das am Ziel nur `rrsync` in ein Verzeichnis darf. **Kein Spiegel:** Am
Ziel wird nur gelöscht, was nach seinem Namen älter ist als die Aufbewahrung
und zwei Tage mehr. Was hier fehlt, löscht dort nichts; ein leer geräumtes
Verzeichnis hier lässt die Kopie stehen. Scheitert die Kopie, meldet der Lauf
das wie jeden anderen Fehler. Der SSH-Schlüssel dafür ist
`SICHERUNG_KOPIE_SCHLUESSEL` (beim Drill `DRILL_SSH_SCHLUESSEL`), vorgegeben
`~/.ssh/versammlung-kopie` im Heimverzeichnis des Aufrufers.

**Drill:** `scripts/rueckspieldrill.sh` spielt die neueste Sicherung, gewöhnlich
von der Kopie, auf einen Wegwerfstapel zurück, Schritt für Schritt wie oben, und
prüft die Wirkung: Jedes Abschlusspaket, jede Zeitstempelantwort und jedes
eingespielte Abschlusspaket muss mit seiner Prüfsumme aus der zurückgespielten
Ablage kommen, jedes Manifest, auch
das eines Nachtragssiegels, die Prüfsumme tragen, die als Siegel eingetragen
ist.

```bash
DRILL_QUELLE=<verzeichnis-oder-rsync-ziel> scripts/rueckspieldrill.sh < privater-schluessel.asc
```

- **Der private Schlüssel kommt über die Standardeingabe**, nie aus einer Datei
  auf dem Wirt der Sicherungen. Er lebt nur während des Laufs in einem
  `GNUPGHOME` unter `/dev/shm`. Wer ihn hält, ruft den Drill auf.
- **Entschlüsselt liegt nur, was im Stapel liegt:** Jedes Teil geht durch eine
  Pipe in dessen Volumes, keine entschlüsselte Datei daneben. Die Volumes
  liegen auf der Platte des Wirts und fallen am Ende mit `down -v` weg, ihre
  Blöcke überschreibt das nicht; den Drill deshalb nicht in die Zeit einer
  Sicherung des Wirts legen. Ein Lauf, der nicht alles wegräumt, ist rot.
- **Der Stapel spricht mit niemandem:** internes Netz (nachgesehen, bevor Daten
  hineingehen), kein Port, kein Zeitgeber, ein zufälliges
  `VERSAMMLUNG_GEHEIMNIS`. Die hinterlegten Zugänge bleiben so unlesbar, und
  ein zurückgespielter Stand verschickt nichts.
- **Abbild ist das des laufenden Betriebs** (`DRILL_TAG` übersteuert, bei
  einem Abbild aus einer Registry zusammen mit `DRILL_ABBILD`): Im Ernstfall
  wird mit der Fassung zurückgespielt, die gerade läuft.
- **Rot** wird der Lauf bei falschen Prüfsummen, einem anderen Schlüssel, einer
  Sicherung älter als 48 Stunden (`DRILL_HOECHSTALTER_STUNDEN`), einem
  abweichenden Migrationsstand, einer Anwendung, die nicht gesund startet, und
  bei jedem Paket, das nicht mit seiner Prüfsumme herauskommt. Gemeldet wird
  über Gotify, die Kennung steht im Protokoll. **Falsch rot** kann er in zwei
  Fällen werden, falsch grün nie: Lief «Löschen nach Frist» zwischen Auszug und
  Archiv der Sicherung, fehlt ein Paket, dessen Siegel der Auszug noch hat;
  und ein Ordner, der am Ziel gerade erst ankommt, hat noch nicht alle Teile.
- **Enthält die Sicherung kein Siegel und kein eingespieltes Paket**, sagt der Lauf das und meldet es mit
  niedriger Priorität: Dann sind Zurückspielen und Start geprüft, die Ablage
  aber nicht.

## Aktualisieren

1. Sichern (Abschnitt «Sichern»; am Betrieb: `scripts/sicherung.sh` von Hand, mit
   `SICHERUNG_EMPFAENGER` und `SICHERUNG_KOPIE` wie im
   Zeitplan, damit auch diese Sicherung das Haus
   verlässt).
2. Neues Abbild bauen oder ziehen.
3. Migrationen ausführen.
4. Anwendung neu starten.

**Schritt 4 ist nicht optional.** Fügt eine Migration einer Tabelle eine Spalte
hinzu, laufen offene Verbindungen in

```text
cached plan must not change result type
```

PostgreSQL merkt sich den Abfrageplan je Verbindung, und der Plan kennt die
neue Spalte nicht. Der Fehler verschwindet mit dem Neustart der Anwendung, und
nur damit. Migrieren Sie deshalb nie im laufenden Betrieb einer Versammlung.

## Der Betrieb im Versammlungsraum

Dieselbe Anwendung auf einem Notebook, das ein eigenes WLAN aufspannt. Die
Telefone der Eigentümer verbinden sich damit, der Beamer hängt am Notebook.

Drei Punkte, die dann anders sind:

- **Kein Internet ist der Normalfall, keine Störung.** Ist kein äusserer Dienst
  eingerichtet, meldet die Anwendung nichts. Erst ein eingerichteter Dienst,
  der nicht antwortet, erzeugt ein Band über jeder Seite.
- **Setzen Sie `VERSAMMLUNG_OFFLINE=true`.** Das schaltet nichts ab. Es
  kennzeichnet im Verlauf, dass die Uhr ohne Netzabgleich lief, und im
  Streitfall muss das erkennbar sein.
- **Ein Zertifikat für das eigene WLAN.** Ohne HTTPS verweigern manche Browser
  die Kamera, und dann scannt niemand einen QR-Code. Ein selbst ausgestelltes
  Zertifikat genügt, wenn es auf den Telefonen bekannt ist; sonst nehmen die
  Eigentümer den kurzen Ausgabecode.

## Prüfen, ob es läuft

Die Startseite zeigt nach dem Anmelden den Betriebszustand. Wer es genauer
wissen will, lässt die drei Testreihen laufen:

```bash
docker compose exec app npm run test      # Kern: Wertetabellen, ohne Datenbank
docker compose exec app npm run test:db   # Datenbank: Schutzregeln, Auslöser, Rechte
docker compose exec app npm run check     # Typprüfung
scripts/pruefen.sh                         # die drei zusammen, aus dem eigenen Baum
docker compose exec app npm run pruefen   # im Dev-Container: nur Hauptverzeichnis, ohne Sperre, mit voller .env
```

Die Datenbanktests legen für jeden Lauf eine eigene Datenbank an und werfen sie
danach weg. Sie fassen Ihre Daten nicht an.

## Fehlersuche

| Was Sie sehen | Woran es liegt | Was hilft |
|---|---|---|
| `cached plan must not change result type` | Eine Migration hat eine Spalte hinzugefügt, die offene Verbindung kennt sie nicht | Anwendung neu starten |
| Die Anmeldung nimmt das richtige Kennwort nicht | Sperre nach Fehlversuchen | Warten, höchstens 5 Minuten |
| Alle Seiten sind leer, keine Fehlermeldung | Die Anwendung läuft unter der falschen Datenbankrolle; der Zeilenschutz filtert alles weg | `DATABASE_URL` auf `versammlung_app` setzen |
| Migration bricht mit Prüfsummenfehler ab | Eine bereits ausgeführte Migrationsdatei wurde nachträglich geändert | Datei zurücksetzen, Änderung als neue Datei mit nächster Nummer schreiben |
| Beamer und Telefone hinken hinterher | Der Reverse-Proxy puffert den Datenstrom | `proxy_buffering off` für die Stromroute |
| Band «getrennt» über jeder Seite | Ein eingerichteter Dienst antwortet nicht | Der Text nennt, was ohne ihn trotzdem geht — siehe [Dienste einbinden](dienste.md) |
| Ein Eigentümer kommt mit seiner Karte nicht herein | Zu diesem Zugang ist bereits ein Gerät angemeldet | In der Anwesenheitssicht **Zugang freigeben**, oder **Code ausgeben** |
| Die Siegelseite meldet «… ist noch offen, obwohl die Versammlung geschlossen ist» | Ein Durchgang ist aus einem Fehler offen geblieben (vor der Behebung M7-A1 durch ein Rennen zwischen Eröffnen und Schluss). Schliessen lässt er sich nicht mehr, und die Leitungsseite zeigt nach dem Schluss keinen Abbruchknopf | Den Durchgang ohne Ergebnis abbrechen: als angemeldete Leitung `POST /versammlungen/<id>/leitung?/abbrechen` mit dem Feld `begruendung` und dem Wert von `ORIGIN` als Kopfzeile `Origin`; gehört die Versammlung zu einem gemeinsamen Abend, zusätzlich `notweg=ja`, sonst verweist die Aktion auf die Abendseite. Er gilt dann als abgebrochen, ohne Verkündung, und das Versiegeln geht |
