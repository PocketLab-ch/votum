-- 054 — Der Maschinenvermerk im Protokoll, abschaltbar (Nachtrag zu FR-63)
--
-- **Was der Vermerk ist.** Am Schluss des Protokolls steht: «Dieser Entwurf
-- wurde maschinell vorbereitet (…) und von … durchgesehen und verantwortet.»
-- Rechtlich nicht zwingend, aber ehrlich — und im Streitfall entlastend: Wer
-- offenlegt, dass Absätze maschinell vorbereitet wurden, steht besser da als
-- jemand, dem man es nachweist.
--
-- **Warum er trotzdem abschaltbar gehört.** Er steht in einem Dokument, das an
-- alle Eigentümer geht, und nicht jede Gemeinschaft will diese Auskunft dort
-- lesen. Über den Inhalt des eigenen Protokolls entscheidet die
-- Sitzungsleitung, nicht das Werkzeug — dasselbe Verhältnis wie überall sonst.
--
-- **Der Nachweis bleibt davon unberührt.** `ai_usage` schreibt weiter mit, wer
-- wann was von einer Maschine hat vorbereiten lassen und was er damit gemacht
-- hat (FR-63, AD-5). Abschaltbar ist die Zeile im Protokoll, nicht die
-- Nachvollziehbarkeit — sonst wäre es kein Schalter, sondern ein Radiergummi.
ALTER TABLE operator
    ADD COLUMN ai_note_in_minutes boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN operator.ai_note_in_minutes IS
    'Ob der Maschinenvermerk am Schluss des Protokolls erscheint (FR-63). Vorgabe an; der Nachweis in ai_usage bleibt in jedem Fall.';
