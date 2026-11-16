-- Die E-Mail als Anker der Erstverknüpfung mit Authentik (Vorgabe des Auftraggebers, 15.09.2026).
--
-- **Was vorher galt.** Verknüpft wurde beim ersten Anmelden über den
-- Benutzernamen: Wer in Authentik `anna.meier` heisst, fand das hiesige Konto
-- `anna.meier`. Das verlangt, dass beide Seiten denselben Namen führen, und
-- genau daran scheiterte es in der Praxis — Authentik führt `SB-anna.meier`,
-- hier stand `anna`, und die erste Anmeldung endete mit einer Abweisung,
-- obwohl in Authentik alles stimmte.
--
-- **Warum die E-Mail ein Fenster braucht.** Sie ist der bequemere Anker, aber
-- anders als der Benutzername darf sie in dieser Installation jeder
-- Angemeldete selbst ändern (`default_user_change_email=True` am Tenant,
-- `default_user_change_username=False`). Ohne weitere Schranke genügte das:
-- Ein Eigentümer mit Authentik-Konto setzt seine Adresse auf die einer
-- Verwaltung, deren hiesiges Konto noch keine Kennung trägt, meldet sich an
-- und hat dieses Konto samt seiner Rolle.
--
-- Deshalb steht die Erstverknüpfung nicht dauerhaft offen, sondern in einem
-- Zeitfenster, das die Verwaltung setzt: beim Anlegen von selbst, später auf
-- Knopfdruck. Wer das Fenster verpasst, bekommt es neu geöffnet; wer es
-- treffen will, ohne es zu kennen, hat kein stehendes Ziel mehr.
--
-- **Die Kennung bleibt, was zählt.** Das Fenster gilt einmal. Sobald
-- `oidc_subject` steht, ist die E-Mail nur noch eine Angabe wie der Name, und
-- eine Änderung in Authentik führt niemanden mehr irgendwohin.

ALTER TABLE app_user ADD COLUMN email text;

-- Zwei Konten mit derselben Adresse wären beim Anmelden nicht unterscheidbar,
-- und die Erstverknüpfung träfe eines von beiden — welches, entschiede die
-- Reihenfolge in der Tabelle. Gross- und Kleinschreibung zählt dabei nicht:
-- Wer `Anna.Meier@…` einträgt und sich mit `anna.meier@…` anmeldet, ist
-- derselbe Mensch, und zwei Zeilen, die sich nur darin unterscheiden, wären
-- genau die Falle, die dieser Index verhindern soll.
CREATE UNIQUE INDEX app_user_email_eindeutig
    ON app_user (operator_id, lower(email))
    WHERE email IS NOT NULL;

COMMENT ON COLUMN app_user.email IS
    'Dienstliche Adresse. Anker der einmaligen Erstverknüpfung mit Authentik, danach nur noch Angabe.';

ALTER TABLE app_user ADD COLUMN oidc_link_until timestamptz;

COMMENT ON COLUMN app_user.oidc_link_until IS
    'Bis wann die Erstverknüpfung über die E-Mail offensteht. NULL heisst zu — entweder nie geöffnet oder bereits verknüpft.';

-- Bestandskonten bekommen kein Fenster.
--
-- **Absicht, nicht Vergesslichkeit.** Ein Fenster, das eine Migration öffnet,
-- öffnet es für alle auf einmal und ohne dass jemand es wollte. Wer ein
-- bestehendes Konto mit Authentik verbinden will, trägt die Adresse ein und
-- öffnet das Fenster von Hand; beides steht in der Benutzerverwaltung. Bis
-- dahin ändert sich für diese Konten nichts: Die lokale Anmeldung trägt sie
-- weiter.
