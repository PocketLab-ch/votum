/**
 * Fassung 2026-10-25: An der Ausschlussklage bleiben Angehörige im Ausstand in
 * der Zahl (1e).
 *
 * **Daten, kein Code** (AD-4), bis auf die Rechnung selbst: Sie hängt an der
 * Fassung (`ausstandBleibtInDerZahl` in `entscheidbaum.ts`), wie die gemeinsame
 * Wohnung des Beklagten ab 2026-10-11. Diese Fassung ändert ein Ergebnis.
 *
 * **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), «Fest»:
 * Ehegatte und Verwandte des Beklagten in gerader Linie stimmen nach Art. 68
 * ZGB sinngemäss nicht mit, und Votum erklärt für sie den Ausstand. Bis zur
 * Fassung 2026-10-24 nahm der Ausstand sie auch aus der Zahl, an der die
 * Mehrheit gemessen wird; das war milder als der Wortlaut von Art. 649b Abs. 2
 * («aller Miteigentümer mit Ausnahme des Beklagten»), und eine zu milde Zählung
 * kann die Klage noch Jahre später scheitern lassen (BGer 5A_735/2019
 * E. 3.3.1: materiellrechtliche Voraussetzung). Ab hier bleiben sie in der
 * Zahl und wirken wie ein Nein. Wer ihnen eine Vollmacht gegeben hat, bleibt
 * ebenfalls in der Zahl, wie bisher (Produktentscheid 21.10.2026: «Fest wie
 * 1e»).
 *
 * **Unter einer Klausel der Anwesenden ändert sich nichts**: Dort zählt, wer
 * nicht abstimmen kann, ohnehin nicht.
 *
 * **Alte Traktanden** rechnen weiter nach ihrer Fassung, also ohne die
 * Angehörigen im Ausstand.
 */
import type { Ergebnisknoten, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_24 } from './quorum-2026-10-24';

export const AUSSCHLUSS_ID = 'k-ausschlussklage';

/** Der Satz zu den Angehörigen bis zur Fassung 2026-10-24, am Anfang erkennbar. */
const ANGEHOERIGE_VORHER = 'Ehegatte und Verwandte des Beklagten in gerader Linie';

/** Was für die Angehörigen gilt, gleich unter jeder Regel; danach der Satz zur Zahl. */
const ANGEHOERIGE_KERN =
	'Ehegatte und Verwandte des Beklagten in gerader Linie, etwa Eltern, Kinder, Grosseltern oder ' +
	'Enkel, die selbst Eigentümer sind, stimmen ebenfalls nicht mit, weder für eine eigene Wohnung ' +
	'noch als Vertretung anderer, auch wenn ihnen nur die Wohnung des Beklagten mitgehört. So folgt ' +
	'es aus ZGB Art. 68, der hier sinngemäss gilt (BGer 5A_198/2014 E. 5.4; BGE 134 III 481 E. 3.8); ' +
	'für die Ausschlussklage entschieden hat es kein Gericht. Geschwister, Schwiegereltern und ' +
	'Lebenspartner ohne Ehe stimmen normal mit. Wer einlädt, klärt das möglichst schon mit der ' +
	// Laienprüfung Block 2, M4: was die Einladung den Eigentümern sagen soll.
	'Einladung und sagt den Eigentümern, dass eine Vollmacht an diese Angehörigen bei dieser ' +
	'Abstimmung wie ein Nein wirkt; so lässt sie sich noch umlenken. Vor der Abstimmung fragt die ' +
	'Sitzungsleitung nochmals nach und erklärt für diese Angehörigen den Ausstand.';

/** Ohne Regel: Votum rechnet über alle und lässt die Angehörigen in der Zahl. */
// Fachprüfung Block 2, Befund 4: wie es der Wortlaut sagt, entschieden hat es
// kein Gericht; die Zahl hält auch, wenn eines die Angehörigen herausnähme.
export const ANGEHOERIGE_HINWEIS =
	`${ANGEHOERIGE_KERN} In der Zahl, an der die Mehrheit gemessen wird, lässt Votum sie trotzdem, ` +
	'wie es der Wortlaut von Art. 649b Abs. 2 sagt: Er nimmt nur den Beklagten aus. Dort wirken sie ' +
	'wie ein Nein, ebenso wer ihnen eine Vollmacht gegeben hat. Bei elf Eigentümern, einem ' +
	'Beklagten und seiner Ehefrau mit eigener Wohnung verlangt Votum deshalb sechs Ja von zehn. ' +
	'Entschieden hat das kein Gericht; eine so gefasste Ermächtigung hält auch, wenn eines die ' +
	'Angehörigen herausnähme.';

