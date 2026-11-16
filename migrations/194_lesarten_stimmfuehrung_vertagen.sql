-- 194: Lesarten L15 (Stimmführung in der Höchstzahl) und L16 (Vertagen nach
-- erreichter Beschlussfähigkeit)
--
-- **Der Anlass** ist Entscheid 0054 (`docs/entscheide/0054-stimmfuehrung-und-
-- vertagen-werden-lesarten.md`), Punkte 2, 3 und 6: Beide Fragen sind offen,
-- und nach Grundsatz 0017 wählt die Gemeinschaft. L14 ist für den Vorschlag H1
-- vorgesehen, noch nicht vergeben (`.auftraege/2026-11-16-votum-h1-lesart-vorschlag.md`).
--
--   reading_l15  ausserhalb  Die Stimmführung einer Mitberechtigten für die
--                            eigene gemeinsame Partei zählt nicht zur
--                            Höchstzahl (Vorgabe, wie bis hier; Frage 77)
--                mitzaehlen  Sie zählt mit, wie eine gewöhnliche Vollmacht.
--                            Organ und gesetzliche Vertretung bleiben in beiden
--                            Wahlen ausserhalb.
--
--   reading_l16  neue_erste  Vertagen nach erreichter Beschlussfähigkeit legt
--                            eine neue erste an (Vorgabe, wie bis hier; SVIT-
--                            Kommentar Rz. 20 und 34 ad Art. 712p)
--                zweite      Es legt eine zweite nach Art. 712p Abs. 3 an
--
-- **Gebaut wie L5** (Migration 174): Spalte an `stweg`, NOT NULL mit der
-- Vorgabe, eingefroren bei der Freigabe in `snapshot`. Kein Knoten und kein
-- Mehr ändert sich, deshalb keine Regelwerksfassung und keine Spalte am
-- Traktandum. Momentaufnahmen von vorher bekommen die Vorgabe: So hat Votum
-- dort gerechnet.
--
-- **`meeting.tier_by_reading`** hält an der zweiten Versammlung fest, dass sie
-- nur nach L16 eine zweite ist: Die vertagte war schon beschlussfähig.
-- Gesetzt beim Vertagen und danach nicht mehr geändert; Einladung, Protokoll
-- und Nachweis lesen es, statt es aus der Vorgängerin neu herzuleiten, damit
-- eine spätere Änderung an `warZeitweiseBeschlussfaehig` die Angabe nicht
-- verschiebt.

ALTER TABLE stweg ADD COLUMN reading_l15 text NOT NULL DEFAULT 'ausserhalb';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l15
    CHECK (reading_l15 IN ('ausserhalb', 'mitzaehlen'));
ALTER TABLE stweg ADD COLUMN reading_l16 text NOT NULL DEFAULT 'neue_erste';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l16
    CHECK (reading_l16 IN ('neue_erste', 'zweite'));

ALTER TABLE snapshot ADD COLUMN reading_l15 text NOT NULL DEFAULT 'ausserhalb';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l15
    CHECK (reading_l15 IN ('ausserhalb', 'mitzaehlen'));
ALTER TABLE snapshot ADD COLUMN reading_l16 text NOT NULL DEFAULT 'neue_erste';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l16
    CHECK (reading_l16 IN ('neue_erste', 'zweite'));

ALTER TABLE meeting ADD COLUMN tier_by_reading boolean NOT NULL DEFAULT false;
ALTER TABLE meeting ADD CONSTRAINT meeting_stufe_nach_lesart
    CHECK (NOT tier_by_reading OR tier = 'zweite');

COMMENT ON COLUMN stweg.reading_l15 IS
    'Lesart L15, Stimmführung einer Mitberechtigten in der Höchstzahl der Vollmachten: ausserhalb (Vorgabe) oder mitzaehlen (Entscheid 0054).';
COMMENT ON COLUMN stweg.reading_l16 IS
    'Lesart L16, Folgeversammlung nach Vertagen einer schon beschlussfähigen ersten: neue_erste (Vorgabe) oder zweite (Entscheid 0054).';
COMMENT ON COLUMN snapshot.reading_l15 IS
    'Lesart L15 der Gemeinschaft bei der Freigabe (Migration 194); Momentaufnahmen von vorher ausserhalb.';
COMMENT ON COLUMN snapshot.reading_l16 IS
    'Lesart L16 der Gemeinschaft bei der Freigabe (Migration 194); Momentaufnahmen von vorher neue_erste.';
COMMENT ON COLUMN meeting.tier_by_reading IS
    'Zweite Versammlung nur nach Lesart L16: Die vertagte war schon beschlussfähig (Migration 194).';
