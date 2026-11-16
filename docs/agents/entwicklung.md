# Entwicklung: Prüflauf, Durchstiche, Sperrfolge

Kapitel zum Kern `AGENTS.md`. Hier steht ausführlich, was der Kern als Falle
mit einem Satz nennt. Messungen mit Datum stehen in `../proben.md`, Störungen
am Dev-Stapel im Runbook des Betriebs.

## Pakete ändern

Nach einem `npm install` gehört `docker compose restart app` dazu. Der laufende Vite-Prozess hält die alte Fassung im Speicher und liefert
den Client von der neuen Platte; das Symbol `__BUNDLED_DEV__` wird nicht mehr
ersetzt, die Hydration bricht ab (`ReferenceError: __BUNDLED_DEV__ is not
defined`), und ohne Hydration setzt keine Seite `data-bereit`. Die Störung
vom 22.09.2026 steht im Runbook.

**Kein Lauf wird davon rot.** `npm run pruefen` fasst keinen Browser an, und
er läuft im Container mit frisch aufgelösten Modulen, während der Browser den
laufenden Prozess trifft. Genau dazwischen liegt der Fehler.

**Und ein `npm install` ist ein Eingriff an einer laufenden geteilten
Ressource, nicht nur an Dateien.** Wer ihn fährt, meldet ihn den anderen
Sitzungen, und die Meldung nennt den Prozess, nicht bloss `package.json` und
`node_modules`. Die Arbeitskopie ist hier geteilt: `.` ist als `/app`
gemountet, der Lauf schreibt also für alle.

## Prüflauf und Pre-Commit-Hook

`pruefen` umfasst 39 Wächter, Typprüfung, Kerntests und Datenbanktests, zusammen
42 Schritte, und braucht rund sechs Minuten. **`scripts/pruefen.sh` fährt ihn
in einem Einmalcontainer** (`node:24-alpine`) mit dem Baum, in dem das Skript
liegt, am Netz des Dev-Stapels und mit dessen Datenbankzugängen; nicht per
`compose exec` im Dev-Container, der das Hauptverzeichnis eingehängt hat.
Ein voller Lauf zur Zeit auf dem Rechner (Sperre unter /tmp, Begründung im
Kopf des Skripts). **Derselbe Lauf hängt am Pre-Commit-Hook**
(`scripts/git-hooks/pre-commit`, je Arbeitskopie einmal
`./scripts/hooks-einrichten.sh`); ein Commit dauert also ebenso lange. Der Hook
prüft den Arbeitsstand, nicht die Staging-Fläche: Wer nur einen Teil einträgt,
prüft trotzdem alles. Ob er überhaupt läuft, entscheidet dagegen die
Staging-Fläche: Reine `.md`-Änderungen überspringt er; liegen sie unter
`docs/`, läuft vorher der Handbuchbau, weil dort ein Kapitelverweis ins Leere
zeigen kann und dieser Fall sonst der einzige ungeprüfte wäre.

## Kollisionshinweis

**Der Hook sagt vorher, wenn schon einer läuft.** Er ruft
`scripts/kollisionshinweis.mjs`, bevor er den Lauf startet, und meldet
laufende Prüfläufe, den Browserdurchlauf `durchspielen.mjs`, `npm install` und
den Lastdurchschnitt; die übrigen Drehbücher unter `e2e/` erkennt er nicht.
Er **hält nichts auf**, er nennt nur, was er sieht.

Der Anlass ist gemessen (22.09.2026, `../proben.md`): Zweimal wies der Hook
einen Commit an einer Zeitüberschreitung ab, bei Lastdurchschnitt über 10.
Rot war nicht der Block, sondern die Uhr. Bei der letzten Kollision hatten
**beide** Sitzungen vorher angesagt; es half nichts, weil zwischen Ansage und
Start keine Antwort lag. Eine Regel, an die man sich erinnern muss, fällt aus,
sobald es eilig wird.

