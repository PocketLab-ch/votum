/**
 * Persönliche Zugänge zur Versammlung (Story 3.7, FR-29, NFR-5, AD-1).
 *
 * Ein Zugang ist ein Geheimnis, das auf Papier aus dem Haus geht. Daraus folgt
 * alles Weitere:
 *
 *   - Gespeichert wird nur ein **Prüfwert**, nie der Code selbst. Ein
 *     Datenbankauszug — ein Backup auf einem verlorenen Datenträger, ein
 *     Prüfbericht mit Beispieldaten — gibt dann keine gültigen Zugänge preis
 *     (NFR-5).
 *   - Der Code ist so lang, dass Raten aussichtslos ist, und so kurz, dass er
 *     sich abtippen lässt, wenn der QR-Code nicht gelesen wird.
 *   - Ein neu erzeugter Code macht den alten ungültig. Zwei gültige Zugänge zu
 *     derselben Person wären zwei Stimmrechte.
 *
 * Der Kern erzeugt hier keine Zufallszahlen — das wäre I/O. Er bestimmt die
 * Gestalt des Codes, prüft sie und rechnet den Prüfwert **nicht**: Auch das
 * gehört in die Schale, weil eine Streufunktion aus `node:crypto` kommt.
 */
import { FachlicherFehler } from './gemeinschaft';
import { zeichenzahl } from './zeichenzahl';

/**
 * Das Alphabet des Zugangscodes.
 *
 * Ohne I, l, O, 0, 1: Auf Papier sind sie nicht auseinanderzuhalten, und wer
 * den Code abtippt, weil die Kamera streikt, tippt ihn im Saal ab — unter
 * Zeitdruck und oft ohne Brille. Ohne U und V, die handschriftlich verwechselt
 * werden. Grossbuchstaben, weil sie auf Papier klarer sind.
 */
export const ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789';

/**
 * Länge des Codes.
 *
 * 20 Zeichen aus 29 Möglichkeiten ergeben rund 97 Bit. Raten scheidet damit
 * aus, auch ohne Sperre nach zu vielen Versuchen — und eine Sperre wäre hier
 * gefährlich, weil sie sich zum Aussperren einzelner Eigentümer missbrauchen
 * liesse.
 */
export const CODELAENGE = 20;

/** In Vierergruppen, damit er sich abschreiben lässt: `ABCD-EFGH-JKMN-PQRS-TWXY`. */
export function gruppiere(code: string): string {
	return (code.match(/.{1,4}/g) ?? []).join('-');
}

