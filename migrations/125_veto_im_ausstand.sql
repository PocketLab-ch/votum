-- 125 — Veto im Ausstand: Betroffene entscheiden über ihr Veto
--
-- Auftrag `.auftraege/2026-09-26-veto-im-ausstand.md`, Produktentscheide vom
-- 26.09.2026. Eine Betroffene im Ausstand kann im Saal über ihr Veto nach
-- ZGB Art. 712g Abs. 4 entscheiden (zustimmen oder nicht), am eigenen
-- Telefon oder mündlich, von der Sitzungsleitung erfasst. Der Entscheid
-- zählt nur für das Veto, nie für die Mehrheit.
--
-- **Der Speicherort ist eine eigene Tabelle, getrennt von `vote`.** Ein
-- Eintrag in `vote` zählte bei der Mehrheit; das Veto ist keine Stimme,
-- sondern die Zustimmung, die nach ZGB Art. 712g Abs. 4 als eigene
-- Voraussetzung neben der Mehrheit steht. Bis hierher zählte im Ausstand
-- allein der Vorab-Vermerk (`agenda_item_affected.vorab_vermerk`, Migration
-- 124); die Entscheidung am Telefon oder im Saal hatte keinen Ort.
--
-- **Je Durchgang, wie die Stimme.** Der Durchgang misst an dem, was während
-- seiner offenen Zeit entschieden wurde; eine Neuabstimmung beginnt mit
-- einem neuen Durchgang und einem leeren Veto-Stand. Beim Schliessen wird
-- der letzte Entscheid je Partei in `voting_round.affected_json`
-- festgeschrieben, wie die Betroffenen selbst (Migration 124).

-- ── Der Veto-Entscheid ─────────────────────────────────────────────────────
--
-- Anfügend, nie ändernd (AD-5, wie `vote`): Eine Berichtigung erzeugt eine
-- neue Zeile; gezählt wird der letzte Entscheid je Partei. Wer die alte
-- überschriebe, könnte später nicht mehr zeigen, dass berichtigt wurde —
-- und genau das ist die Frage, wenn ein Beschluss angefochten wird.
CREATE TABLE veto (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id     uuid NOT NULL REFERENCES operator (id),
    round_id        uuid NOT NULL,

    -- Die Betroffene, auf der Momentaufnahme (AD-3), wie bei `vote`.
    snapshot_party_id uuid NOT NULL,

    -- Ja heisst Zustimmung, Nein heisst fehlende Zustimmung. Ob ein früherer
    -- Vorab-Vermerk dadurch widerrufen wird, rechnet der Kern: Die jüngste
    -- Äusserung gilt (Produktentscheid 25.09.2026).
    entscheid text NOT NULL,

    -- Der Weg, auf dem der Entscheid gekommen ist (Auftrag, Punkt 1):
    -- am Telefon oder mündlich über die Sitzungsleitung.
    weg text NOT NULL,

    -- Wer erfasst hat, im Klartext: am Telefon die Partei selbst oder die
    -- Vertretung, in der Leitung die Sitzungsleitung. Eingefroren wie der
    -- Vermerk der Vorab-Zustimmung; die Besetzung der Sitzungsleitung von
    -- damals lässt sich später nicht rekonstruieren.
    erfasst_durch   text NOT NULL,

    -- Die Partei, die das Veto aufgrund einer Vollmacht ausgeübt hat. NULL
    -- heisst: die Betroffene selbst. Nur beim Abweichen gesetzt, wie
    -- `vote.cast_by_party_id` (Migration 038): Ein Wert, der in neun von zehn
    -- Zeilen dasselbe wiederholt, verdeckt die Ausnahme, statt sie zu zeigen.
    cast_by_party_id uuid,

    erfasst_am      timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (round_id, operator_id) REFERENCES voting_round (id, operator_id)
        ON DELETE CASCADE,
    FOREIGN KEY (snapshot_party_id, operator_id)
        REFERENCES snapshot_party (id, operator_id),
    FOREIGN KEY (cast_by_party_id, operator_id)
        REFERENCES snapshot_party (id, operator_id),

    CONSTRAINT veto_entscheid CHECK (entscheid IN ('ja', 'nein')),
    CONSTRAINT veto_weg CHECK (weg IN ('telefon', 'leitung')),
    -- Sich selbst vertritt niemand: Steht hier die eigene Partei, wäre die
    -- Angabe eine leere Behauptung (dieselbe Regel wie bei `vote`).
    CONSTRAINT veto_ausuebende_ist_andere
        CHECK (cast_by_party_id IS NULL OR cast_by_party_id <> snapshot_party_id),
    -- Und nicht beides: Wer über eine Vollmacht ausübt, tut es selbst — die
    -- Sitzungsleitung erfasst dann nicht.
    CONSTRAINT veto_vollmacht_oder_leitung
        CHECK (cast_by_party_id IS NULL OR weg = 'telefon')
);

