/**
 * Fokusmarken-Wächter: Die Marke muss ihr Ziel finden.
 *
 * **Der Anlass, am 28.08.2026.** Nach einer Absendung ohne Seitenwechsel setzt
 * SvelteKit den Fokus auf `<body>` (`reset_focus` in `client.js`, nur im
 * Erfolgszweig). `absenden()` holt ihn zurück, indem es das Element mit dem
 * passenden `data-fokus` sucht. Dieser Griff kann auf zwei Arten ins Leere
 * gehen, und **beide sind lautlos** — die Fachwirkung bleibt richtig, nur der
 * Fokus liegt danach im Nichts. Wer mit der Tastatur arbeitet, tabbt sich
 * durch die ganze Seite zurück; die Sprachausgabe sagt gar nichts.
 *
 * **1. Das Attribut heisst anders.** Bis zum 28.08.2026 gab `Rueckfrage.svelte`
 * seine Marke als `data-marke` aus, während drei Seiten mit eigener Fabrik
 * ebenfalls `data-marke` lasen und alles übrige `data-fokus` verwendete. Wer
 * eine Rückfrage auf eine Seite der anderen Familie setzte, bekam keinen
 * Fehler. Heute lesen nur noch `absenden()` und die eigene Fabrik in
 * `betreiber/dienste` die Marke, und beide nur als `data-fokus`; ein
 * `data-marke` im Baum hätte also überhaupt keinen Leser mehr.
 *
 * **2. Die Marke zeigt auf nichts.** `absenden({ marke: 'anlegen' })` sucht
 * `[data-fokus="anlegen"]`. Steht das nirgends — weil der Knopf umbenannt oder
 * das Feld ersetzt wurde —, sucht der Griff vergeblich. Beide Stellen sehen
 * für sich richtig aus; nur zusammen ergeben sie einen Sinn.
 *
 * **Was er nicht sehen kann:**
 *
 *   1. **Marken aus Ausdrücken.** `data-fokus="hand:{s.parteiId}"` und
 *      `absenden({ marke: gegenstand })` stehen erst zur Laufzeit fest. Für den
 *      häufigen Fall ist das kein Verlust: Dort trägt der gedrückte Knopf seine
 *      Marke selbst, `absenden()` liest sie von ihm, und es gibt gar keine
 *      zweite Stelle, die auseinanderlaufen könnte.
 *   2. **Marken über Dateigrenzen.** Verglichen wird je Datei. Was eine
 *      *Zielgeber*-Komponente auszeichnet, zählt mit (siehe `zielgeber`
 *      unten); ein `data-fokus`, das eine Kindkomponente aus eigenem Antrieb
 *      an ein Element schreibt, nicht. Solche Fälle gibt es heute keine, und
 *      ein Ziel, das man in einer anderen Datei suchen muss, wäre ohnehin die
 *      schlechtere Anordnung.
 *   3. **Den zweiten Griff.** Verschwindet die Handlung nach dem Erfolg, nimmt
 *      `absenden()` eine andere Handlung desselben Gegenstands
 *      (`endsWith(':<gegenstand>')`). Dass es die gibt, steht hier nicht zur
 *      Prüfung; sie hängt am Zustand der Zeile.
 */
import { readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { jedenKnoten, svelteBaum, svelteDateien, festerWert } from './svelte-baum.mjs';
import { mindestens } from './lib/pruefmenge.mjs';

/**
 * Die Wurzel als Argument, damit sich der Wächter gegen einen Wegwerfbaum
 * fahren lässt. Ohne Gegenprobe wäre nicht belegt, dass er im schlechten
 * Zustand überhaupt rot wird (`tests/waechter/fokusmarke.test.ts`).
 */
const WURZEL = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
/*
 * **Am Pfad erkannt, nicht am Argument.** `IM_REPO = !process.argv[2]` hätte
 * die Sichtprobe in zwei Fällen still abgeschaltet: bei
 * `node scripts/check-fokusmarke.mjs .` aus dem Repo heraus, und im Gegentest,
 * der den Wächter immer mit ausdrücklicher Wurzel fährt. Genau dieser Zweig
 * soll dort aber mitlaufen, sonst steht seine Schranke doppelt (28.08.2026).
 */
const IM_REPO = WURZEL === process.cwd();

/**
 * Die feste Marke aus einem `absenden({ marke: '…' })`, am Syntaxbaum gelesen.
 *
 * **Nicht über den Dateitext.** Der erste Anlauf suchte im Quelltext und fand
 * fünf Marken statt vier: Die fünfte stand in einem `<!-- … -->`, das den
 * Baustein erklärt. Ein Wächter, der an einer Erklärung anschlägt, treibt die
 * nächste Sitzung dazu, die Erklärung zu löschen.
 *
 * **Und auch nicht über einen Ausschnitt daraus.** Der zweite Anlauf schnitt
 * den Ausdruck aus dem Baum und liess eine Regex darüber laufen; die kannte
 * nur einfache Anführungszeichen, und `marke: "x"` lief grün durch. Der Parser
 * hat den Ausdruck längst als Baum: `CallExpression` → `ObjectExpression` →
 * `Literal`. Eine Zeichenkette ist dort eine Zeichenkette, gleich wie sie
 * geschrieben steht.
 */
function markeAusAufruf(knoten) {
	if (knoten?.type !== 'CallExpression' || knoten.callee?.name !== 'absenden') return null;
	const art = knoten.arguments?.[0];
	if (art?.type !== 'ObjectExpression') return null;
	for (const e of art.properties ?? []) {
		if (e.type !== 'Property' || e.key?.name !== 'marke') continue;
		return typeof e.value?.value === 'string' ? e.value.value : null;
	}
	return null;
}

/**
 * Jeden `absenden(...)`-Aufruf eines Ausdrucksbaums melden.
 *
 * **Warum ein eigener Durchlauf und nicht nur `use:enhance`.** Vier Aufrufe im
 * Bestand stehen als `const nachPruefung = absenden({ … })` im `<script>` und
 * werden am Formular nur noch benannt. Genau diese Schreibweise hat der Block
 * vom 28.08.2026 eingeführt, und der erste Wächterentwurf sah sie nicht — er
 * hätte den Fehler, gegen den er antritt, in der eigenen Neuerung übersehen.
 */
function jedenAufruf(knoten, tun, gesehen = new Set()) {
	if (!knoten || typeof knoten !== 'object' || gesehen.has(knoten)) return;
	gesehen.add(knoten);
	if (Array.isArray(knoten)) {
		for (const k of knoten) jedenAufruf(k, tun, gesehen);
		return;
	}
	if (knoten.type === 'CallExpression') tun(knoten);
	for (const [schluessel, teil] of Object.entries(knoten)) {
		// `parent`/`leadingComments` führen zurück oder in den Quelltext.
		if (schluessel === 'parent' || schluessel === 'loc') continue;
		if (teil && typeof teil === 'object') jedenAufruf(teil, tun, gesehen);
	}
}

/**
 * Welche Komponenten eine Eigenschaft als `data-fokus` weitergeben.
 *
 * `<Rueckfrage marke="entfernen" />` zeichnet zur Laufzeit ein
 * `data-fokus="entfernen"` aus. Für den Zielvergleich zählt das wie ein
 * Attribut am Element, sonst meldete der Wächter dort ein fehlendes Ziel, wo
 * eins steht.
 *
 * **Gefunden statt aufgezählt.** Die Liste entsteht beim Lauf aus dem Baum:
 * Jede Komponentendatei, die `data-fokus={<eigenschaft>}` schreibt, kommt
 * hinein. Eine von Hand gepflegte Namensliste wäre genau die Sorte, die beim
 * nächsten Baustein nicht nachgezogen wird — und der Ausfall wäre ein
 * Fehlalarm, also der teuerste: Er lädt dazu ein, den Wächter zu umgehen.
 */
const zielgeber = new Map();

const befunde = [];
let dateien = 0;
let ziele = 0;
let marken = 0;

for (const pfad of mindestens(
	svelteDateien(`${WURZEL}/src/lib/components`),
	35,
	'Svelte-Bausteine unter src/lib/components/'
)) {
	const baum = svelteBaum(pfad, readFileSync(pfad, 'utf8'));
	if (!baum) continue;
	jedenKnoten(baum.fragment, (el) => {
		for (const a of el.attributes ?? []) {
			if (a.name !== 'data-fokus' || festerWert(el, 'data-fokus') !== null) continue;
			const teile = Array.isArray(a.value) ? a.value : [a.value];
			const eigenschaft = teile[0]?.expression?.name;
			if (teile.length === 1 && eigenschaft) {
				zielgeber.set(basename(pfad, '.svelte'), eigenschaft);
			}
		}
	});
}

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
	dateien++;
	const ort = relative(WURZEL, pfad);
	const zeileVon = (start) => inhalt.slice(0, start ?? 0).split('\n').length;

	/** Welche festen Marken diese Datei als Ziel anbietet. */
	const angeboten = new Set();
	/** Und welche sie sucht — samt Zeile, für die Meldung. */
	const gesucht = [];

	jedenKnoten(baum.fragment, (el) => {
		if (!el.attributes) return;
		if (el.attributes.some((a) => a.name === 'data-marke')) {
			befunde.push(
				`${ort}:${zeileVon(el.start)}\n` +
					`  <${el.name}> trägt «data-marke». Dieses Attribut liest niemand.\n` +
					'  Die Fokusmarke heisst «data-fokus»; danach sucht `absenden()`.'
			);
		}
		/*
		 * **Ein Ziel ist auch, was ein Zielgeber auszeichnet** — siehe oben.
		 * Nicht jedes Prop namens `marke` zählt: `<Meldung marke={form}>` sagt,
		 * woraus eine Meldung stammt, und hat mit dem Fokus nichts zu tun. Am
		 * 28.08.2026 gemessen: ohne diese Unterscheidung meldete der Wächter
		 * 124 Ziele statt 31.
		 */
		const attribut = zielgeber.get(el.name) ?? (el.type === 'RegularElement' ? 'data-fokus' : null);
		if (!attribut) return;
		if (el.attributes.some((a) => a.name === attribut)) {
			ziele++;
			const wert = festerWert(el, attribut);
			// `null` heisst «aus einem Ausdruck gebaut», `''` heisst «ohne Wert».
			// Beides ist ein Ziel, aber keins, das sich vergleichen liesse.
			if (wert) angeboten.add(wert);
		}
		for (const a of el.attributes) {
			if (a.type !== 'UseDirective' || a.name !== 'enhance') continue;
			const marke = markeAusAufruf(a.expression);
			if (marke !== null) gesucht.push([marke, zeileVon(el.start)]);
		}
	});

	/*
	 * Und der Skriptteil, wo `const nachPruefung = absenden({ … })` steht. Ohne
	 * ihn sähe der Wächter genau die vier Aufrufe nicht, die der Block vom
	 * 28.08.2026 neu angelegt hat.
	 */
	jedenAufruf(baum.instance?.content, (aufruf) => {
		const marke = markeAusAufruf(aufruf);
		if (marke !== null) gesucht.push([marke, zeileVon(aufruf.start)]);
	});

	/*
	 * **Erst sammeln, dann vergleichen.** Das Ziel darf im Baum hinter dem
	 * Formular stehen — auf der Einheitenseite tut es das.
	 */
	for (const [marke, zeile] of gesucht) {
		marken++;
		if (angeboten.has(marke)) continue;
		befunde.push(
			`${ort}:${zeile}\n` +
				`  \`absenden({ marke: '${marke}' })\` sucht nach dem Absenden ein Element mit\n` +
				`  data-fokus="${marke}". In dieser Datei gibt es keins, und der Fokus bliebe\n` +
				'  auf <body> stehen. Entweder die Marke berichtigen oder das Ziel auszeichnen.'
		);
	}
}

