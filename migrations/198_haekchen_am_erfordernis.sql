-- 198: Das Häkchen «Begründungsakt oder Zustimmung aller» am Erfordernis des Traktandums
--
-- **Der Anlass** ist der Entscheid des Auftraggebers vom 18.11.2026, gewählte
-- Antwort «Auch Häkchen einfrieren»: «Das Häkchen kommt beim Freigeben in die
-- Momentaufnahme, und die Karte zeigt danach den damaligen Satz.» Bis dahin war
-- nur das gespeicherte Mehr eingefroren; der Satz an der Karte (H3 ohne, H4 mit
-- Häkchen, an der vereinbarten Verwendung ein eigener) kam live aus der Regel
-- der Gemeinschaft (Entscheid 0057).
--
-- **Am Erfordernis, nicht in `snapshot`.** Die Momentaufnahme hält, was für die
-- ganze Versammlung gilt: Stimmberechtigte, Zählweise, Lesarten. Eine Regel des
-- Reglements steht dort nicht; was von ihr gerechnet wird (Schwellen,
-- Bezugsgrössen, `requirement_abstention_counts`, Fundstelle in
-- `requirement_reference`), steht am Traktandum, das sie anwendet. Das Häkchen
-- ist ein Merkmal der Regel wie diese, also gehört es dorthin. Die Freigabe
-- friert das gespeicherte Erfordernis ein; `released_requirement` (Migration
-- 144) nimmt die Spalte mit, weil es eine Abschrift von `erfordernisAusZeile`
-- ist. Ein Häkchen in `snapshot` hätte zudem den Weg nach der Freigabe
-- abgeschnitten, den die Karte nennt (`FONDSENTNAHME_WEG_HAEKCHEN`: eine
-- mildere Regel mit Häkchen bis zur Eröffnung neu herleiten).
--
-- **Gefüllt nur, wo das Häkchen allein den Satz trägt** (`regelGesichert` in
-- `domain/reglement.ts`): an `k-erneuerungsfonds-entnahme` unter einer
-- angewandten strengeren Regel und an der vereinbarten Verwendung, je unter
-- L17 «streng» und ab der Fassung 2026-11-21. Wo es das Mehr ändert (eine
-- mildere Regel gilt nur mit ihm), friert es schon das Mehr ein. NULL heisst:
-- Kein Satz hängt am Häkchen, oder das Traktandum wurde vor dieser Migration
-- hergeleitet. Hängt an der neuen Herleitung ein Satz daran, zeigen Freigabe und
-- Kasten «nachziehen» ein solches Traktandum der Fassung 2026-11-21 als veraltet,
-- bis es neu hergeleitet ist (`l17Regelstaende`).
ALTER TABLE agenda_item ADD COLUMN requirement_rule_secured boolean;

COMMENT ON COLUMN agenda_item.requirement_rule_secured IS
	'Das Häkchen «Begründungsakt oder Zustimmung aller» der Regel, auf die sich der Satz an der Karte stützt, wo es nur diesen Satz ändert (Migration 198). NULL = kein solcher Satz.';
