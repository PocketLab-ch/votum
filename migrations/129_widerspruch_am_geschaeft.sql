-- 129 — Der Widerspruch gehört ans Geschäft; die Vertreter der Leitung mit Zeit
--
-- Auftrag `.auftraege/2026-09-29-votum-universalversammlung-rest.md`, Block 4a,
-- Produktentscheid 29.09.2026: «Der Widerspruch vor dem Eröffnen wird
-- festgehalten.» Migration 128 kannte ihn nur nach dem Eröffnen, am Durchgang.
--
-- **Eine Stelle für beide Zeitpunkte.** Vor dem Eröffnen gibt es keinen
-- Durchgang; hielte man den frühen Widerspruch anderswo fest als den späten,
-- prüfte das Eröffnen die eine Stelle und die Leitungsseite die andere. Genau
-- dieser Befund kam in Block 3 zweimal. Der Widerspruch zieht deshalb vom
-- Durchgang an das Geschäft um, und die Spalten an `voting_round` fallen weg,
-- statt als zweite Wahrheit stehen zu bleiben. Migration 128 bleibt, wie sie
-- ist (eingespielt, AD-14); die Daten wandern hier herüber.
--
-- **Einer je Geschäft**, nicht je Durchgang: Schon der erste Widerspruch hebt
-- die Universalversammlung für dieses Geschäft auf (Laienprüfung Block 3, L22),
-- ein zweiter änderte daran nichts. Der Primärschlüssel sagt das.

-- ── Der Widerspruch ────────────────────────────────────────────────────────
CREATE TABLE universal_objection (
    agenda_item_id    uuid PRIMARY KEY,
    meeting_id        uuid NOT NULL,
    operator_id       uuid NOT NULL REFERENCES operator (id),

    -- Während welcher Abstimmung. NULL heisst: vor dem Eröffnen.
    round_id          uuid,

    -- Wer widersprochen hat, auf der Momentaufnahme wie bei `vote`, und der
    -- Name eingefroren, weil er so im Protokoll steht.
    snapshot_party_id uuid NOT NULL,
    party_name        text NOT NULL,

    objected_at       timestamptz NOT NULL DEFAULT now(),
    -- Wer ihn erfasst hat, im Klartext wie `veto.erfasst_durch`.
    recorded_by       text NOT NULL,

    -- Mit dem Geschäft und dem Durchgang weg, wie `veto` (Migration 125) und
    -- `voting_round` selbst: Sonst bräche das endgültige Löschen nach Frist
    -- (`versammlungen_endgueltig_loeschen`, Migrationen 113, 115) an jeder
    -- Versammlung mit Widerspruch ab (Codeprüfung Block 4a, H-1). Die Anwendung
    -- löscht ein Geschäft nur im Entwurf, ein Widerspruch entsteht nur, während
    -- die Versammlung läuft; die Kaskade nimmt also keinen Beleg weg.
    FOREIGN KEY (agenda_item_id, meeting_id) REFERENCES agenda_item (id, meeting_id)
        ON DELETE CASCADE,
    FOREIGN KEY (agenda_item_id, operator_id) REFERENCES agenda_item (id, operator_id)
        ON DELETE CASCADE,
    FOREIGN KEY (snapshot_party_id, meeting_id) REFERENCES snapshot_party (id, meeting_id),
    FOREIGN KEY (round_id, operator_id) REFERENCES voting_round (id, operator_id)
        ON DELETE CASCADE,
    CONSTRAINT universal_objection_name CHECK (length(btrim(party_name)) > 0),
    CONSTRAINT universal_objection_erfasst CHECK (length(btrim(recorded_by)) > 0)
);

CREATE INDEX universal_objection_versammlung_idx ON universal_objection (meeting_id);
CREATE UNIQUE INDEX universal_objection_je_durchgang ON universal_objection (round_id)
    WHERE round_id IS NOT NULL;

ALTER TABLE universal_objection ENABLE ROW LEVEL SECURITY;
ALTER TABLE universal_objection FORCE ROW LEVEL SECURITY;
CREATE POLICY universal_objection_mandant ON universal_objection
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Weder ändern noch löschen: Die Zeile ist der Beleg (wie `veto`, Migration
-- 125). Im Anfechtungsfall ist sie das, was die Leitung vorlegt.
REVOKE UPDATE, DELETE ON universal_objection FROM versammlung_app;

