-- Der gemeinsame Abend führt seine Betriebsart selbst.
--
-- **Warum** (Auftraggeber, 25.08.2026): «Kann ich in der Gruppen-Veranstaltung sagen,
-- ob von Hand gezählt wird oder über die App? […] ‹Wie wird abgestimmt?› fehlt
-- bei Gruppenveranstaltung.»
--
-- Und sie ist **hart**: Im Saal wird einheitlich gezählt. Halb Handzeichen,
-- halb Telefon liesse sich nicht führen — Einlass, Wand und Stimmerfassung
-- folgen ihr, und die Sitzungsleitung müsste zwei Verfahren gleichzeitig
-- führen. Die Begründung steht ausführlich in `docs/vererbung-abend.md`.
--
-- **Die Spalte ist die Vorgabe, nicht die Wahrheit** — dieselbe Bauart wie bei
-- `kind`/`occasion` (Migration 059). Massgebend bleibt, was an der einzelnen
-- Versammlung steht; sie geht ins Protokoll und erklärt dort, warum bei der
-- einfachen Führung keine einzelnen Zugriffszeitpunkte festgehalten sind. Die
-- Angabenseite legt die Vorgabe auf die Versammlungen um, die noch im Entwurf
-- sind; eine freigegebene bleibt stehen und wird dabei genannt.

ALTER TABLE meeting_day
    ADD COLUMN operation_mode text NOT NULL DEFAULT 'gefuehrt';

ALTER TABLE meeting_day
    ADD CONSTRAINT meeting_day_betriebsart
        CHECK (operation_mode IN ('gefuehrt', 'einfach'));

COMMENT ON COLUMN meeting_day.operation_mode IS
    'Vorgabe für die Betriebsart aller mittagenden Versammlungen — hart nach '
    'docs/vererbung-abend.md. Massgebend bleibt meeting.operation_mode.';

-- Bestehende Abende erben die Betriebsart ihrer Teilnehmerinnen, soweit die
-- sich einig sind. Wo sie es nicht sind, bleibt 'gefuehrt' stehen: Sie ist die
-- reichere Art, und wer von ihr auf 'einfach' wechselt, verliert nichts, was
-- schon erfasst wäre — umgekehrt fehlten den Eigentümern die Zugangskarten.
--
-- Ein Abend ohne Teilnehmerinnen behält den Vorgabewert; dort gibt es nichts zu
-- erben.
UPDATE meeting_day d
   SET operation_mode = 'einfach'
 WHERE EXISTS (SELECT 1 FROM meeting m WHERE m.meeting_day_id = d.id)
   AND NOT EXISTS (
       SELECT 1 FROM meeting m
        WHERE m.meeting_day_id = d.id AND m.operation_mode <> 'einfach'
   );
