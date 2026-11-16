-- 117 — Eine Versammlung an ein anderes Gerät abgeben (Produktentscheid 18.09.2026)
--
-- **Der Anlass.** Eine Versammlung lässt sich seit Migration 061 von einem
-- Notebook im Saal wieder aufnehmen, aber nur als Nachweis: Es entsteht eine
-- Zeile in `imported_meeting` und keine `meeting`-Zeile. Damit hängt an einer
-- offline geführten Versammlung kein Protokoll, keine Genehmigung und kein
-- Fristenlauf, denn `minutes` und `minutes_version` zeigen per Fremdschlüssel
-- auf `meeting` (037). Wer offline führt, hätte seine Protokolle an zwei Orten.
--
-- **Der Weg: ausleihen statt einsammeln.** Die vorbereitete Versammlung wird
-- abgegeben und hier gesperrt; das Abschlusspaket kommt zu **seiner eigenen
-- Zeile** zurück. Die `meeting`-Zeile besteht die ganze Zeit, also hängt das
-- Protokoll daran wie bei jeder anderen Versammlung. Nachgebaut wird nichts:
-- Beschlüsse, Anwesenheit und Verlauf werden weiterhin aus dem Paket gelesen.
-- Die zwei Gründe aus Migration 061 bleiben damit unverletzt, denn sie
-- betreffen die versiegelten Zeilen und nicht die Hülle.
--
-- **Der Fund von aussen bleibt daneben bestehen.** Ein Paket ohne Vorbereitung
-- hier, etwa von einer anderen Verwaltung oder einem alten Gerät, wird wie
-- bisher als `imported_meeting` aufgenommen.
--
-- Entwurf und Begründung: `docs/plan-notebook-und-protokollzustellung-2026-09-18.md`.

-- ── Der Leihschein ────────────────────────────────────────────────────────
--
-- **Eine Zeile je Abgabe, nicht je Versammlung** (AD-5). Wird eine Versammlung
-- ein zweites Mal abgegeben, etwa weil das erste Notebook ausfiel, entsteht
-- eine neue Zeile. Sonst stünde am Schluss eine Rückgabe neben einer Abgabe,
-- die inzwischen eine andere ist.
CREATE TABLE meeting_handover (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),
    meeting_id  uuid NOT NULL,

    -- **An welches Gerät** (Migration 116, die Tabelle `handover_device`). Das Paket ist für dessen
    -- öffentlichen Schlüssel verschlüsselt, und die Rückgabe wird gegen dessen
    -- Unterschrift geprüft. Ein Schlüssel zum Abtippen steht deshalb nirgends
    -- hier: Es gibt keinen (Produktentscheid 18.09.2026).
    device_id   uuid NOT NULL REFERENCES handover_device (id),

    -- Wie das Gerät zum Zeitpunkt der Abgabe hiess. Der Name kann sich ändern
    -- oder das Gerät widerrufen werden; der Leihschein soll trotzdem lesbar
    -- bleiben, ohne dass jemand die Zeile daneben nachschlägt.
    device_note text,

    -- Das Vorbereitungspaket in der Dateiablage (AD-17: der Dateiname **ist**
    -- die Prüfsumme). Es liegt verschlüsselt dort; wer es ohne den Schlüssel
    -- liest, sieht nichts.
    package_checksum text NOT NULL,
    package_size     bigint NOT NULL,

    handed_over_at       timestamptz NOT NULL DEFAULT now(),
    handed_over_by       uuid REFERENCES app_user (id),
    handed_over_by_label text,

    -- ── Die Rückgabe ──────────────────────────────────────────────────────
    --
    -- `returned_seal` ist das Siegel des zurückgegebenen Abschlusspakets, also
    -- die Prüfsumme über dessen Manifest. Daran hängt später die Anzeige: Was
    -- im Saal beschlossen wurde, wird aus genau diesem Paket gelesen.
    returned_at       timestamptz,
    returned_by       uuid REFERENCES app_user (id),
    returned_by_label text,
    returned_seal     text,
    -- Die Unterschrift des Geräts über das Rückgabepaket. Sie ist der Nachweis,
    -- dass die Rückgabe von dem Gerät kommt, an das abgegeben wurde; geprüft
    -- wird sie gegen `handover_device.sig_public_key`.
    returned_signature text,
    -- Das Rückgabepaket als Ganzes. **Nicht dasselbe wie das Abschlusspaket:**
    -- Es enthält jenes unverändert und dazu den Nachtrag mit dem, was nicht
    -- unter dem Siegel steht (Protokollnotizen, Arbeitsfassung, Pendenzen).
    -- Käme nur das Abschlusspaket zurück, gingen die Notizen des Abends
    -- unbemerkt verloren: Das Siegel hielte, und das Protokoll wäre leer.
    returned_package  text,

    -- ── Der Notausstieg ───────────────────────────────────────────────────
    --
    -- Fällt das Notebook aus oder war die Abgabe ein Irrtum, nimmt eine
    -- bewusste Handlung sie zurück. Der Grund ist Pflicht: Eine aufgehobene
    -- Sperre ohne Begründung sähe später aus wie ein Fehler in der Anwendung.
    revoked_at       timestamptz,
    revoked_by       uuid REFERENCES app_user (id),
    revoked_by_label text,
    revoked_reason   text,

    CONSTRAINT handover_paket      CHECK (package_checksum ~ '^[0-9a-f]{64}$'),
    CONSTRAINT handover_groesse    CHECK (package_size > 0),
    CONSTRAINT handover_siegel     CHECK (returned_seal IS NULL OR returned_seal ~ '^[0-9a-f]{64}$'),
    CONSTRAINT handover_rueckpaket CHECK (returned_package IS NULL OR returned_package ~ '^[0-9a-f]{64}$'),

    -- Zurückgegeben heisst: mit Paket und Siegel. Eine Rückgabe ohne beides
    -- wäre eine Behauptung, und genau davon soll dieses Modell wegführen.
    CONSTRAINT handover_rueckgabe_belegt CHECK (
        returned_at IS NULL OR (returned_seal IS NOT NULL AND returned_package IS NOT NULL)
    ),
    CONSTRAINT handover_ruecknahme_begruendet CHECK (
        revoked_at IS NULL OR length(btrim(coalesce(revoked_reason, ''))) > 0
    ),
    -- Beides zugleich gibt es nicht: Entweder das Paket kam zurück, oder die
    -- Abgabe wurde ohne Paket aufgehoben.
    CONSTRAINT handover_ein_ausgang CHECK (returned_at IS NULL OR revoked_at IS NULL),

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id) ON DELETE CASCADE
);

