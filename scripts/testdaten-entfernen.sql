-- Testgemeinschaften entfernen — von Hand aufzurufen, nie selbsttätig.
--
-- **Zwei Betriebsarten.** Gewöhnlich trifft das Skript nur, was die
-- Ende-zu-Ende-Läufe erzeugen; erkannt wird das an acht Namensmustern, die
-- unten stehen. Alles andere bleibt liegen, auch nachgerechneter Bestand wie
-- «STWEG Nirgendweg 5/5a». Was liegen bleibt, meldet es am Schluss.
--
-- Der **Alles-Modus** dagegen nimmt jede Gemeinschaft, ohne Ansehen des Namens.
-- Er ist unten beschrieben und muss ausdrücklich eingeschaltet werden. Wer den
-- Befehl von dort übernimmt, ohne diesen Absatz gelesen zu haben, verliert
-- echten Bestand.
--
--   docker compose exec -T postgres psql -U versammlung -d versammlung \
--     -f /dev/stdin < scripts/testdaten-entfernen.sql
--
-- Vorher sichern. Die Fremdschlüssel auf `stweg` sind bewusst RESTRICT: Eine
-- Gemeinschaft mit Einheiten lässt sich nicht versehentlich löschen. Deshalb
-- werden die Abhängigen hier ausdrücklich und in der richtigen Ordnung
-- abgeräumt, statt die Schranke aufzuweichen.

BEGIN;

-- Die Namensmuster der Wegwerfdaten. Wer ein neues Prüfskript schreibt, nimmt
-- eines davon als Präfix — sonst bleibt sein Bestand liegen und verdrängt in
-- der Übersicht, was zählt.
-- **Der Alles-Modus** — ausdrücklich anzugeben, nie die Vorgabe:
--
--   docker compose exec -T -e PGOPTIONS='-c aufraeumen.alle=on' postgres \
--     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /dev/stdin' \
--     < scripts/testdaten-entfernen.sql
--
-- Er nimmt jede Gemeinschaft, auch nachgerechneten Bestand. Gedacht für den
-- Fall, dass jemand von vorn zu prüfen beginnt und einen leeren Stand will.
-- Betreiber, Konten und die eingerichteten Dienste bleiben stehen: Ein
-- `drop database` nähme sie mit, und danach ist niemand mehr angemeldet.
--
-- **Eine Sitzungseinstellung, keine psql-Variable.** `tests/db/aufraeumen.test.ts`
-- fährt dasselbe Skript über den Treiber, und der kennt weder `\if` noch
-- `:name` — mit einer psql-Variablen wäre der Test rot und das Skript
-- ungeprüft. Fehlt die Einstellung, ist sie `off`; versehentlich auslösen lässt
-- sich der Alles-Modus damit nicht.

-- `ON COMMIT DROP`, damit ein zweiter Lauf in derselben Sitzung nicht an
-- «relation "weg" already exists» scheitert. Über psql fällt das nie auf, weil
-- jeder Aufruf eine eigene Sitzung bekommt; `tests/db/aufraeumen.test.ts` fährt
-- das Skript zweimal auf einer reservierten Verbindung und stolperte darüber.

-- Der Modus wird **einmal** bestimmt und danach nur noch gelesen. Zweimal
-- hingeschrieben wäre er zweimal zu ändern, und die zweite Stelle vergisst man.
--
-- `nullif(…, '')` ist kein Zierrat: Nach einem `RESET` liefert Postgres bei
-- einer selbstvergebenen Einstellung den **leeren String** statt NULL, und
-- `''::boolean` bricht ab. Ohne diese Klammer stürbe jeder Lauf, der in
-- derselben Sitzung auf einen Alles-Lauf folgt.
CREATE TEMP TABLE modus ON COMMIT DROP AS
SELECT coalesce(nullif(current_setting('aufraeumen.alle', true), ''), 'off')::boolean AS alle;

