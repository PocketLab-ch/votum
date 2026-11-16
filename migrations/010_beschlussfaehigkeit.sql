-- Story 2.6: Abweichende Beschlussfähigkeit im Reglement (FR-18).
--
-- ZGB Art. 712p setzt die Untergrenze. Das Reglement darf sie **erschweren**,
-- nicht erleichtern — Minderheitenschutz: Ein tieferes Anwesenheitsquorum liesse
-- eine kleine Gruppe für alle entscheiden. Die Prüfung darauf steht im Kern und
-- läuft beim Hinterlegen; hier liegen nur die Schranken, die auch dann greifen,
-- wenn jemand am Kern vorbei schreibt.
--
-- Additiv und vorwärtsgerichtet (AD-14).

CREATE TABLE bylaw_attendance_rule (
	id          uuid PRIMARY KEY,
	operator_id uuid NOT NULL REFERENCES operator (id),
	stweg_id    uuid NOT NULL,

	-- Erste und zweite Versammlung haben verschiedene gesetzliche Schwellen und
	-- deshalb je eine eigene Regel.
	meeting_kind text NOT NULL,

	head_numerator   integer NOT NULL,
	head_denominator integer NOT NULL,

	quota_numerator   integer,
	quota_denominator integer,

	-- Die Untergrenze «mindestens aber zwei» aus ZGB Art. 712p Abs. 1 und 3.
	min_heads integer NOT NULL DEFAULT 2,

	source_reference text NOT NULL,

	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),

	FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),

	CONSTRAINT bylaw_attendance_art CHECK (meeting_kind IN ('erste', 'zweite')),
	CONSTRAINT bylaw_attendance_kopf_bruch CHECK (
		head_numerator >= 1
		AND head_denominator BETWEEN 2 AND 100
		AND head_numerator <= head_denominator
	),
	CONSTRAINT bylaw_attendance_quoten_bruch CHECK (
		(quota_numerator IS NULL AND quota_denominator IS NULL)
		OR (quota_numerator >= 1 AND quota_denominator BETWEEN 2 AND 100 AND quota_numerator <= quota_denominator)
	),
	-- Die gesetzliche Untergrenze darf nicht unterschritten werden. Als Schranke
	-- der Datenbank, weil sie unabhängig von der Regelfassung gilt.
	CONSTRAINT bylaw_attendance_untergrenze CHECK (min_heads >= 2),
	CONSTRAINT bylaw_attendance_fundstelle CHECK (length(btrim(source_reference)) >= 3)
);

CREATE UNIQUE INDEX bylaw_attendance_je_art ON bylaw_attendance_rule (stweg_id, meeting_kind);

ALTER TABLE bylaw_attendance_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bylaw_attendance_rule FORCE ROW LEVEL SECURITY;

CREATE POLICY bylaw_attendance_mandant ON bylaw_attendance_rule
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON bylaw_attendance_rule TO versammlung_app;

CREATE TRIGGER bylaw_attendance_updated_at
	BEFORE UPDATE ON bylaw_attendance_rule
	FOR EACH ROW EXECUTE FUNCTION setze_updated_at();
