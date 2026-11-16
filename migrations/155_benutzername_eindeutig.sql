-- Benutzernamen über alle Betreiber eindeutig.
--
-- Befunde D4 und D5 aus dem Sicherheitsdurchgang vom 09.10.2026
-- (`docs/befunde-sicherheitsdurchgang-2026-10-09.md`). Produktentscheid
-- 13.10.2026: Ein Benutzername gehört genau einem Konto, über alle Betreiber.
--
-- **D4.** Der Name war nur je Betreiber eindeutig (`001:30`), die Suche
-- `anmeldedaten` läuft aber ohne Betreiber und nahm mit `LIMIT 1` irgendeine
-- Zeile (`003:37-41`). Vom zweiten Konto gleichen Namens war deshalb nur eines
-- anmeldbar. Mit diesem Index liefert die Suche höchstens eine Zeile, und
-- `LIMIT 1` wählt nichts mehr aus.
--
-- **D5.** `login_attempt` zählt Fehlversuche allein nach Namen. Gehört ein
-- Name genau einem Konto, ist das der Zähler dieses einen Kontos; die Sperre
-- über die Betreibergrenze hat keinen Gegenstand mehr. Eine Betreiberspalte
-- dort braucht es deshalb nicht.
--
-- **Eindeutig nach `lower(username)`, nicht exakt.** Die Oberfläche legt Namen
-- ohnehin klein an (`server/benutzer.ts`), das Aufsetzskript
-- `scripts/benutzer-anlegen.mjs` aber übernimmt die Schreibweise des Aufrufs.
-- Exakt eindeutig liesse «Muster» neben «muster» zu: zwei Konten, die am
-- Telefon gleich klingen und beim Tippen nur an der Umschalttaste
-- auseinandergehen. Gezählt am 13.10.2026: null Dubletten auf Dev (42 Konten)
-- und im Betrieb (1 Konto), exakt wie über `lower()`. Die strengere Wahl
-- kostet am Bestand nichts.
-- Die Anmeldung vergleicht weiter exakt; das ändert dieser Schritt nicht.
--
-- **Die Eindeutigkeit je Betreiber bleibt stehen.** Sie ist überflüssig, aber
-- das Aufsetzskript nennt sie als Ziel von `ON CONFLICT`. Ein Ziel über
-- `lower(username)` allein wäre falsch: Das Skript überschriebe dann Kennwort
-- und Rolle eines Kontos bei einem fremden Betreiber.
--
-- **Bestand mit Dubletten bricht mit Namen ab, nicht still.** Der Betrieb wächst
-- bis zum Ausrollen. Gibt es dann doch zwei Konten gleichen Namens, nennt die
-- Meldung sie, damit eines umbenannt werden kann; danach läuft die Migration
-- durch.
DO $$
DECLARE
    doppelte text;
BEGIN
    SELECT string_agg(
               format('«%s» (Konten %s)', gruppe.name, gruppe.kennungen),
               '; ' ORDER BY gruppe.name)
      INTO doppelte
      FROM (
          SELECT lower(username) AS name,
                 string_agg(format('%s bei Betreiber %s', id, operator_id), ', '
                            ORDER BY created_at) AS kennungen
            FROM app_user
           GROUP BY lower(username)
          HAVING count(*) > 1
      ) AS gruppe;

    IF doppelte IS NOT NULL THEN
        RAISE EXCEPTION 'Benutzernamen sind mehrfach vergeben: %', doppelte
            USING HINT = 'Je Name alle Konten bis auf eines umbenennen '
                         '(UPDATE app_user SET username = … WHERE id = …), '
                         'dann die Migration erneut einspielen.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX app_user_benutzername_eindeutig ON app_user (lower(username));
