/**
 * Vorgabeknopf-Wächter: Enter darf keine Handlung erraten.
 *
 * **Der Anlass, am 28.08.2026.** In der Stimmerfassung stand das Feld
 * «Warum Sie erfassen» vor den Knöpfen «Ja erfassen», «Nein erfassen» und
 * «Enthaltung». Der Vorgabeknopf eines Formulars ist sein **erster**
 * Absendeknopf in Baumreihenfolge, und Enter in irgendeinem Feld löst genau den
 * aus. Mit demselben Aufbau in Chromium gemessen: `wahl = yes`. Ein Tastendruck
 * erfasste also eine Ja-Stimme für die gewählte Partei, ohne dass jemand Ja,
 * Nein oder Enthaltung gedrückt hätte. Dasselbe gilt für das Suchfeld der
 * Parteiwahl, das aus `Wahlliste` kommt.
 *
 * **Die Regel.** Ein Formular mit mehr als einem eigenen Absendeknopf muss am
 * **ersten** davon ein `data-vorgabe` tragen. Der Wert sagt, was Enter tut:
 *
 *   * `data-vorgabe="angenommen"` an einem echten Knopf: Enter löst ihn aus,
 *     und das ist so gewollt.
 *   * `data-vorgabe="keiner"` an einem **gesperrten** Knopf: Enter tut nichts.
 *     Im Browser gemessen: Ein gesperrter Vorgabeknopf hält die implizite
 *     Absendung vollständig auf, ohne JavaScript und ohne Serverumlauf. Bei
 *     diesem Wert verlangt der Wächter deshalb `disabled`; ohne den Riegel wäre
 *     die Angabe eine Behauptung, die nichts trägt.
 *
 * Die Reihenfolge der Knöpfe im Baum fällt beim Lesen nicht auf: Wer einen
 * Knopf dazustellt, verschiebt den Vorgabeknopf, und nichts sagt es ihm. Der
 * Wächter verlangt deshalb, dass der erste ausdrücklich benannt ist.
 *
 * **Was er NICHT tut:** Knöpfe zählen oder eine Reihenfolge vorschreiben. Er
 * verlangt nur, dass die Wahl an der Stelle steht, an der sie wirkt.
 *
 * **Was er nicht sehen kann**, alles am Syntaxbaum nachgezählt, alles heute
 * ohne Fundstelle, aber der Reihe nach zu schliessen:
 *
 *   1. Absendeknöpfe aus einer **Kindkomponente** oder aus einem `{@render}`
 *      desselben Dokuments. Ein Fall besteht: `?/erfassen` in
 *      `Stimmerfassung.svelte` bekommt seinen einzigen Knopf aus einem Snippet.
 *   2. Knöpfe, die über `form="<id>"` von **aussen** zu einem Formular gehören.
 *      Sie werden aus dem umgebenden Formular herausgerechnet, aber ihrem
 *      eigenen nicht zugeschlagen. Acht solche Knöpfe stehen im Baum.
 *   3. Die **Laufzeit**: Knöpfe aus `{#if}` und `{:else}` zählen hier als
 *      Geschwister, obwohl sie einander ausschliessen, und ein `{#each}` mit
 *      n Knöpfen zählt als einer.
 */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { jedesElement, svelteBaum, svelteDateien, festerWert } from './svelte-baum.mjs';
import { mindestens } from './lib/pruefmenge.mjs';

/**
 * Die Wurzel als Argument, damit sich der Wächter gegen einen Wegwerfbaum
 * fahren lässt. Ohne Gegenprobe wäre nicht belegt, dass er im schlechten
 * Zustand überhaupt rot wird (`tests/waechter/vorgabeknopf.test.ts`).
 */
const WURZEL = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const IM_REPO = !process.argv[2];

/** Ein Element, das der Browser als Absendeknopf behandelt. */
function istAbsendeknopf(k) {
	if (k.name === 'input') return ['submit', 'image'].includes(festerWert(k, 'type') ?? '');
	if (k.name !== 'button') return false;
	// **Ein `<button>` ohne `type` ist ein Absendeknopf.** Die Vorgabe in HTML
	// ist `submit`; wer sie voraussetzt, sieht den halben Bestand nicht.
	const art = festerWert(k, 'type');
	return art === null || art.toLowerCase() === 'submit';
}

