import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Die Ausfallsicherung des ganzen Abends.
 *
 * **Der Anlass** (Auftraggeber, Praxisdurchlauf 28.08.2026): «Die Liste muss je
 * Gemeinschaft sein, bei einer Sammelveranstaltung also eine pro Gemeinschaft.»
 * Nachgemessen am 02.09.2026 stimmte beides — und keines half: Jede Versammlung
 * hat ihre eigene Liste, denn sie hängt an ihrer eigenen Momentaufnahme. Nur
 * führte vom Abend aus **kein Weg** dorthin. Der gemeinsame Ablauf kannte die
 * Ausfallsicherung gar nicht; wer den Papierstapel für fünf Gemeinschaften
 * brauchte, musste fünfmal in die Einzelversammlung wechseln und dort danach
 * suchen.
 *
 * Diese Seite holt und erzeugt nichts. Sie führt die Wege zusammen, die es je
 * Gemeinschaft schon gibt — wie die Ausfallseite im Haus, nur eine Ebene höher.
 *
 * **Und sie fragt nichts zweites Mal** (aus dem Code-Review). Der erste Anlauf
 * erhob Zustand und Rechenbedarf je Haus neu; beides hatte das Layout im selben
 * Aufruf schon geholt und verworfen. Es steht jetzt am `Abendhaus`.
 */
export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const { haeuser } = await parent();

	return {
		haeuser: haeuser.map((h) => {
			const schritt = h.schritte.find((s) => s.kennung === 'ausfall');
			return {
				versammlungId: h.versammlungId,
				name: h.name,
				freigegeben: h.zustand !== 'entwurf',
				erledigt: schritt?.zustand === 'erledigt',
				stand: schritt?.stand ?? null,
				mappeNoetig: h.mappeNoetig
			};
		})
	};
};
