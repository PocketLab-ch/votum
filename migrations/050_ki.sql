-- 050 — KI-Unterstützung: steuerbar und abschaltbar (Welle 3, FR-62)
--
-- **Die KI entscheidet nie.** Sie prüft, schlägt vor und formuliert; jedes
-- Ergebnis geht durch die Hand der Sitzungsleitung, bevor es Wirkung entfaltet.
-- Das ist keine Vorsichtsfloskel: Ein Beschluss, dessen Mehrheitserfordernis
-- eine Maschine bestimmt hat, wäre in einer Anfechtung schwer zu verteidigen.
--
-- **Vorgabe: aus.** Nicht, weil die KI gefährlich wäre, sondern weil sie Inhalte
-- von Traktanden, Anträgen und Protokollnotizen an einen Dritten übermittelt —
-- durchaus Personenbezogenes. Wer das will, schaltet es bewusst ein.
--
-- **Je Gemeinschaft und je Funktion.** Eine Gemeinschaft kann die
-- Traktandenprüfung wollen und den Protokollentwurf nicht. Die Ausnahmen stehen
-- als Liste daneben, damit das Einschalten eine Entscheidung bleibt und das
-- Abschalten einzelner Funktionen keine zweite.
ALTER TABLE stweg ADD COLUMN ai_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE stweg ADD COLUMN ai_disabled_functions text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN stweg.ai_enabled IS
    'Ob KI-Unterstützung für diese Gemeinschaft zugelassen ist (FR-62). Vorgabe aus: Es werden Inhalte an einen Dritten übermittelt.';

COMMENT ON COLUMN stweg.ai_disabled_functions IS
    'Einzelne Funktionen, die trotz eingeschalteter KI nicht genutzt werden (FR-62).';

-- ── Was von einer KI-Nutzung festgehalten wird (FR-63) ─────────────────────
--
-- **Gegenstand und Ergebnis, nicht Anfrage und Antwort.** Der Verlauf ist ein
-- Nachweis darüber, wer was entschieden hat — kein zweiter Speicher für
-- Texte, die anderswo schon stehen. Vollständige Anfragen mitzuschreiben hiesse
-- ausserdem, Personenbezogenes ein weiteres Mal abzulegen, und zwar an einer
-- Stelle, die nie gelöscht wird (AD-5).
--
-- Festgehalten wird deshalb: welche Funktion, woran, und **was die
-- Sitzungsleitung damit gemacht hat** — angenommen, abgelehnt oder verändert
-- übernommen. Genau das ist im Streitfall die Frage.
CREATE TABLE ai_usage (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id  uuid NOT NULL REFERENCES operator (id),
    meeting_id   uuid,
    stweg_id     uuid NOT NULL,

    -- Welche Funktion: traktandenpruefung, erfordernisvorschlag,
    -- antragspruefung, protokollentwurf.
    feature      text NOT NULL,
    -- Woran: Art und Kennung des Gegenstands, wie im Verlauf.
    subject_type text,
    subject_id   text,

    -- Was die Sitzungsleitung damit gemacht hat.
    outcome      text,
    -- Wie lange der Anbieter gebraucht hat; für die Frage, ob die Prüfung im
    -- Saal überhaupt taugt (FR-60: «in wenigen Sekunden»).
    duration_ms  integer,
    -- Ob der Anbieter überhaupt geantwortet hat.
    failed       boolean NOT NULL DEFAULT false,
    note         text,

    used_at      timestamptz NOT NULL DEFAULT now(),
    used_by      uuid REFERENCES app_user (id),
    used_by_label text,

    CONSTRAINT ai_usage_funktion CHECK (
        feature IN ('traktandenpruefung', 'erfordernisvorschlag', 'antragspruefung', 'protokollentwurf')
    ),
    CONSTRAINT ai_usage_ergebnis CHECK (
        outcome IS NULL OR outcome IN ('angenommen', 'abgelehnt', 'veraendert')
    ),

    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),
    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id)
);

CREATE INDEX ai_usage_versammlung_idx ON ai_usage (meeting_id, used_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage FORCE  ROW LEVEL SECURITY;

CREATE POLICY ai_usage_mandant ON ai_usage
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE ON ai_usage TO versammlung_app;

-- Gelöscht wird hier nichts: Der Nachweis, dass ein Vorschlag von einer
-- Maschine kam und wer ihn verantwortet hat, gehört zum Beschluss (AD-5).
REVOKE DELETE ON ai_usage FROM versammlung_app;

COMMENT ON TABLE ai_usage IS
    'Jede KI-Nutzung mit Gegenstand und Entscheid der Sitzungsleitung (FR-63). Ohne Anfragen und Antworten.';