if (befunde.length > 0) {
	console.error('Fokusmarke: Der Griff nach dem Absenden ginge ins Leere.\n');
	for (const b of befunde) console.error(`  ${b}\n`);
	process.exit(1);
}

/*
 * **Die Sichtprobe**: Im guten Zustand muss der Wächter etwas zu prüfen HABEN.
 * Ohne sie wäre er grün, sobald ein Umbau die Baumsuche ins Leere laufen lässt
 * — und «keine Datei durchgesehen» sähe aus wie «alles in Ordnung».
 *
 * **Drei Zahlen, weil sie an drei verschiedenen Stellen brechen können:** die
 * Ziele am Markupdurchlauf, die Marken am Ausdrucksdurchlauf über den
 * Skriptteil, die Zielgeber an der Vorrunde über `src/lib/components`. Ein
 * erster Entwurf begründete zwei Schranken damit, die Marken kämen «aus dem
 * Quelltext und überlebten einen Bruch der Baumsuche» — das traf nicht zu, sie
 * hingen am selben Durchlauf und wären gemeinsam auf null gefallen.
 *
 * Nur beim Lauf gegen das Repo — ein Wegwerfbaum hat naturgemäss wenige davon,
 * und die Probe soll dort nicht die Gegenprobe verdecken.
 */
if (IM_REPO && (ziele < 28 || marken < 3 || zielgeber.size < 1)) {
	console.error(
		`Fokusmarke: nur ${ziele} ausgezeichnete Ziele, ${marken} feste Marken und\n` +
			`  ${zielgeber.size} Zielgeber in ${dateien} Dateien gesehen. Erwartet werden\n` +
			'  mindestens 28, 3 und 1 (Stand 28.08.2026: 31, 4 und 1).\n' +
			'  Findet die Baumsuche noch alles?'
	);
	process.exit(1);
}

console.log(
	`Fokusmarken in Ordnung: ${ziele} Ziele in ${dateien} Dateien, ` +
		`${marken} feste Marken, jede mit Ziel, ${zielgeber.size} Zielgeber.`
);
