import { error } from '@sveltejs/kit';
import { suchhinweis } from '$lib/domain/historiesuche';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeHistorie, sucheNachsichtig } from '$lib/server/historie';
import { holeEingespielte } from '$lib/server/einspielen';
import type { PageServerLoad } from './$types';

/**
 * Historie und Suche stehen auf einer Seite und in der Adresse.
 *
 * Der Suchbegriff ist ein Abfrageteil, kein Formularzustand: Damit lässt sich
 * ein Fund als Verweis weiterreichen — «sieh dir an, was wir 2023 dazu
 * beschlossen haben» —, und der Zurück-Knopf des Browsers tut, was er soll.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const suchbegriff = (url.searchParams.get('q') ?? '').trim();

	const [versammlungen, treffer, eingespielte] = await Promise.all([
		holeHistorie(locals.benutzer.operatorId, params.id),
		suchbegriff
			? sucheNachsichtig(locals.benutzer.operatorId, suchbegriff, params.id)
			: Promise.resolve([]),
		// Versammlungen, die anderswo geführt und hier als Paket aufgenommen
		// wurden (PRD §13). Sie stehen in derselben Liste: Ein Jahr später soll
		// niemand raten müssen, wo die vom letzten Mai liegt.
		holeEingespielte(locals.benutzer.operatorId, params.id)
	]);

	return {
		gemeinschaft,
		versammlungen,
		suchbegriff,
		treffer,
		eingespielte: eingespielte.map((e) => ({
			id: e.id,
			datum: e.manifest.versammlung.datum,
			ort: e.manifest.versammlung.ort,
			art: e.manifest.versammlung.art,
			stufe: e.manifest.versammlung.stufe,
			versiegeltAm: e.manifest.versiegeltAm
		})),
		hinweis: suchhinweis(suchbegriff)
	};
};
