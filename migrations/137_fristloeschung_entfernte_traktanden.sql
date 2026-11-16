-- 137 — Die Fristlöschung nimmt den Verlauf entfernter Traktanden mit
-- (Auftrag F; Produktentscheid 01.10.2026: «Mitlöschen»).
--
-- **Der Anlass.** `versammlungen_endgueltig_loeschen` gilt in der Fassung aus
-- Migration 115 und sammelt die Kennungen der **lebenden** Traktanden. Ein
-- entferntes Traktandum hat keine Zeile mehr; seine Verlaufseinträge (angelegt,
-- geändert, entfernt) bleiben stehen, während die Versammlung fort ist. Seit
-- `f0b1dd9` ordnet `gehoertZu` solche Einträge über das Ereignis
-- `agenda.item.removed` zu, dessen Angaben die Versammlung nennen
-- (`detail->>'versammlung'`). Dieselbe Zuordnung fehlt der Löschung.
--
-- **Was diese Migration ändert: genau drei Stellen.** Die Funktion ist sonst
-- wörtlich die Fassung aus 115, mit derselben Signatur und denselben
-- Attributen (`SECURITY DEFINER`, `SET search_path`):
--
--   1. die Variable `eg text[]`;
--   2. ihre Füllung aus den Entfernen-Ereignissen der zu löschenden
--      Versammlungen, mit `operator_id = der_betreiber`; die Funktion läuft
--      als SECURITY DEFINER, der Zeilenschutz hilft hier nicht;
--   3. ein zusätzlicher Zweig im `DELETE FROM audit_entry`.
--
-- **Kein Nachführlauf für den Altbestand** (Produktentscheid 01.10.2026:
-- «auf Prod ist nichts.»). Die Migration ändert nur die Funktion. Die Rechte
-- aus 115 werden unverändert wiederholt, obwohl `CREATE OR REPLACE` sie
-- erhält: Wer die Datei liest, soll sie nicht erst in einer älteren suchen.

