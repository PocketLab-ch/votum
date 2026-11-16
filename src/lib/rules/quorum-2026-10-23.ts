/**
 * Fassung 2026-10-23: Vorbehalt der Einstimmigkeit an der Wahl der
 * Bewirtschaftung.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Erfordernis und keinen
 * Weg. Sie ersetzt im Hinweis von `k-bewirtschaftung-waehlen` den ersten Satz
 * (`ERWEITERUNG` der Fassung 2026-10-21), ohne Regel und unter einer Regel.
 *
 * **Der Anlass** ist die Prüfung des Website-Abzugs vom 20.10.2026: Der Satz
 * sagte «braucht diese Erweiterung einen eigenen Beschluss mit qualifiziertem
 * Mehr» ohne Vorbehalt. Soll die Bewirtschaftung statt der Versammlung
 * entscheiden, etwa Budget oder Fondseinlagen festlegen, braucht es
 * Einstimmigkeit (Rz. 46 ad Art. 712q, Rz. 91 ad Art. 712g, Rz. 45 ad
 * Art. 712m). Die Website nennt den Vorbehalt in eigener Fassung seit Website
 * `f5cbf54` (Abzug aus `d8712ce`); hier zieht die Anwendung nach (Produktentscheid 20.10.2026: «Hinweis jetzt angleichen»).
 * **Wie gerechnet wird, ändert sich nicht:** `k-bewirtschaftung-erweitert`
 * rechnet weiter das qualifizierte Mehr und nennt die Einstimmigkeit als
 * Hinweis; das wartet auf die Antwort zu C1 im Papier zur juristischen
 * Prüfung (Pendenz «Einstimmigkeit …»).
 *
 * **Der zweite Satz bleibt**, wie die Fassung 2026-10-21 ihn für die
 * Sitzungsleitung geprüft hat («Hat die Bewirtschaftung solche Kompetenzen
 * schon …»). Damit sein «solche Kompetenzen» einen Bezug behält, beginnt der
 * neue erste Satz weiter mit «Kompetenzen über die gewöhnliche Verwaltung
 * hinaus».
 *
 * **Geprüft** mit Laien- und Fachprüfung für die Sitzungsleitung (`quellen`
 * `pruefung/berichte/2026-10-20-votum-erweiterung-einstimmigkeit.md`).
 */
import type { Ergebnisknoten, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_22 } from './quorum-2026-10-22';
import {
	HINWEIS as HINWEIS_VORHER,
	WAHL_MIT_GEGENMEINUNG,
	WAHL_ZUM_GESETZ
} from './quorum-2026-10-21';

const KNOTEN_ID = 'k-bewirtschaftung-waehlen';

/** Der erste Satz, der unter jeder Regel gilt, jetzt mit dem Vorbehalt. */
export const ERWEITERUNG =
	'Soll die Bewirtschaftung Kompetenzen über die gewöhnliche Verwaltung hinaus erhalten, ' +
	'etwa gemeinschaftliche Teile vermieten, braucht das einen eigenen Beschluss mit ' +
	'qualifiziertem Mehr; soll sie statt der Versammlung entscheiden, etwa Budget oder ' +
	'Fondseinlagen festlegen statt nur vorschlagen, braucht es Einstimmigkeit (ZGB Art. 647b Abs. 1, ' +
	'712g Abs. 3; SVIT-Kommentar Rz. 46 ad Art. 712q, Rz. 91 ad Art. 712g, Rz. 45 ad Art. 712m).';

export const HINWEIS = `${ERWEITERUNG} ${WAHL_MIT_GEGENMEINUNG}`;

function mitVorbehalt(k: Ergebnisknoten): Ergebnisknoten {
	if (k.id !== KNOTEN_ID) return k;
	if ((k.hinweise ?? []).filter((h) => h === HINWEIS_VORHER).length !== 1) {
		throw new Error(`Fassung 2026-10-23: «${KNOTEN_ID}» trägt den Hinweis der Vorfassung nicht genau einmal.`);
	}
	if ((k.hinweiseUnterRegel ?? []).filter((u) => u.hinweis === HINWEIS_VORHER).length !== 1) {
		throw new Error(`Fassung 2026-10-23: «${KNOTEN_ID}» teilt den Hinweis der Vorfassung nicht genau einmal.`);
	}
	const neu: HinweisUnterRegel = { hinweis: HINWEIS, ersatz: ERWEITERUNG, zumGesetz: WAHL_ZUM_GESETZ };
	return {
		...k,
		hinweise: (k.hinweise ?? []).map((h) => (h === HINWEIS_VORHER ? HINWEIS : h)),
		hinweiseUnterRegel: (k.hinweiseUnterRegel ?? []).map((u) =>
			u.hinweis === HINWEIS_VORHER ? neu : u
		)
	};
}

if (!REGELWERK_2026_10_22.knoten.some((k) => k.id === KNOTEN_ID)) {
	throw new Error(`Fassung 2026-10-23: «${KNOTEN_ID}» fehlt in der Vorfassung.`);
}

export const REGELWERK_2026_10_23 = {
	...REGELWERK_2026_10_22,
	fassung: '2026-10-23',

	knoten: REGELWERK_2026_10_22.knoten.map(mitVorbehalt),

	freigabevermerk:
		REGELWERK_2026_10_22.freigabevermerk +
		' In der Fassung 2026-10-23 nennt die Karte zur Wahl der Bewirtschaftung den Vorbehalt der ' +
		'Einstimmigkeit, wenn die Bewirtschaftung statt der Versammlung entscheiden soll.'
} satisfies Regelwerk;
