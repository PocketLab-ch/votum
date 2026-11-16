-- Stimmabgabe auf Papier, je Partei und je Versammlung.
--
-- **Der Anlass** (Auftraggeber, 08.09.2026): «kann man nicht ein Feld machen, Parteien
-- wollen/können nicht digital abstimmen mit Auswahl der Parteien und pro
-- Traktandum überträgt die Sitzungsleitung die Stimme. Das müsste in der
-- Versammlung voreingestellt werden oder beim Checkin.»
--
-- Bisher kannte die Anwendung nur zwei Lagen. Entweder die ganze Versammlung
-- läuft in der Betriebsart «einfach», dann trägt die Sitzungsleitung alle
-- Stimmen ein; oder sie läuft «gefuehrt», dann stimmt jede Partei selbst, und
-- wer für eine andere einträgt, muss bei JEDEM Traktandum einen Grund tippen.
-- Der wirkliche Fall liegt dazwischen: Von vierzehn Parteien wollen drei nicht
-- digital abstimmen. Für die elf anderen wäre «einfach» ein Rückschritt, und
-- den drei Nichtdigitalen dreissigmal «hat kein Telefon» hinzuschreiben ist
-- kein Nachweis, sondern Tipparbeit.
--
-- **Was der Vermerk NICHT ist:** keine Ausnahme und kein Ausfall. Der Ausfall
-- steht schon da (Begründung an der einzelnen Stimme, «Telefon abgestürzt»).
-- Hier geht es um eine vorher getroffene Abmachung: Diese Partei stimmt an
-- dieser Versammlung auf Papier ab, und ihre Stimmzettel sind der Beleg. Genau
-- deshalb entfällt die Begründung je Stimme, wie sie in «einfach» entfällt: Es
-- ist das vereinbarte Verfahren und kein Eingriff.
--
-- **Warum an `snapshot_party` und nicht an `party`.** Die Abmachung gilt je
-- Versammlung, nicht auf Dauer (Auftraggeber, 08.09.2026: «Die Dauer, der Erklärung pro
-- Versammlung»). `snapshot_party` ist genau das, sie trägt `UNIQUE (meeting_id,
-- party_id)`. Und sie verschwindet, wenn die Freigabe zurückgenommen wird —
-- dann ist auch dieser Vermerk gegenstandslos, denn er hängt an einem
-- Stimmberechtigtenstand, den es nicht mehr gibt. Dieselbe Überlegung wie bei
-- `attendance_event` (Migration 016).
--
-- **Warum eine eigene Tabelle und keine Spalte an `snapshot_party`.** Die
-- Momentaufnahme ist die eingefrorene Abschrift der Stammdaten. Dies hier ist
-- ein Betriebsentscheid mit Urheber, Zeitpunkt und Weg; er gehört nicht in eine
-- Abschrift, sondern daneben.
--
-- **Und er ist Teil des Siegels**, anders als die Pendenz aus Migration 106.
-- Eine Pendenz wird nach der Versammlung abgehakt, sie ist Arbeit. Dieser
-- Vermerk sagt, WIE abgestimmt wurde, und ist damit Teil des Nachweises. Wer
-- ihn nachträglich setzen könnte, könnte aus einer stellvertretend erfassten
-- Stimme rückwirkend eine vereinbarte machen.

-- **Damit `meeting_id` nicht von der Partei abweichen kann.** Die Spalte steht
-- unten doppelt: einmal für sich, einmal über `snapshot_party`. Genau sie liest
-- der Siegelauslöser. Wichen die beiden auseinander, liesse sich an einer
-- versiegelten Versammlung schreiben, indem man die Versammlung einer anderen
-- einträgt. Ein zusammengesetzter Fremdschlüssel schliesst das, und dafür
-- braucht `snapshot_party` diese Eindeutigkeit. Sie kostet nichts: `id` ist
-- schon allein eindeutig, die Schranke erweitert den Primärschlüssel nur um
-- eine Spalte, damit er als Ziel taugt. Dieselbe Bauart wie in Migration 106.
ALTER TABLE snapshot_party ADD CONSTRAINT snapshot_party_id_meeting_key UNIQUE (id, meeting_id);

