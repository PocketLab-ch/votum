import { holeNeutraktandenfussnote } from '$lib/server/neutraktanden';
import { holeLesarten } from '$lib/server/lesarten';
import { holeParteinamen } from '$lib/server/eigentuemer';
import { error } from '@sveltejs/kit';
import { holeBetreiber, holeBriefkopf } from '$lib/server/betreiber';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import { erzeugeTraktandenliste, type Ausprägung } from '$lib/server/pdf/traktandenliste';
import { vermerkeAusfallunterlage } from '$lib/server/ausfallsicherung';
import { vermerkeTraktandenliste } from '$lib/server/unterlagenvermerk';
import type { RequestHandler } from './$types';

/**
 * Die Traktandenliste als PDF.
 *
 * Wird bei jedem Abruf neu erzeugt und nicht gespeichert. Der Grund: Sie ist
 * eine Ansicht der Traktanden, kein eigener Gegenstand. Ein gespeichertes PDF
 * ginge nach der nächsten Änderung als aktuell durch, obwohl es das nicht mehr
 * wäre — und niemand sähe es ihm an.
 *
 * Mit der Freigabe ändert sich daran nichts, weil sich die Traktanden dann nicht
 * mehr ändern. Ins Abschlusspaket (Welle 2) kommt eine feste Fassung.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const art: Ausprägung =
		url.searchParams.get('art') === 'praesentation' ? 'praesentation' : 'liste';

	const [gemeinschaft, traktanden, betreiber, briefkopf] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeTraktanden(locals.benutzer.operatorId, params.id),
		holeBetreiber(locals.benutzer.operatorId),
		holeBriefkopf(locals.benutzer.operatorId)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const { bytes, hinweise } = await erzeugeTraktandenliste(art, {
		versammlung,
		gemeinschaftName: gemeinschaft.name,
		traktanden,
		parteinamen: await holeParteinamen(locals.benutzer.operatorId, versammlung.stwegId),
		// L5: Zeichen und Fussnote an neuen Traktanden (Migration 174).
		neutraktanden: await holeNeutraktandenfussnote(locals.benutzer.operatorId, params.id),
		// L8 (Migration 184): der Satz zu den Vollmachten der Verwaltung an
		// Traktanden mit Häkchen, je nach Wahl (G7).
		verwaltungL8: (await holeLesarten(locals.benutzer.operatorId, { meetingId: params.id })).L8,
		briefkopf,
		briefkopfHoeheMm: betreiber?.briefkopfHoeheMm,
		briefkopfAlleSeiten: betreiber?.briefkopfAlleSeiten
	});

	// Ein unbrauchbarer Briefkopf verhindert das PDF nicht, bleibt aber sichtbar:
	// Ohne diesen Kopf fiele erst beim Ausdruck auf, dass das Logo fehlt.
	const kopfzeilen: Record<string, string> = {
		'content-type': 'application/pdf',
		'content-disposition': `inline; filename="Traktandenliste-${versammlung.datum}${art === 'praesentation' ? '-Praesentation' : ''}.pdf"`,
		'cache-control': 'private, no-store'
	};
	if (hinweise.length > 0) kopfzeilen['x-versammlung-hinweis'] = hinweise.join(' | ');


	// Für den Nachweis, wann die Liste vorlag — das Ereignis gab es seit je,
	// geschrieben hat es bis zum 23.08.2026 niemand.
	const handelnder = {
		operatorId: locals.benutzer.operatorId,
		userId: locals.benutzer.id,
		label: locals.benutzer.displayName
	};
	await vermerkeTraktandenliste(handelnder, params.id);

	// Der Ausweichplan gehört in die Vorbereitung: Die Leiste zeigt ihn erst
	// als erledigt, wenn jede Unterlage geholt wurde.
	await vermerkeAusfallunterlage(handelnder, params.id, 'traktanden');

	return new Response(bytes as BodyInit, { headers: kopfzeilen });
};
