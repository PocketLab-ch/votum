-- Die Frist zur zweiten Versammlung wird je Gemeinschaft hinterlegbar
-- (Produktentscheid 24.09.2026).
--
-- **Anders als bei der Einberufungsfrist gibt es hier eine gesetzliche Zahl.**
-- ZGB Art. 712p Abs. 2 lässt die zweite Versammlung «nicht vor Ablauf von zehn
-- Tagen seit der ersten» stattfinden. Die Anwendung rechnet deshalb auch ohne
-- hinterlegten Wert, und zwar mit zehn. Diese Spalte trägt nur den Fall, dass
-- ein Reglement **mehr** verlangt.
--
-- **Und nur mehr.** «Ein Reglement darf die Frist verlängern, nicht verkürzen»
-- (Wermelinger, Rz. 40 ad Art. 712p; belegt in
-- quellen/themen/stockwerkeigentum/gesetz.md). Dieselbe Richtung gilt für
-- Abs. 1 derselben Bestimmung, wo sie `pruefeErschwerung` durchsetzt.
--
-- **Warum die Untergrenze in der Datenbank steht und nicht nur im Kern.** Eine
-- kürzere Frist wäre genau der Ausweg, den R-2b am 24.09.2026 geschlossen hat:
-- Bis dahin schaltete ein Begründungsfeld die Fristprüfung ab, einmalig. Eine
-- frei kürzbare Reglementszahl täte dasselbe, dauerhaft und je Gemeinschaft.
-- Eine Sperre, die nur am Eingang steht, deckt den Bestand nicht (AD-6).
ALTER TABLE stweg ADD COLUMN second_meeting_interval_days   integer;
ALTER TABLE stweg ADD COLUMN second_meeting_interval_source text;

-- Untergrenze zehn: das gesetzliche Minimum. Obergrenze 365 als
-- Tippfehlerbremse, wie bei der Einberufungsfrist.
ALTER TABLE stweg ADD CONSTRAINT stweg_zweitversammlungsfrist
    CHECK (second_meeting_interval_days IS NULL
           OR second_meeting_interval_days BETWEEN 10 AND 365);

ALTER TABLE stweg ADD CONSTRAINT stweg_zweitversammlungsfrist_fundstelle
    CHECK (second_meeting_interval_days IS NULL
           OR length(btrim(coalesce(second_meeting_interval_source, ''))) >= 3);

COMMENT ON COLUMN stweg.second_meeting_interval_days IS
    'Frist zur zweiten Versammlung in Tagen nach Reglement, mindestens die gesetzlichen 10. NULL heisst: nicht hinterlegt — es gilt das Gesetz.';
COMMENT ON COLUMN stweg.second_meeting_interval_source IS
    'Wo die Frist im Reglement steht. Pflicht, sobald eine Zahl steht.';
