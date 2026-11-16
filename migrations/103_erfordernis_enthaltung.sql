-- Ob Enthaltungen in der Bezugsgrösse bleiben, festgehalten am Erfordernis.
--
-- **Der Anlass** (Prüfdurchgang vom 04.09.2026). Eine Gemeinschaft kann im
-- Reglement hinterlegen, dass Enthaltungen aus der Bezugsgrösse fallen
-- (`bylaw_quorum_rule.abstention_counts`, seit Migration 040). Erfasst,
-- gespeichert und auf der Reglementsseite angezeigt wurde das seither; gerechnet
-- wurde es nie. Der Rechenweg sieht nur das **Erfordernis** am Traktandum, und
-- dieses führte das Merkmal weder im Typ noch in einer Spalte.
--
-- Gemessen wurde ein Antrag mit einer Ja-Stimme und einer Enthaltung: Die
-- Anwendung verkündete «abgelehnt», während die angezeigte Regel ihn annimmt.
--
-- **`NULL` heisst «zählt mit», und das ist keine Bequemlichkeit.** Ein
-- Erfordernis, das vor dieser Spalte festgeschrieben wurde, muss weiterhin so
-- nachgerechnet werden, wie damals gerechnet wurde: Enthaltungen in der Basis.
-- Ein bereits gefasster Beschluss darf durch eine Migration nicht die Seite
-- wechseln. Nur ein ausdrückliches FALSE nimmt sie heraus.
--
-- Deshalb auch kein DEFAULT: Ein Vorgabewert schriebe eine Aussage in Zeilen,
-- über die niemand entschieden hat.
ALTER TABLE agenda_item
	ADD COLUMN requirement_abstention_counts boolean;

COMMENT ON COLUMN agenda_item.requirement_abstention_counts IS
	'Ob Enthaltungen in der Bezugsgrösse bleiben. NULL = zählen mit, wie vor dem 04.09.2026 gerechnet wurde.';
