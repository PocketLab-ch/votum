-- Wurde diese Partei am Eingang gefragt, ob sie digital oder von Hand abstimmt?
--
-- **Der Anlass** (Auftraggeber, 10.09.2026, nach der Frage «was ist noch offen»): Wer
-- die Frage mitten im Einlass **einschaltet**, hat ein Loch. Alle, die vorher
-- hereinkamen, wurden nie gefragt — im Haus führt nur das nochmalige Scannen der
-- Karte zur Frage, am gemeinsamen Abend gar kein Weg. Sie stimmen still digital
-- ab, auch wenn sie am Tisch das Gegenteil gesagt haben.
--
-- **Warum die Frage und nicht die Antwort gespeichert wird.** Die Antwort steht
-- schon da: `paper_ballot` heisst «stimmt von Hand», und sein Fehlen heisst
-- «stimmt digital». Was fehlte, ist die dritte Lage — **niemand hat gefragt** —,
-- und die sah bis heute aus wie die zweite. Genau diese Doppeldeutigkeit hat der
-- Block vom 10.09.2026 am Formular geschlossen (`papier` = ja | nein | nachher |
-- fehlt); diese Tabelle schliesst sie an der Datenbank.
--
-- Daraus folgt der Zuschnitt: **keine Antwortspalte.** Eine zweite Stelle, an
-- der «von Hand» steht, liefe von `paper_ballot` weg, sobald jemand den Vermerk
-- zurücknimmt — dann sagte die eine Zeile «auf Papier» und die andere nichts.
-- Hier steht nur, DASS gefragt wurde. Eine zurückgenommene Antwort bleibt eine
-- Antwort: Die Partei wurde gefragt, und der Entscheid wurde danach berichtigt.
--
-- **Was die Liste daraus macht.** Anwesende Parteien ohne Zeile hier sind die,
-- die niemand gefragt hat. Solange die Versammlung fragt, stehen sie als
-- Nachtragsliste in der Anwesenheitssicht und am Eingang des Abends, mit
-- denselben zwei Knöpfen wie am Eingang. Die Menge ist endlich und bekannt und
-- schrumpft auf null.
--
-- **Das ist kein Entscheid mitten in der Sitzung** (Vorgabe des Auftraggebers, 09.09.2026:
-- «Der Entscheid fällt am Eingang, nicht während der laufenden Sitzung»),
-- sondern das Nachholen der Eingangsfrage für Leute, die hereinkamen, bevor es
-- die Frage gab. Ein freier Knopf an jeder Zeile wäre das andere und wurde
-- ausdrücklich verworfen.
--
-- **Nebenbei schliesst sie die Häkchenliste mit.** Das Häkchenformular hakt eine
-- Unterschriftenliste ab und fragt mit Absicht nicht — ein Zwiegespräch über
-- einem Dutzend Namen ist kein Eingang mehr. Bis heute erfasste es die Parteien
-- damit still als digital; jetzt tauchen sie in der Nachtragsliste auf. Der Satz
-- in der Maske bleibt, die Schranke steht jetzt daneben.
--
-- **Warum an `snapshot_party`, warum eine eigene Tabelle, warum Teil des
-- Siegels:** wortgleich zu `paper_ballot` (Migration 107). Die Abmachung gilt je
-- Versammlung; die Momentaufnahme ist eine Abschrift der Stammdaten und nimmt
-- keinen Betriebsentscheid auf; und wer nachträglich behaupten könnte, es sei
-- gefragt worden, änderte den Nachweis.
CREATE TABLE paper_question_answered (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL REFERENCES operator (id),

    -- Wie bei `paper_ballot`: Der Siegelauslöser liest `NEW.meeting_id`, deshalb
    -- steht die Spalte hier, obwohl sie über `snapshot_party` schon feststeht.
    meeting_id        uuid NOT NULL,
    snapshot_party_id uuid NOT NULL,

    -- Wo gefragt wurde:
    --   von_hand   am Eingang abgehakt oder über die Zeile erfasst
    --   gescannt   an der Zugangskarte beantwortet
    --   nachtrag   nachgeholt über die Nachtragsliste
    --
    -- Die ersten beiden wörtlich wie `attendance_event.channel` und
    -- `paper_ballot.channel`, damit nicht drei Wörter für denselben Weg stehen.
    channel text NOT NULL,

    recorded_at       timestamptz NOT NULL DEFAULT now(),
    recorded_by       uuid REFERENCES app_user (id),
    recorded_by_label text,

    FOREIGN KEY (meeting_id, operator_id) REFERENCES meeting (id, operator_id),
    FOREIGN KEY (snapshot_party_id, operator_id) REFERENCES snapshot_party (id, operator_id)
        ON DELETE CASCADE,
    -- Die Versammlung der Antwort IST die Versammlung der Partei. Siehe
    -- Migration 107, dieselbe Überlegung und derselbe zusammengesetzte Schlüssel.
    CONSTRAINT paper_question_gleiche_versammlung
        FOREIGN KEY (snapshot_party_id, meeting_id) REFERENCES snapshot_party (id, meeting_id)
        ON DELETE CASCADE,

    -- Gefragt wurde einmal. Ein zweiter Eingang derselben Partei (die Karte wird
    -- nochmals gescannt) ändert die Antwort über `paper_ballot`, nicht hier.
    UNIQUE (snapshot_party_id),

    CONSTRAINT paper_question_weg CHECK (channel IN ('von_hand', 'gescannt', 'nachtrag')),
    -- Wie beim Vermerk: Wer gefragt hat, muss feststehen.
    CONSTRAINT paper_question_erfasser
        CHECK (length(btrim(coalesce(recorded_by_label, ''))) >= 2)
);

CREATE INDEX paper_question_answered_meeting_idx ON paper_question_answered (meeting_id);

ALTER TABLE paper_question_answered ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_question_answered FORCE  ROW LEVEL SECURITY;

-- Vergleich als TEXT, nicht mit `::uuid` — wortgleich zu den übrigen Tabellen.
CREATE POLICY paper_question_answered_mandant ON paper_question_answered
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- **Kein UPDATE und kein DELETE.** Anders als der Vermerk lässt sich diese Zeile
-- nicht zurücknehmen, und das ist der Punkt: Gefragt wurde gefragt. Wer die
-- Zeile löschen könnte, brächte eine Partei zurück in die Nachtragsliste, die
-- längst geantwortet hat — und die Liste wäre keine Aussage mehr, sondern eine
-- Meinung.
REVOKE UPDATE, DELETE ON paper_question_answered FROM versammlung_app;

-- Nach dem Versiegeln steht auch das fest, wie beim Vermerk (FR-55).
CREATE TRIGGER paper_question_answered_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON paper_question_answered
    FOR EACH ROW EXECUTE FUNCTION verhindere_nach_siegel();

COMMENT ON TABLE paper_question_answered IS
    'Diese Partei wurde am Eingang gefragt, ob sie digital oder von Hand abstimmt. Die ANTWORT '
    'steht in paper_ballot (vorhanden = von Hand, fehlend = digital); hier steht nur, dass '
    'gefragt wurde. Anwesende ohne Zeile sind die, die niemand gefragt hat.';
COMMENT ON COLUMN paper_question_answered.channel IS
    'von_hand | gescannt | nachtrag. Wo gefragt wurde. Die ersten beiden wörtlich wie '
    'attendance_event.channel.';
