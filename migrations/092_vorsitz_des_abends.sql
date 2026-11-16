-- Wer den Vorsitz des gemeinsamen Abends fuehrte und wer schrieb.
--
-- **Der Auftrag** (Auftraggeber, 26.08.2026): «Auch bei einer gemeinsamen Versammlung
-- muss der Vorsitz benannt werden.»
--
-- Migration 091 hat die beiden Felder an `meeting` gehaengt — also an die
-- einzelne Versammlung. Am gemeinsamen Abend entsteht aber **ein** Protokoll
-- fuer alle Haeuser (Auftraggeber, 12.08.2026: «Es gibt dann ein Protokoll fuer die
-- Versammlung. Nicht pro Haus.»), und `gemeinsamesprotokoll.ts` setzte seine
-- Unterschriftszeilen weiterhin ohne Namen. Ausgerechnet dort ist der Name am
-- noetigsten: Am Verbundabend fuehrt **eine** Person mehrere Gemeinschaften,
-- und ohne Angabe traegt das eine Dokument, das alle unterschreiben, keine
-- einzige Zurechnung.
--
-- **Warum am Abend und nicht je Haus.** Die Felder an `meeting` haetten sich
-- fuer den Abend zusammensuchen lassen — aber dann stuende die Frage «und was,
-- wenn die fuenf Haeuser fuenf verschiedene Namen tragen?» in jeder Ausgabe neu.
-- Der Abend hat einen Vorsitz, das Dokument hat eine Unterschriftszeile, und
-- deshalb hat der Abend das Feld. Die Felder an `meeting` bleiben unberuehrt:
-- Sie tragen das Protokoll der **einzeln** gefuehrten Versammlung.
--
-- Rechtslage und Begruendung wie in Migration 091: Der gesetzliche
-- Mindestinhalt sind die Beschluesse (ZGB Art. 712n Abs. 2), gebraucht wird der
-- Name fuer die Unterzeichnung «durch den Verfasser und den Vorsitzenden»
-- (SVIT-Kommentar, Wermelinger 2023, Rz. 107 ad Art. 712n). Also wieder zwei
-- freie Textfelder, wieder freiwillig, wieder dieselben Schranken.

ALTER TABLE meeting_day
    ADD COLUMN chair_label text,
    ADD COLUMN minutes_keeper_label text;

ALTER TABLE meeting_day
    ADD CONSTRAINT meeting_day_vorsitz_nicht_leer
        CHECK (chair_label IS NULL OR length(btrim(chair_label)) BETWEEN 2 AND 120),
    ADD CONSTRAINT meeting_day_protokollfuehrung_nicht_leer
        CHECK (minutes_keeper_label IS NULL
               OR length(btrim(minutes_keeper_label)) BETWEEN 2 AND 120);

COMMENT ON COLUMN meeting_day.chair_label IS
    'Wer den Vorsitz des Abends fuehrte — freier Text, wie bei der einzelnen '
    'Versammlung (Migration 091). Ohne Angabe bleibt die Unterschriftszeile leer.';
COMMENT ON COLUMN meeting_day.minutes_keeper_label IS
    'Wer das gemeinsame Protokoll schrieb — freier Text; der SVIT-Kommentar '
    'nennt dafuer ausdruecklich auch Dritte (Notar, Angestellter des Verwalters).';
