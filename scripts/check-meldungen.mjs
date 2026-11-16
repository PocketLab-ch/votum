/**
 * Eine Meldung auf eine Handlung ist die Komponente, kein Absatz mit Klasse.
 *
 * **Der Anlass** (02.09.2026, Befund 9 aus den Reviews). Gemessen standen **76**
 * handgebaute `<p class="meldung">` in 31 Dateien neben **93** Verwendungen von
 * `Meldung.svelte`. Ob das ein Fehler ist, war ausdrücklich **nicht**
 * entschieden — festgehalten war nur die Zahl. (Die Befundliste nannte
 * zwischendurch «49»; das waren die *Dateien*, die den Baustein einbinden, nicht
 * die Verwendungen. Nachgezählt am Stand vor der Umstellung.)
 *
 * Beim Nachgehen zerfielen die 76 in **drei** Arten, und nur eine ist ein Befund:
 *
 * | Art | Woran sie hängt | Beispiel | Befund? |
 * |---|---|---|---|
 * | Dauerhinweis | `data`, oder nichts | «Diese Versammlung gehört zu einem Abend» | nein, er steht immer |
 * | **Handlungsmeldung** | **`form`** | «Regel hinterlegt.» nach dem Absenden | **ja, 26 Stellen** |
 * | Adressgetragen | `?getilgt=…` in der Adresse | «‹Anna Muster› ist getilgt.» | nein, siehe unten |
 *
 * **Warum eine adressgetragene Meldung hier nicht hingehört**, obwohl sie nach
 * einer Handlung erscheint: Der Baustein hängt am `marke`-Wert, und der ist bei
 * ihr `form` — also dauerhaft `null`. Einmal weggedrückt bliebe auch die nächste
 * weg. Der Weg dafür ist `beimSchliessen`, das den Abfrageteil streicht; das ist
 * eine eigene Sache und keine Umstellung. Der Wächter fragt nach `form` und
 * erwischt sie deshalb von selbst nicht — solange die Bedingungen richtig
 * zugeordnet sind, siehe `mitBedingungen`.
 *
 * Die Reglementseite trug beides untereinander: Der Fehlerfall war die
 * Komponente, die **neun** Erfolgsfälle darunter waren blanke Absätze. Damit
 * fehlt genau dort alles, was der Auftraggeber sich gewünscht hat:
 *
 *   - **Wegdrücken** (20.08.2026: «Die rote Meldung soll weggedrückt werden
 *     können») — ein Absatz hat keinen Knopf.
 *   - **Der Einblender unten rechts** (21.08.2026: «wenn eine Aktion erfolgreich
 *     war … in ein Fenster das unten rechts aufpoppt»). `ton="gut"` zieht dort
 *     hin; ein handgebauter Erfolgssatz bleibt stehen, wo er ist.
 *   - **Sich ins Bild rollen** (27.08.2026): Wer unten auf einer langen Seite
 *     absendet, sieht eine Absage am Seitenkopf gar nicht und klickt noch einmal.
 *   - **Den Fokus annehmen** (`tabindex="-1"`): Der Fokusgriff in
 *     `betreiber/dienste` sucht `.meldung[tabindex="-1"]` — ein handgebauter
 *     Absatz ist kein Ziel, aber er stand dem echten im Weg.
 *
 * **Die Regel.** Steht eine `<p class="meldung …">` in einem Zweig, dessen
 * Bedingung `form` liest, gehört dort die Komponente hin. Alles andere bleibt,
 * wie es ist — eine Regel «nie eine Klasse» trüge der Bestand nicht und würde
 * abgeschaltet.
 *
 * **Gelesen wird der Svelte-Baum**, nicht ein Textmuster: Welche Bedingung über
 * einem Absatz steht, ist an Zeilen nicht abzulesen, und `class:x={…}` steht in
 * keinem `class="…"` (dieselbe Begründung wie in `scripts/svelte-baum.mjs`).
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { svelteBaum, svelteDateien, festerWert, KINDERSCHLUESSEL } from './svelte-baum.mjs';

const WURZEL = process.argv[2] ?? process.cwd();

/** Der Baustein, der es richtig macht. */
const KOMPONENTE = 'Meldung';

/**
 * Woran eine Handlungsmeldung hängt.
 *
 * `form` ist in SvelteKit die Antwort auf ein abgeschicktes Formular — genau
 * das, was eine Meldung zur Handlungsmeldung macht. Ein Zustand, der aus `data`
 * kommt, steht beim Laden schon da und ist ein Dauerhinweis.
 */
