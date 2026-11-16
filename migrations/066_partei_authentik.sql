-- 066 — Die Authentik-Kennung kommt mit der Übernahme an (20.08.2026)
--
-- **Der Anlass.** Migration 030 hat `person.authentik_subject` angelegt, «der
-- Anknüpfungspunkt für einen eigenen Zugang der Eigentümer». Die Spalte ist
-- seither leer geblieben, und der einzige Weg, sie zu füllen, wäre Handarbeit
-- gewesen. Handpflege veraltet genau dann, wenn sie zählt: beim
-- Eigentümerwechsel.
--
-- Seit dem 20.08.2026 liefert immotool die Authentik-User-UUID je Eigentümer
-- mit (`docs/architecture/16-versammlung-export.md` dort). Sie kommt damit
-- durch dieselbe Tür wie alles andere: Datei, Vorschau, Bestätigung.
--
-- **Warum die Kennung an der Partei landet und nicht gleich an der Person.**
-- Die Übernahme legt Parteien an, keine Personen — eine Partei ist die Stimme,
-- eine Person ein Mensch im gemeinschaftsübergreifenden Register. Die Klammer
-- zwischen beiden setzt bis heute ein Mensch (`personenabgleich.ts`:
-- «Vorschlagen, nicht setzen»), weil ein falscher Treffer jemandem Zutritt zu
-- einer fremden Versammlung gäbe. Diese Regel bleibt. Die Kennung wartet hier,
-- bis die Klammer bestätigt ist, und wandert dann an die Person.
--
-- **Nur, wo die Partei genau eine Person führt.** Bei einem Ehepaar an einer
-- Einheit gehört die Stimme zweien; welche der beiden sich anmelden dürfte,
-- entscheidet keine Datenbank. Die Datei bringt in diesem Fall keine Kennung
-- mit, und die Übernahme sagt es an, statt eine der beiden auszuwählen.

ALTER TABLE party ADD COLUMN authentik_subject text;

-- Zwei Parteien derselben Gemeinschaft mit derselben Kennung wären ein Mensch
-- mit zwei Stimmen. Über Gemeinschaften hinweg ist dieselbe Kennung dagegen der
-- Normalfall und ausdrücklich gewollt: Wer in fünf Gemeinschaften Einheiten
-- hält, meldet sich einmal an und sieht alle (so begründet es Migration 030).
CREATE UNIQUE INDEX party_authentik_je_gemeinschaft
    ON party (stweg_id, authentik_subject)
    WHERE authentik_subject IS NOT NULL;

COMMENT ON COLUMN party.authentik_subject IS
    'Authentik-User-UUID aus der Übernahme (immotool, sub-Anspruch). Wartet hier, bis die Klammer zur Person bestätigt ist; nie die E-Mail-Adresse.';
