-- Epic 5: Abstimmungsdurchgänge, Stimmen und der Anzeigecode.
--
-- **Der Durchgang ist die Einheit, nicht das Traktandum.** Zu einem Traktandum
-- kann mehrmals abgestimmt werden — nach einem Verfahrensfehler, nach einer
-- Wortmeldung, nach einer Klärung. Jeder Durchgang bleibt stehen, der frühere
-- wird als überholt gekennzeichnet und nie gelöscht (AD-5, Story 5.10). Hinge
-- das Ergebnis am Traktandum, müsste eine Neuabstimmung das alte überschreiben,
-- und die Frage «was stand vorher?» wäre nicht mehr zu beantworten.
--
-- **Was der Durchgang einfriert.** Zwei Dinge, beide beim Schliessen:
--
--   `requirement_json`  — das Mehrheitserfordernis, wie es im Augenblick der
--                          Freigabe galt (AD-4). Ohne dieses Einfrieren rechnete
--                          eine spätere Änderung am Traktandum das Ergebnis des
--                          ersten Durchgangs neu.
--   `attendance_json`   — der Anwesenheitsstand beim Schliessen (AD-16). Ohne
--                          ihn änderte sich die Bezugsgrösse, sobald nach der
--                          Abstimmung jemand den Saal verlässt.
--
-- **Was er nicht einfriert: das Ergebnis.** Die Auszählung ist eine reine
-- Funktion mit einer Wertetabelle als Netz; sie wird aus den eingefrorenen
-- Eingaben jederzeit neu gerechnet. Ein zusätzlich gespeichertes Ergebnis wäre
-- eine zweite Wahrheit, und bei einer Abweichung wüsste niemand, welche gilt.
-- Beim Versiegeln in Welle 2 wandert die gerechnete Fassung ins Abschlusspaket.

-- ── Der Anzeigecode für die Präsentationssicht ──────────────────────────────
--
-- Die Sicht auf der Leinwand läuft auf einem zweiten Gerät und hat deshalb eine
-- eigene Adresse. Ohne Schutz läse sie jeder, der die Adresse errät — eine
-- Eigentümerversammlung ist nicht öffentlich. Wie überall hier nur der
-- Prüfwert: Ein Datenbankauszug gibt keinen gültigen Code preis (NFR-5).
ALTER TABLE meeting
	ADD COLUMN display_code_hash text,
	ADD COLUMN display_code_set_at timestamptz;

