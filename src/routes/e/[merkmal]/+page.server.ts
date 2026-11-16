import { fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { loeseSaaleinstiegAuf, meldeUeberSaal } from '$lib/server/saaleinstieg';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import { text } from '$lib/server/formular';
import type { Actions, PageServerLoad } from './$types';

/**
 * Der Einstieg über den QR-Code auf der Leinwand (Story 4.4).
 *
 * Offen erreichbar und bewusst arm an Inhalt: Es erscheint nur, was ohnehin auf
 * der Leinwand steht — Gemeinschaft, Datum, Ort. Keine Eigentümerliste, kein
 * Traktandum, keine Zahl. Wer hier landet, ohne im Saal zu sein, erfährt nichts,
 * was er nicht auch von aussen sehen könnte.
 */
export const load: PageServerLoad = async ({ params }) => {
	const befund = await loeseSaaleinstiegAuf(params.merkmal);
	return {
		gueltig: befund.gueltig,
		grund: befund.grund ?? null,
		gemeinschaftName: befund.gemeinschaftName ?? '',
		datum: befund.datum ?? '',
		uhrzeit: befund.uhrzeit ?? '',
		ort: befund.ort ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const daten = await request.formData();
		try {
			const e = await meldeUeberSaal(
				params.merkmal,
				text(daten.get('name')),
				text(daten.get('bemerkung')) || undefined
			);
			if (!e.gemeldet) {
				return fail(400, {
					fehler: { nachricht: 'Die Versammlung nimmt gerade keine Meldungen entgegen.' }
				});
			}
			// Damit die Sitzungsleitung die Meldung sieht, ohne die Seite neu zu
			// laden. Der Strom trägt nur die Zahl, nie den Namen (AD-11).
			if (e.operatorId && e.meetingId) await verkuendeStand(e.operatorId, e.meetingId);
			return { gemeldet: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
