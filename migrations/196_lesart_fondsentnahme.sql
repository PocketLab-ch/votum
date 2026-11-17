-- 196: Lesart L17, das Mehr der Bezahlung einer Arbeit aus dem Erneuerungsfonds
--
-- **Der Anlass** ist der Produktentscheid vom 17.11.2026 («Strenger per Default
-- und einstellbar», «Eine: nach SVIT-Kommentar») zur Fassung 2026-11-20: Über
-- die Bezahlung einer Arbeit aus dem Fonds beschliesst die Versammlung getrennt
-- von der Arbeit selbst. Sagen weder Reglement noch Errichtungsbeschluss, mit
-- welchem Mehr, ist es umstritten: Eigenmann und Piccinin verlangen das
-- qualifizierte Mehr, der SVIT-Kommentar lässt im Rahmen des Zwecks das einfache
-- nach Köpfen genügen (Rz. 139 ad Art. 712l). Für eine bei der Schaffung des
-- Fonds vereinbarte weitere Verwendung verlangt Bloch die Zustimmung aller, der
-- SVIT-Kommentar das Mehr im Zweck (Rz. 138).
--
--   reading_l17  streng  im Zweck das qualifizierte Mehr, an der vereinbarten
--                        Verwendung die Zustimmung aller; eine Regel der
--                        Gemeinschaft gilt nur, wenn sie in keiner Hinsicht
--                        milder ist (Vorgabe; ein so gefasster Beschluss
--                        besteht nach beiden Auffassungen)
--                svit    an beiden Karten das einfache Mehr nach Köpfen; eine
--                        Regel gilt nur, wenn sie eigens für diesen Fall
--                        hinterlegt ist, milder wie strenger
--
-- **Gebaut wie L11 und L12** (Migrationen 186, 187): Spalte an `stweg`, NOT
-- NULL mit der Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit
-- Einladung und Saal nach derselben Wahl rechnen und eine Umstellung nach dem
-- Ergebnis erst für die nächste Versammlung wirkt. Am Erfordernis steht die
-- Lesart in `agenda_item.requirement_reading`, dessen Form hier L17 und die
-- Wahlen «streng» und «svit» dazunimmt.
ALTER TABLE stweg ADD COLUMN reading_l17 text NOT NULL DEFAULT 'streng';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l17
    CHECK (reading_l17 IN ('streng', 'svit'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, die die Karten mit L17 nicht kennen; die
-- eingefrorene Wahl wirkt für sie in keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l17 text NOT NULL DEFAULT 'streng';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l17
    CHECK (reading_l17 IN ('streng', 'svit'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`, wie in Migration 169: Ein fehlender Schlüssel
    -- ergäbe sonst NULL, und ein CHECK mit NULL gilt als erfüllt.
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' IN ('L2', 'L4', 'L6', 'L9', 'L11', 'L12', 'L17')) IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz', 'alle', 'anwesende', 'streng', 'svit')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l17 IS
    'Lesart L17, Mehr der Bezahlung aus dem Erneuerungsfonds: streng (Vorgabe) oder svit (Produktentscheid 17.11.2026, Fassung 2026-11-20).';
COMMENT ON COLUMN snapshot.reading_l17 IS
    'Lesart L17 der Gemeinschaft bei der Freigabe (Migration 196).';

-- **Auch am Rückkommen**, wie bei L9, L11 und L12: `erfordernisFuerRueckkommen`
-- übernimmt die Lesart des Beschlusses mit jeder Kennung in
-- `requirement_reading_reconsidered` (Migration 181). Ohne L17 hier endete
-- jedes Rückkommen auf eine Bezahlung aus dem Fonds der Fassung 2026-11-20 mit
-- einer Verletzung dieser Schranke. Der Wächter
-- `tests/domain/lesarten-schranken.test.ts` verlangt in beiden Schranken jede
-- Kennung, die ein Knoten als Lesart trägt.
ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_des_beschlusses_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_des_beschlusses_form
    CHECK (requirement_reading_reconsidered IS NULL OR (
        (jsonb_typeof(requirement_reading_reconsidered) = 'object') IS TRUE
        AND (requirement_reading_reconsidered->>'kennung' IN ('L2', 'L4', 'L6', 'L9', 'L11', 'L12', 'L17')) IS TRUE
        AND (requirement_reading_reconsidered->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz', 'alle', 'anwesende', 'streng', 'svit')) IS TRUE
    ));