const HANDLUNG = /\bform\b/;

/**
 * Der Quelltext einer Bedingung.
 *
 * Der Baum trägt die Ausdrücke als eigene Knoten mit `start`/`end`; den Text
 * dazwischen holt sich die Regel aus der Datei. Den Ausdruck selbst zu
 * zerlegen wäre genauer und für diese eine Frage — «kommt `form` darin vor» —
 * unnötig.
 */
function quelltext(inhalt, knoten) {
	if (typeof knoten?.start !== 'number' || typeof knoten?.end !== 'number') return '';
	return inhalt.slice(knoten.start, knoten.end);
}

/**
 * Läuft über die Knoten und merkt sich die Bedingungen, unter denen sie stehen.
 *
 * `jedenKnoten` aus `svelte-baum.mjs` reicht hier nicht: Es verliert unterwegs,
 * aus welchem `{#if}` ein Knoten stammt, und genau das ist die Frage.
 */
function mitBedingungen(fragment, inhalt, tun, bedingungen = []) {
	for (const knoten of fragment?.nodes ?? []) {
		tun(knoten, bedingungen);
		for (const schluessel of KINDERSCHLUESSEL) {
			const teil = knoten[schluessel];
			if (!teil?.nodes) continue;
			/*
			 * **Nur der Ja-Zweig erbt die Bedingung** (02.09.2026, aus dem
			 * Code-Review; der erste Anlauf hängte sie auch an `alternate`).
			 *
			 * Im `{:else}` gilt die Bedingung gerade **nicht**. Der Fehler ist
			 * keiner auf dem Papier: `zugaenge/+page.svelte` trägt
			 * `{#if form?.bericht} … {:else if data.absage}` — die Absage kommt über
			 * die **Adresse** zurück, weil eine Dateiauslieferung keine
			 * Formularantwort kennt. Sie wurde als Handlungsmeldung gemeldet und
			 * daraufhin auf `marke={form}` umgestellt, wo `form` gar nichts ändert.
			 * Zwei Stellen sind so falsch umgebaut worden, bevor es auffiel.
			 */
			const eigene =
				knoten.type === 'IfBlock' && schluessel === 'consequent'
					? [...bedingungen, quelltext(inhalt, knoten.test)]
					: bedingungen;
			mitBedingungen(teil, inhalt, tun, eigene);
		}
	}
}

const befunde = [];
let geprueft = 0;
let handgebaut = 0;
let komponenten = 0;