/** Unter einer Regel: Was Votum rechnet, hängt an der Bestimmung. */
export const ANGEHOERIGE_ERSATZ =
	`${ANGEHOERIGE_KERN} Aus der Zahl aller Eigentümer nimmt Art. 649b Abs. 2 nur den Beklagten. ` +
	'Sicher ist die Ermächtigung deshalb nur, wenn die Ja-Stimmen auch die Mehrheit aller Eigentümer ' +
	'ohne den Beklagten erreichen. Dabei zählen die Angehörigen mit, ebenso wer ihnen eine Vollmacht ' +
	'gegeben hat, ob sie erschienen sind oder nicht. Bei elf Eigentümern, einem Beklagten und seiner ' +
	'Ehefrau mit eigener Wohnung sind das sechs Ja. Stellt Ihre Bestimmung auf alle Eigentümer ab, ' +
	// Laienprüfung Block 2, M5: wen, wann, wo festhalten.
	// Fachprüfung Runde 2, B: alle Eigentümer, nicht nur die Anwesenden.
	'zählt dieses Werkzeug sie mit. Stellt sie auf die Anwesenden ab, zählen Sie nach der Abstimmung ' +
	'alle Eigentümer ausser dem Beklagten, auch wer nicht erschienen ist, die Angehörigen und wer ' +
	'ihnen eine Vollmacht gab eingeschlossen. Halten Sie im Protokoll fest, ob die Ja-Stimmen deren ' +
	'Mehrheit erreichen.';

const vorher = REGELWERK_2026_10_24.knoten.find((k) => k.id === AUSSCHLUSS_ID);
if (!vorher) throw new Error(`Fassung 2026-10-25: «${AUSSCHLUSS_ID}» fehlt in der Vorfassung.`);

const alterHinweis = (vorher.hinweise ?? []).filter((h) => h.startsWith(ANGEHOERIGE_VORHER));
if (alterHinweis.length !== 1) {
	throw new Error('Fassung 2026-10-25: Der Satz zu den Angehörigen steht in der Vorfassung nicht genau einmal.');
}
const alteUnterRegel = (vorher.hinweiseUnterRegel ?? []).filter((u) => u.hinweis === alterHinweis[0]);
if (alteUnterRegel.length !== 1) {
	throw new Error('Fassung 2026-10-25: Der Satz zu den Angehörigen unter einer Regel fehlt in der Vorfassung.');
}

function neuUnterRegel(u: HinweisUnterRegel): HinweisUnterRegel {
	return u.hinweis === alterHinweis[0] ? { ...u, hinweis: ANGEHOERIGE_HINWEIS, ersatz: ANGEHOERIGE_ERSATZ } : u;
}

export const AUSSCHLUSSKLAGE: Ergebnisknoten = {
	...vorher,
	hinweise: (vorher.hinweise ?? []).map((h) => (h === alterHinweis[0] ? ANGEHOERIGE_HINWEIS : h)),
	hinweiseUnterRegel: (vorher.hinweiseUnterRegel ?? []).map(neuUnterRegel)
};

export const REGELWERK_2026_10_25 = {
	...REGELWERK_2026_10_24,
	fassung: '2026-10-25',

	knoten: REGELWERK_2026_10_24.knoten.map((k) => (k.id === AUSSCHLUSS_ID ? AUSSCHLUSSKLAGE : k)),

	freigabevermerk:
		REGELWERK_2026_10_24.freigabevermerk +
		' In der Fassung 2026-10-25 bleiben bei der Ermächtigung zur Ausschlussklage Angehörige im ' +
		'Ausstand in der Zahl aller Eigentümer, wie es der Wortlaut von Art. 649b Abs. 2 verlangt.'
} satisfies Regelwerk;
