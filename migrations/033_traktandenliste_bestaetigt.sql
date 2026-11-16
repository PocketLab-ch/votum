-- Die Traktandenliste gilt erst als erledigt, wenn jemand sie bestätigt hat.
--
-- Bisher hiess der Schritt «erledigt», sobald **ein** Traktandum vorlag. Das
-- Anlegen einer Versammlung setzt aber selbst die Pflichttraktanden aus der
-- Vorlage (Story 3.8) — also stand das Häkchen eine Sekunde nach dem Anlegen,
-- ohne dass jemand die Liste je gesehen hätte. Gemeldet am 01.08.2026: «Die
-- Traktanden sind ja nicht endgültig, weil überhaupt nicht erfasst.»
--
-- Ein hergeleitetes Häkchen ist hier grundsätzlich falsch. Ob die Liste
-- vollständig ist, weiss allein die Bewirtschaftung: Die Vorlage kennt die
-- Jahresgeschäfte, aber nicht die Rampe zur Aare. Und ein System, das
-- «vorbereitet» meldet, wo nur eine Voreinstellung steht, führt niemanden — es
-- beruhigt bloss.
--
-- Deshalb ein ausdrücklicher Vermerk. Er trägt einen Zeitpunkt und nicht ein
-- Ja/Nein: Im Streitfall zählt, wann die Liste stand, und der Verlauf hält
-- ohnehin fest, wer sie bestätigt hat.

ALTER TABLE meeting ADD COLUMN agenda_confirmed_at timestamptz;

COMMENT ON COLUMN meeting.agenda_confirmed_at IS
    'Wann die Traktandenliste als vollständig bestätigt wurde. NULL heisst: noch '
    'nicht durchgegangen — auch dann, wenn Pflichttraktanden aus der Vorlage '
    'bereits vorliegen.';

-- Bestehende Versammlungen: Was freigegeben ist, war durchgegangen — die
-- Freigabe ist die stärkere Feststellung, und ihr eine schwächere nachträglich
-- abzusprechen hiesse, den Bestand schlechter darzustellen, als er ist. Der
-- Zeitpunkt der Freigabe ist der ehrlichste verfügbare.
UPDATE meeting
SET agenda_confirmed_at = coalesce(released_at, created_at)
WHERE state <> 'entwurf';
