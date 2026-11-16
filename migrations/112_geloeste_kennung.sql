-- Eine gelöste Kennung kehrt nur zu ihrem eigenen Konto zurück.
--
-- **Der Befund** (Sicherheitsprüfung 16.09.2026, beim Bau des Lösens). Solange
-- eine Kennung gesetzt war, war sie eine Einbahnstrasse: `findeBenutzer` sucht
-- zuerst über `authentik_konto_zu_kennung` und kehrt bei einem Treffer sofort
-- zurück. Wer verknüpft war, landete bei jeder Anmeldung zwingend im **eigenen**
-- Konto — der Weg über die Adresse war für ihn unerreichbar, ganz gleich welche
-- Adresse Authentik meldete.
--
-- Das war eine tragende Schranke, und sie war niemandem als solche bewusst. Mit
-- dem Lösen (Vorgabe des Auftraggebers, 16.09.2026) wird sie zu einem Knopf, den der
-- Betroffene selbst drückt:
--
--   1. Eine Sitzungsleitung löst auf «Mein Konto» ihre eigene Verknüpfung.
--   2. Die Verwaltung legt ein Verwaltungskonto an; dessen Anmeldefenster geht
--      dabei von selbst auf.
--   3. Die Sitzungsleitung setzt in Authentik ihre Adresse auf die des neuen
--      Kontos — in dieser Installation darf das jeder selbst.
--   4. Anmelden. Der Adressweg findet das neue Konto, und sie ist Verwaltung.
--
-- **Die Antwort ist nicht, das Lösen zu verbieten**, sondern der Kennung ihre
-- Geschichte mitzugeben. Wer eine Kennung gelöst hat, darf sie zurückholen —
-- an dasselbe Konto. An ein **anderes** Konto kommt sie über den Adressweg
-- nicht mehr; dafür braucht es die Verwaltung, die das Fenster öffnet, und
-- selbst dann greift die Prüfung.
--
-- **Warum eine Spalte und keine eigene Tabelle.** Die Frage lautet «gehörte
-- diese Kennung schon einmal zu einem anderen Konto?», und die Antwort steht am
-- Konto. Eine Nebentabelle wäre ein zweiter Ort für dieselbe Auskunft, mit
-- eigenem Aufräumbedarf.

ALTER TABLE app_user ADD COLUMN oidc_subject_zuletzt text;

COMMENT ON COLUMN app_user.oidc_subject_zuletzt IS
    'Die zuletzt gelöste Authentik-Kennung dieses Kontos. Sperrt sie für den Adressweg anderer Konten.';

-- Kein eindeutiger Index: Dieselbe Kennung kann nacheinander an mehreren Konten
-- gehangen haben, etwa wenn jemand die Stelle wechselt und ein neues Konto
-- bekommt. Gesucht wird nur, ob es **ein anderes** Konto mit dieser Spur gibt.
CREATE INDEX app_user_oidc_zuletzt_idx
    ON app_user (oidc_subject_zuletzt)
    WHERE oidc_subject_zuletzt IS NOT NULL;

-- Der Adressweg bekommt die Spur mit.
--
-- **Warum hier und nicht in einer zweiten Abfrage.** Die Funktion ist der einzige
-- Weg, auf dem die Anwendung ohne Betreiberkontext in `app_user` sehen darf
-- (Migration 111). Eine Prüfung daneben bräuchte eine zweite solche Funktion,
-- und jede davon ist eine Stelle, an der der Zeilenschutz umgangen wird.
DROP FUNCTION IF EXISTS authentik_konto_zu_adresse(text);

CREATE OR REPLACE FUNCTION authentik_konto_zu_adresse(p_email text, p_subject text DEFAULT NULL)
RETURNS TABLE (
    id                uuid,
    operator_id       uuid,
    username          text,
    display_name      text,
    role              text,
    email             text,
    disabled_at       timestamptz,
    oidc_link_until   timestamptz,
    /* Trägt ein **anderes** Konto diese Kennung als gelöste Spur? */
    kennung_anderswo  boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT u.id, u.operator_id, u.username, u.display_name, u.role, u.email,
           u.disabled_at, u.oidc_link_until,
           EXISTS (
               SELECT 1 FROM app_user v
               WHERE p_subject IS NOT NULL
                 AND v.oidc_subject_zuletzt = p_subject
                 AND v.id <> u.id
           ) AS kennung_anderswo
    FROM app_user u
    WHERE lower(u.email) = lower(btrim(p_email))
      AND u.oidc_subject IS NULL
    LIMIT 2;
$$;

REVOKE ALL ON FUNCTION authentik_konto_zu_adresse(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authentik_konto_zu_adresse(text, text) TO versammlung_app;
