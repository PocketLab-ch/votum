-- 048 — Die Nutzniessung wandert in die Momentaufnahme (Welle 3, FR-22)
--
-- **Warum sie eingefroren gehört.** Ab Welle 3 leitet die Anwendung aus der
-- Geschäftsart des Traktandums ab, wer bei einer belasteten Einheit stimmt
-- (ZGB Art. 712o Abs. 2). Diese Ableitung stützt sich auf zwei Angaben: das am
-- Traktandum festgehaltene Erfordernis — das liegt fest (AD-4) — und den Stand
-- der Nutzniessung.
--
-- Läge Letzterer nur in den Stammdaten, hiesse das: Wer nächstes Jahr die
-- Nutzniessung beendet oder eine Vereinbarung nachträgt, ändert damit die
-- Auskunft darüber, wer an der letzten Versammlung stimmberechtigt war. Genau
-- das verhindert AD-3 — der Stimmberechtigtenstand gilt, wie er bei der
-- Freigabe war.
--
-- **Am Ort der Einheit, nicht als eigene Tabelle.** Die Nutzniessung hängt an
-- genau einer Einheit, und die Momentaufnahme führt diese Einheit ohnehin. Eine
-- eigene Tabelle brächte eine zweite Stelle, an der dasselbe stehen kann.

ALTER TABLE snapshot_unit ADD COLUMN usufruct_holder_name      text;
ALTER TABLE snapshot_unit ADD COLUMN usufruct_has_agreement    boolean NOT NULL DEFAULT false;
ALTER TABLE snapshot_unit ADD COLUMN usufruct_agreement_summary text;

-- Eine Vereinbarung ohne Berechtigten wäre eine Angabe ohne Träger.
ALTER TABLE snapshot_unit ADD CONSTRAINT snapshot_unit_nutzniessung CHECK (
    usufruct_holder_name IS NOT NULL OR (usufruct_has_agreement = false AND usufruct_agreement_summary IS NULL)
);

COMMENT ON COLUMN snapshot_unit.usufruct_holder_name IS
    'Name des Nutzniessers, wie er bei der Freigabe galt. NULL heisst: keine Nutzniessung an dieser Einheit (FR-4, FR-22).';

COMMENT ON COLUMN snapshot_unit.usufruct_has_agreement IS
    'Ob eine Vereinbarung über die Ausübung des Stimmrechts besteht. Sie verdrängt die Auffangregel von ZGB Art. 712o Abs. 2 vollständig — dann bestimmt die Sitzungsleitung.';
