-- Der Schreibschutz nach dem Siegel wartet auf ein laufendes Versiegeln.
--
-- Befund D7 aus dem Sicherheitsdurchgang vom 09.10.2026
-- (`docs/befunde-sicherheitsdurchgang-2026-10-09.md`). Das Versiegeln las das
-- Paket ohne Sperre und schrieb Siegel und Zustand danach in einer eigenen
-- Transaktion. Ein Text zum Beschluss, der dazwischen gespeichert wurde, stand
-- danach in der Datenbank und nicht im Paket: Das Siegel bezeugte einen Stand,
-- den die Datenbank nicht mehr hergab (gemessen 13.10.2026,
-- `tests/db/abschluss-rennen.test.ts`).
--
-- **Die Abwehr hat zwei Hälften.** `versiegle` hält die Versammlung vom Lesen
-- der Lage bis zum Zustandswechsel mit `FOR UPDATE`. Diese Funktion, über die
-- siebzehn Auslöser laufen (Migration 039 und spätere; sechzehn sind
-- Schreibschutz, `minutes_version` lässt «versandt» erst nach dem Siegel zu),
-- liest eine geschlossene Versammlung ein zweites Mal, mit
-- `FOR KEY SHARE`. Das verträgt sich mit jeder gewöhnlichen Sperre und jedem
-- `UPDATE meeting`, aber nicht mit `FOR UPDATE`: Ein Schreibweg wartet also,
-- bis das Siegel steht oder abgebrochen ist, und liest danach den neuen
-- Zustand. Ist er `versiegelt`, weist der Auslöser ab wie bisher.
--
-- **Warum der Zustand und nicht das Siegel.** Die Auslöser prüfen `meeting.state`,
-- nicht ob eine Zeile in `seal` steht (Hinweis im Befund, 039:117). Das kann so
-- bleiben: Siegel und Zustand entstehen in derselben Transaktion unter derselben
-- Sperre, und ein Zustand `versiegelt` ohne Siegel kommt auf diesem Weg nicht
-- zustande. Was fehlte, war nicht die Frage, sondern das Warten auf die Antwort.
--
-- **Warum nur bei `geschlossen` gesperrt wird** (Codeprüfung H5). Bei `UPDATE`
-- und `DELETE` sperrt PostgreSQL die Zeile, bevor der Auslöser läuft. Sperrte
-- die Funktion danach in jedem Zustand die Versammlung, entstünde die Folge
-- «Kindzeile, dann Versammlung», gegenläufig zu jedem Weg, der die Versammlung
-- mit `FOR UPDATE` hält und danach Kindzeilen schreibt: Die Freigabe schreibt
-- die Traktandennummern, während im Entwurf ein Traktandum bearbeitet wird,
-- und PostgreSQL bräche einen der beiden mit einer Verklemmung ab. Versiegelt
-- wird nur aus `geschlossen`; dort sperrt kein solcher Weg, und das Siegel
-- selbst schreibt keine Kindzeilen. In den übrigen Zuständen bleibt alles wie
-- vor dieser Migration, auch für jede Stimme im Saal.
--
-- **Was bleibt:** Ein Schreibweg, der noch «laufend» liest, sperrt nicht. Er
-- käme am Siegel nur vorbei, wenn zwischen seiner Prüfung und seinem Commit
-- der Schluss der Versammlung, ein eigener Klick aufs Versiegeln und dessen
-- Lesen seiner Tabelle lägen. Kein Weg schliesst und versiegelt im selben
-- Zug, und keine Schreibtransaktion bleibt so lange offen. Hingenommen. Das
-- gilt auch für neue Zeilen: Ihre Prüfung des Fremdschlüssels wartet zwar auf
-- das Siegel, läuft aber nach diesem Auslöser und fragt nicht neu.
--
-- `VOLATILE`, weil eine Sperre in einer `STABLE`-Funktion nicht zulässig ist.
-- Gepinnt wie die Funktionen mit SECURITY DEFINER, obwohl diese keine ist: Sie
-- ist der eine Ort, durch den der Schreibschutz läuft, und eine temporäre
-- `meeting` soll ihn nicht füttern können (Pendenz «Auslöserfunktionen ohne
-- Pin», hier für diese eine Funktion).
CREATE OR REPLACE FUNCTION versammlung_versiegelt(kennung uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
    zustand text;
BEGIN
    SELECT m.state INTO zustand FROM meeting m WHERE m.id = kennung;
    IF zustand = 'geschlossen' THEN
        -- Ohne Bedingung auf den Zustand gelesen: Mit `AND state = 'versiegelt'`
        -- verwürfe der Plan die Zeile, bevor er sie sperrt, und wartete gerade
        -- dann nicht, wenn ein Siegel unterwegs ist. Nach dem Warten liefert
        -- die Sperre den Stand, den das Siegel hinterlassen hat.
        SELECT m.state INTO zustand FROM meeting m WHERE m.id = kennung FOR KEY SHARE;
    END IF;
    RETURN zustand IS NOT DISTINCT FROM 'versiegelt';
END;
$$;
