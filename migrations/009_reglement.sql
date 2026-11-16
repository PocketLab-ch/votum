-- Story 2.4: Reglementsabweichungen beim Mehrheitserfordernis (FR-21).
--
-- Der häufigste Fehler im Schweizer Stockwerkeigentum: Das Gesetz kennt ein
-- Quorum, das Reglement ein anderes, und es gilt das Reglement. Bisher blieb
-- dazu nur der Vorbehalt «bitte selbst nachsehen». Hier wird er zur Regel.
--
-- Additiv und vorwärtsgerichtet (AD-14).

-- ── Prüfvermerk an der Gemeinschaft ─────────────────────────────────────────
--
-- Der Unterschied zwischen «keine Abweichung» und «noch nie nachgesehen» ist
-- der ganze Punkt: In einer Liste sehen beide gleich aus und bedeuten das
-- Gegenteil. Deshalb ein eigener Vermerk und kein Rückschluss aus der Zahl der
-- hinterlegten Regeln.
ALTER TABLE stweg
	ADD COLUMN bylaw_reviewed_on date,
	ADD COLUMN bylaw_reviewed_by text,
	-- Was sich nicht als Regel fassen liess. Erscheint bei jeder Herleitung und
	-- kann später der KI-Prüfung als Zusatzwissen mitgegeben werden.
	ADD COLUMN bylaw_note text;

-- Ein Prüfer ohne Datum wäre eine Angabe ohne Aussage.
ALTER TABLE stweg
	ADD CONSTRAINT stweg_pruefvermerk_vollstaendig
		CHECK (bylaw_reviewed_by IS NULL OR bylaw_reviewed_on IS NOT NULL);

-- ── Die Regeln selbst ───────────────────────────────────────────────────────

CREATE TABLE bylaw_quorum_rule (
	id            uuid PRIMARY KEY,
	operator_id   uuid NOT NULL REFERENCES operator (id),
	stweg_id      uuid NOT NULL,

	-- Anknüpfungspunkt ist die Geschäftsart, nicht die Knotenkennung des
	-- Regelwerks: Ein Reglement spricht von «baulichen Massnahmen». Hinge die
	-- Regel an der Kennung, verlöre sie mit der nächsten Regelfassung ihre
	-- Wirkung — still, ohne Fehlermeldung.
	business_kind text NOT NULL,

	head_numerator   integer NOT NULL,
	head_denominator integer NOT NULL,
	head_mode        text    NOT NULL,
	head_base        text    NOT NULL,

	quota_numerator   integer,
	quota_denominator integer,
	quota_mode        text,
	quota_base        text    NOT NULL DEFAULT 'keine',

	-- Pflicht. Ohne sie ist die Regel nicht überprüfbar, und im Streitfall steht
	-- eine Behauptung gegen das Reglement.
	source_reference text NOT NULL,
	abstention_counts boolean NOT NULL DEFAULT true,
	note             text,

	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),

	FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),

	CONSTRAINT bylaw_rule_kopf_bruch CHECK (
		head_numerator >= 1
		AND head_denominator BETWEEN 2 AND 100
		AND head_numerator <= head_denominator
	),
	CONSTRAINT bylaw_rule_kopf_art CHECK (head_mode IN ('mehr_als', 'mindestens')),
	CONSTRAINT bylaw_rule_kopf_basis CHECK (
		head_base IN ('anwesend_vertreten', 'alle_eigentuemer', 'alle_ausser_betroffene')
	),

	-- Alles oder nichts: Eine Quotenschwelle ohne Basis wäre eine Anforderung,
	-- zu der niemand weiss, worauf sie sich bezieht.
	CONSTRAINT bylaw_rule_quoten_vollstaendig CHECK (
		(quota_numerator IS NULL AND quota_denominator IS NULL AND quota_mode IS NULL AND quota_base = 'keine')
		OR (quota_numerator IS NOT NULL AND quota_denominator IS NOT NULL AND quota_mode IS NOT NULL AND quota_base <> 'keine')
	),
	CONSTRAINT bylaw_rule_quoten_bruch CHECK (
		quota_numerator IS NULL
		OR (quota_numerator >= 1 AND quota_denominator BETWEEN 2 AND 100 AND quota_numerator <= quota_denominator)
	),
	CONSTRAINT bylaw_rule_quoten_art CHECK (quota_mode IS NULL OR quota_mode IN ('mehr_als', 'mindestens')),
	CONSTRAINT bylaw_rule_quoten_basis CHECK (quota_base IN ('keine', 'alle_quoten', 'anwesend_vertreten')),

	CONSTRAINT bylaw_rule_fundstelle CHECK (length(btrim(source_reference)) >= 3)
);

-- Je Gemeinschaft und Geschäftsart höchstens eine Regel. Zwei widersprüchliche
-- wären schlimmer als keine: Es gäbe keinen Grund, warum die eine gälte.
CREATE UNIQUE INDEX bylaw_rule_je_geschaeftsart
	ON bylaw_quorum_rule (stweg_id, business_kind);

CREATE INDEX bylaw_rule_stweg_idx ON bylaw_quorum_rule (stweg_id);

ALTER TABLE bylaw_quorum_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bylaw_quorum_rule FORCE ROW LEVEL SECURITY;

CREATE POLICY bylaw_rule_mandant ON bylaw_quorum_rule
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON bylaw_quorum_rule TO versammlung_app;

CREATE TRIGGER bylaw_rule_updated_at
	BEFORE UPDATE ON bylaw_quorum_rule
	FOR EACH ROW EXECUTE FUNCTION setze_updated_at();
