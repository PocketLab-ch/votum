-- Die Handzählung hält den Stand ihres Augenblicks fest.
--
-- Befund S5 aus dem Sicherheitsdurchgang vom 09.10.2026
-- (`docs/befunde-sicherheitsdurchgang-2026-10-09.md`). Die Erfassung prüfte
-- die gezählten Hände gegen die Anwesenden dieses Augenblicks, das Schliessen
-- rechnete sie gegen die Anwesenden beim Schliessen. Ging dazwischen jemand,
-- warf das Schliessen «mehr Stimmen als Stimmberechtigte», und über
-- `schliesseOffeneAbstimmungen` auch der Schluss der Versammlung.
--
-- **Bei der Handzählung ist das Zählen die Abstimmung.** Die Hände werden im
-- Saal in einem Augenblick gezählt, nicht über die Dauer des Durchgangs
-- gesammelt wie Einzelstimmen. Wer danach geht, hat mitgestimmt; wer danach
-- kommt, nicht. Die Bezugsgrösse ist deshalb der Stand beim Zählen, wie beim
-- Beschluss von Hand der Stand beim Eintragen (Block 6, 02.10.2026).
--
-- Die Spalte trägt die Anwesenden, Vertretungen, den Ausstand und die
-- Betroffenen, in derselben Form wie `attendance_json` und `affected_json`.
-- Das Schliessen übernimmt sie dorthin, statt neu zu lesen. Die Erfassung prüft
-- gegen genau diesen Stand, und das Schliessen rechnet mit ihm; die beiden
-- können nicht mehr auseinanderlaufen.
--
-- Leer bei Handzählungen von vorher: Dort liest das Schliessen wie bisher den
-- Stand beim Schliessen.

ALTER TABLE voting_round
    ADD COLUMN tally_stand_json jsonb;

ALTER TABLE voting_round
    -- Ein Stand ohne Zählung ist ein Stand ohne Gegenstand.
    ADD CONSTRAINT voting_round_summenstand CHECK (
        tally_stand_json IS NULL OR tally_yes IS NOT NULL
    );

COMMENT ON COLUMN voting_round.tally_stand_json IS
    'Anwesende, Vertretungen, Ausstand und Betroffene im Augenblick der '
    'Handzählung. Das Schliessen übernimmt sie nach attendance_json und '
    'affected_json (src/lib/server/abstimmung.ts, erfasseSummen).';
