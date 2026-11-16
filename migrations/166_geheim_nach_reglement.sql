-- 166 — Die geheime Abstimmung nach Reglement
--
-- **Fachprüfung 16.10.2026** (Ä-38, Runde 2, Stelle 1): Neben dem offenen
-- Beschluss der Versammlung (Migration 165) kann das Reglement die geheime
-- Abstimmung vorsehen, etwa auf Antrag eines Fünftels (Rz. 160 ad Art. 712m;
-- der Mehrheitsbeschluss gilt nur «unter Vorbehalt einer anderslautenden
-- reglementarischen Bestimmung», Rz. 161). Liesse die Leitung dann trotzdem
-- darüber abstimmen, wäre der Beschluss anfechtbar (Rz. 220).
-- **Produktentscheid 16.10.2026:** beides als Häkchen, mindestens eines muss
-- gesetzt sein, und das Protokoll nennt, was zutrifft.
--
-- Getrennt von 165, weil 165 auf Dev schon eingespielt ist (AD-14).
-- `NULL` heisst wie dort: nicht festgehalten. Unveränderlich wie dort.
--
-- **Berichtigt 165:** Dort steht, ein geheimer Durchgang trage ab jetzt
-- `secret_resolved = true` und das Eröffnen weise ohne Bestätigung ab. Seit
-- dieser Migration genügt eine der beiden Grundlagen; nach Reglement allein
-- bleibt `secret_resolved` leer. Mindestens eine von beiden ist `true`
-- (`oeffneAbstimmung`).

ALTER TABLE voting_round ADD COLUMN secret_by_bylaw boolean;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_geheim_reglement
    CHECK (secret_by_bylaw IS NULL OR secret);

COMMENT ON COLUMN voting_round.secret_by_bylaw IS
    'Die Leitung hat beim Eröffnen bestätigt, dass das Reglement die geheime Abstimmung '
    'vorsieht (Migration 166). NULL: nicht festgehalten. Unveränderlich.';

CREATE OR REPLACE FUNCTION geheim_reglement_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.secret_by_bylaw IS DISTINCT FROM OLD.secret_by_bylaw THEN
        RAISE EXCEPTION
            'Die Grundlage der geheimen Abstimmung wird beim Eröffnen festgehalten und ist danach unveränderlich.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_geheim_reglement_unveraenderlich
    BEFORE UPDATE OF secret_by_bylaw ON voting_round
    FOR EACH ROW EXECUTE FUNCTION geheim_reglement_unveraenderlich();
