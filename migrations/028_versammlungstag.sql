-- Der Versammlungstag und das Geschäft (Stories 7.5 und 7.5a).
--
-- Am 26. Mai 2026 tagten sieben Gemeinschaften an einem Abend im selben Raum,
-- und das Ergebnis steht in **einem** Protokoll. Rechtlich sind es trotzdem
-- sieben Versammlungen: Die Beschlussfähigkeit wird je Gemeinschaft
-- festgestellt, das Protokoll je Gemeinschaft geführt, die Anfechtungsfrist
-- läuft je Gemeinschaft.
--
-- **Eine Klammer, keine Verschmelzung.** Der Versammlungstag hält zusammen, was
-- im Saal zusammengehört — Datum, Ort, Reihenfolge —, ohne die Versammlungen
-- selbst anzutasten. Wer sie verschmölze, hätte eine Beschlussfähigkeit für
-- sieben Gemeinschaften mit verschiedenen Schwellen und könnte sie nicht mehr
-- auseinanderrechnen.

CREATE TABLE meeting_day (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id  uuid NOT NULL REFERENCES operator (id) ON DELETE RESTRICT,
    label        text NOT NULL,
    day_date     date NOT NULL,
    start_time   time NOT NULL,
    location     text NOT NULL,
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT meeting_day_label_nicht_leer    CHECK (length(btrim(label)) >= 2),
    CONSTRAINT meeting_day_location_nicht_leer CHECK (length(btrim(location)) >= 2),

    UNIQUE (id, operator_id)
);

CREATE INDEX meeting_day_operator_idx ON meeting_day (operator_id, day_date DESC);

CREATE TRIGGER meeting_day_updated_at
    BEFORE UPDATE ON meeting_day
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

-- Die Zuordnung an der Versammlung, nicht als eigene Tabelle: Eine Versammlung
-- gehört zu höchstens einem Tag, und eine Verbindungstabelle liesse offen, was
-- zwei Tage für dieselbe Versammlung bedeuten sollen.
ALTER TABLE meeting ADD COLUMN meeting_day_id uuid;
ALTER TABLE meeting ADD COLUMN day_position   integer;

ALTER TABLE meeting
    ADD CONSTRAINT meeting_tag_gleicher_betreiber
    FOREIGN KEY (meeting_day_id, operator_id)
    REFERENCES meeting_day (id, operator_id)
    ON DELETE RESTRICT;

CREATE INDEX meeting_tag_idx ON meeting (meeting_day_id, day_position)
    WHERE meeting_day_id IS NOT NULL;

-- Eine Gemeinschaft tagt an einem Tag höchstens einmal. Zwei Versammlungen
-- derselben Gemeinschaft am selben Abend wären zwei Beschlussfähigkeiten und
-- zwei Protokolle für dieselbe Sache.
CREATE UNIQUE INDEX meeting_tag_je_gemeinschaft
    ON meeting (meeting_day_id, stweg_id)
    WHERE meeting_day_id IS NOT NULL;

COMMENT ON TABLE meeting_day IS
    'Klammer über mehrere Versammlungen desselben Abends; die Versammlungen bleiben getrennt.';

-- ── Das Geschäft (Story 7.5a) ──────────────────────────────────────────────
--
-- Die echte Traktandenliste vom 26. Mai ist nicht nach Gemeinschaften geordnet,
-- sondern nach Sachfragen — und jede läuft mehrfach:
--
--   2. Betriebskostenabrechnung
--      2.1 MEG Nirgendweg 3-13a · 2.2 MEG-Einstellhalle · 2.3–2.7 die Häuser
--   6. Überprüfung des Allgemeinstromverbrauchs
--      6.1–6.5   nur die fünf Häuser, keine MEG
--
-- Ein Antragstext, ein Mehrheitserfordernis, sieben getrennte Beschlüsse. Das
-- Geschäft ist die Klammer für Erfassung und Darstellung — **nicht** für das
-- Ergebnis: Sieben Beschlüsse bleiben sieben, jeder mit eigener Bezugsgrösse,
-- eigener Beschlussfähigkeit und eigener Anfechtungsfrist.
CREATE TABLE business (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id    uuid NOT NULL REFERENCES operator (id) ON DELETE RESTRICT,
    meeting_day_id uuid NOT NULL,
    title          text NOT NULL,
    motion_text    text,
    body           text,
    item_kind      text NOT NULL DEFAULT 'abstimmung',
    position       integer NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT business_titel_nicht_leer CHECK (length(btrim(title)) >= 3),
    CONSTRAINT business_art CHECK (item_kind IN ('abstimmung', 'kenntnisnahme')),

    FOREIGN KEY (meeting_day_id, operator_id)
        REFERENCES meeting_day (id, operator_id) ON DELETE CASCADE,

    UNIQUE (id, operator_id)
);

CREATE INDEX business_tag_idx ON business (meeting_day_id, position);

ALTER TABLE agenda_item ADD COLUMN business_id uuid;

ALTER TABLE agenda_item
    ADD CONSTRAINT agenda_item_geschaeft_gleicher_betreiber
    FOREIGN KEY (business_id, operator_id)
    REFERENCES business (id, operator_id)
    ON DELETE SET NULL;

CREATE INDEX agenda_item_geschaeft_idx ON agenda_item (business_id)
    WHERE business_id IS NOT NULL;

ALTER TABLE meeting_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_day FORCE  ROW LEVEL SECURITY;
ALTER TABLE business    ENABLE ROW LEVEL SECURITY;
ALTER TABLE business    FORCE  ROW LEVEL SECURITY;

CREATE POLICY meeting_day_mandant ON meeting_day
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY business_mandant ON business
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

COMMENT ON TABLE business IS
    'Ein Geschäft, das an einem Versammlungstag in mehreren Gemeinschaften läuft — Klammer für Erfassung und Anzeige, nie für das Ergebnis.';
