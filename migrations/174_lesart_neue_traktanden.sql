-- 174 — Lesart L5: neue Traktanden an der zweiten Versammlung
--
-- **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft, F4), Block 7.
-- Eine zweite Versammlung ist mit einem Drittel der Eigentümer beschlussfähig
-- (Art. 712p Abs. 3 ZGB). Ob das auch für ein Geschäft gilt, das an der ersten
-- nicht auf der Liste stand, sagt keine Stelle; beide Seiten sind Folgerungen
-- (Rz. 3 und 49 ad Art. 712p).
--
--   reading_l5   erste     Abgestimmt wird über ein neues Traktandum nur mit
--                          der Beschlussfähigkeit einer ersten Versammlung
--                          (Vorgabe; Entscheid 0018, F4)
--                drittel   Das Drittel genügt, mit Hinweis (Entscheid 0012,
--                          bisher die einzige Lösung)
--
-- **Kein Erfordernis, keine Fassung.** L5 ändert kein Mehr, sie sperrt das
-- Eröffnen (`pruefstufeFuerTraktandumIn`, `server/neutraktanden.ts`). Die
-- Wahl friert die Momentaufnahme ein; sie ist hier die Fassung.
ALTER TABLE stweg ADD COLUMN reading_l5 text NOT NULL DEFAULT 'erste';
ALTER TABLE stweg ADD CONSTRAINT stweg_lesart_l5
    CHECK (reading_l5 IN ('erste', 'drittel'));

-- **Bestehende Momentaufnahmen bekommen `drittel`, nicht die Vorgabe**, anders
-- als bei L1 bis L4. Deren alte Fassungen trugen den Knoten nicht, die Vorgabe
-- änderte dort nichts. Hier änderte sie das Ergebnis einer Versammlung, die
-- schon nach 0012 eingeladen hat: Die Einladung nennt die Sperre nicht, und
-- eine Umstellung nach der Freigabe wirkt erst für die nächste Versammlung
-- (Konzept Lesarten, Abschnitt 3; Kriterien 3 und 14). Danach gilt für neue
-- Zeilen die Vorgabe; die Freigabe setzt den Wert ohnehin ausdrücklich.
ALTER TABLE snapshot ADD COLUMN reading_l5 text NOT NULL DEFAULT 'drittel';
ALTER TABLE snapshot ALTER COLUMN reading_l5 SET DEFAULT 'erste';
ALTER TABLE snapshot ADD CONSTRAINT snapshot_lesart_l5
    CHECK (reading_l5 IN ('erste', 'drittel'));

COMMENT ON COLUMN stweg.reading_l5 IS
    'Lesart L5, neue Traktanden an der zweiten Versammlung (Art. 712p Abs. 3 ZGB): erste (Vorgabe) oder drittel (Entscheid 0018).';
COMMENT ON COLUMN snapshot.reading_l5 IS
    'Lesart L5 der Gemeinschaft bei der Freigabe (Migration 174); Momentaufnahmen von vorher drittel.';

-- ── Konsultativ nach der Sperre ────────────────────────────────────────────
--
-- Gesperrt nach L5, darf die Versammlung konsultativ abstimmen (Entscheid
-- 0024 a). Sie ist dann beschlussfähig, nur nicht wie eine erste; die Sätze zur
-- konsultativen Abstimmung sagen sonst «nicht beschlussfähig» (Codeprüfung
-- Block 7, H1). Der Grund wird beim Eröffnen gesetzt, wie `consultative`
-- selbst; NULL heisst: die Versammlung war nicht beschlussfähig.
ALTER TABLE voting_round ADD COLUMN consultative_reason text;
ALTER TABLE voting_round ADD CONSTRAINT voting_round_konsultativgrund
    CHECK (consultative_reason IS NULL OR (consultative AND consultative_reason = 'neu_an_zweiter'));
COMMENT ON COLUMN voting_round.consultative_reason IS
    'Warum konsultativ eröffnet: neu_an_zweiter (Lesart L5, Migration 174); NULL ohne Beschlussfähigkeit.';