-- **Höchstens eine offene Abgabe je Versammlung.** Zwei zugleich hiessen zwei
-- Geräte, die dieselbe Versammlung führen — genau der Zustand, gegen den dieses
-- Modell gebaut ist.
CREATE UNIQUE INDEX meeting_handover_offen_idx ON meeting_handover (meeting_id)
    WHERE returned_at IS NULL AND revoked_at IS NULL;

CREATE INDEX meeting_handover_versammlung_idx ON meeting_handover (meeting_id, handed_over_at DESC);

COMMENT ON TABLE meeting_handover IS
    'Leihschein: Eine Versammlung ist an ein anderes Gerät abgegeben und kehrt mit ihrem Abschlusspaket zurück.';

ALTER TABLE meeting_handover ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_handover FORCE  ROW LEVEL SECURITY;
CREATE POLICY meeting_handover_mandant ON meeting_handover
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE ON meeting_handover TO versammlung_app;

-- ── Die Sperre ────────────────────────────────────────────────────────────
--
-- **Warum in der Datenbank und nicht in der Anwendung.** Erhoben am 18.09.2026:
-- Es gibt in der Anwendung keinen einzigen Ort, durch den alle Schreibwege
-- einer Versammlung laufen. Die Zustandsregeln stehen an siebzehn Stellen
-- einzeln (`verlangeZustand`), dazu sechsmal ein eigener Helfer für «nur im
-- Entwurf», und rund hundertdreissig schreibende Aktionen verteilen sich auf
-- Einzelversammlung und gemeinsamen Abend. Die einzige zentrale Schranke im
-- Haus ist Migration 039.
--
-- Deshalb dasselbe Muster: ein Auslöser je Tabelle. Wer morgen einen neuen Weg
-- zum Schreiben baut, kommt hier vorbei, ob er will oder nicht.
CREATE OR REPLACE FUNCTION versammlung_abgegeben(kennung uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM meeting_handover
         WHERE meeting_id = kennung
           AND returned_at IS NULL
           AND revoked_at IS NULL
    )
$$;

