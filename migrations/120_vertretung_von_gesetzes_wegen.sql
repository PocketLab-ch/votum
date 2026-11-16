-- 120 — Wer von Gesetzes wegen vertritt, zählt nicht zur Höchstzahl
--
-- **Der Anlass** (Ä-28 der Zweitprüfung vom 17.09.2026, Produktentscheid vom
-- 24.09.2026). Seit Migration 036 kann eine Gemeinschaft die Höchstzahl der
-- Vollmachten je Person hinterlegen, die ihr Reglement vorsieht. Seit dem
-- 24.09.2026 sperrt die Anwendung beim Erfassen, wenn sie überschritten würde.
--
-- Die Zweitprüfung hält dazu fest: «Organvertreter juristischer Personen,
-- gesetzliche Vertreter und Mitberechtigte zählen **nicht** zur Höchstzahl.»
-- Ohne diese Spalte zählt die Sperre sie mit und weist eine rechtlich
-- einwandfreie Vertretung ab, ohne dass es einen Weg daran vorbei gäbe.
--
-- **Warum das kein zweites Begründungsfeld ist.** Der Befund R-2b hat am
-- 23.09.2026 ein Feld entfernt, das freien Text entgegennahm und damit eine
-- Prüfung abschaltete. Hier werden drei **Tatsachen** erfasst, die zutreffen
-- oder nicht, jede mit eigener Rechtsgrundlage. Wer einen falschen Wert wählt,
-- benutzt keinen vorgesehenen Weg, sondern macht eine Falschangabe. Die Werte
-- stehen deshalb in einer Schranke und nicht in einem Textfeld.
--
-- **Die drei Werte:**
--
--   organ         Organ einer juristischen Person, das für sie handelt
--                 (Verwaltungsrat, Geschäftsführung). Es vertritt nicht
--                 kraft Vollmacht, sondern ist die Eigentümerin im Handeln.
--   gesetzlich    Gesetzliche Vertretung: Beistand, Vormund, Inhaber der
--                 elterlichen Sorge.
--   mitberechtigt Mitberechtigte an derselben Einheit, die nach ZGB
--                 Art. 712o Abs. 1 ohnehin nur eine Stimme führen.
--
-- `NULL` heisst: gewöhnliche Vollmacht, zählt zur Höchstzahl. Das ist der
-- Normalfall und deshalb die Vorgabe.
--
-- **Ohne Vorgabewert und ohne Rückwirkung.** Bestehende Zeilen bleiben `NULL`
-- und damit gewöhnliche Vollmachten. Eine Umdeutung des Bestands wäre eine
-- rechtliche Aussage über Vorgänge, die niemand mehr prüfen kann.

ALTER TABLE proxy ADD COLUMN representation_basis text;

ALTER TABLE proxy ADD CONSTRAINT proxy_vertretungsgrund
    CHECK (representation_basis IS NULL
           OR representation_basis IN ('organ', 'gesetzlich', 'mitberechtigt'));

COMMENT ON COLUMN proxy.representation_basis IS
    'Vertritt diese Person von Gesetzes wegen statt kraft Vollmacht? Dann zählt '
    'sie nicht zur Höchstzahl des Reglements (Ä-28, Migration 120). NULL = '
    'gewöhnliche Vollmacht.';
