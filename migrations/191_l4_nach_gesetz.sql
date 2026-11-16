-- 191: Lesart L4 nach dem Gesetz, Vorgabe «qualifiziert», mitgezogen, wer nie gewählt hat
--
-- **Der Anlass** ist Entscheid 0048 (`docs/entscheide/0048-regel-43-runde-2.md`),
-- Punkte 1 und 2. Art. 647b Abs. 1 ZGB nennt die Bestellung eines Verwalters,
-- dessen Zuständigkeit nicht auf gewöhnliche Verwaltungshandlungen beschränkt
-- ist, ausdrücklich bei den Geschäften mit qualifiziertem Mehr. Der
-- SVIT-Kommentar und ein Teil der Lehre lassen das einfache Mehr genügen, weil
-- im Stockwerkeigentum Art. 712q ff. vorgingen (Rz. 46 ad Art. 712q, Rz. 112 ad
-- Art. 712a); ein Entscheid des Bundesgerichts dazu ist uns nicht bekannt.
-- Produktentscheid 13.11.2026: «Vorgabe nach Gesetz» und «Mitziehen, wer nie
-- gewählt hat»; die Texte sagen «nach dem Wortlaut» (Laien- und Fachprüfung,
-- `quellen/pruefung/berichte/2026-11-13-votum-regel43-block-b-*`).
--
--   reading_l4  qualifiziert  qualifiziertes Mehr nach Art. 647b Abs. 1, Köpfe
--                             unter den Anwesenden und Vertretenen, dazu mehr
--                             als die Hälfte aller Wertquoten (Vorgabe ab
--                             dieser Migration und der Fassung 2026-11-13)
--               einfach       einfaches Mehr der Anwesenden und Vertretenen
--                             nach dem SVIT-Kommentar (bis hier die Vorgabe,
--                             Migration 169, Entscheid 0018)
--
-- Migration 169 bleibt eingefroren (AD-14); diese Datei ändert nur die Vorgabe
-- und den Kommentar der Spalte und zieht die Gemeinschaften nach.

ALTER TABLE stweg ALTER COLUMN reading_l4 SET DEFAULT 'qualifiziert';

COMMENT ON COLUMN stweg.reading_l4 IS
    'Lesart L4, Wahl der Bewirtschaftung mit erweiterten Kompetenzen: qualifiziert (Vorgabe nach Gesetz, ZGB Art. 647b Abs. 1; Entscheid 0048, Migration 191) oder einfach (SVIT-Kommentar Rz. 46 ad Art. 712q).';

-- ── Wer nie gewählt hat, zieht mit ──────────────────────────────────────────
--
-- **Woran «nie gewählt» erkannt wird.** Am Verlauf, nicht am Wert: Bis hier
-- stand jede Gemeinschaft ohne Eingriff auf «einfach», und wer «einfach» bewusst
-- gewählt hat, steht dort auch. Wer die Lesart L4 je umgestellt hat, hat einen
-- Eintrag `bylaw.reading.set` (`EREIGNISARTEN.lesartGesetzt`) mit
-- `detail->>'lesart' = 'L4'` (`speichereLesarten` in `src/lib/server/lesarten.ts`).
-- Steht die Gemeinschaft heute auf «einfach» und hat einen solchen Eintrag, hat
-- sie das selbst so eingestellt, auch über den Umweg «qualifiziert» und zurück;
-- sie bleibt. Ohne Eintrag stand sie nur auf der alten Vorgabe und bekommt die
-- neue. Ein Eintrag zu einer anderen Lesart zählt nicht.
--
-- **Je Gemeinschaft ein Eintrag im Verlauf**, mit derselben Ereignisart und
-- denselben Angaben wie ein Umstellen auf der Seite «Lesarten» (`lesart`,
-- `frage`, `vorher`, `nachher`; `vorher` und `nachher` in Worten, wie sie dort
-- stehen), dazu der Grund. Die Seite zeigt ihn deshalb als letzte Änderung an
-- L4, aber nur mit Handelndem und Zeit; der Grund steht im Verlauf, nicht auf
-- der Seite. Der Handelnde ist als Votum erkennbar: kein Benutzer, keine Rolle,
-- dafür «Votum, neue Vorgabe». Im selben Befehl wie die
-- Änderung, damit es keine Änderung ohne Eintrag gibt und keinen Eintrag
-- ohne Änderung.
--
-- **Ein Eintrag unter dem Betreiber der Gemeinschaft**, wie jeder Eintrag zu
-- ihr. Der Wächter aus Migration 177 sieht nur die eigene Kennung der
-- Gemeinschaft, also nichts Fremdes.
--
-- **Die Momentaufnahmen bleiben** (`snapshot.reading_l4`): Freigegebenes rechnet
-- nach der Wahl, die bei der Freigabe galt, und nach seiner Fassung. Auch die
-- Erfordernisse an den Traktanden bleiben: Ein Entwurf mit einem Traktandum
-- zur Wahl mit erweiterten Kompetenzen, dessen Gemeinschaft hier nachzieht,
-- rechnet weiter das einfache Mehr seines Knotens; die Freigabe sagt ab, bis
-- die Verwaltung die Erfordernisse nachzieht (`veralteteLesartenIn`,
-- `erfordernisseNachziehen`).
--
-- **Die Spalte `updated_at` geht mit** (Auslöser `stweg_updated_at`, Migration
-- 004): Die Gemeinschaft ist geändert worden, und der Verlauf sagt, von wem.
WITH nachgezogen AS (
    UPDATE stweg s
       SET reading_l4 = 'qualifiziert'
     WHERE s.reading_l4 = 'einfach'
       AND NOT EXISTS (
           SELECT 1 FROM audit_entry e
            WHERE e.subject_type = 'stweg'
              AND e.subject_id = s.id::text
              AND e.event_type = 'bylaw.reading.set'
              AND e.detail->>'lesart' = 'L4'
       )
    RETURNING s.id, s.operator_id
)
INSERT INTO audit_entry (operator_id, actor_user_id, actor_label, event_type, subject_type, subject_id, detail)
SELECT n.operator_id,
       NULL,
       'Votum, neue Vorgabe',
       'bylaw.reading.set',
       'stweg',
       n.id::text,
       jsonb_build_object(
           'lesart', 'L4',
           'frage', 'Welches Mehr braucht die Wahl einer Bewirtschaftung, die schon Kompetenzen über die gewöhnliche Verwaltung hinaus hat?',
           'vorher', 'Einfaches Mehr',
           'nachher', 'Qualifiziertes Mehr (Vorgabe)',
           'grund', 'Votum hat seine Standardeinstellung angepasst; das Gesetz hat sich nicht geändert. Für die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen rechnet Votum neu mit dem qualifizierten Mehr, wie es Art. 647b Abs. 1 ZGB nach seinem Wortlaut verlangt. Ob das im Stockwerkeigentum nötig ist, ist umstritten. Ihre Gemeinschaft hatte diese Einstellung nie geändert und steht deshalb jetzt darauf. Schon freigegebene Traktanden rechnen weiter nach dem einfachen Mehr; früher festgestellte Ergebnisse ändert Votum nicht. Auf der Seite «Lesarten» steht, was die beiden Wahlen bewirken; dort können Sie wieder das einfache Mehr einstellen.'
       )
  FROM nachgezogen n;
