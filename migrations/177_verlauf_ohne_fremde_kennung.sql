-- 177 — Kein Verlaufseintrag eines Betreibers nennt eine Kennung eines anderen
--
-- **Der Anlass** ist die Klasse K2 aus dem Sicherheitsdurchgang vom 09.10.2026:
-- Ein Schreibweg nimmt eine Kennung aus Pfad oder Formular, seine Abfragen
-- treffen unter dem Zeilenschutz nichts, und der Verlauf hält trotzdem fest,
-- was nicht geschehen ist, mit der Kennung von B im Verlauf von A. Der Verlauf
-- ist nur anfügbar (Migration 001); ein solcher Eintrag bleibt für immer.
-- Gefunden wurde das je Weg und je Lauf neu: viermal als Gegenstand
-- (27.10.2026), dann bei `umordnen` in den Angaben (`traktandum`, Auftrag 2d),
-- wo ein statischer Wächter wegen seiner `bindung:`-Ausnahme nichts sah. Die
-- Prüfungen im Code bleiben (`docs/pendenzen-sicherheit.md`, «Wächter über die
-- Klasse K2»); dieser Auslöser ersetzt sie nicht, er macht ihr Fehlen
-- unschädlich, für alle Aufrufstellen und die künftigen.
--
-- **Was er prüft.** Vor jedem Einfügen mit Betreiber: die UUIDs in
-- `subject_id` und in `detail`, gesucht im Text beider (Werte, Schlüssel,
-- verschachtelt, eingebettet), gegen die Tabellen mit `id` (uuid) und
-- `operator_id`. Gehört eine davon einem anderen Betreiber, bricht das
-- Einfügen mit `VO177` ab, und mit ihm die ganze Transaktion: Die Änderung,
-- die der Eintrag belegen sollte, verschwindet mit (`audit.ts`, «in derselben
-- Transaktion»). Durch gehen:
--
-- - ein Eintrag ohne Betreiber (Systemvorgänge, fehlgeschlagene Anmeldung mit
--   unbekanntem Namen), weil es keinen «anderen» gibt;
-- - eine Kennung, die nirgends mehr steht, etwa nach `agenda.item.removed`:
--   Der Eintrag über das Löschen schreibt die Kennung der eben gelöschten
--   Zeile, und das ist richtig;
-- - eine Kennung des eigenen Betreibers.
--
-- **Die Liste steht fest in der Funktion, nicht aus dem Katalog** (gemessen auf
-- Dev, 28.10.2026, über die letzten 5000 Einträge mit Betreiber): fest 0,4 bis
-- 0,6 ms je Eintrag, aus dem Katalog mit `EXECUTE` rund 2 ms, weil
-- PL/pgSQL nur die feste Abfrage je Sitzung einmal plant. Bei der Übernahme
-- aus Datei schreibt ein Eigentumswechsel je Einheit einen Eintrag in derselben
-- Transaktion, und dort zählt das Vierfache. Der Preis der festen Liste ist
-- eine neue Tabelle, die hier fehlt; dagegen steht `tests/db/waechter-k2.test.ts`,
-- «die Liste deckt den Katalog», gegen `information_schema` der
-- Prüfdatenbank. Wer eine Tabelle mit `id` und `operator_id` anlegt, nimmt sie
-- in einer neuen Fassung dieser Funktion auf.
--
-- **SECURITY DEFINER, damit er am Zeilenschutz vorbei sieht.** Unter der
-- Anwendungsrolle fände die Suche nur die eigenen Zeilen und nie eine fremde.
-- Unter `FORCE ROW LEVEL SECURITY` sieht sie fremde Zeilen nur, wenn ihr
-- Eigentümer, die migrierende Rolle, Superuser ist oder `BYPASSRLS` hat (auf
-- Dev `versammlung`, Superuser, 28.10.2026 gemessen; geprüft im `DO`-Block
-- unten). Der Suchpfad ist gepinnt wie überall
-- (`scripts/check-suchpfad.mjs`). Aufrufen lässt sich eine Auslöserfunktion
-- nur als Auslöser; was sie preisgibt, ist allein «abgewiesen oder nicht», und
-- das nur dem, der schon unter einem Betreiber schreiben darf.
--
-- **Ein eigener Fehlercode, `VO177`**, aus demselben Grund wie `VO117`
-- (Migration 117): `alsBetreiber` übersetzt ihn in einen festen Satz
-- (`src/lib/server/db.ts`), ohne am Wortlaut dieser Meldung zu hängen. Die
-- Meldung selbst nennt Art, Kennung und Tabelle und geht nur ins Protokoll.
--
-- **Was er nicht sieht**: einen Verlauf ohne Wirkung mit eigener Kennung,
-- einen Erfolg ohne Wirkung ganz ohne Verlauf, Kennungen von Tabellen ohne
-- `operator_id` (darunter `operator` selbst), Gegenstände von B in anderer Form
-- als einer UUID (Titel, Namen) und Kennungen von Zeilen, die B schon gelöscht
-- hat. Einträge, die schon stehen, prüft er nicht: Auf Dev nannte am 28.10.2026
-- keiner von rund 193 000 eine Kennung eines anderen Betreibers.

