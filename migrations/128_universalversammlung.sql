-- 128 — Die Universalversammlung als Ausnahme bei nicht angekündigten Geschäften
--
-- **Dritter Block des Auftrags «Ausnahmen bei nicht angekündigten
-- Geschäften».** Migration 126 hat die Einstellung an der Gemeinschaft
-- angelegt, Migration 127 sie in die Momentaufnahme eingefroren und die
-- Ausnahme des Reglements wirksam gemacht. Hier wirkt die zweite: Sind alle
-- Eigentümer da und widerspricht niemand, entscheidet die Versammlung auch über
-- ein Geschäft, das nicht auf der versandten Liste stand (SVIT-Kommentar
-- Rz. 5a, 28, 39 und 84 ad Art. 712n).
--
-- **Am Durchgang, nicht am Traktandum.** Ob die Versammlung als
-- Universalversammlung tagt, entscheidet sich je Abstimmung: beim Eröffnen
-- (alle da, Bestätigung der Leitung), während sie läuft (Widerspruch) und beim
-- Schliessen (niemand ist gegangen, ohne abzustimmen). Das Traktandum trägt
-- nur, worauf es sich stützt (`agenda_item.unannounced_basis`, Migration 127).

-- ── Am Durchgang ───────────────────────────────────────────────────────────
--
-- Welche Variante galt, eingefroren beim Eröffnen. NULL bei jedem Durchgang,
-- der sich nicht auf die Universalversammlung stützt.
ALTER TABLE voting_round ADD COLUMN universal_mode text;
ALTER TABLE voting_round ADD CONSTRAINT voting_round_universal_variante
    CHECK (universal_mode IS NULL OR universal_mode IN ('persoenlich', 'vertreten'));

-- Die Bestätigung der Leitung: Sie hat nach einem Widerspruch gefragt, und
-- niemand hat widersprochen (Fachprüfung 29.09.2026, Runde 2, Stelle 3). Im
-- Anfechtungsfall ist dieser Vermerk das Beweismittel (Rz. 70 ad Art. 712n);
-- deshalb Zeit und Person im Klartext, wie `veto.erfasst_durch`.
ALTER TABLE voting_round ADD COLUMN universal_confirmed_at timestamptz;
ALTER TABLE voting_round ADD COLUMN universal_confirmed_by text;
ALTER TABLE voting_round ADD CONSTRAINT voting_round_universal_bestaetigt
    CHECK (universal_mode IS NULL
           OR (universal_confirmed_at IS NOT NULL
               AND length(btrim(coalesce(universal_confirmed_by, ''))) > 0));

-- Der Widerspruch nach dem Eröffnen: Wer, wann, wer ihn erfasst hat. Die
-- Partei auf der Momentaufnahme, wie bei `vote`, und der Name eingefroren, weil
-- er so im Protokoll steht. Nur einer je Durchgang: Schon der erste verhindert
-- den Beschluss, ein zweiter änderte daran nichts.
ALTER TABLE voting_round ADD COLUMN universal_objection_at timestamptz;
ALTER TABLE voting_round ADD COLUMN universal_objection_party_id uuid;
ALTER TABLE voting_round ADD COLUMN universal_objection_name text;
ALTER TABLE voting_round ADD COLUMN universal_objection_by text;
ALTER TABLE voting_round ADD CONSTRAINT voting_round_widerspruch_partei
    FOREIGN KEY (universal_objection_party_id, operator_id)
    REFERENCES snapshot_party (id, operator_id);
ALTER TABLE voting_round ADD CONSTRAINT voting_round_widerspruch_nur_universal
    CHECK (universal_objection_at IS NULL
           OR (universal_mode IS NOT NULL
               AND universal_objection_party_id IS NOT NULL
               AND universal_objection_name IS NOT NULL
               AND universal_objection_by IS NOT NULL));

-- Was das Protokoll über die Universalversammlung sagt, beim Schliessen
-- festgeschrieben wie `attendance_json`: Anzahl der Parteien, die Vertretenen
-- mit ihren Vertretern, wer abgestimmt hat und danach ging. Beim Schliessen,
-- weil es der Stand dieses Augenblicks ist (AD-16).
ALTER TABLE voting_round ADD COLUMN universal_json jsonb;

-- Ein Widerspruch wird nur bei offener Abstimmung festgehalten. Danach ist die
-- Beschlussfassung vorbei (BGE 136 III 174: «vor der Beschlussfassung»), und
-- ein späterer Eintrag änderte ein verkündetes Ergebnis.
CREATE OR REPLACE FUNCTION widerspruch_nur_offen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.universal_objection_at IS DISTINCT FROM OLD.universal_objection_at
       AND (OLD.state <> 'offen' OR OLD.universal_objection_at IS NOT NULL) THEN
        RAISE EXCEPTION
            'Ein Widerspruch lässt sich nur einmal und nur während der offenen Abstimmung festhalten.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'voting_round_widerspruch_offen';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_widerspruch_offen
    BEFORE UPDATE OF universal_objection_at ON voting_round
    FOR EACH ROW EXECUTE FUNCTION widerspruch_nur_offen();

