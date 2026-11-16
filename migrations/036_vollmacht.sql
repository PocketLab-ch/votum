-- 036 — Vertretung und Vollmacht (Welle 2, FR-23 bis FR-25)
--
-- Wer nicht kommen kann, lässt sich vertreten. Bis heute geschah das ausserhalb
-- des Werkzeugs, und die Stimme nahm der Sitzungsleiter auf — damit fehlte
-- genau das, worauf es im Streitfall ankommt: wer wen aufgrund welchen
-- Nachweises vertreten hat, und ab wann.
--
-- **Die tragende Reihenfolge ist: erst prüfen, dann aktivieren.** Eine erfasste
-- Vollmacht überträgt nichts. Erst die ausdrückliche Bestätigung durch die
-- Sitzungsleitung macht sie wirksam. Aus dem Vorgängerprojekt übernommen, wo
-- sie sich bewährt hat.
--
-- **Die Vollmacht hängt an der Momentaufnahme, nicht an den Stammdaten.** Sie
-- gilt für genau eine Versammlung (FR-23), und die Partei, um die es geht, ist
-- die der eingefrorenen Liste. Wird die Freigabe zurückgenommen, verschwindet
-- die Momentaufnahme — und mit ihr die Vollmachten, die sich darauf beziehen.
-- Das ist richtig so: Ohne Stimmberechtigtenstand gibt es niemanden zu
-- vertreten.

-- ── Die Schranke aus dem Reglement ─────────────────────────────────────────
--
-- Das Gesetz kennt keine Höchstzahl an Vollmachten je Person, viele Reglemente
-- schon. Ohne hinterlegte Zahl prüft die Anwendung nichts.
--
-- Mit Fundstelle, wie bei der Zählweise: Wer den Beschluss anficht, greift
-- zuerst die Vertretungsmacht an, und dann muss dastehen, woraus sich die
-- Schranke ergibt.
ALTER TABLE stweg ADD COLUMN proxy_limit             integer;
ALTER TABLE stweg ADD COLUMN proxy_limit_rule_source text;

ALTER TABLE stweg ADD CONSTRAINT stweg_vollmachtschranke
    CHECK (proxy_limit IS NULL OR proxy_limit >= 1);

ALTER TABLE stweg ADD CONSTRAINT stweg_vollmachtschranke_fundstelle
    CHECK (proxy_limit IS NULL OR length(btrim(coalesce(proxy_limit_rule_source, ''))) >= 3);

COMMENT ON COLUMN stweg.proxy_limit IS
    'Höchstzahl der Vollmachten je Person nach Reglement. NULL heisst: keine Schranke, es wird nicht geprüft.';

-- ── Die Vollmacht ──────────────────────────────────────────────────────────
CREATE TABLE proxy (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),
    meeting_id  uuid NOT NULL,

    -- Wer vertreten wird.
    represented_id uuid NOT NULL,

    -- Wer vertritt: entweder eine andere Partei derselben Versammlung ...
    holder_id   uuid,
    -- ... oder eine dritte Person, die nicht Eigentümerin ist. Dann steht hier
    -- ihr Name und sonst nichts: Sie ist nicht stimmberechtigt, sie übt aus.
    holder_name text,

    state       text NOT NULL DEFAULT 'erfasst',

    -- Der Nachweis. «Original vorgelegt» ist der übliche Weg im Saal und ein
    -- vollwertiger Nachweis; die Datei kann nachkommen (FR-24). Dateien hängen
    -- als `attachment` mit subject_type = 'proxy' daran — die Tabelle sieht
    -- diese Art seit Migration 007 vor.
    proof_shown boolean NOT NULL DEFAULT false,
    note        text,

    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid REFERENCES app_user (id),
    created_by_label  text,

    confirmed_at       timestamptz,
    confirmed_by       uuid REFERENCES app_user (id),
    confirmed_by_label text,

    ended_at       timestamptz,
    ended_reason   text,
    ended_by       uuid REFERENCES app_user (id),
    ended_by_label text,

    CONSTRAINT proxy_zustand CHECK (
        state IN ('erfasst', 'bestaetigt', 'zurueckgewiesen', 'widerrufen')
    ),

    -- Genau eine Art von Vertreter. Beides zugleich liesse offen, wer im Saal
    -- die Hand hebt; keines von beidem ist keine Vollmacht.
    CONSTRAINT proxy_ein_vertreter CHECK (
        (holder_id IS NULL) <> (holder_name IS NULL)
    ),
    CONSTRAINT proxy_name_gehaltvoll CHECK (
        holder_name IS NULL OR length(btrim(holder_name)) >= 2
    ),
    -- Sich selbst vertritt niemand.
    CONSTRAINT proxy_nicht_sich_selbst CHECK (
        holder_id IS NULL OR holder_id <> represented_id
    ),

    -- Wirksam heisst bestätigt, und bestätigt heisst: mit Zeitpunkt und Person.
    CONSTRAINT proxy_bestaetigt_mit_zeitpunkt CHECK (
        state <> 'bestaetigt' OR (confirmed_at IS NOT NULL AND length(btrim(coalesce(confirmed_by_label, ''))) >= 2)
    ),
    -- Eine Zurückweisung verlangt eine Begründung (FR-25). Ohne sie stünde im
    -- Protokoll, dass jemand nicht mitstimmen durfte, und niemand wüsste warum.
    CONSTRAINT proxy_ende_mit_grund CHECK (
        state NOT IN ('zurueckgewiesen', 'widerrufen')
        OR (ended_at IS NOT NULL AND length(btrim(coalesce(ended_reason, ''))) >= 3)
    ),

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
    FOREIGN KEY (represented_id, operator_id) REFERENCES snapshot_party (id, operator_id)
        ON DELETE CASCADE,
    FOREIGN KEY (holder_id, operator_id) REFERENCES snapshot_party (id, operator_id)
        ON DELETE CASCADE
);

