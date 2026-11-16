-- 189 — Lesart L10: Angehörige des Beklagten im Ausstand an der Ausschlussklage
--
-- **Der Anlass** ist Entscheid 0044, zweiter Nachtrag, Punkt R1 (b): An der
-- Ermächtigung zur Ausschlussklage erklärt die Sitzungsleitung für Ehegatte und
-- Verwandte des Beklagten in gerader Linie den Ausstand. Ob sie dann in der
-- Zahl aller Eigentümer bleiben, an der die Mehrheit gemessen wird, oder aus
-- ihr fallen, sagt keine Stelle: Der Wortlaut von Art. 649b Abs. 2 nimmt nur
-- den Beklagten aus, Handschin/Wyttenbach nehmen ein ruhendes Stimmrecht
-- allgemein aus der Berechnung (2011, S. 63). Die Gemeinschaft wählt; Votum
-- rechnet zusätzlich nach der anderen Wahl und nennt das Ergebnis, wenn es
-- abweicht.
--
--   reading_l10  bleiben         Die Angehörigen stimmen nicht mit, zählen aber
--                                in der Zahl und wirken wie ein Nein (Vorgabe;
--                                eine so gefasste Ermächtigung besteht nach
--                                beiden Lesarten)
--                fallen_heraus   Die Angehörigen stimmen nicht mit und zählen
--                                auch in der Zahl nicht (Handschin/Wyttenbach
--                                2011, S. 63)
--
-- **Gebaut wie L1** (Migration 170): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe; eingefroren bei der Freigabe in `snapshot`, damit Einladung und Saal
-- nach derselben Wahl rechnen und eine Umstellung nach dem Ergebnis erst für
-- die nächste Versammlung wirkt. Am Erfordernis steht die Wahl in
-- `agenda_item.requirement_reading_l10`.
--
-- **Kein Knoten trägt L10.** Sie hängt an keiner Lesart am Knoten, sondern an
-- der Zählung (`ausstandBleibtInDerZahl` in `src/lib/domain/entscheidbaum.ts`),
-- wie L1 und L3. Die Schranke `agenda_item_lesart_form` bleibt darum
-- unverändert.
ALTER TABLE stweg ADD COLUMN reading_l10 text NOT NULL DEFAULT 'bleiben';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l10
    CHECK (reading_l10 IN ('bleiben', 'fallen_heraus'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Erfordernisse stammen aus Fassungen vor 2026-11-10, dort wirkt L10 nicht
-- (`ANGEHOERIGENLESART_AB`), und sie rechneten mit den Angehörigen in der Zahl
-- oder, vor 2026-10-25, ohne sie. Die eingefrorene Wahl wirkt für sie in keine
-- Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l10 text NOT NULL DEFAULT 'bleiben';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l10
    CHECK (reading_l10 IN ('bleiben', 'fallen_heraus'));

-- ── Am Erfordernis des Traktandums ─────────────────────────────────────────
--
-- NULL ohne Erfordernis, und bei jedem Traktandum von vorher; die Zählung liest
-- NULL als Vorgabe, so wie diese Traktanden gerechnet haben.
ALTER TABLE agenda_item ADD COLUMN requirement_reading_l10 text;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_l10
    CHECK (requirement_reading_l10 IS NULL OR requirement_reading_l10 IN ('bleiben', 'fallen_heraus'));

-- **Die Datenbank setzt die Wahl, nicht die Schreibstelle**, wie bei L1: Ein
-- Erfordernis entsteht an vielen Stellen (Herleitung, Wahl von Hand,
-- Folgeantrag, Rückkommen, Vorlage, Beschluss von Hand). Eine Stelle, die die
-- Wahl vergässe, rechnete still nach der Vorgabe, auch nach einer Umstellung.
-- Der Auslöser nimmt sie aus der Momentaufnahme derselben Versammlung, vor der
-- Freigabe aus der Gemeinschaft; was die Anwendung mitschickt, überschreibt er.
-- Die Freigabe schreibt die Spalte aller Traktanden neu, damit eine Umstellung
-- zwischen Herleitung und Freigabe nicht hängen bleibt (`gibVersammlungFrei`).
--
-- Er läuft mit den Rechten des Aufrufers und sieht nur, was dessen Betreiber
-- sieht; eine Versammlung ohne sichtbare Gemeinschaft ergibt nicht still die
-- Vorgabe, sondern einen Abbruch der Anweisung (kein fachlicher Fehler: Unter
-- demselben Betreiber kommt der Fall nicht vor).
--
-- **Der Name sorgt für die Reihenfolge.** BEFORE-Auslöser laufen nach Namen;
-- `agenda_aa_…` läuft vor den Wächtern an `agenda_item` (Siegel, Abgabe,
-- Rückzug). So sehen sie die Spalte, wie sie geschrieben wird, und ein
-- versiegeltes Traktandum lässt sich auch über sie nicht ändern.
CREATE OR REPLACE FUNCTION agenda_lesart_l10_setzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    wahl text;
BEGIN
    IF NEW.requirement_type IS NULL THEN
        NEW.requirement_reading_l10 := NULL;
        RETURN NEW;
    END IF;
    SELECT s.reading_l10 INTO wahl FROM snapshot s WHERE s.meeting_id = NEW.meeting_id;
    IF wahl IS NULL THEN
        SELECT g.reading_l10 INTO wahl
          FROM meeting m JOIN stweg g ON g.id = m.stweg_id
         WHERE m.id = NEW.meeting_id;
    END IF;
    IF wahl IS NULL THEN
        RAISE EXCEPTION 'Die Lesart L10 der Gemeinschaft ist für dieses Traktandum nicht zu finden.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_item_lesart_l10_quelle';
    END IF;
    NEW.requirement_reading_l10 := wahl;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_aa_lesart_l10_setzen
    BEFORE INSERT OR UPDATE OF requirement_type, requirement_version, requirement_reading_l10
    ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_lesart_l10_setzen();

-- Der Bestand bleibt NULL und zählt nach der Vorgabe, wie bisher; jede
-- Momentaufnahme von vorher trägt dieselbe Vorgabe. Ein Nachführen hier liefe
-- unter dem Zeilenschutz ohne Betreiber ins Leere und an versiegelten
-- Versammlungen in deren Sperre.

COMMENT ON COLUMN stweg.reading_l10 IS
    'Lesart L10, Angehörige des Beklagten im Ausstand an der Ausschlussklage: bleiben (Vorgabe) oder fallen_heraus (Entscheid 0044, zweiter Nachtrag, R1 (b)).';
COMMENT ON COLUMN snapshot.reading_l10 IS
    'Lesart L10 der Gemeinschaft bei der Freigabe (Migration 189).';
COMMENT ON COLUMN agenda_item.requirement_reading_l10 IS
    'Lesart L10, nach der das Traktandum zählt; gesetzt vom Auslöser agenda_lesart_l10_setzen. NULL ohne Erfordernis oder von vor Migration 189 (zählt nach der Vorgabe).';
