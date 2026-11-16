-- 002 — Anwendungsrolle mit eingeschränkten Rechten
--
-- Zwei Rollen statt einer, weil sonst weder AD-5 noch AD-6 wirksam sind:
--
--   versammlung      Migrationen. Eigentümer der Tabellen, umgeht den Zeilenschutz.
--   versammlung_app  Die Anwendung. Unterliegt dem Zeilenschutz und darf auf
--                    nachweisrelevanten Tabellen weder ändern noch löschen.
--
-- Ohne diese Trennung läuft die Anwendung als Superuser, und dann greift weder
-- der Zeilenschutz (Superuser umgehen ihn immer, auch bei FORCE) noch der
-- Schreibschutz. Beide Regeln wären da, aber wirkungslos — und ein Test, der
-- als Superuser läuft, würde das nie zeigen.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'versammlung_app') THEN
        -- Kennwort wird nach der Migration gesetzt; ohne Kennwort keine Anmeldung.
        CREATE ROLE versammlung_app LOGIN;
    END IF;
END
$$;

GRANT CONNECT ON DATABASE versammlung TO versammlung_app;
GRANT USAGE ON SCHEMA public TO versammlung_app;

-- Grundrechte auf allen bestehenden Tabellen
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO versammlung_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO versammlung_app;

-- Künftige Tabellen erben dieselben Rechte, damit eine neue Migration die
-- Rechtevergabe nicht vergessen kann.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO versammlung_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO versammlung_app;

-- ── AD-5: nachweisrelevante Tabellen sind für die Anwendung nur anfügbar ────
-- Der Trigger aus Migration 001 fängt es ohnehin ab; der Rechteentzug sorgt
-- dafür, dass der Versuch gar nicht erst bis dorthin kommt. Zwei Schranken,
-- weil eine davon durch eine spätere Migration versehentlich fallen könnte.
REVOKE UPDATE, DELETE ON audit_entry FROM versammlung_app;

-- Migrationstabelle geht die Anwendung nichts an.
REVOKE ALL ON schema_migration FROM versammlung_app;
GRANT SELECT ON schema_migration TO versammlung_app;

-- Die Anwendung darf keine Rollen anlegen und keine Struktur ändern.
REVOKE CREATE ON SCHEMA public FROM versammlung_app;
