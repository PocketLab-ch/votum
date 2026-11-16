/**
 * Regelwerk, Fassung 2026-10-15.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert, was eine hinterlegte
 * Reglementsregel an zehn Karten darf und was die Karte dazu sagt; an den
 * Wegen durch den Entscheidbaum und an den gesetzlichen Erfordernissen
 * ändert sich nichts.
 *
 * **Der Anlass.** Acht Karten trugen `gesperrt_vereinbarung`: Das Gesetz lässt
 * dort eine andere Ordnung nur zu, wenn sie einstimmig oder im Begründungsakt
 * eingeführt wurde, und die Anwendung kann das nicht prüfen. Sie wandte eine
 * hinterlegte Regel deshalb nicht an, und der Satz bei hinterlegter Regel
 * versprach «Wurde sie es, dürfen Sie nach ihr auszählen», ohne dass es dafür
 * einen Weg gab. Produktentscheid 07.10.2026: Die Gemeinschaft hat für genau
 * diesen Fall die Regeln je Geschäftsart; eine dort hinterlegte Regel wird
 * angewandt, die Gemeinschaft steht mit der Fundstelle dafür ein, wie sie
 * zustande kam.
 *
 * **Nach der Fachprüfung, nicht überall** (Fachprüfung 07.10.2026 vor dem Bau,
 * Bericht `quellen/pruefung/berichte/2026-10-07-votum-vereinbarte-ordnung.md`;
 * Produktentscheid 07.10.2026 «Nach Fachprüfung»). Neben der Einführung gibt
 * es eine zweite Bedingung, die auch eine einstimmige Klausel nicht aushebelt:
 * ihren Inhalt. Deshalb:
 *
 *   - **`vereinbart`** an fünf Karten (notwendige und nützliche bauliche
 *     Massnahme, Benutzungsweise, Zweckbestimmung, wichtigere
 *     Verwaltungshandlung): Die Regel gilt, strenger wie milder; eine Regel,
 *     die dort Einstimmigkeit verlangt, wendet `wendeReglementAn` nicht an.
 *   - **`nur_mildern`** an der luxuriösen Massnahme mit Kostenübernahme: Das
 *     Quorum von Art. 647e Abs. 2 «kann verringert, aber nicht verschärft
 *     werden» (Rz. 54 ad Art. 712g). Der Hinweis, die Anwendung folge der
 *     strengeren Lesart und wende keine Erleichterung an, wird ersetzt: Rz. 136
 *     ad Art. 712a betrifft die Erleichterung von Abs. 1, nicht dieses Quorum.
 *   - **gesperrt bleiben** die luxuriöse Massnahme (strenger als alle geht
 *     nicht, die Erleichterung ist umstritten) und der Verkauf oder die
 *     Belastung des Grundstücks (umstritten, ob eine andere Ordnung bei
 *     Verfügungen gilt und spätere Erwerber bindet), je mit eigenem Rechtssatz.
 *   - **Abberufung und Wertquotenänderung** bleiben `gesperrt_zwingend`, mit
 *     eigenem Rechtssatz statt «zwingendes Recht … unbeachtlich»
 *     (Fachprüfung 07.10.2026 zum Kasten an gesperrten Karten).
 *
 * Die Ausnahme beim Wortlaut: Die Fassung ersetzt einen Hinweis an
 * `k-baulich-luxurioes-ausweg` am Wortanfang und wirft beim Laden, wenn er
 * nicht genau einmal vorkommt (dieselbe Falle wie 2026-10-14).
 */
import type { Ergebnisknoten, Reglementsverhalten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_14 } from './quorum-2026-10-14';

/**
 * «Mit weniger beschlossen»: an allen Karten derselbe Satz (Fachprüfung
 * Runde 2, 07.10.2026, B3). Notwendige, nützliche Massnahme und wichtigere
 * Verwaltungshandlung hängen an derselben Norm, Art. 712g Abs. 2; drei
 * verschiedene Antworten trugen die Fundstellen nicht. Rz. 130 ad Art. 712a
 * begründet sein «Ansonsten» mit derselben Stelle (PKG 1996 S. 32), die
 * Rz. 194 ad Art. 712m für die Klarheit anführt; Rz. 207 spricht eher für die
 * Wirkung bis zur Aufhebung. Mit Fristbeginn (B8, Rz. 230 ad Art. 712m).
 * Runde 3: auch am Ausweg, der an derselben Norm hängt und dort «gilt nur»
 * sagte (Fachprüfung B2); die Frist ist die gegen den Einführungsbeschluss,
 * nicht gegen den heutigen (Laienprüfung).
 */
