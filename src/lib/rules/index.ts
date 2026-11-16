/**
 * Verzeichnis der Regelwerksfassungen (Story 2.1, AD-4).
 *
 * Jede je ausgelieferte Fassung bleibt hier stehen, auch wenn sie längst nicht
 * mehr die aktuelle ist. Der Grund steht in AD-4: Ein Traktandum speichert die
 * Fassungskennung, unter der sein Erfordernis hergeleitet wurde. Verschwände die
 * Fassung, liesse sich der Beschluss von 2027 nach der Revision von 2028 nicht
 * mehr erklären — er stünde da mit einer Kennung, zu der es nichts mehr gibt.
 *
 * Beim Aufnehmen einer neuen Fassung wird die bestehende **nicht** angefasst.
 * Der Wächter `tests/waechter/fassungsabdruck.test.ts` hält das fest: Je Fassung
 * ein Abdruck; eine neue Fassung trägt dort ihren Wert ein.
 */
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_07_30 } from './quorum-2026-07-30';
import { REGELWERK_2026_08_05 } from './quorum-2026-08-05';
import { REGELWERK_2026_08_15 } from './quorum-2026-08-15';
import { REGELWERK_2026_08_16 } from './quorum-2026-08-16';
import { REGELWERK_2026_09_21 } from './quorum-2026-09-21';
import { REGELWERK_2026_09_22 } from './quorum-2026-09-22';
import { REGELWERK_2026_09_23 } from './quorum-2026-09-23';
import { REGELWERK_2026_09_24 } from './quorum-2026-09-24';
import { REGELWERK_2026_09_25 } from './quorum-2026-09-25';
import { REGELWERK_2026_09_26 } from './quorum-2026-09-26';
import { REGELWERK_2026_09_27 } from './quorum-2026-09-27';
import { REGELWERK_2026_09_28 } from './quorum-2026-09-28';
import { REGELWERK_2026_09_29 } from './quorum-2026-09-29';
import { REGELWERK_2026_09_30 } from './quorum-2026-09-30';
import { REGELWERK_2026_10_01 } from './quorum-2026-10-01';
import { REGELWERK_2026_10_02 } from './quorum-2026-10-02';
import { REGELWERK_2026_10_03 } from './quorum-2026-10-03';
import { REGELWERK_2026_10_04 } from './quorum-2026-10-04';
import { REGELWERK_2026_10_05 } from './quorum-2026-10-05';
import { REGELWERK_2026_10_06 } from './quorum-2026-10-06';
import { REGELWERK_2026_10_07 } from './quorum-2026-10-07';
import { REGELWERK_2026_10_08 } from './quorum-2026-10-08';
import { REGELWERK_2026_10_09 } from './quorum-2026-10-09';
import { REGELWERK_2026_10_10 } from './quorum-2026-10-10';
import { REGELWERK_2026_10_11 } from './quorum-2026-10-11';
import { REGELWERK_2026_10_12 } from './quorum-2026-10-12';
import { REGELWERK_2026_10_13 } from './quorum-2026-10-13';
import { REGELWERK_2026_10_14 } from './quorum-2026-10-14';
import { REGELWERK_2026_10_15 } from './quorum-2026-10-15';
import { REGELWERK_2026_10_16 } from './quorum-2026-10-16';
import { REGELWERK_2026_10_17 } from './quorum-2026-10-17';
import { REGELWERK_2026_10_18 } from './quorum-2026-10-18';
import { REGELWERK_2026_10_19 } from './quorum-2026-10-19';
import { REGELWERK_2026_10_20 } from './quorum-2026-10-20';
import { REGELWERK_2026_10_21 } from './quorum-2026-10-21';
import { REGELWERK_2026_10_22 } from './quorum-2026-10-22';
import { REGELWERK_2026_10_23 } from './quorum-2026-10-23';
import { REGELWERK_2026_10_24 } from './quorum-2026-10-24';
import { REGELWERK_2026_10_25 } from './quorum-2026-10-25';
import { REGELWERK_2026_10_26 } from './quorum-2026-10-26';
import { REGELWERK_2026_10_27 } from './quorum-2026-10-27';
import { REGELWERK_2026_10_28 } from './quorum-2026-10-28';
import { REGELWERK_2026_10_29 } from './quorum-2026-10-29';
import { REGELWERK_2026_10_30 } from './quorum-2026-10-30';
import { REGELWERK_2026_11_03 } from './quorum-2026-11-03';
import { REGELWERK_2026_11_04 } from './quorum-2026-11-04';
import { REGELWERK_2026_11_05 } from './quorum-2026-11-05';
import { REGELWERK_2026_11_10 } from './quorum-2026-11-10';
import { REGELWERK_2026_11_11 } from './quorum-2026-11-11';
import { REGELWERK_2026_11_13 } from './quorum-2026-11-13';
import { REGELWERK_2026_11_14 } from './quorum-2026-11-14';
import { REGELWERK_2026_11_15 } from './quorum-2026-11-15';
import { REGELWERK_2026_11_16 } from './quorum-2026-11-16';
import { REGELWERK_2026_11_17 } from './quorum-2026-11-17';
import { REGELWERK_2026_11_18 } from './quorum-2026-11-18';

