-- Versammlungen nach Ablauf der Anfechtungsfrist löschen (Produktentscheid 17.09.2026).
--
-- **Der Anlass.** Migration 042 hielt ein versiegeltes Paket zehn Jahre fest. Einen
-- Weg, es danach zu löschen, gab es nie: `versammlung_loeschen` (058) nimmt nur
-- Entwürfe. Die Frist sperrte also eine Tür, die es nicht gab.
--
-- **Die neue Ordnung.** Abschlusspaket und unterzeichnetes Protokoll bewahrt die
-- Verwaltung in ihrem eigenen Archiv auf, solange das Stockwerkeigentum besteht
-- (Wermelinger, Rz. 141, 144 f. ad Art. 712n). Votum braucht die Daten danach
-- nicht mehr. Löschbar ist eine geschlossene oder versiegelte Versammlung, wenn
-- die Anfechtungsfrist für alle abgelaufen ist, und 30 Tage Reserve dazu:
--
--   Frist:  ein Monat ab Kenntnis (ZGB Art. 75 i.V.m. Art. 712m Abs. 2), für
--           Abwesende ab Zustellung des Protokolls (Wermelinger, Rz. 230, 230a
--           ad Art. 712m). Massgebend ist die LETZTE Zustellung.
--   Ende:   derselbe Tag im Folgemonat, fehlt er, der letzte des Monats
--           (OR Art. 77 Abs. 1 Ziff. 3). `date + interval '1 month'` rechnet
--           genau so.
--   Reserve: 30 volle Tage danach. Eine Klage wird innert Frist eingereicht,
--           das Schlichtungsgesuch erreicht die Gemeinschaft oft erst später.
--   Löschbar ab dem Tag nach der Reserve: Fristende + 31 Tage.
--
-- Dieselbe Rechnung steht im Kern (`src/lib/domain/loeschfrist.ts`). Die
-- Oberfläche erklärt mit ihr, die Datenbank entscheidet mit dieser.

-- ── Das Siegel sperrt, bis gelöscht wird ───────────────────────────────────
--
-- `aufbewahrung_laeuft` hiess bisher «Siegel jünger als die Frist in Jahren».
-- Jetzt heisst es: Es gibt ein Siegel. Jeder Löschweg ausser dem einen unten
-- bleibt damit gesperrt, auch ein DELETE von Hand und der Umweg über die
-- Gemeinschaft. `operator.retention_years` bleibt stehen (AD-14), wird aber
-- nicht mehr gelesen.
--
-- Gleicher Rückgabetyp, also genügt CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION aufbewahrung_laeuft(die_versammlung uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM seal s WHERE s.meeting_id = die_versammlung);
$$;

CREATE OR REPLACE FUNCTION meeting_aufbewahrung() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF aufbewahrung_laeuft(OLD.id) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. Löschen lässt sie sich erst nach Ablauf der Anfechtungsfrist, unter «Betreiber → Aufbewahrung und Löschung».';
    END IF;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION stweg_aufbewahrung() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    betroffen integer;
BEGIN
    SELECT count(*) INTO betroffen
      FROM meeting m
     WHERE m.stweg_id = OLD.id AND aufbewahrung_laeuft(m.id);

    IF betroffen > 0 THEN
        RAISE EXCEPTION
            'An dieser Gemeinschaft hängen % versiegelte Versammlungen. Sie lassen sich erst nach Ablauf der Anfechtungsfrist löschen.',
            betroffen;
    END IF;
    RETURN OLD;
END;
$$;

-- `aufbewahrung_bis` rechnet weiter mit den Jahren und bleibt vorerst stehen,
-- weil die Betreiberseite es noch liest. Sie wird im nächsten Schritt umgestellt.

-- ── Wird eine Datei noch gebraucht? ────────────────────────────────────────
--
-- Die Ablage legt nach Prüfsumme ab, derselbe Inhalt liegt nur einmal da
-- (AD-17). Ob eine Datei nach dem Löschen noch gebraucht wird, lässt sich
-- deshalb nur über ALLE Betreiber beantworten: Unter dem Zeilenschutz sähe die
-- Anwendung nur die eigenen Verweise und hielte die Datei eines anderen
-- Betreibers für verwaist.
--
-- Die Funktion verrät nur ja oder nein zu einer Prüfsumme, die der Aufrufer
-- schon kennt, und keine fremde Zeile.
CREATE OR REPLACE FUNCTION pruefsumme_verwendet(die_pruefsumme text) RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (SELECT 1 FROM attachment WHERE checksum = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM seal WHERE package_hash = die_pruefsumme OR timestamp_hash = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM imported_meeting WHERE package_checksum = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM operator WHERE letterhead_checksum = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM meeting_access WHERE handout_hash = die_pruefsumme);
$$;

REVOKE ALL ON FUNCTION pruefsumme_verwendet(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pruefsumme_verwendet(text) TO versammlung_app;

-- ── Der eine Löschweg ──────────────────────────────────────────────────────
--
-- **Warum als Funktion und nicht als GRANT DELETE.** Dasselbe Muster wie
-- `betriebsdaten_loeschen` (042) und `versammlung_loeschen` (058): Die
-- Anwendungsrolle bleibt ohne Löschrecht, die Funktion prüft Betreiber und
-- Voraussetzungen selbst. Die Anwendung prüft dieselben Dinge vorher, um sie
-- verständlich abzusagen; diese Prüfung hier ist die, auf die es ankommt.
--
-- **Was sie aufhebt, und wie eng.** Fünf Auslöser verbieten das Löschen immer:
-- Siegel, Weisung, Vollmacht, festgehaltene Protokollfassung, Verlauf. Nur für
-- deren Zeilen schaltet die Funktion `session_replication_role` kurz auf
-- `replica`, und nur innerhalb dieser Transaktion. Das schaltet auch die
-- Fremdschlüssel ab; deshalb entfernt sie in diesem Abschnitt jedes Kind
-- ausdrücklich vor seinen Eltern. Danach läuft wieder alles: Die übrigen
-- Auslöser geben frei, sobald das Siegel weg ist, und das letzte
-- `DELETE FROM meeting` geschieht unter vollem Fremdschlüsselschutz. Bleibt eine
-- Zeile zurück, bricht es ab, statt still Waisen zu hinterlassen.
--
-- **Ein gemeinsamer Abend geht nur als Ganzes.** Weisungen und das gemeinsame
-- Protokoll verbinden seine Versammlungen; ein halber Abend wäre ein Protokoll
-- mit Lücken und eine Weisung ohne Beschluss.
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
        RAISE EXCEPTION 'Gelöscht wird nur eine geschlossene oder versiegelte Versammlung.';
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
