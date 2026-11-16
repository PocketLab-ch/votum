import { error, fail } from '@sveltejs/kit';
import { PAKET_HOECHSTGROESSE, PaketFehler, pruefePaket } from '$lib/server/paketpruefung';
import { dienst, ersatzdienst } from '$lib/server/zeitstempel';
import type { Actions, PageServerLoad } from './$types';

/**
 * Ein Abschlusspaket prüfen (FR-54).
 *
 * Bewusst **ausserhalb** einer Versammlung: Geprüft wird ein ZIP, das jemand
 * mitbringt — auch eines aus einer anderen Anlage oder aus einer Zeit, in der
 * die Versammlung hier längst gelöscht ist.
 *
 * **Nichts wird abgelegt.** Das Paket wird gelesen, gerechnet und wieder
 * vergessen. Ein Prüfwerkzeug, das eine Kopie behält, wäre eine Datensammlung,
 * die niemand bestellt hat.
 */
const STEMPEL_HOECHSTGROESSE = 1024 * 1024;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const [stelle, ersatz] = await Promise.all([
		dienst(locals.benutzer.operatorId),
		ersatzdienst(locals.benutzer.operatorId)
	]);
	return {
		angehefteteStelle: stelle?.name ?? null,
		/*
		 * **Nur ein Ersatz mit angeheftetem Zertifikat springt ein**
		 * (13.11.2026, Sicherheitsprüfung). Ohne Abdruck wird er nicht gefragt;
		 * ihn hier zu nennen hiesse, dem Prüfer eine Ausweichung zu versprechen,
		 * die es nicht gibt.
		 */
		angehefteteErsatzstelle:
			ersatz && ersatz.fingerabdruecke.length > 0 ? ersatz.name : null
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const daten = await request.formData();
		const paket = daten.get('paket');
		const stempel = daten.get('zeitstempel');
		const siegel = String(daten.get('siegel') ?? '');

		if (!(paket instanceof File) || paket.size === 0) {
			return fail(400, { fehler: { nachricht: 'Bitte ein Abschlusspaket wählen.' } });
		}
		if (paket.size > PAKET_HOECHSTGROESSE) {
			return fail(400, {
				fehler: {
					nachricht: `Das Paket ist grösser als ${PAKET_HOECHSTGROESSE / 1024 / 1024} MB und wird hier nicht gelesen.`
				}
			});
		}
		// Auch der Zeitstempel wird gepuffert; ohne diese Zeile las er sich in
		// beliebiger Grösse ein (K1, 15.10.2026). Eine Antwort nach RFC 3161
		// misst wenige Kilobyte; ein Megabyte lässt jedem echten Raum.
		if (stempel instanceof File && stempel.size > STEMPEL_HOECHSTGROESSE) {
			return fail(400, {
				fehler: { nachricht: 'Der Zeitstempel ist grösser als 1 MB und wird hier nicht gelesen.' }
			});
		}

		try {
			const befund = await pruefePaket(
				locals.benutzer.operatorId,
				new Uint8Array(await paket.arrayBuffer()),
				stempel instanceof File && stempel.size > 0
					? new Uint8Array(await stempel.arrayBuffer())
					: null,
				siegel
			);
			return { befund, dateiname: paket.name };
		} catch (fehler) {
			if (fehler instanceof PaketFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	}
};
