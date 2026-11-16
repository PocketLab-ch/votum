-- 141 — Geheime Abstimmung: das Merkmal am Durchgang
--
-- Auftrag `.auftraege/2026-10-04-votum-entschiedene-und-nachzuege.md`, B2;
-- Produktentscheide 28.09.2026 (`quellen/themen/stockwerkeigentum/fragen.md`),
-- Fachprüfung `quellen/pruefung/berichte/2026-09-28-fachpruefung-geheime-abstimmung.md`.
--
-- **Der Fall.** Verlangt die Versammlung eine geheime Abstimmung, hält Votum
-- beim Eröffnen diese Tatsache am Durchgang fest. Geheim heisst im Sinn des
-- Produktentscheids, dass die Anwesenden nicht voneinander wissen, wie
-- gestimmt wurde, auch nicht über das Protokoll: Anzeigen nennen nur
-- «erreicht» oder «nicht erreicht», die Einzelstimmen bleiben verschlossen im
-- Abschlusspaket. Die Datenbank speichert die Zuordnung weiter, damit ein
-- Gericht den Beschluss nachprüfen kann; «geheim» ist deshalb eine
-- Ausgaberegel, keine Löschung.
--
-- **Warum am Durchgang und nicht am Traktandum.** Dieselbe Sache kann in
-- mehreren Durchgängen abgestimmt werden, geheim und offen gemischt (etwa
-- nach einem Rückkommen). Das Merkmal gehört deshalb zu dem Durchgang, in dem
-- abgestimmt wurde, wie Erfordernis und Anwesenheit; es wird beim Eröffnen
-- gesetzt und ist danach unveränderlich.
--
-- **Bestehende Durchgänge bleiben offen** (`false`): Vor dieser Migration gab
-- es die Wahl nicht, und die Anzeige alter Ergebnisse soll sich nicht
-- rückwirkend ändern.
--
-- **Was das Merkmal nicht ist.** Kein Geheimnis gegenüber der Verwaltung: Sie
-- führt das Werkzeug und muss ihm vertraut sein (Produktentscheid 28.09.2026).
-- Es steuert, was Leinwand, Telefon, Auswertung und Protokoll zeigen — nicht,
-- was die Datenbank speichert.

ALTER TABLE voting_round
    ADD COLUMN secret boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN voting_round.secret IS
    'Geheime Abstimmung (Produktentscheid 28.09.2026): Anzeigen nennen nur erreicht/nicht erreicht, die Einzelstimmen bleiben verschlossen im Abschlusspaket. Beim Eröffnen gesetzt, danach unveränderlich. Die Zuordnung bleibt in der Datenbank, weil der Beschluss nachprüfbar bleiben muss.';
