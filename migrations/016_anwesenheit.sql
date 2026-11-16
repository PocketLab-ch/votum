-- Epic 4: Anwesenheit als Ereignisfolge und der Prüfweg für Zugangscodes
-- (FR-30 bis FR-33, AD-5, AD-16).
--
-- Kein überschreibbares Kennzeichen «anwesend ja/nein»: Es beantwortet die
-- Frage nicht, auf die es ankommt — wer war *im Moment des Schliessens jener
-- Abstimmung* im Saal. Wer um 20:15 geht, war um 20:00 anwesend, und das
-- Ergebnis von 20:00 darf sich um 20:15 nicht ändern.

CREATE TABLE attendance_event (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,

	-- Der Fremdschlüssel zeigt auf die Momentaufnahme, nicht auf `party`: Wird
	-- die Freigabe zurückgenommen, verschwindet die Momentaufnahme, und die
	-- Anwesenheitsereignisse gehen mit. Ein Ereignis zu einem
	-- Stimmberechtigtenstand, den es nicht mehr gibt, wäre eine Anwesenheit ohne
	-- Grundlage.
	snapshot_party_id uuid NOT NULL,

	kind text NOT NULL,
	channel text NOT NULL,

	occurred_at timestamptz NOT NULL DEFAULT now(),
	-- Woher der Zeitstempel stammt. Im lokalen Betrieb ohne Netz kann die Uhr
	-- des Notebooks falsch gehen; ohne diesen Vermerk sähe eine um Stunden
	-- verschobene Anwesenheitsliste später wie eine Manipulation aus (AD-12).
	clock_source text NOT NULL DEFAULT 'system',

	recorded_by uuid REFERENCES app_user (id),
	recorded_by_label text,
	note text,

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	FOREIGN KEY (snapshot_party_id, operator_id) REFERENCES snapshot_party (id, operator_id)
		ON DELETE CASCADE,

	CONSTRAINT attendance_art CHECK (
		kind IN ('angemeldet', 'eingetroffen', 'verlassen', 'abgelehnt')
	),
	CONSTRAINT attendance_weg CHECK (
		channel IN ('gescannt', 'selbst', 'von_hand', 'liste')
	),
	-- Wer von Hand oder ab Liste erfasst, ist die Sitzungsleitung — dann muss
	-- feststehen, wer. Eine Erfassung ohne Erfasser wäre im Protokoll wertlos.
	CONSTRAINT attendance_erfasser CHECK (
		channel = 'selbst' OR length(btrim(coalesce(recorded_by_label, ''))) >= 2
	)
);

CREATE INDEX attendance_meeting_idx ON attendance_event (meeting_id, occurred_at);
CREATE INDEX attendance_party_idx ON attendance_event (snapshot_party_id, occurred_at);

ALTER TABLE attendance_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_event FORCE ROW LEVEL SECURITY;

CREATE POLICY attendance_mandant ON attendance_event
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Nur anfügen (AD-5). Eine Korrektur ist ein weiteres Ereignis, nie eine
-- Änderung am bisherigen — sonst liesse sich nachträglich behaupten, jemand sei
-- bei einer Abstimmung anwesend gewesen, bei der er es nicht war.
CREATE TRIGGER attendance_kein_update
	BEFORE UPDATE ON attendance_event
	FOR EACH ROW EXECUTE FUNCTION verhindere_aenderung();

-- Entzug, nicht Vergabe: Migration 002 vergibt beides über
-- ALTER DEFAULT PRIVILEGES an jede neue Tabelle.
REVOKE UPDATE, DELETE ON attendance_event FROM versammlung_app;

-- ── Der Prüfweg für Zugangscodes ────────────────────────────────────────────
--
-- Wer eine Karte vorzeigt, ist **nicht angemeldet** und hat deshalb keinen
-- Mandantenkontext. Der Zeilenschutz auf `meeting_access` liesse jede Abfrage
-- leer ausgehen. Dieselbe Henne-Ei-Falle wie bei der Anmeldung (Migration 003),
-- und dieselbe Lösung: eine Funktion mit SECURITY DEFINER, festem `search_path`
-- und Ausführungsrecht nur für die Anwendungsrolle.
--
-- Die Funktion gibt **nur** zurück, was die Zugangsseite braucht. Insbesondere
-- gibt sie bei einem unbekannten Code dasselbe zurück wie bei einem entwerteten
-- — nämlich nichts —, damit sich von aussen nicht feststellen lässt, ob ein
-- Code je gültig war.
CREATE FUNCTION zugang_aufloesen(pruefwert text)
RETURNS TABLE (
	operator_id uuid,
	meeting_id uuid,
	snapshot_party_id uuid,
	party_id uuid,
	access_state text,
	meeting_state text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT a.operator_id, a.meeting_id, a.snapshot_party_id, p.party_id, a.state, m.state
	FROM meeting_access a
	JOIN snapshot_party p ON p.id = a.snapshot_party_id
	JOIN meeting m ON m.id = a.meeting_id
	WHERE a.code_hash = pruefwert
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION zugang_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugang_aufloesen(text) TO versammlung_app;

-- Der Nutzungszeitpunkt wird beim Öffnen fortgeschrieben. Auch das geht ohne
-- Mandantenkontext und darf nichts anderes ändern als diese eine Spalte.
CREATE FUNCTION zugang_benutzt(pruefwert text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	UPDATE meeting_access SET last_used_at = now()
	WHERE code_hash = pruefwert AND state = 'gueltig'
$$;

REVOKE ALL ON FUNCTION zugang_benutzt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugang_benutzt(text) TO versammlung_app;
