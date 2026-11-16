-- 136 — Der Siegelsatz nennt auch den Beschlussvermerk (Block 7b)
--
-- **Der Fall** (Produktentscheid 02.10.2026, auf die Frage, ob die Meldung der
-- Datenbank nach dem Versiegeln auch den Haken nennen soll: «Ja»). Seit
-- Migration 135 lässt das Siegel am Traktandum zwei Dinge offen, die
-- Protokollnotiz und den Beschlussvermerk. Die Absage für alles Übrige sagte
-- weiter, es lasse sich «nur noch die Protokollnotiz ändern». Wer sie liest,
-- hält den Haken für gesperrt.
--
-- **Geändert ist allein der Satz.** Die Ausnahmeliste und die Rechnung sind die
-- aus 135, Zeile für Zeile. 135 selbst bleibt, wie sie ist: Sie ist eingespielt,
-- und ihre Prüfsumme steht in `schema_migration`.
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

    SELECT string_agg(schluessel, ', ' ORDER BY schluessel)
      INTO unterschied
      FROM (
        SELECT n.key AS schluessel
          FROM jsonb_each(to_jsonb(NEW)) n
         WHERE
           -- Erlaubt bleibt einzig das Protokoll: Es ist nicht Teil des Siegels
           -- (PRD §4.11). `updated_at` setzt der Auslöser der Tabelle selbst.
           -- Der Beschlussvermerk gehört dazu wie die Notiz: Er sagt nur, dass
           -- der Text im Votenfeld der Beschluss ist.
           n.key NOT IN ('minute_text', 'minute_text_changed_at',
                         'minute_text_changed_by', 'minute_decision', 'updated_at')
           -- Erzeugte Spalten sind in einem BEFORE-Auslöser noch nicht berechnet.
           AND n.key NOT IN (
                 SELECT a.attname
                   FROM pg_attribute a
                  WHERE a.attrelid = 'agenda_item'::regclass
                    AND a.attgenerated <> ''
               )
           AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key)
      ) abweichend;

    IF unterschied IS NOT NULL THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. Am Traktandum lassen sich nur noch die Protokollnotiz und der Beschlussvermerk ändern; geändert wurde: % (FR-55).',
            unterschied;
    END IF;

    RETURN NEW;
END;
$$;
