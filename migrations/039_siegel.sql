-- 039 — Abschlusspaket und Siegel (Welle 2, Block 3, FR-51 bis FR-55)
--
-- **Der Nachweiswert entsteht nicht dadurch, dass Daten nicht bearbeitet werden
-- können, sondern dadurch, dass jede Bearbeitung auffällt** (PRD §4.11). Beim
-- Versiegeln entsteht ein Paket mit allem, was den Beschluss trägt; über jeden
-- Bestandteil wird eine Prüfsumme gebildet, und diese Prüfsummen stehen in
-- einem Manifest, dessen eigene Prüfsumme das Siegel ist.
--
-- Das Muster ist in immotool erprobt: SHA-256, RFC-3161 mit Zertifikatsbindung,
-- nur anfügbares Protokoll, Abbruch statt stillem Verzicht.
--
-- **Das Protokoll ist ausdrücklich ausgenommen.** Es entsteht nach der Sitzung,
-- wird redigiert und von der nächsten Versammlung genehmigt. Die Zahlen dagegen
-- stehen mit dem Schluss der Sitzung fest.

CREATE TABLE seal (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),
    meeting_id  uuid NOT NULL,

    -- Das Manifest im Wortlaut, wie es im Paket liegt. Zweitgespeichert und
    -- nicht bloss als Verweis: Wer prüft, muss vergleichen können, ohne das
    -- Paket zur Hand zu haben — und wenn die Datei verschwindet, ist das
    -- Manifest der Beleg, dass es sie gab.
    manifest      text NOT NULL,
    -- Die Prüfsumme über das Manifest. **Das ist das Siegel.**
    manifest_hash text NOT NULL,
    -- Die Prüfsumme über das Paket als Ganzes; darunter liegt es in der
    -- Dateiablage (AD-17).
    package_hash  text NOT NULL,
    package_bytes integer NOT NULL,

    sealed_at       timestamptz NOT NULL DEFAULT now(),
    sealed_by       uuid REFERENCES app_user (id),
    sealed_by_label text,
    clock_source    text NOT NULL DEFAULT 'system',

    -- ── Zeitstempel nach RFC 3161 (FR-53) ─────────────────────────────────
    --
    -- **Abweichung von immotool, bewusst:** Dort bricht der Vorgang ab, wenn
    -- der Dienst nicht erreichbar ist. Hier nicht — der Abschluss einer
    -- Versammlung darf nicht an fehlendem Internet scheitern, und der Betrieb
    -- im Versammlungsraum ohne Netz ist ausdrücklich vorgesehen (AD-9). Die
    -- Lücke wird sichtbar gemacht statt verschwiegen: Das Paket trägt
    -- «ausstehend», das Dashboard weist es aus, und der Zeitstempel wird
    -- nachgeholt.
    timestamp_state text NOT NULL DEFAULT 'ausstehend',
    timestamp_at    timestamptz,
    -- Die Antwort des Dienstes, unter ihrer Prüfsumme in der Dateiablage.
    timestamp_hash  text,
    timestamp_authority text,
    timestamp_note  text,

    CONSTRAINT seal_manifest_hash  CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT seal_package_hash   CHECK (package_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT seal_bytes          CHECK (package_bytes > 0),
    CONSTRAINT seal_zeitstempel    CHECK (timestamp_state IN ('ausstehend', 'vorhanden', 'gescheitert')),
    -- Ein vorhandener Zeitstempel ohne Antwort wäre eine Behauptung.
    CONSTRAINT seal_zeitstempel_belegt CHECK (
        timestamp_state <> 'vorhanden' OR (timestamp_hash IS NOT NULL AND timestamp_at IS NOT NULL)
    ),

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
    -- Genau ein Siegel je Versammlung. Ein zweites hiesse, es gäbe zwei
    -- Wahrheiten darüber, was beschlossen wurde.
    UNIQUE (meeting_id)
);

CREATE INDEX seal_offener_zeitstempel_idx ON seal (timestamp_state)
    WHERE timestamp_state <> 'vorhanden';

