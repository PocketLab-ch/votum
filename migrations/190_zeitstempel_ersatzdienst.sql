-- Ersatzdienst für den Zeitstempel (13.11.2026).
--
-- **Der Anlass.** Produktentscheid 13.11.2026: «Hauptdienst DigiCert, freetsa
-- Ersatz». DigiCert ist nach ZertES anerkannt und trägt den Beweiswert; die
-- Anheftung macht die Anwendung aber streng, und genau das ist ihr Zweck: Sie
-- nimmt nur einen Stempel an, dessen Zertifikat sie kennt. Wechselt DigiCert
-- das Unterzeichnerzertifikat (der Name trägt die Jahreszahl, «DigiCert
-- SHA256 RSA4096 Timestamp Responder 2026 1»), lehnt die Anheftung jeden
-- Stempel des Hauses ab, bis jemand den neuen Abdruck anheftet. In dieser Zeit
-- stünde jedes Siegel ohne Bezeugung da.
--
-- **Dagegen ein zweiter Dienst, nicht eine lockere Prüfung.** Der Ersatz hat
-- seine **eigene** Liste angehefteter Abdrücke und wird nur gefragt, wenn der
-- Hauptdienst keinen geprüften Stempel liefert. Die Prüfung wird nirgends
-- weicher; es kommt eine zweite, ebenso geprüfte Stelle dazu.
--
-- **Nur in der Anwendung einstellbar.** Anders als der Hauptdienst hat der
-- Ersatz keine Umgebungsvariable: Er ist eine Ausweichung im Betrieb, und die
-- gehört in die Maske, wo ihr Zustand sichtbar ist. Bestehende Betreiber haben
-- danach keinen Ersatz; die Spalten sind leer, und ohne Eintrag ändert sich
-- nichts.

ALTER TABLE operator
    ADD COLUMN tsa_fallback_url          text,
    ADD COLUMN tsa_fallback_name         text,
    ADD COLUMN tsa_fallback_fingerprints text;

ALTER TABLE operator
    ADD CONSTRAINT operator_tsa_fallback_url
    CHECK (tsa_fallback_url IS NULL OR tsa_fallback_url ~ '^https?://');

COMMENT ON COLUMN operator.tsa_fallback_url IS
    'Ersatz-Zeitstempeldienst nach RFC 3161. Wird erst gefragt, wenn der Hauptdienst keinen geprüften Stempel liefert. Nur in der Anwendung einstellbar.';
COMMENT ON COLUMN operator.tsa_fallback_name IS
    'Bezeichnung des Ersatzdienstes. Steht in der Bemerkung am Siegel, damit ein Leser beide Häuser auseinanderhält.';
COMMENT ON COLUMN operator.tsa_fallback_fingerprints IS
    'SHA-256-Fingerabdrücke der zugelassenen Signaturzertifikate des Ersatzdienstes, kommagetrennt. Gilt nur für ihn: Die Liste des Hauptdienstes deckt ihn nicht.';

-- Welcher Dienst das Siegel tatsächlich bezeugt hat (13.11.2026).
--
-- **Ein eigenes Feld statt eines Textvergleichs.** Die Bemerkung
-- (`timestamp_note`) nennt den Grund im Klartext, aber ihr Wortlaut ist für
-- Menschen geschrieben und darf sich ändern. Die Siegelseiten und der
-- Betriebszustand müssen die Frage «hat der Ersatz bezeugt?» beantworten,
-- ohne in einem Satz zu suchen.
ALTER TABLE seal
    ADD COLUMN timestamp_by_fallback boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN seal.timestamp_by_fallback IS
    'Ob der Zeitstempel vom Ersatzdienst stammt. Wahr nur, wenn der Ersatz das Siegel tatsächlich bezeugt hat; bei ausstehend oder gescheitert bleibt das Feld falsch.';
