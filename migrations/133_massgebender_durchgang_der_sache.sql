-- 133 — Der massgebende Durchgang einer Sache, auch über einen Folgeantrag
--
-- Plan `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Block B1.
--
-- **Der Anlass.** Produktentscheid 30.09.2026: Nach einem angenommenen
-- Rückkommen darf statt des alten Antrags ein Folgeantrag zur Abstimmung
-- kommen, «statt des alten». Fasst die Versammlung darüber einen Beschluss,
-- ersetzt er den des Grundtraktandums. Der frühere Durchgang wird dabei wie
-- bisher als `rueckkommen` überholt, und `superseded_by_round_id` zeigt auf den
-- Durchgang des Folgeantrags, also auf ein **anderes** Traktandum.
--
-- Bis hierher fragten alle Stellen «ist über dieses Traktandum entschieden?»
-- nach dem jüngsten nicht überholten Durchgang **desselben** Traktandums. Nach
-- einer Ersetzung über den Folgeantrag hat das Grundtraktandum keinen mehr, und
-- jede dieser Stellen hielte es für unbehandelt: Es liesse sich wie zum ersten
-- Mal abstimmen, ein weiterer Folgeantrag liesse sich ohne Rückkommen
-- aufnehmen, und ein neuer Rückkommensantrag trüge den Wortlaut für einen
-- abgelehnten Antrag, obwohl ein Beschluss gilt (Plan, Ist 4 und 5).
--
-- **Eine Antwort für alle Leser.** Die Funktion liefert den massgebenden
-- Durchgang der Sache: den jüngsten nicht überholten des Traktandums selbst,
-- sonst das Ende der Kette, die über `superseded_by_round_id` von einem als
-- `rueckkommen` überholten Durchgang weiterführt. Ohne Ersetzung über ein
-- anderes Traktandum ist das dieselbe Antwort wie bisher. Wird der Durchgang
-- des Folgeantrags als `korrektur` überholt, nimmt `setzeNeuabstimmungAn` die
-- Überholung des früheren zurück und löscht den Verweis; die Kette endet dann
-- wieder beim Grundtraktandum.
--
-- Der jüngste, weil ein Durchgang unter einem angenommenen Rückkommen offen
-- neben dem geltenden stehen kann, bis er geschlossen ist; die Stellen, die
-- bisher `ORDER BY ordinal DESC` lasen, sahen dann den offenen. Über zwei
-- Traktanden hinweg vergleicht die Nummer nichts, deshalb die Eröffnungszeit.
--
-- `ausser` lässt einen Durchgang aus: Beim Schliessen ist der frühere gesucht,
-- nicht der eben geschlossene (`schliesseInTransaktion`).
--
-- Unter der Zeilensperre des Aufrufers (`SECURITY INVOKER`, Vorgabe): Die
-- Funktion sieht nur, was der Betreiber sieht.

CREATE FUNCTION massgebender_durchgang(traktandum uuid, ausser uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql STABLE
AS $$
    WITH RECURSIVE kette AS (
        SELECT v.id, v.superseded_at, v.supersede_kind, v.superseded_by_round_id,
               v.opened_at, v.ordinal
          FROM voting_round v
         WHERE v.agenda_item_id = traktandum
        UNION
        SELECT n.id, n.superseded_at, n.supersede_kind, n.superseded_by_round_id,
               n.opened_at, n.ordinal
          FROM kette k
          JOIN voting_round n ON n.id = k.superseded_by_round_id
         WHERE k.supersede_kind = 'rueckkommen'
    )
    SELECT id FROM kette
     WHERE superseded_at IS NULL AND id IS DISTINCT FROM ausser
     ORDER BY opened_at DESC, ordinal DESC, id DESC
     LIMIT 1
$$;

COMMENT ON FUNCTION massgebender_durchgang(uuid, uuid) IS
    'Der massgebende Durchgang der Sache: der jüngste nicht überholte des Traktandums, sonst das Ende der Kette über superseded_by_round_id nach einer Ersetzung durch einen Folgeantrag (Migration 133). ausser lässt einen Durchgang aus.';

-- **Ob der Beschluss über ein anderes Traktandum ersetzt ist.** Die Sperren,
-- die bisher «gibt es einen nicht überholten Durchgang?» zählten (zweiter
-- Durchgang, Erfordernis, Rückzug, Weisung, Reihenfolge), fragen nicht nach
-- dem jüngsten, sondern ob überhaupt einer gilt; während ein neuer Durchgang
-- offen ist, zählt der alte mit. Für sie genügt `massgebender_durchgang` nicht:
-- Er nennt dann den offenen. Diese Funktion ergänzt ihre Zählung um den einen
-- neuen Fall.
--
-- Der Verweis besteht, solange die Ersetzung gilt, auch wenn der Beschluss des
-- Folgeantrags seinerseits nach einem weiteren Rückkommen ersetzt wurde: Die
-- Sache ist dann weiter entschieden. Wird der ersetzende Durchgang als
-- `korrektur` überholt, löscht `setzeNeuabstimmungAn` den Verweis, und der
-- frühere Durchgang gilt wieder als eigener.

CREATE FUNCTION durch_anderes_traktandum_ersetzt(traktandum uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM voting_round frueher
          JOIN voting_round neu ON neu.id = frueher.superseded_by_round_id
         WHERE frueher.agenda_item_id = traktandum
           AND frueher.supersede_kind = 'rueckkommen'
           AND neu.agenda_item_id <> traktandum
    )
$$;

COMMENT ON FUNCTION durch_anderes_traktandum_ersetzt(uuid) IS
    'Wahr, wenn ein Beschluss dieses Traktandums nach einem Rückkommen durch den Beschluss zu einem anderen Traktandum (Folgeantrag) ersetzt ist; das Traktandum gilt dann als entschieden (Migration 133).';
