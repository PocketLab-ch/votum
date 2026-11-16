/**
 * CSV zerlegen (Story 1.9, FR-6).
 *
 * Selbst geschrieben statt als Abhängigkeit, weil der Kern frei von I/O und frei
 * von Bibliotheken bleiben soll (AD-1) — und weil die kniffligen Stellen genau
 * die sind, die eine Bibliothek unterschiedlich löst: Trennzeichen, Anführungs-
 * zeichen im Feld, Zeilenumbruch im Feld, Byte-Reihenfolge-Marke von Excel.
 *
 * Das Trennzeichen wird erkannt, nicht angenommen: Excel schreibt in der Schweiz
 * mit Semikolon, andere Werkzeuge mit Komma. Wer es annimmt, liest eine Datei
 * mit einer einzigen Spalte ein und meldet «Spalten fehlen».
 */

export interface CsvZeile {
	/** Zeilennummer in der Datei, mit der Kopfzeile als 1. */
	nummer: number;
	werte: Record<string, string>;
}

export interface CsvErgebnis {
	spalten: string[];
	zeilen: CsvZeile[];
	trennzeichen: string;
}

const KANDIDATEN = [';', ',', '\t'];

/**
 * Errät das Trennzeichen aus der Kopfzeile.
 *
 * Gezählt wird ausserhalb von Anführungszeichen — ein Semikolon in einem
 * Spaltennamen darf nicht mitzählen.
 */
export function erkenneTrennzeichen(kopfzeile: string): string {
	let bestes = ';';
	let meiste = 0;

	for (const kandidat of KANDIDATEN) {
		let anzahl = 0;
		let inAnfuehrung = false;
		for (const zeichen of kopfzeile) {
			if (zeichen === '"') inAnfuehrung = !inAnfuehrung;
			else if (zeichen === kandidat && !inAnfuehrung) anzahl++;
		}
		if (anzahl > meiste) {
			meiste = anzahl;
			bestes = kandidat;
		}
	}

	return bestes;
}

/**
 * Zerlegt eine CSV nach RFC 4180.
 *
 * Doppelte Anführungszeichen im Feld stehen für eines; ein Zeilenumbruch
 * innerhalb von Anführungszeichen gehört zum Feld. Beides kommt bei Adressen
 * regelmässig vor.
 */
export function zerlege(text: string, trennzeichen?: string): CsvErgebnis {
	// Excel schreibt eine Byte-Reihenfolge-Marke voran. Bleibt sie stehen, heisst
	// die erste Spalte «﻿tenant_key» und wird nirgends gefunden.
	const inhalt = text.replace(/^﻿/, '');

	const ersteZeilenende = inhalt.search(/\r?\n/);
	const kopfzeile = ersteZeilenende === -1 ? inhalt : inhalt.slice(0, ersteZeilenende);
	const trenner = trennzeichen ?? erkenneTrennzeichen(kopfzeile);

	const felder: string[][] = [];
	let aktuelleZeile: string[] = [];
	let feld = '';
	let inAnfuehrung = false;

	for (let i = 0; i < inhalt.length; i++) {
		const zeichen = inhalt[i];

		if (inAnfuehrung) {
			if (zeichen === '"') {
				if (inhalt[i + 1] === '"') {
					feld += '"';
					i++;
				} else {
					inAnfuehrung = false;
				}
			} else {
				feld += zeichen;
			}
			continue;
		}

		if (zeichen === '"') {
			inAnfuehrung = true;
		} else if (zeichen === trenner) {
			aktuelleZeile.push(feld);
			feld = '';
		} else if (zeichen === '\n' || zeichen === '\r') {
			if (zeichen === '\r' && inhalt[i + 1] === '\n') i++;
			aktuelleZeile.push(feld);
			felder.push(aktuelleZeile);
			aktuelleZeile = [];
			feld = '';
		} else {
			feld += zeichen;
		}
	}

	// Letztes Feld, falls die Datei nicht mit einem Zeilenumbruch endet.
	if (feld !== '' || aktuelleZeile.length > 0) {
		aktuelleZeile.push(feld);
		felder.push(aktuelleZeile);
	}

	return ausFeldern(felder, trenner);
}

