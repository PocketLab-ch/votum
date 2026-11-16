-- Folgeantrag oder neues Geschäft — zwei Fälle, die bisher einer waren.
--
-- Bisher galt jedes während der Sitzung aufgenommene Traktandum als
-- Spontantraktandum und brauchte den Beschluss, mit dem die Versammlung die
-- Erweiterung der Traktandenliste genehmigt hat. Das ist für einen **neuen,
-- sachfremden** Gegenstand richtig und für einen **Folgeantrag** falsch.
--
-- Ein Folgeantrag hält sich im Kern des angekündigten Grundantrags: Er ändert
-- den Betrag, teilt die Massnahme, verschiebt den Termin. Der Gegenstand war
-- angekündigt, und ZGB Art. 712n i.V.m. Art. 67 Abs. 3 verlangt die Ankündigung
-- des **Gegenstands**, nicht jedes einzelnen Antrags dazu. Sonst könnte eine
-- Versammlung über ein angekündigtes Geschäft nur noch unverändert
-- Ja oder Nein sagen, und jede Beratung wäre folgenlos.
--
-- Sachfremd bleibt sachfremd: Wer unter «Sanierung der Fassade» über den Verkauf
-- des Bastelraums beschliessen will, braucht die genehmigte Erweiterung.
--
-- Die Beurteilung, ob ein Antrag im Kern des Grundantrags liegt, trifft die
-- Sitzungsleitung. Die Datenbank hält fest, wie sie entschieden hat, und woran
-- der Folgeantrag hängt.

ALTER TABLE agenda_item ADD COLUMN spontaneous_kind text;

COMMENT ON COLUMN agenda_item.spontaneous_kind IS
    'Bei einem während der Sitzung aufgenommenen Traktandum: folgeantrag (im Kern '
    'des angekündigten Grundantrags, keine Genehmigung nötig) oder neu (sachfremd, '
    'Genehmigung der Erweiterung nötig). NULL bei angekündigten Traktanden.';

-- Bestehende Spontantraktanden waren unter der alten Regel stets der strenge
-- Fall. Sie hier auf «neu» zu setzen ändert nichts an ihrer Behandlung; die
-- Alternative wäre eine Spalte, die für alten Bestand nichts aussagt.
UPDATE agenda_item SET spontaneous_kind = 'neu' WHERE is_spontaneous;

ALTER TABLE agenda_item ADD CONSTRAINT agenda_spontanart CHECK (
    (is_spontaneous = false AND spontaneous_kind IS NULL)
    OR (is_spontaneous = true AND spontaneous_kind IN ('folgeantrag', 'neu'))
);

-- Ein Folgeantrag ohne Grundantrag ist keiner. Die Zeile muss unter einem
-- übergeordneten Traktandum hängen — dort steht der angekündigte Gegenstand,
-- auf den sich die Zulässigkeit stützt.
ALTER TABLE agenda_item ADD CONSTRAINT agenda_folgeantrag_hat_grundantrag CHECK (
    spontaneous_kind IS DISTINCT FROM 'folgeantrag' OR parent_id IS NOT NULL
);
