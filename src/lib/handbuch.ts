import zuordnung from './handbuch-hilfe.json';

/**
 * Wo im Handbuch steht, was auf dieser Seite passiert.
 *
 * Die Zuordnung erzeugt `scripts/handbuch-bauen.mjs` zur Bauzeit; sie wird
 * hier eingebunden statt geholt. Ein Abruf zur Laufzeit wäre ein Flackern
 * beim ersten Rendern und ein Fehlerfall mehr — und sie ändert sich ohnehin
 * nur mit dem Abbild.
 *
 * Nicht in `src/lib/domain`: Das ist die Rechtslogik, und die kennt weder
 * Seiten noch Handbücher.
 */

export type Stelle = [kapitel: string, anker: string, titel: string];

// TypeScript liest die erzeugte JSON als string[] — die Dreierform steht nicht
// in der Datei, sondern im Erzeuger.
const KARTE = zuordnung as unknown as Record<string, Stelle>;

/**
 * Ein Schlüssel passt, wenn seine Segmente am Anfang des Pfads stehen; `*`
 * steht für genau ein Segment, etwa die Kennung der Gemeinschaft im Schlüssel
 * der Seite «Lesarten» (Lesarten Block 8: Ohne Platzhalter fiel sie auf die
 * Hilfe von `/gemeinschaften` zurück).
 */
function passtPraefix(pfad: string, schluessel: string): boolean {
	const teile = pfad.split('/');
	const muster = schluessel.split('/');
	if (muster.length > teile.length) return false;
	return muster.every((m, i) => (m === '*' ? teile[i] !== '' : m === teile[i]));
}

/**
 * Längster passender Präfix gewinnt: `/versammlungen/abc/traktanden` bekommt
 * damit die Hilfe von `/versammlungen`, und eine später ergänzte, genauere
 * Zuordnung sticht die allgemeinere, ohne dass hier etwas zu ändern wäre.
 */
export function stelleFuer(pfad: string): Stelle | null {
	let treffer: Stelle | null = null;
	let laenge = -1;
	for (const schluessel of Object.keys(KARTE)) {
		const passt = schluessel === '/' ? pfad === '/' : passtPraefix(pfad, schluessel);
		// zeichenzahl-frei: längster passender Pfad, ein Vergleich zweier Schlüssel.
		if (passt && schluessel.length > laenge) {
			treffer = KARTE[schluessel];
			laenge = schluessel.length;
		}
	}
	return treffer;
}

/**
 * Kennt eine Seite keine eigene Stelle, führt der Verweis zur Übersicht. Eine
 * Hilfe, die mal da ist und mal nicht, ist schlechter als eine, die immer
 * irgendwohin führt.
 */
export function handbuchZiel(pfad: string): { adresse: string; titel: string } {
	const stelle = stelleFuer(pfad);
	if (!stelle) return { adresse: '/handbuch/index.html', titel: 'Handbuch öffnen' };
	return {
		adresse: `/handbuch/${stelle[0]}.html${stelle[1] ? `#${stelle[1]}` : ''}`,
		titel: `Handbuch: ${stelle[2]}`
	};
}
