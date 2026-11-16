<img src="static/favicon.svg" alt="" width="72" height="72">

# Votum

Werkzeug zur Führung von Stockwerkeigentümer-Versammlungen nach ZGB Art. 712a ff.
Es richtet sich an Verwaltungen und an Gemeinschaften in der Schweiz, die ihre
Versammlung selbst leiten. Votum ist eine Webanwendung, die auf einem Server oder
auf dem Notebook im Versammlungsraum läuft. Sie aufzusetzen verlangt Erfahrung
mit Docker, für das Notebook im Saal auch mit einem eigenen WLAN; wie, steht
unter [Installation](docs/installation.md).

Führt den Rechtsakt, statt ihn nur zu dokumentieren: Das Mehrheitserfordernis wird
je Traktandum aus dem Vorhaben hergeleitet, Kopfstimmen und Wertquoten werden nach
der geltenden Regel ausgezählt, und das Ergebnis lässt sich später belegen.
Massgeblich sind Gesetz und Reglement der Gemeinschaft; was das Reglement
abweichend regelt, tragen Sie in Votum ein. Bei umstrittenen Rechtsfragen rechnet
Votum nach einer Vorgabe, die nicht immer die vorsichtigere Lesart ist; an vielen
Stellen kann die Gemeinschaft vor der Freigabe der Einladung eine andere
einstellen. Ein Gericht bindet weder Vorgabe noch Wahl; Votum nennt deshalb auch,
was die andere Lesart verlangt. Votum schlägt vor, die Sitzungsleitung entscheidet.
Ausserdem bietet Votum:

- Abstimmen im Saal mit dem eigenen Telefon, angemeldet über ein persönliches
  QR-Blatt, oder auf Papier; die Stimmen auf Papier erfasst die Sitzungsleitung.
  Beides geht an derselben Versammlung.
- Eine Anzeige für den Beamer ohne Namen und ohne Stimmverhalten. Geheim ist die
  Abstimmung damit nicht; ob geheim abgestimmt wird, regelt das Reglement oder
  beschliesst die Versammlung. Dann zeigt Votum nur «erreicht» oder «nicht
  erreicht»; wer wie gestimmt hat, können Verwaltung und Sitzungsleitung
  weiterhin nachlesen.
- Vertretung und Vollmacht; die Vollmacht kann je Antrag festlegen, wie die
  Vertretung stimmen soll.
- Protokollentwurf als Word-, OpenDocument- und PDF-Dokument und ein versiegeltes
  Abschlusspaket mit Zahlen und Ablauf der Versammlung, an dem eine spätere
  Änderung sichtbar wird. Massgeblich bleibt das Protokoll.
- Mehrere Gemeinschaften einer Überbauung an einem gemeinsamen Abend, etwa je
  Haus und die Einstellhalle.

Votum ist in der **Beta**. Bilder und Überblick:
<https://pocketlab.ch/development/votum/>. Votum ist freie Software unter der
GNU Affero General Public License, Version 3 ([`LICENSE`](LICENSE)).

Der Quellcode liegt öffentlich auf <https://codeberg.org/PocketLab/votum>, als
Spiegel: Entwickelt wird an anderer Stelle, und der Spiegel nimmt keine Pull
Requests an. Fehler und Fragen können Sie dort als Issue melden, also als
öffentlichen Eintrag; dafür braucht es ein Konto bei Codeberg. Schreiben Sie
keine Namen oder Daten Ihrer Gemeinschaft hinein.
Sicherheitslücken melden Sie nicht als Issue, sondern wie in
[`SECURITY.md`](SECURITY.md) beschrieben.

Wer zum ersten Mal eine Versammlung mit Votum führt, beginnt bei
[Eine Versammlung führen](docs/versammlung-fuehren.md). Alle Anleitungen stehen
im [Handbuch](docs/README.md).

## Wie geprüft wird

Geprüft wird im internen Repo, aus dem dieser Stand stammt:

- Ein Prüflauf mit rund 7800 automatischen Tests der Logik und der Datenbank,
  dazu Wächter über Sprache, Aufbau und Texte, vor jedem Commit am Code und
  nach jedem Push.
- Browserläufe spielen eine ganze Versammlung durch, von der Einladung bis zum
  versiegelten Abschlusspaket. Vor jeder Auslieferung laufen vier weitere gegen
  den gebauten Stand, etwa zur Trennung der Rollen und unter Last.
- Vor jedem Commit am Code prüft ein eigener KI-Durchgang die Änderung auf
  Fehler und auf Sicherheit, nicht derjenige, der sie geschrieben hat.
- Texte mit Rechtsaussagen gehen durch eine Laien- und eine Fachprüfung, beide
  ebenfalls durch KI-Modelle, die Fachprüfung an Gesetz und Kommentar.

Im Spiegel fehlen zwei interne Sperrlisten (gesperrte echte Namen und Angaben
zum Betrieb); sie bleiben intern, damit sie nicht öffentlich werden.
`npm run pruefen` bricht dort deshalb mit Absicht beim Personendaten-Wächter
ab, und aus demselben Grund ist der Test
`tests/waechter/handbuch-betriebsangaben.test.ts` rot. Rot ist dort auch
`tests/waechter/ci-skripte.test.ts`, weil die interne CI unter `.gitea/` nicht
mitkommt. Einzelheiten zu den
Tests stehen in [`docs/bauweise.md`](docs/bauweise.md), Abschnitt «Tests».

## Entwicklung

Warum etwas so gebaut ist, begründet [`docs/bauweise.md`](docs/bauweise.md);
Regeln und Fallen für die Arbeit am Code stehen in [`AGENTS.md`](AGENTS.md),
geschrieben für KI-Werkzeuge im internen Repo; manche Verweise dort zeigen auf
interne Dateien.