CREATE TEMP TABLE weg ON COMMIT DROP AS
SELECT id FROM stweg
WHERE (SELECT alle FROM modus)
   OR name LIKE 'E2E %'
   OR name LIKE '%Prüflauf%'
   OR name LIKE 'Probe %'
   OR name LIKE 'PP %'
   -- Nachgetragen am 27.08.2026. Diese vier stammen aus Wegwerfskripten, die
   -- für eine einzelne Probe geschrieben und danach gelöscht wurden. Das
   -- Skript kann solche Skripte nicht kennen; deshalb meldet es unten, was
   -- übrig bleibt.
   --
   -- **Berichtigt am 22.09.2026.** Hier stand, die Drehbücher unter `e2e/`
   -- schrieben «alle Prüflauf in den Namen». Das stimmte nicht: `durchspielen`
   -- legte «Dateiweg …» und «Sammelweg …» an, beide ohne Präfix und ohne
   -- «Prüflauf», und beide blieben nach jedem Lauf liegen. Sie heissen jetzt
   -- «E2E Dateiweg …» und «E2E Sammelweg …». Damit das nicht wiederkommt,
   -- misst `tests/waechter/testdatennamen.test.ts` die Namen der Drehbücher
   -- gegen diese Liste — beide Seiten aus der Datei gelesen, nicht
   -- danebengeschrieben.
   --
   -- **Die Umbenennung wirkt nur nach vorn, der Altbestand ist abgetragen.**
   -- Am 22.09.2026 standen in der Entwicklungsdatenbank 1389 Gemeinschaften,
   -- davon 672 auf kein Muster passend: 429 «Dateiweg …», 236 «Sammelweg …»,
   -- der Rest Vorführbestand. Entschieden vom Auftraggeber: einmalig zwei Muster
   -- ergänzen, laufen lassen, Muster wieder heraus. Danach standen noch acht
   -- Gemeinschaften, sieben davon gewollt.
   --
   -- **Eine hat der erste Anlauf nicht mitgenommen, und der Grund gehört
   -- hierher:** «STWEG Chalet Almenrausch» — Vorführbestand — trägt
   -- «Dateiweg 20260902071945» als Elternteil. Der Fremdschlüssel
   -- `stweg_eltern_gleicher_betreiber` ist `RESTRICT`, und weil das ganze
   -- Skript in **einer** Transaktion läuft, hielt diese eine Zeile den
   -- gesamten Lauf an: `ROLLBACK`, nichts gelöscht. Das ist die Schranke, die
   -- funktioniert, kein Mangel.
   --
   -- Beim zweiten Anlauf wurden Elternteile bleibender Gemeinschaften
   -- ausgenommen; «Dateiweg 20260902071945» steht deshalb weiter im Bestand.
   -- Wer ihn loswerden will, muss zuerst entscheiden, was aus dem Kind wird —
   -- das ist eine Frage an den Vorführbestand, nicht an dieses Skript.
   OR name LIKE 'Sichtprobe %'
   OR name LIKE 'Anzeigeprobe %'
   OR name LIKE 'Durchstich %'
   OR name LIKE 'Einladung Hülle %';

-- Dazu die Versammlungen, die ein Prüflauf an **echtem** Bestand angelegt hat.
--
-- `e2e/register.mjs` etwa braucht mehrere Häuser an einem Abend und nimmt dafür
-- die vorhandenen Gemeinschaften — über deren Namen ist da nichts zu erkennen.
-- Erkennbar ist der Ort: Wer an echtem Bestand prüft, schreibt «Prüflauf»
-- hinein. Wer das lässt, findet seine Probeversammlungen später im Bestand
-- wieder und muss sie einzeln von Hand entfernen.
CREATE TEMP TABLE weg_versammlung ON COMMIT DROP AS
SELECT id FROM meeting WHERE stweg_id IN (SELECT id FROM weg)
UNION
SELECT id FROM meeting WHERE location LIKE '%Prüflauf%'
UNION
-- **Auch, was an einer Prüflauf-Versammlung hängt.** Seit dem 11.08.2026 lassen
-- sich Tag, Beginn und Ort einer gemeinsamen Versammlung auf ihre
-- Teilnehmerinnen umlegen — danach steht in deren Ort, was das Prüfskript
-- eingetippt hat, und das muss nicht «Prüflauf» enthalten. Über die gemeinsame
-- Versammlung sind sie trotzdem erkennbar.
SELECT m.id FROM meeting m
  JOIN meeting_day d ON d.id = m.meeting_day_id
 WHERE d.label LIKE '%Prüflauf%' OR d.label LIKE 'E2E %' OR d.location LIKE '%Prüflauf%';

