/**
 * Seitenaufbau-Waechter: Wie viele Seiten folgen dem Modell?
 *
 * **Der Plan** (`docs/plan-seitenaufbau-2026-08-27.md`, Task 3): Jede Seite ist
 * ein Stapel benannter Abschnitte in fester Reihenfolge, statt eines eigenen
 * Rasters. Ohne einen Waechter zerfaellt das wieder, sobald jemand unter
 * Zeitdruck ein `<div>` setzt.
 *
 * **Er zaehlt, er sperrt nicht — noch nicht.** Am 01.09.2026 folgt genau EINE
 * von 61 Seiten dem Modell (die Musterseite aus Task 1). Ein Waechter, der das
 * heute beanstandete, waere am ersten Tag rot, und dann schaltet ihn jemand ab.
 * Der Plan sagt das ausdruecklich. Was er stattdessen liefert, ist das Mass fuer
 * den Fortschritt: eine Zahl bei jedem Prueflauf.
 *
 * **Scharf geschaltet wird ueber `SEITENAUFBAU_MINDESTENS`.** Steht dort eine
 * Zahl und liegt der Bestand darunter, bricht der Lauf ab. So laesst sich die
 * Schwelle mitwachsen lassen, ohne den Waechter umzuschreiben — und ein
 * Rueckschritt faellt auf, sobald die Zahl einmal gesetzt ist.
 *
 * **Was als «folgt dem Modell» zaehlt.** Die Seite traegt auf oberster Ebene
 * einen `.seitenstapel`, und **direkt darin** stehen `.abschnitt`-Elemente.
 *
 * **Die Verschachtelung ist nicht schmueckendes Beiwerk** (01.09.2026, aus dem
 * Review): `.abschnitt` ist im Repo eine aeltere, unabhaengige Klasse — als
 * `<h2 class="abschnitt">` und `<div class="felder abschnitt">` steht sie auf
 * Seiten, die mit dem Modell nichts zu tun haben. `src/app.css` scopet deshalb
 * seit dem 27.08.2026 ausdruecklich auf `.seitenstapel > .abschnitt`. Ein
 * Waechter, der beide Klassen bloss irgendwo in der Datei zaehlt, haelt eine
 * dieser Altseiten fuer umgestellt, sobald sie irgendwo einen Stapel bekommt —
 * nachgestellt und bestaetigt. Beides sind
 * blosse Klassen, keine Bausteine: Task 2 fragte, ob es vier Bausteine braucht
 * oder einen — gemessen braucht es keinen, weil sich die vier Abschnittsarten
 * in nichts unterscheiden, was der Code sieht. Der Unterschied ist die
 * Reihenfolge und der Inhalt.
 *
 * **Die zweispaltige Flaeche wird mitgezaehlt**, weil sie die Ursache ist:
 * `.arbeitsflaeche` stellt Bestand und Formulare nebeneinander, und wo die
 * beiden ungleich lang sind, entsteht das Loch, um das es geht. Die Zahl sagt,
 * wie viele davon noch stehen.
 *
 * **Sie wird unabhaengig gezaehlt**, nicht als Gegenteil von «folgt dem Modell».
 * Waehrend der Umstellung traegt eine Seite beides: den neuen Stapel und die
 * alte Flaeche, die noch niemand herausgenommen hat. Stuenden die zwei Zahlen
 * in einem `else`, fiele die Flaechenzahl in genau diesem Moment — sie saehe
 * aus wie Fortschritt, obwohl nichts entfernt wurde.
 *
 * **Eine Seite darf begruendet dabeibleiben.** Der Plan laesst das ausdruecklich
 * offen: «Ob alle 61 Seiten umgestellt werden. Vermutlich nicht.» Wo das
 * Nebeneinander die Sache traegt statt nur den Platz, steht in der Datei
 * `<!-- seitenaufbau-ausnahme: <Grund> -->`, und der Waechter zaehlt sie
 * getrennt. Wie bei `check-themenfarben`: Ein Waechter, den man nur abschalten
 * kann, wird abgeschaltet; einer, der einen Satz verlangt, wird bedacht.
 *
 * Laeuft in `npm run pruefen`.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { svelteBaum, svelteDateien, jedesElement, KINDERSCHLUESSEL } from './svelte-baum.mjs';

const WURZEL = process.argv[2] ?? process.cwd();
/*
 * **Eine unbrauchbare Schwelle bricht ab, statt zu schweigen** (01.09.2026, aus
 * dem Review). `Number('zwoelf')` ist `NaN`, und ein `Number.isFinite`-Riegel
 * haette den Waechter dann kommentarlos entschaerft: Wer ihn scharf schalten
 * wollte, haette einen gruenen Lauf bekommen und geglaubt, er sei scharf.
 */
