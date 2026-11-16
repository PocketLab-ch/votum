-- Die Feststellung der Beschlussfähigkeit — als Befund zu einem Zeitpunkt.
--
-- **Der Anlass, am 24.08.2026.** Aus dem Prüflauf am gemeinsamen Abend: «ich
-- habe bei Traktandum 1 auf Abstimmung gedrückt und diese Meldung erhalten. Die
-- Beschlussfähigkeit sollte einfach festgehalten werden können.»
--
-- Der Knopf war das kleinere Übel (die Gruppensicht bot an, was der Server zu
-- Recht abwies). Dahinter lag das grössere: Es gab überhaupt keinen Weg, die
-- Feststellung festzuhalten. Das Protokoll rechnete sie beim Erzeugen aus dem
-- **momentanen** Anwesenheitsstand — wer um neun ging, veränderte damit
-- rückwirkend die Zahl, die um fünf festgestellt worden war. Das Traktandum
-- heisst «Begrüssung und Feststellung der Beschlussfähigkeit»; eine
-- Feststellung, die sich nachträglich ändert, ist keine.
--
-- **Warum eine eigene Tabelle und nicht Spalten an `meeting`.** Beschlussfähig
-- ist die Versammlung nicht einmal, sondern für jeden Beschluss (ZGB Art.
-- 712p). Sie kippt im Lauf des Abends: Nach der Pause sind Leute weg, vor einem
-- schweren Traktandum kommen welche dazu. Die Sitzungsleitung muss erneut
-- feststellen können, ohne die erste Feststellung zu überschreiben — sonst
-- stünde am Ende nur die letzte im Protokoll, und der Beschluss von halb sieben
-- hinge an Zahlen von halb zehn.
--
-- Angefügt wird, nie geändert (AD-5). Die Zeile ist ein Befund: Sie sagt, was
-- die Sitzungsleitung zu diesem Zeitpunkt festgestellt hat.
--
-- **Warum die Zahlen mitgeschrieben werden, obwohl sie sich nachrechnen
-- liessen.** `holeUebersicht` kann auf einen Zeitpunkt zurückrechnen. Nur
-- stützt sich diese Rechnung auf Anwesenheitsereignisse, und die lassen sich
-- nachtragen und berichtigen. Ein Beleg, der sich mit seiner Grundlage
-- mitverändert, belegt nichts. Gehen beide auseinander, ist das ein Befund und
-- kein stiller Wandel.
CREATE TABLE quorum_finding (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id    uuid NOT NULL REFERENCES operator (id),
    meeting_id     uuid NOT NULL,

    -- Bei welchem Traktandum festgestellt wurde. NULL ist erlaubt und kein
    -- Versehen: Festgestellt wird auch, bevor etwas aufgerufen ist — beim
    -- Einlass, wenn die Sitzungsleitung wissen will, ob sie beginnen kann.
    agenda_item_id uuid,

    recorded_at    timestamptz NOT NULL DEFAULT now(),
    -- Wer festgestellt hat, im Klartext. Der Verlauf trägt die Benutzerkennung;
    -- hier steht der Name, weil das Protokoll ihn ausweisen muss und ein
    -- Protokoll keine zweite Tabelle nachschlägt.
    recorded_by    text NOT NULL CHECK (length(btrim(recorded_by)) >= 1),

    -- Die vier Zahlen, wie sie im Moment der Feststellung galten.
    head_present   numeric NOT NULL CHECK (head_present  >= 0),
    head_total     numeric NOT NULL CHECK (head_total    >= 0),
    quota_present  numeric NOT NULL CHECK (quota_present >= 0),
    quota_total    numeric NOT NULL CHECK (quota_total   >= 0),

    is_quorate     boolean NOT NULL,
    -- Woraus die Schwelle stammt: aus ZGB Art. 712p oder aus dem Reglement.
    basis          text NOT NULL CHECK (basis IN ('gesetz', 'reglement')),
    -- Die Fundstelle im Reglement. Pflicht, wo davon abgewichen wird — eine
    -- verschärfte Schwelle ohne Fundstelle ist im Streitfall nicht haltbar.
    reference      text,
    -- Was fehlte, wenn nicht beschlussfähig. NULL, wenn sie es war.
    shortfall      text,

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),

    -- **NULL gilt in einem CHECK als erfüllt** — deshalb je Zweig ausdrücklich
    -- `IS NOT NULL`. Ein blosses `basis = 'reglement' AND length(...) > 0`
    -- liesse eine Reglementsfeststellung ohne Fundstelle durch.
    CONSTRAINT quorum_finding_fundstelle CHECK (
        (basis = 'gesetz')
        OR (basis = 'reglement' AND reference IS NOT NULL AND length(btrim(reference)) >= 1)
    ),

    -- Nicht beschlussfähig ohne Angabe, woran es fehlt: Das Protokoll muss den
    -- Satz bilden können, und «nicht beschlussfähig» allein ist keiner.
    CONSTRAINT quorum_finding_fehlgrund CHECK (
        is_quorate OR (shortfall IS NOT NULL AND length(btrim(shortfall)) >= 1)
    )
);

CREATE INDEX quorum_finding_versammlung_idx ON quorum_finding (meeting_id, recorded_at);

ALTER TABLE quorum_finding ENABLE ROW LEVEL SECURITY;
ALTER TABLE quorum_finding FORCE  ROW LEVEL SECURITY;
CREATE POLICY quorum_finding_mandant ON quorum_finding
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Kein UPDATE, kein DELETE: Ein Befund wird nicht berichtigt, sondern durch
-- einen neuen abgelöst. Wer sich vertan hat, stellt erneut fest; beide Zeilen
-- bleiben stehen, und das Protokoll zeigt den Verlauf der Feststellungen.
GRANT SELECT, INSERT ON quorum_finding TO versammlung_app;

-- Nach dem Versiegeln steht auch das fest (FR-55) — derselbe Auslöser wie bei
-- Anwesenheit, Vollmacht, Stimmen und Ausstand.
CREATE TRIGGER quorum_finding_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON quorum_finding
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

COMMENT ON TABLE quorum_finding IS
    'Feststellung der Beschlussfähigkeit zu einem Zeitpunkt (ZGB Art. 712p). Nur anfügbar.';
COMMENT ON COLUMN quorum_finding.agenda_item_id IS
    'Das Traktandum, bei dem festgestellt wurde. NULL, wenn keines aufgerufen war.';
COMMENT ON COLUMN quorum_finding.shortfall IS
    'Woran es fehlte. NULL, wenn die Versammlung beschlussfähig war.';
