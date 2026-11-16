-- 158 — Die konsultative Abstimmung: das Merkmal am Durchgang
--
-- Auftrag `.auftraege/2026-10-13-votum-h7-rang-und-konsultativ.md`, Teil B
-- (Ä-18 der Zweitprüfung vom 17.09.2026; Plan 2026-10-13, Block 4c).
--
-- **Der Fall.** Fehlt die Beschlussfähigkeit, bleibt die verbindliche
-- Abstimmung gesperrt, ohne Übersteuerung (Ä-18, `b51937d`). Die Versammlung
-- kann trotzdem wissen wollen, wie die Anwesenden zu einem Geschäft stehen.
-- Dafür eröffnet die Leitung einen Durchgang als konsultativ: Abgestimmt wird
-- wie sonst, beim Schliessen steht «kein Beschluss» mit dem Grund
-- `konsultativ` in der Auszählung (`domain/ausnahmen.ts`, `KeinBeschluss`).
-- Ohne Beschlussfähigkeit kann die Versammlung keine Beschlüsse fassen
-- (Rz. 20, 26 und 29 ad Art. 712p); das Ergebnis ist eine Meinungsäusserung,
-- nicht mehr.
--
-- **Am Durchgang, nicht am Traktandum**, wie `secret` (Migration 141): Ist die
-- Versammlung später beschlussfähig, wird über dasselbe Geschäft verbindlich
-- abgestimmt, im nächsten Durchgang. Gesetzt beim Eröffnen, danach
-- unveränderlich (wie Migration 143 für `secret`): Ein Umstellen machte aus
-- einer Meinungsäusserung nachträglich einen Beschluss oder umgekehrt.
--
-- **Nicht neben der Universalversammlung und nicht unter einem Rückkommen.**
-- Die Universalversammlung setzt voraus, dass alle da sind; dann fehlt die
-- Beschlussfähigkeit nicht. Ein Rückkommen ersetzt einen Beschluss, und ein
-- konsultativer Durchgang ergibt keinen; er verbrauchte den Antrag, ohne dass
-- etwas entschieden wäre. Die Anwendung prüft beides beim Eröffnen; die
-- Schranke hier hält es auch für einen künftigen Schreibweg.
--
-- **Bestehende Durchgänge bleiben verbindlich** (`false`).

ALTER TABLE voting_round
    ADD COLUMN consultative boolean NOT NULL DEFAULT false;

ALTER TABLE voting_round
    ADD CONSTRAINT voting_round_konsultativ_allein CHECK (
        NOT consultative
        OR (universal_mode IS NULL AND reconsideration_item_id IS NULL)
    );

CREATE OR REPLACE FUNCTION konsultativ_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.consultative IS DISTINCT FROM OLD.consultative THEN
        RAISE EXCEPTION
            'Ob ein Durchgang konsultativ ist, wird beim Eröffnen festgelegt und ist danach unveränderlich; ein Umstellen machte aus einer Meinungsäusserung einen Beschluss oder umgekehrt.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER voting_round_konsultativ_unveraenderlich
    BEFORE UPDATE OF consultative ON voting_round
    FOR EACH ROW EXECUTE FUNCTION konsultativ_unveraenderlich();

COMMENT ON COLUMN voting_round.consultative IS
    'Konsultative Abstimmung bei fehlender Beschlussfähigkeit (Ä-18): Beim Schliessen steht «kein Beschluss» mit dem Grund konsultativ in der Auszählung, die Zahlen bleiben. Beim Eröffnen gesetzt, danach unveränderlich. Nie zusammen mit universal_mode oder reconsideration_item_id.';
