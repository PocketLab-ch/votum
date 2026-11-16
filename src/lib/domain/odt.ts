/**
 * Ein OpenDocument-Text aus Protokolltext — rein, ohne Ablage und ohne Uhr (AD-1).
 *
 * **Warum es das neben dem Word-Dokument gibt** (Auftraggeber, 05.09.2026: «Mach noch
 * eine Odt Variante»). Word ist das Standardformat, weil die Nachbearbeitung
 * ausserhalb stattfindet — aber nicht jede Bewirtschaftung arbeitet mit Word.
 * Wer LibreOffice oder OnlyOffice einsetzt, bekommt hier das Format seines
 * Hauses statt eine Umwandlung, die bei jedem Öffnen anders ausfällt.
 *
 * **Warum wieder von Hand.** Dieselbe Rechnung wie beim `.docx`: ein ZIP mit
 * drei XML-Dateien und der Kennungsdatei `mimetype`, und den ZIP-Schreiber gibt
 * es hier seit dem Versandpaket. Eine Bibliothek brächte eine Abhängigkeit für
 * hundert Zeilen.
 *
 * **Derselbe Text, dieselbe Zerlegung.** Was eine Überschrift, eine Aufzählung
 * oder eine Tabellenzeile ist, entscheidet `protokollauszeichnung.ts` — für
 * beide Bürodokumente dasselbe. Das ist der Grund, weshalb die Word- und die
 * OpenDocument-Ausgabe desselben Protokolls nicht auseinanderlaufen können:
 * Sie unterscheiden sich nur darin, wie sie das Ergebnis aufschreiben.
 *
 * **Die Masse sind aus dem Word-Dokument übernommen** und dort in Zwanzigsteln
 * eines Punktes notiert (`w:spacing w:after="120"`). Hier stehen sie in
 * Zentimetern, weil ODF es so verlangt; die Umrechnung steht bei jedem Wert.
 *
 * **Der `mimetype` ist der erste Eintrag und unverdichtet** — so schreibt es
 * ODF 1.3 §3.3 vor, damit ein Leser das Format an den ersten Bytes erkennt,
 * ohne das Archiv zu öffnen. Unser Packer verdichtet ohnehin nichts; die
 * Reihenfolge ist die einzige Bedingung, die hier von Hand einzuhalten ist.
 */
import { packe, type Dosstempel } from './archiv';
import { zerlegeInBausteine, type Baustein } from './protokollauszeichnung';

/** Was XML nicht wörtlich nehmen darf. */
function xml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Der Inhalt eines Absatzes, mit erhaltenen Leerzeichen.
 *
 * **ODF faltet Leerräume, das Word-Dokument nicht** (aus dem Code-Review,
 * 05.09.2026). Dort trägt jeder Textlauf `xml:space="preserve"`; hier
 * verschwänden ein führendes Leerzeichen und jedes zweite in einer Folge
 * stillschweigend. Gemessen am gesetzten PDF: «Ein Absatz mit  zwei
 * Leerzeichen» wurde einfach, eine eingerückte Zeile verlor ihre Einrückung.
 *
 * Genau diese Abweichung soll es nicht geben, zwei Ausgaben desselben Textes
 * sollen dasselbe zeigen. ODF sieht dafür eigene Marken vor: `<text:s/>` für
 * ein Leerzeichen, `<text:tab/>` für einen Tabulator. Das **erste** Leerzeichen
 * einer Folge bleibt gewöhnlich, damit die Zeile weiterhin dort umbricht.
 */
function inhalt(text: string): string {
	return xml(text)
		.replace(/\t/g, '<text:tab/>')
		/*
		 * Am Absatzanfang zählt **jedes** Leerzeichen als Marke: Dort gäbe es
		 * kein gewöhnliches, das stehen bleiben könnte. Innen bleibt das erste
		 * gewöhnlich, damit die Zeile weiterhin dort umbricht.
		 */
		.replace(/^ +/, (folge) => `<text:s text:c="${folge.length}"/>`)
		.replace(/ {2,}/g, (folge) => ` <text:s text:c="${folge.length - 1}"/>`);
}

const KOPFZEILE = '<?xml version="1.0" encoding="UTF-8"?>';

/** Die Kennung des Formats. Sie steht im `mimetype` und im Verzeichnis. */
export const ODT_MEDIENTYP = 'application/vnd.oasis.opendocument.text';

