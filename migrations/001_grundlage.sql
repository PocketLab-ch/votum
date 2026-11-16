-- 001 — Grundlage: Betreiber, Anmeldung, Verlauf
--
-- Setzt AD-5 (nur anfügen), AD-6 (zwei Mandantenebenen mit Zeilenschutz) und
-- AD-12 (Zeit in UTC, Quoten als Ganzzahl) für die erste Welle auf.
-- Migrationen sind aufwärtsgerichtet und additiv (AD-14).

-- UUID v7 ist ab PostgreSQL 18 eingebaut und zeitlich sortierbar.
-- Das verrät im Gegensatz zu einer laufenden Nummer nicht, wie viele Datensätze es gibt.

-- ── Betreiber: oberste Mandantenebene ──────────────────────────────────────
CREATE TABLE operator (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Benutzerkonten für Administration und Sitzungsleitung ──────────────────
CREATE TABLE app_user (
    id             uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id    uuid NOT NULL REFERENCES operator(id) ON DELETE RESTRICT,
    username       text NOT NULL,
    -- Argon2-Ableitung. Nie das Kennwort selbst.
    password_hash  text,
    -- Kennung aus Authentik, falls die Anmeldung darüber läuft.
    oidc_subject   text,
    display_name   text NOT NULL,
    role           text NOT NULL DEFAULT 'chair' CHECK (role IN ('admin', 'chair')),
    disabled_at    timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (operator_id, username)
);

CREATE UNIQUE INDEX app_user_oidc_subject_idx
    ON app_user (oidc_subject) WHERE oidc_subject IS NOT NULL;

-- ── Anmeldesitzungen ───────────────────────────────────────────────────────
CREATE TABLE user_session (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    -- Nur der Prüfwert, damit ein Datenbankauszug keine gültigen Sitzungen preisgibt.
    token_hash    text NOT NULL UNIQUE,
    expires_at    timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    revoked_at    timestamptz
);

CREATE INDEX user_session_user_idx ON user_session (user_id);

-- ── Fehlversuche der Anmeldung ─────────────────────────────────────────────
CREATE TABLE login_attempt (
    id           bigserial PRIMARY KEY,
    username     text NOT NULL,
    succeeded    boolean NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempt_lookup_idx ON login_attempt (username, attempted_at DESC);

-- ── Verlauf: nur anfügen, niemals ändern oder löschen (AD-5) ───────────────
CREATE TABLE audit_entry (
    id            bigserial PRIMARY KEY,
    operator_id   uuid REFERENCES operator(id) ON DELETE RESTRICT,
    -- Wer gehandelt hat. Null bei Systemvorgängen und fehlgeschlagenen Anmeldungen.
    actor_user_id uuid REFERENCES app_user(id) ON DELETE RESTRICT,
    actor_label   text NOT NULL,
    -- Art des Ereignisses, z. B. 'user.login', 'stweg.created'.
    event_type    text NOT NULL,
    -- Betroffener Gegenstand: Tabelle und Kennung.
    subject_type  text,
    subject_id    text,
    -- Sachangaben zum Ereignis. Nie Kennwörter, nie Zugangsmerkmale.
    detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    -- Woher die Zeit stammt. Im lokalen Betrieb ohne Netz kann die Uhr falsch
    -- gehen; das muss im Nachhinein erkennbar bleiben (AD-12).
    clock_source  text NOT NULL DEFAULT 'system'
);

CREATE INDEX audit_entry_operator_idx ON audit_entry (operator_id, occurred_at DESC);
CREATE INDEX audit_entry_subject_idx  ON audit_entry (subject_type, subject_id);

-- Der Schutz liegt in der Datenbank, nicht in der Anwendung. Ein späterer
-- Codepfad oder eine Wartungsabfrage kann den Verlauf damit nicht umschreiben.
CREATE OR REPLACE FUNCTION verhindere_aenderung() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'Tabelle % ist nur anfügbar (AD-5): % ist nicht zulässig',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_entry_kein_update
    BEFORE UPDATE ON audit_entry
    FOR EACH ROW EXECUTE FUNCTION verhindere_aenderung();

CREATE TRIGGER audit_entry_kein_delete
    BEFORE DELETE ON audit_entry
    FOR EACH ROW EXECUTE FUNCTION verhindere_aenderung();

-- ── Zeilenschutz je Betreiber (AD-6) ───────────────────────────────────────
-- Aktiv ab dem ersten Tag, obwohl vorerst nur ein Betreiber besteht. Nachträglich
-- eingeführt wäre er teuer und fehleranfällig.
--
-- Achtung beim Gebrauch: Der Mandantenkontext wird je Transaktion gesetzt und
-- endet mit dem Commit. Eine Abfrage danach ohne erneutes Setzen scheitert still
-- an der Regel und liefert eine leere Menge statt eines Fehlers.

ALTER TABLE app_user    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user    FORCE  ROW LEVEL SECURITY;
ALTER TABLE audit_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entry FORCE  ROW LEVEL SECURITY;

CREATE POLICY app_user_mandant ON app_user
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

CREATE POLICY audit_entry_mandant ON audit_entry
    USING (operator_id::text = current_setting('versammlung.operator_id', true)
           OR operator_id IS NULL);
