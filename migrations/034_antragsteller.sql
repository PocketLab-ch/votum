-- Wer sonst noch einen Antrag stellt.
--
-- Bisher kannte die Anwendung vier Antragsteller: die Bewirtschaftung, die
-- Gemeinschaft, eine Untergemeinschaft und einen einzelnen Eigentümer. In der
-- Wirklichkeit einer Stockwerkeigentümerversammlung fehlen damit die Hälfte
-- der Fälle. Gemeldet am 01.08.2026: «Was noch fehlt ist der Ausschuss,
-- Revisoren, mehrere Eigentümer und Freitext für Arbeitsgruppen oder sonstige
-- Konstellationen.»
--
--   * **Ausschuss** — der ständige oder für eine Sache bestellte Ausschuss.
--     Sein Name ist freiwillig: «Bauausschuss» sagt mehr als «Der Ausschuss»,
--     aber es gibt Gemeinschaften mit nur einem.
--   * **Revisionsstelle** — sie prüft die Jahresrechnung und stellt regelmässig
--     selbst Anträge, etwa zur Décharge. Name ebenfalls freiwillig.
--   * **Mehrere Eigentümer** — ein Antrag, den mehrere gemeinsam einbringen.
--     Er ist nicht der Antrag «eines» und auch nicht der «der Gemeinschaft»;
--     wer ihn gestellt hat, muss nachher benennbar sein. Deshalb eine eigene
--     Tabelle statt einer Aufzählung im Namensfeld: Ein Text lässt sich nicht
--     gegen die Stimmberechtigten prüfen.
--   * **Andere** — Arbeitsgruppen, Delegationen, was das Leben sonst hervor
--     bringt. Hier ist der Freitext Pflicht: «Andere» allein benennt niemanden.
--
-- Die vorhandenen vier bleiben unverändert; die neue Prüfung ist eine
-- Erweiterung der alten, kein Ersatz (AD-14).

ALTER TABLE agenda_item DROP CONSTRAINT agenda_antragsteller;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_antragsteller CHECK (
    proposer_kind IN (
        'bewirtschaftung', 'gemeinschaft', 'untergemeinschaft', 'eigentuemer',
        'ausschuss', 'revision', 'mehrere_eigentuemer', 'frei'
    )
);

ALTER TABLE agenda_item DROP CONSTRAINT agenda_antragsteller_bestimmt;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_antragsteller_bestimmt CHECK (
    (proposer_kind = 'eigentuemer' AND proposer_party_id IS NOT NULL)
    OR (proposer_kind = 'untergemeinschaft' AND proposer_stweg_id IS NOT NULL)
    -- «Andere» ohne Bezeichnung wäre keine Angabe, sondern eine Lücke mit Namen.
    OR (proposer_kind = 'frei' AND btrim(coalesce(proposer_name, '')) <> '')
    OR proposer_kind IN (
        'bewirtschaftung', 'gemeinschaft', 'ausschuss', 'revision', 'mehrere_eigentuemer'
    )
);

-- Mehrere Eigentümer als Antragsteller.
--
-- Gebaut wie `agenda_item_affected`, und aus demselben Grund: Der
-- zusammengesetzte Fremdschlüssel stellt sicher, dass die Partei zu der
-- Gemeinschaft gehört, um die es geht. Ohne ihn liesse sich ein Eigentümer
-- einer fremden STWEG als Antragsteller eintragen.
--
-- Dass es **mindestens zwei** sein müssen, steht nicht hier: Eine Zeile weiss
-- nichts von ihren Geschwistern. Die Regel steht im Kern, wo sie eine
-- verständliche Meldung erzeugen kann.
CREATE TABLE agenda_item_proposer (
    agenda_item_id uuid NOT NULL,
    party_id       uuid NOT NULL,
    operator_id    uuid NOT NULL REFERENCES operator (id),
    stweg_id       uuid NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (agenda_item_id, party_id),
    FOREIGN KEY (agenda_item_id, operator_id) REFERENCES agenda_item (id, operator_id) ON DELETE CASCADE,
    FOREIGN KEY (party_id, stweg_id) REFERENCES party (id, stweg_id),
    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id)
);

COMMENT ON TABLE agenda_item_proposer IS
    'Die Eigentümer, die einen Antrag gemeinsam gestellt haben. Nur bei '
    'proposer_kind = mehrere_eigentuemer gefüllt.';

ALTER TABLE agenda_item_proposer ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_item_proposer FORCE ROW LEVEL SECURITY;

CREATE POLICY agenda_item_proposer_betreiber ON agenda_item_proposer
    USING (operator_id = current_setting('app.operator_id', true)::uuid)
    WITH CHECK (operator_id = current_setting('app.operator_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON agenda_item_proposer TO versammlung_app;
