-- 135 — Der Beschlussvermerk am Traktandum (Block 7)
--
-- **Der Fall** (Produktentscheide 02.10.2026): Kommt Votum erst zurück, wenn die
-- Versammlung schon geschlossen ist, lässt sich ein Beschluss nicht mehr von
-- Hand festhalten. Das Handbuch schickt die Sitzungsleitung dann ins Votenfeld
-- des Traktandums. Steht dort ein Beschluss, den Votum nicht führt, sagt das
-- Protokoll bisher daneben «Über diesen Antrag wurde nicht abgestimmt.», und am
-- gemeinsamen Abend zählt der Punkt als offene Lücke.
--
-- `minute_decision` sagt nur: **Der Text im Votenfeld ist der Beschluss.** Kein
-- Ergebnis, keine Zahlen, kein Ausgang. Was beschlossen wurde, steht weiterhin
-- allein im Text der Leitung.
--
-- **Das Siegel lässt die Spalte offen**, wie die Protokollnotiz: Sie ist nicht
-- Teil des Nachweises (PRD §4.11). Die Fassung in Migration 041 nimmt deshalb
-- `minute_decision` in die Ausnahmeliste auf; alles Übrige bleibt unverändert.
ALTER TABLE agenda_item
    ADD COLUMN minute_decision boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN agenda_item.minute_decision IS
    'Der Text im Votenfeld ist der Beschluss, den Votum nicht führt (Block 7). Ersetzt im Protokoll den Satz «Über diesen Antrag wurde nicht abgestimmt.» und lässt den Punkt am gemeinsamen Abend nicht als Lücke zählen.';

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
            'Diese Versammlung ist versiegelt. Am Traktandum lässt sich nur noch die Protokollnotiz ändern; geändert wurde: % (FR-55).',
            unterschied;
    END IF;

    RETURN NEW;
END;
$$;
