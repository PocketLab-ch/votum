-- Die Weisung: das Bindeglied zwischen Hausbeschluss und MEG-Stimme
-- (Stories 7.3 und 7.4).
--
-- Der Vertreter entscheidet nicht, er überbringt. Was er überbringt, ist das
-- Abstimmungsergebnis seines Hauses — die Ermächtigung. Der Satz des Auftraggebers, an dem das
-- ganze Modell hängt: **Über die Themen muss so oder so abgestimmt werden.** Ob
-- die Häuser getrennt tagen oder alle am selben Abend, ändert nur, *wann* die
-- Hausabstimmung stattfindet, nicht *ob*. Also gibt es hier nur einen
-- Mechanismus und nicht zwei.

-- ── Welche Traktanden eine Weisung brauchen (Story 7.3) ────────────────────
ALTER TABLE agenda_item ADD COLUMN instruction_bound boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN agenda_item.instruction_bound IS
    'Traktandum, über das die Mitgliedsgemeinschaften vorstimmen; ohne vollständige Weisungen nicht zu eröffnen.';

-- ── Die Weisung selbst (Story 7.4) ─────────────────────────────────────────
CREATE TABLE instruction (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id    uuid NOT NULL,
    meeting_id     uuid NOT NULL,
    agenda_item_id uuid NOT NULL,
    -- Das weisungsgebende Haus, als Partei der MEG.
    party_id       uuid NOT NULL,

    stance         text NOT NULL,
    source_kind    text NOT NULL,
    -- Bei `beschluss`: worauf sie beruht. Der Verweis ist der Beleg; die Zahlen
    -- stehen dort und werden hier nicht zweitgespeichert.
    source_meeting_id      uuid,
    source_voting_round_id uuid,
    note           text,

    recorded_at    timestamptz NOT NULL DEFAULT now(),
    recorded_by    uuid,
    recorded_by_label text,
    -- AD-5: Eine Berichtigung ist eine neue Zeile, die alte bleibt stehen.
    superseded_by  uuid REFERENCES instruction (id),

    CONSTRAINT instruction_haltung CHECK (stance IN ('ja', 'nein', 'enthaltung', 'frei')),
    CONSTRAINT instruction_herkunft CHECK (source_kind IN ('beschluss', 'erklaerung', 'frei')),

    -- Eine Weisung aus einem Beschluss ohne Verweis darauf wäre unbelegt: Die
    -- Auswertung der MEG soll sagen können, worauf die Stimme beruht.
    CONSTRAINT instruction_beschluss_mit_verweis
        CHECK (source_kind <> 'beschluss' OR source_voting_round_id IS NOT NULL),
    -- Eine schriftliche Erklärung ohne Bemerkung liesse offen, was erklärt
    -- wurde und von wem. Beide MEG-Reglemente kennen den Zirkularweg; die
    -- Anwendung führt ihn nicht, nimmt sein Ergebnis aber entgegen.
    CONSTRAINT instruction_erklaerung_mit_bemerkung
        CHECK (source_kind <> 'erklaerung' OR length(btrim(coalesce(note, ''))) >= 3),
    -- `frei` und eine Haltung schliessen einander aus: Wer dem Vertreter den
    -- Entscheid überlässt, gibt ihm keine Richtung mit.
    CONSTRAINT instruction_frei_ohne_haltung
        CHECK ((source_kind = 'frei') = (stance = 'frei')),

    FOREIGN KEY (meeting_id)     REFERENCES meeting (id)     ON DELETE CASCADE,
    FOREIGN KEY (agenda_item_id) REFERENCES agenda_item (id) ON DELETE CASCADE,
    FOREIGN KEY (party_id)       REFERENCES party (id)       ON DELETE RESTRICT,
    FOREIGN KEY (source_voting_round_id) REFERENCES voting_round (id) ON DELETE RESTRICT
);

CREATE INDEX instruction_traktandum_idx ON instruction (agenda_item_id, party_id);

-- Je Traktandum und Haus gilt genau **eine** Weisung. Berichtigte tragen
-- `superseded_by` und bleiben einsehbar; die geltende ist die ohne Nachfolger.
CREATE UNIQUE INDEX instruction_eine_geltende
    ON instruction (agenda_item_id, party_id)
    WHERE superseded_by IS NULL;

-- Eine Weisung darf nicht stillschweigend verschwinden oder sich ändern.
CREATE OR REPLACE FUNCTION instruction_nur_nachfolger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Weisungen werden nicht gelöscht (AD-5); tragen Sie eine berichtigte ein.';
    END IF;
    -- Erlaubt ist einzig, eine bestehende als überholt zu kennzeichnen.
    IF NEW.stance IS DISTINCT FROM OLD.stance
       OR NEW.source_kind IS DISTINCT FROM OLD.source_kind
       OR NEW.source_voting_round_id IS DISTINCT FROM OLD.source_voting_round_id
       OR NEW.party_id IS DISTINCT FROM OLD.party_id
       OR NEW.agenda_item_id IS DISTINCT FROM OLD.agenda_item_id THEN
        RAISE EXCEPTION 'Eine Weisung wird nicht geändert (AD-5); tragen Sie eine berichtigte ein.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER instruction_nur_nachfolger_trigger
    BEFORE UPDATE OR DELETE ON instruction
    FOR EACH ROW EXECUTE FUNCTION instruction_nur_nachfolger();

ALTER TABLE instruction ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruction FORCE  ROW LEVEL SECURITY;

CREATE POLICY instruction_mandant ON instruction
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

COMMENT ON TABLE instruction IS
    'Die Ermächtigung des Vertreters: das Abstimmungsergebnis seines Hauses zu einem MEG-Traktandum.';
