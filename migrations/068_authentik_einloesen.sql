-- 068 — Einlösen über das eigene Konto
--
-- Das Gegenstück zu `zugang_einloesen` (Migration 019), nur ohne Code: Wer sich
-- bei Authentik angemeldet hat, bringt eine Kennung mit statt zwanzig Zeichen
-- von einer Karte.
--
-- **Warum wieder `SECURITY DEFINER` ohne Mandantenkontext.** Wer hier ankommt,
-- ist bei Authentik angemeldet, aber in dieser Anwendung noch niemand — es gibt
-- keinen Betreiber, unter dem die Abfrage laufen könnte. Genau wie beim Code.
--
-- **Gesucht wird in der Momentaufnahme, nicht in den Stammdaten.** Die
-- Teilnahme hängt am eingefrorenen Stand (AD-3); `party.authentik_subject` ist
-- der heutige. Wer nach der Freigabe verkauft hat, nimmt trotzdem teil, und wer
-- danach gekauft hat, nicht — das ist keine Härte, sondern die Regel, auf die
-- die Einladung verweist.

CREATE FUNCTION authentik_einloesen(
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
	offene uuid;
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

	/*
	 * **Mehr als eine offene Versammlung: die Anwendung fragt, statt zu wählen.**
	 *
	 * Wer in zwei Gemeinschaften Einheiten hält, kann an zwei Versammlungen
	 * teilnehmen, die gleichzeitig offen sind. Eine davon hier stillschweigend
	 * zu nehmen hiesse, jemanden in den falschen Saal zu setzen — und das fiele
	 * erst auf, wenn seine Stimme in der falschen Abstimmung steht.
	 */
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

	-- Ein Zugang muss nicht existieren: Über Authentik kommt jemand herein, für
	-- den nie eine Karte gedruckt wurde. Dann entsteht er hier — sein Kartencode
	-- wird nie ausgegeben, wie beim Code der Sitzungsleitung (Migration 017).
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

	SELECT id INTO offene
	FROM access_session
	WHERE meeting_access_id = zugang AND revoked_at IS NULL
	LIMIT 1;

	/*
	 * **Abgewiesen, nicht verdrängt — wie bei der Karte.**
	 *
	 * Es wäre verlockend, die Anmeldung am eigenen Konto stärker zu werten als
	 * einen Code auf Papier und das andere Gerät ablösen zu lassen. Dagegen
	 * sprechen zwei Fälle aus dem Saal: Eine bevollmächtigte Person kann für
	 * diese Partei bereits angemeldet sein, und der Eigentümer selbst kann auf
	 * einem zweiten Gerät stehen. In beiden Fällen flöge jemand wortlos aus
	 * seiner Sitzung, und niemand bemerkte es — dieselbe Überlegung wie in
	 * `geraetesitzung.ts`. Wer zu Recht nicht hereinkommt, wendet sich an die
	 * Sitzungsleitung; die kann den Zugang freigeben und steht ohnehin daneben.
	 */
	IF offene IS NOT NULL THEN
		RETURN QUERY SELECT NULL::uuid, 'belegt'::text, z.meeting_id, z.display_name;
		RETURN;
	END IF;

	INSERT INTO access_session
		(operator_id, meeting_access_id, token_hash, origin, device_label, expires_at)
	VALUES (z.operator_id, zugang, sitzungs_pruefwert, 'authentik', geraet, gueltig_bis)
	RETURNING id INTO neu;

	UPDATE meeting_access SET last_used_at = now() WHERE id = zugang;

	RETURN QUERY SELECT neu, 'neu'::text, z.meeting_id, z.display_name;
END;
$$;

REVOKE ALL ON FUNCTION authentik_einloesen(text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authentik_einloesen(text, text, text, text, timestamptz) TO versammlung_app;
