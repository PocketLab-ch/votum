import { error, fail, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import { erstellePerson, holePersonen, holeUnverknuepfteParteien } from '$lib/server/personen';
import { archiviereMehrere } from '$lib/server/archivieren';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const [personen, unverknuepft] = await Promise.all([
		// **Auch die archivierten** — die Seite filtert selbst, damit der Schalter
		// ohne Seitenwechsel wirkt und der Archivhinweis exakt zählt.
		holePersonen(locals.benutzer.operatorId, 'alle'),
		/**
		 * Eigentümerzeilen ohne Person (22.08.2026, Befund A-04).
		 *
		 * Über der Liste steht «Hier wird jeder Eigentümer einmal geführt» — und
		 * die Suche fand im Prüflauf 4 von 5. Die fünfte war nur als Partei in
		 * ihrer Gemeinschaft erfasst und nie verknüpft; diese Liste liest aber
		 * ausschliesslich Personen.
		 */
		holeUnverknuepfteParteien(locals.benutzer.operatorId, 'aktiv')
	]);
	return {
		personen,
		unverknuepft,
		// Die Meldung nach dem Löschen reist über die Adresse hierher: Die
		// gelöschte Person hat keine Seite mehr, auf der sie stehen könnte.
		geloescht: url.searchParams.get('geloescht')
	};
};

export const actions: Actions = {
	/*
	 * **`anlegen` statt `default`** (15.09.2026). SvelteKit lässt eine
	 * unbenannte Aktion nicht neben benannten zu — sobald die Seite eine zweite
	 * Handlung bekommt, muss die erste einen Namen tragen. Das Formular unten
	 * zeigt seither ausdrücklich auf `?/anlegen`.
	 */
	anlegen: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		let id: string;
		try {
			const p = await erstellePerson(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				{
					art: text(daten.get('art')) === 'legal' ? 'legal' : 'natural',
					name: text(daten.get('name')),
					email: text(daten.get('email')) || null,
					telefon: text(daten.get('telefon')) || null,
					adresse: text(daten.get('adresse')) || null
				}
			);
			id = p.id;
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: Object.fromEntries(daten)
				});
			}
			throw fehler;
		}
		redirect(303, `/personen/${id}`);
	},

	/**
	 * Mehrere Personen auf einmal ins Archiv (Auftraggeber, 15.09.2026).
	 *
	 * Derselbe Weg wie bei den Gemeinschaften; was sich unterscheidet, steht in
	 * `archiviereMehrere`: Bei Personen gibt es keinen Baum, also keine Klammer,
	 * die jemanden mitnimmt, und keine Reihenfolge, die etwas rettet.
	 *
	 * Die Rolle prüft der Wächter in `hooks.server.ts`: `/personen` ist ein
	 * Verwaltungsbereich, ein POST darauf verlangt `admin`.
	 */
	sammelArchivieren: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const ids = daten.getAll('id').map(String).filter(Boolean);
		const notiz = String(daten.get('notiz') ?? '').trim() || null;

		if (ids.length === 0) {
			return fail(400, {
				quelle: 'sammel',
				fehler: { nachricht: 'Nichts ausgewählt.', feld: 'auswahl' }
			});
		}

		try {
			const ergebnis = await archiviereMehrere(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				'person',
				ids,
				notiz
			);
			return { quelle: 'sammel', ergebnis };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'sammel',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	}
};