-- **Ein eigener Fehlercode, `VO117`.** Die Absage muss den Benutzer lesbar
-- erreichen, und zwar auf allen Schreibwegen, nicht nur denen, an denen die
-- Oberfläche schon einen Knopf weggenommen hat. Übersetzt wird sie zentral in
-- `uebersetzeSchranke` (`src/lib/server/db.ts`); ohne eigenen Code müsste die
-- Anwendung dafür auf den Wortlaut dieser Meldung prüfen, und der erste
-- umformulierte Satz liesse die Übersetzung still ins Leere laufen.
--
-- `VO117` ist zulässig: fünf Zeichen aus Ziffern und Grossbuchstaben, und die
-- Klasse «VO» ist keine der von PostgreSQL vergebenen.
CREATE OR REPLACE FUNCTION verhindere_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    kennung := COALESCE(NEW.meeting_id, OLD.meeting_id);
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «%» würde eine zweite Fassung erzeugen.',
            TG_OP, TG_TABLE_NAME
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER attendance_event_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON attendance_event
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER proxy_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON proxy
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER voting_round_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON voting_round
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER agenda_item_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER meeting_access_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON meeting_access
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

-- Die Momentaufnahme wie in 039. Sie verschwindet, wenn jemand die Freigabe
-- zurücknimmt, und das liefe über `meeting.state` ohnehin in den Auslöser
-- darunter. Hier steht sie trotzdem: Lieber eine Schranke zu viel als eine Tür,
-- die erst auffällt, wenn jemand einen neuen Weg dorthin baut.
CREATE TRIGGER snapshot_party_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON snapshot_party
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

-- Die Stimme kennt die Versammlung nur über ihren Durchgang, wie in 039.
CREATE OR REPLACE FUNCTION vote_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM voting_round
     WHERE id = COALESCE(NEW.round_id, OLD.round_id);
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «vote» würde eine zweite Fassung erzeugen.',
            TG_OP
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER vote_bei_abgabe_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON vote
    FOR EACH ROW EXECUTE FUNCTION vote_bei_abgabe();

-- **Die Versammlung selbst.** Solange sie unterwegs ist, ändert sich hier
-- nichts: kein Eröffnen, kein Schliessen, keine Angaben, keine Betriebsart.
--
-- **Die Rückgabe kommt trotzdem durch**, und zwar ohne Ausnahme im Auslöser:
-- Sie trägt zuerst `returned_at` in den Leihschein ein und setzt danach den
-- Zustand. Innerhalb derselben Transaktion sieht `versammlung_abgegeben` den
-- neuen Stand, die Sperre ist dann bereits gefallen. Eine Ausnahme nach
-- Spaltennamen wäre hier die schlechtere Lösung: Sie müsste bei jeder neuen
-- Spalte nachgeführt werden.
CREATE OR REPLACE FUNCTION meeting_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF versammlung_abgegeben(COALESCE(NEW.id, OLD.id)) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben und wird hier erst nach der Rückgabe wieder geändert.'
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER meeting_bei_abgabe_trigger
    BEFORE UPDATE OR DELETE ON meeting
    FOR EACH ROW EXECUTE FUNCTION meeting_bei_abgabe();

-- **Das Protokoll wird mitgesperrt**, anders als beim Siegel. Dort ist es
-- ausgenommen, weil es nach der Sitzung entsteht und redigiert wird. Hier ist
-- die Lage umgekehrt: Die Notizen entstehen im Saal, auf dem anderen Gerät.
-- Wer hier gleichzeitig schriebe, hätte zwei Fassungen, und die Rückgabe müsste
-- eine davon verwerfen.
CREATE OR REPLACE FUNCTION minutes_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF versammlung_abgegeben(COALESCE(NEW.meeting_id, OLD.meeting_id)) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. Das Protokoll entsteht dort und kommt mit der Rückgabe.'
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER minutes_bei_abgabe_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON minutes
    FOR EACH ROW EXECUTE FUNCTION minutes_bei_abgabe();

-- Dasselbe für die festgehaltenen Fassungen. Ändern und Löschen verbietet dort
-- schon Migration 037; offen bliebe das Einfügen, und eine Fassung, die hier
-- entsteht, während der Text auf dem anderen Gerät geschrieben wird, wäre der
-- Abzug eines leeren Blattes.
CREATE TRIGGER minutes_version_bei_abgabe_trigger
    BEFORE INSERT ON minutes_version
    FOR EACH ROW EXECUTE FUNCTION minutes_bei_abgabe();


