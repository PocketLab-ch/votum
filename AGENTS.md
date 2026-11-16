# AGENTS.md

**Votum** führt eine Stockwerkeigentümerversammlung nach ZGB Art. 712a ff., statt
sie nur zu dokumentieren: Es leitet je Traktandum das Mehrheitserfordernis aus dem
Vorhaben her, zählt Kopfstimmen und Wertquoten nach der geltenden Regel und hält
jeden Schritt so fest, dass ein Beschluss später belegbar ist.

**Diese Datei ist ein Wegweiser, keine zweite Wahrheit.** Kern für KI-Werkzeuge:
was bei jeder Arbeit gilt und welche Fallen zuschlagen, bevor man nachschlägt.
Das Warum steht in [`docs/bauweise.md`](docs/bauweise.md), rund 2600 Zeilen nach Themen
gegliedert (bis 16.11.2026 das `README.md`, das jetzt Aussenstehenden den Überblick gibt); das Handbuch für Betrieb und Anwendung unter [`docs/`](docs/).
Ausführlich zu Prüflauf, Durchstichen und Sperrfolge: das Kapitel
[`docs/agents/entwicklung.md`](docs/agents/entwicklung.md). Wo diese Datei und
der Bestand auseinandergehen, gilt der Bestand, und die Abweichung gehört hier
korrigiert. **Eine neue Falle kommt mit Signal, einem Satz Anlass und Verweis
hierher, ausführlich ins Kapitel.** Messungen nach `docs/proben.md`, Offenes nach
`docs/pendenzen.md` (Sicherheit: `docs/pendenzen-sicherheit.md`; beide intern, nicht im öffentlichen Stand), Entscheide
nach `docs/entscheide/`, Störungen ins Runbook des Betriebs (Ort nach `CLAUDE.md` des
Arbeitsverzeichnisses). Schreibregel und
Obergrenze: `CLAUDE.md` des Arbeitsverzeichnisses, «Wie Anweisungsdateien geschrieben werden».
Sucht jemand einen alten Abschnitt dieser Datei, sagt die Tabelle «Kapitel»
unten, wo er steht.

Das Verzeichnis heisst `versammlung`, die Anwendung heisst Votum, und
«Versammlung» bleibt im Code der Fachbegriff für die Sitzung selbst.

## Befehle

Node 24 und PostgreSQL 18 kommen aus dem Container, weil der Dev-Host Node 20 hat. Der
Prüflauf gehört deshalb in den Container, die Browserläufe auf den Wirt.

| Zweck | Befehl |
|---|---|
| Prüflauf | `scripts/pruefen.sh` (Einmalcontainer aus dem eigenen Baum, rund sechs Minuten; derselbe Lauf am Pre-Commit-Hook, je Arbeitskopie einmal `./scripts/hooks-einrichten.sh`) |
| Durchstich | `node e2e/durchspielen.mjs` (auf dem Wirt; `PLAYWRIGHT_PFAD` nennt Playwright, siehe Betriebsdoku) |
| Migration | `docker compose exec -T app npm run migrate` |
| Starten | `docker compose up -d`, dann `http://127.0.0.1:3100/` |
| Pakete geändert | `docker compose exec -T app npm install …`, **danach `docker compose restart app`** |

Die weiteren Durchstiche liegen unter `e2e/`, einer je Fragestellung; `docs/bauweise.md`,
Abschnitt «Tests», sagt zu jedem, was er prüft. Zugang ist `pruefer`; das Kennwort kommt
aus `KENNWORT` (Leitung: `KENNWORT_LEITUNG`), ohne Vorgabe (`e2e/zugang.mjs`), Ablage nach Betriebsdoku. **Vor jeder
Auslieferung** laufen vier davon gegen den gebauten Stand (unten, «Durchstiche»).

## Regeln, die nicht im Code stehen

- **Ein `npm install` ist ein Eingriff an einer laufenden geteilten Ressource,
  nicht nur an Dateien.** Wer ihn fährt, meldet ihn den anderen Sitzungen und
  nennt den Prozess, nicht bloss `package.json` und `node_modules`: `.` ist als
  `/app` gemountet,
  der Lauf schreibt für alle (Kapitel, «Pakete ändern»).
- **Ein begründeter Entscheid ist kein Fehler.** Dieses Haus begründet
  ausführlich im Code, und genau das macht es anfällig für Prüfberichte, die
  gegen die Begründung anlaufen, ohne sie gelesen zu haben: Von zehn gemeldeten
  «Befunden» waren am 04.09.2026 drei bewusste Entscheide. Wer prüft, nimmt die
  Definition aus `docs/bauweise.md`, Abschnitt «Was ein Fehler ist, und was nicht», in den
  Auftrag.
