/**
 * Die Bauform, an der der Textwächter Meldungen erkennt.
 *
 * **Warum diese Probe nicht den Wächter fährt.** `scripts/check-texte.mjs`
 * hat Untergrenzen — 2000 Textläufe, 550 Absagen, 300 Felder, 110
 * Seitenfehler. Ein Beispielbaum mit drei Dateien reisst sie alle und bricht
 * ab, bevor der Lauf zu einem Befund kommt; gemessen würde immer nur «zu
 * wenig». Geprüft wird deshalb die Form selbst, aus `scripts/lib/textform.mjs`,
 * die Wächter und Probe teilen.
 *
 * **Der Fehler, den sie verhindert** (22.09.2026). Der Abschluss der Feldform
 * lautete `[,}\n]` und beendete die Fangstelle am **ersten Komma** — das steht
 * in einer Meldung fast immer mitten im Text. Die Stelle wurde danach **weder
 * gemessen noch gezählt** — gezählt wird erst, was über der Mindestlänge
 * zurückkommt. Gemessen: 156 Meldungen vorher, 317 heute; eine davon trug
 * einen Satz über der Grenze, und der landete in `MANIFEST.txt`.
 *
 * Das ist die Klasse «grün, weil nichts geprüft wurde, nicht weil etwas
 * stimmt». Sie ist von aussen unsichtbar, weil der Wächter grün ist und seine
 * Zahl sogar steigt.
 */
import { describe, expect, it } from 'vitest';
import {
	HOECHSTE_SATZLAENGE,
	MINDESTLAENGE,
	abschnitte,
	feldform,
	konstantenform,
	satzAus,
	satzfunktionen,
	saetze,
	seitenfehlerform
} from '../../scripts/lib/textform.mjs';

/**
 * Liest eine Quelle so, wie der Wächter sie liest.
 *
 * **Die Zahlen kommen aus dem Modul, nicht aus dieser Datei** (Code-Review
 * 22.09.2026). Der erste Anlauf schrieb `20` und `180` noch einmal hin — zwei
 * Kopien derselben Regel, und der Kommentar über der Auslagerung argumentiert
 * genau dagegen.
 */
function meldungen(quelle: string, form = feldform): string[] {
	return [...quelle.matchAll(form())]
		.map((t) => satzAus(t[1]))
		.filter((s) => s.length > MINDESTLAENGE);
}

describe('Die Feldform', () => {
	it('liest eine Meldung mit einem Komma im Text ganz', () => {
		/*
		 * Der Fall, um den es geht. Mit dem alten Abschluss endete die
		 * Fangstelle nach «Stimmpartei», und übrig blieb eine Zeichenkette ohne
		 * schliessendes Anführungszeichen — null Stücke, 0 Zeichen.
		 */
		const [satz] = meldungen(
			[
				'	bestandteile.push({',
				"		beschreibung:",
				"			'Jede abgegebene Stimme mit Stimmpartei, Einheit und Wahl. Dazu, ob die ' +",
				"			'Sitzungsleitung sie erfasst hat.'",
				'	});'
			].join('\n')
		);
		expect(satz).toContain('Stimmpartei');
		// Und zwar bis zum Ende, über das Komma und über den Zeilenwechsel hinweg.
		expect(satz).toContain('Sitzungsleitung sie erfasst hat.');
	});

	it('misst einen zu langen Satz, der ein Komma enthält', () => {
		/*
		 * Die Wirkung, auf die es ankommt: Nicht «wird erkannt», sondern «wird
		 * gemessen». Der alte Abschluss erkannte die Stelle und mass 0.
		 */
		const lang = 'Diese Meldung hat, gleich am Anfang, ein Komma. ' + 'Sie zählt weiter, '.repeat(12) + 'und hört hier auf.';
		const [satz] = meldungen(`nachricht: '${lang}'`);
		const laengster = Math.max(...satz.split(/(?<=[.!?]) /).map((s) => s.length));
		expect(laengster).toBeGreaterThan(HOECHSTE_SATZLAENGE);
	});

	it('hört am Ende des Werts auf und greift nicht auf das nächste Feld über', () => {
		/*
		 * Die Gegenrichtung, und sie ist der Grund gegen die grosszügigere
		 * Fassung: Ein Ausdruck, der über ein beliebiges Verbindungsstück
		 * weiterliest, springt über Quelltext und Kommentare hinweg und misst
		 * dann den Quelltext. Gemessen am 22.09.2026: fünf solcher Treffer in
		 * `src/lib/domain/odt.ts`, alle falsch.
		 */
		const zwei = meldungen(
			[
				"	{ satz: 'Der erste Satz steht hier, mit Komma.' },",
				"	{ satz: 'Der zweite Satz steht dort, auch mit Komma.' }"
			].join('\n')
		);
		expect(zwei).toHaveLength(2);
		expect(zwei[0]).not.toContain('zweite');
		expect(zwei[1]).not.toContain('erste');
	});

	it('lässt eine Kennung ohne Leerzeichen in Ruhe', () => {
		/*
		 * **Lang genug, damit die Regel wirklich gemessen wird** (Code-Review
		 * 22.09.2026). Der erste Anlauf nahm `'nicht_archivierbar'` — 18
		 * Zeichen, gestorben an der Mindestlänge 20, nicht am Filter «nur
		 * Stücke mit einem Leerzeichen». Die Probe war grün, auch wenn man den
		 * Filter entfernte, und belegte damit nichts.
		 *
		 * Ein Wächter, der Kennungen anstreicht, meldet Unsinn und wird
		 * übergangen; dagegen steht dieser Filter.
		 */
		const kennung = 'nicht_archivierbar_wegen_bestehendem_siegel';
		expect(kennung.length).toBeGreaterThan(MINDESTLAENGE);
		expect(meldungen(`grund: '${kennung}'`)).toHaveLength(0);
	});

	it('setzt für einen eingefügten Ausdruck einen Platzhalter', () => {
		// Was in `${…}` steht, ist Quelltext und keine Prosa.
		const [satz] = meldungen('nachricht: `Die Versammlung ${v.name} ist geschlossen worden.`');
		expect(satz).toBe('Die Versammlung … ist geschlossen worden.');
	});
});

