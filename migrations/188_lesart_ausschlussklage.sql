-- 188 — Lesart L9: die Zählbasis der Ermächtigung zur Ausschlussklage
--
-- **Der Anlass** ist Entscheid 0044, zweiter Nachtrag, Punkt R1 (a): Wer die
-- Ausschlussklage führen will, braucht dafür die Ermächtigung der Versammlung
-- (ZGB Art. 649b Abs. 2). An welcher Zahl deren Mehrheit gemessen wird, ist
-- umstritten: Der Wortlaut nennt alle Miteigentümer mit Ausnahme des Beklagten,
-- der SVIT-Kommentar lässt die Mehrheit der Anwesenden und Vertretenen ohne ihn
-- genügen (Rz. 214 ad Art. 712a, mit Kohler; anders Strittmatter), und für die
-- Ausschlussklage hat das Bundesgericht die Frage nicht entschieden. Die
-- Gemeinschaft wählt, ob Votum über alle (Vorgabe) oder über die Anwesenden und
-- Vertretenen zählt; Votum rechnet zusätzlich nach der anderen Wahl und nennt
-- das Ergebnis, wenn es abweicht.
--
--   reading_l9  alle        die Mehrheit wird an allen Eigentümern ausser dem
--                           Beklagten gemessen, auch an den abwesenden; wer
--                           weder da noch vertreten ist, wirkt wie ein Nein
--                           (Vorgabe; ein so gefasster Beschluss besteht nach
--                           beiden Lesarten)
--               anwesende   die Mehrheit wird nur an den Eigentümern gemessen,
--                           die da oder vertreten sind, ohne den Beklagten
--                           (SVIT-Kommentar Rz. 214 ad Art. 712a)
--
-- **Gebaut wie L12** (Migration 187): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit Einladung und Saal
-- nach derselben Wahl rechnen und eine Umstellung nach dem Ergebnis erst für
-- die nächste Versammlung wirkt. Am Erfordernis steht die Lesart in
-- `agenda_item.requirement_reading`, dessen Form hier L9 dazunimmt.
ALTER TABLE stweg ADD COLUMN reading_l9 text NOT NULL DEFAULT 'alle';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l9
    CHECK (reading_l9 IN ('alle', 'anwesende'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, deren Knoten die Lesart L9 nicht trägt,
-- und rechneten dort über alle Eigentümer ohne den Beklagten; die eingefrorene
-- Wahl wirkt für sie in keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l9 text NOT NULL DEFAULT 'alle';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l9
    CHECK (reading_l9 IN ('alle', 'anwesende'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`, wie in Migration 169: Ein fehlender Schlüssel
    -- ergäbe sonst NULL, und ein CHECK mit NULL gilt als erfüllt. Die Wahlen
    -- «alle» und «anwesende» stehen schon seit L12 in der Liste; L9 kommt bei
    -- den Kennungen dazu.
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' IN ('L2', 'L4', 'L6', 'L9', 'L11', 'L12')) IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz', 'alle', 'anwesende')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l9 IS
    'Lesart L9, Zählbasis der Ermächtigung zur Ausschlussklage: alle (Vorgabe) oder anwesende (Entscheid 0044, zweiter Nachtrag, R1 (a)).';
COMMENT ON COLUMN snapshot.reading_l9 IS
    'Lesart L9 der Gemeinschaft bei der Freigabe (Migration 188).';

-- **Auch am Rückkommen**, wie bei L11 und L12: `erfordernisFuerRueckkommen`
-- übernimmt die Lesart des Beschlusses mit jeder Kennung in
-- `requirement_reading_reconsidered` (Migration 181). Ohne L9 hier endete jedes
-- Rückkommen auf eine Ermächtigung zur Ausschlussklage der Fassung 2026-11-10
-- mit einer Verletzung dieser Schranke. Der Wächter
-- `tests/domain/lesarten-schranken.test.ts` verlangt in beiden Schranken jede
-- Kennung, die ein Knoten als Lesart trägt.
ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_des_beschlusses_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_des_beschlusses_form
    CHECK (requirement_reading_reconsidered IS NULL OR (
        (jsonb_typeof(requirement_reading_reconsidered) = 'object') IS TRUE
        AND (requirement_reading_reconsidered->>'kennung' IN ('L2', 'L4', 'L6', 'L9', 'L11', 'L12')) IS TRUE
        AND (requirement_reading_reconsidered->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz', 'alle', 'anwesende')) IS TRUE
    ));
