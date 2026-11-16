-- Story 4.4: Einstieg über den QR-Code auf dem Beamer (FR-31).
--
-- Für alle, die ihre Karte nicht dabeihaben. Der Code auf der Leinwand ist für
-- alle derselbe und deshalb kein Zugangsmerkmal — er führt nur zu einem
-- Formular.
--
-- **Warum die Person ihren Namen tippt und nicht aus einer Liste wählt:** Eine
-- Auswahlliste zeigte jedem, der die Adresse hat, sämtliche Eigentümer der
-- Gemeinschaft. Die Leinwand steht im Saal, die Adresse ist danach im Verlauf
-- des Browsers — und ein abfotografierter QR-Code wandert weiter. Ein Freitext
-- gibt nichts preis; die Zuordnung zur Partei macht die Sitzungsleitung, die
-- die Person ohnehin ansieht.

ALTER TABLE meeting
	-- Das Merkmal für die Leinwand. Zufällig und je Versammlung eigen, damit ein
	-- alter Aushang nicht in die nächste Versammlung führt.
	ADD COLUMN room_entry_token text;

ALTER TABLE meeting
	ADD CONSTRAINT meeting_saalmerkmal
		CHECK (room_entry_token IS NULL OR room_entry_token ~ '^[A-Za-z0-9_-]{16,64}$');

CREATE UNIQUE INDEX meeting_saalmerkmal_eindeutig
	ON meeting (room_entry_token) WHERE room_entry_token IS NOT NULL;

CREATE TABLE room_entry_request (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,

	-- Was die Person über sich angegeben hat. Eine Behauptung, keine Feststellung
	-- — deshalb heisst die Spalte so.
	claimed_name text NOT NULL,
	note text,

	state text NOT NULL DEFAULT 'offen',
	-- Bei Zuordnung: welche Partei die Sitzungsleitung erkannt hat.
	assigned_snapshot_party_id uuid,

	created_at  timestamptz NOT NULL DEFAULT now(),
	resolved_at timestamptz,
	resolved_by uuid REFERENCES app_user (id),

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	FOREIGN KEY (assigned_snapshot_party_id, operator_id)
		REFERENCES snapshot_party (id, operator_id) ON DELETE CASCADE,

	CONSTRAINT room_request_zustand CHECK (state IN ('offen', 'zugeordnet', 'abgelehnt')),
	CONSTRAINT room_request_name CHECK (length(btrim(claimed_name)) >= 2),
	-- Eine Zuordnung ohne Partei wäre keine.
	CONSTRAINT room_request_zuordnung CHECK (
		state <> 'zugeordnet' OR assigned_snapshot_party_id IS NOT NULL
	),
	CONSTRAINT room_request_abschluss CHECK (
		state = 'offen' OR resolved_at IS NOT NULL
	)
);

CREATE INDEX room_request_meeting_idx ON room_entry_request (meeting_id, state, created_at);

ALTER TABLE room_entry_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_entry_request FORCE ROW LEVEL SECURITY;

CREATE POLICY room_request_mandant ON room_entry_request
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Wer den Saal-QR öffnet, ist nicht angemeldet: derselbe Weg wie beim
-- Zugangscode (Migration 016). Die Funktion gibt nur zurück, was das Formular
-- braucht, und nichts über die Eigentümer.
CREATE FUNCTION saaleinstieg_aufloesen(merkmal text)
RETURNS TABLE (
	operator_id uuid,
	meeting_id uuid,
	meeting_state text,
	meeting_date date,
	start_time time,
	location text,
	stweg_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT m.operator_id, m.id, m.state, m.meeting_date, m.start_time, m.location, s.name
	FROM meeting m
	JOIN stweg s ON s.id = m.stweg_id
	WHERE m.room_entry_token = merkmal
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION saaleinstieg_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION saaleinstieg_aufloesen(text) TO versammlung_app;

-- Das Anlegen der Meldung ebenfalls ohne Mandantenkontext. Die Funktion
-- schreibt ausschliesslich eine offene Meldung und kann nichts bestätigen — die
-- Freigabe bleibt der Sitzungsleitung vorbehalten.
CREATE FUNCTION saaleinstieg_melden(merkmal text, name text, bemerkung text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	v record;
	neu uuid;
BEGIN
	SELECT m.operator_id AS oid, m.id AS mid, m.state AS zustand
	INTO v
	FROM meeting m WHERE m.room_entry_token = merkmal LIMIT 1;

	IF NOT FOUND OR v.zustand <> 'laufend' THEN
		RETURN NULL;
	END IF;

	INSERT INTO room_entry_request (operator_id, meeting_id, claimed_name, note)
	VALUES (v.oid, v.mid, btrim(name), nullif(btrim(coalesce(bemerkung, '')), ''))
	RETURNING id INTO neu;

	RETURN neu;
END;
$$;

REVOKE ALL ON FUNCTION saaleinstieg_melden(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION saaleinstieg_melden(text, text, text) TO versammlung_app;
