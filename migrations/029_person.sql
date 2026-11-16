-- Die Person über den Gemeinschaften (Voraussetzung für Story 7.6).
--
-- **Das Problem.** Derselbe Mensch ist in jeder Gemeinschaft eine eigene
-- `party`: Markus Probère ist im Haus 4 eine Zeile und in der Einstellhalle
-- eine zweite, und die beiden wissen nichts voneinander. Am Versammlungstag
-- steht er einmal am Eingang und müsste siebenmal angemeldet werden.
--
-- **Warum nicht über den Namen.** «M. Probère» und «Markus Probère» sind für die
-- Datenbank zwei Menschen; «Meier» gibt es dreimal. Ein automatischer Abgleich
-- verbände irgendwann zwei Verschiedene, und dann gäbe ein Zugang jemandem eine
-- Stimme, die ihm nicht zusteht. Die Verknüpfung wird deshalb **gesetzt**, nicht
-- geraten — beim Erfassen des Eigentümers, von der Bewirtschaftung.
--
-- Die Partei bleibt, was sie ist: der Stimmberechtigte **in dieser einen**
-- Gemeinschaft, mit ihrer Wertquote und ihrer Kopfstimme. Die Person ist nur die
-- Klammer darüber. Nichts an Zählung, Momentaufnahme oder Auszählung ändert sich
-- dadurch (AD-14).

CREATE TABLE person (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id  uuid NOT NULL REFERENCES operator (id) ON DELETE RESTRICT,
    kind         text NOT NULL DEFAULT 'natural',
    display_name text NOT NULL,
    email        text,
    phone        text,
    address      text,
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT person_art             CHECK (kind IN ('natural', 'legal')),
    CONSTRAINT person_name_nicht_leer CHECK (length(btrim(display_name)) >= 2),

    UNIQUE (id, operator_id)
);

CREATE INDEX person_operator_idx ON person (operator_id, display_name);

CREATE TRIGGER person_updated_at
    BEFORE UPDATE ON person
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

ALTER TABLE party ADD COLUMN person_id uuid;

ALTER TABLE party
    ADD CONSTRAINT party_person_gleicher_betreiber
    FOREIGN KEY (person_id, operator_id)
    REFERENCES person (id, operator_id)
    ON DELETE RESTRICT;

-- Eine Gemeinschaft ist keine Person, und gemeinschaftliches Eigentum ist
-- **mehr als eine**. Beide bekommen keine Personenklammer: Sonst stünde hinter
-- einer Zeile mit vier Erben genau ein Mensch, und der Einlass gäbe ihm die
-- Stimme aller anderen dazu.
ALTER TABLE party ADD CONSTRAINT party_person_nur_bei_einzelnen
    CHECK (person_id IS NULL OR (kind <> 'gemeinschaft' AND is_community = false));

-- Dieselbe Person kann in einer Gemeinschaft nicht zweimal Partei sein. Sie
-- hätte dann zwei Kopfstimmen, wo ihr eine zusteht.
CREATE UNIQUE INDEX party_person_je_gemeinschaft
    ON party (stweg_id, person_id)
    WHERE person_id IS NOT NULL;

CREATE INDEX party_person_idx ON party (person_id) WHERE person_id IS NOT NULL;

ALTER TABLE person ENABLE ROW LEVEL SECURITY;
ALTER TABLE person FORCE  ROW LEVEL SECURITY;

CREATE POLICY person_mandant ON person
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

COMMENT ON TABLE person IS
    'Ein Mensch oder eine Firma über die Gemeinschaften hinweg; die Verknüpfung wird gesetzt, nie geraten.';
COMMENT ON COLUMN party.person_id IS
    'Welcher Person diese Partei gehört. Null bei Gemeinschaften und gemeinschaftlichem Eigentum.';