\echo 'Zu entfernen:'
SELECT (SELECT count(*) FROM weg) AS gemeinschaften,
       (SELECT count(*) FROM weg_versammlung) AS versammlungen;

-- Das Siegel zuerst: Solange es steht, weisen die Auslöser jede Änderung an
-- Stimmen, Anwesenheit und Vollmachten ab (FR-55) — im Betrieb genau richtig,
-- hier fallen Wegwerfdaten. Der eigene Auslöser des Siegels verbietet das
-- Löschen ebenso.
ALTER TABLE seal DISABLE TRIGGER seal_nur_zeitstempel_trigger;
DELETE FROM seal WHERE meeting_id IN (SELECT id FROM weg_versammlung);
ALTER TABLE seal ENABLE TRIGGER seal_nur_zeitstempel_trigger;
UPDATE meeting SET state = 'geschlossen'
 WHERE id IN (SELECT id FROM weg_versammlung) AND state = 'versiegelt';

-- Der Leihschein vor der Versammlung (Migration 117). Solange eine Abgabe offen
-- ist, weist der Auslöser jede Änderung an der Versammlung ab, auch das Löschen
-- — im Betrieb genau richtig, hier fallen Wegwerfdaten. Ohne diesen Schritt
-- bricht das Aufräumen an jeder Versammlung ab, die je abgegeben wurde.
DELETE FROM meeting_handover WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- Weisungen zuerst: Sie verweisen mit RESTRICT auf den Durchgang, aus dem sie
-- abgeleitet wurden. Der Verweis ist der Beleg — er darf nicht ins Leere zeigen,
-- also muss die Weisung vor ihrem Beschluss weichen.
--
-- Dafür muss der Auslöser kurz aus. Er verbietet jedes Löschen (AD-5), und das
-- ist im Betrieb genau richtig: Eine Weisung wird berichtigt, nie entfernt.
-- Dieses Skript ist kein Betrieb — es entfernt Wegwerfdaten, und zwar
-- ausdrücklich, von Hand aufgerufen und innerhalb **einer** Transaktion: Geht
-- irgendetwas schief, ist auch der Auslöser wieder scharf.
ALTER TABLE instruction DISABLE TRIGGER instruction_nur_nachfolger_trigger;
DELETE FROM instruction WHERE meeting_id IN (SELECT id FROM weg_versammlung)
   OR source_meeting_id IN (SELECT id FROM weg_versammlung);
ALTER TABLE instruction ENABLE TRIGGER instruction_nur_nachfolger_trigger;

-- Vollmachten, mit derselben Begründung wie bei den Weisungen: Der Auslöser
-- verbietet jedes Löschen (AD-5), und im Betrieb ist das richtig — eine
-- Vollmacht wird zurückgewiesen oder widerrufen, nie entfernt. Hier fallen
-- Wegwerfdaten, und die Vollmacht hängt mit ON DELETE CASCADE an der
-- Momentaufnahme, die gleich mit verschwindet.
ALTER TABLE proxy DISABLE TRIGGER proxy_nur_lebensweg_trigger;
DELETE FROM attachment WHERE subject_type = 'proxy' AND subject_id IN (
    SELECT id FROM proxy WHERE meeting_id IN (SELECT id FROM weg_versammlung));
