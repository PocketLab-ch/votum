-- 008 — Fremdkennung für die Übernahme (Story 1.9, FR-6)
--
-- Ohne sie wäre jede erneute Übernahme derselben Datei eine Verdoppelung: Es
-- gäbe kein Merkmal, an dem sich ein Datensatz wiedererkennen liesse. Der Name
-- taugt nicht dafür — er ändert sich (Heirat, Firmenumbenennung), und genau dann
-- soll die Übernahme ihn berichtigen, nicht eine zweite Person anlegen.
--
-- Die Kennung stammt aus der Datei (`voter_ref`, `holding_ref` im Schema des
-- Vorgängerprojekts) und ist nur innerhalb einer Gemeinschaft eindeutig.

ALTER TABLE party ADD COLUMN import_ref text;
ALTER TABLE unit  ADD COLUMN import_ref text;

CREATE UNIQUE INDEX party_import_ref_idx
    ON party (stweg_id, import_ref) WHERE import_ref IS NOT NULL;

CREATE UNIQUE INDEX unit_import_ref_idx
    ON unit (stweg_id, import_ref) WHERE import_ref IS NOT NULL;

-- Eine Nutzniessung wird bei einer erneuten Übernahme nicht verdoppelt.
-- `ON CONFLICT DO NOTHING` braucht dafür eine eindeutige Schranke.
CREATE UNIQUE INDEX usufruct_einmalig_idx
    ON usufruct (unit_id, holder_name, valid_from);
