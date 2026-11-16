-- 131 — Rückkommen, dann Neuabstimmung: der frühere Beschluss gilt wieder
--
-- Auftrag `.auftraege/2026-09-29-votum-rueckkommen-neuabstimmung.md`,
-- Herkunft `docs/freigabe.md`, Zeile «Offen: Reste zur Universalversammlung»,
-- Punkt 9.
--
-- **Der Anlass.** Beschliesst die Versammlung nach einem Rückkommen neu, wird
-- der frühere Durchgang beim Schliessen des neuen als `rueckkommen` überholt.
-- Setzt die Leitung danach auf den neuen Durchgang eine Neuabstimmung an, ist
-- auch dieser überholt, und bisher galt gar keiner mehr. Votum lässt den
-- früheren wieder gelten: Der Rückkommensbeschluss hat einen angenommenen
-- Antrag nur unter einer Bedingung aufgehoben, «Kommt der neue Beschluss nicht
-- zustande, bleibt der bisherige in Kraft», ausgelegt nach dem
-- Vertrauensprinzip (Rz. 133b ad Art. 712n), und einen Durchgang, den die
-- Leitung als fehlerhaft überholt, hält Votum nicht für einen solchen neuen
-- Beschluss (Fachprüfung 29.09.2026; Hintergrund Rz. 202a ad Art. 712g). War
-- der Antrag abgelehnt, braucht es die Bedingung nicht: Die Ablehnung ist der
-- Stand vor dem Rückkommen. **Offen** ist, ob die Leitung einen verkündeten
-- Durchgang überhaupt so überholen darf (Rz. 207 ad Art. 712m;
-- `docs/freigabe.md`). Die Neuabstimmung nimmt die Überholung des früheren
-- zurück (`setzeNeuabstimmungAn`).
--
-- **1. Welcher Durchgang welchen ersetzt hat.** Bisher liess sich das nur aus
-- dem gleichen Zeitstempel erschliessen; jetzt steht es da. Der Nachtrag stützt
-- sich genau auf diesen Zeitstempel: Überholung und Schliessen geschehen in
-- derselben Transaktion (`schliesseInTransaktion`), `now()` ist darin derselbe
-- Wert. Versiegelte Versammlungen bleiben aussen vor; der Trigger
-- `voting_round_nach_siegel` (Migration 039) wiese sie ab, und eine
-- Neuabstimmung gibt es dort nicht mehr. Der Verweis bindet wie überall über
-- Kennung und Betreiber.
--
-- **2. Die Neuabstimmung gibt den Rückkommensbeschluss zurück.** «Ein
-- Rückkommensbeschluss trägt genau einen Durchgang» (Migration 045) zählt einen
-- als `korrektur` überholten Durchgang nicht mehr mit; der nächste läuft wieder
-- unter dem Rückkommensbeschluss und entscheidet beim Schliessen wie der
-- überholte. Dieselbe Regel steht im Kern (`verbrauchtDenRueckkommensantrag`)
-- und in den Abfragen, die den Antrag als verbraucht erkennen.

ALTER TABLE voting_round ADD COLUMN superseded_by_round_id uuid;

ALTER TABLE voting_round
    ADD CONSTRAINT voting_round_ersetzt_durch
    FOREIGN KEY (superseded_by_round_id, operator_id) REFERENCES voting_round (id, operator_id);

UPDATE voting_round frueher
   SET superseded_by_round_id = neu.id
  FROM voting_round neu
 WHERE frueher.supersede_kind = 'rueckkommen'
   AND neu.operator_id = frueher.operator_id
   AND neu.agenda_item_id = frueher.agenda_item_id
   AND neu.id <> frueher.id
   AND neu.reconsideration_item_id IS NOT NULL
   AND neu.closed_at = frueher.superseded_at
   AND NOT versammlung_versiegelt(frueher.meeting_id);

COMMENT ON COLUMN voting_round.superseded_by_round_id IS
    'Bei supersede_kind = rueckkommen: der Durchgang, dessen Beschluss nach dem Rückkommen '
    'diesen ersetzt hat. Wird dieser als korrektur überholt, gilt der hier wieder (Migration 131).';

DROP INDEX voting_round_ein_durchgang_je_rueckkommen;

CREATE UNIQUE INDEX voting_round_ein_durchgang_je_rueckkommen
    ON voting_round (reconsideration_item_id)
    WHERE reconsideration_item_id IS NOT NULL
      AND supersede_kind IS DISTINCT FROM 'korrektur';