const SCHWELLE = schwelleLesen();

/** Ab wann ein Grund ein Satz ist und kein Alibi. */
const MINDESTLAENGE = 10;

function schwelleLesen() {
	const roh = (process.env.SEITENAUFBAU_MINDESTENS ?? '').trim();
	if (roh === '') return 0;
	const zahl = Number(roh);
	if (!Number.isInteger(zahl) || zahl < 1) {
		console.error(
			`Seitenaufbau: SEITENAUFBAU_MINDESTENS ist «${roh}» und damit keine ganze Zahl ab 1. ` +
				'Der Waechter wuerde stumm nichts pruefen — entweder eine Zahl setzen oder die Variable weglassen.'
		);
		process.exit(1);
	}
	return zahl;
}

/**
 * Die Elemente, die im DOM **direkte Kinder** des Fragments sind.
 *
 * Durch `{#if}`, `{#each}` und ihre Zweige wird hindurchgesehen, weil sie im
 * DOM nichts erzeugen: Ein `.abschnitt` in einem `{#if}` unter dem Stapel ist
 * dort ein Kind. Bei einem Element wird abgebrochen — dessen Kinder sind Enkel.
 *
 * **Die Schlüsselliste kommt aus dem gemeinsamen Helfer** (01.09.2026, aus dem
 * Code-Review). Hier stand eine eigene, und ihr fehlte `body`: der Schlüssel,
 * unter dem ein `{#each}` seinen Rumpf führt. Eine Seite, die ihre Abschnitte
 * aus einer Schleife zeichnet, galt damit als nicht umgestellt — und sobald die
 * Schwelle gesetzt ist, hätte der Lauf ihr einen Rückschritt vorgeworfen.
 *
 * @param {any} fragment @returns {any[]}
 */
function kindElemente(fragment) {
	const raus = [];
	const holen = (/** @type {any} */ f) => {
		for (const knoten of f?.nodes ?? []) {
			if (knoten.type === 'RegularElement' || knoten.type === 'SvelteElement') {
				raus.push(knoten);
				continue;
			}
			for (const schluessel of KINDERSCHLUESSEL) holen(knoten[schluessel]);
		}
	};
	holen(fragment);
	return raus;
}

/**
 * Die festen Klassen eines Elements — **nur aus `class`**.
 *
 * `festeAttributwerte()` liest jedes Attribut, und damit haette ein
 * `href="/abschnitt"` oder ein `title="Abschnitt …"` mitgezaehlt (01.09.2026,
 * aus dem Review). Gemischte Werte wie `class="abschnitt {klasse}"` steuern
 * ihren festen Anteil bei, statt ganz auszufallen.
 *
 * @param {any} element @returns {string[]}
 */
function klassen(element) {
	for (const a of element.attributes ?? []) {
		if (a.type !== 'Attribute' || a.name !== 'class' || a.value === true) continue;
		const teile = Array.isArray(a.value) ? a.value : [a.value];
		return teile
			.filter((/** @type {any} */ t) => t.type === 'Text')
			.flatMap((/** @type {any} */ t) => t.data.split(/\s+/))
			.filter(Boolean);
	}
	return [];
}

/** Nur Seiten, nicht Bausteine: Das Modell ordnet die Seite, nicht ihren Inhalt. */
const seiten = svelteDateien(join(WURZEL, 'src', 'routes')).filter((p) =>
	p.endsWith('+page.svelte')
);

const folgen = [];
const zweispaltig = [];
const ausnahmen = [];
const verwaisteMarken = [];
const markenOhneSatz = [];
const uebrige = [];

