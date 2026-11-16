-- 040 — Der Schreibschutz am Traktandum, genauer (FR-55)
--
-- Migration 039 verglich die ganze Zeile als JSON und zog vier Spalten ab. Das
-- war zu grob: Es sagte nicht, **welche** Spalte sich geändert hat — und beim
-- ersten Prüflauf stand deshalb die Meldung «nur die Protokollnotiz» da, obwohl
-- genau nur sie geändert wurde.
--
-- Jetzt wird Schlüssel für Schlüssel verglichen, und die Meldung nennt die
-- betroffene Spalte. Eine Absage, die nicht sagt, woran sie liegt, kostet im
-- Betrieb mehr Zeit als die Prüfung selbst.
CREATE OR REPLACE FUNCTION agenda_item_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    unterschied text;
BEGIN
    IF NOT versammlung_versiegelt(COALESCE(NEW.meeting_id, OLD.meeting_id)) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP <> 'UPDATE' THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «agenda_item» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;

    -- Erlaubt bleibt einzig das Protokoll: Es ist nicht Teil des Siegels
    -- (PRD §4.11). `updated_at` steht daneben, weil es der Auslöser der Tabelle
    -- selbst setzt.
    SELECT string_agg(schluessel, ', ' ORDER BY schluessel)
      INTO unterschied
      FROM (
        SELECT n.key AS schluessel
          FROM jsonb_each(to_jsonb(NEW)) n
         WHERE n.key NOT IN ('minute_text', 'minute_text_changed_at',
                             'minute_text_changed_by', 'updated_at')
           AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key)
      ) abweichend;

    IF unterschied IS NOT NULL THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. Am Traktandum lässt sich nur noch die Protokollnotiz ändern; geändert wurde: % (FR-55).',
            unterschied;
    END IF;

    RETURN NEW;
END;
$$;
