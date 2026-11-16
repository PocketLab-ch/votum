-- Story 3.1: Die Versammlung selbst (FR-8, AD-10, AD-14).
--
-- Der Zustand steht als Text mit Schranke, nicht als Aufzählungstyp: Welle 2
-- bringt weitere Übergänge, und ein `ALTER TYPE` mitten in einer Migrationskette
-- ist in PostgreSQL ein Ärgernis, das nichts einbringt. Die Schranke leistet
-- dasselbe und lässt sich additiv erweitern (AD-14).

CREATE TABLE meeting (
	id          uuid PRIMARY KEY,
	operator_id uuid NOT NULL REFERENCES operator (id),
	stweg_id    uuid NOT NULL,

	state text NOT NULL DEFAULT 'entwurf',

	-- Datum und Uhrzeit getrennt, ohne Zeitzone: Eine Versammlung findet um
	-- 19:00 Uhr am Ort statt. Als Zeitstempel mit Zone gespeichert, verschöbe sie
	-- sich beim Lesen aus einer anderen Zone — und die Einladung nennte eine
	-- andere Uhrzeit als die Traktandenliste.
	meeting_date date NOT NULL,
	start_time   time NOT NULL,
	location     text NOT NULL,

	-- ordentlich oder ausserordentlich
	kind text NOT NULL,
	-- Anlass, Pflicht bei ausserordentlich (Schranke unten)
	occasion text,

	-- erste oder zweite Versammlung im Sinne von Art. 712p
	tier text NOT NULL DEFAULT 'erste',
	previous_meeting_id uuid,
	-- Warum der Abstand kürzer als zehn Tage ist. Die Frist gilt trotzdem; der
	-- Text verhindert nur, dass ihr Bruch unbemerkt geschieht.
	interval_justification text,

	-- geführt oder einfach
	operation_mode text NOT NULL,

	current_agenda_item_id uuid,

	released_at timestamptz,
	opened_at   timestamptz,
	closed_at   timestamptz,

	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),

	FOREIGN KEY (stweg_id, operator_id) REFERENCES stweg (id, operator_id),
	-- Die Vorgängerin gehört demselben Betreiber. Ohne das Paar liesse sich eine
	-- fremde Versammlung als erste ausgeben und über sie deren Datum lesen.
	FOREIGN KEY (previous_meeting_id, operator_id) REFERENCES meeting (id, operator_id),
	UNIQUE (id, operator_id),

	CONSTRAINT meeting_zustand CHECK (
		state IN ('entwurf', 'freigegeben', 'laufend', 'geschlossen', 'versiegelt')
	),
	CONSTRAINT meeting_art CHECK (kind IN ('ordentlich', 'ausserordentlich')),
	CONSTRAINT meeting_stufe CHECK (tier IN ('erste', 'zweite')),
	CONSTRAINT meeting_betriebsart CHECK (operation_mode IN ('gefuehrt', 'einfach')),
	CONSTRAINT meeting_ort CHECK (length(btrim(location)) >= 2),

	-- Der Anlass ist bei der ausserordentlichen Versammlung Pflicht. An ihm
	-- bemisst sich, ob die Einberufung berechtigt war.
	CONSTRAINT meeting_anlass CHECK (
		kind <> 'ausserordentlich' OR length(btrim(coalesce(occasion, ''))) >= 3
	),
	-- Eine Zweitversammlung ohne Bezug zur ersten ist keine: Die erleichterte
	-- Beschlussfähigkeit nach Art. 712p Abs. 3 hängt daran, dass eine erste
	-- stattgefunden hat.
	CONSTRAINT meeting_vorgaenger CHECK (
		(tier = 'zweite' AND previous_meeting_id IS NOT NULL)
		OR (tier = 'erste' AND previous_meeting_id IS NULL)
	),
	CONSTRAINT meeting_nicht_selbst CHECK (previous_meeting_id <> id),

	-- Die Zeitstempel folgen dem Ablauf. Eine freigegebene Versammlung ohne
	-- Freigabezeitpunkt wäre im Streitfall nicht belegbar.
	CONSTRAINT meeting_zeitstempel CHECK (
		(state = 'entwurf' AND released_at IS NULL AND opened_at IS NULL AND closed_at IS NULL)
		OR (state = 'freigegeben' AND released_at IS NOT NULL AND opened_at IS NULL)
		OR (state = 'laufend' AND released_at IS NOT NULL AND opened_at IS NOT NULL AND closed_at IS NULL)
		OR (state IN ('geschlossen', 'versiegelt')
		    AND released_at IS NOT NULL AND opened_at IS NOT NULL AND closed_at IS NOT NULL)
	)
);

CREATE INDEX meeting_stweg_idx ON meeting (stweg_id, meeting_date DESC);

ALTER TABLE meeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting FORCE ROW LEVEL SECURITY;

CREATE POLICY meeting_mandant ON meeting
	USING (operator_id::text = current_setting('versammlung.operator_id', true));

-- Kein DELETE: Eine Versammlung, die stattgefunden hat, verschwindet nicht. Ein
-- Entwurf, der sich als überflüssig erweist, bleibt als Entwurf stehen — sonst
-- wäre die Grenze zwischen «nie stattgefunden» und «weggeräumt» eine Frage des
-- Zeitpunkts.
--
-- ENTZUG, nicht Vergabe. Migration 002 setzt `ALTER DEFAULT PRIVILEGES ... GRANT
-- SELECT, INSERT, UPDATE, DELETE ON TABLES`: Jede neue Tabelle bringt das
-- Löschrecht schon mit. Ein `GRANT SELECT, INSERT, UPDATE` an dieser Stelle
-- vergäbe eine Teilmenge des bereits Vergebenen und nähme nichts weg — es sähe
-- aus wie eine Schranke und wäre keine. Für die nachweisrelevanten Tabellen der
-- Epics 4 und 5 (Stimmen, Durchgänge, Beschlüsse) gilt nach AD-5 dasselbe.
REVOKE DELETE ON meeting FROM versammlung_app;

CREATE TRIGGER meeting_updated_at
	BEFORE UPDATE ON meeting
	FOR EACH ROW EXECUTE FUNCTION setze_updated_at();
