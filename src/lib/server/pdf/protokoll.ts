/**
 * Das Protokoll als PDF (FR-49).
 *
 * **Word ist das Standardformat**, weil die Nachbearbeitung ausserhalb
 * stattfindet. Das PDF ist die Fassung zum Verschicken und Ablegen — derselbe
 * Text, gesetzt statt bearbeitbar.
 *
 * Gesetzt wird der Text aus `$lib/domain/protokoll` mit seiner winzigen
 * Auszeichnung: `#` bis `######` Überschriften, `- ` Aufzählung, alles andere
 * ein Absatz. Wer im Textfeld etwas anderes schreibt, bekommt es als Absatz —
 * schlicht ist hier besser als geraten.
 */
import { A4, mm } from '$lib/domain/textsatz';
import {
	felder,
	istTabellenzeile,
	istTrennzeile,
	ueberschrift
} from '$lib/domain/protokollauszeichnung';
import { GRAU, hoeheVon, neuesBlatt, zeichneText, type Blatt } from './basis';
import type { PDFPage } from 'pdf-lib';

const RAND = mm(20);
const BREITE = A4.breite - 2 * RAND;

/** Schriftgrössen je Überschriftenebene — darunter der Fliesstext. */
const GROESSEN = [17, 13, 11.5, 11, 11, 11];

interface Zeilenbau {
	text: string;
	stufe: number | null;
	aufzaehlung: boolean;
	/** Die beiden Felder einer Tabellenzeile, sonst null. */
	felder: [string, string] | null;
}

/**
 * Die beiden Felder einer Tabellenzeile, oder `null`.
 *
 * **Die Erkennung selbst steht in `domain/protokollauszeichnung.ts`** und ist
 * dieselbe wie in der Word-Ausgabe. Sie stand hier bis
 * zum 05.09.2026 ein zweites Mal, mit drei Kommentaren «dieselbe Regel wie in
 * `domain/docx.ts`» — ein Kommentar, der eine Gleichheit behauptet, hält sie
 * nicht.
 *
 * **Die Trennzeile `| --- | --- |` ist keine Zeile**, sondern die Ankündigung
 * einer Kopfzeile, die es hier nicht gibt: Sie wird gar nicht gesetzt.
 */
function tabellenfelder(text: string): [string, string] | null {
	if (!istTabellenzeile(text) || istTrennzeile(text)) return null;
	return felder(text);
}

function zerlege(text: string): Zeilenbau[] {
	return text
		.split('\n')
		.filter((zeile) => !istTrennzeile(zeile))
		.map((zeile) => {
			const h = ueberschrift(zeile);
			if (h) {
				return { text: h.text, stufe: h.stufe, aufzaehlung: false, felder: null };
			}
			if (zeile.startsWith('- ')) {
				return {
					text: zeile.slice(2),
					stufe: null,
					aufzaehlung: true,
					felder: null
				};
			}
			const felderDerZeile = tabellenfelder(zeile);
			if (felderDerZeile) {
				return { text: zeile, stufe: null, aufzaehlung: false, felder: felderDerZeile };
			}
			return { text: zeile, stufe: null, aufzaehlung: false, felder: null };
		});
}

function stilVon(blatt: Blatt, z: Zeilenbau) {
	if (z.stufe) {
		return {
			schrift: blatt.schriften.fett,
			groesse: GROESSEN[z.stufe - 1],
			durchschuss: 1.3
		};
	}
	return { schrift: blatt.schriften.normal, groesse: 10.5, durchschuss: 1.45 };
}

export async function erzeugeProtokollPdf(text: string, fusszeile: string): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	let seite: PDFPage = blatt.dokument.addPage([A4.breite, A4.hoehe]);
	let y = A4.hoehe - RAND;

	const neueSeite = () => {
		seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		y = A4.hoehe - RAND;
	};

	/*
	 * **Die Tabelle des Kopfes: zwei Spalten, eine feste Kante.**
	 *
	 * Der Kopf eines Protokolls hat kurze Bezeichnungen links und wechselnd
	 * lange Werte rechts (Vorlage des Auftraggebers, 03.09.2026). Eine feste linke Spalte
	 * hält die Werte an einer Kante — das ist es, was eine Tabelle einer
	 * Aufzählung voraushat.
	 *
	 * Die Bezeichnung steht in derselben Schrift wie der Wert, nur leiser: Ein
	 * fetter Feldname zöge den Blick auf das, was ohnehin bekannt ist.
	 */
	const SPALTE = mm(38);

	for (const z of zerlege(text)) {
		if (z.text.trim() === '') {
			y -= mm(3);
			continue;
		}

		if (z.felder) {
			const [links, rechts] = z.felder;
			const beschriftung = {
				schrift: blatt.schriften.normal,
				groesse: 10.5,
				durchschuss: 1.45,
				farbe: GRAU
			};
			const wert = {
				schrift: blatt.schriften.normal,
				groesse: 10.5,
				durchschuss: 1.45
			};
			const hoehe = Math.max(
				hoeheVon(links, SPALTE - mm(3), beschriftung),
				hoeheVon(rechts, BREITE - SPALTE, wert)
			);
			if (y - hoehe < RAND + mm(10)) neueSeite();
			zeichneText(seite, links, RAND, y, SPALTE - mm(3), beschriftung);
			const nachWert = zeichneText(seite, rechts, RAND + SPALTE, y, BREITE - SPALTE, wert);
			// Die tiefere der beiden Spalten bestimmt, wo es weitergeht.
			y = Math.min(y - hoehe, nachWert);
			continue;
		}

		const stil = stilVon(blatt, z);
		const einzug = z.aufzaehlung ? mm(5) : 0;
		const wortlaut = z.aufzaehlung ? `– ${z.text}` : z.text;
		const hoehe = hoeheVon(wortlaut, BREITE - einzug, stil);

		// Eine Überschrift am Seitenfuss bleibt nicht allein: Sie braucht Platz für
		// sich und wenigstens zwei Zeilen darunter, sonst steht sie verwaist.
		const noetig = z.stufe ? hoehe + mm(14) : hoehe;
		if (y - noetig < RAND + mm(10)) neueSeite();

		if (z.stufe) y -= mm(z.stufe === 1 ? 0 : 3);
		y = zeichneText(seite, wortlaut, RAND + einzug, y, BREITE - einzug, stil);
	}

	// Die Fusszeile auf jeder Seite: Sie sagt, aus welcher Fassung das Blatt
	// stammt. Ein Protokollblatt ohne diese Angabe lässt sich später keiner
	// Fassung mehr zuordnen.
	const seiten = blatt.dokument.getPages();
	seiten.forEach((s, nummer) => {
		zeichneText(
			s,
			`${fusszeile} · Seite ${nummer + 1} von ${seiten.length}`,
			RAND,
			mm(12),
			BREITE,
			{ schrift: blatt.schriften.normal, groesse: 8, farbe: GRAU }
		);
	});

	return blatt.dokument.save();
}
