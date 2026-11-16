-- Die Traktandennummer hängt an der Einladung, nicht an der Reihenfolge.
--
-- **Der Anlass, am 21.08.2026.** Ein Rückkommensantrag war im Saal von Platz 9
-- auf Platz 8 gezogen worden. Die Rückfrage: «ist das ein Problem, da die
-- Traktandenliste ja freigegeben wurde?»
--
-- Das Verschieben selbst ist keines — die Reihenfolge ist ein Ordnungsentscheid
-- der Versammlung, und die Einladung nennt sie als Vorschlag, nicht als Zusage.
-- Ein Problem war die Folge: Bis hierher rechnete die Anwendung die Nummer aus
-- der Position. Wer verschob, nummerierte um. In derselben Versammlung rutschte
-- so die «Décharge an die Bewirtschaftung» von 8 auf 9 — die versandte
-- Einladung sagte danach etwas anderes als das Protokoll, und worüber
-- beschlossen wurde, hinge an der Frage, welche Fassung der Liste jemand gerade
-- vor sich hat. Bei einer Anfechtung ist genau das die Frage.
--
-- **Der Entscheid** (Auftraggeber, 21.08.2026): «Es gilt ja der Grundsatz, es kann nur
-- abgestimmt werden, was angekündigt wurde. […] Was man machen kann, ohne die
-- Traktandennummer zu ändern ist die Reihenfolge anzupassen.»
--
-- Die Nummer wird deshalb bei der Freigabe festgeschrieben — im selben
-- Arbeitsgang, in dem auch der Stimmberechtigtenstand festgehalten wird
-- (`snapshot`, AD-3). Beides aus demselben Grund: Was mit der Einladung
-- hinausgeht, muss nachher noch dasselbe sein.
--
-- **Warum eine eigene Spalte und nicht `manual_number`.** Die trägt, was jemand
-- von Hand eingetippt hat, und wird in der Liste eigens gekennzeichnet
-- (gepunktet unterstrichen). Wären nach der Freigabe alle Nummern «von Hand
-- gesetzt», wäre die Kennzeichnung wertlos und die Herkunft nicht mehr
-- erkennbar. Ausserdem schreibt der Versammlungstag `manual_number` für die
-- gemeinsame Liste mehrerer Häuser (`geschaeft.ts`) — zwei Schreiber auf einer
-- Spalte, die Verschiedenes bedeuten, laufen früher oder später auseinander.
ALTER TABLE agenda_item ADD COLUMN released_number text;

-- **Das Muster ist weiter als bei `manual_number`**, und zwar notwendig: Steht
-- ein Traktandum von Hand auf «7a», heisst sein Untertraktandum «7a.1». Diese
-- zusammengesetzte Nummer wird bei der Freigabe mitgeschrieben, und das engere
-- Muster (`^[0-9]+(\.[0-9]+)*[A-Za-z]{0,3}$`) wiese sie ab — die Freigabe
-- schlüge fehl, mit einer Datenbankmeldung statt einer Auskunft.
--
-- Die Längenschranke deckt vier Ebenen mit Zusatz ab (GROESSTE_TIEFE = 4).
ALTER TABLE agenda_item
	ADD CONSTRAINT agenda_freigabenummer CHECK (
		released_number IS NULL
		OR (released_number ~ '^[0-9]+[A-Za-z]{0,3}(\.[0-9]+[A-Za-z]{0,3})*$'
		    AND length(released_number) <= 40)
	);

COMMENT ON COLUMN agenda_item.released_number IS
	'Die Nummer aus der Einladung, bei der Freigabe festgeschrieben. NULL bei allem, was danach im Saal hinzukam.';
