-- 170 — Lesart L1: Wertquote im Ausstand beim Mehr aller Wertquoten
--
-- **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), Block 2. Ist
-- jemand bei einem Geschäft im Ausstand, fragt sich beim Mehr aller
-- Wertquoten, ob seine Quote im Nenner bleibt. Ebenso die Quote einer Partei,
-- deren Vertreter im Ausstand ist (ihre Vollmacht ruht).
--
--   reading_l1   bleibt          Die Quote bleibt im Nenner (Vorgabe;
--                                Entscheid 0010, Grundregel Rz. 191 ad
--                                Art. 712m und unsere Folgerung daraus)
--                faellt_heraus   Die Quote fällt heraus (Handschin/Wyttenbach
--                                2011, S. 63, mit ZK-Wermelinger Art. 712m N 154)
--
-- Nur bei den Wertquoten: An der Ausschlussklage bleiben Ausstand und
-- vertretene Partei fest in der Zahl (Wortlaut Art. 649b Abs. 2; Produkt-
-- entscheid 21.10.2026), die Einstimmigkeit rechnet unverändert.
--
-- **Gebaut wie L4** (Migration 169): Spalte an `stweg`, eingefroren in
-- `snapshot` bei der Freigabe.
ALTER TABLE stweg ADD COLUMN reading_l1 text NOT NULL DEFAULT 'bleibt';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l1
    CHECK (reading_l1 IN ('bleibt', 'faellt_heraus'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe: So haben ihre Traktanden
-- gerechnet.
ALTER TABLE snapshot ADD COLUMN reading_l1 text NOT NULL DEFAULT 'bleibt';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l1
    CHECK (reading_l1 IN ('bleibt', 'faellt_heraus'));

-- ── Am Erfordernis des Traktandums ─────────────────────────────────────────
--
-- **Anders als L4 nicht am Mehr, sondern an der Zählung.** L1 ändert nicht,
-- welches Mehr gilt, nur wer im Nenner steht. Die Wahl geht trotzdem ans
-- Erfordernis, weil das Erfordernis der Nachweis ist (AD-4): Beim Eröffnen geht
-- sie mit ihm in `voting_round.requirement_json`, und ein Beschluss lässt sich
-- ohne die Gemeinschaft nachrechnen.
--
-- NULL ohne Erfordernis, und bei jedem Traktandum von vorher; die Zählung
-- liest NULL als Vorgabe, so wie diese Traktanden gerechnet haben.
ALTER TABLE agenda_item ADD COLUMN requirement_reading_l1 text;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_l1
    CHECK (requirement_reading_l1 IS NULL OR requirement_reading_l1 IN ('bleibt', 'faellt_heraus'));

-- **Die Datenbank setzt die Wahl, nicht die Schreibstelle.** Ein Erfordernis
-- entsteht an vielen Stellen (Herleitung, Wahl von Hand, Folgeantrag,
-- Rückkommen, Vorlage, Beschluss von Hand). Eine Stelle, die die Wahl vergässe,
-- rechnete still nach der Vorgabe, auch nach einer Umstellung. Der Auslöser nimmt
-- sie aus der Momentaufnahme derselben Versammlung, vor der Freigabe aus der
-- Gemeinschaft; was die Anwendung mitschickt, überschreibt er. Die Freigabe
-- schreibt die Spalte aller Traktanden neu, damit eine Umstellung zwischen
-- Herleitung und Freigabe nicht hängen bleibt (`gibVersammlungFrei`).
--
-- Er läuft mit den Rechten des Aufrufers und sieht nur, was dessen Betreiber
-- sieht; eine Versammlung ohne sichtbare Gemeinschaft ergibt nicht still die
-- Vorgabe, sondern einen Abbruch der Anweisung (kein fachlicher Fehler: Unter
-- demselben Betreiber kommt der Fall nicht vor).
--
-- **Der Name sorgt für die Reihenfolge.** BEFORE-Auslöser laufen nach Namen;
-- `agenda_aa_…` läuft vor den Wächtern an `agenda_item` (Siegel, Abgabe,
-- Rückzug). So sehen sie die Spalte, wie sie geschrieben wird, und ein
-- versiegeltes Traktandum lässt sich auch über sie nicht ändern (Codeprüfung
-- Lesarten Block 2, Teil 1, N1).
CREATE OR REPLACE FUNCTION agenda_lesart_l1_setzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    wahl text;
BEGIN
    IF NEW.requirement_type IS NULL THEN
        NEW.requirement_reading_l1 := NULL;
        RETURN NEW;
    END IF;
    SELECT s.reading_l1 INTO wahl FROM snapshot s WHERE s.meeting_id = NEW.meeting_id;
    IF wahl IS NULL THEN
        SELECT g.reading_l1 INTO wahl
          FROM meeting m JOIN stweg g ON g.id = m.stweg_id
         WHERE m.id = NEW.meeting_id;
    END IF;
    IF wahl IS NULL THEN
        RAISE EXCEPTION 'Die Lesart L1 der Gemeinschaft ist für dieses Traktandum nicht zu finden.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_item_lesart_l1_quelle';
    END IF;
    NEW.requirement_reading_l1 := wahl;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_aa_lesart_l1_setzen
    BEFORE INSERT OR UPDATE OF requirement_type, requirement_version, requirement_reading_l1
    ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_lesart_l1_setzen();

-- Der Bestand bleibt NULL und zählt nach der Vorgabe, wie bisher; jede
-- Momentaufnahme von vorher trägt dieselbe Vorgabe. Ein Nachführen hier liefe
-- unter dem Zeilenschutz ohne Betreiber ins Leere und an versiegelten
-- Versammlungen in deren Sperre.

COMMENT ON COLUMN stweg.reading_l1 IS
    'Lesart L1, Wertquote im Ausstand beim Mehr aller Wertquoten: bleibt (Vorgabe) oder faellt_heraus (Entscheid 0018).';
COMMENT ON COLUMN snapshot.reading_l1 IS
    'Lesart L1 der Gemeinschaft bei der Freigabe (Migration 170).';
COMMENT ON COLUMN agenda_item.requirement_reading_l1 IS
    'Lesart L1, nach der das Traktandum zählt; gesetzt vom Auslöser agenda_lesart_l1_setzen. NULL ohne Erfordernis oder von vor Migration 170 (zählt nach der Vorgabe).';
