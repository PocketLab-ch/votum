-- Story 3.5: Die Momentaufnahme (FR-9, AD-3, AD-14).
--
-- Beim Freigeben wird der Stimmberechtigtenstand hierher kopiert. Alle
-- Berechnungen dieser Versammlung lesen ausschliesslich diese Tabellen — nie
-- `party`, `unit` oder `unit_ownership`.
--
-- Der entscheidende Punkt sind die **fehlenden** Fremdschlüssel: Die
-- Momentaufnahme verweist bewusst nicht auf die lebenden Stammdaten, sondern
-- trägt Namen und Werte selbst. Ein Fremdschlüssel bände sie an eine Zeile, die
-- sich ändern kann; dann stünde in der Momentaufnahme der Name von heute und
-- nicht der von damals, und die Zusage aus AD-3 wäre gebrochen, ohne dass
-- irgendwo etwas kaputtginge. Die Kennungen sind als Werte mitgeführt, damit
-- sich Anwesenheit und Stimmen darauf beziehen können.

CREATE TABLE snapshot_party (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,

	-- Die Kennung der Partei aus den Stammdaten, als Wert. Kein Fremdschlüssel:
	-- siehe oben.
	party_id uuid NOT NULL,

	display_name        text NOT NULL,
	representative_name text,
	is_community        boolean NOT NULL DEFAULT false,

	created_at timestamptz NOT NULL DEFAULT now(),

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	UNIQUE (id, operator_id),
	UNIQUE (meeting_id, party_id),

	CONSTRAINT snapshot_party_name CHECK (length(btrim(display_name)) >= 1)
);

CREATE TABLE snapshot_unit (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_id  uuid NOT NULL,
	snapshot_party_id uuid NOT NULL,

	unit_id uuid NOT NULL,
	label   text NOT NULL,
	kind    text NOT NULL,
	-- Ob diese Einheit eine Kopfstimme trägt. Bei der Zählung je Eigentümer ohne
	-- Bedeutung, bei der Zählung je Einheit entscheidend.
	counts_as_head boolean NOT NULL DEFAULT true,
	-- Nur die Stammquote. Führte die Momentaufnahme mehrere Schlüssel, müsste bei
	-- jeder Zählung entschieden werden, welcher gilt — und diese Entscheidung
	-- gehört nicht in die Auszählung.
	quota integer NOT NULL,

	created_at timestamptz NOT NULL DEFAULT now(),

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	FOREIGN KEY (snapshot_party_id, operator_id) REFERENCES snapshot_party (id, operator_id)
		ON DELETE CASCADE,
	UNIQUE (meeting_id, unit_id),

	CONSTRAINT snapshot_unit_art CHECK (kind IN ('unit', 'parking')),
	CONSTRAINT snapshot_unit_quote CHECK (quota >= 0)
);

-- Die Kopfdaten der Momentaufnahme. Eine Zeile je Versammlung; ihr Vorhandensein
-- ist gleichbedeutend mit «eingefroren».
CREATE TABLE snapshot (
	meeting_id  uuid PRIMARY KEY,
	operator_id uuid NOT NULL REFERENCES operator (id),

	taken_at timestamptz NOT NULL DEFAULT now(),
	-- Der Stichtag, zu dem der Eigentümerstand gelesen wurde: das
	-- Versammlungsdatum, nicht der Tag der Freigabe. Wer im August für den
	-- September freigibt, will den Stand vom September.
	as_of_date date NOT NULL,

	head_count_mode       text    NOT NULL,
	parking_counts_as_head boolean NOT NULL,
	-- Der Nenner aus dem Reglement, nicht die Summe der erfassten Quoten: «mehr
	-- als die Hälfte aller Wertquoten» meint 501 von 1000, auch wenn erst 998
	-- erfasst sind.
	total_quota integer NOT NULL,

	FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),

	CONSTRAINT snapshot_zaehlweise CHECK (head_count_mode IN ('per_owner', 'per_unit')),
	CONSTRAINT snapshot_gesamtquote CHECK (total_quota >= 0)
);

CREATE INDEX snapshot_party_meeting_idx ON snapshot_party (meeting_id);
CREATE INDEX snapshot_unit_meeting_idx ON snapshot_unit (meeting_id);
CREATE INDEX snapshot_unit_party_idx ON snapshot_unit (snapshot_party_id);

ALTER TABLE snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE snapshot_party ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_party FORCE ROW LEVEL SECURITY;
ALTER TABLE snapshot_unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_unit FORCE ROW LEVEL SECURITY;

CREATE POLICY snapshot_mandant ON snapshot
	USING (operator_id::text = current_setting('versammlung.operator_id', true));
CREATE POLICY snapshot_party_mandant ON snapshot_party
	USING (operator_id::text = current_setting('versammlung.operator_id', true));
CREATE POLICY snapshot_unit_mandant ON snapshot_unit
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Kein UPDATE: Die Momentaufnahme ist eingefroren oder gar nicht da. Ein
-- geänderter Wert darin wäre ein Stand, den es nie gab, und niemand könnte
-- sagen, worauf ein früheres Ergebnis gerechnet wurde.
--
-- DELETE bleibt: Die Rücknahme der Freigabe verwirft sie vollständig. Der
-- Verlaufseintrag dazu hält fest, dass das geschehen ist.
--
-- Entzug, nicht Vergabe — Migration 002 vergibt alle vier Rechte über
-- ALTER DEFAULT PRIVILEGES an jede neue Tabelle.
REVOKE UPDATE ON snapshot, snapshot_party, snapshot_unit FROM versammlung_app;
