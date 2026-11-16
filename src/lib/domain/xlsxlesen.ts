/**
 * Eine Excel-Arbeitsmappe lesen — rein, ohne Ablage und ohne Uhr (AD-1).
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «und wie kann ich den CSV oder Excel
 * Import machen?» Es ging nur mit CSV. Das ist ungünstig, weil in der Hand
 * eines Bewirtschafters eine Excel-Datei liegt — und wer sie erst als CSV
 * speichern muss, wählt dabei ein Trennzeichen und eine Zeichenkodierung, also
 * genau die zwei Dinge, an denen ein Import scheitert.
 *
 * **Warum von Hand und nicht mit einer Bibliothek.** Dieselbe Überlegung wie
 * beim Schreiben (`xlsx.ts`) und beim Word-Dokument (`docx.ts`): Ein `.xlsx`
 * ist ein ZIP-Archiv mit ein paar XML-Dateien, den Entpacker gibt es hier seit
 * der Paketprüfung. Eine Bibliothek dafür brächte eine Abhängigkeit für etwas,
 * das zweihundert Zeilen kostet — und mit ihr die Frage, was sie beim nächsten
 * Sicherheitsdurchgang mitbringt.
 *
 * ## Die Haltung: Diese Datei kommt von aussen
 *
 * Das ist der Unterschied zum Schreiben, und die erste Fassung hatte ihn nicht.
 * Vier Stellen haben der Datei geglaubt, und alle vier waren zu erschlagen
 * (25.08.2026, in der Prüfung gemessen):
 *
 *   - **Zahlen.** `<row r="20000000">` liess `while (raster.length < nummer)`
 *     laufen: 146 Byte, und der Node-Prozess stirbt am Speicher. Es gibt nur
 *     einen Prozess — das reisst die laufende Versammlung mit.
 *   - **Ausdrücke.** `<si>` ohne `</si>` liess `([\s\S]*?)` von jedem
 *     Anfangspunkt bis zum Dateiende suchen: quadratisch und synchron. Eine
 *     Datei von **886 Byte** blockierte den Prozess neun Sekunden, zehn
 *     Kilobyte hätten eine Stunde gereicht. Deshalb wird hier nicht mehr
 *     rückwärts verfolgt, sondern mit `indexOf` von Fundstelle zu Fundstelle
 *     gelaufen.
 *   - **Elementformen.** `<c r="B1" s="4"/>` schliesst sich selbst. Der alte
 *     Ausdruck nahm es als Anfangsmarke und suchte das nächste `</c>` — das
 *     der **Folgezelle** gehörte, die damit verschwand. Kein Randfall: Der
 *     eigene Schreiber erzeugt diese Form für jede formatierte Leerzelle
 *     (`auszaehlmappe.ts`), gemessen gingen von drei Zellen zwei durch.
 *   - **Menge.** Ohne Deckel liest der Leser eine Mappe mit einer Million
 *     Zeilen bis zum Ende.
 *
 * ## Was gelesen wird und was nicht
 *
 * Nur Werte, und nur vom ersten Blatt der Reiterfolge. Formeln, Formate,
 * Farben, Verbundzellen und Diagramme sind für eine Übernahme belanglos —
 * gebraucht wird ein Raster aus Text. Steht in einer Zelle eine Formel, liest
 * diese Funktion ihr zuletzt berechnetes Ergebnis (`<v>`), das Excel
 * mitspeichert; fehlt es — etwa weil die Mappe nie in Excel geöffnet wurde —,
 * bleibt die Zelle leer.
 *
 * **Datumsangaben kommen als Zahl.** Excel speichert ein Datum als Tage seit
 * dem 30.12.1899 und merkt sich das Aussehen im Format, nicht im Wert. Der
 * Leser rechnet die üblichen Fälle zurück; wer sichergehen will, formatiert die
 * Spalte als Text.
 */

/** Was `entpacke()` liefert: Pfad im Archiv → Inhalt. */
export type Archivinhalt = ReadonlyMap<string, Uint8Array>;

export class MappenFehler extends Error {
	constructor(nachricht: string) {
		super(nachricht);
		this.name = 'MappenFehler';
	}
}

/** Excels eigene Grenzen — grösser kann eine Mappe gar nicht sein. */
const HOECHSTE_ZEILE = 1_048_576;
const HOECHSTE_SPALTE = 16_384;
/** Und eine Grenze für das, was hier verarbeitet wird: 200 000 Zeilen sind viel. */
const HOECHSTE_ZEILEN = 200_000;
const HOECHSTES_XML = 20_000_000;

