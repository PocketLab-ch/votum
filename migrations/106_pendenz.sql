-- Die Pendenz: wer erledigt was bis wann (09.09.2026).
--
-- **Der Anlass** steht in `docs/echte-protokolle-2026-09-08.md` unter «Die
-- grösste Lücke»: Von sechs Seiten Protokoll sind vielleicht zwölf Zeilen
-- Beschluss. Der Rest ist Sachstand und **Zusagen mit Namen und Termin** — «Die
-- Verwaltung wird diesen Punkt noch mit dem Bauleiter klären», «die
-- Bewirtschaftung wird einen Techniker aufbieten». Diese Sätze sind es, die im
-- Folgejahr wieder auftauchen, und sie sind der Grund, warum ein Protokoll
-- überhaupt gelesen wird. 2025 stand «er meldet sich diesbezüglich wieder»;
-- 2026 stand derselbe Punkt wieder da, weil sich niemand gemeldet hatte.
--
-- **Warum sie an der Gemeinschaft hängt und nicht am Protokoll.** Eine Pendenz
-- ändert ihren Zustand NACH der Sitzung, in der sie entstand — genau dann wird
-- sie erledigt oder verfällt. Ein Gegenstand, der sich nach dem Siegel ändert,
-- gehört nicht in das, was das Siegel deckt. Sie steht deshalb neben dem
-- Nachweis, mit einer unveränderlichen Herkunft hinein.
--
-- **Und deshalb steht sie nicht im Siegelpaket.** `src/lib/server/siegel.ts`
-- legt Daten, Auswertung und Unterlagen hinein; das Protokoll ist ausdrücklich
-- ausgenommen (PRD §4.11), weil es nach der Sitzung entsteht und redigiert
-- wird. Die Pendenz teilt diese Eigenschaft und teilt darum die Ausnahme. Sie
-- bekommt aus demselben Grund **keinen** Auslöser `pendenz_nach_siegel`: Ein
-- solcher verböte genau das Abhaken, für das es sie gibt.

-- ── Zwei Schlüssel, damit die Herkunft eine echte Klammer wird ───────────────
--
-- Ohne sie liesse sich eine Pendenz mit der Versammlung aus Haus A und dem
-- Traktandum aus Haus B anlegen: Beide Fremdschlüssel für sich wären erfüllt,
-- und die Herkunft zeigte auf zwei Orte, die nichts miteinander zu tun haben.
-- Dieselbe Klasse, die `party_member` in Migration 094 über zusammengesetzte
-- Schlüssel geschlossen hat.
--
-- Beide erweitern den Primärschlüssel um eine Spalte und sind damit vom
-- Bestand her **trivial erfüllt** — es gibt keine Zeile, die sie verletzen
-- könnte, weil `id` schon allein eindeutig ist. Sie kosten je einen Index.
ALTER TABLE meeting     ADD CONSTRAINT meeting_id_stweg_key       UNIQUE (id, stweg_id);
ALTER TABLE agenda_item ADD CONSTRAINT agenda_item_id_meeting_key UNIQUE (id, meeting_id);

