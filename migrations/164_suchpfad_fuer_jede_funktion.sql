-- Jede eigene Funktion trägt den Suchpfad `public, pg_temp` (Auftrag
-- Abschluss, C1, 16.10.2026).
--
-- **Der Befund.** Ohne festen Suchpfad löst eine Funktion ihre Tabellen über
-- den Suchpfad der aufrufenden Sitzung auf, und dort steht `pg_temp` vor
-- `public`. Die Anwendungsrolle darf temporäre Tabellen anlegen (TEMP für
-- PUBLIC, an Dev und Betrieb gemessen). Gemessen in
-- `tests/db/suchpfad.test.ts`: Eine leere temporäre `meeting_handover` liess
-- `versammlung_abgegeben` «nicht abgegeben» antworten, und eine Änderung an
-- einer abgegebenen Versammlung ging durch. Die Siegelsperre hielt, weil
-- `versammlung_versiegelt` seit Migration 157 gepinnt ist.
--
-- **Warum alle 46 und nicht die eine.** Die übrigen Auslöserfunktionen lesen
-- ebenso ohne Schema (`attachment_bei_abgabe` liest `agenda_item` und `proxy`,
-- `einladungsmehr_nur_vor_beginn` liest `meeting`), und eine Liste nach
-- Ermessen wäre die nächste Lücke. `check-suchpfad` und der Katalogtest
-- verlangen den Pin seither für jede Funktion, nicht nur für SECURITY DEFINER.
--
-- **Nebenwirkung, bewusst hingenommen:** Jeder Aufruf setzt den Suchpfad und
-- danach zurück. Inline geplant wurde keine der sechs SQL-Funktionen schon
-- vorher (alle lesen mit Unterabfrage oder `WITH RECURSIVE`), und keine steckt
-- in einer Regel des Zeilenschutzes, einem Index oder einer Ansicht (am
-- Katalog nachgesehen). Am häufigsten läuft `stweg_archiv_wegen`, je Zeile
-- der Listen.
--
-- Rein ändernd an Eigenschaften, kein Körper und keine Daten. Erzeugt aus
-- `pg_proc` (Funktionen in `public` ohne `proconfig`, ohne die der
-- Erweiterungen) am Stand von Migration 163.

ALTER FUNCTION access_pruefwert_fest() SET search_path = public, pg_temp;
ALTER FUNCTION agenda_anhang_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION agenda_anhang_nach_siegel() SET search_path = public, pg_temp;
ALTER FUNCTION agenda_ausnahme_traegt() SET search_path = public, pg_temp;
ALTER FUNCTION agenda_item_nach_siegel() SET search_path = public, pg_temp;
ALTER FUNCTION agenda_rueckzug_nur_vor_der_abstimmung() SET search_path = public, pg_temp;
ALTER FUNCTION attachment_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION aufbewahrung_laeuft(die_versammlung uuid) SET search_path = public, pg_temp;
ALTER FUNCTION code_attempt_nur_aufwaerts() SET search_path = public, pg_temp;
ALTER FUNCTION durch_anderes_traktandum_ersetzt(traktandum uuid) SET search_path = public, pg_temp;
ALTER FUNCTION durchgang_nicht_ueber_zurueckgezogenes() SET search_path = public, pg_temp;
ALTER FUNCTION eingespieltes_bleibt() SET search_path = public, pg_temp;
ALTER FUNCTION einladungsmehr_nur_vor_beginn() SET search_path = public, pg_temp;
ALTER FUNCTION festschreibung_unveraenderlich() SET search_path = public, pg_temp;
ALTER FUNCTION geheim_unveraenderlich() SET search_path = public, pg_temp;
ALTER FUNCTION instruction_nur_nachfolger() SET search_path = public, pg_temp;
ALTER FUNCTION konsultativ_unveraenderlich() SET search_path = public, pg_temp;
ALTER FUNCTION massgebender_durchgang(traktandum uuid, ausser uuid) SET search_path = public, pg_temp;
ALTER FUNCTION meeting_aufbewahrung() SET search_path = public, pg_temp;
ALTER FUNCTION meeting_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION meeting_chair_holder_geschuetzt() SET search_path = public, pg_temp;
ALTER FUNCTION meeting_pause_geschuetzt() SET search_path = public, pg_temp;
ALTER FUNCTION minutes_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION minutes_version_unveraenderlich() SET search_path = public, pg_temp;
ALTER FUNCTION minutes_version_versandt_nur_versiegelt() SET search_path = public, pg_temp;
ALTER FUNCTION party_mitglied_ringschutz() SET search_path = public, pg_temp;
ALTER FUNCTION proxy_anhang_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION proxy_nur_lebensweg() SET search_path = public, pg_temp;
ALTER FUNCTION proxy_recommendation_nach_siegel() SET search_path = public, pg_temp;
ALTER FUNCTION seal_nur_zeitstempel() SET search_path = public, pg_temp;
ALTER FUNCTION setze_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION stweg_archiv_wegen(s_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION stweg_aufbewahrung() SET search_path = public, pg_temp;
ALTER FUNCTION stweg_ringschutz() SET search_path = public, pg_temp;
ALTER FUNCTION stweg_stammquote_mitfuehren() SET search_path = public, pg_temp;
ALTER FUNCTION unit_braucht_stammquote() SET search_path = public, pg_temp;
ALTER FUNCTION verhindere_aenderung() SET search_path = public, pg_temp;
ALTER FUNCTION verhindere_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION verhindere_nach_siegel() SET search_path = public, pg_temp;
ALTER FUNCTION vermerkt_seit_ruecknahme(versammlung uuid, ereignisart text) SET search_path = public, pg_temp;
ALTER FUNCTION versammlung_abgegeben(kennung uuid) SET search_path = public, pg_temp;
ALTER FUNCTION veto_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION veto_nach_siegel() SET search_path = public, pg_temp;
ALTER FUNCTION vote_bei_abgabe() SET search_path = public, pg_temp;
ALTER FUNCTION vote_nach_siegel() SET search_path = public, pg_temp;
ALTER FUNCTION widerspruch_zulaessig() SET search_path = public, pg_temp;
