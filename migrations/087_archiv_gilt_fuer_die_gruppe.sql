-- Die Gruppe ist eine Einheit — auch im Archiv.
--
-- **Der Auftrag** (Auftraggeber, 25.08.2026, nach der ersten Fassung): «Gruppen müssen
-- als gesamte Gruppe archiviert und wiederhergestellt werden, weil diese
-- zusammenhängen.»
--
-- **Was vorher war, und warum es falsch war.** Migration 086 archivierte genau
-- die Zeile, auf der man stand. Wer die Klammer einer Mehrhausanlage
-- archivierte, hatte danach die Klammer im Archiv und ihre fünf Häuser weiter in
-- der Liste — eingerückt unter nichts. Gemessen am 25.08.2026: 10 Gemeinschaften
-- vor dem Archivieren der «MEG Sonnenhof», 9 danach, Sonnenhof A und B standen
-- weiter da. Die Rückfrage sagte das sogar an, als wäre es eine Eigenschaft:
-- «Sie bleiben in der Liste — archivieren Sie sie einzeln.» Fünf Handgriffe für
-- eine Entscheidung, und beim Hervorholen noch einmal fünf, in der richtigen
-- Reihenfolge.
--
-- **Abgeleitet, nicht abgeschrieben.** Der naheliegende Weg wäre, beim
-- Archivieren `archived_at` auf den ganzen Teilbaum zu schreiben. Er hat drei
-- Löcher, und alle drei sind in diesem Repo schon zugeschlagen:
--
--   1. **Das Hervorholen wüsste nicht, wen es mitnehmen soll.** Ein Haus, das
--      vorher einzeln archiviert wurde, käme mit der Klammer zurück — obwohl
--      niemand das wollte. Man müsste sich merken, wer wegen wem im Archiv liegt:
--      eine zweite Spalte, die genau so lange stimmt, bis sie jemand vergisst.
--   2. **Ein neues Haus unter einer archivierten Klammer wäre sichtbar.** Es
--      bekäme beim Anlegen kein `archived_at` — und stünde in der Liste, während
--      seine Klammer im Archiv liegt.
--   3. **Zwei Schreiber, eine Spalte.** Genau die Bauart, die hier schon
--      mehrfach auseinandergelaufen ist.
--
-- Deshalb bleibt `archived_at` da, wo die Entscheidung getroffen wurde — auf
-- genau einer Zeile —, und die Zugehörigkeit wird beim Lesen abgeleitet. Damit
-- ist «die Gruppe ist eine Einheit» keine Buchführung, die stimmen muss, sondern
-- eine Eigenschaft, die gar nicht falsch sein kann.
--
-- **Was zur Gruppe gehört: der Baum über `parent_stweg_id`.** Nicht die
-- Mitgliedschaft über `party.member_stweg_id`. Die MEG Umgebung «gehört» den
-- fünf Häusern, aber sie enthält sie nicht: Die Häuser sind eigenständige
-- Gemeinschaften mit eigenen Versammlungen, und die MEG stillzulegen darf sie
-- nicht mitnehmen. Umgekehrt gilt dasselbe.

-- Der nächste archivierte Vorfahr — oder die Zeile selbst, wenn sie es ist.
--
-- Gibt NULL zurück, wenn nichts in der Kette im Archiv liegt; sonst die Kennung
-- derjenigen Gemeinschaft, deren Archivierung diese hier mitnimmt. Damit lässt
-- sich beides beantworten: **ob** etwas im Archiv liegt (`IS NULL`) und
-- **weswegen** — für den Satz auf der Seite des Hauses und den Weg zurück.
--
-- `STABLE`, nicht `IMMUTABLE`: Das Ergebnis hängt am Tabelleninhalt.
-- `SECURITY INVOKER` (die Vorgabe) ist hier wesentlich — die Funktion liest
-- `stweg` unter den Zeilenrechten des Aufrufers, sonst sähe sie über die
-- Mandantengrenze hinweg.
--
-- Die Tiefenschranke ist kein Schmuck: Ein Ring in `parent_stweg_id` liesse die
-- Rekursion sonst laufen, bis der Server aufgibt. Der Kern weist Ringe ab
-- (`erzeugtRing`), aber eine Abfrage, die bei kaputten Daten hängt statt zu
-- antworten, ist der schlechtere Fehler. Drei Stufen sind im Bestand das
-- Äusserste (Klammer → Haus → MEG); zehn ist reichlich Luft.
CREATE OR REPLACE FUNCTION stweg_archiv_wegen(s_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    WITH RECURSIVE kette (id, parent_stweg_id, archived_at, tiefe) AS (
        SELECT s.id, s.parent_stweg_id, s.archived_at, 0
          FROM stweg s
         WHERE s.id = s_id
        UNION ALL
        SELECT s.id, s.parent_stweg_id, s.archived_at, k.tiefe + 1
          FROM stweg s
          JOIN kette k ON s.id = k.parent_stweg_id
         WHERE k.tiefe < 10
    )
    SELECT id FROM kette WHERE archived_at IS NOT NULL ORDER BY tiefe LIMIT 1;
$$;

COMMENT ON FUNCTION stweg_archiv_wegen(uuid) IS
    'Die Gemeinschaft, deren Archivierung diese hier aus den Listen nimmt — sie '
    'selbst oder der nächste archivierte Vorfahr. NULL heisst: steht in der Liste. '
    'Die Gruppe ist eine Einheit (Auftraggeber, 25.08.2026); geschrieben wird das Archiv '
    'aber nur auf einer Zeile, damit Hervorholen nichts nachhalten muss.';
