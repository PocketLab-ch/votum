-- 123 — Das verkündete Ergebnis wird festgeschrieben
--
-- **Produktentscheid 25.09.2026:** «nach jeder Abstimmung [soll] das bereits
-- abgestimmte nicht mehr verändert werden können (Momentaufnahme).»
--
-- **Der Anlass.** Bis hierher zählte `ergebnisIn` jeden geschlossenen Durchgang
-- bei jedem Lesen neu aus, mit dem Code von heute. Eingefroren waren nur die
-- Eingaben: Erfordernis (`requirement_json`), Anwesenheit, Vollmachten und
-- Ausstand (`attendance_json`). Jede Änderung an einer Zählregel wirkte damit
-- rückwirkend auf verkündete Ergebnisse, auch auf das Protokoll; so geschehen
-- mit `6b820d5` (Vollmachten der Betroffenen ruhen).
--
-- **Festgeschrieben wird beim Verkünden, nicht beim Schliessen.** Bei einem
-- offenen Stichentscheid steht beim Schliessen noch kein Ergebnis fest, und
-- die Prüfung, ob ein Gleichstand vorliegt, braucht bis zum Entscheid die
-- Rechnung. Verkündet wird an genau zwei Stellen: beim Schliessen und beim
-- Stichentscheid (`src/lib/server/abstimmung.ts`).
--
-- **Durchgänge von vorher bleiben ohne Festschreibung** und werden weiter
-- gerechnet. Nachgetragen wird nicht, aus demselben Grund wie beim Ausstand
-- (`64208b8`): Eine nachträgliche Rechnung mit dem Code von heute gäbe ein
-- Ergebnis als verkündet aus, das so nie verkündet wurde.
ALTER TABLE voting_round ADD COLUMN result_json jsonb;

-- Nur ein verkündetes Ergebnis ist festgeschrieben. Die Umkehrung gilt nicht:
-- Altbestand und Durchgänge ohne Auszählung (Kenntnisnahme) sind verkündet und
-- tragen keines.
ALTER TABLE voting_round ADD CONSTRAINT voting_round_festschreibung_verkuendet
    CHECK (result_json IS NULL OR result_published_at IS NOT NULL);

-- **Einmal geschrieben, bleibt es.** Die Sperre steht in der Datenbank und
-- nicht nur in der Anwendung, damit auch ein späterer Codepfad oder eine
-- Wartungsabfrage sie nicht umgeht (wie AD-8 für versiegelte Versammlungen).
-- Löschen bleibt möglich: Eine Versammlung, die gelöscht wird, nimmt ihre
-- Durchgänge mit.
CREATE OR REPLACE FUNCTION festschreibung_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.result_json IS NOT NULL AND NEW.result_json IS DISTINCT FROM OLD.result_json THEN
        RAISE EXCEPTION
            'Das Ergebnis dieses Durchgangs ist verkündet und festgeschrieben. Eine Änderung daran wäre eine nachträgliche Berichtigung; der Weg ist eine Neuabstimmung.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_festschreibung_unveraenderlich
    BEFORE UPDATE OF result_json ON voting_round
    FOR EACH ROW EXECUTE FUNCTION festschreibung_unveraenderlich();

COMMENT ON COLUMN voting_round.result_json IS
    'Die beim Verkünden festgeschriebene Auszählung, als Hülle { format, auszaehlung } (src/lib/domain/festschreibung.ts). NULL bei Durchgängen, die vor dem 25.09.2026 verkündet wurden, und bei solchen ohne Auszählung; dort wird gerechnet.';
