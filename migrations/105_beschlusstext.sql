-- Der Text zum Beschluss: Details, Präzisierungen, Änderungen — je Durchgang.
--
-- **Der Anlass** (Auftraggeber, 09.09.2026, aus der Auswertung echter Protokolle):
-- «Der Text zum Beschluss führt Details, Präzisierungen oder Änderungen aus.
-- Annahme und Ablehnung erfolgt hart über die Abstimmung.»
--
-- In den Protokollen steht regelmässig ein Beschluss, der vom Antrag abweicht:
-- Beantragt war eine Rampe nach vorliegender Offerte über CHF 2'237.65,
-- beschlossen wurde «zum Kostendach von CHF 5'000». Eine Décharge wird «unter
-- Berücksichtigung des Vorbehalts» erteilt, dass ein Betrag zurückerstattet
-- wird. Das ist weder der Antragswortlaut noch das gerechnete Ergebnis,
-- sondern das Dritte dazwischen — und es ist genau der Satz, der später in
-- eine Pendenz gehört.
--
-- **Warum nicht ins Votum.** `agenda_item.minute_text` hält, was gesagt wurde:
-- Wortmeldungen, Begründungen, Ordnungsentscheide. Das kann eine Seite sein.
-- Wer daraus eine Pendenz zieht, zieht eine Seite. Der Beschluss ist die
-- Essenz daraus, und Essenz und Verlauf in einem Feld ist dieselbe
-- Klumpenform, die bei der Einheit schon einmal aufgetrennt wurde (Befund 26,
-- Migration 104).
--
-- **Warum am Durchgang und nicht am Traktandum** (Produktentscheid
-- 09.09.2026). Der Text präzisiert ein Ergebnis, also gehört er zu dem Lauf,
-- dessen Ergebnis er präzisiert. Am Traktandum trüge ihn eine Neuabstimmung
-- weiter: «zum Kostendach von CHF 5'000» stünde unter einem Ergebnis, das
-- inzwischen ein anderes ist. Gemessen sind 285 von 1671 Läufen zweite
-- Durchgänge, und Befund 4 der Bedienbarkeitsprüfung war genau diese Klasse.
-- `tie_break_reason` in derselben Tabelle ist der Vorläufer: ein von Hand
-- geschriebener Satz, der zu einem Durchgang gehört und mit ihm überholt wird.
--
-- **Ohne Längenschranke**, wie `minute_text`, an dem er sich misst. Eine Zahl
-- hier wäre geraten; die Oberfläche führt die Länge, nicht die Datenbank.
ALTER TABLE voting_round ADD COLUMN decision_text text;

COMMENT ON COLUMN voting_round.decision_text IS
	'Details, Präzisierungen oder Änderungen zum Beschluss dieses Durchgangs. '
	'Setzt NIE Annahme oder Ablehnung — die kommen aus der Auszählung. '
	'NULL = nichts zu präzisieren.';
