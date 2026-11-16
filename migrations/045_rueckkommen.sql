-- 045 — Der Rückkommensantrag (Welle 3, FR-44)
--
-- **Der Fall.** Über Traktandum 5 ist abgestimmt, und danach kommt heraus, was
-- vorher niemand wusste: eine zweite Offerte, ein Rechenfehler, ein Einwand,
-- der die Sache in anderem Licht zeigt. Die Versammlung soll noch einmal
-- entscheiden dürfen — aber nicht, weil es die Sitzungsleitung so will.
--
-- **Zwei Wege, die man nicht verwechseln darf:**
--
--   * **Überholen** (seit Migration 020): Der Durchgang war fehlerhaft — falsch
--     gezählt, zu früh geschlossen, die halbe Wand hat nicht mitbekommen, worum
--     es ging. Die Sitzungsleitung stellt das richtig; die Versammlung hat dazu
--     nichts zu beschliessen, denn ihr Wille war nie richtig erfasst.
--
--   * **Rückkommen** (hier): Der Durchgang war einwandfrei, der Wille ist
--     erfasst — und die Versammlung will ihn ändern. Das steht **ihr** zu, nicht
--     der Leitung. Deshalb wird zuerst gesondert darüber abgestimmt.
--
-- Die Unterscheidung ist nicht bloss Begrifflichkeit: Wer ein einwandfreies
-- Ergebnis als «fehlerhaft» überholt, nimmt der Versammlung eine Abstimmung ab,
-- die ihr zusteht.
--
-- **Der ursprüngliche Beschluss bleibt gültig, bis der neue gefasst ist.**
-- Zwischen dem angenommenen Rückkommen und dem Schluss des neuen Durchgangs
-- gilt weiterhin, was beschlossen war — sonst entstünde eine Lücke, in der die
-- Gemeinschaft zu derselben Frage gar keinen Beschluss hätte.

-- ── Der Rückkommensantrag als eigenes Traktandum ───────────────────────────
--
-- **Warum ein Traktandum und keine eigene Tabelle.** Über das Rückkommen wird
-- abgestimmt — mit Erfordernis, Auszählung, Ergebnis, Eintrag im Protokoll und
-- im Abschlusspaket. All das gibt es bereits. Eine eigene Tabelle hiesse, jede
-- dieser Mechaniken ein zweites Mal zu bauen, und die zweite Fassung liefe der
-- ersten früher oder später davon.
ALTER TABLE agenda_item ADD COLUMN reconsiders_item_id uuid;

ALTER TABLE agenda_item
    ADD CONSTRAINT agenda_rueckkommen_ziel
    FOREIGN KEY (reconsiders_item_id, operator_id) REFERENCES agenda_item (id, operator_id);

-- Die dritte Art eines während der Sitzung aufgenommenen Traktandums.
ALTER TABLE agenda_item DROP CONSTRAINT agenda_spontanart;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_spontanart CHECK (
    (is_spontaneous = false AND spontaneous_kind IS NULL)
    OR (is_spontaneous = true AND spontaneous_kind IN ('folgeantrag', 'neu', 'rueckkommen'))
);

-- Ein Ziel gibt es nur beim Rückkommen, und ein Rückkommen nur mit Ziel:
-- Andernfalls stünde ein Antrag da, der auf nichts zurückkommt.
ALTER TABLE agenda_item ADD CONSTRAINT agenda_rueckkommen_mit_ziel CHECK (
    (spontaneous_kind = 'rueckkommen') = (reconsiders_item_id IS NOT NULL)
);

ALTER TABLE agenda_item ADD CONSTRAINT agenda_rueckkommen_nicht_auf_sich CHECK (
    reconsiders_item_id IS NULL OR reconsiders_item_id <> id
);

COMMENT ON COLUMN agenda_item.reconsiders_item_id IS
    'Beim Rückkommensantrag: das behandelte Traktandum, auf das zurückgekommen werden soll (FR-44).';

CREATE INDEX agenda_item_rueckkommen_idx ON agenda_item (reconsiders_item_id)
    WHERE reconsiders_item_id IS NOT NULL;

-- ── Worauf sich ein zweiter Durchgang stützt ───────────────────────────────
--
-- **Ohne Beschluss kein zweiter Durchgang.** Bisher liess sich zu einem
-- behandelten Traktandum einfach eine weitere Abstimmung eröffnen — die Regeln
-- kannten nur «es ist schon eine offen». Damit hätte die Sitzungsleitung ein
-- unliebsames Ergebnis so oft wiederholen lassen können, bis es passt.
--
-- Ab hier trägt jeder weitere Durchgang seinen Grund bei sich: entweder die
-- Überholung eines fehlerhaften Durchgangs oder einen **angenommenen**
-- Rückkommensantrag. Am Durchgang steht, worauf er sich stützt; im
-- Abschlusspaket lässt sich das nachlesen.
ALTER TABLE voting_round ADD COLUMN reconsideration_item_id uuid;

ALTER TABLE voting_round
    ADD CONSTRAINT voting_round_rueckkommen
    FOREIGN KEY (reconsideration_item_id, operator_id) REFERENCES agenda_item (id, operator_id);

-- **Ein Rückkommensbeschluss trägt genau einen Durchgang.** Sonst liesse sich
-- mit einer einmal erteilten Erlaubnis beliebig oft neu abstimmen, bis das
-- Ergebnis gefällt.
CREATE UNIQUE INDEX voting_round_ein_durchgang_je_rueckkommen
    ON voting_round (reconsideration_item_id)
    WHERE reconsideration_item_id IS NOT NULL;

COMMENT ON COLUMN voting_round.reconsideration_item_id IS
    'Der angenommene Rückkommensantrag, auf den sich dieser Durchgang stützt (FR-44). NULL beim ersten Durchgang und bei einer Überholung.';

-- ── Warum ein Durchgang ersetzt wurde ──────────────────────────────────────
--
-- Bisher gab es nur einen Grund im Klartext. Für das Protokoll reicht das
-- nicht: «ersetzt, weil falsch gezählt» ist etwas anderes als «ersetzt durch
-- den Beschluss nach Rückkommen». Im ersten Fall hat die Versammlung nie so
-- entschieden; im zweiten hat sie zweimal entschieden, und beides gilt es
-- auszuweisen.
ALTER TABLE voting_round ADD COLUMN supersede_kind text;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_ersetzungsart CHECK (
    supersede_kind IS NULL OR supersede_kind IN ('korrektur', 'rueckkommen')
);

-- Bestehende Ersetzungen waren stets Korrekturen — den Rückkommensantrag gab
-- es noch nicht.
UPDATE voting_round SET supersede_kind = 'korrektur' WHERE superseded_at IS NOT NULL;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_ersetzungsart_vollstaendig CHECK (
    (superseded_at IS NULL) = (supersede_kind IS NULL)
);

COMMENT ON COLUMN voting_round.supersede_kind IS
    'korrektur = der Durchgang war fehlerhaft (Überholung); rueckkommen = die Versammlung hat neu entschieden (FR-44).';
