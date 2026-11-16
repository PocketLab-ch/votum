-- Trägerschaft gemäss Grundbuch bei einer Miteigentümergemeinschaft, deren
-- Mitglieder Gemeinschaften sind (Ä-43; Produktentscheid 17.09.2026,
-- `docs/freigabe.md`: «Beim Anlegen kommt ein Pflichtfeld ‹Trägerschaft gemäss
-- Grundbuch› mit den drei Werten und dem Hinweis auf die offene Anwaltsfrage
-- Nr. 16 dazu»).
--
-- Die drei Werte stehen in der Zweitprüfung (`docs/zweitpruefung-2026-09-17.md`,
-- Ä-43); die Fundstelle ad Art. 712l Rz. 75b trägt am Volltext
-- (`docs/abgleich-zweitpruefung-volltext-2026-09-21.md`).
--
-- **Leer für den Bestand, nicht geraten.** Bestehende Anlagen behalten NULL;
-- Pflicht ist der Wert erst beim nächsten Speichern ihrer Angaben, und das
-- verlangt der Kern (`verlangeTraegerschaft`), nicht die Datenbank: Ob
-- Gemeinschaften Mitglied sind, steht in `party`, nicht in dieser Zeile.
--
-- Eine Angabe, keine Rechenregel. Gezählt wird danach nicht anders.

ALTER TABLE stweg ADD COLUMN traegerschaft text;

ALTER TABLE stweg ADD CONSTRAINT stweg_traegerschaft_wert
    CHECK (traegerschaft IS NULL OR traegerschaft IN ('stammgrundstueck', 'stockwerkanteile', 'personen'));

COMMENT ON COLUMN stweg.traegerschaft IS
    'Wer laut Grundbuch den Anteil trägt, wenn Gemeinschaften Mitglied sind (Ä-43): stammgrundstueck (Gemeinschaft des Hauses übt aus), stockwerkanteile (jede Eigentümerin selbst Mitglied), personen (selbstständiges Miteigentum). NULL: nicht erfasst (Bestand vor Migration 163).';
