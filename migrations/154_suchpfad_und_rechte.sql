-- Suchpfad der Löschfunktionen, Verlauf ohne Betreiber, Rechte nach Absicht.
--
-- Sechs Befunde aus dem Sicherheitsdurchgang vom 09.10.2026
-- (`docs/befunde-sicherheitsdurchgang-2026-10-09.md`): D1, D2, D3, D8, D9, D11.
-- Dazu dieselbe Klasse wie D3 und D11 an fünf weiteren Tabellen, gemessen am
-- 13.10.2026 auf Dev.
--
-- Die alten Dateien bleiben unverändert: Ihre Prüfsumme steht in
-- `schema_migration`, und eingespielte Migrationen werden nicht angefasst.

-- ── D1 und D8: versammlung_loeschen ─────────────────────────────────────────
--
-- **D1, der Suchpfad.** Migration 058 legte die Funktion als SECURITY DEFINER
-- an, aber ohne `SET search_path`. Ohne Pin löst sie ihre Tabellennamen über
-- den Suchpfad der aufrufenden Sitzung auf, und dort steht `pg_temp` vor
-- `public`. Die Anwendungsrolle darf temporäre Tabellen anlegen; eine
-- temporäre `meeting` mit einer passenden Zeile füttert die Betreiberprüfung,
-- während die Löschungen danach die echten Tabellen treffen. Gemessen am
-- 09.10.2026: Die Traktanden eines fremden Betreibers waren weg. Mit `pg_temp`
-- am Ende des Pfads gewinnt die echte Tabelle (`tests/db/suchpfad.test.ts`).
--
-- **D8, die versiegelte Nachfolgerin.** Das Lösen der Herkunftsangabe traf
-- auch Traktanden einer späteren, schon versiegelten Versammlung, und deren
-- Auslöser (`agenda_item_nach_siegel`) wies die Änderung ab: Eine alte
-- Versammlung im Entwurf liess sich dann nie mehr löschen, mit einer rohen
-- Ausnahme statt eines Satzes. Behandelt wie in Migration 113: Die Angabe
-- steht nicht im Siegel und sagt ohne Ziel nichts mehr; nur für diese eine
-- Anweisung läuft die Sitzung unter `replica`, danach sofort wieder unter
-- `origin`. Unter `replica` fallen alle gewöhnlichen Auslöser auf
-- `agenda_item` aus, nicht nur das Siegel: auch die Abgabesperre (117) und
-- `updated_at`, dazu die Fremdschlüssel, die eine Spalte auf NULL nicht
-- braucht. Wie in 113 nimmt das in Kauf, dass eine gerade abgegebene
-- Nachfolgerin ihre Herkunftsangabe verliert; das Vorbereitungspaket leert sie
-- auf dem Gerät ohnehin (`server/vorbereitungspaket.ts`).
--
-- Der Körper ist sonst derselbe wie in 058.
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

