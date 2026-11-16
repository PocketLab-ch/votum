-- Wer den Vorsitz führte und wer das Protokoll schrieb.
--
-- **Der Auftrag** (Auftraggeber, 26.08.2026): «Sitzungsleiter braucht es, weil er ja im
-- Protokoll stehen muss. Gibt es da eine gesetzliche Vorgabe?»
--
-- **Die Antwort auf die Frage, weil sie die Form bestimmt.** Zwingend ist der
-- Vorsitz NICHT. Der SVIT-Kommentar (Wermelinger 2023, ad Art. 712n, Rz. 127):
-- «Art. 712n Abs. 2 verlangt die Protokollierung der Beschlüsse. Damit ist der
-- minimale Inhalt des Protokolls vom Gesetzgeber festgehalten.» Alles Weitere —
-- Beschlussfaehigkeit, Abstimmungsergebnis, Anwesenheitsliste — nennt Rz. 129
-- «aeusserst sinnvoll», haelt aber fest: «Da jedoch die Verankerung im Gesetz
-- fehlt, um sie zwingend einzufordern, koennen sie nur auf der Grundlage der
-- Gemeinschaftsordnung verlangt werden.» Der Vorsitzende steht in dieser
-- Aufzaehlung nicht einmal.
--
-- Gebraucht wird er trotzdem, aus zwei anderen Gruenden:
--
--   * **Die Unterschrift.** Rz. 107: «Dabei sollte das Reglement dessen
--     Unterzeichnung durch den Verfasser und den Vorsitzenden verlangen (gemaess
--     Haas Protokoll, S. 33 ist die Unterzeichnung des Protokolls selbst ohne
--     reglementarische Grundlage erforderlich).» Das Protokoll traegt die beiden
--     Zeilen «Die Sitzungsleitung:» und «Die Protokollfuehrung:» seit je — bisher
--     ohne Namen darueber, und eine Unterschriftszeile ohne Namen ist wertlos.
--   * **Die Aufbewahrungspflicht.** Art. 712n Abs. 2 legt sie «dem Verwalter oder
--     dem Vorsitzenden» auf. Wer aufbewahrungspflichtig ist, muss benennbar sein.
--
-- **Deshalb zwei freie Textfelder und keine Rolle.** Der Vorsitz ist nicht
-- zwingend der Verwalter (Art. 712n Abs. 1 laesst die Versammlung anders
-- beschliessen), nicht zwingend ein Eigentuemer, nicht zwingend ein Konto dieser
-- Anwendung — Rz. 112 nennt fuer die Protokollfuehrung ausdruecklich auch
-- «einen anwesenden dinglich Berechtigten (z.B. Nutzniesser) oder einen Dritten
-- (z.B. Angestellter des Verwalters, Notar usw.)». Ein Verweis auf `person` oder
-- `app_user` bildete genau die Faelle nicht ab, die im Saal vorkommen.
--
-- **Und keine Pflichtangabe.** Sie steht nicht im Gesetz; eine Schranke, die eine
-- Freigabe oder ein Siegel aufhielte, waere strenger als das Recht. Fehlt der
-- Name, bleibt die Unterschriftszeile leer wie bisher.

ALTER TABLE meeting
    ADD COLUMN chair_label text,
    ADD COLUMN minutes_keeper_label text;

-- Leerer Text ist keine Angabe, sondern eine, die niemand sieht: Die Anwendung
-- schreibt NULL, wenn das Feld geleert wird, und die Schranke haelt fest, dass
-- es dabei bleibt. Die Obergrenze ist dieselbe wie beim Eigentuemernamen.
ALTER TABLE meeting
    ADD CONSTRAINT meeting_vorsitz_nicht_leer
        CHECK (chair_label IS NULL OR length(btrim(chair_label)) BETWEEN 2 AND 120),
    ADD CONSTRAINT meeting_protokollfuehrung_nicht_leer
        CHECK (minutes_keeper_label IS NULL
               OR length(btrim(minutes_keeper_label)) BETWEEN 2 AND 120);

COMMENT ON COLUMN meeting.chair_label IS
    'Wer den Vorsitz fuehrte — freier Text, weil es weder ein Konto noch ein '
    'Eigentuemer sein muss (ZGB 712n Abs. 1). Ohne Angabe bleibt die '
    'Unterschriftszeile im Protokoll leer.';
COMMENT ON COLUMN meeting.minutes_keeper_label IS
    'Wer das Protokoll schrieb — freier Text; der SVIT-Kommentar nennt dafuer '
    'ausdruecklich auch Dritte (Notar, Angestellter des Verwalters).';
