-- 179 — Die letzten einfachen Verweise zwischen Betreibertabellen binden an den Betreiber
--
-- **Der Anlass** ist die Pendenz «Einfache Fremdschlüssel zwischen
-- Mandantentabellen» (`docs/pendenzen-sicherheit.md`). Migrationen 176 und 178
-- liessen vier Verweise einfach, weil ihre Zieltabelle keinen Schlüssel
-- `(id, operator_id)` trug: `instruction.party_id`, `instruction.superseded_by`,
-- `meeting_handover.device_id` und `agenda_item.proposer_party_id`. Ein
-- einfacher Fremdschlüssel prüft die Existenz am Zeilenschutz vorbei, nicht den
-- Betreiber; die Bindung stand nur im Code und im Zeilenschutz der Lesung
-- (`weisung.ts`, `holeGeraet` unter `alsBetreiber`,
-- `verlangeEigentumAmVersammlungstag`). Diese Schlüssel sind die zweite Linie,
-- nach dem Muster von 176 und 178, und eine Verletzung kommt als Absage an,
-- nicht als 500 (`db.ts · fehlenderVerweis`).
--
-- **Ein neuer Schlüssel an der Zieltabelle, keine neue Spalte.** `party`,
-- `instruction` und `handover_device` tragen `operator_id` schon; es fehlte nur
-- die Eindeutigkeit über `(id, operator_id)`, die ein zusammengesetzter
-- Fremdschlüssel als Ziel verlangt. Weil `id` allein schon eindeutig ist, kann
-- keine bestehende Zeile daran scheitern.
--
-- **Warum nicht über `stweg_id`.** `party` trägt `(id, stweg_id)`, und die
-- Partei einer Weisung oder eines Antrags gehört fachlich zur Gemeinschaft der
-- Versammlung. Diese Bindung bräuchte aber eine Spalte `stweg_id` an
-- `instruction` und an `agenda_item`, die es nicht gibt; die Anwendung prüft
-- die Gemeinschaft weiterhin selbst. Ein Saalgerät gehört dem Betreiber, nicht
-- einer Gemeinschaft, und ein Nachfolger einer Weisung hat keine eigene
-- Gemeinschaft: Für beide ist der Betreiber die einzige Bindung.
--
-- Bestand vor dem Umbau, lesend gezählt am 29.10.2026 über alle Betreiber:
-- Dev 0 fremde Verweise (Weisungen 0, Abgaben 2, Anträge mit Eigentümer 2),
-- Prod 0 (an keiner der vier Spalten eine Zeile). Trüge eine Zeile einen fremden
-- Verweis, bräche diese Migration ab, und das ist gewollt: Eine solche Zeile ist
-- zu klären, nicht still zu übernehmen.
--
-- `ON DELETE` bleibt, wie es war. `superseded_by` und `proposer_party_id` dürfen
-- leer sein; ein zusammengesetzter Schlüssel prüft dann nichts (MATCH SIMPLE),
-- wie bisher. Der Berichtigungsweg in `weisung.ts` setzt `superseded_by`
-- kurz auf die eigene Kennung; das trägt auch der neue Schlüssel, die Zeile
-- verweist dann auf sich selbst mit demselben Betreiber.

ALTER TABLE party ADD CONSTRAINT party_id_operator UNIQUE (id, operator_id);
ALTER TABLE instruction ADD CONSTRAINT instruction_id_operator UNIQUE (id, operator_id);
ALTER TABLE handover_device ADD CONSTRAINT handover_device_id_operator UNIQUE (id, operator_id);

ALTER TABLE instruction DROP CONSTRAINT instruction_party_id_fkey;
ALTER TABLE instruction
    ADD CONSTRAINT instruction_partei_gleicher_betreiber
    FOREIGN KEY (party_id, operator_id) REFERENCES party (id, operator_id) ON DELETE RESTRICT;

ALTER TABLE instruction DROP CONSTRAINT instruction_superseded_by_fkey;
ALTER TABLE instruction
    ADD CONSTRAINT instruction_nachfolger_gleicher_betreiber
    FOREIGN KEY (superseded_by, operator_id) REFERENCES instruction (id, operator_id);

ALTER TABLE meeting_handover DROP CONSTRAINT meeting_handover_device_id_fkey;
ALTER TABLE meeting_handover
    ADD CONSTRAINT meeting_handover_geraet_gleicher_betreiber
    FOREIGN KEY (device_id, operator_id) REFERENCES handover_device (id, operator_id);

ALTER TABLE agenda_item DROP CONSTRAINT agenda_item_proposer_party_id_fkey;
ALTER TABLE agenda_item
    ADD CONSTRAINT agenda_item_proposer_party_gleicher_betreiber
    FOREIGN KEY (proposer_party_id, operator_id) REFERENCES party (id, operator_id);
