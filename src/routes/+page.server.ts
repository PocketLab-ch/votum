import { holeBetriebszustand, holeDatenbanklage } from '$lib/server/betriebszustand';
import { holeUebersicht } from '$lib/server/uebersicht';
import { holeCodeversuche } from '$lib/server/codeversuche';
import { holeZuletztBearbeitet } from '$lib/server/zuletzt';
import { darfStammdatenAendern } from '$lib/domain/rollen';
import type { PageServerLoad } from './$types';

/**
 * Die Übersicht (Story 6.1, FR-64) mit dem Betriebszustand (Story 6.3, FR-68).
 *
 * Ohne Anmeldung bleibt die Seite erreichbar und zeigt nur den Betriebszustand:
 * Wer im Saal steht und sich nicht anmelden kann, soll gleich hier sehen, ob es
 * an einem fehlenden Dienst liegt.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const [db, betrieb] = await Promise.all([holeDatenbanklage(), holeBetriebszustand(locals.benutzer?.operatorId)]);

	if (!locals.benutzer) return { db, betrieb, uebersicht: null, codeversuche: null, zuletzt: [] };

	// Das Datum kommt aus der Schale, nicht aus dem Kern — der liest keine Uhr.
	// Schweizer Zeitzone, weil sich «heute» nach dem Saal richtet und nicht nach
	// der Zeitzone des Servers.
	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

	/*
	 * **Die Zahl zählt über die ganze Anlage, nicht über ein Haus** (Audit B-05,
	 * eingeschränkt bei der Abnahme). Ein Code, der nicht greift, gehört zu
	 * keinem Betreiber — die Zeile kann gar keinen tragen. Damit ist sie zwar
	 * inhaltlich harmlos (eine Summe, kein Code, keine Person, kein Haus), aber
	 * sie wäre für eine Sitzungsleitung ein Alarm, der einem **fremden**
	 * Betreiber gilt und gegen den sie nichts tun kann.
	 *
	 * Deshalb nur für die Verwaltung: Sie betreibt die Anlage und ist die
	 * Einzige, die daraufhin handeln kann.
	 */
	const zeigeVersuche = darfStammdatenAendern(locals.benutzer.role);

	const [uebersicht, codeversuche, zuletzt] = await Promise.all([
		holeUebersicht(locals.benutzer.operatorId, heute),
		zeigeVersuche ? holeCodeversuche() : Promise.resolve(null),
		/*
		 * **Wo war ich?** (Auftraggeber, 25.08.2026: «Dann einen Bereich zuletzt
		 * Bearbeitet, wo man direkt rein und weiterbearbeiten kann.»)
		 *
		 * Die eigene Arbeit, nicht die des Hauses: Gefiltert wird auf den
		 * angemeldeten Benutzer. Wer sehen will, was andere getan haben, geht in
		 * den Verlauf — dort steht es vollständig und mit Handelndem.
		 */
		holeZuletztBearbeitet(locals.benutzer.operatorId, locals.benutzer.id)
	]);

	return { db, betrieb, uebersicht, codeversuche, zuletzt };
};
