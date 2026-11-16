/**
 * Ein Word-Dokument aus Text — rein, ohne Ablage und ohne Uhr (AD-1).
 *
 * **Warum von Hand und nicht mit einer Bibliothek.** Ein `.docx` ist ein
 * ZIP-Archiv mit ein paar XML-Dateien; den ZIP-Schreiber gibt es hier seit dem
 * Versandpaket (`archiv.ts`). Was übrig bleibt, sind vier kleine Dokumente nach
 * ECMA-376. Eine Bibliothek dafür brächte eine Abhängigkeit für etwas, das
 * hundert Zeilen kostet — und mit ihr die Frage, was sie beim nächsten
 * Sicherheitsdurchgang mitbringt.
 *
 * **Warum Word das Standardformat ist** (FR-49): Die Nachbearbeitung findet
 * ausserhalb statt. Ein PDF, das man nicht mehr ändern kann, wäre für einen
 * Protokollentwurf das falsche Werkzeug; das Siegel liegt ohnehin nicht auf dem
 * Protokoll (PRD §4.11).
 *
 * **Was hineingeht:** der Text aus `protokoll.ts` mit seiner winzigen
 * Auszeichnung. Erkannt und zerlegt wird sie in `protokollauszeichnung.ts`,
 * gemeinsam mit dem PDF — die Erkennung stand vorher zweimal im Haus, mit
 * Kommentaren, die ihre Gleichheit behaupteten. Kein Fettdruck, keine Bilder:
 * Wer mehr braucht, hat jetzt ein Word-Dokument und ist damit besser bedient
 * als mit einer halben Textverarbeitung hier.
 *
 * **Die Tabelle kam am 03.09.2026 dazu** (Auftraggeber, mit einer Word-Vorlage:
 * «Struktur im Sinne von hier»). Sie trägt den Kopf des Protokolls: Bezeichnung
 * links, Wert rechts. Zwei Spalten, keine Kopfzeile — mehr kann diese
 * Auszeichnung nicht, und mehr braucht ein Protokollkopf nicht.
 *
 * **Die Fusszeile kam am 05.09.2026 dazu.** Bis dahin trug sie allein das PDF,
 * und die Sichtprobe vom Vortag hatte das als Lücke festgehalten: Wer die
 * dritte Seite eines ausgedruckten Word-Protokolls in der Hand hält, konnte
 * nicht sehen, aus welcher Fassung sie stammt. Beide Ausgaben tragen jetzt
 * denselben Satz.
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

const KOPFZEILE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES = `${KOPFZEILE}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

const RELS = `${KOPFZEILE}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Die Kennung der Fusszeile. Sie steht hier und in `<w:footerReference>`. */
const FUSS_ID = 'rId2';

