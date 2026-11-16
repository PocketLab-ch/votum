/**
 * Regelwerk, Fassung 2026-10-16.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert nur den Rechtssatz an
 * sieben Karten (`reglementsrecht`); Verhalten, Wege und gesetzliche Erfordernisse
 * bleiben wie in 2026-10-15.
 *
 * **Der Anlass.** Die Fachprüfung des Website-Abzugs vom 07.10.2026
 * (`quellen/pruefung/zu-pruefen-2026-10-07-quorenfinder-abzug-2026-10-15.md`)
 * las die Rechtssätze ein viertes Mal am Volltext und fand vier, die mehr
 * oder anderes sagten als ihre Belege, und einen Fristsatz ohne «ohne
 * Vertretung»:
 *
 *   - **Ausweg der luxuriösen Massnahme:** «darf senken» stand als gesichert
 *     da. Rz. 54 ad Art. 712g lässt es zu («kann verringert, aber nicht
 *     verschärft werden»), Rz. 136 ad Art. 712a hält das System von
 *     Art. 647e Abs. 1 und 2 für zwingend. Produktentscheid 08.10.2026
 *     («Bleibt, Text ehrlich»): Votum wendet eine mildere Regel weiter an, die
 *     Karte sagt, dass es umstritten ist.
 *   - **Luxuriöse Massnahme:** Rz. 136 sagt «nicht über das in Art. 647e
 *     Abs. 2 vorgesehene Mass»; die Karte gab das als «die drei Bedingungen
 *     gelten weiter» wieder. Dazu die Einführungsbedingung, die dort fehlte.
 *   - **Verkauf:** Rz. 18 ad Art. 712g wendet die andere Ordnung ausdrücklich
 *     auch auf das Stammgrundstück eines Stockwerkeigentums an; die
 *     Gegenstelle ist eine Einzelmeinung zum Baurecht (Marxer Rz. 351). Die
 *     Karte stellte den Streit strenger dar als die Quelle. Votum wendet eine
 *     Regel dort weiter nicht an: Ob sie spätere Erwerber bindet, verneint
 *     Marxer mit der von ihm zitierten Lehre (Rz. 352 mit Fn. 1257), der
 *     SVIT-Kommentar sieht sie im Reglement (Rz. 40b ad Art. 712g). Die
 *     Aufhebung folgt aus Art. 712f Abs. 2 (Fachprüfung der Fassung, B4).
 *   - **Wichtigere Verwaltungshandlung:** «Notwendige bauliche Massnahmen
 *     bleiben beim einfachen Mehr (Art. 647b Abs. 2)» las sich, als dürfe ein
 *     Reglement dort nichts ändern; Art. 647b Abs. 2 behält nur die eigene
 *     Bestimmung vor, und die notwendige Massnahme hat ihre eigene Karte.
 *   - **Fristsatz zur Einführung mit weniger** (an fünf Karten): «für
 *     Abwesende» ohne «ohne Vertretung» (Rz. 230 ad Art. 712m: «abwesenden
 *     (und nicht vertretenen)»). Wer vertreten war, rechnete die Frist zu spät.
 *
 * Die Fassung prüft beim Laden, dass jede Ersetzung genau einmal greift, und
 * wirft sonst (dieselbe Falle wie 2026-10-14 und 2026-10-15).
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_15, REGLEMENTSRECHT as RECHT_15 } from './quorum-2026-10-15';

const FRIST_ALT = 'für Abwesende in der Regel seit Erhalt des Protokolls';
const FRIST_NEU = 'für Abwesende ohne Vertretung in der Regel ab Erhalt des Protokolls';

/** Die Karten, an denen der Fristsatz der Vorfassung steht (über `TROTZDEM`). */
const MIT_FRISTSATZ = [
	'k-baulich-notwendig',
	'k-baulich-nuetzlich',
	'k-benutzungsweise',
	'k-verwaltung-wichtig'
];

/** Der Satz zur Einführung mit weniger, mit dem Fristbeginn wie Rz. 230. */
const TROTZDEM =
	'Ob eine mit weniger beschlossene Bestimmung nach Ablauf der Anfechtungsfrist trotzdem gilt, ' +
	'ist nicht geklärt: Dafür sprechen BGE 143 III 537 E. 4.2.4 (dort zur Berechnungsweise) und ' +
	'SVIT-Kommentar Rz. 206 f. ad Art. 712m; bei der nützlichen Massnahme wendet der Kommentar dann ' +
	'das Gesetz an (Rz. 130 ad Art. 712a). Die Frist, den Beschluss anzufechten, mit dem sie ' +
	`eingeführt wurde, beträgt einen Monat seit Kenntnis, ${FRIST_NEU} (Rz. 230 ad Art. 712m).`;

function mitNeuerFrist(id: string): string {
	const alt = RECHT_15[id];
	if (alt.split(FRIST_ALT).length !== 2) {
		throw new Error(`Fassung 2026-10-16: Der Fristsatz an ${id} ist nicht der der Vorfassung.`);
	}
	return alt.replace(FRIST_ALT, FRIST_NEU);
}

/** Der Satz der Vorfassung an der wichtigeren Verwaltungshandlung, der ersetzt wird. */
const VERWALTUNG_ALT = 'Notwendige bauliche Massnahmen bleiben beim einfachen Mehr (Art. 647b Abs. 2).';
const VERWALTUNG_NEU =
	'Für notwendige bauliche Massnahmen gilt nicht diese Karte, sondern ihre eigene (Art. 647b ' +
	'Abs. 2, Art. 647c).';

