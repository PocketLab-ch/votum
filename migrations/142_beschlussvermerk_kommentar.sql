-- 142 — Der Kommentar zu `agenda_item.minute_decision` nennt die volle Wirkung
--
-- Auftrag `.auftraege/2026-10-04-votum-entschiedene-und-nachzuege.md`, B4.
--
-- **Der Anlass.** Migration 135 (Block 7) beschrieb den Beschlussvermerk mit
-- seiner damaligen Wirkung: Ersetzt im Protokoll den Satz «Über diesen Antrag
-- wurde nicht abgestimmt.» und lässt den Punkt am gemeinsamen Abend nicht als
-- Lücke zählen. Seit Block 7b/7c (02.10.2026) trägt er weiter: Die Auswertung
-- führt ihn als «von Hand abgestimmt» statt «ohne Abstimmung», Tafel und
-- Ablaufleiste zählen den Punkt nicht mehr als offen, und das Abschlussbild der
-- Wand zählt ihn unter «von Hand abgestimmt». Die Spalte wirkt damit auf alle
-- Leser, nicht nur auf die zwei Protokolle.
--
-- **Was sie nicht kann.** Der Stand ist keine Zahl und kein Ausgang; das
-- Abschlusspaket friert ihn beim Versiegeln ein (bewusst, siehe `docs/freigabe.md`,
-- Zeile «Gebaut: Beschlussvermerk, Leser nachgezogen (Block 7b)», Punkt (a)).
--
-- Migration 135 ist eingespielt und bleibt, wie sie ist (AD-14); geändert wird
-- allein ihr Kommentar, damit die Datenbank denselben Stand beschreibt wie der
-- Code.

COMMENT ON COLUMN agenda_item.minute_decision IS
    'Der Text im Votenfeld ist der Beschluss, den Votum nicht führt (Block 7). Im Protokoll ersetzt er den Satz «Über diesen Antrag wurde nicht abgestimmt.»; am gemeinsamen Abend hält er den Punkt aus der Lücke und damit die Unterschrift nicht auf. Seit Block 7b/7c zählt die Auswertung ihn als «von Hand abgestimmt» statt «ohne Abstimmung», Tafel und Ablaufleiste zählen den Punkt nicht mehr als offen, und das Abschlussbild der Wand führt ihn unter «von Hand abgestimmt». Kein Ergebnis und keine Zahl; das Abschlusspaket friert den Stand beim Versiegeln ein.';
