-- Die Mischform: am Einlass wird je Partei gefragt, wer von Hand abstimmt.
--
-- **Der Anlass** (Auftraggeber, 09.09.2026): «Stimmt, es gibt die Betriebsart einfach.
-- Das ist ja genau der Fall. Dann die Mischform, und dann rein digital. Digital
-- und von Hand existiert. Dann braucht es ja nur noch die Mischform und dort
-- soll dann beim Einlass die Frage zwischen von Hand und Digital kommen.»
--
-- Damit fallen zwei Dinge weg, die Migration 107 noch vorgesehen hatte.
--
-- **Erstens die Voreinstellung «alle Parteien auf Papier».** Sie ist die
-- Betriebsart `einfach` und steht seit Migration 011 (`meeting_betriebsart`).
-- Drei Lagen, zwei davon fertig gebaut:
--
--     alle digital    Betriebsart `gefuehrt`
--     alle von Hand   Betriebsart `einfach`
--     Mischform       fehlte, und nur sie fehlte
--
-- Deshalb verliert `paper_ballot.channel` unten den Wert `gemeinschaft`. Er war
-- für genau diese Voreinstellung gedacht und hat keinen Erzeuger: Gemessen am
-- 09.09.2026 ist `paper_ballot` leer (0 Zeilen), und ausser den Proben ruft
-- niemand `vermerkePapierabgabe`. Ein Wert in einer Schranke, den nichts
-- schreiben kann, ist kein Vorrat, sondern eine Behauptung über einen Weg, den
-- es nicht gibt.
--
-- **Zweitens der Wechsel während der laufenden Sitzung** (Auftraggeber, 09.09.2026:
-- «Wichtig, der Entscheid fällt am Eingang nicht während der laufenden Sitzung.
-- Dort gilt höchstens der bestehende Weg, wenn es technische Probleme gibt»).
-- Auch das engt `channel` auf die beiden Wege des Eingangs ein. Wer im Saal ein
-- technisches Problem hat, wird weiter durch die Sitzungsleitung mit Begründung
-- an der einzelnen Stimme erfasst; das ist der bestehende Weg und bleibt, wie
-- er ist.

-- **Warum die Frage abschaltbar ist, aber ab Werk gestellt wird** (Auftraggeber,
-- 09.09.2026: «Der müsste per Default ein sein, weil man ja nie sicher weiss,
-- ob alle digital wollen. Zumindest bis das Tool etabliert ist»).
--
-- Die Vorgabe trägt die richtige Unsicherheit: Wer am Eingang nicht gefragt
-- wird, gilt als digital, und wenn er es nicht ist, merkt es niemand, bis die
-- Abstimmung steht. Wer gefragt wird und digital abstimmt, hat einen Knopf
-- mehr gedrückt. Der Schaden ist einseitig, also ist die Vorgabe einseitig.
--
-- **Je Versammlung und nicht je Gemeinschaft.** Der Vermerk selbst hängt seit
-- Migration 107 an `snapshot_party`, gilt also je Versammlung. Stünde der
-- Schalter an der Gemeinschaft, änderte eine spätere Umstellung rückwirkend die
-- Lesart einer abgeschlossenen Versammlung. Eine Voreinstellung an `stweg`
-- lässt sich später darüberlegen, sobald jemand sie braucht; heute steht sie
-- auf «fragen» und niemand hat verlangt, sie dauerhaft abzustellen.
--
-- In der Betriebsart `einfach` bleibt die Spalte wirkungslos: Dort stimmen
-- ohnehin alle von Hand, und die Oberfläche stellt die Frage gar nicht erst.
ALTER TABLE meeting ADD COLUMN ask_paper_ballot boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN meeting.ask_paper_ballot IS
    'Fragt der Einlass je Partei, ob von Hand oder digital abgestimmt wird? Nur in der Betriebsart '
    'gefuehrt wirksam; in einfach stimmen ohnehin alle von Hand.';

-- ── channel auf die beiden Wege des Eingangs ───────────────────────────────
--
-- Bestand vorher gezählt: 0 Zeilen. Die engere Schranke trifft nichts.
ALTER TABLE paper_ballot DROP CONSTRAINT paper_ballot_weg;
ALTER TABLE paper_ballot ADD  CONSTRAINT paper_ballot_weg
    CHECK (channel IN ('von_hand', 'gescannt'));

-- Der Kommentar aus 107 nannte `gemeinschaft` und behauptete damit einen Weg,
-- den es nicht mehr gibt. Beide Wege sind jetzt wörtlich die der Anwesenheit
-- (`attendance_event.channel`), damit im Protokoll nicht zwei Wörter für
-- denselben Weg stehen.
COMMENT ON COLUMN paper_ballot.channel IS
    'von_hand | gescannt. Wie der Vermerk am Eingang entstanden ist, wörtlich wie '
    'attendance_event.channel.';
