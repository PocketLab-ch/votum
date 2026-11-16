-- 052 — Welche Stufe geantwortet hat (FR-63)
--
-- **Der Anbieter ist Konfiguration, nicht Programm** (Vorgabe des Auftraggebers vom
-- 05.08.2026). Wird die Anwendung öffentlich, soll jeder Betreiber selbst
-- entscheiden, welches Modell er befragt — Infomaniak, Mistral, ein lokales
-- Modell im eigenen Haus. Das Werkzeug schreibt nichts vor.
--
-- Genau deshalb muss im Nachweis stehen, **wer** geantwortet hat. Ein Vermerk
-- «maschinell vorbereitet» ohne Angabe des Hauses wäre im Streitfall wertlos:
-- Ob der Text in der Schweiz, in Frankreich oder auf dem Notebook im Keller
-- entstanden ist, macht für die Frage der Datenbearbeitung den Unterschied.
--
-- Die Bezeichnung kommt aus der Konfiguration und nicht aus einer Liste im
-- Code: Nur der Betreiber weiss, wo sein Modell steht.
ALTER TABLE ai_usage ADD COLUMN provider text;
ALTER TABLE ai_usage ADD COLUMN model text;
-- Die wievielte Stufe der Kette geantwortet hat. 1 = die erste; höher heisst,
-- dass davor etwas ausgefallen ist.
ALTER TABLE ai_usage ADD COLUMN stage integer;

COMMENT ON COLUMN ai_usage.provider IS
    'Bezeichnung der Stufe, die geantwortet hat — aus der Konfiguration des Betreibers (FR-63).';

COMMENT ON COLUMN ai_usage.stage IS
    'Welche Stufe der Ausweichkette geantwortet hat. Höher als 1 heisst: davor ist etwas ausgefallen.';
