-- 161: Ein Nachtragssiegel je Protokollfassung nach dem Siegel
-- (Ä-39, Auftrag H8, Teil B).
--
-- **Der Anlass.** Das Siegel des Abschlusspakets deckt das Protokoll
-- ausdrücklich nicht (PRD §4.11, Migration 037): Es entsteht nach der Sitzung
-- und wird redigiert. Was hinausgeht, ist eine festgehaltene Fassung
-- (`minutes_version`, FR-50). Bis hierher liess sich von ihr nur sagen, welcher
-- Wortlaut gespeichert ist, nicht, dass er seit dem Festhalten unverändert ist
-- und wo er in der Folge der Fassungen steht.
--
-- **Der Weg.** Jede Fassung, die nach dem Siegel festgehalten wird, trägt ein
-- eigenes Siegel: ein Manifest mit der Prüfsumme ihres Wortlauts und dem
-- Verweis auf das vorige Siegel, und die Prüfsumme über dieses Manifest. Das
-- vorige ist das Siegel des Abschlusspakets oder das Nachtragssiegel der
-- vorigen Fassung. Die Form steht in `src/lib/domain/nachtragssiegel.ts`.
--
-- **Warum Spalten an der Fassung und keine eigene Tabelle.** Die Zeile ist
-- schon unveränderlich (`minutes_version_unveraenderlich`, 037) und wird von
-- allen Löschwegen erfasst (Migrationen 113, 115, 137, das Aufräumskript). Das
-- Siegel entsteht in derselben Anweisung wie die Fassung und kann deshalb
-- weder fehlen noch nachträglich dazukommen. Eine eigene Tabelle hätte jeden
-- Löschweg und jeden Schutz ein zweites Mal gebraucht.
--
-- **Geprüft wird in der Datenbank, nicht nur in der Anwendung.** Wie bei
-- `minutes_version_versandt_nur_versiegelt` (138): Wer morgen einen neuen
-- Schreibweg baut, kommt hier vorbei. Der Auslöser verlangt nach dem Siegel ein
-- Nachtragssiegel, rechnet seine Prüfsumme nach und prüft, dass es auf das
-- richtige vorige Siegel verweist und den Wortlaut dieser Zeile trägt.
--
-- **Die Kette bleibt linear**, über den eindeutigen Index auf
-- `(meeting_id, seal_previous)`: Zwei Fassungen können nicht auf dasselbe
-- vorige Siegel zeigen. Damit es dazu gar nicht erst kommt, hält
-- `halteFassungFest` die Versammlung mit `FOR UPDATE`, dieselbe Sperre wie
-- `versiegle` (Migration 157); der Index ist das Netz darunter, falls ein Weg
-- ohne die Sperre schreibt.
--
-- **Kein Nachführen für den Bestand.** Fassungen, die vor dieser Migration nach
-- dem Siegel festgehalten wurden, bleiben ohne Nachtragssiegel; die Prüfung
-- der Kette nennt sie. Ob es solche auf Prod gibt, zählt die abnehmende Sitzung
-- vor dem Ausrollen.

ALTER TABLE minutes_version
    ADD COLUMN seal_manifest text,
    ADD COLUMN seal_hash     text,
    ADD COLUMN seal_previous text;

COMMENT ON COLUMN minutes_version.seal_manifest IS
    'Manifest des Nachtragssiegels im Wortlaut (Ä-39); NULL bei einer Fassung vor dem Siegel.';
COMMENT ON COLUMN minutes_version.seal_hash IS
    'Das Nachtragssiegel: SHA-256 über seal_manifest.';
COMMENT ON COLUMN minutes_version.seal_previous IS
    'Das vorige Siegel der Kette: das des Abschlusspakets oder das Nachtragssiegel der vorigen Fassung.';

-- Alle drei oder keines: Ein Siegel ohne Manifest liesse sich nicht
-- nachrechnen, ein Manifest ohne Verweis stünde ausserhalb der Kette.
ALTER TABLE minutes_version ADD CONSTRAINT minutes_version_nachtrag_vollstaendig
    CHECK ((seal_manifest IS NULL) = (seal_hash IS NULL)
       AND (seal_hash IS NULL) = (seal_previous IS NULL));
ALTER TABLE minutes_version ADD CONSTRAINT minutes_version_nachtrag_form
    CHECK (seal_hash IS NULL
       OR (seal_hash ~ '^[0-9a-f]{64}$' AND seal_previous ~ '^[0-9a-f]{64}$'));

CREATE UNIQUE INDEX minutes_version_kette_linear
    ON minutes_version (meeting_id, seal_previous)
    WHERE seal_previous IS NOT NULL;

