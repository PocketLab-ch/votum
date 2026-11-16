-- Ein QR-Code für den ganzen Abend.
--
-- **Der Anlass, am 24.08.2026.** Auf dem gemeinsamen Monitor stand je
-- Gemeinschaft ein QR-Code — das Saalmerkmal führt in EINE Versammlung, und wer
-- den falschen scannt, meldet sich im falschen Haus an. Gemeldet: «Es ist wenig
-- komfortabel, wenn man zwei QR hat und einen davon abschiessen will. Darum ein
-- QR, die öffnet dann eine Hilfsseite, bei dem man dann die richtige STWEG
-- auswählen kann.»
--
-- Der Abend bekommt deshalb ein eigenes Merkmal. Es führt nicht in eine
-- Versammlung, sondern auf eine Auswahl: «In welchem Haus wohnen Sie?» Von dort
-- geht es weiter auf den bekannten Weg — Namen angeben, auf die Freigabe durch
-- die Sitzungsleitung warten. Der Code erzeugt so wenig Stimmberechtigung wie
-- der eines einzelnen Hauses.
ALTER TABLE meeting_day ADD COLUMN room_entry_token text UNIQUE;

COMMENT ON COLUMN meeting_day.room_entry_token IS
	'Merkmal des Abend-QR auf dem gemeinsamen Monitor. Führt auf die Hausauswahl, nie in eine Versammlung.';

-- **Ohne Mandantenkontext, wie der Einstieg einer einzelnen Versammlung.** Wer
-- den Code scannt, ist nicht angemeldet und gehört zu keinem Betreiber; die
-- Auflösung muss deshalb an der RLS vorbei — eng gefasst und nur lesend.
--
-- Eine Zeile je Haus des Abends: Die Auswahlseite braucht die Namen, um sie
-- anzubieten, und den Zustand, um geschlossene Versammlungen gar nicht erst
-- anzuzeigen. **Das Saalmerkmal des Hauses gibt sie NICHT heraus** — die
-- Weiterleitung geschieht auf dem Server, damit nicht ein Abzug des Bildschirms
-- die Merkmale aller Häuser trägt.
CREATE FUNCTION abendeinstieg_aufloesen(merkmal text)
RETURNS TABLE (
	operator_id uuid,
	meeting_day_id uuid,
	label text,
	day_date date,
	start_time time,
	location text,
	meeting_id uuid,
	meeting_state text,
	stweg_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT d.operator_id, d.id, d.label, d.day_date, d.start_time, d.location,
	       m.id, m.state, s.name
	FROM meeting_day d
	JOIN meeting m ON m.meeting_day_id = d.id
	JOIN stweg s   ON s.id = m.stweg_id
	WHERE d.room_entry_token = merkmal
	ORDER BY m.day_position NULLS LAST, s.name
$$;

REVOKE ALL ON FUNCTION abendeinstieg_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abendeinstieg_aufloesen(text) TO versammlung_app;

-- Das Saalmerkmal eines einzelnen Hauses — nur für die Weiterleitung von der
-- Auswahl aus. Getrennt von der Auflösung oben, damit die Liste der Häuser es
-- nicht mitführt: Wer die Auswahlseite ansieht, soll die Merkmale der übrigen
-- Häuser nicht bekommen.
CREATE FUNCTION abendeinstieg_haus(merkmal text, haus uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT m.room_entry_token
	FROM meeting_day d
	JOIN meeting m ON m.meeting_day_id = d.id
	WHERE d.room_entry_token = merkmal AND m.id = haus
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION abendeinstieg_haus(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abendeinstieg_haus(text, uuid) TO versammlung_app;
