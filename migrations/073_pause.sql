-- Die Pause: was an der Wand steht, wenn nichts läuft.
--
-- **Der Anlass, am 21.08.2026.** Gemeldet aus dem Saal: «Für die Pause braucht
-- es einen eigenen Knopf bei der Steuerung. […] Der Pausenschalter könnte so
-- sein, dass wenn aktiv den Inhalt übernimmt und auf der Präsi-Ansicht
-- überlagert bis der Schalter aus ist.»
--
-- Vorher gab es dafür das Wandbild «Eigener Text» — und die Meldung daneben:
-- «Gilt, solange kein Traktandum aufgerufen und keine Abstimmung offen ist. Ein
-- laufendes Geschäft geht immer vor.» Genau daran scheiterte es: Wer in der
-- Pause etwas anschreiben will, hat in aller Regel ein Traktandum aufgerufen,
-- und der eigene Text erschien nie. Der Weg dahin wäre gewesen, den Aufruf
-- zurückzunehmen — also die Sitzung zu verlassen, um eine Pause anzukündigen.
--
-- **Die Pause ist deshalb keine weitere Wandbildart, sondern eine Schicht
-- darüber.** Sie überlagert alles, auch eine laufende Abstimmung: «Pause würde
-- auch eine Abstimmung unterbrechen, wenn diese bspw. ungeplant ist (notfall,
-- störung oder so).»
--
-- **Was die Pause NICHT tut:** Sie schliesst keine Abstimmung. Ein offener
-- Durchgang bleibt offen, die bereits abgegebenen Stimmen bleiben stehen, und
-- nach der Pause geht es weiter, wo es aufgehört hat. Ein Abbruch wäre etwas
-- anderes — dafür gibt es das Überholen (FR-44), und das braucht einen Grund.
ALTER TABLE meeting ADD COLUMN paused_at timestamptz;

-- Was an der Wand steht. Ohne Text nennt die Anzeige nur «Pause» — das genügt,
-- und eine Pflichtangabe hielte im Notfall auf.
ALTER TABLE meeting ADD COLUMN pause_text text;

ALTER TABLE meeting
	ADD CONSTRAINT meeting_pausentext_kurz CHECK (
		pause_text IS NULL OR length(pause_text) <= 200
	);

COMMENT ON COLUMN meeting.paused_at IS
	'Seit wann die Versammlung unterbrochen ist. NULL = läuft. Überlagert die Präsentationssicht und sperrt die Stimmabgabe.';
COMMENT ON COLUMN meeting.pause_text IS
	'Was während der Pause an der Wand steht, etwa «Weiter um 20:15».';
