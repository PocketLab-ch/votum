-- 169 — Lesarten der Gemeinschaft: die Wahl an der Gemeinschaft, eingefroren
-- bei der Freigabe, vermerkt am Erfordernis
--
-- **Der Anlass** ist Entscheid 0018 (`docs/entscheide/0018-…`): Wo das Gesetz
-- zwei vertretene Auslegungen zulässt und das Ergebnis im Saal davon abhängt,
-- wählt die Gemeinschaft, nach welcher Votum rechnet. Votum rechnet zusätzlich
-- nach der anderen und nennt das Ergebnis, wenn es abweicht. Dieser Block baut
-- das Gerüst mit der ersten Lesart, L4.
--
-- **Gebaut wie die Universalversammlung** (Migrationen 126 bis 128): eine
-- Spalte je Lesart an `stweg`, NOT NULL mit der Vorgabe; eingefroren bei der
-- Freigabe in `snapshot`, damit Einladung und Saal nach derselben Wahl rechnen
-- und eine Umstellung nach dem Ergebnis erst für die nächste Versammlung wirkt.
--
--   reading_l4      Wahl der Bewirtschaftung, die schon Kompetenzen über die
--                   gewöhnliche Verwaltung hinaus hat.
--                     einfach        einfaches Mehr der Anwesenden und
--                                    Vertretenen (Vorgabe; Entscheid 0015,
--                                    SVIT-Kommentar Rz. 46 ad Art. 712q)
--                     qualifiziert   qualifiziertes Mehr (Wortlaut ZGB
--                                    Art. 647b Abs. 1)
--
--   reading_changer Wer die Lesarten umstellen darf (Entscheid 0018, F1).
--                     verwaltung              nur die Verwaltung (Vorgabe)
--                     verwaltung_und_leitung  auch die Sitzungsleitung
--                   Die Einstellung selbst ändert nur die Verwaltung; die
--                   Universalversammlung bleibt bei ihr (Produktentscheid
--                   20.10.2026: «Nein, nur Verwaltung»).
ALTER TABLE stweg ADD COLUMN reading_l4 text NOT NULL DEFAULT 'einfach';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l4
    CHECK (reading_l4 IN ('einfach', 'qualifiziert'));

ALTER TABLE stweg ADD COLUMN reading_changer text NOT NULL DEFAULT 'verwaltung';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesarten_wer
    CHECK (reading_changer IN ('verwaltung', 'verwaltung_und_leitung'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Traktanden rechnen nach Fassungen, die den Knoten der Lesart nicht kennen.
ALTER TABLE snapshot ADD COLUMN reading_l4 text NOT NULL DEFAULT 'einfach';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l4
    CHECK (reading_l4 IN ('einfach', 'qualifiziert'));

-- ── Am Erfordernis des Traktandums ─────────────────────────────────────────
--
-- Nach welcher Lesart das Erfordernis gebildet wurde und was die andere
-- verlangt, als Teil des Nachweises (AD-4): Ein Beschluss soll sich ohne das
-- Regelwerk nachrechnen lassen, auch das zweite Ergebnis. Beim Eröffnen geht
-- es mit dem übrigen Erfordernis in `voting_round.requirement_json`; eine
-- eigene Spalte am Durchgang bräuchte es nicht und könnte dem Erfordernis
-- widersprechen. NULL bei jedem Erfordernis ohne Lesart.
ALTER TABLE agenda_item ADD COLUMN requirement_reading jsonb;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_form
    -- Jedes Glied mit `IS TRUE`: Ein fehlender Schlüssel ergäbe sonst NULL, und
    -- ein CHECK mit NULL gilt als erfüllt (Codeprüfung Lesarten, Teil 1).
    CHECK (requirement_reading IS NULL OR (
        (jsonb_typeof(requirement_reading) = 'object') IS TRUE
        AND (requirement_reading->>'kennung' = 'L4') IS TRUE
        AND (requirement_reading->>'wahl' IN ('einfach', 'qualifiziert')) IS TRUE
        AND (jsonb_typeof(requirement_reading->'vorgabe') = 'boolean') IS TRUE
        AND (jsonb_typeof(requirement_reading->'andere') = 'object') IS TRUE
    ));

COMMENT ON COLUMN stweg.reading_l4 IS
    'Lesart L4, Wahl der Bewirtschaftung mit erweiterten Kompetenzen: einfach (Vorgabe) oder qualifiziert (Entscheid 0018).';
COMMENT ON COLUMN stweg.reading_changer IS
    'Wer die Lesarten umstellen darf: verwaltung (Vorgabe) oder verwaltung_und_leitung. Ändert nur die Verwaltung.';
COMMENT ON COLUMN snapshot.reading_l4 IS
    'Lesart L4 der Gemeinschaft bei der Freigabe (Migration 169).';
COMMENT ON COLUMN agenda_item.requirement_reading IS
    'Die Lesart, nach der das Erfordernis gebildet wurde: Kennung, Wahl, ob Vorgabe, und das Erfordernis der anderen Lesart (domain/lesarten.ts). NULL ohne Lesart.';
