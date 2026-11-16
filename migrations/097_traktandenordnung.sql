-- Die Reihenfolge der Standardtraktanden wird je Gemeinschaft speicherbar
-- (Praxisdurchlauf 28.08.2026, Block C2).
--
-- **Warum eine Tabelle.** Die Vorlagen selbst liegen als Daten im Code
-- (`src/lib/domain/traktandenvorlage.ts`, AD-4) — ihre Reihenfolge ist bis
-- hierher die Reihenfolge in dieser Datei. Eine Gemeinschaft, deren Ablauf
-- anders aussieht, musste sie bei jeder neuen Versammlung von Hand
-- umsortieren.
--
-- **Warum Zeilen und keine JSON-Spalte an `stweg`.** Zwei UNIQUE-Bedingungen
-- machen die Ordnung sofort konsistent: kein Schlüssel doppelt, keine Stelle
-- doppelt besetzt. Eine Liste als JSON liesse sich weder einschränken noch
-- je Änderung nachvollziehen.
--
-- **Keine Zeile ist eine gültige Antwort.** Sie heisst: die Code-Reihenfolge
-- gilt. Das Rücksetzen löscht die Zeilen, statt eine Kopie der
-- Code-Reihenfolge zu speichern — sonst wäre «zurücksetzen» von «exakt so
-- speichern, wie es gerade dasteht» nicht mehr unterscheidbar.
--
-- **Was die Ordnung NICHT antastet.** Bestehende Versammlungen behalten ihre
-- Positionen: Sie stehen auf Einladungen und im Protokoll. Die Ordnung gilt
-- nur beim Anlegen neuer Versammlungen (`legePflichttraktandenAn`) und beim
-- Aufnehmen fehlender Muster am gemeinsamen Abend (`uebernimmMuster`).
--
-- Aufbau und Zeilenschutz sind von `bylaw_instruction_rule` (Migration 085)
-- abgelesen, nicht aus dem Gedächtnis nachgebaut: derselbe zusammengesetzte
-- Fremdschlüssel, dasselbe RLS mit Mandantenvergleich.

CREATE TABLE agenda_template_order (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id       uuid NOT NULL REFERENCES operator (id),
    stweg_id          uuid NOT NULL,
    position          integer NOT NULL CHECK (position > 0),
    template_key      text NOT NULL,
    updated_at        timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),

    -- Kein Schlüssel doppelt, keine Stelle doppelt besetzt.
    CONSTRAINT agenda_template_order_je_schluessel UNIQUE (stweg_id, template_key),
    CONSTRAINT agenda_template_order_je_position UNIQUE (stweg_id, position)
);

CREATE INDEX agenda_template_order_stweg ON agenda_template_order (stweg_id);

ALTER TABLE agenda_template_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_template_order FORCE  ROW LEVEL SECURITY;

-- Wortgleich zu den übrigen Tabellen: Vergleich als TEXT, nicht mit `::uuid`.
-- Ist die Sitzungsvariable leer, liefert der Vergleich NULL und die Zeile
-- bleibt verborgen; ein Cast auf uuid würfe stattdessen einen Fehler.
CREATE POLICY agenda_template_order_mandant ON agenda_template_order
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON agenda_template_order TO versammlung_app;

COMMENT ON TABLE agenda_template_order IS
    'Die gespeicherte Reihenfolge der Standardtraktanden je Gemeinschaft. '
    'Keine Zeile heisst: die Code-Reihenfolge gilt. Wirkt nur beim Anlegen '
    'neuer Versammlungen.';
