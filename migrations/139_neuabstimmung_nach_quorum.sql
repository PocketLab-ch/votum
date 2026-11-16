-- 139 — Direkte Neuabstimmung nach Eintritt der Beschlussfähigkeit
--
-- Auftrag `.auftraege/2026-10-03-votum-neuabstimmung-nach-beschlussfaehigkeit.md`;
-- Produktentscheid 03.10.2026 («Einstellbar, Vorgabe direkt»,
-- `.auftraege/2026-10-03-votum-acht-entscheide.md`, Punkt 8).
--
-- **Der Fall.** Eine Versammlung ist nicht beschlussfähig (ZGB Art. 712p), und
-- die Sitzungsleitung hält einen Beschluss von Hand fest. Treffen später am
-- selben Abend weitere Eigentümer ein, wird die Versammlung beschlussfähig.
-- Votum verlangte für einen zweiten Durchgang über denselben Gegenstand bisher
-- einen angenommenen Rückkommensantrag. Die rechtliche Klärung (`quellen`,
-- Frage 59) fand keine Stelle zu einer zweiten Abstimmung am selben Abend; das
-- Rückkommen mit eigener Mehrheit ist eine Hausbildung und gemessen am Bestand
-- eher zu streng. Der Entscheid: je Gemeinschaft umstellbar, Vorgabe «direkt».
--
-- **Die Einstellung an der Gemeinschaft.** `revote_after_quorum` steht auf
-- `stweg` wie die übrigen Verfahrensangaben (Universalversammlung,
-- Änderungsschranke, Fristen). Geschrieben wird sie über einen eigenen Weg
-- (`server/ausnahmen.ts`-Muster), damit das Angabenformular der Gemeinschaft
-- sie nicht mitlöscht. Die Vorgabe gilt für alle bestehenden Gemeinschaften,
-- weil sie die sicherste Lesart der Hausbildung ersetzt, nicht eine bestehende
-- Angabe ändert.
--
-- **Die zwei Überholungsarten.** Der zweite Durchgang ersetzt den von Hand
-- festgehaltenen, wenn er einen Beschluss ergibt (angenommen oder abgelehnt),
-- und der frühere bleibt in Kraft, wenn gar kein Beschluss zustande kommt.
-- Das sind zwei verschiedene Lagen, und beide brauchen einen eigenen Grund:
--
--   - `nachquorum` — der neue Durchgang hat neu entschieden und ersetzt den
--     früheren; `superseded_by_round_id` zeigt auf ihn.
--   - `nachquorum_erfolglos` — der neue Durchgang endete ohne Beschluss; der
--     frühere bleibt massgebend, wie bei `rueckkommen_erfolglos`.
--
-- Weder `korrektur` (die Leitung stellt keinen Fehler richtig) noch
-- `rueckkommen` (es gab keinen Rückkommensbeschluss) träfe zu; dieselbe
-- Überlegung wie bei `neueroeffnung` (Migration 130) und `notweg` (134).

ALTER TABLE stweg
    ADD COLUMN revote_after_quorum text NOT NULL DEFAULT 'direkt';

ALTER TABLE stweg ADD CONSTRAINT stweg_revote_after_quorum
    CHECK (revote_after_quorum IN ('direkt', 'rueckkommen'));

COMMENT ON COLUMN stweg.revote_after_quorum IS
    'Wie ein zweiter Durchgang über denselben Gegenstand möglich wird, wenn die Versammlung erst nachträglich beschlussfähig wird: direkt = ohne Rückkommen (Vorgabe), rueckkommen = über einen angenommenen Rückkommensantrag (wie bisher).';

ALTER TABLE voting_round DROP CONSTRAINT voting_round_ersetzungsart;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_ersetzungsart CHECK (
    supersede_kind IS NULL
    OR supersede_kind IN ('korrektur', 'neueroeffnung', 'rueckkommen', 'rueckkommen_erfolglos', 'notweg',
                          'nachquorum', 'nachquorum_erfolglos')
);

COMMENT ON COLUMN voting_round.supersede_kind IS
    'Warum überholt: korrektur = die Leitung hat eine Neuabstimmung angesetzt (etwa weil der '
    'Durchgang fehlerhaft war); neueroeffnung = nach einem Weggang ohne Beschluss neu eröffnet, '
    'sobald wieder alle da waren; rueckkommen = durch den Beschluss nach Rückkommen ersetzt; '
    'rueckkommen_erfolglos = Rückkommen ohne neuen Beschluss, der frühere gilt; '
    'notweg = durch einen von der Sitzungsleitung von Hand festgehaltenen Beschluss überholt; '
    'nachquorum = durch den zweiten Durchgang nach Eintritt der Beschlussfähigkeit ersetzt; '
    'nachquorum_erfolglos = dieser Durchgang nach Eintritt der Beschlussfähigkeit endete ohne '
    'Beschluss, der frühere Beschluss von Hand bleibt in Kraft.';

COMMENT ON COLUMN voting_round.superseded_by_round_id IS
    'Bei supersede_kind = rueckkommen: der Durchgang, dessen Beschluss nach dem Rückkommen '
    'diesen ersetzt hat. Wird dieser als korrektur überholt, gilt der hier wieder (Migration 131). '
    'Bei notweg: der von Hand festgehaltene Durchgang, der diesen überholt hat (Migration 134). '
    'Bei nachquorum: der zweite Durchgang nach Eintritt der Beschlussfähigkeit, der diesen '
    'ersetzt hat (Migration 139).';
