-- Eine Gerätesitzung je Zugang, mit benanntem Ende.
--
-- **Die Regel.** Zu einem Zugang ist höchstens ein Gerät angemeldet. Ein
-- zweiter Versuch mit dem Kartencode wird abgewiesen und verdrängt das erste
-- Gerät **nicht**. Beendet wird eine Sitzung nur durch die Person selbst oder
-- durch die Sitzungsleitung.
--
-- **Warum nicht «das letzte Gerät gewinnt».** Der Code steht im Klartext auf
-- der Karte; wer sie abfotografiert, hat ihn. Gegen einen entwendeten Code
-- schützt keine Sitzungsregel — wohl aber gegen das *stille* Übernehmen.
-- Verdrängte das zweite Gerät das erste, flöge der Eigentümer wortlos aus
-- seiner Sitzung und merkte es erst, wenn seine Stimme nicht mehr zählt. Wird
-- der zweite Versuch abgewiesen, scheitert er sichtbar.
--
-- Die beiden Fehlerfälle wiegen ungleich schwer, und danach ist entschieden:
-- «Erstes Gerät gewinnt» kostet schlimmstenfalls eine Handbewegung der
-- Sitzungsleitung. «Letztes Gerät gewinnt» kostet schlimmstenfalls eine
-- Stimme, und niemand bemerkt es.
--
-- **Die Ausnahme** ist der von der Sitzungsleitung ausgegebene Code: Ihn hat
-- ein Mensch einer Person gegeben, die vor ihm stand. Dieselbe Vertrauensstufe
-- wie das Erfassen der Anwesenheit von Hand — er darf ein Gerät ablösen, und
-- das abgelöste erfährt beim nächsten Aufruf, warum.

-- ── Warum eine Sitzung endete ───────────────────────────────────────────────
--
-- Ohne den Grund liesse sich später nicht auseinanderhalten, ob jemand von
-- selbst ging, ausgesperrt wurde oder nur die Zeit ablief. Genau das ist im
-- Streitfall die Frage.
ALTER TABLE access_session ADD COLUMN revoked_reason text;

-- Grobe Bezeichnung des Geräts, nie die Browserkennung selbst: Die wäre ein
-- Wiedererkennungsmerkmal, und dafür gibt es hier keinen Grund. «iPhone ·
-- Safari, seit 19:12» genügt der Sitzungsleitung im Saal zur Klärung, wenn
-- jemand sagt, er komme nicht herein.
ALTER TABLE access_session ADD COLUMN device_label text;

-- Bestehende Sitzungen stammen aus der Zeit vor dieser Regel und können zu
-- zweit an einem Zugang hängen. Sie zu beenden ist der einzige Weg zur
-- Eindeutigkeit; es kostet eine erneute Anmeldung.
UPDATE access_session
SET revoked_at = coalesce(revoked_at, now()), revoked_reason = 'abgelaufen'
WHERE revoked_reason IS NULL;

ALTER TABLE access_session
	ADD CONSTRAINT access_session_grund
		CHECK (revoked_reason IS NULL OR revoked_reason IN
			('abgelaufen', 'abgemeldet', 'freigegeben', 'ersetzt', 'geschlossen')),
	-- Ein Ende ohne Grund oder ein Grund ohne Ende wäre eine halbe Angabe.
	ADD CONSTRAINT access_session_ende_mit_grund
		CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),
	ADD CONSTRAINT access_session_geraet
		CHECK (device_label IS NULL OR length(device_label) <= 40);

-- Die Regel selbst, als Bedingung der Datenbank und nicht bloss als Absicht im
-- Anwendungscode: Zwei gleichzeitige Sitzungen kann es nicht geben, auch nicht
-- bei zwei Anmeldungen im selben Augenblick.
CREATE UNIQUE INDEX access_session_eine_offene
	ON access_session (meeting_access_id) WHERE revoked_at IS NULL;

-- ── Auflösen, jetzt mit Grund ───────────────────────────────────────────────
--
-- Die Rückgabe wächst um den Grund; deshalb neu angelegt statt ersetzt —
-- PostgreSQL lässt den Rückgabetyp einer Funktion nicht ändern.
DROP FUNCTION zugangssitzung_aufloesen(text);

