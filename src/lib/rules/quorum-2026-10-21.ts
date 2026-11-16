/**
 * Fassung 2026-10-21: Wahl der Bewirtschaftung, Hinweis zur Gegenmeinung.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Erfordernis und keinen
 * Weg. Sie ersetzt an `k-bewirtschaftung-waehlen` den Hinweis zur Erweiterung
 * der Kompetenzen und seine Teilung unter einer angewandten Regel (seit
 * Fassung 2026-10-08).
 *
 * **Der Anlass** ist der Produktentscheid vom 20.10.2026
 * (`docs/entscheide/0015`): Die Wahl bleibt beim einfachen Mehr, auch wenn die
 * Bewirtschaftung schon erweiterte Kompetenzen hat, und die Karte nennt die
 * Gegenmeinung aus Art. 647b Abs. 1 ZGB. Bis hier sagte der Hinweis nur «in der
 * Lehre umstritten», ohne zu sagen, wie das Werkzeug rechnet und warum
 * (Laienprüfung 14.10.2026, Befund 4).
 *
 * **Geprüft** in vier Runden Laien- und Fachprüfung (`quellen`
 * `pruefung/berichte/2026-10-20-votum-drei-saetze.md`): «herrschende Lehre»
 * trägt Rz. 46 ad Art. 712q nicht, sie sagt nicht, wer welche Seite vertritt;
 * das erste Beispiel («Aufträge bis zu einem Betrag») fiel unter die
 * gesetzliche Zuständigkeit (Rz. 77 ad Art. 712s).
 */
import type { Ergebnisknoten, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_20 } from './quorum-2026-10-20';

const KNOTEN_ID = 'k-bewirtschaftung-waehlen';
const ALTER_ANFANG = 'Soll die Bewirtschaftung Kompetenzen';

/** Der erste Satz, der unter jeder Regel gilt. */
export const ERWEITERUNG =
	'Soll die Bewirtschaftung Kompetenzen über die gewöhnliche Verwaltung hinaus erhalten, ' +
	'etwa gemeinschaftliche Teile selbst vermieten, braucht diese Erweiterung einen eigenen ' +
	'Beschluss mit qualifiziertem Mehr, auch als Reglementsänderung (ZGB Art. 712g Abs. 3; ' +
	'SVIT-Kommentar Rz. 46 ad Art. 712q).';

/** Ohne Regel: Gegenmeinung, und wie das Werkzeug rechnet. */
export const WAHL_MIT_GEGENMEINUNG =
	'Hat die Bewirtschaftung solche Kompetenzen schon, ist umstritten, ob ihre Wahl ein höheres ' +
	'Mehr braucht: Art. 647b Abs. 1 ZGB zählt die Wahl eines solchen Verwalters zu den ' +
	'wichtigeren Verwaltungshandlungen, die das qualifizierte Mehr brauchen. Der SVIT-Kommentar ' +
	'bleibt beim einfachen Mehr, weil die Regeln zum Verwalter im Stockwerkeigentum vorgehen ' +
	'(Rz. 46 ad Art. 712q; Rz. 112 ad Art. 712a); so rechnet dieses Werkzeug. Wer sicher gehen ' +
	'will, strebt das qualifizierte Mehr an.';

/**
 * Unter einer Regel, im Abschnitt «Zum gesetzlichen Erfordernis». **Ohne «so
 * rechnet dieses Werkzeug»:** Unter der Regel rechnet es nach der Regel.
 */
export const WAHL_ZUM_GESETZ =
	'Hat die Bewirtschaftung solche Kompetenzen schon, ist umstritten, ob ihre Wahl nach Gesetz ' +
	'ein höheres Mehr braucht: Art. 647b Abs. 1 ZGB zählt die Wahl zu den wichtigeren ' +
	'Verwaltungshandlungen mit qualifiziertem Mehr. Der SVIT-Kommentar bleibt beim einfachen ' +
	'Mehr, weil die Regeln zum Verwalter im Stockwerkeigentum vorgehen (Rz. 46 ad Art. 712q; ' +
	'Rz. 112 ad Art. 712a). Wer sicher gehen will, strebt das qualifizierte Mehr an.';

export const HINWEIS = `${ERWEITERUNG} ${WAHL_MIT_GEGENMEINUNG}`;

function mitNeuemHinweis(k: Ergebnisknoten): Ergebnisknoten {
	if (k.id !== KNOTEN_ID) return k;
	const alt = (k.hinweise ?? []).filter((h) => h.startsWith(ALTER_ANFANG));
	if (alt.length !== 1) {
		throw new Error(
			`Fassung 2026-10-21: «${KNOTEN_ID}» trägt ${alt.length} Hinweise mit «${ALTER_ANFANG}», erwartet war einer.`
		);
	}
	const unterRegel = (k.hinweiseUnterRegel ?? []).filter((u) => u.hinweis === alt[0]);
	if (unterRegel.length !== 1) {
		throw new Error(`Fassung 2026-10-21: «${KNOTEN_ID}» teilt den alten Hinweis nicht genau einmal.`);
	}
	const neu: HinweisUnterRegel = { hinweis: HINWEIS, ersatz: ERWEITERUNG, zumGesetz: WAHL_ZUM_GESETZ };
	return {
		...k,
		hinweise: (k.hinweise ?? []).map((h) => (h === alt[0] ? HINWEIS : h)),
		hinweiseUnterRegel: (k.hinweiseUnterRegel ?? []).map((u) => (u.hinweis === alt[0] ? neu : u))
	};
}

if (!REGELWERK_2026_10_20.knoten.some((k) => k.id === KNOTEN_ID)) {
	throw new Error(`Fassung 2026-10-21: «${KNOTEN_ID}» fehlt in der Vorfassung.`);
}

export const REGELWERK_2026_10_21 = {
	...REGELWERK_2026_10_20,
	fassung: '2026-10-21',

	knoten: REGELWERK_2026_10_20.knoten.map(mitNeuemHinweis),

	freigabevermerk:
		REGELWERK_2026_10_20.freigabevermerk +
		' In der Fassung 2026-10-21 nennt die Karte zur Wahl der Bewirtschaftung die Gegenmeinung ' +
		'aus Art. 647b Abs. 1 und wie gerechnet wird.'
} satisfies Regelwerk;
