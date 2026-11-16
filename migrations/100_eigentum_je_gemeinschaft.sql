-- Ein Index auf der Gemeinschaft in der Eigentumshistorie
-- (01.09.2026, aus dem Code-Review zur sichtbaren Historie).
--
-- **Warum er bis heute fehlte.** Migration 006 legt zwei Indexe an: einen auf
-- der Einheit (`unit_id, valid_from`) und einen auf der Partei. Beide passen zu
-- den Fragen, die es damals gab — «wem gehört diese Einheit» und «was hält
-- diese Partei». Die Historie stellt eine dritte: «alle Zuordnungen dieser
-- Gemeinschaft», und die traf keinen Index.
--
-- **Warum das zaehlt.** Die Abfrage laeuft bei jedem Laden der
-- Eigentuemerseite, und `unit_ownership` ist betreiberuebergreifend: Ohne
-- Index liest sie die Zuordnungen aller Gemeinschaften aller Betreiber, um die
-- einer einzigen zu zeigen. Heute sind das wenige Zeilen; die Kosten wachsen
-- mit jedem Haus, und zwar an einer Stelle, die niemand mehr ansieht.
--
-- Aufbau wie `unit_stweg_idx` in Migration 005: die Gemeinschaft zuerst, danach
-- das Merkmal, nach dem sortiert wird.
CREATE INDEX unit_ownership_stweg_idx ON unit_ownership (stweg_id, unit_id, valid_from);

COMMENT ON INDEX unit_ownership_stweg_idx IS
    'Fuer die Eigentumshistorie einer Gemeinschaft (Eigentuemerseite, Abschnitt «Eigentum im Zeitverlauf»).';