for (const pfad of seiten) {
	const kurz = relative(WURZEL, pfad);
	const inhalt = readFileSync(pfad, 'utf8');
	const baum = svelteBaum(pfad, inhalt);
	if (!baum) continue;

	const stapel = kindElemente(baum.fragment).filter((e) => klassen(e).includes('seitenstapel'));
	let abschnitte = 0;
	for (const s of stapel) {
		abschnitte += kindElemente(s.fragment).filter((e) => klassen(e).includes('abschnitt')).length;
	}

	/* Die Flaeche zaehlt ueberall in der Datei: Sie ist die Ursache, egal wo sie steht. */
	let hatFlaeche = false;
	jedesElement(baum.fragment, (element) => {
		if (klassen(element).includes('arbeitsflaeche')) hatFlaeche = true;
	});

	/*
	 * **Der Grund gehoert zur Marke.** Gelesen wird der Rohtext und nicht der
	 * Baum: Ein Kommentar ausserhalb des Markups (im `<script>`, im `<style>`)
	 * zaehlt genauso, und der Parser gibt Kommentare je nach Stelle nicht heraus.
	 *
	 * **Der Kommentarabschluss ist kein Grund** (02.09.2026, vom eigenen
	 * Gegentest gefunden). Der erste Anlauf pruefte mit `\S` auf «irgendetwas nach
	 * dem Doppelpunkt» — und bei `<!-- seitenaufbau-ausnahme: -->` war dieses
	 * Etwas das `-->`. Die leere Marke haette also gezaehlt, und der Waechter
	 * haette genau den Schalter gehabt, gegen den er gebaut ist. Abgeschnitten
	 * wird deshalb VOR der Pruefung, nicht erst vor der Anzeige.
	 *
	 * Die Mindestlaenge trennt den Satz vom Alibi. Sie ist mit Absicht niedrig:
	 * Wer sie umgehen will, kann es — der Waechter soll den Fluechtigen bremsen,
	 * nicht den Entschlossenen aussperren.
	 *
	 * **Der Grund darf umbrechen** (02.09.2026, aus der zweiten Runde des
	 * Code-Reviews). Gelesen wurde bis zum Zeilenende, und die Eigentuemerseite
	 * schrieb ihren Grund schon damals ueber zwei Zeilen: «… gebraucht, nicht»
	 * — der zweite Halbsatz fiel weg. Solange die Marke bloss gezaehlt wurde,
	 * war das eine verstuemmelte Anzeige; seit sie rot machen kann, waere ein
	 * Umbruch direkt nach dem Doppelpunkt ein Abbruch gewesen. Gelesen wird
	 * deshalb bis zum Kommentarende, bis zur Leerzeile oder bis 400 Zeichen —
	 * was zuerst kommt.
	 */
	const rohmarke = /seitenaufbau-ausnahme:([\s\S]{0,400}?)(?:--!?>|\n[ \t]*\n|$)/.exec(inhalt);
	const grund = (rohmarke?.[1] ?? '').replace(/\s+/g, ' ').trim();
	const ausnahmemarke = grund.length >= MINDESTLAENGE ? grund : null;

	const folgtModell = stapel.length > 0 && abschnitte > 0;
	if (folgtModell) folgen.push(`${kurz} (${abschnitte} Abschnitte)`);
	/*
	 * **Eine Marke, die nicht zaehlt, wird gemeldet** (02.09.2026, aus dem
	 * Code-Review zum Umbau). Steht die Marke da und ist der Grund zu kurz,
	 * fiele die Seite sonst still in den Rueckstand: Die Zahl «begruendet dabei»
	 * saenke um eins, und niemand liest eine Zahl, die um eins faellt. Der
	 * Waechter behauptet in `docs/bauweise.md` und `docs/gestaltung.md`, einen Satz zu
	 * verlangen — dann muss er es auch sagen, wenn keiner dasteht.
	 */
	if (rohmarke && !ausnahmemarke) markenOhneSatz.push(`${kurz} — «${grund.slice(0, 60)}»`);

	if (hatFlaeche && ausnahmemarke) {
		ausnahmen.push(`${kurz} — ${ausnahmemarke.slice(0, 90)}`);
	} else if (hatFlaeche) {
		zweispaltig.push(folgtModell ? `${kurz} (umgestellt, Flaeche steht noch)` : kurz);
	} else if (ausnahmemarke) {
		verwaisteMarken.push(kurz);
	}
	if (!folgtModell && !hatFlaeche) uebrige.push(kurz);
}

/*
 * **Die Sichtprobe** (Erfahrung aus den uebrigen Waechtern dieses Repos): Ein
 * Lauf, der versehentlich null Dateien sieht, meldet dauerhaft «null von null»
 * und sieht aus wie Ordnung. Geprueft wird deshalb, dass ueberhaupt Seiten
 * gefunden wurden — und dass die Musterseite darunter ist, denn sie folgt dem
 * Modell seit dem 27.08.2026.
 */
if (seiten.length < 40) {
	console.error(`Seitenaufbau: nur ${seiten.length} Seiten gefunden — der Lauf greift nicht.`);
	process.exit(1);
}
if (folgen.length === 0) {
	console.error(
		'Seitenaufbau: keine einzige Seite folgt dem Modell. Die Musterseite ' +
			'(gemeinschaften/[id=kennung]/einheiten) tut es seit dem 27.08.2026 — ' +
			'entweder wurde sie umgebaut, oder dieser Waechter sieht die Klassen nicht mehr.'
	);
	process.exit(1);
}

