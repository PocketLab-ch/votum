-- 127 — Die Ausnahme des Reglements wirkt: eingefroren bei der Freigabe,
-- vermerkt am Traktandum
--
-- **Zweiter Block des Auftrags «Ausnahmen bei nicht angekündigten
-- Geschäften».** Migration 126 hat die Angaben an der Gemeinschaft angelegt.
-- Hier bekommen sie Wirkung, zuerst für die Ausnahme (a): Gestattet das
-- Reglement Beschlüsse über nicht angekündigte Gegenstände ausdrücklich
-- (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2), darf ein im Saal aufgenommenes
-- neues Geschäft zur Abstimmung. Die Universalversammlung folgt in einem
-- eigenen Block.
--
-- **Eingefroren bei der Freigabe, nicht live gelesen.** Die Angaben gelten, wie
-- sie standen, als die Einladung hinausging; so wie Zählweise und Stichentscheid
-- in der Momentaufnahme stehen (Migration 013). Sonst liesse sich die Angabe im
-- Saal umstellen, und die Absage lüde dazu ein (Laienprüfung 29.09.2026). Alle
-- drei Angaben stehen hier, auch die der Universalversammlung: Sie werden in
-- einem Zug eingefroren, damit der folgende Block keine zweite Freigabe braucht.
--
-- Bestehende Momentaufnahmen bekommen die Vorgaben, also keine Ausnahme. Das
-- ist richtig: Als sie entstanden, kannte Votum keine.
ALTER TABLE snapshot ADD COLUMN unannounced_bylaw_allowed     boolean NOT NULL DEFAULT false;
ALTER TABLE snapshot ADD COLUMN unannounced_bylaw_source      text;
ALTER TABLE snapshot ADD COLUMN universal_meeting_mode        text    NOT NULL DEFAULT 'persoenlich';
ALTER TABLE snapshot ADD COLUMN universal_meeting_source      text;
ALTER TABLE snapshot ADD COLUMN universal_chair_proxies_count boolean NOT NULL DEFAULT false;

ALTER TABLE snapshot ADD CONSTRAINT snapshot_nichtangekuendigtes_fundstelle
    CHECK (NOT unannounced_bylaw_allowed
           OR length(btrim(coalesce(unannounced_bylaw_source, ''))) >= 3);
ALTER TABLE snapshot ADD CONSTRAINT snapshot_universalversammlung_variante
    CHECK (universal_meeting_mode IN ('persoenlich', 'vertreten', 'keine'));

-- ── Worauf sich ein nicht angekündigtes Geschäft stützt ────────────────────
--
-- Am Traktandum, weil die Schranke aus Migration 046 genau hier sitzt: Ein neues
-- Spontantraktandum durfte nur eine Kenntnisnahme sein. Mit einer Ausnahme darf
-- es eine Abstimmung sein, aber nur, wenn die Ausnahme vermerkt ist. So bleibt
-- die Schranke die letzte Verteidigungslinie: Ein Weg, der die Prüfung
-- umginge, schriebe eine Zeile, die die Datenbank abweist.
ALTER TABLE agenda_item ADD COLUMN unannounced_basis text;

ALTER TABLE agenda_item ADD CONSTRAINT agenda_ausnahme_art
    CHECK (unannounced_basis IS NULL OR unannounced_basis IN ('reglement', 'universal'));

-- Nur ein neues Spontantraktandum trägt eine Ausnahme. An einem angekündigten
-- Traktandum, einem Folgeantrag oder einem Rückkommen wäre sie eine Behauptung
-- ohne Gegenstand.
ALTER TABLE agenda_item ADD CONSTRAINT agenda_ausnahme_nur_bei_neuem
    CHECK (unannounced_basis IS NULL
           OR (is_spontaneous AND spontaneous_kind = 'neu'));

ALTER TABLE agenda_item DROP CONSTRAINT agenda_neu_nur_kenntnisnahme;
ALTER TABLE agenda_item ADD CONSTRAINT agenda_neu_nur_kenntnisnahme CHECK (
    is_spontaneous = false
    OR spontaneous_kind IN ('folgeantrag', 'rueckkommen')
    OR item_kind = 'kenntnisnahme'
    OR unannounced_basis IS NOT NULL
) NOT VALID;

-- ── Der Vermerk braucht seine Grundlage ────────────────────────────────────
--
-- Die Schranke oben fängt einen Weg ab, der den Vermerk vergisst, aber keinen,
-- der ihn zu Unrecht setzt (Sicherheitsprüfung 29.09.2026). Ein Vermerk
-- «reglement» steht deshalb nur, wenn die Momentaufnahme derselben Versammlung
-- die Angabe trägt. Heute setzt ihn allein `nimmTraktandumAuf`, nach genau
-- dieser Prüfung; der Auslöser hält die Regel auch für den nächsten Weg.
-- Gemeldet wird er als verletzte Schranke mit eigenem Namen, damit die
-- Anwendung ihn wie jede andere übersetzt.
CREATE OR REPLACE FUNCTION agenda_ausnahme_traegt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.unannounced_basis = 'reglement' AND NOT EXISTS (
        SELECT 1 FROM snapshot s
        WHERE s.meeting_id = NEW.meeting_id AND s.unannounced_bylaw_allowed
    ) THEN
        RAISE EXCEPTION 'Das Reglement dieser Versammlung gestattet keine Beschlüsse über nicht angekündigte Gegenstände.'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'agenda_ausnahme_ohne_grundlage';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER agenda_ausnahme_traegt
    BEFORE INSERT OR UPDATE OF unannounced_basis ON agenda_item
    FOR EACH ROW EXECUTE FUNCTION agenda_ausnahme_traegt();

COMMENT ON COLUMN agenda_item.spontaneous_kind IS
    'Bei einem während der Sitzung aufgenommenen Traktandum: folgeantrag (im Kern '
    'des angekündigten Grundantrags, Abstimmung zulässig), rueckkommen '
    '(Ordnungsantrag zu einem behandelten Traktandum, Abstimmung zulässig) oder '
    'neu (nicht angekündigt; zur Abstimmung nur mit vermerkter Ausnahme, '
    'unannounced_basis). NULL bei angekündigten Traktanden.';
COMMENT ON COLUMN agenda_item.unannounced_basis IS
    'Bei einem nicht angekündigten Geschäft, das zur Abstimmung darf: worauf es sich '
    'stützt. reglement = das Reglement gestattet es (Fundstelle in der Momentaufnahme), '
    'universal = Universalversammlung. Sonst NULL.';
COMMENT ON COLUMN snapshot.unannounced_bylaw_allowed IS
    'Angabe der Gemeinschaft bei der Freigabe: Das Reglement gestattet Beschlüsse über '
    'nicht angekündigte Gegenstände (Migration 126).';