const DOKUMENT_RELS = `${KOPFZEILE}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="${FUSS_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

/**
 * Die Formatvorlagen.
 *
 * Nur so viele, wie der Text kennt. Word setzt die Überschriften damit ins
 * Inhaltsverzeichnis, und wer das Dokument weiterbearbeitet, findet die
 * gewohnten Namen vor — statt handgesetzter Schriftgrössen, die sich beim
 * ersten Umformatieren rächen.
 */
function ueberschriftsvorlage(stufe: number, groesse: number): string {
	return (
		`<w:style w:type="paragraph" w:styleId="berschrift${stufe}">` +
		`<w:name w:val="heading ${stufe}"/><w:basedOn w:val="Standard"/>` +
		'<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>' +
		`<w:outlineLvl w:val="${stufe - 1}"/></w:pPr>` +
		`<w:rPr><w:b/><w:sz w:val="${groesse}"/></w:rPr></w:style>`
	);
}

/**
 * Das Grau der Fusszeile.
 *
 * Derselbe Ton wie im PDF (`server/pdf/basis.ts`, `rgb(0.25, 0.27, 0.3)`): Die
 * beiden Ausgaben desselben Protokolls sollen nebeneinander nicht wie zwei
 * verschiedene Dokumente aussehen.
 */
const FUSSGRAU = '40454D';

const STYLES = `${KOPFZEILE}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
${ueberschriftsvorlage(1, 36)}
${ueberschriftsvorlage(2, 28)}
${ueberschriftsvorlage(3, 24)}
${ueberschriftsvorlage(4, 22)}
${ueberschriftsvorlage(5, 22)}
${ueberschriftsvorlage(6, 22)}
<w:style w:type="paragraph" w:styleId="Tabellenzelle"><w:name w:val="Table Cell"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Listenabsatz"><w:name w:val="List Paragraph"/><w:basedOn w:val="Standard"/><w:pPr><w:ind w:left="360" w:hanging="180"/><w:spacing w:after="40"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Fusszeile"><w:name w:val="footer"/><w:basedOn w:val="Standard"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="16"/><w:color w:val="${FUSSGRAU}"/></w:rPr></w:style>
</w:styles>`;

function absatz(text: string, vorlage?: string): string {
	const pPr = vorlage ? `<w:pPr><w:pStyle w:val="${vorlage}"/></w:pPr>` : '';
	if (text.length === 0) return `<w:p>${pPr}</w:p>`;
	return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

/**
 * Die Fusszeile auf jedem Blatt.
 *
 * **Die Seitenzahl ist ein Feld, kein Text** (`PAGE` und `NUMPAGES`). Sie muss
 * es sein: Wie viele Seiten das Dokument hat, weiss erst die Textverarbeitung,
 * wenn sie den Text umbrochen hat — dieser Erzeuger setzt keine Seiten und
 * könnte die Zahl gar nicht kennen. Der Wert zwischen den Feldmarken ist nur
 * das, was ein Leser ohne Feldunterstützung sieht.
 *
 * **Ein leerer Vermerk lässt das Trennzeichen weg**, statt eine Zeile zu
 * erzeugen, die mit einem Mittelpunkt beginnt.
 */
function fusszeilenteil(vermerk: string): string {
	const lauf = (text: string) => `<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
	const feld = (name: string, ersatz: string) =>
		`<w:fldSimple w:instr=" ${name} "><w:r><w:t>${ersatz}</w:t></w:r></w:fldSimple>`;
	const vorspann = vermerk.trim() === '' ? '' : lauf(`${vermerk} · `);
	return (
		`${KOPFZEILE}\n` +
		'<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
		'<w:p><w:pPr><w:pStyle w:val="Fusszeile"/></w:pPr>' +
		vorspann +
		lauf('Seite ') +
		feld('PAGE', '1') +
		lauf(' von ') +
		feld('NUMPAGES', '1') +
		'</w:p></w:ftr>'
	);
}

/**
 * Zusammenhängende Tabellenzeilen als **eine** Word-Tabelle.
 *
 * `w:tblW` auf 100 %, die erste Spalte fest: Der Kopf eines Protokolls hat
 * kurze Bezeichnungen links und wechselnd lange Werte rechts — eine
 * gleichmässige Teilung liesse die Bezeichnungsspalte halb leer und den Wert
 * umbrechen.
 */