describe('Die Seitenfehlerform', () => {
	/*
	 * **Sie hat die Probe erst in der zweiten Runde bekommen** (22.09.2026).
	 * Die Feldform war ausgelagert und geprüft, die Seitenfehlerform blieb als
	 * roher Ausdruck im Wächter zurück — während derselbe Block schrieb, eine
	 * Fehlerklasse bleibe nur dort geschlossen, wo man beim Schliessen
	 * hingesehen hat. Beim Nachweis war der Nachbar wieder ausgelassen.
	 */
	it('liest eine Meldung mit einer Klammer im Text ganz', () => {
		/*
		 * Der Fall aus dem Bestand: `weisungsblatt.pdf/+server.ts`. Mit dem
		 * alten Abschluss `[\s\S]{0,400}?\)` endete die Fangstelle an der
		 * Klammer in «(?haus=…)», und übrig blieb eine offene Zeichenkette.
		 */
		const [satz] = meldungen(
			"error(400, 'Geben Sie an, für welches Haus das Blatt gilt (?haus=…).');",
			seitenfehlerform
		);
		expect(satz).toBe('Geben Sie an, für welches Haus das Blatt gilt (?haus=…).');
	});

	it('misst einen zu langen Satz über mehrere Zeichenketten', () => {
		const lang = 'Diese Absage ist zu lang, und zwar deutlich. ' + 'Sie zählt weiter, '.repeat(12);
		const [satz] = meldungen(`error(409, '${lang}' + 'und hört hier auf.');`, seitenfehlerform);
		const laengster = Math.max(...satz.split(/(?<=[.!?]) /).map((s) => s.length));
		expect(laengster).toBeGreaterThan(HOECHSTE_SATZLAENGE);
	});

	it('greift nicht auf die nächste Absage über', () => {
		const zwei = meldungen(
			[
				"	if (!a) error(400, 'Die erste Absage steht hier, mit Komma.');",
				"	if (!b) error(404, 'Die zweite Absage steht dort, auch mit Komma.');"
			].join('\n'),
			seitenfehlerform
		);
		expect(zwei).toHaveLength(2);
		expect(zwei[0]).not.toContain('zweite');
	});

	it('lässt einen Aufruf ohne Zeichenkette in Ruhe', () => {
		/*
		 * 23 Aufrufe im Bestand führen eine Konstante oder `fehler.message`
		 * statt eines Literals. Sie tragen keinen lesbaren Text und dürfen
		 * keine Meldung ergeben — sonst misst der Wächter einen Bezeichner.
		 */
		expect(meldungen('error(403, VERWALTUNG_VORBEHALTEN);', seitenfehlerform)).toHaveLength(0);
	});
});

