-- Wie ein Haus über die Weisung an seinen Vertreter entscheidet.
--
-- **Der Auftrag** (Auftraggeber, 25.08.2026): «In meinem Reglement steht: Ist ein
-- dominierendes Grundstück in Stockwerkeigentum aufgeteilt, so haben die
-- beteiligten Stockwerkeigentümer nur eine Stimme, die sie durch einen durch
-- sie bezeichneten Vertreter auszuüben haben. […] Also einfaches Mehr. Es
-- könnte auch Qual-Mehr geben. Das muss abgebildet werden können. Also wie
-- viele Kopfstimmen braucht es in % oder im Verhältnis. Dasselbe wenn WQ auch
-- abgebildet ist. Also K und oder WQ.»
--
-- **Was die Regel ist.** Die Miteigentümergemeinschaft, deren Mitglieder die
-- Häuser sind, hat je Haus **eine** Stimme. Wie das Haus zu dieser einen Stimme
-- kommt, sagt sein eigenes Reglement — und das kann von Haus zu Haus
-- verschieden sein. Bisher stand diese Schwelle nirgends: Sie musste an jedem
-- einzelnen Weisungstraktandum von Hand gewählt werden, und beim nächsten
-- Geschäft wieder.
--
-- **Warum eine eigene Tabelle und keine Geschäftsart.** Die Regel gehört nicht
-- in den Entscheidbaum: «Weisung» ist keine Art von Geschäft, über das man
-- beschliesst, sondern die Frage, wie ein Haus seine Haltung zu einem fremden
-- Geschäft bildet. Als Geschäftsart stünde sie in der Klassierung jedes
-- Traktandums zur Wahl und wäre dort immer falsch.
--
-- **Warum sie nichts nachrechnet.** Sie wird zum **Erfordernis** des
-- Weisungstraktandums im Haus — das Haus stimmt danach ab, und sein Beschluss
-- ist die Weisung. Eine zweite Auszählung derselben Stimmen nach einer zweiten
-- Regel erzeugte eine zweite Wahrheit, die eines Tages von der ersten abweicht;
-- davor warnt `haltungAusBeschluss` ausdrücklich.
--
-- Aufbau und Schranken sind von `bylaw_quorum_rule` abgelesen, nicht aus dem
-- Gedächtnis nachgebaut: dieselben Basen, dieselben Brüche, dieselbe
-- Fundstellenpflicht.

CREATE TABLE bylaw_instruction_rule (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    operator_id       uuid NOT NULL REFERENCES operator (id),
    stweg_id          uuid NOT NULL,
    head_numerator    integer NOT NULL,
    head_denominator  integer NOT NULL,
    head_mode         text NOT NULL,
    head_base         text NOT NULL,
    quota_numerator   integer,
    quota_denominator integer,
    quota_mode        text,
    quota_base        text NOT NULL DEFAULT 'keine',
    source_reference  text NOT NULL,
    abstention_counts boolean NOT NULL DEFAULT true,
    -- Was gilt, wenn das Haus nicht entscheidet — keine Versammlung, kein
    -- Beschluss. Auftraggeber, 25.08.2026: «Ist auch im Reglement geklärt. Enthaltung
    -- oder Nein als Auswahl anbieten.»
    no_decision       text NOT NULL DEFAULT 'enthaltung',
    note              text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),

    -- Eine Gemeinschaft, eine Regel. Zwei nebeneinander wären zwei Antworten
    -- auf dieselbe Frage, und keine Abfrage wüsste, welche gilt.
    CONSTRAINT bylaw_instruction_rule_je_gemeinschaft UNIQUE (stweg_id),

    CONSTRAINT bylaw_instruction_fundstelle
        CHECK (length(btrim(source_reference)) >= 3),
    CONSTRAINT bylaw_instruction_kopf_art
        CHECK (head_mode IN ('mehr_als', 'mindestens')),
    CONSTRAINT bylaw_instruction_kopf_basis
        CHECK (head_base IN ('anwesend_vertreten', 'alle_eigentuemer', 'alle_ausser_betroffene')),
    CONSTRAINT bylaw_instruction_kopf_bruch
        CHECK (head_numerator >= 1 AND head_denominator >= 1
               AND head_denominator <= 100 AND head_numerator <= head_denominator),
    CONSTRAINT bylaw_instruction_quoten_art
        CHECK (quota_mode IS NULL OR quota_mode IN ('mehr_als', 'mindestens')),
    CONSTRAINT bylaw_instruction_quoten_basis
        CHECK (quota_base IN ('keine', 'alle_quoten', 'anwesend_vertreten')),
    CONSTRAINT bylaw_instruction_quoten_bruch
        CHECK (quota_numerator IS NULL
               OR (quota_numerator >= 1 AND quota_denominator >= 1
                   AND quota_denominator <= 100 AND quota_numerator <= quota_denominator)),
    -- Alles oder nichts bei den Wertquoten: Ein halber Bruch ergibt keine
    -- Schwelle, sondern eine, die aussieht wie eine.
    CONSTRAINT bylaw_instruction_quoten_vollstaendig
        CHECK ((quota_numerator IS NULL AND quota_denominator IS NULL
                AND quota_mode IS NULL AND quota_base = 'keine')
               OR (quota_numerator IS NOT NULL AND quota_denominator IS NOT NULL
                   AND quota_mode IS NOT NULL AND quota_base <> 'keine')),
    CONSTRAINT bylaw_instruction_ohne_beschluss
        CHECK (no_decision IN ('enthaltung', 'nein'))
);

CREATE INDEX bylaw_instruction_rule_stweg ON bylaw_instruction_rule (stweg_id);

ALTER TABLE bylaw_instruction_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE bylaw_instruction_rule FORCE  ROW LEVEL SECURITY;

-- Wortgleich zu den übrigen Tabellen: Vergleich als TEXT, nicht mit `::uuid`.
-- Ist die Sitzungsvariable leer, liefert der Vergleich NULL und die Zeile
-- bleibt verborgen; ein Cast auf uuid würfe stattdessen einen Fehler.
CREATE POLICY bylaw_instruction_rule_mandant ON bylaw_instruction_rule
    USING (operator_id::text = current_setting('versammlung.operator_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON bylaw_instruction_rule TO versammlung_app;

COMMENT ON TABLE bylaw_instruction_rule IS
    'Wie ein Haus über die Weisung an seinen Vertreter in einer '
    'Miteigentümergemeinschaft entscheidet. Wird zum Erfordernis des '
    'Weisungstraktandums; rechnet nichts nach.';
