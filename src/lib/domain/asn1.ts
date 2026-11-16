/**
 * DER lesen und schreiben — so viel, wie ein Zeitstempel braucht (rein).
 *
 * **Warum von Hand.** Ein Zeitstempel nach RFC 3161 ist ein kleines
 * ASN.1-Dokument: eine Handvoll Sequenzen, ein OID, ein Hash. Eine Bibliothek
 * dafür brächte eine Abhängigkeit an genau die Stelle, an der es um die
 * Beweiskraft geht — und die Frage, was sie beim nächsten Sicherheitsdurchgang
 * mitbringt. Was hier steht, ist überschaubar und Byte für Byte prüfbar.
 *
 * **Nur DER, nicht BER.** Die längenunbestimmte Form kommt in Zeitstempeln
 * nicht vor; sie zu unterstützen hiesse, einen Fall zu behandeln, den es hier
 * nicht gibt, und dabei Fehler zu machen, die niemand sieht.
 *
 * Der Leser **wirft**, wo etwas nicht stimmt, statt zu raten. Ein
 * fehlinterpretierter Zeitstempel wäre schlimmer als gar keiner: Er behauptete
 * etwas, das niemand geprüft hat.
 */

export interface Element {
	/** Das rohe Kennzeichen, etwa 0x30 für SEQUENCE oder 0xA0 für [0]. */
	kennzeichen: number;
	/** Der Inhalt ohne Kennzeichen und Länge. */
	inhalt: Uint8Array;
	/** Das ganze Element **mit** Kennzeichen und Länge — für Signaturprüfungen. */
	roh: Uint8Array;
}

export const SEQUENCE = 0x30;
export const SET = 0x31;
export const INTEGER = 0x02;
export const BIT_STRING = 0x03;
export const OCTET_STRING = 0x04;
export const NULL_ELEMENT = 0x05;
export const OID = 0x06;
export const BOOLEAN = 0x01;
export const GENERALIZED_TIME = 0x18;

export class DerFehler extends Error {
	constructor(nachricht: string) {
		super(nachricht);
		this.name = 'DerFehler';
	}
}

/** Liest ein einzelnes Element ab `stelle` und sagt, wo das nächste beginnt. */
export function lies(daten: Uint8Array, stelle = 0): { element: Element; naechste: number } {
	if (stelle + 2 > daten.length) throw new DerFehler('Abgeschnitten: kein Kennzeichen.');
	const kennzeichen = daten[stelle];
	let i = stelle + 1;

	let laenge = daten[i++];
	if (laenge === 0x80) {
		throw new DerFehler('Längenunbestimmte Form (BER) — in DER nicht zulässig.');
	}
	if (laenge > 0x80) {
		const bytes = laenge & 0x7f;
		if (bytes > 4) throw new DerFehler('Länge grösser als 4 GB — das ist kein Zeitstempel.');
		laenge = 0;
		for (let n = 0; n < bytes; n++) laenge = (laenge << 8) | daten[i++];
	}

	const ende = i + laenge;
	if (ende > daten.length) throw new DerFehler('Abgeschnitten: der Inhalt reicht über das Ende.');

	return {
		element: {
			kennzeichen,
			inhalt: daten.subarray(i, ende),
			roh: daten.subarray(stelle, ende)
		},
		naechste: ende
	};
}

/** Alle Elemente einer Folge, der Reihe nach. */
export function folge(inhalt: Uint8Array): Element[] {
	const aus: Element[] = [];
	let stelle = 0;
	while (stelle < inhalt.length) {
		const { element, naechste } = lies(inhalt, stelle);
		aus.push(element);
		stelle = naechste;
	}
	return aus;
}

/** Der Inhalt eines Elements, das selbst eine Folge ist. */
export function kinder(element: Element): Element[] {
	return folge(element.inhalt);
}

