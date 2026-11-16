-- 184 — Lesart L8: Die Vollmachten der Verwaltung an ihren eigenen Geschäften
--
-- **Der Anlass** ist die Einteilung F3b, Zeile B4 (Entscheid 0018, F4c): Wer
-- bei einem Geschäft nicht selbst stimmen darf, darf es nach dem Bundesgericht
-- auch nicht als Vertreter (BGE 134 III 481 E. 3.8, zu Art. 68 ZGB). Für eine
-- Verwaltung, die nicht Eigentümerin ist, sagt das keine Stelle ausdrücklich;
-- Votum überträgt es auf ihre Entschädigung, Verträge mit ihr und ihre
-- Entlastung. Bei Wahl und Wiederwahl ruhen die Vollmachten nicht (E. 3.5 und
-- 3.8), bei der Abberufung ist es nicht geklärt. Die Gemeinschaft wählt, ob
-- die Vollmachten ruhen, solange die Sitzungsleitung keinen Ausstand erklärt.
--
--   reading_l8   ruhen     An einem Traktandum, das als Entschädigung,
--                          Vertrag oder Entlastung der Verwaltung
--                          gekennzeichnet ist, ruhen die Vollmachten der
--                          Verwaltung, ohne erklärten Ausstand (Vorgabe;
--                          Produktentscheid 06.11.2026: B4 mit zwei Häkchen,
--                          Vollmacht und Traktandum)
--               leitung    Die Vollmachten ruhen nur, wenn die Sitzungsleitung
--                          bei diesem Traktandum den Ausstand der Verwaltung
--                          erklärt; sonst zählen ihre Stimmen
--
-- **Gebaut wie L7** (Migration 183): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit Saal und
-- Protokoll nach derselben Wahl rechnen und eine Umstellung nach der Freigabe
-- erst für die nächste Versammlung wirkt. L8 hängt an keinem Knoten des
-- Regelwerks (wie L1, L5 und L7) und ändert kein Mehr: Sie nimmt Stimmen aus
-- der Bezugsgrösse, die sonst zählten, und nennt das Ergebnis nach der
-- anderen Wahl dazu.
--
-- **Zwei Häkchen tragen sie** (Produktentscheid 06.11.2026): eines an der
-- Vollmacht, dass die Verwaltung sie hält, eines am Traktandum, dass es um
-- ihr eigenes Geschäft geht. Erst beide zusammen lassen die Vollmachten
-- ruhen; jedes allein ändert keine Zahl.
ALTER TABLE stweg ADD COLUMN reading_l8 text NOT NULL DEFAULT 'ruhen';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l8
    CHECK (reading_l8 IN ('ruhen', 'leitung'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Kein
-- Traktandum trägt das Häkchen (die Spalte entsteht hier mit `false`), also
-- wirkte die eingefrorene Wahl für sie in keiner Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l8 text NOT NULL DEFAULT 'ruhen';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l8
    CHECK (reading_l8 IN ('ruhen', 'leitung'));

-- Das Häkchen an der Vollmacht: Die bevollmächtigte Person ist die
-- Verwaltung. Nur ein Vertreter ohne Eigentum kann es tragen; eine Partei
-- dieser Versammlung wäre selbst stimmberechtigt, und ihr Ausstand ist seit
-- Migration 062 erklärbar. Der CHECK hält das fest, damit keine Zeile je
-- beides zugleich behauptet.
ALTER TABLE proxy ADD COLUMN holder_is_management boolean NOT NULL DEFAULT false;
ALTER TABLE proxy ADD CONSTRAINT proxy_verwaltung_nur_dritte
    CHECK (holder_is_management = false OR holder_id IS NULL);

-- Das Häkchen am Traktandum: Es geht um die Entschädigung der Verwaltung,
-- einen Vertrag mit ihr oder ihre Entlastung. An Wahl, Wiederwahl und
-- Abberufung ruhen die Vollmachten nicht oder nicht von selbst; die Absage
-- am Setzen steht im Code (`server/erfordernisse.ts`), nicht hier, denn die
-- drei Knoten sind Daten des Regelwerks.
ALTER TABLE agenda_item ADD COLUMN concerns_management boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN stweg.reading_l8 IS
    'Lesart L8, Vollmachten der Verwaltung an ihren eigenen Geschäften (BGE 134 III 481 E. 3.6 und 3.8): ruhen (Vorgabe, Entscheid 0018) oder leitung.';
COMMENT ON COLUMN snapshot.reading_l8 IS
    'Lesart L8 der Gemeinschaft bei der Freigabe (Migration 184).';
COMMENT ON COLUMN proxy.holder_is_management IS
    'Die bevollmächtigte Person ist die Verwaltung (Lesart L8, Migration 184); nur bei einem Vertreter ohne Partei (holder_id IS NULL).';
COMMENT ON COLUMN agenda_item.concerns_management IS
    'Es geht um die Entschädigung der Verwaltung, einen Vertrag mit ihr oder ihre Entlastung (Lesart L8, Migration 184); nur bei item_kind = abstimmung.';
