-- 119 — Der Fristvermerk tritt an die Stelle der Begründung
--
-- **Der Anlass** (Befund R-2b, Produktentscheid vom 23.09.2026). Migration 011
-- legte `interval_justification` an: «Warum der Abstand kürzer als zehn Tage
-- ist.» Das Formular fragte danach, und sobald irgendetwas dastand, liess es
-- die Erfassung durch. Die Frist war damit nicht geprüft, sondern verhandelbar.
--
-- **Warum das die falsche Richtung war.** Ein Pflichtfeld sieht aus wie ein
-- vorgesehener Weg. Den gibt es nicht: Rz. 39 ad Art. 712p kennt neben der
-- Universalversammlung keine Ausnahme von Art. 712p Abs. 2, und nach Rz. 33
-- spricht gerade die Willentlichkeit für die schwerere Rechtsfolge. Wer
-- begründete, belegte also, dass er es wusste — und hielt den Abend trotzdem
-- für gerettet.
--
-- **Was an die Stelle tritt.** Dieselbe Spalte, umbenannt und umgedreht: Nicht
-- mehr die Sitzungsleitung erklärt dem Werkzeug den Abstand, sondern das
-- Werkzeug hält gegenüber den Eigentümern fest, was gilt. Der Text wird aus
-- Datum und Vorgängerdatum gerechnet (`fristvermerk` in
-- `src/lib/domain/versammlung.ts`), ist keine Eingabe, und er steht in der
-- Einladung und im Protokoll, also in den beiden Dokumenten, die im
-- Anfechtungsfall auf dem Tisch liegen. Aufgehalten wird weiterhin niemand.
--
-- **Umbenennen statt neu anlegen**, damit die Spalte nicht zweimal existiert
-- und die alte als toter Rest zurückbleibt. Migration 011 ist gelaufen und
-- bleibt, wie sie ist (AD-14); ihre Fassung steht in der Geschichte.

ALTER TABLE meeting RENAME COLUMN interval_justification TO interval_note;

COMMENT ON COLUMN meeting.interval_note IS
	'Vermerk zur Zehntagesfrist nach ZGB Art. 712p Abs. 2, wenn sie nicht '
	'eingehalten ist; sonst NULL. Gerechnet, keine Eingabe (Migration 119).';

-- **Der Bestand wird geleert, nicht übernommen.** Was in der alten Spalte
-- steht, ist eine Begründung der Sitzungsleitung und kein Vermerk des
-- Werkzeugs. Stehen zu lassen hiesse, ihren Satz in der Einladung als Aussage
-- der Anwendung zu drucken — an genau der Stelle, an der jetzt die Rechtsfolge
-- stehen soll.
--
-- **Und nicht hier neu gerechnet.** Der Wortlaut steht an einer Stelle, im
-- Domänencode, und eine zweite Fassung in SQL wäre die siebte Stelle derselben
-- Regel, die die Fachprüfung vom 23.09.2026 gerade zusammengeführt hat. Wo die
-- Frist verletzt ist, füllt sich die Spalte beim nächsten Speichern der
-- Versammlung; bis dahin fehlt in der Einladung ein Vermerk, der dort auch
-- vorher nie stand.
UPDATE meeting SET interval_note = NULL WHERE interval_note IS NOT NULL;
