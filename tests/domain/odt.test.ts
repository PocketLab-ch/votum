import { describe, expect, it } from 'vitest';
import { alsOpenDocument, ODT_MEDIENTYP } from '$lib/domain/odt';
import { alsWorddokument } from '$lib/domain/docx';
import { dosZeitstempel } from '$lib/domain/archiv';

/**
 * **Der OpenDocument-Erzeuger** (05.09.2026, Auftraggeber: «Mach noch eine Odt
 * Variante»).
 *
 * Geprüft wird beides: dass die Datei den Formatregeln genügt, und dass sie
 * denselben Text zeigt wie das Word-Dokument. Das zweite ist das Wichtigere —
 * zwei Erzeuger für dieselbe Vorlage laufen sonst auseinander, und niemand
 * merkt es, bis zwei Bewirtschaftungen verschiedene Protokolle in der Hand
 * halten.
 */
describe('Das OpenDocument', () => {
	const stempel = dosZeitstempel('2026-08-04 10:15:00');
	const FUSS = 'Rosenweg 4 · Versammlung vom 4. August 2026 · Stand 4. Aug. 2026, 10:15';
	const alles = (text: string, fuss = FUSS) =>
		new TextDecoder('utf-8').decode(alsOpenDocument(text, stempel, fuss));

	it('ist ein ZIP mit den Teilen, die ODF verlangt', () => {
		const bytes = alsOpenDocument('# Protokoll\n\nEin Absatz.', stempel, FUSS);
		expect(bytes[0]).toBe(0x50); // «PK»
		expect(bytes[1]).toBe(0x4b);
		const text = new TextDecoder('latin1').decode(bytes);
		for (const teil of ['mimetype', 'META-INF/manifest.xml', 'styles.xml', 'content.xml']) {
			expect(text).toContain(teil);
		}
	});

	/*
	 * **ODF 1.3 §3.3: Der `mimetype` ist der erste Eintrag und unverdichtet.**
	 * Nur so erkennt ein Werkzeug das Format an den ersten Bytes, ohne das
	 * Archiv zu öffnen. Geprüft wird das am Abstand vom Dateianfang: Steht der
	 * Name mitsamt seinem Inhalt in den ersten vierzig Bytes, kann kein anderer
	 * Eintrag davor liegen und der Inhalt nicht verdichtet sein.
	 */
	it('trägt den mimetype als ersten Eintrag, unverdichtet', () => {
		const text = new TextDecoder('latin1').decode(
			alsOpenDocument('Ein Absatz.', stempel, FUSS)
		);
		const stelle = text.indexOf(`mimetype${ODT_MEDIENTYP}`);
		expect(stelle, 'Name und Inhalt liegen unmittelbar am Anfang').toBeGreaterThan(0);
		expect(stelle).toBeLessThan(40);
	});

	/*
	 * **Der Wurzeleintrag des Verzeichnisses trägt die Fassung** (ODF 1.2/1.3,
	 * aus dem Code-Review). Ein von LibreOffice selbst erzeugtes `.odt` schreibt
	 * sie dort ebenfalls; ohne sie ist das Verzeichnis unvollständig, und
	 * strenge Leser lehnen die Datei ab.
	 */
	it('nennt die ODF-Fassung am Wurzeleintrag des Verzeichnisses', () => {
		expect(alles('Ein Absatz.')).toContain(
			`<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODT_MEDIENTYP}" manifest:version="1.3"/>`
		);
	});

	it('setzt Überschriften mit ihrer Gliederungsstufe', () => {
		const xml = alles('# Eins\n## Zwei\n### Drei');
		expect(xml).toContain('<text:h text:style-name="Heading_20_1" text:outline-level="1">Eins');
		expect(xml).toContain('<text:h text:style-name="Heading_20_2" text:outline-level="2">Zwei');
		expect(xml).toContain('<text:h text:style-name="Heading_20_3" text:outline-level="3">Drei');
	});

	it('setzt eine Aufzählung mit sichtbarem Gedankenstrich', () => {
		expect(alles('- Erster Punkt')).toContain(
			'<text:p text:style-name="List_20_Paragraph">– Erster Punkt</text:p>'
		);
	});

	it('macht aus zusammenhängenden Zeilen eine Tabelle mit zwei Spalten', () => {
		const xml = alles('| Ort | Bern |\n| Datum | heute |');
		expect(xml.match(/<table:table /g) ?? [], 'eine Tabelle').toHaveLength(1);
		expect(xml.match(/<table:table-row>/g) ?? [], 'zwei Zeilen').toHaveLength(2);
		expect(xml.match(/<table:table-column /g) ?? [], 'zwei Spalten').toHaveLength(2);
	});

	/*
	 * `table:name` muss im Dokument eindeutig sein. Zwei Tabellen mit demselben
	 * Namen öffnet LibreOffice zwar, benennt aber eine still um — und ein
	 * Dokument, das sich beim Öffnen ändert, ist kein verlässlicher Nachweis.
	 */
	it('gibt jeder Tabelle einen eigenen Namen', () => {
		const xml = alles('| a | 1 |\n\n| b | 2 |');
		const namen = [...xml.matchAll(/table:name="([^"]+)"/g)].map((t) => t[1]);
		expect(namen).toHaveLength(2);
		expect(new Set(namen).size, `doppelter Name in ${namen.join(', ')}`).toBe(2);
	});

	it('verwirft die Markdown-Trennzeile, statt Striche zu setzen', () => {
		const xml = alles('| Ort | Bern |\n| --- | --- |\n| Datum | heute |');
		expect(xml.match(/<table:table-row>/g) ?? [], 'zwei Zeilen, nicht drei').toHaveLength(2);
		expect(xml).not.toContain('---');
	});

	it('lässt einen senkrechten Strich im Wert zu', () => {
		expect(alles('| Ort | Saal A | B, Bern |')).toContain('Saal A | B, Bern');
	});

	it('schützt Zeichen, die XML nicht wörtlich nimmt', () => {
		expect(alles('Kosten & Nutzen <intern>')).toContain('Kosten &amp; Nutzen &lt;intern&gt;');
	});

	it('ergibt bei gleichem Text und gleichem Stempel dieselben Bytes', () => {
		const a = alsOpenDocument('# Gleich', stempel, FUSS);
		const b = alsOpenDocument('# Gleich', stempel, FUSS);
		expect(Array.from(a)).toEqual(Array.from(b));
	});

	/*
	 * **ODF faltet Leerräume, das Word-Dokument nicht** (aus dem Code-Review,
	 * 05.09.2026). Ohne eigene Marken verschwänden ein führendes Leerzeichen und
	 * jedes zweite in einer Folge — im gesetzten PDF nachgewiesen. Zwei Ausgaben
	 * desselben Textes sollen dasselbe zeigen.
	 */
	it('erhält Leerzeichen, die ODF sonst zusammenfaltet', () => {
		expect(alles('Ein Absatz mit  zwei Leerzeichen.'), 'zwei Leerzeichen').toContain(
			'mit <text:s text:c="1"/>zwei'
		);
		expect(alles('   Eingerückt.'), 'führende Leerzeichen').toContain(
			'<text:s text:c="3"/>Eingerückt.'
		);
		expect(alles('Vor\tnach.'), 'Tabulator').toContain('Vor<text:tab/>nach.');
	});

	/*
	 * **Der Textkörper endet, wo er im Word-Dokument endet.** Die beiden Formate
	 * rechnen den unteren Rand verschieden: In Word sitzt die Fusszeile im Rand,
	 * in ODF zehrt sie vom Textkörper. Übernimmt man die 2.5 cm unverändert,
	 * verliert die Seite 1.1 cm nutzbare Höhe und derselbe Text bricht früher um.
	 * Die drei Masse müssen sich deshalb zu den 2.5 cm des Word-Dokuments
	 * addieren.
	 */
	it('teilt den unteren Rand so auf, dass er dem Word-Dokument entspricht', () => {
		const xml = alles('Ein Absatz.');
		const zahl = (muster: RegExp) => {
			const t = muster.exec(xml);
			expect(t, `${muster} steht nicht im Seitenlayout`).not.toBeNull();
			return Number(t?.[1]);
		};
		// **Gezielt im Seitenlayout**, nicht irgendwo: Der erste Anlauf traf mit
		// einer lockeren Regex den Absatzabstand des Listenabsatzes (0.071 cm) und
		// hätte damit eine ganz andere Zahl geprüft.
		const rand = zahl(/<style:page-layout-properties[^>]*fo:margin-bottom="([\d.]+)cm"/);
		const hoehe = zahl(/<style:header-footer-properties fo:min-height="([\d.]+)cm"/);
		const abstand = zahl(/<style:header-footer-properties[^>]*fo:margin-top="([\d.]+)cm"/);
		expect(rand + hoehe + abstand, `${rand} + ${hoehe} + ${abstand}`).toBeCloseTo(2.5, 5);
	});

	describe('Die Fusszeile', () => {
		const fussVon = (xml: string) =>
			xml.slice(xml.indexOf('<style:footer>'), xml.indexOf('</style:footer>'));

		it('trägt den Vermerk und die Seitenzahl als Feld', () => {
			const fuss = fussVon(alles('Ein Absatz.'));
			expect(fuss).toContain(FUSS);
			expect(fuss, 'die Seitenzahl kennt erst die Textverarbeitung').toContain(
				'<text:page-number'
			);
			expect(fuss).toContain('<text:page-count>');
		});

		it('lässt bei leerem Vermerk das Trennzeichen weg', () => {
			const fuss = fussVon(alles('Ein Absatz.', ''));
			expect(fuss, 'kein Mittelpunkt ohne einen Vermerk davor').not.toContain('·');
			expect(fuss, 'die Seitenzahl bleibt').toContain('Seite ');
		});

		it('steht im Seitenlayout, damit sie auf jedes Blatt kommt', () => {
			const xml = alles('Ein Absatz.');
			expect(xml).toContain('<style:master-page style:name="Standard"');
			expect(xml, 'ohne footer-style hat sie keine Höhe').toContain('<style:footer-style>');
		});
	});

	/*
	 * **Der eigentliche Nachweis** (05.09.2026): Word und OpenDocument teilen
	 * sich die Zerlegung in `protokollauszeichnung.ts`, und dieser Test hält sie
	 * daran fest. Ein Erzeuger, der eigene Wege geht, fällt hier auf, bevor ihn
	 * jemand nebeneinanderlegt.
	 */
	it('zeigt dieselbe Gliederung wie das Word-Dokument', () => {
		const text =
			'# Protokoll\n\n| Ort | Bern |\n| Datum | heute |\n\n## 1 Begrüssung\n\nEin Absatz.\n\n- Aebi\n- Berger\n\n## 2 Schluss\n\nEnde.';
		const odt = alles(text);
		const docx = new TextDecoder('utf-8').decode(alsWorddokument(text, stempel, FUSS));

		const zaehle = (xml: string, muster: RegExp) => (xml.match(muster) ?? []).length;
		expect(zaehle(odt, /<text:h /g), 'Überschriften').toBe(
			zaehle(docx, /<w:pStyle w:val="berschrift/g)
		);
		expect(zaehle(odt, /<table:table /g), 'Tabellen').toBe(zaehle(docx, /<w:tbl>/g));
		expect(zaehle(odt, /text:style-name="List_20_Paragraph"/g), 'Aufzählungspunkte').toBe(
			zaehle(docx, /<w:pStyle w:val="Listenabsatz"\/>/g)
		);
	});
});
