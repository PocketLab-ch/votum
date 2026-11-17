-- 195: Reglementsregel ohne Kopfschwelle («Köpfe zählen nicht»)
--
-- **Der Anlass** ist der Produktentscheid vom 16.11.2026 (Wertquotenmehr
-- «bauen»): Manche Reglemente bemessen das einfache Mehr nach den an der
-- Versammlung vertretenen Wertquoten allein, ohne Köpfe (Rz. 186 ad Art. 712m,
-- dritte Variante). Bis hier verlangte die Tabelle eine Kopfschwelle; eine
-- solche Regel liess sich nur strenger hinterlegen (Köpfe und Anteile), und
-- ein Antrag mit der Mehrheit der Anteile ohne die der Köpfe erschien als
-- abgelehnt.
--
-- Nur `NOT NULL` fällt. Die bestehenden Bedingungen `bylaw_rule_kopf_bruch` und
-- `bylaw_rule_kopf_art` lassen leere Felder schon zu (eine Bedingung über NULL
-- ist nicht verletzt; abgelesen mit pg_get_constraintdef am 16.11.2026) und
-- bleiben unverändert. Neu ist die Vollständigkeit, wie bei den Wertquoten:
-- die drei Kopffelder ganz oder gar nicht, und ohne Köpfe eine Quotenschwelle.
-- Die Kopfbasis bleibt Pflicht; ohne Köpfe setzt die Domäne sie auf
-- `anwesend_vertreten`, ohne Wirkung.

ALTER TABLE bylaw_quorum_rule ALTER COLUMN head_numerator DROP NOT NULL;
ALTER TABLE bylaw_quorum_rule ALTER COLUMN head_denominator DROP NOT NULL;
ALTER TABLE bylaw_quorum_rule ALTER COLUMN head_mode DROP NOT NULL;

ALTER TABLE bylaw_quorum_rule ADD CONSTRAINT bylaw_rule_kopf_vollstaendig CHECK (
	(head_numerator IS NOT NULL AND head_denominator IS NOT NULL AND head_mode IS NOT NULL)
	OR (
		head_numerator IS NULL AND head_denominator IS NULL AND head_mode IS NULL
		AND quota_numerator IS NOT NULL
	)
);
