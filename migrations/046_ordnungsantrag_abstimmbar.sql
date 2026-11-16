-- 046 — Der Ordnungsantrag darf zur Abstimmung (Welle 3, FR-44)
--
-- Nachtrag zu Migration 045: Die Schranke aus Migration 032 kannte den
-- Rückkommensantrag noch nicht und wies ihn ab. Eigene Migration, weil 045
-- bereits gelaufen ist — was einmal ausgeführt wurde, wird nicht verändert
-- (AD-14).

-- ── Die Schranke aus Migration 032, um den Ordnungsantrag erweitert ────────
--
-- Migration 032 hält fest: Über ein **nicht angekündigtes Geschäft** kann nicht
-- Beschluss gefasst werden, auch nicht mit Zustimmung der Versammlung (ZGB
-- Art. 712n Abs. 2 i.V.m. Art. 67 Abs. 3). Geschützt ist der Abwesende, der auf
-- die versandte Liste vertraut hat. Erlaubt war deshalb nur der Folgeantrag.
--
-- **Der Rückkommensantrag ist kein neues Geschäft.** Sein Gegenstand stand auf
-- der Liste und ist bereits behandelt worden; beschlossen wird allein, **ob
-- nochmals** darüber beraten wird. Der Abwesende konnte sich auf genau diesen
-- Gegenstand einstellen — er hat ihn angekündigt bekommen.
--
-- Was sich dadurch **nicht** ändert: Über die Sache selbst wird erst nach dem
-- angenommenen Rückkommen abgestimmt, und zwar am ursprünglichen, angekündigten
-- Traktandum mit dessen Erfordernis. Sachfremdes bleibt ausgeschlossen.
ALTER TABLE agenda_item DROP CONSTRAINT agenda_neu_nur_kenntnisnahme;

ALTER TABLE agenda_item ADD CONSTRAINT agenda_neu_nur_kenntnisnahme CHECK (
    is_spontaneous = false
    OR spontaneous_kind IN ('folgeantrag', 'rueckkommen')
    OR item_kind = 'kenntnisnahme'
) NOT VALID;

COMMENT ON COLUMN agenda_item.spontaneous_kind IS
    'Bei einem während der Sitzung aufgenommenen Traktandum: folgeantrag (im Kern '
    'des angekündigten Grundantrags, Abstimmung zulässig), rueckkommen '
    '(Ordnungsantrag zu einem behandelten Traktandum, Abstimmung zulässig) oder '
    'neu (nicht angekündigt, nur als Kenntnisnahme). NULL bei angekündigten '
    'Traktanden.';
