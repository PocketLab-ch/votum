/**
 * Die Gerätesitzung — eine je Zugang, an ein Gerät gebunden.
 *
 * **Die Regel.** Zu einem Zugang ist höchstens **ein** Gerät angemeldet. Ein
 * zweiter Versuch mit dem Kartencode wird abgewiesen und verdrängt das erste
 * Gerät nicht. Beendet wird eine Sitzung nur auf zwei Wegen: Die Person meldet
 * sich selbst ab, oder die Sitzungsleitung gibt den Zugang frei.
 *
 * **Warum nicht «das letzte Gerät gewinnt».** Der Code steht als Klartext auf
 * der Karte; wer sie abfotografiert, hat ihn. Gegen einen entwendeten Code
 * schützt keine Sitzungsregel — wohl aber gegen das **stille** Übernehmen.
 * Verdrängte das zweite Gerät das erste, flöge der Eigentümer wortlos aus
 * seiner Sitzung und merkte es erst, wenn seine Stimme nicht mehr zählt. Wird
 * der zweite Versuch dagegen abgewiesen, scheitert er sichtbar: Der Angreifer
 * bekommt nichts, und wer zu Recht nicht hereinkommt, wendet sich an die
 * Sitzungsleitung — die im Saal steht und es klären kann.
 *
 * Die beiden Fehlerfälle sind ungleich schwer, und danach ist entschieden:
 * «Erstes Gerät gewinnt» kostet im schlimmsten Fall eine Handbewegung der
 * Sitzungsleitung. «Letztes Gerät gewinnt» kostet im schlimmsten Fall eine
 * Stimme, und niemand bemerkt es.
 *
 * **Die eine Ausnahme** ist der von der Sitzungsleitung ausgegebene Code. Ihn
 * hat ein Mensch einer Person gegeben, die vor ihm stand — dieselbe
 * Vertrauensstufe wie das Erfassen der Anwesenheit von Hand. Er darf deshalb
 * ein angemeldetes Gerät ablösen, und das abgelöste erfährt es beim nächsten
 * Aufruf.
 */

/** Warum eine Gerätesitzung endete. Steht im Verlauf und erklärt sich der Person. */
export type Sitzungsende =
	/** Zwölf Stunden um. */
	| 'abgelaufen'
	/** Die Person hat sich selbst abgemeldet. */
	| 'abgemeldet'
	/** Die Sitzungsleitung hat den Zugang freigegeben. */
	| 'freigegeben'
	/** Ein ausgegebener Code hat das Gerät abgelöst. */
	| 'ersetzt'
	/**
	 * Dieselbe Person hat sich mit ihrem Konto auf einem anderen Gerät
	 * angemeldet (Migration 071).
	 *
	 * Eigener Grund und nicht `ersetzt`: Dort war es ein Code der
	 * Sitzungsleitung, hier war es das eigene Konto. Wer den Satz liest, soll
	 * wissen, ob er selbst gerade woanders steht oder ob jemand anderes
	 * hereingekommen ist — das ist der Unterschied zwischen einer
	 * Selbstverständlichkeit und einem Alarm.
	 */
	| 'uebernommen'
	/** Die Versammlung wurde geschlossen. */
	| 'geschlossen';

export const SITZUNGSENDEN: readonly Sitzungsende[] = [
	'abgelaufen',
	'abgemeldet',
	'freigegeben',
	'ersetzt',
	'uebernommen',
	'geschlossen'
];

/**
 * Was die Person auf dem verdrängten Gerät liest.
 *
 * Jeder Satz sagt zugleich, was jetzt zu tun ist. Ein blosses «nicht mehr
 * gültig» liesse jemanden im Saal stehen, der nicht weiss, ob er das Problem
 * selbst lösen kann.
 */
export function endegrund(ende: Sitzungsende): string {
	switch (ende) {
		case 'abgelaufen':
			return 'Die Anmeldung auf diesem Gerät ist abgelaufen. Tippen Sie den Code erneut ein.';
		case 'abgemeldet':
			return 'Sie haben sich von diesem Gerät abgemeldet. Der Zugang ist wieder frei.';
		case 'freigegeben':
			return (
				'Die Sitzungsleitung hat diesen Zugang freigegeben. Sie können sich mit dem Code ' +
				'Ihrer Karte neu anmelden.'
			);
		case 'ersetzt':
			return (
				'Ein von der Sitzungsleitung ausgegebener Code hat diesen Zugang übernommen. ' +
				'War das nicht Ihre Anmeldung, melden Sie sich sofort bei der Sitzungsleitung.'
			);
		case 'uebernommen':
			return (
				'Ihr Zugang ist auf ein anderes Gerät gewandert: Dort hat sich jemand mit Ihrem ' +
				'Konto angemeldet. Waren Sie das nicht, melden Sie sich sofort bei der ' +
				'Sitzungsleitung — sonst melden Sie sich hier einfach neu an.'
			);
		case 'geschlossen':
			return 'Die Versammlung ist geschlossen.';
	}
}

