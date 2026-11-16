-- Traktanden, die erst in der Sitzung entstehen (Stories 5.11 und 5.12, FR-14, FR-15).
--
-- **Warum das eine eigene Kennzeichnung braucht.** Ein Traktandum, das in der
-- Einladung stand, und eines, das jemand um 20:40 Uhr aus dem Saal heraus
-- verlangt hat, sehen in der Liste gleich aus — rechtlich sind sie es nicht.
-- Über ein nicht angekündigtes Geschäft darf nur beschlossen werden, wenn die
-- Versammlung die Erweiterung der Traktandenliste zuvor genehmigt hat (ZGB
-- Art. 712n i.V.m. Art. 67). Ohne diesen Beschluss ist der spätere Beschluss
-- anfechtbar, und wer das Protokoll ein Jahr später liest, muss sehen, welcher
-- Fall vorlag.

ALTER TABLE agenda_item
	ADD COLUMN is_spontaneous boolean NOT NULL DEFAULT false,
	-- Das Traktandum, in dem die Versammlung die Erweiterung genehmigt hat.
	-- Zeigt auf ein anderes Traktandum derselben Versammlung; der
	-- zusammengesetzte Fremdschlüssel stellt das sicher.
	ADD COLUMN approved_by_item_id uuid,
	-- Wann es aufgenommen wurde. Steht im Protokoll neben dem Beschluss.
	ADD COLUMN added_during_meeting_at timestamptz;

ALTER TABLE agenda_item
	ADD CONSTRAINT agenda_spontan_zeitpunkt
		CHECK (NOT is_spontaneous OR added_during_meeting_at IS NOT NULL),
	-- Eine Genehmigung ohne Spontantraktandum wäre eine Angabe ohne Gegenstand.
	ADD CONSTRAINT agenda_genehmigung_nur_bei_spontan
		CHECK (approved_by_item_id IS NULL OR is_spontaneous),
	-- Ein Traktandum kann sich nicht selbst genehmigen.
	ADD CONSTRAINT agenda_genehmigung_nicht_selbst
		CHECK (approved_by_item_id IS NULL OR approved_by_item_id <> id),
	ADD CONSTRAINT agenda_genehmigung_gleiche_versammlung
		FOREIGN KEY (approved_by_item_id, operator_id)
		REFERENCES agenda_item (id, operator_id);

CREATE INDEX agenda_spontan_idx ON agenda_item (meeting_id) WHERE is_spontaneous;
