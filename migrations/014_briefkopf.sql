-- Story 3.6: Briefkopfvorlage des Betreibers (FR-17, AD-14, AD-17).
--
-- Die Vorlage liegt als gewöhnliche Datei in der Ablage, angesprochen über ihre
-- Prüfsumme. Am Betreiber steht nur der Verweis. Damit gilt auch für sie, was
-- für jede Datei gilt: Eine neue Fassung ist eine neue Datei, und ein einmal
-- erzeugtes PDF kann sich nicht rückwirkend ändern.

ALTER TABLE operator
	ADD COLUMN letterhead_checksum text,
	-- Wie viel oben freibleiben muss, damit der Inhalt den Briefkopf nicht
	-- überschreibt. In Millimetern, weil eine Briefkopfvorlage in Millimetern
	-- gestaltet wird und niemand sie in PDF-Punkten ausmisst.
	ADD COLUMN letterhead_top_mm integer NOT NULL DEFAULT 55,
	-- Üblicherweise trägt nur das erste Blatt den vollen Briefkopf. Wer eine
	-- Vorlage mit durchgehendem Rahmen hat, stellt das um.
	ADD COLUMN letterhead_all_pages boolean NOT NULL DEFAULT false;

ALTER TABLE operator
	ADD CONSTRAINT operator_briefkopf_pruefsumme
		CHECK (letterhead_checksum IS NULL OR letterhead_checksum ~ '^[0-9a-f]{64}$'),
	-- Unter 10 mm liesse der Briefkopf keinen Platz, über 150 mm bliebe von einer
	-- A4-Seite nichts mehr übrig.
	ADD CONSTRAINT operator_briefkopf_hoehe
		CHECK (letterhead_top_mm BETWEEN 10 AND 150);
