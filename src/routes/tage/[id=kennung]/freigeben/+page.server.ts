import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { erhebeFreigabelage, gibVersammlungFrei } from '$lib/server/freigabe';
import { hausDesAbends, holeMittagende } from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/**
 * Freigeben — je Gemeinschaft, aber an einer Stelle.
 *
 * **Warum es diese Seite gibt.** Der Ablauf einer gemeinsamen Versammlung sprang
 * von der Vorbereitung direkt in den Saal; der Abschnitt «Ausgeben», den der
 * einzelne Ablauf hat, fehlte. Gemeldet am 11.08.2026 beim Vergleich mit dem
 * Entwurf. Wer sechs Häuser freigeben wollte, öffnete sechs Seiten.
 *
 * **Was hier nicht zusammengefasst wird: die Prüfung.** Jede Gemeinschaft hat
 * ihre eigene Momentaufnahme, ihre eigenen Traktanden und ihre eigenen
 * Erfordernisse — freigegeben wird deshalb einzeln, mit derselben Prüfung wie
 * auf der Seite der Versammlung (`erhebeFreigabelage`). Diese Seite zeigt sie
 * nebeneinander und löst sie nacheinander aus; was nicht kann, sagt warum.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;
	const mittagende = await holeMittagende(op, params.id);

	// Der Befund je Haus **vor** dem Klick: Ein Knopf, der erst beim Drücken
	// sagt, dass Traktanden fehlen, ist eine Falle.
	const zeilen = await Promise.all(
		mittagende.map(async (m) => {
			if (m.zustand !== 'entwurf') {
				return { ...m, bereit: false, huerden: [] as string[], schonFrei: true };
			}
			try {
				const { befund } = await erhebeFreigabelage(op, m.id);
				return {
					...m,
					bereit: befund.moeglich,
					huerden: befund.hindernisse.map((h) => h.text),
					schonFrei: false
				};
			} catch (fehler) {
				if (fehler instanceof FachlicherFehler) {
					return { ...m, bereit: false, huerden: [fehler.message], schonFrei: false };
				}
				throw fehler;
			}
		})
	);

	return { zeilen };
};

export const actions: Actions = {
	/**
	 * Gibt alle frei, die es können.
	 *
	 * Ohne Klammer über die einzelnen Freigaben — jede ist für sich vollständig
	 * (Momentaufnahme, Zustand, Verlaufseintrag in einer Transaktion). Bricht
	 * eine ab, stehen die übrigen trotzdem, und die Meldung nennt sie beim Namen.
	 */
	alle: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const wer = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};

		const mittagende = await holeMittagende(locals.benutzer.operatorId, params.id);
		const frei: string[] = [];
		const nicht: string[] = [];

		for (const m of mittagende.filter((x) => x.zustand === 'entwurf')) {
			try {
				await gibVersammlungFrei(wer, m.id);
				frei.push(m.gemeinschaft);
			} catch (fehler) {
				if (fehler instanceof FachlicherFehler) {
					nicht.push(`${m.gemeinschaft}: ${fehler.message}`);
					continue;
				}
				throw fehler;
			}
		}

		if (frei.length === 0 && nicht.length === 0) {
			return { hinweis: 'Es war nichts mehr freizugeben.' };
		}

		const teile: string[] = [];
		if (frei.length > 0) {
			teile.push(
				`${frei.length} ${frei.length === 1 ? 'Versammlung' : 'Versammlungen'} freigegeben: ${frei.join(', ')}.`
			);
		}
		if (nicht.length > 0) teile.push(`Nicht freigegeben — ${nicht.join(' · ')}`);

		// Ein Teilerfolg ist kein Fehler: Die Meldung nennt beides, und die Seite
		// zeigt darunter, was noch offen ist.
		return nicht.length > 0 && frei.length === 0
			? fail(400, { fehler: { nachricht: teile.join(' ') } })
			: { hinweis: teile.join(' ') };
	},

	/**
	 * Eine einzelne — der Knopf in ihrer Karte.
	 *
	 * **Die Versammlung kommt aus dem Formular** und wird deshalb gegen den Abend
	 * der Adresse geprüft (08.09.2026, aus dem neuen `check-abendbindung`). Ohne
	 * das gab die Seite eines Abends eine Versammlung frei, die zu einem anderen
	 * gehört: Der Zeilenschutz hält nur den Betreiber, und die Aktion nahm den
	 * Abend gar nicht erst entgegen.
	 */
	eine: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const id = String(daten.get('versammlung') ?? '');
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, id);
			await gibVersammlungFrei(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				id
			);
			return { hinweis: 'Freigegeben.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	}
};
