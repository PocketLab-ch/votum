-- Pausen: Beginn und Ende gespeichert
-- (Auftrag 08.10.2026, «votum-entscheide-bauen», Punkt 7; Produktentscheid
-- 08.10.2026: «Beginn und Ende der Pause werden gespeichert»).
--
-- Bis hierher trug allein `meeting.paused_at` den Beginn; beim Fortsetzen
-- wurde die Spalte geleert, und wann die Pause endete, war danach nirgends
-- mehr festgehalten. Der Verlauf trägt die beiden Ereignisse mit ihren
-- Zeitpunkten, aber nicht ihr Paar: Bei mehreren Pausen lässt sich nicht
-- sagen, welches «fortgesetzt» zu welchem «unterbrochen» gehört.
--
-- Diese Tabelle hält je Pause Beginn und Ende zusammen. Sie ist die Quelle
-- für die Datenhaltung; der Verlauf bleibt der Beleg im Abschlusspaket.
CREATE TABLE meeting_pause (
    id         uuid NOT NULL DEFAULT uuidv7(),
    meeting_id uuid NOT NULL,
    operator_id uuid NOT NULL REFERENCES operator (id),
    beginn_at  timestamptz NOT NULL,
    ende_at    timestamptz,
    text       text,
    created_by text NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE,
    CONSTRAINT meeting_pause_dauer CHECK (ende_at IS NULL OR ende_at >= beginn_at),
    CONSTRAINT meeting_pause_text_kurz CHECK (text IS NULL OR length(text) <= 200)
);

ALTER TABLE meeting_pause ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_pause FORCE ROW LEVEL SECURITY;
CREATE POLICY meeting_pause_mandant ON meeting_pause
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Die Pause ist Teil des Ablaufs und damit Teil des Nachweises: Nach dem
-- Versiegeln oder der Abgabe an ein anderes Gerät wird sie nicht mehr
-- geschrieben (FR-55, wie `meeting_chair_holder`, Migration 128). UPDATE
-- braucht es hier ausnahmsweise doch: das Fortsetzen trägt das Ende ein.
CREATE OR REPLACE FUNCTION meeting_pause_geschuetzt() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid := COALESCE(NEW.meeting_id, OLD.meeting_id);
BEGIN
    IF versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «meeting_pause» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «meeting_pause» würde eine zweite Fassung erzeugen.',
            TG_OP
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER meeting_pause_geschuetzt
    BEFORE INSERT OR UPDATE OR DELETE ON meeting_pause
    FOR EACH ROW EXECUTE FUNCTION meeting_pause_geschuetzt();

COMMENT ON TABLE meeting_pause IS
    'Die Pausen einer Versammlung, je eine Zeile mit Beginn und Ende. Der Beginn entsteht mit dem Unterbrechen, das Ende mit dem Fortsetzen; NULL = die Pause dauert an.';
COMMENT ON COLUMN meeting_pause.text IS
    'Was während der Pause an der Wand stand, wie `meeting.pause_text` beim Unterbrechen.';
