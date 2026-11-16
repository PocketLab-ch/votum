<img src="static/favicon.svg" alt="" width="72" height="72">

# Votum

Werkzeug zur Führung von Stockwerkeigentümer-Versammlungen nach ZGB Art. 712a ff.
Es richtet sich an Verwaltungen und an Gemeinschaften in der Schweiz, die ihre
Versammlung selbst leiten.

**Installation:** Votum ist eine Webanwendung für einen Server oder für das
Notebook im Versammlungsraum. Sie aufzusetzen verlangt Erfahrung mit Docker, für
das Notebook im Saal auch ein eigenes WLAN. Die Anleitung steht unter
[Installation](docs/installation.md).

Votum leitet je Traktandum das nötige Mehr her und zählt danach Kopfstimmen und
Wertquoten aus; das Ergebnis lässt sich später belegen. Massgeblich bleiben
Gesetz und Reglement der Gemeinschaft; was das Reglement abweichend regelt,
tragen Sie in Votum ein. Bei den meisten umstrittenen Rechtsfragen kann die
Gemeinschaft vor der Freigabe der Einladung wählen, nach welcher Lesart Votum
rechnet; Votum nennt auch, was die andere verlangt. Votum schlägt vor, die Sitzungsleitung
entscheidet. Ausserdem bietet Votum:

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

Die Version steht unten auf der Anmeldeseite und auf jeder Seite der
Verwaltung (nicht auf den Seiten zum Abstimmen und nicht auf der Anzeige im
Saal) und in jedem Abschlusspaket, etwa «Version 20261116-0854-854363d4». Nennen Sie sie, wenn Sie einen Fehler melden oder
nachfragen, wie eine Versammlung gezählt wurde. Den Quellcode genau dieser
Version finden Sie auf GitHub in der
[Liste der Tags](https://github.com/PocketLab-ch/votum/tags) unter demselben
Namen.

Der Quellcode liegt öffentlich auf <https://github.com/PocketLab-ch/votum>, als
Spiegel: Entwickelt wird an anderer Stelle, gelesen wird, was hier eingeht.
Fragen zu Ihrer eigenen Versammlung richten Sie an Ihre Verwaltung oder an die
Sitzungsleitung, im Zweifel zuerst dorthin. Fehler in Votum melden Sie als
Issue, Fragen zu Votum in den Discussions; dafür braucht es ein Konto bei
GitHub. Beides ist öffentlich: Schreiben Sie keine Namen oder Daten Ihrer
Gemeinschaft hinein.

Pull Requests sind willkommen; eine grössere Änderung besprechen Sie am besten
vorher in den Discussions. Wir führen Pull Requests nicht auf GitHub zusammen.
Nehmen wir einen Beitrag an, übernehmen wir ihn von Hand, und er erscheint mit
dem nächsten Stand. Im Pull Request vermerken wir, mit welchem Stand, und
schliessen ihn dann. Einen Beitrag, den wir nicht übernehmen, schliessen wir mit
einer kurzen Begründung. Der öffentliche Stand nennt keine einzelnen Autorinnen
und Autoren.

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

Zwei Listen mit echten Namen und Angaben zum Betrieb bleiben bewusst intern;
ohne sie läuft der volle Prüflauf im Spiegel nicht (Einzelheiten in
[`docs/bauweise.md`](docs/bauweise.md), Abschnitt «Tests»).

## Entwicklung

Warum etwas so gebaut ist, begründet [`docs/bauweise.md`](docs/bauweise.md);
Regeln und Fallen für die Arbeit am Code stehen in [`AGENTS.md`](AGENTS.md),
geschrieben für KI-Werkzeuge im internen Repo; manche Verweise dort zeigen auf
interne Dateien.
