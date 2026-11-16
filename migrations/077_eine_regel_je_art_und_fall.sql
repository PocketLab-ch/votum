-- Der alte Eindeutigkeitsindex weicht dem neuen
-- (gehört zu 076; als eigene Migration, weil 076 bereits gelaufen war — AD-14)
--
-- `bylaw_rule_je_geschaeftsart` erlaubte genau EINE Regel je Geschäftsart und
-- verhinderte damit die Aufteilung, um die es in 076 geht: eine allgemeine Regel
-- für die Art und daneben eine schärfere für einen einzelnen Fall.
--
-- Der neue Index aus 076 sichert weiterhin, dass es je Art UND Fall nur eine
-- gibt. Zwei Regeln für denselben Fall wären zwei Antworten auf dieselbe Frage,
-- und welche gilt, entschiede die Reihenfolge in der Liste.

DROP INDEX bylaw_rule_je_geschaeftsart;
