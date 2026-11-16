/**
 * Regelwerk, Fassung 2026-09-28.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung setzt an beiden Knoten, die die
 * Zustimmung unmittelbar Betroffener verlangen, **wie** diese Zustimmung
 * erteilt wird, und ändert sonst nichts.
 *
 * Anlass ist die Fachprüfung vom 25.09.2026
 * (`quellen/pruefung/berichte/2026-09-25-fachpruefung-betroffene.md`, Befunde
 * B4 und B5). Sie hat nachgewiesen, dass die Anwendung für zwei rechtlich
 * verschiedene Dinge dieselbe Rechnung führte:
 *
 *   - **ZGB Art. 712g Abs. 4** (Nutzungsrechte, `k-nutzungsrecht-zuteilung`):
 *     Die Zustimmung wird «in der Regel … entweder mündlich an der Versammlung
 *     erfüllt werden müssen, oder im Vorfeld wird eine schriftliche Zustimmung
 *     eingeholt» (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 209). Sie
 *     gehört zur Annahme; fehlt sie, ist der Antrag abgelehnt. Neu erfasst die
 *     Anwendung auch die **vorher schriftliche** Zustimmung.
 *   - **ZGB Art. 712e Abs. 2** (Wertquoten, `k-wertquoten-aendern`): Die
 *     Versammlung genehmigt mit einfachem Mehr. Die Zustimmung der
 *     unmittelbar Betroffenen ist ein **getrenntes Erfordernis** und wird in
 *     der Regel **nachher** erfüllt, «durch die Unterzeichnung der
 *     erforderlichen öffentlichen Abänderungsurkunde» (Rz. 75 ad Art. 712e);
 *     «Hingegen bedarf die eigentliche Abänderung der Wertquoten einer
 *     Vereinbarung zwischen allen betroffenen Stockwerkeigentümern. Diese
 *     Vereinbarung ist öffentlich zu beurkunden» (Rz. 88). Ein Ja im Saal
 *     ersetzt die Unterschrift nicht.
 *
 * **Was die Fassung nicht tut.** Die beiden Betroffenen-Erläuterungen bleiben
 * unverändert, obwohl die Nebenfrage der Fachprüfung sie berichtigt (B7: die
 * dinglich Berechtigten fehlen bei den Wertquoten; B8: der Eingriff beim
 * Nutzungsrecht umfasst auch Dauer, Entschädigung, Unterhaltspflicht und eine
 * Ausweitung). Das ist ein eigener Text mit eigener Prüfung. Und die
 * nachträgliche Zustimmung bei Art. 712g Abs. 4 ist nicht belegt (Rz. 209
 * nennt Saal und Vorfeld); sie wird nicht gebaut.
 *
 * **Was mit Erfordernissen aus älteren Fassungen geschieht.** Sie tragen das
 * neue Merkmal nicht. Die Zuordnung übernimmt `betroffenenzustimmungVon` im
 * Kern; sie weicht bewusst von AD-4 ab, weil die alte Rechnung nach der
 * Fachprüfung falsch ist: verkündete Ergebnisse sind seit dem 25.09.2026
 * festgeschrieben und ändern sich nicht, und Votum ist nicht in Produktion.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_27 } from './quorum-2026-09-27';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	// ZGB Art. 712g Abs. 4: mündlich im Saal oder vorher schriftlich; die
	// Zustimmung gehört zur Annahme (SVIT-Kommentar 2023, Art. 712g Rz. 209).
	'k-nutzungsrecht-zuteilung': { betroffenenzustimmung: 'im_saal_oder_vorab' },

	// ZGB Art. 712e Abs. 2: Die Versammlung genehmigt; die Zustimmung folgt in
	// der Regel mit der öffentlichen Abänderungsurkunde (Rz. 75 und 88).
	'k-wertquoten-aendern': { betroffenenzustimmung: 'nachher' }
};

export const REGELWERK_2026_09_28 = {
	...REGELWERK_2026_09_27,
	fassung: '2026-09-28',

	quellen: [
		...REGELWERK_2026_09_27.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712e Rz. 75 und 88 (Zustimmung der Betroffenen ' +
			'in einfacher Schriftform, in der Regel durch die Unterzeichnung der öffentlichen ' +
			'Abänderungsurkunde) und Art. 712g Rz. 209 (Zustimmung mündlich an der Versammlung ' +
			'oder vorgängig schriftlich).'
	],

	freigabevermerk:
		REGELWERK_2026_09_27.freigabevermerk +
		' Am 28.09.2026 unterscheidet Votum bei den beiden Fällen, die die Zustimmung Betroffener ' +
		'verlangen, wie diese Zustimmung erteilt wird. Die rechtlichen Voraussetzungen bleiben ' +
		'dieselben; geändert hat sich, wie Votum sie auswertet. Bei den Wertquoten meldet Votum die ' +
		'Genehmigung als angenommen, auch wenn Betroffene im Saal nicht Ja sagen. Wirksam wird die ' +
		'Änderung erst mit der Eintragung im Grundbuch. Dafür lässt die Verwaltung die Abänderung ' +
		'von einem Notar öffentlich beurkunden, und alle Betroffenen unterzeichnen sie dort, auch ' +
		'wessen Quote steigt. Zustimmen müssen zudem die Grundpfandgläubiger der Einheiten, deren ' +
		'Quote sich ändert, bei einer Senkung wie bei einer Erhöhung; welche weiteren dinglich ' +
		'Berechtigten zustimmen müssen, klärt der Notar. Der Anmeldung liegt der beglaubigte ' +
		'Protokollauszug mit der Genehmigung bei; welche Form das Grundbuch für die Genehmigung ' +
		'verlangt, klärt die Verwaltung am besten vor der Versammlung mit dem Notar. Bei den ' +
		'Nutzungsrechten bleibt die Zustimmung Teil der Annahme.',

	knoten: REGELWERK_2026_09_27.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		return neu ? { ...k, ...neu } : k;
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
