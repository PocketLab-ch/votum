-- 168 — Eine Versammlung im Entwurf mit Ausstand vorab lässt sich löschen
--
-- **Der Anlass** (Codeprüfung zu Befund N4, 18.10.2026). Seit Migration 167
-- lässt sich ein Ausstand schon im Entwurf erklären (Traktandenseite, «Ausstand
-- vorab»). `recusal` hängt mit `(meeting_id, operator_id)` ohne `ON DELETE` an
-- der Versammlung, und `versammlung_loeschen` räumte die Tabelle nicht ab. Wer
-- danach die Versammlung löschte, bekam statt einer Absage einen Serverfehler:
-- `violates foreign key constraint "recusal_meeting_id_operator_id_fkey"`,
-- gemessen auf Dev in einer zurückgerollten Transaktion.
--
-- Die übrigen Tabellen mit einem solchen Fremdschlüssel auf `meeting` räumt die
-- Funktion schon ab oder weist sie in der Vorprüfung ab; `paper_ballot`,
-- `paper_question_answered` und `quorum_finding` entstehen nur in der
-- laufenden Versammlung. Die Fristlöschung (137) räumt `recusal` bereits ab.
--
-- Der Körper ist derselbe wie in 154, mit einer Zeile mehr. Rückgabetyp und
-- Rechte bleiben, deshalb genügt `CREATE OR REPLACE`.

CREATE OR REPLACE FUNCTION versammlung_loeschen(der_betreiber uuid, die_versammlung uuid)
RETURNS TABLE (traktanden integer, dateien integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    zustand  text;
    haengt   integer;
    nachfolge text;
    t        integer;
    d        integer;
BEGIN
    SELECT m.state INTO zustand
      FROM meeting m
     WHERE m.id = die_versammlung AND m.operator_id = der_betreiber;

    IF zustand IS NULL THEN
        RAISE EXCEPTION 'Diese Versammlung gibt es nicht.';
    END IF;
    IF zustand <> 'entwurf' THEN
        RAISE EXCEPTION
            'Nur eine Versammlung im Entwurf lässt sich löschen; diese ist %.', zustand;
    END IF;

    -- Eine Zweitversammlung, die auf diese verweist, verlöre ihre Vorgängerin
    -- und damit die Grundlage der Zehntagesfrist (ZGB Art. 712p Abs. 2).
    SELECT string_agg(to_char(m.meeting_date, 'DD.MM.YYYY'), ', ') INTO nachfolge
      FROM meeting m
     WHERE m.previous_meeting_id = die_versammlung;
    IF nachfolge IS NOT NULL THEN
        RAISE EXCEPTION
            'Auf diese Versammlung verweist eine spätere (%) als Vorgängerin.', nachfolge;
    END IF;

    SELECT (SELECT count(*) FROM vote v
             JOIN voting_round r ON r.id = v.round_id
            WHERE r.meeting_id = die_versammlung)
         + (SELECT count(*) FROM attendance_event WHERE meeting_id = die_versammlung)
         + (SELECT count(*) FROM proxy            WHERE meeting_id = die_versammlung)
         + (SELECT count(*) FROM minutes          WHERE meeting_id = die_versammlung)
         + (SELECT count(*) FROM seal             WHERE meeting_id = die_versammlung)
      INTO haengt;
    IF haengt > 0 THEN
        RAISE EXCEPTION
            'An dieser Versammlung hängen Daten, die es im Entwurf nicht geben kann (%). Bitte melden.',
            haengt;
    END IF;

    -- Von hier an in der Reihenfolge der Abhängigkeiten. Die Herkunftsangabe
    -- kopierter Traktanden wird gelöst statt gelöscht: Sie darf das Löschen
    -- nicht für immer blockieren, und ohne Ziel ist sie ohnehin ohne Aussage.
    -- Unter `replica`, weil die spätere Versammlung versiegelt sein kann (D8).
    PERFORM set_config('session_replication_role', 'replica', true);
    UPDATE agenda_item SET copied_from_meeting_id = NULL
     WHERE copied_from_meeting_id = die_versammlung;
    PERFORM set_config('session_replication_role', 'origin', true);

    DELETE FROM instruction   WHERE meeting_id = die_versammlung;
    DELETE FROM voting_round  WHERE meeting_id = die_versammlung;
    DELETE FROM room_entry_request WHERE meeting_id = die_versammlung;
    DELETE FROM access_session z
     USING meeting_access a
     WHERE a.id = z.meeting_access_id AND a.meeting_id = die_versammlung;
    DELETE FROM meeting_access WHERE meeting_id = die_versammlung;
    DELETE FROM ai_usage       WHERE meeting_id = die_versammlung;
    -- Neu in 168: Ein Ausstand vorab (167) hängt ohne CASCADE an der Versammlung.
    DELETE FROM recusal        WHERE meeting_id = die_versammlung;

    WITH weg AS (
        DELETE FROM attachment
         WHERE (subject_type = 'meeting' AND subject_id = die_versammlung)
            OR (subject_type = 'agenda_item'
                AND subject_id IN (SELECT id FROM agenda_item WHERE meeting_id = die_versammlung))
        RETURNING id
    ) SELECT count(*)::int INTO d FROM weg;

    WITH weg AS (
        DELETE FROM agenda_item WHERE meeting_id = die_versammlung RETURNING id
    ) SELECT count(*)::int INTO t FROM weg;

    -- snapshot_unit hängt per CASCADE an snapshot_party.
    DELETE FROM snapshot_party WHERE meeting_id = die_versammlung;
    DELETE FROM snapshot       WHERE meeting_id = die_versammlung;

    DELETE FROM meeting WHERE id = die_versammlung AND operator_id = der_betreiber;

    RETURN QUERY SELECT t, d;
END;
$$;
