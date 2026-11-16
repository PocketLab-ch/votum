-- 186 — Lesart L11: das Mehr der Ermächtigung zur Prozessführung
--
-- **Der Anlass** ist Entscheid 0044, zweiter Nachtrag, Punkt R1 (d): Führt die
-- Bewirtschaftung für die Gemeinschaft einen Zivilprozess, braucht sie vorher
-- die Ermächtigung der Versammlung (ZGB Art. 712t Abs. 2). Welches Mehr dafür
-- gilt, ist umstritten: Der SVIT-Kommentar verlangt in der Regel das
-- qualifizierte Mehr (Rz. 74 und 89a ad Art. 712t), andere Autoren lassen das
-- einfache genügen, das Bundesgericht hat die Frage offengelassen
-- (BGer 5A_198/2014 E. 6.1.2). Die Gemeinschaft wählt, ob Votum das
-- qualifizierte Mehr (Vorgabe) oder das einfache verlangt; Votum rechnet
-- zusätzlich nach der anderen Wahl und nennt das Ergebnis, wenn es abweicht.
--
--   reading_l11  qualifiziert  die Mehrheit der Anwesenden und Vertretenen
--                              nach Köpfen und dazu mehr als die Hälfte aller
--                              Wertquoten, auch der Abwesenden (Vorgabe; eine
--                              Ermächtigung, die es erreicht, besteht nach
--                              beiden Lesarten)
--                einfach       nur die Köpfe der Anwesenden und Vertretenen;
--                              die Wertquoten zählen nicht (Art. 647a Abs. 1
--                              i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2;
--                              Art. 712t Abs. 2)
--
-- **Gebaut wie L2 und L6** (Migrationen 171 und 180): Spalte an `stweg`,
-- NOT NULL mit der Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit
-- Einladung und Saal nach derselben Wahl rechnen und eine Umstellung nach dem
-- Ergebnis erst für die nächste Versammlung wirkt. Am Erfordernis steht die
-- Lesart in `agenda_item.requirement_reading`, dessen Form hier L11 dazunimmt.
ALTER TABLE stweg ADD COLUMN reading_l11 text NOT NULL DEFAULT 'qualifiziert';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l11
    CHECK (reading_l11 IN ('qualifiziert', 'einfach'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, deren Knoten die Lesart L11 nicht trägt,
-- und rechneten dort genau das qualifizierte Mehr; die eingefrorene Wahl wirkt
-- für sie in keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l11 text NOT NULL DEFAULT 'qualifiziert';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l11
    CHECK (reading_l11 IN ('qualifiziert', 'einfach'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`, wie in Migration 169: Ein fehlender Schlüssel
    -- ergäbe sonst NULL, und ein CHECK mit NULL gilt als erfüllt. Die Wahlen
    -- «qualifiziert» und «einfach» stehen schon in der Liste; L11 braucht nur
    -- die Kennung.
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' IN ('L2', 'L4', 'L6', 'L11')) IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l11 IS
    'Lesart L11, Ermächtigung der Bewirtschaftung zur Prozessführung: qualifiziert (Vorgabe) oder einfach (Entscheid 0044, zweiter Nachtrag, R1 (d)).';
COMMENT ON COLUMN snapshot.reading_l11 IS
    'Lesart L11 der Gemeinschaft bei der Freigabe (Migration 186).';

-- **Auch am Rückkommen** (Codeprüfung E1 L11, Befund 1): `erfordernisFuerRueckkommen`
-- übernimmt die Lesart des Beschlusses mit jeder Kennung in
-- `requirement_reading_reconsidered` (Migration 181). Ohne L11 hier endete
-- jedes Rückkommen auf eine Ermächtigung zur Prozessführung der Fassung
-- 2026-11-10 mit einer Verletzung dieser Schranke. Der Wächter
-- `tests/domain/lesarten-schranken.test.ts` verlangt in beiden Schranken jede
-- Kennung, die ein Knoten als Lesart trägt.
ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_des_beschlusses_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_des_beschlusses_form
    CHECK (requirement_reading_reconsidered IS NULL OR (
        (jsonb_typeof(requirement_reading_reconsidered) = 'object') IS TRUE
        AND (requirement_reading_reconsidered->>'kennung' IN ('L2', 'L4', 'L6', 'L11')) IS TRUE
        AND (requirement_reading_reconsidered->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz')) IS TRUE
    ));
