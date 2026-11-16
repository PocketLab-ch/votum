-- Zimmerzahl, Fläche und Lage als eigene Angaben der Einheit.
--
-- **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, Befund 26): «‹Einheit
-- hinzufügen› hat nur ein Feld ‹Bezeichnung›. Zimmerzahl, Fläche und Lage
-- landen in einem Klumpen, der überall erscheint, auch auf der Zugangskarte.»
--
-- Wer eine Wohnung erfasst, schreibt heute «3.5 Zi. Wohnung, 87 m², EG links»
-- in die Bezeichnung, weil es kein anderes Feld gibt. Danach steht dieser Satz
-- an jeder Stelle, an der die Einheit genannt wird: in der Auswahl beim
-- Ausstand, auf der Zugangskarte, in der Anwesenheitsliste, im Protokoll.
--
-- **Additiv, und der Klumpen bleibt.** Die Spalten sind alle NULL-fähig und
-- ohne Vorgabewert. Es wird **nichts** aus `label` herausgerechnet: Eine
-- Migration, die «3.5 Zi. Wohnung, 87 m², EG links» zerlegt, rät — sie träfe
-- «Bastelraum Nr. 4» genauso und schriebe dort eine Zimmerzahl hinein, die
-- niemand erfasst hat. Wer die Angaben trennen will, trägt sie nach; die
-- Bezeichnung bleibt, bis jemand sie von Hand kürzt.
--
-- **Warum die Fläche als Zahl und nicht als Text.** Sie wird sortiert und
-- verglichen (grösste Wohnung, Fläche je Stockwerk); als Text sortierte «100»
-- vor «87». `numeric(8,2)` reicht für jede Wohnung und lässt Halbmeter zu.
--
-- **Warum die Zimmerzahl ebenfalls numerisch.** «3.5» ist der Normalfall in der
-- Schweiz, «3 ½» die Schreibweise. Als Zahl gespeichert, als Zahl geschrieben —
-- die Schreibweise ist Sache der Anzeige.
--
-- **Und warum die Lage frei bleibt.** «EG links», «2. OG», «Attika», «Süd»:
-- Eine Auswahlliste träfe die Hälfte der Häuser nicht, und was sie nicht trifft,
-- landete wieder im Klumpen.
ALTER TABLE unit
	ADD COLUMN rooms numeric(4, 1),
	ADD COLUMN area_m2 numeric(8, 2),
	ADD COLUMN location text;

COMMENT ON COLUMN unit.rooms IS
	'Zimmerzahl, etwa 3.5. NULL = nicht erfasst (Befund 26, 07.09.2026).';
COMMENT ON COLUMN unit.area_m2 IS
	'Fläche in Quadratmetern. NULL = nicht erfasst.';
COMMENT ON COLUMN unit.location IS
	'Lage im Haus, frei: «EG links», «2. OG», «Attika». NULL = nicht erfasst.';

-- Keine Zahl unter null, und keine Fläche, die aus einem Tippfehler stammt.
-- «870» statt «87» fiele sonst erst auf, wenn jemand die Summe bildet.
ALTER TABLE unit
	ADD CONSTRAINT unit_rooms_plausibel CHECK (rooms IS NULL OR (rooms > 0 AND rooms <= 30)),
	ADD CONSTRAINT unit_area_plausibel CHECK (area_m2 IS NULL OR (area_m2 > 0 AND area_m2 <= 10000)),
	-- Auch die Lage: Der Kern hält 60 Zeichen, aber `uebernahme.ts` schreibt mit
	-- eigenem INSERT an ihm vorbei. Eine Schranke, die nur im Kern steht, hat
	-- genau so viele Lücken wie es Schreibwege gibt.
	ADD CONSTRAINT unit_location_kurz CHECK (location IS NULL OR char_length(location) <= 60);