- **Sprache:** Deutsch mit echten Umlauten, keine ASCII-Umschreibung, in
  Code-Kommentaren, Commit-Texten, Log-Meldungen, Oberflächen und Doku;
  Bezeichner, Dateinamen und Routen bleiben, wie sie sind. Über die
  Oberflächentexte wachen `npm run check:texte` (verständlich für Laien) und
  `npm run check:zeichenzahl` (eine Längenschranke zählt Zeichen). Über
  ASCII-Umschreibungen in Kommentaren und Zeichenketten unter `src/` und im
  Fliesstext unter `docs/` wacht `npm run check:umlaute` als Sperrklinke
  (`scripts/umlaut-sperre.tsv`, Obergrenzen dürfen nur sinken); den
  Fliesstext zwischen Svelte-Marken liest er nicht. Über die Sie-Form wacht
  `npm run check:anrede`; die Aufträge an das Sprachmodell duzen und stehen in
  `scripts/anrede-ausnahmen.tsv`.

## Fallen, die vor dem Nachschlagen zuschlagen

**Dev-Stapel und Prüflauf**
- **Nach `npm install` ohne `restart app` liefert der Dev-Stapel keine
  hydrierte Seite mehr** (`ReferenceError: __BUNDLED_DEV__ is not defined`),
  und kein Prüflauf wird davon rot. Am 22.09.2026 fiel es knapp zwei Stunden
  niemandem auf (Runbook; Kapitel, «Pakete ändern»).
- **Wird ein Kerntest an seinen 5 Sekunden rot, zuerst nach fremden Läufen
  sehen, dann im Code.** Der Hook nennt vorher laufende Prüfläufe, den
  Browserdurchlauf `durchspielen.mjs`, `npm install` und die Last
  (`scripts/kollisionshinweis.mjs`), hält aber nichts auf; andere Drehbücher
  unter `e2e/` erkennt er nicht. Anlass: Am 22.09.2026 fielen zwei Commits an
  der Uhr statt an einem Befund (Kapitel, «Kollisionshinweis»).
- **Die Gitea-CI läuft ausserhalb der Sperre** von `scripts/pruefen.sh`; bei
  einer Zeitüberschreitung nach einem laufenden CI-Job sehen (`docker ps`). Sie
  fährt dieselbe Liste wie der Hook, aber auf glibc, ohne Werte aus dem
  Dev-Container und auch bei reinen `.md`-Commits (Kapitel, «Gitea-CI»).
- **Ob der Hook läuft, entscheidet die Staging-Fläche; was er prüft, ist der
  Arbeitsstand.** Sind nur `.md`-Dateien eingetragen, überspringt er den Lauf
  (unter `docs/` baut er vorher das Handbuch); läuft er, prüft er auch, was
  nicht eingetragen ist (Kapitel, «Prüflauf und Pre-Commit-Hook»).
- **Das Fenster des Hooks ist Minuten breit, und darin liegt eine fremde
  Staging-Fläche.** Gezielt zu stagen schützt nur den, der zuerst committet;
  der Ausweg ist `git commit --only <pfad>`, sicherer ist, den fremden Commit
  abzuwarten (`--only` sperrt die Staging-Fläche, solange der Hook läuft). Am 16.09.2026 hätte ein Commit dreizehn fremde Dateien
  mitgenommen (Kapitel, «Das Fenster des langen Laufs»).

**Durchstiche gegen den gebauten Stand** (Kapitel, gleichnamig)
- **Vier Läufe vor jeder Auslieferung, gegen den gebauten Stand, nicht gegen
  den Entwicklungsserver:** `herkunft.mjs`, `rollenumgehung.mjs`,
  `fremdbetreiber.mjs`, `last.mjs` (`last.mjs` auch nach Laständerungen;
  Entscheid 0001). Am Entwicklungsserver schaltet SvelteKit den Schutz gegen
  fremde Formulare ab, und `adapter-node` ist dort nicht der Server.
  Aufsetzbefehle im Kapitel.
- **Das `ZIEL` gehört immer dazu.** `rollenumgehung.mjs` und `last.mjs` laufen
  ohne es still gegen den Entwicklungsserver und wären dort grün;
  `herkunft.mjs`, `fremdbetreiber.mjs` und `netzunterbruch.mjs` brechen ohne
  es ab.
- **`docker compose restart app` nimmt `node build` mit.** Danach den gebauten
  Stand neu starten; die Läufe scheitern sonst ohne Anleitung an der
  Verbindung («fetch failed», `ERR_CONNECTION_REFUSED`).
