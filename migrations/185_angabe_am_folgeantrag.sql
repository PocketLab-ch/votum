-- 185 — L8: die Angabe der Sitzungsleitung an einem Folgeantrag mit Häkchen
--
-- **Der Anlass** ist Entscheid 0045, Punkt 11 (Produktentscheid 08.11.2026,
-- auf die Fragen Fach R8-2, Fach R7-2 und Featureprüfung 2, M1). Ein
-- Folgeantrag erbt das Häkchen «Geschäft der Verwaltung» seines Grundantrags
-- (Entscheid 0045, Punkt 5), und unter «Vollmachten ruhen» ruhen dort die
-- Vollmachten der Verwaltung. In zwei Lagen nach Punkt 9 träfe das die
-- Falschen:
--
--   andere_verwaltung  Am Grundantrag ist ein Folgeantrag zur Wahl
--                      angenommen, und dieser Folgeantrag betrifft eine
--                      andere als die bisherige Verwaltung, etwa die
--                      Entschädigung der Gewählten. Nach Art. 68 ZGB gibt es
--                      dafür keinen Ausschlussgrund; nicht gezählte Stimmen
--                      machten den Beschluss anfechtbar (BGer 5A_972/2020
--                      E. 7.2.4).
--   kuendigung         Am Grundantrag ist ein Folgeantrag zur Abberufung
--                      nicht angenommen, und dieser Folgeantrag betrifft die
--                      Kündigung des Vertrags. Wie bei der Abberufung ruht
--                      dort nichts von selbst (Folgerung aus Rz. 25b ad
--                      Art. 712r).
--
-- Mit der Angabe ruhen die Vollmachten der Verwaltung an diesem Folgeantrag
-- nicht von selbst; sie zählen, bis die Sitzungsleitung ihren Ausstand
-- erklärt (`recusal`). Die Schranken (nur unter «Vollmachten ruhen», nicht an
-- Wahl und Abberufung, vor dem ersten Durchgang, nur wenn der Folgeantrag zur
-- Wahl oder Abberufung entschieden ist wie verlangt) stehen im Code
-- (`server/verwaltungsangabe.ts`): Sie hängen an der eingefrorenen Lesart,
-- an Knoten des Regelwerks und an Ergebnissen, nicht an dieser Zeile.
--
-- Hier steht nur, was die Zeile selbst wahr halten kann: zwei Werte, und nur
-- an einem Folgeantrag mit Häkchen. Nach dem Siegel ändert sie ohnehin
-- niemand mehr (`agenda_item_nach_siegel`).
ALTER TABLE agenda_item ADD COLUMN management_exemption text NULL;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_verwaltungsangabe_werte
    CHECK (management_exemption IS NULL
           OR management_exemption IN ('andere_verwaltung', 'kuendigung'));
-- `coalesce`, weil `spontaneous_kind` an angekündigten Traktanden NULL ist und
-- ein CHECK, der NULL ergibt, als erfüllt gilt: Ohne ihn liesse die Schranke
-- die Angabe an jedem Grundantrag mit Häkchen zu (gefunden beim Bau).
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_verwaltungsangabe_nur_folgeantrag
    CHECK (management_exemption IS NULL
           OR (coalesce(spontaneous_kind = 'folgeantrag', false) AND concerns_management));

COMMENT ON COLUMN agenda_item.management_exemption IS
    'Angabe der Sitzungsleitung an einem Folgeantrag mit Häkchen (Entscheid 0045, Punkt 11; Migration 185): andere_verwaltung oder kuendigung. Gesetzt ruhen die Vollmachten der Verwaltung dort nicht von selbst.';
