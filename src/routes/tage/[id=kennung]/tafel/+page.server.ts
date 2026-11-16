import { error } from '@sveltejs/kit';
import { holeTafel } from '$lib/server/versammlungstag';
import type { PageServerLoad } from './$types';

/**
 * Die Tafel: der Stand aller Gemeinschaften im Saal (Story 7.7).
 *
 * Gerechnet wird je Gemeinschaft mit **ihrer** Schwelle: Haus 4 kann
 * beschlussfähig sein und die Einstellhalle nicht. Eine gemeinsame Zahl gäbe es
 * gar nicht — sie wäre der häufigste Fehler, den dieses Werkzeug verhindern soll.
 *
 * **Und sie kann handeln** (Auftraggeber, 23.08.2026): «Der Einlass (Anwesenheit und
 * Beschlussfähigkeit) muss aber über die Gruppe gehen.» Bis dahin konnte die
 * Tafel nur zusehen; wer jemanden als gegangen erfassen oder einen Zugangscode
 * neu ausgeben wollte, musste in das einzelne Haus wechseln — und im Saal weiss
 * niemand auswendig, zu welchem Haus eine Person gehört.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const tafel = await holeTafel(locals.benutzer.operatorId, params.id);

	return { tafel };
};
