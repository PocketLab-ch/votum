-- 043 — Vollmacht über den persönlichen Zugang, mit Empfehlung je Traktandum
--
-- **Der Fall.** Die Einladung trägt einen QR-Code, der auf den persönlichen
-- Zugang führt. Wer ihn scannt und feststellt, dass er nicht kommen kann, soll
-- von dort aus jemanden bevollmächtigen können — statt anzurufen, ein Blatt zu
-- unterschreiben und es jemandem in die Hand zu drücken.
--
-- **Drei Zusagen, die dabei nicht aufgeweicht werden:**
--
--   1. **Die Bestätigung durch die Sitzungsleitung bleibt.** Eine so erklärte
--      Vollmacht ist «erfasst», nicht «bestätigt». Der Zugangscode steht im
--      Klartext auf der Karte; wer sie weitergibt, gibt auch die Möglichkeit
--      weiter, in fremdem Namen zu bevollmächtigen. Geprüft wird deshalb wie
--      bisher von einem Menschen.
--   2. **Die Schriftform ist eine Frage des Reglements.** Manche verlangen eine
--      *schriftliche* Vollmacht, und ob eine Erklärung über den persönlichen
--      Code das erfüllt, entscheidet keine Software. Deshalb ist der Weg je
--      Gemeinschaft **abgeschaltet**, bis ihn jemand bewusst freischaltet — mit
--      Begründung, wie bei der Vollmachtsschranke.
--   3. **Der Widerruf ist so einfach wie das Erteilen.** Wer den Code hat, nimmt
--      die Vollmacht auch wieder zurück. Das steht in `proxy` schon zur
--      Verfügung (Zustand «widerrufen») und braucht hier nichts Neues.

-- ── Freischaltung je Gemeinschaft ──────────────────────────────────────────
ALTER TABLE stweg ADD COLUMN proxy_by_access        boolean NOT NULL DEFAULT false;
ALTER TABLE stweg ADD COLUMN proxy_by_access_source text;

-- Wie bei `proxy_limit`: Wer freischaltet, sagt woraufhin. Im Streitfall ist
-- die erste Frage nach der Vertretungsmacht die nach ihrer Form.
ALTER TABLE stweg ADD CONSTRAINT stweg_vollmacht_ueber_zugang_begruendet
    CHECK (
        NOT proxy_by_access
        OR length(btrim(coalesce(proxy_by_access_source, ''))) >= 3
    );

COMMENT ON COLUMN stweg.proxy_by_access IS
    'Ob Eigentümer über ihren persönlichen Zugang selbst bevollmächtigen dürfen. Aus, bis das Reglement geprüft ist.';

-- ── Woher die Erklärung stammt ─────────────────────────────────────────────
--
-- Der Unterschied gehört in den Nachweis und damit ins Abschlusspaket: «im Saal
-- erfasst, Original vorgelegen» ist etwas anderes als «elektronisch über den
-- persönlichen Zugang erklärt». Wer das später zusammenwirft, behauptet mehr,
-- als er weiss.
ALTER TABLE proxy ADD COLUMN declared_via text NOT NULL DEFAULT 'leitung';

ALTER TABLE proxy ADD CONSTRAINT proxy_herkunft
    CHECK (declared_via IN ('leitung', 'zugang'));

COMMENT ON COLUMN proxy.declared_via IS
    'leitung = von der Sitzungsleitung erfasst; zugang = von der vertretenen Person über ihren persönlichen Zugang erklärt.';

-- Eine über den Zugang erklärte Vollmacht kann kein vorgelegtes Original haben:
-- Es war niemand da, dem etwas vorgelegen hätte. Nachträglich darf es die
-- Sitzungsleitung vermerken — dann ist es ihr Vermerk, nicht der der Erklärung.
UPDATE proxy SET declared_via = 'leitung' WHERE declared_via IS NULL;

