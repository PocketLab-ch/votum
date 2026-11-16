/**
 * Die Neuabstimmung nach Eintritt der Beschlussfähigkeit (Produktentscheid
 * 03.10.2026, «Einstellbar, Vorgabe direkt»).
 *
 * **Der Fall.** Eine Versammlung ist nicht beschlussfähig (ZGB Art. 712p), und
 * die Sitzungsleitung hält einen Beschluss von Hand fest. Treffen später am
 * selben Abend weitere Eigentümer ein, wird die Versammlung beschlussfähig.
 * Votum verlangte für einen zweiten Durchgang über denselben Gegenstand bisher
 * einen angenommenen Rückkommensantrag. Die rechtliche Klärung (`quellen`,
 * Frage 59) fand keine Stelle zu einer zweiten Abstimmung am selben Abend; das
 * Rückkommen mit eigener Mehrheit ist eine Hausbildung und gemessen am Bestand
 * eher zu streng.
 *
 * **Der Entscheid.** Je Gemeinschaft umstellbar, Vorgabe «direkt». Der zweite
 * Durchgang läuft über den gewohnten Weg der Abstimmung; beide Durchgänge
 * stehen mit Uhrzeit und Präsenz im Protokoll. Die Sitzungsleitung trägt die
 * Wahl — die Anwendung hält sie nicht auf.
 *
 * **Nur, wo wirklich keine Beschlussfähigkeit war.** Der direkte Weg gilt
 * allein, wenn der geltende Durchgang von Hand festgehalten wurde **und** die
 * Versammlung damals nicht beschlussfähig war. Eine zweite Abstimmung über
 * einen gültig gefassten Beschluss bleibt beim Rückkommen. Die Prüfung der
 * Tatsache steht im Server (`direktNachQuorumLage` in `server/abstimmung.ts`);
 * hier stehen die Werte, die Sätze und die eine Regel der Anzeige.
 *
 * **Was mit dem ersten Beschluss geschieht** (`quellen` Frage 59, Folgerung
 * aus Rz. 202a ad Art. 712g und Rz. 207 ad Art. 712m, kein wörtlicher Beleg):
 * Er wirkt bis zum neuen Beschluss. Ein **angenommener** neuer Beschluss mit
 * dem erforderlichen Mehr ersetzt ihn; eine Ablehnung und ein Durchgang ohne
 * Beschluss lassen ihn in Kraft. Anders als im Rückkommensweg, wo schon der
 * Rückkommensbeschluss der Widerruf mit dem erforderlichen Mehr ist und
 * deshalb «Nein heisst Nein» trägt (Fachprüfung 03.10.2026). Die Schranken der
 * Ersetzung (Gestaltungswirkung, bereits Realisiertes) prüft die Anwendung
 * nicht; die Sitzungsleitung trägt die Wahl.
 */
import { FachlicherFehler } from './fehler';

export const NEUABSTIMMUNGSARTEN = ['direkt', 'rueckkommen'] as const;
export type Neuabstimmungsart = (typeof NEUABSTIMMUNGSARTEN)[number];

/**
 * Die Vorgabe.
 *
 * **Der Produktentscheid vom 03.10.2026.** «Vorgabe direkt»: Wo die
 * Versammlung erst nachträglich beschlussfähig wird, lässt sich direkt neu
 * abstimmen; die Hausbildung «Rückkommen mit eigener Mehrheit» wird damit zur
 * wählbaren strengeren Variante. Die Vorgabe gilt für bestehende
 * Gemeinschaften mit der Migration und ändert keine bestehende Angabe.
 */
export const NEUABSTIMMUNG_VORGABE: Neuabstimmungsart = 'direkt';

export function istNeuabstimmungsart(wert: unknown): wert is Neuabstimmungsart {
	return typeof wert === 'string' && (NEUABSTIMMUNGSARTEN as readonly string[]).includes(wert);
}

export function pruefeNeuabstimmung(wert: unknown): Neuabstimmungsart {
	if (!istNeuabstimmungsart(wert)) {
		throw new FachlicherFehler(
			'neuabstimmung_unbekannt',
			'Wählen Sie, ob nach Eintritt der Beschlussfähigkeit direkt oder über das Rückkommen neu ' +
				'abgestimmt wird.',
			'neuabstimmung'
		);
	}
	return wert;
}

/**
 * Der Satz der Sitzungsleitung, wenn der direkte Weg offensteht — vor dem
 * Knopf «Abstimmung freigeben».
 *
 * `beschlussfaehig` unterscheidet die zwei Lagen: Ist die Versammlung schon
 * beschlussfähig, kann freigegeben werden; ist sie es noch nicht, wartet der
 * Weg auf die Beschlussfähigkeit.
 *
 * **Der Text sagt, was die Einstellung zulässt, nicht was das Gesetz gebietet**
 * (Fachprüfung 03.10.2026): Ob die Leitung ohne Beschluss der Versammlung neu
 * abstimmen lassen darf, ist im Bestand offen (`quellen` Frage 59). Der
 * Produktentscheid überträgt die Wahl der Sitzungsleitung; der Satz nennt
 * deshalb die Einstellung der Gemeinschaft.
 *
 * **Nur die Annahme ersetzt** (Fachprüfung 03.10.2026): Der frühere Beschluss
 * weicht einem angenommenen zweiten Beschluss mit dem erforderlichen Mehr
 * (Rz. 202a ad Art. 712g); eine Ablehnung oder ein Durchgang ohne Beschluss
 * lässt ihn in Kraft (Rz. 207 ad Art. 712m). Anders als im Rückkommensweg, wo
 * schon der Rückkommensbeschluss der Widerruf mit dem erforderlichen Mehr ist.
 */
export function direktNachQuorumSatz(durchgang: number, beschlussfaehig: boolean): string {
	const kopf =
		`Die Sitzungsleitung hat den Beschluss des ${durchgang}. Durchgangs festgehalten, obwohl ` +
		'die Versammlung nicht beschlussfähig war. Ihre Gemeinschaft lässt den zweiten Durchgang ' +
		'direkt zu. ';
	const wirkung =
		'Wird der Antrag angenommen, ersetzt der neue Durchgang das frühere Ergebnis. Wird er ' +
		'abgelehnt oder kommt kein Beschluss zustande, bleibt es beim früheren Ergebnis. Was der ' +
		'frühere Beschluss bereits bewirkt hat, lässt sich nicht rückgängig machen. Ob neu ' +
		'abgestimmt wird, entscheiden Sie.';
	return beschlussfaehig
		? kopf + 'Die Versammlung ist jetzt beschlussfähig; Sie können die Abstimmung freigeben. ' + wirkung
		: kopf +
				'Sobald die Versammlung beschlussfähig ist, können Sie die Abstimmung freigeben; ' +
				'solange die Warnung «Nicht beschlussfähig» steht, ist es noch nicht so weit. ' +
				wirkung;
}