Der Hinweis läuft auf dem **Wirt**, nicht im Container: Ein Browserdurchlauf,
ein Prüflauf in einem Nachbarrepo und ein `compose build` treiben dieselbe Last
und wären von innen unsichtbar. Und er läuft **vor** dem Lauf, nicht in ihm;
in der Ausgabe eines Laufs von mehreren Minuten erreicht er niemanden.

## Gitea-CI

**Die Gitea-CI fährt dieselbe Liste** (`.gitea/workflows/ci.yml`): `npm run
pruefen` auf dem Runner, gegen ein eigenes Postgres, `ORIGIN` als
Wegwerfwert. Vorher führte sie eine eigene Auswahl, rief zwei Skripte, die es
nicht mehr gab, und war wochenlang rot, ohne dass es jemand sah
(`../proben.md`). `check:ci` prüft seither, dass jedes dort aufgerufene Skript
existiert. Die Umgebung ist nicht dieselbe: Die CI hat keine Werte aus dem
Dev-Container, läuft auf glibc statt Alpine und prüft auch reine
`.md`-Commits, die der Hook überspringt.

**Die CI läuft ausserhalb der Sperre.** Ein
CI-Lauf nach dem Push fällt leicht auf den Hook des nächsten Commits, und
`scripts/pruefen.sh` sieht ihn nicht (er wartet nur auf seine Sperrdatei und
auf `versammlung-pruef-*`). Der Kollisionshinweis nennt ihn, hält ihn aber
nicht auf. Wird ein Kerntest wegen seiner 5 Sekunden rot, zuerst nach einem
laufenden CI-Job sehen (`docker ps`), bevor man im Code sucht.

## Das Fenster des langen Laufs

**Der lange Lauf öffnet ein Fenster, und darin liegt eine fremde
Staging-Fläche.** Zwischen dem Absetzen des Commits und dem fertigen Commit
liegen hier Minuten. Wer in dieser Spanne selbst committet, trifft auf einen
Index, den jemand anders gefüllt hat.

**Gezielt zu stagen schützt dabei nur den, der zuerst committet.** `git add`
fügt hinzu, `git commit` nimmt die **ganze** Staging-Fläche. Am 16.09.2026
hätte ein `git add AGENTS.md && git commit` dreizehn fremde Dateien unter der
falschen Nachricht committet (`../proben.md`).

Der Ausweg ist `git commit --only <pfad>` (kurz `git commit <pfad>`): Er
committet nur die genannten Dateien und lässt die übrigen Einträge der
Staging-Fläche stehen (`git commit -h`: «-o, --only  commit only specified
files»); den genannten Pfad trägt er dort ebenfalls ein. Solange der Hook
läuft, hält er aber die Sperre der Staging-Fläche (`.git/index.lock`), und
ein fremdes `git add` scheitert mit «File exists» (`../proben.md`). Sicherer
ist deshalb, den fremden Commit abzuwarten.

Die allgemeinen Regeln zu gleichzeitigen Sitzungen stehen in
`CLAUDE.md` des Arbeitsverzeichnisses. Hier zählt der repo-eigene Grund: Das Fenster ist
Minuten statt Sekunden breit, weil der Hook den vollen Prüflauf fährt.

## Durchstiche gegen den gebauten Stand (vor jeder Auslieferung)

**Vier Läufe gehören in den Lauf vor einer Auslieferung, und zwar gegen den
gebauten Stand** (Entscheid `../entscheide/0001-vier-durchstiche-vor-jeder-auslieferung.md`).
Der Entwicklungsserver zeigt sie nicht: SvelteKit schaltet dort den Schutz
gegen fremde Formulare ab, und `adapter-node` ist dort nicht der Server.
Aufsetzen, die Adresse kommt aus dem Container:

```bash
IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
     $(docker compose ps -q app))
docker compose exec -T app npm run build
docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 BODY_SIZE_LIMIT=52M node build > /tmp/build.log 2>&1"

ZIEL=http://$IP:3101 node e2e/herkunft.mjs        # V4: Herkunftssperre, mit Gegenhälfte
ZIEL=http://$IP:3101 node e2e/rollenumgehung.mjs  # V5: Rollentrennung über kodierte Pfade
ZIEL=http://$IP:3101 node e2e/fremdbetreiber.mjs  # Fremdbetreiber über rund 350 Wege, 27 Kennungsfelder und die offenen Pfade, gegen die Datenbank geprüft
ZIEL=http://$IP:3101 node e2e/last.mjs            # Last: 14 Geräte, und die Rennen S1 bis S7
```

**`BODY_SIZE_LIMIT=52M` wie im Betrieb** (`compose.prod.yml`). Ohne die Angabe
weist adapter-node jeden Rumpf über 512 KB mit 413 ab; `durchspielen.mjs`
brach am 12.11.2026 deshalb bei Schritt 136 ab (Abschlusspaket von 579 kB an
das Prüfwerkzeug), ohne dass am Code etwas fehlte.

**`build/index.js` ist seit dem 12.11.2026 ein Aufsatz, kein Adapter-Einstieg**
(GP-V-3). `scripts/nachbau-einstieg.mjs` verschiebt den adapter-eigenen Einstieg
nach `build/adapter.js` und legt `scripts/server-einstieg.mjs` als
`build/index.js` ab. Der Aufsatz setzt die drei Sicherheitsköpfe
`x-frame-options`, `x-content-type-options` und `referrer-policy` auf jeder
Antwort aus dem Adapter, auch auf statischen Dateien, die sirv vor dem
`handle`-Haken ausliefert. `node build` bleibt der Startbefehl; wer den
Adapter-Code sucht, findet ihn in `build/adapter.js`.

**Ein Neustart des Dev-Containers nimmt `node build` mit**: Wer
`docker compose restart app` fährt, muss den gebauten Stand danach neu starten.
Keiner der vier Läufe sagt das mit einer Anleitung; sie scheitern an der
Verbindung («fetch failed», `ERR_CONNECTION_REFUSED`). **Und das `ZIEL` gehört
immer dazu:** `rollenumgehung.mjs` und `last.mjs` laufen ohne es still gegen
den Entwicklungsserver und wären dort grün, ohne den gebauten Stand gesehen zu
haben; `herkunft.mjs`, `fremdbetreiber.mjs` und `netzunterbruch.mjs` brechen
ohne es ab (seit 27.10.2026; vorher fielen sie auf eine fest eingetragene
Adresse des Containers zurück).

**`fremdbetreiber.mjs` vergleicht auch Gesamtzahlen** über zwölf geteilte
Tabellen und zählt Verlaufseinträge anderer Betreiber, die B nennen. Schreibt während des Laufs eine andere Sitzung auf die
Dev-Datenbank (ein anderer Durchstich, ein Prüflauf), wird der Schritt rot,
ohne dass die Anwendung etwas falsch gemacht hat. Rot dort heisst also: erst
nach fremden Läufen sehen, dann im Code. Die Meldung nennt je Zeile den Teil
(Feld- oder Pfadteil). Die Verlaufseinträge stehen in einem eigenen Schritt,
«Kein Verlaufseintrag eines anderen Betreibers nennt B», damit ein Fund im
einen Schritt keinen im anderen verdeckt.

Was wo gilt:

| Lauf | wann | was er belegt |
|---|---|---|
| `herkunft.mjs` | vor jeder Auslieferung | Fremde und fehlende Herkunft → 403; eigene Herkunft → die fachliche Antwort (die Gegenhälfte) |
| `rollenumgehung.mjs` | vor jeder Auslieferung | Die Rollentrennung hält kodierten Pfaden stand, und die Verwaltung kommt weiterhin durch |
| `fremdbetreiber.mjs` | vor jeder Auslieferung | Kein Weg auf Daten eines fremden Betreibers, mit Kennung in der Adresse (Pfadteil) und in Abfrage, Formularfeld oder Paket (Feldteil, `fremdbetreiber-felder.mjs`) und unter den offenen Pfaden mit gültigem Code von A (offener Teil, samt `/z/strom` und `/p/strom`); an B ändert sich in der Datenbank nichts, ein angekündigter Zuwachs unter A ist einzeln eingeordnet. |
| `last.mjs` | vor einer Auslieferung **und** nach Laständerungen | 14 Geräte, Story-5.6-Zusage, und die Rennen S1 bis S7 ohne 500-Seite |

**`e2e/herkunft.mjs` läuft gegen den Entwicklungsserver absichtlich rot**:
dort ist die Herkunftssperre abgeschaltet, und Schritt 01 sagt das. Wer ihn
dort grün sehen will, hat den Zweck verwechselt.

**Die Wächter zu diesen Fragen laufen im gewöhnlichen Prüflauf weiter**:
`tests/domain/zeitgeber.test.ts` (V7: Doppelstart und Ausschalter des
Zeitgebers), `tests/waechter/rollenanker.test.ts` (Bauart der Rollenprüfung).
Der gebaute Stand ist dort nicht nötig, und dort auch nicht möglich.

## Sperrfolge in der Datenbank

**Gesperrt wird in der Folge Traktandum, Versammlung, Durchgang, und eine
Sperre steht nicht immer im Code.** Eröffnen, Beschluss von Hand und
Versammlungsschluss halten sich daran. Ein Schreibweg, der einen Durchgang
zuerst sperrt, nimmt das Traktandum trotzdem, und zwar unsichtbar über die
Fremdschlüsselprüfung (`FOR KEY SHARE`): bei jedem `INSERT` einer Zeile, die
aufs Traktandum zeigt, und bei einem zweiten `UPDATE` derselben Zeile in
derselben Transaktion, auch ohne geänderten Schlüssel. Mit einem Beschluss von
Hand am selben Traktandum endet das mit 40P01. Die Prüfung nimmt alle
Fremdschlüssel der Zeile, also auch die Versammlung (`FOR KEY SHARE` verträgt
sich mit deren `FOR NO KEY UPDATE`) und bei einem Rückkommen das Traktandum des
Rückkommensantrags. Abhilfe: das Traktandum vorweg sperren, wie
`sperreOffenenDurchgang` in `src/lib/server/abstimmung.ts` und
`haltStichentscheidFest`; Nachweis gesteuert mit `tests/db/rennen.ts`
(Auftrag Abschluss C2, 16.10.2026).

**Eine Verklemmung, die sich nicht wegsperren lässt, wird wiederholt.**
Eröffnen und Beschluss von Hand laufen in `nochmalsBeiVerklemmung`
(`src/lib/server/db.ts`): Ein Durchgang am Ziel nimmt über
`reconsideration_item_id` `FOR KEY SHARE` auf den Rückkommensantrag, ein
Eröffnen oder Beschluss von Hand am Antrag hält ihn mit `FOR UPDATE`, und das
endete mit 40P01 (`tests/db/abschluss-rennen.test.ts`, «Rückkommensantrag und
Ziel zugleich»). Drei Fassungen, die stattdessen die Sperrfolge änderten (den
Antrag vorweg sperren, in zwei Befehlen oder in einem; das Traktandum mit
`FOR NO KEY UPDATE`), bauten je eine neue Verklemmung ein oder liessen C2 und
die Universalversammlung vom Takt abhängen (Codeprüfungen vom 27.10.2026).
**Wiederholen nur, was ganz in einer Transaktion liegt** und ausserhalb nichts
bewirkt. Mehrere Traktandenzeilen nur in einem Befehl und aufsteigend nach
Kennung, wie `schliesseVersammlung`.