const TEXT = new TextDecoder('utf-8');

/**
 * «B7» → Spalte 2 (eins-basiert), `0` bei Unsinn.
 *
 * Der Zeilenteil wird nicht gebraucht: Die Zeile steht am `<row>`-Element und
 * ist dort verlässlicher — eine Adresse kann fehlen, das `r` der Zeile nicht.
 */
export function spaltenNummer(adresse: string): number {
	let n = 0;
	for (const zeichen of adresse) {
		const gross = zeichen.toUpperCase();
		if (gross < 'A' || gross > 'Z') break;
		n = n * 26 + (gross.charCodeAt(0) - 64);
		// Weiterzurechnen brächte nur eine grössere unbrauchbare Zahl.
		if (n > HOECHSTE_SPALTE) return 0;
	}
	return n;
}

/**
 * Löst die XML-Ersatzdarstellungen auf — in **einem** Durchgang.
 *
 * Nacheinander ersetzt liefe `&amp;#38;` zweimal durch die Mühle und ergäbe
 * «&» statt «&#38;». Ein Durchgang kann das nicht.
 */
function entwerte(text: string): string {
	return text.replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-fA-F]+));/g, (ganz, dez, hex) => {
		if (dez !== undefined || hex !== undefined) {
			const nummer = dez !== undefined ? Number(dez) : parseInt(hex, 16);
			// Ausserhalb des Unicode-Bereichs wirft `fromCodePoint`; und ein
			// Nullzeichen nähme PostgreSQL in einer Textspalte nicht an.
			// Auch die Surrogathälften: Sie ergäben allein ein Ersatzzeichen.
			if (!Number.isInteger(nummer) || nummer <= 0 || nummer > 0x10ffff) return '';
			if (nummer >= 0xd800 && nummer <= 0xdfff) return '';
			return String.fromCodePoint(nummer);
		}
		return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[ganz] ?? ganz;
	});
}

/**
 * Läuft die Elemente eines Namens ab — ohne Rückwärtsverfolgung.
 *
 * Liefert je Fundstelle die Merkmale und den Inhalt. Ein selbstschliessendes
 * Element (`<c … />`) hat keinen Inhalt und verzehrt nichts von dem, was ihm
 * folgt — genau das war der Fehler der ersten Fassung.
 */
function* elemente(xml: string, name: string): Generator<{ merkmale: string; inhalt: string }> {
	const auf = `<${name}`;
	const zu = `</${name}>`;
	let stelle = 0;

	while (stelle < xml.length) {
		const anfang = xml.indexOf(auf, stelle);
		if (anfang === -1) return;

		// «<row» darf nicht auf «<rows» treffen.
		const danach = xml[anfang + auf.length];
		if (danach !== undefined && !' \t\r\n/>'.includes(danach)) {
			stelle = anfang + auf.length;
			continue;
		}

		const spitzeZu = xml.indexOf('>', anfang);
		if (spitzeZu === -1) return;

		const merkmale = xml.slice(anfang + auf.length, spitzeZu);
		if (merkmale.endsWith('/')) {
			yield { merkmale: merkmale.slice(0, -1), inhalt: '' };
			stelle = spitzeZu + 1;
			continue;
		}

		const ende = xml.indexOf(zu, spitzeZu + 1);
		if (ende === -1) {
			// Unvollständiges Element: Alles bis zum Ende gehört dazu, und danach
			// ist Schluss. Kein Suchen von jedem Anfangspunkt aus.
			yield { merkmale, inhalt: xml.slice(spitzeZu + 1) };
			return;
		}
		yield { merkmale, inhalt: xml.slice(spitzeZu + 1, ende) };
		stelle = ende + zu.length;
	}
}

/** Der Text eines Elements, aus allen `<t>`-Stücken zusammengesetzt. */
function textInhalt(inhalt: string): string {
	let raus = '';
	for (const t of elemente(inhalt, 't')) raus += t.inhalt;
	return entwerte(raus);
}

/**
 * Die gemeinsame Zeichenkettentabelle.
 *
 * Excel legt Texte nicht in die Zelle, sondern in `sharedStrings.xml`, und die
 * Zelle verweist mit einer Nummer darauf (`t="s"`). Ein Eintrag kann aus
 * mehreren Stücken bestehen, wenn Teile verschieden formatiert sind — die
 * gehören zusammengesetzt, sonst fehlt der halbe Name.
 */
