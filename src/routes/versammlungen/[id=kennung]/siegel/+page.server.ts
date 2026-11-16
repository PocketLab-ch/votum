import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { zeitstempelInWorten } from '$lib/domain/siegel';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import {
	erhebeSiegellage,
	hatVerlaufspdf,
	listeStimmnachweise,
	versiegle
} from '$lib/server/siegel';
import { dienst, holeZeitstempel } from '$lib/server/zeitstempel';
import { holeOhneErgebnisUndVermerk } from '$lib/server/protokoll';
import { hinweisVorDemVersiegeln } from '$lib/domain/protokoll';
import type { Actions, PageServerLoad } from './$types';

/**
 * Das Abschlusspaket und sein Siegel (FR-51 bis FR-55).
 *
 * Eine Seite mit genau einer Handlung. Sie ist unumkehrbar — danach lassen sich
 * Stimmen, Anwesenheit und Vollmachten nicht mehr ändern —, und deshalb steht
 * hier vorher, was geschieht, und nachher, was entstanden ist.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, lage] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		erhebeSiegellage(locals.benutzer.operatorId, params.id)
	]);

	const [stelle, stimmnachweise, verlaufspdf] = await Promise.all([
		dienst(locals.benutzer.operatorId),
		listeStimmnachweise(locals.benutzer.operatorId, params.id),
		// Nur wo das Paket ihn wirklich trägt: Pakete von vor Block 3 haben
		// keinen, und der Verweis führte ins Leere.
		hatVerlaufspdf(locals.benutzer.operatorId, params.id)
	]);

	return {
		versammlung,
		gemeinschaft,
		lage,
		/*
		 * Nur wo gleich versiegelt werden kann (Block 7c): Vor dem Schluss gibt es
		 * den Haken nicht, und nach dem Versiegeln käme der Rat zu spät.
		 */
		hakenhinweis: lage.moeglich
			? hinweisVorDemVersiegeln(
					await holeOhneErgebnisUndVermerk(locals.benutzer.operatorId, params.id)
				)
			: null,
		stimmnachweise,
		verlaufspdf,
		zeitstempeldienst: stelle
			? { name: stelle.name, angeheftet: stelle.fingerabdruecke.length }
			: null,
		zeitstempelsatz: lage.siegel
			? zeitstempelInWorten(
					lage.siegel.zeitstempel,
					lage.siegel.zeitstempelStelle,
					lage.siegel.zeitstempelAm
				)
			: null
	};
};

export const actions: Actions = {
	versiegeln: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const handelnder = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		try {
			const siegel = await versiegle(
				handelnder,
				params.id,
				// In hiesiger Zeit: Der Stempel steht später neben Uhrzeiten, die
				// niemand umrechnet (AD-12).
				new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' })
			);
			// Der Zeitstempel wird **nach** dem Siegel geholt: Er bezeugt das
			// fertige Paket, und er darf das Versiegeln nicht aufhalten. Ohne Netz
			// bleibt er offen und wird später nachgeholt (FR-53).
			const stempel = await holeZeitstempel(handelnder, params.id);
			return {
				hinweis:
					`Versiegelt. Das Siegel lautet ${siegel.siegel.slice(0, 16)}… — es steht vollständig ` +
					'im Manifest und im Verlauf. ' +
					(stempel.zustand === 'vorhanden'
						? `Der Zeitstempel liegt vor: ${stempel.bemerkung}`
						: `Der Zeitstempel steht noch aus: ${stempel.bemerkung}`)
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Den Zeitstempel nachholen (FR-53).
	 *
	 * Bewusst von Hand ausgelöst und nicht als stiller Hintergrundlauf: Wer
	 * abschliesst, soll sehen, ob die Bezeugung geklappt hat — ein Auftrag, der
	 * irgendwann irgendwo läuft, wird erst bemerkt, wenn es zu spät ist.
	 */
	zeitstempelNachholen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const ergebnis = await holeZeitstempel(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			params.id
		);
		return ergebnis.zustand === 'vorhanden'
			? { hinweis: `Zeitstempel geholt. ${ergebnis.bemerkung}` }
			: fail(400, { fehler: { nachricht: ergebnis.bemerkung } });
	}
};