/** Alle Absendeknöpfe, die diesem Formular gehören. */
function eigeneAbsendeknoepfe(form) {
	const knoepfe = [];
	jedesElement(form.fragment, (k) => {
		if (!istAbsendeknopf(k)) return;
		/*
		 * **Ein Knopf mit `form=` gehört einem anderen Formular**, auch wenn er im
		 * Baum darin steht. Genau so ist die Einheitentabelle am 27.08.2026
		 * behoben worden; ohne diese Zeile beanstandete der Wächter sie weiterhin.
		 */
		if (k.attributes?.some((a) => a.name === 'form')) return;
		knoepfe.push(k);
	});
	return knoepfe;
}

/** Was der Knopf schickt, für die Meldung. `{…}` steht für einen Ausdruck. */
function wasErSchickt(knopf) {
	const teil = (name) => festerWert(knopf, name) ?? (knopf.attributes?.some((a) => a.name === name) ? '{…}' : '');
	return `${teil('name')}=${teil('value')}`;
}

const befunde = [];
let formulare = 0;
let mehrdeutig = 0;

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
	jedesElement(baum.fragment, (form) => {
		if (form.name !== 'form') return;
		formulare++;
		const knoepfe = eigeneAbsendeknoepfe(form);
		if (knoepfe.length < 2) return;
		mehrdeutig++;
		const erster = knoepfe[0];
		const angabe = festerWert(erster, 'data-vorgabe');
		const zeile = inhalt.slice(0, form.start ?? 0).split('\n').length;
		const ort = `${relative(WURZEL, pfad)}:${zeile}`;
		const wohin = festerWert(form, 'action') ?? '{…}';

		if (angabe === null || angabe === '') {
			befunde.push(
				`${ort}\n` +
					`  Formular «${wohin}» hat ${knoepfe.length} eigene Absendeknöpfe, und der erste\n` +
					`  ist nicht benannt. Enter in irgendeinem Feld löst ihn aus: «${wasErSchickt(erster)}».\n` +
					'  Abhilfe: data-vorgabe="<was Enter tut>" an den ersten Knopf, oder davor\n' +
					'  <button type="submit" disabled hidden data-vorgabe="keiner">Kein Vorgabeknopf</button>.'
			);
			return;
		}
		/*
		 * **«keiner» ist eine Zusicherung, kein Etikett.** Sie trägt allein durch
		 * das `disabled`; ohne es bleibt der Knopf der Vorgabeknopf und schickt
		 * beim ersten Enter ein Formular ohne Wahl ab.
		 */
		// `festerWert` und nicht bloss der Attributname: Ein `disabled={ausdruck}`
		// sagt nichts darüber, ob der Knopf zur Laufzeit wirklich gesperrt ist.
		if (angabe === 'keiner' && festerWert(erster, 'disabled') !== '') {
			befunde.push(
				`${ort}\n` +
					`  Formular «${wohin}»: Der erste Absendeknopf sagt «keiner», ist aber nicht\n` +
					'  gesperrt. Nur `disabled` hält die implizite Absendung auf; so schickt Enter\n' +
					`  weiterhin ab: «${wasErSchickt(erster)}».`
			);
		}
	});
}

if (befunde.length > 0) {
	console.error(
		'Vorgabeknopf: Enter würde eine Handlung erraten.\n' +
			'  Der erste Absendeknopf eines Formulars ist sein Vorgabeknopf.\n'
	);
	for (const b of befunde) console.error(`  ${b}\n`);
	process.exit(1);
}

/*
 * **Die Sichtprobe**: Im guten Zustand muss der Wächter etwas zu prüfen HABEN.
 * Ohne sie wäre er grün, sobald ein Umbau die Baumsuche ins Leere laufen lässt.
 *
 * Die Schranke liegt dicht unter dem Ist (255 Formulare, 7 mehrdeutige am
 * 28.08.2026): Gemessen fielen beim Wegfall eines einzigen Traversierungs-
 * schlüssels 82 Formulare und 2 der 7 bewachten weg, und eine Schranke von 100
 * und 2 hätte das nicht bemerkt.
 *
 * Nur beim Lauf gegen das Repo. Ein Wegwerfbaum hat naturgemäss wenige
 * Formulare, und die Probe soll dort nicht die Gegenprobe verdecken.
 */
if (IM_REPO && (formulare < 240 || mehrdeutig < 6)) {
	console.error(
		`Vorgabeknopf: nur ${formulare} Formulare gesehen, davon ${mehrdeutig} mit mehreren\n` +
			'  Absendeknöpfen. Erwartet werden mindestens 240 und 6 (Stand 28.08.2026: 255 und 7).\n' +
			'  Findet die Baumsuche noch alles?'
	);
	process.exit(1);
}

console.log(
	`Vorgabeknopf in Ordnung: ${formulare} Formulare durchgesehen, ` +
		`${mehrdeutig} davon mit mehreren Absendeknöpfen, alle benannt.`
);