ALTER TABLE meeting
	ADD CONSTRAINT meeting_anzeigecode_hash
		CHECK (display_code_hash IS NULL OR display_code_hash ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX meeting_anzeigecode_eindeutig
	ON meeting (display_code_hash) WHERE display_code_hash IS NOT NULL;

-- Ziel des zusammengesetzten Fremdschlüssels der Stimme. `snapshot_party` trägt
-- die Eindeutigkeit seit Migration 013, `snapshot_unit` nicht — sie wird hier
-- nachgezogen, damit eine Stimme mandantensicher an ihrer Einheit hängt.
ALTER TABLE snapshot_unit ADD CONSTRAINT snapshot_unit_id_operator UNIQUE (id, operator_id);

-- ── Der Abstimmungsdurchgang ────────────────────────────────────────────────

CREATE TABLE voting_round (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,
	agenda_item_id uuid NOT NULL,

	-- Zählt je Traktandum ab 1. Steht im Protokoll: «zweiter Durchgang».
	ordinal integer NOT NULL,

	state text NOT NULL DEFAULT 'offen',

	opened_at  timestamptz NOT NULL DEFAULT now(),
	opened_by  uuid REFERENCES app_user (id),
	closed_at  timestamptz,
	closed_by  uuid REFERENCES app_user (id),

	-- Überholt durch einen späteren Durchgang. Nicht gelöscht: Die Frage «was
	-- stand vorher?» muss beantwortbar bleiben.
	superseded_at timestamptz,
	supersede_reason text,

	-- Die Verkündung liegt bei der Sitzungsleitung (Story 5.9, FR-40): Das
	-- Ergebnis steht nach dem Schliessen fest, erscheint auf Leinwand und
	-- Telefonen aber erst mit der Freigabe. Ein eigener Zeitpunkt und nicht ein
	-- Kennzeichen, weil im Protokoll steht, wann verkündet wurde.
	result_published_at timestamptz,
	result_published_by uuid REFERENCES app_user (id),

	requirement_json jsonb,
	attendance_json  jsonb,

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	FOREIGN KEY (agenda_item_id, operator_id) REFERENCES agenda_item (id, operator_id)
		ON DELETE CASCADE,
	UNIQUE (id, operator_id),
	UNIQUE (agenda_item_id, ordinal),

	CONSTRAINT voting_round_zustand CHECK (state IN ('offen', 'geschlossen')),
	CONSTRAINT voting_round_ordinal CHECK (ordinal >= 1),
	-- Ein geschlossener Durchgang ohne Zeitpunkt wäre eine halbe Angabe.
	CONSTRAINT voting_round_schluss
		CHECK ((state = 'geschlossen') = (closed_at IS NOT NULL)),
	-- Beides wird beim Schliessen festgeschrieben. Fehlte eines, liesse sich das
	-- Ergebnis nicht mehr nachrechnen.
	CONSTRAINT voting_round_eingefroren
		CHECK (state <> 'geschlossen' OR (requirement_json IS NOT NULL AND attendance_json IS NOT NULL)),
	-- Eine Neuabstimmung verlangt eine Begründung (Story 5.10).
	CONSTRAINT voting_round_ueberholt
		CHECK ((superseded_at IS NULL) = (supersede_reason IS NULL)),
	-- Verkündet wird, was feststeht. Eine Freigabe vor dem Schliessen gäbe den
	-- Zwischenstand preis und beeinflusste die noch Unentschlossenen.
	CONSTRAINT voting_round_verkuendung
		CHECK (result_published_at IS NULL OR state = 'geschlossen')
);

CREATE INDEX voting_round_traktandum_idx ON voting_round (agenda_item_id, ordinal);
CREATE INDEX voting_round_versammlung_idx ON voting_round (meeting_id);

-- Immer nur **eine** offene Abstimmung je Versammlung. Als Bedingung der
-- Datenbank und nicht bloss als Prüfung im Code: Zwei gleichzeitig offene
-- Fragen auf den Telefonen wären im Saal nicht mehr zu klären.
CREATE UNIQUE INDEX voting_round_eine_offene
	ON voting_round (meeting_id) WHERE state = 'offen';

ALTER TABLE voting_round ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_round FORCE ROW LEVEL SECURITY;
CREATE POLICY voting_round_mandant ON voting_round
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Ein Durchgang wird geschlossen und überholt, nie gelöscht (AD-5).
REVOKE DELETE ON voting_round FROM versammlung_app;

-- ── Die Stimme ──────────────────────────────────────────────────────────────
--
-- Anfügend, nie ändernd (AD-5). Eine Berichtigung erzeugt eine neue Zeile; für
-- das Ergebnis zählt die letzte je Einheit. Wer die alte überschriebe, könnte
-- später nicht mehr zeigen, dass berichtigt wurde — und genau das ist die
-- Frage, wenn ein Beschluss angefochten wird.

CREATE TABLE vote (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	round_id    uuid NOT NULL,

	-- Auf die Momentaufnahme, nicht auf die lebenden Stammdaten (AD-3).
	snapshot_party_id uuid NOT NULL,
	snapshot_unit_id  uuid NOT NULL,

	choice text NOT NULL,
	cast_at timestamptz NOT NULL DEFAULT now(),

	-- Wahr, wenn die Sitzungsleitung erfasst hat und nicht die Person selbst.
	-- Steht im Protokoll: In der Betriebsart «einfach» trägt jede Stimme diesen
	-- Vermerk, und das ist keine Nebensache, sondern der Unterschied zwischen
	-- «hat gestimmt» und «wurde so erfasst».
	recorded_by_chair boolean NOT NULL DEFAULT false,
	recorded_by uuid REFERENCES app_user (id),

	FOREIGN KEY (round_id, operator_id) REFERENCES voting_round (id, operator_id) ON DELETE CASCADE,
	FOREIGN KEY (snapshot_party_id, operator_id) REFERENCES snapshot_party (id, operator_id),
	FOREIGN KEY (snapshot_unit_id, operator_id) REFERENCES snapshot_unit (id, operator_id),

	CONSTRAINT vote_wahl CHECK (choice IN ('yes', 'no', 'abstain')),
	-- Von Hand erfasst heisst: von jemandem. Ohne Namen wäre der Vermerk wertlos.
	CONSTRAINT vote_erfasser CHECK (NOT recorded_by_chair OR recorded_by IS NOT NULL)
);

CREATE INDEX vote_durchgang_idx ON vote (round_id, snapshot_unit_id, cast_at);

ALTER TABLE vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote FORCE ROW LEVEL SECURITY;
CREATE POLICY vote_mandant ON vote
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Weder ändern noch löschen. Die Zeile ist der Beleg.
REVOKE UPDATE, DELETE ON vote FROM versammlung_app;

-- ── Auflösen ohne Mandantenkontext ──────────────────────────────────────────
--
-- Wie beim Zugangscode: Wer die Präsentationssicht öffnet, ist nicht angemeldet.

CREATE FUNCTION anzeigecode_aufloesen(pruefwert text)
RETURNS TABLE (operator_id uuid, meeting_id uuid, meeting_state text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT m.operator_id, m.id, m.state
	FROM meeting m
	WHERE m.display_code_hash = pruefwert
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION anzeigecode_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anzeigecode_aufloesen(text) TO versammlung_app;
