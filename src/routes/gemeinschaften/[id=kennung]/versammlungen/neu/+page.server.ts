import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Der alte zweite Schritt beim Anlegen — jetzt nur noch eine Weiche.
 *
 * Bis zum 11.08.2026 trug diese Seite ein **zweites** Anlegeformular, mit
 * anderen Feldern und einer anderen Schrittanzeige als der Weg über
 * «Versammlungen → Neue Versammlung». Wer eine einzelne Versammlung anlegte,
 * sah drei Schritte; wer mehrere zusammen anlegte, zwei. Gemeldet: «Hier
 * bräuchte es eine Konsistenz.»
 *
 * Zwei Formulare für dieselbe Sache laufen auseinander — eines lief bereits
 * hinterher. Der Weg bleibt bestehen, weil er von der Gemeinschaftsseite, aus
 * der Leiste und aus vier Prüfskripten aufgerufen wird; er führt jetzt auf das
 * eine Formular, mit der Gemeinschaft schon gewählt.
 */
export const load: PageServerLoad = async ({ params }) => {
	redirect(302, `/versammlungen/neu?fuer=${params.id}`);
};
