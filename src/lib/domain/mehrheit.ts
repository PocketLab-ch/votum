/**
 * Schwellwerte für Mehrheiten. Reine Funktionen, keine Abhängigkeiten (AD-1).
 *
 * Bewusst getrennt von der Auszählung: Die Schwelle ist eine Rechenregel, die
 * Bezugsgrösse eine Rechtsfrage. Wer beides vermischt, kann später nicht mehr
 * erklären, warum eine Zahl herauskam.
 */

/**
 * Wie ein Bruch zu lesen ist.
 *
 * `mehr_als` — mehr als der Bruch. Das gesetzliche «Mehrheit» meint mehr als die
 * Hälfte; Gleichstand ist Ablehnung.
 * `mindestens` — der Bruch selbst genügt. Ein Reglement, das ein Zweidrittelmehr
 * verlangt, meint in aller Regel «mindestens zwei Drittel».
 *
 * Der Unterschied ist keine Spitzfindigkeit: Bei 6 Stimmen und zwei Dritteln
 * sind es 5 oder 4 Ja-Stimmen, je nach Lesart.
 */
export type Schwellenart = 'mehr_als' | 'mindestens';

export interface Schwelle {
	zaehler: number;
	nenner: number;
	art: Schwellenart;
}

/**
 * Wie viele Ja-Stimmen es braucht, um den Bruch zu erreichen.
 *
 * Ganzzahlig gerechnet (AD-12): kein Gleitkomma, damit bei 1000 Wertquoten und
 * zwei Dritteln nicht 666.6666666666666 entsteht, aus dem je nach Rundungsstelle
 * 666 oder 667 wird.
 */
// Wer diese Rechnung ändert, ändert auch die Auszählmappe: Sie legt dieselbe
// Schwelle als Formel ins Blatt (`auszaehlmappe.ts`). Nachweis, dass beide
// dasselbe ergeben: `node scripts/mappe-nachrechnen.mjs`.
export function schwelle(basis: number, s: Schwelle): number {
	if (!Number.isInteger(basis)) {
		throw new TypeError(`Bezugsgrösse muss ganzzahlig sein, war: ${basis}`);
	}
	if (basis < 0) {
		throw new RangeError(`Bezugsgrösse darf nicht negativ sein, war: ${basis}`);
	}
	if (!Number.isInteger(s.zaehler) || !Number.isInteger(s.nenner)) {
		throw new TypeError('Zähler und Nenner einer Schwelle müssen ganzzahlig sein.');
	}
	if (s.nenner <= 0 || s.zaehler <= 0) {
		throw new RangeError('Zähler und Nenner einer Schwelle müssen grösser als null sein.');
	}
	if (s.zaehler > s.nenner) {
		throw new RangeError('Eine Schwelle über der ganzen Bezugsgrösse wäre nie erreichbar.');
	}
	if (basis === 0) return 0;

	const produkt = basis * s.zaehler;
	return s.art === 'mehr_als' ? Math.floor(produkt / s.nenner) + 1 : Math.ceil(produkt / s.nenner);
}

/** Die gesetzliche Mehrheit: mehr als die Hälfte. */
export const EINFACHE_MEHRHEIT: Schwelle = { zaehler: 1, nenner: 2, art: 'mehr_als' };

/** Einstimmigkeit als Bruch: die ganze Bezugsgrösse. */
export const ALLE: Schwelle = { zaehler: 1, nenner: 1, art: 'mindestens' };

/**
 * Wie viele Ja-Stimmen es braucht, um eine Bezugsgrösse zu überstimmen.
 *
 * `floor(basis / 2) + 1` (AD-12). Bei 15 Stimmen sind es 8, bei 20 sind es 11.
 * Gleichstand bedeutet Ablehnung: Ein Antrag braucht mehr Ja als die Hälfte,
 * nicht die Hälfte.
 */
export function mehrheitsschwelle(basis: number): number {
	return schwelle(basis, EINFACHE_MEHRHEIT);
}

/**
 * Schwelle für die absolute Wertquotenmehrheit beim qualifizierten Mehr.
 *
 * Anders als bei den Köpfen ist die Bezugsgrösse hier nicht die Versammlung,
 * sondern die Gemeinschaft: mehr als die Hälfte *aller* Wertquoten. Bei 1000
 * Tausendsteln sind das 501.
 */
export function quotenschwelle(gesamtquote: number): number {
	return mehrheitsschwelle(gesamtquote);
}

/** Zähler und Nenner durch ihren grössten gemeinsamen Teiler. */
function gekuerzt(s: Schwelle): Schwelle {
	const teiler = (a: number, b: number): number => (b === 0 ? a : teiler(b, a % b));
	const t = teiler(Math.abs(s.zaehler), Math.abs(s.nenner)) || 1;
	return { ...s, zaehler: s.zaehler / t, nenner: s.nenner / t };
}

/**
 * Der Bruch in Worten, für die Ergebniskarte.
 *
 * **Gekürzt, bevor nachgeschlagen wird** (04.09.2026, aus dem Code-Review). Die
 * Tabelle kennt fünf Brüche in ihrer gekürzten Form; ein hinterlegtes 2/4 fiel
 * deshalb auf «2 von 4 Teilen» zurück, obwohl es dieselbe Hälfte meint. Das
 * Kürzen ändert am Wert nichts und macht den Satz lesbar.
 */
export function schwelleInWorten(roh: Schwelle): string {
	const s = gekuerzt(roh);
	if (s.zaehler === s.nenner) return 'alle Stimmen';
	const brueche: Record<string, string> = {
		'1/2': 'die Hälfte',
		'2/3': 'zwei Drittel',
		'3/4': 'drei Viertel',
		'3/5': 'drei Fünftel',
		'4/5': 'vier Fünftel'
	};
	const bruch = brueche[`${s.zaehler}/${s.nenner}`] ?? `${s.zaehler} von ${s.nenner} Teilen`;
	return s.art === 'mehr_als' ? `mehr als ${bruch}` : `mindestens ${bruch}`;
}
