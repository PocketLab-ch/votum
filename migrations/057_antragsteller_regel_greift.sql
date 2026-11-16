-- 057 — Die Regel auf `agenda_item_proposer` greift nie (Abnahme 08.08.2026)
--
-- **Gefunden von dem Wächter, der aus der Abnahme des Audits entstand.** Er
-- prüft seit dem 08.08.2026 nicht mehr nur, **dass** eine Tabelle eine Regel
-- hat, sondern **was** darin steht. Beim ersten Lauf fiel diese hier durch:
--
--     USING (operator_id = current_setting('app.operator_id', true)::uuid)
--
-- Gesetzt wird aber `versammlung.operator_id` (`alsBetreiber()` in
-- `src/lib/server/db.ts`). `app.operator_id` ist nie gesetzt, `current_setting`
-- liefert mit `true` als zweitem Wert `NULL`, und `operator_id = NULL` ist
-- niemals wahr.
--
-- **Die Folge ist keine Lücke, sondern ein toter Zweig:** Die Regel liess nicht
-- zu viel durch, sondern gar nichts. Unter der Anwendungsrolle ist die Tabelle
-- leer, was immer darin steht, und ein `INSERT` scheitert am `WITH CHECK`. Der
-- Antrag mehrerer Eigentümer gemeinsam (Migration 034, `proposer_kind =
-- 'mehrere_eigentuemer'`) hätte in Betrieb also nicht funktioniert — und zwar
-- mit einer Fehlermeldung über Zeilenschutz, an der niemand die Ursache erkennt.
--
-- Dass es bisher nicht auffiel, hat einen einfachen Grund: Die Tabelle war leer,
-- und ein Prüfstand, der sie füllt, fehlte. Genau deshalb ist ein Wächter, der
-- den **Ausdruck** liest, mehr wert als einer, der Regeln zählt.

DROP POLICY agenda_item_proposer_betreiber ON agenda_item_proposer;

-- Wortgleich mit allen anderen 37 Regeln. Der Vergleich läuft über `::text` und
-- nicht über `::uuid`: Ein nicht gesetzter Mandant ergibt dann die leere Menge
-- statt eines Umwandlungsfehlers.
CREATE POLICY agenda_item_proposer_mandant ON agenda_item_proposer
    USING (operator_id::text = current_setting('versammlung.operator_id', true));
