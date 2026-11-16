-- Was an der Wand steht, wenn kein Traktandum aufgerufen ist.
--
-- Bisher gab es dafür nichts zu entscheiden: Ohne aufgerufenes Traktandum zeigte
-- die Saalsicht die Traktandenliste, und damit hatte es sich. Vorgeschlagen am
-- 02.08.2026: «Was man anstelle Aufgerufenes Traktandum machen könnte, ist die
-- Auswahl der Traktandenliste, einer Begrüssung und Freitext.»
--
-- Die drei Bilder decken die drei Zeiten ab, in denen kein Geschäft läuft:
--
--   * **Traktandenliste** — während der Versammlung zwischen zwei Geschäften.
--     Bleibt die Voreinstellung.
--   * **Begrüssung** — vor dem Beginn, solange die Leute eintreffen. Der Saal
--     soll sehen, dass er im richtigen Raum ist.
--   * **Freitext** — für alles andere, und in der Praxis vor allem für die
--     Pause: «Weiter um 20:15».
--
-- Der Text steht bei der Versammlung, nicht bei der Gemeinschaft: Er gilt für
-- diesen Abend. Beim Wechsel des Bildes wird `wall_changed_at` gesetzt — daran
-- erkennt die Saalsicht, dass sie nachladen muss, ohne dass der Wortlaut über
-- den Ereignisstrom gehen müsste (AD-11).

ALTER TABLE meeting
    ADD COLUMN wall_kind       text NOT NULL DEFAULT 'traktanden',
    ADD COLUMN wall_text       text,
    ADD COLUMN wall_changed_at timestamptz;

ALTER TABLE meeting ADD CONSTRAINT meeting_wandbild CHECK (
    wall_kind IN ('traktanden', 'begruessung', 'frei')
);

-- «Freitext» ohne Text wäre eine leere Wand mit Absicht.
ALTER TABLE meeting ADD CONSTRAINT meeting_wandbild_freitext CHECK (
    wall_kind <> 'frei' OR btrim(coalesce(wall_text, '')) <> ''
);

COMMENT ON COLUMN meeting.wall_kind IS
    'Was die Saalsicht zeigt, solange kein Traktandum aufgerufen und keine '
    'Abstimmung offen ist: traktanden, begruessung oder frei.';
COMMENT ON COLUMN meeting.wall_text IS
    'Der Wortlaut bei wall_kind = frei. Steht nie im Ereignisstrom.';
COMMENT ON COLUMN meeting.wall_changed_at IS
    'Zeitpunkt der letzten Änderung am Wandbild. Dient der Saalsicht als '
    'Anlass zum Nachladen.';
