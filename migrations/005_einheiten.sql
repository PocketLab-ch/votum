-- 005 — Quotenarten und Einheiten (Story 1.5, FR-2)
--
-- Eine Gemeinschaft führt selten nur einen Schlüssel. Neben der **Stammquote**
-- aus dem Grundbuch stehen Verteiler für Aufzug, Heizung oder Waschküche, an
-- denen nicht jede Einheit gleich beteiligt ist — welche es gibt, bestimmt das
-- Reglement. Jeder Schlüssel hat seinen eigenen Nenner und geht für sich auf.
--
-- Für das Stimmrecht nach Wertquote zählt allein die Stammquote (ZGB Art. 712e);
-- die übrigen sind Kostenschlüssel und verändern kein Quorum.

-- ── Quotenarten ────────────────────────────────────────────────────────────
CREATE TABLE quota_kind (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    stweg_id    uuid NOT NULL,
    -- Denormalisiert für den Zeilenschutz: Eine Regel, die erst über `stweg`
    -- springen muss, ist bei jedem Lesen teuer und leicht falsch geschrieben.
    operator_id uuid NOT NULL,
    key         text NOT NULL,
    name        text NOT NULL,
    denominator integer NOT NULL,
    is_primary  boolean NOT NULL DEFAULT false,
    sort_order  integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT quota_kind_schluessel_form CHECK (key ~ '^[a-z][a-z0-9_]{1,29}$'),
    CONSTRAINT quota_kind_name_nicht_leer CHECK (length(btrim(name)) >= 2),
    -- Anders als bei der Gemeinschaft gibt es hier keine blosse Klammer: Eine
    -- Quotenart ohne Nenner hätte nichts, wogegen sie prüfen könnte.
    CONSTRAINT quota_kind_nenner_positiv  CHECK (denominator > 0),
    -- Die Stammquote trägt einen festen Schlüssel. Hiesse sie in einer
    -- Gemeinschaft «stamm» und in der nächsten «wq», fände die Auszählung sie
    -- nicht mehr.
    CONSTRAINT quota_kind_stammquote_schluessel
        CHECK ((is_primary AND key = 'stamm') OR (NOT is_primary AND key <> 'stamm')),

    UNIQUE (stweg_id, key),
    UNIQUE (id, stweg_id),

    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id) ON DELETE CASCADE
);

-- Genau eine Stammquote je Gemeinschaft.
CREATE UNIQUE INDEX quota_kind_eine_stammquote
    ON quota_kind (stweg_id) WHERE is_primary;

CREATE INDEX quota_kind_stweg_idx ON quota_kind (stweg_id, sort_order);

-- ── Einheiten ──────────────────────────────────────────────────────────────
CREATE TABLE unit (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    stweg_id       uuid NOT NULL,
    operator_id    uuid NOT NULL,
    kind           text NOT NULL DEFAULT 'unit',
    label          text NOT NULL,
    -- Wirkt nur bei der Zählweise «je Einheit» und nie auf die Wertquoten.
    counts_as_head boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT unit_art             CHECK (kind IN ('unit', 'parking')),
    CONSTRAINT unit_label_nicht_leer CHECK (length(btrim(label)) >= 1),

    UNIQUE (id, stweg_id),

    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id) ON DELETE RESTRICT
);

CREATE INDEX unit_stweg_idx ON unit (stweg_id, label);

CREATE TRIGGER unit_updated_at
    BEFORE UPDATE ON unit
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

-- ── Werte je Einheit und Quotenart ─────────────────────────────────────────
-- Eine fehlende Zeile bedeutet: an diesem Verteiler nicht beteiligt. Das ist
-- ausdrücklich etwas anderes als der Wert null, der eine Beteiligung mit Anteil
-- null wäre — die Erdgeschosswohnung zahlt gar nicht an den Aufzug.
CREATE TABLE unit_quota (
    unit_id       uuid NOT NULL,
    quota_kind_id uuid NOT NULL,
    -- Zum Führen beider zusammengesetzter Fremdschlüssel.
    stweg_id      uuid NOT NULL,
    operator_id   uuid NOT NULL,
    value         integer NOT NULL,

    CONSTRAINT unit_quota_nicht_negativ CHECK (value >= 0),

    PRIMARY KEY (unit_id, quota_kind_id),

    -- Beide Seiten müssen zur selben Gemeinschaft gehören. Ohne diese Klammer
    -- könnte eine Einheit aus Haus A einen Aufzugsverteiler aus Haus B tragen,
    -- und beide Saldoprüfungen gingen nicht mehr auf, ohne dass ersichtlich wäre,
    -- warum.
    FOREIGN KEY (unit_id, stweg_id)       REFERENCES unit (id, stweg_id) ON DELETE CASCADE,
    FOREIGN KEY (quota_kind_id, stweg_id) REFERENCES quota_kind (id, stweg_id) ON DELETE RESTRICT,
    FOREIGN KEY (stweg_id, operator_id)   REFERENCES stweg (id, operator_id) ON DELETE RESTRICT
);

