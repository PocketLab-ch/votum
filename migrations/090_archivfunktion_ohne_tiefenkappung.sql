-- Die Tiefenkappung log bei tiefen Baeumen — Postgres erkennt Ringe selbst.
--
-- **Der Befund** (25.08.2026, dritte Pruefrunde, nachgebaut mit einer Kette der
-- Tiefe 12): `stweg_archiv_wegen` brach nach zehn Stufen ab und gab NULL
-- zurueck, also «nicht archiviert» -- obwohl die Wurzel archiviert war. Die
-- Gemeinschaft stuende dann in der Liste, ihre Angabenseite boete einen eigenen
-- Archivknopf, und beim Hervorholen der Wurzel kaeme sie nicht mit. Ein
-- falscher Wert, lautlos.
--
-- Die Kappung war gegen einen **Ring** in `parent_stweg_id` gedacht, damit die
-- Rekursion nicht laeuft, bis der Server aufgibt. Dafuer gibt es seit
-- PostgreSQL 14 das richtige Werkzeug: `CYCLE ... SET ... USING`. Es fuehrt den
-- bereits besuchten Pfad mit, bricht genau dann ab, wenn sich eine Kennung
-- wiederholt, und laesst echte Baeume in Ruhe -- egal wie tief.
--
-- Damit stimmt beides: Ein Ring haengt nicht, und eine Kette der Tiefe 12
-- liefert die richtige Antwort. Der Kommentar in Migration 087 behauptete «drei
-- Stufen sind im Bestand das Aeusserste, zehn ist reichlich Luft»; erzwungen war
-- das nirgends, und eine Zusicherung, die niemand durchsetzt, ist eine Annahme.
CREATE OR REPLACE FUNCTION stweg_archiv_wegen(s_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
COST 5000
AS $$
    WITH RECURSIVE kette (id, parent_stweg_id, archived_at, tiefe) AS (
        SELECT s.id, s.parent_stweg_id, s.archived_at, 0
          FROM stweg s
         WHERE s.id = s_id
        UNION ALL
        SELECT s.id, s.parent_stweg_id, s.archived_at, k.tiefe + 1
          FROM stweg s
          JOIN kette k ON s.id = k.parent_stweg_id
    ) CYCLE id SET im_ring USING pfad
    SELECT id FROM kette
     WHERE archived_at IS NOT NULL AND NOT im_ring
     ORDER BY tiefe
     LIMIT 1;
$$;