-- ── Die Empfehlung je Traktandum ───────────────────────────────────────────
--
-- **Empfehlung, nicht Stimme.** Eine im Voraus festgelegte Stimme ignoriert die
-- Beratung — und die Versammlung *berät*. Deshalb wird hier nichts automatisch
-- abgegeben: Auf dem Telefon der bevollmächtigten Person steht «Weisung: Ja»,
-- der Knopf ist vorgehoben, und drücken muss sie ihn selbst. Wer daraus eine
-- automatische Stimme machte, hätte eine Briefwahl gebaut, und die ist etwas
-- rechtlich anderes als eine Vertretung.
--
-- **Der Wortlaut wird mitgeschrieben, nicht nur der Verweis.** Anträge ändern
-- sich: Folgeanträge, Rückkommen, eine Präzisierung während der Sitzung. Eine
-- Empfehlung, die sich auf einen anderen Wortlaut bezog, ist keine Empfehlung
-- mehr — sie fällt sichtbar weg, statt still weiterzugelten. Deshalb steht der
-- Wortlaut hier abgeschrieben und wird beim Anzeigen verglichen.
-- Der Fremdschlüssel unten braucht diese Eindeutigkeit; `proxy` trug bisher
-- nur den Primärschlüssel.
ALTER TABLE proxy ADD CONSTRAINT proxy_id_operator UNIQUE (id, operator_id);

CREATE TABLE proxy_recommendation (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id    uuid NOT NULL REFERENCES operator (id),
    proxy_id       uuid NOT NULL,
    agenda_item_id uuid NOT NULL,

    choice text NOT NULL,

    -- Der Antragswortlaut, wie er beim Erteilen lautete.
    wording text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT proxy_empfehlung_wahl CHECK (choice IN ('ja', 'nein', 'enthaltung')),

    FOREIGN KEY (proxy_id, operator_id) REFERENCES proxy (id, operator_id) ON DELETE CASCADE,
    FOREIGN KEY (agenda_item_id, operator_id) REFERENCES agenda_item (id, operator_id)
        ON DELETE CASCADE,

    -- Je Vollmacht und Traktandum höchstens eine Empfehlung. Zwei wären zwei
    -- Weisungen, und niemand wüsste, welche gilt.
    UNIQUE (proxy_id, agenda_item_id)
);

CREATE INDEX proxy_recommendation_vollmacht_idx ON proxy_recommendation (proxy_id);

CREATE TRIGGER proxy_recommendation_updated_at
    BEFORE UPDATE ON proxy_recommendation
    FOR EACH ROW EXECUTE FUNCTION setze_updated_at();

-- Zeilenschutz wie überall (AD-6).
ALTER TABLE proxy_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_recommendation FORCE  ROW LEVEL SECURITY;

CREATE POLICY proxy_recommendation_mandant ON proxy_recommendation
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- **Mit Löschrecht, anders als bei der Vollmacht selbst.** Eine Empfehlung, die
-- vor der Versammlung zurückgenommen wird, hat nie gewirkt: Niemand hat danach
-- abgestimmt, sie stand auf keinem Telefon. Sie stehen zu lassen hiesse, im
-- Abschlusspaket eine Weisung auszuweisen, die es zur Sitzung gar nicht mehr
-- gab. Ab dem Siegel greift ohnehin der Schreibschutz weiter unten.
GRANT SELECT, INSERT, UPDATE, DELETE ON proxy_recommendation TO versammlung_app;

COMMENT ON TABLE proxy_recommendation IS
    'Empfehlung der vertretenen Person an ihre bevollmächtigte Person, je Traktandum. Keine Stimme: abgeben muss die bevollmächtigte Person selbst.';

-- Nach dem Siegel ist auch die Empfehlung Teil des Nachweises (FR-55): Sie
-- steht im Abschlusspaket und erklärt, warum jemand so abgestimmt hat.
--
-- Eigene Funktion statt `verhindere_nach_siegel`: Die Empfehlung kennt die
-- Versammlung nur über ihre Vollmacht — wie die Stimme sie nur über ihren
-- Durchgang kennt.
CREATE OR REPLACE FUNCTION proxy_recommendation_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM proxy
     WHERE id = COALESCE(NEW.proxy_id, OLD.proxy_id);
    IF kennung IS NOT NULL AND versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «proxy_recommendation» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER proxy_recommendation_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON proxy_recommendation
    FOR EACH ROW EXECUTE FUNCTION proxy_recommendation_nach_siegel();
