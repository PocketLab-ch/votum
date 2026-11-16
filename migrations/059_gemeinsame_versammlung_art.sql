-- Die gemeinsame Versammlung führt ihre Art selbst.
--
-- **Warum.** Ob ordentlich oder ausserordentlich, gilt für den Anlass und nicht
-- für ein einzelnes Haus: Sechs Gemeinschaften, die am selben Abend zusammen
-- tagen, tun das aus demselben Grund. Bis zum 11.08.2026 stand die Art nur an
-- jeder einzelnen Versammlung, und wer sie ändern wollte, tippte sie sechsmal.
-- Gemeldet: «Das müsste vorher angegeben werden und auf alle umgelegt werden.»
--
-- **Die Spalte ist die Vorgabe, nicht die Wahrheit.** Massgebend bleibt, was an
-- der einzelnen Versammlung steht — sie geht in Einladung und Protokoll. Diese
-- Spalte hält fest, was zuletzt für alle gewählt wurde, und die Angabenseite
-- legt es auf die Versammlungen um, die noch im Entwurf sind. Eine freigegebene
-- bleibt, wie sie ist, und wird dabei genannt.

ALTER TABLE meeting_day
    ADD COLUMN kind     text NOT NULL DEFAULT 'ordentlich',
    ADD COLUMN occasion text;

ALTER TABLE meeting_day
    ADD CONSTRAINT meeting_day_art CHECK (kind IN ('ordentlich', 'ausserordentlich')),
    -- Derselbe Zusammenhang wie an der Versammlung: Der Anlass gehört zur
    -- ausserordentlichen und hat bei der ordentlichen nichts zu suchen.
    ADD CONSTRAINT meeting_day_anlass CHECK (
        (kind = 'ausserordentlich' AND occasion IS NOT NULL AND length(btrim(occasion)) > 0)
        OR (kind = 'ordentlich' AND occasion IS NULL)
    );

-- Bestehende gemeinsame Versammlungen erben die Art ihrer Teilnehmerinnen,
-- soweit die sich einig sind. Wo sie es nicht sind, bleibt 'ordentlich' stehen
-- — die Spalte ist eine Vorgabe für das nächste Mal, kein Urteil über das,
-- was schon in den Einladungen steht.
UPDATE meeting_day d
   SET kind = 'ausserordentlich',
       occasion = COALESCE(
           (SELECT min(m.occasion) FROM meeting m
             WHERE m.meeting_day_id = d.id AND m.occasion IS NOT NULL),
           'Nicht erfasst')
 WHERE EXISTS (SELECT 1 FROM meeting m WHERE m.meeting_day_id = d.id)
   AND NOT EXISTS (
       SELECT 1 FROM meeting m
        WHERE m.meeting_day_id = d.id AND m.kind <> 'ausserordentlich'
   );
