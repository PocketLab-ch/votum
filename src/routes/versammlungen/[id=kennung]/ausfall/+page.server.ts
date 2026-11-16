import { error } from '@sveltejs/kit';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { brauchtAuszaehlmappe } from '$lib/server/ausfallsicherung';
import type { PageServerLoad } from './$types';

/**
 * Die Ausfallsicherung als eigener Schritt.
 *
 * Sie holt nichts und erzeugt nichts — sie führt die Unterlagen zusammen
 * und sagt, wozu jede gut ist. Der Vermerk «geholt» entsteht in den Routen der
 * Dateien selbst, denn dort ist er wahr.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);

	return {
		versammlung,
		gemeinschaftName: gemeinschaft?.name ?? '',
		freigegeben: versammlung.zustand !== 'entwurf',
		/*
		 * **Gibt es hier überhaupt eine Auszählmappe?** (Prüflauf II, C-02) Bei
		 * einfachem Mehr der Anwesenden und gleichen Kopfstimmen genügt
		 * Handzählen; der Downloadweg weist dann mit einer fachlichen Absage ab.
		 * Bis heute stand der Knopf trotzdem da, und wer ihn drückte, landete auf
		 * einer JSON-Fehlerseite.
		 */
		mappeNoetig: await brauchtAuszaehlmappe(locals.benutzer.operatorId, params.id)
	};
};
