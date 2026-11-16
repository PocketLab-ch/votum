/**
 * Eine Excel-Arbeitsmappe lesen.
 *
 * **Geprüft wird gegen eine echte Mappe**, nicht gegen von Hand geschriebenes
 * XML: `alsArbeitsmappe` aus `domain/xlsx.ts` schreibt eine, `packe` aus
 * `domain/archiv.ts` legt sie ins ZIP, und der Leser nimmt sie wieder
 * auseinander. Eine Abschrift des XML zu prüfen bewiese nur, dass die Abschrift
 * gelesen wird — genau die Falle, wegen der das Aufräumskript eine eigene
 * Ausführung bekam.
 *
 * Der Weg zurück ist damit auch ein Beweis für den Hinweg: Was das Werkzeug
 * schreibt, liest es wieder.
 */
import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { alsArbeitsmappe } from '$lib/domain/xlsx';
import { dosZeitstempel, packe } from '$lib/domain/archiv';
import { MappenFehler, spaltenNummer, zeilenAusMappe } from '$lib/domain/xlsxlesen';

const STEMPEL = dosZeitstempel('2026-08-25T12:00:00.000Z');

/**
 * Der ZIP-Entpacker des Prüfwerkzeugs, hier nachgebaut.
 *
 * Nicht eingebunden, weil er in `server/` liegt und der Kern nichts aus der
 * Aussenwelt kennen darf (AD-1). Für den Test genügt der einfache Fall: Was
 * `packe` schreibt, ist unverdichtet gespeichert.
 */
function entpacke(archiv: Uint8Array): Map<string, Uint8Array> {
	const sicht = new DataView(archiv.buffer, archiv.byteOffset, archiv.byteLength);
	const u32 = (i: number) => sicht.getUint32(i, true);
	const u16 = (i: number) => sicht.getUint16(i, true);

	let ende = -1;
	for (let i = archiv.length - 22; i >= 0; i--) {
		if (u32(i) === 0x06054b50) {
			ende = i;
			break;
		}
	}
	expect(ende).toBeGreaterThanOrEqual(0);

	const anzahl = u16(ende + 10);
	let stelle = u32(ende + 16);
	const namen = new TextDecoder();
	const aus = new Map<string, Uint8Array>();

	for (let n = 0; n < anzahl; n++) {
		const verfahren = u16(stelle + 10);
		const gepackt = u32(stelle + 20);
		const namenslaenge = u16(stelle + 28);
		const zusatz = u16(stelle + 30);
		const kommentar = u16(stelle + 32);
		const kopfstelle = u32(stelle + 42);
		const name = namen.decode(archiv.subarray(stelle + 46, stelle + 46 + namenslaenge));

		const nl = u16(kopfstelle + 26);
		const el = u16(kopfstelle + 28);
		const beginn = kopfstelle + 30 + nl + el;
		const roh = archiv.subarray(beginn, beginn + gepackt);
		aus.set(name, verfahren === 0 ? new Uint8Array(roh) : new Uint8Array(inflateRawSync(roh)));

		stelle += 46 + namenslaenge + zusatz + kommentar;
	}
	return aus;
}

function mappe(zeilen: (string | number)[][]): Map<string, Uint8Array> {
	const bytes = alsArbeitsmappe(
		[
			{
				name: 'Blatt',
				zeilen: zeilen.map((z) =>
					z.map((w) =>
						typeof w === 'number'
							? ({ art: 'zahl', wert: w } as const)
							: w === ''
								? ({ art: 'leer' } as const)
								: ({ art: 'text', wert: String(w) } as const)
					)
				)
			}
		],
		STEMPEL
	);
	return entpacke(bytes);
}

describe('Spaltenadressen', () => {
	it('rechnet Buchstaben in Nummern um', () => {
		expect(spaltenNummer('A1')).toBe(1);
		expect(spaltenNummer('B7')).toBe(2);
		expect(spaltenNummer('Z3')).toBe(26);
		expect(spaltenNummer('AA1')).toBe(27);
		expect(spaltenNummer('AB12')).toBe(28);
	});
});

