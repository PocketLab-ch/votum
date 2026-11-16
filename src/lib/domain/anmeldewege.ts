/**
 * Welche Anmeldewege gerade offenstehen (Story 4.1, FR-26, AD-9, AD-1).
 *
 * **Die Regel dahinter.** Kein äusserer Dienst darf eine Versammlung aufhalten.
 * Authentik ist der bequeme Weg, nie die Voraussetzung: Ist es nicht
 * erreichbar — im Versammlungsraum ohne Netz der Normalfall —, steht die lokale
 * Anmeldung bereit, und die Nutzung dieser Rückfallebene erscheint im Verlauf.
 *
 * Reine Rechnung: Ob geprüft werden konnte und was dabei herauskam, kommt von
 * aussen herein. Damit lässt sich das Verhalten mit einer Wertetabelle belegen,
 * ohne je einen Dienst anzusprechen.
 */

/** Was die Erreichbarkeitsprüfung ergeben hat. */
export type Erreichbarkeit = 'erreichbar' | 'nicht_erreichbar' | 'nicht_eingerichtet';

export interface Anmeldelage {
	/** Ist Authentik überhaupt konfiguriert? */
	eingerichtet: boolean;
	erreichbarkeit: Erreichbarkeit;
}

export interface Anmeldewege {
	/** Der Knopf «Mit Authentik anmelden» erscheint. */
	authentik: boolean;
	/** Das Formular mit Benutzername und Kennwort erscheint. */
	lokal: boolean;
	/**
	 * Ob die lokale Anmeldung gerade die Rückfallebene ist.
	 *
	 * Der Unterschied zählt: Wo Authentik gar nicht eingerichtet ist, ist die
	 * lokale Anmeldung der vorgesehene Weg und kein Ausweichen. Nur wo Authentik
	 * eingerichtet, aber nicht erreichbar ist, wird ausgewichen — und das gehört
	 * in den Verlauf.
	 */
	rueckfall: boolean;
	/** Was der Anmeldeseite dazu zu sagen ist. Leer heisst: nichts Besonderes. */
	hinweis: string | null;
}

export function anmeldewege(lage: Anmeldelage): Anmeldewege {
	// Die lokale Anmeldung steht **immer** offen. Sie abzuschalten, sobald
	// Authentik erreichbar ist, hiesse: Fällt der Dienst mitten in der
	// Versammlung aus, kommt niemand mehr herein — und genau das verhindert AD-9.
	if (!lage.eingerichtet) {
		return { authentik: false, lokal: true, rueckfall: false, hinweis: null };
	}

	if (lage.erreichbarkeit === 'erreichbar') {
		return {
			authentik: true,
			lokal: true,
			rueckfall: false,
			hinweis: null
		};
	}

	return {
		authentik: false,
		lokal: true,
		rueckfall: true,
		hinweis:
			'Die zentrale Anmeldung ist gerade nicht erreichbar — im Versammlungsraum ohne Netz ist ' +
			'das der Normalfall. Melden Sie sich mit den lokalen Zugangsdaten an; die Nutzung dieses ' +
			'Weges wird im Verlauf festgehalten.'
	};
}

/**
 * Zeitlimit der Erreichbarkeitsprüfung.
 *
 * Zwei Sekunden. Länger zu warten hiesse, dass die Anmeldeseite im
 * Versammlungsraum jedes Mal hängt, bevor sie den Rückfall anbietet — und wer
 * vor einem Saal voller Leute steht, wartet nicht.
 */
export const ERREICHBARKEIT_ZEITLIMIT_MS = 2000;

/**
 * Prüft die Gestalt des Zustandsmerkmals aus dem OIDC-Fluss.
 *
 * Es schützt davor, dass eine fremde Seite die Anmeldung anstösst und die
 * Antwort in einer bestehenden Sitzung landet. Ohne diese Prüfung wäre der
 * Rückweg von Authentik eine offene Tür.
 */
export function merkmalStimmt(erwartet: string | undefined, erhalten: string | null): boolean {
	if (!erwartet || !erhalten) return false;
	// zeichenzahl-frei: gehört zum zeichenweisen Vergleich mit charCodeAt — der zählt ebenfalls Einheiten.
	if (erwartet.length !== erhalten.length) return false;
	// Zeichenweiser Vergleich ohne frühen Abbruch. Ein Vergleich mit `===` wäre
	// hier vermutlich unkritisch, aber die Gewohnheit ist die richtige.
	let gleich = 0;
	for (let i = 0; i < erwartet.length; i++) {
		gleich |= erwartet.charCodeAt(i) ^ erhalten.charCodeAt(i);
	}
	return gleich === 0;
}

/**
 * Baut das Ziel nach der Anmeldung.
 *
 * Nur Pfade innerhalb der Anwendung. Ein vollständiger Verweis von aussen
 * machte die Anmeldeseite zur Weiterleitung auf beliebige Ziele — der klassische
 * Weg, jemanden nach dem Anmelden auf eine nachgemachte Seite zu schicken.
 *
 * **Entschieden wird nach dem URL-Standard, nicht nach dem ersten Zeichen**
 * (Befund A1, 09.10.2026). Die frühere Prüfung `startsWith('/')` ohne `//` liess
 * `/\boese.example` durch: Der Browser behandelt den Backslash bei http(s) wie
 * den Schrägstrich und löst das Ziel auf eine fremde Autorität auf. Ebenso
 * streicht er Tabulator und Zeilenvorschub vor dem Auflösen. Deshalb wird das
 * Ziel hier genauso aufgelöst, wie der Browser es täte, und nur angenommen,
 * wenn es bei der eigenen Herkunft bleibt. Zurück geht die aufgelöste Form,
 * nicht die Eingabe; was der Browser danach sieht, ist das, was geprüft wurde.
 *
 * Die zweite Prüfung auf `//` gilt der aufgelösten Form: Punktsegmente wie in
 * `/.//boese.example` fallen beim Auflösen weg, und übrig bliebe ein
 * protokollrelativer Pfad.
 */
export function sicheresZiel(weiter: string | null | undefined): string {
	if (!weiter || !weiter.startsWith('/')) return '/';
	const basis = 'http://ziel.invalid';
	let ziel: URL;
	try {
		ziel = new URL(weiter, basis);
	} catch {
		return '/';
	}
	if (ziel.origin !== basis) return '/';
	const pfad = ziel.pathname + ziel.search + ziel.hash;
	return pfad.startsWith('//') ? '/' : pfad;
}
