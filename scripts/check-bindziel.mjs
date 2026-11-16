/**
 * Bindziel-Wächter: `bind:` darf nicht auf eine Stelle zeigen, die es noch
 * nicht gibt.
 *
 * **Der Anlass, am 29.08.2026.** Am Eingang stand die gewählte Partei in einer
 * Tabelle über allen Zeilen, und die Zeile band daran:
 *
 * ```svelte
 * {#each saalmeldungen as m (m.id)}
 *   <Suchauswahl bind:wert={gewaehlt[m.id]} … />
 * ```
 *
 * Solange niemand gewählt hatte, gab es den Schlüssel `m.id` nicht. Svelte 5
 * wirft dann `props_invalid_value` — «Cannot do `bind:wert={undefined}` when
 * `wert` has a fallback value». Und zwar **beim Rendern**: Der `{#each}`-Block
 * brach ab, die Überschrift zählte weiter «Über den Beamer gemeldet (1)», und
 * darunter stand eine leere Liste.
 *
 * Das Ergebnis war kein Anzeigefehler, sondern ein Funktionsausfall: Eine über
 * den Beamer gemeldete Person liess sich weder zuordnen noch ablehnen, während
 * der Text daneben genau diese Handlung erklärte. Zwei Tage lang, in beiden
 * Einlass-Sichten, und der Durchstich meldete nur einen Klick, der ins Leere
 * ging.
 *
 * **Die Regel.** Kein `bind:` auf einen berechneten Zugriff (`obj[x]`).
 * Zustand, den es je Zeile gibt, gehört in eine Variable mit Anfangswert oder
 * wird über `beiWechsel` geschrieben — beides kennt den Fall «noch nichts
 * gewählt», ohne eine Stelle zu verlangen, die erst entstehen muss.
 *
 * **Warum die Regel schärfer ist als der Fehler.** Sie beanstandet auch den
 * Fall, in dem die Zielkomponente keinen Vorgabewert hat und Svelte deshalb
 * schweigt. Das ist Absicht: Ob ein Prop einen Vorgabewert trägt, entscheidet
 * eine andere Datei, und wer ihn dort ergänzt, sieht die Bindungen nicht, die
 * dadurch zu Fehlern werden. Die Regel «gar nicht auf berechnete Stellen
 * binden» lässt sich am Ort befolgen, an dem sie steht.
 *
 * **Was er NICHT sieht:**
 *
 *   1. `bind:wert={obj.feld}` auf einem `Record` — statisch nicht von einem
 *      Zugriff auf ein Objekt mit festen Feldern zu unterscheiden.
 *   2. Eine Variable, die zur Laufzeit `undefined` wird, obwohl sie mit einem
 *      Wert begann.
 *   3. `bind:` in einer Kindkomponente, die diese Datei nur einbindet.
 */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { jedenKnoten, svelteBaum, svelteDateien } from './svelte-baum.mjs';
import { mindestens } from './lib/pruefmenge.mjs';

/**
 * Die Wurzel als Argument, damit sich der Wächter gegen einen Wegwerfbaum
 * fahren lässt. Ohne Gegenprobe wäre nicht belegt, dass er im schlechten
 * Zustand überhaupt rot wird (`tests/waechter/bindziel.test.ts`).
 */
const WURZEL = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const IM_REPO = !process.argv[2];

/** Der gebundene Ausdruck als Text, für die Meldung. */
function alsText(inhalt, knoten) {
	if (knoten?.start === undefined || knoten?.end === undefined) return '{…}';
	return inhalt.slice(knoten.start, knoten.end).replace(/\s+/g, ' ');
}

const befunde = [];
let bindungen = 0;

