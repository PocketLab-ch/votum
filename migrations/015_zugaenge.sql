-- Story 3.7: Persönliche Zugänge (FR-29, NFR-5, AD-14).
--
-- Gespeichert wird nur der Prüfwert, nie der Code. Ein Datenbankauszug — ein
-- Backup auf einem verlorenen Datenträger, ein Prüfbericht mit Beispieldaten —
-- gibt damit keine gültigen Zugänge preis.
--
-- Der Zugang hängt an der **Momentaufnahme**, nicht an der Partei: Er gilt für
-- diese eine Versammlung. Hinge er an `party`, überlebte er die Versammlung, und
-- ein Eigentümerwechsel im Frühling gäbe dem Verkäufer weiter Zutritt.

CREATE TABLE meeting_access (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,
	snapshot_party_id uuid NOT NULL,

	-- SHA-256 des Codes, hexadezimal. Kein Argon2: Der Code hat rund 97 Bit
	-- Zufall, ein Wörterbuchangriff darauf ist sinnlos, und die Prüfung geschieht
	-- beim Check-in von vierzehn Leuten in fünf Minuten — eine absichtlich
	-- langsame Funktion wäre hier die falsche Wahl.
	code_hash text NOT NULL,

	state text NOT NULL DEFAULT 'gueltig',

	created_at   timestamptz NOT NULL DEFAULT now(),
	superseded_at timestamptz,
	last_used_at timestamptz,

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	FOREIGN KEY (snapshot_party_id, operator_id) REFERENCES snapshot_party (id, operator_id)
		ON DELETE CASCADE,

	CONSTRAINT access_zustand CHECK (state IN ('gueltig', 'ersetzt', 'entwertet')),
	CONSTRAINT access_hash CHECK (code_hash ~ '^[0-9a-f]{64}$'),
	-- Ein ersetzter Zugang ohne Zeitpunkt wäre eine Angabe ohne Aussage.
	CONSTRAINT access_ersetzt_zeitpunkt CHECK (state <> 'ersetzt' OR superseded_at IS NOT NULL)
);

-- Je Partei und Versammlung höchstens ein gültiger Zugang. Zwei gültige wären
-- zwei Stimmrechte für dieselbe Person.
CREATE UNIQUE INDEX access_ein_gueltiger
	ON meeting_access (meeting_id, snapshot_party_id)
	WHERE state = 'gueltig';

-- Der Prüfwert ist der Suchschlüssel beim Check-in. Eindeutig über alle
-- Versammlungen: Zwei gleiche Prüfwerte hiessen zwei gleiche Codes, und dann
-- entschiede die Reihenfolge der Zeilen, wer eingelassen wird.
CREATE UNIQUE INDEX access_hash_eindeutig ON meeting_access (code_hash);

CREATE INDEX access_meeting_idx ON meeting_access (meeting_id);

ALTER TABLE meeting_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_access FORCE ROW LEVEL SECURITY;

-- Der Zeilenschutz gilt für die Bewirtschaftungssicht. Die Prüfung beim
-- Check-in läuft über eine Funktion mit SECURITY DEFINER (Welle 1, Epic 4):
-- Wer einen Code vorzeigt, ist noch nicht angemeldet und hat deshalb keinen
-- Mandantenkontext.
CREATE POLICY access_mandant ON meeting_access
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Kein UPDATE ausser auf Zustand und Nutzungszeitpunkt — der Prüfwert steht
-- fest. Ein austauschbarer Prüfwert hiesse, dass jemand einen fremden Zugang
-- auf seinen eigenen Code umschreiben könnte.
CREATE OR REPLACE FUNCTION access_pruefwert_fest() RETURNS trigger AS $$
BEGIN
	IF NEW.code_hash IS DISTINCT FROM OLD.code_hash
	   OR NEW.snapshot_party_id IS DISTINCT FROM OLD.snapshot_party_id
	   OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id THEN
		RAISE EXCEPTION 'Prüfwert und Zuordnung eines Zugangs sind unveränderlich';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER access_pruefwert_fest
	BEFORE UPDATE ON meeting_access
	FOR EACH ROW EXECUTE FUNCTION access_pruefwert_fest();

-- Entzug, nicht Vergabe: Migration 002 vergibt DELETE an jede neue Tabelle. Ein
-- gelöschter Zugang liesse sich später nicht von einem nie erzeugten
-- unterscheiden — und im Streitfall ist genau das die Frage.
REVOKE DELETE ON meeting_access FROM versammlung_app;
