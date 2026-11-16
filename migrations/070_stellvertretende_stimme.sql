-- Die Begründung, wenn die Sitzungsleitung für eine Partei stimmt.
--
-- **Der Anlass, am 20.08.2026.** Gemeldet als Loch: «dass der Sitzungsleiter für
-- einen Eigentümer stimmen darf. Das müsste aber dokumentiert sein. Bspw.
-- Telefon ist gerade ausgefallen. Da müsste man den Stimmberechtigten
-- auswählen, Begründung schreiben und stimmen.»
--
-- Bis hierher trug eine so erfasste Stimme nur `recorded_by_chair = true` und
-- den Benutzer. Das sagt, DASS die Sitzungsleitung getippt hat, nie WARUM. Im
-- Streitfall ist genau das die Frage: Eine fremde Stimme, für die niemand einen
-- Grund nennen kann, ist keine Stimme, sondern ein Eingriff.
--
-- **Warum an der Stimme und nicht nur im Verlauf.** Der Verlauf ist die
-- Chronik; die Stimme ist der Beleg. Wer später eine einzelne Stimme ansieht —
-- im Protokoll, in einer Auswertung, in einer Anfechtung —, muss ihren Grund
-- dort finden, wo sie steht, und nicht in einer zweiten Liste suchen müssen.
--
-- **NULL bleibt erlaubt**, und zwar nicht aus Nachlässigkeit: In der einfachen
-- Betriebsart erfasst die Sitzungsleitung ALLE Stimmen, und der Grund dafür ist
-- die Betriebsart selbst — je Partei denselben Satz zu verlangen, erzeugte
-- vierzehn Pflichtfelder und keine einzige Auskunft. Wo die Eigentümer selbst
-- abstimmen (geführte Betriebsart), verlangt die Anwendung die Begründung; das
-- ist eine Regel über den Zusammenhang, den diese Tabelle nicht kennt.
ALTER TABLE vote ADD COLUMN chair_reason text;

-- Ein Grund, der nur aus einem Zeichen besteht, ist keiner. Die Schranke sitzt
-- bewusst tiefer als die Prüfung in der Anwendung (zehn Zeichen): Hier wehrt sie
-- das Sinnlose ab, dort steht der fachliche Anspruch.
ALTER TABLE vote
	ADD CONSTRAINT vote_chair_reason_gehaltvoll
	CHECK (chair_reason IS NULL OR length(btrim(chair_reason)) >= 5);

COMMENT ON COLUMN vote.chair_reason IS
	'Warum die Sitzungsleitung diese Stimme erfasst hat. Pflicht in der geführten '
	'Betriebsart, NULL in der einfachen (dort ist die Betriebsart der Grund).';
