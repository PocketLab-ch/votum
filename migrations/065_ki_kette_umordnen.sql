-- Die KI-Kette umordnen (17.08.2026).
--
-- **Der Anlass.** Die Reihenfolge der Stufen liess sich nur beim Anlegen
-- bestimmen: Eine neue Stufe kommt ans Ende, und geändert werden konnten
-- Bezeichnung, Adresse, Modell, Geduld und Zugangsschlüssel — die Nummer nicht.
-- Wer Mistral vor Infomaniak stellen wollte, musste beide aus der Kette nehmen
-- und in der gewünschten Reihenfolge neu anlegen, samt Zugangsschlüsseln. Dabei
-- verliert man zwangsläufig einen Schlüssel, den die Anwendung nie wieder
-- anzeigt.
--
-- Und die Reihenfolge ist keine Kleinigkeit: Stufe 1 ist das Modell, das im
-- Saal tatsächlich antwortet. Alles Weitere ist Ausweichung bei Ausfall.
--
-- **Warum aufschiebbar.** Ein Tausch durchläuft zwangsläufig einen
-- Zwischenstand, in dem zwei Zeilen dieselbe Nummer beanspruchen. Ohne Aufschub
-- müsste die Anwendung sie über einen Hilfswert herumschieben — und der ist
-- hier nicht einmal zu haben: `position` ist auf 1 bis 9 begrenzt, bei neun
-- Stufen ist keine Nummer frei. Dieselbe Überlegung und dieselbe Lösung wie bei
-- `agenda_position_je_elternteil` (Migration 012): Die Bedingung gilt beim
-- Commit, also genau dann, wenn die Kette wieder stimmen muss.
--
-- Der Name wird dabei gesetzt, statt den vergebenen zu übernehmen: Die
-- Anwendung schiebt ihn in `SET CONSTRAINTS` auf, und ein von PostgreSQL
-- vergebener Name (`ai_stage_operator_id_position_key`) sähe dort aus wie ein
-- Zufall, den man beim nächsten Umbau still verliert.

ALTER TABLE ai_stage DROP CONSTRAINT ai_stage_operator_id_position_key;

ALTER TABLE ai_stage ADD CONSTRAINT ai_stage_position_je_betreiber
    UNIQUE (operator_id, position) DEFERRABLE INITIALLY IMMEDIATE;

COMMENT ON CONSTRAINT ai_stage_position_je_betreiber ON ai_stage IS
    'Zwei Stufen mit derselben Nummer wären eine Kette ohne Reihenfolge. Aufschiebbar, damit ein Tausch ohne Hilfswerte auskommt.';
