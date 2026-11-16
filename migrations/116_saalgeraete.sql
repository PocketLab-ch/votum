-- 116 — Saalgeräte: das Notebook, an das eine Versammlung abgegeben wird
--
-- **Der Anlass** (Produktentscheid 18.09.2026). Das Vorbereitungspaket trägt
-- Namen, Adressen und die Prüfwerte der ausgegebenen Zugangscodes. Es reist auf
-- einem Stick oder über eine Leitung, also gehört es verschlüsselt. Ein
-- Schlüssel, den jemand abtippt, ist dabei der Handgriff, den man je Abgabe
-- vergisst; ein Schlüssel, der im Paket liegt, ist gar keiner.
--
-- **Deshalb wird das Gerät registriert, nicht der Schlüssel übergeben.** Das
-- Notebook erzeugt einmal ein Schlüsselpaar und zeigt den öffentlichen Teil.
-- Wer abgibt, trägt ihn hier ein; ab dann wird jedes Paket für genau dieses
-- Gerät verschlüsselt. Der geheime Teil verlässt das Notebook nie, und ein
-- verlorener Stick gibt nichts preis.
--
-- Zwei Paare, weil ein Verfahren nicht beides kann:
--
--   * **X25519** zum Verschlüsseln. Die abgebende Seite erzeugt ein flüchtiges
--     Paar, rechnet daraus mit dem Gerätepaar ein gemeinsames Geheimnis und
--     legt ihren flüchtigen öffentlichen Teil in den Paketkopf.
--   * **Ed25519** zum Unterschreiben. Damit weist das Gerät später die Rückgabe
--     nach, ohne dass beide Seiten ein gemeinsames Geheimnis teilen müssten.
--
-- Entwurf: `docs/plan-notebook-und-protokollzustellung-2026-09-18.md`.

CREATE TABLE handover_device (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),

    -- Wie das Gerät im Haus genannt wird: «Notebook Saal», «Laptop Saal 2».
    name text NOT NULL,

    -- Die öffentlichen Teile, in base64url wie sie das Gerät anzeigt. Sie sind
    -- öffentlich; hier stehen sie, damit die Abgabe für sie verschlüsseln und
    -- die Rückgabe gegen sie prüfen kann.
    enc_public_key text NOT NULL,
    sig_public_key text NOT NULL,

    -- Der Fingerabdruck über beide, zum Vergleichen von Auge: Wer den Code
    -- eintippt, sieht danach dieselben Zeichen wie auf dem Notebook. Ein
    -- vertauschtes Gerät fällt so auf, bevor das erste Paket entsteht.
    fingerprint text NOT NULL,

    registered_at       timestamptz NOT NULL DEFAULT now(),
    registered_by       uuid REFERENCES app_user (id),
    registered_by_label text,
    last_used_at        timestamptz,

    -- **Widerrufen statt löschen** (AD-5). Ein Gerät, das verloren ging, bleibt
    -- als Zeile stehen: Die Abgaben, die dorthin gingen, verweisen darauf, und
    -- ohne die Zeile stünde im Leihschein eine Kennung ohne Namen.
    revoked_at     timestamptz,
    revoked_by     uuid REFERENCES app_user (id),
    revoked_reason text,

    CONSTRAINT device_name CHECK (length(btrim(name)) > 0),
    CONSTRAINT device_enc  CHECK (enc_public_key ~ '^[A-Za-z0-9_-]{40,120}$'),
    CONSTRAINT device_sig  CHECK (sig_public_key ~ '^[A-Za-z0-9_-]{40,120}$'),
    CONSTRAINT device_finger CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT device_widerruf CHECK (
        revoked_at IS NULL OR length(btrim(coalesce(revoked_reason, ''))) > 0
    ),

    -- Dasselbe Gerät zweimal einzutragen ergäbe zwei Namen für einen
    -- Empfänger, und bei der Rückgabe wüsste niemand, welcher gemeint war.
    UNIQUE (operator_id, fingerprint)
);

CREATE INDEX handover_device_offen_idx ON handover_device (operator_id, registered_at DESC)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE handover_device IS
    'Registrierte Saalgeräte: öffentliche Schlüssel, für die ein Vorbereitungspaket verschlüsselt wird.';

ALTER TABLE handover_device ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_device FORCE  ROW LEVEL SECURITY;
CREATE POLICY handover_device_mandant ON handover_device
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE ON handover_device TO versammlung_app;

-- ── Die andere Seite: der eigene Schlüssel dieses Geräts ──────────────────
--
-- Dieselbe Anwendung läuft auf beiden Seiten. Auf dem Notebook hält sie ihr
-- eigenes Paar, und zwar genau eines: Zwei wären zwei Identitäten, und welche
-- gerade gilt, wüsste niemand.
--
-- **Der geheime Teil liegt verschlüsselt** (dasselbe Muster wie bei den
-- Zugangsschlüsseln der Dienste, Migration 064): AES-256-GCM, das Geheimnis
-- steht in `VERSAMMLUNG_GEHEIMNIS` und damit in der Umgebung, nicht in der
-- Datenbank. Wer einen Datenbankauszug findet, hat noch keinen Schlüssel.
CREATE TABLE device_identity (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    -- **Ohne Betreiberbezug, mit Absicht.** Die Identität gehört dem Gerät und
    -- nicht einem Mandanten: Dasselbe Notebook kann für mehrere Gemeinschaften
    -- desselben Hauses im Saal stehen.
    name text NOT NULL,

    enc_public_key  text NOT NULL,
    enc_secret_key  text NOT NULL,
    sig_public_key  text NOT NULL,
    sig_secret_key  text NOT NULL,
    fingerprint     text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT identity_finger CHECK (fingerprint ~ '^[0-9a-f]{64}$')
);

-- Genau eine Identität je Anwendung.
CREATE UNIQUE INDEX device_identity_eine_idx ON device_identity ((true));

COMMENT ON TABLE device_identity IS
    'Das eigene Schlüsselpaar dieser Anwendung als Saalgerät; der geheime Teil liegt verschlüsselt (VERSAMMLUNG_GEHEIMNIS).';

-- **Kein Zeilenschutz, und die Anwendung liest auch den geheimen Teil.** Sie
-- muss es: Ohne ihn liesse sich kein Paket öffnen und keine Rückgabe
-- unterschreiben. Der Schutz liegt deshalb nicht im Recht, sondern in der
-- Verschlüsselung mit dem Geheimnis aus der Umgebung. Geschützt ist damit der
-- Weg über die Datenbank allein, also der Weg, über den solche Schlüssel
-- tatsächlich abhandenkommen (siehe `src/lib/server/tresor.ts`).
--
-- Eine Mandantenregel gibt es hier nicht, weil die Tabelle keinen Betreiber
-- trägt: Dasselbe Notebook steht für mehrere Gemeinschaften desselben Hauses im
-- Saal.
GRANT SELECT, INSERT ON device_identity TO versammlung_app;