function verwaltungWichtig(): string {
	const mitFrist = mitNeuerFrist('k-verwaltung-wichtig');
	if (mitFrist.split(VERWALTUNG_ALT).length !== 2) {
		throw new Error(
			'Fassung 2026-10-16: Der Satz zur notwendigen Massnahme an k-verwaltung-wichtig ist nicht der der Vorfassung.'
		);
	}
	return mitFrist.replace(VERWALTUNG_ALT, VERWALTUNG_NEU);
}

/** Die geänderten Rechtssätze; die übrigen drei bleiben wie in 2026-10-15. */
export const REGLEMENTSRECHT_NEU: Record<string, string> = {
	...Object.fromEntries(MIT_FRISTSATZ.map((id) => [id, mitNeuerFrist(id)])),
	'k-verwaltung-wichtig': verwaltungWichtig(),
	'k-baulich-luxurioes-ausweg':
		'Nach dem SVIT-Kommentar darf Ihr Reglement das Mehr für diesen Ausweg nicht erhöhen; ob die ' +
		'Regel des Auswegs zwingend ist, ist in der Lehre umstritten (Rz. 54 ad Art. 712g). Ob es das ' +
		'Mehr senken darf, ist ebenfalls umstritten, und der Kommentar ist darin nicht eindeutig: ' +
		'Rz. 54 ad Art. 712g lässt es zu, Rz. 136 ad Art. 712a hält das System von Art. 647e Abs. 1 ' +
		'und 2 für zwingend, also für nicht durch ein Reglement abänderbar. Die drei Bedingungen ' +
		'gelten ausdrücklich nach Rz. 136; Rz. 54 lockert nur das Quorum. Rechtmässig ist ' +
		'eine solche Bestimmung nur, wenn alle Eigentümer ihr zugestimmt haben oder sie im ' +
		`Begründungsakt steht (Art. 712g Abs. 2). ${TROTZDEM}`,
	'k-baulich-luxurioes':
		'Strenger als die Zustimmung aller geht nicht. Ob Ihr Reglement die Einstimmigkeit erleichtern ' +
		'darf, ist umstritten; nach dem SVIT-Kommentar höchstens so weit wie der Ausweg mit ' +
		'Kostenübernahme durch die übrigen, der eine eigene Karte hat, mit dessen drei Bedingungen: ' +
		'keine dauernde Beeinträchtigung, Ersatz für die vorübergehende, und die Zustimmenden ' +
		'übernehmen den Kostenanteil der übrigen (Rz. 136 ad Art. 712a). Eine solche Bestimmung müsste ' +
		'ausserdem von allen Eigentümern beschlossen sein oder im Begründungsakt stehen (Art. 712g ' +
		'Abs. 2).',
	'k-grundstueck-verkauf':
		'Art. 648 Abs. 2 lässt eine andere Ordnung für Verkauf und Belastung zu, wenn alle Eigentümer ' +
		'sie vereinbart haben (SVIT-Kommentar Rz. 18 ad Art. 712g, Rz. 176 ad Art. 712m); für die ' +
		'Aufhebung des Stockwerkeigentums nie (Art. 712f Abs. 2, dieselben Stellen). Der SVIT-Kommentar ' +
		'wendet das ausdrücklich auch im Stockwerkeigentum an (Rz. 18); anderer Meinung ist Marxer in ' +
		'seinem Kommentar zum Baurecht, für Stockwerkeigentum auf fremdem Boden (Rz. 351). Spätere ' +
		'Erwerber bindet eine solche Ordnung nach Marxer und der von ihm zitierten Lehre nicht ' +
		'(Rz. 352 mit Fn. 1257); der SVIT-Kommentar sieht sie im Reglement verankert, das auch ' +
		'Erwerber bindet (Rz. 40b ad Art. 712g). Beides ist offen.'
};

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function fassung20261016(k: Ergebnisknoten): Ergebnisknoten {
	const recht = REGLEMENTSRECHT_NEU[k.id];
	return recht ? { ...k, reglementsrecht: recht } : k;
}

export const REGELWERK_2026_10_16 = {
	...REGELWERK_2026_10_15,
	fassung: '2026-10-16',

	quellen: [
		...REGELWERK_2026_10_15.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 18, 40b, 54; Art. 712a Rz. 136; Art. 712m ' +
			'Rz. 230. Marxer, Baurecht, Rz. 351, 352 mit Fn. 1257. ZGB Art. 647b Abs. 2, 647c, 712f Abs. 2.'
	],

	knoten: REGELWERK_2026_10_15.knoten.map(fassung20261016),

	freigabevermerk:
		REGELWERK_2026_10_15.freigabevermerk +
		' Am 16.10.2026 sagen sieben Rechtssätze genauer, was ihre Belege tragen: am Ausweg der luxuriösen ' +
		'Massnahme, dass umstritten ist, ob ein Reglement das Mehr senken darf; an der luxuriösen ' +
		'Massnahme und beim Verkauf die Kommentarstellen im Wortlaut; an der wichtigeren ' +
		'Verwaltungshandlung der Verweis auf die eigene Karte der notwendigen Massnahme; und beim ' +
		'Fristbeginn «ohne Vertretung». Am Verhalten ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
