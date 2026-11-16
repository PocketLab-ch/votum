-- 063 — Fehlversuche kennen ihre Herkunft
--
-- **Die Lücke.** Die Sperre zählt Fehlversuche je Benutzername. Wer *ein* Konto
-- durchprobiert, wird gebremst; wer *viele Namen* je einmal versucht, läuft
-- daran vorbei — jeder Name hat seinen eigenen Zähler, und keiner erreicht
-- fünf. Genau so sehen Wörterbuchangriffe auf Benutzernamen aus.
--
-- Dagegen hilft nur eine zweite Zählung, und die braucht eine Herkunft.
--
-- ## Warum kein Prüfwert, sondern die Adresse selbst
--
-- Erwogen und verworfen: die Adresse nur als Hash abzulegen. Das schützt
-- niemanden — der Adressraum ist klein genug, um ihn vollständig
-- durchzurechnen. Es machte die Zeilen bloss unbrauchbar für den Fall, für den
-- man sie im Ernstfall braucht: nachzusehen, woher es kam.
--
-- ## Was sie nicht ist
--
-- **Kein Zugriffsprotokoll.** Festgehalten wird nur der **fehlgeschlagene**
-- Anmeldeversuch, nicht jeder Aufruf. Die geglückte Anmeldung steht ohnehin im
-- Verlauf, dort ohne Adresse: Wer angemeldet ist, wird nicht verfolgt.
--
-- **Und die Spalte darf leer bleiben.** Steht die Anwendung hinter einem
-- Reverse Proxy ohne gesetzten `ADDRESS_HEADER`, wäre die Adresse die des
-- Proxys — eine Sperre darauf träfe alle zugleich. Dann wird gar keine Adresse
-- geschrieben und nicht nach Herkunft gesperrt. Eine wirkungslose Sperre ist
-- besser als eine, die die Falschen trifft.
ALTER TABLE login_attempt ADD COLUMN client_ip inet;

-- Für die zweite Zählung: verschiedene Namen je Adresse im Zeitfenster.
CREATE INDEX login_attempt_herkunft_idx
    ON login_attempt (client_ip, attempted_at DESC)
    WHERE client_ip IS NOT NULL AND succeeded = false;

COMMENT ON COLUMN login_attempt.client_ip IS
    'Herkunft des Versuchs, sofern verlässlich bekannt. NULL heisst: keine vertrauenswürdige Adresse — dann wird nicht nach Herkunft gesperrt.';

-- ── Aufräumen, was nicht mehr gebraucht wird ───────────────────────────────
--
-- **Kein Cron, kein Timer** — aufgeräumt wird auf Ansage. Was hier steht, ist
-- die Abfrage dafür, nicht ein Auftrag an die Datenbank:
--
--   DELETE FROM login_attempt WHERE attempted_at < now() - interval '30 days';
--
-- Die Sperre schaut 15 Minuten zurück; alles darüber hinaus dient allein der
-- Frage «hat es jemand versucht». Nach dreissig Tagen ist auch die beantwortet.
