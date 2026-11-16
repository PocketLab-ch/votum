-- Der dritte Stichentscheid: der Verwalter (Story 7.9).
--
-- MEG Umgebung Art. 7 Ziff. 5: «Bei Stimmengleichheit entscheidet der
-- Verwalter.» Die Anwendung kann diesen Fall **nicht ausrechnen** — sie kennt
-- den Willen des Verwalters nicht. Sie hält deshalb an, nennt die Fundstelle
-- und nimmt den Entscheid entgegen.
--
-- Der Entscheid gehört an den **Durchgang** und nicht an die Gemeinschaft: Er
-- gilt für diese eine Abstimmung, wird von einer benannten Person getroffen und
-- ist Teil des Beschlusses. An der Gemeinschaft steht nur die Regel, dass es ihn
-- gibt.

ALTER TABLE stweg DROP CONSTRAINT IF EXISTS stweg_stichentscheid;
ALTER TABLE stweg ADD CONSTRAINT stweg_stichentscheid
    CHECK (tie_break IN ('keiner', 'wertquote', 'verwalter'));

ALTER TABLE snapshot DROP CONSTRAINT IF EXISTS snapshot_stichentscheid;
ALTER TABLE snapshot ADD CONSTRAINT snapshot_stichentscheid
    CHECK (tie_break IN ('keiner', 'wertquote', 'verwalter'));

-- ── Der Entscheid am Durchgang ─────────────────────────────────────────────
ALTER TABLE voting_round ADD COLUMN tie_break_choice   text;
ALTER TABLE voting_round ADD COLUMN tie_break_by       text;
ALTER TABLE voting_round ADD COLUMN tie_break_reason   text;
ALTER TABLE voting_round ADD COLUMN tie_break_at       timestamptz;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_stichentscheid_wahl
    CHECK (tie_break_choice IS NULL OR tie_break_choice IN ('yes', 'no'));

-- Ein Entscheid ohne Namen wäre im Protokoll wertlos: Angefochten wird genau
-- diese Person und ihre Befugnis. Und ohne Zeitpunkt liesse sich nicht zeigen,
-- dass er nach dem Schliessen der Abstimmung gefallen ist und nicht davor.
ALTER TABLE voting_round ADD CONSTRAINT voting_round_stichentscheid_vollstaendig
    CHECK (
        tie_break_choice IS NULL
        OR (length(btrim(coalesce(tie_break_by, ''))) >= 2 AND tie_break_at IS NOT NULL)
    );

COMMENT ON COLUMN voting_round.tie_break_choice IS
    'Entscheid bei Stimmengleichheit, wo das Reglement ihn einer Person zuweist.';
COMMENT ON COLUMN voting_round.tie_break_by IS
    'Wer entschieden hat — im Protokoll der Nachweis der Befugnis.';
