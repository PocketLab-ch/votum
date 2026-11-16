-- 067 — Der Eigentümerzugang über Authentik: Ablage und Kennzeichnung
--
-- **Wozu.** Wer sich über Authentik anmeldet, soll ohne Papier in die
-- Versammlung kommen — die Sitzungsleitung lässt ihn ein wie jeden anderen.
-- Damit das geht, braucht es zwei Dinge: eine Kennung an der eingefrorenen
-- Momentaufnahme und einen Namen für diesen Weg an jeder Stelle, an der der
-- Weg später erklärt werden muss.
--
-- ## Warum die Kennung in die Momentaufnahme wandert
--
-- `party.authentik_subject` (Migration 066) ist der **heutige** Stand der
-- Stammdaten. Die Versammlung läuft aber auf dem Stand vom Tag der Freigabe:
-- Wer danach verkauft, stimmt trotzdem mit, und wer danach kauft, nicht (AD-3).
--
-- Löste die Anmeldung die Kennung über `party` auf, hinge die Teilnahme an
-- Daten, die sich während der Versammlung ändern dürfen — eine Berichtigung an
-- den Stammdaten könnte einem Anwesenden mitten in der Sitzung den Zugang
-- nehmen oder einem Abwesenden einen geben. Deshalb wird sie beim Einfrieren
-- **mitkopiert** und gilt dann für diese eine Versammlung, wie alles andere in
-- dieser Tabelle auch.
--
-- **Und weiterhin gilt: Die Kennung ist Identität, nie Berechtigung.** Sie sagt
-- «du bist diese Person», nicht «du hast eine Stimme». Was jemand zählt, steht
-- in `snapshot_unit` und in den Quoten — ein Konto, das im eingefrorenen Stand
-- nicht vorkommt, kommt herein und sieht nichts.

ALTER TABLE snapshot_party ADD COLUMN IF NOT EXISTS authentik_subject text;

-- Zwei Zeilen derselben Versammlung mit derselben Kennung wären ein Mensch mit
-- zwei Stimmen. Über Versammlungen hinweg ist dieselbe Kennung der Normalfall.
CREATE UNIQUE INDEX IF NOT EXISTS snapshot_party_authentik_je_versammlung
    ON snapshot_party (meeting_id, authentik_subject)
    WHERE authentik_subject IS NOT NULL;

COMMENT ON COLUMN snapshot_party.authentik_subject IS
    'Beim Einfrieren aus party.authentik_subject kopiert. Identität, nie Berechtigung — die Stimme steht in snapshot_unit.';

-- ── Der Weg herein bekommt einen Namen ──────────────────────────────────────
--
-- **Warum das nicht kosmetisch ist.** Im Protokoll und im Abschlusspaket steht
-- später, wie jemand in die Versammlung kam. «Karte gescannt» ist eine andere
-- Aussage als «über Authentik angemeldet»: Das eine belegt ein Stück Papier in
-- der Hand, das andere ein Konto mit Kennwort und zweitem Faktor. Wer beides
-- gleich benennt, behauptet mehr oder weniger, als er weiss.

ALTER TABLE access_session DROP CONSTRAINT IF EXISTS access_session_herkunft;
ALTER TABLE access_session ADD CONSTRAINT access_session_herkunft
    CHECK (origin IN ('karte', 'ausgabe', 'authentik'));

COMMENT ON COLUMN access_session.origin IS
    'karte = QR/Code von der Zugangskarte; ausgabe = kurzer Code der Sitzungsleitung; authentik = über das eigene Konto angemeldet.';

-- **Die Liste steht vollständig da, und sie stammt aus der laufenden Datenbank
-- — nicht aus Migration 016.** Dort hiess es `gescannt, selbst, von_hand,
-- liste`; `vertretung` ist später dazugekommen (Migration 036, Vollmacht). Wer
-- die Liste aus der ersten Migration abschreibt, nimmt beim `DROP`/`ADD` einem
-- bestehenden Wert seine Grundlage — hier 113 Zeilen, die den Einlass durch
-- eine bevollmächtigte Person festhalten. Der Lauf scheitert dann wenigstens
-- laut (`is violated by some row`); schlimmer wäre eine leere Tabelle gewesen,
-- in der es nichts zu verletzen gibt.
ALTER TABLE attendance_event DROP CONSTRAINT IF EXISTS attendance_weg;
ALTER TABLE attendance_event ADD CONSTRAINT attendance_weg
    CHECK (channel IN ('gescannt', 'selbst', 'von_hand', 'liste', 'vertretung', 'authentik'));

-- ── Wer sich selbst anmeldet, hat keinen Erfasser ───────────────────────────
--
-- `attendance_erfasser` verlangt zu jeder Zeile eine Erfasser-Beschriftung —
-- ausser beim Weg `selbst`. Das ist richtig: Wer die Anwesenheit eines anderen
-- festhält, muss namentlich dastehen.
--
-- Über Authentik meldet sich aber niemand für jemand anderen an, sondern jeder
-- für sich. Eine erfundene Beschriftung («System», «Authentik») wäre eine
-- Behauptung über einen Menschen, den es in diesem Vorgang nicht gibt. Also
-- gehört `authentik` zur selben Ausnahme wie `selbst`.
ALTER TABLE attendance_event DROP CONSTRAINT IF EXISTS attendance_erfasser;
ALTER TABLE attendance_event ADD CONSTRAINT attendance_erfasser
    CHECK (
        channel IN ('selbst', 'authentik')
        OR length(btrim(coalesce(recorded_by_label, ''))) >= 2
    );