CREATE INDEX proxy_versammlung_idx ON proxy (meeting_id, state);
CREATE INDEX proxy_vertreter_idx   ON proxy (holder_id) WHERE holder_id IS NOT NULL;

-- Je vertretener Partei höchstens **eine** offene oder wirksame Vollmacht.
-- Zwei gleichzeitige wären zwei Personen, die dieselbe Stimme ausüben dürfen,
-- und im Saal entschiede darüber, wer zuerst die Hand hebt.
CREATE UNIQUE INDEX proxy_eine_je_partei
    ON proxy (represented_id)
    WHERE state IN ('erfasst', 'bestaetigt');

-- Was einmal geschehen ist, bleibt stehen (AD-5).
--
-- Geändert werden darf ausschliesslich der Lebensweg: bestätigen,
-- zurückweisen, widerrufen, den Nachweis nachtragen. Wer statt dessen
-- nachträglich einen anderen Vertreter einträgt, verschiebt eine abgegebene
-- Stimme auf eine andere Person — und niemand sähe es der Zeile an.
CREATE OR REPLACE FUNCTION proxy_nur_lebensweg() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Vollmachten werden nicht gelöscht (AD-5); weisen Sie sie zurück oder widerrufen Sie sie.';
    END IF;
    IF NEW.represented_id IS DISTINCT FROM OLD.represented_id
       OR NEW.holder_id   IS DISTINCT FROM OLD.holder_id
       OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
       OR NEW.meeting_id  IS DISTINCT FROM OLD.meeting_id
       OR NEW.created_at  IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Wer wen vertritt, wird nicht geändert (AD-5); weisen Sie die Vollmacht zurück und erfassen Sie eine neue.';
    END IF;
    -- Eine bestätigte Vollmacht kehrt nicht in den unbestätigten Zustand zurück.
    IF OLD.state = 'bestaetigt' AND NEW.state = 'erfasst' THEN
        RAISE EXCEPTION 'Eine bestätigte Vollmacht wird nicht wieder unbestätigt; widerrufen Sie sie.';
    END IF;
    IF OLD.state IN ('zurueckgewiesen', 'widerrufen') AND NEW.state <> OLD.state THEN
        RAISE EXCEPTION 'Eine beendete Vollmacht lebt nicht wieder auf; erfassen Sie eine neue.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER proxy_nur_lebensweg_trigger
    BEFORE UPDATE OR DELETE ON proxy
    FOR EACH ROW EXECUTE FUNCTION proxy_nur_lebensweg();

ALTER TABLE proxy ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy FORCE  ROW LEVEL SECURITY;

CREATE POLICY proxy_mandant ON proxy
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE ON proxy TO versammlung_app;

COMMENT ON TABLE proxy IS
    'Die Vollmacht für eine Versammlung: wer wen aufgrund welchen Nachweises vertritt, und ab wann.';

-- ── Der Weg, auf dem die Anwesenheit zustande kam ──────────────────────────
--
-- Eine vertretene Partei ist anwesend, weil ihr Vertreter da ist. Das gehört in
-- die Anwesenheitsliste und ins Protokoll: Sonst stünde dort eine Person als
-- anwesend, die den Saal nie betreten hat.
ALTER TABLE attendance_event DROP CONSTRAINT attendance_weg;
ALTER TABLE attendance_event ADD CONSTRAINT attendance_weg CHECK (
    channel IN ('gescannt', 'selbst', 'von_hand', 'liste', 'vertretung')
);
