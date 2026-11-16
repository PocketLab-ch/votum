import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { rolleInWorten } from '$lib/domain/rollen';
import { MINDESTLAENGE } from '$lib/domain/kennwort';
import { merkmalPruefwert, SITZUNGS_COOKIE } from '$lib/server/auth';
import { aendereEigenesKennwort, holeEigenesKonto, loeseVerknuepfung } from '$lib/server/benutzer';
import { istEingerichtet } from '$lib/server/authentik';
import type { Actions, PageServerLoad } from './$types';

/**
 * Das eigene Konto (13.08.2026).
 *
 * **Warum eine eigene Seite und nicht ein Block unter «Betreiber».** Die
 * Betreiberseite ist der Verwaltung vorbehalten (`domain/rollen.ts`); eine
 * Sitzungsleitung käme dort nicht hin und könnte ihr Kennwort nie ändern.
 * Genau das war der Zustand bis heute.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	/*
	 * **Der Stand der Verknüpfung kommt aus der Datenbank, nicht aus der Sitzung**
	 * (16.09.2026). `locals.benutzer` trägt Name, Rolle und Kennung des Kontos,
	 * aber nicht, ob eine Authentik-Identität hinterlegt ist — und die Sitzung
	 * überlebt ein Lösen, sie wäre also ohnehin die falsche Quelle dafür.
	 */
	const stand = await holeEigenesKonto(locals.benutzer.operatorId, locals.benutzer.id);
	return {
		konto: {
			username: locals.benutzer.username,
			displayName: locals.benutzer.displayName,
			rolle: rolleInWorten(locals.benutzer.role),
			ueberAuthentik: stand?.ueberAuthentik ?? false,
			hatKennwort: stand?.hatKennwort ?? false,
			email: stand?.email ?? null
		},
		mindestlaenge: MINDESTLAENGE,
		authentikEingerichtet: istEingerichtet()
	};
};

export const actions: Actions = {
	/**
	 * Löst die eigene Verknüpfung mit Authentik (Auftraggeber, 16.09.2026).
	 *
	 * **Die eigene Sitzung überlebt**, die übrigen enden — dieselbe Abwägung wie
	 * beim Kennwortwechsel darunter. Wer aufräumt, soll sich dabei nicht selbst
	 * hinauswerfen; wer aber ein zweites Gerät im Verdacht hat, ist es damit los.
	 */
	verknuepfungLoesen: async ({ locals, cookies }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const merkmal = cookies.get(SITZUNGS_COOKIE);
			const { entwertet } = await loeseVerknuepfung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				locals.benutzer.id,
				merkmal ? merkmalPruefwert(merkmal) : null
			);
			return {
				hinweis:
					'Die Verknüpfung mit Authentik ist gelöst. Sie melden sich künftig mit ' +
					'Benutzername und Kennwort an.' +
					(entwertet > 0
						? ` ${entwertet} weitere angemeldete ${entwertet === 1 ? 'Sitzung wurde' : 'Sitzungen wurden'} beendet.`
						: '')
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	kennwort: async ({ request, locals, cookies }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		try {
			// Die eigene Sitzung überlebt; die übrigen enden. Sich beim Wechsel
			// selbst abzumelden wäre eine Strafe für richtiges Verhalten.
			const merkmal = cookies.get(SITZUNGS_COOKIE);
			const { entwertet } = await aendereEigenesKennwort(
				locals.benutzer,
				String(daten.get('alt') ?? ''),
				String(daten.get('neu') ?? ''),
				String(daten.get('wiederholung') ?? ''),
				merkmal ? merkmalPruefwert(merkmal) : null
			);

			return {
				hinweis:
					'Das Kennwort ist geändert.' +
					(entwertet > 0
						? ` ${entwertet} weitere angemeldete ${entwertet === 1 ? 'Sitzung wurde' : 'Sitzungen wurden'} beendet.`
						: '')
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