CREATE TABLE pendenz (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id uuid NOT NULL,

    -- **Die Gemeinschaft trägt sie**, nicht die Versammlung. Der Faden läuft
    -- über Jahre; die Versammlung ist nur die Stelle, an der er anfängt.
    stweg_id       uuid NOT NULL,
    -- ── Herkunft, unveränderlich ─────────────────────────────────────────
    meeting_id     uuid NOT NULL,
    agenda_item_id uuid NOT NULL,

    -- Der Satz selbst. **Die Essenz, nicht der Verlauf**: Was gesagt wurde,
    -- steht im Votum (`agenda_item.minute_text`, bis 20 000 Zeichen); was
    -- beschlossen wurde, im Text zum Beschluss (Migration 105). Die Pendenz
    -- ist das, was jemand daraus zu tun hat, und das ist ein Satz.
    wording text NOT NULL,

    -- **Wer — als Text, nicht als Verweis.** In den echten Protokollen heissen
    -- die Zuständigen «die Verwaltung», «die Bewirtschaftung», «der Bauleiter»,
    -- «der Heizungsfachmann». Von diesen vier ist keiner zwingend eine Zeile in
    -- `party` oder `person`: Der Bauleiter ist eine fremde Firma, die
    -- Verwaltung eine Rolle. Ein Fremdschlüssel zwänge dazu, sie alle erst
    -- anzulegen — mitten in der Sitzung, wo dafür keine Zeit ist, und mit dem
    -- Ergebnis, dass die Eigentümerliste sich mit Handwerkern füllt.
    --
    -- NULL ist erlaubt: «es wird abgeklärt» kommt vor, und eine Pendenz ohne
    -- Namen ist besser als keine.
    responsible text,

    -- ── Bis wann: drei Zustände, nicht zwei ──────────────────────────────
    --
    -- Ein blosses `due_date date NULL` trüge zwei Fälle in einem: «noch kein
    -- Termin gesetzt» und «ausdrücklich ohne Termin» sähen gleich aus, und im
    -- Folgejahr könnte niemand sagen, welcher gemeint war. Die Art steht
    -- deshalb daneben und ist Pflicht; wer eine Pendenz erfasst, entscheidet
    -- sich.
    --
    -- «naechste_versammlung» ist der häufigste Fall der echten Protokolle («er
    -- meldet sich wieder») und zugleich der, der den Vorschlag beim Anlegen der
    -- nächsten Versammlung trägt.
    due_kind text NOT NULL,
    due_date date,

    -- ── Zustand ──────────────────────────────────────────────────────────
    --
    -- «hinfaellig» ist kein Zierrat. Der Fall steht wörtlich in den
    -- Unterlagen: «Ein Fachmann war in den letzten Monaten schwer erreichbar
    -- und hat sich auch nach mehreren Anrufen und E-Mails nicht mehr
    -- gemeldet.» Wer das nicht festhält, diskutiert es im nächsten Jahr aus
    -- dem Gedächtnis. Ohne den dritten Zustand bliebe nur, die Pendenz still
    -- zu löschen, und dann fehlt genau diese Auskunft.
    state       text NOT NULL DEFAULT 'offen',
    state_since timestamptz NOT NULL DEFAULT now(),
    -- Warum sie erledigt oder hinfällig ist. Beim Abhaken freiwillig, beim
    -- Verfallen der eigentliche Inhalt.
    closing_note text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pendenz_wortlaut CHECK (length(btrim(wording)) >= 3),
    CONSTRAINT pendenz_verantwortlich
        CHECK (responsible IS NULL OR length(btrim(responsible)) >= 2),

    CONSTRAINT pendenz_fristart CHECK (due_kind IN ('datum', 'naechste_versammlung', 'keine')),
    -- Beide Richtungen: ein Datum ohne die Art wäre stumm, die Art ohne Datum
    -- eine Frist ohne Termin.
    CONSTRAINT pendenz_frist CHECK ((due_kind = 'datum') = (due_date IS NOT NULL)),

    CONSTRAINT pendenz_zustand CHECK (state IN ('offen', 'erledigt', 'hinfaellig')),
    -- Wird eine Pendenz wieder geöffnet, gilt ihre Abschlussnotiz nicht mehr.
    -- Bliebe sie stehen, stünde unter einer offenen Pendenz, warum sie erledigt
    -- sei.
    CONSTRAINT pendenz_notiz_nur_beim_abschluss
        CHECK (state <> 'offen' OR closing_note IS NULL),

    -- **Der Betreiber muss zur Gemeinschaft gehören** (wie `party_member`):
    -- Der Zeilenschutz filtert allein über `operator_id`, und ohne diese
    -- Bindung wäre eine Zeile beim falschen Mandanten sichtbar.
    CONSTRAINT pendenz_gleicher_betreiber
        FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id)
        ON DELETE RESTRICT,

    -- **Die Kaskaden sind Absicht.** `versammlung_loeschen` (Migration 058)
    -- räumt Traktanden und Versammlung ab; ohne Kaskade bräche es an einer
    -- Pendenz mit einer rohen Fremdschlüsselmeldung. Und inhaltlich: Eine
    -- Versammlung im Entwurf, die gelöscht wird, hat nicht stattgefunden — eine
    -- Pendenz aus ihr wäre eine Zusage aus einer Sitzung, die es nie gab.
    CONSTRAINT pendenz_herkunft_versammlung
        FOREIGN KEY (meeting_id, stweg_id) REFERENCES meeting (id, stweg_id)
        ON DELETE CASCADE,
    CONSTRAINT pendenz_herkunft_traktandum
        FOREIGN KEY (agenda_item_id, meeting_id) REFERENCES agenda_item (id, meeting_id)
        ON DELETE CASCADE
);

