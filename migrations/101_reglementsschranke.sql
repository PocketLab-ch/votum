-- Das Reglement kann fuer seine eigene Aenderung Einstimmigkeit verlangen
-- (Auftraggeber, 28.08.2026: «Option Merkmal einstimmig vereinbart einbauen»;
--  Entscheid vom 01.09.2026: an der Gemeinschaft, nicht je Regel).
--
-- **Den Fall gibt es im Regelwerk laengst** — `k-reglement-eigene-schranke`
-- mit dem Verhalten `gesperrt_reglement`: Wo das Reglement seine eigene
-- Aenderung an Einstimmigkeit bindet, darf keine hinterlegte Abweichung sie
-- mildern. Was fehlte, ist die Dauerhaftigkeit: Bis heute musste die Frage bei
-- **jedem** Traktandum neu beantwortet werden, und wer sie nicht kannte,
-- beantwortete sie falsch.
--
-- **Warum an der Gemeinschaft und nicht an der einzelnen Regel.** Beides waere
-- vertretbar (ZGB Art. 712g Abs. 3 kennt die einstimmige Vereinbarung als
-- eigenen Rang). Die Schranke des Reglements ueber sich selbst ist aber die
-- Eigenschaft des Reglements, nicht einer Bestimmung darin — sie steht dort in
-- einem Artikel und gilt fuer alles. Das Merkmal je Regel bliebe als zweiter
-- Schritt moeglich; es braucht eine Verbindung zwischen Regel und Traktandum,
-- die es heute nicht gibt.
--
-- **Mit Fundstelle**, wie die Zaehlweise, die Vollmachtschranke und die
-- Einberufungsfrist: Wer den Beschluss anficht, greift zuerst das Quorum an.
ALTER TABLE stweg ADD COLUMN bylaw_amendment_unanimous boolean NOT NULL DEFAULT false;
ALTER TABLE stweg ADD COLUMN bylaw_amendment_source    text;

ALTER TABLE stweg ADD CONSTRAINT stweg_reglementsschranke_fundstelle
    CHECK (NOT bylaw_amendment_unanimous
           OR length(btrim(coalesce(bylaw_amendment_source, ''))) >= 3);

COMMENT ON COLUMN stweg.bylaw_amendment_unanimous IS
    'Ob das Reglement fuer seine eigene Aenderung Einstimmigkeit verlangt. Vorgabe: nein — dann gilt das gesetzliche Mehr.';
COMMENT ON COLUMN stweg.bylaw_amendment_source IS
    'Wo diese Schranke im Reglement steht. Pflicht, sobald sie gesetzt ist.';
