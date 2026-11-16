-- 147: «Einladung erzeugt» zählt nur seit der letzten Rücknahme der Freigabe
--
-- **Produktentscheide 06.10.2026**, «Rücknahme setzt den Merker zurück» und,
-- auf Rückfrage, «Seit Rücknahme zählen». Die Rücknahme der Freigabe nimmt
-- seither auch den Merker der Erinnerung zurück
-- (`loescheEinladungsmehrBeiRuecknahme` in `src/lib/server/einladungsmehr.ts`).
-- Das allein reichte nicht: Das Ereignis «Einladung erzeugt»
-- (`meeting.invitation.created`) wird einmal je Versammlung geschrieben und galt
-- danach für immer. Es unterdrückte die Erinnerung im ersten Zweig von
-- `faellige_einladungserinnerungen`, machte den Vorbereitungsschritt «Einladung
-- erzeugen» erledigt, und ein neues Erzeugen nach der neuen Freigabe wurde nicht
-- mehr vermerkt. Nach Rücknahme und neuer Freigabe ist die Einladung aber eine
-- neue, und die alte sagt über sie nichts.
--
-- **Migration 145 bleibt eingefroren** (AD-14). Diese Datei ersetzt nur die
-- Funktion, mit gleicher Signatur und gleicher Rückgabe; ein `DROP` braucht es
-- deshalb nicht.

-- ── Die Bedingung an einer Stelle ───────────────────────────────────────────
--
-- Ein Ereignis an der Versammlung zählt, wenn es nach dem letzten Ereignis
-- «Freigabe zurückgenommen» (`meeting.release.revoked`) geschrieben wurde. Ohne
-- Rücknahme zählt jedes, wie bisher.
--
-- **Warum eine Funktion.** Dieselbe Bedingung brauchen vier Leser: diese
-- Kandidatensuche, `pruefeUndBeanspruche` in
-- `src/lib/server/einladungserinnerung.ts`, die Vorbereitungslage in
-- `src/lib/server/uebersicht.ts` und `vermerkeEinmalig` in
-- `src/lib/server/unterlagenvermerk.ts`. Viermal ausgeschrieben liefe sie beim
-- ersten Umbau still auseinander, und dann zeigte die Vorbereitung «erledigt»,
-- während die Erinnerung noch käme, oder umgekehrt.
--
-- **Warum mit der Ereignisart als Angabe.** Der Vermerk der Traktandenliste
-- (`agenda.pdf.created`) folgt derselben Regel: Auch sie ist nach der Rücknahme
-- eine neue, und ihr Ereignis ist der Nachweis, wann sie vorlag. Die Arten der
-- erzeugten Unterlagen kommen deshalb vom Aufrufer, wie bei
-- `faellige_einladungserinnerungen`. Die Art der Rücknahme steht hier fest,
-- wie `meeting.agenda.current` in 084 und `agenda.item.removed` in 137; sie
-- entspricht `EREIGNISARTEN.freigabeZurueckgenommen` in
-- `src/lib/domain/verlauf.ts`, und die Datenbanktests in
-- `tests/db/einladungserinnerung.test.ts` gehen über die echte Rücknahme,
-- würden bei einer Umbenennung also rot.
--
-- **Mit den Rechten des Aufrufers** (kein SECURITY DEFINER). Aus der Anwendung
-- gilt damit der Zeilenschutz des Verlaufs wie bei der Abfrage, die sie
-- ersetzt; aus `faellige_einladungserinnerungen` heraus läuft sie mit deren
-- Rechten, wie die Unterabfrage dort bisher.
--
-- **Die Zeitspalte ist `occurred_at`**, also der Beginn der schreibenden
-- Transaktion (`now()`). Die Rücknahme sperrt die Zeile der Versammlung, das
-- Erzeugen nicht. Ein Erzeugen, das vor der Rücknahme begann und erst nach ihr
-- festgeschrieben wird, zählt deshalb nicht; das ist die vorsichtige Seite.
-- Gemeint ist die Transaktion des Vermerks, nicht der Abruf: Die Route liest
-- und rendert das PDF zuerst und vermerkt danach in einer eigenen
-- Transaktion. Offen bleibt deshalb ein Abruf, der den Stand vor der
-- Rücknahme gelesen hat und dessen Vermerk erst nach dem Beginn der Rücknahme
-- beginnt: Er zählte. Das Fenster ist die Dauer von Lesen und Rendern
-- (Codeprüfung Teil 1, N3, 06.10.2026).
CREATE FUNCTION vermerkt_seit_ruecknahme(versammlung uuid, ereignisart text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM audit_entry e
         WHERE e.subject_type = 'meeting'
           AND e.subject_id = versammlung::text
           AND e.event_type = ereignisart
           AND e.occurred_at > coalesce(
               (SELECT max(r.occurred_at) FROM audit_entry r
                 WHERE r.subject_type = 'meeting'
                   AND r.subject_id = versammlung::text
                   AND r.event_type = 'meeting.release.revoked'),
               '-infinity'::timestamptz)
    )
