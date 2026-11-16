import { error, fail, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeUebernahmeangebote, uebernimmTraktanden } from '$lib/server/vorlagen';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const angebote = await holeUebernahmeangebote(locals.benutzer.operatorId, params.id);

	return {
		versammlung,
		angebote,
		aenderbar: versammlung.zustand === 'entwurf'
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const gewaehlt = daten.getAll('traktandum').map(String).filter(Boolean);

		if (gewaehlt.length === 0) {
			return fail(400, { fehler: { nachricht: 'Es wurde kein Traktandum gewählt.' } });
		}

		try {
			await uebernimmTraktanden(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				gewaehlt
			);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}

		redirect(303, `/versammlungen/${params.id}/traktanden`);
	}
};
