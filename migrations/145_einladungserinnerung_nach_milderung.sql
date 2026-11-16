-- 145: Die Erinnerung an den Versand greift nach einer Milderung des Mehrs wieder
--
-- **Produktentscheid 06.10.2026, «Ja, erneut erinnern».** Wird das Mehr eines
-- Traktandums nach der Freigabe milder (Migration 144, `achteEinladungsmehr` in
-- `src/lib/server/einladungsmehr.ts`), muss die berichtigte Einladung neu
-- hinaus. Die Erinnerung aus Migration 099 schwieg dazu: Sie geht einmal je
-- Versammlung, und nie mehr, sobald eine Einladung erzeugt wurde. Genau das ist
-- nach einer Milderung der Regelfall, denn die erste Einladung ist draussen.
--
-- **Migration 099 bleibt eingefroren** (AD-14). Diese Datei ersetzt nur die
-- Funktion, mit gleicher Signatur und gleicher Rückgabe; ein `DROP` braucht es
-- deshalb nicht.

-- ── Wer erinnert werden muss, jetzt mit einem zweiten Zweig ────────────────
--
-- **Der erste Zweig ist die Bedingung aus 099, unverändert.** Der zweite nimmt
-- eine freigegebene Versammlung auf, an der ein Traktandum seit der Freigabe
-- milder geworden ist und deren berichtigte Einladung noch aussteht
-- (`released_requirement_before` gesetzt), und zwar unabhängig davon, ob eine
-- Einladung erzeugt wurde.
--
-- **Warum grob.** Ob die berichtigte Einladung gültig vermerkt ist, hängt am
-- Tag des Vermerks in hiesiger Zeit und am letzten Tag der Einberufungsfrist
-- (`neuversandGilt` in `src/lib/domain/einladungsmehr.ts`). Diese Rechnung steht
-- im Kern und wird von Hinweis, Rückweg und Eröffnen geteilt; eine zweite
-- Fassung in SQL liefe beim ersten Umbau still auseinander. Die Funktion liefert
-- deshalb eher zu viele Kandidaten, und der Dienst entscheidet fein. Ist der
-- Neuversand gültig vermerkt, greifen dort die Prüfungen aus 099 wie bisher.
--
-- **Warum der Merker nicht zurückgesetzt wird.** «Nach der Milderung schon
-- erinnert» heisst hier: `invitation_reminder_sent_at` liegt nicht vor
-- `released_requirement_relaxed_at`. Ein Zurücksetzen beim Mildern gäbe einen
-- zweiten Schreiber auf den Merker, und der Zeitpunkt der ersten Erinnerung
-- ginge verloren. So bleibt der Merker, was er war, und nach jeder Milderung
-- geht die Erinnerung einmal. Der Dienst beansprucht ihn mit derselben
-- Bedingung, damit zwei gleichzeitige Läufe verschiedene Antworten bekommen.
--
-- **Zeitfenster, Archiv, Frist und Zustand gelten für beide Zweige.** Nach der
-- Eröffnung ist nichts mehr zu berichtigen; dann regelt
-- `regleEinladungsmehrBeimEroeffnen`, welches Mehr gilt.
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
           -- Wie in 099: noch nie erinnert, und keine Einladung erzeugt.
           (m.invitation_reminder_sent_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM audit_entry e
                 WHERE e.subject_type = 'meeting'
                   AND e.subject_id = m.id::text
                   AND e.event_type = ereignis_erzeugt
            ))
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
    'Kandidaten für die Versanderinnerung, betreiberübergreifend: vor dem ersten Versand und nach jeder Milderung des Mehrs (Migration 145). Gibt nur Kennungen heraus; alles Weitere liest der Dienst im Kontext des Betreibers.';

-- ── Der Spaltenkommentar aus 144 stimmt seit dem Folgeantrag nicht mehr ────
--
-- 144 sagte «NULL heisst keine Untergrenze» und zählte das spontane Traktandum
-- dazu. Seit dem Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»
-- (`untergrenzeDesFolgeantrags`), trägt ein Folgeantrag NULL und hält trotzdem
-- die Untergrenze seines angekündigten Traktandums.
COMMENT ON COLUMN agenda_item.released_requirement IS
	'Das Mehr, das die Einladung nennt: bei der Freigabe festgehalten, bei der Rücknahme verworfen, vor Beginn mit einer Milderung nachgeführt. NULL heisst: Die Zeile trägt selbst keine Untergrenze (kein Erfordernis, Grenzfall, Kenntnisnahme, spontanes Traktandum). Ein Folgeantrag hält trotzdem die Untergrenze seines angekündigten Traktandums (untergrenzeDesFolgeantrags); ein Rückkommen oder ein neues Geschäft hat keine.';
