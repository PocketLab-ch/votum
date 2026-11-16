-- 056 — Vergebliche Codeeingaben hinterlassen eine Spur (Audit B-05)
--
-- Die Anmeldung zählt Fehlversuche und sperrt. Die öffentlichen Wege `/z` und
-- `/p` taten **nichts dergleichen**: beliebig viele Versuche, keine Sperre,
-- keine Aufzeichnung.
--
-- **Es kommt keine Sperre dazu, und das ist Absicht.** Der Zugangscode trägt 97
-- Bit Zufall, der Anzeigecode 58 — Durchprobieren ist chancenlos, die Entropie
-- trägt die Sache. Eine Sperre träfe dafür im Saal die Falschen: Wer seinen Code
-- bei schlechtem Licht dreimal abtippt, käme nicht mehr hinein, und das mitten
-- in der Versammlung. Was fehlte, war nicht die Sperre, sondern die
-- **Sichtbarkeit**.
--
-- ## Gezählt statt aufgeschrieben
--
-- **Der erste Entwurf schrieb je Versuch eine Zeile nach `login_attempt`, und
-- das war falsch.** `/z/<code>` und `/p/<code>` sind unangemeldete Aufrufe; aus
-- zwei reinen Lesewegen wären damit Schreibwege geworden, die jeder von aussen
-- betätigen kann. Gemessen wurden 700 Anfragen je Sekunde von einem einzigen
-- Rechner — das sind rund **6 GB Zeilen am Tag**, in einer Tabelle, die niemand
-- aufräumt. Auf einem Notebook im Versammlungsraum ist eine volle Platte kein
-- Schönheitsfehler, sondern das Ende der Versammlung.
--
-- Deshalb ein **Zähler** und kein Protokoll: je Art, Stunde und Ausgang eine
-- Zeile, die hochgezählt wird. Das sind höchstens vier Zeilen je Stunde,
-- rund 35 000 im Jahr, gut drei Megabyte. Die Frage «hat es jemand versucht,
-- und wie oft» beantwortet der Zähler vollständig — mehr wollte der Befund
-- nicht. Was er nicht beantwortet, wollte er auch nicht: **wer**. Der Code wird
-- nirgends mitgeschrieben, auch nicht als Prüfwert; eine Liste von Prüfwerten
-- versuchter Codes wäre eine Liste, gegen die sich vergleichen lässt.
CREATE TABLE code_attempt (
    kind      text        NOT NULL,
    -- Auf die Stunde abgeschnitten. Feiner wäre genauer und würde die Tabelle
    -- um denselben Faktor wachsen lassen, den diese Bauweise gerade vermeidet.
    hour      timestamptz NOT NULL,
    succeeded boolean     NOT NULL,
    count     bigint      NOT NULL DEFAULT 0,

    PRIMARY KEY (kind, hour, succeeded),
    CONSTRAINT code_attempt_art CHECK (kind IN ('zugangscode', 'anzeigecode')),
    CONSTRAINT code_attempt_zahl CHECK (count > 0),
    -- Eine Stunde, die keine ist, wäre eine Zeile, die sich nie wieder trifft —
    -- und der Zähler wüchse doch je Anfrage.
    CONSTRAINT code_attempt_stunde CHECK (hour = date_trunc('hour', hour))
);

-- **Ein Zähler zählt aufwärts.** Die Anwendung braucht `UPDATE`, weil sie
-- hochzählt; damit könnte ein Fehler im Anwendungscode einen Stand auch
-- zurücksetzen und die Spur mitnehmen. Der Auslöser lässt genau die eine
-- Richtung zu, in die ein Zähler geht.
CREATE OR REPLACE FUNCTION code_attempt_nur_aufwaerts() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Der Zähler der Codeversuche wird nicht gelöscht.';
    END IF;
    IF NEW.count <= OLD.count
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.hour IS DISTINCT FROM OLD.hour
       OR NEW.succeeded IS DISTINCT FROM OLD.succeeded THEN
        RAISE EXCEPTION 'Der Zähler der Codeversuche zählt nur aufwärts.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER code_attempt_nur_aufwaerts_trigger
    BEFORE UPDATE OR DELETE ON code_attempt
    FOR EACH ROW EXECUTE FUNCTION code_attempt_nur_aufwaerts();

-- Zweite Schranke daneben, wie bei den übrigen Nachweistabellen (Migration 002).
REVOKE DELETE ON code_attempt FROM versammlung_app;

-- **Kein Zeilenschutz, und das muss so sein:** Ein Code, der nicht greift,
-- gehört zu keinem Betreiber. Die Zeile darf deshalb keine Betreiberspalte
-- haben — es gäbe nichts, was hineingehörte. Die Ausnahme steht mit Begründung
-- in `tests/db/rechte.test.ts`.

COMMENT ON TABLE code_attempt IS
    'Zähler der Codeeingaben auf den öffentlichen Wegen /z und /p — je Art, Stunde und Ausgang. Ohne Mandant, ohne Code, ohne Person.';

-- ── B-08, zweiter Teil: Fehlversuche der Anmeldung sind auch nicht änderbar ──
--
-- Migration 055 entzog `DELETE`. Die Begründung dort — «liesse sich die Sperre
-- durch einen Fehler im Anwendungscode aufheben, und die Spur der Versuche mit
-- ihr» — trifft auf `UPDATE` genauso: `SET succeeded = true` hebt die Sperre
-- ebenso auf. Die Anwendung fügt hier an und liest; mehr tut sie nie.
REVOKE UPDATE ON login_attempt FROM versammlung_app;
