-- Eine Gemeinschaft als Eigentümerin, und wer für sie stimmt (Stories 7.1, 7.2).
--
-- MEG Umgebung, Art. 7 Ziff. 3: «Die Eigentümer jedes dominierenden Grundstücks
-- haben eine Stimme (je 1/5). Ist ein dominierendes Grundstück in
-- Stockwerkeigentum aufgeteilt, so haben die beteiligten Stockwerkeigentümer nur
-- eine Stimme, die sie durch einen durch sie bezeichneten Vertreter auszuüben
-- haben.»
--
-- Der Anteil 1/5 gehört keinem Menschen — er gehört dem Haus. Abgebildet wird
-- das an der **Partei** und nicht an der Einheit: Damit bleiben Wertquoten,
-- Zählweise, Eigentumszeiträume, Momentaufnahme, Zugänge, Anwesenheit und
-- Auszählung unverändert. Die Umgebungs-MEG ist dann eine gewöhnliche
-- Gemeinschaft mit fünf Einheiten zu je 1/5, gezählt je Einheit — neu ist allein
-- die Natur des Trägers. Deshalb braucht es hier keine neue Zählweise (AD-14).

ALTER TABLE party DROP CONSTRAINT IF EXISTS party_art;
ALTER TABLE party ADD CONSTRAINT party_art
    CHECK (kind IN ('natural', 'legal', 'gemeinschaft'));

ALTER TABLE party ADD COLUMN member_stweg_id uuid;

-- Beide Richtungen: Eine Partei der Art «gemeinschaft» **muss** auf eine
-- Gemeinschaft zeigen, und wer darauf zeigt, ist eine. Ohne die zweite Richtung
-- entstünde eine natürliche Person mit einer Gemeinschaft im Rücken, und keine
-- Abfrage wüsste, was daraus folgt.
ALTER TABLE party ADD CONSTRAINT party_gemeinschaft_zeigt_auf_gemeinschaft
    CHECK ((kind = 'gemeinschaft') = (member_stweg_id IS NOT NULL));

-- Art. 7 Ziff. 3 verlangt einen bezeichneten Vertreter. Ohne benannte Person
-- stünde die Sitzungsleitung im Moment der Abstimmung vor der Frage, wen sie
-- zählen darf — dieselbe Begründung wie beim gemeinschaftlichen Eigentum und
-- bei der juristischen Person.
ALTER TABLE party DROP CONSTRAINT IF EXISTS party_vertretung_bei_juristisch;
ALTER TABLE party ADD CONSTRAINT party_vertretung_bei_juristisch
    CHECK (kind = 'natural' OR length(btrim(coalesce(representative_name, ''))) >= 2);

-- Eine Gemeinschaft kann nicht Mitglied ihrer selbst sein.
ALTER TABLE party ADD CONSTRAINT party_kein_selbstbezug
    CHECK (member_stweg_id IS DISTINCT FROM stweg_id);

-- Über die Betreibergrenze hinweg ginge es nicht: Der Zeilenschutz zeigte die
-- Mitgliedsgemeinschaft dann nirgends vollständig, und ihre Wertquotensumme
-- wäre nirgends prüfbar.
ALTER TABLE party
    ADD CONSTRAINT party_mitglied_gleicher_betreiber
    FOREIGN KEY (member_stweg_id, operator_id)
    REFERENCES stweg (id, operator_id)
    ON DELETE RESTRICT;

CREATE INDEX party_mitglied_idx ON party (member_stweg_id) WHERE member_stweg_id IS NOT NULL;

-- ── Ringschutz über mehrere Ebenen ─────────────────────────────────────────
-- Ein Ring — Haus hält Anteil an der MEG, MEG hält Anteil am Haus — wäre kein
-- Anzeigefehler, sondern eine Endlosschleife, sobald jemand die Weisungskette
-- verfolgt. Dieselbe Schranke wie bei `parent_stweg_id`, und aus demselben
-- Grund auch dann wirksam, wenn ein späterer Codepfad die Prüfung vergisst.
CREATE OR REPLACE FUNCTION party_mitglied_ringschutz() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ring boolean;
BEGIN
    IF NEW.member_stweg_id IS NULL THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE hinauf AS (
        -- Wessen Mitglied ist die neue Mitgliedsgemeinschaft ihrerseits?
        SELECT p.stweg_id AS haltende, p.member_stweg_id AS gehaltene
        FROM party p
        WHERE p.member_stweg_id = NEW.member_stweg_id
        UNION ALL
        SELECT p.stweg_id, p.member_stweg_id
        FROM party p JOIN hinauf h ON p.member_stweg_id = h.haltende
    )
    SELECT EXISTS (SELECT 1 FROM hinauf WHERE haltende = NEW.member_stweg_id) INTO ring;

    IF ring THEN
        RAISE EXCEPTION 'Ring in der Mitgliedschaft: % hält bereits mittelbar an %',
            NEW.member_stweg_id, NEW.stweg_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER party_mitglied_ringschutz_trigger
    BEFORE INSERT OR UPDATE OF member_stweg_id ON party
    FOR EACH ROW EXECUTE FUNCTION party_mitglied_ringschutz();

-- ── Der bezeichnete Vertreter (Story 7.2) ──────────────────────────────────
--
-- Er wird vom Haus bezeichnet und wechselt. Deshalb mit Zeitraum: Ein
-- Vertreterwechsel im März darf eine Versammlung vom Februar nicht verändern.
--
-- `representative_name` an der Partei bleibt daneben bestehen — es ist der
-- schnelle Weg für die einfachen Fälle (juristische Person, gemeinschaftliches
-- Eigentum). Diese Tabelle ist der belegte Weg: mit Fundstelle im Reglement und
-- gegebenenfalls dem Beschluss, der ihn bezeichnet hat.
CREATE TABLE representation (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id       uuid NOT NULL,
    party_id          uuid NOT NULL,
    stweg_id          uuid NOT NULL,
    person_name       text NOT NULL,
    valid_from        date NOT NULL,
    valid_to          date,
    -- Woraus sich die Befugnis ergibt, etwa «Art. 7 Ziff. 3».
    basis             text,
    -- Die Versammlung, an der er bezeichnet wurde, falls bekannt.
    resolved_by_meeting_id uuid,
    note              text,
    created_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT representation_name_nicht_leer CHECK (length(btrim(person_name)) >= 2),
    CONSTRAINT representation_zeitraum CHECK (valid_to IS NULL OR valid_to > valid_from),

    FOREIGN KEY (party_id, stweg_id)    REFERENCES party (id, stweg_id) ON DELETE CASCADE,
    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id) ON DELETE RESTRICT
);

CREATE INDEX representation_party_idx ON representation (party_id, valid_from);

-- Eine Partei kann zu einem Zeitpunkt nicht zwei Vertreter haben: Im Moment der
-- Abstimmung liesse sich sonst nicht sagen, wer die eine Stimme abgibt.
ALTER TABLE representation ADD CONSTRAINT representation_keine_ueberschneidung
    EXCLUDE USING gist (
        party_id WITH =,
        daterange(valid_from, valid_to, '[)') WITH &&
    );

ALTER TABLE representation ENABLE ROW LEVEL SECURITY;
ALTER TABLE representation FORCE  ROW LEVEL SECURITY;

CREATE POLICY representation_mandant ON representation
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

COMMENT ON TABLE representation IS
    'Wer die eine Stimme einer Mitgliedsgemeinschaft abgibt (ZGB 655a / MEG Art. 7 Ziff. 3).';
