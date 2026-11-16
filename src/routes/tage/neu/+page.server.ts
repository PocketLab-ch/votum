import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Angelegt wird der Abend jetzt unter `/versammlungen/neu`.
 *
 * Dort steht die Frage, die vorher niemand gestellt bekam: eine Gemeinschaft
 * oder mehrere? Diesen Weg als zweite Möglichkeit stehen zu lassen hiesse, das
 * Anlegen an zwei Stellen zu pflegen — und die zweite wird beim nächsten Mal
 * vergessen.
 */
export const load: PageServerLoad = async () => {
	redirect(302, '/versammlungen/neu');
};
