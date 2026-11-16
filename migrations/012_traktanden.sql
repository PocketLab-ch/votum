-- Stories 3.2 und 3.3: Traktanden und ihr Baum (FR-12, FR-13, AD-4, AD-14).
--
-- Der Baum steht als Elternverweis mit Position, nicht als verschachtelte
-- Struktur. Die Nummerierung wird nicht gespeichert, sondern gerechnet — sonst
-- gäbe es sie zweimal, einmal in der Spalte und einmal in der Anzeige, und
-- spätestens nach der dritten Verschiebung wären die beiden verschieden.

CREATE TABLE agenda_item (
	id          uuid PRIMARY KEY,
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,
	parent_id   uuid,

	position integer NOT NULL,
	-- Der Elternteil, für die Eindeutigkeit der Position. Auf oberster Ebene ist
	-- `parent_id` null, und NULL ist in einem eindeutigen Schlüssel nie gleich
	-- NULL — ohne diesen Ersatzwert wären auf der obersten Ebene beliebig viele
	-- Traktanden auf Stelle 1 erlaubt, und genau dort fällt es am ehesten an.
	parent_key uuid GENERATED ALWAYS AS (coalesce(parent_id, meeting_id)) STORED,
	-- Von Hand gesetzte Nummer. NULL heisst: wird gerechnet.
	manual_number text,

	title    text NOT NULL,
	item_kind text NOT NULL,
	body     text,
	-- Ein bis zwei Sätze in einfacher Sprache. In Welle 3 schlägt die KI sie vor;
	-- die Spalte steht ab jetzt, damit dafür keine Migration nötig ist (AD-14).
	summary  text,
	-- Bei der Art «abstimmung» Pflicht (Schranke unten).
	motion_text text,

	proposer_kind text NOT NULL,
	-- Bei «eigentuemer» die Partei, bei «untergemeinschaft» die STWEG. Zwei
	-- getrennte Spalten, weil ein Fremdschlüssel auf zwei Tabellen nicht geht und
	-- eine gemeinsame Spalte niemandem sagte, worauf sie zeigt.
	proposer_party_id uuid REFERENCES party (id),
	proposer_stweg_id uuid REFERENCES stweg (id),
	proposer_name text,

	-- ── Das Mehrheitserfordernis (AD-4) ────────────────────────────────────
	-- Die Fassungskennung steht je Traktandum, nicht je Versammlung: Ein aus dem
	-- Vorjahr übernommenes Traktandum trägt die Fassung von damals, und beide
	-- müssen nebeneinander bestehen können.
	requirement_version   text,
	requirement_branch    text,
	requirement_node      text,
	requirement_type      text,
	requirement_title     text,
	requirement_legal_basis text,
	requirement_head_base  text,
	requirement_quota_base text,
	requirement_head_numerator    integer,
	requirement_head_denominator  integer,
	requirement_head_mode         text,
	requirement_quota_numerator   integer,
	requirement_quota_denominator integer,
	requirement_quota_mode        text,
	requirement_business_kind text,
	requirement_needs_affected_consent boolean NOT NULL DEFAULT false,
	requirement_source    text,
	requirement_reason    text,
	requirement_risk      boolean,
	requirement_reference text,
	-- Der beschrittene Pfad durch den Entscheidbaum, als Frage- und
	-- Antworttexte. Als Beleg gedacht: Er muss lesbar bleiben, auch wenn die
	-- Fassung, die ihn erzeugt hat, längst nicht mehr die aktuelle ist.
	requirement_path jsonb,

	-- ── Herkunft (Story 3.8) ───────────────────────────────────────────────
	copied_from_meeting_id uuid,
	from_template boolean NOT NULL DEFAULT false,

	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	FOREIGN KEY (parent_id, operator_id) REFERENCES agenda_item (id, operator_id),
	FOREIGN KEY (copied_from_meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	UNIQUE (id, operator_id),

	CONSTRAINT agenda_art CHECK (item_kind IN ('abstimmung', 'kenntnisnahme')),
	CONSTRAINT agenda_titel CHECK (length(btrim(title)) >= 3),
	CONSTRAINT agenda_nicht_selbst CHECK (parent_id <> id),
	CONSTRAINT agenda_position CHECK (position >= 1),

	-- Über eine Kenntnisnahme wird nicht beschlossen: kein Antragswortlaut, kein
	-- Erfordernis. Stünde dort eines, entstünde bei der Auswertung ein Beschluss,
	-- den niemand fassen wollte.
	CONSTRAINT agenda_wortlaut CHECK (
		(item_kind = 'abstimmung' AND length(btrim(coalesce(motion_text, ''))) >= 3)
		OR (item_kind = 'kenntnisnahme' AND motion_text IS NULL)
	),
	CONSTRAINT agenda_kenntnisnahme_ohne_erfordernis CHECK (
		item_kind <> 'kenntnisnahme' OR requirement_type IS NULL
	),

	CONSTRAINT agenda_antragsteller CHECK (
		proposer_kind IN ('bewirtschaftung', 'gemeinschaft', 'untergemeinschaft', 'eigentuemer')
	),
	-- Bei einem Antrag eines einzelnen Eigentümers muss feststehen, welcher —
	-- sonst liesse sich später nicht prüfen, ob er antragsberechtigt war.
	CONSTRAINT agenda_antragsteller_bestimmt CHECK (
		(proposer_kind = 'eigentuemer' AND proposer_party_id IS NOT NULL)
		OR (proposer_kind = 'untergemeinschaft' AND proposer_stweg_id IS NOT NULL)
		OR proposer_kind IN ('bewirtschaftung', 'gemeinschaft')
	),

	-- Ein Erfordernis ohne Fassungskennung liesse sich später nicht mehr
	-- einordnen: Man wüsste, dass ein Zweidrittelmehr galt, aber nicht, nach
	-- welcher Fassung des Regelwerks (AD-4).
	CONSTRAINT agenda_erfordernis_fassung CHECK (
		requirement_type IS NULL OR requirement_version IS NOT NULL
	),
	CONSTRAINT agenda_erfordernis_kopfbruch CHECK (
		requirement_head_numerator IS NULL
		OR (requirement_head_numerator >= 1
		    AND requirement_head_denominator BETWEEN 1 AND 100
		    AND requirement_head_numerator <= requirement_head_denominator)
	),
	CONSTRAINT agenda_erfordernis_quotenbruch CHECK (
		requirement_quota_numerator IS NULL
		OR (requirement_quota_numerator >= 1
		    AND requirement_quota_denominator BETWEEN 1 AND 100
		    AND requirement_quota_numerator <= requirement_quota_denominator)
	),

	CONSTRAINT agenda_nummer CHECK (
		manual_number IS NULL OR manual_number ~ '^[0-9]+(\.[0-9]+)*[A-Za-z]{0,3}$'
	),

	-- Je Elternteil eine Position nur einmal. Zwei Traktanden auf derselben
	-- Stelle ergäben eine Reihenfolge, die von der Sortierung der Datenbank
	-- abhinge — also von nichts, worauf man sich berufen könnte.
	--
	-- AUFSCHIEBBAR, und das ist der Punkt: Beim Umsortieren durchläuft die Liste
	-- zwangsläufig Zwischenstände, in denen zwei Zeilen dieselbe Stelle
	-- beanspruchen. Ohne Aufschub müsste die Anwendung sie über Hilfswerte
	-- herumschieben — und jeder solche Kniff hinterlässt bei einem Abbruch einen
	-- Zustand, den niemand vorgesehen hat. Aufgeschoben gilt die Bedingung beim
	-- Commit, also genau dann, wenn die Liste wieder stimmen muss.
	CONSTRAINT agenda_position_je_elternteil
		UNIQUE (meeting_id, parent_key, position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX agenda_meeting_idx ON agenda_item (meeting_id, position);
CREATE INDEX agenda_parent_idx ON agenda_item (parent_id);

ALTER TABLE agenda_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_item FORCE ROW LEVEL SECURITY;

CREATE POLICY agenda_mandant ON agenda_item
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE TRIGGER agenda_updated_at
	BEFORE UPDATE ON agenda_item
	FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

-- ── Unmittelbar Betroffene ──────────────────────────────────────────────────
--
-- Wo das Erfordernis die Zustimmung unmittelbar Betroffener verlangt (ZGB
-- Art. 712e Abs. 2, Art. 712g Abs. 4), sind sie namentlich zuzuweisen. Ihre
-- Zustimmung steht neben der Mehrheit, nicht darin: Ein Antrag kann die
-- Mehrheit haben und trotzdem nicht zustande kommen.
CREATE TABLE agenda_item_affected (
	agenda_item_id uuid NOT NULL,
	party_id       uuid NOT NULL,
	operator_id    uuid NOT NULL REFERENCES operator (id),
	-- Mitgeführt für den zusammengesetzten Fremdschlüssel: Er stellt sicher, dass
	-- die betroffene Partei zu der Gemeinschaft gehört, um die es geht. Ohne ihn
	-- liesse sich ein Eigentümer einer fremden STWEG als betroffen zuweisen, und
	-- der Beschluss hinge an der Zustimmung eines Unbeteiligten.
	stweg_id       uuid NOT NULL,
	created_at     timestamptz NOT NULL DEFAULT now(),

	PRIMARY KEY (agenda_item_id, party_id),
	FOREIGN KEY (agenda_item_id, operator_id) REFERENCES agenda_item (id, operator_id) ON DELETE CASCADE,
	FOREIGN KEY (party_id, stweg_id) REFERENCES party (id, stweg_id),
	FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id)
);

CREATE INDEX agenda_affected_party_idx ON agenda_item_affected (party_id);

ALTER TABLE agenda_item_affected ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_item_affected FORCE ROW LEVEL SECURITY;

CREATE POLICY agenda_affected_mandant ON agenda_item_affected
	USING (operator_id::text = current_setting('versammlung.operator_id', true));
