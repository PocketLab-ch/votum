/**
 * Eine Excel-Arbeitsmappe aus Zellen — rein, ohne Ablage und ohne Uhr (AD-1).
 *
 * **Warum von Hand und nicht mit einer Bibliothek.** Wie beim Word-Dokument
 * (`docx.ts`): Ein `.xlsx` ist ein ZIP-Archiv mit ein paar XML-Dateien, den
 * ZIP-Schreiber gibt es hier seit dem Versandpaket (`archiv.ts`). Was übrig
 * bleibt, sind vier kleine Dokumente nach ECMA-376. Eine Bibliothek dafür
 * brächte eine Abhängigkeit für etwas, das zweihundert Zeilen kostet — und mit
 * ihr die Frage, was sie beim nächsten Sicherheitsdurchgang mitbringt.
 *
 * **Warum Formeln und keine ausgerechneten Zahlen.** Die Mappe ist der
 * Ausweichplan für den Ausfall: Dort werden Stimmen **eingetippt**, und die
 * Summen müssen sich dabei mitbewegen. Formeln stehen im Dokument in ihrer
 * englischen Grundform (`SUMIF`); Excel und LibreOffice zeigen sie in der
 * Sprache der Oberfläche an. Das ist genau der Grund, weshalb hier ein `.xlsx`
 * entsteht und keine CSV-Datei: In einer CSV müssten die Formeln in der
 * Landessprache stehen, und `SUMMEWENN` in einem englischen Excel ist ein
 * Textfeld.
 *
 * **`fullCalcOnLoad`** sagt der Tabellenkalkulation, dass sie beim Öffnen alles
 * neu rechnen soll. Ohne das stünden die Ergebniszellen leer, bis jemand eine
 * Eingabe macht — und wer eine leere Ergebnisspalte sieht, hält die Datei für
 * kaputt.
 *
 * ## In einer echten Tabellenkalkulation gerechnet — seit 05.09.2026
 *
 * Bis dahin stand hier, das sei offen, und der Grund war banal: Auf dem
 * Arbeitsrechner lag LibreOffice **ohne Calc**, und `soffice --convert-to csv`
 * scheiterte deshalb an jeder xlsx-Datei mit der nichtssagenden Meldung «source
 * file could not be loaded». Mit `libreoffice-calc-nogui` (Auftraggeber, 05.09.2026)
 * ist das erledigt.
 *
 * `scripts/mappe-nachrechnen.mjs` baut die Mappe, trägt Stimmen ein, lässt
 * Calc rechnen und hält jede Zeile gegen `zaehleAus` (Stand und Zahl der
 * Werte in `docs/bauweise.md`, «Auszählmappe»). Damit sind `fullCalcOnLoad`,
 * `SUMIF`, `SUMIFS`, `INT`, `CEILING` und die `IF`-Ketten für «erreicht» und
 * «Ergebnis» belegt — nicht mehr nur der Aufbau.
 *
 * **Was weiterhin offen ist:** Excel. Geprüft ist LibreOffice; dass der Auftraggeber die
 * Mappe dort öffnen kann, ist seit dem 20.08.2026 bestätigt, aber die Zahlen
 * hat dort niemand nachgerechnet. Und `ROUND(…,6)` in `schwellenformel` bleibt
 * unbelegt: Der Fall, gegen den es steht, tritt in Calc nicht ein (siehe dort).
 */
import { packe, type Dosstempel } from './archiv';

/** Was XML nicht wörtlich nehmen darf. */
function xml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Die Gestalten, die es hier gibt — bewusst wenige.
 *
 * Eine Mappe, die im Ausfall benutzt wird, muss auf einen Blick sagen, wo
 * getippt wird und wo gerechnet. Mehr Gestalten hiessen mehr Entscheidungen bei
 * jemandem, der gerade andere Sorgen hat.
 */
export type Stil = 'normal' | 'fett' | 'titel' | 'kopf' | 'eingabe' | 'leise';

const STILNUMMER: Record<Stil, number> = {
	normal: 0,
	fett: 1,
	titel: 2,
	kopf: 3,
	eingabe: 4,
	leise: 5
};

export type Zelle =
	| { art: 'text'; wert: string; stil?: Stil }
	| { art: 'zahl'; wert: number; stil?: Stil }
	/** Ohne führendes Gleichzeichen: `SUMIF(A1:A9;1;B1:B9)` steht als `SUMIF(A1:A9,1,B1:B9)`. */
	| { art: 'formel'; formel: string; stil?: Stil }
	| { art: 'leer'; stil?: Stil };

export interface Blatt {
	/** Der Name auf dem Reiter. Höchstens 31 Zeichen, ohne `[]:*?/\`. */
	name: string;
	/** Spaltenbreiten in Zeichen, von links. Fehlende Angaben bleiben Vorgabe. */
	breiten?: number[];
	zeilen: Zelle[][];
}

