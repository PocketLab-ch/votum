-- Eine Reglementsregel auf einen einzelnen Fall beschränken
-- (Usability-Prüflauf 22.08.2026, Befund B-02 — der folgenschwerste)
--
-- Bisher wurde eine Regel allein über die Geschäftsart zugeordnet. Eine Art
-- umfasst aber mehrere Fälle des Entscheidbaums: «Jahresgeschäfte» etwa vier —
-- Jahresrechnung/Budget, Erneuerungsfonds, Décharge/Protokollgenehmigung und
-- die Ermächtigung zur Prozessführung. Sieben der fünfzehn Arten tragen mehr
-- als einen Fall, «Grundordnung» sogar fünf.
--
-- Wer also § 15 seines Reglements hinterlegte — «zwei Drittel für eine Erhöhung
-- des Erneuerungsfondsbeitrags» —, verschärfte damit stillschweigend auch
-- Protokollgenehmigung, Jahresrechnung und Budget. Im Prüflauf wäre ein Budget
-- mit 3:2 als abgelehnt aus der Versammlung gegangen; gefunden wurde es nur,
-- weil ein Prüfer die Formeln der Auszählmappe las.
--
-- NULL heisst weiterhin «für alle Fälle dieser Art» — bestehende Regeln
-- behalten damit genau die Wirkung, die sie hatten. Wer schärfer zuordnen will,
-- trägt den Knoten ein.
--
-- Der Knoten ist eine Kennung aus dem Regelwerk (`src/lib/rules/`), kein
-- Fremdschlüssel: Das Regelwerk ist versioniert und liegt im Code, nicht in der
-- Datenbank. Geprüft wird beim Erfassen — die Datenbank kann hier nur die Form
-- sichern.

ALTER TABLE bylaw_quorum_rule ADD COLUMN node_id text;

ALTER TABLE bylaw_quorum_rule ADD CONSTRAINT bylaw_rule_knoten_form CHECK (
	node_id IS NULL OR length(btrim(node_id)) >= 2
);

COMMENT ON COLUMN bylaw_quorum_rule.node_id IS
	'Knoten des Entscheidbaums, auf den die Regel beschränkt ist. NULL = für alle Fälle der Geschäftsart.';

-- Eine Regel je Art UND Knoten: Zwei Regeln für denselben Fall wären zwei
-- Antworten auf dieselbe Frage, und welche gilt, entschiede die Reihenfolge.
CREATE UNIQUE INDEX bylaw_rule_je_art_und_knoten
	ON bylaw_quorum_rule (stweg_id, business_kind, coalesce(node_id, ''));
