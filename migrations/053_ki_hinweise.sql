-- 053 — KI-Hinweise ausblenden (Welle 3, Nachtrag zu FR-62)
--
-- **Das Problem, das dahintersteckt.** Die KI-Abschnitte stehen an vier Stellen:
-- am Traktandum, beim Mehrheitserfordernis, in der Sitzungsleitung und beim
-- Protokoll. Ist die KI nicht zugelassen — die Vorgabe —, zeigen sie einen
-- grauen Kasten mit dem Grund. Das ist beim ersten Mal eine Auskunft und ab dem
-- zehnten Mal Gerümpel: Wer keine KI will, liest an vier Stellen dauerhaft,
-- warum er sie nicht hat.
--
-- **Am Betreiber, nicht an der Gemeinschaft.** Ob überhaupt ein Modell
-- eingerichtet ist, entscheidet der Betrieb der Anlage, nicht die einzelne
-- Gemeinschaft — und wer dreissig Gemeinschaften führt, will das einmal setzen
-- und nicht dreissigmal. Die Zulassung je Gemeinschaft (`stweg.ai_enabled`)
-- bleibt davon unberührt: Sie entscheidet, ob etwas geschieht; diese Angabe nur,
-- ob davon die Rede ist.
--
-- **Ausgeblendet ist nicht abgeschaltet.** Die Angabe verändert keine Schranke.
-- Wo die KI zugelassen ist, bleiben die Abschnitte sichtbar — sonst versteckte
-- ein Anzeigeschalter eine Funktion, die läuft.
ALTER TABLE operator
    ADD COLUMN ai_hints_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN operator.ai_hints_hidden IS
    'Ob die Hinweise auf nicht verfügbare KI-Funktionen ausgeblendet werden. Reine Anzeigeeinstellung — Schranken bleiben, wie sie sind (FR-62).';