-- Die Liste der Sitzung: alle Pendenzen dieser Versammlung, je Traktandum.
CREATE INDEX pendenz_versammlung_idx ON pendenz (meeting_id, agenda_item_id);
-- Der Faden über die Jahre: die offenen einer Gemeinschaft. Als Teilindex, weil
-- genau danach gefragt wird — erledigte und hinfällige sucht niemand quer.
CREATE INDEX pendenz_offene_idx ON pendenz (stweg_id, due_date) WHERE state = 'offen';
-- `pendenz_herkunft_traktandum` steht auf CASCADE; ohne Index sucht Postgres
-- bei jedem `DELETE FROM agenda_item` mit einem vollen Durchlauf.
CREATE INDEX pendenz_traktandum_idx ON pendenz (agenda_item_id);

ALTER TABLE pendenz ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendenz FORCE  ROW LEVEL SECURITY;

-- Wortgleich zu den übrigen Tabellen: Vergleich als TEXT, nicht mit `::uuid`.
-- Ist die Sitzungsvariable leer, liefert der Vergleich NULL und die Zeile
-- bleibt verborgen; ein Cast auf uuid würfe stattdessen einen Fehler.
CREATE POLICY pendenz_mandant ON pendenz
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- **Das Löschrecht bleibt, anders als bei Vollmacht, Siegel und Weisung.** Dort
-- ist der Entzug richtig, weil die Zeile ein Beleg ist: Eine Vollmacht wird
-- zurückgewiesen, nie entfernt. Die Pendenz ist kein Beleg — sie ist eine
-- Merkhilfe, und im Saal vertippt sich jemand. Ohne Löschweg bliebe eine
-- versehentlich erfasste Zeile für immer stehen, und «hinfaellig» hiesse dann
-- zweierlei: «hat sich erledigt» und «war nie gemeint». Migration 002 vergibt
-- das Recht über `ALTER DEFAULT PRIVILEGES`; hier wird es nur nicht entzogen.

COMMENT ON TABLE pendenz IS
    'Wer erledigt was bis wann. Entsteht an einem Traktandum, gehört der Gemeinschaft und '
    'bleibt änderbar, auch nachdem die Versammlung versiegelt ist — sie ist nicht Teil des Siegels.';
COMMENT ON COLUMN pendenz.wording IS
    'Die Zusage in einem Satz. Der Verlauf steht im Votum, der Beschluss in voting_round.decision_text.';
COMMENT ON COLUMN pendenz.responsible IS
    'Wer zuständig ist, als Text: «die Verwaltung», «der Bauleiter». NULL = niemand benannt.';
COMMENT ON COLUMN pendenz.due_kind IS
    'datum | naechste_versammlung | keine. Pflicht, damit «kein Termin gesetzt» und «braucht keinen» unterscheidbar bleiben.';
COMMENT ON COLUMN pendenz.state IS
    'offen | erledigt | hinfaellig. «hinfaellig» ist der Fall, in dem eine Zusage still verfällt.';
