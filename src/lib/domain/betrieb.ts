/**
 * Der Betriebszustand (Story 6.3, FR-68, AD-18).
 *
 * **Warum das nicht an einem Schalter hängt.** Ein Schalter sagt, was jemand
 * gemeint hat, als er ihn setzte — nicht, was gerade gilt. Wer im Saal steht und
 * das Netzkabel nicht eingesteckt hat, hat den Schalter nicht umgelegt; wer
 * zuhause vorbereitet, hat ihn vielleicht noch auf «lokal» stehen. In beiden
 * Fällen zeigte die Oberfläche etwas an, das nicht stimmt, und die Sitzungs-
 * leitung erführe vom fehlenden Dienst erst in dem Augenblick, in dem sie ihn
 * braucht. Deshalb wird gefragt statt gelesen.
 *
 * **Warum drei Zustände und nicht zwei.** «Offline» wirft zwei verschiedene
 * Sachverhalte zusammen: Eine Anlage ohne eingerichtete äussere Dienste läuft
 * bestimmungsgemäss, ihr fehlt nichts. Eine Anlage mit eingerichtetem, aber
 * gerade unerreichbarem Dienst ist gestört — dieselbe Anzeige für beide hiesse,
 * dass eine echte Störung nicht auffällt.
 *
 * Rein: hinein geht eine Liste geprüfter Dienste, heraus kommt eine Bewertung.
 * Das Prüfen selbst — Netzaufrufe, Zeitlimits, Zwischenspeicher — gehört in die
 * Schale (AD-1).
 */

/**
 * Ein äusserer Dienst, ohne den die Anwendung weiterläuft.
 *
 * Die Datenbank steht bewusst **nicht** in dieser Liste: Ohne sie läuft nichts
 * weiter, das ist kein Betriebszustand, sondern ein Ausfall. Sie wird getrennt
 * geführt.
 */
export interface Dienst {
	kennung: string;
	name: string;
	/** Ob überhaupt Zugangsdaten hinterlegt sind. Nicht eingerichtet ist keine Störung. */
	eingerichtet: boolean;
	/** Nur bedeutsam, wenn eingerichtet. */
	erreichbar: boolean;
	/** Was ohne ihn nicht geht — der Satz, den die Sitzungsleitung lesen soll. */
	ohneIhn: string;
}

export type Betriebsart =
	/** Kein äusserer Dienst eingerichtet: bestimmungsgemässer Alleinbetrieb. */
	| 'eigenstaendig'
	/** Alle eingerichteten Dienste antworten. */
	| 'verbunden'
	/** Mindestens ein eingerichteter Dienst antwortet nicht. */
	| 'getrennt';

export interface Betriebszustand {
	art: Betriebsart;
	/** Die eingerichteten, aber gerade nicht erreichbaren Dienste. */
	fehlend: Dienst[];
	/**
	 * Hinweise, die keine Störung sind, aber jemanden angehen (13.11.2026).
	 *
	 * Der erste ist der Ersatzdienst beim Zeitstempel: Springt er ein, ist das
	 * Siegel bezeugt, aber der Hauptdienst liefert nicht mehr wie erwartet.
	 * Eine Störung ist das nicht; ein stiller Zustand wäre es auch nicht.
	 */
	warnungen: string[];
	/** Ein Satz für die Kopfzeile — kurz genug, um immer dazustehen. */
	kurz: string;
	/** Der ausführliche Satz fürs Dashboard. */
	satz: string;
}

/**
 * Bewertet die geprüften Dienste.
 *
 * `warnungen` kommen von aussen, weil sie nicht aus der Erreichbarkeit
 * stammen, sondern aus dem Bestand (etwa einem Siegel, das der Ersatzdienst
 * bezeugt hat). Der Kern reiht sie ein, die Schale ermittelt sie (AD-1).
 */
export function bewerteBetrieb(dienste: Dienst[], warnungen: string[] = []): Betriebszustand {
	const eingerichtet = dienste.filter((d) => d.eingerichtet);
	const fehlend = eingerichtet.filter((d) => !d.erreichbar);

	if (eingerichtet.length === 0) {
		return {
			art: 'eigenstaendig',
			fehlend: [],
			warnungen,
			kurz: 'eigenständig',
			satz:
				'Es ist kein äusserer Dienst eingerichtet. Die Anwendung läuft für sich allein — ' +
				'alle Funktionen stehen zur Verfügung.'
		};
	}

	if (fehlend.length === 0) {
		return {
			art: 'verbunden',
			fehlend: [],
			warnungen,
			kurz: 'verbunden',
			satz: `Alle eingerichteten äusseren Dienste antworten (${eingerichtet
				.map((d) => d.name)
				.join(', ')}).`
		};
	}

	// Die Aufzählung nennt, was ohne den Dienst nicht geht — nicht bloss, dass er
	// fehlt. «Authentik nicht erreichbar» beantwortet die Frage nicht, die im Saal
	// gestellt wird: ob man trotzdem weiterarbeiten kann.
	return {
		art: 'getrennt',
		fehlend,
		warnungen,
		kurz: fehlend.length === 1 ? `${fehlend[0].name} fehlt` : `${fehlend.length} Dienste fehlen`,
		satz:
			`Nicht erreichbar: ${fehlend.map((d) => d.name).join(', ')}. ` +
			fehlend.map((d) => d.ohneIhn).join(' ') +
			' Eine Versammlung lässt sich dennoch vollständig führen.'
	};
}

/**
 * Ob der Zustand die Aufmerksamkeit der Sitzungsleitung verlangt.
 *
 * Nur die Störung. Der Alleinbetrieb ist keine — ihn hervorzuheben, hiesse die
 * Anzeige abzunutzen: Wer sie jedes Mal sieht, sieht sie irgendwann nicht mehr.
 */
export function istAuffaellig(z: Betriebszustand): boolean {
	return z.art === 'getrennt';
}
