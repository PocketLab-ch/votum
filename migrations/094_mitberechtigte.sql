-- Mitberechtigte an gemeinschaftlichem Eigentum (26.08.2026).
--
-- **Der Auftrag** (Auftraggeber): «Es werden die Eigentümer angelegt und einer Hülle
-- Gemeinschaftliches Eigentum hinzugefügt. Dann wäre die Gemeinschaftliches
-- Eigentum der Eigentümer der Einheit und beim Gem. Eigentum sind dann X
-- Eigentümer enthalten.»
--
-- **Warum eine eigene Tabelle und nicht `party.person_id`.** Die Schranke
-- `party_person_nur_bei_einzelnen` verbietet einer gemeinschaftlichen Zeile die
-- Personenklammer, und das aus gutem Grund — im Text von Migration 029: «Sonst
-- stünde hinter einer Zeile mit vier Erben genau ein Mensch, und der Einlass
-- gäbe ihm die Stimme aller anderen dazu.» Gefährlich ist die 1:1-Klammer, nicht
-- die Mehrzahl. Die Schranke bleibt deshalb unangetastet.
--
-- **Was sich am Stimmrecht ändert: nichts.** Die Hülle hält die Einheit und
-- damit die eine Stimme (ZGB Art. 712o Abs. 1). Die Mitglieder halten keine
-- Einheit und tragen von selbst null Kopfstimmen — `stimmkraft()` gibt einer
-- Partei ohne Einheit `kopfstimmen: 0`.
--
-- **Wozu es sie braucht: die Einladung.** Nach ZGB Art. 712n ist jeder
-- Mitberechtigte einzeln anzuschreiben. Bis hierher trug eine gemeinschaftliche
-- Zeile genau eine `email`; die übrigen Miteigentümer waren nur ein Stück Text
-- im Sammelnamen und damit nicht erreichbar.

-- `party (id, is_community)` muss eindeutig sein, damit die Fremdschlüssel der
-- neuen Tabelle darauf zeigen dürfen. `id` ist bereits Primärschlüssel; die
-- zusätzliche Eindeutigkeit ist damit trivial erfüllt und kostet nur den Index.
-- Steht deshalb **vor** dem `CREATE TABLE`.
ALTER TABLE party ADD CONSTRAINT party_id_is_community_key UNIQUE (id, is_community);

CREATE TABLE party_member (
    id                 uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id        uuid NOT NULL,
    stweg_id           uuid NOT NULL,
    huelle_party_id    uuid NOT NULL,
    mitglied_party_id  uuid NOT NULL,

    -- **Die gemeldete Zustelladresse** (ZGB Art. 712n, Rz. 49/51). Ist sie
    -- gesetzt, genügt die Zustellung dorthin; sonst geht die Einladung an alle
    -- Mitberechtigten einzeln. Der Regelfall ist «nicht gesetzt» — die Ausnahme
    -- muss jemand bewusst wählen.
    ist_zustelladresse boolean NOT NULL DEFAULT false,

    created_at         timestamptz NOT NULL DEFAULT now(),

    -- **Die Hülle muss eine gemeinschaftliche Zeile sein, das Mitglied nicht.**
    -- Über einen zusammengesetzten Fremdschlüssel statt über einen Trigger: Die
    -- Datenbank hält die Zusage auch dann, wenn jemand von Hand schreibt.
    huelle_ist_gemeinschaftlich   boolean NOT NULL DEFAULT true,
    mitglied_ist_gemeinschaftlich boolean NOT NULL DEFAULT false,

    CONSTRAINT party_member_huelle_ist_gemeinschaftlich
        CHECK (huelle_ist_gemeinschaftlich),
    -- Keine Hülle in der Hülle. Wäre sie erlaubt, liesse sich eine Stimme über
    -- eine Kette verstecken, und der Empfängerkreis wäre nicht mehr endlich
    -- ohne Zyklenprüfung.
    CONSTRAINT party_member_mitglied_ist_keine_huelle
        CHECK (NOT mitglied_ist_gemeinschaftlich),
    CONSTRAINT party_member_kein_selbstbezug
        CHECK (huelle_party_id <> mitglied_party_id),

    CONSTRAINT party_member_huelle_fk
        FOREIGN KEY (huelle_party_id, huelle_ist_gemeinschaftlich)
        REFERENCES party (id, is_community) ON DELETE CASCADE,
    CONSTRAINT party_member_mitglied_fk
        FOREIGN KEY (mitglied_party_id, mitglied_ist_gemeinschaftlich)
        REFERENCES party (id, is_community) ON DELETE CASCADE,

    -- Beide in derselben Gemeinschaft. Ohne diese Schranke liesse sich eine
    -- Person aus Haus A als Mitberechtigte in Haus B eintragen, und die
    -- Einladung ginge an jemanden, der dort nichts zu suchen hat.
    CONSTRAINT party_member_huelle_stweg_fk
        FOREIGN KEY (huelle_party_id, stweg_id) REFERENCES party (id, stweg_id),
    CONSTRAINT party_member_mitglied_stweg_fk
        FOREIGN KEY (mitglied_party_id, stweg_id) REFERENCES party (id, stweg_id),

    -- **Der Betreiber muss zur Gemeinschaft gehören.** Der Zeilenschutz filtert
    -- allein über `operator_id`; ohne diese Bindung liesse sich eine Zeile mit
    -- einer fremden Betreiberkennung anlegen. Sie wäre dann beim falschen
    -- Mandanten sichtbar und beim richtigen unsichtbar. Dieselbe Klammer trägt
    -- `party` selbst (`party_stweg_id_operator_id_fkey`).
    CONSTRAINT party_member_gleicher_betreiber
        FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id)
        ON DELETE RESTRICT,

    CONSTRAINT party_member_einmalig UNIQUE (huelle_party_id, mitglied_party_id)
);