const TROTZDEM =
	'Ob eine mit weniger beschlossene Bestimmung nach Ablauf der Anfechtungsfrist trotzdem gilt, ' +
	'ist nicht geklärt: Dafür sprechen BGE 143 III 537 E. 4.2.4 (dort zur Berechnungsweise) und ' +
	'SVIT-Kommentar Rz. 206 f. ad Art. 712m; bei der nützlichen Massnahme wendet der Kommentar dann ' +
	'das Gesetz an (Rz. 130 ad Art. 712a). Die Frist, den Beschluss anzufechten, mit dem sie ' +
	'eingeführt wurde, beträgt einen Monat seit Kenntnis, für Abwesende in der Regel seit Erhalt ' +
	'des Protokolls (Rz. 230 ad Art. 712m).';

/**
 * Der Rechtssatz je Karte (Fachprüfung 07.10.2026, «Rechtslage für die Karte»,
 * gekürzt; die Fundstellen sind dort wörtlich belegt).
 */
export const REGLEMENTSRECHT: Record<string, string> = {
	'k-baulich-notwendig':
		'Ihr Reglement darf das Mehr verschärfen, nach herrschender Lehre aber nicht bis zur ' +
		'Einstimmigkeit, und es lässt den Anspruch jedes Eigentümers auf das Gericht und auf ' +
		'dringliche Massnahmen unberührt (Art. 647 Abs. 2; SVIT-Kommentar Rz. 36 ad Art. 712g, ' +
		'Rz. 125 ad Art. 712a). Ob es das Mehr erleichtern darf, ist umstritten; der SVIT-Kommentar ' +
		'hält es für zulässig, solange nicht eine kleine Minderheit genügt (dieselben Stellen). ' +
		`${TROTZDEM} Bei einer Erleichterung ist die Geltung noch unsicherer, weil schon ihre ` +
		'Zulässigkeit umstritten ist.',
	'k-baulich-nuetzlich':
		'Ihr Reglement darf das qualifizierte Mehr verschärfen und nach dem SVIT-Kommentar bis zum ' +
		'einfachen Mehr erleichtern; ob es erleichtern darf, ist umstritten, und Einstimmigkeit darf es ' +
		'nach dem Kommentar nicht verlangen (Rz. 37 ad Art. 712g, Rz. 130 ad Art. 712a; anders LGVE ' +
		'2011 I Nr. 10). Die Zustimmung dessen, dem der Gebrauch erheblich und dauernd erschwert wird, ' +
		'und der Schutz vor unzumutbaren Kosten gelten trotz jeder Bestimmung (Art. 647d Abs. 2 und 3; ' +
		`Rz. 53 ad Art. 712g). ${TROTZDEM}`,
	'k-benutzungsweise':
		'Ihr Reglement darf das Mehr für die Änderung der Benutzungsweise erschweren oder erleichtern, ' +
		'solange es nicht missbräuchlich ist (SVIT-Kommentar Rz. 35 ad Art. 712g); eine generelle ' +
		'Einstimmigkeit hält der Kommentar in der Regel für missbräuchlich (Rz. 196 ad Art. 712m). ' +
		'Eine erhebliche Einschränkung des Sonderrechts braucht weiter ' +
		'die Zustimmung aller oder des Betroffenen, und für eine Änderung der Zweckbestimmung gilt diese ' +
		`Bestimmung nicht (Rz. 79 ad Art. 712a; BGer 5A_352/2012 E. 4.3.2 f.). ${TROTZDEM}`,
	'k-zweckbestimmung':
		'Ihr Reglement darf für die Änderung der Zweckbestimmung ein anderes Mehr vorsehen, wenn alle ' +
		'Eigentümer dieser Ordnung zugestimmt haben oder sie im Begründungsakt steht (Art. 648 Abs. 2; ' +
		'SVIT-Kommentar Rz. 40b ad Art. 712g, Rz. 8a ad Art. 712m). Wie weit es erleichtern darf, sagt ' +
		'das Gesetz nicht (Rz. 150f ad Art. 712a); eine erhebliche Einschränkung des Sonderrechts braucht ' +
		'weiter die Zustimmung der Betroffenen. Eine solche Vereinbarung braucht in der Regel die ' +
		'Unterschrift aller; ein Versammlungsprotokoll genügt meist nicht (Rz. 8a ad Art. 712m). Ob ' +
		'eine mit weniger beschlossene Ordnung nach Ablauf der Anfechtungsfrist gilt, ist nicht ' +
		'geklärt.',
	'k-verwaltung-wichtig':
		'Ihr Reglement darf das Mehr für wichtigere Verwaltungshandlungen erschweren oder erleichtern, ' +
		'solange es nicht missbräuchlich ist (SVIT-Kommentar Rz. 35 ad Art. 712g, Rz. 111 ad ' +
		'Art. 712a); eine generelle Einstimmigkeit hält der Kommentar in der Regel für missbräuchlich ' +
		'(Rz. 196 ad Art. 712m). Notwendige bauliche Massnahmen bleiben beim einfachen Mehr ' +
		`(Art. 647b Abs. 2). ${TROTZDEM}`,
	'k-baulich-luxurioes-ausweg':
		'Ihr Reglement darf das Mehr für diesen Ausweg senken, aber nicht erhöhen, und die drei ' +
		'Bedingungen gelten weiter (SVIT-Kommentar Rz. 54 ad Art. 712g, Rz. 136 ad Art. 712a). ' +
		'Rechtmässig ist eine solche Bestimmung nur, wenn alle Eigentümer ihr zugestimmt haben oder ' +
		'sie im Begründungsakt steht (Art. 712g Abs. 2). Ob Art. 647e Abs. 2 zwingend ist, ist in der ' +
		`Lehre umstritten (Rz. 54 ad Art. 712g). ${TROTZDEM}`,
	'k-baulich-luxurioes':
		'Strenger als die Zustimmung aller geht nicht. Ob Ihr Reglement die Einstimmigkeit erleichtern ' +
		'darf, ist umstritten; nach dem SVIT-Kommentar nur so weit, dass die drei Bedingungen der ' +
		'Kostenübernahme weiter gelten: keine dauernde Beeinträchtigung, Ersatz für die vorübergehende, ' +
		'Übernahme des Kostenanteils (Rz. 136 ad Art. 712a, Rz. 54 ad Art. 712g).',
	'k-grundstueck-verkauf':
		'Für das Miteigentum lässt das Gesetz eine andere Ordnung für Verkauf und Belastung zu, wenn ' +
		'alle Eigentümer sie ' +
		'vereinbart haben (Art. 648 Abs. 2; SVIT-Kommentar Rz. 18 ad Art. 712g, Rz. 176 ad Art. 712m), ' +
		'nie für die Aufhebung (dieselbe Rz. 18). Ob eine solche Ordnung bei Verfügungen im Stockwerkeigentum überhaupt ' +
		'zulässig ist und spätere Erwerber bindet, ist umstritten (Marxer Rz. 351 f., zum ' +
		'Stockwerkeigentum im Baurecht, für die Erwerber gestützt auf die allgemeine Lehre zu ' +
		'Art. 648, Fn. 1257).',
	'k-bewirtschaftung-abberufen':
		'Ein Reglement darf das einfache Mehr der Abberufung weder erschweren noch erleichtern ' +
		'(SVIT-Kommentar Rz. 64 ad Art. 712g; Donau Rz. 740; für die Erschwerung auch Rz. 23 ad ' +
		'Art. 712r). Anderer Meinung, in beiden Richtungen, ist K. Müller (nach Donau Rz. 740).',
	'k-wertquoten-aendern':
		'Wer unmittelbar betroffen ist, muss einzeln zustimmen: die Eigentümer, deren Quote sich ändert, ' +
		'in der Regel auch Pfandgläubiger und Nutzniesser ihrer Einheiten; das lässt sich nicht ' +
		'abbedingen (SVIT-Kommentar Rz. 75 ff. ad Art. 712e), und ohne die Zustimmung eines betroffenen ' +
		'Eigentümers ist die Änderung nichtig (Rz. 212 ad Art. 712m). Ob die Gemeinschaft einstimmig auf ' +
		'die Genehmigung durch die Versammlung verzichten kann, ist umstritten (Rz. 86 ad Art. 712e); der ' +
		'SVIT-Kommentar verneint es und lehnt auch eine Verschärfung ab (Rz. 87). Eine Erleichterung ' +
		'erörtert er nicht.'
};

