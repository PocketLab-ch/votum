-- Die Erinnerung an den Versand der Einladung (Auftraggeber, 28.08.2026: «Es braucht
-- dann noch einen Reminder-Mail, der einen Werktag vor Ablauf der Versandfrist
-- eine Erinnerungsmail schickt, sollte die Einladung noch nicht versendet
-- worden sein»). Auslöser ist ein Zeitgeber im Dienst, ausdrücklich freigegeben
-- am 01.09.2026.

-- ── Wohin die Erinnerung geht ──────────────────────────────────────────────
--
-- An die Bewirtschaftung, nicht an die Eigentümer: Verschicken muss sie, und
-- niemand sonst kann etwas daran ändern.
--
-- **Eine eigene Adresse und nicht die eines Benutzerkontos.** Konten gehören
-- Personen, und Personen sind in den Ferien. Die Erinnerung gehört an die
-- Adresse, die das Haus ohnehin liest.
ALTER TABLE operator ADD COLUMN reminder_address text;

COMMENT ON COLUMN operator.reminder_address IS
    'Wohin Erinnerungen der Anwendung gehen. NULL heisst: es wird nicht erinnert.';

-- ── Der Merker, damit sie einmal geht ──────────────────────────────────────
--
-- **In der Datenbank und nicht im Speicher des Dienstes.** Ein Merker im
-- Speicher überlebt keinen Neustart, und der Neustart ist der Regelfall: Bei
-- jedem Aufspielen ginge die Erinnerung ein zweites Mal hinaus.
--
-- Er wird **vor** dem Versand gesetzt und nur bei einem Fehlschlag wieder
-- geleert. Andersherum — erst senden, dann merken — schickte bei einem Absturz
-- dazwischen beim nächsten Lauf dieselbe Nachricht nochmals. Lieber eine
-- Erinnerung zu wenig als ein Postfach voll derselben.
ALTER TABLE meeting ADD COLUMN invitation_reminder_sent_at timestamptz;
ALTER TABLE meeting ADD COLUMN invitation_reminder_kind    text;

ALTER TABLE meeting ADD CONSTRAINT meeting_erinnerungsart
    CHECK (invitation_reminder_kind IS NULL
           OR invitation_reminder_kind IN ('vorwarnung', 'abgelaufen'));

COMMENT ON COLUMN meeting.invitation_reminder_sent_at IS
    'Wann an den Versand der Einladung erinnert wurde. Einmal je Versammlung; NULL heisst: noch nicht.';

-- ── Wer erinnert werden muss ───────────────────────────────────────────────
--
-- **Warum diese Funktion den Zeilenschutz umgeht — und wie eng.** Der
-- Zeitgeber gehört keinem Betreiber. Er kann deshalb nicht mit
-- `versammlung.operator_id` arbeiten, und ohne diese Angabe liefert jede
-- Abfrage der Anwendungsrolle die leere Menge (AD-6). Ohne einen solchen Weg
-- gäbe es die Erinnerung nur, wenn die Anwendung als Superuser liefe — und das
-- wäre der viel grössere Eingriff.
--
-- Die Funktion gibt deshalb **nur zwei Kennungen** heraus, keine Namen, keine
-- Adressen, keine Orte. Alles Weitere holt der Dienst danach im Kontext des
-- gefundenen Betreibers, also wieder unter dem Zeilenschutz.
--
-- **Die Ereignisart kommt als Parameter**, statt hier abgeschrieben zu werden:
-- Sie steht in `$lib/domain/verlauf`, und eine zweite Fassung davon liefe beim
-- ersten Umbenennen still auseinander.
--
-- **Es ist genau eine**, und zwar die erzeugte Einladung. Der Mailversand der
-- Anwendung schickt die Zugangskarten; die Einladung mit Traktandenliste geht
-- daneben hinaus, und ihr Begleittext sagt das ausdrücklich. Sein Ereignis
-- mitzuzählen hiesse, die Erinnerung abzuschalten, obwohl die Einladung selbst
-- noch nirgends steht — und der Vorbereitungsschritt daneben zeigte weiter
-- «offen».
--
-- Das Zeitfenster ist grob: Ob heute erinnert wird, entscheidet der Kern
-- (`erinnerungsfall` in `$lib/domain/einberufungsfrist`), der den letzten
-- Werktag vor der Frist kennt. Drei Tage Vorlauf decken den weitesten Fall ab
-- (Frist am Montag, Erinnerung am Freitag).
--
-- **`current_date` ist die Zeit der Datenbank, der Kern rechnet in hiesiger.**
-- Laeuft der Server in UTC, gehen die beiden zwischen Mitternacht und zwei Uhr
-- morgens um einen Tag auseinander. Das Fenster hier ist deshalb absichtlich
-- weiter als noetig; und wer dabei eine Stunde spaeter erinnert wird, bekommt
-- die Nachricht beim naechsten stuendlichen Lauf.
CREATE FUNCTION faellige_einladungserinnerungen(ereignis_erzeugt text)
RETURNS TABLE (operator_id uuid, meeting_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- `pg_temp` ausdruecklich am Schluss, wie in den uebrigen 19 Funktionen dieses
-- Repos (Migration 016 begruendet es): Sonst sucht PostgreSQL temporaere
-- Relationen zuerst, und eine untergeschobene `meeting`-Tabelle bestimmte, welche
-- Kennungen hier herauskommen.
SET search_path = public, pg_temp
AS $$
    SELECT m.operator_id, m.id
      FROM meeting m
      JOIN stweg s ON s.id = m.stweg_id AND s.operator_id = m.operator_id
     WHERE m.invitation_reminder_sent_at IS NULL
       AND m.archived_at IS NULL
       AND m.state IN ('entwurf', 'freigegeben')
       AND s.invitation_lead_days IS NOT NULL
       AND s.archived_at IS NULL
       AND stweg_archiv_wegen(m.stweg_id) IS NULL
       -- Nach dem Versammlungstag ist nichts mehr zu retten.
       AND m.meeting_date >= current_date
       AND (m.meeting_date - s.invitation_lead_days) <= current_date + 3
       AND NOT EXISTS (
           SELECT 1 FROM audit_entry e
            WHERE e.subject_type = 'meeting'
              AND e.subject_id = m.id::text
              AND e.event_type = ereignis_erzeugt
       )
$$;

REVOKE ALL ON FUNCTION faellige_einladungserinnerungen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION faellige_einladungserinnerungen(text) TO versammlung_app;

COMMENT ON FUNCTION faellige_einladungserinnerungen(text) IS
    'Kandidaten für die Versanderinnerung, betreiberübergreifend. Gibt nur Kennungen heraus; alles Weitere liest der Dienst im Kontext des Betreibers.';
