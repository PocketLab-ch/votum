/**
 * Ein ZIP-Archiv aus Bytes — rein, ohne Ablage und ohne Uhr (AD-1).
 *
 * **Wozu.** Vierzehn Eigentümer brauchen vierzehn Karten als **vierzehn
 * Dateien**: Jede geht einzeln in die Dokumentenablage, und jeder Eigentümer
 * bekommt den Verweis auf seine eigene. Ein Sammel-PDF wäre dafür unbrauchbar —
 * es landete bei allen im Dokument aller, samt fremder Zugangscodes.
 *
 * Die Codes entstehen dabei in **einem** Zug: Jeder Code existiert nur im
 * Augenblick seiner Entstehung (NFR-5), und vierzehn einzelne Aufrufe erzeugten
 * jedes Mal neue und machten die vorigen ungültig.
 *
 * **Warum ohne Verdichtung.** Der Inhalt sind PDF-Dateien, und die sind bereits
 * verdichtet; ein zweiter Durchgang gewänne nichts und brächte eine Abhängigkeit
 * ins Haus. Ohne sie ist das Archiv reine Byte-Arithmetik und lässt sich Byte
 * für Byte prüfen.
 *
 * Der Zeitstempel kommt von aussen herein: Der Kern liest keine Uhr.
 */

export interface Archiveintrag {
	/** Der Dateiname im Archiv. Bereits in Dateinamensform, siehe `dateinamensform`. */
	name: string;
	inhalt: Uint8Array;
}

/** Zeitstempel im Format, das ZIP seit MS-DOS mitschleppt. */
export interface Dosstempel {
	zeit: number;
	datum: number;
}

/**
 * Rechnet einen Zeitpunkt in das ZIP-Format um.
 *
 * Nimmt `2026-09-15T19:30:00` entgegen — kein `Date`, weil daraus zu leicht ein
 * `new Date()` im Kern würde. MS-DOS zählt ab 1980 und kennt nur gerade
 * Sekunden; frühere Zeitpunkte gäbe es im Format nicht.
 */
export function dosZeitstempel(zeitpunkt: string): Dosstempel {
	const t = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(zeitpunkt);
	if (!t) return { zeit: 0, datum: (1980 - 1980) << 9 | (1 << 5) | 1 };

	const jahr = Math.max(1980, Number(t[1]));
	const monat = Number(t[2]);
	const tag = Number(t[3]);
	const stunde = Number(t[4]);
	const minute = Number(t[5]);
	const sekunde = Number(t[6] ?? '0');

	return {
		datum: ((jahr - 1980) << 9) | (monat << 5) | tag,
		zeit: (stunde << 11) | (minute << 5) | (sekunde >> 1)
	};
}

// ── Dateinamen ──────────────────────────────────────────────────────────────

/** Länger wird kein Namensteil — manche Ablagen und Betriebssysteme knicken sonst ein. */
export const NAMENSLAENGE = 60;

const UMLAUTE: readonly [RegExp, string][] = [
	[/ä/g, 'ae'],
	[/ö/g, 'oe'],
	[/ü/g, 'ue'],
	[/Ä/g, 'Ae'],
	[/Ö/g, 'Oe'],
	[/Ü/g, 'Ue'],
	[/ß/g, 'ss']
];

/**
 * Macht aus einem Namen einen Dateinamen.
 *
 * Umlaute werden ausgeschrieben statt entfernt: «Müller» wird zu «Mueller» und
 * nicht zu «Mller». Übrige Zeichen mit Zeichensetzung darüber verlieren sie
 * («Bézier» → «Bezier»); was dann noch bleibt, wird zum Bindestrich.
 *
 * Warum überhaupt: Der Name geht in eine Dokumentenablage und über Systeme
 * hinweg, deren Umgang mit Zeichensätzen sich nicht vorhersagen lässt. Ein
 * Dateiname, den ein Zwischenschritt zerlegt, ist später keinem Eigentümer mehr
 * zuzuordnen.
 */
export function dateinamensform(text: string): string {
	let name = text ?? '';
	for (const [muster, ersatz] of UMLAUTE) name = name.replace(muster, ersatz);
	// Zerlegt und die Zeichensetzung darüber weggelassen. Als Escape-Folge
	// geschrieben, weil diese Zeichen im Quelltext unsichtbar wären: Sie hängen
	// sich an die eckige Klammer davor.
	name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	name = name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return name.slice(0, NAMENSLAENGE).replace(/-+$/, '') || 'ohne-namen';
}

/**
 * Macht eine Liste von Dateinamen eindeutig.
 *
 * Zwei Parteien können denselben Namen tragen — «Erbengemeinschaft Meier» kommt
 * in einer Liegenschaft durchaus zweimal vor. Zwei gleichnamige Einträge in
 * einem Archiv sind je nach Entpacker zwei Dateien oder eine; im zweiten Fall
 * fehlte einem Eigentümer seine Karte, ohne dass es jemandem auffiele.
 */
export function eindeutigeNamen(namen: readonly string[]): string[] {
	const gesehen = new Map<string, number>();
	return namen.map((name) => {
		const zahl = gesehen.get(name) ?? 0;
		gesehen.set(name, zahl + 1);
		if (zahl === 0) return name;
		const punkt = name.lastIndexOf('.');
		return punkt > 0
			? `${name.slice(0, punkt)}-${zahl + 1}${name.slice(punkt)}`
			: `${name}-${zahl + 1}`;
	});
}