-- ── Und alles Übrige, was im Paket mitreist ───────────────────────────────
--
-- **Erhoben am 18.09.2026, zweite Runde des Code-Reviews.** Die Liste oben war
-- aus Migration 039 übernommen, und das war der Fehler: 039 schützt den
-- **Nachweis** nach dem Siegel, 117 schützt die **Ausleihe**. Die Risikomenge
-- ist eine andere — sie ist genau das, was `vorbereitungspaket.ts` einpackt.
-- Verglichen ergab das acht Tabellen ohne Sperre, und bei dreien führt ein
-- offener Weg hin:
--
--   * `instruction` — `halteWeisungFest` prüft den Zustand überhaupt nicht.
--   * `recusal` — `erklaereAusstand` lässt «freigegeben» ausdrücklich zu.
--   * `proxy_recommendation` — der Eigentümerweg über den QR-Link schreibt sie,
--     und der steht vor der Versammlung offen.
--
-- Die übrigen fünf haben heute keinen erreichbaren Weg; sie stehen trotzdem
-- hier. Dieselbe Begründung wie bei `snapshot_party` weiter oben: Lieber eine
-- Schranke zu viel als eine Tür, die erst auffällt, wenn jemand einen neuen Weg
-- dorthin baut. Und genau das ist zwischen 039 und 117 passiert.

CREATE TRIGGER instruction_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON instruction
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER recusal_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON recusal
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER snapshot_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON snapshot
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

CREATE TRIGGER snapshot_unit_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON snapshot_unit
    FOR EACH ROW EXECUTE FUNCTION verhindere_bei_abgabe();

-- Was am Traktandum hängt, kennt die Versammlung nur über dieses — dasselbe
-- Verhältnis wie bei `vote` und seinem Durchgang.
CREATE OR REPLACE FUNCTION agenda_anhang_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM agenda_item
     WHERE id = COALESCE(NEW.agenda_item_id, OLD.agenda_item_id);
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «%» würde eine zweite Fassung erzeugen.',
            TG_OP, TG_TABLE_NAME
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER agenda_item_affected_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON agenda_item_affected
    FOR EACH ROW EXECUTE FUNCTION agenda_anhang_bei_abgabe();

CREATE TRIGGER agenda_item_proposer_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON agenda_item_proposer
    FOR EACH ROW EXECUTE FUNCTION agenda_anhang_bei_abgabe();

-- Die Weisung an der Vollmacht kennt die Versammlung über die Vollmacht.
CREATE OR REPLACE FUNCTION proxy_anhang_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM proxy
     WHERE id = COALESCE(NEW.proxy_id, OLD.proxy_id);
    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an «proxy_recommendation» würde eine zweite Fassung erzeugen.',
            TG_OP
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER proxy_recommendation_bei_abgabe
    BEFORE INSERT OR UPDATE OR DELETE ON proxy_recommendation
    FOR EACH ROW EXECUTE FUNCTION proxy_anhang_bei_abgabe();

-- **Die Unterlagen, und nur die der Versammlung.** `attachment` hängt an vier
-- Gegenständen; drei davon gehören zur Versammlung, `usufruct` gehört der
-- Gemeinschaft. Die Nutzniessung ist deshalb ausgenommen: Sie reist zwar im
-- Paket mit, aber sie besteht unabhängig vom Abend, und eine Sperre darauf
-- hielte die Bewirtschaftung von Arbeit ab, die mit der Ausleihe nichts zu tun
-- hat.
CREATE OR REPLACE FUNCTION attachment_bei_abgabe() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    art  text;
    ziel uuid;
    kennung uuid;
BEGIN
    art  := COALESCE(NEW.subject_type, OLD.subject_type);
    ziel := COALESCE(NEW.subject_id, OLD.subject_id);

    IF art = 'meeting' THEN
        kennung := ziel;
    ELSIF art = 'agenda_item' THEN
        SELECT meeting_id INTO kennung FROM agenda_item WHERE id = ziel;
    ELSIF art = 'proxy' THEN
        SELECT meeting_id INTO kennung FROM proxy WHERE id = ziel;
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF versammlung_abgegeben(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist an ein anderes Gerät abgegeben. % an einer Unterlage würde eine zweite Fassung erzeugen.',
            TG_OP
            USING ERRCODE = 'VO117';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER attachment_bei_abgabe_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON attachment
    FOR EACH ROW EXECUTE FUNCTION attachment_bei_abgabe();

GRANT EXECUTE ON FUNCTION versammlung_abgegeben(uuid) TO versammlung_app;
