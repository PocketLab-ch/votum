-- 178 — Die Weisung verweist nur auf Zeilen ihres eigenen Betreibers
--
-- **Der Anlass** ist Block D aus Auftrag 2d (28.10.2026): Migration 027 band
-- `meeting_id`, `agenda_item_id` und `source_voting_round_id` nur an die
-- `id` der Zieltabelle. Ein einfacher Fremdschlüssel prüft die Existenz, nicht
-- den Betreiber, und er sieht am Zeilenschutz vorbei. Die Anwendung prüft
-- selbst (`weisung.ts`); diese Schlüssel sind die zweite Linie, nach dem
-- Muster von Migration 176. Eine Verletzung kommt beim Benutzer als Absage an,
-- nicht als 500 (`db.ts · fehlenderVerweis`, das Schlüssel mit `operator_id`
-- im Katalog nachschlägt).
--
-- **Im Umfang von Block D bleiben drei Verweise einfach**, weil ihre
-- Zieltabelle keinen Schlüssel `(id, operator_id)` trägt und einer erst
-- angelegt werden müsste: `instruction.party_id` (`party` trägt nur
-- `(id, stweg_id)`), `instruction.superseded_by` (`instruction` trägt nur den
-- Primärschlüssel) und `meeting_handover.device_id` (`handover_device` trägt
-- neben dem Primärschlüssel nur `(operator_id, fingerprint)`). Aus demselben
-- Grund blieb `agenda_item.proposer_party_id` in Migration 176 einfach. Alle
-- vier stehen als Pendenz in `docs/pendenzen-sicherheit.md`, «Einfache
-- Fremdschlüssel». `instruction.source_meeting_id` hat gar keinen Schlüssel;
-- die Anwendung leitet den Wert aus der Abstimmungsrunde ab (`weisung.ts`),
-- und die bindet jetzt an den Betreiber.
--
-- Bestand vor dem Umbau, lesend gezählt am 29.10.2026: Dev 0 Weisungen, Prod
-- 0 Weisungen, also kein fremder Verweis. Trüge eine Zeile einen, bräche diese
-- Migration ab, und das ist gewollt: Eine solche Zeile ist zu klären, nicht
-- still zu übernehmen.
--
-- `ON DELETE` bleibt, wie es war. `source_voting_round_id` darf leer sein; ein
-- zusammengesetzter Schlüssel prüft dann nichts (MATCH SIMPLE), wie bisher.

ALTER TABLE instruction DROP CONSTRAINT instruction_meeting_id_fkey;
ALTER TABLE instruction
    ADD CONSTRAINT instruction_meeting_gleicher_betreiber
    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE;

ALTER TABLE instruction DROP CONSTRAINT instruction_agenda_item_id_fkey;
ALTER TABLE instruction
    ADD CONSTRAINT instruction_traktandum_gleicher_betreiber
    FOREIGN KEY (agenda_item_id, operator_id) REFERENCES agenda_item (id, operator_id) ON DELETE CASCADE;

ALTER TABLE instruction DROP CONSTRAINT instruction_source_voting_round_id_fkey;
ALTER TABLE instruction
    ADD CONSTRAINT instruction_runde_gleicher_betreiber
    FOREIGN KEY (source_voting_round_id, operator_id) REFERENCES voting_round (id, operator_id) ON DELETE RESTRICT;
