-- 181 — Am Rückkommen die Lesart, nach der der aufgehobene Beschluss gerechnet war
--
-- **Der Anlass** ist das Review DeepSeek zu F4c, Block 1 (05.11.2026, B2):
-- Das Rückkommen übernimmt das Mehr des Beschlusses, nicht seine Lesart
-- (`erfordernisFuerRueckkommen`), denn ein zweites Ergebnis nach dem
-- Gegenstück des Beschlusses verlöre Titel und Rechtsgrundlage des
-- Rückkommens. Ohne Lesart sagte die Leitung am Rückkommen auf eine
-- Reglementsänderung unter L6 «Klausel anwenden» aber den Streit samt «nach
-- seiner strengen Lesart trotzdem eine Ablehnung», während der Beschluss
-- selbst die Klausel als Regel der Gemeinschaft nannte (`kopfbasisStreit`).
--
-- **Warum eine eigene Spalte.** `requirement_reading` trägt die Lesart, nach
-- der gezählt und das zweite Ergebnis gebildet wird; dort stünde sie am
-- Rückkommen falsch. Hier steht nur Kennung und Wahl, für den Satz der
-- Leitung. Gesetzt nur beim Rückkommen, NULL bei jedem anderen Schreiben des
-- Erfordernisses: Ein von Hand gesetztes Mehr und eine Reglementsregel, die das
-- Mehr ersetzt, tragen sie nicht. Beim Eröffnen geht sie mit dem übrigen Erfordernis in
-- `voting_round.requirement_json`.
--
-- Bestehende Rückkommen bleiben NULL und sagen den Satz wie bisher. Das ist
-- richtig: Ihre Beschlüsse stammen aus Fassungen vor 2026-11-05 und tragen
-- keine Lesart L6, denn die Fassung kommt mit derselben Auslieferung wie diese
-- Migration (F4c).
ALTER TABLE agenda_item ADD COLUMN requirement_reading_reconsidered jsonb;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_des_beschlusses_form
    -- Jedes Glied mit `IS TRUE`, wie bei `agenda_item_lesart_form` (Migration
    -- 169): Ein fehlender Schlüssel ergäbe sonst NULL, und ein CHECK mit NULL
    -- gilt als erfüllt.
    CHECK (requirement_reading_reconsidered IS NULL OR (
        (jsonb_typeof(requirement_reading_reconsidered) = 'object') IS TRUE
        AND (requirement_reading_reconsidered->>'kennung' IN ('L2', 'L4', 'L6')) IS TRUE
        AND (requirement_reading_reconsidered->>'wahl' IN ('einfach', 'qualifiziert', 'klausel', 'gesetz')) IS TRUE
    ));

COMMENT ON COLUMN agenda_item.requirement_reading_reconsidered IS
    'Am Rückkommen Kennung und Wahl der Lesart des aufgehobenen Beschlusses, nur für den Satz der Leitung (Migration 181).';
