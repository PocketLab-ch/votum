-- 182: Der Kommentar zu `agenda_item.requirement_reading_reconsidered` nach F4c B2b
--
-- Migration 181 nannte die Spalte «nur für den Satz der Leitung». Seit B2b
-- trägt sie auch das Mehr der anderen Wahl (`andere`) und, ob der aufgehobene
-- Beschluss die Ja-Stimmen aller Eigentümer hatte (`mitAllen`, gesetzt beim
-- Anlegen des Rückkommens aus der Auszählung seines geltenden Durchgangs).
-- Daraus rechnet die Auszählung den Satz an der Karte, die Folge nach der
-- Abstimmung und das zweite Ergebnis am Rückkommen. Die Prüfbedingung aus 181
-- lässt zusätzliche Schlüssel zu; an Spalte und Bedingung ändert sich nichts.
COMMENT ON COLUMN agenda_item.requirement_reading_reconsidered IS
    'Am Rückkommen die Lesart des aufgehobenen Beschlusses: Kennung, Wahl, das Mehr der anderen Wahl (andere) und ob der Beschluss die Ja-Stimmen aller Eigentümer hatte (mitAllen). Für den Satz an der Karte, die Folge nach der Abstimmung und das zweite Ergebnis am Rückkommen (Migrationen 181 und 182, F4c B2b).';
