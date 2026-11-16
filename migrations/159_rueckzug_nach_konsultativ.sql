-- 159 — Rückzug nach einer konsultativen Abstimmung
--
-- Auftrag `.auftraege/2026-10-13-votum-h7-rang-und-konsultativ.md`, Teil D.
--
-- **Der Fall.** Nach einer konsultativen Abstimmung (Migration 158) ist das
-- Geschäft nicht entschieden (Produktentscheid 14.10.2026, «Ja, offen»): Der
-- Durchgang ergab «kein Beschluss», und es gibt nichts, was der Versammlung
-- gehörte. Der Antragsteller kann den Antrag deshalb noch zurückziehen,
-- etwa weil das Meinungsbild deutlich dagegen stand.
--
-- **Die Schranke aus Migration 044** wies jeden Rückzug ab, sobald zum
-- Traktandum ein nicht überholter Durchgang bestand. Sie bleibt, wie sie ist,
-- mit einer Ausnahme: ein **geschlossener** konsultativer Durchgang. Ein
-- offener sperrt weiter, denn während abgestimmt wird, zieht niemand zurück.
-- Der konsultative Durchgang bleibt stehen, nicht überholt; das Protokoll
-- nennt den Rückzug und seine Zahlen.

CREATE OR REPLACE FUNCTION agenda_rueckzug_nur_vor_der_abstimmung() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL THEN
        IF EXISTS (
            SELECT 1 FROM voting_round r
             WHERE r.agenda_item_id = NEW.id AND r.superseded_at IS NULL
               AND NOT (r.consultative AND r.state = 'geschlossen')
        ) THEN
            RAISE EXCEPTION
                'Über «%» wurde bereits abgestimmt. Ein gefasster Beschluss lässt sich nicht durch Rückzug beseitigen; dafür gibt es den Rückkommensantrag (FR-44).',
                NEW.title;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
