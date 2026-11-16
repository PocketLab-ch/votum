-- Der Spaltenkommentar zeigte auf eine Datei, die es nicht gibt.
--
-- Migration 086 verweist in `COMMENT ON COLUMN stweg.archived_at` auf
-- `src/lib/server/archiv.ts`. So heisst dort nichts: Der Serverbaustein ist
-- `server/archivieren.ts`, der Kern `domain/archivieren.ts`, und `archiv.ts`
-- ist seit dem 30.07.2026 das ZIP-Archiv fuer das Siegelpaket. Wer dem
-- Kommentar folgt, landet beim Packen von Dateien.
--
-- **Warum eine eigene Migration und keine Berichtigung in 086.** Weil 086
-- gelaufen ist. Eine ausgefuehrte Migration nachtraeglich zu aendern faellt
-- unter AD-14, und der Pruefer der Migrationen faengt es ab — zu Recht: Wer
-- eine Datei aendert, die anderswo laengst gelaufen ist, hat zwei verschiedene
-- Wahrheiten unter demselben Namen. Dasselbe galt beim zweiten Anlauf fuer 087.
--
-- Der neue Wortlaut nennt zugleich die Regel aus 087: Die Gruppe geht gemeinsam
-- ins Archiv, und zwar abgeleitet statt mitgeschrieben.
COMMENT ON COLUMN stweg.archived_at IS
    'Seit wann diese Gemeinschaft archiviert ist: aus Auswahl und Suche genommen, '
    'überall sonst unverändert sichtbar. Sie nimmt ihre Untergemeinschaften und '
    'deren Versammlungen mit — abgeleitet über stweg_archiv_wegen(), nicht '
    'mitgeschrieben. Die Regel, wer was liest, steht in src/lib/server/archivieren.ts.';
