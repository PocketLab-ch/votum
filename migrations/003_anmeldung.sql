-- 003 — Anmeldung trotz Zeilenschutz
--
-- Henne-Ei-Problem: `app_user` unterliegt dem Zeilenschutz nach Betreiber, aber
-- beim Anmelden ist der Betreiber noch unbekannt — er steht ja erst im Datensatz,
-- den man sucht. Die Abfrage liefert deshalb ohne Weiteres nichts zurück, und die
-- Anmeldung scheitert selbst bei richtigen Zugangsdaten.
--
-- Drei Auswege wurden erwogen:
--   1. Anwendung mit BYPASSRLS betreiben — hebt die Trennung überall auf.
--   2. Policy auf app_user lockern — dasselbe, nur unauffälliger.
--   3. Eng umrissene Funktionen mit SECURITY DEFINER — nur diese beiden Abfragen
--      umgehen den Zeilenschutz, und sie geben nichts zurück, was darüber
--      hinausgeht.
--
-- Gewählt wurde der dritte Weg. Beide Funktionen sind absichtlich schmal: Sie
-- nehmen genau ein Merkmal entgegen und liefern genau die Felder, die für die
-- Anmeldung nötig sind. Kein Freitextfilter, keine Liste, keine Suche.

-- Anmeldedaten zu einem Benutzernamen.
CREATE OR REPLACE FUNCTION anmeldedaten(p_username text)
RETURNS TABLE (
    id            uuid,
    operator_id   uuid,
    username      text,
    display_name  text,
    role          text,
    password_hash text,
    disabled_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
-- Fester Suchpfad, damit die Funktion nicht über einen untergeschobenen
-- Namensraum auf andere Tabellen gelenkt werden kann.
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT u.id, u.operator_id, u.username, u.display_name, u.role,
           u.password_hash, u.disabled_at
    FROM app_user u
    WHERE u.username = p_username
    LIMIT 1;
$$;

-- Sitzung zu einem Prüfwert. Dieselbe Ausgangslage: Wer die Sitzung auflösen
-- will, kennt den Betreiber noch nicht.
CREATE OR REPLACE FUNCTION sitzung_aufloesen(p_token_hash text)
RETURNS TABLE (
    id            uuid,
    operator_id   uuid,
    username      text,
    display_name  text,
    role          text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT u.id, u.operator_id, u.username, u.display_name, u.role
    FROM user_session s
    JOIN app_user u ON u.id = s.user_id
    WHERE s.token_hash = p_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.disabled_at IS NULL
    LIMIT 1;
$$;

-- Nur die Anwendung darf sie aufrufen, und sonst niemand.
REVOKE ALL ON FUNCTION anmeldedaten(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION sitzung_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anmeldedaten(text) TO versammlung_app;
GRANT EXECUTE ON FUNCTION sitzung_aufloesen(text) TO versammlung_app;

-- Sitzungen gehören ebenfalls unter den Zeilenschutz. Das Anlegen einer Sitzung
-- geschieht nach erfolgreicher Anmeldung, dann ist der Betreiber bekannt; das
-- Auflösen läuft über die Funktion oben.
ALTER TABLE user_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_session FORCE  ROW LEVEL SECURITY;

CREATE POLICY user_session_mandant ON user_session
    USING (EXISTS (
        SELECT 1 FROM app_user u
        WHERE u.id = user_session.user_id
          AND u.operator_id::text = current_setting('versammlung.operator_id', true)
    ));
