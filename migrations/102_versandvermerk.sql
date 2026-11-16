-- Der Vermerk «Einladung ist hinausgegangen» — von Hand, und aus der Mail.
--
-- **Warum es ihn braucht.** Der Erinnerungslauf (Migration 099) leitet bisher
-- allein daraus ab, ob eine Einladung draussen ist, dass jemand IN der Anwendung
-- das Versandpaket geholt hat. Wer die Einladung im eigenen Mailprogramm
-- schreibt, kann das nicht sagen — und bekommt die Erinnerung weiter, bis die
-- Versammlung vorbei ist. Der Mailtext gesteht das seit dem 01.09.2026 selbst
-- ein: «Haben Sie sie ausserhalb der Anwendung geschrieben und verschickt, ist
-- diese Erinnerung gegenstandslos.»
--
-- **Ein Hilfsmittel, kein Zwangsinstrument** (Auftraggeber, 02.09.2026). Der Vermerk
-- schaltet die Erinnerung ab und sonst nichts: Er gibt keine Rechte, blockiert
-- keinen Schritt und behauptet nichts über den Postausgang der Bewirtschaftung.
-- Deshalb ist er auch umkehrbar.

ALTER TABLE meeting
	-- Wann jemand gesagt hat, die Einladung sei hinaus. NULL heisst «nicht gesagt».
	ADD COLUMN invitation_sent_marked_at timestamptz,
	-- Wer es gesagt hat, im Klartext für die Anzeige: ein Benutzername oder
	-- «über den Link in der Erinnerung». Die Kennung steht im Verlauf.
	ADD COLUMN invitation_sent_marked_by text,
	/*
	 * Der Prüfwert der Marke aus der Erinnerungsmail.
	 *
	 * **Nur der Prüfwert** (NFR-5, wie bei den Zugangscodes): Wer die Datenbank
	 * liest, kann daraus keinen gültigen Link bauen. Der Klartext steht einmal in
	 * der Mail und sonst nirgends.
	 */
	ADD COLUMN invitation_reminder_token_hash text;

ALTER TABLE meeting
	ADD CONSTRAINT meeting_versandvermerk
	CHECK (
		(invitation_sent_marked_at IS NULL AND invitation_sent_marked_by IS NULL)
		OR (invitation_sent_marked_at IS NOT NULL AND invitation_sent_marked_by IS NOT NULL)
	);

-- Der Weg vom Link zur Versammlung. Eindeutig, damit zwei Läufe nicht dieselbe
-- Marke vergeben können, und teilweise, weil das Feld fast überall NULL ist.
CREATE UNIQUE INDEX meeting_erinnerungsmarke
	ON meeting (invitation_reminder_token_hash)
	WHERE invitation_reminder_token_hash IS NOT NULL;

/*
 * Die Marke einlösen — ohne angemeldeten Betreiber.
 *
 * **Warum SECURITY DEFINER.** Der Link kommt aus einem Postfach, nicht aus einer
 * Sitzung: Es gibt keinen Mandantenkontext, den RLS auswerten könnte. Dasselbe
 * Muster trägt seit Migration 018 den Zugang des Eigentümers über
 * `zugang_einloesen` — die Funktion ermittelt den Mandanten selbst, statt dem
 * Aufrufer zu glauben.
 *
 * **Sie kann genau eines**: den Vermerk setzen. Kein Lesen von Inhalten, kein
 * Ändern von sonst etwas, und die Marke ist danach verbraucht.
 *
 * Der Rückgabewert unterscheidet drei Ausgänge, weil sie verschiedene Sätze
 * verdienen: `gesetzt` (der Regelfall), `schon_vermerkt` (jemand war schneller,
 * oder der Link wurde zweimal geklickt — kein Fehler) und `unbekannt` (Marke
 * verbraucht, abgelaufen oder erfunden).
 */
