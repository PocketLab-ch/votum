-- Die Summen-Erfassung: von Hand gezählte Stimmen ohne Zuordnung.
--
-- **Der Auftrag** (Auftraggeber, 25.08.2026): «ich vermute dass die Sitzung mit
-- Handzählen ist […] So setzt es voraus, dass ich jeden Eigentümer kenne und
-- die Stimmen richtig setze. Also beim einfachen Mehr. Wenn müsste man dort die
-- totale Anzahl an Ja, Nein und Enthaltung eintragen können.» Und die Grenze,
-- die er selbst gezogen hat: «Summen-Erfassung nur bei einfachem Mehr. Beim
-- qualifiziertem Mehr braucht es die Zettel aus jeder Zeit.»
--
-- **Warum das nicht in `vote` geht.** Eine Zeile in `vote` behauptet, WER wie
-- gestimmt hat — sie hängt an `snapshot_unit_id` und `snapshot_party_id`, beide
-- NOT NULL. Aus einer Handzählung Zeilen zu erzeugen hiesse, Namen zu erfinden:
-- Das Protokoll behauptete dann, ein bestimmter Eigentümer habe Ja gesagt, und
-- niemand wüsste, dass die Zuordnung ausgedacht ist. Deshalb steht die Summe am
-- **Durchgang** — dort, wo sie hingehört: eine Zahl, die niemandem zugeordnet
-- ist, und die sagt das auch.
--
-- **Warum nur beim einfachen Mehr.** Wertquoten hängen an der Einheit. Wer nur
-- Hände zählt, weiss nicht, WELCHE Einheiten zugestimmt haben, und kann die
-- Quoten nicht bilden. Ein qualifiziertes Mehr wäre damit nicht auszählbar —
-- nicht «ungenau», sondern gar nicht. Die Schranke steht im Kern
-- (`zaehleSummenAus`) und in der Oberfläche; die Datenbank hält hier nur fest,
-- dass die drei Zahlen zusammengehören.

ALTER TABLE voting_round
    ADD COLUMN tally_yes     integer,
    ADD COLUMN tally_no      integer,
    ADD COLUMN tally_abstain integer,
    ADD COLUMN tally_note    text,
    ADD COLUMN tally_by      uuid REFERENCES app_user (id),
    ADD COLUMN tally_at      timestamptz;

ALTER TABLE voting_round
    -- Alles oder nichts: Zwei von drei Zahlen ergeben kein Ergebnis, sondern
    -- eine halbe Auszählung, die aussieht wie eine ganze.
    ADD CONSTRAINT voting_round_summe_vollstaendig CHECK (
        (tally_yes IS NULL AND tally_no IS NULL AND tally_abstain IS NULL
         AND tally_at IS NULL AND tally_by IS NULL)
        OR (tally_yes IS NOT NULL AND tally_no IS NOT NULL AND tally_abstain IS NOT NULL
            AND tally_at IS NOT NULL)
    ),
    ADD CONSTRAINT voting_round_summe_nicht_negativ CHECK (
        (tally_yes IS NULL OR tally_yes >= 0)
        AND (tally_no IS NULL OR tally_no >= 0)
        AND (tally_abstain IS NULL OR tally_abstain >= 0)
    ),
    -- Ein Vermerk ohne Zahlen ist eine Behauptung ohne Gegenstand.
    ADD CONSTRAINT voting_round_summenvermerk CHECK (
        tally_note IS NULL OR tally_yes IS NOT NULL
    );

COMMENT ON COLUMN voting_round.tally_yes IS
    'Von Hand gezählte Kopfstimmen dafür — ohne Zuordnung zu Personen. '
    'Schliesst sich mit Zeilen in vote gegenseitig aus; die Regel steht in '
    'src/lib/server/abstimmung.ts, weil sie zwei Tabellen betrifft.';

COMMENT ON COLUMN voting_round.tally_note IS
    'Wie gezählt wurde — «Handzeichen, gezählt von der Sitzungsleitung und dem '
    'Stimmenzähler». Gehört ins Protokoll: Er erklärt, warum keine einzelnen '
    'Stimmen festgehalten sind.';
