-- 055 — Die Lücken in der REVOKE-Disziplin geschlossen (Audit 08.08.2026)
--
-- Migration 002 vergibt der Anwendungsrolle über `ALTER DEFAULT PRIVILEGES`
-- alle vier Rechte an **jeder künftigen Tabelle**. Das ist Absicht: Eine neue
-- Migration kann die Rechtevergabe nicht vergessen. Der Preis ist, dass ein
-- späteres `GRANT SELECT, INSERT` nichts einschränkt — es vergibt nur nochmals,
-- was ohnehin schon da ist. Wegnehmen tut allein ein REVOKE.
--
-- Genau hier sind drei Tabellen durchgerutscht. Fünfzehn andere tragen den
-- Entzug ausdrücklich; diese drei nicht, und es sind die falschen.

-- ── B-03: Siegel und Protokollfassungen (AD-5) ─────────────────────────────
--
-- **Die zweite Schranke, nicht die erste.** Beide Tabellen haben bereits einen
-- Auslöser, der Löschen und Ändern abweist — `seal_nur_zeitstempel` lässt einzig
-- den nachgeholten Zeitstempel durch, `minutes_version_unveraenderlich` weist
-- alles ab. Der Rechteentzug ist die zweite Schranke daneben, aus demselben
-- Grund, den Migration 002 für `audit_entry` nennt: weil eine der beiden durch
-- eine spätere Migration versehentlich fallen könnte, und weil ein Versuch dann
-- gar nicht erst bis zum Auslöser kommt.
--
-- Ein gelöschtes Siegel ist nicht wiederherstellbar und nimmt dem
-- Abschlusspaket seinen einzigen Beweiswert.
REVOKE DELETE ON seal FROM versammlung_app;
REVOKE UPDATE, DELETE ON minutes_version FROM versammlung_app;

-- Das `UPDATE` auf `seal` **bleibt**: `zeitstempel.ts` trägt den nachgeholten
-- RFC-3161-Zeitstempel ein, und der Auslöser lässt genau das und nichts sonst
-- durch. Wer es hier entzöge, machte die Nachholmechanik unmöglich.

-- ── B-08: Fehlversuche der Anmeldung ───────────────────────────────────────
--
-- Die Sperre nach zu vielen Fehlversuchen rechnet auf dieser Tabelle. Dürfte
-- die Anwendung darin löschen, liesse sich die Sperre durch einen Fehler im
-- Anwendungscode aufheben — und die Spur der Versuche mit ihr.
REVOKE DELETE ON login_attempt FROM versammlung_app;

-- ── B-01: Zeilenschutz auf der Wurzel der Mandantentrennung (AD-6) ─────────
--
-- 37 von 40 Tabellen tragen ihn. Ausgerechnet `operator` nicht — die Tabelle,
-- an der die Trennung hängt. Dort trug sie bisher allein der Anwendungscode:
-- Ein vergessenes `WHERE` hätte fremde Betreiber geliefert oder geändert,
-- während überall sonst die leere Menge herauskommt.
--
-- Auf dieser Tabelle liegen die Aufbewahrungsfrist, die Briefkopfvorlage und
-- die beiden KI-Schalter. Jede neue Abfrage darauf ist eine Gelegenheit.
ALTER TABLE operator ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator FORCE  ROW LEVEL SECURITY;
CREATE POLICY operator_mandant ON operator
    USING (id::text = current_setting('versammlung.operator_id', true));

-- **Die privilegierte Rolle ist ein Superuser und umgeht den Zeilenschutz auch
-- bei FORCE.** Das Anlegen eines Betreibers läuft über sie
-- (`scripts/benutzer-anlegen.mjs`, `tests/db/helfer.ts`) und bleibt unberührt.
-- Die Anwendung legt keinen Betreiber an und entfernt keinen — beides ist
-- Aufsetzarbeit.
REVOKE INSERT, DELETE ON operator FROM versammlung_app;

COMMENT ON TABLE operator IS
    'Der Mandant oberster Ebene. Zeilenschutz seit 08.08.2026 (Audit B-01); die Anwendung darf lesen und ändern, nicht anlegen und nicht löschen.';
