-- Der Anzeigecode gibt auch nach dem Schluss noch Auskunft — eine Stunde lang.
--
-- **Der Anlass, am 21.08.2026.** Zur neuen Abschlussseite auf der Leinwand
-- («Auf der Präsentationssicht braucht es dann eine Abschlussseite. Eventuell
-- mit den Auswertungen der Traktandenabstimmungen?») gehört, dass die Leinwand
-- sie auch zeigen kann. Bis hierher entwertete das Schliessen den Anzeigecode,
-- und die Wand fiel im selben Augenblick vor dem ganzen Saal auf die
-- Code-Eingabe zurück.
--
-- **Warum eine Frist und nicht «für immer».** Die Stunde nach dem Schluss ist
-- der Saal: aufstehen, nachlesen, hinausgehen. Was die Wand dann zeigt, steht
-- ohnehin im Protokoll — Nummern, Titel, Ergebnis, keine Namen (AD-11). Danach
-- soll ein Zettel in einer Tasche nicht Wochen später noch Beschlüsse hergeben.
-- Die Frist selbst rechnet die Anwendung; hier fehlte nur die Angabe dafür.
--
-- **Warum DROP und CREATE statt CREATE OR REPLACE:** Der Rückgabetyp ändert
-- sich, und PostgreSQL lässt das bei einer Ersetzung nicht zu.
DROP FUNCTION anzeigecode_aufloesen(text);

CREATE FUNCTION anzeigecode_aufloesen(pruefwert text)
RETURNS TABLE (operator_id uuid, meeting_id uuid, meeting_state text, closed_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT m.operator_id, m.id, m.state, m.closed_at
	FROM meeting m
	WHERE m.display_code_hash = pruefwert
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION anzeigecode_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anzeigecode_aufloesen(text) TO versammlung_app;
