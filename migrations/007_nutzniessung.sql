-- 007 — Nutzniessung und Dateianhänge (Story 1.7, FR-4)
--
-- In Welle 1 ausdrücklich nur Datenhaltung: Wer bei einem Traktandum stimmen
-- darf, bestimmt die Sitzungsleitung von Hand. Eine automatische Ableitung wäre
-- gefährlich, weil ZGB Art. 712o Abs. 2 nur eine Auffangregel enthält und ein
-- Vertrag sie vollständig verdrängen kann.

-- ── Dateianhänge ───────────────────────────────────────────────────────────
-- Der Inhalt liegt in der Dateiablage, benannt nach seiner Prüfsumme (AD-17).
-- Hier steht nur, wozu er gehört und wie er ursprünglich hiess.
CREATE TABLE attachment (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id   uuid NOT NULL REFERENCES operator(id) ON DELETE RESTRICT,
    stweg_id      uuid,
    -- Wozu der Anhang gehört: 'usufruct', später 'motion', 'proxy', 'meeting'.
    subject_type  text NOT NULL,
    subject_id    uuid NOT NULL,
    checksum      text NOT NULL,
    original_name text NOT NULL,
    content_type  text NOT NULL,
    size_bytes    integer NOT NULL,
    uploaded_by   uuid REFERENCES app_user(id) ON DELETE RESTRICT,
    uploaded_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT attachment_pruefsumme CHECK (checksum ~ '^[0-9a-f]{64}$'),
    CONSTRAINT attachment_groesse    CHECK (size_bytes > 0)
);

CREATE INDEX attachment_subject_idx  ON attachment (subject_type, subject_id);
CREATE INDEX attachment_checksum_idx ON attachment (checksum);

-- Anhänge sind Nachweise. Wer sie nachträglich austauschen könnte, könnte auch
-- einen Beschluss anders begründen, als er gefasst wurde (AD-5).
CREATE TRIGGER attachment_kein_update
    BEFORE UPDATE ON attachment
    FOR EACH ROW EXECUTE FUNCTION verhindere_aenderung();

REVOKE UPDATE ON attachment FROM versammlung_app;

-- ── Nutzniessung ───────────────────────────────────────────────────────────
CREATE TABLE usufruct (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    unit_id           uuid NOT NULL,
    stweg_id          uuid NOT NULL,
    operator_id       uuid NOT NULL,
    holder_name       text NOT NULL,
    valid_from        date NOT NULL,
    -- Freiwillig: Eine Nutzniessung endet oft erst mit dem Tod, und ein
    -- Pflichtfeld zwänge zu einer erfundenen Angabe.
    valid_to          date,
    -- Besteht eine Vereinbarung, verdrängt sie die Auffangregel des Gesetzes
    -- vollständig — auch für qualifiziertes Mehr und Einstimmigkeit.
    has_agreement     boolean NOT NULL DEFAULT false,
    agreement_summary text,
    created_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT usufruct_berechtigter CHECK (length(btrim(holder_name)) >= 2),
    CONSTRAINT usufruct_zeitraum     CHECK (valid_to IS NULL OR valid_to > valid_from),
    -- Eine Vereinbarung, von der nur bekannt ist, dass es sie gibt, hilft im
    -- Moment der Abstimmung nicht.
    CONSTRAINT usufruct_vereinbarung_mit_inhalt
        CHECK (NOT has_agreement OR length(btrim(coalesce(agreement_summary, ''))) >= 3),

    FOREIGN KEY (unit_id, stweg_id)     REFERENCES unit (id, stweg_id) ON DELETE CASCADE,
    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id) ON DELETE RESTRICT
);

CREATE INDEX usufruct_unit_idx ON usufruct (unit_id, valid_from);

-- Zwei Nutzniessungen an derselben Einheit zur selben Zeit gibt es nicht.
ALTER TABLE usufruct ADD CONSTRAINT usufruct_keine_ueberschneidung
    EXCLUDE USING gist (
        unit_id WITH =,
        daterange(valid_from, valid_to, '[)') WITH &&
    );

-- ── Zeilenschutz je Betreiber (AD-6) ───────────────────────────────────────
ALTER TABLE attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachment FORCE  ROW LEVEL SECURITY;
ALTER TABLE usufruct   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usufruct   FORCE  ROW LEVEL SECURITY;

CREATE POLICY attachment_mandant ON attachment
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY usufruct_mandant ON usufruct
    USING (operator_id::text = current_setting('versammlung.operator_id', true));