/** Das neue Verhalten je Karte; die übrigen behalten ihres. */
const VERHALTEN: Record<string, Reglementsverhalten> = {
	'k-baulich-notwendig': 'vereinbart',
	'k-baulich-nuetzlich': 'vereinbart',
	'k-benutzungsweise': 'vereinbart',
	'k-zweckbestimmung': 'vereinbart',
	'k-verwaltung-wichtig': 'vereinbart',
	'k-baulich-luxurioes-ausweg': 'nur_mildern'
};

/** Der Hinweis der Vorfassung zur Milderung am Ausweg, am Wortanfang erkannt. */
const AUSWEG_ALT_ANFANG = 'Ob das Reglement dieses Quorum mildern darf, ist umstritten';

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function fassung20261015(k: Ergebnisknoten): Ergebnisknoten {
	const recht = REGLEMENTSRECHT[k.id];
	const verhalten = VERHALTEN[k.id];
	if (!recht && !verhalten) return k;
	let hinweise = k.hinweise;
	if (k.id === 'k-baulich-luxurioes-ausweg') {
		const alt = k.hinweise ?? [];
		if (alt.filter((h) => h.startsWith(AUSWEG_ALT_ANFANG)).length !== 1) {
			throw new Error(
				'Fassung 2026-10-15: Der Hinweis zur Milderung am Ausweg ist nicht der der Vorfassung.'
			);
		}
		// Entfällt: Was er sagte, steht jetzt richtig im Rechtssatz des Knotens.
		hinweise = alt.filter((h) => !h.startsWith(AUSWEG_ALT_ANFANG));
	}
	return {
		...k,
		...(hinweise ? { hinweise } : {}),
		...(verhalten ? { reglementsverhalten: verhalten } : {}),
		...(recht ? { reglementsrecht: recht } : {})
	};
}