DELETE FROM proxy WHERE meeting_id IN (SELECT id FROM weg_versammlung);
ALTER TABLE proxy ENABLE TRIGGER proxy_nur_lebensweg_trigger;

-- Das Protokoll: Die Arbeitsfassung ist änderbar, die festgehaltenen Fassungen
-- sind es nicht (FR-50) — im Betrieb richtig, hier fallen Wegwerfdaten.
ALTER TABLE minutes_version DISABLE TRIGGER minutes_version_unveraenderlich_trigger;
DELETE FROM minutes_version WHERE meeting_id IN (SELECT id FROM weg_versammlung);
ALTER TABLE minutes_version ENABLE TRIGGER minutes_version_unveraenderlich_trigger;
DELETE FROM minutes WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- Abstimmung und Anwesenheit hängen an der Versammlung. Der Widerspruch
-- (Migration 129) vor dem Durchgang, auf den er verweist.
DELETE FROM universal_objection WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM vote WHERE round_id IN (
    SELECT id FROM voting_round WHERE meeting_id IN (SELECT id FROM weg_versammlung));
DELETE FROM voting_round WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM attendance_event WHERE meeting_id IN (SELECT id FROM weg_versammlung);
-- Vertreter der Sitzungsleitung an der Universalversammlung (Migration 128).
DELETE FROM meeting_chair_holder WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM access_session WHERE meeting_access_id IN (
    SELECT id FROM meeting_access WHERE meeting_id IN (SELECT id FROM weg_versammlung));
DELETE FROM room_entry_request WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM meeting_access WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- Die Momentaufnahme mit ihren beiden Untertabellen.
-- Papiervermerke: Sie fielen per Kaskade an `snapshot_party` (Migration 107),
-- stehen aber ausdrücklich da, aus demselben Grund wie `snapshot_unit` gleich
-- darunter. Und sie stehen VOR der Momentaufnahme, sonst räumt die Kaskade sie
-- weg und diese Zeile trifft nie etwas.
DELETE FROM paper_ballot WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM paper_question_answered WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM snapshot_unit WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM snapshot_party WHERE meeting_id IN (SELECT id FROM weg_versammlung);
DELETE FROM snapshot WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- Pendenzen: Sie hängen zwar mit ON DELETE CASCADE am Traktandum und fielen von
-- selbst (Migration 106). Sie stehen hier trotzdem ausdrücklich — eine Kaskade,
-- auf die sich ein Skript stillschweigend verlässt, wird beim nächsten Umbau
-- übersehen, und dann bricht der Lauf an einer Stelle ab, an der niemand
-- nachsieht. Dieselbe Überlegung wie bei `snapshot_unit` weiter oben, das
-- ebenfalls per Kaskade an `snapshot_party` fiele und trotzdem dasteht.
DELETE FROM pendenz WHERE meeting_id IN (SELECT id FROM weg_versammlung);
-- Rügen (Migration 160), aus demselben Grund ausdrücklich. Ihr Schreibschutz
-- greift hier nicht mehr: Der Zustand steht oben schon auf «geschlossen».
DELETE FROM objection WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- Traktanden: erst die Betroffenen, dann der ganze Baum in **einem** Befehl.
--
-- Früher wurde der Baum vorher flachgelegt (`parent_id = NULL`). Das ist an
-- zwei Schranken zerbrochen, und beide zu Recht:
--
--   * `agenda_folgeantrag_hat_grundantrag` (Migration 031) — ein Folgeantrag
--     ohne Grundantrag ist keiner. Die Schranke kennt die Absicht nicht, die
--     hinter dem Nullsetzen steht.
--   * `agenda_position_je_elternteil` — ein Untertraktandum an Position 1
--     stiess beim Hochziehen mit dem obersten Traktandum an Position 1
--     zusammen.
--
-- Nötig war das Flachlegen ohnehin nie: Die Selbstverweise `parent_id` und
-- `approved_by_item_id` stehen auf NO ACTION, und dabei prüft PostgreSQL erst
-- am **Ende der Anweisung**. Eltern und Kinder verschwinden hier gemeinsam,
-- also steht am Ende kein Verweis mehr offen. (Bei RESTRICT wäre das anders —
-- dort prüft die Datenbank Zeile für Zeile, und die Reihenfolge entschiede.)
DELETE FROM agenda_item WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- Anhänge zeigen über Art und Kennung, nicht über einen Fremdschlüssel.
DELETE FROM attachment WHERE stweg_id IN (SELECT id FROM weg);

