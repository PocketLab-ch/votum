/**
 * Zeilenumbruch und Seitenaufteilung (Story 3.6, AD-1).
 *
 * Der Umbruch ist reine Rechnung: Text hinein, Zeilen heraus. Die Breite eines
 * Wortes kommt über eine übergebene Messfunktion — damit kennt der Kern keine
 * Schrift und keine PDF-Bibliothek, und der Umbruch lässt sich mit einer
 * Wertetabelle prüfen, ohne je ein PDF zu erzeugen.
 *
 * Warum das nicht der Bibliothek überlassen: pdf-lib bricht nicht um. Läge der
 * Umbruch trotzdem in der Schale, wäre die Frage «warum steht hier ein
 * Seitenumbruch mitten im Antragswortlaut» nur durch Ansehen des erzeugten PDF
 * zu beantworten.
 */

/** Misst die Breite einer Zeichenkette in derselben Einheit wie die Breitenangabe. */
export type Messer = (text: string) => number;

/**
 * Bricht einen Absatz auf die gegebene Breite um.
 *
 * Zeilenumbrüche im Text bleiben erhalten: In einem Antragswortlaut sind sie
 * gesetzt und keine Zufälligkeit.
 */
export function umbrich(text: string, breite: number, misst: Messer): string[] {
	const zeilen: string[] = [];

	for (const absatz of text.split('\n')) {
		if (absatz.trim() === '') {
			zeilen.push('');
			continue;
		}

		let aktuell = '';
		for (const wort of absatz.split(/\s+/).filter(Boolean)) {
			const versuch = aktuell === '' ? wort : `${aktuell} ${wort}`;
			if (misst(versuch) <= breite) {
				aktuell = versuch;
				continue;
			}

			if (aktuell !== '') zeilen.push(aktuell);

			// Ein einzelnes Wort, das länger ist als die Zeile — eine
			// Zusammensetzung wie «Erneuerungsfondsbeitragsberechnung» oder eine
			// lange Adresse. Es hart zu trennen ist hässlich; es stehen zu lassen
			// hiesse, dass es über den Rand hinausläuft und teils unsichtbar wird.
			if (misst(wort) > breite) {
				zeilen.push(...trenneHart(wort, breite, misst));
				aktuell = zeilen.pop() ?? '';
			} else {
				aktuell = wort;
			}
		}
		if (aktuell !== '') zeilen.push(aktuell);
	}

	return zeilen;
}

function trenneHart(wort: string, breite: number, misst: Messer): string[] {
	const teile: string[] = [];
	let aktuell = '';
	for (const zeichen of wort) {
		if (misst(aktuell + zeichen) > breite && aktuell !== '') {
			teile.push(aktuell);
			aktuell = zeichen;
		} else {
			aktuell += zeichen;
		}
	}
	if (aktuell !== '') teile.push(aktuell);
	return teile;
}

/** Ein Block, der auf einer Seite Platz braucht. */
export interface Block {
	/** Höhe in derselben Einheit wie die Seitenhöhe. */
	hoehe: number;
	/**
	 * Ob der Block mit dem folgenden zusammenbleiben muss.
	 *
	 * Für Überschriften: Eine Traktandennummer allein am Seitenende, deren Inhalt
	 * auf der nächsten Seite steht, ist auf dem Beamer unlesbar und in der
	 * Einladung verwirrend.
	 */
	haeltZusammen?: boolean;
}

export interface Seitenaufteilung<T extends Block> {
	seiten: T[][];
}

/**
 * Teilt Blöcke auf Seiten auf.
 *
 * Ein Block mit `haeltZusammen` nimmt den nächsten mit: Passen beide zusammen
 * nicht mehr aufs Blatt, beginnen beide auf der nächsten Seite.
 */
export function teileAufSeiten<T extends Block>(
	bloecke: T[],
	nutzhoehe: number
): Seitenaufteilung<T> {
	const seiten: T[][] = [];
	let seite: T[] = [];
	let verbraucht = 0;

	for (let i = 0; i < bloecke.length; i++) {
		const b = bloecke[i];
		// Was mindestens noch auf dieselbe Seite muss.
		const gebunden = b.haeltZusammen && i + 1 < bloecke.length ? bloecke[i + 1].hoehe : 0;
		const noetig = b.hoehe + gebunden;

		if (verbraucht > 0 && verbraucht + noetig > nutzhoehe) {
			seiten.push(seite);
			seite = [];
			verbraucht = 0;
		}

		seite.push(b);
		verbraucht += b.hoehe;
	}

	if (seite.length > 0) seiten.push(seite);
	// Eine Aufteilung ohne Seite gibt es nicht: Ein leeres Blatt ist besser als
	// ein PDF ohne Seiten, das kein Betrachter öffnen kann.
	return { seiten: seiten.length > 0 ? seiten : [[]] };
}

/**
 * Millimeter in PDF-Punkte.
 *
 * Ein PDF rechnet in Punkten zu 1/72 Zoll. Papierformate und Ränder denkt man in
 * Millimetern; die Umrechnung an genau einer Stelle verhindert, dass irgendwo im
 * Aufbau eine Zahl steht, bei der niemand mehr weiss, welche Einheit gemeint ist.
 */
export function mm(millimeter: number): number {
	return (millimeter * 72) / 25.4;
}

/** A4 hochkant in Punkten. */
export const A4 = { breite: mm(210), hoehe: mm(297) };

/** A4 quer — für die Präsentationsfassung, weil ein Beamer breit ist. */
export const A4_QUER = { breite: mm(297), hoehe: mm(210) };
