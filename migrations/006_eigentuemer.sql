-- 006 — Eigentümer, Eigentum mit Gültigkeitszeitraum, Zählweise-Fundstelle
--       (Story 1.6, FR-3; Grundlage für Story 1.8, FR-5)

-- ── Fundstelle der Zählweise ───────────────────────────────────────────────
-- Rechtlich ist eine Stimme je Eigentümer die Auffangregel (ZGB Art. 712m
-- Abs. 2 i.V.m. Art. 67 Abs. 1). In der Praxis steht in den meisten Reglementen
-- die Zählung je Einheit — das Schulskript hält beides gleich mit fest.
--
-- Daraus folgt: Eine Voreinstellung wäre hier falsch, egal welche. Wer «je
-- Einheit» unbesehen übernimmt, zählt vielleicht ohne Grundlage im Reglement;
-- wer «je Eigentümer» unbesehen übernimmt, zählt vielleicht gegen das eigene.
-- Beides fällt erst auf, wenn ein Beschluss angefochten wird. Die Fundstelle ist
-- der Nachweis, auf den es dann ankommt.
ALTER TABLE stweg ADD COLUMN head_count_rule_source text;

-- Bei der gesetzlichen Auffangregel gibt es nichts zu belegen; ein Verweis aufs
-- Reglement wäre dort irreführend.
ALTER TABLE stweg ADD CONSTRAINT stweg_fundstelle_nur_bei_reglement
    CHECK (head_count_rule_source IS NULL OR head_count_mode = 'per_unit');

-- ── Eigentümer ─────────────────────────────────────────────────────────────
CREATE TABLE party (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    stweg_id            uuid NOT NULL,
    operator_id         uuid NOT NULL,
    kind                text NOT NULL DEFAULT 'natural',
    display_name        text NOT NULL,
    -- Bei gemeinschaftlichem Eigentum die Person, die die eine Stimme ausübt
    -- (ZGB Art. 712o Abs. 1); bei einer juristischen Person die
    -- vertretungsberechtigte Person.
    representative_name text,
    is_community        boolean NOT NULL DEFAULT false,
    email               text,
    phone               text,
    address             text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT party_art             CHECK (kind IN ('natural', 'legal')),
    CONSTRAINT party_name_nicht_leer CHECK (length(btrim(display_name)) >= 2),
    -- Ohne benannte Person stünde die Sitzungsleitung im Moment der Abstimmung
    -- vor der Frage, wen sie zählen darf — und die lässt sich dann nicht mehr
    -- klären.
    CONSTRAINT party_vertreter_bei_gemeinschaft
        CHECK (NOT is_community OR length(btrim(coalesce(representative_name, ''))) >= 2),
    -- Eine juristische Person handelt nie selbst.
    CONSTRAINT party_vertretung_bei_juristisch
        CHECK (kind <> 'legal' OR length(btrim(coalesce(representative_name, ''))) >= 2),

    UNIQUE (id, stweg_id),

    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id) ON DELETE RESTRICT
);

CREATE INDEX party_stweg_idx ON party (stweg_id, display_name);

CREATE TRIGGER party_updated_at
    BEFORE UPDATE ON party
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

-- ── Eigentum mit Gültigkeitszeitraum ───────────────────────────────────────
-- Von Anfang an mit Zeitraum, nicht als «aktueller Eigentümer»: Ein späterer
-- Umbau wäre kein additiver Schritt mehr (AD-14), und eine vergangene
-- Versammlung muss den damaligen Stand zeigen (Story 1.8, FR-5).
--
-- `valid_to` offen bedeutet: gilt bis auf Weiteres. Der Zeitraum ist links
-- geschlossen und rechts offen — der Tag des Wechsels gehört dem neuen
-- Eigentümer, sonst gäbe es einen Tag mit zwei oder mit keinem.
CREATE TABLE unit_ownership (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    unit_id     uuid NOT NULL,
    party_id    uuid NOT NULL,
    stweg_id    uuid NOT NULL,
    operator_id uuid NOT NULL,
    valid_from  date NOT NULL,
    valid_to    date,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ownership_zeitraum CHECK (valid_to IS NULL OR valid_to > valid_from),

    -- Beide Seiten müssen zur selben Gemeinschaft gehören.
    FOREIGN KEY (unit_id, stweg_id)     REFERENCES unit (id, stweg_id) ON DELETE CASCADE,
    FOREIGN KEY (party_id, stweg_id)    REFERENCES party (id, stweg_id) ON DELETE RESTRICT,
    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id) ON DELETE RESTRICT
);

CREATE INDEX unit_ownership_unit_idx  ON unit_ownership (unit_id, valid_from);
CREATE INDEX unit_ownership_party_idx ON unit_ownership (party_id);

-- Eine Einheit kann zu einem Zeitpunkt nicht zwei Eigentümer haben. Gemeinsames
-- Eigentum wird über **eine** Partei mit `is_community` abgebildet, nicht über
-- zwei Zeilen — sonst hätte die Einheit nach ZGB Art. 712o Abs. 1 zwei Stimmen
-- statt einer.
--
-- daterange mit `[)`: links geschlossen, rechts offen. Ein Wechsel per 1. März
-- heisst valid_to = 1. März beim alten und valid_from = 1. März beim neuen; die
-- Bereiche stossen aneinander, ohne sich zu überschneiden.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE unit_ownership ADD CONSTRAINT unit_ownership_keine_ueberschneidung
    EXCLUDE USING gist (
        unit_id WITH =,
        daterange(valid_from, valid_to, '[)') WITH &&
    );

-- ── Zeilenschutz je Betreiber (AD-6) ───────────────────────────────────────
ALTER TABLE party          ENABLE ROW LEVEL SECURITY;
ALTER TABLE party          FORCE  ROW LEVEL SECURITY;
ALTER TABLE unit_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_ownership FORCE  ROW LEVEL SECURITY;

CREATE POLICY party_mandant ON party
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY unit_ownership_mandant ON unit_ownership
    USING (operator_id::text = current_setting('versammlung.operator_id', true));