/*
 * **Eine Marke ohne Flaeche ist gegenstandslos.**
 *
 * Hier stand bis zum 02.09.2026 eine Sichtprobe, die abbrach, sobald der Lauf
 * keine einzige Ausnahmemarke mehr fand — mit der Begruendung, dann lese der
 * Waechter die Marke wohl nicht mehr. Nachgemessen war sie falsch herum
 * gebaut: Gezaehlt wird eine Ausnahme nur zusammen mit ihrer `.arbeitsflaeche`,
 * und die verschwindet genau dann, wenn die letzte Seite umgestellt ist. Der
 * Waechter waere im **Erfolgsfall** rot geworden und haette den
 * Pre-Commit-Hook gesperrt (gemessen an einer Kopie des Bestands, in der die
 * Eigentuemerseite umgestellt wurde: Rueckgabewert 1).
 *
 * Was die Probe messen wollte, misst `tests/waechter/seitenaufbau.test.ts` seit
 * dem 01.09.2026 an einem eigenen Baum, in dem eine Marke garantiert steht —
 * unabhaengig davon, wie weit die Umstellung im Repo ist. Der Test dort sagte
 * es sogar: «Sie gehoert in jeden Baum … ohne sie waere jeder Lauf rot.»
 *
 * An ihre Stelle tritt der Widerspruch, den es wirklich gibt: eine Seite, die
 * einen Grund fuer das Nebeneinander nennt und keines mehr hat. Der Grund ist
 * dann eine Behauptung ueber einen Zustand von gestern, und der naechste Leser
 * glaubt ihr. Behoben wird das durch eine geloeschte Zeile.
 */
const anteil = Math.round((folgen.length / seiten.length) * 100);
console.log(
	`Seitenaufbau: ${folgen.length} von ${seiten.length} Seiten folgen dem Modell (${anteil} %), ` +
		`${zweispaltig.length} tragen noch die zweispaltige Flaeche, ` +
		`${ausnahmen.length} bleiben begruendet dabei.`
);
for (const s of folgen) console.log(`  · ${s}`);
if (zweispaltig.length > 0) {
	console.log('  noch zweispaltig:');
	for (const s of zweispaltig) console.log(`  · ${s}`);
}
if (ausnahmen.length > 0) {
	console.log('  begruendete Ausnahmen:');
	for (const s of ausnahmen) console.log(`  · ${s}`);
}

/*
 * **Die Befunde stehen NACH der Zusammenfassung** (02.09.2026, aus dem
 * Code-Review). Ein `process.exit(1)` davor nimmt dem Leser die
 * Fortschrittszahl, und wer gleichzeitig unter die Schwelle gerutscht ist,
 * erfaehrt das erst beim naechsten Lauf. Gemeldet wird alles, abgebrochen wird
 * einmal am Ende.
 */
let rot = false;

if (markenOhneSatz.length > 0) {
	rot = true;
	console.error('\nSeitenaufbau: Ausnahmemarke ohne Grund\n');
	for (const s of markenOhneSatz) {
		console.error(
			`${s}\n` +
				`  Nach «seitenaufbau-ausnahme:» gehoert ein Satz von mindestens ${MINDESTLAENGE}\n` +
				'  Zeichen, der sagt, warum das Nebeneinander hier die Sache traegt. Er darf\n' +
				'  umbrechen und endet am Kommentarende oder an der naechsten Leerzeile.'
		);
	}
}

if (verwaisteMarken.length > 0) {
	rot = true;
	console.error('\nSeitenaufbau: Ausnahmemarke ohne zweispaltige Flaeche\n');
	for (const s of verwaisteMarken) {
		console.error(
			`${s}\n` +
				'  Die Seite nennt einen Grund, beim Nebeneinander zu bleiben, hat aber keine\n' +
				'  `.arbeitsflaeche`. Die Marke entschuldigt damit nichts: Sie gehoert neben\n' +
				'  eine stehende Flaeche oder geloescht.'
		);
	}
}

if (SCHWELLE > 0 && folgen.length < SCHWELLE) {
	rot = true;
	console.error(
		`\nSeitenaufbau: ${folgen.length} Seiten folgen dem Modell, verlangt sind ${SCHWELLE} ` +
			'(SEITENAUFBAU_MINDESTENS). Eine Seite ist aus dem Modell gefallen.'
	);
}

if (rot) process.exit(1);
