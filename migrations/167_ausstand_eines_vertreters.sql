-- 167 — Der Ausstand eines Vertreters, der nicht Eigentümer ist
--
-- **Der Anlass** (Block 3 der Freigabeliste, Ä-26; Produktentscheid
-- 17.10.2026: «In diesem Block bauen»). Bis hierher kannte der Ausstand nur
-- Parteien der Momentaufnahme (Migration 062). Vertritt die Verwaltung, die
-- nicht Eigentümerin ist, mehrere Eigentümer, und geht es um ihre eigene
-- Entschädigung, liess sich ihr Ausstand nicht erklären: Ihre Vollmachten
-- zählten voll.
--
-- **Die Grundlage ist eine Ableitung, keine wörtliche Stelle** (Fachprüfung
-- 17.10.2026). BGE 134 III 481 E. 3.8 schliesst einen ausgeschlossenen
-- Eigentümer auch als Vertreter aus und stützt sich dafür auf Art. 695 Abs. 1
-- OR. Bei der Entlastung trägt Art. 695 Abs. 1 OR («Personen, die in
-- irgendeiner Weise an der Geschäftsführung teilgenommen haben») mit Rz. 145
-- ad Art. 712q («weder selbst noch über einen Vertreter»), bei Verträgen mit
-- der Verwaltung E. 3.6 und 3.8 sinngemäss. Bei Wahl und Wiederwahl ruhen die
-- Vollmachten nicht (E. 3.5), bei der Abberufung nach überwiegender Lehre nicht
-- (Rz. 25 ad Art. 712r); Votum sagt das, sperrt aber nicht. Wie
-- beim Eigentümer wird der Ausstand erklärt, nicht hergeleitet: Die Leitung
-- entscheidet und begründet.
--
-- **In derselben Tabelle**, damit Zeilensperre, Siegelsperre (062),
-- Abgabesperre (117) und die Löschfristen (113, 115, 137) ohne weiteres Zutun
-- greifen. Eine Zeile trägt entweder eine Partei oder einen Vertreter, nie
-- beides.
--
-- **Der Vertreter heisst, wie die Vollmacht ihn nennt.** `holder_key` ist der
-- Schlüssel, unter dem Votum Vollmachten je Bevollmächtigtem zusammenzählt
-- (`vollmachtsschluessel` in `domain/vollmacht.ts`: NFC, Leerraum
-- zusammengezogen, klein); `holder_name` die Schreibweise für Anzeige und
-- Protokoll, eingefroren beim Erklären.

ALTER TABLE recusal ALTER COLUMN party_id DROP NOT NULL;
ALTER TABLE recusal ADD COLUMN holder_key text;
ALTER TABLE recusal ADD COLUMN holder_name text;

ALTER TABLE recusal ADD CONSTRAINT recusal_partei_oder_vertreter
    CHECK (
        (party_id IS NOT NULL AND holder_key IS NULL AND holder_name IS NULL)
        OR (party_id IS NULL
            AND length(btrim(coalesce(holder_key, ''))) > 0
            AND length(btrim(coalesce(holder_name, ''))) > 0)
    );

-- Zweimal derselbe Ausstand ist keiner, auch beim Vertreter (wie 062).
CREATE UNIQUE INDEX recusal_vertreter_einmal
    ON recusal (agenda_item_id, holder_key) WHERE holder_key IS NOT NULL;

COMMENT ON COLUMN recusal.party_id IS
    'Die Partei im Ausstand. NULL, wenn die Zeile einen Vertreter ohne Partei trägt (Migration 167).';
COMMENT ON COLUMN recusal.holder_key IS
    'Vertreter ohne Partei: Schlüssel wie vollmachtsschluessel(), gegen den Bevollmächtigtennamen der Vollmacht (Migration 167).';
COMMENT ON COLUMN recusal.holder_name IS
    'Vertreter ohne Partei: Name, wie er beim Erklären in der Vollmacht stand (Migration 167).';
