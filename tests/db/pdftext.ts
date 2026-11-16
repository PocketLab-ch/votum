/**
 * Den sichtbaren Text aus einem erzeugten PDF zurücklesen.
 *
 * **Wozu.** Was auf der Zugangskarte steht, ist im Streitfall eine Urkunde —
 * und bis hierher prüften die Tests nur, dass ein PDF entsteht und wie viele
 * Seiten es hat. Ob die richtige Zeile darauf steht, sah niemand ohne einen
 * Betrachter. Ein Satz, der still verschwindet, fiel damit erst dem Eigentümer
 * im Briefkasten auf.
 *
 * **Warum das nicht in zwei Zeilen geht.** Die Dokumente betten DejaVu Sans als
 * Teilmenge ein (`pdf/basis.ts`, wegen «Petrović» und «Nowak-Łukasik»). Im
 * Inhaltsstrom stehen deshalb keine Buchstaben, sondern Zeichennummern dieser
 * Teilmenge — für jede Schrift eigene. Lesbar werden sie erst über die
 * `ToUnicode`-Tabelle, die pdf-lib je Schrift mitschreibt. Deshalb wird hier
 * mitgeführt, welche Schrift gerade gewählt ist (`/F1 11 Tf`): Nimmt man eine
 * gemeinsame Tabelle für alle, kommt bei der fetten Schrift Buchstabensalat
 * heraus, der aussieht wie ein Kodierungsfehler.
 *
 * **Kein zusätzliches Paket.** `pdf-lib` liegt ohnehin im Projekt und gibt die
 * nötigen Bausteine her; eine Auslesebibliothek wäre eine weitere Abhängigkeit
 * für eine Prüfung.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

/** Eine `ToUnicode`-Tabelle: Zeichennummer der Teilmenge zu lesbarem Text. */
function cmapVon(text: string): Map<number, string> {
	const karte = new Map<number, string>();
	const lesbar = (hex: string) =>
		String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((x) => parseInt(x, 16)));

	for (const block of text.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
		for (const paar of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
			karte.set(parseInt(paar[1], 16), lesbar(paar[2]));
		}
	}
	for (const block of text.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
		for (const drei of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
			const von = parseInt(drei[1], 16);
			const bis = parseInt(drei[2], 16);
			const ziel = parseInt(drei[3], 16);
			for (let i = 0; i <= bis - von; i++) karte.set(von + i, String.fromCharCode(ziel + i));
		}
	}
	return karte;
}

/** Eine gezeichnete Textzeile mit dem Ort, an dem sie steht. */
export interface Platzierung {
	text: string;
	/** Linker Rand der Zeile, in Punkten von der Blattkante. */
	x: number;
	/** Grundlinie, in Punkten von der **unteren** Blattkante. */
	y: number;
	/** Schriftgrad in Punkten — die Zeile beansprucht ungefähr so viel Höhe. */
	groesse: number;
}

/**
 * Die gezeichneten Textzeilen einer Seite **mit ihrem Ort**.
 *
 * **Wozu der Ort** (02.09.2026, Praxisbefund des Auftraggebers «Zeilen mit zwei Eigentümern
 * sehen anders aus»). Was dort passierte, sah man am Text allein nicht: Alle
 * erwarteten Zeilen standen da, sie standen nur **übereinander**. Der
 * Vertretervermerk wurde an einer festen Stelle unter der ersten Namenszeile
 * gezeichnet, und wenn der Name umbrach, lag die zweite Namenszeile 2.9 Punkte
 * darunter, bei 9.5 Punkten Schrift.
 *
 * Ein Test, der nur `textVonSeite` liest, ist gegen diese ganze Fehlerklasse
 * blind — er findet jedes Wort und übersieht, dass keines lesbar ist.
 *
 * Eine Zeile hier ist eine Zeichenanweisung, kein Satz: Der Umbruch aus
 * `zeichneText` erzeugt je Bildschirmzeile eine.
 */
