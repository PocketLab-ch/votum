-- Eine Versammlung im Entwurf löschen.
--
-- **Warum als Funktion und nicht als GRANT DELETE.** Die Anwendungsrolle darf
-- `meeting` nur lesen, einfügen und ändern — löschen nicht (Migration 011).
-- Diese Schranke bleibt: Sie hält jeden anderen Codepfad davon ab, eine
-- Versammlung wegzuräumen, auch versehentlich, auch mitten in der Sitzung. Was
-- der Betrieb braucht, ist **ein** eng gefasster Weg daneben, mit eigener
-- Prüfung des Zustands — dasselbe Muster wie `betriebsdaten_loeschen`
-- (Migration 042).
--
-- **Warum nur im Entwurf.** Ab der Freigabe steht die Versammlung in versandten
-- Einladungen und hat eine festgeschriebene Momentaufnahme; ab dem Eröffnen ist
-- sie der Nachweis der gefassten Beschlüsse. Die Freigabe lässt sich
-- zurücknehmen, der Weg ist also nicht versperrt — er führt über einen
-- sichtbaren Schritt.
--
-- **Was die Funktion nicht tut: schweigend Widersprüche wegräumen.** Hängen an
-- einer Versammlung im Entwurf Stimmen, Anwesenheit, Vollmachten, ein Protokoll
-- oder ein Siegel, dann stimmt etwas nicht, und das soll auffallen statt
-- verschwinden. Sie bricht dann ab. Abgeräumt wird nur, was im Entwurf
-- entstehen darf: Traktanden, Dateien, KI-Nutzung, eine Momentaufnahme aus
-- einer zurückgenommenen Freigabe und die Zugänge dazu.
--
-- Die Funktion läuft mit den Rechten ihres Eigentümers und umgeht damit den
-- Zeilenschutz. Sie bekommt den Betreiber deshalb mitgegeben und prüft ihn
-- selbst; ohne das liesse sich über sie in fremde Daten greifen.

CREATE OR REPLACE FUNCTION versammlung_loeschen(der_betreiber uuid, die_versammlung uuid)
RETURNS TABLE (traktanden integer, dateien integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    UPDATE agenda_item SET copied_from_meeting_id = NULL
     WHERE copied_from_meeting_id = die_versammlung;

    DELETE FROM instruction   WHERE meeting_id = die_versammlung;
    DELETE FROM voting_round  WHERE meeting_id = die_versammlung;
    DELETE FROM room_entry_request WHERE meeting_id = die_versammlung;
    DELETE FROM access_session z
     USING meeting_access a
     WHERE a.id = z.meeting_access_id AND a.meeting_id = die_versammlung;
    DELETE FROM meeting_access WHERE meeting_id = die_versammlung;
    DELETE FROM ai_usage       WHERE meeting_id = die_versammlung;

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

REVOKE ALL ON FUNCTION versammlung_loeschen(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION versammlung_loeschen(uuid, uuid) TO versammlung_app;
