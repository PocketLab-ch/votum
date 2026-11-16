-- 180 — Lesart L6: Reglement bindet seine Änderung an die Zustimmung aller
--
-- **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), Einteilung
-- F3b, Zeile D1: Verlangt das Reglement für seine eigene Änderung die
-- Zustimmung aller, ist umstritten, ob diese Klausel gilt. Der SVIT-Kommentar
-- hält eine Erschwerung für unzulässig (Rz. 40 und 125 ad Art. 712g), andere
-- Autoren lassen sie zu, das Bundesgericht hat die Frage offengelassen
-- (BGer 5C.50/2004 E. 4.2). Die Gemeinschaft wählt, ob Votum die Klausel
-- anwendet; Votum rechnet zusätzlich nach der anderen Wahl und nennt das
-- Ergebnis, wenn es abweicht.
--
--   reading_l6   klausel   die Klausel des Reglements gilt: angenommen ist
--                            die Änderung nur mit der Zustimmung aller
--                            Eigentümer, auch der abwesenden (Vorgabe; eine
--                            Änderung, der alle zustimmen, besteht nach
--                            beiden Wahlen)
--                gesetz    das qualifizierte Mehr nach Köpfen und Wertquoten
--                            (ZGB Art. 712g Abs. 3; Rz. 40, 40a, 125 f. und
--                            145 ad Art. 712g)
--
-- **Gebaut wie L2 und L4** (Migrationen 171 und 169): Spalte an `stweg`,
-- NOT NULL mit der Vorgabe; eingefroren bei der Freigabe in `snapshot`,
-- damit Einladung und Saal nach derselben Wahl rechnen und eine Umstellung
-- nach dem Ergebnis erst für die nächste Versammlung wirkt. Am Erfordernis
-- steht die Lesart in `agenda_item.requirement_reading`, dessen Form hier
-- L6 dazunimmt.
ALTER TABLE stweg ADD COLUMN reading_l6 text NOT NULL DEFAULT 'klausel';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l6
    CHECK (reading_l6 IN ('klausel', 'gesetz'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, deren Knoten die Lesart L6 nicht trägt;
-- die eingefrorene Wahl wirkte für sie in keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l6 text NOT NULL DEFAULT 'klausel';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l6
    CHECK (reading_l6 IN ('klausel', 'gesetz'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`, wie in Migration 169: Ein fehlender Schlüssel
    -- ergäbe sonst NULL, und ein CHECK mit NULL gilt als erfüllt.
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' IN ('L2', 'L4', 'L6')) IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l6 IS
    'Lesart L6, Reglementsänderung unter einer Klausel, die selbst die Zustimmung aller verlangt: klausel (Vorgabe) oder gesetz (Entscheid 0018).';
COMMENT ON COLUMN snapshot.reading_l6 IS
    'Lesart L6 der Gemeinschaft bei der Freigabe (Migration 180).';
