import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Fokusmarken-Wächter (`scripts/check-fokusmarke.mjs`).
 *
 * **Warum er sein muss.** Der Wächter liest einen Syntaxbaum. Greift eine
 * Abfrage daneben, findet er nichts und ist damit **immer grün**, und zwar
 * lautlos. Hier kommt eine zweite Falle dazu: Was er bewacht — ein Fokus, der
 * nach dem Absenden am richtigen Ort steht — ist an der Fachwirkung gar nicht
 * zu sehen. Ein stiller Wächter fiele deshalb auch beim Ausprobieren von Hand
 * nicht auf.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-fokusmarke.mjs');

/**
 * **Ein Absturz ist kein Befund.** Der Rückgabewert 1 kommt auch von einer
 * geworfenen Ausnahme, und ein Fall, der nur `rot === true` prüft, hielte einen
 * abgestürzten Wächter für einen findenden. Genau das lag am 28.08.2026 an:
 * Über einem Wegwerfbaum ohne `src/lib/components` warf `readdirSync`, und drei
 * Fälle wären grün geblieben.
 *
 * **Getrennt wurde damals über `status !== 1`, und das trennt nichts** — genau
 * die geworfene Ausnahme, um die es geht, endet in Node mit `1`. Der Satz stand
 * hier trotzdem als Begründung. Die Trennung liegt seit dem 05.09.2026 in
 * `waechterlauf.ts` und geht über Stapelspur, Signal und Rückgabewert; sie
 * wirft, statt einen Wert zu liefern, den eine Prüfung übersehen könnte.
 */
function fahre(wurzel: string) {
	return fahreWaechter(SKRIPT, wurzel);
}

/**
 * Jeder Befund muss ein Befund sein, kein Absturz, und er muss etwas sagen.
 *
 * **Die Absturzprüfung liegt jetzt in `waechterlauf.ts`** (05.09.2026): Sie
 * ging hier über `f.status !== 1`, und genau die geworfene Ausnahme, um die es
 * geht, endet in Node mit `1`. Der Kommentar darüber behauptete eine Trennung,
 * die es nicht gab; gerettet haben allein die Textproben. Nachgemessen mit
 * einem absichtlich abstürzenden Wächter: 13 von 14 Prüfungen fielen, eine
 * blieb grün.
 */
function findet(ergebnis: ReturnType<typeof fahre>, worin: string) {
	expect(ergebnis.rot).toBe(true);
	expect(ergebnis.ausgabe).toContain(worin);
}

const verzeichnisse: string[] = [];

/**
 * Ein Wegwerfbaum — mit einer `Rueckfrage`, die wie die echte ihre Eigenschaft
 * als `data-fokus` weitergibt. Ohne sie fände der Wächter keinen Zielgeber, und
 * die Fälle, die genau das prüfen, prüften nichts.
 */
