-- 071 — Die Anmeldung am eigenen Konto übernimmt das andere Gerät
--
-- **Der Anlass, am 20.08.2026.** Gemeldet nach einem Durchgang mit dem eigenen
-- iPhone: «wenn ich mit dem iOS über Firefox … mich mit Authentik einlogge,
-- kommt die Meldung, dass ich woanders eingeloggt sei und dass das nicht geht.»
-- Der Zugang war von einer früheren Anmeldung desselben Menschen belegt — und
-- die Anwendung hatte dafür nur eine Sackgasse.
--
-- **Was in Migration 068 stand, und warum es hier nicht mehr gilt.** Dort hiess
-- es «Abgewiesen, nicht verdrängt — wie bei der Karte». Genau dieses «wie bei
-- der Karte» war der Fehler im Gedankengang: Der Kartencode ist **Besitz** —
-- wer das Papier hat, kommt herein, und deshalb darf ein zweiter Besitzer den
-- ersten nicht hinauswerfen. Die Anmeldung über Authentik ist dagegen
-- **Identität**: Sie setzt Konto und Kennwort voraus. Wer sie besteht, ist der
-- Berechtigte — und den vor der eigenen Tür stehen zu lassen, schützt niemanden.
--
-- **Der Einwand aus 068 bleibt gültig, wird aber anders beantwortet.** Es kann
-- sein, dass für diese Partei bereits ein anderes Gerät angemeldet ist — etwa
-- eine bevollmächtigte Person, der die Sitzungsleitung einen Code gegeben hat.
-- Dieses Gerät fliegt jetzt heraus. Nur eben nicht **wortlos**:
--
--   * das übernehmende Gerät bekommt den Satz «Ihr anderes Gerät wurde
--     abgemeldet» zu lesen,
--   * das abgemeldete findet beim nächsten Aufruf den Grund `uebernommen` und
--     dazu die Aufforderung, sich bei der Sitzungsleitung zu melden, falls das
--     nicht die eigene Anmeldung war.
--
-- Der Kartenweg (`zugang_einloesen`, Migration 019) bleibt unverändert: Dort
-- gilt weiterhin «erstes Gerät gewinnt».

-- Die Schranke heisst seit Migration 019 `access_session_grund` — der Name der
-- Datenbank («…_revoked_reason_check») ist der, den PostgreSQL vergäbe, wenn man
-- keinen nennt. Beide werden weggenommen: der zweite, weil ein erster Anlauf
-- dieser Migration ihn angelegt hat, und ein Schema mit zwei Schranken auf
-- derselben Spalte ist eine Falle für den Nächsten.
ALTER TABLE access_session DROP CONSTRAINT IF EXISTS access_session_grund;
ALTER TABLE access_session DROP CONSTRAINT IF EXISTS access_session_revoked_reason_check;

ALTER TABLE access_session
	ADD CONSTRAINT access_session_grund
	CHECK (
		(revoked_reason IS NULL)
		OR (revoked_reason = ANY (ARRAY[
			'abgelaufen'::text,
			'abgemeldet'::text,
			'freigegeben'::text,
			'ersetzt'::text,
			'geschlossen'::text,
			-- Neu: Das eigene Konto hat den Zugang auf ein anderes Gerät geholt.
			'uebernommen'::text
		]))
	);

CREATE OR REPLACE FUNCTION authentik_einloesen(
	kennung text,
	neuer_zugang_pruefwert text,
	sitzungs_pruefwert text,
	geraet text,
	gueltig_bis timestamptz
)
RETURNS TABLE (sitzung uuid, ausgang text, versammlung uuid, partei text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	z record;
	treffer int;
	zugang uuid;
	abgeloest int;
	neu uuid;
BEGIN
	IF kennung IS NULL OR btrim(kennung) = '' THEN
		RETURN QUERY SELECT NULL::uuid, 'unbekannt'::text, NULL::uuid, NULL::text;
		RETURN;
	END IF;

	SELECT count(*) INTO treffer
	FROM snapshot_party p
	JOIN meeting m ON m.id = p.meeting_id
	WHERE p.authentik_subject = kennung
	  AND m.state IN ('freigegeben', 'laufend');

	IF treffer = 0 THEN
		RETURN QUERY SELECT NULL::uuid, 'unbekannt'::text, NULL::uuid, NULL::text;
		RETURN;
	END IF;

	-- Mehr als eine offene Versammlung: Die Anwendung fragt, statt zu wählen
	-- (Begründung in Migration 068).
	IF treffer > 1 THEN
		RETURN QUERY SELECT NULL::uuid, 'mehrdeutig'::text, NULL::uuid, NULL::text;
		RETURN;
	END IF;

	SELECT p.id, p.operator_id, p.meeting_id, p.display_name
	INTO z
	FROM snapshot_party p
	JOIN meeting m ON m.id = p.meeting_id
	WHERE p.authentik_subject = kennung
	  AND m.state IN ('freigegeben', 'laufend');

	SELECT id INTO zugang
	FROM meeting_access
	WHERE snapshot_party_id = z.id AND state = 'gueltig'
	LIMIT 1;

	IF zugang IS NULL THEN
		INSERT INTO meeting_access (operator_id, meeting_id, snapshot_party_id, code_hash)
		VALUES (z.operator_id, z.meeting_id, z.id, neuer_zugang_pruefwert)
		RETURNING id INTO zugang;
	END IF;

	UPDATE access_session
	SET revoked_at = now(), revoked_reason = 'abgelaufen'
	WHERE meeting_access_id = zugang AND revoked_at IS NULL AND expires_at <= now();

	-- Was jetzt noch offen ist, gehört einem anderen Gerät. Es wird abgelöst,
	-- und die Zahl der abgelösten Sitzungen entscheidet über den Ausgang: Nur
	-- wenn wirklich eines wich, bekommt die Person den Satz dazu zu lesen.
	UPDATE access_session
	SET revoked_at = now(), revoked_reason = 'uebernommen'
	WHERE meeting_access_id = zugang AND revoked_at IS NULL;
	GET DIAGNOSTICS abgeloest = ROW_COUNT;

	INSERT INTO access_session
		(operator_id, meeting_access_id, token_hash, origin, device_label, expires_at)
	VALUES (z.operator_id, zugang, sitzungs_pruefwert, 'authentik', geraet, gueltig_bis)
	RETURNING id INTO neu;

	UPDATE meeting_access SET last_used_at = now() WHERE id = zugang;

	RETURN QUERY
	SELECT neu,
	       CASE WHEN abgeloest > 0 THEN 'uebernommen' ELSE 'neu' END::text,
	       z.meeting_id,
	       z.display_name;
END;
$$;

REVOKE ALL ON FUNCTION authentik_einloesen(text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authentik_einloesen(text, text, text, text, timestamptz) TO versammlung_app;
