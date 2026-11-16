-- 140 — Der Kommentar zu `nachquorum_erfolglos` nennt auch die Ablehnung
--
-- Die Fachprüfung der Sätze vom 03.10.2026 (`quellen`, Frage 59) hat geklärt:
-- Im direkten Weg ersetzt **nur ein angenommener** zweiter Beschluss den von
-- Hand festgehaltenen (Rz. 202a ad Art. 712g); eine Ablehnung und ein
-- Durchgang ohne Beschluss lassen ihn in Kraft (Rz. 207 ad Art. 712m). Der
-- Rückkommensweg ist anders, weil dort schon der Rückkommensbeschluss der
-- Widerruf mit dem erforderlichen Mehr ist («Nein heisst Nein»).
--
-- Migration 139 ist eingespielt und bleibt, wie sie ist (AD-14); geändert wird
-- allein ihr Kommentar, damit die Datenbank denselben Stand beschreibt wie der
-- Code.
COMMENT ON COLUMN voting_round.supersede_kind IS
    'Warum überholt: korrektur = die Leitung hat eine Neuabstimmung angesetzt (etwa weil der '
    'Durchgang fehlerhaft war); neueroeffnung = nach einem Weggang ohne Beschluss neu eröffnet, '
    'sobald wieder alle da waren; rueckkommen = durch den Beschluss nach Rückkommen ersetzt; '
    'rueckkommen_erfolglos = Rückkommen ohne neuen Beschluss, der frühere gilt; '
    'notweg = durch einen von der Sitzungsleitung von Hand festgehaltenen Beschluss überholt; '
    'nachquorum = durch den angenommenen zweiten Durchgang nach Eintritt der Beschlussfähigkeit '
    'ersetzt; nachquorum_erfolglos = dieser Durchgang nach Eintritt der Beschlussfähigkeit wurde '
    'abgelehnt oder endete ohne Beschluss, der frühere Beschluss von Hand bleibt in Kraft.';
