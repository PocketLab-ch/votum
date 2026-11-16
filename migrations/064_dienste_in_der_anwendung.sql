-- Äussere Dienste in der Anwendung einrichten (14.08.2026).
--
-- **Warum das nicht in der Umgebung bleiben konnte.** KI-Kette und
-- Zeitstempeldienst standen ausschliesslich in Umgebungsvariablen. Wer das
-- Modell wechseln wollte, brauchte Zugriff auf den Server, eine Änderung an
-- der `.env` und einen Neustart des Containers — und der Neustart trifft alle,
-- auch eine laufende Versammlung.
--
-- Schwerer wog die Anheftung des Zeitstempelzertifikats: Sie ist die
-- eigentliche Sicherung gegen einen untergeschobenen Stempel, verlangte aber,
-- den SHA-256-Fingerabdruck von Hand zu beschaffen und in eine Datei auf dem
-- Server zu schreiben. Was so umständlich ist, wird nicht gemacht — und dann
-- nimmt die Anwendung jede Antwort an, die unter der eingestellten Adresse
-- ausgeliefert wird.
--
-- **Die Umgebung bleibt gültig.** Sie ist der Rückfall für alle bestehenden
-- Anlagen und für den unbeaufsichtigten Aufbau (Notebook im Versammlungsraum,
-- Prüfstände). Steht hier nichts, gilt sie unverändert weiter; steht hier
-- etwas, hat es Vorrang — sonst liesse sich in der Oberfläche nichts ändern,
-- solange die Umgebung etwas trägt.

-- ── Die KI-Kette ────────────────────────────────────────────────────────────

CREATE TABLE ai_stage (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),

    -- Die Reihenfolge der Kette: 1 wird zuerst gefragt, 2 ist die Ausweichung.
    -- Anders als bei der Umgebung beendet hier keine Lücke die Kette — die
    -- Zeilen werden sortiert gelesen, eine gelöschte Stufe 1 macht Stufe 2 zur
    -- ersten. Ein Tippfehler in einer Zahl kann deshalb keine Stufe
    -- verschlucken.
    position    int NOT NULL CHECK (position >= 1 AND position <= 9),

    -- Steht später im Nachweis und im Protokollvermerk. Was ein Leser wissen
    -- muss, insbesondere den Standort — die Anwendung kann ihn nicht kennen.
    name        text NOT NULL CHECK (length(btrim(name)) >= 2),
    url         text NOT NULL CHECK (url ~ '^https?://'),
    model       text NOT NULL CHECK (length(btrim(model)) >= 1),

    -- **Verschlüsselt, nie im Klartext** (AES-256-GCM, siehe server/tresor.ts).
    -- Ein Datenbankauszug ist damit für sich genommen wertlos; der Schlüssel
    -- steht in der Umgebung und wird getrennt gesichert. NULL heisst: kein
    -- Schlüssel nötig, etwa bei einem Modell im eigenen Haus.
    api_key_enc text,

    patience_ms int NOT NULL DEFAULT 12000 CHECK (patience_ms BETWEEN 1000 AND 120000),

    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    -- Zwei Stufen mit derselben Nummer wären eine Kette ohne Reihenfolge.
    UNIQUE (operator_id, position)
);

ALTER TABLE ai_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_stage FORCE  ROW LEVEL SECURITY;
CREATE POLICY ai_stage_mandant ON ai_stage
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_stage TO versammlung_app;

COMMENT ON TABLE ai_stage IS
    'Die KI-Kette je Betreiber. Hat Vorrang vor VERSAMMLUNG_KI_*; ist sie leer, gilt die Umgebung.';
COMMENT ON COLUMN ai_stage.api_key_enc IS
    'AES-256-GCM, base64. Nie im Klartext ablegen — der Schlüssel steht in VERSAMMLUNG_GEHEIMNIS.';

-- ── Der Zeitstempeldienst ───────────────────────────────────────────────────
--
-- Ein Dienst je Betreiber, deshalb Spalten und keine eigene Tabelle.

ALTER TABLE operator
    ADD COLUMN tsa_url          text,
    ADD COLUMN tsa_name         text,
    -- Zugelassene Fingerabdrücke (SHA-256) der Signaturzertifikate, durch
    -- Komma getrennt. Leer heisst: Die Signatur wird geprüft, aber nicht, wer
    -- sie geleistet hat — das steht dann sichtbar am Siegel.
    ADD COLUMN tsa_fingerprints text;

ALTER TABLE operator
    ADD CONSTRAINT operator_tsa_url CHECK (tsa_url IS NULL OR tsa_url ~ '^https?://');

COMMENT ON COLUMN operator.tsa_url IS
    'Zeitstempeldienst nach RFC 3161. Hat Vorrang vor VERSAMMLUNG_ZEITSTEMPEL_URL.';
COMMENT ON COLUMN operator.tsa_fingerprints IS
    'SHA-256-Fingerabdrücke der zugelassenen Signaturzertifikate, kommagetrennt. Ohne sie wird jede Antwort unter dieser Adresse angenommen.';
