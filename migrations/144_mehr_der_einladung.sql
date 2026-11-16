-- 144 — Das Mehr aus der Einladung als Untergrenze
--
-- **Produktentscheide 27.09.2026 und 06.10.2026** (Begründung und Wortlaut in
-- `src/lib/domain/einladungsmehr.ts`): Im Saal darf das Mehr eines Traktandums
-- strenger werden als in der Einladung, nicht milder. Vor Beginn darf es
-- milder werden, dann muss die berichtigte Einladung neu hinaus.
--
-- **Warum eine eigene Spalte und nicht das Erfordernis selbst.** Die Spalten
-- `requirement_*` tragen das Mehr, nach dem gezählt wird, und das darf sich
-- bis zur Abstimmung ändern. Verglichen wird es mit dem Stand, den die
-- Einladung nennt; der muss deshalb getrennt festgehalten werden, wie die
-- Nummer der Einladung in `released_number` (Migration 072).
--
-- **Als jsonb, nicht Spalte für Spalte.** Es ist eine Abschrift des ganzen
-- Erfordernisses, wie `erfordernisAusZeile` es liest. Gerechnet wird darauf
-- nicht, nur verglichen und in der Absage genannt.

ALTER TABLE agenda_item
	ADD COLUMN released_requirement jsonb,
	ADD COLUMN released_requirement_relaxed_at timestamptz,
	ADD COLUMN released_requirement_before jsonb;

COMMENT ON COLUMN agenda_item.released_requirement IS
	'Das Mehr, das die Einladung nennt: bei der Freigabe festgehalten, bei der Rücknahme verworfen, vor Beginn mit einer Milderung nachgeführt. NULL heisst keine Untergrenze (kein Erfordernis, Grenzfall, Kenntnisnahme, spontanes Traktandum).';
COMMENT ON COLUMN agenda_item.released_requirement_relaxed_at IS
	'Wann das Mehr zuletzt nach der Freigabe gemildert wurde. Solange danach kein Versand vermerkt ist, verlangt Votum die berichtigte Einladung.';
COMMENT ON COLUMN agenda_item.released_requirement_before IS
	'Das Mehr der Einladung vor einer Milderung, solange die berichtigte Einladung aussteht. Wird das Mehr vorher wieder darauf oder strenger gestellt, kehrt die Untergrenze dorthin zurück.';

-- **Die Untergrenze bewegt sich nur vor Beginn.** Die Anwendung schreibt sie
-- bei der Freigabe (Versammlung noch im Entwurf), bei der Rücknahme und beim
-- Mildern vor Beginn (beides im Zustand «freigegeben»). Ab der Eröffnung gibt
-- es keinen Weg dorthin; die Sperre hält das fest, statt es dem Zufall der
-- Aufrufwege zu überlassen (dieselbe Überlegung wie in 143).
CREATE OR REPLACE FUNCTION einladungsmehr_nur_vor_beginn() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    zustand text;
BEGIN
    IF NEW.released_requirement IS NOT DISTINCT FROM OLD.released_requirement
       AND NEW.released_requirement_relaxed_at IS NOT DISTINCT FROM OLD.released_requirement_relaxed_at
       AND NEW.released_requirement_before IS NOT DISTINCT FROM OLD.released_requirement_before THEN
        RETURN NEW;
    END IF;
    SELECT m.state INTO zustand FROM meeting m WHERE m.id = NEW.meeting_id;
    -- Unbekannt heisst gesperrt: Eine Zeile, deren Versammlung unter dem
    -- Zeilenschutz nicht zu sehen ist, soll nicht durchrutschen.
    IF zustand IS NULL OR zustand NOT IN ('entwurf', 'freigegeben') THEN
        RAISE EXCEPTION
            'Das Mehr der Einladung steht ab der Eröffnung fest; es ist die Untergrenze für das Mehr im Saal.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_item_einladungsmehr_nur_vor_beginn
    BEFORE UPDATE OF released_requirement, released_requirement_relaxed_at, released_requirement_before
    ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION einladungsmehr_nur_vor_beginn();