-- Die Abrechnung der KI-Aufrufe. Sie verweist auf **beides** — Versammlung und
-- Gemeinschaft — und zwar mit NO ACTION, also ohne Kaskade. Am 11.08.2026 fehlte
-- diese Zeile und der ganze Lauf brach am Schluss ab: Die Tabelle kam erst nach
-- diesem Skript dazu. Wer eine Tabelle mit `stweg_id` oder `meeting_id`
-- hinzufügt, trägt sie hier nach.
DELETE FROM ai_usage WHERE stweg_id IN (SELECT id FROM weg)
   OR meeting_id IN (SELECT id FROM weg_versammlung);

-- Der Ausstand hängt an Versammlung und Traktandum (Migration 062). Er steht
-- **vor** dem Löschen der Traktanden weiter oben nicht, weil er einen eigenen
-- Fremdschlüssel auf `meeting` trägt — der greift erst hier.
DELETE FROM recusal WHERE meeting_id IN (SELECT id FROM weg_versammlung);
-- Die festgehaltene Beschlussfähigkeit (Migration 080). Ihr Fremdschlüssel auf
-- `meeting` ist bewusst ohne CASCADE — ein Befund verschwindet nicht mit der
-- Versammlung. Beim Aufräumen von Prüfdaten muss er deshalb ausdrücklich weg,
-- sonst scheitert das DELETE auf `meeting` an jedem Prüflauf, der die
-- Beschlussfähigkeit festgehalten hat.
DELETE FROM quorum_finding WHERE meeting_id IN (SELECT id FROM weg_versammlung);

-- **Kein Flachlegen vorher** (25.08.2026).
--
-- Hier stand `UPDATE meeting SET current_agenda_item_id = NULL,
-- previous_meeting_id = NULL`. Beides ist inzwischen falsch:
--
--   * `previous_meeting_id` gehört zur zweiten Versammlung nach ZGB Art. 712p
--     Abs. 2. Seit dem 25.08.2026 verlangt `meeting_vorgaenger`, dass eine
--     Versammlung der Stufe «zweite» einen Vorgänger HAT — das Nullsetzen
--     verletzt die Schranke, und das Aufräumen brach daran ab. Nötig war es
--     ohnehin nie: Der Selbstverweis steht auf NO ACTION, und dabei prüft
--     PostgreSQL erst am Ende der Anweisung. Vorgängerin und zweite
--     Versammlung verschwinden hier gemeinsam — dieselbe Überlegung wie beim
--     Traktandenbaum weiter oben.
--   * `current_agenda_item_id` hat gar keinen Fremdschlüssel, und seit
--     Migration 084 hält ein CHECK ihn mit `current_agenda_item_at` zusammen.
--     Die eine Spalte allein zu leeren, verletzt ihn — und die Zeile fällt in
--     der nächsten Anweisung ohnehin.
DELETE FROM meeting WHERE id IN (SELECT id FROM weg_versammlung);

