-- 187 — Lesart L12: die Zählung der Einstimmigkeit bei der luxuriösen Massnahme
--
-- **Der Anlass** ist Entscheid 0044, zweiter Nachtrag, Punkt R5 (a): Eine
-- luxuriöse bauliche Massnahme braucht die Zustimmung aller Eigentümer (ZGB
-- Art. 647e Abs. 1). Wessen Zustimmung dafür zählt, ist umstritten: Die
-- herrschende Lehre verlangt die aller im Grundbuch eingetragenen Eigentümer,
-- der SVIT-Kommentar lässt die aller Anwesenden und Vertretenen genügen
-- (Rz. 197 ad Art. 712m, mit Schmid; anders Manz). Die Gemeinschaft wählt, ob
-- Votum über alle (Vorgabe) oder über die Anwesenden und Vertretenen zählt;
-- Votum rechnet zusätzlich nach der anderen Wahl und nennt das Ergebnis, wenn
-- es abweicht.
--
--   reading_l12  alle        jeder im Grundbuch eingetragene Eigentümer muss
--                            zustimmen, selbst oder über seine Vertretung; wer
--                            weder da noch vertreten ist, wirkt wie ein Nein
--                            (Vorgabe; ein so gefasster Beschluss besteht nach
--                            beiden Lesarten)
--                anwesende   es genügt die Zustimmung aller Anwesenden und
--                            Vertretenen; wer weder da noch vertreten ist,
--                            zählt nicht mit (SVIT-Kommentar Rz. 197 ad
--                            Art. 712m)
--
-- **Gebaut wie L11** (Migration 186): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit Einladung und Saal
-- nach derselben Wahl rechnen und eine Umstellung nach dem Ergebnis erst für
-- die nächste Versammlung wirkt. Am Erfordernis steht die Lesart in
-- `agenda_item.requirement_reading`, dessen Form hier L12 dazunimmt.
ALTER TABLE stweg ADD COLUMN reading_l12 text NOT NULL DEFAULT 'alle';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l12
    CHECK (reading_l12 IN ('alle', 'anwesende'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, deren Knoten die Lesart L12 nicht trägt,
-- und rechneten dort über alle Eigentümer; die eingefrorene Wahl wirkt für sie
-- in keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l12 text NOT NULL DEFAULT 'alle';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l12
    CHECK (reading_l12 IN ('alle', 'anwesende'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`, wie in Migration 169: Ein fehlender Schlüssel
    -- ergäbe sonst NULL, und ein CHECK mit NULL gilt als erfüllt. Die Wahlen
    -- «alle» und «anwesende» kommen mit L12 dazu.
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' IN ('L2', 'L4', 'L6', 'L11', 'L12')) IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz', 'alle', 'anwesende')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l12 IS
    'Lesart L12, Zählung der Einstimmigkeit bei der luxuriösen baulichen Massnahme: alle (Vorgabe) oder anwesende (Entscheid 0044, zweiter Nachtrag, R5 (a)).';
COMMENT ON COLUMN snapshot.reading_l12 IS
    'Lesart L12 der Gemeinschaft bei der Freigabe (Migration 187).';

-- **Auch am Rückkommen**, wie bei L11: `erfordernisFuerRueckkommen` übernimmt
-- die Lesart des Beschlusses mit jeder Kennung in
-- `requirement_reading_reconsidered` (Migration 181). Ohne L12 hier endete
-- jedes Rückkommen auf eine luxuriöse bauliche Massnahme der Fassung
-- 2026-11-10 mit einer Verletzung dieser Schranke. Der Wächter
-- `tests/domain/lesarten-schranken.test.ts` verlangt in beiden Schranken jede
-- Kennung, die ein Knoten als Lesart trägt.
ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_lesart_des_beschlusses_form;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_des_beschlusses_form
    CHECK (requirement_reading_reconsidered IS NULL OR (
        (jsonb_typeof(requirement_reading_reconsidered) = 'object') IS TRUE
        AND (requirement_reading_reconsidered->>'kennung' IN ('L2', 'L4', 'L6', 'L11', 'L12')) IS TRUE
        AND (requirement_reading_reconsidered->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz', 'alle', 'anwesende')) IS TRUE
    ));