CREATE INDEX party_member_huelle_idx   ON party_member (huelle_party_id);
CREATE INDEX party_member_mitglied_idx ON party_member (mitglied_party_id);
-- Auch auf die Gemeinschaft: `party_member_gleicher_betreiber` steht auf
-- RESTRICT, und das Aufräumskript löscht nach `stweg_id`. Ohne Index liefe
-- beides über einen vollen Durchlauf.
CREATE INDEX party_member_stweg_idx    ON party_member (stweg_id);

-- **Höchstens eine gemeldete Zustelladresse je Hülle.** Zwei wären keine
-- Ausnahme mehr, sondern eine zweite Regel — und der Versand müsste raten.
CREATE UNIQUE INDEX party_member_eine_zustelladresse
    ON party_member (huelle_party_id) WHERE ist_zustelladresse;

ALTER TABLE party_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_member FORCE  ROW LEVEL SECURITY;

-- Wortgleich zu den übrigen Tabellen: Vergleich als TEXT, nicht mit `::uuid`.
-- Ist die Sitzungsvariable leer, liefert der Vergleich NULL und die Zeile
-- bleibt verborgen; ein Cast auf uuid würfe stattdessen einen Fehler.
CREATE POLICY party_member_mandant ON party_member
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- **Der Vertreter wird ein Verweis, nicht mehr nur ein Name.**
--
-- `representative_name` bleibt und wird weiter gefüllt: Die Momentaufnahme
-- friert ihn ein, und die Zugangskarte druckt ihn. Ein Verweis allein hülfe dort
-- nichts, weil die Person später umbenannt werden kann und die Urkunde dann
-- etwas anderes sagte als am Versammlungstag.
--
-- Der Verweis kommt dazu, damit die Anwendung weiss, WER gemeint ist — heute
-- steht dort ein Text, und ob er zu einem der Mitberechtigten gehört, weiss
-- niemand.
ALTER TABLE party ADD COLUMN representative_party_id uuid;

-- **Dieselben zwei Klammern wie an `party_member`.** Ein blosses
-- `REFERENCES party (id)` liesse den Vertreter aus einem fremden Haus und damit
-- von einem fremden Betreiber stammen — genau das, was die Tabelle oben mit
-- ausgeschriebener Begründung verbietet. Über `(id, stweg_id)` gilt hier
-- dasselbe; die Betreiberklammer trägt `party` selbst.
--
-- `ON DELETE SET NULL` benennt seine Spalte ausdrücklich: Ohne die Angabe
-- setzte Postgres **beide** Spalten des Schlüssels zurück, und `stweg_id` ist
-- NOT NULL — das Löschen bräche dann an einer Stelle ab, die niemand vermutet.
ALTER TABLE party
    ADD CONSTRAINT party_vertreter_fk
    FOREIGN KEY (representative_party_id, stweg_id) REFERENCES party (id, stweg_id)
    ON DELETE SET NULL (representative_party_id);

-- Niemand vertritt sich selbst. Die Hülle ist nie ihr eigenes Mitglied
-- (`party_member_kein_selbstbezug`), also kann sie auch nie ihre eigene
-- Vertreterin sein.
ALTER TABLE party
    ADD CONSTRAINT party_vertreter_kein_selbstbezug
    CHECK (representative_party_id IS DISTINCT FROM id);

-- Ohne diesen Index sucht Postgres bei jedem `DELETE FROM party` mit einem
-- vollen Durchlauf nach verweisenden Zeilen — `ON DELETE SET NULL` zwingt es
-- dazu. Die beiden Fremdschlüssel an `party_member` haben ihren Index oben.
CREATE INDEX party_vertreter_idx ON party (representative_party_id)
    WHERE representative_party_id IS NOT NULL;

COMMENT ON COLUMN party.representative_party_id IS
    'Die Mitgliedszeile, die die Stimme ausuebt (ZGB 712o Abs. 1). NULL bei Zeilen aus der Zeit vor Migration 094 und bei nicht gemeinschaftlichem Eigentum.';
