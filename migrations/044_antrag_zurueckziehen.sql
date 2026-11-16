-- 044 — Einen Antrag zurückziehen (Welle 3, FR-45)
--
-- **Zurückgezogen ist nicht abgelehnt.** Wer seinen Antrag vor der Abstimmung
-- zurücknimmt, hat keine Niederlage erlitten — es gab keine Abstimmung. Steht
-- im Protokoll «abgelehnt», wo «zurückgezogen» hingehört, ist das eine falsche
-- Tatsachenbehauptung über eine Versammlung: Sie könnte den Antragsteller im
-- nächsten Jahr davon abhalten, dieselbe Sache noch einmal vorzubringen, und
-- sie behauptet eine Mehrheit, die nie gezählt wurde.
--
-- **Nur vor der Abstimmung.** Ist einmal abgestimmt, gehört das Ergebnis der
-- Versammlung und nicht mehr dem Antragsteller. Wer danach etwas ändern will,
-- braucht den Rückkommensantrag (FR-44) — und dafür die Zustimmung der
-- Versammlung.
--
-- **Kein Löschen.** Das Traktandum bleibt stehen, mit Zeitpunkt, Person und
-- Begründung. Ein verschwundener Antrag liesse die Traktandenliste des Versands
-- und das Protokoll auseinanderlaufen, und niemand könnte erklären, wohin
-- Nummer 7 gekommen ist.

ALTER TABLE agenda_item ADD COLUMN withdrawn_at       timestamptz;
ALTER TABLE agenda_item ADD COLUMN withdrawn_by       uuid REFERENCES app_user (id);
ALTER TABLE agenda_item ADD COLUMN withdrawn_by_label text;
ALTER TABLE agenda_item ADD COLUMN withdrawn_reason   text;

-- Ein Rückzug ohne Zeitpunkt und ohne Person wäre eine Behauptung. Die
-- Begründung ist Pflicht, wie bei der Zurückweisung einer Vollmacht: Im
-- Protokoll steht sonst, dass etwas nicht behandelt wurde, und niemand weiss
-- warum.
ALTER TABLE agenda_item ADD CONSTRAINT agenda_rueckzug_vollstaendig CHECK (
    withdrawn_at IS NULL
    OR (
        length(btrim(coalesce(withdrawn_by_label, ''))) >= 2
        AND length(btrim(coalesce(withdrawn_reason, ''))) >= 3
    )
);

-- Eine Kenntnisnahme lässt sich nicht zurückziehen: Es gibt keinen Antrag, den
-- man zurücknehmen könnte. Was nicht mehr zur Kenntnis genommen werden soll,
-- wird von der Liste genommen, solange die noch offen ist.
ALTER TABLE agenda_item ADD CONSTRAINT agenda_rueckzug_nur_antrag CHECK (
    withdrawn_at IS NULL OR item_kind = 'abstimmung'
);

COMMENT ON COLUMN agenda_item.withdrawn_at IS
    'Zeitpunkt des Rückzugs (FR-45). Ein zurückgezogener Antrag wird nicht abgestimmt und gilt nicht als abgelehnt.';

CREATE INDEX agenda_item_zurueckgezogen_idx ON agenda_item (meeting_id)
    WHERE withdrawn_at IS NOT NULL;

-- ── Kein Beschluss über einen zurückgezogenen Antrag ───────────────────────
--
-- Die Prüfung liegt zusätzlich in der Datenbank, weil hier ein Ergebnis
-- entsteht: Wer über einen zurückgezogenen Antrag abstimmen lässt, erzeugt
-- einen Beschluss, den es nicht geben darf — und der sähe hinterher aus wie
-- jeder andere.
CREATE OR REPLACE FUNCTION durchgang_nicht_ueber_zurueckgezogenes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    zurueck timestamptz;
    bezeichnung text;
BEGIN
    SELECT a.withdrawn_at, a.title INTO zurueck, bezeichnung
      FROM agenda_item a WHERE a.id = NEW.agenda_item_id;

    IF zurueck IS NOT NULL THEN
        RAISE EXCEPTION
            'Der Antrag «%» ist zurückgezogen. Über einen zurückgezogenen Antrag wird nicht abgestimmt (FR-45).',
            bezeichnung;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_nicht_ueber_zurueckgezogenes
    BEFORE INSERT ON voting_round
    FOR EACH ROW EXECUTE FUNCTION durchgang_nicht_ueber_zurueckgezogenes();

-- ── Kein Rückzug nach der Abstimmung ───────────────────────────────────────
--
-- Ist einmal abgestimmt, gehört das Ergebnis der Versammlung. Ein nachträglicher
-- Rückzug nähme ihr einen gefassten Beschluss weg — und zwar ohne Abstimmung
-- darüber.
CREATE OR REPLACE FUNCTION agenda_rueckzug_nur_vor_der_abstimmung() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL THEN
        IF EXISTS (
            SELECT 1 FROM voting_round r
             WHERE r.agenda_item_id = NEW.id AND r.superseded_at IS NULL
        ) THEN
            RAISE EXCEPTION
                'Über «%» wurde bereits abgestimmt. Ein gefasster Beschluss lässt sich nicht durch Rückzug beseitigen; dafür gibt es den Rückkommensantrag (FR-44).',
                NEW.title;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_item_rueckzug_vor_abstimmung
    BEFORE UPDATE ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_rueckzug_nur_vor_der_abstimmung();
