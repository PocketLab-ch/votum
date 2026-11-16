-- 069 — Der Sitzungsbefund sagt, auf welchem Weg jemand hereinkam
--
-- **Der Anlass.** Meldet sich ein Eigentümer an, entsteht ein
-- Anwesenheitsereignis mit dem Kanal `selbst` — fest verdrahtet, weil es bis
-- jetzt nur einen Weg gab, auf dem sich jemand selbst meldet: den Code von der
-- Karte. Mit dem Zugang über Authentik sind es zwei, und im Protokoll und im
-- Abschlusspaket sollen sie sich unterscheiden lassen (Migration 067).
--
-- Die Herkunft steht in `access_session.origin` — nur reicht die Auflösung der
-- Sitzung sie nicht heraus, und die Anwendung müsste dafür eine zweite Abfrage
-- ohne Mandantenkontext bauen. Eine Spalte mehr in der Antwort ist der
-- billigere Weg und macht die Auskunft vollständig: Wer fragt, wer da ist,
-- fragt auch, wie er hereinkam.

DROP FUNCTION zugangssitzung_aufloesen(text);

CREATE FUNCTION zugangssitzung_aufloesen(pruefwert text)
RETURNS TABLE (
	operator_id uuid,
	meeting_id uuid,
	snapshot_party_id uuid,
	party_id uuid,
	access_state text,
	meeting_state text,
	session_expired boolean,
	session_reason text,
	session_origin text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT s.operator_id, a.meeting_id, a.snapshot_party_id, p.party_id, a.state, m.state,
	       (s.expires_at <= now() OR s.revoked_at IS NOT NULL),
	       -- Der eingetragene Grund geht vor: Wurde eine Sitzung abgelöst und
	       -- läuft ihre Frist danach ab, bleibt «ersetzt» die Auskunft, auf die
	       -- es ankommt.
	       coalesce(s.revoked_reason, CASE WHEN s.expires_at <= now() THEN 'abgelaufen' END),
	       s.origin
	FROM access_session s
	JOIN meeting_access a ON a.id = s.meeting_access_id
	JOIN snapshot_party p ON p.id = a.snapshot_party_id
	JOIN meeting m ON m.id = a.meeting_id
	WHERE s.token_hash = pruefwert
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION zugangssitzung_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugangssitzung_aufloesen(text) TO versammlung_app;