CREATE TABLE paper_ballot (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),

    -- Der Siegelauslöser unten liest `NEW.meeting_id`. Die Spalte steht
    -- deshalb hier, obwohl sie über `snapshot_party` schon feststeht.
    meeting_id        uuid NOT NULL,
    snapshot_party_id uuid NOT NULL,

    -- Woher der Vermerk kommt:
    --   von_hand      am Einlass abgehakt, ohne Karte
    --   gescannt      beim Scannen der Zugangskarte beantwortet
    --   gemeinschaft  aus der Voreinstellung der Gemeinschaft übernommen
    --
    -- Die ersten beiden sind wörtlich die der Anwesenheit
    -- (`attendance_event.channel`), damit im Protokoll nicht zwei Wörter für
    -- denselben Weg stehen. Der dritte hat dort **kein** Gegenstück: Die
    -- Anwesenheit entsteht immer an einem Menschen am Eingang, dieser Vermerk
    -- auch aus einer vorher getroffenen Abmachung der Gemeinschaft.
    channel text NOT NULL,

    recorded_at       timestamptz NOT NULL DEFAULT now(),
    recorded_by       uuid REFERENCES app_user (id),
    recorded_by_label text,

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
    FOREIGN KEY (snapshot_party_id, operator_id) REFERENCES snapshot_party (id, operator_id)
        ON DELETE CASCADE,
    -- Die Versammlung des Vermerks IST die Versammlung der Partei, nicht bloss
    -- meistens. Siehe oben.
    CONSTRAINT paper_ballot_gleiche_versammlung
        FOREIGN KEY (snapshot_party_id, meeting_id) REFERENCES snapshot_party (id, meeting_id)
        ON DELETE CASCADE,

    -- Eine Partei stimmt auf Papier ab oder nicht. Das Zurücknehmen ist ein
    -- DELETE und kein zweiter Vermerk: Anders als bei der Anwesenheit gibt es
    -- hier nichts zu erzählen, was der Verlauf nicht besser erzählt.
    UNIQUE (snapshot_party_id),

    CONSTRAINT paper_ballot_weg CHECK (channel IN ('von_hand', 'gescannt', 'gemeinschaft')),
    -- Wer den Vermerk von Hand setzt, ist die Sitzungsleitung; dann muss
    -- feststehen, wer. Beim Scannen und bei der Voreinstellung der
    -- Gemeinschaft steht die Sitzungsleitung ebenfalls dahinter, deshalb gilt
    -- die Auflage für alle drei Wege.
    CONSTRAINT paper_ballot_erfasser CHECK (length(btrim(coalesce(recorded_by_label, ''))) >= 2)
);

CREATE INDEX paper_ballot_meeting_idx ON paper_ballot (meeting_id);

ALTER TABLE paper_ballot ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_ballot FORCE  ROW LEVEL SECURITY;

-- Wortgleich zu den übrigen Tabellen: Vergleich als TEXT, nicht mit `::uuid`.
-- Ist die Sitzungsvariable leer, liefert der Vergleich NULL und die Zeile
-- bleibt verborgen; ein Cast auf uuid würfe stattdessen einen Fehler.
CREATE POLICY paper_ballot_mandant ON paper_ballot
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- **Kein UPDATE, wie bei der Anwesenheit** (AD-5, Migration 016). Migration 002
-- vergibt alle vier Rechte an jede neue Tabelle. Gebraucht werden hier drei: Der
-- Vermerk entsteht, wird gelesen und zurückgenommen. Ihn zu ÄNDERN gibt es
-- keinen Weg, und es soll ihn nicht geben: Wer `channel` oder
-- `recorded_by_label` überschreiben könnte, änderte den Nachweis, wie und von
-- wem die Abmachung zustande kam, ohne dass eine Zeile im Verlauf entstünde.
-- Das Zurücknehmen bleibt ein DELETE und hinterlässt seinen Eintrag.
REVOKE UPDATE ON paper_ballot FROM versammlung_app;

-- Nach dem Versiegeln steht auch das fest (FR-55) — derselbe Auslöser wie bei
-- Anwesenheit, Vollmacht, Stimmen und Ausstand.
CREATE TRIGGER paper_ballot_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON paper_ballot
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

COMMENT ON TABLE paper_ballot IS
    'Diese Partei stimmt an dieser Versammlung auf Papier ab. Die Sitzungsleitung überträgt ihre '
    'Stimmen, ohne je Stimme einen Grund zu nennen, denn es ist das vereinbarte Verfahren.';
COMMENT ON COLUMN paper_ballot.channel IS
    'von_hand | gescannt | gemeinschaft. Woher der Vermerk kommt. Die ersten beiden wörtlich wie '
    'attendance_event.channel; gemeinschaft hat dort kein Gegenstück.';
COMMENT ON COLUMN paper_ballot.recorded_by_label IS
    'Wer den Vermerk gesetzt hat, als Text. Pflicht: Ein Vermerk ohne Urheber wäre im Protokoll wertlos.';
