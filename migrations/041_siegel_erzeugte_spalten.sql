-- 041 — Erzeugte Spalten im Schreibschutz (FR-55)
--
-- **Der Befund.** Der Schutz am Traktandum wies auch die Protokollnotiz ab,
-- obwohl genau sie erlaubt sein soll. Die genauere Meldung aus Migration 040
-- nannte den Grund: `parent_key`.
--
-- `parent_key` ist eine **erzeugte Spalte** (`GENERATED ALWAYS AS … STORED`,
-- Migration 012). In einem `BEFORE`-Auslöser sind solche Spalten in `NEW` noch
-- **nicht berechnet** — dort steht NULL, während `OLD` den fertigen Wert trägt.
-- Der Vergleich fand deshalb bei jeder Änderung einen Unterschied, auch bei
-- gar keiner.
--
-- Die Lehre über diesen Fall hinaus: Wer in einem BEFORE-Auslöser `NEW` mit
-- `OLD` vergleicht, muss erzeugte Spalten ausnehmen — sonst prüft er ein
-- Artefakt des Auslösezeitpunkts und nicht die Absicht des Aufrufers. Die
-- Ausnahmeliste steht deshalb nicht von Hand da, sondern kommt aus dem Katalog:
-- Wer morgen eine weitere erzeugte Spalte anlegt, muss hier nichts nachtragen.
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
           n.key NOT IN ('minute_text', 'minute_text_changed_at',
                         'minute_text_changed_by', 'updated_at')
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
