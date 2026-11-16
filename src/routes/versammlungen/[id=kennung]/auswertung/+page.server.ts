import { error } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeAuswertung } from '$lib/server/auswertung';
import type { PageServerLoad } from './$types';

/**
 * Die Gesamtauswertung (Story 5.13, FR-42).
 *
 * Sie zeigt **alle** Traktanden, auch die Kenntnisnahmen. Nur die Beschlüsse zu
 * zeigen machte aus der Auswertung eine Beschlussliste, und im Protokoll fehlte
 * der halbe Abend.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const auswertung = await holeAuswertung(locals.benutzer.operatorId, params.id);
	if (!auswertung) error(404, 'Versammlung nicht gefunden');

	const gemeinschaft = await holeGemeinschaft(
		locals.benutzer.operatorId,
		auswertung.versammlung.stwegId
	);

	return { ...auswertung, gemeinschaft };
};