-- **Abbruch statt eines stillen Wächters** (Sicherheitsprüfung 28.10.2026).
-- Ohne Superuser oder `BYPASSRLS` sähe die Funktion unter `FORCE ROW LEVEL
-- SECURITY` nur Zeilen ohne passenden Betreiber, also keine, und wiese nie
-- etwas ab. Auf Prod ist die Rolle aus der Sitzung nicht gemessen; scheitert
-- die Migration hier, ist das zu klären, nicht zu umgehen.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles
                    WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
        RAISE EXCEPTION 'Migration 177: Die Rolle % umgeht den Zeilenschutz nicht; der Wächter über den Verlauf sähe keine fremde Zeile.', current_user;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION verlauf_ohne_fremde_kennung() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    kennungen uuid[];
    fund record;
BEGIN
    IF NEW.operator_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT array_agg(DISTINCT m[1]::uuid) INTO kennungen
      FROM regexp_matches(
               coalesce(NEW.subject_id, '') || ' ' || coalesce(NEW.detail::text, ''),
               '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
               'g') AS m;
    IF kennungen IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT x.tabelle, x.id INTO fund
      FROM (
        SELECT 'access_session'            AS tabelle, id FROM access_session             WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'agenda_item'               AS tabelle, id FROM agenda_item                WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'agenda_template_order'     AS tabelle, id FROM agenda_template_order      WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'ai_stage'                  AS tabelle, id FROM ai_stage                   WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'ai_usage'                  AS tabelle, id FROM ai_usage                   WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'app_user'                  AS tabelle, id FROM app_user                   WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'attachment'                AS tabelle, id FROM attachment                 WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'attendance_event'          AS tabelle, id FROM attendance_event           WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'business'                  AS tabelle, id FROM business                   WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'bylaw_attendance_rule'     AS tabelle, id FROM bylaw_attendance_rule      WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'bylaw_instruction_rule'    AS tabelle, id FROM bylaw_instruction_rule     WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'bylaw_quorum_rule'         AS tabelle, id FROM bylaw_quorum_rule          WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'handover_device'           AS tabelle, id FROM handover_device            WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'imported_meeting'          AS tabelle, id FROM imported_meeting           WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'instruction'               AS tabelle, id FROM instruction                WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'meeting'                   AS tabelle, id FROM meeting                    WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'meeting_access'            AS tabelle, id FROM meeting_access             WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'meeting_chair_holder'      AS tabelle, id FROM meeting_chair_holder       WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'meeting_day'               AS tabelle, id FROM meeting_day                WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'meeting_handover'          AS tabelle, id FROM meeting_handover           WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'meeting_pause'             AS tabelle, id FROM meeting_pause              WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'minutes'                   AS tabelle, id FROM minutes                    WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'minutes_version'           AS tabelle, id FROM minutes_version            WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'objection'                 AS tabelle, id FROM objection                  WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'paper_ballot'              AS tabelle, id FROM paper_ballot               WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'paper_question_answered'   AS tabelle, id FROM paper_question_answered    WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'party'                     AS tabelle, id FROM party                      WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'party_member'              AS tabelle, id FROM party_member               WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'pendenz'                   AS tabelle, id FROM pendenz                    WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'person'                    AS tabelle, id FROM person                     WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'proxy'                     AS tabelle, id FROM proxy                      WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'proxy_recommendation'      AS tabelle, id FROM proxy_recommendation       WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'quorum_finding'            AS tabelle, id FROM quorum_finding             WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'quota_kind'                AS tabelle, id FROM quota_kind                 WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'recusal'                   AS tabelle, id FROM recusal                    WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'representation'            AS tabelle, id FROM representation             WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'room_entry_request'        AS tabelle, id FROM room_entry_request         WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'seal'                      AS tabelle, id FROM seal                       WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'snapshot_party'            AS tabelle, id FROM snapshot_party             WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'snapshot_unit'             AS tabelle, id FROM snapshot_unit              WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'stweg'                     AS tabelle, id FROM stweg                      WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'unit'                      AS tabelle, id FROM unit                       WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'unit_ownership'            AS tabelle, id FROM unit_ownership             WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'usufruct'                  AS tabelle, id FROM usufruct                   WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'veto'                      AS tabelle, id FROM veto                       WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'vote'                      AS tabelle, id FROM vote                       WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
        UNION ALL
        SELECT 'voting_round'              AS tabelle, id FROM voting_round               WHERE id = ANY (kennungen) AND operator_id <> NEW.operator_id
      ) AS x
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Verlaufseintrag «%» nennt % aus «%», die einem anderen Betreiber gehört.',
            NEW.event_type, fund.id, fund.tabelle
            USING ERRCODE = 'VO177';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER audit_entry_ohne_fremde_kennung
    BEFORE INSERT ON audit_entry
    FOR EACH ROW EXECUTE FUNCTION verlauf_ohne_fremde_kennung();
