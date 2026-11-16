-- Die festgehaltene Beschlussfähigkeit hält fest, WIE VIELE MENSCHEN da waren.
--
-- **Der Anlass** (26.08.2026, aus der juristischen Prüfung zu Art. 712o). Die
-- Feststellung nach Art. 712p speicherte bisher nur `head_present` und
-- `head_total` — Kopfstimmen. Bei der Zählweise «je Einheit» sind das die
-- Einheiten. Wem drei Wohnungen gehören, der brachte drei «Köpfe» mit und
-- erfüllte das «mindestens aber zwei» im Alleingang; die Versammlung galt als
-- beschlussfähig, obwohl nur ein Mensch anwesend war.
--
-- Art. 712p Abs. 1 verlangt «die Hälfte aller Stockwerkeigentümer … mindestens
-- aber zwei», Abs. 3 «ein Drittel aller Stockwerkeigentümer, mindestens aber
-- zwei». Das sind Personen. Die Bestimmung ist relativ zwingend — das Reglement
-- darf sie erschweren, nicht erleichtern —, also verschiebt ein
-- reglementarisches Anteilsstimmrecht die Mehrheit, nicht die
-- Beschlussfähigkeit.
--
-- **Die Kopfstimmen bleiben stehen.** Sie sind nicht falsch, nur nicht die
-- Grundlage von 712p: Das Protokoll weist sie aus, und die Mehrheit rechnet auf
-- ihnen.
ALTER TABLE quorum_finding ADD COLUMN owner_present numeric;
ALTER TABLE quorum_finding ADD COLUMN owner_total   numeric;

-- **Bestehende Zeilen bleiben leer — mit Absicht.**
--
-- Sie aus `head_present`/`head_total` zu füllen wäre bequem und gelogen: Bei
-- «je Eigentümer» stimmten die Zahlen zufällig überein, bei «je Einheit» nicht,
-- und hinterher wäre nicht mehr unterscheidbar, welche Zeile welchen Fall
-- trägt. Eine alte Feststellung ist auf der alten Grundlage ergangen; NULL sagt
-- das, eine abgeschriebene Zahl behauptete das Gegenteil.
--
-- Die Anzeige fällt für solche Zeilen auf die Kopfstimmen zurück und sagt dazu,
-- dass die Feststellung von vor der Umstellung stammt.
COMMENT ON COLUMN quorum_finding.owner_present IS
    'Anwesende oder vertretene Stockwerkeigentuemer (Personen). NULL bei Feststellungen von vor dem 26.08.2026.';
COMMENT ON COLUMN quorum_finding.owner_total IS
    'Stockwerkeigentuemer insgesamt (Parteien mit mindestens einer Einheit). NULL bei Feststellungen von vor dem 26.08.2026.';

-- Beide oder keine. Eine halbe Feststellung liesse sich nicht anzeigen, ohne zu
-- raten, welche Haelfte fehlt.
ALTER TABLE quorum_finding
    ADD CONSTRAINT quorum_finding_eigentuemer_paarweise
    CHECK ((owner_present IS NULL) = (owner_total IS NULL));

-- Nicht mehr Anwesende als Eigentuemer. Dieselbe Schranke fehlt bei den
-- Kopfstimmen; sie hier nachzuziehen waere eine Aenderung an bestehenden Daten
-- und gehoert nicht in diese Migration.
ALTER TABLE quorum_finding
    ADD CONSTRAINT quorum_finding_eigentuemer_plausibel
    CHECK (owner_present IS NULL OR (owner_present >= 0 AND owner_present <= owner_total));
