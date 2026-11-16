-- Der Stichentscheid als Kaskade, und der Vorsitz als entscheidende Person
-- (Auftrag 07.10.2026, «votum-stichentscheid-kaskade»).
--
-- Ein Reglement aus einer Anfrage regelt den Gleichstand in Stufen:
-- «Bei Stimmengleichheit gilt der Antrag mit dem höheren Wertquotenanteil.
-- Kommt auch dadurch keine Mehrheit zustande, entscheidet der Vorsitzende.»
-- Eine Einzelwahl unter `keiner`, `wertquote` und `verwalter` bildet das nicht
-- ab: Bei gleichen Quoten war der Antrag abgelehnt, nach diesem Reglement geht
-- es dann zur Person weiter.
--
-- Neu sind drei Werte:
--   `vorsitz`             die Person im Vorsitz entscheidet (nicht zwingend
--                         der Verwalter: Die Versammlung kann jemand anderen
--                         wählen, Rz. 75 und 76a ad Art. 712n)
--   `wertquote_verwalter` erst die Wertquoten, bei Gleichstand auch dort der
--                         Verwalter
--   `wertquote_vorsitz`   erst die Wertquoten, dann der Vorsitz
--
-- Die bestehenden Werte behalten ihre Bedeutung, an keiner Zeile ändert sich
-- etwas. Die Momentaufnahme bekommt dieselbe Liste: Sie friert die Regel beim
-- Freigeben ein.

ALTER TABLE stweg DROP CONSTRAINT IF EXISTS stweg_stichentscheid;
ALTER TABLE stweg ADD CONSTRAINT stweg_stichentscheid
    CHECK (tie_break IN ('keiner', 'wertquote', 'verwalter', 'vorsitz',
                         'wertquote_verwalter', 'wertquote_vorsitz'));

ALTER TABLE snapshot DROP CONSTRAINT IF EXISTS snapshot_stichentscheid;
ALTER TABLE snapshot ADD CONSTRAINT snapshot_stichentscheid
    CHECK (tie_break IN ('keiner', 'wertquote', 'verwalter', 'vorsitz',
                         'wertquote_verwalter', 'wertquote_vorsitz'));
