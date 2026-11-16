# 0052: Die juristische Gegenlesung entfällt; Votum sagt nicht mehr, sie stehe aus

- **Status:** gilt
- **Datum:** 2026-11-16
- **Rolle:** Produktentscheid

## Wortlaut

Aus der Sitzung vom 16.11.2026, nach dem Einstieg des README:

> «Soweit mir ist, haben wir ja keine Themen mehr, für die Gegenlesung, weil alles in den Einstellungen auswählbar ist.»

> «Gegenlesung gemäss 0044 streichen»

Zum Zuschnitt, am selben Tag bestätigt: Das Datenfeld bleibt `false`, sichtbar
entfällt «Noch nicht juristisch gegengelesen», der Vorschlag an die
Sitzungsleitung bleibt; dafür eine neue Fassung 2026-11-19, zusammen mit dem
Widerruf einer Übertragung an die Bewirtschaftung (Meldung der Website).

## Anlass

Bis dahin galt die juristische Gegenlesung als offene Bedingung
(internes Freigabeblatt), die Oberfläche schrieb unter jedes Ergebnis
«Noch nicht juristisch gegengelesen», und der Freigabevermerk jeder Fassung
seit 2026-07-30 trug «Die juristische Gegenlesung steht aus». Nach Entscheid
0044 (06.11.2026) gehen die Restfragen nicht an eine Anwältin; der
Auftraggeber hat sie eingeordnet, fest gerechnet oder seit E1 als Lesarten der
Gemeinschaft gebaut (L6 bis L12). Rechtlich entschieden sind sie damit nicht;
das Handbuch sagt bei jeder solchen Frage, welcher Lesart Votum folgt.
Freigegeben wurde am 12.11.2026 ohne Gegenlesung.

## Was gilt

- **Keine Gegenlesung ausstehend.** Weder Oberfläche noch Handbuch noch
  Freigabevermerk der aktuellen Fassung sagen, sie stehe aus.
- **Der Vorschlag bleibt.** Jedes Ergebnis nennt sich einen Vorschlag an die
  Sitzungsleitung; die Sitzungsleitung entscheidet. Wo die Lehre uneins ist,
  rechnet Votum nach der Lesart der Gemeinschaft und nennt die andere.
- **`juristischGegengelesen` bleibt `false`.** Das Feld beschreibt eine
  Tatsache und steht in jeder Fassung und in den Daten eröffneter Durchgänge;
  es steuert keine Anzeige mehr.
- **Eingefrorene Fassungen bleiben** (AD-4): Bis 2026-11-18 trägt ihr Vermerk
  den alten Satz als das, was damals galt. Die Fassung 2026-11-19 ersetzt ihn.
- **Rechtstexte nach aussen** gehen weiter durch Laien- und Fachprüfung
  (`quellen/pruefung/`). Das ersetzt keine Gegenlesung und wird nicht als
  solche bezeichnet.

## Alternativen

- `juristischGegengelesen` auf `true` setzen: verworfen, es wäre falsch.
- Das Feld aus Code und Fassungen nehmen: verworfen, ältere Fassungen und
  gespeicherte Durchgänge tragen es; Aufwand ohne Nutzen.
- Nur Fusszeilen und Handbuch, ohne neue Fassung: verworfen, die
  Erfordernisseite zeigte den Satz im Vermerk weiter.

## Verwandt

- Entscheid 0044 (Restpaket ohne Anwältin)
- Fassung `src/lib/rules/quorum-2026-11-19.ts`
- das interne Freigabeblatt (nicht im öffentlichen Stand)
