# 0053: Die Version von Votum ist der Abbild-Tag

- **Status:** gilt
- **Datum:** 2026-11-16
- **Rolle:** Produktentscheid

## Wortlaut

Am 16.11.2026 bestätigt, auf den Vorschlag, eine sichtbare Software-Version
einzuführen:

> «Ich bestätige.»

Der Vorschlag: eine Kennung, und zwar die, die es schon gibt, der Abbild-Tag;
gleich lautend an allen Stellen, damit man sie wörtlich suchen kann.

## Anlass

Bis dahin sah kein Nutzer, welcher Stand läuft. Es gab den Abbild-Tag (nur am
Betrieb), die Stände auf Codeberg ohne Tags und `package.json` mit 0.1.0, das
nie hochgezählt wurde. Sichtbar war allein die Fassung des Regelwerks auf der
Seite «Mehrheiten». Ein Abschlusspaket nannte nicht, mit welchem Code eine
Versammlung gezählt wurde.

## Was gilt

- **Die Version ist der Abbild-Tag** aus `scripts/abbild-bauen.sh`:
  `JJJJMMTT-HHMM-<kurzer Commit>`, mit `-lokal`, wenn der Baum vom Commit
  abwich. Das Skript gibt ihn als Build-Arg `VOTUM_VERSION` ins Abbild
  (`Dockerfile`); nichts wird von Hand gesetzt.
- **Anwendung:** Die Fusszeile der Verwaltung zeigt «Version <tag>», ohne Tag
  «Entwicklungsstand» (`src/lib/domain/version.ts`). Auf den offenen Pfaden
  der Eigentümer und in der Saalsicht gibt es keine Fusszeile, also auch keine
  Version (Produktentscheid vom selben Tag zur Fusszeile).
- **Abschlusspaket:** Das Manifest trägt `anwendung: { name, version }`,
  `MANIFEST.txt` die Zeile «Anwendung:», ohne Version «ohne Versionsangabe»
  (nicht «Entwicklungsstand», Laienprüfung vom selben Tag). Ein Paket ohne das Feld stammt aus
  der Zeit davor und bleibt gültig: Das Siegel ist die Prüfsumme der Bytes,
  die Prüfung liest das Feld nicht als Pflicht.
- **Codeberg:** Jeder Stand trägt einen annotierten Tag mit dem Abbild-Tag als
  Namen, Nachricht «Votum <tag>», neutraler Autor, Datum des Commits
  (`SPIEGEL_TAG` in `scripts/spiegel-stand.sh`).
- **`package.json`** ist keine Versionsquelle; die 0.1.0 dort liest nichts.

## Alternativen

- Semantische Versionen (1.2.3): verworfen, sie müssten von Hand gezählt
  werden und sagten nicht, welcher Commit läuft.
- Nur der Commit: verworfen, er ist nicht nach Zeit sortierbar und am Betrieb
  nicht die Kennung, unter der ausgerollt wird.

## Verwandt

- Entscheid 0051 (Codeberg-Spiegel)
- `docs/installation.md`, «Abbild bauen»
