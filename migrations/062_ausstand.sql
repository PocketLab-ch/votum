-- Der Ausstand (PRD §13; ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
--
-- Wer bei einem Geschäft in eigener Sache in den Ausstand tritt, ist vom
-- Stimmrecht ausgeschlossen: Er stimmt nicht, und er zählt nicht mit — weder
-- bei den Köpfen noch bei den Wertquoten.
--
-- **Warum eine eigene Tabelle und nicht ein Merkmal an der Stimme.** Der
-- Ausstand ist keine Stimme, auch keine leere. Als Stimmwert geführt, läge er
-- in einem Eimer der Auszählung und veränderte damit die Bezugsgrösse nicht —
-- genau das ist aber sein Sinn. Und er gilt **je Traktandum**, nicht je
-- Versammlung: Wer bei der Sanierung seines eigenen Balkons austritt, stimmt
-- beim Budget wieder mit.
--
-- **Der Grund ist Pflicht.** Ein Ausstand ohne Begründung lässt sich später
-- nicht von einem Erfassungsfehler unterscheiden — und er verändert die Zahl,
-- gegen die gemessen wird.

CREATE TABLE recusal (
    id             uuid PRIMARY KEY,
    operator_id    uuid NOT NULL REFERENCES operator (id),
    meeting_id     uuid NOT NULL,
    agenda_item_id uuid NOT NULL,
    -- Die Partei aus der **Momentaufnahme**, nicht aus den lebenden Stammdaten:
    -- Gezählt wird auf der eingefrorenen Fassung (AD-3), und dort ist die
    -- Kennung dieselbe wie in `party`.
    party_id       uuid NOT NULL,

    grund          text NOT NULL CHECK (length(btrim(grund)) >= 3),

    erklaert_am    timestamptz NOT NULL DEFAULT now(),
    erklaert_durch text NOT NULL,

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),

    -- Zweimal derselbe Ausstand ist keiner. Wer ihn zurücknimmt, löscht die
    -- Zeile; der Verlauf hält beides fest.
    UNIQUE (agenda_item_id, party_id)
);

CREATE INDEX recusal_traktandum_idx ON recusal (agenda_item_id);

ALTER TABLE recusal ENABLE ROW LEVEL SECURITY;
ALTER TABLE recusal FORCE  ROW LEVEL SECURITY;
CREATE POLICY recusal_mandant ON recusal
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, DELETE ON recusal TO versammlung_app;

-- Nach dem Versiegeln steht auch das fest (FR-55). Derselbe Auslöser wie bei
-- Anwesenheit, Vollmacht und Stimmen: Der Schutz greift in der Datenhaltung,
-- nicht bloss in der Oberfläche.
CREATE TRIGGER recusal_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON recusal
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

COMMENT ON TABLE recusal IS
    'Ausstand je Traktandum: wer vom Stimmrecht ausgeschlossen ist und warum (ZGB Art. 68 i.V.m. Art. 712m Abs. 2).';
COMMENT ON COLUMN recusal.grund IS
    'Pflicht. Ohne ihn liesse sich ein Ausstand später nicht von einem Erfassungsfehler unterscheiden.';
