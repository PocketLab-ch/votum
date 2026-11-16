-- Zugangssitzung je Gerät und Ausgabecode für den Ausnahmefall.
--
-- **Was der Anlass war.** Der Einstieg über den QR auf der Leinwand bestätigte
-- die Anwesenheit, liess das Gerät der Person aber ohne jeden Nachweis zurück —
-- in der geführten Betriebsart konnte sie damit nicht abstimmen. Das wäre erst
-- im Saal aufgefallen.
--
-- **Warum es jetzt eine Sitzung braucht.** Bisher trug der Keks den Kartencode
-- selbst. Das genügte, solange es nur einen Weg gab. Ein von der Sitzungsleitung
-- ausgegebener Code lässt sich so aber nicht einlösen: Der Server kennt den
-- Kartencode nicht im Klartext (NFR-5) und könnte ihn nicht in den Keks legen.
-- Beide Wege münden deshalb in dasselbe: eine Gerätesitzung mit eigenem
-- Merkmal, gespeichert als Prüfwert.
--
-- Nebenwirkung mit eigenem Wert: Eine Sitzung ist je Gerät widerrufbar. Wer
-- einen Code im Saal vorgelesen bekommen hat, lässt sich einzeln aussperren,
-- ohne dass die Karte der Person unbrauchbar wird.

-- Ziel des zusammengesetzten Fremdschlüssels. Muss vor der Tabelle stehen, die
-- darauf verweist: PostgreSQL prüft beim CREATE TABLE, ob es die Eindeutigkeit
-- schon gibt.
ALTER TABLE meeting_access ADD CONSTRAINT meeting_access_id_operator UNIQUE (id, operator_id);

CREATE TABLE access_session (
	id          uuid PRIMARY KEY DEFAULT uuidv7(),
	operator_id uuid NOT NULL REFERENCES operator (id),
	meeting_access_id uuid NOT NULL,

	-- SHA-256 des Merkmals. Wie beim Kartencode gilt: Ein Datenbankauszug gibt
	-- keine gültige Sitzung preis.
	token_hash text NOT NULL,

	-- Woher die Sitzung stammt. Steht im Verlauf und erklärt später, warum
	-- jemand ohne Karte teilnehmen konnte.
	origin text NOT NULL,

	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	revoked_at timestamptz,

	FOREIGN KEY (meeting_access_id, operator_id)
		REFERENCES meeting_access (id, operator_id) ON DELETE CASCADE,

	CONSTRAINT access_session_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT access_session_herkunft CHECK (origin IN ('karte', 'ausgabe'))
);

CREATE UNIQUE INDEX access_session_hash_eindeutig ON access_session (token_hash);
CREATE INDEX access_session_zugang_idx ON access_session (meeting_access_id);

ALTER TABLE access_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_session FORCE ROW LEVEL SECURITY;

CREATE POLICY access_session_mandant ON access_session
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- ── Der ausgegebene Code ────────────────────────────────────────────────────
--
-- Am Zugang selbst und nicht in einer eigenen Tabelle: Es gibt je Zugang
-- höchstens einen offenen, und beim Einlösen verfällt er. Eine eigene Tabelle
-- brächte Zeilen, die niemand mehr aufräumt.
ALTER TABLE meeting_access
	ADD COLUMN handout_hash text,
	ADD COLUMN handout_expires_at timestamptz,
	ADD COLUMN handout_issued_by uuid REFERENCES app_user (id);

ALTER TABLE meeting_access
	ADD CONSTRAINT access_ausgabe_hash
		CHECK (handout_hash IS NULL OR handout_hash ~ '^[0-9a-f]{64}$'),
	-- Ein Code ohne Verfall wäre ein Dauerzugang mit acht Zeichen. Genau das
	-- soll er nicht sein.
	ADD CONSTRAINT access_ausgabe_verfall
		CHECK (handout_hash IS NULL OR handout_expires_at IS NOT NULL);

CREATE UNIQUE INDEX access_ausgabe_eindeutig
	ON meeting_access (handout_hash) WHERE handout_hash IS NOT NULL;

-- ── Auflösung ohne Mandantenkontext ─────────────────────────────────────────
--
-- Wie beim Kartencode (Migration 016): Wer ein Gerät benutzt, ist nicht
-- angemeldet, und der Zeilenschutz liesse jede Abfrage leer ausgehen.

CREATE FUNCTION zugangssitzung_aufloesen(pruefwert text)
RETURNS TABLE (
	operator_id uuid,
	meeting_id uuid,
	snapshot_party_id uuid,
	party_id uuid,
	access_state text,
	meeting_state text,
	session_expired boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
	SELECT s.operator_id, a.meeting_id, a.snapshot_party_id, p.party_id, a.state, m.state,
	       (s.expires_at <= now() OR s.revoked_at IS NOT NULL)
	FROM access_session s
	JOIN meeting_access a ON a.id = s.meeting_access_id
	JOIN snapshot_party p ON p.id = a.snapshot_party_id
	JOIN meeting m ON m.id = a.meeting_id
	WHERE s.token_hash = pruefwert
	LIMIT 1
$$;

REVOKE ALL ON FUNCTION zugangssitzung_aufloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugangssitzung_aufloesen(text) TO versammlung_app;

/*
 * Löst einen Code ein und legt die Gerätesitzung an.
 *
 * Nimmt beide Arten entgegen — den Kartencode und den ausgegebenen. Der
 * ausgegebene wird dabei **verbraucht**: Er verschwindet aus der Zeile, sodass
 * ein zweites Gerät ihn nicht noch einmal einlösen kann. Der Kartencode bleibt,
 * denn er gehört auf die Karte und darf mehrfach benutzt werden.
 *
 * Gibt NULL zurück, wenn nichts passt — unbekannt, abgelaufen, entwertet oder
 * die Versammlung lässt keinen Zutritt zu. Von aussen soll sich nicht
 * feststellen lassen, welcher der Gründe zutrifft.
 */
CREATE FUNCTION zugang_einloesen(
	karten_pruefwert text,
	ausgabe_pruefwert text,
	sitzungs_pruefwert text,
	gueltig_bis timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
	z record;
	herkunft text;
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
		RETURN NULL;
	END IF;

	herkunft := CASE WHEN karten_pruefwert IS NOT NULL THEN 'karte' ELSE 'ausgabe' END;

	INSERT INTO access_session (operator_id, meeting_access_id, token_hash, origin, expires_at)
	VALUES (z.operator_id, z.id, sitzungs_pruefwert, herkunft, gueltig_bis)
	RETURNING id INTO neu;

	UPDATE meeting_access SET last_used_at = now() WHERE id = z.id;

	-- Der ausgegebene Code ist verbraucht. Der Kartencode bleibt stehen.
	IF herkunft = 'ausgabe' THEN
		UPDATE meeting_access
		SET handout_hash = NULL, handout_expires_at = NULL
		WHERE id = z.id;
	END IF;

	RETURN neu;
END;
$$;

REVOKE ALL ON FUNCTION zugang_einloesen(text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zugang_einloesen(text, text, text, timestamptz) TO versammlung_app;

-- Sitzungen werden nicht gelöscht, sondern widerrufen — sonst liesse sich
-- später nicht unterscheiden, ob ein Gerät nie da war oder ausgesperrt wurde.
REVOKE DELETE ON access_session FROM versammlung_app;
