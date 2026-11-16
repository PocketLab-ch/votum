-- Der Stichentscheid einer Person im Vorsitz, die selbst Stockwerkeigentümer
-- ist (Auftrag 07.10.2026, «votum-stichentscheid-kaskade», Block B).
--
-- Ein Reglement aus einer Anfrage sagt: «Ist der Vorsitzende selbst
-- Eigentümer, gibt er den Stichentscheid mit einer zweiten Stimme.» Für das
-- Ergebnis ändert das nichts, der Entscheid gibt wie jeder Stichentscheid den
-- Ausschlag. Es ändert zweierlei daneben:
--
--   - Die Empfehlung. Votum empfiehlt einem Verwalter und einem Vorsitz ohne
--     eigenes Stimmrecht die Ablehnung (Rz. 187 ad Art. 712m: kein Stimmrecht,
--     trägt die Folgen nicht, neutrale Rolle). Auf eine Eigentümerin trifft
--     diese Begründung nicht zu; Votum empfiehlt ihr keine Richtung
--     (Produktentscheid 07.10.2026).
--   - Das Protokoll. Der Stichentscheid geht nicht in die Zählung ein, sonst
--     stünde bei drei Einheiten «2 zu 1» da und sähe aus wie ein Zählfehler.
--     Er steht als eigener Satz darunter, mit dem Vermerk, dass die Person
--     selbst Eigentümerin ist.
--
-- Die Spalte sagt nur, dass die Person selbst Eigentümer ist. Ob das Reglement
-- ihren Stichentscheid «zweite Stimme» nennt, weiss die Anwendung nicht, und
-- die Texte behaupten es deshalb nicht (Laienprüfung 07.10.2026, L5 und L8).
--
-- Wer nur mit Vollmacht im Vorsitz sitzt, ist nicht «selbst Eigentümer»
-- (Fachprüfung 07.10.2026, F4b; Rz. 26 ad Art. 712m). Die Spalte ist deshalb
-- eine Angabe der Leitung beim Eintragen, nicht aus der Anwesenheit abgeleitet.

ALTER TABLE voting_round ADD COLUMN tie_break_by_owner boolean NOT NULL DEFAULT false;

-- Nur zusammen mit einem Entscheid: Ohne ihn gibt es niemanden, der
-- Eigentümer sein könnte.
ALTER TABLE voting_round ADD CONSTRAINT voting_round_stichentscheid_eigentuemer
    CHECK (NOT tie_break_by_owner OR tie_break_choice IS NOT NULL);

COMMENT ON COLUMN voting_round.tie_break_by_owner IS
    'Der Stichentscheid kam von einer Person im Vorsitz, die selbst Stockwerkeigentümer ist; er ist in den Stimmen nicht gezählt.';

-- Der Spaltenkommentar aus Migration 023 kannte nur zwei Werte (Codeprüfung
-- 07.10.2026, N4).
COMMENT ON COLUMN stweg.tie_break IS
    'Wie ein Gleichstand aufgelöst wird: keiner, wertquote, verwalter, vorsitz, wertquote_verwalter, wertquote_vorsitz (Migrationen 023, 024, 149).';