/** Alle bekannten Fassungen, nach Kennung. */
export const FASSUNGEN: Record<string, Regelwerk> = {
	[REGELWERK_2026_07_30.fassung]: REGELWERK_2026_07_30,
	[REGELWERK_2026_08_05.fassung]: REGELWERK_2026_08_05,
	[REGELWERK_2026_08_15.fassung]: REGELWERK_2026_08_15,
	[REGELWERK_2026_08_16.fassung]: REGELWERK_2026_08_16,
	[REGELWERK_2026_09_21.fassung]: REGELWERK_2026_09_21,
	[REGELWERK_2026_09_22.fassung]: REGELWERK_2026_09_22,
	[REGELWERK_2026_09_23.fassung]: REGELWERK_2026_09_23,
	[REGELWERK_2026_09_24.fassung]: REGELWERK_2026_09_24,
	[REGELWERK_2026_09_25.fassung]: REGELWERK_2026_09_25,
	[REGELWERK_2026_09_26.fassung]: REGELWERK_2026_09_26,
	[REGELWERK_2026_09_27.fassung]: REGELWERK_2026_09_27,
	[REGELWERK_2026_09_28.fassung]: REGELWERK_2026_09_28,
	[REGELWERK_2026_09_29.fassung]: REGELWERK_2026_09_29,
	[REGELWERK_2026_09_30.fassung]: REGELWERK_2026_09_30,
	[REGELWERK_2026_10_01.fassung]: REGELWERK_2026_10_01,
	[REGELWERK_2026_10_02.fassung]: REGELWERK_2026_10_02,
	[REGELWERK_2026_10_03.fassung]: REGELWERK_2026_10_03,
	[REGELWERK_2026_10_04.fassung]: REGELWERK_2026_10_04,
	[REGELWERK_2026_10_05.fassung]: REGELWERK_2026_10_05,
	[REGELWERK_2026_10_06.fassung]: REGELWERK_2026_10_06,
	[REGELWERK_2026_10_07.fassung]: REGELWERK_2026_10_07,
	[REGELWERK_2026_10_08.fassung]: REGELWERK_2026_10_08,
	[REGELWERK_2026_10_09.fassung]: REGELWERK_2026_10_09,
	[REGELWERK_2026_10_10.fassung]: REGELWERK_2026_10_10,
	[REGELWERK_2026_10_11.fassung]: REGELWERK_2026_10_11,
	[REGELWERK_2026_10_12.fassung]: REGELWERK_2026_10_12,
	[REGELWERK_2026_10_13.fassung]: REGELWERK_2026_10_13,
	[REGELWERK_2026_10_14.fassung]: REGELWERK_2026_10_14,
	[REGELWERK_2026_10_15.fassung]: REGELWERK_2026_10_15,
	[REGELWERK_2026_10_16.fassung]: REGELWERK_2026_10_16,
	[REGELWERK_2026_10_17.fassung]: REGELWERK_2026_10_17,
	[REGELWERK_2026_10_18.fassung]: REGELWERK_2026_10_18,
	[REGELWERK_2026_10_19.fassung]: REGELWERK_2026_10_19,
	[REGELWERK_2026_10_20.fassung]: REGELWERK_2026_10_20,
	[REGELWERK_2026_10_21.fassung]: REGELWERK_2026_10_21,
	[REGELWERK_2026_10_22.fassung]: REGELWERK_2026_10_22,
	[REGELWERK_2026_10_23.fassung]: REGELWERK_2026_10_23,
	[REGELWERK_2026_10_24.fassung]: REGELWERK_2026_10_24,
	[REGELWERK_2026_10_25.fassung]: REGELWERK_2026_10_25,
	[REGELWERK_2026_10_26.fassung]: REGELWERK_2026_10_26,
	[REGELWERK_2026_10_27.fassung]: REGELWERK_2026_10_27,
	[REGELWERK_2026_10_28.fassung]: REGELWERK_2026_10_28,
	[REGELWERK_2026_10_29.fassung]: REGELWERK_2026_10_29,
	[REGELWERK_2026_10_30.fassung]: REGELWERK_2026_10_30,
	[REGELWERK_2026_11_03.fassung]: REGELWERK_2026_11_03,
	[REGELWERK_2026_11_04.fassung]: REGELWERK_2026_11_04,
	[REGELWERK_2026_11_05.fassung]: REGELWERK_2026_11_05,
	[REGELWERK_2026_11_10.fassung]: REGELWERK_2026_11_10,
	[REGELWERK_2026_11_11.fassung]: REGELWERK_2026_11_11,
	[REGELWERK_2026_11_13.fassung]: REGELWERK_2026_11_13,
	[REGELWERK_2026_11_14.fassung]: REGELWERK_2026_11_14,
	[REGELWERK_2026_11_15.fassung]: REGELWERK_2026_11_15,
	[REGELWERK_2026_11_16.fassung]: REGELWERK_2026_11_16,
	[REGELWERK_2026_11_17.fassung]: REGELWERK_2026_11_17,
	[REGELWERK_2026_11_18.fassung]: REGELWERK_2026_11_18
};

