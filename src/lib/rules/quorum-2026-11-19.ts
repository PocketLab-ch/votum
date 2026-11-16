/**
 * Fassung 2026-11-19: Der Widerruf einer Übertragung an die Bewirtschaftung,
 * und der Freigabevermerk ohne die ausstehende juristische Gegenlesung
 * (Entscheid 0052; Produktentscheid 16.11.2026: «Gegenlesung gemäss 0044
 * streichen», neue Fassung zusammen mit der Meldung der Website vom selben
 * Tag, dass der Widerruf einer Übertragung fehlt).
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-18 abgeleitet, nicht
 * abgeschrieben. Die Fassung 2026-11-18 bleibt unverändert; ältere Fassungen
 * tragen den Satz zur Gegenlesung weiter, als das, was damals galt.
 *
 * **Was sich ändert:**
 *
 *  - Hinter dem Satz zur Erweiterung der Kompetenzen (`ERWEITERUNG` der Fassung
 *    2026-10-23) steht, wie die Versammlung eine solche Übertragung
 *    zurücknimmt: jederzeit mit einfachem Mehr; steht sie im Reglement, mit
 *    dem Mehr für eine Reglementsänderung, ohne eigene Regel dem
 *    qualifizierten; der Verwaltungsvertrag bleibt vorbehalten (SVIT-Kommentar
 *    Rz. 42 ad Art. 712m, Rz. 70 ad Art. 712s). Ohne den Satz lasen Laien, auch
 *    das Zurücknehmen brauche alle (Laienprüfung der Website, 16.11.2026).
 *    Ausgang ist die Website-Karte `#faq-pflichtenheft`, geschärft nach der
 *    eigenen Laien- und Fachprüfung (bei `WIDERRUF`). Ersetzt wird überall,
 *    wo der Satz im Regelwerk steht (`STELLEN`), an beiden Wahlkarten der
 *    Bewirtschaftung; dazu der Verweis auf die zweite Wahlkarte (`FOLGESATZ`).
 *  - Im Freigabevermerk entfällt «Die juristische Gegenlesung steht aus»
 *    (Entscheid 0044: die offenen Rechtsfragen eingeordnet, fest gerechnet
 *    oder als Lesart einstellbar; Entscheid 0052). Der Vorschlag an die Sitzungsleitung bleibt.
 *
 * **Am Ergebnis ändert sich nichts:** kein Erfordernis, kein Weg, keine Lesart.
 * `juristischGegengelesen` bleibt `false`, denn es beschreibt eine Tatsache;
 * es steuert seit dieser Fassung keine Anzeige mehr (Entscheid 0052).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_18 } from './quorum-2026-11-18';
import { nachDieserFassung as nachDerVorfassung } from './quorum-2026-11-17';
import { ERWEITERUNG as ERWEITERUNG_VORHER } from './quorum-2026-10-23';

const VOR = REGELWERK_2026_11_18;

/**
 * Der Widerruf, nach `#faq-pflichtenheft` der Website, geschärft nach der
 * internen Laien- und Fachprüfung vom 16.11.2026:
 * «beides» für beide Fälle des Satzes davor (Rz. 70 ad Art. 712s gilt für jede
 * Einschränkung, Rz. 42 ad Art. 712m für die Delegation), «jederzeit» aus
 * Rz. 42, das Mehr des Reglements statt fest des qualifizierten (Lesart L6
 * kennt die erschwerte Klausel), und die finanziellen Folgen nach Vertrag und
 * OR Art. 404 Abs. 2 (Runde 2: Fach 1.3, Laien A1 und A4).
 */
export const WIDERRUF =
	'Zurücknehmen kann die Versammlung beides jederzeit mit einfachem Mehr (SVIT-Kommentar Rz. 42 ad ' +
	'Art. 712m, Rz. 70 ad Art. 712s). Steht eine solche Übertragung im Reglement, braucht es das Mehr, das ' +
	'Ihr Reglement für seine eigene Änderung verlangt, sonst das qualifizierte (ZGB Art. 712g Abs. 3). ' +
	'Finanzielle Folgen einer Rücknahme bleiben vorbehalten (Rz. 42 ad Art. 712m). Dazu gehört, was der ' +
	'Verwaltungsvertrag etwa zum Honorar vorsieht, und Schadenersatz, wenn die Rücknahme zur Unzeit kommt ' +
	'(OR Art. 404 Abs. 2). ' +
	'Lesen Sie den Vertrag deshalb vor der Versammlung nach.';

