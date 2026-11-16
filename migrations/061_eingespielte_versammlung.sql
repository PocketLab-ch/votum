-- Eine im lokalen Betrieb geführte Versammlung auf den Server bringen
-- (offene Frage 1 des PRD, §13; Notiz bei FR-68).
--
-- **Aufgenommen wird das Paket als Ganzes, nicht seine Zeilen.** Zwei Gründe,
-- und beide sind zwingend:
--
--   1. **Der Schreibschutz spricht dagegen.** Migration 039 verbietet jede
--      Einfügung an einer versiegelten Versammlung — auf Ebene der Datenhaltung,
--      absichtlich. Zeilen nachzubauen hiesse, sie zuerst offen anzulegen und
--      danach zu versiegeln; dazwischen läge ein Fenster, in dem der Nachweis
--      änderbar wäre.
--   2. **Eine Zweitschrift wäre vom Siegel nicht gedeckt.** Das Siegel gilt für
--      das Paket. Nachgebaute Zeilen daneben sind eine zweite Wahrheit, die ab
--      dem ersten Tag auseinanderlaufen kann, ohne dass es jemand merkt.
--
-- Deshalb: Das Paket liegt in der Dateiablage, hier steht der Nachweis, dass es
-- zu dieser Gemeinschaft gehört und geprüft wurde. Was in ihm steht, wird beim
-- Anzeigen aus ihm gelesen — nie aus einer Kopie.

CREATE TABLE imported_meeting (
    id               uuid PRIMARY KEY,
    operator_id      uuid NOT NULL REFERENCES operator (id),
    stweg_id         uuid NOT NULL,

    -- Die Kennung der Versammlung, wie sie im Manifest steht. Sie stammt vom
    -- Notebook und ist dort die `meeting.id` gewesen.
    meeting_key      uuid NOT NULL,

    -- Das Siegel: die Prüfsumme über `manifest.json`. Der Wert, an dem sich das
    -- Paket später wiedererkennen lässt.
    seal_hash        text NOT NULL CHECK (seal_hash ~ '^[0-9a-f]{64}$'),

    -- Das Manifest, wie es im Paket steht — unverändert. Daraus kommen Datum,
    -- Ort, Art und Stufe für die Übersicht, ohne dass das Paket dafür jedes Mal
    -- geöffnet werden muss.
    manifest         jsonb NOT NULL,

    -- Prüfsumme des Pakets in der Dateiablage (AD-17: der Dateiname **ist** die
    -- Prüfsumme). Nicht dieselbe wie `seal_hash`: Diese gilt fürs ZIP, jene für
    -- das Manifest darin.
    package_checksum text NOT NULL CHECK (package_checksum ~ '^[0-9a-f]{64}$'),
    package_size     bigint NOT NULL,

    imported_at      timestamptz NOT NULL DEFAULT now(),
    imported_by      text NOT NULL,

    -- Woher es kam, in Worten der einspielenden Person: «Notebook Saal»,
    -- «USB-Stick der Protokollführung». Steht später im Verlauf und auf der Seite.
    origin_note      text,

    -- Der zusammengesetzte Schlüssel wie überall: Eine Gemeinschaft eines
    -- fremden Betreibers lässt sich damit gar nicht erst benennen.
    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),

    -- **Dasselbe Paket ergibt keinen zweiten Eintrag.** Wer zweimal einspielt,
    -- soll das erfahren und nicht eine Versammlung doppelt in der Historie
    -- finden.
    UNIQUE (operator_id, meeting_key)
);

CREATE INDEX imported_meeting_stweg_idx ON imported_meeting (stweg_id, imported_at DESC);

ALTER TABLE imported_meeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_meeting FORCE  ROW LEVEL SECURITY;
CREATE POLICY imported_meeting_mandant ON imported_meeting
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- **Kein UPDATE, kein DELETE.** Ein eingespieltes Paket ist ein Nachweis; wer
-- ihn ändern könnte, hätte keinen. Ein Fehleintrag wird nicht korrigiert,
-- sondern bleibt stehen — sonst wäre die Aufnahme selbst nicht belegbar.
GRANT SELECT, INSERT ON imported_meeting TO versammlung_app;

CREATE OR REPLACE FUNCTION eingespieltes_bleibt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'Ein eingespieltes Abschlusspaket wird nicht geändert und nicht gelöscht (%).', TG_OP;
END;
$$;

CREATE TRIGGER imported_meeting_bleibt
    BEFORE UPDATE OR DELETE ON imported_meeting
    FOR EACH ROW EXECUTE FUNCTION eingespieltes_bleibt();

COMMENT ON TABLE imported_meeting IS
    'Eine anderswo geführte und dort versiegelte Versammlung, hier als Paket aufgenommen (PRD §13, Rückführung aus dem lokalen Betrieb).';
COMMENT ON COLUMN imported_meeting.meeting_key IS
    'Die Kennung der Versammlung aus dem Manifest — dieselbe, unter der sie auf dem Notebook lief.';
COMMENT ON COLUMN imported_meeting.package_checksum IS
    'Prüfsumme des ZIP in der Dateiablage. Das Paket selbst liegt dort, nicht in der Datenbank.';