CREATE INDEX veto_runde_idx ON veto (round_id, snapshot_party_id, erfasst_am, id);

ALTER TABLE veto ENABLE ROW LEVEL SECURITY;
ALTER TABLE veto FORCE ROW LEVEL SECURITY;
CREATE POLICY veto_mandant ON veto
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Weder ändern noch löschen. Die Zeile ist der Beleg (wie `vote`).
-- Migration 002 vergibt DELETE und UPDATE über die Default Privileges; hier
-- werden sie ausdrücklich entzogen.
REVOKE UPDATE, DELETE ON veto FROM versammlung_app;

COMMENT ON TABLE veto IS
    'Der Veto-Entscheid einer Betroffenen im Ausstand je Durchgang (ZGB Art. 712g Abs. 4). Anfügend; gezählt wird der letzte Entscheid je Partei.';
COMMENT ON COLUMN veto.erfasst_durch IS
    'Wer den Entscheid erfasst hat: am Telefon die Partei selbst oder die Vertretung, in der Leitung die Sitzungsleitung.';
COMMENT ON COLUMN veto.cast_by_party_id IS
    'Die Partei, die das Veto aufgrund einer Vollmacht ausgeübt hat. NULL heisst: die Betroffene selbst.';

-- ── Schreibschutz nach Siegel und Abgabe ───────────────────────────────────
--
-- **Eine neue Schreibstelle erbt die Schranken nicht.** Der Anlass ist
-- derselbe wie bei `agenda_item_affected` (Migration 124) und `vote`
-- (Migrationen 039, 117): Der Schreibweg läuft im Saal, also nach dem
-- Versiegeln und während einer Abgabe an ein anderes Gerät. Der Schutz
-- gehört in die Datenhaltung, nicht bloss in die Anwendung.
--
-- Die Tabelle kennt die Versammlung nur über ihren Durchgang, dasselbe
-- Verhältnis wie bei `vote`.
CREATE OR REPLACE FUNCTION veto_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM voting_round
     WHERE id = COALESCE(NEW.round_id, OLD.round_id);
    IF versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «veto» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER veto_nach_siegel_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON veto
    FOR EACH ROW EXECUTE FUNCTION veto_nach_siegel();

CREATE OR REPLACE FUNCTION veto_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM voting_round
     WHERE id = COALESCE(NEW.round_id, OLD.round_id);
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «veto» würde eine zweite Fassung erzeugen.',
            TG_OP
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER veto_bei_abgabe_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON veto
    FOR EACH ROW EXECUTE FUNCTION veto_bei_abgabe();

-- ── Der eingefrorene Stand beim Schliessen ─────────────────────────────────
--
-- `voting_round.affected_json` trägt seit Migration 124 je Betroffenen
-- `{parteiId, vorab}`. Es kommt ein optionales `veto` dazu:
-- `{entscheid, weg, durchVertretung}` oder `null`. Fehlt das Feld, ist der
-- Durchgang vor dieser Migration geschlossen worden; dann gab es keinen
-- Veto-Entscheid. Eine eigene Spalte wäre eine zweite Fassung desselben
-- Standes; der Stand gehört an die Stelle, an der er schon steht.
COMMENT ON COLUMN voting_round.affected_json IS
    'Die beim Schliessen festgeschriebenen Betroffenen samt Vorab-Vermerk und Veto-Entscheid, [{parteiId, vorab, veto}]. NULL bei Durchgängen, die vor Migration 124 geschlossen wurden; dort wird agenda_item_affected gelesen.';