-- ── Der Bestand aus Migration 128 ──────────────────────────────────────────
--
-- Vor dem Auslöser unten, der nur offene Durchgänge annimmt. Je Geschäft der
-- früheste, falls es je zwei gäbe; das Eröffnen sperrte schon nach dem ersten.
INSERT INTO universal_objection
    (agenda_item_id, meeting_id, operator_id, round_id, snapshot_party_id, party_name,
     objected_at, recorded_by)
SELECT DISTINCT ON (r.agenda_item_id)
       r.agenda_item_id, r.meeting_id, r.operator_id, r.id, r.universal_objection_party_id,
       r.universal_objection_name, r.universal_objection_at, r.universal_objection_by
  FROM voting_round r
 WHERE r.universal_objection_at IS NOT NULL
 ORDER BY r.agenda_item_id, r.universal_objection_at;

DROP TRIGGER voting_round_widerspruch_offen ON voting_round;
DROP FUNCTION widerspruch_nur_offen();
ALTER TABLE voting_round DROP CONSTRAINT voting_round_widerspruch_nur_universal;
ALTER TABLE voting_round DROP CONSTRAINT voting_round_widerspruch_partei;
ALTER TABLE voting_round DROP COLUMN universal_objection_at;
ALTER TABLE voting_round DROP COLUMN universal_objection_party_id;
ALTER TABLE voting_round DROP COLUMN universal_objection_name;
ALTER TABLE voting_round DROP COLUMN universal_objection_by;

-- ── Wann ein Widerspruch festgehalten werden kann ──────────────────────────
--
-- Die Regeln von `widerspruch_nur_offen` (Migration 128) für den späten Fall,
-- dazu der Zeitpunkt des frühen. Die Anwendung prüft dasselbe mit fachlicher
-- Meldung. **Nicht hier** steht, ob zum Geschäft schon ein Beschluss gilt und
-- ein Rückkommen ihn wieder öffnet: Das rechnet die Anwendung an einer Stelle
-- für Eröffnen und Widerspruch (`rueckkommenZuEroeffnen`), und eine zweite
-- Fassung in SQL liefe ihr davon.
--
--   - Nur an einem Geschäft, das als Universalversammlung aufgenommen ist.
--   - Während einer Abstimmung nur an deren offenem Durchgang, und nur, wenn
--     sie als Universalversammlung eröffnet wurde. Danach ist die
--     Beschlussfassung vorbei (BGE 136 III 174: «vor der Beschlussfassung»).
--   - Vor dem Eröffnen nur, solange die Versammlung läuft und zu diesem
--     Geschäft keine Abstimmung offen ist: Sonst gehört er an den Durchgang,
--     und ohne ihn liesse sich der laufende Durchgang am Beschluss
--     vorbeiführen.
CREATE OR REPLACE FUNCTION widerspruch_zulaessig() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    r record;
BEGIN
    IF versammlung_versiegelt(NEW.meeting_id) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. INSERT an «universal_objection» wäre eine Änderung am Nachweis (FR-55).';
    END IF;
    IF versammlung_abgegeben(NEW.meeting_id) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. INSERT an «universal_objection» würde eine zweite Fassung erzeugen.'
            USING ERRCODE = 'VO117';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM agenda_item a
         WHERE a.id = NEW.agenda_item_id AND a.meeting_id = NEW.meeting_id
           AND a.unannounced_basis = 'universal'
    ) THEN
        RAISE EXCEPTION 'Ein Widerspruch gegen die Universalversammlung gehört an ein Geschäft, das so aufgenommen ist.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'universal_objection_zeitpunkt';
    END IF;
    IF NEW.round_id IS NOT NULL THEN
        SELECT state, universal_mode, agenda_item_id, meeting_id INTO r
          FROM voting_round WHERE id = NEW.round_id;
        IF r.agenda_item_id IS DISTINCT FROM NEW.agenda_item_id
           OR r.meeting_id IS DISTINCT FROM NEW.meeting_id
           OR r.state <> 'offen' OR r.universal_mode IS NULL THEN
            RAISE EXCEPTION 'Ein Widerspruch lässt sich nur während der offenen Abstimmung als Universalversammlung festhalten.'
                USING ERRCODE = 'check_violation', CONSTRAINT = 'universal_objection_zeitpunkt';
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 FROM meeting m WHERE m.id = NEW.meeting_id AND m.state = 'laufend'
    ) THEN
        RAISE EXCEPTION 'Ein Widerspruch wird festgehalten, während die Versammlung läuft.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'universal_objection_zeitpunkt';
    ELSIF EXISTS (
        SELECT 1 FROM voting_round v
         WHERE v.agenda_item_id = NEW.agenda_item_id AND v.state = 'offen'
    ) THEN
        RAISE EXCEPTION 'Zu diesem Geschäft ist eine Abstimmung offen; der Widerspruch gehört an sie.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'universal_objection_zeitpunkt';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER universal_objection_zulaessig
    BEFORE INSERT ON universal_objection
    FOR EACH ROW EXECUTE FUNCTION widerspruch_zulaessig();

