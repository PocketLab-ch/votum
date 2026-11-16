-- Die Einstimmigkeit als Reglementsregel (Prüflauf 22.08.2026, Befund A-02)
--
-- Beide Bruch-Bedingungen verlangten einen Nenner ab 2 und wiesen damit genau
-- den Bruch ab, den die Anwendung selbst für die Einstimmigkeit verwendet:
-- ALLE = 1/1 in src/lib/domain/mehrheit.ts. Ein Reglement, das für luxuriöse
-- bauliche Massnahmen die Zustimmung aller verlangt (ZGB Art. 647e, und fast
-- jedes Reglement schreibt das ab), liess sich nicht hinterlegen.
--
-- Die Domänenprüfung war der erste Ort, die Eingabefelder der zweite, dieser
-- CHECK der dritte. Wer nur die ersten beiden lockert, bekommt statt einer
-- Absage einen 500er — so geschehen, bevor diese Migration entstand.
--
-- ABGELESEN, NICHT NACHGEBAUT: Die Bedingungen unten sind pg_get_constraintdef
-- entnommen und nur an einer Stelle geändert (>= 2 wird zu >= 1). DROP + ADD
-- ersetzt die GANZE Bedingung; ein Nachbau aus dem Gedächtnis hätte hier die
-- Obergrenze 100 oder den Vergleich zaehler <= nenner verloren.
--
-- Was NICHT gelockert wird: «mehr als die ganze Bezugsgrösse» bleibt
-- ausgeschlossen — das prüft die Domäne (schwelle_mehr_als_alle), weil der
-- Fehler dort einen Satz bekommt statt einer Verstossmeldung.

ALTER TABLE bylaw_quorum_rule DROP CONSTRAINT bylaw_rule_kopf_bruch;
ALTER TABLE bylaw_quorum_rule ADD CONSTRAINT bylaw_rule_kopf_bruch CHECK (
	head_numerator >= 1
	AND head_denominator >= 1
	AND head_denominator <= 100
	AND head_numerator <= head_denominator
);

ALTER TABLE bylaw_quorum_rule DROP CONSTRAINT bylaw_rule_quoten_bruch;
ALTER TABLE bylaw_quorum_rule ADD CONSTRAINT bylaw_rule_quoten_bruch CHECK (
	quota_numerator IS NULL
	OR (
		quota_numerator >= 1
		AND quota_denominator >= 1
		AND quota_denominator <= 100
		AND quota_numerator <= quota_denominator
	)
);