-- Stammdaten der Gemeinschaft.
DELETE FROM usufruct WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM unit_ownership WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM unit_quota WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM unit WHERE stweg_id IN (SELECT id FROM weg);
-- Vertretungen und Personenklammern hängen an der Partei.
DELETE FROM representation WHERE stweg_id IN (SELECT id FROM weg);
-- Mitberechtigte an gemeinschaftlichem Eigentum (Migration 094). Die
-- Fremdschlüssel auf `party` kaskadieren zwar, aber hier wird ausdrücklich und
-- in der richtigen Ordnung abgeräumt statt auf die Kaskade vertraut.
DELETE FROM party_member WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM party WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM quota_kind WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM bylaw_quorum_rule WHERE stweg_id IN (SELECT id FROM weg);
DELETE FROM bylaw_attendance_rule WHERE stweg_id IN (SELECT id FROM weg);
-- Die Weisungsregel (Migration 085) — wie ein Haus über die Weisung an seinen
-- Vertreter entscheidet.
DELETE FROM bylaw_instruction_rule WHERE stweg_id IN (SELECT id FROM weg);
-- Die Traktandenordnung (Migration 097) — die gespeicherte Reihenfolge der
-- Standardtraktanden je Gemeinschaft.
DELETE FROM agenda_template_order WHERE stweg_id IN (SELECT id FROM weg);

-- **Der Verlauf bleibt stehen.** `audit_entry` ist anfügbar-nur (AD-5), ein
-- Auslöser weist jedes DELETE ab — und das ist keine Hürde, die man umgeht,
-- sondern der Zweck der Tabelle. Ein Nachweis, den das Aufräumen mitnimmt, ist
-- keiner. Deshalb ist `subject_id` auch Text und kein Fremdschlüssel: Der
-- Verlauf überlebt seinen Gegenstand.

-- Geschäfte und Versammlungstage, sofern nichts anderes mehr daran hängt.
DELETE FROM business WHERE meeting_day_id IN (
    SELECT d.id FROM meeting_day d
    WHERE NOT EXISTS (SELECT 1 FROM meeting m WHERE m.meeting_day_id = d.id));
DELETE FROM meeting_day d WHERE NOT EXISTS (
    SELECT 1 FROM meeting m WHERE m.meeting_day_id = d.id);

-- Eingespielte Abschlusspakete (Migration 061). Die Zeile ist gegen UPDATE und
-- DELETE gesperrt — mit Absicht: Ein Nachweis, den die Anwendung überschreiben
-- kann, ist keiner. Fürs Aufräumen wird der Auslöser hier ausdrücklich
-- ausgesetzt, und **nur** für die Gemeinschaften der Prüfläufe. Die Datei in
-- der Ablage bleibt liegen; sie ist inhaltsadressiert und stört niemanden.
ALTER TABLE imported_meeting DISABLE TRIGGER imported_meeting_bleibt;
DELETE FROM imported_meeting WHERE stweg_id IN (SELECT id FROM weg);
ALTER TABLE imported_meeting ENABLE TRIGGER imported_meeting_bleibt;

UPDATE stweg SET parent_stweg_id = NULL WHERE id IN (SELECT id FROM weg);
DELETE FROM stweg WHERE id IN (SELECT id FROM weg);

-- Die Saalgeräte aus den Läufen (Migration 116).
--
-- **Nur mit Namensmuster, und nur ohne Leihschein.** Ein Gerät gehört dem
-- Betreiber und nicht einer Gemeinschaft, über `weg` ist es also nicht
-- erreichbar. Und es darf nicht fallen, solange irgendein Leihschein darauf
-- verweist: Der Verweis ist der Beleg, wohin eine Versammlung ging, und ein
-- Leihschein mit Kennung ohne Namen wäre schlechter als gar keiner. Die eigene
-- Identität (`device_identity`) bleibt ohnehin stehen — sie ist die Einrichtung
-- dieses Geräts und keine Wegwerfware.
DELETE FROM handover_device d
 WHERE (d.name LIKE 'E2E %' OR d.name LIKE '%Prüflauf%' OR d.name LIKE 'Probe%')
   AND NOT EXISTS (SELECT 1 FROM meeting_handover h WHERE h.device_id = d.id);

