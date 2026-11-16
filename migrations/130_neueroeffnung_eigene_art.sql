-- 130 — Die Neueröffnung nach einem Weggang bekommt eine eigene Überholungsart
--
-- Auftrag `.auftraege/2026-09-29-votum-ueberholungsart-neueroeffnung.md`,
-- Herkunft `docs/freigabe.md`, Zeile «Offen: Reste zur Universalversammlung»,
-- Punkt 6.
--
-- **Der Anlass.** Wird ein Durchgang ohne Beschluss neu eröffnet, weil jemand
-- während der Abstimmung gegangen war, überholte ihn `oeffneAbstimmung` mit
-- `korrektur` — derselben Art wie eine von der Leitung angesetzte
-- Neuabstimmung. Am Bestand liess sich damit nicht unterscheiden, ob die
-- Versammlung nie einen Beschluss gefasst hat oder ob die Leitung einen
-- fehlerhaften Durchgang ersetzt hat; die Auswertung las `korrektur` als
-- «Neuabstimmung angesetzt».
--
-- **Was hier geschieht.** Die Art `neueroeffnung` kommt dazu, und die bereits
-- so entstandenen Durchgänge werden umgestellt. Erkannt werden sie an ihrem
-- Grund: Er wird an genau einer Stelle erzeugt (`oeffneAbstimmung`), steht
-- vollständig im Klartext und wird nie nachträglich geändert. Die früheren
-- Migrationen 045 und 047 bleiben, wie sie sind (eingespielt, AD-14).

ALTER TABLE voting_round DROP CONSTRAINT voting_round_ersetzungsart;

ALTER TABLE voting_round ADD CONSTRAINT voting_round_ersetzungsart CHECK (
    supersede_kind IS NULL
    OR supersede_kind IN ('korrektur', 'neueroeffnung', 'rueckkommen', 'rueckkommen_erfolglos')
);

UPDATE voting_round
   SET supersede_kind = 'neueroeffnung'
 WHERE supersede_kind = 'korrektur'
   AND superseded_at IS NOT NULL
   AND supersede_reason LIKE 'Kein Beschluss, weil jemand während der Abstimmung gegangen ist%';

COMMENT ON COLUMN voting_round.supersede_kind IS
    'Warum überholt: korrektur = die Leitung hat eine Neuabstimmung angesetzt (etwa weil der '
    'Durchgang fehlerhaft war); neueroeffnung = nach einem Weggang ohne Beschluss neu eröffnet, '
    'sobald wieder alle da waren; rueckkommen = durch den Beschluss nach Rückkommen ersetzt; '
    'rueckkommen_erfolglos = Rückkommen ohne neuen Beschluss, der frühere gilt.';