const NS = [
	'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
	'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
	'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
	'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
	'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'
].join(' ');

const MANIFEST = `${KOPFZEILE}
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MEDIENTYP}" manifest:version="1.3"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

/** Punkt in Zentimeter — ein Punkt ist 1/72 Zoll, ein Zoll 2.54 cm. */
function cm(punkte: number): string {
	return `${((punkte * 2.54) / 72).toFixed(3)}cm`;
}

/**
 * Eine Absatzvorlage.
 *
 * `abstandUnten` und `einzug` kommen in Punkt herein, weil die Werte aus dem
 * Word-Dokument stammen und dort in Punkt gedacht sind.
 */
function vorlage(
	name: string,
	e: {
		groesse: number;
		fett?: boolean;
		abstandOben?: number;
		abstandUnten: number;
		einzug?: number;
		ausrueckung?: number;
		farbe?: string;
		zusammenhalten?: boolean;
	}
): string {
	const absatz =
		`<style:paragraph-properties fo:margin-bottom="${cm(e.abstandUnten)}"` +
		(e.abstandOben ? ` fo:margin-top="${cm(e.abstandOben)}"` : '') +
		(e.einzug ? ` fo:margin-left="${cm(e.einzug)}"` : '') +
		(e.ausrueckung ? ` fo:text-indent="-${cm(e.ausrueckung)}"` : '') +
		(e.zusammenhalten ? ' fo:keep-with-next="always"' : '') +
		'/>';
	const text =
		`<style:text-properties fo:font-size="${e.groesse}pt"` +
		(name === 'Standard' ? ' fo:font-family="Calibri"' : '') +
		(e.fett ? ' fo:font-weight="bold"' : '') +
		(e.farbe ? ` fo:color="#${e.farbe}"` : '') +
		'/>';
	return (
		`<style:style style:name="${name}" style:family="paragraph"` +
		(name === 'Standard' ? '' : ' style:parent-style-name="Standard"') +
		`>${absatz}${text}</style:style>`
	);
}

/**
 * Das Grau der Fusszeile.
 *
 * Derselbe Ton wie im PDF (`server/pdf/basis.ts`, `rgb(0.25, 0.27, 0.3)`) und
 * im Word-Dokument: Die drei Ausgaben desselben Protokolls sollen nebeneinander
 * nicht wie drei verschiedene Dokumente aussehen.
 */
const FUSSGRAU = '40454D';

/**
 * Die Fusszeile auf jedem Blatt.
 *
 * **Die Seitenzahl ist ein Feld, kein Text.** Wie viele Seiten das Dokument
 * hat, weiss erst die Textverarbeitung, wenn sie den Text umbrochen hat; dieser
 * Erzeuger setzt keine Seiten und könnte die Zahl gar nicht kennen. Die Werte
 * zwischen den Marken sind nur das, was ein Leser ohne Feldunterstützung sieht.
 *
 * **Ein leerer Vermerk lässt das Trennzeichen weg**, statt eine Zeile zu
 * erzeugen, die mit einem Mittelpunkt beginnt.
 */
function fusszeilenabsatz(vermerk: string): string {
	const vorspann = vermerk.trim() === '' ? '' : `${xml(vermerk)} · `;
	return (
		'<text:p text:style-name="Footer">' +
		vorspann +
		'Seite <text:page-number text:select-page="current">1</text:page-number>' +
		' von <text:page-count>1</text:page-count>' +
		'</text:p>'
	);
}

/**
 * Die gemeinsamen Vorlagen und das Seitenlayout.
 *
 * **Der Textkörper endet, wo er im Word-Dokument endet** (aus dem Code-Review,
 * 05.09.2026). Die beiden Formate rechnen den unteren Rand verschieden: In Word
 * sitzt die Fusszeile **im** Rand (`w:footer="709"`, also 1.25 cm über dem
 * Blattende), in ODF zehrt sie **vom Textkörper**. Übernimmt man die 2.5 cm
 * unverändert, verliert die Seite 1.1 cm nutzbare Höhe, und derselbe Text
 * bricht früher um; gemessen am gesetzten PDF war das Textende bei 26.1 statt
 * 27.2 cm.
 *
 * Die Rechnung darunter stellt beides gleich: 1.25 cm Rand plus 0.6 cm
 * Fusszeilenhöhe plus 0.65 cm Abstand ergeben die 2.5 cm des Word-Dokuments.
 *
 * **Nachgemessen am gesetzten PDF, nicht gerechnet.** Die Rechnung ging schon
 * beim ersten Anlauf auf, und die Fusszeile stand trotzdem 0.6 cm zu tief:
 * ODF misst ihren Abstand vom Textkörper aus, Word vom Blattrand. Nach der
 * Korrektur steht sie in beiden Ausgaben auf 28.12 cm, und derselbe Text ergibt
 * dieselbe Seitenzahl. Ein Rest bleibt: Bei sechzig Absätzen passt ins
 * OpenDocument eine Zeile mehr auf die Seite. Zwei Umbruchrechnungen werden nie
 * aufs Haar gleich; der systematische Verlust von 1.1 cm je Seite ist weg, und
 * das war der Befund.
 */
function stilteil(vermerk: string): string {
	const vorlagen = [
		vorlage('Standard', { groesse: 11, abstandUnten: 6 }),
		vorlage('Heading_20_1', { groesse: 18, fett: true, abstandOben: 12, abstandUnten: 6, zusammenhalten: true }),
		vorlage('Heading_20_2', { groesse: 14, fett: true, abstandOben: 12, abstandUnten: 6, zusammenhalten: true }),
		vorlage('Heading_20_3', { groesse: 12, fett: true, abstandOben: 12, abstandUnten: 6, zusammenhalten: true }),
		vorlage('Heading_20_4', { groesse: 11, fett: true, abstandOben: 12, abstandUnten: 6, zusammenhalten: true }),
		vorlage('Heading_20_5', { groesse: 11, fett: true, abstandOben: 12, abstandUnten: 6, zusammenhalten: true }),
		vorlage('Heading_20_6', { groesse: 11, fett: true, abstandOben: 12, abstandUnten: 6, zusammenhalten: true }),
		vorlage('Table_20_Contents', { groesse: 11, abstandUnten: 0 }),
		vorlage('List_20_Paragraph', { groesse: 11, abstandUnten: 2, einzug: 18, ausrueckung: 9 }),
		vorlage('Footer', { groesse: 8, abstandUnten: 0, farbe: FUSSGRAU })
	].join('');

	return (
		`${KOPFZEILE}\n<office:document-styles ${NS} office:version="1.3">` +
		`<office:styles>${vorlagen}</office:styles>` +
		'<office:automatic-styles><style:page-layout style:name="pm1">' +
		'<style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"' +
		' style:print-orientation="portrait" fo:margin-top="2.5cm" fo:margin-bottom="1.25cm"' +
		' fo:margin-left="2.5cm" fo:margin-right="2cm"/>' +
		'<style:footer-style><style:header-footer-properties fo:min-height="0.6cm"' +
		' fo:margin-top="0.65cm"/></style:footer-style>' +
		'</style:page-layout></office:automatic-styles>' +
		'<office:master-styles><style:master-page style:name="Standard"' +
		' style:page-layout-name="pm1">' +
		`<style:footer>${fusszeilenabsatz(vermerk)}</style:footer>` +
		'</style:master-page></office:master-styles>' +
		'</office:document-styles>'
	);
}

/**
 * Die Spaltenbreiten der Kopftabelle.
 *
 * Der Satzspiegel ist 16.5 cm breit (21 − 2.5 − 2). Das Verhältnis ist dasselbe
 * wie im Word-Dokument (2600 zu 6754 Zwanzigstelpunkte): kurze Bezeichnungen
 * links an einer festen Kante, wechselnd lange Werte rechts.
 */
const SPALTEN = ['4.588cm', '11.912cm'];

const TABELLENSTILE =
	'<style:style style:name="Kopf" style:family="table">' +
	'<style:table-properties style:width="16.5cm" table:align="margins"/></style:style>' +
	SPALTEN.map(
		(breite, i) =>
			`<style:style style:name="Kopf.${i === 0 ? 'A' : 'B'}" style:family="table-column">` +
			`<style:table-column-properties style:column-width="${breite}"/></style:style>`
	).join('') +
	'<style:style style:name="Kopf.Z" style:family="table-cell">' +
	'<style:table-cell-properties fo:border="0.02cm solid #D8D8D2"' +
	' fo:padding-top="0.106cm" fo:padding-bottom="0.106cm"' +
	' fo:padding-left="0.191cm" fo:padding-right="0.191cm"/></style:style>';

function absatz(text: string, stil: string): string {
	if (text.length === 0) return `<text:p text:style-name="${stil}"/>`;
	return `<text:p text:style-name="${stil}">${inhalt(text)}</text:p>`;
}

/**
 * Zusammenhängende Tabellenzeilen als **eine** Tabelle.
 *
 * `table:name` muss im Dokument eindeutig sein, deshalb die laufende Nummer.
 * Zwei Tabellen mit demselben Namen öffnet LibreOffice zwar, benennt aber eine
 * davon still um — und ein Dokument, das sich beim Öffnen ändert, ist kein
 * verlässlicher Nachweis.
 */
function tabelle(zeilen: readonly [string, string][], nummer: number): string {
	const zelle = (inhalt: string) =>
		'<table:table-cell table:style-name="Kopf.Z" office:value-type="string">' +
		absatz(inhalt, 'Table_20_Contents') +
		'</table:table-cell>';
	const koerper = zeilen
		.map(([links, rechts]) => `<table:table-row>${zelle(links)}${zelle(rechts)}</table:table-row>`)
		.join('');
	return (
		`<table:table table:name="Kopf${nummer}" table:style-name="Kopf">` +
		'<table:table-column table:style-name="Kopf.A"/>' +
		'<table:table-column table:style-name="Kopf.B"/>' +
		`${koerper}</table:table>`
	);
}

function setze(baustein: Baustein, nummer: number): string {
	switch (baustein.art) {
		case 'ueberschrift':
			return (
				`<text:h text:style-name="Heading_20_${baustein.stufe}"` +
				` text:outline-level="${baustein.stufe}">${inhalt(baustein.text)}</text:h>`
			);
		case 'liste':
			// Der Gedankenstrich bleibt sichtbar, wie im Word-Dokument: Eine echte
			// ODF-Liste brächte eine eigene Nummerierungsmechanik für ein Zeichen.
			return absatz(`– ${baustein.text}`, 'List_20_Paragraph');
		case 'tabelle':
			return tabelle(baustein.zeilen, nummer);
		case 'leerabsatz':
			return absatz('', 'Standard');
		default:
			return absatz(baustein.text, 'Standard');
	}
}

/**
 * Baut ein `.odt` aus dem Protokolltext.
 *
 * Der Zeitstempel kommt von aussen (AD-1). Zwei gleiche Texte mit demselben
 * Stempel ergeben dieselben Bytes — die Voraussetzung dafür, dass sich eine
 * Ausgabe später mit ihrer Prüfsumme wiederfinden lässt.
 *
 * @param fusszeile Der Vermerk auf jedem Blatt — Gemeinschaft, Versammlung,
 *   Stand. Ein Pflichtparameter wie beim Word-Dokument.
 */
export function alsOpenDocument(
	text: string,
	zeitpunkt: Dosstempel,
	fusszeile: string
): Uint8Array {
	let tabellen = 0;
	const koerper = zerlegeInBausteine(text)
		.map((b) => setze(b, b.art === 'tabelle' ? ++tabellen : 0))
		.join('');

	const inhalt =
		`${KOPFZEILE}\n<office:document-content ${NS} office:version="1.3">` +
		`<office:automatic-styles>${TABELLENSTILE}</office:automatic-styles>` +
		`<office:body><office:text>${koerper}</office:text></office:body>` +
		'</office:document-content>';

	const kodierer = new TextEncoder();
	return packe(
		[
			/*
			 * **Der `mimetype` steht zuerst und unverdichtet** (ODF 1.3 §3.3).
			 * Sein Inhalt ist genau die Kennung, ohne Zeilenumbruch: Wer ein Byte
			 * anhängt, liefert eine Datei, die manches Werkzeug nicht mehr als
			 * OpenDocument erkennt.
			 */
			{ name: 'mimetype', inhalt: kodierer.encode(ODT_MEDIENTYP) },
			{ name: 'META-INF/manifest.xml', inhalt: kodierer.encode(MANIFEST) },
			{ name: 'styles.xml', inhalt: kodierer.encode(stilteil(fusszeile)) },
			{ name: 'content.xml', inhalt: kodierer.encode(inhalt) }
		],
		zeitpunkt
	);
}