/** Der Satz zur Erweiterung, wie er ab dieser Fassung lautet. */
export const ERWEITERUNG = `${ERWEITERUNG_VORHER} ${WIDERRUF}`;

/** Wie oft der Satz im Regelwerk der Vorfassung steht (Hinweise, Ersatz und Lesart der zwei Wahlkarten). */
export const STELLEN = 6;

/**
 * Der Verweis auf die zweite Wahlkarte (Fassung 2026-10-24): «solche
 * Kompetenzen» stand nach dem Widerruf zu weit vom Bezugswort (Laienprüfung 1c).
 */
export const FOLGESATZ_VORHER = 'Hat die Bewirtschaftung solche Kompetenzen schon,';
export const FOLGESATZ = 'Hat die Bewirtschaftung schon Kompetenzen über die gewöhnliche Verwaltung hinaus,';

/** Der Satz des Freigabevermerks seit der Fassung 2026-07-30. */
export const GEGENLESUNG_VORHER =
	'Die juristische Gegenlesung steht aus; bis dahin ist jedes Ergebnis ein Vorschlag an die Sitzungsleitung ' +
	'und keine Feststellung.';
export const VORSCHLAG = 'Jedes Ergebnis ist ein Vorschlag an die Sitzungsleitung und keine Feststellung.';

/** Ersetzt in jedem Text des Regelwerks und zählt, wie oft. */
function ersetzeUeberall<T>(wert: T, alt: string, neu: string, zaehler: { n: number }): T {
	if (typeof wert === 'string') {
		const teile = wert.split(alt);
		zaehler.n += teile.length - 1;
		return teile.join(neu) as T;
	}
	if (Array.isArray(wert)) return wert.map((w) => ersetzeUeberall(w, alt, neu, zaehler)) as T;
	if (wert && typeof wert === 'object') {
		return Object.fromEntries(
			Object.entries(wert).map(([k, w]) => [k, ersetzeUeberall(w, alt, neu, zaehler)])
		) as T;
	}
	return wert;
}

const zaehler = { n: 0 };
const folge = { n: 0 };
const ERSETZT = ersetzeUeberall(
	ersetzeUeberall(VOR, ERWEITERUNG_VORHER, ERWEITERUNG, zaehler),
	FOLGESATZ_VORHER,
	FOLGESATZ,
	folge
);
if (zaehler.n !== STELLEN) {
	throw new Error(`Fassung 2026-11-19: Der Satz zur Erweiterung steht ${zaehler.n}-mal statt ${STELLEN}-mal.`);
}
if (folge.n !== 1) {
	throw new Error(`Fassung 2026-11-19: Der Verweis auf die zweite Wahlkarte steht ${folge.n}-mal statt einmal.`);
}
if (VOR.freigabevermerk.split(GEGENLESUNG_VORHER).length - 1 !== 1) {
	throw new Error('Fassung 2026-11-19: Der Satz zur Gegenlesung steht im Freigabevermerk nicht genau einmal.');
}

/**
 * Ein Wortlaut der Fassungen 2026-11-13 bis 2026-11-18, wie er in dieser
 * Fassung lautet: die Ersetzungen der Vorfassungen und der Widerruf. Für den
 * Website-Abzug.
 */
export function nachDieserFassung(text: string): string {
	return nachDerVorfassung(text)
		.split(ERWEITERUNG_VORHER)
		.join(ERWEITERUNG)
		.split(FOLGESATZ_VORHER)
		.join(FOLGESATZ);
}

export const REGELWERK_2026_11_19 = {
	...ERSETZT,
	fassung: '2026-11-19',

	freigabevermerk:
		VOR.freigabevermerk.replace(GEGENLESUNG_VORHER, VORSCHLAG) +
		' In der Fassung 2026-11-19 sagt der Hinweis zur Wahl der Bewirtschaftung auch, wie die Versammlung ' +
		'eine Übertragung an die Bewirtschaftung zurücknimmt; am Ergebnis ändert sich nichts.'
} satisfies Regelwerk;