export async function platzierungenVonSeite(
	bytes: Uint8Array,
	seitennummer = 0
): Promise<Platzierung[]> {
	const dokument = await PDFDocument.load(bytes);
	const seite = dokument.getPage(seitennummer);

	const schriften = seite.node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
	const tabellen = new Map<string, Map<number, string>>();
	for (const [name, wert] of schriften?.entries() ?? []) {
		const schrift = dokument.context.lookup(wert, PDFDict);
		const zeiger = schrift?.get(PDFName.of('ToUnicode'));
		const strom = zeiger ? dokument.context.lookup(zeiger) : null;
		if (strom instanceof PDFRawStream) {
			tabellen.set(name.asString(), cmapVon(new TextDecoder().decode(decodePDFRawStream(strom).decode())));
		}
	}

	const inhalt = seite.node.Contents();
	const teile = inhalt instanceof PDFArray ? inhalt.asArray() : [inhalt];
	let quelle = '';
	for (const teil of teile) {
		const strom = dokument.context.lookup(teil);
		// latin1, nicht utf-8: Der Strom ist eine Bytefolge mit eingestreuten
		// Namen und Zahlen, kein Text. utf-8 verschluckte jedes Byte über 0x7f.
		if (strom instanceof PDFRawStream) {
			quelle += new TextDecoder('latin1').decode(decodePDFRawStream(strom).decode());
		}
	}

	const platzierungen: Platzierung[] = [];
	let tabelle = new Map<number, string>();
	let groesse = 0;
	let ort: { x: number; y: number } | null = null;

	/*
	 * Drei Befehle werden verfolgt: die Schriftwahl (`Tf`, gibt den Grad und die
	 * Umschlüsselungstabelle), die Textmatrix (`Tm`, gibt den Ort) und die
	 * Ausgabe selbst (`Tj`). `pdf-lib` schreibt für jede gezeichnete Zeile alle
	 * drei, in dieser Reihenfolge.
	 */
	const befehle =
		/(\/[^\s/]+)\s+([\d.]+)\s+Tf|1\s+0\s+0\s+1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|<([0-9a-fA-F]+)>\s*Tj/g;

	for (const treffer of quelle.matchAll(befehle)) {
		if (treffer[1]) {
			tabelle = tabellen.get(treffer[1]) ?? new Map();
			groesse = Number(treffer[2]);
			continue;
		}
		if (treffer[3] !== undefined) {
			ort = { x: Number(treffer[3]), y: Number(treffer[4]) };
			continue;
		}
		/*
		 * **Eine Ausgabe ohne vorangehende Textmatrix wird nicht geraten.** Sonst
		 * bekäme sie den Ort der vorherigen Zeile, und ein Test über Abstände
		 * fände ausgerechnet dort nichts, wo zwei Zeilen wirklich aufeinander
		 * liegen.
		 */
		if (!ort) throw new Error('Textausgabe ohne Textmatrix — der Leser passt nicht zum Erzeuger.');
		let zeile = '';
		// Ein unbekanntes Zeichen wird nicht stillschweigend übersprungen: Sonst
		// bestünde ein Test, der eine Zeile prüft, die gar nicht gelesen wurde.
		for (const paar of treffer[5].match(/.{4}/g) ?? []) zeile += tabelle.get(parseInt(paar, 16)) ?? '�';
		platzierungen.push({ text: zeile, x: ort.x, y: ort.y, groesse });
	}
	return platzierungen;
}

/**
 * Dieselben Zeilen ohne den Ort, in der Reihenfolge des Zeichnens.
 *
 * Wer einen ganzen Satz sucht, nimmt `textVonSeite`.
 */
export async function zeilenVonSeite(bytes: Uint8Array, seitennummer = 0): Promise<string[]> {
	return (await platzierungenVonSeite(bytes, seitennummer)).map((p) => p.text);
}

/**
 * Derselbe Text als ein Stück, mit Leerzeichen an den Umbrüchen.
 *
 * Damit lässt sich nach einem ganzen Satz suchen, auch wenn er auf der Seite
 * über zwei Zeilen läuft.
 */
export async function textVonSeite(bytes: Uint8Array, seitennummer = 0): Promise<string> {
	return (await zeilenVonSeite(bytes, seitennummer)).join(' ');
}