describe('Die Aufbauform', () => {
	/*
	 * **Text, der zeilenweise in eine Liste geschoben wird.** So entsteht
	 * `MANIFEST.txt`, das Dokument mit der ausdrücklichen Laienanforderung
	 * (FR-52), und so entsteht der Protokollentwurf. Beide fielen durch die
	 * drei anderen Bauformen.
	 */
	it('hängt aufeinanderfolgende Zeilen zu einem Satz zusammen', () => {
		/*
		 * Mit einem **Leerzeichen**, nicht mit nichts: Die Zeilen sind auf
		 * Druckbreite umbrochen, und der Zeilenwechsel ist für den Leser ein
		 * Zwischenraum. `join('')` ergäbe «belegtesnicht».
		 */
		const [satz] = abschnitte(
			["z.push('Das Siegel belegt, dass nichts verändert wurde. Wann es entstand,');", "z.push('belegt es nicht.');"].join('\n')
		);
		expect(satz).toBe('Das Siegel belegt, dass nichts verändert wurde. Wann es entstand, belegt es nicht.');
	});

	it('liest auch einen Aufruf, der über mehrere Zeilen steht', () => {
		/*
		 * **Der blinde Fleck der ersten Fassung** (23.09.2026). Sie verlangte
		 * den ganzen Aufruf auf einer Zeile und fand deshalb in
		 * `domain/siegel.ts` den längsten Satz nicht — zwei Aufrufe stehen
		 * dort umbrochen, weil der Formatierer sie gebrochen hat. Die Probe
		 * war grün und die Regel blind; gefunden hat es die Abnahme, die den
		 * bekannten Fall verlangte.
		 */
		const [satz] = abschnitte(
			['z.push(', "\t'Es enthält alles, was die Beschlüsse trägt.'", ');'].join('\n')
		);
		expect(satz).toBe('Es enthält alles, was die Beschlüsse trägt.');
	});

	it('trennt an einer Überschrift, auch ohne Trennlinie darunter', () => {
		/*
		 * **Diese Probe fehlte, und die Regel war ungeprüft** (Code-Review
		 * 23.09.2026). Der Fall darunter sah so aus, als decke er sie ab — in
		 * Wirklichkeit trennte dort die **Trennlinie**, und die Überschrift
		 * fiel zusätzlich an der Mindestlänge durch. Die Regel liess sich
		 * ersatzlos entfernen, und alle sechs Proben blieben grün.
		 *
		 * Die Überschrift hier ist deshalb lang genug, um die Mindestlänge zu
		 * überschreiten, und es steht keine Trennlinie darunter.
		 */
		const teile = abschnitte(
			[
				"z.push('WAS DIESES ABSCHLUSSPAKET ENTHÄLT UND WIE MAN ES PRÜFT');",
				"z.push('Es enthält die Zahlen jeder Abstimmung und den Verlauf.');"
			].join('\n')
		);
		expect(teile).toEqual(['Es enthält die Zahlen jeder Abstimmung und den Verlauf.']);
	});

	it('endet an einer Leerzeile, einer Überschrift und einer Trennlinie', () => {
		/*
		 * Sonst hängt die Überschrift am ersten Satz und überzeichnet ihn um
		 * ihre Länge.
		 *
		 * Eine frühere Fassung nannte hier «im Bestand gemessen 217 statt
		 * 194». Die Zahl liess sich im Code-Review unter keiner Definition
		 * reproduzieren — im Bestand trennt die Trennlinie ohnehin vorher, und
		 * mit angehängter Überschrift wären es 215. Gestrichen: Eine Zahl ohne
		 * ihre Definition ist keine Messung.
		 */
		const teile = abschnitte(
			[
				"z.push('WAS DIESES PAKET IST');",
				"z.push('-'.repeat(56));",
				"z.push('Es enthält die Zahlen jeder Abstimmung und den Verlauf.');",
				"z.push('');",
				"z.push('Die Daten liegen in einem offenen Format vor.');"
			].join('\n')
		);
		expect(teile).toEqual([
			'Es enthält die Zahlen jeder Abstimmung und den Verlauf.',
			'Die Daten liegen in einem offenen Format vor.'
		]);
	});

	it('endet an jeder anderen Anweisung dazwischen', () => {
		/*
		 * **Zweige und Schleifen stehen hintereinander und erscheinen nie
		 * zusammen.** In `manifestInWorten` steht einmal der Fall mit
		 * Zertifikat und einmal der ohne; zusammengehängt wäre das ein Satz,
		 * den kein Leser je sieht.
		 */
		const teile = abschnitte(
			[
				"if (a) {",
				"\tz.push('Beim Versiegeln war diese Stelle hinterlegt.');",
				"} else {",
				"\tz.push('Beim Versiegeln war keine Stelle hinterlegt.');",
				"}"
			].join('\n')
		);
		expect(teile).toHaveLength(2);
	});

	it('liest nur den Empfänger z, nicht jede Liste', () => {
		/*
		 * **Gemessen, nicht entschieden** (Bericht 22.09.2026): Jeder
		 * Empfänger erfasst zwölf Textläufe mehr und kostet 24 falsche
		 * Beanstandungen — `s.push`, `schritte.push`, `hinweise.push` bauen
		 * Kastentexte und Etiketten auf, die nie zusammen vor Augen stehen.
		 */
		expect(
			abschnitte("hinweise.push('Diese Zeile gehört zu einer Karte, nicht zu einem Text.');")
		).toEqual([]);
	});

	it('lässt einen zu kurzen Abschnitt weg und macht Leerraum zu einem Zwischenraum', () => {
		/*
		 * Zwei Regeln, die der Code-Review am 23.09.2026 als ungedeckt
		 * gemessen hat: die Mindestlänge und die Normalisierung des
		 * Leerraums. Beide liessen sich entfernen, ohne dass eine Probe rot
		 * wurde.
		 */
		expect(abschnitte("z.push('Zu kurz.');")).toEqual([]);
		// Zwei Zeilen eines Abschnitts sind im Quelltext eingerückt; ohne
		// Normalisierung trüge der gemessene Satz den Einzug mit.
		expect(
			abschnitte(
				["z.push('Der erste Teil des Satzes');", "z.push('   und der zweite Teil.');"].join('\n')
			)
		).toEqual(['Der erste Teil des Satzes und der zweite Teil.']);
	});

	it('lässt Kommentare aussen vor', () => {
		// Ein Beispiel im Kopfkommentar steht niemandem vor Augen.
		expect(abschnitte("// z.push('Ein Beispiel im Kommentar, lang genug für die Grenze.');")).toEqual(
			[]
		);
	});
});

