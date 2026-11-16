import { error } from '@sveltejs/kit';
import { alsWorddokument } from '$lib/domain/docx';
import { dosZeitstempel } from '$lib/domain/archiv';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { protokollfusszeile } from '$lib/domain/protokoll';
import { holeProtokoll, vermerkeAusgabe } from '$lib/server/protokoll';
import type { RequestHandler } from './$types';

/**
 * Das Protokoll als Word-Dokument (FR-49).
 *
 * **Word ist das Standardformat**, weil die Nachbearbeitung ausserhalb
 * stattfindet: Briefkopf, Unterschriftenzeilen, die Eigenheiten jeder
 * Bewirtschaftung. Ein PDF wäre dafür das falsche Werkzeug, und das Siegel
 * liegt ohnehin nicht auf dem Protokoll (PRD §4.11).
 *
 * Jede Ausgabe steht im Verlauf (FR-49): Später soll sich sagen lassen, welche
 * Fassung wann erzeugt wurde.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const protokoll = await holeProtokoll(locals.benutzer.operatorId, params.id);
	if (!protokoll) error(404, 'Für diese Versammlung besteht noch kein Protokoll.');

	/*
	 * **Dieselbe Fusszeile wie im PDF** (05.09.2026). Sie steht auf jedem Blatt
	 * und sagt, aus welcher Fassung es stammt — bis dahin trug sie allein das
	 * PDF, und ein ausgedrucktes Word-Protokoll liess sich ab Seite zwei keiner
	 * Fassung mehr zuordnen.
	 */
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);
	const stand = new Date(protokoll.geaendertAm).toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	// In hiesiger Zeit, nicht in UTC: Der Stempel steht später in einer
	// Dateiliste neben Uhrzeiten, die niemand umrechnet (AD-12).
	const bytes = alsWorddokument(
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
		'docx',
		protokoll.body.length
	);

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type':
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'content-disposition': `attachment; filename="Protokoll-${versammlung.datum}.docx"`,
			'cache-control': 'no-store'
		}
	});
};
