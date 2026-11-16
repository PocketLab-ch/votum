-- 176 — Die antragstellende Gemeinschaft eines Traktandums gehört demselben Betreiber
--
-- **Der Anlass** ist der Kreuzteil des Fremdbetreiber-Durchstichs (27.10.2026):
-- `traktanden?/anlegen` und `?/speichern` nahmen in einem Traktandum von A eine
-- Gemeinschaft von B als Antragstellerin an. Migration 012 band
-- `proposer_stweg_id` nur an `stweg (id)`; ein einfacher Fremdschlüssel prüft
-- die Existenz, nicht den Betreiber, und er sieht am Zeilenschutz vorbei. Die
-- Anwendung prüft seither selbst (`verlangeWaehlbareUntergemeinschaft`); dieser
-- Schlüssel ist die zweite Linie, wie bei `previous_meeting_id`
-- (Migration 011).
--
-- **`proposer_party_id` bleibt einfach.** `party` trägt keinen Schlüssel
-- `(id, operator_id)`, nur `(id, stweg_id)`. Die Anwendung lehnt eine fremde
-- Partei dort schon ab (`verlangeEigentumAmVersammlungstag`); das Schema dafür
-- ist eine eigene Pendenz (`docs/pendenzen-sicherheit.md`).
--
-- Bestand vor dem Umbau: Dev ohne Traktandum mit fremder Gemeinschaft
-- (28.10.2026). Trüge eine Zeile eine, bräche diese Migration ab, und das ist
-- gewollt: Eine solche Zeile ist zu klären, nicht still zu übernehmen.

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_proposer_stweg_id_fkey;

ALTER TABLE agenda_item
    ADD CONSTRAINT agenda_item_proposer_stweg_gleicher_betreiber
    FOREIGN KEY (proposer_stweg_id, operator_id) REFERENCES stweg (id, operator_id);