-- ── D2: betriebsdaten_loeschen ──────────────────────────────────────────────
--
-- Dieselbe Bauart wie D1 (Migration 042). Neben dem Pin trägt jede Löschung
-- jetzt auch den Betreiber: Die Prüfung oben ist die erste Schranke, der
-- Filter in den Löschungen die zweite. Fällt eine davon durch eine spätere
-- Fassung, trifft die Funktion trotzdem nur den eigenen Betreiber. Alle drei
-- Tabellen tragen `operator_id` (Migrationen 015, 017, 018).
CREATE OR REPLACE FUNCTION betriebsdaten_loeschen(der_betreiber uuid, die_versammlung uuid)
RETURNS TABLE (zugaenge integer, sitzungen integer, saalmeldungen integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    zustand text;
    z integer;
    s integer;
    r integer;
BEGIN
    SELECT m.state INTO zustand
      FROM meeting m
     WHERE m.id = die_versammlung AND m.operator_id = der_betreiber;

    IF zustand IS NULL THEN
        RAISE EXCEPTION 'Diese Versammlung gibt es nicht.';
    END IF;
    IF zustand NOT IN ('geschlossen', 'versiegelt') THEN
        RAISE EXCEPTION
            'Diese Versammlung ist noch nicht geschlossen. Solange sie läuft, werden die Zugänge gebraucht.';
    END IF;

    WITH weg AS (
        DELETE FROM access_session z
         USING meeting_access a
         WHERE a.id = z.meeting_access_id AND a.meeting_id = die_versammlung
           AND z.operator_id = der_betreiber AND a.operator_id = der_betreiber
        RETURNING z.id
    ) SELECT count(*)::int INTO s FROM weg;

    WITH weg AS (
        DELETE FROM meeting_access
         WHERE meeting_id = die_versammlung AND operator_id = der_betreiber
        RETURNING id
    ) SELECT count(*)::int INTO z FROM weg;

    WITH weg AS (
        DELETE FROM room_entry_request
         WHERE meeting_id = die_versammlung AND operator_id = der_betreiber
        RETURNING id
    ) SELECT count(*)::int INTO r FROM weg;

    RETURN QUERY SELECT z, s, r;
END;
$$;

-- ── D9: Verlaufseinträge ohne Betreiber liest niemand mehr mit ──────────────
--
-- Die Regel aus Migration 001 liess `operator_id IS NULL` für alle zu, zum
-- Lesen wie zum Schreiben. Ohne Betreiber schreibt heute genau ein Weg: die
-- fehlgeschlagene Anmeldung mit einem Namen, den es nicht gibt
-- (`server/auth.ts`). Damit las jede Sitzungsleitung mit, welche Namen bei
-- fremden Betreibern durchprobiert wurden.
--
-- Einen Betreiber des Versuchs gibt es nicht: Die Anmeldung ist für alle
-- dieselbe, und ein unbekannter Name gehört zu niemandem. Deshalb getrennt:
-- Anfügen darf die Anwendung solche Zeilen weiterhin, sonst scheiterte die
-- Anmeldung am Vermerk. Lesen darf sie nur noch die eigenen. Die Zeilen ohne
-- Betreiber bleiben für den Betrieb über die privilegierte Rolle lesbar.
--
-- Ändern und Löschen braucht keine Regel: Migration 002 entzieht beides, und
-- ohne passende Regel lässt der Zeilenschutz ohnehin keine Zeile durch.
DROP POLICY audit_entry_mandant ON audit_entry;

CREATE POLICY audit_entry_lesen ON audit_entry
    FOR SELECT
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY audit_entry_anfuegen ON audit_entry
    FOR INSERT
    WITH CHECK (operator_id::text = current_setting('versammlung.operator_id', true)
                OR operator_id IS NULL);

-- ── D3, D11 und ihre Klasse: Rechte nach dem, was gewährt wurde ─────────────
--
-- Migration 002 vergibt über `ALTER DEFAULT PRIVILEGES` alle vier Rechte an
-- jede künftige Tabelle. Ein späteres `GRANT SELECT, INSERT` nimmt davon
-- nichts weg; wegnehmen tut allein ein REVOKE (so schon Migration 055). Die
-- Absicht stand in diesen Migrationen jeweils als GRANT da, die Wirkung nicht.
--
-- Gemessen am 13.10.2026 auf Dev, je Tabelle das Recht, das die Anwendung hat,
-- obwohl ihre Migration es nicht gewährt. Kein Codepfad unter `src/` braucht
-- eines davon; die Löschwege nach Frist und Genehmigung (113, 115, 137) laufen
-- mit den Rechten ihres Eigentümers.

-- D3 (Migration 080): Ein Befund zur Beschlussfähigkeit wird nicht berichtigt,
-- sondern durch einen neuen abgelöst.
REVOKE UPDATE, DELETE ON quorum_finding FROM versammlung_app;

-- D11 (Migration 116): Genau eine Identität je Anwendung. Der eindeutige Index
-- schützt nur gegen eine zweite, nicht gegen Ersetzen oder Entfernen.
REVOKE UPDATE, DELETE ON device_identity FROM versammlung_app;

-- Migration 061: Ein eingespieltes Abschlusspaket bleibt, wie es kam.
REVOKE UPDATE, DELETE ON imported_meeting FROM versammlung_app;

-- Migration 036: Eine Vollmacht wird beendet, nicht gelöscht; der
-- Auslöser weist das Löschen ab, das Recht dazu stand trotzdem offen.
REVOKE DELETE ON proxy FROM versammlung_app;

-- Migration 117: Der Leihschein einer abgegebenen Versammlung.
REVOKE DELETE ON meeting_handover FROM versammlung_app;

-- Migration 116: Registrierte Saalgeräte werden geändert (zuletzt benutzt,
-- widerrufen), nicht gelöscht.
REVOKE DELETE ON handover_device FROM versammlung_app;

-- Migration 062: Ein Ausstand wird erklärt oder zurückgenommen (DELETE),
-- nicht umgeschrieben.
REVOKE UPDATE ON recusal FROM versammlung_app;

-- Und umgekehrt: `minutes` gewährte in Migration 037 kein DELETE, das Recht
-- kam aus den Vorgaben, und `server/protokoll.ts` braucht es (ein Protokoll
-- neu erzeugen, nachdem die bisherige Fassung festgehalten ist). Hier
-- ausdrücklich, damit die Absicht im GRANT steht wie die Wirkung.
GRANT DELETE ON minutes TO versammlung_app;
