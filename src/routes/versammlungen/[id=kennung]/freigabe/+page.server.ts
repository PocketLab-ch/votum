import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import {
	erhebeFreigabelage,
	gibVersammlungFrei,
	holeMomentaufnahme,
	nimmVersammlungsfreigabeZurueck
} from '$lib/server/freigabe';
import { zaehleVollmachten } from '$lib/server/vollmacht';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const { versammlung, befund } = await erhebeFreigabelage(locals.benutzer.operatorId, params.id);
	const [gemeinschaft, momentaufnahme] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeMomentaufnahme(locals.benutzer.operatorId, params.id)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	// Die Kennzahlen der Momentaufnahme entstehen aus derselben Funktion, mit der
	// später gezählt wird. Eine eigene Rechnung hier könnte davon abweichen — und
	// dann stünde auf der Freigabeseite eine andere Zahl als im Saal.
	const liste = momentaufnahme ? stimmkraftliste(momentaufnahme) : null;

	/*
	 * **Hängt schon eine Vollmacht?** (Nachzug Block 3, Entscheid E vom
	 * 03.10.2026). Dann ist die Freigabe endgültig, und die Seite zeigt statt
	 * Knopf und Formular den Grund. Gezählt wird nur in der Lage, in der die
	 * Rücknahme überhaupt zur Debatte steht; die Zahl kommt aus derselben
	 * Funktion wie in der Schranke (`nimmVersammlungsfreigabeZurueck`).
	 */
	const vollmachtenHaengen =
		versammlung.zustand === 'freigegeben' &&
		(await zaehleVollmachten(locals.benutzer.operatorId, params.id)) > 0;

	return {
		versammlung,
		gemeinschaft,
		befund,
		vollmachtenHaengen,
		momentaufnahme: momentaufnahme
			? {
					eingefrorenAm: momentaufnahme.takenAt,
					parteien: momentaufnahme.parties.length,
					kopfstimmen: liste?.summeKopfstimmen ?? 0,
					wertquoten: liste?.summeWertquote ?? 0,
					gesamtquote: momentaufnahme.totalQuota,
					eintraege:
						liste?.eintraege.map((e) => ({
							name: e.displayName,
							ausgeuebtDurch: e.ausgeuebtDurch,
							einheiten: e.einheiten.map((u) => u.label),
							kopfstimmen: e.kopfstimmen,
							wertquote: e.wertquote
						})) ?? []
				}
			: null
	};
};

export const actions: Actions = {
	freigeben: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			await gibVersammlungFrei(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			return { freigegeben: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	zuruecknehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await nimmVersammlungsfreigabeZurueck(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('grund')) || undefined
			);
			return { zurueckgenommen: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
