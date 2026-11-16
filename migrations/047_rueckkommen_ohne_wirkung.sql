-- 047 — Ein erfolgloses Rückkommen lässt den ersten Beschluss stehen (FR-44)
--
-- **Der Fehler, den diese Migration behebt.** Migration 045 ersetzte den
-- früheren Durchgang, sobald der zweite geschlossen wurde — gleichgültig, wie er
-- ausging. Damit verschwand ein gefasster Beschluss, ohne dass je ein Beschluss
-- ihn abgeändert hätte.
--
-- Das Bundesgericht sagt das Gegenteil (5C.40/2005 E. 3, zu Art. 712m Abs. 2
-- i.V.m. Art. 66 ZGB):
--
--   «Solche Beschlüsse treten nicht wie ein Urteil in Rechtskraft. Sie werden
--   zwar für alle Mitglieder verbindlich, können aber grundsätzlich jederzeit
--   und voraussetzungslos widerrufen oder abgeändert werden, was bedeutet, dass
--   ein früherer Beschluss nur soweit verbindlich bleibt, als er **nicht durch
--   einen späteren Beschluss abgeändert** wird.»
--
-- Eine gescheiterte Abstimmung ist kein abändernder Beschluss. Der frühere
-- bleibt also in Kraft.
--
-- **Wie das festgehalten wird.** Der erfolglose zweite Durchgang wird nicht
-- gelöscht und nicht versteckt — er hat stattgefunden und ist gezählt worden.
-- Er bekommt eine eigene Ersetzungsart, damit für die Auszählung wieder der
-- erste Durchgang massgebend ist und das Protokoll den Vorgang beim Namen
-- nennen kann: zurückgekommen, erneut abgestimmt, Mehr nicht erreicht, alter
-- Beschluss bleibt.

ALTER TABLE voting_round DROP CONSTRAINT voting_round_ersetzungsart;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_ersetzungsart CHECK (
    supersede_kind IS NULL
    OR supersede_kind IN ('korrektur', 'rueckkommen', 'rueckkommen_erfolglos')
);

COMMENT ON COLUMN voting_round.supersede_kind IS
    'korrektur = der Durchgang war fehlerhaft (Überholung); rueckkommen = die '
    'Versammlung hat neu entschieden; rueckkommen_erfolglos = es wurde '
    'zurückgekommen, der erneute Antrag erreichte das Mehr aber nicht — der '
    'frühere Beschluss bleibt in Kraft (BGer 5C.40/2005 E. 3).';