COMMENT ON TABLE universal_objection IS
    'Widerspruch einer Partei gegen die Beschlussfassung als Universalversammlung, einer je Geschäft (Migration 129). round_id NULL: vor dem Eröffnen.';
COMMENT ON COLUMN universal_objection.round_id IS
    'Der offene Durchgang, während dem widersprochen wurde. NULL heisst: vor dem Eröffnen.';

-- ── Die Vertreter der Sitzungsleitung mit Zeit ─────────────────────────────
--
-- Bis hierher wurde die Liste bei jeder Änderung gelöscht und neu geschrieben
-- und führte keine Zeit (Codeprüfung Block 3, dritter Durchgang, N-f). Wer nach
-- seiner Stimme angekreuzt wurde, dessen Stimme galt beim Schliessen
-- rückwirkend als eine der Leitung. Jetzt wird ein Eintrag beendet statt
-- gelöscht. Gelesen wird die Liste bei der Stimme **und** beim Schliessen
-- (`ladeUniversalquelle`): Die Fachprüfung (Block 4a, Frage 3) hält die
-- rückwirkende Wirkung eines nachträglichen Kreuzes für die richtige, weil es
-- meist eine berichtigte Lücke ist; die Zeit braucht es für die Gegenrichtung,
-- ein Kreuz bei der Stimme, das danach weggenommen wird.
ALTER TABLE meeting_chair_holder DROP CONSTRAINT meeting_chair_holder_pkey;
ALTER TABLE meeting_chair_holder ADD COLUMN id uuid NOT NULL DEFAULT uuidv7();
ALTER TABLE meeting_chair_holder ADD PRIMARY KEY (id);
ALTER TABLE meeting_chair_holder ADD COLUMN ended_at timestamptz;
ALTER TABLE meeting_chair_holder ADD COLUMN ended_by text;
ALTER TABLE meeting_chair_holder ADD CONSTRAINT meeting_chair_holder_ende
    CHECK ((ended_at IS NULL) = (ended_by IS NULL)
           AND (ended_at IS NULL OR ended_at >= created_at));
-- Angekreuzt ist ein Name höchstens einmal zugleich; wieder angekreuzt wird
-- mit einer neuen Zeile.
CREATE UNIQUE INDEX meeting_chair_holder_je_name ON meeting_chair_holder (meeting_id, holder_key)
    WHERE ended_at IS NULL;

-- Nicht mehr löschen; ändern nur das Ende.
REVOKE DELETE ON meeting_chair_holder FROM versammlung_app;
GRANT UPDATE (ended_at, ended_by) ON meeting_chair_holder TO versammlung_app;

-- Das Ende nur einmal: Ein beendeter Eintrag, der wieder aufginge, verschöbe
-- die Zeit, zu der eine Stimme gelesen wird.
CREATE OR REPLACE FUNCTION meeting_chair_holder_geschuetzt() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid := COALESCE(NEW.meeting_id, OLD.meeting_id);
BEGIN
    IF versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «meeting_chair_holder» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «meeting_chair_holder» würde eine zweite Fassung erzeugen.',
            TG_OP
            USING ERRCODE = 'VO117';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.ended_at IS NOT NULL THEN
        RAISE EXCEPTION 'Dieser Vertreter ist schon nicht mehr angekreuzt; wer wieder ankreuzt, legt einen neuen Eintrag an.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'meeting_chair_holder_ende';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER meeting_chair_holder_geschuetzt ON meeting_chair_holder;
CREATE TRIGGER meeting_chair_holder_geschuetzt
    BEFORE INSERT OR UPDATE OR DELETE ON meeting_chair_holder
    FOR EACH ROW EXECUTE FUNCTION meeting_chair_holder_geschuetzt();

COMMENT ON COLUMN meeting_chair_holder.ended_at IS
    'Seit wann nicht mehr angekreuzt. Gelesen wird die Liste bei der Stimme und beim Schliessen (Migration 129).';