export const REGELWERK_2026_10_15 = {
	...REGELWERK_2026_10_14,
	fassung: '2026-10-15',

	quellen: [
		...REGELWERK_2026_10_14.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 35 bis 37, 53, 54, 64; Art. 712a Rz. 79, 111, ' +
			'125, 130, 136, 150f; Art. 712m Rz. 8a, 176, 196, 206 f., 212; Art. 712e Rz. 75 bis 87; ' +
			'Art. 712d Rz. 157. Donau, Der Verwalter, Rz. 740. Marxer, Baurecht, Rz. 351 f. BGE 143 III ' +
			'537 E. 4.2.4; BGE 144 III 510 E. 2.2.4; BGer 5A_352/2012 E. 4.3.2 f.'
	],

	knoten: REGELWERK_2026_10_14.knoten.map(fassung20261015),

	freigabevermerk:
		REGELWERK_2026_10_14.freigabevermerk +
		' Am 15.10.2026 wendet das Werkzeug eine hinterlegte Reglementsregel bei notwendigen und ' +
		'nützlichen baulichen Massnahmen, bei der Benutzungsweise, der Zweckbestimmung und den ' +
		'wichtigeren Verwaltungshandlungen an, ausser sie verlangt dort Einstimmigkeit; die Gemeinschaft ' +
		'steht mit der Fundstelle dafür ein, dass sie einstimmig oder im Begründungsakt eingeführt wurde. ' +
		'Beim Ausweg der luxuriösen Massnahme wendet es nur eine mildere Regel an. Luxuriöse Massnahme ' +
		'und Verkauf bleiben gesperrt, Abberufung und Wertquotenänderung ebenso, je mit dem Rechtssatz ' +
		'der Fachprüfung vom 07.10.2026.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
