-- Enthaltungen beim einfachen Mehr, eine Einstellung der ganzen Gemeinschaft
-- (Auftrag 07.10.2026, «votum-enthaltung-einfaches-mehr»; Produktentscheid
-- 07.10.2026: «Jetzt bauen.»).
--
-- Viele Reglemente sagen einmal für alle Abstimmungen mit einfachem Mehr, dass
-- nur die gültig abgegebenen Stimmen zählen (Rz. 186 ad Art. 712m: «keine
-- Berücksichtigung von Enthaltungen und nichtigen Stimmen»). Bis hierher ging
-- das nur je Geschäftsart über eine Reglementsregel (`bylaw_quorum_rule.abstention_counts`),
-- also vierzehnmal mit abgeschriebener Schwelle.
--
-- Die Einstellung wirkt nicht beim Zählen, sondern beim Herleiten des
-- Erfordernisses (`wendeReglementAn`): Das Erfordernis ist der Nachweis der
-- Rechnung und wird am Traktandum gespeichert. Ein Traktandum, dessen
-- Erfordernis vor dem Einschalten gespeichert wurde, rechnet deshalb weiter wie
-- bisher, bis es auf der Reglementsseite nachgezogen wird.
--
-- Die Fundstelle ist Pflicht: Die Einführung der Klausel muss einstimmig sein
-- (Rz. 186, wörtlich), und Votum kann das nicht prüfen.

ALTER TABLE stweg ADD COLUMN abstention_excluded boolean NOT NULL DEFAULT false;
ALTER TABLE stweg ADD COLUMN abstention_excluded_source text;

ALTER TABLE stweg ADD CONSTRAINT stweg_enthaltung_mit_fundstelle
    CHECK (NOT abstention_excluded OR length(btrim(coalesce(abstention_excluded_source, ''))) >= 3);

COMMENT ON COLUMN stweg.abstention_excluded IS
    'Beim einfachen Mehr der Anwesenden fallen Enthaltungen aus der Bezugsgrösse, soweit keine Reglementsregel der Geschäftsart gilt; nicht bei Abberufung der Bewirtschaftung und Wertquotenänderung (Migration 151, wendeReglementAn).';
COMMENT ON COLUMN stweg.abstention_excluded_source IS
    'Fundstelle der Klausel im Reglement; Pflicht, solange abstention_excluded gesetzt ist.';