// ── Prüfsumme ───────────────────────────────────────────────────────────────

const CRC_TABELLE = (() => {
	const tabelle = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let wert = i;
		for (let bit = 0; bit < 8; bit++) {
			wert = wert & 1 ? 0xedb88320 ^ (wert >>> 1) : wert >>> 1;
		}
		tabelle[i] = wert >>> 0;
	}
	return tabelle;
})();

/** CRC-32, wie ZIP sie verlangt. */
export function pruefsumme(bytes: Uint8Array): number {
	let wert = 0xffffffff;
	for (const b of bytes) {
		wert = CRC_TABELLE[(wert ^ b) & 0xff] ^ (wert >>> 8);
	}
	return (wert ^ 0xffffffff) >>> 0;
}

// ── Der Packer ──────────────────────────────────────────────────────────────

const LOKALER_KOPF = 0x04034b50;
const VERZEICHNISKOPF = 0x02014b50;
const ABSCHLUSS = 0x06054b50;

/** Kennzeichnet die Namen als UTF-8 — sonst liest ein Entpacker sie als Codepage 437. */
const UTF8_FLAGGE = 0x0800;

class Schreiber {
	private teile: Uint8Array[] = [];
	laenge = 0;

	bytes(werte: Uint8Array): void {
		this.teile.push(werte);
		this.laenge += werte.length;
	}

	/** Kleinstwertiges Byte zuerst — ZIP schreibt alle Zahlen so. */
	zahl(wert: number, breite: 2 | 4): void {
		const puffer = new Uint8Array(breite);
		for (let i = 0; i < breite; i++) puffer[i] = (wert >>> (8 * i)) & 0xff;
		this.bytes(puffer);
	}

	fertig(): Uint8Array {
		const alles = new Uint8Array(this.laenge);
		let stelle = 0;
		for (const teil of this.teile) {
			alles.set(teil, stelle);
			stelle += teil.length;
		}
		return alles;
	}
}

/**
 * Packt die Einträge zu einem Archiv.
 *
 * Wirft bei doppelten Namen: Das wäre ein stiller Verlust, und ein Archiv mit
 * dreizehn statt vierzehn Karten fällt erst auf, wenn jemand nicht hereinkommt.
 * Wer aus Anzeigenamen Dateinamen macht, führt sie vorher durch
 * `eindeutigeNamen`.
 */
export function packe(eintraege: readonly Archiveintrag[], zeitpunkt: Dosstempel): Uint8Array {
	const namen = new Set<string>();
	for (const e of eintraege) {
		if (namen.has(e.name)) {
			throw new Error(`Der Name «${e.name}» kommt im Archiv zweimal vor.`);
		}
		namen.add(e.name);
	}

	const kodierer = new TextEncoder();
	const daten = new Schreiber();
	const verzeichnis = new Schreiber();

	for (const eintrag of eintraege) {
		const name = kodierer.encode(eintrag.name);
		const crc = pruefsumme(eintrag.inhalt);
		const beginn = daten.laenge;

		daten.zahl(LOKALER_KOPF, 4);
		daten.zahl(20, 2); // benötigte Fassung
		daten.zahl(UTF8_FLAGGE, 2);
		daten.zahl(0, 2); // ohne Verdichtung
		daten.zahl(zeitpunkt.zeit, 2);
		daten.zahl(zeitpunkt.datum, 2);
		daten.zahl(crc, 4);
		daten.zahl(eintrag.inhalt.length, 4);
		daten.zahl(eintrag.inhalt.length, 4);
		daten.zahl(name.length, 2);
		daten.zahl(0, 2); // kein Zusatzfeld
		daten.bytes(name);
		daten.bytes(eintrag.inhalt);

		verzeichnis.zahl(VERZEICHNISKOPF, 4);
		verzeichnis.zahl(20, 2); // erzeugende Fassung
		verzeichnis.zahl(20, 2); // benötigte Fassung
		verzeichnis.zahl(UTF8_FLAGGE, 2);
		verzeichnis.zahl(0, 2);
		verzeichnis.zahl(zeitpunkt.zeit, 2);
		verzeichnis.zahl(zeitpunkt.datum, 2);
		verzeichnis.zahl(crc, 4);
		verzeichnis.zahl(eintrag.inhalt.length, 4);
		verzeichnis.zahl(eintrag.inhalt.length, 4);
		verzeichnis.zahl(name.length, 2);
		verzeichnis.zahl(0, 2); // kein Zusatzfeld
		verzeichnis.zahl(0, 2); // keine Bemerkung
		verzeichnis.zahl(0, 2); // Datenträger 0
		verzeichnis.zahl(0, 2); // innere Merkmale
		verzeichnis.zahl(0, 4); // äussere Merkmale
		verzeichnis.zahl(beginn, 4);
		verzeichnis.bytes(name);
	}

	const alles = new Schreiber();
	const inhalt = daten.fertig();
	const eintragsteil = verzeichnis.fertig();
	alles.bytes(inhalt);
	alles.bytes(eintragsteil);
	alles.zahl(ABSCHLUSS, 4);
	alles.zahl(0, 2); // Datenträger
	alles.zahl(0, 2); // Datenträger mit Verzeichnis
	alles.zahl(eintraege.length, 2);
	alles.zahl(eintraege.length, 2);
	alles.zahl(eintragsteil.length, 4);
	alles.zahl(inhalt.length, 4);
	alles.zahl(0, 2); // keine Bemerkung
	return alles.fertig();
}
