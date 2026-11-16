-- 132 — Ausschlussklage: nur eine Person oder alle Eigentümer der Wohnung beklagt
--
-- Auftrag `.auftraege/2026-09-30-kartenbefunde-kenntnisnahme-ausschlussklage.md`,
-- Block 2.
--
-- **Der Anlass.** Ab Fassung 2026-10-11 bleibt eine beklagte Partei mit
-- gemeinsamem Eigentum an der Ermächtigung zur Ausschlussklage in der
-- Bezugsgrösse, stimmt aber nicht ab (`beklagtenwohnungZaehltMit`): Art. 649b
-- Abs. 2 ZGB nimmt nur den Beklagten aus der Zahl, und die übrigen Eigentümer
-- der Wohnung bleiben Miteigentümer. Die Fachprüfung vom 30.09.2026 (F3-1) fand
-- den Fall, in dem das nicht trägt: Bei Gesamteigentum, etwa einer
-- Erbengemeinschaft oder einer ehelichen Gütergemeinschaft, richtet sich die
-- Klage gegen alle (SVIT-Kommentar 2023, Rz. 216 ad Art. 712a). Dann bleibt an
-- der Wohnung niemand, den das Gesetz in der Zahl liesse, und die Wohnung fällt
-- heraus. Ob das so ist, weiss die Anwendung nicht; die Sitzungsleitung hält es
-- fest.
--
-- **Produktentscheid 30.09.2026:** Angabe am Traktandum, beim Beklagten, ob nur
-- eine Person oder alle Eigentümer der Wohnung beklagt sind. Vorgabe «nur eine
-- Person», die strengere Zahl. Deshalb `false` für jede bestehende Zeile, ohne
-- Nachtrag.
--
-- **Keine eigene Sperre.** Die Spalte liegt in `agenda_item_affected`; die
-- Trigger nach dem Siegel (Migration 124) und bei der Abgabe (Migration 117)
-- greifen bei `INSERT OR UPDATE OR DELETE` und decken sie damit schon ab.
--
-- **Beim Schliessen eingefroren** wie Vorab-Vermerk und Veto: `leseBetroffeneIn`
-- schreibt sie als `alleBeklagt: true` in `voting_round.affected_json`, nur wenn
-- sie wahr ist. Fehlt der Schlüssel, gilt «nur eine Person», auch bei
-- Durchgängen, die vorher geschlossen wurden; unter keiner Fassung vor
-- 2026-10-11 ändert das etwas.
--
-- Ob die Angabe wirkt (Ausschlussklage, gemeinsames Eigentum, Fassung ab
-- 2026-10-11, Bezugsgrösse über alle), prüft die Anwendung. Die Tabelle kennt
-- das Erfordernis nicht, und ein geändertes Erfordernis soll keinen
-- Datenbankfehler werfen, sondern im Kern unwirksam bleiben, wie beim
-- Vorab-Vermerk.

ALTER TABLE agenda_item_affected
    ADD COLUMN alle_eigentuemer_beklagt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN agenda_item_affected.alle_eigentuemer_beklagt IS
    'Ausschlussklage, beklagte Partei mit gemeinsamem Eigentum: wahr, wenn alle Eigentümer der Wohnung beklagt sind (Rz. 216 ad Art. 712a); dann fällt die Wohnung aus der Zahl. Vorgabe falsch: nur eine Person beklagt, die Wohnung zählt mit und stimmt nicht ab (Produktentscheid 30.09.2026).';

COMMENT ON COLUMN voting_round.affected_json IS
    'Die beim Schliessen festgeschriebenen Betroffenen samt Vorab-Vermerk, Veto-Entscheid und Angabe zur Ausschlussklage, [{parteiId, vorab, veto, alleBeklagt}]. alleBeklagt steht nur, wenn wahr; fehlt es, gilt falsch. NULL bei Durchgängen, die vor Migration 124 geschlossen wurden; dort wird agenda_item_affected gelesen.';
