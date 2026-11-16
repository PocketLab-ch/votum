-- 172 — Lesart L3: die Zählung an der Einsprache in einer Gemeinschaft je Einheit
--
-- **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), Block 5. Zählt
-- eine Gemeinschaft je Einheit, fragt sich an der Einsprache nach Art. 712c
-- Abs. 2, ob dort die Zählung je Einheit gilt oder nach Gesetz eine Stimme je
-- Eigentümer (SVIT-Kommentar Rz. 181 ad Art. 712m). Die Stelle zur Einsprache
-- verweist für das Mehr auf die allgemeinen Regeln (Rz. 185 ad Art. 712c, Rz. 186
-- ad Art. 712m) und verbietet, das Mehr zu erleichtern (Rz. 186 ad Art. 712c);
-- die Zählung je Einheit kann es erleichtern. Vorgabe ist deshalb die gesetzliche
-- Zählung, eine Stimme je Eigentümer.
--
--   reading_l3   je_eigentuemer   eine Stimme je Eigentümer (Vorgabe; Rz. 181
--                                 ad Art. 712m)
--                je_einheit       die Zählung je Einheit aus dem Reglement gilt
--                                 auch hier (Rz. 185 ad Art. 712c mit Rz. 186 ad
--                                 Art. 712m)
--
-- Anders als L1 wirkt L3 an der Zählung, nicht am Mehr: Der Knoten behält
-- Kennung und Mehr; gezählt wird ab der Fassung 2026-10-28 nach der Wahl, und
-- das Ergebnis nach der anderen Zählweise steht daneben. Wegen der 14-Tage-Frist
-- hält die Handzählung an der Einsprache beide Zählungen fest
-- (`voting_round.tally_other_*`).
--
-- **Gebaut wie L1** (Migration 170): Spalte an `stweg`, eingefroren in
-- `snapshot` bei der Freigabe, am Erfordernis gesetzt von einem Auslöser.
ALTER TABLE stweg ADD COLUMN reading_l3 text NOT NULL DEFAULT 'je_eigentuemer';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l3
    CHECK (reading_l3 IN ('je_eigentuemer', 'je_einheit'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Wirkung hat das keine: Ihre
-- Traktanden stammen aus Fassungen vor 2026-10-28 und zählen nach der Zählweise
-- der Gemeinschaft (`l3Wirkt`, Bindung an die Fassung).
ALTER TABLE snapshot ADD COLUMN reading_l3 text NOT NULL DEFAULT 'je_eigentuemer';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l3
    CHECK (reading_l3 IN ('je_eigentuemer', 'je_einheit'));

-- ── Am Erfordernis des Traktandums ─────────────────────────────────────────
--
-- NULL ohne Erfordernis, und bei jedem Traktandum von vorher; die Zählung liest
-- NULL als Vorgabe, so wie diese Traktanden gerechnet haben.
ALTER TABLE agenda_item ADD COLUMN requirement_reading_l3 text;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_l3
    CHECK (requirement_reading_l3 IS NULL OR requirement_reading_l3 IN ('je_eigentuemer', 'je_einheit'));

-- **Die Datenbank setzt die Wahl, nicht die Schreibstelle**, aus demselben
-- Grund wie L1 (Migration 170): Ein Erfordernis entsteht an vielen Stellen, und
-- eine Stelle, die die Wahl vergässe, rechnete still nach der Vorgabe.
CREATE OR REPLACE FUNCTION agenda_lesart_l3_setzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    wahl text;
BEGIN
    IF NEW.requirement_type IS NULL THEN
        NEW.requirement_reading_l3 := NULL;
        RETURN NEW;
    END IF;
    SELECT s.reading_l3 INTO wahl FROM snapshot s WHERE s.meeting_id = NEW.meeting_id;
    IF wahl IS NULL THEN
        SELECT g.reading_l3 INTO wahl
          FROM meeting m JOIN stweg g ON g.id = m.stweg_id
         WHERE m.id = NEW.meeting_id;
    END IF;
    IF wahl IS NULL THEN
        RAISE EXCEPTION 'Die Lesart L3 der Gemeinschaft ist für dieses Traktandum nicht zu finden.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_item_lesart_l3_quelle';
    END IF;
    NEW.requirement_reading_l3 := wahl;
    RETURN NEW;
END;
$$;

-- `agenda_aa_…` läuft vor den Wächtern an `agenda_item`, wie L1.
CREATE TRIGGER agenda_aa_lesart_l3_setzen
    BEFORE INSERT OR UPDATE OF requirement_type, requirement_version, requirement_reading_l3
    ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_lesart_l3_setzen();

-- ── Die zweite Zählung der Handzählung ─────────────────────────────────────
--
-- An der Einsprache zählt die Leitung die Hände zweimal, je Eigentümer und je
-- Einheit, und trägt beide Dreizahlen ein (Entscheid des Auftraggebers
-- 21.10.2026). Die erste ist die nach der Einstellung, die zweite die andere.
-- Zusammengehörig wie die erste Dreizahl (Migration 083), und nur neben ihr:
-- Eine zweite Zählung ohne erste ist ein halber Durchgang.
ALTER TABLE voting_round
    ADD COLUMN tally_other_yes     integer,
    ADD COLUMN tally_other_no      integer,
    ADD COLUMN tally_other_abstain integer;

ALTER TABLE voting_round
    ADD CONSTRAINT voting_round_summe_andere_vollstaendig CHECK (
        (tally_other_yes IS NULL AND tally_other_no IS NULL AND tally_other_abstain IS NULL)
        OR (tally_other_yes IS NOT NULL AND tally_other_no IS NOT NULL AND tally_other_abstain IS NOT NULL)
    ),
    ADD CONSTRAINT voting_round_summe_andere_nicht_negativ CHECK (
        (tally_other_yes IS NULL OR tally_other_yes >= 0)
        AND (tally_other_no IS NULL OR tally_other_no >= 0)
        AND (tally_other_abstain IS NULL OR tally_other_abstain >= 0)
    ),
    ADD CONSTRAINT voting_round_summe_andere_nur_neben CHECK (
        tally_other_yes IS NULL OR tally_yes IS NOT NULL
    );

COMMENT ON COLUMN stweg.reading_l3 IS
    'Lesart L3, Zählung an der Einsprache in einer Gemeinschaft je Einheit: je_eigentuemer (Vorgabe) oder je_einheit (Entscheid 0018).';
COMMENT ON COLUMN snapshot.reading_l3 IS
    'Lesart L3 der Gemeinschaft bei der Freigabe (Migration 172).';
COMMENT ON COLUMN agenda_item.requirement_reading_l3 IS
    'Lesart L3, nach der das Traktandum an der Einsprache zählt; gesetzt vom Auslöser agenda_lesart_l3_setzen. NULL ohne Erfordernis oder von vor Migration 172 (zählt nach der Vorgabe).';
COMMENT ON COLUMN voting_round.tally_other_yes IS
    'Die zweite Zählung der Handzählung an der Einsprache (je Eigentümer oder je Einheit, die andere als tally_yes), dafür — ohne Zuordnung. ';
