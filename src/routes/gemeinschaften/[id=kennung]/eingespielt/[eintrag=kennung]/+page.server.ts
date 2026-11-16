import { error } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeBeschluesse } from '$lib/server/einspielen';
import type { PageServerLoad } from './$types';

/**
 * Eine aufgenommene Versammlung ansehen.
 *
 * **Alles kommt aus dem Paket**, nichts aus einer Kopie: Beschlüsse, Auswertung
 * und Angaben werden bei jedem Aufruf aus dem gesiegelten ZIP gelesen. Damit
 * kann das, was hier steht, sich vom Nachweis nicht entfernen.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const gelesen = await holeBeschluesse(locals.benutzer.operatorId, params.eintrag);
	if (!gelesen || gelesen.eintrag.stwegId !== params.id) {
		error(404, 'Diese aufgenommene Versammlung gibt es hier nicht');
	}

	return { gemeinschaft, eintrag: gelesen.eintrag, beschluesse: gelesen.beschluesse };
};
