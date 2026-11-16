-- 038 — Wer die Stimme tatsächlich abgegeben hat (Welle 2, FR-38, FR-56)
--
-- Bisher kannte eine Stimme zwei Aussagen: zu welcher Partei sie gehört, und ob
-- die Sitzungsleitung sie erfasst hat. Das genügte, solange jede Partei nur
-- selbst abstimmen konnte.
--
-- Mit der Vollmacht kommt ein dritter Fall dazu: Eine bevollmächtigte Person,
-- die selbst Eigentümerin ist, gibt am eigenen Telefon **mehrere** Stimmen ab —
-- ihre eigene und die der Parteien, für die sie eine Vollmacht hält. Ohne diese
-- Spalte sähe die zweite Stimme aus wie eine, die der Vertretene selbst abgegeben
-- hätte. FR-56 verlangt aber ausdrücklich, dass zu jeder Stimme festgehalten
-- ist, wer sie erfasst hat — und «wer sie ausgeübt hat» ist im Streitfall genau
-- die Frage, weil daran die Vertretungsmacht hängt.
--
-- **Nur beim Abweichen gesetzt.** Wer für sich selbst stimmt, lässt die Spalte
-- leer; ein Wert, der in neun von zehn Zeilen dasselbe wiederholt, verdeckt die
-- Ausnahme, statt sie zu zeigen.
ALTER TABLE vote ADD COLUMN cast_by_party_id uuid;

ALTER TABLE vote ADD CONSTRAINT vote_ausuebende_partei
    FOREIGN KEY (cast_by_party_id, operator_id) REFERENCES snapshot_party (id, operator_id);

-- Sich selbst vertritt niemand: Steht hier die eigene Partei, wäre die Angabe
-- eine leere Behauptung.
ALTER TABLE vote ADD CONSTRAINT vote_ausuebende_ist_andere
    CHECK (cast_by_party_id IS NULL OR cast_by_party_id <> snapshot_party_id);

-- Und nicht beides: Wer über eine Vollmacht ausübt, tut es selbst — die
-- Sitzungsleitung erfasst dann nicht.
ALTER TABLE vote ADD CONSTRAINT vote_vollmacht_oder_leitung
    CHECK (cast_by_party_id IS NULL OR NOT recorded_by_chair);

COMMENT ON COLUMN vote.cast_by_party_id IS
    'Die Partei, die diese Stimme aufgrund einer Vollmacht ausgeübt hat. NULL heisst: die Partei selbst.';
