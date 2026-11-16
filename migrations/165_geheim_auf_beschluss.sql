-- 165 — Die Grundlage der geheimen Abstimmung am Durchgang
--
-- **Produktentscheid 16.10.2026** (Ä-38, Block 2 der Freigabeliste): «Erste
-- Abstimmung offen, ob geheim ja oder nein; wenn ja, dann geheime Abstimmung
-- über die Sache.» Die Leitung bestätigt beim Eröffnen mit einem Häkchen, dass
-- die Versammlung offen beschlossen hat, geheim abzustimmen, und das Protokoll
-- nennt diesen Beschluss. Grundlage: Pflichtpunkt 8 der Fachprüfung vom
-- 28.09.2026 («Grundlage der geheimen Abstimmung im Protokoll»); der
-- Ordnungsbeschluss geht mit einfachem Mehr (Rz. 161 ad Art. 712m).
--
-- **`NULL` heisst: nicht festgehalten.** Durchgänge von vor dieser Migration
-- und alle offenen tragen keinen Wert; das Protokoll behauptet für sie keinen
-- Beschluss. Ein geheimer Durchgang ab jetzt trägt `true`; das Eröffnen weist
-- ohne Bestätigung ab (`oeffneAbstimmung`).
--
-- **Unveränderlich wie das Geheim-Merkmal** (Migration 143): Ein
-- nachträgliches Setzen behauptete im Protokoll einen Beschluss, den beim
-- Eröffnen niemand bestätigt hat. Die Sperre greift nur bei einem anderen
-- Wert, wie dort.

ALTER TABLE voting_round ADD COLUMN secret_resolved boolean;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_geheim_beschluss
    CHECK (secret_resolved IS NULL OR secret);

COMMENT ON COLUMN voting_round.secret_resolved IS
    'Die Leitung hat beim Eröffnen bestätigt, dass die Versammlung offen beschlossen hat, '
    'geheim abzustimmen (Migration 165). NULL: nicht festgehalten. Unveränderlich.';

CREATE OR REPLACE FUNCTION geheim_beschluss_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.secret_resolved IS DISTINCT FROM OLD.secret_resolved THEN
        RAISE EXCEPTION
            'Der Beschluss zur geheimen Abstimmung wird beim Eröffnen festgehalten und ist danach unveränderlich.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_geheim_beschluss_unveraenderlich
    BEFORE UPDATE OF secret_resolved ON voting_round
    FOR EACH ROW EXECUTE FUNCTION geheim_beschluss_unveraenderlich();
