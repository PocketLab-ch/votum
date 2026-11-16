-- 183 — Lesart L7: Ausstand und Beschlussfähigkeit
--
-- **Der Anlass** ist die Einteilung F3b, Zeile B2 (Entscheid 0018, F4c): Ob
-- für die Beschlussfähigkeit mitzählt, wer bei einem Traktandum im Ausstand
-- ist, ist umstritten. Der SVIT-Kommentar sagt, ein Interessenkonflikt
-- beeinflusse die Beschlussfähigkeit nicht (Rz. 17 ad Art. 712p, mit
-- Meier-Hayoz/Rey, Weber und Friedrich); Handschin/Wyttenbach zählen die
-- Person im Ausstand nicht mit (S. 62, gestützt auf Wermelinger, Zürcher
-- Kommentar, Art. 712m N 154, 2010). Die Gemeinschaft wählt; Votum rechnet
-- nach der Wahl und sagt der Leitung, wo der Beschluss an den Personen im
-- Ausstand hängt.
--
--   reading_l7   zaehlt        Wer im Ausstand ist oder nur über einen
--                               Vertreter im Ausstand vertreten ist, zählt
--                               für die Beschlussfähigkeit weiter als
--                               anwesend (Vorgabe; Entscheid 0014, wie die
--                               Feststellung bisher rechnet)
--                zaehlt_nicht  Votum prüft vor jeder Abstimmung die
--                               Beschlussfähigkeit ohne diese Personen und
--                               sperrt das verbindliche Eröffnen, wenn sie
--                               fehlt (Produktentscheid 06.11.2026: Sperre
--                               je Traktandum)
--
-- **Gebaut wie L6** (Migration 180): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit Saal und
-- Protokoll nach derselben Wahl rechnen und eine Umstellung nach der
-- Freigabe erst für die nächste Versammlung wirkt. L7 hängt an keinem Knoten
-- des Regelwerks (wie L1 und L5) und ändert kein Mehr: Wer im Ausstand ist,
-- stimmt in keinem Fall mit.
ALTER TABLE stweg ADD COLUMN reading_l7 text NOT NULL DEFAULT 'zaehlt';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l7
    CHECK (reading_l7 IN ('zaehlt', 'zaehlt_nicht'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Die
-- Feststellung liest den Ausstand bis hierher nicht, die Personen im
-- Ausstand zählten immer mit; die eingefrorene Wahl wirkte für sie in
-- keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l7 text NOT NULL DEFAULT 'zaehlt';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l7
    CHECK (reading_l7 IN ('zaehlt', 'zaehlt_nicht'));

COMMENT ON COLUMN stweg.reading_l7 IS
    'Lesart L7, Beschlussfähigkeit mit den Personen im Ausstand (ZGB Art. 712p): zaehlt (Vorgabe, Entscheid 0014) oder zaehlt_nicht (Entscheid 0018).';
COMMENT ON COLUMN snapshot.reading_l7 IS
    'Lesart L7 der Gemeinschaft bei der Freigabe (Migration 183).';