describe('Die Konstantenform', () => {
	/*
	 * **Die fünfte Bauform** (Pendenzen 18.10.2026): `VERTRETERGRENZE` lief an
	 * der Schranke von 180 Zeichen je Satz vorbei, weil `check:texte` nur
	 * Meldungen, Seiten, `error(4xx)` und `z.push` mass. Exportierte
	 * Zeichenketten sind im Haus die zweite grosse Quelle sichtbarer Texte.
	 */
	it('liest eine exportierte Konstante aus einer Zeichenkette', () => {
		const [satz] = meldungen(
			"export const VERTRETERGRENZE = 'Der Vertreter ohne Eigentum darf hier nicht mitstimmen.';",
			konstantenform
		);
		expect(satz).toBe('Der Vertreter ohne Eigentum darf hier nicht mitstimmen.');
	});

	it('hängt eine Konstante über mehrere Zeichenketten zusammen', () => {
		const [satz] = meldungen(
			[
				'export const VERTRETERGRENZE =',
				"\t'Der Vertreter ohne Eigentum darf hier nicht mitstimmen. ' +",
				"\t'Seine Vollmachten ruhen, und er zählt nicht mit.';"
			].join('\n'),
			konstantenform
		);
		expect(satz).toContain('nicht mitstimmen');
		expect(satz).toContain('Vollmachten ruhen');
	});

	it('misst einen zu langen Satz in einer exportierten Konstante', () => {
		const lang = 'Diese Konstante steht als Satz auf einer Seite. ' + 'Sie zählt weiter, '.repeat(12) + 'und hört hier auf.';
		const [satz] = meldungen(`export const LANG = '${lang}'`, konstantenform);
		const laengster = Math.max(...saetze(satz).map((s) => s.length));
		expect(laengster).toBeGreaterThan(HOECHSTE_SATZLAENGE);
	});

	it('greift nicht auf die nächste Anweisung über', () => {
		const zwei = meldungen(
			[
				"export const EINS = 'Die erste Konstante steht hier, mit Komma.';",
				"export const ZWEI = 'Die zweite Konstante steht dort, auch mit Komma.';"
			].join('\n'),
			konstantenform
		);
		expect(zwei).toHaveLength(2);
		expect(zwei[0]).not.toContain('zweite');
		expect(zwei[1]).not.toContain('erste');
	});

	it('lässt eine Konstante ohne Zeichenkette in Ruhe', () => {
		expect(meldungen('export const FASSUNGEN = neueListe();', konstantenform)).toHaveLength(0);
		expect(meldungen("export const ARTEN = ['natuerlich', 'juristisch'];", konstantenform)).toHaveLength(0);
	});
});