/** Die Fassung, unter der neue Herleitungen laufen. */
export const AKTUELLE_FASSUNG = REGELWERK_2026_11_18.fassung;

/**
 * Holt eine Fassung. Ohne Angabe die aktuelle.
 *
 * Wirft bei unbekannter Kennung, statt still auf die aktuelle auszuweichen: Ein
 * altes Traktandum mit der neuen Fassung nachzurechnen, gäbe womöglich ein
 * anderes Ergebnis als damals — und niemand sähe, dass das passiert ist.
 */
export function holeRegelwerk(fassung: string = AKTUELLE_FASSUNG): Regelwerk {
	const regelwerk = FASSUNGEN[fassung];
	if (!regelwerk) {
		throw new Error(
			`Regelwerksfassung «${fassung}» ist nicht bekannt. Bekannt sind: ${Object.keys(FASSUNGEN).join(', ')}.`
		);
	}
	return regelwerk;
}

/**
 * Die Fassung für reine Anzeigen, mit Rückfall auf die Basisfassung.
 *
 * **Warum nicht `holeRegelwerk`** (Codeprüfung 04.10.2026, H1): Es gibt
 * gespeicherte Erfordernisse mit Fassungen, die absichtlich nicht in
 * `FASSUNGEN` stehen: `ordnungsantrag-2026-08-05` (Rückkommen,
 * `domain/rueckkommen.ts`), `reglement-<geschäftsart>` (`domain/reglement.ts`)
 * und übernommene Altfassungen. `holeRegelwerk` wirft dort; die fünf Anzeigen
 * des Quorumstyps (Leitung beider Seiten, Wand, Präsentation, Einladung)
 * liefen in eine 500, sobald ein Rückkommensantrag gestellt ist. Die
 * Typbezeichnungen sind über die Fassungen stabil; die Anzeige fällt deshalb
 * auf die Basisfassung zurück, statt zu werfen. Zum Rechnen bleibt es bei
 * `holeRegelwerk`: Wer eine unbekannte Fassung nachrechnen will, soll das
 * nicht stillschweigend mit der falschen tun.
 */
