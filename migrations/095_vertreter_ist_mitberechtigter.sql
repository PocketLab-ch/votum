-- Der Vertreter ist immer ein eingetragener Mitberechtigter (26.08.2026).
--
-- **Warum erst jetzt und nicht in 094.** Migration 094 legte
-- `party.representative_party_id` an, liess aber offen, ob der Verweis auf eine
-- Zeile zeigen muss, die auch in `party_member` steht. Das war Absicht: Solange
-- es keinen Weg gab, die Vertretung zu **wechseln**, hätte die Schranke die
-- Anlagereihenfolge festgeschrieben, bevor sie feststand. Mit
-- `erstelleGemeinschaftlicheZeile` und der Aktion «Vertretung wechseln» steht
-- sie: Erst die Mitgliedszeile, dann der Verweis.
--
-- **Was sie verhindert.** Ohne sie liess sich der Verweis auf irgendeine Zeile
-- desselben Hauses setzen — auch auf eine, die gar nicht mitberechtigt ist.
-- Nach ZGB Art. 712o Abs. 1 gibt die eine Stimme aber **eine der berechtigten
-- Personen** ab, nicht eine dritte. Bis hierher hing diese Zusage allein an
-- Prüfungen in der Anwendung; von Hand schreiben liess sich der falsche Zustand
-- trotzdem.
--
-- **Die Spaltenreihenfolge weicht bewusst ab.** Die eindeutige Schranke heisst
-- `party_member_einmalig (huelle_party_id, mitglied_party_id)`; hier steht
-- `(mitglied_party_id, huelle_party_id)`, weil die verweisende Seite
-- `(representative_party_id, id)` lautet und die Paare einander entsprechen
-- müssen. Postgres sucht die eindeutige Schranke über die **Menge** der
-- Spalten, nicht über ihre Reihenfolge — am 26.08.2026 an einer Probedatenbank
-- nachgemessen.
--
-- **`ON DELETE SET NULL` und nicht `RESTRICT`.** RESTRICT bräche zwei Wege, die
-- richtig sind: das Tilgen einer Hülle (ihre Mitgliedschaften fallen per
-- CASCADE, und der Verweis der Hülle auf sich selbst wäre dann im Weg) und
-- `scripts/testdaten-entfernen.sql`, das `party_member` vor `party` leert. Der
-- eine Weg, der **nicht** stillschweigend nullen darf — das Entfernen eines
-- einzelnen Mitberechtigten —, ist in `entferneMitberechtigten` mit einer
-- ausformulierten Absage versperrt.
--
-- Die Spalte wird ausdrücklich benannt: Ohne die Angabe setzte Postgres beide
-- Spalten des Schlüssels zurück, und `id` ist der Primärschlüssel.
ALTER TABLE party
    ADD CONSTRAINT party_vertreter_ist_mitglied
    FOREIGN KEY (representative_party_id, id)
    REFERENCES party_member (mitglied_party_id, huelle_party_id)
    ON DELETE SET NULL (representative_party_id);
