-- 173 — Das Mehr aus Gesetz und Reglement, wo die Leitung davon abgewichen ist
--
-- **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), Block 6, mit Entscheid 0023,
-- Anhang A: Nach der Auszählung nennt Votum der Leitung, was nach dem Mehr aus
-- Gesetz und Reglement herausgekommen wäre, wenn das gezählte Mehr davon
-- abweicht, etwa weil die Einladung strenger angesetzt hat (Entscheid 0007)
-- oder die Leitung milder gewählt hat. Eine Beschlussfassung mit ungültigem
-- Mehr führt zu einem anfechtbaren Beschluss (SVIT-Kommentar Rz. 100 ad
-- Art. 712n).
--
-- **Warum eine Spalte und keine Neuherleitung.** Die Momentaufnahme friert die
-- Regeln des Reglements nicht ein. Beim Auszählen neu hergeleitet, rechnete das
-- zweite Ergebnis nach einem später geänderten Reglement. Abgelegt wird
-- deshalb das Mass des Vorschlags zur Zeit der Wahl (`uebersteuere`).
--
-- Nur für die Leitung: Protokoll und Auswertung nennen es nicht, weil eine
-- Abweichung der Leitung vom Vorschlag nach dem Produktentscheid vom 30.09.2026
-- nur im Verlauf steht (Produktentscheid 21.10.2026, Entscheid 0023).
--
-- Beim Eröffnen geht es mit dem übrigen Erfordernis in
-- `voting_round.requirement_json`. NULL, wo die Leitung nicht abgewichen ist,
-- und bei jedem Traktandum von vorher: Dort nennt Votum kein Ergebnis danach.
ALTER TABLE agenda_item ADD COLUMN requirement_statutory jsonb;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_mehr_nach_gesetz_form
    -- Jedes Glied mit `IS TRUE`, wie bei `agenda_item_lesart_form` (Migration
    -- 169): Ein fehlender Schlüssel ergäbe sonst NULL, und ein CHECK mit NULL
    -- gilt als erfüllt.
    CHECK (requirement_statutory IS NULL OR (
        (jsonb_typeof(requirement_statutory) = 'object') IS TRUE
        AND (jsonb_typeof(requirement_statutory->'typ') = 'string') IS TRUE
        -- Nur ein Mehr, nach dem sich zählen lässt (`gesetzesmassZaehlbar`).
        AND (requirement_statutory->>'typ' NOT IN ('grenzfall', 'keine_abstimmung')) IS TRUE
        AND (jsonb_typeof(requirement_statutory->'kopfSchwelle') = 'object') IS TRUE
        AND (jsonb_typeof(requirement_statutory->'kopfbasis') = 'string') IS TRUE
        AND (jsonb_typeof(requirement_statutory->'quotenbasis') = 'string') IS TRUE
        AND (jsonb_typeof(requirement_statutory->'zustimmungBetroffenerNoetig') = 'boolean') IS TRUE
    ));
