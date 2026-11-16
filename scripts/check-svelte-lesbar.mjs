/**
 * Ist jede Svelte-Datei fuer den Parser lesbar?
 *
 * **Der Anlass** (02.09.2026): Ein Umbau an `betreiber/dienste` liess ein
 * `</div>` zu viel stehen. Der Seitenaufbau-Waechter meldete daraufhin
 * unveraendert «3 von 61 Seiten folgen dem Modell» — die kaputte Datei war aus
 * seiner Zaehlung verschwunden, nicht in seiner Meldung. Aufgefallen ist es nur,
 * weil die erwartete Zahl nicht stieg.
 *
 * **Die Klasse betrifft sechs Waechter.** `svelteBaum()` gibt bei einem
 * Parserfehler `null` zurueck, und alle sechs behandeln das mit
 * `if (!baum) continue`. Das ist je einzeln richtig — ein Waechter soll nicht an
 * einer Datei scheitern, die er nicht versteht —, aber zusammengenommen heisst
 * es: Eine unlesbare Datei entzieht sich JEDER dieser Pruefungen, und alle sechs
 * melden weiter «in Ordnung».
 *
 * Statt sechs Meldungen einzubauen prueft dieser Schritt die Lesbarkeit **einmal**
 * und laeuft als erster in `npm run pruefen`. Ist er gruen, hat kein spaeterer
 * Waechter einen stillen blinden Fleck.
 *
 * **Er ersetzt `svelte-check` nicht.** Der findet denselben Fehler auch, laeuft
 * aber am Ende der Kette — und bis dahin haetten die Waechter davor schon falsche
 * Zahlen ausgegeben.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { svelteBaum, svelteDateien } from './svelte-baum.mjs';

const WURZEL = process.argv[2] ?? process.cwd();
const dateien = svelteDateien(join(WURZEL, 'src'));

if (dateien.length < 50) {
	console.error(
		`Svelte-Lesbarkeit: nur ${dateien.length} Dateien gefunden — der Lauf greift nicht.`
	);
	process.exit(1);
}

const unlesbar = dateien.filter((p) => !svelteBaum(p, readFileSync(p, 'utf8')));

if (unlesbar.length > 0) {
	console.error(
		`Svelte-Lesbarkeit: ${unlesbar.length} von ${dateien.length} Dateien kann der Parser nicht lesen.\n` +
			'Jeder Waechter, der auf dem Baum arbeitet, uebergeht sie stillschweigend und meldet\n' +
			'trotzdem «in Ordnung». Was `svelte-check` dazu sagt, steht weiter unten im Lauf.\n'
	);
	for (const p of unlesbar) console.error(`  · ${relative(WURZEL, p)}`);
	process.exit(1);
}

console.log(`Svelte-Lesbarkeit: alle ${dateien.length} Dateien lesbar.`);
