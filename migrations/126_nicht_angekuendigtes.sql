-- 126 — Ausnahmen bei nicht angekündigten Geschäften, an der Gemeinschaft
--
-- **Der Anlass.** Beim Anlegen dieser Migration sagt Votum, über ein nicht
-- angekündigtes Geschäft könne «nicht beschlossen werden, auch nicht, wenn die
-- Versammlung einverstanden ist». Das Gesetz enthält dieses unbedingte Verbot nicht
-- (Fachprüfung 29.09.2026, Befund D): ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2
-- lässt den Beschluss zu, wenn das Reglement es ausdrücklich gestattet
-- (Rz. 31, 32 ad Art. 712n), und eine Universalversammlung entscheidet selbst
-- ohne Traktandenliste (Rz. 28, 39 ad Art. 712n).
--
-- **Produktentscheid 29.09.2026:** «Ausnahmen gestatten», beide. Zur Frage, ob
-- an der Universalversammlung eine Vertretung genügt, blieb die Fachprüfung bei
-- «vertretbar, aber offen». Darauf der Produktentscheid vom selben Tag: die
-- Variante als Einstellung an der Gemeinschaft, damit die Sitzungsleitung sie
-- wählt und verantwortet, nicht das Werkzeug.
--
-- **Hier nur die Angaben.** Die Absagen beim Aufnehmen und Eröffnen lesen sie
-- erst ab dem folgenden Block desselben Auftrags.
--
-- **Drei Angaben, getrennt.**
--
--   unannounced_bylaw_allowed / _source
--       Das Reglement gestattet Beschlüsse über nicht Angekündigtes. Mit
--       Pflicht-Fundstelle, wie Zählweise, Vollmachtschranke und
--       Änderungsschranke (Migration 101).
--
--   universal_meeting_mode / _source
--       Wer bei der Universalversammlung als da gilt:
--         persoenlich  selbst erschienen. Das Organ einer juristischen Person
--                      zählt als die Eigentümerin selbst (Rz. 24 ad Art. 712m).
--                      Bei gemeinsamem Eigentum genügt einer je Einheit
--                      (Produktentscheid 29.09.2026, nach Art. 712o Abs. 1:
--                      eine Stimme je Einheit, «durch einen Vertreter»); ob
--                      das Recht es ebenso sieht, sagt keine Stelle (Rz. 19,
--                      22 ad Art. 712o). Die Vorgabe, weil sie die sicherste
--                      Lesart ist (Fachprüfung 29.09.2026, Runde 2).
--         vertreten    auch mit gewöhnlicher Vollmacht. Vertretbar, gestützt
--                      auf die Anlehnung an Art. 701 OR (Rz. 5a, 28 ad
--                      Art. 712n), aber offen: Rz. 5a ad Art. 712m warnt vor
--                      einer unreflektierten Übernahme aus dem Aktienrecht.
--         keine        das Reglement schliesst sie aus oder die Gemeinschaft
--                      will sie nicht (Fachprüfung, B-6).
--       Die Fundstelle ist freiwillig: Sie belegt eine eigene Regel des
--       Reglements, wo es eine gibt.
--
--   universal_chair_proxies_count
--       Ob Vollmachten, die die Sitzungsleitung oder die Verwaltung hält, bei
--       der Universalversammlung mitzählen (Fachprüfung 29.09.2026, B-4).
--       Vorgabe nein: Die Leitung soll neutral bleiben (Rz. 91 ad Art. 712n)
--       und kein eigenes, nicht angekündigtes Geschäft durch das Schweigen
--       ihrer Vertretenen beschliessen lassen. Wirkt nur bei «vertreten».
--
-- **Die Vorgaben folgen der besten Praxis** (Produktentscheid 29.09.2026: «Bei
-- Themen die mehrere zulässige Auswahl bestehen, soll die Sitzungsleitung in
-- den Einstellung Gemeinschaft voreinstellen können. […] Default-Wert aber
-- vorgeben, was beste Praxis ist.»)
ALTER TABLE stweg ADD COLUMN unannounced_bylaw_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE stweg ADD COLUMN unannounced_bylaw_source  text;

ALTER TABLE stweg ADD CONSTRAINT stweg_nichtangekuendigtes_fundstelle
    CHECK (NOT unannounced_bylaw_allowed
           OR length(btrim(coalesce(unannounced_bylaw_source, ''))) >= 3);

ALTER TABLE stweg ADD COLUMN universal_meeting_mode text NOT NULL DEFAULT 'persoenlich';
ALTER TABLE stweg ADD COLUMN universal_meeting_source text;

ALTER TABLE stweg ADD COLUMN universal_chair_proxies_count boolean NOT NULL DEFAULT false;

ALTER TABLE stweg ADD CONSTRAINT stweg_universalversammlung_variante
    CHECK (universal_meeting_mode IN ('persoenlich', 'vertreten', 'keine'));

COMMENT ON COLUMN stweg.unannounced_bylaw_allowed IS
    'Ob das Reglement Beschlüsse über nicht angekündigte Gegenstände ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2). Vorgabe: nein.';
COMMENT ON COLUMN stweg.unannounced_bylaw_source IS
    'Wo diese Bestimmung im Reglement steht. Pflicht, sobald sie gesetzt ist.';
COMMENT ON COLUMN stweg.universal_meeting_mode IS
    'Wer bei der Universalversammlung als da gilt: persoenlich (Vorgabe), vertreten, keine.';
COMMENT ON COLUMN stweg.universal_meeting_source IS
    'Fundstelle einer eigenen Regel des Reglements zur Universalversammlung, falls vorhanden.';
COMMENT ON COLUMN stweg.universal_chair_proxies_count IS
    'Ob Vollmachten der Sitzungsleitung oder Verwaltung bei der Universalversammlung zählen. Vorgabe: nein.';