-- Das Siegel selbst ist unveränderlich — mit **einer** Ausnahme: Der
-- nachgeholte Zeitstempel darf eingetragen werden. Genau dafür ist der Zustand
-- «ausstehend» da; ohne diese Ausnahme wäre die Nachholmechanik unmöglich.
CREATE OR REPLACE FUNCTION seal_nur_zeitstempel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Ein Siegel wird nicht gelöscht.';
    END IF;
    IF NEW.manifest IS DISTINCT FROM OLD.manifest
       OR NEW.manifest_hash IS DISTINCT FROM OLD.manifest_hash
       OR NEW.package_hash  IS DISTINCT FROM OLD.package_hash
       OR NEW.meeting_id    IS DISTINCT FROM OLD.meeting_id
       OR NEW.sealed_at     IS DISTINCT FROM OLD.sealed_at THEN
        RAISE EXCEPTION 'Ein gesetztes Siegel wird nicht geändert; einzig der Zeitstempel darf nachkommen.';
    END IF;
    IF OLD.timestamp_state = 'vorhanden' AND NEW.timestamp_state <> 'vorhanden' THEN
        RAISE EXCEPTION 'Ein vorhandener Zeitstempel wird nicht zurückgenommen.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER seal_nur_zeitstempel_trigger
    BEFORE UPDATE OR DELETE ON seal
    FOR EACH ROW EXECUTE FUNCTION seal_nur_zeitstempel();

ALTER TABLE seal ENABLE ROW LEVEL SECURITY;
ALTER TABLE seal FORCE  ROW LEVEL SECURITY;
CREATE POLICY seal_mandant ON seal
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE ON seal TO versammlung_app;

COMMENT ON TABLE seal IS
    'Das Siegel einer Versammlung: Manifest, Prüfsummen und Zeitstempel des Abschlusspakets (FR-51 bis FR-54).';

-- ── Schreibschutz nach dem Versiegeln (FR-55) ─────────────────────────────
--
-- «Der Schutz greift auf Ebene der Datenhaltung, nicht nur in der Oberfläche.»
-- Deshalb ein Auslöser je Tabelle und nicht eine Prüfung in der Anwendung: Wer
-- morgen einen neuen Weg zum Schreiben baut, kommt hier vorbei, ob er will oder
-- nicht.
--
-- **Ausgenommen ist allein das Protokoll** — es ist nicht Teil des Siegels und
-- bleibt änderbar (PRD §4.11). Am Traktandum betrifft das die Spalten
-- `minute_text*`; alles andere daran steht fest.
CREATE OR REPLACE FUNCTION versammlung_versiegelt(kennung uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM meeting WHERE id = kennung AND state = 'versiegelt')
$$;

CREATE OR REPLACE FUNCTION verhindere_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    kennung := COALESCE(NEW.meeting_id, OLD.meeting_id);
    IF versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «%» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP, TG_TABLE_NAME;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER attendance_event_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON attendance_event
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

CREATE TRIGGER proxy_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON proxy
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

CREATE TRIGGER voting_round_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON voting_round
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

CREATE TRIGGER snapshot_party_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON snapshot_party
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

-- Die Stimme kennt die Versammlung nur über ihren Durchgang.
CREATE OR REPLACE FUNCTION vote_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM voting_round
     WHERE id = COALESCE(NEW.round_id, OLD.round_id);
    IF versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «vote» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER vote_nach_siegel_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON vote
    FOR EACH ROW EXECUTE FUNCTION vote_nach_siegel();

-- Am Traktandum bleibt das Protokoll offen, alles andere steht fest.
CREATE OR REPLACE FUNCTION agenda_item_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT versammlung_versiegelt(COALESCE(NEW.meeting_id, OLD.meeting_id)) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP <> 'UPDATE' THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «agenda_item» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;
    -- Erlaubt bleibt einzig das Protokoll: Es ist nicht Teil des Siegels.
    IF to_jsonb(NEW) - 'minute_text' - 'minute_text_changed_at' - 'minute_text_changed_by' - 'updated_at'
       IS DISTINCT FROM
       to_jsonb(OLD) - 'minute_text' - 'minute_text_changed_at' - 'minute_text_changed_by' - 'updated_at' THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. Am Traktandum lässt sich nur noch die Protokollnotiz ändern (FR-55).';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_item_nach_siegel_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_item_nach_siegel();

GRANT EXECUTE ON FUNCTION versammlung_versiegelt(uuid) TO versammlung_app;