CREATE OR REPLACE FUNCTION einladung_versand_vermerken(
	marke_pruefwert text,
	wer text
)
RETURNS TABLE (ausgang text, versammlung uuid, betreiber uuid, gemeinschaft text, tag date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	z record;
BEGIN
	IF marke_pruefwert IS NULL OR btrim(marke_pruefwert) = '' THEN
		RETURN QUERY SELECT 'unbekannt'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::date;
		RETURN;
	END IF;

	/*
	 * **Die Zeile wird gesperrt, bevor sie gelesen wird.**
	 *
	 * Ein `SELECT` ohne Sperre, gefolgt von einem `UPDATE`, liesse zwei
	 * gleichzeitige Aufrufe beide «gesetzt» melden und zwei Verlaufseinträge
	 * schreiben — die Einmaligkeit, die dieser Funktion ihren Sinn gibt, hinge
	 * dann am Zufall (Code-Review 02.09.2026). Mit `FOR UPDATE OF m` wartet der
	 * zweite Aufruf, findet den Prüfwert danach auf NULL und meldet «unbekannt».
	 */
	SELECT m.id, m.operator_id, m.meeting_date, m.invitation_sent_marked_at, s.name AS stweg_name
	  INTO z
	  FROM meeting m
	  JOIN stweg s ON s.id = m.stweg_id
	 WHERE m.invitation_reminder_token_hash = marke_pruefwert
	   FOR UPDATE OF m;

	IF NOT FOUND THEN
		RETURN QUERY SELECT 'unbekannt'::text, NULL::uuid, NULL::uuid, NULL::text, NULL::date;
		RETURN;
	END IF;

	IF z.invitation_sent_marked_at IS NOT NULL THEN
		/*
		 * Schon vermerkt: Die Marke wird trotzdem verbraucht, und der Zeitpunkt des
		 * ERSTEN Vermerks bleibt stehen. Ein Link, der beliebig oft ins Leere
		 * führt, ist nur noch eine Angriffsfläche.
		 */
		UPDATE meeting SET invitation_reminder_token_hash = NULL WHERE id = z.id;
		RETURN QUERY SELECT 'schon_vermerkt'::text, z.id, z.operator_id, z.stweg_name, z.meeting_date;
		RETURN;
	END IF;

	UPDATE meeting
	   SET invitation_sent_marked_at      = now(),
	       invitation_sent_marked_by      = wer,
	       invitation_reminder_token_hash = NULL
	 WHERE id = z.id;

	RETURN QUERY SELECT 'gesetzt'::text, z.id, z.operator_id, z.stweg_name, z.meeting_date;
END;
$$;

/*
 * Nachsehen, wozu eine Marke gehört — **ohne sie zu verbrauchen**.
 *
 * Die Seite hinter dem Link soll sagen, um welche Versammlung es geht, bevor
 * jemand etwas bestätigt. Sie kann das nicht selbst abfragen: `meeting` steht
 * unter RLS mit `FORCE`, und hier gibt es keinen Mandantenkontext — ein
 * gewöhnliches `SELECT` bekommt die leere Menge, und die Seite behauptete «Link
 * gilt nicht mehr», obwohl er gilt.
 *
 * **Sie gibt nur heraus, was ohnehin in der Mail steht**, die den Link enthält:
 * Name der Gemeinschaft, Tag der Versammlung, und ob schon vermerkt ist. Wer
 * die Marke hat, hatte die Mail.
 */
CREATE OR REPLACE FUNCTION einladung_marke_ansehen(marke_pruefwert text)
RETURNS TABLE (gemeinschaft text, tag date, schon_vermerkt boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT s.name, m.meeting_date, (m.invitation_sent_marked_at IS NOT NULL)
	  FROM meeting m JOIN stweg s ON s.id = m.stweg_id
	 WHERE marke_pruefwert IS NOT NULL
	   AND btrim(marke_pruefwert) <> ''
	   AND m.invitation_reminder_token_hash = marke_pruefwert;
$$;

REVOKE ALL ON FUNCTION einladung_marke_ansehen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION einladung_marke_ansehen(text) TO versammlung_app;

/*
 * **Erst zurücknehmen, dann gezielt vergeben** — Hauskonvention, 21 der 23
 * Funktionen dieses Repos tun es. Ohne `REVOKE` behält `PUBLIC` das
 * voreingestellte `EXECUTE`, und diese Funktion schreibt als `SECURITY DEFINER`
 * an RLS vorbei: Jede künftige Rolle hätte damit einen mandantenübergreifenden
 * Schreibweg (Code-Review 02.09.2026).
 */
REVOKE ALL ON FUNCTION einladung_versand_vermerken(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION einladung_versand_vermerken(text, text) TO versammlung_app;
