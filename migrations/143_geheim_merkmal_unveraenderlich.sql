-- 143 — Das Geheim-Merkmal des Durchgangs ist unveränderlich
--
-- **Entscheid 04.10.2026** (zweiter Blick zu Lauf B, Frage Z2): Das Merkmal
-- `secret` wird in der Datenbank gegen Änderung gesperrt. Migration 141 trug
-- den Spaltenkommentar «beim Eröffnen gesetzt, danach unveränderlich», eine
-- Schranke fehlte. Kein Aufrufweg ändert die Spalte — aber ein Weg, der nur
-- zufällig zu ist, ist keiner (dieselbe Überlegung wie in 118 und 121).
--
-- **Was die Sperre verhindert.** Ein nachträgliches Umstellen drehte die
-- Ausgaberegel eines abgeschlossenen Durchgangs: Aus einem offen abgestimmten
-- Ergebnis mit Zahlen würde eines, das nur «erreicht/nicht erreicht» zeigt,
-- oder umgekehrt. Die Auswertung geht an alle Eigentümer, und der Nachweis
-- hinge damit am Code von morgen statt am Stand beim Eröffnen.
--
-- **Nur die Änderung ist verboten, nicht jede Schreiboperation.** Ein UPDATE,
-- das `secret` mit demselben Wert setzt, und alle Updates, die die Spalte
-- nicht nennen, laufen weiter; der Auslöser greift nur bei einem anderen
-- Wert. Beim Eröffnen entsteht die Zeile mit dem Merkmal; das ist der eine
-- Schreibweg und bleibt.
--
-- **Migration 141 bleibt eingefroren** (AD-14); ihr Spaltenkommentar gilt
-- weiter, das Merkmal selbst ändert diese Datei nicht.

CREATE OR REPLACE FUNCTION geheim_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.secret IS DISTINCT FROM OLD.secret THEN
        RAISE EXCEPTION
            'Das Geheim-Merkmal wird beim Eröffnen gesetzt und ist danach unveränderlich; ein nachträgliches Umstellen änderte die Ausgabe eines abgeschlossenen Durchgangs.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_geheim_unveraenderlich
    BEFORE UPDATE OF secret ON voting_round
    FOR EACH ROW EXECUTE FUNCTION geheim_unveraenderlich();