-- Personen aus den Läufen, die keiner Partei mehr gehören.
--
-- **Nur mit Namensmuster.** Eine Person ohne Partei ist im Betrieb nichts
-- Verdächtiges: Wer das Register vorbereitet, legt sie an, bevor die Einheit
-- feststeht. Ein Aufräumen, das «hat keine Partei» als Grund nimmt, würde genau
-- diese Vorarbeit wegräumen — deshalb muss der **Name** die Wegwerfware
-- ausweisen, nicht die fehlende Zuordnung. Die Prüfskripte hängen einen
-- Zeitstempel an; wer das lässt, findet seine Personen später hier wieder.
DELETE FROM person p
 WHERE NOT EXISTS (SELECT 1 FROM party pa WHERE pa.person_id = p.id)
   AND (p.display_name ~ '[0-9]{8,14}$'
     OR p.display_name LIKE '%Prüflauf%'
     OR p.display_name LIKE 'Last %'
     OR p.display_name LIKE 'E2E %'
     OR p.display_name LIKE 'PP %');

-- Dieselben Personen, aber am **Konto** erkannt statt am Namen (25.08.2026).
--
-- `e2e/sitzungsfuehrung.mjs` erfasst Eigentümer, die schlicht «Ackermann»,
-- «Brunner», «Caduff» heissen. Die Gemeinschaft darüber trägt den Zeitstempel
-- und verschwindet mit dem Aufräumen — die Personen bleiben, weil «Ackermann»
-- auf kein Muster passt. Am 25.08.2026 waren so 115 verwaiste Personen
-- aufgelaufen und drängten in der Eigentümerliste auf 233 Zeilen; der Auftraggeber sah
-- zwei Dutzend gleichnamige «Ackermann» und fragte nach.
--
-- **Warum das trotzdem kein «hat keine Partei» ist**: Der Grund bleibt die
-- Herkunft, nicht die fehlende Zuordnung. Wer das Register vorbereitet, legt
-- Personen ohne Partei an — die sind hier ausgenommen, weil sie von einem
-- **echten** Konto stammen. Beide Bedingungen müssen zutreffen. (Wer am
-- Entwicklungssystem als `pruefer` von Hand vorarbeitet, verliert sie
-- allerdings — dort ist das Konto Wegwerfware.)
--
-- **Gedacht als Rückhalt, gebraucht wird sie noch.** Seit `sitzungsfuehrung.mjs`
-- den Zeitstempel anhängt, fängt die Namensregel dessen Zeilen schon. Aber
-- `e2e/einsprache.mjs` legt «Aebi» bis «Duss» ohne Muster an (Pendenz), und auf einem
-- Stapel blieben vier davon stehen, angelegt von einem `prueflauf-…`-Konto.
-- Deshalb gehört `prueflauf-%` dazu: So heissen die Konten, die ein Durchstich
-- mit `benutzer-anlegen.mjs` bekommt.
-- Wer mit einem solchen Konto Personen ohne Partei vorbereitet, verliert sie
-- hier, wie unter `pruefer`.
--
-- `e.operator_id = p.operator_id`, weil `audit_entry` den Mandanten führt: Ohne
-- die Bedingung griffe die Regel auf einer Mehrmandanteninstanz über den
-- Betreiber hinaus.
DELETE FROM person p
 WHERE NOT EXISTS (SELECT 1 FROM party pa WHERE pa.person_id = p.id)
   AND EXISTS (
       SELECT 1 FROM audit_entry e
         JOIN app_user u ON u.id = e.actor_user_id
        WHERE e.subject_type = 'person'
          AND e.subject_id = p.id::text
          AND e.event_type = 'person.created'
          AND e.operator_id = p.operator_id
          AND (u.username IN ('pruefer', 'pruefer-leitung')
               OR u.username LIKE 'pruefkonto%'
               OR u.username LIKE 'prueflauf-%')
   );

