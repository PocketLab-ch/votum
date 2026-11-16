-- Wann ein Traktandum aufgerufen wurde — nicht nur, welches.
--
-- **Der Anlass** (Auftraggeber, 25.08.2026): «ich habe bei Mit- und
-- Stockwerkeigentümerversammlung Nirgendwerk die Abstimmung für das Traktandum
-- 2.1 gemacht und das Traktandum geschlossen. […] Wenn ich nun das Traktandum
-- 2.2 aufrufe, bleibt die Präsentationsansicht bei 2.1 stehen.»
--
-- **Warum die Wand stehenblieb.** Am gemeinsamen Abend ruft die Steuerung je
-- Haus auf (AD-10); welchen Punkt der Saal gerade führt, leitete die Wand aus
-- den Häusern ab — «der am häufigsten aufgerufene». Bei einem Punkt, den jedes
-- Haus für sich abstimmt, hat aber jedes Haus sein eigenes Traktandum: zwei
-- Häuser, zwei Kennungen, je einmal gezählt. Der Gleichstand fiel auf das erste
-- Haus in der Reihenfolge — alphabetisch, und damit für immer dasselbe. Am
-- Prüflauf vom 24.08. nachgemessen: 11:07 wurde die MEG aufgerufen (2.1),
-- 11:11 ihr Ergebnis verkündet, 11:14 Nirgendweg 5/5a (2.2) — und die Wand
-- blieb bei 2.1, weil «MEG …» vor «Nirgendweg …» steht.
--
-- **Die Häufigkeit war nie die Frage.** Der Saal spricht über das, was zuletzt
-- aufgerufen wurde. Diese Angabe fehlte schlicht, und ohne sie muss man raten.
--
-- **Kein zweiter Schreiber.** Die Spalte steht neben `current_agenda_item_id`
-- und wird an derselben einen Stelle gesetzt (`stelleAufTraktandum`) — sie sagt
-- «wann», nicht «was». Wer den Aufruf zurücknimmt, löscht beides.

ALTER TABLE meeting
    ADD COLUMN current_agenda_item_at timestamptz;

COMMENT ON COLUMN meeting.current_agenda_item_at IS
    'Wann current_agenda_item_id gesetzt wurde. Die gemeinsame Wand zeigt den '
    'zuletzt aufgerufenen Punkt des Abends; ohne diese Angabe fiel sie bei '
    'Gleichstand auf die alphabetische Reihenfolge zurück.';

-- Bestehende Aufrufe bekommen ihren echten Zeitpunkt aus dem Verlauf statt
-- eines erfundenen. `meeting.agenda.current` hält jeden Aufruf fest — gesucht
-- ist der jüngste, dessen `nachher` dem heute gesetzten Punkt entspricht.
--
-- Wo sich keiner findet (Verlauf gekürzt, Punkt von Hand gesetzt), wird der
-- Zeitpunkt der Eröffnung genommen und ersatzweise `now()`: Der CHECK unten
-- verlangt einen Wert, und ein alter ist ehrlicher als ein frischer — er
-- verliert jedes Rennen gegen den nächsten echten Aufruf.
UPDATE meeting m
   SET current_agenda_item_at = COALESCE(
       (SELECT max(a.occurred_at)
          FROM audit_entry a
         WHERE a.subject_type = 'meeting'
           AND a.subject_id = m.id::text
           AND a.event_type = 'meeting.agenda.current'
           AND a.detail ->> 'nachher' = m.current_agenda_item_id::text),
       m.opened_at,
       now())
 WHERE m.current_agenda_item_id IS NOT NULL;

-- **Der CHECK erst nach dem Nachtragen.** Ein CHECK prüft beim Anlegen jede
-- bestehende Zeile; stünde er oben, scheiterte die Migration an jeder laufenden
-- Versammlung mit aufgerufenem Punkt.
ALTER TABLE meeting
    -- Beides zusammen oder keines: Ein Zeitpunkt ohne Punkt gehört zu nichts,
    -- ein Punkt ohne Zeitpunkt zwingt die Wand zurück ans Raten. Der CHECK ist
    -- hier der eigentliche Wächter: Er zwingt JEDE der drei Stellen, die
    -- `current_agenda_item_id` schreiben, den Zeitpunkt mitzuschreiben —
    -- `stelleAufTraktandum`, `oeffneAbstimmung` und das Schliessen der
    -- Versammlung. Eine vergessene vierte fällt beim ersten Schreiben auf,
    -- nicht erst im Saal.
    ADD CONSTRAINT meeting_aufruf_vollstaendig CHECK (
        (current_agenda_item_id IS NULL AND current_agenda_item_at IS NULL)
        OR (current_agenda_item_id IS NOT NULL AND current_agenda_item_at IS NOT NULL)
    );