/**
 * Der Spaltenname zu einem Index: 0 → `A`, 25 → `Z`, 26 → `AA`.
 *
 * Nicht bloss Bequemlichkeit: Eine Versammlung mit mehr als 26 abstimmbaren
 * Traktanden ist selten, aber nicht ausgeschlossen — und eine Mappe, die dort
 * still falsche Formeln schriebe, fiele erst im Saal auf.
 */
export function spaltenname(index: number): string {
	let rest = index;
	let name = '';
	do {
		name = String.fromCharCode(65 + (rest % 26)) + name;
		rest = Math.floor(rest / 26) - 1;
	} while (rest >= 0);
	return name;
}

const KOPFZEILE = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES = `${KOPFZEILE}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
{BLATTARTEN}
</Types>`;

const RELS = `${KOPFZEILE}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

/**
 * Die Gestalten als Dokument.
 *
 * Die Farben sind bewusst blass: Die Mappe wird ausgedruckt, oft in Graustufen,
 * und ein kräftiger Ton wird dort zu einem grauen Balken über der Eingabe.
 */
const STYLES = `${KOPFZEILE}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF6B6B6B"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDE4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D5"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function stilmerkmal(stil: Stil | undefined): string {
	if (!stil || stil === 'normal') return '';
	return ` s="${STILNUMMER[stil]}"`;
}

function zelle(z: Zelle, spalte: number, zeile: number): string {
	const bezug = `${spaltenname(spalte)}${zeile}`;
	const s = stilmerkmal(z.stil);
	switch (z.art) {
		case 'text':
			// `xml:space="preserve"`, damit führende Leerzeichen einer Einrückung
			// nicht verschwinden.
			return `<c r="${bezug}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(z.wert)}</t></is></c>`;
		case 'zahl':
			return `<c r="${bezug}"${s}><v>${z.wert}</v></c>`;
		case 'formel':
			// Ohne zwischengespeicherten Wert: `fullCalcOnLoad` rechnet beim Öffnen.
			return `<c r="${bezug}"${s}><f>${xml(z.formel)}</f></c>`;
		case 'leer':
			return s ? `<c r="${bezug}"${s}/>` : '';
	}
}

function blattXml(blatt: Blatt): string {
	const spalten =
		blatt.breiten && blatt.breiten.length > 0
			? '<cols>' +
				blatt.breiten
					.map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`)
					.join('') +
				'</cols>'
			: '';

	const zeilen = blatt.zeilen
		.map((z, i) => {
			const inhalt = z.map((c, j) => zelle(c, j, i + 1)).join('');
			return inhalt.length > 0 ? `<row r="${i + 1}">${inhalt}</row>` : '';
		})
		.join('');

	return (
		`${KOPFZEILE}\n` +
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
		`${spalten}<sheetData>${zeilen}</sheetData></worksheet>`
	);
}

/**
 * Baut die Mappe.
 *
 * Der Zeitstempel kommt von aussen (AD-1). Zwei gleiche Mappen mit demselben
 * Stempel ergeben dieselben Bytes — die Voraussetzung dafür, dass sich eine
 * Ausgabe später mit ihrer Prüfsumme wiederfinden lässt.
 */
export function alsArbeitsmappe(blaetter: readonly Blatt[], zeitpunkt: Dosstempel): Uint8Array {
	if (blaetter.length === 0) {
		throw new RangeError('Eine Arbeitsmappe ohne Blatt liesse sich nicht öffnen.');
	}

	const kodierer = new TextEncoder();
	const blattarten = blaetter
		.map(
			(_, i) =>
				`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
				'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
		)
		.join('\n');

	const sheets = blaetter
		.map((b, i) => `<sheet name="${xml(b.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
		.join('');

	const workbook =
		`${KOPFZEILE}\n` +
		'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
		'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
		`<sheets>${sheets}</sheets>` +
		'<calcPr calcId="0" fullCalcOnLoad="1"/>' +
		'</workbook>';

	const workbookRels =
		`${KOPFZEILE}\n` +
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
		blaetter
			.map(
				(_, i) =>
					`<Relationship Id="rId${i + 1}" ` +
					'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
					`Target="worksheets/sheet${i + 1}.xml"/>`
			)
			.join('') +
		`<Relationship Id="rId${blaetter.length + 1}" ` +
		'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ' +
		'Target="styles.xml"/>' +
		'</Relationships>';

	return packe(
		[
			{
				name: '[Content_Types].xml',
				inhalt: kodierer.encode(CONTENT_TYPES.replace('{BLATTARTEN}', blattarten))
			},
			{ name: '_rels/.rels', inhalt: kodierer.encode(RELS) },
			{ name: 'xl/workbook.xml', inhalt: kodierer.encode(workbook) },
			{ name: 'xl/_rels/workbook.xml.rels', inhalt: kodierer.encode(workbookRels) },
			{ name: 'xl/styles.xml', inhalt: kodierer.encode(STYLES) },
			...blaetter.map((b, i) => ({
				name: `xl/worksheets/sheet${i + 1}.xml`,
				inhalt: kodierer.encode(blattXml(b))
			}))
		],
		zeitpunkt
	);
}
