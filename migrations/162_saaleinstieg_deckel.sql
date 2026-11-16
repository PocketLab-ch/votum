-- 162: Saalmeldungen gedeckelt (D10, Sicherheitsdurchgang 09.10.2026).
--
-- **Der Befund.** `saaleinstieg_melden` (017) schrieb je Aufruf eine Zeile nach
-- `room_entry_request`, ohne Obergrenze und von einem offenen Pfad aus: Der
-- Saal-QR ist für alle derselbe, wer ihn abfotografiert, kann `/e/<merkmal>`
-- beliebig oft abschicken, solange die Versammlung läuft. Für die Codewege hat
-- das Haus gemessen, dass 700 Anfragen je Sekunde von einem Rechner kommen
-- (056), und dort bewusst gezählt statt geschrieben. Hier füllte sich die
-- Tabelle bis zur vollen Platte, auf einem Notebook im Saal, und die echten
-- Meldungen gingen in der Liste der Sitzungsleitung unter.
--
-- **Warum ein Deckel und kein Zähler.** Eine Saalmeldung ist kein Versuch,
-- sondern ein Datensatz, den die Sitzungsleitung zuordnet; einen Zähler könnte
-- sie nicht zuordnen. Begrenzt wird deshalb die Zahl der Zeilen je
-- Versammlung, in allen Zuständen: Auch zugeordnete und abgelehnte belegen
-- Platz, und eine abgelehnte Flut darf nicht Raum für die nächste schaffen.
--
-- **Warum 500.** Die Lastprobe (`e2e/last.mjs`) rechnet mit 14 Telefonen und
-- wird für die Grenze mit 40 gefahren. Eine Saalmeldung schickt nur, wer seine
-- Karte nicht dabeihat, und meist einmal. Selbst eine Gemeinschaft mit 150
-- Parteien, von denen jede dreimal meldet, bliebe unter 500. Belegt werden
-- dabei höchstens 500 mal 400 Zeichen (Name und Bemerkung je 200, siehe unten),
-- rund 200 KB je Versammlung statt unbegrenzt.
--
-- **Ohne Sperre, mit Absicht.** Gezählt wird ohne Zeilensperre; gleichzeitige
-- Meldungen können den Deckel um so viele Zeilen überschreiten, wie die
-- Anwendung Verbindungen offen hat. Das begrenzt die Platte genauso, und eine
-- Sperre auf `meeting` träfe jeden anderen Schreibweg der laufenden
-- Versammlung.
--
-- **Ist der Deckel erreicht, wirft die Funktion `VO162`**, statt `NULL`
-- zurückzugeben: `NULL` heisst «die Versammlung läuft nicht», und mit diesem
-- Satz stünde die Person vor einer laufenden Versammlung. `meldeUeberSaal`
-- übersetzt den Code in einen Hinweis auf den Eingang. Die Klasse «VO» ist
-- keine der von PostgreSQL vergebenen (wie `VO117`).
--
-- **Die Längen von Name und Bemerkung** prüfte bisher nur die Anwendung, die
-- Bemerkung gar nur das Eingabefeld (`maxlength="200"`). Ohne sie trüge jede der
-- 500 Zeilen beliebig viel Text, und der Deckel hielte die Platte nicht.
-- Gemessen in Zeichen wie in `zeichenzahl()`; die Anwendung weist vorher mit
-- eigenem Satz ab, hier geht es um den Weg an ihr vorbei.

CREATE OR REPLACE FUNCTION saaleinstieg_melden(merkmal text, name text, bemerkung text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	v record;
	neu uuid;
	bisher integer;
BEGIN
	SELECT m.operator_id AS oid, m.id AS mid, m.state AS zustand
	INTO v
	FROM meeting m WHERE m.room_entry_token = merkmal LIMIT 1;

	IF NOT FOUND OR v.zustand <> 'laufend' THEN
		RETURN NULL;
	END IF;

	IF char_length(btrim(name)) > 200
	   OR char_length(btrim(coalesce(bemerkung, ''))) > 200 THEN
		RAISE EXCEPTION 'Saalmeldung zu lang.' USING ERRCODE = 'check_violation';
	END IF;

	SELECT count(*) INTO bisher FROM room_entry_request WHERE meeting_id = v.mid;
	IF bisher >= 500 THEN
		RAISE EXCEPTION 'Die Saalmeldungen dieser Versammlung sind ausgeschöpft.'
			USING ERRCODE = 'VO162';
	END IF;

	INSERT INTO room_entry_request (operator_id, meeting_id, claimed_name, note)
	VALUES (v.oid, v.mid, btrim(name), nullif(btrim(coalesce(bemerkung, '')), ''))
	RETURNING id INTO neu;

	RETURN neu;
END;
$$;

REVOKE ALL ON FUNCTION saaleinstieg_melden(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION saaleinstieg_melden(text, text, text) TO versammlung_app;
