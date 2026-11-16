/**
 * Welche Datei ist das wirklich? (Story 3.4, AD-1, AD-17)
 *
 * Die Angabe des Browsers zum Dateityp ist eine **Behauptung des Absenders**.
 * Sie steht im Formular und lässt sich beliebig setzen: Wer eine ausführbare
 * Datei als `application/pdf` hochlädt, kommt an jeder Prüfung vorbei, die nur
 * diese Angabe liest. Auch die Endung sagt nichts — sie ist Teil des Namens.
 *
 * Was bleibt, ist der Inhalt. Die ersten Bytes einer Datei tragen bei allen
 * hier zugelassenen Formaten eine feste Kennung. Diese Prüfung ist reine
 * Rechnung auf einem Byte-Feld und gehört deshalb in den Kern, wo sie mit einer
 * Wertetabelle belegt werden kann.
 *
 * Sie ersetzt keinen Virenscanner. Sie stellt sicher, dass das, was ausgeliefert
 * wird, das Format hat, als das es ausgeliefert wird — und genau das ist es,
 * was ein Browser beim Öffnen voraussetzt.
 */

/** Die zugelassenen Formate. Bewusst eng: Was hier landet, wird später ausgeliefert. */
export type Dateiart = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic';

export const ZUGELASSENE_ARTEN: Dateiart[] = [
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/heic'
];

export const BEZEICHNUNGEN: Record<Dateiart, string> = {
	'application/pdf': 'PDF',
	'image/jpeg': 'JPEG-Bild',
	'image/png': 'PNG-Bild',
	'image/heic': 'HEIC-Bild'
};

function beginntMit(bytes: Uint8Array, muster: number[], ab = 0): boolean {
	if (bytes.length < ab + muster.length) return false;
	return muster.every((b, i) => bytes[ab + i] === b);
}

/**
 * Erkennt die Art aus dem Inhalt. `null` heisst: keines der zugelassenen Formate.
 */
export function erkenneArt(bytes: Uint8Array): Dateiart | null {
	// %PDF-
	if (beginntMit(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';

	// \xFF\xD8\xFF — jedes JPEG beginnt so, unabhängig von JFIF oder Exif.
	if (beginntMit(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';

	// \x89PNG\r\n\x1a\n — die volle Signatur, nicht nur «PNG»: Die Zeilenenden
	// darin sind Absicht und entlarven eine Datei, die durch eine Textumwandlung
	// gelaufen ist.
	if (beginntMit(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

	// HEIC ist ein ISO-BMFF-Behälter: 4 Bytes Länge, dann «ftyp», dann die Marke.
	if (beginntMit(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
		const marke = String.fromCharCode(...bytes.slice(8, 12));
		if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(marke)) {
			return 'image/heic';
		}
	}

	return null;
}

/**
 * Sagt in verständlichen Worten, was da hochgeladen wurde.
 *
 * Eine Meldung «nicht zugelassen» liesse die Sitzungsleitung raten. Bei den drei
 * häufigen Fällen — Office-Dokument, ausführbare Datei, umbenannte Datei — soll
 * dastehen, was tatsächlich vorliegt.
 */
export function beschreibeAbgelehntes(bytes: Uint8Array, behauptet: string): string {
	// PK\x03\x04 — ZIP. Alle neueren Office-Formate sind ZIP-Behälter, und
	// Makros stecken genau darin.
	if (beginntMit(bytes, [0x50, 0x4b, 0x03, 0x04])) {
		return (
			'Das sieht nach einem Office-Dokument oder einem ZIP-Archiv aus. Beide sind nicht ' +
			'vorgesehen: Ein Office-Dokument kann Makros enthalten, und ein Archiv verbirgt, was ' +
			'darin liegt. Drucken Sie die Unterlage als PDF.'
		);
	}

	// D0 CF 11 E0 — das alte OLE-Format von Word und Excel.
	if (beginntMit(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
		return (
			'Das ist ein Word- oder Excel-Dokument im alten Format. Es kann Makros enthalten und ist ' +
			'nicht vorgesehen. Drucken Sie die Unterlage als PDF.'
		);
	}

	// MZ (Windows), \x7FELF (Linux), CA FE BA BE / CF FA ED FE (macOS)
	if (
		beginntMit(bytes, [0x4d, 0x5a]) ||
		beginntMit(bytes, [0x7f, 0x45, 0x4c, 0x46]) ||
		beginntMit(bytes, [0xca, 0xfe, 0xba, 0xbe]) ||
		beginntMit(bytes, [0xcf, 0xfa, 0xed, 0xfe])
	) {
		return 'Das ist ein ausführbares Programm. Es wird nicht angenommen.';
	}

	const erkannt = erkenneArt(bytes);
	if (erkannt) {
		// Kann nicht vorkommen, solange nur nach einer Ablehnung gefragt wird —
		// steht hier trotzdem, damit die Funktion für sich stimmig bleibt.
		return `Die Datei ist ein ${BEZEICHNUNGEN[erkannt]}.`;
	}

	return (
		`Der Inhalt der Datei gehört zu keinem der zugelassenen Formate ` +
		`(${ZUGELASSENE_ARTEN.map((a) => BEZEICHNUNGEN[a]).join(', ')}). ` +
		`Angegeben war «${behauptet || 'nichts'}» — massgebend ist aber der Inhalt, nicht die Angabe.`
	);
}
