-- Die Grundlage der Zählweise wandert in die Momentaufnahme (AD-3, AD-14).
--
-- Die Zählweise selbst wird seit Migration 013 eingefroren, ihre Fundstelle im
-- Reglement bisher nicht. Das ist eine Lücke: Wird die Fundstelle in den
-- Stammdaten später berichtigt oder geleert, stünde in der Auswertung einer
-- längst gehaltenen Versammlung ein Beleg, der damals nicht galt — oder gar
-- keiner. Bei einer Anfechtung ist genau das die zweite Frage nach dem
-- Ergebnis: «Worauf stützt sich, dass ihr je Einheit gezählt habt?»
--
-- Nachträglich ausfüllen lässt sie sich nicht: `snapshot` hat kein UPDATE-Recht,
-- und der Wert von heute wäre für eine alte Versammlung nur eine Behauptung.
-- Bestehende Momentaufnahmen bleiben deshalb bei NULL, und die Auswertung sagt
-- in diesem Fall, dass die Fundstelle nicht mitgeführt wurde — eine ehrliche
-- Lücke ist besser als ein erfundener Beleg.
ALTER TABLE snapshot ADD COLUMN head_count_rule_source text;

COMMENT ON COLUMN snapshot.head_count_rule_source IS
	'Fundstelle im Reglement, auf die sich die Zählung je Einheit stützt. NULL bei '
	'der gesetzlichen Auffangregel und bei Momentaufnahmen vor Migration 022.';
