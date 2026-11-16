-- 124 — Betroffene im Saal eintragen, Vorab-Zustimmung vermerken
--
-- Block A2 nach `docs/plan-zustimmung-betroffener-2026-09-25.md`, Abschnitt 3.
--
-- **Der Anlass.** Bis hierher liessen sich unmittelbar Betroffene nur im
-- Entwurf zuordnen, über das Traktandenformular, und eine Zustimmung gab es
-- nur als Ja im Saal. Nach der Fachprüfung vom 25.09.2026 geht die Zustimmung
-- bei den Nutzungsrechten auch vorher schriftlich (ZGB Art. 712g Abs. 4;
-- SVIT-Kommentar 2023, Art. 712g Rz. 209), und wer betroffen ist, zeigt sich
-- oft erst im Saal. Die Rechnung dafür steht seit Block A1 im Kern
-- (`Auszaehlungslage.vorabZustimmungen`); es fehlten Speicherort und Weg.

-- ── Die Form der Zustimmung am Traktandum ──────────────────────────────────
--
-- Bis hierher trug im Betrieb allein `requirement_node` die Form, über
-- `betroffenenzustimmungVonKnoten`. Ein Erfordernis aus einer neuen Fassung,
-- das die Form am Knoten setzt, verlor sie beim Speichern. `NULL` heisst wie
-- vorher: über die Kennung des Knotens zuordnen. Nachgetragen wird nicht; die
-- Zuordnung über die Kennung liefert für den Bestand dasselbe.
ALTER TABLE agenda_item ADD COLUMN requirement_affected_consent_form text
    CHECK (requirement_affected_consent_form IN ('im_saal_oder_vorab', 'nachher'));

COMMENT ON COLUMN agenda_item.requirement_affected_consent_form IS
    'Wie die Zustimmung der Betroffenen erteilt wird: im Saal oder vorab (ZGB Art. 712g Abs. 4) oder nachher (Art. 712e Abs. 2). NULL: über requirement_node zugeordnet (betroffenenzustimmungVonKnoten).';

-- ── Der Vorab-Vermerk ──────────────────────────────────────────────────────
--
-- **Produktentscheid 25.09.2026:** Die Vorab-Zustimmung ist ein Vermerk mit
-- Pflichtangabe (etwa «Schreiben vom 12.09.2026»), erfasst durch wen und wann.
-- Keine Beilage. Gebaut wie der Ausstand mit Pflichtgrund (Migration 062):
-- Ohne Angabe liesse sich ein Vermerk später nicht von einem Erfassungsfehler
-- unterscheiden, und er entscheidet über Annahme oder Ablehnung.
--
-- Ob ein Vermerk bei diesem Erfordernis überhaupt zulässig ist (nur bei
-- `im_saal_oder_vorab`), prüft die Anwendung: Die Tabelle kennt das
-- Erfordernis nicht, und ein geändertes Erfordernis am Traktandum soll keinen
-- Datenbankfehler werfen, sondern im Kern unwirksam bleiben.
ALTER TABLE agenda_item_affected
    ADD COLUMN vorab_vermerk       text
        CHECK (vorab_vermerk IS NULL OR length(btrim(vorab_vermerk)) >= 3),
    ADD COLUMN vorab_erfasst_am    timestamptz,
    ADD COLUMN vorab_erfasst_durch text,
    -- Wer im Saal eingetragen hat. Leer heisst: in der Vorbereitung, über das
    -- Traktandenformular. Die Unterscheidung gehört in die Auswertung, weil
    -- eine Zuordnung im Saal nicht mit der Einladung angekündigt war.
    ADD COLUMN eingetragen_durch   text,
    -- Ein Vermerk ist ganz oder gar nicht da.
    ADD CONSTRAINT agenda_item_affected_vorab_vollstaendig CHECK (
        (vorab_vermerk IS NULL) = (vorab_erfasst_am IS NULL)
        AND (vorab_vermerk IS NULL) = (vorab_erfasst_durch IS NULL)
    );

COMMENT ON COLUMN agenda_item_affected.vorab_vermerk IS
    'Vorab schriftlich erteilte Zustimmung (ZGB Art. 712g Abs. 4), mit Pflichtangabe. Ein Nein im Saal widerruft sie (Produktentscheid 25.09.2026).';

-- ── Schreibschutz nach dem Siegel ──────────────────────────────────────────
--
-- **Eine neue Schreibstelle erbt die Schranken nicht.** Bis hierher genügte
-- die Sperre «nur im Entwurf» in `server/traktanden.ts`: Ab der Freigabe gab
-- es keinen Weg zu dieser Tabelle. Mit dem Eintragen im Saal gibt es ihn, und
-- dann gilt dasselbe wie für Ausstand und Stimmen (Migration 039, FR-55): Der
-- Schutz greift in der Datenhaltung, nicht bloss in der Anwendung.
--
-- Die Tabelle kennt die Versammlung nur über das Traktandum, dasselbe
-- Verhältnis wie bei der Abgabe (`agenda_anhang_bei_abgabe`, Migration 117).
--
-- **Der Löschweg nach Ablauf der Frist bleibt offen**
-- (`versammlungen_endgueltig_loeschen`, Migrationen 113 und 115): Er setzt
-- den Zustand auf «geschlossen», bevor er die Traktanden löscht, und die
-- Zeilen hier gehen erst mit deren Kaskade.
CREATE OR REPLACE FUNCTION agenda_anhang_nach_siegel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    kennung uuid;
BEGIN
    SELECT meeting_id INTO kennung FROM agenda_item
     WHERE id = COALESCE(NEW.agenda_item_id, OLD.agenda_item_id);
    IF versammlung_versiegelt(kennung) THEN
        RAISE EXCEPTION
            'Diese Versammlung ist versiegelt. % an «%» wäre eine Änderung am Nachweis (FR-55).',
            TG_OP, TG_TABLE_NAME;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER agenda_item_affected_nach_siegel
    BEFORE INSERT OR UPDATE OR DELETE ON agenda_item_affected
    FOR EACH ROW EXECUTE FUNCTION agenda_anhang_nach_siegel();

-- ── Beim Schliessen eingefroren ────────────────────────────────────────────
--
-- Bis hierher las `ergebnisIn` die Betroffenen live aus `agenda_item_affected`,
-- auch für geschlossene, noch nicht verkündete Durchgänge. Mit dem Schreibweg
-- im Saal wirkte eine spätere Änderung auf einen geschlossenen Durchgang
-- zurück. Dasselbe wie beim Ausstand (`attendance_json.ausstand`, `64208b8`):
-- beim Schliessen festgeschrieben, als `[{ "parteiId": …, "vorab": … | null }]`.
--
-- `NULL` bei Durchgängen, die vorher geschlossen wurden. Für sie wird gelesen,
-- wie es jetzt ist; eine nachträgliche Rekonstruktion hiesse, ein Ergebnis zu
-- berichtigen, das niemand berichtigt hat.
ALTER TABLE voting_round ADD COLUMN affected_json jsonb;

COMMENT ON COLUMN voting_round.affected_json IS
    'Die beim Schliessen festgeschriebenen Betroffenen samt Vorab-Vermerk, [{parteiId, vorab}]. NULL bei Durchgängen, die vor Migration 124 geschlossen wurden; dort wird agenda_item_affected gelesen.';