/** Wie ein Einlöseversuch ausging. */
export type Sitzungsausgang =
	/** Sitzung angelegt. */
	| 'neu'
	/** Der Code stimmt, aber es ist bereits ein Gerät angemeldet. */
	| 'belegt'
	/** Kein Zugang dazu — unbekannt, abgelaufen, entwertet oder Versammlung zu. */
	| 'unbekannt';

/**
 * Die Meldung, wenn schon ein Gerät angemeldet ist.
 *
 * Sie sagt ausdrücklich, dass der Code **richtig** ist. Das verrät einem
 * Fremden, dass er einen echten Code in der Hand hält — was er ohnehin weiss,
 * denn er hat ihn abgelesen, und bei 97 Bit stösst niemand durch Raten darauf.
 * Der Eigentümer dagegen, dessen Telefon leer war und der es neu versucht,
 * bekäme sonst «Code ungültig» zu lesen und hielte seine Karte für kaputt. Der
 * Nutzen liegt eindeutig auf einer Seite.
 */
export const BELEGT_MELDUNG =
	'Der Code stimmt, aber es ist bereits ein Gerät angemeldet. ' +
	'Melden Sie sich dort ab — oder lassen Sie den Zugang von der Sitzungsleitung freigeben.';

// ── Welches Gerät angemeldet ist ────────────────────────────────────────────
//
// **Was die Bindung wirklich leistet.** Gebunden ist die Sitzung durch ihr
// Merkmal, das nur im Keks dieses Browsers liegt und den der Server nur als
// Prüfwert kennt. Das ist die Bindung; ein Fingerabdruck des Geräts wäre keine
// bessere, sondern nur eine, die sich fälschen lässt.
//
// Die Bezeichnung dient einem anderen Zweck: Sagt jemand im Saal «ich komme
// nicht rein», soll die Sitzungsleitung sehen, **was** angemeldet ist. «Ein
// iPhone, seit 19:12» genügt zur Klärung — «mein Akku war leer» passt dazu,
// «ich war nie angemeldet» nicht.
//
// Gespeichert wird deshalb nur diese grobe Bezeichnung, nie die
// Browserkennung selbst: Die wäre ein Wiedererkennungsmerkmal, und dafür gibt
// es hier keinen Grund.

const PLATTFORMEN: readonly [RegExp, string][] = [
	[/iPhone/, 'iPhone'],
	[/iPad/, 'iPad'],
	[/Android/, 'Android-Gerät'],
	[/Macintosh|Mac OS X/, 'Mac'],
	[/Windows/, 'Windows-Rechner'],
	[/CrOS/, 'Chromebook'],
	[/Linux/, 'Linux-Rechner']
];

// Die Reihenfolge ist der ganze Trick: Edge nennt sich Chrome, Chrome nennt
// sich Safari. Wer der Reihe nach von hinten prüft, findet immer Safari.
const BROWSER: readonly [RegExp, string][] = [
	[/Edg[A-Za-z]*\//, 'Edge'],
	[/OPR\/|Opera/, 'Opera'],
	[/SamsungBrowser/, 'Samsung Internet'],
	[/FxiOS/, 'Firefox'],
	[/CriOS/, 'Chrome'],
	[/Firefox\//, 'Firefox'],
	[/Chrome\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

/** Höchstlänge der Bezeichnung — sie steht in einer Tabellenzelle, nicht in einem Bericht. */
export const BEZEICHNUNG_HOECHSTLAENGE = 40;

/**
 * Eine grobe Bezeichnung des Geräts aus der Browserkennung.
 *
 * Rein: Die Kennung kommt von aussen herein, hier wird nur zugeordnet.
 */
export function geraetebezeichnung(browserkennung: string): string {
	const kennung = browserkennung ?? '';
	const plattform = PLATTFORMEN.find(([muster]) => muster.test(kennung))?.[1];
	const browser = BROWSER.find(([muster]) => muster.test(kennung))?.[1];

	if (!plattform && !browser) return 'Unbekanntes Gerät';
	if (!browser) return plattform as string;
	if (!plattform) return browser;
	return `${plattform} · ${browser}`.slice(0, BEZEICHNUNG_HOECHSTLAENGE);
}
