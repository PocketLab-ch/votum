-- Die Reihenfolge der Gemeinschaften innerhalb eines Traktandums.
--
-- Gemeldet am 11.08.2026: «Wie kann ich die Reihenfolge sortieren? Kann ja sein,
-- dass die Auswahl uneinheitlich ist oder abweicht von anderen Abstimmungen mit
-- denselben Gemeinschaften.»
--
-- Bisher richtete sich die Reihenfolge der Ziffern 3.1, 3.2 ausschliesslich nach
-- `meeting.day_position`, also nach dem Ablauf des Abends. Das ist die richtige
-- Vorgabe — beim Einlass und auf der Tafel gilt dieselbe Ordnung —, aber es gibt
-- Traktanden, bei denen eine andere Reihenfolge sachlich ist: Wo eine
-- Miteigentümergemeinschaft zuerst entscheiden muss, damit die Häuser danach
-- über die Folgen befinden können, gehört sie an die erste Stelle dieses einen
-- Punktes und nicht an die erste Stelle des Abends.
--
-- `NULL` heisst «folgt dem Ablauf des Abends» und ist der Normalfall. Erst wer
-- von Hand sortiert, schreibt Werte hinein.
ALTER TABLE agenda_item
	ADD COLUMN IF NOT EXISTS business_position integer;

COMMENT ON COLUMN agenda_item.business_position IS
	'Stelle dieser Gemeinschaft innerhalb ihres Geschaefts (Ziffern 3.1, 3.2). '
	'NULL = folgt der Stelle im Ablauf des Abends (meeting.day_position).';

-- Kein UNIQUE: Beim Umsortieren durchlaeuft die Liste Zwischenstaende, in denen
-- zwei Zeilen dieselbe Stelle beanspruchen — dieselbe Lage wie bei
-- agenda_position_je_elternteil, nur ohne die Notwendigkeit einer Schranke:
-- Gleichstand wird beim Rechnen ueber die Stelle im Ablauf aufgeloest.
CREATE INDEX IF NOT EXISTS agenda_item_geschaeft_stelle
	ON agenda_item (business_id, business_position)
	WHERE business_id IS NOT NULL;
