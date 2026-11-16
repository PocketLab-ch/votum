-- 134 — Überholungsart `notweg`: überholt durch einen von Hand festgehaltenen Beschluss
--
-- Plan `docs/plan-beschluss-von-hand-2026-09-30.md`, Block 1.
--
-- **Der Anlass.** Produktentscheid 30.09.2026: Solange die Versammlung läuft,
-- kann die Sitzungsleitung je Traktandum einen Beschluss von Hand festhalten,
-- an allen Sperren beim Eröffnen und an der Auszählung vorbei. Der Durchgang
-- dazu entsteht geschlossen und verkündet (`haltBeschlussVonHandFest`), und
-- was vorher am selben Traktandum galt, wird überholt: der geltende Durchgang
-- und ein offener, dessen Schliessen gerade die Sperre sein kann, an der die
-- Leitung vorbei will.
--
-- **Warum eine eigene Art.** `korrektur` liest das Protokoll als «Neuabstimmung
-- angesetzt» und gibt einen Rückkommensbeschluss zurück
-- (`verbrauchtDenRueckkommensantrag`); `rueckkommen` heisst, die Versammlung
-- habe nach einem Rückkommen neu abgestimmt, und `massgebender_durchgang` folgt
-- dort dem Verweis über zwei Traktanden. Beides träfe hier nicht zu. Dieselbe
-- Überlegung wie bei `neueroeffnung` (Migration 130).
--
-- `superseded_by_round_id` zeigt auch bei `notweg` auf den Durchgang, der
-- überholt hat. Die Kette in `massgebender_durchgang` (Migration 133) folgt dem
-- Verweis weiter nur bei `rueckkommen`; bei `notweg` liegen beide Durchgänge am
-- selben Traktandum, und der jüngste nicht überholte ist ohne Kette gefunden.

ALTER TABLE voting_round DROP CONSTRAINT voting_round_ersetzungsart;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_ersetzungsart CHECK (
    supersede_kind IS NULL
    OR supersede_kind IN ('korrektur', 'neueroeffnung', 'rueckkommen', 'rueckkommen_erfolglos', 'notweg')
);

COMMENT ON COLUMN voting_round.supersede_kind IS
    'Warum überholt: korrektur = die Leitung hat eine Neuabstimmung angesetzt (etwa weil der '
    'Durchgang fehlerhaft war); neueroeffnung = nach einem Weggang ohne Beschluss neu eröffnet, '
    'sobald wieder alle da waren; rueckkommen = durch den Beschluss nach Rückkommen ersetzt; '
    'rueckkommen_erfolglos = Rückkommen ohne neuen Beschluss, der frühere gilt; '
    'notweg = durch einen von der Sitzungsleitung von Hand festgehaltenen Beschluss überholt.';

COMMENT ON COLUMN voting_round.superseded_by_round_id IS
    'Bei supersede_kind = rueckkommen: der Durchgang, dessen Beschluss nach dem Rückkommen '
    'diesen ersetzt hat. Wird dieser als korrektur überholt, gilt der hier wieder (Migration 131). '
    'Bei notweg: der von Hand festgehaltene Durchgang, der diesen überholt hat (Migration 134).';
