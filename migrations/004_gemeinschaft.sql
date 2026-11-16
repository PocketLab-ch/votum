-- 004 — Stockwerkeigentümergemeinschaft (Story 1.4, FR-1)
--
-- Zweite Mandantenebene nach AD-6: Über dem Betreiber steht nichts, unter ihm
-- stehen die Gemeinschaften. Mehrhausanlagen entstehen über `parent_stweg_id`.

CREATE TABLE stweg (
    id                     uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id            uuid NOT NULL REFERENCES operator(id) ON DELETE RESTRICT,
    parent_stweg_id        uuid,
    name                   text NOT NULL,
    strasse                text,
    plz                    text,
    ort                    text,
    -- Nenner der Wertquoten, üblich 1000. Ganzzahlig, weil jede Rundung in der
    -- Auszählung landen würde (AD-12).
    quota_denominator      integer NOT NULL DEFAULT 1000,
    -- Zählweise der Kopfstimme (AD-2). `per_owner` ist der gesetzliche Grundsatz
    -- nach ZGB Art. 712o Abs. 1.
    head_count_mode        text NOT NULL DEFAULT 'per_owner',
    parking_counts_as_head boolean NOT NULL DEFAULT false,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT stweg_name_nicht_leer      CHECK (length(btrim(name)) >= 2),
    CONSTRAINT stweg_nenner_nicht_negativ CHECK (quota_denominator >= 0),
    CONSTRAINT stweg_zaehlweise           CHECK (head_count_mode IN ('per_owner', 'per_unit')),
    -- Der Zusatz zu den Nebenobjekten ergibt nur bei der Zählung je Einheit einen
    -- Sinn. Bei einer Kopfstimme je Eigentümer ändert die Zahl seiner Einheiten
    -- ohnehin nichts, und ein gesetzter Zusatz wäre irreführend.
    CONSTRAINT stweg_nebenobjekte_nur_je_einheit
        CHECK (NOT parking_counts_as_head OR head_count_mode = 'per_unit'),
    -- Der unmittelbare Ring. Tiefere fängt der Auslöser weiter unten ab.
    CONSTRAINT stweg_kein_selbstbezug     CHECK (parent_stweg_id IS DISTINCT FROM id),

    -- Ziel des zusammengesetzten Fremdschlüssels unten.
    UNIQUE (id, operator_id)
);

-- Eine Untergemeinschaft muss demselben Betreiber gehören. Ein Fremdschlüssel
-- allein auf `id` liesse eine Gemeinschaft zu, die unter der eines fremden
-- Betreibers hängt — der Zeilenschutz zeigte sie dann nirgends vollständig.
ALTER TABLE stweg
    ADD CONSTRAINT stweg_eltern_gleicher_betreiber
    FOREIGN KEY (parent_stweg_id, operator_id)
    REFERENCES stweg (id, operator_id)
    ON DELETE RESTRICT;

CREATE INDEX stweg_operator_idx ON stweg (operator_id);
CREATE INDEX stweg_parent_idx   ON stweg (parent_stweg_id) WHERE parent_stweg_id IS NOT NULL;

-- ── Ringschutz über mehrere Ebenen ─────────────────────────────────────────
-- Ein Ring wäre kein Anzeigefehler, sondern eine Endlosschleife bei jeder
-- Saldoprüfung und jeder Auszählung. Der Kern prüft es ebenfalls; hier steht
-- die Schranke, die auch dann hält, wenn ein späterer Codepfad die Prüfung
-- vergisst oder Daten direkt eingespielt werden.
CREATE OR REPLACE FUNCTION stweg_ringschutz() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ring boolean;
BEGIN
    IF NEW.parent_stweg_id IS NULL THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE aufwaerts AS (
        SELECT id, parent_stweg_id FROM stweg WHERE id = NEW.parent_stweg_id
        UNION ALL
        SELECT s.id, s.parent_stweg_id
        FROM stweg s JOIN aufwaerts a ON s.id = a.parent_stweg_id
    )
    SELECT EXISTS (SELECT 1 FROM aufwaerts WHERE id = NEW.id) INTO ring;

    IF ring THEN
        RAISE EXCEPTION
            'Gemeinschaft % kann nicht unter % hängen: es entstünde ein Ring',
            NEW.id, NEW.parent_stweg_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER stweg_ringschutz_trigger
    BEFORE INSERT OR UPDATE OF parent_stweg_id ON stweg
    FOR EACH ROW EXECUTE FUNCTION stweg_ringschutz();

-- ── Änderungszeitpunkt ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION setze_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER stweg_updated_at
    BEFORE UPDATE ON stweg
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

-- ── Zeilenschutz je Betreiber (AD-6) ───────────────────────────────────────
ALTER TABLE stweg ENABLE ROW LEVEL SECURITY;
ALTER TABLE stweg FORCE  ROW LEVEL SECURITY;

CREATE POLICY stweg_mandant ON stweg
    USING (operator_id::text = current_setting('versammlung.operator_id', true));
