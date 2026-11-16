/**
 * Der Svelte-Baum für die Wächter — Markup und Stil aus einer Hand.
 *
 * **Warum es diesen Baustein gibt** (24.08.2026, auf Frage des Auftraggebers «sind Wächter
 * state of the art oder Flickwerk?»). Zwei Wächter verbinden Markup und CSS —
 * `check-anzeigeart` (eine Hilfsklasse an einem `<td>`) und
 * `check-stilvariablen` (eine `var(--x)` im Attribut). Beide lasen die Datei
 * bisher mit regulären Ausdrücken, und beide hatten dieselben blinden Stellen:
 *
 *   - `<td class="x" title="a > b">` — ein `>` im Attribut beendet `[^>]*` zu
 *     früh, das Element wird mitten durchgeschnitten.
 *   - `class:hell={…}` und `class={…}` — eine Klasse, die erst zur Laufzeit
 *     entsteht, steht in keinem `class="…"`.
 *   - Kommentare mussten vorher von Hand ausgeblendet werden, ein
 *     Ersetzungslauf je Kommentarform.
 *
 * Der Compiler von Svelte liest dieselbe Datei wie der Bündler. Was er sagt,
 * gilt — es gibt keine zweite Auslegung.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';

/**
 * Alle Svelte-Dateien unter einem Verzeichnis, Pfade relativ zur Wurzel.
 *
 * Steht hier und nicht in jedem Wächter, weil derselbe Lauf im Haus schon
 * mehrfach von Hand geschrieben wurde und keine der Fassungen sich um
 * `node_modules` oder `.svelte-kit` kümmert. Wer neu dazukommt, nimmt diese.
 *
 * **Ein Verzeichnis, das es nicht gibt, ist eine leere Liste.** Ohne das
 * stürzte ein Wächter über einem Wegwerfbaum ab, sobald er ein
 * Unterverzeichnis abfragt, das dort niemand angelegt hat — und ein Gegentest,
 * der jeden Abbruch als Befund verbucht, hätte das für ein Fündigwerden
 * gehalten (28.08.2026).
 *
 * @param {string} wurzel @returns {string[]}
 */
export function svelteDateien(wurzel) {
	/** @type {string[]} */
	const gefunden = [];
	if (!existsSync(wurzel)) return gefunden;
	for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
		if (eintrag.name === 'node_modules' || eintrag.name.startsWith('.')) continue;
		const pfad = join(wurzel, eintrag.name);
		if (eintrag.isDirectory()) gefunden.push(...svelteDateien(pfad));
		else if (eintrag.name.endsWith('.svelte')) gefunden.push(pfad);
	}
	return gefunden;
}

/**
 * Liest eine Svelte-Datei und gibt Markup und Stil zurück.
 *
 * `null`, wenn sie sich nicht übersetzen lässt — dann meldet der Bau ohnehin,
 * und ein Wächter, der daneben dieselbe Meldung wiederholt, hilft niemandem.
 */
/** @param {string} pfad @param {string} inhalt @returns {any} */
export function svelteBaum(pfad, inhalt) {
	try {
		return parse(inhalt, { modern: true, filename: pfad });
	} catch {
		return null;
	}
}

/**
 * Jede Form, die Kinder tragen kann: Elemente, Blöcke, Snippets.
 *
 * **`fallback` gehört dazu** (28.08.2026 nachgemessen): Das ist der
 * `{:else}`-Zweig eines `{#each}`, und er fehlte hier. Vier Wächter bauen auf
 * dieser Suche auf; für sie alle war der Leerfall einer Liste unsichtbar —
 * ausgerechnet der Zweig, der die Bedienelemente für «keine Treffer» trägt.
 *
 * **Und sie steht exportiert hier, statt in jedem Wächter noch einmal**
 * (01.09.2026, aus dem Code-Review): `check-seitenaufbau` führte eine eigene
 * Kopie ohne `body` — den Schlüssel, unter dem ein `{#each}` seinen Rumpf
 * trägt. Jeder Abschnitt in einer Schleife war für ihn unsichtbar. Zwei Listen
 * derselben Sache laufen auseinander, und die zweite merkt es zuletzt.
 */
export const KINDERSCHLUESSEL = [
	'fragment',
	'consequent',
	'alternate',
	'body',
	'fallback',
	'pending',
	'then',
	'catch'
];

/**
 * Läuft über **alle** Knoten des Markups — Elemente, Komponenten, Text, Blöcke.
 *
 * Wer nur Elemente will, nimmt `jedesElement`. Diese Fassung gibt es für
 * Regeln, die auch an einer Komponente hängen können: `<Rueckfrage marke="…" />`
 * zeichnet zur Laufzeit ein `data-fokus` aus, und eine Regel, die Komponenten
 * überspringt, hält das für ein fehlendes Ziel.
 *
 * @param {any} fragment @param {(knoten: any) => void} tun
 */
export function jedenKnoten(fragment, tun) {
	for (const knoten of fragment?.nodes ?? []) {
		tun(knoten);
		for (const schluessel of KINDERSCHLUESSEL) {
			const teil = knoten[schluessel];
			if (teil?.nodes) jedenKnoten(teil, tun);
		}
	}
}

/** Läuft über die Elemente des Markups — ohne Komponenten und Text. */
/** @param {any} fragment @param {(knoten: any) => void} tun */
export function jedesElement(fragment, tun) {
	jedenKnoten(fragment, (knoten) => {
		if (knoten.type === 'RegularElement' || knoten.type === 'SvelteElement') tun(knoten);
	});
}

/** Der feste Textwert eines Attributs — null, wenn er aus einem Ausdruck kommt. */
/** @param {any} element @param {string} name @returns {string | null} */
export function festerWert(element, name) {
	const a = element.attributes.find(
		(/** @type {any} */ x) => x.type === 'Attribute' && x.name === name
	);
	if (!a) return null;
	if (a.value === true) return '';
	const teile = Array.isArray(a.value) ? a.value : [a.value];
	if (teile.some((/** @type {any} */ t) => t.type !== 'Text')) return null;
	return teile.map((/** @type {any} */ t) => t.data).join('');
}

/** Alle festen Attributwerte eines Elements — für Regeln, die im Wert suchen. */
/** @param {any} element @returns {string[]} */
export function festeAttributwerte(element) {
	const raus = [];
	for (const a of element.attributes ?? []) {
		if (a.type !== 'Attribute' || a.value === true) continue;
		const teile = Array.isArray(a.value) ? a.value : [a.value];
		for (const teil of teile) if (teil.type === 'Text') raus.push(teil.data);
	}
	return raus;
}
