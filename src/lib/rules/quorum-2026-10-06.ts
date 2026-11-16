/**
 * Regelwerk, Fassung 2026-10-06.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert zwei Karten; an den Wegen
 * durch den Entscheidbaum ändert sich nichts.
 *
 * **`k-reglement-normal`: Verhalten `einordnen` statt `nur_mildern`.** Bis hier
 * wandte das Werkzeug eine hinterlegte Regel für die gewöhnliche
 * Reglementsänderung nur an, wenn sie nachweislich nicht strenger war als
 * Art. 712g Abs. 3. Produktentscheid 27.09.2026: «Regeln werden ja bei der
 * Gemeinschaft hinterlegt inkl. Artikel.» Eine hinterlegte Regel gilt in beide
 * Richtungen. Für eine Regel, die in einem Punkt strenger und in einem anderen
 * milder ist, etwa zwei Drittel der Anwesenden nach Köpfen ohne die Wertquoten
 * des Gesetzes: «Gesetz geht also vor. Muss aber in Votum als hinweis angegeben
 * werden.» Eine Einstellung dafür gibt es bewusst nicht. Das Werkzeug rechnet
 * dann nach dem Gesetz und nennt die Klausel; hinterlegt wird sie so, wie sie im
 * Reglement steht. Grundlage:
 * `quellen/pruefung/berichte/2026-09-27-anwaltsfragen-empfehlung.md`, A-1.
 *
 * **Die Hinweise der Karte bleiben.** Sie sagen, was rechtlich umstritten ist
 * (Erschwerung, Art. 712g Rz. 40 und 125 gegen Steinauer; BGer 5C.50/2004
 * E. 4.2) und dass eine Erleichterung einstimmig beschlossen sein musste
 * (Rz. 84). Das bleibt wahr; geändert hat sich, was das Werkzeug tut, und das
 * sagt der Kasten (`reglementssatz` in `entscheidbaum.ts`).
 *
 * **`k-ausschlussklage`: Recht auf Gehör.** Wem der Ausschluss droht, hat das
 * Recht, von der Versammlung angehört zu werden, bevor die Klage eingeleitet
 * wird (BGer 5A_198/2014 E. 5.4); auf seine Einladung darf nur verzichtet
 * werden, wenn seine Anwesenheit für seine Verfahrensrechte nicht nötig ist
 * (E. 5.3.3; Art. 712m Rz. 149). Produktentscheid 27.09.2026: eine Zeile auf
 * der Karte, keine Sperre, keine Abfrage (`quellen`, Frage 51). **Angehängt,
 * nicht ersetzt**: Die Karte trägt seit 2026-10-03 sechs Hinweise.
 */

import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_05 } from './quorum-2026-10-05';

const GEHOER =
	'Die Person, gegen die geklagt werden soll, muss zur Versammlung eingeladen sein. Fehlt ihre ' +
	'Einladung, ist der Beschluss angreifbar, bei absichtlichem Übergehen kann er nichtig sein; ' +
	'vertagen Sie das Geschäft dann. Sie erhält vor der Abstimmung das Wort, an der weiteren ' +
	'Beratung und an der Abstimmung nimmt sie nicht teil (BGer 5A_198/2014 E. 5.3.2 bis 5.4; ' +
	'Art. 712m Rz. 149).';

const KNOTEN_NEU: Record<string, (k: Ergebnisknoten) => Ergebnisknoten> = {
	'k-reglement-normal': (k) => ({ ...k, reglementsverhalten: 'einordnen' }),
	'k-ausschlussklage': (k) => ({ ...k, hinweise: [...(k.hinweise ?? []), GEHOER] })
};

export const REGELWERK_2026_10_06 = {
	...REGELWERK_2026_10_05,
	fassung: '2026-10-06',

	quellen: [
		...REGELWERK_2026_10_05.quellen,
		'BGer 5A_198/2014 E. 5.3.2 bis 5.4 (Einladung, Gehör vor der Versammlung, keine Teilnahme an Beratung und Abstimmung); ' +
			'Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 149 (Verzicht auf die Einladung nur, ' +
			'wo kein Gehör nötig ist).'
	],

	knoten: REGELWERK_2026_10_05.knoten.map((k): Ergebnisknoten => KNOTEN_NEU[k.id]?.(k) ?? k),

	freigabevermerk:
		REGELWERK_2026_10_05.freigabevermerk +
		' Am 06.10.2026 wendet das Werkzeug bei der gewöhnlichen Reglementsänderung eine ' +
		'hinterlegte Regel auch an, wenn sie strenger ist als das Gesetz; eine Regel, die in einem ' +
		'Punkt strenger und im anderen milder ist, nicht. Die Karte zur Ausschlussklage nennt das ' +
		'Recht der beklagten Person auf Gehör. Das gesetzliche Erfordernis bleibt; wo eine ' +
		'strengere Regel hinterlegt ist, kann eine Reglementsänderung jetzt mehr Stimmen brauchen. ' +
		'Mit dieser Fassung gilt auch: Einen Stichentscheid des Verwalters wendet das Werkzeug nicht ' +
		'mehr an, ein Gleichstand ist dann eine Ablehnung; und bei Zweckänderung und Grundordnung ' +
		'schlägt es ohne Absprache den Eigentümer statt des Nutzniessers als stimmberechtigt vor.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
