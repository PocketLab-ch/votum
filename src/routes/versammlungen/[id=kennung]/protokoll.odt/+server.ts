import { error } from '@sveltejs/kit';
import { alsOpenDocument, ODT_MEDIENTYP } from '$lib/domain/odt';
import { dosZeitstempel } from '$lib/domain/archiv';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { protokollfusszeile } from '$lib/domain/protokoll';
import { holeProtokoll, vermerkeAusgabe } from '$lib/server/protokoll';
import type { RequestHandler } from './$types';

/**
 * Das Protokoll als OpenDocument-Text (FR-49).
 *
 * **Warum es das neben dem Word-Dokument gibt** (Auftraggeber, 05.09.2026: «Mach noch
 * eine Odt Variante»). Word ist das Standardformat, weil die Nachbearbeitung
 * ausserhalb stattfindet — aber nicht jede Bewirtschaftung arbeitet mit Word.
 * Wer LibreOffice einsetzt, bekommt hier das Format seines Hauses statt eine
 * Umwandlung, die bei jedem Öffnen anders ausfällt.
 *
 * **Derselbe Weg wie beim Word-Dokument**, bis auf den Setzer: dieselbe
 * Zugangsprüfung, dieselbe Fusszeile, derselbe Verlaufseintrag. Jede Ausgabe
 * steht im Verlauf (FR-49) — später soll sich sagen lassen, welche Fassung wann
 * und in welchem Format erzeugt wurde.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const protokoll = await holeProtokoll(locals.benutzer.operatorId, params.id);
	if (!protokoll) error(404, 'Für diese Versammlung besteht noch kein Protokoll.');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);
	const stand = new Date(protokoll.geaendertAm).toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	// In hiesiger Zeit, nicht in UTC: Der Stempel steht später in einer
	// Dateiliste neben Uhrzeiten, die niemand umrechnet (AD-12).
	const bytes = alsOpenDocument(
		protokoll.body,
		dosZeitstempel(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' })),
		protokollfusszeile({
			gemeinschaft: gemeinschaft?.name ?? '',
			datum: versammlung.datum,
			stand
		})
	);

	await vermerkeAusgabe(
		{
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		},
		params.id,
		'odt',
		protokoll.body.length
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': ODT_MEDIENTYP,
			'content-disposition': `attachment; filename="Protokoll-${versammlung.datum}.odt"`,
			'cache-control': 'no-store'
		}
	});
};
