import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verlangtVerwaltung } from '../../src/lib/domain/rollen';

/**
 * Woran der Rollenwächter den Bereich erkennt — und woran er ihn **nicht**
 * erkennen darf.
 *
 * **Der Anlass** (Sicherheitsdurchgang 15.09.2026, am laufenden Stand
 * nachgemessen). Der Wächter in `hooks.server.ts` verglich den **rohen**
 * `event.url.pathname`. SvelteKit löst die Route aber über den **dekodierten**
 * Pfad auf. Gemessen mit einem Konto der Rolle `chair`:
 *
 * | Aufruf | vorher | nachher |
 * |---|---|---|
 * | `POST /gemeinschaften` | 403 | 403 |
 * | `POST /%67emeinschaften` | **Aktion lief** | 403 |
 *
 * `%67` ist ein `g`. Ein einziges kodiertes Zeichen hob die Rollentrennung auf,
 * und zwar für jeden Schreibweg unter `/gemeinschaften`, `/betreiber` und
 * `/personen` — Wertquoten ändern, Konten anlegen, Gemeinschaften entfernen.
 *
 * **Was dieser Wächter hält.** Nicht «der Fehler ist behoben» (das misst der
 * Durchstich `e2e/rollenumgehung.mjs` am laufenden System), sondern die Klasse:
 * Die Rollenprüfung darf sich nie wieder **allein** auf den rohen Pfad stützen.
 * Wer den Hook umbaut und den Routenanker herausnimmt, wird hier rot.
 */

const WURZEL = process.cwd();
const ROH = readFileSync(join(WURZEL, 'src/hooks.server.ts'), 'utf8');

/**
 * Derselbe Quelltext **ohne Kommentare**.
 *
 * **Warum das nötig ist** (bei der Gegenprobe zu diesem Wächter gemerkt): Die
 * erste Fassung suchte `event.route.id` im rohen Text. Gegen den alten,
 * verwundbaren Stand blieb sie grün — der Ausdruck stand ja noch im Kommentar
 * darüber, der die Falle erklärt. Ein Wächter, der die Begründung für die
 * Umsetzung nimmt, entwarnt genau dann, wenn jemand den Code entfernt und die
 * Prosa stehen lässt. Das ist der wahrscheinlichste Umbau von allen.
 */
const HOOKS = ROH.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

describe('verlangtVerwaltung kennt nur den Pfad, den sie bekommt', () => {
	it('erkennt den gewöhnlichen Bereichspfad', () => {
		expect(verlangtVerwaltung('/gemeinschaften', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/personen', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/betreiber', 'POST')).toBe(true);
	});

	it('erkennt einen kodierten Pfad NICHT — und das ist kein Fehler dieser Funktion', () => {
		/*
		 * Diese Zusicherung steht hier, damit niemand sie «behebt». Die Funktion
		 * vergleicht Zeichenketten und soll das auch; das Dekodieren gehört an die
		 * Stelle, die den Pfad besorgt. Dass sie hier `false` liefert, ist genau
		 * der Grund, warum der Aufrufer einen zweiten Anker braucht.
		 */
		expect(verlangtVerwaltung('/%67emeinschaften', 'POST')).toBe(false);
		expect(verlangtVerwaltung('/%70ersonen', 'POST')).toBe(false);
	});

	it('lässt Lesen für beide Rollen offen', () => {
		expect(verlangtVerwaltung('/gemeinschaften', 'GET')).toBe(false);
		expect(verlangtVerwaltung('/gemeinschaften', 'HEAD')).toBe(false);
	});

	it('hält die Ausnahme für das Ansetzen einer Versammlung', () => {
		// Die Sitzungsleitung setzt Versammlungen an, obwohl der Pfad im
		// Verwaltungsbereich liegt. Diese Ausnahme muss auch für die Route gelten.
		expect(verlangtVerwaltung('/gemeinschaften/abc/versammlungen/neu', 'POST')).toBe(false);
		expect(verlangtVerwaltung('/gemeinschaften/[id=kennung]/versammlungen/neu', 'POST')).toBe(
			false
		);
	});
});

describe('Wächter: die Rollenprüfung hängt nicht am rohen Pfad allein', () => {
	it('liest überhaupt etwas — sonst misst der Wächter nichts', () => {
		// Die Sichtprobe: Wird die Datei verschoben oder umbenannt, fände dieser
		// Wächter nichts mehr und wäre für immer grün.
		expect(HOOKS).toContain('verlangtVerwaltung');
		expect(HOOKS).toContain('darfStammdatenAendern');
	});

	/**
	 * Der Ausschnitt um die Rollenprüfung — nicht die ganze Datei.
	 *
	 * **Warum das genau hier zählt** (bei der Gegenprobe gemerkt): `event.route.id`
	 * steht in `hooks.server.ts` noch an zwei weiteren Stellen, im Protokoll und
	 * in der Fehlerbehandlung. Ein Wächter, der nur die Datei durchsucht, findet
	 * sie dort und entwarnt — auch dann, wenn die Rollenprüfung selbst den Anker
	 * gar nicht mehr heranzieht. Er hätte den alten, verwundbaren Stand für
	 * gesund erklärt.
	 */
	const stelle = (() => {
		const ende = HOOKS.indexOf('darfStammdatenAendern(event.locals.benutzer.role)');
		return ende < 0 ? '' : HOOKS.slice(Math.max(0, ende - 600), ende);
	})();

	it('findet die Rollenprüfung überhaupt', () => {
		// Ohne diese Probe wäre `stelle` bei einem Umbau leer und alles darunter
		// grün — der lautlose Fehler, den dieser Wächter verhindern soll.
		expect(stelle.length).toBeGreaterThan(50);
		expect(stelle).toContain('verlangtVerwaltung');
	});

	it('zieht die aufgelöste Route heran, direkt an der Rollenprüfung', () => {
		/*
		 * `event.route.id` ist der Anker, der sich nicht kodieren lässt: SvelteKit
		 * setzt ihn aus der aufgelösten Route, und die entsteht aus dem
		 * dekodierten Pfad. Am laufenden Stand gemessen — bei `/gemeinschaften`
		 * **und** bei `/%67emeinschaften` steht dort `/gemeinschaften`.
		 */
		expect(
			/event\.route\??\.id/.test(stelle),
			'Die Rollenprüfung zieht `event.route.id` nicht heran — sie hängt dann wieder ' +
				'am rohen Pfad, und ein kodiertes Zeichen hebt sie auf'
		).toBe(true);
	});

	it('sperrt, sobald EIN Anker den Verwaltungsbereich trifft', () => {
		/*
		 * **Die Richtung ist der Punkt.** `some` sperrt, sobald ein Anker den
		 * Bereich trifft; `every` verlangte beide und liesse durch, sobald einer
		 * danebenliegt — genau die nachgiebige Richtung, die den Fehler wieder
		 * öffnete. Ebenso ein `route.id ?? pfad`: Fällt die Route weg, prüfte man
		 * wieder nur den rohen Pfad.
		 */
		expect(
			/\.some\(/.test(stelle),
			'Die Rollenprüfung sperrt nicht mehr, sobald EIN Anker den Verwaltungsbereich ' +
				'trifft. Mit `every` oder `??` genügt ein danebenliegender Anker zum Durchkommen.'
		).toBe(true);
	});
});
