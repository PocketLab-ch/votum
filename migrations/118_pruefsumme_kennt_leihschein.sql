-- 118 — Die Prüfsummenfrage kennt auch den Leihschein
--
-- **Der Anlass** (18.09.2026, aus dem Code-Review zu Block E1). Migration 117
-- legt `meeting_handover` an; darin steht die Prüfsumme des
-- Vorbereitungspakets, und das Paket liegt wie jede andere Datei in der
-- inhaltsadressierten Ablage. `pruefsumme_verwendet` aus Migration 113
-- beantwortet die Frage «darf diese Datei weg?» und zählte fünf Orte auf, an
-- denen eine Prüfsumme vorkommen kann. Der sechste fehlte.
--
-- **Was ohne diese Zeile passieren kann**, in der Reihenfolge der Gefahr:
--
--   1. Eine Versammlung wird nach Fristablauf gelöscht. Ihr Leihschein geht über
--      `ON DELETE CASCADE` mit, die Datei bliebe liegen — für immer, weil sie
--      danach niemand mehr findet. Das behebt die Anwendung, indem sie die
--      Prüfsumme vor dem Löschen einsammelt (`src/lib/server/aufbewahrung.ts`).
--   2. Und genau deshalb braucht es diese Funktion hier: Sobald die Anwendung
--      die Prüfsumme einsammelt, wird sie auch gefragt. Wüsste die Funktion
--      nichts vom Leihschein, könnte sie eine Datei freigeben, auf die noch ein
--      Leihschein zeigt. Heute ist das nicht erreichbar, weil das Löschen den
--      Leihschein vorher mitnimmt; ein Weg, der nur zufällig zu ist, ist aber
--      keiner.
--
-- **Als `CREATE OR REPLACE`, nicht als Änderung an 113.** Die 113 ist gelaufen
-- und damit eingefroren (AD-14); ihre Fassung der Funktion bleibt in der
-- Geschichte stehen, diese hier gilt ab jetzt.

CREATE OR REPLACE FUNCTION pruefsumme_verwendet(die_pruefsumme text) RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (SELECT 1 FROM attachment WHERE checksum = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM seal WHERE package_hash = die_pruefsumme OR timestamp_hash = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM imported_meeting WHERE package_checksum = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM operator WHERE letterhead_checksum = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM meeting_access WHERE handout_hash = die_pruefsumme)
        OR EXISTS (SELECT 1 FROM meeting_handover WHERE package_checksum = die_pruefsumme)
        -- **Beide Richtungen des Leihscheins.** `returned_package` ist die
        -- Prüfsumme des Rückgabepakets, das mit der Versammlung zurückkommt; die
        -- Schranke `handover_rueckpaket` in Migration 117 verlangt dafür dieselbe
        -- Form. Heute schreibt es noch niemand, der Rückweg kommt erst. Es hier
        -- gleich mitzunehmen kostet eine Zeile; es später nachzutragen hiesse, den
        -- Fehler erst zu bauen und dann zu suchen.
        OR EXISTS (SELECT 1 FROM meeting_handover WHERE returned_package = die_pruefsumme);
$$;

-- Die Rechte gehören zur Funktion und nicht zur Migration: `CREATE OR REPLACE`
-- behält sie zwar, aber wer die Zeile hier liest, soll nicht in 113 nachsehen
-- müssen, wem sie offensteht.
REVOKE ALL ON FUNCTION pruefsumme_verwendet(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pruefsumme_verwendet(text) TO versammlung_app;
