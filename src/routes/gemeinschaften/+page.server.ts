import { error, fail } from '@sveltejs/kit';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import { archiviereMehrere } from '$lib/server/archivieren';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	/*
	 * **Auch die archivierten** — und die Seite filtert selbst (Migration 086).
	 *
	 * Der Schalter «Archivierte anzeigen» wirkt damit sofort, ohne Seitenwechsel,
	 * und der Hinweis an der Leerstelle («im Archiv liegen 2 Treffer») lässt sich
	 * exakt rechnen statt schätzen. Der Preis sind ein paar Zeilen mehr über die
	 * Leitung — eigene Daten, die ohnehin auf dieser Seite stehen dürfen.
	 */
	return { gemeinschaften: await listeGemeinschaften(locals.benutzer.operatorId, 'alle') };
};

export const actions: Actions = {
	/**
	 * Mehrere Gemeinschaften auf einmal ins Archiv (Auftraggeber, 15.09.2026).
	 *
	 * **Die Kennungen kommen als wiederholtes Feld** `id`, nicht als eine Zeile
	 * mit Trennzeichen. `getAll` liest sie in der Reihenfolge, in der sie im
	 * Formular stehen, und ein Name mit Komma kann nichts zerreissen.
	 *
	 * **Was hier NICHT geprüft wird: ob die Gemeinschaft dem Betreiber gehört.**
	 * Das erledigt der Zeilenschutz in der Datenbank: `archiviereMehrere` läuft
	 * über `alsBetreiber`, und eine fremde Kennung findet dort schlicht keine
	 * Zeile — die Absage lautet dann «Gemeinschaft nicht gefunden», wie beim
	 * Einzelweg auch. Eine zweite Prüfung hier wäre eine zweite Wahrheit.
	 */
	sammelArchivieren: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const ids = daten.getAll('id').map(String).filter(Boolean);
		const notiz = String(daten.get('notiz') ?? '').trim() || null;

		if (ids.length === 0) {
			/*
			 * Erreichbar nur ohne JavaScript oder bei einem zusammengebauten
			 * Formular — die Leiste erscheint erst ab einer Auswahl. Trotzdem eine
			 * Antwort und kein stiller Erfolg: Eine Meldung «0 archiviert» liest
			 * sich wie ein Fehlschlag, den niemand einordnen kann.
			 */
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
				'gemeinschaft',
				ids,
				notiz
			);
			/*
			 * **Auch ein Teilerfolg ist ein Erfolg** — er kommt als `200` zurück und
			 * nicht als `fail`. Was nicht ging, steht daneben; die Seite entscheidet,
			 * wie sie beides zeigt. Ein `fail` färbte den ganzen Vorgang rot, obwohl
			 * siebzehn von zwanzig im Archiv liegen.
			 */
			return { quelle: 'sammel', ergebnis };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Die eine Absage, die den ganzen Auftrag trifft: zu viele auf einmal.
				return fail(400, {
					quelle: 'sammel',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	}
};