describe('Die Satzgrenze kennt Abkürzungen', () => {
	/*
	 * **Der Schnitt an jedem «. » war zu grob** (Pendenzen 18.10.2026,
	 * Codeprüfung 3c): «S. 62», «Rz. 191» und «Art. 712m» trennten einen Satz,
	 * und zwei Sätze über 180 Zeichen blieben unbemerkt.
	 */
	const faelle = [
		['S. 62', 'Siehe S. 62 und die dort genannte Regel. Der nächste Satz.'],
		['Rz. 191', 'Siehe Rz. 191 und die dort genannte Regel. Der nächste Satz.'],
		['Art. 712m', 'Siehe Art. 712m und die dort genannte Regel. Der nächste Satz.'],
		['Abs. 2', 'Siehe Abs. 2 und die dort genannte Regel. Der nächste Satz.'],
		['Ziff. 3', 'Siehe Ziff. 3 und die dort genannte Regel. Der nächste Satz.'],
		['Fn. 103', 'Siehe Fn. 103 und die dort genannte Regel. Der nächste Satz.'],
		['Nr. 9', 'Siehe Nr. 9 und die dort genannte Regel. Der nächste Satz.'],
		['f.', 'Siehe S. 62 f. und die dort genannte Regel. Der nächste Satz.'],
		['ff.', 'Siehe S. 62 ff. und die dort genannte Regel. Der nächste Satz.'],
		['E.', 'Siehe BGE 140 III 561 E. 5.2 und die dort genannte Regel. Der nächste Satz.']
	];

	for (const [abkuerzung, text] of faelle) {
		it(`trennt nicht an «${abkuerzung}»`, () => {
			const teile = saetze(text);
			expect(teile[0]).toContain(abkuerzung);
			expect(teile[0]).toContain('die dort genannte Regel');
		});
	}

	it('trennt weiter an einem echten Satzende', () => {
		expect(saetze('Der erste Satz. Der zweite Satz.')).toEqual([
			'Der erste Satz.',
			'Der zweite Satz.'
		]);
	});

	it('misst einen langen Satz über einer Abkürzung ganz', () => {
		const lang =
			'Siehe S. 62 und die dort genannte Regel, die für diesen Beschluss ' +
			'weiter gilt, '.repeat(12) +
			'und bis hierher reicht.';
		expect(saetze(lang)).toHaveLength(1);
		expect(saetze(lang)[0].length).toBeGreaterThan(HOECHSTE_SATZLAENGE);
	});
});

describe('Die Satzfunktions-Bauform über den Parser', () => {
	// Die Regex las nur `return '…' + '…'`; drei Formen fielen durch: ein
	// Ternär in der Kette, ein einzelnes `return '…'` und `text(…)` als
	// Argument. Der Parser liest sie alle.

	it('liest ein einzelnes return mit einer Zeichenkette', () => {
		const satz = satzfunktionen("export function f(): string { return 'Ein einzelner Satz steht hier.'; }");
		expect(satz).toContain('Ein einzelner Satz steht hier.');
	});

	it('liest einen Ternär in der Rückgabe, je Zweig eine Lesart', () => {
		const satz = satzfunktionen(
			"export function f(x: boolean): string { return (x ? 'Willst du speichern?' : 'nein'); }"
		);
		expect(satz).toEqual(['Willst du speichern?', 'nein']);
	});

	it('kombiniert einen Ternär in einer Verkettung mit ihren Teilen', () => {
		// Verbunden gemessen schnitte der Punkt im ersten Zweig den zweiten ab.
		const satz = satzfunktionen(
			"export function f(x: boolean): string { return 'Die Stimme ' + (x ? 'zählt. Gut' : 'zählt nicht') + ' hier.'; }"
		);
		expect(satz).toEqual(['Die Stimme zählt. Gut hier.', 'Die Stimme zählt nicht hier.']);
	});

	it('liest ein text(...)-Argument', () => {
		const satz = satzfunktionen("const zeile = [text('In die Spalte «anwesend»:')];");
		expect(satz).toContain('In die Spalte «anwesend»:');
	});

	it('lässt eine Kennung oder einen Aufruf ohne Text in Ruhe', () => {
		expect(satzfunktionen('export function f(): string { return name; }')).toEqual([]);
		expect(satzfunktionen('export function f(): string { return foo(); }')).toEqual([]);
	});
});
