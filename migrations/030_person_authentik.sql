-- Der Anknüpfungspunkt für einen eigenen Zugang der Eigentümer.
--
-- **Die UUID, nicht die Adresse.** Authentik liefert im `sub`-Anspruch eine
-- unveränderliche Kennung. E-Mail-Adressen und Benutzernamen ändern sich —
-- jemand heiratet, wechselt den Anbieter, die Bewirtschaftung berichtigt einen
-- Tippfehler. Wer daran anknüpft, verliert entweder den Zugang oder gibt ihn
-- dem Falschen: Eine freigewordene Adresse kann neu vergeben werden.
--
-- Eine Kennung je **Person**, nicht je Gemeinschaft: Wer in fünf Gemeinschaften
-- Einheiten hält, meldet sich einmal an und sieht alle.
--
-- Der Anmeldeweg selbst ist damit noch nicht gebaut. Was hier steht, ist die
-- Spalte, an der er hängen wird — additiv und ohne Wirkung, solange sie leer ist.

ALTER TABLE person ADD COLUMN authentik_subject text;

-- Zwei Personen mit derselben Kennung wären zwei Menschen mit einem Zugang.
CREATE UNIQUE INDEX person_authentik_eindeutig
    ON person (operator_id, authentik_subject)
    WHERE authentik_subject IS NOT NULL;

COMMENT ON COLUMN person.authentik_subject IS
    'Unveränderliche Kennung aus Authentik (sub-Anspruch, UUID). Nie die E-Mail-Adresse.';