function baumMit(inhalt: string): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'fokusmarke-'));
	verzeichnisse.push(wurzel);
	mkdirSync(join(wurzel, 'src', 'routes'), { recursive: true });
	mkdirSync(join(wurzel, 'src', 'lib', 'components'), { recursive: true });
	writeFileSync(join(wurzel, 'src', 'routes', '+page.svelte'), inhalt, 'utf8');
	writeFileSync(
		join(wurzel, 'src', 'lib', 'components', 'Rueckfrage.svelte'),
		'<button type="submit" data-fokus={marke}>{beschriftung}</button>',
		'utf8'
	);
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('findet den schlechten Fall', () => {
	it('ein `data-marke` hat keinen Leser mehr', () => {
		findet(
			fahre(
				baumMit(`<form method="POST" action="?/x" use:enhance={absenden()}>
	<button type="submit" data-marke="weg:17">Entfernen</button>
</form>`)
			),
			'data-marke'
		);
	});

	it('auch aus einem Ausdruck gebaut', () => {
		// Genau so stand es bis zum 28.08.2026 in `Rueckfrage.svelte`.
		findet(fahre(baumMit(`<button type="submit" data-marke={marke}>Ablehnen</button>`)), 'data-marke');
	});

	it('eine Marke aus dem Skriptteil, nicht am Formular', () => {
		/*
		 * Genau diese Schreibweise hat der Block vom 28.08.2026 eingeführt, und
		 * der erste Wächterentwurf sah sie nicht: Er las nur den Ausdruck in
		 * `use:enhance={…}`. Er hätte den Fehler, gegen den er antritt, in der
		 * eigenen Neuerung übersehen.
		 */
		findet(
			fahre(
				baumMit(`<script>
	const nachPruefung = absenden({ marke: 'gescannt' });
</script>
<form method="POST" action="?/pruefen" use:enhance={nachPruefung}>
	<button type="submit" data-fokus="etwasAnderes">Nachschlagen</button>
</form>`)
			),
			"marke: 'gescannt'"
		);
	});

	it('eine Marke in doppelten Anführungszeichen', () => {
		// Der zweite Entwurf las den Ausdruck mit einer Regex, die nur einfache
		// Anführungszeichen kannte. Im Repo erzwingt nichts die Schreibweise.
		findet(
			fahre(
				baumMit(`<form method="POST" action="?/x" use:enhance={absenden({ marke: "speichern" })}>
	<button type="submit">Speichern</button>
</form>`)
			),
			'marke:'
		);
	});

	it('ein `data-marke` im Leerzweig einer Liste', () => {
		/*
		 * `{:else}` eines `{#each}` steht im Baum unter `fallback`, und der
		 * Schlüssel fehlte in `scripts/svelte-baum.mjs` — für vier Wächter war
		 * ausgerechnet der Zweig unsichtbar, der die Bedienelemente für «keine
		 * Treffer» trägt.
		 */
		findet(
			fahre(
				baumMit(`{#each zeilen as z}
	<p>{z}</p>
{:else}
	<button type="submit" data-marke="leer:1">Von Hand erfassen</button>
{/each}`)
			),
			'data-marke'
		);
	});

	it('eine feste Marke ohne Ziel', () => {
		findet(
			fahre(
				baumMit(`<form method="POST" action="?/anlegen" use:enhance={absenden({ marke: 'anlegen' })}>
	<input name="label" data-fokus="anlagen" />
	<button type="submit">Hinzufügen</button>
</form>`)
			),
			"marke: 'anlegen'"
		);
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	it('Marke und Ziel passen zusammen', () => {
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/anlegen" use:enhance={absenden({ marke: 'anlegen' })}>
	<input name="label" data-fokus="anlegen" />
	<button type="submit">Hinzufügen</button>
</form>`)
		);
		expect(rot).toBe(false);
	});

	it('das Ziel darf im Baum hinter dem Formular stehen', () => {
		// Auf der Einheitenseite tut es das. Ein Wächter, der von oben nach unten
		// vergleicht, wäre dort rot, ohne dass etwas fehlt.
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/x" use:enhance={absenden({ marke: 'speichern' })}>
	<button type="submit">Speichern</button>
</form>
<button type="submit" data-fokus="speichern" form="x">Nochmals</button>`)
		);
		expect(rot).toBe(false);
	});

	it('eine Marke aus einem Ausdruck wird nicht verglichen', () => {
		// Sie steht erst zur Laufzeit fest — und der häufige Fall braucht sie gar
		// nicht: Dort liest `absenden()` sie vom gedrückten Knopf.
		const { rot } = fahre(
			baumMit(`<form method="POST" action="?/x" use:enhance={absenden({ marke: gegenstand })}>
	<button type="submit" data-fokus="hand:{s.parteiId}">Von Hand erfassen</button>
</form>`)
		);
		expect(rot).toBe(false);
	});

	it('eine Rückfrage zeichnet das Ziel aus', () => {
		/*
		 * `<Rueckfrage marke="…" />` gibt zur Laufzeit `data-fokus` aus und ist
		 * seit dem 28.08.2026 der übliche Weg. Ein Wächter, der nur Elemente
		 * ansieht, meldete hier ein fehlendes Ziel — ein Fehlalarm, und der lädt
		 * dazu ein, den Wächter zu umgehen statt ihm zu folgen.
		 */
		const { rot, ausgabe } = fahre(
			baumMit(`<form method="POST" action="?/x" use:enhance={absenden({ marke: 'entfernen' })}>
	<Rueckfrage beschriftung="Entfernen" marke="entfernen" />
</form>`)
		);
		expect(rot, ausgabe).toBe(false);
	});

	it('ein Prop namens `marke` an einer anderen Komponente zählt nicht', () => {
		// `<Meldung marke={form}>` sagt, woraus eine Meldung stammt. Wer jedes
		// `marke` als Ziel zählt, meldet am Bestand 124 Ziele statt 31.
		const { rot } = fahre(
			baumMit(`<Meldung ton="fehler" marke={form}>Ging nicht</Meldung>
<form method="POST" action="?/x" use:enhance={absenden({ marke: 'speichern' })}>
	<button type="submit" data-fokus="speichern">Speichern</button>
</form>`)
		);
		expect(rot).toBe(false);
	});

	it('eine Marke in einem Kommentar ist keine Marke', () => {
		// Der erste Anlauf suchte im Dateitext und schlug hier an. Ein Wächter, der
		// an einer Erklärung anschlägt, treibt zum Löschen der Erklärung.
		const { rot } = fahre(
			baumMit(`<!-- Dort greift \`absenden({ marke: 'gibtsnicht' })\` und legt den Fokus zurück. -->
<form method="POST" action="?/x" use:enhance={absenden()}>
	<button type="submit" data-fokus="x">Los</button>
</form>`)
		);
		expect(rot).toBe(false);
	});
});