for (const pfad of mindestens(
	svelteDateien(`${WURZEL}/src`),
	80,
	'Svelte-Bausteine unter src/'
)) {
	const inhalt = readFileSync(pfad, 'utf8');
	// `svelteBaum` wirft nicht, es gibt `null`, wenn sich die Datei nicht
	// übersetzen lässt. Dann meldet der Bau ohnehin, und zwar genauer.
	const baum = svelteBaum(pfad, inhalt);
	if (!baum) continue;
	/*
	 * **`jedenKnoten` und nicht `jedesElement`** (29.08.2026, beim Bau
	 * gemessen). `jedesElement` filtert auf `RegularElement` und
	 * `SvelteElement` — Komponenten lässt es ausdrücklich aus. Der Fehler, um
	 * den es hier geht, stand an einer Komponente (`<Suchauswahl>`), und die
	 * erste Fassung dieses Wächters war deshalb grün, während die defekte Zeile
	 * im Baum stand. Gemessen: 77 Bindungen an Elementen, 25 mehr an
	 * Komponenten.
	 */
	jedenKnoten(baum.fragment, (el) => {
		for (const a of el.attributes ?? []) {
			if (a.type !== 'BindDirective') continue;
			bindungen++;
			/*
			 * **`bind:this` bleibt aussen vor** (29.08.2026, aus dem Code-Review).
			 * Es bindet keinen Prop-Wert, sondern eine Elementreferenz; einen
			 * Vorgabewert gibt es dort nicht, und `props_invalid_value` kann nicht
			 * entstehen. `bind:this={felder[i]}` in eine Liste zu schreiben ist
			 * gängige Svelte-Schreibweise — sie hier zu beanstanden hiesse, den
			 * Prüflauf gegen etwas zu stellen, das nie fehlschlägt.
			 */
			if (a.name === 'this') continue;
			const ziel = a.expression;
			if (ziel?.type !== 'MemberExpression' || !ziel.computed) continue;
			const zeile = inhalt.slice(0, a.start ?? 0).split('\n').length;
			befunde.push(
				`${relative(WURZEL, pfad)}:${zeile}\n` +
					`  bind:${a.name}={${alsText(inhalt, ziel)}} an <${el.name}> zeigt auf einen\n` +
					'  berechneten Zugriff. Fehlt der Schlüssel beim Rendern, ist der gebundene\n' +
					'  Wert `undefined`.\n' +
					'  An einer Komponente mit `$bindable(vorgabe)` wirft Svelte dann\n' +
					'  `props_invalid_value` und bricht den umgebenden Block ab: Die Zeile\n' +
					'  verschwindet samt ihren Formularen, ohne dass etwas rot wird. An einem\n' +
					'  gewöhnlichen Element wirft es nicht, aber der Wert ist trotzdem keiner.\n' +
					'  Abhilfe: eine Variable mit Anfangswert, notfalls in einer eigenen\n' +
					'  Zeilenkomponente (`Zeilenauswahl.svelte` ist ein Beispiel).'
			);
		}
	});
}

if (befunde.length > 0) {
	console.error(
		'Bindziel: `bind:` zeigt auf eine Stelle, die es beim Rendern nicht geben muss.\n\n' +
			befunde.join('\n\n')
	);
	process.exit(1);
}

/*
 * **Die Sichtprobe**: Im guten Zustand muss der Wächter etwas zu prüfen HABEN.
 * Ohne sie wäre er grün, sobald ein Umbau die Baumsuche ins Leere laufen lässt
 * — und genau diese Bauart ist im Repo schon mehrfach still grün geworden.
 *
 * Die Schranke liegt dicht unter dem Ist (106 Bindungen am 29.08.2026). Sie ist
 * ausserdem der Wächter gegen genau den Fehler, der die erste Fassung blind
 * machte: Mit `jedesElement` statt `jedenKnoten` fielen 29 Bindungen weg, und
 * eine Schranke von 70 hätte das durchgehen lassen.
 *
 * Nur beim Lauf gegen das Repo. Ein Wegwerfbaum hat naturgemäss wenige
 * Bindungen, und die Probe soll dort nicht die Gegenprobe verdecken.
 */
if (IM_REPO && bindungen < 100) {
	console.error(
		`Bindziel: nur ${bindungen} bind:-Direktiven gesehen, erwartet mindestens 100\n` +
			'  (Stand 29.08.2026: 106, davon 29 an Komponenten). Findet die Baumsuche\n' +
			'  noch alles — und sieht sie auch die Komponenten?'
	);
	process.exit(1);
}

console.log(`Bindziel in Ordnung: ${bindungen} bind:-Direktiven, keine auf einen berechneten Zugriff.`);