- **`e2e/herkunft.mjs` läuft gegen den Entwicklungsserver absichtlich rot**;
  Schritt 01 sagt das.
- **`fremdbetreiber.mjs` vergleicht auch Gesamtzahlen über zwölf geteilte
  Tabellen.** Schreibt eine andere Sitzung währenddessen auf die
  Dev-Datenbank, wird der Schritt rot, ohne dass die Anwendung etwas falsch
  gemacht hat: erst nach fremden Läufen sehen, dann im Code.

**Browserläufe**
- **Ein abgebrochener Browserlauf ist oft die Umgebung, nicht die Anwendung.**
  Legt gleichzeitig etwas ein Docker-Netz an oder ab, etwa ein CI-Lauf oder ein
  `compose up` im Nachbarrepo, bekommt das headless Chromium
  `ERR_NETWORK_CHANGED`. Die langen Drehbücher, die `e2e/umgebung.mjs`
  einbinden, melden die Netzereignisse selbst, sprechen aber nur den Verdacht
  aus. Merkmal: Die Schrittnummer wandert von Lauf zu Lauf.

**Datenbank**
- **Die Zeilensperre antwortet mit null Zeilen, nicht mit einem Fehler.**
  Tabellen stehen unter `FORCE ROW LEVEL SECURITY` nach Betreiber
  (`migrations/012`, `015`, `111`). Wer eine Zeile sucht, bevor der Betreiber
  feststeht, bekommt eine leere Antwort ohne Meldung, und das sieht aus wie
  «gibt es nicht». Der Hausweg sind eng umrissene `SECURITY DEFINER`-Funktionen
  (`migrations/003`, `111`).
- **`CREATE OR REPLACE FUNCTION` kann den Rückgabetyp nicht ändern.** Wo er
  sich ändert, gehört ein `DROP FUNCTION IF EXISTS` davor; Beispiel
  `migrations/111_authentik_konto_finden.sql`.
- **Gesperrt wird in der Folge Traktandum, Versammlung, Durchgang, und eine
  Sperre steht nicht immer im Code.** Wer den Durchgang zuerst sperrt, nimmt
  das Traktandum trotzdem, unsichtbar über die Fremdschlüsselprüfung
  (`FOR KEY SHARE`): bei jedem `INSERT` einer Zeile, die aufs Traktandum zeigt,
  und bei einem zweiten `UPDATE` derselben Zeile in derselben Transaktion, auch
  ohne geänderten Schlüssel. Mit einem Beschluss von Hand am selben Traktandum
  endet das mit 40P01. Abhilfe: das Traktandum vorweg sperren wie
  `sperreOffenenDurchgang` (`src/lib/server/abstimmung.ts`; Kapitel,
  «Sperrfolge in der Datenbank»).
- **Die Datenbanktests legen je Lauf eine eigene Datenbank an** und werfen sie
  danach weg. Das ist Notwendigkeit, nicht Komfort: Der Verlauf ist nur
  anfügbar, Prüfdaten liessen sich daraus nicht entfernen, ohne genau den Schutz
  auszuhebeln, den die Tests belegen sollen. Wer einzelne Dateien fährt, setzt
  `VERSAMMLUNG_PRUEFDB` auf einen eigenen Namen, sonst reissen zwei
  gleichzeitige Sitzungen einander die Prüfdatenbank weg. `npm run test:db`
  lässt einen gesetzten Namen stehen (`scripts/pruefen.sh` setzt je Lauf einen
  eigenen); deshalb nur für den einen Aufruf setzen, nie als `export` in der
  Sitzung stehen lassen.

## Arbeiten im Worktree

Ablauf und Werkzeug in `CLAUDE.md` des Arbeitsverzeichnisses, «Arbeiten im Worktree»:
`arbeitsbaum neu versammlung <thema>`. `scripts/arbeitsbaum-einrichten.sh`
baut die `node_modules` für Alpine in einem Container (auf dem Wirt gebaute
passen nicht); eine `.env` braucht der Worktree nicht. Der Prüflauf
(`scripts/pruefen.sh`) und der Pre-Commit-Hook im Worktree zählen.

**Nur im Hauptverzeichnis, nach der Übernahme:** alles, was gegen den
laufenden Dev-Stapel geht, denn der hat das Hauptverzeichnis eingehängt: die
Browserläufe unter `e2e/` (`durchspielen.mjs` und die übrigen), jeder
`docker compose exec app …`, die Migration auf Dev und das Ausrollen. Ein
Paket im Worktree ändern: `docker run --rm -v "$PWD:/app" -w /app node:24-alpine
npm install …` im Worktree, nie `compose exec`, das träfe das Hauptverzeichnis.
Aus einem Worktree nie `docker compose` ohne `-p`: Die Compose-Datei trägt kein
`name:`, im Worktree entstünde ein zweiter Stapel mit denselben Ports.

