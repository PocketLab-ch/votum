-- 160: Die Rüge im Saal festhalten (Ä-06, Auftrag H8, Teil A).
--
-- **Der Anlass.** Wermelinger Rz. 69a ad Art. 712n: Ein erkennbarer
-- Einberufungsmangel ist vor der Beschlussfassung im Saal zu rügen
-- (BGE 136 III 174 E. 5.1.2). Die Rüge ist damit das, was das
-- Anfechtungsrecht erhält, und sie ist eine Obliegenheit der Anwesenden, keine
-- Gültigkeitsvoraussetzung. Bis hierher gab es für sie keinen Ort: Der Hinweis
-- an die Leitung (`domain/folgeantrag.ts`) verwies auf den freien Text im
-- Protokoll, und der ist nicht Teil des Siegels.
--
-- **Ein Feld, kein Pflichtablauf** (`docs/freigabe.md`, Abschnitt 0, «Ä-06,
-- auf ein Feld reduziert»). Die Rüge sperrt nichts. Sie hält fest, zu welchem
-- Traktandum, mit welchem Wortlaut, um welche Zeit, wer gerügt hat und wie der
-- Vorsitz entschied.
--
-- **Anders als die Pendenz ist sie Teil des Siegels.** Sie sagt, was im Saal
-- vor der Abstimmung geschah, und steht deshalb im Abschlusspaket
-- (`daten/ruegen.json`). Nach dem Versiegeln und während einer Abgabe an ein
-- anderes Gerät wird sie nicht mehr geschrieben, über dieselben Funktionen wie
-- die übrigen Tabellen des Nachweises. Das Warten auf ein laufendes Siegel
-- kommt mit `versammlung_versiegelt` (Migration 157) von selbst.
CREATE TABLE objection (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),
    meeting_id  uuid NOT NULL,
    agenda_item_id uuid NOT NULL,

    -- Was gerügt wurde, sinngemäss oder wörtlich.
    wording text NOT NULL,
    -- **Wer rügt, als Text.** Es kann eine Vertreterin sein, ein Ehepartner
    -- neben der Eigentümerin oder jemand, dessen Teilnahme selbst strittig ist.
    -- Ein Verweis auf die Anwesenheitsliste zwänge die Leitung, mitten in der
    -- Sitzung erst zu klären, als wer jemand spricht.
    raised_by text NOT NULL,
    -- **Die Uhrzeit im Saal, wie die Leitung sie angibt.** Erfasst wird oft erst
    -- nach dem Wortwechsel; der Zeitpunkt der Erfassung steht daneben
    -- (`created_at`) und im Verlauf. Ob die Rüge vor der Abstimmung kam, ist die
    -- Frage, auf die es ankommt, und dafür zählt die Zeit im Saal.
    raised_time text NOT NULL,
    -- Wie der Vorsitz entschied. Darf fehlen: Die Rüge ist auch ohne Entscheid
    -- erhoben, und ein Pflichtfeld wäre der Pflichtablauf, der nicht gewollt ist.
    ruling text,

    created_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid REFERENCES app_user (id),
    created_by_label text,

    CONSTRAINT objection_wortlaut CHECK (length(btrim(wording)) BETWEEN 3 AND 2000),
    CONSTRAINT objection_wer      CHECK (length(btrim(raised_by)) BETWEEN 2 AND 200),
    CONSTRAINT objection_uhrzeit  CHECK (raised_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT objection_entscheid CHECK (ruling IS NULL OR length(btrim(ruling)) BETWEEN 2 AND 2000),

    -- Die Kaskaden wie bei der Pendenz (Migration 106): Das Löschen einer
    -- Versammlung im Entwurf und die Fristlöschung räumen Traktanden und
    -- Versammlung ab, und eine Rüge zu einem Traktandum, das es nicht mehr
    -- gibt, hätte keinen Gegenstand.
    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE,
    -- Die Herkunft als Klammer: Traktandum und Versammlung gehören zusammen.
    CONSTRAINT objection_traktandum
        FOREIGN KEY (agenda_item_id, meeting_id) REFERENCES agenda_item (id, meeting_id)
        ON DELETE CASCADE
);

CREATE INDEX objection_versammlung_idx ON objection (meeting_id, agenda_item_id);
-- Für die Kaskade beim Löschen eines Traktandums.
CREATE INDEX objection_traktandum_idx ON objection (agenda_item_id);

ALTER TABLE objection ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection FORCE  ROW LEVEL SECURITY;
CREATE POLICY objection_mandant ON objection
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Kein UPDATE: Berichtigt wird durch Entfernen und neu Erfassen, beides steht
-- im Verlauf. Das GRANT allein nähme nichts weg, Migration 002 vergibt über
-- `ALTER DEFAULT PRIVILEGES` alle vier Rechte; wegnehmen tut nur das REVOKE
-- (Migration 154, «Rechte nach dem, was gewährt wurde»; `tests/db/rechte`).
GRANT SELECT, INSERT, DELETE ON objection TO versammlung_app;
REVOKE UPDATE ON objection FROM versammlung_app;

CREATE TRIGGER objection_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON objection
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

CREATE TRIGGER objection_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON objection
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

COMMENT ON TABLE objection IS
    'Rügen im Saal (Ä-06): Traktandum, Wortlaut, Uhrzeit, wer rügt und der Entscheid des Vorsitzes. Teil des Siegels.';
