-- 148 — Das mildere Mehr nach der Freigabe: aufmerksam machen statt sperren
--
-- **Produktentscheide 07.10.2026** (Auftrag
-- `.auftraege/2026-10-07-votum-aufmerksam-statt-sperren.md`; Begründung und
-- Wortlaut in `src/lib/domain/einladungsmehr.ts`). Wortlaut des Auftraggebers:
-- «Grundsätzlich muss das Tool nicht den Empfang sicherstellen sondern die
-- Traktanden erstellen. [...] Das Tool soll nur darauf aufmerksam machen.»
--
--   - «Nur noch aufmerksam machen»: Nach einer Milderung vor Beginn gilt das
--     mildere Mehr, sobald es gesetzt ist. Beim Eröffnen fällt es nicht mehr
--     auf die erste Einladung zurück (nimmt «Erste Einladung gilt» vom
--     06.10.2026 zurück). Der Versandvermerk steuert nur noch Hinweis,
--     Erinnerung und Verlauf.
--   - Ob ein milderes Mehr nach Ablauf der Einberufungsfrist noch gesetzt
--     werden kann, ist eine Einstellung an der Gemeinschaft.
--
-- **Keine Daten umgeschrieben.** Die Spalten aus 144 bleiben, wie sie sind;
-- nur ihre Kommentare sagen jetzt, was sie seit heute bedeuten. Die Sperre ab
-- der Eröffnung (144) bleibt unverändert: Im Saal ist das gedruckte Mehr die
-- Untergrenze, strenger geht, milder nicht (Produktentscheid 27.09.2026).

-- ── Die Einstellung an der Gemeinschaft ────────────────────────────────────
--
-- **Vorgabe «nicht zulassen»**, die bisherige Absage `versandfrist_vorbei`.
-- Die Einberufung ist empfangsbedürftig; die Frist ist nur eingehalten, wenn
-- die Einladung innert Frist angekommen ist (SVIT-Kommentar Rz. 30 ad
-- Art. 712n). Nach dem letzten Tag kann eine berichtigte Einladung nicht mehr
-- rechtzeitig ankommen. Das Recht verlangt die Absage nicht (eine zu späte
-- Einladung macht eher anfechtbar als nichtig, Rz. 66 und 68 ad Art. 712n);
-- sie ist die sichere Lesart. Mehrere zulässige Varianten werden hier eine
-- Einstellung, mit der besten Praxis als Vorgabe.
--
-- Geschrieben über einen eigenen Weg (`speichereMilderungNachFrist`), wie
-- `revote_after_quorum` (139), damit das Angabenformular der Gemeinschaft sie
-- nicht mitlöscht. Rechte und Zeilenschutz erbt die Spalte von `stweg`.
ALTER TABLE stweg
    ADD COLUMN relax_after_invitation_deadline boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN stweg.relax_after_invitation_deadline IS
    'Ob das Mehr eines Traktandums nach Ablauf der erfassten Einberufungsfrist noch milder gestellt werden kann: false = nicht zulassen (Vorgabe, Absage versandfrist_vorbei), true = zulassen, die Anwendung weist auf die Anfechtbarkeit hin. Ohne erfasste Frist ohne Wirkung (Migration 148).';

-- ── Die Spaltenkommentare aus 144 sprachen von einer Pflicht ───────────────
COMMENT ON COLUMN agenda_item.released_requirement_relaxed_at IS
    'Wann das Mehr zuletzt nach der Freigabe gemildert wurde. Solange danach kein Versand vermerkt ist, weist Votum auf die berichtigte Einladung hin; das mildere Mehr gilt trotzdem (Migration 148). Bleibt nach dem Eröffnen als Spur stehen; daran hängt die Warnung im Saal.';
COMMENT ON COLUMN agenda_item.released_requirement_before IS
    'Das Mehr der Einladung vor einer Milderung, solange nach ihr kein Versand vermerkt ist. Wird das Mehr vorher wieder darauf oder strenger gestellt, kehrt die Untergrenze dorthin zurück. Beim Eröffnen geleert, ohne Rückfall; der Verlauf hält es fest (Migration 148).';