for (const pfad of svelteDateien(join(WURZEL, 'src'))) {
	const kurz = relative(WURZEL, pfad);
	const inhalt = readFileSync(pfad, 'utf8');
	const baum = svelteBaum(pfad, inhalt);
	// Unlesbares meldet `check:lesbar` als erster Schritt der Kette.
	if (!baum) continue;
	geprueft++;

	mitBedingungen(baum.fragment, inhalt, (knoten, bedingungen) => {
		if (knoten.type === 'Component' && knoten.name === KOMPONENTE) komponenten++;
		if (knoten.type !== 'RegularElement') return;
		/*
		 * **Auch eine Klasse aus einem Ausdruck** (02.09.2026, aus dem
		 * Code-Review). `festerWert` liefert bei `class={"meldung gut"}` oder
		 * `class="meldung {ton}"` ein `null` — beide Formen fielen damit durch
		 * die Regel **und** durch die Sichtprobe, und ein Anführungszeichen mehr
		 * hätte genügt, um den Wächter loszuwerden.
		 *
		 * Der Quelltext des Attributs ist grob und für diese eine Frage genug:
		 * Kommt das Wort darin vor, wird geprüft. Ein Fehlalarm wäre hier eine
		 * Meldung, die «meldung» nur im Text erwähnt — die gibt es nicht.
		 */
		const fest = festerWert(knoten, 'class');
		const klassenattribut = knoten.attributes?.find(
			(/** @type {any} */ a) => a.type === 'Attribute' && a.name === 'class'
		);
		const traegtKlasse =
			fest !== null
				? fest.split(/\s+/).includes('meldung')
				: /\bmeldung\b/.test(quelltext(inhalt, klassenattribut));
		if (!traegtKlasse) return;
		handgebaut++;

		// Die Komponente selbst trägt die Klasse — sie ist der Sollzustand.
		if (kurz.endsWith(`${KOMPONENTE}.svelte`)) return;

		if (!bedingungen.some((b) => HANDLUNG.test(b))) return;

		/*
		 * **Eine Meldung mit Blockinhalt ist ein anderer Baustein.**
		 *
		 * Fünf Stellen tragen im Inneren mehr als einen Satz: die Rückfrage vor
		 * dem Eröffnen mit ihren zwei Knöpfen, das «Rückgängig» neben der
		 * Bestätigung, der Versandbericht mit der Liste der nicht Zugestellten,
		 * die Warnung vor der Übernahme mit ihren Punkten.
		 *
		 * `Meldung.svelte` rendert ein `<p>`. Ein `<form>`, ein `<ul>` oder ein
		 * zweiter `<p>` darin ist **ungültiges HTML**: Der Browser schliesst den
		 * Absatz vor dem Blockelement und stellt den Rest daneben — die Meldung
		 * zerfiele sichtbar in Stücke. Das ist keine Sparfassung, sondern ein
		 * anderer Fall.
		 *
		 * Ausgenommen wird deshalb der **Inhalt**, nicht die Schreibweise: Ein
		 * `<div class="meldung">` mit blossem Text bleibt ein Befund, sonst
		 * genügte ein anderes Element, um die Regel loszuwerden.
		 */
		/*
		 * **Nur echte Blockelemente befreien** (aus dem Code-Review). Der erste
		 * Anlauf liess auch jede Kindkomponente durch — damit wäre
		 * `<p class="meldung gut"><Symbol />Gespeichert.</p>` still grün geworden,
		 * obwohl ein Zeichen im Text nichts über den Baustein aussagt. Eine
		 * Komponente, die selbst einen Block rendert, fällt jetzt auf und wird
		 * einzeln beurteilt statt pauschal befreit.
		 */
		const BLOCKINHALT = ['form', 'ul', 'ol', 'p', 'div', 'table', 'section', 'label'];
		let mitBlock = false;
		for (const schluessel of KINDERSCHLUESSEL) {
			const teil = knoten[schluessel];
			if (!teil?.nodes) continue;
			mitBedingungen(teil, inhalt, (kind) => {
				if (kind.type === 'RegularElement' && BLOCKINHALT.includes(kind.name)) mitBlock = true;
			});
		}
		if (mitBlock) return;

		const zeile = inhalt.slice(0, knoten.start).split('\n').length;
		befunde.push(
			`${kurz}:${zeile}  <${knoten.name} class="${festerWert(knoten, 'class')}">\n` +
				`  Diese Meldung erscheint nach einer Handlung (Bedingung: ${bedingungen
					.filter((b) => HANDLUNG.test(b))
					.join(' · ')}).\n` +
				`  Als blanker Absatz lässt sie sich nicht wegdrücken, rollt sich nicht ins Bild,\n` +
				`  nimmt keinen Fokus an — und eine Erfolgsmeldung wandert nicht in den Einblender\n` +
				`  unten rechts. Nimm <${KOMPONENTE} ton="gut|warnung|fehler" marke={form}>…</${KOMPONENTE}>.`
		);
	});
}

if (befunde.length > 0) {
	console.log('\nMeldungswächter: Befunde\n');
	for (const b of befunde) console.log(b + '\n');
	process.exit(1);
}

/*
 * **Die Sichtproben.** Ein Lauf über null Dateien, ohne eine einzige Meldung
 * oder ohne eine einzige Verwendung der Komponente wäre grün und wertlos —
 * dieselbe Klasse, die am 02.09.2026 beim Seitenaufbau-Wächter zuschlug.
 */
if (geprueft < 50) {
	console.error(`Meldungen: nur ${geprueft} Dateien gelesen — der Lauf greift nicht.`);
	process.exit(1);
}
if (handgebaut === 0) {
	console.error(
		'Meldungen: keine einzige `class="meldung"` gefunden. Entweder heisst die Klasse\n' +
			'anders — dann gehört dieser Wächter angepasst — oder er liest das Markup nicht mehr.'
	);
	process.exit(1);
}
if (komponenten === 0) {
	console.error(
		`Meldungen: keine einzige Verwendung von <${KOMPONENTE}> gefunden. Ohne sie hat der\n` +
			'Wächter keinen Sollzustand, auf den er zeigen könnte.'
	);
	process.exit(1);
}

console.log(
	`Meldungen in Ordnung: ${geprueft} Dateien geprüft, ${komponenten}× <${KOMPONENTE}>, ` +
		`${handgebaut} Absätze mit der Klasse — keiner davon an einer Handlung.`
);