/**
 * **Der dritte Griff braucht ein ansteuerbares Ziel** (02.09.2026, aus dem
 * Code-Review zu Block 5).
 *
 * `betreiber/dienste` holt den Fokus nach einer Absendung in drei Griffen
 * zurück. Der dritte richtet ihn auf die Meldung, wenn die auslösende Handlung
 * nach dem Erfolg verschwunden ist («In die Anwendung übernehmen» gibt es nach
 * dem Übernehmen nicht mehr). Ein `<p>` ohne `tabindex` nimmt keinen Fokus an:
 * Im Browser gemessen greift `focus()` darauf nicht, mit `tabindex="-1"` greift
 * es. Ohne das Attribut bleibt der Fokus auf `<body>`, und wer mit der Tastatur
 * arbeitet, tabbt sich durch die ganze Seite zurück.
 *
 * **Diese Probe ist bewusst schwach**, und das gehört dazugesagt: Sie liest den
 * Dateiinhalt, statt die Komponente zu rendern. Im Drehbuch lässt sie sich
 * nicht unterbringen, weil `durchspielen` die Dienste-Seite nicht besucht und
 * im Ruhezustand keine Seite eine Meldung zeigt. Sie verhindert genau eines:
 * dass das Attribut still wieder verschwindet.
 *
 * **Und sie deckt nicht alles ab.** Im Bestand stehen 73 handgebaute
 * `<p class="meldung">` neben 93 Verwendungen der Komponente. Der Fokusgriff
 * sucht die Klasse, nicht die Komponente — auf einer Seite mit handgebauter
 * Meldung träfe er weiterhin ein Ziel ohne `tabindex`. Auf `betreiber/dienste`
 * selbst steht die Komponente, dort greift er.
 */
describe('Die Meldung als Fokusziel', () => {
	it('trägt tabindex="-1" — im Markup, nicht im Kommentar', () => {
		/*
		 * **Der erste Anlauf traf den eigenen Kommentar** (aus dem Code-Review).
		 * `toMatch(/tabindex="-1"/)` über den Dateiinhalt fand die Erklärung
		 * darüber, die den Ausdruck wörtlich nennt — der Test wäre grün geblieben,
		 * wenn jemand das Attribut löscht. Genau der Fall, den er verhindern soll.
		 *
		 * Geprüft wird deshalb die Attributzeile im `<p class="meldung …">`, mit
		 * ausgeblendeten Kommentaren.
		 */
		const quelle = readFileSync(join(process.cwd(), 'src/lib/components/Meldung.svelte'), 'utf8');
		const ohneKommentare = quelle
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/[^\n]*/g, '');
		const absatz = /<p\b[^>]*class="meldung[^>]*>/.exec(ohneKommentare);
		expect(absatz, 'kein <p class="meldung …"> im Markup gefunden').toBeTruthy();
		expect(absatz![0]).toMatch(/tabindex="-1"/);
	});
});

/**
 * **Die Sichtprobe am echten Baum.** Ein Wächter, der nur gegen ausgedachte
 * Schnipsel läuft, kann an den wirklichen Dateien vorbeigreifen.
 */
describe('am Bestand', () => {
	/*
	 * **Eigene Zeitgrenze** (19.10.2026, unter Last gemessen): Die Probe fährt
	 * den Wächter als eigenen Node-Prozess über den ganzen Bestand. Ein Lauf ist
	 * das Minimum; schneller ginge es nur, indem man den Wächter nachbaut und
	 * damit genau nicht mehr prüft, was ausgeliefert wird. Zwei gleichzeitige
	 * Läufe der Nicht-DB-Suite brachten 6,7 beziehungsweise 6,8 s und rissen
	 * die Vorgabe von 5 s. Die 20 Sekunden lassen Luft, ohne einen hängenden
	 * Lauf zu verdecken.
	 */
	it('ist grün und hat dabei etwas gesehen', { timeout: 20000 }, () => {
		/*
		 * **Die Schranke steht im Skript, nicht hier.** `IM_REPO` hängt am Pfad
		 * und nicht am Argument, dieser Lauf fährt also dieselbe Sichtprobe wie
		 * `npm run check:fokusmarke`. Ein zweiter Satz Zahlen an dieser Stelle
		 * wäre eine Kopie, die beim nächsten Anheben still veraltet — und die
		 * nie rot werden könnte, weil `rot === false` sie schon voraussetzt.
		 */
		const { rot, ausgabe } = fahre(process.cwd());
		expect(rot, ausgabe).toBe(false);
		expect(ausgabe).toMatch(/\d+ Ziele in \d+ Dateien, \d+ feste Marken/);
	});
});
