-- Berichtigung des Ringschutzes aus 025.
--
-- Die Kette wurde von der falschen Seite verfolgt. Eine Zeile
-- `party(stweg_id = A, member_stweg_id = B)` heisst: **B ist Mitglied von A**,
-- also eine Kante B → A. Wird nun eine Zeile mit `stweg_id = B,
-- member_stweg_id = A` eingefügt, entsteht die Kante A → B — und ein Ring
-- besteht genau dann, wenn von B aus schon ein Weg zurück nach A führt.
--
-- Die erste Fassung suchte stattdessen nach Zeilen, die auf die neue
-- Mitgliedsgemeinschaft zeigen. Zum Zeitpunkt des Einfügens gibt es die noch
-- nicht — der Auslöser fand nie etwas und liess jeden Ring durch. Aufgefallen
-- ist es am Test, nicht im Betrieb; genau dafür steht er da.

CREATE OR REPLACE FUNCTION party_mitglied_ringschutz() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ring boolean;
BEGIN
    IF NEW.member_stweg_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Von der haltenden Gemeinschaft aus nach oben: Wessen Mitglied ist sie
    -- selbst, und wessen Mitglied ist wiederum jene?
    WITH RECURSIVE hinauf AS (
        SELECT p.stweg_id AS ziel
        FROM party p
        WHERE p.member_stweg_id = NEW.stweg_id
        UNION            -- nicht ALL: bricht ab, falls in Altdaten doch ein Ring steckt
        SELECT p.stweg_id
        FROM party p JOIN hinauf h ON p.member_stweg_id = h.ziel
    )
    SELECT EXISTS (SELECT 1 FROM hinauf WHERE ziel = NEW.member_stweg_id) INTO ring;

    IF ring THEN
        RAISE EXCEPTION 'Ring in der Mitgliedschaft: % hält bereits mittelbar an %',
            NEW.member_stweg_id, NEW.stweg_id;
    END IF;
    RETURN NEW;
END;
$$;
