-- 121 — Der Vertretungsgrund gehört zu «wer wen vertritt»
--
-- **Der Anlass** (Code-Review vom 24.09.2026, Befund B6). Migration 120 hat
-- `proxy.representation_basis` angelegt: Wer von Gesetzes wegen vertritt,
-- zählt nicht zur Höchstzahl des Reglements. Der Wächter aus Migration 036
-- (`proxy_nur_lebensweg`) zählt die unveränderlichen Spalten einzeln auf und
-- kannte die neue nicht.
--
-- **Was ohne diese Zeile möglich war.** Die Anwendungsrolle hat `UPDATE` auf
-- `proxy`. Eine überzählige gewöhnliche Vollmacht liesse sich nachträglich zur
-- «Organvertretung» machen: Die Sperre hatte sie schon passiert, die Warnung
-- `ueberschreitungen()` verstummte, und die Zeile sähe danach aus wie immer.
-- Ausgerechnet das Feld, an dem im Anfechtungsfall hängt, ob die Höchstzahl
-- eingehalten war, wäre damit das einzige vertretungsbestimmende Feld gewesen,
-- das sich im Nachhinein drehen lässt. Der Kommentar über dem Wächter sagt
-- «Wer wen vertritt, wird nicht geändert (AD-5)» — für diese Spalte stimmte er
-- seit Migration 120 nicht mehr.
--
-- **Heute erreicht es kein Code**: Die vier `UPDATE proxy` in der Anwendung
-- setzen nur `proof_shown`, `state`, `confirmed_at` und die Endfelder. Ein Weg,
-- der nur zufällig zu ist, ist aber keiner — dieselbe Überlegung wie in
-- Migration 118.
--
-- **Als `CREATE OR REPLACE`, nicht als Änderung an 036.** Die 036 ist gelaufen
-- und damit eingefroren (AD-14); ihre Fassung bleibt in der Geschichte stehen,
-- diese hier gilt ab jetzt. Der übrige Rumpf ist unverändert übernommen.

CREATE OR REPLACE FUNCTION proxy_nur_lebensweg() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Vollmachten werden nicht gelöscht (AD-5); weisen Sie sie zurück oder widerrufen Sie sie.';
    END IF;
    IF NEW.represented_id IS DISTINCT FROM OLD.represented_id
       OR NEW.holder_id   IS DISTINCT FROM OLD.holder_id
       OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
       OR NEW.meeting_id  IS DISTINCT FROM OLD.meeting_id
       -- Neu in Migration 121: Der Grund entscheidet, ob diese Zeile zur
       -- Höchstzahl des Reglements zählt. Er gehört damit zu «wer wen
       -- vertritt» und nicht zum Lebensweg.
       OR NEW.representation_basis IS DISTINCT FROM OLD.representation_basis
       OR NEW.created_at  IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Wer wen vertritt, wird nicht geändert (AD-5); weisen Sie die Vollmacht zurück und erfassen Sie eine neue.';
    END IF;
    -- Eine bestätigte Vollmacht kehrt nicht in den unbestätigten Zustand zurück.
    IF OLD.state = 'bestaetigt' AND NEW.state = 'erfasst' THEN
        RAISE EXCEPTION 'Eine bestätigte Vollmacht wird nicht wieder unbestätigt; widerrufen Sie sie.';
    END IF;
    IF OLD.state IN ('zurueckgewiesen', 'widerrufen') AND NEW.state <> OLD.state THEN
        RAISE EXCEPTION 'Eine beendete Vollmacht lebt nicht wieder auf; erfassen Sie eine neue.';
    END IF;
    RETURN NEW;
END;
$$;
