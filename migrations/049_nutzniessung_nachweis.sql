-- 049 — Ob zur Vereinbarung eine Kopie vorliegt (FR-4)
--
-- **Abgleich mit dem Ratgeber der Webseite** (05.08.2026). Dort steht zur
-- Nutzniessung: «Eigentümer und Nutzniesser können vertraglich frei regeln, wer
-- das Stimmrecht ausübt … **Die Bewirtschaftung benötigt dazu eine Kopie des
-- Nutzniessungsvertrags.**»
--
-- Das Werkzeug verlangte bisher nur eine Zusammenfassung in Worten. Im Saal
-- stand damit eine Vereinbarung da, deren Beleg niemand hatte — und gerade sie
-- verdrängt die gesetzliche Auffangregel vollständig.
--
-- **Ein Hinweis, keine Sperre.** Der Vertrag liegt vielleicht beim Notar, und
-- eine Versammlung darf daran nicht scheitern. Aber sie soll es wissen.
--
-- Mit eingefroren wie der übrige Stand der Nutzniessung (AD-3): Wer die Kopie
-- morgen nachreicht, ändert nichts daran, was gestern vorlag.
ALTER TABLE snapshot_unit ADD COLUMN usufruct_has_document boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN snapshot_unit.usufruct_has_document IS
    'Ob zur Nutzniessung bei der Freigabe eine Kopie des Vertrags hinterlegt war (FR-4).';
