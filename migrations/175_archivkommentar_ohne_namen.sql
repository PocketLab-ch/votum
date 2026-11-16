-- 175 — Der Kommentar zu `stweg_archiv_wegen` ohne Personennamen
--
-- **Der Anlass** ist die Bereinigung der Personendaten vor der Veröffentlichung
-- (`docs/veroeffentlichung-personendaten.md`, 27.10.2026). Migration 087 setzte
-- den Kommentar der Funktion mit einem Namen statt einer Rolle. Die Datei 087
-- trägt seither die Rolle, aber eine schon ausgeführte Migration läuft nicht
-- noch einmal: Auf einer bestehenden Datenbank stünde der alte Wortlaut weiter
-- im Katalog. Diese Migration setzt ihn neu, mit demselben Wortlaut wie 087.
-- Auf einer neuen Datenbank setzt sie denselben Text ein zweites Mal; das
-- schadet nicht.
COMMENT ON FUNCTION stweg_archiv_wegen(uuid) IS
    'Die Gemeinschaft, deren Archivierung diese hier aus den Listen nimmt — sie '
    'selbst oder der nächste archivierte Vorfahr. NULL heisst: steht in der Liste. '
    'Die Gruppe ist eine Einheit (Auftraggeber, 25.08.2026); geschrieben wird das Archiv '
    'aber nur auf einer Zeile, damit Hervorholen nichts nachhalten muss.';