**Wo versammlung vom Vertrag abweicht, mit Grund.** (1) Die Prüfdatenbank ist
je Lauf eine eigene, aber auf dem Dev-Postgres, kein eigener Container wie in
der CI. Jeder Lauf setzt beim Migrieren das Passwort der clusterweiten Rolle
`versammlung_app`; deshalb und wegen der Last läuft ein voller Prüflauf zur
Zeit (Sperre in `scripts/pruefen.sh`). (2) Der Lauf braucht den laufenden
Dev-Stapel: Von dort kommen die Zugänge und `ORIGIN`
(`tests/db/versandvermerk.test.ts`). (3) Die Compose-Datei trägt kein `name:`,
siehe oben.

Arbeitsbaum-Vertrag abgenommen am 14.10.2026
(`~/.claude/skills/dev-flow/grundausstattung.md`), mit den Abweichungen oben;
Ergebnisse in `docs/proben.md`.

## Aufbau

Functional Core / Imperative Shell. Die Rechtslogik liegt als reine Funktionen im
Kern und kennt weder Datenbank noch Uhr noch Zufall, weil bei einem Werkzeug,
dessen Zweck die Beweisbarkeit einer Zählung ist, diese Zählung vorlegbar sein
muss.

```
src/lib/domain/   Kern: Zählung, Quorum, Zustandsübergänge, ohne I/O
src/lib/rules/    Entscheidbaum als versionierte Daten
src/lib/server/   Datenzugriff, Migrationen, Verlauf, Dateiablage, PDF
src/routes/       Schale: Seiten und Server-Aktionen
migrations/       Nummerierte SQL-Dateien, aufwärtsgerichtet
tests/domain/     Wertetabellen, laufen ohne Datenbank
tests/db/         Schutzregeln der Datenbank, unter der Anwendungsrolle
```

Die Abhängigkeitsrichtung wird erzwungen: `npm run check:schichten` bricht ab,
wenn der Kern etwas aus einer äusseren Schicht einbindet. Der Wächter läuft vor
`build` und vor `test`.

## Wo nachschlagen

| Frage | Ort |
|---|---|
| Warum ist etwas so gebaut | [`docs/bauweise.md`](docs/bauweise.md) |
| Aufsetzen, Sichern, Aktualisieren, Fehlersuche | [`docs/installation.md`](docs/installation.md) |
| Eine Seite bauen oder umbauen | [`docs/gestaltung.md`](docs/gestaltung.md) |
| Ist die Anwendung für eine echte Versammlung frei | `docs/freigabe.md` (intern, nicht im öffentlichen Stand) |
| Authentik, Dateiablage, Zeitquelle, KI | [`docs/dienste.md`](docs/dienste.md) |
| Eine Versammlung führen | [`docs/versammlung-fuehren.md`](docs/versammlung-fuehren.md) |
| Der Ablauf über alle Repos hinweg | `CLAUDE.md` des Arbeitsverzeichnisses, Skill `dev-flow` |
| Rechtsfrage, Norm, Fundstelle | Repo `quellen`, `themen/stockwerkeigentum/` |

## Kapitel

| Datei | Was | Alte Abschnitte der `AGENTS.md` |
|---|---|---|
| `docs/agents/entwicklung.md` | Pakete ändern, Prüflauf und Hook, Kollisionshinweis, Gitea-CI, Fenster des langen Laufs, Durchstiche gegen den gebauten Stand mit Aufsetzbefehlen, Sperrfolge | «Die vier Befehle» (Warum der Neustart, `pruefen`, Kollisionshinweis, CI, Staging-Fläche), «Durchstiche gegen den gebauten Stand (vor jeder Auslieferung)», aus «Fallen» die Sperrfolge |
| dieser Kern | Befehle, Regeln, Fallen, Worktree, Aufbau | Tabelle aus «Die vier Befehle», «Arbeiten im Worktree», «Aufbau», «Fallen, die vor dem Nachschlagen zuschlagen», «Sprache», «Wo nachschlagen» |
| `docs/proben.md` | Messungen mit Datum, Abnahme des Arbeitsbaum-Vertrags | Abnahmetabelle aus «Arbeiten im Worktree» |
| `docs/entscheide/` | Entscheide ab 0001 | |
| `docs/pendenzen.md` | Offenes ohne eigenen Auftrag | |
| Runbook des Betriebs | Störungen am Dev-Stapel und am Betrieb | aus «Die vier Befehle» die Störung vom 22.09.2026 |