function zeichenketten(xml: string): string[] {
	const raus: string[] = [];
	for (const si of elemente(xml, 'si')) raus.push(textInhalt(si.inhalt));
	return raus;
}

/**
 * Der Pfad des ersten Blattes — nach der **Reiterfolge**, nicht nach dem
 * Dateinamen.
 *
 * `xl/workbook.xml` führt die Blätter in der Reihenfolge, in der sie im
 * Programm nebeneinanderstehen, und verweist über `r:id` auf die Datei. Wer
 * stattdessen `sheet1.xml` nimmt, liest nach einem Umsortieren der Reiter
 * stillschweigend das falsche Blatt. Fällt der Weg durch — weil die Mappe
 * anders gebaut ist —, bleibt die Namenssuche als Rückfall.
 */
function erstesBlatt(dateien: Archivinhalt): string | null {
	const mappe = dateien.get('xl/workbook.xml');
	const bezuege = dateien.get('xl/_rels/workbook.xml.rels');
	if (mappe && bezuege) {
		const ersteId = TEXT.decode(mappe).match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
		if (ersteId) {
			/*
			 * **Kein Ausdruck aus Dateiinhalt** (25.08.2026). Die erste Fassung
			 * baute `new RegExp(\`…Id="${ersteId}"…\`)` — und eine Kennung mit
			 * einer Klammer darin lässt das **werfen** («Unterminated group»,
			 * nachgemessen). Der Wurf übersprang dann den Rückfall auf die
			 * Namenssuche, den es zwölf Zeilen weiter unten gibt: Aus einer
			 * lesbaren Datei wurde eine Absage. Verglichen wird jetzt als
			 * Zeichenkette.
			 */
			for (const bezug of elemente(TEXT.decode(bezuege), 'Relationship')) {
				if (bezug.merkmale.match(/\bId="([^"]*)"/)?.[1] !== ersteId) continue;
				const ziel = bezug.merkmale.match(/\bTarget="([^"]*)"/)?.[1];
				if (!ziel) break;
				const pfad = ziel.startsWith('/') ? ziel.slice(1) : `xl/${ziel.replace(/^\.\//, '')}`;
				if (dateien.has(pfad)) return pfad;
				break;
			}
		}
	}

	const nachNamen = [...dateien.keys()]
		.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
		.sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
	return nachNamen[0] ?? null;
}

/**
 * Das erste Blatt einer Arbeitsmappe als Raster aus Text.
 *
 * Leere Zellen kommen als leere Zeichenkette, fehlende Zeilen am Ende gar
 * nicht. Die Kopfzeile ist die erste Zeile — dieselbe Annahme wie bei einer
 * CSV-Datei.
 */