describe('Eine Arbeitsmappe lesen', () => {
	it('liest Kopfzeile und Werte einer selbst geschriebenen Mappe', () => {
		const gelesen = zeilenAusMappe(
			mappe([
				['voter_ref', 'display_name', 'quote'],
				['A-1', 'Renate Berger', 400],
				['A-2', 'Peter Kunz', 600]
			])
		);

		expect(gelesen).toHaveLength(3);
		expect(gelesen[0]).toEqual(['voter_ref', 'display_name', 'quote']);
		expect(gelesen[1][1]).toBe('Renate Berger');
		expect(gelesen[2][2]).toBe('600');
	});

	it('hält die Spalten, wenn eine Zelle leer bleibt', () => {
		/*
		 * **Der eigentliche Grund für die Adressrechnung.** Excel lässt leere
		 * Zellen weg. Wer die `<c>`-Elemente der Reihe nach einsammelt, verschiebt
		 * ab der ersten Lücke jede Spalte um eins — und merkt es erst, wenn die
		 * Wertquote im Feld für die Adresse steht.
		 */
		const gelesen = zeilenAusMappe(
			mappe([
				['voter_ref', 'email', 'quote'],
				['A-1', '', 400]
			])
		);
		expect(gelesen[1]).toEqual(['A-1', '', '400']);
	});

	it('setzt zerlegte Texte wieder zusammen und löst Ersatzdarstellungen auf', () => {
		const gelesen = zeilenAusMappe(
			mappe([
				['name'],
				['Müller & Söhne <AG>'],
				['Anführung: "so"']
			])
		);
		expect(gelesen[1][0]).toBe('Müller & Söhne <AG>');
		expect(gelesen[2][0]).toBe('Anführung: "so"');
	});

	/*
	 * **Der Fall, für den der Test darüber geschrieben war — und den er nicht
	 * traf** (25.08.2026, aus der Prüfung). `mappe()` bildet `''` auf eine leere
	 * Zelle **ohne Stil** ab, und dafür schreibt `xlsx.ts` gar nichts. Der Test
	 * lief grün, ohne je ein selbstschliessendes `<c/>` zu sehen.
	 *
	 * Genau diese Form erzeugt der eigene Schreiber für jede formatierte
	 * Leerzelle (`auszaehlmappe.ts`), und die erste Fassung des Lesers nahm sie
	 * als Anfangsmarke: Sie suchte das nächste `</c>` — das der Folgezelle
	 * gehörte, die damit verschwand. Von drei Zellen kamen zwei an.
	 */
	it('verschluckt die Folgezelle nicht, wenn eine Zelle sich selbst schliesst', () => {
		const bytes = alsArbeitsmappe(
			[
				{
					name: 'Blatt',
					zeilen: [
						[
							{ art: 'text', wert: 'voter_ref' },
							{ art: 'leer', stil: 'kopf' },
							{ art: 'text', wert: 'display_name' }
						],
						[
							{ art: 'text', wert: 'A-1' },
							{ art: 'leer', stil: 'kopf' },
							{ art: 'text', wert: 'Renate Berger' }
						]
					]
				}
			],
			STEMPEL
		);
		const gelesen = zeilenAusMappe(entpacke(bytes));
		expect(gelesen[0]).toEqual(['voter_ref', '', 'display_name']);
		expect(gelesen[1]).toEqual(['A-1', '', 'Renate Berger']);
	});

	it('bricht bei einer erfundenen Zeilennummer nicht den Prozess ab', () => {
		/*
		 * `<row r="20000000">` liess die Auffüllschleife laufen: 146 Byte, und
		 * der Node-Prozess stirbt am Speicher — mitsamt der laufenden Versammlung.
		 * Jetzt wird die Zeile übersprungen oder abgesagt, je nach Grösse.
		 */
		const bauen = (r: string) =>
			new Map([
				[
					'xl/worksheets/sheet1.xml',
					new TextEncoder().encode(
						`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>kopf</t></is></c></row>` +
							`<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>weit weg</t></is></c></row>` +
							`</sheetData></worksheet>`
					)
				]
			]);

		// Weit über Excels letzter Zeile: übersprungen, ohne dass etwas wächst.
		const gelesen = zeilenAusMappe(bauen('20000000'));
		expect(gelesen).toHaveLength(1);

		// Innerhalb von Excel, aber jenseits dessen, was hier verarbeitet wird.
		expect(() => zeilenAusMappe(bauen('900000'))).toThrow(/Zeilen/);
	});

	it('hängt sich an einem unvollständigen Element nicht auf', () => {
		/*
		 * `<si>` ohne `</si>` liess den alten Ausdruck von jedem Anfangspunkt bis
		 * zum Dateiende suchen — quadratisch und synchron. Gemessen: 886 Byte
		 * blockierten den Prozess neun Sekunden.
		 */
		const kaputt = '<sst>' + '<si><t>x</t>'.repeat(20000);
		const dateien = new Map([
			['xl/sharedStrings.xml', new TextEncoder().encode(kaputt)],
			[
				'xl/worksheets/sheet1.xml',
				new TextEncoder().encode(
					'<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'
				)
			]
		]);

		const beginn = performance.now();
		const gelesen = zeilenAusMappe(dateien);
		const gebraucht = performance.now() - beginn;

		/*
		 * **Geprüft wird, dass es aufhört** — nicht, was herauskommt. Bei einer
		 * Datei ohne Schlussmarken gehört alles bis zum Ende zum ersten Eintrag,
		 * und das ist die richtige Auslegung: Lieber ein unsinniger Wert als ein
		 * Prozess, der steht. Die alte Fassung brauchte für dieselbe Eingabe
		 * Sekunden und wuchs quadratisch.
		 */
		expect(gelesen).toHaveLength(1);
		expect(gebraucht).toBeLessThan(1000);
	});

	it('rechnet Excel-Datumszahlen in Datumsspalten zurück', () => {
		/*
		 * Excel speichert ein Datum als Tage seit dem 30.12.1899 und merkt sich
		 * das Aussehen im Format. Ohne Umrechnung meldete die Übernahme «Zur
		 * Nutzniessung fehlt der Beginn im Format JJJJ-MM-TT» — er fehlte nicht,
		 * er stand als «46023» da.
		 */
		const gelesen = zeilenAusMappe(
			mappe([
				['unit_ref', 'usufruct_from', 'quote'],
				['A-1', 46023, 40000]
			])
		);
		expect(gelesen[1][1]).toBe('2026-01-01');
		// **Die Wertquote bleibt eine Zahl** — umgerechnet wird nur in
		// Datumsspalten, sonst würde aus 40000 der 24.07.2009.
		expect(gelesen[1][2]).toBe('40000');
	});

	it('liest auch den Weg über die gemeinsame Zeichenkettentabelle', () => {
		/*
		 * **Der eigene Schreiber benutzt `inlineStr`, Excel benutzt
		 * `sharedStrings`** — geprüft war bis dahin nur der erste Weg, und der
		 * Kopf dieser Datei warnt genau davor. Hier steht deshalb eine Mappe im
		 * anderen Format, samt eines Textes, den Excel in zwei Stücke zerlegt,
		 * weil ein Teil anders formatiert ist.
		 */
		const dateien = new Map([
			[
				'xl/sharedStrings.xml',
				new TextEncoder().encode(
					'<sst><si><t>voter_ref</t></si><si><t>display_name</t></si>' +
						'<si><r><t>Renate </t></r><r><t>Berger</t></r></si></sst>'
				)
			],
			[
				'xl/worksheets/sheet1.xml',
				new TextEncoder().encode(
					'<worksheet><sheetData>' +
						'<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
						'<row r="2"><c r="A2" t="inlineStr"><is><t>A-1</t></is></c>' +
						'<c r="B2" t="s"><v>2</v></c></row>' +
						'</sheetData></worksheet>'
				)
			]
		]);
		const gelesen = zeilenAusMappe(dateien);
		expect(gelesen[0]).toEqual(['voter_ref', 'display_name']);
		expect(gelesen[1]).toEqual(['A-1', 'Renate Berger']);
	});

	it('nimmt das erste Blatt der Reiterfolge, nicht sheet1', () => {
		/*
		 * `xl/workbook.xml` führt die Blätter in der Reihenfolge, in der sie im
		 * Programm nebeneinanderstehen. Wer stattdessen `sheet1.xml` nimmt, liest
		 * nach einem Umsortieren der Reiter stillschweigend das falsche Blatt.
		 */
		const blatt = (text: string) =>
			new TextEncoder().encode(
				`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row></sheetData></worksheet>`
			);
		const dateien = new Map([
			[
				'xl/workbook.xml',
				new TextEncoder().encode(
					'<workbook><sheets><sheet name="Zweites" sheetId="2" r:id="rId7"/>' +
						'<sheet name="Erstes" sheetId="1" r:id="rId1"/></sheets></workbook>'
				)
			],
			[
				'xl/_rels/workbook.xml.rels',
				new TextEncoder().encode(
					'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
						'<Relationship Id="rId7" Target="worksheets/sheet2.xml"/></Relationships>'
				)
			],
			['xl/worksheets/sheet1.xml', blatt('sheet1')],
			['xl/worksheets/sheet2.xml', blatt('sheet2')]
		]);
		expect(zeilenAusMappe(dateien)[0][0]).toBe('sheet2');
	});

	it('fällt auf die Namenssuche zurück, wenn die Kennung Sonderzeichen trägt', () => {
		/*
		 * Die erste Fassung baute aus der Kennung einen regulären Ausdruck. Eine
		 * Klammer darin liess `new RegExp` werfen — und der Wurf übersprang genau
		 * den Rückfall, der hier greifen soll.
		 */
		const dateien = new Map([
			[
				'xl/workbook.xml',
				new TextEncoder().encode('<workbook><sheets><sheet r:id="rId1(" /></sheets></workbook>')
			],
			[
				'xl/_rels/workbook.xml.rels',
				new TextEncoder().encode('<Relationships><Relationship Id="rId9" Target="x.xml"/></Relationships>')
			],
			[
				'xl/worksheets/sheet1.xml',
				new TextEncoder().encode(
					'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>gerettet</t></is></c></row></sheetData></worksheet>'
				)
			]
		]);
		expect(zeilenAusMappe(dateien)[0][0]).toBe('gerettet');
	});

	it('sagt ab, wenn kein Tabellenblatt darin ist', () => {
		const ohneBlatt = entpacke(
			packe([{ name: 'irgendwas.txt', inhalt: new TextEncoder().encode('hallo') }], STEMPEL)
		);
		expect(() => zeilenAusMappe(ohneBlatt)).toThrow(MappenFehler);
		expect(() => zeilenAusMappe(ohneBlatt)).toThrow(/\.xlsx/);
	});
});
