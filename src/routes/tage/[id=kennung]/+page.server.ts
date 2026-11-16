import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { planeUmlegung, umlegungsmeldung } from '$lib/domain/umlegen';
import type { Betriebsart, Versammlungsart } from '$lib/domain/versammlung';
import { text } from '$lib/server/formular';
import {
	aendereVersammlungstag,
	holeMittagende,
	holeVersammlungstag,
	legeAngabenUm
} from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Angaben einer gemeinsamen Versammlung: Bezeichnung, Art, Tag, Beginn, Ort.
 *
 * Der erste Schritt des Ablaufs — dieselbe Stelle wie «Angaben und Unterlagen»
 * bei einer einzelnen Versammlung. Vorher liessen sich diese Felder nach dem
 * Anlegen überhaupt nicht mehr ändern.
 *
 * **Seit dem 11.08.2026 ist es auch die Stelle, an der man einmal ändert statt
 * sechsmal:** Ein Häkchen legt Tag, Beginn, Ort und Art auf alle mittagenden
 * Versammlungen um, die noch im Entwurf sind. Was nicht mitkann, steht in der
 * Meldung — nicht mitzuziehen ist eine Aussage, kein Schweigen.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const [tag, mittagende] = await Promise.all([
		holeVersammlungstag(locals.benutzer.operatorId, params.id),
		holeMittagende(locals.benutzer.operatorId, params.id)
	]);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	// Der Plan **vor** dem Klick: Das Häkchen soll sagen, was es tun wird, und
	// nicht bloss «auf alle übernehmen» versprechen.
	const stand = planeUmlegung(
		{
			datum: tag.datum,
			uhrzeit: tag.uhrzeit,
			ort: tag.ort,
			art: tag.art,
			anlass: tag.anlass,
			betriebsart: tag.betriebsart
		},
		mittagende
	);

	return {
		tag,
		mittagende: mittagende.length,
		abweichend: stand.aendern.length,
		gesperrt: stand.gesperrt
	};
};

export const actions: Actions = {
	speichern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const art: Versammlungsart =
			text(daten.get('art')) === 'ausserordentlich' ? 'ausserordentlich' : 'ordentlich';
		// «einfach» nur, wenn es ausdrücklich dasteht: Ein fehlendes Feld darf
		// nicht auf die kleinere Betriebsart zurückfallen — dann verlören die
		// Eigentümer ihre Zugangskarten, ohne dass jemand das gewählt hätte.
		const betriebsart: Betriebsart =
			text(daten.get('betriebsart')) === 'einfach' ? 'einfach' : 'gefuehrt';
		const werte = {
			bezeichnung: text(daten.get('bezeichnung')),
			datum: text(daten.get('datum')),
			uhrzeit: text(daten.get('uhrzeit')),
			ort: text(daten.get('ort')),
			bemerkung: text(daten.get('bemerkung')),
			art,
			anlass: text(daten.get('anlass')),
			betriebsart
		};
		const wer = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};

		try {
			await aendereVersammlungstag(wer, params.id, werte);

			// Erst speichern, dann umlegen: `legeAngabenUm` liest den neuen Stand
			// aus der Datenbank, damit es nur eine Wahrheit gibt.
			if (text(daten.get('umlegen')) === 'ja') {
				const plan = await legeAngabenUm(wer, params.id);
				return { hinweis: `Gespeichert. ${umlegungsmeldung(plan)}` };
			}
			return { hinweis: 'Gespeichert.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld }, werte });
			}
			throw fehler;
		}
	}
};
