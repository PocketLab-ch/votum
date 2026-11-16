-- 146: Der Merker der Erinnerung nach einer Milderung, und die Linkseite
--
-- **Korrekturrunde 06.10.2026** nach Laien-, Fach- und Codeprüfung zu
-- Migration 145. Migration 145 ist auf Dev eingespielt und damit eingefroren
-- (AD-14); was dort ungenau steht, wird hier richtiggestellt.

-- ── Warum der Merker nicht zurückgesetzt wird, richtig begründet ───────────
--
-- 145 begründete: Ein Zurücksetzen beim Mildern gäbe einen zweiten Schreiber
-- auf den Merker, «und der Zeitpunkt der ersten Erinnerung ginge verloren».
-- Der zweite Teil stimmt nicht (Codeprüfung N5): `beanspruche` in
-- `src/lib/server/einladungserinnerung.ts` überschreibt den Merker bei der
-- Erinnerung nach der Milderung ohnehin. Der Grund ist allein der zweite
-- Schreiber: Der Merker gehört dem Dienst, und `achteEinladungsmehr` soll ihn
-- nicht anfassen müssen. Der Zeitpunkt der ersten Erinnerung bleibt im Verlauf
-- (Ereignis «An den Versand der Einladung erinnert»), nicht in der Spalte.
COMMENT ON COLUMN meeting.invitation_reminder_sent_at IS
    'Wann zuletzt an den Versand der Einladung erinnert wurde. NULL heisst: noch nicht. Ein Wert, der älter ist als eine noch ausstehende Milderung des Mehrs, gilt als frei (Migration 145); frühere Erinnerungen stehen im Verlauf.';

-- ── Die Linkseite muss wissen, ob eine berichtigte Einladung aussteht ──────
--
-- Die Seite hinter dem Link aus der Erinnerung (`/b/<marke>`) läuft ohne
-- Mandantenkontext, wie `einladung_marke_ansehen` aus Migration 102. Nach
-- einer Milderung fragt sie anders: ob die berichtigte Einladung spätestens am
-- letzten Fristtag bei allen ist, und nach diesem Tag gar nicht mehr. Dafür
-- braucht sie die letzte ausstehende Milderung, den Vermerk, den
-- Versammlungstag und die Frist in Tagen.
--
-- **Eine eigene Funktion statt einer breiteren `einladung_marke_ansehen`.**
-- Deren Rückgabe ändern hiesse `DROP` und neu anlegen, und an ihr hängt die
-- bestehende Seite. Die Rechnung selbst (`neuversandGilt`) bleibt im Kern;
-- hier stehen nur die Angaben dazu.
--
-- **Was herauskommt, verlässt den Server nicht.** Die Seite zeigt daraus nur
-- den letzten Fristtag, und den nennt die Mail mit dem Link ohnehin. Eine Zeile
-- gibt es nur für eine freigegebene Versammlung; danach ist nichts mehr zu
-- berichtigen.
CREATE FUNCTION einladung_marke_neuversand(marke_pruefwert text)
RETURNS TABLE (
    milderung_seit timestamptz,
    vermerkt_am timestamptz,
    versammlungstag date,
    frist_tage integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- `pg_temp` ausdrücklich am Schluss, wie in 099 und 102 (Migration 016).
SET search_path = public, pg_temp
AS $$
    SELECT (SELECT max(a.released_requirement_relaxed_at)
              FROM agenda_item a
             WHERE a.meeting_id = m.id
               AND a.operator_id = m.operator_id
               AND a.released_requirement_before IS NOT NULL),
           m.invitation_sent_marked_at,
           m.meeting_date,
           s.invitation_lead_days
      FROM meeting m
      JOIN stweg s ON s.id = m.stweg_id AND s.operator_id = m.operator_id
     WHERE marke_pruefwert IS NOT NULL
       AND btrim(marke_pruefwert) <> ''
       AND m.invitation_reminder_token_hash = marke_pruefwert
       AND m.state = 'freigegeben';
$$;

REVOKE ALL ON FUNCTION einladung_marke_neuversand(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION einladung_marke_neuversand(text) TO versammlung_app;

COMMENT ON FUNCTION einladung_marke_neuversand(text) IS
    'Für die Linkseite der Erinnerung: ob nach einer Milderung eine berichtigte Einladung aussteht. Gibt nur Zeitpunkte, Versammlungstag und Frist in Tagen heraus; gerechnet wird im Kern.';