/** Nimmt Gruppierung, Leerzeichen und Kleinschreibung entgegen. */
export function normalisiere(eingabe: string): string {
	return (eingabe ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Was ein Scanner liefert, auf den Code zurückgeführt.
 *
 * **Der QR-Code der Zugangskarte trägt eine Adresse**, nicht den blossen Code:
 * `https://…/z/ABCD-EFGH-JKMN-PQRS-TWXY`. Das ist Absicht — wer ihn mit der
 * Kamera-App des Telefons scannt, landet damit auf der Seite. Ein Scanner in
 * der Sitzungsleitung bekommt aber dieselbe Zeichenkette und braucht daraus
 * den Code.
 *
 * `normalisiere()` allein genügt dafür **nicht**: Sie wirft alles weg, was kein
 * Buchstabe und keine Ziffer ist — aus der Adresse würde
 * `HTTPSBEISPIELDEV…ZABCDEFGHJKMNPQRSTWXY`, also ein Code, den es nicht
 * gibt, mit einer Fehlermeldung, die niemandem sagt, was los ist.
 *
 * Genommen wird der **letzte Pfadteil**, ohne Abfrageteil und Sprungmarke. Ein
 * blosser Code bleibt ein blosser Code: Er hat keinen Schrägstrich, und dann
 * ist er selbst der letzte Teil.
 */
export function codeAusScan(eingabe: string): string {
	const roh = (eingabe ?? '').trim();
	const ohneAnhang = roh.split(/[?#]/)[0];
	const teile = ohneAnhang.split('/').filter((t) => t.length > 0);
	return normalisiere(teile.length > 0 ? teile[teile.length - 1] : ohneAnhang);
}

export function pruefeCode(eingabe: string): string {
	const code = normalisiere(eingabe);
	if (zeichenzahl(code) !== CODELAENGE) {
		throw new FachlicherFehler(
			'code_laenge',
			`Ein Zugangscode hat ${CODELAENGE} Zeichen.`,
			'code'
		);
	}
	for (const zeichen of code) {
		if (!ALPHABET.includes(zeichen)) {
			throw new FachlicherFehler(
				'code_zeichen',
				`Das Zeichen «${zeichen}» kommt in einem Zugangscode nicht vor.`,
				'code'
			);
		}
	}
	return code;
}

/**
 * Baut den Code aus Zufallsbytes.
 *
 * Die Bytes kommen von aussen — der Kern liest keinen Zufallsgenerator. Die
 * Zuordnung Byte → Zeichen geschieht ohne Modulo über die Alphabetlänge: 256
 * ist kein Vielfaches von 29, ein einfaches `byte % 29` bevorzugte die ersten
 * neun Zeichen leicht. Bei einem Zugangscode ist das keine akademische Feinheit,
 * sondern eine Einschränkung des Suchraums.
 */
export function codeAus(bytes: Uint8Array): string {
	return codeMitLaenge(bytes, CODELAENGE);
}

/**
 * Die gemeinsame Zuordnung Byte → Zeichen für alle drei Codearten.
 *
 * Einmal geschrieben, weil die Verwerfungsregel der heikle Teil ist: Sie
 * dreimal zu wiederholen hiesse, dreimal die Gelegenheit zu haben, sie falsch
 * zu wiederholen.
 */
function codeMitLaenge(bytes: Uint8Array, laenge: number): string {
	const grenze = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
	let code = '';
	for (const b of bytes) {
		if (b >= grenze) continue; // verworfen, nicht verbogen
		code += ALPHABET[b % ALPHABET.length];
		// zeichenzahl-frei: Aufbau des Codes aus einem ASCII-Alphabet; Einheit und Zeichen sind dasselbe.
		if (code.length === laenge) break;
	}
	// zeichenzahl-frei: Code aus einem ASCII-Alphabet; Einheit und Zeichen sind dasselbe.
	if (code.length < laenge) {
		throw new FachlicherFehler(
			'zu_wenig_zufall',
			'Es standen zu wenige Zufallsbytes zur Verfügung.',
			'bytes'
		);
	}
	return code;
}

/** Wie viele Zufallsbytes zu holen sind, damit der Code in aller Regel in einem Zug entsteht. */
export function noetigeBytes(): number {
	// Rund 12 % der Bytes werden verworfen; mit dem doppelten Bedarf ist die
	// Wahrscheinlichkeit, ein zweites Mal holen zu müssen, verschwindend.
	return CODELAENGE * 2;
}

// ── Der Ausgabecode für den Ausnahmefall ────────────────────────────────────
//
// **Wofür er da ist.** Der Regelfall ist die persönliche Karte: QR scannen,
// fertig. Die Ausnahme ist, dass das nicht geht — Karte vergessen, Kamera zu
// alt, Papier zerknittert. Dann gibt die Sitzungsleitung im Saal einen Code
// heraus, den die Person eintippt.
//
// **Warum er kurz ist.** Er wird vorgelesen oder auf einen Zettel geschrieben,
// vor einem Saal voller Leute. Zwanzig Zeichen sind dafür unbrauchbar; acht in
// zwei Gruppen sind es nicht. Die Kürze ist vertretbar, weil dieser Code
// **wenige Minuten lebt und genau einmal gilt** — er wird beim Einlösen sofort
// gegen eine Gerätesitzung getauscht und verfällt.
//
// **Warum er die Karte nicht entwertet.** Wer sie fünf Minuten später doch noch
// in der Tasche findet, soll sie benutzen können. Der Ausgabecode ist ein
// zweiter Weg zum selben Zugang, kein Ersatz dafür.

/** Acht Zeichen aus 29 ergeben rund 39 Bit — bei 15 Minuten Gültigkeit reichlich. */
export const AUSGABECODELAENGE = 8;

/** Wie lange ein ausgegebener Code gilt. */
export const AUSGABECODE_GUELTIG_MINUTEN = 15;

export function ausgabecodeAus(bytes: Uint8Array): string {
	return codeMitLaenge(bytes, AUSGABECODELAENGE);
}

/** Ob eine Eingabe die Gestalt eines Ausgabecodes hat. */
export function istAusgabecode(eingabe: string): boolean {
	const code = normalisiere(eingabe);
	return zeichenzahl(code) === AUSGABECODELAENGE && [...code].every((z) => ALPHABET.includes(z));
}

/** Ob eine Eingabe die Gestalt eines Kartencodes hat. */
export function istKartencode(eingabe: string): boolean {
	const code = normalisiere(eingabe);
	return zeichenzahl(code) === CODELAENGE && [...code].every((z) => ALPHABET.includes(z));
}

/**
 * Prüft eine Eingabe, die beides sein kann.
 *
 * Die Person weiss nicht, welche Art Code sie in der Hand hält — sie tippt, was
 * dasteht. Ein Formular, das nach der Art fragt, verlangt Wissen, das niemand
 * hat.
 */
export type Codeart = 'karte' | 'ausgabe';

export function erkenneCodeart(eingabe: string): Codeart | null {
	if (istKartencode(eingabe)) return 'karte';
	if (istAusgabecode(eingabe)) return 'ausgabe';
	return null;
}

export function pruefeIrgendeinenCode(eingabe: string): { code: string; art: Codeart } {
	const code = normalisiere(eingabe);
	const art = erkenneCodeart(code);
	if (art) return { code, art };

	// Die Meldung nennt beide Längen: Wer sich vertippt hat, sieht sofort, ob
	// ein Zeichen fehlt oder eines zu viel ist.
	for (const zeichen of code) {
		if (!ALPHABET.includes(zeichen)) {
			throw new FachlicherFehler(
				'code_zeichen',
				`Das Zeichen «${zeichen}» kommt in einem Zugangscode nicht vor.`,
				'code'
			);
		}
	}
	throw new FachlicherFehler(
		'code_laenge',
		`Der Code hat ${code.length} Zeichen. Der Code auf der Karte hat ${CODELAENGE}, ` +
			`der von der Sitzungsleitung ausgegebene ${AUSGABECODELAENGE}.`,
		'code'
	);
}

// ── Der Anzeigecode für die Präsentationssicht ──────────────────────────────
//
// **Wofür.** Die Sicht auf der Leinwand hängt an einer eigenen Adresse, damit
// sie auf einem zweiten Gerät läuft. Ohne Schutz läse sie jeder, der die
// Adresse errät — und eine Eigentümerversammlung ist nicht öffentlich.
//
// **Warum er anders lang ist.** Er wird einmal beim Aufbau eingetippt, nicht im
// Saal unter Zeitdruck und nicht von vierzehn Leuten. Zwölf Zeichen aus 29
// ergeben rund 58 Bit — genug für die Dauer einer Versammlung. Kürzer als der
// Kartencode, weil er auf einer Tastatur getippt wird und nicht auf einem
// Telefon; länger als der Ausgabecode, weil er nicht nach Minuten verfällt.
//
// **Was er nicht ist.** Kein Stimmrecht. Wer ihn hat, sieht, was ohnehin alle
// im Saal sehen — nie einen Namen im Zusammenhang mit Stimmverhalten (AD-11).

export const ANZEIGECODELAENGE = 12;

export function anzeigecodeAus(bytes: Uint8Array): string {
	return codeMitLaenge(bytes, ANZEIGECODELAENGE);
}

export function istAnzeigecode(eingabe: string): boolean {
	const code = normalisiere(eingabe);
	return zeichenzahl(code) === ANZEIGECODELAENGE && [...code].every((z) => ALPHABET.includes(z));
}

export function pruefeAnzeigecode(eingabe: string): string {
	const code = normalisiere(eingabe);
	if (!istAnzeigecode(code)) {
		for (const zeichen of code) {
			if (!ALPHABET.includes(zeichen)) {
				throw new FachlicherFehler(
					'code_zeichen',
					`Das Zeichen «${zeichen}» kommt in einem Code für die Leinwand nicht vor.`,
					'code'
				);
			}
		}
		throw new FachlicherFehler(
			'code_laenge',
			`Ein Code für die Leinwand hat ${ANZEIGECODELAENGE} Zeichen, eingegeben wurden ${code.length}.`,
			'code'
		);
	}
	return code;
}

/** Der Verweis auf die Präsentationssicht, wie ihn die Sitzungsleitung weitergibt. */
export function anzeigeLink(basis: string, code: string): string {
	return `${basis.replace(/\/+$/, '')}/p/${normalisiere(code)}`;
}

/** Zustand eines Zugangs. */
export type Zugangszustand = 'gueltig' | 'ersetzt' | 'entwertet';

export interface Zugang {
	id: string;
	meetingId: string;
	snapshotPartyId: string;
	/** Nur der Prüfwert. Der Code selbst existiert nach dem Erzeugen nur auf Papier. */
	pruefwert: string;
	zustand: Zugangszustand;
	erzeugtAm?: string;
}

/**
 * Der Link auf der Zugangskarte.
 *
 * Der Code steht im Pfad und nicht in der Abfrage: Ein Abfrageteil landet in
 * Zugriffsprotokollen von Zwischenstellen. Im Pfad tut er das ebenfalls, aber
 * die Karte trägt ohnehin denselben Code als Text — entscheidend ist, dass er
 * mit dem Schliessen der Versammlung wertlos wird.
 */
export function zugangsLink(basis: string, code: string): string {
	const stamm = basis.replace(/\/+$/, '');
	return `${stamm}/z/${normalisiere(code)}`;
}

/**
 * Ob ein Zugang gerade Zutritt gibt.
 *
 * Nicht nur der Zustand des Zugangs zählt, sondern auch der der Versammlung:
 * Nach dem Schliessen ist jeder Code wertlos, ohne dass er dafür einzeln
 * entwertet werden müsste. Sonst hinge die Gültigkeit an einem Aufräumschritt,
 * der auch ausbleiben kann.
 */
export function gibtZutritt(
	zugang: Pick<Zugang, 'zustand'>,
	versammlungszustand: string
): boolean {
	if (zugang.zustand !== 'gueltig') return false;
	return ['freigegeben', 'laufend'].includes(versammlungszustand);
}

/** Warum ein Zugang nicht greift — in einem Satz für die Person davor. */
export function zutrittsgrund(
	zugang: Pick<Zugang, 'zustand'>,
	versammlungszustand: string
): string | null {
	if (gibtZutritt(zugang, versammlungszustand)) return null;
	if (zugang.zustand === 'ersetzt') {
		return 'Dieser Zugang wurde durch einen neuen ersetzt. Es gilt die zuletzt zugestellte Karte.';
	}
	if (zugang.zustand === 'entwertet') {
		return 'Dieser Zugang wurde entwertet.';
	}
	if (versammlungszustand === 'entwurf') {
		return 'Die Versammlung ist noch nicht einberufen.';
	}
	/*
	 * **Ohne «wertlos»** (04.09.2026). In der Stunde nach dem Schluss zeigt das
	 * Telefon darunter, was beschlossen wurde; «der Zugang ist damit wertlos»
	 * stünde dann über einer Seite, die sehr wohl noch etwas zeigt. Danach
	 * stimmt der Satz wieder, aber dann liest ihn ohnehin niemand mehr im Saal.
	 */
	return 'Die Versammlung ist geschlossen. Abgestimmt wird nicht mehr.';
}
