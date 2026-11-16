import { error, fail } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeEinheiten } from '$lib/server/einheiten';
import { erstelleNutzniessung, holeNutzniessungen,
	berichtigeNutzniesser,
	beendeNutzniessung
} from '$lib/server/nutzniessung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { DateiFehler } from '$lib/server/dateien';
import {
	pruefeEinheitGehoert,
	pruefeNutzniessungGehoert
} from '$lib/server/zugehoerigkeit';
import { jaNein, text } from '$lib/server/formular';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const [einheiten, nutzniessungen] = await Promise.all([
		holeEinheiten(locals.benutzer.operatorId, params.id),
		holeNutzniessungen(locals.benutzer.operatorId, params.id)
	]);

	return { gemeinschaft, einheiten, nutzniessungen };
};

export const actions: Actions = {
	/**
	 * Den Namen des Nutzniessers berichtigen (23.08.2026, Prüflauf II).
	 *
	 * Der Weg, den es nicht gab: «zugunsten von BNUT» liess sich nicht ändern.
	 */
	berichtigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **`id` ist eine Nutzniessung**, keine Einheit und keine Partei
			 * (26.08.2026, aus der Sicherheitsprüfung). Sie kommt aus einem
			 * verborgenen Feld, also von aussen; `usufruct` führt eine eigene
			 * `stweg_id`, und dort wird gefragt.
			 */
			await pruefeNutzniessungGehoert(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('id'))
			);
			const e = await berichtigeNutzniesser(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				text(daten.get('id')),
				text(daten.get('holderName'))
			);
			return { hinweis: `Aus «${e.vorher}» wurde «${e.nachher}».` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Beenden (mit Datum) oder tilgen (ohne) — zwei Sachverhalte, ein Weg.
	 *
	 * Ohne `per` ist es die Tilgung eines Versehens; der Kern weist sie ab,
	 * sobald die Einheit an einer freigegebenen Versammlung teilgenommen hat.
	 */
	beenden: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			// Wie beim Berichtigen: `id` ist eine Nutzniessung und wird in
			// `usufruct` gesucht (26.08.2026, aus der Sicherheitsprüfung).
			await pruefeNutzniessungGehoert(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('id'))
			);
			const e = await beendeNutzniessung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				text(daten.get('id')),
				text(daten.get('per')) || null
			);
			return {
				hinweis: e.getilgt
					? `Die Nutzniessung zugunsten von «${e.name}» ist getilgt.`
					: `Die Nutzniessung zugunsten von «${e.name}» endet.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine Nutzniessung erfassen.
	 *
	 * Benannt statt `default`, seit es daneben `berichtigen` und `beenden` gibt
	 * (23.08.2026): SvelteKit lässt `default` nicht neben benannten Aktionen
	 * stehen, und der Fehler fiele erst beim Absenden auf.
	 */
	erfassen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const nachweis = daten.get('nachweis');

		try {
			/*
			 * **Die Einheit muss zu dieser Gemeinschaft gehören** (26.08.2026, aus
			 * der Sicherheitsprüfung). Sie kommt aus einer Auswahlliste;
			 * `erstelleNutzniessung` nimmt die `stweg_id` aus der gefundenen Einheit
			 * und schriebe die Nutzniessung sonst in die Nachbargemeinschaft — wo
			 * sie deren Stimmrecht verschiebt und auf keiner Seite steht, die sie
			 * anzeigt.
			 */
			await pruefeEinheitGehoert(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('unitId'))
			);
			await erstelleNutzniessung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				{
					unitId: text(daten.get('unitId')),
					holderName: text(daten.get('holderName')),
					validFrom: text(daten.get('validFrom')),
					validTo: text(daten.get('validTo')) || undefined,
					hasAgreement: jaNein(daten.get('hasAgreement')),
					contractOnFile: jaNein(daten.get('contractOnFile')),
					agreementSummary: text(daten.get('agreementSummary')) || undefined
				},
				nachweis instanceof File ? nachweis : undefined
			);
			return { angelegt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler || fehler instanceof DateiFehler) {
				return fail(400, {
					fehler: {
						nachricht: fehler.message,
						feld: fehler instanceof FachlicherFehler ? fehler.feld : undefined
					}
				});
			}
			const meldung = String((fehler as Error).message);
			if (meldung.includes('usufruct_keine_ueberschneidung')) {
				return fail(400, {
					fehler: {
						nachricht:
							'An dieser Einheit besteht im angegebenen Zeitraum bereits eine Nutzniessung.'
					}
				});
			}
			throw fehler;
		}
	}
};