export function holeRegelwerkFuerAnzeige(fassung: string): Regelwerk {
	return FASSUNGEN[fassung] ?? REGELWERK_2026_07_30;
}

/** Alle Fassungen, neueste zuerst. */
export function alleFassungen(): Regelwerk[] {
	return Object.values(FASSUNGEN).sort((a, b) => b.fassung.localeCompare(a.fassung));
}

/**
 * Der Knoten, an dem `umstrittenSatz` die Gegenmeinung eines gespeicherten
 * Erfordernisses liest (Ä-01, 17.09.2026).
 *
 * **Aus der eigenen Fassung, wenn sie das Merkmal schon führt, sonst aus der
 * neuesten, deren Knoten gleicher Kennung keine Lesart trägt** (Codeprüfung H7,
 * M-2; E1, L11). Ohne den Rückfall zeigte nach dem Ausrollen kein bestehendes
 * Traktandum den Satz, auch eine schon angelegte Prozessführung nicht, und die
 * Leitung läse sein Fehlen als «unbestritten». Der Streit ist keine Rechenregel
 * der Fassung, sondern eine Auskunft über die Quellen; was gerechnet wird,
 * prüft `umstrittenSatz` weiter am Erfordernis selbst (Typ und Bezugsgrössen
 * müssen die des Knotens sein). Eine Fassung, die das Merkmal führt, bleibt
 * massgebend, auch wenn eine spätere es ändert (AD-4).
 *
 * **Warum nicht die aktuelle Fassung** (E1, L11): Seit der Fassung 2026-11-10
 * trägt `k-prozessfuehrung` die Lesart L11 und keine Gegenmeinung mehr. Ein
 * Traktandum aus einer Fassung vor 2026-10-18 rechnet aber ohne Lesart und
 * weiter nach dem qualifizierten Mehr; der Streit gilt für es fort. Deshalb
 * fällt der Rückfall auf die neueste Fassung, deren Knoten gleicher Kennung
 * keine `lesart` trägt: für `k-prozessfuehrung` ist das 2026-11-05. Dasselbe
 * trifft die eigene Schranke des Reglements (L6 seit 2026-11-05): Ein
 * Traktandum aus einer Fassung vor 2026-10-18 rechnet dort ohne Lesart nach
 * der Klausel, liest den Streit jetzt aus 2026-11-04 und zeigt ihn wieder; bis
 * E1 schwieg der Satz dort (Codeprüfung E1 L11, Befund 3). An L2 und L4
 * ändert sich nichts, ihre Knoten trugen nie eine Gegenmeinung; an Knoten
 * ohne Lesart ist es die aktuelle Fassung.
 *
 * `undefined` bei unbekannter Fassung (etwa `ordnungsantrag-…` beim
 * Rückkommen) oder Kennung, ohne Rückfall: Dort gibt es keinen Knoten, dessen
 * Erfordernis gerechnet wurde.
 */
export function knotenFuerUmstritten(fassung: string, knotenId: string): Ergebnisknoten | undefined {
	const eigene = FASSUNGEN[fassung];
	if (!eigene) return undefined;
	const rw = eigene.knoten.some((k) => k.rang !== undefined)
		? eigene
		: (alleFassungen().find((f) => f.knoten.some((k) => k.id === knotenId && k.lesart === undefined)) ??
			FASSUNGEN[AKTUELLE_FASSUNG]);
	return rw.knoten.find((k) => k.id === knotenId);
}

/**
 * Der Knoten eines gespeicherten Erfordernisses in dessen eigener Fassung,
 * ohne Rückfall auf die aktuelle (Block 3, `mehrhinweise`). Gefragt wird, was
 * das Gesetz an diesem Knoten verlangte, als das Erfordernis hergeleitet
 * wurde; eine spätere Fassung beantwortet das nicht (AD-4). `undefined` bei
 * unbekannter Fassung oder Kennung.
 */
export function knotenDerFassung(fassung: string, knotenId: string): Ergebnisknoten | undefined {
	return FASSUNGEN[fassung]?.knoten.find((k) => k.id === knotenId);
}