-- `sha256()` ist seit PostgreSQL 11 eingebaut; `convert_to` legt die Bytes
-- fest, über die gerechnet wird (UTF-8, wie `createHash` in der Anwendung).
--
-- **Erst warten, dann lesen.** `versammlung_versiegelt` wartet bei einer
-- geschlossenen Versammlung auf ein laufendes Siegel (Migration 157). Danach
-- liest die nächste Anweisung den neuen Stand: Eine Fassung, die während des
-- Versiegelns entsteht, wird so nicht still ohne Nachtragssiegel angelegt,
-- sondern abgewiesen, weil das Siegel jetzt steht und ihr Nachtragssiegel
-- fehlt.
CREATE OR REPLACE FUNCTION minutes_version_nachtragssiegel() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    grund    text;
    erwartet text;
    vorige   integer;
    m        jsonb;
BEGIN
    PERFORM versammlung_versiegelt(NEW.meeting_id);
    SELECT s.manifest_hash INTO grund FROM seal s WHERE s.meeting_id = NEW.meeting_id;

    IF grund IS NULL THEN
        IF NEW.seal_hash IS NOT NULL THEN
            RAISE EXCEPTION 'Ein Nachtragssiegel setzt das Siegel der Versammlung voraus.';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.seal_hash IS NULL THEN
        RAISE EXCEPTION
            'Eine Protokollfassung nach dem Siegel braucht ein Nachtragssiegel (Ä-39).';
    END IF;

    SELECT v.seal_hash, v.number INTO erwartet, vorige
      FROM minutes_version v
     WHERE v.meeting_id = NEW.meeting_id AND v.seal_hash IS NOT NULL
     ORDER BY v.number DESC
     LIMIT 1;
    erwartet := coalesce(erwartet, grund);
    IF NEW.seal_previous IS DISTINCT FROM erwartet THEN
        RAISE EXCEPTION
            'Das Nachtragssiegel verweist nicht auf das vorige Siegel der Kette.';
    END IF;

    IF encode(sha256(convert_to(NEW.seal_manifest, 'UTF8')), 'hex') IS DISTINCT FROM NEW.seal_hash THEN
        RAISE EXCEPTION 'Das Nachtragssiegel ist nicht die Prüfsumme seines Manifests.';
    END IF;

    m := NEW.seal_manifest::jsonb;
    IF m->>'art' IS DISTINCT FROM 'nachtragssiegel'
       OR m->>'grundsiegel' IS DISTINCT FROM grund
       OR m #>> '{vorgaenger,siegel}' IS DISTINCT FROM NEW.seal_previous
       OR jsonb_typeof(m #> '{protokollfassung,nummer}') IS DISTINCT FROM 'number'
       OR m #>> '{protokollfassung,nummer}' IS DISTINCT FROM NEW.number::text
       -- Klein geschrieben verglichen: Die Kennung im Manifest des
       -- Abschlusspakets kommt aus der Adresse, und der Matcher nimmt auch
       -- Grossbuchstaben an (Codeprüfung H8, Teil B, zweiter Durchgang, M1).
       OR lower(m #>> '{versammlung,kennung}') IS DISTINCT FROM NEW.meeting_id::text
       -- Der Vorgänger samt Art und Nummer, wie `baueNachtragssiegel` ihn
       -- schreibt (Codeprüfung H8, Teil B, Befund 9).
       OR m #>> '{vorgaenger,was}' IS DISTINCT FROM
          -- In Klammern: plpgsql liest die IF-Bedingung bis zum ersten THEN.
          (CASE WHEN vorige IS NULL THEN 'abschlusspaket' ELSE 'protokollfassung' END)
       OR m #>> '{vorgaenger,nummer}' IS DISTINCT FROM vorige::text
       OR jsonb_typeof(m #> '{vorgaenger,nummer}') IS DISTINCT FROM
          (CASE WHEN vorige IS NULL THEN 'null' ELSE 'number' END)
       OR m #>> '{eintraege,0,pfad}' IS DISTINCT FROM 'protokoll-fassung-' || NEW.number || '.txt'
       OR jsonb_typeof(m->'eintraege') IS DISTINCT FROM 'array'
       OR jsonb_array_length(m->'eintraege') <> 1
       OR m #>> '{eintraege,0,pruefsumme}'
          IS DISTINCT FROM encode(sha256(convert_to(NEW.body, 'UTF8')), 'hex') THEN
        RAISE EXCEPTION 'Das Manifest des Nachtragssiegels passt nicht zu dieser Fassung.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER minutes_version_nachtragssiegel_trigger
    BEFORE INSERT ON minutes_version
    FOR EACH ROW EXECUTE FUNCTION minutes_version_nachtragssiegel();
