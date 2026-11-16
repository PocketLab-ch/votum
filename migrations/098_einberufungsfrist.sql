-- Die Einberufungsfrist wird je Gemeinschaft hinterlegbar
-- (Praxisdurchlauf 28.08.2026: «Im Reglement [des Auftraggebers] sind es 30 Tage»).
--
-- **Warum sie nicht im Code stehen kann.** Das ZGB nennt keine Frist für die
-- Einladung zur Stockwerkeigentümerversammlung. Sie steht im Reglement, und
-- dort steht je Haus etwas anderes: zehn Tage, zwanzig, dreissig. Eine
-- Vorgabezahl in der Anwendung wäre keine Erleichterung, sondern eine
-- Behauptung über fremdes Recht — und sie stünde still im Weg, sobald jemand
-- sich darauf verlässt.
--
-- **NULL heisst «nicht hinterlegt», nicht «keine Frist».** Es gibt fast immer
-- eine; die Anwendung kennt sie nur nicht. Deshalb rechnet sie ohne Zahl auch
-- nichts aus, warnt nicht und erinnert nicht — sie sagt an der Stelle, an der
-- es zählt, dass die Angabe fehlt.
--
-- **Mit Fundstelle, wie bei der Zählweise und der Vollmachtschranke.** Wer den
-- Beschluss anficht, greift zuerst die Einberufung an (ZGB Art. 712m Abs. 2
-- i.V.m. Art. 75). Dann muss dastehen, woraus sich die Frist ergibt.
ALTER TABLE stweg ADD COLUMN invitation_lead_days   integer;
ALTER TABLE stweg ADD COLUMN invitation_lead_source text;

-- Die Obergrenze ist keine Rechtsfrage, sondern eine Tippfehlerbremse: 365
-- Tage sind ein Jahr, und eine Frist darüber hinaus ist keine Frist mehr.
ALTER TABLE stweg ADD CONSTRAINT stweg_einberufungsfrist
    CHECK (invitation_lead_days IS NULL OR invitation_lead_days BETWEEN 1 AND 365);

ALTER TABLE stweg ADD CONSTRAINT stweg_einberufungsfrist_fundstelle
    CHECK (invitation_lead_days IS NULL
           OR length(btrim(coalesce(invitation_lead_source, ''))) >= 3);

COMMENT ON COLUMN stweg.invitation_lead_days IS
    'Einberufungsfrist in Tagen nach Reglement. NULL heisst: nicht hinterlegt — es wird nichts gerechnet und nichts erinnert.';
COMMENT ON COLUMN stweg.invitation_lead_source IS
    'Wo die Frist im Reglement steht. Pflicht, sobald eine Zahl steht.';
