-- 138 — «versandt» nur mit Siegel, auch in der Datenbank
-- (Produktentscheid 03.10.2026: «Ja, auch in der Datenbank»).
--
-- **Der Anlass.** Seit Block 8 weist `halteFassungFest` die Art `versandt` ab,
-- solange die Versammlung nicht versiegelt ist: Mit dem Siegel entsteht das
-- Abschlusspaket, und erst dann lässt sich sagen, welchen Text die Eigentümer
-- zusammen mit welchem Nachweis bekommen haben. Die Sperre sass aber nur in der
-- Anwendung; ein INSERT an ihr vorbei — eine spätere Fassung, ein Skript, ein
-- direkter Zugriff — legte eine versandte Fassung ohne Siegel an.
--
-- **Warum ein Auslöser und nicht eine Prüfung in der Anwendung.** Dieselbe
-- Begründung wie bei `verhindere_nach_siegel` (039): Wer morgen einen neuen
-- Schreibweg baut, kommt hier vorbei, ob er will oder nicht.
--
-- **Geprüft werden nur neue Zeilen.** Bestehende versandte Fassungen an
-- unversiegelten Versammlungen bleiben gültig; kein Bereinigen, kein
-- Nachführen. Ob es sie auf Prod gibt, zählt die abnehmende Sitzung vor dem
-- Ausrollen. Der Zweig für UPDATE greift heute nie, weil
-- `minutes_version_unveraenderlich` (037) jede Änderung abweist; er steht da,
-- damit die Regel auch dann gilt, wenn diese Sperre einmal fällt.
--
-- **Die Funktion `versammlung_versiegelt` ist dieselbe wie in 039.** Eine
-- zweite Prüfung hier liefe auseinander, sobald der Zustandsname sich ändert.
-- Am Protokoll selbst ändert der Auslöser nichts: Es ist ausdrücklich nicht
-- Teil des Siegels (PRD §4.11) und bleibt nach dem Versiegeln bearbeitbar;
-- nur die versandte Fassung setzt das Siegel voraus.
CREATE OR REPLACE FUNCTION minutes_version_versandt_nur_versiegelt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.kind = 'versandt' AND NOT versammlung_versiegelt(NEW.meeting_id) THEN
        RAISE EXCEPTION
            'Eine versandte Protokollfassung setzt das Siegel voraus. Versiegeln Sie die Versammlung zuerst.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER minutes_version_versandt_nur_versiegelt_trigger
    BEFORE INSERT OR UPDATE ON minutes_version
    FOR EACH ROW EXECUTE FUNCTION minutes_version_versandt_nur_versiegelt();