export function zeilenAusMappe(dateien: Archivinhalt): string[][] {
	const blatt = erstesBlatt(dateien);
	if (!blatt) {
		throw new MappenFehler(
			'In dieser Datei steht keine Tabelle. Erwartet wird eine Excel-Datei (.xlsx) oder eine CSV.'
		);
	}

	const gemeinsam = dateien.get('xl/sharedStrings.xml');
	if (gemeinsam && gemeinsam.length > HOECHSTES_XML) {
		throw new MappenFehler('Die Datei ist zu gross.');
	}
	const texte = gemeinsam ? zeichenketten(TEXT.decode(gemeinsam)) : [];

	const roh = dateien.get(blatt)!;
	if (roh.length > HOECHSTES_XML) throw new MappenFehler('Die Datei ist zu gross.');
	const xml = TEXT.decode(roh);

	const raster: string[][] = [];

	for (const zeile of elemente(xml, 'row')) {
		const nummer = Number(zeile.merkmale.match(/\br="(\d+)"/)?.[1] ?? NaN);
		// Ohne brauchbare Nummer an die nächste freie Stelle: Eine Zeile zu
		// verwerfen wäre stiller Datenverlust.
		const stelle = Number.isInteger(nummer) ? nummer : raster.length + 1;
		if (stelle < 1 || stelle > HOECHSTE_ZEILE) continue;
		if (stelle > HOECHSTE_ZEILEN) {
			throw new MappenFehler(
				`Die Tabelle hat mehr als ${HOECHSTE_ZEILEN.toLocaleString('de-CH')} Zeilen. ` +
					'Teilen Sie sie auf.'
			);
		}

		const felder: string[] = [];
		for (const zelle of elemente(zeile.inhalt, 'c')) {
			const adresse = zelle.merkmale.match(/\br="([A-Z]+)\d+"/)?.[1];
			const gelesen = adresse ? spaltenNummer(adresse) : felder.length + 1;
			// Eine unbrauchbare Adresse bekommt einen Platzhalter statt eines
			// Sprungs: Überspringen verschöbe jede Folgezelle um eins.
			const spalte = gelesen >= 1 && gelesen <= HOECHSTE_SPALTE ? gelesen : felder.length + 1;

			const art = zelle.merkmale.match(/\bt="([^"]+)"/)?.[1];
			let wert: string;
			if (art === 's') {
				const nr = Number(zelle.inhalt.match(/<v>(\d+)<\/v>/)?.[1] ?? -1);
				wert = texte[nr] ?? '';
			} else if (art === 'inlineStr') {
				wert = textInhalt(zelle.inhalt);
			} else {
				// Zahlen, Wahrheitswerte und Formelergebnisse stehen in `<v>`.
				wert = entwerte(zelle.inhalt.match(/<v>([^<]*)<\/v>/)?.[1] ?? '');
			}

			while (felder.length < spalte - 1) felder.push('');
			felder[spalte - 1] = wert;
		}

		while (raster.length < stelle - 1) raster.push([]);
		raster[stelle - 1] = felder;
	}

	// Leerzeilen am Ende wegschneiden: Eine Mappe trägt oft ein paar formatierte,
	// aber leere Zeilen mit sich.
	while (raster.length > 0 && raster[raster.length - 1].every((w) => w.trim() === '')) {
		raster.pop();
	}

	if (raster.length === 0) throw new MappenFehler('Das erste Tabellenblatt ist leer.');
	return datenUmrechnen(raster);
}

/**
 * «46023» → «2026-01-01», aber nur in Datumsspalten.
 *
 * **Ein Datum kommt aus Excel als Zahl an** (25.08.2026, aus der Prüfung).
 * Excel speichert Tage seit dem 30.12.1899 und merkt sich das Aussehen im
 * Format, nicht im Wert. Die Übernahme sagte dazu «Zur Nutzniessung **fehlt**
 * der Beginn im Format JJJJ-MM-TT» — er fehlte nicht, er stand als Zahl da,
 * und der Benutzer suchte an der falschen Stelle.
 *
 * **Nur wo eine Datumsspalte erwartet wird, und nur im plausiblen Bereich**
 * (1990 bis 2100). Eine Wertquote von 40000 bleibt damit eine Wertquote, und
 * eine Spalte, die zufällig fünfstellige Zahlen führt, bleibt unberührt.
 */
function datenUmrechnen(raster: string[][]): string[][] {
	const kopf = raster[0].map((s) => s.trim().toLowerCase());
	const datumsspalten = new Set(
		kopf
			.map((name, i) => ({ name, i }))
			// `quota_*` ist frei benannt — eine Wertquotenspalte «quota_to» wäre
			// sonst plötzlich ein Datum (zweite Prüfrunde).
			.filter(({ name }) => !name.startsWith('quota_') && /(^|_)(from|to|datum|date)$/.test(name))
			.map(({ i }) => i)
	);
	if (datumsspalten.size === 0) return raster;

	return raster.map((zeile, nr) =>
		nr === 0
			? zeile
			: zeile.map((wert, i) => {
					// Mit Nachkommastellen: Excel schreibt ein Datum **mit Uhrzeit**
					// als «46023.5». Ohne den Zusatz bliebe es eine Zahl — und die
					// Übernahme meldete wieder, der Beginn fehle.
					if (!datumsspalten.has(i) || !/^\d{5}([.,]\d+)?$/.test(wert)) return wert;
					const tage = Math.floor(Number(wert.replace(',', '.')));
					// 32874 = 01.01.1990, 73415 = 31.12.2100.
					return tage >= 32874 && tage <= 73415 ? ausExcelDatum(tage) : wert;
				})
	);
}

/** Tage seit dem 30.12.1899 als «JJJJ-MM-TT». */
export function ausExcelDatum(tage: number): string {
	// Der 30.12.1899 als Bezugspunkt fängt Excels erfundenen 29.02.1900 mit ab:
	// Für alles ab dem 01.03.1900 stimmt die Rechnung damit.
	const ms = Date.UTC(1899, 11, 30) + tage * 86_400_000;
	return new Date(ms).toISOString().slice(0, 10);
}