CREATE OR REPLACE FUNCTION versammlungen_endgueltig_loeschen(
    der_betreiber          uuid,
    die_versammlungen      uuid[],
    zugestellt_am          date,
    paket_archiviert       boolean,
    protokoll_archiviert   boolean,
    keine_anfechtung       boolean
)
RETURNS TABLE (pruefsummen text[], zeilen integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    heute       date := (now() AT TIME ZONE 'Europe/Zurich')::date;
    anzahl      integer;
    abende      uuid[];
    schluss     date;
    fremd       text;
    ag          uuid[];
    eg          text[];
    vr          uuid[];
    px          uuid[];
    sp          uuid[];
    pz          uuid[];
    summen      text[];
    n           integer := 0;
    k           integer;
BEGIN
    -- ── Wer, was ────────────────────────────────────────────────────────────
    IF die_versammlungen IS NULL OR cardinality(die_versammlungen) = 0 THEN
        RAISE EXCEPTION 'Es ist keine Versammlung angegeben.';
    END IF;

    -- Der Betreiber kommt als Parameter, weil die Funktion den Zeilenschutz
    -- umgeht. Er muss aber derselbe sein, den die Transaktion gesetzt hat
    -- (`alsBetreiber`); sonst liesse sich mit einer fremden Kennung in fremde
    -- Daten greifen, sobald jemand SQL an die Anwendungsrolle vorbeibringt.
    IF der_betreiber IS NULL
       OR der_betreiber::text IS DISTINCT FROM current_setting('versammlung.operator_id', true) THEN
        RAISE EXCEPTION 'Diese Versammlung gibt es nicht.';
    END IF;

    SELECT count(DISTINCT m.id) INTO anzahl
      FROM meeting m
     WHERE m.id = ANY (die_versammlungen) AND m.operator_id = der_betreiber;
    IF anzahl <> cardinality(die_versammlungen)
       OR anzahl <> (SELECT count(DISTINCT x) FROM unnest(die_versammlungen) x) THEN
        RAISE EXCEPTION 'Diese Versammlung gibt es nicht.';
    END IF;

    IF EXISTS (SELECT 1 FROM meeting m
                WHERE m.id = ANY (die_versammlungen)
                  AND m.state NOT IN ('geschlossen', 'versiegelt')) THEN
        RAISE EXCEPTION 'Gelöscht wird nur eine geschlossene Versammlung.';
    END IF;

    -- Neu in 115: nur mit Siegel. Ohne Siegel gibt es kein Abschlusspaket mit
    -- Prüfsumme, das die Verwaltung hätte archivieren können.
    IF EXISTS (SELECT 1 FROM meeting m
                WHERE m.id = ANY (die_versammlungen)
                  AND NOT EXISTS (SELECT 1 FROM seal s WHERE s.meeting_id = m.id)) THEN
        RAISE EXCEPTION 'Gelöscht wird nur eine versiegelte Versammlung. Versiegeln Sie sie zuerst und legen Sie das Abschlusspaket ins Archiv.';
    END IF;

    -- ── Der Abend als Ganzes ────────────────────────────────────────────────
    SELECT array_agg(DISTINCT m.meeting_day_id) INTO abende
      FROM meeting m
     WHERE m.id = ANY (die_versammlungen) AND m.meeting_day_id IS NOT NULL;

    IF abende IS NOT NULL THEN
        IF cardinality(abende) > 1 THEN
            RAISE EXCEPTION 'Gelöscht wird ein Abend nach dem anderen.';
        END IF;
        IF EXISTS (SELECT 1 FROM meeting m
                    WHERE m.id = ANY (die_versammlungen) AND m.meeting_day_id IS NULL)
           OR EXISTS (SELECT 1 FROM meeting m
                       WHERE m.meeting_day_id = abende[1]
                         AND NOT m.id = ANY (die_versammlungen)) THEN
            RAISE EXCEPTION 'Eine Versammlung eines gemeinsamen Abends lässt sich nur mit dem ganzen Abend löschen.';
        END IF;
    ELSIF cardinality(die_versammlungen) > 1 THEN
        RAISE EXCEPTION 'Mehrere Versammlungen zusammen lassen sich nur als gemeinsamer Abend löschen.';
    END IF;

    -- ── Pendenzen ───────────────────────────────────────────────────────────
    IF EXISTS (SELECT 1 FROM pendenz p
                WHERE p.meeting_id = ANY (die_versammlungen) AND p.state = 'offen') THEN
        RAISE EXCEPTION 'An dieser Versammlung hängen offene Pendenzen. Sie gehören der Gemeinschaft und verschwinden nicht mit der Versammlung.';
    END IF;

    -- ── Die Genehmigung des Protokolls (neu in 115) ─────────────────────────
    IF EXISTS (SELECT 1 FROM meeting m
                WHERE m.id = ANY (die_versammlungen)
                  AND protokoll_genehmigung(m.id) = 'fehlt') THEN
        RAISE EXCEPTION 'Das Protokoll ist noch nicht genehmigt. Berichtigen lässt es sich bis zur Genehmigung durch die nächste Versammlung.';
    END IF;
    IF EXISTS (SELECT 1 FROM meeting m
                WHERE m.id = ANY (die_versammlungen)
                  AND protokoll_genehmigung(m.id) = 'ohne_folgeversammlung') THEN
        RAISE EXCEPTION 'Das Protokoll ist als genehmigt festgehalten, aber keine spätere geschlossene Versammlung dieser Gemeinschaft hat vorher stattgefunden.';
    END IF;

    -- ── Die Frist ───────────────────────────────────────────────────────────
    IF zugestellt_am IS NULL THEN
        RAISE EXCEPTION 'Es fehlt das Datum der letzten Zustellung des Protokolls.';
    END IF;
    IF zugestellt_am > heute THEN
        RAISE EXCEPTION 'Das Datum der letzten Zustellung liegt in der Zukunft.';
    END IF;

    SELECT max((m.closed_at AT TIME ZONE 'Europe/Zurich')::date) INTO schluss
      FROM meeting m
     WHERE m.id = ANY (die_versammlungen);
    IF schluss IS NOT NULL AND zugestellt_am < schluss THEN
        RAISE EXCEPTION 'Das Protokoll kann nicht vor dem Schluss der Versammlung zugestellt worden sein.';
    END IF;

    IF (zugestellt_am + interval '1 month')::date + 31 > heute THEN
        RAISE EXCEPTION 'Die Anfechtungsfrist samt Reserve läuft noch. Löschbar ab %.',
            to_char((zugestellt_am + interval '1 month')::date + 31, 'DD.MM.YYYY');
    END IF;

    IF NOT coalesce(paket_archiviert, false)
       OR NOT coalesce(protokoll_archiviert, false)
       OR NOT coalesce(keine_anfechtung, false) THEN
        RAISE EXCEPTION 'Es fehlen Bestätigungen: Paket im Archiv, unterzeichnetes Protokoll im Archiv, keine Anfechtung eingegangen.';
    END IF;

    -- ── Verweise von aussen ─────────────────────────────────────────────────
    SELECT string_agg(DISTINCT to_char(m.meeting_date, 'DD.MM.YYYY'), ', ') INTO fremd
      FROM meeting m
     WHERE NOT m.id = ANY (die_versammlungen)
       AND m.previous_meeting_id = ANY (die_versammlungen);
    IF fremd IS NOT NULL THEN
        RAISE EXCEPTION 'Die Versammlung vom % baut als zweite Versammlung auf dieser auf. Löschen Sie zuerst jene.', fremd;
    END IF;

    SELECT string_agg(DISTINCT to_char(m.meeting_date, 'DD.MM.YYYY'), ', ') INTO fremd
      FROM instruction i
      JOIN meeting m ON m.id = i.meeting_id
     WHERE NOT i.meeting_id = ANY (die_versammlungen)
       AND (i.source_meeting_id = ANY (die_versammlungen)
            OR i.source_voting_round_id IN (
                SELECT r.id FROM voting_round r WHERE r.meeting_id = ANY (die_versammlungen)));
    IF fremd IS NOT NULL THEN
        RAISE EXCEPTION 'Eine Weisung der Versammlung vom % verweist auf einen Beschluss dieser Versammlung. Löschen Sie zuerst jene.', fremd;
    END IF;

    -- ── Was dazugehört, bevor es verschwindet ───────────────────────────────
    SELECT array_agg(id) INTO ag FROM agenda_item    WHERE meeting_id = ANY (die_versammlungen);
    -- Die Angaben des Entfernen-Ereignisses nennen die Versammlung; der
    -- Betreiber muss trotzdem dazustehen. Die Funktion läuft als SECURITY
    -- DEFINER, der Zeilenschutz hilft hier nicht.
    SELECT array_agg(DISTINCT e.subject_id) INTO eg FROM audit_entry e
     WHERE e.operator_id = der_betreiber
       AND e.subject_type = 'agenda_item'
       AND e.event_type = 'agenda.item.removed'
       AND e.detail->>'versammlung' = ANY (die_versammlungen::text[]);
    SELECT array_agg(id) INTO vr FROM voting_round   WHERE meeting_id = ANY (die_versammlungen);
    SELECT array_agg(id) INTO px FROM proxy          WHERE meeting_id = ANY (die_versammlungen);
    SELECT array_agg(id) INTO sp FROM snapshot_party WHERE meeting_id = ANY (die_versammlungen);
    SELECT array_agg(id) INTO pz FROM pendenz        WHERE meeting_id = ANY (die_versammlungen);

    SELECT array_agg(DISTINCT s) INTO summen FROM (
        SELECT a.checksum AS s FROM attachment a
         WHERE (a.subject_type = 'meeting'     AND a.subject_id = ANY (die_versammlungen))
            OR (a.subject_type = 'agenda_item' AND a.subject_id = ANY (coalesce(ag, '{}')))
            OR (a.subject_type = 'proxy'       AND a.subject_id = ANY (coalesce(px, '{}')))
        UNION
        SELECT package_hash FROM seal WHERE meeting_id = ANY (die_versammlungen)
        UNION
        SELECT timestamp_hash FROM seal WHERE meeting_id = ANY (die_versammlungen)
        UNION
        SELECT handout_hash FROM meeting_access WHERE meeting_id = ANY (die_versammlungen)
    ) q WHERE s IS NOT NULL;

    -- ── Die fünf Schranken, die immer sperren ───────────────────────────────
    PERFORM set_config('session_replication_role', 'replica', true);

    DELETE FROM audit_entry e
     WHERE e.operator_id = der_betreiber
       AND (   (e.subject_type = 'meeting'        AND e.subject_id = ANY (die_versammlungen::text[]))
            OR (e.subject_type = 'agenda_item'    AND e.subject_id = ANY (coalesce(ag, '{}')::text[]))
            OR (e.subject_type = 'agenda_item'    AND e.subject_id = ANY (coalesce(eg, '{}')))
            OR (e.subject_type = 'voting_round'   AND e.subject_id = ANY (coalesce(vr, '{}')::text[]))
            OR (e.subject_type = 'proxy'          AND e.subject_id = ANY (coalesce(px, '{}')::text[]))
            OR (e.subject_type = 'snapshot_party' AND e.subject_id = ANY (coalesce(sp, '{}')::text[]))
            OR (e.subject_type = 'pendenz'        AND e.subject_id = ANY (coalesce(pz, '{}')::text[]))
            OR (e.subject_type = 'meeting_day'    AND e.subject_id = ANY (coalesce(abende, '{}')::text[])));
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

    DELETE FROM seal WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

    -- Die Auslöser «nach dem Siegel» sehen auch auf den Zustand. Ohne Siegel ist
    -- die Versammlung wieder bloss geschlossen, wie im Aufräumskript.
    UPDATE meeting SET state = 'geschlossen'
     WHERE id = ANY (die_versammlungen) AND state = 'versiegelt';

    DELETE FROM instruction WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

    -- Kinder der Vollmacht zuerst: Unter `replica` kaskadiert nichts.
    DELETE FROM proxy_recommendation WHERE proxy_id = ANY (coalesce(px, '{}'));
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM attachment WHERE subject_type = 'proxy' AND subject_id = ANY (coalesce(px, '{}'));
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM proxy WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

    DELETE FROM minutes_version WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

    -- **Übernommene Traktanden späterer Versammlungen** (Code-Review 17.09.2026).
    -- `copied_from_meeting_id` zeigt nur an, woher ein Traktandum stammt; es steht
    -- nicht im Siegel und wird schon heute geleert, sobald jemand das Traktandum
    -- bearbeitet. Bei jährlichen Versammlungen ist der Verweis der Normalfall, und
    -- ohne diese Zeile liesse sich keine Versammlung löschen, deren Traktanden ins
    -- nächste Jahr übernommen wurden. Hier geleert, weil die spätere Versammlung
    -- versiegelt sein kann; ihr Auslöser würde die Änderung sonst abweisen. Nur
    -- diese eine Spalte, nur für Zeilen, die in die gelöschte Menge zeigen.
    UPDATE agenda_item SET copied_from_meeting_id = NULL
     WHERE copied_from_meeting_id = ANY (die_versammlungen)
       AND NOT meeting_id = ANY (die_versammlungen);

    PERFORM set_config('session_replication_role', 'origin', true);

    -- ── Der Rest, unter vollem Schutz ───────────────────────────────────────
    DELETE FROM vote WHERE round_id = ANY (coalesce(vr, '{}'));
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM voting_round WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM attendance_event WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM room_entry_request WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM meeting_access WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM paper_ballot WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM paper_question_answered WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM recusal WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM quorum_finding WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM ai_usage WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM pendenz WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM attachment
     WHERE (subject_type = 'meeting'     AND subject_id = ANY (die_versammlungen))
        OR (subject_type = 'agenda_item' AND subject_id = ANY (coalesce(ag, '{}')));
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM agenda_item WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM snapshot_unit WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM snapshot_party WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM snapshot WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM minutes WHERE meeting_id = ANY (die_versammlungen);
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    DELETE FROM meeting WHERE id = ANY (die_versammlungen) AND operator_id = der_betreiber;
    GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

    IF abende IS NOT NULL THEN
        DELETE FROM meeting_day WHERE id = abende[1] AND operator_id = der_betreiber;
        GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
    END IF;

    RETURN QUERY SELECT coalesce(summen, '{}'::text[]), n;
END;
$$;

REVOKE ALL ON FUNCTION versammlungen_endgueltig_loeschen(uuid, uuid[], date, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION versammlungen_endgueltig_loeschen(uuid, uuid[], date, boolean, boolean, boolean) TO versammlung_app;
