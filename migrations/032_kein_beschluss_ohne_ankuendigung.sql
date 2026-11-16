-- Kein Beschluss über ein nicht angekündigtes Geschäft. Auch nicht mit
-- Zustimmung der Versammlung.
--
-- Migration 031 trennte Folgeantrag und neues Geschäft und liess für das neue
-- Geschäft einen Weg offen: den Beschluss, mit dem die Versammlung die
-- Erweiterung der Traktandenliste genehmigt. Diesen Weg gibt es nicht.
--
-- ZGB Art. 712n Abs. 2 i.V.m. Art. 67 Abs. 3: Über Gegenstände, die nicht
-- gehörig angekündigt sind, kann nicht Beschluss gefasst werden. Der Satz kennt
-- keinen Vorbehalt zugunsten der Versammlung — sie kann die eigene Ankündigung
-- nicht nachholen, denn geschützt ist nicht sie, sondern der Abwesende, der auf
-- die Traktandenliste vertraut hat und deshalb nicht gekommen ist. Wer ihm das
-- nehmen könnte, wäre gerade die Mehrheit der Erschienenen.
--
-- Was bleibt, sind zwei Wege:
--
--   * **Folgeantrag** — im Kern des angekündigten Antrags. Der Gegenstand war
--     angekündigt, der Antrag dazu muss es nicht sein.
--   * **Kenntnisnahme** — die Sache wird besprochen und festgehalten, aber nicht
--     beschlossen. Der Beschluss gehört auf die nächste Traktandenliste.
--
-- `approved_by_item_id` bleibt als Spalte stehen (AD-14, nur aufwärts) und trägt
-- den Bestand früherer Versammlungen. Sie erlaubt nichts mehr.

COMMENT ON COLUMN agenda_item.approved_by_item_id IS
    'Historisch: Beschluss, mit dem die Versammlung die Erweiterung der '
    'Traktandenliste genehmigt hat. Erlaubt seit Migration 032 keine Abstimmung '
    'mehr — über ein nicht angekündigtes Geschäft kann nicht Beschluss gefasst '
    'werden (ZGB Art. 712n Abs. 2 i.V.m. Art. 67 Abs. 3).';

COMMENT ON COLUMN agenda_item.spontaneous_kind IS
    'Bei einem während der Sitzung aufgenommenen Traktandum: folgeantrag (im Kern '
    'des angekündigten Grundantrags, Abstimmung zulässig) oder neu (nicht '
    'angekündigt, nur als Kenntnisnahme). NULL bei angekündigten Traktanden.';

-- NOT VALID: Der Bestand wird nicht angetastet. Ein früher unter der alten Regel
-- gefasster Beschluss ist geschehen; ihn nachträglich zur Kenntnisnahme
-- umzudeuten hiesse, den Verlauf zu verfälschen. Für jede neue und jede
-- geänderte Zeile gilt die Schranke ab sofort.
ALTER TABLE agenda_item ADD CONSTRAINT agenda_neu_nur_kenntnisnahme CHECK (
    is_spontaneous = false
    OR spontaneous_kind = 'folgeantrag'
    OR item_kind = 'kenntnisnahme'
) NOT VALID;
