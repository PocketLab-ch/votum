-- Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt, wird je
-- Gemeinschaft hinterlegbar (Auftrag «Erneuerungsfonds im Regelwerk und
-- Obergrenze aus dem Reglement», 15.11.2026; Produktentscheid «Frage im Finder
-- und Eintrag»).
--
-- **Warum die Art und nicht ein Betrag.** Die Grenze steht in Einheiten, die
-- von Haus zu Haus wechseln: Prozent des Versicherungswerts, Franken je
-- Einheit, Franken gesamt. Der Betrag eines Antrags steht als Text im Antrag,
-- nicht in einem Feld. Ein Vergleich in der Anwendung hätte also nichts, womit
-- er vergleichen könnte. Entscheidend für das Mehr ist die Art der Bestimmung:
--
--   fest             eine Obergrenze, die nicht überschritten werden darf;
--                    darüber das Mehr einer Reglementsänderung
--   in_der_regel     eine Obergrenze, die nur «in der Regel» gilt; darüber
--                    offen, sicher mit dem Mehr einer Reglementsänderung
--   mindest          eine Mindesteinlage oder ein Stand, ab dem die
--                    Einzahlungen ruhen; wer davon abweicht, braucht das Mehr
--                    einer Reglementsänderung
--   hoehe_anpassbar  eine Höhe oder Grenze, die die Versammlung ohne
--                    besonderes Mehr anpassen darf; einfaches Mehr
--   hoehe_fest       eine feste Höhe ohne dieses Recht; ihre Änderung braucht
--                    das Mehr einer Reglementsänderung
--
-- Die Anwendung zeigt die hinterlegte Bestimmung an der Frage im Finder und an
-- den Karten zum Erneuerungsfonds. Sie wählt keine Antwort und rechnet nichts
-- daraus; die Leitung liest den Antrag und wählt.
--
-- **NULL heisst «nicht hinterlegt».** Dann verhält sich alles wie ohne diese
-- Spalten.
--
-- **Mit Fundstelle, wie bei der Einberufungsfrist** (098): Wer den Beschluss
-- anficht, fragt, woraus sich das Mehr ergab.
ALTER TABLE stweg ADD COLUMN renewal_fund_limit_kind   text;
ALTER TABLE stweg ADD COLUMN renewal_fund_limit_text   text;
ALTER TABLE stweg ADD COLUMN renewal_fund_limit_source text;

ALTER TABLE stweg ADD CONSTRAINT stweg_fondsgrenze_art
    CHECK (renewal_fund_limit_kind IS NULL
           OR renewal_fund_limit_kind IN ('fest', 'in_der_regel', 'mindest', 'hoehe_anpassbar', 'hoehe_fest'));

-- Ganz oder gar nicht: Ohne Art kein Wortlaut und keine Fundstelle, die nichts
-- mehr belegen; mit Art beides, mindestens drei Zeichen.
ALTER TABLE stweg ADD CONSTRAINT stweg_fondsgrenze_vollstaendig
    CHECK ((renewal_fund_limit_kind IS NULL
            AND renewal_fund_limit_text IS NULL
            AND renewal_fund_limit_source IS NULL)
           OR (renewal_fund_limit_kind IS NOT NULL
               AND length(btrim(coalesce(renewal_fund_limit_text, ''))) >= 3
               AND length(btrim(coalesce(renewal_fund_limit_source, ''))) >= 3));

COMMENT ON COLUMN stweg.renewal_fund_limit_kind IS
    'Art der Bestimmung des Reglements zur Höhe der Einlage in den Erneuerungsfonds: fest, in_der_regel, mindest, hoehe_anpassbar, hoehe_fest. NULL heisst: nicht hinterlegt.';
COMMENT ON COLUMN stweg.renewal_fund_limit_text IS
    'Der Wortlaut der Bestimmung, wie er im Reglement steht. Pflicht, sobald eine Art steht.';
COMMENT ON COLUMN stweg.renewal_fund_limit_source IS
    'Wo die Bestimmung im Reglement steht. Pflicht, sobald eine Art steht.';
