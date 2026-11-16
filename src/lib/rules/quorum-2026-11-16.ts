/**
 * Fassung 2026-11-16: Unter einer von Hand gesetzten Kopfbasis «aller
 * Eigentümer» bleibt, wer im Ausstand ist, in der Zahl und wirkt wie ein Nein,
 * wie unter L13 «Alle Eigentümer» (Entscheid 0050, Antwort 1, «Angleichen»).
 *
 * **Daten, kein Code** (AD-4), bis auf die Rechnung selbst: Sie hängt an der
 * Fassung (`ausstandBleibtBeiGewaehlterBasis` in `entscheidbaum.ts`,
 * `AUSSTAND_BEI_GEWAEHLTER_BASIS_AB`), wie 1e ab der Fassung 2026-10-25. Diese
 * Fassung ändert ein Ergebnis: Bis zur Fassung 2026-11-15 fiel, wer im Ausstand
 * ist, unter einer solchen Basis aus der Zahl (DeepSeek-Review Regel 43, B5).
 * Die Fassung 2026-11-15 bleibt unverändert; ihre Traktanden rechnen weiter so.
 *
 * **Was sich sonst ändert:** die allgemeine Erklärung zum Wortlaut
 * (`wortlautErklaerung`), der Satz zur Zählung nach den Anwesenden und
 * Vertretenen, und der Freigabevermerk. Endwortlaute T4 und T7d der Textrunde
 * zu den Pendenzen nach Regel 43 (`quellen`
 * `pruefung/zu-pruefen-2026-11-14-votum-pendenzen-textrunde-endfassung.md`).
 */
import type { Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_15 } from './quorum-2026-11-15';

const VOR = REGELWERK_2026_11_15;

/** Der Satz der allgemeinen Erklärung zum Wortlaut, wie er seit der Fassung 2026-09-21 lautet. */
export const ZAEHLUNG_ANWESENDE_VORHER =
	'Gezählt wird nach den Eigentümern, die anwesend oder vertreten sind, nicht nach jenen, die abstimmen.';

/**
 * Was an seine Stelle tritt (Endwortlaut T4). Der bisherige Satz trat als
 * gesichert auf, wo 4a und 4b «nach herrschender Lehre» sagen (Fachprüfung
 * «Texte nach 0047», Runde 3, H-R3-3).
 *
 * **Punkt statt Strichpunkt an zwei Stellen**: Mit Strichpunkt haben die beiden
 * Sätze 194 und 182 Zeichen, und `check:texte` lässt höchstens 180 zu; eine
 * Ausnahme war nicht vorgesehen. Die Wörter bleiben.
 */
export const ZAEHLUNG_ANWESENDE =
	'Nach herrschender Lehre, der Auffassung der meisten Fachleute, zählen die Eigentümer, die anwesend oder ' +
	'vertreten sind, nicht nur jene, die abstimmen. Eine Enthaltung wirkt deshalb wie ein Nein. Einzelne Autoren ' +
	'zählen alle Eigentümer, andere nur die Abstimmenden. Im Streit um die Zählweise sicher ist ein Beschluss, ' +
	'dem mehr als die Hälfte aller Eigentümer zustimmt. Wo das Gesetz zugleich die Wertquoten verlangt, müssen ' +
	'auch sie erreicht sein.';

/**
 * Der Zusatz zum Freigabevermerk dieser Fassung (Endwortlaut T7d): Der Vermerk
 * nennt je Fassung, was sie am Ergebnis ändert (Muster 2026-10-25).
 *
 * **In zwei Sätzen statt in einem**: Der Endwortlaut hat 212 Zeichen, und
 * `check:texte` lässt höchstens 180 zu; eine Ausnahme in
 * `scripts/texte-ausnahmen.tsv` war nicht vorgesehen. Getrennt am Komma vor «wie
 * unter der Einstellung»; der Inhalt bleibt. Der dritte Satz nennt die beiden
 * ausgenommenen Karten (Fachprüfung des Nachtrags, N-F-1).
 */
export const FREIGABEVERMERK_ZUSATZ =
	' In der Fassung 2026-11-16 bleibt, wer im Ausstand ist, auch unter einer von der Sitzungsleitung ' +
	'gesetzten Mehrheit aller Eigentümer in der Zahl und wirkt wie ein Nein. So ist es schon unter der ' +
	'Einstellung «Alle Eigentümer». An der Ausschlussklage und an der Einsprache ändert sich nichts.';

/** Ersetzt genau einmal und bricht ab, wenn der alte Teil nicht genau einmal dasteht. */
function ersetzeGenau(text: string, alt: string, neu: string): string {
	const treffer = text.split(alt).length - 1;
	if (treffer !== 1) {
		throw new Error(`Fassung 2026-11-16: «${alt.slice(0, 50)}…» steht ${treffer}-mal statt einmal.`);
	}
	return text.replace(alt, neu);
}

if (VOR.wortlautErklaerung.includes(ZAEHLUNG_ANWESENDE) || VOR.freigabevermerk.includes(FREIGABEVERMERK_ZUSATZ.trim())) {
	throw new Error('Fassung 2026-11-16: ein neuer Satz steht schon in der Vorfassung.');
}

export const REGELWERK_2026_11_16 = {
	...VOR,
	fassung: '2026-11-16',

	wortlautErklaerung: ersetzeGenau(VOR.wortlautErklaerung, ZAEHLUNG_ANWESENDE_VORHER, ZAEHLUNG_ANWESENDE),

	freigabevermerk: VOR.freigabevermerk + FREIGABEVERMERK_ZUSATZ
} satisfies Regelwerk;
