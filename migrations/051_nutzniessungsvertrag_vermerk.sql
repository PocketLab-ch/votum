-- 051 — Der Vermerk genügt (FR-4)
--
-- **Einwand des Auftraggebers vom 05.08.2026:** «Der Vertrag mit dem Nutzniesser liegt
-- eigentlich schon vor der Versammlung beim Verwalter, weil dies elementar ist.
-- Darum genügt es, wenn man vermerkt, dass ein Vertrag vorhanden ist.»
--
-- Migration 049 verlangte der Sache nach eine hochgeladene Kopie und meldete
-- sonst eine Lücke. Das war am Alltag vorbei: Wer eine Nutzniessung erfasst, hat
-- den Vertrag längst — er ist die Grundlage der Erfassung. Ihn ein zweites Mal
-- in die Anwendung zu heben, ist eine Bequemlichkeit, kein Nachweis.
--
-- Damit dieselbe Ordnung wie bei der Vollmacht: **«Liegt vor» ist ein
-- vollwertiger Vermerk, die Datei ist ein Nachtrag.** Dort hat sie sich
-- bewährt, und zwei verschiedene Regeln für dieselbe Frage wären eine zu viel.
ALTER TABLE usufruct ADD COLUMN contract_on_file boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN usufruct.contract_on_file IS
    'Vermerk der Bewirtschaftung: Der Nutzniessungsvertrag liegt vor. Vollwertiger Nachweis; die hinterlegte Kopie ist ein Nachtrag (FR-4).';

-- Wo eine Kopie hinterlegt ist, liegt der Vertrag offensichtlich vor.
UPDATE usufruct u SET contract_on_file = true
 WHERE EXISTS (
   SELECT 1 FROM attachment a WHERE a.subject_type = 'usufruct' AND a.subject_id = u.id
 );

-- ── In der Momentaufnahme ──────────────────────────────────────────────────
--
-- Zwei Angaben statt einer, weil es zwei verschiedene Tatsachen sind: Ob die
-- Bewirtschaftung den Vertrag hat, und ob eine Kopie in der Anwendung liegt.
-- Beides gehört eingefroren (AD-3) — wer morgen etwas nachträgt, ändert nicht,
-- was gestern vorlag.
ALTER TABLE snapshot_unit ADD COLUMN usufruct_contract_on_file boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN snapshot_unit.usufruct_contract_on_file IS
    'Ob der Nutzniessungsvertrag bei der Freigabe der Bewirtschaftung vorlag (FR-4).';