function tabelle(zeilen: readonly [string, string][]): string {
	const raender =
		'<w:tblBorders>' +
		['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
			.map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="D8D8D2"/>`)
			.join('') +
		'</w:tblBorders>';
	const kopf =
		'<w:tblPr><w:tblW w:w="5000" w:type="pct"/>' +
		/*
		 * **Die Reihenfolge ist vorgeschrieben** (aus dem Code-Review):
		 * `CT_TblPrBase` ist eine Sequenz, `tblBorders` steht vor `tblLayout`,
		 * dieses vor `tblCellMar`. Wer sie vertauscht, bekommt von Word beim
		 * Öffnen «unlesbarer Inhalt» oder eine stille Reparatur, die die
		 * Tabelleneigenschaften verwirft.
		 *
		 * Ohne `fixed` rechnet Word die Spalten nach Inhalt neu — die feste linke
		 * Spalte wäre dann nur eine Bitte.
		 */
		raender +
		'<w:tblLayout w:type="fixed"/>' +
		'<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
		'<w:bottom w:w="60" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>' +
		'</w:tblPr><w:tblGrid><w:gridCol w:w="2600"/><w:gridCol w:w="6754"/></w:tblGrid>';

	const koerper = zeilen
		.map(([links, rechts]) => {
			const zelle = (inhalt: string, breite: number) =>
				`<w:tc><w:tcPr><w:tcW w:w="${breite}" w:type="dxa"/></w:tcPr>` +
				absatz(inhalt, 'Tabellenzelle') +
				'</w:tc>';
			return `<w:tr>${zelle(links, 2600)}${zelle(rechts, 6754)}</w:tr>`;
		})
		.join('');

	return `<w:tbl>${kopf}${koerper}</w:tbl>`;
}

function setze(baustein: Baustein): string {
	switch (baustein.art) {
		case 'ueberschrift':
			return absatz(baustein.text, `berschrift${baustein.stufe}`);
		case 'liste':
			// Der Gedankenstrich bleibt sichtbar: Ohne Nummerierungsteil kennt Word
			// keinen Aufzählungspunkt, und ein eingerückter Absatz ohne Zeichen sähe
			// nach einem Fehler aus.
			return absatz(`– ${baustein.text}`, 'Listenabsatz');
		case 'tabelle':
			return tabelle(baustein.zeilen);
		case 'leerabsatz':
			return absatz('');
		default:
			return absatz(baustein.text);
	}
}

/**
 * Baut ein `.docx` aus dem Protokolltext.
 *
 * Der Zeitstempel kommt von aussen (AD-1). Zwei gleiche Texte mit demselben
 * Stempel ergeben dieselben Bytes — das ist nicht Ordnungsliebe, sondern die
 * Voraussetzung dafür, dass sich eine Ausgabe später mit ihrer Prüfsumme
 * wiederfinden lässt.
 *
 * @param fusszeile Der Vermerk auf jedem Blatt — Gemeinschaft, Versammlung,
 *   Stand. **Ein Pflichtparameter, kein Vorgabewert:** Wer eine neue Ausgabe
 *   baut, soll die Frage «was steht auf Seite drei?» beantworten müssen, statt
 *   sie still mit einer leeren Zeile zu beantworten.
 */
export function alsWorddokument(
	text: string,
	zeitpunkt: Dosstempel,
	fusszeile: string
): Uint8Array {
	const absaetze = zerlegeInBausteine(text).map(setze).join('');
	const dokument =
		`${KOPFZEILE}\n` +
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
		' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
		`<w:body>${absaetze}` +
		/*
		 * **Die Fusszeile steht am Anfang von `sectPr`** (ECMA-376,
		 * `CT_SectPr`): Die Verweise auf Kopf- und Fusszeilen bilden dort die
		 * erste Gruppe, vor `pgSz` und `pgMar`. Dieselbe Falle wie bei `tblPr` —
		 * eine vertauschte Sequenz quittiert Word mit «unlesbarer Inhalt» oder
		 * einer stillen Reparatur, die den Verweis verwirft. Dass die Fusszeile
		 * dann fehlt, sähe man erst am Ausdruck.
		 */
		`<w:sectPr><w:footerReference w:type="default" r:id="${FUSS_ID}"/>` +
		'<w:pgSz w:w="11906" w:h="16838"/>' +
		'<w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1418"' +
		' w:footer="709"/></w:sectPr>' +
		'</w:body></w:document>';

	const kodierer = new TextEncoder();
	return packe(
		[
			{ name: '[Content_Types].xml', inhalt: kodierer.encode(CONTENT_TYPES) },
			{ name: '_rels/.rels', inhalt: kodierer.encode(RELS) },
			{
				name: 'word/_rels/document.xml.rels',
				inhalt: kodierer.encode(DOKUMENT_RELS)
			},
			{ name: 'word/styles.xml', inhalt: kodierer.encode(STYLES) },
			{ name: 'word/footer1.xml', inhalt: kodierer.encode(fusszeilenteil(fusszeile)) },
			{ name: 'word/document.xml', inhalt: kodierer.encode(dokument) }
		],
		zeitpunkt
	);
}