/** Eine OID als Punktschreibweise, etwa «1.2.840.113549.1.7.2». */
export function oidInWorten(element: Element): string {
	if (element.kennzeichen !== OID) throw new DerFehler('Kein OID.');
	const b = element.inhalt;
	if (b.length === 0) throw new DerFehler('Leeres OID.');
	const teile = [Math.floor(b[0] / 40), b[0] % 40];
	let wert = 0;
	for (let i = 1; i < b.length; i++) {
		wert = wert * 128 + (b[i] & 0x7f);
		if ((b[i] & 0x80) === 0) {
			teile.push(wert);
			wert = 0;
		}
	}
	return teile.join('.');
}

/** Eine ganze Zahl — nur so gross, wie sie hier vorkommt. */
export function ganzzahl(element: Element): number {
	if (element.inhalt.length > 6) {
		throw new DerFehler('Zahl grösser, als hier vorgesehen ist.');
	}
	let wert = 0;
	for (const b of element.inhalt) wert = wert * 256 + b;
	return wert;
}

/**
 * Eine GeneralizedTime als ISO-Zeitpunkt.
 *
 * Zeitstempel tragen «20260804T…Z»-Formen ohne Trennzeichen. Der Zeitpunkt ist
 * die Aussage des Dienstes und wird deshalb wörtlich übernommen, nicht
 * gerundet — auch die Bruchteile bleiben.
 */
export function zeitpunkt(element: Element): string {
	const t = new TextDecoder().decode(element.inhalt);
	const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(t);
	if (!m) throw new DerFehler(`Unerwartete Zeitangabe «${t}».`);
	return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? ''}Z`;
}

// ── Schreiben ───────────────────────────────────────────────────────────────

function laengenbytes(laenge: number): number[] {
	if (laenge < 0x80) return [laenge];
	const bytes: number[] = [];
	let rest = laenge;
	while (rest > 0) {
		bytes.unshift(rest & 0xff);
		rest >>>= 8;
	}
	return [0x80 | bytes.length, ...bytes];
}

export function schreibe(kennzeichen: number, inhalt: Uint8Array | number[]): Uint8Array {
	const werte = inhalt instanceof Uint8Array ? inhalt : Uint8Array.from(inhalt);
	const kopf = [kennzeichen, ...laengenbytes(werte.length)];
	const aus = new Uint8Array(kopf.length + werte.length);
	aus.set(kopf, 0);
	aus.set(werte, kopf.length);
	return aus;
}

export function verkette(...teile: Uint8Array[]): Uint8Array {
	const laenge = teile.reduce((s, t) => s + t.length, 0);
	const aus = new Uint8Array(laenge);
	let stelle = 0;
	for (const t of teile) {
		aus.set(t, stelle);
		stelle += t.length;
	}
	return aus;
}

/** Eine OID aus der Punktschreibweise. */
export function schreibeOid(punkte: string): Uint8Array {
	const teile = punkte.split('.').map(Number);
	if (teile.length < 2) throw new DerFehler(`Unbrauchbares OID «${punkte}».`);
	const bytes = [teile[0] * 40 + teile[1]];
	for (const t of teile.slice(2)) {
		const gruppen: number[] = [];
		let rest = t;
		do {
			gruppen.unshift(rest & 0x7f);
			rest = Math.floor(rest / 128);
		} while (rest > 0);
		for (let i = 0; i < gruppen.length - 1; i++) gruppen[i] |= 0x80;
		bytes.push(...gruppen);
	}
	return schreibe(OID, bytes);
}

/** Eine positive ganze Zahl. Das führende Nullbyte gehört dazu, wo nötig. */
export function schreibeGanzzahl(wert: number | Uint8Array): Uint8Array {
	let bytes: number[];
	if (typeof wert === 'number') {
		bytes = [];
		let rest = Math.max(0, Math.trunc(wert));
		do {
			bytes.unshift(rest & 0xff);
			rest = Math.floor(rest / 256);
		} while (rest > 0);
	} else {
		bytes = [...wert];
		while (bytes.length > 1 && bytes[0] === 0) bytes.shift();
	}
	if (bytes[0] & 0x80) bytes.unshift(0);
	return schreibe(INTEGER, bytes);
}
