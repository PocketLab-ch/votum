-- Die Anmeldung über Authentik findet ihr Konto (Befund vom 15.09.2026).
--
-- **Der Befund.** `findeBenutzer` las `app_user` unmittelbar. Diese Tabelle
-- steht seit Migration 001 unter `FORCE ROW LEVEL SECURITY` mit einer Regel auf
-- `versammlung.operator_id` — und beim Anmelden ist der Betreiber noch
-- unbekannt, er steht ja erst in der Zeile, die gesucht wird. Die Abfrage lief
-- fehlerfrei und lieferte **nichts**. Der Anmeldeweg über Authentik konnte
-- deshalb nie jemanden finden.
--
-- **Warum das so lange niemand sah.** Ein fehlender Treffer sieht genauso aus
-- wie «dieses Konto gibt es nicht»: dieselbe Abweisung, keine Fehlermeldung,
-- kein Eintrag. Und gemessen am 15.09.2026 trug kein einziges der 16 Konten
-- eine Kennung — was wie ein ungenutzter Weg aussah und in Wahrheit ein
-- verschlossener war.
--
-- **Der Ausweg ist derselbe wie 2026 bei der lokalen Anmeldung** (Migration
-- 003): eng umrissene Funktionen mit `SECURITY DEFINER`. Sie nehmen genau ein
-- Merkmal entgegen und geben genau die Felder zurück, die die Entscheidung
-- braucht. Kein Freitextfilter, keine Liste, keine Suche.
--
-- **Geschrieben wird hier nichts.** Beide Funktionen sind `STABLE`. Sobald die
-- Betreiberkennung bekannt ist, setzt die Anwendung sie und schreibt unter der
-- gewöhnlichen Regel weiter — die Verknüpfung und ihr Verlaufseintrag liegen so
-- in einer Transaktion, und der Zeilenschutz bleibt für den Schreibweg in Kraft.

-- **Erst weg, dann neu.** `CREATE OR REPLACE` kann den Rückgabetyp einer
-- bestehenden Funktion nicht ändern; wo eine ältere Fassung liegt, bricht die
-- Migration sonst mit «cannot change return type of existing function». Auf
-- einer frischen Datenbank ist das `IF EXISTS` ohne Wirkung.
DROP FUNCTION IF EXISTS authentik_konto_zu_kennung(text);
DROP FUNCTION IF EXISTS authentik_konto_zu_adresse(text);

-- Das Konto zu einer Authentik-Kennung.
--
-- **Der Dienststand wird mitgegeben, nicht weggefiltert** (aus dem Code-Review
-- vom 15.09.2026). Die erste Fassung schloss Konten ausser Dienst hier aus. Das
-- klang richtig und war eine Falle: Wer ausser Dienst steht, wurde nicht
-- gefunden, die Anmeldung fiel auf den Adressweg zurück, und der verknüpfte die
-- Kennung mit einem **zweiten** Konto. Da `app_user_oidc_subject_idx` über alle
-- Betreiber eindeutig ist, endete das in einer Schlüsselverletzung — sichtbar
-- für den Benutzer als «Authentik ist nicht erreichbar».
--
-- Die Kennung ist eindeutig: Wer sie trägt, ist gefunden. Ob er herein darf,
-- entscheidet die Anwendung danach.
CREATE OR REPLACE FUNCTION authentik_konto_zu_kennung(p_subject text)
RETURNS TABLE (
    id            uuid,
    operator_id   uuid,
    username      text,
    display_name  text,
    role          text,
    email         text,
    disabled_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT u.id, u.operator_id, u.username, u.display_name, u.role, u.email,
           u.disabled_at
    FROM app_user u
    WHERE u.oidc_subject = p_subject
    LIMIT 1;
$$;

-- Das Konto zu einer Adresse — nur, solange es noch keine Kennung trägt.
--
-- **Die Einschränkung ist die halbe Sicherheit dieser Funktion.** Ein bereits
-- verknüpftes Konto kommt hier nicht zum Vorschein, egal wer fragt. Damit lässt
-- sich über den Anmeldeweg auch nicht erkunden, welche Adresse zu welchem
-- bestehenden Zugang gehört.
--
-- Der Dienststand und das Fenster kommen ungefiltert mit: Darüber entscheidet
-- die Anwendung, und sie soll den Grund benennen können, statt nur ein leeres
-- Ergebnis zu sehen. Nach aussen sieht jeder Fehlschlag trotzdem gleich aus.
CREATE OR REPLACE FUNCTION authentik_konto_zu_adresse(p_email text)
RETURNS TABLE (
    id              uuid,
    operator_id     uuid,
    username        text,
    display_name    text,
    role            text,
    email           text,
    disabled_at     timestamptz,
    oidc_link_until timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT u.id, u.operator_id, u.username, u.display_name, u.role, u.email,
           u.disabled_at, u.oidc_link_until
    FROM app_user u
    WHERE lower(u.email) = lower(btrim(p_email))
      AND u.oidc_subject IS NULL
    -- **Zwei, nicht eine** (aus dem Code-Review vom 15.09.2026). Die Adresse ist
    -- nur **je Betreiber** eindeutig (`app_user_email_eindeutig`), diese Suche
    -- läuft aber ohne Betreiber. Mit `LIMIT 1` entschiede bei zwei Betreibern
    -- mit derselben Adresse die Reihenfolge in der Tabelle, in welchen Mandanten
    -- die Person gerät — und ihre Kennung klebte danach dort fest.
    --
    -- Zwei Zeilen genügen, um «mehrdeutig» zu erkennen, und bleiben weit von
    -- einer Liste entfernt. Die Anwendung weist dann ab, statt zu wählen; das
    -- ist dieselbe Antwort wie beim Eigentümerzugang (Migration 068).
    LIMIT 2;
$$;

-- Nur die Anwendung darf sie aufrufen, und sonst niemand.
REVOKE ALL ON FUNCTION authentik_konto_zu_kennung(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION authentik_konto_zu_adresse(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authentik_konto_zu_kennung(text) TO versammlung_app;
GRANT EXECUTE ON FUNCTION authentik_konto_zu_adresse(text) TO versammlung_app;
