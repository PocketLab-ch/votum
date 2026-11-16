-- 192: Lesart L13: Zählweise der Köpfe bei der «Mehrheit aller Miteigentümer»
--
-- **Der Anlass** ist Entscheid 0048 (`docs/entscheide/0048-regel-43-runde-2.md`),
-- Antworten 4 bis 6, 9 und 10. Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e
-- Abs. 2 ZGB verlangen nach ihrem Wortlaut die «Mehrheit aller Miteigentümer».
-- Die herrschende Lehre zählt die Köpfe trotzdem unter den Anwesenden und
-- Vertretenen; das Bundesgericht hat das nur für Art. 647d bestätigt (BGE 144
-- III 510 E. 2.2.4). Produktentscheid 13.11.2026: Die Gemeinschaft wählt.
--
--   reading_l13  anwesende  Köpfe unter den Anwesenden und Vertretenen (Vorgabe,
--                           herrschende Lehre; wie bis hier an jedem Traktandum)
--                alle       Köpfe unter allen Eigentümern, auch den abwesenden;
--                           wer im Ausstand ist, bleibt in der Zahl und wirkt wie
--                           ein Nein (Antwort 9)
--
-- **Gebaut wie L10** (Migration 189): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe; eingefroren bei der Freigabe in `snapshot`; am Erfordernis in
-- `agenda_item.requirement_reading_l13`, gesetzt vom Auslöser.
--
-- **Anders als L10 ändert L13 das Mehr.** Wo sie wirkt, setzt die Wahl beim
-- Herleiten die Kopfbasis (`mitKopfzaehlweise` in `src/lib/domain/lesarten.ts`),
-- und `requirement_head_base` speichert sie. Welche Wahl ein Traktandum rechnet,
-- sagt deshalb seine Kopfbasis; die Spalte hier hält die eingestellte Wahl als
-- Nachweis und für die Sätze, wo die Enthaltungsklausel sie verdrängt
-- (Antwort 10). Stellt jemand nach der Herleitung um, sagt die Freigabe ab und
-- der Kasten «Erfordernisse nachziehen» zeigt das Traktandum
-- (`zaehlweiseVeraltet`), wie bei L2 und L4.
--
-- **Kein Knoten trägt L13.** Die Schranken der Knotenlesarten
-- (`agenda_item_lesart_form`) bleiben unverändert.
ALTER TABLE stweg ADD COLUMN reading_l13 text NOT NULL DEFAULT 'anwesende';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l13
    CHECK (reading_l13 IN ('anwesende', 'alle'));

-- Bestehende Momentaufnahmen bekommen die Vorgabe. Das ist richtig: Ihre
-- Erfordernisse stammen aus Fassungen vor 2026-11-14, dort wirkt L13 nicht
-- (`KOPFZAEHLWEISE_AB`), und sie rechneten die Köpfe unter den Anwesenden und
-- Vertretenen. Die eingefrorene Wahl wirkt für sie in keine Richtung.
ALTER TABLE snapshot ADD COLUMN reading_l13 text NOT NULL DEFAULT 'anwesende';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l13
    CHECK (reading_l13 IN ('anwesende', 'alle'));

-- ── Am Erfordernis des Traktandums ─────────────────────────────────────────
--
-- NULL ohne Erfordernis, und bei jedem Traktandum von vorher; die Zählung liest
-- NULL als Vorgabe, so wie diese Traktanden gerechnet haben.
ALTER TABLE agenda_item ADD COLUMN requirement_reading_l13 text;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_lesart_l13
    CHECK (requirement_reading_l13 IS NULL OR requirement_reading_l13 IN ('anwesende', 'alle'));

-- **Die Datenbank setzt die Wahl, nicht die Schreibstelle**, wie bei L1 und L10:
-- Ein Erfordernis entsteht an vielen Stellen, und eine, die die Wahl vergässe,
-- hielte still die Vorgabe fest. Der Auslöser nimmt sie aus der Momentaufnahme
-- derselben Versammlung, vor der Freigabe aus der Gemeinschaft; was die
-- Anwendung mitschickt, überschreibt er. Die Herleitung liest dieselbe Quelle
-- (`holeLesartenIn`), Kopfbasis und Wahl stimmen beim Schreiben also überein.
-- Die Freigabe schreibt die Spalte aller Traktanden neu, nachdem sie zu einem
-- Traktandum mit anderer Zählweise abgesagt hat (`gibVersammlungFrei`).
--
-- Er läuft mit den Rechten des Aufrufers und sieht nur, was dessen Betreiber
-- sieht; eine Versammlung ohne sichtbare Gemeinschaft ergibt nicht still die
-- Vorgabe, sondern einen Abbruch der Anweisung.
--
-- **Der Name sorgt für die Reihenfolge.** BEFORE-Auslöser laufen nach Namen;
-- `agenda_aa_…` läuft vor den Wächtern an `agenda_item` (Siegel, Abgabe,
-- Rückzug). So sehen sie die Spalte, wie sie geschrieben wird, und ein
-- versiegeltes Traktandum lässt sich auch über sie nicht ändern.
CREATE OR REPLACE FUNCTION agenda_lesart_l13_setzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    wahl text;
BEGIN
    IF NEW.requirement_type IS NULL THEN
        NEW.requirement_reading_l13 := NULL;
        RETURN NEW;
    END IF;
    SELECT s.reading_l13 INTO wahl FROM snapshot s WHERE s.meeting_id = NEW.meeting_id;
    IF wahl IS NULL THEN
        SELECT g.reading_l13 INTO wahl
          FROM meeting m JOIN stweg g ON g.id = m.stweg_id
         WHERE m.id = NEW.meeting_id;
    END IF;
    IF wahl IS NULL THEN
        RAISE EXCEPTION 'Die Lesart L13 der Gemeinschaft ist für dieses Traktandum nicht zu finden.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_item_lesart_l13_quelle';
    END IF;
    NEW.requirement_reading_l13 := wahl;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_aa_lesart_l13_setzen
    BEFORE INSERT OR UPDATE OF requirement_type, requirement_version, requirement_reading_l13
    ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_lesart_l13_setzen();

-- Der Bestand bleibt NULL und zählt nach der Vorgabe, wie bisher; jede
-- Momentaufnahme von vorher trägt dieselbe Vorgabe. Ein Nachführen hier liefe
-- unter dem Zeilenschutz ohne Betreiber ins Leere und an versiegelten
-- Versammlungen in deren Sperre.

COMMENT ON COLUMN stweg.reading_l13 IS
    'Lesart L13, Zählweise der Köpfe bei der «Mehrheit aller Miteigentümer» (ZGB Art. 647a Abs. 2, 647b Abs. 1, 647c, 647e Abs. 2): anwesende (Vorgabe, herrschende Lehre) oder alle (Wortlaut; Entscheid 0048, Antworten 4 bis 6).';
COMMENT ON COLUMN snapshot.reading_l13 IS
    'Lesart L13 der Gemeinschaft bei der Freigabe (Migration 192).';
COMMENT ON COLUMN agenda_item.requirement_reading_l13 IS
    'Lesart L13, wie sie die Gemeinschaft beim Speichern des Erfordernisses eingestellt hatte; gesetzt vom Auslöser agenda_lesart_l13_setzen. Welche Wahl gerechnet wird, sagt requirement_head_base. NULL ohne Erfordernis oder von vor Migration 192.';