$$;

COMMENT ON FUNCTION vermerkt_seit_ruecknahme(uuid, text) IS
    'Ob das Ereignis an der Versammlung nach der letzten Rücknahme der Freigabe geschrieben wurde (ohne Rücknahme: ob es überhaupt da ist). Für «Einladung erzeugt» und «Traktandenliste erzeugt» (Migration 147).';

-- ── Wer erinnert werden muss: der erste Zweig zählt seit der Rücknahme ────
--
-- **Gegenüber 145 ändert sich allein der erste Zweig.** Statt «keine Einladung
-- erzeugt» heisst er jetzt «keine Einladung seit der letzten Rücknahme
-- erzeugt». Zusammen mit dem zurückgesetzten Merker wird die Versammlung nach
-- Rücknahme und neuer Freigabe also wieder Kandidat. Der zweite Zweig
-- (Milderung) bleibt, wie er war: Die Rücknahme leert
-- `released_requirement_before`, er greift danach erst mit einer neuen
-- Milderung.
--
-- **Es kommen weiter nur zwei Kennungen heraus**, aus dem Grund, den 099
-- nennt: Die Funktion umgeht den Zeilenschutz, und alles Weitere liest der
-- Dienst im Kontext des Betreibers.
CREATE OR REPLACE FUNCTION faellige_einladungserinnerungen(ereignis_erzeugt text)
RETURNS TABLE (operator_id uuid, meeting_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- `pg_temp` ausdrücklich am Schluss, wie in 099 (Migration 016 begründet es).
SET search_path = public, pg_temp
AS $$
    SELECT m.operator_id, m.id
      FROM meeting m
      JOIN stweg s ON s.id = m.stweg_id AND s.operator_id = m.operator_id
     WHERE m.archived_at IS NULL
       AND m.state IN ('entwurf', 'freigegeben')
       AND s.invitation_lead_days IS NOT NULL
       AND s.archived_at IS NULL
       AND stweg_archiv_wegen(m.stweg_id) IS NULL
       -- Nach dem Versammlungstag ist nichts mehr zu retten.
       AND m.meeting_date >= current_date
       AND (m.meeting_date - s.invitation_lead_days) <= current_date + 3
       AND (
           -- Noch nie erinnert (oder seit der Rücknahme nicht mehr), und seit
           -- der letzten Rücknahme keine Einladung erzeugt.
           (m.invitation_reminder_sent_at IS NULL
            AND NOT vermerkt_seit_ruecknahme(m.id, ereignis_erzeugt))
           -- Seit der Freigabe gemildert, und seit der Milderung nicht erinnert.
           OR (m.state = 'freigegeben'
               AND EXISTS (
                   SELECT 1 FROM agenda_item a
                    WHERE a.meeting_id = m.id
                      AND a.operator_id = m.operator_id
                      AND a.released_requirement_before IS NOT NULL
                      AND (m.invitation_reminder_sent_at IS NULL
                           OR m.invitation_reminder_sent_at < a.released_requirement_relaxed_at)
               ))
       )
$$;

REVOKE ALL ON FUNCTION faellige_einladungserinnerungen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION faellige_einladungserinnerungen(text) TO versammlung_app;

COMMENT ON FUNCTION faellige_einladungserinnerungen(text) IS
    'Kandidaten für die Versanderinnerung, betreiberübergreifend: vor dem ersten Versand, nach jeder Rücknahme der Freigabe und nach jeder Milderung des Mehrs (Migrationen 145 und 147). Gibt nur Kennungen heraus; alles Weitere liest der Dienst im Kontext des Betreibers.';

-- ── Der Spaltenkommentar aus 146 kennt die Rücknahme noch nicht ───────────
COMMENT ON COLUMN meeting.invitation_reminder_sent_at IS
    'Wann zuletzt an den Versand der Einladung erinnert wurde. NULL heisst: noch nicht, oder seit der letzten Rücknahme der Freigabe nicht mehr (Migration 147). Ein Wert, der älter ist als eine noch ausstehende Milderung des Mehrs, gilt als frei (Migration 145); frühere Erinnerungen stehen im Verlauf.';
