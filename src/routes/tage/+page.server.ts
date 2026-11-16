import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Die eigene Tagesübersicht gibt es nicht mehr.
 *
 * Sie stand neben der Versammlungsliste und beantwortete dieselbe Frage — mit
 * dem Ergebnis, dass man an zwei Stellen nachsehen musste, ob heute etwas
 * läuft. Die Abende stehen jetzt in `/versammlungen` als eigene Zeile mit ihren
 * Versammlungen darunter. Der Verweis bleibt bestehen, damit alte Lesezeichen
 * und Verläufe nicht ins Leere zeigen.
 */
export const load: PageServerLoad = async () => {
	redirect(302, '/versammlungen');
};
