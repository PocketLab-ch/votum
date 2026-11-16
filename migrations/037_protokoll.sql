-- 037 — Protokoll (Welle 2, Block 2, FR-46 und FR-48 bis FR-50)
--
-- ZGB 712n Abs. 2 verlangt, dass die Beschlüsse protokolliert werden. Verlangt
-- ist ein **Beschlussprotokoll**, kein Wortprotokoll: Die Zahlen und Wortlaute
-- stehen bereits in der Anwendung. Was der Sitzungsleiter beisteuert, sind die
-- Begründungen und Voten, die zum Verständnis nötig sind.
--
-- **Das Protokoll ist ausdrücklich nicht Teil des Siegels** (PRD §4.11). Es ist
-- ein Dokument, das nach der Sitzung entsteht, redigiert und von der nächsten
-- Versammlung genehmigt wird. Die Zahlen dagegen stehen mit dem Schluss fest.
-- Deshalb ist hier — anders als bei Verlauf, Weisung und Vollmacht — **kein**
-- Änderungsverbot am Platz: Ein Protokoll, das sich nicht mehr redigieren
-- lässt, wäre unbrauchbar.

-- ── Was während der Sitzung je Traktandum notiert wird (FR-46) ─────────────
--
-- Am Traktandum und nicht in einer eigenen Tabelle: Es gibt genau einen Text je
-- Traktandum, er gehört dorthin, und beim Löschen eines Spontantraktandums
-- verschwindet er mit. Wer die Fassungen des Textes braucht, findet sie im
-- Verlauf — jede Änderung steht dort mit Zeitpunkt und Person.
ALTER TABLE agenda_item ADD COLUMN minute_text            text;
ALTER TABLE agenda_item ADD COLUMN minute_text_changed_at timestamptz;
ALTER TABLE agenda_item ADD COLUMN minute_text_changed_by uuid REFERENCES app_user (id);

COMMENT ON COLUMN agenda_item.minute_text IS
    'Notizen der Sitzungsleitung zu diesem Traktandum — Voten, Begründungen, Ordnungsentscheide (FR-46).';

-- ── Die Arbeitsfassung des Protokolls (FR-48, FR-49) ──────────────────────
--
-- Genau eine je Versammlung. Sie entsteht als Entwurf aus den Daten und bleibt
-- danach frei bearbeitbar.
CREATE TABLE minutes (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),
    meeting_id  uuid NOT NULL,

    body text NOT NULL,

    created_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES app_user (id),
    created_by_label text,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    updated_by       uuid REFERENCES app_user (id),
    updated_by_label text,

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE,
    UNIQUE (meeting_id)
);

CREATE TRIGGER minutes_updated_at
    BEFORE UPDATE ON minutes
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE minutes FORCE  ROW LEVEL SECURITY;
CREATE POLICY minutes_mandant ON minutes
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE ON minutes TO versammlung_app;

COMMENT ON TABLE minutes IS
    'Die Arbeitsfassung des Protokolls — frei bearbeitbar, ausdrücklich nicht Teil des Siegels.';

-- ── Festgehaltene Fassungen (FR-50) ───────────────────────────────────────
--
-- «Eine als versandt gekennzeichnete Fassung bleibt unverändert abrufbar, auch
-- wenn danach weiter bearbeitet wird.» Genau dafür sind diese Zeilen da: Sie
-- sind Abzüge der Arbeitsfassung zu einem Zeitpunkt und werden **nicht mehr
-- geändert** — sonst wäre die versandte Fassung nicht mehr die versandte.
CREATE TABLE minutes_version (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),
    meeting_id  uuid NOT NULL,

    number int  NOT NULL,
    body   text NOT NULL,
    -- Warum festgehalten. `versandt` ist der Fall aus FR-50; `genehmigt` hält
    -- die Genehmigung durch die nächste Versammlung fest; `festgehalten` ist
    -- der Zwischenstand, den jemand aus eigenem Antrieb sichert.
    kind   text NOT NULL,
    note   text,

    frozen_at       timestamptz NOT NULL DEFAULT now(),
    frozen_by       uuid REFERENCES app_user (id),
    frozen_by_label text,

    CONSTRAINT minutes_version_art CHECK (kind IN ('versandt', 'genehmigt', 'festgehalten')),
    CONSTRAINT minutes_version_nummer CHECK (number >= 1),

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE,
    UNIQUE (meeting_id, number)
);

CREATE INDEX minutes_version_idx ON minutes_version (meeting_id, number DESC);

-- Eine festgehaltene Fassung ist ein Abzug, kein Arbeitsstand (AD-5).
CREATE OR REPLACE FUNCTION minutes_version_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Festgehaltene Protokollfassungen werden nicht gelöscht (FR-50).';
    END IF;
    RAISE EXCEPTION 'Eine festgehaltene Protokollfassung wird nicht geändert — halten Sie eine neue fest.';
END;
$$;

CREATE TRIGGER minutes_version_unveraenderlich_trigger
    BEFORE UPDATE OR DELETE ON minutes_version
    FOR EACH ROW EXECUTE FUNCTION minutes_version_unveraenderlich();

ALTER TABLE minutes_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE minutes_version FORCE  ROW LEVEL SECURITY;
CREATE POLICY minutes_version_mandant ON minutes_version
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT ON minutes_version TO versammlung_app;

COMMENT ON TABLE minutes_version IS
    'Abzüge des Protokolls zu einem Zeitpunkt — versandt, genehmigt oder von Hand festgehalten (FR-50).';