-- **Im Alles-Modus zusätzlich jede Person ohne Partei.**
--
-- Ohne diese Zeile hielte der Modus sein Versprechen nicht: Er räumt jede
-- Gemeinschaft und damit jede Partei ab, die Personen aber hingen weiter an den
-- beiden Regeln darüber, die nach Namen und Konto fragen. Am 27.08.2026 blieben
-- so 19 Personen zurück, alle von Hand angelegt, alle verwaist — sie standen
-- unter `/personen` und in jeder Eigentümerauswahl, auf einem Stand, der leer
-- sein sollte.
--
-- `party` ist der einzige Fremdschlüssel auf `person`. Wer keine Partei hat,
-- hängt an nichts.
DELETE FROM person p
 WHERE (SELECT alle FROM modus)
   AND NOT EXISTS (SELECT 1 FROM party pa WHERE pa.person_id = p.id);

-- ── Prüfkonten ────────────────────────────────────────────────────────────
--
-- **Ausser Dienst, nicht gelöscht.** `e2e/konten.mjs` legt je Lauf ein Konto
-- `pruefkonto<zeit>` an; es steht danach im Verlauf, und der Fremdschlüssel
-- darauf ist `RESTRICT` (AD-5). Ein gelöschtes Konto machte aus «angelegt durch
-- pruefkonto2105» eine Zeile ohne Person. Derselbe Weg wie im Betrieb.
--
-- **Vier Muster, nicht eines** (15.09.2026). Die Durchstiche haben sich
-- vermehrt, ihre Kontonamen auch: Neben `pruefkonto<zeit>` entstehen
-- `pruefleitung<zeit>`, `pruefchair` und `prueflauf-*`. Nur das erste stand
-- hier.
--
-- **Im Normalfall fiel das nicht auf, und genau das ist der Punkt.** Nachgesehen
-- am 15.09.2026: Alle acht Konten dieser Bauart standen bereits ausser Dienst —
-- `e2e/rollenumgehung.mjs` räumt am Ende selbst auf. Das Netz hier greift erst,
-- wenn ein Lauf vorher abbricht, und dann bleibt ein Konto **in Dienst** liegen,
-- unter einem Namen, den dieses Skript nicht kannte. Ein Aufräumnetz, das nur
-- die Fälle kennt, die sich ohnehin selbst aufräumen, ist keines.
UPDATE app_user SET disabled_at = now()
 WHERE disabled_at IS NULL
   AND (username LIKE 'pruefkonto%'
        OR username LIKE 'pruefleitung%'
        OR username LIKE 'prueflauf-%'
        OR username = 'pruefchair');

-- ── Was übrig bleibt ──────────────────────────────────────────────────────
--
-- **Der Grund für diese Meldung.** Am 27.08.2026 standen 415 Gemeinschaften auf
-- dem Entwicklungssystem, 42 davon an keinem Muster. 31 waren Wegwerfware aus
-- Skripten, die es nicht mehr gibt. Gemerkt hat es niemand, weil das Skript
-- schwieg: Es meldete, was es entfernt, nie was es liegen lässt.
--
-- Die Zahl ist keine Fehlermeldung. Nachgerechneter Bestand gehört hierher.
-- Wächst die Liste um Namen, die nach einem Prüflauf aussehen, gehört oben ein
-- Muster nachgetragen — oder das Skript, das sie erzeugt, gehört auf einen
-- vorhandenen Namensanfang.
\echo ''
\echo 'Bleibt stehen (nachsehen, ob das stimmt):'
SELECT name, to_char(created_at, 'DD.MM.YYYY') AS angelegt
  FROM stweg
 WHERE id NOT IN (SELECT id FROM weg)
 ORDER BY created_at;

COMMIT;

-- **Was dieses Skript nicht fängt.** Wer von Hand am echten Bestand prüft und
-- dabei «Irgendwo» oder «Testort» in das Ortsfeld tippt, erzeugt Daten, die an
-- keinem Muster hängen. Dafür gibt es keinen Automatismus und soll es keinen
-- geben: Eine Versammlung ist ein Nachweis, die Anwendung kennt darum kein
-- Löschen. Solche Reste werden einzeln und mit Kennung entfernt, nachdem man in
-- sie hineingesehen hat — am 11.08.2026 waren es sechs Stück.
