-- 171 — Lesart L2: Mehr für eine Zuständigkeitsordnung ausserhalb des Reglements
--
-- **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), Block 3. Will
-- die Versammlung die Zuständigkeit für gewöhnliche Verwaltungshandlungen
-- anders regeln (Art. 647a Abs. 2 ZGB), verlangt der Wortlaut «die Mehrheit
-- aller Miteigentümer». Der SVIT-Kommentar nennt an zwei Stellen verschiedene
-- Mehre; die Mehrheit aller Köpfe vertritt er nicht.
--
--   reading_l2   einfach        einfaches Mehr der Anwesenden und Vertretenen
--                               (Vorgabe; Entscheid 0018, F6; Rz. 34 ad
--                               Art. 712g, Rz. 166 und 166b ad Art. 712m)
--                qualifiziert   qualifiziertes Mehr nach Köpfen und Wertquoten
--                               (Rz. 109 ad Art. 712a)
--
-- **Gebaut wie L4** (Migration 169): Spalte an `stweg`, eingefroren in
-- `snapshot` bei der Freigabe; am Erfordernis steht die Lesart in
-- `agenda_item.requirement_reading`, dessen Form hier L2 dazunimmt. Beide
-- Lesarten am Mehr kennen dieselben zwei Wahlen.
ALTER TABLE stweg ADD COLUMN reading_l2 text NOT NULL DEFAULT 'einfach';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l2
    CHECK (reading_l2 IN ('einfach', 'qualifiziert'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, deren Knoten L2 nicht trägt.
ALTER TABLE snapshot ADD COLUMN reading_l2 text NOT NULL DEFAULT 'einfach';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l2
    CHECK (reading_l2 IN ('einfach', 'qualifiziert'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`, wie in Migration 169: Ein fehlender Schlüssel
    -- ergäbe sonst NULL, und ein CHECK mit NULL gilt als erfüllt.
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' IN ('L2', 'L4')) IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l2 IS
    'Lesart L2, Zuständigkeitsordnung ausserhalb des Reglements (Art. 647a Abs. 2 ZGB): einfach (Vorgabe) oder qualifiziert (Entscheid 0018).';
COMMENT ON COLUMN snapshot.reading_l2 IS
    'Lesart L2 der Gemeinschaft bei der Freigabe (Migration 171).';