-- ── Die Grundlage des Vermerks ─────────────────────────────────────────────
--
-- Migration 127 prüfte nur `reglement`. Ein Vermerk `universal` steht nur, wenn
-- die Momentaufnahme die Universalversammlung nicht ausschliesst. Ob im Moment
-- alle da sind, prüft die Anwendung beim Aufnehmen und beim Eröffnen: Das ist
-- ein Stand im Saal, keine Eigenschaft der Zeile.
CREATE OR REPLACE FUNCTION agenda_ausnahme_traegt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.unannounced_basis = 'reglement' AND NOT EXISTS (
        SELECT 1 FROM snapshot s
        WHERE s.meeting_id = NEW.meeting_id AND s.unannounced_bylaw_allowed
    ) THEN
        RAISE EXCEPTION 'Das Reglement dieser Versammlung gestattet keine Beschlüsse über nicht angekündigte Gegenstände.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_ausnahme_ohne_grundlage';
    END IF;
    IF NEW.unannounced_basis = 'universal' AND NOT EXISTS (
        SELECT 1 FROM snapshot s
        WHERE s.meeting_id = NEW.meeting_id AND s.universal_meeting_mode <> 'keine'
    ) THEN
        RAISE EXCEPTION 'Diese Gemeinschaft hält keine Universalversammlung ab.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_ausnahme_ohne_grundlage';
    END IF;
    RETURN NEW;
END;
$$;

-- ── Wer als Sitzungsleitung oder Verwaltung vertritt ───────────────────────
--
-- Votum weiss nicht, wer die Sitzung leitet: `meeting.chair_label` ist
-- Freitext. Die Einstellung «Vollmachten der Leitung zählen nicht» (Migration
-- 126) braucht aber genau das. Die Leitung kreuzt deshalb einmal je
-- Versammlung an, welche Vertreter für sie oder die Verwaltung handeln, und
-- kann es während der Versammlung ändern (Fachprüfung 29.09.2026, Runde 2,
-- Stelle 9): Eine Vollmacht, die in der Pause dazukommt, ist mit dem
-- Schlüssel des Namens ohne Weiteres erfasst (`vollmachtsschluessel`).
CREATE TABLE meeting_chair_holder (
    meeting_id   uuid NOT NULL,
    operator_id  uuid NOT NULL REFERENCES operator (id),
    holder_key   text NOT NULL,
    holder_label text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   text NOT NULL,
    PRIMARY KEY (meeting_id, holder_key),
    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE,
    CONSTRAINT meeting_chair_holder_schluessel CHECK (length(holder_key) > 0)
);

ALTER TABLE meeting_chair_holder ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chair_holder FORCE ROW LEVEL SECURITY;
CREATE POLICY meeting_chair_holder_mandant ON meeting_chair_holder
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Geändert wird durch Löschen und Neuanlegen; UPDATE braucht es nicht.
REVOKE UPDATE ON meeting_chair_holder FROM versammlung_app;

-- **Eine neue Schreibstelle erbt die Schranken nicht** (wie `veto`,
-- Migration 125). Die Liste wird im Saal geschrieben, also gehört der Schutz
-- nach Siegel und Abgabe in die Datenhaltung.
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
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER meeting_chair_holder_geschuetzt
    BEFORE INSERT OR DELETE ON meeting_chair_holder
    FOR EACH ROW EXECUTE FUNCTION meeting_chair_holder_geschuetzt();

COMMENT ON TABLE meeting_chair_holder IS
    'Vertreter, die an dieser Versammlung als Sitzungsleitung oder Verwaltung Vollmachten halten. Schlüssel ist der normalisierte Name (vollmachtsschluessel). Wirkt nur bei der Universalversammlung mit Vollmacht (Migration 128).';
COMMENT ON COLUMN voting_round.universal_mode IS
    'Stützt sich der Durchgang auf die Universalversammlung: die Variante der Momentaufnahme beim Eröffnen. Sonst NULL.';
COMMENT ON COLUMN voting_round.supersede_kind IS
    'Warum überholt: korrektur = die Leitung hat eine Neuabstimmung angesetzt (etwa weil der '
    'Durchgang fehlerhaft war) oder, seit Migration 128, nach einem Weggang ohne Beschluss neu '
    'eröffnet; rueckkommen = durch den Beschluss nach Rückkommen ersetzt; '
    'rueckkommen_erfolglos = Rückkommen ohne neuen Beschluss, der frühere gilt.';
COMMENT ON COLUMN voting_round.universal_json IS
    'Beim Schliessen festgeschrieben: was das Protokoll über die Universalversammlung sagt (Anzahl, Vertretene, wer nach der Stimmabgabe ging). Nur bei universal_mode.';
