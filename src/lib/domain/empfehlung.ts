/**
 * Die Empfehlung der vertretenen Person an ihre bevollmächtigte Person (rein).
 *
 * **Empfehlung, nicht Stimme — das ist der ganze Entwurf.** Wer nicht kommen
 * kann, darf sagen, was er will; abgeben muss es die bevollmächtigte Person
 * selbst. Eine im Voraus festgelegte Stimme ignorierte die Beratung, und die
 * Versammlung berät. Aus einer Vertretung würde eine Briefwahl, und die ist
 * rechtlich etwas anderes — der Zirkularbeschluss steht nicht ohne Grund unter
 * «nicht in Version 1».
 *
 * **Was hier gerechnet wird, ist deshalb nur eines:** ob die Empfehlung sich
 * noch auf den Antrag bezieht, über den gleich abgestimmt wird.
 */

export const EMPFEHLUNGEN = ['ja', 'nein', 'enthaltung'] as const;
export type Empfehlungswahl = (typeof EMPFEHLUNGEN)[number];

export function istEmpfehlungswahl(wert: unknown): wert is Empfehlungswahl {
	return typeof wert === 'string' && (EMPFEHLUNGEN as readonly string[]).includes(wert);
}

export function empfehlungInWorten(wahl: Empfehlungswahl): string {
	return wahl === 'ja' ? 'Ja' : wahl === 'nein' ? 'Nein' : 'Enthaltung';
}

/**
 * Zwei Wortlaute gelten als derselbe, wenn sie sich nur im Leerraum
 * unterscheiden.
 *
 * **Warum nicht Zeichen für Zeichen.** Ein Zeilenumbruch, der beim Bearbeiten
 * verrutscht, ist keine Änderung des Antrags. Eine Empfehlung deswegen fallen
 * zu lassen, hiesse den Leuten ihre Weisung wegen einer Formatierung zu
 * nehmen — und sie würden es zu Recht nicht verstehen.
 *
 * Alles darüber hinaus zählt: ein geändertes Wort, ein anderer Betrag, ein
 * eingefügter Halbsatz. Im Zweifel fällt die Empfehlung lieber weg.
 */
function derselbeWortlaut(a: string, b: string): boolean {
	const bereinigt = (t: string) => t.replace(/\s+/g, ' ').trim();
	return bereinigt(a) === bereinigt(b);
}

export interface Empfehlungsstand {
	wahl: Empfehlungswahl;
	/** Ob sie sich noch auf den Antrag bezieht, der gerade zur Abstimmung steht. */
	gilt: boolean;
	/** Ein Satz für das Telefon der bevollmächtigten Person. */
	satz: string;
}

/**
 * Wie die Empfehlung dasteht, wenn abgestimmt wird.
 *
 * **Der Antrag kann sich geändert haben** — durch einen Folgeantrag, ein
 * Rückkommen oder eine Präzisierung während der Sitzung. Dann bezog sich die
 * Weisung auf etwas anderes. Sie fällt hier **sichtbar** weg statt still
 * weiterzugelten: Wer nach einer überholten Weisung abstimmt, stimmt gegen den
 * Willen, den er zu vertreten meint.
 */
export function empfehlungsstand(
	wahl: Empfehlungswahl,
	wortlautDamals: string,
	wortlautJetzt: string,
	vertretene: string
): Empfehlungsstand {
	if (derselbeWortlaut(wortlautDamals, wortlautJetzt)) {
		return {
			wahl,
			gilt: true,
			satz: `${vertretene} empfiehlt: ${empfehlungInWorten(wahl)}`
		};
	}
	return {
		wahl,
		gilt: false,
		satz:
			`Die Weisung von ${vertretene} (${empfehlungInWorten(wahl)}) bezog sich auf einen anderen ` +
			'Wortlaut des Antrags. Sie gilt nicht mehr — entscheiden Sie selbst.'
	};
}

/**
 * Was die vertretene Person beim Erteilen sieht, je Traktandum.
 *
 * Nur Anträge, über die abgestimmt wird: Eine Kenntnisnahme kennt kein Ja und
 * kein Nein, und eine Weisung dazu wäre eine Angabe ohne Aussage.
 */
export interface Weisungsposten {
	traktandumId: string;
	nummer: string;
	titel: string;
	wortlaut: string;
	wahl: Empfehlungswahl | null;
}

export function offeneWeisungen(posten: Weisungsposten[]): number {
	return posten.filter((p) => p.wahl === null).length;
}

/**
 * Der Satz unter der Liste — wie viele Weisungen erteilt sind.
 *
 * **Keine Pflicht, alle auszufüllen.** Wer zu drei von acht Traktanden etwas zu
 * sagen hat, sagt es zu dreien; für den Rest vertraut er der Person, die er
 * gewählt hat. Ein Zwang zur Vollständigkeit wäre der sichere Weg zu Weisungen,
 * die niemand gemeint hat.
 */
export function weisungsstand(posten: Weisungsposten[]): string {
	const erteilt = posten.length - offeneWeisungen(posten);
	if (posten.length === 0) return 'Für diese Versammlung steht kein Antrag zur Abstimmung.';
	if (erteilt === 0) {
		return 'Noch keine Weisung erteilt. Ihre bevollmächtigte Person entscheidet dann frei.';
	}
	return (
		`${erteilt} von ${posten.length} ${posten.length === 1 ? 'Antrag' : 'Anträgen'} mit Weisung. ` +
		'Wo keine steht, entscheidet Ihre bevollmächtigte Person frei.'
	);
}