CREATE FUNCTION zugangssitzung_aufloesen(pruefwert text)
RETURNS TABLE (
	operator_id uuid,
	meeting_id uuid,
	snapshot_party_id uuid,
	party_id uuid,
	access_state text,
	meeting_state text,
	session_expired boolean,
	session_reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT s.operator_id, a.meeting_id, a.snapshot_party_id, p.party_id, a.state, m.state,
	       (s.expires_at <= now() OR s.revoked_at IS NOT NULL),
	       -- Der eingetragene Grund geht vor: Wurde eine Sitzung abgelöst und
	       -- läuft ihre Frist danach ab, bleibt «ersetzt» die Auskunft, auf die
	       -- es ankommt.
	       coalesce(s.revoked_reason, CASE WHEN s.expires_at <= now() THEN 'abgelaufen' END)
	FROM access_session s
	JOIN meeting_access a ON a.id = s.meeting_access_id
	JOIN snapshot_party p ON p.id = a.snapshot_party_id
	JOIN meeting m ON m.id = a.meeting_id
	WHERE s.token_hash = pruefwert
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION zugangssitzung_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugangssitzung_aufloesen(text) TO versammlung_app;

-- ── Einlösen, jetzt mit drei Ausgängen ──────────────────────────────────────
DROP FUNCTION zugang_einloesen(text, text, text, timestamptz);

/*
 * Löst einen Code ein.
 *
 * Drei Ausgänge, weil zwei zu wenig sind:
 *
 *   «neu»       — Sitzung angelegt.
 *   «belegt»    — Der Code stimmt, aber es ist bereits ein Gerät angemeldet.
 *   «unbekannt» — Kein Zugang dazu, aus welchem Grund auch immer.
 *
 * Dass «belegt» einen richtigen Code bestätigt, ist Absicht. Wer ihn eintippt,
 * hat ihn abgelesen — durch Raten stösst bei 97 Bit niemand darauf. Der
 * Eigentümer dagegen, dessen Telefon leer war, bekäme sonst «Code ungültig» zu
 * lesen und hielte seine Karte für kaputt.
 */
CREATE FUNCTION zugang_einloesen(
	karten_pruefwert text,
	ausgabe_pruefwert text,
	sitzungs_pruefwert text,
	geraet text,
	gueltig_bis timestamptz
)
RETURNS TABLE (sitzung uuid, ausgang text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	z record;
	herkunft text;
	offene uuid;
	neu uuid;
BEGIN
	SELECT a.id, a.operator_id, m.state AS versammlung
	INTO z
	FROM meeting_access a
	JOIN meeting m ON m.id = a.meeting_id
	WHERE a.state = 'gueltig'
	  AND (
		(karten_pruefwert IS NOT NULL AND a.code_hash = karten_pruefwert)
		OR (ausgabe_pruefwert IS NOT NULL AND a.handout_hash = ausgabe_pruefwert
		    AND a.handout_expires_at > now())
	  )
	LIMIT 1;

	IF NOT FOUND OR z.versammlung NOT IN ('freigegeben', 'laufend') THEN
		RETURN QUERY SELECT NULL::uuid, 'unbekannt'::text;
		RETURN;
	END IF;

	herkunft := CASE WHEN karten_pruefwert IS NOT NULL THEN 'karte' ELSE 'ausgabe' END;

	-- Abgelaufene Sitzungen zuerst schliessen. Sonst blockierte ein Gerät, das
	-- seit gestern niemand mehr anfasst, den Zugang seines Eigentümers.
	UPDATE access_session
	SET revoked_at = now(), revoked_reason = 'abgelaufen'
	WHERE meeting_access_id = z.id AND revoked_at IS NULL AND expires_at <= now();

	SELECT id INTO offene FROM access_session
	WHERE meeting_access_id = z.id AND revoked_at IS NULL
	LIMIT 1;

	IF offene IS NOT NULL THEN
		IF herkunft = 'karte' THEN
			-- Abgewiesen, nicht verdrängt.
			RETURN QUERY SELECT NULL::uuid, 'belegt'::text;
			RETURN;
		END IF;
		-- Der ausgegebene Code darf ablösen: Ihn hat die Sitzungsleitung
		-- persönlich herausgegeben.
		UPDATE access_session
		SET revoked_at = now(), revoked_reason = 'ersetzt'
		WHERE id = offene;
	END IF;

	INSERT INTO access_session
		(operator_id, meeting_access_id, token_hash, origin, device_label, expires_at)
	VALUES (z.operator_id, z.id, sitzungs_pruefwert, herkunft, geraet, gueltig_bis)
	RETURNING id INTO neu;

	UPDATE meeting_access SET last_used_at = now() WHERE id = z.id;

	-- Der ausgegebene Code ist verbraucht. Der Kartencode bleibt stehen.
	IF herkunft = 'ausgabe' THEN
		UPDATE meeting_access
		SET handout_hash = NULL, handout_expires_at = NULL
		WHERE id = z.id;
	END IF;

	RETURN QUERY SELECT neu, 'neu'::text;
END;
$$;

REVOKE ALL ON FUNCTION zugang_einloesen(text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugang_einloesen(text, text, text, text, timestamptz) TO versammlung_app;

-- ── Sich selbst abmelden ────────────────────────────────────────────────────
--
-- Erst mit der Ein-Gerät-Regel bekommt das Abmelden Gewicht: Vorher räumte es
-- nur den Keks weg, jetzt gibt es den Zugang für das nächste Gerät frei. Wer
-- sich nicht abmeldet, sondern bloss den Browser schliesst, kommt an sein
-- eigenes Gerät nicht mehr heran und braucht die Sitzungsleitung — auch das
-- ist Absicht, denn genau dieser Weg ist der überprüfte.
--
-- Läuft ohne Mandantenkontext, wie alles auf diesem Pfad: Wer ein Gerät
-- benutzt, ist nicht angemeldet.
CREATE FUNCTION zugangssitzung_beenden(pruefwert text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	WITH beendet AS (
		UPDATE access_session
		SET revoked_at = now(), revoked_reason = 'abgemeldet'
		WHERE token_hash = pruefwert AND revoked_at IS NULL
		RETURNING id
	)
	SELECT EXISTS (SELECT 1 FROM beendet)
$$;

REVOKE ALL ON FUNCTION zugangssitzung_beenden(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugangssitzung_beenden(text) TO versammlung_app;
