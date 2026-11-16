-- Bemerkungsfeld je Eigentümer (23.08.2026, Prüflauf I, A-12).
--
-- Eine Arbeitsnotiz der Bewirtschaftung: «spricht nur Französisch», «Post an
-- die Tochter», «Wohnung vermietet, Mieter im Saal nicht stimmberechtigt».
-- Heute steht das im Kopf der Sachbearbeiterin oder in einer Datei daneben.
--
-- SIE WANDERT NICHT IN DIE MOMENTAUFNAHME. Die Momentaufnahme friert ein, was
-- für das Stimmrecht gilt — Name, Vertretung, Gemeinschaftszugehörigkeit. Eine
-- Bemerkung ist keine dieser Angaben; sie mitzunehmen hiesse, eine
-- Arbeitsnotiz über eine Person unveränderlich zu machen und zum Teil einer
-- Urkunde, die im Anfechtungsfall auf dem Tisch liegt.
--
-- Sie geht auch NICHT an ein Sprachmodell und NICHT ins Kundenportal. Wo sie
-- erscheint, entscheidet allein die Bewirtschaftungssicht.
ALTER TABLE party ADD COLUMN note text;

COMMENT ON COLUMN party.note IS
	'Arbeitsnotiz der Bewirtschaftung. Nicht in Momentaufnahmen, nicht an KI, nicht ins Portal.';
