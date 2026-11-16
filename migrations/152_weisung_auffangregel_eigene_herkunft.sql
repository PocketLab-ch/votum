-- Die Weisung nach der Auffangregel trägt ihre eigene Herkunft
-- (Auftrag 08.10.2026, «votum-entscheide-bauen», Punkt 6; Produktentscheid
-- 08.10.2026: «im Paket heisst der Zugangsweg ohne Datei ‹ohne Beleg› und die
-- Auffangregel ‹nach der Auffangregel der Anwendung›»).
--
-- Bis hierher schrieb `trageOhneBeschlussEin` die Auffangregel-Weisung als
-- `erklaerung` (`instruction.source_kind`), obwohl dort niemand etwas erklärt
-- hat. Im Abschlusspaket stand dann «Grundlage in der Bemerkung» über einer
-- Weisung, die die Anwendung selbst gesetzt hat. Der neue Wert trennt die
-- beiden Wege: `erklaerung` heisst im Paket künftig «ohne Beleg» (eine
-- Erklärung ohne Datei, ihre Grundlage steht in der Bemerkung selbst),
-- `auffangregel` heisst «nach der Auffangregel der Anwendung».
--
-- Die bestehenden Zeilen bleiben `erklaerung`: Was vorher als Erklärung
-- geschrieben wurde, bleibt eine — eingefrorene Pakete ändern sich nicht, und
-- für den Bestand ist der Unterschied ohnehin aus der Bemerkung lesbar
-- («Ohne Beschluss des Hauses; …»).

ALTER TABLE instruction DROP CONSTRAINT instruction_herkunft;
ALTER TABLE instruction
	ADD CONSTRAINT instruction_herkunft
	    CHECK (source_kind IN ('beschluss', 'erklaerung', 'auffangregel', 'frei'));
