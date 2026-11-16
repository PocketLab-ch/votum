-- Archivieren: da behalten, aus dem Weg räumen.
--
-- **Der Auftrag** (Auftraggeber, 25.08.2026): «Kann man eigentlich archivieren? Also
-- dass die Daten noch da sind, aber nicht in der Suche und Anzeige erscheinen?»
-- Und auf die Rückfrage: «Alles. Gemeinschaften, Eigentümer und Versammlungen.»
--
-- **Warum es das bisher nicht gab und wie es sich anfühlte.** Löschen konnte man
-- eine Versammlung nur im Entwurf; ab der Freigabe steht sie in versandten
-- Einladungen, und ab dem Eröffnen ist sie ein Nachweis. Eine Eigentümerzeile
-- liess sich gar nicht entfernen, sobald eine Momentaufnahme, eine Weisung oder
-- ein Ausstand daran hing — zu Recht. Beides führte zum selben Ergebnis: Was
-- einmal da war, stand für immer in jeder Liste. Beim Aufräumen am 25.08.2026
-- mussten deshalb 580 Probegemeinschaften aus der Datenbank entfernt werden;
-- einen Weg, sie bloss aus dem Weg zu räumen, gab es nicht.
--
-- **Archivieren nimmt nichts weg.** Die Zeile bleibt, alle Bezüge bleiben, der
-- Verlauf bleibt. Was sich ändert, ist eine einzige Frage: Erscheint sie in den
-- Listen, in denen man **auswählt** und **sucht**? Wo dagegen **nachgeschlagen**
-- wird — Verlauf, Protokoll, der Name einer Mitgliedsgemeinschaft, die Seite des
-- Gegenstands selbst — bleibt sie sichtbar. Ein Filter, der beide Fragen gleich
-- beantwortet, nähme an einem Ende zu viel weg: Im Verlauf stünden Zeilen ohne
-- Namen.
--
-- **Kein Zustandsfeld, sondern ein Zeitpunkt.** Wann archiviert wurde, gehört
-- zur Auskunft — «seit wann liegt das hier?» ist die erste Frage, die jemand
-- stellt, der es wiederfindet. Ein `boolean` könnte sie nicht beantworten.
--
-- **Was NICHT hier steht: welche Zustände archivierbar sind.** Eine laufende
-- Versammlung zu archivieren wäre falsch, und eine freigegebene ebenso — dort
-- stehen Einladungen aus. Diese Regel steht im Kern (`domain/archiv.ts`), weil
-- sie einen Satz braucht: «Eine Schranke der Datenbank ist keine
-- Fehlermeldung» (docs/gestaltung.md). Ein CHECK darüber schlüge ausserdem
-- später zu, wenn ein archivierter Entwurf freigegeben wird — mit einer
-- Meldung, die von der Freigabe handelt und nicht vom Archiv.

ALTER TABLE stweg   ADD COLUMN archived_at timestamptz, ADD COLUMN archived_note text;
ALTER TABLE meeting ADD COLUMN archived_at timestamptz, ADD COLUMN archived_note text;
ALTER TABLE party   ADD COLUMN archived_at timestamptz, ADD COLUMN archived_note text;
ALTER TABLE person  ADD COLUMN archived_at timestamptz, ADD COLUMN archived_note text;

-- Eine Notiz ohne Zeitpunkt gehört zu nichts: Sie stünde an einem Gegenstand,
-- der gar nicht archiviert ist, und niemand fände sie je wieder.
ALTER TABLE stweg
    ADD CONSTRAINT stweg_archivnotiz CHECK (archived_note IS NULL OR archived_at IS NOT NULL);
ALTER TABLE meeting
    ADD CONSTRAINT meeting_archivnotiz CHECK (archived_note IS NULL OR archived_at IS NOT NULL);
ALTER TABLE party
    ADD CONSTRAINT party_archivnotiz CHECK (archived_note IS NULL OR archived_at IS NOT NULL);
ALTER TABLE person
    ADD CONSTRAINT person_archivnotiz CHECK (archived_note IS NULL OR archived_at IS NOT NULL);

-- Die Listen fragen «alle nicht archivierten» — ein Teilindex trägt genau das.
CREATE INDEX stweg_aktiv_idx   ON stweg (operator_id)   WHERE archived_at IS NULL;
CREATE INDEX meeting_aktiv_idx ON meeting (operator_id) WHERE archived_at IS NULL;
CREATE INDEX party_aktiv_idx   ON party (stweg_id)      WHERE archived_at IS NULL;
CREATE INDEX person_aktiv_idx  ON person (operator_id)  WHERE archived_at IS NULL;

COMMENT ON COLUMN stweg.archived_at IS
    'Seit wann diese Gemeinschaft archiviert ist: aus Auswahl und Suche genommen, '
    'überall sonst unverändert sichtbar. Die Regel, wer was liest, steht in '
    'src/lib/server/archiv.ts.';
