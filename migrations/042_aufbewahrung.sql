-- 042 — Aufbewahrung und Löschung (FR-57)
--
-- **Zwei gegenläufige Pflichten, ein Mechanismus.**
--
--   * Was den Beschluss trägt, muss zehn Jahre haltbar sein (GeBüV). Eine
--     Löschung, die ein Abschlusspaket beträfe, wird deshalb abgewiesen,
--     solange dessen Frist läuft — und zwar in der Datenbank, nicht in der
--     Oberfläche. Wer morgen einen neuen Weg zum Löschen baut, kommt an diesem
--     Auslöser vorbei, ob er will oder nicht.
--
--   * Was den Beschluss **nicht** trägt, hat nach der Versammlung nichts mehr
--     verloren zu suchen: Zugangscodes, Gerätesitzungen, Wartelisten. Sie
--     stehen ausdrücklich nicht im Paket (siehe Manifest, «nichtEnthalten»),
--     also kostet ihre Löschung keinen Nachweis.
--
-- **Gelöscht wird von Hand, nicht von selbst.** Kein Auftrag, der nachts läuft
-- und irgendwann etwas wegräumt, das noch gebraucht wurde. Die Anwendung zeigt,
-- was löschbar ist; drücken muss jemand.

ALTER TABLE operator
    ADD COLUMN retention_years integer NOT NULL DEFAULT 10;

ALTER TABLE operator
    ADD CONSTRAINT operator_aufbewahrung CHECK (retention_years BETWEEN 1 AND 50);

COMMENT ON COLUMN operator.retention_years IS
    'Aufbewahrungsfrist für Abschlusspakete in Jahren. Vorgabe zehn (GeBüV); je Betreiber einstellbar (FR-57).';

-- Ob für eine Versammlung noch eine Aufbewahrungsfrist läuft.
--
-- Ohne Siegel gibt es nichts aufzubewahren: Eine Versammlung, die nie
-- abgeschlossen wurde, ist ein Entwurf.
CREATE OR REPLACE FUNCTION aufbewahrung_laeuft(die_versammlung uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
          FROM seal s
          JOIN operator o ON o.id = s.operator_id
         WHERE s.meeting_id = die_versammlung
           AND s.sealed_at + make_interval(years => o.retention_years) > now()
    );
$$;

-- Wann die Frist abläuft — für die Anzeige, damit niemand rechnen muss.
CREATE OR REPLACE FUNCTION aufbewahrung_bis(die_versammlung uuid) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
    SELECT s.sealed_at + make_interval(years => o.retention_years)
      FROM seal s
      JOIN operator o ON o.id = s.operator_id
     WHERE s.meeting_id = die_versammlung;
$$;

CREATE OR REPLACE FUNCTION meeting_aufbewahrung() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    bis timestamptz;
BEGIN
    IF aufbewahrung_laeuft(OLD.id) THEN
        bis := aufbewahrung_bis(OLD.id);
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt und wird bis % aufbewahrt. Bis dahin lässt sie sich nicht löschen (FR-57).',
            to_char(bis, 'DD.MM.YYYY');
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER meeting_aufbewahrung
    BEFORE DELETE ON meeting
    FOR EACH ROW EXECUTE FUNCTION meeting_aufbewahrung();

-- Dasselbe eine Ebene höher: Eine Gemeinschaft mitzulöschen, an der ein
-- aufbewahrungspflichtiges Paket hängt, wäre derselbe Verlust auf dem Umweg.
CREATE OR REPLACE FUNCTION stweg_aufbewahrung() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    betroffen integer;
BEGIN
    SELECT count(*) INTO betroffen
      FROM meeting m
     WHERE m.stweg_id = OLD.id AND aufbewahrung_laeuft(m.id);

    IF betroffen > 0 THEN
        RAISE EXCEPTION
            'An dieser Gemeinschaft hängen % versiegelte Versammlungen, deren Aufbewahrungsfrist noch läuft (FR-57).',
            betroffen;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER stweg_aufbewahrung
    BEFORE DELETE ON stweg
    FOR EACH ROW EXECUTE FUNCTION stweg_aufbewahrung();

-- ── Betriebsdaten löschen ───────────────────────────────────────────────────
--
-- **Warum als eigene Funktion und nicht mit einem GRANT.** Die Anwendungsrolle
-- darf Zugänge und Gerätesitzungen nicht löschen, und das mit gutem Grund: Ein
-- gelöschter Zugang liesse sich später nicht von einem nie erzeugten
-- unterscheiden (Migrationen 015 und 018). Diese Regel bleibt. Was FR-57
-- verlangt, ist **ein** eng gefasster Weg daneben — nach der Versammlung, für
-- genau diese drei Tabellen, mit eigener Prüfung des Zustands.
--
-- Ein GRANT DELETE nähme dagegen die Schranke ganz weg und stünde auch mitten
-- in der Sitzung offen.
--
-- Die Funktion läuft mit den Rechten ihres Eigentümers und umgeht damit den
-- Zeilenschutz. Sie bekommt den Betreiber deshalb **mitgegeben** und prüft ihn
-- selbst; ohne das liesse sich über sie in fremde Daten greifen.
CREATE OR REPLACE FUNCTION betriebsdaten_loeschen(der_betreiber uuid, die_versammlung uuid)
RETURNS TABLE (zugaenge integer, sitzungen integer, saalmeldungen integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    zustand text;
    z integer;
    s integer;
    r integer;
BEGIN
    SELECT m.state INTO zustand
      FROM meeting m
     WHERE m.id = die_versammlung AND m.operator_id = der_betreiber;

    IF zustand IS NULL THEN
        RAISE EXCEPTION 'Diese Versammlung gibt es nicht.';
    END IF;
    IF zustand NOT IN ('geschlossen', 'versiegelt') THEN
        RAISE EXCEPTION
            'Diese Versammlung ist noch nicht geschlossen. Solange sie läuft, werden die Zugänge gebraucht.';
    END IF;

    WITH weg AS (
        DELETE FROM access_session z
         USING meeting_access a
         WHERE a.id = z.meeting_access_id AND a.meeting_id = die_versammlung
        RETURNING z.id
    ) SELECT count(*)::int INTO s FROM weg;

    WITH weg AS (
        DELETE FROM meeting_access WHERE meeting_id = die_versammlung RETURNING id
    ) SELECT count(*)::int INTO z FROM weg;

    WITH weg AS (
        DELETE FROM room_entry_request WHERE meeting_id = die_versammlung RETURNING id
    ) SELECT count(*)::int INTO r FROM weg;

    RETURN QUERY SELECT z, s, r;
END;
$$;

REVOKE ALL ON FUNCTION betriebsdaten_loeschen(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION betriebsdaten_loeschen(uuid, uuid) TO versammlung_app;