CREATE INDEX unit_quota_kind_idx ON unit_quota (quota_kind_id);

-- ── Jede Einheit braucht eine Stammquote ───────────────────────────────────
-- Als aufgeschobene Schranke, weil die Einheit vor ihren Quoten eingefügt wird.
-- Ohne sie verschwände eine Einheit ohne Stammquote lautlos aus jeder Zählung
-- nach Wertquoten — die Summe ginge scheinbar auf, und das Ergebnis wäre falsch.
CREATE OR REPLACE FUNCTION unit_braucht_stammquote() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM unit WHERE id = NEW.id) THEN
        -- In derselben Transaktion wieder entfernt: nichts zu prüfen.
        RETURN NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM unit_quota uq
        JOIN quota_kind qk ON qk.id = uq.quota_kind_id
        WHERE uq.unit_id = NEW.id AND qk.is_primary
    ) AND EXISTS (
        SELECT 1 FROM quota_kind WHERE stweg_id = NEW.stweg_id AND is_primary
    ) THEN
        RAISE EXCEPTION 'Einheit % hat keine Stammquote', NEW.label
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER unit_stammquote_pflicht
    AFTER INSERT OR UPDATE ON unit
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION unit_braucht_stammquote();

-- ── Stammquote der Gemeinschaft mitführen ──────────────────────────────────
-- Der Nenner der Stammquote wird bei der Gemeinschaft erfasst (Migration 004) —
-- dort gehört er hin, denn er ist ihre Grundeigenschaft. Damit die Saldoprüfung
-- alle Schlüssel einheitlich lesen kann, spiegelt dieser Auslöser ihn in
-- `quota_kind`. Es gibt keinen Weg, die beiden auseinanderlaufen zu lassen.
CREATE OR REPLACE FUNCTION stweg_stammquote_mitfuehren() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.quota_denominator > 0 THEN
        INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator, is_primary, sort_order)
        VALUES (NEW.id, NEW.operator_id, 'stamm', 'Stammquote', NEW.quota_denominator, true, 0)
        ON CONFLICT (stweg_id, key) DO UPDATE SET denominator = EXCLUDED.denominator;
    ELSE
        -- Nenner null macht die Gemeinschaft zur blossen Klammer. Bestehende
        -- Einheiten hingen dann an einer Stammquote, die es nicht mehr gibt —
        -- deshalb nur löschen, solange keine daran hängt; sonst scheitert es
        -- über den Fremdschlüssel, und das ist richtig so.
        DELETE FROM quota_kind WHERE stweg_id = NEW.id AND is_primary;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER stweg_stammquote_trigger
    AFTER INSERT OR UPDATE OF quota_denominator ON stweg
    FOR EACH ROW EXECUTE FUNCTION stweg_stammquote_mitfuehren();

-- Bestehende Gemeinschaften nachziehen.
INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator, is_primary, sort_order)
SELECT id, operator_id, 'stamm', 'Stammquote', quota_denominator, true, 0
FROM stweg
WHERE quota_denominator > 0
ON CONFLICT (stweg_id, key) DO NOTHING;

-- ── Zeilenschutz je Betreiber (AD-6) ───────────────────────────────────────
ALTER TABLE quota_kind ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_kind FORCE  ROW LEVEL SECURITY;
ALTER TABLE unit       ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit       FORCE  ROW LEVEL SECURITY;
ALTER TABLE unit_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_quota FORCE  ROW LEVEL SECURITY;

CREATE POLICY quota_kind_mandant ON quota_kind
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY unit_mandant ON unit
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY unit_quota_mandant ON unit_quota
    USING (operator_id::text = current_setting('versammlung.operator_id', true));