/**
 * Aus einem Feld-Raster wird eine gelesene Tabelle: Kopfzeile, dann Zeilen.
 *
 * **Eigene Funktion, seit es auch Excel-Dateien gibt** (25.08.2026, Auftraggeber: «und
 * wie kann ich den CSV oder Excel Import machen?»). Eine Arbeitsmappe liefert
 * ihre Zellen bereits zerlegt — sie erst wieder zu einer CSV-Zeichenkette
 * zusammenzusetzen, mit Anführungszeichen und Maskierung, nur damit `zerlege`
 * sie gleich darauf auseinandernimmt, wäre eine Umwandlung zu viel. Und jede
 * Umwandlung ist eine Stelle, an der ein Semikolon im Namen etwas kaputtmacht.
 *
 * Alles, was danach kommt — Spaltenerkennung, Prüfung, Vorschau — bleibt für
 * beide Wege dasselbe.
 */
export function ausFeldern(felder: readonly (readonly string[])[], trennzeichen: string): CsvErgebnis {
	if (felder.length === 0) {
		return { spalten: [], zeilen: [], trennzeichen };
	}

	const spalten = felder[0].map((s) => s.trim().toLowerCase());
	const zeilen: CsvZeile[] = [];

	for (let i = 1; i < felder.length; i++) {
		// Eine Zeile, die nur aus leeren Feldern besteht, ist keine Zeile — Excel
		// hängt gern eine an.
		if (felder[i].every((w) => w.trim() === '')) continue;

		const werte: Record<string, string> = {};
		for (let s = 0; s < spalten.length; s++) {
			werte[spalten[s]] = (felder[i][s] ?? '').trim();
		}
		zeilen.push({ nummer: i + 1, werte });
	}

	return { spalten, zeilen, trennzeichen };
}

/** Zerlegt eine Aufzählung mehrerer Personen in einem Feld. */
export function zerlegePersonen(wert: string): string[] {
	return wert
		.split(/[|;\n]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

// ── Und wieder hinaus ───────────────────────────────────────────────────────
//
// Die Gegenrichtung: eine Tabelle, die an einen Menschen geht, der sie in einer
// Tabellenkalkulation öffnet. Daraus folgen zwei Entscheide, die beide gegen
// die Norm gehen und trotzdem richtig sind — Strichpunkt statt Komma, weil
// Excel hierzulande eine kommagetrennte Datei als eine einzige Spalte öffnet,
// und eine Byte-Reihenfolge-Marke voran, weil «Müller» sonst als «MÃ¼ller»
// ankommt. Beim Einlesen oben wird beides erkannt statt angenommen; hier wird
// es gesetzt, weil der Empfänger feststeht.

/**
 * Ein Feld, so eingefasst, dass es ein Feld bleibt.
 *
 * Der vorangestellte Apostroph bei Zeichen, mit denen eine Formel beginnen
 * kann: Ein Feld wie `=1+1` wird beim Öffnen sonst ausgewertet. Bei Namen und
 * Adressen aus fremder Hand ist das ein bekannter Weg, einer
 * Tabellenkalkulation etwas unterzuschieben.
 */
function fasseEin(wert: string, trenner: string): string {
	let text = wert ?? '';
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	if (text.includes(trenner) || /["\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

/** Setzt eine Tabelle zu CSV zusammen, so wie eine Tabellenkalkulation sie erwartet. */
export function schreibe(zeilen: readonly (readonly string[])[], trenner = ';'): string {
	const marke = '﻿';
	// Wagenrücklauf und Zeilenvorschub, weil RFC 4180 es so verlangt.
	return marke + zeilen.map((z) => z.map((w) => fasseEin(w, trenner)).join(trenner)).join('\r\n') + '\r\n';
}
