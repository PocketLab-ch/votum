import { error } from '@sveltejs/kit';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { erzeugeProtokollPdf } from '$lib/server/pdf/protokoll';
import { holeProtokoll, vermerkeAusgabe } from '$lib/server/protokoll';
import { protokollfusszeile } from '$lib/domain/protokoll';
import type { RequestHandler } from './$types';

/**
 * Das Protokoll als PDF (FR-49) — die Fassung zum Verschicken und Ablegen.
 *
 * Jede Ausgabe steht im Verlauf: Später soll sich sagen lassen, welche Fassung
 * wann erzeugt wurde.
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

	const bytes = await erzeugeProtokollPdf(
		protokoll.body,
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
		'pdf',
		protokoll.body.length
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="Protokoll-${versammlung.datum}.pdf"`,
			'cache-control': 'no-store'
		}
	});
};
